-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Reviewable Junleyuan seed for the single-tenant company_site schema.
-- This file is intentionally not executed by the development agent.

BEGIN;

INSERT INTO company_site.site_config (
  site_key, legal_name, brand_name, brand_short_name, factory_name, domain,
  template_key, default_locale, enabled_locales, theme, contact, social_links,
  trademark, settings, seo, status, published_version, published_at, published_by
) VALUES (
  'primary', '台州君乐缘体育用品有限公司', '君乐缘台球', '君乐缘', '君乐缘台球工厂', 'junleyuan.eissys.top',
  'manufacturer-editorial-v1', 'zh-CN', '["zh-CN"]'::jsonb, '{"primaryColor":"#b48a50","accentColor":"#a95040","inkColor":"#171817","paperColor":"#f4f0e8"}'::jsonb, '{"publicChannelUrl":"https://www.jly147.cn/","email":"","phone":"","whatsapp":"","address":""}'::jsonb, '[{"label":"品牌线上渠道","href":"https://www.jly147.cn/"},{"label":"品牌内容动态","href":"https://www.douyin.com/"}]'::jsonb,
  '{"name":"君乐缘","asset":"./assets/junleyuan-mark.png","usageStatus":"待企业确认商标使用授权"}'::jsonb, '{"loginUrl":"/login","loginLabel":"企业人员登录","publicApiBase":"/agent/company-site/public","agent":{"enabled":true,"title":"项目咨询","buttonLabel":"在线咨询","intro":"可以先告诉我产品方向、数量、地区或目标日期。涉及价格、库存和交期的事项会转人工确认。","consentLabel":"我同意使用本次对话信息跟进咨询","placeholder":"输入你的采购问题","sendLabel":"发送","humanHandoffLabel":"留下联系方式，转人工跟进"}}'::jsonb, '{"title":"君乐缘台球 | 君乐缘台球工厂","description":"台州君乐缘体育用品有限公司企业独立站，展示君乐缘台球工厂、木料现场、产品方向与合作入口。","keywords":["君乐缘台球","台球杆","台球器材","台球工厂"]}'::jsonb, 'published', 1, now(), 'seed:junleyuan'
) ON CONFLICT (site_key) DO UPDATE SET
  legal_name = EXCLUDED.legal_name, brand_name = EXCLUDED.brand_name, brand_short_name = EXCLUDED.brand_short_name,
  factory_name = EXCLUDED.factory_name, domain = EXCLUDED.domain, template_key = EXCLUDED.template_key,
  default_locale = EXCLUDED.default_locale, enabled_locales = EXCLUDED.enabled_locales, theme = EXCLUDED.theme,
  contact = EXCLUDED.contact, social_links = EXCLUDED.social_links, trademark = EXCLUDED.trademark,
  settings = EXCLUDED.settings, seo = EXCLUDED.seo, status = EXCLUDED.status,
  published_version = EXCLUDED.published_version, published_at = EXCLUDED.published_at, published_by = EXCLUDED.published_by,
  updated_at = now();

INSERT INTO company_site.site_locales (site_key, locale, fallback_locale, status, translation_owner)
VALUES ('primary', 'zh-CN', '', 'published', 'content:junleyuan')
ON CONFLICT (site_key, locale) DO UPDATE SET status = EXCLUDED.status, fallback_locale = EXCLUDED.fallback_locale, updated_at = now();

