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

test('prazo para recebimento soma as etapas a partir da sessão', () => {
  const r = C.prazos('2026-11-02');
  assert.strictEqual(r.totalDias, 95); assert.strictEqual(r.diasAtePagamento, 90);
  assert.strictEqual(r.dataPagamento, '2027-01-31'); assert.strictEqual(r.etapas[0].data, '2026-11-17');
  assert.strictEqual(C.prazos('x'), null);
  assert.strictEqual(C.prazos('2026-01-01', [{ id: 'pagamento', nome: 'P', dias: 30 }]).dataPagamento, '2026-01-31');
});

test('quantas licitações disputar para ganhar', () => {
  const r = C.chances(20, 3);
  perto(r.esperadoPrimeira, 5); perto(r.esperadoVitorias, 15);
  assert.deepStrictEqual(r.confianca.map(x => x.disputas), [4, 8, 11, 14]);
  perto(r.tabela.find(x => x.disputas === 10).chance, 89.26);
  assert.strictEqual(C.chances(0), null); assert.strictEqual(C.chances(100).confianca[3].disputas, 1);
});

test('prazo de retorno com atraso no recebimento', () => {
  // 10 disputas/mês, 10% de sucesso = 1 vitória/mês; comissão 5.000; custos 1.500 + 10×100 = 2.500/mês; recebe 3 meses depois
  const r = C.retorno({ taxa: 10, disputasMes: 10, custoDisputa: 100, custoFixo: 1500, comissaoPorVitoria: 5000, diasRecebimento: 90, meses: 24 });
  assert.strictEqual(r.atrasoMeses, 3); perto(r.custoMes, 2500); perto(r.lucroMes, 2500);
  assert.strictEqual(r.mesPrimeiraVitoria, 1); assert.strictEqual(r.mesPrimeiroRecebimento, 4);
  perto(r.investimentoMaximo, 7500); assert.strictEqual(r.mesInvestimentoMaximo, 3);
  assert.strictEqual(r.mesRetorno, 6, 'acumulado: -7500, -5000, -2500, 0 no mês 6');
  assert.ok(r.viavel);
  const ruim = C.retorno({ taxa: 5, disputasMes: 4, custoFixo: 3000, comissaoPorVitoria: 2000, diasRecebimento: 60 });
  assert.ok(!ruim.viavel); assert.strictEqual(ruim.mesRetorno, null);
  assert.strictEqual(C.retorno({ taxa: 10, disputasMes: 0, comissaoPorVitoria: 1 }), null);
});
