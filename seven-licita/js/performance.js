/* Performance do cliente a partir do Seven Processo: funil real, taxa de sucesso, valores ganhos,
   execução (empenhado, faturado, recebido) e comissão, no total e num período (relatório do mês).
   Puro: recebe o estado (Dados.e) e roda no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Performance = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const lista = function (x) { return Array.isArray(x) ? x : []; };
  const cent = function (v) { return Math.round((Number(v) || 0) * 100) / 100; };
  const soma = function (l, f) { return cent(lista(l).reduce(function (s, i) { return s + (Number(f ? f(i) : i.valor) || 0); }, 0)); };
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  // etapa do cartão pelo nome da lista (quadro de licitações e quadro de execução)
  const ETAPA_LISTA = [
    [/^oportunidade/, 0], [/analise/, 1], [/^proposta/, 2], [/^disputa/, 3], [/habilitacao|recurso/, 4], [/^contrato$|contratos vigentes|^contrato\b/, 5],
    [/empenho|entrega|faturad|aguardando pagamento|^pagamento|^pago|conclu|encerrad/, 6]
  ];
  function etapaDaLista(nome) { const n = norm(nome); for (let i = 0; i < ETAPA_LISTA.length; i++) if (ETAPA_LISTA[i][0].test(n)) return ETAPA_LISTA[i][1]; return null; }
  function quadroDeLicitacao(q) { return lista(q.listas).some(function (l) { return etapaDaLista(l.nome) != null; }); }

  function etiquetas(q, c) { const ids = lista(c.etiquetas); return lista(q.etiquetas).filter(function (t) { return ids.indexOf(t.id) >= 0; }).map(function (t) { return norm(t.nome); }); }
  function dataDe(iso) { return String(iso || '').slice(0, 10); }
  function noPeriodo(iso, de, ate) { const d = dataDe(iso); return !!d && (!de || d >= de) && (!ate || d <= ate); }

  // fator da comissão por R$ (cfg: { base, pct, margem, retencao })
  function fator(cfg) {
    cfg = cfg || {}; const p = (Number(cfg.pct) || 0) / 100; const ret = 1 - Math.min(99.99, Math.max(0, Number(cfg.retencao) || 0)) / 100;
    return (cfg.base === 'lucro' ? p * Math.max(0, (Number(cfg.margem) || 0) / 100) : p) * ret;
  }

  function lerCartao(e, q, c) {
    const lst = lista(q.listas).find(function (l) { return l.id === c.lista; }) || {};
    let etapa = etapaDaLista(lst.nome); if (etapa == null) etapa = 0;
    const tags = etiquetas(q, c); const p = lista(e.propostas).find(function (x) { return x.id === c.propostaId; });
    const ganha = tags.indexOf('ganha') >= 0 || (p && p.resultado === 'ganha') || etapa >= 5;
    const perdida = !ganha && (tags.indexOf('perdida') >= 0 || (p && (p.resultado === 'perdida' || p.resultado === 'fracassada')));
    const x = c.execucao || {}; const ex = { empenhado: soma(x.empenhos), faturado: soma(x.notas), recebido: soma(x.pagamentos) };
    // data em que foi ganha: resultado da proposta ou a primeira vez que entrou em Contrato
    let dataGanho = null, dataPerda = null;
    if (ganha) { dataGanho = p && p.resultado === 'ganha' && p.resultadoEm ? dataDe(p.resultadoEm) : null; if (!dataGanho) { const a = lista(c.atividade).slice().reverse().find(function (t) { return /para "contrato"|marcar como ganha|ganha/i.test(t.texto || ''); }); if (a) dataGanho = dataDe(a.em); } }
    if (perdida) dataPerda = p && p.resultadoEm ? dataDe(p.resultadoEm) : dataDe(c.atualizadoEm);
    const valor = cent(x.valor || (c.valores && c.valores.valor) || (p && (p.lanceFinal || 0)) || 0);
    return {
      id: c.id, quadroId: q.id, titulo: c.titulo || '', quadro: q.nome, lista: lst.nome || '', etapa: perdida ? Math.max(etapa, 3) : etapa, empresaId: c.empresaId || (p && p.empresaId) || null,
      orgao: (c.valores && c.valores.orgao) || (p && p.orgao) || '', numero: (c.valores && c.valores.numero) || (p && p.numero) || '',
      ganha: !!ganha, perdida: !!perdida, arquivado: !!c.arquivado, valor: valor, criadoEm: dataDe(c.criadoEm), dataGanho: dataGanho, dataPerda: dataPerda,
      empenhado: ex.empenhado, faturado: ex.faturado, recebido: ex.recebido, aReceber: cent(ex.faturado - ex.recebido),
      notas: lista(x.notas).map(function (n) { const pago = soma(lista(x.pagamentos).filter(function (g) { return g.notaId === n.id; })); return { numero: n.numero, data: dataDe(n.data), valor: cent(n.valor), vencimento: n.vencimento || '', pago: pago, aberto: Math.max(0, cent((Number(n.valor) || 0) - pago)) }; }),
      pagamentos: lista(x.pagamentos).map(function (g) { return { data: dataDe(g.data), valor: cent(g.valor) }; })
    };
  }

  function cartoes(e, empresaId) {
    const out = []; lista(e.quadros).filter(function (q) { return !q.arquivado && quadroDeLicitacao(q); }).forEach(function (q) { lista(q.cartoes).forEach(function (c) { const r = lerCartao(e, q, c); if (!empresaId || r.empresaId === empresaId) out.push(r); }); });
    return out;
  }

  // o: { empresaId, de, ate, cfg, hoje }
  function desempenho(e, o) {
    o = o || {}; const hoje = o.hoje || new Date().toISOString().slice(0, 10); const f = fator(o.cfg);
    const cs = cartoes(e, o.empresaId);
    const ganhas = cs.filter(function (c) { return c.ganha; }), perdidas = cs.filter(function (c) { return c.perdida; });
    const ate = function (k) { return cs.filter(function (c) { return c.etapa >= k || (k <= 3 && (c.ganha || c.perdida)); }).length; };
    const funil = { encontrados: cs.length, viaveis: ate(1), propostas: ate(2), disputas: ate(3), vencidas: ganhas.length, homologadas: cs.filter(function (c) { return c.etapa >= 5; }).length, contratadas: cs.filter(function (c) { return c.etapa >= 6 || c.empenhado > 0; }).length };
    const decididas = ganhas.length + perdidas.length;
    const tot = {
      oportunidades: cs.length, emAndamento: cs.filter(function (c) { return !c.ganha && !c.perdida && !c.arquivado; }).length,
      ganhas: ganhas.length, perdidas: perdidas.length, taxaSucesso: decididas ? ganhas.length / decididas * 100 : null,
      valorGanho: soma(ganhas), empenhado: soma(ganhas, function (c) { return c.empenhado; }), faturado: soma(cs, function (c) { return c.faturado; }), recebido: soma(cs, function (c) { return c.recebido; })
    };
    tot.aReceber = cent(tot.faturado - tot.recebido);
    tot.atrasado = soma([].concat.apply([], cs.map(function (c) { return c.notas; })).filter(function (n) { return n.aberto > 0 && n.vencimento && n.vencimento < hoje; }), function (n) { return n.aberto; });
    tot.comissaoPrevista = cent(tot.valorGanho * f); tot.comissaoRecebida = cent(tot.recebido * f); tot.comissaoAReceber = cent(Math.max(0, tot.valorGanho - tot.recebido) * f);
    // período (relatório do mês)
    const de = o.de || null, fim = o.ate || null; const per = { de: de, ate: fim };
    if (de || fim) {
      per.novas = cs.filter(function (c) { return noPeriodo(c.criadoEm, de, fim); });
      per.ganhas = ganhas.filter(function (c) { return noPeriodo(c.dataGanho, de, fim); });
      per.perdidas = perdidas.filter(function (c) { return noPeriodo(c.dataPerda, de, fim); });
      per.notas = [].concat.apply([], cs.map(function (c) { return c.notas.filter(function (n) { return noPeriodo(n.data, de, fim); }).map(function (n) { return Object.assign({ cartao: c.titulo, empresaId: c.empresaId }, n); }); }));
      per.pagamentos = [].concat.apply([], cs.map(function (c) { return c.pagamentos.filter(function (g) { return noPeriodo(g.data, de, fim); }).map(function (g) { return Object.assign({ cartao: c.titulo, empresaId: c.empresaId }, g); }); })).sort(function (a, b) { return a.data < b.data ? -1 : 1; });
      per.valorGanho = soma(per.ganhas); per.faturado = soma(per.notas); per.recebido = soma(per.pagamentos);
      const dec = per.ganhas.length + per.perdidas.length; per.taxaSucesso = dec ? per.ganhas.length / dec * 100 : null;
      per.comissao = cent(per.recebido * f); per.comissaoGanhos = cent(per.valorGanho * f);
    }
    const proximos = [].concat.apply([], cs.map(function (c) { return c.notas.filter(function (n) { return n.aberto > 0; }).map(function (n) { return Object.assign({ cartao: c.titulo, orgao: c.orgao, empresaId: c.empresaId, atrasada: !!(n.vencimento && n.vencimento < hoje) }, n); }); })).sort(function (a, b) { return (a.vencimento || '9999') < (b.vencimento || '9999') ? -1 : 1; });
    // por cliente (quando não há filtro)
    const porCliente = {}; cs.forEach(function (c) { const k = c.empresaId || '—'; const x = porCliente[k] = porCliente[k] || { empresaId: c.empresaId, oportunidades: 0, ganhas: 0, perdidas: 0, valorGanho: 0, recebido: 0 }; x.oportunidades++; if (c.ganha) { x.ganhas++; x.valorGanho = cent(x.valorGanho + c.valor); } if (c.perdida) x.perdidas++; x.recebido = cent(x.recebido + c.recebido); });
    Object.keys(porCliente).forEach(function (k) { const x = porCliente[k]; const d = x.ganhas + x.perdidas; x.taxaSucesso = d ? x.ganhas / d * 100 : null; x.comissao = cent(x.recebido * f); });
    return { cartoes: cs, funil: funil, totais: tot, periodo: per, contratos: ganhas, emDisputa: cs.filter(function (c) { return !c.ganha && !c.perdida && !c.arquivado; }), proximos: proximos, porCliente: Object.keys(porCliente).map(function (k) { return porCliente[k]; }).sort(function (a, b) { return b.valorGanho - a.valorGanho; }), fator: f };
  }

  // primeiro e último dia do mês 'AAAA-MM'
  function mes(aaaamm) { const m = String(aaaamm || '').match(/^(\d{4})-(\d{2})$/); if (!m) return null; const ult = new Date(Number(m[1]), Number(m[2]), 0).getDate(); return { de: m[1] + '-' + m[2] + '-01', ate: m[1] + '-' + m[2] + '-' + String(ult).padStart(2, '0') }; }

  return { desempenho: desempenho, cartoes: cartoes, etapaDaLista: etapaDaLista, fator: fator, mes: mes };
});
