const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/precos.js');
const perto = (a, b, tol) => assert.ok(Math.abs(a - b) < (tol || 0.005), a + ' ≈ ' + b);

test('produto: preço por divisor e preço mínimo sem margem', () => {
  const r = P.produto({ custo: 70, freteCompra: 5, freteEntregaTotal: 500, quantidade: 100, impostos: 10, margem: 10 });
  perto(r.custoDireto, 80);
  perto(r.preco, 100);
  perto(r.precoMinimo, 80 / 0.9);
  perto(r.lucro, 10);
  perto(r.total, 10000);
  perto(r.markup, 1.25);
});

test('produto: referência, desconto possível e margem na referência', () => {
  const r = P.produto({ custo: 80, impostos: 10, margem: 10, referencia: 125 });
  perto(r.descontoSobreRef, 0.2);
  perto(r.margemNaReferencia, (1 - 80 / 125 - 0.10) * 100);
  assert.equal(r.cabe, true);
  const lances = P.tabelaLances(r, 4);
  perto(lances[0].preco, 125); perto(lances[4].preco, r.precoMinimo); perto(lances[4].margem, 0);
});

test('produto: percentuais que somam 100% ou mais invalidam', () => {
  assert.equal(P.produto({ custo: 10, impostos: 60, margem: 40 }).valido, false);
});

test('custo financeiro composto pelo prazo de pagamento', () => {
  perto(P.custoFinanceiro(30, 2), 2);
  perto(P.custoFinanceiro(60, 2), 4.04);
  assert.equal(P.custoFinanceiro(0, 2), 0);
});

test('BDI pela fórmula do TCU', () => {
  // ((1+0,04+0,008+0,0127+0)*(1+0,0123)*(1+0,074))/(1-0,0865) - 1
  const b = P.bdi({ administracao: 4, seguro: 0.8, risco: 1.27, garantia: 0, financeiro: 1.23, lucro: 7.4, tributos: 8.65 });
  perto(b, ((1.0607) * 1.0123 * 1.074) / 0.9135 - 1, 1e-9);
});

test('serviço: custo do posto, BDI e preço mensal/total', () => {
  const r = P.servico({ salario: 2000, adicionais: 0, encargos: 70, beneficios: 600, uniformes: 50, insumos: 0, postos: 2, meses: 12, administracao: 5, lucro: 10, tributos: 10 });
  perto(r.custoPosto, 2000 + 1400 + 600 + 50);
  perto(r.custoMensal, 8100);
  perto(r.bdi, (1.05 * 1.10) / 0.9 - 1, 1e-9);
  perto(r.precoTotal, r.precoMensal * 12);
  assert.ok(r.precoMinimoMensal < r.precoMensal);
});

test('ponto de equilíbrio', () => {
  assert.equal(P.equilibrio(1000, 30), 34);
  assert.equal(P.equilibrio(1000, 0), null);
});

