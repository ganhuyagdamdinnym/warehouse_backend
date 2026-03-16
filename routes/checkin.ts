import { Router } from "express";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
} from "../controllers/checkinController";

const checkinRouter = Router();

checkinRouter.get("/", getAll);
checkinRouter.get("/:id", getOne);
checkinRouter.post("/", create);
checkinRouter.put("/:id", update);
checkinRouter.delete("/:id", remove);

export default checkinRouter;
