import { api } from '../api/index.js';
import { EstadoDeCarga, Etiqueta, Pagina, Painel as Cartao, Tabela, Vazio } from '../componentes/base.jsx';
import { FaixasDeAtraso, GraficoMensal } from '../componentes/Graficos.jsx';
import { SeloStatus, textoDoAtraso } from '../componentes/Semaforo.jsx';
import { competencia, data, dataCurta, dataHora, moeda, plural } from '../lib/formatos.js';
import { navegar, useDados } from '../lib/hooks.js';
import { COR_TIPO_AVISO } from '../lib/rotulos.js';
import { ROTULO_TIPO_AVISO } from '../regras/avisos.js';

function LinhaDoSemaforo({ cor, aceso, quantidade, rotulo, nota, valor, href }) {
  return (
    <a className="torre-linha" href={href}>
      <span className="torre-caixa">
        <i className={`farol ${cor} ${aceso ? 'aceso' : ''}`} />
      </span>
      <span className="torre-info">
        <span className="torre-qtd">{quantidade}</span>
        <span className="torre-rotulo">{rotulo}</span>
        <span className="torre-nota">{nota}</span>
      </span>
      <span className="torre-valor">
        {valor > 0 ? (
          <>
            <strong>{moeda(valor)}</strong>
            <small>vencido, com encargos</small>
          </>
        ) : null}
      </span>
    </a>
  );
}

