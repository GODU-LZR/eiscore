from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import shutil


ROOT = Path(r"\\wsl.localhost\Ubuntu\home\lzr\eiscore")
DIAGRAMS = ROOT / "docs" / "diagrams"
DESKTOP_PNG = Path(r"C:\Users\Twist\Desktop\论文\图_PNG_正式")
FONT_PATH = Path(r"C:\Windows\Fonts\msyh.ttc")

H1 = ImageFont.truetype(str(FONT_PATH), 34)
H2 = ImageFont.truetype(str(FONT_PATH), 26)
BODY = ImageFont.truetype(str(FONT_PATH), 22)
SMALL = ImageFont.truetype(str(FONT_PATH), 18)


def canvas(width=2400, height=1200):
    return Image.new("RGB", (width, height), "white")


def save_png(name: str, img: Image.Image):
    DESKTOP_PNG.mkdir(parents=True, exist_ok=True)
    path = DIAGRAMS / name
    img.save(path, format="PNG")
    shutil.copy2(path, DESKTOP_PNG / name)


def wrap(draw, text, font, max_width):
    out = []
    for para in text.split("\n"):
        if not para:
            out.append("")
            continue
        cur = ""
        for ch in para:
            if draw.textlength(cur + ch, font=font) <= max_width:
                cur += ch
            else:
                if cur:
                    out.append(cur)
                cur = ch
        if cur:
            out.append(cur)
    return out


def box(draw, rect, title="", body="", title_font=H2, body_font=BODY, radius=22, title_gap=12):
    x1, y1, x2, y2 = rect
    draw.rounded_rectangle(rect, radius=radius, outline="black", width=2, fill="white")
    cx = (x1 + x2) / 2
    top = y1 + 18
    if title:
        draw.text((cx, top), title, font=title_font, fill="black", anchor="ma")
        top += title_font.size + title_gap
    lines = wrap(draw, body, body_font, (x2 - x1) - 28)
    line_h = body_font.size + 8
    total = len(lines) * line_h
    start = top + max(0, ((y2 - top) - total) / 2 - 4)
    for i, line in enumerate(lines):
        draw.text((cx, start + i * line_h), line, font=body_font, fill="black", anchor="ma")


def arrow(draw, p1, p2, label=None, font=SMALL, offset=(0, -10)):
    x1, y1 = p1
    x2, y2 = p2
    draw.line((x1, y1, x2, y2), fill="black", width=2)
    if x1 == x2:
        pts = [(x2, y2), (x2 - 7, y2 - 14), (x2 + 7, y2 - 14)]
    elif y1 == y2:
        pts = [(x2, y2), (x2 - 14, y2 - 7), (x2 - 14, y2 + 7)]
    else:
        pts = [(x2, y2), (x2 - 10, y2 - 4), (x2 - 4, y2 - 10)]
    draw.polygon(pts, fill="black")
    if label:
        mx = (x1 + x2) / 2 + offset[0]
        my = (y1 + y2) / 2 + offset[1]
        draw.text((mx, my), label, font=font, fill="black", anchor="ma")


def diamond(draw, center, text, w=210, h=110, font=BODY):
    cx, cy = center
    pts = [(cx, cy - h / 2), (cx + w / 2, cy), (cx, cy + h / 2), (cx - w / 2, cy)]
    draw.polygon(pts, outline="black", fill="white", width=2)
    lines = wrap(draw, text, font, w - 36)
    line_h = font.size + 6
    sy = cy - (len(lines) * line_h) / 2 + 4
    for i, line in enumerate(lines):
        draw.text((cx, sy + i * line_h), line, font=font, fill="black", anchor="ma")


def lane(draw, x, top, bottom, title):
    box(draw, (x - 110, top, x + 110, top + 58), body=title, body_font=SMALL, radius=14)
    draw.line((x, top + 58, x, bottom), fill="gray", width=1)
    for y in range(top + 80, bottom, 20):
        draw.line((x, y, x, min(y + 10, bottom)), fill="gray", width=1)


def oval(draw, rect, text, font=BODY, outline="black", fill="white"):
    x1, y1, x2, y2 = rect
    draw.ellipse(rect, outline=outline, fill=fill, width=2)
    lines = wrap(draw, text, font, x2 - x1 - 30)
    h = sum(font.size + 8 for _ in lines) - 8
    y = y1 + ((y2 - y1) - h) / 2
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        x = x1 + ((x2 - x1) - (bbox[2] - bbox[0])) / 2
        draw.text((x, y), line, font=font, fill="black")
        y += font.size + 8


def actor(draw, x, y, label):
    draw.ellipse((x - 18, y, x + 18, y + 36), outline="black", width=2, fill="white")
    draw.line((x, y + 36, x, y + 100), fill="black", width=2)
    draw.line((x - 36, y + 55, x + 36, y + 55), fill="black", width=2)
    draw.line((x, y + 100, x - 32, y + 145), fill="black", width=2)
    draw.line((x, y + 100, x + 32, y + 145), fill="black", width=2)
    bbox = draw.textbbox((0, 0), label, font=BODY)
    draw.text((x - (bbox[2] - bbox[0]) / 2, y + 155), label, font=BODY, fill="black")


