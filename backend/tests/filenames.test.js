const test = require("node:test");
const assert = require("node:assert/strict");
const { decodeOriginalFilename } = require("../src/utils/filenames");

test("decodes multer latin1 mojibake for cyrillic filenames", () => {
  const garbled = Buffer.from("Текущая карточка товара.pdf", "utf8").toString("latin1");
  assert.equal(decodeOriginalFilename(garbled), "Текущая карточка товара.pdf");
});

test("keeps already correct cyrillic filenames", () => {
  assert.equal(
    decodeOriginalFilename("Текущая карточка товара.pdf"),
    "Текущая карточка товара.pdf"
  );
});

test("keeps ascii filenames", () => {
  assert.equal(decodeOriginalFilename("invoice.pdf"), "invoice.pdf");
});

test("decodes the exact broken name from the ui", () => {
  const garbled = "ÐÐ°ÐºÐµÑ Ð½Ð¾Ð²Ð¾Ð¹ ÐºÐ°ÑÑÐ¾ÑÐºÐµ ÑÐ¾Ð²Ð°ÑÐ°.pdf";
  assert.equal(decodeOriginalFilename(garbled), "Макет новой карточке товара.pdf");
});
