# Sobe os motores oficiais da Receita (regime regular e Simples Nacional) e a aplicacao Frete Liquido.
# Uso:  .\run.ps1            (porta 5180)
#       .\run.ps1 -Abrir     (abre o navegador quando a aplicacao estiver no ar)
#       .\run.ps1 -Porta 5200

[CmdletBinding()]
param(
    [int]$Porta = 5180,
    [switch]$Abrir
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSCommandPath
$jar = Join-Path $raiz 'target\api-regime-geral.jar'
$jarSimples = Join-Path $raiz 'simples-nacional\target\api-simples-nacional.jar'
$app = Join-Path $raiz 'app'

function Testar-Porta {
    param([int]$Numero)
    $cliente = New-Object System.Net.Sockets.TcpClient
    try {
        $conexao = $cliente.BeginConnect('127.0.0.1', $Numero, $null, $null)
        if (-not $conexao.AsyncWaitHandle.WaitOne(400)) { return $false }
        $cliente.EndConnect($conexao)
        return $true
    } catch {
        return $false
    } finally {
        $cliente.Close()
    }
}

function Localizar-Java {
    $comando = Get-Command java -ErrorAction SilentlyContinue
    if ($comando) { return $comando.Source }

    if ($env:JAVA_HOME) {
        $candidato = Join-Path $env:JAVA_HOME 'bin\java.exe'
        if (Test-Path $candidato) { return $candidato }
    }

    $padroes = @(
        'C:\Program Files\Eclipse Adoptium\jdk-*\bin\java.exe',
        'C:\Program Files\Java\jdk-*\bin\java.exe',
        'C:\Program Files\Microsoft\jdk-*\bin\java.exe',
        'C:\Program Files\BellSoft\LibericaJDK-*\bin\java.exe'
    )
    foreach ($padrao in $padroes) {
        $achado = Get-ChildItem $padrao -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
        if ($achado) { return $achado.FullName }
    }
    return $null
}

function Iniciar-Motor {
    param(
        [Parameter(Mandatory)] [string]$Nome,
        [Parameter(Mandatory)] [int]$Porta,
        [Parameter(Mandatory)] [string]$Jar,
        [Parameter(Mandatory)] [string]$PrefixoLog,
        [Parameter(Mandatory)] [string]$Endereco,
        [Parameter(Mandatory)] [string]$Compilar
    )

    if (Testar-Porta $Porta) {
        Write-Host "  $Nome ja esta no ar em $Endereco" -ForegroundColor Green
        return $true
    }

    if (-not (Test-Path $Jar)) {
        Write-Host "  JAR do $Nome nao encontrado:" -ForegroundColor Red
        Write-Host "  $Jar" -ForegroundColor Red
        Write-Host "  Compile com:  $Compilar" -ForegroundColor Yellow
        return $false
    }

    $java = Localizar-Java
    if (-not $java) {
        Write-Host '  Java nao encontrado. Instale um JDK 25 ou ajuste o PATH/JAVA_HOME.' -ForegroundColor Red
        return $false
    }

    Write-Host "  Subindo $Nome com $java"
    $saida = Join-Path $raiz "$PrefixoLog.out"
    $erro = Join-Path $raiz "$PrefixoLog.err"
    Start-Process -FilePath $java `
        -ArgumentList @('-Dspring.profiles.active=offline', '-jar', $Jar) `
        -WorkingDirectory $raiz `
        -RedirectStandardOutput $saida `
        -RedirectStandardError $erro `
        -WindowStyle Hidden | Out-Null

    $tentativas = 0
    while (-not (Testar-Porta $Porta) -and $tentativas -lt 180) {
        Start-Sleep -Milliseconds 500
        $tentativas++
        if ($tentativas % 20 -eq 0) { Write-Host "  ... aguardando o $Nome ($([int]($tentativas / 2))s)" -ForegroundColor DarkGray }
    }

    if (-not (Testar-Porta $Porta)) {
        Write-Host "  O $Nome nao subiu. Veja $PrefixoLog.err e $PrefixoLog.out." -ForegroundColor Red
        return $false
    }
    Write-Host "  $Nome no ar em $Endereco" -ForegroundColor Green
    return $true
}

Write-Host ''
Write-Host '  Frete Liquido - simulador do pagador de frete' -ForegroundColor White
Write-Host '  ---------------------------------------------' -ForegroundColor DarkGray

# 1. Motores oficiais ----------------------------------------------------------------------------
if (-not (Iniciar-Motor -Nome 'Motor oficial (regime regular)' `
            -Porta 8080 -Jar $jar -PrefixoLog 'logs-app' `
            -Endereco 'http://127.0.0.1:8080' `
            -Compilar '.\mvnw.cmd -DskipTests package')) {
    exit 1
}

if (-not (Iniciar-Motor -Nome 'Motor do Simples Nacional' `
            -Porta 8082 -Jar $jarSimples -PrefixoLog 'logs-simples' `
            -Endereco 'http://127.0.0.1:8082' `
            -Compilar '.\mvnw.cmd -f simples-nacional\pom.xml -DskipTests package')) {
    exit 1
}

# 2. Aplicacao -----------------------------------------------------------------------------------
if (Testar-Porta $Porta) {
    $saude = $null
    try {
        $saude = & curl.exe -s --max-time 3 "http://127.0.0.1:$Porta/api/saude"
    } catch {
        $saude = $null
    }
    if (-not $saude) {
        try {
            $saude = (Invoke-WebRequest "http://127.0.0.1:$Porta/api/saude" -UseBasicParsing -TimeoutSec 3).Content
        } catch {
            $saude = $null
        }
    }

    if ($saude -and $saude -match '"ok"\s*:\s*true') {
        Write-Host "  A aplicacao ja esta no ar em http://127.0.0.1:$Porta" -ForegroundColor Green
        if ($Abrir) { Start-Process "http://127.0.0.1:$Porta" }
        exit 0
    }

    Write-Host "  A porta $Porta esta em uso por outro processo. Rode com -Porta <outra>." -ForegroundColor Red
    exit 1
}

$comandoNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $comandoNode) {
    Write-Host '  Node.js nao encontrado (precisa da versao 20 ou superior).' -ForegroundColor Red
    exit 1
}

$env:PORT = "$Porta"
$env:MOTOR_URL = 'http://127.0.0.1:8080'
$env:MOTOR_SIMPLES_URL = 'http://127.0.0.1:8082'

if ($Abrir) {
    Start-Job -ScriptBlock {
        param($endereco)
        for ($i = 0; $i -lt 40; $i++) {
            try {
                $cliente = New-Object System.Net.Sockets.TcpClient
                $cliente.Connect('127.0.0.1', $endereco.Port)
                $cliente.Close()
                Start-Process $endereco.Url
                break
            } catch {
                Start-Sleep -Milliseconds 500
            }
        }
    } -ArgumentList ([pscustomobject]@{ Url = "http://127.0.0.1:$Porta"; Port = $Porta }) | Out-Null
}

Write-Host ''
Write-Host "  Interface: http://127.0.0.1:$Porta" -ForegroundColor Cyan
Write-Host '  Motores:   http://127.0.0.1:8080 (regular) | http://127.0.0.1:8082 (Simples)' -ForegroundColor DarkGray
Write-Host '  Ctrl+C encerra a aplicacao (os motores continuam no ar).' -ForegroundColor DarkGray
Write-Host ''

Push-Location $app
try {
    & node server.js
} finally {
    Pop-Location
}
