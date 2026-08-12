import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type Role = "PATIENT" | "DOCTOR" | "PHARMACIST" | "ADMIN";

export interface UserPayload {
  userId: string;
  email: string;
  role: Role;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Access denied: Token missing" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback-secret",
    ) as UserPayload;
    req.user = decoded;
    next();
  } catch (err) {
    return res
      .status(403)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

export const requireRoles = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "User unauthenticated" });
    }

    if (!allowedRoles.includes(req.user.role) && req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Requires one of the following roles: [${allowedRoles.join(", ")}]`,
      });
    }

    next();
  };
};
