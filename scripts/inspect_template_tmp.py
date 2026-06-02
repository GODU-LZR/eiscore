# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

﻿from docx import Document
from pathlib import Path
p = Path(r"C:/Users/Twist/Desktop/school_template_2015_design.docx")
print('exists', p.exists(), p)
d = Document(str(p))
print('paras', len(d.paragraphs))
print('tables', len(d.tables))
print('sections', len(d.sections))
for i, para in enumerate(d.paragraphs[:120]):
    t = para.text.strip()
    if t:
        print(i, repr(t), para.style.name)
