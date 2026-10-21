const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../js/habilitacao.js');

const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');

test('todas as 27 UFs têm SEFAZ, Junta e TJ; links são http(s) ou marcados como não confirmados', () => {
  assert.deepEqual(Object.keys(H.UF).sort(), UFS.slice().sort());
  UFS.forEach(function (uf) {
    const x = H.UF[uf];
    assert.ok(x.sefaz.length >= 1, uf);
    x.sefaz.concat([x.junta, x.tj]).forEach(function (l) {
      assert.ok(['v', 'd', 'n'].includes(l.s), uf + ' ' + l.t);
      if (l.s === 'n') assert.equal(l.u, ''); else assert.ok(H.validarUrl(l.u), uf + ' ' + l.u);
    });
  });
  H.FEDERAL.forEach(function (f) { assert.ok(H.validarUrl(f.u), f.id); });
});

test('toda capital tem prefeitura cadastrada, mais Catalão', () => {
  UFS.forEach(function (uf) { assert.ok(H.MUNICIPIOS.some(function (m) { return m.uf === uf; }), uf); });
  assert.ok(H.acharMunicipio('GO', 'catalão'));
  assert.equal(H.acharMunicipio('GO', 'Anápolis'), null);
  const extra = [{ uf: 'GO', m: 'Anápolis', u: 'https://exemplo.invalid/' }];
  assert.equal(H.acharMunicipio('GO', 'anapolis', extra).s, 'u');
  assert.deepEqual(H.municipiosDe('GO', extra).map(function (m) { return m.m; }), ['Anápolis', 'Catalão', 'Goiânia']);
});

test('reconhece documentos por palavra inteira, sem falso positivo', () => {
  const it = function (id) { return H.CHECKLIST.find(function (c) { return c.id === id; }); };
  const docs = [{ nome: 'CND Federal', validade: '2026-12-01' }, { nome: 'Comissão de licitação' }, { nome: 'CRF FGTS', validade: '2026-10-25' }, { nome: 'Certidão Municipal', validade: '2026-10-01' }];
  assert.equal(H.documentoDoItem(it('cnd-federal'), docs).nome, 'CND Federal');
  assert.equal(H.documentoDoItem(it('cnd-municipal'), [{ nome: 'Comissão de licitação' }]), null);
  assert.equal(H.documentoDoItem(it('docs-socios'), [{ nome: 'Cargo do sócio' }]), null);
  const p = H.painel(docs, '2026-10-21');
  const s = function (id) { return p.linhas.find(function (l) { return l.item.id === id; }).sit.codigo; };
  assert.equal(s('cnd-federal'), 'ok');
  assert.equal(s('crf-fgts'), 'vencendo');
  assert.equal(s('cnd-municipal'), 'vencido');
  assert.equal(s('cndt'), 'falta');
  assert.equal(p.contagem.falta, H.CHECKLIST.length - 3);
});

test('mais recente vence quando há duas versões', () => {
  const it = H.CHECKLIST.find(function (c) { return c.id === 'cndt'; });
  assert.equal(H.documentoDoItem(it, [{ nome: 'CNDT', validade: '2026-01-01' }, { nome: 'CNDT', validade: '2027-01-01' }]).validade, '2027-01-01');
});

test('lembrete: 7 dias antes, nunca no passado', () => {
  assert.equal(H.dataLembrete('2026-11-30', 7, '2026-10-21'), '2026-11-23');
  assert.equal(H.dataLembrete('2026-10-23', 7, '2026-10-21'), '2026-10-21');
  assert.equal(H.dataLembrete('', 7, '2026-10-21'), null);
});

test('SICAF tem 6 níveis e busca gera link do Google', () => {
  assert.deepEqual(H.SICAF_NIVEIS.map(function (n) { return n.n; }), ['I', 'II', 'III', 'IV', 'V', 'VI']);
  assert.equal(H.buscaGoogle('certidão Anápolis'), 'https://www.google.com/search?q=certid%C3%A3o%20An%C3%A1polis');
  assert.equal(H.validarUrl('javascript:alert(1)'), false);
});
