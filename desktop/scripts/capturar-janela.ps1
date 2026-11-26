<#
.SYNOPSIS
    Abre o Frete Líquido desktop, enquadra a janela na tela e salva um PNG da área cliente.

.DESCRIPTION
    Verificação visual do app real (não do preview HTML).

    Dois detalhes que fazem a captura sair errada:
    - SetForegroundWindow é recusado quando o processo chamador não está em
      primeiro plano; a janela sobe para TOPMOST antes do recorte.
    - A janela nasce com 1380x906 e, em tela menor, fica parte fora da área
      visível. Ela é redimensionada para caber e a captura usa GetClientRect
      (sem sombra nem borda, que apareciam como faixa do app vizinho).

.EXAMPLE
    & .\scripts\capturar-janela.ps1
    & .\scripts\capturar-janela.ps1 -Aba Comparador -Saida ..\docs\preview\app-comparador.png
#>
[CmdletBinding()]
param(
    [string] $Exe = "$PSScriptRoot\..\src\FreteLiquido.Desktop\bin\Debug\net8.0\FreteLiquido.exe",
    [string] $Saida = "$PSScriptRoot\..\docs\preview\app-rodando.png",
    [string] $Aba,
    [string] $Teclas,
    [int] $EsperaSegundos = 20,
    [switch] $ManterAberto
)

$ErrorActionPreference = 'Stop'

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Janela {
    public static readonly IntPtr TOPMOST = new IntPtr(-1);
    public static readonly IntPtr NOTOPMOST = new IntPtr(-2);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref PONTO p);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct PONTO { public int X, Y; }
}
"@

# Sem isso, um powershell.exe DPI-unaware enxerga a tela a 80%: o cliente do
# Avalonia (per-monitor aware) sai maior que o recorte e a captura corta a
# direita da janela enquanto mostra o app vizinho à esquerda.
[Janela]::SetProcessDPIAware() | Out-Null

Add-Type -AssemblyName System.Drawing, System.Windows.Forms

if (-not (Test-Path $Exe)) {
    throw "Binário não encontrado: $Exe. Rode 'dotnet build FreteLiquido.sln' antes."
}

$processo = Start-Process -FilePath $Exe -PassThru
$limite = (Get-Date).AddSeconds($EsperaSegundos)
while ((Get-Date) -lt $limite) {
    Start-Sleep -Milliseconds 400
    $processo.Refresh()
    if ($processo.HasExited) { throw "O app encerrou sozinho (exit $($processo.ExitCode))." }
    if ($processo.MainWindowHandle -ne [IntPtr]::Zero) { break }
}

$hwnd = $processo.MainWindowHandle
if ($hwnd -eq [IntPtr]::Zero) { throw "A janela não apareceu em $EsperaSegundos s." }

# Enquadra dentro da área útil. A janela nasce com 1380x906 DIP e, em tela
# 1080p a 125%, isso passa da área útil: o rodapé cai sob a barra de tarefas
# (que também é topmost) e a captura registra a barra. Por isso a altura é
# reduzida — o layout continua válido porque MinHeight é 760 DIP.
$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$atual = New-Object Janela+RECT
[Janela]::GetWindowRect($hwnd, [ref]$atual) | Out-Null
$largura = [Math]::Min($atual.Right - $atual.Left, $area.Width - 32)
$altura = [Math]::Min($atual.Bottom - $atual.Top, $area.Height - 40)
$x = $area.X + [int](($area.Width - $largura) / 2)
$y = $area.Y + 16

# SWP_SHOWWINDOW (0x40)
[Janela]::SetWindowPos($hwnd, [Janela]::TOPMOST, $x, $y, $largura, $altura, 0x40) | Out-Null
[Janela]::ShowWindow($hwnd, 9) | Out-Null   # SW_RESTORE
[Janela]::SetForegroundWindow($hwnd) | Out-Null
Start-Sleep -Milliseconds 1400

$depois = New-Object Janela+RECT
[Janela]::GetWindowRect($hwnd, [ref]$depois) | Out-Null

if ($Aba) {
    if (-not ('Navegacao' -as [type])) {
        Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    }
    $raiz = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
    $busca = New-Object System.Windows.Automation.AndCondition(
        (New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::RadioButton)),
        (New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::NameProperty, $Aba)))
    $alvo = $raiz.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $busca)
    if ($null -eq $alvo) { throw "Aba '$Aba' não encontrada na árvore de automação." }
    $padrao = $alvo.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
    $padrao.Select()
    Start-Sleep -Milliseconds 1200
}

if ($Teclas) {
    # Envia teclas para conferir estados de teclado (foco, seleção). Antes é
    # preciso um clique dentro da janela: sem ele o Windows mantém o foco no
    # processo anterior e SendKeys não chega ao app.
    $clique = New-Object Janela+PONTO
    [Janela]::ClientToScreen($hwnd, [ref]$clique) | Out-Null
    [Janela]::SetForegroundWindow($hwnd) | Out-Null
    [Janela]::SetCursorPos($clique.X + 320, $clique.Y + 120) | Out-Null
    Start-Sleep -Milliseconds 250
    [Janela]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)   # left down
    [Janela]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)   # left up
    Start-Sleep -Milliseconds 500
    [System.Windows.Forms.SendKeys]::SendWait($Teclas)
    Start-Sleep -Milliseconds 700
}

$cliente = New-Object Janela+RECT
[Janela]::GetClientRect($hwnd, [ref]$cliente) | Out-Null
$origem = New-Object Janela+PONTO
[Janela]::ClientToScreen($hwnd, [ref]$origem) | Out-Null
$largura = $cliente.Right - $cliente.Left
$altura = $cliente.Bottom - $cliente.Top
if ($largura -le 0 -or $altura -le 0) { throw "Área cliente vazia: a janela não está desenhada." }

# Recorta na área útil: se o rodapé da janela passa da barra de tarefas (que
# também é topmost), a captura pararia nela. Melhor uma imagem um pouco mais
# curta do que uma com a barra do sistema no meio.
$limiteBase = $area.Bottom - $origem.Y
if ($altura -gt $limiteBase) { $altura = $limiteBase }
$limiteDireita = $area.Right - $origem.X
if ($largura -gt $limiteDireita) { $largura = $limiteDireita }

$pasta = Split-Path -Parent $Saida
New-Item -ItemType Directory -Force -Path $pasta | Out-Null
if (Test-Path $Saida) { Remove-Item $Saida -Force }   # evita reaproveitar PNG velho

$bitmap = New-Object System.Drawing.Bitmap $largura, $altura
$grafico = [System.Drawing.Graphics]::FromImage($bitmap)
$grafico.CopyFromScreen($origem.X, $origem.Y, 0, 0, $bitmap.Size)
$bitmap.Save($Saida, [System.Drawing.Imaging.ImageFormat]::Png)
$grafico.Dispose()
$bitmap.Dispose()

[Janela]::SetWindowPos($hwnd, [Janela]::NOTOPMOST, 0, 0, 0, 0, 0x41) | Out-Null
if (-not $ManterAberto) { Stop-Process -Id $processo.Id -Force }

Write-Output "Captura salva: $Saida (${largura}x${altura}, $((Get-Item $Saida).Length) bytes)"
