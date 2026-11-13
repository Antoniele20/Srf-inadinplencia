// Mensagens rápidas no canto da tela ("Pagamento registrado", erros de operação).
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Icone } from '../componentes/base.jsx';

const ContextoMensagens = createContext(null);

export function ProvedorMensagens({ children }) {
  const [mensagens, setMensagens] = useState([]);
  const contador = useRef(0);

  const avisar = useCallback((texto, tipo = 'ok') => {
    contador.current += 1;
    const id = contador.current;
    setMensagens((lista) => [...lista, { id, texto, tipo }]);
    setTimeout(() => setMensagens((lista) => lista.filter((m) => m.id !== id)), tipo === 'erro' ? 7000 : 4500);
  }, []);

  const valor = useMemo(() => ({ avisar, avisarErro: (erro) => avisar(erro.message || 'Algo deu errado. Tente de novo.', 'erro') }), [avisar]);

  return (
    <ContextoMensagens.Provider value={valor}>
      {children}
      <div className="brindes" role="status" aria-live="polite">
        {mensagens.map((m) => (
          <div key={m.id} className={`brinde ${m.tipo === 'erro' ? 'erro' : ''}`}>
            <Icone nome={m.tipo === 'erro' ? 'inadimplencia' : 'check'} />
            <span>{m.texto}</span>
          </div>
        ))}
      </div>
    </ContextoMensagens.Provider>
  );
}

export function useMensagens() {
  return useContext(ContextoMensagens);
}
