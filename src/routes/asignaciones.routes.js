import express from "express";
import { crearAsignacion } from "../controllers/asignaciones.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Proteger todas las rutas
process.env.NODE_ENV === "production" && router.use(authMiddleware);

// Crear una asignación
router.post("/", crearAsignacion);

export default router;
