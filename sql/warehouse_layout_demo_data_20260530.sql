-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Warehouse tree and spatial layout demo data.
-- Execute:
--   cat sql/warehouse_layout_demo_data_20260530.sql | docker exec -i eiscore-db psql -v ON_ERROR_STOP=1 -U postgres -d eiscore

SET client_encoding = 'UTF8';

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Make the warehouse hierarchy consistent with the layout editor:
-- level 1 = warehouse, level 2 = area, level 3 = location.
UPDATE scm.warehouses
SET capacity = CASE code
      WHEN 'RM' THEN 6000
      WHEN 'PKG' THEN 23000
      WHEN 'FG' THEN 4200
      ELSE capacity
    END,
    unit = CASE code
      WHEN 'RM' THEN '千克'
      WHEN 'PKG' THEN '个'
      WHEN 'FG' THEN '盒'
      ELSE unit
    END,
    properties = COALESCE(properties, '{}'::jsonb)
      || CASE code
        WHEN 'RM' THEN '{"demo": true, "layout_enabled": true, "purpose": "水产原料及辅料", "temperature": "-18℃/常温分区"}'::jsonb
        WHEN 'PKG' THEN '{"demo": true, "layout_enabled": true, "purpose": "内外包装材料", "temperature": "常温"}'::jsonb
        WHEN 'FG' THEN '{"demo": true, "layout_enabled": true, "purpose": "成品冷冻存储", "temperature": "-18℃"}'::jsonb
        ELSE '{}'::jsonb
      END,
    updated_at = now()
WHERE code IN ('RM', 'PKG', 'FG');

WITH area_specs(code, name, parent_code, sort, capacity, unit, properties) AS (
  VALUES
    ('RM-AUX', '辅料常温库区', 'RM', 14, 1200::numeric, '千克', '{"demo": true, "area": "B区", "temperature": "常温", "humidityMax": 65}'::jsonb),
    ('PKG-INNER', '内包装库区', 'PKG', 31, 12000::numeric, '个', '{"demo": true, "area": "A区", "temperature": "常温", "humidityMax": 70}'::jsonb),
    ('PKG-COLD', '冷链包材库区', 'PKG', 33, 8000::numeric, '个', '{"demo": true, "area": "B区", "temperature": "常温", "humidityMax": 70}'::jsonb),
    ('FG-STD', '常规成品库区', 'FG', 21, 1800::numeric, '盒', '{"demo": true, "area": "C区", "temperature": "-18C"}'::jsonb),
    ('FG-NEW', '新品成品库区', 'FG', 23, 2400::numeric, '盒', '{"demo": true, "area": "D区", "temperature": "-18C"}'::jsonb)
)
INSERT INTO scm.warehouses (code, name, parent_id, level, sort, status, capacity, unit, properties, created_by)
SELECT
  a.code,
  a.name,
  p.id,
  2,
  a.sort,
  '启用',
  a.capacity,
  a.unit,
  a.properties,
  'system'
FROM area_specs a
JOIN scm.warehouses p ON p.code = a.parent_code
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    level = EXCLUDED.level,
    sort = EXCLUDED.sort,
    status = EXCLUDED.status,
    capacity = EXCLUDED.capacity,
    unit = EXCLUDED.unit,
    properties = COALESCE(scm.warehouses.properties, '{}'::jsonb) || EXCLUDED.properties,
    updated_at = now();

WITH location_map(location_code, area_code, sort, layout_zone) AS (
  VALUES
    ('RM-A01', 'RM-COLD', 12, '冷冻原料主库位'),
    ('RM-A02', 'RM-COLD', 13, '冷冻原料新品库位'),
    ('RM-B01', 'RM-AUX', 15, '辅料常温主库位'),
    ('PKG-A01', 'PKG-INNER', 32, '内包装主库位'),
    ('PKG-A02', 'PKG-COLD', 34, '冷链包材主库位'),
    ('FG-C01', 'FG-STD', 22, '常规成品主库位'),
    ('FG-C02', 'FG-NEW', 24, '新品成品主库位')
)
UPDATE scm.warehouses loc
SET parent_id = area.id,
    level = 3,
    sort = m.sort,
    properties = COALESCE(loc.properties, '{}'::jsonb)
      || jsonb_build_object('demo', true, 'layout_zone', m.layout_zone),
    updated_at = now()
FROM location_map m
JOIN scm.warehouses area ON area.code = m.area_code
WHERE loc.code = m.location_code;

