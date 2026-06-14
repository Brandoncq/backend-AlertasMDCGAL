import express from "express";
import {
  getHistorial,
  getDetalleCaso,
} from "../controllers/historial.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Proteger todas las rutas
router.use(authMiddleware);

// Obtener listado de historial
router.get("/", getHistorial);

// Obtener detalle de un caso específico
router.get("/:id/caso", getDetalleCaso);

export default router;
