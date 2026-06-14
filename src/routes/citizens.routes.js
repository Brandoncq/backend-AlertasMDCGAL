import express from "express";
import {
  getContactos,
  agregarContacto,
  eliminarContacto,
} from "../controllers/citizens.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

process.env.NODE_ENV === "production" && router.use(authMiddleware);

// Contactos de emergencia del ciudadano
router.get("/contactos", getContactos);
router.post("/contactos", agregarContacto);
router.delete("/contactos/:id", eliminarContacto);

export default router;
