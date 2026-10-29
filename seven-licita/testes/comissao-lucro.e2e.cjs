// Seven Comissão sobre o lucro líquido: lucro em R$ ou margem em %, passo a passo da conta e a mesma conta na janela flutuante.
const path = require('path'); const { abrir } = require('./apoio.cjs');
(async () => {
  const saida = process.argv[2] || path.join(__dirname, 'capturas'); const t = await abrir(saida); const { pg, ok, url } = t; const erros = []; pg.on('pageerror', e => erros.push(e.message));
  await pg.goto(url + '#/comissao'); await pg.waitForSelector('#cm-form');
  await pg.click('#cm-form .cm-pilula:has(input[value=lucro])'); await pg.waitForTimeout(100);
  ok(await pg.locator('#cm-form [name=lucroValor]').isVisible(), 'campo de lucro em R$ aparece sobre o lucro');
  await pg.fill('#cm-form [name=pct]', '10'); await pg.fill('#cm-form [name=venda]', '200.000'); await pg.fill('#cm-form [name=alvo]', '3.000');
  await pg.fill('#cm-form [name=lucroValor]', '24.000'); await pg.waitForTimeout(150);
  ok(await pg.inputValue('#cm-form [name=margem]') === '12', 'lucro em R$ vira margem de 12%');
  const res = await pg.innerText('#cm-res');
  ok(/R\$\s?2\.400,00/.test(res) && /Como a conta foi feita/.test(res) && /R\$\s?200\.000,00 × 12% = R\$\s?24\.000,00/.test(res) && /= R\$\s?250\.000,00/.test(res), 'resultado e passo a passo');
  await pg.fill('#cm-form [name=margem]', '15'); await pg.waitForTimeout(150); ok(await pg.inputValue('#cm-form [name=lucroValor]') === '30.000,00', 'margem atualiza o lucro em R$');
  await pg.screenshot({ path: path.join(saida, 'comissao-lucro.png'), fullPage: false });
  await pg.click('#botao-comissao'); await pg.waitForSelector('#comissao-flutuante [name=lucroValor]'); ok(await pg.inputValue('#comissao-flutuante [name=lucroValor]') === '30.000,00', 'janela flutuante com o mesmo lucro');
  ok(!erros.length, 'sem erros na página'); await t.fechar();
})();
