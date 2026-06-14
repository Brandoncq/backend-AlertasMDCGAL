import jwt from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1];

  if (!token || token === "null" || token === "undefined") {
    token = req.cookies?.access_token;
  }

  if (token) {
    const payload = jwt.decode(token);
    if (payload) {
      req.user = payload;
    }
  }

  if (!req.user && req.body && req.body.usuario_id) {
    req.user = { id: req.body.usuario_id };
  }

  next();
};
