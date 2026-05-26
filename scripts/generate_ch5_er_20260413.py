from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_PNG = ROOT / "docs" / "diagrams" / "图5-1_EISCore核心数据实体关系图.png"
OUT_SVG = ROOT / "docs" / "diagrams" / "图5-1_EISCore核心数据实体关系图.svg"

WIN_FONT = Path(r"C:\Windows\Fonts\msyh.ttc")
FALLBACK_FONT = Path(r"C:\Windows\Fonts\simhei.ttf")

W = 2200
H = 1550
MARGIN = 80


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in (WIN_FONT, FALLBACK_FONT):
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


TITLE_FONT = load_font(34)
NODE_FONT = load_font(24)
SMALL_FONT = load_font(21)


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> tuple[int, int]:
    bbox = draw.multiline_textbbox((0, 0), text, font=font, spacing=4, align="center")
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def draw_center_text(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, font):
    x1, y1, x2, y2 = box
    tw, th = text_size(draw, text, font)
    draw.multiline_text(
        ((x1 + x2 - tw) / 2, (y1 + y2 - th) / 2),
        text,
        fill="black",
        font=font,
        spacing=4,
        align="center",
    )


def draw_entity(draw, box, text):
    draw.rounded_rectangle(box, radius=14, outline="black", width=3, fill="white")
    draw_center_text(draw, box, text, NODE_FONT)


def draw_attribute(draw, box, text):
    draw.ellipse(box, outline="black", width=3, fill="white")
    draw_center_text(draw, box, text, SMALL_FONT)


def draw_relation(draw, box, text):
    cx = (box[0] + box[2]) / 2
    cy = (box[1] + box[3]) / 2
    pts = [(cx, box[1]), (box[2], cy), (cx, box[3]), (box[0], cy)]
    draw.polygon(pts, outline="black", fill="white", width=3)
    draw_center_text(draw, box, text, SMALL_FONT)


def center(box):
    return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)


def line(draw, p1, p2, width=2):
    draw.line([p1, p2], fill="black", width=width)


