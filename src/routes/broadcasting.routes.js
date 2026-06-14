import express from "express";
import { authenticateSocket } from "../controllers/broadcasting.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/auth", authMiddleware, authenticateSocket);

export default router;
