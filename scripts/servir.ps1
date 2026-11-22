# Rebuild e reinício da aplicação (perfil offline) + captura de tela opcional.
# Uso: pwsh -File scripts/servir.ps1 [-Screenshot]
param(
    [switch]$Screenshot
)

$ErrorActionPreference = "Continue"
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-25.0.5.10002-hotspot"
if (-not (Test-Path $env:JAVA_HOME)) {
    $jdk = Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Directory | Select-Object -First 1
    $env:JAVA_HOME = $jdk.FullName
}
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

Get-CimInstance Win32_Process -Filter "Name='java.exe'" |
    Where-Object { $_.CommandLine -like "*api-regime-geral*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

if (-not (Test-Path ".\calculadora\db\calculadora-pro.db")) {
    Write-Host "Banco nao encontrado; gerando com Flyway..."
    New-Item -ItemType Directory -Force -Path .\calculadora\db | Out-Null
    .\mvnw.cmd flyway:migrate "-Dflyway.configFiles=flyway\flyway-pro.conf" --batch-mode --errors | Out-Null
}

Write-Host "Empacotando..."
.\mvnw.cmd -q package -DskipTests --batch-mode -o 2>$null | Out-Null

Write-Host "Iniciando aplicacao..."
Start-Process -FilePath "java" `
    -ArgumentList '-Dspring.profiles.active=offline', '-jar', 'target\api-regime-geral.jar' `
    -WorkingDirectory $raiz `
    -RedirectStandardOutput "$raiz\logs-app.out" `
    -RedirectStandardError "$raiz\logs-app.err" `
    -NoNewWindow

$url = "http://localhost:8080/api/frete/index.html"
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest -Uri $url -TimeoutSec 3 -UseBasicParsing
        if ($r.StatusCode -eq 200) { Write-Host "Pronto: $url"; break }
    } catch { }
}

if ($Screenshot) {
    $edge = @(
        "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($edge) {
        & $edge --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
            --window-size=1440,2300 --virtual-time-budget=12000 `
            --screenshot="$raiz\tmp-screenshot.png" $url 2>$null | Out-Null
        Write-Host "Captura: tmp-screenshot.png"
    }
}
