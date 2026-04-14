import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    superAdmin: boolean;
    // permission: string;
    // roleId: number | null;
    warehouse: string; // ← нэмэх
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization?.split(" ")[1];
  // console.log("test.", token);
  if (!token) return res.status(401).json({ message: "Token байхгүй байна" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        superAdmin: true,
        permission: true,
        // roleId: true,
        warehouse: true, // ← нэмэх
      },
    });

    if (!user) return res.status(401).json({ message: "Хэрэглэгч олдсонгүй" });

    req.user = user;
    next();
  } catch {
    return res
      .status(401)
      .json({ message: "Token буруу эсвэл хугацаа дууссан" });
  }
};
