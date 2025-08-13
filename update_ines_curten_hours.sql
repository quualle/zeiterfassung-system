-- Stelle sicher, dass Ines Cürten 40 Wochenstunden hat (bleibt aber Admin!)
UPDATE users_zeiterfassung 
SET weekly_hours = 40
WHERE LOWER(name) = 'ines cürten';

-- Zeige das Resultat
SELECT 
    name,
    role,
    weekly_hours,
    CASE 
        WHEN weekly_hours IS NOT NULL THEN '✅ Erscheint in Arbeitszeitstatistik mit ' || weekly_hours || ' Wochenstunden'
        ELSE '❌ Keine Wochenstunden definiert'
    END as status
FROM users_zeiterfassung
WHERE LOWER(name) IN ('christiane rohde', 'emilia rathmann', 'ines cürten')
ORDER BY name;