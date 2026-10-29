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
    await pg.goto(url + '#/comissao'); await pg.waitForSelector('.cm-abas'); ok(await pg.locator('.cm-abas a').count() === 5 && await pg.locator('.cm-abas a[href="#/relatorios"]').count() === 1, 'Seven Comissão: simulador, licitações ganhas, condições, extrato e atalho para o Seven Relatórios');
    await pg.goto(url + '#/comissao/performance'); await pg.waitForFunction(() => location.hash === '#/relatorios'); ok(true, 'o antigo relatório do cliente na comissão leva ao Seven Relatórios');
    // condições do cliente (comissão)
    await pg.goto(url + '#/comissao/condicoes'); await pg.waitForSelector('#cm-cond-f');
    ok(await pg.inputValue('#cm-cond-f [name=cliente]') === 'cliA', 'condições abrem no cliente ativo');
    await preencher('#cm-cond-f [name=pct]', '10'); ok(/Resumo: 10% sobre o preço de venda/.test(await pg.innerText('#cm-cond-f')), 'condições da comissão por cliente');
    await pg.click('[data-a=usar-funil]'); await pg.waitForSelector('#cm-funil');
    ok(await pg.inputValue('#cm-funil [name=f_encontrados]') === '4' && await pg.isChecked('#cm-funil input[name=funilModo][value=qtd]'), 'funil real levado para o simulador');
    // Seven Relatórios: relatório de performance do cliente
    await pg.goto(url + '#/relatorios'); await pg.waitForSelector('#rl-f');
    ok(await pg.locator('.menu a[data-rota=relatorios].ativo').count() === 1 && await pg.inputValue('#rl-f [name=cliente]') === 'cliA', 'Seven Relatórios no menu, no cliente ativo');
    let txt = await pg.innerText('.cm-relatorio');
    ok(/Relatório de performance · Alfa/.test(txt) && /Estamos avançando/.test(txt), 'cabeçalho e veredito do período');
    ok(/Licitações ganhas\s*1/.test(txt) && /Taxa de sucesso\s*50%/.test(txt) && /Valor ganho\s*R\$\s?120\.000,00/.test(txt) && /Faturado\s*R\$\s?90\.000,00/.test(txt) && /Recebido\s*R\$\s?60\.000,00/.test(txt), 'números do período vindos do Seven Processo');
    ok(/A receber \(total\)\s*R\$\s?30\.000,00/.test(txt) && /R\$\s?30\.000,00 em atraso/.test(txt), 'a receber e atraso');
    ok(/O valor ganho cresceu: de R\$\s?0,00 para R\$\s?120\.000,00/.test(txt) && /notas fiscais vencidas/.test(txt), 'leitura do período em frases');
    ok(await pg.locator('.rl-graf svg').count() === 1 && await pg.locator('.rl tr.rl-no-periodo').count() === 1, 'evolução mês a mês com gráfico e o mês do período destacado');
    ok(await pg.locator('.cm-relatorio a[href^="#/quadros/"]').count() >= 3 && !/Comissão da Seven/.test(txt), 'licitações com link para o cartão; comissão fora do relatório por padrão');
    await pg.check('#rl-f [name=comissao]'); await pg.waitForTimeout(150);
    ok(/Comissão do período \(sobre o recebido\)\s*R\$\s?6\.000,00/.test(await pg.innerText('.cm-relatorio')), 'comissão da Seven quando marcada (10% de 60 mil)');
    await pg.uncheck('#rl-f [name=comissao]'); await pg.waitForTimeout(150);
    await foto('relatorios-cliente');
    // períodos
    await pg.fill('#rl-f [name=mes]', '2020-01'); await pg.dispatchEvent('#rl-f [name=mes]', 'change'); await pg.waitForTimeout(150);
    ok(/janeiro de 2020/.test(await pg.innerText('.cm-relatorio')) && /Licitações ganhas\s*0/.test(await pg.innerText('.cm-relatorio')), 'troca o mês');
    await pg.selectOption('#rl-f [name=tipo]', 'ano'); await pg.waitForSelector('#rl-f [name=ano]'); ok(/ano de \d{4} · comparado com janeiro de \d{4} a dezembro de \d{4}/.test(await pg.innerText('.cm-relatorio')), 'período anual comparado com o ano anterior');
    await pg.selectOption('#rl-f [name=tipo]', 'trimestre'); await pg.waitForSelector('#rl-f [name=trimestre]'); ok(/trimestre de \d{4}/.test(await pg.innerText('.cm-relatorio')), 'período trimestral');
    await pg.selectOption('#rl-f [name=tipo]', 'mes'); await pg.waitForSelector('#rl-f [name=mes]'); await pg.fill('#rl-f [name=mes]', new Date().toISOString().slice(0, 7)); await pg.dispatchEvent('#rl-f [name=mes]', 'change'); await pg.waitForTimeout(150);
    await pg.selectOption('#rl-f [name=cliente]', ''); await pg.waitForTimeout(150); ok(/todos os clientes/.test(await pg.innerText('.cm-relatorio')), 'todos os clientes');
    // impressão e PDF
    await pg.evaluate(() => { window.__imprimiu = 0; window.print = () => { window.__imprimiu++; }; });
    await pg.click('[data-a=imprimir]'); await pg.waitForTimeout(300); ok(await pg.evaluate(() => window.__imprimiu) === 1, 'imprime o relatório');
    const [arq] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click('[data-a=pdf]')]);
    const bin = require('fs').readFileSync(await arq.path()); ok(bin.slice(0, 4).toString() === '%PDF' && bin.length > 20000 && /^seven-relatorio-performance-/.test(arq.suggestedFilename()), 'baixa o relatório em PDF (' + Math.round(bin.length / 1024) + ' KB)');
    await pg.emulateMedia({ media: 'print' }); ok(await pg.locator('.lateral').isHidden() && await pg.locator('#rl-f').isHidden() && await pg.locator('.cm-relatorio').isVisible(), 'na impressão só aparece o relatório'); await pg.emulateMedia({ media: 'screen' });
    // envio ao cliente
    await pg.selectOption('#rl-f [name=cliente]', 'cliA'); await pg.waitForSelector('[data-a=whatsapp]:not([disabled])');
    await pg.click('[data-a=whatsapp]'); await pg.waitForSelector('.modal textarea[name=t]');
    const msg = await pg.inputValue('.modal textarea[name=t]');
    ok(/Licitações ganhas: 1/.test(msg) && /Valor ganho: R\$\s?120\.000,00/.test(msg) && /Estamos avançando/.test(msg) && /Lucas Neves \| Seven/.test(msg) && /\(61\) 98347-2232/.test(msg), 'relatório pronto para revisar e enviar, com assinatura');
    await pg.click('.modal .cancelar');
    // base de performance
    await pg.click('.abas a[href="#/relatorios/base"]'); await pg.waitForSelector('.abas a.ativa[href="#/relatorios/base"]');
    ok(await pg.locator('.cm-relatorio tbody tr').count() === 1 && /avançando/.test(await pg.innerText('.cm-relatorio tbody')), 'base de performance com todos os clientes');
    await pg.click('.cm-relatorio [data-cliente=cliA]'); await pg.waitForSelector('#rl-f [name=cliente]'); ok(await pg.inputValue('#rl-f [name=cliente]') === 'cliA', 'da base para o relatório do cliente');
    // seções complementares: trabalho, perdas, concorrência, distribuição, metas, parecer, agenda, habilitação e histórico
    await pg.evaluate(() => {
      const d = Dados.e; const agora = new Date().toISOString(); const em = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
      d.propostas.push({ id: 'pptX', empresaId: 'cliA', avisoId: 'avX', objeto: 'Uniformes', orgao: 'UFG', numero: '20/2026', modalidade: 'PE', criadaEm: agora, enviadaEm: agora, encerramento: em(5) + 'T09:00:00', itens: [{ refUnitaria: 50, quantidade: 100 }] });
      d.pecas = [{ id: 'pc1', modelo: 'impugnacao', empresaId: 'cliA', criadaEm: agora, titulo: 'Impugnação' }];
      d.documentos.push({ id: 'dc1', empresaId: 'cliA', nome: 'CND Estadual', validade: em(10), criadoEm: agora }, { id: 'dc2', empresaId: 'cliA', nome: 'CRF FGTS', validade: em(-3), criadoEm: '2020-01-01T00:00:00Z' });
      const q = d.quadros.find(x => x.listas.some(l => l.nome === 'Oportunidade')); q.cartoes.find(c => /Gêneros/.test(c.titulo)).licitacao = { valorEstimado: 150000, uf: 'GO' };
      Dados.salvar();
    });
    await pg.goto(url + '#/quadros'); await pg.goto(url + '#/relatorios'); await pg.waitForSelector('.rl-trabalho');
    txt = await pg.innerText('.cm-relatorio');
    ok(/Propostas enviadas\s*1/.test(txt) && /Impugnações\s*1/.test(txt) && /Oportunidades avaliadas\s*4/.test(txt), 'trabalho da Seven no período');
    ok(/Onde ganhamos/.test(txt) && /Prefeitura de Catalão/.test(txt) && /GO/.test(txt), 'licitações por órgão, portal e UF');
    ok(/Deságio médio nas ganhas\s*20%/.test(txt), 'deságio sobre o estimado');
    ok(/Agenda dos próximos 30 dias/.test(txt) && /Sessão 20\/2026 · UFG/.test(txt) && /Vence: CND Estadual/.test(txt), 'agenda com a próxima sessão e o vencimento (mesma fonte da Seven Agenda)');
    ok(/Vencem em 30 dias\s*1/.test(txt) && /Vencidos\s*1/.test(txt) && /CRF FGTS/.test(txt), 'situação da habilitação');
    await pg.click('[data-perda]'); await pg.waitForSelector('.modal [name=motivo]');
    await pg.selectOption('.modal [name=motivo]', 'preco'); await pg.fill('.modal [name=vencedor]', 'Concorrente X'); await pg.fill('.modal [name=valorVencedor]', '9.000'); await pg.fill('.modal [name=nossoValor]', '10.000'); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(200);
    txt = await pg.innerText('.cm-relatorio');
    ok(/Por que perdemos/.test(txt) && /Preço \(perdeu nos lances\)\s*1 · 100%/.test(txt) && /Concorrente X/.test(txt) && /Distância média para o vencedor\s*11,1%/.test(txt), 'motivo da perda, vencedor e distância');
    await pg.click('[data-a=metas]'); await pg.waitForSelector('.modal [name=valorGanho]'); await pg.fill('.modal [name=valorGanho]', '100.000'); await pg.fill('.modal [name=ganhas]', '2'); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(200);
    txt = await pg.innerText('.cm-relatorio');
    ok(/Metas do período/.test(txt) && /R\$\s?120\.000,00 de R\$\s?100\.000,00 \(120%\)/.test(txt) && /1 de 2 \(50%\)/.test(txt) && /Meta de valor ganho: 120% atingida/.test(txt), 'metas com progresso e na leitura');
    await pg.click('.rl-vazia [data-a=parecer]'); await pg.waitForSelector('.modal [name=parecer]');
    await pg.fill('.modal [name=analisados]', '15'); await pg.fill('.modal [name=parecer]', 'Mês forte em alimentação.'); await pg.fill('.modal [name=proximos]', '- Renovar o CRF\n- Disputar o PE 20/2026'); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(200);
    txt = await pg.innerText('.cm-relatorio');
    ok(/Parecer da Seven/.test(txt) && /Mês forte em alimentação/.test(txt) && await pg.locator('.rl-parecer li').count() === 2 && /Editais analisados\s*15/.test(txt), 'parecer, próximos passos e editais analisados');
    await foto('relatorios-completo');
    await pg.evaluate(() => { document.querySelector('.rl-secoes').open = true; }); await pg.uncheck('#rl-f [name=sec_agenda]'); await pg.waitForTimeout(150);
    ok(!/Agenda dos próximos 30 dias/.test(await pg.innerText('.cm-relatorio')) && await pg.evaluate(() => document.querySelector('.rl-secoes').open), 'escolhe as seções do relatório');
    await pg.click('[data-a=whatsapp]'); await pg.waitForSelector('.modal textarea[name=t]');
    ok(/Próximos passos:\n• Renovar o CRF\n• Disputar o PE 20\/2026/.test(await pg.inputValue('.modal textarea[name=t]')), 'próximos passos na mensagem');
    await pg.evaluate(() => { window.open = () => null; }); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(150);
    const [arq2] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click('[data-a=pdf]')]); ok(/^seven-relatorio-performance-/.test(arq2.suggestedFilename()), 'PDF com as seções novas');
    await pg.click('.abas a[href="#/relatorios/historico"]'); await pg.waitForSelector('#rl-hf');
    const hist = await pg.innerText('.cartao table');
    ok(await pg.locator('[data-reabrir]').count() === 4 && /WhatsApp/.test(hist) && /pdf/.test(hist) && /impressão/.test(hist), 'histórico: impressão, PDFs e WhatsApp enviados (o cancelado não conta)');
    await pg.selectOption('#rl-hf [name=cliente]', 'cliA'); await pg.waitForTimeout(150); ok(await pg.locator('[data-reabrir]').count() === 2, 'histórico filtrado por cliente');
    await pg.click('[data-reabrir]'); await pg.waitForSelector('#rl-f [name=cliente]'); ok(await pg.inputValue('#rl-f [name=cliente]') === 'cliA', 'reabre o relatório do histórico');
    await pg.click('.abas a[href="#/relatorios/base"]'); await pg.waitForSelector('.abas a.ativa[href="#/relatorios/base"]'); ok(/120%/.test(await pg.innerText('.cm-relatorio tbody')), 'base mostra a meta de cada cliente');
    // condições avançadas do cliente: faixas, fixo, parceiros e Seven Financeiro automático
    await pg.goto(url + '#/comissao/condicoes'); await pg.waitForSelector('#cm-cond-f');
    await pg.evaluate(() => document.querySelectorAll('.cm-avancado').forEach(d => { d.open = true; }));
    await pg.check('#cm-cond-f [name=usarFaixas]'); await pg.waitForSelector('#cm-cond-f .cm-faixas:not([hidden])');
    await preencher('#cm-cond-f [name=faixa_ate_0]', '100.000'); await preencher('#cm-cond-f [name=faixa_pct_0]', '5'); await preencher('#cm-cond-f [name=faixa_pct_1]', '8');
    ok(/faixas 5% até R\$\s?100\.000,00, 8% acima/.test(await pg.innerText('#cm-cond-f')), 'faixas nas condições do cliente');
    await pg.click('#cm-cond-f [data-a=add-parceiro]'); await pg.waitForSelector('#cm-cond-f [name=parc_nome_0]');
    await preencher('#cm-cond-f [name=parc_nome_0]', 'Carlos Indicador'); await preencher('#cm-cond-f [name=parc_pct_0]', '25');
    await preencher('#cm-cond-f [name=fixo]', '1.500'); await pg.fill('#cm-cond-f [name=fixoDesde]', new Date().toISOString().slice(0, 7)); await pg.press('#cm-cond-f [name=fixo]', 'Tab'); await pg.waitForTimeout(150);
    ok(/parceiros: Carlos Indicador 25%/.test(await pg.innerText('#cm-cond-f')) && /fixo de R\$\s?1\.500,00\/mês/.test(await pg.innerText('#cm-cond-f')), 'parceiro e fixo mensal nas condições');
    await pg.goto(url + '#/comissao/ganhas'); await pg.waitForSelector('#cm-gf');
    ok(/Comissão gerada \(contratos\)\s*R\$\s?7\.200,00/.test(await pg.innerText('.cm-relatorio')), 'faixa de 8% sobre 120 mil, menos 25% do parceiro');
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
    await pg.goto(url + '#/comissao/condicoes'); await pg.waitForSelector('#cm-cond-f'); await pg.evaluate(() => document.querySelectorAll('.cm-avancado').forEach(d => { d.open = true; }));
    await pg.check('#cm-cond-f [name=autoFinanceiro]'); await pg.waitForTimeout(150);
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
