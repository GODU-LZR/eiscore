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

title = "图3-3 仓储与库存作业用例图"
bb = draw.textbbox((0, 0), title, font=F_TITLE)
draw.text(((W - (bb[2]-bb[0]))/2, 35), title, font=F_TITLE, fill="black")

actor(draw, 170, 330, "仓管员")
actor(draw, 170, 720, "生产主管")
actor(draw, 2230, 470, "销售文员")
actor(draw, 2230, 840, "系统管理员")

left = {
    "领料": (500, 220, 440, 110, "生产领料"),
    "补料": (500, 410, 440, 110, "生产补料"),
    "入库": (500, 600, 440, 110, "生产入库"),
    "出库": (500, 790, 440, 110, "销售出库"),
}
for v in left.values():
    usecase(draw, *v)

right = {
    "台账": (1460, 260, 460, 110, "库存台账查询"),
    "批次": (1460, 480, 460, 110, "批次与保质期查看"),
    "预警": (1460, 700, 460, 110, "库存预警与状态核对"),
}
for v in right.values():
    usecase(draw, *v)

# associations
assoc(draw, (205, 280), (500, 275))
assoc(draw, (205, 300), (500, 465))
assoc(draw, (205, 670), (500, 465))
assoc(draw, (205, 690), (500, 655))
assoc(draw, (2195, 420), (1920, 845))
assoc(draw, (2195, 790), (1920, 315))
assoc(draw, (2195, 810), (1920, 535))
assoc(draw, (2195, 830), (1920, 755))

# dependencies
dep(draw, (940, 655), (1460, 315), "入库后更新")
dep(draw, (940, 845), (1460, 535), "出库时核对")
dep(draw, (940, 465), (1460, 755), "补料影响库存")

out = Path("/home/lzr/eiscore/docs/diagrams/图3-3_仓储与库存作业用例图_候选版1.png")
img.save(out, dpi=(300, 300))
print(out)
