const express = require("express");
const { z } = require("zod");
const { requireAuth, requireResponsible } = require("../auth");
const { asyncHandler } = require("../middleware/asyncHandler");
const {
  LAYOUT_KINDS,
  listLetters,
  getLetter,
  getNextOutgoingPreview,
  createLetter,
  updateLetter,
  deleteLetter,
  confirmLetter,
} = require("../services/letters");

const router = express.Router();

const createSchema = z.object({
  folderId: z.number().int().positive().nullable().optional(),
  subject: z.string().trim().max(500).optional(),
  htmlBody: z.string().optional(),
  layoutKind: z.enum(LAYOUT_KINDS).optional(),
  toEmails: z.string().trim().max(1000).optional(),
});

const updateSchema = z.object({
  folderId: z.number().int().positive().nullable().optional(),
  subject: z.string().trim().max(500).optional(),
  htmlBody: z.string().optional(),
  layoutKind: z.enum(LAYOUT_KINDS).optional(),
  toEmails: z.string().trim().max(1000).optional(),
});

function parseFolderId(raw) {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === "null" || raw === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

router.get(
  "/",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const folderId = parseFolderId(req.query.folderId);
    const rows = await listLetters({ folderId });
    res.json(rows);
  })
);

router.post(
  "/",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.parse(req.body);
    const letter = await createLetter({
      authorId: Number(req.user.sub),
      ...parsed,
    });
    res.status(201).json(letter);
  })
);

router.get(
  "/next-outgoing",
  requireAuth,
  requireResponsible,
  asyncHandler(async (_req, res) => {
    const preview = await getNextOutgoingPreview();
    res.json(preview);
  })
);

router.get(
  "/:id",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const letterId = Number(req.params.id);
    const letter = await getLetter(letterId);
    if (!letter) {
      return res.status(404).json({ message: "Письмо не найдено." });
    }
    res.json(letter);
  })
);

router.put(
  "/:id",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const letterId = Number(req.params.id);
    const parsed = updateSchema.parse(req.body);
    const letter = await updateLetter(letterId, parsed);
    res.json(letter);
  })
);

router.post(
  "/:id/confirm",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const letterId = Number(req.params.id);
    const letter = await confirmLetter(letterId);
    res.json(letter);
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const letterId = Number(req.params.id);
    await deleteLetter(letterId);
    res.json({ message: "Письмо удалено." });
  })
);

module.exports = router;
