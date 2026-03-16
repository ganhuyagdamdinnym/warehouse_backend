import { Router } from "express";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
} from "../controllers/checkoutController";

const checkoutRouter = Router();

checkoutRouter.get("/", getAll);
checkoutRouter.get("/:id", getOne);
checkoutRouter.post("/", create);
checkoutRouter.put("/:id", update);
checkoutRouter.delete("/:id", remove);

export default checkoutRouter;
