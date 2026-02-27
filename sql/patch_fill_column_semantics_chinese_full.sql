-- Full Chinese enrichment for column-level semantics
-- Scope: public.ontology_column_semantics only
-- No auth / permission / RLS change.

BEGIN;

WITH translated AS (
  SELECT
    o.table_schema,
    o.table_name,
    o.column_name,
    (
      SELECT string_agg(
        CASE lower(tok)
          WHEN 'id' THEN U&'\6807\8BC6'
          WHEN 'name' THEN U&'\540D\79F0'
          WHEN 'code' THEN U&'\7F16\7801'
          WHEN 'type' THEN U&'\7C7B\578B'
          WHEN 'status' THEN U&'\72B6\6001'
          WHEN 'state' THEN U&'\72B6\6001'
          WHEN 'desc' THEN U&'\63CF\8FF0'
          WHEN 'description' THEN U&'\63CF\8FF0'
          WHEN 'summary' THEN U&'\6458\8981'
          WHEN 'extra' THEN U&'\6269\5C55'
          WHEN 'remark' THEN U&'\5907\6CE8'
          WHEN 'comment' THEN U&'\8BF4\660E'
          WHEN 'content' THEN U&'\5185\5BB9'
          WHEN 'doc' THEN U&'\6587\6863'
          WHEN 'document' THEN U&'\6587\6863'
          WHEN 'template' THEN U&'\6A21\677F'
          WHEN 'example' THEN U&'\793A\4F8B'
          WHEN 'title' THEN U&'\6807\9898'
          WHEN 'label' THEN U&'\6807\7B7E'
          WHEN 'value' THEN U&'\503C'
          WHEN 'key' THEN U&'\952E'
          WHEN 'flag' THEN U&'\6807\8BB0'
          WHEN 'mode' THEN U&'\6A21\5F0F'
          WHEN 'strategy' THEN U&'\7B56\7565'
          WHEN 'rule' THEN U&'\89C4\5219'
          WHEN 'rules' THEN U&'\89C4\5219'
          WHEN 'candidate' THEN U&'\5019\9009'
          WHEN 'can' THEN U&'\53EF'
          WHEN 'applicable' THEN U&'\9002\7528'
          WHEN 'available' THEN U&'\53EF\7528'
          WHEN 'current' THEN U&'\5F53\524D'
          WHEN 'actual' THEN U&'\5B9E\9645'
          WHEN 'target' THEN U&'\76EE\6807'
          WHEN 'diff' THEN U&'\5DEE\5F02'
          WHEN 'cross' THEN U&'\8DE8'
          WHEN 'full' THEN U&'\5168\91CF'
          WHEN 'temp' THEN U&'\4E34\65F6'
          WHEN 'test' THEN U&'\6D4B\8BD5'
          WHEN 'reset' THEN U&'\91CD\7F6E'
          WHEN 'edit' THEN U&'\7F16\8F91'
          WHEN 'action' THEN U&'\64CD\4F5C'
          WHEN 'entry' THEN U&'\6761\76EE'
          WHEN 'row' THEN U&'\884C'
          WHEN 'view' THEN U&'\89C6\56FE'
          WHEN 'canvas' THEN U&'\753B\5E03'
          WHEN 'layers' THEN U&'\56FE\5C42'
          WHEN 'height' THEN U&'\9AD8\5EA6'
          WHEN 'width' THEN U&'\5BBD\5EA6'
          WHEN 'size' THEN U&'\5927\5C0F'
          WHEN 'bytes' THEN U&'\5B57\8282'
          WHEN 'base' THEN U&'\57FA\7840'
          WHEN 'base64' THEN U&'\7F16\7801'
          WHEN 'mime' THEN U&'\7C7B\578B'
          WHEN 'filename' THEN U&'\6587\4EF6\540D'
          WHEN 'avatar' THEN U&'\5934\50CF'
          WHEN 'book' THEN U&'\53F0\8D26'
          WHEN 'path' THEN U&'\8DEF\5F84'
          WHEN 'route' THEN U&'\8DEF\7531'
          WHEN 'mount' THEN U&'\6302\8F7D'
          WHEN 'point' THEN U&'\70B9'
          WHEN 'url' THEN U&'\5730\5740'
          WHEN 'icon' THEN U&'\56FE\6807'
          WHEN 'version' THEN U&'\7248\672C'
          WHEN 'sort' THEN U&'\6392\5E8F'
          WHEN 'order' THEN U&'\987A\5E8F'
          WHEN 'priority' THEN U&'\4F18\5148\7EA7'
          WHEN 'is' THEN ''
          WHEN 'active' THEN U&'\542F\7528'
          WHEN 'enabled' THEN U&'\542F\7528'
          WHEN 'visible' THEN U&'\53EF\89C1'
          WHEN 'default' THEN U&'\9ED8\8BA4'
          WHEN 'required' THEN U&'\5FC5\586B'
          WHEN 'created' THEN U&'\521B\5EFA'
          WHEN 'updated' THEN U&'\66F4\65B0'
          WHEN 'executed' THEN U&'\6267\884C'
          WHEN 'started' THEN U&'\5F00\59CB'
          WHEN 'ended' THEN U&'\7ED3\675F'
          WHEN 'completed' THEN U&'\5B8C\6210'
          WHEN 'early' THEN U&'\65E9\5230'
          WHEN 'late' THEN U&'\8FDF\5230'
          WHEN 'absent' THEN U&'\7F3A\52E4'
          WHEN 'leave' THEN U&'\8BF7\5047'
          WHEN 'overtime' THEN U&'\52A0\73ED'
          WHEN 'ot' THEN U&'\52A0\73ED'
          WHEN 'grace' THEN U&'\5BBD\9650'
          WHEN 'break' THEN U&'\4F11\606F'
          WHEN 'deleted' THEN U&'\5220\9664'
          WHEN 'at' THEN U&'\65F6\95F4'
          WHEN 'by' THEN U&'\4EBA'
          WHEN 'date' THEN U&'\65E5\671F'
          WHEN 'day' THEN U&'\65E5'
          WHEN 'days' THEN U&'\5929'
          WHEN 'month' THEN U&'\6708'
          WHEN 'minutes' THEN U&'\5206\949F'
          WHEN 'min' THEN U&'\5206\949F'
          WHEN 'times' THEN U&'\6B21\6570'
          WHEN 'one' THEN U&'\4E00'
          WHEN 'two' THEN U&'\4E8C'
          WHEN 'three' THEN U&'\4E09'
          WHEN 'four' THEN U&'\56DB'
          WHEN 'five' THEN U&'\4E94'
          WHEN 'time' THEN U&'\65F6\95F4'
          WHEN 'start' THEN U&'\5F00\59CB'
          WHEN 'end' THEN U&'\7ED3\675F'
          WHEN 'source' THEN U&'\6765\6E90'
          WHEN 'actor' THEN U&'\64CD\4F5C\4EBA'
          WHEN 'from' THEN U&'\6765\6E90'
          WHEN 'to' THEN U&'\76EE\6807'
          WHEN 'input' THEN U&'\8F93\5165'
          WHEN 'output' THEN U&'\8F93\51FA'
          WHEN 'payload' THEN U&'\8F7D\8377'
          WHEN 'error' THEN U&'\9519\8BEF'
          WHEN 'message' THEN U&'\4FE1\606F'
          WHEN 'result' THEN U&'\7ED3\679C'
          WHEN 'data' THEN U&'\6570\636E'
          WHEN 'json' THEN U&'\914D\7F6E'
          WHEN 'config' THEN U&'\914D\7F6E'
          WHEN 'profile' THEN U&'\914D\7F6E\6863'
          WHEN 'schema' THEN U&'\6A21\5F0F'
          WHEN 'table' THEN U&'\8868'
          WHEN 'column' THEN U&'\5B57\6BB5'
          WHEN 'field' THEN U&'\5B57\6BB5'
          WHEN 'properties' THEN U&'\6269\5C55\5C5E\6027'
          WHEN 'meta' THEN U&'\5143\6570\636E'
          WHEN 'tenant' THEN U&'\79DF\6237'
          WHEN 'scope' THEN U&'\8303\56F4'
          WHEN 'module' THEN U&'\6A21\5757'
          WHEN 'app' THEN U&'\5E94\7528'
          WHEN 'business' THEN U&'\4E1A\52A1'
          WHEN 'workflow' THEN U&'\6D41\7A0B'
          WHEN 'instance' THEN U&'\5B9E\4F8B'
          WHEN 'task' THEN U&'\4EFB\52A1'
          WHEN 'event' THEN U&'\4E8B\4EF6'
          WHEN 'definition' THEN U&'\5B9A\4E49'
          WHEN 'bpmn' THEN U&'\6D41\7A0B\56FE'
          WHEN 'xml' THEN U&'\914D\7F6E'
          WHEN 'execution' THEN U&'\6267\884C'
          WHEN 'log' THEN U&'\65E5\5FD7'
          WHEN 'user' THEN U&'\7528\6237'
          WHEN 'users' THEN U&'\7528\6237'
          WHEN 'username' THEN U&'\7528\6237\540D'
          WHEN 'email' THEN U&'\90AE\7BB1'
          WHEN 'phone' THEN U&'\7535\8BDD'
          WHEN 'mobile' THEN U&'\624B\673A'
          WHEN 'password' THEN U&'\5BC6\7801'
          WHEN 'token' THEN U&'\4EE4\724C'
          WHEN 'secret' THEN U&'\5BC6\94A5'
          WHEN 'role' THEN U&'\89D2\8272'
          WHEN 'permission' THEN U&'\6743\9650'
          WHEN 'permissions' THEN U&'\6743\9650'
          WHEN 'acl' THEN U&'\8BBF\95EE\63A7\5236'
          WHEN 'dept' THEN U&'\90E8\95E8'
          WHEN 'department' THEN U&'\90E8\95E8'
          WHEN 'departments' THEN U&'\90E8\95E8'
          WHEN 'position' THEN U&'\5C97\4F4D'
          WHEN 'leader' THEN U&'\8D1F\8D23\4EBA'
          WHEN 'manager' THEN U&'\7BA1\7406\8005'
          WHEN 'org' THEN U&'\7EC4\7EC7'
          WHEN 'archive' THEN U&'\6863\6848'
          WHEN 'attendance' THEN U&'\8003\52E4'
          WHEN 'shift' THEN U&'\73ED\6B21'
          WHEN 'payroll' THEN U&'\85AA\8D44'
          WHEN 'salary' THEN U&'\5DE5\8D44'
          WHEN 'employee' THEN U&'\5458\5DE5'
          WHEN 'employees' THEN U&'\5458\5DE5'
          WHEN 'supplier' THEN U&'\4F9B\5E94\5546'
          WHEN 'purchase' THEN U&'\91C7\8D2D'
          WHEN 'production' THEN U&'\751F\4EA7'
          WHEN 'material' THEN U&'\7269\6599'
          WHEN 'materials' THEN U&'\7269\6599'
          WHEN 'raw' THEN U&'\539F\6599'
          WHEN 'inventory' THEN U&'\5E93\5B58'
          WHEN 'warehouse' THEN U&'\4ED3\5E93'
          WHEN 'batch' THEN U&'\6279\6B21'
          WHEN 'draft' THEN U&'\8349\7A3F'
          WHEN 'transaction' THEN U&'\6D41\6C34'
          WHEN 'check' THEN U&'\76D8\70B9'
          WHEN 'operator' THEN U&'\64CD\4F5C\4EBA'
          WHEN 'person' THEN U&'\4EBA\5458'
          WHEN 'io' THEN U&'\6536\53D1'
          WHEN 'in' THEN U&'\5165'
          WHEN 'out' THEN U&'\51FA'
          WHEN 'qty' THEN U&'\6570\91CF'
          WHEN 'quantity' THEN U&'\6570\91CF'
          WHEN 'amount' THEN U&'\91D1\989D'
          WHEN 'total' THEN U&'\5408\8BA1'
          WHEN 'count' THEN U&'\6570\91CF'
          WHEN 'capacity' THEN U&'\5BB9\91CF'
          WHEN 'level' THEN U&'\7EA7\522B'
          WHEN 'category' THEN U&'\5206\7C7B'
          WHEN 'categories' THEN U&'\5206\7C7B'
          WHEN 'dict' THEN U&'\5B57\5178'
          WHEN 'items' THEN U&'\6761\76EE'
          WHEN 'variables' THEN U&'\53D8\91CF'
          WHEN 'associated' THEN U&'\5173\8054'
          WHEN 'roles' THEN U&'\89D2\8272'
          WHEN 'approval' THEN U&'\5BA1\6279'
          WHEN 'locked' THEN U&'\9501\5B9A'
          WHEN 'price' THEN U&'\5355\4EF7'
          WHEN 'unit' THEN U&'\5355\4F4D'
          WHEN 'kg' THEN U&'\5343\514B'
          WHEN 'weight' THEN U&'\91CD\91CF'
          WHEN 'expiry' THEN U&'\6709\6548\671F'
          WHEN 'scan' THEN U&'\626B\7801'
          WHEN 'punch' THEN U&'\6253\5361'
          WHEN 'att' THEN U&'\8003\52E4'
          WHEN 'sha256' THEN U&'\6458\8981'
          WHEN 'before' THEN U&'\53D8\66F4\524D'
          WHEN 'after' THEN U&'\53D8\66F4\540E'
          WHEN 'related' THEN U&'\5173\8054'
          WHEN 'parent' THEN U&'\4E0A\7EA7'
          WHEN 'no' THEN U&'\7F16\53F7'
          WHEN 'number' THEN U&'\7F16\53F7'
          WHEN 'file' THEN U&'\6587\4EF6'
          WHEN 'files' THEN U&'\6587\4EF6'
          WHEN 'address' THEN U&'\5730\5740'
          WHEN 'geo' THEN U&'\5730\7406'
          WHEN 'lng' THEN U&'\7ECF\5EA6'
          WHEN 'lat' THEN U&'\7EAC\5EA6'
          ELSE tok
        END,
        ''
        ORDER BY ord
      )
      FROM unnest(regexp_split_to_array(o.column_name, '_')) WITH ORDINALITY AS x(tok, ord)
    ) AS raw_cn_name
  FROM public.ontology_column_semantics o
),
normalized AS (
  SELECT
    t.table_schema,
    t.table_name,
    t.column_name,
    CASE
      WHEN t.column_name ~ '^f_[0-9]+$'
        THEN format(U&'\5B57\6BB5\0025\0073', regexp_replace(t.column_name, '^f_', ''))
      WHEN t.column_name = 'id' THEN U&'\4E3B\952E\6807\8BC6'
      WHEN t.column_name = 'created_at' THEN U&'\521B\5EFA\65F6\95F4'
      WHEN t.column_name = 'updated_at' THEN U&'\66F4\65B0\65F6\95F4'
      WHEN t.column_name = 'deleted_at' THEN U&'\5220\9664\65F6\95F4'
      WHEN t.column_name = 'created_by' THEN U&'\521B\5EFA\4EBA'
      WHEN t.column_name = 'updated_by' THEN U&'\66F4\65B0\4EBA'
      WHEN t.column_name = 'deleted_by' THEN U&'\5220\9664\4EBA'
      WHEN t.column_name = 'workflow_instance_id' THEN U&'\6D41\7A0B\5B9E\4F8B\6807\8BC6'
      WHEN t.column_name ~* '_id$' AND t.raw_cn_name ~ '[^[:ascii:]]'
        THEN t.raw_cn_name
      WHEN t.raw_cn_name ~ '[^[:ascii:]]'
        THEN t.raw_cn_name
      ELSE format(U&'\5B57\6BB5\FF08\0025\0073\FF09', t.column_name)
    END AS final_cn_name
  FROM translated t
)
UPDATE public.ontology_column_semantics o
SET semantic_name = n.final_cn_name,
    semantic_description = format(
      U&'\8868\0025\0073\002E\0025\0073\7684\5B57\6BB5\201C\0025\0073\201D\8BED\4E49\4E2D\6587\8865\5168',
      o.table_schema,
      o.table_name,
      n.final_cn_name
    ),
    source = CASE
      WHEN o.source IN ('history_backfill', 'history_backfill_cn') THEN 'history_backfill_cn'
      ELSE o.source
    END,
    tags = CASE
      WHEN COALESCE(o.tags, '[]'::jsonb) @> '["lang:zh_CN"]'::jsonb THEN COALESCE(o.tags, '[]'::jsonb)
      ELSE COALESCE(o.tags, '[]'::jsonb) || to_jsonb('lang:zh_CN'::text)
    END,
    updated_at = now()
FROM normalized n
WHERE o.table_schema = n.table_schema
  AND o.table_name = n.table_name
  AND o.column_name = n.column_name;

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;

-- Validation
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE semantic_name ~ '[^[:ascii:]]') AS name_with_non_ascii,
  COUNT(*) FILTER (WHERE semantic_description ~ '[^[:ascii:]]') AS desc_with_non_ascii,
  COUNT(*) FILTER (WHERE semantic_name LIKE '%字段（%') AS fallback_name_rows
FROM public.ontology_column_semantics;
