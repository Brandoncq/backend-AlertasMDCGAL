import express from "express";
import { getFormularioConfig } from "../controllers/formularios.public.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Opcional: proteger con authMiddleware
process.env.NODE_ENV === "production" && router.use(authMiddleware);

// Obtener estructura de un formulario dinámico
router.get("/config/:identificador", getFormularioConfig);

export default router;
