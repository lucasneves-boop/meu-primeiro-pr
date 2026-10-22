const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/comercial.js');

const neg = (o) => Object.assign({ mensalidade: 2000, meses: 12, implantacao: 1000, criadoEm: '2026-08-01' }, o);
test('funil: pipeline, ponderado, win rate, ciclo, conversão por etapa e velocidade', () => {
  const N = [
    neg({ etapa: 'proposta', historicoEtapas: [{ etapa: 'lead' }, { etapa: 'contato' }, { etapa: 'diagnostico' }, { etapa: 'estudo' }], atualizadoEm: '2026-10-20' }),
    neg({ etapa: 'contato', historicoEtapas: [{ etapa: 'lead' }], atualizadoEm: '2026-09-01' }),
    neg({ etapa: 'ganho', historicoEtapas: [{ etapa: 'lead' }, { etapa: 'contato' }, { etapa: 'diagnostico' }, { etapa: 'estudo' }, { etapa: 'proposta' }, { etapa: 'negociacao' }], fechadoEm: '2026-10-01' }),
    neg({ etapa: 'perdido', historicoEtapas: [{ etapa: 'lead' }, { etapa: 'contato' }, { etapa: 'diagnostico' }], motivoPerda: 'Preço' })
  ];
  assert.equal(C.valorNegocio(N[0]), 25000);
  const m = C.metricas(N, '2026-10-21');
  assert.deepEqual([m.abertos, m.pipeline, m.ponderado, m.ganhos, m.perdidos, m.win, m.ciclo, m.ticket], [2, 50000, 17500, 1, 1, 0.5, 61, 25000]);
  assert.equal(m.conversao[0].taxa, 1); assert.equal(m.conversao[1].taxa, 0.75, '3 de 4 que fizeram contato chegaram ao diagnóstico');
  assert.equal(m.conversao[2].taxa, 2 / 3); assert.deepEqual(m.motivos, { 'Preço': 1 });
  assert.equal(m.velocidade, C.metricas(N, '2026-10-21').velocidade); assert.equal(m.velocidade, Math.round(2 * 0.5 * 25000 / 61 * 100) / 100);
  assert.equal(m.parados.length, 1, 'parado há mais de 14 dias'); assert.equal(m.ganhosMes, 1); assert.equal(m.receitaMes, 2000);
});

test('ICP, cadência em dias úteis, scripts e ROI', () => {
  assert.deepEqual(C.icp({ icp: { vendeGoverno: true, semEquipe: true, dorDeclarada: true, decisor: true, mercadoAtrativo: true } }), { pontos: 85, faixa: 'A' });
  assert.equal(C.icp({ icp: { vendeGoverno: true } }).faixa, 'C');
  const cad = C.gerarCadencia('outbound', '2026-10-23'); // sexta
  assert.equal(cad[0].data, '2026-10-23'); assert.equal(cad[2].data, '2026-10-27', '2 dias úteis depois de sexta = terça'); assert.equal(cad.length, 8);
  assert.equal(C.preencher('Olá {{nome}}, vi {{n}} licitações', { nome: 'Ana', n: 12 }), 'Olá Ana, vi 12 licitações');
  assert.equal(C.preencher('{{x}}', {}), '[x]', 'variável sem valor fica visível para revisar');
  const r = C.roi({ mensalidade: 2500, implantacao: 0, salarioAnalista: 4000, encargos: 1.8, ferramentas: 300, mercadoAnual: 5000000, participacao: 3, margem: 20, percExito: 2 });
  assert.deepEqual([r.custoBPO, r.custoInterno, r.economia, r.receita, r.lucro, r.custoExito, r.custoTotal, r.retorno, r.paybackMeses], [30000, 90000, 60000, 150000, 30000, 3000, 33000, 0.91, 12]);
});

