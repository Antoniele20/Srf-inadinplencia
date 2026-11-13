// Regras de negócio puras do Controle de Inadimplência.
//
// Este arquivo é o espelho, em JavaScript, das classes de domínio do back-end
// (backend/src/SRF.Inadimplencia.Api/Dominio/Regras). O front-end usa estas funções
// para prévias na tela (simulador de encargos, valor sugerido na baixa) e no modo
// demonstração. Na operação real, quem decide é sempre a API.
//
// Todas as funções recebem datas como texto 'AAAA-MM-DD' e não acessam relógio,
// rede nem armazenamento: dadas as mesmas entradas, devolvem sempre a mesma saída.

import { diasEntre, montarData, partes, somarDias } from '../lib/datas.js';

export const STATUS = Object.freeze({ VERDE: 'Verde', AMARELO: 'Amarelo', VERMELHO: 'Vermelho' });

/** Dias de atraso em que a régua de cobrança emite um novo aviso. */
export const MARCOS_ATRASO = Object.freeze([1, 7, 15, 30, 45, 60, 90]);

/** A parcela de um mês é gerada quando faltam até 10 dias para o mês começar. */
export const HORIZONTE_GERACAO_DIAS = 10;

/** Parâmetros iniciais. Todos podem ser alterados em Configurações (perfil Financeiro/Admin). */
export const CONFIG_PADRAO = Object.freeze({
  multaPercentual: 2,
  jurosDiarioPercentual: 0.033,
  diasParaBloqueio: 30,
  diasAvisoPreVencimento: 3,
});

export const FAIXAS = Object.freeze(['Em dia', '1 a 30 dias', '31 a 60 dias', 'Acima de 60 dias']);