export default function Painel() {
  const painel = useDados(() => api.painel.obter(), []);

  if (!painel.dados) {
    return (
      <Pagina titulo="Painel">
        <EstadoDeCarga consulta={painel} />
      </Pagina>
    );
  }

  const { semaforo, totais, faixas, mensal, atencao, proximosVencimentos, avisosRecentes, dataReferencia } = painel.dados;

  const notaVermelho =
    semaforo.vermelho === 0
      ? 'Nenhum cliente acima do prazo de bloqueio.'
      : `${plural(semaforo.bloqueados, 'bloqueado', 'bloqueados')}${
          semaforo.liberadosTemporariamente > 0 ? ` e ${semaforo.liberadosTemporariamente} com liberação temporária` : ''
        }. Novas solicitações suspensas para os bloqueados.`;

  const notaAmarelo =
    semaforo.amarelo === 0
      ? 'Nenhum cliente em atraso dentro do prazo.'
      : `Avisos de atraso emitidos.${
          totais.proximoBloqueioEmDias ? ` O próximo bloqueio acontece em ${plural(totais.proximoBloqueioEmDias, 'dia', 'dias')}.` : ''
        }`;

  return (
    <Pagina titulo="Painel" descricao={`Posição da carteira em ${data(dataReferencia)}.`}>
      <div className="grade-painel">
        <Cartao className="col-7" titulo="Semáforo de inadimplência" descricao={`${plural(totais.clientesAtivos, 'cliente ativo', 'clientes ativos')}`}>
          <div className="torre">
            <LinhaDoSemaforo
              cor="vermelho"
              aceso={semaforo.vermelho > 0}
              quantidade={semaforo.vermelho}
              rotulo={semaforo.vermelho === 1 ? 'cliente no vermelho' : 'clientes no vermelho'}
              nota={notaVermelho}
              valor={totais.valorVencidoVermelho}
              href="#clientes-vermelho"
            />
            <LinhaDoSemaforo
              cor="amarelo"
              aceso={semaforo.amarelo > 0}
              quantidade={semaforo.amarelo}
              rotulo={semaforo.amarelo === 1 ? 'cliente no amarelo' : 'clientes no amarelo'}
              nota={notaAmarelo}
              valor={totais.valorVencidoAmarelo}
              href="#clientes-amarelo"
            />
            <LinhaDoSemaforo
              cor="verde"
              aceso={semaforo.verde > 0}
              quantidade={semaforo.verde}
              rotulo={semaforo.verde === 1 ? 'cliente no verde' : 'clientes no verde'}
              nota="Em dia. Atendimento normal."
              valor={0}
              href="#clientes-verde"
            />
          </div>
        </Cartao>

        <Cartao className="col-5" titulo="Posição financeira">
          <div className="painel-corpo pilha">
            <div>
              <div className="secundario">Total vencido, com multa e juros</div>
              <div className="destaque-valor">{moeda(totais.valorAtualizado)}</div>
            </div>
            <dl className="lista-def">
              <dt>Principal vencido</dt>
              <dd>{moeda(totais.valorVencido)}</dd>
              <dt>Multa e juros calculados</dt>
              <dd>{moeda(totais.valorEncargos)}</dd>
              <dt>Cobranças vencidas</dt>
              <dd>{totais.cobrancasVencidas}</dd>
              <div className="separador" />
              <dt>A vencer nos próximos 30 dias</dt>
              <dd>{moeda(totais.valorAVencer30)}</dd>
              <dt>Recebido em {competencia(dataReferencia)}</dt>
              <dd>{moeda(totais.recebidoNoMes)}</dd>
              <dt>Contratos ativos</dt>
              <dd>{totais.contratosAtivos}</dd>
            </dl>
          </div>
        </Cartao>

        <Cartao className="col-7" titulo="Honorários por mês de vencimento" descricao="Últimos seis meses">
          <GraficoMensal dados={mensal} />
        </Cartao>

        <Cartao className="col-5" titulo="Atraso por faixa" descricao="Valor vencido, com multa e juros">
          <FaixasDeAtraso faixas={faixas} />
        </Cartao>

        <Cartao
          className="col-7"
          titulo="Clientes que pedem atenção"
          descricao="Maiores atrasos"
          acoes={
            <a className="botao pequeno" href="#inadimplencia">
              Ver inadimplência
            </a>
          }
        >
          <Tabela
            legenda="Clientes com os maiores atrasos"
            linhas={atencao}
            aoClicar={(cliente) => navegar(`cliente-${cliente.id}`)}
            vazio={<Vazio titulo="Nenhum cliente em atraso">Todos os honorários vencidos estão quitados.</Vazio>}
            colunas={[
              { id: 'status', titulo: 'Situação', celula: (c) => <SeloStatus cliente={c} /> },
              {
                id: 'cliente',
                titulo: 'Cliente',
                celula: (c) => (
                  <a className="link-linha" href={`#cliente-${c.id}`}>
                    {c.nome}
                  </a>
                ),
              },
              { id: 'atraso', titulo: 'Atraso', celula: (c) => textoDoAtraso(c) },
              { id: 'valor', titulo: 'Valor atualizado', direita: true, celula: (c) => moeda(c.valorAtualizado) },
            ]}
          />
        </Cartao>

        <div className="col-5 pilha">
          <Cartao titulo="Vencem nos próximos 7 dias">
            {proximosVencimentos.length === 0 ? (
              <Vazio titulo="Nada a vencer">Nenhuma cobrança vence nos próximos 7 dias.</Vazio>
            ) : (
              <ul className="lista-simples">
                {proximosVencimentos.map((c) => (
                  <li key={c.id}>
                    <span className="celula-dupla">
                      <a className="link-linha" href={`#cliente-${c.clienteId}`}>
                        {c.clienteNome}
                      </a>
                      <small>
                        {c.numero}, vence em {dataCurta(c.dataVencimento)}
                      </small>
                    </span>
                    <span className="num forte nowrap">{moeda(c.valorOriginal)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao
            titulo="Últimos avisos"
            acoes={
              <a className="botao pequeno" href="#avisos">
                Ver todos
              </a>
            }
          >
            {avisosRecentes.length === 0 ? (
              <Vazio titulo="Nenhum aviso emitido">Os avisos aparecem aqui quando a rotina diária é executada.</Vazio>
            ) : (
              <ul className="lista-simples">
                {avisosRecentes.map((a) => (
                  <li key={a.id}>
                    <span className="celula-dupla">
                      <span>{a.clienteNome}</span>
                      <small>{dataHora(a.criadoEm)}</small>
                    </span>
                    <Etiqueta cor={COR_TIPO_AVISO[a.tipo]}>{ROTULO_TIPO_AVISO[a.tipo]}</Etiqueta>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      </div>
    </Pagina>
  );
}