test('cartão CNPJ e palavras-chave', () => {
  const cartao = `REPÚBLICA FEDERATIVA DO BRASIL
CADASTRO NACIONAL DA PESSOA JURÍDICA
NÚMERO DE INSCRIÇÃO
11.222.333/0001-81
MATRIZ
COMPROVANTE DE INSCRIÇÃO E DE SITUAÇÃO CADASTRAL
DATA DE ABERTURA
15/03/2015
NOME EMPRESARIAL
PAPELARIA EXEMPLO LTDA
TÍTULO DO ESTABELECIMENTO (NOME DE FANTASIA)
PAPELARIA EXEMPLO
PORTE
ME
CÓDIGO E DESCRIÇÃO DA ATIVIDADE ECONÔMICA PRINCIPAL
47.61-0-03 - Comércio varejista de artigos de papelaria
CÓDIGO E DESCRIÇÃO DAS ATIVIDADES ECONÔMICAS SECUNDÁRIAS
46.47-8-01 - Comércio atacadista de artigos de escritório e de papelaria
47.51-2-01 - Comércio varejista especializado de equipamentos e suprimentos de informática
CÓDIGO E DESCRIÇÃO DA NATUREZA JURÍDICA
206-2 - Sociedade Empresária Limitada
MUNICÍPIO
CATALAO
UF
GO
SITUAÇÃO CADASTRAL
ATIVA`;
  const r = C.lerCartaoCNPJ(cartao);
  assert.deepEqual([r.cnpj, r.razao, r.fantasia, r.porte, r.municipio, r.uf, r.abertura, r.situacao], ['11222333000181', 'PAPELARIA EXEMPLO LTDA', 'PAPELARIA EXEMPLO', 'ME', 'CATALAO', 'GO', '2015-03-15', 'ATIVA']);
  assert.deepEqual(r.cnaePrincipal, { codigo: '47.61-0-03', descricao: 'Comércio varejista de artigos de papelaria' }); assert.equal(r.cnaesSecundarios.length, 2);
  const pk = C.palavrasChave([r.cnaePrincipal.descricao, 'papel A4, toner, cartucho, caneta, grampeador', r.cnaesSecundarios.map(x => x.descricao).join(' ')]);
  assert.equal(pk[0], 'papelaria'); assert.ok(pk.includes('toner') && pk.includes('informatica')); assert.ok(!pk.includes('comercio') && !pk.includes('varejista'));
});

test('estudo de mercado: números, concorrentes, ABC, deságio, duas estimativas, confiança e decisão', () => {
  const compras = []; for (let i = 0; i < 40; i++) compras.push({ orgao: i < 20 ? 'Prefeitura A' : 'Órgão ' + i, uf: i % 2 ? 'GO' : 'DF', modalidade: 'Pregão - Eletrônico', esfera: i % 3 ? 'M' : 'E', publicacao: '2026-0' + (1 + i % 6) + '-10', valorEstimado: 120000, valorHomologado: i < 36 ? 100000 : 0 });
  const am = []; for (let i = 0; i < 40; i++) am.push({ cnpjFornecedor: i < 20 ? '111' : i < 30 ? '222' : '3' + i, fornecedor: i < 20 ? 'Alfa' : i < 30 ? 'Beta' : 'F' + i, total: 1000, unitario: 80, referencia: 100, porte: i < 20 ? 3 : 1 });
  const a = C.analisarEstudo({ compras, amostras: am, abertas: [{ valorEstimado: 50000 }, { valorEstimado: 70000 }], cliente: { cnpj: '222', porte: 'ME' }, meses: 6 });
  assert.deepEqual([a.numeros.certames, a.numeros.homologados, a.numeros.totalHomologado, a.numeros.ticket, a.numeros.mercadoAnual, a.numeros.certamesAno, a.numeros.abertasValor], [40, 36, 3600000, 100000, 7200000, 72, 120000]);
  assert.equal(a.orgaos[0].chave, 'Prefeitura A'); assert.equal(a.orgaos[0].classe, 'A');
  assert.equal(a.concorrentes[0].nome, 'Alfa'); assert.equal(a.concorrentes[0].participacao, 0.5); assert.equal(a.concorrentes[0].mepp, false); assert.equal(a.concorrentes[1].mepp, true);
  assert.ok(Math.abs(a.top3 - 0.775) < 1e-9); assert.ok(Math.abs(a.desagio - 0.2) < 1e-9); assert.equal(a.meppShare, 0.5);
  assert.equal(a.cliente.nome, 'Beta', 'cliente já aparece entre os vencedores');
  assert.deepEqual(a.estimativa.topDown, [144000, 432000]); assert.deepEqual(a.estimativa.bottomUp, [360000, 720000]);
  assert.equal(a.estimativa.premissas.length, 4); assert.equal(a.confianca, 'Alta');
  assert.match(a.decisao, /Entrar com foco: mercado relevante, mas concentrado/); assert.ok(a.condicoes.some(c => /deságio típico de 20%/.test(c))); assert.ok(a.condicoes.some(c => /ME\/EPP/.test(c)));
  const pequeno = C.analisarEstudo({ compras: compras.slice(0, 3), amostras: am.slice(0, 2), abertas: [], meses: 12 });
  assert.equal(pequeno.confianca, 'Baixa'); assert.match(pequeno.decisao, /Entrar com foco em órgãos|Não priorizar/);
});

test('importação: reconhece cabeçalhos variados (CRM, planilha própria, RD/Pipedrive)', () => {
  const m = C.mapearColunas(['Empresa', 'CNPJ', 'Cidade', 'Estado', 'Status', 'Valor mensal', 'Nome do contato', 'E-mail', 'Celular', 'Observações']);
  assert.deepEqual(m, { razao: 0, cnpj: 1, municipio: 2, uf: 3, etapa: 4, mensalidade: 5, contato: 6, email: 7, whatsapp: 8, observacoes: 9 });
  const so = C.mapearColunas(['Nome', 'Telefone']); assert.equal(so.razao, 0); assert.equal(so.contato, undefined);
  assert.equal(C.mapearColunas(['Razão Social', 'Nome fantasia', 'Contato']).contato, 2);
});

