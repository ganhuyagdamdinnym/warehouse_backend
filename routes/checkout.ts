import { Router } from "express";
import { authMiddleware } from "../middleware/autoMiddleware";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
} from "../controllers/checkoutController";

const checkoutRouter = Router();

checkoutRouter.get("/", authMiddleware, getAll);
checkoutRouter.get("/:id", authMiddleware, getOne);
checkoutRouter.post("/", authMiddleware, create);
checkoutRouter.put("/:id", authMiddleware, update);
checkoutRouter.delete("/:id", authMiddleware, remove);

export default checkoutRouter;
