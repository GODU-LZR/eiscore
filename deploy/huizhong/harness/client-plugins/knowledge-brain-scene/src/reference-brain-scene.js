
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const REFERENCE_STYLE = "\r\n    * { box-sizing: border-box; }\r\n    html, body {\r\n      width: 100%;\r\n      height: 100%;\r\n      margin: 0;\r\n      overflow: hidden;\r\n      background: #fff;\r\n      color: #000;\r\n      font-family: \"Noto Sans SC\", \"Microsoft YaHei UI\", \"Segoe UI\", sans-serif;\r\n    }\r\n\r\n    #app { position: relative; width: 100%; height: 100%; overflow: hidden; background: #fff; }\r\n    #viewport { position: absolute; inset: 0; touch-action: none; cursor: grab; }\r\n    #viewport:active { cursor: grabbing; }\r\n\r\n    .hud {\r\n      position: absolute;\r\n      z-index: 20;\r\n      left: 15px;\r\n      top: 14px;\r\n      pointer-events: none;\r\n      user-select: none;\r\n      max-width: min(660px, calc(100vw - 30px));\r\n    }\r\n\r\n    .hud .title {\r\n      font-size: 13px;\r\n      font-weight: 800;\r\n      letter-spacing: 0;\r\n      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;\r\n    }\r\n\r\n    .hud .sub {\r\n      margin-top: 6px;\r\n      font-size: 11px;\r\n      line-height: 1.65;\r\n      opacity: .62;\r\n    }\r\n\r\n    .controls {\r\n      position: absolute;\r\n      z-index: 30;\r\n      right: 14px;\r\n      top: 14px;\r\n      display: flex;\r\n      flex-wrap: wrap;\r\n      justify-content: flex-end;\r\n      gap: 7px;\r\n      max-width: min(55vw, 520px);\r\n    }\r\n\r\n    button {\r\n      min-height: 40px;\r\n      padding: 0 11px;\r\n      border: 1px solid #000;\r\n      background: rgba(255,255,255,.94);\r\n      color: #000;\r\n      font: inherit;\r\n      font-size: 11px;\r\n      cursor: pointer;\r\n    }\r\n    button:hover, button.active { background: #000; color: #fff; }\r\n    button:focus-visible { outline: 2px solid #000; outline-offset: 2px; }\r\n\r\n    .legend {\r\n      position: absolute;\r\n      z-index: 20;\r\n      left: 15px;\r\n      bottom: 13px;\r\n      pointer-events: none;\r\n      user-select: none;\r\n      font-size: 11px;\r\n      line-height: 1.65;\r\n      opacity: .62;\r\n    }\r\n\r\n    .mobile-input-hint { display: none; }\r\n\r\n    .tag {\r\n      position: absolute;\r\n      z-index: 25;\r\n      transform: translate(-50%, -50%);\r\n      white-space: nowrap;\r\n      padding: 3px 5px;\r\n      font-size: 10px;\r\n      line-height: 1;\r\n      color: #000;\r\n      background: rgba(255,255,255,.82);\r\n      border: 1px solid rgba(0,0,0,.22);\r\n      pointer-events: none;\r\n      user-select: none;\r\n    }\r\n\r\n    .tag.axis {\r\n      border: none;\r\n      font-size: 12px;\r\n      font-weight: 800;\r\n      background: rgba(255,255,255,.9);\r\n    }\r\n\r\n    .hidden { display: none !important; }\r\n\r\n    .memory-layer-tag {\r\n      position: absolute;\r\n      z-index: 24;\r\n      transform: translate(-50%, -50%);\r\n      padding: 4px 7px;\r\n      border: 1px solid rgba(0,0,0,.28);\r\n      background: rgba(255,255,255,.88);\r\n      color: #000;\r\n      font-size: 10px;\r\n      font-weight: 700;\r\n      letter-spacing: 0;\r\n      white-space: nowrap;\r\n      pointer-events: none;\r\n      user-select: none;\r\n    }\r\n\r\n    .kind-event { --memory-layer-tone: #202020; }\r\n    .kind-fact { --memory-layer-tone: #707070; }\r\n    .kind-schema { --memory-layer-tone: #b8b8b8; }\r\n\r\n    .memory-layer-tag.kind-event {\r\n      color: #111;\r\n      border-color: #242424;\r\n      background: rgba(250,250,250,.94);\r\n    }\r\n\r\n    .memory-layer-tag.kind-fact {\r\n      color: #292929;\r\n      border-color: #707070;\r\n      background: rgba(239,239,239,.94);\r\n    }\r\n\r\n    .memory-layer-tag.kind-schema {\r\n      color: #202020;\r\n      border-color: #a4a4a4;\r\n      background: rgba(220,220,220,.94);\r\n    }\r\n\r\n    .controls button.kind-event.active { background: #202020; color: #fff; }\r\n    .controls button.kind-fact.active { background: #707070; color: #fff; }\r\n    .controls button.kind-schema.active { background: #b8b8b8; color: #000; }\r\n\r\n    #memoryKindLegend {\r\n      position: absolute;\r\n      z-index: 26;\r\n      right: 14px;\r\n      bottom: 14px;\r\n      display: flex;\r\n      flex-wrap: wrap;\r\n      justify-content: flex-end;\r\n      gap: 6px;\r\n      pointer-events: none;\r\n      user-select: none;\r\n    }\r\n\r\n    .memory-layer-key {\r\n      display: inline-flex;\r\n      align-items: center;\r\n      gap: 5px;\r\n      min-height: 24px;\r\n      padding: 3px 6px;\r\n      border-left: 3px solid var(--memory-layer-tone, #000);\r\n      background: rgba(255,255,255,.84);\r\n      color: #000;\r\n      font-size: 10px;\r\n      line-height: 1;\r\n      white-space: nowrap;\r\n    }\r\n\r\n    .memory-layer-key::before {\r\n      content: '';\r\n      display: inline-block;\r\n      width: 8px;\r\n      height: 8px;\r\n      background: var(--memory-layer-tone, currentColor);\r\n    }\r\n\r\n    .memory-layer-key.kind-event { color: #111; }\r\n    .memory-layer-key.kind-event::before {\r\n      width: 6px;\r\n      height: 6px;\r\n      border-radius: 50%;\r\n      box-shadow: 4px 0 0 #242424, 8px 0 0 #242424;\r\n      margin-right: 8px;\r\n    }\r\n    .memory-layer-key.kind-fact { color: #333; }\r\n    .memory-layer-key.kind-fact::before {\r\n      background: transparent;\r\n      border: 2px solid #707070;\r\n      transform: rotate(45deg);\r\n    }\r\n    .memory-layer-key.kind-schema { color: #555; }\r\n    .memory-layer-key.kind-schema::before {\r\n      border: 1px solid #555;\r\n      background: #b8b8b8;\r\n    }\r\n\r\n    #memoryPanel {\r\n      position: absolute;\r\n      z-index: 50;\r\n      right: 14px;\r\n      top: 128px;\r\n      width: min(340px, calc(100vw - 28px));\r\n      max-height: calc(100% - 156px);\r\n      overflow: auto;\r\n      border: 1px solid #000;\r\n      background: rgba(255,255,255,.96);\r\n      box-shadow: 6px 6px 0 rgba(0,0,0,.08);\r\n      padding: 12px;\r\n    }\r\n\r\n    #memoryPanel .panel-head {\r\n      display: flex;\r\n      align-items: flex-start;\r\n      justify-content: space-between;\r\n      gap: 10px;\r\n      padding-bottom: 9px;\r\n      border-bottom: 1px solid rgba(0,0,0,.22);\r\n    }\r\n\r\n    #memoryPanel .panel-kicker {\r\n      font-size: 10px;\r\n      opacity: .58;\r\n      margin-bottom: 4px;\r\n    }\r\n\r\n    #memoryPanel .panel-title {\r\n      font-size: 14px;\r\n      font-weight: 800;\r\n      line-height: 1.35;\r\n    }\r\n\r\n    #memoryPanel .panel-close {\r\n      width: 34px;\r\n      min-width: 34px;\r\n      height: 34px;\r\n      min-height: 34px;\r\n      padding: 0;\r\n      line-height: 32px;\r\n    }\r\n\r\n    #memoryPanel .field {\r\n      padding: 9px 0;\r\n      border-bottom: 1px dashed rgba(0,0,0,.18);\r\n    }\r\n\r\n    #memoryPanel .field:last-child { border-bottom: none; }\r\n\r\n    #memoryPanel .field-label {\r\n      display: block;\r\n      font-size: 9px;\r\n      opacity: .50;\r\n      margin-bottom: 4px;\r\n      letter-spacing: .05em;\r\n    }\r\n\r\n    #memoryPanel .field-value {\r\n      font-size: 11px;\r\n      line-height: 1.62;\r\n      white-space: pre-wrap;\r\n      word-break: break-word;\r\n    }\r\n\r\n    #memoryPanel .panel-actions {\r\n      display: flex;\r\n      gap: 7px;\r\n      margin-top: 11px;\r\n    }\r\n\r\n    #memoryPanel .panel-actions button {\r\n      flex: 1;\r\n      min-width: 0;\r\n    }\r\n\r\n    @media (max-width: 700px) {\r\n      .hud { left: 10px; top: 10px; max-width: calc(100vw - 20px); }\r\n      .hud .sub { display: none; }\r\n      .controls {\r\n        left: 10px;\r\n        right: 10px;\r\n        top: 48px;\r\n        max-width: none;\r\n        max-height: min(300px, 38vh);\r\n        overflow-y: auto;\r\n        justify-content: flex-start;\r\n        align-content: flex-start;\r\n        gap: 5px;\r\n        padding: 6px;\r\n        border: 1px solid #000;\r\n        background: rgba(255,255,255,.92);\r\n      }\r\n      button { min-height: 38px; padding: 0 9px; }\r\n      .legend {\r\n        left: 10px;\r\n        right: 10px;\r\n        bottom: 42px;\r\n        font-size: 10px;\r\n        line-height: 1.45;\r\n      }\r\n      .desktop-input-hints,\r\n      .desktop-node-hint,\r\n      .legend #neuralStatus { display: none; }\r\n      .mobile-input-hint { display: block; }\r\n\r\n      #memoryChainCard {\r\n        left: 10px !important;\r\n        right: 10px !important;\r\n        top: auto !important;\r\n        bottom: 120px !important;\r\n        width: auto !important;\r\n        max-height: calc(38vh + 26px);\r\n        overflow: auto;\r\n      }\r\n\r\n      #memoryPanel {\r\n        left: 10px;\r\n        right: 10px;\r\n        top: auto;\r\n        bottom: 10px;\r\n        width: auto;\r\n        max-height: 44%;\r\n      }\r\n\r\n      #memoryKindLegend {\r\n        left: 10px;\r\n        right: 10px;\r\n        bottom: 9px;\r\n        justify-content: flex-end;\r\n      }\r\n    }\r\n  "
const REFERENCE_MARKUP = "\r\n<div id=\"app\">\r\n  <div id=\"viewport\" aria-label=\"可旋转拖动的超细体素大脑三维空间\"></div>\r\n\r\n  <div class=\"hud\">\r\n    <div class=\"title\">[ V13.0 · CANONICAL L3 / ACTIVATED GRAPH ]</div>\r\n    <div class=\"sub\">\r\n      唯一权威图包含事件、实体、事实、关系、属性、模式与规则；Document / Section / Chunk 作为独立证据通道。完整图定义可参与推理的逻辑范围，画面只加载当前激活子图与证明路径，不把千万级节点一次送入浏览器。\r\n      黑色微点表示事件，灰色线框表示实体与事实，浅灰多面体表示模式与规则；灰阶只编码对象类型和激活强度，不再表示独立知识层。\r\n    </div>\r\n  </div>\r\n\r\n  <div class=\"controls\">\r\n    <button id=\"resetBtn\" type=\"button\">复位</button>\r\n    <button id=\"frontBtn\" type=\"button\">正面</button>\r\n    <button id=\"toggleLabelsBtn\" class=\"active\" type=\"button\">标签开</button>\r\n    <button id=\"toggleRegionsBtn\" class=\"active\" type=\"button\">分区开</button>\r\n    <button id=\"toggleCoreBtn\" class=\"active\" type=\"button\">内部开</button>\r\n    <button id=\"toggleGridBtn\" class=\"active\" type=\"button\">网格开</button>\r\n    <button id=\"toggleNeuralBtn\" class=\"active\" type=\"button\">神经网络开</button>\r\n    <button id=\"spontaneousBtn\" class=\"active\" type=\"button\">自发脉冲</button>\r\n    <button id=\"frontalPulseBtn\" type=\"button\">前额叶激活</button>\r\n    <button id=\"hippocampusPulseBtn\" type=\"button\">海马体激活</button>\r\n    <button id=\"globalPulseBtn\" type=\"button\">全脑波</button>\r\n    <button id=\"toggleMemoryBtn\" class=\"active\" type=\"button\">Canonical 图开</button>\r\n    <button id=\"memoryXrayBtn\" class=\"active\" type=\"button\">图谱透视开</button>\r\n    <button id=\"toggleObjectGroupingBtn\" type=\"button\" aria-pressed=\"false\">对象分组</button>\r\n    <button id=\"toggleEventKindBtn\" class=\"active kind-event\" type=\"button\">事件</button>\r\n    <button id=\"toggleFactKindBtn\" class=\"active kind-fact\" type=\"button\">实体 / 事实</button>\r\n    <button id=\"toggleSchemaKindBtn\" class=\"active kind-schema\" type=\"button\">模式 / 规则</button>\r\n    <button id=\"memoryConsolidateBtn\" type=\"button\">写入图谱</button>\r\n    <button id=\"memoryRetrieveBtn\" type=\"button\">激活检索</button>\r\n    <button id=\"memoryExampleBtn\" class=\"active\" type=\"button\">证明路径</button>\r\n    <button id=\"memoryNextExampleBtn\" type=\"button\">下一条</button>\r\n    <button id=\"memoryLoadMoreBtn\" class=\"hidden\" type=\"button\">继续加载</button>\r\n    <button id=\"memoryClearExampleBtn\" type=\"button\">清除高亮</button>\r\n  </div>\r\n\r\n  <div class=\"legend\">\r\n    <div class=\"desktop-input-hints\">左键拖动：旋转<br>右键拖动：平移<br>滚轮：缩放</div>\r\n    <div class=\"mobile-input-hint\">拖动旋转 · 双指缩放 / 平移 · 轻触节点看证据</div>\r\n    <div id=\"neuralStatus\">神经激活：自发脉冲</div>\r\n    <div id=\"memoryStatus\">Canonical L3：完整图 · 全图融合</div>\r\n    <div class=\"desktop-node-hint\">点击节点：查看类型、关系与证据</div>\r\n  </div>\r\n\r\n  <div id=\"memoryChainCard\" style=\"\r\n    position:absolute;\r\n    z-index:42;\r\n    left:15px;\r\n    top:112px;\r\n    width:min(430px,calc(100vw - 30px));\r\n    border:1px solid #000;\r\n    background:rgba(255,255,255,.94);\r\n    padding:10px 11px;\r\n    font-size:10px;\r\n    line-height:1.55;\r\n    pointer-events:none;\r\n  \">\r\n    <div style=\"font-weight:800;margin-bottom:6px;\">[ 当前激活证明路径 · CANONICAL L3 ]</div>\r\n    <div><b>查询锚点</b>：<span id=\"chainEventText\">—</span></div>\r\n    <div style=\"margin:3px 0;\">↓ 关系扩展 / 事实约束</div>\r\n    <div><b>实体 / 事实</b>：<span id=\"chainFactText\">—</span></div>\r\n    <div style=\"margin:3px 0;\">↓ 规则匹配 / 推理证明</div>\r\n    <div><b>模式 / 规则</b>：<span id=\"chainSchemaText\">—</span></div>\r\n    <div style=\"margin:3px 0;\">↓ EvidenceLink</div>\r\n    <div><b>证据回源</b>：<span id=\"chainEvidenceText\">—</span></div>\r\n  </div>\r\n\r\n  <div id=\"axisX\" class=\"tag axis\">X</div>\r\n  <div id=\"axisY\" class=\"tag axis\">Y</div>\r\n  <div id=\"axisZ\" class=\"tag axis\">Z</div>\r\n\r\n  <div id=\"tagPrefrontal\" class=\"tag\">前额叶</div>\r\n  <div id=\"tagParietal\" class=\"tag\">顶叶</div>\r\n  <div id=\"tagTemporal\" class=\"tag\">颞叶</div>\r\n  <div id=\"tagOccipital\" class=\"tag\">枕叶</div>\r\n  <div id=\"tagCerebellum\" class=\"tag\">小脑</div>\r\n  <div id=\"tagBrainstem\" class=\"tag\">脑干</div>\r\n  <div id=\"tagHippocampus\" class=\"tag\">海马体</div>\r\n\r\n  <div id=\"memoryKindEventLabel\" class=\"memory-layer-tag kind-event\">L3 · 完整知识图</div>\r\n  <div id=\"memoryKindFactLabel\" class=\"memory-layer-tag kind-fact\">L3 · 实体 / 事实</div>\r\n  <div id=\"memoryKindSchemaLabel\" class=\"memory-layer-tag kind-schema\">L3 · 模式 / 规则</div>\r\n\r\n  <div id=\"memoryKindLegend\" aria-label=\"Canonical L3 对象类型图例\">\r\n    <span class=\"memory-layer-key kind-event\">事件</span>\r\n    <span class=\"memory-layer-key kind-fact\">实体 / 事实</span>\r\n    <span class=\"memory-layer-key kind-schema\">模式 / 规则</span>\r\n  </div>\r\n\r\n  <aside id=\"memoryPanel\" class=\"hidden\" aria-live=\"polite\">\r\n    <div class=\"panel-head\">\r\n      <div>\r\n        <div id=\"memoryPanelKicker\" class=\"panel-kicker\">CANONICAL NODE</div>\r\n        <div id=\"memoryPanelTitle\" class=\"panel-title\">未选择节点</div>\r\n      </div>\r\n      <button id=\"memoryPanelClose\" class=\"panel-close\" type=\"button\" aria-label=\"关闭详情\">×</button>\r\n    </div>\r\n\r\n    <div class=\"field\">\r\n      <span class=\"field-label\">ID / 对象类型</span>\r\n      <div id=\"memoryPanelId\" class=\"field-value\">—</div>\r\n    </div>\r\n\r\n    <div class=\"field\">\r\n      <span class=\"field-label\">摘要</span>\r\n      <div id=\"memoryPanelSummary\" class=\"field-value\">—</div>\r\n    </div>\r\n\r\n    <div class=\"field\">\r\n      <span class=\"field-label\">具体内容</span>\r\n      <div id=\"memoryPanelContent\" class=\"field-value\">—</div>\r\n    </div>\r\n\r\n    <div class=\"field\">\r\n      <span class=\"field-label\">来源 / 时间</span>\r\n      <div id=\"memoryPanelSource\" class=\"field-value\">—</div>\r\n    </div>\r\n\r\n    <div class=\"field\">\r\n      <span class=\"field-label\">关联节点</span>\r\n      <div id=\"memoryPanelRelations\" class=\"field-value\">—</div>\r\n    </div>\r\n\r\n    <div class=\"panel-actions\">\r\n      <button id=\"focusMemoryNodeBtn\" type=\"button\">聚焦节点</button>\r\n      <button id=\"traceMemoryNodeBtn\" type=\"button\">追踪关联</button>\r\n    </div>\r\n  </aside>\r\n</div>\r\n\r\n<script type=\"importmap\">\r\n{\r\n  \"imports\": {\r\n    \"three\": \"/vendor/three/0.180.0/three.module.min.js\",\r\n    \"three/addons/\": \"/vendor/three/0.180.0/addons/\"\r\n  }\r\n}\r\n</script>\r\n\r\n<script type=\"module\">\r\nimport * as THREE from 'three';\r\nimport { OrbitControls } from 'three/addons/controls/OrbitControls.js';\r\n\r\nconst viewport = document.getElementById('viewport');\r\n\r\nconst qualityPresets = {\r\n  high: {\r\n    cortexTheta: 166,\r\n    cortexPhi: 254,\r\n    cortexCube: 0.228,\r\n    cerebellumTheta: 58,\r\n    cerebellumPhi: 92,\r\n    cerebellumCube: 0.255,\r\n    neuralNodes: 820,\r\n    activeSpheres: 88,\r\n    pixelRatioCap: 1.25,\r\n    animationFps: 60,\r\n    antialias: true\r\n  },\r\n  balanced: {\r\n    cortexTheta: 136,\r\n    cortexPhi: 206,\r\n    cortexCube: 0.275,\r\n    cerebellumTheta: 48,\r\n    cerebellumPhi: 74,\r\n    cerebellumCube: 0.30,\r\n    neuralNodes: 560,\r\n    activeSpheres: 56,\r\n    pixelRatioCap: 1,\r\n    animationFps: 30,\r\n    antialias: true\r\n  },\r\n  low: {\r\n    cortexTheta: 104,\r\n    cortexPhi: 158,\r\n    cortexCube: 0.35,\r\n    cerebellumTheta: 38,\r\n    cerebellumPhi: 58,\r\n    cerebellumCube: 0.37,\r\n    neuralNodes: 360,\r\n    activeSpheres: 36,\r\n    pixelRatioCap: 1,\r\n    animationFps: 24,\r\n    antialias: false\r\n  }\r\n};\r\n\r\nconst requestedQuality = new URLSearchParams(window.location.search).get('quality');\r\nconst lowPowerDevice =\r\n  window.matchMedia('(max-width: 700px)').matches ||\r\n  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||\r\n  (navigator.deviceMemory && navigator.deviceMemory <= 4);\r\nconst qualityName = Object.hasOwn(qualityPresets, requestedQuality)\r\n  ? requestedQuality\r\n  : (lowPowerDevice ? 'low' : 'balanced');\r\nconst quality = qualityPresets[qualityName];\r\nconst reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;\r\n\r\nwindow.__brainPerformance = {\r\n  profile: qualityName,\r\n  reducedMotion,\r\n  cortexInstances: 0,\r\n  neuralInitialized: false,\r\n  neuralNodes: 0,\r\n  neuralEdges: 0,\r\n  animationProxyAvailable: false,\r\n  animationProxyActive: false,\r\n  renderCount: 0\r\n};\r\n\r\nconst scene = new THREE.Scene();\r\nscene.background = new THREE.Color(0xffffff);\r\nscene.fog = new THREE.FogExp2(0xffffff, 0.0105);\r\n\r\nconst camera = new THREE.PerspectiveCamera(\r\n  42,\r\n  window.innerWidth / window.innerHeight,\r\n  0.05,\r\n  260\r\n);\r\n\r\n// 初始为接近参考图的正面视角，大脑占画面主体。\r\ncamera.position.set(0, 2.4, 44);\r\n\r\nconst renderer = new THREE.WebGLRenderer({\r\n  antialias: quality.antialias,\r\n  alpha: false,\r\n  powerPreference: 'high-performance'\r\n});\r\nrenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap));\r\nrenderer.setSize(window.innerWidth, window.innerHeight);\r\nrenderer.outputColorSpace = THREE.SRGBColorSpace;\r\nviewport.appendChild(renderer.domElement);\r\n\r\nconst webgl = renderer.getContext();\r\nconst standardRendererName = String(webgl.getParameter(webgl.RENDERER) || '');\r\n// Firefox 已弃用调试扩展并直接公开 RENDERER；Chromium 仍需扩展识别 SwiftShader。\r\nconst debugRendererInfo = /Firefox\\//.test(navigator.userAgent)\r\n  ? null\r\n  : webgl.getExtension('WEBGL_debug_renderer_info');\r\nconst rendererName = debugRendererInfo\r\n  ? String(webgl.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL) || standardRendererName)\r\n  : standardRendererName;\r\nconst softwareRenderer = /swiftshader|llvmpipe|software/i.test(rendererName);\r\nconst targetAnimationFps = Math.min(\r\n  quality.animationFps,\r\n  softwareRenderer ? 12 : quality.animationFps,\r\n  reducedMotion ? 15 : quality.animationFps\r\n);\r\nconst animationFrameInterval = 1000 / targetAnimationFps;\r\n\r\nObject.assign(window.__brainPerformance, {\r\n  pixelRatio: renderer.getPixelRatio(),\r\n  targetAnimationFps,\r\n  renderer: rendererName || 'unknown',\r\n  softwareRenderer\r\n});\r\n\r\nconst ambient = new THREE.AmbientLight(0xffffff, 1.10);\r\nscene.add(ambient);\r\n\r\nconst key = new THREE.DirectionalLight(0xffffff, 1.08);\r\nkey.position.set(13, 17, 18);\r\nscene.add(key);\r\n\r\nconst fill = new THREE.DirectionalLight(0xffffff, 0.30);\r\nfill.position.set(-15, 7, 11);\r\nscene.add(fill);\r\n\r\nconst rear = new THREE.DirectionalLight(0xffffff, 0.16);\r\nrear.position.set(0, 8, -18);\r\nscene.add(rear);\r\n\r\nconst controls = new OrbitControls(camera, renderer.domElement);\r\ncontrols.enableDamping = false;\r\ncontrols.enablePan = true;\r\ncontrols.screenSpacePanning = true;\r\ncontrols.minDistance = 20;\r\ncontrols.maxDistance = 95;\r\ncontrols.rotateSpeed = 0.70;\r\ncontrols.zoomSpeed = 0.85;\r\ncontrols.panSpeed = 0.65;\r\ncontrols.target.set(0, 1.1, -0.9);\r\ncontrols.mouseButtons.LEFT = THREE.MOUSE.ROTATE;\r\ncontrols.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;\r\ncontrols.mouseButtons.RIGHT = THREE.MOUSE.PAN;\r\n\r\n// ---------------------------------------------------------------------\r\n// 无限感稀疏三维网格\r\n// ---------------------------------------------------------------------\r\nconst GRID_STEP = 2.5;\r\nconst HALF_SIZE = 47;\r\n\r\nfunction buildGrid() {\r\n  const normal = [];\r\n  const major = [];\r\n\r\n  const push = (arr, ax, ay, az, bx, by, bz) => arr.push(ax, ay, az, bx, by, bz);\r\n  const isMajor = (v) => Math.abs(v % 10) < 0.001;\r\n\r\n  for (let a = -HALF_SIZE; a <= HALF_SIZE; a += GRID_STEP) {\r\n    for (let b = -HALF_SIZE; b <= HALF_SIZE; b += GRID_STEP) {\r\n      const arr = (isMajor(a) || isMajor(b)) ? major : normal;\r\n      push(arr, -HALF_SIZE, a, b, HALF_SIZE, a, b);\r\n      push(arr, a, -HALF_SIZE, b, a, HALF_SIZE, b);\r\n      push(arr, a, b, -HALF_SIZE, a, b, HALF_SIZE);\r\n    }\r\n  }\r\n\r\n  const group = new THREE.Group();\r\n\r\n  const g1 = new THREE.BufferGeometry();\r\n  g1.setAttribute('position', new THREE.Float32BufferAttribute(normal, 3));\r\n  group.add(new THREE.LineSegments(\r\n    g1,\r\n    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.040 })\r\n  ));\r\n\r\n  const g2 = new THREE.BufferGeometry();\r\n  g2.setAttribute('position', new THREE.Float32BufferAttribute(major, 3));\r\n  group.add(new THREE.LineSegments(\r\n    g2,\r\n    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.095 })\r\n  ));\r\n\r\n  return group;\r\n}\r\n\r\nconst grid = buildGrid();\r\nscene.add(grid);\r\n\r\n// ---------------------------------------------------------------------\r\n// 坐标轴\r\n// ---------------------------------------------------------------------\r\nconst AXIS_LEN = 31;\r\n\r\nfunction line(a, b, opacity=0.95) {\r\n  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);\r\n  return new THREE.Line(\r\n    geo,\r\n    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity })\r\n  );\r\n}\r\n\r\nscene.add(line(new THREE.Vector3(-AXIS_LEN,0,0), new THREE.Vector3(AXIS_LEN,0,0)));\r\nscene.add(line(new THREE.Vector3(0,-AXIS_LEN,0), new THREE.Vector3(0,AXIS_LEN,0)));\r\nscene.add(line(new THREE.Vector3(0,0,-AXIS_LEN), new THREE.Vector3(0,0,AXIS_LEN)));\r\n\r\nconst origin = new THREE.Mesh(\r\n  new THREE.SphereGeometry(0.035, 10, 10),\r\n  new THREE.MeshBasicMaterial({ color: 0x000000 })\r\n);\r\nscene.add(origin);\r\n\r\n[\r\n  [new THREE.Vector3(1,0,0), new THREE.Vector3(AXIS_LEN-1.1,0,0)],\r\n  [new THREE.Vector3(0,1,0), new THREE.Vector3(0,AXIS_LEN-1.1,0)],\r\n  [new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,AXIS_LEN-1.1)]\r\n].forEach(([dir,pos]) => {\r\n  scene.add(new THREE.ArrowHelper(dir, pos, 1.1, 0x000000, 0.30, 0.15));\r\n});\r\n\r\n// ---------------------------------------------------------------------\r\n// 大脑参数\r\n// ---------------------------------------------------------------------\r\nconst brainRoot = new THREE.Group();\r\nbrainRoot.scale.set(1.24, 1.24, 1.24);\r\nbrainRoot.position.set(0, 0.6, 0);\r\nscene.add(brainRoot);\r\n\r\nconst regionGray = {\r\n  prefrontal: 0xe3e3e3,\r\n  parietal: 0xd8d8d8,\r\n  temporal: 0xcecece,\r\n  occipital: 0xc4c4c4,\r\n  cerebellum: 0xb9b9b9,\r\n  brainstem: 0xaaaaaa,\r\n  hippocampus: 0x9c9c9c\r\n};\r\n\r\nlet cortexMeshes = [];\r\nlet coreMeshes = [];\r\nconst cortexAnimationPairs = [];\r\nconst lightweightAnimationReasons = new Set();\r\nlet labelsVisible = true;\r\nlet regionsVisible = true;\r\nlet coreVisible = true;\r\nlet gridVisible = true;\r\nlet renderSuspended = false;\r\nlet scheduledRender = 0;\r\n\r\nfunction createCortexAnimationProxy(mesh, points, pointSize, shadeForPoint=()=>1) {\r\n  if (!softwareRenderer || !points.length) return;\r\n\r\n  const sampleStride = 4;\r\n  const sampleCount = Math.ceil(points.length / sampleStride);\r\n  const positions = new Float32Array(sampleCount * 3);\r\n  const shades = new Float32Array(sampleCount * 3);\r\n\r\n  for (let source = 0, target = 0; source < points.length; source += sampleStride, target++) {\r\n    const p = points[source];\r\n    const shade = shadeForPoint(p);\r\n    positions[target*3] = p.x;\r\n    positions[target*3+1] = p.y;\r\n    positions[target*3+2] = p.z;\r\n    shades[target*3] = shade;\r\n    shades[target*3+1] = shade;\r\n    shades[target*3+2] = shade;\r\n  }\r\n\r\n  const geometry = new THREE.BufferGeometry();\r\n  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));\r\n  geometry.setAttribute('color', new THREE.BufferAttribute(shades, 3));\r\n\r\n  const proxy = new THREE.Points(\r\n    geometry,\r\n    new THREE.PointsMaterial({\r\n      color: regionGray[mesh.userData.region],\r\n      size: pointSize * 1.65,\r\n      vertexColors: true,\r\n      transparent: true,\r\n      opacity: 0.34,\r\n      sizeAttenuation: true,\r\n      depthWrite: false\r\n    })\r\n  );\r\n  proxy.visible = false;\r\n  proxy.renderOrder = 3;\r\n  proxy.userData.region = mesh.userData.region;\r\n  brainRoot.add(proxy);\r\n  cortexAnimationPairs.push({ mesh, proxy });\r\n  window.__brainPerformance.animationProxyAvailable = true;\r\n}\r\n\r\nfunction setLightweightAnimation(reason, active) {\r\n  if (!softwareRenderer) return;\r\n\r\n  if (active) lightweightAnimationReasons.add(reason);\r\n  else lightweightAnimationReasons.delete(reason);\r\n\r\n  const proxyActive = lightweightAnimationReasons.size > 0;\r\n  cortexAnimationPairs.forEach(({mesh, proxy}) => {\r\n    mesh.visible = !proxyActive;\r\n    proxy.visible = proxyActive;\r\n  });\r\n  window.__brainPerformance.animationProxyActive = proxyActive;\r\n}\r\n\r\n// ---------------------------------------------------------------------\r\n// 皮层曲面：用参数化表面直接铺设超细小方块。\r\n// 相比全体积暴力扫描，这样能把更多方块集中到真正可见的皮层。\r\n// ---------------------------------------------------------------------\r\nfunction cortexRegion(x, y, z) {\r\n  if (z > 4.8 && y > -1.2) return 'prefrontal';\r\n  if (z < -6.2 && y > -1.4) return 'occipital';\r\n  if (y < 2.0 && Math.abs(x) > 4.2 && z > -5.2) return 'temporal';\r\n  if (y > 4.8 && z > -5.8) return 'parietal';\r\n  return 'parietal';\r\n}\r\n\r\nfunction corticalField(theta, phi, side, xN, yN, zN) {\r\n  const superior = clamp01((yN + 1.0) * 0.5);\r\n  const lateral = clamp01(Math.abs(xN));\r\n  const frontal = clamp01((zN + 1.0) * 0.5);\r\n  const occipital = clamp01((-zN + 1.0) * 0.5);\r\n  const inferior = clamp01((-yN + 1.0) * 0.5);\r\n\r\n  const prefrontalW = frontal * (0.34 + 0.66 * lateral) * (0.50 + 0.50 * superior);\r\n  const parietalW = superior * (1.0 - frontal * 0.26) * (1.0 - occipital * 0.20);\r\n  const temporalW = inferior * lateral * (0.72 + 0.28 * frontal);\r\n  const occipitalW = occipital * (0.54 + 0.46 * superior);\r\n\r\n  // 前额叶：竖向、扇形、长短交替\r\n  const prefrontal =\r\n    0.20 * Math.sin((zN * 5.0 - yN * 1.15 + side * 0.13) * Math.PI) +\r\n    0.105 * Math.sin((zN * 8.6 + xN * 1.10 - yN * 0.45) * Math.PI) +\r\n    0.050 * Math.sin((zN * 13.5 + xN * 2.1) * Math.PI);\r\n\r\n  // 顶叶：前后向长回 + 次级横纹\r\n  const parietal =\r\n    0.235 * Math.sin((xN * 4.45 + zN * 0.46 + side * 0.10) * Math.PI) +\r\n    0.105 * Math.sin((xN * 7.9 - zN * 0.85 + yN * 0.33) * Math.PI) +\r\n    0.047 * Math.sin((xN * 13.1 + zN * 1.75) * Math.PI);\r\n\r\n  // 颞叶：水平弧形沟回为主\r\n  const temporal =\r\n    0.195 * Math.sin((yN * 3.15 + zN * 2.48 + xN * 0.33) * Math.PI) +\r\n    0.092 * Math.sin((zN * 5.35 - yN * 1.12 - side * 0.16) * Math.PI) +\r\n    0.042 * Math.sin((zN * 9.2 + yN * 2.6) * Math.PI);\r\n\r\n  // 枕叶：较短、较密、更碎\r\n  const occipitalF =\r\n    0.145 * Math.sin((xN * 2.65 - zN * 3.85) * Math.PI) +\r\n    0.088 * Math.sin((xN * 4.10 - zN * 6.85 + yN * 0.42) * Math.PI) +\r\n    0.040 * Math.sin((xN * 7.8 - zN * 11.0) * Math.PI);\r\n\r\n  return prefrontalW * prefrontal +\r\n         parietalW * parietal +\r\n         temporalW * temporal +\r\n         occipitalW * occipitalF;\r\n}\r\n\r\nfunction gauss(v, center, width) {\r\n  const d = (v - center) / width;\r\n  return Math.exp(-d * d);\r\n}\r\n\r\nfunction clamp01(v) {\r\n  return Math.min(1, Math.max(0, v));\r\n}\r\n\r\nfunction smoothstep(edge0, edge1, x) {\r\n  const t = clamp01((x - edge0) / (edge1 - edge0));\r\n  return t * t * (3 - 2 * t);\r\n}\r\n\r\nfunction groove(distance, width) {\r\n  const d = distance / width;\r\n  return Math.exp(-d * d);\r\n}\r\n\r\nfunction ridge(distance, width) {\r\n  const d = distance / width;\r\n  return Math.exp(-d * d);\r\n}\r\n\r\nfunction buildCortexHemisphere(side) {\r\n  const thetaSteps = quality.cortexTheta;\r\n  const phiBaseSteps = quality.cortexPhi;\r\n  const cubeSize = quality.cortexCube;\r\n  const geo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);\r\n\r\n  const byRegion = {\r\n    prefrontal: [],\r\n    parietal: [],\r\n    temporal: [],\r\n    occipital: []\r\n  };\r\n\r\n  for (let ti = 0; ti < thetaSteps; ti++) {\r\n    const theta = Math.PI * ti / (thetaSteps - 1);\r\n    const sinT = Math.sin(theta);\r\n    const cosT = Math.cos(theta);\r\n\r\n    const ringCount = Math.max(1, Math.round(phiBaseSteps * Math.max(0.036, sinT)));\r\n    const phiOffset = (ti % 2) * Math.PI / Math.max(3, ringCount);\r\n\r\n    for (let pi = 0; pi < ringCount; pi++) {\r\n      const phi = (Math.PI * 2 * pi / ringCount) + phiOffset;\r\n      const cosP = Math.cos(phi);\r\n      const sinP = Math.sin(phi);\r\n\r\n      // 正面轮廓更接近参考图：主体更圆润，顶部更高，左右对称更好。\r\n      let rx = 9.2;\r\n      let ry = 12.0;\r\n      let rz = 9.8;\r\n\r\n      const lower = Math.max(0, -cosT);\r\n      rx *= 1.0 - lower * 0.13;\r\n      rz *= 1.0 - lower * 0.10;\r\n\r\n      const frontBias = Math.max(0, sinP);\r\n      const backBias = Math.max(0, -sinP);\r\n      rz *= 1.0 + frontBias * 0.09 - backBias * 0.05;\r\n\r\n      // 顶叶-额叶顶冠稍饱满，颞下部稍内收\r\n      const superiorBoost = Math.max(0, cosT);\r\n      rx *= 1.0 + superiorBoost * 0.03;\r\n      ry *= 1.0 + superiorBoost * 0.02;\r\n\r\n      const centerX = side * 5.15;\r\n\r\n      let x = centerX + rx * sinT * cosP;\r\n      let y = 2.65 + ry * cosT;\r\n      let z = rz * sinT * sinP;\r\n\r\n      // 更自然的左右脑中缝：不是简单直缝，而是上宽下窄、略带弧度的纵裂\r\n      const fissureWidth =\r\n        0.34 +\r\n        0.23 * gauss(y, 8.8, 5.4) +\r\n        0.07 * gauss(z, 0.0, 7.0);\r\n\r\n      const medialInfluence = Math.exp(-Math.pow(Math.abs(x) / 2.1, 2));\r\n      x += side * medialInfluence * (0.78 + 0.18 * gauss(y, 8.0, 5.0));\r\n\r\n      const xN = THREE.MathUtils.clamp((x - centerX) / 10.5, -1, 1);\r\n      const yN = THREE.MathUtils.clamp((y - 2.65) / 12.0, -1, 1);\r\n      const zN = THREE.MathUtils.clamp(z / 10.2, -1, 1);\r\n\r\n      const polarFade = smoothstep(0.12, 0.34, sinT);\r\n\r\n      const crownMask = gauss(theta, 0.12 * Math.PI, 0.12 * Math.PI);\r\n      const superiorMask = gauss(y, 12.4, 3.4);\r\n      const medialMask = gauss(Math.abs(x), 3.0, 2.2);\r\n\r\n      const f = corticalField(theta, phi, side, xN, yN, zN);\r\n\r\n      let displacement = f * 0.64 * polarFade;\r\n      displacement *= (1.0 - 0.43 * crownMask * superiorMask);\r\n      displacement *= (1.0 - 0.14 * medialMask);\r\n\r\n      // -------------------------\r\n      // 真实感主沟 / 次级沟系统\r\n      // -------------------------\r\n\r\n      // 中央沟：S 形、向下外侧延伸\r\n      const centralCurve =\r\n        2.0 +\r\n        0.95 * Math.sin(x * 0.115) -\r\n        0.085 * (y - 5.5) +\r\n        0.16 * Math.sin(y * 0.28);\r\n\r\n      let centralDepth =\r\n        groove(z - centralCurve, 0.56) *\r\n        gauss(y, 6.2, 5.8) *\r\n        (0.30 + 0.70 * Math.min(1, Math.abs(x) / 9.2));\r\n      centralDepth *= polarFade;\r\n      centralDepth *= (1.0 - 0.80 * crownMask * superiorMask);\r\n      displacement -= centralDepth * 1.34;\r\n\r\n      // 中央后沟：中央沟后方较浅的次级沟\r\n      const postCentralCurve =\r\n        -0.35 +\r\n        0.72 * Math.sin(x * 0.10 + 0.35) -\r\n        0.055 * (y - 5.0);\r\n\r\n      let postCentral =\r\n        groove(z - postCentralCurve, 0.43) *\r\n        gauss(y, 6.6, 4.7) *\r\n        Math.min(1, Math.max(0, (Math.abs(x) - 2.3) / 6.5));\r\n      postCentral *= polarFade;\r\n      displacement -= postCentral * 0.62;\r\n\r\n      // 顶内沟：顶叶区域横向长沟\r\n      const intraparietalCurve =\r\n        -2.6 +\r\n        0.55 * Math.sin(x * 0.13 - 0.2) +\r\n        0.10 * (y - 7.0);\r\n\r\n      let intraparietal =\r\n        groove(z - intraparietalCurve, 0.39) *\r\n        gauss(y, 8.1, 3.5) *\r\n        Math.min(1, Math.max(0, (Math.abs(x) - 3.0) / 5.5));\r\n      intraparietal *= polarFade;\r\n      displacement -= intraparietal * 0.56;\r\n\r\n      // 外侧裂：颞叶上缘，弧形更明显\r\n      const lateralTarget =\r\n        0.85 +\r\n        0.58 * Math.sin(z * 0.19) -\r\n        0.035 * (Math.abs(x) - 7.0);\r\n\r\n      let lateralDepth =\r\n        groove(y - lateralTarget, 0.48) *\r\n        gauss(z, 2.0, 5.9) *\r\n        Math.min(1, Math.max(0, (Math.abs(x) - 3.6) / 6.6));\r\n      lateralDepth *= polarFade;\r\n      lateralDepth *= (1.0 - 0.77 * crownMask);\r\n      displacement -= lateralDepth * 1.36;\r\n\r\n      // 上颞沟：与外侧裂平行但更浅\r\n      const supTemporalTarget =\r\n        -0.95 +\r\n        0.42 * Math.sin(z * 0.20 + 0.65);\r\n\r\n      let superiorTemporal =\r\n        groove(y - supTemporalTarget, 0.36) *\r\n        gauss(z, 1.2, 5.4) *\r\n        Math.min(1, Math.max(0, (Math.abs(x) - 5.1) / 5.5));\r\n      displacement -= superiorTemporal * 0.54;\r\n\r\n      // 下颞沟：更靠下、更弱\r\n      const infTemporalTarget =\r\n        -2.9 +\r\n        0.34 * Math.sin(z * 0.18 - 0.5);\r\n\r\n      let inferiorTemporal =\r\n        groove(y - infTemporalTarget, 0.32) *\r\n        gauss(z, 0.8, 5.0) *\r\n        Math.min(1, Math.max(0, (Math.abs(x) - 5.5) / 5.0));\r\n      displacement -= inferiorTemporal * 0.38;\r\n\r\n      // 顶枕沟：后上部明显沟槽\r\n      let occDepth =\r\n        groove(z + 5.75 - 0.34 * Math.sin(x * 0.16), 0.48) *\r\n        gauss(y, 7.3, 4.0);\r\n      occDepth *= polarFade;\r\n      occDepth *= (1.0 - 0.33 * crownMask * superiorMask);\r\n      displacement -= occDepth * 0.96;\r\n\r\n      // 额叶次级沟：上额沟 / 下额沟\r\n      const frontalSide = Math.min(1, Math.max(0, (Math.abs(x) - 4.0) / 5.5));\r\n      let supFrontal =\r\n        groove(y - (7.7 + 0.38 * Math.sin(z * 0.20)), 0.34) *\r\n        gauss(z, 6.2, 4.3) *\r\n        frontalSide;\r\n      displacement -= supFrontal * 0.44;\r\n\r\n      let infFrontal =\r\n        groove(y - (4.2 + 0.32 * Math.sin(z * 0.22 + 0.4)), 0.32) *\r\n        gauss(z, 6.1, 4.2) *\r\n        frontalSide;\r\n      displacement -= infFrontal * 0.39;\r\n\r\n      // -------------------------\r\n      // 脑回凸起：沟与沟之间轻微抬高\r\n      // -------------------------\r\n      const superiorFrontalRidge =\r\n        ridge(y - 9.2, 0.65) * gauss(z, 6.1, 4.5) * frontalSide;\r\n      displacement += superiorFrontalRidge * 0.25;\r\n\r\n      const precentralRidge =\r\n        ridge(z - (3.25 + 0.80 * Math.sin(x * 0.11)), 0.74) *\r\n        gauss(y, 6.0, 5.0) *\r\n        Math.min(1, Math.max(0, (Math.abs(x) - 2.4) / 6.0));\r\n      displacement += precentralRidge * 0.23;\r\n\r\n      const postcentralRidge =\r\n        ridge(z - (0.75 + 0.68 * Math.sin(x * 0.10 + 0.15)), 0.70) *\r\n        gauss(y, 6.3, 4.8);\r\n      displacement += postcentralRidge * 0.19;\r\n\r\n      // -------------------------\r\n      // 第三级区域化脑沟网络\r\n      // 这些沟槽更细、更碎，主要用于让大脑皮层远看也能看到明显沟回层次。\r\n      // -------------------------\r\n      const frontalWeight = clamp01((zN + 0.05) / 0.95) * clamp01((Math.abs(xN) + 0.15) / 1.15);\r\n      const parietalWeight = clamp01((yN + 0.10) / 0.90) * (1.0 - frontalWeight * 0.35);\r\n      const temporalWeight = clamp01((-yN + 0.10) / 1.05) * clamp01((Math.abs(xN) - 0.10) / 0.90);\r\n      const occipitalWeight = clamp01((-zN + 0.12) / 1.05);\r\n\r\n      const frontalFineA = groove(\r\n        Math.sin((zN * 8.4 - yN * 2.1 + xN * 0.55) * Math.PI),\r\n        0.34\r\n      );\r\n      const frontalFineB = groove(\r\n        Math.sin((zN * 12.2 + xN * 1.8 - yN * 0.7) * Math.PI),\r\n        0.28\r\n      );\r\n      displacement -= frontalWeight * (frontalFineA * 0.12 + frontalFineB * 0.08) * polarFade;\r\n\r\n      const parietalFineA = groove(\r\n        Math.sin((xN * 7.8 + zN * 1.2 + yN * 0.35) * Math.PI),\r\n        0.32\r\n      );\r\n      const parietalFineB = groove(\r\n        Math.sin((xN * 11.6 - zN * 2.2) * Math.PI),\r\n        0.27\r\n      );\r\n      displacement -= parietalWeight * (parietalFineA * 0.13 + parietalFineB * 0.075) * polarFade;\r\n\r\n      const temporalFineA = groove(\r\n        Math.sin((yN * 7.0 + zN * 4.4 + xN * 0.55) * Math.PI),\r\n        0.32\r\n      );\r\n      const temporalFineB = groove(\r\n        Math.sin((zN * 9.8 - yN * 3.3) * Math.PI),\r\n        0.27\r\n      );\r\n      displacement -= temporalWeight * (temporalFineA * 0.12 + temporalFineB * 0.075) * polarFade;\r\n\r\n      const occipitalFineA = groove(\r\n        Math.sin((xN * 6.0 - zN * 8.8 + yN * 0.5) * Math.PI),\r\n        0.31\r\n      );\r\n      const occipitalFineB = groove(\r\n        Math.sin((xN * 9.2 - zN * 13.0) * Math.PI),\r\n        0.25\r\n      );\r\n      displacement -= occipitalWeight * (occipitalFineA * 0.12 + occipitalFineB * 0.07) * polarFade;\r\n\r\n      // 对应脑回凸起，让沟和回的高度差更明显\r\n      const corticalRidgeNetwork =\r\n        0.055 * Math.max(0, Math.sin((xN * 5.2 + zN * 2.1 - yN * 0.6) * Math.PI)) +\r\n        0.040 * Math.max(0, Math.sin((xN * 8.8 - zN * 3.2 + yN * 1.1) * Math.PI));\r\n      displacement += corticalRidgeNetwork * polarFade;\r\n\r\n      // 微细局部凹陷，只做表面起伏，不形成穿孔\r\n      const microIndent =\r\n        0.095 * Math.max(0, Math.sin((xN * 11.0 + zN * 5.4 + yN * 2.1) * Math.PI)) +\r\n        0.065 * Math.max(0, Math.sin((xN * 17.0 - zN * 8.2) * Math.PI));\r\n      displacement -= microIndent * polarFade * (0.48 + 0.72 * Math.abs(xN));\r\n\r\n      // 顶部严格限制过深凹陷，避免出现“孔洞”\r\n      const crownSmooth = crownMask * superiorMask;\r\n      if (crownSmooth > 0.10 && displacement < -0.16) {\r\n        displacement = -0.16 + (displacement + 0.16) * 0.11;\r\n      }\r\n\r\n      // 全局凹陷限幅：保持明显脑沟，但不允许形成穿孔\r\n      displacement = Math.max(displacement, -1.42);\r\n\r\n      const nx = (x - centerX) / (rx * rx);\r\n      const ny = (y - 2.65) / (ry * ry);\r\n      const nz = z / (rz * rz);\r\n      const nl = Math.hypot(nx, ny, nz) || 1;\r\n\r\n      x += nx / nl * displacement;\r\n      y += ny / nl * displacement;\r\n      z += nz / nl * displacement;\r\n\r\n      // 下缘修型，保持更像参考图的正面轮廓\r\n      if (y < -5.5 && Math.abs(x) > 8.0 && z > 1.0) continue;\r\n      if (y < -7.6) continue;\r\n      if (z > 12.0 && Math.abs(x) > 8.2) continue;\r\n\r\n      // 纵裂裁切更自然\r\n      if (Math.abs(x) < fissureWidth && y > -0.5) continue;\r\n\r\n      const region = cortexRegion(x, y, z);\r\n      const depth = THREE.MathUtils.clamp((displacement + 1.48) / 3.05, 0, 1);\r\n      byRegion[region].push({ x, y, z, depth });\r\n    }\r\n  }\r\n\r\n  Object.entries(byRegion).forEach(([region, points]) => {\r\n    const mat = new THREE.MeshLambertMaterial({\r\n      color: regionGray[region],\r\n      transparent: true,\r\n      opacity: 0.96\r\n    });\r\n\r\n    const mesh = new THREE.InstancedMesh(geo, mat, points.length);\r\n    const dummy = new THREE.Object3D();\r\n    const base = new THREE.Color(regionGray[region]);\r\n    const shadeColor = new THREE.Color();\r\n\r\n    for (let i = 0; i < points.length; i++) {\r\n      const p = points[i];\r\n      dummy.position.set(p.x, p.y, p.z);\r\n      dummy.scale.set(1, 1, 1);\r\n      dummy.updateMatrix();\r\n      mesh.setMatrixAt(i, dummy.matrix);\r\n\r\n      const shade = 0.58 + p.depth * 0.46;\r\n      mesh.setColorAt(i, shadeColor.copy(base).multiplyScalar(shade));\r\n    }\r\n\r\n    mesh.instanceMatrix.needsUpdate = true;\r\n    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;\r\n    mesh.userData.region = region;\r\n    mesh.userData.kind = 'cortex';\r\n    brainRoot.add(mesh);\r\n    cortexMeshes.push(mesh);\r\n    createCortexAnimationProxy(\r\n      mesh,\r\n      points,\r\n      cubeSize * 1.15,\r\n      p => 0.58 + p.depth * 0.46\r\n    );\r\n    window.__brainPerformance.cortexInstances += points.length;\r\n  });\r\n}\r\n\r\nbuildCortexHemisphere(-1);\r\nbuildCortexHemisphere(1);\r\n\r\n// ---------------------------------------------------------------------\r\n// 小脑：更高频的横向回纹\r\n// ---------------------------------------------------------------------\r\nfunction buildCerebellumLobe(side) {\r\n  const thetaSteps = quality.cerebellumTheta;\r\n  const phiSteps = quality.cerebellumPhi;\r\n  const cubeSize = quality.cerebellumCube;\r\n  const geo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);\r\n  const pts = [];\r\n\r\n  const cx = side * 4.0;\r\n  const cy = -6.7;\r\n  const cz = -6.9;\r\n\r\n  for (let ti = 3; ti < thetaSteps - 3; ti++) {\r\n    const theta = Math.PI * ti / (thetaSteps - 1);\r\n    for (let pi = 0; pi < phiSteps; pi++) {\r\n      const phi = Math.PI * 2 * pi / phiSteps;\r\n\r\n      const sinT = Math.sin(theta);\r\n      const cosT = Math.cos(theta);\r\n\r\n      let x = cx + 4.0 * sinT * Math.cos(phi);\r\n      let y = cy + 2.65 * cosT;\r\n      let z = cz + 3.1 * sinT * Math.sin(phi);\r\n\r\n      // 更像小脑叶片（folia）的横向细纹\r\n      const stripe =\r\n        Math.sin(theta * 22.0 + Math.sin(phi * 2.2)) * 0.22 +\r\n        Math.sin(phi * 6.0) * 0.05;\r\n\r\n      const nx = (x - cx) / (4.0 * 4.0);\r\n      const ny = (y - cy) / (2.65 * 2.65);\r\n      const nz = (z - cz) / (3.1 * 3.1);\r\n      const nl = Math.hypot(nx, ny, nz) || 1;\r\n\r\n      x += nx / nl * stripe;\r\n      y += ny / nl * stripe;\r\n      z += nz / nl * stripe;\r\n\r\n      pts.push({x,y,z,depth:(stripe+0.35)/0.7});\r\n    }\r\n  }\r\n\r\n  const mat = new THREE.MeshLambertMaterial({\r\n    color: regionGray.cerebellum,\r\n    transparent: true,\r\n    opacity: 0.93\r\n  });\r\n\r\n  const mesh = new THREE.InstancedMesh(geo, mat, pts.length);\r\n  const dummy = new THREE.Object3D();\r\n  const base = new THREE.Color(regionGray.cerebellum);\r\n  const shadeColor = new THREE.Color();\r\n\r\n  pts.forEach((p, i) => {\r\n    dummy.position.set(p.x, p.y, p.z);\r\n    dummy.updateMatrix();\r\n    mesh.setMatrixAt(i, dummy.matrix);\r\n    mesh.setColorAt(i, shadeColor.copy(base).multiplyScalar(0.81 + p.depth * 0.16));\r\n  });\r\n\r\n  mesh.instanceMatrix.needsUpdate = true;\r\n  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;\r\n  mesh.userData.region = 'cerebellum';\r\n  mesh.userData.kind = 'cortex';\r\n  brainRoot.add(mesh);\r\n  cortexMeshes.push(mesh);\r\n  createCortexAnimationProxy(\r\n    mesh,\r\n    pts,\r\n    cubeSize * 1.15,\r\n    p => 0.81 + p.depth * 0.16\r\n  );\r\n  window.__brainPerformance.cortexInstances += pts.length;\r\n}\r\n\r\nbuildCerebellumLobe(-1);\r\nbuildCerebellumLobe(1);\r\n\r\n// ---------------------------------------------------------------------\r\n// 脑干：参考图中明显的向下延伸结构\r\n// ---------------------------------------------------------------------\r\nfunction buildBrainStem() {\r\n  const pts = [];\r\n  const stepY = 0.30;\r\n  const ring = 16;\r\n\r\n  for (let y = -7.3; y >= -15.6; y -= stepY) {\r\n    const t = (Math.abs(y + 7.3)) / 8.3;\r\n    const radius = 0.95 - t * 0.42 + Math.sin(t * 7.0) * 0.04;\r\n\r\n    for (let i = 0; i < ring; i++) {\r\n      const a = Math.PI * 2 * i / ring;\r\n      pts.push({\r\n        x: Math.cos(a) * radius * 0.72,\r\n        y,\r\n        z: -5.9 + Math.sin(a) * radius * 0.52\r\n      });\r\n    }\r\n  }\r\n\r\n  const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);\r\n  const mat = new THREE.MeshLambertMaterial({\r\n    color: regionGray.brainstem,\r\n    transparent: true,\r\n    opacity: 0.92\r\n  });\r\n\r\n  const mesh = new THREE.InstancedMesh(geo, mat, pts.length);\r\n  const dummy = new THREE.Object3D();\r\n\r\n  pts.forEach((p,i) => {\r\n    dummy.position.set(p.x,p.y,p.z);\r\n    dummy.updateMatrix();\r\n    mesh.setMatrixAt(i,dummy.matrix);\r\n  });\r\n\r\n  mesh.instanceMatrix.needsUpdate = true;\r\n  mesh.userData.region = 'brainstem';\r\n  mesh.userData.kind = 'cortex';\r\n  brainRoot.add(mesh);\r\n  cortexMeshes.push(mesh);\r\n  createCortexAnimationProxy(mesh, pts, 0.26, () => 0.92);\r\n  window.__brainPerformance.cortexInstances += pts.length;\r\n}\r\n\r\nbuildBrainStem();\r\n\r\n// ---------------------------------------------------------------------\r\n// 半透明内部：较粗体素，只表达深层结构与层次，不抢皮层视觉。\r\n// ---------------------------------------------------------------------\r\nfunction insideCore(x,y,z) {\r\n  const left =\r\n    Math.pow((x + 5.0)/8.8, 2) +\r\n    Math.pow((y - 2.3)/9.2, 2) +\r\n    Math.pow(z/8.6, 2) <= 1;\r\n\r\n  const right =\r\n    Math.pow((x - 5.0)/8.8, 2) +\r\n    Math.pow((y - 2.3)/9.2, 2) +\r\n    Math.pow(z/8.6, 2) <= 1;\r\n\r\n  return left || right;\r\n}\r\n\r\nfunction buildCore() {\r\n  const step = 1.30;\r\n  const positions = [];\r\n\r\n  for (let x=-13; x<=13; x+=step) {\r\n    for (let y=-6; y<=11; y+=step) {\r\n      for (let z=-10; z<=10; z+=step) {\r\n        if (!insideCore(x,y,z)) continue;\r\n        if (Math.abs(x) < 0.95 && y > -0.5) continue;\r\n\r\n        // 只保留一部分点，让内部有“半透明层”而不是实心墙。\r\n        const mask = Math.sin(x*0.83) + Math.cos(y*0.71) + Math.sin(z*0.77);\r\n        if (mask > 1.65) continue;\r\n\r\n        positions.push([x,y,z]);\r\n      }\r\n    }\r\n  }\r\n\r\n  const geo = new THREE.BoxGeometry(0.96,0.96,0.96);\r\n  const mat = new THREE.MeshStandardMaterial({\r\n    color: 0xcfcfcf,\r\n    roughness: 1,\r\n    transparent: true,\r\n    opacity: 0.11,\r\n    depthWrite: false\r\n  });\r\n\r\n  const mesh = new THREE.InstancedMesh(geo, mat, positions.length);\r\n  const dummy = new THREE.Object3D();\r\n\r\n  positions.forEach((p,i) => {\r\n    dummy.position.set(p[0],p[1],p[2]);\r\n    dummy.updateMatrix();\r\n    mesh.setMatrixAt(i,dummy.matrix);\r\n  });\r\n\r\n  mesh.instanceMatrix.needsUpdate = true;\r\n  mesh.userData.kind = 'core';\r\n  brainRoot.add(mesh);\r\n  coreMeshes.push(mesh);\r\n}\r\n\r\nbuildCore();\r\n\r\n// 海马体：内部较深灰的半透明双侧结构\r\nfunction buildHippocampus(side) {\r\n  const pts = [];\r\n  const steps = 78;\r\n  for (let i=0;i<steps;i++) {\r\n    const t = i/(steps-1);\r\n    const a = -1.15 + t*2.30;\r\n    const x = side*(4.3 + Math.cos(a)*1.8);\r\n    const y = -0.8 + Math.sin(a)*1.05;\r\n    const z = -1.4 + Math.sin(a*1.35)*2.1;\r\n\r\n    for (let r=0;r<7;r++) {\r\n      const aa = Math.PI*2*r/7;\r\n      pts.push([\r\n        x + Math.cos(aa)*0.42,\r\n        y + Math.sin(aa)*0.30,\r\n        z + Math.sin(aa)*0.42\r\n      ]);\r\n    }\r\n  }\r\n\r\n  const geo = new THREE.BoxGeometry(0.28,0.28,0.28);\r\n  const mat = new THREE.MeshStandardMaterial({\r\n    color: regionGray.hippocampus,\r\n    roughness: 1,\r\n    transparent: true,\r\n    opacity: 0.38,\r\n    depthWrite: false\r\n  });\r\n\r\n  const mesh = new THREE.InstancedMesh(geo, mat, pts.length);\r\n  const dummy = new THREE.Object3D();\r\n\r\n  pts.forEach((p,i)=>{\r\n    dummy.position.set(...p);\r\n    dummy.updateMatrix();\r\n    mesh.setMatrixAt(i,dummy.matrix);\r\n  });\r\n\r\n  mesh.instanceMatrix.needsUpdate = true;\r\n  mesh.userData.kind = 'core';\r\n  mesh.userData.region = 'hippocampus';\r\n  brainRoot.add(mesh);\r\n  coreMeshes.push(mesh);\r\n}\r\n\r\nbuildHippocampus(-1);\r\nbuildHippocampus(1);\r\n\r\n// ---------------------------------------------------------------------\r\n// V11 神经元激活模拟\r\n// ---------------------------------------------------------------------\r\n// 说明：这里是前端视觉层面的“神经激活传播”原型。\r\n// 它模拟节点、连接和激活波传播，不等同于真实脑神经电生理模型。\r\n\r\nconst neuralGroup = new THREE.Group();\r\nbrainRoot.add(neuralGroup);\r\n\r\nlet neuralVisible = true;\r\nlet neuralMode = 'spontaneous';\r\nlet neuralRAF = 0;\r\nlet neuralStartTime = performance.now();\r\nlet spontaneousSeedIndex = 0;\r\nlet neuralInitialized = false;\r\nlet neuralLastFrame = 0;\r\n\r\nconst neuronPositions = [];\r\nconst neuronRegions = [];\r\nconst neuronAdj = [];\r\nconst edgePairs = [];\r\nconst activationDistance = [];\r\nconst rankedActivation = [];\r\nlet activationValues = null;\r\nlet neuronGeometry = null;\r\nlet neuronMaterial = null;\r\nlet neuronPoints = null;\r\nlet edgeGeometry = null;\r\nlet edgeMaterial = null;\r\nlet neuralEdges = null;\r\nlet activeSpheres = null;\r\nconst MAX_ACTIVE_SPHERES = quality.activeSpheres;\r\nconst neuralDummy = new THREE.Object3D();\r\n\r\n// 神经网络叠加层使用冷蓝灰到近白的激活色，不改变底层方块脑和 Canonical 对象颜色。\r\nconst NEURAL_NODE_REST = [0.52, 0.63, 0.72];\r\nconst NEURAL_NODE_ACTIVE = [0.88, 0.95, 1.00];\r\nconst NEURAL_EDGE_REST = [0.60, 0.70, 0.78];\r\nconst NEURAL_EDGE_ACTIVE = [0.84, 0.92, 0.98];\r\nconst NEURAL_PULSE_HEX = 0xd8ebf5;\r\n\r\nfunction seededRandomFactory(seed=20260823) {\r\n  let s = seed >>> 0;\r\n  return function() {\r\n    s += 0x6D2B79F5;\r\n    let t = s;\r\n    t = Math.imul(t ^ (t >>> 15), t | 1);\r\n    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);\r\n    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;\r\n  };\r\n}\r\n\r\nconst neuralRand = seededRandomFactory(20260823);\r\n\r\nfunction neuralRegion(x, y, z) {\r\n  const hL =\r\n    Math.pow((x + 4.8)/2.6, 2) +\r\n    Math.pow((y + 1.0)/1.6, 2) +\r\n    Math.pow((z + 1.5)/3.1, 2) <= 1;\r\n  const hR =\r\n    Math.pow((x - 4.8)/2.6, 2) +\r\n    Math.pow((y + 1.0)/1.6, 2) +\r\n    Math.pow((z + 1.5)/3.1, 2) <= 1;\r\n\r\n  if (hL || hR) return 'hippocampus';\r\n  if (z > 4.5 && y > -1.4) return 'prefrontal';\r\n  if (y > 4.8 && z > -5.8) return 'parietal';\r\n  if (z < -5.7 && y > -1.5) return 'occipital';\r\n  if (y < 2.0 && Math.abs(x) > 3.6) return 'temporal';\r\n  return 'deep';\r\n}\r\n\r\nfunction buildNeuralNodes() {\r\n  const desired = quality.neuralNodes;\r\n  let attempts = 0;\r\n\r\n  while (neuronPositions.length < desired && attempts < desired * 40) {\r\n    attempts++;\r\n\r\n    const x = (neuralRand() * 2 - 1) * 12.4;\r\n    const y = -5.8 + neuralRand() * 16.8;\r\n    const z = (neuralRand() * 2 - 1) * 9.8;\r\n\r\n    if (!insideCore(x, y, z)) continue;\r\n    if (Math.abs(x) < 0.82 && y > -0.5) continue;\r\n\r\n    // 让节点在深层更稀疏、靠近皮层内侧更丰富。\r\n    const shellBias =\r\n      Math.abs(x) / 12.4 +\r\n      Math.abs(y - 2.0) / 10.5 +\r\n      Math.abs(z) / 9.8;\r\n\r\n    if (shellBias < 0.48 && neuralRand() < 0.36) continue;\r\n\r\n    neuronPositions.push(new THREE.Vector3(x, y, z));\r\n    neuronRegions.push(neuralRegion(x, y, z));\r\n  }\r\n\r\n  for (let i = 0; i < neuronPositions.length; i++) neuronAdj.push([]);\r\n}\r\n\r\nfunction connectNeuralNodes() {\r\n  const n = neuronPositions.length;\r\n  const cellSize = 4.2;\r\n  const maxRadius2 = cellSize * cellSize;\r\n  const nearestCount = 3;\r\n  const seen = new Set();\r\n  const buckets = new Map();\r\n\r\n  const bucketCoordinate = value => Math.floor(value / cellSize);\r\n  const bucketKey = (x, y, z) => `${x}:${y}:${z}`;\r\n\r\n  for (let i = 0; i < n; i++) {\r\n    const p = neuronPositions[i];\r\n    const key = bucketKey(\r\n      bucketCoordinate(p.x),\r\n      bucketCoordinate(p.y),\r\n      bucketCoordinate(p.z)\r\n    );\r\n    if (!buckets.has(key)) buckets.set(key, []);\r\n    buckets.get(key).push(i);\r\n  }\r\n\r\n  for (let i = 0; i < n; i++) {\r\n    const candidates = [];\r\n    const p = neuronPositions[i];\r\n    const cx = bucketCoordinate(p.x);\r\n    const cy = bucketCoordinate(p.y);\r\n    const cz = bucketCoordinate(p.z);\r\n\r\n    for (let dx = -1; dx <= 1; dx++) {\r\n      for (let dy = -1; dy <= 1; dy++) {\r\n        for (let dz = -1; dz <= 1; dz++) {\r\n          const bucket = buckets.get(bucketKey(cx + dx, cy + dy, cz + dz));\r\n          if (!bucket) continue;\r\n\r\n          for (const j of bucket) {\r\n            if (i === j) continue;\r\n            const d2 = p.distanceToSquared(neuronPositions[j]);\r\n            if (d2 <= maxRadius2) candidates.push([d2, j]);\r\n          }\r\n        }\r\n      }\r\n    }\r\n\r\n    candidates.sort((a,b) => a[0] - b[0]);\r\n\r\n    for (let k = 0; k < Math.min(nearestCount, candidates.length); k++) {\r\n      const j = candidates[k][1];\r\n      const a = Math.min(i,j);\r\n      const b = Math.max(i,j);\r\n      const key = `${a}:${b}`;\r\n      if (seen.has(key)) continue;\r\n      seen.add(key);\r\n\r\n      edgePairs.push([a,b]);\r\n      neuronAdj[a].push(b);\r\n      neuronAdj[b].push(a);\r\n    }\r\n  }\r\n}\r\n\r\nfunction initializeNeuralNetwork() {\r\n  if (neuralInitialized) return;\r\n\r\n  buildNeuralNodes();\r\n  connectNeuralNodes();\r\n\r\n  // 神经网络默认隐藏，首次开启时才创建 GPU 资源。\r\n  neuronGeometry = new THREE.BufferGeometry();\r\n  const neuronArray = new Float32Array(neuronPositions.length * 3);\r\n  const neuronColors = new Float32Array(neuronPositions.length * 3);\r\n\r\n  for (let i = 0; i < neuronPositions.length; i++) {\r\n    const p = neuronPositions[i];\r\n    neuronArray[i*3] = p.x;\r\n    neuronArray[i*3+1] = p.y;\r\n    neuronArray[i*3+2] = p.z;\r\n    neuronColors[i*3] = NEURAL_NODE_REST[0];\r\n    neuronColors[i*3+1] = NEURAL_NODE_REST[1];\r\n    neuronColors[i*3+2] = NEURAL_NODE_REST[2];\r\n  }\r\n\r\n  neuronGeometry.setAttribute('position', new THREE.BufferAttribute(neuronArray, 3));\r\n  neuronGeometry.setAttribute('color', new THREE.BufferAttribute(neuronColors, 3));\r\n  neuronMaterial = new THREE.PointsMaterial({\r\n    size: 0.105,\r\n    vertexColors: true,\r\n    transparent: true,\r\n    opacity: 0.82,\r\n    sizeAttenuation: true,\r\n    depthTest: false\r\n  });\r\n  neuronPoints = new THREE.Points(neuronGeometry, neuronMaterial);\r\n  neuronPoints.renderOrder = 20;\r\n  neuralGroup.add(neuronPoints);\r\n\r\n  const edgePositionArray = new Float32Array(edgePairs.length * 6);\r\n  const edgeColorArray = new Float32Array(edgePairs.length * 6);\r\n\r\n  for (let e = 0; e < edgePairs.length; e++) {\r\n    const [a,b] = edgePairs[e];\r\n    const pa = neuronPositions[a];\r\n    const pb = neuronPositions[b];\r\n    edgePositionArray[e*6] = pa.x;\r\n    edgePositionArray[e*6+1] = pa.y;\r\n    edgePositionArray[e*6+2] = pa.z;\r\n    edgePositionArray[e*6+3] = pb.x;\r\n    edgePositionArray[e*6+4] = pb.y;\r\n    edgePositionArray[e*6+5] = pb.z;\r\n    for (let c=0;c<6;c++) {\r\n      edgeColorArray[e*6+c] = c % 3 === 0 ? NEURAL_EDGE_REST[0]\r\n        : c % 3 === 1 ? NEURAL_EDGE_REST[1]\r\n        : NEURAL_EDGE_REST[2];\r\n    }\r\n  }\r\n\r\n  edgeGeometry = new THREE.BufferGeometry();\r\n  edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositionArray, 3));\r\n  edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColorArray, 3));\r\n  edgeMaterial = new THREE.LineBasicMaterial({\r\n    vertexColors: true,\r\n    transparent: true,\r\n    opacity: 0.28,\r\n    depthTest: false\r\n  });\r\n  neuralEdges = new THREE.LineSegments(edgeGeometry, edgeMaterial);\r\n  neuralEdges.renderOrder = 18;\r\n  neuralGroup.add(neuralEdges);\r\n\r\n  if (!softwareRenderer) {\r\n    const activeSphereGeo = new THREE.SphereGeometry(0.115, 7, 7);\r\n    const activeSphereMat = new THREE.MeshBasicMaterial({\r\n      color: NEURAL_PULSE_HEX,\r\n      transparent: true,\r\n      opacity: 0.92,\r\n      depthTest: false\r\n    });\r\n    activeSpheres = new THREE.InstancedMesh(\r\n      activeSphereGeo,\r\n      activeSphereMat,\r\n      MAX_ACTIVE_SPHERES\r\n    );\r\n    activeSpheres.count = 0;\r\n    activeSpheres.renderOrder = 25;\r\n    neuralGroup.add(activeSpheres);\r\n  }\r\n\r\n  activationValues = new Float32Array(neuronPositions.length);\r\n  neuralInitialized = true;\r\n  computeActivationDistance(neuralMode);\r\n  Object.assign(window.__brainPerformance, {\r\n    neuralInitialized: true,\r\n    neuralNodes: neuronPositions.length,\r\n    neuralEdges: edgePairs.length\r\n  });\r\n}\r\n\r\nfunction sourceNodesForMode(mode) {\r\n  const source = [];\r\n\r\n  if (mode === 'prefrontal') {\r\n    for (let i=0;i<neuronRegions.length;i++) {\r\n      if (neuronRegions[i] === 'prefrontal') source.push(i);\r\n    }\r\n  } else if (mode === 'hippocampus') {\r\n    for (let i=0;i<neuronRegions.length;i++) {\r\n      if (neuronRegions[i] === 'hippocampus') source.push(i);\r\n    }\r\n  } else if (mode === 'global') {\r\n    // 从脑干附近/中下部向整个脑传播\r\n    let best = [];\r\n    for (let i=0;i<neuronPositions.length;i++) {\r\n      const p = neuronPositions[i];\r\n      const score = Math.abs(p.x) + Math.abs(p.y + 4.0) + Math.abs(p.z + 4.8);\r\n      best.push([score,i]);\r\n    }\r\n    best.sort((a,b)=>a[0]-b[0]);\r\n    return best.slice(0,6).map(x=>x[1]);\r\n  } else {\r\n    // 自发激活：每轮从不同局部区域随机产生 2~4 个源\r\n    const count = 3;\r\n    for (let k=0;k<count;k++) {\r\n      const idx = Math.floor(neuralRand() * neuronPositions.length);\r\n      source.push(idx);\r\n    }\r\n  }\r\n\r\n  if (!source.length) {\r\n    source.push(Math.floor(neuronPositions.length * 0.5));\r\n  }\r\n\r\n  // 数量太多时只抽取一部分，形成局部激活中心。\r\n  if (source.length > 18) {\r\n    const sampled = [];\r\n    const stride = Math.max(1, Math.floor(source.length / 18));\r\n    for (let i=0;i<source.length && sampled.length<18;i+=stride) sampled.push(source[i]);\r\n    return sampled;\r\n  }\r\n\r\n  return source;\r\n}\r\n\r\nfunction computeActivationDistance(mode) {\r\n  if (!neuralInitialized || !neuronPositions.length) return;\r\n\r\n  activationDistance.length = neuronPositions.length;\r\n  activationDistance.fill(Infinity);\r\n\r\n  const sources = sourceNodesForMode(mode);\r\n  const queue = [];\r\n\r\n  for (const s of sources) {\r\n    activationDistance[s] = 0;\r\n    queue.push(s);\r\n  }\r\n\r\n  let qIndex = 0;\r\n  while (qIndex < queue.length) {\r\n    const cur = queue[qIndex++];\r\n    const nextD = activationDistance[cur] + 1;\r\n\r\n    for (const nb of neuronAdj[cur]) {\r\n      if (nextD < activationDistance[nb]) {\r\n        activationDistance[nb] = nextD;\r\n        queue.push(nb);\r\n      }\r\n    }\r\n  }\r\n}\r\n\r\nfunction setNeuralMode(mode) {\r\n  neuralMode = mode;\r\n  spontaneousSeedIndex++;\r\n  neuralStartTime = performance.now();\r\n  if (neuralInitialized) computeActivationDistance(mode);\r\n\r\n  const labels = {\r\n    spontaneous: '自发脉冲',\r\n    prefrontal: '前额叶激活',\r\n    hippocampus: '海马体激活',\r\n    global: '全脑传播波'\r\n  };\r\n\r\n  document.getElementById('neuralStatus').textContent = `神经激活：${labels[mode]}`;\r\n\r\n  document.getElementById('spontaneousBtn').classList.toggle('active', mode === 'spontaneous');\r\n  document.getElementById('frontalPulseBtn').classList.toggle('active', mode === 'prefrontal');\r\n  document.getElementById('hippocampusPulseBtn').classList.toggle('active', mode === 'hippocampus');\r\n  document.getElementById('globalPulseBtn').classList.toggle('active', mode === 'global');\r\n\r\n  if (neuralVisible) startNeuralAnimation();\r\n}\r\n\r\nfunction refreshBrainOcclusion() {\r\n  // 记忆图谱开启时优先保证记忆结构可读。\r\n  // 神经网络始终是叠加层；只有“图谱透视”控制底层大脑的遮挡。\r\n  const memoryXray = memoryVisible && memoryXrayEnabled;\r\n  const separatedXray = memoryXray && memoryGrouped;\r\n\r\n  cortexMeshes.forEach(mesh => {\r\n    if (memoryXray) {\r\n      mesh.material.opacity = separatedXray ? 0.10 : 0.34;\r\n      mesh.material.depthWrite = false;\r\n    } else {\r\n      mesh.material.opacity = 0.96;\r\n      mesh.material.depthWrite = true;\r\n    }\r\n    mesh.material.needsUpdate = true;\r\n  });\r\n\r\n  const proxyOpacity = memoryXray\r\n    ? (separatedXray ? 0.10 : 0.34)\r\n    : 0.92;\r\n  cortexAnimationPairs.forEach(({proxy}) => {\r\n    proxy.material.opacity = proxyOpacity;\r\n  });\r\n\r\n  coreMeshes.forEach(mesh => {\r\n    if (!coreVisible) return;\r\n\r\n    if (memoryXray) {\r\n      // 海马体稍微保留，其余大方块几乎隐藏，避免挡住中间记忆节点。\r\n      mesh.material.opacity =\r\n        mesh.userData.region === 'hippocampus' ? 0.055 : 0.008;\r\n    } else {\r\n      mesh.material.opacity =\r\n        mesh.userData.region === 'hippocampus' ? 0.38 : 0.11;\r\n    }\r\n\r\n    mesh.material.depthWrite = false;\r\n    mesh.material.needsUpdate = true;\r\n  });\r\n}\r\n\r\nfunction applyNeuralXray(active) {\r\n  // 保留旧调用点；神经开关本身不再改变底层大脑的透明度。\r\n  refreshBrainOcclusion();\r\n}\r\n\r\nfunction updateNeuralFrame(now) {\r\n  if (!neuralInitialized) return;\r\n\r\n  const elapsed = (now - neuralStartTime) / 1000;\r\n  const cycle = neuralMode === 'global' ? 4.8 : 3.8;\r\n  const localT = elapsed % cycle;\r\n\r\n  // 自发模式每轮重新随机选择激活源。\r\n  if (neuralMode === 'spontaneous') {\r\n    const cycleIndex = Math.floor(elapsed / cycle);\r\n    if (cycleIndex !== spontaneousSeedIndex) {\r\n      spontaneousSeedIndex = cycleIndex;\r\n      computeActivationDistance('spontaneous');\r\n    }\r\n  }\r\n\r\n  const nodeColorAttr = neuronGeometry.getAttribute('color');\r\n  const edgeColorAttr = edgeGeometry.getAttribute('color');\r\n\r\n  const activation = activationValues;\r\n  const speed = neuralMode === 'global' ? 0.115 : 0.090;\r\n  const width = neuralMode === 'global' ? 0.38 : 0.30;\r\n\r\n  for (let i=0;i<activation.length;i++) {\r\n    const hop = activationDistance[i];\r\n\r\n    if (!Number.isFinite(hop)) {\r\n      activation[i] = 0;\r\n      continue;\r\n    }\r\n\r\n    const delay = hop * speed;\r\n    const d = (localT - delay) / width;\r\n\r\n    let a = Math.exp(-d*d);\r\n\r\n    // 留少量尾迹，视觉上像神经兴奋后的残余活动\r\n    const tailD = (localT - delay - 0.44) / 0.72;\r\n    a = Math.max(a, Math.exp(-tailD*tailD) * 0.22);\r\n\r\n    activation[i] = Math.min(1, a);\r\n  }\r\n\r\n  // 节点颜色：静息蓝灰，激活向冷白过渡。\r\n  for (let i=0;i<activation.length;i++) {\r\n    const a = activation[i];\r\n    nodeColorAttr.array[i*3] = NEURAL_NODE_REST[0] + a * (NEURAL_NODE_ACTIVE[0] - NEURAL_NODE_REST[0]);\r\n    nodeColorAttr.array[i*3+1] = NEURAL_NODE_REST[1] + a * (NEURAL_NODE_ACTIVE[1] - NEURAL_NODE_REST[1]);\r\n    nodeColorAttr.array[i*3+2] = NEURAL_NODE_REST[2] + a * (NEURAL_NODE_ACTIVE[2] - NEURAL_NODE_REST[2]);\r\n  }\r\n  nodeColorAttr.needsUpdate = true;\r\n\r\n  // 连接线随两端神经元活动向冷白提亮。\r\n  for (let e=0;e<edgePairs.length;e++) {\r\n    const [a,b] = edgePairs[e];\r\n    const act = Math.max(activation[a], activation[b]) * 0.92 +\r\n                Math.min(activation[a], activation[b]) * 0.08;\r\n    const r = NEURAL_EDGE_REST[0] + act * (NEURAL_EDGE_ACTIVE[0] - NEURAL_EDGE_REST[0]);\r\n    const g = NEURAL_EDGE_REST[1] + act * (NEURAL_EDGE_ACTIVE[1] - NEURAL_EDGE_REST[1]);\r\n    const blue = NEURAL_EDGE_REST[2] + act * (NEURAL_EDGE_ACTIVE[2] - NEURAL_EDGE_REST[2]);\r\n\r\n    edgeColorAttr.array[e*6] = r;\r\n    edgeColorAttr.array[e*6+1] = g;\r\n    edgeColorAttr.array[e*6+2] = blue;\r\n    edgeColorAttr.array[e*6+3] = r;\r\n    edgeColorAttr.array[e*6+4] = g;\r\n    edgeColorAttr.array[e*6+5] = blue;\r\n  }\r\n  edgeColorAttr.needsUpdate = true;\r\n\r\n  if (activeSpheres) {\r\n    // 原生 GPU 上用小球强化最强节点；软件渲染器保留轻量点色传播。\r\n    rankedActivation.length = 0;\r\n    for (let i=0;i<activation.length;i++) {\r\n      if (activation[i] > 0.48) rankedActivation.push([activation[i],i]);\r\n    }\r\n    rankedActivation.sort((a,b)=>b[0]-a[0]);\r\n\r\n    const count = Math.min(MAX_ACTIVE_SPHERES, rankedActivation.length);\r\n    activeSpheres.count = count;\r\n\r\n    for (let k=0;k<count;k++) {\r\n      const [a,i] = rankedActivation[k];\r\n      const p = neuronPositions[i];\r\n      const s = 0.72 + a * 1.65;\r\n\r\n      neuralDummy.position.copy(p);\r\n      neuralDummy.scale.setScalar(s);\r\n      neuralDummy.updateMatrix();\r\n      activeSpheres.setMatrixAt(k, neuralDummy.matrix);\r\n    }\r\n    activeSpheres.instanceMatrix.needsUpdate = true;\r\n  }\r\n}\r\n\r\nfunction neuralAnimationLoop(now) {\r\n  if (!neuralVisible) {\r\n    neuralRAF = 0;\r\n    return;\r\n  }\r\n\r\n  neuralRAF = requestAnimationFrame(neuralAnimationLoop);\r\n  if (document.hidden || now - neuralLastFrame < animationFrameInterval) return;\r\n  neuralLastFrame = now;\r\n  updateNeuralFrame(now);\r\n  render();\r\n}\r\n\r\nfunction startNeuralAnimation() {\r\n  if (!neuralVisible) return;\r\n  if (neuralRAF) return;\r\n  neuralLastFrame = 0;\r\n  neuralRAF = requestAnimationFrame(neuralAnimationLoop);\r\n}\r\n\r\nfunction stopNeuralAnimation() {\r\n  if (neuralRAF) {\r\n    cancelAnimationFrame(neuralRAF);\r\n    neuralRAF = 0;\r\n  }\r\n}\r\n\r\nfunction updateNeuralVisible(show) {\r\n  neuralVisible = show;\r\n  neuralGroup.visible = show;\r\n\r\n  const btn = document.getElementById('toggleNeuralBtn');\r\n  btn.textContent = show ? '神经网络开' : '神经网络关';\r\n  btn.classList.toggle('active', show);\r\n\r\n  applyNeuralXray(show);\r\n\r\n  if (show) {\r\n    initializeNeuralNetwork();\r\n    setLightweightAnimation('neural', true);\r\n    neuralStartTime = performance.now();\r\n    computeActivationDistance(neuralMode);\r\n    startNeuralAnimation();\r\n  } else {\r\n    stopNeuralAnimation();\r\n    setLightweightAnimation('neural', false);\r\n    render();\r\n  }\r\n}\r\n\r\n// ---------------------------------------------------------------------\r\n// Canonical L3 激活知识图\r\n// ---------------------------------------------------------------------\r\n// 事件、实体、事实、关系、属性、模式、规则和派生事实共享一个权威图。\r\n// 对象类型只决定几何编码，不构成独立知识层；当前画面是可重建的激活子图。\r\n// Document / Section / Chunk / DocumentVector 位于图外证据通道，通过 EvidenceLink 回源。\r\n\r\nconst memoryRoot = new THREE.Group();\r\nbrainRoot.add(memoryRoot);\r\n\r\nconst memoryKindEvent = new THREE.Group();\r\nconst memoryKindFact = new THREE.Group();\r\nconst memoryKindSchema = new THREE.Group();\r\nconst memoryLinkEventFact = new THREE.Group();\r\nconst memoryLinkFactSchema = new THREE.Group();\r\nconst memoryShellGroup = new THREE.Group();\r\n\r\nmemoryRoot.add(memoryShellGroup);\r\nmemoryRoot.add(memoryLinkEventFact);\r\nmemoryRoot.add(memoryLinkFactSchema);\r\nmemoryRoot.add(memoryKindEvent);\r\nmemoryRoot.add(memoryKindFact);\r\nmemoryRoot.add(memoryKindSchema);\r\n\r\nlet memoryVisible = true;\r\nlet memoryXrayEnabled = true;\r\nlet memoryGrouped = false;\r\nlet eventKindVisible = true;\r\nlet factKindVisible = true;\r\nlet schemaKindVisible = true;\r\nlet selectedMemoryMesh = null;\r\nlet selectedMemoryData = null;\r\nlet memoryRAF = 0;\r\nlet memoryPulseMode = null;\r\nlet memoryPulseStart = 0;\r\nlet memoryLastFrame = 0;\r\nlet canonicalSnapshot = null;\r\nlet canonicalSnapshotSource = 'demo';\r\nlet canonicalSnapshotCursor = null;\r\nlet canonicalSnapshotLoading = false;\r\n\r\nconst memoryClickable = [];\r\nconst memoryNodeById = new Map();\r\nconst memoryLinkMeshes = [];\r\nconst memoryIndexLinks = [];\r\nconst memoryLayoutScratch = new THREE.Vector3();\r\n\r\n// -----------------------------\r\n// 演示数据\r\n// -----------------------------\r\nlet canonicalEvents = [\r\n  {\r\n    id:'EVT-001', kind:'event', title:'统一为 Canonical L3',\r\n    summary:'删除独立知识层级，把可推理对象并入唯一权威图。',\r\n    content:'事件、实体、关系、属性、模式、规则和派生事实统一进入 Canonical L3；对象类型保留，但不再拥有彼此割裂的存储层级。',\r\n    source:'架构决策记录', time:'2026-08-25',\r\n    related:['ENT-CANONICAL-L3','FACT-SINGLE-AUTHORITY','RULE-GRAPH-AUTHORITY']\r\n  },\r\n  {\r\n    id:'EVT-002', kind:'event', title:'确认独立证据通道',\r\n    summary:'DocumentVector 与 BM25 继续保存事实证据和文本定位能力。',\r\n    content:'Document、Section、Chunk、DocumentVector 和 BM25 不并入图节点层级；它们通过 EvidenceLink 为图中断言和证明提供可核验原文。',\r\n    source:'项目文档与代码核对', time:'2026-08-25',\r\n    related:['ENT-DOCUMENT-VECTOR','FACT-EVIDENCE-SEPARATE','RULE-EVIDENCE-GROUNDED']\r\n  },\r\n  {\r\n    id:'EVT-003', kind:'event', title:'评估千万级图规模',\r\n    summary:'完整图不能在单次查询或浏览器画面中整体加载。',\r\n    content:'当节点达到千万级时，查询先通过结构过滤、向量候选和重排序形成有限激活子图，再在逻辑完整图范围内扩展必要证明路径。',\r\n    source:'规模风险讨论', time:'2026-08-25',\r\n    related:['FACT-LOGICAL-SCOPE','FACT-ACTIVATED-BOUNDED','RULE-ACTIVATION-BOUND']\r\n  },\r\n  {\r\n    id:'EVT-004', kind:'event', title:'建立迁移恢复点',\r\n    summary:'在 schema 迁移前创建 Git 标签和项目外完整备份。',\r\n    content:'迁移必须保留稳定节点 ID、关系 ID、EvidenceLink subject ID 与 chunk ID，并先在状态副本上验证完整性。',\r\n    source:'迁移执行记录', time:'2026-08-24',\r\n    related:['FACT-STABLE-MIGRATION','ENT-CANONICAL-L3','RULE-GRAPH-AUTHORITY']\r\n  },\r\n  {\r\n    id:'EVT-005', kind:'event', title:'定义完整图推理边界',\r\n    summary:'完整图是逻辑可达范围，不是每次查询的物理加载范围。',\r\n    content:'推理器可以按规则和关系继续扩展尚未加载的节点，直到命中目标、预算或停止条件；返回结果同时携带最小证明路径。',\r\n    source:'推理架构讨论', time:'2026-08-25',\r\n    related:['FACT-LOGICAL-SCOPE','ENT-CANONICAL-RULE','RULE-INFERENCE-PROOF']\r\n  },\r\n  {\r\n    id:'EVT-006', kind:'event', title:'引入激活子图',\r\n    summary:'运行时只保留当前问题相关的候选节点、关系和证明路径。',\r\n    content:'Activated Subgraph、ANN、Reranker 与 Cache 都是可重建运行时派生能力，不是新的知识层，也不拥有权威事实。',\r\n    source:'查询执行设计', time:'2026-08-25',\r\n    related:['FACT-ACTIVATED-BOUNDED','FACT-ANN-RERANK','RULE-ACTIVATION-BOUND']\r\n  },\r\n  {\r\n    id:'EVT-007', kind:'event', title:'向量化图对象',\r\n    summary:'实体、关系、属性和规则可生成向量，用于召回与重排序。',\r\n    content:'向量索引保存 Canonical ID 与版本指针；向量是检索投影，不替代图中的关系约束、规则语义或证据链。',\r\n    source:'检索架构讨论', time:'2026-08-25',\r\n    related:['ENT-GRAPH-VECTOR-INDEX','FACT-ANN-RERANK','RULE-ACTIVATION-BOUND']\r\n  },\r\n  {\r\n    id:'EVT-008', kind:'event', title:'保留事实证据回源',\r\n    summary:'任何回答和派生事实都应能定位到支持它的文档片段。',\r\n    content:'图关系负责表达知识结构，EvidenceLink 负责连接具体 Chunk；规则证明不能把向量相似度伪装成事实证据。',\r\n    source:'证据模型讨论', time:'2026-08-25',\r\n    related:['FACT-EVIDENCE-SEPARATE','FACT-PROVENANCE','RULE-EVIDENCE-GROUNDED']\r\n  },\r\n  {\r\n    id:'EVT-009', kind:'event', title:'规则并入权威图',\r\n    summary:'规则、模式和派生事实与实体关系共享版本化治理。',\r\n    content:'规则节点描述匹配前提与结论，派生事实记录规则版本、输入事实、证据来源和生成时间，支持审计与失效重算。',\r\n    source:'Canonical L3 模型设计', time:'2026-08-25',\r\n    related:['ENT-CANONICAL-RULE','FACT-SINGLE-AUTHORITY','RULE-INFERENCE-PROOF']\r\n  },\r\n  {\r\n    id:'EVT-010', kind:'event', title:'三维视图改为默认融合',\r\n    summary:'不同对象在同一图空间混合分布，灰阶和形状只编码类型。',\r\n    content:'默认画面展示一个 Canonical L3 激活子图边界；对象分组只是临时观察模式，不能被理解为独立知识层。',\r\n    source:'前端可视化决策', time:'2026-08-25',\r\n    related:['FACT-VISUAL-FUSION','ENT-CANONICAL-L3','RULE-VISUAL-ENCODING']\r\n  },\r\n  {\r\n    id:'EVT-011', kind:'event', title:'限定黑白灰视觉语言',\r\n    summary:'所有节点、关系、状态和激活强度只使用灰阶。',\r\n    content:'石墨黑微点表示事件，中灰线框表示实体与事实，浅灰多面体表示模式与规则；激活通过明暗、尺寸和线宽表达。',\r\n    source:'界面约束', time:'2026-08-25',\r\n    related:['FACT-VISUAL-FUSION','RULE-VISUAL-ENCODING']\r\n  },\r\n  {\r\n    id:'EVT-012', kind:'event', title:'限制浏览器渲染预算',\r\n    summary:'3D 页面只渲染可交互的有限节点集合。',\r\n    content:'后端分页快照、LOD、批量几何和按需关系展开共同控制渲染成本；完整图规模不直接决定当前帧节点数。',\r\n    source:'前端性能优化', time:'2026-08-25',\r\n    related:['FACT-ACTIVATED-BOUNDED','FACT-ANN-RERANK','RULE-ACTIVATION-BOUND']\r\n  }\r\n];\r\n\r\nlet canonicalFacts = [\r\n  {\r\n    id:'ENT-CANONICAL-L3', kind:'entity', title:'Canonical L3',\r\n    summary:'唯一权威、版本化、可审计的完整知识图。',\r\n    content:'承载 TBox、ABox、事件、实体、关系、属性、规则和派生事实；所有对象使用稳定 ID，并接受统一完整性约束。',\r\n    source:'Canonical 数据模型', time:'schema 5',\r\n    related:['EVT-001','EVT-004','EVT-010','FACT-SINGLE-AUTHORITY','RULE-GRAPH-AUTHORITY']\r\n  },\r\n  {\r\n    id:'ENT-DOCUMENT-VECTOR', kind:'entity', title:'DocumentVector / BM25',\r\n    summary:'面向原文片段的向量和词法证据索引。',\r\n    content:'保存文档级与 Chunk 级检索投影，命中后返回原文定位；它不承担权威图关系或完整图推理。',\r\n    source:'独立证据通道', time:'持续更新',\r\n    related:['EVT-002','FACT-EVIDENCE-SEPARATE','FACT-PROVENANCE','RULE-EVIDENCE-GROUNDED']\r\n  },\r\n  {\r\n    id:'ENT-GRAPH-VECTOR-INDEX', kind:'entity', title:'图对象向量索引',\r\n    summary:'Canonical 节点、关系、属性和规则的可重建检索投影。',\r\n    content:'索引项指向 Canonical ID 和 ontology_version；ANN 只负责候选召回，最终结果还要经过结构约束、重排序和证明校验。',\r\n    source:'运行时派生索引', time:'可重建',\r\n    related:['EVT-007','FACT-ANN-RERANK','RULE-ACTIVATION-BOUND']\r\n  },\r\n  {\r\n    id:'ENT-CANONICAL-RULE', kind:'entity', title:'Canonical Rule',\r\n    summary:'包含前提、约束、结论和版本信息的图内规则对象。',\r\n    content:'规则匹配产生派生事实时记录输入节点、关系、证据与规则版本，从而允许解释、撤销和重新计算。',\r\n    source:'Canonical L3 规则模型', time:'版本化',\r\n    related:['EVT-005','EVT-009','RULE-INFERENCE-PROOF']\r\n  },\r\n  {\r\n    id:'FACT-SINGLE-AUTHORITY', kind:'fact', title:'权威事实只有一个归属',\r\n    summary:'知识真值只由 Canonical L3 治理。',\r\n    content:'缓存、向量索引和激活子图可以丢弃后重建，不能反向覆盖 Canonical L3 中的事实和规则。',\r\n    source:'架构约束', time:'有效',\r\n    related:['EVT-001','EVT-009','ENT-CANONICAL-L3','RULE-GRAPH-AUTHORITY']\r\n  },\r\n  {\r\n    id:'FACT-EVIDENCE-SEPARATE', kind:'fact', title:'证据检索与图推理解耦',\r\n    summary:'图回答“关系是什么”，文档通道回答“原文在哪里”。',\r\n    content:'两条通道在查询规划阶段协同，在 EvidenceLink 和证明结果处汇合；任一通道都不能冒充另一通道。',\r\n    source:'证据架构约束', time:'有效',\r\n    related:['EVT-002','EVT-008','ENT-DOCUMENT-VECTOR','RULE-EVIDENCE-GROUNDED']\r\n  },\r\n  {\r\n    id:'FACT-LOGICAL-SCOPE', kind:'fact', title:'完整图是逻辑推理范围',\r\n    summary:'推理可按需访问完整图，但无需一次装入内存。',\r\n    content:'关系扩展由查询目标、规则前提、时间范围、权限与成本预算约束；逻辑完整性和物理执行规模是两个概念。',\r\n    source:'推理执行约束', time:'有效',\r\n    related:['EVT-003','EVT-005','RULE-INFERENCE-PROOF']\r\n  },\r\n  {\r\n    id:'FACT-ACTIVATED-BOUNDED', kind:'fact', title:'激活子图必须有界',\r\n    summary:'单次查询和单帧可视化只使用有限候选集合。',\r\n    content:'候选数量、扩展跳数、证明深度、超时和渲染节点数都必须设置预算，并在需要时继续分页扩展。',\r\n    source:'运行时预算', time:'每次查询',\r\n    related:['EVT-003','EVT-006','EVT-012','RULE-ACTIVATION-BOUND']\r\n  },\r\n  {\r\n    id:'FACT-ANN-RERANK', kind:'fact', title:'ANN 召回后必须重排序',\r\n    summary:'向量相似度只负责缩小候选，不直接等于事实相关性。',\r\n    content:'Reranker 综合语义相似、关系路径、规则可满足性、时间与证据质量，产生可解释的激活优先级。',\r\n    source:'检索执行策略', time:'每次查询',\r\n    related:['EVT-006','EVT-007','EVT-012','ENT-GRAPH-VECTOR-INDEX','RULE-ACTIVATION-BOUND']\r\n  },\r\n  {\r\n    id:'FACT-PROVENANCE', kind:'fact', title:'证明必须携带来源',\r\n    summary:'结论可回溯到 Document、Chunk、输入事实和规则版本。',\r\n    content:'直接事实引用 EvidenceLink；派生事实还要保存最小证明路径，避免只返回不可验证的图结论。',\r\n    source:'审计约束', time:'有效',\r\n    related:['EVT-008','ENT-DOCUMENT-VECTOR','RULE-EVIDENCE-GROUNDED','RULE-INFERENCE-PROOF']\r\n  },\r\n  {\r\n    id:'FACT-STABLE-MIGRATION', kind:'fact', title:'迁移保持稳定标识',\r\n    summary:'schema 变化不改写既有对象和证据引用的身份。',\r\n    content:'迁移验证比较所有稳定 ID 集合、对象数量、EvidenceLink subject/chunk 指针与完整性结果，再允许替换正式状态。',\r\n    source:'迁移安全约束', time:'schema 4 → 5',\r\n    related:['EVT-004','ENT-CANONICAL-L3','RULE-GRAPH-AUTHORITY']\r\n  },\r\n  {\r\n    id:'FACT-VISUAL-FUSION', kind:'fact', title:'对象类型不是知识层级',\r\n    summary:'事件、事实与规则在同一个 Canonical L3 空间共同显示。',\r\n    content:'灰阶、几何形状和筛选开关用于辨认对象类型；对象分组仅改变观察布局，不改变图结构、ID 或推理语义。',\r\n    source:'可视化语义约束', time:'V13.0',\r\n    related:['EVT-010','EVT-011','RULE-VISUAL-ENCODING']\r\n  }\r\n];\r\n\r\nlet canonicalSchemas = [\r\n  {\r\n    id:'RULE-GRAPH-AUTHORITY', kind:'rule', title:'权威图写入规则',\r\n    summary:'任何知识写入必须落到 Canonical ID、版本和证据约束。',\r\n    content:'若候选对象通过去重、类型约束和证据校验，则写入或更新 Canonical 节点/关系；运行时索引随后异步重建。',\r\n    source:'Canonical 规则集', time:'ontology_version 5',\r\n    related:['EVT-001','EVT-004','FACT-SINGLE-AUTHORITY','FACT-STABLE-MIGRATION']\r\n  },\r\n  {\r\n    id:'RULE-EVIDENCE-GROUNDED', kind:'rule', title:'证据落地规则',\r\n    summary:'可外部核验的结论必须至少绑定一条有效 EvidenceLink。',\r\n    content:'当结论来自文档事实时，证明必须返回 Document、Chunk 与定位信息；无来源的相似候选只能作为假设，不能升级为已证事实。',\r\n    source:'Canonical 规则集', time:'ontology_version 5',\r\n    related:['EVT-002','EVT-008','FACT-EVIDENCE-SEPARATE','FACT-PROVENANCE']\r\n  },\r\n  {\r\n    id:'RULE-ACTIVATION-BOUND', kind:'rule', title:'激活预算规则',\r\n    summary:'候选召回、关系扩展与页面渲染都受明确预算约束。',\r\n    content:'达到节点、跳数、证明深度或耗时上限时暂停扩展并返回 continuation；已加载集合仍保持可解释和可分页。',\r\n    source:'查询规划规则', time:'运行时',\r\n    related:['EVT-003','EVT-006','EVT-007','EVT-012','FACT-ACTIVATED-BOUNDED','FACT-ANN-RERANK']\r\n  },\r\n  {\r\n    id:'RULE-INFERENCE-PROOF', kind:'rule', title:'完整图证明规则',\r\n    summary:'推理结论必须附带可复算的最小证明路径。',\r\n    content:'规则引擎按需从激活子图向 Canonical L3 扩展，记录每个前提、关系和规则版本；无可满足证明时不输出确定性结论。',\r\n    source:'推理规则集', time:'版本化',\r\n    related:['EVT-005','EVT-009','FACT-LOGICAL-SCOPE','FACT-PROVENANCE','ENT-CANONICAL-RULE']\r\n  },\r\n  {\r\n    id:'RULE-VISUAL-ENCODING', kind:'pattern', title:'Canonical 视图编码模式',\r\n    summary:'一个图边界、三种对象形状、全程黑白灰。',\r\n    content:'事件使用石墨黑微点，实体与事实使用中灰线框几何，模式与规则使用浅灰多面体；明暗和尺寸只表示激活强度。',\r\n    source:'V13.0 前端模式', time:'版本化',\r\n    related:['EVT-010','EVT-011','FACT-VISUAL-FUSION']\r\n  }\r\n];\r\n\r\n// -----------------------------\r\n// Canonical L3 单图空间布局\r\n// -----------------------------\r\nconst memoryCenter = new THREE.Vector3(0, 0.45, -1.15);\r\nmemoryRoot.position.copy(memoryCenter);\r\n\r\nconst memoryKindStyle = {\r\n  event: {\r\n    color: 0x242424,\r\n    shellOpacity: 0.58,\r\n    nodeOpacity: 0.92,\r\n    label: new THREE.Vector3(-7.2, 7.6, 3.4)\r\n  },\r\n  fact: {\r\n    color: 0x707070,\r\n    shellOpacity: 0.52,\r\n    nodeOpacity: 0.94,\r\n    label: new THREE.Vector3(0, 7.9, 3.4)\r\n  },\r\n  schema: {\r\n    color: 0xb8b8b8,\r\n    shellOpacity: 0.14,\r\n    nodeOpacity: 0.88,\r\n    label: new THREE.Vector3(7.2, 7.6, 3.4)\r\n  }\r\n};\r\n\r\nconst memoryKindLayout = {\r\n  fused: {\r\n    event: {\r\n      offset: new THREE.Vector3(0, 0, 0),\r\n      radii: new THREE.Vector3(8.25, 6.15, 5.45),\r\n      shellScale: new THREE.Vector3(8.75, 6.60, 5.90),\r\n      label: new THREE.Vector3(0, 7.35, 3.35)\r\n    },\r\n    fact: {\r\n      offset: new THREE.Vector3(0, 0, 0),\r\n      radii: new THREE.Vector3(8.25, 6.15, 5.45),\r\n      shellScale: new THREE.Vector3(8.75, 6.60, 5.90)\r\n    },\r\n    schema: {\r\n      offset: new THREE.Vector3(0, 0, 0),\r\n      radii: new THREE.Vector3(8.25, 6.15, 5.45),\r\n      shellScale: new THREE.Vector3(8.75, 6.60, 5.90)\r\n    }\r\n  },\r\n  grouped: {\r\n    event: {\r\n      offset: new THREE.Vector3(-7.0, 0.25, 0.4),\r\n      radii: new THREE.Vector3(3.9, 6.55, 3.55),\r\n      shellScale: new THREE.Vector3(4.35, 6.95, 3.85)\r\n    },\r\n    fact: {\r\n      offset: new THREE.Vector3(0, 0.20, 0.8),\r\n      radii: new THREE.Vector3(3.85, 5.55, 3.50),\r\n      shellScale: new THREE.Vector3(4.35, 5.95, 3.85)\r\n    },\r\n    schema: {\r\n      offset: new THREE.Vector3(7.0, 0.25, 1.2),\r\n      radii: new THREE.Vector3(3.45, 4.65, 3.20),\r\n      shellScale: new THREE.Vector3(3.95, 5.05, 3.55)\r\n    }\r\n  }\r\n};\r\n\r\nconst memoryKindLabelText = {\r\n  event: { full: '事件对象 · 石墨微点', compact: '事件' },\r\n  fact: { full: '实体 / 事实 · 中灰线框', compact: '实体 / 事实' },\r\n  schema: { full: '模式 / 规则 · 浅灰多面体', compact: '模式 / 规则' }\r\n};\r\n\r\n// 窄屏分组观察时收窄三列横向占用，避免两侧对象被正面视角裁出屏幕。\r\nconst memoryKindLayoutCompact = {\r\n  grouped: {\r\n    event: {\r\n      offset: new THREE.Vector3(-1.65, 0.18, 0.40),\r\n      radii: new THREE.Vector3(1.35, 5.35, 2.80),\r\n      shellScale: new THREE.Vector3(1.70, 5.70, 3.10),\r\n      label: new THREE.Vector3(-1.10, 7.25, 3.30)\r\n    },\r\n    fact: {\r\n      offset: new THREE.Vector3(0, 0.16, 0.62),\r\n      radii: new THREE.Vector3(1.30, 4.75, 2.65),\r\n      shellScale: new THREE.Vector3(1.65, 5.10, 2.95),\r\n      label: new THREE.Vector3(0, 7.55, 3.30)\r\n    },\r\n    schema: {\r\n      offset: new THREE.Vector3(1.65, 0.18, 0.86),\r\n      radii: new THREE.Vector3(1.25, 4.20, 2.45),\r\n      shellScale: new THREE.Vector3(1.60, 4.60, 2.80),\r\n      label: new THREE.Vector3(1.10, 7.25, 3.30)\r\n    }\r\n  }\r\n};\r\n\r\nfunction makeMemoryShell(layer) {\r\n  const shell = new THREE.Group();\r\n  shell.userData.memoryKind = layer;\r\n\r\n  if (layer === 'event') {\r\n    const positions = [];\r\n    const count = 210;\r\n    for (let i = 0; i < count; i++) {\r\n      const point = ellipsoidPoint(i, count, new THREE.Vector3(1, 1, 1), 0.35);\r\n      positions.push(point.x, point.y, point.z);\r\n    }\r\n    const geometry = new THREE.BufferGeometry();\r\n    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));\r\n    const material = new THREE.PointsMaterial({\r\n      color: memoryKindStyle.event.color,\r\n      size: 0.11,\r\n      transparent: true,\r\n      opacity: memoryKindStyle.event.shellOpacity,\r\n      sizeAttenuation: true,\r\n      depthTest: false,\r\n      depthWrite: false\r\n    });\r\n    const points = new THREE.Points(geometry, material);\r\n    points.renderOrder = 7;\r\n    shell.add(points);\r\n  } else if (layer === 'fact') {\r\n    const geometry = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1, 1));\r\n    const material = new THREE.LineDashedMaterial({\r\n      color: memoryKindStyle.fact.color,\r\n      dashSize: 0.08,\r\n      gapSize: 0.055,\r\n      transparent: true,\r\n      opacity: memoryKindStyle.fact.shellOpacity,\r\n      depthTest: false,\r\n      depthWrite: false\r\n    });\r\n    const scaffold = new THREE.LineSegments(geometry, material);\r\n    scaffold.computeLineDistances();\r\n    scaffold.renderOrder = 8;\r\n    shell.add(scaffold);\r\n  } else {\r\n    const geometry = new THREE.IcosahedronGeometry(1, 2);\r\n    const fill = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({\r\n      color: memoryKindStyle.schema.color,\r\n      transparent: true,\r\n      opacity: memoryKindStyle.schema.shellOpacity,\r\n      depthTest: false,\r\n      depthWrite: false,\r\n      side: THREE.DoubleSide\r\n    }));\r\n    fill.renderOrder = 7;\r\n    shell.add(fill);\r\n\r\n    const outline = new THREE.LineSegments(\r\n      new THREE.WireframeGeometry(geometry),\r\n      new THREE.LineBasicMaterial({\r\n        color: 0x555555,\r\n        transparent: true,\r\n        opacity: 0.32,\r\n        depthTest: false,\r\n        depthWrite: false\r\n      })\r\n    );\r\n    outline.renderOrder = 8;\r\n    shell.add(outline);\r\n  }\r\n\r\n  memoryShellGroup.add(shell);\r\n  return shell;\r\n}\r\n\r\nconst canonicalShell = makeMemoryShell('event');\r\nconst factGuide = makeMemoryShell('fact');\r\nconst schemaGuide = makeMemoryShell('schema');\r\n\r\nfunction syncMemoryGuides() {\r\n  canonicalShell.visible = memoryVisible && (!memoryGrouped || eventKindVisible);\r\n  factGuide.visible = memoryVisible && memoryGrouped && factKindVisible;\r\n  schemaGuide.visible = memoryVisible && memoryGrouped && schemaKindVisible;\r\n\r\n  const boundaryMaterial = canonicalShell.children[0]?.material;\r\n  if (boundaryMaterial) {\r\n    boundaryMaterial.color.setHex(memoryGrouped\r\n      ? memoryKindStyle.event.color\r\n      : 0x8a8a8a);\r\n    boundaryMaterial.opacity = memoryGrouped\r\n      ? memoryKindStyle.event.shellOpacity\r\n      : 0.22;\r\n  }\r\n}\r\n\r\n// -----------------------------\r\n// 节点布局\r\n// -----------------------------\r\nfunction ellipsoidPoint(index, count, radii, phase=0) {\r\n  // Fibonacci sphere，映射到椭球表面，避免规则经纬线堆叠。\r\n  const golden = Math.PI * (3 - Math.sqrt(5));\r\n  const y = 1 - (index / Math.max(1, count - 1)) * 2;\r\n  const r = Math.sqrt(Math.max(0, 1 - y*y));\r\n  const theta = golden * index + phase;\r\n\r\n  return new THREE.Vector3(\r\n    Math.cos(theta) * r * radii.x,\r\n    y * radii.y,\r\n    Math.sin(theta) * r * radii.z\r\n  );\r\n}\r\n\r\nfunction stableUnit(value) {\r\n  let hash = 2166136261;\r\n  for (let i = 0; i < value.length; i++) {\r\n    hash ^= value.charCodeAt(i);\r\n    hash = Math.imul(hash, 16777619);\r\n  }\r\n  hash ^= hash >>> 16;\r\n  hash = Math.imul(hash, 0x7feb352d);\r\n  hash ^= hash >>> 15;\r\n  return (hash >>> 0) / 4294967295;\r\n}\r\n\r\nfunction canonicalVolumePoint(nodeId, radii) {\r\n  const longitude = stableUnit(nodeId + ':longitude') * Math.PI * 2;\r\n  const z = stableUnit(nodeId + ':latitude') * 2 - 1;\r\n  const plane = Math.sqrt(Math.max(0, 1 - z * z));\r\n  const radius = 0.30 + Math.cbrt(stableUnit(nodeId + ':radius')) * 0.68;\r\n\r\n  return new THREE.Vector3(\r\n    Math.cos(longitude) * plane * radii.x * radius,\r\n    z * radii.y * radius,\r\n    Math.sin(longitude) * plane * radii.z * radius\r\n  );\r\n}\r\n\r\nfunction groupedVolumePoint(index, count, radii, phase=0) {\r\n  const point = ellipsoidPoint(index, count, radii, phase);\r\n  const radius = 0.48 + (((index + 1) * 0.61803398875 + phase) % 1) * 0.48;\r\n  return point.multiplyScalar(radius);\r\n}\r\n\r\nfunction activeMemoryLayout() {\r\n  if (!memoryGrouped) return memoryKindLayout.fused;\r\n  return window.innerWidth <= 700\r\n    ? memoryKindLayoutCompact.grouped\r\n    : memoryKindLayout.grouped;\r\n}\r\n\r\nfunction memoryNodePoint(layer, index, count, phase=0, nodeId='') {\r\n  const layout = activeMemoryLayout()[layer];\r\n  const point = memoryGrouped\r\n    ? groupedVolumePoint(index, count, layout.radii, phase)\r\n    : canonicalVolumePoint(nodeId, layout.radii);\r\n  return point.add(layout.offset);\r\n}\r\n\r\nfunction makeNodeMesh(data, layer, index, count) {\r\n  let geo;\r\n  let material;\r\n  let radii;\r\n  let phase = 0;\r\n\r\n  if (layer === 'event') {\r\n    // 语义事件改成“神经元式微节点”：\r\n    // 事件数量未来可能非常大，因此必须轻、小、密，而不是占空间的大立方体。\r\n    geo = new THREE.SphereGeometry(0.145, 7, 7);\r\n    material = new THREE.MeshBasicMaterial({\r\n      color: memoryKindStyle.event.color,\r\n      transparent: true,\r\n      opacity: memoryKindStyle.event.nodeOpacity,\r\n      depthTest: false,\r\n      depthWrite: false\r\n    });\r\n    phase = 0.2;\r\n  } else if (layer === 'fact') {\r\n    geo = new THREE.OctahedronGeometry(0.46,0);\r\n    material = new THREE.MeshBasicMaterial({\r\n      color: memoryKindStyle.fact.color,\r\n      wireframe: true,\r\n      transparent: true,\r\n      opacity: memoryKindStyle.fact.nodeOpacity,\r\n      depthTest: false,\r\n      depthWrite: false\r\n    });\r\n    phase = 1.1;\r\n  } else {\r\n    geo = new THREE.IcosahedronGeometry(0.58,0);\r\n    material = new THREE.MeshBasicMaterial({\r\n      color: memoryKindStyle.schema.color,\r\n      transparent: true,\r\n      opacity: memoryKindStyle.schema.nodeOpacity,\r\n      depthTest: false,\r\n      depthWrite: false\r\n    });\r\n    radii = new THREE.Vector3(3.18,2.38,2.70);\r\n    phase = 2.0;\r\n  }\r\n\r\n  const mesh = new THREE.Mesh(geo, material);\r\n  if (layer === 'schema') {\r\n    const outline = new THREE.LineSegments(\r\n      new THREE.EdgesGeometry(geo),\r\n      new THREE.LineBasicMaterial({\r\n        color: 0x555555,\r\n        transparent: true,\r\n        opacity: 0.72,\r\n        depthTest: false,\r\n        depthWrite: false\r\n      })\r\n    );\r\n    outline.renderOrder = 37;\r\n    mesh.add(outline);\r\n  }\r\n  mesh.position.copy(memoryNodePoint(layer, index, count, phase, data.id));\r\n  mesh.renderOrder =\r\n    layer === 'event' ? 32 :\r\n    layer === 'fact' ? 34 : 36;\r\n  mesh.userData.memoryData = data;\r\n  mesh.userData.memoryKind = layer;\r\n  mesh.userData.layoutIndex = index;\r\n  mesh.userData.layoutCount = count;\r\n  mesh.userData.layoutPhase = phase;\r\n  mesh.userData.baseScale = 1;\r\n  mesh.userData.baseOpacity = material.opacity;\r\n  mesh.userData.baseColor = memoryKindStyle[layer].color;\r\n\r\n  data._position = mesh.position.clone();\r\n\r\n  memoryClickable.push(mesh);\r\n  memoryNodeById.set(data.id, mesh);\r\n\r\n  if (layer === 'event') memoryKindEvent.add(mesh);\r\n  if (layer === 'fact') memoryKindFact.add(mesh);\r\n  if (layer === 'schema') memoryKindSchema.add(mesh);\r\n\r\n  return mesh;\r\n}\r\n\r\ncanonicalEvents.forEach((d,i)=>makeNodeMesh(d,'event',i,canonicalEvents.length));\r\ncanonicalFacts.forEach((d,i)=>makeNodeMesh(d,'fact',i,canonicalFacts.length));\r\ncanonicalSchemas.forEach((d,i)=>makeNodeMesh(d,'schema',i,canonicalSchemas.length));\r\n\r\nfunction updateMemoryKindLabels() {\r\n  const layout = activeMemoryLayout();\r\n  const compact = memoryGrouped && window.innerWidth <= 700;\r\n  const labels = {\r\n    event: document.getElementById('memoryKindEventLabel'),\r\n    fact: document.getElementById('memoryKindFactLabel'),\r\n    schema: document.getElementById('memoryKindSchemaLabel')\r\n  };\r\n\r\n  Object.entries(labels).forEach(([layer, element]) => {\r\n    element.textContent = memoryGrouped\r\n      ? memoryKindLabelText[layer][compact ? 'compact' : 'full']\r\n      : (layer === 'event' ? 'Canonical L3 · 当前激活子图' : '');\r\n    const anchor = layout[layer].label ||\r\n      layout[layer].offset.clone().add(new THREE.Vector3(0, layout[layer].radii.y + 1.0, 3.2));\r\n    memoryKindLabelWorld[layer].copy(memoryCenter).add(anchor)\r\n      .multiplyScalar(1.24).add(brainRoot.position);\r\n    element.dataset.layout = memoryGrouped ? 'grouped' : 'fused';\r\n  });\r\n}\r\n\r\nfunction updateMemoryShellLayout() {\r\n  const layout = activeMemoryLayout();\r\n  [\r\n    ['event', canonicalShell],\r\n    ['fact', factGuide],\r\n    ['schema', schemaGuide]\r\n  ].forEach(([layer, shell]) => {\r\n    shell.position.copy(layout[layer].offset);\r\n    shell.scale.copy(layout[layer].shellScale);\r\n  });\r\n  syncMemoryGuides();\r\n}\r\n\r\nfunction updateMemoryLineGeometry(line) {\r\n  const from = memoryNodeById.get(line.userData.fromId);\r\n  const to = memoryNodeById.get(line.userData.toId);\r\n  if (!from || !to) return;\r\n\r\n  const position = line.geometry.getAttribute('position');\r\n  position.setXYZ(0, from.position.x, from.position.y, from.position.z);\r\n  position.setXYZ(1, to.position.x, to.position.y, to.position.z);\r\n  position.needsUpdate = true;\r\n  line.geometry.computeBoundingSphere();\r\n  if (line.material.isLineDashedMaterial) line.computeLineDistances();\r\n}\r\n\r\nfunction updateMemoryLinkGeometry() {\r\n  memoryLinkMeshes.forEach(updateMemoryLineGeometry);\r\n\r\n  memoryIndexLinks.forEach(line => {\r\n    const target = memoryNodeById.get(line.userData.targetId);\r\n    if (!target) return;\r\n    const position = line.geometry.getAttribute('position');\r\n    position.setXYZ(1, target.position.x, target.position.y, target.position.z);\r\n    position.needsUpdate = true;\r\n    line.geometry.computeBoundingSphere();\r\n  });\r\n\r\n  if (typeof chainGuideGroup !== 'undefined') {\r\n    chainGuideGroup.children.forEach(updateMemoryLineGeometry);\r\n  }\r\n}\r\n\r\nfunction updateMemoryLayout() {\r\n  memoryClickable.forEach(mesh => {\r\n    mesh.position.copy(memoryNodePoint(\r\n      mesh.userData.memoryKind,\r\n      mesh.userData.layoutIndex,\r\n      mesh.userData.layoutCount,\r\n      mesh.userData.layoutPhase,\r\n      mesh.userData.memoryData.id\r\n    ));\r\n    mesh.userData.basePosition = mesh.position.clone();\r\n  });\r\n\r\n  updateMemoryShellLayout();\r\n  updateMemoryLinkGeometry();\r\n  updateMemoryKindLabels();\r\n}\r\n\r\n// -----------------------------\r\n// Canonical L3 对象间关系线\r\n// -----------------------------\r\nfunction addMemoryLink(fromId, toId, kind) {\r\n  const a = memoryNodeById.get(fromId);\r\n  const b = memoryNodeById.get(toId);\r\n  if (!a || !b) return;\r\n\r\n  const geo = new THREE.BufferGeometry().setFromPoints([\r\n    a.position.clone(),\r\n    b.position.clone()\r\n  ]);\r\n\r\n  const baseOpacity = kind === 'event-fact' ? 0.16 :\r\n    kind === 'fact-schema' ? 0.28 : 0.22;\r\n  const materialOptions = {\r\n    color: kind === 'event-fact'\r\n      ? memoryKindStyle.event.color\r\n      : memoryKindStyle.fact.color,\r\n    transparent: true,\r\n    opacity: baseOpacity,\r\n    depthTest: false\r\n  };\r\n  const mat = kind === 'event-fact'\r\n    ? new THREE.LineDashedMaterial({\r\n        ...materialOptions,\r\n        dashSize: 0.22,\r\n        gapSize: 0.16\r\n      })\r\n    : new THREE.LineBasicMaterial(materialOptions);\r\n\r\n  const line = new THREE.Line(geo,mat);\r\n  line.renderOrder = 10;\r\n  line.userData.fromId = fromId;\r\n  line.userData.toId = toId;\r\n  line.userData.kind = kind;\r\n  line.userData.baseOpacity = baseOpacity;\r\n  if (mat.isLineDashedMaterial) line.computeLineDistances();\r\n\r\n  if (kind === 'event-fact') memoryLinkEventFact.add(line);\r\n  else memoryLinkFactSchema.add(line);\r\n\r\n  memoryLinkMeshes.push(line);\r\n}\r\n\r\n// 查询锚点 / 事件 -> 相关实体与事实\r\ncanonicalEvents.forEach(event => {\r\n  event.related\r\n    .filter(id => id.startsWith('ENT-') || id.startsWith('FACT-'))\r\n    .slice(0,2)\r\n    .forEach(id => addMemoryLink(event.id,id,'event-fact'));\r\n});\r\n\r\n// 实体与事实 -> 可满足的模式与规则\r\ncanonicalFacts.forEach(node => {\r\n  node.related\r\n    .filter(id => id.startsWith('RULE-'))\r\n    .slice(0,2)\r\n    .forEach(id => addMemoryLink(node.id,id,'fact-schema'));\r\n});\r\n\r\n// -----------------------------\r\n// 海马体 -> 事件对象的视觉索引线；仅用于脑内叙事，不表示存储层级。\r\n// -----------------------------\r\nconst hippocampusIndexGroup = new THREE.Group();\r\nmemoryRoot.add(hippocampusIndexGroup);\r\n\r\n[\r\n  new THREE.Vector3(-4.7,-1.0,-1.5).sub(memoryCenter),\r\n  new THREE.Vector3(4.7,-1.0,-1.5).sub(memoryCenter)\r\n].forEach((hip, sideIndex) => {\r\n  canonicalEvents.forEach((event,i) => {\r\n    if ((i % 2) !== sideIndex) return;\r\n    const target = memoryNodeById.get(event.id);\r\n    if (!target) return;\r\n\r\n    const geo = new THREE.BufferGeometry().setFromPoints([\r\n      hip,\r\n      target.position.clone()\r\n    ]);\r\n    const mat = new THREE.LineBasicMaterial({\r\n      color:0x000000,\r\n      transparent:true,\r\n      opacity:0.014,\r\n      depthTest:false\r\n    });\r\n    const l = new THREE.Line(geo,mat);\r\n    l.renderOrder = 9;\r\n    l.userData.targetId = event.id;\r\n    hippocampusIndexGroup.add(l);\r\n    memoryIndexLinks.push(l);\r\n  });\r\n});\r\n\r\nfunction clearThreeGroup(group) {\r\n  while (group.children.length) {\r\n    const object = group.children.pop();\r\n    object.traverse?.((child) => {\r\n      if (child.geometry) child.geometry.dispose();\r\n      if (child.material) {\r\n        const materials = Array.isArray(child.material) ? child.material : [child.material];\r\n        materials.forEach((material) => material.dispose?.());\r\n      }\r\n    });\r\n  }\r\n}\r\n\r\nfunction rebuildCanonicalScene() {\r\n  [memoryKindEvent, memoryKindFact, memoryKindSchema,\r\n    memoryLinkEventFact, memoryLinkFactSchema, hippocampusIndexGroup]\r\n    .forEach(clearThreeGroup);\r\n  memoryClickable.length = 0;\r\n  memoryNodeById.clear();\r\n  memoryLinkMeshes.length = 0;\r\n  memoryIndexLinks.length = 0;\r\n  clearChainGuide();\r\n  selectedMemoryMesh = null;\r\n  selectedMemoryData = null;\r\n\r\n  canonicalEvents.forEach((data, index) =>\r\n    makeNodeMesh(data, 'event', index, canonicalEvents.length));\r\n  canonicalFacts.forEach((data, index) =>\r\n    makeNodeMesh(data, 'fact', index, canonicalFacts.length));\r\n  canonicalSchemas.forEach((data, index) =>\r\n    makeNodeMesh(data, 'schema', index, canonicalSchemas.length));\r\n\r\n  if (canonicalSnapshot?.relations?.length) {\r\n    canonicalSnapshot.relations.forEach((relation) => {\r\n      const from = memoryNodeById.get(relation.source_node_id);\r\n      const to = memoryNodeById.get(relation.target_node_id);\r\n      if (!from || !to) return;\r\n      const fromKind = from.userData.memoryKind;\r\n      const toKind = to.userData.memoryKind;\r\n      const kind = fromKind === 'event' && toKind === 'fact'\r\n        ? 'event-fact'\r\n        : fromKind === 'fact' && toKind === 'schema'\r\n          ? 'fact-schema'\r\n          : 'canonical';\r\n      addMemoryLink(relation.source_node_id, relation.target_node_id, kind);\r\n    });\r\n  } else {\r\n    canonicalEvents.forEach((event) => {\r\n      event.related\r\n        .filter((id) => id.startsWith('ENT-') || id.startsWith('FACT-'))\r\n        .slice(0, 2)\r\n        .forEach((id) => addMemoryLink(event.id, id, 'event-fact'));\r\n    });\r\n    canonicalFacts.forEach((node) => {\r\n      node.related\r\n        .filter((id) => id.startsWith('RULE-'))\r\n        .slice(0, 2)\r\n        .forEach((id) => addMemoryLink(node.id, id, 'fact-schema'));\r\n    });\r\n  }\r\n\r\n  [\r\n    new THREE.Vector3(-4.7, -1.0, -1.5).sub(memoryCenter),\r\n    new THREE.Vector3(4.7, -1.0, -1.5).sub(memoryCenter),\r\n  ].forEach((hip, sideIndex) => {\r\n    canonicalEvents.forEach((event, index) => {\r\n      if ((index % 2) !== sideIndex) return;\r\n      const target = memoryNodeById.get(event.id);\r\n      if (!target) return;\r\n      const geometry = new THREE.BufferGeometry().setFromPoints([\r\n        hip,\r\n        target.position.clone(),\r\n      ]);\r\n      const material = new THREE.LineBasicMaterial({\r\n        color: 0x000000,\r\n        transparent: true,\r\n        opacity: 0.014,\r\n        depthTest: false,\r\n      });\r\n      const line = new THREE.Line(geometry, material);\r\n      line.renderOrder = 9;\r\n      line.userData.targetId = event.id;\r\n      hippocampusIndexGroup.add(line);\r\n      memoryIndexLinks.push(line);\r\n    });\r\n  });\r\n  updateMemoryLayout();\r\n  syncMemoryKindLabelVisibility();\r\n  refreshBrainOcclusion();\r\n}\r\n\r\n// -----------------------------\r\n// 详情面板\r\n// -----------------------------\r\nconst memoryPanel = document.getElementById('memoryPanel');\r\n\r\nfunction setPanelText(id, value) {\r\n  const el = document.getElementById(id);\r\n  el.textContent = value ?? '—';\r\n}\r\n\r\nfunction openMemoryPanel(data, mesh) {\r\n  selectedMemoryData = data;\r\n  setSelectedMemoryMesh(mesh);\r\n\r\n  const objectGroupNames = {\r\n    event:'Canonical L3 · 事件对象',\r\n    fact:'Canonical L3 · 实体 / 事实',\r\n    schema:'Canonical L3 · 模式 / 规则'\r\n  };\r\n  const nodeKindNames = {\r\n    event:'事件',\r\n    entity:'实体',\r\n    fact:'事实',\r\n    rule:'规则',\r\n    pattern:'模式'\r\n  };\r\n\r\n  const layer = mesh.userData.memoryKind;\r\n  memoryPanel.dataset.layer = layer;\r\n\r\n  setPanelText('memoryPanelKicker', objectGroupNames[layer] || 'CANONICAL NODE');\r\n  setPanelText('memoryPanelTitle', data.title);\r\n  setPanelText('memoryPanelId', data.id + ' / ' + (nodeKindNames[data.kind] || objectGroupNames[layer] || layer));\r\n  setPanelText('memoryPanelSummary', data.summary);\r\n  setPanelText('memoryPanelContent', data.content);\r\n  setPanelText('memoryPanelSource', `${data.source || '—'}\\n${data.time || ''}`);\r\n  setPanelText('memoryPanelRelations', (data.related || []).join('  ·  ') || '—');\r\n\r\n  memoryPanel.classList.remove('hidden');\r\n  highlightMemoryRelations(data.id);\r\n  render();\r\n}\r\n\r\nfunction closeMemoryPanel() {\r\n  memoryPanel.classList.add('hidden');\r\n  memoryPanel.dataset.layer = '';\r\n  selectedMemoryData = null;\r\n  setSelectedMemoryMesh(null);\r\n  resetMemoryLinkHighlight();\r\n  render();\r\n}\r\n\r\nfunction memorySelectedScale(mesh) {\r\n  if (!mesh) return 1;\r\n  const layer = mesh.userData.memoryKind;\r\n  if (layer === 'event') return 2.15;\r\n  if (layer === 'fact') return 1.55;\r\n  return 1.40;\r\n}\r\n\r\nfunction setSelectedMemoryMesh(mesh) {\r\n  if (selectedMemoryMesh && selectedMemoryMesh !== mesh) {\r\n    selectedMemoryMesh.scale.setScalar(1);\r\n  }\r\n\r\n  selectedMemoryMesh = mesh;\r\n\r\n  if (selectedMemoryMesh) {\r\n    selectedMemoryMesh.scale.setScalar(memorySelectedScale(selectedMemoryMesh));\r\n  }\r\n}\r\n\r\nfunction resetMemoryLinkHighlight() {\r\n  memoryLinkMeshes.forEach(line => {\r\n    line.material.opacity = line.userData.baseOpacity;\r\n  });\r\n\r\n  memoryClickable.forEach(mesh => {\r\n    if (mesh !== selectedMemoryMesh) mesh.scale.setScalar(1);\r\n  });\r\n}\r\n\r\nfunction highlightMemoryRelations(id) {\r\n  memoryLinkMeshes.forEach(line => {\r\n    const connected = line.userData.fromId === id || line.userData.toId === id;\r\n    line.material.opacity = connected ? 0.74 : 0.025;\r\n\r\n    if (connected) {\r\n      const otherId = line.userData.fromId === id ? line.userData.toId : line.userData.fromId;\r\n      const other = memoryNodeById.get(otherId);\r\n      if (other && other !== selectedMemoryMesh) {\r\n        const otherLayer = other.userData.memoryKind;\r\n        other.scale.setScalar(otherLayer === 'event' ? 1.55 : 1.22);\r\n      }\r\n    }\r\n  });\r\n}\r\n\r\ndocument.getElementById('memoryPanelClose').addEventListener('click', closeMemoryPanel);\r\n\r\ndocument.getElementById('focusMemoryNodeBtn').addEventListener('click', () => {\r\n  if (!selectedMemoryMesh) return;\r\n\r\n  const world = new THREE.Vector3();\r\n  selectedMemoryMesh.getWorldPosition(world);\r\n\r\n  controls.target.copy(world);\r\n  camera.position.copy(\r\n    world.clone().add(new THREE.Vector3(0,3.4,15.5))\r\n  );\r\n  controls.update();\r\n  render();\r\n});\r\n\r\ndocument.getElementById('traceMemoryNodeBtn').addEventListener('click', () => {\r\n  if (!selectedMemoryData) return;\r\n  highlightMemoryRelations(selectedMemoryData.id);\r\n  setMemoryStatus(`正在追踪：${selectedMemoryData.title}`);\r\n  render();\r\n});\r\n\r\n// -----------------------------\r\n// 点击检测\r\n// -----------------------------\r\nconst memoryRaycaster = new THREE.Raycaster();\r\nconst memoryPointer = new THREE.Vector2();\r\nlet pointerDownXY = null;\r\n\r\nrenderer.domElement.addEventListener('pointerdown', (ev) => {\r\n  pointerDownXY = {x:ev.clientX,y:ev.clientY};\r\n});\r\n\r\nrenderer.domElement.addEventListener('pointerup', (ev) => {\r\n  if (!pointerDownXY || !memoryVisible) return;\r\n\r\n  const dx = ev.clientX - pointerDownXY.x;\r\n  const dy = ev.clientY - pointerDownXY.y;\r\n  pointerDownXY = null;\r\n\r\n  if (Math.hypot(dx,dy) > 5) return;\r\n\r\n  const rect = renderer.domElement.getBoundingClientRect();\r\n  memoryPointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;\r\n  memoryPointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;\r\n\r\n  memoryRaycaster.setFromCamera(memoryPointer,camera);\r\n\r\n  const visibleNodes = memoryClickable.filter(m => m.visible && m.parent && m.parent.visible);\r\n  const hits = memoryRaycaster.intersectObjects(visibleNodes,false);\r\n\r\n  if (hits.length) {\r\n    openMemoryPanel(hits[0].object.userData.memoryData,hits[0].object);\r\n  }\r\n});\r\n\r\n// -----------------------------\r\n// Canonical L3 视图与对象类型开关\r\n// -----------------------------\r\nfunction setMemoryStatus(text) {\r\n  document.getElementById('memoryStatus').textContent = 'Canonical L3：' + text;\r\n}\r\n\r\nfunction memoryIdleStatus() {\r\n  const layout = memoryGrouped ? '对象分组观察' : '全图融合';\r\n  const source = canonicalSnapshot\r\n    ? `真实快照 ${canonicalSnapshot.snapshot_version} · `\r\n    : '';\r\n  return source + '完整图 · ' + layout + (memoryXrayEnabled ? ' · 透视' : '');\r\n}\r\n\r\nfunction syncMemoryKindLabelVisibility() {\r\n  const eventLabel = document.getElementById('memoryKindEventLabel');\r\n  const factLabel = document.getElementById('memoryKindFactLabel');\r\n  const schemaLabel = document.getElementById('memoryKindSchemaLabel');\r\n\r\n  eventLabel.classList.toggle('hidden', !memoryVisible || (memoryGrouped && !eventKindVisible));\r\n  factLabel.classList.toggle('hidden', !memoryVisible || !memoryGrouped || !factKindVisible);\r\n  schemaLabel.classList.toggle('hidden', !memoryVisible || !memoryGrouped || !schemaKindVisible);\r\n}\r\n\r\nfunction updateMemoryVisibility(show) {\r\n  memoryVisible = show;\r\n  memoryRoot.visible = show;\r\n  memoryShellGroup.visible = show;\r\n\r\n  const btn = document.getElementById('toggleMemoryBtn');\r\n  btn.textContent = show ? 'Canonical 图开' : 'Canonical 图关';\r\n  btn.classList.toggle('active',show);\r\n\r\n  syncMemoryGuides();\r\n  syncMemoryKindLabelVisibility();\r\n\r\n  if (!show) closeMemoryPanel();\r\n\r\n  refreshBrainOcclusion();\r\n  setMemoryStatus(show ? memoryIdleStatus() : '关闭');\r\n  render();\r\n}\r\n\r\nfunction updateMemoryXray(show) {\r\n  memoryXrayEnabled = show;\r\n\r\n  const btn = document.getElementById('memoryXrayBtn');\r\n  btn.textContent = show ? '图谱透视开' : '图谱透视关';\r\n  btn.classList.toggle('active',show);\r\n\r\n  refreshBrainOcclusion();\r\n  setMemoryStatus(memoryVisible ? memoryIdleStatus() : '关闭');\r\n  render();\r\n}\r\n\r\nfunction updateObjectGrouping(show) {\r\n  memoryGrouped = show;\r\n\r\n  const btn = document.getElementById('toggleObjectGroupingBtn');\r\n  btn.textContent = show ? '对象分组开' : '对象分组';\r\n  btn.classList.toggle('active', show);\r\n  btn.setAttribute('aria-pressed', String(show));\r\n\r\n  memoryShellGroup.visible = memoryVisible;\r\n  updateMemoryLayout();\r\n  syncMemoryKindLabelVisibility();\r\n  refreshBrainOcclusion();\r\n  setMemoryStatus(memoryIdleStatus());\r\n  render();\r\n}\r\n\r\nfunction updateEventKind(show) {\r\n  eventKindVisible = show;\r\n  memoryKindEvent.visible = show;\r\n  hippocampusIndexGroup.visible = show;\r\n  memoryLinkEventFact.visible = show && factKindVisible;\r\n\r\n  const btn = document.getElementById('toggleEventKindBtn');\r\n  btn.classList.toggle('active',show);\r\n  btn.setAttribute('aria-pressed', String(show));\r\n\r\n  syncMemoryGuides();\r\n  syncMemoryKindLabelVisibility();\r\n  render();\r\n}\r\n\r\nfunction updateFactKind(show) {\r\n  factKindVisible = show;\r\n  memoryKindFact.visible = show;\r\n  memoryLinkEventFact.visible = show && eventKindVisible;\r\n  memoryLinkFactSchema.visible = show && schemaKindVisible;\r\n\r\n  const btn = document.getElementById('toggleFactKindBtn');\r\n  btn.classList.toggle('active',show);\r\n  btn.setAttribute('aria-pressed', String(show));\r\n\r\n  syncMemoryGuides();\r\n  syncMemoryKindLabelVisibility();\r\n  render();\r\n}\r\n\r\nfunction updateSchemaKind(show) {\r\n  schemaKindVisible = show;\r\n  memoryKindSchema.visible = show;\r\n  memoryLinkFactSchema.visible = show && factKindVisible;\r\n\r\n  const btn = document.getElementById('toggleSchemaKindBtn');\r\n  btn.classList.toggle('active',show);\r\n  btn.setAttribute('aria-pressed', String(show));\r\n\r\n  syncMemoryGuides();\r\n  syncMemoryKindLabelVisibility();\r\n  render();\r\n}\r\n\r\n// -----------------------------\r\n// Canonical 写入 / 激活检索动画\r\n// -----------------------------\r\nfunction setNodePulse(layer, amount) {\r\n  const group =\r\n    layer === 'event' ? memoryKindEvent :\r\n    layer === 'fact' ? memoryKindFact :\r\n    memoryKindSchema;\r\n\r\n  group.children.forEach((mesh,i) => {\r\n    const local = Math.max(0, Math.min(1, amount - (i % 5) * 0.055));\r\n    const layer = mesh.userData.memoryKind;\r\n    const pulseGain = layer === 'event' ? 0.48 : (layer === 'fact' ? 0.62 : 0.70);\r\n    const pulse = 1 + local * pulseGain;\r\n    const selectedScale = memorySelectedScale(mesh);\r\n    mesh.scale.setScalar(mesh === selectedMemoryMesh ? Math.max(selectedScale,pulse) : pulse);\r\n\r\n    if (mesh.material) {\r\n      const baseOpacity = mesh.userData.baseOpacity || 0.8;\r\n      mesh.material.opacity = Math.min(1, baseOpacity + local * 0.20);\r\n    }\r\n  });\r\n}\r\n\r\nfunction resetMemoryPulseVisuals() {\r\n  memoryClickable.forEach(mesh => {\r\n    mesh.scale.setScalar(mesh === selectedMemoryMesh ? memorySelectedScale(mesh) : 1);\r\n    if (mesh.material) {\r\n      mesh.material.opacity = mesh.userData.baseOpacity || mesh.material.opacity;\r\n    }\r\n  });\r\n\r\n  if (selectedMemoryData) highlightMemoryRelations(selectedMemoryData.id);\r\n  else resetMemoryLinkHighlight();\r\n}\r\n\r\nfunction memoryPulseFrame(now) {\r\n  if (!memoryPulseMode) {\r\n    memoryRAF = 0;\r\n    setLightweightAnimation('memory', false);\r\n    return;\r\n  }\r\n\r\n  if (document.hidden || now - memoryLastFrame < animationFrameInterval) {\r\n    memoryRAF = requestAnimationFrame(memoryPulseFrame);\r\n    return;\r\n  }\r\n  memoryLastFrame = now;\r\n\r\n  const elapsed = (now - memoryPulseStart) / 1000;\r\n  const duration = 4.8;\r\n  const t = elapsed / duration;\r\n\r\n  if (t >= 1) {\r\n    memoryPulseMode = null;\r\n    memoryRAF = 0;\r\n    resetMemoryPulseVisuals();\r\n    setMemoryStatus(memoryIdleStatus());\r\n    setLightweightAnimation('memory', false);\r\n    render();\r\n    return;\r\n  }\r\n\r\n  const easePulse = (x) => {\r\n    if (x <= 0 || x >= 1) return 0;\r\n    return Math.sin(Math.PI * x);\r\n  };\r\n\r\n  let eventT, factT, schemaT;\r\n\r\n  if (memoryPulseMode === 'consolidate') {\r\n    eventT = easePulse((t - 0.02) / 0.34);\r\n    factT = easePulse((t - 0.28) / 0.36);\r\n    schemaT = easePulse((t - 0.58) / 0.38);\r\n    setMemoryStatus('写入：事件候选 → 实体 / 事实归一 → 规则校验');\r\n  } else {\r\n    eventT = easePulse((t - 0.02) / 0.34);\r\n    factT = easePulse((t - 0.28) / 0.36);\r\n    schemaT = easePulse((t - 0.58) / 0.38);\r\n    setMemoryStatus('检索：查询锚点 → 候选重排序 → 规则与证明扩展');\r\n  }\r\n\r\n  setNodePulse('event',eventT);\r\n  setNodePulse('fact',factT);\r\n  setNodePulse('schema',schemaT);\r\n\r\n  // 连线随传播阶段加深\r\n  memoryLinkMeshes.forEach(line => {\r\n    let act = 0;\r\n    if (line.userData.kind === 'event-fact') act = Math.max(eventT,factT);\r\n    else act = Math.max(factT,schemaT);\r\n\r\n    line.material.opacity = line.userData.baseOpacity + act * 0.58;\r\n  });\r\n\r\n  render();\r\n  memoryRAF = requestAnimationFrame(memoryPulseFrame);\r\n}\r\n\r\nfunction startMemoryPulse(mode) {\r\n  if (!memoryVisible) updateMemoryVisibility(true);\r\n\r\n  memoryPulseMode = mode;\r\n  memoryPulseStart = performance.now();\r\n  memoryLastFrame = 0;\r\n  setLightweightAnimation('memory', true);\r\n\r\n  if (memoryRAF) cancelAnimationFrame(memoryRAF);\r\n  memoryRAF = requestAnimationFrame(memoryPulseFrame);\r\n}\r\n\r\n// ---------------------------------------------------------------------\r\n// Canonical L3 查询锚点 → 事实约束 → 规则证明 → 文档证据\r\n// ---------------------------------------------------------------------\r\nlet memoryExampleChains = [\r\n  {\r\n    event:'EVT-001',\r\n    fact:'FACT-SINGLE-AUTHORITY',\r\n    schema:'RULE-GRAPH-AUTHORITY',\r\n    evidence:'架构决策记录 / Document → Section → Chunk'\r\n  },\r\n  {\r\n    event:'EVT-002',\r\n    fact:'FACT-EVIDENCE-SEPARATE',\r\n    schema:'RULE-EVIDENCE-GROUNDED',\r\n    evidence:'项目文档与代码核对 / EvidenceLink → Chunk'\r\n  },\r\n  {\r\n    event:'EVT-003',\r\n    fact:'FACT-ACTIVATED-BOUNDED',\r\n    schema:'RULE-ACTIVATION-BOUND',\r\n    evidence:'规模风险讨论 / 查询预算记录 → Chunk'\r\n  },\r\n  {\r\n    event:'EVT-005',\r\n    fact:'FACT-LOGICAL-SCOPE',\r\n    schema:'RULE-INFERENCE-PROOF',\r\n    evidence:'推理架构讨论 / 规则版本 + 输入事实 + Chunk'\r\n  },\r\n  {\r\n    event:'EVT-010',\r\n    fact:'FACT-VISUAL-FUSION',\r\n    schema:'RULE-VISUAL-ENCODING',\r\n    evidence:'前端可视化决策 / 需求记录 → Chunk'\r\n  }\r\n];\r\n\r\nlet memoryExampleIndex = 0;\r\nlet memoryExampleActive = false;\r\n\r\nconst chainGuideGroup = new THREE.Group();\r\nmemoryRoot.add(chainGuideGroup);\r\n\r\nfunction clearChainGuide() {\r\n  while (chainGuideGroup.children.length) {\r\n    const obj = chainGuideGroup.children.pop();\r\n    if (obj.geometry) obj.geometry.dispose();\r\n    if (obj.material) obj.material.dispose();\r\n  }\r\n}\r\n\r\nfunction chainLine(a,b,opacity=0.95,fromId='',toId='') {\r\n  const geo = new THREE.BufferGeometry().setFromPoints([a,b]);\r\n  const mat = new THREE.LineBasicMaterial({\r\n    color:0x000000,\r\n    transparent:true,\r\n    opacity,\r\n    depthTest:false\r\n  });\r\n  const l = new THREE.Line(geo,mat);\r\n  l.renderOrder = 40;\r\n  l.userData.fromId = fromId;\r\n  l.userData.toId = toId;\r\n  chainGuideGroup.add(l);\r\n  return l;\r\n}\r\n\r\nfunction setChainCard(eventData,factData,schemaData,evidence) {\r\n  document.getElementById('chainEventText').textContent =\r\n    `${eventData.title}（${eventData.id}）`;\r\n  document.getElementById('chainFactText').textContent =\r\n    `${factData.title}（${factData.id}）`;\r\n  document.getElementById('chainSchemaText').textContent =\r\n    `${schemaData.title}（${schemaData.id}）`;\r\n  document.getElementById('chainEvidenceText').textContent = evidence || 'Document / Chunk 证据待加载';\r\n}\r\n\r\nfunction resetExampleNodeStyles() {\r\n  memoryClickable.forEach(mesh => {\r\n    mesh.scale.setScalar(mesh === selectedMemoryMesh ? memorySelectedScale(mesh) : 1);\r\n\r\n    const layer = mesh.userData.memoryKind;\r\n    mesh.material.opacity = memoryKindStyle[layer].nodeOpacity;\r\n    mesh.material.color.setHex(memoryKindStyle[layer].color);\r\n  });\r\n\r\n  memoryLinkMeshes.forEach(line => {\r\n    line.material.opacity = line.userData.baseOpacity;\r\n  });\r\n}\r\n\r\nfunction highlightMemoryExample(index=0, focusCamera=false) {\r\n  if (!memoryExampleChains.length) {\r\n    memoryExampleActive = false;\r\n    setMemoryStatus(canonicalSnapshot\r\n      ? `真实快照 ${canonicalSnapshot.snapshot_version} · 当前页没有可组合的三类证明节点`\r\n      : '暂无证明路径');\r\n    render();\r\n    return;\r\n  }\r\n  if (!memoryVisible) updateMemoryVisibility(true);\r\n  updateEventKind(true);\r\n  updateFactKind(true);\r\n  updateSchemaKind(true);\r\n\r\n  memoryExampleIndex = ((index % memoryExampleChains.length) + memoryExampleChains.length) % memoryExampleChains.length;\r\n  memoryExampleActive = true;\r\n\r\n  const chain = memoryExampleChains[memoryExampleIndex];\r\n  const eventMesh = memoryNodeById.get(chain.event);\r\n  const factMesh = memoryNodeById.get(chain.fact);\r\n  const schemaMesh = memoryNodeById.get(chain.schema);\r\n\r\n  if (!eventMesh || !factMesh || !schemaMesh) return;\r\n\r\n  const eventData = eventMesh.userData.memoryData;\r\n  const factData = factMesh.userData.memoryData;\r\n  const schemaData = schemaMesh.userData.memoryData;\r\n\r\n  setChainCard(eventData,factData,schemaData,chain.evidence);\r\n  resetExampleNodeStyles();\r\n  clearChainGuide();\r\n\r\n  const selectedIds = new Set([chain.event,chain.fact,chain.schema]);\r\n\r\n  // 其他节点整体淡化，突出当前有限证明路径。\r\n  memoryClickable.forEach(mesh => {\r\n    const id = mesh.userData.memoryData.id;\r\n    const layer = mesh.userData.memoryKind;\r\n\r\n    if (selectedIds.has(id)) {\r\n      if (layer === 'event') mesh.scale.setScalar(2.65);\r\n      if (layer === 'fact') mesh.scale.setScalar(1.95);\r\n      if (layer === 'schema') mesh.scale.setScalar(1.70);\r\n      mesh.material.opacity = 1;\r\n    } else {\r\n      mesh.scale.setScalar(0.88);\r\n      mesh.material.opacity = memoryKindStyle[layer].nodeOpacity * 0.28;\r\n    }\r\n  });\r\n\r\n  memoryLinkMeshes.forEach(line => {\r\n    const a = line.userData.fromId;\r\n    const b = line.userData.toId;\r\n\r\n    const eventFact =\r\n      (a === chain.event && b === chain.fact) ||\r\n      (a === chain.fact && b === chain.event);\r\n\r\n    const factRule =\r\n      (a === chain.fact && b === chain.schema) ||\r\n      (a === chain.schema && b === chain.fact);\r\n\r\n    line.material.opacity = (eventFact || factRule) ? 0.95 : 0.015;\r\n  });\r\n\r\n  // 即使演示数据没有物理直连，也补画当前证明路径的两段图内连接。\r\n  chainLine(eventMesh.position,factMesh.position,0.98,chain.event,chain.fact);\r\n  chainLine(factMesh.position,schemaMesh.position,0.98,chain.fact,chain.schema);\r\n\r\n  setMemoryStatus(\r\n    `证明 ${memoryExampleIndex+1}/${memoryExampleChains.length}：查询锚点 → 事实约束 → 规则证明 → 文档证据`\r\n  );\r\n\r\n  if (focusCamera) {\r\n    const groupCenter = eventMesh.position.clone()\r\n      .add(factMesh.position)\r\n      .add(schemaMesh.position)\r\n      .multiplyScalar(1/3);\r\n\r\n    const worldCenter = groupCenter.clone()\r\n      .add(memoryRoot.position)\r\n      .multiplyScalar(1.24)\r\n      .add(brainRoot.position);\r\n\r\n    controls.target.copy(worldCenter);\r\n    camera.position.copy(worldCenter.clone().add(new THREE.Vector3(0,2.4,19)));\r\n    controls.update();\r\n  }\r\n\r\n  render();\r\n}\r\n\r\nfunction clearMemoryExample() {\r\n  memoryExampleActive = false;\r\n  resetExampleNodeStyles();\r\n  clearChainGuide();\r\n  document.getElementById('chainEventText').textContent = '—';\r\n  document.getElementById('chainFactText').textContent = '—';\r\n  document.getElementById('chainSchemaText').textContent = '—';\r\n  document.getElementById('chainEvidenceText').textContent = '—';\r\n  setMemoryStatus(memoryIdleStatus());\r\n  render();\r\n}\r\n\r\nfunction snapshotVisualLayer(nodeKind) {\r\n  const kind = String(nodeKind || 'event').toLowerCase();\r\n  if (['entity', 'fact', 'attribute', 'property'].includes(kind)) return 'fact';\r\n  if (['rule', 'pattern', 'schema'].includes(kind)) return 'schema';\r\n  return 'event';\r\n}\r\n\r\nfunction snapshotVisualNode(node, snapshot, related) {\r\n  const statement = String(node.statement || '').trim();\r\n  const title = statement\r\n    ? statement.split(/[。！？.!?]/)[0].trim().slice(0, 96)\r\n    : node.id;\r\n  const evidence = (node.evidence_links || []).map((item) => item.link || item);\r\n  const firstEvidence = evidence[0];\r\n  const source = firstEvidence\r\n    ? `EvidenceLink · ${firstEvidence.source_locator || firstEvidence.chunk_id || 'Chunk'}`\r\n    : `${node.document_id || 'Canonical L3'} / ${node.section_id || 'snapshot'}`;\r\n  return {\r\n    id: node.id,\r\n    kind: snapshotVisualLayer(node.node_kind),\r\n    title: title || node.id,\r\n    summary: `${node.node_kind || 'event'} · ${node.semantic_type || 'canonical'} · depth ${node.depth ?? 0}`,\r\n    content: statement || `${node.id}（${node.node_kind || 'event'}）`,\r\n    source,\r\n    time: `snapshot ${snapshot.snapshot_version}`,\r\n    related,\r\n    score: node.score,\r\n    confidence: node.confidence,\r\n    status: node.status,\r\n    evidence,\r\n  };\r\n}\r\n\r\nfunction setSnapshotChainCard(snapshot) {\r\n  const nodes = snapshot.nodes || [];\r\n  const anchorId = snapshot.anchor_node_id || nodes[0]?.id;\r\n  const anchor = nodes.find((node) => node.id === anchorId) || nodes[0];\r\n  const evidenceStep = (snapshot.proof || []).find((step) => step.kind === 'evidence');\r\n  document.getElementById('chainEventText').textContent = anchor\r\n    ? `${snapshotVisualNode(anchor, snapshot, []).title}（${anchor.id}）`\r\n    : '—';\r\n  document.getElementById('chainFactText').textContent =\r\n    nodes.some((node) => snapshotVisualLayer(node.node_kind) === 'fact')\r\n      ? '实体 / 事实候选已在真实快照中返回'\r\n      : '当前快照未返回实体 / 事实节点';\r\n  document.getElementById('chainSchemaText').textContent =\r\n    (snapshot.rules || []).length || nodes.some((node) => snapshotVisualLayer(node.node_kind) === 'schema')\r\n      ? '模式 / 规则候选已在真实快照中返回'\r\n      : '当前快照未返回模式 / 规则节点';\r\n  document.getElementById('chainEvidenceText').textContent = evidenceStep\r\n    ? `${evidenceStep.source_locator || evidenceStep.chunk_id || 'EvidenceLink'} · ${String(evidenceStep.quote || '').slice(0, 120)}`\r\n    : `${snapshot.evidence?.length || 0} 条 EvidenceLink · Document / Section / Chunk`;\r\n}\r\n\r\nfunction mergeCanonicalSnapshots(previous, next) {\r\n  if (!previous || previous.snapshot_version !== next.snapshot_version) return next;\r\n  const mergeById = (left = [], right = []) => {\r\n    const merged = new Map(left.map((item) => [item.id, item]));\r\n    right.forEach((item) => merged.set(item.id, item));\r\n    return [...merged.values()];\r\n  };\r\n  const mergeEvidence = (left = [], right = []) => {\r\n    const key = (item) => `${item.subject_type}:${item.subject_id}:${item.link?.id || item.id || ''}`;\n    const merged = new Map(left.map((item) => [key(item), item]));\r\n    right.forEach((item) => merged.set(key(item), item));\r\n    return [...merged.values()];\r\n  };\r\n  return {\r\n    ...next,\r\n    nodes: mergeById(previous.nodes, next.nodes),\r\n    relations: mergeById(previous.relations, next.relations),\r\n    attributes: mergeById(previous.attributes, next.attributes),\r\n    rules: mergeById(previous.rules, next.rules),\r\n    proof: next.proof?.length ? next.proof : previous.proof,\r\n    evidence: mergeEvidence(previous.evidence, next.evidence),\r\n  };\r\n}\r\n\r\nfunction applyCanonicalSnapshot(snapshot) {\r\n  if (!snapshot || !snapshot.read_only || !Array.isArray(snapshot.nodes)) {\r\n    throw new Error('真实快照契约无效');\r\n  }\r\n  if (!snapshot.nodes.length) {\r\n    throw new Error('真实快照为空');\r\n  }\r\n\r\n  const relationMap = new Map();\r\n  (snapshot.relations || []).forEach((relation) => {\r\n    [relation.source_node_id, relation.target_node_id].forEach((id) => {\r\n      if (!id) return;\r\n      if (!relationMap.has(id)) relationMap.set(id, []);\r\n      const other = id === relation.source_node_id\r\n        ? relation.target_node_id\r\n        : relation.source_node_id;\r\n      if (other && !relationMap.get(id).includes(other)) relationMap.get(id).push(other);\r\n    });\r\n  });\r\n\r\n  canonicalSnapshot = snapshot;\r\n  canonicalSnapshotSource = 'api';\r\n  canonicalSnapshotCursor = snapshot.continuation?.next_cursor || null;\r\n  window.__canonicalSnapshot = snapshot;\r\n  window.__canonicalSnapshotSource = canonicalSnapshotSource;\r\n  const loadMoreButton = document.getElementById('memoryLoadMoreBtn');\r\n  loadMoreButton.classList.toggle('hidden', !canonicalSnapshotCursor);\r\n  loadMoreButton.disabled = false;\r\n  canonicalEvents = [];\r\n  canonicalFacts = [];\r\n  canonicalSchemas = [];\r\n  snapshot.nodes.forEach((node) => {\r\n    const visual = snapshotVisualNode(node, snapshot, relationMap.get(node.id) || []);\r\n    if (visual.kind === 'fact') canonicalFacts.push(visual);\r\n    else if (visual.kind === 'schema') canonicalSchemas.push(visual);\r\n    else canonicalEvents.push(visual);\r\n  });\r\n\r\n  // Attributes and rules are first-class Canonical objects even when a node\r\n  // page has no direct visual node for them yet.\r\n  (snapshot.attributes || []).forEach((attribute) => {\r\n    if (memoryNodeById.has(attribute.id)) return;\r\n    canonicalFacts.push({\r\n      id: attribute.id,\r\n      kind: 'fact',\r\n      title: attribute.attribute_type || attribute.id,\r\n      summary: 'Canonical attribute fact',\r\n      content: JSON.stringify(attribute.value ?? null),\r\n      source: `Canonical Attribute · ${attribute.id}`,\r\n      time: `snapshot ${snapshot.snapshot_version}`,\r\n      related: [attribute.node_id].filter(Boolean),\r\n    });\r\n  });\r\n  (snapshot.rules || []).forEach((rule) => {\r\n    if (memoryNodeById.has(rule.id)) return;\r\n    canonicalSchemas.push({\r\n      id: rule.id,\r\n      kind: 'schema',\r\n      title: rule.name || rule.id,\r\n      summary: 'Canonical rule',\r\n      content: rule.description || rule.name || rule.id,\r\n      source: `Canonical Rule · ${rule.id}`,\r\n      time: `ontology_version ${rule.ontology_version}`,\r\n      related: [],\r\n    });\r\n  });\r\n\r\n  rebuildCanonicalScene();\r\n  memoryExampleChains = [];\r\n  const event = canonicalEvents[0];\r\n  const fact = canonicalFacts[0];\r\n  const schema = canonicalSchemas[0];\r\n  if (event && fact && schema) {\r\n    memoryExampleChains.push({\r\n      event: event.id,\r\n      fact: fact.id,\r\n      schema: schema.id,\r\n      evidence: `${snapshot.evidence?.length || 0} 条 EvidenceLink · ${snapshot.snapshot_version}`,\r\n    });\r\n    highlightMemoryExample(0, false);\r\n  } else {\r\n    memoryExampleActive = false;\r\n    setSnapshotChainCard(snapshot);\r\n  }\r\n  setMemoryStatus(`真实快照 ${snapshot.snapshot_version} · ${snapshot.nodes.length} 节点 / ${(snapshot.relations || []).length} 关系`);\r\n  render();\r\n}\r\n\r\nasync function loadCanonicalSnapshot(cursor = null) {\r\n  canonicalSnapshotLoading = true;\r\n  const loadMoreButton = document.getElementById('memoryLoadMoreBtn');\r\n  loadMoreButton.disabled = true;\r\n  setMemoryStatus(cursor ? '真实快照续载中 · 保留当前页面' : '真实快照加载中 · 保留本地演示');\r\n  const controller = new AbortController();\r\n  const timeout = window.setTimeout(() => controller.abort(), 12000);\r\n  try {\r\n    const response = await fetch('/api/graph/snapshot', {\r\n      method: 'POST',\r\n      headers: { 'content-type': 'application/json' },\r\n      body: JSON.stringify({\r\n        query: 'Canonical L3 认知记忆',\r\n        node_limit: 12,\r\n        relation_limit: 48,\r\n        proof_limit: 12,\r\n        max_hops: 2,\r\n        use_embedding: false,\r\n        ...(cursor ? { cursor } : {}),\r\n      }),\r\n      signal: controller.signal,\r\n    });\r\n    if (!response.ok) throw new Error(`snapshot HTTP ${response.status}`);\r\n    const next = await response.json();\r\n    applyCanonicalSnapshot(mergeCanonicalSnapshots(cursor ? canonicalSnapshot : null, next));\r\n  } catch (error) {\r\n    canonicalSnapshotSource = 'demo';\r\n    window.__canonicalSnapshotSource = canonicalSnapshotSource;\r\n    setMemoryStatus(`真实快照不可用 · 保留本地演示（${String(error.message || error).slice(0, 80)}）`);\r\n    render();\r\n  } finally {\r\n    window.clearTimeout(timeout);\r\n    canonicalSnapshotLoading = false;\r\n    loadMoreButton.disabled = false;\r\n  }\r\n}\r\n\r\n// ---------------------------------------------------------------------\r\n// 标签引导线\r\n// ---------------------------------------------------------------------\r\nconst leaderGroup = new THREE.Group();\r\nscene.add(leaderGroup);\r\n\r\nconst anchorPoints = {\r\n  prefrontal: new THREE.Vector3(10.2, 7.6, 9.8).multiplyScalar(1.24).add(brainRoot.position),\r\n  parietal: new THREE.Vector3(4.0, 12.4, 0.6).multiplyScalar(1.24).add(brainRoot.position),\r\n  temporal: new THREE.Vector3(10.7, -0.2, 2.8).multiplyScalar(1.24).add(brainRoot.position),\r\n  occipital: new THREE.Vector3(5.4, 5.9, -10.8).multiplyScalar(1.24).add(brainRoot.position),\r\n  cerebellum: new THREE.Vector3(4.8, -6.6, -7.6).multiplyScalar(1.24).add(brainRoot.position),\r\n  brainstem: new THREE.Vector3(0, -12.9, -5.9).multiplyScalar(1.24).add(brainRoot.position),\r\n  hippocampus: new THREE.Vector3(4.7, -1.0, -1.5).multiplyScalar(1.24).add(brainRoot.position)\r\n};\r\n\r\nconst labelWorld = {\r\n  tagPrefrontal: new THREE.Vector3(17, 15, 15),\r\n  tagParietal: new THREE.Vector3(3, 20, 7),\r\n  tagTemporal: new THREE.Vector3(19, 2, 11),\r\n  tagOccipital: new THREE.Vector3(12, 12, -17),\r\n  tagCerebellum: new THREE.Vector3(12, -7, -16),\r\n  tagBrainstem: new THREE.Vector3(2, -18, -11),\r\n  tagHippocampus: new THREE.Vector3(12, -4, 5)\r\n};\r\n\r\nconst projectedLabelPoint = new THREE.Vector3();\r\nconst memoryKindLabelWorld = {\r\n  event: memoryCenter.clone().add(new THREE.Vector3(9.0, 5.8, 4.8)).multiplyScalar(1.24).add(brainRoot.position),\r\n  fact: memoryCenter.clone().add(new THREE.Vector3(6.2, 3.8, 3.2)).multiplyScalar(1.24).add(brainRoot.position),\r\n  schema: memoryCenter.clone().add(new THREE.Vector3(3.4, 2.0, 1.6)).multiplyScalar(1.24).add(brainRoot.position)\r\n};\r\n\r\nfunction dashed(a,b) {\r\n  const geo = new THREE.BufferGeometry().setFromPoints([a,b]);\r\n  const mat = new THREE.LineDashedMaterial({\r\n    color:0x000000,\r\n    dashSize:0.42,\r\n    gapSize:0.28,\r\n    transparent:true,\r\n    opacity:0.28\r\n  });\r\n  const l = new THREE.Line(geo,mat);\r\n  l.computeLineDistances();\r\n  leaderGroup.add(l);\r\n}\r\n\r\ndashed(labelWorld.tagPrefrontal, anchorPoints.prefrontal);\r\ndashed(labelWorld.tagParietal, anchorPoints.parietal);\r\ndashed(labelWorld.tagTemporal, anchorPoints.temporal);\r\ndashed(labelWorld.tagOccipital, anchorPoints.occipital);\r\ndashed(labelWorld.tagCerebellum, anchorPoints.cerebellum);\r\ndashed(labelWorld.tagBrainstem, anchorPoints.brainstem);\r\ndashed(labelWorld.tagHippocampus, anchorPoints.hippocampus);\r\n\r\n// ---------------------------------------------------------------------\r\n// 状态切换\r\n// ---------------------------------------------------------------------\r\nfunction updateRegionMode(show) {\r\n  regionsVisible = show;\r\n  const btn = document.getElementById('toggleRegionsBtn');\r\n  btn.textContent = show ? '分区开' : '分区关';\r\n  btn.classList.toggle('active', show);\r\n\r\n  cortexMeshes.forEach(mesh => {\r\n    const region = mesh.userData.region || 'parietal';\r\n    if (show) {\r\n      mesh.material.color.setHex(regionGray[region] || 0xd5d5d5);\r\n    } else {\r\n      mesh.material.color.setHex(0xd7d7d7);\r\n    }\r\n  });\r\n\r\n  cortexAnimationPairs.forEach(({proxy}) => {\r\n    const region = proxy.userData.region || 'parietal';\r\n    proxy.material.color.setHex(show ? (regionGray[region] || 0xd5d5d5) : 0xd7d7d7);\r\n  });\r\n\r\n  render();\r\n}\r\n\r\nfunction updateCore(show) {\r\n  coreVisible = show;\r\n  const btn = document.getElementById('toggleCoreBtn');\r\n  btn.textContent = show ? '内部开' : '内部关';\r\n  btn.classList.toggle('active', show);\r\n  coreMeshes.forEach(m => m.visible = show);\r\n  refreshBrainOcclusion();\r\n  render();\r\n}\r\n\r\nfunction updateGrid(show) {\r\n  gridVisible = show;\r\n  const btn = document.getElementById('toggleGridBtn');\r\n  btn.textContent = show ? '网格开' : '网格关';\r\n  btn.classList.toggle('active', show);\r\n  grid.visible = show;\r\n  render();\r\n}\r\n\r\nfunction updateLabels(show) {\r\n  labelsVisible = show;\r\n  const btn = document.getElementById('toggleLabelsBtn');\r\n  btn.textContent = show ? '标签开' : '标签关';\r\n  btn.classList.toggle('active', show);\r\n\r\n  [\r\n    'tagPrefrontal','tagParietal','tagTemporal','tagOccipital',\r\n    'tagCerebellum','tagBrainstem','tagHippocampus'\r\n  ].forEach(id => document.getElementById(id).classList.toggle('hidden', !show));\r\n\r\n  leaderGroup.visible = show;\r\n  render();\r\n}\r\n\r\n// ---------------------------------------------------------------------\r\n// 标签投影\r\n// ---------------------------------------------------------------------\r\nconst axisLabels = {\r\n  axisX: new THREE.Vector3(AXIS_LEN+0.6,0,0),\r\n  axisY: new THREE.Vector3(0,AXIS_LEN+0.6,0),\r\n  axisZ: new THREE.Vector3(0,0,AXIS_LEN+0.6)\r\n};\r\n\r\nfunction place(el, point) {\r\n  const p = projectedLabelPoint.copy(point).project(camera);\r\n  const visible = p.z > -1 && p.z < 1;\r\n\r\n  if (!visible) {\r\n    el.style.display = 'none';\r\n    return;\r\n  }\r\n\r\n  el.style.display = 'block';\r\n  const rawX = (p.x*.5+.5) * window.innerWidth;\r\n  const rawY = (-p.y*.5+.5) * window.innerHeight;\r\n  placeAtScreenPoint(el, rawX, rawY);\r\n}\r\n\r\nfunction placeAtScreenPoint(el, rawX, rawY) {\r\n  // 投影点可能落在视口外，尤其是在窄屏旋转时；把标签限制在可读区域。\r\n  const margin = 6;\r\n  const halfWidth = Math.max(0, el.offsetWidth / 2);\r\n  const halfHeight = Math.max(0, el.offsetHeight / 2);\r\n  const x = Math.max(margin + halfWidth,\r\n    Math.min(window.innerWidth - margin - halfWidth, rawX));\r\n  const y = Math.max(margin + halfHeight,\r\n    Math.min(window.innerHeight - margin - halfHeight, rawY));\r\n  el.style.left = `${x}px`;\r\n  el.style.top = `${y}px`;\r\n}\r\n\r\nfunction placeMemoryKindLabels() {\r\n  const entries = [\r\n    ['event', memoryGrouped ? eventKindVisible : true, document.getElementById('memoryKindEventLabel')],\r\n    ['fact', memoryGrouped && factKindVisible, document.getElementById('memoryKindFactLabel')],\r\n    ['schema', memoryGrouped && schemaKindVisible, document.getElementById('memoryKindSchemaLabel')]\r\n  ];\r\n\r\n  if (memoryGrouped && window.innerWidth <= 700) {\r\n    const controlsBottom = document.querySelector('.controls').getBoundingClientRect().bottom;\r\n    const y = Math.min(window.innerHeight - 38, controlsBottom + 18);\r\n    const xByLayer = {\r\n      event: window.innerWidth / 6,\r\n      fact: window.innerWidth / 2,\r\n      schema: window.innerWidth * 5 / 6\r\n    };\r\n\r\n    entries.forEach(([layer, visible, element]) => {\r\n      if (!visible) return;\r\n      element.style.display = 'block';\r\n      placeAtScreenPoint(element, xByLayer[layer], y);\r\n    });\r\n    return;\r\n  }\r\n\r\n  entries.forEach(([layer, visible, element]) => {\r\n    if (visible) place(element, memoryKindLabelWorld[layer]);\r\n  });\r\n\r\n  if (memoryGrouped && eventKindVisible) {\r\n    const eventLabel = document.getElementById('memoryKindEventLabel');\r\n    const eventRect = eventLabel.getBoundingClientRect();\r\n    const chainRect = document.getElementById('memoryChainCard').getBoundingClientRect();\r\n    const overlapsChain = eventRect.left < chainRect.right &&\r\n      eventRect.right > chainRect.left &&\r\n      eventRect.top < chainRect.bottom &&\r\n      eventRect.bottom > chainRect.top;\r\n\r\n    if (overlapsChain) {\r\n      placeAtScreenPoint(\r\n        eventLabel,\r\n        eventRect.left + eventRect.width / 2,\r\n        chainRect.bottom + eventRect.height / 2 + 8\r\n      );\r\n    }\r\n  }\r\n}\r\n\r\nfunction recenterGrid() {\r\n  const t = controls.target;\r\n  grid.position.set(\r\n    Math.round(t.x/GRID_STEP)*GRID_STEP,\r\n    Math.round(t.y/GRID_STEP)*GRID_STEP,\r\n    Math.round(t.z/GRID_STEP)*GRID_STEP\r\n  );\r\n}\r\n\r\nfunction render() {\r\n  if (renderSuspended) return;\r\n\r\n  place(document.getElementById('axisX'), axisLabels.axisX);\r\n  place(document.getElementById('axisY'), axisLabels.axisY);\r\n  place(document.getElementById('axisZ'), axisLabels.axisZ);\r\n\r\n  if (labelsVisible) {\r\n    for (const [id,p] of Object.entries(labelWorld)) {\r\n      place(document.getElementById(id), p);\r\n    }\r\n  }\r\n\r\n  if (memoryVisible) {\r\n    placeMemoryKindLabels();\r\n  }\r\n\r\n  renderer.render(scene,camera);\r\n  window.__brainPerformance.renderCount++;\r\n}\r\n\r\nfunction requestRender() {\r\n  if (renderSuspended || scheduledRender) return;\r\n  scheduledRender = requestAnimationFrame(() => {\r\n    scheduledRender = 0;\r\n    render();\r\n  });\r\n}\r\n\r\ncontrols.addEventListener('change', () => {\r\n  recenterGrid();\r\n  requestRender();\r\n});\r\n\r\ndocument.getElementById('resetBtn').addEventListener('click', () => {\r\n  camera.position.set(0,2.4,44);\r\n  controls.target.set(0,1.1,-0.9);\r\n  grid.position.set(0,0,0);\r\n  controls.update();\r\n  render();\r\n});\r\n\r\ndocument.getElementById('frontBtn').addEventListener('click', () => {\r\n  camera.position.set(0,2.4,44);\r\n  controls.target.set(0,1.1,-0.9);\r\n  controls.update();\r\n  render();\r\n});\r\n\r\ndocument.getElementById('toggleLabelsBtn').addEventListener('click', () => {\r\n  updateLabels(!labelsVisible);\r\n});\r\n\r\ndocument.getElementById('toggleRegionsBtn').addEventListener('click', () => {\r\n  updateRegionMode(!regionsVisible);\r\n});\r\n\r\ndocument.getElementById('toggleCoreBtn').addEventListener('click', () => {\r\n  updateCore(!coreVisible);\r\n});\r\n\r\ndocument.getElementById('toggleGridBtn').addEventListener('click', () => {\r\n  updateGrid(!gridVisible);\r\n});\r\n\r\ndocument.getElementById('toggleNeuralBtn').addEventListener('click', () => {\r\n  updateNeuralVisible(!neuralVisible);\r\n});\r\n\r\ndocument.getElementById('spontaneousBtn').addEventListener('click', () => {\r\n  setNeuralMode('spontaneous');\r\n});\r\n\r\ndocument.getElementById('frontalPulseBtn').addEventListener('click', () => {\r\n  setNeuralMode('prefrontal');\r\n});\r\n\r\ndocument.getElementById('hippocampusPulseBtn').addEventListener('click', () => {\r\n  setNeuralMode('hippocampus');\r\n});\r\n\r\ndocument.getElementById('globalPulseBtn').addEventListener('click', () => {\r\n  setNeuralMode('global');\r\n});\r\n\r\ndocument.getElementById('toggleMemoryBtn').addEventListener('click', () => {\r\n  updateMemoryVisibility(!memoryVisible);\r\n});\r\n\r\ndocument.getElementById('memoryXrayBtn').addEventListener('click', () => {\r\n  updateMemoryXray(!memoryXrayEnabled);\r\n});\r\n\r\ndocument.getElementById('toggleObjectGroupingBtn').addEventListener('click', () => {\r\n  updateObjectGrouping(!memoryGrouped);\r\n});\r\n\r\ndocument.getElementById('toggleEventKindBtn').addEventListener('click', () => {\r\n  updateEventKind(!eventKindVisible);\r\n});\r\n\r\ndocument.getElementById('toggleFactKindBtn').addEventListener('click', () => {\r\n  updateFactKind(!factKindVisible);\r\n});\r\n\r\ndocument.getElementById('toggleSchemaKindBtn').addEventListener('click', () => {\r\n  updateSchemaKind(!schemaKindVisible);\r\n});\r\n\r\ndocument.getElementById('memoryConsolidateBtn').addEventListener('click', () => {\r\n  startMemoryPulse('consolidate');\r\n});\r\n\r\ndocument.getElementById('memoryRetrieveBtn').addEventListener('click', () => {\r\n  startMemoryPulse('retrieve');\r\n});\r\n\r\ndocument.getElementById('memoryExampleBtn').addEventListener('click', () => {\r\n  highlightMemoryExample(memoryExampleIndex,true);\r\n});\r\n\r\ndocument.getElementById('memoryNextExampleBtn').addEventListener('click', () => {\r\n  highlightMemoryExample(memoryExampleIndex + 1,false);\r\n});\r\n\r\ndocument.getElementById('memoryLoadMoreBtn').addEventListener('click', () => {\r\n  if (!canonicalSnapshotLoading && canonicalSnapshotCursor) {\r\n    loadCanonicalSnapshot(canonicalSnapshotCursor);\r\n  }\r\n});\r\n\r\ndocument.getElementById('memoryClearExampleBtn').addEventListener('click', () => {\r\n  clearMemoryExample();\r\n});\r\n\r\nwindow.addEventListener('resize', () => {\r\n  if (scheduledRender) cancelAnimationFrame(scheduledRender);\r\n  scheduledRender = requestAnimationFrame(() => {\r\n    scheduledRender = 0;\r\n    const w = window.innerWidth;\r\n    const h = window.innerHeight;\r\n    const nextPixelRatio = Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap);\r\n    camera.aspect = w/h;\r\n    camera.updateProjectionMatrix();\r\n    if (renderer.getPixelRatio() !== nextPixelRatio) renderer.setPixelRatio(nextPixelRatio);\r\n    renderer.setSize(w,h);\r\n    updateMemoryLayout();\r\n    render();\r\n  });\r\n});\r\n\r\nrenderSuspended = true;\r\nupdateLabels(true);\r\nupdateRegionMode(true);\r\nupdateCore(false);\r\nupdateGrid(true);\r\n\r\n// 默认突出 Canonical 激活子图：关闭内部粗体素并启用图谱透视。\r\nupdateNeuralVisible(false);\r\nsetNeuralMode('spontaneous');\r\n\r\nupdateMemoryVisibility(true);\r\nupdateMemoryXray(true);\r\nupdateObjectGrouping(false);\r\nupdateEventKind(true);\r\nupdateFactKind(true);\r\nupdateSchemaKind(true);\r\n\r\n// 默认给出一条可回源的 Canonical L3 证明路径。\r\nhighlightMemoryExample(0,false);\r\n\r\nrenderSuspended = false;\r\nrender();\r\nwindow.__canonicalSnapshotReady = loadCanonicalSnapshot();\r\n</script>\r\n"
const EMBED_STYLE = "\n  :host { display:block; container-type:size; }\n  .controls { display:none !important; }\n  .hud, .legend, .tag, .memory-layer-tag,\n  #memoryKindLegend, #memoryChainCard, #memoryPanel { display:none !important; }\n  :host([data-knowledge-brain-compact]) .hud { left:10px; top:10px; max-width:calc(100% - 20px); }\n  :host([data-knowledge-brain-compact]) .hud .sub { display:none; }\n  :host([data-knowledge-brain-compact]) .controls {\n    left:10px; right:10px; top:48px; max-width:none;\n    max-height:min(150px, 34%); overflow-y:auto;\n    justify-content:flex-start; align-content:flex-start;\n    gap:5px; padding:6px; border:1px solid #000;\n    background:rgba(255,255,255,.92);\n  }\n  :host([data-knowledge-brain-compact]) .controls button { min-height:38px; padding:0 9px; }\n  :host([data-knowledge-brain-compact]) #memoryChainCard {\n    left:10px !important; right:10px !important; top:210px !important;\n    bottom:auto !important; width:auto !important; max-height:170px; overflow:auto;\n  }\n  :host([data-knowledge-brain-compact]) .legend { left:10px; right:10px; bottom:42px; font-size:10px; line-height:1.45; }\n  :host([data-knowledge-brain-compact]) .desktop-input-hints,\n  :host([data-knowledge-brain-compact]) .desktop-node-hint,\n  :host([data-knowledge-brain-compact]) .legend #neuralStatus { display:none; }\n  :host([data-knowledge-brain-compact]) .mobile-input-hint { display:block; }\n  :host([data-knowledge-brain-compact]) #memoryPanel {\n    left:10px; right:10px; top:210px; bottom:10px; width:auto; max-height:calc(100% - 220px);\n  }\n  :host([data-knowledge-brain-compact]) #memoryKindLegend { left:10px; right:10px; bottom:9px; justify-content:flex-end; }\n"