/** Arredonda para centavos. */
export function arredondar(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

/** Dias corridos de atraso de um vencimento em relação à data-base (nunca negativo). */
export function diasDeAtraso(vencimento, dataBase) {
  return Math.max(0, diasEntre(vencimento, dataBase));
}

/**
 * Multa e juros de mora sobre o valor principal, apenas para exibição do saldo atualizado.
 * - Multa: percentual único, aplicado a partir do 1º dia de atraso.
 * - Juros: percentual ao dia (juros simples) multiplicado pelos dias de atraso.
 */
export function calcularEncargos(valorOriginal, vencimento, dataBase, config) {
  const principal = arredondar(valorOriginal);
  const dias = diasDeAtraso(vencimento, dataBase);
  if (dias === 0) {
    return { diasAtraso: 0, multa: 0, juros: 0, valorAtualizado: principal };
  }
  const multa = arredondar((principal * Number(config.multaPercentual)) / 100);
  const juros = arredondar(((principal * Number(config.jurosDiarioPercentual)) / 100) * dias);
  return { diasAtraso: dias, multa, juros, valorAtualizado: arredondar(principal + multa + juros) };
}

/**
 * Semáforo de inadimplência, pelo atraso da parcela vencida mais antiga:
 * Verde = em dia; Amarelo = de 1 dia até o prazo de bloqueio; Vermelho = acima do prazo.
 */
export function classificarStatus(diasAtraso, diasParaBloqueio) {
  if (diasAtraso <= 0) return STATUS.VERDE;
  return diasAtraso > diasParaBloqueio ? STATUS.VERMELHO : STATUS.AMARELO;
}

/** Faixa de atraso usada nos relatórios (aging). */
export function faixaDeAtraso(diasAtraso) {
  if (diasAtraso <= 0) return FAIXAS[0];
  if (diasAtraso <= 30) return FAIXAS[1];
  if (diasAtraso <= 60) return FAIXAS[2];
  return FAIXAS[3];
}

/** Uma liberação temporária vale enquanto não for revogada e a data final não tiver passado. */
export function liberacaoAtiva(liberacao, hoje) {
  return !liberacao.revogadaEm && liberacao.dataFim >= hoje;
}

/**
 * Situação financeira de um cliente a partir das parcelas em aberto e das liberações.
 * `parcelasAbertas`: [{ valorOriginal, dataVencimento }]
 * `liberacoes`: [{ dataFim, revogadaEm }]
 */
export function avaliarSituacao(parcelasAbertas, liberacoes, config, hoje) {
  let diasAtraso = 0;
  let parcelasVencidas = 0;
  let valorVencido = 0;
  let valorMulta = 0;
  let valorJuros = 0;
  let valorAVencer = 0;
  let vencimentoMaisAntigo = null;

  for (const parcela of parcelasAbertas) {
    const encargos = calcularEncargos(parcela.valorOriginal, parcela.dataVencimento, hoje, config);
    if (encargos.diasAtraso > 0) {
      parcelasVencidas += 1;
      valorVencido += Number(parcela.valorOriginal);
      valorMulta += encargos.multa;
      valorJuros += encargos.juros;
      if (encargos.diasAtraso > diasAtraso) {
        diasAtraso = encargos.diasAtraso;
        vencimentoMaisAntigo = parcela.dataVencimento;
      }
    } else {
      valorAVencer += Number(parcela.valorOriginal);
    }
  }

  const status = classificarStatus(diasAtraso, config.diasParaBloqueio);

  let liberacaoAte = null;
  for (const liberacao of liberacoes || []) {
    if (liberacaoAtiva(liberacao, hoje) && (liberacaoAte === null || liberacao.dataFim > liberacaoAte)) {
      liberacaoAte = liberacao.dataFim;
    }
  }
  if (status !== STATUS.VERMELHO) liberacaoAte = null;

  return {
    status,
    diasAtraso,
    faixaAtraso: faixaDeAtraso(diasAtraso),
    vencimentoMaisAntigo,
    parcelasVencidas,
    valorVencido: arredondar(valorVencido),
    valorMulta: arredondar(valorMulta),
    valorJuros: arredondar(valorJuros),
    valorEncargos: arredondar(valorMulta + valorJuros),
    valorAtualizado: arredondar(valorVencido + valorMulta + valorJuros),
    valorAVencer: arredondar(valorAVencer),
    // Bloqueio operacional: Vermelho sem liberação temporária vigente.
    bloqueado: status === STATUS.VERMELHO && liberacaoAte === null,
    liberacaoAte,
    // Para clientes em Amarelo: em quantos dias o semáforo passa a Vermelho.
    diasAteBloqueio: status === STATUS.AMARELO ? config.diasParaBloqueio - diasAtraso + 1 : null,
  };
}

/** Maior marco da régua já alcançado pelo atraso (ou null se ainda não há atraso). */
export function marcoDeAtraso(diasAtraso) {
  let marco = null;
  for (const m of MARCOS_ATRASO) {
    if (diasAtraso >= m) marco = m;
  }
  return marco;
}

/** O lembrete é emitido da antecedência configurada até o dia do vencimento. */
export function deveLembrarVencimento(vencimento, hoje, diasAvisoPreVencimento) {
  const faltam = diasEntre(hoje, vencimento);
  return faltam >= 0 && faltam <= diasAvisoPreVencimento;
}

function diasNoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Vencimentos que um contrato deve ter gerado até a data de hoje (mais o horizonte).
 * Uma parcela por mês de competência, no dia de vencimento do contrato,
 * a partir do primeiro vencimento igual ou posterior ao início do contrato.
 */
export function vencimentosDevidos(contrato, hoje, horizonteDias = HORIZONTE_GERACAO_DIAS) {
  if (!contrato.ativo) return [];
  const limite = partes(somarDias(hoje, horizonteDias));
  let { ano, mes } = partes(contrato.dataInicio);
  const lista = [];
  let protecao = 0;
  while ((ano < limite.ano || (ano === limite.ano && mes <= limite.mes)) && protecao < 600) {
    const dia = Math.min(Number(contrato.diaVencimento), diasNoMes(ano, mes));
    const dataVencimento = montarData(ano, mes, dia);
    const dentroDoContrato =
      dataVencimento >= contrato.dataInicio && (!contrato.dataFim || dataVencimento <= contrato.dataFim);
    if (dentroDoContrato) {
      lista.push({ competencia: montarData(ano, mes, 1), dataVencimento });
    }
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
    protecao += 1;
  }
  return lista;
}

/** Situação de exibição de uma cobrança. */
export function situacaoDaCobranca(parcela, hoje) {
  if (parcela.status === 'Paga') return 'Paga';
  if (parcela.status === 'Cancelada') return 'Cancelada';
  return parcela.dataVencimento < hoje ? 'Vencida' : 'EmAberto';
}

export function numeroDaCobranca(parcela) {
  return `COB-${String(parcela.dataVencimento).slice(0, 4)}-${String(parcela.id).padStart(4, '0')}`;
}

export function numeroDoContrato(contrato) {
  return `CT-${String(contrato.dataInicio).slice(0, 4)}-${String(contrato.id).padStart(3, '0')}`;
}
