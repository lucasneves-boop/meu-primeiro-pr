const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/painel.js');

test('layout padrão e normalização (desconhecidos, repetidos e tamanhos inválidos)', () => {
  assert.equal(P.padrao().length, P.PADRAO.length); assert.equal(P.padrao()[0].tam, 'g');
  assert.deepEqual(P.normalizar([{ id: 'agenda', tam: 'x' }, { id: 'nada' }, { id: 'agenda', tam: 'p' }, null]), [{ id: 'agenda', tam: 'm' }]);
  assert.deepEqual(P.normalizar(undefined), P.padrao());
  assert.ok(P.CATALOGO.every(b => ['p', 'm', 'g'].includes(b.tam) && b.t && b.g && b.d));
});

test('adicionar, retirar, mover, deslocar e redimensionar', () => {
  let l = [{ id: 'kpis', tam: 'g' }, { id: 'agenda', tam: 'm' }];
  l = P.adicionar(l, 'loja'); assert.deepEqual(l.map(x => x.id), ['kpis', 'agenda', 'loja']);
  assert.equal(P.adicionar(l, 'loja').length, 3, 'não repete bloco');
  l = P.adicionar(l, 'capag', 0); assert.equal(l[0].id, 'capag');
  l = P.mover(l, 'capag', 3); assert.deepEqual(l.map(x => x.id), ['kpis', 'agenda', 'loja', 'capag']);
  l = P.deslocar(l, 'capag', -1); assert.deepEqual(l.map(x => x.id), ['kpis', 'agenda', 'capag', 'loja']);
  assert.deepEqual(P.deslocar(l, 'kpis', -1).map(x => x.id), l.map(x => x.id), 'não passa do início');
  l = P.redimensionar(l, 'agenda', 'g'); assert.equal(l[1].tam, 'g');
  assert.equal(P.redimensionar(l, 'agenda', 'enorme')[1].tam, 'g');
  l = P.remover(l, 'kpis'); assert.equal(l.length, 3);
  assert.equal(P.proximoTamanho('p'), 'm'); assert.equal(P.proximoTamanho('g'), 'p');
  assert.ok(P.disponiveis(l).some(b => b.id === 'kpis') && !P.disponiveis(l).some(b => b.id === 'agenda'));
});

test('agregações por mês, contagem e próximos dias', () => {
  assert.deepEqual(P.mesesAte('2026-02-10', 4), ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.equal(P.rotuloMes('2026-01'), 'jan/26'); assert.equal(P.rotuloMes('2026-03'), 'mar');
  const s = P.porMes([{ d: '2026-01-05', v: 10 }, { d: '2026-02-01', v: 5 }, { d: '2026-02-20', v: '2,5' }, { d: '2025-01-01', v: 99 }], x => x.d, x => x.v, '2026-02-10', 3);
  assert.deepEqual(s.map(x => [x.mes, x.v]), [['2025-12', 0], ['2026-01', 10], ['2026-02', 5]]);
  assert.deepEqual(P.porMes([{ d: '2026-02-01' }, { d: '2026-02-03' }], x => x.d, null, '2026-02-10', 1)[0].v, 2);
  assert.deepEqual(P.contar([{ s: 'b' }, { s: 'a' }, { s: 'b' }, { s: 'z' }, { s: '' }], x => x.s, ['a', 'b', 'c']), [{ r: 'a', v: 1 }, { r: 'b', v: 2 }, { r: 'z', v: 1 }]);
  assert.deepEqual(P.proximosDias('2026-12-31', 2), ['2026-12-31', '2027-01-01']);
});