export function createBrainScene(host) {
  if (!host) return { ready: false, setMode() {}, dispose() {} }
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' })
  shadow.innerHTML = '<style>' + REFERENCE_STYLE + EMBED_STYLE + '.dshBrainUi{position:absolute;inset:0}.dshBrainUi .controls,.dshBrainUi #viewport,.dshBrainUi #memoryPanel{pointer-events:auto}.eisKnowledgeBrainCanvas{display:block;width:100%;height:100%;transform:scale(1);transition:transform .65s cubic-bezier(.22,.61,.36,1);transform-origin:50% 90%}</style>' + REFERENCE_MARKUP
  const root = shadow
  const globalDocument = globalThis.document
  const resizeTarget = new EventTarget()
  const updateCompactLayout = () => host.toggleAttribute('data-knowledge-brain-compact', host.clientWidth <= 900)
  const hostResizeObserver = new ResizeObserver(() => {
    updateCompactLayout()
    resizeTarget.dispatchEvent(new Event('resize'))
  })
  hostResizeObserver.observe(host)
  updateCompactLayout()
  const scopedDocument = {
    get hidden() { return globalDocument.hidden },
    getElementById: id => root.querySelector('#' + id),
    querySelector: selector => root.querySelector(selector)
  }

const viewport = root.querySelector('#viewport');

const qualityPresets = {
  high: {
    cortexTheta: 166,
    cortexPhi: 254,
    cortexCube: 0.228,
    cerebellumTheta: 58,
    cerebellumPhi: 92,
    cerebellumCube: 0.255,
    neuralNodes: 820,
    activeSpheres: 88,
    pixelRatioCap: 1.25,
    animationFps: 60,
    antialias: true
  },
  balanced: {
    cortexTheta: 136,
    cortexPhi: 206,
    cortexCube: 0.275,
    cerebellumTheta: 48,
    cerebellumPhi: 74,
    cerebellumCube: 0.30,
    neuralNodes: 560,
    activeSpheres: 56,
    pixelRatioCap: 1,
    animationFps: 30,
    antialias: true
  },
  low: {
    cortexTheta: 104,
    cortexPhi: 158,
    cortexCube: 0.35,
    cerebellumTheta: 38,
    cerebellumPhi: 58,
    cerebellumCube: 0.37,
    neuralNodes: 360,
    activeSpheres: 36,
    pixelRatioCap: 1,
    animationFps: 24,
    antialias: false
  }
};

const requestedQuality = null;
const lowPowerDevice =
  window.matchMedia('(max-width: 700px)').matches ||
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
  (navigator.deviceMemory && navigator.deviceMemory <= 4);
const qualityName = Object.hasOwn(qualityPresets, requestedQuality)
  ? requestedQuality
  : (lowPowerDevice ? 'low' : 'balanced');
const quality = qualityPresets[qualityName];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

window.__brainPerformance = {
  profile: qualityName,
  reducedMotion,
  cortexInstances: 0,
  neuralInitialized: false,
  neuralNodes: 0,
  neuralEdges: 0,
  animationProxyAvailable: false,
  animationProxyActive: false,
  renderCount: 0
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
scene.fog = new THREE.FogExp2(0xffffff, 0.0105);

const camera = new THREE.PerspectiveCamera(
  42,
  viewport.clientWidth / viewport.clientHeight,
  0.05,
  260
);

// 初始为接近参考图的正面视角，大脑占画面主体。
camera.position.set(0, 2.4, 44);

const renderer = new THREE.WebGLRenderer({
  antialias: quality.antialias,
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);

const webgl = renderer.getContext();
const standardRendererName = String(webgl.getParameter(webgl.RENDERER) || '');
// Firefox 已弃用调试扩展并直接公开 RENDERER；Chromium 仍需扩展识别 SwiftShader。
const debugRendererInfo = /Firefox\//.test(navigator.userAgent)
  ? null
  : webgl.getExtension('WEBGL_debug_renderer_info');
const rendererName = debugRendererInfo
  ? String(webgl.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL) || standardRendererName)
  : standardRendererName;
const softwareRenderer = /swiftshader|llvmpipe|software/i.test(rendererName);
const targetAnimationFps = Math.min(
  quality.animationFps,
  softwareRenderer ? 12 : quality.animationFps,
  reducedMotion ? 15 : quality.animationFps
);
const animationFrameInterval = 1000 / targetAnimationFps;

Object.assign(window.__brainPerformance, {
  pixelRatio: renderer.getPixelRatio(),
  targetAnimationFps,
  renderer: rendererName || 'unknown',
  softwareRenderer
});

const ambient = new THREE.AmbientLight(0xffffff, 1.10);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xffffff, 1.08);
key.position.set(13, 17, 18);
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 0.30);
fill.position.set(-15, 7, 11);
scene.add(fill);

