const express = require("express");
const { z } = require("zod");
const { query } = require("../db");
const { requireAuth, requireResponsible } = require("../auth");
const { buildPasswordFields } = require("../userPassword");
const { asyncHandler } = require("../middleware/asyncHandler");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const result = await query(
      "SELECT id, full_name, email, role, is_active, created_at FROM users ORDER BY full_name ASC"
    );
    res.json(
      result.rows.map((user) => ({
        id: Number(user.id),
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
      }))
    );
  })
);

router.post(
  "/",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      fullName: z.string().min(2),
      email: z.email(),
      password: z.string().min(4),
      role: z.enum(["responsible", "employee"]),
    });
    const parsed = schema.parse(req.body);

    const { passwordHash, passwordEncrypted } = await buildPasswordFields(
      parsed.password
    );
    const result = await query(
      `
        INSERT INTO users (full_name, email, password_hash, password_encrypted, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, full_name, email, role, is_active, created_at
      `,
      [
        parsed.fullName,
        parsed.email.toLowerCase(),
        passwordHash,
        passwordEncrypted,
        parsed.role,
      ]
    );

    const user = result.rows[0];
    res.status(201).json({
      id: Number(user.id),
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
    });
  })
);

module.exports = router;
