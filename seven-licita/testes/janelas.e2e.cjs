// Janelas flutuantes: Seven Not, Seven Agenda, Seven Chat e Seven IA usam os mesmos dados das telas completas.
// Uso: node testes/janelas.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t; const erros = []; pg.on('pageerror', e => erros.push(e.message));
  try {
    await pg.goto(url + '#/painel'); await pg.waitForSelector('#botao-not');
    await pg.evaluate(() => {
      const d = Dados.e; d.pleiadeCfg = { modo: 'local', eu: 'u1', lidos: {}, threadsLidas: {}, salvos: {} };
      d.pleiade = { membros: { u1: { nome: 'Lucas Neves', cor: '#b68d40' }, u2: { nome: 'Ana', cor: '#579dff' } }, canais: { geral: { nome: 'geral', membros: { u1: true, u2: true }, criadoPor: 'u1', criadoEm: Date.now() } }, mensagens: { geral: { m1: { u: 'u2', t: 'Bom dia, equipe!', em: Date.now() - 60000 } } } };
      d.notasOport = { av1: [{ id: 'nt1', texto: 'Pedir esclarecimento sobre o item 3', em: new Date().toISOString(), etapa: 'encontrar' }] };
      d.avisos = d.avisos || {}; d.avisos.av1 = { id: 'av1', capturadoEm: new Date().toISOString(), modalidade: 'Pregão', numero: '12/2026', orgao: 'UFG', objeto: 'Uniformes' };
      Dados.salvar();
    });
    await pg.reload(); await pg.waitForSelector('#botao-not');
    // Seven Not
    await pg.click('#botao-not'); await pg.waitForSelector('#not-flutuante:not([hidden])');
    await pg.click('#not-flutuante [data-j=nova]'); await pg.waitForSelector('#not-flutuante .cfj-tit');
    await pg.fill('#not-flutuante .cfj-tit', 'Ligar para o pregoeiro'); await pg.click('#not-flutuante .cfj-ed'); await pg.keyboard.type('Confirmar prazo da amostra.'); await pg.waitForTimeout(500);
    ok(await pg.evaluate(() => { const n = Dados.e.anotacoes.notas.find(x => x.titulo === 'Ligar para o pregoeiro'); return !!n && /amostra/.test(n.html); }), 'nota criada na janela é a mesma do Seven Not');
    await pg.goto(url + '#/anotacoes'); await pg.waitForSelector('.an-card'); ok(/Ligar para o pregoeiro/.test(await pg.innerText('#conteudo')), 'aparece na tela Seven Not');
    await pg.click('#not-flutuante [data-j=voltar]'); await pg.click('#not-flutuante [data-aba=oport]');
    ok(/Pregão · 12\/2026 · UFG/.test(await pg.innerText('#not-flutuante')) && /item 3/.test(await pg.innerText('#not-flutuante')), 'anotações das oportunidades na mesma janela');
    await pg.click('#not-flutuante [data-cf=fechar]');
    // Seven Agenda
    await pg.keyboard.press('Alt+KeyA'); await pg.waitForSelector('#agenda-flutuante:not([hidden])'); ok(true, 'Alt+A abre a Seven Agenda');
    await pg.fill('#agenda-flutuante .cfj-add input', 'Enviar proposta da UFG'); await pg.press('#agenda-flutuante .cfj-add input', 'Enter'); await pg.waitForTimeout(200);
    ok(await pg.evaluate(() => Dados.e.agenda.tarefas.some(x => x.titulo === 'Enviar proposta da UFG')) && /Enviar proposta da UFG/.test(await pg.innerText('#agenda-flutuante')), 'tarefa criada na janela vai para a Seven Agenda (hoje)');
    await pg.click('#agenda-flutuante [data-t]'); await pg.waitForTimeout(200);
    ok(await pg.evaluate(() => Dados.e.agenda.tarefas.find(x => x.titulo === 'Enviar proposta da UFG').feita === true), 'concluir pela janela');
    await pg.goto(url + '#/agenda'); await pg.waitForSelector('#conteudo'); await pg.waitForTimeout(200);
    await pg.click('#agenda-flutuante [data-cf=fechar]');
    // Seven Chat
    await pg.click('#botao-chat'); await pg.waitForSelector('#chat-flutuante [data-canal=geral]');
    ok(/# geral/.test(await pg.innerText('#chat-flutuante')) && await pg.locator('#chat-flutuante .cfj-n').count() === 1, 'canais com mensagens não lidas');
    await pg.click('#chat-flutuante [data-canal=geral]'); await pg.waitForSelector('#chat-flutuante textarea');
    ok(/Bom dia, equipe!/.test(await pg.innerText('#chat-flutuante')), 'mensagens do canal');
    await pg.fill('#chat-flutuante textarea', 'Sessão às 9h no Compras.gov'); await pg.press('#chat-flutuante textarea', 'Enter'); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => Object.values(Dados.e.pleiade.mensagens.geral).some(m => m.t === 'Sessão às 9h no Compras.gov' && m.u === 'u1')), 'mensagem enviada pela janela entra no Seven Chat');
    await pg.goto(url + '#/pleiade/c/geral'); await pg.waitForSelector('#pl-msgs'); ok(/Sessão às 9h no Compras.gov/.test(await pg.innerText('#pl-msgs')), 'aparece na tela do Seven Chat');
    await foto('janelas');
    await pg.click('#chat-flutuante [data-cf=fechar]');
    // Seven IA
    await pg.keyboard.press('Alt+KeyI'); await pg.waitForSelector('#ia-flutuante:not([hidden])');
    ok(/Cadastrar chave/.test(await pg.innerText('#ia-flutuante')), 'Seven IA pede a chave quando não há');
    await pg.evaluate(() => { localStorage.setItem('seven-ia:chave', 'sk-teste'); Dados.e.ia = Dados.e.ia || {}; Dados.e.ia.conversas = [{ id: 'ia1', titulo: 'Prazo de impugnação', criadaEm: Date.now(), editadaEm: Date.now(), modelo: 'x' }]; Dados.salvar(); });
    await pg.click('#ia-flutuante [data-cf=fechar]'); await pg.click('#botao-ia'); await pg.waitForSelector('#ia-flutuante .cfj-conv');
    ok(await pg.locator('#ia-flutuante .cfj-conv option').count() === 2 && /Prazo de impugnação/.test(await pg.innerText('#ia-flutuante .cfj-conv')), 'mesmas conversas da Seven IA');
    // várias janelas juntas e estado ao recarregar
    await pg.click('#botao-not'); await pg.reload(); await pg.waitForSelector('#not-flutuante:not([hidden])'); await pg.waitForSelector('#ia-flutuante:not([hidden])'); ok(true, 'janelas abertas continuam abertas ao recarregar');
    ok(!erros.length, 'sem erros na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
