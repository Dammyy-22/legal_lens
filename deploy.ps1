# LegalLens - Local Development & Deployment Script
# PowerShell
# Python target: 3.12

$ErrorActionPreference = "Stop"

# ============================================================
# COLORS
# ============================================================

$GREEN  = "`e[32m"
$BLUE   = "`e[34m"
$YELLOW = "`e[33m"
$RED    = "`e[31m"
$CYAN   = "`e[36m"
$RESET  = "`e[0m"

function Write-Status {
    param(
        [string]$Message,
        [string]$Status
    )

    Write-Host "$BLUE► $Message$RESET" -NoNewline
    Write-Host " ... $Status"
}

function Write-Success {
    param([string]$Message)

    Write-Host "$GREEN✓ $Message$RESET"
}

function Write-Error-Msg {
    param([string]$Message)

    Write-Host "$RED✗ $Message$RESET"
}

function Write-Warning-Msg {
    param([string]$Message)

    Write-Host "$YELLOW⚠ $Message$RESET"
}

function Write-Info {
    param([string]$Message)

    Write-Host "$CYANℹ $Message$RESET"
}

# ============================================================
# PROJECT PATH DETECTION
# ============================================================

$ScriptRoot = $PSScriptRoot

if (-not $ScriptRoot) {
    $ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}

Write-Info "Script location: $ScriptRoot"

# Find the LegalLens application root automatically.
# This avoids hard-coding assumptions about where deploy.ps1 lives.

$CandidateRoots = @(
    $ScriptRoot,
    (Split-Path -Parent $ScriptRoot),
    (Split-Path -Parent (Split-Path -Parent $ScriptRoot)),
    (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptRoot)))
)

$ProjectRoot = $null

foreach ($Root in $CandidateRoots) {

    if (-not $Root) {
        continue
    }

    $ApiCandidate = Join-Path $Root "legalens-phase5\legalens\apps\api"
    $WebCandidate = Join-Path $Root "legalens-phase5\legalens\apps\web"

    if ((Test-Path $ApiCandidate) -and (Test-Path $WebCandidate)) {
        $ProjectRoot = $Root
        break
    }

    # Case where Root is already legalens-phase5
    $ApiCandidate = Join-Path $Root "legalens\apps\api"
    $WebCandidate = Join-Path $Root "legalens\apps\web"

    if ((Test-Path $ApiCandidate) -and (Test-Path $WebCandidate)) {
        $ProjectRoot = $Root
        break
    }

    # Case where Root is already legalens
    $ApiCandidate = Join-Path $Root "apps\api"
    $WebCandidate = Join-Path $Root "apps\web"

    if ((Test-Path $ApiCandidate) -and (Test-Path $WebCandidate)) {
        $ProjectRoot = $Root
        break
    }
}

if (-not $ProjectRoot) {

    Write-Error-Msg "Could not automatically locate the LegalLens project."

    Write-Host ""
    Write-Host "Expected structure resembles:"
    Write-Host "  legal_lens\"
    Write-Host "  ├── .venv\"
    Write-Host "  └── legalens-phase5\"
    Write-Host "      └── legalens\"
    Write-Host "          └── apps\"
    Write-Host "              ├── api\"
    Write-Host "              └── web\"
    Write-Host ""

    exit 1
}

# ============================================================
# RESOLVE APPLICATION PATHS
# ============================================================

# Determine which project level was detected.

$Phase5Root = $null
$LegalLensRoot = $null

if (Test-Path (Join-Path $ProjectRoot "legalens-phase5\legalens\apps\api")) {

    $Phase5Root = Join-Path $ProjectRoot "legalens-phase5"
    $LegalLensRoot = Join-Path $Phase5Root "legalens"

}
elseif (Test-Path (Join-Path $ProjectRoot "legalens\apps\api")) {

    $Phase5Root = $ProjectRoot
    $LegalLensRoot = Join-Path $ProjectRoot "legalens"

}
elseif (Test-Path (Join-Path $ProjectRoot "apps\api")) {

    $LegalLensRoot = $ProjectRoot
    $Phase5Root = Split-Path -Parent $ProjectRoot
}

$BackendPath  = Join-Path $LegalLensRoot "apps\api"
$FrontendPath = Join-Path $LegalLensRoot "apps\web"

# ============================================================
# FIND VIRTUAL ENVIRONMENT
# ============================================================

$VenvCandidates = @(
    (Join-Path $ProjectRoot ".venv"),
    (Join-Path $Phase5Root ".venv"),
    (Join-Path $LegalLensRoot ".venv"),
    (Join-Path $BackendPath ".venv")
)

$VenvPath = $null

