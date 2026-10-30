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
    // categorias retráteis
    await pg.setViewportSize({ width: 1440, height: 900 }); await pg.goto(url + '#/painel'); await pg.waitForSelector('.menu p.grupo'); await pg.evaluate(() => App.menuRecolhido(false));
    const grupo = '.menu p.grupo[data-grupo="2 · Precificar"]';
    await pg.click(grupo); await pg.waitForTimeout(150);
    ok(await pg.locator('.menu a[data-rota=precificacao]').isHidden() && await pg.getAttribute(grupo, 'aria-expanded') === 'false' && await pg.locator('.menu a[data-rota=quadros]').isVisible(), 'recolhe só as ferramentas da categoria');
    await pg.reload(); await pg.waitForSelector(grupo); ok(await pg.locator('.menu a[data-rota=precificacao]').isHidden(), 'lembra a categoria recolhida');
    await pg.goto(url + '#/precificacao'); await pg.waitForTimeout(200); ok(await pg.locator('.menu a[data-rota=precificacao]').isVisible() && await pg.locator('.menu a[data-rota=cotacoes]').isHidden(), 'a ferramenta aberta continua visível na categoria recolhida');
    await pg.focus(grupo); await pg.keyboard.press('Enter'); await pg.waitForTimeout(150); ok(await pg.locator('.menu a[data-rota=cotacoes]').isVisible(), 'abre a categoria pelo teclado');
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
