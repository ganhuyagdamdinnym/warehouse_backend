import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import db from "./config/db";

import checkinRouter from "./routes/checkin";
import checkoutRouter from "./routes/checkout";
import contactRouter from "./routes/contact";
import warehouseRouter from "./routes/warehouse";
import userRouter from "./routes/user";
import itemRouter from "./routes/items";
import transferRouter from "./routes/transfer";
import unitRouter from "./routes/unit";
import dashboardRouter from "./routes/dashboard";
import adjustmentRouter from "./routes/adjustment";
import categoryRouter from "./routes/category";
import roleRouter from "./routes/role";
import authRouter from "./routes/auth";
import notificationRouter from "./routes/notificationRouter";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/checkins", checkinRouter);
app.use("/api/checkouts", checkoutRouter);
app.use("/api/contacts", contactRouter);
app.use("/api/warehouses", warehouseRouter);
app.use("/api/users", userRouter);
app.use("/api/transfers", transferRouter);
app.use("/api/items", itemRouter);
app.use("/api/units", unitRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/adjustments", adjustmentRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/roles", roleRouter);
app.use("/api/auth", authRouter);
app.use("/api/notification", notificationRouter);
// DB холболт шалгах
db.getConnection()
  .then(() => console.log("✅ MySQL холбогдлоо!"))
  .catch((err: any) => console.error("❌ DB алдаа:", err.message));

app.listen(PORT, () => {
  console.log(`🚀 Server ажиллаж байна: http://localhost:${PORT}`);
});
