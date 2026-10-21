const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/precos.js');
const perto = (a, b, tol) => assert.ok(Math.abs(a - b) < (tol || 0.005), a + ' ≈ ' + b);

test('produto: preço por divisor e preço mínimo sem margem', () => {
  const r = P.produto({ custo: 70, freteCompra: 5, freteEntregaTotal: 500, quantidade: 100, impostos: 10, margem: 10 });
  perto(r.custoDireto, 80);
  perto(r.preco, 100);
  perto(r.precoMinimo, 80 / 0.9);
  perto(r.lucro, 10);
  perto(r.total, 10000);
  perto(r.markup, 1.25);
});

test('produto: referência, desconto possível e margem na referência', () => {
  const r = P.produto({ custo: 80, impostos: 10, margem: 10, referencia: 125 });
  perto(r.descontoSobreRef, 0.2);
  perto(r.margemNaReferencia, (1 - 80 / 125 - 0.10) * 100);
  assert.equal(r.cabe, true);
  const lances = P.tabelaLances(r, 4);
  perto(lances[0].preco, 125); perto(lances[4].preco, r.precoMinimo); perto(lances[4].margem, 0);
});

test('produto: percentuais que somam 100% ou mais invalidam', () => {
  assert.equal(P.produto({ custo: 10, impostos: 60, margem: 40 }).valido, false);
});

test('custo financeiro composto pelo prazo de pagamento', () => {
  perto(P.custoFinanceiro(30, 2), 2);
  perto(P.custoFinanceiro(60, 2), 4.04);
  assert.equal(P.custoFinanceiro(0, 2), 0);
});

test('BDI pela fórmula do TCU', () => {
  // ((1+0,04+0,008+0,0127+0)*(1+0,0123)*(1+0,074))/(1-0,0865) - 1
  const b = P.bdi({ administracao: 4, seguro: 0.8, risco: 1.27, garantia: 0, financeiro: 1.23, lucro: 7.4, tributos: 8.65 });
  perto(b, ((1.0607) * 1.0123 * 1.074) / 0.9135 - 1, 1e-9);
});

test('serviço: custo do posto, BDI e preço mensal/total', () => {
  const r = P.servico({ salario: 2000, adicionais: 0, encargos: 70, beneficios: 600, uniformes: 50, insumos: 0, postos: 2, meses: 12, administracao: 5, lucro: 10, tributos: 10 });
  perto(r.custoPosto, 2000 + 1400 + 600 + 50);
  perto(r.custoMensal, 8100);
  perto(r.bdi, (1.05 * 1.10) / 0.9 - 1, 1e-9);
  perto(r.precoTotal, r.precoMensal * 12);
  assert.ok(r.precoMinimoMensal < r.precoMensal);
});

test('ponto de equilíbrio', () => {
  assert.equal(P.equilibrio(1000, 30), 34);
  assert.equal(P.equilibrio(1000, 0), null);
});
