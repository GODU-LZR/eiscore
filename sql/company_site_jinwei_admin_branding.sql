-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Tenant-specific portal branding for the isolated Jinwei release. The
-- public company-site content remains in company_site_jinwei_seed.sql; this
-- record controls the authenticated EISCore shell and its login portal.

SET client_encoding = 'UTF8';

INSERT INTO public.system_configs (key, value, description)
VALUES (
  'app_settings',
  $json$
  {
    "title": "湛江市经纬网厂 EISCore 制造协同平台",
    "themeColor": "#1f6755",
    "notifications": true,
    "materialsCategoryDepth": 2,
    "loginBranding": {
      "companyName": "经纬网业",
      "slogan": "从一根丝，到一座深海网箱。",
      "description": "湛江市经纬网厂，聚焦有结网、无结网、绳索与养殖网箱，从线材准备、织造和人工检修，到定型、包装与分批交付。",
      "logo": "/company-site/assets/jinwei/jinwei-mark.svg",
      "siteTag": "湛江市经纬网厂",
      "announcement": "授权员工、计划、仓库、质检与管理入口",
      "headerLoginText": "系统登录",
      "authKicker": "经纬制造系统",
      "authTitle": "进入经纬 EISCore",
      "authSafeNote": "账号由经纬网厂管理员统一分配",
      "authFootnote": "仅限授权人员使用，操作记录纳入审计",
      "primaryActionText": "登录制造系统",
      "secondaryActionText": "查看经纬独立站",
      "secondaryActionUrl": "https://jwwc.eiscore.top/company-site/jinwei",
      "scrollCueText": "查看系统能力",
      "metricsSectionKicker": "JINGWEI / OPERATIONS",
      "metricsSectionTitle": "规格、生产与交付在同一条链路",
      "aboutSectionKicker": "ABOUT JINGWEI",
      "capabilitiesSectionKicker": "MANUFACTURING MODULES",
      "capabilitiesSectionTitle": "从询盘、物料到质量放行",
      "leadersSectionKicker": "授权团队",
      "leadersSectionTitle": "按岗位分工协同",
      "backgroundImage": "/company-site/assets/jinwei/research-gallery/gallery-001.png",
      "navItems": [
        {"label": "制造现场", "anchor": "about"},
        {"label": "业务模块", "anchor": "capabilities"},
        {"label": "协同链路", "anchor": "metrics"}
      ],
      "metrics": [
        {"label": "业务域", "value": "全链路"},
        {"label": "生产状态", "value": "可追踪"},
        {"label": "数据边界", "value": "按角色"}
      ],
      "trustBadges": [
        {"label": "规格版本"},
        {"label": "批次追溯"},
        {"label": "质量放行"}
      ],
      "businessChain": [
        {"title": "规格", "description": "把客户表达整理为可核对的产品与工艺字段。", "status": "版本可审"},
        {"title": "制造", "description": "物料、工位、报工与交接沿同一生产任务推进。", "status": "状态可见"},
        {"title": "交付", "description": "检验、包装、合同归属和分批出库形成闭环。", "status": "链路可追"}
      ],
      "capabilities": [
        {"title": "物料与仓储", "description": "批次、库位、齐套与出入库单据统一管理。"},
        {"title": "生产协同", "description": "规格版本、工单、工序交接和生产报工按角色呈现。"},
        {"title": "质量与设备", "description": "检验、不合格处置、设备点检和维护任务集中留痕。"}
      ],
      "carouselImages": [
        {"url": "/company-site/assets/jinwei/research-gallery/gallery-001.png", "title": "厂区大门", "subtitle": "湛江市经纬网厂"},
        {"url": "/company-site/assets/jinwei/research-gallery/gallery-003.png", "title": "网衣装配", "subtitle": "大面积生产现场"},
        {"url": "/company-site/assets/jinwei/research-gallery/gallery-002.png", "title": "织造工位", "subtitle": "多机台生产区域"},
        {"url": "/company-site/assets/jinwei/research-gallery/gallery-015.jpeg", "title": "深远海应用", "subtitle": "养殖网箱工程场景"}
      ],
      "leaders": [],
      "footerText": "湛江市经纬网厂 · 经纬网业制造协同平台",
      "icpText": ""
    }
  }
  $json$::jsonb,
  '经纬网厂 EISCore 管理门户设置'
)
ON CONFLICT (key) DO UPDATE
SET value = public.system_configs.value || EXCLUDED.value,
    description = EXCLUDED.description;

NOTIFY pgrst, 'reload schema';
