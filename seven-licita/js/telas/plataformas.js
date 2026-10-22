/* Músicas › Plataformas: busca no Deezer e na Apple Music (APIs públicas, sem login), conta do Spotify (OAuth com
   PKCE, com o Client ID do próprio usuário), player oficial embutido de cada serviço e links salvos de Spotify,
   Deezer, Apple Music, YouTube Music, SoundCloud e Amazon Music. Prévia de 30 s toca aqui; a música completa
   toca no player do serviço (com a conta do usuário logada nele). */
(function () {
  'use strict';
  const { esc, campo, opcoes, aviso } = UI;
  const P = self.Plataformas;
  const CHAVE_SP = 'seven-musica:spotify';
  const est = { aba: 'buscar', q: '', fonte: 'deezer', tipo: 'track', res: [], buscando: false, erro: '', ouvindo: null, spQ: '', spRes: null, spDados: null, spCarregando: false };
  const previa = new Audio(); previa.preload = 'none';
  let previaDe = null;

  function m() { const d = Dados.e; d.musicas = d.musicas || { faixas: [], playlists: [], externos: [], recentes: [], volume: 0.8 }; d.musicas.externos = d.musicas.externos || []; return d.musicas; }
  function sp() { try { return JSON.parse(localStorage.getItem(CHAVE_SP) || 'null') || {}; } catch (x) { return {}; } }
  function gravarSp(o) { try { localStorage.setItem(CHAVE_SP, JSON.stringify(o)); } catch (x) { aviso('Não foi possível guardar a conexão do Spotify neste navegador.', 'erro'); } }
  function redesenhar() { if (App.rota().tela === 'musicas' && /^(plataformas|externos)$/.test(App.rota().sub)) App.redesenhar(); }

  // ---------- busca pública ----------
  function jsonp(url) {
    return new Promise(function (ok, erro) {
      const cb = '__mu' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); const s = document.createElement('script');
      const fim = function () { delete window[cb]; s.remove(); clearTimeout(t); };
      const t = setTimeout(function () { fim(); erro(new Error('O Deezer não respondeu.')); }, 12000);
      window[cb] = function (j) { fim(); ok(j); };
      s.onerror = function () { fim(); erro(new Error('Sem acesso ao Deezer. Verifique a internet.')); };
      s.src = url(cb); document.head.appendChild(s);
    });
  }
  async function buscar() {
    if (!est.q.trim()) return;
    est.buscando = true; est.erro = ''; est.res = []; redesenhar();
    try {
      if (est.fonte === 'deezer') { const j = await jsonp(function (cb) { return P.urlBuscaDeezer(est.q, est.tipo, cb); }); if (j && j.error) throw new Error(j.error.message || 'Erro do Deezer'); est.res = P.deezerItens(j); }
      else { const r = await fetch(P.urlBuscaApple(est.q, est.tipo)); if (!r.ok) throw new Error('A Apple Music respondeu ' + r.status + '.'); est.res = P.appleItens(await r.json()); }
    } catch (x) { est.erro = x.message || String(x); }
    est.buscando = false; redesenhar();
  }

  // ---------- Spotify ----------
  function aleatorio(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return P.base64url(a); }
  async function conectarSpotify(clientId) {
    if (!window.crypto || !crypto.subtle) { aviso('Este navegador não permite o login seguro (abra o app por https).', 'erro'); return; }
    const verificador = aleatorio(48); const estado = aleatorio(12);
    const desafio = P.base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador))));
    const s = sp(); gravarSp(Object.assign(s, { clientId: clientId, verificador: verificador, estado: estado }));
    location.assign(P.urlAutorizarSpotify({ clientId: clientId, redirect: P.redirecionamento(location.href), desafio: desafio, estado: estado }));
  }
  async function pedirToken(corpo) {
    const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: corpo });
    const j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error_description || j.error || ('Spotify respondeu ' + r.status));
    return j;
  }
  // Volta do Spotify: ?code=…&state=… no endereço da página.
  async function retornoSpotify() {
    const q = new URLSearchParams(location.search); if (!q.get('state') || (!q.get('code') && !q.get('error'))) return;
    const s = sp(); if (q.get('state') !== s.estado) return;
    history.replaceState(null, '', P.redirecionamento(location.href) + '#/musicas/plataformas/spotify');
    if (q.get('error')) { delete s.verificador; delete s.estado; gravarSp(s); setTimeout(function () { aviso(q.get('error') === 'access_denied' ? 'Conexão com o Spotify cancelada.' : 'O Spotify recusou o login: ' + q.get('error'), 'erro'); }, 300); return; }
    try {
      const j = await pedirToken(P.corpoTokenSpotify({ codigo: q.get('code'), redirect: P.redirecionamento(location.href), clientId: s.clientId, verificador: s.verificador }));
      delete s.verificador; delete s.estado;
      gravarSp(Object.assign(s, { token: j.access_token, refresh: j.refresh_token || s.refresh, expira: Date.now() + (j.expires_in || 3600) * 1000 }));
      const eu = await api('/me'); const s2 = sp(); s2.nome = eu.display_name || eu.id; s2.produto = eu.product || ''; gravarSp(s2);
      aviso('Spotify conectado' + (s2.nome ? ' como ' + s2.nome : '') + '.');
    } catch (x) { aviso('Não foi possível conectar ao Spotify: ' + x.message, 'erro'); }
    est.aba = 'spotify'; est.spDados = null; redesenhar();
  }
  async function token() {
    const s = sp(); if (!s.token) throw new Error('Spotify não conectado.');
    if (!P.expirou(s)) return s.token;
    if (!s.refresh) throw new Error('A sessão do Spotify expirou. Conecte de novo.');
    const j = await pedirToken(P.corpoTokenSpotify({ refresh: s.refresh, clientId: s.clientId }));
    gravarSp(Object.assign(s, { token: j.access_token, refresh: j.refresh_token || s.refresh, expira: Date.now() + (j.expires_in || 3600) * 1000 }));
    return j.access_token;
  }
  async function api(caminho) {
    const r = await fetch('https://api.spotify.com/v1' + caminho, { headers: { Authorization: 'Bearer ' + await token() } });
    if (r.status === 401) { const s = sp(); s.expira = 0; gravarSp(s); }
    if (r.status === 403) throw new Error('O Spotify negou o acesso. No modo de desenvolvimento, só as contas cadastradas em User Management no painel do app entram.');
    if (!r.ok) throw new Error('Spotify respondeu ' + r.status + '.');
    return r.json();
  }
  async function carregarSpotify() {
    if (est.spCarregando) return; est.spCarregando = true;
    try {
      const [pls, albs] = await Promise.all([api('/me/playlists?limit=50'), api('/me/albums?limit=20')]);
      est.spDados = { playlists: P.spotifyLista(pls, 'playlist'), albuns: P.spotifyLista(albs, 'album') };
    } catch (x) { est.spDados = { erro: x.message }; }
    est.spCarregando = false; redesenhar();
  }
  async function buscarSpotify() {
    if (!est.spQ.trim()) return;
    try { const j = await api('/search?type=track,album,playlist&limit=10&market=BR&q=' + encodeURIComponent(est.spQ)); est.spRes = P.spotifyLista(j, 'track').concat(P.spotifyLista(j, 'album'), P.spotifyLista(j, 'playlist')); }
    catch (x) { est.spRes = []; aviso(x.message, 'erro'); }
    redesenhar();
  }

  // ---------- prévia e player embutido ----------
  function tocarPrevia(item, botao) {
    if (previaDe === item.previa && !previa.paused) { previa.pause(); return; }
    if (window.Player && Player.tocando && Player.tocando()) Player.alternar();
    previa.src = item.previa; previaDe = item.previa; previa.volume = m().volume == null ? 0.8 : m().volume;
    previa.play().catch(function () { aviso('O navegador bloqueou o áudio. Clique de novo.', 'erro'); });
    marcarPrevias();
  }
  function marcarPrevias() { document.querySelectorAll('[data-prev]').forEach(function (b) { const on = b.dataset.prev === previaDe && !previa.paused; b.textContent = on ? '❚❚' : '▶'; b.setAttribute('aria-label', (on ? 'Pausar' : 'Ouvir') + ' prévia de 30 segundos'); b.classList.toggle('on', on); }); }
  ['play', 'pause', 'ended'].forEach(function (e) { previa.addEventListener(e, marcarPrevias); });

  function ouvir(item) { if (!previa.paused) previa.pause(); est.ouvindo = { titulo: item.titulo + (item.artista ? ' · ' + item.artista : ''), ref: item.ref || P.reconhecer(item.link), link: item.link }; redesenhar(); const el = document.querySelector('.mu-agora'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  function salvar(item) {
    if (m().externos.some(function (x) { return x.url === item.link; })) { aviso('Já está nos seus salvos.'); return; }
    m().externos.unshift({ url: item.link, nome: item.titulo + (item.artista ? ' · ' + item.artista : ''), capa: item.capa || '', em: Date.now() }); Dados.salvar(); aviso('Salvo em Plataformas › Salvos.');
  }
  function iframe(ref, titulo) { return '<iframe src="' + esc(ref.embed) + '" height="' + ref.alt + '" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" title="' + esc(titulo) + '"></iframe>'; }
  function nomePlat(id) { const p = P.plataforma(id); return p ? p.nome : id; }

  // ---------- HTML ----------
  function itemHTML(it, i, lista) {
    const pl = P.plataforma(it.fonte);
    return '<li class="mu-res">' + (it.capa ? '<img class="mu-capa" src="' + esc(it.capa) + '" alt="" loading="lazy">' : '<span class="mu-capa mu-capa-v">♪</span>') +
      '<div class="mu-res-t"><b>' + esc(it.titulo) + '</b><small>' + esc([P.rotuloTipo(it.tipo), it.artista, it.album].filter(Boolean).join(' · ')) + (it.total ? ' · ' + it.total + ' faixas' : '') + '</small></div>' +
      '<span class="mu-res-d">' + esc(it.duracao || '') + '</span>' +
      '<div class="mu-res-ac">' + (it.previa ? '<button type="button" class="mu-prev" data-prev="' + esc(it.previa) + '" data-i="' + i + '" data-l="' + lista + '" aria-label="Ouvir prévia de 30 segundos" title="Prévia de 30 s">▶</button>' : '') +
      (it.ref && it.ref.embed ? '<button type="button" class="btn mini" data-ouvir="' + i + '" data-l="' + lista + '">Ouvir completo</button>' : '') +
      '<button type="button" class="btn mini" data-salvar="' + i + '" data-l="' + lista + '" title="Salvar">＋ Salvar</button>' +
      '<a class="btn mini" href="' + esc(UI.url(it.link)) + '" target="_blank" rel="noopener" title="Abrir no ' + esc(pl ? pl.nome : '') + '">↗</a></div></li>';
  }
  function plataformasHTML() {
    const s = sp();
    return '<div class="mu-plats">' + P.PLATAFORMAS.map(function (p) {
      const st = p.id === 'spotify' ? (s.token ? 'Conectado' + (s.nome ? ': ' + s.nome : '') : 'Conectar conta') : p.recursos;
      return '<a class="mu-plat' + (p.id === 'spotify' && s.token ? ' on' : '') + '" style="--plat:' + p.cor + '" href="' + (p.id === 'spotify' ? '#/musicas/plataformas/spotify' : p.id === 'deezer' || p.id === 'apple' ? '#/musicas/plataformas/buscar' : '#/musicas/plataformas/salvos') + '"' + (p.id === 'deezer' || p.id === 'apple' ? ' data-fonte="' + p.id + '"' : '') + '><i></i><b>' + esc(p.nome) + '</b><small>' + esc(st) + '</small></a>';
    }).join('') + '</div>';
  }
  function abaBuscar() {
    return '<form id="mu-busca-pl" class="mu-busca-pl"><input name="q" type="search" placeholder="Música, artista, álbum ou playlist" value="' + esc(est.q) + '" aria-label="Buscar nas plataformas" required>' +
      '<select name="fonte" aria-label="Plataforma">' + opcoes([{ v: 'deezer', t: 'Deezer' }, { v: 'apple', t: 'Apple Music' }], est.fonte) + '</select>' +
      '<select name="tipo" aria-label="Tipo">' + opcoes([{ v: 'track', t: 'Faixas' }, { v: 'album', t: 'Álbuns' }, { v: 'artist', t: 'Artistas' }].concat(est.fonte === 'deezer' ? [{ v: 'playlist', t: 'Playlists' }] : []), est.tipo) + '</select>' +
      '<button class="btn primario">Buscar</button></form>' +
      (est.buscando ? '<p class="mudo">Buscando no ' + nomePlat(est.fonte) + '…</p>' : est.erro ? '<p class="mu-erro">' + esc(est.erro) + '</p>' :
        est.res.length ? '<ul class="mu-resultados">' + est.res.map(function (it, i) { return itemHTML(it, i, 'res'); }).join('') + '</ul>' + '<p class="mudo mini">Prévias de 30 s fornecidas pelo ' + nomePlat(est.fonte) + '. A música completa toca no player oficial (com a sua conta logada no serviço) ou no app.</p>' :
        est.q ? '<p class="mudo">Nada encontrado no ' + nomePlat(est.fonte) + '.</p>' : '<p class="mudo">Busque no catálogo do Deezer ou da Apple Music sem sair da Plataforma 7: ouça a prévia, abra o player completo ou salve para depois.</p>');
  }
  function abaSpotify() {
    const s = sp(); const ret = P.redirecionamento(location.href);
    if (!s.token) {
      return '<div class="mu-sp-cfg"><h3>Conectar sua conta do Spotify</h3><p class="mudo">Com a conta conectada, suas playlists e álbuns salvos aparecem aqui e você busca no catálogo do Spotify. A música completa toca no player do Spotify (a conta precisa estar logada neste navegador; sem login, ele toca prévias).</p>' +
        '<ol><li>Entre em <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">developer.spotify.com/dashboard</a> e crie um app (Web API).</li>' +
        '<li>Em <b>Redirect URIs</b>, cadastre exatamente: <code class="mu-copiar" data-copiar="' + esc(ret) + '" title="Copiar">' + esc(ret) + '</code></li>' +
        '<li>Em <b>User Management</b>, cadastre o e-mail de cada pessoa da equipe que vai conectar (o app começa em modo de desenvolvimento).</li>' +
        '<li>Copie o <b>Client ID</b> do app e cole abaixo.</li></ol>' +
        (/^https:|^http:\/\/127\.0\.0\.1/.test(ret) ? '' : '<p class="mu-erro">O Spotify só aceita endereço com https (ou 127.0.0.1). Abra o app pelo domínio publicado para conectar.</p>') +
        '<form id="mu-sp-form" class="mu-busca-pl"><input name="cid" placeholder="Client ID" value="' + esc(s.clientId || '') + '" required pattern="[0-9a-fA-F]{32}" title="O Client ID tem 32 caracteres (0-9, a-f)" aria-label="Client ID do app do Spotify"><button class="btn primario">Conectar Spotify</button></form>' +
        '<p class="mudo mini">O login é feito no site do Spotify; a Plataforma 7 recebe só a permissão de ler suas playlists e biblioteca, guardada neste navegador.</p></div>';
    }
    if (!est.spDados && !est.spCarregando) carregarSpotify();
    const d = est.spDados;
    return '<div class="mu-sp-topo"><span class="mu-sp-on">● Conectado' + (s.nome ? ' como <b>' + esc(s.nome) + '</b>' : '') + (s.produto === 'premium' ? ' · Premium' : '') + '</span><button type="button" class="btn mini" data-sp="atualizar">Atualizar</button><button type="button" class="btn mini" data-sp="sair">Desconectar</button></div>' +
      '<form id="mu-sp-busca" class="mu-busca-pl"><input name="q" type="search" placeholder="Buscar no Spotify" value="' + esc(est.spQ) + '" aria-label="Buscar no Spotify" required><button class="btn primario">Buscar</button></form>' +
      (est.spRes ? '<h3>Resultados</h3>' + (est.spRes.length ? '<ul class="mu-resultados">' + est.spRes.map(function (it, i) { return itemHTML(it, i, 'spres'); }).join('') + '</ul>' : '<p class="mudo">Nada encontrado.</p>') : '') +
      (!d ? '<p class="mudo">Carregando sua biblioteca…</p>' : d.erro ? '<p class="mu-erro">' + esc(d.erro) + '</p>' :
        '<h3>Suas playlists</h3>' + (d.playlists.length ? '<ul class="mu-resultados">' + d.playlists.map(function (it, i) { return itemHTML(it, i, 'sppl'); }).join('') + '</ul>' : '<p class="mudo">Nenhuma playlist.</p>') +
        '<h3>Álbuns salvos</h3>' + (d.albuns.length ? '<ul class="mu-resultados">' + d.albuns.map(function (it, i) { return itemHTML(it, i, 'spal'); }).join('') + '</ul>' : '<p class="mudo">Nenhum álbum salvo.</p>'));
  }
  function abaSalvos() {
    const l = m().externos;
    return '<form id="mu-ext" class="mu-busca-pl"><input name="u" required placeholder="Cole um link do Spotify, Deezer, Apple Music, YouTube Music, SoundCloud ou Amazon Music" aria-label="Link da plataforma"><input name="n" placeholder="Nome (opcional)" aria-label="Nome"><button class="btn primario">Adicionar</button></form>' +
      (l.length ? '<div class="mu-ext">' + l.map(function (x, i) {
        const r = P.reconhecer(x.url) || {}; const nome = x.nome || nomePlat(r.plataforma);
        return '<section class="cartao"><header><h3>' + esc(nome) + '</h3><span class="tag claro">' + esc(nomePlat(r.plataforma) + ' · ' + P.rotuloTipo(r.tipo)) + '</span><a class="icone" href="' + esc(UI.url(r.abrir || x.url)) + '" target="_blank" rel="noopener" aria-label="Abrir no ' + esc(nomePlat(r.plataforma)) + '" title="Abrir no app">↗</a><button class="icone" data-del="' + i + '" aria-label="Remover">×</button></header>' +
          (r.embed ? iframe(r, nome) + '<p class="mu-fora mini">Não tocou? Abra direto no <a href="' + esc(UI.url(r.abrir || x.url)) + '" target="_blank" rel="noopener">' + esc(nomePlat(r.plataforma)) + ' ↗</a>. Para ouvir a música inteira, entre na sua conta do ' + esc(nomePlat(r.plataforma)) + ' neste navegador.</p>' : '<p class="mudo">O ' + esc(nomePlat(r.plataforma)) + ' não permite tocar dentro de outros sites. <a href="' + esc(UI.url(r.abrir || x.url)) + '" target="_blank" rel="noopener">Abrir no ' + esc(nomePlat(r.plataforma)) + ' ↗</a></p>') + '</section>';
      }).join('') + '</div>' : '<p class="mudo">Salve aqui playlists, álbuns e faixas de qualquer plataforma. Os da busca e do Spotify também vêm para cá.</p>');
  }

  function tela(el, aba) {
    if (aba === 'buscar' || aba === 'spotify' || aba === 'salvos') est.aba = aba;
    const abas = [['buscar', 'Buscar'], ['spotify', 'Spotify'], ['salvos', 'Salvos (' + m().externos.length + ')']];
    el.innerHTML = '<h2>Plataformas</h2>' + plataformasHTML() +
      (est.ouvindo ? '<section class="mu-agora"><header><b>Tocando no ' + esc(nomePlat(est.ouvindo.ref.plataforma)) + '</b><span>' + esc(est.ouvindo.titulo) + '</span><a class="icone" href="' + esc(UI.url(est.ouvindo.link)) + '" target="_blank" rel="noopener" aria-label="Abrir no app" title="Abrir no app">↗</a><button class="icone" data-fechar-agora aria-label="Fechar player">×</button></header>' + iframe(est.ouvindo.ref, est.ouvindo.titulo) + '<p class="mu-fora mini">Não tocou? <a href="' + esc(UI.url(est.ouvindo.link)) + '" target="_blank" rel="noopener">Abrir no ' + esc(nomePlat(est.ouvindo.ref.plataforma)) + ' ↗</a></p></section>' : '') +
      '<nav class="mu-abas" role="tablist">' + abas.map(function (a) { return '<a role="tab" href="#/musicas/plataformas/' + a[0] + '" aria-selected="' + (est.aba === a[0]) + '" class="' + (est.aba === a[0] ? 'ativa' : '') + '">' + a[1] + '</a>'; }).join('') + '</nav>' +
      '<div class="mu-aba">' + (est.aba === 'spotify' ? abaSpotify() : est.aba === 'salvos' ? abaSalvos() : abaBuscar()) + '</div>';
    marcarPrevias();
    const lista = function (b) { return { res: est.res, spres: est.spRes || [], sppl: (est.spDados || {}).playlists || [], spal: (est.spDados || {}).albuns || [] }[b.dataset.l][Number(b.dataset.i != null ? b.dataset.i : b.dataset.ouvir != null ? b.dataset.ouvir : b.dataset.salvar)]; };
    el.onsubmit = function (ev) {
      const f = ev.target; const fd = new FormData(f); ev.preventDefault();
      if (f.id === 'mu-busca-pl') { est.q = String(fd.get('q')); est.fonte = String(fd.get('fonte')); est.tipo = est.fonte === 'apple' && fd.get('tipo') === 'playlist' ? 'track' : String(fd.get('tipo')); buscar(); }
      if (f.id === 'mu-sp-form') conectarSpotify(String(fd.get('cid')).trim());
      if (f.id === 'mu-sp-busca') { est.spQ = String(fd.get('q')); buscarSpotify(); }
      if (f.id === 'mu-ext') {
        const u = String(fd.get('u')).trim(); const r = P.reconhecer(u);
        if (r && r.curto) { aviso('Esse é um link curto do Deezer. Abra-o no navegador e copie o endereço completo (deezer.com/…).', 'erro'); return; }
        if (!r) { aviso('Link não reconhecido. Use links do Spotify, Deezer, Apple Music, YouTube Music, SoundCloud ou Amazon Music.', 'erro'); return; }
        m().externos.unshift({ url: u, nome: String(fd.get('n') || '').trim(), em: Date.now() }); Dados.salvar(); App.redesenhar();
      }
    };
    el.onchange = function (ev) { if (ev.target.name === 'fonte' && ev.target.form && ev.target.form.id === 'mu-busca-pl') { est.fonte = ev.target.value; if (est.fonte === 'apple' && est.tipo === 'playlist') est.tipo = 'track'; est.q = ev.target.form.q.value; App.redesenhar(); } };
    el.onclick = function (ev) {
      const b = ev.target.closest('button, [data-copiar], a[data-fonte]'); if (!b) return;
      if (b.dataset.fonte) { est.fonte = b.dataset.fonte; if (est.fonte === 'apple' && est.tipo === 'playlist') est.tipo = 'track'; return; }
      if (b.dataset.copiar) { navigator.clipboard && navigator.clipboard.writeText(b.dataset.copiar).then(function () { aviso('Endereço copiado.'); }, function () { }); return; }
      if (b.dataset.prev) { tocarPrevia(lista(b), b); return; }
      if (b.dataset.ouvir != null) { ouvir(lista(b)); return; }
      if (b.dataset.salvar != null) { salvar(lista(b)); return; }
      if (b.dataset.del != null) { m().externos.splice(Number(b.dataset.del), 1); Dados.salvar(); App.redesenhar(); return; }
      if (b.hasAttribute('data-fechar-agora')) { est.ouvindo = null; App.redesenhar(); return; }
      if (b.dataset.sp === 'sair') { const s = sp(); gravarSp({ clientId: s.clientId }); est.spDados = null; est.spRes = null; aviso('Spotify desconectado neste navegador.'); App.redesenhar(); return; }
      if (b.dataset.sp === 'atualizar') { est.spDados = null; App.redesenhar(); }
    };
  }

  Telas.musicas.telaPlataformas = tela;
  Telas.musicas.pararPrevia = function () { if (!previa.paused) previa.pause(); };
  retornoSpotify();
})();
