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

  // ---------- prazo para recebimento: etapas em dias corridos a partir da sessão ----------
  const ETAPAS = [
    { id: 'homologacao', nome: 'Homologação e adjudicação', dias: 15 },
    { id: 'contrato', nome: 'Assinatura do contrato / empenho', dias: 10 },
    { id: 'entrega', nome: 'Entrega ou execução', dias: 30 },
    { id: 'atesto', nome: 'Recebimento e atesto da nota fiscal', dias: 5 },
    { id: 'pagamento', nome: 'Pagamento pelo órgão', dias: 30 },
    { id: 'comissao', nome: 'Repasse da comissão', dias: 5 }
  ];
  function somarDias(iso, d) { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function prazos(inicio, etapas) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(inicio || ''))) return null;
    let total = 0; const linhas = (etapas || ETAPAS).map(function (e) { const d = Math.max(0, Math.round(num(e.dias) || 0)); total += d; return { id: e.id, nome: e.nome, dias: d, acumulado: total, data: somarDias(inicio, total) }; });
    const pg = linhas.find(function (l) { return l.id === 'pagamento'; });
    return { inicio: inicio, etapas: linhas, totalDias: total, dataFinal: somarDias(inicio, total), diasAtePagamento: pg ? pg.acumulado : null, dataPagamento: pg ? pg.data : null };
  }

  // ---------- quantas licitações disputar: taxa de sucesso p (%) ----------
  function chances(taxa, vitorias) {
    const p = pos(taxa); if (!p || p > 100) return null; const q = p / 100; const v = Math.max(1, Math.round(num(vitorias) || 1));
    const prob = function (n) { return (1 - Math.pow(1 - q, n)) * 100; };
    const paraConfianca = function (c) { return q >= 1 ? 1 : Math.ceil(Math.log(1 - c / 100) / Math.log(1 - q)); };
    return {
      taxa: p, vitorias: v,
      esperadoPrimeira: 1 / q,                  // em média, disputas até a 1ª vitória
      esperadoVitorias: v / q,                  // em média, disputas para v vitórias
      confianca: [50, 80, 90, 95].map(function (c) { return { confianca: c, disputas: paraConfianca(c) }; }),
      tabela: [1, 2, 3, 5, 10, 15, 20, 30, 50].map(function (n) { return { disputas: n, chance: prob(n), esperadas: n * q }; })
    };
  }

  // ---------- prazo de retorno: custos mensais e por disputa contra comissões recebidas com atraso ----------
  // o: { taxa, disputasMes, custoDisputa, custoFixo, comissaoPorVitoria, diasRecebimento, meses }
  function retorno(o) {
    o = o || {}; const q = (pos(o.taxa) || 0) / 100, d = Math.max(0, num(o.disputasMes) || 0), cv = num(o.comissaoPorVitoria) || 0;
    if (!q || !d || cv <= 0) return null;
    const atraso = Math.max(0, Math.ceil((num(o.diasRecebimento) || 0) / 30)); const meses = Math.min(120, Math.max(6, Math.round(num(o.meses) || 36)));
    const custoMes = (num(o.custoFixo) || 0) + d * (num(o.custoDisputa) || 0);
    let acum = 0, mesRetorno = null, menor = 0, mesMenor = 0; const linhas = [];
    for (let m = 1; m <= meses; m++) {
      const vit = d * q; const receita = m > atraso ? vit * cv : 0; acum += receita - custoMes;
      if (acum < menor) { menor = acum; mesMenor = m; }
      if (mesRetorno == null && acum >= 0 && m > atraso) mesRetorno = m;
      linhas.push({ mes: m, disputas: d, vitorias: vit, receita: receita, custo: custoMes, saldo: receita - custoMes, acumulado: acum });
    }
    const lucroMes = d * q * cv - custoMes;
    return {
      linhas: linhas, custoMes: custoMes, receitaMes: d * q * cv, lucroMes: lucroMes, atrasoMeses: atraso,
      mesPrimeiraVitoria: Math.ceil(1 / (q * d)), mesPrimeiroRecebimento: Math.ceil(1 / (q * d)) + atraso,
      mesRetorno: mesRetorno, investimentoMaximo: menor < 0 ? -menor : 0, mesInvestimentoMaximo: mesMenor, viavel: lucroMes > 0
    };
  }

  // ---------- funil das licitações: % de cada etapa que chega à seguinte (ou quantidades do histórico) ----------
  const FUNIL = [
    { id: 'encontrados', nome: 'Editais encontrados', pct: 100, qtd: 100 },
    { id: 'viaveis', nome: 'Editais viáveis (após análise)', pct: 30, qtd: 30 },
    { id: 'propostas', nome: 'Propostas cadastradas', pct: 80, qtd: 24 },
    { id: 'disputas', nome: 'Disputas (sessões realizadas)', pct: 90, qtd: 22 },
    { id: 'vencidas', nome: 'Arrematadas (1º lugar)', pct: 20, qtd: 4 },
    { id: 'homologadas', nome: 'Habilitadas e homologadas', pct: 85, qtd: 4 },
    { id: 'contratadas', nome: 'Contratos / empenhos assinados', pct: 95, qtd: 4 }
  ];
  // etapas: [{ id, nome, pct?, qtd? }]; modo 'pct' usa pct, 'qtd' calcula o % pela quantidade da etapa anterior.
  // base: quantos editais entram no topo (no modo 'qtd' é a quantidade da 1ª etapa); dá a quantidade esperada em cada etapa.
  function funil(etapas, modo, contratos, base) {
    etapas = etapas && etapas.length ? etapas : FUNIL; const qtd = modo === 'qtd';
    let topo = 1; const linhas = etapas.map(function (e, i) {
      let p;
      if (i === 0) p = 1;
      else if (qtd) { const a = num(etapas[i - 1].qtd), b = num(e.qtd); p = a > 0 && b != null ? b / a : null; }
      else p = num(e.pct) != null ? e.pct / 100 : null;
      if (p != null) p = Math.max(0, Math.min(1, p));
      topo = topo != null && p != null ? topo * p : null;
      return { id: e.id, nome: e.nome, qtd: num(e.qtd), conversao: p == null ? null : p * 100, doTopo: topo == null ? null : topo * 100 };
    });
    const iDisp = linhas.findIndex(function (l) { return l.id === 'disputas'; });
    const prod = function (de) { let x = 1; for (let i = de + 1; i < linhas.length; i++) { if (linhas[i].conversao == null) return null; x *= linhas[i].conversao / 100; } return x; };
    const taxaDisputa = iDisp >= 0 ? prod(iDisp) : null; const v = Math.max(1, Math.round(num(contratos) || 1));
    // quantas em cada etapa para fechar v contratos (de trás para frente)
    linhas.forEach(function (l, i) { const x = prod(i); l.necessarios = x ? Math.ceil(v / x - 1e-9) : null; });
    const b = qtd ? num(etapas[0].qtd) : pos(base); linhas.forEach(function (l) { l.esperados = b != null && l.doTopo != null ? b * l.doTopo / 100 : null; });
    const gargalo = linhas.slice(1).reduce(function (m, l) { return l.conversao != null && (m == null || l.conversao < m.conversao) ? l : m; }, null);
    return { etapas: linhas, taxaDisputa: taxaDisputa == null ? null : taxaDisputa * 100, taxaGeral: linhas[linhas.length - 1].doTopo, contratos: v, gargalo: gargalo, base: b };
  }

  function lerLista(txt) { return String(txt || '').split(/[\s;]+/).map(function (s) { return Number(s.replace(/\./g, '').replace(',', '.').replace('%', '')); }).filter(function (x) { return isFinite(x) && x > 0; }).slice(0, 16); }

  return { calcular: calcular, cenarios: cenarios, prazos: prazos, chances: chances, funil: funil, FUNIL: FUNIL, retorno: retorno, ETAPAS: ETAPAS, somarDias: somarDias, margemDosCustos: margemDosCustos, lerLista: lerLista, PCTS: PCTS, MARGENS: MARGENS, div: div };
});