test('planilha de vários itens: global, individual, rateio de frete, modos e alertas', () => {
  const P = require('../js/precos.js');
  const pj = { params: { impostos: 6, comissao: 0, taxaBpo: 0, despesasFixas: 4, prazoPagamento: 0, taxaMes: 0, garantia: 0, outrosPct: 0, difal: 0, margem: 10, casas: 2, freteEntregaTotal: 300, rateioFrete: 'valor', margemMinima: 5 },
    itens: [
      { id: 'a', numero: 1, lote: '1', quantidade: 10, custo: 80, referencia: 120 },               // global: 80 + frete
      { id: 'b', numero: 2, lote: '1', quantidade: 20, custo: 10, referencia: 30 },
      { id: 'c', numero: 3, lote: '2', quantidade: 5, custo: 100, referencia: 110, individual: true, params: { margem: 2 } },
      { id: 'd', numero: 4, lote: '2', quantidade: 1, custo: 50, referencia: 200, modo: 'preco', alvo: 60 },
      { id: 'e', numero: 5, lote: '2', quantidade: 2, custo: 0 }
    ] };
  // frete por valor: pesos 800, 200, 500, 50 → 300 × peso / 1550
  const fr = P.rateioFrete(pj);
  assert.ok(Math.abs(fr.a - 300 * 800 / 1550) < 1e-9 && Math.abs(Object.values(fr).reduce((s, v) => s + v, 0) - 300) < 1e-9);
  const r = P.planilha(pj);
  const a = r.itens[0];
  const custoA = 80 + 300 * 800 / 1550 / 10;
  assert.ok(Math.abs(a.custoDireto - custoA) < 1e-9);
  assert.equal(a.unitario, Math.ceil(custoA / 0.8 * 100 - 1e-7) / 100); // 6% + 4% + 10% = 20%
  assert.equal(a.total, Math.round(a.unitario * 10 * 100) / 100);
  assert.ok(a.margem >= 10 - 1e-9, 'arredondar para cima nunca reduz a margem');
  // individual sobrescreve só a margem
  const c = r.itens[2]; assert.equal(c.individual, true);
  assert.ok(Math.abs(c.sugerido - c.custoDireto / (1 - 0.12)) < 1e-9);
  assert.ok(c.alertas.some(x => /mínima/.test(x.t)), 'margem 2% < mínima 5%');
  // preço-alvo: 60 com custo 50+frete → margem calculada; abaixo de 50% da referência 200 → indício de inexequibilidade
  const d = r.itens[3]; assert.equal(d.unitario, 60); assert.ok(d.alertas.some(x => /inexequibilidade/.test(x.t)));
  // sem custo
  assert.equal(r.itens[4].ok, false); assert.equal(r.totais.precificados, 4);
  // lotes
  assert.equal(r.lotes.length, 2); assert.equal(r.lotes[0].total, Math.round((a.total + r.itens[1].total) * 100) / 100);
  assert.equal(r.lotes[1].completos, false);
  // acima da referência
  const r2 = P.planilha({ params: Object.assign({}, pj.params, { freteEntregaTotal: 0, margem: 30 }), itens: [{ id: 'x', quantidade: 1, custo: 90, referencia: 120 }] });
  assert.ok(r2.itens[0].alertas.some(x => /Acima do valor de referência/.test(x.t)));
  // desconto sobre a referência
  const r3 = P.planilha({ params: Object.assign({}, pj.params, { freteEntregaTotal: 0 }), itens: [{ id: 'y', quantidade: 3, custo: 50, referencia: 100, modo: 'desconto', alvo: 15 }] });
  assert.equal(r3.itens[0].unitario, 85); assert.equal(r3.totais.total, 255);
  // engenharia: 75%
  const r4 = P.planilha({ params: Object.assign({}, pj.params, { freteEntregaTotal: 0, engenharia: true }), itens: [{ id: 'z', quantidade: 1, custo: 50, referencia: 100, modo: 'preco', alvo: 70 }] });
  assert.ok(r4.itens[0].alertas.some(x => /75%/.test(x.t)));
  assert.equal(P.extenso(1250.5), 'mil duzentos e cinquenta reais e cinquenta centavos');
  assert.equal(P.extenso(2500000), 'dois milhões e quinhentos mil reais');
  assert.equal(P.extenso(1000000), 'um milhão de reais');
});

test('comissão e taxa da Seven sobre o lucro líquido', () => {
  const P2 = require('../js/precos.js');
  // custo 100, impostos 10%, margem final 10%, comissão 20% do lucro
  const r = P2.produto({ custo: 100, impostos: 10, margem: 10, comissao: 20, comissaoBase: 'lucro' });
  // lucro antes da comissão = 10 / 0,8 = 12,5% do preço; preço = 100 / (1 − 0,10 − 0,125) = 129,03
  assert.ok(Math.abs(r.preco - 100 / 0.775) < 1e-6);
  assert.ok(Math.abs(r.lucroAntes - r.preco * 0.125) < 1e-6 && Math.abs(r.valores.comissao - r.lucroAntes * 0.2) < 1e-6 && Math.abs(r.lucro - r.preco * 0.10) < 1e-6);
  assert.ok(Math.abs(r.custoDireto + r.valores.impostos + r.valores.comissao + r.lucro - r.preco) < 1e-6, 'a composição fecha no preço');
  assert.ok(Math.abs(r.precoMinimo - 100 / 0.9) < 1e-6, 'sem lucro não há comissão sobre o lucro');
  assert.ok(Math.abs(P2.margemEm(r, r.preco) - 10) < 1e-9, 'margem final 10% no preço sugerido');
  assert.ok(P2.margemEm(r, 105) < 0, 'abaixo do custo a margem é negativa e sem comissão');
  // sobre o preço continua igual
  const v = P2.produto({ custo: 100, impostos: 10, margem: 10, comissao: 5 }); assert.ok(Math.abs(v.preco - 100 / 0.75) < 1e-6);
  // planilha com a mesma configuração global
  const pl = P2.planilha({ params: { impostos: 10, margem: 10, comissao: 20, comissaoBase: 'lucro' }, itens: [{ id: 'a', custo: 100, quantidade: 2 }] });
  assert.ok(Math.abs(pl.itens[0].margem - 10) < 0.05 && Math.abs(pl.itens[0].sugerido - 100 / 0.775) < 1e-6);
});

