$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$distDir = Join-Path $root 'dist'
$bundleName = 'electronppt-portable-win32-x64'
$bundleDir = Join-Path $distDir $bundleName
$zipPath = Join-Path $distDir ($bundleName + '.zip')

if (-not (Test-Path $distDir)) {
  New-Item -ItemType Directory -Path $distDir | Out-Null
}

if (Test-Path $bundleDir) {
  Remove-Item -Path $bundleDir -Recurse -Force
}

if (Test-Path $zipPath) {
  Remove-Item -Path $zipPath -Force
}

npx electron-packager . electronppt-portable --platform=win32 --arch=x64 --out=dist --overwrite --prune=true --ignore="^/dist$"

Compress-Archive -Path "$bundleDir\*" -DestinationPath $zipPath -Force
Write-Output "ZIP_CREATED:$zipPath"