def use_case_link(draw, actor_x, actor_y, target_rect):
    tx = target_rect[0] if actor_x < target_rect[0] else target_rect[2]
    ty = (target_rect[1] + target_rect[3]) / 2
    draw.line((actor_x, actor_y, tx, ty), fill="black", width=2)


def render_fig36():
    img = canvas(2400, 1150)
    d = ImageDraw.Draw(img)

    root = (1000, 70, 1400, 160)
    core = (430, 250, 980, 340)
    support = (1420, 250, 1970, 340)
    hr = (100, 470, 500, 600)
    scm = (580, 470, 980, 600)
    app = (1060, 470, 1460, 600)
    mobile = (1540, 470, 1940, 600)
    master = (360, 760, 840, 890)
    flow = (960, 760, 1440, 890)
    semantic = (1560, 760, 2040, 890)

    box(d, root, body="EISCore系统", body_font=H1)
    box(d, core, body="核心业务域", body_font=H2)
    box(d, support, body="支撑能力域", body_font=H2)
    box(d, hr, "人事管理", "员工档案 / 组织结构 / 考勤")
    box(d, scm, "物料与仓储", "物料主数据 / 库存 / 出入库 / 盘点")
    box(d, app, "应用中心", "数据应用 / 流程设计 / 审批 / 闪念应用")
    box(d, mobile, "移动端", "扫码 / 盘点 / 冷库模式")
    box(d, master, "主数据与权限支撑", "组织 / 岗位 / 角色 / RLS")
    box(d, flow, "流程与状态支撑", "BPMN / 审批联动 / 状态写回")
    box(d, semantic, "轻量语义支撑", "表级语义 / 列级语义 / 关系语义")

    arrow(d, (1200, 160), (1200, 250))
    arrow(d, (980, 295), (1420, 295))
    arrow(d, (705, 340), (300, 470))
    arrow(d, (760, 340), (780, 470))
    arrow(d, (1645, 340), (1260, 470))
    arrow(d, (1710, 340), (1740, 470))
    arrow(d, (640, 340), (600, 760))
    arrow(d, (1200, 340), (1200, 760))
    arrow(d, (1760, 340), (1800, 760))

    save_png("图3-6_EISCore总体功能结构图.png", img)


def render_fig11():
    img = canvas(2400, 980)
    d = ImageDraw.Draw(img)

    steps = [
        ((80, 330, 430, 480), "企业现实约束", "湛江中小制造企业\n预算有限 / 运维薄弱\n南派食品存在批次、权限、流程问题"),
        ((470, 330, 820, 480), "需求分析", "围绕人事管理、物料流转、\n流程状态、语义解释与移动场景\n梳理核心需求"),
        ((860, 330, 1210, 480), "系统概要设计", "以数据库中心组织核心数据\n以前端基座承载主要业务入口"),
        ((1250, 330, 1600, 480), "关键技术路线", "PostgreSQL + PostgREST\nVue 3 + qiankun\nBPMN + 轻量语义增强"),
        ((1640, 330, 1990, 480), "系统实现", "人事管理、物料管理、应用中心、移动端\n闪念应用、Agent Runtime、冷库模式"),
        ((2030, 330, 2380, 480), "测试与验证", "登录鉴权、页面访问、库存链路、\n流程读取、语义工具与受控运行"),
    ]
    for rect, title, body in steps:
        box(d, rect, title, body, title_font=H2, body_font=BODY, radius=20)

    for i in range(len(steps) - 1):
        arrow(d, (steps[i][0][2], 405), (steps[i + 1][0][0], 405))

    box(
        d,
        (720, 650, 1680, 840),
        "图示说明",
        "该图用于概括本设计从企业现实问题出发，经过需求分析、概要设计、关键技术路线、系统实现和测试验证，最终形成完整设计说明书的整体路径。它不是目录复述，而是研究思路的压缩表达。",
        title_font=H2,
        body_font=BODY,
        radius=18,
    )

    save_png("图1-1_论文研究思路与技术路线图_Word横版.png", img)


