import { Router } from "express";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
} from "../controllers/adjustmentController";

const adjustmentRouter = Router();

adjustmentRouter.get("/", getAll);
adjustmentRouter.get("/:id", getOne);
adjustmentRouter.post("/", create);
adjustmentRouter.put("/:id", update);
adjustmentRouter.delete("/:id", remove);

export default adjustmentRouter;
