import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import alertasRoutes from "./routes/alertas.routes.js";
import serenosRoutes from "./routes/serenos.routes.js";
import asignacionesRoutes from "./routes/asignaciones.routes.js";
import historialRoutes from "./routes/historial.routes.js";
import adminUsuariosRoutes from "./routes/admin.usuarios.routes.js";
import adminFormulariosRoutes from "./routes/admin.formularios.routes.js";

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

// 🔒 RUTAS PROTEGIDAS
app.use("/api/alertas", alertasRoutes);
app.use("/api/serenos", serenosRoutes);
app.use("/api/asignaciones", asignacionesRoutes);
app.use("/api/historial", historialRoutes);
app.use("/api/admin/usuarios", adminUsuariosRoutes);
app.use("/api/admin/formularios", adminFormulariosRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
