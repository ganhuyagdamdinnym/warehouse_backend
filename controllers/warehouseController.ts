import type { Request, Response } from "express";
import db from "../config/db";
import prisma from "../config/prisma";

interface WarehouseBody {
  code: string;
  name: string;
  logoImage: string | null;
  phone?: string;
  email?: string;
  address?: string;
  is_active?: boolean;
}

interface GetAllQuery {
  search?: string;
  page?: string;
  limit?: string;
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
    const id = Number(req.params.id);
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      res.status(404).json({ error: "Агуулах олдсонгүй" });
      return;
    }

    res.status(201).json({ warehouse });
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
      data: { name, code, email, phone, is_active, address, logoImage },
    });
    // const [result] = await db.query<any>(
    //   "INSERT INTO warehouses (code, name, phone, email, address, is_active) VALUES (?,?,?,?,?,?)",
    //   [code, name, phone || null, email || null, address || null, is_active],
    // );
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
    const { code, name, phone, email, address, is_active } = req.body;

    await prisma.warehouse.update({
      where: { id },
      data: {
        code,
        name,
        phone,
        email,
        address,
        is_active,
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
    const id = Number(req.params.id);
    await prisma.warehouse.delete({
      where: { id: id },
    });

    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/warehouses/:id/items — тухайн агуулахын бараанууд
export const getWarehouseItems = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const warehouseId = Number(req.params.id);
    const { search = "", page = "1", limit = "10" } = req.query as any;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const where: any = {
      warehouseId,
      quantity: { gt: 0 },
    };

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
          warehouse: {
            select: { id: true, name: true, code: true },
          },
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
