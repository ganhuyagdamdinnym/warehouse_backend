import { Router } from "express";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
} from "../controllers/contactController";

const contactRouter = Router();

contactRouter.get("/", getAll);
contactRouter.get("/:id", getOne);
contactRouter.post("/", create);
contactRouter.put("/:id", update);
contactRouter.delete("/:id", remove);

export default contactRouter;