def build_layout():
    # three clusters in a Chen-style ER layout
    # cluster 1: org/permission
    dept = (180, 180, 360, 260)
    user = (510, 180, 690, 260)
    role = (840, 180, 1020, 260)
    r_belong = (380, 180, 490, 260)
    r_assign = (710, 180, 820, 260)
    pos = (510, 350, 690, 430)
    r_hold = (710, 350, 820, 430)

    # cluster 2: inventory
    material = (180, 650, 360, 730)
    warehouse = (840, 650, 1020, 730)
    batch = (510, 650, 690, 730)
    tx = (1170, 650, 1350, 730)
    r_store = (380, 650, 490, 730)
    r_form = (710, 650, 820, 730)
    r_record = (1040, 650, 1150, 730)

    # cluster 3: app/workflow
    category = (180, 1120, 360, 1200)
    app = (510, 1120, 690, 1200)
    definition = (840, 1120, 1020, 1200)
    instance = (1170, 1120, 1350, 1200)
    statemap = (1500, 1120, 1680, 1200)
    r_class = (380, 1120, 490, 1200)
    r_bind = (710, 1120, 820, 1200)
    r_run = (1040, 1120, 1150, 1200)
    r_write = (1370, 1120, 1480, 1200)

    attrs = {
        "dept_name": (90, 70, 250, 130),
        "dept_parent": (90, 280, 250, 340),
        "user_name": (470, 70, 630, 130),
        "user_status": (640, 70, 800, 130),
        "role_code": (890, 70, 1050, 130),
        "role_name": (1040, 180, 1200, 240),
        "pos_name": (690, 470, 850, 530),
        "mat_name": (70, 540, 230, 600),
        "mat_type": (70, 750, 230, 810),
        "wh_name": (960, 540, 1120, 600),
        "wh_level": (960, 750, 1120, 810),
        "batch_no": (470, 540, 630, 600),
        "batch_qty": (640, 540, 800, 600),
        "tx_type": (1260, 540, 1420, 600),
        "tx_qty": (1260, 750, 1420, 810),
        "app_name": (470, 1010, 630, 1070),
        "app_type": (640, 1010, 800, 1070),
        "def_name": (890, 1010, 1050, 1070),
        "inst_state": (1170, 1010, 1330, 1070),
        "state_col": (1500, 1010, 1660, 1070),
    }

    nodes = {
        "dept": ("entity", dept, "部门"),
        "user": ("entity", user, "用户"),
        "role": ("entity", role, "角色"),
        "pos": ("entity", pos, "岗位"),
        "r_belong": ("relation", r_belong, "归属"),
        "r_assign": ("relation", r_assign, "拥有"),
        "r_hold": ("relation", r_hold, "任职"),
        "material": ("entity", material, "物料"),
        "warehouse": ("entity", warehouse, "仓库"),
        "batch": ("entity", batch, "库存批次"),
        "tx": ("entity", tx, "库存流水"),
        "r_store": ("relation", r_store, "存放"),
        "r_form": ("relation", r_form, "形成"),
        "r_record": ("relation", r_record, "记录"),
        "category": ("entity", category, "应用分类"),
        "app": ("entity", app, "应用"),
        "definition": ("entity", definition, "流程定义"),
        "instance": ("entity", instance, "流程实例"),
        "statemap": ("entity", statemap, "状态映射"),
        "r_class": ("relation", r_class, "归类"),
        "r_bind": ("relation", r_bind, "绑定"),
        "r_run": ("relation", r_run, "运行"),
        "r_write": ("relation", r_write, "写回"),
        "dept_name": ("attr", attrs["dept_name"], "部门名称"),
        "dept_parent": ("attr", attrs["dept_parent"], "父部门"),
        "user_name": ("attr", attrs["user_name"], "用户名"),
        "user_status": ("attr", attrs["user_status"], "状态"),
        "role_code": ("attr", attrs["role_code"], "角色编码"),
        "role_name": ("attr", attrs["role_name"], "角色名称"),
        "pos_name": ("attr", attrs["pos_name"], "岗位名称"),
        "mat_name": ("attr", attrs["mat_name"], "物料名称"),
        "mat_type": ("attr", attrs["mat_type"], "物料分类"),
        "wh_name": ("attr", attrs["wh_name"], "仓库名称"),
        "wh_level": ("attr", attrs["wh_level"], "层级"),
        "batch_no": ("attr", attrs["batch_no"], "批次号"),
        "batch_qty": ("attr", attrs["batch_qty"], "可用数量"),
        "tx_type": ("attr", attrs["tx_type"], "事务类型"),
        "tx_qty": ("attr", attrs["tx_qty"], "变动数量"),
        "app_name": ("attr", attrs["app_name"], "应用名称"),
        "app_type": ("attr", attrs["app_type"], "应用类型"),
        "def_name": ("attr", attrs["def_name"], "流程名称"),
        "inst_state": ("attr", attrs["inst_state"], "实例状态"),
        "state_col": ("attr", attrs["state_col"], "状态字段"),
    }

    edges = [
        ("dept", "r_belong"), ("r_belong", "user"), ("user", "r_assign"), ("r_assign", "role"),
        ("pos", "r_hold"), ("r_hold", "user"),
        ("dept", "dept_name"), ("dept", "dept_parent"), ("user", "user_name"), ("user", "user_status"),
        ("role", "role_code"), ("role", "role_name"), ("pos", "pos_name"),
        ("material", "r_store"), ("r_store", "batch"), ("warehouse", "r_form"), ("r_form", "batch"),
        ("batch", "r_record"), ("r_record", "tx"),
        ("material", "mat_name"), ("material", "mat_type"), ("warehouse", "wh_name"), ("warehouse", "wh_level"),
        ("batch", "batch_no"), ("batch", "batch_qty"), ("tx", "tx_type"), ("tx", "tx_qty"),
        ("category", "r_class"), ("r_class", "app"), ("app", "r_bind"), ("r_bind", "definition"),
        ("definition", "r_run"), ("r_run", "instance"), ("definition", "r_write"), ("r_write", "statemap"),
        ("app", "app_name"), ("app", "app_type"), ("definition", "def_name"), ("instance", "inst_state"),
        ("statemap", "state_col"),
    ]
    return nodes, edges


