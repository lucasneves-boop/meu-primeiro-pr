// Fundo animado (estilo PS4): anima, reage ao mouse, troca em Configurações e lembra a escolha.
// Uso: node testes/fundo.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t;
  const amostra = () => pg.evaluate(() => { const c = document.getElementById('fundo-animado'); const g = c.getContext('2d'); const d = g.getImageData(0, Math.round(c.height * 0.62), c.width, 1).data; let s = 0; for (let i = 0; i < d.length; i += 16) s += d[i] * 3 + d[i + 1] * 7 + d[i + 2]; return s; });
  try {
    await pg.goto(url); await pg.waitForSelector('#fundo-animado');
    ok(await pg.evaluate(() => Fundo.atual()) === 'ondas', 'começa com as ondas');
    const a1 = await amostra(); await pg.waitForTimeout(600); const a2 = await amostra(); ok(a1 !== a2, 'o fundo está animando');
    await pg.mouse.move(700, 560); await pg.waitForTimeout(200); await pg.mouse.click(700, 560); await pg.waitForTimeout(150);
    ok(await pg.evaluate(() => true), 'mouse e clique sem erro');
    await pg.evaluate(() => App.tema('escuro')); await pg.goto(url + '#/agenda'); await pg.waitForTimeout(800); await pg.mouse.move(900, 600); await pg.waitForTimeout(300); await foto('fundo-ondas-escuro');
    await pg.goto(url + '#/config'); await pg.waitForSelector('.fundo-opcoes');
    ok(await pg.locator('.fundo-op').count() === 5, 'cinco opções em Configurações');
    for (const m of ['particulas', 'constelacao', 'aurora']) {
      await pg.click('.fundo-op:has(input[value=' + m + '])'); await pg.waitForTimeout(500);
      ok(await pg.evaluate(() => Fundo.atual()) === m, 'troca para ' + m);
      await pg.goto(url + '#/agenda'); await pg.waitForTimeout(700); await pg.mouse.move(800, 500); await pg.waitForTimeout(300); await foto('fundo-' + m); await pg.goto(url + '#/config'); await pg.waitForSelector('.fundo-opcoes');
    }
    await pg.click('.fundo-op:has(input[value=nenhum])'); await pg.waitForTimeout(200);
    ok(!(await pg.locator('#fundo-animado').count()), 'desligado remove a animação');
    await pg.reload(); await pg.waitForSelector('.fundo-opcoes'); ok(!(await pg.locator('#fundo-animado').count()) && await pg.isChecked('input[name=fundo][value=nenhum]'), 'lembra a escolha ao recarregar');
    await pg.click('.fundo-op:has(input[value=ondas])'); await pg.waitForSelector('#fundo-animado'); ok(true, 'liga de novo');
    await pg.evaluate(() => App.tema('claro')); await pg.goto(url + '#/painel'); await pg.waitForTimeout(800); await pg.mouse.move(900, 650); await pg.waitForTimeout(300); await foto('fundo-ondas-claro');
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
