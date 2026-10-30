/* Seven Comissão: comissão sobre o preço de venda ou sobre o lucro líquido.
   Responde: quanto recebo, quanto preciso vender em licitação para chegar ao alvo, que margem líquida preciso
   e que percentual preciso, em todos os cenários. Percentuais entram em pontos (5 = 5%). Puro: roda no navegador e no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./calc.js')); else raiz.Comissao = fabrica(raiz.Calc);
})(typeof self !== 'undefined' ? self : this, function (Calc) {
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

  // ---------- faixas: o percentual muda conforme o valor (sobre o total ou progressivo, como no IR) ----------
  function lerFaixas(faixas) {
    return (faixas || []).map(function (f) { return { ate: pos(f.ate), pct: num(f.pct) }; }).filter(function (f) { return f.pct != null && f.pct >= 0; })
      .sort(function (a, b) { return (a.ate == null ? Infinity : a.ate) - (b.ate == null ? Infinity : b.ate); });
  }
  function comissaoFaixas(valor, faixas, modo) {
    const fx = lerFaixas(faixas); if (!fx.length || !(valor > 0)) return 0;
    if (modo === 'progressiva') { let ant = 0, t = 0; fx.forEach(function (f) { const lim = f.ate == null ? Infinity : f.ate; if (valor > ant) t += (Math.min(valor, lim) - ant) * f.pct / 100; ant = lim; }); return t; }
    const f = fx.find(function (x) { return x.ate == null || valor <= x.ate; }) || fx[fx.length - 1]; return valor * f.pct / 100;
  }
  function faixaDe(valor, faixas) { const fx = lerFaixas(faixas); return fx.find(function (x) { return x.ate == null || valor <= x.ate; }) || fx[fx.length - 1] || null; }
  // menor x em [0, max] com f(x) >= alvo (f não decrescente); null se nem o máximo alcança
  function resolver(f, alvo, max) { if (f(max) < alvo - 1e-9) return null; let a = 0, b = max; for (let i = 0; i < 300 && b - a > 1e-10 * Math.max(1, b); i++) { const mm = (a + b) / 2; if (f(mm) >= alvo - 1e-9) b = mm; else a = mm; } return b; }

  // o: { base: 'venda'|'lucro', pct, venda, margem, alvo, retencao, contratos, faixas, faixaModo, fixo, parceiros: [{ nome, pct }] }
  function calcular(o) {
    o = o || {};
    const base = o.base === 'lucro' ? 'lucro' : 'venda';
    const pct = pos(o.pct), venda = pos(o.venda), margem = num(o.margem), alvo = pos(o.alvo);
    const ret = Math.min(99.99, Math.max(0, num(o.retencao) || 0)); const fl = 1 - ret / 100; // o que sobra da comissão depois de impostos/retenções
    const parceiros = (o.parceiros || []).map(function (x) { return { nome: String(x.nome || 'Parceiro'), pct: Math.max(0, num(x.pct) || 0) }; }).filter(function (x) { return x.pct > 0; });
    const parc = Math.min(99.99, parceiros.reduce(function (a, x) { return a + x.pct; }, 0)); const fp = 1 - parc / 100; // parte que fica com você
    const k = fp * fl; const fixo = Math.max(0, num(o.fixo) || 0);
    const usaFaixas = lerFaixas(o.faixas).length > 0; const modoF = o.faixaModo === 'progressiva' ? 'progressiva' : 'total';
    const contratos = Math.max(1, Math.round(num(o.contratos) || 1));
    const m = margem != null ? margem / 100 : null; const p = pct != null ? pct / 100 : null;
    const lucro = venda != null && m != null ? venda * m : null;
    const baseDe = function (v, mg) { return base === 'venda' ? v : (mg != null ? v * Math.max(0, mg) : null); }; // sem lucro, sem comissão
    const brutaDe = function (v, mg) { const b = baseDe(v, mg === undefined ? m : mg); if (b == null) return null; return usaFaixas ? comissaoFaixas(b, o.faixas, modoF) : (p != null ? b * p : null); };
    const valorBase = venda != null ? baseDe(venda, m) : null;
    const bruta = venda != null ? brutaDe(venda) : null;
    const repasse = bruta != null ? bruta * (1 - fp) : null;
    const liquida = bruta != null ? bruta * k : null;
    const alvoVar = alvo != null ? Math.max(0, alvo - fixo) : null; // o fixo já cobre parte da meta
    const alvoBruto = alvoVar != null ? alvoVar / k : null; // comissão bruta necessária para receber o alvo líquido
    let vendaNec = null;
    if (alvoBruto != null) {
      if (alvoBruto === 0) vendaNec = 0;
      else if (!usaFaixas) { const fat = brutaDe(1); vendaNec = fat && fat > 0 ? alvoBruto / fat : null; }
      else { const x = resolver(function (v) { return brutaDe(v) || 0; }, alvoBruto, 1e13); vendaNec = x == null ? null : Math.round(x * 100) / 100; }
    }
    let margemNec = null;
    if (base === 'lucro' && venda && alvoBruto != null) {
      if (!usaFaixas) margemNec = p ? alvoBruto / (venda * p) * 100 : null;
      else { const x = resolver(function (mg) { return brutaDe(venda, mg) || 0; }, alvoBruto, 1000); margemNec = x == null ? Infinity : x * 100; }
    }
    const pctEfetivo = bruta != null && valorBase ? bruta / valorBase * 100 : pct;
    const r = {
      base: base, pct: pct, venda: venda, margem: margem, alvo: alvo, retencao: ret, contratos: contratos,
      lucro: lucro, prejuizo: lucro != null && lucro <= 0, faixas: usaFaixas, faixaModo: modoF, faixaAplicada: usaFaixas && valorBase != null && modoF === 'total' ? faixaDe(valorBase, o.faixas) : null, pctEfetivo: pctEfetivo,
      comissaoBruta: bruta, comissaoLiquida: liquida, repasse: repasse, retida: bruta != null ? (bruta - repasse) * (1 - fl) : null,
      porParceiro: parceiros.map(function (x) { return { nome: x.nome, pct: x.pct, valor: bruta != null ? bruta * x.pct / 100 : null }; }),
      fixo: fixo, totalMes: liquida != null ? liquida + fixo : (fixo || null),
      comissaoSobreVenda: venda != null && p != null ? venda * p * k : null,
      comissaoSobreLucro: lucro != null && p != null ? Math.max(0, lucro) * p * k : null,
      alvoBruto: alvoBruto, alvoVariavel: alvoVar,
      atingiu: liquida != null && alvo != null ? liquida + fixo >= alvo - 0.005 : null,
      falta: liquida != null && alvo != null ? Math.max(0, alvo - liquida - fixo) : null,
      vendaNecessaria: vendaNec, vendaPorContrato: vendaNec != null ? vendaNec / contratos : null,
      margemNecessaria: margemNec,
      pctNecessario: usaFaixas ? null : (alvoBruto != null && venda ? (base === 'venda' ? alvoBruto / venda * 100 : (m > 0 ? alvoBruto / (venda * m) * 100 : null)) : null),
      // percentual equivalente na outra base (mesmo valor de comissão)
      equivalente: pctEfetivo == null || margem == null || margem === 0 ? null : (base === 'lucro' ? pctEfetivo * margem / 100 : pctEfetivo / margem * 100)
    };
    r.margemImpossivel = r.margemNecessaria != null && r.margemNecessaria > 100;
    return r;
  }
  // passo a passo da conta, em frases (o mesmo cálculo de calcular, explicado). fmt: { moeda(v), pct(v) }
  function passos(r, fmt) {
    const M = fmt.moeda, P = fmt.pct; const out = [];
    if (r.venda != null && r.pct != null || r.venda != null && r.faixas) {
      if (r.base === 'lucro') {
        if (r.margem == null) out.push({ t: 'Falta a margem de lucro líquido (%) ou o lucro líquido (R$) para calcular sobre o lucro.', alerta: true });
        else {
          out.push({ t: 'Lucro líquido = venda × margem', c: M(r.venda) + ' × ' + P(r.margem) + ' = ' + M(r.lucro) });
          if (r.prejuizo) out.push({ t: 'Sem lucro, a comissão sobre o lucro é zero.', alerta: true });
          else out.push({ t: 'Comissão bruta = lucro × comissão', c: M(Math.max(0, r.lucro)) + ' × ' + (r.faixas ? 'faixas (efetivo ' + P(r.pctEfetivo) + ')' : P(r.pct)) + ' = ' + M(r.comissaoBruta) });
        }
      } else out.push({ t: 'Comissão bruta = venda × comissão', c: M(r.venda) + ' × ' + (r.faixas ? 'faixas (efetivo ' + P(r.pctEfetivo) + ')' : P(r.pct)) + ' = ' + M(r.comissaoBruta) });
      if (r.comissaoBruta != null) {
        if (r.repasse) out.push({ t: 'Menos o repasse aos parceiros', c: '− ' + M(r.repasse) });
        if (r.retida) out.push({ t: 'Menos a retenção de ' + P(r.retencao) + ' (impostos sobre o que você recebe)', c: '− ' + M(r.retida) });
        out.push({ t: 'Você recebe', c: M(r.comissaoLiquida), total: true });
        if (r.fixo) out.push({ t: 'Com o fixo mensal de ' + M(r.fixo), c: M(r.totalMes), total: true });
      }
    }
    if (r.alvo != null) {
      const k = r.alvoBruto && r.alvoVariavel ? r.alvoVariavel / r.alvoBruto : 1;
      out.push({ t: 'Meta: receber ' + M(r.alvo) + (r.fixo ? ' (o fixo de ' + M(r.fixo) + ' já cobre parte: faltam ' + M(r.alvoVariavel) + ')' : ''), meta: true });
      if (k < 0.99999) out.push({ t: 'Comissão bruta necessária = meta ÷ o que fica com você (' + P(k * 100) + ')', c: M(r.alvoVariavel) + ' ÷ ' + P(k * 100) + ' = ' + M(r.alvoBruto) });
      if (r.base === 'lucro' && !r.faixas && r.pct) {
        const lucroNec = r.alvoBruto / (r.pct / 100);
        out.push({ t: 'Lucro líquido necessário = comissão bruta ÷ comissão', c: M(r.alvoBruto) + ' ÷ ' + P(r.pct) + ' = ' + M(lucroNec) });
        if (r.margem > 0) out.push({ t: 'Quanto vender = lucro necessário ÷ margem', c: M(lucroNec) + ' ÷ ' + P(r.margem) + ' = ' + M(r.vendaNecessaria), total: true });
        if (r.venda && r.margemNecessaria != null) out.push({ t: 'Ou, mantendo a venda de ' + M(r.venda) + ', a margem precisa ser lucro necessário ÷ venda', c: M(lucroNec) + ' ÷ ' + M(r.venda) + ' = ' + P(r.margemNecessaria) + (r.margemImpossivel ? ' (inviável: acima de 100%)' : ''), total: true });
      } else if (r.base === 'venda' && !r.faixas && r.pct) out.push({ t: 'Quanto vender = comissão necessária ÷ % de comissão', c: M(r.alvoBruto) + ' ÷ ' + P(r.pct) + ' = ' + M(r.vendaNecessaria), total: true });
      else if (r.vendaNecessaria != null) out.push({ t: 'Quanto vender (pelas faixas)', c: M(r.vendaNecessaria), total: true });
      if (r.contratos > 1 && r.vendaPorContrato != null) out.push({ t: 'Dividida em ' + r.contratos + ' licitações', c: M(r.vendaPorContrato) + ' cada' });
    }
    return out;
  }

  // comissão de um contrato já ganho (performance e extrato): cfg igual ao de calcular, sem metas
  function valorComissao(valor, cfg) {
    const r = calcular(Object.assign({}, cfg, { venda: valor, alvo: null, fixo: 0 }));
    return { bruta: r.comissaoBruta || 0, repasse: r.repasse || 0, retida: r.retida || 0, liquida: r.comissaoLiquida || 0, porParceiro: r.porParceiro };
  }

  // tabelas de cenários: linhas = % de comissão; colunas = sobre a venda + sobre o lucro em cada margem
  function cenarios(o, pcts, margens) {
    pcts = (pcts && pcts.length ? pcts : PCTS).filter(function (x) { return x > 0; });
    margens = (margens && margens.length ? margens : MARGENS).filter(function (x) { return x > 0; });
    const colunas = [{ base: 'venda', margem: null }].concat(margens.map(function (mg) { return { base: 'lucro', margem: mg }; }));
    const linhas = pcts.map(function (pc) {
      return { pct: pc, celulas: colunas.map(function (c) { const r = calcular(Object.assign({}, o, { faixas: null, base: c.base, pct: pc, margem: c.base === 'lucro' ? c.margem : o.margem })); return { comissao: r.comissaoLiquida, vendaNecessaria: r.vendaNecessaria, vendaPorContrato: r.vendaPorContrato, atingiu: r.atingiu }; }) };
    });
    // margem líquida necessária para cada % sobre o lucro, com a venda informada
    const margensNec = pcts.map(function (pc) { const r = calcular(Object.assign({}, o, { faixas: null, base: 'lucro', pct: pc })); return { pct: pc, margem: r.margemNecessaria, impossivel: r.margemImpossivel }; });
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
  // tipo de cada etapa: 'corridos' ou 'uteis' (sem sábados, domingos e feriados nacionais; feriados locais em opc.extras).
  // Contagem do art. 183 da Lei 14.133: exclui o dia do começo e inclui o do vencimento; com opc.prorrogar, o vencimento
  // em dia sem expediente passa para o primeiro dia útil seguinte (§ 1º).
  function diasEntre(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
  function prazos(inicio, etapas, opc) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(inicio || ''))) return null;
    opc = opc || {}; const cal = { facultativos: !!opc.facultativos, extras: opc.extras || [] };
    const util = function (iso) { return !Calc || Calc.ehUtil(new Date(iso + 'T12:00:00'), cal); };
    let data = inicio, uteisTot = 0;
    const linhas = (etapas || ETAPAS).map(function (e) {
      const d = Math.max(0, Math.round(num(e.dias) || 0)); const tipo = e.tipo === 'uteis' && Calc ? 'uteis' : 'corridos'; const de = data;
      data = tipo === 'uteis' ? Calc.somar(data, d, true, cal) : somarDias(data, d);
      let prorrogado = false;
      if (tipo === 'corridos' && d > 0 && opc.prorrogar && Calc && !util(data)) { data = Calc.somar(data, 1, true, cal); prorrogado = true; }
      if (tipo === 'uteis') uteisTot += d;
      return { id: e.id, nome: e.nome, dias: d, tipo: tipo, corridosEtapa: diasEntre(de, data), acumulado: diasEntre(inicio, data), data: data, prorrogado: prorrogado };
    });
    const pg = linhas.find(function (l) { return l.id === 'pagamento'; });
    return { inicio: inicio, etapas: linhas, totalDias: diasEntre(inicio, data), dataFinal: data, diasAtePagamento: pg ? pg.acumulado : null, dataPagamento: pg ? pg.data : null, diasUteis: uteisTot };
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
    if (!q || !d || (cv <= 0 && !(num(o.fixoMes) > 0))) return null;
    const atraso = Math.max(0, Math.ceil((num(o.diasRecebimento) || 0) / 30)); const meses = Math.min(120, Math.max(6, Math.round(num(o.meses) || 36)));
    const custoMes = (num(o.custoFixo) || 0) + d * (num(o.custoDisputa) || 0); const fixoMes = Math.max(0, num(o.fixoMes) || 0); // mensalidade recebida desde o 1º mês
    let acum = 0, mesRetorno = null, menor = 0, mesMenor = 0; const linhas = [];
    for (let m = 1; m <= meses; m++) {
      const vit = d * q; const receita = (m > atraso ? vit * cv : 0) + fixoMes; acum += receita - custoMes;
      if (acum < menor) { menor = acum; mesMenor = m; }
      if (mesRetorno == null && acum >= 0 && (m > atraso || fixoMes > 0)) mesRetorno = m;
      linhas.push({ mes: m, disputas: d, vitorias: vit, receita: receita, custo: custoMes, saldo: receita - custoMes, acumulado: acum });
    }
    const lucroMes = d * q * cv + fixoMes - custoMes;
    return {
      linhas: linhas, custoMes: custoMes, receitaMes: d * q * cv + fixoMes, fixoMes: fixoMes, lucroMes: lucroMes, atrasoMeses: atraso,
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

  return { calcular: calcular, passos: passos, valorComissao: valorComissao, comissaoFaixas: comissaoFaixas, lerFaixas: lerFaixas, cenarios: cenarios, prazos: prazos, chances: chances, funil: funil, FUNIL: FUNIL, retorno: retorno, ETAPAS: ETAPAS, somarDias: somarDias, margemDosCustos: margemDosCustos, lerLista: lerLista, PCTS: PCTS, MARGENS: MARGENS, div: div };
});
