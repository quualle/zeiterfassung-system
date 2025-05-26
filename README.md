# Zeiterfassungssystem

Ein einfaches webbasiertes Zeiterfassungssystem für kleine Unternehmen (5-10 Mitarbeiter).

## Funktionen

- Anmeldung mit Username und PIN
- PIN-Vergabe beim ersten Login
- Arbeitszeiterfassung (Start/Stop)
- Pausenverwaltung mit Begründung
- Admin-Dashboard für Übersicht
- Lokale Datenspeicherung (localStorage)

## Benutzer

### Administrator
- **Name:** Ines Cürten
- **Rechte:** Vollzugriff auf alle Zeiterfassungen

### Mitarbeiter
- **Name:** Lisa Bayer
- **Name:** Emilia Rathmann

Alle Benutzer müssen beim ersten Login einen 4-stelligen PIN vergeben.

## Installation

1. Dependencies installieren:
```bash
npm install
```

2. Entwicklungsserver starten:
```bash
npm start
```

3. Für Production Build:
```bash
npm run build
```

## Deployment

Das Projekt ist für Netlify konfiguriert. Einfach das Repository mit Netlify verbinden und automatisch deployen lassen.