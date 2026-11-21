#!/usr/bin/env python3
"""Lightweight static checks for HanyaGo's HTML/JS repository. No dependencies."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
ERRORS = []

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.inline_scripts = []
        self._in_script = False
        self._script_src = None
        self._script_parts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for attr in ("href", "src"):
            value = attrs.get(attr)
            if value:
                self.refs.append(value)
        if tag.lower() == "script":
            self._in_script = True
            self._script_src = attrs.get("src")
            self._script_parts = []

    def handle_data(self, data):
        if self._in_script and not self._script_src:
            self._script_parts.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "script" and self._in_script:
            if not self._script_src:
                self.inline_scripts.append("".join(self._script_parts))
            self._in_script = False
            self._script_src = None
            self._script_parts = []

def check_reference(page, ref):
    ref = ref.strip()
    if not ref or ref.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
        return
    parsed = urlparse(ref)
    if parsed.scheme or parsed.netloc:
        return
    target = unquote(parsed.path)
    if not target:
        return
    resolved = (page.parent / target).resolve() if not target.startswith("/") else (ROOT / target.lstrip("/")).resolve()
    try:
        resolved.relative_to(ROOT)
    except ValueError:
        ERRORS.append(f"{page.relative_to(ROOT)}: reference escapes repository: {ref}")
        return
    if not resolved.exists():
        ERRORS.append(f"{page.relative_to(ROOT)}: missing internal reference: {ref}")

html_files = sorted(ROOT.rglob("*.html"))
for page in html_files:
    parser = PageParser()
    try:
        parser.feed(page.read_text(encoding="utf-8"))
    except Exception as exc:
        ERRORS.append(f"{page.relative_to(ROOT)}: HTML parser error: {exc}")
        continue
    for ref in parser.refs:
        check_reference(page, ref)
    for index, code in enumerate(parser.inline_scripts, start=1):
        if not code.strip():
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8") as temp:
            temp.write(code)
            temp.flush()
            result = subprocess.run(["node", "--check", temp.name], capture_output=True, text=True)
            if result.returncode:
                ERRORS.append(f"{page.relative_to(ROOT)}: inline script {index} syntax error:\n{result.stderr.strip()}")

if ERRORS:
    print("HanyaGo quality checks FAILED:")
    for error in ERRORS:
        print(" - " + error)
    raise SystemExit(1)
print(f"Passed: {len(html_files)} HTML pages checked for internal references and inline JS syntax.")
