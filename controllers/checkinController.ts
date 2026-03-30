import prisma from "../config/prisma";
import type { Request, Response } from "express";

// ─── Сток нэмэх Helper ──────────────────────────────────────────────────
const addStock = async (
  tx: any,
  items: { productId: number; quantity: number | string; name: string }[],
  warehouseId: number,
) => {
  for (const item of items) {
    const qty = Number(item.quantity);
    if (isNaN(qty) || qty <= 0) continue;

    // 1. Агуулах дахь стокийн мэдээлэл (upsert ашиглаж болно, гэхдээ findUnique илүү тодорхой)
    const existing = await tx.warehouseStock.findUnique({
      where: {
        itemId_warehouseId: {
          itemId: Number(item.productId),
          warehouseId: Number(warehouseId),
        },
      },
    });

    if (existing) {
      await tx.warehouseStock.update({
        where: { id: existing.id },
        data: { quantity: { increment: qty } },
      });
    } else {
      await tx.warehouseStock.create({
        data: {
          itemId: Number(item.productId),
          warehouseId: Number(warehouseId),
          quantity: qty,
        },
      });
    }

    // 2. Ерөнхий Item-ийн нийт стокийг нэмэх
    await tx.item.update({
      where: { id: Number(item.productId) },
      data: { stock: { increment: qty } },
    });

    // 3. Хөдөлгөөний түүх бүртгэх
    await tx.stockMovement.create({
      data: {
        itemId: Number(item.productId),
        type: "CHECKIN",
        quantity: qty,
        warehouseTo: String(warehouseId),
        note: `Орлогоор нэмэгдлээ. Агуулах ID: ${warehouseId}`,
      },
    });
  }
};

// POST /api/checkins
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
      // 1. Орлогын баримт үүсгэх
      const checkin = await tx.checkin.create({
        data: {
          code,
          date: new Date(date),
          status: status || "Draft",
          contact,
          warehouse,
          user,
          details,
          items: {
            create: (items || []).map((item: any) => ({
              name: item.name,
              code: item.code,
              weight: String(item.weight),
              quantity: String(item.quantity),
            })),
          },
        },
      });

      // 2. Хэрэв "Completed" бол стокт нөлөөлнө
      if (status === "Completed" && warehouseId) {
        await addStock(tx, items, Number(warehouseId));
      }

      return checkin;
    });

    res.status(201).json({ message: "Амжилттай үүслээ!", id: result.id });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/checkins/:id
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
      user,
      details,
      items,
    } = req.body;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.checkin.findUnique({ where: { id } });
      if (!existing) throw new Error("Орлого олдсонгүй");

      // Хэрэв өмнө нь Completed байсан бол дахиж Сток нэмэхгүй байх хамгаалалт
      if (existing.status === "Completed") {
        throw new Error("Батлагдсан орлогыг засах боломжгүй.");
      }

      await tx.checkin.update({
        where: { id },
        data: {
          code,
          date: new Date(date),
          status,
          contact,
          warehouse,
          user,
          details,
          items: {
            deleteMany: {},
            create: (items || []).map((item: any) => ({
              name: item.name,
              code: item.code,
              weight: String(item.weight),
              quantity: String(item.quantity),
            })),
          },
        },
      });

      if (status === "Completed" && warehouseId) {
        await addStock(tx, items, Number(warehouseId));
      }
    });

    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/checkins
export const getAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search = "",
      status = "All",
      page = "1",
      limit = "10",
    } = req.query as any;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const where: any = {};

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { contact: { contains: search } },
      ];
    }

    if (status === "Draft") where.status = "Draft";
    else if (status === "Non-Draft") where.status = { not: "Draft" };

    const [total, checkins] = await prisma.$transaction([
      prisma.checkin.count({ where }),
      prisma.checkin.findMany({
        where,
        include: { items: true },
        orderBy: { created_at: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    res.json({ total, page: pageNum, limit: limitNum, data: checkins });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/checkins/:id
export const getOne = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const checkin = await prisma.checkin.findUnique({
      where: { id: Number(req.params.id) },
      include: { items: true },
    });
    if (!checkin) {
      res.status(404).json({ error: "Орлого олдсонгүй" });
      return;
    }
    res.json(checkin);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/checkins/:id
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    await prisma.checkin.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
