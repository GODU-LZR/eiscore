#!/bin/bash
# Test PostgREST access to semantic tables
TOKEN=$(node /home/lzr/eiscore/scripts/gen-test-token.js 2>/dev/null)

echo "=== ontology_table_semantics via PostgREST ==="
curl -s "http://localhost:3000/ontology_table_semantics?is_active=eq.true&select=table_schema,table_name,semantic_name,tags&limit=3" \
  -H "Accept: application/json" \
  -H "Accept-Profile: public" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo ""
echo "=== ontology_column_semantics via PostgREST ==="
curl -s "http://localhost:3000/ontology_column_semantics?is_active=eq.true&select=table_schema,table_name,column_name,semantic_name,semantic_class&limit=3" \
  -H "Accept: application/json" \
  -H "Accept-Profile: public" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
