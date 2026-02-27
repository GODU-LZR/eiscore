#!/bin/bash
docker exec eiscore-db psql -U postgres -d eiscore -c "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%employee%' OR table_name LIKE '%emp%' ORDER BY table_schema, table_name;"
