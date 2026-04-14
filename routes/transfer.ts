import { Router } from "express";
import { authMiddleware } from "../middleware/autoMiddleware";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
} from "../controllers/transferController";

const transferRouter = Router();

transferRouter.get("/", authMiddleware, getAll);
transferRouter.get("/:id", authMiddleware, getOne);
transferRouter.post("/", authMiddleware, create);
transferRouter.put("/:id", authMiddleware, update);
transferRouter.delete("/:id", authMiddleware, remove);

export default transferRouter;
