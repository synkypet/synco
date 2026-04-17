-- SYNCO — Database Triggers
-- Este arquivo contém os gatilhos vinculados às tabelas.
--
-- INSTRUÇÕES:
-- 1. Identifique os triggers ativos no Supabase Dashboard -> Database -> Triggers.
-- 2. Copie os comandos "CREATE TRIGGER..." para automatismos como:
--    - update_updated_at_column em todas as tabelas.
--    - on_auth_user_created para provisionar perfis.

-- Cole abaixo seus triggers:
[
  {
    "trigger_definition": "CREATE TRIGGER update_automation_routes_updated_at BEFORE UPDATE ON automation_routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"
  },
  {
    "trigger_definition": "CREATE TRIGGER update_automation_sources_updated_at BEFORE UPDATE ON automation_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"
  },
  {
    "trigger_definition": "CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"
  },
  {
    "trigger_definition": "CREATE TRIGGER update_channel_secrets_updated_at BEFORE UPDATE ON channel_secrets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"
  },
  {
    "trigger_definition": "CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"
  },
  {
    "trigger_definition": "CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"
  },
  {
    "trigger_definition": "CREATE TRIGGER update_destination_lists_updated_at BEFORE UPDATE ON destination_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"
  },
  {
    "trigger_definition": "CREATE TRIGGER tr_earnings_imports_updated_at BEFORE UPDATE ON earnings_imports FOR EACH ROW EXECUTE FUNCTION handle_updated_at()"
  },
  {
    "trigger_definition": "CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"
  },
  {
    "trigger_definition": "CREATE TRIGGER update_marketplaces_updated_at BEFORE UPDATE ON marketplaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"
  },
  {
    "trigger_definition": "CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"
  },
  {
    "trigger_definition": "CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"
  },
  {
    "trigger_definition": "CREATE TRIGGER update_send_jobs_updated_at BEFORE UPDATE ON send_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"
  },
  {
    "trigger_definition": "CREATE TRIGGER tr_templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION handle_updated_at()"
  },
  {
    "trigger_definition": "CREATE TRIGGER update_user_marketplaces_updated_at BEFORE UPDATE ON user_marketplaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()"
  }
]