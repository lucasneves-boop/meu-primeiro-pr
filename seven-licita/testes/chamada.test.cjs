const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/chamada.js');

test('código no formato do Meet e leitura de link', () => {
  let i = 0; const seq = () => (i++ % 25) / 25;
  const c = C.codigo(seq); assert.ok(C.codigoValido(c), c);
  assert.equal(C.lerCodigo('http://x/#/reuniao/abc-defg-hij'), 'abc-defg-hij');
  assert.equal(C.lerCodigo(' ABC-DEFG-HIJ '), 'abc-defg-hij');
  assert.equal(C.lerCodigo('abc-def'), '');
});

test('presença, ordem de entrada e quem oferece', () => {
  const agora = 100000;
  const sala = { participantes: { b: { entrou: 2, visto: agora - 1000 }, a: { entrou: 1, visto: agora - 5000 }, z: { entrou: 0, visto: agora - 40000 } } };
  assert.deepEqual(C.ativos(sala, agora), ['a', 'b']);
  assert.equal(C.devoOfertar('b', 'a', sala), true);
  assert.equal(C.devoOfertar('a', 'b', sala), false);
  const empate = { participantes: { x: { entrou: 5 }, y: { entrou: 5 } } };
  assert.notEqual(C.devoOfertar('x', 'y', empate), C.devoOfertar('y', 'x', empate));
});

test('sala cheia só barra quem ainda não está', () => {
  const ps = {}; for (let i = 0; i < 8; i++) ps['u' + i] = { entrou: i, visto: 1000 };
  assert.equal(C.cheia({ participantes: ps }, 'novo', 1000), true);
  assert.equal(C.cheia({ participantes: ps }, 'u3', 1000), false);
});

test('grade escolhe colunas que maximizam o vídeo', () => {
  assert.deepEqual(C.grade(1, 1280, 720), { colunas: 1, linhas: 1 });
  assert.deepEqual(C.grade(2, 1280, 720), { colunas: 2, linhas: 1 });
  assert.deepEqual(C.grade(4, 1280, 720), { colunas: 2, linhas: 2 });
  assert.deepEqual(C.grade(3, 390, 700), { colunas: 1, linhas: 3 });
});

test('duração, sinais e nível de voz', () => {
  assert.equal(C.duracao(65000), '1:05'); assert.equal(C.duracao(3725000), '1:02:05');
  const sala = { sinais: { eu: { ana: { s2: { tipo: 'ice', em: 2 }, s1: { tipo: 'offer', em: 1 } }, bia: { s3: { tipo: 'answer', em: 3 } } } } };
  assert.deepEqual(C.sinaisPara(sala, 'eu').map(s => s.de + ':' + s.tipo), ['ana:offer', 'ana:ice', 'bia:answer']);
  assert.deepEqual(C.sinaisPara(sala, 'eu', { 'ana/s1': 1 }).map(s => s.id), ['s2', 's3']);
  assert.equal(C.nivel(new Uint8Array(64).fill(128)), 0);
  assert.ok(C.nivel(Uint8Array.from({ length: 64 }, (_, i) => i % 2 ? 200 : 56)) > 0.9);
});
