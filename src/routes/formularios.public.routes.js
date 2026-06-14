import express from "express";
import { getFormularioConfig } from "../controllers/formularios.public.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// NOTA: Estas rutas podrían ser públicas o requerir auth según el diseño
// router.use(authMiddleware);

// Obtener estructura de un formulario dinámico
router.get("/config/:identificador", getFormularioConfig);

export default router;
