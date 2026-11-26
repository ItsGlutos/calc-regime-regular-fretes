# Estudo — interface gráfica e aplicativo desktop

**Escopo:** transformar o Frete Líquido (hoje página única servida por um Node local + dois motores Java)
em um aplicativo desktop instalável, sem perder a apuração oficial e sem reescrever a regra tributária.

**Data:** novembro/2026 · **Status:** estudo para decisão (não é ADR aprovado)

> **Atualização (nov/2026):** a decisão de produto mudou para uma GUI própria em **.NET 8 + Avalonia**,
> iniciando pelo app desktop em `desktop/`. Isso substitui a recomendação de Electron deste estudo e a
> ressalva da seção 4.2 sobre reescrever a UI; o racional está em
> [`desktop/docs/adr-001-stack-avalonia.md`](../desktop/docs/adr-001-stack-avalonia.md). O restante do
> estudo (sidecars Java, portas efêmeras, runtime compartilhado, empacotamento e roadmap) continua válido
> para a integração dos motores.

---

## 1. Resumo executivo

O projeto já tem uma interface web funcional e bem resolvida visualmente. O problema não é "fazer uma
tela": é **empacotar três processos, uma base somente leitura e um ciclo de atualização fiscal** em um
instalável que abra em segundos, funcione offline e possa ser atualizado sem quebrar o cálculo.

A recomendação é:

1. **Electron como casca desktop na primeira versão**, reaproveitando 100% da UI atual, com o Node e os
   dois JARs como *sidecars* supervisionados pelo processo principal.
2. **Extrair a UI para Vite + TypeScript** antes de empacotar, quebrando o `app.js` monolítico (1.912
   linhas) em módulos — sem trocar de framework na fase 1.
3. **Runtime Java compartilhado via `jlink`**, um único runtime para os dois motores, e
   **inicialização sob demanda** do motor do Simples (só quando o perfil exigir), para conter RAM e tempo
   de abertura.
4. **Portas efêmeras + token por sessão** entre a casca e os serviços locais; nada exposto na rede.
5. **Avaliar Tauri 2** apenas depois de consolidar o backend (ou se tamanho/RAM virarem objeção
   comercial). Com Node + dois JVMs embarcados, a vantagem de tamanho do Tauri é pequena.
6. **Não reescrever em JavaFX/Flutter/.NET agora.** O custo de reescrita é 3–5× o de empacotar o que já
   existe, e a UI atual é o ativo mais maduro do produto.

Esforço estimado para um desktop vendável (Windows primeiro): **11 a 16 semanas** com 2 desenvolvedores,
sem contar as funcionalidades de documento/SEFAZ do `docs/produto.md`.

---

## 2. Ponto de partida

| Camada | Tecnologia | Porta | Tamanho medido |
|---|---|---|---|
| Motor do regime regular | Java 25 / Spring Boot 4.1.2 | `8080` | JAR 88,0 MB |
| Motor do Simples Nacional | Java 25 / Spring Boot 4.1.2 | `8082` | JAR 81,4 MB |
| Aplicação (BFF + UI) | Node 20+, sem dependências | `5180` | 16 KB HTML + 52 KB CSS + 77 KB JS |
| Base tributária | SQLite (Flyway, somente leitura) | — | 5,4 MB |
| Vitrine | HTML/CSS estáticos | — | GitHub Pages |

### O que já joga a favor

- A UI é uma página única sem build step: fácil de embutir em qualquer casca.
- O Node já é o orquestrador (validação, escolha de motor, regra de crédito, memória): a casca não precisa
  conhecer regra tributária.
- A base é somente leitura: não há escrita concorrente no SQLite oficial.
- O contrato com os motores é HTTP/JSON e já tem fallback quando a projeção não existe.
- Licenças MIT dos dois motores permitem redistribuição (com avisos de licença).

### Restrições que a decisão precisa resolver

