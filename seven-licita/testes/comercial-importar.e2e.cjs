// Comercial: importar e exportar contas em massa (CSV e Excel), com prévia, mapeamento de colunas e atualização.
// Uso: node testes/comercial-importar.e2e.cjs [pasta-de-capturas]
const path = require('path'); const fs = require('fs');
const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');

(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t;
  await pg.route(/pncp\.gov\.br|brasilapi|receitaws/, r => r.abort());
  const escolher = async (sel, arq) => { const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click(sel)]); await fc.setFiles(arq); };
  try {
    await pg.goto(url); await pg.evaluate(() => { Dados.e.comercial = { contas: [{ id: 'c1', razao: 'Alfa Comércio LTDA', cnpj: '11222333000181', uf: 'GO', contatos: [], icp: {}, timeline: [], anexos: [], estudos: [] }], negocios: [{ id: 'n1', contaId: 'c1', etapa: 'lead', mensalidade: 2000, meses: 12, criadoEm: '2026-09-01', historicoEtapas: [] }], atividades: [], propostas: [] }; Dados.salvar(); });
    await pg.goto(url + '#/comercial/contas'); await pg.waitForSelector('[data-a=importar]');
    const csv = t.arquivo('leads-rd.csv', 'Empresa;CNPJ;Cidade;Estado;Status;Valor mensal;Nome do contato;E-mail;Celular;Observações\n' +
      'Alfa Comércio LTDA;11.222.333/0001-81;Catalão;GO;Fechado;3.200,00;Ana Souza;ana@alfa.com.br;(64) 99999-0001;Contrato assinado em outubro\n' +
      'Beta Engenharia;;Goiânia;GO;Proposta enviada;2.800,00;Rui Lima;rui@beta.com.br;;\n' +
      'Gama Saúde;12.345.678/0001-00;Brasília;DF;Lead;;Carla;carla@;;\n' +
      ';;;;;;Sem empresa;;;\n' +
      'Beta Engenharia;;Goiânia;GO;;;;;;\n');
    await escolher('[data-a=importar]', csv); await pg.waitForSelector('.modal .cm-imp-res');
    ok(/＋ 2 nova/.test(await pg.locator('.cm-imp-res').innerText()) && /1 já cadastrada/.test(await pg.locator('.cm-imp-res').innerText()) && /2 com erro/.test(await pg.locator('.cm-imp-res').innerText()), 'prévia: 2 novas, 1 existente (pelo CNPJ), 2 com erro');
    ok(/sem nome da empresa/.test(await pg.locator('.cm-imp-prev').innerText()) && /repetida na planilha \(linha 3\)/.test(await pg.locator('.cm-imp-prev').innerText()) && /CNPJ inválido/.test(await pg.locator('.cm-imp-prev').innerText()), 'erros e avisos por linha');
    await foto('comercial-importar');
    // mapeamento manual: tirar a coluna de status muda a etapa da Beta para Lead
    await pg.click('.cm-imp-mapa summary'); await pg.selectOption('[data-campo=etapa]', ''); await pg.waitForFunction(() => /Beta Engenharia.*Lead/s.test(document.querySelector('.cm-imp-prev').innerText.split('\n').find(l => /Beta/.test(l)) || ''));
    ok(true, 'trocar o mapeamento recalcula a prévia'); await pg.selectOption('[data-campo=etapa]', '4');
    await pg.click('.modal [type=submit]'); await pg.waitForSelector('.modal', { state: 'detached' });
    const d = await pg.evaluate(() => ({ contas: Dados.e.comercial.contas, negocios: Dados.e.comercial.negocios }));
    ok(d.contas.length === 3, '3 contas no total (2 novas + 1 atualizada)');
    const alfa = d.contas.find(c => c.id === 'c1'); const nA = d.negocios.find(n => n.contaId === 'c1');
    ok(alfa.municipio === 'Catalão' && alfa.contatos[0].nome === 'Ana Souza' && nA.etapa === 'ganho' && nA.mensalidade === 3200 && nA.fechadoEm, 'existente atualizada: cidade, contato, etapa Ganho e mensalidade');
    ok(alfa.timeline.some(x => /Contrato assinado/.test(x.texto)), 'observação vai para a linha do tempo');
    const beta = d.contas.find(c => c.razao === 'Beta Engenharia'); const nB = d.negocios.find(n => n.contaId === beta.id);
    ok(nB.etapa === 'proposta' && nB.mensalidade === 2800 && beta.contatos[0].email === 'rui@beta.com.br' && beta.origem === 'Base antiga', 'nova conta com negócio na etapa certa');
    const gama = d.contas.find(c => c.razao === 'Gama Saúde'); ok(gama.cnpj === '' && gama.contatos[0].email === '', 'CNPJ e e-mail inválidos não entram');
    ok(await pg.locator('.cm-contas tbody tr').count() === 3, 'tabela de contas mostra as importadas');
    // exportar CSV e reimportar sem duplicar
    await pg.click('[data-a=exportar]'); await pg.selectOption('.modal [name=f]', 'csv');
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('.modal [type=submit]')]);
    const txt = fs.readFileSync(await dl.path(), 'utf8');
    ok(/^contas-todas-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()) && txt.split('\n').length === 4 && /^﻿?Tipo;Razão social/.test(txt) && /Cliente;Alfa Comércio LTDA;;11\.222\.333\/0001-81;Catalão;GO/.test(txt), 'exporta CSV (Excel) com tipo, CNPJ formatado e cidade');
    const exp = t.arquivo('reimportar.csv', txt);
    await escolher('[data-a=importar]', exp); await pg.waitForSelector('.modal .cm-imp-res');
    ok(/＋ 0 nova/.test(await pg.locator('.cm-imp-res').innerText()) && /3 já cadastrada/.test(await pg.locator('.cm-imp-res').innerText()), 'reimportar o próprio arquivo não duplica');
    await pg.click('.modal .cancelar');
    // filtro só clientes + Excel
    await pg.click('[data-a=exportar]'); await pg.selectOption('.modal [name=t]', 'Cliente');
    const [dx] = await Promise.all([pg.waitForEvent('download', { timeout: 30000 }), pg.click('.modal [type=submit]')]);
    const nome = dx.suggestedFilename();
    if (nome.endsWith('.xlsx')) { const b = fs.readFileSync(await dx.path()); ok(b[0] === 0x50 && b[1] === 0x4b, 'exporta Excel (.xlsx) só com clientes'); const xl = t.arquivo('clientes.xlsx', b); await escolher('[data-a=importar]', xl); await pg.waitForSelector('.modal .cm-imp-res'); ok(/1 já cadastrada/.test(await pg.locator('.cm-imp-res').innerText()) && /＋ 0 nova/.test(await pg.locator('.cm-imp-res').innerText()), 'importa planilha Excel (.xlsx)'); await pg.click('.modal .cancelar'); }
    else ok(nome.endsWith('.csv'), 'sem acesso ao leitor de Excel, cai para CSV');
    // modelo
    await pg.click('[data-a=exportar]'); await pg.selectOption('.modal [name=o]', 'modelo'); await pg.selectOption('.modal [name=f]', 'csv');
    const [dm] = await Promise.all([pg.waitForEvent('download'), pg.click('.modal [type=submit]')]);
    ok(/^modelo-importacao-contas/.test(dm.suggestedFilename()), 'modelo de importação');
    // celular
    await pg.setViewportSize({ width: 390, height: 820 }); await pg.reload(); await pg.waitForSelector('[data-a=importar]');
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= 390), 'sem rolagem lateral no celular'); await foto('comercial-contas-celular');
  } catch (x) { await foto('comercial-importar-erro'); throw x; }
  await t.fechar();
})().catch(e => { console.error(e); process.exit(1); });
