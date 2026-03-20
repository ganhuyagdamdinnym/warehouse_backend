import type { Request, Response } from "express";
import prisma from "../config/prisma";

interface TransferItemBody {
  name?: string;
  code?: string;
  weight?: string;
  quantity?: string;
  unit?: string;
}

interface TransferBody {
  code: string;
  date: string;
  status?: "Draft" | "Completed" | "Pending";
  fromWarehouse: string;
  toWarehouse: string;
  user?: string;
  details?: string;
  items?: TransferItemBody[];
}

interface GetAllQuery {
  search?: string;
  status?: string;
  page?: string;
  limit?: string;
}

// GET /api/transfers
export const getAll = async (
  req: Request<{}, {}, {}, GetAllQuery>,
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

    const where: any = {};

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { fromWarehouse: { contains: search } },
        { toWarehouse: { contains: search } },
      ];
    }

    if (status === "Draft") where.status = "Draft";
    else if (status === "Non-Draft") where.status = { not: "Draft" };

    const [total, transfers] = await prisma.$transaction([
      prisma.transfer.count({ where }),
      prisma.transfer.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    res.json({ total, page: pageNum, limit: limitNum, data: transfers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/transfers/:id
export const getOne = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) {
      res.status(404).json({ error: "Шилжүүлэг олдсонгүй" });
      return;
    }
    res.json(transfer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/transfers
export const create = async (
  req: Request<{}, {}, TransferBody>,
  res: Response,
): Promise<void> => {
  try {
    const {
      code,
      date,
      status = "Draft",
      fromWarehouse,
      toWarehouse,
      user,
      details,
      items,
    } = req.body;

    if (!code || !date || !fromWarehouse || !toWarehouse) {
      res
        .status(400)
        .json({
          error: "Код, огноо, гарах болон орох агуулах заавал бөглөнө.",
        });
      return;
    }

    const transfer = await prisma.transfer.create({
      data: {
        code,
        date: new Date(date),
        status,
        fromWarehouse,
        toWarehouse,
        user: user || null,
        details: details || null,
        items: {
          create: (items || []).map((item) => ({
            name: item.name || null,
            code: item.code || null,
            weight: item.weight || null,
            quantity: item.quantity || null,
            unit: item.unit || null,
          })),
        },
      },
    });

    res
      .status(201)
      .json({ message: "Шилжүүлэг амжилттай үүслээ!", id: transfer.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/transfers/:id
export const update = async (
  req: Request<{ id: string }, {}, TransferBody>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const {
      code,
      date,
      status,
      fromWarehouse,
      toWarehouse,
      user,
      details,
      items,
    } = req.body;

    await prisma.transfer.update({
      where: { id },
      data: {
        code,
        date: new Date(date),
        status,
        fromWarehouse,
        toWarehouse,
        user: user || null,
        details: details || null,
        items: {
          deleteMany: {},
          create: (items || []).map((item) => ({
            name: item.name || null,
            code: item.code || null,
            weight: item.weight || null,
            quantity: item.quantity || null,
            unit: item.unit || null,
          })),
        },
      },
    });

    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/transfers/:id
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await prisma.transfer.delete({ where: { id } });
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
