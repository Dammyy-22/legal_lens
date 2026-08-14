# LegalLens - Local Development & Deployment Script

# Colors for output
$GREEN = "`e[32m"
$BLUE = "`e[34m"
$YELLOW = "`e[33m"
$RED = "`e[31m"
$RESET = "`e[0m"

function Write-Status {
    param([string]$Message, [string]$Status)
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

# Get project root
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host "`n$BLUE╔════════════════════════════════════════╗$RESET"
Write-Host "$BLUE║   LegalLens Deployment Script          ║$RESET"
Write-Host "$BLUE╚════════════════════════════════════════╝$RESET`n"

# Check if running from correct directory
if ((Get-Location).Path -ne $ProjectRoot) {
    Write-Host "$YELLOW Note: Running from $((Get-Location).Path)$RESET"
}

# Ask what to do
Write-Host "$YELLOW Choose an action:$RESET"
Write-Host "1. Start local development (frontend + backend)"
Write-Host "2. Build for production"
Write-Host "3. Deploy to Vercel (frontend)"
Write-Host "4. Configure environment"
Write-Host "5. Run tests"
Write-Host ""
$choice = Read-Host "Enter choice (1-5)"

switch ($choice) {
    "1" {
        Write-Host "`n$BLUE Starting Local Development...$RESET`n"
        
        # Start backend
        Write-Status "Starting FastAPI backend" "..."
        $BackendPath = Join-Path $ProjectRoot "legalens-phase5/legalens/apps/api"
        
        if (Test-Path $BackendPath) {
            Write-Host "$GREEN✓ Backend found at $BackendPath$RESET"
            Write-Host "`n$YELLOW Run in Terminal 1:$RESET"
            Write-Host "cd $BackendPath"
            Write-Host ".\.venv\Scripts\Activate.ps1"
            Write-Host "uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
        } else {
            Write-Error-Msg "Backend not found at $BackendPath"
        }
        
        # Start frontend
        Write-Host "`n$YELLOW Run in Terminal 2:$RESET"
        $FrontendPath = Join-Path $ProjectRoot "legalens-phase5/legalens/apps/web"
        if (Test-Path $FrontendPath) {
            Write-Host "cd $FrontendPath"
            Write-Host "npm install  # First time only"
            Write-Host "npm run dev"
            Write-Host "`n$GREEN Frontend will run on http://localhost:3000$RESET"
            Write-Host "$GREEN Backend will run on http://localhost:8000$RESET"
        }
    }
    
    "2" {
        Write-Host "`n$BLUE Building for Production...$RESET`n"
        
        # Build frontend
        $FrontendPath = Join-Path $ProjectRoot "legalens-phase5/legalens/apps/web"
        if (Test-Path $FrontendPath) {
            Write-Status "Building frontend" "installing dependencies..."
            Set-Location $FrontendPath
            npm install
            
            Write-Status "Building frontend" "building..."
            npm run build
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Frontend built successfully!"
                Write-Host "$YELLOW Build output in: $FrontendPath/.next$RESET"
            } else {
                Write-Error-Msg "Frontend build failed"
            }
        }
        
        # Build backend (Docker)
        Write-Host "`n$BLUE Backend (Docker):$RESET"
        $BackendPath = Join-Path $ProjectRoot "legalens-phase5/legalens/apps/api"
        Write-Host "cd $BackendPath"
        Write-Host "docker build -t legalens-api:latest ."
    }
    
    "3" {
        Write-Host "`n$BLUE Deploying to Vercel...$RESET`n"
        
        $FrontendPath = Join-Path $ProjectRoot "legalens-phase5/legalens/apps/web"
        if (Test-Path $FrontendPath) {
            Set-Location $FrontendPath
            
            Write-Host "$YELLOW Make sure you have:$RESET"
            Write-Host "1. Vercel account (vercel.com)"
            Write-Host "2. Vercel CLI installed (npm i -g vercel)"
            Write-Host "3. GitHub repo linked"
            Write-Host "4. Environment variables set in Vercel dashboard:"
            Write-Host "   - NEXT_PUBLIC_API_URL"
            Write-Host "   - NEXT_PUBLIC_SUPABASE_URL"
            Write-Host "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
            Write-Host ""
            
            $deploy = Read-Host "Ready to deploy? (y/n)"
            if ($deploy -eq "y") {
                Write-Status "Deploying to Vercel" "..."
                vercel --prod
                Write-Success "Deployment initiated!"
            }
        }
    }
    
    "4" {
        Write-Host "`n$BLUE Configuring Environment...$RESET`n"
        
        Write-Host "$YELLOW Backend (.env)$RESET"
        $BackendEnv = Join-Path $ProjectRoot "legalens-phase5/legalens/apps/api/.env"
        if (Test-Path $BackendEnv) {
            Write-Success ".env exists"
            Write-Host "Edit: $BackendEnv"
        }
        
        Write-Host "`n$YELLOW Frontend (.env.local)$RESET"
        $FrontendEnvExample = Join-Path $ProjectRoot "legalens-phase5/legalens/apps/web/.env.example"
        $FrontendEnv = Join-Path $ProjectRoot "legalens-phase5/legalens/apps/web/.env.local"
        
        if (Test-Path $FrontendEnvExample) {
            if (-not (Test-Path $FrontendEnv)) {
                Copy-Item $FrontendEnvExample $FrontendEnv
                Write-Success ".env.local created from .env.example"
            }
            Write-Host "Edit: $FrontendEnv"
        }
        
        Write-Host "`n$YELLOW Required variables:$RESET"
        Write-Host "NEXT_PUBLIC_API_URL=http://localhost:8000  (local) or https://api.example.com (prod)"
        Write-Host "NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co"
        Write-Host "NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx"
    }
    
    "5" {
        Write-Host "`n$BLUE Running Tests...$RESET`n"
        
        $BackendPath = Join-Path $ProjectRoot "legalens-phase5/legalens/apps/api"
        if (Test-Path $BackendPath) {
            Set-Location $BackendPath
            
            Write-Status "Activating venv" "..."
            & ".\.venv\Scripts\Activate.ps1"
            
            Write-Status "Running integration tests" "..."
            if (-not $env:DATABASE_URL) {
                $env:DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/legalens"
            }
            $env:PYTHONPATH = (Get-Location)
            
            pytest ..\..\tests\integration -v
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "All tests passed!"
            } else {
                Write-Error-Msg "Some tests failed"
            }
        }
    }
    
    default {
        Write-Error-Msg "Invalid choice"
    }
}

Write-Host "`n"
