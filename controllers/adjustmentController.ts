import prisma from "../config/prisma";
import type { Request, Response } from "express";

// GET /api/adjustments
export const getAll = async (req: Request, res: Response): Promise<void> => {
  console.log("test");
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

    const [total, adjustments] = await prisma.$transaction([
      prisma.adjustment.count({ where }),
      prisma.adjustment.findMany({
        where,
        include: { items: true },
        orderBy: { created_at: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    res.json({ total, page: pageNum, limit: limitNum, data: adjustments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/adjustments/:id
export const getOne = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const adjustment = await prisma.adjustment.findUnique({
      where: { id: Number(req.params.id) },
      include: { items: true },
    });
    if (!adjustment) {
      res.status(404).json({ error: "Өөрчлөлт олдсонгүй" });
      return;
    }
    res.json(adjustment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/adjustments
export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, date, status, contact, warehouse, details, items } = req.body;

    const adjustment = await prisma.adjustment.create({
      data: {
        code,
        date: new Date(date),
        status: status || "Draft",
        contact,
        warehouse,
        details,
        items: {
          create: items || [],
        },
      },
    });

    res
      .status(201)
      .json({ message: "Өөрчлөлт амжилттай үүслээ!", id: adjustment.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/adjustments/:id
export const update = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { code, date, status, contact, warehouse, details, items } = req.body;

    await prisma.adjustment.update({
      where: { id },
      data: {
        code,
        date: new Date(date),
        status,
        contact,
        warehouse,
        details,
        items: {
          deleteMany: {},
          create: items || [],
        },
      },
    });

    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/adjustments/:id
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    await prisma.adjustment.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
