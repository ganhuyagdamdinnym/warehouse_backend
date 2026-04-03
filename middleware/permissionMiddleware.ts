// import { Response, NextFunction } from "express";
// import { AuthRequest } from "./autoMiddleware";
// import prisma from "../config/prisma";

// type Action = "canView" | "canCreate" | "canEdit" | "canDelete";

// export const requirePermission = (module: string, action: Action) => {
//   return async (req: AuthRequest, res: Response, next: NextFunction) => {
//     const user = req.user;
//     if (!user) return res.status(401).json({ message: "Нэвтрээгүй байна" });

//     // SuperAdmin бол бүх эрхтэй
//     if (user.superAdmin) return next();

//     // Role байхгүй бол татгалзах
//     // if (!user.roleId)
//     //   return res.status(403).json({ message: "Танд эрх олгогдоогүй байна" });

//     // const perm = await prisma.rolePermission.findUnique({
//     //   where: { roleId_module: { roleId: user.roleId, module } },
//     // });

//     if (!perm || !perm[action])
//       return res
//         .status(403)
//         .json({ message: `${module} модулд ${action} эрх байхгүй` });

//     next();
//   };
// };
