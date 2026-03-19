import type { Request, Response } from "express";
import prisma from "../config/prisma";

interface ItemBody {
  name: string;
  internalCode?: string;
  barcode?: string;
  barcodeType?: string;
  sku?: string;
  category?: string;
  unit?: string;
  location?: string;
  description?: string;
  image?: string;
  trackStock?: boolean;
  stockAlert?: number;
}

interface GetAllQuery {
  search?: string;
  category?: string;
  page?: string;
  limit?: string;
}

// GET /api/items
export const getAll = async (
  req: Request<{}, {}, {}, GetAllQuery>,
  res: Response,
): Promise<void> => {
  try {
    const {
      search = "",
      category = "",
      page = "1",
      limit = "10",
    } = req.query as any;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { internalCode: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const [total, items] = await prisma.$transaction([
      prisma.item.count({ where }),
      prisma.item.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    res.json({ total, page: pageNum, limit: limitNum, data: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/items/:id
export const getOne = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) {
      res.status(404).json({ error: "Бараа олдсонгүй" });
      return;
    }
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/items
export const create = async (
  req: Request<{}, {}, ItemBody>,
  res: Response,
): Promise<void> => {
  try {
    const {
      name,
      internalCode,
      barcode,
      barcodeType,
      sku,
      category,
      unit,
      location,
      description,
      image,
      trackStock,
      stockAlert,
    } = req.body;

    if (!name) {
      res.status(400).json({ error: "Барааны нэр заавал бөглөнө." });
      return;
    }

    const item = await prisma.item.create({
      data: {
        name,
        internalCode: internalCode || null,
        barcode: barcode || null,
        barcodeType: barcodeType || null,
        sku: sku || null,
        category: category || null,
        unit: unit || null,
        location: location || null,
        description: description || null,
        image: image || null,
        trackStock: trackStock ?? false,
        stockAlert: stockAlert ?? null,
      },
    });

    res.status(201).json({ message: "Бараа амжилттай үүслээ!", id: item.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/items/:id
export const update = async (
  req: Request<{ id: string }, {}, ItemBody>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const {
      name,
      internalCode,
      barcode,
      barcodeType,
      sku,
      category,
      unit,
      location,
      description,
      image,
      trackStock,
      stockAlert,
    } = req.body;

    await prisma.item.update({
      where: { id },
      data: {
        name,
        internalCode: internalCode || null,
        barcode: barcode || null,
        barcodeType: barcodeType || null,
        sku: sku || null,
        category: category || null,
        unit: unit || null,
        location: location || null,
        description: description || null,
        image: image || null,
        trackStock: trackStock ?? false,
        stockAlert: stockAlert ?? null,
      },
    });

    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/items/:id
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await prisma.item.delete({ where: { id } });
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
