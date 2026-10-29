const test = require('node:test'); const assert = require('node:assert');
const C = require('../js/comissao.js');
const perto = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, (msg || '') + ' esperado ' + b + ', veio ' + a);

test('comissão sobre o preço de venda', () => {
  const r = C.calcular({ base: 'venda', pct: 5, venda: 200000, alvo: 15000 });
  perto(r.comissaoBruta, 10000); perto(r.comissaoLiquida, 10000);
  assert.strictEqual(r.atingiu, false); perto(r.falta, 5000);
  perto(r.vendaNecessaria, 300000, 'venda para 15 mil a 5%');
  perto(r.pctNecessario, 7.5, 'percentual para 15 mil sobre 200 mil');
  assert.strictEqual(r.margemNecessaria, null, 'margem não muda comissão sobre a venda');
});

test('comissão sobre o lucro líquido', () => {
  const r = C.calcular({ base: 'lucro', pct: 30, venda: 200000, margem: 12, alvo: 9000 });
  perto(r.lucro, 24000); perto(r.comissaoLiquida, 7200);
  perto(r.vendaNecessaria, 250000, '9000 / (30% × 12%)');
  perto(r.margemNecessaria, 15, '9000 / (200000 × 30%)');
  perto(r.pctNecessario, 37.5, '9000 / 24000');
  perto(r.equivalente, 3.6, '30% do lucro com margem 12% = 3,6% da venda');
});

test('retenção: alvo líquido exige comissão bruta maior', () => {
  const r = C.calcular({ base: 'venda', pct: 10, venda: 100000, alvo: 8000, retencao: 20 });
  perto(r.comissaoBruta, 10000); perto(r.comissaoLiquida, 8000); perto(r.retida, 2000);
  assert.strictEqual(r.atingiu, true); perto(r.alvoBruto, 10000); perto(r.vendaNecessaria, 100000);
});

test('várias licitações dividem a venda necessária', () => {
  const r = C.calcular({ base: 'venda', pct: 5, alvo: 10000, contratos: 4 });
  perto(r.vendaNecessaria, 200000); perto(r.vendaPorContrato, 50000);
});

test('margem impossível e prejuízo', () => {
  const r = C.calcular({ base: 'lucro', pct: 10, venda: 10000, margem: 20, alvo: 5000 });
  assert.ok(r.margemImpossivel, 'precisaria de 500% de margem');
  const p = C.calcular({ base: 'lucro', pct: 10, venda: 10000, margem: -5 });
  assert.ok(p.prejuizo); assert.strictEqual(p.comissaoBruta, 0, 'prejuízo não gera comissão sobre o lucro'); assert.strictEqual(p.comissaoSobreLucro, 0);
  assert.strictEqual(C.calcular({ base: 'lucro', pct: 10, venda: 10000, margem: -5, alvo: 100 }).vendaNecessaria, null, 'sem lucro não há venda que chegue ao alvo');
});

test('margem a partir dos custos', () => {
  perto(C.margemDosCustos(100000, 70000, 10, 5), 15);
  assert.strictEqual(C.margemDosCustos(0, 1, 1, 1), null);
});

test('cenários cobrem as duas bases e todas as margens', () => {
  const s = C.cenarios({ venda: 100000, alvo: 5000 }, [5, 10], [10, 20]);
  assert.strictEqual(s.colunas.length, 3);
  perto(s.linhas[0].celulas[0].comissao, 5000, '5% da venda'); assert.strictEqual(s.linhas[0].celulas[0].atingiu, true);
  perto(s.linhas[1].celulas[2].comissao, 2000, '10% do lucro com 20% de margem');
  perto(s.linhas[1].celulas[1].vendaNecessaria, 500000, '5000 / (10% × 10%)');
  perto(s.margensNecessarias[0].margem, 100); perto(s.margensNecessarias[1].margem, 50);
});

test('lê listas de percentuais', () => {
  assert.deepStrictEqual(C.lerLista('1 2,5; 10% 0 x'), [1, 2.5, 10]);
});
