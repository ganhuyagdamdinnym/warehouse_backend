import type { Response } from "express";
import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/autoMiddleware";

interface TransferItemBody {
  itemId: number;
  name?: string;
  code?: string;
  quantity: string | number;
  unit?: string;
}

interface TransferBody {
  code: string;
  date: string;
  status?: "Draft" | "Completed" | "Pending";
  fromWarehouseId: number;
  toWarehouseId: number;
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

// ─── Helper ───────────────────────────────────────────────────────────────────

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

    const sourceStock = await tx.warehouseStock.findUnique({
      where: { itemId_warehouseId: { itemId, warehouseId: fromWarehouseId } },
    });

    if (!sourceStock || sourceStock.quantity < qty) {
      throw new Error(
        `Барааны үлдэгдэл хүрэлцэхгүй байна. (Барааны ID: ${itemId})`,
      );
    }

    await tx.warehouseStock.update({
      where: { itemId_warehouseId: { itemId, warehouseId: fromWarehouseId } },
      data: { quantity: { decrement: qty } },
    });

    await tx.warehouseStock.upsert({
      where: { itemId_warehouseId: { itemId, warehouseId: toWarehouseId } },
      update: { quantity: { increment: qty } },
      create: { itemId, warehouseId: toWarehouseId, quantity: qty },
    });

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

// ─── Warehouse ID-аар нэр олох helper ────────────────────────────────────────

async function getWarehouseIdByName(name: string): Promise<number | null> {
  const wh = await prisma.warehouse.findFirst({ where: { name } });
  return wh ? wh.id : null;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

// GET /api/transfers
export const getAll = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      search = "",
      status = "All",
      page = "1",
      limit = "10",
    } = req.query as GetAllQuery;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const currentUser = req.user!;

    const where: any = {};

    if (!currentUser.superAdmin) {
      const warehouseId = await getWarehouseIdByName(currentUser.warehouse);
      if (warehouseId) {
        where.OR = [
          { fromWarehouseId: warehouseId },
          { toWarehouseId: warehouseId },
        ];
      }
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { code: { contains: search } },
            { fromWarehouse: { name: { contains: search } } },
            { toWarehouse: { name: { contains: search } } },
          ],
        },
      ];
    }

    if (status !== "All") where.status = status;

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

// GET /api/transfers/:id
export const getOne = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = req.user!;

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

    if (!currentUser.superAdmin) {
      const warehouseId = await getWarehouseIdByName(currentUser.warehouse);
      if (
        transfer.fromWarehouseId !== warehouseId &&
        transfer.toWarehouseId !== warehouseId
      ) {
        res
          .status(403)
          .json({ error: "Та энэ шилжүүлгийг харах эрхгүй байна" });
        return;
      }
    }

    res.json(transfer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/transfers
export const create = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      code,
      date,
      status = "Draft",
      fromWarehouseId,
      toWarehouseId,
      items,
      ...rest
    } = req.body as TransferBody;

    const currentUser = req.user!;

    if (!code || !date || !fromWarehouseId || !toWarehouseId) {
      res.status(400).json({
        error: "Дутуу мэдээлэл: Код, огноо, агуулахын ID заавал хэрэгтэй.",
      });
      return;
    }

    if (!currentUser.superAdmin) {
      const warehouseId = await getWarehouseIdByName(currentUser.warehouse);
      if (Number(fromWarehouseId) !== warehouseId) {
        res.status(403).json({
          error: "Та зөвхөн өөрийн агуулахаас шилжүүлэг үүсгэх боломжтой",
        });
        return;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
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
              quantity: Number(i.quantity),
              unit: i.unit,
            })),
          },
        },
      });

      if (status === "Completed") {
        await applyTransferStock(
          tx,
          items,
          Number(fromWarehouseId),
          Number(toWarehouseId),
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

// PUT /api/transfers/:id
export const update = async (
  req: AuthRequest,
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
    } = req.body as TransferBody;
    const currentUser = req.user!;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.transfer.findUnique({
        where: { id },
        select: {
          status: true,
          fromWarehouseId: true,
          toWarehouseId: true,
          code: true,
        },
      });

      if (!existing) throw new Error("Шилжүүлэг олдсонгүй");

      if (existing.status === "Completed") {
        throw new Error("Батлагдсан шилжүүлгийг засах боломжгүй.");
      }

      // ── Эрх шалгах (superAdmin-аас бусад) ────────────────────────
      if (!currentUser.superAdmin) {
        const userWarehouseId = await getWarehouseIdByName(
          currentUser.warehouse,
        );

        const isFromOwner = existing.fromWarehouseId === userWarehouseId;
        const isToOwner = existing.toWarehouseId === userWarehouseId;

        // Огт холбоогүй хэрэглэгч
        if (!isFromOwner && !isToOwner) {
          throw new Error("Та энэ шилжүүлгийг засах эрхгүй байна");
        }

        // Draft → Pending: зөвхөн гарах агуулахын эзэн хийж болно
        if (existing.status === "Draft" && status === "Pending") {
          if (!isFromOwner) {
            throw new Error(
              "Зөвхөн гарах агуулахын эзэн шилжүүлгийг баталгаажуулах боломжтой",
            );
          }
        }

        // Pending → Completed: зөвхөн орох агуулахын эзэн хийж болно
        if (existing.status === "Pending" && status === "Completed") {
          if (!isToOwner) {
            throw new Error(
              "Зөвхөн орох агуулахын эзэн шилжүүлгийг дуусгах боломжтой",
            );
          }
        }
      }
      // ─────────────────────────────────────────────────────────────

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
              quantity: Number(i.quantity),
              unit: i.unit,
            })),
          },
        },
      });

      if (status === "Completed") {
        await applyTransferStock(
          tx,
          items,
          Number(fromWarehouseId),
          Number(toWarehouseId),
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

// DELETE /api/transfers/:id
export const remove = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = req.user!;

    const transfer = await prisma.transfer.findUnique({
      where: { id: Number(req.params.id) },
      select: { fromWarehouseId: true, toWarehouseId: true },
    });

    if (!transfer) {
      res.status(404).json({ error: "Шилжүүлэг олдсонгүй" });
      return;
    }

    if (!currentUser.superAdmin) {
      const warehouseId = await getWarehouseIdByName(currentUser.warehouse);
      if (
        transfer.fromWarehouseId !== warehouseId &&
        transfer.toWarehouseId !== warehouseId
      ) {
        res
          .status(403)
          .json({ error: "Та энэ шилжүүлгийг устгах эрхгүй байна" });
        return;
      }
    }

    await prisma.transfer.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Устгагдлаа" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
