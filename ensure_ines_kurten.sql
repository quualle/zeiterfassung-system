-- Stelle sicher, dass Ines Kürten in der Datenbank existiert und korrekt konfiguriert ist

-- Erst prüfen, ob sie bereits existiert
DO $$
DECLARE
    user_exists BOOLEAN;
    user_role TEXT;
BEGIN
    -- Prüfe ob Ines Kürten existiert
    SELECT EXISTS(
        SELECT 1 FROM users_zeiterfassung 
        WHERE LOWER(name) = 'ines kürten'
    ) INTO user_exists;
    
    IF user_exists THEN
        -- Hole die aktuelle Rolle
        SELECT role INTO user_role 
        FROM users_zeiterfassung 
        WHERE LOWER(name) = 'ines kürten';
        
        -- Wenn sie als Admin markiert ist, ändere zu employee
        IF user_role = 'admin' THEN
            UPDATE users_zeiterfassung 
            SET 
                role = 'employee',
                weekly_hours = 40  -- Standard 40 Stunden pro Woche
            WHERE LOWER(name) = 'ines kürten';
            
            RAISE NOTICE '✓ Ines Kürten von Admin zu Employee geändert';
        ELSE
            -- Stelle sicher, dass weekly_hours gesetzt ist
            UPDATE users_zeiterfassung 
            SET weekly_hours = COALESCE(weekly_hours, 40)
            WHERE LOWER(name) = 'ines kürten' AND weekly_hours IS NULL;
            
            RAISE NOTICE '✓ Ines Kürten existiert bereits als Employee';
        END IF;
    ELSE
        -- Füge Ines Kürten hinzu, wenn sie nicht existiert
        INSERT INTO users_zeiterfassung (name, role, pin, weekly_hours, created_at)
        VALUES ('Ines Kürten', 'employee', '1234', 40, NOW());
        
        RAISE NOTICE '✓ Ines Kürten wurde zur Datenbank hinzugefügt';
    END IF;
END $$;

-- Zeige alle Mitarbeiter, die in der Statistik erscheinen sollten
SELECT 
    name,
    role,
    weekly_hours,
    CASE 
        WHEN role = 'admin' THEN 'Wird NICHT in Statistik angezeigt'
        ELSE 'Wird in Statistik angezeigt'
    END as statistik_status
FROM users_zeiterfassung
WHERE name IN ('Christiane Rohde', 'Emilia Rathmann', 'Ines Kürten')
ORDER BY name;