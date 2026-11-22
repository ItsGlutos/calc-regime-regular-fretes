# Sobe o motor oficial da Receita (se necessario) e a aplicacao Frete Liquido.
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

Write-Host ''
Write-Host '  Frete Liquido - simulador do pagador de frete' -ForegroundColor White
Write-Host '  ---------------------------------------------' -ForegroundColor DarkGray

# 1. Motor oficial ------------------------------------------------------------------------------
if (Testar-Porta 8080) {
    Write-Host '  Motor oficial ja esta no ar em http://127.0.0.1:8080' -ForegroundColor Green
} else {
    if (-not (Test-Path $jar)) {
        Write-Host '  JAR do motor nao encontrado:' -ForegroundColor Red
        Write-Host "  $jar" -ForegroundColor Red
        Write-Host '  Compile com:  .\mvnw.cmd -DskipTests package' -ForegroundColor Yellow
        exit 1
    }

    $java = Localizar-Java
    if (-not $java) {
        Write-Host '  Java nao encontrado. Instale um JDK 25 ou ajuste o PATH/JAVA_HOME.' -ForegroundColor Red
        exit 1
    }

    Write-Host "  Subindo motor oficial com $java"
    $saida = Join-Path $raiz 'logs-app.out'
    $erro = Join-Path $raiz 'logs-app.err'
    Start-Process -FilePath $java `
        -ArgumentList @('-Dspring.profiles.active=offline', '-jar', $jar) `
        -WorkingDirectory $raiz `
        -RedirectStandardOutput $saida `
        -RedirectStandardError $erro `
        -WindowStyle Hidden | Out-Null

    $tentativas = 0
    while (-not (Testar-Porta 8080) -and $tentativas -lt 180) {
        Start-Sleep -Milliseconds 500
        $tentativas++
        if ($tentativas % 20 -eq 0) { Write-Host "  ... aguardando o motor ($([int]($tentativas / 2))s)" -ForegroundColor DarkGray }
    }

    if (-not (Testar-Porta 8080)) {
        Write-Host '  O motor nao subiu. Veja logs-app.err e logs-app.out.' -ForegroundColor Red
        exit 1
    }
    Write-Host '  Motor oficial no ar em http://127.0.0.1:8080' -ForegroundColor Green
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
Write-Host '  Ctrl+C encerra a aplicacao (o motor continua no ar).' -ForegroundColor DarkGray
Write-Host ''

Push-Location $app
try {
    & node server.js
} finally {
    Pop-Location
}
