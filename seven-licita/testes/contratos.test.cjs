const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../js/contratos.js');

test('contratos: CPF, ordem de assinatura, situação, registro e hash', async () => {
  assert.equal(K.cpfValido('529.982.247-25'), true); assert.equal(K.cpfValido('111.111.111-11'), false); assert.equal(K.cpfValido('529.982.247-24'), false);
  assert.equal(K.emailValido('a@b.com.br'), true); assert.equal(K.emailValido('a@b'), false);
  const c = { situacao: 'enviado', sequencial: true, documento: { hash: 'ab'.repeat(32) }, signatarios: [
    { id: 's1', nome: 'Ana', email: 'ana@x.com', ordem: 1, papel: 'contratante' }, { id: 's2', nome: 'Beto', email: 'b@x.com', ordem: 2, papel: 'contratado' }, { id: 's3', nome: 'Caio', email: 'c@x.com', ordem: 2, papel: 'testemunha' }] };
  assert.equal(K.podeAssinar(c, 's1'), true); assert.equal(K.podeAssinar(c, 's2'), false, 'sequencial: espera a vez');
  c.signatarios[0].assinadoEm = '2026-10-22T13:00:00Z';
  assert.equal(K.podeAssinar(c, 's2'), true); assert.equal(K.podeAssinar(c, 's3'), true, 'mesma ordem assina junto');
  assert.equal(K.situacao(c), 'enviado'); assert.deepEqual(K.progresso(c), { feitas: 1, total: 3, pct: 1 / 3 });
  c.sequencial = false; c.signatarios[0].assinadoEm = null; assert.equal(K.podeAssinar(c, 's3'), true, 'simultâneo: todos podem');
  c.signatarios.forEach(s => { s.assinadoEm = '2026-10-22T13:00:00Z'; s.evidencias = { metodo: 'digitada', hashVisto: c.documento.hash }; });
  assert.equal(K.situacao(c), 'assinado');
  c.signatarios[1].assinadoEm = null; c.signatarios[1].recusadoEm = '2026-10-22T14:00:00Z'; assert.equal(K.situacao(c), 'recusado');
  assert.equal(K.situacao({ situacao: 'enviado', prazo: '2020-01-01', signatarios: [{ id: 'x' }] }), 'expirado');
  assert.deepEqual(K.validarEnvio({ signatarios: [{ nome: '', email: 'x', cpf: '123' }] }), ['Anexe o documento (PDF) ou gere pelo modelo.', 'Signatário 1: informe o nome.', 'Signatário 1: informe e-mail ou WhatsApp para enviar o link.', 'Signatário 1: CPF inválido.']);
  assert.equal(await K.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(K.codigoVerificacao('ba7816bf8f01cfea41'), 'BA78-16BF-8F01-CFEA');
  assert.equal(K.preencher('Entre {a} e {b}.', { a: 'X' }), 'Entre X e [B].'); assert.deepEqual(K.pendencias('[B] e [B] e [C]'), ['[B]', '[C]']);
  const r = K.registro(Object.assign(c, { titulo: 'Contrato BPO', criadoEm: '2026-10-22T12:00:00Z', criadoPor: 'Lucas' })).join('\n');
  assert.ok(/REGISTRO DE ASSINATURAS/.test(r) && /Recusou em/.test(r) && /Lei 14\.063\/2020/.test(r) && /ABAB-ABAB/.test(r));
  assert.equal(K.mascaraCpf('52998224725'), '***.982.247-**');
  assert.equal(K.token(16).length, 32);
});