UPDATE scm.warehouses
SET capacity = CASE code
      WHEN 'RM-A01' THEN 2200
      WHEN 'RM-A02' THEN 1800
      WHEN 'RM-B01' THEN 2200
      WHEN 'PKG-A01' THEN 25000
      WHEN 'PKG-A02' THEN 24000
      WHEN 'FG-C01' THEN 1800
      WHEN 'FG-C02' THEN 2600
      ELSE capacity
    END,
    unit = CASE code
      WHEN 'FG-C01' THEN '盒'
      ELSE unit
    END,
    updated_at = now()
WHERE code IN ('RM-A01', 'RM-A02', 'RM-B01', 'PKG-A01', 'PKG-A02', 'FG-C01', 'FG-C02');

-- Additional empty locations make the spatial view look closer to a real warehouse.
WITH location_specs(code, name, parent_code, sort, capacity, unit, properties) AS (
  VALUES
    ('RM-A03', '原料冷冻A03库位', 'RM-COLD', 16, 1400::numeric, '千克', '{"demo": true, "temperature": "-18C", "layout_zone": "预留冷冻库位"}'::jsonb),
    ('RM-B02', '辅料B02库位', 'RM-AUX', 17, 700::numeric, '千克', '{"demo": true, "temperature": "常温", "layout_zone": "辅料预留库位"}'::jsonb),
    ('PKG-A03', '包材A03库位', 'PKG-INNER', 36, 6000::numeric, '个', '{"demo": true, "temperature": "常温", "layout_zone": "外箱预留库位"}'::jsonb),
    ('PKG-B01', '冷链包材B01库位', 'PKG-COLD', 37, 5000::numeric, '个', '{"demo": true, "temperature": "常温", "layout_zone": "冰袋预留库位"}'::jsonb),
    ('FG-C03', '成品C03库位', 'FG-STD', 26, 1000::numeric, '盒', '{"demo": true, "temperature": "-18C", "layout_zone": "促销备货库位"}'::jsonb),
    ('FG-D01', '成品D01库位', 'FG-NEW', 27, 1200::numeric, '盒', '{"demo": true, "temperature": "-18C", "layout_zone": "新品预留库位"}'::jsonb)
)
INSERT INTO scm.warehouses (code, name, parent_id, level, sort, status, capacity, unit, properties, created_by)
SELECT
  l.code,
  l.name,
  p.id,
  3,
  l.sort,
  '启用',
  l.capacity,
  l.unit,
  l.properties,
  'system'
FROM location_specs l
JOIN scm.warehouses p ON p.code = l.parent_code
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    level = EXCLUDED.level,
    sort = EXCLUDED.sort,
    status = EXCLUDED.status,
    capacity = EXCLUDED.capacity,
    unit = EXCLUDED.unit,
    properties = COALESCE(scm.warehouses.properties, '{}'::jsonb) || EXCLUDED.properties,
    updated_at = now();

DELETE FROM scm.warehouse_layouts l
USING scm.warehouses w
WHERE w.id = l.warehouse_id
  AND w.level <> 1;