INSERT INTO company_site.content_pages (site_key, locale, slug, page_type, title, summary, blocks, seo, status, version, published_at, published_by, created_by, updated_by)
VALUES ('primary', 'zh-CN', 'home', 'home', '从木料， 到一杆入局。', '君乐缘台球，把对球杆的理解放回材料、存放与加工现场，持续做出更贴近真实使用的台球器材。', '{"homepage":{"nav":[{"label":"工厂现场","href":"#factory"},{"label":"木料目录","href":"#materials"},{"label":"制造流程","href":"#craft"},{"label":"产品方向","href":"#products"},{"label":"商务合作","href":"#contact"}],"hero":{"eyebrow":"台州君乐缘体育用品有限公司","titleLines":["从木料，","到一杆入局。"],"accentLine":1,"summary":"君乐缘台球，把对球杆的理解放回材料、存放与加工现场，持续做出更贴近真实使用的台球器材。","image":{"src":"./assets/factory-gate.jpeg","alt":"君乐缘台球工厂门口与办公楼实景"},"primaryAction":{"label":"走进工厂","href":"#factory"},"secondaryAction":{"label":"查看木料目录","href":"#materials"},"signals":["真实工厂现场","木料分区存放","台球器材品牌"]},"intro":{"kicker":"JUNLEYUAN / 01","titleLines":["先把材料看清楚，","再把每一杆做好。"],"accentLine":1,"copy":"一支球杆的手感，从木料进入车间的那一刻就已经开始。君乐缘的工厂资料，记录了圆棒、片料、方料与块料的真实存放，也留下了台球杆加工现场的尺度与秩序。","note":"材料是产品的起点，也是品牌长期交付的底气。"},"factory":{"kicker":"FACTORY / 02","titleLines":["看得见的工厂，","才有看得见的产品。"],"accentLine":1,"description":"从原料仓储到加工车间，君乐缘的现场资料呈现了一条围绕台球杆展开的制造路径。","gallery":[{"className":"gallery-feature","image":"./assets/wood-workshop.jpeg","alt":"君乐缘台球杆加工车间，木杆在架上分区存放","label":"车间现场","caption":"木杆、半成品与工位被放在同一条生产视线里"},{"className":"gallery-tall","image":"./assets/material-racks.jpeg","alt":"君乐缘工厂内整齐排列的圆棒木料","label":"原料仓储","caption":"不同木料以长度、形态与用途区分"},{"className":"gallery-wide","image":"./assets/wood-rods.jpeg","alt":"君乐缘工厂内成批存放的紫红色木质圆棒","label":"材料细节","caption":"圆棒料，是球杆制造最直观的起点"}],"signals":[{"number":"01","title":"木料现场","description":"从圆棒到方料，按形态管理材料"},{"number":"02","title":"分区存放","description":"让每一类木料都有清晰的归属"},{"number":"03","title":"加工制造","description":"围绕台球杆与器材形成现场协同"}]},"materials":{"kicker":"MATERIAL LIBRARY / 03","title":"君乐缘木料目录","description":"以下目录来自企业提供的 Word 清单。长度按清单保留；库存数量、重量与价格未在现有资料中提供。","categories":[{"key":"all","label":"全部"},{"key":"rod","label":"圆棒料"},{"key":"slice","label":"片料"},{"key":"block","label":"块料"},{"key":"square","label":"方料"},{"key":"tech","label":"科技木"}],"items":[{"code":"JLY-WOOD-001","name":"紫心木圆棒","category":"rod","unit":"根","detail":"长度未提供"},{"code":"JLY-WOOD-002","name":"白蜡木","category":"square","unit":"片","detail":"1.2m / 1.5m"},{"code":"JLY-WOOD-003","name":"枫木","category":"square","unit":"片","detail":"1.5m / 0.75m"},{"code":"JLY-WOOD-004","name":"黑檀片","category":"slice","unit":"片","detail":"0.53m / 0.35m"},{"code":"JLY-WOOD-005","name":"黑檀块","category":"block","unit":"块","detail":"长度 53cm"},{"code":"JLY-WOOD-006","name":"鬼脸木片","category":"slice","unit":"片","detail":"长度 50cm"},{"code":"JLY-WOOD-007","name":"紫心木块","category":"block","unit":"块","detail":"长度 53cm"},{"code":"JLY-WOOD-008","name":"乌木块","category":"block","unit":"块","detail":"长度 53cm"},{"code":"JLY-WOOD-009","name":"乌木片","category":"slice","unit":"片","detail":"长度 53cm"},{"code":"JLY-WOOD-010","name":"金钟柏方料","category":"square","unit":"片","detail":"方料，长度未提供"},{"code":"JLY-WOOD-011","name":"孔雀木方料","category":"square","unit":"片","detail":"紫 / 绿 / 蓝"},{"code":"JLY-WOOD-012","name":"黑白檀方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-013","name":"粉象方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-014","name":"黑柿木方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-015","name":"安博拉方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-016","name":"郁金香方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-017","name":"微凹黄檀片","category":"slice","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-018","name":"黄金樟方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-019","name":"可可木方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-020","name":"金丝楠木方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-021","name":"龙鳞片","category":"slice","unit":"片","detail":"黑红 / 红黑 / 蓝黑 / 绿黑"},{"code":"JLY-WOOD-022","name":"椰子木方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-023","name":"海南黄花梨方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-024","name":"国王木方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-025","name":"缅甸花梨方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-026","name":"巴西花梨方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-027","name":"血檀木方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-028","name":"小叶紫檀方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-029","name":"影木方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-030","name":"崖柏方料","category":"square","unit":"片","detail":"长度未提供"},{"code":"JLY-WOOD-031","name":"科技木方料","category":"tech","unit":"片","detail":"蓝 / 红 / 粉 / 彩色 / 绿 / 黑"}]},"craft":{"kicker":"CRAFT / 04","titleLines":["一支球杆，","经过四个现场判断。"],"accentLine":1,"description":"不把制造写成口号。让材料、分类、加工和交付在同一条工作链上彼此对照。","steps":[{"number":"01","title":"选材","description":"先看木料形态、纹理与长度，再决定它适合进入哪一类产品。"},{"number":"02","title":"分区","description":"圆棒、片料、方料与块料各有位置，让存放成为制造的一部分。"},{"number":"03","title":"加工","description":"在台球杆加工现场完成从木料到杆体的连续工序。"},{"number":"04","title":"交付","description":"围绕球杆、台球桌与配套器材，服务品牌销售与台球场景。"}]},"products":[{"code":"JLY-P-001","slug":"billiard-cues","name":"台球杆","summary":"中式台球、斯诺克与九球等使用场景下的球杆产品方向。","category":"台球器材","applications":["俱乐部","品牌定制","零售渠道"],"specifications":{"publicStatus":"规格、MOQ、价格与交期待确认"},"imageUrls":["./assets/wood-rods.jpeg"]},{"code":"JLY-P-002","slug":"billiard-tables","name":"台球桌","summary":"面向俱乐部与家庭场景的台球桌产品方向。","category":"台球器材","applications":["俱乐部","家庭空间","项目配套"],"specifications":{"publicStatus":"具体尺寸、配置与交期需按项目确认"},"imageUrls":["./assets/workshop-wide.jpeg"]},{"code":"JLY-P-003","slug":"billiard-accessories","name":"配套器材","summary":"围绕台球空间与日常使用的器材和配套选择。","category":"台球器材","applications":["球房运营","空间配套","渠道采购"],"specifications":{"publicStatus":"可按采购清单与使用场景沟通"},"imageUrls":["./assets/material-racks.jpeg"]}],"solutions":[{"slug":"club-project","title":"俱乐部项目配套","industry":"台球俱乐部","description":"围绕球台、球杆、配套器材与交付节奏整理采购清单。"},{"slug":"brand-customization","title":"品牌与渠道定制","industry":"品牌与渠道","description":"从产品方向、材料选择到包装与资料，支持按项目确认定制范围。"},{"slug":"home-space","title":"家庭与商业空间","industry":"家庭与商业空间","description":"按场地尺寸、使用频率和安装条件沟通台球空间所需器材。"}],"cases":[{"slug":"factory-field-record","title":"君乐缘工厂现场记录","industry":"制造现场","scope":"门头、木料仓储、加工车间与材料目录","publicLevel":"anonymous","description":"当前公开案例以企业工厂与材料现场为主，客户名称和交付数据待授权后发布。"}],"story":{"kicker":"FIELD NOTE / 06","titleLines":["把品牌带到球台边，","也把现场带回产品里。"],"accentLine":1,"image":{"src":"./assets/workshop-wide.jpeg","alt":"君乐缘台球工厂内的木杆加工与存放现场"},"copy":"公开网络内容显示，君乐缘持续出现在台球行业展会、品牌采访和线上内容场景中。对君乐缘来说，工厂不是幕后背景，而是与球员、俱乐部和合作伙伴沟通产品的共同语言。"},"faq":[{"question":"可以采购哪些产品？","answer":"当前站点公开展示台球杆、台球桌与配套器材三个方向，具体型号、配置和采购范围需要结合项目确认。"},{"question":"可以提供哪些木料信息？","answer":"站点展示企业现有清单中的木料类别和已提供长度信息；实时库存、重量和价格不在公开页面承诺范围内。"},{"question":"是否支持品牌定制？","answer":"可以先提交品牌、产品、数量和交期需求，由销售人员结合实际能力人工确认。"},{"question":"如何获取准确报价和交期？","answer":"请留下公司、联系人、联系方式、产品方向、数量和目标日期，报价与交期需由授权人员确认。"},{"question":"网站上的商标可以直接用于采购资料吗？","answer":"当前站点使用君乐缘商标素材作为品牌展示，商标授权范围和对外资料使用需由企业确认。"}],"contact":{"kicker":"CONTACT / 07","titleLines":["把下一场合作，","落到一支真实的球杆上。"],"accentLine":1,"formTitle":"提交合作需求","formDescription":"留下基本信息，销售人员将按实际资料与能力人工回复。","privacyLabel":"我同意君乐缘使用以上信息回复本次咨询","submitLabel":"提交询盘","successMessage":"询盘已提交，我们会按留下的联系方式联系你。","failureMessage":"当前在线询盘暂不可用，请通过公开渠道联系企业。"},"footerNote":"页面内容基于企业提供的现场资料与公开网络信息整理；未核实信息不作为价格、库存、认证或交付承诺。"}}'::jsonb, '{"title":"君乐缘台球 | 君乐缘台球工厂","description":"台州君乐缘体育用品有限公司企业独立站，展示君乐缘台球工厂、木料现场、产品方向与合作入口。","keywords":["君乐缘台球","台球杆","台球器材","台球工厂"]}'::jsonb, 'published', 1, now(), 'seed:junleyuan', 'seed:junleyuan', 'seed:junleyuan')
ON CONFLICT (site_key, locale, slug) DO UPDATE SET page_type = EXCLUDED.page_type, title = EXCLUDED.title, summary = EXCLUDED.summary, blocks = EXCLUDED.blocks, seo = EXCLUDED.seo, status = EXCLUDED.status, version = EXCLUDED.version, published_at = EXCLUDED.published_at, published_by = EXCLUDED.published_by, updated_by = EXCLUDED.updated_by, updated_at = now();

