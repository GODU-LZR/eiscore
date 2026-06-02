# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


W, H = 2600, 1300
LEFT = 140
TOP = 120
LANE_W = 230
CONTENT_LEFT = LEFT + LANE_W
RIGHT = 2450
BOTTOM = 1180
LANE_H = 190


def font(size, bold=False):
    base = "/mnt/c/Windows/Fonts/"
    name = "msyhbd.ttc" if bold else "msyh.ttc"
    return ImageFont.truetype(base + name, size)


F_TITLE = font(34, True)
F_LANE = font(28, True)
F_BOX = font(26, False)
F_SMALL = font(22, False)


def wrap(draw, text, fnt, max_w):
    parts = []
    cur = ""
    for ch in text:
        trial = cur + ch
        if draw.textbbox((0, 0), trial, font=fnt)[2] <= max_w:
            cur = trial
        else:
            if cur:
                parts.append(cur)
            cur = ch
    if cur:
        parts.append(cur)
    return parts


def draw_centered_text(draw, box, text, fnt, fill="black", line_gap=8):
    x1, y1, x2, y2 = box
    lines = []
    for raw in text.split("\n"):
        lines.extend(wrap(draw, raw, fnt, x2 - x1 - 20) or [""])
    b = draw.textbbox((0, 0), "测", font=fnt)
    lh = b[3] - b[1]
    total = len(lines) * lh + (len(lines) - 1) * line_gap
    y = y1 + (y2 - y1 - total) / 2
    for line in lines:
        bb = draw.textbbox((0, 0), line, font=fnt)
        tw = bb[2] - bb[0]
        draw.text((x1 + (x2 - x1 - tw) / 2, y), line, font=fnt, fill=fill)
        y += lh + line_gap


def box(draw, x, y, w, h, text):
    draw.rounded_rectangle((x, y, x + w, y + h), radius=18, outline="black", width=3, fill="white")
    draw_centered_text(draw, (x, y, x + w, y + h), text, F_BOX)


def arrow(draw, p1, p2):
    x1, y1 = p1
    x2, y2 = p2
    draw.line((x1, y1, x2, y2), fill="black", width=3)
    if x2 >= x1:
        draw.polygon([(x2, y2), (x2 - 16, y2 - 8), (x2 - 16, y2 + 8)], fill="black")
    else:
        draw.polygon([(x2, y2), (x2 + 16, y2 - 8), (x2 + 16, y2 + 8)], fill="black")


def connector(draw, p1, p2):
    x1, y1 = p1
    x2, y2 = p2
    midx = (x1 + x2) / 2
    draw.line((x1, y1, midx, y1), fill="black", width=3)
    draw.line((midx, y1, midx, y2), fill="black", width=3)
    arrow(draw, (midx, y2), (x2, y2))


img = Image.new("RGB", (W, H), "white")
draw = ImageDraw.Draw(img)

title = "图3-1 南派食品现有产销协同业务流程图"
tb = draw.textbbox((0, 0), title, font=F_TITLE)
draw.text(((W - (tb[2]-tb[0]))/2, 35), title, font=F_TITLE, fill="black")

lanes = [
    "销售与计划",
    "采购与仓储",
    "生产执行",
    "质量控制",
    "发货与交付",
]

for i, lane in enumerate(lanes):
    y = TOP + i * LANE_H
    draw.rectangle((LEFT, y, RIGHT, y + LANE_H), outline="black", width=2)
    draw.rectangle((LEFT, y, LEFT + LANE_W, y + LANE_H), outline="black", width=2, fill="#f7f7f7")
    draw_centered_text(draw, (LEFT + 10, y + 10, LEFT + LANE_W - 10, y + LANE_H - 10), lane, F_LANE)

# boxes
box(draw, 430, TOP + 40, 260, 84, "销售合同\n销售订单创建")
box(draw, 760, TOP + 40, 260, 84, "PMC确认库存\n下达计划")

box(draw, 1090, TOP + LANE_H + 40, 260, 84, "缺料分析\n采购订单")
box(draw, 1420, TOP + LANE_H + 40, 260, 84, "到货登记\n采购入库")

box(draw, 1090, TOP + 2*LANE_H + 40, 260, 84, "生产领料")
box(draw, 1420, TOP + 2*LANE_H + 40, 260, 84, "补料 / 报工")
box(draw, 1750, TOP + 2*LANE_H + 40, 260, 84, "完工入库")

box(draw, 1750, TOP + 3*LANE_H + 40, 260, 84, "来料/过程/出货检验\nIQC / IPQC / OQC")

box(draw, 2080, TOP + 4*LANE_H + 40, 260, 84, "发货通知\n销售出库")
box(draw, 2080, TOP + 4*LANE_H + 145, 260, 84, "物流登记\n客户交付")

# main connectors
arrow(draw, (690, TOP + 82), (760, TOP + 82))
connector(draw, (1020, TOP + 82), (1090, TOP + LANE_H + 82))
arrow(draw, (1350, TOP + LANE_H + 82), (1420, TOP + LANE_H + 82))
connector(draw, (1680, TOP + LANE_H + 82), (1090, TOP + 2*LANE_H + 82))
arrow(draw, (1350, TOP + 2*LANE_H + 82), (1420, TOP + 2*LANE_H + 82))
arrow(draw, (1680, TOP + 2*LANE_H + 82), (1750, TOP + 2*LANE_H + 82))
connector(draw, (1880, TOP + 2*LANE_H + 124), (1750, TOP + 3*LANE_H + 82))
connector(draw, (2010, TOP + 3*LANE_H + 124), (2080, TOP + 4*LANE_H + 82))
arrow(draw, (2210, TOP + 4*LANE_H + 124), (2210, TOP + 4*LANE_H + 145))

# pain point notes bottom
for x, text in [
    (410, "问题1：单据分散\n销售、计划与库存状态\n主要依赖人工沟通"),
    (1080, "问题2：批次与保质期管理\n采购入库、领料与完工入库\n之间容易脱节"),
    (1750, "问题3：质检、补料与状态写回\n仍需依赖纸单和补录\n流程联动不够稳定"),
]:
    draw.rounded_rectangle((x, 1080, x + 420, 1260), radius=18, outline="black", width=2, fill="white")
    draw_centered_text(draw, (x, 1080, x + 420, 1260), text, F_SMALL)

out = Path("/home/lzr/eiscore/docs/diagrams/图3-1_南派食品供应链与生产协同泳道图_候选版2.png")
img.save(out, dpi=(300, 300))
print(out)
