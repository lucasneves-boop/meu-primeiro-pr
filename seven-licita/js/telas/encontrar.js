/* Encontrar: perfis de busca, catálogo de produtos, meus avisos e banco de licitações (PNCP). */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, data, dataHora, cnpj, campo, opcoes, modal, confirmar, aviso, emQuanto, abas, progresso } = UI;
  const ESFERAS = [{ v: 'M', t: 'Municipal' }, { v: 'E', t: 'Estadual' }, { v: 'D', t: 'Distrital' }, { v: 'F', t: 'Federal' }];
  const MODS_PADRAO = [6, 8, 4];
  let pool = []; // últimas licitações baixadas (para prévia e banco)
  let bancoResultado = null;
  let filtros = { perfil: '', estado: 'ativos', uf: '', texto: '', valorMin: '', ordem: 'encerramento' };

  function e() { return Dados.e; }

  // ---------- captura ----------
  let capturando = null;
  async function capturar(perfisAlvo, alvoEl, automatica) {
    if (capturando) { aviso('Já existe uma captura em andamento; aguarde.'); return capturando; }
    capturando = capturarAgora(perfisAlvo, alvoEl, automatica);
    try { return await capturando; } finally { capturando = null; }
  }

  async function capturarAgora(perfisAlvo, alvoEl, automatica) {
    const perfis = (perfisAlvo || e().perfis).filter(function (p) { return p.ativo !== false; });
    if (!perfis.length) { aviso('Nenhum perfil de busca ativo.', 'erro'); return; }
    let novos = 0; let truncado = false; let erros = 0;
    for (let i = 0; i < perfis.length; i++) {
      const p = perfis[i];
      const produtos = produtosDoPerfil(p);
      if (!produtos.length) { aviso('Perfil "' + p.nome + '" sem produto ativo no catálogo.', 'erro'); continue; }
      if (alvoEl) progresso(alvoEl, 'Perfil ' + (i + 1) + '/' + perfis.length + ': consultando o PNCP…', i / perfis.length);
      const r = await PNCP.propostasAbertas({ ufs: p.ufs, modalidades: p.modalidades && p.modalidades.length ? p.modalidades.map(Number) : MODS_PADRAO }, function (f, t) {
        if (alvoEl) progresso(alvoEl, 'Perfil "' + p.nome + '": ' + f + '/' + t + ' consultas ao PNCP', (i + f / t) / perfis.length);
      });
      truncado = truncado || r.truncado; erros += r.erros;
      pool = mesclar(pool, r.lista);
      r.lista.forEach(function (c) {
        if (p.esferas && p.esferas.length && p.esferas.indexOf(c.esfera) < 0) return;
        const texto = c.objeto + ' ' + (c.info || '');
        const casam = Nucleo.produtosQueCasam(texto, produtos);
        if (!casam.length) return;
        const ja = e().avisos[c.id];
        if (ja) {
          Object.assign(ja, c);
          if (ja.perfis.indexOf(p.id) < 0) ja.perfis.push(p.id);
          ja.produtos = unico((ja.produtos || []).concat(casam.map(function (x) { return x.oQueVendo; })));
        } else {
          e().avisos[c.id] = Object.assign({}, c, { perfis: [p.id], produtos: casam.map(function (x) { return x.oQueVendo; }), lido: false, favorito: false, lixeira: false, anotacoes: [], capturadoEm: new Date().toISOString() });
          novos++;
        }
      });
      p.ultimaCaptura = new Date().toISOString();
    }
    Dados.salvar();
    aviso((automatica ? 'Captura automática: ' : '') + novos + ' aviso(s) novo(s).' + (truncado ? ' Algumas consultas tinham mais páginas que o limite; restrinja estados ou modalidades.' : '') + (erros ? ' ' + erros + ' consulta(s) falharam no PNCP; tente de novo.' : ''), erros ? 'erro' : '');
    return novos;
  }

  function mesclar(a, b) { const m = {}; a.concat(b).forEach(function (x) { m[x.id] = x; }); return Object.keys(m).map(function (k) { return m[k]; }); }
  function unico(l) { return l.filter(function (x, i) { return l.indexOf(x) === i; }); }

  function produtosDoPerfil(p) {
    let out = [];
    (p.catalogoIds || []).forEach(function (cid) { const c = e().catalogos.find(function (x) { return x.id === cid; }); if (c) out = out.concat(c.produtos.filter(function (x) { return x.ativo !== false; })); });
    return out;
  }

  // Captura automática: diária ou semanal (segunda, 10h), ao abrir o app.
  function capturaVencida(p) {
    if (p.ativo === false || !p.frequencia || p.frequencia === 'manual') return false;
    const ult = p.ultimaCaptura ? new Date(p.ultimaCaptura) : new Date(0);
    const agora = new Date();
    if (p.frequencia === 'diaria') return agora - ult > 20 * 3600000 && agora.getHours() >= 7;
    const seg = new Date(agora); seg.setHours(10, 0, 0, 0); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
    return agora >= seg && ult < seg;
  }

  // ---------- cartão de aviso ----------
  function cartaoAviso(a, contexto) {
    const salvo = e().avisos[a.id];
    const x = salvo || a;
    const orgFav = e().orgaosFavoritos.indexOf(x.cnpj) >= 0;
    const perfisN = (x.perfis || []).map(function (pid) { const p = e().perfis.find(function (q) { return q.id === pid; }); return p ? p.nome : null; }).filter(Boolean);
    const fim = x.encerramento ? new Date(x.encerramento) : null;
    const urgente = fim && fim - Date.now() < 3 * 86400000 && fim > Date.now();
    return '<article class="aviso ' + (salvo && !salvo.lido ? 'nao-lido' : '') + '" data-id="' + esc(x.id) + '">' +
      '<div class="aviso-topo">' +
      '<div class="tags">' +
      (salvo && !salvo.lido ? '<span class="tag novo">Novo</span>' : '') +
      '<span class="tag">' + esc(x.modalidade || '') + (x.numero ? ' nº ' + esc(x.numero) : '') + '</span>' +
      (x.modo ? '<span class="tag claro">' + esc(x.modo) + '</span>' : '') +
      (x.srp ? '<span class="tag claro">SRP</span>' : '') +
      (x.meEpp ? '<span class="tag ouro">' + esc(x.meEpp) + '</span>' : '') +
      (orgFav ? '<span class="tag ouro">★ Órgão favorito</span>' : '') +
      capagTag(x) +
      (x.anotacoes && x.anotacoes.length ? '<span class="tag claro">✎ ' + x.anotacoes.length + '</span>' : '') +
      '</div>' +
      '<button class="icone estrela ' + (x.favorito ? 'on' : '') + '" data-a="favorito" aria-label="Favorito" title="Favorito">★</button></div>' +
      '<h3 class="objeto">' + esc(x.objeto) + '</h3>' +
      '<p class="orgao">' + esc(x.orgao) + (x.unidade && x.unidade !== x.orgao ? ' · ' + esc(x.unidade) : '') + '<br><span class="mudo">' + esc(x.municipio) + '-' + esc(x.uf) + ' · ' + esc(x.sistema || '') + '</span></p>' +
      '<dl class="numeros"><div><dt>Valor estimado</dt><dd>' + (x.valorEstimado ? moeda(x.valorEstimado) : 'Sigiloso / não informado') + '</dd></div>' +
      '<div><dt>Propostas até</dt><dd class="' + (urgente ? 'alerta' : '') + '">' + dataHora(x.encerramento) + (fim && fim > Date.now() ? ' <small>(' + emQuanto(x.encerramento) + ')</small>' : '') + '</dd></div>' +
      '<div><dt>Publicado</dt><dd>' + data(x.publicacao) + '</dd></div></dl>' +
      (x.produtos && x.produtos.length ? '<p class="mini">Casou com: <b>' + esc(x.produtos.join(', ')) + '</b>' + (perfisN.length ? ' · perfil ' + esc(perfisN.join(', ')) : '') + '</p>' : '') +
      '<footer class="acoes-aviso">' +
      '<a class="btn" href="' + esc(x.edital) + '" target="_blank" rel="noopener">Edital ↗</a>' +
      (x.linkOrigem ? '<a class="btn fantasma" href="' + esc(x.linkOrigem) + '" target="_blank" rel="noopener">Portal ↗</a>' : '') +
      '<button class="btn fantasma" data-a="anexos">Anexos</button>' +
      '<button class="btn fantasma" data-a="itens">Itens</button>' +
      '<button class="btn fantasma" data-a="anotar">Anotações</button>' +
      '<button class="btn fantasma" data-a="orgao">' + (orgFav ? '☆ Desfavoritar órgão' : '☆ Órgão') + '</button>' +
      '<span class="sep"></span>' +
      (contexto !== 'lixeira' ? '<button class="btn primario" data-a="cadastrar">Enviar para Cadastrar</button><button class="btn" data-a="quadro">+ Quadro</button><button class="btn" data-a="monitorar">Monitorar</button>' : '') +
      (salvo ? (salvo.lixeira ? '<button class="btn fantasma" data-a="restaurar">Restaurar</button>' : '<button class="btn fantasma" data-a="lido">' + (salvo.lido ? 'Marcar não lido' : 'Marcar lido') + '</button><button class="btn fantasma perigo" data-a="remover">Remover</button>') : '') +
      '</footer></article>';
  }

  function capagTag(x) {
    const c = (e().config.capag || {})[(x.municipio || '') + '-' + (x.uf || '')];
    if (!c || x.esfera !== 'M') return '';
    return '<span class="tag capag-' + Nucleo.leituraCapag(c.nota).replace(/\W/g, '') + '" title="Capacidade de pagamento (Tesouro Nacional)">CAPAG ' + esc(c.nota) + '</span>';
  }

  function guardarSeNovo(a) {
    if (!e().avisos[a.id]) e().avisos[a.id] = Object.assign({}, a, { perfis: [], produtos: [], lido: true, favorito: false, lixeira: false, anotacoes: [], capturadoEm: new Date().toISOString() });
    return e().avisos[a.id];
  }

  async function acaoAviso(btn, lista) {
    const art = btn.closest('.aviso'); const idA = art.dataset.id;
    const base = e().avisos[idA] || lista.find(function (x) { return x.id === idA; });
    if (!base) return;
    const a = btn.dataset.a;
    if (a === 'favorito') { const s = guardarSeNovo(base); s.favorito = !s.favorito; }
    else if (a === 'lido') { const s = guardarSeNovo(base); s.lido = !s.lido; }
    else if (a === 'remover') { const s = guardarSeNovo(base); s.lixeira = true; aviso('Aviso enviado para a lixeira.'); }
    else if (a === 'restaurar') { e().avisos[idA].lixeira = false; }
    else if (a === 'orgao') { const l = e().orgaosFavoritos; const i = l.indexOf(base.cnpj); if (i >= 0) l.splice(i, 1); else l.push(base.cnpj); }
    else if (a === 'anotar') { await anotacoes(guardarSeNovo(base)); }
    else if (a === 'anexos') { await verAnexos(base); return; }
    else if (a === 'itens') { await verItens(base); return; }
    else if (a === 'cadastrar') { const s = guardarSeNovo(base); s.lido = true; Dados.salvar(); Telas.cadastrar.novaDeAviso(s); return; }
    else if (a === 'quadro') { const s = guardarSeNovo(base); s.lido = true; Telas.quadros.cartaoDeAviso(s); }
    else if (a === 'monitorar') { const s = guardarSeNovo(base); s.lido = true; Telas.monitorar.adicionar(s); }
    Dados.salvar(); App.redesenhar();
  }

  async function anotacoes(s) {
    const f = await modal({
      titulo: 'Anotações da equipe', botao: 'Adicionar',
      corpo: (s.anotacoes.length ? '<ul class="lista-notas">' + s.anotacoes.map(function (n) { return '<li><b>' + esc(n.por) + '</b> · ' + dataHora(n.em) + '<br>' + esc(n.texto) + '</li>'; }).join('') + '</ul>' : '<p class="mudo">Nenhuma anotação.</p>') +
        campo('Nova anotação', '<textarea name="texto" rows="3" required></textarea>')
    });
    if (f && f.get('texto').trim()) s.anotacoes.push({ texto: f.get('texto').trim(), em: new Date().toISOString(), por: e().config.responsavel || 'Equipe' });
  }

  async function verAnexos(a) {
    const p = modal({ titulo: 'Anexos publicados no PNCP', corpo: '<div id="anexos-lista"><p class="mudo">Carregando…</p></div>', botao: false });
    try {
      const l = await PNCP.arquivos(a.cnpj, a.ano, a.seq);
      document.getElementById('anexos-lista').innerHTML = l.length ? '<ul class="lista-links">' + l.map(function (x) { return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.titulo) + '</a> <span class="mudo">· ' + esc(x.tipo) + ' · ' + data(x.data) + '</span></li>'; }).join('') + '</ul>' : '<p>Nenhum arquivo publicado. Consulte o edital no portal de origem.</p>';
    } catch (err) { document.getElementById('anexos-lista').innerHTML = '<p class="alerta">Falha ao consultar o PNCP: ' + esc(err.message) + '</p>'; }
    await p;
  }

  async function verItens(a) {
    const p = modal({ titulo: 'Itens da licitação', largo: true, corpo: '<div id="itens-lista"><p class="mudo">Carregando…</p></div>', botao: false });
    try {
      const l = await PNCP.itens(a.cnpj, a.ano, a.seq);
      const me = l.filter(function (i) { return i.meEpp; }).length;
      if (e().avisos[a.id]) { e().avisos[a.id].meEpp = me === l.length && me ? 'Exclusivo ME/EPP' : me ? 'Parcial ME/EPP' : ''; Dados.salvar(); }
      document.getElementById('itens-lista').innerHTML = l.length ? '<p class="mini">' + l.length + ' item(ns)' + (me ? ' · ' + me + ' com benefício ME/EPP' : '') + '</p><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Item</th><th>Descrição</th><th class="n">Qtd</th><th>Un.</th><th class="n">Ref. unitária</th><th>Benefício</th></tr></thead><tbody>' +
        l.map(function (i) { return '<tr><td>' + i.numero + '</td><td>' + esc(i.descricao) + '</td><td class="n">' + UI.num(i.quantidade) + '</td><td>' + esc(i.unidade) + '</td><td class="n">' + (i.sigiloso ? 'Sigiloso' : moeda(i.refUnitaria)) + '</td><td>' + esc(i.meEpp || '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p>Itens não publicados no PNCP.</p>';
    } catch (err) { document.getElementById('itens-lista').innerHTML = '<p class="alerta">Falha ao consultar o PNCP: ' + esc(err.message) + '</p>'; }
    await p;
  }

  // ---------- abas ----------
  function telaAvisos(el) {
    const todos = Object.keys(e().avisos).map(function (k) { return e().avisos[k]; });
    const f = filtros;
    let l = todos.filter(function (a) {
      if (f.estado === 'lixeira') return a.lixeira;
      if (a.lixeira) return false;
      if (f.estado === 'naolidos' && a.lido) return false;
      if (f.estado === 'favoritos' && !a.favorito) return false;
      if (f.estado === 'orgaos' && e().orgaosFavoritos.indexOf(a.cnpj) < 0) return false;
      if (f.estado === 'ativos' && a.encerramento && new Date(a.encerramento) < Date.now() && !a.favorito) return false;
      if (f.perfil && (a.perfis || []).indexOf(f.perfil) < 0) return false;
      if (f.uf && a.uf !== f.uf) return false;
      if (f.valorMin && !(a.valorEstimado >= Nucleo.lerNumeroBR(f.valorMin))) return false;
      if (f.texto && !Nucleo.contemTermo(Nucleo.normalizar(a.objeto + ' ' + a.orgao + ' ' + a.municipio), Nucleo.normalizar(f.texto))) return false;
      return true;
    });
    l.sort(function (a, b) {
      if (f.ordem === 'valor') return (b.valorEstimado || 0) - (a.valorEstimado || 0);
      if (f.ordem === 'publicacao') return new Date(b.publicacao) - new Date(a.publicacao);
      return new Date(a.encerramento || '2999') - new Date(b.encerramento || '2999');
    });
    const naoLidos = todos.filter(function (a) { return !a.lido && !a.lixeira; }).length;
    const ufs = unico(todos.map(function (a) { return a.uf; }).filter(Boolean)).sort();
    el.innerHTML = '<div class="barra-acoes"><div><b>' + l.length + '</b> aviso(s) · ' + naoLidos + ' não lido(s)</div>' +
      '<div class="grupo-botoes"><button class="btn" data-a="marcar-todos">Marcar todos lidos</button><button class="btn primario" data-a="capturar">⟳ Capturar agora</button></div></div>' +
      '<div id="progresso-captura"></div>' +
      '<form class="filtros" id="filtros">' +
      '<input type="search" name="texto" placeholder="Filtrar por palavra, órgão, cidade…" value="' + esc(f.texto) + '">' +
      '<select name="estado">' + opcoes([{ v: 'ativos', t: 'Abertos' }, { v: 'todos', t: 'Todos' }, { v: 'naolidos', t: 'Não lidos' }, { v: 'favoritos', t: 'Favoritos' }, { v: 'orgaos', t: 'Órgãos favoritos' }, { v: 'lixeira', t: 'Lixeira' }], f.estado) + '</select>' +
      '<select name="perfil"><option value="">Todos os perfis</option>' + opcoes(e().perfis.map(function (p) { return { v: p.id, t: p.nome }; }), f.perfil) + '</select>' +
      '<select name="uf"><option value="">Todas as UFs</option>' + opcoes(ufs, f.uf) + '</select>' +
      '<input name="valorMin" inputmode="decimal" placeholder="Valor mínimo R$" value="' + esc(f.valorMin) + '">' +
      '<select name="ordem">' + opcoes([{ v: 'encerramento', t: 'Prazo mais próximo' }, { v: 'valor', t: 'Maior valor' }, { v: 'publicacao', t: 'Mais recentes' }], f.ordem) + '</select>' +
      '</form>' +
      (l.length ? '<div class="avisos">' + l.slice(0, 200).map(function (a) { return cartaoAviso(a, f.estado); }).join('') + '</div>' + (l.length > 200 ? '<p class="mudo">Mostrando 200 de ' + l.length + '. Refine os filtros.</p>' : '') :
        !e().perfis.length ? UI.vazio('Comece pelo catálogo e pelo perfil de busca', 'Cadastre os produtos do cliente (O que vendo / Qual tipo / O que não vendo) e crie um perfil com estados e modalidades. Depois clique em Capturar agora.', '<a class="btn primario" href="#/encontrar/catalogos">Criar catálogo</a>') :
          UI.vazio('Nenhum aviso aqui', 'Clique em <b>Capturar agora</b> para consultar o PNCP com os seus perfis, ou ajuste os filtros.'));
    const form = el.querySelector('#filtros');
    form.oninput = function () { const fd = new FormData(form); Object.keys(filtros).forEach(function (k) { filtros[k] = fd.get(k) || ''; }); clearTimeout(form._t); form._t = setTimeout(function () { App.redesenhar(); const i = document.querySelector('#filtros [name=texto]'); if (i && document.activeElement !== i && fd.get('texto')) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
    form.onsubmit = function (ev) { ev.preventDefault(); };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'capturar') { b.disabled = true; try { await capturar(null, el.querySelector('#progresso-captura')); } catch (err) { aviso('Falha na captura: ' + err.message, 'erro'); } App.redesenhar(); return; }
      if (b.dataset.a === 'marcar-todos') { l.forEach(function (a) { a.lido = true; }); Dados.salvar(); App.redesenhar(); return; }
      acaoAviso(b, l);
    };
  }

  function telaBanco(el) {
    const ultimo = bancoResultado;
    el.innerHTML = '<p class="mudo">Pesquisa livre nas licitações com proposta aberta no PNCP, sem depender de perfil. Use para testar palavras antes de montar o catálogo.</p>' +
      '<form class="cartao form-busca" id="busca">' +
      '<div class="linha">' + campo('O que vendo *', '<input name="oQueVendo" required placeholder="ex.: papel a4, papel sulfite" value="' + esc(ultimo ? ultimo.q.oQueVendo : '') + '">', 'Termos separados por vírgula; basta um casar.') +
      campo('Qual tipo', '<input name="qualTipo" placeholder="ex.: 75g" value="' + esc(ultimo ? ultimo.q.qualTipo : '') + '">') +
      campo('O que não vendo', '<input name="oQueNaoVendo" placeholder="ex.: reciclado" value="' + esc(ultimo ? ultimo.q.oQueNaoVendo : '') + '">') + '</div>' +
      '<fieldset><legend>Estados</legend><div class="grade-checks">' + PNCP.UFS.map(function (u) { return '<label><input type="checkbox" name="uf" value="' + u + '"' + ((ultimo ? ultimo.q.ufs : ['GO', 'DF']).indexOf(u) >= 0 ? ' checked' : '') + '> ' + u + '</label>'; }).join('') + '</div></fieldset>' +
      '<fieldset><legend>Modalidades</legend><div class="grade-checks">' + Object.keys(PNCP.MODALIDADES).map(function (k) { return '<label><input type="checkbox" name="mod" value="' + k + '"' + ((ultimo ? ultimo.q.modalidades : MODS_PADRAO).map(String).indexOf(k) >= 0 ? ' checked' : '') + '> ' + esc(PNCP.MODALIDADES[k]) + '</label>'; }).join('') + '</div></fieldset>' +
      '<div class="barra-acoes"><small class="mudo">Muitos estados e modalidades deixam a consulta lenta: o PNCP não filtra por palavra, então o app baixa tudo e filtra aqui.</small><button class="btn primario">Pesquisar</button></div></form>' +
      '<div id="progresso-banco"></div><div id="resultado-banco">' + (ultimo ? resultadoBanco(ultimo) : '') + '</div>';
    el.querySelector('#busca').onsubmit = async function (ev) {
      ev.preventDefault();
      const fd = new FormData(this);
      const q = { oQueVendo: fd.get('oQueVendo'), qualTipo: fd.get('qualTipo'), oQueNaoVendo: fd.get('oQueNaoVendo'), ufs: fd.getAll('uf'), modalidades: fd.getAll('mod').map(Number) };
      if (!q.ufs.length) { aviso('Escolha ao menos um estado.', 'erro'); return; }
      const btn = this.querySelector('button.primario'); btn.disabled = true;
      try {
        const r = await PNCP.propostasAbertas({ ufs: q.ufs, modalidades: q.modalidades }, function (f, t) { progresso(el.querySelector('#progresso-banco'), f + '/' + t + ' consultas ao PNCP', f / t); });
        pool = mesclar(pool, r.lista);
        const lista = r.lista.filter(function (c) { return Nucleo.casaProduto(c.objeto + ' ' + (c.info || ''), q); })
          .sort(function (a, b) { return new Date(a.encerramento || '2999') - new Date(b.encerramento || '2999'); });
        bancoResultado = { q: q, lista: lista, total: r.lista.length, truncado: r.truncado };
        el.querySelector('#progresso-banco').innerHTML = '';
        el.querySelector('#resultado-banco').innerHTML = resultadoBanco(bancoResultado);
      } catch (err) { aviso('Falha ao consultar o PNCP: ' + err.message, 'erro'); el.querySelector('#progresso-banco').innerHTML = ''; }
      btn.disabled = false;
    };
    el.onclick = function (ev) {
      const b = ev.target.closest('.aviso [data-a]'); if (!b || !bancoResultado) return;
      if (b.dataset.a === 'criar-produto') return;
      acaoAviso(b, bancoResultado.lista);
    };
    el.querySelector('#resultado-banco').addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-a=criar-produto]'); if (!b) return;
      Telas.encontrar.novoProdutoDe(bancoResultado.q);
    });
  }

  function resultadoBanco(r) {
    return '<div class="barra-acoes"><div><b>' + r.lista.length + '</b> licitação(ões) casaram, de ' + r.total + ' abertas consultadas.' + (r.truncado ? ' <span class="alerta">Consulta truncada: restrinja estados ou modalidades.</span>' : '') + '</div>' +
      '<button class="btn" data-a="criar-produto">Salvar termos como produto do catálogo</button></div>' +
      (r.lista.length ? '<div class="avisos">' + r.lista.slice(0, 150).map(function (a) { return cartaoAviso(a, 'banco'); }).join('') + '</div>' : UI.vazio('Nada encontrado', 'Tente outros termos ou mais estados.'));
  }

  function telaCatalogos(el) {
    const cats = e().catalogos;
    el.innerHTML = '<div class="barra-acoes"><p class="mudo">Cada produto tem três campos: <b>O que vendo</b> (termo principal), <b>Qual tipo</b> (especificação que precisa aparecer junto) e <b>O que não vendo</b> (exclusão). Um catálogo pode servir a vários perfis.</p><button class="btn primario" data-a="novo-cat">+ Novo catálogo</button></div>' +
      (cats.length ? cats.map(function (c) {
        const perfis = e().perfis.filter(function (p) { return (p.catalogoIds || []).indexOf(c.id) >= 0; }).map(function (p) { return p.nome; });
        return '<section class="cartao" data-cat="' + c.id + '"><header><h3>' + esc(c.nome) + '</h3><span class="mudo">' + (perfis.length ? 'Usado em: ' + esc(perfis.join(', ')) : 'Não vinculado a perfil') + '</span>' +
          '<div class="grupo-botoes"><button class="btn" data-a="prod">+ Produto</button><button class="btn fantasma" data-a="ren">Renomear</button><button class="btn fantasma perigo" data-a="del-cat">Excluir</button></div></header>' +
          (c.produtos.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Ativo</th><th>O que vendo</th><th>Qual tipo</th><th>O que não vendo</th><th></th></tr></thead><tbody>' +
            c.produtos.map(function (p) {
              return '<tr data-prod="' + p.id + '" class="' + (p.ativo === false ? 'inativo' : '') + '"><td><input type="checkbox" data-a="ativo"' + (p.ativo !== false ? ' checked' : '') + ' aria-label="Ativo"></td><td>' + esc(p.oQueVendo) + '</td><td>' + esc(p.qualTipo || '—') + '</td><td>' + esc(p.oQueNaoVendo || '—') + '</td>' +
                '<td class="acoes"><button class="btn mini" data-a="previa">Prévia</button><button class="btn mini fantasma" data-a="edit-prod">Editar</button><button class="btn mini fantasma perigo" data-a="del-prod">×</button></td></tr>';
            }).join('') + '</tbody></table></div>' : '<p class="mudo">Sem produtos. Clique em + Produto.</p>') + '</section>';
      }).join('') : UI.vazio('Nenhum catálogo', 'Crie um catálogo por cliente (ou por linha de produto) e cadastre o que ele vende.', '<button class="btn primario" data-a="novo-cat">+ Novo catálogo</button>'));
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      const sec = b.closest('[data-cat]'); const cat = sec && cats.find(function (c) { return c.id === sec.dataset.cat; });
      const tr = b.closest('[data-prod]'); const prod = tr && cat.produtos.find(function (p) { return p.id === tr.dataset.prod; });
      const a = b.dataset.a;
      if (a === 'novo-cat' || a === 'ren') {
        const f = await modal({ titulo: a === 'ren' ? 'Renomear catálogo' : 'Novo catálogo', corpo: campo('Nome', '<input name="nome" required value="' + esc(cat ? cat.nome : (Dados.empresaAtiva() ? Dados.empresaAtiva().fantasia || Dados.empresaAtiva().razao : '')) + '">') });
        if (!f) return;
        if (a === 'ren') cat.nome = f.get('nome'); else cats.push({ id: Dados.id('cat'), nome: f.get('nome'), produtos: [] });
      }
      if (a === 'del-cat' && await confirmar('Excluir catálogo', 'Excluir <b>' + esc(cat.nome) + '</b>? Os perfis vinculados deixam de usá-lo.', 'Excluir')) {
        e().catalogos = cats.filter(function (c) { return c !== cat; }); e().perfis.forEach(function (p) { p.catalogoIds = (p.catalogoIds || []).filter(function (x) { return x !== cat.id; }); });
      }
      if (a === 'prod' || a === 'edit-prod') { const p = await formProduto(prod); if (!p) return; if (prod) Object.assign(prod, p); else cat.produtos.push(Object.assign({ id: Dados.id('prd'), ativo: true }, p)); }
      if (a === 'del-prod') cat.produtos = cat.produtos.filter(function (p) { return p !== prod; });
      if (a === 'ativo') prod.ativo = b.checked;
      if (a === 'previa') { await previa(prod); return; }
      Dados.salvar(); App.redesenhar();
    };
  }

  async function formProduto(p) {
    p = p || {};
    const f = await modal({
      titulo: p.id ? 'Editar produto' : 'Novo produto',
      corpo: campo('O que vendo *', '<input name="oQueVendo" required value="' + esc(p.oQueVendo) + '" placeholder="ex.: papel a4, papel sulfite">', 'Separe sinônimos por vírgula. Cada termo casa quando todas as palavras dele aparecem no objeto.') +
        campo('Qual tipo', '<input name="qualTipo" value="' + esc(p.qualTipo) + '" placeholder="ex.: 75g, 75 g">', 'Opcional. Se preencher, ao menos um destes precisa aparecer junto.') +
        campo('O que não vendo', '<input name="oQueNaoVendo" value="' + esc(p.oQueNaoVendo) + '" placeholder="ex.: reciclado, locação">', 'Qualquer um destes exclui o aviso.')
    });
    return f ? { oQueVendo: f.get('oQueVendo'), qualTipo: f.get('qualTipo'), oQueNaoVendo: f.get('oQueNaoVendo') } : null;
  }

  async function previa(prod) {
    const p = modal({ titulo: 'Prévia: ' + prod.oQueVendo, largo: true, corpo: '<div id="previa"></div>', botao: false });
    const alvo = document.getElementById('previa');
    try {
      if (!pool.length) {
        const r = await PNCP.propostasAbertas({ ufs: ['GO', 'DF'], modalidades: MODS_PADRAO }, function (f, t) { progresso(alvo, 'Baixando licitações abertas de GO e DF para a prévia… ' + f + '/' + t, f / t); });
        pool = r.lista;
      }
      const l = pool.filter(function (c) { return Nucleo.casaProduto(c.objeto + ' ' + (c.info || ''), prod); });
      alvo.innerHTML = '<p class="mini">' + l.length + ' de ' + pool.length + ' licitações abertas já baixadas casariam com este produto.</p>' +
        (l.length ? '<ul class="lista-previa">' + l.slice(0, 40).map(function (c) { return '<li><b>' + esc(c.uf) + '</b> · ' + esc(c.objeto.slice(0, 220)) + ' <a href="' + esc(c.edital) + '" target="_blank" rel="noopener">↗</a></li>'; }).join('') + '</ul>' : '<p>Nada casou. Afrouxe "Qual tipo" ou teste sinônimos no Banco de Licitações.</p>');
    } catch (err) { alvo.innerHTML = '<p class="alerta">Falha ao consultar o PNCP: ' + esc(err.message) + '</p>'; }
    await p;
  }

  function telaPerfis(el) {
    const ps = e().perfis;
    el.innerHTML = '<div class="barra-acoes"><p class="mudo">O perfil diz onde procurar (estados, modalidades, esferas) e com quais catálogos. A captura roda ao abrir o app conforme a frequência, ou em <b>Capturar agora</b>.</p><button class="btn primario" data-a="novo">+ Novo perfil</button></div>' +
      (ps.length ? '<div class="cartoes">' + ps.map(function (p) {
        const emp = Dados.empresa(p.empresaId);
        const n = Object.keys(e().avisos).filter(function (k) { return (e().avisos[k].perfis || []).indexOf(p.id) >= 0 && !e().avisos[k].lixeira; }).length;
        return '<article class="cartao" data-id="' + p.id + '"><header><h3>' + esc(p.nome) + '</h3><span class="tag ' + (p.ativo === false ? 'claro' : 'verde') + '">' + (p.ativo === false ? 'Inativo' : 'Ativo') + '</span></header>' +
          '<p class="mini">' + (emp ? esc(emp.fantasia || emp.razao) + ' · ' : '') + (p.ufs && p.ufs.length ? esc(p.ufs.join(', ')) : 'Todo o Brasil') + '<br>' + esc((p.modalidades && p.modalidades.length ? p.modalidades : MODS_PADRAO).map(function (m) { return PNCP.MODALIDADES[m]; }).join(', ')) + '</p>' +
          '<p class="mini">Catálogos: ' + esc((p.catalogoIds || []).map(function (c) { const x = e().catalogos.find(function (y) { return y.id === c; }); return x ? x.nome : ''; }).filter(Boolean).join(', ') || '—') + '</p>' +
          '<p class="mini">Captura: ' + ({ manual: 'manual', diaria: 'diária', semanal: 'semanal (segunda, 10h)' }[p.frequencia || 'semanal']) + ' · última ' + (p.ultimaCaptura ? dataHora(p.ultimaCaptura) : 'nunca') + ' · ' + n + ' aviso(s)</p>' +
          '<footer><button class="btn" data-a="capturar">Capturar</button><button class="btn fantasma" data-a="editar">Editar</button><button class="btn fantasma perigo" data-a="excluir">Excluir</button></footer></article>';
      }).join('') + '</div><div id="progresso-perfil"></div>' : UI.vazio('Nenhum perfil de busca', e().catalogos.length ? 'Crie um perfil e vincule o catálogo.' : 'Antes, crie um catálogo com os produtos do cliente.', e().catalogos.length ? '<button class="btn primario" data-a="novo">+ Novo perfil</button>' : '<a class="btn primario" href="#/encontrar/catalogos">Criar catálogo</a>'));
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      const card = b.closest('[data-id]'); const p = card && ps.find(function (x) { return x.id === card.dataset.id; });
      if (b.dataset.a === 'novo' || b.dataset.a === 'editar') { await formPerfil(p); }
      if (b.dataset.a === 'excluir' && await confirmar('Excluir perfil', 'Excluir o perfil <b>' + esc(p.nome) + '</b>? Os avisos já capturados ficam.', 'Excluir')) e().perfis = ps.filter(function (x) { return x !== p; });
      if (b.dataset.a === 'capturar') { b.disabled = true; try { await capturar([p], el.querySelector('#progresso-perfil')); } catch (err) { aviso(err.message, 'erro'); } }
      Dados.salvar(); App.redesenhar();
    };
  }

  async function formPerfil(p) {
    const emp = Dados.empresaAtiva();
    p = p || { ufs: emp ? [emp.uf] : ['GO'], modalidades: MODS_PADRAO, esferas: [], catalogoIds: e().catalogos.length === 1 ? [e().catalogos[0].id] : [], frequencia: 'semanal', ativo: true, empresaId: emp && emp.id };
    const f = await modal({
      titulo: p.id ? 'Editar perfil de busca' : 'Novo perfil de busca', largo: true,
      corpo: '<div class="linha">' + campo('Nome do perfil *', '<input name="nome" required value="' + esc(p.nome || '') + '">') +
        campo('Cliente', '<select name="empresaId"><option value="">—</option>' + opcoes(e().empresas.map(function (x) { return { v: x.id, t: x.fantasia || x.razao }; }), p.empresaId) + '</select>') +
        campo('Captura', '<select name="frequencia">' + opcoes([{ v: 'semanal', t: 'Semanal (segunda, 10h)' }, { v: 'diaria', t: 'Diária' }, { v: 'manual', t: 'Só manual' }], p.frequencia) + '</select>') + '</div>' +
        '<fieldset><legend>Catálogos</legend><div class="grade-checks">' + (e().catalogos.map(function (c) { return '<label><input type="checkbox" name="cat" value="' + c.id + '"' + ((p.catalogoIds || []).indexOf(c.id) >= 0 ? ' checked' : '') + '> ' + esc(c.nome) + ' (' + c.produtos.length + ')</label>'; }).join('') || '<span class="mudo">Crie um catálogo antes.</span>') + '</div></fieldset>' +
        '<fieldset><legend>Estados <small>(nenhum = Brasil todo, consulta lenta)</small></legend><div class="grade-checks">' + PNCP.UFS.map(function (u) { return '<label><input type="checkbox" name="uf" value="' + u + '"' + ((p.ufs || []).indexOf(u) >= 0 ? ' checked' : '') + '> ' + u + '</label>'; }).join('') + '</div></fieldset>' +
        '<fieldset><legend>Modalidades</legend><div class="grade-checks">' + Object.keys(PNCP.MODALIDADES).map(function (k) { return '<label><input type="checkbox" name="mod" value="' + k + '"' + ((p.modalidades || []).map(String).indexOf(k) >= 0 ? ' checked' : '') + '> ' + esc(PNCP.MODALIDADES[k]) + '</label>'; }).join('') + '</div></fieldset>' +
        '<fieldset><legend>Esferas <small>(nenhuma = todas)</small></legend><div class="grade-checks">' + ESFERAS.map(function (x) { return '<label><input type="checkbox" name="esf" value="' + x.v + '"' + ((p.esferas || []).indexOf(x.v) >= 0 ? ' checked' : '') + '> ' + x.t + '</label>'; }).join('') + '</div></fieldset>' +
        '<label class="check"><input type="checkbox" name="ativo"' + (p.ativo !== false ? ' checked' : '') + '> Perfil ativo</label>' +
        campo('Anotações', '<textarea name="anotacoes" rows="2">' + esc(p.anotacoes || '') + '</textarea>'),
      validar: function (fd) { return fd.getAll('cat').length ? '' : 'Vincule ao menos um catálogo.'; }
    });
    if (!f) return;
    const d = { nome: f.get('nome'), empresaId: f.get('empresaId'), frequencia: f.get('frequencia'), catalogoIds: f.getAll('cat'), ufs: f.getAll('uf'), modalidades: f.getAll('mod').map(Number), esferas: f.getAll('esf'), ativo: !!f.get('ativo'), anotacoes: f.get('anotacoes') };
    if (!d.modalidades.length) d.modalidades = MODS_PADRAO;
    if (p.id) Object.assign(p, d); else e().perfis.push(Object.assign({ id: Dados.id('prf') }, d));
  }

  Telas.encontrar = {
    titulo: 'Encontrar',
    render: function (el, sub) {
      sub = sub || 'avisos';
      const naoLidos = Object.keys(e().avisos).filter(function (k) { return !e().avisos[k].lido && !e().avisos[k].lixeira; }).length;
      el.innerHTML = abas([{ id: 'avisos', t: 'Meus Avisos', n: naoLidos }, { id: 'banco', t: 'Banco de Licitações' }, { id: 'perfis', t: 'Perfis de Busca' }, { id: 'catalogos', t: 'Catálogo de Produtos' }], sub, 'encontrar') + '<div id="aba"></div>';
      const aba = el.querySelector('#aba');
      ({ avisos: telaAvisos, banco: telaBanco, perfis: telaPerfis, catalogos: telaCatalogos }[sub] || telaAvisos)(aba);
      el.onclick = null;
    },
    novoProdutoDe: async function (q) {
      if (!e().catalogos.length) e().catalogos.push({ id: Dados.id('cat'), nome: 'Catálogo principal', produtos: [] });
      const f = await modal({ titulo: 'Salvar no catálogo', corpo: campo('Catálogo', '<select name="cat">' + opcoes(e().catalogos.map(function (c) { return { v: c.id, t: c.nome }; })) + '</select>') + '<p class="mini">O que vendo: <b>' + esc(q.oQueVendo) + '</b><br>Qual tipo: ' + esc(q.qualTipo || '—') + '<br>O que não vendo: ' + esc(q.oQueNaoVendo || '—') + '</p>' });
      if (!f) return;
      e().catalogos.find(function (c) { return c.id === f.get('cat'); }).produtos.push({ id: Dados.id('prd'), ativo: true, oQueVendo: q.oQueVendo, qualTipo: q.qualTipo, oQueNaoVendo: q.oQueNaoVendo });
      Dados.salvar(); aviso('Produto salvo no catálogo.');
    },
    capturaAutomatica: async function () {
      const vencidos = e().perfis.filter(capturaVencida);
      if (!vencidos.length) return;
      try { const n = await capturar(vencidos, null, true); if (n && App.rota().tela === 'painel') App.redesenhar(); } catch (err) { console.warn('captura automática falhou', err); }
    }
  };
})();
