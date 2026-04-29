#!/usr/bin/env python3
import base64
import io
import json
import sys
import tempfile
from pathlib import Path


MIN_AVERAGE_CHARS_PER_PAGE = 50


def _load_optional_modules():
    try:
        import fitz  # PyMuPDF
    except Exception as exc:
        fitz = None
        fitz_error = str(exc)
    else:
        fitz_error = None

    try:
        import pytesseract
        from PIL import Image
    except Exception as exc:
        pytesseract = None
        Image = None
        tesseract_error = str(exc)
    else:
        tesseract_error = None

    return fitz, fitz_error, pytesseract, Image, tesseract_error


def _decode_request():
    payload = json.load(sys.stdin)
    content_base64 = payload.get("contentBase64")
    if not content_base64 or not isinstance(content_base64, str):
        raise ValueError("contentBase64 is required")

    return {
        "file_name": payload.get("fileName") or "ocr-upload",
        "mime_type": payload.get("mimeType") or "application/octet-stream",
        "content": base64.b64decode(content_base64, validate=True),
    }


def _extract_pdf_text(fitz, content):
    direct_pages = []
    rendered_pages = []
    with fitz.open(stream=content, filetype="pdf") as document:
        for page in document:
            direct_pages.append(page.get_text("text") or "")
        direct_text = "\n".join(page.strip() for page in direct_pages if page.strip()).strip()
        average_chars = len(direct_text) / max(len(document), 1)
        if average_chars >= MIN_AVERAGE_CHARS_PER_PAGE:
            return {
                "text": direct_text,
                "mode": "direct_text",
                "averageCharsPerPage": average_chars,
                "pagesProcessed": len(document),
            }

        for page in document:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            rendered_pages.append(pixmap.tobytes("png"))

    return {
        "text": direct_text,
        "mode": "needs_ocr",
        "averageCharsPerPage": average_chars,
        "pagesProcessed": len(direct_pages),
        "renderedPages": rendered_pages,
    }


def _ocr_images(pytesseract, Image, image_payloads):
    parts = []
    for image_payload in image_payloads:
        with Image.open(io.BytesIO(image_payload)) as image:
            gray = image.convert("L")
            parts.append(pytesseract.image_to_string(gray) or "")
    return "\n".join(part.strip() for part in parts if part.strip()).strip()


def _image_to_png_bytes(Image, content):
    with Image.open(io.BytesIO(content)) as image:
        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="PNG")
        return buffer.getvalue()


def main():
    try:
        request = _decode_request()
        fitz, fitz_error, pytesseract, Image, tesseract_error = _load_optional_modules()
        mime_type = request["mime_type"].lower()
        content = request["content"]

        if mime_type == "application/pdf" or request["file_name"].lower().endswith(".pdf"):
            if fitz is None:
                raise RuntimeError(f"PyMuPDF is not available: {fitz_error}")
            pdf_result = _extract_pdf_text(fitz, content)
            if pdf_result["mode"] == "direct_text":
                print(json.dumps(pdf_result))
                return

            if pytesseract is None or Image is None:
                raise RuntimeError(f"Tesseract OCR is not available: {tesseract_error}")
            ocr_text = _ocr_images(pytesseract, Image, pdf_result["renderedPages"])
            print(json.dumps({
                "text": ocr_text or pdf_result["text"],
                "mode": "tesseract_ocr",
                "averageCharsPerPage": pdf_result["averageCharsPerPage"],
                "pagesProcessed": pdf_result["pagesProcessed"],
            }))
            return

        if pytesseract is None or Image is None:
            raise RuntimeError(f"Tesseract OCR is not available: {tesseract_error}")
        image_payload = _image_to_png_bytes(Image, content)
        print(json.dumps({
            "text": _ocr_images(pytesseract, Image, [image_payload]),
            "mode": "tesseract_ocr",
            "pagesProcessed": 1,
        }))
    except Exception as exc:
        print(json.dumps({
            "error": str(exc),
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
