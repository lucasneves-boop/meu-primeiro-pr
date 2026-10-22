// Precificação › Vários itens: colar do Excel, parâmetros globais, item individual, ações em lote e proposta.
const path = require('path');
const { abrir } = require('./apoio.cjs');
(async () => {
  const t = await abrir(path.join(process.env.SAIDA || '/tmp', 'planilha'));
  const { pg, url, ok, foto } = t;
  await pg.goto(url + '#/painel'); await pg.waitForSelector('#conteudo');
  await pg.evaluate(() => { Dados.e.empresas.push({ id: 'emp1', razao: 'Cliente Teste LTDA', cnpj: '12345678000190', uf: 'GO', municipio: 'Catalão', representante: 'Fulano' }); Dados.e.empresaAtiva = 'emp1'; Dados.salvar(); });
  await pg.goto(url + '#/precificacao/lote'); await pg.waitForSelector('.pp-inicio');
  await pg.click('[data-a=colar]');
  await pg.fill('.modal [name=t]', 'Item\tLote\tDescrição\tUnidade\tQuantidade\tCusto\tReferência\n1\t1\tCaneta azul\tUN\t100\t1,20\t2,50\n2\t1\tPapel A4 resma\tRM\t50\t22,00\t30,00\n3\t2\tGrampeador\tUN\t10\t15,00\t18,00\n4\t2\tToner\tUN\t2\t\t300,00');
  await pg.click('.modal [type=submit]'); await pg.waitForSelector('.pp-tab tbody tr');
  ok(await pg.locator('.pp-tab tbody tr').count() === 4, '4 itens colados do Excel');
  const unit = async k => (await pg.locator('.pp-tab tbody tr').nth(k).locator('[data-c=unitario]').textContent()).trim();
  const antes = await unit(0);
  ok(/R\$/.test(antes), 'preço calculado para todos os itens ao mesmo tempo');
  ok((await pg.locator('.pp-tab tbody tr').nth(3).locator('[data-c=status]').textContent()).includes('Falta custo'), 'item sem custo sinalizado');
  // global: muda a margem e todos mudam
  await pg.fill('#pp-glob [name=margem]', '20'); await pg.waitForTimeout(300);
  ok(await unit(0) !== antes, 'margem global recalcula todos os itens');
  ok((await pg.locator('.pp-tab tbody tr').nth(2).locator('[data-c=status]').textContent()).includes('Revisar'), 'grampeador acima da referência marcado para revisar');
  // individual: grampeador com margem 2%
  await pg.locator('.pp-tab tbody tr').nth(2).locator('[data-a=individual]').click(); await pg.waitForSelector('#pp-ind-res .p-preco');
  await pg.check('.modal [name=individual]'); await pg.fill('.modal [name=p_margem]', '2'); await pg.fill('.modal [name=marca]', 'Marca X');
  await pg.waitForTimeout(200); await foto('planilha-individual');
  await pg.click('.modal [type=submit]'); await pg.waitForTimeout(300);
  ok(await pg.locator('.pp-tab tbody tr.pp-ind').count() === 1, 'item marcado como individual');
  ok(!(await pg.locator('.pp-tab tbody tr').nth(2).locator('[data-c=status]').textContent()).includes('Revisar'), 'grampeador cabe na referência com margem individual');
  // preço-alvo no papel
  await pg.locator('.pp-tab tbody tr').nth(1).locator('[data-k=modo]').selectOption('preco'); await pg.waitForSelector('.pp-tab tbody tr >> nth=1 >> [data-k=alvo]:not([disabled])');
  await pg.locator('.pp-tab tbody tr').nth(1).locator('[data-k=alvo]').fill('29,90'); await pg.waitForTimeout(300);
  ok(await unit(1) === 'R$ 29,90'.replace(' ', ' ') || /29,90/.test(await unit(1)), 'preço-alvo respeitado');
  // ações em lote: selecionar dois e definir lote
  await pg.locator('.pp-tab tbody tr').nth(0).locator('[data-sel]').check(); await pg.locator('.pp-tab tbody tr').nth(1).locator('[data-sel]').check();
  await pg.click('[data-a=lote-lote]'); await pg.fill('.modal [name=l]', 'A'); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => Dados.e.planilhasPreco[0].itens.filter(i => i.lote === 'A').length) === 2, 'lote definido para os selecionados');
  ok(/Valor global por extenso/.test(await pg.textContent('#pp-res')), 'valor global por extenso');
  ok(await pg.locator('.pp-totais .pp-card').count() === 6, 'cartões de totais');
  await foto('planilha');
  // criar proposta no Cadastrar
  await pg.click('[data-a=aplicar]'); await pg.waitForTimeout(150); if (await pg.locator('.modal [type=submit]').count()) await pg.click('.modal [type=submit]');
  await pg.waitForFunction(() => /cadastrar\/proposta/.test(location.hash));
  const p = await pg.evaluate(() => Dados.e.propostas[0]);
  ok(p.itens.length === 3 && p.itens.every(i => i.unitario > 0), 'proposta criada com os 3 itens precificados');
  ok(p.itens.find(i => i.numero == 3).marca === 'Marca X', 'marca do item levada para a proposta');
  // celular
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.goto(url + '#/precificacao/lote'); await pg.waitForSelector('.pp-tab');
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'sem rolagem horizontal da página no celular');
  await t.fechar();
})().catch(e => { console.error(e); process.exit(1); });
