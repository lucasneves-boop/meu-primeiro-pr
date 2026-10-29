const test = require('node:test'); const assert = require('node:assert');
const src = require('fs').readFileSync(require('path').join(__dirname, '../js/ui.js'), 'utf8'); const self = {};
new Function('self', 'document', 'MutationObserver', src)(self, undefined, undefined); const P = self.UI.plurais;
test('flexão automática de "palavra(s)" pelo número mais próximo', () => {
  assert.equal(P('3 aviso(s) apagado(s).'), '3 avisos apagados.');
  assert.equal(P('1 aviso(s) apagado(s).'), '1 aviso apagado.');
  assert.equal(P('Excluir 1 cartão(ões)?'), 'Excluir 1 cartão?'); assert.equal(P('12 cartão(ões).'), '12 cartões.');
  assert.equal(P('2 fornecedor(es)'), '2 fornecedores'); assert.equal(P('3 item(ns)'), '3 itens');
  assert.equal(P('licitação(ões) ganhas'), 'licitações ganhas', 'sem número: plural');
  assert.equal(P('Vence em 1 dia(s)'), 'Vence em 1 dia');
  assert.equal(P('2 feriado(s) local(is)'), '2 feriados locais'); assert.equal(P('1 feriado(s) local(is)'), '1 feriado local');
  assert.equal(P('Texto sem parênteses'), 'Texto sem parênteses');
});
