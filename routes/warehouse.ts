import { Router } from "express";
import {
  getAll,
  getOne,
  create,
  update,
  remove,
  getWarehouseItems,
  getMyWarehouse,
  updateBranding,
  updateBrandingById,
} from "../controllers/warehouseController";
import { authMiddleware } from "../middleware/autoMiddleware";

const warehouseRouter = Router();

// ✅ 1. Static routes ЭХЭЛЖ — /:id-аас өмнө
warehouseRouter.get("/my", authMiddleware, getMyWarehouse);
warehouseRouter.put("/branding", authMiddleware, updateBranding);

// ✅ 2. Root routes
warehouseRouter.get("/", getAll);
warehouseRouter.post("/", authMiddleware, create);

// ✅ 3. Dynamic :id routes СҮҮЛД
warehouseRouter.get("/:id/items", getWarehouseItems);
warehouseRouter.put("/:id/branding", authMiddleware, updateBrandingById);
warehouseRouter.get("/:id", getOne);
warehouseRouter.put("/:id", authMiddleware, update);
warehouseRouter.delete("/:id", authMiddleware, remove);

export default warehouseRouter;
