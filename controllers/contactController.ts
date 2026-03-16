import type { Request, Response } from "express";
import prisma from "../config/prisma";

interface ContactBody {
  name: string;
  email?: string;
  phone?: string;
  details?: string;
}

interface GetAllQuery {
  search?: string;
  page?: string;
  limit?: string;
}

// GET /api/contacts
export const getAll = async (
  req: Request<{}, {}, {}, GetAllQuery>,
  res: Response,
): Promise<void> => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query as any;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [total, contacts] = await prisma.$transaction([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    res.json({ total, page: pageNum, limit: limitNum, data: contacts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/contacts/:id
export const getOne = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const contact = await prisma.contact.findUnique({
      where: { id },
    });
    if (!contact) {
      res.status(404).json({ error: "Харилцагч олдсонгүй" });
      return;
    }
    res.json(contact);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/contacts
export const create = async (
  req: Request<{}, {}, ContactBody>,
  res: Response,
): Promise<void> => {
  try {
    const { name, email, phone, details } = req.body;
    if (!name) {
      res.status(400).json({ error: "Нэр заавал бөглөнө." });
      return;
    }
    const contact = await prisma.contact.create({
      data: { name, email, phone, details },
    });
    res
      .status(201)
      .json({ message: "Харилцагч амжилттай үүслээ!", id: contact.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/contacts/:id
export const update = async (
  req: Request<{ id: string }, {}, ContactBody>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { name, email, phone, details } = req.body;
    await prisma.contact.update({
      where: { id },
      data: { name, email, phone, details },
    });
    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/contacts/:id
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await prisma.contact.delete({
      where: { id },
    });
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
