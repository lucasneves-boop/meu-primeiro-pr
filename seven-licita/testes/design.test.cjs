const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/design.js');

test('modelos: todos carregam, cabem na página e não inventam site', () => {
  D.MODELOS.forEach(m => {
    const d = D.modelo(m.id); assert.ok(d, m.id);
    assert.equal(d.formato, m.formato);
    const txt = JSON.stringify(d);
    assert.doesNotMatch(txt, /www\.|https?:\/\/|\.com\.br/, m.id + ' sem link');
    d.paginas.forEach(p => p.elementos.forEach(e => { assert.ok(e.x + e.w > 0 && e.x < d.w + 1 && e.y < d.h + 1, m.id + ' ' + e.id); }));
  });
  assert.match(JSON.stringify(D.modelo('cartao')), /\(61\) 98347-2232/);
  assert.equal(new Set(D.modelo('apresentacao').paginas[1].elementos.map(e => e.id)).size, 17, 'ids únicos');
});

test('redimensionar pelas alças, com proporção e mínimo', () => {
  const o = { x: 100, y: 100, w: 200, h: 100 };
  assert.deepEqual(D.redimensionar(o, 'se', 50, 20), { x: 100, y: 100, w: 250, h: 120 });
  assert.deepEqual(D.redimensionar(o, 'nw', 20, 10), { x: 120, y: 110, w: 180, h: 90 });
  assert.deepEqual(D.redimensionar(o, 'se', 100, 0, true), { x: 100, y: 100, w: 300, h: 150 });
  assert.deepEqual(D.redimensionar(o, 'nw', -100, 0, true), { x: 0, y: 50, w: 300, h: 150 });
  assert.equal(D.redimensionar(o, 'e', -500, 0).w, 10);
});

test('ângulo com passo e guias magnéticas', () => {
  assert.equal(D.angulo(0, 0, 10, 0), 90); assert.equal(D.angulo(0, 0, 0, -10), 0); assert.equal(D.angulo(0, 0, 10, -9, 45), 45);
  const g = D.guias({ x: 437, y: 10, w: 200, h: 100 }, [], 1080, 1080);
  assert.equal(g.x, 440); assert.deepEqual(g.linhas[0], { eixo: 'x', v: 540 });
  const g2 = D.guias({ x: 503, y: 0, w: 100, h: 100 }, [{ x: 100, y: 300, w: 400, h: 50 }], 1080, 1080);
  assert.equal(g2.x, 500);
});

test('alinhar, distribuir, ordem e seleção por área', () => {
  const a = { id: 'a', x: 10, y: 0, w: 100, h: 50 }, b = { id: 'b', x: 300, y: 80, w: 50, h: 50 }, c = { id: 'c', x: 120, y: 20, w: 50, h: 10 };
  D.alinhar([a], 'centro-h', 1000, 500); assert.equal(a.x, 450);
  a.x = 10; D.alinhar([a, b], 'topo'); assert.equal(b.y, 0);
  D.alinhar([a, b], 'direita'); assert.equal(a.x, 250);
  a.x = 0; b.x = 400; c.x = 300; D.distribuir([a, b, c], 'h'); assert.equal(c.x, 225); assert.equal(b.x, 400);
  const l = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(D.ordem(l, 'a', 'frente').map(e => e.id), ['b', 'c', 'a']);
  assert.deepEqual(D.ordem(l, 'a', 'descer').map(e => e.id), ['b', 'a', 'c']);
  assert.deepEqual(D.selecaoRetangulo([a, b], { x1: -5, y1: -5, x2: 60, y2: 60 }), ['a']);
});

test('quebra de texto por largura, com \\n e palavra longa', () => {
  const medir = t => t.length * 10;
  assert.deepEqual(D.quebrarTexto('Pregão eletrônico para material', 120, medir), ['Pregão', 'eletrônico', 'para', 'material']);
  assert.deepEqual(D.quebrarTexto('ab cd ef\ngh', 50, medir), ['ab cd', 'ef', 'gh']);
  assert.deepEqual(D.quebrarTexto('abcdefghij', 40, medir), ['abcd', 'efgh', 'ij']);
});

test('histórico desfaz e refaz; formas', () => {
  const h = D.historico(); h.registrar({ v: 1 }); h.registrar({ v: 2 }); h.registrar({ v: 2 }); h.registrar({ v: 3 });
  assert.deepEqual(h.desfazer(), { v: 2 }); assert.deepEqual(h.desfazer(), { v: 1 }); assert.equal(h.desfazer(), null);
  assert.deepEqual(h.refazer(), { v: 2 });
  assert.equal(D.pontosEstrela(100, 100, 5).length, 10); assert.deepEqual(D.pontosEstrela(100, 100)[0], [50, 0]);
  assert.equal(D.pontosSeta(200, 50).length, 7);
  assert.equal(D.nomeArquivo({ titulo: 'Post: edital?' }, 'png', 0), 'Post edital-1.png');
});