test('precificação especialista: Simples por anexo, ICMS, SRP, regimes, reforma e IN 05', () => {
  const P2 = require('../js/precos.js'); const perto = (a, b, m) => assert.ok(Math.abs(a - b) < 0.01, (m || '') + ' esperado ' + b + ', veio ' + a);
  perto(P2.simplesEfetiva('I', 100000).aliquota, 4, 'faixa 1');
  perto(P2.simplesEfetiva('I', 1000000).aliquota, (1000000 * 0.107 - 22500) / 1000000 * 100, 'faixa 4 do anexo I'); // 8,45%
  assert.equal(P2.simplesEfetiva('III', 4000000).acimaSublimite, true);
  // ICMS na venda e crédito da compra
  const r = P2.produto({ custo: 100, impostos: 5.93, icmsVenda: 18, icmsCredito: 12, margem: 10 });
  perto(r.custoDireto, 88, 'crédito de 12% reduz o custo'); perto(r.preco, 88 / (1 - 0.0593 - 0.18 - 0.10));
  // participação e reajuste
  const r2 = P2.produto({ custo: 100, quantidade: 10, custosParticipacao: 200, inflacaoAno: 12, mesesCompra: 6, margem: 0 });
  perto(r2.diretos.participacao, 20); perto(r2.diretos.reajuste, 100 * (Math.sqrt(1.12) - 1));
  // prazo real do órgão entra no custo financeiro
  assert.ok(P2.produto({ custo: 100, prazoPagamento: 30, atrasoOrgao: 30, taxaMes: 2, margem: 0 }).sobrePreco.financeiro > P2.produto({ custo: 100, prazoPagamento: 30, taxaMes: 2, margem: 0 }).sobrePreco.financeiro);
  // SRP: comprar 30% encarece (frete total dividido por menos unidades)
  const v = P2.cenariosVolume({ custo: 100, quantidade: 100, freteEntregaTotal: 1000, margem: 10 }, [0.3, 1]);
  assert.ok(v[0].preco > v[1].preco && v[0].margemNoPrecoCheio < 10 && Math.abs(v[1].margemNoPrecoCheio - 10) < 1e-6);
  // regimes ordenados do mais barato ao mais caro, todos com preço
  const g = P2.compararRegimes({ custo: 100, icmsVenda: 18, icmsCredito: 12, margem: 10 }, { anexo: 'I', rbt12: 500000 });
  assert.equal(g.length, 3); assert.ok(g.every(x => x.preco > 0)); assert.ok(g[0].preco <= g[1].preco && g[1].preco <= g[2].preco);
  // reforma: 2026 é teste (sem custo), 2033 sem ICMS
  const ref = P2.simularReforma({ custo: 100, icmsVenda: 18, margem: 10 }, { pisCofins: 3.65, tributosForaIcms: 2.28 });
  const a26 = ref.find(x => x.ano === 2026), a33 = ref.find(x => x.ano === 2033);
  perto(a26.cargaSobrePreco, 2.28 + 3.65 + 18); assert.equal(a33.icmsFracao, 0); assert.ok(a33.credito > 0);
  // IN 05/2017
  const en = P2.encargosIN05(2000); perto(en.m21, 2000 * 0.1944); perto(en.m22, (2000 + en.m21) * 0.358); assert.ok(en.pct > 60 && en.pct < 90);
  const sv = P2.servico({ salario: 2000, detalharEncargos: true, postos: 1, meses: 12 }); perto(sv.posto.encargos, en.total);
  // planilha rateia custos de participação
  const pl = P2.planilha({ params: { margem: 0, custosParticipacao: 100 }, itens: [{ id: 'a', custo: 10, quantidade: 10 }, { id: 'b', custo: 10, quantidade: 10 }] });
  perto(pl.itens[0].custoDireto, 15); perto(pl.itens[1].custoDireto, 15);
});

test('preço de mercado a partir das análises do PNCP', () => {
  const P2 = require('../js/precos.js');
  const an = [{ amostras: [{ descricao: 'PAPEL A4 75G RESMA 500 FOLHAS', unitario: 20 }, { descricao: 'Papel sulfite A4 75 g resma', unitario: 24, referencia: 30 }, { descricao: 'Caneta azul', unitario: 1 }, { descricao: 'papel A4 resma 75g', unitario: 22 }] }];
  const m = P2.mercado(an, 'Papel A4 75 g resma'); assert.equal(m.n, 3); assert.equal(m.minimo, 20); assert.equal(m.mediana, 22); assert.ok(Math.abs(m.descontoMedio - 0.2) < 1e-9);
  assert.equal(P2.mercado(an, 'Toner HP').n, 0);
});
