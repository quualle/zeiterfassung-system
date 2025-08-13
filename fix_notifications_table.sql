-- Bereinigtes Skript für notifications_zeiterfassung Tabelle

-- Erstelle Tabelle falls nicht vorhanden
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

-- Indizes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications_zeiterfassung(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications_zeiterfassung(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications_zeiterfassung(read);

-- RLS aktivieren
ALTER TABLE notifications_zeiterfassung ENABLE ROW LEVEL SECURITY;

-- Lösche existierende Policies und erstelle neu
DO $$ 
BEGIN
    -- Lösche existierende Policies falls vorhanden
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications_zeiterfassung' AND policyname = 'Alle können Benachrichtigungen lesen') THEN
        DROP POLICY "Alle können Benachrichtigungen lesen" ON notifications_zeiterfassung;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications_zeiterfassung' AND policyname = 'Alle können Benachrichtigungen erstellen') THEN
        DROP POLICY "Alle können Benachrichtigungen erstellen" ON notifications_zeiterfassung;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications_zeiterfassung' AND policyname = 'Alle können Benachrichtigungen aktualisieren') THEN
        DROP POLICY "Alle können Benachrichtigungen aktualisieren" ON notifications_zeiterfassung;
    END IF;
END $$;

-- Erstelle Policies neu
CREATE POLICY "Alle können Benachrichtigungen lesen" 
  ON notifications_zeiterfassung FOR SELECT 
  USING (true);

CREATE POLICY "Alle können Benachrichtigungen erstellen" 
  ON notifications_zeiterfassung FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Alle können Benachrichtigungen aktualisieren" 
  ON notifications_zeiterfassung FOR UPDATE 
  USING (true);

-- Status-Check
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications_zeiterfassung') THEN
        RAISE NOTICE '✓ notifications_zeiterfassung Tabelle erfolgreich erstellt/vorhanden';
    ELSE
        RAISE NOTICE '✗ Fehler: notifications_zeiterfassung Tabelle konnte nicht erstellt werden';
    END IF;
END $$;