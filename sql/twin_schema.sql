-- ============================================================
-- Employee Digital Twin Agent — 数据持久化 Schema
-- 目标 schema: app_data（与现有业务数据共用 schema）
-- 依赖: PostgreSQL 14+, pgcrypto (gen_random_uuid)
-- ============================================================

-- 1. 会话表：每位员工可创建多个对话会话
CREATE TABLE IF NOT EXISTS app_data.twin_sessions (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id   TEXT        NOT NULL,                 -- 员工 username（JWT claim）
  title         TEXT        DEFAULT '新对话',
  model         TEXT        DEFAULT 'glm-4.6v',
  summary       TEXT        DEFAULT '',               -- AI 自动生成的会话摘要
  message_count INTEGER     DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. 消息表：记录完整对话历史
CREATE TABLE IF NOT EXISTS app_data.twin_messages (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    UUID        NOT NULL REFERENCES app_data.twin_sessions(id) ON DELETE CASCADE,
  role          TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content       TEXT        NOT NULL DEFAULT '',
  tool_calls    JSONB,                                -- 本轮 AI 产生的工具调用列表
  metadata      JSONB,                                -- 附带的文件摘要、上下文等
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 3. 工具调用日志：追踪 ReAct 循环中每一步工具执行
CREATE TABLE IF NOT EXISTS app_data.twin_tool_logs (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    UUID        NOT NULL REFERENCES app_data.twin_sessions(id) ON DELETE CASCADE,
  message_id    UUID        REFERENCES app_data.twin_messages(id) ON DELETE SET NULL,
  tool_name     TEXT        NOT NULL,
  tool_input    JSONB,
  tool_output   JSONB,
  duration_ms   INTEGER,
  success       BOOLEAN     DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 4. 个人知识库文件：支持文档、图片等多模态文件
CREATE TABLE IF NOT EXISTS app_data.twin_knowledge_files (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id   TEXT        NOT NULL,
  file_name     TEXT        NOT NULL,
  file_type     TEXT,                                 -- MIME type
  file_size     INTEGER     DEFAULT 0,
  content_text  TEXT        DEFAULT '',                -- 提取的文本内容（用于全文检索）
  content_b64   TEXT        DEFAULT '',                -- Base64 原始内容（小文件/图片）
  tags          TEXT[]      DEFAULT '{}',
  summary       TEXT        DEFAULT '',                -- AI 生成的文件摘要
  metadata      JSONB       DEFAULT '{}',              -- 扩展元信息（页数、来源等）
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_twin_sessions_employee
  ON app_data.twin_sessions(employee_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_twin_messages_session
  ON app_data.twin_messages(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_twin_tool_logs_session
  ON app_data.twin_tool_logs(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_twin_knowledge_employee
  ON app_data.twin_knowledge_files(employee_id, updated_at DESC);

-- 全文检索索引（simple 分词器对中文友好）
CREATE INDEX IF NOT EXISTS idx_twin_knowledge_fts
  ON app_data.twin_knowledge_files
  USING gin(to_tsvector('simple', COALESCE(content_text, '') || ' ' || COALESCE(file_name, '')));

-- ============================================================
-- RLS — 每位员工只能看到自己的数据
-- ============================================================
ALTER TABLE app_data.twin_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_data.twin_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_data.twin_tool_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_data.twin_knowledge_files   ENABLE ROW LEVEL SECURITY;

-- twin_sessions: 员工只能访问自己的会话
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'twin_sessions_own' AND tablename = 'twin_sessions') THEN
    EXECUTE 'CREATE POLICY twin_sessions_own ON app_data.twin_sessions FOR ALL USING (employee_id = current_setting(''request.jwt.claims'', true)::json->>''username'')';
  END IF;
END $$;

-- twin_messages: 员工只能访问自己会话中的消息
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'twin_messages_own' AND tablename = 'twin_messages') THEN
    EXECUTE 'CREATE POLICY twin_messages_own ON app_data.twin_messages FOR ALL USING (
      session_id IN (SELECT id FROM app_data.twin_sessions WHERE employee_id = current_setting(''request.jwt.claims'', true)::json->>''username'')
    )';
  END IF;
END $$;

-- twin_tool_logs: 同上
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'twin_tool_logs_own' AND tablename = 'twin_tool_logs') THEN
    EXECUTE 'CREATE POLICY twin_tool_logs_own ON app_data.twin_tool_logs FOR ALL USING (
      session_id IN (SELECT id FROM app_data.twin_sessions WHERE employee_id = current_setting(''request.jwt.claims'', true)::json->>''username'')
    )';
  END IF;
END $$;

-- twin_knowledge_files: 员工只能访问自己的知识库
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'twin_knowledge_own' AND tablename = 'twin_knowledge_files') THEN
    EXECUTE 'CREATE POLICY twin_knowledge_own ON app_data.twin_knowledge_files FOR ALL USING (employee_id = current_setting(''request.jwt.claims'', true)::json->>''username'')';
  END IF;
END $$;

-- ============================================================
-- 授权 web_user
-- ============================================================
GRANT USAGE  ON SCHEMA app_data TO web_user;
GRANT ALL    ON app_data.twin_sessions          TO web_user;
GRANT ALL    ON app_data.twin_messages          TO web_user;
GRANT ALL    ON app_data.twin_tool_logs         TO web_user;
GRANT ALL    ON app_data.twin_knowledge_files   TO web_user;

-- ============================================================
-- 便捷视图：员工数字分身概览（不含消息详情）
-- ============================================================
CREATE OR REPLACE VIEW app_data.v_twin_overview AS
SELECT
  s.id            AS session_id,
  s.employee_id,
  s.title,
  s.summary,
  s.message_count,
  s.model,
  s.created_at,
  s.updated_at,
  (SELECT COUNT(*) FROM app_data.twin_knowledge_files k WHERE k.employee_id = s.employee_id) AS kb_file_count
FROM app_data.twin_sessions s
ORDER BY s.updated_at DESC;

GRANT SELECT ON app_data.v_twin_overview TO web_user;

-- Done
