using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SRF.Inadimplencia.Api.Aplicacao;
using SRF.Inadimplencia.Api.Aplicacao.Servicos;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Controllers;

/// <summary>Leitura: qualquer usuário logado. Alteração: somente Financeiro/Admin (RNF03).</summary>
[ApiController]
[Route("api/clientes")]
public class ClientesController : ControllerBase
{
    private readonly ServicoClientes _clientes;

    public ClientesController(ServicoClientes clientes) => _clientes = clientes;

    [HttpGet]
    public async Task<ActionResult<List<ClienteResumoDto>>> Listar(
        [FromQuery] string? busca, [FromQuery] string? status, [FromQuery] bool incluirInativos, CancellationToken ct) =>
        Ok(await _clientes.ListarAsync(busca, status, incluirInativos, ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ClienteDetalheDto>> Obter(int id, CancellationToken ct) =>
        Ok(await _clientes.ObterAsync(id, ct));

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ClienteResumoDto>> Criar([FromBody] ClienteEntradaDto dto, CancellationToken ct) =>
        Ok(await _clientes.CriarAsync(dto, User.IdDoUsuario(), ct));

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ClienteResumoDto>> Atualizar(int id, [FromBody] ClienteEntradaDto dto, CancellationToken ct) =>
        Ok(await _clientes.AtualizarAsync(id, dto, User.IdDoUsuario(), ct));

    [HttpPatch("{id:int}/ativo")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ClienteResumoDto>> AlterarAtivo(int id, [FromBody] AtivoDto dto, CancellationToken ct) =>
        Ok(await _clientes.AlterarAtivoAsync(id, dto.Ativo ?? true, User.IdDoUsuario(), ct));

    [HttpPost("{id:int}/liberacoes")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<LiberacaoDto>> ConcederLiberacao(
        int id, [FromBody] LiberacaoEntradaDto dto, CancellationToken ct) =>
        Ok(await _clientes.ConcederLiberacaoAsync(id, dto, User.IdDoUsuario(), ct));
}

[ApiController]
[Route("api/liberacoes")]
public class LiberacoesController : ControllerBase
{
    private readonly ServicoClientes _clientes;

    public LiberacoesController(ServicoClientes clientes) => _clientes = clientes;

    [HttpPost("{id:int}/revogar")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<LiberacaoDto>> Revogar(int id, CancellationToken ct) =>
        Ok(await _clientes.RevogarLiberacaoAsync(id, User.IdDoUsuario(), ct));
}