def render_fig21():
    img = canvas(2400, 1260)
    d = ImageDraw.Draw(img)

    top = (860, 70, 1540, 170)
    front = (250, 280, 860, 390)
    db = (920, 280, 1530, 390)
    flow = (1590, 280, 2200, 390)
    ui = (250, 560, 860, 670)
    api = (920, 560, 1530, 670)
    semantic = (1590, 560, 2200, 670)
    mobile = (590, 840, 1200, 950)
    agent = (1260, 840, 1870, 950)

    box(d, top, body="EISCore关键技术关系", body_font=H1)
    box(d, front, "前端组织技术", "Vue 3 / Vite / qiankun", body_font=BODY)
    box(d, db, "数据库中心技术", "PostgreSQL / Schema / JSONB", body_font=BODY)
    box(d, flow, "流程建模技术", "BPMN / workflow / 状态映射", body_font=BODY)
    box(d, ui, "界面与交互支撑", "Element Plus / Vant / AG Grid", body_font=BODY)
    box(d, api, "接口映射技术", "PostgREST / RPC函数 / JWT", body_font=BODY)
    box(d, semantic, "语义增强技术", "表级语义 / 列级语义 / 本体关系", body_font=BODY)
    box(d, mobile, "移动端与现场入口", "PDA盘点 / 扫码 / 冷库模式", body_font=BODY)
    box(d, agent, "辅助运行能力", "FlashBuilder / Agent Runtime", body_font=BODY)

    arrow(d, (1200, 170), (555, 280))
    arrow(d, (1200, 170), (1225, 280))
    arrow(d, (1200, 170), (1895, 280))
    arrow(d, (555, 390), (555, 560))
    arrow(d, (1225, 390), (1225, 560))
    arrow(d, (1895, 390), (1895, 560))
    arrow(d, (1225, 670), (895, 840))
    arrow(d, (1225, 670), (1565, 840))
    arrow(d, (555, 670), (895, 840))
    arrow(d, (1895, 670), (1565, 840))

    save_png("图2-1_EISCore关键技术关系图.png", img)


def render_fig22():
    img = canvas(2400, 1200)
    d = ImageDraw.Draw(img)

    top = (900, 60, 1500, 150)
    flash = (220, 280, 760, 390)
    runtime = (930, 280, 1470, 390)
    tools = (1640, 280, 2180, 390)
    data_app = (220, 620, 760, 730)
    semantic = (930, 620, 1470, 730)
    workflow = (1640, 620, 2180, 730)
    result = (760, 930, 1640, 1060)

    box(d, top, body="闪念应用、智能体与轻量语义联动", body_font=H1)
    box(d, flash, "闪念应用构建器", "草稿 / 预览 / 发布", body_font=BODY)
    box(d, runtime, "Agent Runtime", "受控工具选择 / 调用编排", body_font=BODY)
    box(d, tools, "白名单工具层", "flash.data.* / flash.workflow.* / flash.ontology.*", body_font=BODY)
    box(d, data_app, "数据表格应用", "动态表 / 字段配置 / 表格填写", body_font=BODY)
    box(d, semantic, "轻量化语义", "对象语义解释 / 表级与列级语义", body_font=BODY)
    box(d, workflow, "流程对象", "流程定义 / 实例 / 状态映射", body_font=BODY)
    box(d, result, "组合结果", "页面生成、对象解释、流程联动与受控访问返回", body_font=BODY)

    arrow(d, (760, 335), (930, 335), "提交草稿与意图")
    arrow(d, (1470, 335), (1640, 335), "选择工具")
    arrow(d, (1910, 390), (1910, 620))
    arrow(d, (1910, 620), (1640, 620))
    arrow(d, (1910, 390), (1200, 620))
    arrow(d, (1910, 390), (490, 620))
    arrow(d, (490, 730), (1020, 930))
    arrow(d, (1200, 730), (1200, 930))
    arrow(d, (1910, 730), (1380, 930))

    save_png("图2-2_闪念应用智能体与轻量语义联动图.png", img)


def render_fig31():
    img = canvas(2600, 1300)
    d = ImageDraw.Draw(img)

    lanes = [
        ("销售", 120, 520),
        ("PMC计划", 520, 920),
        ("采购", 920, 1320),
        ("生产", 1320, 1720),
        ("质检", 1720, 2120),
        ("仓储/发货", 2120, 2520),
    ]
    top = 120
    lane_h = 160
    for i, (name, x1, x2) in enumerate(lanes):
        y1 = top + i * lane_h
        y2 = y1 + lane_h
        d.rectangle((x1, y1, x2, y2), outline="black", width=2)
        d.text((x1 + 16, y1 + 14), name, font=H2, fill="black")

    nodes = {
        "合同/订单": (200, 165),
        "库存判断": (600, 165),
        "缺料分析": (600, 325),
        "采购下单": (1000, 325),
        "到货登记": (1000, 485),
        "领料/补料": (1400, 485),
        "车间加工": (1400, 645),
        "过程检验": (1800, 645),
        "完工入库": (2200, 645),
        "出货检验": (2200, 805),
        "销售出库/物流": (2200, 965),
    }
    for text, (x, y) in nodes.items():
        box(d, (x - 130, y - 40, x + 130, y + 40), body=text, body_font=BODY, radius=16)

    arrow(d, (330, 165), (470, 165))
    arrow(d, (600, 205), (600, 285), "库存不足")
    arrow(d, (730, 325), (870, 325))
    arrow(d, (1000, 365), (1000, 445))
    arrow(d, (1130, 485), (1270, 485))
    arrow(d, (1400, 525), (1400, 605))
    arrow(d, (1530, 645), (1670, 645))
    arrow(d, (1800, 685), (2200, 645), "合格入库")
    arrow(d, (2200, 685), (2200, 765))
    arrow(d, (2200, 845), (2200, 925))

    box(
        d,
        (520, 1110, 2080, 1240),
        "说明",
        "该图用于概括南派食品当前从销售订单、PMC判断、采购到货、生产领料与补料、质检、完工入库到销售出库的主干链路，用于支撑第三章的业务现状分析。",
        title_font=H2,
        body_font=BODY,
        radius=16,
    )

    save_png("图3-1_南派食品供应链与生产协同泳道图.png", img)


