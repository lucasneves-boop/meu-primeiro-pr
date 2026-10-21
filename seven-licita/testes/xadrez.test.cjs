const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../js/xadrez.js');

test('perft da posição inicial bate com a referência', () => {
  const e = X.lerFEN(X.INICIAL);
  assert.deepEqual([1, 2, 3].map(p => X.perft(e, p)), [20, 400, 8902]);
  assert.equal(X.fen(e), X.INICIAL, 'fazer/desfazer restaura a posição');
});

test('perft Kiwipete (roques, en passant, promoções, xeques)', () => {
  const e = X.lerFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  assert.deepEqual([1, 2, 3].map(p => X.perft(e, p)), [48, 2039, 97862]);
});

test('perft posição 3 e 4 (en passant descoberto, promoção com xeque)', () => {
  assert.equal(X.perft(X.lerFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'), 4), 43238);
  assert.equal(X.perft(X.lerFEN('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1'), 3), 9467);
});

test('mate do pastor, afogamento e material insuficiente', () => {
  const e = X.lerFEN(X.INICIAL);
  for (const [de, para] of [['e2', 'e4'], ['e7', 'e5'], ['f1', 'c4'], ['b8', 'c6'], ['d1', 'h5'], ['g8', 'f6']]) X.jogar(e, X.lances(e).find(m => m.de === X.casa(de) && m.para === X.casa(para)));
  const m = X.lances(e).find(x => x.de === X.casa('h5') && x.para === X.casa('f7'));
  assert.equal(X.san(e, m), 'Qxf7#'); X.jogar(e, m);
  assert.deepEqual(X.situacao(e), { fim: true, tipo: 'mate', vencedor: 'w' });
  assert.equal(X.situacao(X.lerFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).tipo, 'afogamento');
  assert.equal(X.situacao(X.lerFEN('8/8/4k3/8/8/2B5/4K3/8 w - - 0 1')).tipo, 'material insuficiente');
});

test('notação: roque, promoção e desambiguação', () => {
  let e = X.lerFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert.ok(X.lances(e).some(m => X.san(e, m) === 'O-O') && X.lances(e).some(m => X.san(e, m) === 'O-O-O'));
  e = X.lerFEN('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  assert.deepEqual(X.lances(e).filter(m => m.promo).map(m => X.san(e, m)).sort(), ['a8=B', 'a8=N', 'a8=Q', 'a8=R']);
  e = X.lerFEN('k7/8/8/8/8/8/8/KN3N2 w - - 0 1');
  assert.ok(X.lances(e).some(m => X.san(e, m) === 'Nbd2') && X.lances(e).some(m => X.san(e, m) === 'Nfd2'));
});

test('IA: captura a dama solta e encontra mate em 1', () => {
  const e = X.lerFEN('4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1');
  const m = X.melhorLance(e, 2, () => 0); assert.equal(X.nomeCasa(m.para), 'd5');
  const f = X.lerFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  assert.equal(X.san(f, X.melhorLance(f, 2, () => 0)), 'Ra8#');
});
