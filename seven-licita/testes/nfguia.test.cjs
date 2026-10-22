const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/nf-guia.js');

test('guia da NF: todo campo das etapas tem explicação e fonte oficial', () => {
  G.ETAPAS.forEach(e => e.campos.forEach(c => { const v = G.verbete(c); assert.ok(v, 'sem verbete: ' + c); assert.ok(v.f && v.o && v.t, 'incompleto: ' + c); assert.ok(v.fontes.length >= 1, 'sem fonte: ' + c); }));
  Object.keys(G.FONTES).forEach(k => assert.match(G.FONTES[k][1], /^https?:\/\/[^ ]+\.(gov\.br|com\.br)\//, k));
  Object.keys(G.VERBETES).forEach(k => (G.VERBETES[k].fontes || []).forEach(f => assert.ok(G.FONTES[f], 'fonte inexistente ' + f + ' em ' + k)));
  assert.equal(G.chave('itens.3.ncm'), 'itens.ncm'); assert.equal(G.chave('duplicatas.0.valor'), 'duplicatas'); assert.equal(G.chave('destinatario.cep'), 'destinatario.logradouro');
  assert.ok(G.pesquisar('difal').some(v => v.id === 'destinatario.aliqInternaDestino'));
  assert.match(G.busca('NCM papel'), /site%3Agov\.br/);
});