WITH ids AS (
  SELECT code, id
  FROM scm.warehouses
),
layout_rows AS (
  SELECT
    (SELECT id FROM ids WHERE code = 'RM') AS warehouse_id,
    1200 AS canvas_width,
    760 AS canvas_height,
    jsonb_build_array(
      jsonb_build_object(
        'area_id', (SELECT id FROM ids WHERE code = 'RM-COLD'),
        'area_code', 'RM-COLD',
        'area_name', '原料冷冻库区',
        'shapes', jsonb_build_array(
          jsonb_build_object('shape_type','area','code','RM-COLD','x',40,'y',40,'width',1080,'height',600,'warehouse_id',(SELECT id FROM ids WHERE code = 'RM-COLD'),'level',2,'name','原料冷冻库区','text_ratio',0.045),
          jsonb_build_object('shape_type','location','code','RM-A01','x',90,'y',120,'width',300,'height',160,'rows',4,'cols',6,'warehouse_id',(SELECT id FROM ids WHERE code = 'RM-A01'),'level',3,'name','原料冷冻A01库位','area_id',(SELECT id FROM ids WHERE code = 'RM-COLD'),'text_ratio',0.11),
          jsonb_build_object('shape_type','location','code','RM-A02','x',430,'y',120,'width',300,'height',160,'rows',4,'cols',6,'warehouse_id',(SELECT id FROM ids WHERE code = 'RM-A02'),'level',3,'name','原料冷冻A02库位','area_id',(SELECT id FROM ids WHERE code = 'RM-COLD'),'text_ratio',0.11),
          jsonb_build_object('shape_type','location','code','RM-A03','x',770,'y',120,'width',260,'height',160,'rows',4,'cols',5,'warehouse_id',(SELECT id FROM ids WHERE code = 'RM-A03'),'level',3,'name','原料冷冻A03库位','area_id',(SELECT id FROM ids WHERE code = 'RM-COLD'),'text_ratio',0.11),
          jsonb_build_object('shape_type','location','code','RM-DOCK','x',90,'y',360,'width',280,'height',110,'rows',1,'cols',1,'warehouse_id',NULL,'level',NULL,'name','收货暂存区','area_id',(SELECT id FROM ids WHERE code = 'RM-COLD'),'text_ratio',0.12),
          jsonb_build_object('shape_type','location','code','RM-QC','x',420,'y',360,'width',220,'height',110,'rows',1,'cols',1,'warehouse_id',NULL,'level',NULL,'name','来料抽检区','area_id',(SELECT id FROM ids WHERE code = 'RM-COLD'),'text_ratio',0.12),
          jsonb_build_object('shape_type','location','code','RM-AISLE','x',700,'y',360,'width',330,'height',110,'rows',1,'cols',1,'warehouse_id',NULL,'level',NULL,'name','叉车通道','area_id',(SELECT id FROM ids WHERE code = 'RM-COLD'),'text_ratio',0.12)
        )
      ),
      jsonb_build_object(
        'area_id', (SELECT id FROM ids WHERE code = 'RM-AUX'),
        'area_code', 'RM-AUX',
        'area_name', '辅料常温库区',
        'shapes', jsonb_build_array(
          jsonb_build_object('shape_type','area','code','RM-AUX','x',40,'y',40,'width',1080,'height',600,'warehouse_id',(SELECT id FROM ids WHERE code = 'RM-AUX'),'level',2,'name','辅料常温库区','text_ratio',0.045),
          jsonb_build_object('shape_type','location','code','RM-B01','x',100,'y',120,'width',360,'height',170,'rows',4,'cols',6,'warehouse_id',(SELECT id FROM ids WHERE code = 'RM-B01'),'level',3,'name','辅料B01库位','area_id',(SELECT id FROM ids WHERE code = 'RM-AUX'),'text_ratio',0.11),
          jsonb_build_object('shape_type','location','code','RM-B02','x',520,'y',120,'width',320,'height',170,'rows',3,'cols',5,'warehouse_id',(SELECT id FROM ids WHERE code = 'RM-B02'),'level',3,'name','辅料B02库位','area_id',(SELECT id FROM ids WHERE code = 'RM-AUX'),'text_ratio',0.11),
          jsonb_build_object('shape_type','location','code','RM-PREP','x',100,'y',360,'width',260,'height',110,'rows',1,'cols',1,'warehouse_id',NULL,'level',NULL,'name','拆包复核台','area_id',(SELECT id FROM ids WHERE code = 'RM-AUX'),'text_ratio',0.12),
          jsonb_build_object('shape_type','location','code','RM-AUX-AISLE','x',420,'y',360,'width',420,'height',110,'rows',1,'cols',1,'warehouse_id',NULL,'level',NULL,'name','常温通道','area_id',(SELECT id FROM ids WHERE code = 'RM-AUX'),'text_ratio',0.12)
        )
      )
    ) AS layers,
    '{"demo": true, "source": "warehouse_layout_demo_data_20260530", "thresholds": [50, 80, 100], "temperatureRequired": true, "legend": {"green": "低占用", "amber": "中占用", "orange": "高占用", "red": "超容量"}}'::jsonb AS rules
  UNION ALL
  SELECT
    (SELECT id FROM ids WHERE code = 'PKG') AS warehouse_id,
    1200 AS canvas_width,
    760 AS canvas_height,
    jsonb_build_array(
      jsonb_build_object(
        'area_id', (SELECT id FROM ids WHERE code = 'PKG-INNER'),
        'area_code', 'PKG-INNER',
        'area_name', '内包装库区',
        'shapes', jsonb_build_array(
          jsonb_build_object('shape_type','area','code','PKG-INNER','x',40,'y',40,'width',1080,'height',600,'warehouse_id',(SELECT id FROM ids WHERE code = 'PKG-INNER'),'level',2,'name','内包装库区','text_ratio',0.045),
          jsonb_build_object('shape_type','location','code','PKG-A01','x',90,'y',120,'width',320,'height',170,'rows',4,'cols',7,'warehouse_id',(SELECT id FROM ids WHERE code = 'PKG-A01'),'level',3,'name','包材A01库位','area_id',(SELECT id FROM ids WHERE code = 'PKG-INNER'),'text_ratio',0.11),
          jsonb_build_object('shape_type','location','code','PKG-A03','x',460,'y',120,'width',320,'height',170,'rows',4,'cols',7,'warehouse_id',(SELECT id FROM ids WHERE code = 'PKG-A03'),'level',3,'name','包材A03库位','area_id',(SELECT id FROM ids WHERE code = 'PKG-INNER'),'text_ratio',0.11),
          jsonb_build_object('shape_type','location','code','PKG-QC','x',830,'y',120,'width',190,'height',170,'rows',1,'cols',1,'warehouse_id',NULL,'level',NULL,'name','包材抽检区','area_id',(SELECT id FROM ids WHERE code = 'PKG-INNER'),'text_ratio',0.12),
          jsonb_build_object('shape_type','location','code','PKG-DOCK','x',90,'y',370,'width',380,'height',110,'rows',1,'cols',1,'warehouse_id',NULL,'level',NULL,'name','到货暂存月台','area_id',(SELECT id FROM ids WHERE code = 'PKG-INNER'),'text_ratio',0.12),
          jsonb_build_object('shape_type','location','code','PKG-AISLE','x',540,'y',370,'width',480,'height',110,'rows',1,'cols',1,'warehouse_id',NULL,'level',NULL,'name','拣配通道','area_id',(SELECT id FROM ids WHERE code = 'PKG-INNER'),'text_ratio',0.12)
        )
      ),
      jsonb_build_object(
        'area_id', (SELECT id FROM ids WHERE code = 'PKG-COLD'),
        'area_code', 'PKG-COLD',
        'area_name', '冷链包材库区',
        'shapes', jsonb_build_array(
          jsonb_build_object('shape_type','area','code','PKG-COLD','x',40,'y',40,'width',1080,'height',600,'warehouse_id',(SELECT id FROM ids WHERE code = 'PKG-COLD'),'level',2,'name','冷链包材库区','text_ratio',0.045),
          jsonb_build_object('shape_type','location','code','PKG-A02','x',90,'y',120,'width',330,'height',170,'rows',4,'cols',7,'warehouse_id',(SELECT id FROM ids WHERE code = 'PKG-A02'),'level',3,'name','包材A02库位','area_id',(SELECT id FROM ids WHERE code = 'PKG-COLD'),'text_ratio',0.11),
          jsonb_build_object('shape_type','location','code','PKG-B01','x',480,'y',120,'width',330,'height',170,'rows',4,'cols',7,'warehouse_id',(SELECT id FROM ids WHERE code = 'PKG-B01'),'level',3,'name','冷链包材B01库位','area_id',(SELECT id FROM ids WHERE code = 'PKG-COLD'),'text_ratio',0.11),
          jsonb_build_object('shape_type','location','code','PKG-FREEZE','x',90,'y',370,'width',300,'height',110,'rows',1,'cols',1,'warehouse_id',NULL,'level',NULL,'name','冰袋周转区','area_id',(SELECT id FROM ids WHERE code = 'PKG-COLD'),'text_ratio',0.12),
          jsonb_build_object('shape_type','location','code','PKG-AISLE-B','x',460,'y',370,'width',360,'height',110,'rows',1,'cols',1,'warehouse_id',NULL,'level',NULL,'name','发运通道','area_id',(SELECT id FROM ids WHERE code = 'PKG-COLD'),'text_ratio',0.12)
        )
      )
    ) AS layers,
    '{"demo": true, "source": "warehouse_layout_demo_data_20260530", "thresholds": [50, 80, 100], "fireproof": true, "humidityMax": 70, "legend": {"green": "低占用", "amber": "中占用", "orange": "高占用", "red": "超容量"}}'::jsonb AS rules
  UNION ALL
  SELECT
    (SELECT id FROM ids WHERE code = 'FG') AS warehouse_id,
    1200 AS canvas_width,
    760 AS canvas_height,
    jsonb_build_array(
      jsonb_build_object(
        'area_id', (SELECT id FROM ids WHERE code = 'FG-STD'),
        'area_code', 'FG-STD',
        'area_name', '常规成品库区',
        'shapes', jsonb_build_array(
          jsonb_build_object('shape_type','area','code','FG-STD','x',40,'y',40,'width',1080,'height',600,'warehouse_id',(SELECT id FROM ids WHERE code = 'FG-STD'),'level',2,'name','常规成品库区','text_ratio',0.045),
          jsonb_build_object('shape_type','location','code','FG-C01','x',90,'y',120,'width',330,'height',180,'rows',4,'cols',6,'warehouse_id',(SELECT id FROM ids WHERE code = 'FG-C01'),'level',3,'name','成品C01库位','area_id',(SELECT id FROM ids WHERE code = 'FG-STD'),'text_ratio',0.11),
          jsonb_build_object('shape_type','location','code','FG-C03','x',480,'y',120,'width',330,'height',180,'rows',4,'cols',6,'warehouse_id',(SELECT id FROM ids WHERE code = 'FG-C03'),'level',3,'name','成品C03库位','area_id',(SELECT id FROM ids WHERE code = 'FG-STD'),'text_ratio',0.11),
          jsonb_build_object('shape_type','location','code','FG-SHIP','x',90,'y',380,'width',320,'height',110,'rows',1,'cols',1,'warehouse_id',NULL,'level',NULL,'name','成品发货暂存','area_id',(SELECT id FROM ids WHERE code = 'FG-STD'),'text_ratio',0.12),
          jsonb_build_object('shape_type','location','code','FG-AISLE','x',470,'y',380,'width',360,'height',110,'rows',1,'cols',1,'warehouse_id',NULL,'level',NULL,'name','出库通道','area_id',(SELECT id FROM ids WHERE code = 'FG-STD'),'text_ratio',0.12)
        )
      ),
      jsonb_build_object(
        'area_id', (SELECT id FROM ids WHERE code = 'FG-NEW'),
        'area_code', 'FG-NEW',
        'area_name', '新品成品库区',
        'shapes', jsonb_build_array(
          jsonb_build_object('shape_type','area','code','FG-NEW','x',40,'y',40,'width',1080,'height',600,'warehouse_id',(SELECT id FROM ids WHERE code = 'FG-NEW'),'level',2,'name','新品成品库区','text_ratio',0.045),
          jsonb_build_object('shape_type','location','code','FG-C02','x',90,'y',120,'width',330,'height',180,'rows',4,'cols',6,'warehouse_id',(SELECT id FROM ids WHERE code = 'FG-C02'),'level',3,'name','成品C02库位','area_id',(SELECT id FROM ids WHERE code = 'FG-NEW'),'text_ratio',0.11),
          jsonb_build_object('shape_type','location','code','FG-D01','x',480,'y',120,'width',330,'height',180,'rows',4,'cols',6,'warehouse_id',(SELECT id FROM ids WHERE code = 'FG-D01'),'level',3,'name','成品D01库位','area_id',(SELECT id FROM ids WHERE code = 'FG-NEW'),'text_ratio',0.11),
          jsonb_build_object('shape_type','location','code','FG-QC','x',90,'y',380,'width',260,'height',110,'rows',1,'cols',1,'warehouse_id',NULL,'level',NULL,'name','成品放行区','area_id',(SELECT id FROM ids WHERE code = 'FG-NEW'),'text_ratio',0.12),
          jsonb_build_object('shape_type','location','code','FG-PICK','x',420,'y',380,'width',390,'height',110,'rows',1,'cols',1,'warehouse_id',NULL,'level',NULL,'name','电商拣货区','area_id',(SELECT id FROM ids WHERE code = 'FG-NEW'),'text_ratio',0.12)
        )
      )
    ) AS layers,
    '{"demo": true, "source": "warehouse_layout_demo_data_20260530", "thresholds": [50, 80, 100], "temperatureRequired": true, "legend": {"green": "低占用", "amber": "中占用", "orange": "高占用", "red": "超容量"}}'::jsonb AS rules
)
INSERT INTO scm.warehouse_layouts (warehouse_id, canvas_width, canvas_height, layers, rules)
SELECT warehouse_id, canvas_width, canvas_height, layers, rules
FROM layout_rows
WHERE warehouse_id IS NOT NULL
ON CONFLICT (warehouse_id) DO UPDATE
SET canvas_width = EXCLUDED.canvas_width,
    canvas_height = EXCLUDED.canvas_height,
    layers = EXCLUDED.layers,
    rules = EXCLUDED.rules,
    updated_at = now();

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
