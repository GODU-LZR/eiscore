-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (c) 2026 林志荣
--
-- First low-risk public Schema retirement.  The debug view has no product
-- consumer and exposed raw JWT claim text plus the effective database role
-- through PostgREST.  It is removed instead of receiving a compatibility
-- facade because a debug endpoint is not an application contract.

DROP VIEW IF EXISTS public.debug_me;

DELETE FROM public.ontology_table_semantics
WHERE table_schema = 'public'
  AND table_name = 'debug_me';
