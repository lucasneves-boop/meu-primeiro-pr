// Seven Comissão: performance do cliente e relatório do mês com dados do Seven Processo; relatório da simulação.
// Uso: node testes/comissao-relatorios.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t;
  // bibliotecas de PDF: cópia local quando LIBS_PDF aponta para a pasta (sem internet no navegador de teste)
  if (process.env.LIBS_PDF) await pg.context().route(/cdnjs\.cloudflare\.com\/ajax\/libs\/(html2canvas|jspdf)\//, r => { const f = /html2canvas/.test(r.request().url()) ? 'html2canvas.min.js' : 'jspdf.umd.min.js'; r.fulfill({ status: 200, contentType: 'text/javascript', body: require('fs').readFileSync(path.join(process.env.LIBS_PDF, f)) }); });
  const preencher = async (sel, v) => { await pg.fill(sel, v); await pg.press(sel, 'Tab'); await pg.waitForTimeout(120); };
  try {
    await pg.goto(url + '#/quadros'); await pg.waitForSelector('#botao-tema'); await pg.waitForTimeout(300);
    // cliente e cartões no Seven Processo
    await pg.evaluate(() => {
      const d = Dados.e; d.empresas.push({ id: 'cliA', razao: 'Alfa Distribuidora LTDA', fantasia: 'Alfa', cnpj: '11222333000181' }); d.empresaAtiva = 'cliA';
      const q = d.quadros.find(x => !x.arquivado && x.listas.some(l => l.nome === 'Oportunidade')); const L = n => q.listas.find(l => l.nome === n).id; const et = n => q.etiquetas.find(x => x.nome === n).id;
      const mes = new Date().toISOString().slice(0, 7); const hoje = new Date().toISOString().slice(0, 10);
      const c = (titulo, lista, extra) => q.cartoes.push(Object.assign({ id: 'c' + Math.random().toString(36).slice(2, 8), titulo, lista: L(lista), etiquetas: [], membros: [], checklists: [], comentarios: [], anexos: [], votos: [], valores: { orgao: 'Prefeitura de Catalão' }, empresaId: 'cliA', criadoEm: new Date().toISOString(), atividade: [] }, extra));
      c('PE 10/2026 · Material de limpeza', 'Proposta'); c('PE 11/2026 · Copa e cozinha', 'Disputa');
      c('PE 08/2026 · Papelaria', 'Disputa', { etiquetas: [et('Perdida')], atualizadoEm: new Date().toISOString() });
      c('PE 05/2026 · Gêneros alimentícios', 'Pagamento', { etiquetas: [et('Ganha')], atividade: [{ em: new Date().toISOString(), texto: 'moveu de "Habilitação / Recurso" para "Contrato"' }],
        execucao: { valor: 120000, empenhos: [{ id: 'e1', numero: '2026NE001', valor: 120000 }], notas: [{ id: 'n1', numero: '501', data: hoje, valor: 60000, vencimento: '2099-12-31' }, { id: 'n2', numero: '502', data: hoje, valor: 30000, vencimento: '2000-01-01' }], pagamentos: [{ id: 'g1', notaId: 'n1', data: hoje, valor: 60000 }] } });
      Dados.e.comissao = { base: 'venda', pct: '5', venda: '120.000', alvo: '5.000' }; Dados.salvar();
    });
    await pg.goto(url + '#/comissao'); await pg.waitForSelector('.cm-abas'); ok(await pg.locator('.cm-abas a').count() === 5, 'abas: simulador, licitações ganhas, performance, relatório do mês e extrato');
    // performance
    await pg.click('.cm-abas a[href="#/comissao/performance"]'); await pg.waitForSelector('#cm-perf-f');
    ok(await pg.inputValue('#cm-perf-f [name=cliente]') === 'cliA', 'abre no cliente ativo');
    let txt = await pg.innerText('.cm-relatorio');
    ok(/Licitações acompanhadas\s*4/.test(txt) && /Ganhas\s*1/.test(txt) && /Perdidas\s*1/.test(txt) && /Taxa de sucesso\s*50%/.test(txt), 'números do cliente vindos do Seven Processo');
    ok(/Valor ganho\s*R\$\s?120\.000,00/.test(txt) && /Recebido\s*R\$\s?60\.000,00/.test(txt) && /A receber\s*R\$\s?30\.000,00/.test(txt) && /Em atraso\s*R\$\s?30\.000,00/.test(txt), 'execução: ganho, recebido, a receber e atraso');
    ok(/Comissão sobre o recebido\s*R\$\s?3\.000,00/.test(txt), 'comissão de 5% sobre o recebido');
    ok(/R\$\s?3\.000,00 de R\$\s?5\.000,00 \(60%\)/.test(txt), 'progresso da meta do mês');
    ok(await pg.locator('.cm-relatorio a[href^="#/quadros/"]').count() >= 3, 'licitações com link para o cartão no Seven Processo');
    // condições do cliente
    await pg.fill('#cm-perf-f [name=pct]', '10'); await pg.press('#cm-perf-f [name=pct]', 'Tab'); await pg.waitForTimeout(150);
    ok(/Comissão sobre o recebido\s*R\$\s?6\.000,00/.test(await pg.innerText('.cm-relatorio')), 'condições da comissão por cliente');
    await foto('comissao-performance');
    await pg.click('[data-a=usar-funil]'); await pg.waitForSelector('#cm-funil');
    ok(await pg.inputValue('#cm-funil [name=f_encontrados]') === '4' && await pg.isChecked('#cm-funil input[name=funilModo][value=qtd]'), 'funil real levado para o simulador');
    // relatório do mês
    await pg.goto(url + '#/comissao/mes'); await pg.waitForSelector('#cm-mes-f');
    txt = await pg.innerText('.cm-relatorio');
    ok(/Ganhas no mês\s*1/.test(txt) && /Faturado no mês\s*R\$\s?90\.000,00/.test(txt) && /Recebido no mês\s*R\$\s?60\.000,00/.test(txt) && /Comissão do mês \(sobre o recebido\)\s*R\$\s?6\.000,00/.test(txt), 'relatório do mês');
    ok(await pg.locator('.cm-relatorio tr.cm-total').count() === 1 && /501/.test(txt) && /502/.test(txt), 'NFs e pagamentos do mês listados');
    await pg.fill('#cm-mes-f [name=mes]', '2020-01'); await pg.dispatchEvent('#cm-mes-f [name=mes]', 'change'); await pg.waitForTimeout(150);
    ok(/Recebido no mês\s*R\$\s?0,00/.test(await pg.innerText('.cm-relatorio')) && /janeiro de 2020/.test(await pg.innerText('.cm-relatorio')), 'troca o mês');
    await pg.selectOption('#cm-mes-f [name=cliente]', ''); await pg.waitForTimeout(150); ok(/todos os clientes/.test(await pg.innerText('.cm-relatorio')), 'todos os clientes');
    // impressão
    await pg.evaluate(() => { window.__imprimiu = 0; window.print = () => { window.__imprimiu++; }; });
    await pg.click('[data-a=imprimir]'); await pg.waitForTimeout(300); ok(await pg.evaluate(() => window.__imprimiu) === 1, 'imprime o relatório do mês');
    // PDF (no claude.ai a impressão é bloqueada; o PDF é o caminho)
    const [arq] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click('[data-a=pdf]')]);
    const bin = require('fs').readFileSync(await arq.path()); ok(bin.slice(0, 4).toString() === '%PDF' && bin.length > 20000 && /^seven-comissao-mes-/.test(arq.suggestedFilename()), 'baixa o relatório do mês em PDF (' + Math.round(bin.length / 1024) + ' KB)');
    await pg.emulateMedia({ media: 'print' }); ok(await pg.locator('.lateral').isHidden() && await pg.locator('.cm-rel-form').isHidden() && await pg.locator('.cm-relatorio').isVisible(), 'na impressão só aparece o relatório'); await pg.emulateMedia({ media: 'screen' });
    // envio do resumo do mês (texto para revisão antes de abrir o WhatsApp)
    await pg.selectOption('#cm-mes-f [name=cliente]', 'cliA'); await pg.waitForSelector('[data-a=enviar-whatsapp]:not([disabled])');
    await pg.fill('#cm-mes-f [name=mes]', new Date().toISOString().slice(0, 7)); await pg.dispatchEvent('#cm-mes-f [name=mes]', 'change'); await pg.waitForTimeout(150);
    await pg.click('[data-a=enviar-whatsapp]'); await pg.waitForSelector('.modal textarea[name=t]');
    const msg = await pg.inputValue('.modal textarea[name=t]');
    ok(/Ganhas: 1 \(R\$\s?120\.000,00\)/.test(msg) && /Recebido: R\$\s?60\.000,00/.test(msg) && /Lucas Neves \| Seven/.test(msg) && /\(61\) 98347-2232/.test(msg), 'resumo do mês pronto para revisar, com assinatura');
    await pg.click('.modal .cancelar');
    // condições avançadas do cliente: faixas, fixo, parceiros e Seven Financeiro automático
    await pg.goto(url + '#/comissao/performance'); await pg.waitForSelector('#cm-perf-f');
    await pg.evaluate(() => document.querySelectorAll('.cm-avancado').forEach(d => { d.open = true; }));
    await pg.check('#cm-perf-f [name=usarFaixas]'); await pg.waitForSelector('#cm-perf-f .cm-faixas:not([hidden])');
    await preencher('#cm-perf-f [name=faixa_ate_0]', '100.000'); await preencher('#cm-perf-f [name=faixa_pct_0]', '5'); await preencher('#cm-perf-f [name=faixa_pct_1]', '8');
    let pt = await pg.innerText('.cm-relatorio');
    ok(/Comissão prevista \(ganhos\)\s*R\$\s?9\.600,00/.test(pt), 'faixa: 120 mil cai na faixa de 8%');
    await pg.click('#cm-perf-f [data-a=add-parceiro]'); await pg.waitForSelector('#cm-perf-f [name=parc_nome_0]');
    await preencher('#cm-perf-f [name=parc_nome_0]', 'Carlos Indicador'); await preencher('#cm-perf-f [name=parc_pct_0]', '25');
    ok(/Comissão prevista \(ganhos\)\s*R\$\s?7\.200,00/.test(await pg.innerText('.cm-relatorio')) && /parceiros: Carlos Indicador 25%/.test(await pg.innerText('.cm-relatorio')), 'parceiro fica com 25% da comissão');
    await preencher('#cm-perf-f [name=fixo]', '1.500'); await pg.fill('#cm-perf-f [name=fixoDesde]', new Date().toISOString().slice(0, 7)); await pg.press('#cm-perf-f [name=fixo]', 'Tab'); await pg.waitForTimeout(150);
    ok(/Mensalidade do BPO\s*R\$\s?1\.500,00/.test(await pg.innerText('.cm-relatorio')), 'fixo mensal na performance');
    await foto('comissao-perf-avancado');
    // extrato
    await pg.click('.cm-abas a[href="#/comissao/extrato"]'); await pg.waitForSelector('#cm-ext-f');
    let ex = await pg.innerText('.cm-relatorio');
    ok(await pg.locator('.cm-relatorio tbody tr').count() === 2 && /A cobrar\s*R\$\s?5\.100,00/.test(ex), 'extrato: comissão do pagamento (60 mil × 8% × 75%) + mensalidade');
    ok(/Carlos Indicador R\$\s?1\.200,00 \(pendente\)/.test(ex), 'repasse do parceiro no extrato');
    await pg.click('[data-a=lancar-todas]'); await pg.waitForTimeout(150);
    ex = await pg.innerText('.cm-relatorio'); ok(/Cobrada\s*R\$\s?5\.100,00/.test(ex), 'cobranças lançadas no Seven Financeiro');
    ok(await pg.evaluate(() => Dados.e.financas.lancamentos.filter(l => /^comissao:/.test(l.origem)).length) === 2, 'contas a receber criadas no Seven Financeiro');
    // baixa no financeiro → recebida → repasse
    await pg.evaluate(() => { Dados.e.financas.lancamentos.filter(l => /^comissao:pg:/.test(l.origem)).forEach(l => { l.pago = true; }); Dados.salvar(); });
    await pg.reload(); await pg.waitForSelector('#cm-ext-f'); ex = await pg.innerText('.cm-relatorio');
    ok(/Recebida\s*R\$\s?3\.600,00/.test(ex) && await pg.locator('[data-a=repasses]').count() === 1, 'baixa no financeiro marca como recebida');
    await pg.click('[data-a=repasses]'); await pg.waitForTimeout(150);
    ok(await pg.evaluate(() => Dados.e.financas.lancamentos.filter(l => /^repasse:/.test(l.origem) && l.tipo === 'despesa' && l.valor === 1200).length) === 1, 'repasse lançado em contas a pagar');
    // automático
    await pg.goto(url + '#/comissao/performance'); await pg.waitForSelector('#cm-perf-f'); await pg.evaluate(() => document.querySelectorAll('.cm-avancado').forEach(d => { d.open = true; }));
    await pg.check('#cm-perf-f [name=autoFinanceiro]'); await pg.waitForTimeout(150);
    await pg.evaluate(() => { const q = Dados.e.quadros.find(x => x.listas.some(l => l.nome === 'Oportunidade')); const c = q.cartoes.find(k => k.execucao); c.execucao.pagamentos.push({ id: 'g2', notaId: 'n2', data: new Date().toISOString().slice(0, 10), valor: 30000 }); Dados.salvar(); });
    ok(await pg.evaluate(() => Dados.e.financas.lancamentos.some(l => /^comissao:pg:.*:g2$/.test(l.origem) && Math.abs(l.valor - 1800) < 0.01)), 'novo pagamento do órgão gera a cobrança automaticamente');
    await pg.goto(url + '#/comissao/extrato'); await pg.waitForSelector('#cm-ext-f'); await foto('comissao-extrato');
    // simulador: faixas e fixo
    await pg.goto(url + '#/comissao'); await pg.waitForSelector('#cm-form'); await pg.evaluate(() => document.querySelectorAll('.cm-avancado').forEach(d => { d.open = true; }));
    await pg.fill('#cm-form [name=venda]', '800.000'); await pg.fill('#cm-form [name=alvo]', ''); await pg.check('#cm-form [name=usarFaixas]');
    await pg.fill('#cm-form [name=faixa_ate_0]', '500.000'); await pg.fill('#cm-form [name=faixa_pct_0]', '3'); await pg.fill('#cm-form [name=faixa_pct_1]', '5'); await pg.selectOption('#cm-form [name=faixaModo]', 'progressiva');
    ok(/R\$\s?30\.000,00/.test(await pg.innerText('#cm-res')) && /efetivo 3,75%/.test(await pg.innerText('#cm-res')), 'simulador com faixas progressivas');
    await pg.fill('#cm-form [name=fixo]', '2.000'); ok(/Total no mês \(comissão \+ fixo\)\s*R\$\s?32\.000,00/.test(await pg.innerText('#cm-res')), 'simulador com fixo mensal');
    await pg.uncheck('#cm-form [name=usarFaixas]'); await pg.fill('#cm-form [name=fixo]', '');
    // relatório completo da simulação
    await pg.goto(url + '#/comissao'); await pg.click('a[href="#/comissao/relatorio"]'); await pg.waitForSelector('.cm-rel-sim');
    txt = await pg.innerText('.cm-rel-sim');
    ok(/Simulação de comissão/.test(txt) && /Funil das licitações/.test(txt) && /Prazo para recebimento/.test(txt) && /Quanto você recebe em cada cenário/.test(txt) && /Prazo de retorno/.test(txt), 'relatório completo da simulação com todos os números');
    await pg.evaluate(() => { window.__imprimiu = 0; window.print = () => { window.__imprimiu++; }; }); await pg.click('[data-a=imprimir]'); await pg.waitForTimeout(300); ok(await pg.evaluate(() => window.__imprimiu) === 1, 'imprime a simulação');
    await pg.emulateMedia({ media: 'print' }); await pg.screenshot({ path: path.join(saida, 'comissao-rel-impressao.png'), fullPage: true }); await pg.emulateMedia({ media: 'screen' });
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
