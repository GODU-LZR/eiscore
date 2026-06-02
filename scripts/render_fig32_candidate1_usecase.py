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
F_LABEL = font(26, False)
F_ACTOR = font(24, False)
F_EDGE = font(22, False)


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
    draw.text((cx - (bb[2]-bb[0])/2, cy + 56), name, font=F_ACTOR, fill="black")


def usecase(draw, x, y, w, h, text):
    draw.ellipse((x, y, x + w, y + h), outline="black", width=3, fill="white")
    centered(draw, (x + 15, y + 10, x + w - 15, y + h - 10), text, F_LABEL)


def assoc(draw, p1, p2):
    draw.line((p1[0], p1[1], p2[0], p2[1]), fill="black", width=2)


def dep(draw, p1, p2, label):
    draw.line((p1[0], p1[1], p2[0], p2[1]), fill="black", width=2)
    # arrow head at p2
    x2, y2 = p2
    x1, y1 = p1
    dx = x2 - x1
    dy = y2 - y1
    length = (dx * dx + dy * dy) ** 0.5 or 1
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    a = (x2, y2)
    b = (x2 - 18 * ux + 8 * px, y2 - 18 * uy + 8 * py)
    c = (x2 - 18 * ux - 8 * px, y2 - 18 * uy - 8 * py)
    draw.polygon([a, b, c], fill="black")
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    bb = draw.textbbox((0, 0), label, font=F_EDGE)
    tw = bb[2] - bb[0]
    th = bb[3] - bb[1]
    draw.rectangle((mx - tw/2 - 6, my - th/2 - 4, mx + tw/2 + 6, my + th/2 + 4), fill="white")
    draw.text((mx - tw/2, my - th/2), label, font=F_EDGE, fill="black")


img = Image.new("RGB", (W, H), "white")
draw = ImageDraw.Draw(img)

title = "图3-2 销售计划与采购用例图"
bb = draw.textbbox((0, 0), title, font=F_TITLE)
draw.text(((W - (bb[2]-bb[0]))/2, 35), title, font=F_TITLE, fill="black")

# actors
actor(draw, 170, 360, "销售文员")
actor(draw, 170, 780, "PMC计划员")
actor(draw, 2230, 570, "采购员")

# left use cases
uc = {
    "合同": (520, 130, 420, 110, "销售合同维护"),
    "订单": (520, 300, 420, 110, "销售订单生成"),
    "下推": (520, 470, 420, 110, "订单下推计划"),
    "核对": (520, 640, 420, 110, "库存核对与发货判断"),
    "缺料": (520, 810, 420, 110, "生产计划与缺料分析"),
}
for v in uc.values():
    usecase(draw, *v)

# right use cases
rc = {
    "需求": (1420, 360, 460, 110, "采购需求生成"),
    "订单下达": (1420, 560, 460, 110, "采购订单下达"),
    "跟踪": (1420, 760, 460, 110, "到货跟踪与交期维护"),
}
for v in rc.values():
    usecase(draw, *v)

# actor associations no arrow
assoc(draw, (205, 305), (520, 185))
assoc(draw, (205, 325), (520, 355))
assoc(draw, (205, 345), (520, 525))
assoc(draw, (205, 730), (520, 525))
assoc(draw, (205, 750), (520, 695))
assoc(draw, (205, 770), (520, 865))

assoc(draw, (2195, 520), (1880, 415))
assoc(draw, (2195, 550), (1880, 615))
assoc(draw, (2195, 580), (1880, 815))

# dependencies between use cases
dep(draw, (940, 525), (1420, 415), "缺料时触发")
dep(draw, (940, 865), (1420, 615), "生成采购需求")

out = Path("/home/lzr/eiscore/docs/diagrams/图3-2_销售计划与采购用例图_候选版1.png")
img.save(out, dpi=(300, 300))
print(out)
