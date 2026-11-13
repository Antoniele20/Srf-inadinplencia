// Gráficos do painel, desenhados com HTML e CSS (sem biblioteca externa).
import { useState } from 'react';
import { competencia, mesCurto, moeda, moedaCompacta, plural } from '../lib/formatos.js';
import { Botao } from './base.jsx';

/** Escolhe um topo "redondo" para o eixo e de 3 a 5 marcações. */
export function escalaDoEixo(maximo) {
  if (!(maximo > 0)) return { topo: 1, marcas: [0, 1] };
  const bruto = maximo / 4;
  const magnitude = 10 ** Math.floor(Math.log10(bruto));
  const normalizado = bruto / magnitude;
  const passo = (normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 2.5 ? 2.5 : normalizado <= 5 ? 5 : 10) * magnitude;
  const topo = Math.ceil(maximo / passo) * passo;
  const marcas = [];
  for (let valor = 0; valor <= topo + passo / 2; valor += passo) marcas.push(Math.round(valor * 100) / 100);
  return { topo, marcas };
}

/**
 * Honorários por mês de vencimento: colunas empilhadas (recebido + em aberto).
 * Passar o mouse ou focar uma coluna mostra os valores daquele mês na legenda.
 */
export function GraficoMensal({ dados }) {
  const [ativo, setAtivo] = useState(null);
  const [emTabela, setEmTabela] = useState(false);

  const { topo, marcas } = escalaDoEixo(Math.max(...dados.map((d) => d.previsto), 0));
  const total = dados.reduce((soma, d) => ({ recebido: soma.recebido + d.recebido, emAberto: soma.emAberto + d.emAberto }), { recebido: 0, emAberto: 0 });
  const foco = ativo !== null ? dados[ativo] : null;
  const leitura = foco || total;

  return (
    <div className="painel-corpo pilha">
      <div className="linha-flex entre">
        <div className="legenda" aria-live="polite">
          <span>
            <i style={{ background: 'var(--serie-recebido)' }} /> Recebido <strong className="num">{moeda(leitura.recebido)}</strong>
          </span>
          <span>
            <i style={{ background: 'var(--serie-aberto)' }} /> Em aberto <strong className="num">{moeda(leitura.emAberto)}</strong>
          </span>
          <span className="suave">{foco ? competencia(`${foco.mes}-01`) : 'soma dos seis meses'}</span>
        </div>
        <Botao pequeno variante="fantasma" onClick={() => setEmTabela((valor) => !valor)}>
          {emTabela ? 'Ver gráfico' : 'Ver tabela'}
        </Botao>
      </div>

      {emTabela ? (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Mês de vencimento</th>
                <th scope="col" className="direita">Recebido</th>
                <th scope="col" className="direita">Em aberto</th>
                <th scope="col" className="direita">Previsto</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((d) => (
                <tr key={d.mes}>
                  <td>{competencia(`${d.mes}-01`)}</td>
                  <td className="direita">{moeda(d.recebido)}</td>
                  <td className="direita">{moeda(d.emAberto)}</td>
                  <td className="direita">{moeda(d.previsto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grafico" role="group" aria-label="Honorários recebidos e em aberto por mês de vencimento">
          <div className="grafico-eixo" aria-hidden="true">
            {marcas.map((marca) => (
              <span key={marca} style={{ bottom: `${(marca / topo) * 100}%` }}>
                {moedaCompacta(marca)}
              </span>
            ))}
          </div>
          <div className="grafico-area">
            {marcas.map((marca) => (
              <div key={marca} className={`grafico-grade ${marca === 0 ? 'base' : ''}`} style={{ bottom: `${(marca / topo) * 100}%` }} />
            ))}
            <div className="grafico-colunas" onMouseLeave={() => setAtivo(null)}>
              {dados.map((d, indice) => (
                <button
                  key={d.mes}
                  type="button"
                  className="grafico-coluna"
                  onMouseEnter={() => setAtivo(indice)}
                  onFocus={() => setAtivo(indice)}
                  onBlur={() => setAtivo(null)}
                  aria-label={`${competencia(`${d.mes}-01`)}: recebido ${moeda(d.recebido)}, em aberto ${moeda(d.emAberto)}`}
                >
                  {d.recebido > 0 ? (
                    <span
                      className={`grafico-segmento ${d.emAberto > 0 ? '' : 'topo'}`}
                      style={{ height: `${(d.recebido / topo) * 100}%`, background: 'var(--serie-recebido)' }}
                    />
                  ) : null}
                  {d.emAberto > 0 ? (
                    <span className="grafico-segmento topo" style={{ height: `${(d.emAberto / topo) * 100}%`, background: 'var(--serie-aberto)' }} />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <div className="grafico-meses" aria-hidden="true">
            {dados.map((d) => (
              <span key={d.mes}>{mesCurto(d.mes)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Um único tom, do mais claro ao mais escuro: quanto mais antigo o atraso, mais escura a barra.
const CORES_FAIXA = ['transparent', '#8aa9dc', '#4a78c2', '#1c3764'];

/** Valor vencido (com encargos) e quantidade de clientes por faixa de atraso. */
export function FaixasDeAtraso({ faixas }) {
  const maximo = Math.max(...faixas.map((f) => f.valor), 0);
  return (
    <div className="painel-corpo faixas">
      {faixas.map((faixa, indice) => (
        <div key={faixa.faixa} className="faixa-linha">
          <span className="faixa-nome">
            {faixa.faixa}
            <span className="suave" style={{ fontWeight: 400 }}>
              {plural(faixa.clientes, 'cliente', 'clientes')}
            </span>
          </span>
          <span className="faixa-valor">{indice === 0 ? <span className="suave">sem pendências</span> : moeda(faixa.valor)}</span>
          {indice > 0 ? (
            <div className="faixa-trilho">
              <div className="faixa-barra" style={{ width: maximo > 0 ? `${(faixa.valor / maximo) * 100}%` : 0, background: CORES_FAIXA[indice] }} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
