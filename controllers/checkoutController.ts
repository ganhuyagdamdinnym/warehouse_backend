import type { Request, Response } from "express";
import db from "../config/db";

interface CheckoutItem {
  id?: number;
  name: string;
  code: string;
  weight: string;
  quantity: string;
}

interface CheckoutBody {
  code: string;
  date: string;
  status?: "Draft" | "Completed" | "Pending";
  contact: string;
  warehouse: string;
  user: string;
  details: string;
  items?: CheckoutItem[];
}

interface GetAllQuery {
  search?: string;
  status?: "All" | "Draft" | "Non-Draft";
  page?: string;
  limit?: string;
}

// GET /api/checkouts
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
      `SELECT COUNT(*) as total FROM checkouts c ${where}`,
      params,
    );

    const [checkouts] = await db.query<any[]>(
      `SELECT * FROM checkouts c ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset],
    );

    for (const checkout of checkouts) {
      const [items] = await db.query<any[]>(
        "SELECT * FROM checkout_items WHERE checkout_id = ?",
        [checkout.id],
      );
      checkout.items = items;
    }

    res.json({ total, page: pageNum, limit: limitNum, data: checkouts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/checkouts/:id
export const getOne = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const [rows] = await db.query<any[]>(
      "SELECT * FROM checkouts WHERE id = ?",
      [id],
    );
    if (!rows || rows.length === 0) {
      res.status(404).json({ error: "Зарлага олдсонгүй" });
      return;
    }
    const checkout = rows[0];
    const [items] = await db.query<any[]>(
      "SELECT * FROM checkout_items WHERE checkout_id = ?",
      [id],
    );
    checkout.items = items || [];
    res.json(checkout);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/checkouts
export const create = async (
  req: Request<{}, {}, CheckoutBody>,
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
      "INSERT INTO checkouts (code, date, status, contact, warehouse, user, details) VALUES (?,?,?,?,?,?,?)",
      [code, date, status, contact, warehouse, user, details],
    );

    const checkoutId: number = result.insertId;

    if (items && items.length > 0) {
      for (const item of items) {
        await db.query(
          "INSERT INTO checkout_items (checkout_id, name, code, weight, quantity) VALUES (?,?,?,?,?)",
          [checkoutId, item.name, item.code, item.weight, item.quantity],
        );
      }
    }

    res
      .status(201)
      .json({ message: "Зарлага амжилттай үүслээ!", id: checkoutId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/checkouts/:id
export const update = async (
  req: Request<{ id: string }, {}, CheckoutBody>,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { code, date, status, contact, warehouse, user, details, items } =
      req.body;

    await db.query(
      "UPDATE checkouts SET code=?, date=?, status=?, contact=?, warehouse=?, user=?, details=? WHERE id=?",
      [code, date, status, contact, warehouse, user, details, id],
    );

    if (items) {
      await db.query("DELETE FROM checkout_items WHERE checkout_id = ?", [id]);
      for (const item of items) {
        await db.query(
          "INSERT INTO checkout_items (checkout_id, name, code, weight, quantity) VALUES (?,?,?,?,?)",
          [id, item.name, item.code, item.weight, item.quantity],
        );
      }
    }

    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/checkouts/:id
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM checkout_items WHERE checkout_id = ?", [id]);
    await db.query("DELETE FROM checkouts WHERE id = ?", [id]);
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
