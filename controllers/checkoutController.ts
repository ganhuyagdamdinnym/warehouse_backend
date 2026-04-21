import prisma from "../config/prisma";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/autoMiddleware";

// ─── Сток хасах Helper ──────────────────────────────────────────────────
const removeStock = async (
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
    const resolvedItemId = Number(item.itemId || item.productId);
    const qty = Number(item.quantity);

    if (!resolvedItemId || isNaN(qty) || qty <= 0) {
      console.warn("removeStock: itemId олдсонгүй эсвэл тоо буруу", item);
      continue;
    }

    // Үлдэгдэл хүрэлцэх эсэхийг шалгана
    const stock = await tx.warehouseStock.findUnique({
      where: {
        itemId_warehouseId: {
          itemId: resolvedItemId,
          warehouseId: Number(warehouseId),
        },
      },
    });

    if (!stock || stock.quantity < qty) {
      throw new Error(
        `Барааны үлдэгдэл хүрэлцэхгүй байна. (Барааны ID: ${resolvedItemId})`,
      );
    }

    await tx.warehouseStock.update({
      where: {
        itemId_warehouseId: {
          itemId: resolvedItemId,
          warehouseId: Number(warehouseId),
        },
      },
      data: { quantity: { decrement: qty } },
    });

    // Нийт сток шинэчлэх
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
        type: "CHECKOUT",
        quantity: -qty, // сөрөг — хасагдсан
        warehouseFrom: String(warehouseId),
        note: `Зарлагаар хасагдлаа. Агуулах ID: ${warehouseId}`,
      },
    });
  }
};

// POST /api/checkouts
// export const create = async (
//   req: AuthRequest,
//   res: Response,
// ): Promise<void> => {
//   console.log("hi");
// try {
//   const {
//     code,
//     date,
//     status,
//     contact,
//     warehouse,
//     warehouseId,
//     user,
//     details,
//     items,
//   } = req.body;
//   const currentUser = req.user!;
//   console.log("hi");
//   console.log("checkout create body:", JSON.stringify(req.body, null, 2));
//   if (!currentUser.superAdmin && warehouse !== currentUser.warehouse) {
//     res.status(403).json({
//       error: "Та зөвхөн өөрийн агуулахаас зарлага үүсгэх боломжтой",
//     });
//     return;
//   }
//   const checkinStatus: "Draft" | "Completed" =
//     status === "Completed" ? "Completed" : "Draft";
//   const result = await prisma.$transaction(async (tx) => {
//     const checkout = await tx.checkout.create({
//       data: {
//         code,
//         date: new Date(date),
//         status: checkinStatus,
//         contact,
//         warehouse,
//         warehouseId: Number(warehouseId),
//         user,
//         details,
//         items: {
//           create: (items || []).map((item: any) => ({
//             itemId: item.itemId,
//             name: item.name,
//             code: item.code,
//             quantity: String(item.quantity),
//           })),
//         },
//       },
//       include: { items: true },
//     });
//     if (checkinStatus === "Completed" && warehouseId) {
//       console.log(
//         "Completing checkout, removing stock for warehouseId:",
//         warehouseId,
//       );
//       await removeStock(tx, checkout.items, Number(warehouseId));
//     }
//     return checkout;
//   });
//   res
//     .status(201)
//     .json({ message: "Зарлага амжилттай үүслээ!", id: result.id });
// } catch (err: any) {
//   console.error("checkout create error:", err);
//   res.status(400).json({ error: err.message });
//}
// };

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
      user,
      details,
      items,
    } = req.body;
    const currentUser = req.user!;

    console.log("update");
    const checkinStatus: "Draft" | "Completed" =
      status === "Completed" ? "Completed" : "Draft";

    await prisma.$transaction(async (tx) => {
      const existing = await tx.checkout.findUnique({ where: { id } });
      if (!existing) throw new Error("Зарлага олдсонгүй");

      if (
        !currentUser.superAdmin &&
        existing.warehouse !== currentUser.warehouse
      ) {
        throw new Error("Та энэ зарлагыг засах эрхгүй байна");
      }

      if (existing.status === "Completed") {
        throw new Error("Батлагдсан зарлагыг засах боломжгүй.");
      }

      const updated = await tx.checkout.update({
        where: { id },
        data: {
          code,
          date: new Date(date),
          status: checkinStatus,
          contact,
          warehouse,
          warehouseId: Number(warehouseId),
          user,
          details,
          items: {
            deleteMany: {},
            create: (items || []).map((item: any) => ({
              itemId: item.itemId,
              name: item.name,
              code: item.code,
              quantity: String(item.quantity),
            })),
          },
        },
        include: { items: true },
      });

      if (checkinStatus === "Completed" && warehouseId) {
        await removeStock(tx, updated.items, Number(warehouseId));
      }
    });

    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    console.error("checkout update error:", err);
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

    const [total, checkouts] = await prisma.$transaction([
      prisma.checkout.count({ where }),
      prisma.checkout.findMany({
        where,
        include: { items: true },
        orderBy: { created_at: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    res.json({ total, page: pageNum, limit: limitNum, data: checkouts });
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

    if (
      !currentUser.superAdmin &&
      checkout.warehouse !== currentUser.warehouse
    ) {
      res.status(403).json({ error: "Та энэ зарлагыг харах эрхгүй байна" });
      return;
    }

    res.json(checkout);
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

// DELETE /api/checkouts/:id
