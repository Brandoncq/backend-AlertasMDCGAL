import express from "express";
import {
  getAdminFormularios,
  getAdminFormularioById,
} from "../controllers/admin.formularios.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Proteger todas las rutas
router.use(authMiddleware);

// Obtener todos los formularios (admin)
router.get("/", getAdminFormularios);

// Obtener un formulario por ID (admin)
router.get("/:id", getAdminFormularioById);

export default router;