| Restrição | Impacto no desktop |
|---|---|
| Dois JVMs Spring Boot independentes | RAM e tempo de abertura; necessidade de supervisão e *kill* limpo |
| Base `calculadora-pro.db` versionada pelo Flyway | atualização do app tem de trocar base e JARs em lockstep |
| HTTP em `127.0.0.1` sem autenticação | não pode haver porta fixa aberta em desktop multiusuário/rede |
| `run.ps1` espera até 90 s pelos motores | UX inaceitável sem splash + start paralelo + health check |
| Zero persistência (estado só no navegador) | desktop é a oportunidade de histórico, cenários, exportação e auditoria |
| UI monolítica (`app.js` 77 KB) | dificulta evoluir para *workspace* com navegação, listas e detalhe |
| Sem testes de UI versionados | qualquer troca de casca/framework precisa de Playwright antes |

### O que o roadmap do produto exige da GUI

O `docs/produto.md` aponta para ingestão de XML de CT-e, conciliação com tabela de frete, matriz de
retenções, split payment e contas a pagar. Isso **não cabe em uma tela de formulário**. A GUI deve nascer
como um *workspace* (navegação lateral, lista de documentos, painel de detalhe, status, trilha de
auditoria), com a calculadora como uma das áreas — não como a aplicação inteira.

---

## 3. Requisitos da GUI desktop

### 3.1 Funcionais

| Área | Requisitos |
|---|---|
| Simulação | formulário atual (valor, regime, modalidade, rota, ano), resultado, memória, premissas e resposta bruta |
| Comparador | 2–3 transportadoras, ranking por custo líquido, alíquotas por transportadora |
| Linha do tempo | 2025–2033, três leituras, benchmark do regime regular, exportação |
| Histórico | salvar/carregar simulações, favoritos, busca, duplicar cenário, comparar execuções |
| Exportação | PDF do resultado, XLSX/CSV da série, JSON de auditoria, markdown do anexo contratual |
| Base tributária | versão da base e do motor visíveis, verificação de atualização, rollback |
| Diagnóstico | status dos motores, logs, *support bundle* (logs + versões + config + hash da base) |
| Futuro (produto) | fila de CT-e, detalhe do documento, conciliação, retenções, contas a pagar |
| Sistema | abrir/salvar arquivo, arrastar e soltar XML (futuro), imprimir, atalhos, bandeja |

### 3.2 Não funcionais (metas a validar no spike)

| Critério | Meta inicial |
|---|---|
| Instalação | por usuário, sem administrador; desinstalação limpa |
| Abertura | splash em < 1 s; tela utilizável em ≤ 10 s em máquina de 8 GB |
| RAM ociosa | ≤ 700 MB com os dois motores; ≤ 450 MB só com o regular |
| Offline | 100% das funções atuais sem internet |
| Portas | nenhuma porta acessível fora de `127.0.0.1` |
| Atualização | N-1 → N preservando histórico, com rollback |
| Acessibilidade | WCAG 2.2 AA, navegação por teclado, foco visível, contraste |
| DPI/tema | 100–200%, tema claro e escuro, múltiplos monitores |
| Idioma | pt-BR, com estrutura de i18n preparada |
| Privacidade | telemetria desligada por padrão; nenhum dado fiscal sai da máquina |
| Logs | rotação, local conhecido, sem PII |

### 3.3 Operacionais

- Instalador assinado, com *timestamp*; build reprodutível e SBOM.
- Instalação silenciosa para frota (MSI ou NSIS `/S`) e pacote *portable* para cenários restritos.
- Canal `stable` e `beta`, com liberação gradual e *kill switch* de versão.
- Compatibilidade declarada: Windows 10/11 x64 (primeiro alvo), macOS 13+ (arm64/x64) e Ubuntu 22.04+ em
  fase posterior.
- *Support bundle* de um clique para o suporte; sem pedir print de tela.

---

## 4. Decisões estruturais

São cinco decisões independentes. A escolha da casca é só a primeira.

### 4.1 Onde a UI roda

| Opção | O que é | Quando faz sentido |
|---|---|---|
| **PWA / atalho do navegador** | app instalado pelo Edge/Chrome em modo janela, com o Node e os motores subindo por um launcher | protótipo de 1–2 semanas, uso interno, sem exigência de instalador |
| **Casca nativa com WebView** | Electron, Tauri, Wails etc. embutem a UI web em janela própria | produto desktop de verdade; **recomendado** |
| **UI nativa na JVM** | JavaFX ou Swing, sem web | se a organização exigir stack única Java, aceitando reescrever a UI |
| **WebView embutida na JVM** | JCEF ou JavaFX WebView dentro do Spring Boot | casos específicos; JCEF adiciona Chromium; WebView do JavaFX fica atrás do Chromium |

