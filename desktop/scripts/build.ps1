<#
.SYNOPSIS
    Compila (e opcionalmente publica/executa) o Frete Líquido desktop.

.EXAMPLE
    .\scripts\build.ps1
    .\scripts\build.ps1 -Run
    .\scripts\build.ps1 -Publish -Runtime win-x64
#>
[CmdletBinding()]
param(
    [switch]$Run,
    [switch]$Publish,
    [string]$Runtime = "win-x64",
    [string]$Configuration = "Release"
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot

function Testar-Sdk {
    $dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
    if (-not $dotnet) {
        throw "SDK do .NET não encontrado. Instale o .NET SDK 8.0 ou superior em https://dotnet.microsoft.com/download e reabra o terminal."
    }

    $sdks = & dotnet --list-sdks 2>$null
    if (-not $sdks) {
        throw "O comando 'dotnet' existe, mas nenhum SDK está instalado (apenas runtimes). Instale o .NET SDK 8.0+."
    }

    Write-Host "SDK encontrado:" -ForegroundColor DarkGray
    $sdks | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
}

Testar-Sdk

Push-Location $raiz
try {
    Write-Host "`n> dotnet build FreteLiquido.sln -c $Configuration" -ForegroundColor Cyan
    & dotnet build "FreteLiquido.sln" -c $Configuration
    if ($LASTEXITCODE -ne 0) { throw "Falha no build (exit $LASTEXITCODE)." }

    if ($Publish) {
        $destino = Join-Path $raiz "artefatos\$Runtime"
        Write-Host "`n> dotnet publish ($Runtime autocontido) -> $destino" -ForegroundColor Cyan
        & dotnet publish "src\FreteLiquido.Desktop" -c $Configuration -r $Runtime `
            --self-contained true -p:PublishSingleFile=true `
            -p:IncludeNativeLibrariesForSelfExtract=true -o $destino
        if ($LASTEXITCODE -ne 0) { throw "Falha no publish (exit $LASTEXITCODE)." }
        Write-Host "Pacote em $destino" -ForegroundColor Green
    }

    if ($Run) {
        Write-Host "`n> dotnet run" -ForegroundColor Cyan
        & dotnet run --project "src\FreteLiquido.Desktop" -c $Configuration
    }
}
finally {
    Pop-Location
}
