import { useState } from 'react';
import { api } from '../api/index.js';
import { Botao, EstadoDeCarga, Etiqueta, Nota, Pagina, Painel, Tabela, Vazio } from '../componentes/base.jsx';
import { avisarMudanca, useHoje } from '../componentes/Estrutura.jsx';
import { Confirmacao, FormCliente, FormContrato, FormLiberacao, FormSolicitacao } from '../componentes/formularios.jsx';
import { Poste } from '../componentes/Semaforo.jsx';
import { TabelaCobrancas } from '../componentes/TabelaCobrancas.jsx';
import { useMensagens } from '../contextos/Mensagens.jsx';
import { useSessao } from '../contextos/Sessao.jsx';
import { data, dataHora, documento, moeda, plural } from '../lib/formatos.js';
import { useDados } from '../lib/hooks.js';
import { COR_TIPO_AVISO, ROTULO_TIPO_SOLICITACAO } from '../lib/rotulos.js';
import { ROTULO_TIPO_AVISO } from '../regras/avisos.js';

function descreverSituacao(c) {
  if (!c.ativo) {
    return { titulo: 'Cliente inativo', texto: 'Não recebe novas cobranças nem novas solicitações. As cobranças em aberto continuam devidas.' };
  }
  if (c.status === 'Verde') {
    return { titulo: 'Em dia', texto: 'Sem honorários vencidos. Atendimento normal.' };
  }
  if (c.status === 'Amarelo') {
    return {
      titulo: `Em atraso há ${plural(c.diasAtraso, 'dia', 'dias')}`,
      texto: `Avisos de atraso emitidos. Se a cobrança mais antiga continuar em aberto, o bloqueio acontece em ${plural(c.diasAteBloqueio, 'dia', 'dias')}.`,
    };
  }
  if (c.liberacaoAte) {
    return {
      titulo: `Vermelho, com liberação temporária até ${data(c.liberacaoAte)}`,
      texto: `São ${plural(c.diasAtraso, 'dia', 'dias')} de atraso. Novas solicitações estão permitidas até o fim da liberação.`,
    };
  }
  return {
    titulo: 'Bloqueado por inadimplência',
    texto: `São ${plural(c.diasAtraso, 'dia', 'dias')} de atraso. Novas solicitações e aberturas de processo estão suspensas até a regularização.`,
  };
}

