# Sakan Server

Backend API + realtime layer for the Sakan application.

- **HTTP API**: Express 5 (`/api/*`)
- **Realtime**: Socket.IO (authenticated)
- **Database**: PostgreSQL via Sequelize

## Requirements

- Node.js (LTS recommended)
- PostgreSQL
- Package manager: **pnpm** (recommended) or npm

## Quick start

1) Install deps

- pnpm: `pnpm install`
- npm: `npm install`

2) Create `.env` (see `.env.example`).

3) Start the server

- Dev: `pnpm dev` (nodemon)
- Prod: `pnpm start`

Server listens on `PORT` (default `3000`).

## Environment variables

This project reads env vars from `.env` (loaded in `server.js`).

See **`.env.example`** for a complete template.

## Authentication

### HTTP

Protected routes require:

- Header: `Authorization: Bearer <JWT>`

JWTs are issued on:

- OTP verification (`POST /api/auth/verfiyOtp`)
- Login (`POST /api/auth/login`)
- Reset password (`POST /api/auth/resetpassword`)

### Socket.IO

Socket authentication uses the JWT from the handshake headers:

- Header: `token: <JWT>`

On connect, the server updates the user’s `socketId` and `online` status in the DB.

## API documentation

- Endpoint list + request validation: **`docs/API.md`**
- Realtime events: **`docs/SOCKETS.md`**
- System usage + module-based developer guide + role journeys + mounted/not-mounted handler labels: **`docs/DEVELOPER_DOC.md`**
- Postman collection: **`docs/postman/Sakan-Server.postman_collection.json`**

## Error responses

Most errors are returned as JSON with:

- `status` (`fail` or `error`)
- `message`
- (in current configuration) `stack`

See `middlewares/globalErrorHandler.js`.

## Database notes

- The server initializes Sequelize in `config/database.js`.
- It attempts to **create the database if missing**, then runs `sequelize.sync({ alter: true })`.

In production, you may prefer migrations instead of `sync({ alter: true })`.

## Project layout

- `server.js` — Express app + HTTP server + Socket.IO bootstrapping
- `Routes/` — HTTP routes mounted under `/api`
- `Controllers/` — Request handlers
- `Services/` — Business logic
- `Models/` — Sequelize models
- `middlewares/` — auth + validation + error handling
- `sockets/` — socket event handlers

## License

ISC (see `package.json`).
