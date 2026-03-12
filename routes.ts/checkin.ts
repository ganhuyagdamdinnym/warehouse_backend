import { Router } from "express";
import {
  getAll,
  create,
  update,
  remove,
} from "../controllers/checkinController";

const checkinRouter = Router();

checkinRouter.get("/", getAll);
checkinRouter.post("/", create);
checkinRouter.put("/:id", update);
checkinRouter.delete("/:id", remove);

export default checkinRouter;
