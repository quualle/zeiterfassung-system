# Gmail API Setup Guide

## 1. Google Cloud Console Setup

1. **Gehe zu**: https://console.cloud.google.com/
2. **Wähle dein Projekt**: `gcpxbixpflegehilfesenioren`
3. **Aktiviere die Gmail API**:
   - Gehe zu "APIs & Services" > "Bibliothek"
   - Suche nach "Gmail API"
   - Klicke auf "Aktivieren"

## 2. OAuth2 Credentials erstellen

1. **Gehe zu**: "APIs & Services" > "Anmeldedaten"
2. **Klicke auf**: "+ ANMELDEDATEN ERSTELLEN" > "OAuth-Client-ID"
3. **Anwendungstyp**: "Webanwendung"
4. **Name**: "Zeiterfassung Gmail Sync"
5. **Autorisierte Redirect-URIs**:
   - `http://localhost:3001/auth/gmail/callback` (für lokale Tests)
   - `https://zeiterfassung-sync-backend.onrender.com/auth/gmail/callback` (für Production)
6. **Erstellen** und speichere die Client ID und Client Secret

## 3. OAuth Consent Screen

1. **Gehe zu**: "OAuth consent screen"
2. **User Type**: "Intern" (nur für deine Organisation)
3. **App-Informationen** ausfüllen
4. **Scopes hinzufügen**:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.metadata`
5. **Test-Nutzer**: Füge deine E-Mail-Adressen hinzu

## 4. Environment Variables

Füge diese zu deinem `.env` (lokal) und Render.com hinzu:

```
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REDIRECT_URI=https://zeiterfassung-sync-backend.onrender.com/auth/gmail/callback
```

## 5. Erste Autorisierung

Nach dem Setup musst du einmalig den OAuth-Flow durchlaufen:

1. Öffne: `https://zeiterfassung-sync-backend.onrender.com/auth/gmail`
2. Autorisiere den Zugriff
3. Der Refresh Token wird automatisch gespeichert

## 6. Wichtige E-Mail-Adressen

Die folgenden E-Mail-Adressen sollten Zugriff haben:
- pflegeteam.heer@pflegehilfe-senioren.de
- ines.cuerten@pflegehilfe-senioren.de

## Troubleshooting

- **403 Forbidden**: OAuth consent screen nicht konfiguriert
- **Invalid redirect URI**: Redirect URI stimmt nicht mit der in Google Console überein
- **Scope not authorized**: Fehlende Scopes im consent screen