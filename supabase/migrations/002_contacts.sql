-- 002_contacts.sql
-- Contacts, channels, deduplication on normalized email & phone, and deferred >=1 channel constraint

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type contact_type NOT NULL,
  name text NOT NULL,
  organization_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  designation text,
  website text,
  industry text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (organization_id IS NULL OR organization_id <> id)
);

CREATE TABLE IF NOT EXISTS contact_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind channel_kind NOT NULL,
  value text NOT NULL,
  value_normalized text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  UNIQUE (kind, value_normalized)
);

CREATE INDEX IF NOT EXISTS idx_contacts_type_status ON contacts(type, status);
CREATE INDEX IF NOT EXISTS idx_contacts_owner_created ON contacts(owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_name_fts ON contacts USING gin (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_contact_channels_contact ON contact_channels(contact_id);

-- Deferred constraint trigger function: every existing contact must have >= 1 channel at transaction commit
CREATE OR REPLACE FUNCTION enforce_contact_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'contacts' THEN
    v_contact_id := NEW.id;
  ELSE
    v_contact_id := COALESCE(NEW.contact_id, OLD.contact_id);
  END IF;

  IF EXISTS (SELECT 1 FROM contacts WHERE id = v_contact_id)
     AND NOT EXISTS (SELECT 1 FROM contact_channels WHERE contact_id = v_contact_id) THEN
    RAISE EXCEPTION 'contact needs at least one email or phone';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS contact_min_channel_on_channels ON contact_channels;
CREATE CONSTRAINT TRIGGER contact_min_channel_on_channels
AFTER INSERT OR UPDATE OR DELETE ON contact_channels
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_contact_channel();

DROP TRIGGER IF EXISTS contact_min_channel_on_contacts ON contacts;
CREATE CONSTRAINT TRIGGER contact_min_channel_on_contacts
AFTER INSERT ON contacts
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_contact_channel();
