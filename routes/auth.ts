import { Router } from "express";
import { login, getMe } from "../controllers/authController";
import { authMiddleware } from "../middleware/autoMiddleware";

const authRouter = Router();

authRouter.post("/login", login);
authRouter.get("/me", authMiddleware, getMe);

export default authRouter;
