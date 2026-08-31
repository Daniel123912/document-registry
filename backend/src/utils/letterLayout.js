const fs = require("fs");
const path = require("path");

const LAYOUT_KIND_BAKOR = "bakor_letter";

const LETTER_PAGE_CSS = `
.letter-page {
  position: relative;
  width: 210mm;
  margin: 0 auto;
  box-sizing: border-box;
  color: #0f1115;
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.15;
}

.letter-page__header-img,
.letter-page__footer-img,
.letter-page-turn__footer,
.letter-page-turn__header {
  position: absolute;
  z-index: 0;
  pointer-events: none;
  display: block;
}

.letter-page__header-img {
  width: 8.33in;
  height: 1.77in;
  left: calc(3cm - 1.21in);
  top: 0;
}

.letter-page__footer-img {
  width: 4.12in;
  height: 1.24in;
  left: calc(3cm - 1.03in);
  top: calc(297mm - 2cm - 1.24in + 0.07in);
  bottom: auto;
}

.letter-page__content {
  position: relative;
  z-index: 1;
  padding: 1.77in 1.5cm calc(2cm + 1.24in) 3cm;
}

.letter-page__content p {
  margin: 0 0 0.35em;
}

.letter-page__content .letter-requisites {
  text-align: right;
  margin: 0 0 1.2em;
}

.letter-page__content .letter-requisites p {
  margin: 0;
}

.letter-page__content .letter-greeting {
  text-align: center;
  font-weight: 700;
  margin: 0 0 1em;
}

.letter-page__content .letter-section-title {
  font-weight: 700;
  margin: 1em 0 0.35em;
}

.letter-page__content .letter-body-justify {
  text-align: justify;
  margin: 0 0 0.8em;
}

.letter-page__content .letter-subsection {
  margin: 0.35em 0;
  text-align: justify;
}

.letter-page__content ul {
  margin: 0.2em 0 0.8em;
  padding-left: 1.4em;
}

.letter-page__content li {
  margin: 0.15em 0;
  text-align: justify;
}

.letter-page__content a {
  color: #0563c1;
  text-decoration: underline;
}

.letter-page__content .letter-signoff {
  margin-top: 1.2em;
}

.letter-page__content .letter-page-turn {
  display: block;
  margin: 0 -1.5cm 0 -3cm;
  break-before: page;
  page-break-before: always;
  pointer-events: none;
}

.letter-page-turn__footer-space {
  height: calc(1.5em + 1.24in);
}

.letter-page-turn__gap {
  height: 24px;
}

.letter-page-turn__header-space {
  height: 1.77in;
}

.letter-page-turn__footer,
.letter-page-turn__header {
  display: none;
}
`.trim();

function imageToDataUrl(filePath) {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function resolveLetterAssets() {
  const publicDir = path.resolve(__dirname, "../../../frontend/public/letter");
  const headerPath = path.join(publicDir, "header-photo.png");
  const footerPath = path.join(publicDir, "footer-signature-block.png");

  return {
    headerSrc: fs.existsSync(headerPath) ? imageToDataUrl(headerPath) : "",
    footerSrc: fs.existsSync(footerPath) ? imageToDataUrl(footerPath) : "",
  };
}

function wrapLetterBodyHtml(contentHtml, assets = resolveLetterAssets()) {
  const header = assets.headerSrc;
  const footer = assets.footerSrc;

  return `<div class="letter-page">
  ${header ? `<img class="letter-page__header-img" src="${header}" alt="" />` : ""}
  ${footer ? `<img class="letter-page__footer-img" src="${footer}" alt="" />` : ""}
  <div class="letter-page__content">${contentHtml}</div>
</div>`;
}

function composeLetterHtml(contentHtml) {
  const body = wrapLetterBodyHtml(contentHtml);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${LETTER_PAGE_CSS}</style>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;">
  ${body}
</body>
</html>`;
}

function isBakorLetterLayout(layoutKind) {
  return layoutKind === LAYOUT_KIND_BAKOR;
}

module.exports = {
  LAYOUT_KIND_BAKOR,
  LETTER_PAGE_CSS,
  composeLetterHtml,
  wrapLetterBodyHtml,
  isBakorLetterLayout,
  resolveLetterAssets,
};
