// Formulários em janela (modal) usados por várias telas.
import { useState } from 'react';
import { api } from '../api/index.js';
import { hojeISO, somarDias } from '../lib/datas.js';
import { data, documento as mascararDocumento, lerNumero, moeda, plural } from '../lib/formatos.js';
import { useDados } from '../lib/hooks.js';
import { calcularEncargos } from '../regras/calculos.js';
import { Botao, Campo, Modal, Nota } from './base.jsx';
import { textoDaSituacao } from './Semaforo.jsx';

/** Controla o envio de um formulário: estado "enviando", erros por campo e erro geral. */
function useEnvio(acao, aoConcluir) {
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState(null);

  async function enviar() {
    setEnviando(true);
    setErros({});
    setErroGeral(null);
    try {
      const resultado = await acao();
      aoConcluir(resultado);
    } catch (erro) {
      setErros(erro.erros || {});
      setErroGeral(erro.message || 'Não foi possível salvar. Tente de novo.');
      setEnviando(false);
    }
  }

  return { enviando, erros, erroGeral, enviar };
}

function Rodape({ aoFechar, enviando, rotulo, perigo = false, desabilitado = false }) {
  return (
    <>
      <Botao onClick={aoFechar}>Cancelar</Botao>
      <Botao type="submit" variante={perigo ? 'perigo' : 'primario'} disabled={enviando || desabilitado}>
        {enviando ? 'Salvando…' : rotulo}
      </Botao>
    </>
  );
}

function ErroGeral({ envio }) {
  // Quando o erro é de campos, a mensagem geral só reforça; quando é de regra, é a explicação.
  return envio.erroGeral ? (
    <Nota tipo="perigo" icone="inadimplencia">
      {envio.erroGeral}
    </Nota>
  ) : null;
}

function usarCampos(inicial) {
  const [valores, setValores] = useState(inicial);
  const mudar = (campo) => (evento) => setValores((atual) => ({ ...atual, [campo]: evento.target.value }));
  return [valores, mudar, setValores];
}

// ---------------------------------------------------------------- Cliente

