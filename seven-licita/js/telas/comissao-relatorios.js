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
  // a própria empresa não paga comissão a si mesma: comissão e fixo ficam zerados
  function cfgDe(id) { const emp = id && Dados.empresa(id); const c = cfgCalc(cfgCliente(id)); return emp && emp.propria ? Object.assign(c, { pct: 0, faixas: null, fixo: 0, parceiros: [] }) : c; }
  function cfgNum(c) { const n = function (v) { return v == null || String(v).trim() === '' ? null : Nucleo.lerNumeroBR(v); }; return { base: c.base, pct: n(c.pct), margem: n(c.margem), retencao: n(c.retencao), meta: n(c.meta) }; }
  function textoCfg(c) {
    const x = cfgCalc(c); const fx = x.faixas ? K.lerFaixas(x.faixas) : [];
    const pcTxt = fx.length ? 'faixas ' + fx.map(function (f) { return pc(f.pct) + (f.ate ? ' até ' + moeda(f.ate) : ' acima'); }).join(', ') + (x.faixaModo === 'progressiva' ? ' (progressiva)' : '') : (x.pct != null ? pc(x.pct) : '—');
    const parc = (x.parceiros || []).filter(function (p) { return p.pct > 0; });
    return pcTxt + (x.base === 'lucro' ? ' sobre o lucro líquido (margem ' + (x.margem != null ? pc(x.margem) : '—') + ')' : ' sobre o preço de venda') + (x.retencao ? ', retenção de ' + pc(x.retencao) : '') + (x.fixo ? ' + fixo de ' + moeda(x.fixo) + '/mês' : '') + (parc.length ? ' · parceiros: ' + parc.map(function (p) { return (p.nome || 'Parceiro') + ' ' + pc(p.pct); }).join(', ') : '');
  }
  function arquivo(tipo, cliente) { const id = cliente !== undefined ? cliente : prefs().cliente; const nome = id ? nomeEmpresa(id) : 'todos'; return ('seven-' + (/^(performance|base)/.test(tipo) ? 'relatorio-' : 'comissao-') + tipo + '-' + Nucleo.normalizar(nome).replace(/[^a-z0-9]+/g, '-') + '-' + T.hoje()).replace(/-+/g, '-') + '.pdf'; }
  let tipoRel = 'relatorio';
  // imprimir: fora do claude.ai abre a impressão; no claude.ai (onde a impressão é bloqueada) gera o PDF
  async function imprimir(soPdf, tipo, cliente) {
    Dados.salvar(); const el = document.querySelector('.cm-relatorio'); if (!el) return;
    const b = document.querySelectorAll('[data-a=imprimir],[data-a=pdf]'); b.forEach(function (x) { x.disabled = true; });
    try {
      if (!soPdf && !RelatorioPDF.emQuadro()) { window.print(); return; }
      aviso('Gerando o PDF…'); const r = await RelatorioPDF.gerar(el, arquivo(tipo || tipoRel, cliente));
      if (r === 'recusado') aviso('Download cancelado.'); else aviso('PDF pronto. Abra o arquivo para imprimir ou enviar ao cliente.');
    } catch (e) { aviso('Não foi possível gerar o PDF: ' + (e && e.message || e), 'erro'); }
    finally { b.forEach(function (x) { x.disabled = false; }); }
  }

  function abas(sub) {
    const a = [['', '🧮 Simulador'], ['ganhas', '🏆 Licitações ganhas'], ['condicoes', '⚙ Condições do cliente'], ['extrato', '💰 Extrato']];
    return '<nav class="abas cm-abas no-print" aria-label="Seven Comissão">' + a.map(function (x) { return '<a href="#/comissao' + (x[0] ? '/' + x[0] : '') + '" class="' + ((sub || '') === x[0] ? 'ativa' : '') + '"' + ((sub || '') === x[0] ? ' aria-current="page"' : '') + '>' + x[1] + '</a>'; }).join('') + '<a href="#/relatorios" class="cm-aba-ext" title="Relatório de performance para o cliente">📊 Seven Relatórios ↗</a></nav>';
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

  // ---------- Condições da comissão de cada cliente ----------
  function telaCondicoes(el) {
    tipoRel = 'condicoes';
    const pr = prefs(); const id = pr.cliente || null; const c = cfgCliente(id);
    const r = P.desempenho(Dados.e, { empresaId: id, cfgDe: cfgDe });
    el.innerHTML = abas('condicoes') +
      '<form class="cartao cm-rel-form" id="cm-cond-f" autocomplete="off"><div class="linha">' + seletorCliente(id) + '</div><h4>Condições da comissão ' + (id ? 'de ' + esc(nomeEmpresa(id)) : 'padrão (todos os clientes sem condição própria)') + '</h4>' + formCondicoes(c) +
      '<p class="mini mudo">Resumo: ' + esc(textoCfg(c)) + '. Valem para as licitações ganhas, o extrato e os relatórios.</p>' +
      '<div class="grupo-botoes"><button type="button" class="btn" data-a="usar-funil"' + (r.cartoes.length ? '' : ' disabled') + '>Levar o funil real deste cliente para o simulador</button><a class="btn fantasma" href="#/relatorios">📊 Relatório de performance (Seven Relatórios)</a></div></form>';
    ligarRel(el, id, function () {
      const k = Dados.e.comissao = T.estado(); k.funil = Object.assign({}, k.funil, { modo: 'qtd', qtd: Object.assign({}, r.funil) }); Dados.salvar(); aviso('Funil real levado para o simulador (modo quantidades).'); location.hash = '#/comissao';
    });
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
      if (a === 'imprimir') imprimir(); if (a === 'pdf') imprimir(true); if (a === 'usar-funil' && usarFunil) usarFunil();
      if ((a === 'enviar-whatsapp' || a === 'enviar-email') && enviar) enviar(a === 'enviar-whatsapp' ? 'whatsapp' : 'email');
    };
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
    tipoRel = 'extrato';
    const pr = prefs(); const id = pr.cliente || null; const c = cfgCliente(id); const x = extratoDe(id);
    el.innerHTML = abas('extrato') +
      '<form class="cartao cm-rel-form no-print" id="cm-ext-f" autocomplete="off"><div class="linha">' + seletorCliente(id) + '</div>' +
      '<p class="mini mudo">Cada pagamento do órgão registrado na execução do Seven Processo gera a comissão' + (id ? ' (' + esc(textoCfg(c)) + ')' : ' (condições de cada cliente)') + '. A situação acompanha o Seven Financeiro: lançada = cobrada; baixada como paga = recebida.' + (id && c.autoFinanceiro ? ' <b>Lançamento automático ligado para este cliente.</b>' : ' Ligue o lançamento automático na aba Condições do cliente.') + '</p>' +
      '<div class="grupo-botoes"><button type="button" class="btn primario" data-a="lancar-todas"' + (x.aCobrar ? '' : ' disabled') + '>Lançar todas as pendentes no Seven Financeiro</button><button type="button" class="btn" data-a="imprimir">🖨 Imprimir extrato</button><button type="button" class="btn" data-a="pdf">⬇ Baixar PDF</button><a class="btn fantasma" href="#/financas">Abrir o Seven Financeiro</a></div></form>' +
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
      if (a === 'imprimir') imprimir(); if (a === 'pdf') imprimir(true);
      if (a === 'lancar' && it) { lancarCobranca(it); aviso('Cobrança lançada no Seven Financeiro (contas a receber).'); App.redesenhar(); }
      if (a === 'lancar-todas') { let nn = 0; x.itens.forEach(function (i) { if (i.status === 'a cobrar' && lancarCobranca(i, true)) nn++; }); Dados.salvar(); aviso(nn + ' cobrança(s) lançada(s) no Seven Financeiro.'); App.redesenhar(); }
      if (a === 'recebida' && it) { const d = Dados.e; d.comissaoExtrato = d.comissaoExtrato || {}; d.comissaoExtrato[it.chave] = { status: 'recebida', em: T.hoje() }; Dados.salvar(); App.redesenhar(); }
      if (a === 'repasses' && it) { const nn = lancarRepasses(it); Dados.salvar(); aviso(nn + ' repasse(s) lançado(s) em contas a pagar.'); App.redesenhar(); }
    };
  }

  // ---------- Licitações ganhas: lançamento e carteira por cliente ----------
  const MODALIDADES = ['Pregão eletrônico', 'Dispensa eletrônica', 'Concorrência', 'Inexigibilidade', 'Adesão a ata (carona)', 'Outra'];
  const PORTAIS = Nucleo.PORTAIS;
  const CRITERIOS = ['Menor preço', 'Maior desconto', 'Técnica e preço', 'Melhor técnica ou conteúdo artístico', 'Maior lance', 'Maior retorno econômico'];
  const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  const ETAPAS_GANHA = ['Contrato', 'Empenho', 'Entrega', 'Pagamento', 'Concluído'];
  const opc = function (l, v) { return l.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); };
  const num = function (v) { return v == null || String(v).trim() === '' ? 0 : (Nucleo.lerNumeroBR(v) || 0); };
  function acharCartao(id) { let r = null; (Dados.e.quadros || []).some(function (q) { const c = (q.cartoes || []).find(function (k) { return k.id === id; }); if (c) r = { q: q, c: c }; return !!c; }); return r; }
  function nota(txt, c) { c.atividade = c.atividade || []; c.atividade.unshift({ em: new Date().toISOString(), por: Dados.e.config.responsavel || '', texto: txt }); c.atualizadoEm = new Date().toISOString(); }
  // campos da licitação ganha (lançar e editar); v = valores atuais
  function camposGanha(v, idSel) {
    v = v || {}; const es = Dados.e.empresas || []; const val = function (k) { return esc(v[k] == null ? '' : String(v[k])); };
    const sel = function (nome, l, atual, vazio) { return '<select name="' + nome + '">' + (vazio ? '<option value=""></option>' : '') + l.map(function (x) { return '<option' + (x === atual ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>'; };
    return '<fieldset class="cm-av"><legend>Cliente e órgão comprador</legend><div class="linha">' +
      campo('Cliente *', '<select name="cliente" required><option value="">Escolha o cliente</option>' + es.map(function (x) { return '<option value="' + esc(x.id) + '"' + ((v.empresaId || idSel) === x.id ? ' selected' : '') + '>' + esc(x.fantasia || x.razao) + '</option>'; }).join('') + '</select>', es.length ? '' : 'Cadastre o cliente em Clientes (CNPJs).') +
      campo('Órgão *', '<input name="orgao" required value="' + val('orgao') + '" placeholder="Prefeitura de Catalão">') +
      campo('UASG / código da unidade', '<input name="uasg" value="' + val('uasg') + '" placeholder="926789">', 'UASG no Compras.gov.br; UG, código ou ID do órgão nos outros portais.') + '</div><div class="linha">' +
      campo('CNPJ do órgão', '<input name="cnpjOrgao" inputmode="numeric" value="' + val('cnpjOrgao') + '" placeholder="00.000.000/0001-00">') + campo('UF', sel('uf', UFS, v.uf, true)) + campo('Município', '<input name="municipio" value="' + val('municipio') + '">') + '</div></fieldset>' +
      '<fieldset class="cm-av"><legend>Licitação</legend><div class="linha">' +
      campo('Nº do processo / pregão', '<input name="numero" value="' + val('numero') + '" placeholder="PE 90012/2026">') + campo('ID da licitação no portal', '<input name="idPortal" value="' + val('idPortal') + '">', 'Número da compra ou código usado pelo portal.') + campo('Nº de controle PNCP', '<input name="pncp" value="' + val('pncp') + '" placeholder="00000000000000-1-000000/2026">') + '</div><div class="linha">' +
      campo('Modalidade', sel('modalidade', MODALIDADES, v.modalidade || 'Pregão eletrônico')) + campo('Critério de julgamento', sel('criterio', CRITERIOS, v.criterio || 'Menor preço')) +
      campo('Portal', '<input name="portal" list="cm-portais" value="' + val('portal') + '" placeholder="Escolha ou digite"><datalist id="cm-portais">' + PORTAIS.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>') + '</div><div class="linha">' +
      campo('Objeto *', '<input name="objeto" required value="' + val('objeto') + '" placeholder="Gêneros alimentícios">') + campo('Link do edital', '<input name="linkEdital" type="url" value="' + val('linkEdital') + '" placeholder="https://">') + '</div>' +
      campo('Itens / lotes ganhos', '<textarea name="itens" rows="2" placeholder="Itens 3, 7 e 12; lote 2 (arroz, feijão e óleo)">' + val('itens') + '</textarea>') +
      '<label class="check"><input type="checkbox" name="srp"' + (v.srp ? ' checked' : '') + '> Registro de preços (gera ata; o órgão compra conforme a necessidade)</label></fieldset>' +
      '<fieldset class="cm-av"><legend>Resultado</legend><div class="linha">' +
      campo('Valor ganho (R$) *', '<input name="valor" inputmode="decimal" required value="' + val('valorTxt') + '" placeholder="120.000,00">') + campo('Valor estimado pelo órgão (R$)', '<input name="valorEstimado" inputmode="decimal" value="' + val('valorEstimadoTxt') + '">', 'Referência do edital; calcula o deságio.') +
      campo('Data do resultado *', '<input type="date" name="data" required value="' + esc(v.dataGanho || T.hoje()) + '">', 'Homologação ou adjudicação.') + campo('Etapa atual', sel('etapa', ETAPAS_GANHA, v.etapa || 'Contrato')) + '</div></fieldset>' +
      '<fieldset class="cm-av"><legend>Contrato ou ata</legend><div class="linha">' +
      campo('Nº do contrato / ata', '<input name="contrato" value="' + val('contrato') + '">') + campo('Assinatura', '<input type="date" name="assinatura" value="' + val('assinatura') + '">') + campo('Vigência de', '<input type="date" name="vigenciaInicio" value="' + val('vigenciaInicio') + '">') + campo('até', '<input type="date" name="vigencia" value="' + val('vigencia') + '">') + '</div><div class="linha">' +
      campo('Gestor ou fiscal do contrato', '<input name="gestor" value="' + val('gestor') + '">') + campo('Contato do gestor', '<input name="contatoGestor" value="' + val('contatoGestor') + '" placeholder="telefone ou e-mail">') + campo('Garantia contratual (%)', '<input name="garantia" inputmode="decimal" value="' + val('garantia') + '" placeholder="5">', 'Até 5% (ou 10% em obras e serviços de grande vulto).') + '</div><div class="linha">' +
      campo('Prazo de entrega (dias)', '<input name="prazoEntrega" inputmode="numeric" value="' + val('prazoEntrega') + '">') + campo('Prazo de pagamento (dias após o atesto)', '<input name="prazoPagamento" inputmode="numeric" value="' + val('prazoPagamento') + '" placeholder="30">', 'Usado como vencimento padrão das notas.') + campo('Local de entrega', '<input name="localEntrega" value="' + val('localEntrega') + '">') + '</div></fieldset>' +
      campo('Observações', '<textarea name="obs" rows="2">' + val('obs') + '</textarea>');
  }
  const CAMPOS_LIC = ['uasg', 'cnpjOrgao', 'uf', 'municipio', 'idPortal', 'pncp', 'criterio', 'linkEdital', 'itens', 'assinatura', 'vigenciaInicio', 'gestor', 'contatoGestor', 'garantia', 'prazoEntrega', 'prazoPagamento', 'localEntrega', 'obs', 'objeto', 'modalidade'];
  function lerGanha(d) {
    const lic = {}; CAMPOS_LIC.forEach(function (k) { lic[k] = String(d.get(k) || '').trim(); }); lic.srp = !!d.get('srp'); lic.valorEstimado = num(d.get('valorEstimado')) || null;
    return { empresaId: d.get('cliente'), orgao: String(d.get('orgao') || '').trim(), numero: String(d.get('numero') || '').trim(), portal: String(d.get('portal') || '').trim(), valor: num(d.get('valor')), dataGanho: d.get('data'), contrato: String(d.get('contrato') || '').trim(), vigencia: d.get('vigencia') || '', etapa: d.get('etapa'), licitacao: lic };
  }
  function formGanha(idSel) {
    return '<details class="cartao cm-ganha no-print"' + (P.cartoes(Dados.e, null).some(function (c) { return c.ganha; }) ? '' : ' open') + '><summary><b>+ Lançar licitação ganha</b> <span class="mini mudo">para ter o controle por cliente, mesmo das que não passaram pelo funil</span></summary><form id="cm-ganha-f" autocomplete="off">' + camposGanha({}, idSel) +
      '<details class="cm-exec-ini"><summary>Execução já realizada (opcional)</summary><div class="linha">' + campo('Empenho nº', '<input name="emp_num">') + campo('Valor do empenho (R$)', '<input name="emp_valor" inputmode="decimal">') + campo('Data do empenho', '<input type="date" name="emp_data">') + '</div>' +
      '<div class="linha">' + campo('Nota fiscal nº', '<input name="nf_num">') + campo('Valor da NF (R$)', '<input name="nf_valor" inputmode="decimal">') + campo('Emissão', '<input type="date" name="nf_data">') + campo('Vencimento', '<input type="date" name="nf_venc">') + '</div>' +
      '<div class="linha">' + campo('Pagamento recebido (R$)', '<input name="pg_valor" inputmode="decimal">', 'Referente à NF acima.') + campo('Data do pagamento', '<input type="date" name="pg_data">') + '</div></details>' +
      '<div class="grupo-botoes"><button class="btn primario">Lançar licitação ganha</button></div><p class="mini mudo">Cria o cartão no Seven Processo com a etiqueta Ganha. A performance, o relatório do mês e o extrato de comissões passam a contar com ela.</p></form></details>';
  }
  function telaGanhas(el) {
    tipoRel = 'carteira';
    const pr = prefs(); const id = pr.cliente || null; const busca = Nucleo.normalizar(pr.buscaGanhas || '');
    const r = P.desempenho(Dados.e, { empresaId: id, cfgDe: cfgDe }); const x = extratoDe(id);
    const ganhas = r.contratos.filter(function (c) { return !busca || Nucleo.normalizar([c.titulo, c.orgao, c.numero, nomeEmpresa(c.empresaId)].join(' ')).indexOf(busca) >= 0; }).sort(function (a, b) { return (b.dataGanho || '') < (a.dataGanho || '') ? -1 : 1; });
    const grupos = {}; ganhas.forEach(function (c) { (grupos[c.empresaId || '—'] = grupos[c.empresaId || '—'] || []).push(c); });
    const somaG = function (l, k) { return l.reduce(function (a, c) { return a + (Number(c[k]) || 0); }, 0); };
    const linha = function (c) {
      return '<tr><td>' + (c.dataGanho ? dataBR(c.dataGanho) : '—') + '</td><td>' + linkCartao(c) + (c.numero ? '<br><small class="mudo">' + esc(c.numero) + '</small>' : '') + '</td><td>' + esc(c.orgao) + (c.uasg || (c.licitacao && c.licitacao.uf) ? '<br><small class="mudo">' + esc([c.uasg && 'UASG ' + c.uasg, c.licitacao && c.licitacao.uf, c.portal].filter(Boolean).join(' · ')) + '</small>' : '') + '</td><td class="n">' + moeda(c.valor) + (c.valorEstimado ? '<br><small class="mudo">deságio ' + pc((1 - c.valor / c.valorEstimado) * 100, 1) + '</small>' : '') + '</td><td class="n">' + moeda(c.empenhado) + '</td><td class="n">' + moeda(c.faturado) + '</td><td class="n">' + moeda(c.recebido) + '</td><td class="n">' + moeda(c.aReceber) + '</td><td class="n">' + moeda(c.comissao) + '</td><td>' + esc(c.lista) + '</td>' +
        '<td class="no-print cm-acoes"><button type="button" class="btn mini fantasma" data-a="editar" data-c="' + esc(c.id) + '">Editar</button><button type="button" class="btn mini" data-a="add-empenho" data-c="' + esc(c.id) + '">+ Empenho</button><button type="button" class="btn mini" data-a="add-nf" data-c="' + esc(c.id) + '">+ NF</button><button type="button" class="btn mini" data-a="add-pg" data-c="' + esc(c.id) + '"' + (c.notas.some(function (n) { return n.aberto > 0; }) ? '' : ' disabled title="Registre uma NF primeiro"') + '>+ Pagamento</button></td></tr>';
    };
    const cab = [['Resultado'], ['Licitação'], ['Órgão'], ['Valor ganho', 1], ['Empenhado', 1], ['Faturado', 1], ['Recebido', 1], ['A receber', 1], ['Comissão', 1], ['Etapa'], ['']];
    el.innerHTML = abas('ganhas') + formGanha(id) +
      '<form class="cartao cm-rel-form no-print" id="cm-gf" autocomplete="off"><div class="linha">' + seletorCliente(id) + campo('Buscar', '<input type="search" name="busca" value="' + esc(pr.buscaGanhas || '') + '" placeholder="órgão, objeto, nº do processo">') + '</div>' +
      '<div class="grupo-botoes"><button type="button" class="btn primario" data-a="imprimir">🖨 Imprimir carteira</button><button type="button" class="btn" data-a="pdf">⬇ Baixar PDF</button><a class="btn fantasma" href="#/comissao/extrato">Extrato de comissões</a></div></form>' +
      '<div class="cm-relatorio">' + cabecalho('Licitações ganhas' + (id ? ' · ' + nomeEmpresa(id) : ' · todos os clientes'), 'Carteira de contratos, execução e comissões') +
      kpis([['Licitações ganhas', ganhas.length, 'ok'], ['Valor ganho', moeda(somaG(ganhas, 'valor'))], ['Empenhado', moeda(somaG(ganhas, 'empenhado'))], ['Faturado', moeda(somaG(ganhas, 'faturado'))], ['Recebido', moeda(somaG(ganhas, 'recebido')), 'ok'], ['A receber', moeda(somaG(ganhas, 'aReceber'))], ['Em atraso', moeda(r.totais.atrasado), r.totais.atrasado ? 'ruim' : ''],
        ['Comissão gerada (contratos)', moeda(somaG(ganhas, 'comissao'))], ['Comissão recebida', moeda(x.recebida), 'ok'], ['Comissão a cobrar', moeda(x.aCobrar), x.aCobrar ? 'ruim' : '']]) +
      (ganhas.length ? Object.keys(grupos).map(function (k) {
        const l = grupos[k];
        return '<section class="cartao"><h3>' + esc(nomeEmpresa(k === '—' ? null : k)) + ' <span class="mini mudo">' + l.length + ' licitação(ões) · ' + moeda(somaG(l, 'valor')) + ' ganhos · ' + moeda(somaG(l, 'recebido')) + ' recebidos · comissão ' + moeda(somaG(l, 'comissao')) + '</span></h3>' +
          tabela(cab, l.map(linha).concat(['<tr class="cm-total"><th colspan="3">Total</th><td class="n">' + moeda(somaG(l, 'valor')) + '</td><td class="n">' + moeda(somaG(l, 'empenhado')) + '</td><td class="n">' + moeda(somaG(l, 'faturado')) + '</td><td class="n">' + moeda(somaG(l, 'recebido')) + '</td><td class="n">' + moeda(somaG(l, 'aReceber')) + '</td><td class="n">' + moeda(somaG(l, 'comissao')) + '</td><td colspan="2"></td></tr>']), '') + '</section>';
      }).join('') : '<div class="cartao"><p class="mudo">Nenhuma licitação ganha' + (busca ? ' com essa busca' : '') + '. Use <b>+ Lançar licitação ganha</b> acima, ou marque um cartão como Ganha no Seven Processo.</p></div>') + '</div>';
    // lançar
    const fg = el.querySelector('#cm-ganha-f');
    fg.onsubmit = function (ev) {
      ev.preventDefault(); const d = new FormData(fg); const valor = num(d.get('valor'));
      if (!d.get('cliente')) { aviso('Escolha o cliente.', 'erro'); return; } if (!(valor > 0)) { aviso('Informe o valor ganho.', 'erro'); return; }
      const ex = { empenhos: [], notas: [], pagamentos: [] };
      if (d.get('emp_num') || num(d.get('emp_valor'))) ex.empenhos.push({ id: Execucao.novoId('em'), numero: d.get('emp_num'), valor: num(d.get('emp_valor')) || valor, data: d.get('emp_data') || '' });
      if (d.get('nf_num') || num(d.get('nf_valor'))) ex.notas.push({ id: Execucao.novoId('nf'), numero: d.get('nf_num'), valor: num(d.get('nf_valor')), data: d.get('nf_data') || '', vencimento: d.get('nf_venc') || '', empenhoId: ex.empenhos[0] ? ex.empenhos[0].id : '' });
      if (num(d.get('pg_valor')) && ex.notas[0]) ex.pagamentos.push({ id: Execucao.novoId('pg'), notaId: ex.notas[0].id, valor: num(d.get('pg_valor')), data: d.get('pg_data') || T.hoje() });
      const g = lerGanha(d); const titulo = [g.numero, g.licitacao.objeto].filter(Boolean).join(' · ');
      const venc = function (emissao) { return emissao && num(g.licitacao.prazoPagamento) ? Execucao.vencimentoPadrao(emissao, num(g.licitacao.prazoPagamento)) : ''; };
      ex.notas.forEach(function (n) { if (!n.vencimento) n.vencimento = venc(n.data); });
      const ok = Telas.quadros.lancarGanha(Object.assign(g, { titulo: titulo, objeto: g.licitacao.objeto, modalidade: g.licitacao.modalidade, execucao: Object.assign({ numero: g.contrato, valor: g.valor, vigenciaFim: g.vigencia, vigenciaInicio: g.licitacao.vigenciaInicio }, ex) }));
      if (!ok) { aviso('Não foi possível criar o cartão no Seven Processo.', 'erro'); return; }
      prefs().cliente = g.empresaId; Dados.salvar(); aviso('Licitação ganha lançada: ' + titulo + '.'); App.redesenhar();
    };
    const ff = el.querySelector('#cm-gf');
    ff.onchange = function (ev) { if (ev.target.name === 'cliente') { prefs().cliente = ev.target.value || null; Dados.salvar(); App.redesenhar(); } };
    ff.oninput = function (ev) { if (ev.target.name === 'busca') { clearTimeout(ff._t); ff._t = setTimeout(function () { prefs().buscaGanhas = ev.target.value; App.redesenhar(); const i = document.querySelector('#cm-gf [name=busca]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); } };
    ff.onsubmit = function (ev) { ev.preventDefault(); };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'imprimir') return imprimir(); if (a === 'pdf') return imprimir(true);
      const k = b.dataset.c && acharCartao(b.dataset.c); if (!k) return; const xx = Execucao.normalizar(k.c.execucao = k.c.execucao || { empenhos: [], notas: [], pagamentos: [] }); k.c.execucao = xx;
      const L = k.c.licitacao || {};
      if (a === 'editar') {
        const cp = r.contratos.find(function (z) { return z.id === k.c.id; }) || {}; const lst = (k.q.listas || []).find(function (l) { return l.id === k.c.lista; }) || {};
        const v = Object.assign({}, L, { empresaId: k.c.empresaId, orgao: (k.c.valores || {}).orgao, numero: (k.c.valores || {}).numero, portal: (k.c.valores || {}).portal, valorTxt: String(cp.valor || (k.c.valores || {}).valor || '').replace('.', ','), valorEstimadoTxt: L.valorEstimado ? String(L.valorEstimado).replace('.', ',') : '', dataGanho: cp.dataGanho, etapa: lst.nome, contrato: xx.numero, vigencia: xx.vigenciaFim, vigenciaInicio: xx.vigenciaInicio || L.vigenciaInicio });
        const f = await UI.modal({ titulo: 'Editar licitação ganha', largo: true, botao: 'Salvar', corpo: camposGanha(v) }); if (!f) return;
        const g = lerGanha(f); if (!(g.valor > 0)) { aviso('Informe o valor ganho.', 'erro'); return; }
        k.c.empresaId = g.empresaId || k.c.empresaId; k.c.valores = Object.assign({}, k.c.valores, { orgao: g.orgao, numero: g.numero, portal: g.portal, valor: g.valor }); k.c.licitacao = g.licitacao;
        Object.assign(xx, { numero: g.contrato, valor: g.valor, vigenciaFim: g.vigencia, vigenciaInicio: g.licitacao.vigenciaInicio });
        k.c.titulo = [g.numero, g.licitacao.objeto].filter(Boolean).join(' · ') || k.c.titulo; k.c.descricao = Telas.quadros.resumoLicitacao(Object.assign({}, g, { objeto: g.licitacao.objeto, modalidade: g.licitacao.modalidade }));
        const nl = (k.q.listas || []).find(function (l) { return l.nome === g.etapa; }); if (nl && nl.id !== k.c.lista) { k.c.lista = nl.id; nota('moveu para "' + nl.nome + '" (Seven Comissão)', k.c); }
        if (g.dataGanho && g.dataGanho !== cp.dataGanho) { const at = (k.c.atividade || []).find(function (t) { return /lançada na Seven Comissão/.test(t.texto || ''); }); const em = g.dataGanho + 'T12:00:00.000Z'; if (at) { at.em = em; at.texto = 'ganha em ' + g.dataGanho.split('-').reverse().join('/') + ' (lançada na Seven Comissão)'; } else k.c.atividade.push({ em: em, por: '', texto: 'ganha em ' + g.dataGanho.split('-').reverse().join('/') + ' (lançada na Seven Comissão)' }); }
        nota('editou os dados da licitação (Seven Comissão)', k.c);
      }
      if (a === 'add-empenho') {
        const f = await UI.modal({ titulo: 'Registrar empenho · ' + k.c.titulo, botao: 'Registrar', corpo: '<div class="linha">' + campo('Nº do empenho', '<input name="n" required>') + campo('Valor (R$)', '<input name="v" inputmode="decimal" required>') + campo('Data', '<input type="date" name="d" value="' + T.hoje() + '">') + '</div>' });
        if (!f) return; xx.empenhos.push({ id: Execucao.novoId('em'), numero: f.get('n'), valor: num(f.get('v')), data: f.get('d') }); nota('registrou o empenho ' + f.get('n') + ' (Seven Comissão)', k.c);
      }
      if (a === 'add-nf') {
        const f = await UI.modal({ titulo: 'Registrar nota fiscal · ' + k.c.titulo, botao: 'Registrar', corpo: '<div class="linha">' + campo('Nº da NF', '<input name="n" required>') + campo('Valor (R$)', '<input name="v" inputmode="decimal" required>') + '</div><div class="linha">' + campo('Emissão', '<input type="date" name="d" value="' + T.hoje() + '">') + campo('Vencimento', '<input type="date" name="venc" value="' + (num(L.prazoPagamento) ? Execucao.vencimentoPadrao(T.hoje(), num(L.prazoPagamento)) : '') + '">', num(L.prazoPagamento) ? 'Emissão + ' + num(L.prazoPagamento) + ' dias (prazo de pagamento do contrato).' : '') + (xx.empenhos.length ? campo('Empenho', '<select name="e">' + xx.empenhos.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.numero || 'sem nº') + ' · ' + moeda(m.valor) + '</option>'; }).join('') + '</select>') : '') + '</div>' });
        if (!f) return; xx.notas.push({ id: Execucao.novoId('nf'), numero: f.get('n'), valor: num(f.get('v')), data: f.get('d'), vencimento: f.get('venc') || '', empenhoId: f.get('e') || '' }); nota('registrou a NF ' + f.get('n') + ' (Seven Comissão)', k.c);
      }
      if (a === 'add-pg') {
        const abertas = Execucao.resumo(xx).notas.filter(function (n) { return n.aberto > 0; });
        const f = await UI.modal({ titulo: 'Registrar pagamento recebido · ' + k.c.titulo, botao: 'Registrar', corpo: campo('Nota fiscal', '<select name="nf">' + abertas.map(function (n) { return '<option value="' + esc(n.id) + '" data-aberto="' + n.aberto + '">NF ' + esc(n.numero || '') + ' · em aberto ' + moeda(n.aberto) + '</option>'; }).join('') + '</select>') + '<div class="linha">' + campo('Valor recebido (R$)', '<input name="v" inputmode="decimal" value="' + esc(String(abertas[0] ? abertas[0].aberto : '').replace('.', ',')) + '" required>') + campo('Data', '<input type="date" name="d" value="' + T.hoje() + '">') + '</div><p class="mini mudo">O pagamento entra na execução do Seven Processo e gera a comissão no extrato.</p>' });
        if (!f) return; xx.pagamentos.push({ id: Execucao.novoId('pg'), notaId: f.get('nf'), valor: num(f.get('v')), data: f.get('d') }); nota('registrou pagamento de ' + moeda(num(f.get('v'))) + ' (Seven Comissão)', k.c);
      }
      Dados.salvar(); aviso('Registrado no Seven Processo.'); App.redesenhar();
    };
  }

  // ---------- Relatório completo da simulação (para imprimir) ----------
  function telaRelatorioSimulacao(el) {
    tipoRel = 'simulacao';
    const s = T.estado(); const e = T.entrada(s); const r = K.calcular(e); const fu = T.calcFunil(s);
    const dados = [['Base da comissão', s.base === 'lucro' ? 'Sobre o lucro líquido' : 'Sobre o preço de venda'], ['Comissão', e.pct == null ? '—' : pc(e.pct)], ['Valor da venda / contrato', moeda(e.venda)], ['Margem de lucro líquido', e.margem == null ? '—' : pc(e.margem, 2) + (s.usarCustos ? ' (calculada pelos custos)' : '')], ['Meta (quanto quero receber)', moeda(e.alvo)], ['Retenções sobre a comissão', e.retencao ? pc(e.retencao) : '—'], ['Nº de licitações', e.contratos || 1]].concat(s.usarFaixas ? [['Faixas', esc(K.lerFaixas(e.faixas).map(function (f) { return pc(f.pct) + (f.ate ? ' até ' + moeda(f.ate) : ' acima'); }).join(', ')) + (s.faixaModo === 'progressiva' ? ' (progressiva)' : '')]] : []).concat(e.fixo ? [['Fixo mensal', moeda(e.fixo)]] : []).concat((e.parceiros || []).filter(function (p) { return p.pct > 0; }).map(function (p) { return ['Parceiro: ' + esc(p.nome || '—'), pc(p.pct) + ' da comissão']; }));
    const empresa = Dados.empresaAtiva && Dados.empresaAtiva();
    el.innerHTML = abas('') + '<div class="nf-barra no-print"><a href="#/comissao">‹ Voltar ao simulador</a><span style="flex:1"></span><button class="btn primario" data-a="imprimir">🖨 Imprimir</button><button class="btn" data-a="pdf">⬇ Baixar PDF</button></div>' +
      '<div class="cm-relatorio cm-rel-sim">' + cabecalho('Simulação de comissão', (empresa ? (empresa.fantasia || empresa.razao) + ' · ' : '') + 'Seven Comissão') +
      '<div class="cm-rel-2"><section class="cartao"><h3>Dados</h3><dl class="cl-res">' + dados.map(function (d) { return '<div><dt>' + esc(d[0]) + '</dt><dd>' + d[1] + '</dd></div>'; }).join('') + '</dl></section><section class="cartao"><h3>Resultado</h3>' + T.resumo(r, false) + '</section></div>' +
      '<section class="cartao"><h3>Funil das licitações</h3>' + tabela([['Etapa'], ['% do anterior', 1], ['% do topo', 1], ['Esperado com ' + (fu.base == null ? '—' : fu.base) + ' editais', 1], ['Para ' + fu.contratos + ' contrato(s)', 1]], fu.etapas.map(function (k) { return '<tr><th>' + esc(k.nome) + '</th><td class="n">' + (k.conversao == null ? '—' : pc(k.conversao, 1)) + '</td><td class="n">' + (k.doTopo == null ? '—' : pc(k.doTopo, 2)) + '</td><td class="n">' + (k.esperados == null ? '—' : k.esperados.toLocaleString('pt-BR', { maximumFractionDigits: 1 })) + '</td><td class="n">' + (k.necessarios == null ? '—' : k.necessarios) + '</td></tr>'; }), '') + (fu.taxaDisputa != null ? '<p class="mini">Taxa de sucesso por disputa: <b>' + pc(fu.taxaDisputa, 2) + '</b>.</p>' : '') + '</section>' +
      T.secoesExtras(s) + T.tabelaCenarios(s) + '</div>';
    el.onclick = function (ev) { const b = ev.target.closest('[data-a]'); if (b && b.dataset.a === 'imprimir') imprimir(); if (b && b.dataset.a === 'pdf') imprimir(true); };
  }

  T.rel = { cabecalho: cabecalho, kpis: kpis, tabela: tabela, linkCartao: linkCartao, cfgDe: cfgDe, cfgCliente: cfgCliente, cfgCalc: cfgCalc, textoCfg: textoCfg, nomeEmpresa: nomeEmpresa, imprimir: imprimir, funilReal: funilReal, barraMeta: barraMeta, mesAtual: mesAtual, nomeMes: nomeMes };
  T.render = function (el, sub) {
    if (sub === 'performance' || sub === 'mes') { location.replace('#/relatorios'); return; }
    if (sub === 'condicoes') return telaCondicoes(el);
    if (sub === 'extrato') return telaExtrato(el);
    if (sub === 'ganhas') return telaGanhas(el);
    if (sub === 'relatorio') return telaRelatorioSimulacao(el);
    el.innerHTML = abas('') + '<div id="cm-sim"></div>';
    const box = el.querySelector('#cm-sim'); T.simulador(box);
    const g = box.querySelector('#cm-form .grupo-botoes'); if (g) g.insertAdjacentHTML('afterbegin', '<a class="btn mini primario" href="#/comissao/relatorio">🖨 Relatório completo</a>');
  };
})();
