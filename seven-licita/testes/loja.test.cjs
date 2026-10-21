const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/loja.js');

const P = L.CATALOGO.map((p, i) => Object.assign({}, p, { preco: [null, 500, 1200, 300][i % 4], criadoEm: '2026-10-' + String(10 + i).padStart(2, '0') }));

test('catálogo inicial sem preço inventado e com categorias válidas', () => {
  L.CATALOGO.forEach(p => { assert.equal(p.preco, undefined); assert.ok(L.CATEGORIAS.some(c => c.id === p.cat), p.id); });
  assert.equal(new Set(L.CATALOGO.map(p => p.id)).size, L.CATALOGO.length);
});

test('busca por termo, acento e tag; título pesa mais', () => {
  const r = L.buscar(P, { q: 'impugnacao' });
  assert.equal(r[0].id, 'impugnacao');
  assert.ok(L.buscar(P, { q: 'SICAF' }).some(p => p.id === 'sicaf'));
  assert.equal(L.buscar(P, { q: 'xyzabc' }).length, 0);
  assert.equal(L.buscar(P, { q: 'recurso contrarrazões' })[0].id, 'recurso');
  assert.equal(L.buscar(P, {}).length, P.length);
});

test('filtros e ordenação', () => {
  assert.ok(L.buscar(P, { cat: 'juridico' }).every(p => p.cat === 'juridico'));
  assert.ok(L.buscar(P, { tipo: 'recorrente' }).every(p => p.tipo === 'recorrente'));
  const f = L.buscar(P, { min: 400, max: 1000 }); assert.ok(f.length && f.every(p => p.preco === 500));
  const m = L.buscar(P, { ordem: 'menor' }); assert.equal(m[0].preco, 300); assert.equal(m[m.length - 1].preco, null);
  assert.equal(L.buscar(P, { ordem: 'maior' })[0].preco, 1200);
  assert.equal(L.buscar(P, { ordem: 'novos' })[0].id, P[P.length - 1].id);
  const notas = L.avaliacoes([{ produto: 'sicaf', nota: 5 }, { produto: 'sicaf', nota: 4 }, { produto: 'recurso', nota: 3 }]);
  assert.equal(notas.sicaf.media, 4.5); assert.deepEqual(notas.sicaf.dist, [0, 0, 0, 1, 1]);
  assert.deepEqual(L.buscar(P, { nota: 4, notas }).map(p => p.id), ['sicaf']);
});

test('carrinho, cupom e totais (itens sob consulta não somam)', () => {
  let c = [];
  L.adicionar(c, 'analise-edital', 2); L.adicionar(c, 'analise-edital'); L.adicionar(c, 'bpo-completo');
  assert.equal(c[0].qtd, 3);
  let t = L.totais(c, P);
  assert.equal(t.subtotal, 1500); assert.equal(t.consulta, 1); assert.equal(t.itens, 4);
  t = L.totais(c, P, { codigo: 'BEMVINDO', tipo: 'percentual', valor: 10 }, '2026-10-21');
  assert.equal(t.desconto, 150); assert.equal(t.total, 1350);
  t = L.totais(c, P, { tipo: 'valor', valor: 5000 }); assert.equal(t.total, 0);
  t = L.totais(c, P, { tipo: 'valor', valor: 100, minimo: 2000 }); assert.equal(t.desconto, 0); assert.match(t.erroCupom, /mínimo/);
  t = L.totais(c, P, { tipo: 'valor', valor: 100, validade: '2026-10-01' }, '2026-10-21'); assert.equal(t.erroCupom, 'Cupom vencido.');
  c = L.definirQtd(c, 'analise-edital', 0); assert.equal(c.length, 1);
  c.push({ id: 'sicaf', qtd: 1, depois: true }); assert.equal(L.totais(c, P).linhas.length, 1, 'salvo para depois fica fora do total');
});

test('parcelas respeitam parcela mínima', () => {
  assert.equal(L.parcelas(1200, 12, 100), 12);
  assert.equal(L.parcelas(500, 12, 100), 5);
  assert.equal(L.parcelas(50, 12, 100), 1);
});

test('comprados juntos e recomendados', () => {
  const ped = [{ itens: [{ id: 'a', qtd: 1 }, { id: 'b', qtd: 1 }] }, { itens: [{ id: 'a', qtd: 1 }, { id: 'b', qtd: 2 }, { id: 'c', qtd: 1 }] }, { status: 'cancelado', itens: [{ id: 'a', qtd: 9 }] }];
  assert.deepEqual(L.compradosJuntos(ped, 'a'), ['b', 'c']);
  assert.deepEqual(L.vendas(ped), { a: 2, b: 3, c: 1 });
  const r = L.recomendados(P, [], 'recurso', 3);
  assert.equal(r.length, 3); assert.ok(r.every(p => p.id !== 'recurso')); assert.equal(r[0].cat, 'juridico');
});

test('numeração, mensagem e telefone', () => {
  assert.equal(L.proximoNumero([{ numero: '2026-0007' }, { numero: '2025-0100' }], 2026), '2026-0008');
  assert.equal(L.proximoNumero([], 2027), '2027-0001');
  const msg = L.mensagemPedido({ numero: '2026-0001', cliente: { contato: 'Ana' }, itens: [{ qtd: 2, t: 'Análise de edital', unidade: 'edital', preco: 500 }, { qtd: 1, t: 'BPO', unidade: 'mês', preco: null }], total: 1000, consulta: 1, pagamento: 'PIX' });
  assert.match(msg, /Olá, Ana!/); assert.match(msg, /2x Análise de edital \(edital\) — R\$ 1\.000,00/); assert.match(msg, /sob consulta/); assert.match(msg, /Lucas Neves \| Seven$/);
  assert.equal(L.telefoneWhats('(61) 98347-2232'), '5561983472232');
  assert.equal(L.telefoneWhats('123'), '');
});
