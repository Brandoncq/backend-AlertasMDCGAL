import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import alertasRoutes from "./routes/alertas.routes.js";
import serenosRoutes from "./routes/serenos.routes.js";
import asignacionesRoutes from "./routes/asignaciones.routes.js";
import historialRoutes from "./routes/historial.routes.js";
import adminUsuariosRoutes from "./routes/admin.usuarios.routes.js";
import adminFormulariosRoutes from "./routes/admin.formularios.routes.js";
import formulariosPublicRoutes from "./routes/formularios.public.routes.js";
import citizensRoutes from "./routes/citizens.routes.js";
import broadcastingRoutes from "./routes/broadcasting.routes.js";
import { startTimeoutWorker } from "./services/timeoutWorker.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

// 🌐 RUTAS PÚBLICAS
app.use("/auth", authRoutes);
app.use("/api/formularios", formulariosPublicRoutes);

// 🔒 RUTAS PROTEGIDAS
app.use("/api/broadcasting", broadcastingRoutes);
app.use("/api/alertas", alertasRoutes);
app.use("/api/serenos", serenosRoutes);
app.use("/api/asignaciones", asignacionesRoutes);
app.use("/api/historial", historialRoutes);
app.use("/api/ciudadanos", citizensRoutes);
app.use("/api/admin/usuarios", adminUsuariosRoutes);
app.use("/api/admin/formularios", adminFormulariosRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  // Iniciar worker de background
  startTimeoutWorker();
});
