import type { Request, Response } from "express";
import prisma from "../config/prisma";

// --- Helper: Stock Deduction (Exactly like Transfer) ---
const deductStock = async (
  tx: any,
  items: any[],
  warehouseId: number,
  refId: number,
  refCode: string,
) => {
  for (const item of items) {
    const itemId = Number(item.itemId);
    const qty = Number(item.quantity);

    if (!itemId || qty <= 0) continue;

    // 1. Check current warehouse stock
    const ws = await tx.warehouseStock.findUnique({
      where: { itemId_warehouseId: { itemId, warehouseId } },
    });

    if (!ws || ws.quantity < qty) {
      throw new Error(
        `Үлдэгдэл хүрэлцэхгүй: ${item.name || itemId} (Боломжит: ${ws?.quantity || 0})`,
      );
    }

    // 2. Decrement warehouse stock
    await tx.warehouseStock.update({
      where: { itemId_warehouseId: { itemId, warehouseId } },
      data: { quantity: { decrement: qty } },
    });

    // 3. Update Global Item Stock
    const aggregate = await tx.warehouseStock.aggregate({
      where: { itemId },
      _sum: { quantity: true },
    });
    await tx.item.update({
      where: { id: itemId },
      data: { stock: aggregate._sum.quantity || 0 },
    });

    // 4. Create Movement Record
    await tx.stockMovement.create({
      data: {
        itemId,
        type: "CHECKOUT",
        quantity: -qty,
        warehouseFrom: String(warehouseId),
        referenceId: refId,
        referenceCode: refCode,
        note: "Зарлагаар хасагдлаа",
      },
    });
  }
};

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code,
      date,
      status,
      contact,
      warehouse,
      warehouseId,
      user,
      details,
      items,
    } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // Create Checkout record
      const checkout = await tx.checkout.create({
        data: {
          code,
          date: new Date(date),
          status: status || "Pending",
          contact,
          warehouseId: Number(warehouseId),
          warehouse,
          user,
          details,
          items: {
            create: (items || []).map((i: any) => ({
              name: i.name,
              code: i.code,
              weight: String(i.weight),
              quantity: String(i.quantity),
            })),
          },
        },
      });

      // If completed, deduct stock immediately
      if (status === "Completed") {
        await deductStock(tx, items, Number(warehouseId), checkout.id, code);
      }
      return checkout;
    });

    res.status(201).json({ message: "Амжилттай!", id: result.id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const update = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const {
      code,
      date,
      status,
      contact,
      warehouse,
      warehouseId,
      details,
      items,
    } = req.body;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.checkout.findUnique({ where: { id } });
      if (!existing) throw new Error("Олдсонгүй");

      await tx.checkout.update({
        where: { id },
        data: {
          code,
          status,
          contact,
          warehouse,
          details,
          date: new Date(date),
          warehouseId: Number(warehouseId),
          items: {
            deleteMany: {},
            create: (items || []).map((i: any) => ({
              name: i.name,
              code: i.code,
              weight: String(i.weight),
              quantity: String(i.quantity),
            })),
          },
        },
      });

      if (existing.status !== "Completed" && status === "Completed") {
        await deductStock(tx, items, Number(warehouseId), id, code);
      }
    });
    res.json({ message: "Шинэчлэгдлээ" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getAll = async (req: Request, res: Response): Promise<void> => {
  const {
    search = "",
    status = "All",
    page = "1",
    limit = "10",
  } = req.query as any;
  const where: any = {};
  if (search)
    where.OR = [
      { code: { contains: search } },
      { contact: { contains: search } },
    ];
  if (status !== "All") where.status = status;

  const [total, data] = await prisma.$transaction([
    prisma.checkout.count({ where }),
    prisma.checkout.findMany({
      where,
      include: { items: true },
      orderBy: { created_at: "desc" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
  ]);
  res.json({ total, data });
};

export const getOne = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  const checkout = await prisma.checkout.findUnique({
    where: { id: Number(req.params.id) },
    include: { items: true },
  });
  checkout
    ? res.json({ checkout })
    : res.status(404).json({ error: "NotFound" });
};

export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  await prisma.checkout.delete({ where: { id: Number(req.params.id) } });
  res.json({ message: "Устгагдлаа" });
};
