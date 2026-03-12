import type { Request, Response } from "express";
import db from "../config/db";

// Types
interface CheckinItem {
  id?: number;
  name: string;
  code: string;
  weight: string;
  quantity: string;
}

interface CheckinBody {
  code: string;
  date: string;
  status?: "Draft" | "Completed" | "Pending";
  contact: string;
  warehouse: string;
  user: string;
  details: string;
  items?: CheckinItem[];
}

interface GetAllQuery {
  search?: string;
  status?: "All" | "Draft" | "Non-Draft";
  page?: string;
  limit?: string;
}

// GET /api/checkins?search=&status=&page=1&limit=10
export const getAll = async (
  req: Request<{}, {}, {}, GetAllQuery>,
  res: Response,
): Promise<void> => {
  try {
    const { search = "", status = "All", page = "1", limit = "10" } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    let where = "WHERE 1=1";
    const params: (string | number)[] = [];

    if (search) {
      where += " AND (c.code LIKE ? OR c.contact LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status === "Draft") {
      where += ` AND c.status = 'Draft'`;
    } else if (status === "Non-Draft") {
      where += ` AND c.status != 'Draft'`;
    }

    const [[{ total }]] = await db.query<any>(
      `SELECT COUNT(*) as total FROM checkins c ${where}`,
      params,
    );

    const [checkins] = await db.query<any[]>(
      `SELECT * FROM checkins c ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset],
    );

    for (const checkin of checkins) {
      const [items] = await db.query<any[]>(
        "SELECT * FROM checkin_items WHERE checkin_id = ?",
        [checkin.id],
      );
      checkin.items = items;
    }

    res.json({ total, page: pageNum, limit: limitNum, data: checkins });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/checkins
export const create = async (
  req: Request<{}, {}, CheckinBody>,
  res: Response,
): Promise<void> => {
  try {
    const {
      code,
      date,
      status = "Draft",
      contact,
      warehouse,
      user,
      details,
      items,
    } = req.body;

    const [result] = await db.query<any>(
      "INSERT INTO checkins (code, date, status, contact, warehouse, user, details) VALUES (?,?,?,?,?,?,?)",
      [code, date, status, contact, warehouse, user, details],
    );

    const checkinId: number = result.insertId;

    if (items && items.length > 0) {
      for (const item of items) {
        await db.query(
          "INSERT INTO checkin_items (checkin_id, name, code, weight, quantity) VALUES (?,?,?,?,?)",
          [checkinId, item.name, item.code, item.weight, item.quantity],
        );
      }
    }

    res
      .status(201)
      .json({ message: "Орлого амжилттай үүслээ!", id: checkinId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/checkins/:id
export const update = async (
  req: Request<{ id: string }, {}, CheckinBody>,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { code, date, status, contact, warehouse, user, details, items } =
      req.body;

    await db.query(
      "UPDATE checkins SET code=?, date=?, status=?, contact=?, warehouse=?, user=?, details=? WHERE id=?",
      [code, date, status, contact, warehouse, user, details, id],
    );

    if (items) {
      await db.query("DELETE FROM checkin_items WHERE checkin_id = ?", [id]);
      for (const item of items) {
        await db.query(
          "INSERT INTO checkin_items (checkin_id, name, code, weight, quantity) VALUES (?,?,?,?,?)",
          [id, item.name, item.code, item.weight, item.quantity],
        );
      }
    }

    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/checkins/:id
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM checkins WHERE id = ?", [id]);
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
