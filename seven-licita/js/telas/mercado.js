/* Análise de Mercado (PNCP), Concorrentes e CAPAG. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, num, pct, data, campo, opcoes, modal, aviso, abas, progresso, barras } = UI;
  let atual = null; let preTermo = '';

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
    const q = atual ? atual.q : { termo: preTermo, excluir: '', ufs: Dados.empresaAtiva() ? [Dados.empresaAtiva().uf] : ['GO'], modalidades: [6, 8], inicio: hojeMenos(90), fim: hojeMenos(0), esferas: [], maxDetalhe: 40 };
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
      if (b.dataset.a === 'imprimir') { const w = window.open('', '_blank'); if (!w) return; w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Análise de mercado</title><link rel="stylesheet" href="' + location.href.replace(/#.*$/, '').replace(/[^/]*$/, '') + 'css/app.css"></head><body class="impressao"><div class="cabecalho-seven"><img src="' + location.href.replace(/#.*$/, '').replace(/[^/]*$/, '') + 'img/seven-marca.png" alt=""><div><b>SEVEN</b><small>BPO DE LICITAÇÕES</small></div></div><h1>Análise de mercado: ' + esc(atual.q.termo) + '</h1>' + relatorio(atual) + '<p class="mini">Seven · BPO de Licitações · (61) 98347-2232</p><script>setTimeout(function(){print()},600)<\/script></body></html>'); w.document.close(); }
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

  const LINK_CAPAG = 'https://www.tesourotransparente.gov.br/temas/estados-e-municipios/capacidade-de-pagamento-capag';
  const XLSX_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  let filtroCapag = { texto: '', uf: '', nota: '' };

  function carregarXLSX() {
    if (self.XLSX) return Promise.resolve(self.XLSX);
    return new Promise(function (ok, erro) { const s = document.createElement('script'); s.src = XLSX_CDN; s.onload = function () { ok(self.XLSX); }; s.onerror = function () { erro(new Error('Não consegui carregar o leitor de Excel. Salve a planilha como CSV e importe de novo.')); }; document.head.appendChild(s); });
  }

  async function importarCapag() {
    const f = await UI.escolherArquivo('.csv,.xlsx,.xls,text/csv'); if (!f) return;
    let linhas;
    try {
      if (/\.xlsx?$/i.test(f.name)) {
        const X = await carregarXLSX();
        const wb = X.read(await f.arrayBuffer(), { type: 'array' });
        linhas = [];
        wb.SheetNames.forEach(function (n) { const l = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' }); if (Nucleo.lerPlanilhaCapag(l).length > Nucleo.lerPlanilhaCapag(linhas).length) linhas = l; });
      } else linhas = Nucleo.lerCSV(await UI.lerArquivoTexto(f));
    } catch (err) { aviso(err.message, 'erro'); return; }
    const regs = Nucleo.lerPlanilhaCapag(linhas);
    if (!regs.length) { aviso('Não achei as colunas de município e CAPAG na planilha. Confira se é a planilha de CAPAG dos municípios do Tesouro.', 'erro'); return; }
    const semNome = await completarNomes(regs);
    e().config.capag = indexarCapag(regs.map(function (r) { return { municipio: r.municipio, uf: r.uf, ibge: r.ibge, nota: r.nota, ano: r.ano, fonte: f.name }; }));
    e().config.capagImportadaEm = new Date().toISOString(); e().config.capagArquivo = f.name;
    Dados.salvar(); aviso(regs.length + ' municípios importados da planilha da CAPAG.' + (semNome ? ' ' + semNome + ' sem nome identificado (código IBGE não encontrado).' : ''), semNome ? 'erro' : ''); App.redesenhar();
  }

  // Tabela oficial do IBGE (código → nome e UF), carregada só quando a CAPAG precisa.
  let ibgeP = null;
  function carregarIBGE() {
    if (self.MunicipiosIBGE) return Promise.resolve(self.MunicipiosIBGE);
    return ibgeP = ibgeP || new Promise(function (ok, erro) { const s = document.createElement('script'); s.src = 'js/municipios-ibge.js'; s.onload = function () { ok(self.MunicipiosIBGE); }; s.onerror = function () { ibgeP = null; erro(new Error('Tabela de municípios do IBGE indisponível.')); }; document.head.appendChild(s); });
  }
  function semNomeValido(r) { return !r.municipio || /^\s*\d[\d.\s]*$/.test(r.municipio); }
  // Preenche o nome (e a UF) de quem veio só com o código IBGE. Devolve quantos continuaram sem nome.
  async function completarNomes(regs) {
    if (!regs.some(semNomeValido)) return 0;
    let T = null; try { T = await carregarIBGE(); } catch (x) { /* segue sem a tabela */ }
    let falta = 0;
    regs.forEach(function (r) {
      if (!semNomeValido(r)) return;
      const achado = Nucleo.municipioPorIbge(T, r.ibge || r.municipio);
      if (achado) { r.municipio = achado.nome; r.uf = r.uf || achado.uf; r.ibge = achado.ibge; } else falta++;
    });
    return falta;
  }
  // A mesma nota fica acessível pelo código IBGE e pelo nome+UF (para casar com os avisos do PNCP).
  function indexarCapag(lista) {
    const capag = {};
    lista.forEach(function (v) { if (v.ibge) capag[v.ibge] = v; if (v.municipio && !semNomeValido(v)) capag[Nucleo.chaveCapag(v.municipio, v.uf)] = v; else if (!v.ibge) capag[Nucleo.chaveCapag(v.municipio, v.uf)] = v; });
    return capag;
  }
  // Notas importadas antes desta correção podem ter só o número no lugar do nome: corrige uma vez, ao abrir a CAPAG.
  let corrigindo = false;
  async function corrigirNomesSalvos() {
    if (corrigindo) return; const todos = registrosCapag(); if (!todos.some(semNomeValido)) return;
    corrigindo = true;
    const lista = todos.map(function (r) { const v = Object.assign({}, r); delete v.chave; if (/^\d{6,7}$/.test(String(v.municipio || '').trim()) && !v.ibge) v.ibge = String(v.municipio).trim(); return v; });
    await completarNomes(lista);
    e().config.capag = indexarCapag(lista); Dados.salvar(); corrigindo = false;
    if (App.rota().tela === 'mercado' && App.rota().sub === 'capag') App.redesenhar();
  }

  // Lista única (a importação guarda a mesma nota por IBGE e por nome, para casar com os avisos).
  function registrosCapag() {
    const c = e().config.capag || {}; const vistos = new Set(); const out = [];
    Object.keys(c).forEach(function (k) { const v = c[k]; if (vistos.has(v)) return; vistos.add(v); out.push(Object.assign({ chave: k, municipio: v.municipio || k.replace(/-[A-Z]{2}$/, ''), uf: v.uf || (k.match(/-([A-Z]{2})$/) || [])[1] || '' }, v)); });
    return out.sort(function (a, b) { return (a.uf + a.municipio).localeCompare(b.uf + b.municipio, 'pt-BR'); });
  }

  // Histórico próprio da Seven: quanto cada órgão demora para pagar, com as notas e pagamentos da Execução dos cartões.
  function historicoPagamentos() {
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
    return Object.keys(orgaos).map(function (k) { const r = orgaos[k]; r.media = Nucleo.estatisticas(r.atrasoDias).media; return r; }).sort(function (a, b) { return (b.media || 0) - (a.media || 0); });
  }

  function telaCapag(el) {
    const todos = registrosCapag(); const f = filtroCapag;
    if (todos.some(semNomeValido)) corrigirNomesSalvos();
    const lista = todos.filter(function (r) { return (!f.uf || r.uf === f.uf) && (!f.nota || r.nota.replace('+', '') === f.nota) && (!f.texto || Nucleo.normalizar(r.municipio).indexOf(Nucleo.normalizar(f.texto)) >= 0); });
    const cont = {}; todos.forEach(function (r) { const k = r.nota.replace('+', ''); cont[k] = (cont[k] || 0) + 1; });
    const ufs = todos.map(function (r) { return r.uf; }).filter(function (x, i, l) { return x && l.indexOf(x) === i; }).sort();
    const hist = historicoPagamentos();
    el.innerHTML = '<section class="cartao"><header><h3>CAPAG: capacidade de pagamento dos municípios</h3><div class="grupo-botoes"><a class="btn fantasma" href="' + LINK_CAPAG + '" target="_blank" rel="noopener">Tesouro Transparente ↗</a><button class="btn primario" data-a="importar">Importar planilha da CAPAG</button><button class="btn" data-a="capag">+ Nota manual</button></div></header>' +
      '<p class="mini">Nota do Tesouro Nacional sobre a situação fiscal do município. <b>A e B</b>: melhores; <b>C</b>: intermediária; <b>D</b>: maior risco; <b>n.d.</b>: sem nota. Não garante prazo de pagamento; é apoio à decisão. A nota aparece no cartão de cada aviso do município.</p>' +
      '<p class="mini mudo">Como atualizar: abra a página da CAPAG no Tesouro Transparente, baixe a planilha dos municípios (Excel ou CSV) e clique em <b>Importar planilha da CAPAG</b>. A importação substitui as notas anteriores.' + (e().config.capagImportadaEm ? ' Última importação: ' + data(e().config.capagImportadaEm) + ' (' + esc(e().config.capagArquivo || '') + ').' : '') + '</p>' +
      (todos.length ? '<div class="pilulas">' + ['A', 'B', 'C', 'D', 'n.d.'].map(function (n) { return '<button class="pilula ' + (f.nota === n ? 'ativa' : '') + '" data-nota="' + n + '">CAPAG ' + n + ' <b>' + (cont[n] || 0) + '</b></button>'; }).join('') + '</div>' +
        '<form class="filtros" id="fcapag"><input type="search" name="texto" placeholder="Buscar município…" value="' + esc(f.texto) + '"><select name="uf"><option value="">Todas as UFs</option>' + opcoes(ufs, f.uf) + '</select></form>' +
        '<div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Município</th><th>UF</th><th>IBGE</th><th>CAPAG</th><th>Leitura</th><th>Referência</th><th></th></tr></thead><tbody>' +
        lista.slice(0, 300).map(function (r) { const l = Nucleo.leituraCapag(r.nota); return '<tr><td>' + esc(r.municipio) + '</td><td>' + esc(r.uf) + '</td><td>' + esc(r.ibge || '') + '</td><td><span class="tag capag-' + l.replace(/\W/g, '') + '">' + esc(r.nota) + '</span></td><td>' + esc(l) + '</td><td class="mini">' + esc(r.ano || '') + '</td><td><button class="icone" data-del="' + esc(r.chave) + '" aria-label="Remover">×</button></td></tr>'; }).join('') +
        '</tbody></table></div>' + (lista.length > 300 ? '<p class="mini mudo">Mostrando 300 de ' + lista.length + '. Use a busca ou a UF.</p>' : '')
        : UI.vazio('Nenhuma nota CAPAG ainda', 'Baixe a planilha no Tesouro Transparente e importe aqui, ou registre a nota de um município à mão.')) + '</section>' +
      '<section class="cartao"><h3>Histórico de pagamento dos órgãos (dados da Seven)</h3><p class="mini mudo">Atraso real de cada órgão, calculado com as notas fiscais e pagamentos registrados na <b>Execução</b> dos cartões do Quadro. Dias positivos = pagou depois do vencimento.</p>' +
      (hist.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Órgão</th><th class="n">NFs</th><th class="n">Pagas</th><th class="n">Atraso médio (dias)</th><th class="n">Em aberto</th><th class="n">Vencido</th><th>Leitura</th></tr></thead><tbody>' +
        hist.map(function (r) { const lei = r.vencido > 0 ? 'cobrar' : r.media == null ? 'sem histórico' : r.media <= 0 ? 'paga em dia' : r.media <= 15 ? 'atraso leve' : 'atraso alto'; return '<tr><td>' + esc(r.orgao) + '</td><td class="n">' + r.notas + '</td><td class="n">' + r.pagas + '</td><td class="n">' + (r.media == null ? '—' : num(r.media, 0)) + '</td><td class="n">' + moeda(r.aberto) + '</td><td class="n ' + (r.vencido ? 'alerta' : '') + '">' + moeda(r.vencido) + '</td><td><span class="tag ' + (lei === 'paga em dia' ? 'verde' : lei === 'sem histórico' ? 'claro' : 'vermelho') + '">' + lei + '</span></td></tr>'; }).join('') + '</tbody></table></div>'
        : '<p class="mudo">Registre notas fiscais e pagamentos em <b>Execução</b> nos cartões do <a href="#/quadros">Quadro</a> para ver o histórico.</p>') + '</section>';
    const fc = el.querySelector('#fcapag');
    if (fc) { fc.onsubmit = function (ev) { ev.preventDefault(); }; fc.oninput = function () { const fd = new FormData(fc); filtroCapag.texto = fd.get('texto'); filtroCapag.uf = fd.get('uf'); clearTimeout(fc._t); fc._t = setTimeout(function () { App.redesenhar(); const i = document.querySelector('#fcapag [name=texto]'); if (i && filtroCapag.texto) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); }; }
    el.onclick = async function (ev) {
      const pn = ev.target.closest('[data-nota]'); if (pn) { filtroCapag.nota = filtroCapag.nota === pn.dataset.nota ? '' : pn.dataset.nota; App.redesenhar(); return; }
      const d = ev.target.closest('[data-del]');
      if (d) { const c = e().config.capag; const v = c[d.dataset.del]; Object.keys(c).forEach(function (k) { if (c[k] === v || (v && c[k].municipio === v.municipio && c[k].uf === v.uf)) delete c[k]; }); Dados.salvar(); App.redesenhar(); return; }
      if (ev.target.closest('[data-a=importar]')) { await importarCapag(); return; }
      if (!ev.target.closest('[data-a=capag]')) return;
      const fm = await modal({ titulo: 'Nota CAPAG', corpo: '<div class="linha">' + campo('Município', '<input name="m" required placeholder="ex.: Catalão">') + campo('UF', '<select name="uf">' + opcoes(PNCP.UFS, 'GO') + '</select>') + campo('Nota', '<select name="n">' + opcoes(['A', 'B', 'C', 'D', 'n.d.']) + '</select>') + campo('Ano de referência', '<input name="a" inputmode="numeric">') + '</div>' });
      if (!fm) return;
      e().config.capag = e().config.capag || {};
      e().config.capag[Nucleo.chaveCapag(fm.get('m').trim(), fm.get('uf'))] = { municipio: fm.get('m').trim(), uf: fm.get('uf'), nota: fm.get('n'), ano: fm.get('a'), fonte: 'manual' };
      Dados.salvar(); App.redesenhar();
    };
  }

  Telas.mercado = {
    titulo: 'Análise de Mercado',
    coletar: rodar, // usado pelo estudo de mercado da área Comercial
    pesquisar: function (termo) { preTermo = termo || ''; atual = null; location.hash = '#/mercado/analise'; App.redesenhar(); aviso('Termo do item preenchido. Confira estados e período e clique em Gerar relatório.'); },
    render: function (el, sub) {
      sub = sub || 'analise';
      el.innerHTML = abas([{ id: 'analise', t: 'Análise de Mercado' }, { id: 'concorrentes', t: 'Concorrentes' }, { id: 'capag', t: 'CAPAG' }], sub, 'mercado') + '<div id="aba"></div>';
      ({ analise: telaAnalise, concorrentes: telaConcorrentes, capag: telaCapag }[sub] || telaAnalise)(el.querySelector('#aba'));
      el.onclick = null;
    }
  };
})();
