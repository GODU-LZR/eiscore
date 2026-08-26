-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Published Jinwei content seed.  Claims that come from public research are
-- described as reported/subject to confirmation; no customer, price, stock,
-- certification or capacity promise is created here.

BEGIN;

INSERT INTO company_site.site_config (
  site_key, legal_name, brand_name, brand_short_name, factory_name, domain,
  template_key, default_locale, enabled_locales, theme, contact, social_links,
  trademark, settings, seo, status, published_version, published_at, published_by
) VALUES (
  'primary',
  '湛江市经纬网厂',
  '经纬网业',
  '经纬',
  '湛江市经纬网厂',
  'jwwc.eiscore.top',
  'manufacturer-editorial-v1',
  'zh-CN',
  '["zh-CN","en-US"]'::jsonb,
  '{"primaryColor":"#1f6755","accentColor":"#d6aa3a","inkColor":"#142620","paperColor":"#f5f7f4"}'::jsonb,
  '{"email":"","phone":"","whatsapp":"","address":"","publicChannelUrl":""}'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  '{"loginUrl":"https://jwwc-admin.eiscore.top/login","loginLabel":"EISCore 制造系统","publicApiBase":"/agent/company-site/public","agent":{"enabled":true,"title":"工程询盘","buttonLabel":"提交规格","intro":"请告诉我们产品方向、材质、尺寸、数量和应用场景。价格、库存与交期由授权人员人工确认。","consentLabel":"我同意使用本次信息进行询盘跟进","placeholder":"输入你的规格或项目问题","sendLabel":"发送","humanHandoffLabel":"留下联系方式，转人工跟进"}}'::jsonb,
  '{"title":"湛江市经纬网厂 | Netting & Offshore Aquaculture Solutions","description":"湛江市经纬网厂提供有结网、无结网、绳索、养殖网箱及按场景定制的网具工程方案。","keywords":["渔网厂家","无结网","深水网箱","渔用绳索","海洋牧场"]}'::jsonb,
  'published', 1, now(), 'seed:jinwei'
)
ON CONFLICT (site_key) DO UPDATE SET
  legal_name = EXCLUDED.legal_name,
  brand_name = EXCLUDED.brand_name,
  brand_short_name = EXCLUDED.brand_short_name,
  factory_name = EXCLUDED.factory_name,
  domain = EXCLUDED.domain,
  template_key = EXCLUDED.template_key,
  default_locale = EXCLUDED.default_locale,
  enabled_locales = EXCLUDED.enabled_locales,
  theme = EXCLUDED.theme,
  contact = EXCLUDED.contact,
  social_links = EXCLUDED.social_links,
  trademark = EXCLUDED.trademark,
  settings = EXCLUDED.settings,
  seo = EXCLUDED.seo,
  status = EXCLUDED.status,
  published_version = EXCLUDED.published_version,
  published_at = EXCLUDED.published_at,
  published_by = EXCLUDED.published_by,
  updated_at = now();

INSERT INTO company_site.site_locales (site_key, locale, fallback_locale, status, translation_owner)
VALUES
  ('primary', 'zh-CN', '', 'published', 'content:jinwei'),
  ('primary', 'en-US', 'zh-CN', 'published', 'content:jinwei')
ON CONFLICT (site_key, locale) DO UPDATE SET
  fallback_locale = EXCLUDED.fallback_locale,
  status = EXCLUDED.status,
  translation_owner = EXCLUDED.translation_owner,
  updated_at = now();