### 4.2 Casca desktop

| Opção | Tamanho adicional | RAM | Esforço (MVP) | Prós | Contras |
|---|---|---|---|---|---|
| **A. Launcher + navegador** | ~0 | alto (3 processos + navegador) | 1–2 sem | mínimo esforço, reusa tudo | não é "app", sem menu/tray/updater, UX fraca |
| **B. Electron** | 80–120 MB comprimido | 150–250 MB | 4–6 sem | stack do time, `child_process`, updater/assinatura maduros, Chromium idêntico em todo SO | peso, RAM, três runtimes (Chromium + Node + JVM) |
| **C. Tauri 2** | 5–15 MB | 60–120 MB | 6–9 sem | leve, WebView do SO, segurança por capabilities, updater bom | toolchain Rust no CI, WebView2/WKWebView variam, sidecar Node ainda precisa de `node.exe` |
| **D. JavaFX + jpackage** | ~0 além da JVM | 150–250 MB | 14–20 sem | stack única, JRE já necessário, `jpackage` nativo | reescrever 100% da UI, gráficos e acessibilidade mais trabalhosos, sem reuso do CSS atual |
| **E. JCEF / JavaFX WebView** | 80–150 MB (JCEF) | 200–300 MB | 8–12 sem | UI web dentro da JVM, um processo a menos | JCEF é Chromium embarcado (peso e build complexo); WebView do JavaFX tem CSS/JS defasados |
| **F. Wails / Neutralino** | 5–15 MB | 60–120 MB | 6–9 sem | leve, Go/JS | ecossistema menor, updater/assinatura menos maduros, sidecar Java manual |
| **G. .NET WebView2 / Flutter** | 10–30 MB | 80–150 MB | 16–24 sem | ferramentas boas | stack nova para o time, reescrita da UI, dois ecossistemas a manter |

**Leitura:** com ~170 MB de JARs + runtime Java, a diferença de 100 MB entre Electron e Tauri deixa de ser
decisiva. O que decide é **tempo até o primeiro release** e **maturidade de atualização/assinatura** —
onde Electron ganha para um time JS/Java.

### 4.3 Frontend

| Opção | Prós | Contras | Quando |
|---|---|---|---|
| **Vanilla + Vite + TypeScript** | zero framework, mantém o CSS e o *design* atuais, bundle mínimo, menor risco | componentização manual; disciplina para não recriar um framework | **fase 1 (recomendado)** |
| **Svelte 5 + Vite** | reatividade enxuta, ótimo para formulários e gráficos, bundle pequeno | ecossistema menor que React | **fase 2 (recomendado)** quando a UI virar workspace |
| **React 19 + Vite** | maior ecossistema, contratação fácil, TanStack Query/Table, shadcn/ui | mais boilerplate e peso; exige decisões de estado | se houver time/hiring React |
| **Vue 3 + Vite** | curva suave, bom para formulários | ecossistema menor para este nicho | alternativa ao Svelte |
| **Lit / Web Components** | agnóstico de casca, padrão web | poucas "baterias" prontas | se a UI for compartilhada com a vitrine |

**Biblioteca de gráficos:** ECharts (~350 KB, séries, waterfall, heatmap, exportação de imagem) para a
linha do tempo e o comparativo; Chart.js se o requisito for só barras/linhas simples; uPlot se performance
for crítica. Evitar misturar duas bibliotecas.

**Design system:** preservar a linguagem atual (papel frio, tinta naval, azul de crédito, âmbar de alerta)
extraindo *tokens* do `styles.css`. Tailwind é opcional; o CSS atual já é um sistema coerente e trocá-lo
não é prioridade. Componentes: `Button`, `Field`, `Card`, `Badge`, `Table`, `Tabs`, `Dialog`, `Toast`,
`EmptyState`, `Skeleton` — os mesmos que o HTML já usa.

**Contrato e validação:** gerar tipos TypeScript do OpenAPI do motor e manter um schema único (Zod ou
Valibot) para a entrada; o BFF continua validando no servidor. Erros do motor precisam de um formato
único (`codigo`, `mensagem`, `detalhe`, `origem`).

