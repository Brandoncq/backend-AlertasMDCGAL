import express from "express";

import {
  getUsers,
  createUser,
  updateUser,
  updatePassword,
  deleteUser,
} from "../controllers/users.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Proteger todas las rutas
router.use(authMiddleware);

// Obtener todos los usuarios
router.get("/", getUsers);

// Crear usuario
router.post("/", createUser);

// Actualizar datos del usuario
router.put("/:id", updateUser);

// Actualizar contraseña
router.put("/:id/password", updatePassword);

// Eliminación lógica (activo = false)
router.delete("/:id", deleteUser);

export default router;
