-- 确保 system_configs 表存在 (根据之前的代码推断表结构)
-- 如果表结构不同，请根据实际情况调整
CREATE TABLE IF NOT EXISTS public.system_configs (
    key text PRIMARY KEY,
    value jsonb,
    description text
);

-- 启用 RLS (如果尚未启用)
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

-- 允许 authenticated 角色读取配置 (根据业务需求调整，通常前端需要读取某些配置)
-- 注意：敏感配置如 API Key 通常不应直接暴露给前端，除非前端直连
-- 如果是前端直连方案 (Scheme A)，则必须允许读取。
-- 如果是后端代理方案 (Scheme B)，则应限制读取。
-- 这里假设是前端直连方案，或者通过受控的 RPC 函数获取。

-- 插入或更新 GLM-4.6V API Key
INSERT INTO public.system_configs (key, value, description)
VALUES (
    'ai_glm_config',
    '{
        "provider": "zhipu",
        "model": "glm-4.6v",
        "api_key": "",
        "api_url": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        "thinking": {
            "type": "enabled"
        },
        "agents": {
            "enterprise_analyst": {
                "model": "glm-4.6v",
                "temperature": 0.2,
                "top_p": 0.8,
                "max_tokens": 4096,
                "tools_whitelist": ["echarts"]
            },
            "worker_assistant": {
                "model": "glm-4.6v",
                "temperature": 0.3,
                "top_p": 0.9,
                "max_tokens": 4096,
                "tools_whitelist": ["form-template", "translate", "map-locate"]
            },
            "workflow_orchestrator": {
                "model": "glm-4.6v",
                "temperature": 0.1,
                "top_p": 0.7,
                "max_tokens": 6144,
                "tools_whitelist": ["workflow-meta", "bpmn-xml", "mermaid"]
            }
        }
    }'::jsonb,
    '智谱 AI GLM-4.6V 模型配置'
)
ON CONFLICT (key) 
DO UPDATE SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description;

-- [WARNING] 安全提示：
-- 1. 在生产环境中，API Key 属于敏感信息。
-- 2. 如果采用前端直连 (Scheme A)，API Key 将暴露给所有能访问此配置的用户。
-- 3. 建议配合 RLS 策略，只允许特定角色的用户（如 admin）读取此配置，
--    或者封装一个 PostgreSQL 函数 (RPC) 来获取 Key，而不是直接暴露表权限。

-- 示例：创建一个只读的安全视图或函数供前端调用（如果需要）
-- CREATE OR REPLACE FUNCTION get_ai_config() RETURNS jsonb AS $$
--     SELECT value FROM system_configs WHERE key = 'ai_glm_config';
-- $$ LANGUAGE sql SECURITY DEFINER;
