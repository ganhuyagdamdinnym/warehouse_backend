import { Router } from "express";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
} from "../controllers/unitController";

const unitRouter = Router();

unitRouter.get("/", getAll);
unitRouter.get("/:id", getOne);
unitRouter.post("/", create);
unitRouter.put("/:id", update);
unitRouter.delete("/:id", remove);

export default unitRouter;
