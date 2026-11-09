param(
    [switch]$Context,
    [switch]$Jarvis,
    [switch]$Microphone,
    [string]$LensStudio = "$env:ProgramFiles\Snap Inc\Lens Studio\Lens Studio.exe"
)

$ErrorActionPreference = 'Stop'
$project = Join-Path $PSScriptRoot 'Spatial.esproj'
$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
$bridge = Join-Path $PSScriptRoot 'bridge\spatial.py'

if (!(Test-Path -LiteralPath $LensStudio -PathType Leaf)) {
    throw 'Install Lens Studio or supply its executable using -LensStudio.'
}
if (!(Test-Path -LiteralPath $python -PathType Leaf)) {
    py -3 -m venv (Join-Path $PSScriptRoot '.venv')
    if ($LASTEXITCODE) { throw 'Install Python with the py launcher and try again.' }
}
& $python -m pip show Pillow *> $null
if ($LASTEXITCODE) {
    & $python -m pip install -r (Join-Path $PSScriptRoot 'bridge\requirements.txt')
    if ($LASTEXITCODE) { throw 'Could not install the bridge dependencies.' }
}
if (Get-NetTCPConnection -LocalPort 48790 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Port 48790 is already in use. Stop the previous companion before starting a new one.'
}
if (Get-Process -Name 'Lens Studio' -ErrorAction SilentlyContinue) {
    Write-Host 'Lens Studio is already running. Open Spatial.esproj there if needed.'
} else {
    Start-Process -FilePath $LensStudio -ArgumentList ('"' + $project + '"')
}

$bridgeArgs = @('--desktop')
if ($Context) { $bridgeArgs += '--context' }
if ($Jarvis) { $bridgeArgs += '--jarvis' }
if ($Microphone) { $bridgeArgs += '--microphone' }
& $python $bridge @bridgeArgs
exit $LASTEXITCODE
