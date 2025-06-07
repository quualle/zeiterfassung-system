# Gmail OAuth Setup - Schritt für Schritt

## 1. Google Cloud Console einrichten

1. Gehe zu: https://console.cloud.google.com/
2. Stelle sicher, dass dein Projekt `gcpxbixpflegehilfesenioren` ausgewählt ist
3. Gehe zu "APIs & Services" > "Aktivierte APIs"
4. Prüfe ob Gmail API aktiviert ist (sollte bereits sein)

## 2. OAuth2 Credentials erstellen

1. Gehe zu "APIs & Services" > "Anmeldedaten"
2. Klicke auf "+ ANMELDEDATEN ERSTELLEN" > "OAuth-Client-ID"
3. Wähle "Webanwendung"
4. Name: "Zeiterfassung Gmail Sync"
5. **Autorisierte Redirect-URIs** hinzufügen:
   - `https://zeiterfassung-sync-backend.onrender.com/auth/gmail/callback`
   - `http://localhost:3001/auth/gmail/callback` (für Tests)
6. Klicke auf "Erstellen"
7. **WICHTIG**: Kopiere die Client ID und das Client Secret

## 3. Environment Variables in Render.com hinzufügen

Gehe zu deinem Render.com Dashboard und füge diese Environment Variables hinzu:

```
GMAIL_CLIENT_ID=deine_client_id_hier
GMAIL_CLIENT_SECRET=dein_client_secret_hier
GMAIL_REDIRECT_URI=https://zeiterfassung-sync-backend.onrender.com/auth/gmail/callback
```

## 4. Backend neu deployen

Nach dem Hinzufügen der Environment Variables:
1. Gehe zu deinem Render Service
2. Klicke auf "Manual Deploy" > "Deploy latest commit"
3. Warte bis das Deployment abgeschlossen ist

## 5. Gmail autorisieren

**WICHTIG**: Du musst dich mit dem Account anmelden, dessen E-Mails synchronisiert werden sollen!

1. Öffne im Browser: https://zeiterfassung-sync-backend.onrender.com/auth/gmail
2. Melde dich mit einem der Team-Accounts an:
   - pflegeteam.heer@pflegehilfe-senioren.de
   - ines.cuerten@pflegehilfe-senioren.de
3. Erlaube den Zugriff auf Gmail ("Gmail lesen")
4. Nach erfolgreicher Autorisierung siehst du eine Bestätigungsseite
5. **WICHTIG**: Schaue in die Render.com Logs - dort wird der Refresh Token angezeigt
6. Kopiere den Refresh Token aus den Logs

**Hinweis**: Die App kann nur E-Mails des autorisierten Accounts lesen. Für mehrere Accounts müsstest du Google Workspace Domain-Wide Delegation einrichten.

## 6. Refresh Token speichern

Füge den Refresh Token als Environment Variable in Render.com hinzu:

```
GMAIL_REFRESH_TOKEN=der_kopierte_refresh_token
```

## 7. Finaler Test

1. Deploy das Backend erneut
2. Gehe zum Activity Log
3. Klicke auf "APIs synchronisieren"
4. Gmail E-Mails sollten jetzt synchronisiert werden!

## Troubleshooting

### "Gmail OAuth not configured"
- Stelle sicher, dass alle Environment Variables gesetzt sind
- Deploy das Backend neu

### "invalid_grant" Error
- Der Refresh Token ist ungültig
- Führe Schritt 5 erneut durch

### Keine E-Mails werden angezeigt
- Prüfe ob E-Mails in den letzten 30 Tagen gesendet wurden
- Stelle sicher, dass du mit dem richtigen Account autorisiert hast
- Die App kann nur E-Mails des autorisierten Accounts lesen
- Schaue in die Render.com Logs für Fehlermeldungen

### "Metadata scope does not support 'q' parameter"
- Der OAuth Scope wurde geändert
- Führe die Autorisierung erneut durch (Schritt 5)