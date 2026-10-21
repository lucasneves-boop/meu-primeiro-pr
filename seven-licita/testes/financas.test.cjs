const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/financas.js');
let n = 0; const id = (p) => p + (++n);

test('somar meses respeita o último dia do mês', () => {
  assert.equal(F.addMeses('2026-01-31', 1), '2026-02-28');
  assert.equal(F.addMeses('2026-11-15', 3), '2027-02-15');
});

test('fatura do cartão: compra no dia do fechamento vai para a próxima', () => {
  assert.equal(F.mesFatura('2026-10-04', 5, 12), '2026-10');
  assert.equal(F.mesFatura('2026-10-05', 5, 12), '2026-11');
  // vencimento antes do fechamento: a fatura vence no mês seguinte ao fechamento
  assert.equal(F.mesFatura('2026-10-10', 25, 5), '2026-11');
  assert.equal(F.mesFatura('2026-12-20', 10, 15), '2027-01');
});

test('saldo da conta: cartão só sai da conta ao pagar a fatura; transferências movem entre contas', () => {
  const c1 = { id: 'c1', saldoInicial: 1000 }, c2 = { id: 'c2', saldoInicial: 0 };
  const cartao = { id: 'k', fechamento: 5, vencimento: 12 };
  const L = [
    { tipo: 'receita', conta: 'c1', valor: 500, data: '2026-10-01', pago: true },
    { tipo: 'despesa', conta: 'c1', valor: 200, data: '2026-10-02', pago: true },
    { tipo: 'despesa', conta: 'c1', valor: 999, data: '2026-10-03', pago: false },
    { tipo: 'despesa', cartao: 'k', valor: 300, data: '2026-10-01', pago: false },
    { tipo: 'transferencia', conta: 'c1', contaDestino: 'c2', valor: 100, data: '2026-10-04', pago: true },
    { tipo: 'pagamento-fatura', conta: 'c1', cartao: 'k', fatura: '2026-10', valor: 300, data: '2026-10-12', pago: true }
  ];
  assert.equal(F.saldoConta(c1, L), 1000 + 500 - 200 - 100 - 300);
  assert.equal(F.saldoConta(c2, L), 100);
  assert.equal(F.saldoConta(c1, L, '2026-10-02'), 1300);
  const f = F.fatura(cartao, L, '2026-10');
  assert.equal(f.total, 300); assert.equal(f.aberto, 0); assert.equal(f.vencimento, '2026-10-12');
  assert.equal(F.limiteUsado(cartao, L), 0);
});

test('compra parcelada divide o valor e acerta os centavos na 1ª parcela', () => {
  const s = F.gerarSerie({ descricao: 'Notebook', valor: 1000, data: '2026-10-31', tipo: 'despesa', pago: true }, 3, 'parcelada', id);
  assert.deepEqual(s.map(x => x.valor), [333.34, 333.33, 333.33]);
  assert.deepEqual(s.map(x => x.data), ['2026-10-31', '2026-11-30', '2026-12-31']);
  assert.equal(s[2].descricao, 'Notebook (3/3)');
  assert.equal(s[0].pago, true); assert.equal(s[1].pago, false);
  const fixa = F.gerarSerie({ descricao: 'Aluguel', valor: 1500, data: '2026-10-05', tipo: 'despesa' }, 12, 'fixa', id);
  assert.equal(fixa.length, 12); assert.equal(fixa[11].valor, 1500); assert.equal(fixa[11].descricao, 'Aluguel');
});

test('resumo, categorias, orçamento e análise do mês', () => {
  const L = [
    { tipo: 'receita', valor: 5000, data: '2026-10-01', pago: true, categoria: 'sal' },
    { tipo: 'despesa', valor: 900, data: '2026-10-03', pago: true, categoria: 'ali' },
    { tipo: 'despesa', valor: 300, data: '2026-10-10', pago: false, categoria: 'lazer' },
    { tipo: 'despesa', valor: 400, data: '2026-09-03', pago: true, categoria: 'ali' }
  ];
  const r = F.resumo(L, '2026-10');
  assert.equal(r.receitas, 5000); assert.equal(r.despesas, 1200); assert.equal(r.resultado, 3800); assert.equal(r.aPagar, 300);
  assert.equal(F.porCategoria(F.doMes(L, '2026-10'), 'despesa')[0].categoria, 'ali');
  const o = F.orcamentos([{ categoria: 'ali', valor: 1000 }, { categoria: 'lazer', valor: 200 }], L, '2026-10');
  assert.equal(o[0].estado, 'alerta'); assert.equal(o[1].estado, 'estourado');
  const txt = F.analise(L, '2026-10', [{ id: 'ali', nome: 'Alimentação' }, { id: 'lazer', nome: 'Lazer' }], [{ categoria: 'lazer', valor: 200 }]).join(' ');
  assert.match(txt, /positivo/); assert.match(txt, /Alimentação cresceu 125%/); assert.match(txt, /Lazer estourado/);
});

test('DRE simples pelos grupos das categorias', () => {
  const cats = [{ id: 'v', tipo: 'receita', grupo: 'receita' }, { id: 'i', grupo: 'imposto' }, { id: 'c', grupo: 'custo' }, { id: 'o', grupo: 'operacional' }, { id: 'f', grupo: 'financeira' }];
  const d = F.dre([{ tipo: 'receita', categoria: 'v', valor: 10000 }, { tipo: 'despesa', categoria: 'i', valor: 600 }, { tipo: 'despesa', categoria: 'c', valor: 5000 }, { tipo: 'despesa', categoria: 'o', valor: 2000 }, { tipo: 'despesa', categoria: 'f', valor: 100 }], cats);
  assert.equal(d.receitaLiquida, 9400); assert.equal(d.lucroBruto, 4400); assert.equal(d.resultadoOperacional, 2400); assert.equal(d.resultado, 2300); assert.equal(d.margem, 0.23);
});

test('importa extrato OFX e CSV', () => {
  const ofx = 'OFXHEADER:100\n<OFX><BANKTRANLIST>\n<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>20261005120000[-3:BRT]\n<TRNAMT>-45.90\n<FITID>abc1\n<MEMO>PADARIA PAO QUENTE\n</STMTTRN>\n<STMTTRN>\n<TRNTYPE>CREDIT\n<DTPOSTED>20261006\n<TRNAMT>1200.00\n<FITID>abc2\n<NAME>PIX RECEBIDO\n</STMTTRN></BANKTRANLIST></OFX>';
  const o = F.lerOFX(ofx);
  assert.deepEqual(o.map(x => [x.data, x.valor, x.tipo, x.idBanco]), [['2026-10-05', 45.9, 'despesa', 'abc1'], ['2026-10-06', 1200, 'receita', 'abc2']]);
  const lerN = (v) => Number(String(v).replace(/\./g, '').replace(',', '.'));
  const c = F.lerExtratoCSV([['Data', 'Histórico', 'Valor'], ['05/10/2026', 'Mercado', '-123,45'], ['06/10/2026', 'Salário', '3.000,00']], lerN);
  assert.deepEqual(c.map(x => [x.data, x.valor, x.tipo]), [['2026-10-05', 123.45, 'despesa'], ['2026-10-06', 3000, 'receita']]);
  assert.equal(F.sugerirCategoria('PADARIA DO BAIRRO', [{ descricao: 'Padaria pão quente', categoria: 'ali' }]), 'ali');
});
