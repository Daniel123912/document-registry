const express = require("express");
const { requireAuth, requireResponsible } = require("../auth");
const { asyncHandler } = require("../middleware/asyncHandler");
const { listAcknowledgementReport } = require("../services/reports");

const router = express.Router();

router.get(
  "/acknowledgements",
  requireAuth,
  requireResponsible,
  asyncHandler(async (req, res) => {
    const rows = await listAcknowledgementReport();
    res.json(rows);
  })
);

module.exports = router;
