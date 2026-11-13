import { useState } from 'react';
import { api } from '../api/index.js';
import { Botao, EstadoDeCarga, Etiqueta, Nota, Pagina, Painel, Segmentos, Tabela, Vazio } from '../componentes/base.jsx';
import { avisarMudanca } from '../componentes/Estrutura.jsx';
import { FormSolicitacao } from '../componentes/formularios.jsx';
import { useMensagens } from '../contextos/Mensagens.jsx';
import { dataHora } from '../lib/formatos.js';
import { useDados } from '../lib/hooks.js';
import { ROTULO_TIPO_SOLICITACAO } from '../lib/rotulos.js';

export default function Solicitacoes() {
  const { avisar, avisarErro } = useMensagens();
  const consulta = useDados(() => api.solicitacoes.listar(), []);
  const [filtro, setFiltro] = useState('Aberta');
  const [criando, setCriando] = useState(false);

  const todas = consulta.dados || [];
  const visiveis = todas.filter((s) => !filtro || s.status === filtro);

  async function concluir(solicitacao) {
    try {
      await api.solicitacoes.concluir(solicitacao.id);
      avisar('Solicitação concluída.');
      consulta.recarregar();
    } catch (erro) {
      avisarErro(erro);
    }
  }

  return (
    <Pagina
      titulo="Solicitações"
      descricao="Demandas operacionais abertas para os clientes. É aqui que o bloqueio age: cliente no vermelho não recebe nova solicitação nem abertura de processo."
      acoes={
        <Botao variante="primario" icone="mais" onClick={() => setCriando(true)}>
          Nova solicitação
        </Botao>
      }
    >
      <Nota icone="cadeado">
        Antes de registrar, o sistema confere a situação financeira do cliente. Se ele estiver bloqueado, o registro não é aceito. O Financeiro pode
        conceder uma liberação temporária em caso de renegociação.
      </Nota>

      <Painel>
        <div className="filtros">
          <Segmentos
            rotulo="Filtrar solicitações"
            valor={filtro}
            aoMudar={setFiltro}
            opcoes={[
              { valor: 'Aberta', texto: 'Abertas', qtd: todas.filter((s) => s.status === 'Aberta').length },
              { valor: 'Concluida', texto: 'Concluídas', qtd: todas.filter((s) => s.status === 'Concluida').length },
              { valor: '', texto: 'Todas', qtd: todas.length },
            ]}
          />
        </div>
        {consulta.dados ? (
          <Tabela
            legenda="Solicitações"
            linhas={visiveis}
            vazio={<Vazio titulo="Nenhuma solicitação nesta lista">Use Nova solicitação para registrar uma demanda.</Vazio>}
            colunas={[
              { id: 'abertura', titulo: 'Abertura', celula: (s) => <span className="num nowrap">{dataHora(s.criadoEm)}</span> },
              {
                id: 'cliente',
                titulo: 'Cliente',
                celula: (s) => (
                  <a className="link-linha" href={`#cliente-${s.clienteId}`}>
                    {s.clienteNome}
                  </a>
                ),
              },
              { id: 'tipo', titulo: 'Tipo', celula: (s) => ROTULO_TIPO_SOLICITACAO[s.tipo] },
              { id: 'descricao', titulo: 'Descrição', celula: (s) => <div className="texto-quebra">{s.descricao}</div> },
              { id: 'por', titulo: 'Aberta por', celula: (s) => s.criadoPor },
              {
                id: 'situacao',
                titulo: 'Situação',
                celula: (s) =>
                  s.status === 'Concluida' ? (
                    <span className="celula-dupla">
                      <Etiqueta cor="verde">Concluída</Etiqueta>
                      <small className="num">{dataHora(s.concluidaEm)}</small>
                    </span>
                  ) : (
                    <Etiqueta cor="azul">Aberta</Etiqueta>
                  ),
              },
              {
                id: 'acoes',
                titulo: <span className="so-leitor">Ações</span>,
                celula: (s) =>
                  s.status === 'Aberta' ? (
                    <div className="acoes-linha">
                      <Botao pequeno icone="check" onClick={() => concluir(s)}>
                        Concluir
                      </Botao>
                    </div>
                  ) : null,
              },
            ]}
          />
        ) : (
          <div className="painel-corpo">
            <EstadoDeCarga consulta={consulta} />
          </div>
        )}
      </Painel>

      {criando ? (
        <FormSolicitacao
          aoFechar={() => setCriando(false)}
          aoSalvar={() => {
            setCriando(false);
            setFiltro('Aberta');
            avisar('Solicitação registrada.');
            avisarMudanca();
            consulta.recarregar();
          }}
        />
      ) : null}
    </Pagina>
  );
}
