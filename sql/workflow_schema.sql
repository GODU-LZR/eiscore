CREATE SCHEMA IF NOT EXISTS workflow;

-- 1. 流程定义表 (存设计图)
CREATE TABLE IF NOT EXISTS workflow.definitions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    bpmn_xml TEXT NOT NULL,
    associated_table TEXT,  -- 关联的业务表名, e.g., 'scm.materials'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 流程实例表 (存运行状态)
CREATE TABLE IF NOT EXISTS workflow.instances (
    id SERIAL PRIMARY KEY,
    definition_id INT REFERENCES workflow.definitions(id),
    business_key TEXT,      -- 业务数据ID, e.g., 物资ID
    current_task_id TEXT,   -- 当前停留在 BPMN 的哪个节点 ID
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED
    variables JSONB DEFAULT '{}'::jsonb
);

-- 3. 事件通知触发器
CREATE OR REPLACE FUNCTION workflow.notify_instance_change()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('workflow_event', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workflow_instances_notify ON workflow.instances;
CREATE TRIGGER workflow_instances_notify
AFTER INSERT OR UPDATE ON workflow.instances
FOR EACH ROW EXECUTE FUNCTION workflow.notify_instance_change();