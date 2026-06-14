import express from "express";
import { login, loginApp, registerCiudadano } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/login", login); // Login Dashboard (con cookies)
router.post("/app/login", loginApp); // Login App (solo token JSON)
router.post("/ciudadano/register", registerCiudadano);

export default router;
