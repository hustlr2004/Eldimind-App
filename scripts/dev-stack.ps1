$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$backendJob = $null
$frontendJob = $null
$mlJob = $null

function Stop-StackJob {
  param([System.Management.Automation.Job]$Job)

  if ($null -ne $Job) {
    try {
      Stop-Job -Job $Job -ErrorAction SilentlyContinue | Out-Null
    } catch {
    }

    try {
      Remove-Job -Job $Job -Force -ErrorAction SilentlyContinue | Out-Null
    } catch {
    }
  }
}

try {
  Write-Host "Starting EldiMind backend on http://localhost:4000"
  $backendJob = Start-Job -ScriptBlock {
    param($projectRoot)
    Set-Location $projectRoot
    npm run dev
  } -ArgumentList $root

  Write-Host "Starting EldiMind frontend on http://localhost:5173"
  $frontendJob = Start-Job -ScriptBlock {
    param($projectRoot)
    Set-Location (Join-Path $projectRoot "frontend")
    npm run dev -- --host 0.0.0.0
  } -ArgumentList $root

  Write-Host "Starting EldiMind ML service on http://localhost:8000"
  $mlJob = Start-Job -ScriptBlock {
    param($projectRoot)
    Set-Location (Join-Path $projectRoot "ml_service")
    if (Get-Command uvicorn -ErrorAction SilentlyContinue) {
      uvicorn app:app --reload --host 0.0.0.0 --port 8000
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
      python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
    } elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
      python3 -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
    } else {
      throw "Could not find uvicorn, python, or python3 for the ML service."
    }
  } -ArgumentList $root

  Write-Host ""
  Write-Host "EldiMind dev stack is starting."
  Write-Host "Frontend: http://localhost:5173"
  Write-Host "Backend:  http://localhost:4000"
  Write-Host "ML API:   http://localhost:8000"
  Write-Host ""
  Write-Host "MongoDB is not started locally because MONGODB_URI points to MongoDB Atlas."
  Write-Host "Press Ctrl+C to stop all services."
  Write-Host ""

  while ($true) {
    Receive-Job -Job $backendJob,$frontendJob,$mlJob -Keep
    Start-Sleep -Milliseconds 500
  }
}
finally {
  Stop-StackJob $backendJob
  Stop-StackJob $frontendJob
  Stop-StackJob $mlJob
}
