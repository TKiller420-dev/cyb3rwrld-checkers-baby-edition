#!/usr/bin/env pwsh
# Release Manager Launcher
# Double-click or run to start the release process

Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     🚀 Cyb3rWrld Checkers Release     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Navigate to project root
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# Check if we're in the right directory
if (-not (Test-Path "$projectRoot\package.json")) {
    Write-Host "❌ Error: package.json not found at $projectRoot" -ForegroundColor Red
    Write-Host "Please move this script to the correct location`n" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check for required tools
$missingTools = @()
'git', 'npm', 'gh' | ForEach-Object {
    if (-not (Get-Command $_ -ErrorAction SilentlyContinue)) {
        $missingTools += $_
    }
}

if ($missingTools.Count -gt 0) {
    Write-Host "❌ Missing required tools: $($missingTools -join ', ')" -ForegroundColor Red
    Write-Host "Install GitHub CLI: https://github.com/cli/cli`n" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✓ All tools found`n" -ForegroundColor Green

# Run the release script from project root
Push-Location $projectRoot
& cmd /c "npm run release"
Pop-Location
