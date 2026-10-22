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

test('modelo Conta Azul: fluxo de caixa, previsto × realizado, aging, conciliação e centros de custo', () => {
  const F = require('../js/financas.js');
  const contas = [{ id: 'c1', saldoInicial: 1000 }];
  const L = [
    { id: 'a', tipo: 'receita', valor: 500, data: '2026-10-01', conta: 'c1', pago: true, contato: 'Prefeitura A', centroCusto: 'BPO' },
    { id: 'b', tipo: 'despesa', valor: 300, data: '2026-10-15', conta: 'c1', pago: false, contato: 'Fornecedor X', centroCusto: 'BPO' },            // atrasada em 22/10
    { id: 'c', tipo: 'receita', valor: 2000, data: '2026-10-25', conta: 'c1', pago: false, contato: 'Prefeitura A', centroCusto: 'Licitações' },
    { id: 'd', tipo: 'despesa', valor: 2500, data: '2026-10-23', conta: 'c1', pago: false, contato: 'Fornecedor Y' },
    { id: 'e', tipo: 'receita', valor: 800, data: '2026-07-01', conta: 'c1', pago: false, contato: 'Prefeitura B' },                            // 113 dias de atraso
    { id: 'f', tipo: 'despesa', valor: 99, data: '2026-10-20', cartao: 'k1', pago: false }                                                        // cartão: fora do caixa
  ];
  const fx = F.fluxoDiario(L, contas, '2026-10-22', 10);
  assert.equal(fx.saldoInicial, 1500);
  assert.equal(fx.atrasadoEntrada, 800); assert.equal(fx.atrasadoSaida, 300);
  assert.equal(fx.dias[0].saldo, 2000);              // 1500 + 800 − 300
  assert.equal(fx.dias[1].saldo, -500);              // − 2500 em 23/10
  assert.equal(fx.primeiroNegativo.data, '2026-10-23'); assert.equal(fx.minimo.saldo, -500);
  assert.equal(fx.dias[3].saldo, 1500);              // + 2000 em 25/10
  const m = F.fluxoMensal(L, ['2026-10']);
  assert.equal(m[0].previstoEntradas, 2500); assert.equal(m[0].realizadoEntradas, 500); assert.equal(m[0].previstoSaidas, 2800); assert.equal(m[0].realizadoSaidas, 0);
  const ag = F.aging(L, '2026-10-22', 'receita');
  const b = ag.find(x => x.contato === 'Prefeitura B'); assert.equal(b.mais90, 800); assert.equal(b.atrasado, 800);
  const a = ag.find(x => x.contato === 'Prefeitura A'); assert.equal(a.aVencer, 2000); assert.equal(a.atrasado, 0);
  assert.equal(ag[0].contato, 'Prefeitura B');
  const cz = F.conciliar([{ tipo: 'despesa', valor: 300, data: '2026-10-17' }, { tipo: 'receita', valor: 2000, data: '2026-11-10' }, { tipo: 'despesa', valor: 300, data: '2026-10-16' }], L.filter(l => !l.pago));
  assert.equal(cz[0].lancamento.id, 'b'); assert.equal(cz[0].dias, 2);
  assert.equal(cz[1].lancamento, null);  // fora da tolerância de 5 dias
  assert.equal(cz[2].lancamento, null);  // 'b' já usado
  const cc = F.porCampo(L, 'centroCusto');
  assert.equal(cc.find(x => x.chave === 'BPO').resultado, 200);
});

test('fluxo de caixa inclui faturas de cartão em aberto e série avança a competência', () => {
  const F = require('../js/financas.js');
  const k = { id: 'k1', nome: 'Visa', fechamento: 1, vencimento: 10 };
  const L = [{ id: 'c1', tipo: 'despesa', valor: 5000, data: '2026-10-05', cartao: 'k1', pago: false }];
  const fx = F.fluxoDiario(L, [{ id: 'cc', saldoInicial: 1000 }], '2026-10-22', 30, [k]);
  assert.ok(fx.primeiroNegativo, 'a fatura derruba o caixa');
  assert.equal(fx.dias[fx.dias.length - 1].saldo, -4000);
  const s = F.gerarSerie({ descricao: 'x', valor: 300, data: '2026-11-10', competencia: '2026-11' }, 3, 'parcelada', p => p + Math.random());
  assert.deepEqual(s.map(x => x.competencia), ['2026-11', '2026-12', '2027-01']);
});
