const express = require("express");
const { z } = require("zod");
const { requireAuth, requireResponsible } = require("../auth");
const { asyncHandler } = require("../middleware/asyncHandler");
const folders = require("../services/folders");

const router = express.Router();

const typeSchema = z.enum([
  "order",
  "regulation",
  "instruction",
  "new_goods",
  "other",
  "legal_entity",
]);

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const type = req.query.type ? String(req.query.type) : undefined;
    if (type) {
      typeSchema.parse(type);
    }
    const rows = await folders.listFolders({ type });
    res.json(rows);
  })
);

router.post(
  "/",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      type: typeSchema,
      parentId: z.coerce.number().int().positive().nullable().optional(),
    });
    const parsed = schema.parse(req.body);
    const folder = await folders.createFolder({
      name: parsed.name,
      type: parsed.type,
      parentId: parsed.parentId ?? null,
    });
    res.status(201).json(folder);
  })
);

router.patch(
  "/:id",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().min(1).optional(),
      parentId: z.coerce.number().int().positive().nullable().optional(),
    });
    const parsed = schema.parse(req.body);
    const folder = await folders.updateFolder({
      folderId: Number(req.params.id),
      name: parsed.name,
      parentId: Object.prototype.hasOwnProperty.call(parsed, "parentId")
        ? parsed.parentId
        : undefined,
    });
    res.json(folder);
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    await folders.deleteFolder(Number(req.params.id));
    res.json({ message: "Папка удалена." });
  })
);

module.exports = router;
