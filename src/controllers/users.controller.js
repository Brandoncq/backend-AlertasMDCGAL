import pool from "../config/db.js";

export const getUsers = async (req, res) => {
  const result = await pool.query(
    "SELECT id, nombres, apellidos, rol FROM usuarios",
  );
  res.json(result.rows);
};
