import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
// import { prisma } from "../prisma/client";

import prisma from "../config/prisma";
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email болон нууц үг оруулна уу" });

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: { include: { permissions: true } } },
    });

    if (!user) return res.status(401).json({ message: "Email буруу байна" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Нууц үг буруу байна" });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    console.log("token", token);
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        superAdmin: user.superAdmin,
        warehouse: user.warehouse,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Серверийн алдаа гарлаа" });
  }
};

export const getMe = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: { include: { permissions: true } } },
    });
    res.json(user);
  } catch {
    res.status(500).json({ message: "Серверийн алдаа" });
  }
};
