import express from "express";
import { login, registerCiudadano } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/login", login);
router.post("/ciudadano/register", registerCiudadano);

export default router;