**Testes:** Vitest para regra de apresentação, Playwright para fluxos (simular, comparar, exportar,
atualizar), regressão visual por captura nas duas resoluções. Os scripts atuais (`scripts/capturar*.mjs`,
`verificar-ui.mjs`) já apontam o caminho.

### 4.4 Backend e processos

| Opção | Descrição | Prós | Contras |
|---|---|---|---|
| **P1. Três sidecars (recomendado)** | casca sobe Node (BFF) e os dois JARs | zero reescrita, isolamento, atualização independente | 3 processos, 2 JVMs, supervisão obrigatória |
| **P2. Consolidar o BFF no Java** | mover validação/regra/memória do Node para um Spring Boot "app" | um processo a menos, um runtime, base compartilhada | reescrever ~2.000 linhas de regra já testada; perde iteração rápida do Node |
| **P3. Fundir os dois motores em um JVM** | um Spring Boot com os dois contextos | menos RAM | forks com ciclos e pacotes próprios; risco alto de conflito; atualização fica amarrada |
| **P4. Motores como serviço remoto** | motor oficial em nuvem, app fino | não distribui base/JVM | contraria offline/LGPD e adiciona dependência de rede |
| **P5. Start sob demanda** | subir o Simples só quando o perfil exigir; desligar após ociosidade | economiza RAM e abertura | primeiro cálculo do Simples fica mais lento; precisa de UX de "aquecendo" |

**Recomendação:** P1 + P5. Começar todos em paralelo no *launch*, exibir splash com o status de cada
motor, e só subir o Simples quando necessário (com pré-aquecimento em segundo plano depois que a tela
principal estiver pronta).

**Transporte entre casca e serviços:** manter HTTP, mas em **porta efêmera** escolhida em tempo de
execução e com **token de sessão** (`Authorization: Bearer ...`) exigido pelo BFF. Alternativas:

- `stdio`/JSON-RPC: bom para o Node, mas os motores Java só falam HTTP; exigiria adaptador.
- *Named pipes*/Unix sockets: suporte nativo fraco no Spring Boot; não compensa o esforço.
- Porta fixa: colide com o `run.ps1`, com outra instância e com outros apps; evitar.

**Supervisão:** a casca é dona do ciclo de vida. Precisa de *single instance lock*, start paralelo,
*health check* com *backoff*, reinício automático, captura de stdout/stderr com rotação, encerramento em
árvore no *quit* e um *watchdog* para não deixar JVM órfã. No Windows, `taskkill /T` resolve o caso
simples; para garantia, criar um *Job Object* (módulo nativo) ou fazer o BFF encerrar quando perder o
pai.

### 4.5 Dados e persistência

| Opção | Onde grava | Prós | Contras |
|---|---|---|---|
| **SQLite próprio (`frete-liquido.db`)** no `%LOCALAPPDATA%` | Node (`better-sqlite3`) ou Java (JDBC) | transacional, backup fácil, consultas, migrações versionadas | uma dependência nativa no Node (ou escrita no lado Java) |
| IndexedDB/Dexie no renderer | perfil do WebView | zero backend | some ao limpar dados, difícil de exportar/backupar, preso à casca |
| Arquivos JSON | pasta do app | simples, auditável | sem consulta concorrente, cresce mal |
| Sem persistência (hoje) | — | simples | não vira produto de rotina |

**Recomendação:** SQLite separado, **nunca** escrever no `calculadora-pro.db` (oficial, somente leitura).
Escrever pelo Node (`better-sqlite3`) enquanto ele existir; migrar para JDBC se o BFF for consolidado.
Tabelas iniciais: `simulacao`, `cenario`, `transportadora`, `configuracao`, `evento_auditoria`,
`documento` (futuro), `migracao`. Incluir `tenant_id` desde o dia 1, mesmo single-tenant. Exportar e
importar JSON; backup automático antes de migração de schema.

---

## 5. Arquitetura recomendada

