// Seven Precificação: comissão e taxa da Seven sobre o lucro líquido (produto e planilha de vários itens).
// Uso: node testes/precificacao-lucro.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t; const erros = []; pg.on('pageerror', e => erros.push(e.message));
  try {
    await pg.goto(url + '#/precificacao'); await pg.waitForSelector('[name=custo]');
    const preenche = async (n, v) => { await pg.fill('[name=' + n + ']', v); await pg.press('[name=' + n + ']', 'Tab'); };
    await preenche('custo', '100'); await preenche('impostos', '10'); await preenche('despesasFixas', '0'); await preenche('taxaMes', '0'); await preenche('margem', '10'); await preenche('comissao', '20');
    await pg.selectOption('[name=comissaoBase]', 'lucro'); await pg.waitForTimeout(200);
    const r = await pg.innerText('#p-res');
    ok(/R\$\s?129,03/.test(r), 'preço com comissão de 20% do lucro (100 ÷ 0,775 = 129,03)');
    ok(/Comissão da Seven \(20(,00)?% do lucro\)\s*R\$\s?3,23/.test(r) && /Lucro antes da comissão sobre o lucro\s*R\$\s?16,13/.test(r) && /Lucro líquido \(fica para a empresa\)\s*R\$\s?12,90/.test(r), 'composição: lucro antes, comissão e lucro final');
    ok(/Preço mínimo[\s\S]*R\$\s?111,11/.test(r), 'preço mínimo sem comissão (não há lucro)');
    await pg.selectOption('[name=comissaoBase]', 'preco'); await pg.waitForTimeout(200);
    ok(/R\$\s?142,86/.test(await pg.innerText('#p-res')), 'sobre o preço: 100 ÷ (1 − 0,10 − 0,20 − 0,10) = 142,86');
    await foto('precificacao-lucro');
    ok(!erros.length, 'sem erros na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
