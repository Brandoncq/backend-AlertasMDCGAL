import pool from "../config/db.js";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/jwt.js";

export const login = async (req, res) => {
  try {
    const { correo, password } = req.body;

    // Buscar usuario
    const result = await pool.query(
      `SELECT id, nombres, apellidos, correo, celular, rol, activo, password_hash
       FROM usuarios
       WHERE correo = $1`,
      [correo],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas",
        data: null,
      });
    }

    const user = result.rows[0];

    if (!user.activo) {
      return res.status(403).json({
        success: false,
        message: "Usuario inactivo. Contacte con el administrador.",
        data: null,
      });
    }

    // Validar contraseña
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas",
        data: null,
      });
    }

    // Crear JWT
    const token = generateToken({
      id: user.id,
      rol: user.rol,
    });

    // Enviar cookie
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 2 * 60 * 60 * 1000,
    });

    return res
      .cookie("access_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        path: "/",
      })
      .status(200)
      .json({
        success: true,
        message: "Login exitoso",
        data: {
          id: user.id,
          nombres: user.nombres,
          apellidos: user.apellidos,
          correo: user.correo,
          celular: user.celular,
          rol: user.rol,
          activo: user.activo,
        },
      });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};
