import type { Request, Response } from "express";
import prisma from "../config/prisma";

export const getAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search = "",
      role = "All", // "All" | "SuperAdmin" | "User"
      page = "1",
      limit = "10",
    } = req.query as any;
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

    // SuperAdmin эсвэл User шүүлтүүр
    if (role === "SuperAdmin") where.superAdmin = true;
    else if (role === "User") where.superAdmin = false;

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          userName: true,
          email: true,
          phone: true,
          warehouse: true,
          permission: true,
          superAdmin: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    res.json({ total, page: pageNum, limit: limitNum, data: users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

//create
export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      userName,
      password,
      email,
      phone,
      warehouse,
      superAdmin,
      permission,
    } = req.body;

    if (!name || !userName || !password || !warehouse) {
      res
        .status(400)
        .json({
          message: "Нэр, хэрэглэгчийн нэр, нууц үг, агуулах заавал бөглөнө.",
        });
      return;
    }

    const user = await prisma.user.create({
      data: {
        name,
        userName,
        password,
        email: email || null,
        phone: phone || null,
        warehouse,
        superAdmin: superAdmin ?? false,
        permission: permission ?? "nothing",
      },
    });

    res
      .status(201)
      .json({ message: "Хэрэглэгч амжилттай үүслээ!", id: user.id });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
