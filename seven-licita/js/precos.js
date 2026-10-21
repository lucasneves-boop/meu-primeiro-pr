/* Seven Licita — fórmulas de precificação (produto e serviço). Sem DOM. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Precos = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const n = function (v) { v = Number(v); return isFinite(v) ? v : 0; };
  const pct = function (v) { return n(v) / 100; };

  // Pontos de partida editáveis. Alíquotas mudam por atividade, faturamento e estado: confirme com o contador.
  const REGIMES = {
    simples: { t: 'Simples Nacional (alíquota efetiva)', produto: { impostos: 6 }, servico: { tributos: 6 } },
    presumido: { t: 'Lucro Presumido', produto: { impostos: 5.93 }, servico: { tributos: 11.33 } },
    real: { t: 'Lucro Real', produto: { impostos: 9.25 }, servico: { tributos: 14.25 } },
    manual: { t: 'Informar manualmente', produto: {}, servico: {} }
  };
  // Lucro Presumido, comércio: PIS 0,65 + COFINS 3 + IRPJ 1,2 (8% × 15%) + CSLL 1,08 (12% × 9%) = 5,93% (sem ICMS).
  // Lucro Presumido, serviços: PIS 0,65 + COFINS 3 + IRPJ 4,8 (32% × 15%) + CSLL 2,88 (32% × 9%) = 11,33% (sem ISS).
  // Lucro Real: PIS 1,65 + COFINS 7,6 = 9,25% antes dos créditos (IRPJ/CSLL sobre o lucro ficam fora).

  // Custo financeiro de receber em `dias` com taxa mensal `taxaMes` (%), como % do preço.
  function custoFinanceiro(dias, taxaMes) { if (!n(dias) || !n(taxaMes)) return 0; return (Math.pow(1 + pct(taxaMes), n(dias) / 30) - 1) * 100; }

  // Produto: preço = custo direto ÷ (1 − soma dos percentuais sobre o preço).
  function produto(p) {
    const q = Math.max(1, n(p.quantidade) || 1);
    const diretos = {
      compra: n(p.custo), freteCompra: n(p.freteCompra), embalagem: n(p.embalagem), outros: n(p.outrosDiretos),
      freteEntrega: n(p.freteEntregaTotal) / q, difal: n(p.custo) * pct(p.difal)
    };
    const custoDireto = Object.keys(diretos).reduce(function (s, k) { return s + diretos[k]; }, 0);
    const fin = p.custoFinanceiro != null && p.custoFinanceiro !== '' ? n(p.custoFinanceiro) : custoFinanceiro(p.prazoPagamento, p.taxaMes);
    const sobrePreco = { impostos: n(p.impostos), comissao: n(p.comissao), financeiro: fin, bpo: n(p.taxaBpo), fixas: n(p.despesasFixas), garantia: n(p.garantia), outrosPct: n(p.outrosPct) };
    const somaSemMargem = Object.keys(sobrePreco).reduce(function (s, k) { return s + sobrePreco[k]; }, 0);
    const margem = n(p.margem);
    const den = 1 - (somaSemMargem + margem) / 100; const denMin = 1 - somaSemMargem / 100;
    const r = { quantidade: q, diretos: diretos, custoDireto: custoDireto, sobrePreco: sobrePreco, somaSemMargem: somaSemMargem, margem: margem, valido: den > 0 && denMin > 0 };
    if (!r.valido) return r;
    r.preco = custoDireto / den; r.markup = r.preco / (custoDireto || 1); r.precoMinimo = custoDireto / denMin;
    r.valores = {}; Object.keys(sobrePreco).forEach(function (k) { r.valores[k] = r.preco * sobrePreco[k] / 100; });
    r.lucro = r.preco * margem / 100; r.margemContribuicao = r.preco - custoDireto - r.preco * (n(p.impostos) + n(p.comissao) + fin + n(p.taxaBpo) + n(p.garantia) + n(p.outrosPct)) / 100;
    r.total = r.preco * q; r.lucroTotal = r.lucro * q; r.totalMinimo = r.precoMinimo * q;
    if (n(p.referencia)) { r.referencia = n(p.referencia); r.descontoSobreRef = 1 - r.preco / r.referencia; r.margemNaReferencia = margemEm(r, r.referencia); r.cabe = r.precoMinimo <= r.referencia; }
    return r;
  }

  // Margem líquida (%) se vender por `preco`, mantendo os demais percentuais.
  function margemEm(r, preco) { if (!preco) return null; const m = (1 - r.custoDireto / preco - r.somaSemMargem / 100) * 100; return Math.abs(m) < 1e-9 ? 0 : m; }

  // Lances do valor de referência (ou preço) até o mínimo, com a margem de cada um.
  function tabelaLances(r, passos) {
    if (!r.valido) return [];
    const topo = Math.max(r.referencia || 0, r.preco); const piso = r.precoMinimo; passos = passos || 10;
    const out = [];
    for (let i = 0; i <= passos; i++) { const v = topo - (topo - piso) * i / passos; out.push({ preco: v, desconto: r.referencia ? 1 - v / r.referencia : null, margem: margemEm(r, v), lucroTotal: (v * (margemEm(r, v) / 100)) * r.quantidade || 0 }); }
    return out;
  }

  // Serviço com mão de obra: custo mensal por posto + BDI (fórmula do Acórdão TCU 2.622/2013):
  // BDI = ((1 + AC + S + R + G) × (1 + DF) × (1 + L)) ÷ (1 − T) − 1
  function bdi(b) {
    const den = 1 - pct(b.tributos); if (den <= 0) return NaN;
    return ((1 + pct(b.administracao) + pct(b.seguro) + pct(b.risco) + pct(b.garantia)) * (1 + pct(b.financeiro)) * (1 + pct(b.lucro))) / den - 1;
  }

  function servico(s) {
    const salario = n(s.salario) * (1 + pct(s.adicionais));
    const encargos = salario * pct(s.encargos);
    const posto = { remuneracao: salario, encargos: encargos, beneficios: n(s.beneficios), uniformes: n(s.uniformes), insumos: n(s.insumos), equipamentos: n(s.equipamentos), outros: n(s.outros) };
    const custoPosto = Object.keys(posto).reduce(function (t, k) { return t + posto[k]; }, 0);
    const postos = Math.max(1, n(s.postos) || 1); const meses = Math.max(1, n(s.meses) || 12);
    const custoMensal = custoPosto * postos; const taxa = bdi(s);
    const r = { posto: posto, custoPosto: custoPosto, postos: postos, meses: meses, custoMensal: custoMensal, bdi: taxa, valido: isFinite(taxa) };
    if (!r.valido) return r;
    r.precoPosto = custoPosto * (1 + taxa); r.precoMensal = custoMensal * (1 + taxa); r.precoTotal = r.precoMensal * meses;
    r.tributosValor = r.precoMensal * pct(s.tributos); r.lucroValor = custoMensal * (1 + pct(s.administracao) + pct(s.seguro) + pct(s.risco) + pct(s.garantia)) * (1 + pct(s.financeiro)) * pct(s.lucro);
    const semLucro = Object.assign({}, s, { lucro: 0 }); r.precoMinimoMensal = custoMensal * (1 + bdi(semLucro));
    if (n(s.referencia)) { r.referencia = n(s.referencia); r.descontoSobreRef = 1 - r.precoMensal / r.referencia; r.cabe = r.precoMinimoMensal <= r.referencia; }
    return r;
  }

  // Ponto de equilíbrio: quantas unidades cobrem um custo fixo, dada a margem de contribuição unitária.
  function equilibrio(custoFixo, margemContribuicaoUnit) { return margemContribuicaoUnit > 0 ? Math.ceil(n(custoFixo) / margemContribuicaoUnit) : null; }

  return { REGIMES: REGIMES, custoFinanceiro: custoFinanceiro, produto: produto, margemEm: margemEm, tabelaLances: tabelaLances, bdi: bdi, servico: servico, equilibrio: equilibrio };
});
