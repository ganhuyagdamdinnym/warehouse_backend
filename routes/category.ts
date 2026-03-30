import { Router } from "express";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
} from "../controllers/categoryController";

const categoryRouter = Router();

categoryRouter.get("/", getAll);
categoryRouter.get("/:id", getOne);
categoryRouter.post("/", create);
categoryRouter.put("/:id", update);
categoryRouter.delete("/:id", remove);

export default categoryRouter;
