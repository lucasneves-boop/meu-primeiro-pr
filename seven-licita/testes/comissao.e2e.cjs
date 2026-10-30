// Seven Comissão: tela com metas e cenários, e a mesma conta em janela flutuante.
// Uso: node testes/comissao.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t;
  const res = () => pg.innerText('#cm-res');
  try {
    await pg.goto(url + '#/comissao'); await pg.waitForSelector('#cm-form');
    ok(await pg.locator('.menu a[data-rota=comissao].ativo').count() === 1, 'Seven Comissão no menu');
    // sobre a venda: 5% de 200 mil, meta 15 mil
    await pg.fill('#cm-form [name=pct]', '5'); await pg.fill('#cm-form [name=venda]', '200.000,00'); await pg.fill('#cm-form [name=alvo]', '15.000');
    let r = await res(); ok(/R\$\s?10\.000,00/.test(r), 'recebe R$ 10.000 sobre a venda');
    ok(/Faltam R\$\s?5\.000,00/.test(r) && /Quanto vender em licitações para receber a meta\s*R\$\s?300\.000,00/.test(r) && /Comissão necessária nesta venda\s*7,5%/.test(r), 'falta, venda necessária e % necessário');
    // sobre o lucro: 30% do lucro com 12% de margem
    await pg.click('#cm-form .cm-pilula:has(input[value=lucro])'); await pg.fill('#cm-form [name=pct]', '30'); await pg.fill('#cm-form [name=margem]', '12'); await pg.fill('#cm-form [name=alvo]', '9.000');
    r = await res(); ok(/R\$\s?7\.200,00/.test(r) && /Quanto vender em licitações para receber a meta\s*R\$\s?250\.000,00/.test(r), 'sobre o lucro: recebe 7.200 e precisa vender 250 mil');
    ok(/Margem líquida necessária\s*15%/.test(r) && /Equivale sobre a venda a\s*3,6%/.test(r), 'margem necessária e equivalência');
    // várias licitações e retenção
    await pg.fill('#cm-form [name=contratos]', '5'); await pg.fill('#cm-form [name=retencao]', '10');
    r = await res(); ok(/Por licitação \(5\)\s*R\$\s?55\.555,56/.test(r), 'divide a venda necessária entre as licitações, com retenção');
    // margem pelos custos
    await pg.check('#cm-form [name=usarCustos]'); await pg.fill('#cm-form [name=custo]', '150.000'); await pg.fill('#cm-form [name=impostos]', '10'); await pg.fill('#cm-form [name=despesas]', '5');
    ok(await pg.inputValue('#cm-form [name=margem]') === '10', 'margem calculada pelos custos: 10%');
    await pg.uncheck('#cm-form [name=usarCustos]'); ok(await pg.inputValue('#cm-form [name=margem]') === '10', 'ao desmarcar, a margem calculada continua no campo'); await pg.fill('#cm-form [name=margem]', '12');
    // cenários
    ok(await pg.locator('.cm-tab').count() === 2, 'tabelas de cenários: quanto recebe e quanto vender');
    ok(await pg.locator('.cm-tab').first().locator('thead th').count() === 8, 'colunas: sobre a venda + 6 margens');
    ok(await pg.locator('.cm-mg').count() === 11, 'margem necessária para cada percentual');
    await pg.fill('#cm-listas [name=pcts]', '10 20 30'); ok(await pg.locator('.cm-tab').first().locator('tbody tr').count() === 3, 'percentuais dos cenários editáveis');
    ok(await pg.locator('.cm-tab tr.cm-atual').count() === 2, 'linha do percentual atual destacada');
    await foto('comissao-tela');
    await pg.reload(); await pg.waitForSelector('#cm-form'); ok(await pg.inputValue('#cm-form [name=pct]') === '30', 'valores ficam salvos');
    // prazo para recebimento, disputas necessárias e retorno
    // funil editável: em % e por quantidades do histórico
    ok(/Taxa de sucesso por disputa:\s*16,15%/.test(await pg.innerText('#cm-funil')), 'funil padrão: 20% × 85% × 95%');
    await pg.fill('#cm-funil [name=f_homologadas]', '100'); await pg.fill('#cm-funil [name=f_contratadas]', '100');
    ok(/Taxa de sucesso por disputa:\s*20%/.test(await pg.innerText('#cm-funil')) && /maior perda em Arrematadas/.test(await pg.innerText('#cm-funil')), 'funil em %: taxa e gargalo');
    ok(await pg.textContent('#cm-funil tr[data-et=disputas] [data-c=nec]') === '25', 'disputas necessárias para 5 contratos');
    // número de editais encontrados editável no modo %
    await pg.fill('#cm-funil [name=f_encontrados]', '250');
    ok(await pg.textContent('#cm-funil tr[data-et=disputas] [data-c=esp]') === '54' && await pg.textContent('#cm-funil tr[data-et=contratadas] [data-c=esp]') === '10,8', 'com 250 editais: 54 disputas e 10,8 contratos');
    await pg.click('[data-a=usar-disputas]'); ok(await pg.inputValue('#cm-extra [name=disputasMes]') === '54', 'leva as disputas do funil para as disputas por mês');
    await pg.reload(); await pg.waitForSelector('#cm-funil'); ok(await pg.inputValue('#cm-funil [name=f_encontrados]') === '250', 'número de editais fica salvo');
    await pg.click('#cm-funil .cm-pilula:has(input[value=qtd])'); await pg.waitForSelector('#cm-funil [name=f_encontrados]:not([disabled])');
    for (const [k, v] of [['encontrados', '200'], ['viaveis', '60'], ['propostas', '50'], ['disputas', '40'], ['vencidas', '10'], ['homologadas', '9'], ['contratadas', '8']]) await pg.fill('#cm-funil [name=f_' + k + ']', v);
    ok(/Taxa de sucesso por disputa:\s*20%/.test(await pg.innerText('#cm-funil')) && /do edital encontrado ao contrato:\s*4%/.test(await pg.innerText('#cm-funil')), 'funil por quantidades: 8 contratos em 40 disputas e 200 editais');
    await pg.click('#cm-funil .cm-pilula:has(input[value=pct])'); await pg.waitForSelector('#cm-funil .cm-pilula input[value=pct]:checked');
    ok(await pg.inputValue('#cm-funil [name=f_homologadas]') === '100', 'os % digitados continuam ao voltar do modo quantidades');
    await pg.click('#cm-funil .cm-pilula:has(input[value=qtd])'); await pg.waitForSelector('#cm-funil [name=f_encontrados]:not([disabled])');
    ok(await pg.inputValue('#cm-funil [name=f_encontrados]') === '200', 'as quantidades também ficam guardadas');
    // as datas abaixo são em dias corridos sem prorrogação; a prorrogação e os dias úteis são conferidos depois
    await pg.evaluate(() => { document.querySelector('.cm-etapas').open = true; }); await pg.uncheck('#cm-extra [name=pzProrrogar]');
    await pg.fill('#cm-extra [name=dataSessao]', '2026-11-02'); await pg.fill('#cm-extra [name=disputasMes]', '10'); await pg.fill('#cm-extra [name=custoDisputa]', '100'); await pg.fill('#cm-extra [name=custoFixo]', '2.000');
    let x = await pg.innerText('#cm-extra-res');
    ok(/O órgão paga por volta de 31\/01\/2027 \(90 dias/.test(x) && /comissão chega por volta de 05\/02\/2027 \(95 dias corridos\)/.test(x), 'prazo para recebimento a partir da sessão');
    ok(/Em média, para a 1ª vitória\s*5 disputas/.test(x) && /90% de chance de ganhar ao menos uma\s*11 disputas/.test(x) && /Em média, para 5 vitórias\s*25 disputas/.test(x), 'quantas licitações disputar');
    ok(/1º recebimento\s*5 meses/.test(x) && /Retorno \(acumulado positivo\)\s*no \d+º mês/.test(x) && await pg.locator('.cm-retorno tbody tr').count() >= 12, 'prazo de retorno com tabela mês a mês');
    await pg.evaluate(() => { document.querySelector('.cm-etapas').open = true; }); await pg.fill('#cm-extra [name=p_pagamento]', '60');
    ok(/comissão chega por volta de 07\/03\/2027 \(125 dias corridos\)/.test(await pg.innerText('#cm-extra-res')), 'etapas editáveis (pagamento em 60 dias)');
    await pg.fill('#cm-extra [name=custoFixo]', '90.000'); ok(/não se paga/.test(await pg.innerText('#cm-extra-res')) && await pg.locator('#cm-extra-res .alerta').count() === 1, 'avisa quando os custos não se pagam');
    await pg.fill('#cm-extra [name=custoFixo]', '2.000');
    // dias úteis e prorrogação do vencimento (art. 183)
    await pg.check('#cm-extra [name=pzProrrogar]'); await pg.waitForTimeout(100);
    ok(/comissão chega por volta de 10\/03\/2027 \(128 dias corridos/.test(await pg.innerText('#cm-extra-res')) && /vencimento prorrogado para dia útil/.test(await pg.innerText('#cm-extra-res')), 'vencimento em dia sem expediente passa para o próximo dia útil');
    await pg.click('[data-a=pz-uteis]'); await pg.waitForSelector('#cm-extra [name=t_entrega]');
    ok(await pg.inputValue('#cm-extra [name=t_entrega]') === 'uteis' && /\+30 dias úteis \(\d+ corridos\)/.test(await pg.innerText('#cm-extra-res')), 'todas as etapas em dias úteis');
    await pg.selectOption('#cm-extra [name=t_pagamento]', 'corridos'); await pg.waitForTimeout(100);
    ok(/\+60 dias corridos/.test(await pg.innerText('#cm-extra-res')), 'etapa a etapa: pagamento em dias corridos');
    await pg.fill('#cm-extra [name=pzFeriados]', '20/11/2026'); await pg.press('#cm-extra [name=pzFeriados]', 'Tab'); await pg.waitForTimeout(100);
    ok(/1 feriado local\b/.test(await pg.innerText('#cm-extra-res')), 'feriados locais do órgão');
    await pg.click('[data-a=pz-corridos]'); await pg.waitForSelector('#cm-extra [name=pzProrrogar]', { state: 'attached' }); await pg.evaluate(() => { document.querySelector('.cm-etapas').open = true; }); await pg.uncheck('#cm-extra [name=pzProrrogar]'); await pg.fill('#cm-extra [name=pzFeriados]', ''); await pg.press('#cm-extra [name=pzFeriados]', 'Tab'); await pg.waitForTimeout(100);
    await pg.locator('#cm-extra-res').screenshot({ path: path.join(saida, 'comissao-prazos.png') });
    // janela flutuante em outra tela, com os mesmos valores
    await pg.goto(url + '#/painel'); await pg.click('#botao-comissao'); await pg.waitForSelector('#comissao-flutuante:not([hidden])');
    ok(await pg.inputValue('#comissao-flutuante [name=pct]') === '30' && /R\$\s?6\.480,00/.test(await pg.innerText('.cmf-res')), 'janela flutuante abre com os mesmos valores (7.200 − 10%)');
    ok(/Comissão chega em\s*07\/03\/2027/.test(await pg.innerText('.cmf-res')) && /Disputas para a 1ª vitória\s*~5/.test(await pg.innerText('.cmf-res')), 'janela mostra prazo e disputas');
    await pg.click('#comissao-flutuante .cm-pilula:has(input[value=venda])'); await pg.fill('#comissao-flutuante [name=pct]', '4');
    ok(/R\$\s?7\.200,00/.test(await pg.innerText('.cmf-res')), 'calcula na janela: 4% de 200 mil − 10%');
    await foto('comissao-flutuante');
    await pg.click('.cmf-todos'); await pg.waitForSelector('#cm-form');
    ok(await pg.inputValue('#cm-form [name=pct]') === '4' && await pg.isChecked('#cm-form input[name=base][value=venda]'), 'tela completa recebe o que foi digitado na janela');
    await pg.fill('#cm-form [name=pct]', '6'); await pg.waitForTimeout(100); ok(await pg.inputValue('#comissao-flutuante [name=pct]') === '6', 'janela acompanha a tela');
    await pg.keyboard.press('Alt+KeyM'); await pg.waitForSelector('#comissao-flutuante', { state: 'hidden' }); ok(true, 'Alt+M fecha'); await pg.keyboard.press('Alt+KeyM'); await pg.waitForSelector('#comissao-flutuante:not([hidden])'); ok(true, 'Alt+M abre');
    await pg.goto(url + '#/comissao'); await pg.click('[data-a=janela]'); ok(await pg.locator('#comissao-flutuante:not([hidden])').count() === 1, 'botão da tela abre a janela');
    await pg.setViewportSize({ width: 390, height: 800 }); await pg.waitForTimeout(200); const m = await pg.locator('#comissao-flutuante').boundingBox(); ok(m.x >= 0 && m.x + m.width <= 390, 'no celular cabe na tela');
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
