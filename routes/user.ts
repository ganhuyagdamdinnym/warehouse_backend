import { Router } from "express";

import { getAll, create } from "../controllers/userController";

const userRouter = Router();

userRouter.get("/", getAll);
userRouter.post("/", create);

export default userRouter;
