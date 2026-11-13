using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SRF.Inadimplencia.Api.Aplicacao;
using SRF.Inadimplencia.Api.Aplicacao.Servicos;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Controllers;

[ApiController]
[Route("api/cobrancas")]
public class CobrancasController : ControllerBase
{
    private readonly ServicoCobrancas _cobrancas;

    public CobrancasController(ServicoCobrancas cobrancas) => _cobrancas = cobrancas;

    [HttpGet]
    public async Task<ActionResult<List<CobrancaDto>>> Listar(
        [FromQuery] string? situacao, [FromQuery] int? clienteId, [FromQuery] string? busca, CancellationToken ct) =>
        Ok(await _cobrancas.ListarAsync(situacao, clienteId, busca, ct));

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ResultadoAlteracaoCobrancaDto>> Atualizar(
        int id, [FromBody] CobrancaEdicaoDto dto, CancellationToken ct) =>
        Ok(await _cobrancas.AtualizarAsync(id, dto, User.IdDoUsuario(), ct));

    /// <summary>Baixa manual do pagamento. Libera o cliente na mesma chamada se ele regularizou tudo.</summary>
    [HttpPost("{id:int}/baixa")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ResultadoAlteracaoCobrancaDto>> Baixar(
        int id, [FromBody] BaixaDto dto, CancellationToken ct) =>
        Ok(await _cobrancas.BaixarAsync(id, dto, User.IdDoUsuario(), ct));

    [HttpPost("{id:int}/estorno")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ResultadoAlteracaoCobrancaDto>> Estornar(int id, CancellationToken ct) =>
        Ok(await _cobrancas.EstornarAsync(id, User.IdDoUsuario(), ct));

    [HttpPost("{id:int}/cancelamento")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ResultadoAlteracaoCobrancaDto>> Cancelar(
        int id, [FromBody] CancelamentoDto dto, CancellationToken ct) =>
        Ok(await _cobrancas.CancelarAsync(id, dto, User.IdDoUsuario(), ct));
}
