import { useRef } from "react";
import {
  LETTER_FOOTER_IMAGE,
  LETTER_HEADER_IMAGE,
} from "../utils/bakorLetterTemplate";

export default function LetterTemplate({ children, headerSrc, footerSrc }) {
  const stackRef = useRef(null);
  const header = headerSrc || LETTER_HEADER_IMAGE;
  const footer = footerSrc || LETTER_FOOTER_IMAGE;

  return (
    <div
      className="letter-document"
      data-letter-header={header}
      data-letter-footer={footer}
    >
      <div ref={stackRef} className="letter-document__stack" aria-hidden="true" />
      <div className="letter-document__editor">
        <div className="letter-page__content">{children}</div>
      </div>
    </div>
  );
}
