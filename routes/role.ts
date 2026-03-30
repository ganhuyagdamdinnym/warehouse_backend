import { Router } from "express";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
} from "../controllers/roleController";

const roleRouter = Router();

roleRouter.get("/", getAll);
roleRouter.get("/:id", getOne);
roleRouter.post("/", create);
roleRouter.put("/:id", update);
roleRouter.delete("/:id", remove);

export default roleRouter;
