# Expanse Project Rules (Svelte + Node.js)

## Tech Stack
- **Frontend:** Svelte (located in `/frontend`)
- **Backend:** Node.js (located in `/backend`)
- **Database:** SQLite (managed via backend)
- **Deployment:** Docker Compose

## Commands
- **Install All:** `cd frontend && npm install && cd ../backend && npm install`
- **Run Frontend (Dev):** `cd frontend && npm run dev`
- **Run Backend (Dev):** `cd backend && npm run dev`
- **Build All:** `./run.sh prod build`

## Architecture Notes
- The frontend acts as a Single Page Application (SPA).
- The backend handles Reddit OAuth and synchronization logic.
- API calls from frontend to backend should be checked in `frontend/src/lib/api.js` (or similar).

## Debugging & Code Style
- Use `console.log` for quick backend tracing; check Docker logs if running in container.
- Follow existing ESLint/Prettier configs.
- For Reddit API issues, check `backend/src/reddit/` logic.
