import { auth } from "./auth.config";
import type { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  user?: any;
  session?: any;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v));
      } else if (value) {
        headers.set(key, value);
      }
    });

    let session = await auth.api.getSession({
      headers,
    });

    if (!session) {
      res.status(401).json({ error: "Unauthorized: Active session required" });
      return;
    }

    // Attach session data
    (req as AuthenticatedRequest).user = session.user;
    (req as AuthenticatedRequest).session = session.session;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Internal Server Error during authentication" });
  }
}