def render_fig51():
    img = canvas(2500, 1360)
    d = ImageDraw.Draw(img)

    sec1 = (180, 120, 740, 520)
    sec2 = (970, 120, 1530, 520)
    sec3 = (1760, 120, 2320, 520)
    sec4 = (570, 760, 1130, 1160)
    sec5 = (1370, 760, 1930, 1160)

    for rect, title in [
        (sec1, "组织权限域"),
        (sec2, "物料仓储域"),
        (sec3, "应用流程域"),
        (sec4, "移动与现场域"),
        (sec5, "语义与状态支撑"),
    ]:
        d.rounded_rectangle(rect, radius=20, outline="black", width=2, fill="white")
        d.text((rect[0] + 20, rect[1] + 14), title, font=H2, fill="black")

    entities = [
        ("users", (260, 220, 500, 300)),
        ("roles", (260, 340, 500, 420)),
        ("user_roles", (260, 460, 500, 540)),
        ("raw_materials", (1050, 220, 1370, 300)),
        ("inventory_batches", (1050, 340, 1370, 420)),
        ("inventory_transactions", (1050, 460, 1370, 540)),
        ("apps", (1840, 220, 2140, 300)),
        ("workflow_instances", (1840, 340, 2140, 420)),
        ("workflow_state_mappings", (1840, 460, 2140, 540)),
        ("mobile_check_tasks", (650, 860, 1050, 940)),
        ("mobile_check_records", (650, 980, 1050, 1060)),
        ("semantic_tables", (1450, 860, 1850, 940)),
        ("semantic_columns", (1450, 980, 1850, 1060)),
    ]
    rects = {}
    for name, rect in entities:
        rects[name] = rect
        box(d, rect, body=name, body_font=BODY, radius=14)

    def mid_right(name):
        r = rects[name]
        return (r[2], (r[1] + r[3]) / 2)
    def mid_left(name):
        r = rects[name]
        return (r[0], (r[1] + r[3]) / 2)
    def mid_bottom(name):
        r = rects[name]
        return ((r[0] + r[2]) / 2, r[3])
    def mid_top(name):
        r = rects[name]
        return ((r[0] + r[2]) / 2, r[1])

    arrow(d, mid_right("users"), mid_left("user_roles"), "1:n")
    arrow(d, mid_right("roles"), (260, 500), "1:n")
    arrow(d, (500, 500), mid_left("user_roles"))
    arrow(d, mid_right("raw_materials"), mid_left("inventory_batches"), "1:n")
    arrow(d, mid_right("inventory_batches"), mid_left("inventory_transactions"), "1:n")
    arrow(d, mid_right("apps"), mid_left("workflow_instances"), "1:n")
    arrow(d, mid_right("workflow_instances"), mid_left("workflow_state_mappings"), "1:n")
    arrow(d, mid_bottom("inventory_batches"), mid_top("mobile_check_tasks"), "盘点读取")
    arrow(d, mid_bottom("mobile_check_tasks"), mid_top("mobile_check_records"), "1:n")
    arrow(d, mid_bottom("workflow_state_mappings"), mid_top("semantic_tables"), "状态/语义关联")
    arrow(d, mid_bottom("semantic_tables"), mid_top("semantic_columns"), "1:n")

    box(
        d,
        (520, 1220, 1980, 1320),
        "说明",
        "该图只保留与论文主线关系最紧密的核心实体，用于说明组织权限、物料仓储、应用流程、移动盘点以及语义支撑之间的主要关联，不等同于全库物理表清单。",
        title_font=H2,
        body_font=BODY,
        radius=16,
    )

    save_png("图5-1_EISCore核心数据实体关系图.png", img)


