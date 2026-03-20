import { getTotalStats } from "../controllers/dashboardController";
import { Router } from "express";

const dashboardRouter = Router();

dashboardRouter.get("/", getTotalStats);

export default dashboardRouter;
