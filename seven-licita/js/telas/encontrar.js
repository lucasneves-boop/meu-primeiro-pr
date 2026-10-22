/* Seven Radar: perfis de busca, catálogo de produtos, meus avisos e banco de licitações (PNCP). */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, data, dataHora, cnpj, campo, opcoes, modal, confirmar, aviso, emQuanto, abas, progresso } = UI;
  const ESFERAS = [{ v: 'M', t: 'Municipal' }, { v: 'E', t: 'Estadual' }, { v: 'D', t: 'Distrital' }, { v: 'F', t: 'Federal' }];
  const MODS_PADRAO = [6, 8, 4];
  let pool = []; // últimas licitações baixadas (para prévia e banco)
  let bancoResultado = null;
  let filtros = null; // Meus Avisos (avisosPadrao, abaixo)

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
      (Telas.oport.quantas(x.id) ? '<span class="tag claro" title="Anotações">✎ ' + Telas.oport.quantas(x.id) + '</span>' : '') +
      '</div>' +
      '<button class="icone estrela ' + (x.favorito ? 'on' : '') + '" data-a="favorito" aria-label="Favorito" title="Favorito">★</button></div>' +
      '<h3 class="objeto">' + esc(x.objeto) + '</h3>' +
      '<p class="orgao">' + esc(x.orgao) + (x.unidade && x.unidade !== x.orgao ? ' · ' + esc(x.unidade) : '') + '<br><span class="mudo">' + esc(x.municipio) + '-' + esc(x.uf) + ' · ' + esc(x.sistema || '') + '</span></p>' +
      '<dl class="numeros"><div><dt>Valor estimado</dt><dd>' + (x.valorEstimado ? moeda(x.valorEstimado) : 'Sigiloso / não informado') + '</dd></div>' +
      '<div><dt>Propostas até</dt><dd class="' + (urgente ? 'alerta' : '') + '">' + dataHora(x.encerramento) + (fim && fim > Date.now() ? ' <small>(' + emQuanto(x.encerramento) + ')</small>' : '') + '</dd></div>' +
      '<div><dt>Publicado</dt><dd>' + data(x.publicacao) + '</dd></div></dl>' +
      (x.produtos && x.produtos.length ? '<p class="mini">Casou com: <b>' + esc(x.produtos.join(', ')) + '</b>' + (perfisN.length ? ' · perfil ' + esc(perfisN.join(', ')) : '') + '</p>' : '') +
      '<footer class="acoes-aviso">' +
      '<a class="btn" href="' + esc(UI.url(x.edital)) + '" target="_blank" rel="noopener">Edital ↗</a>' +
      (x.linkOrigem ? '<a class="btn fantasma" href="' + esc(UI.url(x.linkOrigem)) + '" target="_blank" rel="noopener">Portal ↗</a>' : '') +
      '<button class="btn fantasma" data-a="anexos">Anexos</button>' +
      '<button class="btn fantasma" data-a="itens">Itens</button>' +
      '<button class="btn fantasma" data-a="anotar">✎ Anotações' + (Telas.oport.quantas(x.id) ? ' (' + Telas.oport.quantas(x.id) + ')' : '') + '</button>' +
      '<button class="btn fantasma" data-a="ia" title="Abre a Seven IA com os dados deste edital">✳ Perguntar à Seven IA</button>' +
      '<button class="btn fantasma" data-a="orgao">' + (orgFav ? '☆ Desfavoritar órgão' : '☆ Órgão') + '</button>' +
      '<span class="sep"></span>' +
      (contexto !== 'lixeira' ? '<button class="btn primario" data-a="cadastrar">Enviar para o Seven Bid</button><button class="btn" data-a="quadro">+ Quadro</button><button class="btn" data-a="monitorar">Monitorar</button>' : '') +
      (salvo ? (salvo.lixeira ? '<button class="btn fantasma" data-a="restaurar">Restaurar</button>' : '<button class="btn fantasma" data-a="lido">' + (salvo.lido ? 'Marcar não lido' : 'Marcar lido') + '</button><button class="btn fantasma perigo" data-a="remover">Remover</button>') : '') +
      '</footer></article>';
  }

  function capagTag(x) {
    const tab = e().config.capag || {};
    const c = (x.ibge && tab[x.ibge]) || tab[Nucleo.chaveCapag(x.municipio, x.uf)] || tab[(x.municipio || '') + '-' + (x.uf || '')];
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
    else if (a === 'anotar') { const s = guardarSeNovo(base); Dados.salvar(); Telas.oport.abrir(s.id, s.objeto, 'encontrar'); return; }
    else if (a === 'anexos') { await verAnexos(base); return; }
    else if (a === 'itens') { await verItens(base); return; }
    else if (a === 'ia') { const s = guardarSeNovo(base); s.lido = true; Dados.salvar(); Telas.ia.perguntar(perguntaEdital(s)); return; }
    else if (a === 'cadastrar') { const s = guardarSeNovo(base); s.lido = true; Dados.salvar(); Telas.cadastrar.novaDeAviso(s); return; }
    else if (a === 'quadro') { const s = guardarSeNovo(base); s.lido = true; Telas.quadros.cartaoDeAviso(s); }
    else if (a === 'monitorar') { const s = guardarSeNovo(base); s.lido = true; Telas.monitorar.adicionar(s); }
    Dados.salvar(); App.redesenhar();
  }

  async function verAnexos(a) {
    const p = modal({ titulo: 'Anexos publicados no PNCP', corpo: '<div id="anexos-lista"><p class="mudo">Carregando…</p></div>', botao: false });
    try {
      const l = await PNCP.arquivos(a.cnpj, a.ano, a.seq);
      document.getElementById('anexos-lista').innerHTML = l.length ? '<ul class="lista-links">' + l.map(function (x) { return '<li><a href="' + esc(UI.url(x.url)) + '" target="_blank" rel="noopener">' + esc(x.titulo) + '</a> <span class="mudo">· ' + esc(x.tipo) + ' · ' + data(x.data) + '</span></li>'; }).join('') + '</ul>' : '<p>Nenhum arquivo publicado. Consulte o edital no portal de origem.</p>';
    } catch (err) { document.getElementById('anexos-lista').innerHTML = '<p class="alerta">Falha ao consultar o PNCP: ' + esc(err.message) + '</p>'; }
    await p;
  }

  async function verItens(a) {
    const p = modal({ titulo: 'Itens da licitação', largo: true, corpo: '<div id="itens-lista"><p class="mudo">Carregando…</p></div>', botao: false });
    try {
      const l = await PNCP.itens(a.cnpj, a.ano, a.seq);
      const me = l.filter(function (i) { return i.meEpp; }).length;
      if (e().avisos[a.id]) { e().avisos[a.id].meEpp = me === l.length && me ? 'Exclusivo ME/EPP' : me ? 'Parcial ME/EPP' : ''; Dados.salvar(); }
      document.getElementById('itens-lista').onclick = function (ev) { const b = ev.target.closest('[data-mercado]'); if (!b) return; const f = b.closest('.modal-fundo'); if (f) f.remove(); Telas.mercado.pesquisar(b.dataset.mercado); };
      document.getElementById('itens-lista').innerHTML = l.length ? '<p class="mini">' + l.length + ' item(ns)' + (me ? ' · ' + me + ' com benefício ME/EPP' : '') + '</p><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Item</th><th>Descrição</th><th class="n">Qtd</th><th>Un.</th><th class="n">Ref. unitária</th><th>Benefício</th><th></th></tr></thead><tbody>' +
        l.map(function (i) { return '<tr><td>' + i.numero + '</td><td>' + esc(i.descricao) + '</td><td class="n">' + UI.num(i.quantidade) + '</td><td>' + esc(i.unidade) + '</td><td class="n">' + (i.sigiloso ? 'Sigiloso' : moeda(i.refUnitaria)) + '</td><td>' + esc(i.meEpp || '—') + '</td><td><button type="button" class="btn mini" data-mercado="' + esc(termoItem(i.descricao)) + '" title="Preços homologados, órgãos e concorrentes deste item">Mercado</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p>Itens não publicados no PNCP.</p>';
    } catch (err) { document.getElementById('itens-lista').innerHTML = '<p class="alerta">Falha ao consultar o PNCP: ' + esc(err.message) + '</p>'; }
    await p;
  }

  // Palavras-chave do item para a Análise de Mercado (sem códigos, unidades e palavras de ligação).
  function termoItem(d) { return String(d || '').replace(/\(.*?\)/g, ' ').replace(/[^A-Za-zÀ-ÿ0-9 ]+/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2 && !/^(com|para|tipo|cor|unidade|marca|modelo|medindo|aproximadamente|referencia|das|dos|que)$/i.test(w) && !/^\d+$/.test(w); }).slice(0, 4).join(' ').toLowerCase(); }
  function perguntaEdital(a) {
    return 'Analise esta licitação para um cliente da Seven e diga se vale participar, o que exige de habilitação, prazos, riscos e o que conferir no edital.\n\n' +
      'Órgão: ' + (a.orgao || '') + (a.municipio ? ' (' + a.municipio + '-' + a.uf + ')' : '') + '\nModalidade: ' + [a.modalidade, a.numero].filter(Boolean).join(' nº ') + (a.srp ? ' · registro de preços' : '') + (a.meEpp ? ' · ' + a.meEpp : '') +
      '\nObjeto: ' + (a.objeto || '') + '\nValor estimado: ' + (a.valorEstimado ? moeda(a.valorEstimado) : 'sigiloso/não informado') + '\nPropostas até: ' + (a.encerramento ? dataHora(a.encerramento) : '—') +
      '\nEdital: ' + (a.edital || a.linkOrigem || '') + '\n\nSe puder, anexe o PDF do edital nesta conversa para eu ler as cláusulas.';
  }
  async function porNumero() {
    const r = await modal({ titulo: 'Achar edital por número', botao: 'Buscar', corpo: campo('Link do PNCP ou número de controle', '<input name="ref" required placeholder="https://pncp.gov.br/app/editais/… ou 00394460000141-1-000123/2026">', 'Também aceita CNPJ, ano e sequencial separados por espaço.') });
    if (!r) return;
    const ref = PNCP.lerReferencia(r.get('ref')); if (!ref) { aviso('Não reconheci o número. Cole o link do edital no PNCP ou o número de controle.', 'erro'); return; }
    try {
      const c = await PNCP.compra(ref.cnpj, ref.ano, ref.seq); if (!c) { aviso('Edital não encontrado no PNCP.', 'erro'); return; }
      const s = guardarSeNovo(c); s.lido = false; s.lixeira = false; Dados.salvar();
      filtros = avisosPadrao('todos'); filtros.situacao = 'todas'; aviso('Edital adicionado aos seus avisos.'); App.redesenhar();
      const art = document.querySelector('.aviso[data-id="' + (window.CSS && CSS.escape ? CSS.escape(s.id) : s.id) + '"]'); if (art) { art.scrollIntoView({ block: 'center' }); art.classList.add('destaque'); }
    } catch (x) { aviso('Falha ao consultar o PNCP: ' + x.message, 'erro'); }
  }

  // ---------- Meus Avisos: painel de filtros ----------
  const MULTI_AVISOS = ['portais', 'modalidades', 'esferas', 'ufs', 'municipios', 'perfis', 'palavras', 'capag'];
  const ALVOS_VALOR = [{ v: '', t: 'Não filtrar' }, { v: 'item', t: 'Unitário do item' }, { v: 'itemTotal', t: 'Total do item' }, { v: 'grupo', t: 'Grupo / lote' }];
  let painelAvisosAberto = true; let notaItens = '';
  function avisosPadrao(estado) {
    const f = { estado: estado || 'todos', situacao: 'abertos', texto: '', codigo: '', uasg: '', orgao: '', id: '', aberturaDe: '', aberturaAte: '', encerramentoDe: '', encerramentoAte: '', publicacaoDe: '', publicacaoAte: '', enviadoDe: '', enviadoAte: '', meEpp: '', cadastro: '', srp: '', valorMin: '', valorMax: '', sigiloso: '', valorAlvo: '', itemMin: '', itemMax: '', ordem: 'encerramento', custom: '' };
    MULTI_AVISOS.forEach(function (k) { f[k] = []; }); return f;
  }
  function notaCapag(x) {
    if (x.esfera !== 'M') return '';
    const tab = e().config.capag || {};
    const c = (x.ibge && tab[x.ibge]) || tab[Nucleo.chaveCapag(x.municipio, x.uf)] || tab[(x.municipio || '') + '-' + (x.uf || '')];
    return c && c.nota ? String(c.nota).trim().charAt(0).toUpperCase() : '';
  }
  function cadastrados() { const ids = {}; e().propostas.forEach(function (p) { if (p.avisoId) ids[p.avisoId] = 1; }); return ids; }
  function filtrosAtivos(f) {
    const p = avisosPadrao(); let n = 0;
    Object.keys(p).forEach(function (k) { if (k === 'estado' || k === 'ordem' || k === 'custom' || k === 'situacao' || k === 'texto') return; if (Array.isArray(p[k]) ? (f[k] || []).length : f[k]) n++; });
    if (f.valorAlvo && !f.itemMin && !f.itemMax) n--;
    return n + (f.situacao !== 'abertos' ? 1 : 0);
  }
  function ajuda(t) { return ' <span class="ma-ajuda" title="' + esc(t) + '" aria-label="' + esc(t) + '">?</span>'; }
  function cel(rot, dica, html, largo) { return '<div class="ma-c' + (largo ? ' largo' : '') + '"><span class="ma-r">' + rot + (dica ? ajuda(dica) : '') + '</span>' + html + '</div>'; }
  function multi(nome, rot, dica, ops, sel) {
    sel = (sel || []).map(String);
    const marcados = ops.filter(function (o) { return sel.indexOf(String(o.v)) >= 0; });
    const resumo = !marcados.length ? '<span class="mudo">Selecione</span>' : marcados.length === 1 ? esc(marcados[0].t) : marcados.length + ' selecionados';
    return cel(rot, dica, '<details class="ms"><summary>' + resumo + '</summary><div class="ms-lista">' +
      (ops.length > 8 ? '<input type="search" class="ms-busca" placeholder="Filtrar…" aria-label="Filtrar opções de ' + esc(rot) + '">' : '') +
      (ops.length ? ops.map(function (o) { return '<label><input type="checkbox" name="' + nome + '" value="' + esc(o.v) + '"' + (sel.indexOf(String(o.v)) >= 0 ? ' checked' : '') + '> <span>' + esc(o.t) + '</span></label>'; }).join('') : '<p class="mini mudo">Sem opções nos avisos atuais.</p>') +
      '</div></details>');
  }
  function lerFormAvisos(form) {
    const fd = new FormData(form); const f = avisosPadrao(filtros.estado);
    Object.keys(f).forEach(function (k) { if (k === 'estado') return; if (MULTI_AVISOS.indexOf(k) >= 0) f[k] = fd.getAll(k); else f[k] = String(fd.get(k) || '').trim(); });
    f.sigiloso = fd.get('sigiloso') ? '1' : ''; f.custom = '';
    return f;
  }
  function opcoesDe(todos, campoV, campoT) {
    const m = {}; todos.forEach(function (a) { const v = a[campoV]; if (v == null || v === '') return; m[v] = campoT ? a[campoT] || v : v; });
    return Object.keys(m).sort(function (x, y) { return String(m[x]).localeCompare(String(m[y])); }).map(function (k) { return { v: k, t: String(m[k]) }; });
  }
  // Carrega os itens (PNCP) dos avisos que ainda não têm valores por item, para o filtro por item/grupo/lote.
  async function carregarValoresItens(lista, el) {
    const falta = lista.filter(function (a) { return !a.itensValores; });
    const alvo = falta.slice(0, 120); let feitos = 0, erros = 0;
    const box = el.querySelector('#progresso-captura');
    let i = 0;
    async function trab() {
      while (i < alvo.length) {
        const a = alvo[i++];
        try { const l = await PNCP.itens(a.cnpj, a.ano, a.seq); a.itensValores = Central.resumoItens(l); const me = l.filter(function (x) { return x.meEpp; }).length; a.meEpp = me === l.length && me ? 'Exclusivo ME/EPP' : me ? 'Parcial ME/EPP' : a.meEpp || ''; }
        catch (x) { erros++; }
        feitos++; if (box) progresso(box, 'Carregando valores dos itens no PNCP: ' + feitos + '/' + alvo.length, feitos / alvo.length);
      }
    }
    if (alvo.length) { await Promise.all([trab(), trab(), trab(), trab()]); Dados.salvar(); }
    const sem = falta.length - alvo.length + erros;
    notaItens = sem ? sem + ' aviso(s) ficaram fora do filtro por item porque os itens não foram carregados' + (erros ? ' (' + erros + ' falha(s) no PNCP; aplique de novo)' : ' (limite de 120 por vez; aplique de novo)') + '.' : '';
  }

  // ---------- abas ----------
  function telaAvisos(el) {
    if (!filtros) filtros = avisosPadrao();
    const todos = Object.keys(e().avisos).map(function (k) { return e().avisos[k]; });
    const f = filtros; const agora = Date.now();
    const base = todos.filter(function (a) {
      if (f.estado === 'lixeira') return a.lixeira;
      if (a.lixeira) return false;
      if (f.estado === 'naolidos' && a.lido) return false;
      if (f.estado === 'favoritos' && !a.favorito) return false;
      if (f.estado === 'orgaos' && e().orgaosFavoritos.indexOf(a.cnpj) < 0) return false;
      const fechado = a.encerramento && new Date(a.encerramento) < agora;
      if (f.situacao === 'abertos' && fechado && !a.favorito && f.estado !== 'lixeira') return false;
      if (f.situacao === 'encerrados' && !fechado) return false;
      return true;
    });
    const cond = Object.assign({}, f, { texto: '', cadastrados: cadastrados(), notaCapag: notaCapag });
    let l = Central.filtrarAvisos(base, cond);
    if (f.texto) l = l.filter(function (a) { return Central.casaConsulta(a.objeto + ' ' + (a.info || '') + ' ' + a.orgao + ' ' + (a.municipio || '') + ' ' + (a.produtos || []).join(' ') + ' ' + Telas.oport.texto(a.id), f.texto); });
    l.sort(function (a, b) {
      if (f.ordem === 'valor') return (b.valorEstimado || 0) - (a.valorEstimado || 0);
      if (f.ordem === 'publicacao') return new Date(b.publicacao) - new Date(a.publicacao);
      if (f.ordem === 'captura') return String(b.capturadoEm || '').localeCompare(String(a.capturadoEm || ''));
      return new Date(a.encerramento || '2999') - new Date(b.encerramento || '2999');
    });
    const naoLidos = todos.filter(function (a) { return !a.lido && !a.lixeira; }).length;
    const ativos = filtrosAtivos(f);
    const salvos = e().filtrosAvisos || [];
    const prods = {}; todos.forEach(function (a) { (a.produtos || []).forEach(function (p) { prods[p] = 1; }); });
    const muns = {}; todos.forEach(function (a) { if (a.municipio) muns[a.municipio] = a.municipio + '-' + (a.uf || ''); });
    const tabs = [{ v: 'todos', t: 'Todos os avisos' }, { v: 'naolidos', t: 'Não lidos', n: naoLidos }, { v: 'favoritos', t: 'Favoritos' }, { v: 'orgaos', t: 'Órgãos favoritos' }, { v: 'lixeira', t: 'Lixeira' }];
    el.innerHTML = '<div class="ma-abas" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" class="ma-aba' + (f.estado === t.v ? ' on' : '') + '" aria-selected="' + (f.estado === t.v) + '" data-a="estado" data-v="' + t.v + '">' + t.t + (t.n ? ' <span class="ma-n">' + t.n + '</span>' : '') + '</button>'; }).join('') + '</div>' +
      '<form class="ma" id="filtros" autocomplete="off">' +
      '<div class="ma-topo"><input type="search" name="texto" placeholder="Palavras no objeto, órgão ou anotações: papel a4; sulfite; -reciclado" title="Separe alternativas com ; e exclua com -" value="' + esc(f.texto) + '">' +
      '<select name="situacao" aria-label="Situação">' + opcoes([{ v: 'abertos', t: 'Recebendo propostas' }, { v: 'encerrados', t: 'Prazo encerrado' }, { v: 'todas', t: 'Qualquer situação' }], f.situacao) + '</select>' +
      '<select name="ordem" aria-label="Ordenar">' + opcoes([{ v: 'encerramento', t: 'Prazo mais próximo' }, { v: 'valor', t: 'Maior valor' }, { v: 'publicacao', t: 'Publicação mais recente' }, { v: 'captura', t: 'Enviado por último' }], f.ordem) + '</select>' +
      '<button type="button" class="btn' + (painelAvisosAberto ? ' ativo' : '') + '" data-a="painel" aria-expanded="' + painelAvisosAberto + '">⚲ Filtros' + (ativos ? ' <span class="ma-n">' + ativos + '</span>' : '') + '</button></div>' +
      '<div class="ma-painel"' + (painelAvisosAberto ? '' : ' hidden') + '><div class="ma-grade">' +
      multi('portais', 'Portal de captura', 'Sistema onde a licitação é operada (informado ao PNCP).', opcoesDe(todos.map(function (a) { return Object.assign({}, a, { sistema: a.sistema || 'Não informado' }); }), 'sistema'), f.portais) +
      cel('Cód. da licitação', 'Número da compra ou do processo.', '<input name="codigo" placeholder="Digite…" value="' + esc(f.codigo) + '">') +
      cel('UASG', 'Código ou nome da unidade compradora.', '<input name="uasg" placeholder="Digite…" value="' + esc(f.uasg) + '">') +
      cel('Nome do órgão', 'Nome, unidade ou CNPJ do órgão.', '<input name="orgao" placeholder="Digite…" value="' + esc(f.orgao) + '">') +
      multi('modalidades', 'Modalidade', '', opcoesDe(todos, 'modalidadeId', 'modalidade'), f.modalidades) +
      multi('esferas', 'Esferas', '', ESFERAS, f.esferas) +
      multi('ufs', 'Estado', '', opcoesDe(todos, 'uf'), f.ufs) +
      multi('municipios', 'Municípios', '', Object.keys(muns).sort().map(function (k) { return { v: k, t: muns[k] }; }), f.municipios) +
      cel('Data inicial', 'Abertura das propostas (de / até).', duasDatas('aberturaDe', 'aberturaAte', f), true) +
      cel('Data final', 'Fim do recebimento de propostas (de / até).', duasDatas('encerramentoDe', 'encerramentoAte', f), true) +
      cel('Data da publicação', 'Publicação no PNCP (de / até).', duasDatas('publicacaoDe', 'publicacaoAte', f), true) +
      cel('Enviado em', 'Quando o aviso chegou aos seus avisos (de / até).', duasDatas('enviadoDe', 'enviadoAte', f), true) +
      cel('ID PNCP', 'Número de controle do PNCP.', '<input name="id" placeholder="Digite…" value="' + esc(f.id) + '">') +
      multi('perfis', 'Perfil de busca', '', e().perfis.map(function (p) { return { v: p.id, t: p.nome }; }), f.perfis) +
      multi('palavras', 'Palavras-chave', 'Produtos do catálogo que casaram com o aviso.', Object.keys(prods).sort().map(function (p) { return { v: p, t: p }; }), f.palavras) +
      cel('Exclusivo ME/EPP', 'Aparece depois de abrir os Itens do aviso ou de filtrar por valor de item (o PNCP informa por item).', '<select name="meEpp">' + opcoes([{ v: '', t: 'Selecione' }, { v: 'exclusivo', t: 'Só exclusivos ME/EPP' }, { v: 'com', t: 'Com benefício ME/EPP' }, { v: 'sem', t: 'Sem benefício ME/EPP' }], f.meEpp) + '</select>') +
      cel('Enviado para cadastro', 'Se já existe proposta criada a partir do aviso.', '<select name="cadastro">' + opcoes([{ v: '', t: 'Selecione' }, { v: 'sim', t: 'Sim' }, { v: 'nao', t: 'Não' }], f.cadastro) + '</select>') +
      cel('Registro de preços', '', '<select name="srp">' + opcoes([{ v: '', t: 'Selecione' }, { v: 'so', t: 'Só SRP' }, { v: 'sem', t: 'Sem SRP' }], f.srp) + '</select>') +
      multi('capag', 'Nota CAPAG', 'Capacidade de pagamento do município (Tesouro Nacional). Importe a planilha em Mercado › CAPAG.', [{ v: 'A', t: 'A' }, { v: 'B', t: 'B' }, { v: 'C', t: 'C' }, { v: 'D', t: 'D' }, { v: 'sem', t: 'Sem nota / não municipal' }], f.capag) +
      cel('Valor total estimado', 'Valor estimado da licitação inteira.', '<div class="ma-faixa">' +
      '<input name="valorMin" inputmode="decimal" placeholder="Mín. R$" aria-label="Valor total estimado mínimo" value="' + esc(f.valorMin) + '">' +
      '<input name="valorMax" inputmode="decimal" placeholder="Máx. R$" aria-label="Valor total estimado máximo" value="' + esc(f.valorMax) + '">' +
      '<label class="check-inline"><input type="checkbox" name="sigiloso"' + (f.sigiloso ? ' checked' : '') + '> Só sigiloso</label></div>', true) +
      cel('Valor por item, grupo ou lote', 'Carrega os itens do PNCP e mostra o aviso se algum item (ou grupo/lote) estiver na faixa. Grupo/lote = soma dos itens do mesmo grupo; item sem grupo conta como lote próprio.', '<div class="ma-faixa">' +
      '<select name="valorAlvo" aria-label="Valor de">' + opcoes(ALVOS_VALOR, f.valorAlvo) + '</select>' +
      '<input name="itemMin" inputmode="decimal" placeholder="Mín. R$" aria-label="Valor mínimo do item, grupo ou lote" value="' + esc(f.itemMin) + '">' +
      '<input name="itemMax" inputmode="decimal" placeholder="Máx. R$" aria-label="Valor máximo do item, grupo ou lote" value="' + esc(f.itemMax) + '"></div>', true) +
      '<div class="ma-c largo"><span class="ma-r">Filtros customizados' + ajuda('Salve a combinação atual de filtros com um nome e reaplique com um clique.') + '</span><div class="ma-custom">' +
      '<select name="custom" aria-label="Filtro salvo"><option value="">Selecione</option>' + opcoes(salvos.map(function (x) { return { v: x.id, t: x.nome }; }), f.custom) + '</select>' +
      '<button type="button" class="btn" data-a="salvar-filtro">Salvar atual</button>' + (f.custom ? '<button type="button" class="btn fantasma perigo" data-a="apagar-filtro" title="Apagar filtro salvo">✕</button>' : '') + '</div></div>' +
      '</div><div class="ma-rodape"><button type="button" class="btn" data-a="limpar"' + (ativos || f.texto ? '' : ' disabled') + '>⊖ Limpar</button><button type="submit" class="btn primario">⊕ Aplicar</button></div></div>' +
      '</form>' +
      '<div class="barra-acoes"><div><b>' + l.length + '</b> aviso(s) · ' + naoLidos + ' não lido(s)</div>' +
      '<div class="grupo-botoes"><button class="btn" data-a="por-numero" title="Achar um edital pelo link ou número de controle do PNCP">＃ Por número</button><button class="btn" data-a="marcar-todos">Marcar todos lidos</button><button class="btn primario" data-a="capturar">⟳ Capturar agora</button></div></div>' +
      '<div id="progresso-captura"></div>' + (notaItens && f.valorAlvo ? '<p class="mini alerta">' + esc(notaItens) + '</p>' : '') +
      (l.length ? '<div class="avisos">' + l.slice(0, 200).map(function (a) { return cartaoAviso(a, f.estado); }).join('') + '</div>' + (l.length > 200 ? '<p class="mudo">Mostrando 200 de ' + l.length + '. Refine os filtros.</p>' : '') :
        !e().perfis.length ? UI.vazio('Comece pelo catálogo e pelo perfil de busca', 'Cadastre os produtos do cliente (O que vendo / Qual tipo / O que não vendo) e crie um perfil com estados e modalidades. Depois clique em Capturar agora.', '<a class="btn primario" href="#/encontrar/catalogos">Criar catálogo</a>') :
          UI.vazio('Nenhum aviso aqui', 'Clique em <b>Capturar agora</b> para consultar o PNCP com os seus perfis, ou ajuste os filtros.'));
    const form = el.querySelector('#filtros');
    const aplicar = async function () {
      const novo = lerFormAvisos(form); filtros = novo;
      if (novo.valorAlvo && (novo.itemMin || novo.itemMax)) {
        const semItem = Object.assign({}, novo, { valorAlvo: '', cadastrados: cadastrados(), notaCapag: notaCapag });
        await carregarValoresItens(Central.filtrarAvisos(base.length ? todos.filter(function (a) { return !a.lixeira || novo.estado === 'lixeira'; }) : [], semItem), el);
      } else notaItens = '';
      App.redesenhar();
    };
    form.onsubmit = function (ev) { ev.preventDefault(); aplicar(); };
    form.onchange = function (ev) {
      const t = ev.target;
      if (t.name === 'situacao' || t.name === 'ordem') { filtros[t.name] = t.value; App.redesenhar(); return; }
      if (t.name === 'custom') { const x = salvos.find(function (s) { return s.id === t.value; }); if (x) { filtros = Object.assign(avisosPadrao(filtros.estado), x.f, { estado: filtros.estado, custom: x.id }); App.redesenhar(); } return; }
      const d = t.closest('details.ms');
      if (d && t.type === 'checkbox') { const n = d.querySelectorAll('input[type=checkbox]:checked'); d.querySelector('summary').innerHTML = !n.length ? '<span class="mudo">Selecione</span>' : n.length === 1 ? esc(n[0].parentNode.textContent.trim()) : n.length + ' selecionados'; }
    };
    form.oninput = function (ev) {
      const t = ev.target;
      if (t.classList.contains('ms-busca')) { const q = Central.normalizar(t.value); t.parentNode.querySelectorAll('label').forEach(function (lb) { lb.hidden = q && Central.normalizar(lb.textContent).indexOf(q) < 0; }); }
    };
    form.onkeydown = function (ev) { if (ev.key === 'Enter' && ev.target.classList.contains('ms-busca')) ev.preventDefault(); };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'estado') { filtros.estado = b.dataset.v; App.redesenhar(); return; }
      if (a === 'painel') { painelAvisosAberto = !painelAvisosAberto; App.redesenhar(); return; }
      if (a === 'limpar') { filtros = avisosPadrao(filtros.estado); notaItens = ''; App.redesenhar(); return; }
      if (a === 'salvar-filtro') {
        const r = await modal({ titulo: 'Salvar filtro', botao: 'Salvar', corpo: campo('Nome do filtro', '<input name="nome" required placeholder="Ex.: Uniformes GO até R$ 80 mil">') });
        if (!r) return; const atual = lerFormAvisos(form); delete atual.estado; delete atual.custom;
        e().filtrosAvisos = e().filtrosAvisos || []; const id = Dados.id ? Dados.id() : String(Date.now());
        e().filtrosAvisos.push({ id: id, nome: r.get('nome').trim(), f: atual }); filtros = Object.assign(atual, { estado: filtros.estado, custom: id }); Dados.salvar(); aviso('Filtro salvo.'); App.redesenhar(); return;
      }
      if (a === 'apagar-filtro') { if (!(await confirmar('Apagar filtro', 'Apagar o filtro salvo?', 'Apagar'))) return; e().filtrosAvisos = (e().filtrosAvisos || []).filter(function (x) { return x.id !== filtros.custom; }); filtros.custom = ''; Dados.salvar(); App.redesenhar(); return; }
      if (a === 'capturar') { b.disabled = true; try { await capturar(null, el.querySelector('#progresso-captura')); } catch (err) { aviso('Falha na captura: ' + err.message, 'erro'); } App.redesenhar(); return; }
      if (a === 'marcar-todos') { l.forEach(function (x) { x.lido = true; }); Dados.salvar(); App.redesenhar(); return; }
      if (a === 'por-numero') { porNumero(); return; }
      if (b.closest('.aviso')) acaoAviso(b, l);
    };
  }
  function duasDatas(de, ate, f) { return '<div class="ma-datas"><input type="date" name="' + de + '" value="' + esc(f[de]) + '" aria-label="a partir de"><input type="date" name="' + ate + '" value="' + esc(f[ate]) + '" aria-label="até"></div>'; }

  // ---------- Busca de Licitações ----------
  const PORTAIS_BUSCA = ['Compras.gov.br', 'BLL', 'BNC', 'Licitanet', 'Portal de Compras Públicas', 'Licitações-e', 'Licitar Digital', 'Compras GO', 'Compras MG', 'PE Integrado', 'Publinexo'];
  let buscaFiltrosAbertos = true;
  function hojeISO(d) { const x = new Date(Date.now() + (d || 0) * 864e5); return new Date(x - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function buscaPadrao() { const emp = Dados.empresaAtiva(); return { texto: '', inteligente: false, situacao: 'abertas', portal: '', numero: '', minhas: false, aberturaDe: '', aberturaAte: '', encerramentoDe: '', encerramentoAte: '', publicacaoDe: '', publicacaoAte: '', esferas: [], modalidades: MODS_PADRAO.slice(), orgao: '', ufs: [emp && emp.uf ? emp.uf : 'GO'], cidades: '', valorMin: '', valorMax: '', sigiloso: false, meEpp: '', srp: '', ordem: 'encerramento' }; }
  function meusIds() { const ids = {}; Object.keys(e().avisos).forEach(function (k) { if (!e().avisos[k].lixeira) ids[k] = 1; }); e().propostas.forEach(function (p) { if (p.avisoId) ids[p.avisoId] = 1; }); e().monitor.forEach(function (m) { if (m.avisoId) ids[m.avisoId] = 1; }); return ids; }
  function lerFormBusca(form) {
    const fd = new FormData(form); const q = {};
    ['texto', 'situacao', 'portal', 'numero', 'aberturaDe', 'aberturaAte', 'encerramentoDe', 'encerramentoAte', 'publicacaoDe', 'publicacaoAte', 'orgao', 'cidades', 'valorMin', 'valorMax', 'meEpp', 'srp', 'ordem'].forEach(function (k) { q[k] = String(fd.get(k) || '').trim(); });
    q.inteligente = !!fd.get('inteligente'); q.minhas = fd.get('minhas') === 'sim'; q.sigiloso = !!fd.get('sigiloso');
    q.esferas = fd.getAll('esfera'); q.modalidades = fd.getAll('mod').map(Number); q.ufs = fd.getAll('uf');
    return q;
  }
  function aplicarBusca(r) {
    const q = r.q; const l = Central.filtrarBusca(r.bruto, Object.assign({}, q, { ids: q.minhas ? meusIds() : null }));
    l.sort(function (a, b) { if (q.ordem === 'valor') return (b.valorEstimado || 0) - (a.valorEstimado || 0); if (q.ordem === 'publicacao') return String(b.publicacao).localeCompare(String(a.publicacao)); return new Date(a.encerramento || '2999') - new Date(b.encerramento || '2999'); });
    r.lista = l; return r;
  }
  let ibgeBusca = null;
  function cidadesDatalist(ufs) {
    const montar = function () { const T = self.MunicipiosIBGE || {}; const dl = document.getElementById('bl-cidades'); if (!dl) return; dl.innerHTML = Object.keys(T).filter(function (k) { return !ufs.length || ufs.indexOf(T[k][1]) >= 0; }).slice(0, 3000).map(function (k) { return '<option value="' + esc(T[k][0]) + '">' + T[k][1] + '</option>'; }).join(''); };
    if (self.MunicipiosIBGE) return montar();
    ibgeBusca = ibgeBusca || new Promise(function (ok) { const sc = document.createElement('script'); sc.src = 'js/municipios-ibge.js'; sc.onload = ok; sc.onerror = ok; document.head.appendChild(sc); });
    ibgeBusca.then(montar);
  }
  function entreDatas(rot, de, ate, q) { return '<div class="bl-entre"><span>' + rot + '</span><div><input type="date" name="' + de + '" value="' + esc(q[de]) + '" aria-label="' + rot + ' a partir de"><input type="date" name="' + ate + '" value="' + esc(q[ate]) + '" aria-label="' + rot + ' até"></div></div>'; }
  function telaBanco(el) {
    const ultimo = bancoResultado; const q = ultimo ? ultimo.q : buscaPadrao();
    el.innerHTML = '<form class="cartao bl" id="busca">' +
      '<div class="bl-topo"><input type="search" name="texto" class="bl-q" placeholder="O que procura? ex.: papel a4; sulfite; -reciclado" value="' + esc(q.texto) + '" aria-label="Palavras da busca">' +
      '<button class="btn primario" data-bl="buscar">Buscar</button><button type="button" class="btn" data-bl="limpar">Limpar</button>' +
      '<label class="bl-switch" title="Acha as palavras em qualquer ordem, no singular ou no plural, também no órgão"><input type="checkbox" name="inteligente"' + (q.inteligente ? ' checked' : '') + '><i></i>Busca inteligente</label>' +
      '<button type="button" class="btn' + (buscaFiltrosAbertos ? ' ativo' : '') + '" data-bl="filtros" aria-expanded="' + buscaFiltrosAbertos + '">⚙ Filtros</button></div>' +
      '<p class="mini mudo bl-ajuda">Separe alternativas com <b>;</b> e exclua com <b>-</b> (ex.: <i>uniforme; jaleco; -escolar</i>). Sem palavras, traz tudo o que passar nos filtros.</p>' +
      '<div class="bl-filtros"' + (buscaFiltrosAbertos ? '' : ' hidden') + '><h3>Filtros de licitação</h3><div class="bl-grade">' +
      '<label class="bl-c"><span>Situação</span><select name="situacao">' + opcoes([{ v: 'abertas', t: 'Com proposta aberta' }, { v: 'publicadas', t: 'Publicadas no período' }], q.situacao) + '</select></label>' +
      '<label class="bl-c"><span>Portal</span><input name="portal" list="bl-portais" placeholder="Portal" value="' + esc(q.portal) + '"><datalist id="bl-portais">' + PORTAIS_BUSCA.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist></label>' +
      '<label class="bl-c"><span>Licitação</span><input name="numero" placeholder="Nº da licitação ou processo" value="' + esc(q.numero) + '"></label>' +
      '<div class="bl-c"><span>Somente minhas licitações?</span><div class="bl-seg" role="radiogroup"><label><input type="radio" name="minhas" value="nao"' + (q.minhas ? '' : ' checked') + '><b>Não</b></label><label><input type="radio" name="minhas" value="sim"' + (q.minhas ? ' checked' : '') + '><b>Sim</b></label></div></div>' +
      entreDatas('Data inicial (abertura)', 'aberturaDe', 'aberturaAte', q) + entreDatas('Data final (propostas até)', 'encerramentoDe', 'encerramentoAte', q) + entreDatas('Data de publicação', 'publicacaoDe', 'publicacaoAte', q) +
      '<label class="bl-c"><span>Órgão/UASG</span><input name="orgao" placeholder="Nome, CNPJ ou UASG" value="' + esc(q.orgao) + '"></label>' +
      '<label class="bl-c"><span>Cidades</span><input name="cidades" list="bl-cidades" placeholder="Catalão; Goiânia" value="' + esc(q.cidades) + '"><datalist id="bl-cidades"></datalist></label>' +
      '<label class="bl-c"><span>Valor estimado mínimo</span><input name="valorMin" inputmode="decimal" placeholder="R$" value="' + esc(q.valorMin) + '"></label>' +
      '<label class="bl-c"><span>Valor estimado máximo</span><input name="valorMax" inputmode="decimal" placeholder="R$" value="' + esc(q.valorMax) + '"></label>' +
      '<label class="bl-c"><span>ME/EPP</span><select name="meEpp">' + opcoes([{ v: '', t: 'Todas' }, { v: 'exclusivo', t: 'Só exclusivas ME/EPP' }, { v: 'com', t: 'Com benefício ME/EPP' }, { v: 'sem', t: 'Sem benefício' }], q.meEpp) + '</select></label>' +
      '<label class="bl-c"><span>Registro de preços</span><select name="srp">' + opcoes([{ v: '', t: 'Todas' }, { v: 'sem', t: 'Excluir registro de preços' }, { v: 'so', t: 'Só registro de preços' }], q.srp) + '</select></label>' +
      '<label class="bl-c bl-chk"><input type="checkbox" name="sigiloso"' + (q.sigiloso ? ' checked' : '') + '> Só valor sigiloso</label>' +
      '</div>' +
      '<fieldset><legend>Esferas</legend><div class="grade-checks">' + ESFERAS.map(function (x) { return '<label><input type="checkbox" name="esfera" value="' + x.v + '"' + (q.esferas.indexOf(x.v) >= 0 ? ' checked' : '') + '> ' + x.t + '</label>'; }).join('') + '</div></fieldset>' +
      '<fieldset><legend>Modalidade</legend><div class="grade-checks">' + Object.keys(PNCP.MODALIDADES).map(function (k) { return '<label><input type="checkbox" name="mod" value="' + k + '"' + (q.modalidades.map(String).indexOf(k) >= 0 ? ' checked' : '') + '> ' + esc(PNCP.MODALIDADES[k]) + '</label>'; }).join('') + '</div></fieldset>' +
      '<fieldset><legend>Estados</legend><div class="grade-checks">' + PNCP.UFS.map(function (u) { return '<label><input type="checkbox" name="uf" value="' + u + '"' + (q.ufs.indexOf(u) >= 0 ? ' checked' : '') + '> ' + u + '</label>'; }).join('') + '</div></fieldset>' +
      '<p class="mini mudo">O PNCP é consultado por estado e modalidade; os demais filtros são aplicados aqui. Muitos estados e modalidades deixam a consulta lenta.</p></div>' +
      '</form><div id="progresso-banco"></div><div id="resultado-banco">' + (ultimo ? resultadoBanco(ultimo) : '') + '</div>';
    const form = el.querySelector('#busca');
    cidadesDatalist(q.ufs);
    form.addEventListener('change', function (ev) { if (ev.target.name === 'uf') cidadesDatalist(lerFormBusca(form).ufs); if (ev.target.name === 'ordem') return; if (bancoResultado && !/^(uf|mod|situacao|publicacaoDe|publicacaoAte)$/.test(ev.target.name)) { bancoResultado.q = lerFormBusca(form); bancoResultado.q.ordem = (bancoResultado.q.ordem || bancoResultado.ordem || 'encerramento'); el.querySelector('#resultado-banco').innerHTML = resultadoBanco(aplicarBusca(bancoResultado)); } });
    form.onsubmit = async function (ev) {
      ev.preventDefault();
      const nq = lerFormBusca(form); nq.ordem = bancoResultado ? bancoResultado.q.ordem : 'encerramento';
      if (!nq.ufs.length) { aviso('Escolha ao menos um estado.', 'erro'); return; }
      if (!nq.modalidades.length) { aviso('Escolha ao menos uma modalidade.', 'erro'); return; }
      if (nq.situacao === 'publicadas' && (!nq.publicacaoDe || !nq.publicacaoAte)) { nq.publicacaoDe = nq.publicacaoDe || hojeISO(-30); nq.publicacaoAte = nq.publicacaoAte || hojeISO(0); form.publicacaoDe.value = nq.publicacaoDe; form.publicacaoAte.value = nq.publicacaoAte; aviso('Período de publicação: últimos 30 dias (ajuste se quiser).'); }
      const chave = JSON.stringify([nq.situacao, nq.ufs, nq.modalidades, nq.situacao === 'publicadas' ? [nq.publicacaoDe, nq.publicacaoAte] : null]);
      const btn = form.querySelector('[data-bl=buscar]'); btn.disabled = true;
      try {
        let bruto = bancoResultado && bancoResultado.chave === chave ? bancoResultado.bruto : null; let truncado = bancoResultado && bancoResultado.chave === chave ? bancoResultado.truncado : false;
        if (!bruto) {
          const prog = function (f, t) { progresso(el.querySelector('#progresso-banco'), f + '/' + t + ' consultas ao PNCP', f / t); };
          const r = nq.situacao === 'publicadas' ? await PNCP.publicadas({ ufs: nq.ufs, modalidades: nq.modalidades, inicio: nq.publicacaoDe, fim: nq.publicacaoAte }, prog) : await PNCP.propostasAbertas({ ufs: nq.ufs, modalidades: nq.modalidades }, prog);
          bruto = r.lista; truncado = r.truncado; pool = mesclar(pool, r.lista);
        }
        bancoResultado = aplicarBusca({ q: nq, chave: chave, bruto: bruto, total: bruto.length, truncado: truncado });
        el.querySelector('#progresso-banco').innerHTML = '';
        el.querySelector('#resultado-banco').innerHTML = resultadoBanco(bancoResultado);
      } catch (err) { aviso('Falha ao consultar o PNCP: ' + err.message, 'erro'); el.querySelector('#progresso-banco').innerHTML = ''; }
      btn.disabled = false;
    };
    el.onclick = function (ev) {
      const bl = ev.target.closest('[data-bl]');
      if (bl && bl.dataset.bl === 'filtros') { buscaFiltrosAbertos = !buscaFiltrosAbertos; el.querySelector('.bl-filtros').hidden = !buscaFiltrosAbertos; bl.classList.toggle('ativo', buscaFiltrosAbertos); bl.setAttribute('aria-expanded', buscaFiltrosAbertos); return; }
      if (bl && bl.dataset.bl === 'limpar') { bancoResultado = null; App.redesenhar(); return; }
      const b = ev.target.closest('.aviso [data-a]'); if (!b || !bancoResultado) return;
      acaoAviso(b, bancoResultado.lista);
    };
    el.querySelector('#resultado-banco').addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-a=criar-produto]'); if (!b) return;
      const c = Central.lerConsulta(bancoResultado.q.texto); if (!c.incluir.length) { aviso('Digite as palavras da busca para salvar como produto.', 'erro'); return; }
      Telas.encontrar.novoProdutoDe({ oQueVendo: c.incluir.join(', '), qualTipo: '', oQueNaoVendo: c.excluir.join(', ') });
    });
    el.querySelector('#resultado-banco').addEventListener('change', function (ev) { if (ev.target.name !== 'ordem-bl' || !bancoResultado) return; bancoResultado.q.ordem = ev.target.value; el.querySelector('#resultado-banco').innerHTML = resultadoBanco(aplicarBusca(bancoResultado)); });
  }

  function resultadoBanco(r) {
    return '<div class="barra-acoes"><div><b>' + r.lista.length + '</b> licitação(ões) encontrada(s), de ' + r.total + ' ' + (r.q.situacao === 'publicadas' ? 'publicadas no período' : 'com proposta aberta') + ' consultadas.' + (r.truncado ? ' <span class="alerta">Consulta truncada: restrinja estados ou modalidades.</span>' : '') + '</div>' +
      '<div class="grupo-botoes"><select name="ordem-bl" aria-label="Ordenar">' + opcoes([{ v: 'encerramento', t: 'Prazo mais próximo' }, { v: 'valor', t: 'Maior valor' }, { v: 'publicacao', t: 'Mais recentes' }], r.q.ordem || 'encerramento') + '</select><button class="btn" data-a="criar-produto">Salvar termos no catálogo</button></div></div>' +
      (r.lista.length ? '<div class="avisos">' + r.lista.slice(0, 150).map(function (a) { return cartaoAviso(a, 'banco'); }).join('') + '</div>' + (r.lista.length > 150 ? '<p class="mudo">Mostrando 150 de ' + r.lista.length + '. Refine os filtros.</p>' : '') : UI.vazio('Nada encontrado', 'Tente outras palavras, ligue a busca inteligente ou amplie os filtros.'));
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
        (l.length ? '<ul class="lista-previa">' + l.slice(0, 40).map(function (c) { return '<li><b>' + esc(c.uf) + '</b> · ' + esc(c.objeto.slice(0, 220)) + ' <a href="' + esc(UI.url(c.edital)) + '" target="_blank" rel="noopener">↗</a></li>'; }).join('') + '</ul>' : '<p>Nada casou. Afrouxe "Qual tipo" ou teste sinônimos no Banco de Licitações.</p>');
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
    titulo: 'Seven Radar',
    filtrarOrgao: function (nome) { filtros = Object.assign(avisosPadrao('todos'), { orgao: nome, situacao: 'todas' }); painelAvisosAberto = true; location.hash = '#/encontrar/avisos'; App.redesenhar(); },
    render: function (el, sub) {
      sub = sub || 'avisos';
      const naoLidos = Object.keys(e().avisos).filter(function (k) { return !e().avisos[k].lido && !e().avisos[k].lixeira; }).length;
      el.innerHTML = abas([{ id: 'avisos', t: 'Meus Avisos', n: naoLidos }, { id: 'banco', t: 'Busca de Licitações' }, { id: 'perfis', t: 'Perfis de Busca' }, { id: 'catalogos', t: 'Catálogo de Produtos' }], sub, 'encontrar') + '<div id="aba"></div>';
      const aba = el.querySelector('#aba');
      ({ avisos: telaAvisos, banco: telaBanco, busca: telaBanco, perfis: telaPerfis, catalogos: telaCatalogos }[sub] || telaAvisos)(aba);
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
