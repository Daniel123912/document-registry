const express = require("express");
const { z } = require("zod");
const { query } = require("../db");
const { signToken, comparePassword } = require("../auth");
const { asyncHandler } = require("../middleware/asyncHandler");

const router = express.Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      email: z.email(),
      password: z.string().min(4),
    });

    const parsed = schema.parse(req.body);
    const result = await query(
      "SELECT * FROM users WHERE email = $1 AND is_active = TRUE",
      [parsed.email.toLowerCase()]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "Пользователь не найден." });
    }

    const isValid = await comparePassword(parsed.password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: "Неверный пароль." });
    }

    return res.json({
      token: signToken(user),
      user: {
        id: Number(user.id),
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  })
);

module.exports = router;
