/* Seven Comissão: comissão sobre o preço de venda ou sobre o lucro líquido.
   Responde: quanto recebo, quanto preciso vender em licitação para chegar ao alvo, que margem líquida preciso
   e que percentual preciso, em todos os cenários. Percentuais entram em pontos (5 = 5%). Puro: roda no navegador e no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Comissao = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const PCTS = [1, 2, 3, 4, 5, 7.5, 10, 15, 20, 25, 30];
  const MARGENS = [5, 10, 15, 20, 25, 30];

  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function pos(v) { v = num(v); return v != null && v > 0 ? v : null; }
  function div(a, b) { return a != null && b ? a / b : null; }

  // margem líquida (%) a partir de custo, impostos e despesas sobre a venda
  function margemDosCustos(venda, custo, impostos, despesas) {
    venda = pos(venda); if (!venda) return null;
    const lucro = venda - (num(custo) || 0) - venda * ((num(impostos) || 0) + (num(despesas) || 0)) / 100;
    return lucro / venda * 100;
  }

  // o: { base: 'venda'|'lucro', pct, venda, margem, alvo, retencao, contratos }
  function calcular(o) {
    o = o || {};
    const base = o.base === 'lucro' ? 'lucro' : 'venda';
    const pct = pos(o.pct), venda = pos(o.venda), margem = num(o.margem), alvo = pos(o.alvo);
    const ret = Math.min(99.99, Math.max(0, num(o.retencao) || 0)); const fl = 1 - ret / 100; // o que sobra da comissão depois de impostos/retenções
    const contratos = Math.max(1, Math.round(num(o.contratos) || 1));
    const m = margem != null ? margem / 100 : null; const p = pct != null ? pct / 100 : null;
    const lucro = venda != null && m != null ? venda * m : null;
    const fator = base === 'venda' ? p : (p != null && m != null ? p * Math.max(0, m) : null); // comissão por R$ 1 vendido (sem lucro, sem comissão)
    const bruta = venda != null && fator != null ? venda * fator : null;
    const liquida = bruta != null ? bruta * fl : null;
    const alvoBruto = alvo != null ? alvo / fl : null; // comissão bruta necessária para receber o alvo líquido
    const vendaNec = fator && fator > 0 && alvoBruto != null ? alvoBruto / fator : null;
    const r = {
      base: base, pct: pct, venda: venda, margem: margem, alvo: alvo, retencao: ret, contratos: contratos,
      lucro: lucro, prejuizo: lucro != null && lucro <= 0,
      comissaoBruta: bruta, comissaoLiquida: liquida, retida: bruta != null ? bruta - liquida : null,
      comissaoSobreVenda: venda != null && p != null ? venda * p * fl : null,
      comissaoSobreLucro: lucro != null && p != null ? Math.max(0, lucro) * p * fl : null,
      alvoBruto: alvoBruto,
      atingiu: liquida != null && alvo != null ? liquida >= alvo - 0.005 : null,
      falta: liquida != null && alvo != null ? Math.max(0, alvo - liquida) : null,
      vendaNecessaria: vendaNec, vendaPorContrato: vendaNec != null ? vendaNec / contratos : null,
      margemNecessaria: base === 'lucro' && venda && p && alvoBruto != null ? alvoBruto / (venda * p) * 100 : null,
      pctNecessario: alvoBruto != null && venda ? (base === 'venda' ? alvoBruto / venda * 100 : (m > 0 ? alvoBruto / (venda * m) * 100 : null)) : null,
      // percentual equivalente na outra base (mesmo valor de comissão)
      equivalente: pct == null || margem == null || margem === 0 ? null : (base === 'lucro' ? pct * margem / 100 : pct / margem * 100)
    };
    r.margemImpossivel = r.margemNecessaria != null && r.margemNecessaria > 100;
    return r;
  }

  // tabelas de cenários: linhas = % de comissão; colunas = sobre a venda + sobre o lucro em cada margem
  function cenarios(o, pcts, margens) {
    pcts = (pcts && pcts.length ? pcts : PCTS).filter(function (x) { return x > 0; });
    margens = (margens && margens.length ? margens : MARGENS).filter(function (x) { return x > 0; });
    const colunas = [{ base: 'venda', margem: null }].concat(margens.map(function (mg) { return { base: 'lucro', margem: mg }; }));
    const linhas = pcts.map(function (pc) {
      return { pct: pc, celulas: colunas.map(function (c) { const r = calcular(Object.assign({}, o, { base: c.base, pct: pc, margem: c.base === 'lucro' ? c.margem : o.margem })); return { comissao: r.comissaoLiquida, vendaNecessaria: r.vendaNecessaria, vendaPorContrato: r.vendaPorContrato, atingiu: r.atingiu }; }) };
    });
    // margem líquida necessária para cada % sobre o lucro, com a venda informada
    const margensNec = pcts.map(function (pc) { const r = calcular(Object.assign({}, o, { base: 'lucro', pct: pc })); return { pct: pc, margem: r.margemNecessaria, impossivel: r.margemImpossivel }; });
    return { colunas: colunas, linhas: linhas, margensNecessarias: margensNec };
  }

  function lerLista(txt) { return String(txt || '').split(/[\s;]+/).map(function (s) { return Number(s.replace(/\./g, '').replace(',', '.').replace('%', '')); }).filter(function (x) { return isFinite(x) && x > 0; }).slice(0, 16); }

  return { calcular: calcular, cenarios: cenarios, margemDosCustos: margemDosCustos, lerLista: lerLista, PCTS: PCTS, MARGENS: MARGENS, div: div };
});
