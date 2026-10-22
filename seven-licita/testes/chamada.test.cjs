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

test('reunião: enquete, perguntas e ata', () => {
  const C = require('../js/chamada.js');
  const r = C.resultadoEnquete({ opcoes: ['Sim', 'Não', 'Talvez'], votos: { a: 0, b: 0, c: 1, d: 9 } });
  assert.equal(r.total, 3); assert.equal(r.opcoes[0].votos, 2); assert.ok(Math.abs(r.opcoes[0].pct - 2 / 3) < 1e-9); assert.equal(r.opcoes[2].votos, 0);
  assert.equal(C.resultadoEnquete({}).total, 0);
  const q = C.ordenarPerguntas({ p1: { t: 'a', em: 1, votos: { x: 1 } }, p2: { t: 'b', em: 2, votos: { x: 1, y: 1 } }, p3: { t: 'c', em: 0, respondida: true, votos: { x: 1, y: 1, z: 1 } } });
  assert.deepEqual(q.map(x => x.id), ['p2', 'p1', 'p3']);
  const t = C.ata({ nome: 'Pregão 10', transcricao: { a: { u: 'u1', t: 'bom dia', em: Date.UTC(2026, 0, 1, 12, 0) } }, chat: { b: { u: 'u2', t: 'link do edital', em: Date.UTC(2026, 0, 1, 12, 1) } }, enquetes: { c: { pergunta: 'Participamos?', opcoes: ['Sim', 'Não'], votos: { u1: 0 }, em: Date.UTC(2026, 0, 1, 12, 2) } } }, u => ({ u1: 'Ana', u2: 'Beto' }[u]));
  assert.ok(/Reunião: Pregão 10/.test(t) && /Ana: bom dia/.test(t) && /\(chat\) Beto: link do edital/.test(t) && /Participamos\? → Sim \(1\); Não \(0\)/.test(t));
  assert.ok(t.indexOf('bom dia') < t.indexOf('link do edital'));
});
