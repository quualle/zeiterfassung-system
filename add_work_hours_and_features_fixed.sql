-- Bereinigtes SQL-Skript für neue Features
-- Dieses Skript prüft vor dem Erstellen, ob Objekte bereits existieren

-- Erweitere users_zeiterfassung um Soll-Arbeitszeit
ALTER TABLE users_zeiterfassung 
ADD COLUMN IF NOT EXISTS weekly_hours DECIMAL(5,2) DEFAULT NULL;

-- Setze Soll-Arbeitszeiten für bestehende Mitarbeiter
UPDATE users_zeiterfassung SET weekly_hours = 40 WHERE name = 'Christiane Rohde';
UPDATE users_zeiterfassung SET weekly_hours = 40 WHERE name = 'Ines Cürten';
-- Emilia hat keine feste Stundenzahl, bleibt NULL

-- Tabelle für Krankmeldungen
CREATE TABLE IF NOT EXISTS sick_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_zeiterfassung(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  certificate_required BOOLEAN DEFAULT FALSE,
  certificate_submitted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users_zeiterfassung(id),
  CONSTRAINT sick_leave_dates CHECK (end_date >= start_date)
);

-- Tabelle für Urlaube
CREATE TABLE IF NOT EXISTS vacations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_zeiterfassung(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reason TEXT,
  days_count INTEGER NOT NULL,
  approved_by UUID REFERENCES users_zeiterfassung(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT vacation_dates CHECK (end_date >= start_date)
);

-- Tabelle für Wochenendbereitschaften
CREATE TABLE IF NOT EXISTS weekend_duties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_zeiterfassung(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  compensation DECIMAL(10,2) DEFAULT 75.00,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users_zeiterfassung(id),
  CONSTRAINT weekend_duty_dates CHECK (
    EXTRACT(DOW FROM start_date) = 6 AND -- Samstag
    EXTRACT(DOW FROM end_date) = 0 AND -- Sonntag
    end_date = start_date + INTERVAL '1 day'
  )
);

-- Indizes für bessere Performance
CREATE INDEX IF NOT EXISTS idx_sick_leaves_user_id ON sick_leaves(user_id);
CREATE INDEX IF NOT EXISTS idx_sick_leaves_dates ON sick_leaves(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_vacations_user_id ON vacations(user_id);
CREATE INDEX IF NOT EXISTS idx_vacations_dates ON vacations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_vacations_status ON vacations(status);
CREATE INDEX IF NOT EXISTS idx_weekend_duties_user_id ON weekend_duties(user_id);
CREATE INDEX IF NOT EXISTS idx_weekend_duties_dates ON weekend_duties(start_date);

-- RLS Policies
ALTER TABLE sick_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekend_duties ENABLE ROW LEVEL SECURITY;

-- Lösche existierende Policies falls vorhanden und erstelle sie neu
DO $$ 
BEGIN
    -- Policies für sick_leaves
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sick_leaves' AND policyname = 'Alle können Krankmeldungen lesen') THEN
        DROP POLICY "Alle können Krankmeldungen lesen" ON sick_leaves;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sick_leaves' AND policyname = 'Alle können Krankmeldungen erstellen') THEN
        DROP POLICY "Alle können Krankmeldungen erstellen" ON sick_leaves;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sick_leaves' AND policyname = 'Alle können Krankmeldungen aktualisieren') THEN
        DROP POLICY "Alle können Krankmeldungen aktualisieren" ON sick_leaves;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sick_leaves' AND policyname = 'Alle können Krankmeldungen löschen') THEN
        DROP POLICY "Alle können Krankmeldungen löschen" ON sick_leaves;
    END IF;

    -- Policies für vacations
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vacations' AND policyname = 'Alle können Urlaube lesen') THEN
        DROP POLICY "Alle können Urlaube lesen" ON vacations;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vacations' AND policyname = 'Alle können Urlaube erstellen') THEN
        DROP POLICY "Alle können Urlaube erstellen" ON vacations;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vacations' AND policyname = 'Alle können Urlaube aktualisieren') THEN
        DROP POLICY "Alle können Urlaube aktualisieren" ON vacations;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vacations' AND policyname = 'Alle können Urlaube löschen') THEN
        DROP POLICY "Alle können Urlaube löschen" ON vacations;
    END IF;

    -- Policies für weekend_duties
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekend_duties' AND policyname = 'Alle können Bereitschaften lesen') THEN
        DROP POLICY "Alle können Bereitschaften lesen" ON weekend_duties;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekend_duties' AND policyname = 'Alle können Bereitschaften erstellen') THEN
        DROP POLICY "Alle können Bereitschaften erstellen" ON weekend_duties;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekend_duties' AND policyname = 'Alle können Bereitschaften aktualisieren') THEN
        DROP POLICY "Alle können Bereitschaften aktualisieren" ON weekend_duties;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekend_duties' AND policyname = 'Alle können Bereitschaften löschen') THEN
        DROP POLICY "Alle können Bereitschaften löschen" ON weekend_duties;
    END IF;
END $$;

-- Erstelle Policies neu
CREATE POLICY "Alle können Krankmeldungen lesen" ON sick_leaves FOR SELECT USING (true);
CREATE POLICY "Alle können Krankmeldungen erstellen" ON sick_leaves FOR INSERT WITH CHECK (true);
CREATE POLICY "Alle können Krankmeldungen aktualisieren" ON sick_leaves FOR UPDATE USING (true);
CREATE POLICY "Alle können Krankmeldungen löschen" ON sick_leaves FOR DELETE USING (true);

CREATE POLICY "Alle können Urlaube lesen" ON vacations FOR SELECT USING (true);
CREATE POLICY "Alle können Urlaube erstellen" ON vacations FOR INSERT WITH CHECK (true);
CREATE POLICY "Alle können Urlaube aktualisieren" ON vacations FOR UPDATE USING (true);
CREATE POLICY "Alle können Urlaube löschen" ON vacations FOR DELETE USING (true);

CREATE POLICY "Alle können Bereitschaften lesen" ON weekend_duties FOR SELECT USING (true);
CREATE POLICY "Alle können Bereitschaften erstellen" ON weekend_duties FOR INSERT WITH CHECK (true);
CREATE POLICY "Alle können Bereitschaften aktualisieren" ON weekend_duties FOR UPDATE USING (true);
CREATE POLICY "Alle können Bereitschaften löschen" ON weekend_duties FOR DELETE USING (true);

-- Prüfe ob die Tabellen korrekt erstellt wurden
DO $$
BEGIN
    RAISE NOTICE 'Tabellen-Status:';
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sick_leaves') THEN
        RAISE NOTICE '✓ sick_leaves Tabelle existiert';
    ELSE
        RAISE NOTICE '✗ sick_leaves Tabelle fehlt';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vacations') THEN
        RAISE NOTICE '✓ vacations Tabelle existiert';
    ELSE
        RAISE NOTICE '✗ vacations Tabelle fehlt';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'weekend_duties') THEN
        RAISE NOTICE '✓ weekend_duties Tabelle existiert';
    ELSE
        RAISE NOTICE '✗ weekend_duties Tabelle fehlt';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users_zeiterfassung' AND column_name = 'weekly_hours') THEN
        RAISE NOTICE '✓ weekly_hours Spalte in users_zeiterfassung existiert';
    ELSE
        RAISE NOTICE '✗ weekly_hours Spalte in users_zeiterfassung fehlt';
    END IF;
END $$;