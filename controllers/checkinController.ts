import prisma from "../config/prisma";
import type { Request, Response } from "express";

// GET /api/checkins
export const getAll = async (req: Request, res: Response): Promise<void> => {
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
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const checkin = await prisma.checkin.findUnique({
      where: { id: Number(req.params.id) },
      include: { items: true },
    });
    if (!checkin) {
      res.status(404).json({ error: "Орлого олдсонгүй" });
      return;
    }
    res.json(checkin);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/checkins
export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, date, status, contact, warehouse, user, details, items } =
      req.body;

    const checkin = await prisma.checkin.create({
      data: {
        code,
        date: new Date(date),
        status: status || "Draft",
        contact,
        warehouse,
        user,
        details,
        items: {
          create: items || [],
        },
      },
    });

    res
      .status(201)
      .json({ message: "Орлого амжилттай үүслээ!", id: checkin.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/checkins/:id
export const update = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { code, date, status, contact, warehouse, user, details, items } =
      req.body;

    await prisma.checkin.update({
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
          create: items || [],
        },
      },
    });

    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/checkins/:id
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    await prisma.checkin.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
