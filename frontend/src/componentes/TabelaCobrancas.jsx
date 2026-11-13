// Tabela de cobranças com as ações do perfil Financeiro/Admin (baixa, edição, cancelamento, estorno).
// Usada na tela Cobranças e na ficha do cliente.
import { useState } from 'react';
import { api } from '../api/index.js';
import { useMensagens } from '../contextos/Mensagens.jsx';
import { useSessao } from '../contextos/Sessao.jsx';
import { competencia, data, dataCurta, moeda, plural } from '../lib/formatos.js';
import { Botao, Etiqueta, Icone, Tabela, Vazio } from './base.jsx';
import { avisarMudanca, useHoje } from './Estrutura.jsx';
import { Confirmacao, FormBaixa, FormCancelarCobranca, FormEditarCobranca } from './formularios.jsx';

const SITUACAO = {
  Paga: { texto: 'Paga', cor: 'verde' },
  EmAberto: { texto: 'Em aberto', cor: 'azul' },
  Vencida: { texto: 'Vencida', cor: 'vermelho' },
  Cancelada: { texto: 'Cancelada', cor: '' },
};

export function EtiquetaSituacao({ situacao }) {
  const s = SITUACAO[situacao] || { texto: situacao, cor: '' };
  return <Etiqueta cor={s.cor}>{s.texto}</Etiqueta>;
}

function mensagemDaMudanca(acao, resultado) {
  const nome = resultado.cliente.nome;
  if (resultado.statusAnterior !== resultado.statusAtual) {
    const liberado = resultado.liberado ? ' Novas solicitações estão liberadas.' : '';
    return `${acao} ${nome} passou de ${resultado.statusAnterior} para ${resultado.statusAtual}.${liberado}`;
  }
  return acao;
}

export function TabelaCobrancas({ cobrancas, mostrarCliente = true, aoMudar, vazio }) {
  const { ehAdmin } = useSessao();
  const { avisar } = useMensagens();
  const hoje = useHoje();
  const [janela, setJanela] = useState(null); // { tipo: 'baixa' | 'editar' | 'cancelar' | 'estornar', cobranca }

  function concluir(acao) {
    return (resultado) => {
      setJanela(null);
      avisar(mensagemDaMudanca(acao, resultado));
      avisarMudanca();
      aoMudar();
    };
  }

  const colunas = [
    {
      id: 'numero',
      titulo: 'Cobrança',
      celula: (c) => (
        <span className="celula-dupla">
          <span className="num nowrap forte">{c.numero}</span>
          <small className="nowrap">{c.contratoNumero}</small>
        </span>
      ),
    },
    mostrarCliente && {
      id: 'cliente',
      titulo: 'Cliente',
      celula: (c) => (
        <a className="link-linha" href={`#cliente-${c.clienteId}`}>
          {c.clienteNome}
        </a>
      ),
    },
    {
      id: 'vencimento',
      titulo: 'Vencimento',
      celula: (c) => (
        <span className="celula-dupla">
          <span className="num">{data(c.dataVencimento)}</span>
          <small>Honorários de {competencia(c.competencia)}</small>
        </span>
      ),
    },
    { id: 'valor', titulo: 'Valor', direita: true, celula: (c) => moeda(c.valorOriginal) },
    {
      id: 'atraso',
      titulo: 'Atraso',
      direita: true,
      celula: (c) => (c.diasAtraso > 0 ? plural(c.diasAtraso, 'dia', 'dias') : <span className="suave">—</span>),
    },
    {
      id: 'encargos',
      titulo: 'Multa e juros',
      direita: true,
      celula: (c) => (c.multa + c.juros > 0 ? moeda(c.multa + c.juros) : <span className="suave">—</span>),
    },
    {
      id: 'total',
      titulo: 'Atualizado ou pago',
      direita: true,
      celula: (c) =>
        c.status === 'Paga' ? (
          <span className="celula-dupla">
            <span>{moeda(c.valorPago)}</span>
            <small>pago em {dataCurta(c.dataPagamento)}</small>
          </span>
        ) : c.status === 'Cancelada' ? (
          <span className="suave">—</span>
        ) : (
          <span className="forte">{moeda(c.valorAtualizado)}</span>
        ),
    },
    { id: 'situacao', titulo: 'Situação', celula: (c) => <EtiquetaSituacao situacao={c.situacao} /> },
    ehAdmin && {
      id: 'acoes',
      titulo: <span className="so-leitor">Ações</span>,
      celula: (c) => (
        <div className="acoes-linha">
          {c.status === 'Aberta' ? (
            <>
              <Botao pequeno variante="primario" onClick={() => setJanela({ tipo: 'baixa', cobranca: c })}>
                Dar baixa
              </Botao>
              <button type="button" className="botao fantasma pequeno" title="Editar valor ou vencimento" aria-label={`Editar cobrança ${c.numero}`} onClick={() => setJanela({ tipo: 'editar', cobranca: c })}>
                <Icone nome="editar" tamanho={15} />
              </button>
              <button type="button" className="botao fantasma pequeno" title="Cancelar cobrança" aria-label={`Cancelar cobrança ${c.numero}`} onClick={() => setJanela({ tipo: 'cancelar', cobranca: c })}>
                <Icone nome="fechar" tamanho={15} />
              </button>
            </>
          ) : null}
          {c.status === 'Paga' ? (
            <Botao pequeno onClick={() => setJanela({ tipo: 'estornar', cobranca: c })}>
              Estornar
            </Botao>
          ) : null}
        </div>
      ),
    },
  ].filter(Boolean);

  return (
    <>
      <Tabela legenda="Cobranças" colunas={colunas} linhas={cobrancas} vazio={vazio || <Vazio titulo="Nenhuma cobrança encontrada">Mude os filtros para ver outras cobranças.</Vazio>} />

      {janela && janela.tipo === 'baixa' ? (
        <FormBaixa cobranca={janela.cobranca} hoje={hoje} aoFechar={() => setJanela(null)} aoSalvar={concluir('Pagamento registrado.')} />
      ) : null}
      {janela && janela.tipo === 'editar' ? (
        <FormEditarCobranca cobranca={janela.cobranca} aoFechar={() => setJanela(null)} aoSalvar={concluir('Cobrança alterada.')} />
      ) : null}
      {janela && janela.tipo === 'cancelar' ? (
        <FormCancelarCobranca cobranca={janela.cobranca} aoFechar={() => setJanela(null)} aoSalvar={concluir('Cobrança cancelada.')} />
      ) : null}
      {janela && janela.tipo === 'estornar' ? (
        <Confirmacao
          titulo={`Estornar pagamento da cobrança ${janela.cobranca.numero}`}
          rotulo="Estornar pagamento"
          perigo
          acao={() => api.cobrancas.estornar(janela.cobranca.id)}
          aoFechar={() => setJanela(null)}
          aoConcluir={concluir('Pagamento estornado.')}
        >
          A cobrança de {janela.cobranca.clienteNome} volta a ficar em aberto, com vencimento em {data(janela.cobranca.dataVencimento)}. O semáforo do
          cliente é recalculado e ele pode voltar a ser bloqueado.
        </Confirmacao>
      ) : null}
    </>
  );
}
