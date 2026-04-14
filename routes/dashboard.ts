import { Router } from "express";
import { getDashboard } from "../controllers/dashboardController";
import { authMiddleware } from "../middleware/autoMiddleware";
import { getRecentActivity } from "../controllers/activityController";

const dashboardRouter = Router();

dashboardRouter.get("/", authMiddleware, getDashboard);
dashboardRouter.get("/activity", authMiddleware, getRecentActivity);

export default dashboardRouter;
