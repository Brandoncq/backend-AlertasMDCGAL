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

export const registerCiudadano = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      dni,
      fecha_vencimiento_dni,
      nombres,
      apellidos,
      celular,
      correo,
      password,
    } = req.body;

    // 1. Validar contra mock_reniec
    const reniecResult = await client.query(
      "SELECT * FROM mock_reniec WHERE dni = $1",
      [dni]
    );

    if (reniecResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "DNI no encontrado en los registros de RENIEC",
        data: null,
      });
    }

    const reniecData = reniecResult.rows[0];
    
    // Comparación básica (se podría hacer más estricta)
    if (
      reniecData.nombres.toLowerCase() !== nombres.toLowerCase() ||
      reniecData.apellidos.toLowerCase() !== apellidos.toLowerCase()
    ) {
      return res.status(400).json({
        success: false,
        message: "Los nombres o apellidos no coinciden con RENIEC",
        data: null,
      });
    }

    await client.query("BEGIN");

    // 2. Hashear password
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Insertar en usuarios
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
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, nombres, apellidos, rol
      `,
      [nombres, apellidos, celular, correo, "CIUDADANO", passwordHash]
    );

    const newUser = userResult.rows[0];

    // 4. Insertar en ciudadanos
    await client.query(
      `
      INSERT INTO ciudadanos (
        id_usuario,
        dni,
        fecha_vencimiento_dni
      )
      VALUES ($1, $2, $3)
      `,
      [newUser.id, dni, fecha_vencimiento_dni]
    );

    await client.query("COMMIT");

    // 5. Generar Token
    const token = generateToken({
      id: newUser.id,
      rol: newUser.rol,
    });

    return res.status(201).json({
      success: true,
      message: "Usuario registrado y verificado con éxito",
      data: {
        token,
        usuario: {
          id: newUser.id,
          nombres: newUser.nombres,
          apellidos: newUser.apellidos,
          rol: newUser.rol,
        },
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    
    // Manejar error de unicidad (correo o celular ya existen)
    if (error.code === '23505') {
       return res.status(400).json({
        success: false,
        message: "El correo, celular o DNI ya se encuentra registrado",
        data: null,
      });
    }

    return res.status(500).json({
      success: false,
      message: `Error interno del servidor: ${error.message}`,
      data: null,
    });
  } finally {
    client.release();
  }
};