```
┌──────────────────────────────────────────────────────────────┐
│ Electron main (Node embutido)                                │
│  • single instance · splash · menus · tray · updater         │
│  • supervisor dos sidecars · logs · janela · atalhos         │
└───────────────┬──────────────────────────┬───────────────────┘
                │ IPC (contextBridge)      │ spawn + health
                ▼                          ▼
┌──────────────────────────┐   ┌───────────────────────────────┐
│ Renderer (Chromium)      │   │ Node BFF  :porta efêmera      │
│ Vite + TS · UI atual     │──▶│ token de sessão · regra       │
│ sem Node integration     │   │ SQLite do app (histórico)     │
└──────────────────────────┘   └───────┬───────────────┬───────┘
                                       │               │
                              ┌────────▼──────┐ ┌──────▼────────┐
                              │ Motor regular │ │ Motor Simples │
                              │ :efêmera      │ │ :efêmera      │
                              │ JAR + jlink   │ │ JAR + jlink   │
                              └────────┬──────┘ └──────┬────────┘
                                       └───────┬───────┘
                                        SQLite oficial
                                        (somente leitura)
```

### 5.1 Esqueleto do processo principal

```js
// electron/main.js (ilustrativo)
import { app, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import crypto from 'node:crypto'

const filhos = []

const porta = () =>
  new Promise((resolve) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
  })

function subir(nome, comando, args, env) {
  const filho = spawn(comando, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
  filho.stdout.on('data', (b) => registrar(nome, b))
  filho.stderr.on('data', (b) => registrar(nome, b))
  filho.on('exit', (codigo) => tratarSaida(nome, codigo))
  filhos.push(filho)
  return filho
}

app.whenReady().then(async () => {
  const token = crypto.randomUUID()
  const [pRegular, pSimples, pApp] = await Promise.all([porta(), porta(), porta()])

  subir('regular', java, ['-jar', 'jars/api-regime-geral.jar'], { SERVER_PORT: pRegular, APP_TOKEN: token })
  subir('simples', java, ['-jar', 'jars/api-simples-nacional.jar'], { SERVER_PORT: pSimples, APP_TOKEN: token })
  subir('bff', process.execPath, ['app/server.js'], {
    PORT: pApp,
    APP_TOKEN: token,
    MOTOR_URL: `http://127.0.0.1:${pRegular}`,
    MOTOR_SIMPLES_URL: `http://127.0.0.1:${pSimples}`,
  })

  await esperarSaude(pApp, token, 30_000)
  criarJanela(pApp, token)
})

app.on('before-quit', () => filhos.forEach((f) => encerrarArvore(f)))
```

Detalhes que não podem faltar: `windowsHide: true`, bloqueio de segunda instância, *timeout* de saúde com
mensagem acionável, e encerramento em árvore (no Windows, `taskkill /PID <pid> /T /F` como *fallback*).

### 5.2 Hardening do renderer

```js
const janela = new BrowserWindow({
  show: false,
  backgroundColor: '#f4f5f7',
  webPreferences: {
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true,
    preload: path.join(__dirname, 'preload.js'),
  },
})
```

Checklist mínimo:

- `contextBridge` expondo apenas `abrirArquivo`, `salvarArquivo`, `exportar`, `obterVersoes`, `verificarAtualizacao` — nunca `ipcRenderer` cru.
- Bloquear navegação externa e `window.open`; abrir links no navegador do SO via `shell.openExternal` com *allowlist*.
- CSP restritiva (`default-src 'self'`), sem `unsafe-eval`; fontes locais (hoje vêm do Google Fonts — empacotar).
- `setPermissionRequestHandler` negando tudo por padrão.
- Validar todo payload IPC com schema; nunca aceitar caminho arbitrário do renderer.
- *DevTools* desabilitado em produção; logs sem tokens, CPF ou chave de acesso.
- *Token* do BFF só em memória; não gravar em arquivo nem no `localStorage`.

### 5.3 Runtime Java compartilhado

```powershell
# 1. descobrir módulos (iterar até estabilizar)
jdeps --multi-release 25 --ignore-missing-deps --print-module-deps target\api-regime-geral.jar

# 2. gerar um runtime só, usado pelos dois JARs
jlink --add-modules java.base,java.logging,java.naming,java.management,java.instrument,java.sql,java.desktop,jdk.unsupported,jdk.crypto.ec `
      --strip-debug --no-man-pages --no-header-files --compress=zip-6 `
      --output runtime
