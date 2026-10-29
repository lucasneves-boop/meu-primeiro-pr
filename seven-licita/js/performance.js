/* Performance do cliente a partir do Seven Processo: funil real, taxa de sucesso, valores ganhos,
   execução (empenhado, faturado, recebido) e comissão, no total e num período (relatório do mês).
   Puro: recebe o estado (Dados.e) e roda no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./comissao.js')); else raiz.Performance = fabrica(raiz.Comissao);
})(typeof self !== 'undefined' ? self : this, function (Kc) {
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
      licitacao: c.licitacao || null, uf: (c.licitacao && c.licitacao.uf) || (p && p.uf) || '', prazo: dataDe(c.prazo), perda: perdida ? Object.assign({}, p && p.motivoPerda ? { motivo: p.motivoPerda } : {}, c.perda || {}) : null, lanceFinal: (p && Number(p.lanceFinal)) || null, uasg: (c.licitacao && c.licitacao.uasg) || (p && p.uasg) || '', portal: (c.valores && c.valores.portal) || (p && p.portal) || '', valorEstimado: (c.licitacao && Number(c.licitacao.valorEstimado)) || null,
      ganha: !!ganha, perdida: !!perdida, arquivado: !!c.arquivado, valor: valor, criadoEm: dataDe(c.criadoEm), dataGanho: dataGanho, dataPerda: dataPerda,
      empenhado: ex.empenhado, faturado: ex.faturado, recebido: ex.recebido, aReceber: cent(ex.faturado - ex.recebido),
      notas: lista(x.notas).map(function (n) { const pago = soma(lista(x.pagamentos).filter(function (g) { return g.notaId === n.id; })); return { id: n.id, numero: n.numero, data: dataDe(n.data), valor: cent(n.valor), vencimento: n.vencimento || '', pago: pago, aberto: Math.max(0, cent((Number(n.valor) || 0) - pago)) }; }),
      pagamentos: lista(x.pagamentos).map(function (g) { return { id: g.id, data: dataDe(g.data), valor: cent(g.valor) }; })
    };
  }

  function cartoes(e, empresaId) {
    const out = []; lista(e.quadros).filter(function (q) { return !q.arquivado && quadroDeLicitacao(q); }).forEach(function (q) { lista(q.cartoes).forEach(function (c) { const r = lerCartao(e, q, c); if (!empresaId || r.empresaId === empresaId) out.push(r); }); });
    return out;
  }

  // o: { empresaId, de, ate, cfg, hoje }
  function desempenho(e, o) {
    o = o || {}; const hoje = o.hoje || new Date().toISOString().slice(0, 10);
    const cfgDe = o.cfgDe || function () { return o.cfg || {}; };
    const cs = cartoes(e, o.empresaId);
    // comissão de cada contrato (faixas, parceiros e retenção do cliente) e quanto ela rende por R$ recebido
    cs.forEach(function (c) {
      const cfg = cfgDe(c.empresaId) || {}; const cv = Kc.valorComissao(c.valor, cfg);
      const ref = c.valor > 0 ? cv : Kc.valorComissao(1e6, cfg); const v = c.valor > 0 ? c.valor : 1e6;
      c.comissao = c.ganha ? cent(cv.liquida) : 0; c.porReal = ref.liquida / v; c.brutoPorReal = ref.bruta / v; c.parceiros = lista(cfg.parceiros).filter(function (x) { return Number(x.pct) > 0; });
      c.comissaoRecebida = cent(c.recebido * c.porReal);
      c.notas.forEach(function (n) { n.comissao = cent(n.aberto * c.porReal); }); c.pagamentos.forEach(function (g) { g.comissao = cent(g.valor * c.porReal); });
    });
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
    tot.comissaoPrevista = soma(ganhas, function (c) { return c.comissao; }); tot.comissaoRecebida = soma(cs, function (c) { return c.comissaoRecebida; }); tot.comissaoAReceber = soma(ganhas, function (c) { return Math.max(0, c.valor - c.recebido) * c.porReal; });
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
      per.comissao = soma(per.pagamentos, function (g) { return g.comissao; }); per.comissaoGanhos = soma(per.ganhas, function (c) { return c.comissao; });
      const cf = cfgDe(o.empresaId) || {}; per.fixo = o.empresaId && Number(cf.fixo) > 0 && (!cf.fixoDesde || !de || cf.fixoDesde <= de.slice(0, 7)) ? cent(cf.fixo) : 0; per.total = cent(per.comissao + per.fixo);
    }
    const proximos = [].concat.apply([], cs.map(function (c) { return c.notas.filter(function (n) { return n.aberto > 0; }).map(function (n) { return Object.assign({ cartao: c.titulo, orgao: c.orgao, empresaId: c.empresaId, atrasada: !!(n.vencimento && n.vencimento < hoje) }, n); }); })).sort(function (a, b) { return (a.vencimento || '9999') < (b.vencimento || '9999') ? -1 : 1; });
    // por cliente (quando não há filtro)
    const porCliente = {}; cs.forEach(function (c) { const k = c.empresaId || '—'; const x = porCliente[k] = porCliente[k] || { empresaId: c.empresaId, oportunidades: 0, ganhas: 0, perdidas: 0, valorGanho: 0, recebido: 0 }; x.oportunidades++; if (c.ganha) { x.ganhas++; x.valorGanho = cent(x.valorGanho + c.valor); } if (c.perdida) x.perdidas++; x.recebido = cent(x.recebido + c.recebido); x.comissao = cent((x.comissao || 0) + c.comissaoRecebida); });
    Object.keys(porCliente).forEach(function (k) { const x = porCliente[k]; const d = x.ganhas + x.perdidas; x.taxaSucesso = d ? x.ganhas / d * 100 : null; });
    return { cartoes: cs, funil: funil, totais: tot, periodo: per, contratos: ganhas, notasEmAberto: soma(proximosBrutos(cs)), emDisputa: cs.filter(function (c) { return !c.ganha && !c.perdida && !c.arquivado; }), proximos: proximos, porCliente: Object.keys(porCliente).map(function (k) { return porCliente[k]; }).sort(function (a, b) { return b.valorGanho - a.valorGanho; }), fator: null };
  }

  function proximosBrutos(cs) { return [].concat.apply([], cs.map(function (c) { return c.notas.filter(function (n) { return n.aberto > 0; }).map(function (n) { return { valor: n.aberto }; }); })); }

  // ---------- extrato de comissões: cada pagamento do órgão gera comissão; o fixo mensal entra por mês ----------
  // o: { empresaId, cfgDe(id), hoje, registros (Dados.e.comissaoExtrato), lancamentos (Seven Financeiro) }
  function meses(de, ate) { const out = []; let [a, m] = de.split('-').map(Number); const [b, n] = ate.split('-').map(Number); while ((a < b || (a === b && m <= n)) && out.length < 240) { out.push(a + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; a++; } } return out; }
  function extrato(e, o) {
    o = o || {}; const hoje = o.hoje || new Date().toISOString().slice(0, 10); const reg = o.registros || {}; const lancs = lista(o.lancamentos);
    const cfgDe = o.cfgDe || function () { return {}; };
    const d = desempenho(e, { empresaId: o.empresaId, cfgDe: cfgDe, hoje: hoje });
    const lanc = function (origem) { return lancs.find(function (l) { return l.origem === origem; }); };
    const itens = [];
    d.cartoes.forEach(function (c) {
      const cfg = cfgDe(c.empresaId) || {};
      c.pagamentos.forEach(function (g) {
        if (!(g.valor > 0)) return;
        const repasses = c.parceiros.map(function (x) { return { nome: String(x.nome || 'Parceiro'), valor: cent(g.valor * c.brutoPorReal * Number(x.pct) / 100) }; });
        itens.push({ chave: 'pg:' + c.id + ':' + g.id, tipo: 'comissao', empresaId: c.empresaId, data: g.data, descricao: 'Comissão · ' + c.titulo, base: g.valor, valor: cent(g.comissao), repasses: repasses });
      });
    });
    const emps = o.empresaId ? [o.empresaId] : lista(e.empresas).map(function (x) { return x.id; });
    emps.forEach(function (id) {
      const cfg = cfgDe(id) || {}; const fx = Number(cfg.fixo) || 0; if (!(fx > 0)) return;
      const ini = /^\d{4}-\d{2}$/.test(cfg.fixoDesde || '') ? cfg.fixoDesde : hoje.slice(0, 7); const dia = String(Math.min(28, Math.max(1, Math.round(Number(cfg.diaVenc) || 10)))).padStart(2, '0');
      meses(ini, hoje.slice(0, 7)).forEach(function (mm) { itens.push({ chave: 'fixo:' + id + ':' + mm, tipo: 'fixo', empresaId: id, data: mm + '-' + dia, descricao: 'Mensalidade do BPO · ' + mm.split('-').reverse().join('/'), base: null, valor: cent(fx), repasses: [] }); });
    });
    itens.forEach(function (it) {
      const l = lanc('comissao:' + it.chave); const r = reg[it.chave] || {};
      it.lancamento = l ? l.id : null; it.status = l ? (l.pago ? 'recebida' : 'cobrada') : (r.status === 'recebida' ? 'recebida' : 'a cobrar');
      it.repasses.forEach(function (rp, i) { const lr = lanc('repasse:' + it.chave + ':' + i); rp.status = lr ? (lr.pago ? 'pago' : 'lançado') : 'pendente'; });
    });
    itens.sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
    const tot = function (st) { return soma(itens.filter(function (i) { return !st || i.status === st; })); };
    return { itens: itens, gerada: tot(), aCobrar: tot('a cobrar'), cobrada: tot('cobrada'), recebida: tot('recebida'), repasses: soma([].concat.apply([], itens.map(function (i) { return i.repasses; }))) };
  }

  // ---------- Seven Relatórios: período, comparação com o anterior e evolução mês a mês ----------
  function isoDe(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function somaDia(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDe(d); }
  // período anterior de mesma duração; meses inteiros viram os meses imediatamente anteriores
  function periodoAnterior(de, ate) {
    const ini = new Date(de + 'T12:00:00'), fim = new Date(ate + 'T12:00:00');
    const mesesInteiros = ini.getDate() === 1 && somaDia(ate, 1).slice(8) === '01';
    if (mesesInteiros) { const n = (fim.getFullYear() - ini.getFullYear()) * 12 + fim.getMonth() - ini.getMonth() + 1; const a = new Date(ini.getFullYear(), ini.getMonth() - n, 1); const b = new Date(ini.getFullYear(), ini.getMonth(), 0); return { de: isoDe(a), ate: isoDe(b) }; }
    const dias = Math.round((fim - ini) / 864e5) + 1; return { de: somaDia(de, -dias), ate: somaDia(de, -1) };
  }
  function resumoPeriodo(e, o) {
    const d = desempenho(e, { empresaId: o.empresaId, cfgDe: o.cfgDe, de: o.de, ate: o.ate, hoje: o.hoje }); const p = d.periodo;
    return { de: o.de, ate: o.ate, novas: p.novas.length, ganhas: p.ganhas.length, perdidas: p.perdidas.length, disputadas: p.ganhas.length + p.perdidas.length, taxa: p.taxaSucesso, valorGanho: p.valorGanho, faturado: p.faturado, recebido: p.recebido, comissao: p.comissao, fixo: p.fixo || 0, desempenho: d };
  }
  const METRICAS = [['novas', 'Novas oportunidades'], ['disputadas', 'Licitações decididas'], ['ganhas', 'Licitações ganhas'], ['taxa', 'Taxa de sucesso'], ['valorGanho', 'Valor ganho'], ['faturado', 'Faturado'], ['recebido', 'Recebido']];
  function comparar(a, b) {
    return METRICAS.map(function (m) {
      const x = a[m[0]], y = b[m[0]]; const delta = x != null && y != null ? x - y : null;
      return { chave: m[0], nome: m[1], atual: x, anterior: y, delta: delta, pct: delta != null && y ? delta / y * 100 : null, sentido: delta == null || Math.abs(delta) < 1e-9 ? 'igual' : delta > 0 ? 'subiu' : 'caiu' };
    });
  }
  // veredito: quantos indicadores principais melhoraram e quantos pioraram
  function veredito(c) {
    const pesos = { ganhas: 1, taxa: 1, valorGanho: 1, recebido: 1 }; let mais = 0, menos = 0;
    c.forEach(function (x) { if (!pesos[x.chave]) return; if (x.sentido === 'subiu') mais++; if (x.sentido === 'caiu') menos++; });
    return mais > menos ? 'avancando' : menos > mais ? 'atencao' : 'estavel';
  }
  function evolucao(e, o) {
    return meses(o.de.slice(0, 7), o.ate.slice(0, 7)).map(function (mm) { const p = mes(mm); const r = resumoPeriodo(e, Object.assign({}, o, p)); delete r.desempenho; r.mes = mm; return r; });
  }

  // ---------- complementos do relatório: trabalho da Seven, perdas, concorrência, distribuição, metas, agenda, habilitação ----------
  const MOTIVOS_PERDA = [['preco', 'Preço (perdeu nos lances)'], ['habilitacao', 'Inabilitação (documentos)'], ['tecnica', 'Desclassificação técnica ou amostra'], ['prazo', 'Prazo perdido ou proposta não enviada'], ['deserta', 'Deserta, fracassada, revogada ou anulada'], ['outro', 'Outro motivo']];
  const GRUPO_PECA = { esclarecimento: 'esclarecimentos', impugnacao: 'impugnacoes', intencao: 'recursos', recurso: 'recursos', contrarrazoes: 'contrarrazoes' };
  const TRABALHO = [['oportunidades', 'Oportunidades avaliadas'], ['analisados', 'Editais analisados'], ['propostasCadastradas', 'Propostas montadas'], ['propostasEnviadas', 'Propostas enviadas'], ['sessoes', 'Sessões disputadas'], ['esclarecimentos', 'Pedidos de esclarecimento'], ['impugnacoes', 'Impugnações'], ['recursos', 'Intenções e recursos'], ['contrarrazoes', 'Contrarrazões'], ['outrasPecas', 'Outras peças (reequilíbrio, cobrança…)'], ['documentos', 'Documentos de habilitação renovados'], ['movimentos', 'Movimentações no Seven Processo']];
  function cartoesBrutos(e, empresaId) {
    const out = []; lista(e.quadros).filter(function (q) { return !q.arquivado && quadroDeLicitacao(q); }).forEach(function (q) { lista(q.cartoes).forEach(function (c) { const p = lista(e.propostas).find(function (x) { return x.id === c.propostaId; }); const id = c.empresaId || (p && p.empresaId) || null; if (!empresaId || id === empresaId) out.push(c); }); });
    return out;
  }
  // o: { empresaId, de, ate, hoje, analisados (contagem manual) }
  function trabalho(e, o) {
    o = o || {}; const hoje = o.hoje || new Date().toISOString().slice(0, 10); const de = o.de, ate = o.ate;
    const doCli = function (x) { return !o.empresaId || x.empresaId === o.empresaId; }; const em = function (iso) { return noPeriodo(iso, de, ate); };
    const n = { oportunidades: 0, analisados: Math.max(0, Math.round(Number(o.analisados) || 0)), propostasCadastradas: 0, propostasEnviadas: 0, sessoes: 0, esclarecimentos: 0, impugnacoes: 0, recursos: 0, contrarrazoes: 0, outrasPecas: 0, documentos: 0, movimentos: 0 };
    const cs = cartoesBrutos(e, o.empresaId);
    cs.forEach(function (c) { if (em(c.criadoEm)) n.oportunidades++; lista(c.atividade).forEach(function (a) { if (em(a.em)) n.movimentos++; }); });
    const props = lista(e.propostas).filter(doCli);
    props.forEach(function (p) { if (em(p.criadaEm)) n.propostasCadastradas++; if (em(p.enviadaEm)) n.propostasEnviadas++; });
    // sessões: Seven Pregão e Seven Sessão, sem contar duas vezes a mesma licitação
    const vistas = {}; const chave = function (x) { const p = x.propostaId && props.find(function (y) { return y.id === x.propostaId; }); return (x.avisoId || (p && p.avisoId)) || x.id; };
    lista(e.disputas).concat(lista(e.monitor)).filter(doCli).forEach(function (x) { const d = dataDe(x.sessao); if (!d || d > hoje || !em(d)) return; const k = chave(x); if (vistas[k]) return; vistas[k] = 1; n.sessoes++; });
    lista(e.pecas).filter(doCli).forEach(function (p) { if (em(p.criadaEm)) n[GRUPO_PECA[p.modelo] || 'outrasPecas']++; });
    lista(e.monitor).filter(doCli).forEach(function (m) { lista(m.recursos).forEach(function (r) { if (em(r.em)) n.recursos++; }); });
    lista(e.documentos).filter(doCli).forEach(function (d) { if (em(d.criadoEm)) n.documentos++; });
    const itens = TRABALHO.map(function (t) { return { chave: t[0], nome: t[1], n: n[t[0]] }; });
    return { itens: itens, n: n, total: itens.reduce(function (s, x) { return s + (x.chave === 'movimentos' ? 0 : x.n); }, 0) };
  }
  // perdas no período, com o motivo de cada uma
  function perdas(cs, de, ate) {
    const l = cs.filter(function (c) { return c.perdida && noPeriodo(c.dataPerda, de, ate); });
    const por = MOTIVOS_PERDA.map(function (m) { const k = l.filter(function (c) { return c.perda && c.perda.motivo === m[0]; }).length; return { chave: m[0], nome: m[1], n: k, pct: l.length ? k / l.length * 100 : 0 }; }).filter(function (x) { return x.n; });
    const sem = l.filter(function (c) { return !(c.perda && c.perda.motivo); }).length;
    return { lista: l, porMotivo: por.sort(function (a, b) { return b.n - a.n; }), semMotivo: sem, principal: por.length ? por[0] : null };
  }
  function nossoValor(c) { return Number(c.perda && c.perda.nossoValor) || c.lanceFinal || c.valor || null; }
  // deságio sobre o estimado nas ganhas, distância para o vencedor nas perdidas e concorrentes que mais ganharam de nós
  function concorrencia(cs, de, ate) {
    const g = cs.filter(function (c) { return c.ganha && noPeriodo(c.dataGanho, de, ate) && c.valorEstimado > 0 && c.valor > 0; });
    const desagios = g.map(function (c) { return (c.valorEstimado - c.valor) / c.valorEstimado * 100; });
    const p = cs.filter(function (c) { return c.perdida && noPeriodo(c.dataPerda, de, ate) && c.perda && Number(c.perda.valorVencedor) > 0 && nossoValor(c) > 0; });
    const dist = p.map(function (c) { return (nossoValor(c) - Number(c.perda.valorVencedor)) / Number(c.perda.valorVencedor) * 100; });
    const med = function (l) { return l.length ? l.reduce(function (s, x) { return s + x; }, 0) / l.length : null; };
    const conc = {}; cs.forEach(function (c) { const v = c.perda && String(c.perda.vencedor || '').trim(); if (!c.perdida || !v) return; const k = norm(v).replace(/\s+/g, ' '); const x = conc[k] = conc[k] || { nome: v, vezes: 0, valor: 0, noPeriodo: 0 }; x.vezes++; x.valor = cent(x.valor + (Number(c.perda.valorVencedor) || 0)); if (noPeriodo(c.dataPerda, de, ate)) x.noPeriodo++; });
    return { desagioMedio: med(desagios), nDesagio: desagios.length, distanciaMedia: med(dist), nDistancia: dist.length, concorrentes: Object.keys(conc).map(function (k) { return conc[k]; }).sort(function (a, b) { return b.vezes - a.vezes || b.valor - a.valor; }).slice(0, 8) };
  }
  // licitações decididas no período por órgão, portal e UF
  function distribuicao(cs, de, ate) {
    const dec = cs.filter(function (c) { return (c.ganha && noPeriodo(c.dataGanho, de, ate)) || (c.perdida && noPeriodo(c.dataPerda, de, ate)); });
    const por = function (f) { const g = {}; dec.forEach(function (c) { const k = String(f(c) || '').trim() || 'Não informado'; const x = g[k] = g[k] || { nome: k, decididas: 0, ganhas: 0, valorGanho: 0 }; x.decididas++; if (c.ganha) { x.ganhas++; x.valorGanho = cent(x.valorGanho + c.valor); } }); return Object.keys(g).map(function (k) { const x = g[k]; x.taxa = x.ganhas / x.decididas * 100; return x; }).sort(function (a, b) { return b.valorGanho - a.valorGanho || b.decididas - a.decididas; }).slice(0, 10); };
    return { decididas: dec.length, orgao: por(function (c) { return c.orgao; }), portal: por(function (c) { return c.portal; }), uf: por(function (c) { return String(c.uf || '').toUpperCase(); }) };
  }
  // metas mensais do cliente × resultado do período (meses do período multiplicam a meta)
  const METAS = [['valorGanho', 'Valor ganho'], ['recebido', 'Recebido dos órgãos'], ['ganhas', 'Licitações ganhas']];
  function metas(meta, resumo) {
    meta = meta || {}; const nm = meses(resumo.de.slice(0, 7), resumo.ate.slice(0, 7)).length || 1;
    const fr = function () { const a = new Date(resumo.de + 'T12:00:00'), b = new Date(resumo.ate + 'T12:00:00'); const mi = resumo.de.slice(8) === '01' && somaDia(resumo.ate, 1).slice(8) === '01'; return mi ? nm : (Math.round((b - a) / 864e5) + 1) / 30.4375; };
    const k = fr();
    return METAS.filter(function (m) { return Number(meta[m[0]]) > 0; }).map(function (m) { const alvo = m[0] === 'ganhas' ? Math.round(Number(meta[m[0]]) * k * 10) / 10 : cent(Number(meta[m[0]]) * k); const at = Number(resumo[m[0]]) || 0; return { chave: m[0], nome: m[1], atual: at, alvo: alvo, pct: alvo ? at / alvo * 100 : null, atingida: at >= alvo }; });
  }
  // documentos de habilitação do cliente: vencidos, vencendo em `dias` e válidos
  function habilitacao(e, o) {
    o = o || {}; const hoje = o.hoje || new Date().toISOString().slice(0, 10); const dias = o.dias || 30; const h = new Date(hoje + 'T12:00:00');
    const docs = lista(e.documentos).filter(function (d) { return !o.empresaId || d.empresaId === o.empresaId; });
    const r = { vencidos: [], vencendo: [], validos: 0, semValidade: 0, total: docs.length };
    docs.forEach(function (d) { if (!d.validade) { r.semValidade++; return; } const n = Math.round((new Date(d.validade + 'T12:00:00') - h) / 864e5); const it = { nome: d.nome || (d.arquivo && d.arquivo.nome) || 'Documento', validade: d.validade, dias: n, tipo: d.tipo || '' }; if (n < 0) r.vencidos.push(it); else if (n <= dias) r.vencendo.push(it); else r.validos++; });
    r.vencidos.sort(function (a, b) { return a.dias - b.dias; }); r.vencendo.sort(function (a, b) { return a.dias - b.dias; });
    return r;
  }

  // primeiro e último dia do mês 'AAAA-MM'
  function mes(aaaamm) { const m = String(aaaamm || '').match(/^(\d{4})-(\d{2})$/); if (!m) return null; const ult = new Date(Number(m[1]), Number(m[2]), 0).getDate(); return { de: m[1] + '-' + m[2] + '-01', ate: m[1] + '-' + m[2] + '-' + String(ult).padStart(2, '0') }; }

  return { desempenho: desempenho, extrato: extrato, meses: meses, periodoAnterior: periodoAnterior, resumoPeriodo: resumoPeriodo, comparar: comparar, veredito: veredito, evolucao: evolucao, METRICAS: METRICAS, trabalho: trabalho, perdas: perdas, concorrencia: concorrencia, distribuicao: distribuicao, metas: metas, habilitacao: habilitacao, MOTIVOS_PERDA: MOTIVOS_PERDA, METAS: METAS, cartoes: cartoes, etapaDaLista: etapaDaLista, fator: fator, mes: mes };
});
