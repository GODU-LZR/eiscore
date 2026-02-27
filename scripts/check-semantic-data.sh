#!/bin/bash
echo "=== ontology_table_semantics columns ==="
docker exec eiscore-db psql -U postgres -d eiscore -t -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ontology_table_semantics' ORDER BY ordinal_position;"

echo "=== ontology_column_semantics columns ==="
docker exec eiscore-db psql -U postgres -d eiscore -t -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='ontology_column_semantics' ORDER BY ordinal_position;"

echo "=== ontology_table_semantics sample (3 rows) ==="
docker exec eiscore-db psql -U postgres -d eiscore -t -c "SELECT table_schema, table_name, semantic_name, tags FROM public.ontology_table_semantics WHERE is_active=true LIMIT 5;"

echo "=== ontology_column_semantics sample (5 rows) ==="
docker exec eiscore-db psql -U postgres -d eiscore -t -c "SELECT table_schema, table_name, column_name, semantic_name, semantic_class, data_type FROM public.ontology_column_semantics WHERE is_active=true LIMIT 5;"

echo "=== v_permission_ontology sample (3 rows) ==="
docker exec eiscore-db psql -U postgres -d eiscore -t -c "SELECT code, scope, semantic_kind, entity_key, action_key FROM public.v_permission_ontology LIMIT 5;"

echo "=== table semantics total count ==="
docker exec eiscore-db psql -U postgres -d eiscore -t -c "SELECT count(*) FROM public.ontology_table_semantics WHERE is_active=true;"

echo "=== column semantics total count ==="
docker exec eiscore-db psql -U postgres -d eiscore -t -c "SELECT count(*) FROM public.ontology_column_semantics WHERE is_active=true;"
