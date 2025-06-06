# API Setup Instructions

To enable real API synchronization in the Activity Log, you need to set up the following environment variables:

## 1. Aircall API
Add to your `.env` file:
```
REACT_APP_AIRCALL_API_KEY=c1f3df1855afc3ce2f6661b41b154ce7
```

## 2. BigQuery Setup
Due to the complexity of BigQuery authentication from the frontend, the current implementation uses sample data. For production use, implement a backend service that handles BigQuery authentication.

## 3. Gmail API
Gmail requires OAuth2 flow which cannot be securely implemented in frontend-only applications. The current implementation uses sample data.

## Current Implementation

The "APIs aktualisieren" button will:
1. **Tickets (BigQuery)**: Shows sample ticket data
2. **Calls (Aircall)**: Attempts real API call, falls back to sample data if CORS issues
3. **Emails (Gmail)**: Shows sample email data

## Production Recommendation

For production use, create a backend service (Node.js, Python, etc.) that:
1. Handles all API authentication securely
2. Makes API calls server-side
3. Stores results in Supabase
4. Provides endpoints for the frontend to trigger syncs

This approach is more secure and avoids CORS issues.