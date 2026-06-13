import jwt from "jsonwebtoken";

export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      rol: user.rol,
      correo: user.correo,
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" },
  );
};
