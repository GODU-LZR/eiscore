-- ========================================
-- App Center Schema
-- Purpose: Manage Workflow, Data, and Flash Apps
-- ========================================

CREATE SCHEMA IF NOT EXISTS app_center;

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS app_center.categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE app_center.categories IS 'App categories (Workflow/Data/Flash/Custom)';

-- 2. Apps Table
CREATE TABLE IF NOT EXISTS app_center.apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id INT REFERENCES app_center.categories(id) ON DELETE SET NULL,
    app_type VARCHAR(20) NOT NULL CHECK (app_type IN ('workflow', 'data', 'flash', 'custom')),
    
    -- Code/Config Storage
    source_code JSONB, -- For Flash apps: { files: { 'App.vue': '...', 'style.css': '...' } }
    config JSONB, -- For Data apps: { table: 'employees', columns: [...] }
    bpmn_xml TEXT, -- For Workflow apps: BPMN 2.0 XML definition
    
    -- Metadata
    icon VARCHAR(50) DEFAULT '📦',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    version VARCHAR(20) DEFAULT '1.0.0',
    
    -- Ownership & Permissions
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE app_center.apps IS 'Central registry for all app types';
COMMENT ON COLUMN app_center.apps.source_code IS 'Flash app source files (Vue components, styles)';
COMMENT ON COLUMN app_center.apps.config IS 'Data app configuration (table mappings, filters)';
COMMENT ON COLUMN app_center.apps.bpmn_xml IS 'Workflow BPMN definition XML';

-- 3. Published Routes Table
CREATE TABLE IF NOT EXISTS app_center.published_routes (
    id SERIAL PRIMARY KEY,
    app_id UUID REFERENCES app_center.apps(id) ON DELETE CASCADE,
    route_path VARCHAR(200) NOT NULL UNIQUE, -- e.g., /apps/flash/contact-form
    mount_point VARCHAR(100), -- For micro-frontend mounting
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE app_center.published_routes IS 'Routes for published apps (accessible to end users)';

-- 4. Workflow State Mappings (BPMN -> Data States)
CREATE TABLE IF NOT EXISTS app_center.workflow_state_mappings (
    id SERIAL PRIMARY KEY,
    workflow_app_id UUID REFERENCES app_center.apps(id) ON DELETE CASCADE,
    bpmn_task_id VARCHAR(100) NOT NULL, -- e.g., 'Task_ManagerApproval'
    target_table VARCHAR(100), -- e.g., 'hr.leave_requests'
    state_field VARCHAR(50), -- e.g., 'approval_status'
    state_value VARCHAR(100), -- e.g., 'PENDING_REVIEW'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workflow_app_id, bpmn_task_id)
);

COMMENT ON TABLE app_center.workflow_state_mappings IS 'Map BPMN tasks to database state transitions';

