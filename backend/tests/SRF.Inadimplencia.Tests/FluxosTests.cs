using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using SRF.Inadimplencia.Api.Aplicacao;
using SRF.Inadimplencia.Api.Aplicacao.Servicos;
using SRF.Inadimplencia.Api.Dados;
using SRF.Inadimplencia.Api.Dominio;
using SRF.Inadimplencia.Api.Infraestrutura;

namespace SRF.Inadimplencia.Tests;

/// <summary>Relógio com data controlada pelo teste.</summary>
internal sealed class RelogioFixo : IRelogio
{
    public DateOnly Dia { get; set; }

    public RelogioFixo(DateOnly dia) => Dia = dia;

    public DateTime AgoraUtc => Dia.ToDateTime(new TimeOnly(15, 0), DateTimeKind.Utc);
    public DateOnly Hoje => Dia;
    public DateTime AgoraLocal => Dia.ToDateTime(new TimeOnly(12, 0));
    public DateOnly DataLocal(DateTime instanteUtc) => DateOnly.FromDateTime(instanteUtc);
}

/// <summary>
/// Monta os serviços sobre um banco em memória, com um cliente de cada situação.
/// Usuários: 1 = Admin (Financeiro), 2 = Operacional.
/// </summary>
internal sealed class Cenario
{
    public static readonly DateOnly Hoje = new(2026, 11, 12);

    public AppDbContext Db { get; }
    public RelogioFixo Relogio { get; } = new(Hoje);
    public ServicoSolicitacoes Solicitacoes { get; }
    public ServicoCobrancas Cobrancas { get; }
    public ServicoClientes Clientes { get; }
    public ServicoRotina Rotina { get; }
    public ServicoSituacao Situacao { get; }
    public ServicoConfiguracoes Configuracoes { get; }
    public ServicoContratos Contratos { get; }

    public const int Admin = 1;
    public const int Operacional = 2;

    public Cenario()
    {
        var opcoes = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        Db = new AppDbContext(opcoes);

        var auditoria = new Auditoria(Db, Relogio, new HttpContextAccessor());
        Situacao = new ServicoSituacao(Db, Relogio);
        Rotina = new ServicoRotina(Db, Situacao, Relogio, auditoria);
        Contratos = new ServicoContratos(Db, Situacao, Rotina, Relogio, auditoria);
        Clientes = new ServicoClientes(Db, Situacao, Rotina, Contratos, Relogio, auditoria);
        Cobrancas = new ServicoCobrancas(Db, Situacao, Rotina, Relogio, auditoria);
        Solicitacoes = new ServicoSolicitacoes(Db, Situacao, Relogio, auditoria);
        Configuracoes = new ServicoConfiguracoes(Db, Situacao, Rotina, Relogio, auditoria);

        var agora = Relogio.AgoraUtc;
        Db.Usuarios.AddRange(
            new Usuario { Id = 1, Nome = "Financeiro", Email = "fin@srf.local", Perfil = PerfilUsuario.Admin, Ativo = true, CriadoEm = agora },
            new Usuario { Id = 2, Nome = "Operacional", Email = "op@srf.local", Perfil = PerfilUsuario.Operacional, Ativo = true, CriadoEm = agora });
        Db.Configuracoes.Add(new Configuracao
        {
            Id = 1, MultaPercentual = 2m, JurosDiarioPercentual = 0.033m, DiasParaBloqueio = 30, DiasAvisoPreVencimento = 3,
            AtualizadoEm = agora
        });
        Db.SaveChanges();
    }

    /// <summary>Cliente com um contrato de R$ 5.000 e uma cobrança em aberto vencida há <paramref name="diasDeAtraso"/> dias.</summary>
    public Cliente ClienteComAtraso(int id, string nome, int diasDeAtraso)
    {
        var agora = Relogio.AgoraUtc;
        var cliente = new Cliente
        {
            Id = id, Nome = nome, Documento = $"{id:D14}", Email = $"c{id}@exemplo.test", Ativo = true,
            Status = StatusCliente.Verde, StatusDesde = agora, CriadoEm = agora
        };
        var vencimento = Relogio.Dia.AddDays(-diasDeAtraso);
        // O contrato cobre só o mês desta cobrança: a rotina não gera outras, e cada teste controla
        // exatamente quais cobranças existem.
        var contrato = new Contrato
        {
            Id = id, ClienteId = id, Descricao = "Assessoria", ValorMensal = 5000m, DiaVencimento = Math.Min(vencimento.Day, 28),
            DataInicio = vencimento, DataFim = vencimento, Ativo = true, CriadoEm = agora
        };
        var parcela = new Parcela
        {
            Id = id, ContratoId = id, Competencia = new DateOnly(vencimento.Year, vencimento.Month, 1),
            DataVencimento = vencimento, ValorOriginal = 5000m, Status = StatusParcela.Aberta, CriadoEm = agora
        };
        Db.Clientes.Add(cliente);
        Db.Contratos.Add(contrato);
        Db.Parcelas.Add(parcela);
        Db.SaveChanges();
        return cliente;
    }

