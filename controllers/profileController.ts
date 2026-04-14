import type { Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../config/prisma";
import type { AuthRequest } from "../middleware/autoMiddleware";

// PUT /api/profile
export const updateProfile = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { name, email, image } = req.body;
    const userId = req.user!.id;

    if (!name && !email && !image) {
      res.status(400).json({ message: "Өөрчлөх мэдээлэл оруулна уу" });
      return;
    }

    // Имэйл давхардах эсэхийг шалгах
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: userId } },
      });
      if (existing) {
        res
          .status(400)
          .json({ message: "Энэ имэйл аль хэдийн бүртгэлтэй байна" });
        return;
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(image !== undefined && { image }), // null байвал зураг устгана
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        superAdmin: true,
        warehouse: true,
        role: { include: { permissions: true } },
      },
    });

    res.json({ message: "Мэдээлэл амжилттай шинэчлэгдлээ", user: updated });
  } catch (err: any) {
    res.status(500).json({ message: "Серверийн алдаа" });
  }
};

// PUT /api/profile/password
export const updatePassword = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Мэдээллээ бүрэн бөглөнө үү" });
      return;
    }

    if (newPassword.length < 6) {
      res
        .status(400)
        .json({ message: "Шинэ нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      res.status(400).json({ message: "Одоогийн нууц үг буруу байна" });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    res.json({ message: "Нууц үг амжилттай шинэчлэгдлээ" });
  } catch (err: any) {
    res.status(500).json({ message: "Серверийн алдаа" });
  }
};
