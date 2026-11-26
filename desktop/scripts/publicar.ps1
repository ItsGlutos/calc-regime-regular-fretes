<#
.SYNOPSIS
    Publica o Frete Líquido desktop como executável único para Windows.

.DESCRIPTION
    Gera um binário self-contained (não exige .NET instalado na máquina de
    destino) em artefatos/app. É o insumo do instalador: o pacote final só
    precisa empacotar esta pasta.

.EXAMPLE
    & .\scripts\publicar.ps1
    & .\scripts\publicar.ps1 -Destino ..\artefatos\tmp
#>
[CmdletBinding()]
param(
    [string] $Configuracao = 'Release',
    [string] $Destino = "$PSScriptRoot\..\artefatos\app",
    [string] $Runtime = 'win-x64'
)

$ErrorActionPreference = 'Stop'

function Resolve-DotnetComSdk {
    # Ter o `dotnet` no PATH não basta: uma instalação só-runtime responde
    # "--list-sdks" com a lista vazia e falha no publish. Por isso o candidato
    # só é aceito se comprovar ao menos um SDK instalado.
    $candidatos = @()
    $noPath = Get-Command dotnet -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($noPath) { $candidatos += $noPath.Source }
    $candidatos += (Join-Path $env:LOCALAPPDATA 'Microsoft\dotnet\dotnet.exe')
    $candidatos += (Join-Path $env:ProgramFiles 'dotnet\dotnet.exe')

    foreach ($candidato in ($candidatos | Select-Object -Unique)) {
        if (-not $candidato -or -not (Test-Path $candidato)) { continue }
        $anterior = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $sdks = & $candidato --list-sdks 2>&1 | Where-Object { $_ -match '^\d+\.\d+\.' }
        } finally {
            $ErrorActionPreference = $anterior
        }
        if ($sdks) { return $candidato }
    }

    throw "Nenhum SDK .NET encontrado. Instale o SDK 8 (dotnet-install.ps1 -Channel 8.0) e tente de novo."
}

$dotnet = Resolve-DotnetComSdk

$projeto = Join-Path $PSScriptRoot '..\src\FreteLiquido.Desktop\FreteLiquido.Desktop.csproj'
$destino = [System.IO.Path]::GetFullPath($Destino)

Write-Output "Publicando $Runtime ($Configuracao) em $destino"

& $dotnet publish $projeto `
    -c $Configuracao `
    -r $Runtime `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -o $destino

if ($LASTEXITCODE -ne 0) { throw "Falha na publicação (exit $LASTEXITCODE)." }

$exe = Join-Path $destino 'FreteLiquido.exe'
if (-not (Test-Path $exe)) { throw "O executável não foi gerado em $exe." }

$tamanho = [Math]::Round((Get-Item $exe).Length / 1MB, 1)
Write-Output "OK: $exe ($tamanho MB)"
