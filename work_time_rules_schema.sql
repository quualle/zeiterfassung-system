-- Create work_time_rules table
CREATE TABLE IF NOT EXISTS work_time_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  earliest_login_time TIME NOT NULL DEFAULT '08:00:00',
  latest_logout_time TIME NOT NULL DEFAULT '18:00:00',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('UTC'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('UTC'::text, now()) NOT NULL,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE work_time_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for work_time_rules
CREATE POLICY "Admin can view all work time rules" ON work_time_rules
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

CREATE POLICY "Admin can create work time rules" ON work_time_rules
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

CREATE POLICY "Admin can update work time rules" ON work_time_rules
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

CREATE POLICY "Admin can delete work time rules" ON work_time_rules
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('UTC'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for work_time_rules
CREATE TRIGGER update_work_time_rules_updated_at
  BEFORE UPDATE ON work_time_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add default work time rules for existing users (excluding admin)
INSERT INTO work_time_rules (user_id, earliest_login_time, latest_logout_time)
SELECT id, '08:00:00', '18:00:00'
FROM users
WHERE role != 'admin'
ON CONFLICT (user_id) DO NOTHING;