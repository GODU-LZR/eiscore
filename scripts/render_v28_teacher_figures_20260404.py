from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import shutil


ROOT = Path(r"\\wsl.localhost\Ubuntu\home\lzr\eiscore")
DIAGRAMS = ROOT / "docs" / "diagrams"
DESKTOP_PNG = Path(r"C:\Users\Twist\Desktop\论文\图_PNG_正式")
DESKTOP_SVG = Path(r"C:\Users\Twist\Desktop\论文\图_SVG_正式")

FONT_PATH = Path(r"C:\Windows\Fonts\msyh.ttc")
TITLE_FONT = ImageFont.truetype(str(FONT_PATH), 38)
TEXT_FONT = ImageFont.truetype(str(FONT_PATH), 28)
SMALL_FONT = ImageFont.truetype(str(FONT_PATH), 24)


def wrap_text(draw, text, font, max_width):
    lines = []
    for para in text.split("\n"):
        if not para:
            lines.append("")
            continue
        cur = ""
        for ch in para:
            trial = cur + ch
            if draw.textlength(trial, font=font) <= max_width:
                cur = trial
            else:
                if cur:
                    lines.append(cur)
                cur = ch
        if cur:
            lines.append(cur)
    return lines


def draw_box(draw, x1, y1, x2, y2, title, body, title_font=TEXT_FONT, body_font=SMALL_FONT):
    draw.rounded_rectangle((x1, y1, x2, y2), radius=18, outline="black", width=2, fill="white")
    center_x = (x1 + x2) / 2
    if title:
        draw.text((center_x, y1 + 10), title, font=title_font, fill="black", anchor="ma")
        body_top = y1 + 42
    else:
        body_top = y1 + 18
    lines = wrap_text(draw, body, body_font, (x2 - x1) - 24)
    line_h = body_font.size + 6
    total_h = len(lines) * line_h
    start_y = body_top + max(0, ((y2 - body_top) - total_h) / 2 - 4)
    for idx, line in enumerate(lines):
        draw.text((center_x, start_y + idx * line_h), line, font=body_font, fill="black", anchor="ma")


def arrow(draw, x1, y1, x2, y2):
    draw.line((x1, y1, x2, y2), fill="black", width=2)
    if x1 == x2:
        # vertical
        draw.polygon([(x2, y2), (x2 - 6, y2 - 12), (x2 + 6, y2 - 12)], fill="black")
    elif y1 == y2:
        # horizontal
        draw.polygon([(x2, y2), (x2 - 12, y2 - 6), (x2 - 12, y2 + 6)], fill="black")


def save_svg(path: Path, content: str):
    path.write_text(content, encoding="utf-8")
    shutil.copy2(path, DESKTOP_SVG / path.name)


def save_png(path: Path, img: Image.Image):
    img.save(path, format="PNG")
    shutil.copy2(path, DESKTOP_PNG / path.name)


