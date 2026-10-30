// Seven IA (visual novo): especialistas, biblioteca de prompts por categoria, paleta "/", prompts salvos,
// avaliação e PDF da resposta, atalho Ctrl+K e tela cheia sem a descrição da página.
// Uso: LIBS_PDF=<pasta com html2canvas e jspdf> node testes/sevenai-design.e2e.cjs [pasta-de-capturas]
const path = require('path'); const fs = require('fs'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t;
  if (process.env.LIBS_PDF) await pg.context().route(/cdnjs\.cloudflare\.com\/ajax\/libs\/(html2canvas|jspdf)\//, (r) => { const f = /html2canvas/.test(r.request().url()) ? 'html2canvas.min.js' : 'jspdf.umd.min.js'; r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(process.env.LIBS_PDF, f)) }); });
  try {
    await pg.goto(url + '#/painel'); await pg.waitForSelector('#conteudo');
    await pg.evaluate(async () => {
      Dados.e.config.responsavel = 'Lucas Neves';
      await Dados.guardarArquivo('ia-msg-c1', new Blob([JSON.stringify([{ role: 'user', content: [{ type: 'text', text: 'O que é habilitação técnica?' }], em: Date.now() }, { role: 'assistant', modelo: 'claude-opus-5-5', em: Date.now(), content: [{ type: 'text', text: '## Habilitação técnica\n\nÉ a prova de que a empresa sabe executar o objeto (Lei 14.133, art. 67).' }] }])], { type: 'application/json' }));
      Telas.ia.api.dados().conversas.push({ id: 'c1', titulo: 'Habilitação técnica', criadaEm: Date.now(), editadaEm: Date.now(), modelo: 'claude-opus-5-5', especialista: 'juridico', custo: 0.02 });
      Dados.salvar();
    });
    await pg.goto(url + '#/ia'); await pg.waitForSelector('.ia-orbe');
    ok(await pg.isHidden('#desc-tela'), 'Seven IA ocupa a tela toda (sem a descrição da página)');
    ok(/Boa (noite|tarde|dia), Lucas/.test(await pg.innerText('.ia-sauda')), 'saudação com o nome');
    ok(/1 conversa/.test(await pg.innerText('.ia-uso')), 'uso do mês na lateral');

    // especialistas
    await pg.click('.ia-esp-op[data-v=preco]');
    ok(await pg.evaluate(() => Dados.e.ia.pref.especialista) === 'preco' && /Precificador/.test(await pg.innerText('.ia-esp-tag')), 'escolher o especialista Precificador');

    // categorias
    await pg.click('.ia-cats [data-v=Recursos]'); ok(await pg.locator('.ia-card').count() === 3, 'categoria Recursos com 3 prompts');

    // paleta "/"
    await pg.fill('.ia-comp textarea', '/recurso adm'); await pg.dispatchEvent('.ia-comp textarea', 'input'); await pg.waitForSelector('.ia-cmd:not([hidden])');
    ok(/Recurso administrativo/.test(await pg.innerText('.ia-cmd')), 'paleta "/" filtra os prompts');
    await foto('ia-paleta');
    await pg.press('.ia-comp textarea', 'Enter'); await pg.waitForTimeout(150);
    ok(/Lei 14\.133, art\. 165/.test(await pg.inputValue('.ia-comp textarea')) && await pg.isHidden('.ia-cmd') && /Jurídico/.test(await pg.innerText('.ia-esp-tag')), 'Enter usa o prompt e muda o especialista para Jurídico');

    // salvar prompt
    await pg.fill('.ia-comp textarea', 'Resuma a ata de registro de preços em tópicos.'); await pg.click('[data-ia=salvar-prompt]');
    await pg.fill('.modal [name=t]', 'Resumo de ata'); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(300);
    ok(/Resumo de ata/.test(await pg.innerText('.ia-cards')) && /Meus prompts\s*1/.test(await pg.innerText('.ia-cats')), 'prompt salvo aparece em Meus prompts');
    await pg.click('.ia-card-x'); await pg.waitForTimeout(150); ok(await pg.evaluate(() => Dados.e.ia.prompts.length) === 0, 'excluir prompt salvo');
    await foto('ia-inicio-novo');

    // conversa: especialista, avaliação, PDF, descer e Ctrl+K
    await pg.goto(url + '#/ia/c/c1'); await pg.waitForSelector('.ia-msg.bot .ia-acoes');
    ok(/⚖️/.test(await pg.innerText('.ia-topo-esp')), 'cabeçalho mostra o especialista da conversa');
    await pg.click('.ia-msg.bot [data-ia=voto][data-v="1"]'); await pg.waitForTimeout(200);
    ok(await pg.evaluate(async () => JSON.parse(await (await Dados.lerArquivo('ia-msg-c1')).text())[1].voto) === 1 && await pg.locator('.ia-voto.on').count() === 1, 'avaliação 👍 registrada');
    if (process.env.LIBS_PDF) { const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click('.ia-msg.bot [data-ia=pdf]')]); ok(/seven-ia-.*\.pdf$/.test(dl.suggestedFilename()), 'resposta em PDF timbrado'); }
    await foto('ia-conversa-nova');
    await pg.keyboard.press('Control+k'); await pg.waitForSelector('.ia-orbe'); ok(await pg.evaluate(() => location.hash) === '#/ia', 'Ctrl+K abre nova conversa');

    // celular
    await pg.setViewportSize({ width: 390, height: 844 }); await pg.goto(url + '#/ia'); await pg.waitForSelector('.ia-orbe');
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'celular: sem rolagem horizontal');
    await foto('ia-celular');
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
