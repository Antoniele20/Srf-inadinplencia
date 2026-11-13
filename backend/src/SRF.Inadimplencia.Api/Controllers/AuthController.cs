using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SRF.Inadimplencia.Api.Aplicacao;
using SRF.Inadimplencia.Api.Aplicacao.Servicos;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly ServicoUsuarios _usuarios;

    public AuthController(ServicoUsuarios usuarios) => _usuarios = usuarios;

    /// <summary>Login. Limitado a 10 tentativas por minuto por endereço de origem.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<ActionResult<SessaoDto>> Login([FromBody] LoginDto dto, CancellationToken ct) =>
        Ok(await _usuarios.EntrarAsync(dto, ct));

    [HttpGet("eu")]
    public async Task<ActionResult<UsuarioSessaoDto>> Eu(CancellationToken ct) =>
        Ok(await _usuarios.EuAsync(User.IdDoUsuario(), ct));
}
