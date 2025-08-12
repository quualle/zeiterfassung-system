-- Erstelle fehlende notifications_zeiterfassung Tabelle
CREATE TABLE IF NOT EXISTS notifications_zeiterfassung (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_zeiterfassung(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  read BOOLEAN DEFAULT FALSE,
  related_employee_id UUID REFERENCES users_zeiterfassung(id) ON DELETE SET NULL,
  related_employee_name VARCHAR(255),
  CONSTRAINT notifications_type_check CHECK (type IN ('auto_clock_out', 'general'))
);

-- Indizes für bessere Performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications_zeiterfassung(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications_zeiterfassung(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications_zeiterfassung(read);

-- RLS Policies (vereinfacht für öffentlichen Zugriff)
ALTER TABLE notifications_zeiterfassung ENABLE ROW LEVEL SECURITY;

-- Alle können Benachrichtigungen lesen
CREATE POLICY "Alle können Benachrichtigungen lesen" 
  ON notifications_zeiterfassung FOR SELECT 
  USING (true);

-- Alle können Benachrichtigungen erstellen
CREATE POLICY "Alle können Benachrichtigungen erstellen" 
  ON notifications_zeiterfassung FOR INSERT 
  WITH CHECK (true);

-- Alle können Benachrichtigungen aktualisieren
CREATE POLICY "Alle können Benachrichtigungen aktualisieren" 
  ON notifications_zeiterfassung FOR UPDATE 
  USING (true);

-- Prüfe ob work_time_rules Tabelle existiert, falls nicht, erstelle sie
CREATE TABLE IF NOT EXISTS work_time_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_zeiterfassung(id) ON DELETE CASCADE,
  earliest_login_time TIME NOT NULL DEFAULT '06:00:00',
  latest_logout_time TIME NOT NULL DEFAULT '20:00:00',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_work_time_rule UNIQUE (user_id)
);

-- Index für work_time_rules
CREATE INDEX IF NOT EXISTS idx_work_time_rules_user_id ON work_time_rules(user_id);

-- RLS für work_time_rules
ALTER TABLE work_time_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle können Arbeitszeit-Regeln lesen" 
  ON work_time_rules FOR SELECT 
  USING (true);

CREATE POLICY "Alle können Arbeitszeit-Regeln erstellen" 
  ON work_time_rules FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Alle können Arbeitszeit-Regeln aktualisieren" 
  ON work_time_rules FOR UPDATE 
  USING (true);

CREATE POLICY "Alle können Arbeitszeit-Regeln löschen" 
  ON work_time_rules FOR DELETE 
  USING (true);