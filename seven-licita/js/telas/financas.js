/* Minhas Finanças: controle financeiro pessoal, da empresa e de clientes assessorados. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, data, campo, opcoes, modal, confirmar, aviso, abas } = UI;
  const F = Financas;
  const TIPOS_CONTA = { corrente: 'Conta corrente', poupanca: 'Poupança', carteira: 'Carteira / dinheiro', investimento: 'Investimento', outra: 'Outra' };
  const GRUPOS = { receita: 'Receita', fixa: 'Despesa fixa', variavel: 'Despesa variável', imposto: 'Impostos', custo: 'Custos (CMV/CSP)', operacional: 'Despesa operacional', financeira: 'Despesa financeira', investimento: 'Investimentos' };
  const hojeISO = function () { return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const est = { mes: hojeISO().slice(0, 7), filtro: { tipo: '', conta: '', categoria: '', status: '', texto: '' }, desbloqueado: {} };

  function base() {
    const d = Dados.e;
    if (!d.financas) d.financas = { perfis: [], perfilAtivo: null, contas: [], cartoes: [], categorias: [], lancamentos: [], orcamentos: [], metas: [] };
    const f = d.financas;
    if (!f.perfis.length) { const p = { id: Dados.id('pf'), nome: 'Pessoal', tipo: 'pessoal' }; f.perfis.push(p); f.perfilAtivo = p.id; criarPadrao(f, p.id); }
    return f;
  }
  function criarPadrao(f, perfil) {
    F.CATEGORIAS_PADRAO.forEach(function (c) { f.categorias.push({ id: Dados.id('ct'), perfil: perfil, nome: c[0], tipo: c[1], cor: c[2], grupo: c[3] }); });
    f.contas.push({ id: Dados.id('cc'), perfil: perfil, nome: 'Conta principal', tipo: 'corrente', saldoInicial: 0, cor: '#b68d40' });
  }
  function perfil() { const f = base(); return f.perfis.find(function (p) { return p.id === f.perfilAtivo; }) || f.perfis[0]; }
  function do_(l) { const p = perfil().id; return l.filter(function (x) { return x.perfil === p; }); }
  function contas() { return do_(base().contas).filter(function (c) { return !c.arquivada; }); }
  function cartoes() { return do_(base().cartoes).filter(function (c) { return !c.arquivado; }); }
  function cats(tipo) { return do_(base().categorias).filter(function (c) { return !tipo || c.tipo === tipo; }); }
  function lancs() { return do_(base().lancamentos); }
  function cat(id) { return base().categorias.find(function (c) { return c.id === id; }); }
  const FORMAS = ['Pix', 'Boleto', 'Transferência (TED)', 'Ordem bancária (OB)', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Débito automático'];
  function contatos() { const f = base(); f.contatos = f.contatos || []; return do_(f.contatos); }
  function nomesContatos(tipo) { const m = {}; contatos().forEach(function (c) { if (!tipo || c.papel === 'ambos' || c.papel === (tipo === 'receita' ? 'cliente' : 'fornecedor')) m[c.nome] = 1; }); lancs().forEach(function (l) { if (l.contato && (!tipo || l.tipo === tipo)) m[l.contato] = 1; }); return Object.keys(m).sort(); }
  function centros() { const m = {}; lancs().forEach(function (l) { if (l.centroCusto) m[l.centroCusto] = 1; }); return Object.keys(m).sort(); }
  function lembrarContato(nome, tipo) { const papel = tipo === 'receita' ? 'cliente' : 'fornecedor'; const c = contatos().find(function (x) { return Nucleo.normalizar(x.nome) === Nucleo.normalizar(nome); }); if (!c) base().contatos.push({ id: Dados.id('ct'), perfil: perfil().id, nome: nome, papel: papel }); else if (c.papel !== papel && c.papel !== 'ambos') c.papel = 'ambos'; }
  function nomeConta(id) { const c = base().contas.find(function (x) { return x.id === id; }) || base().cartoes.find(function (x) { return x.id === id; }); return c ? c.nome : '—'; }
  function salvar() { Dados.salvar(); }
  function mesNome(m) { const p = m.split('-'); const t = new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return t.charAt(0).toUpperCase() + t.slice(1); }
  const sinal = function (l) { return l.tipo === 'ajuste' ? (l.valor < 0 ? -1 : 1) : l.tipo === 'receita' ? 1 : l.tipo === 'transferencia' ? 0 : -1; };

  async function sha(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }

  // ---------- rosca (SVG) ----------
  function rosca(itens) {
    const total = itens.reduce(function (s, x) { return s + x.valor; }, 0); if (!total) return '<p class="mudo">Sem dados no período.</p>';
    let ang = -Math.PI / 2; const R = 42, r = 26;
    const fatias = itens.map(function (x) {
      const a = x.valor / total * Math.PI * 2; const a2 = ang + a; const grande = a > Math.PI ? 1 : 0;
      const p = function (rr, t) { return (50 + rr * Math.cos(t)).toFixed(2) + ' ' + (50 + rr * Math.sin(t)).toFixed(2); };
      const d = itens.length === 1 ? 'M50 8 A42 42 0 1 1 49.99 8 L49.99 24 A26 26 0 1 0 50 24 Z' : 'M' + p(R, ang) + ' A' + R + ' ' + R + ' 0 ' + grande + ' 1 ' + p(R, a2) + ' L' + p(r, a2) + ' A' + r + ' ' + r + ' 0 ' + grande + ' 0 ' + p(r, ang) + ' Z';
      ang = a2; return '<path d="' + d + '" fill="' + x.cor + '"><title>' + esc(x.nome + ': ' + moeda(x.valor)) + '</title></path>';
    }).join('');
    return '<div class="f-rosca"><svg viewBox="0 0 100 100" role="img" aria-label="Distribuição por categoria">' + fatias + '<text x="50" y="48" text-anchor="middle" class="f-rosca-t">Total</text><text x="50" y="58" text-anchor="middle" class="f-rosca-v">' + esc(moeda(total).replace('R$', '').trim()) + '</text></svg><ul>' + itens.slice(0, 8).map(function (x) { return '<li><i style="background:' + x.cor + '"></i>' + esc(x.nome) + '<b>' + Math.round(x.valor / total * 100) + '%</b></li>'; }).join('') + '</ul></div>';
  }
  function itensCategoria(l, tipo) { return F.porCategoria(l, tipo).map(function (x) { const c = cat(x.categoria) || { nome: 'Sem categoria', cor: '#8c9bab' }; return { nome: c.nome, cor: c.cor, valor: x.valor, id: x.categoria }; }); }

  function navMes() { return '<div class="f-mes"><button class="btn fantasma" data-mes="-1" aria-label="Mês anterior">‹</button><b>' + esc(mesNome(est.mes)) + '</b><button class="btn fantasma" data-mes="1" aria-label="Próximo mês">›</button>' + (est.mes !== hojeISO().slice(0, 7) ? '<button class="btn mini fantasma" data-mes="0">Hoje</button>' : '') + '</div>'; }
  function trocaMes(n) { est.mes = n === 0 ? hojeISO().slice(0, 7) : F.addMeses(est.mes + '-01', n).slice(0, 7); App.redesenhar(); }

  // ---------- visão geral ----------
  function telaGeral(el) {
    const L = lancs(); const r = F.resumo(L, est.mes); const doMes = F.doMes(L, est.mes);
    const saldoTotal = contas().reduce(function (s, c) { return s + F.saldoConta(c, L); }, 0);
    const previsto = saldoTotal + r.aReceber - r.aPagar - cartoes().reduce(function (s, k) { return s + F.fatura(k, L, est.mes).aberto; }, 0);
    const meses = []; for (let i = 5; i >= 0; i--) meses.push(F.addMeses(est.mes + '-01', -i).slice(0, 7));
    const evol = meses.map(function (m) { const x = F.resumo(L, m); return { m: m, r: x.receitas, d: x.despesas }; });
    const maxE = Math.max.apply(null, evol.map(function (x) { return Math.max(x.r, x.d); }).concat([1]));
    const pend = L.filter(function (l) { return !l.pago && !l.cartao && l.tipo !== 'transferencia' && l.data <= F.addDias(hojeISO(), 7); }).sort(function (a, b) { return a.data < b.data ? -1 : 1; }).slice(0, 8);
    const orc = F.orcamentos(do_(base().orcamentos), L, est.mes);
    el.innerHTML = navMes() +
      '<div class="kpis f-kpis"><div><span>Saldo atual nas contas</span><b class="' + (saldoTotal < 0 ? 'neg' : '') + '">' + moeda(saldoTotal) + '</b></div><div><span>Receitas do mês</span><b class="pos">' + moeda(r.receitas) + '</b></div><div><span>Despesas do mês</span><b class="neg">' + moeda(r.despesas) + '</b></div><div><span>Resultado</span><b class="' + (r.resultado < 0 ? 'neg' : 'pos') + '">' + moeda(r.resultado) + '</b></div><div><span>Saldo previsto no fim do mês</span><b>' + moeda(previsto) + '</b></div></div>' +
      '<section class="cartao f-analise"><h3>✨ Análise do mês</h3><ul>' + F.analise(L, est.mes, cats(), do_(base().orcamentos)).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></section>' +
      '<div class="cartoes"><section class="cartao"><h3>Despesas por categoria</h3>' + rosca(itensCategoria(doMes, 'despesa')) + '</section>' +
      '<section class="cartao"><h3>Receitas × despesas (6 meses)</h3><div class="f-barras">' + evol.map(function (x) { return '<div><span class="f-b r" style="height:' + (x.r / maxE * 100) + '%" title="Receitas ' + esc(moeda(x.r)) + '"></span><span class="f-b d" style="height:' + (x.d / maxE * 100) + '%" title="Despesas ' + esc(moeda(x.d)) + '"></span><small>' + esc(mesNome(x.m).slice(0, 3)) + '</small></div>'; }).join('') + '</div><p class="mini"><i class="f-leg r"></i> receitas <i class="f-leg d"></i> despesas</p></section>' +
      '<section class="cartao"><h3>Contas</h3><ul class="f-lista">' + contas().map(function (c) { const s = F.saldoConta(c, L); return '<li><i style="background:' + (c.cor || '#8c9bab') + '"></i>' + esc(c.nome) + '<b class="' + (s < 0 ? 'neg' : '') + '">' + moeda(s) + '</b></li>'; }).join('') + '</ul>' + (cartoes().length ? '<h4>Cartões (fatura de ' + esc(mesNome(est.mes)) + ')</h4><ul class="f-lista">' + cartoes().map(function (k) { const ft = F.fatura(k, L, est.mes); return '<li><i style="background:' + (k.cor || '#3b3b3b') + '"></i>' + esc(k.nome) + ' <small class="mudo">vence ' + data(ft.vencimento) + '</small><b>' + moeda(ft.aberto) + '</b></li>'; }).join('') + '</ul>' : '') + '</section>' +
      '<section class="cartao"><h3>Vencendo (próximos 7 dias e atrasados)</h3>' + (pend.length ? '<ul class="f-lista">' + pend.map(function (l) { return '<li class="' + (l.data < hojeISO() ? 'atrasado' : '') + '"><span>' + data(l.data) + '</span>' + esc(l.descricao) + '<b class="' + (l.tipo === 'despesa' ? 'neg' : 'pos') + '">' + moeda(l.valor) + '</b><button class="btn mini" data-efetivar="' + l.id + '">Efetivar</button></li>'; }).join('') + '</ul>' : '<p class="mudo">Nada vencendo.</p>') + '</section>' +
      (orc.length ? '<section class="cartao"><h3>Orçamento do mês</h3>' + orc.map(function (o) { const c = cat(o.categoria) || {}; return '<div class="f-orc"><span>' + esc(c.nome || '') + '</span><div class="barra"><i class="' + o.estado + '" style="width:' + Math.min(100, o.uso * 100) + '%"></i></div><small>' + moeda(o.gasto) + ' de ' + moeda(o.previsto) + '</small></div>'; }).join('') + '</section>' : '') + '</div>';
    el.onclick = function (ev) {
      const m = ev.target.closest('[data-mes]'); if (m) return trocaMes(Number(m.dataset.mes));
      const ef = ev.target.closest('[data-efetivar]'); if (ef) { const l = base().lancamentos.find(function (x) { return x.id === ef.dataset.efetivar; }); l.pago = true; salvar(); aviso('Lançamento efetivado.'); App.redesenhar(); }
    };
  }

  // ---------- lançamentos ----------
  function telaLancamentos(el) {
    const f = est.filtro;
    let L = F.doMes(lancs(), est.mes).filter(function (l) {
      if (f.tipo && l.tipo !== f.tipo) return false;
      if (f.conta && l.conta !== f.conta && l.cartao !== f.conta && l.contaDestino !== f.conta) return false;
      if (f.categoria && l.categoria !== f.categoria) return false;
      if (f.status === 'pendente' && l.pago) return false; if (f.status === 'pago' && !l.pago) return false;
      if (f.texto && Nucleo.normalizar(l.descricao + ' ' + (l.observacao || '')).indexOf(Nucleo.normalizar(f.texto)) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
    const r = F.resumo(L);
    const dias = {}; L.forEach(function (l) { (dias[l.data] = dias[l.data] || []).push(l); });
    el.innerHTML = '<div class="barra-acoes">' + navMes() + '<div class="grupo-botoes"><button class="btn f-receita" data-novo="receita">+ Receita</button><button class="btn f-despesa" data-novo="despesa">+ Despesa</button><button class="btn" data-novo="transferencia">⇄ Transferência</button>' + (cartoes().length ? '<button class="btn" data-novo="cartao">💳 Compra no cartão</button>' : '') + '</div></div>' +
      '<form class="filtros" id="f-filtros"><input type="search" name="texto" placeholder="Buscar descrição…" value="' + esc(f.texto) + '"><select name="tipo">' + opcoes([{ v: '', t: 'Todos os tipos' }, { v: 'receita', t: 'Receitas' }, { v: 'despesa', t: 'Despesas' }, { v: 'transferencia', t: 'Transferências' }, { v: 'pagamento-fatura', t: 'Pagamentos de fatura' }], f.tipo) + '</select><select name="conta"><option value="">Todas as contas e cartões</option>' + opcoes(contas().concat(cartoes()).map(function (c) { return { v: c.id, t: c.nome }; }), f.conta) + '</select><select name="categoria"><option value="">Todas as categorias</option>' + opcoes(cats().map(function (c) { return { v: c.id, t: c.nome }; }), f.categoria) + '</select><select name="status">' + opcoes([{ v: '', t: 'Efetivados e pendentes' }, { v: 'pago', t: 'Efetivados' }, { v: 'pendente', t: 'Pendentes' }], f.status) + '</select></form>' +
      '<div class="f-totais"><span>Receitas <b class="pos">' + moeda(r.receitas) + '</b></span><span>Despesas <b class="neg">' + moeda(r.despesas) + '</b></span><span>Resultado <b class="' + (r.resultado < 0 ? 'neg' : 'pos') + '">' + moeda(r.resultado) + '</b></span><span>Pendentes <b>' + moeda(r.aPagar) + '</b> a pagar · <b>' + moeda(r.aReceber) + '</b> a receber</span></div>' +
      (L.length ? Object.keys(dias).map(function (d) { return '<h4 class="f-dia">' + (function (t) { return t.charAt(0).toUpperCase() + t.slice(1); })(new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })) + '</h4><ul class="f-lancs">' + dias[d].map(linhaLanc).join('') + '</ul>'; }).join('') : UI.vazio('Nenhum lançamento neste mês', 'Use os botões acima, ou importe o extrato do banco (OFX ou CSV) na aba Importar.'));
    const ff = el.querySelector('#f-filtros'); ff.oninput = function () { const fd = new FormData(ff); Object.keys(est.filtro).forEach(function (k) { est.filtro[k] = fd.get(k) || ''; }); clearTimeout(ff._t); ff._t = setTimeout(App.redesenhar, 250); }; ff.onsubmit = function (ev) { ev.preventDefault(); };
    el.onclick = async function (ev) {
      const m = ev.target.closest('[data-mes]'); if (m) return trocaMes(Number(m.dataset.mes));
      const nv = ev.target.closest('[data-novo]'); if (nv) { await editarLanc(null, nv.dataset.novo); return; }
      const li = ev.target.closest('[data-l]'); if (!li) return; const l = base().lancamentos.find(function (x) { return x.id === li.dataset.l; });
      if (ev.target.closest('[data-pago]')) { l.pago = !l.pago; salvar(); App.redesenhar(); return; }
      await editarLanc(l);
    };
  }
  function linhaLanc(l) {
    const c = cat(l.categoria) || { nome: l.tipo === 'transferencia' ? 'Transferência' : l.tipo === 'pagamento-fatura' ? 'Pagamento de fatura' : l.tipo === 'ajuste' ? 'Ajuste de saldo' : 'Sem categoria', cor: '#8c9bab' };
    const onde = l.tipo === 'transferencia' ? nomeConta(l.conta) + ' → ' + nomeConta(l.contaDestino) : l.cartao ? '💳 ' + nomeConta(l.cartao) + (l.tipo === 'pagamento-fatura' ? ' (fatura ' + l.fatura + ')' : '') : nomeConta(l.conta);
    return '<li data-l="' + l.id + '" class="' + (l.pago ? '' : 'pend') + '"><i class="f-ic" style="background:' + c.cor + '">' + esc(c.nome[0] || '?') + '</i><div><b>' + esc(l.descricao) + '</b><small>' + esc(c.nome) + ' · ' + esc(onde) + (l.serie ? ' · ' + (l.serie.modo === 'parcelada' ? 'parcela ' + l.serie.i + '/' + l.serie.n : 'fixa') : '') + ((l.tags || []).length ? ' · #' + l.tags.map(esc).join(' #') : '') + '</small></div>' +
      '<b class="f-valor ' + (sinal(l) > 0 ? 'pos' : sinal(l) < 0 ? 'neg' : '') + '">' + (sinal(l) < 0 ? '− ' : sinal(l) > 0 ? '+ ' : '') + moeda(Math.abs(l.valor)) + '</b>' + (l.cartao && l.tipo !== 'pagamento-fatura' ? '<span class="mini mudo">no cartão</span>' : '<button class="f-st ' + (l.pago ? 'ok' : '') + '" data-pago title="' + (l.pago ? 'Efetivado' : 'Pendente: clique para efetivar') + '">' + (l.pago ? '✓' : '○') + '</button>') + '</li>';
  }

  async function editarLanc(l, tipoNovo) {
    const novo = !l; const tipo = l ? l.tipo : tipoNovo === 'cartao' ? 'despesa' : tipoNovo;
    const x = l || { tipo: tipo, data: est.mes === hojeISO().slice(0, 7) ? hojeISO() : est.mes + '-01', pago: tipoNovo !== 'cartao' && est.mes + '-31' >= hojeISO() ? true : false, conta: (contas()[0] || {}).id, cartao: tipoNovo === 'cartao' ? (cartoes()[0] || {}).id : '' };
    if (tipoNovo === 'cartao') x.pago = false;
    const usaCartao = !!x.cartao && x.tipo !== 'pagamento-fatura';
    const fo = await modal({
      titulo: (novo ? 'Nova ' : 'Editar ') + ({ receita: 'receita', despesa: usaCartao ? 'compra no cartão' : 'despesa', transferencia: 'transferência', 'pagamento-fatura': 'pagamento de fatura', ajuste: 'ajuste de saldo (use valor negativo para reduzir)' }[x.tipo]),
      corpo: '<div class="linha">' + campo('Descrição', '<input name="descricao" required value="' + esc(x.descricao || '') + '" list="f-desc"><datalist id="f-desc">' + Array.from(new Set(lancs().map(function (y) { return y.descricao.replace(/ \(\d+\/\d+\)$/, ''); }))).slice(0, 80).map(function (d) { return '<option value="' + esc(d) + '">'; }).join('') + '</datalist>') + campo('Valor', '<input name="valor" inputmode="decimal" required value="' + esc(x.valor != null ? String(x.valor).replace('.', ',') : '') + '">') + campo('Data', '<input type="date" name="data" required value="' + esc(x.data) + '">') + '</div>' +
        '<div class="linha">' + (x.tipo === 'transferencia' ? campo('De', '<select name="conta">' + opcoes(contas().map(function (c) { return { v: c.id, t: c.nome }; }), x.conta) + '</select>') + campo('Para', '<select name="contaDestino">' + opcoes(contas().map(function (c) { return { v: c.id, t: c.nome }; }), x.contaDestino) + '</select>')
          : usaCartao ? campo('Cartão', '<select name="cartao">' + opcoes(cartoes().map(function (c) { return { v: c.id, t: c.nome }; }), x.cartao) + '</select>') : campo('Conta', '<select name="conta">' + opcoes(contas().map(function (c) { return { v: c.id, t: c.nome }; }), x.conta) + '</select>')) +
        (x.tipo === 'receita' || x.tipo === 'despesa' ? campo('Categoria', '<select name="categoria"><option value="">Sem categoria</option>' + opcoes(cats(x.tipo).map(function (c) { return { v: c.id, t: c.nome }; }), x.categoria) + '</select>') : '') + '</div>' +
        (x.tipo === 'receita' || x.tipo === 'despesa' ? '<div class="linha">' + campo(x.tipo === 'receita' ? 'Cliente' : 'Fornecedor', '<input name="contato" list="f-contatos" value="' + esc(x.contato || '') + '" placeholder="' + (x.tipo === 'receita' ? 'Quem paga' : 'Quem recebe') + '"><datalist id="f-contatos">' + nomesContatos(x.tipo).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>') +
          campo('Centro de custo', '<input name="centroCusto" list="f-centros" value="' + esc(x.centroCusto || '') + '" placeholder="ex.: BPO, Licitações"><datalist id="f-centros">' + centros().map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>') + '</div>' +
          '<div class="linha">' + campo('Competência', '<input type="month" name="competencia" value="' + esc(x.competencia || String(x.data || '').slice(0, 7)) + '">', 'Mês a que a receita ou despesa se refere (DRE por competência).') + campo('Nº do documento', '<input name="documento" value="' + esc(x.documento || '') + '" placeholder="NF, boleto, empenho">') +
          campo('Forma de pagamento', '<select name="forma">' + opcoes([{ v: '', t: 'Não informada' }].concat(FORMAS.map(function (t) { return { v: t, t: t }; })), x.forma || '') + '</select>') + '</div>' : '') +
        (usaCartao || x.tipo === 'pagamento-fatura' ? '' : '<label class="check"><input type="checkbox" name="pago"' + (x.pago ? ' checked' : '') + '> ' + (x.tipo === 'receita' ? 'Recebido' : 'Pago / efetivado') + '</label>') +
        (novo && x.tipo !== 'transferencia' ? '<fieldset><legend>Repetir</legend><div class="linha">' + campo('Modo', '<select name="modo">' + opcoes([{ v: '', t: 'Não repetir' }, { v: 'parcelada', t: 'Parcelado (divide o valor)' }, { v: 'fixa', t: 'Fixo todo mês (mesmo valor)' }], usaCartao ? '' : '') + '</select>') + campo('Vezes', '<input name="vezes" inputmode="numeric" value="12">') + '</div></fieldset>' : '') +
        campo('Etiquetas (separe por vírgula)', '<input name="tags" value="' + esc((x.tags || []).join(', ')) + '">') + campo('Observação', '<textarea name="observacao" rows="2">' + esc(x.observacao || '') + '</textarea>') +
        (!novo ? '<div class="grupo-botoes"><button type="button" class="btn perigo" data-excluir>Excluir</button>' + (x.serie ? '<button type="button" class="btn perigo fantasma" data-excluir-serie>Excluir este e os próximos</button>' : '') + '<button type="button" class="btn fantasma" data-duplicar>Duplicar</button></div>' : ''),
      validar: function (fd) { const v = Nucleo.lerNumeroBR(fd.get('valor')); return x.tipo === 'ajuste' ? (v ? '' : 'Informe o valor do ajuste.') : v > 0 ? '' : 'Informe um valor maior que zero.'; },
      aoAbrir: function (form) {
        const d = form.querySelector('[name=descricao]'); const cs = form.querySelector('[name=categoria]');
        if (d && cs && novo) d.addEventListener('change', function () { const s = F.sugerirCategoria(d.value, lancs()); if (s && !cs.value && cats(x.tipo).some(function (c) { return c.id === s; })) cs.value = s; });
        form.addEventListener('click', async function (ev) {
          if (ev.target.closest('[data-excluir]')) { form.closest('.modal-fundo').remove(); base().lancamentos = base().lancamentos.filter(function (y) { return y !== l; }); salvar(); App.redesenhar(); }
          if (ev.target.closest('[data-excluir-serie]')) { form.closest('.modal-fundo').remove(); base().lancamentos = base().lancamentos.filter(function (y) { return !(y.serie && y.serie.grupo === l.serie.grupo && y.serie.i >= l.serie.i); }); salvar(); App.redesenhar(); }
          if (ev.target.closest('[data-duplicar]')) { form.closest('.modal-fundo').remove(); const c = Object.assign({}, l, { id: Dados.id('lc'), serie: null, pago: false }); base().lancamentos.push(c); salvar(); App.redesenhar(); aviso('Lançamento duplicado.'); }
        });
      }
    });
    if (!fo) return;
    const d = { descricao: fo.get('descricao').trim(), valor: Nucleo.arredondar(Nucleo.lerNumeroBR(fo.get('valor')), 2), data: fo.get('data'), tags: String(fo.get('tags') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean), observacao: fo.get('observacao') };
    if (fo.get('conta') !== null) d.conta = fo.get('conta'); if (fo.get('contaDestino') !== null) d.contaDestino = fo.get('contaDestino');
    if (fo.get('cartao') !== null) { d.cartao = fo.get('cartao'); d.conta = ''; d.pago = false; }
    if (fo.get('categoria') !== null) d.categoria = fo.get('categoria');
    ['contato', 'centroCusto', 'competencia', 'documento', 'forma'].forEach(function (k) { if (fo.get(k) !== null) d[k] = String(fo.get(k)).trim(); });
    if (d.contato) lembrarContato(d.contato, x.tipo);
    if (fo.get('pago') !== null || (!usaCartao && x.tipo !== 'pagamento-fatura')) d.pago = !!fo.get('pago');
    if (x.tipo === 'transferencia' && d.conta === d.contaDestino) { aviso('Escolha contas diferentes.', 'erro'); return; }
    if (l) { Object.assign(l, d); }
    else {
      const novoL = Object.assign({ id: Dados.id('lc'), perfil: perfil().id, tipo: x.tipo }, d);
      const modo = fo.get('modo'); const vezes = Number(fo.get('vezes')) || 1;
      if (modo && vezes > 1) F.gerarSerie(novoL, vezes, modo, Dados.id).forEach(function (y) { base().lancamentos.push(y); });
      else base().lancamentos.push(novoL);
      const o = F.orcamentos(do_(base().orcamentos), lancs(), d.data.slice(0, 7)).find(function (z) { return z.categoria === d.categoria; });
      if (o && o.estado !== 'ok') aviso('Atenção: orçamento de ' + (cat(o.categoria) || {}).nome + ' em ' + Math.round(o.uso * 100) + '%.', 'erro');
    }
    salvar(); App.redesenhar();
  }

  // ---------- contas e cartões ----------
  function telaContas(el) {
    const L = lancs();
    el.innerHTML = '<div class="barra-acoes"><h3>Contas</h3><button class="btn primario" data-a="conta">+ Conta</button></div><div class="cartoes">' +
      contas().map(function (c) { const s = F.saldoConta(c, L); return '<article class="cartao f-conta" style="border-top:4px solid ' + (c.cor || '#8c9bab') + '"><header><h3>' + esc(c.nome) + '</h3><span class="tag claro">' + esc(TIPOS_CONTA[c.tipo] || '') + '</span></header><b class="f-saldo ' + (s < 0 ? 'neg' : '') + '">' + moeda(s) + '</b><footer><button class="btn mini" data-ed-conta="' + c.id + '">Editar</button><button class="btn mini fantasma" data-ajuste="' + c.id + '">Ajustar saldo</button></footer></article>'; }).join('') + '</div>' +
      '<div class="barra-acoes"><h3>Cartões de crédito</h3><button class="btn primario" data-a="cartao">+ Cartão</button></div>' +
      (cartoes().length ? cartoes().map(function (k) {
        const usado = F.limiteUsado(k, L); const ft = F.fatura(k, L, est.mes);
        return '<article class="cartao f-cartao"><header><div class="f-plastico" style="background:' + (k.cor || 'linear-gradient(135deg,#3b3b3b,#050505)') + '"><b>' + esc(k.nome) + '</b><small>fecha dia ' + k.fechamento + ' · vence dia ' + k.vencimento + '</small></div><div class="f-lim"><span>Limite usado</span><div class="barra"><i style="width:' + Math.min(100, usado / (k.limite || 1) * 100) + '%"></i></div><small>' + moeda(usado) + ' de ' + moeda(k.limite) + ' · disponível ' + moeda(k.limite - usado) + '</small></div><div class="grupo-botoes"><button class="btn mini" data-ed-cartao="' + k.id + '">Editar</button></div></header>' +
          '<div class="f-fatura">' + navMes() + '<p>Fatura de <b>' + esc(mesNome(ft.mes)) + '</b>: <b>' + moeda(ft.total) + '</b> · vence ' + data(ft.vencimento) + (ft.pago ? ' · pago ' + moeda(ft.pago) : '') + (ft.aberto > 0.004 ? ' <button class="btn mini primario" data-pagar="' + k.id + '">Pagar fatura</button>' : ft.total ? ' <span class="tag verde">Paga</span>' : '') + '</p>' +
          (ft.itens.length ? '<ul class="f-lancs">' + ft.itens.map(linhaLanc).join('') + '</ul>' : '<p class="mudo mini">Sem compras nesta fatura.</p>') + '</div></article>';
      }).join('') : '<p class="mudo">Nenhum cartão cadastrado.</p>');
    el.onclick = async function (ev) {
      const m = ev.target.closest('[data-mes]'); if (m) return trocaMes(Number(m.dataset.mes));
      const a = ev.target.closest('[data-a]');
      if (a && a.dataset.a === 'conta' || ev.target.closest('[data-ed-conta]')) { await editarConta(base().contas.find(function (c) { return c.id === (ev.target.closest('[data-ed-conta]') || {}).dataset?.edConta; })); return; }
      if (a && a.dataset.a === 'cartao' || ev.target.closest('[data-ed-cartao]')) { await editarCartao(base().cartoes.find(function (c) { return c.id === (ev.target.closest('[data-ed-cartao]') || {}).dataset?.edCartao; })); return; }
      const aj = ev.target.closest('[data-ajuste]'); if (aj) { const c = base().contas.find(function (x) { return x.id === aj.dataset.ajuste; }); const atual = F.saldoConta(c, L); const f = await modal({ titulo: 'Ajustar saldo: ' + c.nome, corpo: campo('Saldo real hoje', '<input name="v" inputmode="decimal" value="' + String(atual).replace('.', ',') + '">', 'Cria um lançamento de ajuste com a diferença.') }); if (!f) return; const dif = Nucleo.arredondar(Nucleo.lerNumeroBR(f.get('v')) - atual, 2); if (dif) { base().lancamentos.push({ id: Dados.id('lc'), perfil: perfil().id, tipo: 'ajuste', descricao: 'Ajuste de saldo', valor: dif, data: hojeISO(), conta: c.id, pago: true, categoria: '' }); salvar(); App.redesenhar(); } return; }
      const pg = ev.target.closest('[data-pagar]'); if (pg) { const k = base().cartoes.find(function (x) { return x.id === pg.dataset.pagar; }); const ft = F.fatura(k, L, est.mes); const f = await modal({ titulo: 'Pagar fatura ' + k.nome, corpo: '<div class="linha">' + campo('Valor', '<input name="v" inputmode="decimal" value="' + String(ft.aberto).replace('.', ',') + '">') + campo('Data', '<input type="date" name="d" value="' + hojeISO() + '">') + campo('Conta', '<select name="c">' + opcoes(contas().map(function (c) { return { v: c.id, t: c.nome }; }), k.contaPagamento) + '</select>') + '</div>' }); if (!f) return; base().lancamentos.push({ id: Dados.id('lc'), perfil: perfil().id, tipo: 'pagamento-fatura', descricao: 'Pagamento fatura ' + k.nome + ' ' + ft.mes, valor: Nucleo.lerNumeroBR(f.get('v')), data: f.get('d'), conta: f.get('c'), cartao: k.id, fatura: ft.mes, pago: true }); salvar(); aviso('Fatura paga.'); App.redesenhar(); return; }
      const li = ev.target.closest('[data-l]'); if (li) { const l = base().lancamentos.find(function (x) { return x.id === li.dataset.l; }); if (ev.target.closest('[data-pago]')) { l.pago = !l.pago; salvar(); App.redesenhar(); } else editarLanc(l); }
    };
  }

  async function editarConta(c) {
    const x = c || { tipo: 'corrente', saldoInicial: 0, cor: '#3d7be0' };
    const f = await modal({ titulo: c ? 'Editar conta' : 'Nova conta', corpo: '<div class="linha">' + campo('Nome', '<input name="nome" required value="' + esc(x.nome || '') + '" placeholder="ex.: Nubank, Itaú, Caixa">') + campo('Tipo', '<select name="tipo">' + opcoes(Object.keys(TIPOS_CONTA).map(function (k) { return { v: k, t: TIPOS_CONTA[k] }; }), x.tipo) + '</select>') + '</div><div class="linha">' + campo('Saldo inicial', '<input name="saldoInicial" inputmode="decimal" value="' + esc(String(x.saldoInicial || 0).replace('.', ',')) + '">') + campo('Cor', '<input type="color" name="cor" value="' + esc(x.cor || '#3d7be0') + '">') + '</div>' + (c ? '<label class="check"><input type="checkbox" name="arquivada"> Arquivar conta</label>' : '') });
    if (!f) return;
    const d = { nome: f.get('nome'), tipo: f.get('tipo'), saldoInicial: Nucleo.lerNumeroBR(f.get('saldoInicial')) || 0, cor: f.get('cor'), arquivada: !!f.get('arquivada') };
    if (c) Object.assign(c, d); else base().contas.push(Object.assign({ id: Dados.id('cc'), perfil: perfil().id }, d));
    salvar(); App.redesenhar();
  }
  async function editarCartao(k) {
    const x = k || { fechamento: 5, vencimento: 12, limite: 0 };
    const f = await modal({ titulo: k ? 'Editar cartão' : 'Novo cartão', corpo: '<div class="linha">' + campo('Nome', '<input name="nome" required value="' + esc(x.nome || '') + '" placeholder="ex.: Visa Itaú">') + campo('Limite', '<input name="limite" inputmode="decimal" value="' + esc(String(x.limite || 0).replace('.', ',')) + '">') + '</div><div class="linha">' + campo('Dia do fechamento', '<input name="fechamento" inputmode="numeric" value="' + esc(x.fechamento) + '">') + campo('Dia do vencimento', '<input name="vencimento" inputmode="numeric" value="' + esc(x.vencimento) + '">') + campo('Conta de pagamento', '<select name="contaPagamento">' + opcoes(contas().map(function (c) { return { v: c.id, t: c.nome }; }), x.contaPagamento) + '</select>') + '</div>' + (k ? '<label class="check"><input type="checkbox" name="arquivado"> Arquivar cartão</label>' : '') });
    if (!f) return;
    const d = { nome: f.get('nome'), limite: Nucleo.lerNumeroBR(f.get('limite')) || 0, fechamento: Math.min(31, Math.max(1, Number(f.get('fechamento')) || 1)), vencimento: Math.min(31, Math.max(1, Number(f.get('vencimento')) || 10)), contaPagamento: f.get('contaPagamento'), arquivado: !!f.get('arquivado') };
    if (k) Object.assign(k, d); else base().cartoes.push(Object.assign({ id: Dados.id('cr'), perfil: perfil().id }, d));
    salvar(); App.redesenhar();
  }

  // ---------- a pagar e a receber ----------
  function telaPendencias(el) {
    const L = lancs().filter(function (l) { return !l.pago && !l.cartao && (l.tipo === 'receita' || l.tipo === 'despesa'); }).sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    const grupo = function (tipo) { const g = L.filter(function (l) { return l.tipo === tipo; }); const atras = g.filter(function (l) { return l.data < hojeISO(); }); return '<section class="cartao"><h3>' + (tipo === 'despesa' ? 'Contas a pagar' : 'Contas a receber') + ' <small class="mudo">' + moeda(g.reduce(function (s, l) { return s + l.valor; }, 0)) + (atras.length ? ' · <span class="alerta">' + atras.length + ' atrasada(s)</span>' : '') + '</small></h3>' + (g.length ? '<ul class="f-lancs">' + g.slice(0, 100).map(function (l) { return linhaLanc(l).replace('<div><b>', '<div><span class="f-venc ' + (l.data < hojeISO() ? 'atrasado' : l.data <= F.addDias(hojeISO(), 3) ? 'logo' : '') + '">' + data(l.data) + '</span> <b>'); }).join('') + '</ul>' : '<p class="mudo">Nada pendente.</p>') + '</section>'; };
    el.innerHTML = '<div class="cartoes largos">' + grupo('despesa') + grupo('receita') + '</div>';
    el.onclick = function (ev) { const li = ev.target.closest('[data-l]'); if (!li) return; const l = base().lancamentos.find(function (x) { return x.id === li.dataset.l; }); if (ev.target.closest('[data-pago]')) { l.pago = true; salvar(); aviso('Efetivado.'); App.redesenhar(); } else editarLanc(l); };
  }

  // ---------- orçamentos e metas ----------
  function telaPlanejamento(el) {
    const orcs = do_(base().orcamentos); const st = F.orcamentos(orcs, lancs(), est.mes); const metas = do_(base().metas);
    el.innerHTML = navMes() + '<div class="cartoes largos"><section class="cartao"><header><h3>Orçamento mensal por categoria</h3><button class="btn mini primario" data-a="orc">Definir orçamentos</button></header>' +
      (st.length ? st.map(function (o) { const c = cat(o.categoria) || {}; return '<div class="f-orc grande"><span><i style="background:' + (c.cor || '#999') + '"></i>' + esc(c.nome || '') + '</span><div class="barra"><i class="' + o.estado + '" style="width:' + Math.min(100, o.uso * 100) + '%"></i></div><small>' + moeda(o.gasto) + ' de ' + moeda(o.previsto) + ' · ' + (o.restante >= 0 ? 'restam ' + moeda(o.restante) : '<b class="neg">estourou ' + moeda(-o.restante) + '</b>') + '</small></div>'; }).join('') : '<p class="mudo">Defina quanto pretende gastar por categoria. Você é avisado ao passar de 80%.</p>') + '</section>' +
      '<section class="cartao"><header><h3>Metas</h3><button class="btn mini primario" data-a="meta">+ Meta</button></header>' +
      (metas.length ? metas.map(function (m) { const tot = (m.aportes || []).reduce(function (s, a) { return s + a.valor; }, 0); const pc = m.alvo ? tot / m.alvo : 0; const meses = m.prazo ? Math.max(1, Math.round((new Date(m.prazo) - new Date()) / (30.4 * 86400000))) : null; return '<div class="f-meta"><div><b>' + esc(m.nome) + '</b><small>' + moeda(tot) + ' de ' + moeda(m.alvo) + (m.prazo ? ' · até ' + data(m.prazo) : '') + (meses && tot < m.alvo ? ' · guardar ' + moeda((m.alvo - tot) / meses) + '/mês' : '') + '</small><div class="barra"><i style="width:' + Math.min(100, pc * 100) + '%"></i></div></div><b>' + Math.round(pc * 100) + '%</b><button class="btn mini" data-aporte="' + m.id + '">+ Aporte</button><button class="btn mini fantasma perigo" data-del-meta="' + m.id + '">×</button></div>'; }).join('') : '<p class="mudo">Crie metas (reserva de emergência, capital de giro, viagem) e registre os aportes.</p>') + '</section></div>';
    el.onclick = async function (ev) {
      const m = ev.target.closest('[data-mes]'); if (m) return trocaMes(Number(m.dataset.mes));
      const a = ev.target.closest('[data-a]');
      if (a && a.dataset.a === 'orc') {
        const ds = cats('despesa'); const f = await modal({ titulo: 'Orçamento mensal', corpo: '<table class="tabela compacta"><tbody>' + ds.map(function (c) { const o = orcs.find(function (x) { return x.categoria === c.id; }); return '<tr><td><i class="f-bol" style="background:' + c.cor + '"></i> ' + esc(c.nome) + '</td><td><input name="o_' + c.id + '" inputmode="decimal" value="' + (o ? String(o.valor).replace('.', ',') : '') + '" placeholder="sem limite"></td></tr>'; }).join('') + '</tbody></table>' });
        if (!f) return; base().orcamentos = base().orcamentos.filter(function (o) { return o.perfil !== perfil().id; });
        ds.forEach(function (c) { const v = Nucleo.lerNumeroBR(f.get('o_' + c.id)); if (v > 0) base().orcamentos.push({ perfil: perfil().id, categoria: c.id, valor: v }); }); salvar(); App.redesenhar();
      }
      if (a && a.dataset.a === 'meta') { const f = await modal({ titulo: 'Nova meta', corpo: '<div class="linha">' + campo('Nome', '<input name="n" required placeholder="Reserva de emergência">') + campo('Valor alvo', '<input name="a" inputmode="decimal" required>') + campo('Prazo', '<input type="date" name="p">') + '</div>' }); if (f) { base().metas.push({ id: Dados.id('mt'), perfil: perfil().id, nome: f.get('n'), alvo: Nucleo.lerNumeroBR(f.get('a')), prazo: f.get('p'), aportes: [] }); salvar(); App.redesenhar(); } }
      const ap = ev.target.closest('[data-aporte]'); if (ap) { const mt = base().metas.find(function (x) { return x.id === ap.dataset.aporte; }); const f = await modal({ titulo: 'Aporte em ' + mt.nome, corpo: '<div class="linha">' + campo('Valor', '<input name="v" inputmode="decimal" required>') + campo('Data', '<input type="date" name="d" value="' + hojeISO() + '">') + '</div>' }); if (f) { mt.aportes.push({ valor: Nucleo.lerNumeroBR(f.get('v')), data: f.get('d') }); salvar(); App.redesenhar(); } }
      const dm = ev.target.closest('[data-del-meta]'); if (dm && await confirmar('Excluir meta', 'Excluir esta meta?', 'Excluir')) { base().metas = base().metas.filter(function (x) { return x.id !== dm.dataset.delMeta; }); salvar(); App.redesenhar(); }
    };
  }

  // ---------- relatórios ----------
  function telaRelatorios(el) {
    telaRelatoriosBase(el);
    const L = lancs().filter(function (l) { return (l.competencia || F.mesDe(l.data)).slice(0, 4) === est.mes.slice(0, 4); });
    const cc = F.porCampo(L, 'centroCusto'); const ct = F.porCampo(L, 'contato').slice(0, 10);
    el.insertAdjacentHTML('beforeend', '<div class="cartoes largos"><section class="cartao"><h3>Resultado por centro de custo (' + est.mes.slice(0, 4) + ')</h3>' + (cc.length > 1 || (cc[0] && cc[0].chave) ? '<table class="tabela compacta"><thead><tr><th>Centro de custo</th><th class="n">Receitas</th><th class="n">Despesas</th><th class="n">Resultado</th></tr></thead><tbody>' + cc.map(function (x) { return '<tr><td>' + esc(x.chave || 'Sem centro de custo') + '</td><td class="n pos">' + moeda(x.receitas) + '</td><td class="n neg">' + moeda(x.despesas) + '</td><td class="n ' + (x.resultado < 0 ? 'neg' : '') + '"><b>' + moeda(x.resultado) + '</b></td></tr>'; }).join('') + '</tbody></table>' : '<p class="mudo">Informe o centro de custo nos lançamentos para ver o resultado de cada área ou contrato.</p>') + '</section>' +
      '<section class="cartao"><h3>Maiores clientes e fornecedores (' + est.mes.slice(0, 4) + ')</h3>' + (ct.some(function (x) { return x.chave; }) ? '<table class="tabela compacta"><thead><tr><th>Nome</th><th class="n">Recebido / a receber</th><th class="n">Pago / a pagar</th></tr></thead><tbody>' + ct.filter(function (x) { return x.chave; }).map(function (x) { return '<tr><td>' + esc(x.chave) + '</td><td class="n pos">' + moeda(x.receitas) + '</td><td class="n neg">' + moeda(x.despesas) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="mudo">Informe cliente ou fornecedor nos lançamentos.</p>') + '</section></div>');
  }
  function telaRelatoriosBase(el) {
    est.rel = est.rel || { de: F.addMeses(est.mes + '-01', -5).slice(0, 7), ate: est.mes };
    const R = est.rel; const L = lancs().filter(function (l) { const m = l.data.slice(0, 7); return m >= R.de && m <= R.ate; });
    const meses = []; let m = R.de; while (m <= R.ate && meses.length < 36) { meses.push(m); m = F.addMeses(m + '-01', 1).slice(0, 7); }
    const d = F.dre(L, cats()); const desp = itensCategoria(L, 'despesa'); const rec = itensCategoria(L, 'receita');
    el.innerHTML = '<form class="filtros" id="f-rel"><label>De <input type="month" name="de" value="' + R.de + '"></label><label>Até <input type="month" name="ate" value="' + R.ate + '"></label><button type="button" class="btn" data-a="csv">Exportar CSV</button><button type="button" class="btn fantasma" data-a="imprimir">Imprimir</button></form>' +
      '<div class="cartoes"><section class="cartao"><h3>Despesas por categoria</h3>' + rosca(desp) + '</section><section class="cartao"><h3>Receitas por categoria</h3>' + rosca(rec) + '</section>' +
      '<section class="cartao"><h3>DRE simplificada</h3><table class="tabela compacta"><tbody>' + [['Receita bruta', d.receita], ['(−) Impostos', -d.impostos], ['= Receita líquida', d.receitaLiquida, 1], ['(−) Custos', -d.custos], ['= Lucro bruto', d.lucroBruto, 1], ['(−) Despesas operacionais', -d.operacionais], ['= Resultado operacional', d.resultadoOperacional, 1], ['(−) Despesas financeiras', -d.financeiras], ['= Resultado do período', d.resultado, 1]].map(function (x) { return '<tr' + (x[2] ? ' class="f-sub"' : '') + '><td>' + x[0] + '</td><td class="n ' + (x[1] < 0 ? 'neg' : '') + '">' + moeda(x[1]) + '</td></tr>'; }).join('') + '<tr><td>Margem</td><td class="n">' + (d.margem == null ? '—' : UI.pct(d.margem)) + '</td></tr><tr><td class="mudo">Investimentos (fora do resultado)</td><td class="n mudo">' + moeda(d.investimentos) + '</td></tr></tbody></table><p class="mini mudo">O grupo de cada categoria (imposto, custo, operacional…) é definido na aba Categorias.</p></section></div>' +
      '<section class="cartao"><h3>Mês a mês</h3><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Categoria</th>' + meses.map(function (x) { return '<th class="n">' + esc(mesNome(x).slice(0, 3) + '/' + x.slice(2, 4)) + '</th>'; }).join('') + '<th class="n">Total</th><th class="n">Média</th></tr></thead><tbody>' +
      ['receita', 'despesa'].map(function (tp) { return cats(tp).map(function (c) { const vs = meses.map(function (x) { return F.doMes(L, x).filter(function (l) { return l.tipo === tp && l.categoria === c.id; }).reduce(function (s, l) { return s + l.valor; }, 0); }); const t = vs.reduce(function (s, v) { return s + v; }, 0); if (!t) return ''; return '<tr><td><i class="f-bol" style="background:' + c.cor + '"></i> ' + esc(c.nome) + '</td>' + vs.map(function (v) { return '<td class="n">' + (v ? moeda(v) : '—') + '</td>'; }).join('') + '<td class="n"><b>' + moeda(t) + '</b></td><td class="n">' + moeda(t / meses.length) + '</td></tr>'; }).join(''); }).join('') +
      '<tr class="f-sub"><td>Resultado</td>' + meses.map(function (x) { const r = F.resumo(L, x).resultado; return '<td class="n ' + (r < 0 ? 'neg' : 'pos') + '">' + moeda(r) + '</td>'; }).join('') + '<td class="n">' + moeda(F.resumo(L).resultado) + '</td><td></td></tr></tbody></table></div></section>';
    const fr = el.querySelector('#f-rel'); fr.onchange = function () { const fd = new FormData(fr); R.de = fd.get('de') || R.de; R.ate = fd.get('ate') || R.ate; App.redesenhar(); };
    el.onclick = function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'csv') UI.baixar('lancamentos-' + R.de + '-a-' + R.ate + '.csv', '﻿' + Nucleo.paraCSV([['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta/Cartão', 'Valor', 'Efetivado', 'Etiquetas', 'Observação']].concat(L.sort(function (a, b) { return a.data < b.data ? -1 : 1; }).map(function (l) { return [l.data, l.tipo, l.descricao, (cat(l.categoria) || {}).nome || '', l.cartao ? nomeConta(l.cartao) : nomeConta(l.conta), sinal(l) * l.valor || l.valor, l.pago ? 'sim' : 'não', (l.tags || []).join(', '), l.observacao || '']; }))), 'text/csv;charset=utf-8');
      if (b.dataset.a === 'imprimir') { const w = window.open('', '_blank'); if (!w) return; const baseU = location.href.replace(/#.*$/, '').replace(/[^/]*$/, ''); w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório financeiro</title><link rel="stylesheet" href="' + baseU + 'css/app.css"></head><body class="impressao"><div class="cabecalho-seven"><img src="' + baseU + 'img/seven-marca.png" alt=""><div><b>SEVEN</b><small>MINHAS FINANÇAS</small></div></div><h1>' + esc(perfil().nome) + ' · ' + esc(mesNome(R.de)) + ' a ' + esc(mesNome(R.ate)) + '</h1>' + el.innerHTML.replace(/<form[\s\S]*?<\/form>/, '') + '<script>setTimeout(function(){print()},500)<\/script></body></html>'); w.document.close(); }
    };
  }

  // ---------- importar extrato ----------
  function telaImportar(el) {
    el.innerHTML = '<section class="cartao"><h3>Importar extrato do banco</h3><p>Baixe o extrato no internet banking em <b>OFX</b> (recomendado) ou <b>CSV</b> e importe aqui. Lançamentos repetidos (mesmo identificador do banco, ou mesma data, valor e descrição) são ignorados, e a categoria é sugerida pelo histórico.</p><div class="linha">' + campo('Conta de destino', '<select id="imp-conta">' + opcoes(contas().map(function (c) { return { v: c.id, t: c.nome }; }).concat(cartoes().map(function (c) { return { v: 'cartao:' + c.id, t: '💳 ' + c.nome + ' (fatura)' }; }))) + '</select>') + '</div><button class="btn primario" data-a="arquivo">Escolher arquivo OFX ou CSV</button></section><div id="imp-previa"></div>';
    let previa = [];
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'arquivo') {
        const arq = await UI.escolherArquivo('.ofx,.qfx,.csv,.txt'); if (!arq) return; const txt = await UI.lerArquivoTexto(arq);
        previa = /<OFX>|<STMTTRN>/i.test(txt) ? F.lerOFX(txt) : F.lerExtratoCSV(Nucleo.lerCSV(txt), Nucleo.lerNumeroBR);
        if (!previa.length) { aviso('Não reconheci lançamentos no arquivo. Para CSV, as colunas precisam ter Data e Valor.', 'erro'); return; }
        const existentes = lancs();
        previa.forEach(function (p) { p.dup = existentes.some(function (l) { return (p.idBanco && l.idBanco === p.idBanco) || (l.data === p.data && Math.abs(l.valor - p.valor) < 0.005 && Nucleo.normalizar(l.descricao) === Nucleo.normalizar(p.descricao)); }); p.categoria = F.sugerirCategoria(p.descricao, existentes) || ''; p.usar = !p.dup; });
        el.querySelector('#imp-previa').innerHTML = '<section class="cartao"><h3>' + previa.length + ' lançamento(s) encontrados · ' + previa.filter(function (p) { return p.dup; }).length + ' já existentes</h3><div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Importar</th><th>Data</th><th>Descrição</th><th class="n">Valor</th><th>Categoria</th></tr></thead><tbody>' + previa.map(function (p, i) { return '<tr class="' + (p.dup ? 'inativo' : '') + '"><td><input type="checkbox" data-usar="' + i + '"' + (p.usar ? ' checked' : '') + '></td><td>' + data(p.data) + '</td><td>' + esc(p.descricao) + (p.dup ? ' <span class="tag claro">já existe</span>' : '') + '</td><td class="n ' + (p.tipo === 'despesa' ? 'neg' : 'pos') + '">' + (p.tipo === 'despesa' ? '− ' : '+ ') + moeda(p.valor) + '</td><td><select data-cat="' + i + '"><option value="">Sem categoria</option>' + opcoes(cats(p.tipo).map(function (c) { return { v: c.id, t: c.nome }; }), p.categoria) + '</select></td></tr>'; }).join('') + '</tbody></table></div><button class="btn primario" data-a="confirmar">Importar selecionados</button></section>';
        el.querySelector('#imp-previa').onchange = function (e2) { const u = e2.target.dataset.usar, c = e2.target.dataset.cat; if (u != null) previa[u].usar = e2.target.checked; if (c != null) previa[c].categoria = e2.target.value; };
      }
      if (b.dataset.a === 'confirmar') {
        const dest = el.querySelector('#imp-conta').value; const cartao = dest.indexOf('cartao:') === 0 ? dest.slice(7) : '';
        let n = 0; previa.filter(function (p) { return p.usar; }).forEach(function (p) { base().lancamentos.push({ id: Dados.id('lc'), perfil: perfil().id, tipo: p.tipo, descricao: p.descricao, valor: p.valor, data: p.data, conta: cartao ? '' : dest, cartao: cartao, categoria: p.categoria, pago: !cartao, idBanco: p.idBanco || '' }); n++; });
        salvar(); aviso(n + ' lançamento(s) importados.'); est.mes = (previa[0] || {}).data ? previa[0].data.slice(0, 7) : est.mes; location.hash = '#/financas/lancamentos';
      }
    };
  }

  // ---------- fluxo de caixa (modelo Conta Azul) ----------
  // Saldo dia a dia em SVG, com linha do zero (o saldo pode ficar negativo).
  function graficoSaldo(dias) {
    const W = 760, H = 220, esq = 56, dir = W - 10, topo = 12, base = H - 26;
    const vs = dias.map(function (d) { return d.saldo; }); const max = Math.max(0, Math.max.apply(null, vs)), min = Math.min(0, Math.min.apply(null, vs));
    const amp = max - min || 1; const y = function (v) { return topo + (max - v) / amp * (base - topo); };
    const larg = (dir - esq) / dias.length;
    let c = '<line class="gf-base" x1="' + esq + '" x2="' + dir + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>';
    [max, 0, min].filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (v) { c += '<text class="gf-eixo" x="' + (esq - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + esc(Graficos.compacto(v)) + '</text>'; });
    dias.forEach(function (d, i) {
      const x = esq + i * larg; const y1 = y(Math.max(0, d.saldo)), y2 = y(Math.min(0, d.saldo));
      c += '<rect class="' + (d.saldo < 0 ? 'f-neg' : 'f-pos') + '" x="' + (x + 1).toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + Math.max(1, larg - 2).toFixed(1) + '" height="' + Math.max(1, y2 - y1).toFixed(1) + '" rx="1"><title>' + esc(data(d.data) + ' · saldo ' + moeda(d.saldo) + ' · entradas ' + moeda(d.entradas) + ' · saídas ' + moeda(d.saidas)) + '</title></rect>';
      if (i % Math.ceil(dias.length / 8) === 0) c += '<text class="gf-eixo" x="' + (x + larg / 2).toFixed(1) + '" y="' + (base + 16) + '" text-anchor="middle">' + esc(d.data.slice(8, 10) + '/' + d.data.slice(5, 7)) + '</text>';
    });
    return '<svg class="f-fluxo-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Saldo projetado dia a dia">' + c + '</svg>';
  }
  function telaFluxo(el) {
    const L = lancs(); const dias = est.fluxoDias || 30; const fx = F.fluxoDiario(L, contas(), hojeISO(), dias);
    const ent = fx.dias.reduce(function (s, d) { return s + d.entradas; }, 0), sai = fx.dias.reduce(function (s, d) { return s + d.saidas; }, 0);
    const meses = []; for (let i = -5; i <= 6; i++) meses.push(F.addMeses(hojeISO().slice(0, 7) + '-01', i).slice(0, 7));
    const fm = F.fluxoMensal(L, meses);
    const semanas = []; for (let i = 0; i < fx.dias.length; i += 7) { const b = fx.dias.slice(i, i + 7); semanas.push({ de: b[0].data, ate: b[b.length - 1].data, entradas: b.reduce(function (s, d) { return s + d.entradas; }, 0), saidas: b.reduce(function (s, d) { return s + d.saidas; }, 0), saldo: b[b.length - 1].saldo }); }
    el.innerHTML = '<div class="barra-acoes"><div class="grupo-botoes">' + [30, 60, 90].map(function (n) { return '<button class="btn' + (n === dias ? ' ativo' : '') + '" data-dias="' + n + '">' + n + ' dias</button>'; }).join('') + '</div><span class="mini mudo">Projeção pelo regime de caixa: saldo efetivado hoje + contas a receber e a pagar nas datas de vencimento. Atrasados entram hoje.</span></div>' +
      '<div class="kpis f-kpis"><div><span>Saldo hoje</span><b class="' + (fx.saldoInicial < 0 ? 'neg' : '') + '">' + moeda(fx.saldoInicial) + '</b></div><div><span>Entradas previstas</span><b class="pos">' + moeda(ent) + '</b></div><div><span>Saídas previstas</span><b class="neg">' + moeda(sai) + '</b></div><div><span>Saldo em ' + dias + ' dias</span><b class="' + (fx.dias[fx.dias.length - 1].saldo < 0 ? 'neg' : '') + '">' + moeda(fx.dias[fx.dias.length - 1].saldo) + '</b></div><div><span>Menor saldo do período</span><b class="' + (fx.minimo.saldo < 0 ? 'neg' : '') + '">' + moeda(fx.minimo.saldo) + '</b><small>' + data(fx.minimo.data) + '</small></div></div>' +
      (fx.primeiroNegativo ? '<div class="nota-importante f-alerta">⚠ O caixa fica <b>negativo em ' + data(fx.primeiroNegativo.data) + '</b> (' + moeda(fx.primeiroNegativo.saldo) + '). Antecipe recebimentos, renegocie pagamentos ou programe um aporte.</div>' : '') +
      ((fx.atrasadoEntrada || fx.atrasadoSaida) ? '<p class="mini">Atrasados incluídos hoje: <b class="pos">' + moeda(fx.atrasadoEntrada) + '</b> a receber e <b class="neg">' + moeda(fx.atrasadoSaida) + '</b> a pagar. <a href="#/financas/pendencias">Ver pendências</a></p>' : '') +
      '<section class="cartao"><h3>Saldo projetado dia a dia</h3>' + graficoSaldo(fx.dias) + '</section>' +
      '<section class="cartao"><h3>Por semana</h3><div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Semana</th><th class="n">Entradas</th><th class="n">Saídas</th><th class="n">Saldo no fim</th></tr></thead><tbody>' + semanas.map(function (w) { return '<tr><td>' + data(w.de) + ' a ' + data(w.ate) + '</td><td class="n pos">' + moeda(w.entradas) + '</td><td class="n neg">' + moeda(w.saidas) + '</td><td class="n ' + (w.saldo < 0 ? 'neg' : '') + '"><b>' + moeda(w.saldo) + '</b></td></tr>'; }).join('') + '</tbody></table></div></section>' +
      '<section class="cartao"><h3>Previsto × realizado por mês</h3><div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Mês</th><th class="n">Entradas previstas</th><th class="n">Realizadas</th><th class="n">Saídas previstas</th><th class="n">Realizadas</th><th class="n">Resultado previsto</th><th class="n">Realizado</th></tr></thead><tbody>' + fm.map(function (m) { return '<tr class="' + (m.mes === hojeISO().slice(0, 7) ? 'f-atual' : '') + '"><td class="nowrap">' + esc(mesNome(m.mes)) + '</td><td class="n">' + moeda(m.previstoEntradas) + '</td><td class="n pos">' + moeda(m.realizadoEntradas) + '</td><td class="n">' + moeda(m.previstoSaidas) + '</td><td class="n neg">' + moeda(m.realizadoSaidas) + '</td><td class="n ' + (m.previstoResultado < 0 ? 'neg' : '') + '">' + moeda(m.previstoResultado) + '</td><td class="n ' + (m.realizadoResultado < 0 ? 'neg' : '') + '"><b>' + moeda(m.realizadoResultado) + '</b></td></tr>'; }).join('') + '</tbody></table></div></section></div>';
    el.onclick = function (ev) { const b = ev.target.closest('[data-dias]'); if (b) { est.fluxoDias = Number(b.dataset.dias); App.redesenhar(); } };
  }

  // ---------- clientes e fornecedores ----------
  function telaContatos(el) {
    const L = lancs(); const hoje = hojeISO(); const papel = est.papel || 'receita';
    const ag = F.aging(L, hoje, papel);
    const tot = ag.reduce(function (s, x) { ['aVencer', 'd30', 'd60', 'd90', 'mais90', 'total', 'atrasado'].forEach(function (k) { s[k] += x[k]; }); return s; }, { aVencer: 0, d30: 0, d60: 0, d90: 0, mais90: 0, total: 0, atrasado: 0 });
    const cad = contatos();
    el.innerHTML = '<div class="barra-acoes"><div class="grupo-botoes"><button class="btn' + (papel === 'receita' ? ' ativo' : '') + '" data-papel="receita">Clientes · a receber</button><button class="btn' + (papel === 'despesa' ? ' ativo' : '') + '" data-papel="despesa">Fornecedores · a pagar</button></div><button class="btn primario" data-a="novo-contato">+ Cliente ou fornecedor</button></div>' +
      '<div class="kpis f-kpis"><div><span>Total em aberto</span><b>' + moeda(tot.total) + '</b></div><div><span>A vencer</span><b>' + moeda(tot.aVencer) + '</b></div><div><span>Atrasado</span><b class="neg">' + moeda(tot.atrasado) + '</b><small>' + (tot.total ? Math.round(tot.atrasado / tot.total * 100) : 0) + '% do total</small></div><div><span>Mais de 90 dias</span><b class="neg">' + moeda(tot.mais90) + '</b></div></div>' +
      '<section class="cartao"><h3>' + (papel === 'receita' ? 'Contas a receber por cliente (inadimplência)' : 'Contas a pagar por fornecedor') + '</h3>' + (ag.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>' + (papel === 'receita' ? 'Cliente' : 'Fornecedor') + '</th><th class="n">A vencer</th><th class="n">1–30 dias</th><th class="n">31–60</th><th class="n">61–90</th><th class="n">+90</th><th class="n">Total</th><th>Mais antigo</th></tr></thead><tbody>' +
        ag.map(function (x) { return '<tr class="clicavel" data-ver="' + esc(x.contato) + '"><td><b>' + esc(x.contato) + '</b> <small class="mudo">' + x.qtd + ' título(s)</small></td><td class="n">' + moeda(x.aVencer) + '</td><td class="n">' + (x.d30 ? moeda(x.d30) : '—') + '</td><td class="n">' + (x.d60 ? moeda(x.d60) : '—') + '</td><td class="n">' + (x.d90 ? moeda(x.d90) : '—') + '</td><td class="n ' + (x.mais90 ? 'neg' : '') + '">' + (x.mais90 ? moeda(x.mais90) : '—') + '</td><td class="n"><b>' + moeda(x.total) + '</b></td><td>' + (x.maisAntigo ? data(x.maisAntigo) : '—') + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr><th>Total</th><th class="n">' + moeda(tot.aVencer) + '</th><th class="n">' + moeda(tot.d30) + '</th><th class="n">' + moeda(tot.d60) + '</th><th class="n">' + moeda(tot.d90) + '</th><th class="n">' + moeda(tot.mais90) + '</th><th class="n">' + moeda(tot.total) + '</th><th></th></tr></tfoot></table></div>' : '<p class="mudo">Nada em aberto. Informe o cliente ou fornecedor nos lançamentos para acompanhar por aqui.</p>') + '</section>' +
      '<section class="cartao"><h3>Cadastro</h3>' + (cad.length ? '<ul class="f-lista">' + cad.map(function (c) { return '<li data-contato="' + c.id + '"><i style="background:' + (c.papel === 'cliente' ? '#1baf7a' : c.papel === 'fornecedor' ? '#e34948' : '#a8792a') + '"></i>' + esc(c.nome) + ' <small class="mudo">' + esc({ cliente: 'Cliente', fornecedor: 'Fornecedor', ambos: 'Cliente e fornecedor' }[c.papel] || '') + (c.documento ? ' · ' + esc(c.documento) : '') + (c.email ? ' · ' + esc(c.email) : '') + '</small><b><button type="button" class="btn mini fantasma" data-ed-contato="' + c.id + '">Editar</button></b></li>'; }).join('') + '</ul>' : '<p class="mudo">Os nomes usados nos lançamentos entram aqui automaticamente.</p>') + '</section>';
    el.onclick = async function (ev) {
      const p = ev.target.closest('[data-papel]'); if (p) { est.papel = p.dataset.papel; App.redesenhar(); return; }
      const v = ev.target.closest('[data-ver]'); if (v) { est.filtro.texto = ''; const l = L.filter(function (x) { return (x.contato || 'Sem contato') === v.dataset.ver && !x.pago && x.tipo === papel; }); await modal({ titulo: v.dataset.ver, largo: true, botao: false, corpo: '<ul class="f-lancs">' + l.sort(function (a, b) { return a.data < b.data ? -1 : 1; }).map(linhaLanc).join('') + '</ul><p class="mini mudo">Para baixar, efetive o lançamento em Lançamentos ou A pagar / receber.</p>' }); return; }
      const ed = ev.target.closest('[data-ed-contato]'); const novo = ev.target.closest('[data-a=novo-contato]'); if (!ed && !novo) return;
      const c = ed ? base().contatos.find(function (x) { return x.id === ed.dataset.edContato; }) : { papel: papel === 'receita' ? 'cliente' : 'fornecedor' };
      const f = await modal({ titulo: ed ? 'Editar ' + c.nome : 'Novo cliente ou fornecedor', corpo: '<div class="linha">' + campo('Nome', '<input name="nome" required value="' + esc(c.nome || '') + '">') + campo('Tipo', '<select name="papel">' + opcoes([{ v: 'cliente', t: 'Cliente' }, { v: 'fornecedor', t: 'Fornecedor' }, { v: 'ambos', t: 'Cliente e fornecedor' }], c.papel) + '</select>') + '</div><div class="linha">' + campo('CNPJ / CPF', '<input name="documento" value="' + esc(c.documento || '') + '">') + campo('E-mail', '<input type="email" name="email" value="' + esc(c.email || '') + '">') + campo('Telefone', '<input name="telefone" value="' + esc(c.telefone || '') + '">') + '</div>' + (ed ? '<label class="check"><input type="checkbox" name="excluir"> Excluir do cadastro (os lançamentos ficam)</label>' : '') });
      if (!f) return;
      if (f.get('excluir')) { base().contatos = base().contatos.filter(function (x) { return x !== c; }); salvar(); App.redesenhar(); return; }
      const nomeAntigo = c.nome; Object.assign(c, { nome: f.get('nome').trim(), papel: f.get('papel'), documento: f.get('documento').trim(), email: f.get('email').trim(), telefone: f.get('telefone').trim() });
      if (!ed) { c.id = Dados.id('ct'); c.perfil = perfil().id; base().contatos.push(c); }
      else if (nomeAntigo && nomeAntigo !== c.nome) lancs().forEach(function (l) { if (l.contato === nomeAntigo) l.contato = c.nome; });
      salvar(); App.redesenhar();
    };
  }

  // ---------- conciliação bancária ----------
  function telaConciliacao(el) {
    const cz = est.conc;
    el.innerHTML = '<section class="cartao"><h3>Conciliação bancária</h3><p>Importe o extrato (OFX ou CSV). Cada linha do banco é comparada com as contas a pagar e a receber em aberto (mesmo valor, até 5 dias de diferença). Confirme as sugestões para dar baixa; o que não tiver par vira lançamento novo.</p><div class="linha">' +
      campo('Conta do extrato', '<select id="cz-conta">' + opcoes(contas().map(function (c) { return { v: c.id, t: c.nome }; }), cz && cz.conta) + '</select>') + '<button class="btn primario" data-a="cz-arquivo">Escolher extrato…</button></div></section><div id="cz-res"></div>';
    const pintar = function () {
      if (!est.conc) return; const r = est.conc.itens;
      const pares = r.filter(function (x) { return x.lancamento; }).length;
      el.querySelector('#cz-res').innerHTML = '<section class="cartao"><h3>' + r.length + ' linha(s) do extrato · ' + pares + ' com par encontrado · ' + r.filter(function (x) { return x.dup; }).length + ' já lançadas</h3><div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Usar</th><th>Data</th><th>Extrato</th><th class="n">Valor</th><th>Ação</th></tr></thead><tbody>' +
        r.map(function (x, i) { return '<tr class="' + (x.dup ? 'inativo' : '') + '"><td><input type="checkbox" data-cz="' + i + '"' + (x.usar ? ' checked' : '') + (x.dup ? ' disabled' : '') + ' aria-label="Usar linha"></td><td>' + data(x.linha.data) + '</td><td>' + esc(x.linha.descricao) + '</td><td class="n ' + (x.linha.tipo === 'despesa' ? 'neg' : 'pos') + '">' + (x.linha.tipo === 'despesa' ? '− ' : '+ ') + moeda(x.linha.valor) + '</td><td>' + (x.dup ? '<span class="mudo">Já existe no sistema</span>' : x.lancamento ? '<span class="tag ex-paga">Baixar</span> ' + esc(x.lancamento.descricao) + ' <small class="mudo">(' + data(x.lancamento.data) + (x.lancamento.contato ? ' · ' + esc(x.lancamento.contato) : '') + ')</small>' : '<span class="tag claro">Criar lançamento</span>') + '</td></tr>'; }).join('') + '</tbody></table></div><div class="grupo-botoes"><button class="btn primario" data-a="cz-ok">Conciliar selecionados</button><button class="btn fantasma" data-a="cz-limpar">Descartar</button></div></section>';
    };
    pintar();
    el.onchange = function (ev) { const i = ev.target.dataset.cz; if (i != null) est.conc.itens[i].usar = ev.target.checked; };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'cz-arquivo') {
        const arq = await UI.escolherArquivo('.ofx,.qfx,.csv,.txt'); if (!arq) return; const txt = await UI.lerArquivoTexto(arq);
        const linhas = /<OFX>|<STMTTRN>/i.test(txt) ? F.lerOFX(txt) : F.lerExtratoCSV(Nucleo.lerCSV(txt), Nucleo.lerNumeroBR);
        if (!linhas.length) { aviso('Não reconheci lançamentos no arquivo.', 'erro'); return; }
        const conta = el.querySelector('#cz-conta').value; const todos = lancs();
        const abertos = todos.filter(function (l) { return !l.pago && !l.cartao && (l.tipo === 'receita' || l.tipo === 'despesa') && (!l.conta || l.conta === conta); });
        const itens = F.conciliar(linhas, abertos).map(function (x) { x.dup = !x.lancamento && todos.some(function (l) { return l.pago && ((x.linha.idBanco && l.idBanco === x.linha.idBanco) || (l.data === x.linha.data && Math.abs(l.valor - x.linha.valor) < 0.005)); }); x.usar = !x.dup; return x; });
        est.conc = { conta: conta, itens: itens }; pintar(); return;
      }
      if (b.dataset.a === 'cz-limpar') { est.conc = null; App.redesenhar(); return; }
      if (b.dataset.a === 'cz-ok') {
        let baixas = 0, novos = 0; const conta = est.conc.conta;
        est.conc.itens.forEach(function (x) {
          if (!x.usar || x.dup) return;
          if (x.lancamento) { Object.assign(x.lancamento, { pago: true, conta: conta, dataPagamento: x.linha.data, idBanco: x.linha.idBanco || '', conciliado: true }); baixas++; }
          else { base().lancamentos.push({ id: Dados.id('lc'), perfil: perfil().id, tipo: x.linha.tipo, descricao: x.linha.descricao, valor: x.linha.valor, data: x.linha.data, conta: conta, categoria: F.sugerirCategoria(x.linha.descricao, lancs()) || '', pago: true, idBanco: x.linha.idBanco || '', conciliado: true }); novos++; }
        });
        est.conc = null; salvar(); aviso(baixas + ' baixa(s) e ' + novos + ' lançamento(s) novo(s).'); App.redesenhar();
      }
    };
  }

  // ---------- categorias e perfis ----------
  function telaCategorias(el) {
    el.innerHTML = '<div class="barra-acoes"><p class="mudo">O grupo define onde a categoria entra na DRE (impostos, custos, despesas operacionais, financeiras).</p><button class="btn primario" data-a="nova">+ Categoria</button></div><div class="cartoes largos">' + ['receita', 'despesa'].map(function (tp) { return '<section class="cartao"><h3>' + (tp === 'receita' ? 'Receitas' : 'Despesas') + '</h3><ul class="f-lista">' + cats(tp).map(function (c) { return '<li data-cat="' + c.id + '"><i style="background:' + c.cor + '"></i>' + esc(c.nome) + ' <small class="mudo">' + esc(GRUPOS[c.grupo] || '') + '</small><b><button class="btn mini fantasma" data-ed>Editar</button></b></li>'; }).join('') + '</ul></section>'; }).join('') + '</div>';
    el.onclick = async function (ev) {
      const li = ev.target.closest('[data-cat]'); const nova = ev.target.closest('[data-a=nova]'); if (!li && !nova) return;
      const c = li && cat(li.dataset.cat); const x = c || { tipo: 'despesa', cor: '#b68d40', grupo: 'variavel' };
      const f = await modal({ titulo: c ? 'Editar categoria' : 'Nova categoria', corpo: '<div class="linha">' + campo('Nome', '<input name="nome" required value="' + esc(x.nome || '') + '">') + campo('Tipo', '<select name="tipo">' + opcoes([{ v: 'receita', t: 'Receita' }, { v: 'despesa', t: 'Despesa' }], x.tipo) + '</select>') + campo('Grupo', '<select name="grupo">' + opcoes(Object.keys(GRUPOS).map(function (k) { return { v: k, t: GRUPOS[k] }; }), x.grupo) + '</select>') + campo('Cor', '<input type="color" name="cor" value="' + esc(x.cor) + '">') + '</div>' + (c ? '<label class="check"><input type="checkbox" name="excluir"> Excluir categoria (lançamentos ficam sem categoria)</label>' : '') });
      if (!f) return;
      if (f.get('excluir')) { base().categorias = base().categorias.filter(function (y) { return y !== c; }); base().lancamentos.forEach(function (l) { if (l.categoria === c.id) l.categoria = ''; }); }
      else { const d = { nome: f.get('nome'), tipo: f.get('tipo'), grupo: f.get('grupo'), cor: f.get('cor') }; if (c) Object.assign(c, d); else base().categorias.push(Object.assign({ id: Dados.id('ct'), perfil: perfil().id }, d)); }
      salvar(); App.redesenhar();
    };
  }

  async function gerenciarPerfis() {
    const f = base();
    const r = await modal({ titulo: 'Perfis financeiros', largo: true, botao: 'Criar perfil',
      corpo: '<p class="mini mudo">Um perfil por pessoa, empresa ou cliente assessorado. Cada perfil tem suas contas, cartões, categorias, orçamentos e metas. O PIN protege o perfil neste navegador.</p><ul class="f-lista">' + f.perfis.map(function (p) { return '<li><i style="background:' + (p.tipo === 'empresa' ? '#0a1929' : p.tipo === 'cliente' ? '#b68d40' : '#2e9e5b') + '"></i>' + esc(p.nome) + ' <small class="mudo">' + esc({ pessoal: 'Pessoal', empresa: 'Empresa', cliente: 'Cliente (assessoria)', familia: 'Família' }[p.tipo] || '') + (p.pin ? ' · 🔒 PIN' : '') + '</small><b><button type="button" class="btn mini fantasma" data-pin="' + p.id + '">' + (p.pin ? 'Trocar/remover PIN' : 'Definir PIN') + '</button>' + (f.perfis.length > 1 ? '<button type="button" class="btn mini fantasma perigo" data-del-perfil="' + p.id + '">Excluir</button>' : '') + '</b></li>'; }).join('') + '</ul><h4>Novo perfil</h4><div class="linha">' + campo('Nome', '<input name="nome" placeholder="ex.: Papelaria Exemplo (cliente)">') + campo('Tipo', '<select name="tipo">' + opcoes([{ v: 'cliente', t: 'Cliente (assessoria/consultoria)' }, { v: 'empresa', t: 'Empresa' }, { v: 'pessoal', t: 'Pessoal' }, { v: 'familia', t: 'Família / casa' }]) + '</select>') + '</div>',
      aoAbrir: function (form) { form.addEventListener('click', async function (ev) {
        const pn = ev.target.closest('[data-pin]'); if (pn) { const p = f.perfis.find(function (x) { return x.id === pn.dataset.pin; }); form.closest('.modal-fundo').remove(); const r2 = await modal({ titulo: 'PIN de ' + p.nome, corpo: campo('Novo PIN (4 a 8 dígitos; vazio remove)', '<input name="pin" inputmode="numeric" type="password" maxlength="8">') }); if (r2) { const v = r2.get('pin').trim(); p.pin = v ? await sha(p.id + ':' + v) : ''; salvar(); aviso(v ? 'PIN definido.' : 'PIN removido.'); } return; }
        const dp = ev.target.closest('[data-del-perfil]'); if (dp) { form.closest('.modal-fundo').remove(); const p = f.perfis.find(function (x) { return x.id === dp.dataset.delPerfil; }); if (await confirmar('Excluir perfil', 'Excluir o perfil "' + esc(p.nome) + '" e TODOS os seus lançamentos, contas e cartões?', 'Excluir')) { ['contas', 'cartoes', 'categorias', 'lancamentos', 'orcamentos', 'metas'].forEach(function (k) { f[k] = f[k].filter(function (x) { return x.perfil !== p.id; }); }); f.perfis = f.perfis.filter(function (x) { return x !== p; }); f.perfilAtivo = f.perfis[0].id; salvar(); App.redesenhar(); } }
      }); },
      validar: function (fd) { return fd.get('nome').trim() ? '' : 'Dê um nome ao perfil.'; } });
    if (!r) return;
    const p = { id: Dados.id('pf'), nome: r.get('nome').trim(), tipo: r.get('tipo') }; f.perfis.push(p); criarPadrao(f, p.id); f.perfilAtivo = p.id; salvar(); App.redesenhar();
  }

  async function exigirPin(p) {
    if (!p.pin || est.desbloqueado[p.id]) return true;
    const r = await modal({ titulo: '🔒 ' + p.nome, corpo: campo('PIN', '<input name="pin" type="password" inputmode="numeric" required autocomplete="off">'), botao: 'Desbloquear' });
    if (r && await sha(p.id + ':' + r.get('pin')) === p.pin) { est.desbloqueado[p.id] = true; return true; }
    if (r) aviso('PIN incorreto.', 'erro'); return false;
  }

  Telas.financas = {
    titulo: 'Minhas Finanças',
    // Usado por outros módulos (ex.: Notas Fiscais) para lançar contas a receber/pagar no perfil ativo.
    lancar: function (itens) {
      const f = base(), p = perfil(); const conta = f.contas.find(function (c) { return c.perfil === p.id; });
      itens.forEach(function (x) { const cat = f.categorias.find(function (c) { return c.perfil === p.id && c.tipo === x.tipo && Cotacoes.normalizar(c.nome).indexOf(Cotacoes.normalizar(x.categoria || '')) === 0; }); f.lancamentos.push({ id: Dados.id('lc'), perfil: p.id, tipo: x.tipo, descricao: x.descricao, valor: x.valor, data: x.data, conta: conta ? conta.id : '', categoria: cat ? cat.id : '', pago: false, origem: x.origem || '' }); });
      salvar(); return p.nome;
    },
    render: async function (el, sub) {
      const f = base(); const p = perfil(); sub = sub || 'geral';
      const cab = '<div class="f-cab"><label class="f-perfil">Perfil <select id="f-perfil">' + opcoes(f.perfis.map(function (x) { return { v: x.id, t: (x.pin ? '🔒 ' : '') + x.nome }; }), p.id) + '</select></label><button class="btn mini fantasma" data-a="perfis">Gerenciar perfis</button></div>' +
        abas([{ id: 'geral', t: 'Visão geral' }, { id: 'lancamentos', t: 'Lançamentos' }, { id: 'pendencias', t: 'A pagar / receber', n: lancs().filter(function (l) { return !l.pago && !l.cartao && (l.tipo === 'despesa' || l.tipo === 'receita') && l.data < hojeISO(); }).length }, { id: 'fluxo', t: 'Fluxo de caixa' }, { id: 'contatos', t: 'Clientes e fornecedores' }, { id: 'contas', t: 'Contas e cartões' }, { id: 'conciliacao', t: 'Conciliação' }, { id: 'planejamento', t: 'Orçamentos e metas' }, { id: 'relatorios', t: 'Relatórios' }, { id: 'importar', t: 'Importar extrato' }, { id: 'categorias', t: 'Categorias' }], sub, 'financas');
      el.innerHTML = cab + '<div id="aba"></div>';
      el.querySelector('#f-perfil').onchange = async function () { const novo = f.perfis.find(function (x) { return x.id === this.value; }.bind(this)); if (await exigirPin(novo)) { f.perfilAtivo = novo.id; salvar(); } App.redesenhar(); };
      el.querySelector('[data-a=perfis]').onclick = gerenciarPerfis;
      const aba = el.querySelector('#aba');
      if (p.pin && !est.desbloqueado[p.id]) { aba.innerHTML = UI.vazio('Perfil protegido', 'Digite o PIN para ver as finanças de ' + esc(p.nome) + '.', '<button class="btn primario" id="f-desb">Desbloquear</button>'); aba.querySelector('#f-desb').onclick = async function () { if (await exigirPin(p)) App.redesenhar(); }; return; }
      ({ geral: telaGeral, fluxo: telaFluxo, contatos: telaContatos, conciliacao: telaConciliacao, lancamentos: telaLancamentos, pendencias: telaPendencias, contas: telaContas, planejamento: telaPlanejamento, relatorios: telaRelatorios, importar: telaImportar, categorias: telaCategorias }[sub] || telaGeral)(aba);
    }
  };
})();
