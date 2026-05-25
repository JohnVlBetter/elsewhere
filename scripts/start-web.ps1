param(
  [int]$Port = 3000,
  [string]$HostName = "127.0.0.1"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $repoRoot

function Import-DotEnv {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith("#")) {
      return
    }

    $pair = $line -split "=", 2
    if ($pair.Count -ne 2) {
      return
    }

    $name = $pair[0].Trim()
    $value = $pair[1].Trim()
    if ($name.Length -eq 0) {
      return
    }

    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

function Stop-PortListeners {
  param([int]$Port)

  $processIds = @(Get-PortListenerProcessIds -Port $Port)

  if ($processIds.Count -eq 0) {
    Write-Host "Port $Port is free."
    return
  }

  foreach ($processId in $processIds) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($null -eq $process) {
      continue
    }

    Write-Host "Stopping process $processId ($($process.ProcessName)) using port $Port..."
    Stop-Process -Id $processId -Force

    for ($i = 0; $i -lt 20; $i++) {
      if ($null -eq (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
        break
      }
      Start-Sleep -Milliseconds 250
    }
  }

  $remaining = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  $remainingProcessIds = @(Get-PortListenerProcessIds -Port $Port)
  if ($remaining.Count -gt 0 -or $remainingProcessIds.Count -gt 0) {
    throw "Port $Port is still occupied after stopping previous listeners."
  }
}

function Get-PortListenerProcessIds {
  param([int]$Port)

  $processIds = @()
  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($null -ne $connections) {
    $processIds += @($connections | Where-Object { $_.OwningProcess -gt 0 } | Select-Object -ExpandProperty OwningProcess)
  }

  $netstatLines = netstat -ano -p tcp
  foreach ($line in $netstatLines) {
    $parts = @($line.Trim() -split "\s+")
    if ($parts.Count -lt 5 -or $parts[0] -ne "TCP") {
      continue
    }

    $localAddress = $parts[1]
    $state = $parts[3]
    $processId = 0
    if ($state -eq "LISTENING" -and $localAddress.EndsWith(":$Port") -and [int]::TryParse($parts[4], [ref]$processId)) {
      $processIds += $processId
    }
  }

  $processIds | Sort-Object -Unique
}

Import-DotEnv -Path (Join-Path $repoRoot ".env.local")
Stop-PortListeners -Port $Port

$env:PORT = $Port.ToString()

Write-Host "Starting web app at http://$HostName`:$Port"
& node --require ./scripts/sandbox-node-compat.cjs ./scripts/next-dev-in-process.cjs --port $Port --hostname $HostName
