# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

from docx import Document
from pathlib import Path

p = Path(r"C:\Users\Twist\Desktop\论文\主稿\毕业论文初稿v2.8_降风险修订版_2026-04-06.docx")
doc = Document(str(p))
want = {9, 16, 25, 29, 32, 38, 44, 49, 51}

for i, para in enumerate(doc.paragraphs, start=1):
    if i in want:
        print(f"\n===== PARA {i} =====")
        print(para.text.strip().replace("\n", " "))