def render_fig32():
    img = canvas(2400, 1200)
    d = ImageDraw.Draw(img)

    actor(d, 170, 250, "销售文员")
    actor(d, 170, 760, "PMC计划员")
    actor(d, 2230, 520, "采购员")

    cases = {
        "销售合同维护": (540, 140, 980, 250),
        "销售订单生成": (540, 300, 980, 410),
        "订单下推计划": (540, 460, 980, 570),
        "库存核对与发货判断": (540, 620, 980, 730),
        "生产计划与缺料分析": (540, 780, 980, 890),
        "采购需求生成": (1380, 380, 1820, 490),
        "采购订单下达": (1380, 560, 1820, 670),
        "到货跟踪与交期维护": (1380, 740, 1820, 850),
    }
    for text, rect in cases.items():
        oval(d, rect, text)

    use_case_link(d, 206, 305, cases["销售合同维护"])
    use_case_link(d, 206, 305, cases["销售订单生成"])
    use_case_link(d, 206, 305, cases["订单下推计划"])
    use_case_link(d, 206, 815, cases["订单下推计划"])
    use_case_link(d, 206, 815, cases["库存核对与发货判断"])
    use_case_link(d, 206, 815, cases["生产计划与缺料分析"])
    use_case_link(d, 2194, 575, cases["采购需求生成"])
    use_case_link(d, 2194, 575, cases["采购订单下达"])
    use_case_link(d, 2194, 575, cases["到货跟踪与交期维护"])

    arrow(d, (980, 515), (1380, 435), "缺料时触发")
    arrow(d, (980, 840), (1380, 615), "生成采购需求")

    save_png("图3-2_销售计划与采购用例图.png", img)


def render_fig33():
    img = canvas(2400, 1250)
    d = ImageDraw.Draw(img)

    actor(d, 170, 240, "仓管员")
    actor(d, 170, 760, "生产主管")
    actor(d, 2230, 500, "销售文员")

    cases = {
        "采购入库": (560, 130, 1020, 240),
        "生产领料": (560, 300, 1020, 410),
        "生产补料": (560, 470, 1020, 580),
        "生产入库": (560, 640, 1020, 750),
        "销售出库": (560, 810, 1020, 920),
        "库存台账查询": (1380, 260, 1840, 370),
        "批次与有效期管理": (1380, 470, 1840, 580),
        "盘点与库存调整": (1380, 680, 1840, 790),
    }
    for text, rect in cases.items():
        oval(d, rect, text)

    for key in ["采购入库", "生产领料", "生产补料", "生产入库", "库存台账查询", "批次与有效期管理", "盘点与库存调整"]:
        use_case_link(d, 206, 295, cases[key])
    for key in ["生产领料", "生产补料", "生产入库"]:
        use_case_link(d, 206, 815, cases[key])
    use_case_link(d, 2194, 555, cases["销售出库"])
    use_case_link(d, 2194, 555, cases["库存台账查询"])

    arrow(d, (1020, 525), (1380, 525), "关联库存批次")
    arrow(d, (1020, 865), (1380, 735), "出入库后同步更新")

    save_png("图3-3_仓储与库存作业用例图.png", img)


def render_fig34():
    img = canvas(2400, 1180)
    d = ImageDraw.Draw(img)

    actor(d, 170, 280, "质检员")
    actor(d, 2230, 320, "审批人")
    actor(d, 2230, 760, "仓管员")

    cases = {
        "来料检验": (580, 170, 1040, 280),
        "过程检验": (580, 340, 1040, 450),
        "出货检验": (580, 510, 1040, 620),
        "检验附件上传": (580, 680, 1040, 790),
        "审批处理": (1400, 260, 1860, 370),
        "状态写回": (1400, 470, 1860, 580),
        "异常拦截与提示": (1400, 680, 1860, 790),
    }
    for text, rect in cases.items():
        oval(d, rect, text)

    for key in ["来料检验", "过程检验", "出货检验", "检验附件上传"]:
        use_case_link(d, 206, 335, cases[key])
    for key in ["审批处理", "状态写回", "异常拦截与提示"]:
        use_case_link(d, 2194, 375, cases[key])
    use_case_link(d, 2194, 815, cases["状态写回"])
    use_case_link(d, 2194, 815, cases["异常拦截与提示"])

    arrow(d, (1040, 735), (1400, 735), "结果与附件联动")
    arrow(d, (1040, 565), (1400, 525), "审批后回写业务状态")

    save_png("图3-4_质量检验与审批用例图.png", img)


def render_fig35():
    img = canvas(2400, 1080)
    d = ImageDraw.Draw(img)

    actor(d, 170, 250, "销售/仓储")
    actor(d, 2230, 250, "管理层")

    cases = {
        "订单追溯": (650, 180, 1110, 290),
        "批次追溯": (650, 380, 1110, 490),
        "附件关联查看": (650, 580, 1110, 690),
        "物流信息登记": (1320, 180, 1780, 290),
        "经营统计查看": (1320, 380, 1780, 490),
        "执行状态透明查看": (1320, 580, 1780, 690),
    }
    for text, rect in cases.items():
        oval(d, rect, text)

    for key in ["订单追溯", "批次追溯", "附件关联查看", "物流信息登记", "执行状态透明查看"]:
        use_case_link(d, 206, 305, cases[key])
    for key in ["经营统计查看", "执行状态透明查看"]:
        use_case_link(d, 2194, 305, cases[key])

    arrow(d, (1110, 435), (1320, 435), "追溯结果用于查看与统计")

    save_png("图3-5_追溯与经营管理用例图.png", img)


