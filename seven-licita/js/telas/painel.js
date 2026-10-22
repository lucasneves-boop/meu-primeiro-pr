/* Painel: o dia da Seven em uma tela, montado com blocos que o usuário escolhe, retira, reordena e redimensiona.
   Gráficos em SVG (Graficos), cada um com dica ao passar o mouse e versão em tabela. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, dataHora, emQuanto, progresso, modal, confirmar, aviso } = UI;
  const G = self.Graficos; const PC = self.PainelCfg;
  const LARG = { p: 340, m: 560, g: 1060 };
  let doDia = null; let editando = false; let arrastando = null;

  function cfg() { const d = Dados.e; d.painel = d.painel || {}; d.painel.layout = PC.normalizar(d.painel.layout); d.painel.tabela = d.painel.tabela || {}; return d.painel; }
  function hoje() { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function valores(o) { return Object.keys(o || {}).map(function (k) { return o[k]; }); }
  function inteiro(v) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function reais(v) { return 'R$ ' + G.compacto(v); }

  async function carregarDoDia(alvo) {
    const ufs = []; Dados.e.perfis.forEach(function (p) { (p.ufs || []).forEach(function (u) { if (ufs.indexOf(u) < 0) ufs.push(u); }); });
    if (!ufs.length) ufs.push((Dados.empresaAtiva() || {}).uf || 'GO');
    const r = await PNCP.publicadas({ ufs: ufs, modalidades: [6, 8, 4], inicio: hoje(), fim: hoje(), maxPaginas: 20 }, function (f, t) { progresso(alvo, 'Licitações publicadas hoje: ' + f + '/' + t, f / t); });
    const faixa = { ate50: 0, ate250: 0, acima: 0, sem: 0 }; let total = 0;
    r.lista.forEach(function (c) { const v = c.valorEstimado; if (!v) faixa.sem++; else if (v <= 50000) faixa.ate50++; else if (v <= 250000) faixa.ate250++; else faixa.acima++; total += v || 0; });
    doDia = { ufs: ufs, n: r.lista.length, faixa: faixa, total: total, em: new Date().toISOString() };
  }

  // ---------- blocos: cada um devolve { corpo, tabela?, link?, acao? } ----------
  function lista(itens, vazio) { return itens.length ? '<ul class="lista-prazos">' + itens.join('') + '</ul>' : '<p class="mudo">' + vazio + '</p>'; }
  function graficoComLegenda(svg, leg) { return '<div class="pn-graf-leg">' + svg + leg + '</div>'; }
  const B = {
    kpis: function () {
      const d = Dados.e; const novos = valores(d.avisos).filter(function (a) { return !a.lido && !a.lixeira; }).length;
      const prep = d.propostas.filter(function (p) { return p.status === 'rascunho' || p.status === 'pronta'; }).length;
      const semLim = d.disputas.filter(function (x) { return x.itens.some(function (i) { return !i.limite || !i.aprovado; }); }).length;
      const prazos = Telas.monitorar.prazosAbertos().length;
      const docs = d.documentos.filter(function (x) { return x.validade && Nucleo.statusDocumento(x.validade).codigo !== 'valido'; }).length;
      const pend = Telas.quadros.pendencias(); const atras = pend.some(function (p) { return p.tipo === 'atrasado'; });
      const k = function (href, n, rot, alerta) { return '<a href="' + href + '"' + (alerta ? ' class="pn-alerta"' : '') + '><b>' + (alerta ? '<span aria-hidden="true">⚠ </span>' : '') + n + '</b><span>' + rot + (alerta ? ' <small>· atenção</small>' : '') + '</span></a>'; };
      return { corpo: '<div class="kpis pn-kpis">' + k('#/encontrar', novos, 'avisos novos') + k('#/cadastrar', prep, 'propostas em preparo') + k('#/disputar', semLim, 'disputas sem limite aprovado', semLim > 0) + k('#/monitorar', prazos, 'prazos do pregoeiro abertos') + k('#/cadastrar/documentos', docs, 'documentos vencendo/vencidos', docs > 0) + k('#/quadros', pend.length, 'pendências no Quadro', atras) + '</div>' };
    },
    sessoes: function () {
      const d = Dados.e;
      const l = valores(d.avisos).filter(function (a) { return a.favorito && a.encerramento && new Date(a.encerramento) > Date.now(); })
        .concat(d.propostas.filter(function (p) { return p.encerramento && new Date(p.encerramento) > Date.now() && p.status !== 'perdida'; }).map(function (p) { return { encerramento: p.encerramento, objeto: p.objeto, orgao: p.orgao, link: '#/cadastrar/proposta/' + p.id, tipo: 'Proposta ' + (p.status === 'enviada' ? 'enviada' : 'em preparo') }; }))
        .sort(function (a, b) { return new Date(a.encerramento) - new Date(b.encerramento); }).slice(0, 8);
      return { link: '#/encontrar', corpo: lista(l.map(function (a) { return '<li class="' + (new Date(a.encerramento) - Date.now() < 864e5 ? 'logo' : '') + '"><b>' + dataHora(a.encerramento) + '</b> (' + emQuanto(a.encerramento) + ')<br><a href="' + esc(UI.url(a.link || '#/encontrar')) + '">' + esc(String(a.objeto || '').slice(0, 110)) + '</a><br><span class="mini mudo">' + esc(a.tipo || 'Aviso favorito') + ' · ' + esc(a.orgao || '') + '</span></li>'; }), 'Favorite avisos ou crie propostas para ver aqui.') };
    },
    prazos: function () {
      const p = Telas.monitorar.prazosAbertos().slice(0, 8);
      return { link: '#/monitorar', corpo: lista(p.map(function (x) { const ms = new Date(x.p.ate) - Date.now(); return '<li class="' + (ms < 0 ? 'atrasado' : ms < 864e5 ? 'logo' : '') + '"><b>' + dataHora(x.p.ate) + '</b> · ' + esc(x.p.tipo) + '<br><a href="#/monitorar/licitacao/' + x.m.id + '">' + esc(x.m.titulo) + '</a></li>'; }), 'Sem prazos abertos.') };
    },
    pendencias: function () {
      const p = Telas.quadros.pendencias().slice(0, 10);
      return { link: '#/quadros', corpo: lista(p.map(function (x) { return '<li class="' + (x.tipo === 'atrasado' ? 'atrasado' : 'logo') + '"><b>' + dataHora(x.quando) + '</b> · <a href="#/quadros/' + x.quadro.id + '">' + esc(x.texto) + '</a></li>'; }), 'Nada atrasado ou vencendo.') };
    },
    propostas: function (tam) {
      const ST = [['rascunho', 'Rascunho'], ['pronta', 'Pronta'], ['enviada', 'Enviada'], ['erro', 'Com erro'], ['vencida', 'Ganha'], ['perdida', 'Não vencida']];
      const it = ST.map(function (s) { return { r: s[1], v: Dados.e.propostas.filter(function (p) { return p.status === s[0]; }).length }; });
      return { link: '#/cadastrar', corpo: G.colunas(it, { largura: LARG[tam], fmt: inteiro, vazio: 'Nenhuma proposta cadastrada', titulo: 'Propostas por situação' }), tabela: G.tabela(['Situação', 'Propostas'], it.map(function (x) { return [x.r, x.v]; })) };
    },
    monitor: function () {
      const it = PC.contar(Dados.e.monitor, function (m) { return m.situacao; }, Nucleo.CATEGORIAS);
      return { link: '#/monitorar', corpo: graficoComLegenda(G.rosca(it, { fmt: inteiro, vazio: 'Nada sendo monitorado', rotuloCentro: 'processos' }), G.legenda(it, inteiro)), tabela: G.tabela(['Situação', 'Processos'], it.map(function (x) { return [x.r, x.v]; })) };
    },
    quadro: function (tam) {
      const q = (Dados.e.quadros || []).find(function (x) { return /licita/i.test(x.nome || x.titulo || '') && !x.arquivado; }) || (Dados.e.quadros || [])[0];
      if (!q) return { corpo: '<p class="mudo">Crie o quadro de licitações em <a href="#/quadros">Seven Processo</a>.</p>' };
      const it = q.listas.filter(function (l) { return !l.arquivada; }).map(function (l) { return { r: l.nome, v: q.cartoes.filter(function (c) { return c.lista === l.id && !c.arquivado; }).length }; });
      return { link: '#/quadros/' + q.id, corpo: G.barras(it, { largura: LARG[tam], fmt: inteiro, linha: 24, titulo: 'Cartões por lista' }), tabela: G.tabela(['Lista', 'Cartões'], it.map(function (x) { return [x.r, x.v]; })) };
    },
    documentos: function () {
      const c = { valido: 0, vencendo: 0, vencido: 0 }; Dados.e.documentos.forEach(function (x) { if (!x.validade) return; const s = Nucleo.statusDocumento(x.validade).codigo; if (s in c) c[s]++; });
      const it = [{ r: 'Válidos', v: c.valido, classe: 'gf-ok' }, { r: 'Vencendo (7 dias)', v: c.vencendo, classe: 'gf-aviso' }, { r: 'Vencidos', v: c.vencido, classe: 'gf-perigo' }];
      return { link: '#/cadastrar/documentos', corpo: graficoComLegenda(G.rosca(it, { fmt: inteiro, vazio: 'Nenhum documento com validade', rotuloCentro: 'documentos' }), G.legenda(it, inteiro)), tabela: G.tabela(['Situação', 'Documentos'], it.map(function (x) { return [x.r, x.v]; })) };
    },
    pncp: function (tam) {
      if (!doDia) return { acao: '<button class="btn mini" data-pn="dia">Carregar</button>', corpo: '<div id="pn-dia"><p class="mudo">Consulta as licitações publicadas hoje no PNCP nas UFs dos seus perfis de busca.</p></div>' };
      const it = [{ r: 'Até 50 mil', v: doDia.faixa.ate50 }, { r: '50 a 250 mil', v: doDia.faixa.ate250 }, { r: 'Acima de 250 mil', v: doDia.faixa.acima }, { r: 'Sem valor', v: doDia.faixa.sem }];
      return { acao: '<button class="btn mini" data-pn="dia">Atualizar</button>', corpo: '<div id="pn-dia"><p class="pn-destaque"><b>' + inteiro(doDia.n) + '</b> licitações · <b>' + moeda(doDia.total) + '</b> estimados <span class="mini mudo">(' + esc(doDia.ufs.join(', ')) + ')</span></p>' + G.colunas(it, { largura: LARG[tam], altura: 170, fmt: inteiro, titulo: 'Publicadas hoje por faixa de valor' }) + '</div>', tabela: G.tabela(['Faixa', 'Licitações'], it.map(function (x) { return [x.r, x.v]; })) };
    },
    cotacoes: function () {
      const N = { rascunho: 'Rascunho', 'em-andamento': 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada' };
      const it = PC.contar(Dados.e.cotacoes || [], function (c) { return N[c.status] || c.status; }, ['Rascunho', 'Em andamento', 'Concluída', 'Cancelada']);
      return { link: '#/cotacoes', corpo: graficoComLegenda(G.rosca(it, { fmt: inteiro, vazio: 'Nenhuma cotação', rotuloCentro: 'cotações' }), G.legenda(it, inteiro)), tabela: G.tabela(['Situação', 'Cotações'], it.map(function (x) { return [x.r, x.v]; })) };
    },
    capag: function (tam) {
      const vistos = {}; const regs = valores((Dados.e.config || {}).capag).filter(function (v) { const k = v.ibge || (v.municipio + '-' + v.uf); if (vistos[k]) return false; vistos[k] = 1; return true; });
      const it = ['A', 'B', 'C', 'D', 'n.d.'].map(function (n) { return { r: 'CAPAG ' + n, v: regs.filter(function (r) { return String(r.nota).replace('+', '') === n; }).length }; });
      return { link: '#/mercado/capag', corpo: regs.length ? G.barras(it, { largura: LARG[tam], fmt: inteiro, linha: 24, titulo: 'Municípios por nota CAPAG' }) : '<p class="mudo">Importe a planilha da CAPAG em <a href="#/mercado/capag">Seven Painel de Preços › Seven CAPAG</a>.</p>', tabela: G.tabela(['Nota', 'Municípios'], it.map(function (x) { return [x.r, x.v]; })) };
    },
    'com-kpis': function () {
      const c = Dados.e.comercial || {}; const m = Comercial.metricas(c.negocios || [], hoje());
      const ganhosMes = PC.porMes((c.negocios || []).filter(function (n) { return n.etapa === 'ganho'; }), function (n) { return n.fechadoEm; }, null, hoje(), 6);
      const pct = function (v) { return v == null ? '—' : Math.round(v * 100) + '%'; };
      return { link: '#/comercial', corpo: '<div class="kpis pn-kpis"><a href="#/comercial/funil"><span>Pipeline aberto</span><b>' + moeda(m.pipeline) + '</b><small class="mudo">' + m.abertos + ' negócio(s)</small></a><a href="#/comercial/funil"><span>Previsão ponderada</span><b>' + moeda(m.ponderado) + '</b><small class="mudo">valor × chance da etapa</small></a><a href="#/comercial"><span>Taxa de ganho</span><b>' + pct(m.win) + '</b><small class="mudo">' + m.ganhos + ' ganhos · ' + m.perdidos + ' perdidos</small></a><a href="#/comercial"><span>Ticket médio</span><b>' + (m.ticket == null ? '—' : moeda(m.ticket)) + '</b><small class="mudo">valor do contrato</small></a><a href="#/comercial/contas"><span>Clientes ganhos (6 meses)</span><b>' + ganhosMes.reduce(function (s, x) { return s + x.v; }, 0) + '</b>' + G.sparkline(ganhosMes.map(function (x) { return x.v; })) + '</a></div>' };
    },
    'com-funil': function (tam) {
      const m = Comercial.metricas((Dados.e.comercial || {}).negocios || [], hoje());
      const it = m.porEtapa.filter(function (x) { return x.id !== 'perdido'; }).map(function (x) { return { r: x.nome, v: x.qtd, rotuloValor: x.qtd + ' · ' + reais(x.valor), dica: x.nome + ': ' + x.qtd + ' negócio(s), ' + moeda(x.valor) }; });
      return { link: '#/comercial/funil', corpo: it.some(function (x) { return x.v; }) ? G.barras(it, { largura: LARG[tam], linha: 26, titulo: 'Negócios por etapa' }) : '<p class="mudo">Cadastre contas no <a href="#/comercial">Seven Comercial</a> para ver o funil.</p>', tabela: G.tabela(['Etapa', 'Negócios', 'Valor'], m.porEtapa.map(function (x) { return [x.nome, x.qtd, moeda(x.valor)]; })) };
    },
    'com-ganhos': function (tam) {
      const ns = ((Dados.e.comercial || {}).negocios || []).filter(function (n) { return n.etapa === 'ganho'; });
      const q = PC.porMes(ns, function (n) { return n.fechadoEm; }, null, hoje(), 6); const mrr = PC.porMes(ns, function (n) { return n.fechadoEm; }, function (n) { return n.mensalidade; }, hoje(), 6);
      return { link: '#/comercial/contas', corpo: G.colunas(q.map(function (x, i) { return { r: x.r, v: x.v, dica: x.r + ': ' + x.v + ' cliente(s), ' + moeda(mrr[i].v) + '/mês' }; }), { largura: LARG[tam], fmt: inteiro, vazio: 'Nenhum contrato ganho nos últimos 6 meses', titulo: 'Clientes ganhos por mês' }), tabela: G.tabela(['Mês', 'Clientes', 'Mensalidade nova'], q.map(function (x, i) { return [x.r, x.v, moeda(mrr[i].v)]; })) };
    },
    'com-origem': function () {
      const it = PC.contar((Dados.e.comercial || {}).contas || [], function (c) { return c.origem || 'Não informada'; });
      return { link: '#/comercial/contas', corpo: graficoComLegenda(G.rosca(it, { fmt: inteiro, vazio: 'Nenhuma conta', rotuloCentro: 'contas' }), G.legenda(G.agruparOutros(it, 6), inteiro)), tabela: G.tabela(['Origem', 'Contas'], it.map(function (x) { return [x.r, x.v]; })) };
    },
    'com-atividades': function () {
      const c = Dados.e.comercial || {}; const h = hoje();
      const l = (c.atividades || []).filter(function (a) { return !a.feita && a.data <= h; }).sort(function (a, b) { return a.data.localeCompare(b.data); }).slice(0, 8);
      const conta = function (id) { return (c.contas || []).find(function (x) { return x.id === id; }); };
      return { link: '#/comercial/atividades', corpo: lista(l.map(function (a) { const ct = conta(a.contaId); return '<li class="' + (a.data < h ? 'atrasado' : 'logo') + '"><b>' + (a.data < h ? 'Atrasada · ' : 'Hoje · ') + esc(a.titulo) + '</b>' + (ct ? '<br><a href="#/comercial/conta/' + ct.id + '">' + esc(ct.fantasia || ct.razao) + '</a>' : '') + '</li>'; }), 'Nada para hoje.') };
    },
    'fin-fluxo': function (tam) {
      const f = Dados.e.financas; if (!f) return { corpo: '<p class="mudo">Comece em <a href="#/financas">Seven Financeiro</a>.</p>' };
      const ls = (f.lancamentos || []).filter(function (l) { return l.perfil === f.perfilAtivo; }); const ms = PC.mesesAte(hoje(), 6);
      const rs = ms.map(function (m) { return Financas.resumo(ls, m); });
      const series = [{ nome: 'Receitas', valores: rs.map(function (r) { return r.receitas; }) }, { nome: 'Despesas', valores: rs.map(function (r) { return r.despesas; }) }];
      return { link: '#/financas', corpo: G.agrupadas(ms.map(PC.rotuloMes), series, { largura: LARG[tam], fmt: function (v) { return moeda(v); }, titulo: 'Receitas e despesas' }) + G.legenda(series.map(function (s) { return { r: s.nome, v: s.valores.reduce(function (a, b) { return a + (b || 0); }, 0), pct: false }; }), reais), tabela: G.tabela(['Mês', 'Receitas', 'Despesas', 'Resultado'], ms.map(function (m, i) { return [PC.rotuloMes(m), moeda(rs[i].receitas), moeda(rs[i].despesas), moeda(rs[i].receitas - rs[i].despesas)]; })) };
    },
    'fin-categorias': function () {
      const f = Dados.e.financas; if (!f) return { corpo: '<p class="mudo">Comece em <a href="#/financas">Seven Financeiro</a>.</p>' };
      const mes = hoje().slice(0, 7); const nomes = {}; (f.categorias || []).forEach(function (c) { nomes[c.id] = c.nome; });
      const soma = {}; (f.lancamentos || []).forEach(function (l) { if (l.perfil !== f.perfilAtivo || l.tipo !== 'despesa' || String(l.data).slice(0, 7) !== mes) return; const k = nomes[l.categoria] || 'Sem categoria'; soma[k] = (soma[k] || 0) + Number(l.valor || 0); });
      const it = Object.keys(soma).map(function (k) { return { r: k, v: Math.round(soma[k] * 100) / 100 }; }).sort(function (a, b) { return b.v - a.v; });
      return { link: '#/financas', corpo: graficoComLegenda(G.rosca(it, { fmt: reais, vazio: 'Sem despesas no mês', rotuloCentro: 'no mês' }), G.legenda(G.agruparOutros(it, 6), reais)), tabela: G.tabela(['Categoria', 'Despesa'], it.map(function (x) { return [x.r, moeda(x.v)]; })) };
    },
    'nf-faturamento': function (tam) {
      const ns = (Dados.e.notas || []).filter(function (n) { return n.operacao === 'saida' && n.situacao === 'autorizada'; });
      const s = PC.porMes(ns, function (n) { return n.emissao; }, function (n) { return n.totalNota; }, hoje(), 12);
      return { link: '#/notas', corpo: G.linha(s.map(function (x) { return x.r; }), [{ nome: 'Faturamento', valores: s.map(function (x) { return x.v; }) }], { largura: LARG[tam], fmt: reais, vazio: 'Nenhuma nota autorizada', titulo: 'Faturamento mensal' }), tabela: G.tabela(['Mês', 'Faturado'], s.map(function (x) { return [x.r, moeda(x.v)]; })) };
    },
    loja: function (tam) {
      const ps = ((Dados.e.loja || {}).pedidos || []).filter(function (p) { return p.status !== 'cancelado'; });
      const q = PC.porMes(ps, function (p) { return p.criadoEm; }, null, hoje(), 6); const v = PC.porMes(ps, function (p) { return p.criadoEm; }, function (p) { return p.total; }, hoje(), 6);
      return { link: '#/loja/pedidos', corpo: G.colunas(q.map(function (x, i) { return { r: x.r, v: x.v, dica: x.r + ': ' + x.v + ' pedido(s), ' + moeda(v[i].v) }; }), { largura: LARG[tam], fmt: inteiro, vazio: 'Nenhum pedido nos últimos 6 meses', titulo: 'Pedidos por mês' }), tabela: G.tabela(['Mês', 'Pedidos', 'Valor'], q.map(function (x, i) { return [x.r, x.v, moeda(v[i].v)]; })) };
    },
    agenda: function (tam) {
      const ts = ((Dados.e.agenda || {}).tarefas || []).filter(function (t) { return !t.feita && !t.excluida && t.data; }); const h = hoje(); const dias = PC.proximosDias(h, 7);
      const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
      const it = dias.map(function (d, i) { const n = ts.filter(function (t) { return t.data === d; }).length; return { r: i === 0 ? 'hoje' : SEM[new Date(d + 'T12:00:00').getDay()] + ' ' + d.slice(8), v: n, dica: (i === 0 ? 'Hoje' : d.split('-').reverse().join('/')) + ': ' + n + ' tarefa(s)' }; });
      const atras = ts.filter(function (t) { return t.data < h; }).length;
      return { link: '#/agenda', corpo: (atras ? '<p class="pn-atras"><span aria-hidden="true">⚠</span> ' + atras + ' tarefa(s) atrasada(s)</p>' : '') + G.colunas(it, { largura: LARG[tam], altura: atras ? 170 : 190, fmt: inteiro, vazio: 'Nenhuma tarefa nos próximos 7 dias', titulo: 'Tarefas por dia' }), tabela: G.tabela(['Dia', 'Tarefas'], it.map(function (x) { return [x.r, x.v]; }).concat(atras ? [['atrasadas', atras]] : [])) };
    },
    semanas: function (tam) {
      const s = Dados.e.semanas; const c = s && (s.ciclos || []).find(function (x) { return x.id === s.ativo; }) || (s && (s.ciclos || [])[(s.ciclos || []).length - 1]);
      if (!c) return { corpo: '<p class="mudo">Monte seu plano em <a href="#/semanas">Seven Metas</a>.</p>' };
      const sr = Doze.serie(c);
      return { link: '#/semanas', corpo: G.linha(sr.map(function (x) { return 'S' + x.n; }), [{ nome: 'Execução', valores: sr.map(function (x) { return x.pct; }) }], { largura: LARG[tam], max: 100, ref: 85, refRotulo: 'meta 85%', fmt: function (v) { return Math.round(v) + '%'; }, fmtEixo: function (v) { return v + '%'; }, vazio: 'Pontue a primeira semana', titulo: 'Execução semanal' }), tabela: G.tabela(['Semana', 'Execução'], sr.map(function (x) { return ['S' + x.n, x.pct == null ? '—' : Math.round(x.pct) + '%']; })) };
    },
    atalhos: function () {
      const l = [['#/encontrar', '⌕', 'Seven Edital'], ['#/cadastrar', '✎', 'Seven Proposta'], ['#/disputar', '⚡', 'Seven Pregão'], ['#/monitorar', '◉', 'Seven Sessão'], ['#/comercial', '📈', 'Seven Comercial'], ['#/agenda', '☑', 'Seven Agenda'], ['#/ia', '✳', 'Seven IA'], ['#/habilitacao', '✓', 'Certidões']];
      return { corpo: '<nav class="pn-atalhos">' + l.map(function (x) { return '<a href="' + x[0] + '"><span aria-hidden="true">' + x[1] + '</span>' + x[2] + '</a>'; }).join('') + '</nav>' };
    }
  };

  function blocoHTML(item, i, total) {
    const def = PC.bloco(item.id); let r;
    try { r = B[item.id](item.tam); } catch (x) { console.error(x); r = { corpo: '<p class="mudo">Não foi possível montar este bloco.</p>' }; }
    const verTabela = cfg().tabela[item.id] && r.tabela;
    return '<section class="pn-bloco pn-' + item.tam + (editando ? ' editando' : '') + '" data-id="' + item.id + '"' + (editando ? ' draggable="true"' : '') + ' aria-label="' + esc(def.t) + '">' +
      '<header>' + (editando ? '<span class="pn-alca" title="Arraste para reordenar" aria-hidden="true">⠿</span>' : '') + '<h3>' + esc(def.t) + '</h3><div class="pn-acoes">' +
      (editando ? '<button type="button" class="pn-b" data-pn="esq" aria-label="Mover ' + esc(def.t) + ' para antes"' + (i === 0 ? ' disabled' : '') + '>↑</button><button type="button" class="pn-b" data-pn="dir" aria-label="Mover ' + esc(def.t) + ' para depois"' + (i === total - 1 ? ' disabled' : '') + '>↓</button><button type="button" class="pn-b pn-tam" data-pn="tam" title="Tamanho: pequeno, médio ou largura toda" aria-label="Mudar tamanho de ' + esc(def.t) + '">' + { p: 'P', m: 'M', g: 'G' }[item.tam] + '</button><button type="button" class="pn-b pn-tirar" data-pn="tirar" aria-label="Retirar ' + esc(def.t) + ' do painel">✕</button>'
        : (r.acao || '') + (r.tabela ? '<button type="button" class="pn-b" data-pn="tabela" aria-pressed="' + !!verTabela + '" title="' + (verTabela ? 'Ver gráfico' : 'Ver em tabela') + '">' + (verTabela ? '📊' : '▦') + '</button>' : '') + (r.link ? '<a class="pn-b" href="' + r.link + '" title="Abrir" aria-label="Abrir ' + esc(def.t) + '">↗</a>' : '')) +
      '</div></header><div class="pn-corpo">' + (verTabela ? '<div class="tabela-rolagem">' + r.tabela + '</div>' : r.corpo) + '</div></section>';
  }

  function render(el) {
    const d = Dados.e; const c = cfg(); const emp = Dados.empresaAtiva();
    const dataTxt = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, function (c) { return c.toUpperCase(); });
    el.innerHTML = (!d.empresas.length ? '<div class="boas-vindas cartao"><h2>Bem-vindo à Plataforma 7</h2><ol><li><a href="#/empresas">Cadastre o primeiro cliente (CNPJ)</a></li><li><a href="#/encontrar/catalogos">Monte o catálogo de produtos</a> e <a href="#/encontrar/perfis">o perfil de busca</a></li><li>Capture os avisos do PNCP e envie os bons para o Seven Processo e o Seven Proposta</li></ol><p class="mini">Os dados ficam neste navegador. Faça backup em <a href="#/config">Configurações</a>.</p></div>' : '') +
      '<div class="pn-topo"><div><p class="pn-data">' + esc(dataTxt) + '</p>' + (emp ? '<p class="mini mudo">Cliente ativo: ' + esc(emp.fantasia || emp.razao) + '</p>' : '') + '</div><div class="grupo-botoes">' +
      (editando ? '<button class="btn" data-pn="add">＋ Adicionar bloco</button><button class="btn fantasma" data-pn="padrao">Restaurar padrão</button><button class="btn primario" data-pn="editar">Concluir</button>' : '<button class="btn" data-pn="editar">✎ Personalizar painel</button>') + '</div></div>' +
      (editando ? '<p class="pn-dica-edicao mini">Arraste os blocos pela alça ⠿ (ou use ↑ ↓) para reordenar, troque o tamanho em P/M/G e retire com ✕. As mudanças ficam salvas.</p>' : '') +
      (c.layout.length ? '<div class="pn-grade' + (editando ? ' editando' : '') + '">' + c.layout.map(function (x, i) { return blocoHTML(x, i, c.layout.length); }).join('') + '</div>' : UI.vazio('Painel vazio', 'Adicione os blocos que quer acompanhar.', '<button class="btn primario" data-pn="add">＋ Adicionar bloco</button>')) +
      '<div id="pn-dica" class="pn-dica" role="tooltip" hidden></div>';
    ligar(el);
  }
  function salvarLayout(l) { cfg().layout = l; Dados.salvar(); App.redesenhar(); }

  async function adicionarBlocos() {
    const disp = PC.disponiveis(cfg().layout);
    if (!disp.length) { aviso('Todos os blocos já estão no painel.'); return; }
    const grupos = {}; disp.forEach(function (b) { (grupos[b.g] = grupos[b.g] || []).push(b); });
    const r = await modal({ titulo: 'Adicionar blocos ao painel', largo: true, botao: 'Adicionar', corpo: Object.keys(grupos).map(function (g) { return '<h4>' + esc(g) + '</h4><div class="pn-catalogo">' + grupos[g].map(function (b) { return '<label class="pn-cat"><input type="checkbox" name="b" value="' + b.id + '"><span><b>' + esc(b.t) + '</b><small>' + esc(b.d) + '</small></span></label>'; }).join('') + '</div>'; }).join(''),
      validar: function (fd) { return fd.getAll('b').length ? '' : 'Marque pelo menos um bloco.'; } });
    if (!r) return; let l = cfg().layout; r.getAll('b').forEach(function (id) { l = PC.adicionar(l, id); }); salvarLayout(l); aviso(r.getAll('b').length + ' bloco(s) adicionado(s) ao fim do painel.');
  }

  function ligar(el) {
    const dica = el.querySelector('#pn-dica');
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-pn]'); if (!b) return; const a = b.dataset.pn; const sec = b.closest('[data-id]'); const id = sec && sec.dataset.id;
      if (a === 'editar') { editando = !editando; App.redesenhar(); return; }
      if (a === 'add') { adicionarBlocos(); return; }
      if (a === 'padrao') { if (await confirmar('Restaurar painel', 'Voltar aos blocos e à ordem padrão?', 'Restaurar')) salvarLayout(PC.padrao()); return; }
      if (a === 'tirar') { salvarLayout(PC.remover(cfg().layout, id)); aviso('Bloco retirado. Para trazer de volta, use ＋ Adicionar bloco.'); return; }
      if (a === 'esq' || a === 'dir') { salvarLayout(PC.deslocar(cfg().layout, id, a === 'esq' ? -1 : 1)); const f = document.querySelector('[data-id="' + id + '"] [data-pn="' + a + '"]'); if (f && !f.disabled) f.focus(); return; }
      if (a === 'tam') { const it = cfg().layout.find(function (x) { return x.id === id; }); salvarLayout(PC.redimensionar(cfg().layout, id, PC.proximoTamanho(it.tam))); return; }
      if (a === 'tabela') { cfg().tabela[id] = !cfg().tabela[id]; Dados.salvar(); App.redesenhar(); return; }
      if (a === 'dia') { b.disabled = true; try { await carregarDoDia(el.querySelector('#pn-dia')); } catch (err) { aviso('Falha ao consultar o PNCP: ' + err.message, 'erro'); } App.redesenhar(); }
    };
    // dica dos gráficos
    const mostrar = function (ev) { const t = ev.target.closest && ev.target.closest('[data-dica]'); if (!t) { dica.hidden = true; el.querySelectorAll('.gf-foco').forEach(function (x) { x.classList.remove('gf-foco'); }); return; }
      dica.textContent = t.getAttribute('data-dica'); dica.hidden = false;
      const x = Math.min(window.innerWidth - dica.offsetWidth - 8, ev.clientX + 14); const y = ev.clientY - dica.offsetHeight - 12;
      dica.style.left = Math.max(8, x) + 'px'; dica.style.top = (y < 8 ? ev.clientY + 18 : y) + 'px';
      el.querySelectorAll('.gf-foco').forEach(function (z) { z.classList.remove('gf-foco'); }); t.classList.add('gf-foco'); };
    el.onpointermove = mostrar; el.onpointerleave = function () { dica.hidden = true; };
    if (!editando) return;
    // reordenar arrastando
    el.ondragstart = function (ev) { const s = ev.target.closest && ev.target.closest('.pn-bloco'); if (!s) return; arrastando = s.dataset.id; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', arrastando); s.classList.add('arrastando'); };
    el.ondragend = function () { arrastando = null; el.querySelectorAll('.arrastando, .alvo-antes, .alvo-depois').forEach(function (x) { x.classList.remove('arrastando', 'alvo-antes', 'alvo-depois'); }); };
    el.ondragover = function (ev) {
      const s = ev.target.closest && ev.target.closest('.pn-bloco'); if (!arrastando || !s || s.dataset.id === arrastando) return; ev.preventDefault();
      const r = s.getBoundingClientRect(); const depois = r.width > r.height * 1.6 ? ev.clientX > r.left + r.width / 2 : ev.clientY > r.top + r.height / 2;
      el.querySelectorAll('.alvo-antes, .alvo-depois').forEach(function (x) { x.classList.remove('alvo-antes', 'alvo-depois'); }); s.classList.add(depois ? 'alvo-depois' : 'alvo-antes');
    };
    el.ondrop = function (ev) {
      const s = ev.target.closest && ev.target.closest('.pn-bloco'); if (!arrastando || !s) return; ev.preventDefault();
      const l = cfg().layout; const alvo = l.findIndex(function (x) { return x.id === s.dataset.id; }); const de = l.findIndex(function (x) { return x.id === arrastando; });
      let para = alvo + (s.classList.contains('alvo-depois') ? 1 : 0); if (de < para) para--;
      const id = arrastando; arrastando = null; salvarLayout(PC.mover(l, id, para));
    };
  }

  Telas.painel = { titulo: 'Seven Painel', render: render };
})();