const rear = new THREE.DirectionalLight(0xffffff, 0.16);
rear.position.set(0, 8, -18);
scene.add(rear);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.minDistance = 20;
controls.maxDistance = 95;
controls.rotateSpeed = 0.70;
controls.zoomSpeed = 0.85;
controls.panSpeed = 0.65;
controls.target.set(0, 1.1, -0.9);
controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;

// ---------------------------------------------------------------------
// 无限感稀疏三维网格
// ---------------------------------------------------------------------
const GRID_STEP = 2.5;
const HALF_SIZE = 47;

function buildGrid() {
  const normal = [];
  const major = [];

  const push = (arr, ax, ay, az, bx, by, bz) => arr.push(ax, ay, az, bx, by, bz);
  const isMajor = (v) => Math.abs(v % 10) < 0.001;

  for (let a = -HALF_SIZE; a <= HALF_SIZE; a += GRID_STEP) {
    for (let b = -HALF_SIZE; b <= HALF_SIZE; b += GRID_STEP) {
      const arr = (isMajor(a) || isMajor(b)) ? major : normal;
      push(arr, -HALF_SIZE, a, b, HALF_SIZE, a, b);
      push(arr, a, -HALF_SIZE, b, a, HALF_SIZE, b);
      push(arr, a, b, -HALF_SIZE, a, b, HALF_SIZE);
    }
  }

  const group = new THREE.Group();

  const g1 = new THREE.BufferGeometry();
  g1.setAttribute('position', new THREE.Float32BufferAttribute(normal, 3));
  group.add(new THREE.LineSegments(
    g1,
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.040 })
  ));

  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.Float32BufferAttribute(major, 3));
  group.add(new THREE.LineSegments(
    g2,
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.095 })
  ));

  return group;
}