def render_fig42():
    img = canvas(2200, 1200)
    d = ImageDraw.Draw(img)

    root = (860, 70, 1340, 160)
    biz = (280, 270, 840, 370)
    support = (1360, 270, 1920, 370)
    hr = (120, 520, 520, 620)
    scm = (560, 520, 960, 620)
    app = (1000, 520, 1400, 620)
    mobile = (1440, 520, 1840, 620)
    data = (520, 780, 980, 880)
    semantic = (1080, 780, 1540, 880)

    box(d, root, body="EISCore系统", body_font=H1)
    box(d, biz, body="核心业务部分", body_font=H2)
    box(d, support, body="基础支撑部分", body_font=H2)
    box(d, hr, body="人事管理", body_font=BODY)
    box(d, scm, body="物料与仓储", body_font=BODY)
    box(d, app, body="应用中心", body_font=BODY)
    box(d, mobile, body="移动端", body_font=BODY)
    box(d, data, body="数据与权限支撑", body_font=BODY)
    box(d, semantic, body="轻量化语义支撑", body_font=BODY)

    arrow(d, (1100, 160), (560, 270))
    arrow(d, (1100, 160), (1640, 270))
    arrow(d, (560, 370), (320, 520))
    arrow(d, (560, 370), (760, 520))
    arrow(d, (560, 370), (1200, 520))
    arrow(d, (560, 370), (1640, 520))
    arrow(d, (1640, 370), (750, 780))
    arrow(d, (1640, 370), (1310, 780))

    save_png("图4-2_EISCore功能模块划分图.png", img)


def render_fig61():
    img = canvas(2400, 980)
    d = ImageDraw.Draw(img)
    top, bottom = 60, 850
    xs = [120, 470, 820, 1170, 1520, 1870, 2220]
    titles = [
        "仓管员",
        "入库页面",
        "PostgREST",
        "scm.stock_in",
        "批次表",
        "流水表",
        "结果返回",
    ]
    for x, t in zip(xs, titles):
        lane(d, x, top, bottom, t)

    y = 180
    arrow(d, (120, y), (470, y), "录入到货批次、数量、仓位")
    y += 90
    arrow(d, (470, y), (820, y), "POST /rpc/scm.stock_in")
    y += 90
    arrow(d, (820, y), (1170, y), "调用入库函数并校验参数")
    y += 90
    arrow(d, (1170, y), (1520, y), "生成或校验库存批次")
    y += 90
    arrow(d, (1170, y + 10), (1870, y + 10), "写入库存流水与关联单据")
    y += 100
    arrow(d, (1870, y), (2220, y), "返回成功结果与批次号")

    box(d, (390, 650, 2050, 820), body="说明：该图突出的是“页面录入 -> PostgREST -> 入库函数 -> 批次表/流水表”这条实际实现链路，便于说明数据库中心架构下入库逻辑的落点。", body_font=BODY, radius=18)

    save_png("图6-1_库存入库时序图.png", img)


def render_fig62():
    img = canvas(2400, 980)
    d = ImageDraw.Draw(img)
    top, bottom = 60, 850
    xs = [120, 470, 820, 1170, 1520, 1870, 2220]
    titles = [
        "仓管员",
        "出库页面",
        "PostgREST",
        "scm.stock_out",
        "批次表",
        "流水表",
        "结果返回",
    ]
    for x, t in zip(xs, titles):
        lane(d, x, top, bottom, t)

    y = 180
    arrow(d, (120, y), (470, y), "选择出库单、批次与数量")
    y += 90
    arrow(d, (470, y), (820, y), "POST /rpc/scm.stock_out")
    y += 90
    arrow(d, (820, y), (1170, y), "调用出库函数并校验数量")
    y += 90
    arrow(d, (1170, y), (1520, y), "锁定并扣减可用批次")
    y += 90
    arrow(d, (1170, y + 10), (1870, y + 10), "写入库存流水与单据关联")
    y += 100
    arrow(d, (1870, y), (2220, y), "返回成功结果或库存不足提示")

    box(d, (390, 650, 2050, 820), body="说明：该图重点展示出库并不是简单扣库存，而是先校验批次和数量，再由数据库函数完成扣减、流水记录与返回结果。", body_font=BODY, radius=18)

    save_png("图6-2_库存出库时序图.png", img)


def render_fig41():
    img = canvas(2400, 1380)
    d = ImageDraw.Draw(img)

    user = (740, 70, 1660, 170)
    front = (320, 270, 2080, 540)
    runtime = (470, 650, 1930, 760)
    data = (250, 880, 2150, 1120)
    env = (930, 1220, 1470, 1310)
    note = (1580, 900, 2230, 1140)

    box(d, user, "用户访问层", "桌面端用户 / 现场业务用户 / 移动端用户", body_font=H2)
    box(d, front, "前端表现层", "基座应用（Vue 3 + Vite + qiankun）\nHMS / MMS / 应用中心 / 移动端", body_font=H2)
    box(d, runtime, "接口与运行层", "PostgREST / Workflow Runtime / Agent Runtime", body_font=H2)
    box(d, data, "数据与治理层", "PostgreSQL 16\npublic / hr / scm / app_center / workflow / app_data\nRLS / 轻量语义 / 状态映射", body_font=H2)
    box(d, env, "支撑环境层", "Docker Compose / PM2", body_font=H2)
    box(d, note, "设计要点", "数据库承担核心数据与部分业务约束；\n接口层负责统一映射；\n前端基座组织各业务子应用；\n流程与语义能力围绕同一底座协同。", body_font=BODY)

    arrow(d, (1200, 170), (1200, 270))
    arrow(d, (1200, 540), (1200, 650))
    arrow(d, (1200, 760), (1200, 880))
    arrow(d, (1200, 1120), (1200, 1220))
    arrow(d, (1580, 1010), (1500, 1010))

    save_png("图4-1_EISCore系统总体架构图.png", img)


