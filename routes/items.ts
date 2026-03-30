import { Router } from "express";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
  getItemTrail,
  getItemStockSummary,
} from "../controllers/itemsController";

const itemRouter = Router();

itemRouter.get("/", getAll);
itemRouter.get("/:id", getOne);
itemRouter.post("/", create);
itemRouter.put("/:id", update);
itemRouter.delete("/:id", remove);
itemRouter.get("/:id/trail", getItemTrail);
itemRouter.get("/:id/trail/summary", getItemStockSummary);

export default itemRouter;
