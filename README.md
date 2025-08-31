# DreamTeam Studio V2

**Control Center for DreamTeam Virtual Software House**

A modern, PostgreSQL-native dashboard for monitoring and controlling the DreamTeam pipeline (F1-F4 functions).

## Architecture

Studio V2 is built with:
- **Backend**: Node.js + Express with direct PostgreSQL (Neon) connection
- **Frontend**: React + Vite + TailwindCSS + React Query
- **Integration**: n8n webhooks for pipeline control

## Quick Start

### 1. Install Dependencies

```bash
# Install all dependencies
npm run setup

# Or manually:
npm install
cd client && npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update:
- `DATABASE_URL` - Your Neon PostgreSQL connection string
- `N8N_WEBHOOK_URL` - Your n8n webhook endpoint

### 3. Run Development Server

```bash
# Start both backend and frontend
npm run dev

# Backend will run on http://localhost:3001
# Frontend will run on http://localhost:5173
```

## Features

### Current (MVP)
- ✅ Real-time pipeline statistics
- ✅ Pipeline function status monitoring
- ✅ Database service layer (ORM-ready)
- ✅ n8n workflow triggers
- ✅ Responsive UI with Tailwind

### Planned
- [ ] Problems explorer with filtering
- [ ] Cluster visualization
- [ ] Solutions management
- [ ] Workflow execution history
- [ ] Real-time updates via WebSockets

## API Endpoints

### Data Endpoints
- `GET /api/problems` - List problems with filters
- `GET /api/clusters` - List clusters
- `GET /api/solutions` - List solutions
- `GET /api/projects` - List active projects
- `GET /api/pipeline/stats` - Pipeline statistics
- `GET /api/pipeline/status` - Function status

### Workflow Triggers
- `POST /api/workflows/f1/trigger` - Trigger problem ingestion
- `POST /api/workflows/f2/trigger` - Trigger clustering
- `POST /api/workflows/f3/trigger` - Generate solutions
- `POST /api/workflows/f4/trigger` - Create project

## Database Service Layer

The backend uses a service pattern that makes it easy to migrate to an ORM later:

```javascript
// Current: Raw SQL
const problems = await databaseService.getProblems(filters);

// Future: Same interface, ORM implementation
const problems = await db.problems.findMany({ where: filters });
```

## Production Build

```bash
# Build frontend
npm run build

# Start production server
NODE_ENV=production npm start
```

## Tech Stack

- **Node.js** - Backend runtime
- **Express** - Web framework
- **PostgreSQL** (Neon) - Database
- **React 18** - UI framework
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **React Query** - Data fetching & caching
- **React Router** - Client-side routing

## Future Enhancements

1. **WebSocket Integration** - Real-time pipeline updates
2. **Drizzle ORM** - Type-safe database queries
3. **Authentication** - Secure access control
4. **Cluster Visualization** - D3.js embedding space viewer
5. **Workflow Builder** - Visual n8n workflow creator

## Development Notes

- Frontend proxies `/api` requests to backend (configured in vite.config.js)
- Database queries are centralized in `server/services/database.service.js`
- n8n integration is in `server/services/n8n.service.js`
- React Query handles all frontend data fetching and caching