using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SRF.Inadimplencia.Api.Aplicacao;
using SRF.Inadimplencia.Api.Aplicacao.Servicos;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Controllers;

[ApiController]
[Route("api/contratos")]
public class ContratosController : ControllerBase
{
    private readonly ServicoContratos _contratos;

    public ContratosController(ServicoContratos contratos) => _contratos = contratos;

    [HttpGet]
    public async Task<ActionResult<List<ContratoDto>>> Listar(CancellationToken ct) =>
        Ok(await _contratos.ListarAsync(null, ct));

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ContratoDto>> Criar([FromBody] ContratoEntradaDto dto, CancellationToken ct) =>
        Ok(await _contratos.CriarAsync(dto, User.IdDoUsuario(), ct));

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ContratoDto>> Atualizar(int id, [FromBody] ContratoEntradaDto dto, CancellationToken ct) =>
        Ok(await _contratos.AtualizarAsync(id, dto, User.IdDoUsuario(), ct));

    [HttpPost("{id:int}/encerrar")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ContratoDto>> Encerrar(int id, CancellationToken ct) =>
        Ok(await _contratos.EncerrarAsync(id, User.IdDoUsuario(), ct));
}
