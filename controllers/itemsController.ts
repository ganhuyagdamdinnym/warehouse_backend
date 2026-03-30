import type { Request, Response } from "express";
import prisma from "../config/prisma";

interface WarehouseAllocation {
  warehouseId: number;
  quantity: number;
}

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
  stock?: number;
  warehouseAllocations?: WarehouseAllocation[];
}

interface GetAllQuery {
  search?: string;
  category?: string;
  page?: string;
  limit?: string;
}

// GET /api/items/:id/trail
export const getItemTrail = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const itemId = Number(req.params.id);
    const { page = "1", limit = "10", warehouseId } = req.query as any;

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const where: any = { itemId };

    // Агуулахаар шүүх (заавал биш)
    if (warehouseId) {
      where.OR = [
        { warehouseFrom: String(warehouseId) },
        { warehouseTo: String(warehouseId) },
      ];
    }

    const [total, movements] = await prisma.$transaction([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          item: {
            select: { id: true, name: true, internalCode: true },
          },
        },
      }),
    ]);

    // Frontend-д ойлгомжтой формат руу хөрвүүлэх
    const data = movements.map((m) => ({
      id: m.id,
      createdAt: m.createdAt,
      type: m.type, // CHECKIN | CHECKOUT | TRANSFER_IN | TRANSFER_OUT | ADJUSTMENT
      quantity: m.quantity, // эерэг = нэмэгдсэн, сөрөг = хасагдсан
      warehouseFrom: m.warehouseFrom,
      warehouseTo: m.warehouseTo,
      referenceCode: m.referenceCode,
      note: m.note,
      item: m.item,
    }));

    res.json({ total, page: pageNum, limit: limitNum, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/items/:id/trail/summary — агуулах тус бүрийн одоогийн үлдэгдэл
export const getItemStockSummary = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const itemId = Number(req.params.id);

    const warehouseStocks = await prisma.warehouseStock.findMany({
      where: { itemId },
      include: {
        warehouse: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { warehouse: { name: "asc" } },
    });

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { id: true, name: true, stock: true, internalCode: true },
    });

    if (!item) {
      res.status(404).json({ error: "Бараа олдсонгүй" });
      return;
    }

    res.json({
      item,
      totalStock: item.stock,
      warehouseStocks: warehouseStocks.map((ws) => ({
        warehouseId: ws.warehouseId,
        warehouseName: ws.warehouse.name,
        warehouseCode: ws.warehouse.code,
        quantity: ws.quantity,
        updatedAt: ws.updatedAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
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
    if (category) where.category = category;

    const [total, items] = await prisma.$transaction([
      prisma.item.count({ where }),
      prisma.item.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          warehouseStocks: {
            include: {
              warehouse: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
    ]);

    const data = items.map((item) => ({
      ...item,
      warehouseStocks: item.warehouseStocks.map((ws) => ({
        id: String(ws.id),
        name: ws.warehouse.name,
        code: ws.warehouse.code,
        totalQuantity: String(ws.quantity),
        variantStocks: [
          { label: ws.warehouse.name, quantity: `${ws.quantity} ш` },
        ],
      })),
    }));

    res.json({ total, page: pageNum, limit: limitNum, data });
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
    const item = await prisma.item.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        warehouseStocks: {
          include: {
            warehouse: { select: { id: true, name: true, code: true } },
          },
        },
        stockMovements: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!item) {
      res.status(404).json({ error: "Бараа олдсонгүй" });
      return;
    }

    const warehouseStocks = item.warehouseStocks.map((ws) => ({
      id: String(ws.id),
      name: ws.warehouse.name,
      code: ws.warehouse.code,
      totalQuantity: String(ws.quantity),
      variantStocks: [
        { label: ws.warehouse.name, quantity: `${ws.quantity} ш` },
      ],
    }));

    res.json({ ...item, warehouseStocks });
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
      stock,
      warehouseAllocations = [],
    } = req.body;

    if (!name) {
      res.status(400).json({ error: "Барааны нэр заавал бөглөнө." });
      return;
    }

    // Calculate total from allocations (or use explicit stock if no allocations)
    const totalFromAllocations = warehouseAllocations.reduce(
      (s, a) => s + (a.quantity || 0),
      0,
    );
    const finalStock =
      warehouseAllocations.length > 0 ? totalFromAllocations : (stock ?? 0);

    const item = await prisma.$transaction(async (tx) => {
      // 1. Create the item
      const created = await tx.item.create({
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
          stock: finalStock,
        },
      });

      // 2. Seed WarehouseStock for each allocation
      for (const alloc of warehouseAllocations) {
        if (!alloc.warehouseId || alloc.quantity <= 0) continue;

        await tx.warehouseStock.upsert({
          where: {
            itemId_warehouseId: {
              itemId: created.id,
              warehouseId: alloc.warehouseId,
            },
          },
          update: { quantity: { increment: alloc.quantity } },
          create: {
            itemId: created.id,
            warehouseId: alloc.warehouseId,
            quantity: alloc.quantity,
          },
        });

        // 3. Record as CHECKIN movement for audit trail
        const wh = await tx.warehouse.findUnique({
          where: { id: alloc.warehouseId },
          select: { name: true },
        });

        await tx.stockMovement.create({
          data: {
            itemId: created.id,
            type: "CHECKIN",
            quantity: alloc.quantity,
            warehouseTo: wh?.name ?? null,
            referenceCode: `INIT-${created.id}`,
            note: "Анхны үлдэгдэл",
          },
        });
      }

      return created;
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
      stock,
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
        stock: stock ?? 0,
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
    await prisma.item.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
