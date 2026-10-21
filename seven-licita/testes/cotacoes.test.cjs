const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/cotacoes.js');

const EDITAL = `PREFEITURA MUNICIPAL DE CATALÃO - GO
SECRETARIA MUNICIPAL DE ADMINISTRAÇÃO
PREGÃO ELETRÔNICO Nº 90021/2026
PROCESSO ADMINISTRATIVO Nº 2026.0045
UASG: 987654
A sessão pública será realizada no dia 05/11/2026, às 09:00 horas, no portal Compras.gov.br.

1. DO OBJETO
1.1. O objeto da presente licitação é a aquisição de material de expediente para atender as secretarias municipais.

2. DAS CONDIÇÕES
Local de entrega: Almoxarifado Central, Rua 10, Centro, Catalão-GO.
O prazo de entrega será de 15 (quinze) dias úteis após o recebimento da nota de empenho.

ANEXO I - TERMO DE REFERÊNCIA
LOTE 1
ITEM DESCRIÇÃO UNID QTD VALOR UNIT VALOR TOTAL
1 Papel A4 75 g/m², branco, caixa com 10 resmas CX 200 R$ 245,90 R$ 49.180,00
2 Caneta esferográfica azul, ponta média
1,0 mm, corpo transparente UN 1.500 1,35 2.025,00
3 Grampeador de mesa 26/6, capacidade 25 folhas UN 40 38,50 1.540,00
LOTE 2
1 Toner compatível HP CF258A CARTUCHO 30 189,00 5.670,00
2 Pasta suspensa marmorizada 50 UN 3,10 155,00`;

test('cabeçalho do edital', () => {
  const h = C.extrairCabecalho(EDITAL);
  assert.equal(h.numero, '90021/2026'); assert.match(h.modalidade, /PREGÃO ELETRÔNICO/i);
  assert.equal(h.uasg, '987654'); assert.equal(h.dataSessao, '2026-11-05T09:00');
  assert.match(h.orgao, /PREFEITURA MUNICIPAL DE CATALÃO/); assert.equal(h.portal, 'Compras.gov.br');
  assert.match(h.objeto, /^aquisição de material de expediente/i);
  assert.match(h.localEntrega, /Almoxarifado Central/); assert.equal(h.prazoEntrega, '15 dias úteis');
  assert.equal(h.cidade, 'CATALÃO'); assert.equal(h.uf, 'GO');
});

test('itens do termo de referência, com lotes, quebra de linha e ordem quantidade/unidade', () => {
  const it = C.extrairItens(EDITAL);
  assert.equal(it.length, 5);
  assert.deepEqual([it[0].n, it[0].lote, it[0].unidade, it[0].quantidade, it[0].valorRef], [1, '1', 'CX', 200, 245.9]);
  assert.match(it[1].descricao, /Caneta .* 1,0 mm, corpo transparente$/); assert.equal(it[1].quantidade, 1500);
  assert.deepEqual([it[3].lote, it[3].n, it[3].unidade, it[3].quantidade], ['2', 1, 'CARTUCHO', 30]);
  assert.deepEqual([it[4].quantidade, it[4].unidade, it[4].valorRef], [50, 'UN', 3.1]);
});

test('itens de planilha com cabeçalho detectado', () => {
  const it = C.itensDePlanilha([['Pregão 12/2026'], [], ['Item', 'Descrição do produto', 'Unidade', 'Qtde', 'Valor unitário estimado', 'Valor total'], [1, 'Água mineral 500 ml', 'FD', '120', 'R$ 18,50', ''], [2, 'Copo descartável 200 ml', 'PCT', 300, 4.2, ''], ['', 'Total', '', '', '', '']]);
  assert.equal(it.length, 2); assert.deepEqual([it[0].n, it[0].unidade, it[0].quantidade, it[0].valorRef], [1, 'FD', 120, 18.5]); assert.equal(it[1].valorRef, 4.2);
});

