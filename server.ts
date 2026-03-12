import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import db from "./config/db";
import checkinRouter from "./routes.ts/checkin";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/checkins", checkinRouter);

// DB холболт шалгах
db.getConnection()
  .then(() => console.log("✅ MySQL холбогдлоо!"))
  .catch((err: any) => console.error("❌ DB алдаа:", err.message));

app.listen(PORT, () => {
  console.log(`🚀 Server ажиллаж байна: http://localhost:${PORT}`);
});
