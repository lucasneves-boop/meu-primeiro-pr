/* Análise de Mercado (PNCP), Concorrentes e Pagômetro. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, num, pct, data, campo, opcoes, modal, aviso, abas, progresso, barras } = UI;
  let atual = null;

  function e() { return Dados.e; }
  function hojeMenos(dias) { const d = new Date(Date.now() - dias * 86400000); return d.toISOString().slice(0, 10); }

  async function rodar(q, alvo) {
    progresso(alvo, 'Baixando contratações publicadas no PNCP…', 0);
    const r = await PNCP.publicadas({ ufs: q.ufs, modalidades: q.modalidades, inicio: q.inicio, fim: q.fim, maxPaginas: 40 }, function (f, t) { progresso(alvo, 'Consultas ao PNCP: ' + f + '/' + t, f / t * 0.5); });
    const filtro = { oQueVendo: q.termo, oQueNaoVendo: q.excluir };
    let compras = r.lista.filter(function (c) { return Nucleo.casaProduto(c.objeto + ' ' + (c.info || ''), filtro); });
    if (q.esferas && q.esferas.length) compras = compras.filter(function (c) { return q.esferas.indexOf(c.esfera) >= 0; });
    // Detalhe por item: só as que já têm resultado homologado.
    const comResultado = compras.filter(function (c) { return c.valorHomologado; }).slice(0, q.maxDetalhe || 40);
    const amostras = []; let feitos = 0;
    await PNCP.emLotes(comResultado, 3, async function (c) {
      const itens = await PNCP.itens(c.cnpj, c.ano, c.seq);
      const alvoItens = itens.filter(function (i) { return i.temResultado && Nucleo.casaProduto(i.descricao, filtro); });
      const usar = alvoItens.length ? alvoItens : [];
      for (const i of usar.slice(0, 15)) {
        const res = await PNCP.resultados(c.cnpj, c.ano, c.seq, i.numero);
        res.forEach(function (x) { amostras.push({ compra: c.id, orgao: c.orgao, uf: c.uf, municipio: c.municipio, data: x.data || c.publicacao, descricao: i.descricao, unidade: i.unidade, quantidade: x.quantidade, unitario: x.unitario, referencia: i.refUnitaria, total: x.total, fornecedor: x.fornecedor, cnpjFornecedor: x.cnpj, porte: x.porte, edital: c.edital }); });
      }
      feitos++; progresso(alvo, 'Lendo itens e vencedores: ' + feitos + '/' + comResultado.length, 0.5 + feitos / Math.max(1, comResultado.length) * 0.5);
    });
    alvo.innerHTML = '';
    return { q: q, geradoEm: new Date().toISOString(), compras: compras, amostras: amostras, truncado: r.truncado, totalConsultado: r.lista.length, erros: r.erros };
  }

  function grupoItem(desc) { return Nucleo.normalizar(desc).split(' ').slice(0, 6).join(' '); }

  function relatorio(a) {
    const c = a.compras; const am = a.amostras;
    const homolog = c.filter(function (x) { return x.valorHomologado; });
    const totHom = homolog.reduce(function (s, x) { return s + x.valorHomologado; }, 0);
    const totEst = c.reduce(function (s, x) { return s + (x.valorEstimado || 0); }, 0);
    const orgaos = Nucleo.ranking(c, function (x) { return x.orgao; }, function (x) { return x.valorHomologado || x.valorEstimado; });
    const ufs = Nucleo.ranking(c, function (x) { return x.uf; }, function (x) { return x.valorHomologado || x.valorEstimado; });
    const forn = Nucleo.ranking(am, function (x) { return x.fornecedor + '|' + x.cnpjFornecedor; }, function (x) { return x.total; });
    const meses = {}; c.forEach(function (x) { const k = String(x.publicacao || '').slice(0, 7); if (k) meses[k] = (meses[k] || 0) + (x.valorHomologado || x.valorEstimado || 0); });
    const grupos = {}; am.forEach(function (x) { const k = grupoItem(x.descricao) + '|' + Nucleo.normalizar(x.unidade); (grupos[k] = grupos[k] || { desc: x.descricao, un: x.unidade, v: [], ref: [] }).v.push(x.unitario); if (x.referencia) grupos[k].ref.push(x.referencia); });
    const precos = Object.keys(grupos).map(function (k) { const g = grupos[k]; return Object.assign({ desc: g.desc, un: g.un, refMedia: Nucleo.estatisticas(g.ref).media }, Nucleo.estatisticas(g.v)); }).sort(function (x, y) { return y.n - x.n; });
    const descontoMedio = Nucleo.estatisticas(am.filter(function (x) { return x.referencia && x.unitario; }).map(function (x) { return 1 - x.unitario / x.referencia; })).media;
    return '<div class="kpis"><div><b>' + c.length + '</b><span>licitações encontradas</span></div><div><b>' + moeda(totHom) + '</b><span>homologado (' + homolog.length + ')</span></div><div><b>' + moeda(totEst) + '</b><span>estimado</span></div><div><b>' + am.length + '</b><span>amostras de preço por item</span></div><div><b>' + pct(descontoMedio) + '</b><span>desconto médio sobre a referência</span></div></div>' +
      (a.truncado ? '<p class="alerta mini">Algumas consultas passaram do limite de páginas: reduza o período ou os estados para cobrir tudo.</p>' : '') +
      '<p class="mini mudo">Fonte: PNCP, contratações publicadas de ' + data(a.q.inicio) + ' a ' + data(a.q.fim) + ' (' + a.totalConsultado + ' consultadas). Preços por item vêm dos resultados homologados de até ' + (a.q.maxDetalhe || 40) + ' licitações. Poucas amostras não sustentam decisão.</p>' +
      '<div class="cartoes"><section class="cartao"><h3>Sazonalidade (valor por mês)</h3>' + barras(Object.keys(meses).sort().map(function (k) { return { t: k.slice(5) + '/' + k.slice(2, 4), v: meses[k] }; }), { fmt: moeda, rotulo: 'valor por mês' }) + '</section>' +
      '<section class="cartao"><h3>Estados</h3>' + tabelaRank(ufs.slice(0, 10), 'UF') + '</section></div>' +
      '<div class="cartoes"><section class="cartao"><h3>Órgãos que mais compram</h3>' + tabelaRank(orgaos.slice(0, 10), 'Órgão') + '</section>' +
      '<section class="cartao"><h3>Fornecedores vencedores</h3><p class="mini">Concentração: Top 3 = <b>' + pct(Nucleo.concentracao(forn, 3)) + '</b> · Top 5 = <b>' + pct(Nucleo.concentracao(forn, 5)) + '</b></p>' + tabelaRank(forn.slice(0, 10).map(function (r) { const p = r.chave.split('|'); return Object.assign({}, r, { chave: p[0] + ' · ' + UI.cnpj(p[1]) }); }), 'Fornecedor') + '</section></div>' +
      '<section class="cartao"><h3>Preço por item (homologado)</h3>' + (precos.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Item</th><th>Un.</th><th class="n">Amostras</th><th class="n">Mínimo</th><th class="n">Médio</th><th class="n">Mediana</th><th class="n">Máximo</th><th class="n">Ref. média</th></tr></thead><tbody>' + precos.slice(0, 60).map(function (p) { return '<tr><td>' + esc(p.desc.slice(0, 140)) + '</td><td>' + esc(p.un || '') + '</td><td class="n ' + (p.n < 3 ? 'alerta' : '') + '">' + p.n + '</td><td class="n">' + moeda(p.min) + '</td><td class="n">' + moeda(p.media) + '</td><td class="n">' + moeda(p.mediana) + '</td><td class="n">' + moeda(p.max) + '</td><td class="n">' + moeda(p.refMedia) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="mudo">Nenhum item com resultado homologado casou com o termo.</p>') + '</section>' +
      '<section class="cartao"><h3>Licitações</h3><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Publicação</th><th>Órgão</th><th>UF</th><th>Objeto</th><th>Situação</th><th class="n">Estimado</th><th class="n">Homologado</th><th></th></tr></thead><tbody>' + c.slice().sort(function (x, y) { return new Date(y.publicacao) - new Date(x.publicacao); }).slice(0, 300).map(function (x) { return '<tr><td>' + data(x.publicacao) + '</td><td>' + esc(x.orgao) + '</td><td>' + esc(x.uf) + '</td><td>' + esc(String(x.objeto).slice(0, 160)) + '</td><td>' + esc(x.situacao || '') + '</td><td class="n">' + moeda(x.valorEstimado) + '</td><td class="n">' + moeda(x.valorHomologado) + '</td><td><a href="' + esc(x.edital) + '" target="_blank" rel="noopener">PNCP ↗</a></td></tr>'; }).join('') + '</tbody></table></div></section>';
  }

  function tabelaRank(l, rot) {
    if (!l.length) return '<p class="mudo">Sem dados.</p>';
    return '<table class="tabela compacta"><thead><tr><th>' + rot + '</th><th class="n">Qtd</th><th class="n">Valor</th><th class="n">%</th></tr></thead><tbody>' + l.map(function (r) { return '<tr><td>' + esc(r.chave) + '</td><td class="n">' + r.qtd + '</td><td class="n">' + moeda(r.total) + '</td><td class="n">' + pct(r.participacao) + '</td></tr>'; }).join('') + '</tbody></table>';
  }

  function telaAnalise(el) {
    const q = atual ? atual.q : { termo: '', excluir: '', ufs: Dados.empresaAtiva() ? [Dados.empresaAtiva().uf] : ['GO'], modalidades: [6, 8], inicio: hojeMenos(90), fim: hojeMenos(0), esferas: [], maxDetalhe: 40 };
    el.innerHTML = '<form class="cartao form-busca" id="fm"><div class="linha">' + campo('O que pesquisar *', '<input name="termo" required value="' + esc(q.termo) + '" placeholder="ex.: papel a4, material de limpeza">', 'Sinônimos separados por vírgula.') + campo('Excluir termos', '<input name="excluir" value="' + esc(q.excluir) + '" placeholder="ex.: locação, serviço">') +
      campo('De', '<input type="date" name="inicio" value="' + esc(q.inicio) + '">') + campo('Até', '<input type="date" name="fim" value="' + esc(q.fim) + '">') + campo('Licitações detalhadas por item', '<select name="maxDetalhe">' + opcoes([20, 40, 80, 150], q.maxDetalhe) + '</select>') + '</div>' +
      '<fieldset><legend>Estados *</legend><div class="grade-checks">' + PNCP.UFS.map(function (u) { return '<label><input type="checkbox" name="uf" value="' + u + '"' + (q.ufs.indexOf(u) >= 0 ? ' checked' : '') + '> ' + u + '</label>'; }).join('') + '</div></fieldset>' +
      '<fieldset><legend>Modalidades</legend><div class="grade-checks">' + [4, 6, 8, 9, 12].map(function (k) { return '<label><input type="checkbox" name="mod" value="' + k + '"' + (q.modalidades.indexOf(k) >= 0 ? ' checked' : '') + '> ' + esc(PNCP.MODALIDADES[k]) + '</label>'; }).join('') + '</div></fieldset>' +
      '<fieldset><legend>Esferas</legend><div class="grade-checks">' + [['M', 'Municipal'], ['E', 'Estadual'], ['D', 'Distrital'], ['F', 'Federal']].map(function (x) { return '<label><input type="checkbox" name="esf" value="' + x[0] + '"' + ((q.esferas || []).indexOf(x[0]) >= 0 ? ' checked' : '') + '> ' + x[1] + '</label>'; }).join('') + '</div></fieldset>' +
      '<div class="barra-acoes"><small class="mudo">O PNCP não filtra por palavra: o app baixa as publicações do período e filtra aqui. Períodos longos com muitos estados demoram.</small><button class="btn primario">Gerar relatório</button></div></form>' +
      '<div id="prog"></div><div id="rel">' + (atual ? '<div class="barra-acoes"><h2>' + esc(atual.q.termo) + '</h2><div class="grupo-botoes"><button class="btn fantasma" data-a="csv">Exportar CSV</button><button class="btn fantasma" data-a="imprimir">Imprimir / PDF</button><button class="btn" data-a="salvar">Salvar análise</button></div></div>' + relatorio(atual) : '') + '</div>' +
      (e().analises.length ? '<section class="cartao"><h3>Análises salvas</h3><ul class="lista-links">' + e().analises.map(function (a, k) { return '<li><a href="#" data-abrir="' + k + '">' + esc(a.q.termo) + '</a> <span class="mudo">· ' + esc(a.q.ufs.join(', ')) + ' · ' + data(a.q.inicio) + '–' + data(a.q.fim) + ' · gerada ' + data(a.geradoEm) + '</span> <button class="icone" data-del="' + k + '" aria-label="Excluir">×</button></li>'; }).join('') + '</ul></section>' : '');
    el.querySelector('#fm').onsubmit = async function (ev) {
      ev.preventDefault(); const fd = new FormData(this);
      const nq = { termo: fd.get('termo'), excluir: fd.get('excluir'), inicio: fd.get('inicio'), fim: fd.get('fim'), ufs: fd.getAll('uf'), modalidades: fd.getAll('mod').map(Number), esferas: fd.getAll('esf'), maxDetalhe: Number(fd.get('maxDetalhe')) };
      if (!nq.ufs.length) { aviso('Escolha ao menos um estado.', 'erro'); return; }
      if (new Date(nq.fim) - new Date(nq.inicio) > 366 * 86400000) { aviso('Período máximo: 12 meses.', 'erro'); return; }
      this.querySelector('button.primario').disabled = true;
      try { atual = await rodar(nq, el.querySelector('#prog')); if (atual.erros) aviso(atual.erros + ' consulta(s) falharam no PNCP; o relatório pode estar incompleto.', 'erro'); }
      catch (err) { aviso('Falha ao consultar o PNCP: ' + err.message, 'erro'); }
      App.redesenhar();
    };
    el.onclick = function (ev) {
      const ab = ev.target.closest('[data-abrir]'); if (ab) { ev.preventDefault(); atual = e().analises[ab.dataset.abrir]; App.redesenhar(); return; }
      const del = ev.target.closest('[data-del]'); if (del) { e().analises.splice(Number(del.dataset.del), 1); Dados.salvar(); App.redesenhar(); return; }
      const b = ev.target.closest('[data-a]'); if (!b || !atual) return;
      if (b.dataset.a === 'salvar') { e().analises.unshift(atual); e().analises = e().analises.slice(0, 15); Dados.salvar(); aviso('Análise salva.'); App.redesenhar(); }
      if (b.dataset.a === 'csv') UI.baixar('analise-' + Nucleo.normalizar(atual.q.termo).replace(/ /g, '-') + '.csv', '﻿' + Nucleo.paraCSV([['Data', 'Órgão', 'UF', 'Município', 'Item', 'Unidade', 'Quantidade', 'Valor unitário', 'Referência', 'Total', 'Fornecedor', 'CNPJ', 'Link']].concat(atual.amostras.map(function (x) { return [x.data, x.orgao, x.uf, x.municipio, x.descricao, x.unidade, x.quantidade, x.unitario, x.referencia, x.total, x.fornecedor, x.cnpjFornecedor, x.edital]; }))), 'text/csv;charset=utf-8');
      if (b.dataset.a === 'imprimir') { const w = window.open('', '_blank'); if (!w) return; w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Análise de mercado</title><link rel="stylesheet" href="' + location.href.replace(/#.*$/, '').replace(/[^/]*$/, '') + 'css/app.css"></head><body class="impressao"><h1>Análise de mercado: ' + esc(atual.q.termo) + '</h1>' + relatorio(atual) + '<script>setTimeout(function(){print()},600)<\/script></body></html>'); w.document.close(); }
    };
  }

  function telaConcorrentes(el) {
    const todas = e().analises.concat(atual && e().analises.indexOf(atual) < 0 ? [atual] : []);
    const am = []; todas.forEach(function (a) { a.amostras.forEach(function (x) { am.push(Object.assign({ termo: a.q.termo }, x)); }); });
    const mapa = {};
    am.forEach(function (x) { const k = x.cnpjFornecedor || x.fornecedor; const r = mapa[k] = mapa[k] || { nome: x.fornecedor, cnpj: x.cnpjFornecedor, porte: x.porte, itens: 0, total: 0, orgaos: {}, ufs: {}, termos: {}, ultimo: '' }; r.itens++; r.total += x.total || 0; r.orgaos[x.orgao] = 1; r.ufs[x.uf] = 1; r.termos[x.termo] = 1; if (x.data > r.ultimo) r.ultimo = x.data; });
    const lista = Object.keys(mapa).map(function (k) { return mapa[k]; }).sort(function (a, b) { return b.total - a.total; });
    const seguidos = e().config.concorrentes || [];
    el.innerHTML = '<p class="mudo">Histórico dos fornecedores que venceram itens nas suas análises de mercado (salvas e atual). Marque ★ para acompanhar um concorrente.</p>' +
      (lista.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th></th><th>Fornecedor</th><th>Porte</th><th class="n">Itens vencidos</th><th class="n">Valor</th><th class="n">Órgãos</th><th>UFs</th><th>Mercados</th><th>Último</th></tr></thead><tbody>' +
        lista.map(function (r) { const fav = seguidos.indexOf(r.cnpj) >= 0; return '<tr><td><button class="icone estrela ' + (fav ? 'on' : '') + '" data-seguir="' + esc(r.cnpj) + '" aria-label="Acompanhar">★</button></td><td><b>' + esc(r.nome) + '</b><br><span class="mini">' + esc(UI.cnpj(r.cnpj)) + '</span></td><td>' + ({ 1: 'ME', 2: 'EPP', 3: 'Demais' }[r.porte] || '—') + '</td><td class="n">' + r.itens + '</td><td class="n">' + moeda(r.total) + '</td><td class="n">' + Object.keys(r.orgaos).length + '</td><td>' + esc(Object.keys(r.ufs).join(', ')) + '</td><td class="mini">' + esc(Object.keys(r.termos).join(', ')) + '</td><td>' + data(r.ultimo) + '</td></tr>'; }).join('') + '</tbody></table></div>'
        : UI.vazio('Sem dados de concorrentes', 'Gere e salve análises de mercado: os vencedores de cada item aparecem aqui.', '<a class="btn primario" href="#/mercado">Nova análise</a>'));
    el.onclick = function (ev) { const b = ev.target.closest('[data-seguir]'); if (!b) return; const l = e().config.concorrentes = e().config.concorrentes || []; const i = l.indexOf(b.dataset.seguir); if (i >= 0) l.splice(i, 1); else l.push(b.dataset.seguir); Dados.salvar(); App.redesenhar(); };
  }

  // Pagômetro: quanto cada órgão demora para pagar, com base nos pagamentos que a Seven registrou nos cartões,
  // mais a nota CAPAG do município (informada à mão a partir do Tesouro Nacional).
  function telaPagometro(el) {
    const orgaos = {};
    Telas.quadros.todosCartoes().forEach(function (x) {
      const c = x.cartao; const ex = c.execucao; if (!ex) return;
      const org = (c.valores && c.valores.orgao) || (Dados.e.avisos[c.avisoId] || {}).orgao || c.titulo;
      const r = orgaos[org] = orgaos[org] || { orgao: org, notas: 0, pagas: 0, atrasoDias: [], aberto: 0, vencido: 0 };
      (ex.notas || []).forEach(function (n) {
        r.notas++;
        const pgs = (ex.pagamentos || []).filter(function (p) { return p.ref && String(p.ref) === String(n.numero); });
        const pago = pgs.reduce(function (s, p) { return s + (p.valor || 0); }, 0);
        if (pago + 0.01 >= n.valor && pgs.length) {
          r.pagas++;
          const ult = pgs.map(function (p) { return p.data; }).sort().pop();
          if (n.vencimento && ult) r.atrasoDias.push(Nucleo.diasEntre(n.vencimento + 'T12:00:00', ult + 'T12:00:00'));
        } else {
          r.aberto += n.valor - pago;
          if (n.vencimento && new Date(n.vencimento + 'T23:59') < Date.now()) r.vencido += n.valor - pago;
        }
      });
    });
    const lista = Object.keys(orgaos).map(function (k) { const r = orgaos[k]; r.media = Nucleo.estatisticas(r.atrasoDias).media; return r; }).sort(function (a, b) { return (b.media || 0) - (a.media || 0); });
    const capag = e().config.capag || {};
    el.innerHTML = '<p class="mudo">Prazo real de pagamento de cada órgão, calculado com as notas fiscais e pagamentos registrados na <b>Execução</b> dos cartões do Quadro. Dias positivos = pagou depois do vencimento.</p>' +
      (lista.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Órgão</th><th class="n">NFs</th><th class="n">Pagas</th><th class="n">Atraso médio (dias)</th><th class="n">Em aberto</th><th class="n">Vencido</th><th>Leitura</th></tr></thead><tbody>' +
        lista.map(function (r) { const lei = r.vencido > 0 ? 'cobrar' : r.media == null ? 'sem histórico' : r.media <= 0 ? 'paga em dia' : r.media <= 15 ? 'atraso leve' : 'atraso alto'; return '<tr><td>' + esc(r.orgao) + '</td><td class="n">' + r.notas + '</td><td class="n">' + r.pagas + '</td><td class="n">' + (r.media == null ? '—' : num(r.media, 0)) + '</td><td class="n">' + moeda(r.aberto) + '</td><td class="n ' + (r.vencido ? 'alerta' : '') + '">' + moeda(r.vencido) + '</td><td><span class="tag ' + (lei === 'paga em dia' ? 'verde' : lei === 'sem histórico' ? 'claro' : 'vermelho') + '">' + lei + '</span></td></tr>'; }).join('') + '</tbody></table></div>'
        : UI.vazio('Sem histórico de pagamentos', 'Registre notas fiscais e pagamentos em <b>Execução</b> nos cartões do Quadro (etapas Entrega e Pagamento).', '<a class="btn" href="#/quadros">Abrir Quadros</a>')) +
      '<section class="cartao"><header><h3>CAPAG dos municípios</h3><button class="btn mini" data-a="capag">+ Registrar nota</button></header><p class="mini mudo">Nota de capacidade de pagamento do Tesouro Nacional, consultada no site do Tesouro e registrada aqui. A e B: melhores; C: intermediária; D e E: maior risco. Não garante prazo de pagamento. A nota aparece nos avisos do município.</p>' +
      (Object.keys(capag).length ? '<table class="tabela compacta"><tbody>' + Object.keys(capag).sort().map(function (k) { return '<tr><td>' + esc(k) + '</td><td><span class="tag capag-' + Nucleo.leituraCapag(capag[k].nota).replace(/\W/g, '') + '">CAPAG ' + esc(capag[k].nota) + '</span></td><td class="mini">' + esc(capag[k].ano || '') + '</td><td><button class="icone" data-del="' + esc(k) + '" aria-label="Remover">×</button></td></tr>'; }).join('') + '</tbody></table>' : '<p class="mudo">Nenhuma nota registrada.</p>') + '</section>';
    el.onclick = async function (ev) {
      const d = ev.target.closest('[data-del]'); if (d) { delete e().config.capag[d.dataset.del]; Dados.salvar(); App.redesenhar(); return; }
      if (!ev.target.closest('[data-a=capag]')) return;
      const f = await modal({ titulo: 'Nota CAPAG', corpo: '<div class="linha">' + campo('Município', '<input name="m" required placeholder="ex.: Catalão">') + campo('UF', '<select name="uf">' + opcoes(PNCP.UFS, 'GO') + '</select>') + campo('Nota', '<select name="n">' + opcoes(['A', 'B', 'C', 'D', 'E', 'n.d.']) + '</select>') + campo('Ano de referência', '<input name="a" inputmode="numeric">') + '</div>' });
      if (!f) return; e().config.capag = e().config.capag || {}; e().config.capag[f.get('m').trim() + '-' + f.get('uf')] = { nota: f.get('n'), ano: f.get('a') }; Dados.salvar(); App.redesenhar();
    };
  }

  Telas.mercado = {
    titulo: 'Análise de Mercado',
    render: function (el, sub) {
      sub = sub || 'analise';
      el.innerHTML = abas([{ id: 'analise', t: 'Análise de Mercado' }, { id: 'concorrentes', t: 'Concorrentes' }, { id: 'pagometro', t: 'Pagômetro' }], sub, 'mercado') + '<div id="aba"></div>';
      ({ analise: telaAnalise, concorrentes: telaConcorrentes, pagometro: telaPagometro }[sub] || telaAnalise)(el.querySelector('#aba'));
      el.onclick = null;
    }
  };
})();
