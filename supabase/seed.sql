-- supabase/seed.sql
-- Reference configuration data for PSE CRM & Performance Dashboard

INSERT INTO teams (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Private Sector Engagement (PSE)')
ON CONFLICT (name) DO NOTHING;

INSERT INTO settings (key, value)
VALUES
  ('base_currency', 'BDT'),
  ('fiscal_year_start_month', '1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO currencies (code, name)
VALUES
  ('BDT', 'Bangladeshi Taka'),
  ('USD', 'US Dollar'),
  ('EUR', 'Euro'),
  ('GBP', 'British Pound')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO fx_rates (currency, rate_to_base, effective_from)
VALUES
  ('BDT', 1.000000, '2026-01-01'),
  ('USD', 120.000000, '2026-01-01'),
  ('EUR', 130.000000, '2026-01-01'),
  ('GBP', 152.000000, '2026-01-01')
ON CONFLICT (currency, effective_from) DO UPDATE SET rate_to_base = EXCLUDED.rate_to_base;

INSERT INTO pipeline_stages (name, kind, position)
VALUES
  ('New', 'open', 1),
  ('Scoping', 'open', 2),
  ('Preparation', 'open', 3),
  ('Submitted', 'open', 4),
  ('Pending', 'open', 5),
  ('Won', 'won', 6),
  ('Lost', 'lost', 7),
  ('Abandoned', 'junk', 8)
ON CONFLICT (name) DO UPDATE
SET kind = EXCLUDED.kind,
    position = EXCLUDED.position;

INSERT INTO verticals (name)
VALUES
  ('DSP'),
  ('VBD'),
  ('Project')
ON CONFLICT (name) DO NOTHING;

INSERT INTO contribution_categories (name)
VALUES
  ('DSP'),
  ('SAC'),
  ('Disaster Campaign'),
  ('Project'),
  ('Event & Campaign'),
  ('General')
ON CONFLICT (name) DO NOTHING;

-- Map contribution categories to verticals: DSP -> DSP, Project -> Project, all others -> VBD
INSERT INTO category_vertical_map (category_id, vertical_id)
SELECT
  c.id,
  v.id
FROM contribution_categories c
JOIN verticals v ON (
  (c.name = 'DSP' AND v.name = 'DSP') OR
  (c.name = 'Project' AND v.name = 'Project') OR
  (c.name NOT IN ('DSP', 'Project') AND v.name = 'VBD')
)
ON CONFLICT (category_id) DO UPDATE SET vertical_id = EXCLUDED.vertical_id;
