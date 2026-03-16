import { Router } from "express";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
} from "../controllers/warehouseController";

const warehouseRouter = Router();

warehouseRouter.get("/", getAll);
warehouseRouter.get("/:id", getOne);
warehouseRouter.post("/", create);
warehouseRouter.put("/:id", update);
warehouseRouter.delete("/:id", remove);

export default warehouseRouter;
