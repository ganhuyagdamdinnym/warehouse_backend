import { Router } from "express";

import {
  getAll,
  create,
  update,
  remove,
  getOne,
} from "../controllers/userController";

const userRouter = Router();

userRouter.get("/", getAll);
userRouter.post("/", create);
userRouter.post("/:id", remove);
userRouter.put("/:id", update);
userRouter.get("/:id", getOne);
export default userRouter;
