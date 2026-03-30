import prisma from "../config/prisma";
import type { Request, Response } from "express";

// GET /api/dashboard/activity
export const getRecentActivity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const limit = Number(req.query.limit ?? 5);

    const [checkins, checkouts, adjustments] = await prisma.$transaction([
      prisma.checkin.findMany({
        take: limit,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          code: true,
          contact: true,
          warehouse: true,
          status: true,
          created_at: true,
        },
      }),
      prisma.checkout.findMany({
        take: limit,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          code: true,
          contact: true,
          warehouse: true,
          status: true,
          created_at: true,
        },
      }),
      prisma.adjustment.findMany({
        take: limit,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          code: true,
          contact: true,
          warehouse: true,
          status: true,
          created_at: true,
        },
      }),
    ]);

    type ActivityItem = {
      id: string;
      type: "checkin" | "checkout" | "adjustment";
      code: string;
      description: string;
      status: string;
      created_at: string;
    };

    const toUTC = (d: Date) => d.toISOString();

    const activity: ActivityItem[] = [
      ...checkins.map((r) => ({
        id: String(r.id),
        type: "checkin" as const,
        code: r.code ?? "—",
        description: `${r.contact ?? "—"} → ${r.warehouse ?? "—"}`,
        status: r.status,
        created_at: toUTC(r.created_at),
      })),
      ...checkouts.map((r) => ({
        id: String(r.id),
        type: "checkout" as const,
        code: r.code ?? "—",
        description: `${r.contact ?? "—"} ← ${r.warehouse ?? "—"}`,
        status: r.status,
        created_at: toUTC(r.created_at),
      })),
      ...adjustments.map((r) => ({
        id: String(r.id),
        type: "adjustment" as const,
        code: r.code ?? "—",
        description: `${r.warehouse ?? "—"}`,
        status: r.status,
        created_at: toUTC(r.created_at),
      })),
    ];

    activity.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const result = activity.slice(0, limit);

    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
