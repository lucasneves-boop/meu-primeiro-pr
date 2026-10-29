// Configurações: preferências que mudam a plataforma (cor, tamanho, menu, tela inicial, janelas, atalhos, assinatura).
// Uso: node testes/config.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t; const erros = []; pg.on('pageerror', e => erros.push(e.message));
  try {
    await pg.goto(url + '#/config'); await pg.waitForSelector('#cfg-q');
    await pg.click('.cfg-cor:has(input[value=azul])'); await pg.waitForTimeout(150);
    ok(await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ouro').trim()) === '#2f6fd6', 'cor de destaque aplicada na plataforma');
    await pg.fill('[name=p_escala]', '110'); await pg.dispatchEvent('[name=p_escala]', 'change'); await pg.waitForTimeout(150);
    ok(await pg.evaluate(() => document.documentElement.style.zoom) === '1.1', 'tamanho da interface');
    await pg.check('[name=p_densidade][value=compacta]'); ok(await pg.evaluate(() => document.documentElement.classList.contains('densidade-compacta')), 'espaçamento compacto');
    await pg.uncheck('[name=menu_jogos]'); await pg.waitForTimeout(100);
    ok(await pg.locator('.menu a[data-rota=jogos]').isHidden() && await pg.locator('.menu a[data-rota=painel]').isVisible(), 'oculta ferramenta do menu');
    await pg.uncheck('[name=jan_chat]'); ok(await pg.locator('#botao-chat').isHidden(), 'oculta botão de janela do topo');
    await pg.selectOption('[name=p_telaInicial]', 'quadros'); await pg.waitForTimeout(100);
    await pg.fill('#cfg-msg [name=assinatura]', 'Lucas Neves | Seven BPO'); await pg.waitForTimeout(100);
    ok(/Lucas Neves \| Seven BPO/.test(await pg.textContent('#cfg-previa')), 'prévia da assinatura');
    await pg.fill('#cfg-q', 'atalho'); await pg.waitForTimeout(100);
    ok(await pg.locator('#cfg-janelas').isVisible() && await pg.locator('#cfg-mensagens').isHidden(), 'procura nas configurações');
    await pg.fill('#cfg-q', ''); await pg.uncheck('[name=p_atalhos]'); await pg.waitForTimeout(100);
    await foto('config');
    // tudo continua depois de recarregar, e a plataforma abre na tela escolhida
    await pg.goto(url); await pg.waitForSelector('#conteudo'); await pg.waitForTimeout(400);
    ok(await pg.evaluate(() => App.rota().tela) === 'quadros' && await pg.locator('.menu a[data-rota=quadros].ativo').count() === 1, 'abre na tela inicial escolhida');
    ok(await pg.locator('.menu a[data-rota=jogos]').isHidden() && await pg.locator('#botao-chat').isHidden() && await pg.evaluate(() => document.documentElement.style.zoom) === '1.1', 'preferências mantidas ao recarregar');
    await pg.keyboard.press('Alt+KeyC'); await pg.waitForTimeout(200); ok(await pg.locator('#calc-flutuante:not([hidden])').count() === 0, 'atalhos desligados');
    ok(await pg.evaluate(() => Pref.rodape()) === 'Lucas Neves | Seven BPO\n(61) 98347-2232', 'assinatura usada nas mensagens');
    await pg.goto(url + '#/config'); await pg.waitForSelector('#cfg-q'); await pg.click('[data-a=menu-todos]'); await pg.waitForTimeout(150); ok(await pg.locator('.menu a[data-rota=jogos]').isVisible(), 'mostrar todas as ferramentas de novo');
    ok(!erros.length, 'sem erros na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
