// Teste de ponta a ponta no Chromium: abre o app, cadastra cliente, catálogo e perfil, captura do PNCP,
// cria proposta, quadro, disputa (simulador), monitorar e peça. Uso: node testes/navegador.e2e.cjs [pasta-de-capturas]
const path = require('path');
const http = require('http');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }

const raiz = path.join(__dirname, '..');
const saida = process.argv[2] || path.join(raiz, 'testes', 'capturas');
fs.mkdirSync(saida, { recursive: true });
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const servidor = http.createServer(function (req, res) {
  const f = path.join(raiz, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(raiz) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

(async function () {
  await new Promise(function (ok) { servidor.listen(0, ok); });
  const url = 'http://127.0.0.1:' + servidor.address().port + '/';
  const nav = await chromium.launch({ args: ['--ignore-certificate-errors'] });
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 }, ignoreHTTPSErrors: true });
  const pg = await ctx.newPage();
  const erros = [];
  pg.on('pageerror', function (e) { erros.push(e.message); });
  let falhasPNCP = 0;
  // Respostas de erro/limite do PNCP vêm sem cabeçalho CORS; o app tenta de novo. Conta, mas não reprova.
  pg.on('console', function (m) { if (m.type() !== 'error') return; if (/pncp\.gov\.br.*CORS|Failed to load resource/.test(m.text())) { falhasPNCP++; return; } erros.push(m.text()); });
  pg.on('dialog', function (d) { d.accept(); });
  const foto = function (n) { return pg.screenshot({ path: path.join(saida, n + '.png'), fullPage: false }); };
  const passo = function (t) { console.log('• ' + t); };

  await pg.goto(url); await foto('01-painel-vazio');

  passo('cliente');
  await pg.goto(url + '#/empresas'); await pg.click('[data-a=novo]');
  await pg.fill('[name=razao]', 'Papelaria Exemplo Ltda'); await pg.fill('[name=fantasia]', 'Papelaria Exemplo');
  await pg.fill('[name=cnpj]', '11.222.333/0001-81'); await pg.selectOption('[name=uf]', 'GO'); await pg.fill('[name=municipio]', 'Catalão');
  await pg.fill('[name=representante]', 'Fulano de Tal'); await pg.click('.modal [type=submit]');
  await pg.waitForSelector('.cartao h3:has-text("Papelaria Exemplo")');

  passo('catálogo e perfil');
  await pg.goto(url + '#/encontrar/catalogos'); await pg.click('[data-a=novo-cat]'); await pg.click('.modal [type=submit]');
  await pg.click('[data-a=prod]'); await pg.fill('[name=oQueVendo]', 'material de expediente, papel, material de limpeza, aquisição de materiais'); await pg.click('.modal [type=submit]');
  await pg.goto(url + '#/encontrar/perfis'); await pg.click('[data-a=novo]');
  await pg.fill('[name=nome]', 'Expediente GO/DF'); await pg.check('input[name=uf][value=DF]');
  await pg.uncheck('input[name=mod][value="4"]');
  await pg.click('.modal [type=submit]'); await pg.waitForSelector('.cartao h3:has-text("Expediente GO/DF")');

  passo('captura PNCP');
  await pg.click('[data-a=capturar]');
  await pg.waitForFunction(function () { return Dados.e.perfis[0].ultimaCaptura; }, null, { timeout: 180000 });
  const nAvisos = await pg.evaluate(function () { return Object.keys(Dados.e.avisos).length; });
  console.log('  avisos capturados:', nAvisos);
  await pg.goto(url + '#/encontrar'); await pg.waitForTimeout(300); await foto('02-meus-avisos');
  if (!nAvisos) throw new Error('Nenhum aviso capturado do PNCP');

  passo('itens e anexos');
  await pg.click('.aviso [data-a=itens] >> nth=0'); await pg.waitForSelector('#itens-lista table, #itens-lista p:not(.mudo)', { timeout: 60000 }); await foto('03-itens'); await pg.click('.modal .fechar');

  passo('quadro');
  await pg.click('.aviso [data-a=quadro] >> nth=0');
  await pg.goto(url + '#/quadros'); await pg.click('.ktile:has-text("Licitações")'); await pg.waitForSelector('.kcartao'); await foto('04-quadro');
  // arrastar o cartão para "Análise do edital"
  await pg.dragAndDrop('.kcartao >> nth=0', '.klista >> nth=1 >> .kcartoes');
  const ck = await pg.evaluate(function () { const c = Dados.e.quadros[0].cartoes[0]; return { lista: Dados.e.quadros[0].listas.find(function (l) { return l.id === c.lista; }).nome, cl: (c.checklists || []).map(function (x) { return x.titulo; }) }; });
  console.log('  cartão em:', ck.lista, '· checklists:', ck.cl.join(', '));
  await pg.click('.kcartao >> nth=0'); await pg.waitForSelector('#kov .kjanela'); await foto('05-cartao');
  await pg.fill('[data-novo-comentario]', 'Conferir garantia @Lucas'); await pg.click('[data-k=comentar]');
  await pg.keyboard.press('Escape'); await pg.waitForSelector('#kov', { state: 'detached' });
  for (const v of ['tabela', 'calendario', 'painel']) { await pg.click('[data-visao=' + v + ']'); await pg.waitForTimeout(200); await foto('06-quadro-' + v); }
  await pg.click('[data-visao=quadro]');

  passo('proposta');
  await pg.goto(url + '#/encontrar'); await pg.click('.aviso [data-a=cadastrar] >> nth=0');
  await pg.waitForFunction(function () { const p = Dados.e.propostas[0]; return p && p.itens.length; }, null, { timeout: 60000 }).catch(function () { console.log('  (sem itens no PNCP para este aviso)'); });
  await pg.waitForTimeout(500);
  await pg.evaluate(function () { const p = Dados.e.propostas[0]; if (!p.itens.length) p.itens.push({ numero: 1, descricao: 'Item manual', quantidade: 10, unidade: 'UN', participar: true }); p.itens.forEach(function (i) { i.custo = i.refUnitaria ? i.refUnitaria * 0.6 : 10; }); p.impostos = 10; p.margem = 15; Dados.salvar(); App.redesenhar(); });
  await pg.click('[data-a=sugerido]'); await pg.waitForTimeout(300); await foto('07-proposta');
  await pg.click('[data-a=pronta]');
  await pg.check('[data-a=disputar]');

  passo('disputa e simulador');
  await pg.goto(url + '#/disputar'); await pg.click('tr[data-id] >> nth=0');
  await pg.evaluate(function () { const d = Dados.e.disputas[0]; d.itens.forEach(function (i) { i.limite = Nucleo.arredondar((i.proposta || 100) * 0.85, 2); i.aprovado = true; }); Dados.salvar(); App.redesenhar(); });
  await pg.click('[data-a=ensaiar] >> nth=0'); await pg.selectOption('#simcfg [name=vel]', '1'); await pg.click('#simcfg button');
  await pg.waitForSelector('.sim-topo'); await foto('08-simulador');

  passo('monitorar');
  await pg.goto(url + '#/encontrar'); await pg.click('.aviso [data-a=monitorar] >> nth=0');
  await pg.goto(url + '#/monitorar'); await pg.click('tr[data-id] >> nth=0');
  await pg.fill('#nova-msg [name=texto]', 'Pregoeiro: convoco a empresa para envio da proposta atualizada no prazo de 2 horas. Documento obrigatório.');
  await pg.click('#nova-msg button'); await pg.waitForTimeout(300); await foto('09-monitorar');
  const prazos = await pg.evaluate(function () { return Dados.e.monitor[0].prazos.length; });
  console.log('  prazos detectados:', prazos);

  passo('peça jurídica');
  await pg.goto(url + '#/pecas'); await pg.click('[data-a=nova]'); await pg.selectOption('#pc-modelo', 'impugnacao');
  await pg.fill('[name=clausula]', 'Item 9.3 — exigência de marca específica'); await pg.click('.modal [type=submit]');
  await pg.waitForSelector('textarea.peca'); await foto('10-peca');

  passo('análise de mercado');
  await pg.goto(url + '#/mercado'); await pg.fill('[name=termo]', 'papel');
  await pg.evaluate(function () { const d = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10); document.querySelector('[name=inicio]').value = d; });
  await pg.selectOption('[name=maxDetalhe]', '20');
  await pg.click('#fm button.primario');
  await pg.waitForSelector('#rel .kpis', { timeout: 300000 }); await foto('11-mercado');

  passo('painel e celular');
  await pg.goto(url + '#/painel'); await pg.waitForTimeout(300); await foto('12-painel');
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.goto(url + '#/quadros'); await pg.waitForTimeout(300); await foto('13-celular-quadro');
  const larg = await pg.evaluate(function () { return document.documentElement.scrollWidth; });
  console.log('  largura no celular:', larg);

  console.log('  respostas do PNCP refeitas:', falhasPNCP);
  await nav.close(); servidor.close();
  if (erros.length) { console.error('ERROS NA PÁGINA:\n' + erros.join('\n')); process.exit(1); }
  console.log('OK');
})().catch(function (e) { console.error(e); servidor.close(); process.exit(1); });
