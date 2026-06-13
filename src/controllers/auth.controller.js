import pool from "../config/db.js";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/jwt.js";

export const login = async (req, res) => {
  try {
    const { correo, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM usuarios WHERE correo = $1",
      [correo],
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: "Usuario no existe" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ message: "Password incorrecto" });
    }

    const token = generateToken(user);

    // 🔥 COOKIE (más seguro que localStorage)
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // en producción true (HTTPS)
      sameSite: "lax",
      maxAge: 2 * 60 * 60 * 1000, // 2 horas
    });

    return res.json({
      message: "Login exitoso",
      token,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
