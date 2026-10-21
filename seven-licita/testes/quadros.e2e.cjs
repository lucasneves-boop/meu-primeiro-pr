// Verifica no Chromium os itens MUST de docs/CONTRATO-QUADROS.md. Uso: node testes/quadros.e2e.cjs [pasta-de-capturas]
const path = require('path'); const http = require('http'); const fs = require('fs');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
const raiz = path.join(__dirname, '..');
const saida = process.argv[2] || path.join(raiz, 'testes', 'capturas'); fs.mkdirSync(saida, { recursive: true });
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const f = path.join(raiz, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!f.startsWith(raiz) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
const ok = (cond, msg) => { if (!cond) throw new Error('FALHOU: ' + msg); console.log('  ✓ ' + msg); };

(async () => {
  await new Promise(o => srv.listen(0, o)); const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const nav = await chromium.launch(); const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' }); const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(e.message)); pg.on('dialog', d => d.accept());
  const foto = n => pg.screenshot({ path: path.join(saida, 'q-' + n + '.png') });
  const D = fn => pg.evaluate(fn);
  const submit = () => pg.click('.modal [type=submit]');

  await pg.goto(url + '#/quadros'); await pg.waitForSelector('.ktiles');
  ok(await pg.locator('.ktile:not(.novo)').count() >= 1, 'área de trabalho com o quadro padrão');
  // criar quadro por modelo
  await pg.click('[data-a=novo] >> nth=0'); await pg.fill('.modal [name=nome]', 'Execução 2026'); await pg.selectOption('.modal [name=modelo]', 'execucao'); await submit();
  await pg.waitForSelector('.kpagina'); ok((await pg.locator('.klista[data-lista]').count()) === 7, 'quadro criado a partir do modelo Execução');
  await pg.goto(url + '#/quadros'); await pg.click('.ktile:has-text("Licitações")'); await pg.waitForSelector('.kpagina');
  const qid = await D(() => location.hash.split('/')[2]);

  // compositor de cartão (Enter continua aberto)
  await pg.click('.klista >> nth=0 >> [data-a=compor]'); await pg.fill('.kcompositor textarea', 'Pregão 90021 papel A4'); await pg.keyboard.press('Enter');
  await pg.waitForSelector('.kcompositor textarea'); await pg.fill('.kcompositor textarea', 'Dispensa 12 limpeza'); await pg.keyboard.press('Enter');
  await pg.keyboard.press('Escape');
  ok(await pg.locator('.kcartao[data-cartao]').count() === 2, 'compositor cria cartões em sequência');
  ok(await D(() => Dados.e.quadros.find(q => q.nome === 'Licitações').cartoes.every(c => c.checklists.length === 1)), 'automação padrão pôs o checklist da etapa');
  await foto('01-quadro');

  // arrastar entre listas
  await pg.dragAndDrop('.kcartao[data-cartao] >> nth=0', '.klista >> nth=1 >> .kcartoes');
  ok(await D(() => { const q = Dados.e.quadros.find(q => q.nome === 'Licitações'); return q.cartoes.some(c => q.listas.find(l => l.id === c.lista).nome === 'Análise do edital'); }), 'arrastar cartão para outra lista');

  // janela do cartão
  await pg.click('.kcartao:has-text("papel")'); await pg.waitForSelector('#kov .kjanela');
  ok(/#\/quadros\/.+\/.+/.test(await D(() => location.hash)), 'link direto do cartão na barra de endereço');
  await pg.click('[data-painel=etiquetas]'); await pg.check('[data-etiqueta] >> nth=0'); await pg.check('[data-etiqueta] >> nth=2');
  await pg.click('[data-painel=membros]'); await pg.fill('[data-novo-membro] input', 'Ana Paula'); await pg.click('[data-novo-membro] button'); await pg.check('[data-membro="Ana Paula"]');
  await pg.click('[data-painel=datas]'); await pg.fill('[data-datas] [name=inicio]', '2026-10-20T09:00'); await pg.fill('[data-datas] [name=prazo]', '2026-10-28T14:00'); await pg.click('[data-datas] button.primario');
  await pg.fill('[data-desc]', '**Atenção** ao item 9.3\n- [ ] pedir esclarecimento\n- [x] ler edital'); await pg.click('[data-k=salvar-desc]');
  ok(await pg.locator('.md strong:has-text("Atenção")').count() === 1 && await pg.locator('.md input[type=checkbox]').count() === 2, 'descrição em Markdown com caixas de seleção');
  await pg.click('.md input[type=checkbox] >> nth=0');
  ok(await D(() => Dados.e.quadros.find(q => q.nome === 'Licitações').cartoes.find(c => /papel/.test(c.titulo)).descricao.includes('- [x] pedir')), 'marcar tarefa direto na descrição');
  await pg.click('[data-painel=checklist]'); await pg.fill('[data-novo-checklist] [name=t]', 'Documentos'); await pg.click('[data-novo-checklist] button');
  const ultimo = pg.locator('[data-novo-item] input').last(); await ultimo.fill('CND federal @ana !30/10'); await ultimo.press('Enter');
  await pg.fill('[data-novo-comentario]', 'Revisar com @ana hoje'); await pg.click('[data-k=comentar]');
  await pg.hover('.kcom >> nth=0'); await pg.click('.kcom .kreacoes-add .kreacao >> nth=0');
  await pg.click('[data-k=seguir]'); await pg.click('[data-k=votar]');
  await pg.click('[data-painel=capa]'); await pg.click('[data-capa=azul]');
  await pg.click('[data-painel=anexo]'); await pg.fill('[data-novo-link] [name=u]', 'https://pncp.gov.br/app/editais'); await pg.click('[data-novo-link] button');
  const fc = pg.waitForEvent('filechooser'); await pg.click('[data-painel=anexo]'); await pg.click('[data-k=add-arquivo]');
  const png = path.join(saida, 'img.png'); fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAwMDAwMDAAAANAAH/7k3PZQAAAABJRU5ErkJggg==', 'base64'));
  await (await fc).setFiles(png); await pg.waitForSelector('.kanexos li >> nth=1');
  await pg.click('[data-painel=repetir]'); await pg.selectOption('[data-repetir] [name=f]', 'mensal'); await pg.click('[data-repetir] button');
  await foto('02-cartao');
  const c1 = await D(() => { const q = Dados.e.quadros.find(q => q.nome === 'Licitações'); return q.cartoes.find(c => /papel/.test(c.titulo)); });
  ok(c1.etiquetas.length === 2, 'etiquetas no cartão');
  ok(c1.membros.includes('Ana Paula'), 'membro adicionado');
  ok(c1.prazo === '2026-10-28T14:00' && c1.inicio === '2026-10-20T09:00', 'datas de início e prazo');
  ok(c1.checklists.some(cl => cl.titulo === 'Documentos' && cl.itens[0].membro === 'Ana Paula' && cl.itens[0].prazo.endsWith('-10-30')), 'checklist com item atribuído e com prazo');
  ok(c1.comentarios[0].reacoes['👍'].length === 1, 'comentário com reação');
  ok(c1.seguindo && c1.votos.length === 1 && c1.capa === 'azul', 'seguir, votar e capa');
  ok(c1.anexos.length === 2 && c1.anexos.some(a => a.link), 'anexo de arquivo e de link');
  ok(c1.recorrencia && c1.recorrencia.freq === 'mensal', 'repetição mensal');
  ok(await D(() => Dados.e.notificacoes.some(n => /mencionou Ana Paula/.test(n.texto))), 'menção gera notificação');
  // item vira cartão
  await pg.locator('.kitem').last().hover(); await pg.locator('[data-k=item-cartao]').last().click();
  ok(await D(() => Dados.e.quadros.find(q => q.nome === 'Licitações').cartoes.some(c => c.titulo === 'CND federal' && c.vinculos && c.vinculos.length)), 'item do checklist vira cartão vinculado');
  // mover via seletor de lista e copiar
  await pg.click('[data-painel=copiar]'); await pg.fill('[data-mover=copiar] [name=titulo]', 'Cópia do pregão'); await pg.click('[data-mover=copiar] button.primario');
  ok(await D(() => Dados.e.quadros.find(q => q.nome === 'Licitações').cartoes.some(c => c.titulo === 'Cópia do pregão')), 'copiar cartão');
  await pg.keyboard.press('Escape'); await pg.waitForSelector('#kov', { state: 'detached' });

  // filtros e busca
  await pg.click('[data-a=filtros]'); await pg.check('.modal [name=meus]'); await submit();
  ok(await pg.locator('.kcab [data-a=filtros]:has-text("(1)")').count() === 1, 'contador de filtros');
  await pg.click('[data-a=limpar]');
  await pg.fill('#kbusca-quadro', 'limpeza'); await pg.waitForTimeout(400);
  ok(await pg.locator('.kcartao[data-cartao]').count() === 1, 'busca no quadro');
  await pg.fill('#kbusca-quadro', ''); await pg.waitForTimeout(400);

  // atalhos: 1 alterna etiqueta, c arquiva
  await pg.evaluate(() => document.activeElement.blur()); await pg.hover('.kcartao:has-text("limpeza")'); await pg.keyboard.press('1');
  ok(await D(() => { const q = Dados.e.quadros.find(q => q.nome === 'Licitações'); return q.cartoes.find(c => /limpeza/.test(c.titulo)).etiquetas.includes(q.etiquetas[0].id); }), 'atalho 1 alterna a etiqueta');
  await pg.keyboard.press('?'); await pg.waitForSelector('.modal kbd'); await pg.keyboard.press('Escape');

  // lista: cor, limite, recolher, nova lista
  await pg.click('.klista >> nth=0 >> [data-a=menu-lista]'); await pg.selectOption('.modal [name=cor]', 'verde'); await pg.fill('.modal [name=limite]', '5'); await submit();
  ok(await pg.locator('.klista.lcor-verde').count() === 1, 'cor e limite da lista');
  await pg.click('.klista >> nth=0 >> [data-recolher]'); ok(await pg.locator('.klista.recolhida').count() === 1, 'recolher lista'); await pg.click('.klista.recolhida [data-recolher]');
  await pg.click('[data-a=nova-lista]'); await pg.fill('.modal [name=v]', 'Arquivo morto'); await submit();
  ok(await pg.locator('.klista h3:has-text("Arquivo morto")').count() === 1, 'nova lista');

  // automação: nova regra pela interface
  await pg.click('[data-a=automacao]'); await pg.click('[data-nova-regra]');
  const r = pg.locator('#kau-regras .kau-regra').last(); await r.locator('[data-glista]').selectOption('Proposta'); await r.locator('[data-tipo]').selectOption('add-membro'); await r.locator('[data-valor]').selectOption('Ana Paula');
  await submit();
  await pg.dragAndDrop('.kcartao:has-text("limpeza")', '.klista >> nth=2 >> .kcartoes');
  ok(await D(() => Dados.e.quadros.find(q => q.nome === 'Licitações').cartoes.find(c => /limpeza/.test(c.titulo)).membros.includes('Ana Paula')), 'regra criada na interface roda ao mover');
  // botão do cartão (modelo licitações já traz "Marcar como ganha")
  await pg.click('.kcartao:has-text("limpeza")'); await pg.click('[data-botao-cartao] >> nth=0'); await pg.keyboard.press('Escape');
  ok(await D(() => { const q = Dados.e.quadros.find(q => q.nome === 'Licitações'); const c = q.cartoes.find(c => /limpeza/.test(c.titulo)); return q.listas.find(l => l.id === c.lista).nome === 'Contrato'; }), 'botão do cartão executa ações');

  // visões
  for (const v of ['tabela', 'calendario', 'cronograma', 'painel']) { await pg.click('[data-visao=' + v + ']'); await pg.waitForTimeout(250); await foto('03-' + v); }
  await pg.click('[data-visao=calendario]');
  const dia = await pg.locator('.kdia').nth(15).getAttribute('data-dia');
  await pg.dragAndDrop('.kcal-semdata .kcal-item >> nth=0', '.kdia >> nth=15');
  ok(await pg.evaluate((d) => Dados.e.quadros.find(q => q.nome === 'Licitações').cartoes.some(c => c.prazo && c.prazo.replace(/-/g, '').startsWith(d)), dia), 'arrastar cartão para um dia no calendário');
  await pg.click('[data-calmodo=semana]'); ok(await pg.locator('.kcal.semana .kdia').count() === 7, 'calendário semanal');
  await pg.click('[data-visao=tabela]'); await pg.click('th[data-ord=titulo]'); ok(await pg.locator('th[data-ord=titulo]:has-text("▲")').count() === 1, 'tabela ordenável');
  await pg.click('[data-visao=quadro]');

  // caixa de entrada → lista
  await pg.click('.kcab [data-a=inbox]'); await pg.fill('#kinbox-form input', 'Ligar para o pregoeiro'); await pg.keyboard.press('Enter');
  await pg.dragAndDrop('.kinbox-item >> nth=0', '.klista >> nth=0 >> .kcartoes');
  ok(await D(() => Dados.e.quadros.find(q => q.nome === 'Licitações').cartoes.some(c => c.titulo === 'Ligar para o pregoeiro') && !Dados.e.inbox.length), 'caixa de entrada arrastada para a lista');

  // menu do quadro: fundo, envelhecimento, exportar
  await pg.click('[data-a=menu]'); await pg.check('.modal [name=fundo][value=vinho]', { force: true }); await pg.check('.modal [name=envelhecimento]'); await pg.fill('.modal [name=descricao]', 'Quadro principal da Seven');
  const dl = pg.waitForEvent('download'); await pg.check('.modal [name=exp_json]'); await submit(); const arq = await dl; const jp = path.join(saida, 'quadro.json'); await arq.saveAs(jp);
  ok(JSON.parse(fs.readFileSync(jp, 'utf8')).app === 'seven-licita-quadro', 'exportar quadro em JSON');
  ok(await D(() => Dados.e.quadros.find(q => q.nome === 'Licitações').fundo === 'vinho'), 'fundo do quadro');

  // importar do Trello
  const trello = { name: 'Do Trello', lists: [{ id: 'L1', name: 'Backlog', pos: 1 }], labels: [{ id: 'b', name: 'Bug', color: 'red' }], members: [], cards: [{ id: 'k', name: 'Cartão importado', idList: 'L1', idLabels: ['b'], idMembers: [], pos: 1 }], checklists: [], actions: [] };
  const tp = path.join(saida, 'trello.json'); fs.writeFileSync(tp, JSON.stringify(trello));
  await pg.goto(url + '#/quadros'); const fc2 = pg.waitForEvent('filechooser'); await pg.click('[data-a=importar]'); await (await fc2).setFiles(tp);
  await pg.waitForSelector('.kcartao:has-text("Cartão importado")'); ok(true, 'importar quadro do Trello');
  // busca global e fechar quadro
  await pg.goto(url + '#/quadros'); await pg.fill('#kbusca input', 'pregão'); await pg.keyboard.press('Enter');
  ok(await pg.locator('.lista-links a:has-text("Pregão 90021")').count() >= 1, 'busca global entre quadros');
  await foto('04-inicio');
  await pg.click('[data-a=sino]'); await pg.waitForSelector('.knotificacoes'); await foto('05-notificacoes'); await pg.keyboard.press('Escape');

  await pg.setViewportSize({ width: 390, height: 844 }); await pg.goto(url + '#/quadros/' + qid); await pg.waitForTimeout(300); await foto('06-celular');
  ok(await D(() => document.documentElement.scrollWidth) <= 392, 'sem rolagem horizontal da página no celular');

  await nav.close(); srv.close();
  if (erros.length) { console.error('ERROS NA PÁGINA:\n' + erros.join('\n')); process.exit(1); }
  console.log('OK');
})().catch(e => { console.error(e.message || e); srv.close(); process.exit(1); });
