// Guarda o banco de demonstração no navegador de quem está usando.
// Se o armazenamento não estiver disponível, tudo continua funcionando em memória.

const CHAVE = 'srf-inadimplencia-demo';

export function carregarBanco() {
  try {
    const texto = window.localStorage.getItem(CHAVE);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

export function salvarBanco(banco) {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(banco));
  } catch {
    // Sem armazenamento: os dados valem até a página ser recarregada.
  }
}

export function apagarBanco() {
  try {
    window.localStorage.removeItem(CHAVE);
  } catch {
    // Nada a apagar.
  }
}
