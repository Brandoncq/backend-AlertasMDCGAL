import pool from "../config/db.js";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/jwt.js";

export const login = async (req, res) => {
  try {
    const { correo, password } = req.body;

    // Buscar usuario
    const result = await pool.query(
      `SELECT id, nombre, correo, rol, password_hash
       FROM usuarios
       WHERE correo = $1`,
      [correo],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Usuario no existe",
      });
    }

    const user = result.rows[0];

    if (!user.activo) {
      return res.status(403).json({
        message: "Usuario inactivo. Contacte con el administrador.",
      });
    }

    // Validar contraseña
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({
        message: "Contraseña incorrecta",
      });
    }

    // Crear JWT
    const token = generateToken({
      id: user.id,
      nombre: user.nombre,
      correo: user.correo,
      rol: user.rol,
    });

    // Enviar cookie
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: false, // true en producción con HTTPS
      sameSite: "lax",
      maxAge: 2 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Login exitoso",
      usuario: {
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
};
