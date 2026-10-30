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

  // ---------- Simples Nacional: alíquota efetiva pelo anexo e pela receita bruta dos últimos 12 meses (LC 123/2006, anexos vigentes) ----------
  // faixa: [receita até, alíquota nominal %, parcela a deduzir R$]
  const SIMPLES = {
    I: { t: 'Anexo I · Comércio', f: [[180000, 4, 0], [360000, 7.3, 5940], [720000, 9.5, 13860], [1800000, 10.7, 22500], [3600000, 14.3, 87300], [4800000, 19, 378000]] },
    II: { t: 'Anexo II · Indústria', f: [[180000, 4.5, 0], [360000, 7.8, 5940], [720000, 10, 13860], [1800000, 11.2, 22500], [3600000, 14.7, 85500], [4800000, 30, 720000]] },
    III: { t: 'Anexo III · Serviços (com fator R ≥ 28%)', f: [[180000, 6, 0], [360000, 11.2, 9360], [720000, 13.5, 17640], [1800000, 16, 35640], [3600000, 21, 125640], [4800000, 33, 648000]] },
    IV: { t: 'Anexo IV · Serviços (limpeza, vigilância, obras)', f: [[180000, 4.5, 0], [360000, 9, 8100], [720000, 10.2, 12420], [1800000, 14, 39780], [3600000, 22, 183780], [4800000, 33, 828000]] },
    V: { t: 'Anexo V · Serviços (fator R < 28%)', f: [[180000, 15.5, 0], [360000, 18, 4500], [720000, 19.5, 9900], [1800000, 20.5, 17100], [3600000, 23, 62100], [4800000, 30.5, 540000]] }
  };
  function simplesEfetiva(anexo, rbt12) {
    const a = SIMPLES[anexo] || SIMPLES.I; const rb = n(rbt12);
    if (!(rb > 0)) return { aliquota: a.f[0][1], faixa: 1, nominal: a.f[0][1], deducao: 0, anexo: anexo, acimaLimite: false, acimaSublimite: false };
    let i = a.f.findIndex(function (x) { return rb <= x[0]; }); const acima = i < 0; if (acima) i = a.f.length - 1;
    const x = a.f[i]; const ef = i === 0 ? x[1] : (rb * x[1] / 100 - x[2]) / rb * 100;
    return { aliquota: Math.round(ef * 10000) / 10000, faixa: i + 1, nominal: x[1], deducao: x[2], anexo: anexo, acimaLimite: acima, acimaSublimite: rb > 3600000 };
  }

  // ---------- reforma tributária (EC 132/2023, LC 214/2025): transição estimada ----------
  // CBS e IBS por ano em % do preço (alíquotas de referência ESTIMADAS: confirme as fixadas pelo Senado/TCU),
  // fração do ICMS/ISS que ainda vale e se PIS/COFINS ainda existem. Em 2026 CBS 0,9% e IBS 0,1% são teste (compensáveis).
  const REFORMA = {
    2026: { cbs: 0.9, ibs: 0.1, icms: 1, pisCofins: 1, teste: true }, 2027: { cbs: 8.8, ibs: 0.1, icms: 1, pisCofins: 0 }, 2028: { cbs: 8.8, ibs: 0.1, icms: 1, pisCofins: 0 },
    2029: { cbs: 8.8, ibs: 1.77, icms: 0.9, pisCofins: 0 }, 2030: { cbs: 8.8, ibs: 3.54, icms: 0.8, pisCofins: 0 }, 2031: { cbs: 8.8, ibs: 5.31, icms: 0.7, pisCofins: 0 },
    2032: { cbs: 8.8, ibs: 7.08, icms: 0.6, pisCofins: 0 }, 2033: { cbs: 8.8, ibs: 17.7, icms: 0, pisCofins: 0 }
  };

  // Custo financeiro de receber em `dias` com taxa mensal `taxaMes` (%), como % do preço.
  function custoFinanceiro(dias, taxaMes) { if (!n(dias) || !n(taxaMes)) return 0; return (Math.pow(1 + pct(taxaMes), n(dias) / 30) - 1) * 100; }

  // Produto: preço = custo direto ÷ (1 − soma dos percentuais sobre o preço).
  function produto(p) {
    const q = Math.max(1, n(p.quantidade) || 1);
    // reajuste esperado do custo até a compra (ata de registro de preços vale 12 meses sem reajuste)
    const reaj = n(p.inflacaoAno) && n(p.mesesCompra) ? n(p.custo) * (Math.pow(1 + pct(p.inflacaoAno), n(p.mesesCompra) / 12) - 1) : 0;
    const diretos = {
      compra: n(p.custo), freteCompra: n(p.freteCompra), embalagem: n(p.embalagem), outros: n(p.outrosDiretos),
      freteEntrega: n(p.freteEntregaTotal) / q, difal: n(p.custo) * pct(p.difal),
      st: n(p.icmsST), participacao: n(p.custosParticipacao) / q, reajuste: reaj, creditoIcms: -n(p.custo) * pct(p.icmsCredito)
    };
    const custoDireto = Object.keys(diretos).reduce(function (s, k) { return s + diretos[k]; }, 0);
    const fin = p.custoFinanceiro != null && p.custoFinanceiro !== '' ? n(p.custoFinanceiro) : custoFinanceiro(n(p.prazoPagamento) + n(p.atrasoOrgao), p.taxaMes);
    // comissão e taxa da Seven podem ser % do preço ou % do lucro líquido (antes delas)
    const comLucro = p.comissaoBase === 'lucro', bpoLucro = p.bpoBase === 'lucro';
    const partLucro = Math.min(0.99, (comLucro ? pct(p.comissao) : 0) + (bpoLucro ? pct(p.taxaBpo) : 0)); // fração do lucro que vai para elas
    const sobrePreco = { impostos: n(p.impostos), icms: n(p.icmsVenda), comissao: comLucro ? 0 : n(p.comissao), financeiro: fin, bpo: bpoLucro ? 0 : n(p.taxaBpo), fixas: n(p.despesasFixas), garantia: n(p.garantia), outrosPct: n(p.outrosPct) };
    const somaSemMargem = Object.keys(sobrePreco).reduce(function (s, k) { return s + sobrePreco[k]; }, 0);
    const margem = n(p.margem); // margem que fica para a empresa, depois de tudo
    const margemAntes = partLucro ? margem / (1 - partLucro) : margem; // lucro antes das comissões sobre o lucro
    const den = 1 - (somaSemMargem + margemAntes) / 100; const denMin = 1 - somaSemMargem / 100;
    const r = { quantidade: q, diretos: diretos, custoDireto: custoDireto, sobrePreco: sobrePreco, somaSemMargem: somaSemMargem, margem: margem, margemAntes: margemAntes, partLucro: partLucro, comissaoBase: comLucro ? 'lucro' : 'preco', bpoBase: bpoLucro ? 'lucro' : 'preco', valido: den > 0 && denMin > 0 };
    if (!r.valido) return r;
    r.preco = custoDireto / den; r.markup = r.preco / (custoDireto || 1); r.precoMinimo = custoDireto / denMin;
    r.valores = {}; Object.keys(sobrePreco).forEach(function (k) { r.valores[k] = r.preco * sobrePreco[k] / 100; });
    r.lucroAntes = r.preco * margemAntes / 100;
    if (comLucro) { r.valores.comissao = r.lucroAntes * pct(p.comissao); r.sobrePreco.comissao = margemAntes * pct(p.comissao); }
    if (bpoLucro) { r.valores.bpo = r.lucroAntes * pct(p.taxaBpo); r.sobrePreco.bpo = margemAntes * pct(p.taxaBpo); }
    r.lucro = r.preco * margem / 100; r.margemContribuicao = r.preco - custoDireto - r.preco * (n(p.impostos) + n(p.icmsVenda) + fin + n(p.garantia) + n(p.outrosPct)) / 100 - r.valores.comissao - r.valores.bpo;
    r.total = r.preco * q; r.lucroTotal = r.lucro * q; r.totalMinimo = r.precoMinimo * q;
    if (n(p.referencia)) { r.referencia = n(p.referencia); r.descontoSobreRef = 1 - r.preco / r.referencia; r.margemNaReferencia = margemEm(r, r.referencia); r.cabe = r.precoMinimo <= r.referencia; }
    return r;
  }

  // ---------- cenários e comparações ----------
  // SRP: o órgão pode comprar só parte da ata. Frete e custos de participação (totais) se dividem por menos unidades.
  function cenariosVolume(p, fracoes) {
    const base = produto(p); const q = Math.max(1, n(p.quantidade) || 1);
    return (fracoes || [0.3, 0.6, 1]).map(function (f) {
      const qq = Math.max(1, Math.round(q * f)); const r = produto(Object.assign({}, p, { quantidade: qq }));
      const mNoPreco = base.valido && r.valido ? (function () { const x = Object.assign({}, r, { custoDireto: r.custoDireto }); return margemEm(x, base.preco); })() : null;
      return { fracao: f, quantidade: qq, preco: r.valido ? r.preco : null, minimo: r.valido ? r.precoMinimo : null, margemNoPrecoCheio: mNoPreco, lucroTotal: mNoPreco != null ? base.preco * mNoPreco / 100 * qq : null };
    });
  }
  // Mesmo item nos três regimes, com a mesma margem final. o: { anexo, rbt12, irpjCsllReal (34) }
  function compararRegimes(p, o) {
    o = o || {}; const sim = simplesEfetiva(o.anexo || 'I', o.rbt12);
    const pisCofinsReal = 9.25; const credPisCofins = n(p.custo) * pisCofinsReal / 100;
    const reg = [
      { id: 'simples', nome: 'Simples Nacional', imp: sim.aliquota, icms: 0, credito: 0, nota: 'ICMS dentro do DAS (' + (SIMPLES[o.anexo || 'I'] || SIMPLES.I).t + ', faixa ' + sim.faixa + ')' },
      { id: 'presumido', nome: 'Lucro Presumido', imp: 5.93, icms: n(p.icmsVenda), credito: n(p.custo) * pct(p.icmsCredito), nota: 'PIS/COFINS cumulativo + IRPJ/CSLL presumidos + ICMS' },
      { id: 'real', nome: 'Lucro Real', imp: pisCofinsReal, icms: n(p.icmsVenda), credito: n(p.custo) * pct(p.icmsCredito) + credPisCofins, irSobreLucro: n(o.irpjCsllReal || 34), nota: 'PIS/COFINS não cumulativo (com crédito da compra) + ICMS; IRPJ/CSLL sobre o lucro' }
    ];
    return reg.map(function (g) {
      // o regime atual usa exatamente o que foi informado na tela, para bater com o preço calculado
      if (g.id === p.regime) { const ra = produto(p); return { id: g.id, nome: g.nome, nota: 'com os percentuais que você informou', atual: true, preco: ra.valido ? ra.preco : null, impostos: ra.valido ? ra.valores.impostos + (ra.valores.icms || 0) + (ra.diretos.creditoIcms || 0) : null, margemFinal: n(p.margem) }; }
      const margemAntesIR = g.irSobreLucro ? n(p.margem) / (1 - g.irSobreLucro / 100) : n(p.margem);
      const r = produto(Object.assign({}, p, { impostos: g.imp, icmsVenda: g.icms, icmsCredito: 0, outrosDiretos: n(p.outrosDiretos) - g.credito, margem: margemAntesIR }));
      return { id: g.id, nome: g.nome, nota: g.nota, preco: r.valido ? r.preco : null, impostos: r.valido ? r.valores.impostos + (r.valores.icms || 0) - g.credito : null, margemFinal: n(p.margem) };
    }).sort(function (a, b) { return (a.preco || Infinity) - (b.preco || Infinity); });
  }
  // Reforma tributária: preço necessário por ano, com a mesma margem. p.tributosForaIcms = parte dos impostos que não é PIS/COFINS
  // (ex.: IRPJ/CSLL presumidos 2,28%); p.pisCofins = PIS/COFINS atual (% do preço); créditos de CBS/IBS na compra se o fornecedor estiver no regime.
  function simularReforma(p, o) {
    o = o || {}; const anos = Object.keys(REFORMA).map(Number);
    return anos.map(function (ano) {
      const t = REFORMA[ano]; const teste = !!t.teste;
      const pis = n(o.pisCofins) * t.pisCofins; const icms = n(p.icmsVenda) * t.icms; const novos = teste ? 0 : t.cbs + t.ibs;
      const credNovo = o.creditoCompra === false || teste ? 0 : n(p.custo) * (t.cbs + t.ibs) / 100;
      const credIcms = n(p.custo) * pct(p.icmsCredito) * t.icms;
      const r = produto(Object.assign({}, p, { impostos: n(o.tributosForaIcms) + pis + novos, icmsVenda: icms, icmsCredito: 0, outrosDiretos: n(p.outrosDiretos) - credNovo - credIcms }));
      return { ano: ano, teste: teste, cbs: t.cbs, ibs: t.ibs, icmsFracao: t.icms, pisCofins: pis, cargaSobrePreco: n(o.tributosForaIcms) + pis + novos + icms, credito: credNovo + credIcms, preco: r.valido ? r.preco : null };
    });
  }

  // ---------- preço de mercado: preços homologados no PNCP já pesquisados (análises da Seven Preços) ----------
  function palavras(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 3 && !/^(com|para|sem|tipo|unidade|cada|das|dos|que|por)$/.test(w); }); }
  function mercado(analises, termo) {
    const alvo = palavras(termo); if (!alvo.length) return null;
    const vals = [];
    (analises || []).forEach(function (a) { (a.amostras || []).forEach(function (x) {
      const w = palavras(x.descricao); const acertos = alvo.filter(function (p) { return w.indexOf(p) >= 0; }).length;
      if (acertos / alvo.length >= 0.6 && n(x.unitario) > 0) vals.push({ unitario: n(x.unitario), referencia: n(x.referencia) || null, data: x.data, orgao: x.orgao, uf: x.uf, fornecedor: x.fornecedor, unidade: x.unidade, descricao: x.descricao });
    }); });
    if (!vals.length) return { n: 0 };
    const u = vals.map(function (v) { return v.unitario; }).sort(function (a, b) { return a - b; });
    const q = function (f) { const i = (u.length - 1) * f; const lo = Math.floor(i), hi = Math.ceil(i); return u[lo] + (u[hi] - u[lo]) * (i - lo); };
    const desc = vals.filter(function (v) { return v.referencia; }).map(function (v) { return 1 - v.unitario / v.referencia; });
    return { n: vals.length, minimo: u[0], maximo: u[u.length - 1], mediana: q(0.5), q1: q(0.25), q3: q(0.75), descontoMedio: desc.length ? desc.reduce(function (a, b) { return a + b; }, 0) / desc.length : null,
      recentes: vals.slice().sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); }).slice(0, 8), unidades: Array.from(new Set(vals.map(function (v) { return v.unidade; }).filter(Boolean))) };
  }

  // ---------- serviço com mão de obra: encargos pelos módulos da IN SEGES 05/2017 ----------
  // e: { decimo, ferias, sub22, rat, rescisao, reposicao } em %; devolve o detalhamento e o % total sobre a remuneração
  const ENCARGOS_PADRAO = { decimo: 8.33, ferias: 11.11, sub22: 33.8, rat: 2, rescisao: 5, reposicao: 1.7 };
  function encargosIN05(remuneracao, e) {
    e = Object.assign({}, ENCARGOS_PADRAO, e || {}); const m1 = n(remuneracao);
    const m21 = m1 * (n(e.decimo) + n(e.ferias)) / 100; const m22 = (m1 + m21) * (n(e.sub22) + n(e.rat)) / 100;
    const m3 = m1 * n(e.rescisao) / 100; const m4 = m1 * n(e.reposicao) / 100; const total = m21 + m22 + m3 + m4;
    return { m1: m1, m21: m21, m22: m22, m3: m3, m4: m4, total: total, pct: m1 ? total / m1 * 100 : 0, parametros: e };
  }

  // Margem líquida (%) se vender por `preco`, mantendo os demais percentuais.
  function margemEm(r, preco) { if (!preco) return null; let m = (1 - r.custoDireto / preco - r.somaSemMargem / 100) * 100; if (m > 0 && r.partLucro) m *= 1 - r.partLucro; return Math.abs(m) < 1e-9 ? 0 : m; }

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
    const detalhe = s.detalharEncargos ? encargosIN05(salario, s.encargosIN) : null;
    const encargos = detalhe ? detalhe.total : salario * pct(s.encargos);
    const posto = { remuneracao: salario, encargos: encargos, beneficios: n(s.beneficios), uniformes: n(s.uniformes), insumos: n(s.insumos), equipamentos: n(s.equipamentos), outros: n(s.outros) };
    const custoPosto = Object.keys(posto).reduce(function (t, k) { return t + posto[k]; }, 0);
    const postos = Math.max(1, n(s.postos) || 1); const meses = Math.max(1, n(s.meses) || 12);
    const custoMensal = custoPosto * postos; const taxa = bdi(s);
    const r = { posto: posto, custoPosto: custoPosto, postos: postos, meses: meses, custoMensal: custoMensal, bdi: taxa, valido: isFinite(taxa), encargosIN05: detalhe };
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
  const CAMPOS_GLOBAIS = ['impostos', 'icmsVenda', 'icmsCredito', 'comissao', 'comissaoBase', 'taxaBpo', 'bpoBase', 'atrasoOrgao', 'inflacaoAno', 'mesesCompra', 'despesasFixas', 'prazoPagamento', 'taxaMes', 'custoFinanceiro', 'garantia', 'outrosPct', 'difal', 'margem'];
  function arredCima(v, casas) { const f = Math.pow(10, casas); return Math.ceil(v * f - 1e-7) / f; }
  function arred(v, casas) { const f = Math.pow(10, casas); return Math.round(v * f) / f; }

  function rateioFrete(pj, campo) {
    const total = n(pj.params && pj.params[campo || 'freteEntregaTotal']); const itens = (pj.itens || []).filter(function (i) { return n(i.quantidade) > 0; });
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
    const frete = rateioFrete(pj); const partic = rateioFrete(pj, 'custosParticipacao');
    const itens = (pj.itens || []).map(function (it) {
      const prm = {}; CAMPOS_GLOBAIS.forEach(function (k) { prm[k] = g[k]; });
      if (it.individual && it.params) Object.keys(it.params).forEach(function (k) { if (it.params[k] !== '' && it.params[k] != null) prm[k] = it.params[k]; });
      const q = n(it.quantidade);
      const r = produto(Object.assign(prm, { custo: it.custo, freteCompra: it.freteCompra, embalagem: it.embalagem, outrosDiretos: it.outrosDiretos, quantidade: q || 1, freteEntregaTotal: frete[it.id] || 0, custosParticipacao: partic[it.id] || 0, icmsST: it.icmsST, referencia: it.referencia }));
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

  return { mercado: mercado, SIMPLES: SIMPLES, simplesEfetiva: simplesEfetiva, REFORMA: REFORMA, cenariosVolume: cenariosVolume, compararRegimes: compararRegimes, simularReforma: simularReforma, ENCARGOS_PADRAO: ENCARGOS_PADRAO, encargosIN05: encargosIN05, planilha: planilha, rateioFrete: rateioFrete, extenso: extenso, CAMPOS_GLOBAIS: CAMPOS_GLOBAIS, REGIMES: REGIMES, custoFinanceiro: custoFinanceiro, produto: produto, margemEm: margemEm, tabelaLances: tabelaLances, bdi: bdi, servico: servico, equilibrio: equilibrio };
});
