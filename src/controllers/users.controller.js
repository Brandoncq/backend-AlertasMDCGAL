import pool from "../config/db.js";
import bcrypt from "bcrypt";

export const getUsers = async (req, res) => {
  const result = await pool.query(
    "SELECT id, nombres, apellidos, correo, celular, rol, activo FROM usuarios",
  );
  res.json(result.rows);
  /*const passwordHash = await bcrypt.hash("123456", 10);
  await pool.query(
    `
    INSERT INTO usuarios (
        nombres,
        apellidos,
        celular,
        correo,
        rol,
        password_hash
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      "admin",
      "admin",
      "999999999",
      "adminn@gmail.com",
      "ADMINISTRADOR",
      passwordHash,
    ],
  );
  res.json({
    message: "Usuario creado correctamente",
  });*/
};

export const register = async (req, res) => {
  try {
    const { nombre, correo, password } = req.body;

    // Hashear contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `
      INSERT INTO usuarios (nombre, correo, password_hash)
      VALUES ($1, $2, $3)
      `,
      [nombre, correo, passwordHash],
    );

    res.status(201).json({
      message: "Usuario creado correctamente",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};
