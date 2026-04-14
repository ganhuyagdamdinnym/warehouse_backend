import { Router } from "express";
import {
  login,
  getMe,
  forgotPassword,
  resetPassword,
  verifyOtp,
} from "../controllers/authController";
import { authMiddleware } from "../middleware/autoMiddleware";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.get("/me", authMiddleware, getMe);
authRouter.post("/forgot-password", forgotPassword); // ← нэмэх
authRouter.post("/verify-otp", verifyOtp);
authRouter.post("/reset-password", resetPassword); // ← н

export default authRouter;