const grid = buildGrid();
scene.add(grid);

// ---------------------------------------------------------------------
// 坐标轴
// ---------------------------------------------------------------------
const AXIS_LEN = 31;

function line(a, b, opacity=0.95) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  return new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity })
  );
}

scene.add(line(new THREE.Vector3(-AXIS_LEN,0,0), new THREE.Vector3(AXIS_LEN,0,0)));
scene.add(line(new THREE.Vector3(0,-AXIS_LEN,0), new THREE.Vector3(0,AXIS_LEN,0)));
scene.add(line(new THREE.Vector3(0,0,-AXIS_LEN), new THREE.Vector3(0,0,AXIS_LEN)));

const origin = new THREE.Mesh(
  new THREE.SphereGeometry(0.035, 10, 10),
  new THREE.MeshBasicMaterial({ color: 0x000000 })
);
scene.add(origin);

[
  [new THREE.Vector3(1,0,0), new THREE.Vector3(AXIS_LEN-1.1,0,0)],
  [new THREE.Vector3(0,1,0), new THREE.Vector3(0,AXIS_LEN-1.1,0)],
  [new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,AXIS_LEN-1.1)]
].forEach(([dir,pos]) => {
  scene.add(new THREE.ArrowHelper(dir, pos, 1.1, 0x000000, 0.30, 0.15));
});