export default function ClienteDetalhe({ id }) {
  const { ehAdmin } = useSessao();
  const { avisar } = useMensagens();
  const hoje = useHoje();
  const consulta = useDados(() => api.clientes.obter(id), [id]);
  const [janela, setJanela] = useState(null);

  if (!consulta.dados) {
    return (
      <Pagina titulo="Cliente" voltar={{ href: '#clientes', texto: 'Clientes' }}>
        <EstadoDeCarga consulta={consulta} />
      </Pagina>
    );
  }

  const c = consulta.dados;
  const situacao = descreverSituacao(c);
  const liberacaoVigente = c.liberacoes.find((l) => l.ativa);

  function concluir(mensagem) {
    return () => {
      setJanela(null);
      avisar(mensagem);
      avisarMudanca();
      consulta.recarregar();
    };
  }

  return (
    <Pagina
      titulo={c.nome}
      voltar={{ href: '#clientes', texto: 'Clientes' }}
      acoes={
        <>
          <Botao
            variante="primario"
            icone={c.bloqueado ? 'cadeado' : 'mais'}
            disabled={c.bloqueado || !c.ativo}
            title={c.bloqueado ? 'Cliente bloqueado por inadimplência' : undefined}
            onClick={() => setJanela('solicitacao')}
          >
            Nova solicitação
          </Botao>
          {ehAdmin ? (
            <>
              <Botao icone="editar" onClick={() => setJanela('editar')}>
                Editar
              </Botao>
              <Botao variante={c.ativo ? 'perigo' : ''} onClick={() => setJanela('ativo')}>
                {c.ativo ? 'Inativar' : 'Reativar'}
              </Botao>
            </>
          ) : null}
        </>
      }
    >
      <div className="dados-cliente" style={{ marginTop: -12 }}>
        <span className="num">{documento(c.documento)}</span>
        <span>{c.email}</span>
        {c.telefone ? <span className="num">{c.telefone}</span> : null}
        {c.responsavel ? <span>Contato: {c.responsavel}</span> : null}
      </div>

      <Painel>
        <div className="ficha-status">
          <Poste acesos={c.ativo ? [c.status] : []} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{situacao.titulo}</h2>
            <p>{situacao.texto}</p>
          </div>
          {ehAdmin && c.ativo && c.status === 'Vermelho' && !liberacaoVigente ? (
            <Botao icone="cadeadoAberto" onClick={() => setJanela('liberacao')}>
              Conceder liberação temporária
            </Botao>
          ) : null}
        </div>
        <div className="resumo-valores">
          <div>
            <span>Principal vencido</span>
            <strong className="num">{moeda(c.valorVencido)}</strong>
          </div>
          <div>
            <span>Multa</span>
            <strong className="num">{moeda(c.valorMulta)}</strong>
          </div>
          <div>
            <span>Juros</span>
            <strong className="num">{moeda(c.valorJuros)}</strong>
          </div>
          <div>
            <span>Total atualizado</span>
            <strong className="num">{moeda(c.valorAtualizado)}</strong>
          </div>
          <div>
            <span>A vencer</span>
            <strong className="num">{moeda(c.valorAVencer)}</strong>
          </div>
        </div>
      </Painel>

      {liberacaoVigente ? (
        <Nota
          tipo="alerta"
          icone="cadeadoAberto"
          acao={
            ehAdmin ? (
              <Botao pequeno onClick={() => setJanela('revogar')}>
                Revogar
              </Botao>
            ) : null
          }
        >
          <strong>Liberação temporária até {data(liberacaoVigente.dataFim)}.</strong> Concedida por {liberacaoVigente.concedidaPor} em{' '}
          {dataHora(liberacaoVigente.dataInicio)}. Motivo: {liberacaoVigente.motivo}
        </Nota>
      ) : null}

      {c.observacoes ? <Nota>{c.observacoes}</Nota> : null}

      <Painel titulo="Cobranças" descricao="Honorários mensais gerados pelos contratos">
        <TabelaCobrancas
          cobrancas={c.cobrancas}
          mostrarCliente={false}
          aoMudar={consulta.recarregar}
          vazio={<Vazio titulo="Nenhuma cobrança">As cobranças aparecem quando o cliente tem um contrato ativo.</Vazio>}
        />
      </Painel>

      <Painel
        titulo="Contratos"
        acoes={
          ehAdmin && c.ativo ? (
            <Botao pequeno icone="mais" onClick={() => setJanela('contrato')}>
              Novo contrato
            </Botao>
          ) : null
        }
      >
        <Tabela
          legenda="Contratos do cliente"
          linhas={c.contratos}
          vazio={<Vazio titulo="Nenhum contrato">Cadastre um contrato para começar a gerar as cobranças mensais.</Vazio>}
          colunas={[
            { id: 'numero', titulo: 'Contrato', celula: (ct) => <span className="num forte">{ct.numero}</span> },
            { id: 'descricao', titulo: 'Serviço', celula: (ct) => ct.descricao },
            { id: 'valor', titulo: 'Honorário mensal', direita: true, celula: (ct) => moeda(ct.valorMensal) },
            { id: 'dia', titulo: 'Vencimento', celula: (ct) => `Todo dia ${ct.diaVencimento}` },
            { id: 'inicio', titulo: 'Início', celula: (ct) => <span className="num">{data(ct.dataInicio)}</span> },
            {
              id: 'situacao',
              titulo: 'Situação',
              celula: (ct) => (ct.ativo ? <Etiqueta cor="verde">Ativo</Etiqueta> : <Etiqueta>Encerrado em {data(ct.dataFim)}</Etiqueta>),
            },
          ]}
        />
      </Painel>

      <div className="grade-painel">
        <Painel className="col-6" titulo="Avisos enviados ao cliente">
          {c.avisos.length === 0 ? (
            <Vazio titulo="Nenhum aviso">Lembretes e avisos de atraso deste cliente aparecem aqui.</Vazio>
          ) : (
            <ul className="lista-simples">
              {c.avisos.map((a) => (
                <li key={a.id}>
                  <span className="celula-dupla">
                    <span>{a.assunto}</span>
                    <small>{dataHora(a.criadoEm)}</small>
                  </span>
                  <Etiqueta cor={COR_TIPO_AVISO[a.tipo]}>{ROTULO_TIPO_AVISO[a.tipo]}</Etiqueta>
                </li>
              ))}
            </ul>
          )}
        </Painel>

        <Painel className="col-6" titulo="Solicitações">
          {c.solicitacoes.length === 0 ? (
            <Vazio titulo="Nenhuma solicitação">As demandas abertas para este cliente aparecem aqui.</Vazio>
          ) : (
            <ul className="lista-simples">
              {c.solicitacoes.map((s) => (
                <li key={s.id}>
                  <span className="celula-dupla">
                    <span>{s.descricao}</span>
                    <small>
                      {ROTULO_TIPO_SOLICITACAO[s.tipo]}, aberta por {s.criadoPor} em {dataHora(s.criadoEm)}
                    </small>
                  </span>
                  <Etiqueta cor={s.status === 'Concluida' ? 'verde' : 'azul'}>{s.status === 'Concluida' ? 'Concluída' : 'Aberta'}</Etiqueta>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      {janela === 'editar' ? <FormCliente cliente={c} aoFechar={() => setJanela(null)} aoSalvar={concluir('Cliente atualizado.')} /> : null}
      {janela === 'contrato' ? <FormContrato clienteFixo={c} hoje={hoje} aoFechar={() => setJanela(null)} aoSalvar={concluir('Contrato criado.')} /> : null}
      {janela === 'liberacao' ? <FormLiberacao cliente={c} hoje={hoje} aoFechar={() => setJanela(null)} aoSalvar={concluir('Liberação temporária concedida.')} /> : null}
      {janela === 'solicitacao' ? <FormSolicitacao clienteFixo={c} aoFechar={() => setJanela(null)} aoSalvar={concluir('Solicitação registrada.')} /> : null}
      {janela === 'revogar' ? (
        <Confirmacao
          titulo="Revogar liberação temporária"
          rotulo="Revogar liberação"
          perigo
          acao={() => api.clientes.revogarLiberacao(liberacaoVigente.id)}
          aoFechar={() => setJanela(null)}
          aoConcluir={concluir('Liberação revogada.')}
        >
          {c.nome} volta a ficar bloqueado para novas solicitações enquanto houver débito acima do prazo.
        </Confirmacao>
      ) : null}
      {janela === 'ativo' ? (
        <Confirmacao
          titulo={c.ativo ? 'Inativar cliente' : 'Reativar cliente'}
          rotulo={c.ativo ? 'Inativar cliente' : 'Reativar cliente'}
          perigo={c.ativo}
          acao={() => api.clientes.alterarAtivo(c.id, !c.ativo)}
          aoFechar={() => setJanela(null)}
          aoConcluir={concluir(c.ativo ? 'Cliente inativado.' : 'Cliente reativado.')}
        >
          {c.ativo
            ? `${c.nome} deixa de receber novas cobranças e novas solicitações. O histórico e as cobranças em aberto são mantidos.`
            : `${c.nome} volta a receber cobranças dos contratos ativos e a aparecer no semáforo.`}
        </Confirmacao>
      ) : null}
    </Pagina>
  );
}
