// Campos em reais formatados (350.000,00) ao sair do campo e ao abrir a tela; percentuais e quantidades não mudam.
// Uso: node testes/moeda.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t;
  try {
    await pg.goto(url + '#/comissao'); await pg.waitForSelector('#cm-form');
    await pg.fill('#cm-form [name=venda]', '350000'); await pg.press('#cm-form [name=venda]', 'Tab'); await pg.waitForTimeout(100);
    ok(await pg.inputValue('#cm-form [name=venda]') === '350.000,00', 'venda vira 350.000,00');
    await pg.fill('#cm-form [name=alvo]', '15000,5'); await pg.press('#cm-form [name=alvo]', 'Tab'); await pg.waitForTimeout(100);
    ok(await pg.inputValue('#cm-form [name=alvo]') === '15.000,50', 'centavos com vírgula');
    await pg.fill('#cm-form [name=pct]', '7,5'); await pg.press('#cm-form [name=pct]', 'Tab'); ok(await pg.inputValue('#cm-form [name=pct]') === '7,5', 'percentual não muda');
    await pg.fill('#cm-form [name=contratos]', '3'); await pg.press('#cm-form [name=contratos]', 'Tab'); ok(await pg.inputValue('#cm-form [name=contratos]') === '3', 'quantidade não muda');
    ok(/R\$\s?26\.250,00/.test(await pg.innerText('#cm-res')), 'o cálculo usa o valor formatado (7,5% de 350 mil)');
    await pg.reload(); await pg.waitForSelector('#cm-form'); ok(await pg.inputValue('#cm-form [name=venda]') === '350.000,00', 'continua formatado ao reabrir');
    // margem editável mesmo com o cálculo pelos custos ligado
    await pg.check('#cm-form [name=usarCustos]'); await pg.waitForTimeout(100);
    await pg.click('#cm-form [name=margem]', { clickCount: 3 }); await pg.keyboard.type('18'); await pg.waitForTimeout(150);
    ok(await pg.inputValue('#cm-form [name=margem]') === '18' && !(await pg.isChecked('#cm-form [name=usarCustos]')), 'margem editável: digitar desliga o cálculo pelos custos');
    await pg.goto(url + '#/precificacao'); await pg.waitForSelector('[name=custo]');
    await pg.fill('[name=custo]', '1234,5'); await pg.press('[name=custo]', 'Tab'); ok(await pg.inputValue('[name=custo]') === '1.234,50', 'precificação: custo em reais');
    await pg.fill('[name=impostos]', '6'); await pg.press('[name=impostos]', 'Tab'); ok(await pg.inputValue('[name=impostos]') === '6', 'precificação: imposto em % não muda');
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
