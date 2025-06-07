-- Email Blacklist Table
CREATE TABLE IF NOT EXISTS email_blacklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE
);

-- Index for faster lookups
CREATE INDEX idx_email_blacklist_email ON email_blacklist(email);
CREATE INDEX idx_email_blacklist_active ON email_blacklist(is_active);

-- RLS Policies
ALTER TABLE email_blacklist ENABLE ROW LEVEL SECURITY;

-- Only admins can view blacklist
CREATE POLICY "Admins can view email blacklist"
  ON email_blacklist FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Only admins can insert
CREATE POLICY "Admins can insert to email blacklist"
  ON email_blacklist FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Only admins can update
CREATE POLICY "Admins can update email blacklist"
  ON email_blacklist FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Only admins can delete
CREATE POLICY "Admins can delete from email blacklist"
  ON email_blacklist FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Insert initial blacklist from CSV
INSERT INTO email_blacklist (email, reason) VALUES
  ('anfrage@danzigerbetreuung.eu', 'Agentur'),
  ('anfragen.katowice@secawo.com', 'Agentur'),
  ('anfragen@proseca.pl', 'Agentur'),
  ('anfragen@secawo.com', 'Agentur'),
  ('biuro@centrum24opieka.pl', 'Agentur'),
  ('biuro@euroservice.net.pl', 'Agentur'),
  ('biuro@poloniacare24.pl', 'Agentur'),
  ('biuro@safework24.pl', 'Agentur'),
  ('crm@mbwpersonal.pl', 'Agentur'),
  ('info@auxiliavera.com', 'Agentur'),
  ('info@felizajob.de', 'Agentur'),
  ('info@pmhp.pl', 'Agentur'),
  ('info@vista-hr.pl', 'Agentur'),
  ('kode@carema.pl', 'Agentur'),
  ('kontakt@bonviro.pl', 'Agentur'),
  ('kontakt@medea-opieka.pl', 'Agentur'),
  ('mzawadzka@prohuman.pl', 'Agentur'),
  ('neuanfragen@medira.eu', 'Agentur'),
  ('neuanfragen@pflegeengel.pl', 'Agentur'),
  ('neuanfragenzg@medipe.com', 'Agentur'),
  ('office@avanti-medic.eu', 'Agentur'),
  ('opieka@pomocwdomu.pl', 'Agentur'),
  ('partner@secawo.com', 'Agentur'),
  ('pfs@vitanas.pl', 'Agentur'),
  ('phfs@scandicare24.de', 'Agentur'),
  ('phfs@senioport.de', 'Agentur'),
  ('rekrutacja@alana.pl', 'Agentur'),
  ('teamps@medipe.com', 'Agentur')
ON CONFLICT (email) DO NOTHING;