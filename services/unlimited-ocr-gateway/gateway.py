from __future__ import annotations

import base64
import hmac
import json
import os
import re
import sys
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen

import pymupdf

MAX_FILE_BYTES = 15 * 1024 * 1024
MAX_PDF_PAGES = 200
MAX_OCR_PAGES = 10
MAX_OCR_TEXT_CHARACTERS = 100_000
MAX_PAGE_PIXELS = 30_000_000
PAGE_RENDER_DPI = 300
MODEL_REQUEST_TIMEOUT_SECONDS = 120


class GatewayError(Exception):
    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class Settings:
    gateway_api_key: str
    vllm_api_base_url: str
    vllm_api_key: str | None
    model: str

    @classmethod
    def from_environment(cls) -> "Settings":
        gateway_api_key = os.environ.get("OCR_GATEWAY_API_KEY", "").strip()
        vllm_api_base_url = os.environ.get("VLLM_API_BASE_URL", "").strip()
        vllm_api_key = os.environ.get("VLLM_API_KEY", "").strip() or None
        model = os.environ.get("VLLM_MODEL", "baidu/Unlimited-OCR").strip()

        if not gateway_api_key:
            raise RuntimeError("OCR_GATEWAY_API_KEY must be configured")
        if len(gateway_api_key) < 32:
            raise RuntimeError("OCR_GATEWAY_API_KEY must contain at least 32 characters")
        if not model:
            raise RuntimeError("VLLM_MODEL must not be empty")

        parsed_url = urlsplit(vllm_api_base_url)
        if (
            parsed_url.scheme not in {"http", "https"}
            or not parsed_url.netloc
            or parsed_url.username
            or parsed_url.password
            or parsed_url.query
            or parsed_url.fragment
        ):
            raise RuntimeError("VLLM_API_BASE_URL must be an absolute HTTP(S) URL")

        return cls(
            gateway_api_key=gateway_api_key,
            vllm_api_base_url=vllm_api_base_url.rstrip("/"),
            vllm_api_key=vllm_api_key,
            model=model,
        )


def parse_page_numbers(value: str) -> list[int]:
    try:
        pages = [int(part) for part in value.split(",")]
    except ValueError as error:
        raise GatewayError("Page numbers must be comma-separated positive integers.") from error

    if (
        not pages
        or any(page < 1 for page in pages)
        or len(set(pages)) != len(pages)
    ):
        raise GatewayError("Page numbers must be unique positive integers.")
    if len(pages) > MAX_OCR_PAGES:
        raise GatewayError(f"OCR is limited to {MAX_OCR_PAGES} scanned pages per document.", 413)
    return pages


def clean_model_output(value: str) -> str:
    without_detections = re.sub(
        r"<\|det\|>.*?<\|/det\|>", "", value, flags=re.DOTALL
    )
    return without_detections.replace("<|ref|>", "").replace("<|/ref|>", "").strip()


def has_valid_gateway_key(authorization: str, expected_key: str) -> bool:
    return hmac.compare_digest(
        authorization.encode("utf-8"),
        f"Bearer {expected_key}".encode("utf-8"),
    )


def chat_completions_url(base_url: str) -> str:
    return f"{base_url}/chat/completions" if base_url.endswith("/v1") else f"{base_url}/v1/chat/completions"


