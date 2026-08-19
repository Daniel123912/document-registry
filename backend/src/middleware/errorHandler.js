const { z } = require("zod");

function errorHandler(error, req, res, next) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Некорректные данные формы.",
      issues: error.issues,
    });
  }

  if (error.message === "Допустимы только PDF, DOC, DOCX и изображения.") {
    return res.status(400).json({ message: error.message });
  }

  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error.message === "Документ не найден.") {
    return res.status(404).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Внутренняя ошибка сервера." });
}

module.exports = { errorHandler };
