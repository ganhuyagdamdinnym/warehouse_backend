import prisma from "../config/prisma";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/autoMiddleware";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

export const getDashboard = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Нэвтрээгүй байна" });
      return;
    }

    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const currentUser = req.user;
    const isSuperAdmin = currentUser.superAdmin;

    // ── Warehouse шүүлт ──────────────────────────────
    const warehouseFilter = isSuperAdmin
      ? {}
      : { warehouse: currentUser.warehouse };

    const warehouseTransferFilter = isSuperAdmin
      ? {}
      : (() => {
          // Transfer-т warehouse нэрийг ID болгох хэрэгтэй
          return {}; // Доор тусад нь шийднэ
        })();

    // Энгийн хэрэглэгчийн warehouse ID олох
    let userWarehouseId: number | null = null;
    if (!isSuperAdmin) {
      const wh = await prisma.warehouse.findFirst({
        where: { name: currentUser.warehouse },
        select: { id: true },
      });
      userWarehouseId = wh?.id ?? null;
    }

    const transferFilter =
      isSuperAdmin || !userWarehouseId
        ? {}
        : {
            OR: [
              { fromWarehouseId: userWarehouseId },
              { toWarehouseId: userWarehouseId },
            ],
          };

    const [
      checkinsThisMonth,
      checkoutsThisMonth,
      transfersThisMonth,
      adjustmentsThisMonth,
      checkinsLastMonth,
      checkoutsLastMonth,
      transfersLastMonth,
      adjustmentsLastMonth,
      totalItems,
      totalContacts,
      totalWarehouses,
      totalUsers,
    ] = await prisma.$transaction([
      // Энэ сар
      prisma.checkin.count({
        where: {
          ...warehouseFilter,
          created_at: { gte: thisMonthStart, lte: thisMonthEnd },
        },
      }),
      prisma.checkout.count({
        where: {
          ...warehouseFilter,
          created_at: { gte: thisMonthStart, lte: thisMonthEnd },
        },
      }),
      prisma.transfer.count({
        where: {
          ...transferFilter,
          created_at: { gte: thisMonthStart, lte: thisMonthEnd },
        },
      }),
      prisma.adjustment.count({
        where: {
          ...warehouseFilter,
          created_at: { gte: thisMonthStart, lte: thisMonthEnd },
        },
      }),

      // Өнгөрсөн сар
      prisma.checkin.count({
        where: {
          ...warehouseFilter,
          created_at: { gte: lastMonthStart, lte: lastMonthEnd },
        },
      }),
      prisma.checkout.count({
        where: {
          ...warehouseFilter,
          created_at: { gte: lastMonthStart, lte: lastMonthEnd },
        },
      }),
      prisma.transfer.count({
        where: {
          ...transferFilter,
          created_at: { gte: lastMonthStart, lte: lastMonthEnd },
        },
      }),
      prisma.adjustment.count({
        where: {
          ...warehouseFilter,
          created_at: { gte: lastMonthStart, lte: lastMonthEnd },
        },
      }),

      // Нийт тоо — superAdmin биш бол зөвхөн өөрийнх
      prisma.item.count(),
      prisma.contact.count(),
      isSuperAdmin
        ? prisma.warehouse.count({ where: { is_active: true } })
        : prisma.warehouse.count({
            where: { is_active: true, name: currentUser.warehouse },
          }),
      isSuperAdmin
        ? prisma.user.count()
        : prisma.user.count({ where: { warehouse: currentUser.warehouse } }),
    ]);

    const calcGrowth = (current: number, previous: number): string => {
      if (previous === 0) return current > 0 ? "+100%" : "0%";
      const pct = ((current - previous) / previous) * 100;
      return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
    };

    res.json({
      checkins: {
        value: checkinsThisMonth,
        growth: calcGrowth(checkinsThisMonth, checkinsLastMonth),
        up: checkinsThisMonth >= checkinsLastMonth,
        sub: "Энэ сар",
      },
      checkouts: {
        value: checkoutsThisMonth,
        growth: calcGrowth(checkoutsThisMonth, checkoutsLastMonth),
        up: checkoutsThisMonth >= checkoutsLastMonth,
        sub: "Энэ сар",
      },
      items: {
        value: totalItems,
        growth: "0%",
        up: true,
        sub: "Нийт төрөл",
      },
      contacts: {
        value: totalContacts,
        growth: "0%",
        up: true,
        sub: "Нийт бүртгэл",
      },
      warehouses: {
        value: totalWarehouses,
        growth: "0%",
        up: true,
        sub: isSuperAdmin ? "Идэвхтэй" : "Өөрийн агуулах",
      },
      transfers: {
        value: transfersThisMonth,
        growth: calcGrowth(transfersThisMonth, transfersLastMonth),
        up: transfersThisMonth >= transfersLastMonth,
        sub: "Энэ сар",
      },
      adjustments: {
        value: adjustmentsThisMonth,
        growth: calcGrowth(adjustmentsThisMonth, adjustmentsLastMonth),
        up: adjustmentsThisMonth >= adjustmentsLastMonth,
        sub: "Энэ сар",
      },
      users: {
        value: totalUsers,
        growth: "0%",
        up: true,
        sub: isSuperAdmin ? "Нийт" : "Өөрийн агуулах",
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
