import prisma from "../config/prisma";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/autoMiddleware";

// ─── Сток нэмэх Helper ──────────────────────────────────────────────────
const addStock = async (
  tx: any,
  items: { productId: number; quantity: number | string; name: string }[],
  warehouseId: number,
) => {
  for (const item of items) {
    const qty = Number(item.quantity);
    if (isNaN(qty) || qty <= 0) continue;

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

    await tx.item.update({
      where: { id: Number(item.productId) },
      data: { stock: { increment: qty } },
    });

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
    console.log("create", req.body);
    const result = await prisma.$transaction(async (tx) => {
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
              itemId: item.itemId,
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
      user,
      details,
      items,
    } = req.body;

    const currentUser = req.user!;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.checkin.findUnique({ where: { id } });
      if (!existing) throw new Error("Орлого олдсонгүй");

      // SuperAdmin биш бол зөвхөн өөрийн агуулахын checkin-г засах боломжтой
      if (
        !currentUser.superAdmin &&
        existing.warehouse !== currentUser.warehouse
      ) {
        throw new Error("Та энэ орлогыг засах эрхгүй байна");
      }

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
              itemId: item.itemId,
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
    // console.log("hi al l", req.user);
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const currentUser = req.user!;

    const where: any = {};
    if (!req.user) {
      console.log("АЛДАА: req.user олдсонгүй!");
      res.status(401).json({ error: "Хэрэглэгч нэвтрээгүй байна" });
      return;
    }
    // console.log("checck", currentUser.superAdmin);
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
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = req.user!;

    const checkin = await prisma.checkin.findUnique({
      where: { id: Number(req.params.id) },
      include: { items: true },
    });

    if (!checkin) {
      res.status(404).json({ error: "Орлого олдсонгүй" });
      return;
    }

    // SuperAdmin биш бол зөвхөн өөрийн агуулахын checkin-г харах боломжтой
    if (
      !currentUser.superAdmin &&
      checkin.warehouse !== currentUser.warehouse
    ) {
      res.status(403).json({ error: "Та энэ орлогыг харах эрхгүй байна" });
      return;
    }

    res.json(checkin);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/checkins/:id
export const remove = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = req.user!;

    const checkin = await prisma.checkin.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (!checkin) {
      res.status(404).json({ error: "Орлого олдсонгүй" });
      return;
    }

    // SuperAdmin биш бол зөвхөн өөрийн агуулахын checkin-г устгах боломжтой
    if (
      !currentUser.superAdmin &&
      checkin.warehouse !== currentUser.warehouse
    ) {
      res.status(403).json({ error: "Та энэ орлогыг устгах эрхгүй байна" });
      return;
    }

    await prisma.checkin.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