    public SolicitacaoEntradaDto Pedido(int clienteId) =>
        new(clienteId, "NovaSolicitacao", "Revisão de contrato de fornecimento");
}

public class FluxosTests
{
    [Fact]
    public async Task Cliente_vermelho_nao_recebe_nova_solicitacao_mas_amarelo_recebe()
    {
        var c = new Cenario();
        c.ClienteComAtraso(1, "Atrasado 10 dias", 10);
        c.ClienteComAtraso(2, "Atrasado 45 dias", 45);

        var criada = await c.Solicitacoes.CriarAsync(c.Pedido(1), Cenario.Operacional, default);
        Assert.Equal(StatusSolicitacao.Aberta, criada.Status);

        var erro = await Assert.ThrowsAsync<ErroDeNegocio>(() => c.Solicitacoes.CriarAsync(c.Pedido(2), Cenario.Operacional, default));
        Assert.Equal("CLIENTE_BLOQUEADO", erro.Codigo);
        Assert.Equal(409, erro.Status);
        Assert.Equal(1, await c.Db.Solicitacoes.CountAsync());
        // A tentativa recusada fica registrada na auditoria.
        Assert.True(await c.Db.LogsAcesso.AnyAsync(l => l.Acao == "SolicitacaoBloqueada"));
    }

    [Fact]
    public async Task Baixa_das_cobrancas_vencidas_libera_o_cliente_na_hora()
    {
        var c = new Cenario();
        var cliente = c.ClienteComAtraso(1, "Atrasado 45 dias", 45);
        await c.Rotina.ProcessarAsync("teste", null, default);
        Assert.Equal(StatusCliente.Vermelho, (await c.Db.Clientes.FindAsync(1))!.Status);

        var parcelaId = (await c.Db.Parcelas.FirstAsync(p => p.ContratoId == 1 && p.Status == StatusParcela.Aberta)).Id;
        var resultado = await c.Cobrancas.BaixarAsync(
            parcelaId, new BaixaDto(Cenario.Hoje, 5174.25m, null), Cenario.Admin, default);

        Assert.True(resultado.Liberado);
        Assert.Equal(StatusCliente.Vermelho, resultado.StatusAnterior);
        Assert.Equal(StatusCliente.Verde, resultado.StatusAtual);
        Assert.Equal(StatusParcela.Paga, resultado.Cobranca.Status);
        Assert.Equal("Financeiro", resultado.Cobranca.BaixadaPor);
        Assert.True(await c.Db.Avisos.AnyAsync(a => a.ClienteId == cliente.Id && a.Tipo == TipoAviso.Regularizacao));

        // E volta a poder receber solicitações.
        var criada = await c.Solicitacoes.CriarAsync(c.Pedido(1), Cenario.Operacional, default);
        Assert.Equal(StatusSolicitacao.Aberta, criada.Status);
    }

    [Fact]
    public async Task Baixa_valida_os_campos()
    {
        var c = new Cenario();
        c.ClienteComAtraso(1, "Atrasado 10 dias", 10);

        var futura = await Assert.ThrowsAsync<ErroDeNegocio>(() => c.Cobrancas.BaixarAsync(
            1, new BaixaDto(Cenario.Hoje.AddDays(1), 5000m, null), Cenario.Admin, default));
        Assert.Equal("VALIDACAO", futura.Codigo);
        Assert.True(futura.Erros!.ContainsKey("dataPagamento"));

        var semValor = await Assert.ThrowsAsync<ErroDeNegocio>(() => c.Cobrancas.BaixarAsync(
            1, new BaixaDto(Cenario.Hoje, 0m, null), Cenario.Admin, default));
        Assert.True(semValor.Erros!.ContainsKey("valorPago"));
    }

