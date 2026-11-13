import { useEffect, useState } from 'react';
import { MODO_DEMO, api } from '../api/index.js';
import { Botao, Campo, EstadoDeCarga, Nota, Pagina, Painel } from '../componentes/base.jsx';
import { avisarMudanca } from '../componentes/Estrutura.jsx';
import { Semaforo } from '../componentes/Semaforo.jsx';
import { useMensagens } from '../contextos/Mensagens.jsx';
import { useSessao } from '../contextos/Sessao.jsx';
import { dataHora, lerNumero, moeda, plural } from '../lib/formatos.js';
import { useDados } from '../lib/hooks.js';
import { calcularEncargos, classificarStatus } from '../regras/calculos.js';

function paraTexto(valor) {
  return String(valor).replace('.', ',');
}

export default function Configuracoes() {
  const { ehAdmin } = useSessao();
  const { avisar, avisarErro } = useMensagens();
  const consulta = useDados(() => api.configuracoes.obter(), []);
  const [v, setV] = useState(null);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [simulacao, setSimulacao] = useState({ valor: '5.000,00', dias: '45' });

  useEffect(() => {
    if (consulta.dados) {
      setV({
        multaPercentual: paraTexto(consulta.dados.multaPercentual),
        jurosDiarioPercentual: paraTexto(consulta.dados.jurosDiarioPercentual),
        diasParaBloqueio: String(consulta.dados.diasParaBloqueio),
        diasAvisoPreVencimento: String(consulta.dados.diasAvisoPreVencimento),
      });
    }
  }, [consulta.dados]);

  if (!v) {
    return (
      <Pagina titulo="Configurações">
        <EstadoDeCarga consulta={consulta} />
      </Pagina>
    );
  }

  const mudar = (campo) => (evento) => setV((atual) => ({ ...atual, [campo]: evento.target.value }));

  const regras = {
    multaPercentual: lerNumero(v.multaPercentual) || 0,
    jurosDiarioPercentual: lerNumero(v.jurosDiarioPercentual) || 0,
    diasParaBloqueio: Number(v.diasParaBloqueio) || 0,
    diasAvisoPreVencimento: Number(v.diasAvisoPreVencimento) || 0,
  };

  async function salvar(evento) {
    evento.preventDefault();
    setSalvando(true);
    setErros({});
    try {
      await api.configuracoes.salvar(regras);
      avisar('Regras salvas. O semáforo de todos os clientes foi recalculado.');
      avisarMudanca();
      consulta.recarregar();
    } catch (erro) {
      setErros(erro.erros || {});
      avisarErro(erro);
    } finally {
      setSalvando(false);
    }
  }

  // Simulador: mostra o efeito das regras digitadas, mesmo antes de salvar.
  const valorSimulado = lerNumero(simulacao.valor) || 0;
  const diasSimulados = Math.max(0, Math.round(Number(simulacao.dias) || 0));
  const encargos = calcularEncargos(valorSimulado, '2026-01-01', new Date(Date.UTC(2026, 0, 1 + diasSimulados)).toISOString().slice(0, 10), regras);
  const statusSimulado = classificarStatus(diasSimulados, regras.diasParaBloqueio);

  return (
    <Pagina
      titulo="Configurações"
      descricao="Regras usadas no cálculo de encargos, no semáforo e na régua de avisos. Valem para todos os clientes."
    >
      {ehAdmin ? null : <Nota icone="cadeado">Você pode consultar as regras. Só o perfil Financeiro/Admin pode alterá-las.</Nota>}

      <div className="grade-painel">
        <Painel
          className="col-7"
          titulo="Encargos e bloqueio"
          descricao={consulta.dados.atualizadoPor ? `Última alteração em ${dataHora(consulta.dados.atualizadoEm)}, por ${consulta.dados.atualizadoPor}` : null}
        >
          <form className="painel-corpo pilha" onSubmit={salvar} noValidate>
            <div className="grade-form">
              <Campo rotulo="Multa por atraso (%)" erro={erros.multaPercentual} dica="Cobrada uma vez, a partir do 1º dia de atraso.">
                {(p) => <input {...p} className="entrada" inputMode="decimal" value={v.multaPercentual} onChange={mudar('multaPercentual')} disabled={!ehAdmin} />}
              </Campo>
              <Campo rotulo="Juros de mora ao dia (%)" erro={erros.jurosDiarioPercentual} dica="Juros simples sobre o principal. 0,033% ao dia equivale a 1% ao mês.">
                {(p) => <input {...p} className="entrada" inputMode="decimal" value={v.jurosDiarioPercentual} onChange={mudar('jurosDiarioPercentual')} disabled={!ehAdmin} />}
              </Campo>
              <Campo rotulo="Prazo para bloqueio (dias de atraso)" erro={erros.diasParaBloqueio} dica="Até este prazo o cliente fica amarelo. Acima dele, vermelho e bloqueado.">
                {(p) => <input {...p} className="entrada" type="number" min="1" max="180" value={v.diasParaBloqueio} onChange={mudar('diasParaBloqueio')} disabled={!ehAdmin} />}
              </Campo>
              <Campo rotulo="Lembrete antes do vencimento (dias)" erro={erros.diasAvisoPreVencimento} dica="Antecedência do lembrete de vencimento. Use 0 para lembrar só no dia.">
                {(p) => <input {...p} className="entrada" type="number" min="0" max="15" value={v.diasAvisoPreVencimento} onChange={mudar('diasAvisoPreVencimento')} disabled={!ehAdmin} />}
              </Campo>
            </div>
            {ehAdmin ? (
              <div>
                <Botao type="submit" variante="primario" disabled={salvando}>
                  {salvando ? 'Salvando…' : 'Salvar regras'}
                </Botao>
              </div>
            ) : null}
          </form>
        </Painel>

        <Painel className="col-5" titulo="Simulador" descricao="Com as regras ao lado, mesmo antes de salvar">
          <div className="painel-corpo pilha">
            <div className="grade-form">
              <Campo rotulo="Valor da cobrança (R$)">
                {(p) => <input {...p} className="entrada" inputMode="decimal" value={simulacao.valor} onChange={(e) => setSimulacao((s) => ({ ...s, valor: e.target.value }))} />}
              </Campo>
              <Campo rotulo="Dias de atraso">
                {(p) => <input {...p} className="entrada" type="number" min="0" value={simulacao.dias} onChange={(e) => setSimulacao((s) => ({ ...s, dias: e.target.value }))} />}
              </Campo>
            </div>
            <dl className="lista-def">
              <dt>Multa</dt>
              <dd>{moeda(encargos.multa)}</dd>
              <dt>Juros de {plural(diasSimulados, 'dia', 'dias')}</dt>
              <dd>{moeda(encargos.juros)}</dd>
              <div className="separador" />
              <dt className="forte">Valor atualizado</dt>
              <dd className="forte">{moeda(encargos.valorAtualizado)}</dd>
              <dt>Semáforo do cliente</dt>
              <dd>
                <span className="selo">
                  <Semaforo status={statusSimulado} /> {statusSimulado}
                </span>
              </dd>
            </dl>
          </div>
        </Painel>

        {MODO_DEMO && api.demo ? <FerramentasDemo aoMudar={consulta.recarregar} /> : null}
      </div>
    </Pagina>
  );
}

