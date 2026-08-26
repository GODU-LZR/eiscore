-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- Replace legacy Jinwei image references in an already-initialized database.
-- The public site and the authenticated portal now use the independent-site
-- research gallery under /company-site/assets/jinwei/research-gallery/.

SET client_encoding = 'UTF8';

BEGIN;

UPDATE public.system_configs
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{loginBranding}',
  COALESCE(value -> 'loginBranding', '{}'::jsonb) || jsonb_build_object(
    'logo', '/company-site/assets/jinwei/jinwei-mark.svg',
    'backgroundImage', '/company-site/assets/jinwei/research-gallery/gallery-003.png',
    'carouselImages', jsonb_build_array(
      jsonb_build_object('url', '/company-site/assets/jinwei/research-gallery/gallery-003.png', 'title', '网具现场', 'subtitle', '经纬网业制造现场'),
      jsonb_build_object('url', '/company-site/assets/jinwei/research-gallery/gallery-002.png', 'title', '织造工位', 'subtitle', '多机台生产区域'),
      jsonb_build_object('url', '/company-site/assets/jinwei/research-gallery/gallery-001.png', 'title', '制线路线', 'subtitle', '生产与拉丝参考'),
      jsonb_build_object('url', '/company-site/assets/jinwei/research-gallery/gallery-015.jpeg', 'title', '网箱项目', 'subtitle', '深远海案例参考')
    )
  ),
  true
)
WHERE key = 'app_settings';

UPDATE company_site.content_pages
SET blocks = jsonb_set(
  COALESCE(blocks, '{}'::jsonb),
  '{hero}',
  COALESCE(blocks -> 'hero', '{}'::jsonb) || jsonb_build_object(
    'image', '/company-site/assets/jinwei/research-gallery/gallery-003.png'
  ),
  true
),
updated_at = now()
WHERE site_key = 'primary'
  AND slug = 'home';

UPDATE company_site.product_locales AS locales
SET image_urls = CASE products.slug
  WHEN 'knotted-net' THEN '["/company-site/assets/jinwei/research-gallery/gallery-008.webp"]'::jsonb
  WHEN 'knotless-net' THEN '["/company-site/assets/jinwei/research-gallery/gallery-009.webp"]'::jsonb
  WHEN 'rope-and-twine' THEN '["/company-site/assets/jinwei/research-gallery/gallery-013.webp"]'::jsonb
  WHEN 'cage-and-engineering' THEN '["/company-site/assets/jinwei/research-gallery/gallery-005.webp"]'::jsonb
END,
updated_at = now()
FROM company_site.products AS products
WHERE locales.product_id = products.id
  AND products.site_key = 'primary'
  AND products.slug IN ('knotted-net', 'knotless-net', 'rope-and-twine', 'cage-and-engineering');

NOTIFY pgrst, 'reload schema';

COMMIT;
