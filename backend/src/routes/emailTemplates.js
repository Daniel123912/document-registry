const express = require("express");
const { z } = require("zod");
const { requireAuth, requireResponsible } = require("../auth");
const { asyncHandler } = require("../middleware/asyncHandler");
const {
  TRIGGER_KINDS,
  LAYOUT_KINDS,
  listEmailTemplates,
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
} = require("../services/emailTemplates");

const router = express.Router();

const createSchema = z.object({
  folderId: z.number().int().positive().nullable().optional(),
  triggerKind: z.enum(TRIGGER_KINDS),
  layoutKind: z.enum(LAYOUT_KINDS).optional(),
  name: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(500),
  htmlBody: z.string().min(1),
  isDefault: z.boolean().optional(),
});

const updateSchema = z.object({
  folderId: z.number().int().positive().nullable().optional(),
  triggerKind: z.enum(TRIGGER_KINDS).optional(),
  layoutKind: z.enum(LAYOUT_KINDS).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  subject: z.string().trim().min(1).max(500).optional(),
  htmlBody: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
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
    const rows = await listEmailTemplates({ folderId });
    res.json(rows);
  })
);

router.post(
  "/",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.parse(req.body);
    const template = await createEmailTemplate(parsed);
    res.status(201).json(template);
  })
);

router.get(
  "/:id",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const templateId = Number(req.params.id);
    const template = await getEmailTemplate(templateId);
    if (!template) {
      return res.status(404).json({ message: "Шаблон письма не найден." });
    }

    res.json(template);
  })
);

router.put(
  "/:id",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const templateId = Number(req.params.id);
    const parsed = updateSchema.parse(req.body);
    const template = await updateEmailTemplate(templateId, parsed);
    res.json(template);
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const templateId = Number(req.params.id);
    await deleteEmailTemplate(templateId);
    res.json({ message: "Шаблон удалён." });
  })
);

module.exports = router;
