using Microsoft.AspNetCore.Mvc;
using SRF.Inadimplencia.Api.Aplicacao;
using SRF.Inadimplencia.Api.Aplicacao.Servicos;

namespace SRF.Inadimplencia.Api.Controllers;

[ApiController]
[Route("api/painel")]
public class PainelController : ControllerBase
{
    private readonly ServicoPainel _painel;

    public PainelController(ServicoPainel painel) => _painel = painel;

    [HttpGet]
    public async Task<ActionResult<PainelDto>> Obter(CancellationToken ct) => Ok(await _painel.ObterAsync(ct));
}
