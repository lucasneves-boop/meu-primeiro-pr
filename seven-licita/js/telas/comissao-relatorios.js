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
    const pad = { base: s.base, pct: s.pct, margem: s.margem, retencao: s.retencao, meta: s.alvo };
    return Object.assign(pad, d.comissaoClientes[id || '_todos'] || {});
  }
  function cfgNum(c) { const n = function (v) { return v == null || String(v).trim() === '' ? null : Nucleo.lerNumeroBR(v); }; return { base: c.base, pct: n(c.pct), margem: n(c.margem), retencao: n(c.retencao), meta: n(c.meta) }; }
  function textoCfg(c) { const x = cfgNum(c); return (x.pct != null ? pc(x.pct) : '—') + (x.base === 'lucro' ? ' sobre o lucro líquido (margem ' + (x.margem != null ? pc(x.margem) : '—') + ')' : ' sobre o preço de venda') + (x.retencao ? ', retenção de ' + pc(x.retencao) : ''); }
  function imprimir() { Dados.salvar(); setTimeout(function () { window.print(); }, 100); }

  function abas(sub) {
    const a = [['', '🧮 Simulador'], ['performance', '📈 Performance do cliente'], ['mes', '🗓 Relatório do mês']];
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
      '<div class="linha">' + campo('Comissão (%)', '<input name="pct" inputmode="decimal" value="' + esc(c.pct || '') + '">') + campo('Margem líquida (%)', '<input name="margem" inputmode="decimal" value="' + esc(c.margem || '') + '">', 'Usada na comissão sobre o lucro.') + campo('Retenção (%)', '<input name="retencao" inputmode="decimal" value="' + esc(c.retencao || '') + '">') + campo('Meta de comissão no mês (R$)', '<input name="meta" inputmode="decimal" value="' + esc(c.meta || '') + '">') + '</div>';
  }
  function lerCondicoes(form, id) {
    const fd = new FormData(form); const d = Dados.e; d.comissaoClientes = d.comissaoClientes || {};
    d.comissaoClientes[id || '_todos'] = { base: fd.get('base') || 'venda', pct: fd.get('pct'), margem: fd.get('margem'), retencao: fd.get('retencao'), meta: fd.get('meta') };
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
    const pr = prefs(); const id = pr.cliente || null; const c = cfgCliente(id); const x = cfgNum(c);
    const m = P.mes(mesAtual()); const r = P.desempenho(Dados.e, Object.assign({ empresaId: id, cfg: x }, m)); const t = r.totais;
    const fr = funilReal(r.funil);
    el.innerHTML = abas('performance') +
      '<form class="cartao cm-rel-form no-print" id="cm-perf-f" autocomplete="off"><div class="linha">' + seletorCliente(id) + '</div><h4>Condições da comissão deste cliente</h4>' + formCondicoes(c) +
      '<div class="grupo-botoes"><button type="button" class="btn primario" data-a="imprimir">🖨 Imprimir relatório</button><button type="button" class="btn" data-a="usar-funil"' + (r.cartoes.length ? '' : ' disabled') + '>Usar este funil no simulador</button><a class="btn fantasma" href="#/comissao/mes">Relatório do mês</a></div></form>' +
      '<div class="cm-relatorio">' + cabecalho('Performance' + (id ? ' · ' + nomeEmpresa(id) : ' · todos os clientes'), 'Comissão: ' + textoCfg(c) + ' · dados do Seven Processo') +
      (r.cartoes.length ? kpis([
        ['Licitações acompanhadas', t.oportunidades], ['Em andamento', t.emAndamento], ['Ganhas', t.ganhas, 'ok'], ['Perdidas', t.perdidas, t.perdidas ? 'ruim' : ''],
        ['Taxa de sucesso', t.taxaSucesso == null ? '—' : pc(t.taxaSucesso, 1)], ['Valor ganho', moeda(t.valorGanho)], ['Faturado', moeda(t.faturado)], ['Recebido', moeda(t.recebido), 'ok'],
        ['A receber', moeda(t.aReceber)], ['Em atraso', moeda(t.atrasado), t.atrasado ? 'ruim' : ''], ['Comissão prevista (ganhos)', moeda(t.comissaoPrevista)], ['Comissão sobre o recebido', moeda(t.comissaoRecebida), 'ok']
      ]) + barraMeta(r.periodo.comissao || 0, x.meta, 'Comissão de ' + nomeMes(mesAtual()) + ' (sobre o recebido no mês)') +
      '<section class="cartao"><h3>Funil real</h3>' + fr.html + (fr.calc.taxaDisputa != null ? '<p class="mini">Taxa de sucesso por disputa: <b>' + pc(fr.calc.taxaDisputa, 1) + '</b>' + (fr.calc.gargalo ? ' · maior perda em <b>' + esc(fr.calc.gargalo.nome) + '</b>' : '') + '.</p>' : '') + '<p class="mini mudo">Contagem pelos cartões do Seven Processo: cada cartão conta em todas as etapas que já passou; Perdida conta até a disputa.</p></section>' +
      '<section class="cartao"><h3>Contratos ganhos</h3>' + tabela([['Licitação'], ['Órgão'], ['Etapa'], ['Valor', 1], ['Faturado', 1], ['Recebido', 1], ['A receber', 1], ['Comissão', 1]], r.contratos.map(function (k) { return '<tr><td>' + linkCartao(k) + '</td><td>' + esc(k.orgao) + '</td><td>' + esc(k.lista) + '</td><td class="n">' + moeda(k.valor) + '</td><td class="n">' + moeda(k.faturado) + '</td><td class="n">' + moeda(k.recebido) + '</td><td class="n">' + moeda(k.aReceber) + '</td><td class="n">' + moeda(k.valor * r.fator) + '</td></tr>'; }), 'Nenhuma licitação ganha ainda.') + '</section>' +
      '<section class="cartao"><h3>Em andamento</h3>' + tabela([['Licitação'], ['Órgão'], ['Etapa'], ['Valor estimado', 1]], r.emDisputa.map(function (k) { return '<tr><td>' + linkCartao(k) + '</td><td>' + esc(k.orgao) + '</td><td>' + esc(k.lista) + '</td><td class="n">' + moeda(k.valor) + '</td></tr>'; }), 'Nada em andamento.') + '</section>' +
      '<section class="cartao"><h3>Próximos recebimentos</h3>' + tabela([['Vencimento'], ['NF'], ['Licitação'], ['Em aberto', 1], ['Comissão', 1]], r.proximos.map(function (n) { return '<tr' + (n.atrasada ? ' class="cm-atrasada"' : '') + '><td>' + (n.vencimento ? dataBR(n.vencimento) : '—') + (n.atrasada ? ' <span class="tag vermelho">atrasada</span>' : '') + '</td><td>' + esc(n.numero || '') + '</td><td>' + esc(n.cartao) + '</td><td class="n">' + moeda(n.aberto) + '</td><td class="n">' + moeda(n.aberto * r.fator) + '</td></tr>'; }), 'Nenhuma nota fiscal em aberto.') + '</section>' +
      (!id && r.porCliente.length > 1 ? '<section class="cartao"><h3>Por cliente</h3>' + tabela([['Cliente'], ['Licitações', 1], ['Ganhas', 1], ['Perdidas', 1], ['Taxa', 1], ['Valor ganho', 1], ['Recebido', 1], ['Comissão', 1]], r.porCliente.map(function (k) { return '<tr><td>' + esc(nomeEmpresa(k.empresaId)) + '</td><td class="n">' + k.oportunidades + '</td><td class="n">' + k.ganhas + '</td><td class="n">' + k.perdidas + '</td><td class="n">' + (k.taxaSucesso == null ? '—' : pc(k.taxaSucesso, 0)) + '</td><td class="n">' + moeda(k.valorGanho) + '</td><td class="n">' + moeda(k.recebido) + '</td><td class="n">' + moeda(k.comissao) + '</td></tr>'; }), '') + '</section>' : '') : semDados()) + '</div>';
    ligarRel(el, id, function () {
      const k = Dados.e.comissao = T.estado(); k.funil = Object.assign({}, k.funil, { modo: 'qtd', qtd: Object.assign({}, r.funil) }); Dados.salvar(); aviso('Funil real levado para o simulador (modo quantidades).'); location.hash = '#/comissao';
    });
  }

  // ---------- Relatório do mês ----------
  function telaMes(el) {
    const pr = prefs(); const id = pr.cliente || null; const c = cfgCliente(id); const x = cfgNum(c); const mm = /^\d{4}-\d{2}$/.test(pr.mes) ? pr.mes : mesAtual();
    const r = P.desempenho(Dados.e, Object.assign({ empresaId: id, cfg: x }, P.mes(mm))); const p = r.periodo;
    el.innerHTML = abas('mes') +
      '<form class="cartao cm-rel-form no-print" id="cm-mes-f" autocomplete="off"><div class="linha">' + campo('Mês', '<input type="month" name="mes" value="' + esc(mm) + '">') + seletorCliente(id) + '</div><details><summary>Condições da comissão</summary>' + formCondicoes(c) + '</details>' +
      '<div class="grupo-botoes"><button type="button" class="btn primario" data-a="imprimir">🖨 Imprimir relatório do mês</button><a class="btn fantasma" href="#/comissao/performance">Performance completa</a></div></form>' +
      '<div class="cm-relatorio">' + cabecalho('Relatório de ' + nomeMes(mm) + (id ? ' · ' + nomeEmpresa(id) : ' · todos os clientes'), 'Comissão: ' + textoCfg(c) + ' · dados do Seven Processo') +
      kpis([['Novas oportunidades', p.novas.length], ['Ganhas no mês', p.ganhas.length, 'ok'], ['Perdidas no mês', p.perdidas.length, p.perdidas.length ? 'ruim' : ''], ['Taxa de sucesso no mês', p.taxaSucesso == null ? '—' : pc(p.taxaSucesso, 1)], ['Valor ganho no mês', moeda(p.valorGanho)], ['Faturado no mês', moeda(p.faturado)], ['Recebido no mês', moeda(p.recebido), 'ok'], ['Comissão do mês (sobre o recebido)', moeda(p.comissao), 'ok'], ['Comissão gerada pelos ganhos', moeda(p.comissaoGanhos)], ['A receber (total)', moeda(r.totais.aReceber)]]) +
      barraMeta(p.comissao, x.meta, 'Meta de comissão do mês') +
      '<section class="cartao"><h3>Licitações ganhas no mês</h3>' + tabela([['Data'], ['Licitação'], ['Órgão'], ['Valor', 1], ['Comissão', 1]], p.ganhas.map(function (k) { return '<tr><td>' + dataBR(k.dataGanho) + '</td><td>' + linkCartao(k) + '</td><td>' + esc(k.orgao) + '</td><td class="n">' + moeda(k.valor) + '</td><td class="n">' + moeda(k.valor * r.fator) + '</td></tr>'; }), 'Nenhuma licitação ganha neste mês.') + '</section>' +
      '<section class="cartao"><h3>Não vencidas no mês</h3>' + tabela([['Data'], ['Licitação'], ['Órgão'], ['Valor estimado', 1]], p.perdidas.map(function (k) { return '<tr><td>' + dataBR(k.dataPerda) + '</td><td>' + linkCartao(k) + '</td><td>' + esc(k.orgao) + '</td><td class="n">' + moeda(k.valor) + '</td></tr>'; }), 'Nenhuma.') + '</section>' +
      '<section class="cartao"><h3>Notas fiscais emitidas</h3>' + tabela([['Emissão'], ['NF'], ['Licitação'], ['Valor', 1], ['Vencimento']], p.notas.map(function (n) { return '<tr><td>' + dataBR(n.data) + '</td><td>' + esc(n.numero || '') + '</td><td>' + esc(n.cartao) + '</td><td class="n">' + moeda(n.valor) + '</td><td>' + (n.vencimento ? dataBR(n.vencimento) : '—') + '</td></tr>'; }), 'Nenhuma nota fiscal emitida neste mês.') + '</section>' +
      '<section class="cartao"><h3>Pagamentos recebidos</h3>' + tabela([['Data'], ['Licitação'], ['Valor recebido', 1], ['Comissão', 1]], p.pagamentos.map(function (g) { return '<tr><td>' + dataBR(g.data) + '</td><td>' + esc(g.cartao) + '</td><td class="n">' + moeda(g.valor) + '</td><td class="n">' + moeda(g.valor * r.fator) + '</td></tr>'; }).concat(p.pagamentos.length ? ['<tr class="cm-total"><th colspan="2">Total</th><td class="n">' + moeda(p.recebido) + '</td><td class="n">' + moeda(p.comissao) + '</td></tr>'] : []), 'Nenhum pagamento recebido neste mês.') + '</section>' +
      '<section class="cartao"><h3>Próximos recebimentos</h3>' + tabela([['Vencimento'], ['NF'], ['Licitação'], ['Em aberto', 1], ['Comissão', 1]], r.proximos.slice(0, 15).map(function (n) { return '<tr' + (n.atrasada ? ' class="cm-atrasada"' : '') + '><td>' + (n.vencimento ? dataBR(n.vencimento) : '—') + (n.atrasada ? ' <span class="tag vermelho">atrasada</span>' : '') + '</td><td>' + esc(n.numero || '') + '</td><td>' + esc(n.cartao) + '</td><td class="n">' + moeda(n.aberto) + '</td><td class="n">' + moeda(n.aberto * r.fator) + '</td></tr>'; }), 'Nenhuma nota fiscal em aberto.') + '</section></div>';
    ligarRel(el, id);
  }

  function ligarRel(el, id, usarFunil) {
    const f = el.querySelector('.cm-rel-form');
    f.onchange = function (ev) {
      const nm = ev.target.name; const pr = prefs();
      if (nm === 'cliente') { pr.cliente = ev.target.value || null; Dados.salvar(); App.redesenhar(); return; }
      if (nm === 'mes') { pr.mes = ev.target.value || mesAtual(); Dados.salvar(); App.redesenhar(); return; }
      lerCondicoes(f, id); Dados.salvar(); App.redesenhar();
      const foco = el.querySelector('.cm-rel-form [name="' + nm + '"]'); if (foco && foco.type !== 'radio') foco.focus();
    };
    f.onsubmit = function (ev) { ev.preventDefault(); };
    el.onclick = function (ev) { const b = ev.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'imprimir') imprimir(); if (b.dataset.a === 'usar-funil' && usarFunil) usarFunil(); };
  }

  // ---------- Relatório completo da simulação (para imprimir) ----------
  function telaRelatorioSimulacao(el) {
    const s = T.estado(); const e = T.entrada(s); const r = K.calcular(e); const fu = T.calcFunil(s);
    const dados = [['Base da comissão', s.base === 'lucro' ? 'Sobre o lucro líquido' : 'Sobre o preço de venda'], ['Comissão', e.pct == null ? '—' : pc(e.pct)], ['Valor da venda / contrato', moeda(e.venda)], ['Margem de lucro líquido', e.margem == null ? '—' : pc(e.margem, 2) + (s.usarCustos ? ' (calculada pelos custos)' : '')], ['Meta (quanto quero receber)', moeda(e.alvo)], ['Retenções sobre a comissão', e.retencao ? pc(e.retencao) : '—'], ['Nº de licitações', e.contratos || 1]];
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
    if (sub === 'relatorio') return telaRelatorioSimulacao(el);
    el.innerHTML = abas('') + '<div id="cm-sim"></div>';
    const box = el.querySelector('#cm-sim'); T.simulador(box);
    const g = box.querySelector('#cm-form .grupo-botoes'); if (g) g.insertAdjacentHTML('afterbegin', '<a class="btn mini primario" href="#/comissao/relatorio">🖨 Relatório completo</a>');
  };
})();
