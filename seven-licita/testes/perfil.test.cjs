const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/perfil.js');

test('IPIP-50: 10 itens por fator, chaves invertidas na contagem do domínio público', () => {
  const c = {}; P.IPIP.forEach(([, f, k]) => { c[f] = c[f] || { mais: 0, menos: 0 }; c[f][k > 0 ? 'mais' : 'menos']++; });
  assert.deepEqual(c, { E: { mais: 5, menos: 5 }, A: { mais: 6, menos: 4 }, C: { mais: 6, menos: 4 }, N: { mais: 2, menos: 8 }, O: { mais: 7, menos: 3 } });
});

test('Big Five: pontuação 0–100 na escala, itens invertidos', () => {
  const tudo5 = P.IPIP.map(() => 5); const r = P.bigFive(tudo5);
  assert.equal(r.E, 50); assert.equal(r.N, 20);
  const perfeito = P.IPIP.map(([, f, k]) => f === 'C' ? (k > 0 ? 5 : 1) : 3); assert.equal(P.bigFive(perfeito).C, 100); assert.equal(P.bigFive(perfeito).A, 50);
  assert.equal(P.faixa(80), 'alto'); assert.equal(P.faixa(50), 'moderado'); assert.equal(P.faixa(10), 'baixo');
  assert.equal(P.bigFive({}).E, null);
});

test('temperamento pela leitura de Eysenck', () => {
  assert.equal(P.temperamento({ E: 80, N: 80 }).id, 'sanguineo');
  assert.equal(P.temperamento({ E: 80, N: 20 }).id, 'colerico');
  assert.equal(P.temperamento({ E: 20, N: 20 }).id, 'melancolico');
  assert.equal(P.temperamento({ E: 20, N: 80 }).id, 'fleumatico');
  assert.equal(P.temperamento({ E: null, N: 50 }), null);
});

test('DISC: escolha forçada, primário e secundário', () => {
  assert.equal(P.DISC_ITENS.length, 24); P.DISC_ITENS.forEach(g => assert.equal(g.length, 4));
  const r = P.disc(P.DISC_ITENS.map((_, i) => ({ mais: i % 3 === 0 ? 1 : 0, menos: 2 })));
  assert.equal(r.primario, 'D'); assert.equal(r.secundario, 'I'); assert.equal(r.pct.S, 0); assert.equal(r.pct.C, 50); assert.equal(r.respondidos, 24);
  assert.equal(P.disc([{ mais: 1, menos: 1 }]).respondidos, 0);
});

test('raciocínio: itens válidos e correção', () => {
  const pv = P.prova(42, 12); assert.equal(pv.length, 12);
  pv.forEach(it => { assert.ok(it.c >= 0 && it.c < it.o.length, it.p); assert.equal(new Set(it.o).size, it.o.length); });
  const s = P.serieNumerica(P.rng(7)); const nums = s.p.match(/-?\d+/g).map(Number); assert.ok(nums.length >= 5);
  assert.deepEqual(P.corrigir(pv, pv.map(it => it.c)), { acertos: 12, total: 12, pct: 100 });
});

test('equipe: médias e estilos que faltam', () => {
  const r = P.equipe([{ big5: { E: 80, A: 60, C: 40, N: 50, O: 70 }, disc: { primario: 'D' } }, { big5: { E: 20, A: 40, C: 80, N: 70, O: 30 }, disc: { primario: 'C' } }]);
  assert.equal(r.media.E, 50); assert.deepEqual(r.faltam, ['I', 'S']);
});