-- 5. Execution Logs (For Workflow Runtime)
CREATE TABLE IF NOT EXISTS app_center.execution_logs (
    id SERIAL PRIMARY KEY,
    app_id UUID REFERENCES app_center.apps(id) ON DELETE CASCADE,
    execution_id UUID DEFAULT gen_random_uuid(),
    task_id VARCHAR(100),
    status VARCHAR(20) CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    executed_by TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE app_center.execution_logs IS 'Runtime execution logs for workflows';

-- ========================================
-- Row Level Security (RLS)
-- ========================================

ALTER TABLE app_center.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_center.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_center.published_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_center.workflow_state_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_center.execution_logs ENABLE ROW LEVEL SECURITY;

-- Grants for API roles
GRANT USAGE ON SCHEMA app_center TO web_anon, web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_center.apps TO web_user;
GRANT SELECT ON app_center.apps TO web_anon;
GRANT SELECT ON app_center.categories TO web_anon, web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_center.published_routes TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_center.workflow_state_mappings TO web_user;
GRANT SELECT ON app_center.execution_logs TO web_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app_center TO web_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_center GRANT USAGE, SELECT ON SEQUENCES TO web_user;

-- Policy 1: All authenticated users can read categories
DROP POLICY IF EXISTS "categories_select_policy" ON app_center.categories;
CREATE POLICY "categories_select_policy" ON app_center.categories
    FOR SELECT USING (true);

-- Policy 2: Users can view published apps or their own drafts
DROP POLICY IF EXISTS "apps_select_policy" ON app_center.apps;
CREATE POLICY "apps_select_policy" ON app_center.apps
    FOR SELECT USING (true);

-- Policy 3: Users can create apps
DROP POLICY IF EXISTS "apps_insert_policy" ON app_center.apps;
CREATE POLICY "apps_insert_policy" ON app_center.apps
    FOR INSERT WITH CHECK (
        (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
    );

-- Policy 4: Users can update their own apps
DROP POLICY IF EXISTS "apps_update_policy" ON app_center.apps;
CREATE POLICY "apps_update_policy" ON app_center.apps
    FOR UPDATE USING (
        (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
    );

-- Policy 4b: Users can delete apps
DROP POLICY IF EXISTS "apps_delete_policy" ON app_center.apps;
CREATE POLICY "apps_delete_policy" ON app_center.apps
    FOR DELETE USING (
        (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
        AND COALESCE(config ->> 'systemApp', '') <> 'ontology_workbench'
    );

-- Policy 5: Published routes are readable by all
DROP POLICY IF EXISTS "published_routes_select_policy" ON app_center.published_routes;
CREATE POLICY "published_routes_select_policy" ON app_center.published_routes
    FOR SELECT USING (is_active = true);

-- Policy 5b: Published routes write by super admin
DROP POLICY IF EXISTS "published_routes_insert_policy" ON app_center.published_routes;
CREATE POLICY "published_routes_insert_policy" ON app_center.published_routes
    FOR INSERT WITH CHECK (
        (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
    );

DROP POLICY IF EXISTS "published_routes_update_policy" ON app_center.published_routes;
CREATE POLICY "published_routes_update_policy" ON app_center.published_routes
    FOR UPDATE USING (
        (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
    )
    WITH CHECK (
        (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
    );

DROP POLICY IF EXISTS "published_routes_delete_policy" ON app_center.published_routes;
CREATE POLICY "published_routes_delete_policy" ON app_center.published_routes
    FOR DELETE USING (
        (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
    );

-- Policy 6: Workflow mappings read
DROP POLICY IF EXISTS "workflow_mappings_select_policy" ON app_center.workflow_state_mappings;
CREATE POLICY "workflow_mappings_select_policy" ON app_center.workflow_state_mappings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM app_center.apps 
            WHERE id = workflow_app_id
        )
    );

-- Policy 6b: Workflow mappings write by super admin
DROP POLICY IF EXISTS "workflow_mappings_insert_policy" ON app_center.workflow_state_mappings;
CREATE POLICY "workflow_mappings_insert_policy" ON app_center.workflow_state_mappings
    FOR INSERT WITH CHECK (
        (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
    );

DROP POLICY IF EXISTS "workflow_mappings_update_policy" ON app_center.workflow_state_mappings;
CREATE POLICY "workflow_mappings_update_policy" ON app_center.workflow_state_mappings
    FOR UPDATE USING (
        (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
    )
    WITH CHECK (
        (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
    );

DROP POLICY IF EXISTS "workflow_mappings_delete_policy" ON app_center.workflow_state_mappings;
CREATE POLICY "workflow_mappings_delete_policy" ON app_center.workflow_state_mappings
    FOR DELETE USING (
        (current_setting('request.jwt.claims', true)::json ->> 'app_role') = 'super_admin'
    );

-- Policy 7: Execution logs readable by app creator or executor
DROP POLICY IF EXISTS "execution_logs_select_policy" ON app_center.execution_logs;
CREATE POLICY "execution_logs_select_policy" ON app_center.execution_logs
    FOR SELECT USING (
        current_setting('request.jwt.claim.app_role', true) = 'super_admin'
    );

-- ========================================
-- Seed Data
-- ========================================

INSERT INTO app_center.categories (name, icon, sort_order) VALUES
    ('Workflow Apps', '🔀', 1),
    ('Data Apps', '📊', 2),
    ('Flash Apps', '⚡', 3),
    ('Custom Apps', '🛠️', 4)
ON CONFLICT (name) DO NOTHING;

-- Seed sample apps for initial visibility
INSERT INTO app_center.apps (name, description, category_id, app_type, status, icon, version, created_by, updated_by)
SELECT '示例工作流', '审批示例流程', 1, 'workflow', 'published', '🔀', '1.0.0', 'system', 'system'
WHERE NOT EXISTS (SELECT 1 FROM app_center.apps WHERE name = '示例工作流');

INSERT INTO app_center.apps (name, description, category_id, app_type, status, icon, version, created_by, updated_by)
SELECT '示例数据应用', '员工数据配置示例', 2, 'data', 'draft', '📊', '1.0.0', 'system', 'system'
WHERE NOT EXISTS (SELECT 1 FROM app_center.apps WHERE name = '示例数据应用');

INSERT INTO app_center.apps (name, description, category_id, app_type, status, icon, version, created_by, updated_by)
SELECT '示例闪搭', 'AI 生成应用示例', 3, 'flash', 'draft', '⚡', '1.0.0', 'system', 'system'
WHERE NOT EXISTS (SELECT 1 FROM app_center.apps WHERE name = '示例闪搭');

-- ========================================
-- Helper Functions
-- ========================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION app_center.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apps_update_timestamp ON app_center.apps;
CREATE TRIGGER apps_update_timestamp
    BEFORE UPDATE ON app_center.apps
    FOR EACH ROW
    EXECUTE FUNCTION app_center.update_timestamp();

DROP TRIGGER IF EXISTS categories_update_timestamp ON app_center.categories;
CREATE TRIGGER categories_update_timestamp
    BEFORE UPDATE ON app_center.categories
    FOR EACH ROW
    EXECUTE FUNCTION app_center.update_timestamp();

-- Function to validate BPMN XML (basic check)
CREATE OR REPLACE FUNCTION app_center.validate_bpmn_xml(xml_content TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Basic validation: check for required BPMN namespace
    RETURN xml_content LIKE '%xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"%';
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique route path
CREATE OR REPLACE FUNCTION app_center.generate_route_path(app_id UUID, app_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    base_path VARCHAR;
    unique_suffix VARCHAR;
BEGIN
    base_path := '/apps/' || app_type || '/' || SUBSTRING(app_id::TEXT FROM 1 FOR 8);
    unique_suffix := '';
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM app_center.published_routes WHERE route_path = base_path || unique_suffix) LOOP
        unique_suffix := '-' || (RANDOM() * 1000)::INT;
    END LOOP;
    
    RETURN base_path || unique_suffix;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Grants
-- ========================================

GRANT USAGE ON SCHEMA app_center TO web_anon, web_user;
GRANT SELECT ON app_center.categories TO web_anon, web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_center.apps TO web_user;
GRANT SELECT ON app_center.published_routes TO web_anon, web_user;
GRANT SELECT ON app_center.workflow_state_mappings TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_center.execution_logs TO web_user;
