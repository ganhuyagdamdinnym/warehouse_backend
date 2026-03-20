import type { Request, Response } from "express";
import prisma from "../config/prisma";

interface UnitBody {
  name: string;
  code: string;
  parentId?: number;
}

interface GetAllQuery {
  search?: string;
  page?: string;
  limit?: string;
}

// GET /api/units
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
        { code: { contains: search } },
      ];
    }

    const [total, units] = await prisma.$transaction([
      prisma.unit.count({ where }),
      prisma.unit.findMany({
        where,
        include: { parent: true },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    res.json({ total, page: pageNum, limit: limitNum, data: units });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/units/:id
export const getOne = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: { parent: true },
    });
    if (!unit) {
      res.status(404).json({ error: "Нэгж олдсонгүй" });
      return;
    }
    res.json(unit);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/units
export const create = async (
  req: Request<{}, {}, UnitBody>,
  res: Response,
): Promise<void> => {
  try {
    const { name, code, parentId } = req.body;
    if (!name || !code) {
      res.status(400).json({ error: "Нэгжийн нэр болон код заавал бөглөнө." });
      return;
    }
    const unit = await prisma.unit.create({
      data: {
        name,
        code,
        parentId: parentId || null,
      },
    });
    res.status(201).json({ message: "Нэгж амжилттай үүслээ!", id: unit.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/units/:id
export const update = async (
  req: Request<{ id: string }, {}, UnitBody>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { name, code, parentId } = req.body;
    await prisma.unit.update({
      where: { id },
      data: { name, code, parentId: parentId || null },
    });
    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/units/:id
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await prisma.unit.delete({ where: { id } });
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
