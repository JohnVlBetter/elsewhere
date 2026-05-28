param(
  [int]$Port = 3000,
  [string]$HostName = "127.0.0.1",
  [int]$TimeoutSeconds = 45
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$tmpRoot = Join-Path $repoRoot ".tmp"
$pidPath = Join-Path $tmpRoot "web-dev.pid"
$outLog = Join-Path $tmpRoot "web-dev-current.out.log"
$errLog = Join-Path $tmpRoot "web-dev-current.err.log"

function Get-PortListenerProcessIds {
  param([int]$Port)

  $processIds = @()
  foreach ($line in (netstat -ano -p tcp)) {
    $parts = @($line.Trim() -split "\s+")
    if ($parts.Count -lt 5 -or $parts[0] -ne "TCP" -or $parts[3] -ne "LISTENING") {
      continue
    }

    $processId = 0
    if ($parts[1].EndsWith(":$Port") -and [int]::TryParse($parts[4], [ref]$processId)) {
      $processIds += $processId
    }
  }

  $processIds | Sort-Object -Unique
}

function Stop-ProcessId {
  param(
    [int]$ProcessId,
    [string]$Reason
  )

  if ($ProcessId -eq $PID) {
    return
  }

  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($null -eq $process) {
    return
  }

  Write-Host "Stopping PID $ProcessId ($($process.ProcessName)) - $Reason"
  try {
    Stop-Process -Id $ProcessId -Force -ErrorAction Stop
  } catch {
    & taskkill.exe /PID $ProcessId /T /F | Out-Null
  }

  for ($i = 0; $i -lt 40; $i++) {
    if ($null -eq (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
      return
    }
    Start-Sleep -Milliseconds 250
  }

  throw "PID $ProcessId is still running. Start this script from an elevated PowerShell if Windows denies termination."
}

function Stop-PreviousServer {
  if (Test-Path -LiteralPath $pidPath) {
    $rawPid = (Get-Content -LiteralPath $pidPath -Raw).Trim()
    $recordedPid = 0
    if ([int]::TryParse($rawPid, [ref]$recordedPid)) {
      Stop-ProcessId -ProcessId $recordedPid -Reason "previous web-dev.pid"
    }
    Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
  }

  foreach ($processId in @(Get-PortListenerProcessIds -Port $Port)) {
    Stop-ProcessId -ProcessId $processId -Reason "port $Port listener"
  }
}

function Wait-ForServer {
  param([string]$Url)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  } while ((Get-Date) -lt $deadline)

  Write-Host "---- stdout ----"
  Get-Content -LiteralPath $outLog -Tail 60 -ErrorAction SilentlyContinue
  Write-Host "---- stderr ----"
  Get-Content -LiteralPath $errLog -Tail 60 -ErrorAction SilentlyContinue
  throw "Web server did not become ready at $Url within $TimeoutSeconds seconds."
}

New-Item -ItemType Directory -Force -Path $tmpRoot | Out-Null
Set-Location -LiteralPath $repoRoot
Stop-PreviousServer

$nodeArgs = @(
  "--require",
  "./scripts/sandbox-node-compat.cjs",
  "./scripts/next-dev-in-process.cjs",
  "--port",
  $Port.ToString(),
  "--hostname",
  $HostName
)

$process = Start-Process `
  -FilePath "node.exe" `
  -ArgumentList $nodeArgs `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -PassThru

Set-Content -LiteralPath $pidPath -Value $process.Id -Encoding ascii
$url = "http://$HostName`:$Port"
Wait-ForServer -Url $url
Write-Host "Web dev server ready: $url"
