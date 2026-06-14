import express from "express";
import {
  getSerenosDisponibles,
  getSerenosCercanos,
  cambiarEstadoSereno,
  actualizarUbicacion,
} from "../controllers/serenos.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Proteger todas las rutas
process.env.NODE_ENV === "production" && router.use(authMiddleware);

// Obtener serenos disponibles
router.get("/disponibles", getSerenosDisponibles);

// Obtener serenos cercanos a una ubicación
router.get("/cercanos", getSerenosCercanos);

// Cambiar estado operativo del sereno
router.patch("/estado", cambiarEstadoSereno);

// Actualizar ubicación (GPS) del sereno
router.post("/ubicacion", actualizarUbicacion);

export default router;
