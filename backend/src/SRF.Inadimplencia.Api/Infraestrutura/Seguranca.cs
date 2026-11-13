using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using SRF.Inadimplencia.Api.Dominio;

namespace SRF.Inadimplencia.Api.Infraestrutura;

public sealed class OpcoesJwt
{
    public string Chave { get; set; } = "";
    public string Emissor { get; set; } = "srf-inadimplencia";
    public string Audiencia { get; set; } = "srf-inadimplencia-web";
    public int ExpiraEmHoras { get; set; } = 8;
}

public interface IServicoDeToken
{
    (string Token, DateTime ExpiraEm) Gerar(Usuario usuario);
}

/// <summary>Emite o token JWT da sessão. As claims usam nomes curtos: sub, name, email e role.</summary>
public sealed class ServicoDeToken : IServicoDeToken
{
    private readonly OpcoesJwt _opcoes;
    private readonly IRelogio _relogio;

    public ServicoDeToken(IOptions<OpcoesJwt> opcoes, IRelogio relogio)
    {
        _opcoes = opcoes.Value;
        _relogio = relogio;
    }

    public (string Token, DateTime ExpiraEm) Gerar(Usuario usuario)
    {
        var agora = _relogio.AgoraUtc;
        var expiraEm = agora.AddHours(_opcoes.ExpiraEmHoras);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
            new Claim("name", usuario.Nome),
            new Claim(JwtRegisteredClaimNames.Email, usuario.Email),
            new Claim("role", usuario.Perfil.ToString())
        };
        var chave = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opcoes.Chave));
        var jwt = new JwtSecurityToken(
            issuer: _opcoes.Emissor,
            audience: _opcoes.Audiencia,
            claims: claims,
            notBefore: agora,
            expires: expiraEm,
            signingCredentials: new SigningCredentials(chave, SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(jwt), expiraEm);
    }
}

public static class ExtensoesDoUsuario
{
    /// <summary>Id do usuário logado, lido da claim "sub" do token.</summary>
    public static int IdDoUsuario(this ClaimsPrincipal usuario)
    {
        var valor = usuario.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return int.TryParse(valor, out var id)
            ? id
            : throw new ErroDeNegocio("Sua sessão terminou. Entre novamente.", "NAO_AUTENTICADO", 401);
    }
}
