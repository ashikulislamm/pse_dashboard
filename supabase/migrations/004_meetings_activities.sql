-- 004_meetings_activities.sql
-- Structured meetings and non-monetary activities

CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  pipeline_id uuid REFERENCES pipelines(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  status meeting_status NOT NULL DEFAULT 'scheduled',
  description text,
  owner_id uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (contact_id IS NOT NULL OR pipeline_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type activity_type NOT NULL,
  class activity_class NOT NULL DEFAULT 'independent',
  title text NOT NULL,
  owner_id uuid NOT NULL REFERENCES profiles(id),
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  pipeline_id uuid REFERENCES pipelines(id) ON DELETE SET NULL,
  meeting_id uuid REFERENCES meetings(id) ON DELETE SET NULL,
  related_org_name text,
  status activity_status NOT NULL DEFAULT 'planned',
  remaining_work text,
  occurred_at timestamptz,
  due_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_status ON meetings(scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_meetings_owner ON meetings(owner_id);
CREATE INDEX IF NOT EXISTS idx_activities_owner_occurred ON activities(owner_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_class ON activities(class);
