# Instalação e distribuição

O app é um executável .NET (Avalonia). Há dois caminhos de empacotamento; este
documento registra o plano, ainda não executado nesta máquina.

## 1. Publish autocontido (base para todos os formatos)

```powershell
dotnet publish src/FreteLiquido.Desktop -c Release -r win-x64 `
  --self-contained true -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  -o artefatos\win-x64
```

Saída: `artefatos\win-x64\FreteLiquido.exe` (~70–90 MB com o runtime embutido).
Sem `.NET` instalado na máquina do cliente.

Para depender do runtime instalado (arquivo de ~5 MB):

```powershell
dotnet publish src/FreteLiquido.Desktop -c Release -r win-x64 `
  --self-contained false -o artefatos\win-x64-fx
```

## 2. Instalador

### Opção A — MSIX (recomendado a médio prazo)

Vantagens: instalação por usuário, atalho no Menu Iniciar, desinstalação limpa,
atualização automática via App Installer, sandbox de arquivos.

1. Criar um *Windows Application Packaging Project* apontando para o publish
   autocontido (ou usar `MakeAppx`/`msix-packaging`).
2. `Package.appxmanifest` com:
   - `Identity Name="br.gov.frete.liquido" Publisher="CN=..." Version="0.1.0.0"`;
   - `Application Executable="FreteLiquido.exe" EntryPoint="Windows.FullTrustApplication"`;
   - capacidade `runFullTrust` (app desktop).
3. Empacotar: `MakeAppx pack /d artefatos\msix /p FreteLiquido_0.1.0.0_x64.msix`.
4. Assinar: `signtool sign /fd SHA256 /a /f certificado.pfx FreteLiquido.msix`.

Sem certificado de code signing, o Windows SmartScreen bloqueia a instalação em
máquinas de terceiros. Para uso interno, distribuir o `.exe` com instruções.

### Opção B — Inno Setup (mais simples agora)

1. Instalar o Inno Setup 6.
2. Script mínimo (`installer/frete-liquido.iss`):

```ini
[Setup]
AppName=Frete Líquido
AppVersion=0.1.0
DefaultDirName={autopf}\Frete Líquido
DefaultGroupName=Frete Líquido
OutputBaseFilename=FreteLiquido-Setup-0.1.0
Compression=lzma2
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
SetupIconFile=..\src\FreteLiquido.Desktop\Assets\frete-liquido.ico

[Files]
Source: "..\artefatos\win-x64\*"; DestDir: "{app}"; Flags: recursesubdirs

[Icons]
Name: "{autoprograms}\Frete Líquido"; Filename: "{app}\FreteLiquido.exe"
Name: "{autodesktop}\Frete Líquido"; Filename: "{app}\FreteLiquido.exe"

[Run]
Filename: "{app}\FreteLiquido.exe"; Description: "Abrir o Frete Líquido"; Flags: nowait postinstall skipifsilent
```

3. `iscc installer\frete-liquido.iss`.

## Roadmap Linux (fase 2)

O mesmo projeto compila para Linux; o que muda é o empacotamento e a fonte.

1. `dotnet publish -r linux-x64 --self-contained true`.
2. Fonte: Calibri não existe. O fallback já aponta para **Carlito** (métrica
   idêntica). Distribuir `fonts-crosextra-carlito` como dependência do pacote.
3. Empacotar:
   - **AppImage** (`appimagetool`) para distribuição sem instalação;
   - **.deb** (`dpkg-deb`) com `Depends: fonts-crosextra-carlito, libx11-6, libice6, libsm6`.
4. Testar em X11 e Wayland (o Avalonia usa X11 por padrão; Wayland via
   `AVALONIA_WAYLAND=1` quando disponível).
5. Ícone em `~/.local/share/icons/hicolor/256x256/apps/frete-liquido.png`
   (gerado por `scripts/gerar-icone.py`).

## Pendências conhecidas

- **Build não executado**: o SDK do .NET não está instalado nesta máquina. Rodar
  `dotnet build` e corrigir o que aparecer é o primeiro passo.
- **Foco visível**: os botões usam tema próprio e não têm anel de foco; revisar
  antes de publicar (acessibilidade por teclado).
- **Code signing**: decidir certificado (EV ou padrão) antes de distribuir.
- **Auto-update**: só faz sentido junto do MSIX; para o `.exe` simples, publicar
  versão nova manualmente.