WITH product_upsert AS (
  INSERT INTO company_site.products (site_key, product_code, slug, category, applications, specifications, delivery, status, created_by, updated_by)
  VALUES ('primary', 'JLY-P-001', 'billiard-cues', '台球器材', '["俱乐部","品牌定制","零售渠道"]'::jsonb, '{"publicStatus":"规格、MOQ、价格与交期待确认"}'::jsonb, '{}'::jsonb, 'published', 'seed:junleyuan', 'seed:junleyuan')
  ON CONFLICT (site_key, slug) DO UPDATE SET product_code = EXCLUDED.product_code, category = EXCLUDED.category, applications = EXCLUDED.applications, specifications = EXCLUDED.specifications, status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING id
)
INSERT INTO company_site.product_locales (product_id, locale, name, summary, description, image_urls, seo, faq, status)
SELECT id, 'zh-CN', '台球杆', '中式台球、斯诺克与九球等使用场景下的球杆产品方向。', '中式台球、斯诺克与九球等使用场景下的球杆产品方向。', '["./assets/wood-rods.jpeg"]'::jsonb, '{"title":"台球杆","description":"中式台球、斯诺克与九球等使用场景下的球杆产品方向。"}'::jsonb, '[]'::jsonb, 'published' FROM product_upsert
ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, summary = EXCLUDED.summary, description = EXCLUDED.description, image_urls = EXCLUDED.image_urls, seo = EXCLUDED.seo, status = EXCLUDED.status, updated_at = now();

