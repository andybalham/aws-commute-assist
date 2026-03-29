<#
.SYNOPSIS
    Stops the local dev stack and optionally restores frontend/.env.local.

.DESCRIPTION
    1. Stops and removes the DynamoDB Local Docker container
    2. Restores frontend/.env.local from backup (if .env.local.bak exists)

    The backend and frontend dev server windows must be closed manually (Ctrl+C).

.EXAMPLE
    .\Stop-DevStack.ps1
#>

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Write-Step  { param([string]$msg) Write-Host "`n► $msg" -ForegroundColor Cyan }
function Write-OK    { param([string]$msg) Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Skip  { param([string]$msg) Write-Host "  - $msg (skipped)" -ForegroundColor Yellow }

# ── 1. Stop DynamoDB Local ───────────────────────────────────────────────────
Write-Step 'Stopping DynamoDB Local'

$running = docker ps --filter "name=dynamodb-local" --format "{{.Names}}" 2>$null
if ($running -eq 'dynamodb-local') {
    docker stop dynamodb-local | Out-Null
    docker rm dynamodb-local | Out-Null
    Write-OK 'Container stopped and removed'
} else {
    $exists = docker ps -a --filter "name=dynamodb-local" --format "{{.Names}}" 2>$null
    if ($exists -eq 'dynamodb-local') {
        docker rm dynamodb-local | Out-Null
        Write-OK 'Removed stopped container'
    } else {
        Write-Skip 'No dynamodb-local container found'
    }
}

# ── 2. Restore frontend/.env.local ──────────────────────────────────────────
Write-Step 'Restoring frontend/.env.local'

$frontendEnv = Join-Path $root 'frontend\.env.local'
$backup      = "$frontendEnv.bak"

if (Test-Path $backup) {
    Copy-Item $backup $frontendEnv -Force
    Remove-Item $backup
    Write-OK 'Restored .env.local from backup'
} else {
    Write-Skip 'No .env.local.bak found — nothing to restore'
}

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host "`n► Close the backend and frontend PowerShell windows manually (Ctrl+C)." -ForegroundColor Yellow
Write-Host ""
