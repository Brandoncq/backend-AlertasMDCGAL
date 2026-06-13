import express from "express";

import {
  getSerenos,
  createSereno,
  updateSereno,
  deleteSereno,
} from "../controllers/serenos.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Proteger todas las rutas
process.env.NODE_ENV === "production" && router.use(authMiddleware);

// Obtener todos los serenos
router.get("/", getSerenos);

// Crear sereno
router.post("/", createSereno);

// Actualizar datos del sereno
router.put("/:id", updateSereno);

// Eliminación lógica (activo = false)
router.delete("/:id", deleteSereno);

export default router;
