# Planning Poker Game

**Planning Poker** app built with Vue 3 and Socket.IO for real-time multiplayer estimation sessions.

The realtime server is embedded in the same process as the web app:

- **Development**: attached to the Vite dev server.
- **Production**: attached to an Express server that serves the built app.

No separate WebSocket/Socket.IO process is required.

## Getting started

### Prerequisites

- Node.js 22.12+ (recommended)
- npm

### Install & run in development

```bash
npm install
npm run dev
```

Then open the URL printed by Vite (by default `http://localhost:5173`).

The frontend and Socket.IO server share the same origin. Socket.IO uses the path `/socket.io-poker` behind the scenes; no extra configuration is required in development.

## How to use the app

1. Open the app in your browser.
2. Enter your name.
3. Either:
   - **Create new session** – starts a fresh estimation session, or
   - **Join** – paste an existing session ID to join an ongoing session.
4. After creating a session, the URL becomes `/session/<session-id>`. Use **Share** to copy a join link for your teammates.
5. Everyone picks a card. When at least one card has been played, anyone can click **Reveal**.
6. After seeing the results (average and distribution), click **New vote** to clear selections and start the next round.

## Production build & local server

Build the production assets:

```bash
npm run build
```

Start the Express server that serves the built app **and** hosts Socket.IO:

```bash
npm run server
```

By default this listens on port `5173`. You can change it with the `PORT` environment variable:

```bash
PORT=8080 npm run server
```

## Deploying to Google Cloud Run

This project includes a `Dockerfile` so you can deploy the app (Vue SPA + Socket.IO server) as a single container.

### 1. Build and push the image

Make sure you are authenticated with `gcloud` and have Docker or Cloud Build enabled:

```bash
gcloud auth login
gcloud config set project data-fullstack-production

gcloud builds submit \
  --tag gcr.io/data-fullstack-production/poker-planning-game
```

### 2. Deploy to Cloud Run (Paris: `europe-west9`)

```bash
gcloud run deploy poker-planning-game \
  --image gcr.io/data-fullstack-production/poker-planning-game \
  --platform managed \
  --region europe-west9 \
  --allow-unauthenticated \
  --max-instances=1 \
  --concurrency=100
```

- **`--max-instances=1`** keeps every player on the same instance. Sessions live in memory, so a second instance would not see the same votes.
- **`--concurrency=100`** lets one instance handle many requests at once. Socket.IO keeps a long-poll open and sends votes on a separate request; a concurrency of 1 makes Cloud Run answer those with **429** and the vote never arrives. Do not set this back to 1.

After deployment, `gcloud` prints the Cloud Run URL. That URL is what you share with players to access the Planning Poker app.

## Tech stack

- Vue 3 (Composition API)
- Vite
- Vue Router
- Pinia
- Socket.IO (server + client), path `/socket.io-poker`
- Express (production HTTP server)

The realtime server runs in-process with the web server, so you manage and scale a single service.

## Project structure & key concepts

- **Frontend**
  - `src/main.js` – bootstraps Vue, Pinia, and Vue Router.
  - `src/router/` – routes for the registration page (`/`) and session page (`/session/:sessionId`).
  - `src/stores/user.js` – stores the current user name and persists it in `sessionStorage`.
  - `src/stores/poker.*` – manages the poker table state (players, selections, reveal state, statistics).
  - `src/views/RegistrationPage.vue` – enter your name and create/join a session.
  - `src/views/PlanningPokerPage.vue` – main table UI, cards, results modal.

- **Realtime backend**
  - `server/ws-handler.js` – creates a Socket.IO server on the same HTTP server as Vite/Express.
  - **Namespace/path**: single Socket.IO server mounted on `/socket.io-poker`.
  - **In-memory state**: sessions are stored in a `Map`, keyed by `sessionId` (no external DB).

- **Entry points**
  - `vite.config.js` – attaches the Socket.IO server to the Vite dev server during development.
  - `server.js` – Express server that serves `dist/` and attaches the same Socket.IO handler in production.

## Socket.IO protocol (high level)

All messages are plain JSON objects. The most important events are:

- **Client → server**
  - **`hello`**: `{ name, playerId, mode: 'create' | 'join', sessionId?: string }`  
    Creates or joins a session and registers the player. `playerId` is a stable client id so a reconnect reattaches the same player (and keeps their vote) instead of creating a new one. Reconnects always use `mode: 'join'` with the current `sessionId`.
  - **`select_card`**: `value`  
    Player selects a card; allowed only before reveal.
  - **`reveal`**: no payload  
    Marks the session as revealed and sends final scores to everyone. Accepted only if that player has already voted. Reveal is never automatic.
  - **`leave`**: no payload  
    Removes the player immediately (used on Exit). A network drop instead waits a short grace period before removal so a reconnect can reclaim the seat.
  - **`reset`**: no payload  
    Clears selections and starts a new voting round in the same session.

- **Server → client**
  - **`welcome`**: `{ you, sessionId, players, selections, isRevealed }`  
    Sent only to the newly connected client, includes its own `you` object.
  - **`state`**: `{ sessionId, players, selections, isRevealed }`  
    Broadcast on every meaningful change (join/leave, select, reveal, reset).

The frontend `poker` store connects once per page load and keeps Vue state in sync with these events.

## Development & quality tooling

- **Linting**
  - `npm run lint` – run ESLint on the project.

- **Formatting**
  - `npm run format` – check formatting with Prettier.
  - `npm run format:write` – auto-fix formatting.

- **Tests**
  - `npm test` – run unit tests with Vitest.
  - `npm run test:watch` – run tests in watch mode during development.

A GitHub Actions workflow (`.github/workflows/ci.yml`) is included to run **lint**, **tests**, and **build** on every push and pull request to `main`.
