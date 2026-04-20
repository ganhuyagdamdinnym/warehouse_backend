import type { Request, Response } from "express";
import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/autoMiddleware";

interface WarehouseBody {
  code: string;
  name: string;
  logoImage: string | null;
  phone?: string;
  email?: string;
  address?: string;
  is_active?: boolean;
}

// GET /api/warehouses
export const getAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { name: { contains: search } },
      ];
    }

    const [total, warehouses] = await prisma.$transaction([
      prisma.warehouse.count({ where }),
      prisma.warehouse.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    res.json({ total, page: pageNum, limit: limitNum, data: warehouses });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/warehouses/:id
export const getOne = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!warehouse) {
      res.status(404).json({ error: "Агуулах олдсонгүй" });
      return;
    }
    res.status(200).json({ warehouse });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/warehouses
export const create = async (
  req: Request<{}, {}, WarehouseBody>,
  res: Response,
): Promise<void> => {
  try {
    const { code, name, phone, email, address, is_active, logoImage } =
      req.body;
    if (!code || !name) {
      res.status(400).json({ error: "Код болон нэр заавал бөглөнө." });
      return;
    }

    const warehouse = await prisma.warehouse.create({
      data: { name, code, email, phone, is_active, address, logo: logoImage },
    });
    res
      .status(201)
      .json({ message: "Агуулах амжилттай үүслээ!", id: warehouse });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/warehouses/:id
export const update = async (
  req: Request<{ id: string }, {}, WarehouseBody>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "ID буруу байна" });
      return;
    }
    const { code, name, phone, email, address, is_active, logoImage } =
      req.body;
    await prisma.warehouse.update({
      where: { id },
      data: {
        code,
        name,
        phone,
        email,
        address,
        is_active,
        logo: logoImage ?? undefined,
      },
    });
    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/warehouses/:id
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    await prisma.warehouse.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/warehouses/:id/items
export const getWarehouseItems = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const warehouseId = Number(req.params.id);
    const { search = "", page = "1", limit = "10" } = req.query as any;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const where: any = { warehouseId, quantity: { gt: 0 } };
    if (search) {
      where.item = {
        OR: [
          { name: { contains: search } },
          { internalCode: { contains: search } },
          { sku: { contains: search } },
        ],
      };
    }

    const [total, stocks] = await prisma.$transaction([
      prisma.warehouseStock.count({ where }),
      prisma.warehouseStock.findMany({
        where,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { updatedAt: "desc" },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              internalCode: true,
              sku: true,
              category: true,
              unit: true,
              stockAlert: true,
              image: true,
            },
          },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      }),
    ]);

    const data = stocks.map((s) => ({
      id: s.id,
      quantity: s.quantity,
      updatedAt: s.updatedAt,
      item: s.item,
      warehouse: s.warehouse,
      isLowStock: s.item.stockAlert != null && s.quantity <= s.item.stockAlert,
    }));

    res.json({ total, page: pageNum, limit: limitNum, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Branding endpoints ───────────────────────────────────────────────────────

// GET /api/warehouses/my — өөрийн агуулахын мэдээлэл (энгийн хэрэглэгч)
export const getMyWarehouse = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const warehouse = await prisma.warehouse.findFirst({
      where: { name: req.user!.warehouse },
      select: {
        id: true,
        name: true,
        code: true,
        logo: true,
        address: true,
        phone: true,
        email: true,
      },
    });

    if (!warehouse) {
      res.status(404).json({ message: "Агуулах олдсонгүй" });
      return;
    }
    res.json(warehouse);
  } catch (err: any) {
    res.status(500).json({ message: "Серверийн алдаа" });
  }
};

// PUT /api/warehouses/branding — өөрийн агуулахын нэр/лого өөрчлөх (энгийн хэрэглэгч)
export const updateBranding = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = req.user!;
    const { name, logo } = req.body;

    const warehouse = await prisma.warehouse.findFirst({
      where: { name: currentUser.warehouse },
    });

    if (!warehouse) {
      res.status(404).json({ message: "Агуулах олдсонгүй" });
      return;
    }

    const data: any = {};
    if (name && name.trim()) data.name = name.trim();
    if (logo !== undefined) data.logo = logo; // null бол устгана

    const updated = await prisma.warehouse.update({
      where: { id: warehouse.id },
      data,
      select: { id: true, name: true, code: true, logo: true },
    });

    // Агуулахын нэр өөрчлөгдвөл тухайн агуулахтай бүх хэрэглэгчийг шинэчилнэ
    if (name && name.trim() && name.trim() !== currentUser.warehouse) {
      await prisma.user.updateMany({
        where: { warehouse: currentUser.warehouse },
        data: { warehouse: name.trim() },
      });
    }

    res.json({
      message: "Агуулахын мэдээлэл шинэчлэгдлээ",
      warehouse: updated,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Серверийн алдаа" });
  }
};

// PUT /api/warehouses/:id/branding — SuperAdmin тодорхой агуулахын лого/нэр өөрчлөх
export const updateBrandingById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = req.user!;

    if (!currentUser.superAdmin) {
      res
        .status(403)
        .json({ message: "Зөвхөн SuperAdmin энэ үйлдлийг хийх боломжтой" });
      return;
    }

    const id = Number(req.params.id);
    const { name, logo } = req.body;

    const warehouse = await prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      res.status(404).json({ message: "Агуулах олдсонгүй" });
      return;
    }

    const data: any = {};
    if (name && name.trim()) data.name = name.trim();
    if (logo !== undefined) data.logo = logo;

    const updated = await prisma.warehouse.update({
      where: { id },
      data,
      select: { id: true, name: true, code: true, logo: true },
    });

    // Нэр өөрчлөгдвөл хуучин нэртэй хэрэглэгчдийг шинэчилнэ
    if (name && name.trim() && name.trim() !== warehouse.name) {
      await prisma.user.updateMany({
        where: { warehouse: warehouse.name },
        data: { warehouse: name.trim() },
      });
    }

    res.json({
      message: "Агуулахын мэдээлэл шинэчлэгдлээ",
      warehouse: updated,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Серверийн алдаа" });
  }
};
