import { useState } from 'react';
import { api } from '../api/index.js';
import { Botao, CampoBusca, EstadoDeCarga, Etiqueta, Pagina, Painel, Segmentos, Tabela, Vazio } from '../componentes/base.jsx';
import { avisarMudanca, useHoje } from '../componentes/Estrutura.jsx';
import { Confirmacao, FormContrato } from '../componentes/formularios.jsx';
import { useMensagens } from '../contextos/Mensagens.jsx';
import { useSessao } from '../contextos/Sessao.jsx';
import { data, moeda, plural } from '../lib/formatos.js';
import { useDados } from '../lib/hooks.js';

export default function Contratos() {
  const { ehAdmin } = useSessao();
  const { avisar } = useMensagens();
  const hoje = useHoje();
  const consulta = useDados(() => api.contratos.listar(), []);
  const [filtro, setFiltro] = useState('ativos');
  const [busca, setBusca] = useState('');
  const [janela, setJanela] = useState(null); // { tipo: 'novo' | 'editar' | 'encerrar', contrato }

  const todos = consulta.dados || [];
  const termo = busca.trim().toLowerCase();
  const visiveis = todos
    .filter((c) => filtro === 'todos' || (filtro === 'ativos' ? c.ativo : !c.ativo))
    .filter((c) => !termo || c.clienteNome.toLowerCase().includes(termo) || c.numero.toLowerCase().includes(termo) || c.descricao.toLowerCase().includes(termo));
  const totalMensal = visiveis.filter((c) => c.ativo).reduce((soma, c) => soma + c.valorMensal, 0);

  function concluir(mensagem) {
    return () => {
      setJanela(null);
      avisar(mensagem);
      avisarMudanca();
      consulta.recarregar();
    };
  }

  const colunas = [
    { id: 'numero', titulo: 'Contrato', celula: (c) => <span className="num nowrap forte">{c.numero}</span> },
    {
      id: 'cliente',
      titulo: 'Cliente',
      celula: (c) => (
        <span className="celula-dupla">
          <a className="link-linha" href={`#cliente-${c.clienteId}`}>
            {c.clienteNome}
          </a>
          <small>{c.descricao}</small>
        </span>
      ),
    },
    { id: 'valor', titulo: 'Honorário mensal', direita: true, celula: (c) => moeda(c.valorMensal) },
    { id: 'dia', titulo: 'Vencimento', celula: (c) => `Todo dia ${c.diaVencimento}` },
    { id: 'inicio', titulo: 'Início', celula: (c) => <span className="num">{data(c.dataInicio)}</span> },
    {
      id: 'situacao',
      titulo: 'Situação',
      celula: (c) =>
        !c.ativo ? (
          <Etiqueta>Encerrado em {data(c.dataFim)}</Etiqueta>
        ) : c.inadimplente ? (
          <Etiqueta cor="vermelho">{plural(c.parcelasVencidas, 'cobrança vencida', 'cobranças vencidas')}</Etiqueta>
        ) : (
          <Etiqueta cor="verde">Ativo, em dia</Etiqueta>
        ),
    },
    ehAdmin && {
      id: 'acoes',
      titulo: <span className="so-leitor">Ações</span>,
      celula: (c) =>
        c.ativo ? (
          <div className="acoes-linha">
            <Botao pequeno onClick={() => setJanela({ tipo: 'editar', contrato: c })}>
              Editar
            </Botao>
            <Botao pequeno variante="perigo" onClick={() => setJanela({ tipo: 'encerrar', contrato: c })}>
              Encerrar
            </Botao>
          </div>
        ) : null,
    },
  ].filter(Boolean);

  return (
    <Pagina
      titulo="Contratos"
      descricao="Cada contrato ativo gera uma cobrança por mês, no dia de vencimento combinado."
      acoes={
        ehAdmin ? (
          <Botao variante="primario" icone="mais" onClick={() => setJanela({ tipo: 'novo' })}>
            Novo contrato
          </Botao>
        ) : null
      }
    >
      <Painel>
        <div className="filtros">
          <CampoBusca valor={busca} aoMudar={setBusca} rotulo="Buscar por cliente, número ou serviço" />
          <Segmentos
            rotulo="Filtrar contratos"
            valor={filtro}
            aoMudar={setFiltro}
            opcoes={[
              { valor: 'ativos', texto: 'Ativos', qtd: todos.filter((c) => c.ativo).length },
              { valor: 'encerrados', texto: 'Encerrados', qtd: todos.filter((c) => !c.ativo).length },
              { valor: 'todos', texto: 'Todos', qtd: todos.length },
            ]}
          />
        </div>
        {consulta.dados ? (
          <Tabela
            legenda="Contratos"
            colunas={colunas}
            linhas={visiveis}
            vazio={<Vazio titulo="Nenhum contrato encontrado">Mude a busca ou o filtro.</Vazio>}
            rodape={
              <tr>
                <td colSpan={2}>{plural(visiveis.length, 'contrato', 'contratos')}</td>
                <td className="direita">{moeda(totalMensal)}</td>
                <td colSpan={colunas.length - 3}>por mês nos contratos ativos</td>
              </tr>
            }
          />
        ) : (
          <div className="painel-corpo">
            <EstadoDeCarga consulta={consulta} />
          </div>
        )}
      </Painel>

      {janela && janela.tipo === 'novo' ? <FormContrato hoje={hoje} aoFechar={() => setJanela(null)} aoSalvar={concluir('Contrato criado.')} /> : null}
      {janela && janela.tipo === 'editar' ? (
        <FormContrato contrato={janela.contrato} hoje={hoje} aoFechar={() => setJanela(null)} aoSalvar={concluir('Contrato atualizado.')} />
      ) : null}
      {janela && janela.tipo === 'encerrar' ? (
        <Confirmacao
          titulo={`Encerrar contrato ${janela.contrato.numero}`}
          rotulo="Encerrar contrato"
          perigo
          acao={() => api.contratos.encerrar(janela.contrato.id)}
          aoFechar={() => setJanela(null)}
          aoConcluir={concluir('Contrato encerrado.')}
        >
          O contrato de {janela.contrato.clienteNome} deixa de gerar cobranças. As cobranças que ainda não venceram são canceladas; as vencidas continuam em
          aberto.
        </Confirmacao>
      ) : null}
    </Pagina>
  );
}
