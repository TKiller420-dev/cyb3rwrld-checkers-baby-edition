# 🚀 Release Process

## Quick Start

### Option 1: Click to Open (Easiest)
**Double-click `RELEASE.ps1`** in this folder

### Option 2: Command Line
From project root:
```bash
npm run release
```

### Option 3: Command Line with Message
```bash
npm run release "your commit message"
```

---

## What It Does

1. ✅ Commits all changes to git
2. ✅ Pushes to GitHub
3. ✅ Builds the app (`npm run dist`)
4. ✅ Creates a GitHub release with the .exe file
5. ✅ Clients will auto-update on their next check

---

## Requirements

Before using the release script, make sure you have:

- **git** (you already have this)
- **npm** (you already have this)
- **GitHub CLI** - [Install here](https://github.com/cli/cli)
- GitHub authentication: Run `gh auth login` once

---

## Troubleshooting

**"command not found" errors?**
- Make sure git, npm, and gh are in your PATH
- Restart your terminal after installing new tools

**Release creation fails?**
- Run `gh auth login` to authenticate with GitHub
- Make sure you have push access to the repository

**PowerShell execution policy error?**
- Right-click RELEASE.ps1 → Properties → Unblock
- Or run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
