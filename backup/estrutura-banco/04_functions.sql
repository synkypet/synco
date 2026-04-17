-- SYNCO — Funções e RPCs (PostgreSQL)
-- Este arquivo armazena as lógicas de banco (PL/pgSQL).
--
-- INSTRUÇÕES:
-- 1. Vá ao Supabase Dashboard -> Database -> Functions.
-- 2. Copie o código fonte (procedimental) de funções críticas, como:
--    - update_updated_at_column()
--    - handle_new_user()
--    - claim_channel_lock()
--    - release_channel_lock()
-- 3. Certifique-se de definir o "Security Definer" para funções que acessam auth.users.

-- Cole abaixo suas funções:
[
  {
    "schema_name": "public",
    "function_name": "claim_channel_lock",
    "definition": "CREATE OR REPLACE FUNCTION public.claim_channel_lock(p_channel_id uuid, p_worker_id text, p_lock_timeout interval DEFAULT '00:01:00'::interval)\n RETURNS boolean\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\r\nDECLARE\r\n    v_locked BOOLEAN;\r\nBEGIN\r\n    UPDATE public.channels\r\n    SET \r\n        processing_lock_at = NOW(),\r\n        processing_worker_id = p_worker_id\r\n    WHERE id = p_channel_id\r\n      AND (\r\n        processing_lock_at IS NULL \r\n        OR processing_lock_at < (NOW() - p_lock_timeout)\r\n        OR processing_worker_id = p_worker_id\r\n      )\r\n    RETURNING true INTO v_locked;\r\n\r\n    RETURN COALESCE(v_locked, false);\r\nEND;\r\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "claim_maintenance_lock",
    "definition": "CREATE OR REPLACE FUNCTION public.claim_maintenance_lock(p_lock_key text, p_worker_id text, p_timeout_seconds integer)\n RETURNS boolean\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\r\nDECLARE\r\n    v_now TIMESTAMPTZ := NOW();\r\n    v_locked_until TIMESTAMPTZ := v_now + (p_timeout_seconds || ' seconds')::INTERVAL;\r\nBEGIN\r\n    -- 1. Limpar locks expirados (auto-cleanup)\r\n    DELETE FROM public.maintenance_locks WHERE locked_until < v_now;\r\n\r\n    -- 2. Tentar inserir o novo lock\r\n    -- Se a chave já existir, o INSERT falhará (Unique Violation)\r\n    BEGIN\r\n        INSERT INTO public.maintenance_locks (key, worker_id, locked_until)\r\n        VALUES (p_lock_key, p_worker_id, v_locked_until);\r\n        RETURN TRUE;\r\n    EXCEPTION WHEN unique_violation THEN\r\n        RETURN FALSE;\r\n    END;\r\nEND;\r\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "handle_new_user",
    "definition": "CREATE OR REPLACE FUNCTION public.handle_new_user()\n RETURNS trigger\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\nBEGIN\n  INSERT INTO public.profiles (id, full_name, avatar_url, username)\n  VALUES (\n    NEW.id,\n    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),\n    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),\n    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1))\n  );\n  RETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "handle_updated_at",
    "definition": "CREATE OR REPLACE FUNCTION public.handle_updated_at()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\nBEGIN\n    NEW.updated_at = now();\n    RETURN NEW;\nEND;\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "release_channel_lock",
    "definition": "CREATE OR REPLACE FUNCTION public.release_channel_lock(p_channel_id uuid, p_worker_id text)\n RETURNS void\n LANGUAGE plpgsql\n SECURITY DEFINER\nAS $function$\r\nBEGIN\r\n    UPDATE public.channels\r\n    SET \r\n        processing_lock_at = NULL,\r\n        processing_worker_id = NULL\r\n    WHERE id = p_channel_id \r\n      AND processing_worker_id = p_worker_id;\r\nEND;\r\n$function$\n"
  },
  {
    "schema_name": "public",
    "function_name": "update_updated_at_column",
    "definition": "CREATE OR REPLACE FUNCTION public.update_updated_at_column()\n RETURNS trigger\n LANGUAGE plpgsql\nAS $function$\nBEGIN\n    NEW.updated_at = NOW();\n    RETURN NEW;\nEND;\n$function$\n"
  }
]