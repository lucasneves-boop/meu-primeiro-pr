// Menu lateral retrátil: recolhe para só os ícones, lembra a escolha e some no celular.
// Uso: node testes/menu.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t;
  try {
    await pg.goto(url); await pg.waitForSelector('#recolher-menu');
    const larg = () => pg.evaluate(() => Math.round(document.querySelector('.lateral').getBoundingClientRect().width));
    ok(await larg() === 236, 'menu começa aberto');
    await pg.click('#recolher-menu'); await pg.waitForTimeout(300);
    ok(await larg() === 68, 'recolhe para a faixa de ícones');
    ok((await pg.locator('.menu a[data-rota=cadastrar] .rot').boundingBox()).width <= 1 && await pg.locator('.menu a[data-rota=cadastrar] .ic').isVisible(), 'nomes escondidos (continuam para leitor de tela), ícones visíveis');
    ok(await pg.getAttribute('.menu a[data-rota=cadastrar]', 'title') === 'Seven Proposta', 'nome aparece ao passar o mouse');
    ok(await pg.locator('.marca-7').isVisible() && !(await pg.locator('.marca-logo').isVisible()), 'logo vira o 7');
    ok(await pg.getAttribute('#recolher-menu', 'aria-expanded') === 'false', 'botão informa o estado');
    await foto('menu-recolhido');
    await pg.click('.menu a[data-rota=cadastrar]'); await pg.waitForFunction(() => location.hash === '#/cadastrar'); ok(true, 'navega pelo menu recolhido');
    await pg.reload(); await pg.waitForSelector('#recolher-menu'); await pg.waitForTimeout(300);
    ok(await larg() === 68, 'lembra a escolha ao recarregar');
    await pg.click('#recolher-menu'); await pg.waitForTimeout(300);
    ok(await larg() === 236 && (await pg.locator('.menu a[data-rota=cadastrar] .rot').boundingBox()).width > 40, 'expande de novo com os nomes');
    ok(await pg.getAttribute('.menu a[data-rota=cadastrar]', 'title') === null, 'sem dica duplicada no menu aberto');
    await pg.click('#recolher-menu'); await pg.setViewportSize({ width: 390, height: 800 });
    ok(!(await pg.locator('#recolher-menu').isVisible()), 'no celular o botão de recolher some');
    await pg.click('#abrir-menu'); await pg.waitForTimeout(300);
    ok((await pg.locator('.menu a[data-rota=cadastrar] .rot').boundingBox()).width > 40, 'no celular o menu abre completo mesmo recolhido no computador');
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
