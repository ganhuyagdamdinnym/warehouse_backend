import { Router } from "express";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
} from "../controllers/itemsController";

const itemRouter = Router();

itemRouter.get("/", getAll);
itemRouter.get("/:id", getOne);
itemRouter.post("/", create);
itemRouter.put("/:id", update);
itemRouter.delete("/:id", remove);

export default itemRouter;
