const express = require("express");
const { z } = require("zod");
const { requireAuth, requireResponsible } = require("../auth");
const { asyncHandler } = require("../middleware/asyncHandler");
const { upload } = require("../utils/uploads");
const { contentDisposition } = require("../utils/files");
const documents = require("../services/documents");

const router = express.Router();

const DOCUMENT_TYPE_VALUES = [
  "order",
  "regulation",
  "instruction",
  "new_goods",
  "other",
  "legal_entity",
];

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const onlyAssigned = req.query.scope === "assigned";
    const trash = req.query.scope === "trash";

    if (trash && req.user.role !== "responsible") {
      return res.status(403).json({ message: "Недостаточно прав." });
    }

    const rows = await documents.listDocuments({
      userId: Number(req.user.sub),
      role: req.user.role,
      onlyAssigned,
      trash,
    });
    res.json(rows);
  })
);

router.get(
  "/assigned/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await documents.listDocuments({
      userId: Number(req.user.sub),
      role: req.user.role,
      onlyAssigned: true,
    });
    res.json(rows);
  })
);

router.get(
  "/:id/file",
  requireAuth,
  asyncHandler(async (req, res) => {
    const versionQuery = req.query.version;
    const versionNo =
      versionQuery === undefined || versionQuery === "" ? null : Number(versionQuery);

    const file = await documents.getDocumentFile({
      documentId: Number(req.params.id),
      versionNo: Number.isFinite(versionNo) && versionNo > 0 ? versionNo : null,
      userId: Number(req.user.sub),
      role: req.user.role,
      allowDeleted: req.user.role === "responsible",
    });

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", contentDisposition(file.originalFilename, "inline"));
    res.sendFile(file.absolutePath, (error) => {
      if (!error || res.headersSent) {
        return;
      }
      res.status(404).json({ message: "Файл не найден." });
    });
  })
);

router.post(
  "/",
  requireAuth,
  requireResponsible,
  upload.single("docFile"),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      title: z.string().min(1),
      type: z.enum(DOCUMENT_TYPE_VALUES),
      number: z.string().optional().default(""),
      documentDate: z.string().min(1),
      dueDate: z.string().min(1),
      description: z.string().optional().default(""),
      folderId: z
        .union([z.coerce.number().int().positive(), z.literal(""), z.null()])
        .optional()
        .transform((value) => (value === "" || value == null ? null : value)),
    });

    const parsed = schema.parse(req.body);
    const assignedUsers = documents.parseJsonArrayField(req.body.assignedUsers).map(Number);

    if (!req.file && parsed.type !== "order") {
      return res.status(400).json({ message: "Не удалось загрузить файл." });
    }

    const document = await documents.createDocument({
      parsed,
      assignedUsers,
      file: req.file || null,
      authorId: Number(req.user.sub),
    });

    res.status(201).json({
      message: "Документ сохранен как черновик.",
      id: Number(document.id),
    });
  })
);

router.post(
  "/:id/publish",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    await documents.publishDocument({
      documentId: Number(req.params.id),
      userId: Number(req.user.sub),
    });
    res.json({ message: "Документ опубликован." });
  })
);

router.post(
  "/:id/versions",
  requireAuth,
  requireResponsible,
  upload.single("versionFile"),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      changeReason: z.string().min(1),
    });
    const parsed = schema.parse(req.body);

    if (!req.file) {
      return res.status(400).json({ message: "Не удалось загрузить файл." });
    }

    await documents.createVersion({
      documentId: Number(req.params.id),
      changeReason: parsed.changeReason,
      file: req.file,
      userId: Number(req.user.sub),
    });

    res.json({ message: "Новая версия создана и активирована." });
  })
);

async function removeDocumentVersion(req, res) {
  const schema = z.object({
    id: z.coerce.number().int().positive(),
    versionNo: z.coerce.number().int().positive(),
  });
  const parsed = schema.parse(req.params);

  await documents.deleteVersion({
    documentId: parsed.id,
    versionNo: parsed.versionNo,
  });
  res.json({ message: "Версия удалена." });
}

router.delete(
  "/:id/versions/:versionNo",
  requireAuth,
  requireResponsible,
  asyncHandler(removeDocumentVersion)
);
router.post(
  "/:id/versions/:versionNo/delete",
  requireAuth,
  requireResponsible,
  asyncHandler(removeDocumentVersion)
);

async function updateDocumentRequisites(req, res) {
  const schema = z.object({
    title: z.string().min(1),
    type: z.enum(DOCUMENT_TYPE_VALUES),
    number: z.string().optional().default(""),
    documentDate: z.string().min(1),
    description: z.string().optional().default(""),
    assignedUsers: z.array(z.coerce.number()).optional().default([]),
    folderId: z
      .union([z.coerce.number().int().positive(), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value === "" || value == null ? null : value)),
  });
  const parsed = schema.parse(req.body);

  await documents.updateRequisites({
    documentId: Number(req.params.id),
    parsed,
  });

  res.json({ message: "Реквизиты сохранены." });
}

async function removeDocument(req, res) {
  await documents.removeDocument(Number(req.params.id), Number(req.user.sub));
  res.json({ message: "Документ перемещен в корзину." });
}

router.patch("/:id", requireAuth, requireResponsible, asyncHandler(updateDocumentRequisites));
router.post("/:id/update", requireAuth, requireResponsible, asyncHandler(updateDocumentRequisites));

router.post(
  "/:id/archive",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    await documents.archiveDocument(Number(req.params.id));
    res.json({ message: "Документ перемещен в архив." });
  })
);

router.post(
  "/:id/unarchive",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    await documents.unarchiveDocument(Number(req.params.id));
    res.json({ message: "Документ возвращен из архива." });
  })
);

router.delete("/:id", requireAuth, requireResponsible, asyncHandler(removeDocument));
router.post("/:id/delete", requireAuth, requireResponsible, asyncHandler(removeDocument));

router.post(
  "/:id/restore",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    await documents.restoreDocument(Number(req.params.id));
    res.json({ message: "Документ восстановлен." });
  })
);

router.post(
  "/:id/permanent-delete",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    await documents.permanentlyDeleteDocument(Number(req.params.id));
    res.json({ message: "Документ удален безвозвратно." });
  })
);

router.post(
  "/:id/acknowledgements",
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      versionNo: z.number().int().positive(),
    });
    const parsed = schema.parse(req.body);

    try {
      await documents.acknowledgeDocument({
        documentId: Number(req.params.id),
        versionNo: parsed.versionNo,
        userId: Number(req.user.sub),
      });
    } catch (error) {
      if (error.statusCode === 403) {
        return res.status(403).json({ message: error.message });
      }
      throw error;
    }

    res.json({ message: "Ознакомление зафиксировано." });
  })
);

module.exports = router;