export function FormCliente({ cliente, aoFechar, aoSalvar }) {
  const [v, mudar] = usarCampos({
    nome: cliente?.nome || '',
    documento: cliente ? mascararDocumento(cliente.documento) : '',
    email: cliente?.email || '',
    telefone: cliente?.telefone || '',
    responsavel: cliente?.responsavel || '',
    observacoes: cliente?.observacoes || '',
  });
  const envio = useEnvio(() => (cliente ? api.clientes.atualizar(cliente.id, v) : api.clientes.criar(v)), aoSalvar);

  return (
    <Modal
      titulo={cliente ? 'Editar cliente' : 'Novo cliente'}
      aoFechar={aoFechar}
      aoEnviar={envio.enviar}
      largo
      rodape={<Rodape aoFechar={aoFechar} enviando={envio.enviando} rotulo={cliente ? 'Salvar alterações' : 'Cadastrar cliente'} />}
    >
      <ErroGeral envio={envio} />
      <div className="grade-form">
        <Campo rotulo="Nome ou razão social" erro={envio.erros.nome} className="inteira">
          {(p) => <input {...p} className="entrada" value={v.nome} onChange={mudar('nome')} autoFocus />}
        </Campo>
        <Campo rotulo="CPF ou CNPJ" erro={envio.erros.documento}>
          {(p) => <input {...p} className="entrada" value={v.documento} onChange={mudar('documento')} inputMode="numeric" />}
        </Campo>
        <Campo rotulo="E-mail para avisos" erro={envio.erros.email}>
          {(p) => <input {...p} className="entrada" type="email" value={v.email} onChange={mudar('email')} />}
        </Campo>
        <Campo rotulo="Telefone" erro={envio.erros.telefone}>
          {(p) => <input {...p} className="entrada" value={v.telefone} onChange={mudar('telefone')} />}
        </Campo>
        <Campo rotulo="Pessoa de contato" erro={envio.erros.responsavel}>
          {(p) => <input {...p} className="entrada" value={v.responsavel} onChange={mudar('responsavel')} />}
        </Campo>
        <Campo rotulo="Observações" erro={envio.erros.observacoes} className="inteira">
          {(p) => <textarea {...p} className="entrada" value={v.observacoes} onChange={mudar('observacoes')} />}
        </Campo>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Contrato

export function FormContrato({ contrato, clienteFixo, hoje, aoFechar, aoSalvar }) {
  const clientes = useDados(() => (contrato || clienteFixo ? Promise.resolve([]) : api.clientes.listar()), []);
  const [v, mudar] = usarCampos({
    clienteId: contrato?.clienteId || clienteFixo?.id || '',
    descricao: contrato?.descricao || '',
    valorMensal: contrato ? String(contrato.valorMensal).replace('.', ',') : '',
    diaVencimento: contrato?.diaVencimento || 10,
    dataInicio: contrato?.dataInicio || hoje || hojeISO(),
  });
  const dados = () => ({ ...v, clienteId: Number(v.clienteId), valorMensal: lerNumero(v.valorMensal), diaVencimento: Number(v.diaVencimento) });
  const envio = useEnvio(() => (contrato ? api.contratos.atualizar(contrato.id, dados()) : api.contratos.criar(dados())), aoSalvar);

  return (
    <Modal
      titulo={contrato ? `Editar contrato ${contrato.numero}` : 'Novo contrato'}
      aoFechar={aoFechar}
      aoEnviar={envio.enviar}
      rodape={<Rodape aoFechar={aoFechar} enviando={envio.enviando} rotulo={contrato ? 'Salvar alterações' : 'Criar contrato'} />}
    >
      <ErroGeral envio={envio} />
      <div className="grade-form">
        {contrato || clienteFixo ? (
          <Campo rotulo="Cliente" className="inteira">
            {(p) => <input {...p} className="entrada" value={contrato?.clienteNome || clienteFixo.nome} disabled />}
          </Campo>
        ) : (
          <Campo rotulo="Cliente" erro={envio.erros.clienteId} className="inteira">
            {(p) => (
              <select {...p} className="entrada" value={v.clienteId} onChange={mudar('clienteId')}>
                <option value="">Escolha o cliente</option>
                {(clientes.dados || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        )}
        <Campo rotulo="Serviço contratado" erro={envio.erros.descricao} className="inteira">
          {(p) => <input {...p} className="entrada" value={v.descricao} onChange={mudar('descricao')} autoFocus />}
        </Campo>
        <Campo rotulo="Honorário mensal (R$)" erro={envio.erros.valorMensal}>
          {(p) => <input {...p} className="entrada" inputMode="decimal" placeholder="0,00" value={v.valorMensal} onChange={mudar('valorMensal')} />}
        </Campo>
        <Campo rotulo="Dia do vencimento" erro={envio.erros.diaVencimento} dica="De 1 a 28, todo mês.">
          {(p) => <input {...p} className="entrada" type="number" min="1" max="28" value={v.diaVencimento} onChange={mudar('diaVencimento')} />}
        </Campo>
        {contrato ? null : (
          <Campo rotulo="Início do contrato" erro={envio.erros.dataInicio} dica="A primeira cobrança vence no primeiro dia de vencimento a partir desta data." className="inteira">
            {(p) => <input {...p} className="entrada" type="date" value={v.dataInicio} onChange={mudar('dataInicio')} />}
          </Campo>
        )}
      </div>
      {contrato ? <p className="suave">Mudanças de valor e de dia valem para as próximas cobranças. As já geradas não são alteradas.</p> : null}
    </Modal>
  );
}

// ---------------------------------------------------------------- Registrar pagamento (baixa)

export function FormBaixa({ cobranca, hoje, aoFechar, aoSalvar }) {
  const config = useDados(() => api.configuracoes.obter(), []);
  const [dataPagamento, setDataPagamento] = useState(hoje);
  const [valorDigitado, setValorDigitado] = useState(null);
  const [observacao, setObservacao] = useState('');

  const encargos = config.dados
    ? calcularEncargos(cobranca.valorOriginal, cobranca.dataVencimento, dataPagamento || hoje, config.dados)
    : { diasAtraso: cobranca.diasAtraso, multa: cobranca.multa, juros: cobranca.juros, valorAtualizado: cobranca.valorAtualizado };
  const sugerido = encargos.valorAtualizado.toFixed(2).replace('.', ',');
  const valorPago = valorDigitado === null ? sugerido : valorDigitado;

  const envio = useEnvio(() => api.cobrancas.baixar(cobranca.id, { dataPagamento, valorPago: lerNumero(valorPago), observacao }), aoSalvar);

  return (
    <Modal
      titulo={`Registrar pagamento da cobrança ${cobranca.numero}`}
      aoFechar={aoFechar}
      aoEnviar={envio.enviar}
      rodape={<Rodape aoFechar={aoFechar} enviando={envio.enviando} rotulo="Registrar pagamento" />}
    >
      <ErroGeral envio={envio} />
      <dl className="lista-def">
        <dt>Cliente</dt>
        <dd>{cobranca.clienteNome}</dd>
        <dt>Vencimento</dt>
        <dd>{data(cobranca.dataVencimento)}</dd>
        <dt>Valor original</dt>
        <dd>{moeda(cobranca.valorOriginal)}</dd>
        <dt>Multa e juros até a data do pagamento ({plural(encargos.diasAtraso, 'dia', 'dias')} de atraso)</dt>
        <dd>{moeda(encargos.multa + encargos.juros)}</dd>
        <div className="separador" />
        <dt className="forte">Valor atualizado</dt>
        <dd className="forte">{moeda(encargos.valorAtualizado)}</dd>
      </dl>
      <div className="grade-form">
        <Campo rotulo="Data do pagamento" erro={envio.erros.dataPagamento}>
          {(p) => <input {...p} className="entrada" type="date" max={hoje} value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />}
        </Campo>
        <Campo rotulo="Valor recebido (R$)" erro={envio.erros.valorPago}>
          {(p) => <input {...p} className="entrada" inputMode="decimal" value={valorPago} onChange={(e) => setValorDigitado(e.target.value)} />}
        </Campo>
        <Campo rotulo="Observação" className="inteira" dica="Opcional. Por exemplo: comprovante recebido por e-mail.">
          {(p) => <input {...p} className="entrada" value={observacao} onChange={(e) => setObservacao(e.target.value)} />}
        </Campo>
      </div>
      <p className="suave">O sistema não processa pagamentos: a baixa registra um recebimento já confirmado pela SRF. O semáforo do cliente é recalculado na hora.</p>
    </Modal>
  );
}

// ---------------------------------------------------------------- Editar e cancelar cobrança

export function FormEditarCobranca({ cobranca, aoFechar, aoSalvar }) {
  const [v, mudar] = usarCampos({
    valorOriginal: cobranca.valorOriginal.toFixed(2).replace('.', ','),
    dataVencimento: cobranca.dataVencimento,
    observacao: cobranca.observacao || '',
  });
  const envio = useEnvio(() => api.cobrancas.atualizar(cobranca.id, { ...v, valorOriginal: lerNumero(v.valorOriginal) }), aoSalvar);

  return (
    <Modal
      titulo={`Editar cobrança ${cobranca.numero}`}
      aoFechar={aoFechar}
      aoEnviar={envio.enviar}
      rodape={<Rodape aoFechar={aoFechar} enviando={envio.enviando} rotulo="Salvar alterações" />}
    >
      <ErroGeral envio={envio} />
      <div className="grade-form">
        <Campo rotulo="Valor original (R$)" erro={envio.erros.valorOriginal}>
          {(p) => <input {...p} className="entrada" inputMode="decimal" value={v.valorOriginal} onChange={mudar('valorOriginal')} autoFocus />}
        </Campo>
        <Campo rotulo="Vencimento" erro={envio.erros.dataVencimento}>
          {(p) => <input {...p} className="entrada" type="date" value={v.dataVencimento} onChange={mudar('dataVencimento')} />}
        </Campo>
        <Campo rotulo="Observação" className="inteira">
          {(p) => <input {...p} className="entrada" value={v.observacao} onChange={mudar('observacao')} />}
        </Campo>
      </div>
      <p className="suave">Alterar o vencimento muda os dias de atraso e pode mudar o semáforo do cliente.</p>
    </Modal>
  );
}

export function FormCancelarCobranca({ cobranca, aoFechar, aoSalvar }) {
  const [motivo, setMotivo] = useState('');
  const envio = useEnvio(() => api.cobrancas.cancelar(cobranca.id, { motivo }), aoSalvar);

  return (
    <Modal
      titulo={`Cancelar cobrança ${cobranca.numero}`}
      aoFechar={aoFechar}
      aoEnviar={envio.enviar}
      rodape={<Rodape aoFechar={aoFechar} enviando={envio.enviando} rotulo="Cancelar cobrança" perigo />}
    >
      <ErroGeral envio={envio} />
      <p>
        A cobrança de {moeda(cobranca.valorOriginal)} de {cobranca.clienteNome} deixa de ser devida e sai do cálculo de inadimplência. O registro continua no
        histórico.
      </p>
      <Campo rotulo="Motivo do cancelamento" erro={envio.erros.motivo}>
        {(p) => <textarea {...p} className="entrada" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />}
      </Campo>
    </Modal>
  );
}

// ---------------------------------------------------------------- Liberação temporária

export function FormLiberacao({ cliente, hoje, aoFechar, aoSalvar }) {
  const [v, mudar] = usarCampos({ dataFim: somarDias(hoje, 7), motivo: '' });
  const envio = useEnvio(() => api.clientes.concederLiberacao(cliente.id, v), aoSalvar);

  return (
    <Modal
      titulo="Conceder liberação temporária"
      aoFechar={aoFechar}
      aoEnviar={envio.enviar}
      rodape={<Rodape aoFechar={aoFechar} enviando={envio.enviando} rotulo="Conceder liberação" />}
    >
      <ErroGeral envio={envio} />
      <p>
        <strong>{cliente.nome}</strong> está bloqueado, com {plural(cliente.diasAtraso, 'dia', 'dias')} de atraso e {moeda(cliente.valorAtualizado)} em aberto.
        A liberação permite novas solicitações até a data escolhida. O status continua Vermelho e a dívida não muda.
      </p>
      <div className="grade-form">
        <Campo rotulo="Liberar até" erro={envio.erros.dataFim} dica="No máximo 60 dias.">
          {(p) => <input {...p} className="entrada" type="date" min={hoje} max={somarDias(hoje, 60)} value={v.dataFim} onChange={mudar('dataFim')} />}
        </Campo>
        <Campo rotulo="Motivo" erro={envio.erros.motivo} dica="Fica registrado com o seu nome." className="inteira">
          {(p) => <textarea {...p} className="entrada" value={v.motivo} onChange={mudar('motivo')} placeholder="Por exemplo: renegociação em andamento, parcelamento aguardando assinatura." autoFocus />}
        </Campo>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Nova solicitação

export function FormSolicitacao({ clienteFixo, aoFechar, aoSalvar }) {
  const clientes = useDados(() => (clienteFixo ? Promise.resolve([clienteFixo]) : api.clientes.listar()), []);
  const [v, mudar] = usarCampos({ clienteId: clienteFixo?.id || '', tipo: 'NovaSolicitacao', descricao: '' });
  const envio = useEnvio(() => api.solicitacoes.criar({ ...v, clienteId: Number(v.clienteId) }), aoSalvar);

  const escolhido = (clientes.dados || []).find((c) => c.id === Number(v.clienteId));
  const bloqueado = Boolean(escolhido && escolhido.bloqueado);

  return (
    <Modal
      titulo="Nova solicitação"
      aoFechar={aoFechar}
      aoEnviar={envio.enviar}
      rodape={<Rodape aoFechar={aoFechar} enviando={envio.enviando} rotulo="Registrar solicitação" desabilitado={bloqueado} />}
    >
      {bloqueado ? (
        <Nota tipo="perigo" icone="cadeado">
          <strong>{escolhido.nome} está bloqueado por inadimplência.</strong> São {plural(escolhido.diasAtraso, 'dia', 'dias')} de atraso e{' '}
          {moeda(escolhido.valorAtualizado)} em aberto. Novas solicitações e aberturas de processo ficam suspensas até a regularização ou até uma liberação
          temporária do Financeiro.
        </Nota>
      ) : (
        <ErroGeral envio={envio} />
      )}
      {escolhido && escolhido.liberacaoAte ? (
        <Nota tipo="alerta" icone="cadeadoAberto">
          Cliente com status Vermelho, atendido por liberação temporária até {data(escolhido.liberacaoAte)}.
        </Nota>
      ) : null}
      <div className="grade-form">
        <Campo rotulo="Cliente" erro={envio.erros.clienteId} className="inteira">
          {(p) => (
            <select {...p} className="entrada" value={v.clienteId} onChange={mudar('clienteId')} disabled={Boolean(clienteFixo)}>
              {clienteFixo ? null : <option value="">Escolha o cliente</option>}
              {(clientes.dados || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({textoDaSituacao(c).toLowerCase()})
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Tipo" erro={envio.erros.tipo} className="inteira">
          {(p) => (
            <select {...p} className="entrada" value={v.tipo} onChange={mudar('tipo')}>
              <option value="NovaSolicitacao">Nova solicitação</option>
              <option value="AberturaProcesso">Abertura de processo</option>
            </select>
          )}
        </Campo>
        <Campo rotulo="Descrição da demanda" erro={envio.erros.descricao} className="inteira">
          {(p) => <textarea {...p} className="entrada" value={v.descricao} onChange={mudar('descricao')} />}
        </Campo>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Usuário

export function FormUsuario({ usuario, aoFechar, aoSalvar }) {
  const [v, mudar, definir] = usarCampos({
    nome: usuario?.nome || '',
    email: usuario?.email || '',
    perfil: usuario?.perfil || 'Operacional',
    senha: '',
    ativo: usuario ? usuario.ativo : true,
  });
  const envio = useEnvio(() => (usuario ? api.usuarios.atualizar(usuario.id, v) : api.usuarios.criar(v)), aoSalvar);

  return (
    <Modal
      titulo={usuario ? 'Editar usuário' : 'Novo usuário'}
      aoFechar={aoFechar}
      aoEnviar={envio.enviar}
      rodape={<Rodape aoFechar={aoFechar} enviando={envio.enviando} rotulo={usuario ? 'Salvar alterações' : 'Criar usuário'} />}
    >
      <ErroGeral envio={envio} />
      <div className="grade-form">
        <Campo rotulo="Nome completo" erro={envio.erros.nome} className="inteira">
          {(p) => <input {...p} className="entrada" value={v.nome} onChange={mudar('nome')} autoFocus />}
        </Campo>
        <Campo rotulo="E-mail de acesso" erro={envio.erros.email}>
          {(p) => <input {...p} className="entrada" type="email" value={v.email} onChange={mudar('email')} autoComplete="off" />}
        </Campo>
        <Campo rotulo="Perfil" erro={envio.erros.perfil}>
          {(p) => (
            <select {...p} className="entrada" value={v.perfil} onChange={mudar('perfil')}>
              <option value="Operacional">Operacional (consulta e solicitações)</option>
              <option value="Admin">Financeiro/Admin (acesso total)</option>
            </select>
          )}
        </Campo>
        <Campo rotulo={usuario ? 'Nova senha' : 'Senha'} erro={envio.erros.senha} dica={usuario ? 'Deixe em branco para manter a atual.' : 'Pelo menos 8 caracteres.'} className="inteira">
          {(p) => <input {...p} className="entrada" type="password" value={v.senha} onChange={mudar('senha')} autoComplete="new-password" />}
        </Campo>
        {usuario ? (
          <label className="marcar inteira">
            <input type="checkbox" checked={v.ativo} onChange={(e) => definir((atual) => ({ ...atual, ativo: e.target.checked }))} />
            Usuário ativo (pode entrar no sistema)
          </label>
        ) : null}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Confirmação simples

export function Confirmacao({ titulo, children, rotulo, perigo = false, acao, aoFechar, aoConcluir }) {
  const envio = useEnvio(acao, aoConcluir);
  return (
    <Modal
      titulo={titulo}
      aoFechar={aoFechar}
      aoEnviar={envio.enviar}
      rodape={<Rodape aoFechar={aoFechar} enviando={envio.enviando} rotulo={rotulo} perigo={perigo} />}
    >
      <ErroGeral envio={envio} />
      <div>{children}</div>
    </Modal>
  );
}
