import prisma from "../config/prisma";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/autoMiddleware";

// ─── Сток хасах Helper ──────────────────────────────────────────────────
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

    const ws = await tx.warehouseStock.findUnique({
      where: { itemId_warehouseId: { itemId, warehouseId } },
    });

    if (!ws || ws.quantity < qty) {
      throw new Error(
        `Үлдэгдэл хүрэлцэхгүй: ${item.name || itemId} (Боломжит: ${ws?.quantity || 0})`,
      );
    }

    await tx.warehouseStock.update({
      where: { itemId_warehouseId: { itemId, warehouseId } },
      data: { quantity: { decrement: qty } },
    });

    const aggregate = await tx.warehouseStock.aggregate({
      where: { itemId },
      _sum: { quantity: true },
    });

    await tx.item.update({
      where: { id: itemId },
      data: { stock: aggregate._sum.quantity || 0 },
    });

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

// POST /api/checkouts
export const create = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
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
              itemId: i.itemId,
              name: i.name,
              code: i.code,
              quantity: String(i.quantity),
            })),
          },
        },
      });

      if (status === "Completed") {
        await deductStock(tx, items, Number(warehouseId), checkout.id, code);
      }

      return checkout;
    });

    res.status(201).json({ message: "Амжилттай үүслээ!", id: result.id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

// PUT /api/checkouts/:id
export const update = async (
  req: AuthRequest,
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

    const currentUser = req.user!;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.checkout.findUnique({ where: { id } });
      if (!existing) throw new Error("Зарлага олдсонгүй");

      // SuperAdmin биш бол зөвхөн өөрийн агуулахын checkout засах
      if (
        !currentUser.superAdmin &&
        existing.warehouse !== currentUser.warehouse
      ) {
        throw new Error("Та энэ зарлагыг засах эрхгүй байна");
      }

      if (existing.status === "Completed") {
        throw new Error("Батлагдсан зарлагыг засах боломжгүй.");
      }

      await tx.checkout.update({
        where: { id },
        data: {
          code,
          date: new Date(date),
          status,
          contact,
          warehouse,
          details,
          warehouseId: Number(warehouseId),
          items: {
            deleteMany: {},
            create: (items || []).map((i: any) => ({
              itemId: i.itemId,
              name: i.name,
              code: i.code,
              quantity: String(i.quantity),
            })),
          },
        },
      });

      if (status === "Completed") {
        await deductStock(tx, items, Number(warehouseId), id, code);
      }
    });

    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/checkouts
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
    } = req.query as any;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const currentUser = req.user!;

    const where: any = {};

    // ── Warehouse шүүлт ──────────────────────────────
    if (!currentUser.superAdmin) {
      where.warehouse = currentUser.warehouse;
    }

    // ── Хайлт ────────────────────────────────────────
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { contact: { contains: search } },
      ];
    }

    // ── Статус шүүлт ─────────────────────────────────
    if (status !== "All") where.status = status;

    const [total, data] = await prisma.$transaction([
      prisma.checkout.count({ where }),
      prisma.checkout.findMany({
        where,
        include: { items: true },
        orderBy: { created_at: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    res.json({ total, page: pageNum, limit: limitNum, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/checkouts/:id
export const getOne = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = req.user!;

    const checkout = await prisma.checkout.findUnique({
      where: { id: Number(req.params.id) },
      include: { items: true },
    });

    if (!checkout) {
      res.status(404).json({ error: "Зарлага олдсонгүй" });
      return;
    }

    // SuperAdmin биш бол зөвхөн өөрийн агуулахын checkout харах
    if (
      !currentUser.superAdmin &&
      checkout.warehouse !== currentUser.warehouse
    ) {
      res.status(403).json({ error: "Та энэ зарлагыг харах эрхгүй байна" });
      return;
    }

    res.json({ checkout });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/checkouts/:id
export const remove = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = req.user!;

    const checkout = await prisma.checkout.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (!checkout) {
      res.status(404).json({ error: "Зарлага олдсонгүй" });
      return;
    }

    // SuperAdmin биш бол зөвхөн өөрийн агуулахын checkout устгах
    if (
      !currentUser.superAdmin &&
      checkout.warehouse !== currentUser.warehouse
    ) {
      res.status(403).json({ error: "Та энэ зарлагыг устгах эрхгүй байна" });
      return;
    }

    await prisma.checkout.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
