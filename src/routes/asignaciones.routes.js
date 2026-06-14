import express from "express";
import { crearAsignacion, responderAsignacion } from "../controllers/asignaciones.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Proteger todas las rutas
process.env.NODE_ENV === "production" && router.use(authMiddleware);

// Crear una asignación
router.post("/", crearAsignacion);

// Responder a una asignación
router.post("/:id/responder", responderAsignacion);

export default router;
