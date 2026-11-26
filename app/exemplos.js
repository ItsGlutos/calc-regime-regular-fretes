/**
 * Perfis de exemplo que abrem junto com o app na primeira execução.
 *
 * As diárias usam o valor BASE das faixas derivadas do piso mínimo da ANTT
 * (carga geral, 6 eixos, tabela de 16/07/2026) por tipo de veículo — ver
 * `docs/especialista-custos-transportes/03-diarias-de-mercado.md` e
 * `referencias-diaria.json`. São referência para o usuário editar, não cotação
 * de mercado: a tela mostra a faixa e o caráter derivado do número.
 *
 * Há duas carretas no mesmo trecho de propósito: uma no regime regular e uma no
 * Simples, com diária nominal menor. É o caso que mostra por que o preço
 * nominal engana quando o crédito muda.
 */
export const EXEMPLOS = [
  {
    nome: 'Carreta dedicada · SP → BA',
    diaria: 3500,
    tipoVeiculo: 'CARRETA',
    ufOrigem: 'SP',
    ufDestino: 'BA',
    perfil: 'REGIME_REGULAR',
    modoDias: 'UTEIS',
    tipoOperacao: 'B2B',
    observacao: 'Contrato dedicado, dias úteis, veículo e motorista do transportador.',
  },
  {
    nome: 'Carreta parceira · SP → BA',
    diaria: 3300,
    tipoVeiculo: 'CARRETA',
    ufOrigem: 'SP',
    ufDestino: 'BA',
    perfil: 'SIMPLES_DAS',
    modoDias: 'UTEIS',
    tipoOperacao: 'B2B',
    aliquotaCbs: 2.3591,
    aliquotaIbs: 0.026,
    dasTotal: 12,
    observacao: 'Diária 5,7% menor, mas o crédito do DAS é uma fração do destaque do regime regular.',
  },
  {
    nome: 'Truck urbano · SP capital',
    diaria: 1800,
    tipoVeiculo: 'TRUCK',
    ufOrigem: 'SP',
    ufDestino: 'SP',
    perfil: 'SIMPLES_DAS',
    modoDias: 'UTEIS',
    tipoOperacao: 'B2B',
    aliquotaCbs: 2.3591,
    aliquotaIbs: 0.026,
    dasTotal: 12,
    observacao: 'Distribuição urbana com a alíquota efetiva do PGDAS informada.',
  },
  {
    nome: 'Toco regional · PR → SC',
    diaria: 1080,
    tipoVeiculo: 'TOCO',
    ufOrigem: 'PR',
    ufDestino: 'SC',
    perfil: 'SIMPLES_DAS',
    modoDias: 'UTEIS',
    tipoOperacao: 'B2B',
    observacao: 'Carga fracionada regional, crédito estimado pela faixa setorial.',
  },
]
