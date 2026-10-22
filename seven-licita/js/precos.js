/* Plataforma 7 — fórmulas de precificação (produto e serviço). Sem DOM. */
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

  // ---------- planilha de vários itens (mesma proposta) ----------
  // pj = { params: {…PADRÃO do produto, freteEntregaTotal, rateioFrete: 'valor'|'quantidade', casas, margemMinima, engenharia},
  //        itens: [{ id, numero, lote, descricao, unidade, quantidade, custo, freteCompra, embalagem, outrosDiretos, referencia,
  //                  modo: 'margem'|'preco'|'desconto', alvo, individual: bool, params: {…sobrescritas} }] }
  // Itens no modo global usam os parâmetros da planilha; os "individuais" sobrescrevem só o que tiverem.
  const CAMPOS_GLOBAIS = ['impostos', 'comissao', 'taxaBpo', 'despesasFixas', 'prazoPagamento', 'taxaMes', 'custoFinanceiro', 'garantia', 'outrosPct', 'difal', 'margem'];
  function arredCima(v, casas) { const f = Math.pow(10, casas); return Math.ceil(v * f - 1e-7) / f; }
  function arred(v, casas) { const f = Math.pow(10, casas); return Math.round(v * f) / f; }

  function rateioFrete(pj) {
    const total = n(pj.params && pj.params.freteEntregaTotal); const itens = (pj.itens || []).filter(function (i) { return n(i.quantidade) > 0; });
    const out = {}; if (!total || !itens.length) return out;
    const porQtd = (pj.params.rateioFrete || 'valor') === 'quantidade';
    const pesos = itens.map(function (i) { return porQtd ? n(i.quantidade) : n(i.custo) * n(i.quantidade); });
    const soma = pesos.reduce(function (a, b) { return a + b; }, 0);
    itens.forEach(function (i, k) { out[i.id] = soma > 0 ? total * pesos[k] / soma : total / itens.length; });
    return out;
  }

  function planilha(pj) {
    const g = Object.assign({ casas: 2, margemMinima: 0, rateioFrete: 'valor' }, pj.params || {});
    const casas = Math.max(0, Math.min(4, Math.round(n(g.casas))));
    const frete = rateioFrete(pj);
    const itens = (pj.itens || []).map(function (it) {
      const prm = {}; CAMPOS_GLOBAIS.forEach(function (k) { prm[k] = g[k]; });
      if (it.individual && it.params) Object.keys(it.params).forEach(function (k) { if (it.params[k] !== '' && it.params[k] != null) prm[k] = it.params[k]; });
      const q = n(it.quantidade);
      const r = produto(Object.assign(prm, { custo: it.custo, freteCompra: it.freteCompra, embalagem: it.embalagem, outrosDiretos: it.outrosDiretos, quantidade: q || 1, freteEntregaTotal: frete[it.id] || 0, referencia: it.referencia }));
      const x = { id: it.id, numero: it.numero, lote: it.lote || '', descricao: it.descricao || '', unidade: it.unidade || '', quantidade: q, referencia: n(it.referencia) || null, modo: it.modo || 'margem', individual: !!it.individual, alertas: [], ok: false };
      if (!n(it.custo)) { x.alertas.push({ nivel: 'info', t: 'Informe o custo de compra' }); return x; }
      if (!r.valido) { x.alertas.push({ nivel: 'erro', t: 'Percentuais sobre o preço somam 100% ou mais' }); return x; }
      let bruto = r.preco;
      if (x.modo === 'preco' && n(it.alvo) > 0) bruto = n(it.alvo);
      if (x.modo === 'desconto' && x.referencia) bruto = x.referencia * (1 - n(it.alvo) / 100);
      if (x.modo === 'desconto' && !x.referencia) x.alertas.push({ nivel: 'aviso', t: 'Informe a referência para precificar por desconto (usando a margem)' });
      const unit = x.modo === 'preco' ? arred(bruto, casas) : arredCima(bruto, casas);
      const minimo = arredCima(r.precoMinimo, casas);
      const margemFinal = margemEm(r, unit);
      Object.assign(x, { ok: true, custoDireto: r.custoDireto, freteRateado: r.diretos.freteEntrega, sugerido: r.preco, unitario: unit, total: arred(unit * q, 2), minimo: minimo, totalMinimo: arred(minimo * q, 2), margem: margemFinal, lucroUnit: unit * margemFinal / 100, lucroTotal: unit * margemFinal / 100 * q, custoTotal: r.custoDireto * q, markup: unit / (r.custoDireto || 1), desconto: x.referencia ? 1 - unit / x.referencia : null, somaPercentuais: r.somaSemMargem });
      if (margemFinal < -1e-9) x.alertas.push({ nivel: 'erro', t: 'Abaixo do custo: prejuízo de ' + (-margemFinal).toFixed(2).replace('.', ',') + '%' });
      else if (n(g.margemMinima) && margemFinal + 1e-9 < n(g.margemMinima)) x.alertas.push({ nivel: 'aviso', t: 'Margem abaixo da mínima definida (' + String(n(g.margemMinima)).replace('.', ',') + '%)' });
      if (x.referencia) {
        if (minimo > x.referencia + 1e-9) x.alertas.push({ nivel: 'erro', t: 'Nem com margem zero cabe na referência' });
        else if (unit > x.referencia + 1e-9) x.alertas.push({ nivel: 'erro', t: 'Acima do valor de referência: risco de desclassificação (art. 59, III, da Lei 14.133/2021)' });
        const limiteInex = g.engenharia ? 0.75 : 0.5;
        if (unit < x.referencia * limiteInex) x.alertas.push({ nivel: 'aviso', t: g.engenharia ? 'Abaixo de 75% do orçado: presunção de inexequibilidade em obras e serviços de engenharia (art. 59, § 4º)' : 'Abaixo de 50% do orçado: indício de inexequibilidade (IN SEGES 73/2022, art. 34); tenha a planilha de custos pronta' });
      }
      return x;
    });
    const validos = itens.filter(function (i) { return i.ok; });
    const soma = function (k, l) { return (l || validos).reduce(function (s, i) { return s + (Number(i[k]) || 0); }, 0); };
    const lotesM = {}; itens.forEach(function (i) { const k = i.lote || ''; (lotesM[k] = lotesM[k] || []).push(i); });
    const lotes = Object.keys(lotesM).map(function (k) { const l = lotesM[k].filter(function (i) { return i.ok; }); const ref = lotesM[k].reduce(function (s, i) { return s + (i.referencia || 0) * i.quantidade; }, 0); return { lote: k, itens: lotesM[k].length, total: soma('total', l), minimo: soma('totalMinimo', l), referencia: ref, lucro: soma('lucroTotal', l), completos: l.length === lotesM[k].length }; });
    const total = soma('total'), custo = soma('custoTotal'), lucro = soma('lucroTotal');
    const referencia = itens.reduce(function (s, i) { return s + (i.referencia || 0) * i.quantidade; }, 0);
    return { itens: itens, lotes: lotes, casas: casas, totais: { itens: itens.length, precificados: validos.length, custo: custo, total: total, minimo: soma('totalMinimo'), lucro: lucro, margem: total ? lucro / total * 100 : null, referencia: referencia, desconto: referencia && validos.length === itens.length ? 1 - total / referencia : null, frete: n(g.freteEntregaTotal) }, alertas: itens.reduce(function (s, i) { return s + i.alertas.filter(function (a) { return a.nivel !== 'info'; }).length; }, 0) };
  }

  // Valor por extenso em reais (até centenas de bilhões).
  function extenso(valor) {
    const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
    function ate999(x) {
      if (x === 0) return ''; if (x === 100) return 'cem';
      const c = Math.floor(x / 100), r = x % 100, d = Math.floor(r / 10), u = r % 10; const p = [];
      if (c) p.push(C[c]);
      if (r) { if (r < 20) p.push(U[r]); else p.push(D[d] + (u ? ' e ' + U[u] : '')); }
      return p.join(' e ');
    }
    const v = Math.round(Math.abs(n(valor)) * 100); let inteiro = Math.floor(v / 100); const cent = v % 100;
    const escalas = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões']];
    const grupos = []; while (inteiro > 0) { grupos.push(inteiro % 1000); inteiro = Math.floor(inteiro / 1000); }
    const partes = [];
    for (let i = grupos.length - 1; i >= 0; i--) {
      const gv = grupos[i]; if (!gv) continue;
      let t = i === 1 && gv === 1 ? 'mil' : ate999(gv) + (i ? ' ' + escalas[i][gv === 1 ? 0 : 1] : '');
      partes.push({ t: t, g: gv, i: i });
    }
    let reais = '';
    partes.forEach(function (p, k) {
      if (k === 0) { reais = p.t; return; }
      reais += (p.g < 100 || p.g % 100 === 0 ? ' e ' : ' ') + p.t;
    });
    const total = Math.floor(v / 100);
    const grandes = total >= 1e6 && total % 1e6 === 0;
    let out = reais ? reais + (grandes ? ' de' : '') + (total === 1 ? ' real' : ' reais') : '';
    if (cent) out += (out ? ' e ' : '') + ate999(cent) + (cent === 1 ? ' centavo' : ' centavos');
    return out || 'zero real';
  }

  return { planilha: planilha, rateioFrete: rateioFrete, extenso: extenso, CAMPOS_GLOBAIS: CAMPOS_GLOBAIS, REGIMES: REGIMES, custoFinanceiro: custoFinanceiro, produto: produto, margemEm: margemEm, tabelaLances: tabelaLances, bdi: bdi, servico: servico, equilibrio: equilibrio };
});