def render_fig64():
    img = canvas(2400, 980)
    d = ImageDraw.Draw(img)
    top, bottom = 60, 860
    xs = [120, 470, 820, 1170, 1520, 1870, 2220]
    titles = [
        "用户",
        "页面与路由",
        "前端状态层",
        "PostgREST",
        "JWT / RLS裁决",
        "业务对象",
        "返回结果",
    ]
    for x, t in zip(xs, titles):
        lane(d, x, top, bottom, t)

    # messages
    y = 180
    arrow(d, (120, y), (470, y), "输入账号/密码或访问受限页面")
    y += 90
    arrow(d, (470, y), (820, y), "写入登录态 / 菜单 / 角色")
    y += 90
    arrow(d, (820, y), (1170, y), "发起查询/写入/审批请求")
    y += 90
    arrow(d, (1170, y), (1520, y), "携带 JWT 声明")
    y += 90
    arrow(d, (1520, y), (1870, y), "数据库函数 + RLS校验")
    y += 100
    arrow(d, (1870, y), (2220, y), "允许：返回数据 / 拒绝：越权提示")

    # note frame
    d.rounded_rectangle((360, 620, 2060, 820), radius=18, outline="black", width=2)
    d.text((390, 645), "说明：该图用于表达权限控制不是停留在前端菜单隐藏，而是沿“页面输入 -> 身份传递 -> 数据库裁决”逐层完成。", font=BODY, fill="black")
    d.text((390, 695), "其中，前端状态层负责识别当前用户和页面入口；PostgREST 负责把 JWT 声明带入数据库；真正的最终裁决由数据库函数和 RLS 完成。", font=BODY, fill="black")
    d.text((390, 745), "因此，本系统在没有传统 controller/service 分层的前提下，仍然能够形成清晰的访问边界。", font=BODY, fill="black")

    save_png("图6-4_权限控制时序图.png", img)


def render_fig63():
    img = canvas(2600, 1080)
    d = ImageDraw.Draw(img)
    top, bottom = 50, 940
    xs = [110, 440, 770, 1110, 1460, 1820, 2180, 2480]
    titles = [
        "用户",
        "审批页",
        "PostgREST",
        "流程启动函数",
        "任务校验函数",
        "流程实例表",
        "审批记录/状态映射",
        "业务状态表",
    ]
    for x, t in zip(xs, titles):
        lane(d, x, top, bottom, t)

    y = 160
    arrow(d, (110, y), (440, y), "发起审批或流转动作")
    y += 90
    arrow(d, (440, y), (770, y), "POST /rpc/workflow.start_workflow_instance")
    y += 80
    arrow(d, (770, y), (1110, y), "创建流程实例")
    y += 80
    arrow(d, (1110, y), (1820, y), "写入初始实例状态")
    y += 90
    arrow(d, (440, y), (770, y), "POST /rpc/workflow.transition_workflow_instance")
    y += 80
    arrow(d, (770, y), (1460, y), "推进流程 / 校验当前用户是否可执行")
    y += 80
    arrow(d, (1460, y), (770, y), "返回 true / false")

    # alt frame
    d.rounded_rectangle((300, 640, 2450, 900), radius=18, outline="black", width=2)
    d.text((330, 660), "允许推进", font=BODY, fill="black")
    yy = 715
    arrow(d, (770, yy), (1820, yy), "更新 current_task_id / status")
    yy += 55
    arrow(d, (1820, yy), (2180, yy), "写入审批记录")
    yy += 55
    arrow(d, (2180, yy), (2480, yy), "读取并更新业务状态映射")
    yy += 55
    arrow(d, (2480, yy), (440, yy), "返回审批结果与最新状态")

    d.text((330, 850), "无执行权限时：PostgREST 返回权限异常或无权审批提示，不继续状态写回。", font=BODY, fill="black")

    save_png("图6-3_流程启动与状态写回时序图.png", img)


