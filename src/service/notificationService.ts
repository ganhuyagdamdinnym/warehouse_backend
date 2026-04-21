// services/notificationService.ts
import prisma from "../../config/prisma";

// Тодорхой агуулахын бүх хэрэглэгч + superAdmin-д notification илгээнэ
export const notifyWarehouseUsers = async (
  warehouseName: string,
  title: string,
  message: string,
  type: "info" | "warning" | "success" = "info",
) => {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ warehouse: warehouseName }, { superAdmin: true }],
    },
    select: { id: true },
  });

  if (users.length === 0) return;

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      title,
      message,
      type,
    })),
  });
};

// Сток доод хязгаараас бага болсон бараануудыг шалгаж notification үүсгэнэ
export const checkStockAlerts = async (
  tx: any,
  itemId: number,
  warehouseId: number,
) => {
  const stock = await tx.warehouseStock.findUnique({
    where: { itemId_warehouseId: { itemId, warehouseId } },
    include: {
      item: { select: { name: true, stockAlert: true, internalCode: true } },
      warehouse: { select: { name: true } },
    },
  });

  if (!stock || stock.item.stockAlert == null) return;
  if (stock.quantity > stock.item.stockAlert) return;

  const title = "Барааны үлдэгдэл хязгаараас доош орлоо";
  const message = `"${stock.item.name}" барааны үлдэгдэл ${stock.quantity} болж, доод хязгаар (${stock.item.stockAlert})-аас бага боллоо. Агуулах: ${stock.warehouse.name}`;

  await notifyWarehouseUsers(stock.warehouse.name, title, message, "warning");
};
