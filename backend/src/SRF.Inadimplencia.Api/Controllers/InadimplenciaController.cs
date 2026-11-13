using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SRF.Inadimplencia.Api.Aplicacao;
using SRF.Inadimplencia.Api.Aplicacao.Servicos;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Controllers;

[ApiController]
[Route("api/inadimplencia")]
public class InadimplenciaController : ControllerBase
{
    private readonly ServicoClientes _clientes;
    private readonly ServicoRotina _rotina;

    public InadimplenciaController(ServicoClientes clientes, ServicoRotina rotina)
    {
        _clientes = clientes;
        _rotina = rotina;
    }

    [HttpGet]
    public async Task<ActionResult<List<ClienteResumoDto>>> Listar(CancellationToken ct) =>
        Ok(await _clientes.ListarInadimplentesAsync(ct));

    /// <summary>Executa agora a mesma rotina que roda todo dia às 01:00.</summary>
    [HttpPost("processar")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ResultadoRotinaDto>> Processar(CancellationToken ct) =>
        Ok(await _rotina.ProcessarAsync("Execução manual", User.IdDoUsuario(), ct));
}
