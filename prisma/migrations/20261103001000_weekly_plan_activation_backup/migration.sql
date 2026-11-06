-- Preserve legacy settings before switching to the new weekly allocation.
CREATE TABLE wg_hosting.legacy_duty_settings (
  duty_id text PRIMARY KEY,
  prior_rotation_interval text NOT NULL,
  prior_name text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE wg_hosting.legacy_duty_settings FROM PUBLIC;
ALTER TABLE wg_hosting.legacy_duty_settings ENABLE ROW LEVEL SECURITY;
