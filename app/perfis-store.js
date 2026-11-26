/**
 * Persistência dos perfis de transportadores.
 *
 * Arquivo único (`app/data/perfis.json`), escrita atômica e fila de gravação:
 * dois cliques rápidos não corrompem o arquivo e um JSON inválido nunca derruba
 * o simulador — vira backup e a base recomeça com os exemplos.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LIMITES, PerfilInvalidoError, chaveDoNome, normalizarPerfil, resumoDoPerfil } from './perfis.js'
import { EXEMPLOS } from './exemplos.js'

const RAIZ = fileURLToPath(new URL('./', import.meta.url))
const PASTA = path.join(RAIZ, 'data')
const ARQUIVO = path.join(PASTA, 'perfis.json')
const VERSAO = 1

const estado = {
  carregado: false,
  dados: null,
  fila: Promise.resolve(),
}

function agora() {
  return new Date().toISOString()
}

function novoId() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

async function lerArquivo() {
  try {
    const texto = await readFile(ARQUIVO, 'utf8')
    const json = JSON.parse(texto)
    if (!json || !Array.isArray(json.perfis)) return null
    return {
      versao: Number(json.versao) || VERSAO,
      atualizadoEm: json.atualizadoEm ?? null,
      perfis: json.perfis.filter((perfil) => perfil && perfil.id && perfil.nome),
    }
  } catch {
    return null
  }
}

async function preservarCorrompido() {
  try {
    const texto = await readFile(ARQUIVO, 'utf8')
    const backup = path.join(PASTA, `perfis.invalido-${Date.now()}.json`)
    await writeFile(backup, texto, 'utf8')
  } catch {
    // sem arquivo legível, não há o que preservar
  }
}

function perfisDeExemplo() {
  const em = agora()
  return EXEMPLOS.map((exemplo) => ({
    id: novoId(),
    ...normalizarPerfil(exemplo),
    criadoEm: em,
    atualizadoEm: em,
  }))
}

async function carregar() {
  if (estado.carregado) return estado.dados
  await mkdir(PASTA, { recursive: true })
  const lido = await lerArquivo()
  if (lido) {
    estado.dados = lido
  } else {
    await preservarCorrompido()
    estado.dados = { versao: VERSAO, atualizadoEm: agora(), perfis: perfisDeExemplo() }
    await gravar(estado.dados)
  }
  estado.carregado = true
  return estado.dados
}

async function gravar(dados) {
  const conteudo = {
    versao: VERSAO,
    atualizadoEm: agora(),
    perfis: dados.perfis,
  }
  const temporario = `${ARQUIVO}.tmp`
  await writeFile(temporario, `${JSON.stringify(conteudo, null, 2)}\n`, 'utf8')
  await rename(temporario, ARQUIVO)
  estado.dados = conteudo
}

/** Serializa as gravações: uma de cada vez, na ordem dos cliques. */
function enfileirar(operacao) {
  const proxima = estado.fila.then(operacao, operacao)
  estado.fila = proxima.catch(() => {})
  return proxima
}

function conflitoDeNome(perfis, nome, idIgnorado = null) {
  const chave = chaveDoNome(nome)
  return perfis.some((perfil) => perfil.id !== idIgnorado && chaveDoNome(perfil.nome) === chave)
}

export async function listar() {
  const dados = await carregar()
  const perfis = [...dados.perfis].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
  return {
    perfis: perfis.map(resumoDoPerfil),
    total: perfis.length,
    atualizadoEm: dados.atualizadoEm,
    limite: LIMITES.perfis,
  }
}

export async function obter(id) {
  const dados = await carregar()
  return dados.perfis.find((perfil) => perfil.id === id) ?? null
}

/** Perfis completos (não só o cartão), para o comparador. */
export async function todos() {
  const dados = await carregar()
  return [...dados.perfis]
}

export async function criar(entrada) {
  return enfileirar(async () => {
    const dados = await carregar()
    const novo = { ...normalizarPerfil(entrada), id: novoId(), criadoEm: agora(), atualizadoEm: agora() }

    if (dados.perfis.length >= LIMITES.perfis) {
      throw new PerfilInvalidoError('nome', `Você já tem ${LIMITES.perfis} perfis. Exclua um para criar outro.`)
    }
    if (conflitoDeNome(dados.perfis, novo.nome)) {
      throw new PerfilInvalidoError('nome', 'Já existe um perfil com esse nome.')
    }

    await gravar({ ...dados, perfis: [...dados.perfis, novo] })
    return novo
  })
}

export async function atualizar(id, entrada) {
  return enfileirar(async () => {
    const dados = await carregar()
    const indice = dados.perfis.findIndex((perfil) => perfil.id === id)
    if (indice < 0) return null

    const atual = dados.perfis[indice]
    const parcial = normalizarPerfil(entrada, { parcial: true })
    const mesclado = { ...atual, ...parcial }
    const completo = normalizarPerfil(mesclado)

    if (conflitoDeNome(dados.perfis, completo.nome, id)) {
      throw new PerfilInvalidoError('nome', 'Já existe um perfil com esse nome.')
    }

    const atualizado = { ...atual, ...completo, id, criadoEm: atual.criadoEm ?? agora(), atualizadoEm: agora() }
    const perfis = [...dados.perfis]
    perfis[indice] = atualizado
    await gravar({ ...dados, perfis })
    return atualizado
  })
}

export async function remover(id) {
  return enfileirar(async () => {
    const dados = await carregar()
    const perfis = dados.perfis.filter((perfil) => perfil.id !== id)
    if (perfis.length === dados.perfis.length) return false
    await gravar({ ...dados, perfis })
    return true
  })
}

/** Repõe os exemplos de fábrica (usado no reset da interface). */
export async function restaurarExemplos() {
  return enfileirar(async () => {
    const dados = await carregar()
    await gravar({ ...dados, perfis: perfisDeExemplo() })
    return dados.perfis
  })
}
