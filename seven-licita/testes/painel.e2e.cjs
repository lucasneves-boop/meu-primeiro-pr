// Painel personalizável: gráficos com dados de vários módulos, dica, tabela, adicionar, retirar, reordenar (↑↓ e arrastar),
// redimensionar, persistência, restaurar padrão e celular. Uso: node testes/painel.e2e.cjs [pasta-de-capturas]
const path = require('path');
const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');

(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t;
  await pg.route(/pncp\.gov\.br|dadosabertos/, r => r.abort());
  const ordem = () => pg.evaluate(() => [...document.querySelectorAll('.pn-bloco')].map(s => s.dataset.id));
  try {
    await pg.goto(url);
    await pg.evaluate(() => {
      const d = Dados.e; const h = new Date(); const iso = (o) => { const x = new Date(h); x.setDate(x.getDate() + o); return x.toISOString().slice(0, 10); };
      const mes = (k) => { const x = new Date(h.getFullYear(), h.getMonth() - k, 10); return x.toISOString().slice(0, 10); };
      const E = ['lead', 'contato', 'diagnostico', 'estudo', 'proposta', 'negociacao', 'ganho', 'ganho', 'perdido'];
      d.comercial = { contas: E.map((e, i) => ({ id: 'c' + i, razao: 'Empresa ' + i, origem: ['Indicação', 'Prospecção ativa', 'LinkedIn'][i % 3], contatos: [] })), negocios: E.map((e, i) => ({ id: 'n' + i, contaId: 'c' + i, etapa: e, mensalidade: 2000 + i * 300, meses: 12, criadoEm: mes(5), fechadoEm: e === 'ganho' ? mes(i % 3) : null, historicoEtapas: [] })), atividades: [{ id: 'a1', contaId: 'c1', tipo: 'ligacao', titulo: 'Ligar para Empresa 1', data: iso(-2), feita: false }], propostas: [] };
      d.propostas = [{ id: 'p1', status: 'rascunho', itens: [] }, { id: 'p2', status: 'enviada', itens: [] }, { id: 'p3', status: 'enviada', itens: [] }, { id: 'p4', status: 'vencida', itens: [] }];
      d.documentos = [{ id: 'd1', nome: 'CND Federal', validade: iso(60) }, { id: 'd2', nome: 'CNDT', validade: iso(3) }, { id: 'd3', nome: 'FGTS', validade: iso(-5) }, { id: 'd4', nome: 'Estadual', validade: iso(90) }];
      d.agenda = { tarefas: [{ id: 't1', titulo: 'Sessão', data: iso(0) }, { id: 't2', titulo: 'Proposta', data: iso(1) }, { id: 't3', titulo: 'Proposta 2', data: iso(1) }, { id: 't4', titulo: 'Atrasada', data: iso(-1) }], listas: [] };
      d.financas = { perfis: [{ id: 'pf', nome: 'Seven' }], perfilAtivo: 'pf', contas: [], cartoes: [], categorias: [{ id: 'cat1', nome: 'Pessoal', tipo: 'despesa' }, { id: 'cat2', nome: 'Software', tipo: 'despesa' }], lancamentos: [0, 1, 2, 3, 4, 5].flatMap(k => [{ id: 'r' + k, perfil: 'pf', tipo: 'receita', valor: 20000 + k * 1500, data: mes(k), pago: true }, { id: 'x' + k, perfil: 'pf', tipo: 'despesa', categoria: k % 2 ? 'cat1' : 'cat2', valor: 12000 + k * 800, data: mes(k), pago: true }]), orcamentos: [], metas: [] };
      d.notas = [0, 1, 2, 3].map(k => ({ id: 'nf' + k, operacao: 'saida', situacao: 'autorizada', emissao: mes(k), totalNota: 30000 + k * 5000 }));
      Dados.salvar();
    });
    await pg.goto(url + '#/painel'); await pg.waitForSelector('.pn-grade');
    ok((await ordem()).join() === 'kpis,sessoes,prazos,com-funil,fin-fluxo,propostas,documentos,agenda,pendencias,com-ganhos,nf-faturamento,atalhos', 'painel padrão com 12 blocos');
    ok(await pg.locator('.pn-bloco svg.gf').count() >= 6, 'gráficos desenhados');
    ok(/⚠/.test(await pg.locator('[data-id=kpis]').innerText()), 'indicador de alerta com ícone (não só cor)');
    ok(/Vencidos[\s\S]*1/.test(await pg.locator('[data-id=documentos] .gf-leg').innerText()), 'documentos: legenda com valor');
    ok(/1 tarefa atrasada/.test(await pg.locator('[data-id=agenda]').innerText()), 'agenda: atrasadas sinalizadas');
    // dica ao passar o mouse
    const alvo = pg.locator('[data-id=fin-fluxo] .gf-alvo').last(); await alvo.hover();
    await pg.waitForSelector('#pn-dica:not([hidden])'); const dt = await pg.locator('#pn-dica').innerText(); ok(/Receitas: R\$\s.*Despesas: R\$\s/.test(dt), 'dica com receitas e despesas do mês');
    // tabela
    await pg.click('[data-id=fin-fluxo] [data-pn=tabela]'); await pg.waitForSelector('[data-id=fin-fluxo] table');
    ok(await pg.locator('[data-id=fin-fluxo] tbody tr').count() === 6 && /Resultado/.test(await pg.locator('[data-id=fin-fluxo] thead').innerText()), 'versão em tabela');
    await pg.click('[data-id=fin-fluxo] [data-pn=tabela]'); await pg.waitForSelector('[data-id=fin-fluxo] svg');
    await foto('painel-graficos');
    // personalizar
    await pg.click('[data-pn=editar]'); await pg.waitForSelector('.pn-grade.editando');
    await pg.click('[data-id=sessoes] [data-pn=tirar]'); ok(!(await ordem()).includes('sessoes'), 'retirar bloco');
    await pg.click('[data-id=fin-fluxo] [data-pn=esq]'); ok((await ordem()).indexOf('fin-fluxo') === 2, 'mover com ↑');
    await pg.click('[data-id=fin-fluxo] [data-pn=dir]'); ok((await ordem()).indexOf('fin-fluxo') === 3, 'mover com ↓');
    await pg.click('[data-id=documentos] [data-pn=tam]'); ok(await pg.locator('[data-id=documentos].pn-m').count() === 1, 'redimensionar P → M');
    await pg.click('[data-pn=add]'); await pg.waitForSelector('.modal .pn-cat');
    ok(await pg.locator('.modal .pn-cat input[value=sessoes]').count() === 1 && await pg.locator('.modal .pn-cat input[value=kpis]').count() === 0, 'catálogo só com blocos fora do painel');
    await pg.check('.modal input[value=com-origem]'); await pg.check('.modal input[value=fin-categorias]'); await pg.check('.modal input[value=semanas]'); await pg.click('.modal [type=submit]');
    await pg.waitForSelector('[data-id=com-origem]'); ok((await ordem()).slice(-3).join() === 'com-origem,fin-categorias,semanas', 'adicionar blocos (vão para o fim)');
    // arrastar (blocos vizinhos, ambos visíveis)
    await pg.locator('[data-id=semanas]').scrollIntoViewIfNeeded();
    await pg.locator('[data-id=semanas] .pn-alca').dragTo(pg.locator('[data-id=com-origem]'), { targetPosition: { x: 10, y: 10 } });
    const o2 = await ordem(); ok(o2.indexOf('semanas') === o2.indexOf('com-origem') - 1, 'arrastar para reordenar');
    for (let i = 0; i < 15; i++) { const o = await ordem(); if (o[0] === 'com-origem') break; await pg.click('[data-id=com-origem] [data-pn=esq]'); }
    await pg.click('[data-pn=editar]'); await pg.reload(); await pg.waitForSelector('.pn-grade');
    ok((await ordem())[0] === 'com-origem' && !(await ordem()).includes('sessoes') && await pg.locator('[data-id=documentos].pn-m').count() === 1, 'personalização persiste após recarregar');
    ok(/Indicação/.test(await pg.locator('[data-id=com-origem] .gf-leg').innerText()) && /Software/.test(await pg.locator('[data-id=fin-categorias] .gf-leg').innerText()), 'blocos novos com dados');
    await foto('painel-personalizado');
    await pg.click('[data-pn=editar]'); await pg.click('[data-pn=padrao]'); await pg.click('.modal [type=submit]'); await pg.waitForFunction(() => document.querySelectorAll('.pn-bloco').length === 12);
    ok((await ordem())[0] === 'kpis', 'restaurar padrão'); await pg.click('[data-pn=editar]');
    // escuro e celular
    await pg.emulateMedia({ colorScheme: 'dark' }); await pg.reload(); await pg.waitForSelector('.pn-grade'); await foto('painel-escuro');
    await pg.emulateMedia({ colorScheme: 'light' });
    for (const w of [1024, 390]) { await pg.setViewportSize({ width: w, height: 900 }); await pg.reload(); await pg.waitForSelector('.pn-grade'); ok(await pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'sem rolagem lateral em ' + w + ' px'); await foto('painel-' + w); }
  } catch (x) { await foto('painel-erro'); throw x; }
  await t.fechar();
})().catch(e => { console.error(e); process.exit(1); });
