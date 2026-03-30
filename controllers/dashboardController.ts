import prisma from "../config/prisma";
import type { Request, Response } from "express";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

// GET /api/dashboard
export const getDashboard = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const thisMonthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const [
      // This month counts
      checkinsThisMonth,
      checkoutsThisMonth,
      transfersThisMonth,
      adjustmentsThisMonth,

      // Last month counts (for growth %)
      checkinsLastMonth,
      checkoutsLastMonth,
      transfersLastMonth,
      adjustmentsLastMonth,

      // All-time / current totals
      totalItems,
      totalContacts,
      totalWarehouses,
      totalUsers,
    ] = await prisma.$transaction([
      prisma.checkin.count({
        where: { created_at: { gte: thisMonthStart, lte: thisMonthEnd } },
      }),
      prisma.checkout.count({
        where: { created_at: { gte: thisMonthStart, lte: thisMonthEnd } },
      }),
      prisma.transfer.count({
        where: { created_at: { gte: thisMonthStart, lte: thisMonthEnd } },
      }),
      prisma.adjustment.count({
        where: { created_at: { gte: thisMonthStart, lte: thisMonthEnd } },
      }),

      prisma.checkin.count({
        where: { created_at: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      prisma.checkout.count({
        where: { created_at: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      prisma.transfer.count({
        where: { created_at: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      prisma.adjustment.count({
        where: { created_at: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),

      prisma.item.count(),
      prisma.contact.count(),
      prisma.warehouse.count({ where: { is_active: true } }),
      prisma.user.count(),
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
        sub: "Идэвхтэй",
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
        sub: "Нийт",
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