```

Spring Boot puxa mais módulos do que parece (reflexão, proxy, JNDI, SSL). O caminho seguro é medir com
`jdeps` + teste de fumaça dos dois motores; se a trimagem ficar frágil, usar um JRE completo (Liberica ou
Temurin JRE) e assumir ~50 MB a mais. **Um runtime para os dois motores** já economiza dezenas de MB.

### 5.4 Empacotamento

```yaml
# electron-builder.yml (ilustrativo)
appId: br.com.freteliquido.app
productName: Frete Líquido
files:
  - electron/**
  - app/**
  - jars/**
  - runtime/**
  - base/**
win:
  target:
    - target: nsis
      arch: [x64]
  signingHashAlgorithms: [sha256]
nsis:
  oneClick: false
  perMachine: false          # instala por usuário, sem admin
  allowToChangeInstallationDirectory: true
  differentialPackage: true
publish:
  provider: generic
  url: https://downloads.exemplo.com.br/frete-liquido/updates
```

Alternativa para o lado Java: `jpackage --type msi --runtime-image runtime --input jars --main-jar ...`
— funciona, mas não resolve a casca web; por isso Electron/Tauri continuam na frente enquanto a UI for web.

---

## 6. Distribuição, atualização e ciclo de vida

### 6.1 Instaladores

| Plataforma | Formato | Observação |
|---|---|---|
| Windows | NSIS por usuário | padrão; sem UAC; atalho no menu Iniciar |
| Windows (frota) | MSI via WiX | GPO/Intune, instalação silenciosa, *per-machine* opcional |
| Windows (restrito) | ZIP *portable* | sem instalador; dados em pasta ao lado do executável |
| macOS | DMG + *notarização* | Developer ID obrigatório para abrir sem aviso |
| Linux | AppImage + DEB | Ubuntu 22.04+; testar WebKitGTK se Tauri |

### 6.2 Assinatura de código

- Windows: certificado OV/EV ou **Azure Trusted Signing** (nuvem, mais barato que EV com token).
- macOS: Developer ID + `notarytool` + *staple*.
- Linux: GPG no repositório/AppImage (opcional).
- Sem assinatura, o SmartScreen bloqueia nas primeiras execuções e o suporte vira fila de "vírus".

### 6.3 Auto-update

1. Casca verifica manifesto assinado em HTTPS (canal `stable`/`beta`).
2. Baixa em segundo plano, valida SHA-256 e assinatura, aplica no próximo reinício.
3. Atualização é **atômica por versão**: `app@2.3.0` contém JARs, runtime e base compatíveis entre si.
4. Base tributária tem versão própria (`X-CALC-DB-VERSION`), exibida no Sobre e no *support bundle*.
5. Se a base nova for incompatível, o app mantém a anterior em `versions/<n-1>` e oferece rollback.
6. Empresas com TI restritiva: canal "manual" com instalador completo e notas de versão.

### 6.4 CI/CD

- GitHub Actions com matriz `windows-latest`, `macos-14` (arm64) e `ubuntu-22.04`.
- Cache de Maven/Node; compilar os dois motores; rodar testes; gerar runtime `jlink`; build da casca.
- Assinar com segredos; publicar artefatos + checksums + SBOM (CycloneDX).
- Teste de fumaça: instalar silenciosamente em VM Windows, abrir, simular o caso de aceite do README e
  fechar verificando que não sobrou processo.
- Versionamento: `app`, `engine API`, `db` — os três no *About*.

---

## 7. Segurança, privacidade e conformidade

| Tema | Ação |
|---|---|
| Superfície local | portas efêmeras, bind `127.0.0.1`, token por sessão, *rate limit* |
| Supply chain | dependências travadas, SBOM, assinatura de atualização, HTTPS pinado |
| Processo | *single instance*, sem `shell: true`, caminhos absolutos, `windowsHide` |
| Arquivos | *dialogs* nativos, validação de extensão e tamanho, sem seguir links simbólicos |
| XML (futuro) | parser com DTD/external entities desabilitados (billion laughs / XXE), limite de tamanho |
| LGPD | mapa de dados, retenção, exportação e exclusão, telemetria opt-in, *crash dump* sem PII |
| Auditoria | cada simulação com versão do motor, da base e hash do payload |
| Licenças | incluir MIT dos dois motores e avisos de terceiros no "Sobre"; evitar GPL |
| Credenciais (futuro SEFAZ) | cofre do SO (DPAPI/Keychain), nunca no SQLite em claro |

---

## 8. Matriz comparativa das cascas

Pesos: tempo até o release 20%, reuso da UI/stack 15%, pegada (tamanho/RAM) 15%, UX e integração com o
SO 15%, maturidade de atualização/assinatura 15%, aderência do time 10%, multiplataforma 10%. Notas 1–5.

| Opção | TTM | Reuso | Pegada | UX/SO | Update | Time | Cross | **Total** |
|---|---|---|---|---|---|---|---|---|
| A. Launcher + navegador | 5 | 5 | 4 | 1 | 2 | 5 | 4 | **3,70** |
| **B. Electron** | 4 | 5 | 2 | 4 | 5 | 5 | 5 | **4,20** |
| C. Tauri 2 | 3 | 5 | 4 | 4 | 4 | 3 | 4 | **3,85** |
| D. JavaFX | 1 | 1 | 4 | 3 | 3 | 3 | 3 | **2,45** |
| E. JCEF / JavaFX WebView | 2 | 4 | 2 | 3 | 3 | 3 | 2 | **2,70** |
| F. Wails / Neutralino | 3 | 5 | 4 | 3 | 2 | 2 | 3 | **3,20** |
| G. .NET / Flutter | 2 | 1 | 4 | 4 | 4 | 1 | 4 | **2,85** |

A matriz confirma o que a intuição diz: **Electron ganha em tempo e maturidade**, Tauri ganha em pegada,
mas perde em tempo e aderência. A pegada só vira critério decisivo se (a) o Node sair do pacote ou (b) o
cliente reclamar de tamanho/RAM — nenhum dos dois é verdade hoje.

---

## 9. Roadmap por fases

| Fase | Duração | Entregas | Portão de aceite |
|---|---|---|---|
| **0. Fundação** | 1–2 sem | OpenAPI estável, tipos TS, Vite, quebra do `app.js` em módulos, tokens de design, Playwright de fumaça | UI roda em `vite dev` contra o BFF; caso de aceite do README verde |
| **1. Casca desktop** | 3–4 sem | Electron, supervisor de sidecars, splash, health, logs, menus, bandeja, single instance, portas efêmeras + token, NSIS por usuário, Sobre com versões | instala em VM limpa sem admin, abre em ≤ 10 s, desinstala sem resíduo e sem processo órfão |
| **2. UX de desktop** | 3–4 sem | abrir/salvar, exportar PDF/XLSX/CSV, imprimir, atalhos, histórico em SQLite, busca/favoritos, *support bundle*, canal beta de atualização | atualização N-1 → N preserva histórico; *bundle* permite diagnosticar sem acesso à máquina |
| **3. Produto** | 4–6 sem | workspace com navegação (Simulador, Comparador, Histórico, Contratos, Configurações), `tenant_id`, onboarding, tema escuro, i18n | teste de usabilidade com 3 usuários; tarefas-chave sem treinamento |
| **4. Consolidação (opcional)** | 4–6 sem | BFF para Java, start sob demanda, runtime único, redução de RAM/abertura | métricas de abertura/RAM medidas antes/depois |

Total: **11–16 semanas** para o desktop vendável em Windows, com 2 pessoas, sem as ondas de XML/SEFAZ do
`docs/produto.md`. macOS/Linux entram depois de a versão Windows estabilizar (+3–5 semanas).

### O que não fazer nesta fase

- Reescrever a UI em JavaFX/Flutter/.NET.
- Fundir os dois motores em um JVM.
- Subir servidor remoto/multiempresa antes do desktop single-tenant.
- Auto-update sem assinatura e sem rollback.
- Expor os motores em `0.0.0.0` ou em porta fixa.
- Empacotar com JRE completo *e* runtime `jlink` ao mesmo tempo.
- Migrar para Tauri antes de medir se tamanho/RAM são realmente objeção.

---

## 10. Riscos e mitigação

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Abertura lenta (dois Spring Boot) | Alta | Alto | start paralelo, splash com status, start sob demanda do Simples, tuning de JVM, medir no spike |
| RAM alta em máquinas de 8 GB | Média | Alto | jlink, `-Xmx` explícito, desligar Simples ocioso, medir com os dois perfis |
| Processo órfão / porta presa | Média | Alto | supervisor, *job object*/`taskkill /T`, portas efêmeras, single instance |
| Base/JAR fora de sincronia após update | Média | Alto | release atômica, checagem de compatibilidade, rollback versionado |
| SmartScreen/antivírus | Alta (sem assinatura) | Alto | assinar, enviar para reputação, instalar por usuário, MSI para frota |
| Proxy/firewall corporativo | Média | Médio | tudo em loopback; documentar; testar em imagem corporativa |
| Regressão visual ao migrar para Vite | Média | Médio | Playwright + capturas antes/depois; migração incremental |
| `app.js` monolítico dificultar evolução | Alta | Médio | quebrar em módulos na fase 0, sem trocar framework |
| WebView divergente (se Tauri) | Média | Médio | regressão visual em WebView2/WKWebView/WebKitGTK |
| Vazamento de dado fiscal em log/crash | Baixa | Alto | scrubbing, telemetria opt-in, revisão de logs |
| Dependência de fonte/CSS remotos | Alta (hoje) | Baixo | empacotar fontes e assets localmente |
| Licenças de terceiros | Baixa | Médio | SBOM + avisos no "Sobre" |

