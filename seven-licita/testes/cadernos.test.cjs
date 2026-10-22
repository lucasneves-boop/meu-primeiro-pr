const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/cadernos.js');

const EDITAL = `PREFEITURA MUNICIPAL DE CATALÃO
EDITAL DE PREGÃO ELETRÔNICO Nº 90021/2026

1. DO OBJETO
1.1. O objeto da presente licitação é a aquisição de material de expediente (papel A4, canetas e grampeadores), conforme condições do Termo de Referência.
1.2. A licitação será dividida em itens, sendo exclusiva para microempresas e empresas de pequeno porte nos itens de até R$ 80.000,00, nos termos da Lei Complementar nº 123/2006.

2. DA SESSÃO
2.1. A sessão pública será realizada no dia 15/11/2026, às 9h, no Portal de Compras.
2.2. O critério de julgamento será o de menor preço por item. O modo de disputa será aberto e fechado.
2.3. O valor total estimado da contratação é de R$ 245.300,00.

3. DA HABILITAÇÃO
3.1. Para habilitação será exigido o balanço patrimonial dos dois últimos exercícios sociais.
3.2. Prova de regularidade com o FGTS e certidão negativa de débitos trabalhistas (CNDT).
3.3. Atestado de capacidade técnica compatível com o objeto, emitido por pessoa jurídica.
3.4. Certidão negativa de falência expedida pelo distribuidor da sede.

4. DA ENTREGA E DO PAGAMENTO
4.1. O prazo de entrega será de 10 (dez) dias úteis contados do recebimento da nota de empenho.
4.2. O pagamento será efetuado em até 30 dias após o atesto da nota fiscal.
4.3. Os pedidos de impugnação deverão ser enviados até 3 dias úteis antes da data da sessão, ou seja, até 10 de novembro de 2026.`;

const fonte = () => ({ id: 'f1', nome: 'Edital 90021.pdf', texto: EDITAL });

test('frases respeitam abreviações e itens numerados', () => {
  const fs = C.frases('Conforme o art. 75 da Lei nº 14.133. Segundo item aqui. 1.1. Item numerado');
  assert.deepEqual(fs, ['Conforme o art. 75 da Lei nº 14.133.', 'Segundo item aqui.', '1.1. Item numerado']);
  assert.ok(C.dividir(EDITAL, 400).length >= 4);
});

test('busca BM25 encontra o trecho certo, sem acento', () => {
  const ix = C.indexar([fonte()]);
  assert.match(C.buscar(ix, 'balanco patrimonial', 1)[0].d.texto, /balanço patrimonial/);
  assert.equal(C.buscar(ix, 'xyzzy', 3).length, 0);
});

test('resposta extrativa com citação e recusa quando não há base', () => {
  const ix = C.indexar([{ id: 'f1', nome: 'Edital', texto: EDITAL, trechos: C.dividir(EDITAL, 300) }]);
  const r = C.responder(ix, 'Qual o prazo de entrega?');
  assert.match(r.texto, /10 \(dez\) dias úteis/); assert.match(r.texto, /\[1\]/);
  assert.equal(r.citacoes[0].nome, 'Edital');
  assert.ok(C.responder(ix, 'Quem ganhou a Copa do Mundo de futebol?').vazio);
});

test('análise de edital extrai os campos principais com a frase de origem', () => {
  const a = C.analisarEdital(C.indexar([fonte()]));
  const c = id => a.campos.find(x => x.id === id);
  assert.match(c('objeto').frase, /aquisição de material de expediente/);
  assert.match(c('modalidade').frase, /PREGÃO ELETRÔNICO Nº 90021\/2026/i);
  assert.equal(c('sessao').destaque, '15/11/2026');
  assert.equal(c('valor').destaque, 'R$ 245.300,00');
  assert.match(c('criterio').frase, /menor preço por item/);
  assert.match(c('disputa').frase, /aberto e fechado/);
  assert.match(c('meepp').frase, /exclusiva para microempresas/);
  assert.match(c('entrega').frase, /10 \(dez\) dias/);
  assert.equal(c('amostra').achado, false);
  const h = id => a.habilitacao.find(x => x.id === id).itens.length;
  assert.ok(h('economica') >= 2 && h('tecnica') >= 1 && h('fiscal') >= 1);
  assert.deepEqual(a.datas.map(d => d.data), ['2026-11-10', '2026-11-15']);
});

test('resumo, termos, linha do tempo, quiz e sugestões', () => {
  const ix = C.indexar([fonte()]);
  const r = C.resumo(ix, 4); assert.equal(r.length, 4); assert.ok(r.every(x => EDITAL.includes(x.frase.slice(0, 30))));
  const t = C.palavrasChave(ix, 8); assert.ok(t.length === 8 && t.every(x => x.length > 3));
  assert.equal(C.datasEm('em 1º de março de 2026 e 31/02/2026')[0].iso, '2026-03-01'); assert.equal(C.datasEm('31/02/2026').length, 0);
  const q = C.quiz(ix, 3, () => 0.3); assert.ok(q.length >= 1); q.forEach(x => { assert.match(x.enunciado, /_____/); assert.equal(x.opcoes.length, 4); assert.ok(x.correta >= 0); });
  assert.ok(C.perguntasSugeridas(ix).includes('Qual é o objeto?'));
});
