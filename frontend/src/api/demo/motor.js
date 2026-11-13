// Motor do modo demonstração: executa, em memória, a mesma rotina que o back-end
// executa no SQL Server (Aplicacao/Servicos/ServicoInadimplencia.cs).

import { diasEntre, hojeISO, somarDias } from '../../lib/datas.js';
import {
  STATUS,
  avaliarSituacao,
  calcularEncargos,
  deveLembrarVencimento,
  diasDeAtraso,
  marcoDeAtraso,
  numeroDaCobranca,
  vencimentosDevidos,
} from '../../regras/calculos.js';
import { TIPOS_AVISO, modeloDeAviso } from '../../regras/avisos.js';

const DIA_MS = 86400000;

// Relógio do modo demonstração. Os testes automatizados trocam esta função para fixar a data.
let relogio = () => new Date();

export function definirRelogio(funcao) {
  relogio = funcao || (() => new Date());
}

/** Data real de hoje (sem dias simulados). */
export function dataReal() {
  return hojeISO(relogio());
}

/** Data de referência do banco de demonstração (hoje + dias simulados). */
export function hojeDoBanco(banco) {
  return somarDias(dataReal(), banco.deslocamentoDias || 0);
}

export function agoraDoBanco(banco) {
  return new Date(relogio().getTime() + (banco.deslocamentoDias || 0) * DIA_MS).toISOString();
}

export function proximoId(banco, tabela) {
  banco.seq[tabela] = (banco.seq[tabela] || 0) + 1;
  return banco.seq[tabela];
}

export function registrarLog(banco, usuarioId, acao, detalhes) {
  banco.logs.push({
    id: proximoId(banco, 'logs'),
    usuarioId: usuarioId ?? null,
    acao,
    detalhes: detalhes || null,
    ip: usuarioId ? '127.0.0.1' : null,
    dataHora: agoraDoBanco(banco),
  });
}

export function contratosDoCliente(banco, clienteId) {
  return banco.contratos.filter((c) => c.clienteId === clienteId);
}

export function parcelasDoCliente(banco, clienteId) {
  const ids = new Set(contratosDoCliente(banco, clienteId).map((c) => c.id));
  return banco.parcelas.filter((p) => ids.has(p.contratoId));
}

export function situacaoDoCliente(banco, cliente) {
  const abertas = parcelasDoCliente(banco, cliente.id).filter((p) => p.status === 'Aberta');
  const liberacoes = banco.liberacoes.filter((l) => l.clienteId === cliente.id);
  return avaliarSituacao(abertas, liberacoes, banco.config, hojeDoBanco(banco));
}

function criarAviso(banco, { cliente, parcela, tipo, marco, dados }) {
  const modelo = modeloDeAviso(tipo, { cliente: cliente.nome, ...dados });
  banco.avisos.push({
    id: proximoId(banco, 'avisos'),
    clienteId: cliente.id,
    parcelaId: parcela ? parcela.id : null,
    tipo,
    marco: marco ?? null,
    // No modo demonstração nada é enviado: o aviso fica registrado no sistema.
    canal: 'Sistema',
    assunto: modelo.assunto,
    mensagem: modelo.mensagem,
    enviado: false,
    criadoEm: agoraDoBanco(banco),
  });
}

/**
 * Ajusta o status inicial da massa de demonstração sem gerar avisos nem registros,
 * com a data em que cada status teria começado. Equivale ao UPDATE final do script SQL.
 */
export function sincronizarStatusInicial(banco) {
  const hoje = hojeDoBanco(banco);
  for (const cliente of banco.clientes) {
    const s = situacaoDoCliente(banco, cliente);
    cliente.status = s.status;
    if (s.status === STATUS.VERMELHO) {
      cliente.statusDesde = `${somarDias(s.vencimentoMaisAntigo, banco.config.diasParaBloqueio + 1)}T04:00:00Z`;
    } else if (s.status === STATUS.AMARELO) {
      cliente.statusDesde = `${somarDias(s.vencimentoMaisAntigo, 1)}T04:00:00Z`;
    }
    if (cliente.statusDesde.slice(0, 10) > hoje) cliente.statusDesde = `${hoje}T04:00:00Z`;
  }
}

/**
 * Recalcula o semáforo de um cliente e grava a mudança, se houver.
 * É chamada na rotina diária e imediatamente após baixa, estorno ou edição de cobrança.
 */
export function recalcularCliente(banco, cliente, usuarioId = null) {
  const situacao = situacaoDoCliente(banco, cliente);
  const anterior = cliente.status;
  if (anterior === situacao.status) return { mudou: false, situacao };

  cliente.status = situacao.status;
  cliente.statusDesde = agoraDoBanco(banco);
  registrarLog(banco, usuarioId, 'StatusAlterado', `${cliente.nome}: ${anterior} para ${situacao.status}`);

  if (cliente.ativo && situacao.status === STATUS.VERDE) {
    criarAviso(banco, { cliente, tipo: TIPOS_AVISO.REGULARIZACAO, dados: {} });
  }
  if (cliente.ativo && situacao.status === STATUS.VERMELHO) {
    criarAviso(banco, {
      cliente,
      tipo: TIPOS_AVISO.BLOQUEIO,
      dados: { diasParaBloqueio: banco.config.diasParaBloqueio, valorAtualizado: situacao.valorAtualizado },
    });
  }
  return { mudou: true, de: anterior, para: situacao.status, situacao };
}

