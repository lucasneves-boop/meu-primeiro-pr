// Quadros › Execução: vários empenhos, notas e pagamentos com vínculo NF ↔ empenho e pagamento → NF.
const path = require('path');
const { abrir } = require('./apoio.cjs');
(async () => {
  const t = await abrir(path.join(process.env.SAIDA || '/tmp', 'execucao'));
  const { pg, url, ok, foto } = t;
  await pg.goto(url + '#/quadros'); await pg.waitForSelector('.ktiles');
  await pg.click('.ktile:has-text("Licitações")'); await pg.waitForSelector('.kpagina');
  await pg.click('.klista >> nth=0 >> [data-a=compor]'); await pg.fill('.kcompositor textarea', 'Contrato papel A4'); await pg.keyboard.press('Enter'); await pg.keyboard.press('Escape');
  await pg.click('.kcartao:has-text("papel")'); await pg.waitForSelector('#kov .kjanela');
  await pg.click('[data-k=execucao]'); await pg.waitForSelector('.ex-secao');
  ok(await pg.locator('.ex-secao').count() === 3, 'seções de empenhos, notas fiscais e pagamentos');
  await pg.fill('.modal [name=numero]', 'CT 12/2026'); await pg.fill('.modal [name=valor]', '10.000,00');
  const add = async (tipo, valores) => {
    await pg.click('[data-ex-add=' + tipo + ']');
    const ln = pg.locator('.ex-secao[data-ex=' + tipo + '] .ex-corpo .ex-linha').last();
    for (const [c, v] of Object.entries(valores)) await ln.locator('[data-c=' + c + ']').fill(v);
    return ln;
  };
  await add('empenhos', { numero: '2026NE001', data: '2026-09-01', valor: '6.000,00' });
  await add('empenhos', { numero: '2026NE002', data: '2026-09-15', valor: '4.000,00' });
  await add('notas', { numero: '101', data: '2026-09-10', atesto: '2026-09-12', valor: '2.500,00' });
  await add('notas', { numero: '102', data: '2026-09-20', valor: '4.000,00' });
  await pg.waitForTimeout(400);
  // NF 101 → empenho 1 pela própria nota
  await pg.locator('.ex-secao[data-ex=notas] .ex-linha').nth(1).locator('select[data-c=empenhoId]').selectOption({ label: '2026NE001' });
  // NF 102 → empenho 2 a partir do empenho
  await pg.locator('.ex-secao[data-ex=empenhos] .ex-corpo .ex-linha').nth(1).locator('.ex-nfs summary').click();
  await pg.locator('.ex-secao[data-ex=empenhos] .ex-corpo .ex-linha').nth(1).locator('[data-ex-nf]').nth(1).check();
  ok(await pg.locator('.ex-secao[data-ex=notas] .ex-linha').nth(2).locator('select[data-c=empenhoId] option:checked').textContent() === '2026NE002', 'vincular a NF pelo empenho atualiza a nota');
  ok((await pg.locator('.ex-secao[data-ex=empenhos] .ex-corpo .ex-linha').nth(0).locator('.ex-nfs summary').textContent()) === 'NF 101', 'empenho mostra a NF vinculada pela nota');
  const pgto = await add('pagamentos', { data: '2026-10-05', valor: '2.500,00', obs: 'OB 778' });
  await pg.waitForTimeout(400);
  await pgto.locator('select[data-c=notaId]').selectOption({ index: 1 });
  await foto('execucao-modal');
  await pg.click('.modal [type=submit]'); await pg.waitForSelector('.ex-lista');
  const x = await pg.evaluate(() => Dados.e.quadros.flatMap(q => q.cartoes).find(c => /papel/.test(c.titulo)).execucao);
  ok(x.empenhos.length === 2 && x.notas.length === 2 && x.pagamentos.length === 1, 'dois empenhos, duas notas e um pagamento salvos');
  ok(x.notas[0].empenhoId === x.empenhos[0].id && x.notas[1].empenhoId === x.empenhos[1].id, 'cada NF ligada ao seu empenho');
  ok(x.pagamentos[0].notaId === x.notas[0].id && x.pagamentos[0].ref === '101', 'pagamento ligado à NF 101');
  ok(x.notas[0].vencimento === '2026-10-12', 'vencimento calculado pelo atesto + 30 dias');
  const txt = await pg.textContent('#kov .kjanela');
  ok(/2026NE001.*NF: 101/.test(txt) && /NF 101.*Paga/.test(txt), 'resumo mostra vínculos e status da NF');
  await foto('execucao-resumo');
  // editar de novo mantém os vínculos
  await pg.click('[data-k=execucao]'); await pg.waitForSelector('.ex-secao');
  ok(await pg.locator('.ex-secao[data-ex=pagamentos] select[data-c=notaId] option:checked').textContent() !== 'Sem nota', 'vínculos reabertos no editor');
  await pg.locator('.ex-secao[data-ex=notas] .ex-tirar').nth(1).click();
  await pg.click('.modal [type=submit]'); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => Dados.e.quadros.flatMap(q => q.cartoes).find(c => /papel/.test(c.titulo)).execucao.notas.length) === 1, 'remover nota fiscal');
  await t.fechar();
})().catch(e => { console.error(e); process.exit(1); });
