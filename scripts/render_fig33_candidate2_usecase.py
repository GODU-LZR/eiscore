# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 2400, 1300


def font(size, bold=False):
    base = "/mnt/c/Windows/Fonts/"
    name = "msyhbd.ttc" if bold else "msyh.ttc"
    return ImageFont.truetype(base + name, size)


F_TITLE = font(34, True)
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
draw.text(((W - (bb[2] - bb[0])) / 2, 35), title, font=F_TITLE, fill="black")

# actors
actor(draw, 170, 340, "仓管员")
actor(draw, 170, 760, "生产主管")
actor(draw, 2230, 360, "销售文员")
actor(draw, 2230, 770, "系统管理员")

# use cases
cases = {
    "领料": (500, 220, 430, 110, "生产领料"),
    "补料": (500, 410, 430, 110, "生产补料"),
    "入库": (500, 600, 430, 110, "生产入库"),
    "出库": (500, 790, 430, 110, "销售出库"),
    "台账": (1450, 220, 470, 110, "库存台账查询"),
    "批次": (1450, 455, 470, 110, "批次与保质期查看"),
    "预警": (1450, 690, 470, 110, "库存预警与状态核对"),
}

for v in cases.values():
    usecase(draw, *v)

# left actor associations
assoc(draw, (205, 290), (500, 275))   # 仓管员-生产领料
assoc(draw, (205, 320), (500, 465))   # 仓管员-生产补料
assoc(draw, (205, 700), (500, 655))   # 生产主管-生产入库
assoc(draw, (205, 730), (500, 465))   # 生产主管-生产补料

# right actor associations - no crossing
assoc(draw, (2195, 310), (1920, 275))  # 销售文员-库存台账查询
assoc(draw, (2195, 330), (1920, 845))  # 销售文员-销售出库
assoc(draw, (2195, 720), (1920, 510))  # 系统管理员-批次与保质期查看
assoc(draw, (2195, 740), (1920, 745))  # 系统管理员-库存预警与状态核对
assoc(draw, (2195, 760), (1920, 275))  # 系统管理员-库存台账查询

out = Path("/home/lzr/eiscore/docs/diagrams/图3-3_仓储与库存作业用例图_候选版2.png")
img.save(out, dpi=(300, 300))
print(out)
