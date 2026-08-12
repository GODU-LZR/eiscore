-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣

-- Minimal enterprise baseline for a fresh EISCore deployment.
-- Deliberately contains no legacy demo/customer data.

BEGIN;

INSERT INTO scm.warehouses (
    code,
    name,
    level,
    status,
    properties,
    created_by
)
VALUES (
    'JLY-MAIN',
    '君乐缘主仓库',
    1,
    '启用',
    jsonb_build_object(
        'enterprise', '君乐缘台球工厂',
        'baseline', true
    ),
    'system'
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    status = EXCLUDED.status,
    properties = COALESCE(scm.warehouses.properties, '{}'::jsonb) || EXCLUDED.properties;

COMMIT;
