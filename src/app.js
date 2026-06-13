import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/users.routes.js";
import citizenRoutes from "./routes/citizens.routes.js";
import serenoRoutes from "./routes/serenos.routes.js";

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
app.use("/users", userRoutes);
app.use("/citizens", citizenRoutes);
app.use("/serenos", serenoRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
