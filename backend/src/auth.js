const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("./config");

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      fullName: user.full_name,
    },
    jwtSecret,
    { expiresIn: "7d" }
  );
}

function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!token) {
    return res.status(401).json({ message: "Требуется авторизация." });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Сессия недействительна." });
  }
}

function requireResponsible(req, res, next) {
  if (!req.user || req.user.role !== "responsible") {
    return res.status(403).json({ message: "Недостаточно прав." });
  }

  return next();
}

function signModeratorToken() {
  return jwt.sign(
    {
      sub: "moderator",
      role: "moderator",
    },
    jwtSecret,
    { expiresIn: "12h" }
  );
}

function requireModerator(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  if (!token) {
    return res.status(401).json({ message: "Требуется авторизация модератора." });
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (payload.role !== "moderator") {
      return res.status(403).json({ message: "Недостаточно прав." });
    }
    req.moderator = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Сессия модератора недействительна." });
  }
}

module.exports = {
  signToken,
  signModeratorToken,
  hashPassword,
  comparePassword,
  requireAuth,
  requireResponsible,
  requireModerator,
};