    [Fact]
    public async Task Liberacao_temporaria_so_para_vermelho_libera_e_pode_ser_revogada()
    {
        var c = new Cenario();
        c.ClienteComAtraso(1, "Atrasado 10 dias", 10);
        c.ClienteComAtraso(2, "Atrasado 45 dias", 45);
        await c.Rotina.ProcessarAsync("teste", null, default);

        var entrada = new LiberacaoEntradaDto(Cenario.Hoje.AddDays(10), "Renegociação em andamento com o cliente.");

        var naoVermelho = await Assert.ThrowsAsync<ErroDeNegocio>(() => c.Clientes.ConcederLiberacaoAsync(1, entrada, Cenario.Admin, default));
        Assert.Equal("REGRA_NEGOCIO", naoVermelho.Codigo);

        var longa = await Assert.ThrowsAsync<ErroDeNegocio>(() => c.Clientes.ConcederLiberacaoAsync(
            2, new LiberacaoEntradaDto(Cenario.Hoje.AddDays(61), "Renegociação em andamento."), Cenario.Admin, default));
        Assert.True(longa.Erros!.ContainsKey("dataFim"));

        var liberacao = await c.Clientes.ConcederLiberacaoAsync(2, entrada, Cenario.Admin, default);
        Assert.True(liberacao.Ativa);
        var criada = await c.Solicitacoes.CriarAsync(c.Pedido(2), Cenario.Operacional, default);
        Assert.Equal(StatusSolicitacao.Aberta, criada.Status);

        await c.Clientes.RevogarLiberacaoAsync(liberacao.Id, Cenario.Admin, default);
        var erro = await Assert.ThrowsAsync<ErroDeNegocio>(() => c.Solicitacoes.CriarAsync(c.Pedido(2), Cenario.Operacional, default));
        Assert.Equal("CLIENTE_BLOQUEADO", erro.Codigo);
    }

    [Fact]
    public async Task Rotina_e_idempotente_nao_duplica_cobrancas_nem_avisos()
    {
        var c = new Cenario();
        c.ClienteComAtraso(1, "Atrasado 12 dias", 12);

        var primeira = await c.Rotina.ProcessarAsync("teste", null, default);
        var parcelas = await c.Db.Parcelas.CountAsync();
        var avisos = await c.Db.Avisos.CountAsync();
        Assert.True(primeira.ParcelasGeradas > 0 || parcelas > 0);
        Assert.True(avisos > 0);

        var segunda = await c.Rotina.ProcessarAsync("teste", null, default);
        Assert.Equal(0, segunda.ParcelasGeradas);
        Assert.Equal(0, segunda.AvisosGerados);
        Assert.Equal(0, segunda.ClientesComStatusAlterado);
        Assert.Equal(parcelas, await c.Db.Parcelas.CountAsync());
        Assert.Equal(avisos, await c.Db.Avisos.CountAsync());
    }

    [Fact]
    public async Task Passagem_do_tempo_amarelo_vira_vermelho_e_e_bloqueado_sem_intervencao()
    {
        var c = new Cenario();
        c.ClienteComAtraso(1, "Atrasado 10 dias", 10);
        await c.Rotina.ProcessarAsync("dia 0", null, default);

        var cliente = (await c.Db.Clientes.FindAsync(1))!;
        Assert.Equal(StatusCliente.Amarelo, cliente.Status);
        await c.Solicitacoes.CriarAsync(c.Pedido(1), Cenario.Operacional, default); // ainda atende

        // 20 dias depois: 30 dias de atraso, último dia do Amarelo.
        c.Relogio.Dia = Cenario.Hoje.AddDays(20);
        await c.Rotina.ProcessarAsync("dia 20", null, default);
        Assert.Equal(StatusCliente.Amarelo, (await c.Db.Clientes.FindAsync(1))!.Status);

        // 21 dias depois: 31 dias de atraso, passa para Vermelho e o aviso de bloqueio é emitido.
        c.Relogio.Dia = Cenario.Hoje.AddDays(21);
        var r = await c.Rotina.ProcessarAsync("dia 21", null, default);
        Assert.Equal(1, r.ClientesComStatusAlterado);
        Assert.Equal(StatusCliente.Vermelho, (await c.Db.Clientes.FindAsync(1))!.Status);
        Assert.True(await c.Db.Avisos.AnyAsync(a => a.Tipo == TipoAviso.Bloqueio));

        var erro = await Assert.ThrowsAsync<ErroDeNegocio>(() => c.Solicitacoes.CriarAsync(c.Pedido(1), Cenario.Operacional, default));
        Assert.Equal("CLIENTE_BLOQUEADO", erro.Codigo);
    }

