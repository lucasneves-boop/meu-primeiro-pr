// Seven Comissão: performance do cliente e relatório do mês com dados do Seven Processo; relatório da simulação.
// Uso: node testes/comissao-relatorios.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t;
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
    await pg.goto(url + '#/comissao'); await pg.waitForSelector('.cm-abas'); ok(await pg.locator('.cm-abas a').count() === 3, 'abas: simulador, performance e relatório do mês');
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
    await pg.emulateMedia({ media: 'print' }); ok(await pg.locator('.lateral').isHidden() && await pg.locator('.cm-rel-form').isHidden() && await pg.locator('.cm-relatorio').isVisible(), 'na impressão só aparece o relatório'); await pg.emulateMedia({ media: 'screen' });
    // relatório completo da simulação
    await pg.goto(url + '#/comissao'); await pg.click('a[href="#/comissao/relatorio"]'); await pg.waitForSelector('.cm-rel-sim');
    txt = await pg.innerText('.cm-rel-sim');
    ok(/Simulação de comissão/.test(txt) && /Funil das licitações/.test(txt) && /Prazo para recebimento/.test(txt) && /Quanto você recebe em cada cenário/.test(txt) && /Prazo de retorno/.test(txt), 'relatório completo da simulação com todos os números');
    await pg.evaluate(() => { window.__imprimiu = 0; window.print = () => { window.__imprimiu++; }; }); await pg.click('[data-a=imprimir]'); await pg.waitForTimeout(300); ok(await pg.evaluate(() => window.__imprimiu) === 1, 'imprime a simulação');
    await pg.emulateMedia({ media: 'print' }); await pg.screenshot({ path: path.join(saida, 'comissao-rel-impressao.png'), fullPage: true }); await pg.emulateMedia({ media: 'screen' });
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
