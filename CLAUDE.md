# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zeiterfassungssystem - A time tracking system for small businesses with dual storage capability (localStorage and Supabase).

## Core Commands

### Development
```bash
npm start          # Start development server on port 3000
npm run build      # Build for production
npm test           # Run tests (React Testing Library)
```

### Backend Sync Service
```bash
cd sync-backend
npm start          # Start sync service
npm run dev        # Start with nodemon for development
```

### Deployment
```bash
npm run build                              # Build locally
netlify deploy --prod --dir=build         # Deploy to Netlify
```

## Architecture

### Storage Architecture
The application uses a **dual-storage pattern** with automatic detection:
- **Primary**: Supabase (when REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY are set)
- **Fallback**: localStorage (when Supabase is not configured)
- **Provider Pattern**: `src/utils/storageProvider.ts` acts as the abstraction layer

### Component Hierarchy
```
App.tsx (main routing and auth state)
├── Login.tsx (authentication)
├── TimeTracking.tsx (employee view)
│   └── ChangeRequestModal.tsx
└── AdminDashboard.tsx (admin view)
    ├── ActivityLog.tsx
    ├── WorkTimeRules.tsx
    └── EmailBlacklist.tsx
```

### Database Schema
- **users_zeiterfassung**: User management with PIN authentication
- **time_entries_zeiterfassung**: Clock in/out records
- **breaks_zeiterfassung**: Break tracking with reasons
- **change_requests**: Time correction requests
- **notifications**: System notifications
- **work_time_rules**: Auto-logout rules
- **email_blacklist**: Email filtering

### Key Services Integration
- **Supabase**: Real-time database and authentication
- **BigQuery**: Ticket data synchronization
- **Aircall**: Call logs integration  
- **Gmail API**: Email activity tracking
- **Netlify**: Hosting and deployment

## Environment Configuration

### Required for Supabase
```
REACT_APP_SUPABASE_URL=<your-supabase-url>
REACT_APP_SUPABASE_ANON_KEY=<your-anon-key>
```

### Optional API Keys
```
REACT_APP_AIRCALL_API_KEY=<aircall-key>
# BigQuery and Gmail require backend implementation
```

## Development Guidelines

### State Management
- User session stored in localStorage with 24-hour expiry for admins
- Real-time data sync when using Supabase
- Timezone handling: All times stored in UTC, displayed in German timezone

### Authentication Flow
1. Username selection → PIN creation (first login) or PIN entry
2. Admin sessions persist for 24 hours
3. Employee auto-logout based on work_time_rules

### Data Synchronization
- Frontend polls Supabase for real-time updates
- Backend sync service handles external API integration
- Activity log consolidates data from multiple sources

## Testing Approach

The project uses React Testing Library. Run specific tests with:
```bash
npm test -- --testNamePattern="test name"
npm test -- ComponentName.test.tsx
```

## Database Migrations

SQL files in root directory handle schema updates:
- `supabase_schema.sql` - Main schema
- `insert_users.sql` - User data
- Various migration files for feature additions

Apply migrations via Supabase dashboard SQL editor.

## Security Considerations

- PIN stored as plain text (consider hashing for production)
- RLS policies configured for public access (tighten for production)
- API keys should never be committed
- Admin session tokens expire after 24 hours