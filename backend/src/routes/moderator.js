const express = require("express");
const { z } = require("zod");
const { query } = require("../db");
const { signModeratorToken, requireModerator } = require("../auth");
const { moderatorLogin, moderatorPassword } = require("../config");
const { decryptPassword } = require("../passwordVault");
const { buildPasswordFields } = require("../userPassword");
const { asyncHandler } = require("../middleware/asyncHandler");

const router = express.Router();

function serializeUser(row) {
  const password = decryptPassword(row.password_encrypted);
  return {
    id: Number(row.id),
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    password: password || "",
    createdAt: row.created_at,
  };
}

router.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    if (!moderatorLogin || !moderatorPassword) {
      return res.status(503).json({
        message:
          "Вход модератора не настроен. Задайте MODERATOR_LOGIN и MODERATOR_PASSWORD в backend/.env.",
      });
    }

    const schema = z.object({
      login: z.string().min(1),
      password: z.string().min(1),
    });
    const parsed = schema.parse(req.body);

    if (
      parsed.login !== moderatorLogin ||
      parsed.password !== moderatorPassword
    ) {
      return res.status(401).json({ message: "Неверный логин или пароль." });
    }

    return res.json({
      token: signModeratorToken(),
    });
  })
);

router.get(
  "/users",
  requireModerator,
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        SELECT id, full_name, email, role, is_active, password_encrypted, created_at
        FROM users
        ORDER BY full_name ASC
      `
    );
    res.json(result.rows.map(serializeUser));
  })
);

router.post(
  "/users",
  requireModerator,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      fullName: z.string().min(2),
      email: z.email(),
      password: z.string().min(4),
      role: z.enum(["responsible", "employee"]),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);

    const { passwordHash, passwordEncrypted } = await buildPasswordFields(
      parsed.password
    );
    const isActive = parsed.isActive !== false;

    const result = await query(
      `
        INSERT INTO users (full_name, email, password_hash, password_encrypted, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, full_name, email, role, is_active, password_encrypted, created_at
      `,
      [
        parsed.fullName,
        parsed.email.toLowerCase(),
        passwordHash,
        passwordEncrypted,
        parsed.role,
        isActive,
      ]
    );

    res.status(201).json(serializeUser(result.rows[0]));
  })
);

router.patch(
  "/users/:id",
  requireModerator,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ message: "Некорректный идентификатор." });
    }

    const schema = z.object({
      fullName: z.string().min(2).optional(),
      email: z.email().optional(),
      password: z.string().min(4).optional(),
      role: z.enum(["responsible", "employee"]).optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);

    const existing = await query("SELECT id FROM users WHERE id = $1", [userId]);
    if (!existing.rows[0]) {
      return res.status(404).json({ message: "Пользователь не найден." });
    }

    const fields = [];
    const values = [];

    if (parsed.fullName != null) {
      values.push(parsed.fullName);
      fields.push(`full_name = $${values.length}`);
    }
    if (parsed.email != null) {
      values.push(parsed.email.toLowerCase());
      fields.push(`email = $${values.length}`);
    }
    if (parsed.role != null) {
      values.push(parsed.role);
      fields.push(`role = $${values.length}`);
    }
    if (parsed.isActive != null) {
      values.push(parsed.isActive);
      fields.push(`is_active = $${values.length}`);
    }
    if (parsed.password != null) {
      const { passwordHash, passwordEncrypted } = await buildPasswordFields(
        parsed.password
      );
      values.push(passwordHash);
      fields.push(`password_hash = $${values.length}`);
      values.push(passwordEncrypted);
      fields.push(`password_encrypted = $${values.length}`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: "Нет данных для обновления." });
    }

    values.push(userId);
    const result = await query(
      `
        UPDATE users
        SET ${fields.join(", ")}
        WHERE id = $${values.length}
        RETURNING id, full_name, email, role, is_active, password_encrypted, created_at
      `,
      values
    );

    res.json(serializeUser(result.rows[0]));
  })
);

router.delete(
  "/users/:id",
  requireModerator,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ message: "Некорректный идентификатор." });
    }

    try {
      const result = await query(
        `
          DELETE FROM users
          WHERE id = $1
          RETURNING id
        `,
        [userId]
      );

      if (!result.rows[0]) {
        return res.status(404).json({ message: "Пользователь не найден." });
      }

      return res.json({ message: "Пользователь удалён." });
    } catch (error) {
      if (error.code === "23503") {
        return res.status(409).json({
          message:
            "Нельзя удалить пользователя: есть связанные документы или записи. Отключите учётную запись (неактивен).",
        });
      }
      throw error;
    }
  })
);

module.exports = router;
