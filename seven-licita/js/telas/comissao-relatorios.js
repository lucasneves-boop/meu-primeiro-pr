/* Seven Comissão: abas Simulador, Performance do cliente e Relatório do mês, com impressão.
   A performance e o relatório do mês leem o Seven Processo (js/performance.js): cartões, Ganha/Perdida,
   empenhos, notas fiscais e pagamentos da execução. */
(function () {
  'use strict';
  const { esc, moeda, campo, aviso } = UI;
  const T = Telas.comissao, P = Performance, K = Comissao;
  const pc = T.pc, dataBR = T.dataBR;
  const NOMES_FUNIL = {}; K.FUNIL.forEach(function (e) { NOMES_FUNIL[e.id] = e.nome; });

  function nomeEmpresa(id) { const x = id && Dados.empresa ? Dados.empresa(id) : null; return x ? (x.fantasia || x.razao) : (id ? 'Cliente removido' : 'Sem cliente'); }
  function mesAtual() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function nomeMes(aaaamm) { const m = String(aaaamm).split('-'); return new Date(Number(m[0]), Number(m[1]) - 1, 15).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); }
  function prefs() { const d = Dados.e; d.comissaoRel = Object.assign({ cliente: d.empresaAtiva || null, mes: mesAtual() }, d.comissaoRel || {}); return d.comissaoRel; }
  // condições da comissão de cada cliente (padrão: o que está no simulador)
  function cfgCliente(id) {
    const s = T.estado(); const d = Dados.e; d.comissaoClientes = d.comissaoClientes || {};
    const pad = { base: s.base, pct: s.pct, margem: s.margem, retencao: s.retencao, meta: s.alvo, usarFaixas: s.usarFaixas, faixaModo: s.faixaModo, faixas: s.faixas, fixo: s.fixo, parceiros: s.parceiros, diaVenc: '10', fixoDesde: '', autoFinanceiro: false };
    return Object.assign(pad, d.comissaoClientes[id || '_todos'] || {});
  }
  function cfgCalc(c) { return Object.assign(cfgNum(c), T.cfgAvancado(c), { fixoDesde: c.fixoDesde, diaVenc: Nucleo.lerNumeroBR(c.diaVenc || '10'), autoFinanceiro: !!c.autoFinanceiro }); }
  function cfgDe(id) { return cfgCalc(cfgCliente(id)); }
  function cfgNum(c) { const n = function (v) { return v == null || String(v).trim() === '' ? null : Nucleo.lerNumeroBR(v); }; return { base: c.base, pct: n(c.pct), margem: n(c.margem), retencao: n(c.retencao), meta: n(c.meta) }; }
  function textoCfg(c) {
    const x = cfgCalc(c); const fx = x.faixas ? K.lerFaixas(x.faixas) : [];
    const pcTxt = fx.length ? 'faixas ' + fx.map(function (f) { return pc(f.pct) + (f.ate ? ' até ' + moeda(f.ate) : ' acima'); }).join(', ') + (x.faixaModo === 'progressiva' ? ' (progressiva)' : '') : (x.pct != null ? pc(x.pct) : '—');
    const parc = (x.parceiros || []).filter(function (p) { return p.pct > 0; });
    return pcTxt + (x.base === 'lucro' ? ' sobre o lucro líquido (margem ' + (x.margem != null ? pc(x.margem) : '—') + ')' : ' sobre o preço de venda') + (x.retencao ? ', retenção de ' + pc(x.retencao) : '') + (x.fixo ? ' + fixo de ' + moeda(x.fixo) + '/mês' : '') + (parc.length ? ' · parceiros: ' + parc.map(function (p) { return (p.nome || 'Parceiro') + ' ' + pc(p.pct); }).join(', ') : '');
  }
  function imprimir() { Dados.salvar(); setTimeout(function () { window.print(); }, 100); }

  function abas(sub) {
    const a = [['', '🧮 Simulador'], ['performance', '📈 Performance do cliente'], ['mes', '🗓 Relatório do mês'], ['extrato', '💰 Extrato']];
    return '<nav class="abas cm-abas no-print" aria-label="Seven Comissão">' + a.map(function (x) { return '<a href="#/comissao' + (x[0] ? '/' + x[0] : '') + '" class="' + ((sub || '') === x[0] ? 'ativa' : '') + '"' + ((sub || '') === x[0] ? ' aria-current="page"' : '') + '>' + x[1] + '</a>'; }).join('') + '</nav>';
  }
  function cabecalho(titulo, sub) {
    return '<header class="cabecalho-seven cm-cab-rel"><img src="img/plataforma-logo-preta.png" alt="Plataforma 7" class="cm-logo-rel"><div><b>' + esc(titulo) + '</b><small>' + esc(sub) + '</small></div><span class="cm-gerado">Gerado em ' + new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</span></header>';
  }
  function seletorCliente(sel) {
    const es = Dados.e.empresas || [];
    return campo('Cliente', '<select name="cliente"><option value="">Todos os clientes</option>' + es.map(function (x) { return '<option value="' + esc(x.id) + '"' + (sel === x.id ? ' selected' : '') + '>' + esc(x.fantasia || x.razao) + '</option>'; }).join('') + '</select>');
  }
  function formCondicoes(c) {
    return '<div class="cm-base" role="radiogroup" aria-label="Base da comissão">' + ['venda', 'lucro'].map(function (b) { return '<label class="cm-pilula"><input type="radio" name="base" value="' + b + '"' + (c.base === b ? ' checked' : '') + '><span>' + (b === 'venda' ? 'Sobre a venda' : 'Sobre o lucro') + '</span></label>'; }).join('') + '</div>' +
      '<div class="linha">' + campo('Comissão (%)', '<input name="pct" inputmode="decimal" value="' + esc(c.pct || '') + '">') + campo('Margem líquida (%)', '<input name="margem" inputmode="decimal" value="' + esc(c.margem || '') + '">', 'Usada na comissão sobre o lucro.') + campo('Retenção (%)', '<input name="retencao" inputmode="decimal" value="' + esc(c.retencao || '') + '">') + campo('Meta no mês (R$)', '<input name="meta" inputmode="decimal" value="' + esc(c.meta || '') + '">', 'Comissão + mensalidade.') + '</div>' +
      '<details class="cm-avancado"' + (c.usarFaixas || Nucleo.lerNumeroBR(c.fixo || '0') || (c.parceiros || []).length || c.autoFinanceiro ? ' open' : '') + '><summary>Faixas, fixo mensal, parceiros e Seven Financeiro</summary>' + T.editorAvancado(c, true) + '</details>';
  }
  function lerCondicoes(form, id) {
    const fd = new FormData(form); const d = Dados.e; d.comissaoClientes = d.comissaoClientes || {};
    const c = Object.assign({}, cfgCliente(id), { base: fd.get('base') || 'venda', pct: fd.get('pct'), margem: fd.get('margem'), retencao: fd.get('retencao'), meta: fd.get('meta') });
    d.comissaoClientes[id || '_todos'] = T.lerAvancado(form, c);
  }
  function kpis(l) { return '<div class="cm-numeros cm-kpis">' + l.map(function (k) { return '<div class="' + (k[2] || '') + '"><small>' + esc(k[0]) + '</small><b>' + k[1] + '</b></div>'; }).join('') + '</div>'; }
  function barraMeta(valor, meta, rotulo) {
    if (!meta) return '';
    const p = Math.max(0, valor / meta * 100);
    return '<div class="cm-meta"><div class="cm-meta-txt"><span>' + esc(rotulo) + '</span><b>' + moeda(valor) + ' de ' + moeda(meta) + ' (' + pc(p, 0) + ')</b></div><div class="cm-meta-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(Math.min(100, p)) + '"><i style="width:' + Math.min(100, p) + '%"' + (p >= 100 ? ' class="ok"' : '') + '></i></div>' + (p >= 100 ? '<p class="cm-ok mini">Meta alcançada.</p>' : '<p class="mini mudo">Faltam ' + moeda(meta - valor) + '.</p>') + '</div>';
  }
  function tabela(cab, linhas, vazio) {
    if (!linhas.length) return '<p class="mudo mini">' + esc(vazio) + '</p>';
    return '<div class="tabela-rolagem"><table class="tabela compacta"><thead><tr>' + cab.map(function (c) { return '<th' + (c[1] ? ' class="n"' : '') + '>' + esc(c[0]) + '</th>'; }).join('') + '</tr></thead><tbody>' + linhas.join('') + '</tbody></table></div>';
  }
  function linkCartao(c) { return '<a href="#/quadros/' + esc(c.quadroId) + '/' + esc(c.id) + '">' + esc(c.titulo || 'Cartão') + '</a>'; }
  function funilReal(f) {
    const et = K.FUNIL.map(function (e) { return { id: e.id, nome: e.nome, qtd: f[e.id] }; });
    const r = K.funil(et, 'qtd', 1);
    return { calc: r, html: tabela([['Etapa'], ['Quantidade', 1], ['% da etapa anterior', 1], ['% do topo', 1]], r.etapas.map(function (e) { return '<tr><th>' + esc(e.nome) + '</th><td class="n">' + (e.qtd == null ? '—' : e.qtd) + '</td><td class="n">' + (e.conversao == null ? '—' : pc(e.conversao, 1)) + '</td><td class="n">' + (e.doTopo == null ? '—' : pc(e.doTopo, 1)) + '</td></tr>'; }), '') };
  }
  function semDados() { return '<div class="cartao"><p class="mudo">Ainda não há licitações deste cliente no Seven Processo. Os números aparecem aqui à medida que os cartões avançam (proposta, disputa, Ganha/Perdida, contrato, notas e pagamentos).</p><a class="btn" href="#/quadros">Abrir o Seven Processo</a></div>'; }

  // ---------- Performance do cliente ----------
  function telaPerformance(el) {
    const pr = prefs(); const id = pr.cliente || null; const c = cfgCliente(id); const x = cfgCalc(c);
    const m = P.mes(mesAtual()); const r = P.desempenho(Dados.e, Object.assign({ empresaId: id, cfgDe: cfgDe }, m)); const t = r.totais;
    const fr = funilReal(r.funil);
    el.innerHTML = abas('performance') +
      '<form class="cartao cm-rel-form no-print" id="cm-perf-f" autocomplete="off"><div class="linha">' + seletorCliente(id) + '</div><h4>Condições da comissão deste cliente</h4>' + formCondicoes(c) +
      '<div class="grupo-botoes"><button type="button" class="btn primario" data-a="imprimir">🖨 Imprimir relatório</button><button type="button" class="btn" data-a="usar-funil"' + (r.cartoes.length ? '' : ' disabled') + '>Usar este funil no simulador</button><a class="btn fantasma" href="#/comissao/mes">Relatório do mês</a></div></form>' +
      '<div class="cm-relatorio">' + cabecalho('Performance' + (id ? ' · ' + nomeEmpresa(id) : ' · todos os clientes'), 'Comissão: ' + textoCfg(c) + ' · dados do Seven Processo') +
      (r.cartoes.length ? kpis([
        ['Licitações acompanhadas', t.oportunidades], ['Em andamento', t.emAndamento], ['Ganhas', t.ganhas, 'ok'], ['Perdidas', t.perdidas, t.perdidas ? 'ruim' : ''],
        ['Taxa de sucesso', t.taxaSucesso == null ? '—' : pc(t.taxaSucesso, 1)], ['Valor ganho', moeda(t.valorGanho)], ['Faturado', moeda(t.faturado)], ['Recebido', moeda(t.recebido), 'ok'],
        ['A receber', moeda(t.aReceber)], ['Em atraso', moeda(t.atrasado), t.atrasado ? 'ruim' : ''], ['Comissão prevista (ganhos)', moeda(t.comissaoPrevista)], ['Comissão sobre o recebido', moeda(t.comissaoRecebida), 'ok']
      ].concat(r.periodo.fixo ? [['Mensalidade do BPO', moeda(r.periodo.fixo)]] : [])) + barraMeta(r.periodo.total || 0, x.meta, nomeMes(mesAtual()) + ': comissão sobre o recebido no mês' + (r.periodo.fixo ? ' + mensalidade' : '')) +
      '<section class="cartao"><h3>Funil real</h3>' + fr.html + (fr.calc.taxaDisputa != null ? '<p class="mini">Taxa de sucesso por disputa: <b>' + pc(fr.calc.taxaDisputa, 1) + '</b>' + (fr.calc.gargalo ? ' · maior perda em <b>' + esc(fr.calc.gargalo.nome) + '</b>' : '') + '.</p>' : '') + '<p class="mini mudo">Contagem pelos cartões do Seven Processo: cada cartão conta em todas as etapas que já passou; Perdida conta até a disputa.</p></section>' +
      '<section class="cartao"><h3>Contratos ganhos</h3>' + tabela([['Licitação'], ['Órgão'], ['Etapa'], ['Valor', 1], ['Faturado', 1], ['Recebido', 1], ['A receber', 1], ['Comissão', 1]], r.contratos.map(function (k) { return '<tr><td>' + linkCartao(k) + '</td><td>' + esc(k.orgao) + '</td><td>' + esc(k.lista) + '</td><td class="n">' + moeda(k.valor) + '</td><td class="n">' + moeda(k.faturado) + '</td><td class="n">' + moeda(k.recebido) + '</td><td class="n">' + moeda(k.aReceber) + '</td><td class="n">' + moeda(k.comissao) + '</td></tr>'; }), 'Nenhuma licitação ganha ainda.') + '</section>' +
      '<section class="cartao"><h3>Em andamento</h3>' + tabela([['Licitação'], ['Órgão'], ['Etapa'], ['Valor estimado', 1]], r.emDisputa.map(function (k) { return '<tr><td>' + linkCartao(k) + '</td><td>' + esc(k.orgao) + '</td><td>' + esc(k.lista) + '</td><td class="n">' + moeda(k.valor) + '</td></tr>'; }), 'Nada em andamento.') + '</section>' +
      '<section class="cartao"><h3>Próximos recebimentos</h3>' + tabela([['Vencimento'], ['NF'], ['Licitação'], ['Em aberto', 1], ['Comissão', 1]], r.proximos.map(function (n) { return '<tr' + (n.atrasada ? ' class="cm-atrasada"' : '') + '><td>' + (n.vencimento ? dataBR(n.vencimento) : '—') + (n.atrasada ? ' <span class="tag vermelho">atrasada</span>' : '') + '</td><td>' + esc(n.numero || '') + '</td><td>' + esc(n.cartao) + '</td><td class="n">' + moeda(n.aberto) + '</td><td class="n">' + moeda(n.comissao) + '</td></tr>'; }), 'Nenhuma nota fiscal em aberto.') + '</section>' +
      (!id && r.porCliente.length > 1 ? '<section class="cartao"><h3>Por cliente</h3>' + tabela([['Cliente'], ['Licitações', 1], ['Ganhas', 1], ['Perdidas', 1], ['Taxa', 1], ['Valor ganho', 1], ['Recebido', 1], ['Comissão', 1]], r.porCliente.map(function (k) { return '<tr><td>' + esc(nomeEmpresa(k.empresaId)) + '</td><td class="n">' + k.oportunidades + '</td><td class="n">' + k.ganhas + '</td><td class="n">' + k.perdidas + '</td><td class="n">' + (k.taxaSucesso == null ? '—' : pc(k.taxaSucesso, 0)) + '</td><td class="n">' + moeda(k.valorGanho) + '</td><td class="n">' + moeda(k.recebido) + '</td><td class="n">' + moeda(k.comissao) + '</td></tr>'; }), '') + '</section>' : '') : semDados()) + '</div>';
    ligarRel(el, id, function () {
      const k = Dados.e.comissao = T.estado(); k.funil = Object.assign({}, k.funil, { modo: 'qtd', qtd: Object.assign({}, r.funil) }); Dados.salvar(); aviso('Funil real levado para o simulador (modo quantidades).'); location.hash = '#/comissao';
    });
  }

  // ---------- Relatório do mês ----------
  function telaMes(el) {
    const pr = prefs(); const id = pr.cliente || null; const c = cfgCliente(id); const x = cfgCalc(c); const mm = /^\d{4}-\d{2}$/.test(pr.mes) ? pr.mes : mesAtual();
    const r = P.desempenho(Dados.e, Object.assign({ empresaId: id, cfgDe: cfgDe }, P.mes(mm))); const p = r.periodo;
    el.innerHTML = abas('mes') +
      '<form class="cartao cm-rel-form no-print" id="cm-mes-f" autocomplete="off"><div class="linha">' + campo('Mês', '<input type="month" name="mes" value="' + esc(mm) + '">') + seletorCliente(id) + '</div><details><summary>Condições da comissão</summary>' + formCondicoes(c) + '</details>' +
      '<div class="grupo-botoes"><button type="button" class="btn primario" data-a="imprimir">🖨 Imprimir relatório do mês</button><button type="button" class="btn" data-a="enviar-whatsapp"' + (id ? '' : ' disabled title="Escolha um cliente"') + '>WhatsApp</button><button type="button" class="btn" data-a="enviar-email"' + (id ? '' : ' disabled title="Escolha um cliente"') + '>E-mail</button><a class="btn fantasma" href="#/comissao/performance">Performance completa</a></div></form>' +
      '<div class="cm-relatorio">' + cabecalho('Relatório de ' + nomeMes(mm) + (id ? ' · ' + nomeEmpresa(id) : ' · todos os clientes'), 'Comissão: ' + textoCfg(c) + ' · dados do Seven Processo') +
      kpis([['Novas oportunidades', p.novas.length], ['Ganhas no mês', p.ganhas.length, 'ok'], ['Perdidas no mês', p.perdidas.length, p.perdidas.length ? 'ruim' : ''], ['Taxa de sucesso no mês', p.taxaSucesso == null ? '—' : pc(p.taxaSucesso, 1)], ['Valor ganho no mês', moeda(p.valorGanho)], ['Faturado no mês', moeda(p.faturado)], ['Recebido no mês', moeda(p.recebido), 'ok'], ['Comissão do mês (sobre o recebido)', moeda(p.comissao), 'ok'], ['Comissão gerada pelos ganhos', moeda(p.comissaoGanhos)], ['A receber (total)', moeda(r.totais.aReceber)]].concat(p.fixo ? [['Mensalidade do BPO', moeda(p.fixo)], ['Total do mês (comissão + mensalidade)', moeda(p.total), 'ok']] : [])) +
      barraMeta(p.total, x.meta, 'Meta do mês' + (p.fixo ? ' (comissão + mensalidade)' : '')) +
      '<section class="cartao"><h3>Licitações ganhas no mês</h3>' + tabela([['Data'], ['Licitação'], ['Órgão'], ['Valor', 1], ['Comissão', 1]], p.ganhas.map(function (k) { return '<tr><td>' + dataBR(k.dataGanho) + '</td><td>' + linkCartao(k) + '</td><td>' + esc(k.orgao) + '</td><td class="n">' + moeda(k.valor) + '</td><td class="n">' + moeda(k.comissao) + '</td></tr>'; }), 'Nenhuma licitação ganha neste mês.') + '</section>' +
      '<section class="cartao"><h3>Não vencidas no mês</h3>' + tabela([['Data'], ['Licitação'], ['Órgão'], ['Valor estimado', 1]], p.perdidas.map(function (k) { return '<tr><td>' + dataBR(k.dataPerda) + '</td><td>' + linkCartao(k) + '</td><td>' + esc(k.orgao) + '</td><td class="n">' + moeda(k.valor) + '</td></tr>'; }), 'Nenhuma.') + '</section>' +
      '<section class="cartao"><h3>Notas fiscais emitidas</h3>' + tabela([['Emissão'], ['NF'], ['Licitação'], ['Valor', 1], ['Vencimento']], p.notas.map(function (n) { return '<tr><td>' + dataBR(n.data) + '</td><td>' + esc(n.numero || '') + '</td><td>' + esc(n.cartao) + '</td><td class="n">' + moeda(n.valor) + '</td><td>' + (n.vencimento ? dataBR(n.vencimento) : '—') + '</td></tr>'; }), 'Nenhuma nota fiscal emitida neste mês.') + '</section>' +
      '<section class="cartao"><h3>Pagamentos recebidos</h3>' + tabela([['Data'], ['Licitação'], ['Valor recebido', 1], ['Comissão', 1]], p.pagamentos.map(function (g) { return '<tr><td>' + dataBR(g.data) + '</td><td>' + esc(g.cartao) + '</td><td class="n">' + moeda(g.valor) + '</td><td class="n">' + moeda(g.comissao) + '</td></tr>'; }).concat(p.pagamentos.length ? ['<tr class="cm-total"><th colspan="2">Total</th><td class="n">' + moeda(p.recebido) + '</td><td class="n">' + moeda(p.comissao) + '</td></tr>'] : []), 'Nenhum pagamento recebido neste mês.') + '</section>' +
      '<section class="cartao"><h3>Próximos recebimentos</h3>' + tabela([['Vencimento'], ['NF'], ['Licitação'], ['Em aberto', 1], ['Comissão', 1]], r.proximos.slice(0, 15).map(function (n) { return '<tr' + (n.atrasada ? ' class="cm-atrasada"' : '') + '><td>' + (n.vencimento ? dataBR(n.vencimento) : '—') + (n.atrasada ? ' <span class="tag vermelho">atrasada</span>' : '') + '</td><td>' + esc(n.numero || '') + '</td><td>' + esc(n.cartao) + '</td><td class="n">' + moeda(n.aberto) + '</td><td class="n">' + moeda(n.comissao) + '</td></tr>'; }), 'Nenhuma nota fiscal em aberto.') + '</section></div>';
    ligarRel(el, id, null, function (via) { enviarResumo(via, id, mm, r, x); });
  }

  function ligarRel(el, id, usarFunil, enviar) {
    const f = el.querySelector('.cm-rel-form');
    f.onchange = function (ev) {
      const nm = ev.target.name; const pr = prefs();
      if (nm === 'cliente') { pr.cliente = ev.target.value || null; Dados.salvar(); App.redesenhar(); return; }
      if (nm === 'mes') { pr.mes = ev.target.value || mesAtual(); Dados.salvar(); App.redesenhar(); return; }
      lerCondicoes(f, id); Dados.salvar(); App.redesenhar();
      const foco = el.querySelector('.cm-rel-form [name="' + nm + '"]'); if (foco && foco.type !== 'radio') foco.focus();
    };
    f.onsubmit = function (ev) { ev.preventDefault(); };
    el.onclick = function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (T.acaoAvancado(Object.assign(cfgCliente(id), {}), a, b.dataset.i)) { const d = Dados.e; d.comissaoClientes = d.comissaoClientes || {}; const c = cfgCliente(id); T.acaoAvancado(c, a, b.dataset.i); d.comissaoClientes[id || '_todos'] = c; Dados.salvar(); App.redesenhar(); return; }
      if (a === 'imprimir') imprimir(); if (a === 'usar-funil' && usarFunil) usarFunil();
      if ((a === 'enviar-whatsapp' || a === 'enviar-email') && enviar) enviar(a === 'enviar-whatsapp' ? 'whatsapp' : 'email');
    };
  }

  // ---------- envio do resumo do mês (o texto abre para revisão; quem envia é você) ----------
  function textoResumo(id, mm, r, x) {
    const p = r.periodo; const emp = Dados.empresa(id) || {}; const quem = (emp.representante || emp.fantasia || emp.razao || '').split(' ')[0];
    const l = ['Olá' + (quem ? ', ' + quem : '') + '! Segue o resumo de ' + nomeMes(mm) + ' das suas licitações:', '',
      '• Novas oportunidades: ' + p.novas.length,
      '• Ganhas: ' + p.ganhas.length + (p.valorGanho ? ' (' + moeda(p.valorGanho) + ')' : '') + ' · Não vencidas: ' + p.perdidas.length,
      '• Taxa de sucesso no mês: ' + (p.taxaSucesso == null ? '—' : pc(p.taxaSucesso, 0)),
      '• Faturado: ' + moeda(p.faturado) + ' · Recebido: ' + moeda(p.recebido),
      '• A receber: ' + moeda(r.totais.aReceber) + (r.totais.atrasado ? ' (em atraso: ' + moeda(r.totais.atrasado) + ')' : '')];
    p.ganhas.slice(0, 5).forEach(function (k) { l.push('   ✓ ' + k.titulo + (k.orgao ? ' · ' + k.orgao : '') + ' · ' + moeda(k.valor)); });
    const prox = r.proximos.filter(function (n) { return !n.atrasada; }).slice(0, 3);
    if (prox.length) { l.push('', 'Próximos recebimentos:'); prox.forEach(function (n) { l.push('• NF ' + (n.numero || '') + ' · ' + moeda(n.aberto) + (n.vencimento ? ' · ' + dataBR(n.vencimento) : '')); }); }
    l.push('', 'Comissão do mês: ' + moeda(p.comissao) + (p.fixo ? ' + mensalidade ' + moeda(p.fixo) + ' = ' + moeda(p.total) : '') + '.');
    l.push('', 'Qualquer dúvida, estou à disposição.', '', 'Lucas Neves | Seven', '(61) 98347-2232');
    return l.join('\n');
  }
  async function enviarResumo(via, id, mm, r, x) {
    const emp = Dados.empresa(id) || {};
    const f = await UI.modal({ titulo: via === 'whatsapp' ? 'Enviar resumo por WhatsApp' : 'Enviar resumo por e-mail', largo: true, botao: via === 'whatsapp' ? 'Abrir WhatsApp' : 'Abrir e-mail',
      corpo: '<p class="mini mudo">Revise o texto antes de enviar. O sistema só abre o ' + (via === 'whatsapp' ? 'WhatsApp' : 'e-mail') + ' com a mensagem pronta; o envio é feito por você. Para mandar o relatório em PDF, use Imprimir → Salvar como PDF e anexe.</p>' +
        (via === 'whatsapp' ? campo('WhatsApp (com DDD)', '<input name="dest" inputmode="tel" value="' + esc(emp.telefone || '') + '">', 'Em branco: o WhatsApp abre para você escolher o contato.') : campo('E-mail do cliente', '<input name="dest" type="email" value="' + esc(emp.email || '') + '">')) +
        campo('Mensagem', '<textarea name="t" rows="16">' + esc(textoResumo(id, mm, r, x)) + '</textarea>') });
    if (!f) return; const txt = f.get('t'), dest = String(f.get('dest') || '').trim();
    if (via === 'whatsapp') { let nn = dest.replace(/\D/g, ''); if (nn && nn.length <= 11) nn = '55' + nn; window.open('https://wa.me/' + nn + '?text=' + encodeURIComponent(txt), '_blank', 'noopener'); }
    else location.href = 'mailto:' + encodeURIComponent(dest) + '?subject=' + encodeURIComponent('Resumo de ' + nomeMes(mm) + ' · Seven') + '&body=' + encodeURIComponent(txt);
  }

  // ---------- extrato de comissões e Seven Financeiro ----------
  const ST = { 'a cobrar': ['A cobrar', 'amarelo'], cobrada: ['Cobrada', 'azul'], recebida: ['Recebida', 'verde'] };
  function lancs() { return ((Dados.e.financas || {}).lancamentos) || []; }
  function extratoDe(id) { return P.extrato(Dados.e, { empresaId: id, cfgDe: cfgDe, registros: Dados.e.comissaoExtrato || {}, lancamentos: lancs() }); }
  function lancarCobranca(it, semSalvar) {
    if (!Telas.financas || !Telas.financas.lancar || !(it.valor > 0)) return false;
    Telas.financas.lancar([{ tipo: 'receita', descricao: it.descricao + ' — ' + nomeEmpresa(it.empresaId), valor: it.valor, data: it.data, categoria: 'Honorários', origem: 'comissao:' + it.chave, contato: nomeEmpresa(it.empresaId) }], { semSalvar: true });
    if (!semSalvar) Dados.salvar(); return true;
  }
  function lancarRepasses(it) {
    let n = 0; it.repasses.forEach(function (rp, i) { if (rp.status !== 'pendente' || !(rp.valor > 0)) return; Telas.financas.lancar([{ tipo: 'despesa', descricao: 'Repasse a ' + rp.nome + ' · ' + it.descricao, valor: rp.valor, data: T.hoje(), categoria: 'Repasse', origem: 'repasse:' + it.chave + ':' + i, contato: rp.nome }], { semSalvar: true }); n++; });
    return n;
  }
  // automático: ao salvar, clientes com "Lançar automaticamente" ganham as cobranças e os repasses que faltam
  let sincronizando = false;
  Dados.antesDeSalvar(function () {
    if (sincronizando || !Telas.financas || !Telas.financas.lancar) return; const cc = Dados.e.comissaoClientes || {};
    const ids = Object.keys(cc).filter(function (k) { return k !== '_todos' && cc[k] && cc[k].autoFinanceiro; }); if (!ids.length) return;
    sincronizando = true;
    try { const hoje = T.hoje(); ids.forEach(function (id) { extratoDe(id).itens.forEach(function (it) { if (it.status === 'a cobrar' && it.data <= hoje) lancarCobranca(it, true); else if (it.status === 'recebida') lancarRepasses(it); }); }); }
    catch (err) { console.warn('Comissão → Financeiro:', err); } finally { sincronizando = false; }
  });
  function telaExtrato(el) {
    const pr = prefs(); const id = pr.cliente || null; const c = cfgCliente(id); const x = extratoDe(id);
    el.innerHTML = abas('extrato') +
      '<form class="cartao cm-rel-form no-print" id="cm-ext-f" autocomplete="off"><div class="linha">' + seletorCliente(id) + '</div>' +
      '<p class="mini mudo">Cada pagamento do órgão registrado na execução do Seven Processo gera a comissão' + (id ? ' (' + esc(textoCfg(c)) + ')' : ' (condições de cada cliente)') + '. A situação acompanha o Seven Financeiro: lançada = cobrada; baixada como paga = recebida.' + (id && c.autoFinanceiro ? ' <b>Lançamento automático ligado para este cliente.</b>' : ' Ligue o lançamento automático nas condições do cliente, na aba Performance.') + '</p>' +
      '<div class="grupo-botoes"><button type="button" class="btn primario" data-a="lancar-todas"' + (x.aCobrar ? '' : ' disabled') + '>Lançar todas as pendentes no Seven Financeiro</button><button type="button" class="btn" data-a="imprimir">🖨 Imprimir extrato</button><a class="btn fantasma" href="#/financas">Abrir o Seven Financeiro</a></div></form>' +
      '<div class="cm-relatorio">' + cabecalho('Extrato de comissões' + (id ? ' · ' + nomeEmpresa(id) : ' · todos os clientes'), id ? 'Comissão: ' + textoCfg(c) : 'Condições de cada cliente') +
      kpis([['Gerada', moeda(x.gerada)], ['A cobrar', moeda(x.aCobrar), x.aCobrar ? 'ruim' : ''], ['Cobrada', moeda(x.cobrada)], ['Recebida', moeda(x.recebida), 'ok'], ['Repasses a parceiros', moeda(x.repasses)]]) +
      '<section class="cartao"><h3>Lançamentos</h3>' + tabela([['Data'], ['Descrição'], ['Cliente'], ['Pagamento do órgão', 1], ['Comissão', 1], ['Repasses'], ['Situação'], ['']], x.itens.map(function (it) {
        const st = ST[it.status];
        return '<tr data-ch="' + esc(it.chave) + '"><td>' + dataBR(it.data) + '</td><td>' + esc(it.descricao) + '</td><td>' + esc(nomeEmpresa(it.empresaId)) + '</td><td class="n">' + (it.base == null ? '—' : moeda(it.base)) + '</td><td class="n">' + moeda(it.valor) + '</td><td class="mini">' + (it.repasses.length ? it.repasses.map(function (rp) { return esc(rp.nome) + ' ' + moeda(rp.valor) + ' (' + rp.status + ')'; }).join('<br>') : '—') + '</td><td><span class="tag ' + st[1] + '">' + st[0] + '</span></td><td class="no-print">' +
          (it.status === 'a cobrar' ? '<button type="button" class="btn mini" data-a="lancar" data-ch="' + esc(it.chave) + '">Lançar</button><button type="button" class="btn mini fantasma" data-a="recebida" data-ch="' + esc(it.chave) + '" title="Marcar como recebida sem lançar no Seven Financeiro">Recebida</button>' : '') +
          (it.status === 'recebida' && it.repasses.some(function (rp) { return rp.status === 'pendente'; }) ? '<button type="button" class="btn mini" data-a="repasses" data-ch="' + esc(it.chave) + '">Lançar repasses</button>' : '') + '</td></tr>';
      }), 'Nenhuma comissão ainda: ela aparece quando um pagamento é registrado na execução de uma licitação ganha, ou quando há mensalidade configurada.') + '</section></div>';
    const f = el.querySelector('#cm-ext-f');
    f.onchange = function (ev) { if (ev.target.name === 'cliente') { prefs().cliente = ev.target.value || null; Dados.salvar(); App.redesenhar(); } };
    f.onsubmit = function (ev) { ev.preventDefault(); };
    el.onclick = function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; const it = x.itens.find(function (i) { return i.chave === b.dataset.ch; });
      if (a === 'imprimir') imprimir();
      if (a === 'lancar' && it) { lancarCobranca(it); aviso('Cobrança lançada no Seven Financeiro (contas a receber).'); App.redesenhar(); }
      if (a === 'lancar-todas') { let nn = 0; x.itens.forEach(function (i) { if (i.status === 'a cobrar' && lancarCobranca(i, true)) nn++; }); Dados.salvar(); aviso(nn + ' cobrança(s) lançada(s) no Seven Financeiro.'); App.redesenhar(); }
      if (a === 'recebida' && it) { const d = Dados.e; d.comissaoExtrato = d.comissaoExtrato || {}; d.comissaoExtrato[it.chave] = { status: 'recebida', em: T.hoje() }; Dados.salvar(); App.redesenhar(); }
      if (a === 'repasses' && it) { const nn = lancarRepasses(it); Dados.salvar(); aviso(nn + ' repasse(s) lançado(s) em contas a pagar.'); App.redesenhar(); }
    };
  }

  // ---------- Relatório completo da simulação (para imprimir) ----------
  function telaRelatorioSimulacao(el) {
    const s = T.estado(); const e = T.entrada(s); const r = K.calcular(e); const fu = T.calcFunil(s);
    const dados = [['Base da comissão', s.base === 'lucro' ? 'Sobre o lucro líquido' : 'Sobre o preço de venda'], ['Comissão', e.pct == null ? '—' : pc(e.pct)], ['Valor da venda / contrato', moeda(e.venda)], ['Margem de lucro líquido', e.margem == null ? '—' : pc(e.margem, 2) + (s.usarCustos ? ' (calculada pelos custos)' : '')], ['Meta (quanto quero receber)', moeda(e.alvo)], ['Retenções sobre a comissão', e.retencao ? pc(e.retencao) : '—'], ['Nº de licitações', e.contratos || 1]].concat(s.usarFaixas ? [['Faixas', esc(K.lerFaixas(e.faixas).map(function (f) { return pc(f.pct) + (f.ate ? ' até ' + moeda(f.ate) : ' acima'); }).join(', ')) + (s.faixaModo === 'progressiva' ? ' (progressiva)' : '')]] : []).concat(e.fixo ? [['Fixo mensal', moeda(e.fixo)]] : []).concat((e.parceiros || []).filter(function (p) { return p.pct > 0; }).map(function (p) { return ['Parceiro: ' + esc(p.nome || '—'), pc(p.pct) + ' da comissão']; }));
    const empresa = Dados.empresaAtiva && Dados.empresaAtiva();
    el.innerHTML = abas('') + '<div class="nf-barra no-print"><a href="#/comissao">‹ Voltar ao simulador</a><span style="flex:1"></span><button class="btn primario" data-a="imprimir">🖨 Imprimir</button></div>' +
      '<div class="cm-relatorio cm-rel-sim">' + cabecalho('Simulação de comissão', (empresa ? (empresa.fantasia || empresa.razao) + ' · ' : '') + 'Seven Comissão') +
      '<div class="cm-rel-2"><section class="cartao"><h3>Dados</h3><dl class="cl-res">' + dados.map(function (d) { return '<div><dt>' + esc(d[0]) + '</dt><dd>' + d[1] + '</dd></div>'; }).join('') + '</dl></section><section class="cartao"><h3>Resultado</h3>' + T.resumo(r, false) + '</section></div>' +
      '<section class="cartao"><h3>Funil das licitações</h3>' + tabela([['Etapa'], ['% do anterior', 1], ['% do topo', 1], ['Esperado com ' + (fu.base == null ? '—' : fu.base) + ' editais', 1], ['Para ' + fu.contratos + ' contrato(s)', 1]], fu.etapas.map(function (k) { return '<tr><th>' + esc(k.nome) + '</th><td class="n">' + (k.conversao == null ? '—' : pc(k.conversao, 1)) + '</td><td class="n">' + (k.doTopo == null ? '—' : pc(k.doTopo, 2)) + '</td><td class="n">' + (k.esperados == null ? '—' : k.esperados.toLocaleString('pt-BR', { maximumFractionDigits: 1 })) + '</td><td class="n">' + (k.necessarios == null ? '—' : k.necessarios) + '</td></tr>'; }), '') + (fu.taxaDisputa != null ? '<p class="mini">Taxa de sucesso por disputa: <b>' + pc(fu.taxaDisputa, 2) + '</b>.</p>' : '') + '</section>' +
      T.secoesExtras(s) + T.tabelaCenarios(s) + '</div>';
    el.onclick = function (ev) { const b = ev.target.closest('[data-a]'); if (b && b.dataset.a === 'imprimir') imprimir(); };
  }

  T.render = function (el, sub) {
    if (sub === 'performance') return telaPerformance(el);
    if (sub === 'mes') return telaMes(el);
    if (sub === 'extrato') return telaExtrato(el);
    if (sub === 'relatorio') return telaRelatorioSimulacao(el);
    el.innerHTML = abas('') + '<div id="cm-sim"></div>';
    const box = el.querySelector('#cm-sim'); T.simulador(box);
    const g = box.querySelector('#cm-form .grupo-botoes'); if (g) g.insertAdjacentHTML('afterbegin', '<a class="btn mini primario" href="#/comissao/relatorio">🖨 Relatório completo</a>');
  };
})();
