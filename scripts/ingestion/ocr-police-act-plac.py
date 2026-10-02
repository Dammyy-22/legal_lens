from pathlib import Path
import json
import subprocess
import sys
import fitz


ROOT = Path(__file__).resolve().parent

PDF = (
    ROOT
    / ".."
    / ".."
    / "legal corpus"
    / "Police-Act-2020-PLAC.pdf"
).resolve()

OUTPUT = (
    ROOT
    / "normalized-corpus"
    / "police-ocr"
).resolve()

PAGES_DIR = OUTPUT / "pages"

OUTPUT.mkdir(parents=True, exist_ok=True)
PAGES_DIR.mkdir(parents=True, exist_ok=True)


def find_tesseract():
    candidates = [
        Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
        Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    try:
        result = subprocess.run(
            ["where.exe", "tesseract"],
            capture_output=True,
            text=True,
            check=True,
        )

        first = result.stdout.strip().splitlines()[0]

        if first:
            return Path(first)

    except Exception:
        pass

    return None


def ocr_page(tesseract, image_path):
    result = subprocess.run(
        [
            str(tesseract),
            str(image_path),
            "stdout",
            "-l",
            "eng",
            "--psm",
            "6",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"Tesseract failed:\n{result.stderr}"
        )

    return result.stdout


def main():
    print("=" * 50)
    print("POLICE ACT — PLAC OCR")
    print("=" * 50)

    if not PDF.exists():
        raise FileNotFoundError(
            f"PDF not found:\n{PDF}"
        )

    tesseract = find_tesseract()

    if not tesseract:
        raise RuntimeError(
            "Tesseract was not found.\n"
            "Install Tesseract and restart PowerShell."
        )

    print(f"Tesseract: {tesseract}")
    print(f"PDF:       {PDF}")
    print(f"Output:    {OUTPUT}")

    document = fitz.open(PDF)

    print(f"\nPages: {len(document)}")

    manifest = {
        "source_file": PDF.name,
        "source_path": str(PDF),
        "pages": len(document),
        "ocr_engine": "Tesseract",
        "language": "eng",
        "psm": 6,
        "pages_output": [],
    }

    combined = []

    for index, page in enumerate(document):
        page_number = index + 1

        print(
            f"\n[{page_number}/{len(document)}] "
            "Rendering page..."
        )

        pixmap = page.get_pixmap(
            matrix=fitz.Matrix(2.5, 2.5),
            alpha=False,
        )

        image_path = (
            PAGES_DIR
            / f"page-{page_number:03d}.png"
        )

        text_path = (
            PAGES_DIR
            / f"page-{page_number:03d}.txt"
        )

        pixmap.save(image_path)

        print("  OCR...")

        text = ocr_page(
            tesseract,
            image_path,
        )

        text = text.replace("\r\n", "\n")
        text = text.replace("\r", "\n")

        text_path.write_text(
            text,
            encoding="utf-8",
        )

        combined.append(
            f"\n\n===== PAGE {page_number} =====\n\n"
        )
        combined.append(text)

        manifest["pages_output"].append(
            {
                "page": page_number,
                "image": image_path.name,
                "text": text_path.name,
                "characters": len(text),
                "words": len(text.split()),
            }
        )

    document.close()

    combined_path = (
        OUTPUT
        / "Police-Act-2020-PLAC.ocr.txt"
    )

    combined_path.write_text(
        "".join(combined),
        encoding="utf-8",
    )

    manifest_path = (
        OUTPUT
        / "Police-Act-2020-PLAC.ocr-manifest.json"
    )

    manifest_path.write_text(
        json.dumps(
            manifest,
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    total_chars = sum(
        item["characters"]
        for item in manifest["pages_output"]
    )

    total_words = sum(
        item["words"]
        for item in manifest["pages_output"]
    )

    print("\n" + "=" * 50)
    print("OCR COMPLETE")
    print("=" * 50)

    print(f"Pages:      {len(document) if False else len(manifest['pages_output'])}")
    print(f"Characters: {total_chars:,}")
    print(f"Words:      {total_words:,}")

    print("\nCombined OCR:")
    print(combined_path)

    print("\nManifest:")
    print(manifest_path)

    print("\nPage files:")
    print(PAGES_DIR)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("\nERROR:")
        print(error)
        sys.exit(1)