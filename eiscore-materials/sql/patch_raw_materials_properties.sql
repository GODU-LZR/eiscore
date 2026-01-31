-- Add properties storage for dynamic columns in raw_materials
ALTER TABLE public.raw_materials
  ADD COLUMN IF NOT EXISTS properties jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();

COMMENT ON COLUMN public.raw_materials.properties IS '动态字段';
COMMENT ON COLUMN public.raw_materials.version IS '版本';
COMMENT ON COLUMN public.raw_materials.updated_at IS '更新时间';

-- Enable write policies for raw_materials
DROP POLICY IF EXISTS "Users can insert their own data" ON public.raw_materials;
DROP POLICY IF EXISTS "Users can update their own data" ON public.raw_materials;
DROP POLICY IF EXISTS "Users can delete their own data" ON public.raw_materials;

CREATE POLICY "Users can insert their own data" ON public.raw_materials
  FOR INSERT TO web_user
  WITH CHECK (created_by = (current_setting('request.jwt.claims', true)::json ->> 'username'));

CREATE POLICY "Users can update their own data" ON public.raw_materials
  FOR UPDATE TO web_user
  USING (created_by = (current_setting('request.jwt.claims', true)::json ->> 'username'))
  WITH CHECK (created_by = (current_setting('request.jwt.claims', true)::json ->> 'username'));

CREATE POLICY "Users can delete their own data" ON public.raw_materials
  FOR DELETE TO web_user
  USING (created_by = (current_setting('request.jwt.claims', true)::json ->> 'username'));
