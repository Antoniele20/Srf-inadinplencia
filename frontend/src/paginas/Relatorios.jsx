import { api } from '../api/index.js';
import { Botao, EstadoDeCarga, Pagina, Painel, Tabela, Vazio } from '../componentes/base.jsx';
import { textoDaSituacao } from '../componentes/Semaforo.jsx';
import { useMensagens } from '../contextos/Mensagens.jsx';
import { competencia, data, documento, moeda, numero } from '../lib/formatos.js';
import { estaEmbutido, useDados } from '../lib/hooks.js';

function celulaCsv(valor) {
  const texto = String(valor ?? '');
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function decimal(valor) {
  return Number(valor).toFixed(2).replace('.', ',');
}

/** CSV com ponto e vírgula e decimais com vírgula, do jeito que o Excel em português abre. */
function montarCsv(clientes) {
  const cabecalho = ['Cliente', 'Documento', 'Situação', 'Cobranças vencidas', 'Dias de atraso', 'Faixa', 'Principal', 'Multa', 'Juros', 'Total atualizado'];
  const linhas = clientes.map((c) => [
    c.nome,
    documento(c.documento),
    textoDaSituacao(c),
    c.parcelasVencidas,
    c.diasAtraso,
    c.faixaAtraso,
    decimal(c.valorVencido),
    decimal(c.valorMulta),
    decimal(c.valorJuros),
    decimal(c.valorAtualizado),
  ]);
  return [cabecalho, ...linhas].map((linha) => linha.map(celulaCsv).join(';')).join('\r\n');
}

export default function Relatorios() {
  const { avisar, avisarErro } = useMensagens();
  const painel = useDados(() => api.painel.obter(), []);
  const inadimplentes = useDados(() => api.inadimplencia.listar(), []);
  const embutido = estaEmbutido();

  if (!painel.dados || !inadimplentes.dados) {
    return (
      <Pagina titulo="Relatórios">
        <EstadoDeCarga consulta={painel.dados ? inadimplentes : painel} />
      </Pagina>
    );
  }

  const { faixas, mensal, totais, dataReferencia } = painel.dados;
  const clientes = inadimplentes.dados;
  const totalFaixas = faixas.reduce((soma, f) => soma + f.valor, 0);
  const totalClientes = faixas.reduce((soma, f) => soma + f.clientes, 0);

  async function copiarCsv() {
    try {
      await navigator.clipboard.writeText(montarCsv(clientes));
      avisar('Relatório copiado. Cole em uma planilha.');
    } catch {
      avisarErro(new Error('O navegador não permitiu copiar. Use Baixar CSV fora da visualização embutida.'));
    }
  }

  function baixarCsv() {
    const arquivo = new Blob([`﻿${montarCsv(clientes)}`], { type: 'text/csv;charset=utf-8' });
    const endereco = URL.createObjectURL(arquivo);
    const link = document.createElement('a');
    link.href = endereco;
    link.download = `inadimplencia-${dataReferencia}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(endereco);
  }

  return (
    <Pagina
      titulo="Relatórios"
      descricao={`Posição de inadimplência em ${data(dataReferencia)}.`}
      acoes={
        <>
          <Botao icone="copiar" onClick={copiarCsv} disabled={clientes.length === 0}>
            Copiar CSV
          </Botao>
          {embutido ? null : (
            <>
              <Botao icone="baixar" onClick={baixarCsv} disabled={clientes.length === 0}>
                Baixar CSV
              </Botao>
              <Botao icone="imprimir" onClick={() => window.print()}>
                Imprimir
              </Botao>
            </>
          )}
        </>
      }
    >
      <div className="grade-painel">
        <Painel className="col-6" titulo="Carteira por faixa de atraso" descricao="Clientes ativos">
          <Tabela
            legenda="Clientes e valores por faixa de atraso"
            linhas={faixas.map((f) => ({ ...f, id: f.faixa }))}
            colunas={[
              { id: 'faixa', titulo: 'Faixa', celula: (f) => f.faixa },
              { id: 'clientes', titulo: 'Clientes', direita: true, celula: (f) => f.clientes },
              { id: 'valor', titulo: 'Vencido atualizado', direita: true, celula: (f) => moeda(f.valor) },
              {
                id: 'parte',
                titulo: 'Parte do total',
                direita: true,
                celula: (f) => (totalFaixas > 0 ? `${numero(Math.round((f.valor / totalFaixas) * 1000) / 10)}%` : '0%'),
              },
            ]}
            rodape={
              <tr>
                <td>Total</td>
                <td className="direita">{totalClientes}</td>
                <td className="direita">{moeda(totalFaixas)}</td>
                <td className="direita">100%</td>
              </tr>
            }
          />
        </Painel>

        <Painel className="col-6" titulo="Honorários por mês de vencimento" descricao="Últimos seis meses">
          <Tabela
            legenda="Previsto, recebido e em aberto por mês"
            linhas={mensal.map((m) => ({ ...m, id: m.mes }))}
            colunas={[
              { id: 'mes', titulo: 'Mês', celula: (m) => competencia(`${m.mes}-01`) },
              { id: 'previsto', titulo: 'Previsto', direita: true, celula: (m) => moeda(m.previsto) },
              { id: 'recebido', titulo: 'Recebido', direita: true, celula: (m) => moeda(m.recebido) },
              { id: 'aberto', titulo: 'Em aberto', direita: true, celula: (m) => moeda(m.emAberto) },
              {
                id: 'taxa',
                titulo: 'Recebido do previsto',
                direita: true,
                celula: (m) => (m.previsto > 0 ? `${numero(Math.round((m.recebido / m.previsto) * 1000) / 10)}%` : '0%'),
              },
            ]}
          />
        </Painel>

        <Painel className="col-12" titulo="Clientes em atraso" descricao={`Principal de ${moeda(totais.valorVencido)} e encargos de ${moeda(totais.valorEncargos)}`}>
          <Tabela
            legenda="Clientes em atraso, com composição do valor"
            linhas={clientes}
            vazio={<Vazio titulo="Nenhum cliente em atraso">Não há valores vencidos na data deste relatório.</Vazio>}
            colunas={[
              { id: 'cliente', titulo: 'Cliente', celula: (c) => c.nome },
              { id: 'documento', titulo: 'Documento', celula: (c) => <span className="num">{documento(c.documento)}</span> },
              { id: 'situacao', titulo: 'Situação', celula: (c) => textoDaSituacao(c) },
              { id: 'dias', titulo: 'Dias de atraso', direita: true, celula: (c) => c.diasAtraso },
              { id: 'faixa', titulo: 'Faixa', celula: (c) => c.faixaAtraso },
              { id: 'principal', titulo: 'Principal', direita: true, celula: (c) => moeda(c.valorVencido) },
              { id: 'multa', titulo: 'Multa', direita: true, celula: (c) => moeda(c.valorMulta) },
              { id: 'juros', titulo: 'Juros', direita: true, celula: (c) => moeda(c.valorJuros) },
              { id: 'total', titulo: 'Total atualizado', direita: true, celula: (c) => <span className="forte">{moeda(c.valorAtualizado)}</span> },
            ]}
            rodape={
              <tr>
                <td colSpan={5}>Total</td>
                <td className="direita">{moeda(totais.valorVencido)}</td>
                <td className="direita">{moeda(clientes.reduce((s, c) => s + c.valorMulta, 0))}</td>
                <td className="direita">{moeda(clientes.reduce((s, c) => s + c.valorJuros, 0))}</td>
                <td className="direita">{moeda(totais.valorAtualizado)}</td>
              </tr>
            }
          />
        </Painel>
      </div>
    </Pagina>
  );
}
