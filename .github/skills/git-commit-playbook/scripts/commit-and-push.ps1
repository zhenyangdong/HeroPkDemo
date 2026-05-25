param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath,
    [string]$CommitMessage,
    [switch]$Push,
    [switch]$AutoMessage,
    [string]$TypePrefix = "chore"
)

$ErrorActionPreference = 'Stop'

function New-AutoCommitMessage {
    param(
        [string[]]$Files,
        [string]$Prefix
    )

    if (-not $Files -or $Files.Count -eq 0) {
        return "${Prefix}: update project files"
    }

    $first = $Files[0]
    $topScope = "project"
    if ($first -match '^[^\\/]+') {
        $topScope = $matches[0]
    }

    $shown = @($Files | Select-Object -First 3)
    $rest = $Files.Count - $shown.Count
    $detail = ($shown -join ', ')
    if ($rest -gt 0) {
        $detail = "$detail, +$rest files"
    }

    return "${Prefix}: update $topScope ($detail)"
}

Push-Location $ProjectPath
try {
    $insideRepo = (git rev-parse --is-inside-work-tree 2>$null)
    if ($LASTEXITCODE -ne 0 -or $insideRepo -ne 'true') {
        throw "Not a git repository: $ProjectPath"
    }

    $branch = (git branch --show-current).Trim()
    if ([string]::IsNullOrWhiteSpace($branch)) {
        throw "Cannot determine current branch."
    }

    $status = git status --porcelain
    if (-not $status) {
        Write-Host "No changes to commit."
        return
    }

    Write-Host "Staging changes..."
    git add -A

    $stagedFiles = @(git diff --cached --name-only)

    if ($AutoMessage) {
        if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
            $CommitMessage = New-AutoCommitMessage -Files $stagedFiles -Prefix $TypePrefix
        }
    }

    if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
        throw "CommitMessage is required unless -AutoMessage is enabled."
    }

    Write-Host "Committing..."
    Write-Host "Commit message: $CommitMessage"
    git commit -m $CommitMessage
    if ($LASTEXITCODE -ne 0) {
        throw "Commit failed."
    }

    $hash = (git rev-parse --short HEAD).Trim()
    $changedCount = ($status | Measure-Object).Count

    Write-Host "Commit success."
    Write-Host "Branch: $branch"
    Write-Host "Commit: $hash"
    Write-Host "Changed entries: $changedCount"

    if ($Push) {
        Write-Host "Pushing to origin/$branch ..."
        git push origin $branch
        if ($LASTEXITCODE -ne 0) {
            throw "Push failed. Local commit is kept."
        }
        Write-Host "Push success."
    }
}
finally {
    Pop-Location
}
