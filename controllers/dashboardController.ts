import prisma from "../config/prisma";
import { Request, Response } from "express";

export const getTotalStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const totalCheckin = await prisma.checkin.count();
    const totalCheckout = await prisma.checkout.count();
    const totalItem = await prisma.item.count();
    const totalWarehouse = await prisma.warehouse.count();
    const totalContact = await prisma.contact.count();
    const totalTransfer = await prisma.contact.count();
    const totalUser = await prisma.contact.count();

    res.status(200).json({
      totalCheckin,
      totalCheckout,
      totalItem,
      totalWarehouse,
      totalContact,
      totalTransfer,
      totalUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
