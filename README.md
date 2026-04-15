# Cyb3rWrld Checkers (Baby edition)

Standalone Windows desktop client for the multiplayer checkers server.

## Default server

The client starts with this server URL prefilled:

```text
http://217.216.40.246:4000
```

You can override it at build time with:

```text
VITE_SERVER_URL=http://your-server:4000
```

## Development

```powershell
npm install
npm run dev
```

## Build installer

```powershell
npm install
npm run dist
```

The Windows executable is written to:

```text
release/Cyb3rWrld-Checkers-Baby-Edition-0.1.2.exe
```

## Notes

- This repo is fully standalone and does not depend on the original monorepo.
- The packaging target is a portable `.exe`.
- The client checks GitHub Releases in the source repository automatically on startup and every 3 minutes, then downloads and offers to restart into a newer build.
- The server must already be running on your VPS for multiplayer to work.
