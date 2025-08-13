-- Stelle sicher, dass Ines Cürten (mit C!) in der Datenbank existiert und korrekt konfiguriert ist

-- Erst prüfen, ob sie bereits existiert
DO $$
DECLARE
    user_exists BOOLEAN;
    user_role TEXT;
BEGIN
    -- Prüfe ob Ines Cürten existiert
    SELECT EXISTS(
        SELECT 1 FROM users_zeiterfassung 
        WHERE LOWER(name) = 'ines cürten'
    ) INTO user_exists;
    
    IF user_exists THEN
        -- Hole die aktuelle Rolle
        SELECT role INTO user_role 
        FROM users_zeiterfassung 
        WHERE LOWER(name) = 'ines cürten';
        
        -- Wenn sie als Admin markiert ist, ändere zu employee
        IF user_role = 'admin' OR user_role IS NULL THEN
            UPDATE users_zeiterfassung 
            SET 
                role = 'employee',
                weekly_hours = 40  -- Standard 40 Stunden pro Woche wie Christiane
            WHERE LOWER(name) = 'ines cürten';
            
            RAISE NOTICE '✓ Ines Cürten von Admin zu Employee geändert';
        ELSE
            -- Stelle sicher, dass weekly_hours gesetzt ist
            UPDATE users_zeiterfassung 
            SET weekly_hours = COALESCE(weekly_hours, 40)
            WHERE LOWER(name) = 'ines cürten' AND weekly_hours IS NULL;
            
            RAISE NOTICE '✓ Ines Cürten existiert bereits als Employee';
        END IF;
    ELSE
        -- Füge Ines Cürten hinzu, wenn sie nicht existiert
        INSERT INTO users_zeiterfassung (name, role, pin, weekly_hours, created_at)
        VALUES ('Ines Cürten', 'employee', '1234', 40, NOW());
        
        RAISE NOTICE '✓ Ines Cürten wurde zur Datenbank hinzugefügt';
    END IF;
END $$;

-- Zeige alle Mitarbeiter, die in der Statistik erscheinen sollten
SELECT 
    name,
    role,
    weekly_hours,
    CASE 
        WHEN role = 'admin' THEN '❌ Wird NICHT in Statistik angezeigt (Admin)'
        WHEN role IS NULL THEN '❌ Wird NICHT in Statistik angezeigt (keine Rolle)'
        ELSE '✅ Wird in Statistik angezeigt'
    END as statistik_status
FROM users_zeiterfassung
WHERE LOWER(name) IN ('christiane rohde', 'emilia rathmann', 'ines cürten')
ORDER BY name;

-- Zeige ALLE Benutzer zur Übersicht
SELECT 
    name,
    role,
    weekly_hours
FROM users_zeiterfassung
ORDER BY name;