def generate_png():
    img = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(img)
    title = "图5-1 EISCore核心数据实体关系图"
    tw, th = text_size(draw, title, TITLE_FONT)
    draw.text(((W - tw) / 2, 28), title, fill="black", font=TITLE_FONT)

    nodes, edges = build_layout()

    for kind, box, text in nodes.values():
        if kind == "entity":
            draw_entity(draw, box, text)
        elif kind == "relation":
            draw_relation(draw, box, text)
        else:
            draw_attribute(draw, box, text)

    for a, b in edges:
        line(draw, center(nodes[a][1]), center(nodes[b][1]), width=2)

    # cluster subtitles
    subtitles = [
        ("组织与权限主线", 600, 110),
        ("物料与仓储主线", 770, 580),
        ("应用与流程主线", 940, 1050),
    ]
    for text, x, y in subtitles:
        draw.text((x, y), text, fill="black", font=SMALL_FONT)

    img.save(OUT_PNG)


def svg_text(x, y, text, size, anchor="middle", weight="normal"):
    esc = escape(text)
    return f'<text x="{x}" y="{y}" font-family="Microsoft YaHei, SimHei, sans-serif" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}">{esc}</text>'


def svg_multiline_center(box, text, size):
    x1, y1, x2, y2 = box
    lines = text.split("\n")
    line_h = size + 6
    total = line_h * len(lines)
    ys = y1 + (y2 - y1 - total) / 2 + size
    x = (x1 + x2) / 2
    return "\n".join(svg_text(x, ys + i * line_h, line, size) for i, line in enumerate(lines))


def generate_svg():
    nodes, edges = build_layout()
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
        '<rect width="100%" height="100%" fill="white"/>',
        svg_text(W / 2, 60, "图5-1 EISCore核心数据实体关系图", 34, weight="bold"),
    ]

    for a, b in edges:
        x1, y1 = center(nodes[a][1])
        x2, y2 = center(nodes[b][1])
        parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="black" stroke-width="2"/>')

    for kind, box, text in nodes.values():
        x1, y1, x2, y2 = box
        if kind == "entity":
            rx = ry = 14
            parts.append(f'<rect x="{x1}" y="{y1}" width="{x2-x1}" height="{y2-y1}" rx="{rx}" ry="{ry}" fill="white" stroke="black" stroke-width="3"/>')
            parts.append(svg_multiline_center(box, text, 24))
        elif kind == "attr":
            cx, cy = center(box)
            rx = (x2 - x1) / 2
            ry = (y2 - y1) / 2
            parts.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="white" stroke="black" stroke-width="3"/>')
            parts.append(svg_multiline_center(box, text, 21))
        else:
            cx, cy = center(box)
            pts = f"{cx},{y1} {x2},{cy} {cx},{y2} {x1},{cy}"
            parts.append(f'<polygon points="{pts}" fill="white" stroke="black" stroke-width="3"/>')
            parts.append(svg_multiline_center(box, text, 21))

    for text, x, y in [("组织与权限主线", 600, 110), ("物料与仓储主线", 770, 580), ("应用与流程主线", 940, 1050)]:
        parts.append(svg_text(x, y, text, 21))

    parts.append("</svg>")
    OUT_SVG.write_text("\n".join(parts), encoding="utf-8")


def main():
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    generate_png()
    generate_svg()
    print(OUT_PNG)
    print(OUT_SVG)


if __name__ == "__main__":
    main()
