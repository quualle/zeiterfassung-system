# Deployment-Anleitung für Netlify

## Schritt-für-Schritt Anleitung

### 1. ✅ GitHub Repository (bereits erledigt)

Das Repository ist bereits unter https://github.com/quualle/zeiterfassung-system verfügbar.

### 2. Netlify Deployment

1. Gehen Sie zu https://app.netlify.com
2. Klicken Sie auf "Add new site" → "Import an existing project"
3. Wählen Sie "GitHub" und autorisieren Sie Netlify
4. Wählen Sie Ihr Repository aus
5. Build-Einstellungen:
   - **Build command:** `npm run build`
   - **Publish directory:** `build`
6. Klicken Sie auf "Deploy site"

### 3. Nach dem Deployment

- Netlify generiert automatisch eine URL wie: `https://amazing-einstein-123abc.netlify.app`
- Sie können diese URL unter "Site settings" → "Change site name" anpassen
- Die Website ist sofort einsatzbereit!

### Alternative: Lokales Deployment

Falls Sie das System ohne GitHub deployen möchten:

1. Bauen Sie das Projekt lokal:
```bash
npm run build
```

2. Installieren Sie Netlify CLI:
```bash
npm install -g netlify-cli
```

3. Deployen Sie direkt:
```bash
netlify deploy --prod --dir=build
```

## Wichtige Hinweise

- Die Daten werden im Browser (localStorage) gespeichert
- Jeder Browser/Computer hat seine eigenen Daten
- Für ein zentrales System würde eine Datenbank benötigt