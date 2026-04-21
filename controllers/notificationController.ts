import prisma from "../config/prisma";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/autoMiddleware";

// GET /api/notifications
export const getAll = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { page = "1", limit = "20", unreadOnly } = req.query as any;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const where: any = { userId };
    if (unreadOnly === "true") where.isRead = false;

    const [total, notifications, unreadCount] = await prisma.$transaction([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    res.json({
      total,
      unreadCount,
      page: pageNum,
      limit: limitNum,
      data: notifications,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/notifications/:id/read — нэгийг уншсан гэж тэмдэглэх
export const markAsRead = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.id;
    await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
    res.json({ message: "Уншсан гэж тэмдэглэгдлээ" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/notifications/read-all — бүгдийг уншсан гэж тэмдэглэх
export const markAllAsRead = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: "Бүгд уншсан гэж тэмдэглэгдлээ" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/notifications/:id
export const remove = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.id;
    await prisma.notification.deleteMany({ where: { id, userId } });
    res.json({ message: "Устгагдлаа" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/notifications — бүгдийг устгах
export const removeAll = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    await prisma.notification.deleteMany({ where: { userId } });
    res.json({ message: "Бүгд устгагдлаа" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
