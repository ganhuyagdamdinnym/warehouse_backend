import type { Request, Response } from "express";
import prisma from "../config/prisma";

// GET /api/checkouts
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

export const getOne = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  try {
    const checkout = await prisma.checkout.findUnique({
      where: { id: Number(id) },
      include: { items: true },
    });
    if (!checkout) {
      res.status(404).json({ error: "checkout not found" });
      return;
    }

    res.status(200).json({ checkout });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/checkouts
export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code,
      date,
      status = "Draft",
      contact,
      warehouse,
      user,
      details,
      items,
    } = req.body;

    const checkout = await prisma.checkout.create({
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

    res.status(201).json({ message: "created successfully", id: checkout.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/checkouts/:id
export const update = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { code, date, status, contact, warehouse, user, details, items } =
      req.body;

    await prisma.checkout.update({
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

// DELETE /api/checkouts/:id
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    await prisma.checkout.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