// ---------------------------------------------------------------------
// 大脑参数
// ---------------------------------------------------------------------
const brainRoot = new THREE.Group();
brainRoot.scale.set(1.24, 1.24, 1.24);
brainRoot.position.set(0, 0.6, 0);
scene.add(brainRoot);

const regionGray = {
  prefrontal: 0xe3e3e3,
  parietal: 0xd8d8d8,
  temporal: 0xcecece,
  occipital: 0xc4c4c4,
  cerebellum: 0xb9b9b9,
  brainstem: 0xaaaaaa,
  hippocampus: 0x9c9c9c
};

let cortexMeshes = [];
let coreMeshes = [];
const cortexAnimationPairs = [];
const lightweightAnimationReasons = new Set();
let labelsVisible = true;
let regionsVisible = true;
let coreVisible = true;
let gridVisible = true;
let renderSuspended = false;
let scheduledRender = 0;

function createCortexAnimationProxy(mesh, points, pointSize, shadeForPoint=()=>1) {
  if (!softwareRenderer || !points.length) return;

  const sampleStride = 4;
  const sampleCount = Math.ceil(points.length / sampleStride);
  const positions = new Float32Array(sampleCount * 3);
  const shades = new Float32Array(sampleCount * 3);

  for (let source = 0, target = 0; source < points.length; source += sampleStride, target++) {
    const p = points[source];
    const shade = shadeForPoint(p);
    positions[target*3] = p.x;
    positions[target*3+1] = p.y;
    positions[target*3+2] = p.z;
    shades[target*3] = shade;
    shades[target*3+1] = shade;
    shades[target*3+2] = shade;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(shades, 3));

  const proxy = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: regionGray[mesh.userData.region],
      size: pointSize * 1.65,
      vertexColors: true,
      transparent: true,
      opacity: 0.34,
      sizeAttenuation: true,
      depthWrite: false
    })
  );
  proxy.visible = false;
  proxy.renderOrder = 3;
  proxy.userData.region = mesh.userData.region;
  brainRoot.add(proxy);
  cortexAnimationPairs.push({ mesh, proxy });
  window.__brainPerformance.animationProxyAvailable = true;
}

function setLightweightAnimation(reason, active) {
  if (!softwareRenderer) return;

  if (active) lightweightAnimationReasons.add(reason);
  else lightweightAnimationReasons.delete(reason);

  const proxyActive = lightweightAnimationReasons.size > 0;
  cortexAnimationPairs.forEach(({mesh, proxy}) => {
    mesh.visible = !proxyActive;
    proxy.visible = proxyActive;
  });
  window.__brainPerformance.animationProxyActive = proxyActive;
}

// ---------------------------------------------------------------------
// 皮层曲面：用参数化表面直接铺设超细小方块。
// 相比全体积暴力扫描，这样能把更多方块集中到真正可见的皮层。
// ---------------------------------------------------------------------
function cortexRegion(x, y, z) {
  if (z > 4.8 && y > -1.2) return 'prefrontal';
  if (z < -6.2 && y > -1.4) return 'occipital';
  if (y < 2.0 && Math.abs(x) > 4.2 && z > -5.2) return 'temporal';
  if (y > 4.8 && z > -5.8) return 'parietal';
  return 'parietal';
}

function corticalField(theta, phi, side, xN, yN, zN) {
  const superior = clamp01((yN + 1.0) * 0.5);
  const lateral = clamp01(Math.abs(xN));
  const frontal = clamp01((zN + 1.0) * 0.5);
  const occipital = clamp01((-zN + 1.0) * 0.5);
  const inferior = clamp01((-yN + 1.0) * 0.5);

  const prefrontalW = frontal * (0.34 + 0.66 * lateral) * (0.50 + 0.50 * superior);
  const parietalW = superior * (1.0 - frontal * 0.26) * (1.0 - occipital * 0.20);
  const temporalW = inferior * lateral * (0.72 + 0.28 * frontal);
  const occipitalW = occipital * (0.54 + 0.46 * superior);

  // 前额叶：竖向、扇形、长短交替
  const prefrontal =
    0.20 * Math.sin((zN * 5.0 - yN * 1.15 + side * 0.13) * Math.PI) +
    0.105 * Math.sin((zN * 8.6 + xN * 1.10 - yN * 0.45) * Math.PI) +
    0.050 * Math.sin((zN * 13.5 + xN * 2.1) * Math.PI);

  // 顶叶：前后向长回 + 次级横纹
  const parietal =
    0.235 * Math.sin((xN * 4.45 + zN * 0.46 + side * 0.10) * Math.PI) +
    0.105 * Math.sin((xN * 7.9 - zN * 0.85 + yN * 0.33) * Math.PI) +
    0.047 * Math.sin((xN * 13.1 + zN * 1.75) * Math.PI);

  // 颞叶：水平弧形沟回为主
  const temporal =
    0.195 * Math.sin((yN * 3.15 + zN * 2.48 + xN * 0.33) * Math.PI) +
    0.092 * Math.sin((zN * 5.35 - yN * 1.12 - side * 0.16) * Math.PI) +
    0.042 * Math.sin((zN * 9.2 + yN * 2.6) * Math.PI);

  // 枕叶：较短、较密、更碎
  const occipitalF =
    0.145 * Math.sin((xN * 2.65 - zN * 3.85) * Math.PI) +
    0.088 * Math.sin((xN * 4.10 - zN * 6.85 + yN * 0.42) * Math.PI) +
    0.040 * Math.sin((xN * 7.8 - zN * 11.0) * Math.PI);

  return prefrontalW * prefrontal +
         parietalW * parietal +
         temporalW * temporal +
         occipitalW * occipitalF;
}

