/* Seven Comissão: comissão sobre o preço de venda ou sobre o lucro líquido, com metas e todos os cenários.
   O cálculo está em js/comissao.js; os valores digitados ficam salvos e são os mesmos da janela flutuante. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, campo, aviso } = UI;
  const K = Comissao;
  const PADRAO = { base: 'venda', pct: '5', venda: '', margem: '', alvo: '', retencao: '', contratos: '1', usarCustos: false, custo: '', impostos: '', despesas: '', pcts: '1 2 3 4 5 7,5 10 15 20 25 30', margens: '5 10 15 20 25 30', dataSessao: '', prazos: {}, funil: { modo: 'pct', pct: {}, qtd: {} }, taxa: '20', disputasMes: '8', custoDisputa: '', custoFixo: '', usarFaixas: false, faixaModo: 'total', faixas: [{ ate: '500.000', pct: '3' }, { ate: '', pct: '5' }], fixo: '', parceiros: [] };

  function estado() { const d = Dados.e; d.comissao = Object.assign({}, PADRAO, d.comissao || {}); return d.comissao; }
  function n(v) { if (v == null || String(v).trim() === '') return null; const x = Nucleo.lerNumeroBR(v); return isFinite(x) ? x : null; }
  function pc(v, c) { return v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: c == null ? 2 : c }) + '%'; }
  // números a partir do que foi digitado (margem pelos custos quando marcado)
  function entrada(s) {
    s = s || estado(); const venda = n(s.venda);
    const margem = s.usarCustos ? K.margemDosCustos(venda, n(s.custo), n(s.impostos), n(s.despesas)) : n(s.margem);
    return Object.assign({ base: s.base, pct: n(s.pct), venda: venda, margem: margem, alvo: n(s.alvo), retencao: n(s.retencao), contratos: n(s.contratos) }, cfgAvancado(s));
  }
  // ---------- faixas, fixo mensal e parceiros (simulador e condições de cada cliente) ----------
  function cfgAvancado(c) {
    return { faixas: c.usarFaixas ? (c.faixas || []).map(function (f) { return { ate: n(f.ate), pct: n(f.pct) }; }) : null, faixaModo: c.faixaModo, fixo: n(c.fixo), parceiros: (c.parceiros || []).map(function (x) { return { nome: x.nome, pct: n(x.pct) }; }) };
  }
  function editorAvancado(c, doCliente) {
    const fx = c.faixas && c.faixas.length ? c.faixas : PADRAO.faixas; const ps = c.parceiros || [];
    return '<fieldset class="cm-av"><legend>Comissão em faixas</legend><label class="check"><input type="checkbox" name="usarFaixas"' + (c.usarFaixas ? ' checked' : '') + '> O percentual muda conforme o valor (substitui o % fixo)</label>' +
      '<div class="cm-faixas"' + (c.usarFaixas ? '' : ' hidden') + '>' + campo('Como aplicar', '<select name="faixaModo"><option value="total"' + (c.faixaModo !== 'progressiva' ? ' selected' : '') + '>A faixa do valor vale para o total</option><option value="progressiva"' + (c.faixaModo === 'progressiva' ? ' selected' : '') + '>Progressiva (cada parte na sua faixa, como no IR)</option></select>') +
      fx.map(function (f, i) { return '<div class="cm-linha-av"><span>' + (i === 0 ? 'Até' : 'De ' + esc(fx[i - 1].ate || '…') + ' até') + '</span><input name="faixa_ate_' + i + '" inputmode="decimal" placeholder="sem limite" value="' + esc(f.ate || '') + '" aria-label="Limite da faixa ' + (i + 1) + ' (R$)"><span>R$ →</span><input name="faixa_pct_' + i + '" inputmode="decimal" value="' + esc(f.pct || '') + '" aria-label="Percentual da faixa ' + (i + 1) + '"><span>%</span>' + (fx.length > 1 ? '<button type="button" class="icone" data-a="del-faixa" data-i="' + i + '" aria-label="Remover faixa">×</button>' : '') + '</div>'; }).join('') +
      '<button type="button" class="btn mini" data-a="add-faixa">+ Faixa</button><p class="mini mudo">Deixe o limite da última faixa em branco para "acima disso". A base é a venda ou o lucro, conforme a escolha acima.</p></div></fieldset>' +
      '<fieldset class="cm-av"><legend>Fixo mensal + êxito</legend><div class="linha">' + campo('Mensalidade do BPO (R$)', '<input name="fixo" inputmode="decimal" value="' + esc(c.fixo || '') + '" placeholder="0,00">', 'Somada à comissão. A meta desconta o fixo.') +
      (doCliente ? campo('Cobrada desde', '<input type="month" name="fixoDesde" value="' + esc(c.fixoDesde || '') + '">') + campo('Dia do vencimento', '<input name="diaVenc" inputmode="numeric" value="' + esc(c.diaVenc || '10') + '">') : '') + '</div></fieldset>' +
      '<fieldset class="cm-av"><legend>Divisão com parceiros</legend>' + (ps.length ? ps.map(function (x, i) { return '<div class="cm-linha-av"><input name="parc_nome_' + i + '" value="' + esc(x.nome || '') + '" placeholder="Nome do parceiro ou indicador" aria-label="Parceiro ' + (i + 1) + '"><input name="parc_pct_' + i + '" inputmode="decimal" value="' + esc(x.pct || '') + '" placeholder="%" aria-label="Percentual do parceiro ' + (i + 1) + '"><span>% da comissão</span><button type="button" class="icone" data-a="del-parceiro" data-i="' + i + '" aria-label="Remover parceiro">×</button></div>'; }).join('') : '<p class="mini mudo">Nenhum parceiro. O repasse sai da comissão bruta, antes das retenções.</p>') + '<button type="button" class="btn mini" data-a="add-parceiro">+ Parceiro</button></fieldset>' +
      (doCliente ? '<label class="check cm-auto"><input type="checkbox" name="autoFinanceiro"' + (c.autoFinanceiro ? ' checked' : '') + '> Lançar automaticamente no Seven Financeiro: cada pagamento do órgão gera a cobrança da comissão (e a mensalidade, todo mês); quando ela é recebida, entram os repasses aos parceiros.</label>' : '');
  }
  function lerAvancado(form, c) {
    const el = form.elements; if (!el.fixo) return c;
    c.usarFaixas = !!(el.usarFaixas && el.usarFaixas.checked); if (el.faixaModo) c.faixaModo = el.faixaModo.value;
    const fx = []; for (let i = 0; el['faixa_pct_' + i]; i++) fx.push({ ate: el['faixa_ate_' + i].value, pct: el['faixa_pct_' + i].value }); if (fx.length) c.faixas = fx;
    c.fixo = el.fixo.value; if (el.fixoDesde) c.fixoDesde = el.fixoDesde.value; if (el.diaVenc) c.diaVenc = el.diaVenc.value;
    const ps = []; for (let i = 0; el['parc_nome_' + i]; i++) ps.push({ nome: el['parc_nome_' + i].value, pct: el['parc_pct_' + i].value }); c.parceiros = ps;
    if (el.autoFinanceiro) c.autoFinanceiro = el.autoFinanceiro.checked;
    return c;
  }
  function acaoAvancado(c, a, i) {
    if (a === 'add-faixa') { c.faixas = (c.faixas && c.faixas.length ? c.faixas : PADRAO.faixas).slice(); const ult = c.faixas[c.faixas.length - 1]; c.faixas.splice(c.faixas.length - (ult && !ult.ate ? 1 : 0), 0, { ate: '', pct: '' }); c.usarFaixas = true; return true; }
    if (a === 'del-faixa') { c.faixas = (c.faixas || []).filter(function (x, k) { return k !== Number(i); }); return true; }
    if (a === 'add-parceiro') { c.parceiros = (c.parceiros || []).concat([{ nome: '', pct: '' }]); return true; }
    if (a === 'del-parceiro') { c.parceiros = (c.parceiros || []).filter(function (x, k) { return k !== Number(i); }); return true; }
    return false;
  }

  let tSalvar = null;
  function salvarDepois() { clearTimeout(tSalvar); tSalvar = setTimeout(function () { tSalvar = null; Dados.salvar(); }, 500); }
  function salvarJa() { if (tSalvar) { clearTimeout(tSalvar); tSalvar = null; Dados.salvar(); } }
  window.addEventListener('pagehide', salvarJa); window.addEventListener('beforeunload', salvarJa); window.addEventListener('hashchange', salvarJa);
  function avisarMudanca(origem) { document.dispatchEvent(new CustomEvent('comissao:mudou', { detail: { origem: origem } })); }

  // ---------- partes reaproveitadas pela janela flutuante ----------
  function camposBase(s, compacto) {
    const nomeBase = { venda: 'Sobre o preço de venda', lucro: 'Sobre o lucro líquido' };
    return '<div class="cm-base" role="radiogroup" aria-label="Base da comissão">' + ['venda', 'lucro'].map(function (b) { return '<label class="cm-pilula"><input type="radio" name="base" value="' + b + '"' + (s.base === b ? ' checked' : '') + '><span>' + (compacto ? (b === 'venda' ? 'Sobre a venda' : 'Sobre o lucro') : nomeBase[b]) + '</span></label>'; }).join('') + '</div>' +
      '<div class="linha">' + campo(compacto ? 'Comissão %' : 'Comissão (%)', '<input name="pct" inputmode="decimal" value="' + esc(s.pct) + '" placeholder="5">') + campo(compacto ? 'Venda (R$)' : 'Valor da venda / contrato (R$)', '<input name="venda" inputmode="decimal" value="' + esc(s.venda) + '" placeholder="200.000,00">') + '</div>' +
      '<div class="linha">' + campo(compacto ? 'Margem líquida %' : 'Margem de lucro líquido (%)', '<input name="margem" inputmode="decimal" value="' + esc(s.margem) + '" placeholder="12">', compacto ? '' : (s.usarCustos ? 'Calculada pelos custos do contrato. Digite aqui para informar outra margem.' : 'Lucro que sobra da venda depois de custos, impostos e despesas, em % da venda.')) +
      campo(compacto ? 'ou Lucro (R$)' : 'ou o lucro líquido em reais (R$)', '<input name="lucroValor" inputmode="decimal" value="' + esc(lucroDe(s)) + '" placeholder="24.000,00">', compacto ? '' : 'Se souber o lucro em reais, digite aqui: a margem é calculada.').replace('<label class="campo"', '<label class="campo cm-so-lucro"' + (s.base === 'lucro' ? '' : ' hidden')) + '</div>' +
      '<div class="linha">' + campo(compacto ? 'Meta (R$)' : 'Quanto quero receber (R$)', '<input name="alvo" inputmode="decimal" value="' + esc(s.alvo) + '" placeholder="15.000,00">', compacto ? '' : 'Sua meta de comissão, já líquida.') +
      campo(compacto ? 'Retenção %' : 'Retenções sobre a comissão (%)', '<input name="retencao" inputmode="decimal" value="' + esc(s.retencao) + '" placeholder="0">', compacto ? '' : 'Impostos ou descontos sobre o que você recebe. A meta é líquida.') + campo(compacto ? 'Licitações' : 'Nº de licitações', '<input name="contratos" inputmode="numeric" value="' + esc(s.contratos) + '" placeholder="1">', compacto ? '' : 'Divide a venda necessária entre os contratos.') + '</div>';
  }
  // lucro em R$ a partir da venda e da margem (o que fica salvo é a margem)
  function lucroDe(s) { const v = n(s.venda), m = s.usarCustos ? K.margemDosCustos(v, n(s.custo), n(s.impostos), n(s.despesas)) : n(s.margem); return v && m != null ? fmtBR(v * m / 100) : ''; }
  function fmtBR(v) { return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  // mantém margem (%) e lucro (R$) coerentes no formulário: quem está sendo digitado manda no outro
  function sincronizarLucro(form) {
    const lv = form.elements.lucroValor, mg = form.elements.margem, vd = form.elements.venda; if (!lv || !mg || mg.disabled) return;
    const venda = n(vd && vd.value);
    if (document.activeElement === lv) { const l = n(lv.value); mg.value = venda && l != null ? String(Math.round(l / venda * 1e6) / 1e4).replace('.', ',') : (lv.value.trim() ? mg.value : ''); }
    else { const m = n(mg.value); lv.value = venda && m != null ? fmtBR(venda * m / 100) : ''; }
  }
  function passosHTML(r, compacto) {
    const ps = K.passos(r, { moeda: moeda, pct: function (v) { return pc(v, 2); } }); if (!ps.length) return '';
    return '<details class="cm-passos"' + (compacto ? '' : ' open') + '><summary>Como a conta foi feita</summary><ol>' + ps.map(function (p) { if (p.meta) return '</ol><p class="cm-passos-meta">' + esc(p.t) + '</p><ol>'; return '<li class="' + (p.total ? 'total' : '') + (p.alerta ? ' alerta' : '') + '"><span>' + esc(p.t) + '</span>' + (p.c ? '<b>' + esc(p.c) + '</b>' : '') + '</li>'; }).join('') + '</ol></details>';
  }
  // a meta em linguagem simples: uma frase e o caminho do dinheiro, do contrato até o seu bolso
  function blocoMeta(r, compacto) {
    if (r.alvo == null) return '';
    if (r.vendaNecessaria == null) return '<div class="cm-meta-bloco"><p class="cm-meta-frase">🎯 Para saber quanto o cliente precisa ganhar, informe ' + (r.base === 'lucro' && r.margem == null ? 'a margem de lucro do cliente (%) ou o lucro em R$' : 'o percentual da sua comissão') + '.</p></div>';
    const P = function (v) { return pc(v, 2); };
    const passos = [['O cliente ganha em licitações', moeda(r.vendaNecessaria), 'valor total dos contratos']];
    if (r.base === 'lucro' && r.margem) passos.push(['Sobra de lucro para ele', moeda(r.vendaNecessaria * r.margem / 100), P(r.margem) + ' do que vendeu']);
    passos.push(['Sua comissão', moeda(r.alvoBruto), (r.faixas ? 'pelas faixas' : P(r.pct)) + (r.base === 'lucro' ? ' do lucro' : ' da venda')]);
    if (Math.abs(r.alvoBruto - r.alvoVariavel) > 0.005) passos.push(['Depois de parceiros e impostos', moeda(r.alvoVariavel), 'o que fica com você']);
    if (r.fixo) passos.push(['Mais o fixo mensal', moeda(r.fixo), 'mensalidade']);
    passos.push(['Você recebe', moeda(r.alvo), 'sua meta ✓']);
    const atual = r.venda != null && r.comissaoLiquida != null ? (r.atingiu ? '<p class="cm-meta-hoje ok">✓ Com a venda informada (' + moeda(r.venda) + ') você já recebe ' + moeda(r.totalMes) + ' e alcança a meta.</p>' : '<p class="cm-meta-hoje">Hoje, com a venda informada (' + moeda(r.venda) + '), você recebe ' + moeda(r.totalMes) + '. Faltam ' + moeda(r.falta) + ' para a meta.</p>') : '';
    return '<div class="cm-meta-bloco"><p class="cm-meta-frase">🎯 Para você receber <b>' + moeda(r.alvo) + '</b>, o seu cliente precisa ganhar <b>' + moeda(r.vendaNecessaria) + '</b> em licitações.</p>' +
      (r.contratos > 1 && r.vendaPorContrato != null ? '<p class="mini mudo">São ' + r.contratos + ' licitações de ' + moeda(r.vendaPorContrato) + ' cada, por exemplo.</p>' : '') +
      (compacto ? '' : '<ol class="cm-caminho">' + passos.map(function (x, i) { return '<li class="' + (i === passos.length - 1 ? 'fim' : '') + '"><small>' + esc(x[0]) + '</small><b>' + x[1] + '</b><span>' + esc(x[2]) + '</span></li>'; }).join('') + '</ol>') + atual + '</div>';
  }
  function resumo(r, compacto) {
    const linhas = [];
    const titulo = r.base === 'venda' ? 'sobre o preço de venda' : 'sobre o lucro líquido';
    linhas.push('<div class="cm-destaque"><small>Você recebe (' + esc(titulo) + ')</small><b>' + moeda(r.comissaoLiquida) + '</b>' + (r.retida ? '<span class="mini mudo">Bruto ' + moeda(r.comissaoBruta) + ' · retido ' + moeda(r.retida) + '</span>' : '') + '</div>');
    if (r.base === 'lucro' && r.prejuizo) linhas.push('<p class="alerta mini">Sem lucro líquido neste contrato: não há comissão sobre o lucro.</p>');
    linhas.push(blocoMeta(r, compacto));
    const dl = [];
    if (r.alvo != null) {
      if (r.base === 'lucro' && r.margemNecessaria != null) dl.push(['Ou: margem que o cliente precisa ter, mantendo a venda de ' + moeda(r.venda), r.margemImpossivel ? pc(r.margemNecessaria, 1) + ' (inviável)' : pc(r.margemNecessaria, 2), 1]);
      if (r.pctNecessario != null) dl.push(['Ou: % de comissão que você precisaria cobrar nesta venda', pc(r.pctNecessario, 2)]);
    }
    if (r.faixas) dl.push([r.faixaAplicada ? 'Faixa aplicada' : 'Faixas progressivas', (r.faixaAplicada ? pc(r.faixaAplicada.pct) + (r.faixaAplicada.ate ? ' (até ' + moeda(r.faixaAplicada.ate) + ')' : ' (acima da última faixa)') + ' · ' : '') + 'efetivo ' + pc(r.pctEfetivo, 2)]);
    if (r.repasse) { dl.push(['Repasse a parceiros', moeda(r.repasse)]); if (!compacto) r.porParceiro.forEach(function (x) { dl.push(['· ' + (x.nome || 'Parceiro') + ' (' + pc(x.pct) + ')', moeda(x.valor)]); }); }
    if (r.fixo) { dl.push(['Fixo mensal', moeda(r.fixo)]); dl.push(['Total no mês (comissão + fixo)', moeda(r.totalMes), 1]); }
    if (r.lucro != null) dl.push(['Lucro líquido do contrato', moeda(r.lucro) + ' (' + pc(r.margem, 2) + ')']);
    if (r.equivalente != null) dl.push([r.base === 'lucro' ? 'Equivale sobre a venda a' : 'Equivale sobre o lucro a', pc(r.equivalente, 2)]);
    if (!compacto && r.comissaoSobreVenda != null && r.comissaoSobreLucro != null) dl.push(['Comparando no mesmo %', 'venda ' + moeda(r.comissaoSobreVenda) + ' · lucro ' + moeda(r.comissaoSobreLucro)]);
    if (dl.length) linhas.push('<dl class="cl-res">' + dl.map(function (l) { return '<div' + (l[2] ? ' class="dest"' : '') + '><dt>' + esc(l[0]) + '</dt><dd>' + l[1] + '</dd></div>'; }).join('') + '</dl>');
    if (r.venda == null && r.alvo == null) linhas.push('<p class="mudo mini">Informe a comissão e o valor da venda, ou a meta que quer receber.</p>');
    linhas.push(passosHTML(r, compacto));
    return linhas.join('');
  }
  // aplica o que foi digitado num formulário ao estado salvo
  function lerForm(form) {
    const s = estado(); sincronizarLucro(form); const fd = new FormData(form);
    ['pct', 'venda', 'margem', 'alvo', 'retencao', 'contratos', 'custo', 'impostos', 'despesas', 'pcts', 'margens'].forEach(function (k) { if (form.elements[k] && !form.elements[k].disabled) s[k] = fd.get(k); });
    ['dataSessao', 'taxa', 'disputasMes', 'custoDisputa', 'custoFixo'].forEach(function (k) { if (form.elements[k]) s[k] = fd.get(k); });
    if (fd.get('funilModo') || K.FUNIL.some(function (e) { return form.elements['f_' + e.id]; })) { const fu = s.funil = Object.assign({ modo: 'pct', pct: {}, qtd: {} }, s.funil); const de = fd.get('funilAtual') === 'qtd' ? 'qtd' : 'pct'; K.FUNIL.forEach(function (e, k) { const i = form.elements['f_' + e.id]; if (!i || i.disabled) return; if (k === 0 && de === 'pct') { fu.base = i.value; return; } fu[de] = Object.assign({}, fu[de]); fu[de][e.id] = i.value; }); if (fd.get('funilModo')) fu.modo = fd.get('funilModo'); }
    K.ETAPAS.forEach(function (e) { if (form.elements['p_' + e.id]) { s.prazos = Object.assign({}, s.prazos); s.prazos[e.id] = fd.get('p_' + e.id); } if (form.elements['t_' + e.id]) { s.prazoTipo = Object.assign({}, s.prazoTipo); s.prazoTipo[e.id] = fd.get('t_' + e.id); } });
    if (form.elements.pzProrrogar) { s.pzProrrogar = form.elements.pzProrrogar.checked; s.pzFacultativos = form.elements.pzFacultativos.checked; s.pzFeriados = fd.get('pzFeriados'); }
    if (fd.get('base')) { s.base = fd.get('base'); const sl = form.querySelector('.cm-so-lucro'); if (sl) sl.hidden = s.base !== 'lucro'; }
    if (form.elements.usarCustos) s.usarCustos = form.elements.usarCustos.checked;
    lerAvancado(form, s);
    return s;
  }

  // ---------- prazos, chances e retorno ----------
  function hoje() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function etapas(s) { return K.ETAPAS.map(function (e) { const v = (s.prazos || {})[e.id]; return { id: e.id, nome: e.nome, dias: v == null || String(v).trim() === '' ? e.dias : n(v), tipo: (s.prazoTipo || {})[e.id] === 'uteis' ? 'uteis' : 'corridos' }; }); }
  // feriados locais: "20/01/2026, 24/10/2026" → ISO
  function feriadosLocais(txt) { return String(txt || '').split(/[,;\s]+/).map(function (x) { const m = x.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }).filter(Boolean); }
  function opcPrazo(s) { return { prorrogar: s.pzProrrogar !== false, facultativos: !!s.pzFacultativos, extras: feriadosLocais(s.pzFeriados) }; }
  function dataBR(iso) { return iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; }
  function funilEtapas(s) { const fu = Object.assign({ modo: 'pct', pct: {}, qtd: {} }, s.funil); const v = function (x, d) { return x == null || String(x).trim() === '' ? d : n(x); }; return K.FUNIL.map(function (e) { return { id: e.id, nome: e.nome, pct: v((fu.pct || {})[e.id], e.pct), qtd: v((fu.qtd || {})[e.id], e.qtd) }; }); }
  function baseFunil(s) { const b = (s.funil || {}).base; return b == null || String(b).trim() === '' ? 100 : n(b); }
  function calcFunil(s) { return K.funil(funilEtapas(s), (s.funil || {}).modo === 'qtd' ? 'qtd' : 'pct', n(s.contratos), baseFunil(s)); }
  function extras(s) {
    s = s || estado(); const r = K.calcular(entrada(s)); const fu = calcFunil(s); const taxa = fu.taxaDisputa;
    const pz = K.prazos(s.dataSessao || hoje(), etapas(s), opcPrazo(s));
    const ch = K.chances(taxa, n(s.contratos));
    const rt = K.retorno({ fixoMes: n(s.fixo), taxa: taxa, disputasMes: n(s.disputasMes), custoDisputa: n(s.custoDisputa), custoFixo: n(s.custoFixo), comissaoPorVitoria: r.comissaoLiquida, diasRecebimento: pz ? pz.totalDias : 0, meses: 36 });
    return { r: r, prazo: pz, chances: ch, retorno: rt, funil: fu, taxa: taxa };
  }
  function meses(m) { return m == null ? '—' : m + (m === 1 ? ' mês' : ' meses'); }
  function resumoExtra(x, compacto) {
    const dl = [];
    if (x.prazo) dl.push(['Comissão chega em', dataBR(x.prazo.dataFinal) + ' (' + x.prazo.totalDias + ' dias)']);
    if (x.chances) dl.push(['Disputas para a 1ª vitória', '~' + Math.ceil(x.chances.esperadoPrimeira) + ' (90% de chance: ' + x.chances.confianca[2].disputas + ')']);
    if (x.chances && x.chances.vitorias > 1) dl.push(['Disputas para ' + x.chances.vitorias + ' vitórias', '~' + Math.ceil(x.chances.esperadoVitorias)]);
    if (x.retorno) dl.push(['Retorno do investimento', x.retorno.mesRetorno ? 'no ' + x.retorno.mesRetorno + 'º mês' : 'não se paga em 36 meses', 1]);
    if (x.retorno && !compacto) dl.push(['Caixa necessário até o retorno', moeda(x.retorno.investimentoMaximo)]);
    return dl.length ? '<dl class="cl-res cm-extra-res">' + dl.map(function (l) { return '<div' + (l[2] ? ' class="dest"' : '') + '><dt>' + esc(l[0]) + '</dt><dd>' + l[1] + '</dd></div>'; }).join('') + '</dl>' : '';
  }
  function formFunil(s) {
    const modo = (s.funil || {}).modo === 'qtd' ? 'qtd' : 'pct'; const et = funilEtapas(s);
    return '<h3>Funil das licitações</h3><p class="mini mudo">Preencha com os seus números: eles mudam com o tempo, o tipo de objeto e o cliente. A taxa de sucesso usada nos cálculos abaixo sai daqui.</p>' +
      '<input type="hidden" name="funilAtual" value="' + modo + '">' + '<div class="cm-base" role="radiogroup" aria-label="Como preencher o funil">' + [['pct', 'Em % de cada etapa'], ['qtd', 'Por quantidades do histórico']].map(function (m) { return '<label class="cm-pilula"><input type="radio" name="funilModo" value="' + m[0] + '"' + (modo === m[0] ? ' checked' : '') + '><span>' + m[1] + '</span></label>'; }).join('') + '</div>' +
      '<div class="tabela-rolagem"><table class="tabela compacta cm-funil"><thead><tr><th>Etapa</th><th class="n">' + (modo === 'qtd' ? 'Quantidade' : 'Editais e % de cada etapa') + '</th><th class="n">% do anterior</th><th class="n">% do topo</th><th class="cm-barra-col"></th><th class="n">Esperado com <span class="cm-fn-b"></span></th><th class="n">Para <span class="cm-fn-v"></span></th></tr></thead><tbody>' +
      et.map(function (e, i) { const val = modo === 'qtd' ? e.qtd : e.pct; return '<tr data-et="' + e.id + '"><th>' + esc(e.nome) + '</th><td class="n"><input name="f_' + e.id + '" inputmode="decimal" aria-label="' + esc(e.nome) + '" value="' + esc(String(i === 0 && modo === 'pct' ? baseFunil(s) : val == null ? '' : val).replace('.', ',')) + '"' + (i === 0 && modo === 'pct' ? ' title="Quantos editais você encontra (por mês ou no período que quiser analisar)"' : '') + '><span class="cm-un">' + (i === 0 ? 'editais' : modo === 'qtd' ? '' : '%') + '</span></td><td class="n" data-c="conv"></td><td class="n" data-c="topo"></td><td class="cm-barra-col"><span class="cm-barra"><i></i></span></td><td class="n" data-c="esp"></td><td class="n" data-c="nec"></td></tr>'; }).join('') + '</tbody></table></div><p class="cm-funil-res"></p><p class="cm-funil-usar"></p>';
  }
  function atualizarFunil(box, s) {
    const f = calcFunil(s); box.querySelector('.cm-fn-b').textContent = f.base == null ? '—' : f.base.toLocaleString('pt-BR') + ' editais'; box.querySelector('.cm-fn-v').textContent = f.contratos + (f.contratos === 1 ? ' contrato' : ' contratos');
    f.etapas.forEach(function (e) { const tr = box.querySelector('tr[data-et="' + e.id + '"]'); if (!tr) return; tr.querySelector('[data-c=conv]').textContent = e.conversao == null ? '—' : pc(e.conversao, 1); tr.querySelector('[data-c=topo]').textContent = e.doTopo == null ? '—' : pc(e.doTopo, 2); tr.querySelector('[data-c=nec]').textContent = e.necessarios == null ? '—' : e.necessarios.toLocaleString('pt-BR'); tr.querySelector('[data-c=esp]').textContent = e.esperados == null ? '—' : e.esperados.toLocaleString('pt-BR', { maximumFractionDigits: 1 }); tr.querySelector('.cm-barra i').style.width = Math.max(1.5, e.doTopo || 0) + '%'; tr.classList.toggle('gargalo', !!(f.gargalo && f.gargalo.id === e.id)); });
    box.querySelector('.cm-funil-res').innerHTML = f.taxaDisputa == null ? '<span class="alerta">Complete o funil para calcular a taxa de sucesso.</span>' : 'Taxa de sucesso por disputa: <b>' + pc(f.taxaDisputa, 2) + '</b> · do edital encontrado ao contrato: <b>' + pc(f.taxaGeral, 2) + '</b>' + (f.gargalo ? ' · maior perda em <b>' + esc(f.gargalo.nome) + '</b> (' + pc(f.gargalo.conversao, 1) + ')' : '') + '.';
    const disp = f.etapas.find(function (e) { return e.id === 'disputas'; }), fim = f.etapas[f.etapas.length - 1];
    const usar = box.querySelector('.cm-funil-usar'); const novo = disp && disp.esperados != null ? 'Com ' + f.base.toLocaleString('pt-BR') + ' editais encontrados: cerca de <b>' + disp.esperados.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' disputas</b> e <b>' + fim.esperados.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' contratos</b>. <button type="button" class="btn mini" data-a="usar-disputas" data-v="' + Math.round(disp.esperados * 10) / 10 + '">Usar como disputas por mês</button>' : '';
    if (usar.innerHTML !== novo) usar.innerHTML = novo; // não troca o botão no meio de um clique
  }
  function secoesExtras(s) {
    const x = extras(s); let h = '';
    // prazo
    h += '<section class="cartao"><h3>Prazo para recebimento</h3>';
    h += x.prazo ? '<ol class="cm-linha-tempo"><li class="ini"><b>' + dataBR(x.prazo.inicio) + '</b><span>Sessão da licitação</span></li>' + x.prazo.etapas.map(function (e) { return '<li' + (e.id === 'pagamento' ? ' class="pg"' : e.id === 'comissao' ? ' class="fim"' : '') + '><b>' + dataBR(e.data) + '</b><span>' + esc(e.nome) + '</span><small>+' + e.dias + (e.tipo === 'uteis' ? ' dias úteis (' + e.corridosEtapa + ' corridos)' : ' dias corridos') + (e.prorrogado ? ' · vencimento prorrogado para dia útil' : '') + ' · ' + e.acumulado + ' no total</small></li>'; }).join('') + '</ol>' +
      '<p class="cm-prazo-res">O órgão paga por volta de <b>' + dataBR(x.prazo.dataPagamento) + '</b> (' + x.prazo.diasAtePagamento + ' dias após a sessão) e a comissão chega por volta de <b>' + dataBR(x.prazo.dataFinal) + '</b> (' + x.prazo.totalDias + ' dias corridos' + (x.prazo.diasUteis ? ', com ' + x.prazo.diasUteis + ' dias úteis nas etapas em dias úteis' : '') + ').</p>' : '<p class="mudo">Informe a data da sessão.</p>';
    const o = opcPrazo(s); h += '<p class="mini mudo">Contagem do art. 183 da Lei 14.133/2021: exclui o dia do começo e inclui o do vencimento. Dias úteis excluem sábados, domingos e feriados nacionais' + (o.facultativos ? ' e pontos facultativos federais' : '') + (o.extras.length ? ' e ' + o.extras.length + ' feriado(s) local(is)' : '') + (o.prorrogar ? '; vencimento em dia sem expediente passa para o próximo dia útil' : '') + '. Escolha dias úteis ou corridos em cada etapa conforme o edital e o contrato; confira o expediente do órgão (veja também o Seven CAPAG).</p></section>';
    // chances
    h += '<section class="cartao"><h3>Quantas licitações disputar para ganhar</h3>';
    if (x.chances) {
      const c = x.chances;
      h += '<div class="cm-numeros"><div><small>Em média, para a 1ª vitória</small><b>' + Math.ceil(c.esperadoPrimeira) + ' disputas</b></div>' + (c.vitorias > 1 ? '<div><small>Em média, para ' + c.vitorias + ' vitórias</small><b>' + Math.ceil(c.esperadoVitorias) + ' disputas</b></div>' : '') + c.confianca.map(function (k) { return '<div><small>' + k.confianca + '% de chance de ganhar ao menos uma</small><b>' + k.disputas + ' disputas</b></div>'; }).join('') + '</div>' +
        '<div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Disputas</th>' + c.tabela.map(function (t) { return '<th class="n">' + t.disputas + '</th>'; }).join('') + '</tr></thead><tbody><tr><th>Chance de ganhar ao menos 1</th>' + c.tabela.map(function (t) { return '<td class="n">' + pc(t.chance, 0) + '</td>'; }).join('') + '</tr><tr><th>Vitórias esperadas</th>' + c.tabela.map(function (t) { return '<td class="n">' + Number(t.esperadas).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '</td>'; }).join('') + '</tr></tbody></table></div>' +
        '<p class="mini mudo">Taxa de sucesso de ' + pc(c.taxa) + ' por disputa, calculada pelo funil (arrematadas × homologadas × contratos). Cada licitação é tratada como independente.</p>';
    } else h += '<p class="mudo">Preencha o funil: as etapas depois das disputas precisam ser maiores que zero.</p>';
    h += '</section>';
    // retorno
    h += '<section class="cartao"><h3>Prazo de retorno</h3>';
    if (x.retorno) {
      const t = x.retorno; const ate = Math.min(t.linhas.length, Math.max(12, (t.mesRetorno || 0) + 3));
      h += '<div class="cm-numeros"><div><small>1ª vitória esperada</small><b>' + meses(t.mesPrimeiraVitoria) + '</b></div><div><small>1º recebimento</small><b>' + meses(t.mesPrimeiroRecebimento) + '</b></div><div class="' + (t.mesRetorno ? 'ok' : 'ruim') + '"><small>Retorno (acumulado positivo)</small><b>' + (t.mesRetorno ? 'no ' + t.mesRetorno + 'º mês' : 'não se paga') + '</b></div><div><small>Caixa necessário até lá</small><b>' + moeda(t.investimentoMaximo) + '</b></div><div class="' + (t.viavel ? 'ok' : 'ruim') + '"><small>Resultado por mês, depois de receber</small><b>' + moeda(t.lucroMes) + '</b></div></div>' +
        (t.viavel ? '' : '<p class="alerta mini">Os custos por mês (' + moeda(t.custoMes) + ') são maiores que as comissões esperadas (' + moeda(t.receitaMes) + '). Aumente o ritmo de disputas, a taxa de sucesso ou a comissão, ou reduza os custos.</p>') +
        '<div class="tabela-rolagem"><table class="tabela compacta cm-retorno"><thead><tr><th>Mês</th><th class="n">Vitórias</th><th class="n">Comissões recebidas</th><th class="n">Custos</th><th class="n">Saldo do mês</th><th class="n">Acumulado</th></tr></thead><tbody>' + t.linhas.slice(0, ate).map(function (l) { return '<tr' + (l.mes === t.mesRetorno ? ' class="cm-atual"' : '') + '><th>' + l.mes + 'º</th><td class="n">' + Number(l.vitorias).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '</td><td class="n">' + moeda(l.receita) + '</td><td class="n">' + moeda(l.custo) + '</td><td class="n">' + moeda(l.saldo) + '</td><td class="n ' + (l.acumulado >= 0 ? 'pos' : 'neg') + '">' + moeda(l.acumulado) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<p class="mini mudo">Média esperada: ' + Number(n(s.disputasMes)).toLocaleString('pt-BR') + ' disputas por mês × ' + pc(x.taxa) + ' de sucesso (funil) × ' + moeda(x.r.comissaoLiquida) + ' por vitória, recebidas ' + t.atrasoMeses + ' mês(es) depois (prazo para recebimento acima).</p>';
    } else h += '<p class="mudo">Informe a comissão e a venda (para saber quanto cada vitória rende), o funil e quantas licitações disputa por mês.</p>';
    h += '</section>';
    return h;
  }

  // ---------- cenários ----------
  function tabelaCenarios(s) {
    const o = entrada(s); const pcts = K.lerLista(s.pcts), margens = K.lerLista(s.margens); const c = K.cenarios(o, pcts, margens);
    const cab = '<thead><tr><th>Comissão</th>' + c.colunas.map(function (col) { return '<th class="n' + (col.base === o.base && (col.base === 'venda' || Math.abs(col.margem - (o.margem || -1)) < 1e-9) ? ' cm-atual' : '') + '">' + (col.base === 'venda' ? 'Sobre a venda' : 'Lucro · margem ' + pc(col.margem, 1)) + '</th>'; }).join('') + '</tr></thead>';
    const linhaAtual = function (x) { return o.pct != null && Math.abs(x - o.pct) < 1e-9; };
    const tab = function (campoValor, vazio) {
      return '<div class="tabela-rolagem"><table class="tabela compacta cm-tab">' + cab + '<tbody>' + c.linhas.map(function (l) { return '<tr' + (linhaAtual(l.pct) ? ' class="cm-atual"' : '') + '><th>' + pc(l.pct, 2) + '</th>' + l.celulas.map(function (cel) { const v = cel[campoValor]; return '<td class="n' + (campoValor === 'comissao' && cel.atingiu ? ' cm-bate' : '') + '">' + (v == null ? vazio : moeda(v)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    };
    let h = '<section class="cartao"><h3>Quanto você recebe em cada cenário</h3>' + (o.venda == null ? '<p class="mudo">Informe o valor da venda para ver a comissão em cada cenário.</p>' : '<p class="mini mudo">Venda de ' + moeda(o.venda) + (o.retencao ? ', já descontadas as retenções de ' + pc(o.retencao) : '') + '.' + (o.alvo != null ? ' Em verde, os cenários que alcançam a meta de ' + moeda(o.alvo) + '.' : '') + '</p>' + tab('comissao', '—')) + '</section>';
    h += '<section class="cartao"><h3>Quanto precisa vender em licitação para chegar à meta</h3>' + (o.alvo == null ? '<p class="mudo">Informe quanto quer receber para ver a venda necessária.</p>' : '<p class="mini mudo">Meta de ' + moeda(o.alvo) + (o.retencao ? ' líquidos (' + moeda(o.alvo / (1 - o.retencao / 100)) + ' brutos)' : '') + (o.contratos > 1 ? ', valor total somando as ' + Math.round(o.contratos) + ' licitações' : '') + '.</p>' + tab('vendaNecessaria', '—')) + '</section>';
    h += '<section class="cartao"><h3>Margem de lucro líquido necessária (comissão sobre o lucro)</h3>' + (o.alvo == null || o.venda == null ? '<p class="mudo">Informe a venda e a meta para ver a margem que o contrato precisa ter.</p>' : '<p class="mini mudo">Com venda de ' + moeda(o.venda) + ' e meta de ' + moeda(o.alvo) + '.</p><div class="cm-margens">' + c.margensNecessarias.map(function (x) { return '<div class="cm-mg' + (x.impossivel ? ' inviavel' : '') + (linhaAtual(x.pct) ? ' atual' : '') + '"><small>' + pc(x.pct, 2) + ' do lucro</small><b>' + (x.margem == null ? '—' : pc(x.margem, 1)) + '</b>' + (x.impossivel ? '<span>inviável</span>' : '') + '</div>'; }).join('') + '</div>') + '</section>';
    return h;
  }

  function render(el) {
    const s = estado();
    el.innerHTML = '<div class="cm"><form class="cartao cm-form" id="cm-form" autocomplete="off"><h3>Dados da comissão</h3>' + camposBase(s, false) +
      '<label class="check"><input type="checkbox" name="usarCustos"' + (s.usarCustos ? ' checked' : '') + '> Calcular a margem pelos custos do contrato</label>' +
      '<div class="linha cm-custos"' + (s.usarCustos ? '' : ' hidden') + '>' + campo('Custo dos produtos/serviços (R$)', '<input name="custo" inputmode="decimal" value="' + esc(s.custo) + '">') + campo('Impostos sobre a venda (%)', '<input name="impostos" inputmode="decimal" value="' + esc(s.impostos) + '">') + campo('Outras despesas (%)', '<input name="despesas" inputmode="decimal" value="' + esc(s.despesas) + '">', 'Frete, taxas, financeiro.') + '</div>' +
      '<details class="cm-avancado"' + (s.usarFaixas || n(s.fixo) || (s.parceiros || []).length ? ' open' : '') + '><summary>Faixas, fixo mensal e parceiros</summary>' + editorAvancado(s, false) + '</details>' +
      '<div class="grupo-botoes"><button type="button" class="btn mini" data-a="janela" title="Abre a Seven Comissão em janela por cima de qualquer tela (Alt+M)">⧉ Abrir em janela flutuante</button><button type="button" class="btn mini fantasma" data-a="limpar">Limpar</button></div></form>' +
      '<section class="cartao cm-res" id="cm-res" aria-live="polite"></section></div>' +
      '<form class="cartao cm-funil-form" id="cm-funil" autocomplete="off">' + formFunil(s) + '</form>' +
      '<form class="cartao cm-extra" id="cm-extra" autocomplete="off"><h3>Prazos, chances e retorno</h3><div class="linha">' + campo('Data da sessão', '<input type="date" name="dataSessao" value="' + esc(s.dataSessao || hoje()) + '">') + campo('Disputas por mês', '<input name="disputasMes" inputmode="decimal" value="' + esc(s.disputasMes) + '">') + campo('Custo por disputa (R$)', '<input name="custoDisputa" inputmode="decimal" value="' + esc(s.custoDisputa) + '">', 'Certidões, garantias, viagens, plataformas.') + campo('Custo fixo mensal (R$)', '<input name="custoFixo" inputmode="decimal" value="' + esc(s.custoFixo) + '">', 'Equipe, sistemas, escritório.') + '</div>' +
      '<details class="cm-etapas"' + ((s.prazoTipo && Object.keys(s.prazoTipo).some(function (k) { return s.prazoTipo[k] === 'uteis'; })) ? ' open' : '') + '><summary>Dias de cada etapa até receber (úteis ou corridos)</summary>' +
      '<div class="grupo-botoes"><button type="button" class="btn mini" data-a="pz-uteis">Tudo em dias úteis</button><button type="button" class="btn mini" data-a="pz-corridos">Tudo em dias corridos</button></div>' +
      '<div class="cm-etapas-l">' + etapas(s).map(function (e) { return '<div class="cm-etapa-l"><span>' + esc(e.nome) + '</span><input name="p_' + e.id + '" inputmode="numeric" value="' + esc(String(e.dias)) + '" aria-label="Dias: ' + esc(e.nome) + '"><select name="t_' + e.id + '" aria-label="Tipo de dia: ' + esc(e.nome) + '"><option value="corridos"' + (e.tipo === 'corridos' ? ' selected' : '') + '>dias corridos</option><option value="uteis"' + (e.tipo === 'uteis' ? ' selected' : '') + '>dias úteis</option></select></div>'; }).join('') + '</div>' +
      '<label class="check"><input type="checkbox" name="pzProrrogar"' + (s.pzProrrogar !== false ? ' checked' : '') + '> Vencimento em sábado, domingo ou feriado passa para o próximo dia útil (art. 183, § 1º)</label>' +
      '<label class="check"><input type="checkbox" name="pzFacultativos"' + (s.pzFacultativos ? ' checked' : '') + '> Considerar pontos facultativos federais (Carnaval, Corpus Christi…)</label>' +
      campo('Feriados locais do órgão', '<input name="pzFeriados" value="' + esc(s.pzFeriados || '') + '" placeholder="20/01/2026, 24/10/2026">', 'Estaduais ou municipais, separados por vírgula.') + '</details></form>' +
      '<div id="cm-extra-res"></div>' +
      '<form class="cartao cm-listas" id="cm-listas"><h3>Todos os cenários</h3><div class="linha">' + campo('Percentuais de comissão', '<input name="pcts" value="' + esc(s.pcts) + '">', 'Separe por espaço. Ex.: 1 2 5 10 20 30') + campo('Margens de lucro líquido (%)', '<input name="margens" value="' + esc(s.margens) + '">', 'Colunas das tabelas de comissão sobre o lucro.') + '</div></form>' +
      '<div id="cm-cen"></div>' +
      '<details class="cartao cm-formulas"><summary>Como é calculado</summary><ul class="mini">' +
      '<li><b>Sobre a venda:</b> comissão = venda × % · venda necessária = meta ÷ %</li>' +
      '<li><b>Sobre o lucro líquido:</b> lucro = venda × margem · comissão = lucro × % · venda necessária = meta ÷ (% × margem) · margem necessária = meta ÷ (venda × %)</li>' +
      '<li><b>Retenções:</b> a meta é o que você recebe líquido; a comissão bruta necessária = meta ÷ (1 − retenção).</li>' +
      '<li><b>Equivalência:</b> X% do lucro com margem M% = X × M% da venda. Ex.: 30% do lucro com 12% de margem = 3,6% da venda.</li>' +
      '<li><b>Margem pelos custos:</b> (venda − custo − impostos − despesas) ÷ venda.</li>' +
      '<li><b>Faixas:</b> sobre o total, a faixa em que o valor cai define o % de tudo; progressiva, cada parte do valor paga o % da sua faixa.</li>' +
      '<li><b>Parceiros e fixo:</b> o repasse sai da comissão bruta; as retenções incidem sobre a sua parte; o fixo mensal soma ao que você recebe e reduz a comissão necessária para a meta.</li>' +
      '<li><b>Disputas para ganhar:</b> em média 1 ÷ taxa de sucesso; para ter C% de chance de ao menos uma vitória, n = ln(1 − C) ÷ ln(1 − taxa).</li>' +
      '<li><b>Retorno:</b> por mês, vitórias = disputas × taxa; a comissão de cada vitória entra depois do prazo para recebimento; o retorno é o mês em que o acumulado (comissões − custos) fica positivo.</li></ul></details>';
    const form = el.querySelector('#cm-form'), listas = el.querySelector('#cm-listas'), extra = el.querySelector('#cm-extra'), funilF = el.querySelector('#cm-funil');
    const atualizar = function () {
      const r = K.calcular(entrada()); el.querySelector('#cm-res').innerHTML = '<h3>Resultado</h3>' + resumo(r, false);
      el.querySelector('#cm-cen').innerHTML = tabelaCenarios(estado());
      el.querySelector('#cm-extra-res').innerHTML = secoesExtras(estado()); atualizarFunil(funilF, estado());
      if (estado().usarCustos) { const m = entrada().margem; form.elements.margem.value = m == null ? '' : String(Math.round(m * 100) / 100).replace('.', ','); if (form.elements.lucroValor) form.elements.lucroValor.value = lucroDe(estado()); }
    };
    const mudou = function (ev) {
      // digitar a margem (ou o lucro) desliga o cálculo pela planilha de custos
      if (ev && ev.target && /^(margem|lucroValor)$/.test(ev.target.name) && estado().usarCustos) { estado().usarCustos = false; if (form.elements.usarCustos) form.elements.usarCustos.checked = false; const cc = form.querySelector('.cm-custos'); if (cc) cc.hidden = true; aviso('Margem digitada: o cálculo pelos custos foi desligado.'); }
      lerForm(form); lerForm(listas); lerForm(extra);
      if (ev && ev.target && ev.target.name === 'funilModo') { lerForm(funilF); funilF.innerHTML = formFunil(estado()); } else lerForm(funilF);
      if (ev && ev.target && ev.target.name === 'usarFaixas') { form.querySelector('.cm-faixas').hidden = !estado().usarFaixas; }
      if (ev && ev.target && ev.target.name === 'usarCustos') { form.querySelector('.cm-custos').hidden = !estado().usarCustos; }
      atualizar(); salvarDepois(); avisarMudanca('tela');
    };
    form.oninput = form.onchange = mudou; listas.oninput = mudou; extra.oninput = extra.onchange = mudou; funilF.oninput = funilF.onchange = mudou;
    form.onsubmit = listas.onsubmit = extra.onsubmit = funilF.onsubmit = function (ev) { ev.preventDefault(); };
    el.onclick = function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'pz-uteis' || b.dataset.a === 'pz-corridos') { const st = estado(); st.prazoTipo = {}; K.ETAPAS.forEach(function (e) { st.prazoTipo[e.id] = b.dataset.a === 'pz-uteis' ? 'uteis' : 'corridos'; }); Dados.salvar(); avisarMudanca('tela'); App.redesenhar(); return; }
      if (acaoAvancado(estado(), b.dataset.a, b.dataset.i)) { Dados.salvar(); avisarMudanca('tela'); App.redesenhar(); return; }
      if (b.dataset.a === 'janela') ComissaoFlutuante.abrir();
      if (b.dataset.a === 'usar-disputas') { const i = el.querySelector('#cm-extra [name=disputasMes]'); i.value = String(b.dataset.v).replace('.', ','); i.dispatchEvent(new Event('input', { bubbles: true })); aviso('Disputas por mês: ' + i.value + ' (vindas do funil).'); }
      if (b.dataset.a === 'limpar') { Dados.e.comissao = Object.assign({}, PADRAO); Dados.salvar(); avisarMudanca('tela'); App.redesenhar(); aviso('Campos limpos.'); }
    };
    atualizar();
  }
  // a janela flutuante mudou algo: redesenha a tela se ela estiver aberta
  document.addEventListener('comissao:mudou', function (ev) { if (ev.detail && ev.detail.origem === 'janela' && /^#\/comissao\/?$/.test(location.hash) && document.querySelector('#cm-form')) App.redesenhar(); });

  Telas.comissao = { titulo: 'Seven Comissão', editorAvancado: editorAvancado, lerAvancado: lerAvancado, acaoAvancado: acaoAvancado, cfgAvancado: cfgAvancado, render: render, simulador: render, tabelaCenarios: tabelaCenarios, secoesExtras: secoesExtras, calcFunil: calcFunil, dataBR: dataBR, pc: pc, hoje: hoje, estado: estado, entrada: entrada, camposBase: camposBase, resumo: resumo, lerForm: lerForm, extras: extras, resumoExtra: resumoExtra, salvarDepois: salvarDepois, avisarMudanca: avisarMudanca };
})();
