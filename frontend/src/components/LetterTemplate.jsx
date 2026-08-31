import {
  LETTER_FOOTER_IMAGE,
  LETTER_HEADER_IMAGE,
} from "../utils/bakorLetterTemplate";

export default function LetterTemplate({ children, headerSrc, footerSrc }) {
  const header = headerSrc || LETTER_HEADER_IMAGE;
  const footer = footerSrc || LETTER_FOOTER_IMAGE;

  return (
    <div className="letter-page">
      <img
        className="letter-page__header-img"
        src={header}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      <img
        className="letter-page__footer-img"
        src={footer}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      <div className="letter-page__content">{children}</div>
    </div>
  );
}