    [Fact]
    public async Task Mudar_o_prazo_de_bloqueio_recalcula_o_semaforo()
    {
        var c = new Cenario();
        c.ClienteComAtraso(1, "Atrasado 20 dias", 20);
        await c.Rotina.ProcessarAsync("teste", null, default);
        Assert.Equal(StatusCliente.Amarelo, (await c.Db.Clientes.FindAsync(1))!.Status);

        await c.Configuracoes.SalvarAsync(new ConfiguracaoEntradaDto(2m, 0.033m, 15m, 3m), Cenario.Admin, default);

        Assert.Equal(StatusCliente.Vermelho, (await c.Db.Clientes.FindAsync(1))!.Status);
    }

    [Fact]
    public async Task Configuracoes_validam_os_limites()
    {
        var c = new Cenario();
        var erro = await Assert.ThrowsAsync<ErroDeNegocio>(() => c.Configuracoes.SalvarAsync(
            new ConfiguracaoEntradaDto(25m, 2m, 0m, 20m), Cenario.Admin, default));
        Assert.Equal("VALIDACAO", erro.Codigo);
        Assert.Equal(4, erro.Erros!.Count);
    }

    [Fact]
    public async Task Novo_contrato_gera_a_primeira_cobranca_e_encerrar_cancela_as_que_nao_venceram()
    {
        var c = new Cenario();
        var agora = c.Relogio.AgoraUtc;
        c.Db.Clientes.Add(new Cliente
        {
            Id = 1, Nome = "Cliente Novo", Documento = "30512441000133", Email = "novo@exemplo.test",
            Ativo = true, Status = StatusCliente.Verde, StatusDesde = agora, CriadoEm = agora
        });
        c.Db.SaveChanges();

        var contrato = await c.Contratos.CriarAsync(
            new ContratoEntradaDto(1, "Assessoria mensal", 3000m, 20, Cenario.Hoje), Cenario.Admin, default);
        Assert.Equal("CT-2026-001", contrato.Numero);

        var geradas = await c.Db.Parcelas.Where(p => p.ContratoId == contrato.Id).ToListAsync();
        Assert.NotEmpty(geradas);
        Assert.All(geradas, p => Assert.Equal(3000m, p.ValorOriginal));

        var encerrado = await c.Contratos.EncerrarAsync(contrato.Id, Cenario.Admin, default);
        Assert.False(encerrado.Ativo);
        Assert.DoesNotContain(
            await c.Db.Parcelas.Where(p => p.ContratoId == contrato.Id).ToListAsync(),
            p => p.Status == StatusParcela.Aberta && p.DataVencimento > Cenario.Hoje);
    }

    [Fact]
    public async Task Cadastro_de_cliente_valida_documento_e_duplicidade()
    {
        var c = new Cenario();
        var invalido = await Assert.ThrowsAsync<ErroDeNegocio>(() => c.Clientes.CriarAsync(
            new ClienteEntradaDto("Fulano de Tal", "123", "fulano@exemplo.test", null, null, null), Cenario.Admin, default));
        Assert.True(invalido.Erros!.ContainsKey("documento"));

        var dto = new ClienteEntradaDto("Empresa Teste Ltda.", "11.222.333/0001-81", "contato@teste.test", null, null, null);
        var criado = await c.Clientes.CriarAsync(dto, Cenario.Admin, default);
        Assert.Equal("11222333000181", criado.Documento);
        Assert.Equal(StatusCliente.Verde, criado.Status);

        var duplicado = await Assert.ThrowsAsync<ErroDeNegocio>(() => c.Clientes.CriarAsync(dto, Cenario.Admin, default));
        Assert.Equal("Já existe um cliente com este documento.", duplicado.Erros!["documento"]);
    }
}
