import { jwtVerify } from "jose";

export const authMiddleware = async (req, res, next) => {
  next();
};
