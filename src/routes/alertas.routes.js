import express from "express";
import {
  getAlertasActivas,
  getDetalleAlerta,
  rechazarAlerta,
} from "../controllers/alertas.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Proteger todas las rutas
process.env.NODE_ENV === "production" && router.use(authMiddleware);

// Obtener alertas activas
router.get("/activas", getAlertasActivas);

// Obtener detalle de una alerta
router.get("/:id/detalle-operador", getDetalleAlerta);

// Rechazar una alerta
router.post("/:id/rechazar", rechazarAlerta);

export default router;
