// Seven Processo nível Trello Premium: prioridade, dependências, raias, mapa, ações em massa, filtros salvos,
// visões de todos os quadros, novos modelos e configurações do quadro.
// Uso: node testes/quadros-premium.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t; const erros = []; pg.on('pageerror', e => erros.push(e.message));
  try {
    await pg.goto(url + '#/quadros'); await pg.waitForSelector('.ktiles'); await pg.waitForTimeout(200);
    const qid = await pg.evaluate(() => {
      const d = Dados.e; d.empresas.push({ id: 'cA', razao: 'Alfa LTDA', fantasia: 'Alfa', cnpj: '11222333000181' });
      const q = d.quadros.find(x => x.listas.some(l => l.nome === 'Oportunidade')); const L = n => q.listas.find(l => l.nome === n).id;
      const c = (id, titulo, lista, extra) => q.cartoes.push(Object.assign({ id, titulo, lista: L(lista), etiquetas: [], membros: [], checklists: [], comentarios: [], anexos: [], votos: [], valores: {}, criadoEm: new Date().toISOString(), atividade: [], num: ++q.seq }, extra));
      c('kA', 'Pregão 10 · Hospital', 'Proposta', { licitacao: { uf: 'GO' }, valores: { valor: 50000 }, empresaId: 'cA' });
      c('kB', 'Pregão 11 · Escola', 'Disputa', { licitacao: { uf: 'DF' } });
      c('kC', 'Dispensa 3 · Prefeitura', 'Oportunidade', { licitacao: { uf: 'GO' } });
      Dados.salvar(); return q.id;
    });
    await pg.goto(url + '#/quadros/' + qid + '/kA'); await pg.waitForSelector('#kov .kjanela');
    await pg.selectOption('#kov [data-campo=prioridade]', '4'); await pg.waitForTimeout(150);
    ok(await pg.evaluate(() => Dados.e.quadros.some(q => q.cartoes.some(c => c.id === 'kA' && c.prioridade === 4))), 'prioridade pelo cartão');
    // dependência: kB bloqueado por kA
    await pg.evaluate(qid => { const q = Dados.e.quadros.find(x => x.id === qid); const b = q.cartoes.find(c => c.id === 'kB'), a = q.cartoes.find(c => c.id === 'kA'); b.vinculos = [{ q: qid, c: 'kA', tipo: 'bloqueado-por' }]; a.vinculos = [{ q: qid, c: 'kB', tipo: 'bloqueia' }]; Dados.salvar(); }, qid);
    await pg.keyboard.press('Escape'); await pg.goto(url + '#/quadros/' + qid); await pg.waitForSelector('.kcartao');
    ok(/Urgente/.test(await pg.innerText('.kcartao[data-cartao=kA]')) && /bloqueado/.test(await pg.innerText('.kcartao[data-cartao=kB]')), 'selos de prioridade e de bloqueio nos cartões');
    await pg.selectOption('[data-raias]', 'prioridade'); await pg.waitForSelector('.kraia');
    ok(await pg.locator('.kraia').count() === 2 && /Urgente/.test(await pg.innerText('.kraia >> nth=0')), 'raias por prioridade');
    await foto('processo-raias');
    await pg.selectOption('[data-raias]', ''); await pg.waitForSelector('#kquadro .klista');
    // mapa
    await pg.click('[data-visao=mapa]'); await pg.waitForSelector('.kmapa');
    ok(/2/.test(await pg.innerText('.kuf[data-uf=GO]')) && /1/.test(await pg.innerText('.kuf[data-uf=DF]')), 'mapa conta cartões por UF');
    await pg.click('.kuf[data-uf=GO]'); await pg.waitForTimeout(150); ok(/GO · 2 cartões/i.test(await pg.innerText('.kmapa-lado')) && /Hospital/.test(await pg.innerText('.kmapa-lado')), 'clicar no estado lista os cartões');
    await foto('processo-mapa');
    // tabela + ações em massa
    await pg.click('[data-visao=tabela]'); await pg.waitForSelector('.tabela [data-sel]');
    await pg.click('[data-sel=kB]'); await pg.click('[data-sel=kC]'); await pg.waitForSelector('.kmassa');
    ok(/2 selecionados/.test(await pg.innerText('.kmassa')), 'barra de ações em massa');
    await pg.selectOption('.kmassa [name=prioridade]', '3'); await pg.selectOption('.kmassa [name=lista]', { label: 'Análise do edital' }); await pg.click('.kmassa button.primario'); await pg.waitForTimeout(200);
    ok(await pg.evaluate(qid => { const q = Dados.e.quadros.find(x => x.id === qid); const l = q.listas.find(x => x.nome === 'Análise do edital').id; return ['kB', 'kC'].every(id => { const c = q.cartoes.find(k => k.id === id); return c.prioridade === 3 && c.lista === l; }); }, qid), 'move e define prioridade em massa');
    // filtro salvo
    await pg.click('[data-a=filtros]'); await pg.waitForSelector('.modal [name=prioridades]');
    await pg.check('.modal [name=prioridades][value="4"]'); await pg.fill('.modal [name=salvarComo]', 'Urgentes'); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(200);
    ok(await pg.locator('.tabela tbody tr').count() === 1, 'filtro por prioridade');
    await pg.click('[data-a=limpar]'); await pg.waitForTimeout(150); ok(await pg.locator('.tabela tbody tr').count() === 3, 'limpa o filtro');
    await pg.click('[data-a=filtros]'); await pg.waitForSelector('.modal [name=usarSalvo]'); await pg.check('.modal [name=usarSalvo]'); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(200);
    ok(await pg.locator('.tabela tbody tr').count() === 1, 'aplica o filtro salvo');
    await pg.click('[data-a=limpar]');
    // novo quadro pelo modelo Comercial + visões de todos os quadros
    await pg.evaluate(() => { Telas.quadros; }); await pg.goto(url + '#/quadros'); await pg.click('[data-a=novo]'); await pg.waitForSelector('.modal [name=modelo]');
    await pg.fill('.modal [name=nome]', 'Vendas do BPO'); await pg.selectOption('.modal [name=modelo]', 'comercial'); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => { const q = Dados.e.quadros.find(x => x.nome === 'Vendas do BPO'); return q && q.listas.map(l => l.nome).join() === 'Prospecção,Primeiro contato,Diagnóstico,Proposta enviada,Negociação,Fechado,Perdido'; }), 'modelo Comercial com as etapas de venda');
    await pg.evaluate(() => { const q = Dados.e.quadros.find(x => x.nome === 'Vendas do BPO'); q.cartoes.push({ id: 'kV', titulo: 'Lead Beta', lista: q.listas[0].id, etiquetas: [], membros: [], checklists: [], comentarios: [], anexos: [], votos: [], valores: {}, criadoEm: new Date().toISOString(), atividade: [], prazo: new Date().toISOString().slice(0, 10) + 'T12:00' }); Dados.salvar(); });
    await pg.goto(url + '#/quadros'); await pg.click('.karea-links a[href="#/quadros/area/tabela"]'); await pg.waitForSelector('.karea .tabela');
    const txt = await pg.innerText('.karea .tabela');
    ok(/Lead Beta/.test(txt) && /Hospital/.test(txt) && /Vendas do BPO/.test(txt), 'tabela com os cartões de todos os quadros');
    await pg.click('.karea tr[data-cartao=kV]'); await pg.waitForFunction(() => /#\/quadros\/qd/.test(location.hash) && /kV$/.test(location.hash)); ok(true, 'clicar abre o cartão no quadro dele');
    await pg.goto(url + '#/quadros/area/calendario'); await pg.waitForSelector('.karea'); ok(/Lead Beta/.test(await pg.innerText('.karea')), 'calendário de todos os quadros');
    await pg.goto(url + '#/quadros/area/mapa'); await pg.waitForSelector('.karea .kmapa'); ok(true, 'mapa de todos os quadros');
    // configurações: visão padrão
    await pg.evaluate(qid => { const q = Dados.e.quadros.find(x => x.id === qid); q.config.visaoPadrao = 'tabela'; Dados.salvar(); }, qid);
    await pg.goto(url + '#/quadros'); await pg.goto(url + '#/quadros/' + qid); await pg.waitForSelector('.kvisao'); ok(await pg.locator('.tabela [data-sel]').count() > 0, 'abre na visão padrão do quadro');
    ok(!erros.length, 'sem erros na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
