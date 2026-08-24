# Event Invoice Server

Backend API for the Event Invoice System with role-based access control.

## Setup

```bash
npm install
```

## Seed Admin User

```bash
npm run seed
```

Follow the prompts to create the first admin user.

## Start Server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout (destroy session)
- `GET /api/auth/me` - Get current user info

### Health Check
- `GET /api/health` - Server health check

## Environment Variables

- `PORT` - Server port (default: 3000)
- `SESSION_SECRET` - Secret for session encryption (change in production)
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:8080)
- `NODE_ENV` - Environment (set to 'production' for secure cookies)

## Security Notes

- Passwords are hashed with bcrypt (cost factor 12)
- Sessions use httpOnly cookies
- Rate limiting on login endpoint (10 attempts per 15 minutes)
- CORS locked to frontend origin
