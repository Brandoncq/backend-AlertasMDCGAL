import express from "express";
import {
  getAdminUsuarios,
  createAdminUsuario,
  updateAdminUsuario,
} from "../controllers/admin.usuarios.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Proteger todas las rutas
router.use(authMiddleware);

// Obtener todos los usuarios (admin)
router.get("/", getAdminUsuarios);

// Crear usuario (admin)
router.post("/", createAdminUsuario);

// Actualizar usuario (admin)
router.patch("/:id", updateAdminUsuario);

export default router;
