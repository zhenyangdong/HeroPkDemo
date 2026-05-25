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
        return "${Prefix}(project): refine business workflow"
    }

    $scope = "project"
    if (($Files | Where-Object { $_ -like 'hero-pk/*' } | Measure-Object).Count -gt 0) {
        $scope = "hero-pk"
    } elseif (($Files | Where-Object { $_ -like '.github/*' } | Measure-Object).Count -gt 0) {
        $scope = "workflow"
    } else {
        $first = $Files[0]
        if ($first -match '^[^\\/]+') {
            $scope = $matches[0]
        }
    }

    $signals = New-Object System.Collections.Generic.List[string]
    $stagedPatch = (git diff --cached --unified=0) | Out-String

    if (($Files | Where-Object { $_ -match 'hero-pk/src/main/resources/config/skill-templates.json|HeroDataService\.java' } | Measure-Object).Count -gt 0 -or
        $stagedPatch -match 'loadSkillTemplateConfig|rageCostTiers|defaultRageCost|skill-templates\.json') {
        $signals.Add('externalize skill templates and rage-cost rules')
    }

    if (($Files | Where-Object { $_ -match 'hero-pk/src/main/resources/config/heroes\.json' } | Measure-Object).Count -gt 0 -or
        $stagedPatch -match 'nearDeathEnabled|style|heroes\.json') {
        $signals.Add('refine hero data configuration flow')
    }

    if (($Files | Where-Object { $_ -match 'BattleService\.java' } | Measure-Object).Count -gt 0 -or
        $stagedPatch -match 'nearDeath|poison|combo|rage') {
        $signals.Add('tune battle mechanics and state effects')
    }

    if (($Files | Where-Object { $_ -match 'src/main/resources/static/(app\.js|index\.html|styles\.css)' } | Measure-Object).Count -gt 0) {
        $signals.Add('improve battle UI presentation and readability')
    }

    if (($Files | Where-Object { $_ -match '\.github/skills/git-commit-playbook|\.github/agents' } | Measure-Object).Count -gt 0) {
        $signals.Add('standardize commit workflow and automation rules')
    }

    if (($Files | Where-Object { $_ -match 'HERO_PK_SYSTEM_DESIGN\.md|README\.md|\.md$' } | Measure-Object).Count -gt 0) {
        $signals.Add('update design and usage documentation')
    }

    if (($Files | Where-Object { $_ -match '/test/|Test\.java$' } | Measure-Object).Count -gt 0) {
        $signals.Add('add or adjust verification coverage')
    }

    $summaryList = @($signals | Select-Object -Unique)
    if ($summaryList.Count -eq 0) {
        $summary = 'refine business logic and project workflow'
    } else {
        $summary = ($summaryList | Select-Object -First 2) -join ' + '
    }

    return "${Prefix}(${scope}): $summary"
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
