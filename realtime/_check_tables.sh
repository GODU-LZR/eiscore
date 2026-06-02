#!/bin/bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 林志荣

docker exec eiscore-db psql -U postgres -d eiscore -c "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%employee%' OR table_name LIKE '%emp%' ORDER BY table_schema, table_name;"
