const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/anotacoes.js');

const N = (o) => Object.assign({ id: Math.random().toString(36), criadaEm: 1, editadaEm: 1, html: '' }, o);

test('título, prévia, texto e tags', () => {
  const n = N({ html: '<p>Reunião com cliente</p><p>Levar &amp; revisar <b>proposta</b> #pregao #Catalão</p>' });
  assert.equal(A.titulo(n), 'Reunião com cliente');
  assert.equal(A.previa(n), 'Levar & revisar proposta #pregao #Catalão');
  assert.deepEqual(A.tags(n), ['pregao', 'catalao']);
  assert.equal(A.titulo(N({ titulo: '  Ideias ' })), 'Ideias');
  assert.deepEqual(A.tags(N({ html: 'Pontos #catalao<ul class="an-check"><li data-check="0">Enviar</li></ul>' })), ['catalao']);
  assert.equal(A.textoDe('a<div>b</div><ul><li>c</li></ul>'), 'a\nb\n\nc');
  assert.equal(A.titulo(N({ tracos: [{ pts: [[0, 0]] }] })), 'Anotação à mão');
  assert.equal(A.titulo(N({ cifrado: {} })), 'Nota bloqueada');
});

test('checklist conta itens feitos', () => {
  assert.deepEqual(A.checklist(N({ html: '<ul><li data-check="1">a</li><li data-check="0">b</li><li data-check="1">c</li></ul>' })), { total: 3, feitos: 2 });
});

test('filtros, busca sem acento, fixadas primeiro e lixeira', () => {
  const ns = [N({ id: 'a', html: '<p>Edital de papelaria</p>', pasta: 'p1', editadaEm: 5 }), N({ id: 'b', html: '<p>Cotação</p>', fav: true, editadaEm: 9 }), N({ id: 'c', html: '<p>Velha</p>', apagadaEm: 100 }), N({ id: 'd', html: '<p>Fixa</p>', fixada: true, editadaEm: 1 })];
  assert.deepEqual(A.filtrar(ns, {}).map(n => n.id), ['a', 'b', 'd']);
  assert.deepEqual(A.filtrar(ns, { q: 'COTACAO' }).map(n => n.id), ['b']);
  assert.deepEqual(A.filtrar(ns, { pasta: 'p1' }).map(n => n.id), ['a']);
  assert.deepEqual(A.filtrar(ns, { fav: true }).map(n => n.id), ['b']);
  assert.deepEqual(A.filtrar(ns, { lixeira: true }).map(n => n.id), ['c']);
  assert.deepEqual(A.ordenar(A.filtrar(ns, {})).map(n => n.id), ['d', 'b', 'a']);
  assert.deepEqual(A.ordenar(A.filtrar(ns, {}), 'titulo').map(n => n.id), ['d', 'b', 'a']);
  const agora = 100 + 31 * 864e5; assert.equal(A.expurgar(ns, agora).length, 3);
  assert.equal(A.diasNaLixeira(ns[2], 100 + 10 * 864e5), 20);
});

test('traços: simplificação, caminho SVG, borracha', () => {
  const pts = Array.from({ length: 50 }, (_, i) => [i, 0]);
  assert.deepEqual(A.simplificar(pts), [[0, 0], [49, 0]]);
  const curva = Array.from({ length: 40 }, (_, i) => [i, Math.round(Math.sin(i / 5) * 20)]);
  assert.ok(A.simplificar(curva).length > 4 && A.simplificar(curva).length < 40);
  assert.match(A.caminho([[0, 0], [10, 10], [20, 0]]), /^M0 0Q10 10 15 5L20 0$/);
  const tr = [{ ferr: 'caneta', cor: '#000', esp: 2, pts: [[0, 0], [10, 0]] }, { ferr: 'marca', cor: '#ff0', esp: 12, pts: [[100, 100]] }];
  assert.match(A.svg(tr), /stroke-opacity=".35"/);
  assert.equal(A.apagarEm(tr, 5, 1, 3).length, 1);
  assert.deepEqual(A.caixa(tr), { x: -2, y: -2, w: 114, h: 114 });
});

test('nota bloqueada: cifra e decifra com AES-GCM; senha errada falha', async () => {
  const c = await A.cifrar({ html: '<p>Senha do portal: não guarde aqui</p>', tracos: [] }, 'segredo123', 1000);
  assert.ok(c.dados && c.iv && c.sal); assert.doesNotMatch(JSON.stringify(c), /portal/);
  assert.equal((await A.decifrar(c, 'segredo123')).html, '<p>Senha do portal: não guarde aqui</p>');
  await assert.rejects(A.decifrar(c, 'errada'), /Senha incorreta/);
  assert.equal(A.nomeArquivo(N({ titulo: 'Ata: 10/2026?' }), 'txt'), 'Ata 10 2026.txt');
});