function FerramentasDemo({ aoMudar }) {
  const { avisar, avisarErro } = useMensagens();
  const [ocupado, setOcupado] = useState(false);

  async function executar(acao, mensagem) {
    setOcupado(true);
    try {
      const resultado = await acao();
      avisar(mensagem(resultado));
      avisarMudanca();
      aoMudar();
    } catch (erro) {
      avisarErro(erro);
    } finally {
      setOcupado(false);
    }
  }

  const avancar = (dias) => () =>
    executar(
      () => api.demo.avancarDias(dias),
      (r) =>
        `Data avançada em ${plural(dias, 'dia', 'dias')}. A rotina gerou ${plural(r.parcelasGeradas, 'cobrança', 'cobranças')}, mudou ${plural(
          r.clientesComStatusAlterado,
          'semáforo',
          'semáforos',
        )} e emitiu ${plural(r.avisosGerados, 'aviso', 'avisos')}.`,
    );

  return (
    <Painel className="col-12" titulo="Ferramentas da demonstração" descricao="Disponíveis só no modo demonstração">
      <div className="painel-corpo pilha">
        <p className="secundario" style={{ maxWidth: '75ch' }}>
          Avance a data para ver o sistema agir sozinho: clientes no amarelo passam para o vermelho quando ultrapassam o prazo, o bloqueio entra em vigor e
          os avisos são emitidos. Depois, abra o Painel ou a tela Clientes para conferir.
        </p>
        <div className="linha-flex">
          <Botao icone="relogio" onClick={avancar(1)} disabled={ocupado}>
            Avançar 1 dia
          </Botao>
          <Botao icone="relogio" onClick={avancar(7)} disabled={ocupado}>
            Avançar 7 dias
          </Botao>
          <Botao icone="relogio" onClick={avancar(30)} disabled={ocupado}>
            Avançar 30 dias
          </Botao>
          <Botao variante="perigo" icone="atualizar" onClick={() => executar(() => api.demo.restaurar(), () => 'Dados de demonstração restaurados para o estado inicial.')} disabled={ocupado}>
            Restaurar dados iniciais
          </Botao>
        </div>
      </div>
    </Painel>
  );
}