foreach ($Candidate in $VenvCandidates) {

    $PythonExecutable = Join-Path $Candidate "Scripts\python.exe"

    if (Test-Path $PythonExecutable) {
        $VenvPath = $Candidate
        break
    }
}

# ============================================================
# HEADER
# ============================================================

Write-Host ""
Write-Host "$BLUE╔════════════════════════════════════════════════════╗$RESET"
Write-Host "$BLUE║          LegalLens Deployment Script              ║$RESET"
Write-Host "$BLUE╚════════════════════════════════════════════════════╝$RESET"
Write-Host ""

Write-Info "Project root : $ProjectRoot"
Write-Info "LegalLens    : $LegalLensRoot"
Write-Info "Backend      : $BackendPath"
Write-Info "Frontend     : $FrontendPath"

if ($VenvPath) {
    Write-Info "Python venv  : $VenvPath"
}
else {
    Write-Warning-Msg "Python virtual environment was not found."
}

Write-Host ""

# ============================================================
# VALIDATE PROJECT
# ============================================================

if (-not (Test-Path $BackendPath)) {
    Write-Error-Msg "Backend directory not found:"
    Write-Host $BackendPath
    exit 1
}

if (-not (Test-Path $FrontendPath)) {
    Write-Error-Msg "Frontend directory not found:"
    Write-Host $FrontendPath
    exit 1
}

Write-Success "LegalLens project structure detected"

# ============================================================
# MENU
# ============================================================

Write-Host ""
Write-Host "$YELLOW Choose an action:$RESET"
Write-Host ""
Write-Host "1. Start local development"
Write-Host "2. Build for production"
Write-Host "3. Deploy frontend to Vercel"
Write-Host "4. Configure environment"
Write-Host "5. Run tests"
Write-Host "6. Check project environment"
Write-Host ""

$choice = Read-Host "Enter choice (1-6)"

# ============================================================
# ACTION 1 - LOCAL DEVELOPMENT
# ============================================================

