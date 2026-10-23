// Calculadora flutuante: abre em qualquer tela, calcula, insere o resultado no campo, arrasta e continua aberta.
// Uso: node testes/calc-flutuante.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t;
  try {
    await pg.goto(url + '#/precificacao'); await pg.waitForSelector('#botao-calc');
    await pg.click('#botao-calc'); await pg.waitForSelector('#calc-flutuante:not([hidden])');
    ok(await pg.evaluate(() => document.activeElement.classList.contains('cf-expr')), 'abre pelo botão do topo com o cursor no visor');
    for (const k of ['1', '2', '5', '0', '×', '1', ',', '1']) await pg.click('#calc-flutuante [data-t="' + k + '"]');
    ok((await pg.textContent('.cf-prev')).includes('1.375'), 'prévia do resultado enquanto digita');
    await pg.click('#calc-flutuante [data-t="="]'); ok(await pg.inputValue('.cf-expr') === '1375', 'calcula 1250 × 1,1 = 1375');
    ok(/1250×1,1/.test(await pg.textContent('.cf-hist')), 'conta vai para o histórico');
    // digitar direto e usar em outra tela
    await pg.fill('.cf-expr', '10%*3000'); await pg.press('.cf-expr', 'Enter'); ok(await pg.inputValue('.cf-expr') === '300', 'digitar no visor e Enter');
    await pg.goto(url + '#/config'); await pg.waitForSelector('[name=responsavel]');
    ok(await pg.locator('#calc-flutuante:not([hidden])').count() === 1, 'continua aberta ao trocar de ferramenta');
    await pg.click('[name=responsavel]'); await pg.fill('[name=responsavel]', '');
    await pg.click('[data-cf=inserir]'); ok(await pg.inputValue('[name=responsavel]') === '300', 'insere o resultado no campo em que você estava');
    // arrastar
    const a = await pg.locator('.cf-barra').boundingBox(); await pg.mouse.move(a.x + 60, a.y + 12); await pg.mouse.down(); await pg.mouse.move(a.x - 400, a.y + 220, { steps: 8 }); await pg.mouse.up();
    const b = await pg.locator('#calc-flutuante').boundingBox(); ok(b.x < a.x - 300 && b.y > a.y + 150, 'arrasta pela barra');
    await foto('calc-flutuante');
    // minimizar, recarregar, atalho
    await pg.click('[data-cf=min]'); ok(await pg.locator('.cf-corpo').isHidden(), 'minimiza');
    await pg.reload(); await pg.waitForSelector('#calc-flutuante'); const c = await pg.locator('#calc-flutuante').boundingBox();
    ok(Math.abs(c.x - b.x) < 3 && Math.abs(c.y - b.y) < 3 && await pg.locator('.cf-corpo').isHidden(), 'lembra posição e estado ao recarregar');
    await pg.click('[data-cf=min]'); await pg.click('[data-cf=fechar]'); ok(await pg.locator('#calc-flutuante').isHidden(), 'fecha');
    await pg.click('body'); await pg.keyboard.press('Alt+KeyC'); await pg.waitForSelector('#calc-flutuante:not([hidden])'); ok(true, 'Alt+C abre');
    await pg.keyboard.press('Escape'); await pg.waitForSelector('#calc-flutuante', { state: 'hidden' }); ok(true, 'Esc fecha');
    await pg.goto(url + '#/calculadora'); await pg.click('[data-janela]'); await pg.waitForSelector('#calc-flutuante:not([hidden])'); ok(true, 'a Seven Calculadora abre a janela flutuante');
    await pg.setViewportSize({ width: 390, height: 800 }); await pg.waitForTimeout(200); const m = await pg.locator('#calc-flutuante').boundingBox(); ok(m.x >= 0 && m.x + m.width <= 390, 'no celular cabe na tela');
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
