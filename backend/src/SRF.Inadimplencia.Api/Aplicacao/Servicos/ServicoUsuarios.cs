using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SRF.Inadimplencia.Api.Dados;
using SRF.Inadimplencia.Api.Dominio;
using SRF.Inadimplencia.Api.Dominio.Regras;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Api.Aplicacao.Servicos;

/// <summary>Login e gestão de usuários (perfis Admin e Operacional, RNF03).</summary>
public class ServicoUsuarios
{
    private const int TamanhoMinimoSenha = 8;

    // Hash fictício, só para gastar o mesmo tempo quando o e-mail não existe (evita revelar quais e-mails são válidos).
    private static readonly string HashFalso = BCrypt.Net.BCrypt.HashPassword("senha-ficticia-para-igualar-tempo", 11);

    private readonly AppDbContext _db;
    private readonly IServicoDeToken _tokens;
    private readonly IRelogio _relogio;
    private readonly IAuditoria _auditoria;

    public ServicoUsuarios(AppDbContext db, IServicoDeToken tokens, IRelogio relogio, IAuditoria auditoria)
    {
        _db = db;
        _tokens = tokens;
        _relogio = relogio;
        _auditoria = auditoria;
    }

    public async Task<SessaoDto> EntrarAsync(LoginDto dto, CancellationToken ct)
    {
        var email = (dto.Email ?? "").Trim();
        var senha = dto.Senha ?? "";

        var usuario = email.Length == 0
            ? null
            : await _db.Usuarios.FirstOrDefaultAsync(u => u.Email == email, ct);

        var hash = usuario?.SenhaHash;
        var senhaConfere = BCrypt.Net.BCrypt.Verify(senha, string.IsNullOrEmpty(hash) ? HashFalso : hash)
                           && !string.IsNullOrEmpty(hash);

        if (usuario is null || !usuario.Ativo || !senhaConfere)
        {
            _auditoria.Registrar(null, "LoginInvalido", email.Length > 160 ? email[..160] : email);
            await _db.SaveChangesAsync(ct);
            throw new ErroDeNegocio("E-mail ou senha incorretos.", "CREDENCIAIS_INVALIDAS", 401);
        }

        usuario.UltimoAcesso = _relogio.AgoraUtc;
        _auditoria.Registrar(usuario.Id, "Login");
        await _db.SaveChangesAsync(ct);

        var (token, expiraEm) = _tokens.Gerar(usuario);
        return new SessaoDto(token, expiraEm, new UsuarioSessaoDto(usuario.Id, usuario.Nome, usuario.Email, usuario.Perfil));
    }

    public async Task<UsuarioSessaoDto> EuAsync(int usuarioId, CancellationToken ct)
    {
        var u = await _db.Usuarios.AsNoTracking().FirstOrDefaultAsync(x => x.Id == usuarioId && x.Ativo, ct)
                ?? throw new ErroDeNegocio("Sua sessão terminou. Entre novamente.", "NAO_AUTENTICADO", 401);
        return new UsuarioSessaoDto(u.Id, u.Nome, u.Email, u.Perfil);
    }

    public async Task<List<UsuarioDto>> ListarAsync(CancellationToken ct)
    {
        var usuarios = await _db.Usuarios.AsNoTracking().ToListAsync(ct);
        return usuarios
            .OrderBy(u => u.Nome, StringComparer.Create(new CultureInfo("pt-BR"), true))
            .Select(Mapeadores.Usuario)
            .ToList();
    }

    public async Task<UsuarioDto> CriarAsync(UsuarioEntradaDto dto, int usuarioId, CancellationToken ct)
    {
        var dados = await ValidarAsync(dto, null, ct);
        var novo = new Usuario
        {
            Nome = dados.Nome,
            Email = dados.Email,
            Perfil = dados.Perfil,
            SenhaHash = BCrypt.Net.BCrypt.HashPassword(dados.Senha, 11),
            Ativo = true,
            CriadoEm = _relogio.AgoraUtc
        };
        _db.Usuarios.Add(novo);
        _auditoria.Registrar(usuarioId, "UsuarioCriado", $"{novo.Nome} ({novo.Perfil})");
        await _db.SaveChangesAsync(ct);
        return Mapeadores.Usuario(novo);
    }

