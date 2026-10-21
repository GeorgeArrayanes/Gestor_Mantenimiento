param(
    [string]$BlenderPath,
    [switch]$Preview,
    [ValidateSet('all', 'overview', 'administrativo', 'salones', 'preescolar', 'conjunto-bloques', 'bachillerato')]
    [string]$View = 'all'
)
$ErrorActionPreference = 'Stop'
if (-not $BlenderPath) {
    $portable = Join-Path $env:LOCALAPPDATA 'Programs\BlenderPortable\blender-4.5.9-windows-x64\blender.exe'
    if (Test-Path -LiteralPath $portable) { $BlenderPath = $portable }
    else {
        $installed = Get-Command blender -ErrorAction SilentlyContinue
        if ($installed) { $BlenderPath = $installed.Source }
    }
}
if (-not $BlenderPath -or -not (Test-Path -LiteralPath $BlenderPath)) {
    throw 'Indica la ruta de Blender 4.5 LTS con -BlenderPath. Este script no instala herramientas.'
}
$scriptPath = Join-Path $PSScriptRoot 'build_scene.py'
$renderArgs = @('--background', '--factory-startup', '--python-exit-code', '1', '--python', $scriptPath, '--', '--view', $View)
if ($Preview) { $renderArgs += '--preview' }
& $BlenderPath @renderArgs
if ($LASTEXITCODE -ne 0) { throw "Blender terminó con código $LASTEXITCODE" }

