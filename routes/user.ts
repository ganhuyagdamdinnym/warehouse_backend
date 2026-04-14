import { Router } from "express";

import {
  updatePassword,
  updateProfile,
} from "../controllers/profileController";
import {
  getAll,
  create,
  update,
  remove,
  getOne,
} from "../controllers/userController";
import { authMiddleware } from "../middleware/autoMiddleware";

const userRouter = Router();

userRouter.post("/updatePassword", authMiddleware, updatePassword);
userRouter.post("/updateProfile", authMiddleware, updateProfile);
userRouter.get("/", getAll);
userRouter.post("/", create);
userRouter.post("/:id", remove);
userRouter.put("/:id", update);
userRouter.get("/:id", getOne);

export default userRouter;
