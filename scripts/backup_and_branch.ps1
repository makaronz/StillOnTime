param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$LogFile = 'logs/backup.log'
if (!(Test-Path (Split-Path $LogFile))) {
  New-Item -ItemType Directory -Path (Split-Path $LogFile) -Force | Out-Null
}
"[backup] start $(Get-Date -Format o)" | Tee-Object -FilePath $LogFile -Append

$timestamp = Get-Date -Format 'yyyyMMdd-HHmm'
$tagName = "pre-cleanup-$timestamp"
$branchName = 'chore/repo-cleanup-and-boot'
$archivePrefix = "stillontime-pre-cleanup-$timestamp"

function Invoke-Step {
  param([string]$Command)
  if ($DryRun) {
    "[backup][dry-run] $Command" | Tee-Object -FilePath $LogFile -Append
  } else {
    "[backup] $Command" | Tee-Object -FilePath $LogFile -Append
    Invoke-Expression $Command
  }
}

Invoke-Step 'git status -sb'
Invoke-Step "if (git tag --list $tagName) { Write-Output '[backup] Tag już istnieje' } else { git tag $tagName }"
Invoke-Step "if (git branch --list $branchName) { Write-Output '[backup] Gałąź już istnieje' } else { git checkout -b $branchName }"
Invoke-Step "git archive --format=zip --output=BACKUP/$archivePrefix.zip HEAD"
Invoke-Step "git archive --format=tar --output=BACKUP/$archivePrefix.tar HEAD"
Invoke-Step "gzip -f BACKUP/$archivePrefix.tar"
Invoke-Step "Set-Location ..; zip -r StillOnTime-$archivePrefix.zip StillOnTime; Set-Location -"
Invoke-Step "sha256sum BACKUP/$archivePrefix.zip BACKUP/$archivePrefix.tar.gz > BACKUP/checksums.txt"
Invoke-Step "git rev-parse HEAD > BACKUP/latest-commit.txt"

if (-not $DryRun) {
  $zipHash = (Get-FileHash -Algorithm SHA256 -Path "BACKUP/$archivePrefix.zip").Hash
  $tarHash = (Get-FileHash -Algorithm SHA256 -Path "BACKUP/$archivePrefix.tar.gz").Hash
  @{
    tag = $tagName
    branch = $branchName
    archives = @(
      @{ path = "BACKUP/$archivePrefix.zip"; sha256 = $zipHash },
      @{ path = "BACKUP/$archivePrefix.tar.gz"; sha256 = $tarHash }
    )
    generated_at = $timestamp
  } | ConvertTo-Json -Depth 5 | Set-Content -Path 'BACKUP/checksums.json'
}

"[backup] done $(Get-Date -Format o)" | Tee-Object -FilePath $LogFile -Append
