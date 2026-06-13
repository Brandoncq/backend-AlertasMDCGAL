import express from "express";

import {
  getCitizens,
  createCitizen,
  updateCitizen,
  deleteCitizen,
} from "../controllers/citizens.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Proteger todas las rutas
process.env.NODE_ENV === "production" && router.use(authMiddleware);

// Obtener todos los ciudadanos
router.get("/", getCitizens);

// Crear ciudadano
router.post("/", createCitizen);

// Actualizar datos del ciudadano
router.put("/:id", updateCitizen);

// Eliminación lógica (activo = false)
router.delete("/:id", deleteCitizen);

export default router;
