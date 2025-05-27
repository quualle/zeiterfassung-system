-- Tabelle für Benachrichtigungen
CREATE TABLE IF NOT EXISTS notifications_zeiterfassung (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users_zeiterfassung(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('auto_clock_out', 'general')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  read BOOLEAN DEFAULT FALSE,
  related_employee_id UUID REFERENCES users_zeiterfassung(id) ON DELETE SET NULL,
  related_employee_name VARCHAR(255)
);

-- Index für bessere Performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications_zeiterfassung(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications_zeiterfassung(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications_zeiterfassung(read);

-- RLS Policies
ALTER TABLE notifications_zeiterfassung ENABLE ROW LEVEL SECURITY;

-- Policy: Nutzer können nur ihre eigenen Benachrichtigungen sehen
CREATE POLICY "Users can view own notifications" ON notifications_zeiterfassung
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- Policy: Nutzer können ihre eigenen Benachrichtigungen als gelesen markieren
CREATE POLICY "Users can update own notifications" ON notifications_zeiterfassung
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Policy: System kann Benachrichtigungen erstellen (für alle Nutzer)
CREATE POLICY "System can insert notifications" ON notifications_zeiterfassung
  FOR INSERT WITH CHECK (true);