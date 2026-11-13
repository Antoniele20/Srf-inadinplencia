/** Erro devolvido pela API (real ou de demonstração), já com mensagem pronta para a tela. */
export class ErroApi extends Error {
  constructor(mensagem, { codigo = 'ERRO', status = 500, erros = null } = {}) {
    super(mensagem);
    this.name = 'ErroApi';
    this.codigo = codigo;
    this.status = status;
    /** Erros por campo, quando a API recusa um formulário: { campo: 'mensagem' }. */
    this.erros = erros;
  }
}
