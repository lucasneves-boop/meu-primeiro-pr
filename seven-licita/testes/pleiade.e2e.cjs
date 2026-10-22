// Plêiade em modo equipe: servidor simulado com o protocolo REST + streaming do Firebase Realtime Database e dois usuários.
// Uso: node testes/pleiade.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { servidorFirebase } = require('./firebase-simulado.cjs');
const { abrir } = require('./apoio.cjs'); const P = require('../js/pleiade.js');
const saida = process.argv[2] || path.join(__dirname, 'capturas');

(async () => {
  const fb = await servidorFirebase(); const t = await abrir(saida); const { ok, url } = t; const A = t.pg;
  const ctxB = await A.context().browser().newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' }); const B = await ctxB.newPage();
  const errosB = []; B.on('pageerror', e => errosB.push(e.message));
  const conectar = async (pg, nome) => {
    await pg.goto(url); await pg.evaluate((u) => { Dados.e.pleiadeCfg = { modo: 'firebase', url: u, espaco: 'Seven', token: '', eu: null, lidos: {}, threadsLidas: {}, salvos: {} }; Dados.salvar(); }, fb.url);
    await pg.goto(url + '#/pleiade'); await pg.reload(); await pg.waitForSelector('.modal [name=nome]'); await pg.fill('.modal [name=nome]', nome); await pg.click('.modal [type=submit]'); await pg.waitForSelector('.pl-comp textarea');
  };
  const enviar = async (pg, texto, onde) => { const ta = pg.locator((onde || '.pl-main') + ' .pl-comp textarea'); await ta.click(); await ta.fill(texto); await ta.press('Enter'); };
  try {
    await conectar(A, 'Lucas Neves');
    ok(await A.locator('.pl-canais a').count() === 3 && /geral/.test(await A.locator('.pl-topo h2').innerText()), 'primeiro usuário cria o espaço com #geral, #licitacoes e #cotacoes');
    ok(/equipe/.test(await A.locator('.pl-con').innerText()), 'conectado ao servidor da equipe');
    await enviar(A, 'Bom dia, equipe! Edital do *pregão 90021* saiu: https://pncp.gov.br/app/editais');
    await A.waitForSelector('.pl-msg b:has-text("pregão 90021")'); ok(await A.locator('.pl-msg a[href^="https://pncp.gov.br"]').count() === 1, 'mensagem com negrito e link');

    await conectar(B, 'Ana Souza');
    await B.waitForSelector('.pl-msg:has-text("Edital do")'); ok(true, 'segundo usuário recebe o histórico do canal');
    const ta = B.locator('.pl-main .pl-comp textarea'); await ta.click(); await ta.type('@Luc'); await B.waitForSelector('.pl-auto:not([hidden]) button:has-text("Lucas Neves")');
    await ta.press('Enter'); await ta.type('pode conferir a habilitação?'); ok((await ta.inputValue()) === '@Lucas Neves pode conferir a habilitação?', 'autocompletar menção com @');
    await ta.press('Enter');
    await A.waitForSelector('.pl-msg.men:has-text("pode conferir a habilitação")', { timeout: 5000 }); ok(true, 'mensagem chega em tempo real para o outro usuário, destacada como menção');
    ok(await A.locator('.pl-msg.men .pl-men-eu').innerText() === '@Lucas Neves', 'menção renderizada');
    // reação
    const msgAna = A.locator('.pl-msg:has-text("pode conferir a habilitação")'); await msgAna.hover(); await msgAna.locator('.pl-acoes [data-reac="👍"]').click();
    await B.waitForSelector('.pl-reac:has-text("👍")', { timeout: 5000 }); ok((await B.locator('.pl-reac').first().innerText()).includes('1'), 'reação sincronizada');
    // thread
    await msgAna.hover(); await msgAna.locator('.pl-acoes [data-pl=thread]').click(); await A.waitForSelector('.pl-painel .pl-comp textarea');
    await enviar(A, 'Confiro agora e te aviso', '.pl-painel'); await A.waitForSelector('.pl-painel .pl-msg:has-text("Confiro agora")');
    await B.waitForSelector('.pl-resp:has-text("1 resposta")', { timeout: 5000 }); ok(true, 'resposta em thread aparece como "1 resposta" para o outro usuário');
    await B.click('.pl-resp'); await B.waitForSelector('.pl-painel .pl-msg:has-text("Confiro agora")'); ok(true, 'abrir a thread');
    await A.click('[data-pl=fechar-painel]');
    // digitando…
    await B.click('[data-pl=fechar-painel]'); await B.locator('.pl-main .pl-comp textarea').fill('rascunho'); await B.locator('.pl-main .pl-comp textarea').type('!');
    await A.waitForSelector('.pl-dig:has-text("Ana está digitando")', { timeout: 5000 }); ok(true, 'indicador "está digitando…"');
    await B.locator('.pl-main .pl-comp textarea').fill('');
    // mensagem agendada e lembrete
    await B.locator('.pl-main .pl-comp textarea').fill('Lembrete: sessão do pregão amanhã às 9h');
    await B.click('.pl-main [data-pl=agendar]'); await B.click('.modal [data-h="1h"]'); await B.click('.modal [type=submit]');
    await B.waitForSelector('.pl-agendadas', { timeout: 5000 }); ok(/1 mensagem/.test(await B.textContent('.pl-agendadas')), 'mensagem agendada aparece acima do campo');
    await B.evaluate(async () => { Dados.e.pleiadeCfg.agendadas[0].quando = Date.now() - 1000; await Telas.pleiade.enviarAgendadas(); });
    await A.waitForSelector('.pl-msg:has-text("sessão do pregão amanhã")', { timeout: 5000 }); ok(true, 'mensagem agendada enviada na hora marcada');
    await A.hover('.pl-msg:has-text("sessão do pregão amanhã")'); await A.click('.pl-msg:has-text("sessão do pregão amanhã") [data-pl=mais]');
    await A.click('.pl-menu [data-op=lembrar]'); await A.click('.modal [data-h="amanha"]'); await A.click('.modal [type=submit]');
    ok(await A.evaluate(() => (Dados.e.agenda || {}).tarefas && Dados.e.agenda.tarefas.some(t => /Responder: Lembrete/.test(t.titulo) && t.hora === '09:00')), 'lembrete criado na Agenda para amanhã às 9h');
    // mensagem direta
    await B.click('.pl-nav a:has-text("Pessoas")'); await B.click('.pl-pessoa:has-text("Lucas") [data-dm]'); await B.waitForSelector('.pl-topo h2:has-text("Lucas Neves")');
    await enviar(B, 'Oi Lucas, qual o preço do papel A4 que fechamos?');
    await A.waitForSelector('.pl-canais a:has-text("Ana Souza") .pl-cont', { timeout: 5000 }); ok(await A.locator('.pl-canais a:has-text("Ana Souza") .pl-cont').innerText() === '1', 'mensagem direta com contador de não lida');
    ok(await A.locator('.toast:has-text("Ana Souza")').count() >= 1, 'aviso de nova mensagem direta');
    ok(/\d/.test(await A.locator('.menu a[data-rota=pleiade] .pl-selo').innerText()), 'selo de não lidas no menu');
    await A.click('.pl-canais a:has-text("Ana Souza")'); await A.waitForSelector('.pl-msg:has-text("papel A4")'); ok(await A.locator('.pl-canais a:has-text("Ana Souza") .pl-cont').count() === 0, 'abrir a conversa marca como lida');
    // anexo pequeno
    const fc = A.waitForEvent('filechooser'); await A.click('.pl-main [data-pl=anexar]'); await (await fc).setFiles(t.arquivo('tabela-precos.csv', 'item;preco\npapel;238,50'));
    await B.waitForSelector('.pl-arq:has-text("tabela-precos.csv")', { timeout: 5000 }); ok(true, 'arquivo compartilhado chega ao outro usuário');
    // editar a última mensagem com seta para cima
    await A.click('.pl-canais a:has-text("geral")'); await enviar(A, 'Sessão às 9h'); await A.waitForSelector('.pl-msg:has-text("Sessão às 9h")');
    await A.locator('.pl-main .pl-comp textarea').press('ArrowUp'); await A.waitForSelector('.pl-editar textarea'); await A.fill('.pl-editar textarea', 'Sessão às 10h (adiada)'); await A.press('.pl-editar textarea', 'Enter');
    await B.click('.pl-canais a:has-text("geral")'); await B.waitForSelector('.pl-msg:has-text("Sessão às 10h (adiada)") :text("(editado)")', { timeout: 5000 }); ok(true, 'editar mensagem (↑) sincroniza com "(editado)"');
    // fixar
    const m10 = A.locator('.pl-msg:has-text("Sessão às 10h")'); await m10.hover(); await m10.locator('[data-pl=mais]').click(); await A.click('.pl-menu [data-op=fixar]');
    await B.waitForSelector('.pl-topo [data-pl=fixados]:has-text("1")', { timeout: 5000 }); ok(true, 'mensagem fixada');
    // canal novo + busca + /tarefa
    await A.click('[data-pl=novo-canal]'); await A.fill('.modal [name=nome]', 'Pregão 90021 Catalão'); await A.click('.modal [type=submit]');
    await A.waitForSelector('.pl-topo h2:has-text("pregao-90021-catalao")'); ok(true, 'criar canal (nome normalizado)');
    await A.fill('#pl-busca input', 'habilitacao from:@ana'); await A.press('#pl-busca input', 'Enter'); await A.waitForSelector('.pl-topo h2:has-text("Busca")');
    ok(await A.locator('.pl-lista .pl-msg').count() === 1, 'busca com filtro de pessoa e sem acento');
    await A.click('.pl-canais a:has-text("geral")'); await enviar(A, '/tarefa Conferir habilitação amanhã 9h !alta');
    ok(await A.evaluate(() => (Dados.e.agenda.tarefas || []).some(x => x.titulo === 'Conferir habilitação' && x.hora === '09:00' && x.prioridade === 3)), '/tarefa cria tarefa na Agenda');
    // threads e atividade
    await A.click('.pl-nav a:has-text("Menções")'); await A.waitForSelector('.pl-topo h2:has-text("Menções")'); ok(await A.locator('.pl-atv').count() >= 1, 'aba de menções e reações');
    await B.click('.pl-nav a:has-text("Menções")'); await B.waitForSelector('.pl-atv:has-text("reagiu com 👍")'); ok(true, 'reação aparece na atividade de quem recebeu');
    await A.click('.pl-canais a:has-text("geral")'); await A.waitForTimeout(300); await t.foto('pleiade-canal');
    await B.click('.pl-canais a:has-text("geral")'); await B.click('.pl-resp'); await B.waitForTimeout(300); await B.screenshot({ path: path.join(saida, 'pleiade-thread.png') });
    // modo local
    const ctxC = await A.context().browser().newContext({ viewport: { width: 1280, height: 800 } }); const C = await ctxC.newPage();
    await C.goto(url + '#/pleiade'); await C.waitForSelector('.modal [name=nome]'); await C.fill('.modal [name=nome]', 'Teste Local'); await C.click('.modal [type=submit]'); await C.waitForSelector('.pl-comp textarea');
    ok(/local/.test(await C.locator('.pl-con').innerText()), 'sem configuração, abre no modo local');
    await enviar(C, 'mensagem local'); await C.reload(); await C.waitForSelector('.pl-msg:has-text("mensagem local")'); ok(true, 'modo local guarda as mensagens no navegador');
    await ctxC.close();
    if (errosB.length) throw new Error('Erros na página B: ' + errosB.join('\n'));
  } catch (e) { console.error(e.message || e); await t.foto('erro'); await B.screenshot({ path: path.join(saida, 'erro-b.png') }); fb.fechar(); process.exit(1); }
  await ctxB.close(); fb.fechar(); await t.fechar();
})();