WITH product_upsert AS (
  INSERT INTO company_site.products (site_key, product_code, slug, category, applications, specifications, delivery, status, created_by, updated_by)
  VALUES ('primary', 'JLY-P-002', 'billiard-tables', '台球器材', '["俱乐部","家庭空间","项目配套"]'::jsonb, '{"publicStatus":"具体尺寸、配置与交期需按项目确认"}'::jsonb, '{}'::jsonb, 'published', 'seed:junleyuan', 'seed:junleyuan')
  ON CONFLICT (site_key, slug) DO UPDATE SET product_code = EXCLUDED.product_code, category = EXCLUDED.category, applications = EXCLUDED.applications, specifications = EXCLUDED.specifications, status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING id
)
INSERT INTO company_site.product_locales (product_id, locale, name, summary, description, image_urls, seo, faq, status)
SELECT id, 'zh-CN', '台球桌', '面向俱乐部与家庭场景的台球桌产品方向。', '面向俱乐部与家庭场景的台球桌产品方向。', '["./assets/workshop-wide.jpeg"]'::jsonb, '{"title":"台球桌","description":"面向俱乐部与家庭场景的台球桌产品方向。"}'::jsonb, '[]'::jsonb, 'published' FROM product_upsert
ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, summary = EXCLUDED.summary, description = EXCLUDED.description, image_urls = EXCLUDED.image_urls, seo = EXCLUDED.seo, status = EXCLUDED.status, updated_at = now();

