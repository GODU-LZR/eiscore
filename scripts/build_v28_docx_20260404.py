# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

from pathlib import Path
import re
import shutil
import subprocess


ROOT = Path(r"\\wsl.localhost\Ubuntu\home\lzr\eiscore")
DOCS = ROOT / "docs"
SRC = DOCS / "毕业论文初稿v2.8_老师批注终修版_2026-04-04.md"
TMP = DOCS / "_build_v28_2026-04-04.md"
OUT = DOCS / "毕业论文初稿v2.8_老师批注终修版_2026-04-04.docx"
DESKTOP_OUT = Path(r"C:\Users\Twist\Desktop\论文\主稿\毕业论文初稿v2.8_老师批注终修版_2026-04-04.docx")
DESKTOP_PNG = Path(r"C:\Users\Twist\Desktop\论文\图_PNG_正式")
REF_DOC = DOCS / "毕业论文初稿v2.8_老师批注复核版_2026-04-03.docx"


SPECIAL_PNG = {
    "图1-1_论文研究思路与技术路线图.svg": "图1-1_论文研究思路与技术路线图_Word横版.png",
}


WIDTH_MAP = {
    "图1-1": "15.8cm",
    "图3-6": "15.8cm",
    "图4-1": "15.8cm",
    "图4-3": "15.8cm",
    "图4-4": "15.8cm",
    "图5-1": "15.8cm",
    "图3-2": "15cm",
    "图3-3": "15cm",
    "图3-4": "15cm",
    "图3-5": "15cm",
    "图3-7": "15cm",
    "图3-8": "15cm",
    "图6-1": "15.2cm",
    "图6-2": "15.2cm",
    "图6-3": "15.2cm",
    "图6-4": "15.2cm",
}


FIG_RE = re.compile(r"见(图\d+-\d+)\s*\[(.*?)\]\((.*?)\)。")


def convert_image_line(match: re.Match[str]) -> str:
    fig_no = match.group(1)
    label = match.group(2)
    src_path = Path(match.group(3))
    png_name = SPECIAL_PNG.get(src_path.name, src_path.with_suffix(".png").name)
    png_path = DESKTOP_PNG / png_name
    if not png_path.exists():
        fallback = DESKTOP_PNG / src_path.with_suffix(".png").name
        if fallback.exists():
            png_path = fallback
    width = WIDTH_MAP.get(fig_no, "15cm")
    caption = label.replace("_", " ")
    return f"见{fig_no}。\n\n![{caption}]({png_path.as_posix()}){{ width={width} }}\n"


def preprocess() -> None:
    text = SRC.read_text(encoding="utf-8")
    text = FIG_RE.sub(convert_image_line, text)
    TMP.write_text(text, encoding="utf-8")


def export_docx() -> None:
    cmd = [
        "pandoc",
        str(TMP),
        "-o",
        str(OUT),
        "--reference-doc",
        str(REF_DOC),
    ]
    subprocess.run(cmd, check=True)
    DESKTOP_OUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(OUT, DESKTOP_OUT)


if __name__ == "__main__":
    preprocess()
    export_docx()
    print(OUT)
