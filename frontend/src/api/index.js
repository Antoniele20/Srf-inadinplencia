// Ponto único de acesso aos dados.
//
// VITE_DEMO=true  -> modo demonstração: dados fictícios no navegador, sem servidor.
// (padrão)        -> API real em ASP.NET Core. VITE_API_URL informa o endereço; se ficar
//                    vazio, usa o mesmo endereço do site (o Vite repassa /api para a API).

import { criarApiDemo } from './demo/apiDemo.js';
import { criarApiHttp } from './http.js';

export const MODO_DEMO = import.meta.env.VITE_DEMO === 'true';

export const api = MODO_DEMO ? criarApiDemo() : criarApiHttp(import.meta.env.VITE_API_URL || '');

export { ErroApi } from './erro.js';