WITH product_upsert AS (
  INSERT INTO company_site.products (site_key, product_code, slug, category, applications, specifications, delivery, status, created_by, updated_by)
  VALUES ('primary', 'JLY-P-003', 'billiard-accessories', '台球器材', '["球房运营","空间配套","渠道采购"]'::jsonb, '{"publicStatus":"可按采购清单与使用场景沟通"}'::jsonb, '{}'::jsonb, 'published', 'seed:junleyuan', 'seed:junleyuan')
  ON CONFLICT (site_key, slug) DO UPDATE SET product_code = EXCLUDED.product_code, category = EXCLUDED.category, applications = EXCLUDED.applications, specifications = EXCLUDED.specifications, status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING id
)
INSERT INTO company_site.product_locales (product_id, locale, name, summary, description, image_urls, seo, faq, status)
SELECT id, 'zh-CN', '配套器材', '围绕台球空间与日常使用的器材和配套选择。', '围绕台球空间与日常使用的器材和配套选择。', '["./assets/material-racks.jpeg"]'::jsonb, '{"title":"配套器材","description":"围绕台球空间与日常使用的器材和配套选择。"}'::jsonb, '[]'::jsonb, 'published' FROM product_upsert
ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, summary = EXCLUDED.summary, description = EXCLUDED.description, image_urls = EXCLUDED.image_urls, seo = EXCLUDED.seo, status = EXCLUDED.status, updated_at = now();

INSERT INTO company_site.solutions (site_key, slug, locale, title, industry, scenario, content, seo, status)
VALUES ('primary', 'club-project', 'zh-CN', '俱乐部项目配套', '台球俱乐部', '俱乐部项目配套', '{"description":"围绕球台、球杆、配套器材与交付节奏整理采购清单。"}'::jsonb, '{"title":"俱乐部项目配套","description":"围绕球台、球杆、配套器材与交付节奏整理采购清单。"}'::jsonb, 'published')
ON CONFLICT (site_key, locale, slug) DO UPDATE SET title = EXCLUDED.title, industry = EXCLUDED.industry, scenario = EXCLUDED.scenario, content = EXCLUDED.content, seo = EXCLUDED.seo, status = EXCLUDED.status, updated_at = now();

INSERT INTO company_site.solutions (site_key, slug, locale, title, industry, scenario, content, seo, status)
VALUES ('primary', 'brand-customization', 'zh-CN', '品牌与渠道定制', '品牌与渠道', '品牌与渠道定制', '{"description":"从产品方向、材料选择到包装与资料，支持按项目确认定制范围。"}'::jsonb, '{"title":"品牌与渠道定制","description":"从产品方向、材料选择到包装与资料，支持按项目确认定制范围。"}'::jsonb, 'published')
ON CONFLICT (site_key, locale, slug) DO UPDATE SET title = EXCLUDED.title, industry = EXCLUDED.industry, scenario = EXCLUDED.scenario, content = EXCLUDED.content, seo = EXCLUDED.seo, status = EXCLUDED.status, updated_at = now();

