// Meus Avisos (filtros estilo Effecti e valor por item/grupo/lote), anotações da oportunidade,
// peças jurídicas por categoria e calculadora de custo de viagem.
const path = require('path');
const { abrir } = require('./apoio.cjs');

(async () => {
  const t = await abrir(path.join(process.env.SAIDA || '/tmp', 'avisos'));
  const { pg, url, ok, foto } = t;
  const futuro = new Date(Date.now() + 5 * 864e5).toISOString();
  // itens do PNCP simulados: o aviso "a" tem um lote de R$ 500 e um item de R$ 1.000
  await pg.route('**/api/pncp/v1/**', r => {
    const u = r.request().url();
    if (/\/itens\?/.test(u)) {
      const a = /11111111000111/.test(u);
      return r.fulfill({ json: a ? [{ numeroItem: 1, descricao: 'LOTE 01 - Caneta azul', quantidade: 100, unidadeMedida: 'UN', valorUnitarioEstimado: 2, valorTotal: 200, tipoBeneficio: 1 }, { numeroItem: 2, descricao: 'Lote 1: Caneta preta', quantidade: 100, unidadeMedida: 'UN', valorUnitarioEstimado: 3, valorTotal: 300, tipoBeneficio: 1 }, { numeroItem: 3, descricao: 'Papel A4', quantidade: 40, unidadeMedida: 'RM', valorUnitarioEstimado: 25, valorTotal: 1000, tipoBeneficio: 1 }]
        : [{ numeroItem: 1, descricao: 'Notebook', quantidade: 10, unidadeMedida: 'UN', valorUnitarioEstimado: 5000, valorTotal: 50000, tipoBeneficio: 4 }] });
    }
    return r.fulfill({ json: [] });
  });
  await pg.goto(url + '#/painel'); await pg.waitForSelector('#conteudo');
  await pg.evaluate(f => {
    const e = Dados.e;
    e.empresas.push({ id: 'emp1', razao: 'Cliente Teste LTDA', cnpj: '12345678000190', uf: 'GO', municipio: 'Catalão' }); e.empresaAtiva = 'emp1';
    e.perfis.push({ id: 'p1', nome: 'Expediente', ativo: true, catalogoIds: [] }, { id: 'p2', nome: 'Informática', ativo: true, catalogoIds: [] });
    const base = { lido: false, favorito: false, lixeira: false, anotacoes: [], encerramento: f, publicacao: '2026-10-05T10:00:00', capturadoEm: '2026-10-10T10:00:00Z', edital: 'https://pncp.gov.br/app/editais/x', ano: 2026, seq: 1 };
    e.avisos.a = Object.assign({}, base, { id: 'a', cnpj: '11111111000111', objeto: 'Material de expediente', orgao: 'Prefeitura de Catalão', municipio: 'Catalão', uf: 'GO', esfera: 'M', modalidadeId: 6, modalidade: 'Pregão - Eletrônico', sistema: 'BLL', numero: '10/2026', valorEstimado: 1500, perfis: ['p1'], produtos: ['caneta'], anotacoes: [{ texto: 'Nota antiga do aviso', em: '2026-10-01T10:00:00Z', por: 'Lucas' }] });
    e.avisos.b = Object.assign({}, base, { id: 'b', cnpj: '22222222000122', objeto: 'Aquisição de notebooks', orgao: 'Governo de Goiás', municipio: 'Goiânia', uf: 'GO', esfera: 'E', modalidadeId: 8, modalidade: 'Dispensa', sistema: 'Compras.gov.br', numero: '55/2026', valorEstimado: 50000, perfis: ['p2'], produtos: ['notebook'] });
    e.avisos.c = Object.assign({}, base, { id: 'c', cnpj: '33333333000133', objeto: 'Notebook para o TRE', orgao: 'TRE-DF', municipio: 'Brasília', uf: 'DF', esfera: 'F', modalidadeId: 6, modalidade: 'Pregão - Eletrônico', valorEstimado: 300000, perfis: ['p2'], produtos: ['notebook'] });
    Dados.salvar();
  }, futuro);
  await pg.goto(url + '#/encontrar/avisos'); await pg.waitForSelector('.ma-grade');
  ok(await pg.locator('.ma-aba').count() === 5, 'abas Todos, Não lidos, Favoritos, Órgãos favoritos e Lixeira');
  ok(await pg.locator('.ma-grade .ma-r').count() >= 20, 'painel com os filtros do Meus Avisos');
  ok(await pg.locator('.aviso').count() === 3, '3 avisos sem filtro');
  await foto('avisos-painel');

  // seleção múltipla de estado
  await pg.click('.ma-c:has(.ma-r:text("Estado")) summary'); await pg.check('.ma-c:has(.ma-r:text("Estado")) input[value="DF"]');
  ok((await pg.textContent('.ma-c:has(.ma-r:text("Estado")) summary')).trim() === 'DF', 'resumo da seleção mostra DF');
  await pg.click('.ma-rodape [type=submit]'); await pg.waitForTimeout(100);
  ok(await pg.locator('.aviso').count() === 1, 'filtro por estado (DF)');
  ok(await pg.locator('[data-a=painel] .ma-n').textContent() === '1', 'contador de filtros ativos');
  await pg.click('[data-a=limpar]'); await pg.waitForTimeout(100);
  ok(await pg.locator('.aviso').count() === 3, 'Limpar volta a mostrar tudo');

  // portal + valor total
  await pg.fill('[name=valorMin]', '10.000'); await pg.click('.ma-rodape [type=submit]'); await pg.waitForTimeout(100);
  ok(await pg.locator('.aviso').count() === 2, 'valor total estimado mínimo');
  await pg.click('[data-a=limpar]'); await pg.waitForTimeout(100);

  // valor por grupo/lote: carrega itens do PNCP e acha o lote de R$ 500
  await pg.selectOption('[name=valorAlvo]', 'grupo'); await pg.fill('[name=itemMin]', '400'); await pg.fill('[name=itemMax]', '600');
  await pg.click('.ma-rodape [type=submit]'); await pg.waitForFunction(() => document.querySelectorAll('.aviso').length === 1, null, { timeout: 8000 });
  ok(await pg.locator('.aviso[data-id=a]').count() === 1, 'grupo/lote de R$ 500 encontrado (soma dos itens do lote 1)');
  await pg.fill('[name=itemMin]', '4.000'); await pg.fill('[name=itemMax]', ''); await pg.selectOption('[name=valorAlvo]', 'item');
  await pg.click('.ma-rodape [type=submit]'); await pg.waitForTimeout(200);
  ok(await pg.locator('.aviso[data-id=a]').count() === 0 && await pg.locator('.aviso').count() === 2, 'valor unitário do item acima de R$ 4.000');
  ok(await pg.evaluate(() => Dados.e.avisos.a.meEpp) === 'Exclusivo ME/EPP', 'ME/EPP preenchido ao carregar os itens');
  await foto('avisos-valor-item');

  // filtro customizado salvo
  await pg.click('[data-a=salvar-filtro]'); await pg.fill('.modal [name=nome]', 'Itens caros'); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(150);
  await pg.click('[data-a=limpar]'); await pg.waitForTimeout(100);
  await pg.selectOption('[name=custom]', { label: 'Itens caros' }); await pg.waitForTimeout(150);
  ok(await pg.locator('.aviso').count() === 2, 'filtro customizado reaplicado');
  await pg.click('[data-a=limpar]'); await pg.waitForTimeout(100);

  // anotações: migra a antiga, acrescenta e acompanha até o Cadastrar
  await pg.click('.aviso[data-id=a] [data-a=anotar]'); await pg.waitForSelector('.modal .op-secao');
  ok((await pg.textContent('.op-notas')).includes('Nota antiga do aviso'), 'anotação antiga do aviso migrada');
  await pg.fill('.op-form textarea', 'Cliente pediu para cotar só o lote 1'); await pg.click('.op-form .btn');
  await pg.waitForFunction(() => document.querySelectorAll('.op-notas li').length === 2);
  await foto('anotacoes-oportunidade');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  ok((await pg.textContent('.aviso[data-id=a] [data-a=anotar]')).includes('(2)'), 'contador de anotações no cartão');
  await pg.fill('.ma-topo [name=texto]', 'lote 1'); await pg.click('.ma-rodape [type=submit]'); await pg.waitForTimeout(150);
  ok(await pg.locator('.aviso').count() === 1, 'busca por palavras também procura nas anotações');
  await pg.click('[data-a=limpar]'); await pg.waitForTimeout(100);
  await pg.click('.aviso[data-id=a] [data-a=cadastrar]'); await pg.waitForSelector('.op-secao');
  ok((await pg.textContent('.op-secao')).includes('Cliente pediu para cotar só o lote 1'), 'anotação aparece na proposta (Cadastrar)');
  await pg.fill('.op-form textarea', 'Proposta revisada com o cliente'); await pg.click('.op-form .btn');
  await pg.waitForFunction(() => document.querySelectorAll('.op-notas li').length === 3);
  ok(await pg.evaluate(() => Dados.e.notasOport.a.length) === 3, 'mesma linha do tempo do aviso');

  // peças jurídicas por categoria
  await pg.goto(url + '#/pecas'); await pg.waitForSelector('.pc-cats');
  ok(await pg.locator('.pc-cat').count() === 7, 'categorias: todas + impugnação, esclarecimento, intenção, recurso, contrarrazões, execução');
  await pg.click('.pc-cat[data-cat=intencao]'); await pg.click('[data-a=nova]'); await pg.waitForSelector('#pc-modelo');
  ok(await pg.inputValue('#pc-modelo') === 'intencao', 'nova peça já abre no modelo da categoria');
  await pg.click('.modal [type=submit]'); await pg.waitForSelector('#pc-texto');
  ok((await pg.inputValue('#pc-texto')).startsWith('INTENÇÃO DE RECURSO'), 'peça de intenção de recurso gerada');
  await pg.goto(url + '#/pecas'); await pg.waitForSelector('.pc-cats');
  await pg.click('.pc-cat[data-cat=recurso]'); await pg.waitForTimeout(100);
  ok(await pg.locator('tr[data-id]').count() === 0, 'categoria Recurso vazia');
  await pg.click('.pc-cat[data-cat=intencao]'); await pg.waitForTimeout(100);
  ok(await pg.locator('tr[data-id]').count() === 1, 'categoria Intenção de recurso com 1 peça');
  await foto('pecas-categorias');

  // calculadora: custo de viagem
  await pg.goto(url + '#/calculadora/viagem'); await pg.waitForSelector('[name=km]');
  await pg.fill('[name=km]', '250'); await pg.fill('[name=cons]', '10'); await pg.fill('[name=preco]', '6'); await pg.fill('[name=ped]', '20'); await pg.fill('[name=extra]', '0'); await pg.waitForTimeout(200);
  const txt = await pg.textContent('#conteudo');
  ok(/R\$\s*340,00/.test(txt), 'custo de viagem ida e volta com pedágio (R$ 340,00)');
  await foto('calc-viagem');

  // celular sem rolagem horizontal
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.goto(url + '#/encontrar/avisos'); await pg.waitForSelector('.ma-grade');
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Meus Avisos sem rolagem horizontal no celular');
  await foto('avisos-celular');
  await t.fechar();
})().catch(e => { console.error(e); process.exit(1); });
