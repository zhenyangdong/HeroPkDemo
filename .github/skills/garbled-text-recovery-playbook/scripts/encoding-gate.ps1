param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath,
    [string]$ProfilePath,
    [string]$TerminalRunCommand,
    [string]$WebRunCommand,
    [string]$ApiProbeUrl,
    [string]$FrontendProbeUrl,
    [string[]]$ProbePhrases,
    [Nullable[bool]]$AutoDiscoverProbePhrases,
    [Nullable[int]]$MinProbeCount,
    [Nullable[int]]$WebStartupWaitSeconds,
    [string]$BuildCommand,
    [string]$JavaToolOptions
)

$ErrorActionPreference = 'Stop'

function Get-ProfileConfig {
    param([string]$Path)

    if (-not $Path) {
        return @{}
    }
    $resolvedPath = $Path
    if (-not [System.IO.Path]::IsPathRooted($resolvedPath)) {
        $resolvedPath = Join-Path -Path $PSScriptRoot -ChildPath $resolvedPath
    }

    if (-not (Test-Path $resolvedPath)) {
        throw "Profile file not found: $Path"
    }
    return Get-Content -Path $resolvedPath -Raw | ConvertFrom-Json -AsHashtable
}

function Resolve-Value {
    param(
        $ParamValue,
        $ProfileValue,
        $DefaultValue
    )

    if ($null -ne $ParamValue) {
        if ($ParamValue -is [string] -and [string]::IsNullOrWhiteSpace($ParamValue)) {
            return $ProfileValue
        }
        return $ParamValue
    }
    if ($null -ne $ProfileValue) {
        return $ProfileValue
    }
    return $DefaultValue
}

function Get-ChineseCandidatePhrases {
    param(
        [string]$Text,
        [int]$Limit = 12
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return @()
    }

    $matches = [regex]::Matches($Text, '[\u4e00-\u9fff]{2,8}')
    if ($matches.Count -eq 0) {
        return @()
    }

    $freq = @{}
    foreach ($m in $matches) {
        $v = $m.Value
        if (-not $freq.ContainsKey($v)) {
            $freq[$v] = 0
        }
        $freq[$v]++
    }

    return $freq.GetEnumerator() |
        Sort-Object -Property Value -Descending |
        Select-Object -First $Limit |
        ForEach-Object { $_.Key }
}

function Merge-ProbePhrases {
    param(
        [string[]]$Base,
        [string[]]$Extra,
        [int]$NeedCount
    )

    $set = New-Object System.Collections.Generic.HashSet[string]

    foreach ($arr in @($Base, $Extra)) {
        if ($null -eq $arr) { continue }
        foreach ($item in $arr) {
            if ([string]::IsNullOrWhiteSpace($item)) { continue }
            [void]$set.Add($item.Trim())
        }
    }

    $list = @($set)
    if ($list.Count -lt $NeedCount) {
        throw "Insufficient probe phrases. Need at least $NeedCount, but got $($list.Count)."
    }
    return $list
}

function Start-WebServerProcess {
    param(
        [string]$Command,
        [int]$WaitSeconds
    )

    if ([string]::IsNullOrWhiteSpace($Command)) {
        return $null
    }

    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Command))
    $proc = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-EncodedCommand", $encoded -PassThru -WindowStyle Hidden
    if ($WaitSeconds -gt 0) {
        [System.Threading.Thread]::Sleep($WaitSeconds * 1000)
    }
    return $proc
}

function Test-ContainsPhrase {
    param(
        [string]$Text,
        [string[]]$Phrases
    )

    foreach ($p in $Phrases) {
        if ($Text -like "*$p*") {
            return $true
        }
    }
    return $false
}

