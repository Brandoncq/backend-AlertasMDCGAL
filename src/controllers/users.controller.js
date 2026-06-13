import pool from "../config/db.js";
import bcrypt from "bcrypt";

// Obtener usuarios
export const getUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nombres, apellidos, correo, celular, rol, activo
      FROM usuarios
    `);

    return res.status(200).json({
      success: true,
      message: "Usuarios obtenidos correctamente",
      data: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};

// Crear usuario
export const createUser = async (req, res) => {
  try {
    const { nombres, apellidos, celular, correo, rol } = req.body;

    // La contraseña inicial será el celular
    const passwordHash = await bcrypt.hash(celular, 10);

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
      [nombres, apellidos, celular, correo, rol, passwordHash],
    );

    return res.status(201).json({
      success: true,
      message: "Usuario creado correctamente",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};

// Actualizar usuario
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombres, apellidos, celular, correo, rol } = req.body;

    const result = await pool.query(
      `
      UPDATE usuarios
      SET
        nombres = $1,
        apellidos = $2,
        celular = $3,
        correo = $4,
        rol = $5
      WHERE id = $6
      `,
      [nombres, apellidos, celular, correo, rol, id],
    );

    return res.status(200).json({
      success: true,
      message: "Usuario actualizado correctamente",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};

// Actualizar contraseña
export const updatePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `
      UPDATE usuarios
      SET password_hash = $1
      WHERE id = $2
      `,
      [passwordHash, id],
    );

    return res.status(200).json({
      success: true,
      message: "Contraseña actualizada correctamente",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};

// Eliminación lógica
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `
      UPDATE usuarios
      SET activo = false
      WHERE id = $1
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Usuario desactivado correctamente",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};
