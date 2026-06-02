# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 2400, 1450


def font(size, bold=False):
    base = "/mnt/c/Windows/Fonts/"
    name = "msyhbd.ttc" if bold else "msyh.ttc"
    return ImageFont.truetype(base + name, size)


F_TITLE = font(36, True)
F_BOUND = font(28, True)
F_LABEL = font(28, False)
F_ACTOR = font(24, False)


def centered(draw, box, text, fnt, gap=6):
    x1, y1, x2, y2 = box
    lines = text.split("\n")
    h0 = draw.textbbox((0, 0), "测", font=fnt)[3]
    total = len(lines) * h0 + (len(lines) - 1) * gap
    y = y1 + (y2 - y1 - total) / 2
    for line in lines:
        bb = draw.textbbox((0, 0), line, font=fnt)
        tw = bb[2] - bb[0]
        draw.text((x1 + (x2 - x1 - tw) / 2, y), line, font=fnt, fill="black")
        y += h0 + gap


def actor(draw, cx, cy, name):
    r = 16
    draw.ellipse((cx - r, cy - 90, cx + r, cy - 58), outline="black", width=3)
    draw.line((cx, cy - 58, cx, cy - 5), fill="black", width=3)
    draw.line((cx - 34, cy - 34, cx + 34, cy - 34), fill="black", width=3)
    draw.line((cx, cy - 5, cx - 30, cy + 42), fill="black", width=3)
    draw.line((cx, cy - 5, cx + 30, cy + 42), fill="black", width=3)
    bb = draw.textbbox((0, 0), name, font=F_ACTOR)
    draw.text((cx - (bb[2] - bb[0]) / 2, cy + 56), name, font=F_ACTOR, fill="black")


def usecase(draw, x, y, w, h, text):
    draw.ellipse((x, y, x + w, y + h), outline="black", width=3, fill="white")
    centered(draw, (x + 15, y + 10, x + w - 15, y + h - 10), text, F_LABEL)


def assoc(draw, p1, p2):
    draw.line((p1[0], p1[1], p2[0], p2[1]), fill="black", width=2)


img = Image.new("RGB", (W, H), "white")
draw = ImageDraw.Draw(img)

title = "图3-3 仓储与库存作业用例图"
bb = draw.textbbox((0, 0), title, font=F_TITLE)
draw.text(((W - (bb[2] - bb[0])) / 2, 28), title, font=F_TITLE, fill="black")

# system boundary
bx1, by1, bx2, by2 = 360, 150, 2050, 1240
draw.rectangle((bx1, by1, bx2, by2), outline="black", width=3)
bound_title = "EISCore仓储与库存作业"
draw.rectangle((940, 140, 1470, 200), fill="white")
bb = draw.textbbox((0, 0), bound_title, font=F_BOUND)
draw.text(((W - (bb[2] - bb[0])) / 2, 152), bound_title, font=F_BOUND, fill="black")

# actors
actor(draw, 130, 390, "仓管员")
actor(draw, 130, 860, "生产主管")
actor(draw, 2270, 360, "销售文员")
actor(draw, 2270, 920, "系统管理员")

# left use cases
left_cases = {
    "领料": (560, 250, 430, 110, "生产领料"),
    "补料": (560, 500, 430, 110, "生产补料"),
    "入库": (560, 750, 430, 110, "生产入库"),
}

# right use cases ordered to reduce crossings
right_cases = {
    "台账": (1420, 230, 430, 110, "库存台账查询"),
    "出库": (1420, 430, 430, 110, "销售出库"),
    "批次": (1420, 660, 430, 110, "批次与保质期查看"),
    "预警": (1420, 900, 430, 110, "库存预警与状态核对"),
}

for v in list(left_cases.values()) + list(right_cases.values()):
    usecase(draw, *v)

# left associations
assoc(draw, (165, 340), (560, 305))   # 仓管员-生产领料
assoc(draw, (165, 370), (560, 555))   # 仓管员-生产补料
assoc(draw, (165, 810), (560, 805))   # 生产主管-生产入库
assoc(draw, (165, 840), (560, 555))   # 生产主管-生产补料

# right associations - prioritized non-crossing
assoc(draw, (2235, 310), (1850, 285))  # 销售文员-库存台账查询
assoc(draw, (2235, 340), (1850, 485))  # 销售文员-销售出库
assoc(draw, (2235, 870), (1850, 715))  # 系统管理员-批次与保质期查看
assoc(draw, (2235, 900), (1850, 955))  # 系统管理员-库存预警与状态核对
assoc(draw, (2235, 930), (1850, 285))  # 系统管理员-库存台账查询

out = Path("/home/lzr/eiscore/docs/diagrams/图3-3_仓储与库存作业用例图_候选版5.png")
img.save(out, dpi=(300, 300))
print(out)