INSERT INTO company_site.solutions (site_key, slug, locale, title, industry, scenario, content, seo, status)
VALUES ('primary', 'home-space', 'zh-CN', '家庭与商业空间', '家庭与商业空间', '家庭与商业空间', '{"description":"按场地尺寸、使用频率和安装条件沟通台球空间所需器材。"}'::jsonb, '{"title":"家庭与商业空间","description":"按场地尺寸、使用频率和安装条件沟通台球空间所需器材。"}'::jsonb, 'published')
ON CONFLICT (site_key, locale, slug) DO UPDATE SET title = EXCLUDED.title, industry = EXCLUDED.industry, scenario = EXCLUDED.scenario, content = EXCLUDED.content, seo = EXCLUDED.seo, status = EXCLUDED.status, updated_at = now();

INSERT INTO company_site.cases (site_key, locale, slug, title, industry, scope, content, public_level, status)
VALUES ('primary', 'zh-CN', 'factory-field-record', '君乐缘工厂现场记录', '制造现场', '门头、木料仓储、加工车间与材料目录', '{"description":"当前公开案例以企业工厂与材料现场为主，客户名称和交付数据待授权后发布。"}'::jsonb, 'anonymous', 'published')
ON CONFLICT (site_key, locale, slug) DO UPDATE SET title = EXCLUDED.title, industry = EXCLUDED.industry, scope = EXCLUDED.scope, content = EXCLUDED.content, public_level = EXCLUDED.public_level, status = EXCLUDED.status, updated_at = now();

