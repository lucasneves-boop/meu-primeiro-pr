/* Seven Precificação › Vários itens: planilha de formação de preços de uma proposta inteira.
   Parâmetros globais valem para todos os itens ao mesmo tempo; qualquer item pode ser precificado
   individualmente (sobrescreve só o que for preenchido). Gera a proposta completa no fim. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, num, campo, opcoes, modal, aviso, confirmar, cnpj } = UI;
  const P = Precos;
  const PARAMS = { regime: 'simples', impostos: 6, comissao: 0, comissaoBase: 'preco', taxaBpo: 0, bpoBase: 'preco', despesasFixas: 5, difal: 0, prazoPagamento: 30, taxaMes: 1.5, custoFinanceiro: '', garantia: 0, outrosPct: 0, margem: 10, margemMinima: 3, freteEntregaTotal: '', rateioFrete: 'valor', casas: 2, engenharia: false };
  const MODOS = [{ v: 'margem', t: 'Margem' }, { v: 'preco', t: 'Preço-alvo' }, { v: 'desconto', t: 'Desconto %' }];
  // Campos que o item pode sobrescrever quando é precificado individualmente.
  const INDIVIDUAIS = [['impostos', 'Impostos sobre a venda', '%'], ['comissao', 'Comissão', '%'], ['taxaBpo', 'Taxa da Seven (BPO)', '%'], ['despesasFixas', 'Rateio de despesas fixas', '%'], ['difal', 'DIFAL / ICMS não recuperável', '%'], ['prazoPagamento', 'Prazo de pagamento', 'dias'], ['taxaMes', 'Custo do dinheiro (ao mês)', '%'], ['custoFinanceiro', 'Custo financeiro (opcional)', '%'], ['garantia', 'Seguro-garantia', '%'], ['outrosPct', 'Outros sobre o preço', '%'], ['margem', 'Margem líquida desejada', '%']];
  let atual = null; let selecionados = {};

  function e() { const d = Dados.e; d.planilhasPreco = d.planilhasPreco || []; return d; }
  const n = function (v) { return v === '' || v == null ? '' : typeof v === 'number' ? v : Nucleo.lerNumeroBR(v); };
  const br = function (v) { return v === '' || v == null ? '' : String(v).replace('.', ','); };
  const brM = function (v) { if (v === '' || v == null) return ''; const x = Number(v); if (!isFinite(x)) return String(v); return x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4, useGrouping: false }); };
  const pc = function (v) { return v == null || !isFinite(v) ? '—' : num(v, 2) + '%'; };
  function daEmpresa() { const a = Dados.empresaAtiva(); return e().planilhasPreco.filter(function (x) { return !a || !x.empresaId || x.empresaId === a.id; }); }
  function nova(dados) {
    const x = Object.assign({ id: Dados.id('pp'), nome: 'Nova planilha', empresaId: Dados.e.empresaAtiva, propostaId: '', orgao: '', modalidade: '', numero: '', processo: '', objeto: '', validade: 60, prazoEntrega: '', condicoes: '', params: Object.assign({}, PARAMS), itens: [], criadoEm: new Date().toISOString() }, dados || {});
    e().planilhasPreco.unshift(x); atual = x.id; salvar(x); return x;
  }
  function salvar(x) { x.atualizadoEm = new Date().toISOString(); Dados.salvar(); }
  function item(dados) { return Object.assign({ id: Dados.id('pi'), numero: '', lote: '', descricao: '', unidade: 'UN', quantidade: 1, custo: '', freteCompra: '', embalagem: '', outrosDiretos: '', referencia: '', modo: 'margem', alvo: '', individual: false, params: {}, marca: '', modelo: '', fornecedor: '' }, dados || {}); }
  function proximoNumero(x) { return x.itens.reduce(function (m, i) { return Math.max(m, Number(i.numero) || 0); }, 0) + 1; }

  // ---------- importação ----------
  function deProposta(p) {
    return p.itens.filter(function (i) { return i.participar !== false; }).map(function (i) { return item({ numero: i.numero, lote: i.lote || '', descricao: i.descricao, unidade: i.unidade || 'UN', quantidade: i.quantidade, custo: i.custo || '', referencia: i.refUnitaria || '', marca: i.marca || '', modelo: i.modelo || '' }); });
  }
  // Colado do Excel: com cabeçalho reconhecido ou na ordem descrição, unidade, quantidade, custo, referência.
  function lerColado(txt) {
    const linhas = String(txt || '').split(/\r?\n/).map(function (l) { return l.split(/\t|;/).map(function (c) { return c.trim(); }); }).filter(function (l) { return l.some(Boolean); });
    if (!linhas.length) return [];
    const nomes = { numero: /^(item|n[ºo°]?\.?|nº item)$/i, lote: /^(lote|grupo)$/i, descricao: /descri/i, unidade: /^(un|und|unid|unidade)\.?$/i, quantidade: /^(qtd|qtde|quant|quantidade)/i, custo: /custo/i, referencia: /(refer|estimad|or[cç]ad)/i, marca: /^marca$/i, modelo: /^modelo$/i };
    const cab = linhas[0]; const mapa = {};
    cab.forEach(function (c, k) { Object.keys(nomes).forEach(function (f) { if (mapa[f] == null && nomes[f].test(c)) mapa[f] = k; }); });
    const temCab = mapa.descricao != null;
    const ordem = temCab ? mapa : { descricao: 0, unidade: 1, quantidade: 2, custo: 3, referencia: 4 };
    return (temCab ? linhas.slice(1) : linhas).map(function (l, k) {
      const g = function (f) { return ordem[f] != null ? l[ordem[f]] || '' : ''; };
      return item({ numero: g('numero') || '', lote: g('lote'), descricao: g('descricao'), unidade: g('unidade') || 'UN', quantidade: n(g('quantidade')) || 1, custo: n(g('custo')), referencia: n(g('referencia')), marca: g('marca'), modelo: g('modelo') });
    }).filter(function (i) { return i.descricao; });
  }

  // ---------- tela ----------
  function render(el) {
    const lista = daEmpresa();
    let x = lista.find(function (p) { return p.id === atual; }) || lista[0];
    if (!x) {
      el.innerHTML = '<div class="cartao pp-inicio"><h3>Precifique todos os itens de uma proposta</h3><p class="mudo">Os parâmetros globais (impostos, despesas, prazo, margem) valem para todos os itens ao mesmo tempo. Qualquer item pode ser ajustado individualmente. No fim, gere a proposta completa.</p>' +
        '<div class="grupo-botoes"><button class="btn primario" data-a="nova">+ Nova planilha em branco</button><button class="btn" data-a="da-proposta">Importar itens de uma proposta</button><button class="btn" data-a="colar">Colar itens do Excel</button></div></div>';
      el.onclick = acoesInicio(el); return;
    }
    atual = x.id; x.params = Object.assign({}, PARAMS, x.params);
    const ps = Dados.e.propostas;
    el.innerHTML = '<div class="pp-barra"><select id="pp-sel" aria-label="Planilha">' + opcoes(lista.map(function (p) { return { v: p.id, t: p.nome + ' · ' + p.itens.length + ' item(ns)' }; }), x.id) + '</select>' +
      '<div class="grupo-botoes"><button class="btn" data-a="nova">+ Nova</button><button class="btn" data-a="da-proposta">Importar da proposta</button><button class="btn" data-a="colar">Colar do Excel</button><button class="btn fantasma" data-a="duplicar">Duplicar</button><button class="btn fantasma perigo" data-a="excluir-planilha">Excluir</button></div></div>' +
      '<form class="cartao pp-cab" id="pp-cab">' +
      campo('Nome da planilha', '<input name="nome" value="' + esc(x.nome) + '">') + campo('Órgão', '<input name="orgao" value="' + esc(x.orgao) + '">') + campo('Modalidade', '<input name="modalidade" value="' + esc(x.modalidade) + '" placeholder="Pregão eletrônico">') + campo('Número', '<input name="numero" value="' + esc(x.numero) + '">') +
      campo('Proposta vinculada', '<select name="propostaId"><option value="">Nenhuma</option>' + opcoes(ps.map(function (p) { return { v: p.id, t: [p.modalidade, p.numero].filter(Boolean).join(' ') + ' · ' + (p.orgao || 'sem órgão') }; }), x.propostaId) + '</select>') +
      campo('Validade da proposta (dias)', '<input name="validade" inputmode="numeric" value="' + esc(x.validade) + '">') + campo('Prazo de entrega', '<input name="prazoEntrega" value="' + esc(x.prazoEntrega) + '" placeholder="conforme edital">') + campo('Objeto', '<input name="objeto" value="' + esc(x.objeto) + '">') + '</form>' +
      '<form class="cartao pp-glob" id="pp-glob"><header><h3>Parâmetros globais</h3><span class="mini mudo">Valem para todos os itens que não estão no modo individual.</span></header><div class="pp-grade">' +
      campo('Regime tributário', '<select name="regime">' + opcoes(Object.keys(P.REGIMES).map(function (k) { return { v: k, t: P.REGIMES[k].t }; }), x.params.regime) + '</select>') +
      g('impostos', 'Impostos sobre a venda', '%') + gb('comissao', 'comissaoBase', 'Comissão') + gb('taxaBpo', 'bpoBase', 'Taxa da Seven (BPO)') + g('despesasFixas', 'Despesas fixas', '%') + g('difal', 'DIFAL / ICMS', '%') +
      g('prazoPagamento', 'Prazo de pagamento', 'dias') + g('taxaMes', 'Custo do dinheiro', '% a.m.') + g('custoFinanceiro', 'Custo financeiro', '%', 'Em branco = pelo prazo') + g('garantia', 'Seguro-garantia', '%') + g('outrosPct', 'Outros sobre o preço', '%') +
      g('margem', 'Margem desejada', '%') + g('margemMinima', 'Margem mínima aceitável', '%') + g('freteEntregaTotal', 'Frete até o órgão (total)', 'R$') +
      campo('Rateio do frete', '<select name="rateioFrete">' + opcoes([{ v: 'valor', t: 'Pelo valor de cada item' }, { v: 'quantidade', t: 'Pela quantidade' }], x.params.rateioFrete) + '</select>') +
      campo('Casas decimais do preço', '<select name="casas">' + opcoes([0, 1, 2, 3, 4].map(function (c) { return { v: String(c), t: c + ' casa(s)' }; }), String(x.params.casas)) + '</select>') +
      '<label class="check-inline pp-eng"><input type="checkbox" name="engenharia"' + (x.params.engenharia ? ' checked' : '') + '> Obra ou serviço de engenharia (inexequível abaixo de 75%)</label>' +
      '</div></form>' +
      '<section class="cartao pp-itens"><header><h3>Itens <span class="ma-n" id="pp-n">' + x.itens.length + '</span></h3><div class="grupo-botoes" id="pp-sel-acoes"></div><button class="btn primario" data-a="add">+ Adicionar item</button></header>' +
      '<div class="tabela-rolagem"><table class="tabela pp-tab"><thead><tr><th class="pp-chk"><input type="checkbox" id="pp-todos" aria-label="Selecionar todos"></th><th>Item / lote</th><th class="pp-desc">Descrição</th><th>Un.</th><th class="n">Qtd</th><th class="n">Custo unit. (R$)</th><th class="n">Ref. unit. (R$)</th><th>Precificar por</th><th class="n">Preço unit. / total</th><th class="n">Mínimo / margem</th><th>Situação</th><th></th></tr></thead><tbody>' +
      x.itens.map(linha).join('') + '</tbody></table></div>' + (x.itens.length ? '' : '<p class="mudo pp-vazio">Nenhum item. Adicione, importe da proposta ou cole do Excel.</p>') + '</section>' +
      '<div id="pp-res"></div>' +
      '<div class="grupo-botoes pp-final"><button class="btn primario" data-a="proposta">Gerar proposta completa</button><button class="btn" data-a="aplicar">' + (x.propostaId ? 'Atualizar proposta no Seven Proposta' : 'Criar proposta no Seven Proposta') + '</button><button class="btn" data-a="limites">Mínimos como valor limite na disputa</button><button class="btn fantasma" data-a="formacao">Imprimir planilha de formação de preços</button><button class="btn fantasma" data-a="csv">Exportar (CSV)</button></div>';
    function gb(k, kb, r) { return campo(r, '<div class="p-campo p-campo-base"><input name="' + k + '" inputmode="decimal" value="' + esc(br(x.params[k])) + '"><select name="' + kb + '" aria-label="Base de ' + esc(r) + '"><option value="preco"' + (x.params[kb] !== 'lucro' ? ' selected' : '') + '>% do preço</option><option value="lucro"' + (x.params[kb] === 'lucro' ? ' selected' : '') + '>% do lucro líquido</option></select></div>'); }
    function g(k, r, suf, dica) { return campo(r, '<div class="p-campo"><input name="' + k + '" inputmode="decimal" value="' + esc(br(x.params[k])) + '"><span>' + suf + '</span></div>', dica); }
    calcular(el, x);
    ligar(el, x);
  }

  function linha(i) {
    return '<tr data-id="' + esc(i.id) + '" class="' + (i.individual ? 'pp-ind' : '') + '"><td class="pp-chk"><input type="checkbox" data-sel' + (selecionados[i.id] ? ' checked' : '') + ' aria-label="Selecionar item ' + esc(i.numero) + '"></td>' +
      '<td><div class="pp-pilha"><input data-k="numero" class="pp-curto" value="' + esc(i.numero) + '" aria-label="Número do item" title="Item"><input data-k="lote" class="pp-curto" value="' + esc(i.lote) + '" placeholder="lote" aria-label="Lote" title="Lote"></div></td>' +
      '<td class="pp-desc"><textarea data-k="descricao" rows="2" aria-label="Descrição">' + esc(i.descricao) + '</textarea><small class="pp-al" data-c="alerta"></small></td><td><input data-k="unidade" class="pp-curto" value="' + esc(i.unidade) + '" aria-label="Unidade"></td>' +
      '<td><input data-k="quantidade" class="pp-num" inputmode="decimal" value="' + esc(br(i.quantidade)) + '" aria-label="Quantidade"></td><td><input data-k="custo" class="pp-num" inputmode="decimal" value="' + esc(brM(i.custo)) + '" aria-label="Custo unitário"></td><td><input data-k="referencia" class="pp-num" inputmode="decimal" value="' + esc(brM(i.referencia)) + '" aria-label="Referência unitária"></td>' +
      '<td><div class="pp-modo pp-pilha"><select data-k="modo" aria-label="Precificar por">' + opcoes(MODOS, i.modo) + '</select><input data-k="alvo" class="pp-num" inputmode="decimal" value="' + esc(br(i.alvo)) + '" placeholder="' + (i.modo === 'margem' ? 'global' : i.modo === 'preco' ? 'R$' : '%') + '" aria-label="Alvo"' + (i.modo === 'margem' ? ' disabled' : '') + '></div></td>' +
      '<td class="n" data-c="unitario"></td><td class="n" data-c="minimo"></td><td data-c="status"></td>' +
      '<td class="acoes"><button type="button" class="btn mini' + (i.individual ? ' ativo' : ' fantasma') + '" data-a="individual" title="Precificar este item individualmente" aria-label="Precificar o item ' + esc(i.numero) + ' individualmente">⚙</button><button type="button" class="icone" data-a="tirar" aria-label="Remover item" title="Remover">×</button></td></tr>';
  }

  // Recalcula só os números (sem refazer os campos, para não perder o foco).
  function calcular(el, x) {
    const r = P.planilha(x);
    r.itens.forEach(function (it) {
      const tr = el.querySelector('tr[data-id="' + it.id + '"]'); if (!tr) return;
      const set = function (c, h) { tr.querySelector('[data-c=' + c + ']').innerHTML = h; };
      if (!it.ok) { ['unitario', 'minimo'].forEach(function (c) { set(c, '<span class="mudo">—</span>'); }); }
      else { set('unitario', '<b>' + moeda(it.unitario) + '</b><small>' + moeda(it.total) + '</small>'); set('minimo', moeda(it.minimo) + '<small class="' + (it.margem < 0 ? 'alerta' : '') + '">margem ' + pc(it.margem) + '</small>'); }
      const pior = it.alertas.some(function (a) { return a.nivel === 'erro'; }) ? 'erro' : it.alertas.some(function (a) { return a.nivel === 'aviso'; }) ? 'aviso' : it.ok ? 'ok' : 'info';
      set('status', '<span class="pp-st pp-st-' + pior + '" title="' + esc(it.alertas.map(function (a) { return a.t; }).join(' · ') || 'Dentro dos parâmetros') + '">' + { ok: '✓ Ok', aviso: '⚠ Atenção', erro: '✕ Revisar', info: '… Falta custo' }[pior] + '</span>');
      set('alerta', esc(it.alertas.map(function (a) { return a.t; }).join(' · ')));
      tr.classList.toggle('pp-erro', pior === 'erro');
    });
    const t = r.totais;
    el.querySelector('#pp-res').innerHTML = '<div class="pp-totais">' +
      card('Valor global da proposta', moeda(t.total), t.precificados + ' de ' + t.itens + ' itens precificados', 'destaque') + card('Mínimo (margem zero)', moeda(t.minimo), 'piso para os lances') + card('Lucro líquido', moeda(t.lucro), 'margem média ' + pc(t.margem)) +
      card('Custo direto total', moeda(t.custo), t.frete ? 'inclui ' + moeda(t.frete) + ' de frete rateado' : 'sem frete até o órgão') + card('Referência do edital', t.referencia ? moeda(t.referencia) : '—', t.desconto != null ? 'desconto global de ' + pc(t.desconto * 100) : 'informe a referência de todos os itens') + card('Alertas', String(r.alertas), r.alertas ? 'detalhes abaixo da descrição de cada item' : 'nenhum problema encontrado', r.alertas ? 'alerta' : '') + '</div>' +
      (t.total ? '<p class="mini pp-extenso">Valor global por extenso: <b>' + esc(P.extenso(t.total)) + '</b></p>' : '') +
      (r.lotes.length > 1 || (r.lotes[0] && r.lotes[0].lote) ? '<div class="cartao"><h4>Por lote / grupo</h4><div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Lote</th><th class="n">Itens</th><th class="n">Total</th><th class="n">Mínimo</th><th class="n">Referência</th><th class="n">Desconto</th><th class="n">Lucro</th></tr></thead><tbody>' +
        r.lotes.map(function (l) { return '<tr><td>' + esc(l.lote || 'Sem lote') + (l.completos ? '' : ' <small class="alerta">(itens sem preço)</small>') + '</td><td class="n">' + l.itens + '</td><td class="n"><b>' + moeda(l.total) + '</b></td><td class="n">' + moeda(l.minimo) + '</td><td class="n">' + (l.referencia ? moeda(l.referencia) : '—') + '</td><td class="n">' + (l.referencia && l.completos ? pc((1 - l.total / l.referencia) * 100) : '—') + '</td><td class="n">' + moeda(l.lucro) + '</td></tr>'; }).join('') + '</tbody></table></div><p class="mini mudo">Em disputa por lote, o lance é o total do lote; o mínimo do lote é o piso.</p></div>' : '');
    function card(t, v, s, cls) { return '<div class="pp-card ' + (cls || '') + '"><span>' + t + '</span><b>' + v + '</b><small>' + s + '</small></div>'; }
    const nSel = Object.keys(selecionados).filter(function (k) { return selecionados[k] && x.itens.some(function (i) { return i.id === k; }); }).length;
    el.querySelector('#pp-sel-acoes').innerHTML = nSel ? '<span class="mini"><b>' + nSel + '</b> selecionado(s):</span><button type="button" class="btn mini" data-a="lote-margem">Definir margem</button><button type="button" class="btn mini" data-a="lote-lote">Definir lote</button><button type="button" class="btn mini" data-a="lote-global">Usar parâmetros globais</button><button type="button" class="btn mini fantasma perigo" data-a="lote-tirar">Remover</button>' : '';
    return r;
  }

  function ligar(el, x) {
    el.querySelector('#pp-sel').onchange = function () { atual = this.value; selecionados = {}; App.redesenhar(); };
    const cab = el.querySelector('#pp-cab');
    cab.oninput = cab.onchange = function () { const fd = new FormData(cab); ['nome', 'orgao', 'modalidade', 'numero', 'propostaId', 'prazoEntrega', 'objeto'].forEach(function (k) { x[k] = fd.get(k) || ''; }); x.validade = Number(fd.get('validade')) || 60; salvar(x); };
    const glob = el.querySelector('#pp-glob');
    glob.oninput = glob.onchange = function (ev) {
      if (ev.type === 'change' && ev.target.name === 'regime') { const rg = P.REGIMES[ev.target.value].produto; if (rg.impostos != null) glob.impostos.value = br(rg.impostos); }
      const fd = new FormData(glob);
      Object.keys(PARAMS).forEach(function (k) { if (k === 'engenharia') x.params[k] = !!fd.get(k); else if (k === 'regime' || k === 'rateioFrete' || /Base$/.test(k)) x.params[k] = fd.get(k) || 'preco'; else if (k === 'casas') x.params[k] = Number(fd.get(k)); else x.params[k] = n(fd.get(k)); });
      salvar(x); calcular(el, x);
    };
    const tab = el.querySelector('.pp-tab');
    tab.oninput = function (ev) {
      const k = ev.target.dataset.k; if (!k) return; const it = x.itens.find(function (i) { return i.id === ev.target.closest('tr').dataset.id; });
      it[k] = ['quantidade', 'custo', 'referencia', 'alvo'].indexOf(k) >= 0 ? n(ev.target.value) : ev.target.value;
      if (k === 'descricao') { ev.target.style.height = 'auto'; ev.target.style.height = ev.target.scrollHeight + 'px'; }
      clearTimeout(tab._t); tab._t = setTimeout(function () { salvar(x); calcular(el, x); }, 200);
    };
    tab.onchange = function (ev) {
      if (ev.target.matches('[data-sel]')) { selecionados[ev.target.closest('tr').dataset.id] = ev.target.checked; calcular(el, x); return; }
      if (ev.target.id === 'pp-todos') { x.itens.forEach(function (i) { selecionados[i.id] = ev.target.checked; }); el.querySelectorAll('[data-sel]').forEach(function (c) { c.checked = ev.target.checked; }); calcular(el, x); return; }
      if (ev.target.dataset.k === 'modo') { const it = x.itens.find(function (i) { return i.id === ev.target.closest('tr').dataset.id; }); it.modo = ev.target.value; it.alvo = ''; salvar(x); App.redesenhar(); }
    };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      const tr = b.closest('tr[data-id]'); const it = tr && x.itens.find(function (i) { return i.id === tr.dataset.id; });
      if (a === 'nova' || a === 'da-proposta' || a === 'colar') return acoesInicio(el)(ev);
      if (a === 'add') { x.itens.push(item({ numero: proximoNumero(x), lote: x.itens.length ? x.itens[x.itens.length - 1].lote : '' })); salvar(x); App.redesenhar(); const ul = document.querySelector('.pp-tab tbody tr:last-child [data-k=descricao]'); if (ul) ul.focus(); return; }
      if (a === 'tirar') { x.itens = x.itens.filter(function (i) { return i !== it; }); salvar(x); App.redesenhar(); return; }
      if (a === 'individual') { await individual(x, it); App.redesenhar(); return; }
      if (a === 'duplicar') { const c = JSON.parse(JSON.stringify(x)); c.id = Dados.id('pp'); c.nome = x.nome + ' (cópia)'; c.propostaId = ''; c.itens.forEach(function (i) { i.id = Dados.id('pi'); }); e().planilhasPreco.unshift(c); atual = c.id; salvar(c); App.redesenhar(); return; }
      if (a === 'excluir-planilha') { if (await confirmar('Excluir planilha', 'Excluir a planilha "' + esc(x.nome) + '"? A proposta vinculada não é apagada.', 'Excluir')) { e().planilhasPreco = e().planilhasPreco.filter(function (p) { return p !== x; }); atual = null; Dados.salvar(); App.redesenhar(); } return; }
      const sel = x.itens.filter(function (i) { return selecionados[i.id]; });
      if (a === 'lote-margem') { const f = await modal({ titulo: 'Margem dos itens selecionados', botao: 'Aplicar', corpo: campo('Margem líquida desejada (%)', '<input name="m" inputmode="decimal" required value="' + esc(br(x.params.margem)) + '">', 'Os itens passam a ser individuais, só com a margem diferente do global.') }); if (!f) return; sel.forEach(function (i) { i.individual = true; i.params = Object.assign({}, i.params, { margem: n(f.get('m')) }); i.modo = 'margem'; i.alvo = ''; }); salvar(x); App.redesenhar(); return; }
      if (a === 'lote-lote') { const f = await modal({ titulo: 'Lote dos itens selecionados', botao: 'Aplicar', corpo: campo('Lote / grupo', '<input name="l" required>') }); if (!f) return; sel.forEach(function (i) { i.lote = f.get('l').trim(); }); salvar(x); App.redesenhar(); return; }
      if (a === 'lote-global') { sel.forEach(function (i) { i.individual = false; i.params = {}; i.modo = 'margem'; i.alvo = ''; }); salvar(x); App.redesenhar(); return; }
      if (a === 'lote-tirar') { if (!(await confirmar('Remover itens', 'Remover ' + sel.length + ' item(ns) da planilha?', 'Remover'))) return; x.itens = x.itens.filter(function (i) { return !selecionados[i.id]; }); selecionados = {}; salvar(x); App.redesenhar(); return; }
      if (a === 'aplicar') return aplicarProposta(x);
      if (a === 'limites') return limitesDisputa(x);
      if (a === 'proposta') return imprimirProposta(x);
      if (a === 'formacao') return imprimirFormacao(x);
      if (a === 'csv') return exportarCSV(x);
    };
  }

  function acoesInicio(el) {
    return async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'nova') { nova(); App.redesenhar(); }
      if (b.dataset.a === 'da-proposta') {
        const ps = Dados.e.propostas.filter(function (p) { return p.itens && p.itens.length; });
        if (!ps.length) { aviso('Nenhuma proposta com itens. Crie no Seven Proposta (os itens vêm do PNCP) ou cole do Excel.', 'erro'); return; }
        const f = await modal({ titulo: 'Importar itens da proposta', botao: 'Importar', corpo: campo('Proposta', '<select name="p">' + opcoes(ps.map(function (p) { return { v: p.id, t: [p.modalidade, p.numero].filter(Boolean).join(' ') + ' · ' + (p.orgao || '') + ' · ' + p.itens.length + ' itens' }; })) + '</select>') + '<p class="mini mudo">Cria uma planilha nova, vinculada à proposta, com quantidade, referência, custo, marca e modelo já preenchidos.</p>' });
        if (!f) return; const p = ps.find(function (q) { return q.id === f.get('p'); });
        nova({ nome: [p.modalidade, p.numero].filter(Boolean).join(' ') + ' · ' + (p.orgao || ''), propostaId: p.id, orgao: p.orgao || '', modalidade: p.modalidade || '', numero: p.numero || '', processo: p.processo || '', objeto: p.objeto || '', validade: p.validade || 60, prazoEntrega: p.prazoEntrega || '', empresaId: p.empresaId, itens: deProposta(p) });
        aviso(p.itens.length + ' item(ns) importados. Informe o custo de cada um.'); App.redesenhar();
      }
      if (b.dataset.a === 'colar') {
        const f = await modal({ titulo: 'Colar itens do Excel', largo: true, botao: 'Importar', corpo: '<p class="mini">Copie as linhas da planilha e cole abaixo. Com cabeçalho, reconheço Item, Lote, Descrição, Unidade, Quantidade, Custo, Referência, Marca e Modelo. Sem cabeçalho, a ordem é: <b>descrição, unidade, quantidade, custo, referência</b>.</p><textarea name="t" rows="10" required placeholder="Descrição&#9;Unidade&#9;Quantidade&#9;Custo&#9;Referência"></textarea>' });
        if (!f) return; const itens = lerColado(f.get('t')); if (!itens.length) { aviso('Não encontrei itens no texto colado.', 'erro'); return; }
        const x = daEmpresa().find(function (p) { return p.id === atual; });
        let destino = x;
        if (!destino || !(await confirmar('Onde importar', 'Acrescentar ' + itens.length + ' item(ns) à planilha "' + esc(destino.nome) + '"? (Cancelar cria uma planilha nova.)', 'Acrescentar'))) destino = nova();
        let prox = proximoNumero(destino); itens.forEach(function (i) { if (!i.numero) i.numero = prox++; }); destino.itens = destino.itens.concat(itens); atual = destino.id; salvar(destino);
        aviso(itens.length + ' item(ns) importados.'); App.redesenhar();
      }
    };
  }

  // ---------- item individual ----------
  async function individual(x, it) {
    const prm = Object.assign({}, it.params || {});
    const linhaCampo = function (k, r, suf) { return campo(r, '<div class="p-campo"><input name="p_' + k + '" inputmode="decimal" value="' + esc(br(prm[k])) + '" placeholder="global: ' + esc(k === 'custoFinanceiro' && (x.params[k] === '' || x.params[k] == null) ? 'pelo prazo' : br(x.params[k]) || '0') + '"><span>' + suf + '</span></div>'); };
    const f = await modal({
      titulo: 'Precificar individualmente: item ' + (it.numero || ''), largo: true, botao: 'Salvar item',
      corpo: '<div class="pp-ind-grade"><div>' +
        '<label class="check-inline"><input type="checkbox" name="individual"' + (it.individual ? ' checked' : '') + '> Usar parâmetros próprios neste item</label><p class="mini mudo">Campos em branco continuam com o valor global.</p>' +
        '<fieldset><legend>Custos diretos por unidade</legend><div class="pp-grade">' + campo('Custo de compra', '<div class="p-campo"><input name="custo" inputmode="decimal" value="' + esc(br(it.custo)) + '"><span>R$</span></div>') + campo('Frete de compra', '<div class="p-campo"><input name="freteCompra" inputmode="decimal" value="' + esc(br(it.freteCompra)) + '"><span>R$</span></div>') + campo('Embalagem', '<div class="p-campo"><input name="embalagem" inputmode="decimal" value="' + esc(br(it.embalagem)) + '"><span>R$</span></div>') + campo('Outros custos', '<div class="p-campo"><input name="outrosDiretos" inputmode="decimal" value="' + esc(br(it.outrosDiretos)) + '"><span>R$</span></div>') + '</div></fieldset>' +
        '<fieldset><legend>Percentuais deste item</legend><div class="pp-grade">' + INDIVIDUAIS.map(function (c) { return linhaCampo(c[0], c[1], c[2]); }).join('') + '</div></fieldset>' +
        '<fieldset><legend>Para a proposta</legend><div class="pp-grade">' + campo('Marca', '<input name="marca" value="' + esc(it.marca) + '">') + campo('Modelo', '<input name="modelo" value="' + esc(it.modelo) + '">') + campo('Fornecedor', '<input name="fornecedor" value="' + esc(it.fornecedor) + '">') + '</div></fieldset>' +
        '</div><aside class="p-res" id="pp-ind-res"></aside></div>',
      aoAbrir: function (form) {
        const prever = function () {
          const fd = new FormData(form); const tmp = JSON.parse(JSON.stringify(x));
          const ti = tmp.itens.find(function (i) { return i.id === it.id; });
          ['custo', 'freteCompra', 'embalagem', 'outrosDiretos'].forEach(function (k) { ti[k] = n(fd.get(k)); });
          ti.individual = !!fd.get('individual'); ti.params = {}; INDIVIDUAIS.forEach(function (c) { const v = fd.get('p_' + c[0]); if (v !== '') ti.params[c[0]] = n(v); });
          const res = P.planilha(tmp).itens.find(function (i) { return i.id === it.id; });
          const frete = P.rateioFrete(tmp)[it.id] || 0; const g = Object.assign({}, tmp.params); if (ti.individual) Object.assign(g, ti.params);
          const r = P.produto(Object.assign({}, g, { custo: ti.custo, freteCompra: ti.freteCompra, embalagem: ti.embalagem, outrosDiretos: ti.outrosDiretos, quantidade: ti.quantidade || 1, freteEntregaTotal: frete, referencia: ti.referencia }));
          form.querySelector('#pp-ind-res').innerHTML = (res && res.ok ? '<div class="cartao pp-final-item"><span class="mudo">Preço na planilha (arredondado para cima, ' + P.planilha(tmp).casas + ' casas)</span><b>' + moeda(res.unitario) + '</b><small>total ' + moeda(res.total) + ' · margem final ' + pc(res.margem) + '</small></div>' : '') + (res && res.alertas.length ? '<div class="cartao p-alerta"><ul class="pp-alertas">' + res.alertas.map(function (a) { return '<li>' + esc(a.t) + '</li>'; }).join('') + '</ul></div>' : '') + Telas.precificacao.resultadoProduto(r);
        };
        form.addEventListener('input', prever); prever();
      }
    });
    if (!f) return;
    ['custo', 'freteCompra', 'embalagem', 'outrosDiretos'].forEach(function (k) { it[k] = n(f.get(k)); });
    it.individual = !!f.get('individual'); it.params = {}; INDIVIDUAIS.forEach(function (c) { const v = f.get('p_' + c[0]); if (v !== '') it.params[c[0]] = n(v); });
    it.marca = f.get('marca').trim(); it.modelo = f.get('modelo').trim(); it.fornecedor = f.get('fornecedor').trim();
    salvar(x);
  }

  // Item correspondente pelo número e pelo lote. Sem lote do outro lado, só aceita o número se ele for único na planilha
  // (evita que o item 1 do lote 2 sobrescreva o item 1 do lote 1).
  function acharItem(lista, alvo, x) {
    const num = String(alvo.numero), lote = String(alvo.lote || '');
    const mesmo = lista.filter(function (q) { return String(q.numero) === num; });
    const exato = mesmo.find(function (q) { return String(q.lote || '') === lote; });
    if (exato) return exato;
    const repetido = x.itens.filter(function (q) { return String(q.numero) === num; }).length > 1;
    return !repetido && mesmo.length === 1 && (!mesmo[0].lote || !lote) ? mesmo[0] : null;
  }

  // ---------- saídas ----------
  async function aplicarProposta(x) {
    const r = P.planilha(x); const ok = r.itens.filter(function (i) { return i.ok; });
    if (!ok.length) { aviso('Nenhum item precificado: informe o custo.', 'erro'); return; }
    const erros = r.itens.filter(function (i) { return i.alertas.some(function (a) { return a.nivel === 'erro'; }); }).length;
    if (erros && !(await confirmar('Itens a revisar', erros + ' item(ns) estão acima da referência ou abaixo do custo. Aplicar assim mesmo?', 'Aplicar'))) return;
    let p = x.propostaId && Dados.e.propostas.find(function (q) { return q.id === x.propostaId; });
    const emp = Dados.empresaAtiva();
    if (!p) {
      if (!emp) { aviso('Cadastre um cliente (CNPJ) antes de criar a proposta.', 'erro'); return; }
      p = { id: Dados.id('ppt'), empresaId: emp.id, ref: null, objeto: x.objeto, orgao: x.orgao, modalidade: x.modalidade, numero: x.numero, processo: x.processo, portal: '', itens: [], status: 'rascunho', criadaEm: new Date().toISOString(), declaracoes: {}, validade: x.validade || 60, prazoEntrega: x.prazoEntrega, impostos: x.params.impostos, margem: x.params.margem };
      Dados.e.propostas.unshift(p); x.propostaId = p.id;
    }
    const src = {}; x.itens.forEach(function (i) { src[i.id] = i; });
    ok.forEach(function (c) {
      const i = src[c.id]; let alvo = acharItem(p.itens, i, x);
      if (!alvo) { alvo = { numero: i.numero, descricao: i.descricao, quantidade: i.quantidade, unidade: i.unidade, refUnitaria: n(i.referencia) || null, participar: true, marca: '', modelo: '', custo: null, unitario: null }; p.itens.push(alvo); }
      alvo.lote = i.lote; alvo.custo = Nucleo.arredondar(c.custoDireto, 4); alvo.unitario = c.unitario; if (i.marca) alvo.marca = i.marca; if (i.modelo) alvo.modelo = i.modelo;
    });
    p.validade = x.validade || p.validade; if (x.prazoEntrega) p.prazoEntrega = x.prazoEntrega;
    salvar(x); aviso(ok.length + ' item(ns) gravados na proposta.');
    location.hash = '#/cadastrar/proposta/' + p.id;
  }

  function limitesDisputa(x) {
    const d = x.propostaId && Dados.e.disputas.find(function (q) { return q.propostaId === x.propostaId; });
    if (!d) { aviso('Vincule uma proposta que já esteja no Seven Pregão (ligue "Enviar ao Seven Pregão" na proposta).', 'erro'); return; }
    const r = P.planilha(x);
    let k = 0; d.itens.forEach(function (it) { const pi = acharItem(x.itens, it, x); const c = pi && r.itens.find(function (y) { return y.id === pi.id && y.ok; }); if (c) { it.limite = c.minimo; it.custo = c.custoDireto; it.aprovado = false; k++; } });
    Dados.salvar(); aviso(k + ' valor(es) limite definidos. Marque "Aprovado" depois do aceite do cliente.');
  }

  function janela(titulo, corpo) {
    const w = window.open('', '_blank'); if (!w) { aviso('Permita pop-ups para imprimir.', 'erro'); return; }
    w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title><style>body{font:12px/1.45 Arial,sans-serif;color:#111;margin:28px}h1{font-size:16px;margin:0 0 4px}h2{font-size:13px;margin:18px 0 6px}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #999;padding:4px 6px;vertical-align:top}th{background:#eee;text-align:left}.n{text-align:right;white-space:nowrap}.mini{font-size:11px;color:#444}.ass{margin-top:48px;text-align:center}button{margin-bottom:12px}@media print{button{display:none}}</style></head><body><button onclick="print()">Imprimir / salvar PDF</button>' + corpo + '</body></html>');
    w.document.close();
  }

  function imprimirProposta(x) {
    const r = P.planilha(x); const emp = Dados.empresaAtiva() || {};
    const falta = r.itens.filter(function (i) { return !i.ok; }).length;
    if (!r.totais.precificados) { aviso('Nenhum item precificado.', 'erro'); return; }
    if (falta) aviso(falta + ' item(ns) sem preço ficaram de fora da proposta.', 'erro');
    const src = {}; x.itens.forEach(function (i) { src[i.id] = i; });
    const lotes = {}; r.itens.filter(function (i) { return i.ok; }).forEach(function (i) { (lotes[i.lote || ''] = lotes[i.lote || ''] || []).push(i); });
    const chaves = Object.keys(lotes); const porLote = chaves.length > 1 || chaves[0];
    const tabela = chaves.map(function (k) {
      const l = lotes[k]; const tot = l.reduce(function (s, i) { return s + i.total; }, 0);
      return (porLote ? '<h2>' + esc(k ? 'LOTE ' + k : 'ITENS SEM LOTE') + '</h2>' : '') + '<table><thead><tr><th>Item</th><th>Descrição</th><th>Marca</th><th>Modelo</th><th>Un.</th><th class="n">Qtd</th><th class="n">Valor unit.</th><th class="n">Valor total</th></tr></thead><tbody>' +
        l.map(function (i) { const s = src[i.id]; return '<tr><td>' + esc(i.numero) + '</td><td>' + esc(i.descricao) + '</td><td>' + esc(s.marca || '') + '</td><td>' + esc(s.modelo || '') + '</td><td>' + esc(i.unidade) + '</td><td class="n">' + num(i.quantidade) + '</td><td class="n">' + moeda(i.unitario) + '</td><td class="n">' + moeda(i.total) + '</td></tr>'; }).join('') +
        '<tr><th colspan="7" style="text-align:right">' + (porLote ? 'TOTAL DO LOTE' : 'TOTAL') + '</th><th class="n">' + moeda(tot) + '</th></tr></tbody></table>';
    }).join('');
    const hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    janela('Proposta ' + (x.numero || ''), '<h1>' + esc(emp.razao || '[RAZÃO SOCIAL]') + '</h1><div class="mini">CNPJ ' + esc(emp.cnpj ? cnpj(emp.cnpj) : '[CNPJ]') + ' · ' + esc([emp.municipio, emp.uf].filter(Boolean).join('-')) + (emp.email ? ' · ' + esc(emp.email) : '') + (emp.telefone ? ' · ' + esc(emp.telefone) : '') + '</div>' +
      '<h2>PROPOSTA COMERCIAL</h2><p>Ao(À) ' + esc(x.orgao || '[ÓRGÃO]') + '<br>' + esc([x.modalidade, x.numero ? 'nº ' + x.numero : ''].filter(Boolean).join(' ')) + (x.processo ? ' · Processo ' + esc(x.processo) : '') + (x.objeto ? '<br>Objeto: ' + esc(x.objeto) : '') + '</p>' +
      tabela + '<p><b>Valor global da proposta: ' + moeda(r.totais.total) + ' (' + esc(P.extenso(r.totais.total)) + ').</b></p>' +
      '<p>Validade da proposta: ' + esc(x.validade || 60) + ' dias. Prazo de entrega: ' + esc(x.prazoEntrega || 'conforme edital') + '. Condições de pagamento: conforme edital.<br>Declaramos que nos preços estão incluídos todos os custos, tributos, encargos sociais e trabalhistas, fretes, seguros e demais despesas necessárias ao cumprimento do objeto, e que atendemos a todas as exigências do edital e do termo de referência.</p>' +
      '<p>' + esc(emp.municipio || '') + (emp.municipio ? ', ' : '') + hoje + '.</p><div class="ass">______________________________________<br>' + esc(emp.representante || 'Representante legal') + '<br>' + esc(emp.razao || '') + '</div>');
  }

  function imprimirFormacao(x) {
    const r = P.planilha(x); const g = x.params;
    janela('Formação de preços ' + x.nome, '<h1>Planilha de formação de preços</h1><div class="mini">' + esc(x.nome) + ' · ' + esc(x.orgao || '') + ' · gerada em ' + new Date().toLocaleString('pt-BR') + '</div>' +
      '<h2>Parâmetros globais</h2><p class="mini">Impostos ' + pc(g.impostos) + ' · comissão ' + pc(g.comissao) + (g.comissaoBase === 'lucro' ? ' do lucro' : '') + ' · taxa Seven ' + pc(g.taxaBpo) + (g.bpoBase === 'lucro' ? ' do lucro' : '') + ' · despesas fixas ' + pc(g.despesasFixas) + ' · DIFAL ' + pc(g.difal) + ' · prazo ' + esc(g.prazoPagamento) + ' dias a ' + pc(g.taxaMes) + ' a.m. · seguro ' + pc(g.garantia) + ' · margem ' + pc(g.margem) + ' · frete total ' + moeda(n(g.freteEntregaTotal) || 0) + ' (rateio por ' + (g.rateioFrete === 'quantidade' ? 'quantidade' : 'valor') + ')</p>' +
      '<table><thead><tr><th>Item</th><th>Lote</th><th>Descrição</th><th class="n">Qtd</th><th class="n">Custo direto</th><th class="n">Frete rateado</th><th class="n">Preço unit.</th><th class="n">Total</th><th class="n">Mínimo</th><th class="n">Margem</th><th class="n">Ref.</th><th>Observação</th></tr></thead><tbody>' +
      r.itens.map(function (i) { return '<tr><td>' + esc(i.numero) + '</td><td>' + esc(i.lote) + '</td><td>' + esc(i.descricao) + (i.individual ? ' <i>(individual)</i>' : '') + '</td><td class="n">' + num(i.quantidade) + '</td><td class="n">' + (i.ok ? moeda(i.custoDireto) : '—') + '</td><td class="n">' + (i.ok ? moeda(i.freteRateado) : '—') + '</td><td class="n">' + (i.ok ? moeda(i.unitario) : '—') + '</td><td class="n">' + (i.ok ? moeda(i.total) : '—') + '</td><td class="n">' + (i.ok ? moeda(i.minimo) : '—') + '</td><td class="n">' + (i.ok ? pc(i.margem) : '—') + '</td><td class="n">' + (i.referencia ? moeda(i.referencia) : '—') + '</td><td>' + esc(i.alertas.map(function (a) { return a.t; }).join('; ')) + '</td></tr>'; }).join('') +
      '<tr><th colspan="7" style="text-align:right">TOTAIS</th><th class="n">' + moeda(r.totais.total) + '</th><th class="n">' + moeda(r.totais.minimo) + '</th><th class="n">' + pc(r.totais.margem) + '</th><th class="n">' + (r.totais.referencia ? moeda(r.totais.referencia) : '—') + '</th><th></th></tr></tbody></table>' +
      '<p class="mini">Preço = custo direto ÷ (1 − soma dos percentuais sobre o preço), arredondado para cima em ' + r.casas + ' casa(s) para não reduzir a margem. Mínimo = preço com margem zero (piso do lance).</p>');
  }

  function exportarCSV(x) {
    const r = P.planilha(x); const src = {}; x.itens.forEach(function (i) { src[i.id] = i; });
    const f = function (v) { return v == null || v === '' ? '' : typeof v === 'number' ? String(Math.round(v * 10000) / 10000).replace('.', ',') : '"' + String(v).replace(/"/g, '""') + '"'; };
    const cab = ['Item', 'Lote', 'Descrição', 'Unidade', 'Quantidade', 'Custo unitário', 'Referência unitária', 'Marca', 'Modelo', 'Custo direto', 'Preço unitário', 'Total', 'Mínimo', 'Margem %', 'Alertas'];
    const linhas = r.itens.map(function (i) { const s = src[i.id]; return [i.numero, i.lote, i.descricao, i.unidade, i.quantidade, n(s.custo), i.referencia, s.marca, s.modelo, i.custoDireto, i.unitario, i.total, i.minimo, i.margem, i.alertas.map(function (a) { return a.t; }).join('; ')].map(f).join(';'); });
    UI.baixar(Nucleo.normalizar(x.nome).replace(/ /g, '-').slice(0, 60) + '.csv', '﻿' + cab.join(';') + '\n' + linhas.join('\n'), 'text/csv;charset=utf-8');
  }

  Telas.planilhaPrecos = { render: render, lerColado: lerColado };
})();
