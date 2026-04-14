import prisma from "../config/prisma";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/autoMiddleware";

// ─── Сток нэмэх Helper ──────────────────────────────────────────────────
const addStock = async (
  tx: any,
  items: {
    itemId?: number;
    productId?: number;
    quantity: number | string | null;
    name?: string | null;
  }[],
  warehouseId: number,
) => {
  for (const item of items) {
    // itemId эсвэл productId аль нэгийг ашиглана
    const resolvedItemId = Number(item.itemId || item.productId);
    const qty = Number(item.quantity);

    if (!resolvedItemId || isNaN(qty) || qty <= 0) {
      console.warn("addStock: itemId олдсонгүй эсвэл тоо буруу", item);
      continue;
    }

    console.log(
      `addStock: itemId=${resolvedItemId}, qty=${qty}, warehouseId=${warehouseId}`,
    );

    await tx.warehouseStock.upsert({
      where: {
        itemId_warehouseId: {
          itemId: resolvedItemId,
          warehouseId: Number(warehouseId),
        },
      },
      update: { quantity: { increment: qty } },
      create: {
        itemId: resolvedItemId,
        warehouseId: Number(warehouseId),
        quantity: qty,
      },
    });

    // Item-ийн нийт сток бүх агуулахаас нийлбэрлэн шинэчлэх
    const aggregate = await tx.warehouseStock.aggregate({
      where: { itemId: resolvedItemId },
      _sum: { quantity: true },
    });

    await tx.item.update({
      where: { id: resolvedItemId },
      data: { stock: aggregate._sum.quantity || 0 },
    });

    await tx.stockMovement.create({
      data: {
        itemId: resolvedItemId,
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
    const currentUser = req.user!;

    console.log("checkin create body:", JSON.stringify(req.body, null, 2));

    if (!currentUser.superAdmin && warehouse !== currentUser.warehouse) {
      res.status(403).json({
        error: "Та зөвхөн өөрийн агуулахад орлого үүсгэх боломжтой",
      });
      return;
    }

    const checkinStatus: "Draft" | "Completed" =
      status === "Completed" ? "Completed" : "Draft";

    const result = await prisma.$transaction(async (tx) => {
      const checkin = await tx.checkin.create({
        data: {
          code,
          date: new Date(date),
          status: checkinStatus,
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
        include: { items: true }, // ← DB-д хадгалагдсан items-ийг буцааж авна
      });

      if (checkinStatus === "Completed" && warehouseId) {
        console.log("Completing checkin, warehouseId:", warehouseId);
        // req.body items биш checkin.items ашиглана — itemId баталгаатай байна
        await addStock(tx, checkin.items, Number(warehouseId));
      }

      return checkin;
    });

    res.status(201).json({ message: "Амжилттай үүслээ!", id: result.id });
  } catch (err: any) {
    console.error("checkin create error:", err);
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

    console.log("checkin update body:", JSON.stringify(req.body, null, 2));

    const currentUser = req.user!;
    const checkinStatus: "Draft" | "Completed" =
      status === "Completed" ? "Completed" : "Draft";

    await prisma.$transaction(async (tx) => {
      const existing = await tx.checkin.findUnique({ where: { id } });
      if (!existing) throw new Error("Орлого олдсонгүй");

      if (
        !currentUser.superAdmin &&
        existing.warehouse !== currentUser.warehouse
      ) {
        throw new Error("Та энэ орлогыг засах эрхгүй байна");
      }

      if (existing.status === "Completed") {
        throw new Error("Батлагдсан орлогыг засах боломжгүй.");
      }

      const updated = await tx.checkin.update({
        where: { id },
        data: {
          code,
          date: new Date(date),
          status: checkinStatus,
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
        include: { items: true }, // ← DB-д хадгалагдсан items-ийг буцааж авна
      });

      if (checkinStatus === "Completed" && warehouseId) {
        console.log("Completing checkin update, warehouseId:", warehouseId);
        // updated.items ашиглана — itemId баталгаатай байна
        await addStock(tx, updated.items, Number(warehouseId));
      }
    });

    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    console.error("checkin update error:", err);
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

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const currentUser = req.user!;

    if (!req.user) {
      res.status(401).json({ error: "Хэрэглэгч нэвтрээгүй байна" });
      return;
    }

    const where: any = {};

    if (!currentUser.superAdmin) {
      where.warehouse = currentUser.warehouse;
    }

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { contact: { contains: search } },
      ];
    }

    if (status === "Draft") where.status = "Draft";
    else if (status === "Completed") where.status = "Completed";

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