INSERT INTO company_site.content_pages (
  site_key, locale, slug, page_type, title, summary, blocks, seo,
  status, version, published_at, published_by, created_by, updated_by
)
VALUES
(
  'primary', 'zh-CN', 'home', 'home',
  '从一根丝，到一座深海网箱。',
  '面向渔业捕捞、深远海养殖与工业水体拦截场景，提供丝、线、绳、网衣、深水网箱及工程集成解决方案。',
  $json$ {
    "hero": {"eyebrow":"湛江市经纬网厂","title":"从一根丝，到一座深海网箱。","summary":"有结网、无结网、绳索与养殖网箱，从线材准备、织造和人工检修，到定型、包装与分批交付。","image":"/company-site/assets/jinwei/hero-net.webp"},
    "navigation":[{"label":"产品","href":"#products"},{"label":"解决方案","href":"#solutions"},{"label":"制造","href":"#capability"},{"label":"质量依据","href":"#quality"},{"label":"规格询盘","href":"#inquiry"}],
    "sections":["products","solutions","capability","quality","inquiry"],
    "boundary":"公开内容只展示已整理的产品族、工艺和研究依据；产能、客户、认证、价格、库存和交期需企业确认。"
  } $json$::jsonb,
  '{"title":"湛江市经纬网厂 | 渔网、绳索与深水网箱","description":"从丝、线、绳到网衣和深水网箱系统的制造与工程协同。"}'::jsonb,
  'published', 1, now(), 'seed:jinwei', 'seed:jinwei', 'seed:jinwei'
),
(
  'primary', 'en-US', 'home', 'home',
  'From Filament to Deep-Sea Cage Systems.',
  'Integrated netting, rope, aquaculture cage and engineering solutions for commercial fishing, offshore aquaculture and industrial water-intake protection.',
  $json$ {"hero":{"eyebrow":"Zhanjiang Jingwei Netting Factory","title":"From Filament to Deep-Sea Cage Systems.","summary":"Knotted and knotless netting, ropes and cage systems, connected from filament preparation to inspection, packing and staged delivery.","image":"/company-site/assets/jinwei/hero-net.webp"},"navigation":[{"label":"Products","href":"#products"},{"label":"Solutions","href":"#solutions"},{"label":"Manufacturing","href":"#capability"},{"label":"Quality","href":"#quality"},{"label":"RFQ","href":"#inquiry"}],"sections":["products","solutions","capability","quality","inquiry"],"boundary":"Public content is limited to reviewed product families, process evidence and research references. Capacity, customers, certificates, price, stock and lead time require confirmation."} $json$::jsonb,
  '{"title":"Zhanjiang Jingwei Netting Factory | Netting & Cage Systems","description":"Netting, ropes, deep-sea cage and engineering coordination from filament to delivery."}'::jsonb,
  'published', 1, now(), 'seed:jinwei', 'seed:jinwei', 'seed:jinwei'
)
ON CONFLICT (site_key, locale, slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  blocks = EXCLUDED.blocks,
  seo = EXCLUDED.seo,
  status = EXCLUDED.status,
  version = EXCLUDED.version,
  published_at = EXCLUDED.published_at,
  published_by = EXCLUDED.published_by,
  updated_by = EXCLUDED.updated_by,
  updated_at = now();

WITH product_upsert AS (
  INSERT INTO company_site.products (
    site_key, product_code, slug, category, applications, specifications,
    delivery, evidence_ids, status, created_by, updated_by
  ) VALUES (
    'primary', 'JW-P-001', 'knotted-net', '渔业网具',
    '["捕捞","养殖","定制网片"]'::jsonb,
    '{"construction":["单结","双结"],"materials":["聚乙烯","尼龙","涤纶"],"publicStatus":"规格与允许偏差按合同确认"}'::jsonb,
    '{"unitOptions":["MTRS","YDS","条","件"]}'::jsonb,
    '["evidence-jinwei-process"]'::jsonb, 'published', 'seed:jinwei', 'seed:jinwei'
  ) ON CONFLICT (site_key, slug) DO UPDATE SET
    product_code = EXCLUDED.product_code, category = EXCLUDED.category,
    applications = EXCLUDED.applications, specifications = EXCLUDED.specifications,
    delivery = EXCLUDED.delivery, evidence_ids = EXCLUDED.evidence_ids,
    status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING id
)
INSERT INTO company_site.product_locales (
  product_id, locale, name, summary, description, image_urls, seo, faq, status
)
SELECT id, 'zh-CN', '有结网', '面向渔业捕捞、养殖和定制网片的有结结构。',
  '按材质、D 数或股数、网眼/目数、尺寸、颜色、重量和包装要求形成规格版本；具体参数在报价前核对。',
  '["/company-site/assets/jinwei/mesh-on-loom.webp"]'::jsonb,
  '{"title":"有结网 | 经纬网业","description":"有结渔网及定制网片规格入口。"}'::jsonb,
  '[]'::jsonb, 'published' FROM product_upsert
ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, summary = EXCLUDED.summary, description = EXCLUDED.description, image_urls = EXCLUDED.image_urls, seo = EXCLUDED.seo, status = EXCLUDED.status, updated_at = now();

WITH product_upsert AS (
  INSERT INTO company_site.products (site_key, product_code, slug, category, applications, specifications, delivery, status, created_by, updated_by)
  VALUES ('primary', 'JW-P-002', 'knotless-net', '养殖网衣', '["深远海养殖","重力式网箱","平台养殖"]'::jsonb, '{"construction":["无结"],"materials":["涤纶","尼龙"],"publicStatus":"鱼类接触、强力和耐久要求按项目核对"}'::jsonb, '{"unitOptions":["MTRS","YDS","条","件"]}'::jsonb, 'published', 'seed:jinwei', 'seed:jinwei')
  ON CONFLICT (site_key, slug) DO UPDATE SET product_code = EXCLUDED.product_code, category = EXCLUDED.category, applications = EXCLUDED.applications, specifications = EXCLUDED.specifications, delivery = EXCLUDED.delivery, status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING id
)
INSERT INTO company_site.product_locales (product_id, locale, name, summary, description, image_urls, seo, faq, status)
SELECT id, 'zh-CN', '无结网', '为深远海养殖和网箱场景准备的无结网衣方向。', '无结结构以整经、经编织造、补网、染色可选、定型、剪断和包装形成制造路线；应用效果需按鱼种、海况和项目设计确认。', '["/company-site/assets/jinwei/hero-net.webp"]'::jsonb, '{"title":"无结网 | 经纬网业","description":"深远海养殖无结网衣与项目规格入口。"}'::jsonb, '[]'::jsonb, 'published' FROM product_upsert
ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, summary = EXCLUDED.summary, description = EXCLUDED.description, image_urls = EXCLUDED.image_urls, seo = EXCLUDED.seo, status = EXCLUDED.status, updated_at = now();

WITH product_upsert AS (
  INSERT INTO company_site.products (site_key, product_code, slug, category, applications, specifications, delivery, status, created_by, updated_by)
  VALUES ('primary', 'JW-P-003', 'rope-and-twine', '绳索与网线', '["网箱装配","捕捞","工程连接"]'::jsonb, '{"materials":["PE","PP","尼龙","涤纶"],"structures":["并线","捻制","成绳"],"publicStatus":"长度、重量和包装单元按订单确认"}'::jsonb, '{"unitOptions":["MTRS","KG","卷","轴"]}'::jsonb, 'published', 'seed:jinwei', 'seed:jinwei')
  ON CONFLICT (site_key, slug) DO UPDATE SET product_code = EXCLUDED.product_code, category = EXCLUDED.category, applications = EXCLUDED.applications, specifications = EXCLUDED.specifications, delivery = EXCLUDED.delivery, status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING id
)
INSERT INTO company_site.product_locales (product_id, locale, name, summary, description, image_urls, seo, faq, status)
SELECT id, 'zh-CN', '绳索与网线', '从细丝、纱线到并线、捻线和成绳的规格化产品方向。', '记录材质、线规格、股数、捻度、长度/重量、盘卷和包装标签，适配网箱装配与海洋作业场景。', '["/company-site/assets/jinwei/rope-coils.webp"]'::jsonb, '{"title":"绳索与网线 | 经纬网业","description":"渔用绳索、网线和单丝产品方向。"}'::jsonb, '[]'::jsonb, 'published' FROM product_upsert
ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, summary = EXCLUDED.summary, description = EXCLUDED.description, image_urls = EXCLUDED.image_urls, seo = EXCLUDED.seo, status = EXCLUDED.status, updated_at = now();

WITH product_upsert AS (
  INSERT INTO company_site.products (site_key, product_code, slug, category, applications, specifications, delivery, status, created_by, updated_by)
  VALUES ('primary', 'JW-P-004', 'cage-and-engineering', '网箱与工程系统', '["深水网箱","海洋牧场","工业水体拦截"]'::jsonb, '{"components":["网衣","绳索","框架","浮子","连接件"],"publicStatus":"BOM、环境参数和现场支持按项目评审"}'::jsonb, '{"deliveryModes":["网衣供货","网箱装配","工程协同"]}'::jsonb, 'published', 'seed:jinwei', 'seed:jinwei')
  ON CONFLICT (site_key, slug) DO UPDATE SET product_code = EXCLUDED.product_code, category = EXCLUDED.category, applications = EXCLUDED.applications, specifications = EXCLUDED.specifications, delivery = EXCLUDED.delivery, status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING id
)
INSERT INTO company_site.product_locales (product_id, locale, name, summary, description, image_urls, seo, faq, status)
SELECT id, 'zh-CN', '养殖网箱与工程系统', '将网衣、绳索、框架和连接件按 BOM 协同设计。', '面向深水养殖、海洋牧场和工业水体拦截等场景，先收集目标海况、尺寸、物种、网眼和工程图，再进行技术评审。', '["/company-site/assets/jinwei/weaving-floor.webp"]'::jsonb, '{"title":"养殖网箱与工程系统 | 经纬网业","description":"深水网箱、网衣和海洋工程协同方案。"}'::jsonb, '[]'::jsonb, 'published' FROM product_upsert
ON CONFLICT (product_id, locale) DO UPDATE SET name = EXCLUDED.name, summary = EXCLUDED.summary, description = EXCLUDED.description, image_urls = EXCLUDED.image_urls, seo = EXCLUDED.seo, status = EXCLUDED.status, updated_at = now();

INSERT INTO company_site.solutions (site_key, slug, locale, title, industry, scenario, content, seo, status)
VALUES
  ('primary','commercial-fishing','zh-CN','渔业捕捞与网具定制','渔业捕捞','按目标鱼种、作业方式和网目要求定制','{"description":"围绕材质、网结、网眼、尺寸、颜色、重量和包装形成可审核规格。","steps":["需求采集","规格版本","样品/检验","分批交付"]}'::jsonb,'{"title":"渔业捕捞网具方案"}'::jsonb,'published'),
  ('primary','offshore-aquaculture','zh-CN','深远海养殖网箱','深远海养殖','网衣、绳索、框架与系泊的系统协同','{"description":"根据鱼种、海况、网箱尺寸和维护方式进行 BOM 与检验评审。","steps":["环境输入","网衣与框架","整体检验","现场协同"]}'::jsonb,'{"title":"深远海养殖网箱方案"}'::jsonb,'published'),
  ('primary','industrial-intake','zh-CN','工业水体拦截网','工业水体','高强度网材与定制几何的工程评审','{"description":"UHMWPE 等材料方向仅作为项目评审选项，强力、耐磨和尺寸需按工况验证。","steps":["工况确认","材料评审","样件检验","交付支持"]}'::jsonb,'{"title":"工业水体拦截网方案"}'::jsonb,'published'),
  ('primary','marine-ranch','zh-CN','海洋牧场工程协同','海洋牧场','网具、网箱和养殖系统的项目协同','{"description":"将网衣、绳索、设备和现场交付拆成可追溯工作包，客户名称和项目数据需授权后公开。"}'::jsonb,'{"title":"海洋牧场工程协同"}'::jsonb,'published'),
  ('primary','commercial-fishing','en-US','Commercial Fishing Netting','Commercial fishing','Specification-led netting for fishing and custom operations','{"description":"Material, knot structure, mesh, dimensions, colour, weight and packing are reviewed as one specification version."}'::jsonb,'{"title":"Commercial fishing netting"}'::jsonb,'published'),
  ('primary','offshore-aquaculture','en-US','Offshore Aquaculture Cage Systems','Offshore aquaculture','Netting, rope, frame and mooring coordination','{"description":"Project inputs include species, sea conditions, cage dimensions, mesh requirements and inspection plan."}'::jsonb,'{"title":"Offshore aquaculture cage systems"}'::jsonb,'published'),
  ('primary','industrial-intake','en-US','Industrial Intake Interception Netting','Industrial water intake','Custom geometry and material review for demanding marine intake environments','{"description":"Material and performance claims remain subject to project testing and approval."}'::jsonb,'{"title":"Industrial intake netting"}'::jsonb,'published'),
  ('primary','marine-ranch','en-US','Marine Ranch Engineering Coordination','Marine ranching','Traceable work packages for netting and offshore delivery','{"description":"Customer and project details are published only after authorization."}'::jsonb,'{"title":"Marine ranch engineering"}'::jsonb,'published')
ON CONFLICT (site_key, locale, slug) DO UPDATE SET title = EXCLUDED.title, industry = EXCLUDED.industry, scenario = EXCLUDED.scenario, content = EXCLUDED.content, seo = EXCLUDED.seo, status = EXCLUDED.status, updated_at = now();

INSERT INTO company_site.cases (site_key, locale, slug, title, industry, scope, content, public_level, status)
VALUES
  ('primary','zh-CN','netting-field-review','网具制造现场与工艺链','制造现场','拉丝、整经、织造、补网、定型、包装和仓储','{"description":"案例页面仅展示已获授权的现场与工艺信息，不公开历史合同、客户联系人、库存或机台负荷。","evidence":"local-research-materials"}'::jsonb,'anonymous','published'),
  ('primary','zh-CN','reported-offshore-projects','公开报道中的深远海项目线索','深远海养殖','公开报道提及的网箱或平台应用线索','{"description":"这些内容作为待授权、待核验的研究线索，不构成对所有项目的性能保证。","evidence":"online-research-register"}'::jsonb,'anonymous','published'),
  ('primary','en-US','netting-field-review','Manufacturing Floor and Process Chain','Manufacturing','Filament, warping, weaving, repair, finishing, packing and warehouse handoffs','{"description":"Only reviewed and authorised field information is published. Historical contracts and live operating data remain private."}'::jsonb,'anonymous','published'),
  ('primary','en-US','reported-offshore-projects','Reported Offshore Project Leads','Offshore aquaculture','Publicly reported project references pending authorisation','{"description":"Research leads are not a performance guarantee and require project-level verification."}'::jsonb,'anonymous','published')
ON CONFLICT (site_key, locale, slug) DO UPDATE SET title = EXCLUDED.title, industry = EXCLUDED.industry, scope = EXCLUDED.scope, content = EXCLUDED.content, public_level = EXCLUDED.public_level, status = EXCLUDED.status, updated_at = now();

INSERT INTO company_site.knowledge_documents (site_key, locale, document_type, title, content, citations, forbidden_claims, status, version, created_by, updated_by)
VALUES
  ('primary','zh-CN','faq','FAQ：可以提供哪些网具？','当前公开展示有结网、无结网、绳索与养殖网箱/工程系统四个方向。具体材质、规格、MOQ、价格和交期需根据项目人工确认。','[{"type":"internal-research","ref":"docs/jinwei/01_research-evidence.md"}]'::jsonb,'["不得承诺未确认的产能、库存、价格、交期、认证或客户名称"]'::jsonb,'published',1,'seed:jinwei','seed:jinwei'),
  ('primary','zh-CN','faq','FAQ：无结网适合什么场景？','无结网可作为深远海养殖项目的网衣方向之一。鱼种、海况、网箱结构、网眼和检验要求必须在项目评审中确认，页面不作绝对性能承诺。','[{"type":"copy","ref":"湛江经纬_独立站中英文文案_2026-08-26.md"}]'::jsonb,'["不得写绝不伤鱼、100%防刮伤等绝对化表述"]'::jsonb,'published',1,'seed:jinwei','seed:jinwei'),
  ('primary','zh-CN','faq','FAQ：如何提交规格询盘？','请提供产品方向、材质、网结、线规格/股数、网眼/目数、尺寸、颜色、重量、包装、数量、目标日期和联系方式。我们会先进行人工规格审核。','[{"type":"internal-research","ref":"docs/jinwei/02_information-architecture.md"}]'::jsonb,'["询盘不会自动生成正式订单或生产任务"]'::jsonb,'published',1,'seed:jinwei','seed:jinwei'),
  ('primary','zh-CN','faq','FAQ：网站上的数字和案例是否代表当前承诺？','公开资料中的年限、设备、产能和项目数字需要企业确认；产业集群统计不能改写为单一网厂数据。公开案例仅按授权和证据等级展示。','[{"type":"research","ref":"docs/jinwei/04_online-research-and-implementation.md"}]'::jsonb,'["不得把集团或产业集群统计写成单厂经营数据"]'::jsonb,'published',1,'seed:jinwei','seed:jinwei'),
  ('primary','en-US','faq','FAQ: What can Jingwei supply?','The public site covers knotted netting, knotless netting, ropes and cage or engineering systems. Material, specification, MOQ, price and lead time are confirmed case by case.','[{"type":"internal-research","ref":"docs/jinwei/01_research-evidence.md"}]'::jsonb,'["Do not promise unverified capacity, stock, price, lead time, certificates or customers"]'::jsonb,'published',1,'seed:jinwei','seed:jinwei'),
  ('primary','en-US','faq','FAQ: How do I send a specification?','Share the product family, material, construction, twine size, mesh, dimensions, colour, weight, packing, quantity, target date and contact details for a manual review.','[{"type":"internal-research","ref":"docs/jinwei/02_information-architecture.md"}]'::jsonb,'["An inquiry does not create a sales order or production order automatically"]'::jsonb,'published',1,'seed:jinwei','seed:jinwei')
ON CONFLICT DO NOTHING;

INSERT INTO company_site.evidence_records (site_key, claim, source_type, source_ref, evidence, verified_by, status)
VALUES
  ('primary','经纬网厂的拉丝、整经、织造、补网、定型、包装和仓储工序可由本地调研材料支持','internal_document','docs/jinwei/01_research-evidence.md','{"sourceFiles":80,"uniqueFiles":77,"images":72,"workbooks":4}'::jsonb,'调研整理，待企业复核','published'),
  ('primary','制线扩建与锅炉改造公告可作为设备与工作中心建模依据','official_publication','docs/jinwei/04_online-research-and-implementation.md','{"references":["https://www.zhanjiang.gov.cn/zdlyxxgk/sthj/jsxmhjyx/content/post_2152033.html","https://www.zhanjiang.gov.cn/zdlyxxgk/sthj/jsxmhjyx/content/post_2210607.html"]}'::jsonb,'联网核验，待企业复核','published')
ON CONFLICT DO NOTHING;

INSERT INTO company_site.seo_metadata (site_key, locale, path, title, description, canonical, robots, keywords, structured_data, status, updated_by)
VALUES
  ('primary','zh-CN','/company-site/jinwei','湛江市经纬网厂 | 渔网、绳索与深水网箱','湛江市经纬网厂提供有结网、无结网、绳索、养殖网箱及工程协同方案。','https://jwwc.eiscore.top/company-site/jinwei','index,follow','["渔网厂家","无结网厂家","深水网箱","渔用绳索","海洋牧场"]'::jsonb,'{"@context":"https://schema.org","@type":"Organization","name":"湛江市经纬网厂","url":"https://jwwc.eiscore.top/company-site/jinwei"}'::jsonb,'published','seed:jinwei'),
  ('primary','en-US','/company-site/jinwei','Zhanjiang Jingwei Netting Factory | Netting & Cage Systems','Knotted and knotless netting, ropes, cage systems and engineering coordination from Zhanjiang, China.','https://jwwc.eiscore.top/company-site/jinwei','index,follow','["fishing net manufacturer China","knotless net manufacturer","deep sea aquaculture cage","fishing rope supplier"]'::jsonb,'{"@context":"https://schema.org","@type":"Organization","name":"Zhanjiang Jingwei Netting Factory","url":"https://jwwc.eiscore.top/company-site/jinwei"}'::jsonb,'published','seed:jinwei')
ON CONFLICT (site_key, locale, path) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, canonical = EXCLUDED.canonical, robots = EXCLUDED.robots, keywords = EXCLUDED.keywords, structured_data = EXCLUDED.structured_data, status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now();

INSERT INTO company_site.agent_qualification_rules (site_key, version, conditions, score_delta, active_from, status, created_by)
VALUES ('primary', 1, '{"rules":[{"field":"contact_complete","when":true,"scoreDelta":25},{"field":"quantity_present","when":true,"scoreDelta":20},{"field":"target_date_present","when":true,"scoreDelta":15},{"field":"product_present","when":true,"scoreDelta":20},{"field":"specification_present","when":true,"scoreDelta":20}],"maxScore":100}'::jsonb, 0, now(), 'active', 'seed:jinwei')
ON CONFLICT (site_key, version) DO UPDATE SET conditions = EXCLUDED.conditions, active_from = EXCLUDED.active_from, status = EXCLUDED.status, created_by = EXCLUDED.created_by;

COMMIT;
