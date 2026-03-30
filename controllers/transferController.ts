import type { Request, Response } from "express";
import prisma from "../config/prisma";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface TransferItemBody {
  itemId: number; // Schema-тай нийцүүлж ID-аар авна
  name?: string;
  code?: string; // internalCode
  weight?: string;
  quantity: string | number;
  unit?: string;
}

interface TransferBody {
  code: string;
  date: string;
  status?: "Draft" | "Completed" | "Pending";
  fromWarehouseId: number; // ID-аар авна
  toWarehouseId: number; // ID-аар авна
  user?: string;
  details?: string;
  items: TransferItemBody[];
}

interface GetAllQuery {
  search?: string;
  status?: string;
  page?: string;
  limit?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function applyTransferStock(
  tx: any,
  items: TransferItemBody[],
  fromWarehouseId: number,
  toWarehouseId: number,
  transferId: number,
  transferCode: string,
) {
  for (const itemData of items) {
    const qty = Number(itemData.quantity) || 0;
    const itemId = itemData.itemId;

    if (qty <= 0 || !itemId) continue;

    // 1. ГАРАХ АГУУЛАХ: Үлдэгдэл байгаа эсэхийг шалгах
    const sourceStock = await tx.warehouseStock.findUnique({
      where: { itemId_warehouseId: { itemId, warehouseId: fromWarehouseId } },
    });

    if (!sourceStock || sourceStock.quantity < qty) {
      throw new Error(
        `Барааны үлдэгдэл хүрэлцэхгүй байна. (Барааны ID: ${itemId})`,
      );
    }

    // 2. ГАРАХ АГУУЛАХ: Үлдэгдэл хасах
    await tx.warehouseStock.update({
      where: { itemId_warehouseId: { itemId, warehouseId: fromWarehouseId } },
      data: { quantity: { decrement: qty } },
    });

    // 3. ОРОХ АГУУЛАХ: Үлдэгдэл нэмэх (Байхгүй бол шинээр үүсгэнэ)
    await tx.warehouseStock.upsert({
      where: { itemId_warehouseId: { itemId, warehouseId: toWarehouseId } },
      update: { quantity: { increment: qty } },
      create: { itemId, warehouseId: toWarehouseId, quantity: qty },
    });

    // 4. STOCK MOVEMENT: Түүх бүртгэх (Оролт, Гаралт)
    await tx.stockMovement.createMany({
      data: [
        {
          itemId,
          type: "TRANSFER_OUT",
          quantity: -qty,
          warehouseFrom: String(fromWarehouseId),
          warehouseTo: String(toWarehouseId),
          referenceId: transferId,
          referenceCode: transferCode,
        },
        {
          itemId,
          type: "TRANSFER_IN",
          quantity: qty,
          warehouseFrom: String(fromWarehouseId),
          warehouseTo: String(toWarehouseId),
          referenceId: transferId,
          referenceCode: transferCode,
        },
      ],
    });

    // 5. НИЙТ ҮЛДЭГДЭЛ (Item.stock): Бүх агуулахын нийлбэрийг шинэчлэх
    const aggregate = await tx.warehouseStock.aggregate({
      where: { itemId },
      _sum: { quantity: true },
    });

    await tx.item.update({
      where: { id: itemId },
      data: { stock: aggregate._sum.quantity || 0 },
    });
  }
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export const getAll = async (
  req: Request<{}, {}, {}, GetAllQuery>,
  res: Response,
): Promise<void> => {
  try {
    const { search = "", status = "All", page = "1", limit = "10" } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { fromWarehouse: { name: { contains: search } } },
        { toWarehouse: { name: { contains: search } } },
      ];
    }
    if (status !== "All") {
      where.status = status;
    }

    const [total, transfers] = await prisma.$transaction([
      prisma.transfer.count({ where }),
      prisma.transfer.findMany({
        where,
        include: {
          items: true,
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true } },
        },
        orderBy: { created_at: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    res.json({ total, page: pageNum, limit: limitNum, data: transfers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getOne = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const transfer = await prisma.transfer.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        items: true,
        fromWarehouse: true,
        toWarehouse: true,
      },
    });
    if (!transfer) {
      res.status(404).json({ error: "Шилжүүлэг олдсонгүй" });
      return;
    }
    res.json(transfer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const create = async (
  req: Request<{}, {}, TransferBody>,
  res: Response,
): Promise<void> => {
  try {
    console.log("transfer create check");
    const {
      code,
      date,
      status = "Draft",
      fromWarehouseId,
      toWarehouseId,
      items,
      ...rest
    } = req.body;

    if (!code || !date || !fromWarehouseId || !toWarehouseId) {
      res.status(400).json({
        error: "Дутуу мэдээлэл: Код, огноо, агуулахын ID заавал хэрэгтэй.",
      });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Transfer үүсгэх
      const created = await tx.transfer.create({
        data: {
          code,
          date: new Date(date),
          status,
          fromWarehouseId: Number(fromWarehouseId),
          toWarehouseId: Number(toWarehouseId),
          user: rest.user || null,
          details: rest.details || null,
          items: {
            create: items.map((i) => ({
              itemId: i.itemId,
              name: i.name,
              code: i.code,
              weight: i.weight,
              quantity: Number(i.quantity),
              unit: i.unit,
            })),
          },
        },
      });

      // 2. Хэрэв шууд Completed бол үлдэгдэл хөдөлгөх
      if (status === "Completed") {
        await applyTransferStock(
          tx,
          items,
          fromWarehouseId,
          toWarehouseId,
          created.id,
          code,
        );
      }

      return created;
    });

    res.status(201).json({ message: "Шилжүүлэг үүслээ", id: result.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const update = async (
  req: Request<{ id: string }, {}, TransferBody>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const {
      status,
      items,
      fromWarehouseId,
      toWarehouseId,
      code,
      date,
      ...rest
    } = req.body;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.transfer.findUnique({
        where: { id },
        select: { status: true },
      });

      // 1. Мэдээллийг шинэчлэх
      await tx.transfer.update({
        where: { id },
        data: {
          code,
          date: new Date(date),
          status,
          fromWarehouseId: Number(fromWarehouseId),
          toWarehouseId: Number(toWarehouseId),
          user: rest.user || null,
          details: rest.details || null,
          items: {
            deleteMany: {},
            create: items.map((i) => ({
              itemId: i.itemId,
              name: i.name,
              code: i.code,
              weight: i.weight,
              quantity: Number(i.quantity),
              unit: i.unit,
            })),
          },
        },
      });

      // 2. Draft/Pending-ээс Completed рүү анх удаа шилжих үед үлдэгдэл хөдөлгөх
      if (status === "Completed" && existing?.status !== "Completed") {
        await applyTransferStock(
          tx,
          items,
          fromWarehouseId,
          toWarehouseId,
          id,
          code,
        );
      }
    });

    res.json({ message: "Амжилттай шинэчлэгдлээ" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    await prisma.transfer.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Устгагдлаа" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