    public async Task<UsuarioDto> AtualizarAsync(int id, UsuarioEntradaDto dto, int usuarioId, CancellationToken ct)
    {
        var alvo = await _db.Usuarios.FirstOrDefaultAsync(u => u.Id == id, ct) ?? throw Erros.NaoEncontrado("Usuário");
        var dados = await ValidarAsync(dto, id, ct);
        var ativo = dto.Ativo ?? alvo.Ativo;

        var deixaDeSerAdmin = alvo.Perfil == PerfilUsuario.Admin && alvo.Ativo
                              && (dados.Perfil != PerfilUsuario.Admin || !ativo);
        if (deixaDeSerAdmin)
        {
            if (alvo.Id == usuarioId)
                throw Erros.Regra("Você não pode remover o seu próprio acesso de Financeiro/Admin.");
            var outros = await _db.Usuarios.CountAsync(
                u => u.Id != alvo.Id && u.Perfil == PerfilUsuario.Admin && u.Ativo, ct);
            if (outros == 0)
                throw Erros.Regra("O sistema precisa de pelo menos um usuário Financeiro/Admin ativo.");
        }

        alvo.Nome = dados.Nome;
        alvo.Email = dados.Email;
        alvo.Perfil = dados.Perfil;
        alvo.Ativo = ativo;
        if (!string.IsNullOrEmpty(dados.Senha)) alvo.SenhaHash = BCrypt.Net.BCrypt.HashPassword(dados.Senha, 11);

        _auditoria.Registrar(usuarioId, "UsuarioAlterado",
            $"{alvo.Nome} ({alvo.Perfil}{(alvo.Ativo ? "" : ", inativo")})");
        await _db.SaveChangesAsync(ct);
        return Mapeadores.Usuario(alvo);
    }

    private readonly record struct DadosValidos(string Nome, string Email, PerfilUsuario Perfil, string Senha);

    private async Task<DadosValidos> ValidarAsync(UsuarioEntradaDto dto, int? idAtual, CancellationToken ct)
    {
        var erros = new Dictionary<string, string>();
        var nome = (dto.Nome ?? "").Trim();
        var email = (dto.Email ?? "").Trim().ToLowerInvariant();
        var senha = dto.Senha ?? "";

        if (nome.Length < 3) erros["nome"] = "Informe o nome completo.";
        else if (nome.Length > 120) erros["nome"] = "O nome pode ter no máximo 120 caracteres.";

        if (!Documento.EmailValido(email)) erros["email"] = "Informe um e-mail válido.";
        else if (await _db.Usuarios.AnyAsync(u => u.Email == email && u.Id != idAtual, ct))
            erros["email"] = "Já existe um usuário com este e-mail.";

        var perfilValido = Enum.TryParse<PerfilUsuario>(dto.Perfil, out var perfil) && Enum.IsDefined(perfil);
        if (!perfilValido) erros["perfil"] = "Escolha o perfil.";

        if (idAtual is null && senha.Length < TamanhoMinimoSenha)
            erros["senha"] = $"A senha precisa ter pelo menos {TamanhoMinimoSenha} caracteres.";
        else if (senha.Length > 0 && senha.Length < TamanhoMinimoSenha)
            erros["senha"] = $"A senha precisa ter pelo menos {TamanhoMinimoSenha} caracteres.";
        else if (senha.Length > 72)
            erros["senha"] = "A senha pode ter no máximo 72 caracteres.";

        Erros.ExigirSemErros(erros);
        return new DadosValidos(nome, email, perfil, senha);
    }
}
