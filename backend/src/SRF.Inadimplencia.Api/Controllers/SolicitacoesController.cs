using Microsoft.AspNetCore.Mvc;
using SRF.Inadimplencia.Api.Aplicacao;
using SRF.Inadimplencia.Api.Aplicacao.Servicos;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Controllers;

/// <summary>
/// Abrir e concluir solicitações é função do time Operacional, então qualquer usuário logado pode.
/// O bloqueio por inadimplência é aplicado dentro do serviço, para todos os perfis.
/// </summary>
[ApiController]
[Route("api/solicitacoes")]
public class SolicitacoesController : ControllerBase
{
    private readonly ServicoSolicitacoes _solicitacoes;

    public SolicitacoesController(ServicoSolicitacoes solicitacoes) => _solicitacoes = solicitacoes;

    [HttpGet]
    public async Task<ActionResult<List<SolicitacaoDto>>> Listar(CancellationToken ct) =>
        Ok(await _solicitacoes.ListarAsync(ct));

    [HttpPost]
    public async Task<ActionResult<SolicitacaoDto>> Criar([FromBody] SolicitacaoEntradaDto dto, CancellationToken ct) =>
        Ok(await _solicitacoes.CriarAsync(dto, User.IdDoUsuario(), ct));

    [HttpPost("{id:int}/concluir")]
    public async Task<ActionResult<SolicitacaoDto>> Concluir(int id, CancellationToken ct) =>
        Ok(await _solicitacoes.ConcluirAsync(id, User.IdDoUsuario(), ct));
}
