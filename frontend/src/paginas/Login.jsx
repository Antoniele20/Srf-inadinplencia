import { useState } from 'react';
import { MODO_DEMO } from '../api/index.js';
import { SENHA_DEMO } from '../api/demo/sementes.js';
import { Botao, Campo, Nota } from '../componentes/base.jsx';
import { Poste } from '../componentes/Semaforo.jsx';
import { useSessao } from '../contextos/Sessao.jsx';

export default function Login() {
  const { entrar } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function autenticar(emailInformado, senhaInformada) {
    setEnviando(true);
    setErro(null);
    try {
      await entrar(emailInformado, senhaInformada);
    } catch (falha) {
      setErro(falha.message || 'Não foi possível entrar. Tente de novo.');
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <section className="login-marca">
        <div>
          <div className="marca-sigla">SRF</div>
          <div className="marca-nome">Serviços de Advocacia Ltda.</div>
          <h1>Controle de Inadimplência</h1>
          <p>Honorários mensais, avisos de atraso e bloqueio operacional em um só lugar.</p>
        </div>
        <div className="login-semaforo">
          <Poste acesos={['Vermelho', 'Amarelo', 'Verde']} />
          <ul>
            <li>
              <strong>Vermelho</strong>
              <span>Bloqueado até regularizar</span>
            </li>
            <li>
              <strong>Amarelo</strong>
              <span>Em atraso, com avisos emitidos</span>
            </li>
            <li>
              <strong>Verde</strong>
              <span>Em dia, sem pendências</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="login-form">
        <form
          className="login-caixa"
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            autenticar(email, senha);
          }}
        >
          <h2>Entrar</h2>
          {erro ? (
            <Nota tipo="perigo" icone="inadimplencia">
              {erro}
            </Nota>
          ) : null}
          <Campo rotulo="E-mail">
            {(p) => <input {...p} className="entrada" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />}
          </Campo>
          <Campo rotulo="Senha">
            {(p) => <input {...p} className="entrada" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />}
          </Campo>
          <Botao type="submit" variante="primario" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </Botao>

          {MODO_DEMO ? (
            <div className="login-demo">
              <p className="secundario">
                <strong>Modo demonstração.</strong> Escolha um perfil para ver o sistema com dados fictícios.
              </p>
              <Botao disabled={enviando} onClick={() => autenticar('financeiro@srf.local', SENHA_DEMO)}>
                Entrar como Financeiro/Admin
              </Botao>
              <Botao disabled={enviando} onClick={() => autenticar('operacional@srf.local', SENHA_DEMO)}>
                Entrar como Operacional
              </Botao>
            </div>
          ) : null}
        </form>
      </section>
    </div>
  );
}