test('importação: etapa por texto livre, tipo Cliente, números em real e CNPJ com dígito verificador', () => {
  assert.equal(C.etapaDeTexto('Proposta enviada'), 'proposta'); assert.equal(C.etapaDeTexto('Fechado'), 'ganho'); assert.equal(C.etapaDeTexto('Reunião marcada'), 'diagnostico');
  assert.equal(C.etapaDeTexto('', 'Cliente'), 'ganho'); assert.equal(C.etapaDeTexto('', 'Lead'), 'lead'); assert.equal(C.etapaDeTexto('xyz'), 'lead');
  assert.equal(C.numeroBR('R$ 2.500,50'), 2500.5); assert.equal(C.numeroBR(''), null); assert.equal(C.numeroBR(3000), 3000);
  assert.equal(C.cnpjValido('11.222.333/0001-81'), true); assert.equal(C.cnpjValido('11.222.333/0001-82'), false); assert.equal(C.cnpjValido('00000000000000'), false);
});

test('importação: novos, atualizações, repetidos, erros e problemas por linha', () => {
  const existentes = [{ id: 'c1', razao: 'Alfa LTDA', cnpj: '11222333000181' }, { id: 'c2', razao: 'Beta Serviços', uf: 'GO' }];
  const r = C.prepararImportacao([
    ['Razão social', 'CNPJ', 'UF', 'Tipo', 'Mensalidade', 'Contato', 'E-mail'],
    ['Alfa Comércio', '11.222.333/0001-81', 'GO', 'Cliente', '3.000,00', 'Ana', 'ana@alfa.com.br'],
    ['Beta Serviços', '', 'go', 'Lead', '', '', ''],
    ['Gama', '12.345.678/0001-00', 'DF', '', '', 'Rui', 'rui@'],
    ['', '', '', '', '', 'Sem empresa', ''],
    ['Gama', '', 'DF', '', '', '', ''],
    ['', '', '', '', '', '', '']
  ], existentes);
  assert.deepEqual([r.novos, r.atualizar, r.erros], [1, 2, 2]);
  const [alfa, beta, gama, vazio, rep] = r.itens;
  assert.equal(alfa.existente, 'c1'); assert.equal(alfa.negocio.etapa, 'ganho'); assert.equal(alfa.negocio.mensalidade, 3000); assert.equal(alfa.contato.nome, 'Ana');
  assert.equal(beta.existente, 'c2'); assert.equal(beta.contato, null);
  assert.equal(gama.existente, null); assert.equal(gama.conta.cnpj, ''); assert.deepEqual(gama.problemas, ['CNPJ inválido (importado sem CNPJ)', 'e-mail inválido']);
  assert.equal(vazio.erro, 'sem nome da empresa'); assert.equal(vazio.linha, 5);
  assert.match(rep.erro, /repetida na planilha \(linha 4\)/);
});

test('exportação: uma linha por conta, tipo pelo negócio mais avançado, filtro e ida e volta', () => {
  const contas = [{ id: 'a', razao: 'Alfa LTDA', cnpj: '11222333000181', uf: 'GO', contatos: [{ nome: 'Ana', papel: 'Decisor', email: 'ana@alfa.com.br' }], criadoEm: '2026-05-01T10:00:00Z' }, { id: 'b', razao: 'Beta', contatos: [] }];
  const negocios = [{ id: 'n1', contaId: 'a', etapa: 'perdido' }, { id: 'n2', contaId: 'a', etapa: 'ganho', mensalidade: 3000, meses: 12, implantacao: 1000 }, { id: 'n3', contaId: 'b', etapa: 'proposta' }];
  const l = C.linhasExportacao(contas, negocios);
  assert.deepEqual(l[0], C.COLUNAS_EXPORT);
  assert.deepEqual(l[1].slice(0, 6), ['Cliente', 'Alfa LTDA', '', '11.222.333/0001-81', '', 'GO']); assert.equal(l[1][14], 37000); assert.equal(l[1][15], 'Ana'); assert.equal(l[1][22], '2026-05-01');
  assert.equal(l[2][0], 'Lead'); assert.equal(l[2][10], 'Proposta enviada');
  assert.equal(C.linhasExportacao(contas, negocios, 'Cliente').length, 2);
  const volta = C.prepararImportacao(l, []);
  assert.equal(volta.novos, 2); assert.equal(volta.itens[0].negocio.etapa, 'ganho'); assert.equal(volta.itens[0].negocio.mensalidade, 3000); assert.equal(volta.itens[1].negocio.etapa, 'proposta'); assert.equal(volta.itens[0].contato.email, 'ana@alfa.com.br');
});
