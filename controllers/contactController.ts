import type { Request, Response } from "express";
import db from "../config/db";

interface ContactBody {
  name: string;
  email?: string;
  phone?: string;
  details?: string;
}

interface GetAllQuery {
  search?: string;
  page?: string;
  limit?: string;
}

// GET /api/contacts
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
      where += " AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [[{ total }]] = await db.query<any>(
      `SELECT COUNT(*) as total FROM contacts ${where}`,
      params,
    );

    const [contacts] = await db.query<any[]>(
      `SELECT * FROM contacts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset],
    );

    res.json({ total, page: pageNum, limit: limitNum, data: contacts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/contacts/:id
export const getOne = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const [rows] = await db.query<any[]>(
      "SELECT * FROM contacts WHERE id = ?",
      [id],
    );
    if (!rows || rows.length === 0) {
      res.status(404).json({ error: "Харилцагч олдсонгүй" });
      return;
    }
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/contacts
export const create = async (
  req: Request<{}, {}, ContactBody>,
  res: Response,
): Promise<void> => {
  try {
    const { name, email, phone, details } = req.body;
    if (!name) {
      res.status(400).json({ error: "Нэр заавал бөглөнө." });
      return;
    }
    const [result] = await db.query<any>(
      "INSERT INTO contacts (name, email, phone, details) VALUES (?,?,?,?)",
      [name, email || null, phone || null, details || null],
    );
    res
      .status(201)
      .json({ message: "Харилцагч амжилттай үүслээ!", id: result.insertId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/contacts/:id
export const update = async (
  req: Request<{ id: string }, {}, ContactBody>,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, email, phone, details } = req.body;
    await db.query(
      "UPDATE contacts SET name=?, email=?, phone=?, details=? WHERE id=?",
      [name, email || null, phone || null, details || null, id],
    );
    res.json({ message: "Амжилттай шинэчлэгдлээ!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/contacts/:id
export const remove = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM contacts WHERE id = ?", [id]);
    res.json({ message: "Амжилттай устгагдлаа!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
