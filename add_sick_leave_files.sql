-- Erweitere sick_leaves Tabelle um Datei-Uploads
ALTER TABLE sick_leaves 
ADD COLUMN IF NOT EXISTS file_urls TEXT[] DEFAULT '{}';

-- Füge Spalte für Dateinamen hinzu (für bessere UX)
ALTER TABLE sick_leaves 
ADD COLUMN IF NOT EXISTS file_names TEXT[] DEFAULT '{}';

-- Erstelle Storage Bucket Policy für Krankmeldungen
-- Dieser Bucket muss in Supabase Storage erstellt werden: "krankmeldungen"

-- Beispiel RLS Policies für Storage (müssen im Supabase Dashboard konfiguriert werden):
-- 1. Alle können Dateien hochladen (INSERT)
-- 2. Alle können Dateien lesen (SELECT)
-- 3. Admins können Dateien löschen (DELETE)

-- Status-Check
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sick_leaves' 
        AND column_name = 'file_urls'
    ) THEN
        RAISE NOTICE '✓ file_urls Spalte erfolgreich hinzugefügt';
    ELSE
        RAISE NOTICE '✗ file_urls Spalte konnte nicht hinzugefügt werden';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sick_leaves' 
        AND column_name = 'file_names'
    ) THEN
        RAISE NOTICE '✓ file_names Spalte erfolgreich hinzugefügt';
    ELSE
        RAISE NOTICE '✗ file_names Spalte konnte nicht hinzugefügt werden';
    END IF;
END $$;

-- Hinweis: Storage Bucket "krankmeldungen" muss manuell in Supabase erstellt werden
-- mit folgenden Einstellungen:
-- - Name: krankmeldungen
-- - Public: false (für bessere Sicherheit)
-- - Allowed MIME types: image/*, application/pdf
-- - Max file size: 10MB