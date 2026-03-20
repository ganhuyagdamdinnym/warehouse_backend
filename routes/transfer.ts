import { Router } from "express";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
} from "../controllers/transferController";

const transferRouter = Router();

transferRouter.get("/", getAll);
transferRouter.get("/:id", getOne);
transferRouter.post("/", create);
transferRouter.put("/:id", update);
transferRouter.delete("/:id", remove);

export default transferRouter;
