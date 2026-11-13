import { useState } from 'react';
import { api } from '../api/index.js';
import { Botao, EstadoDeCarga, Etiqueta, Pagina, Painel, Tabela } from '../componentes/base.jsx';
import { FormUsuario } from '../componentes/formularios.jsx';
import { useMensagens } from '../contextos/Mensagens.jsx';
import { ROTULO_PERFIL, useSessao } from '../contextos/Sessao.jsx';
import { dataHora } from '../lib/formatos.js';
import { useDados } from '../lib/hooks.js';

export default function Usuarios() {
  const { usuario: eu } = useSessao();
  const { avisar } = useMensagens();
  const consulta = useDados(() => api.usuarios.listar(), []);
  const [janela, setJanela] = useState(null); // { usuario } ou { novo: true }

  function concluir(mensagem) {
    return () => {
      setJanela(null);
      avisar(mensagem);
      consulta.recarregar();
    };
  }

  return (
    <Pagina
      titulo="Usuários"
      descricao="Quem acessa o sistema e com qual perfil. Financeiro/Admin tem acesso total; Operacional consulta os status e registra solicitações."
      acoes={
        <Botao variante="primario" icone="mais" onClick={() => setJanela({ novo: true })}>
          Novo usuário
        </Botao>
      }
    >
      <Painel>
        {consulta.dados ? (
          <Tabela
            legenda="Usuários do sistema"
            linhas={consulta.dados}
            colunas={[
              {
                id: 'nome',
                titulo: 'Nome',
                celula: (u) => (
                  <span className="celula-dupla">
                    <span className="forte">
                      {u.nome}
                      {u.id === eu.id ? ' (você)' : ''}
                    </span>
                    <small>{u.email}</small>
                  </span>
                ),
              },
              { id: 'perfil', titulo: 'Perfil', celula: (u) => <Etiqueta cor={u.perfil === 'Admin' ? 'ouro' : 'azul'}>{ROTULO_PERFIL[u.perfil]}</Etiqueta> },
              { id: 'situacao', titulo: 'Situação', celula: (u) => (u.ativo ? <Etiqueta cor="verde">Ativo</Etiqueta> : <Etiqueta>Inativo</Etiqueta>) },
              {
                id: 'acesso',
                titulo: 'Último acesso',
                celula: (u) => (u.ultimoAcesso ? <span className="num">{dataHora(u.ultimoAcesso)}</span> : <span className="suave">Ainda não entrou</span>),
              },
              {
                id: 'acoes',
                titulo: <span className="so-leitor">Ações</span>,
                celula: (u) => (
                  <div className="acoes-linha">
                    <Botao pequeno icone="editar" onClick={() => setJanela({ usuario: u })}>
                      Editar
                    </Botao>
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <div className="painel-corpo">
            <EstadoDeCarga consulta={consulta} />
          </div>
        )}
      </Painel>

      {janela && janela.novo ? <FormUsuario aoFechar={() => setJanela(null)} aoSalvar={concluir('Usuário criado.')} /> : null}
      {janela && janela.usuario ? <FormUsuario usuario={janela.usuario} aoFechar={() => setJanela(null)} aoSalvar={concluir('Usuário atualizado.')} /> : null}
    </Pagina>
  );
}