INSERT INTO company_site.knowledge_documents (site_key, locale, document_type, title, content, citations, forbidden_claims, status, version, created_by, updated_by)
VALUES ('primary', 'zh-CN', 'faq', 'FAQ: 可以采购哪些产品？', '可以采购哪些产品？

当前站点公开展示台球杆、台球桌与配套器材三个方向，具体型号、配置和采购范围需要结合项目确认。', '[]'::jsonb, '["价格、库存、交期、认证和客户评价不得在无证据时承诺"]'::jsonb, 'published', 1, 'seed:junleyuan', 'seed:junleyuan');

INSERT INTO company_site.knowledge_documents (site_key, locale, document_type, title, content, citations, forbidden_claims, status, version, created_by, updated_by)
VALUES ('primary', 'zh-CN', 'faq', 'FAQ: 可以提供哪些木料信息？', '可以提供哪些木料信息？

站点展示企业现有清单中的木料类别和已提供长度信息；实时库存、重量和价格不在公开页面承诺范围内。', '[]'::jsonb, '["价格、库存、交期、认证和客户评价不得在无证据时承诺"]'::jsonb, 'published', 1, 'seed:junleyuan', 'seed:junleyuan');

INSERT INTO company_site.knowledge_documents (site_key, locale, document_type, title, content, citations, forbidden_claims, status, version, created_by, updated_by)
VALUES ('primary', 'zh-CN', 'faq', 'FAQ: 是否支持品牌定制？', '是否支持品牌定制？

可以先提交品牌、产品、数量和交期需求，由销售人员结合实际能力人工确认。', '[]'::jsonb, '["价格、库存、交期、认证和客户评价不得在无证据时承诺"]'::jsonb, 'published', 1, 'seed:junleyuan', 'seed:junleyuan');

INSERT INTO company_site.knowledge_documents (site_key, locale, document_type, title, content, citations, forbidden_claims, status, version, created_by, updated_by)
VALUES ('primary', 'zh-CN', 'faq', 'FAQ: 如何获取准确报价和交期？', '如何获取准确报价和交期？

请留下公司、联系人、联系方式、产品方向、数量和目标日期，报价与交期需由授权人员确认。', '[]'::jsonb, '["价格、库存、交期、认证和客户评价不得在无证据时承诺"]'::jsonb, 'published', 1, 'seed:junleyuan', 'seed:junleyuan');

INSERT INTO company_site.knowledge_documents (site_key, locale, document_type, title, content, citations, forbidden_claims, status, version, created_by, updated_by)
VALUES ('primary', 'zh-CN', 'faq', 'FAQ: 网站上的商标可以直接用于采购资料吗？', '网站上的商标可以直接用于采购资料吗？

当前站点使用君乐缘商标素材作为品牌展示，商标授权范围和对外资料使用需由企业确认。', '[]'::jsonb, '["价格、库存、交期、认证和客户评价不得在无证据时承诺"]'::jsonb, 'published', 1, 'seed:junleyuan', 'seed:junleyuan');

INSERT INTO company_site.seo_metadata (site_key, locale, path, title, description, canonical, robots, keywords, structured_data, status, updated_by)
VALUES
  ('primary', 'zh-CN', '/company/', '君乐缘台球 | 君乐缘台球工厂', '台州君乐缘体育用品有限公司企业独立站，展示工厂、木料现场、产品方向与合作入口。', 'https://junleyuan.eissys.top/company/', 'index,follow', '["君乐缘台球","台球杆","台球器材","台球工厂"]'::jsonb, '{"type":"Organization"}'::jsonb, 'published', 'seed:junleyuan'),
  ('primary', 'zh-CN', '/company/products/billiard-cues', '台球杆 | 君乐缘台球', '君乐缘台球杆产品方向与合作入口，具体规格、MOQ、价格和交期待确认。', 'https://junleyuan.eissys.top/company/products/billiard-cues', 'index,follow', '["台球杆","台球杆工厂"]'::jsonb, '{"type":"Product"}'::jsonb, 'published', 'seed:junleyuan'),
  ('primary', 'zh-CN', '/company/products/billiard-tables', '台球桌 | 君乐缘台球', '君乐缘台球桌产品方向与项目合作入口，具体尺寸、配置和交期需按项目确认。', 'https://junleyuan.eissys.top/company/products/billiard-tables', 'index,follow', '["台球桌","台球桌项目"]'::jsonb, '{"type":"Product"}'::jsonb, 'published', 'seed:junleyuan'),
  ('primary', 'zh-CN', '/company/products/billiard-accessories', '配套器材 | 君乐缘台球', '围绕台球空间与日常使用的配套器材方向，采购范围按清单与场景沟通。', 'https://junleyuan.eissys.top/company/products/billiard-accessories', 'index,follow', '["台球配套器材","球房器材"]'::jsonb, '{"type":"Product"}'::jsonb, 'published', 'seed:junleyuan')
ON CONFLICT (site_key, locale, path) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, canonical = EXCLUDED.canonical, robots = EXCLUDED.robots, keywords = EXCLUDED.keywords, structured_data = EXCLUDED.structured_data, status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now();

INSERT INTO company_site.agent_qualification_rules (site_key, version, conditions, score_delta, active_from, status, created_by)
VALUES ('primary', 1, '{"rules":[{"field":"contact_complete","when":true,"scoreDelta":20},{"field":"quantity_present","when":true,"scoreDelta":20},{"field":"target_date_present","when":true,"scoreDelta":15},{"field":"product_present","when":true,"scoreDelta":20},{"field":"business_identity_present","when":true,"scoreDelta":15}],"maxScore":100}', 0, now(), 'active', 'seed:junleyuan')
ON CONFLICT (site_key, version) DO UPDATE SET conditions = EXCLUDED.conditions, active_from = EXCLUDED.active_from, status = EXCLUDED.status;

INSERT INTO company_site.evidence_records (site_key, claim, source_type, source_ref, evidence, verified_by, status)
VALUES ('primary', '页面图片来自君乐缘工厂与木料现场资料', 'enterprise_asset', 'enterprise-site/assets', '{"assets":["factory-gate.jpeg","material-racks.jpeg","wood-rods.jpeg","wood-workshop.jpeg","workshop-wide.jpeg"]}'::jsonb, '待企业复核', 'published')
ON CONFLICT DO NOTHING;

COMMIT;