test('números brasileiros e telefone do WhatsApp', () => {
  assert.equal(C.numeroBR('R$ 1.234,56'), 1234.56); assert.equal(C.numeroBR('1.500'), 1500); assert.equal(C.numeroBR('2.5'), 2.5); assert.equal(C.numeroBR(''), null);
  assert.equal(C.telefoneWhats('(61) 98347-2232'), '5561983472232'); assert.equal(C.telefoneWhats('+55 64 3441-0000'), '556434410000'); assert.equal(C.telefoneWhats('123'), '');
});

const forn = [
  { id: 'f1', fantasia: 'Papelaria Central', categorias: ['papelaria', 'material de expediente'], portfolio: [{ descricao: 'Papel sulfite A4 resma', marca: 'Chamex' }, { descricao: 'Caneta esferográfica', marca: 'BIC' }] },
  { id: 'f2', fantasia: 'InfoTech', categorias: ['informática', 'toner'], portfolio: [{ descricao: 'Toner compatível HP' }] },
  { id: 'f3', fantasia: 'Bloqueada', status: 'bloqueado', categorias: ['papel'] }
];
test('sugere fornecedores pelo portfólio e categorias', () => {
  const s = C.sugerirFornecedores(C.extrairItens(EDITAL), forn);
  assert.equal(s[0].fornecedor.id, 'f1'); assert.ok(s[0].itens.includes(0) && s[0].itens.includes(1));
  assert.ok(s.find(x => x.fornecedor.id === 'f2').itens.includes(3)); assert.ok(!s.find(x => x.fornecedor.id === 'f3'));
});

function cotacao() {
  return { id: 'c1', numero: 'COT-2026-001', titulo: 'Material de expediente', prazoResposta: '2026-10-23', licitacao: { orgao: 'Prefeitura de Catalão', numero: '90021/2026', modalidade: 'Pregão eletrônico', cidade: 'Catalão', uf: 'GO', prazoEntrega: '15 dias úteis' },
    itens: [{ id: 'i1', n: 1, descricao: 'Papel A4', unidade: 'CX', quantidade: 10, valorRef: 250 }, { id: 'i2', n: 2, descricao: 'Caneta azul', unidade: 'UN', quantidade: 100, valorRef: 1.5 }],
    fornecedores: [
      { fid: 'f1', status: 'respondida', enviadaEm: '2026-10-20T10:00:00', cadastro: { fantasia: 'Papelaria Central', contato: 'Ana Souza' }, resposta: { recebidaEm: '2026-10-20T16:00:00', itens: { i1: { preco: 230 }, i2: { preco: 1.6 } } } },
      { fid: 'f2', status: 'respondida', enviadaEm: '2026-10-20T10:00:00', resposta: { recebidaEm: '2026-10-21T10:00:00', itens: { i1: { preco: 240 }, i2: { preco: 1.2 } } } },
      { fid: 'f3', status: 'enviada', enviadaEm: '2026-10-20T10:00:00', followups: [] },
      { fid: 'f4', status: 'a-enviar' }
    ] };
}

test('mensagens de e-mail e WhatsApp sem expor o órgão por padrão', () => {
  const c = cotacao(); const w = C.mensagem('whatsapp', c, c.fornecedores[0]);
  assert.match(w, /^Olá, Ana!/); assert.match(w, /\*1\.\* Papel A4 — \*10 CX\*/); assert.match(w, /entrega em Catalão-GO/); assert.doesNotMatch(w, /Prefeitura/); assert.match(w, /\*23\/10\/2026\*/); assert.match(w, /Lucas Neves \| Seven$/);
  c.identificarOrgao = true; const e = C.mensagem('email', c, c.fornecedores[0], { assinatura: 'Equipe X' });
  assert.match(e, /\(Prefeitura de Catalão, Pregão eletrônico 90021\/2026\)/); assert.match(e, /Item 2: Caneta azul — 100 UN/); assert.match(e, /Prazo de entrega exigido: 15 dias úteis/); assert.match(e, /Equipe X$/);
  assert.equal(C.mensagem('assunto', c), 'Cotação COT-2026-001 — Material de expediente');
  assert.match(C.linkWhats('64 99999-0000', 'oi'), /^https:\/\/wa\.me\/5564999990000\?text=oi$/);
  assert.match(C.linkEmail('a@b.com', 'Assunto x', 'L1\nL2'), /^mailto:a@b\.com\?subject=Assunto%20x&body=L1%0AL2$/);
  const lista = C.listaItens(Array.from({ length: 30 }, (_, i) => ({ n: i + 1, descricao: 'x', quantidade: 1, unidade: 'UN' })), 'whatsapp', 25);
  assert.match(lista, /\+ 5 item\(ns\) na planilha anexa/);
});