def render_fig36():
    width, height = 2200, 980
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)
    draw.text((width / 2, 58), "图3-6 EISCore总体功能结构图", font=TITLE_FONT, fill="black", anchor="ma")

    root = (935, 120, 1265, 205)
    core = (420, 280, 980, 365)
    support = (1220, 280, 1780, 365)
    hr = (120, 450, 520, 570)
    scm = (600, 450, 1000, 570)
    app = (1080, 450, 1480, 570)
    mobile = (1560, 450, 1960, 570)
    master = (420, 690, 900, 810)
    flow = (940, 690, 1420, 810)
    semantic = (1460, 690, 1940, 810)

    draw_box(draw, *root, "", "EISCore系统", body_font=TEXT_FONT)
    draw_box(draw, *core, "", "核心业务域", body_font=TEXT_FONT)
    draw_box(draw, *support, "", "支撑能力域", body_font=TEXT_FONT)
    draw_box(draw, *hr, "人事管理", "员工档案 / 组织结构 / 考勤")
    draw_box(draw, *scm, "物料与仓储", "物料主数据 / 库存 / 出入库 / 盘点")
    draw_box(draw, *app, "应用中心", "数据应用 / 流程设计 / 审批 / 闪念应用")
    draw_box(draw, *mobile, "移动端", "扫码 / 盘点 / 冷库模式")
    draw_box(draw, *master, "主数据与权限支撑", "组织 / 岗位 / 角色 / RLS")
    draw_box(draw, *flow, "流程与状态支撑", "BPMN / 审批联动 / 状态写回")
    draw_box(draw, *semantic, "轻量语义支撑", "表级语义 / 列级语义 / 关系语义")

    arrow(draw, 1100, 205, 1100, 280)
    arrow(draw, 980, 322, 1220, 322)
    arrow(draw, 700, 365, 320, 450)
    arrow(draw, 740, 365, 800, 450)
    arrow(draw, 1500, 365, 1280, 450)
    arrow(draw, 1540, 365, 1760, 450)
    arrow(draw, 700, 365, 660, 690)
    arrow(draw, 1100, 365, 1180, 690)
    arrow(draw, 1500, 365, 1700, 690)

    png_path = DIAGRAMS / "图3-6_EISCore总体功能结构图.png"
    save_png(png_path, img)

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<style>
text {{ font-family: 'Microsoft YaHei','PingFang SC',sans-serif; fill: #000; }}
.title {{ font-size: 30px; font-weight: 700; }}
.head {{ font-size: 24px; font-weight: 600; }}
.body {{ font-size: 19px; }}
.box {{ fill: #fff; stroke: #000; stroke-width: 2; rx: 18; ry: 18; }}
.line {{ stroke: #000; stroke-width: 2; fill: none; }}
</style>
<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#000"/></marker></defs>
<text x="{width/2}" y="58" text-anchor="middle" class="title">图3-6 EISCore总体功能结构图</text>
"""
    boxes = [
        (root, "", "EISCore系统", "head"),
        (core, "", "核心业务域", "head"),
        (support, "", "支撑能力域", "head"),
        (hr, "人事管理", "员工档案 / 组织结构 / 考勤", "body"),
        (scm, "物料与仓储", "物料主数据 / 库存 / 出入库 / 盘点", "body"),
        (app, "应用中心", "数据应用 / 流程设计 / 审批 / 闪念应用", "body"),
        (mobile, "移动端", "扫码 / 盘点 / 冷库模式", "body"),
        (master, "主数据与权限支撑", "组织 / 岗位 / 角色 / RLS", "body"),
        (flow, "流程与状态支撑", "BPMN / 审批联动 / 状态写回", "body"),
        (semantic, "轻量语义支撑", "表级语义 / 列级语义 / 关系语义", "body"),
    ]
    for (x1, y1, x2, y2), title, body, cls in boxes:
        svg += f'<rect class="box" x="{x1}" y="{y1}" width="{x2-x1}" height="{y2-y1}"/>'
        if title:
            svg += f'<text x="{(x1+x2)/2}" y="{y1+34}" text-anchor="middle" class="head">{title}</text>'
            svg += f'<text x="{(x1+x2)/2}" y="{y1+76}" text-anchor="middle" class="body">{body}</text>'
        else:
            svg += f'<text x="{(x1+x2)/2}" y="{y1+55}" text-anchor="middle" class="head">{body}</text>'
    lines = [
        (1100,205,1100,280),(980,322,1220,322),(700,365,320,450),(740,365,800,450),
        (1500,365,1280,450),(1540,365,1760,450),(700,365,660,690),(1100,365,1180,690),(1500,365,1700,690)
    ]
    for x1,y1,x2,y2 in lines:
        svg += f'<line class="line" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" marker-end="url(#arrow)"/>'
    svg += "</svg>"
    save_svg(DIAGRAMS / "图3-6_EISCore总体功能结构图.svg", svg)


def render_fig41():
    width, height = 2100, 1260
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)
    draw.text((width / 2, 58), "图4-1 EISCore系统总体架构图", font=TITLE_FONT, fill="black", anchor="ma")

    user = (650, 120, 1450, 225)
    front = (470, 310, 1630, 500)
    runtime = (560, 605, 1540, 710)
    data = (420, 820, 1680, 1020)
    env = (760, 1115, 1340, 1200)

    draw_box(draw, *user, "用户访问层", "桌面端用户 / 现场业务用户 / 移动端用户", body_font=TEXT_FONT)
    draw_box(draw, *front, "前端表现层", "基座应用（Vue 3 + Vite + qiankun）\nHMS / MMS / 应用中心 / 移动端", body_font=TEXT_FONT)
    draw_box(draw, *runtime, "接口与运行层", "PostgREST / Workflow Runtime / Agent Runtime", body_font=TEXT_FONT)
    draw_box(draw, *data, "数据与治理层", "PostgreSQL 16\npublic / hr / scm / app_center / workflow / app_data\nRLS / 轻量语义 / 状态映射", body_font=TEXT_FONT)
    draw_box(draw, *env, "支撑环境层", "Docker Compose / PM2", body_font=TEXT_FONT)

    arrow(draw, 1050, 225, 1050, 310)
    arrow(draw, 1050, 500, 1050, 605)
    arrow(draw, 1050, 710, 1050, 820)
    arrow(draw, 1050, 1020, 1050, 1115)

    note = (1460, 835, 2010, 1040)
    draw_box(draw, *note, "设计要点", "数据库承担核心数据与部分业务约束；\n接口层负责统一映射；\n前端基座组织各业务子应用；\n流程与语义能力围绕同一底座协同。")
    arrow(draw, 1460, 930, 1680, 930)

    png_path = DIAGRAMS / "图4-1_EISCore系统总体架构图.png"
    save_png(png_path, img)

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<style>
text {{ font-family: 'Microsoft YaHei','PingFang SC',sans-serif; fill: #000; }}
.title {{ font-size: 30px; font-weight: 700; }}
.head {{ font-size: 24px; font-weight: 600; }}
.body {{ font-size: 21px; }}
.box {{ fill: #fff; stroke: #000; stroke-width: 2; rx: 18; ry: 18; }}
.line {{ stroke: #000; stroke-width: 2; fill: none; }}
</style>
<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#000"/></marker></defs>
<text x="{width/2}" y="58" text-anchor="middle" class="title">图4-1 EISCore系统总体架构图</text>
"""
    box_data = [
        (user, "用户访问层", ["桌面端用户 / 现场业务用户 / 移动端用户"]),
        (front, "前端表现层", ["基座应用（Vue 3 + Vite + qiankun）", "HMS / MMS / 应用中心 / 移动端"]),
        (runtime, "接口与运行层", ["PostgREST / Workflow Runtime / Agent Runtime"]),
        (data, "数据与治理层", ["PostgreSQL 16", "public / hr / scm / app_center / workflow / app_data", "RLS / 轻量语义 / 状态映射"]),
        (env, "支撑环境层", ["Docker Compose / PM2"]),
        (note, "设计要点", ["数据库承担核心数据与部分业务约束；", "接口层负责统一映射；", "前端基座组织各业务子应用；", "流程与语义能力围绕同一底座协同。"]),
    ]
    for (x1,y1,x2,y2), title, lines in box_data:
        svg += f'<rect class="box" x="{x1}" y="{y1}" width="{x2-x1}" height="{y2-y1}"/>'
        svg += f'<text x="{(x1+x2)/2}" y="{y1+38}" text-anchor="middle" class="head">{title}</text>'
        yy = y1 + 82
        for line in lines:
            svg += f'<text x="{(x1+x2)/2}" y="{yy}" text-anchor="middle" class="body">{line}</text>'
            yy += 36
    for x1,y1,x2,y2 in [(1050,225,1050,310),(1050,500,1050,605),(1050,710,1050,820),(1050,1020,1050,1115),(1460,930,1680,930)]:
        svg += f'<line class="line" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" marker-end="url(#arrow)"/>'
    svg += "</svg>"
    save_svg(DIAGRAMS / "图4-1_EISCore系统总体架构图.svg", svg)


if __name__ == "__main__":
    DESKTOP_PNG.mkdir(parents=True, exist_ok=True)
    DESKTOP_SVG.mkdir(parents=True, exist_ok=True)
    render_fig36()
    render_fig41()
