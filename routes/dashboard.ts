import { Router } from "express";
import { getDashboard } from "../controllers/dashboardController";
import { getRecentActivity } from "../controllers/activityController";

const dashboardRouter = Router();

dashboardRouter.get("/", getDashboard);
dashboardRouter.get("/activity", getRecentActivity);

export default dashboardRouter;