test('mapa comparativo: melhor por item, combinado e melhor fornecedor único', () => {
  const m = C.mapa(cotacao());
  assert.equal(m.linhas[0].melhor.fid, 'f1'); assert.equal(m.linhas[1].melhor.fid, 'f2');
  assert.equal(m.melhorCombinado, 2300 + 120); assert.equal(m.melhorUnico.fid, 'f1'); assert.equal(m.melhorUnico.total, 2460);
  assert.ok(Math.abs(m.linhas[0].economia - 0.08) < 1e-9); assert.equal(m.referencia, 2650); assert.equal(m.linhas[1].mediana, 1.4);
});

test('follow-up: pendências por tempo e prazo', () => {
  const c = cotacao();
  assert.equal(C.precisaFollowup(c, c.fornecedores[2], '2026-10-20T20:00:00'), false);
  assert.equal(C.precisaFollowup(c, c.fornecedores[2], '2026-10-21T11:00:00'), true);
  assert.equal(C.precisaFollowup(c, c.fornecedores[0], '2026-10-22T11:00:00'), false);
  c.fornecedores[2].followups.push({ em: '2026-10-23T09:00:00' });
  assert.equal(C.precisaFollowup(c, c.fornecedores[2], '2026-10-23T12:00:00'), false);
  assert.equal(C.precisaFollowup(c, c.fornecedores[2], '2026-10-23T14:00:00'), true, 'perto do prazo cobra a cada 4h');
  assert.equal(C.pendencias([c], '2026-10-23T14:00:00').length, 1);
  c.status = 'concluida'; assert.equal(C.pendencias([c], '2026-10-23T14:00:00').length, 0);
});

test('indicadores do fornecedor e número da cotação', () => {
  const c = cotacao(); const i1 = C.indicadores('f1', [c]); const i3 = C.indicadores('f3', [c]);
  assert.deepEqual([i1.enviadas, i1.respondidas, i1.taxaResposta, i1.tempoMedioHoras, i1.itensCotados, i1.itensVencidos], [1, 1, 1, 6, 2, 1]);
  assert.ok(i1.nota > 3.5 && i1.nota <= 5, 'nota ' + i1.nota); assert.equal(i3.taxaResposta, 0); assert.ok(i3.nota < i1.nota);
  assert.equal(C.proximoNumero([{ numero: 'COT-2026-007' }, { numero: 'COT-2025-099' }], 2026), 'COT-2026-008');
});

test('planilha do fornecedor: gerar e ler a devolvida', () => {
  const c = cotacao(); const p = C.planilhaFornecedor(c, c.fornecedores[2], 'Seven');
  const cab = p.linhas[p.inicioItens - 1]; assert.deepEqual(cab, C.CAB);
  const L = p.linhas.map(r => r.slice());
  L[6][1] = '30'; L[7][1] = '28 dias'; L[8][1] = 'CIF';
  L[p.inicioItens][8] = '235,00'; L[p.inicioItens][6] = 'Chamex'; L[p.inicioItens][10] = '5';
  L[p.inicioItens + 1][11] = 'Não atendemos este item';
  const r = C.lerPlanilhaFornecedor(L, c);
  assert.equal(r.lidos, 2); assert.deepEqual([r.itens.i1.preco, r.itens.i1.marca, r.itens.i1.prazo], [235, 'Chamex', '5']);
  assert.equal(r.itens.i2.naoAtende, true); assert.deepEqual([r.condicoes.validade, r.condicoes.pagamento, r.condicoes.frete], ['30', '28 dias', 'CIF']);
});