switch ($choice) {

    "1" {

        Write-Host ""
        Write-Host "$BLUE Starting LegalLens Local Development...$RESET"
        Write-Host ""

        # ----------------------------------------------------
        # Python / Backend
        # ----------------------------------------------------

        Write-Host "$YELLOW Backend:$RESET"

        if (-not $VenvPath) {

            Write-Error-Msg "Python virtual environment not found."

            Write-Host ""
            Write-Host "Create it with:"
            Write-Host ""

            Write-Host "cd `"$ProjectRoot`""
            Write-Host "py -3.12 -m venv .venv"
            Write-Host ".\.venv\Scripts\Activate.ps1"
            Write-Host "python -m pip install --upgrade pip"
            Write-Host "pip install -r `"$BackendPath\requirements.txt`""

            exit 1
        }

        $VenvPython = Join-Path $VenvPath "Scripts\python.exe"

        Write-Status "Checking Python version" "..."

        $PythonVersion = & $VenvPython --version

        Write-Host "$GREEN$PythonVersion$RESET"

        if ($PythonVersion -notmatch "Python 3\.12") {

            Write-Warning-Msg "LegalLens is expected to use Python 3.12."
            Write-Warning-Msg "Current virtual environment: $PythonVersion"
        }
        else {
            Write-Success "Python 3.12 detected"
        }

        Write-Host ""
        Write-Host "$YELLOW Run backend in Terminal 1:$RESET"
        Write-Host ""

        Write-Host "cd `"$BackendPath`""
        Write-Host "& `"$VenvPython`" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

        # ----------------------------------------------------
        # Frontend
        # ----------------------------------------------------

        Write-Host ""
        Write-Host "$YELLOW Run frontend in Terminal 2:$RESET"
        Write-Host ""

        Write-Host "cd `"$FrontendPath`""
        Write-Host "npm install"
        Write-Host "npm run dev"

        Write-Host ""
        Write-Success "Frontend: http://localhost:3000"
        Write-Success "Backend : http://localhost:8000"
        Write-Success "API Docs: http://localhost:8000/docs"
    }

    # ========================================================
    # ACTION 2 - PRODUCTION BUILD
    # ========================================================

    "2" {

        Write-Host ""
        Write-Host "$BLUE Building LegalLens for Production...$RESET"
        Write-Host ""

        # Frontend
        Write-Status "Checking Node.js" "..."

        $node = Get-Command node -ErrorAction SilentlyContinue

        if (-not $node) {
            Write-Error-Msg "Node.js is not installed or not available in PATH."
            exit 1
        }

        Write-Host "Node: $(node --version)"

        Write-Host ""

        Set-Location $FrontendPath

        Write-Status "Installing frontend dependencies" "..."

        npm install

        if ($LASTEXITCODE -ne 0) {
            Write-Error-Msg "npm install failed."
            exit 1
        }

        Write-Status "Building frontend" "..."

        npm run build

        if ($LASTEXITCODE -eq 0) {
            Write-Success "Frontend built successfully."
            Write-Host "Output: $FrontendPath\.next"
        }
        else {
            Write-Error-Msg "Frontend build failed."
            exit 1
        }

        # Backend
        Write-Host ""
        Write-Host "$BLUE Backend Docker build:$RESET"
        Write-Host ""

        Set-Location $BackendPath

        Write-Host "docker build -t legalens-api:latest ."

        Write-Host ""
        $docker = Get-Command docker -ErrorAction SilentlyContinue

        if ($docker) {

            $buildDocker = Read-Host "Build backend Docker image now? (y/n)"

            if ($buildDocker -eq "y") {

                docker build -t legalens-api:latest .

                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Backend Docker image built successfully."
                }
                else {
                    Write-Error-Msg "Backend Docker build failed."
                }
            }

        }
        else {
            Write-Warning-Msg "Docker was not found. Backend Docker build skipped."
        }
    }

    # ========================================================
    # ACTION 3 - VERCEL
    # ========================================================

    "3" {

        Write-Host ""
        Write-Host "$BLUE Deploying LegalLens frontend to Vercel...$RESET"
        Write-Host ""

        $vercel = Get-Command vercel -ErrorAction SilentlyContinue

        if (-not $vercel) {

            Write-Warning-Msg "Vercel CLI is not installed."

            Write-Host ""
            Write-Host "Install it with:"
            Write-Host "npm install -g vercel"
            Write-Host ""

            exit 1
        }

        Set-Location $FrontendPath

        Write-Host "$YELLOW Expected environment variables:$RESET"
        Write-Host ""
        Write-Host "NEXT_PUBLIC_API_URL"
        Write-Host "NEXT_PUBLIC_SUPABASE_URL"
        Write-Host "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        Write-Host ""

        $deploy = Read-Host "Deploy to Vercel production? (y/n)"

        if ($deploy -eq "y") {

            Write-Status "Deploying to Vercel" "..."

            vercel --prod

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Vercel deployment completed."
            }
            else {
                Write-Error-Msg "Vercel deployment failed."
            }
        }
        else {
            Write-Info "Deployment cancelled."
        }
    }

    # ========================================================
    # ACTION 4 - ENVIRONMENT
    # ========================================================

    "4" {

        Write-Host ""
        Write-Host "$BLUE Configuring LegalLens Environment...$RESET"
        Write-Host ""

        # Backend .env
        $BackendEnv = Join-Path $BackendPath ".env"

        Write-Host "$YELLOW Backend environment:$RESET"

        if (Test-Path $BackendEnv) {
            Write-Success ".env exists"
            Write-Host $BackendEnv
        }
        else {
            Write-Warning-Msg "Backend .env does not exist."
            Write-Host "Create:"
            Write-Host $BackendEnv
        }

        # Frontend environment
        $FrontendEnvExample = Join-Path $FrontendPath ".env.example"
        $FrontendEnv = Join-Path $FrontendPath ".env.local"

        Write-Host ""
        Write-Host "$YELLOW Frontend environment:$RESET"

        if (Test-Path $FrontendEnvExample) {

            if (-not (Test-Path $FrontendEnv)) {

                Copy-Item $FrontendEnvExample $FrontendEnv

                Write-Success ".env.local created from .env.example"
            }
            else {
                Write-Success ".env.local already exists"
            }

            Write-Host ""
            Write-Host "Edit:"
            Write-Host $FrontendEnv
        }
        else {

            Write-Warning-Msg ".env.example was not found."

            if (-not (Test-Path $FrontendEnv)) {

                New-Item -ItemType File -Path $FrontendEnv -Force | Out-Null

                Write-Success "Created empty .env.local"
            }
        }

        Write-Host ""
        Write-Host "$YELLOW Expected frontend variables:$RESET"
        Write-Host ""

        Write-Host "NEXT_PUBLIC_API_URL=http://localhost:8000"
        Write-Host "NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co"
        Write-Host "NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_KEY"

        Write-Host ""
        Write-Warning-Msg "Do not put Supabase service-role keys or other secrets in NEXT_PUBLIC_* variables."
    }

    # ========================================================
    # ACTION 5 - TESTS
    # ========================================================

    "5" {

        Write-Host ""
        Write-Host "$BLUE Running LegalLens Tests...$RESET"
        Write-Host ""

        if (-not $VenvPath) {
            Write-Error-Msg "Python virtual environment not found."
            exit 1
        }

        $VenvPython = Join-Path $VenvPath "Scripts\python.exe"

        Write-Status "Checking Python" "..."

        & $VenvPython --version

        # Check pytest
        $PytestCheck = & $VenvPython -m pytest --version 2>&1

        if ($LASTEXITCODE -ne 0) {

            Write-Warning-Msg "pytest is not installed in the virtual environment."

            Write-Host ""
            Write-Host "Install it with:"
            Write-Host "& `"$VenvPython`" -m pip install pytest"
            Write-Host ""

            exit 1
        }

        Write-Host $PytestCheck

        # Database URL
        if (-not $env:DATABASE_URL) {

            $env:DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/legalens"

            Write-Info "DATABASE_URL was not set."
            Write-Info "Using local PostgreSQL default."
        }

        $env:PYTHONPATH = $BackendPath

        $IntegrationTests = Join-Path $Phase5Root "tests\integration"

        if (-not (Test-Path $IntegrationTests)) {

            Write-Warning-Msg "Integration test directory not found:"
            Write-Host $IntegrationTests

            Write-Host ""
            Write-Info "Searching for test directories..."

            Get-ChildItem -Path $Phase5Root -Directory -Recurse -ErrorAction SilentlyContinue |
                Where-Object {
                    $_.Name -match "tests?"
                } |
                Select-Object -First 20 FullName |
                Format-Table -AutoSize

            exit 1
        }

        Set-Location $BackendPath

        Write-Status "Running integration tests" "..."

        & $VenvPython -m pytest $IntegrationTests -v

        if ($LASTEXITCODE -eq 0) {
            Write-Success "All tests passed."
        }
        else {
            Write-Error-Msg "Some tests failed."
            exit $LASTEXITCODE
        }
    }

    # ========================================================
    # ACTION 6 - ENVIRONMENT CHECK
    # ========================================================

    "6" {

        Write-Host ""
        Write-Host "$BLUE LegalLens Environment Check$RESET"
        Write-Host ""

        Write-Host "$YELLOW Project:$RESET"
        Write-Host "Project root : $ProjectRoot"
        Write-Host "Phase 5 root : $Phase5Root"
        Write-Host "LegalLens    : $LegalLensRoot"
        Write-Host "Backend      : $BackendPath"
        Write-Host "Frontend     : $FrontendPath"

        Write-Host ""

        # Python
        Write-Host "$YELLOW Python:$RESET"

        if ($VenvPath) {

            $VenvPython = Join-Path $VenvPath "Scripts\python.exe"

            Write-Success "Virtual environment found"
            Write-Host "Location: $VenvPath"

            & $VenvPython --version

        }
        else {
            Write-Error-Msg "Virtual environment not found."
        }

        Write-Host ""

        # Node
        Write-Host "$YELLOW Node.js:$RESET"

        $node = Get-Command node -ErrorAction SilentlyContinue

        if ($node) {
            Write-Success "Node.js found"
            node --version
        }
        else {
            Write-Error-Msg "Node.js not found"
        }

        Write-Host ""

        # npm
        Write-Host "$YELLOW npm:$RESET"

        $npm = Get-Command npm -ErrorAction SilentlyContinue

        if ($npm) {
            Write-Success "npm found"
            npm --version
        }
        else {
            Write-Error-Msg "npm not found"
        }

        Write-Host ""

        # Docker
        Write-Host "$YELLOW Docker:$RESET"

        $docker = Get-Command docker -ErrorAction SilentlyContinue

        if ($docker) {
            Write-Success "Docker found"
            docker --version
        }
        else {
            Write-Warning-Msg "Docker not found"
        }

        Write-Host ""

        # Files
        Write-Host "$YELLOW Important files:$RESET"

        $FilesToCheck = @(
            (Join-Path $BackendPath "app\main.py"),
            (Join-Path $BackendPath "requirements.txt"),
            (Join-Path $FrontendPath "package.json"),
            (Join-Path $FrontendPath ".env.local")
        )

        foreach ($File in $FilesToCheck) {

            if (Test-Path $File) {
                Write-Success $File
            }
            else {
                Write-Warning-Msg "Missing: $File"
            }
        }
    }

    # ========================================================
    # INVALID OPTION
    # ========================================================

    default {

        Write-Error-Msg "Invalid choice: $choice"

        Write-Host ""
        Write-Host "Choose a number from 1 to 6."
    }
}

# ============================================================
# FINISH
# ============================================================

Set-Location $ProjectRoot

Write-Host ""
Write-Host "$BLUE LegalLens deployment script finished.$RESET"
Write-Host ""