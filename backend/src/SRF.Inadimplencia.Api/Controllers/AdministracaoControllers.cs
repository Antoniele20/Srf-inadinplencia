using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SRF.Inadimplencia.Api.Aplicacao;
using SRF.Inadimplencia.Api.Aplicacao.Servicos;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Controllers;

[ApiController]
[Route("api/avisos")]
public class AvisosController : ControllerBase
{
    private readonly ServicoConsultas _consultas;

    public AvisosController(ServicoConsultas consultas) => _consultas = consultas;

    [HttpGet]
    public async Task<ActionResult<List<AvisoDto>>> Listar(CancellationToken ct) =>
        Ok(await _consultas.ListarAvisosAsync(ct));
}

[ApiController]
[Route("api/configuracoes")]
public class ConfiguracoesController : ControllerBase
{
    private readonly ServicoConfiguracoes _configuracoes;

    public ConfiguracoesController(ServicoConfiguracoes configuracoes) => _configuracoes = configuracoes;

    [HttpGet]
    public async Task<ActionResult<ConfiguracaoDto>> Obter(CancellationToken ct) =>
        Ok(await _configuracoes.ObterAsync(ct));

    [HttpPut]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ConfiguracaoDto>> Salvar([FromBody] ConfiguracaoEntradaDto dto, CancellationToken ct) =>
        Ok(await _configuracoes.SalvarAsync(dto, User.IdDoUsuario(), ct));
}

[ApiController]
[Route("api/usuarios")]
[Authorize(Roles = "Admin")]
public class UsuariosController : ControllerBase
{
    private readonly ServicoUsuarios _usuarios;

    public UsuariosController(ServicoUsuarios usuarios) => _usuarios = usuarios;

    [HttpGet]
    public async Task<ActionResult<List<UsuarioDto>>> Listar(CancellationToken ct) =>
        Ok(await _usuarios.ListarAsync(ct));

    [HttpPost]
    public async Task<ActionResult<UsuarioDto>> Criar([FromBody] UsuarioEntradaDto dto, CancellationToken ct) =>
        Ok(await _usuarios.CriarAsync(dto, User.IdDoUsuario(), ct));

    [HttpPut("{id:int}")]
    public async Task<ActionResult<UsuarioDto>> Atualizar(int id, [FromBody] UsuarioEntradaDto dto, CancellationToken ct) =>
        Ok(await _usuarios.AtualizarAsync(id, dto, User.IdDoUsuario(), ct));
}

[ApiController]
[Route("api/registros")]
[Authorize(Roles = "Admin")]
public class RegistrosController : ControllerBase
{
    private readonly ServicoConsultas _consultas;

    public RegistrosController(ServicoConsultas consultas) => _consultas = consultas;

    [HttpGet]
    public async Task<ActionResult<List<RegistroDto>>> Listar(CancellationToken ct) =>
        Ok(await _consultas.ListarRegistrosAsync(ct));
}
