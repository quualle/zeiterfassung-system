# Zeiterfassung Sync Backend

Backend service for syncing activity data from BigQuery, Aircall, and Gmail to Supabase.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

3. **Environment Variables:**
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key (from Supabase dashboard)
   - `BIGQUERY_CREDENTIALS`: Complete JSON credentials (paste as single line)
   - `AIRCALL_API_KEY`: Your Aircall API credentials in format `api_id:api_token`
     - Example: `aaa06cd853xxx:bbb123456yyy`
     - Get these from your Aircall dashboard under API Keys

## Local Development

```bash
npm run dev
```

Server runs on http://localhost:3001

## API Endpoints

### Health Check
```
GET /health
```

### Sync All APIs
```
POST /sync
```

Triggers sync from all sources (BigQuery, Aircall, Gmail) and stores in Supabase.

## Deploy to Render.com (Free)

1. **Push to GitHub:**
   ```bash
   git add sync-backend/
   git commit -m "Add sync backend"
   git push
   ```

2. **Create Render Web Service:**
   - Go to [render.com](https://render.com)
   - New > Web Service
   - Connect your GitHub repo
   - Configuration:
     - Name: `zeiterfassung-sync-backend`
     - Root Directory: `sync-backend`
     - Build Command: `npm install`
     - Start Command: `npm start`
     - Add all environment variables from `.env`

3. **Get your Render URL:**
   After deployment, you'll get a URL like:
   `https://zeiterfassung-sync-backend.onrender.com`

## Update Frontend

Update your frontend to call the backend:

```javascript
const response = await fetch('https://your-render-url.onrender.com/sync', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
});
const result = await response.json();
```

## Current Implementation

- ✅ **BigQuery**: Full implementation with real queries
- ✅ **Aircall**: Full implementation with API calls
- ⚠️ **Gmail**: Sample data only (OAuth2 setup required)

## Notes

- Free Render instances sleep after 15 minutes of inactivity
- First request after sleep takes ~30 seconds to wake up
- For production, consider upgrading to paid tier