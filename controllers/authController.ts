import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { transporter } from "../config/mailer";

import prisma from "../config/prisma";
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email болон нууц үг оруулна уу" });

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: { include: { permissions: true } } },
    });

    if (!user) return res.status(401).json({ message: "Email буруу байна" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Нууц үг буруу байна" });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    // console.log("token", token);
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        superAdmin: user.superAdmin,
        warehouse: user.warehouse,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Серверийн алдаа гарлаа" });
  }
};

export const getMe = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: { include: { permissions: true } } },
    });
    res.json(user);
  } catch {
    res.status(500).json({ message: "Серверийн алдаа" });
  }
};

// Түр хадгалах (production-д Redis ашиглах хэрэгтэй)
const resetTokens = new Map<string, { userId: number; expires: Date }>();

// POST /api/auth/forgot-password

// Store OTP codes (use Redis in production)
const otpStore = new Map<
  string,
  { otp: string; userId: number; expires: Date }
>();

// POST /api/auth/forgot-password
export const forgotPassword = async (req: Request, res: Response) => {
  console.log("hi");
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email оруулна уу" });

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.json({
        message: "Хэрэв email бүртгэлтэй бол OTP код илгээгдлээ",
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes

    otpStore.set(email, { otp, userId: user.id, expires });

    // Send email
    await transporter.sendMail({
      from: `"Your App" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Нууц үг сэргээх OTP код",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto;">
          <h2>Нууц үг сэргээх</h2>
          <p>Таны OTP код:</p>
          <h1 style="letter-spacing: 8px; color: #4F46E5;">${otp}</h1>
          <p>Энэ код <strong>10 минут</strong> хүчинтэй.</p>
          <p>Хэрэв та энэ хүсэлт гаргаагүй бол энэ имэйлийг үл тоомсорлоно уу.</p>
        </div>
      `,
    });

    return res.json({ message: "OTP код таны имэйл рүү илгээгдлээ" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Серверийн алдаа" });
  }
};

// POST /api/auth/verify-otp  ← New endpoint to verify OTP before reset
export const verifyOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  if (!email || !otp)
    return res.status(400).json({ message: "Email болон OTP код оруулна уу" });

  const record = otpStore.get(email);

  if (!record) return res.status(400).json({ message: "OTP код олдсонгүй" });
  if (record.expires < new Date()) {
    otpStore.delete(email);
    return res.status(400).json({ message: "OTP кодын хугацаа дууссан" });
  }
  if (record.otp !== otp)
    return res.status(400).json({ message: "OTP код буруу байна" });

  // Issue a short-lived reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  resetTokens.set(resetToken, {
    userId: record.userId,
    expires: new Date(Date.now() + 1000 * 60 * 15),
  });
  otpStore.delete(email);

  return res.json({ message: "OTP баталгаажлаа", resetToken });
};

// POST /api/auth/reset-password
export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.body;

  if (!token || !password)
    return res
      .status(400)
      .json({ message: "Token болон нууц үг заавал шаардлагатай" });

  if (password.length < 6)
    return res
      .status(400)
      .json({ message: "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой" });

  try {
    const record = resetTokens.get(token);

    if (!record) return res.status(400).json({ message: "Token буруу байна" });
    if (record.expires < new Date()) {
      resetTokens.delete(token);
      return res
        .status(400)
        .json({ message: "Token-ийн хугацаа дууссан байна" });
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: record.userId },
      data: { password: hashed },
    });

    resetTokens.delete(token);
    return res.json({ message: "Нууц үг амжилттай шинэчлэгдлээ" });
  } catch {
    return res.status(500).json({ message: "Серверийн алдаа" });
  }
};
