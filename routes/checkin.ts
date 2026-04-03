import { Router } from "express";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
} from "../controllers/checkinController";
import { authMiddleware } from "../middleware/autoMiddleware"; // ← нэмэх

const checkinRouter = Router();

checkinRouter.get("/", authMiddleware, getAll); // ← нэмэх
checkinRouter.get("/:id", authMiddleware, getOne); // ← нэмэх
checkinRouter.post("/", authMiddleware, create); // ← нэмэх
checkinRouter.put("/:id", authMiddleware, update); // ← нэмэх
checkinRouter.delete("/:id", authMiddleware, remove); // ← нэмэх

export default checkinRouter;