function gauss(v, center, width) {
  const d = (v - center) / width;
  return Math.exp(-d * d);
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function groove(distance, width) {
  const d = distance / width;
  return Math.exp(-d * d);
}

function ridge(distance, width) {
  const d = distance / width;
  return Math.exp(-d * d);
}

function buildCortexHemisphere(side) {
  const thetaSteps = quality.cortexTheta;
  const phiBaseSteps = quality.cortexPhi;
  const cubeSize = quality.cortexCube;
  const geo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);

  const byRegion = {
    prefrontal: [],
    parietal: [],
    temporal: [],
    occipital: []
  };

  for (let ti = 0; ti < thetaSteps; ti++) {
    const theta = Math.PI * ti / (thetaSteps - 1);
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);

    const ringCount = Math.max(1, Math.round(phiBaseSteps * Math.max(0.036, sinT)));
    const phiOffset = (ti % 2) * Math.PI / Math.max(3, ringCount);

    for (let pi = 0; pi < ringCount; pi++) {
      const phi = (Math.PI * 2 * pi / ringCount) + phiOffset;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      // 正面轮廓更接近参考图：主体更圆润，顶部更高，左右对称更好。
      let rx = 9.2;
      let ry = 12.0;
      let rz = 9.8;

      const lower = Math.max(0, -cosT);
      rx *= 1.0 - lower * 0.13;
      rz *= 1.0 - lower * 0.10;

      const frontBias = Math.max(0, sinP);
      const backBias = Math.max(0, -sinP);
      rz *= 1.0 + frontBias * 0.09 - backBias * 0.05;

      // 顶叶-额叶顶冠稍饱满，颞下部稍内收
      const superiorBoost = Math.max(0, cosT);
      rx *= 1.0 + superiorBoost * 0.03;
      ry *= 1.0 + superiorBoost * 0.02;

      const centerX = side * 5.15;

      let x = centerX + rx * sinT * cosP;
      let y = 2.65 + ry * cosT;
      let z = rz * sinT * sinP;

      // 更自然的左右脑中缝：不是简单直缝，而是上宽下窄、略带弧度的纵裂
      const fissureWidth =
        0.34 +
        0.23 * gauss(y, 8.8, 5.4) +
        0.07 * gauss(z, 0.0, 7.0);

      const medialInfluence = Math.exp(-Math.pow(Math.abs(x) / 2.1, 2));
      x += side * medialInfluence * (0.78 + 0.18 * gauss(y, 8.0, 5.0));

      const xN = THREE.MathUtils.clamp((x - centerX) / 10.5, -1, 1);
      const yN = THREE.MathUtils.clamp((y - 2.65) / 12.0, -1, 1);
      const zN = THREE.MathUtils.clamp(z / 10.2, -1, 1);

      const polarFade = smoothstep(0.12, 0.34, sinT);

      const crownMask = gauss(theta, 0.12 * Math.PI, 0.12 * Math.PI);
      const superiorMask = gauss(y, 12.4, 3.4);
      const medialMask = gauss(Math.abs(x), 3.0, 2.2);

      const f = corticalField(theta, phi, side, xN, yN, zN);

      let displacement = f * 0.64 * polarFade;
      displacement *= (1.0 - 0.43 * crownMask * superiorMask);
      displacement *= (1.0 - 0.14 * medialMask);

      // -------------------------
      // 真实感主沟 / 次级沟系统
      // -------------------------

      // 中央沟：S 形、向下外侧延伸
      const centralCurve =
        2.0 +
        0.95 * Math.sin(x * 0.115) -
        0.085 * (y - 5.5) +
        0.16 * Math.sin(y * 0.28);

      let centralDepth =
        groove(z - centralCurve, 0.56) *
        gauss(y, 6.2, 5.8) *
        (0.30 + 0.70 * Math.min(1, Math.abs(x) / 9.2));
      centralDepth *= polarFade;
      centralDepth *= (1.0 - 0.80 * crownMask * superiorMask);
      displacement -= centralDepth * 1.34;

      // 中央后沟：中央沟后方较浅的次级沟
      const postCentralCurve =
        -0.35 +
        0.72 * Math.sin(x * 0.10 + 0.35) -
        0.055 * (y - 5.0);

      let postCentral =
        groove(z - postCentralCurve, 0.43) *
        gauss(y, 6.6, 4.7) *
        Math.min(1, Math.max(0, (Math.abs(x) - 2.3) / 6.5));
      postCentral *= polarFade;
      displacement -= postCentral * 0.62;

      // 顶内沟：顶叶区域横向长沟
      const intraparietalCurve =
        -2.6 +
        0.55 * Math.sin(x * 0.13 - 0.2) +
        0.10 * (y - 7.0);

      let intraparietal =
        groove(z - intraparietalCurve, 0.39) *
        gauss(y, 8.1, 3.5) *
        Math.min(1, Math.max(0, (Math.abs(x) - 3.0) / 5.5));
      intraparietal *= polarFade;
      displacement -= intraparietal * 0.56;

      // 外侧裂：颞叶上缘，弧形更明显
      const lateralTarget =
        0.85 +
        0.58 * Math.sin(z * 0.19) -
        0.035 * (Math.abs(x) - 7.0);

      let lateralDepth =
        groove(y - lateralTarget, 0.48) *
        gauss(z, 2.0, 5.9) *
        Math.min(1, Math.max(0, (Math.abs(x) - 3.6) / 6.6));
      lateralDepth *= polarFade;
      lateralDepth *= (1.0 - 0.77 * crownMask);
      displacement -= lateralDepth * 1.36;

      // 上颞沟：与外侧裂平行但更浅
      const supTemporalTarget =
        -0.95 +
        0.42 * Math.sin(z * 0.20 + 0.65);

      let superiorTemporal =
        groove(y - supTemporalTarget, 0.36) *
        gauss(z, 1.2, 5.4) *
        Math.min(1, Math.max(0, (Math.abs(x) - 5.1) / 5.5));
      displacement -= superiorTemporal * 0.54;

      // 下颞沟：更靠下、更弱
      const infTemporalTarget =
        -2.9 +
        0.34 * Math.sin(z * 0.18 - 0.5);

      let inferiorTemporal =
        groove(y - infTemporalTarget, 0.32) *
        gauss(z, 0.8, 5.0) *
        Math.min(1, Math.max(0, (Math.abs(x) - 5.5) / 5.0));
      displacement -= inferiorTemporal * 0.38;

      // 顶枕沟：后上部明显沟槽
      let occDepth =
        groove(z + 5.75 - 0.34 * Math.sin(x * 0.16), 0.48) *
        gauss(y, 7.3, 4.0);
      occDepth *= polarFade;
      occDepth *= (1.0 - 0.33 * crownMask * superiorMask);
      displacement -= occDepth * 0.96;

      // 额叶次级沟：上额沟 / 下额沟
      const frontalSide = Math.min(1, Math.max(0, (Math.abs(x) - 4.0) / 5.5));
      let supFrontal =
        groove(y - (7.7 + 0.38 * Math.sin(z * 0.20)), 0.34) *
        gauss(z, 6.2, 4.3) *
        frontalSide;
      displacement -= supFrontal * 0.44;

      let infFrontal =
        groove(y - (4.2 + 0.32 * Math.sin(z * 0.22 + 0.4)), 0.32) *
        gauss(z, 6.1, 4.2) *
        frontalSide;
      displacement -= infFrontal * 0.39;

      // -------------------------
      // 脑回凸起：沟与沟之间轻微抬高
      // -------------------------
      const superiorFrontalRidge =
        ridge(y - 9.2, 0.65) * gauss(z, 6.1, 4.5) * frontalSide;
      displacement += superiorFrontalRidge * 0.25;

      const precentralRidge =
        ridge(z - (3.25 + 0.80 * Math.sin(x * 0.11)), 0.74) *
        gauss(y, 6.0, 5.0) *
        Math.min(1, Math.max(0, (Math.abs(x) - 2.4) / 6.0));
      displacement += precentralRidge * 0.23;

      const postcentralRidge =
        ridge(z - (0.75 + 0.68 * Math.sin(x * 0.10 + 0.15)), 0.70) *
        gauss(y, 6.3, 4.8);
      displacement += postcentralRidge * 0.19;

      // -------------------------
      // 第三级区域化脑沟网络
      // 这些沟槽更细、更碎，主要用于让大脑皮层远看也能看到明显沟回层次。
      // -------------------------
      const frontalWeight = clamp01((zN + 0.05) / 0.95) * clamp01((Math.abs(xN) + 0.15) / 1.15);
      const parietalWeight = clamp01((yN + 0.10) / 0.90) * (1.0 - frontalWeight * 0.35);
      const temporalWeight = clamp01((-yN + 0.10) / 1.05) * clamp01((Math.abs(xN) - 0.10) / 0.90);
      const occipitalWeight = clamp01((-zN + 0.12) / 1.05);

      const frontalFineA = groove(
        Math.sin((zN * 8.4 - yN * 2.1 + xN * 0.55) * Math.PI),
        0.34
      );
      const frontalFineB = groove(
        Math.sin((zN * 12.2 + xN * 1.8 - yN * 0.7) * Math.PI),
        0.28
      );
      displacement -= frontalWeight * (frontalFineA * 0.12 + frontalFineB * 0.08) * polarFade;

      const parietalFineA = groove(
        Math.sin((xN * 7.8 + zN * 1.2 + yN * 0.35) * Math.PI),
        0.32
      );
      const parietalFineB = groove(
        Math.sin((xN * 11.6 - zN * 2.2) * Math.PI),
        0.27
      );
      displacement -= parietalWeight * (parietalFineA * 0.13 + parietalFineB * 0.075) * polarFade;

      const temporalFineA = groove(
        Math.sin((yN * 7.0 + zN * 4.4 + xN * 0.55) * Math.PI),
        0.32
      );
      const temporalFineB = groove(
        Math.sin((zN * 9.8 - yN * 3.3) * Math.PI),
        0.27
      );
      displacement -= temporalWeight * (temporalFineA * 0.12 + temporalFineB * 0.075) * polarFade;

      const occipitalFineA = groove(
        Math.sin((xN * 6.0 - zN * 8.8 + yN * 0.5) * Math.PI),
        0.31
      );
      const occipitalFineB = groove(
        Math.sin((xN * 9.2 - zN * 13.0) * Math.PI),
        0.25
      );
      displacement -= occipitalWeight * (occipitalFineA * 0.12 + occipitalFineB * 0.07) * polarFade;

      // 对应脑回凸起，让沟和回的高度差更明显
      const corticalRidgeNetwork =
        0.055 * Math.max(0, Math.sin((xN * 5.2 + zN * 2.1 - yN * 0.6) * Math.PI)) +
        0.040 * Math.max(0, Math.sin((xN * 8.8 - zN * 3.2 + yN * 1.1) * Math.PI));
      displacement += corticalRidgeNetwork * polarFade;

      // 微细局部凹陷，只做表面起伏，不形成穿孔
      const microIndent =
        0.095 * Math.max(0, Math.sin((xN * 11.0 + zN * 5.4 + yN * 2.1) * Math.PI)) +
        0.065 * Math.max(0, Math.sin((xN * 17.0 - zN * 8.2) * Math.PI));
      displacement -= microIndent * polarFade * (0.48 + 0.72 * Math.abs(xN));

      // 顶部严格限制过深凹陷，避免出现“孔洞”
      const crownSmooth = crownMask * superiorMask;
      if (crownSmooth > 0.10 && displacement < -0.16) {
        displacement = -0.16 + (displacement + 0.16) * 0.11;
      }

      // 全局凹陷限幅：保持明显脑沟，但不允许形成穿孔
      displacement = Math.max(displacement, -1.42);

      const nx = (x - centerX) / (rx * rx);
      const ny = (y - 2.65) / (ry * ry);
      const nz = z / (rz * rz);
      const nl = Math.hypot(nx, ny, nz) || 1;

      x += nx / nl * displacement;
      y += ny / nl * displacement;
      z += nz / nl * displacement;

      // 下缘修型，保持更像参考图的正面轮廓
      if (y < -5.5 && Math.abs(x) > 8.0 && z > 1.0) continue;
      if (y < -7.6) continue;
      if (z > 12.0 && Math.abs(x) > 8.2) continue;

      // 纵裂裁切更自然
      if (Math.abs(x) < fissureWidth && y > -0.5) continue;

      const region = cortexRegion(x, y, z);
      const depth = THREE.MathUtils.clamp((displacement + 1.48) / 3.05, 0, 1);
      byRegion[region].push({ x, y, z, depth });
    }
  }

  Object.entries(byRegion).forEach(([region, points]) => {
    const mat = new THREE.MeshLambertMaterial({
      color: regionGray[region],
      transparent: true,
      opacity: 0.96
    });

    const mesh = new THREE.InstancedMesh(geo, mat, points.length);
    const dummy = new THREE.Object3D();
    const base = new THREE.Color(regionGray[region]);
    const shadeColor = new THREE.Color();

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const shade = 0.58 + p.depth * 0.46;
      mesh.setColorAt(i, shadeColor.copy(base).multiplyScalar(shade));
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.userData.region = region;
    mesh.userData.kind = 'cortex';
    brainRoot.add(mesh);
    cortexMeshes.push(mesh);
    createCortexAnimationProxy(
      mesh,
      points,
      cubeSize * 1.15,
      p => 0.58 + p.depth * 0.46
    );
    window.__brainPerformance.cortexInstances += points.length;
  });
}

buildCortexHemisphere(-1);
buildCortexHemisphere(1);

// ---------------------------------------------------------------------
// 小脑：更高频的横向回纹
// ---------------------------------------------------------------------
function buildCerebellumLobe(side) {
  const thetaSteps = quality.cerebellumTheta;
  const phiSteps = quality.cerebellumPhi;
  const cubeSize = quality.cerebellumCube;
  const geo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  const pts = [];

  const cx = side * 4.0;
  const cy = -6.7;
  const cz = -6.9;

  for (let ti = 3; ti < thetaSteps - 3; ti++) {
    const theta = Math.PI * ti / (thetaSteps - 1);
    for (let pi = 0; pi < phiSteps; pi++) {
      const phi = Math.PI * 2 * pi / phiSteps;

      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      let x = cx + 4.0 * sinT * Math.cos(phi);
      let y = cy + 2.65 * cosT;
      let z = cz + 3.1 * sinT * Math.sin(phi);

      // 更像小脑叶片（folia）的横向细纹
      const stripe =
        Math.sin(theta * 22.0 + Math.sin(phi * 2.2)) * 0.22 +
        Math.sin(phi * 6.0) * 0.05;

      const nx = (x - cx) / (4.0 * 4.0);
      const ny = (y - cy) / (2.65 * 2.65);
      const nz = (z - cz) / (3.1 * 3.1);
      const nl = Math.hypot(nx, ny, nz) || 1;

      x += nx / nl * stripe;
      y += ny / nl * stripe;
      z += nz / nl * stripe;

      pts.push({x,y,z,depth:(stripe+0.35)/0.7});
    }
  }

  const mat = new THREE.MeshLambertMaterial({
    color: regionGray.cerebellum,
    transparent: true,
    opacity: 0.93
  });

  const mesh = new THREE.InstancedMesh(geo, mat, pts.length);
  const dummy = new THREE.Object3D();
  const base = new THREE.Color(regionGray.cerebellum);
  const shadeColor = new THREE.Color();

  pts.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, shadeColor.copy(base).multiplyScalar(0.81 + p.depth * 0.16));
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.userData.region = 'cerebellum';
  mesh.userData.kind = 'cortex';
  brainRoot.add(mesh);
  cortexMeshes.push(mesh);
  createCortexAnimationProxy(
    mesh,
    pts,
    cubeSize * 1.15,
    p => 0.81 + p.depth * 0.16
  );
  window.__brainPerformance.cortexInstances += pts.length;
}

buildCerebellumLobe(-1);
buildCerebellumLobe(1);

// ---------------------------------------------------------------------
// 脑干：参考图中明显的向下延伸结构
// ---------------------------------------------------------------------
function buildBrainStem() {
  const pts = [];
  const stepY = 0.30;
  const ring = 16;

  for (let y = -7.3; y >= -15.6; y -= stepY) {
    const t = (Math.abs(y + 7.3)) / 8.3;
    const radius = 0.95 - t * 0.42 + Math.sin(t * 7.0) * 0.04;

    for (let i = 0; i < ring; i++) {
      const a = Math.PI * 2 * i / ring;
      pts.push({
        x: Math.cos(a) * radius * 0.72,
        y,
        z: -5.9 + Math.sin(a) * radius * 0.52
      });
    }
  }

  const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const mat = new THREE.MeshLambertMaterial({
    color: regionGray.brainstem,
    transparent: true,
    opacity: 0.92
  });

  const mesh = new THREE.InstancedMesh(geo, mat, pts.length);
  const dummy = new THREE.Object3D();

  pts.forEach((p,i) => {
    dummy.position.set(p.x,p.y,p.z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.region = 'brainstem';
  mesh.userData.kind = 'cortex';
  brainRoot.add(mesh);
  cortexMeshes.push(mesh);
  createCortexAnimationProxy(mesh, pts, 0.26, () => 0.92);
  window.__brainPerformance.cortexInstances += pts.length;
}

buildBrainStem();

// ---------------------------------------------------------------------
// 半透明内部：较粗体素，只表达深层结构与层次，不抢皮层视觉。
// ---------------------------------------------------------------------
function insideCore(x,y,z) {
  const left =
    Math.pow((x + 5.0)/8.8, 2) +
    Math.pow((y - 2.3)/9.2, 2) +
    Math.pow(z/8.6, 2) <= 1;

  const right =
    Math.pow((x - 5.0)/8.8, 2) +
    Math.pow((y - 2.3)/9.2, 2) +
    Math.pow(z/8.6, 2) <= 1;

  return left || right;
}

function buildCore() {
  const step = 1.30;
  const positions = [];

  for (let x=-13; x<=13; x+=step) {
    for (let y=-6; y<=11; y+=step) {
      for (let z=-10; z<=10; z+=step) {
        if (!insideCore(x,y,z)) continue;
        if (Math.abs(x) < 0.95 && y > -0.5) continue;

        // 只保留一部分点，让内部有“半透明层”而不是实心墙。
        const mask = Math.sin(x*0.83) + Math.cos(y*0.71) + Math.sin(z*0.77);
        if (mask > 1.65) continue;

        positions.push([x,y,z]);
      }
    }
  }

  const geo = new THREE.BoxGeometry(0.96,0.96,0.96);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xcfcfcf,
    roughness: 1,
    transparent: true,
    opacity: 0.11,
    depthWrite: false
  });

  const mesh = new THREE.InstancedMesh(geo, mat, positions.length);
  const dummy = new THREE.Object3D();

  positions.forEach((p,i) => {
    dummy.position.set(p[0],p[1],p[2]);
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.kind = 'core';
  brainRoot.add(mesh);
  coreMeshes.push(mesh);
}

buildCore();

// 海马体：内部较深灰的半透明双侧结构
function buildHippocampus(side) {
  const pts = [];
  const steps = 78;
  for (let i=0;i<steps;i++) {
    const t = i/(steps-1);
    const a = -1.15 + t*2.30;
    const x = side*(4.3 + Math.cos(a)*1.8);
    const y = -0.8 + Math.sin(a)*1.05;
    const z = -1.4 + Math.sin(a*1.35)*2.1;

    for (let r=0;r<7;r++) {
      const aa = Math.PI*2*r/7;
      pts.push([
        x + Math.cos(aa)*0.42,
        y + Math.sin(aa)*0.30,
        z + Math.sin(aa)*0.42
      ]);
    }
  }

  const geo = new THREE.BoxGeometry(0.28,0.28,0.28);
  const mat = new THREE.MeshStandardMaterial({
    color: regionGray.hippocampus,
    roughness: 1,
    transparent: true,
    opacity: 0.38,
    depthWrite: false
  });

  const mesh = new THREE.InstancedMesh(geo, mat, pts.length);
  const dummy = new THREE.Object3D();

  pts.forEach((p,i)=>{
    dummy.position.set(...p);
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.kind = 'core';
  mesh.userData.region = 'hippocampus';
  brainRoot.add(mesh);
  coreMeshes.push(mesh);
}

buildHippocampus(-1);
buildHippocampus(1);

// ---------------------------------------------------------------------
// V11 神经元激活模拟
// ---------------------------------------------------------------------
// 说明：这里是前端视觉层面的“神经激活传播”原型。
// 它模拟节点、连接和激活波传播，不等同于真实脑神经电生理模型。

const neuralGroup = new THREE.Group();
brainRoot.add(neuralGroup);

let neuralVisible = true;
let neuralMode = 'spontaneous';
let neuralRAF = 0;
let neuralStartTime = performance.now();
let spontaneousSeedIndex = 0;
let neuralInitialized = false;
let neuralLastFrame = 0;

const neuronPositions = [];
const neuronRegions = [];
const neuronAdj = [];
const edgePairs = [];
const activationDistance = [];
const rankedActivation = [];
let activationValues = null;
let neuronGeometry = null;
let neuronMaterial = null;
let neuronPoints = null;
let edgeGeometry = null;
let edgeMaterial = null;
let neuralEdges = null;
let activeSpheres = null;
const MAX_ACTIVE_SPHERES = quality.activeSpheres;
const neuralDummy = new THREE.Object3D();

// 神经网络叠加层使用冷蓝灰到近白的激活色，不改变底层方块脑和 Canonical 对象颜色。
const NEURAL_NODE_REST = [0.52, 0.63, 0.72];
const NEURAL_NODE_ACTIVE = [0.88, 0.95, 1.00];
const NEURAL_EDGE_REST = [0.60, 0.70, 0.78];
const NEURAL_EDGE_ACTIVE = [0.84, 0.92, 0.98];
const NEURAL_PULSE_HEX = 0xd8ebf5;

function seededRandomFactory(seed=20260823) {
  let s = seed >>> 0;
  return function() {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const neuralRand = seededRandomFactory(20260823);

function neuralRegion(x, y, z) {
  const hL =
    Math.pow((x + 4.8)/2.6, 2) +
    Math.pow((y + 1.0)/1.6, 2) +
    Math.pow((z + 1.5)/3.1, 2) <= 1;
  const hR =
    Math.pow((x - 4.8)/2.6, 2) +
    Math.pow((y + 1.0)/1.6, 2) +
    Math.pow((z + 1.5)/3.1, 2) <= 1;

  if (hL || hR) return 'hippocampus';
  if (z > 4.5 && y > -1.4) return 'prefrontal';
  if (y > 4.8 && z > -5.8) return 'parietal';
  if (z < -5.7 && y > -1.5) return 'occipital';
  if (y < 2.0 && Math.abs(x) > 3.6) return 'temporal';
  return 'deep';
}

function buildNeuralNodes() {
  const desired = quality.neuralNodes;
  let attempts = 0;

  while (neuronPositions.length < desired && attempts < desired * 40) {
    attempts++;

    const x = (neuralRand() * 2 - 1) * 12.4;
    const y = -5.8 + neuralRand() * 16.8;
    const z = (neuralRand() * 2 - 1) * 9.8;

    if (!insideCore(x, y, z)) continue;
    if (Math.abs(x) < 0.82 && y > -0.5) continue;

    // 让节点在深层更稀疏、靠近皮层内侧更丰富。
    const shellBias =
      Math.abs(x) / 12.4 +
      Math.abs(y - 2.0) / 10.5 +
      Math.abs(z) / 9.8;

    if (shellBias < 0.48 && neuralRand() < 0.36) continue;

    neuronPositions.push(new THREE.Vector3(x, y, z));
    neuronRegions.push(neuralRegion(x, y, z));
  }

  for (let i = 0; i < neuronPositions.length; i++) neuronAdj.push([]);
}

function connectNeuralNodes() {
  const n = neuronPositions.length;
  const cellSize = 4.2;
  const maxRadius2 = cellSize * cellSize;
  const nearestCount = 3;
  const seen = new Set();
  const buckets = new Map();

  const bucketCoordinate = value => Math.floor(value / cellSize);
  const bucketKey = (x, y, z) => `${x}:${y}:${z}`;

  for (let i = 0; i < n; i++) {
    const p = neuronPositions[i];
    const key = bucketKey(
      bucketCoordinate(p.x),
      bucketCoordinate(p.y),
      bucketCoordinate(p.z)
    );
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(i);
  }

  for (let i = 0; i < n; i++) {
    const candidates = [];
    const p = neuronPositions[i];
    const cx = bucketCoordinate(p.x);
    const cy = bucketCoordinate(p.y);
    const cz = bucketCoordinate(p.z);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = buckets.get(bucketKey(cx + dx, cy + dy, cz + dz));
          if (!bucket) continue;

          for (const j of bucket) {
            if (i === j) continue;
            const d2 = p.distanceToSquared(neuronPositions[j]);
            if (d2 <= maxRadius2) candidates.push([d2, j]);
          }
        }
      }
    }

    candidates.sort((a,b) => a[0] - b[0]);

    for (let k = 0; k < Math.min(nearestCount, candidates.length); k++) {
      const j = candidates[k][1];
      const a = Math.min(i,j);
      const b = Math.max(i,j);
      const key = `${a}:${b}`;
      if (seen.has(key)) continue;
      seen.add(key);

      edgePairs.push([a,b]);
      neuronAdj[a].push(b);
      neuronAdj[b].push(a);
    }
  }
}

function initializeNeuralNetwork() {
  if (neuralInitialized) return;

  buildNeuralNodes();
  connectNeuralNodes();

  // 神经网络默认隐藏，首次开启时才创建 GPU 资源。
  neuronGeometry = new THREE.BufferGeometry();
  const neuronArray = new Float32Array(neuronPositions.length * 3);
  const neuronColors = new Float32Array(neuronPositions.length * 3);

  for (let i = 0; i < neuronPositions.length; i++) {
    const p = neuronPositions[i];
    neuronArray[i*3] = p.x;
    neuronArray[i*3+1] = p.y;
    neuronArray[i*3+2] = p.z;
    neuronColors[i*3] = NEURAL_NODE_REST[0];
    neuronColors[i*3+1] = NEURAL_NODE_REST[1];
    neuronColors[i*3+2] = NEURAL_NODE_REST[2];
  }

  neuronGeometry.setAttribute('position', new THREE.BufferAttribute(neuronArray, 3));
  neuronGeometry.setAttribute('color', new THREE.BufferAttribute(neuronColors, 3));
  neuronMaterial = new THREE.PointsMaterial({
    size: 0.105,
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    sizeAttenuation: true,
    depthTest: false
  });
  neuronPoints = new THREE.Points(neuronGeometry, neuronMaterial);
  neuronPoints.renderOrder = 20;
  neuralGroup.add(neuronPoints);

  const edgePositionArray = new Float32Array(edgePairs.length * 6);
  const edgeColorArray = new Float32Array(edgePairs.length * 6);

  for (let e = 0; e < edgePairs.length; e++) {
    const [a,b] = edgePairs[e];
    const pa = neuronPositions[a];
    const pb = neuronPositions[b];
    edgePositionArray[e*6] = pa.x;
    edgePositionArray[e*6+1] = pa.y;
    edgePositionArray[e*6+2] = pa.z;
    edgePositionArray[e*6+3] = pb.x;
    edgePositionArray[e*6+4] = pb.y;
    edgePositionArray[e*6+5] = pb.z;
    for (let c=0;c<6;c++) {
      edgeColorArray[e*6+c] = c % 3 === 0 ? NEURAL_EDGE_REST[0]
        : c % 3 === 1 ? NEURAL_EDGE_REST[1]
        : NEURAL_EDGE_REST[2];
    }
  }

  edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePositionArray, 3));
  edgeGeometry.setAttribute('color', new THREE.BufferAttribute(edgeColorArray, 3));
  edgeMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.28,
    depthTest: false
  });
  neuralEdges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  neuralEdges.renderOrder = 18;
  neuralGroup.add(neuralEdges);

  if (!softwareRenderer) {
    const activeSphereGeo = new THREE.SphereGeometry(0.115, 7, 7);
    const activeSphereMat = new THREE.MeshBasicMaterial({
      color: NEURAL_PULSE_HEX,
      transparent: true,
      opacity: 0.92,
      depthTest: false
    });
    activeSpheres = new THREE.InstancedMesh(
      activeSphereGeo,
      activeSphereMat,
      MAX_ACTIVE_SPHERES
    );
    activeSpheres.count = 0;
    activeSpheres.renderOrder = 25;
    neuralGroup.add(activeSpheres);
  }

  activationValues = new Float32Array(neuronPositions.length);
  neuralInitialized = true;
  computeActivationDistance(neuralMode);
  Object.assign(window.__brainPerformance, {
    neuralInitialized: true,
    neuralNodes: neuronPositions.length,
    neuralEdges: edgePairs.length
  });
}

function sourceNodesForMode(mode) {
  const source = [];

  if (mode === 'prefrontal') {
    for (let i=0;i<neuronRegions.length;i++) {
      if (neuronRegions[i] === 'prefrontal') source.push(i);
    }
  } else if (mode === 'hippocampus') {
    for (let i=0;i<neuronRegions.length;i++) {
      if (neuronRegions[i] === 'hippocampus') source.push(i);
    }
  } else if (mode === 'global') {
    // 从脑干附近/中下部向整个脑传播
    let best = [];
    for (let i=0;i<neuronPositions.length;i++) {
      const p = neuronPositions[i];
      const score = Math.abs(p.x) + Math.abs(p.y + 4.0) + Math.abs(p.z + 4.8);
      best.push([score,i]);
    }
    best.sort((a,b)=>a[0]-b[0]);
    return best.slice(0,6).map(x=>x[1]);
  } else {
    // 自发激活：每轮从不同局部区域随机产生 2~4 个源
    const count = 3;
    for (let k=0;k<count;k++) {
      const idx = Math.floor(neuralRand() * neuronPositions.length);
      source.push(idx);
    }
  }

  if (!source.length) {
    source.push(Math.floor(neuronPositions.length * 0.5));
  }

  // 数量太多时只抽取一部分，形成局部激活中心。
  if (source.length > 18) {
    const sampled = [];
    const stride = Math.max(1, Math.floor(source.length / 18));
    for (let i=0;i<source.length && sampled.length<18;i+=stride) sampled.push(source[i]);
    return sampled;
  }

  return source;
}

function computeActivationDistance(mode) {
  if (!neuralInitialized || !neuronPositions.length) return;

  activationDistance.length = neuronPositions.length;
  activationDistance.fill(Infinity);

  const sources = sourceNodesForMode(mode);
  const queue = [];

  for (const s of sources) {
    activationDistance[s] = 0;
    queue.push(s);
  }

  let qIndex = 0;
  while (qIndex < queue.length) {
    const cur = queue[qIndex++];
    const nextD = activationDistance[cur] + 1;

    for (const nb of neuronAdj[cur]) {
      if (nextD < activationDistance[nb]) {
        activationDistance[nb] = nextD;
        queue.push(nb);
      }
    }
  }
}

function setNeuralMode(mode) {
  neuralMode = mode;
  spontaneousSeedIndex++;
  neuralStartTime = performance.now();
  if (neuralInitialized) computeActivationDistance(mode);

  const labels = {
    spontaneous: '自发脉冲',
    prefrontal: '前额叶激活',
    hippocampus: '海马体激活',
    global: '全脑传播波'
  };

  scopedDocument.getElementById('neuralStatus').textContent = `神经激活：${labels[mode]}`;

  scopedDocument.getElementById('spontaneousBtn').classList.toggle('active', mode === 'spontaneous');
  scopedDocument.getElementById('frontalPulseBtn').classList.toggle('active', mode === 'prefrontal');
  scopedDocument.getElementById('hippocampusPulseBtn').classList.toggle('active', mode === 'hippocampus');
  scopedDocument.getElementById('globalPulseBtn').classList.toggle('active', mode === 'global');

  if (neuralVisible) startNeuralAnimation();
}

function refreshBrainOcclusion() {
  // 记忆图谱开启时优先保证记忆结构可读。
  // 神经网络始终是叠加层；只有“图谱透视”控制底层大脑的遮挡。
  const memoryXray = memoryVisible && memoryXrayEnabled;
  const separatedXray = memoryXray && memoryGrouped;

  cortexMeshes.forEach(mesh => {
    if (memoryXray) {
      mesh.material.opacity = separatedXray ? 0.10 : 0.34;
      mesh.material.depthWrite = false;
    } else {
      mesh.material.opacity = 0.96;
      mesh.material.depthWrite = true;
    }
    mesh.material.needsUpdate = true;
  });

  const proxyOpacity = memoryXray
    ? (separatedXray ? 0.10 : 0.34)
    : 0.92;
  cortexAnimationPairs.forEach(({proxy}) => {
    proxy.material.opacity = proxyOpacity;
  });

  coreMeshes.forEach(mesh => {
    if (!coreVisible) return;

    if (memoryXray) {
      // 海马体稍微保留，其余大方块几乎隐藏，避免挡住中间记忆节点。
      mesh.material.opacity =
        mesh.userData.region === 'hippocampus' ? 0.055 : 0.008;
    } else {
      mesh.material.opacity =
        mesh.userData.region === 'hippocampus' ? 0.38 : 0.11;
    }

    mesh.material.depthWrite = false;
    mesh.material.needsUpdate = true;
  });
}

function applyNeuralXray(active) {
  // 保留旧调用点；神经开关本身不再改变底层大脑的透明度。
  refreshBrainOcclusion();
}

function updateNeuralFrame(now) {
  if (!neuralInitialized) return;

  const elapsed = (now - neuralStartTime) / 1000;
  const cycle = neuralMode === 'global' ? 4.8 : 3.8;
  const localT = elapsed % cycle;

  // 自发模式每轮重新随机选择激活源。
  if (neuralMode === 'spontaneous') {
    const cycleIndex = Math.floor(elapsed / cycle);
    if (cycleIndex !== spontaneousSeedIndex) {
      spontaneousSeedIndex = cycleIndex;
      computeActivationDistance('spontaneous');
    }
  }

  const nodeColorAttr = neuronGeometry.getAttribute('color');
  const edgeColorAttr = edgeGeometry.getAttribute('color');

  const activation = activationValues;
  const speed = neuralMode === 'global' ? 0.115 : 0.090;
  const width = neuralMode === 'global' ? 0.38 : 0.30;

  for (let i=0;i<activation.length;i++) {
    const hop = activationDistance[i];

    if (!Number.isFinite(hop)) {
      activation[i] = 0;
      continue;
    }

    const delay = hop * speed;
    const d = (localT - delay) / width;

    let a = Math.exp(-d*d);

    // 留少量尾迹，视觉上像神经兴奋后的残余活动
    const tailD = (localT - delay - 0.44) / 0.72;
    a = Math.max(a, Math.exp(-tailD*tailD) * 0.22);

    activation[i] = Math.min(1, a);
  }

  // 节点颜色：静息蓝灰，激活向冷白过渡。
  for (let i=0;i<activation.length;i++) {
    const a = activation[i];
    nodeColorAttr.array[i*3] = NEURAL_NODE_REST[0] + a * (NEURAL_NODE_ACTIVE[0] - NEURAL_NODE_REST[0]);
    nodeColorAttr.array[i*3+1] = NEURAL_NODE_REST[1] + a * (NEURAL_NODE_ACTIVE[1] - NEURAL_NODE_REST[1]);
    nodeColorAttr.array[i*3+2] = NEURAL_NODE_REST[2] + a * (NEURAL_NODE_ACTIVE[2] - NEURAL_NODE_REST[2]);
  }
  nodeColorAttr.needsUpdate = true;

  // 连接线随两端神经元活动向冷白提亮。
  for (let e=0;e<edgePairs.length;e++) {
    const [a,b] = edgePairs[e];
    const act = Math.max(activation[a], activation[b]) * 0.92 +
                Math.min(activation[a], activation[b]) * 0.08;
    const r = NEURAL_EDGE_REST[0] + act * (NEURAL_EDGE_ACTIVE[0] - NEURAL_EDGE_REST[0]);
    const g = NEURAL_EDGE_REST[1] + act * (NEURAL_EDGE_ACTIVE[1] - NEURAL_EDGE_REST[1]);
    const blue = NEURAL_EDGE_REST[2] + act * (NEURAL_EDGE_ACTIVE[2] - NEURAL_EDGE_REST[2]);

    edgeColorAttr.array[e*6] = r;
    edgeColorAttr.array[e*6+1] = g;
    edgeColorAttr.array[e*6+2] = blue;
    edgeColorAttr.array[e*6+3] = r;
    edgeColorAttr.array[e*6+4] = g;
    edgeColorAttr.array[e*6+5] = blue;
  }
  edgeColorAttr.needsUpdate = true;

  if (activeSpheres) {
    // 原生 GPU 上用小球强化最强节点；软件渲染器保留轻量点色传播。
    rankedActivation.length = 0;
    for (let i=0;i<activation.length;i++) {
      if (activation[i] > 0.48) rankedActivation.push([activation[i],i]);
    }
    rankedActivation.sort((a,b)=>b[0]-a[0]);

    const count = Math.min(MAX_ACTIVE_SPHERES, rankedActivation.length);
    activeSpheres.count = count;

    for (let k=0;k<count;k++) {
      const [a,i] = rankedActivation[k];
      const p = neuronPositions[i];
      const s = 0.72 + a * 1.65;

      neuralDummy.position.copy(p);
      neuralDummy.scale.setScalar(s);
      neuralDummy.updateMatrix();
      activeSpheres.setMatrixAt(k, neuralDummy.matrix);
    }
    activeSpheres.instanceMatrix.needsUpdate = true;
  }
}

function neuralAnimationLoop(now) {
  if (!neuralVisible) {
    neuralRAF = 0;
    return;
  }

  neuralRAF = requestAnimationFrame(neuralAnimationLoop);
  if (globalDocument.hidden || now - neuralLastFrame < animationFrameInterval) return;
  neuralLastFrame = now;
  updateNeuralFrame(now);
  render();
}

function startNeuralAnimation() {
  if (!neuralVisible) return;
  if (neuralRAF) return;
  neuralLastFrame = 0;
  neuralRAF = requestAnimationFrame(neuralAnimationLoop);
}

function stopNeuralAnimation() {
  if (neuralRAF) {
    cancelAnimationFrame(neuralRAF);
    neuralRAF = 0;
  }
}

function updateNeuralVisible(show) {
  neuralVisible = show;
  neuralGroup.visible = show;

  const btn = scopedDocument.getElementById('toggleNeuralBtn');
  btn.textContent = show ? '神经网络开' : '神经网络关';
  btn.classList.toggle('active', show);

  applyNeuralXray(show);

  if (show) {
    initializeNeuralNetwork();
    setLightweightAnimation('neural', true);
    neuralStartTime = performance.now();
    computeActivationDistance(neuralMode);
    startNeuralAnimation();
  } else {
    stopNeuralAnimation();
    setLightweightAnimation('neural', false);
    render();
  }
}

// ---------------------------------------------------------------------
// Canonical L3 激活知识图
// ---------------------------------------------------------------------
// 事件、实体、事实、关系、属性、模式、规则和派生事实共享一个权威图。
// 对象类型只决定几何编码，不构成独立知识层；当前画面是可重建的激活子图。
// Document / Section / Chunk / DocumentVector 位于图外证据通道，通过 EvidenceLink 回源。

const memoryRoot = new THREE.Group();
brainRoot.add(memoryRoot);

const memoryKindEvent = new THREE.Group();
const memoryKindFact = new THREE.Group();
const memoryKindSchema = new THREE.Group();
const memoryLinkEventFact = new THREE.Group();
const memoryLinkFactSchema = new THREE.Group();
const memoryShellGroup = new THREE.Group();

memoryRoot.add(memoryShellGroup);
memoryRoot.add(memoryLinkEventFact);
memoryRoot.add(memoryLinkFactSchema);
memoryRoot.add(memoryKindEvent);
memoryRoot.add(memoryKindFact);
memoryRoot.add(memoryKindSchema);

