const test = require('node:test');
const assert = require('node:assert/strict');
const J = require('../js/jogos.js');

test('banco de questões: ids únicos, 4 alternativas, gabarito válido e dispositivo citado', () => {
  assert.ok(J.QUESTOES.length >= 50);
  assert.equal(new Set(J.QUESTOES.map(q => q.id)).size, J.QUESTOES.length);
  J.QUESTOES.forEach(q => { assert.equal(q.o.length, 4, q.id); assert.ok(q.c >= 0 && q.c < 4, q.id); assert.match(q.ref, /(Lei|LC) \d/, q.id); assert.equal(new Set(q.o).size, 4, q.id); });
});

test('repetição espaçada: acerto sobe de caixa, erro volta, rodada prioriza vencidas', () => {
  const e = {};
  assert.equal(J.revisar(e, 'q1', true, '2026-10-21').prox, '2026-10-22');
  assert.equal(J.revisar(e, 'q1', true, '2026-10-22').prox, '2026-10-24');
  assert.equal(J.revisar(e, 'q1', false, '2026-10-24').caixa, 1);
  J.revisar(e, 'q2', true, '2026-10-01');
  const r = J.rodada(e, '2026-10-25', 5, J.rng(1));
  assert.deepEqual(r.slice(0, 2).map(q => q.id).sort(), ['q1', 'q2']);
  assert.equal(r.length, 5);
  const a = J.alternativas(J.QUESTOES[0], J.rng(7)); assert.equal(a.o[a.c], J.QUESTOES[0].o[J.QUESTOES[0].c]);
  assert.equal(J.dominio({ q1: { caixa: 4 }, q2: { caixa: 5 } }).dominadas, 2);
});

test('n-back: alvos corretos, pontuação e adaptação', () => {
  const s = J.sequenciaNBack(2, J.rng(3));
  assert.equal(s.pos.length, 22);
  let alvosP = 0; for (let i = 2; i < 22; i++) if (s.pos[i] === s.pos[i - 2]) alvosP++;
  assert.equal(alvosP, 6);
  const perfeito = s.pos.map((p, i) => i >= 2 ? { pos: p === s.pos[i - 2], letra: s.letras[i] === s.letras[i - 2] } : {});
  assert.equal(J.pontuarNBack(s, perfeito).pct, 100);
  const nada = J.pontuarNBack(s, []); assert.equal(nada.erros, nada.detalhe.pos.alvos + nada.detalhe.letra.alvos);
  assert.equal(J.proximoN(2, 95), 3); assert.equal(J.proximoN(2, 80), 2); assert.equal(J.proximoN(1, 10), 1);
});

test('memória: pares completos e pontuação', () => {
  const b = J.baralho(8, J.rng(2)); assert.equal(b.length, 16);
  for (let i = 0; i < 8; i++) assert.equal(b.filter(c => c.par === i).length, 2);
  assert.ok(J.pontosMemoria(8, 8, 20) > J.pontosMemoria(8, 20, 20));
});

test('matrizes: resposta única entre as opções e coerente com a regra da linha', () => {
  for (let s = 1; s < 40; s++) {
    const m = J.matriz(1 + (s % 4), J.rng(s));
    assert.equal(m.grade.length, 8); assert.equal(m.opcoes.length, 6);
    const k = x => x.forma + x.cor + x.n + x.rot;
    assert.equal(new Set(m.opcoes.map(k)).size, 6, 'opções distintas');
    if (m.regras.includes('n')) assert.equal(m.opcoes[m.certa].n, 3);
  }
});

test('cálculo de lances: respostas corretas e leitura de número em pt-BR', () => {
  assert.equal(J.lerNumero('1.234,56'), 1234.56); assert.equal(J.lerNumero('R$ 980'), 980); assert.equal(J.lerNumero('12,5%'), 12.5);
  for (let s = 1; s < 50; s++) { const q = J.questaoLance(3, J.rng(s)); assert.ok(J.confere(q, String(q.resp).replace('.', ',')), q.p); }
});

test('histórico, sequência de dias e treino do dia', () => {
  const h = []; J.registrar(h, 'quiz', 80, {}, '2026-10-19'); J.registrar(h, 'nback', 3, {}, '2026-10-20'); J.registrar(h, 'quiz', 90, {}, '2026-10-21');
  assert.equal(J.sequencia(h, '2026-10-21'), 3); assert.equal(J.sequencia(h, '2026-10-22'), 3); assert.equal(J.sequencia(h, '2026-10-24'), 0);
  assert.equal(J.recorde(h, 'quiz'), 90);
  assert.equal(J.treinoDoDia('2026-10-21').length, 4);
  assert.equal(J.tabela(5, J.rng(1)).slice().sort((a, b) => a - b).join(), Array.from({ length: 25 }, (_, i) => i + 1).join());
});
