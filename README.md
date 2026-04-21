# Cyb3rWrld Checkers (Baby edition)

Desktop multiplayer checkers with a stylized 3D board, Electron packaging, and built-in auto-update support for Windows.

## What this repo is

This is the standalone client project. It connects to a separate checkers server over Socket.IO.

## Quick start (development)

```powershell
npm install
npm run dev
```

By default, local development connects to:

```text
http://localhost:4000
```

To point the client at your deployed server, set:

```text
VITE_SERVER_URL=https://your-server.example.com
```

## Build Windows app

```powershell
npm install
npm run dist
```

Portable build output goes to the `release/` folder.

## Auto-update behavior

- The client checks GitHub releases at startup and every 3 minutes.
- When a newer version is found, it downloads it and prompts for restart.
- Manual "Check updates" is available in-app for packaged builds.

## Privacy and repo safety

- Secrets and environment files are ignored (`.env*`, key/cert formats, `secrets/`).
- `release-tools/` is excluded from version control.
- Keep server-specific/private endpoints in environment variables instead of hardcoding.

If you are preparing this for public GitHub visibility, verify your runtime values come from env configuration and not committed local files.
