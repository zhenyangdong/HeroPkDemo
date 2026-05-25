$ErrorActionPreference = 'Stop'

Push-Location $PSScriptRoot
try {
    [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $OutputEncoding = [Console]::OutputEncoding

    chcp 65001 > $null
    $env:JAVA_TOOL_OPTIONS = '-Dfile.encoding=UTF-8 -Dsun.stdout.encoding=UTF-8 -Dsun.stderr.encoding=UTF-8'

    mvn clean spring-boot:run "-Dspring-boot.run.arguments=--terminal"
}
finally {
    Pop-Location
}