---

## 11. Spike técnico de uma semana

Objetivo: trocar estimativas por números antes de aprovar a fase 1.

| Dia | Experimento | Critério de sucesso |
|---|---|---|
| 1 | `jlink` com módulos descobertos; subir os dois JARs com o runtime gerado | ambos calculam o caso de aceite; runtime ≤ 110 MB; abertura medida |
| 2 | Electron spawn + health + encerramento em árvore no Windows | 10 ciclos abrir/fechar sem processo órfão e sem porta presa |
| 3 | portas efêmeras + token no BFF e nos motores | nenhuma porta responde sem token; sem prompt de firewall |
| 4 | NSIS por usuário, sem admin, com JARs + runtime + base; teste em VM limpa | instala/abre/desinstala; medir instalador e tempo de abertura |
| 5 | updater local: N-1 → N com troca de base; rollback | histórico preservado; rollback em < 2 min; medir RAM ociosa |

Se o dia 4 não fechar em uma VM limpa, o problema é de empacotamento — e não de framework. Esse é o
sinal para resolver antes de investir em Tauri ou em reescrita.

---

## 12. Custos recorrentes (ordem de grandeza)

| Item | Faixa |
|---|---|
| Certificado Windows (Azure Trusted Signing ou OV) | US$ 120–600/ano |
| Apple Developer Program | US$ 99/ano |
| Armazenamento/CDN de atualizações | US$ 5–30/mês |
| CI (macOS runner consome mais) | US$ 0–100/mês |
| VM Windows para teste de instalação | US$ 0–40/mês |

O custo relevante é de **processo**: assinatura, teste em máquina limpa e suporte a versões. Não é
licença de framework.

---

## 13. Decisões pendentes

1. **Plataformas do primeiro release:** só Windows ou Windows + macOS?
2. **Frota:** há exigência de MSI/GPO/Intune e instalação silenciosa?
3. **Offline/air-gapped:** o app precisa funcionar em máquina sem internet e com atualização manual?
4. **Multiusuário/multiempresa:** haverá versão servidor depois? (muda storage, autenticação e tenancy)
5. **Assinatura:** a empresa já tem certificado ou entramos com Azure Trusted Signing?
6. **Máquinas alvo:** qual o piso de RAM/CPU? Isso define se o Simples pode ficar sempre no ar.
7. **Auto-update:** automático ou controlado pelo TI do cliente?
8. **Tamanho:** instalador de ~250 MB é objeção comercial?
9. **Tema escuro e i18n:** entram na fase 2 ou na 3?
10. **Telemetria:** permitida (opt-in) ou proibida por política?

Com as respostas 1, 2, 6 e 8, a escolha entre Electron e Tauri fica fechada; as demais ajustam o escopo
das fases 2 e 3, não a arquitetura.
