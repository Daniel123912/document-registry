const express = require("express");
const { z } = require("zod");
const { requireAuth, requireResponsible } = require("../auth");
const { asyncHandler } = require("../middleware/asyncHandler");
const {
  listEmailTemplateFolders,
  createEmailTemplateFolder,
  updateEmailTemplateFolder,
  deleteEmailTemplateFolder,
} = require("../services/emailTemplateFolders");

const router = express.Router();

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  parentId: z.number().int().positive().nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  parentId: z.number().int().positive().nullable().optional(),
});

router.get(
  "/",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const rows = await listEmailTemplateFolders();
    res.json(rows);
  })
);

router.post(
  "/",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.parse(req.body);
    const folder = await createEmailTemplateFolder(parsed);
    res.status(201).json(folder);
  })
);

router.patch(
  "/:id",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const folderId = Number(req.params.id);
    const parsed = updateSchema.parse(req.body);
    const folder = await updateEmailTemplateFolder({ folderId, ...parsed });
    res.json(folder);
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const folderId = Number(req.params.id);
    await deleteEmailTemplateFolder(folderId);
    res.json({ message: "Папка удалена." });
  })
);

module.exports = router;
