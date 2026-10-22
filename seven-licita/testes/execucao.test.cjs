const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../js/execucao.js');

test('execução: migra formato antigo e liga NF ↔ empenho ↔ pagamento', () => {
  const x = X.normalizar({ valor: 10000, empenhos: [{ numero: '2026NE001', valor: 6000 }, { numero: '2026NE002', valor: 4000 }], notas: [{ numero: '101', valor: 2500, empenho: '2026NE001', vencimento: '2026-10-01' }, { numero: '102', valor: 4000, empenho: '2026NE001', vencimento: '2026-12-01' }, { numero: '103', valor: 1000 }], pagamentos: [{ data: '2026-10-05', valor: 2500, ref: '101' }, { data: '2026-10-20', valor: 1000, ref: '102' }] });
  assert.ok(x.empenhos.every(e => e.id) && x.notas.every(n => n.id) && x.pagamentos.every(p => p.id));
  assert.equal(x.notas[0].empenhoId, x.empenhos[0].id);
  assert.equal(x.pagamentos[1].notaId, x.notas[1].id);
  const r = X.resumo(x, '2026-10-22');
  assert.equal(r.empenhado, 10000); assert.equal(r.faturado, 7500); assert.equal(r.recebido, 3500); assert.equal(r.aReceber, 4000); assert.equal(r.aFaturar, 2500); assert.equal(r.saldoContrato, 0);
  assert.deepEqual(r.empenhos[0].notas, ['101', '102']); assert.equal(r.empenhos[0].saldo, -500); assert.equal(r.empenhos[0].excedido, true);
  assert.equal(r.notas[0].status, 'paga'); assert.equal(r.notas[1].status, 'parcial'); assert.equal(r.notas[1].aberto, 3000); assert.equal(r.notas[2].status, 'aberta');
  assert.ok(r.alertas.some(a => /acima do saldo do empenho 2026NE001/.test(a)));
  assert.ok(r.alertas.some(a => /NF 103 sem empenho/.test(a)));
  // atraso
  x.notas[1].vencimento = '2026-10-10';
  assert.equal(X.resumo(x, '2026-10-22').notas[1].status, 'atrasada');
  assert.equal(X.vencimentoPadrao('2026-10-01', 30), '2026-10-31');
  assert.equal(X.resumo({}, '2026-10-22').alertas.length, 0);
});
