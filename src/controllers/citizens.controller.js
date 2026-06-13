import pool from "../config/db.js";
import bcrypt from "bcrypt";

// Obtener ciudadanos
export const getCitizens = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.nombres,
        u.apellidos,
        u.celular,
        u.correo,
        u.rol,
        u.activo,
        c.dni,
        c.fecha_vencimiento_dni,
        c.direccion,
        c.ubigeo,
        c.contador_rechazos,
        c.bloqueado_hasta
      FROM ciudadanos c
      INNER JOIN usuarios u
        ON c.id_usuario = u.id
    `);

    return res.status(200).json({
      success: true,
      message: "Ciudadanos obtenidos correctamente",
      data: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      data: null,
    });
  }
};

// Crear ciudadano
export const createCitizen = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      nombres,
      apellidos,
      celular,
      correo,
      dni,
      fecha_vencimiento_dni,
      direccion,
      ubigeo,
    } = req.body;

    // Contraseña inicial = celular
    const passwordHash = await bcrypt.hash(celular, 10);

    // Crear usuario
    const userResult = await client.query(
      `
      INSERT INTO usuarios (
        nombres,
        apellidos,
        celular,
        correo,
        rol,
        password_hash
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id
      `,
      [nombres, apellidos, celular, correo, "CIUDADANO", passwordHash],
    );

    const idUsuario = userResult.rows[0].id;

    // Crear ciudadano
    await client.query(
      `
      INSERT INTO ciudadanos (
        id_usuario,
        dni,
        fecha_vencimiento_dni,
        direccion,
        ubigeo
      )
      VALUES ($1,$2,$3,$4,$5)
      `,
      [idUsuario, dni, fecha_vencimiento_dni, direccion, ubigeo],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Ciudadano creado correctamente",
      data: null,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      data: null,
    });
  } finally {
    client.release();
  }
};

// Actualizar ciudadano
export const updateCitizen = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;

    const {
      nombres,
      apellidos,
      celular,
      correo,
      dni,
      fecha_vencimiento_dni,
      direccion,
      ubigeo,
    } = req.body;

    // Actualizar usuario
    await client.query(
      `
      UPDATE usuarios
      SET
        nombres = $1,
        apellidos = $2,
        celular = $3,
        correo = $4
      WHERE id = $5
      `,
      [nombres, apellidos, celular, correo, id],
    );

    // Actualizar ciudadano
    await client.query(
      `
      UPDATE ciudadanos
      SET
        dni = $1,
        fecha_vencimiento_dni = $2,
        direccion = $3,
        ubigeo = $4
      WHERE id_usuario = $5
      `,
      [dni, fecha_vencimiento_dni, direccion, ubigeo, id],
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Ciudadano actualizado correctamente",
      data: null,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      data: null,
    });
  } finally {
    client.release();
  }
};

// Eliminación lógica
export const deleteCitizen = async (req, res) => {
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
      message: "Ciudadano desactivado correctamente",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      data: null,
    });
  }
};
