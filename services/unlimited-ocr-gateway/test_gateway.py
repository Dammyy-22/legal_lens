from __future__ import annotations

import io
import json
import unittest
from urllib.request import Request

import pymupdf

from gateway import (
    GatewayError,
    Settings,
    chat_completions_url,
    clean_model_output,
    has_valid_gateway_key,
    parse_page_numbers,
    recognize_pdf_pages,
)


def make_pdf(width: float = 612, height: float = 792) -> bytes:
    document = pymupdf.open()
    page = document.new_page(width=width, height=height)
    page.insert_text((72, 72), "Scanned legal text")
    return document.tobytes()


class UnlimitedOCRGatewayTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = Settings(
            gateway_api_key="gateway-test-key",
            vllm_api_base_url="http://localhost:8000/v1",
            vllm_api_key="model-test-key",
            model="baidu/Unlimited-OCR",
        )

    def test_parse_page_numbers_rejects_duplicates_and_too_many_pages(self) -> None:
        self.assertEqual(parse_page_numbers("1,3,5"), [1, 3, 5])
        with self.assertRaises(GatewayError):
            parse_page_numbers("1,1")
        with self.assertRaises(GatewayError) as error:
            parse_page_numbers(",".join(str(page) for page in range(1, 12)))
        self.assertEqual(error.exception.status, 413)

    def test_clean_model_output_removes_detection_coordinates(self) -> None:
        self.assertEqual(
            clean_model_output("<|ref|>Legal text<|/ref|><|det|>[[1,2,3]]<|/det|>"),
            "Legal text",
        )

    def test_gateway_authentication_uses_the_expected_bearer_key(self) -> None:
        self.assertTrue(has_valid_gateway_key("Bearer gateway-test-key", "gateway-test-key"))
        self.assertFalse(has_valid_gateway_key("Bearer wrong-key", "gateway-test-key"))

    def test_chat_completions_url_accepts_base_url_with_or_without_v1(self) -> None:
        self.assertEqual(
            chat_completions_url("https://ocr.example/v1"),
            "https://ocr.example/v1/chat/completions",
        )
        self.assertEqual(
            chat_completions_url("https://ocr.example"),
            "https://ocr.example/v1/chat/completions",
        )

    def test_recognize_pdf_pages_renders_requested_page_and_calls_model_recipe(self) -> None:
        calls: list[tuple[Request, dict[str, object], int]] = []

        def fake_opener(request: Request, timeout: int) -> io.BytesIO:
            payload = json.loads(request.data.decode("utf-8"))
            calls.append((request, payload, timeout))
            response = {
                "choices": [
                    {"message": {"content": "<|ref|>Recognized page<|/ref|><|det|>box<|/det|>"}}
                ]
            }
            return io.BytesIO(json.dumps(response).encode("utf-8"))

        result = recognize_pdf_pages(make_pdf(), [1], self.settings, fake_opener)

        self.assertEqual(result, [{"page_number": 1, "text": "Recognized page"}])
        request, payload, timeout = calls[0]
        self.assertEqual(request.full_url, "http://localhost:8000/v1/chat/completions")
        self.assertEqual(request.get_header("Authorization"), "Bearer model-test-key")
        self.assertEqual(timeout, 120)
        self.assertEqual(payload["skip_special_tokens"], False)
        self.assertEqual(payload["vllm_xargs"], {"ngram_size": 35, "window_size": 128})
        content = payload["messages"][0]["content"]
        self.assertTrue(content[1]["image_url"]["url"].startswith("data:image/png;base64,"))

    def test_recognize_pdf_pages_rejects_invalid_pdf_and_out_of_range_page(self) -> None:
        with self.assertRaises(GatewayError):
            recognize_pdf_pages(b"not a PDF", [1], self.settings)
        with self.assertRaises(GatewayError):
            recognize_pdf_pages(make_pdf(), [2], self.settings)

    def test_recognize_pdf_pages_rejects_excessive_page_dimensions(self) -> None:
        with self.assertRaises(GatewayError) as error:
            recognize_pdf_pages(make_pdf(width=10_000, height=10_000), [1], self.settings)
        self.assertEqual(error.exception.status, 413)


if __name__ == "__main__":
    unittest.main()
