const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/ereader.js');

test('seleção vai até palavras inteiras e apara espaços', () => {
  const t = 'A garantia de proposta será de um por cento do valor estimado.';
  const i = t.indexOf('arantia'), f = t.indexOf('estimado') + 5; // "arantia ... estim"
  const r = E.limitesPalavra(t, i, f); assert.equal(t.slice(r.ini, r.fim), 'garantia de proposta será de um por cento do valor estimado');
  const r2 = E.limitesPalavra(t, t.indexOf(' de ') , t.indexOf(' de ') + 4); assert.equal(t.slice(r2.ini, r2.fim), 'de');
  const r3 = E.limitesPalavra('art. 59-A da lei', 6, 7); assert.equal('art. 59-A da lei'.slice(r3.ini, r3.fim), '59-A');
});

test('retângulos do PDF viram um por linha, sem sobreposição', () => {
  const r = E.mesclarRetangulos([[0.1, 0.10, 0.2, 0.02], [0.29, 0.101, 0.3, 0.019], [0.1, 0.13, 0.5, 0.02], [0.1, 0.1305, 0.1, 0.019]], 0);
  assert.equal(r.length, 2);
  assert.ok(Math.abs(r[0][0] - 0.1) < 1e-9 && Math.abs(r[0][0] + r[0][2] - 0.59) < 1e-9);
  assert.ok(r[0][1] + r[0][3] <= r[1][1] + 1e-9, 'linhas não se sobrepõem');
});

test('raio-x encontra prazos, valores, datas, leis e alertas', () => {
  const t = 'Proposta em até 3 (três) dias úteis, sob pena de desclassificação. Valor estimado R$ 1.250.000,00 e garantia de proposta de 1%. Sessão em 15/12/2026 às 9h. Conforme a Lei nº 14.133/2021, art. 59, § 4º. Contato: licita@prefeitura.go.gov.br, (64) 3441-5000. Prazo de 3 dias úteis.';
  const g = Object.fromEntries(E.raioX(t).map((x) => [x.id, x.itens.map((i) => i.texto)]));
  assert.ok(g.prazos.some((x) => /3 \(três\) dias úteis/.test(x)));
  assert.ok(g.valores.includes('R$ 1.250.000,00') && g.valores.includes('1%'));
  assert.ok(g.datas.some((x) => /15\/12\/2026/.test(x)));
  assert.ok(g.leis.some((x) => /Lei nº 14\.133\/2021/.test(x)));
  assert.ok(g.artigos.some((x) => /art\. 59/.test(x)));
  assert.ok(g.contatos.includes('licita@prefeitura.go.gov.br'));
  assert.ok(g.alertas.some((x) => /sob pena de/i.test(x)) && g.alertas.some((x) => /garantia de proposta/i.test(x)));
});

test('estatísticas: tempo por dia, sequência e resumo da semana', () => {
  let s = {}; s = E.registrarTempo(s, 12, new Date('2026-10-28T15:00:00')); s = E.registrarTempo(s, 5, new Date('2026-10-29T15:00:00')); s = E.registrarTempo(s, 20, new Date('2026-10-30T15:00:00'));
  assert.equal(E.sequencia(s, '2026-10-30'), 3);
  assert.equal(E.sequencia(s, '2026-10-31'), 3, 'hoje ainda sem leitura não quebra a sequência');
  const r = E.resumo(s, '2026-10-30'); assert.equal(r.hoje, 20); assert.equal(r.minSemana, 37); assert.equal(r.semana.length, 7);
});
