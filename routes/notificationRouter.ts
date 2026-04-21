import { Router } from "express";
import { authMiddleware } from "../middleware/autoMiddleware";
import {
  getAll,
  markAsRead,
  markAllAsRead,
  remove,
  removeAll,
} from "../controllers/notificationController";

const notificationRouter = Router();

notificationRouter.get("/", authMiddleware, getAll); // GET  /api/notifications
notificationRouter.put("/read-all", authMiddleware, markAllAsRead); // PUT  /api/notifications/read-all  ← өмнө байх!
notificationRouter.put("/:id/read", authMiddleware, markAsRead); // PUT  /api/notifications/:id/read
notificationRouter.delete("/", authMiddleware, removeAll); // DELETE /api/notifications
notificationRouter.delete("/:id", authMiddleware, remove); // DELETE /api/notifications/:id

export default notificationRouter;