def recognize_page(
    image_bytes: bytes,
    settings: Settings,
    opener: Callable[..., Any] = urlopen,
) -> str:
    image_data = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "model": settings.model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "<image>document parsing."},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{image_data}"},
                    },
                ],
            }
        ],
        "max_tokens": 8192,
        "temperature": 0,
        "stream": False,
        "skip_special_tokens": False,
        "vllm_xargs": {"ngram_size": 35, "window_size": 128},
    }
    headers = {"Content-Type": "application/json"}
    if settings.vllm_api_key:
        headers["Authorization"] = f"Bearer {settings.vllm_api_key}"
    request = Request(
        chat_completions_url(settings.vllm_api_base_url),
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with opener(request, timeout=MODEL_REQUEST_TIMEOUT_SECONDS) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise GatewayError("The Unlimited-OCR model request failed.", 502) from error

    try:
        text = result["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise GatewayError("The OCR model returned an invalid response.", 502) from error
    if not isinstance(text, str):
        raise GatewayError("The OCR model returned an invalid response.", 502)

    cleaned_text = clean_model_output(text)
    if len(cleaned_text) > MAX_OCR_TEXT_CHARACTERS:
        raise GatewayError("The OCR model response exceeds the safe text limit.", 502)
    return cleaned_text


def recognize_pdf_pages(
    pdf_bytes: bytes,
    page_numbers: list[int],
    settings: Settings,
    opener: Callable[..., Any] = urlopen,
) -> list[dict[str, int | str]]:
    if not pdf_bytes.startswith(b"%PDF-"):
        raise GatewayError("The uploaded content is not a valid PDF.")
    if len(pdf_bytes) > MAX_FILE_BYTES:
        raise GatewayError("The PDF exceeds the 15 MiB upload limit.", 413)

    try:
        document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as error:
        print(
            f"OCR gateway could not open an uploaded PDF ({type(error).__name__}).",
            file=sys.stderr,
        )
        raise GatewayError("Unable to read this PDF.") from error

    with document:
        if document.needs_pass:
            raise GatewayError("Password-protected PDFs are not supported.", 422)
        if document.page_count > MAX_PDF_PAGES:
            raise GatewayError(f"PDFs are limited to {MAX_PDF_PAGES} pages.", 413)
        if any(page_number > document.page_count for page_number in page_numbers):
            raise GatewayError("A requested OCR page is outside the PDF page range.")

        results: list[dict[str, int | str]] = []
        for page_number in page_numbers:
            try:
                page = document.load_page(page_number - 1)
                scale = PAGE_RENDER_DPI / 72
                if page.rect.width * scale * page.rect.height * scale > MAX_PAGE_PIXELS:
                    raise GatewayError("A PDF page exceeds the safe rendering dimensions.", 413)
                image_bytes = page.get_pixmap(dpi=PAGE_RENDER_DPI, alpha=False).tobytes("png")
            except GatewayError:
                raise
            except Exception as error:
                print(
                    f"OCR gateway could not render PDF page {page_number} "
                    f"({type(error).__name__}).",
                    file=sys.stderr,
                )
                raise GatewayError("Unable to render a PDF page for OCR.", 422) from error
            results.append({
                "page_number": page_number,
                "text": recognize_page(image_bytes, settings, opener),
            })
        return results


class OCRGatewayHandler(BaseHTTPRequestHandler):
    settings: Settings
    server_version = "LegalLensOCR/1.0"
    sys_version = ""

    def do_GET(self) -> None:
        if urlsplit(self.path).path == "/health":
            self._send_json({"status": "ok"})
            return
        self._send_json({"error": "Not found"}, 404)

    def do_POST(self) -> None:
        if urlsplit(self.path).path != "/v1/ocr/pdf":
            self._send_json({"error": "Not found"}, 404)
            return

        authorization = self.headers.get("Authorization", "")
        if not has_valid_gateway_key(authorization, self.settings.gateway_api_key):
            self._send_json({"error": "Unauthorized"}, 401)
            return

        if self.headers.get_content_type() != "application/pdf":
            self._send_json({"error": "Content-Type must be application/pdf."}, 415)
            return

        try:
            content_length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            self._send_json({"error": "A valid Content-Length header is required."}, 411)
            return
        if content_length < 1:
            self._send_json({"error": "The PDF body is empty."}, 400)
            return
        if content_length > MAX_FILE_BYTES:
            self._send_json({"error": "The PDF exceeds the 15 MiB upload limit."}, 413)
            return

        try:
            query = parse_qs(urlsplit(self.path).query, strict_parsing=True)
            if set(query) != {"pages"} or len(query["pages"]) != 1:
                raise GatewayError("A single pages query parameter is required.")
            pages = parse_page_numbers(query.get("pages", [""])[0])
            pdf_bytes = self.rfile.read(content_length)
            if len(pdf_bytes) != content_length:
                raise GatewayError("The PDF body was incomplete.")
            results = recognize_pdf_pages(pdf_bytes, pages, self.settings)
        except GatewayError as error:
            self._send_json({"error": str(error)}, error.status)
            return
        except ValueError:
            self._send_json({"error": "A comma-separated pages query parameter is required."}, 400)
            return

        self._send_json({"pages": results})

    def _send_json(self, body: dict[str, Any], status: int = 200) -> None:
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"OCR gateway: {format % args}", file=sys.stderr)


def main() -> None:
    settings = Settings.from_environment()
    handler = type("ConfiguredOCRGatewayHandler", (OCRGatewayHandler,), {"settings": settings})
    port = int(os.environ.get("OCR_GATEWAY_PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), handler)
    print(f"Unlimited-OCR gateway listening on port {port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
