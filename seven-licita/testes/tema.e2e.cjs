// Tema: automático, claro e escuro; a escolha vale para todas as telas e sobrevive ao recarregar.
const path = require('path');
const { abrir } = require('./apoio.cjs');
(async () => {
  const t = await abrir(path.join(process.env.SAIDA || '/tmp', 'tema'), { colorScheme: 'light' });
  const { pg, url, ok, foto } = t;
  const fundo = () => pg.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await pg.goto(url + '#/painel'); await pg.waitForSelector('#botao-tema');
  ok(await pg.evaluate(() => !document.documentElement.hasAttribute('data-theme')) && (await pg.getAttribute('#botao-tema', 'aria-label')).startsWith('Tema automático'), 'começa no automático');
  const claroSistema = await fundo();
  await pg.click('#botao-tema'); ok(await pg.getAttribute('html', 'data-theme') === 'light', 'clique: tema claro');
  await pg.click('#botao-tema'); ok(await pg.getAttribute('html', 'data-theme') === 'dark', 'clique: tema escuro');
  ok(await fundo() !== claroSistema, 'fundo muda no escuro mesmo com o sistema claro');
  await pg.click('#botao-tema'); ok(await pg.getAttribute('html', 'data-theme') === 'gold', 'clique: tema dourado e preto');
  ok(await pg.evaluate(() => getComputedStyle(document.querySelector('#titulo-tela')).color) === 'rgb(212, 173, 102)', 'títulos em dourado');
  await foto('painel-dourado'); await pg.click('#botao-tema'); await pg.click('#botao-tema'); await pg.click('#botao-tema');
  await foto('painel-escuro');
  await pg.reload(); await pg.waitForSelector('#botao-tema');
  ok(await pg.getAttribute('html', 'data-theme') === 'dark', 'escolha mantida ao recarregar');
  await pg.goto(url + '#/config'); await pg.waitForSelector('.tema-opcoes');
  await pg.click('.tema-op.tema-claro'); ok(await pg.getAttribute('html', 'data-theme') === 'light', 'Configurações › Aparência troca o tema');
  await foto('config-claro');
  await pg.click('.tema-op.tema-auto'); ok(await pg.evaluate(() => !document.documentElement.hasAttribute('data-theme')), 'volta ao automático');
  await t.fechar();
})().catch(e => { console.error(e); process.exit(1); });
