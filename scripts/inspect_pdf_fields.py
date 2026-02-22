#!/usr/bin/env python3
"""
List AcroForm field names for PDF form templates.
Run from project root: uv run python scripts/inspect_pdf_fields.py [template.pdf]
"""

from pathlib import Path
import sys

def inspect_pdf(path: Path) -> None:
    try:
        from pypdf import PdfReader
    except ImportError:
        print("Run: uv add pypdf (or pip install pypdf)")
        sys.exit(1)

    reader = PdfReader(str(path))
    fields = reader.get_fields()
    if not fields:
        print(f"No AcroForm fields in {path.name}")
        return

    print(f"\n--- {path.name} ---")
    for name, field in fields.items():
        ft = field.get("/FT", "?")
        t = field.get("/T", "?")
        v = field.get("/V", "")
        print(f"  {name!r}  FT={ft}  T={t!r}  V={v!r}")

def main():
    root = Path(__file__).resolve().parent.parent
    templates_dir = root / "files" / "form_templates"
    if not templates_dir.exists():
        print(f"Templates dir not found: {templates_dir}")
        sys.exit(1)

    args = sys.argv[1:]
    if args:
        paths = [templates_dir / a for a in args]
        paths = [p for p in paths if p.exists()]
        if not paths:
            print(f"No matching files in {templates_dir}")
            sys.exit(1)
    else:
        paths = sorted(templates_dir.glob("*.pdf"))

    for p in paths:
        inspect_pdf(p)

if __name__ == "__main__":
    main()