/** Gera as parcelas mensais que ainda não existem para os contratos ativos. */
export function gerarParcelasPendentes(banco) {
  const hoje = hojeDoBanco(banco);
  const existentes = new Set(banco.parcelas.map((p) => `${p.contratoId}|${p.competencia}`));
  let geradas = 0;
  for (const contrato of banco.contratos) {
    const cliente = banco.clientes.find((c) => c.id === contrato.clienteId);
    if (!contrato.ativo || !cliente || !cliente.ativo) continue;
    for (const devido of vencimentosDevidos(contrato, hoje)) {
      const chave = `${contrato.id}|${devido.competencia}`;
      if (existentes.has(chave)) continue;
      banco.parcelas.push({
        id: proximoId(banco, 'parcelas'),
        contratoId: contrato.id,
        competencia: devido.competencia,
        dataVencimento: devido.dataVencimento,
        valorOriginal: contrato.valorMensal,
        status: 'Aberta',
        dataPagamento: null,
        valorPago: null,
        baixadaPorUsuarioId: null,
        observacao: null,
        criadoEm: agoraDoBanco(banco),
      });
      existentes.add(chave);
      geradas += 1;
    }
  }
  return geradas;
}

/** Régua de cobrança: lembretes, avisos de atraso e aviso de bloqueio. */
export function gerarAvisosDaRegua(banco) {
  const hoje = hojeDoBanco(banco);
  const config = banco.config;
  let gerados = 0;

  const jaEmitido = new Set(
    banco.avisos.filter((a) => a.parcelaId).map((a) => `${a.parcelaId}|${a.tipo}|${a.marco ?? ''}`),
  );

  for (const cliente of banco.clientes) {
    if (!cliente.ativo) continue;
    const abertas = parcelasDoCliente(banco, cliente.id).filter((p) => p.status === 'Aberta');

    for (const parcela of abertas) {
      const dias = diasDeAtraso(parcela.dataVencimento, hoje);
      const numero = numeroDaCobranca(parcela);

      if (dias === 0) {
        const chave = `${parcela.id}|${TIPOS_AVISO.LEMBRETE}|`;
        if (deveLembrarVencimento(parcela.dataVencimento, hoje, config.diasAvisoPreVencimento) && !jaEmitido.has(chave)) {
          criarAviso(banco, {
            cliente,
            parcela,
            tipo: TIPOS_AVISO.LEMBRETE,
            dados: {
              numero,
              competencia: parcela.competencia,
              vencimento: parcela.dataVencimento,
              valor: parcela.valorOriginal,
              faltam: diasEntre(hoje, parcela.dataVencimento),
            },
          });
          jaEmitido.add(chave);
          gerados += 1;
        }
        continue;
      }

      const marco = marcoDeAtraso(dias);
      const chave = `${parcela.id}|${TIPOS_AVISO.ATRASO}|${marco}`;
      if (marco !== null && !jaEmitido.has(chave)) {
        const encargos = calcularEncargos(parcela.valorOriginal, parcela.dataVencimento, hoje, config);
        criarAviso(banco, {
          cliente,
          parcela,
          tipo: TIPOS_AVISO.ATRASO,
          marco,
          dados: {
            numero,
            vencimento: parcela.dataVencimento,
            dias,
            valorAtualizado: encargos.valorAtualizado,
            diasParaBloqueio: config.diasParaBloqueio,
          },
        });
        jaEmitido.add(chave);
        gerados += 1;
      }
    }

    // Um aviso de bloqueio por período em Vermelho.
    if (cliente.status === STATUS.VERMELHO) {
      const jaAvisado = banco.avisos.some(
        (a) => a.clienteId === cliente.id && a.tipo === TIPOS_AVISO.BLOQUEIO && a.criadoEm >= cliente.statusDesde,
      );
      if (!jaAvisado) {
        const situacao = situacaoDoCliente(banco, cliente);
        criarAviso(banco, {
          cliente,
          tipo: TIPOS_AVISO.BLOQUEIO,
          dados: { diasParaBloqueio: config.diasParaBloqueio, valorAtualizado: situacao.valorAtualizado },
        });
        gerados += 1;
      }
    }
  }
  return gerados;
}

/**
 * Rotina diária (requisito RNF05). No back-end ela roda de madrugada; aqui roda ao abrir
 * o sistema, ao simular a passagem de dias e quando o Financeiro/Admin pede.
 */
export function processarRotina(banco, origem, usuarioId = null) {
  const parcelasGeradas = gerarParcelasPendentes(banco);

  let clientesComStatusAlterado = 0;
  for (const cliente of banco.clientes) {
    if (!cliente.ativo) continue;
    if (recalcularCliente(banco, cliente, null).mudou) clientesComStatusAlterado += 1;
  }

  const avisosGerados = gerarAvisosDaRegua(banco);

  const ativos = banco.clientes.filter((c) => c.ativo);
  const bloqueados = ativos.filter((c) => situacaoDoCliente(banco, c).bloqueado).length;

  banco.ultimaRotinaEm = hojeDoBanco(banco);
  const resultado = {
    dataReferencia: hojeDoBanco(banco),
    executadaEm: agoraDoBanco(banco),
    origem,
    parcelasGeradas,
    clientesComStatusAlterado,
    avisosGerados,
    bloqueados,
  };
  registrarLog(
    banco,
    usuarioId,
    'RotinaExecutada',
    `${origem}: ${parcelasGeradas} cobranças geradas, ${clientesComStatusAlterado} mudanças de status, ${avisosGerados} avisos, ${bloqueados} bloqueados`,
  );
  return resultado;
}