let memoryVisible = true;
let memoryXrayEnabled = true;
let memoryGrouped = false;
let eventKindVisible = true;
let factKindVisible = true;
let schemaKindVisible = true;
let selectedMemoryMesh = null;
let selectedMemoryData = null;
let memoryRAF = 0;
let memoryPulseMode = null;
let memoryPulseStart = 0;
let memoryLastFrame = 0;
let canonicalSnapshot = null;
let canonicalSnapshotSource = 'demo';
let canonicalSnapshotCursor = null;
let canonicalSnapshotLoading = false;

const memoryClickable = [];
const memoryNodeById = new Map();
const memoryLinkMeshes = [];
const memoryIndexLinks = [];
const memoryLayoutScratch = new THREE.Vector3();

// -----------------------------
// 演示数据
// -----------------------------
let canonicalEvents = [
  {
    id:'EVT-001', kind:'event', title:'统一为 Canonical L3',
    summary:'删除独立知识层级，把可推理对象并入唯一权威图。',
    content:'事件、实体、关系、属性、模式、规则和派生事实统一进入 Canonical L3；对象类型保留，但不再拥有彼此割裂的存储层级。',
    source:'架构决策记录', time:'2026-08-25',
    related:['ENT-CANONICAL-L3','FACT-SINGLE-AUTHORITY','RULE-GRAPH-AUTHORITY']
  },
  {
    id:'EVT-002', kind:'event', title:'确认独立证据通道',
    summary:'DocumentVector 与 BM25 继续保存事实证据和文本定位能力。',
    content:'Document、Section、Chunk、DocumentVector 和 BM25 不并入图节点层级；它们通过 EvidenceLink 为图中断言和证明提供可核验原文。',
    source:'项目文档与代码核对', time:'2026-08-25',
    related:['ENT-DOCUMENT-VECTOR','FACT-EVIDENCE-SEPARATE','RULE-EVIDENCE-GROUNDED']
  },
  {
    id:'EVT-003', kind:'event', title:'评估千万级图规模',
    summary:'完整图不能在单次查询或浏览器画面中整体加载。',
    content:'当节点达到千万级时，查询先通过结构过滤、向量候选和重排序形成有限激活子图，再在逻辑完整图范围内扩展必要证明路径。',
    source:'规模风险讨论', time:'2026-08-25',
    related:['FACT-LOGICAL-SCOPE','FACT-ACTIVATED-BOUNDED','RULE-ACTIVATION-BOUND']
  },
  {
    id:'EVT-004', kind:'event', title:'建立迁移恢复点',
    summary:'在 schema 迁移前创建 Git 标签和项目外完整备份。',
    content:'迁移必须保留稳定节点 ID、关系 ID、EvidenceLink subject ID 与 chunk ID，并先在状态副本上验证完整性。',
    source:'迁移执行记录', time:'2026-08-24',
    related:['FACT-STABLE-MIGRATION','ENT-CANONICAL-L3','RULE-GRAPH-AUTHORITY']
  },
  {
    id:'EVT-005', kind:'event', title:'定义完整图推理边界',
    summary:'完整图是逻辑可达范围，不是每次查询的物理加载范围。',
    content:'推理器可以按规则和关系继续扩展尚未加载的节点，直到命中目标、预算或停止条件；返回结果同时携带最小证明路径。',
    source:'推理架构讨论', time:'2026-08-25',
    related:['FACT-LOGICAL-SCOPE','ENT-CANONICAL-RULE','RULE-INFERENCE-PROOF']
  },
  {
    id:'EVT-006', kind:'event', title:'引入激活子图',
    summary:'运行时只保留当前问题相关的候选节点、关系和证明路径。',
    content:'Activated Subgraph、ANN、Reranker 与 Cache 都是可重建运行时派生能力，不是新的知识层，也不拥有权威事实。',
    source:'查询执行设计', time:'2026-08-25',
    related:['FACT-ACTIVATED-BOUNDED','FACT-ANN-RERANK','RULE-ACTIVATION-BOUND']
  },
  {
    id:'EVT-007', kind:'event', title:'向量化图对象',
    summary:'实体、关系、属性和规则可生成向量，用于召回与重排序。',
    content:'向量索引保存 Canonical ID 与版本指针；向量是检索投影，不替代图中的关系约束、规则语义或证据链。',
    source:'检索架构讨论', time:'2026-08-25',
    related:['ENT-GRAPH-VECTOR-INDEX','FACT-ANN-RERANK','RULE-ACTIVATION-BOUND']
  },
  {
    id:'EVT-008', kind:'event', title:'保留事实证据回源',
    summary:'任何回答和派生事实都应能定位到支持它的文档片段。',
    content:'图关系负责表达知识结构，EvidenceLink 负责连接具体 Chunk；规则证明不能把向量相似度伪装成事实证据。',
    source:'证据模型讨论', time:'2026-08-25',
    related:['FACT-EVIDENCE-SEPARATE','FACT-PROVENANCE','RULE-EVIDENCE-GROUNDED']
  },
  {
    id:'EVT-009', kind:'event', title:'规则并入权威图',
    summary:'规则、模式和派生事实与实体关系共享版本化治理。',
    content:'规则节点描述匹配前提与结论，派生事实记录规则版本、输入事实、证据来源和生成时间，支持审计与失效重算。',
    source:'Canonical L3 模型设计', time:'2026-08-25',
    related:['ENT-CANONICAL-RULE','FACT-SINGLE-AUTHORITY','RULE-INFERENCE-PROOF']
  },
  {
    id:'EVT-010', kind:'event', title:'三维视图改为默认融合',
    summary:'不同对象在同一图空间混合分布，灰阶和形状只编码类型。',
    content:'默认画面展示一个 Canonical L3 激活子图边界；对象分组只是临时观察模式，不能被理解为独立知识层。',
    source:'前端可视化决策', time:'2026-08-25',
    related:['FACT-VISUAL-FUSION','ENT-CANONICAL-L3','RULE-VISUAL-ENCODING']
  },
  {
    id:'EVT-011', kind:'event', title:'限定黑白灰视觉语言',
    summary:'所有节点、关系、状态和激活强度只使用灰阶。',
    content:'石墨黑微点表示事件，中灰线框表示实体与事实，浅灰多面体表示模式与规则；激活通过明暗、尺寸和线宽表达。',
    source:'界面约束', time:'2026-08-25',
    related:['FACT-VISUAL-FUSION','RULE-VISUAL-ENCODING']
  },
  {
    id:'EVT-012', kind:'event', title:'限制浏览器渲染预算',
    summary:'3D 页面只渲染可交互的有限节点集合。',
    content:'后端分页快照、LOD、批量几何和按需关系展开共同控制渲染成本；完整图规模不直接决定当前帧节点数。',
    source:'前端性能优化', time:'2026-08-25',
    related:['FACT-ACTIVATED-BOUNDED','FACT-ANN-RERANK','RULE-ACTIVATION-BOUND']
  }
];

let canonicalFacts = [
  {
    id:'ENT-CANONICAL-L3', kind:'entity', title:'Canonical L3',
    summary:'唯一权威、版本化、可审计的完整知识图。',
    content:'承载 TBox、ABox、事件、实体、关系、属性、规则和派生事实；所有对象使用稳定 ID，并接受统一完整性约束。',
    source:'Canonical 数据模型', time:'schema 5',
    related:['EVT-001','EVT-004','EVT-010','FACT-SINGLE-AUTHORITY','RULE-GRAPH-AUTHORITY']
  },
  {
    id:'ENT-DOCUMENT-VECTOR', kind:'entity', title:'DocumentVector / BM25',
    summary:'面向原文片段的向量和词法证据索引。',
    content:'保存文档级与 Chunk 级检索投影，命中后返回原文定位；它不承担权威图关系或完整图推理。',
    source:'独立证据通道', time:'持续更新',
    related:['EVT-002','FACT-EVIDENCE-SEPARATE','FACT-PROVENANCE','RULE-EVIDENCE-GROUNDED']
  },
  {
    id:'ENT-GRAPH-VECTOR-INDEX', kind:'entity', title:'图对象向量索引',
    summary:'Canonical 节点、关系、属性和规则的可重建检索投影。',
    content:'索引项指向 Canonical ID 和 ontology_version；ANN 只负责候选召回，最终结果还要经过结构约束、重排序和证明校验。',
    source:'运行时派生索引', time:'可重建',
    related:['EVT-007','FACT-ANN-RERANK','RULE-ACTIVATION-BOUND']
  },
  {
    id:'ENT-CANONICAL-RULE', kind:'entity', title:'Canonical Rule',
    summary:'包含前提、约束、结论和版本信息的图内规则对象。',
    content:'规则匹配产生派生事实时记录输入节点、关系、证据与规则版本，从而允许解释、撤销和重新计算。',
    source:'Canonical L3 规则模型', time:'版本化',
    related:['EVT-005','EVT-009','RULE-INFERENCE-PROOF']
  },
  {
    id:'FACT-SINGLE-AUTHORITY', kind:'fact', title:'权威事实只有一个归属',
    summary:'知识真值只由 Canonical L3 治理。',
    content:'缓存、向量索引和激活子图可以丢弃后重建，不能反向覆盖 Canonical L3 中的事实和规则。',
    source:'架构约束', time:'有效',
    related:['EVT-001','EVT-009','ENT-CANONICAL-L3','RULE-GRAPH-AUTHORITY']
  },
  {
    id:'FACT-EVIDENCE-SEPARATE', kind:'fact', title:'证据检索与图推理解耦',
    summary:'图回答“关系是什么”，文档通道回答“原文在哪里”。',
    content:'两条通道在查询规划阶段协同，在 EvidenceLink 和证明结果处汇合；任一通道都不能冒充另一通道。',
    source:'证据架构约束', time:'有效',
    related:['EVT-002','EVT-008','ENT-DOCUMENT-VECTOR','RULE-EVIDENCE-GROUNDED']
  },
  {
    id:'FACT-LOGICAL-SCOPE', kind:'fact', title:'完整图是逻辑推理范围',
    summary:'推理可按需访问完整图，但无需一次装入内存。',
    content:'关系扩展由查询目标、规则前提、时间范围、权限与成本预算约束；逻辑完整性和物理执行规模是两个概念。',
    source:'推理执行约束', time:'有效',
    related:['EVT-003','EVT-005','RULE-INFERENCE-PROOF']
  },
  {
    id:'FACT-ACTIVATED-BOUNDED', kind:'fact', title:'激活子图必须有界',
    summary:'单次查询和单帧可视化只使用有限候选集合。',
    content:'候选数量、扩展跳数、证明深度、超时和渲染节点数都必须设置预算，并在需要时继续分页扩展。',
    source:'运行时预算', time:'每次查询',
    related:['EVT-003','EVT-006','EVT-012','RULE-ACTIVATION-BOUND']
  },
  {
    id:'FACT-ANN-RERANK', kind:'fact', title:'ANN 召回后必须重排序',
    summary:'向量相似度只负责缩小候选，不直接等于事实相关性。',
    content:'Reranker 综合语义相似、关系路径、规则可满足性、时间与证据质量，产生可解释的激活优先级。',
    source:'检索执行策略', time:'每次查询',
    related:['EVT-006','EVT-007','EVT-012','ENT-GRAPH-VECTOR-INDEX','RULE-ACTIVATION-BOUND']
  },
  {
    id:'FACT-PROVENANCE', kind:'fact', title:'证明必须携带来源',
    summary:'结论可回溯到 Document、Chunk、输入事实和规则版本。',
    content:'直接事实引用 EvidenceLink；派生事实还要保存最小证明路径，避免只返回不可验证的图结论。',
    source:'审计约束', time:'有效',
    related:['EVT-008','ENT-DOCUMENT-VECTOR','RULE-EVIDENCE-GROUNDED','RULE-INFERENCE-PROOF']
  },
  {
    id:'FACT-STABLE-MIGRATION', kind:'fact', title:'迁移保持稳定标识',
    summary:'schema 变化不改写既有对象和证据引用的身份。',
    content:'迁移验证比较所有稳定 ID 集合、对象数量、EvidenceLink subject/chunk 指针与完整性结果，再允许替换正式状态。',
    source:'迁移安全约束', time:'schema 4 → 5',
    related:['EVT-004','ENT-CANONICAL-L3','RULE-GRAPH-AUTHORITY']
  },
  {
    id:'FACT-VISUAL-FUSION', kind:'fact', title:'对象类型不是知识层级',
    summary:'事件、事实与规则在同一个 Canonical L3 空间共同显示。',
    content:'灰阶、几何形状和筛选开关用于辨认对象类型；对象分组仅改变观察布局，不改变图结构、ID 或推理语义。',
    source:'可视化语义约束', time:'V13.0',
    related:['EVT-010','EVT-011','RULE-VISUAL-ENCODING']
  }
];

let canonicalSchemas = [
  {
    id:'RULE-GRAPH-AUTHORITY', kind:'rule', title:'权威图写入规则',
    summary:'任何知识写入必须落到 Canonical ID、版本和证据约束。',
    content:'若候选对象通过去重、类型约束和证据校验，则写入或更新 Canonical 节点/关系；运行时索引随后异步重建。',
    source:'Canonical 规则集', time:'ontology_version 5',
    related:['EVT-001','EVT-004','FACT-SINGLE-AUTHORITY','FACT-STABLE-MIGRATION']
  },
  {
    id:'RULE-EVIDENCE-GROUNDED', kind:'rule', title:'证据落地规则',
    summary:'可外部核验的结论必须至少绑定一条有效 EvidenceLink。',
    content:'当结论来自文档事实时，证明必须返回 Document、Chunk 与定位信息；无来源的相似候选只能作为假设，不能升级为已证事实。',
    source:'Canonical 规则集', time:'ontology_version 5',
    related:['EVT-002','EVT-008','FACT-EVIDENCE-SEPARATE','FACT-PROVENANCE']
  },
  {
    id:'RULE-ACTIVATION-BOUND', kind:'rule', title:'激活预算规则',
    summary:'候选召回、关系扩展与页面渲染都受明确预算约束。',
    content:'达到节点、跳数、证明深度或耗时上限时暂停扩展并返回 continuation；已加载集合仍保持可解释和可分页。',
    source:'查询规划规则', time:'运行时',
    related:['EVT-003','EVT-006','EVT-007','EVT-012','FACT-ACTIVATED-BOUNDED','FACT-ANN-RERANK']
  },
  {
    id:'RULE-INFERENCE-PROOF', kind:'rule', title:'完整图证明规则',
    summary:'推理结论必须附带可复算的最小证明路径。',
    content:'规则引擎按需从激活子图向 Canonical L3 扩展，记录每个前提、关系和规则版本；无可满足证明时不输出确定性结论。',
    source:'推理规则集', time:'版本化',
    related:['EVT-005','EVT-009','FACT-LOGICAL-SCOPE','FACT-PROVENANCE','ENT-CANONICAL-RULE']
  },
  {
    id:'RULE-VISUAL-ENCODING', kind:'pattern', title:'Canonical 视图编码模式',
    summary:'一个图边界、三种对象形状、全程黑白灰。',
    content:'事件使用石墨黑微点，实体与事实使用中灰线框几何，模式与规则使用浅灰多面体；明暗和尺寸只表示激活强度。',
    source:'V13.0 前端模式', time:'版本化',
    related:['EVT-010','EVT-011','FACT-VISUAL-FUSION']
  }
];

// -----------------------------
// Canonical L3 单图空间布局
// -----------------------------
const memoryCenter = new THREE.Vector3(0, 0.45, -1.15);
memoryRoot.position.copy(memoryCenter);

const memoryKindStyle = {
  event: {
    color: 0x242424,
    shellOpacity: 0.58,
    nodeOpacity: 0.92,
    label: new THREE.Vector3(-7.2, 7.6, 3.4)
  },
  fact: {
    color: 0x707070,
    shellOpacity: 0.52,
    nodeOpacity: 0.94,
    label: new THREE.Vector3(0, 7.9, 3.4)
  },
  schema: {
    color: 0xb8b8b8,
    shellOpacity: 0.14,
    nodeOpacity: 0.88,
    label: new THREE.Vector3(7.2, 7.6, 3.4)
  }
};

const memoryKindLayout = {
  fused: {
    event: {
      offset: new THREE.Vector3(0, 0, 0),
      radii: new THREE.Vector3(8.25, 6.15, 5.45),
      shellScale: new THREE.Vector3(8.75, 6.60, 5.90),
      label: new THREE.Vector3(0, 7.35, 3.35)
    },
    fact: {
      offset: new THREE.Vector3(0, 0, 0),
      radii: new THREE.Vector3(8.25, 6.15, 5.45),
      shellScale: new THREE.Vector3(8.75, 6.60, 5.90)
    },
    schema: {
      offset: new THREE.Vector3(0, 0, 0),
      radii: new THREE.Vector3(8.25, 6.15, 5.45),
      shellScale: new THREE.Vector3(8.75, 6.60, 5.90)
    }
  },
  grouped: {
    event: {
      offset: new THREE.Vector3(-7.0, 0.25, 0.4),
      radii: new THREE.Vector3(3.9, 6.55, 3.55),
      shellScale: new THREE.Vector3(4.35, 6.95, 3.85)
    },
    fact: {
      offset: new THREE.Vector3(0, 0.20, 0.8),
      radii: new THREE.Vector3(3.85, 5.55, 3.50),
      shellScale: new THREE.Vector3(4.35, 5.95, 3.85)
    },
    schema: {
      offset: new THREE.Vector3(7.0, 0.25, 1.2),
      radii: new THREE.Vector3(3.45, 4.65, 3.20),
      shellScale: new THREE.Vector3(3.95, 5.05, 3.55)
    }
  }
};

const memoryKindLabelText = {
  event: { full: '事件对象 · 石墨微点', compact: '事件' },
  fact: { full: '实体 / 事实 · 中灰线框', compact: '实体 / 事实' },
  schema: { full: '模式 / 规则 · 浅灰多面体', compact: '模式 / 规则' }
};

// 窄屏分组观察时收窄三列横向占用，避免两侧对象被正面视角裁出屏幕。
const memoryKindLayoutCompact = {
  grouped: {
    event: {
      offset: new THREE.Vector3(-1.65, 0.18, 0.40),
      radii: new THREE.Vector3(1.35, 5.35, 2.80),
      shellScale: new THREE.Vector3(1.70, 5.70, 3.10),
      label: new THREE.Vector3(-1.10, 7.25, 3.30)
    },
    fact: {
      offset: new THREE.Vector3(0, 0.16, 0.62),
      radii: new THREE.Vector3(1.30, 4.75, 2.65),
      shellScale: new THREE.Vector3(1.65, 5.10, 2.95),
      label: new THREE.Vector3(0, 7.55, 3.30)
    },
    schema: {
      offset: new THREE.Vector3(1.65, 0.18, 0.86),
      radii: new THREE.Vector3(1.25, 4.20, 2.45),
      shellScale: new THREE.Vector3(1.60, 4.60, 2.80),
      label: new THREE.Vector3(1.10, 7.25, 3.30)
    }
  }
};

function makeMemoryShell(layer) {
  const shell = new THREE.Group();
  shell.userData.memoryKind = layer;

  if (layer === 'event') {
    const positions = [];
    const count = 210;
    for (let i = 0; i < count; i++) {
      const point = ellipsoidPoint(i, count, new THREE.Vector3(1, 1, 1), 0.35);
      positions.push(point.x, point.y, point.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: memoryKindStyle.event.color,
      size: 0.11,
      transparent: true,
      opacity: memoryKindStyle.event.shellOpacity,
      sizeAttenuation: true,
      depthTest: false,
      depthWrite: false
    });
    const points = new THREE.Points(geometry, material);
    points.renderOrder = 7;
    shell.add(points);
  } else if (layer === 'fact') {
    const geometry = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1, 1));
    const material = new THREE.LineDashedMaterial({
      color: memoryKindStyle.fact.color,
      dashSize: 0.08,
      gapSize: 0.055,
      transparent: true,
      opacity: memoryKindStyle.fact.shellOpacity,
      depthTest: false,
      depthWrite: false
    });
    const scaffold = new THREE.LineSegments(geometry, material);
    scaffold.computeLineDistances();
    scaffold.renderOrder = 8;
    shell.add(scaffold);
  } else {
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const fill = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: memoryKindStyle.schema.color,
      transparent: true,
      opacity: memoryKindStyle.schema.shellOpacity,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    }));
    fill.renderOrder = 7;
    shell.add(fill);

    const outline = new THREE.LineSegments(
      new THREE.WireframeGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: 0x555555,
        transparent: true,
        opacity: 0.32,
        depthTest: false,
        depthWrite: false
      })
    );
    outline.renderOrder = 8;
    shell.add(outline);
  }

  memoryShellGroup.add(shell);
  return shell;
}

const canonicalShell = makeMemoryShell('event');
const factGuide = makeMemoryShell('fact');
const schemaGuide = makeMemoryShell('schema');

function syncMemoryGuides() {
  canonicalShell.visible = memoryVisible && (!memoryGrouped || eventKindVisible);
  factGuide.visible = memoryVisible && memoryGrouped && factKindVisible;
  schemaGuide.visible = memoryVisible && memoryGrouped && schemaKindVisible;

  const boundaryMaterial = canonicalShell.children[0]?.material;
  if (boundaryMaterial) {
    boundaryMaterial.color.setHex(memoryGrouped
      ? memoryKindStyle.event.color
      : 0x8a8a8a);
    boundaryMaterial.opacity = memoryGrouped
      ? memoryKindStyle.event.shellOpacity
      : 0.22;
  }
}

// -----------------------------
// 节点布局
// -----------------------------
function ellipsoidPoint(index, count, radii, phase=0) {
  // Fibonacci sphere，映射到椭球表面，避免规则经纬线堆叠。
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (index / Math.max(1, count - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y*y));
  const theta = golden * index + phase;

  return new THREE.Vector3(
    Math.cos(theta) * r * radii.x,
    y * radii.y,
    Math.sin(theta) * r * radii.z
  );
}

function stableUnit(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 4294967295;
}

function canonicalVolumePoint(nodeId, radii) {
  const longitude = stableUnit(nodeId + ':longitude') * Math.PI * 2;
  const z = stableUnit(nodeId + ':latitude') * 2 - 1;
  const plane = Math.sqrt(Math.max(0, 1 - z * z));
  const radius = 0.30 + Math.cbrt(stableUnit(nodeId + ':radius')) * 0.68;

  return new THREE.Vector3(
    Math.cos(longitude) * plane * radii.x * radius,
    z * radii.y * radius,
    Math.sin(longitude) * plane * radii.z * radius
  );
}

function groupedVolumePoint(index, count, radii, phase=0) {
  const point = ellipsoidPoint(index, count, radii, phase);
  const radius = 0.48 + (((index + 1) * 0.61803398875 + phase) % 1) * 0.48;
  return point.multiplyScalar(radius);
}

function activeMemoryLayout() {
  if (!memoryGrouped) return memoryKindLayout.fused;
  return viewport.clientWidth <= 900
    ? memoryKindLayoutCompact.grouped
    : memoryKindLayout.grouped;
}

function memoryNodePoint(layer, index, count, phase=0, nodeId='') {
  const layout = activeMemoryLayout()[layer];
  const point = memoryGrouped
    ? groupedVolumePoint(index, count, layout.radii, phase)
    : canonicalVolumePoint(nodeId, layout.radii);
  return point.add(layout.offset);
}

function makeNodeMesh(data, layer, index, count) {
  let geo;
  let material;
  let radii;
  let phase = 0;

  if (layer === 'event') {
    // 语义事件改成“神经元式微节点”：
    // 事件数量未来可能非常大，因此必须轻、小、密，而不是占空间的大立方体。
    geo = new THREE.SphereGeometry(0.145, 7, 7);
    material = new THREE.MeshBasicMaterial({
      color: memoryKindStyle.event.color,
      transparent: true,
      opacity: memoryKindStyle.event.nodeOpacity,
      depthTest: false,
      depthWrite: false
    });
    phase = 0.2;
  } else if (layer === 'fact') {
    geo = new THREE.OctahedronGeometry(0.46,0);
    material = new THREE.MeshBasicMaterial({
      color: memoryKindStyle.fact.color,
      wireframe: true,
      transparent: true,
      opacity: memoryKindStyle.fact.nodeOpacity,
      depthTest: false,
      depthWrite: false
    });
    phase = 1.1;
  } else {
    geo = new THREE.IcosahedronGeometry(0.58,0);
    material = new THREE.MeshBasicMaterial({
      color: memoryKindStyle.schema.color,
      transparent: true,
      opacity: memoryKindStyle.schema.nodeOpacity,
      depthTest: false,
      depthWrite: false
    });
    radii = new THREE.Vector3(3.18,2.38,2.70);
    phase = 2.0;
  }

  const mesh = new THREE.Mesh(geo, material);
  if (layer === 'schema') {
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({
        color: 0x555555,
        transparent: true,
        opacity: 0.72,
        depthTest: false,
        depthWrite: false
      })
    );
    outline.renderOrder = 37;
    mesh.add(outline);
  }
  mesh.position.copy(memoryNodePoint(layer, index, count, phase, data.id));
  mesh.renderOrder =
    layer === 'event' ? 32 :
    layer === 'fact' ? 34 : 36;
  mesh.userData.memoryData = data;
  mesh.userData.memoryKind = layer;
  mesh.userData.layoutIndex = index;
  mesh.userData.layoutCount = count;
  mesh.userData.layoutPhase = phase;
  mesh.userData.baseScale = 1;
  mesh.userData.baseOpacity = material.opacity;
  mesh.userData.baseColor = memoryKindStyle[layer].color;

  data._position = mesh.position.clone();

  memoryClickable.push(mesh);
  memoryNodeById.set(data.id, mesh);

  if (layer === 'event') memoryKindEvent.add(mesh);
  if (layer === 'fact') memoryKindFact.add(mesh);
  if (layer === 'schema') memoryKindSchema.add(mesh);

  return mesh;
}

canonicalEvents.forEach((d,i)=>makeNodeMesh(d,'event',i,canonicalEvents.length));
canonicalFacts.forEach((d,i)=>makeNodeMesh(d,'fact',i,canonicalFacts.length));
canonicalSchemas.forEach((d,i)=>makeNodeMesh(d,'schema',i,canonicalSchemas.length));

function updateMemoryKindLabels() {
  const layout = activeMemoryLayout();
  const compact = memoryGrouped && viewport.clientWidth <= 900;
  const labels = {
    event: scopedDocument.getElementById('memoryKindEventLabel'),
    fact: scopedDocument.getElementById('memoryKindFactLabel'),
    schema: scopedDocument.getElementById('memoryKindSchemaLabel')
  };

  Object.entries(labels).forEach(([layer, element]) => {
    element.textContent = memoryGrouped
      ? memoryKindLabelText[layer][compact ? 'compact' : 'full']
      : (layer === 'event' ? 'Canonical L3 · 当前激活子图' : '');
    const anchor = layout[layer].label ||
      layout[layer].offset.clone().add(new THREE.Vector3(0, layout[layer].radii.y + 1.0, 3.2));
    memoryKindLabelWorld[layer].copy(memoryCenter).add(anchor)
      .multiplyScalar(1.24).add(brainRoot.position);
    element.dataset.layout = memoryGrouped ? 'grouped' : 'fused';
  });
}

function updateMemoryShellLayout() {
  const layout = activeMemoryLayout();
  [
    ['event', canonicalShell],
    ['fact', factGuide],
    ['schema', schemaGuide]
  ].forEach(([layer, shell]) => {
    shell.position.copy(layout[layer].offset);
    shell.scale.copy(layout[layer].shellScale);
  });
  syncMemoryGuides();
}

function updateMemoryLineGeometry(line) {
  const from = memoryNodeById.get(line.userData.fromId);
  const to = memoryNodeById.get(line.userData.toId);
  if (!from || !to) return;

  const position = line.geometry.getAttribute('position');
  position.setXYZ(0, from.position.x, from.position.y, from.position.z);
  position.setXYZ(1, to.position.x, to.position.y, to.position.z);
  position.needsUpdate = true;
  line.geometry.computeBoundingSphere();
  if (line.material.isLineDashedMaterial) line.computeLineDistances();
}

function updateMemoryLinkGeometry() {
  memoryLinkMeshes.forEach(updateMemoryLineGeometry);

  memoryIndexLinks.forEach(line => {
    const target = memoryNodeById.get(line.userData.targetId);
    if (!target) return;
    const position = line.geometry.getAttribute('position');
    position.setXYZ(1, target.position.x, target.position.y, target.position.z);
    position.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  });

  if (typeof chainGuideGroup !== 'undefined') {
    chainGuideGroup.children.forEach(updateMemoryLineGeometry);
  }
}

function updateMemoryLayout() {
  memoryClickable.forEach(mesh => {
    mesh.position.copy(memoryNodePoint(
      mesh.userData.memoryKind,
      mesh.userData.layoutIndex,
      mesh.userData.layoutCount,
      mesh.userData.layoutPhase,
      mesh.userData.memoryData.id
    ));
    mesh.userData.basePosition = mesh.position.clone();
  });

  updateMemoryShellLayout();
  updateMemoryLinkGeometry();
  updateMemoryKindLabels();
}

// -----------------------------
// Canonical L3 对象间关系线
// -----------------------------
function addMemoryLink(fromId, toId, kind) {
  const a = memoryNodeById.get(fromId);
  const b = memoryNodeById.get(toId);
  if (!a || !b) return;

  const geo = new THREE.BufferGeometry().setFromPoints([
    a.position.clone(),
    b.position.clone()
  ]);

  const baseOpacity = kind === 'event-fact' ? 0.16 :
    kind === 'fact-schema' ? 0.28 : 0.22;
  const materialOptions = {
    color: kind === 'event-fact'
      ? memoryKindStyle.event.color
      : memoryKindStyle.fact.color,
    transparent: true,
    opacity: baseOpacity,
    depthTest: false
  };
  const mat = kind === 'event-fact'
    ? new THREE.LineDashedMaterial({
        ...materialOptions,
        dashSize: 0.22,
        gapSize: 0.16
      })
    : new THREE.LineBasicMaterial(materialOptions);

  const line = new THREE.Line(geo,mat);
  line.renderOrder = 10;
  line.userData.fromId = fromId;
  line.userData.toId = toId;
  line.userData.kind = kind;
  line.userData.baseOpacity = baseOpacity;
  if (mat.isLineDashedMaterial) line.computeLineDistances();

  if (kind === 'event-fact') memoryLinkEventFact.add(line);
  else memoryLinkFactSchema.add(line);

  memoryLinkMeshes.push(line);
}

// 查询锚点 / 事件 -> 相关实体与事实
canonicalEvents.forEach(event => {
  event.related
    .filter(id => id.startsWith('ENT-') || id.startsWith('FACT-'))
    .slice(0,2)
    .forEach(id => addMemoryLink(event.id,id,'event-fact'));
});

// 实体与事实 -> 可满足的模式与规则
canonicalFacts.forEach(node => {
  node.related
    .filter(id => id.startsWith('RULE-'))
    .slice(0,2)
    .forEach(id => addMemoryLink(node.id,id,'fact-schema'));
});

// -----------------------------
// 海马体 -> 事件对象的视觉索引线；仅用于脑内叙事，不表示存储层级。
// -----------------------------
const hippocampusIndexGroup = new THREE.Group();
memoryRoot.add(hippocampusIndexGroup);

[
  new THREE.Vector3(-4.7,-1.0,-1.5).sub(memoryCenter),
  new THREE.Vector3(4.7,-1.0,-1.5).sub(memoryCenter)
].forEach((hip, sideIndex) => {
  canonicalEvents.forEach((event,i) => {
    if ((i % 2) !== sideIndex) return;
    const target = memoryNodeById.get(event.id);
    if (!target) return;

    const geo = new THREE.BufferGeometry().setFromPoints([
      hip,
      target.position.clone()
    ]);
    const mat = new THREE.LineBasicMaterial({
      color:0x000000,
      transparent:true,
      opacity:0.014,
      depthTest:false
    });
    const l = new THREE.Line(geo,mat);
    l.renderOrder = 9;
    l.userData.targetId = event.id;
    hippocampusIndexGroup.add(l);
    memoryIndexLinks.push(l);
  });
});

function clearThreeGroup(group) {
  while (group.children.length) {
    const object = group.children.pop();
    object.traverse?.((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose?.());
      }
    });
  }
}

function rebuildCanonicalScene() {
  [memoryKindEvent, memoryKindFact, memoryKindSchema,
    memoryLinkEventFact, memoryLinkFactSchema, hippocampusIndexGroup]
    .forEach(clearThreeGroup);
  memoryClickable.length = 0;
  memoryNodeById.clear();
  memoryLinkMeshes.length = 0;
  memoryIndexLinks.length = 0;
  clearChainGuide();
  selectedMemoryMesh = null;
  selectedMemoryData = null;

  canonicalEvents.forEach((data, index) =>
    makeNodeMesh(data, 'event', index, canonicalEvents.length));
  canonicalFacts.forEach((data, index) =>
    makeNodeMesh(data, 'fact', index, canonicalFacts.length));
  canonicalSchemas.forEach((data, index) =>
    makeNodeMesh(data, 'schema', index, canonicalSchemas.length));

  if (canonicalSnapshot?.relations?.length) {
    canonicalSnapshot.relations.forEach((relation) => {
      const from = memoryNodeById.get(relation.source_node_id);
      const to = memoryNodeById.get(relation.target_node_id);
      if (!from || !to) return;
      const fromKind = from.userData.memoryKind;
      const toKind = to.userData.memoryKind;
      const kind = fromKind === 'event' && toKind === 'fact'
        ? 'event-fact'
        : fromKind === 'fact' && toKind === 'schema'
          ? 'fact-schema'
          : 'canonical';
      addMemoryLink(relation.source_node_id, relation.target_node_id, kind);
    });
  } else {
    canonicalEvents.forEach((event) => {
      event.related
        .filter((id) => id.startsWith('ENT-') || id.startsWith('FACT-'))
        .slice(0, 2)
        .forEach((id) => addMemoryLink(event.id, id, 'event-fact'));
    });
    canonicalFacts.forEach((node) => {
      node.related
        .filter((id) => id.startsWith('RULE-'))
        .slice(0, 2)
        .forEach((id) => addMemoryLink(node.id, id, 'fact-schema'));
    });
  }

  [
    new THREE.Vector3(-4.7, -1.0, -1.5).sub(memoryCenter),
    new THREE.Vector3(4.7, -1.0, -1.5).sub(memoryCenter),
  ].forEach((hip, sideIndex) => {
    canonicalEvents.forEach((event, index) => {
      if ((index % 2) !== sideIndex) return;
      const target = memoryNodeById.get(event.id);
      if (!target) return;
      const geometry = new THREE.BufferGeometry().setFromPoints([
        hip,
        target.position.clone(),
      ]);
      const material = new THREE.LineBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.014,
        depthTest: false,
      });
      const line = new THREE.Line(geometry, material);
      line.renderOrder = 9;
      line.userData.targetId = event.id;
      hippocampusIndexGroup.add(line);
      memoryIndexLinks.push(line);
    });
  });
  updateMemoryLayout();
  syncMemoryKindLabelVisibility();
  refreshBrainOcclusion();
}

// -----------------------------
// 详情面板
// -----------------------------
const memoryPanel = scopedDocument.getElementById('memoryPanel');

function setPanelText(id, value) {
  const el = scopedDocument.getElementById(id);
  el.textContent = value ?? '—';
}

function openMemoryPanel(data, mesh) {
  selectedMemoryData = data;
  setSelectedMemoryMesh(mesh);

  const objectGroupNames = {
    event:'Canonical L3 · 事件对象',
    fact:'Canonical L3 · 实体 / 事实',
    schema:'Canonical L3 · 模式 / 规则'
  };
  const nodeKindNames = {
    event:'事件',
    entity:'实体',
    fact:'事实',
    rule:'规则',
    pattern:'模式'
  };

  const layer = mesh.userData.memoryKind;
  memoryPanel.dataset.layer = layer;

  setPanelText('memoryPanelKicker', objectGroupNames[layer] || 'CANONICAL NODE');
  setPanelText('memoryPanelTitle', data.title);
  setPanelText('memoryPanelId', data.id + ' / ' + (nodeKindNames[data.kind] || objectGroupNames[layer] || layer));
  setPanelText('memoryPanelSummary', data.summary);
  setPanelText('memoryPanelContent', data.content);
  setPanelText('memoryPanelSource', `${data.source || '—'}\n${data.time || ''}`);
  setPanelText('memoryPanelRelations', (data.related || []).join('  ·  ') || '—');

  memoryPanel.classList.remove('hidden');
  highlightMemoryRelations(data.id);
  render();
}

function closeMemoryPanel() {
  memoryPanel.classList.add('hidden');
  memoryPanel.dataset.layer = '';
  selectedMemoryData = null;
  setSelectedMemoryMesh(null);
  resetMemoryLinkHighlight();
  render();
}

function memorySelectedScale(mesh) {
  if (!mesh) return 1;
  const layer = mesh.userData.memoryKind;
  if (layer === 'event') return 2.15;
  if (layer === 'fact') return 1.55;
  return 1.40;
}

function setSelectedMemoryMesh(mesh) {
  if (selectedMemoryMesh && selectedMemoryMesh !== mesh) {
    selectedMemoryMesh.scale.setScalar(1);
  }

  selectedMemoryMesh = mesh;

  if (selectedMemoryMesh) {
    selectedMemoryMesh.scale.setScalar(memorySelectedScale(selectedMemoryMesh));
  }
}

function resetMemoryLinkHighlight() {
  memoryLinkMeshes.forEach(line => {
    line.material.opacity = line.userData.baseOpacity;
  });

  memoryClickable.forEach(mesh => {
    if (mesh !== selectedMemoryMesh) mesh.scale.setScalar(1);
  });
}

function highlightMemoryRelations(id) {
  memoryLinkMeshes.forEach(line => {
    const connected = line.userData.fromId === id || line.userData.toId === id;
    line.material.opacity = connected ? 0.74 : 0.025;

    if (connected) {
      const otherId = line.userData.fromId === id ? line.userData.toId : line.userData.fromId;
      const other = memoryNodeById.get(otherId);
      if (other && other !== selectedMemoryMesh) {
        const otherLayer = other.userData.memoryKind;
        other.scale.setScalar(otherLayer === 'event' ? 1.55 : 1.22);
      }
    }
  });
}

scopedDocument.getElementById('memoryPanelClose').addEventListener('click', closeMemoryPanel);

scopedDocument.getElementById('focusMemoryNodeBtn').addEventListener('click', () => {
  if (!selectedMemoryMesh) return;

  const world = new THREE.Vector3();
  selectedMemoryMesh.getWorldPosition(world);

  controls.target.copy(world);
  camera.position.copy(
    world.clone().add(new THREE.Vector3(0,3.4,15.5))
  );
  controls.update();
  render();
});

scopedDocument.getElementById('traceMemoryNodeBtn').addEventListener('click', () => {
  if (!selectedMemoryData) return;
  highlightMemoryRelations(selectedMemoryData.id);
  setMemoryStatus(`正在追踪：${selectedMemoryData.title}`);
  render();
});

