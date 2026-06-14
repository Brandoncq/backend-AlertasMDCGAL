import express from "express";
import {
  getAlertasActivas,
  getDetalleAlerta,
  rechazarAlerta,
  crearAlerta,
  getAlertaActiva,
  calificarAlerta,
  actualizarEstadoAlerta,
} from "../controllers/alertas.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Proteger todas las rutas
router.use(authMiddleware);

// Crear alerta (Ciudadano)
router.post("/", crearAlerta);

// Obtener alerta activa actual del ciudadano
router.get("/activa", getAlertaActiva);

// Obtener alertas activas (Operador)
router.get("/activas", getAlertasActivas);

// Obtener detalle de una alerta (Operador)
router.get("/:id/detalle-operador", getDetalleAlerta);

// Rechazar una alerta (Operador)
router.post("/:id/rechazar", rechazarAlerta);

// Calificar alerta (Ciudadano)
router.post("/:id/calificar", calificarAlerta);

// Actualizar estado de alerta (Sereno)
router.patch("/:id/estado", actualizarEstadoAlerta);

export default router;
