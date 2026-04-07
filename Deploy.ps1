<#
.SYNOPSIS
    Builds and deploys the Commute Dashboard stack (infra, backend, frontend).

.DESCRIPTION
    Runs deployment phases sequentially from the repository root:
      1. Infrastructure — CDK build + deploy
      2. Backend — Docker build, ECR push, Lambda update
      3. Frontend — Vite build, S3 sync, CloudFront invalidation

    By default all three phases run. Use -Only to deploy a single layer.

.PARAMETER Env
    Target environment: dev (default) or prod.

.PARAMETER Only
    Deploy only a single layer: backend or frontend.
    Infrastructure is always deployed first unless -SkipInfra is set.

.PARAMETER SkipInfra
    Skip the infrastructure (CDK) phase. Useful when only code has changed.

.EXAMPLE
    .\Deploy.ps1
    .\Deploy.ps1 -Env prod
    .\Deploy.ps1 -Only backend
    .\Deploy.ps1 -Only frontend -SkipInfra
#>

[CmdletBinding()]
param(
    [ValidateSet('dev', 'prod')]
    [string]$Env = 'dev',

    [ValidateSet('backend', 'frontend')]
    [string]$Only,

    [switch]$SkipInfra
)

$ErrorActionPreference = 'Stop'
$rootDir = $PSScriptRoot

function Write-Step {
    param([string]$Message)
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "  $Message" -ForegroundColor Yellow
}

function Invoke-Step {
    param(
        [string]$Description,
        [string]$WorkingDir,
        [string]$Command
    )
    Write-Info $Description
    Push-Location $WorkingDir
    try {
        Invoke-Expression $Command
        if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
            throw "Command failed with exit code $LASTEXITCODE"
        }
        Write-Success $Description
    }
    finally {
        Pop-Location
    }
}

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

# ── Resolve AWS account and region for CDK ───────────────────────────

Write-Info 'Resolving AWS account and region...'
if (-not $env:CDK_DEFAULT_ACCOUNT) {
    $env:CDK_DEFAULT_ACCOUNT = (aws sts get-caller-identity --query Account --output text 2>$null)
    if (-not $env:CDK_DEFAULT_ACCOUNT) {
        throw 'Unable to resolve AWS account. Check your AWS credentials.'
    }
}
if (-not $env:CDK_DEFAULT_REGION) {
    $env:CDK_DEFAULT_REGION = (aws configure get region 2>$null)
    if (-not $env:CDK_DEFAULT_REGION) {
        $env:CDK_DEFAULT_REGION = 'eu-west-2'
    }
}
Write-Success "AWS account $($env:CDK_DEFAULT_ACCOUNT), region $($env:CDK_DEFAULT_REGION)"

$runInfra    = -not $SkipInfra -and -not $Only
$runBackend  = -not $Only -or $Only -eq 'backend'
$runFrontend = -not $Only -or $Only -eq 'frontend'

$phases = @()
if ($runInfra)    { $phases += 'infra' }
if ($runBackend)  { $phases += 'backend' }
if ($runFrontend) { $phases += 'frontend' }
$total = $phases.Count
$step  = 0

# ── Infrastructure ──────────────────────────────────────────────────

if ($runInfra) {
    $step++
    Write-Step "Phase $step/$total`: Infrastructure ($Env)"

    $cdkArgs = if ($Env -eq 'prod') { '--all -c env=prod' } else { '--all' }

    Invoke-Step `
        -Description 'Compiling CDK TypeScript' `
        -WorkingDir "$rootDir\infra" `
        -Command 'npm run build'

    Invoke-Step `
        -Description "Deploying CDK stack (CommuteDashboard-$Env)" `
        -WorkingDir "$rootDir\infra" `
        -Command "npx cdk deploy $cdkArgs --require-approval never"
}

# ── Backend ─────────────────────────────────────────────────────────

if ($runBackend) {
    $step++
    Write-Step "Phase $step/$total`: Backend ($Env)"

    $deployCmd = if ($Env -eq 'prod') { 'npm run deploy:prod' } else { 'npm run deploy' }

    Invoke-Step `
        -Description 'Building and deploying backend container' `
        -WorkingDir "$rootDir\backend" `
        -Command $deployCmd
}

# ── Frontend ────────────────────────────────────────────────────────

if ($runFrontend) {
    $step++
    Write-Step "Phase $step/$total`: Frontend ($Env)"

    $deployCmd = if ($Env -eq 'prod') { 'npm run deploy:prod' } else { 'npm run deploy' }

    Invoke-Step `
        -Description 'Building and deploying frontend' `
        -WorkingDir "$rootDir\frontend" `
        -Command $deployCmd
}

# ── Done ─────────────────────────────────────────────────────────────

$stopwatch.Stop()
$elapsed = $stopwatch.Elapsed.ToString('mm\:ss')

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Deploy complete ($Env) in $elapsed" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