// -----------------------------
// 点击检测
// -----------------------------
const memoryRaycaster = new THREE.Raycaster();
const memoryPointer = new THREE.Vector2();
let pointerDownXY = null;

renderer.domElement.addEventListener('pointerdown', (ev) => {
  pointerDownXY = {x:ev.clientX,y:ev.clientY};
});

renderer.domElement.addEventListener('pointerup', (ev) => {
  if (!pointerDownXY || !memoryVisible) return;

  const dx = ev.clientX - pointerDownXY.x;
  const dy = ev.clientY - pointerDownXY.y;
  pointerDownXY = null;

  if (Math.hypot(dx,dy) > 5) return;

  const rect = renderer.domElement.getBoundingClientRect();
  memoryPointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  memoryPointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

  memoryRaycaster.setFromCamera(memoryPointer,camera);

  const visibleNodes = memoryClickable.filter(m => m.visible && m.parent && m.parent.visible);
  const hits = memoryRaycaster.intersectObjects(visibleNodes,false);

  if (hits.length) {
    openMemoryPanel(hits[0].object.userData.memoryData,hits[0].object);
  }
});

// -----------------------------
// Canonical L3 视图与对象类型开关
// -----------------------------
function setMemoryStatus(text) {
  scopedDocument.getElementById('memoryStatus').textContent = 'Canonical L3：' + text;
}

function memoryIdleStatus() {
  const layout = memoryGrouped ? '对象分组观察' : '全图融合';
  const source = canonicalSnapshot
    ? `真实快照 ${canonicalSnapshot.snapshot_version} · `
    : '';
  return source + '完整图 · ' + layout + (memoryXrayEnabled ? ' · 透视' : '');
}

function syncMemoryKindLabelVisibility() {
  const eventLabel = scopedDocument.getElementById('memoryKindEventLabel');
  const factLabel = scopedDocument.getElementById('memoryKindFactLabel');
  const schemaLabel = scopedDocument.getElementById('memoryKindSchemaLabel');

  eventLabel.classList.toggle('hidden', !memoryVisible || (memoryGrouped && !eventKindVisible));
  factLabel.classList.toggle('hidden', !memoryVisible || !memoryGrouped || !factKindVisible);
  schemaLabel.classList.toggle('hidden', !memoryVisible || !memoryGrouped || !schemaKindVisible);
}

function updateMemoryVisibility(show) {
  memoryVisible = show;
  memoryRoot.visible = show;
  memoryShellGroup.visible = show;

  const btn = scopedDocument.getElementById('toggleMemoryBtn');
  btn.textContent = show ? 'Canonical 图开' : 'Canonical 图关';
  btn.classList.toggle('active',show);

  syncMemoryGuides();
  syncMemoryKindLabelVisibility();

  if (!show) closeMemoryPanel();

  refreshBrainOcclusion();
  setMemoryStatus(show ? memoryIdleStatus() : '关闭');
  render();
}

function updateMemoryXray(show) {
  memoryXrayEnabled = show;

  const btn = scopedDocument.getElementById('memoryXrayBtn');
  btn.textContent = show ? '图谱透视开' : '图谱透视关';
  btn.classList.toggle('active',show);

  refreshBrainOcclusion();
  setMemoryStatus(memoryVisible ? memoryIdleStatus() : '关闭');
  render();
}

function updateObjectGrouping(show) {
  memoryGrouped = show;

  const btn = scopedDocument.getElementById('toggleObjectGroupingBtn');
  btn.textContent = show ? '对象分组开' : '对象分组';
  btn.classList.toggle('active', show);
  btn.setAttribute('aria-pressed', String(show));

  memoryShellGroup.visible = memoryVisible;
  updateMemoryLayout();
  syncMemoryKindLabelVisibility();
  refreshBrainOcclusion();
  setMemoryStatus(memoryIdleStatus());
  render();
}

function updateEventKind(show) {
  eventKindVisible = show;
  memoryKindEvent.visible = show;
  hippocampusIndexGroup.visible = show;
  memoryLinkEventFact.visible = show && factKindVisible;

  const btn = scopedDocument.getElementById('toggleEventKindBtn');
  btn.classList.toggle('active',show);
  btn.setAttribute('aria-pressed', String(show));

  syncMemoryGuides();
  syncMemoryKindLabelVisibility();
  render();
}

function updateFactKind(show) {
  factKindVisible = show;
  memoryKindFact.visible = show;
  memoryLinkEventFact.visible = show && eventKindVisible;
  memoryLinkFactSchema.visible = show && schemaKindVisible;

  const btn = scopedDocument.getElementById('toggleFactKindBtn');
  btn.classList.toggle('active',show);
  btn.setAttribute('aria-pressed', String(show));

  syncMemoryGuides();
  syncMemoryKindLabelVisibility();
  render();
}

function updateSchemaKind(show) {
  schemaKindVisible = show;
  memoryKindSchema.visible = show;
  memoryLinkFactSchema.visible = show && factKindVisible;

  const btn = scopedDocument.getElementById('toggleSchemaKindBtn');
  btn.classList.toggle('active',show);
  btn.setAttribute('aria-pressed', String(show));

  syncMemoryGuides();
  syncMemoryKindLabelVisibility();
  render();
}

// -----------------------------
// Canonical 写入 / 激活检索动画
// -----------------------------
function setNodePulse(layer, amount) {
  const group =
    layer === 'event' ? memoryKindEvent :
    layer === 'fact' ? memoryKindFact :
    memoryKindSchema;

  group.children.forEach((mesh,i) => {
    const local = Math.max(0, Math.min(1, amount - (i % 5) * 0.055));
    const layer = mesh.userData.memoryKind;
    const pulseGain = layer === 'event' ? 0.48 : (layer === 'fact' ? 0.62 : 0.70);
    const pulse = 1 + local * pulseGain;
    const selectedScale = memorySelectedScale(mesh);
    mesh.scale.setScalar(mesh === selectedMemoryMesh ? Math.max(selectedScale,pulse) : pulse);

    if (mesh.material) {
      const baseOpacity = mesh.userData.baseOpacity || 0.8;
      mesh.material.opacity = Math.min(1, baseOpacity + local * 0.20);
    }
  });
}

function resetMemoryPulseVisuals() {
  memoryClickable.forEach(mesh => {
    mesh.scale.setScalar(mesh === selectedMemoryMesh ? memorySelectedScale(mesh) : 1);
    if (mesh.material) {
      mesh.material.opacity = mesh.userData.baseOpacity || mesh.material.opacity;
    }
  });

  if (selectedMemoryData) highlightMemoryRelations(selectedMemoryData.id);
  else resetMemoryLinkHighlight();
}

function memoryPulseFrame(now) {
  if (!memoryPulseMode) {
    memoryRAF = 0;
    setLightweightAnimation('memory', false);
    return;
  }

  if (globalDocument.hidden || now - memoryLastFrame < animationFrameInterval) {
    memoryRAF = requestAnimationFrame(memoryPulseFrame);
    return;
  }
  memoryLastFrame = now;

  const elapsed = (now - memoryPulseStart) / 1000;
  const duration = 4.8;
  const t = elapsed / duration;

  if (t >= 1) {
    memoryPulseMode = null;
    memoryRAF = 0;
    resetMemoryPulseVisuals();
    setMemoryStatus(memoryIdleStatus());
    setLightweightAnimation('memory', false);
    render();
    return;
  }

  const easePulse = (x) => {
    if (x <= 0 || x >= 1) return 0;
    return Math.sin(Math.PI * x);
  };

  let eventT, factT, schemaT;

  if (memoryPulseMode === 'consolidate') {
    eventT = easePulse((t - 0.02) / 0.34);
    factT = easePulse((t - 0.28) / 0.36);
    schemaT = easePulse((t - 0.58) / 0.38);
    setMemoryStatus('写入：事件候选 → 实体 / 事实归一 → 规则校验');
  } else {
    eventT = easePulse((t - 0.02) / 0.34);
    factT = easePulse((t - 0.28) / 0.36);
    schemaT = easePulse((t - 0.58) / 0.38);
    setMemoryStatus('检索：查询锚点 → 候选重排序 → 规则与证明扩展');
  }

  setNodePulse('event',eventT);
  setNodePulse('fact',factT);
  setNodePulse('schema',schemaT);

  // 连线随传播阶段加深
  memoryLinkMeshes.forEach(line => {
    let act = 0;
    if (line.userData.kind === 'event-fact') act = Math.max(eventT,factT);
    else act = Math.max(factT,schemaT);

    line.material.opacity = line.userData.baseOpacity + act * 0.58;
  });

  render();
  memoryRAF = requestAnimationFrame(memoryPulseFrame);
}

function startMemoryPulse(mode) {
  if (!memoryVisible) updateMemoryVisibility(true);

  memoryPulseMode = mode;
  memoryPulseStart = performance.now();
  memoryLastFrame = 0;
  setLightweightAnimation('memory', true);

  if (memoryRAF) cancelAnimationFrame(memoryRAF);
  memoryRAF = requestAnimationFrame(memoryPulseFrame);
}

// ---------------------------------------------------------------------
// Canonical L3 查询锚点 → 事实约束 → 规则证明 → 文档证据
// ---------------------------------------------------------------------
let memoryExampleChains = [
  {
    event:'EVT-001',
    fact:'FACT-SINGLE-AUTHORITY',
    schema:'RULE-GRAPH-AUTHORITY',
    evidence:'架构决策记录 / Document → Section → Chunk'
  },
  {
    event:'EVT-002',
    fact:'FACT-EVIDENCE-SEPARATE',
    schema:'RULE-EVIDENCE-GROUNDED',
    evidence:'项目文档与代码核对 / EvidenceLink → Chunk'
  },
  {
    event:'EVT-003',
    fact:'FACT-ACTIVATED-BOUNDED',
    schema:'RULE-ACTIVATION-BOUND',
    evidence:'规模风险讨论 / 查询预算记录 → Chunk'
  },
  {
    event:'EVT-005',
    fact:'FACT-LOGICAL-SCOPE',
    schema:'RULE-INFERENCE-PROOF',
    evidence:'推理架构讨论 / 规则版本 + 输入事实 + Chunk'
  },
  {
    event:'EVT-010',
    fact:'FACT-VISUAL-FUSION',
    schema:'RULE-VISUAL-ENCODING',
    evidence:'前端可视化决策 / 需求记录 → Chunk'
  }
];

let memoryExampleIndex = 0;
let memoryExampleActive = false;

const chainGuideGroup = new THREE.Group();
memoryRoot.add(chainGuideGroup);

function clearChainGuide() {
  while (chainGuideGroup.children.length) {
    const obj = chainGuideGroup.children.pop();
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  }
}

function chainLine(a,b,opacity=0.95,fromId='',toId='') {
  const geo = new THREE.BufferGeometry().setFromPoints([a,b]);
  const mat = new THREE.LineBasicMaterial({
    color:0x000000,
    transparent:true,
    opacity,
    depthTest:false
  });
  const l = new THREE.Line(geo,mat);
  l.renderOrder = 40;
  l.userData.fromId = fromId;
  l.userData.toId = toId;
  chainGuideGroup.add(l);
  return l;
}

function setChainCard(eventData,factData,schemaData,evidence) {
  scopedDocument.getElementById('chainEventText').textContent =
    `${eventData.title}（${eventData.id}）`;
  scopedDocument.getElementById('chainFactText').textContent =
    `${factData.title}（${factData.id}）`;
  scopedDocument.getElementById('chainSchemaText').textContent =
    `${schemaData.title}（${schemaData.id}）`;
  scopedDocument.getElementById('chainEvidenceText').textContent = evidence || 'Document / Chunk 证据待加载';
}

function resetExampleNodeStyles() {
  memoryClickable.forEach(mesh => {
    mesh.scale.setScalar(mesh === selectedMemoryMesh ? memorySelectedScale(mesh) : 1);

    const layer = mesh.userData.memoryKind;
    mesh.material.opacity = memoryKindStyle[layer].nodeOpacity;
    mesh.material.color.setHex(memoryKindStyle[layer].color);
  });

  memoryLinkMeshes.forEach(line => {
    line.material.opacity = line.userData.baseOpacity;
  });
}

function highlightMemoryExample(index=0, focusCamera=false) {
  if (!memoryExampleChains.length) {
    memoryExampleActive = false;
    setMemoryStatus(canonicalSnapshot
      ? `真实快照 ${canonicalSnapshot.snapshot_version} · 当前页没有可组合的三类证明节点`
      : '暂无证明路径');
    render();
    return;
  }
  if (!memoryVisible) updateMemoryVisibility(true);
  updateEventKind(true);
  updateFactKind(true);
  updateSchemaKind(true);

  memoryExampleIndex = ((index % memoryExampleChains.length) + memoryExampleChains.length) % memoryExampleChains.length;
  memoryExampleActive = true;

  const chain = memoryExampleChains[memoryExampleIndex];
  const eventMesh = memoryNodeById.get(chain.event);
  const factMesh = memoryNodeById.get(chain.fact);
  const schemaMesh = memoryNodeById.get(chain.schema);

  if (!eventMesh || !factMesh || !schemaMesh) return;

  const eventData = eventMesh.userData.memoryData;
  const factData = factMesh.userData.memoryData;
  const schemaData = schemaMesh.userData.memoryData;

  setChainCard(eventData,factData,schemaData,chain.evidence);
  resetExampleNodeStyles();
  clearChainGuide();

  const selectedIds = new Set([chain.event,chain.fact,chain.schema]);

  // 其他节点整体淡化，突出当前有限证明路径。
  memoryClickable.forEach(mesh => {
    const id = mesh.userData.memoryData.id;
    const layer = mesh.userData.memoryKind;

    if (selectedIds.has(id)) {
      if (layer === 'event') mesh.scale.setScalar(2.65);
      if (layer === 'fact') mesh.scale.setScalar(1.95);
      if (layer === 'schema') mesh.scale.setScalar(1.70);
      mesh.material.opacity = 1;
    } else {
      mesh.scale.setScalar(0.88);
      mesh.material.opacity = memoryKindStyle[layer].nodeOpacity * 0.28;
    }
  });

  memoryLinkMeshes.forEach(line => {
    const a = line.userData.fromId;
    const b = line.userData.toId;

    const eventFact =
      (a === chain.event && b === chain.fact) ||
      (a === chain.fact && b === chain.event);

    const factRule =
      (a === chain.fact && b === chain.schema) ||
      (a === chain.schema && b === chain.fact);

    line.material.opacity = (eventFact || factRule) ? 0.95 : 0.015;
  });

  // 即使演示数据没有物理直连，也补画当前证明路径的两段图内连接。
  chainLine(eventMesh.position,factMesh.position,0.98,chain.event,chain.fact);
  chainLine(factMesh.position,schemaMesh.position,0.98,chain.fact,chain.schema);

  setMemoryStatus(
    `证明 ${memoryExampleIndex+1}/${memoryExampleChains.length}：查询锚点 → 事实约束 → 规则证明 → 文档证据`
  );

  if (focusCamera) {
    const groupCenter = eventMesh.position.clone()
      .add(factMesh.position)
      .add(schemaMesh.position)
      .multiplyScalar(1/3);

    const worldCenter = groupCenter.clone()
      .add(memoryRoot.position)
      .multiplyScalar(1.24)
      .add(brainRoot.position);

    controls.target.copy(worldCenter);
    camera.position.copy(worldCenter.clone().add(new THREE.Vector3(0,2.4,19)));
    controls.update();
  }

  render();
}

function clearMemoryExample() {
  memoryExampleActive = false;
  resetExampleNodeStyles();
  clearChainGuide();
  scopedDocument.getElementById('chainEventText').textContent = '—';
  scopedDocument.getElementById('chainFactText').textContent = '—';
  scopedDocument.getElementById('chainSchemaText').textContent = '—';
  scopedDocument.getElementById('chainEvidenceText').textContent = '—';
  setMemoryStatus(memoryIdleStatus());
  render();
}

function snapshotVisualLayer(nodeKind) {
  const kind = String(nodeKind || 'event').toLowerCase();
  if (['entity', 'fact', 'attribute', 'property'].includes(kind)) return 'fact';
  if (['rule', 'pattern', 'schema'].includes(kind)) return 'schema';
  return 'event';
}

function snapshotVisualNode(node, snapshot, related) {
  const statement = String(node.statement || '').trim();
  const title = statement
    ? statement.split(/[。！？.!?]/)[0].trim().slice(0, 96)
    : node.id;
  const evidence = (node.evidence_links || []).map((item) => item.link || item);
  const firstEvidence = evidence[0];
  const source = firstEvidence
    ? `EvidenceLink · ${firstEvidence.source_locator || firstEvidence.chunk_id || 'Chunk'}`
    : `${node.document_id || 'Canonical L3'} / ${node.section_id || 'snapshot'}`;
  return {
    id: node.id,
    kind: snapshotVisualLayer(node.node_kind),
    title: title || node.id,
    summary: `${node.node_kind || 'event'} · ${node.semantic_type || 'canonical'} · depth ${node.depth ?? 0}`,
    content: statement || `${node.id}（${node.node_kind || 'event'}）`,
    source,
    time: `snapshot ${snapshot.snapshot_version}`,
    related,
    score: node.score,
    confidence: node.confidence,
    status: node.status,
    evidence,
  };
}

function setSnapshotChainCard(snapshot) {
  const nodes = snapshot.nodes || [];
  const anchorId = snapshot.anchor_node_id || nodes[0]?.id;
  const anchor = nodes.find((node) => node.id === anchorId) || nodes[0];
  const evidenceStep = (snapshot.proof || []).find((step) => step.kind === 'evidence');
  scopedDocument.getElementById('chainEventText').textContent = anchor
    ? `${snapshotVisualNode(anchor, snapshot, []).title}（${anchor.id}）`
    : '—';
  scopedDocument.getElementById('chainFactText').textContent =
    nodes.some((node) => snapshotVisualLayer(node.node_kind) === 'fact')
      ? '实体 / 事实候选已在真实快照中返回'
      : '当前快照未返回实体 / 事实节点';
  scopedDocument.getElementById('chainSchemaText').textContent =
    (snapshot.rules || []).length || nodes.some((node) => snapshotVisualLayer(node.node_kind) === 'schema')
      ? '模式 / 规则候选已在真实快照中返回'
      : '当前快照未返回模式 / 规则节点';
  scopedDocument.getElementById('chainEvidenceText').textContent = evidenceStep
    ? `${evidenceStep.source_locator || evidenceStep.chunk_id || 'EvidenceLink'} · ${String(evidenceStep.quote || '').slice(0, 120)}`
    : `${snapshot.evidence?.length || 0} 条 EvidenceLink · Document / Section / Chunk`;
}

function mergeCanonicalSnapshots(previous, next) {
  if (!previous || previous.snapshot_version !== next.snapshot_version) return next;
  const mergeById = (left = [], right = []) => {
    const merged = new Map(left.map((item) => [item.id, item]));
    right.forEach((item) => merged.set(item.id, item));
    return [...merged.values()];
  };
  const mergeEvidence = (left = [], right = []) => {
    const key = (item) => `${item.subject_type}:${item.subject_id}:${item.link?.id || item.id || ''}`;
    const merged = new Map(left.map((item) => [key(item), item]));
    right.forEach((item) => merged.set(key(item), item));
    return [...merged.values()];
  };
  return {
    ...next,
    nodes: mergeById(previous.nodes, next.nodes),
    relations: mergeById(previous.relations, next.relations),
    attributes: mergeById(previous.attributes, next.attributes),
    rules: mergeById(previous.rules, next.rules),
    proof: next.proof?.length ? next.proof : previous.proof,
    evidence: mergeEvidence(previous.evidence, next.evidence),
  };
}

function applyCanonicalSnapshot(snapshot) {
  if (!snapshot || !snapshot.read_only || !Array.isArray(snapshot.nodes)) {
    throw new Error('真实快照契约无效');
  }
  if (!snapshot.nodes.length) {
    throw new Error('真实快照为空');
  }

  const relationMap = new Map();
  (snapshot.relations || []).forEach((relation) => {
    [relation.source_node_id, relation.target_node_id].forEach((id) => {
      if (!id) return;
      if (!relationMap.has(id)) relationMap.set(id, []);
      const other = id === relation.source_node_id
        ? relation.target_node_id
        : relation.source_node_id;
      if (other && !relationMap.get(id).includes(other)) relationMap.get(id).push(other);
    });
  });

  canonicalSnapshot = snapshot;
  canonicalSnapshotSource = 'api';
  canonicalSnapshotCursor = snapshot.continuation?.next_cursor || null;
  window.__canonicalSnapshot = snapshot;
  window.__canonicalSnapshotSource = canonicalSnapshotSource;
  const loadMoreButton = scopedDocument.getElementById('memoryLoadMoreBtn');
  loadMoreButton.classList.toggle('hidden', !canonicalSnapshotCursor);
  loadMoreButton.disabled = false;
  canonicalEvents = [];
  canonicalFacts = [];
  canonicalSchemas = [];
  snapshot.nodes.forEach((node) => {
    const visual = snapshotVisualNode(node, snapshot, relationMap.get(node.id) || []);
    if (visual.kind === 'fact') canonicalFacts.push(visual);
    else if (visual.kind === 'schema') canonicalSchemas.push(visual);
    else canonicalEvents.push(visual);
  });

  // Attributes and rules are first-class Canonical objects even when a node
  // page has no direct visual node for them yet.
  (snapshot.attributes || []).forEach((attribute) => {
    if (memoryNodeById.has(attribute.id)) return;
    canonicalFacts.push({
      id: attribute.id,
      kind: 'fact',
      title: attribute.attribute_type || attribute.id,
      summary: 'Canonical attribute fact',
      content: JSON.stringify(attribute.value ?? null),
      source: `Canonical Attribute · ${attribute.id}`,
      time: `snapshot ${snapshot.snapshot_version}`,
      related: [attribute.node_id].filter(Boolean),
    });
  });
  (snapshot.rules || []).forEach((rule) => {
    if (memoryNodeById.has(rule.id)) return;
    canonicalSchemas.push({
      id: rule.id,
      kind: 'schema',
      title: rule.name || rule.id,
      summary: 'Canonical rule',
      content: rule.description || rule.name || rule.id,
      source: `Canonical Rule · ${rule.id}`,
      time: `ontology_version ${rule.ontology_version}`,
      related: [],
    });
  });

  rebuildCanonicalScene();
  memoryExampleChains = [];
  const event = canonicalEvents[0];
  const fact = canonicalFacts[0];
  const schema = canonicalSchemas[0];
  if (event && fact && schema) {
    memoryExampleChains.push({
      event: event.id,
      fact: fact.id,
      schema: schema.id,
      evidence: `${snapshot.evidence?.length || 0} 条 EvidenceLink · ${snapshot.snapshot_version}`,
    });
    highlightMemoryExample(0, false);
  } else {
    memoryExampleActive = false;
    setSnapshotChainCard(snapshot);
  }
  setMemoryStatus(`真实快照 ${snapshot.snapshot_version} · ${snapshot.nodes.length} 节点 / ${(snapshot.relations || []).length} 关系`);
  render();
}

async function loadCanonicalSnapshot(cursor = null) {
  canonicalSnapshotLoading = true;
  const loadMoreButton = scopedDocument.getElementById('memoryLoadMoreBtn');
  loadMoreButton.disabled = true;
  setMemoryStatus(cursor ? '真实快照续载中 · 保留当前页面' : '真实快照加载中 · 保留本地演示');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('/api/graph/snapshot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'Canonical L3 认知记忆',
        node_limit: 12,
        relation_limit: 48,
        proof_limit: 12,
        max_hops: 2,
        use_embedding: false,
        ...(cursor ? { cursor } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`snapshot HTTP ${response.status}`);
    const next = await response.json();
    applyCanonicalSnapshot(mergeCanonicalSnapshots(cursor ? canonicalSnapshot : null, next));
  } catch (error) {
    canonicalSnapshotSource = 'demo';
    window.__canonicalSnapshotSource = canonicalSnapshotSource;
    setMemoryStatus(`真实快照不可用 · 保留本地演示（${String(error.message || error).slice(0, 80)}）`);
    render();
  } finally {
    window.clearTimeout(timeout);
    canonicalSnapshotLoading = false;
    loadMoreButton.disabled = false;
  }
}

// ---------------------------------------------------------------------
// 标签引导线
// ---------------------------------------------------------------------
const leaderGroup = new THREE.Group();
scene.add(leaderGroup);

const anchorPoints = {
  prefrontal: new THREE.Vector3(10.2, 7.6, 9.8).multiplyScalar(1.24).add(brainRoot.position),
  parietal: new THREE.Vector3(4.0, 12.4, 0.6).multiplyScalar(1.24).add(brainRoot.position),
  temporal: new THREE.Vector3(10.7, -0.2, 2.8).multiplyScalar(1.24).add(brainRoot.position),
  occipital: new THREE.Vector3(5.4, 5.9, -10.8).multiplyScalar(1.24).add(brainRoot.position),
  cerebellum: new THREE.Vector3(4.8, -6.6, -7.6).multiplyScalar(1.24).add(brainRoot.position),
  brainstem: new THREE.Vector3(0, -12.9, -5.9).multiplyScalar(1.24).add(brainRoot.position),
  hippocampus: new THREE.Vector3(4.7, -1.0, -1.5).multiplyScalar(1.24).add(brainRoot.position)
};

const labelWorld = {
  tagPrefrontal: new THREE.Vector3(17, 15, 15),
  tagParietal: new THREE.Vector3(3, 20, 7),
  tagTemporal: new THREE.Vector3(19, 2, 11),
  tagOccipital: new THREE.Vector3(12, 12, -17),
  tagCerebellum: new THREE.Vector3(12, -7, -16),
  tagBrainstem: new THREE.Vector3(2, -18, -11),
  tagHippocampus: new THREE.Vector3(12, -4, 5)
};

const projectedLabelPoint = new THREE.Vector3();
const memoryKindLabelWorld = {
  event: memoryCenter.clone().add(new THREE.Vector3(9.0, 5.8, 4.8)).multiplyScalar(1.24).add(brainRoot.position),
  fact: memoryCenter.clone().add(new THREE.Vector3(6.2, 3.8, 3.2)).multiplyScalar(1.24).add(brainRoot.position),
  schema: memoryCenter.clone().add(new THREE.Vector3(3.4, 2.0, 1.6)).multiplyScalar(1.24).add(brainRoot.position)
};

function dashed(a,b) {
  const geo = new THREE.BufferGeometry().setFromPoints([a,b]);
  const mat = new THREE.LineDashedMaterial({
    color:0x000000,
    dashSize:0.42,
    gapSize:0.28,
    transparent:true,
    opacity:0.28
  });
  const l = new THREE.Line(geo,mat);
  l.computeLineDistances();
  leaderGroup.add(l);
}

dashed(labelWorld.tagPrefrontal, anchorPoints.prefrontal);
dashed(labelWorld.tagParietal, anchorPoints.parietal);
dashed(labelWorld.tagTemporal, anchorPoints.temporal);
dashed(labelWorld.tagOccipital, anchorPoints.occipital);
dashed(labelWorld.tagCerebellum, anchorPoints.cerebellum);
dashed(labelWorld.tagBrainstem, anchorPoints.brainstem);
dashed(labelWorld.tagHippocampus, anchorPoints.hippocampus);

// ---------------------------------------------------------------------
// 状态切换
// ---------------------------------------------------------------------
function updateRegionMode(show) {
  regionsVisible = show;
  const btn = scopedDocument.getElementById('toggleRegionsBtn');
  btn.textContent = show ? '分区开' : '分区关';
  btn.classList.toggle('active', show);

  cortexMeshes.forEach(mesh => {
    const region = mesh.userData.region || 'parietal';
    if (show) {
      mesh.material.color.setHex(regionGray[region] || 0xd5d5d5);
    } else {
      mesh.material.color.setHex(0xd7d7d7);
    }
  });

  cortexAnimationPairs.forEach(({proxy}) => {
    const region = proxy.userData.region || 'parietal';
    proxy.material.color.setHex(show ? (regionGray[region] || 0xd5d5d5) : 0xd7d7d7);
  });

  render();
}

function updateCore(show) {
  coreVisible = show;
  const btn = scopedDocument.getElementById('toggleCoreBtn');
  btn.textContent = show ? '内部开' : '内部关';
  btn.classList.toggle('active', show);
  coreMeshes.forEach(m => m.visible = show);
  refreshBrainOcclusion();
  render();
}

function updateGrid(show) {
  gridVisible = show;
  const btn = scopedDocument.getElementById('toggleGridBtn');
  btn.textContent = show ? '网格开' : '网格关';
  btn.classList.toggle('active', show);
  grid.visible = show;
  render();
}

function updateLabels(show) {
  labelsVisible = show;
  const btn = scopedDocument.getElementById('toggleLabelsBtn');
  btn.textContent = show ? '标签开' : '标签关';
  btn.classList.toggle('active', show);

  [
    'tagPrefrontal','tagParietal','tagTemporal','tagOccipital',
    'tagCerebellum','tagBrainstem','tagHippocampus'
  ].forEach(id => scopedDocument.getElementById(id).classList.toggle('hidden', !show));

  leaderGroup.visible = show;
  render();
}

// ---------------------------------------------------------------------
// 标签投影
// ---------------------------------------------------------------------
const axisLabels = {
  axisX: new THREE.Vector3(AXIS_LEN+0.6,0,0),
  axisY: new THREE.Vector3(0,AXIS_LEN+0.6,0),
  axisZ: new THREE.Vector3(0,0,AXIS_LEN+0.6)
};

function place(el, point) {
  const p = projectedLabelPoint.copy(point).project(camera);
  const visible = p.z > -1 && p.z < 1;

  if (!visible) {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'block';
  const rawX = (p.x*.5+.5) * viewport.clientWidth;
  const rawY = (-p.y*.5+.5) * viewport.clientHeight;
  placeAtScreenPoint(el, rawX, rawY);
}

function placeAtScreenPoint(el, rawX, rawY) {
  // 投影点可能落在视口外，尤其是在窄屏旋转时；把标签限制在可读区域。
  const margin = 6;
  const halfWidth = Math.max(0, el.offsetWidth / 2);
  const halfHeight = Math.max(0, el.offsetHeight / 2);
  const x = Math.max(margin + halfWidth,
    Math.min(viewport.clientWidth - margin - halfWidth, rawX));
  const y = Math.max(margin + halfHeight,
    Math.min(viewport.clientHeight - margin - halfHeight, rawY));
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function placeMemoryKindLabels() {
  const entries = [
    ['event', memoryGrouped ? eventKindVisible : true, scopedDocument.getElementById('memoryKindEventLabel')],
    ['fact', memoryGrouped && factKindVisible, scopedDocument.getElementById('memoryKindFactLabel')],
    ['schema', memoryGrouped && schemaKindVisible, scopedDocument.getElementById('memoryKindSchemaLabel')]
  ];

  if (memoryGrouped && viewport.clientWidth <= 900) {
    const controlsBottom = scopedDocument.querySelector('.controls').getBoundingClientRect().bottom;
    const y = Math.min(viewport.clientHeight - 38, controlsBottom + 18);
    const xByLayer = {
      event: viewport.clientWidth / 6,
      fact: viewport.clientWidth / 2,
      schema: viewport.clientWidth * 5 / 6
    };

    entries.forEach(([layer, visible, element]) => {
      if (!visible) return;
      element.style.display = 'block';
      placeAtScreenPoint(element, xByLayer[layer], y);
    });
    return;
  }

  entries.forEach(([layer, visible, element]) => {
    if (visible) place(element, memoryKindLabelWorld[layer]);
  });

  if (memoryGrouped && eventKindVisible) {
    const eventLabel = scopedDocument.getElementById('memoryKindEventLabel');
    const eventRect = eventLabel.getBoundingClientRect();
    const chainRect = scopedDocument.getElementById('memoryChainCard').getBoundingClientRect();
    const overlapsChain = eventRect.left < chainRect.right &&
      eventRect.right > chainRect.left &&
      eventRect.top < chainRect.bottom &&
      eventRect.bottom > chainRect.top;

    if (overlapsChain) {
      placeAtScreenPoint(
        eventLabel,
        eventRect.left + eventRect.width / 2,
        chainRect.bottom + eventRect.height / 2 + 8
      );
    }
  }
}

function recenterGrid() {
  const t = controls.target;
  grid.position.set(
    Math.round(t.x/GRID_STEP)*GRID_STEP,
    Math.round(t.y/GRID_STEP)*GRID_STEP,
    Math.round(t.z/GRID_STEP)*GRID_STEP
  );
}

function render() {
  if (renderSuspended) return;

  place(scopedDocument.getElementById('axisX'), axisLabels.axisX);
  place(scopedDocument.getElementById('axisY'), axisLabels.axisY);
  place(scopedDocument.getElementById('axisZ'), axisLabels.axisZ);

  if (labelsVisible) {
    for (const [id,p] of Object.entries(labelWorld)) {
      place(scopedDocument.getElementById(id), p);
    }
  }

  if (memoryVisible) {
    placeMemoryKindLabels();
  }

  renderer.render(scene,camera);
  window.__brainPerformance.renderCount++;
}

function requestRender() {
  if (renderSuspended || scheduledRender) return;
  scheduledRender = requestAnimationFrame(() => {
    scheduledRender = 0;
    render();
  });
}

controls.addEventListener('change', () => {
  recenterGrid();
  requestRender();
});

scopedDocument.getElementById('resetBtn').addEventListener('click', () => {
  camera.position.set(0,2.4,44);
  controls.target.set(0,1.1,-0.9);
  grid.position.set(0,0,0);
  controls.update();
  render();
});

scopedDocument.getElementById('frontBtn').addEventListener('click', () => {
  camera.position.set(0,2.4,44);
  controls.target.set(0,1.1,-0.9);
  controls.update();
  render();
});

scopedDocument.getElementById('toggleLabelsBtn').addEventListener('click', () => {
  updateLabels(!labelsVisible);
});

scopedDocument.getElementById('toggleRegionsBtn').addEventListener('click', () => {
  updateRegionMode(!regionsVisible);
});

scopedDocument.getElementById('toggleCoreBtn').addEventListener('click', () => {
  updateCore(!coreVisible);
});

scopedDocument.getElementById('toggleGridBtn').addEventListener('click', () => {
  updateGrid(!gridVisible);
});

scopedDocument.getElementById('toggleNeuralBtn').addEventListener('click', () => {
  updateNeuralVisible(!neuralVisible);
});

scopedDocument.getElementById('spontaneousBtn').addEventListener('click', () => {
  setNeuralMode('spontaneous');
});

scopedDocument.getElementById('frontalPulseBtn').addEventListener('click', () => {
  setNeuralMode('prefrontal');
});

scopedDocument.getElementById('hippocampusPulseBtn').addEventListener('click', () => {
  setNeuralMode('hippocampus');
});

scopedDocument.getElementById('globalPulseBtn').addEventListener('click', () => {
  setNeuralMode('global');
});

scopedDocument.getElementById('toggleMemoryBtn').addEventListener('click', () => {
  updateMemoryVisibility(!memoryVisible);
});

scopedDocument.getElementById('memoryXrayBtn').addEventListener('click', () => {
  updateMemoryXray(!memoryXrayEnabled);
});

scopedDocument.getElementById('toggleObjectGroupingBtn').addEventListener('click', () => {
  updateObjectGrouping(!memoryGrouped);
});

scopedDocument.getElementById('toggleEventKindBtn').addEventListener('click', () => {
  updateEventKind(!eventKindVisible);
});

scopedDocument.getElementById('toggleFactKindBtn').addEventListener('click', () => {
  updateFactKind(!factKindVisible);
});

scopedDocument.getElementById('toggleSchemaKindBtn').addEventListener('click', () => {
  updateSchemaKind(!schemaKindVisible);
});

scopedDocument.getElementById('memoryConsolidateBtn').addEventListener('click', () => {
  startMemoryPulse('consolidate');
});

scopedDocument.getElementById('memoryRetrieveBtn').addEventListener('click', () => {
  startMemoryPulse('retrieve');
});

scopedDocument.getElementById('memoryExampleBtn').addEventListener('click', () => {
  highlightMemoryExample(memoryExampleIndex,true);
});

scopedDocument.getElementById('memoryNextExampleBtn').addEventListener('click', () => {
  highlightMemoryExample(memoryExampleIndex + 1,false);
});

scopedDocument.getElementById('memoryLoadMoreBtn').addEventListener('click', () => {
  if (!canonicalSnapshotLoading && canonicalSnapshotCursor) {
    loadCanonicalSnapshot(canonicalSnapshotCursor);
  }
});

scopedDocument.getElementById('memoryClearExampleBtn').addEventListener('click', () => {
  clearMemoryExample();
});

resizeTarget.addEventListener('resize', () => {
  if (scheduledRender) cancelAnimationFrame(scheduledRender);
  scheduledRender = requestAnimationFrame(() => {
    scheduledRender = 0;
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    const nextPixelRatio = Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap);
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
    if (renderer.getPixelRatio() !== nextPixelRatio) renderer.setPixelRatio(nextPixelRatio);
    renderer.setSize(w,h);
    updateMemoryLayout();
    render();
  });
});

renderSuspended = true;
updateLabels(true);
updateRegionMode(true);
updateCore(false);
updateGrid(true);

// 默认突出 Canonical 激活子图：关闭内部粗体素并启用图谱透视。
updateNeuralVisible(false);
setNeuralMode('spontaneous');

updateMemoryVisibility(true);
updateMemoryXray(true);
updateObjectGrouping(false);
updateEventKind(true);
updateFactKind(true);
updateSchemaKind(true);

// 默认给出一条可回源的 Canonical L3 证明路径。
highlightMemoryExample(0,false);

renderSuspended = false;
render();
window.__canonicalSnapshotReady = Promise.resolve();

  const renderedCanvas = renderer.domElement
  renderedCanvas.dataset.knowledgeBrainCanvas = ''
  renderedCanvas.className = 'eisKnowledgeBrainCanvas'
  const nativeRender = render
  let currentMode = 'idle'
  const setMode = next => {
    currentMode = next
    renderedCanvas.style.transform = next === 'settling' ? 'scale(.15)' : 'scale(1)'
    if (next === 'thinking') {
      renderSuspended = false
      updateGrid(true)
      updateMemoryVisibility(true)
      updateNeuralVisible(true)
      nativeRender()
    } else if (next === 'hero' || next === 'settling') {
      renderSuspended = false
      updateGrid(true)
      updateMemoryVisibility(true)
      updateNeuralVisible(false)
      nativeRender()
    } else {
      stopNeuralAnimation()
      if (memoryRAF) cancelAnimationFrame(memoryRAF)
      memoryRAF = 0
      renderSuspended = true
    }
  }
  setMode('idle')
  return {
    ready: true,
    canvas: renderedCanvas,
    setMode,
    dispose() {
      stopNeuralAnimation()
      if (memoryRAF) cancelAnimationFrame(memoryRAF)
      if (scheduledRender) cancelAnimationFrame(scheduledRender)
      hostResizeObserver.disconnect()
      controls.dispose()
      const resources = new Set()
      scene.traverse(object => {
        if (object.geometry) resources.add(object.geometry)
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) resources.add(material)
        if (object.isInstancedMesh) object.dispose()
      })
      resources.forEach(resource => resource.dispose())
      renderer.dispose()
      renderedCanvas.remove()
      shadow.innerHTML = ''
    }
  }
}
