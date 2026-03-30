import prisma from "../config/prisma";
import type { Request, Response } from "express";

// GET /api/roles
export const getAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query as any;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const where: any = search ? { name: { contains: search } } : {};

    const [total, roles] = await prisma.$transaction([
      prisma.role.count({ where }),
      prisma.role.findMany({
        where,
        include: { permissions: true },
        orderBy: { created_at: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    res.json({ total, page: pageNum, limit: limitNum, data: roles });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/roles/:id
export const getOne = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const role = await prisma.role.findUnique({
      where: { id: Number(req.params.id) },
      include: { permissions: true },
    });
    if (!role) {
      res.status(404).json({ error: "Эрх олдсонгүй" });
      return;
    }
    res.json(role);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/roles
// Body: { name: string, permissions: { module: string, canView, canCreate, canEdit, canDelete }[] }
export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, permissions = [] } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: "Эрхийн нэр оруулна уу." });
      return;
    }

    const role = await prisma.role.create({
      data: {
        name: name.trim(),
        permissions: {
          create: permissions.map((p: any) => ({
            module: p.module,
            canView: p.canView ?? false,
            canCreate: p.canCreate ?? false,
            canEdit: p.canEdit ?? false,
            canDelete: p.canDelete ?? false,
          })),
        },
      },
      include: { permissions: true },
    });

    res.status(201).json({ message: "Эрх амжилттай үүслээ!", id: role.id });
  } catch (err: any) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Ийм нэртэй эрх аль хэдийн байна." });
      return;
    }
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/roles/:id
export const update = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { name, permissions = [] } = req.body;

    await prisma.role.update({
      where: { id },
      data: {
        name: name?.trim(),
        permissions: {
          // Replace all permissions
          deleteMany: {},
          create: permissions.map((p: any) => ({
            module: p.module,
            canView: p.canView ?? false,
            canCreate: p.canCreate ?? false,
            canEdit: p.canEdit ?? false,
            canDelete: p.canDelete ?? false,
          })),
        },
      },
    });

    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Ийм нэртэй эрх аль хэдийн байна." });
      return;
    }
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/roles/:id
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    await prisma.role.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
