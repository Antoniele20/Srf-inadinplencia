import { Nota, Pagina } from './componentes/base.jsx';
import { Estrutura } from './componentes/Estrutura.jsx';
import { ProvedorMensagens } from './contextos/Mensagens.jsx';
import { ProvedorSessao, useSessao } from './contextos/Sessao.jsx';
import { useRota } from './lib/hooks.js';
import Avisos from './paginas/Avisos.jsx';
import ClienteDetalhe from './paginas/ClienteDetalhe.jsx';
import Clientes from './paginas/Clientes.jsx';
import Cobrancas from './paginas/Cobrancas.jsx';
import Configuracoes from './paginas/Configuracoes.jsx';
import Contratos from './paginas/Contratos.jsx';
import Inadimplencia from './paginas/Inadimplencia.jsx';
import Login from './paginas/Login.jsx';
import Painel from './paginas/Painel.jsx';
import Registros from './paginas/Registros.jsx';
import Relatorios from './paginas/Relatorios.jsx';
import Solicitacoes from './paginas/Solicitacoes.jsx';
import Usuarios from './paginas/Usuarios.jsx';

const SO_ADMIN = ['usuarios', 'registros'];

function Tela({ tela, parametro }) {
  const { ehAdmin } = useSessao();

  if (SO_ADMIN.includes(tela) && !ehAdmin) {
    return (
      <Pagina titulo="Acesso restrito">
        <Nota tipo="alerta" icone="cadeado">
          Esta tela é exclusiva do perfil Financeiro/Admin. Peça a um administrador se precisar deste acesso.
        </Nota>
      </Pagina>
    );
  }

  switch (tela) {
    case 'painel':
      return <Painel />;
    case 'clientes':
      return <Clientes parametro={parametro} />;
    case 'cliente':
      return <ClienteDetalhe id={Number(parametro)} />;
    case 'contratos':
      return <Contratos />;
    case 'cobrancas':
      return <Cobrancas parametro={parametro} />;
    case 'inadimplencia':
      return <Inadimplencia />;
    case 'solicitacoes':
      return <Solicitacoes />;
    case 'avisos':
      return <Avisos />;
    case 'relatorios':
      return <Relatorios />;
    case 'configuracoes':
      return <Configuracoes />;
    case 'usuarios':
      return <Usuarios />;
    case 'registros':
      return <Registros />;
    default:
      return (
        <Pagina titulo="Tela não encontrada">
          <Nota>
            O endereço não corresponde a nenhuma tela. <a href="#painel">Voltar ao Painel</a>.
          </Nota>
        </Pagina>
      );
  }
}

function Aplicacao() {
  const { usuario } = useSessao();
  const { rota, tela, parametro } = useRota();

  if (!usuario) return <Login />;

  return (
    <Estrutura tela={tela}>
      {/* A chave recria a tela a cada troca de endereço, zerando buscas e janelas abertas. */}
      <Tela key={tela === 'clientes' || tela === 'cobrancas' ? tela : rota} tela={tela} parametro={parametro} />
    </Estrutura>
  );
}

export default function App() {
  return (
    <ProvedorMensagens>
      <ProvedorSessao>
        <Aplicacao />
      </ProvedorSessao>
    </ProvedorMensagens>
  );
}
