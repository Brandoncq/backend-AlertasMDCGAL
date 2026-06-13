import { jwtVerify } from "jose";

export const authMiddleware = async (req, res, next) => {
  const token =
    req.cookies?.access_token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "No autenticado",
    });
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);

    const { payload } = await jwtVerify(token, secret);

    req.user = payload;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token inválido",
    });
  }
};