def render_fig37():
    img = canvas(2200, 1280)
    d = ImageDraw.Draw(img)

    box(d, (900, 60, 1300, 130), body="到货登记", body_font=H2)
    box(d, (880, 180, 1320, 270), body="关联合同与采购单", body_font=BODY)
    box(d, (840, 330, 1360, 430), body="质检人员发起来料检验", body_font=BODY)
    diamond(d, (1100, 520), "检验合格？", w=260, h=130)

    # left main line
    box(d, (320, 620, 760, 720), body="生成采购入库单", body_font=BODY)
    box(d, (320, 790, 760, 890), body="写入库存批次", body_font=BODY)
    box(d, (320, 960, 760, 1060), body="写入库存流水", body_font=BODY)
    box(d, (320, 1130, 760, 1230), body="更新采购执行状态", body_font=BODY)

    # right exception line
    box(d, (1440, 620, 1880, 720), body="记录不合格结果", body_font=BODY)
    box(d, (1440, 790, 1880, 890), body="保留附件与处理意见", body_font=BODY)
    diamond(d, (1660, 990), "允许后续补录？", w=280, h=130)
    box(d, (1260, 1130, 1620, 1230), body="保留待补录状态", body_font=BODY)
    box(d, (1700, 1130, 2060, 1230), body="终止正式入库", body_font=BODY)

    box(d, (820, 1130, 1180, 1230), body="形成采购单—检验单—入库单关联", body_font=BODY)

    arrow(d, (1100, 130), (1100, 180))
    arrow(d, (1100, 270), (1100, 330))
    arrow(d, (1100, 430), (1100, 455))
    arrow(d, (970, 565), (540, 620), "是", offset=(0, -16))
    arrow(d, (1230, 565), (1660, 620), "否", offset=(0, -16))

    arrow(d, (540, 720), (540, 790))
    arrow(d, (540, 890), (540, 960))
    arrow(d, (540, 1060), (540, 1130))
    arrow(d, (760, 1180), (820, 1180))

    arrow(d, (1660, 720), (1660, 790))
    arrow(d, (1660, 890), (1660, 925))
    arrow(d, (1530, 1055), (1440, 1130), "是", offset=(-20, -10))
    arrow(d, (1790, 1055), (1880, 1130), "否", offset=(20, -10))
    arrow(d, (1620, 1180), (1180, 1180))
    arrow(d, (1700, 1180), (1180, 1180))

    save_png("图3-7_采购入库与来料检验活动图.png", img)


def render_fig38():
    img = canvas(2200, 1320)
    d = ImageDraw.Draw(img)

    box(d, (900, 60, 1300, 130), body="PMC下达生产任务", body_font=H2)
    box(d, (800, 180, 1400, 280), body="系统生成工单用料需求", body_font=BODY)
    box(d, (840, 350, 1360, 450), body="生产主管发起领料", body_font=BODY)
    box(d, (820, 520, 1380, 620), body="仓管员按批次领料出库", body_font=BODY)
    diamond(d, (1100, 730), "是否需要补料？", w=300, h=130)

    # main line
    box(d, (280, 860, 760, 960), body="按标准配方继续生产", body_font=BODY)
    box(d, (280, 1030, 760, 1130), body="生产报工", body_font=BODY)
    box(d, (280, 1200, 760, 1300), body="完工入库", body_font=BODY)

    # supplement line
    box(d, (1380, 860, 1860, 960), body="车间提出补料申请", body_font=BODY)
    box(d, (1380, 1030, 1860, 1130), body="仓库校验可用批次与库存", body_font=BODY)
    diamond(d, (1620, 1230), "库存充足？", w=240, h=120)
    box(d, (1040, 1360, 1440, 1460), body="执行补料出库", body_font=BODY)
    box(d, (1480, 1360, 1880, 1460), body="提示库存不足", body_font=BODY)

    box(d, (820, 1530, 1380, 1630), body="形成领料 / 补料 / 报工 / 入库追溯链路", body_font=BODY)

    arrow(d, (1100, 130), (1100, 180))
    arrow(d, (1100, 280), (1100, 350))
    arrow(d, (1100, 450), (1100, 520))
    arrow(d, (1100, 620), (1100, 665))
    arrow(d, (970, 795), (520, 860), "否", offset=(-10, -14))
    arrow(d, (1230, 795), (1620, 860), "是", offset=(10, -14))

    arrow(d, (520, 960), (520, 1030))
    arrow(d, (520, 1130), (520, 1200))
    arrow(d, (520, 1300), (1100, 1530))

    arrow(d, (1620, 960), (1620, 1030))
    arrow(d, (1620, 1130), (1620, 1170))
    arrow(d, (1560, 1290), (1240, 1360), "是", offset=(-30, -14))
    arrow(d, (1680, 1290), (1680, 1360), "否")
    arrow(d, (1240, 1460), (1100, 1530))
    arrow(d, (1680, 1460), (1100, 1530))

    save_png("图3-8_生产领料与补料活动图.png", img)


if __name__ == "__main__":
    render_fig11()
    render_fig21()
    render_fig22()
    render_fig31()
    render_fig32()
    render_fig33()
    render_fig34()
    render_fig35()
    render_fig36()
    render_fig51()
    render_fig42()
    render_fig61()
    render_fig62()
    render_fig41()
    render_fig63()
    render_fig64()
    render_fig37()
    render_fig38()
