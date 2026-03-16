import type { Request, Response } from "express";
import db from "../config/db";

interface WarehouseBody {
  code: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active?: number;
}

interface GetAllQuery {
  search?: string;
  page?: string;
  limit?: string;
}

// GET /api/warehouses
export const getAll = async (
  req: Request<{}, {}, {}, GetAllQuery>,
  res: Response,
): Promise<void> => {
  try {
    const { search = "", page = "1", limit = "10" } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    let where = "WHERE 1=1";
    const params: (string | number)[] = [];

    if (search) {
      where += " AND (code LIKE ? OR name LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    const [[{ total }]] = await db.query<any>(
      `SELECT COUNT(*) as total FROM warehouses ${where}`,
      params,
    );

    const [warehouses] = await db.query<any[]>(
      `SELECT * FROM warehouses ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset],
    );

    res.json({ total, page: pageNum, limit: limitNum, data: warehouses });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/warehouses/:id
export const getOne = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const [rows] = await db.query<any[]>(
      "SELECT * FROM warehouses WHERE id = ?",
      [id],
    );
    if (!rows || rows.length === 0) {
      res.status(404).json({ error: "Агуулах олдсонгүй" });
      return;
    }
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/warehouses
export const create = async (
  req: Request<{}, {}, WarehouseBody>,
  res: Response,
): Promise<void> => {
  try {
    const { code, name, phone, email, address, is_active = 1 } = req.body;
    if (!code || !name) {
      res.status(400).json({ error: "Код болон нэр заавал бөглөнө." });
      return;
    }
    const [result] = await db.query<any>(
      "INSERT INTO warehouses (code, name, phone, email, address, is_active) VALUES (?,?,?,?,?,?)",
      [code, name, phone || null, email || null, address || null, is_active],
    );
    res
      .status(201)
      .json({ message: "Агуулах амжилттай үүслээ!", id: result.insertId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/warehouses/:id
export const update = async (
  req: Request<{ id: string }, {}, WarehouseBody>,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { code, name, phone, email, address, is_active } = req.body;
    await db.query(
      "UPDATE warehouses SET code=?, name=?, phone=?, email=?, address=?, is_active=? WHERE id=?",
      [
        code,
        name,
        phone || null,
        email || null,
        address || null,
        is_active ?? 1,
        id,
      ],
    );
    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/warehouses/:id
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM warehouses WHERE id = ?", [id]);
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