Push-Location $ProjectPath
try {
    $profile = Get-ProfileConfig -Path $ProfilePath

    $TerminalRunCommand = Resolve-Value -ParamValue $TerminalRunCommand -ProfileValue $profile.terminalRunCommand -DefaultValue $null
    $WebRunCommand = Resolve-Value -ParamValue $WebRunCommand -ProfileValue $profile.webRunCommand -DefaultValue $null
    $ApiProbeUrl = Resolve-Value -ParamValue $ApiProbeUrl -ProfileValue $profile.apiProbeUrl -DefaultValue $null
    $FrontendProbeUrl = Resolve-Value -ParamValue $FrontendProbeUrl -ProfileValue $profile.frontendProbeUrl -DefaultValue $null
    $ProbePhrases = Resolve-Value -ParamValue $ProbePhrases -ProfileValue $profile.probePhrases -DefaultValue @()
    $AutoDiscoverProbePhrases = Resolve-Value -ParamValue $AutoDiscoverProbePhrases -ProfileValue $profile.autoDiscoverProbePhrases -DefaultValue $true
    $MinProbeCount = Resolve-Value -ParamValue $MinProbeCount -ProfileValue $profile.minProbeCount -DefaultValue 2
    $WebStartupWaitSeconds = Resolve-Value -ParamValue $WebStartupWaitSeconds -ProfileValue $profile.webStartupWaitSeconds -DefaultValue 6
    $BuildCommand = Resolve-Value -ParamValue $BuildCommand -ProfileValue $profile.buildCommand -DefaultValue "mvn -q -DskipTests clean package"
    $JavaToolOptions = Resolve-Value -ParamValue $JavaToolOptions -ProfileValue $profile.javaToolOptions -DefaultValue "-Dfile.encoding=UTF-8 -Dsun.stdout.encoding=UTF-8 -Dsun.stderr.encoding=UTF-8"

    [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $OutputEncoding = [Console]::OutputEncoding
    chcp 65001 > $null
    $env:JAVA_TOOL_OPTIONS = $JavaToolOptions

    Write-Host "[1/4] Clean build"
    Invoke-Expression $BuildCommand
    if ($LASTEXITCODE -ne 0) {
        throw "Clean build failed."
    }

    $result = [ordered]@{
        build = 'pass'
        terminal = 'skip'
        api = 'skip'
        frontend = 'skip'
    }

    $phaseOutputs = @{}
    $webProc = $null

    if ($TerminalRunCommand) {
        Write-Host "[2/4] Terminal probe"
        $terminalOut = Invoke-Expression $TerminalRunCommand | Out-String
        $phaseOutputs.terminal = $terminalOut
        $result.terminal = if (Test-ContainsPhrase -Text $terminalOut -Phrases $ProbePhrases) { 'pass' } else { 'fail' }
    }

    if (($ApiProbeUrl -or $FrontendProbeUrl) -and $WebRunCommand) {
        Write-Host "[2.5/4] Start web probe server"
        $webProc = Start-WebServerProcess -Command $WebRunCommand -WaitSeconds $WebStartupWaitSeconds
    }

    if ($ApiProbeUrl) {
        Write-Host "[3/4] API probe"
        $apiOut = Invoke-RestMethod -Method Get -Uri $ApiProbeUrl | ConvertTo-Json -Depth 5
        $phaseOutputs.api = $apiOut
        $result.api = if (Test-ContainsPhrase -Text $apiOut -Phrases $ProbePhrases) { 'pass' } else { 'fail' }
    }

    if ($FrontendProbeUrl) {
        Write-Host "[4/4] Frontend probe"
        $frontOut = (Invoke-WebRequest -UseBasicParsing -Uri $FrontendProbeUrl).Content
        $phaseOutputs.frontend = $frontOut
        $result.frontend = if (Test-ContainsPhrase -Text $frontOut -Phrases $ProbePhrases) { 'pass' } else { 'fail' }
    }

    if ($AutoDiscoverProbePhrases) {
        $discoverText = ""
        if ($phaseOutputs.ContainsKey('api')) { $discoverText += "`n" + $phaseOutputs.api }
        if ($phaseOutputs.ContainsKey('frontend')) { $discoverText += "`n" + $phaseOutputs.frontend }
        if ($phaseOutputs.ContainsKey('terminal')) { $discoverText += "`n" + $phaseOutputs.terminal }

        $discovered = Get-ChineseCandidatePhrases -Text $discoverText -Limit 12
        $ProbePhrases = Merge-ProbePhrases -Base $ProbePhrases -Extra $discovered -NeedCount $MinProbeCount

        if ($result.terminal -ne 'skip' -and $result.terminal -eq 'fail' -and (Test-ContainsPhrase -Text $phaseOutputs.terminal -Phrases $ProbePhrases)) {
            $result.terminal = 'pass'
        }
        if ($result.api -ne 'skip' -and $result.api -eq 'fail' -and (Test-ContainsPhrase -Text $phaseOutputs.api -Phrases $ProbePhrases)) {
            $result.api = 'pass'
        }
        if ($result.frontend -ne 'skip' -and $result.frontend -eq 'fail' -and (Test-ContainsPhrase -Text $phaseOutputs.frontend -Phrases $ProbePhrases)) {
            $result.frontend = 'pass'
        }
    } else {
        $ProbePhrases = Merge-ProbePhrases -Base $ProbePhrases -Extra @() -NeedCount $MinProbeCount
    }

    [ordered]@{
        projectPath = $ProjectPath
        probePhrases = $ProbePhrases
        autoDiscoverProbePhrases = $AutoDiscoverProbePhrases
        webRunCommandEnabled = -not [string]::IsNullOrWhiteSpace($WebRunCommand)
        result = $result
    } | ConvertTo-Json -Depth 5

    if ($result.Values -contains 'fail') {
        throw "Encoding gate failed in one or more channels."
    }

    Write-Host "Encoding gate passed."
}
finally {
    if ($webProc -and -not $webProc.HasExited) {
        Stop-Process -Id $webProc.Id -Force
    }
    Pop-Location
}
