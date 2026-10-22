/* Músicas: biblioteca, playlists e plataformas (Spotify, Deezer, Apple Music, YouTube Music…), no estilo de um app de streaming. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, modal, confirmar, aviso } = UI;
  const CORES = ['#b68d40', '#1f7a4a', '#2f7be0', '#7a55c7', '#d9559a', '#d94b3f', '#e8892e', '#127a64'];
  const est = { busca: '', ordem: 'adicionada' };

  function m() { const d = Dados.e; d.musicas = d.musicas || { faixas: [], playlists: [], externos: [], recentes: [], volume: 0.8 }; return d.musicas; }
  function faixa(id) { return m().faixas.find(function (f) { return f.id === id; }); }
  function playlist(id) { return m().playlists.find(function (p) { return p.id === id; }); }
  function salvar() { Dados.salvar(); }
  function duracaoTotal(ids) { const s = ids.reduce(function (t, id) { const f = faixa(id); return t + (f && f.duracao || 0); }, 0); const h = Math.floor(s / 3600), mi = Math.round((s % 3600) / 60); return (h ? h + ' h ' : '') + mi + ' min'; }

  async function enviar(arquivos, playlistId) {
    let k = 0;
    for (const arq of arquivos) {
      if (!/^audio\//.test(arq.type) && !/\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i.test(arq.name)) continue;
      const id = Dados.id('mu'); await Dados.guardarArquivo(id, arq);
      let meta = {}; try { meta = Player.lerID3(await arq.slice(0, Math.min(arq.size, 2 * 1024 * 1024)).arrayBuffer()); } catch (err) { /* sem tags */ }
      const nome = Player.doNome(arq.name); let capa = '';
      if (meta.capa) { capa = Dados.id('muc'); await Dados.guardarArquivo(capa, new Blob([meta.capa.dados], { type: meta.capa.mime })); }
      const f = { id: Dados.id('fx'), arquivo: id, titulo: meta.titulo || nome.titulo, artista: meta.artista || nome.artista || '', album: meta.album || '', capa: capa, adicionadaEm: new Date().toISOString(), tamanho: arq.size };
      m().faixas.push(f); if (playlistId) playlist(playlistId).faixas.push(f.id); k++;
      // duração em segundo plano
      const a = new Audio(); a.preload = 'metadata'; a.src = URL.createObjectURL(arq); a.onloadedmetadata = function () { f.duracao = a.duration; URL.revokeObjectURL(a.src); salvar(); };
    }
    salvar(); aviso(k ? k + ' música(s) adicionadas.' : 'Nenhum arquivo de áudio reconhecido.', k ? '' : 'erro'); App.redesenhar();
  }

  function capaHTML(f, cls) { return f && f.capa ? '<img class="' + (cls || 'mu-capa') + '" data-capa="' + f.id + '" alt="">' : '<span class="' + (cls || 'mu-capa') + ' vazia">♪</span>'; }
  function carregarCapas(el) { el.querySelectorAll('img[data-capa]').forEach(async function (img) { const u = await Player.urlCapa(faixa(img.dataset.capa)); if (u) img.src = u; }); }

  function tabela(ids, contexto) {
    if (!ids.length) return '<p class="mudo">Nenhuma música aqui ainda.</p>';
    const tocando = Player.atual() && Player.atual().id;
    return '<table class="mu-tabela"><thead><tr><th>#</th><th>Título</th><th>Álbum</th><th></th><th class="n">⏱</th><th></th></tr></thead><tbody>' + ids.map(function (id, i) {
      const f = faixa(id); if (!f) return '';
      return '<tr data-i="' + i + '" data-id="' + f.id + '" class="' + (f.id === tocando ? 'tocando' : '') + '"><td class="mu-n"><span>' + (f.id === tocando && Player.tocando() ? '♫' : i + 1) + '</span><button class="mu-mini-play" data-tocar="' + i + '" aria-label="Tocar">▶</button></td><td><div class="mu-tit">' + capaHTML(f) + '<div><b>' + esc(f.titulo) + '</b><small>' + esc(f.artista || 'Artista desconhecido') + '</small></div></div></td><td class="mudo">' + esc(f.album || '') + '</td><td><button class="icone mu-curtir ' + (f.curtida ? 'on' : '') + '" data-curtir="' + f.id + '" aria-label="Curtir">♥</button></td><td class="n mudo">' + Player.tempo(f.duracao) + '</td><td><button class="icone" data-menu="' + f.id + '" aria-label="Mais opções">⋯</button></td></tr>';
    }).join('') + '</tbody></table>';
  }

  function ligarTabela(el, ids, contexto) {
    el.querySelectorAll('.mu-tabela tbody tr').forEach(function (tr) { tr.ondblclick = function () { Player.tocarFila(ids, Number(tr.dataset.i)); }; });
    el.addEventListener('click', async function (ev) {
      const t = ev.target.closest('[data-tocar]'); if (t) { Player.tocarFila(ids, Number(t.dataset.tocar)); return; }
      const c = ev.target.closest('[data-curtir]'); if (c) { const f = faixa(c.dataset.curtir); f.curtida = !f.curtida; salvar(); App.redesenhar(); return; }
      const mn = ev.target.closest('[data-menu]'); if (mn) await menuFaixa(faixa(mn.dataset.menu), contexto);
    });
  }

  async function menuFaixa(f, contexto) {
    const pls = m().playlists;
    const r = await modal({ titulo: f.titulo, botao: false, corpo: '<div class="n-menu"><button type="button" class="btn" data-o="seguinte">Tocar em seguida</button><button type="button" class="btn" data-o="fila">Adicionar à fila</button>' + pls.map(function (p) { return '<button type="button" class="btn" data-o="pl:' + p.id + '">Adicionar a "' + esc(p.nome) + '"</button>'; }).join('') + '<button type="button" class="btn" data-o="nova-pl">Adicionar a uma nova playlist</button>' + (contexto && contexto.indexOf('pl:') === 0 ? '<button type="button" class="btn" data-o="tirar">Remover desta playlist</button>' : '') + '<button type="button" class="btn" data-o="editar">Editar informações</button><button type="button" class="btn" data-o="baixar">Baixar</button><button type="button" class="btn perigo" data-o="excluir">Excluir da biblioteca</button></div>',
      aoAbrir: function (form) { form.addEventListener('click', async function (ev) {
        const b = ev.target.closest('[data-o]'); if (!b) return; form.closest('.modal-fundo').remove(); const o = b.dataset.o;
        if (o === 'seguinte') Player.adicionarFila(f.id, true); if (o === 'fila') Player.adicionarFila(f.id, false);
        if (o.indexOf('pl:') === 0) { const p = playlist(o.slice(3)); if (p.faixas.indexOf(f.id) < 0) { p.faixas.push(f.id); salvar(); aviso('Adicionada a "' + p.nome + '".'); } }
        if (o === 'nova-pl') { const p = await novaPlaylist(); if (p) { p.faixas.push(f.id); salvar(); } }
        if (o === 'tirar') { const p = playlist(contexto.slice(3)); p.faixas = p.faixas.filter(function (x) { return x !== f.id; }); salvar(); App.redesenhar(); }
        if (o === 'editar') { const e2 = await modal({ titulo: 'Editar informações', corpo: campo('Título', '<input name="t" value="' + esc(f.titulo) + '">') + campo('Artista', '<input name="a" value="' + esc(f.artista || '') + '">') + campo('Álbum', '<input name="al" value="' + esc(f.album || '') + '">') }); if (e2) { f.titulo = e2.get('t'); f.artista = e2.get('a'); f.album = e2.get('al'); salvar(); App.redesenhar(); } }
        if (o === 'baixar') { const bl = await Dados.lerArquivo(f.arquivo); if (bl) UI.baixar(f.titulo + '.mp3', bl); }
        if (o === 'excluir' && await confirmar('Excluir música', 'Excluir "' + esc(f.titulo) + '" da biblioteca e de todas as playlists?', 'Excluir')) { Dados.apagarArquivo(f.arquivo); if (f.capa) Dados.apagarArquivo(f.capa); m().faixas = m().faixas.filter(function (x) { return x !== f; }); m().playlists.forEach(function (p) { p.faixas = p.faixas.filter(function (x) { return x !== f.id; }); }); salvar(); App.redesenhar(); }
      }); } });
    void r;
  }

  async function novaPlaylist() {
    const r = await modal({ titulo: 'Criar playlist', corpo: campo('Nome', '<input name="n" required value="Minha playlist nº ' + (m().playlists.length + 1) + '">') + campo('Descrição', '<input name="d" placeholder="ex.: Foco para cadastrar propostas">'), botao: 'Criar' });
    if (!r) return null;
    const p = { id: Dados.id('pl'), nome: r.get('n'), descricao: r.get('d'), faixas: [], cor: CORES[m().playlists.length % CORES.length], criadaEm: new Date().toISOString() };
    m().playlists.push(p); salvar(); return p;
  }

  function cabecalho(titulo, sub, cor, ids, extra) {
    return '<header class="mu-cab" style="background:linear-gradient(180deg,' + cor + ',transparent)"><div class="mu-cab-capa" style="background:' + cor + '">' + (titulo === 'Músicas curtidas' ? '♥' : '♪') + '</div><div><small>' + esc(sub) + '</small><h2>' + esc(titulo) + '</h2><p class="mini">' + ids.length + ' música(s) · ' + duracaoTotal(ids) + '</p></div></header>' +
      '<div class="mu-acoes"><button class="mu-play-grande" data-play-tudo aria-label="Tocar">▶</button><button class="icone mu-shuffle" data-shuffle aria-label="Tocar em ordem aleatória" title="Aleatório">⤮</button>' + (extra || '') + '</div>';
  }

  function telaInicio(el) {
    const f = m().faixas; const rec = (m().recentes || []).map(faixa).filter(Boolean).slice(0, 8);
    const hora = new Date().getHours(); const saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    el.innerHTML = '<h2 class="mu-saud">' + saud + '</h2>' +
      '<div class="mu-atalhos"><a href="#/musicas/curtidas" class="mu-atalho"><span style="background:linear-gradient(135deg,#5b3fa0,#b68d40)">♥</span>Músicas curtidas</a>' + m().playlists.slice(0, 5).map(function (p) { return '<a href="#/musicas/playlist/' + p.id + '" class="mu-atalho"><span style="background:' + p.cor + '">♪</span>' + esc(p.nome) + '</a>'; }).join('') + '</div>' +
      (rec.length ? '<h3>Tocadas recentemente</h3><div class="mu-cards">' + rec.map(function (x) { return '<button class="mu-card" data-rec="' + x.id + '">' + capaHTML(x, 'mu-card-capa') + '<b>' + esc(x.titulo) + '</b><small>' + esc(x.artista || '') + '</small></button>'; }).join('') + '</div>' : '') +
      (m().playlists.length ? '<h3>Suas playlists</h3><div class="mu-cards">' + m().playlists.map(function (p) { return '<a class="mu-card" href="#/musicas/playlist/' + p.id + '"><span class="mu-card-capa" style="background:' + p.cor + '">♪</span><b>' + esc(p.nome) + '</b><small>' + p.faixas.length + ' música(s)</small></a>'; }).join('') + '</div>' : '') +
      (!f.length ? '<div class="mu-vazio"><h3>Monte sua trilha de trabalho</h3><p>Envie arquivos de música (MP3, M4A, OGG, WAV, FLAC) do seu computador; o título, o artista e a capa são lidos das tags. Ou ouça Spotify, Deezer, Apple Music, YouTube Music e SoundCloud em <a href="#/musicas/plataformas"><b>Plataformas</b></a>.</p><button class="btn primario" data-enviar>Enviar músicas</button></div>' : '');
    carregarCapas(el);
    el.onclick = function (ev) { const r = ev.target.closest('[data-rec]'); if (r) { const ids = rec.map(function (x) { return x.id; }); Player.tocarFila(ids, ids.indexOf(r.dataset.rec)); } if (ev.target.closest('[data-enviar]')) document.getElementById('mu-up').click(); };
  }

  function telaBiblioteca(el) {
    let ids = m().faixas.slice();
    if (est.busca) { const t = Nucleo.normalizar(est.busca); ids = ids.filter(function (f) { return Nucleo.normalizar(f.titulo + ' ' + f.artista + ' ' + f.album).indexOf(t) >= 0; }); }
    ids.sort(function (a, b) { if (est.ordem === 'titulo') return a.titulo.localeCompare(b.titulo, 'pt-BR'); if (est.ordem === 'artista') return (a.artista || '').localeCompare(b.artista || '', 'pt-BR'); if (est.ordem === 'tocadas') return (b.plays || 0) - (a.plays || 0); return new Date(b.adicionadaEm) - new Date(a.adicionadaEm); });
    ids = ids.map(function (f) { return f.id; });
    el.innerHTML = cabecalho('Sua biblioteca', 'Todas as músicas', '#3a2a10', ids, '<form id="mu-busca" class="mu-busca"><input type="search" name="q" placeholder="O que você quer ouvir?" value="' + esc(est.busca) + '"></form><select id="mu-ordem">' + UI.opcoes([{ v: 'adicionada', t: 'Adicionadas recentemente' }, { v: 'titulo', t: 'Título' }, { v: 'artista', t: 'Artista' }, { v: 'tocadas', t: 'Mais tocadas' }], est.ordem) + '</select><button class="btn" data-enviar>+ Enviar músicas</button>') + tabela(ids, 'biblioteca');
    carregarCapas(el); ligarTabela(el, ids, 'biblioteca'); ligarCab(el, ids);
    el.querySelector('#mu-busca').oninput = function () { est.busca = this.q.value; clearTimeout(this._t); this._t = setTimeout(function () { App.redesenhar(); const i = document.querySelector('#mu-busca input'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    el.querySelector('#mu-busca').onsubmit = function (e) { e.preventDefault(); };
    el.querySelector('#mu-ordem').onchange = function () { est.ordem = this.value; App.redesenhar(); };
  }

  function ligarCab(el, ids) {
    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-play-tudo]')) { if (ids.length) Player.tocarFila(ids, 0); }
      if (ev.target.closest('[data-shuffle]')) { if (ids.length) { const embaralhado = ids.slice().sort(function () { return Math.random() - 0.5; }); Player.tocarFila(embaralhado, 0); } }
      if (ev.target.closest('[data-enviar]')) document.getElementById('mu-up').click();
    });
  }

  function telaCurtidas(el) { const ids = m().faixas.filter(function (f) { return f.curtida; }).map(function (f) { return f.id; }); el.innerHTML = cabecalho('Músicas curtidas', 'Playlist', '#5b3fa0', ids) + tabela(ids, 'curtidas'); carregarCapas(el); ligarTabela(el, ids, 'curtidas'); ligarCab(el, ids); }

  function telaPlaylist(el, id) {
    const p = playlist(id); if (!p) { el.innerHTML = UI.vazio('Playlist não encontrada', '', '<a class="btn" href="#/musicas">Voltar</a>'); return; }
    p.faixas = p.faixas.filter(faixa);
    el.innerHTML = cabecalho(p.nome, 'Playlist' + (p.descricao ? ' · ' + p.descricao : ''), p.cor, p.faixas, '<button class="btn" data-add>+ Adicionar músicas</button><button class="btn fantasma" data-renomear>Editar</button><button class="btn fantasma perigo" data-excluir>Excluir playlist</button>') + tabela(p.faixas, 'pl:' + p.id);
    carregarCapas(el); ligarTabela(el, p.faixas, 'pl:' + p.id); ligarCab(el, p.faixas);
    // reordenar arrastando as linhas
    let arr = null;
    el.querySelectorAll('.mu-tabela tbody tr').forEach(function (tr) { tr.draggable = true; tr.addEventListener('dragstart', function () { arr = Number(tr.dataset.i); }); tr.addEventListener('dragover', function (ev) { ev.preventDefault(); }); tr.addEventListener('drop', function (ev) { ev.preventDefault(); const para = Number(tr.dataset.i); if (arr == null || arr === para) return; const x = p.faixas.splice(arr, 1)[0]; p.faixas.splice(para, 0, x); salvar(); App.redesenhar(); }); });
    el.addEventListener('click', async function (ev) {
      if (ev.target.closest('[data-add]')) {
        const fora = m().faixas.filter(function (f) { return p.faixas.indexOf(f.id) < 0; });
        if (!fora.length) { aviso('Todas as músicas da biblioteca já estão nesta playlist. Envie novas músicas.', 'erro'); return; }
        const r = await modal({ titulo: 'Adicionar a ' + p.nome, corpo: '<div class="mu-escolher">' + fora.map(function (f) { return '<label class="check"><input type="checkbox" name="f" value="' + f.id + '"> ' + esc(f.titulo) + ' <small class="mudo">' + esc(f.artista || '') + '</small></label>'; }).join('') + '</div>', botao: 'Adicionar' });
        if (r) { r.getAll('f').forEach(function (x) { p.faixas.push(x); }); salvar(); App.redesenhar(); }
      }
      if (ev.target.closest('[data-renomear]')) { const r = await modal({ titulo: 'Editar playlist', corpo: campo('Nome', '<input name="n" value="' + esc(p.nome) + '">') + campo('Descrição', '<input name="d" value="' + esc(p.descricao || '') + '">') + '<div class="n-cores">' + CORES.map(function (c) { return '<label><input type="radio" name="c" value="' + c + '"' + (p.cor === c ? ' checked' : '') + '><span style="background:' + c + '"></span></label>'; }).join('') + '</div>' }); if (r) { p.nome = r.get('n'); p.descricao = r.get('d'); p.cor = r.get('c') || p.cor; salvar(); App.redesenhar(); } }
      if (ev.target.closest('[data-excluir]') && await confirmar('Excluir playlist', 'Excluir "' + esc(p.nome) + '"? As músicas continuam na biblioteca.', 'Excluir')) { m().playlists = m().playlists.filter(function (x) { return x !== p; }); salvar(); location.hash = '#/musicas'; }
    });
  }

  // Link de plataforma → player oficial embutido (mantido para quem chama Telas.musicas.embed).
  function embed(u) { const r = Plataformas.reconhecer(u); return r && r.embed ? { tipo: Plataformas.plataforma(r.plataforma).nome, url: r.embed, alt: r.alt } : null; }

  Telas.musicas = {
    titulo: 'Músicas',
    render: function (el, sub, param) {
      el.onclick = null;
      const nav = [['', '⌂ Início'], ['biblioteca', '♫ Sua biblioteca'], ['curtidas', '♥ Curtidas'], ['plataformas', '🎧 Plataformas']];
      el.innerHTML = '<div class="musicas"><aside class="mu-lado"><nav>' + nav.map(function (x) { return '<a href="#/musicas' + (x[0] ? '/' + x[0] : '') + '" class="' + ((sub === 'externos' ? 'plataformas' : sub || '') === x[0] ? 'ativa' : '') + '">' + x[1] + '</a>'; }).join('') + '</nav><div class="mu-pls"><header><b>Playlists</b><button class="icone" data-nova-pl aria-label="Criar playlist" title="Criar playlist">＋</button></header>' + m().playlists.map(function (p) { return '<a href="#/musicas/playlist/' + p.id + '" class="' + (sub === 'playlist' && param === p.id ? 'ativa' : '') + '"><i style="background:' + p.cor + '"></i>' + esc(p.nome) + '</a>'; }).join('') + '</div><button class="btn primario" data-enviar-lado>⬆ Enviar músicas</button><input type="file" id="mu-up" accept="audio/*,.mp3,.m4a,.flac,.ogg,.wav,.opus" multiple hidden></aside><section class="mu-principal" id="mu-principal"></section></div>';
      const p = el.querySelector('#mu-principal');
      if (sub === 'biblioteca') telaBiblioteca(p); else if (sub === 'curtidas') telaCurtidas(p); else if (sub === 'playlist') telaPlaylist(p, param); else if (sub === 'plataformas' || sub === 'externos') Telas.musicas.telaPlataformas(p, sub === 'externos' ? 'salvos' : param); else telaInicio(p);
      el.querySelector('#mu-up').onchange = function () { enviar(Array.prototype.slice.call(this.files), sub === 'playlist' ? param : null); };
      el.querySelector('[data-enviar-lado]').onclick = function () { document.getElementById('mu-up').click(); };
      el.querySelector('[data-nova-pl]').onclick = async function () { const pl = await novaPlaylist(); if (pl) location.hash = '#/musicas/playlist/' + pl.id; };
      const zona = el.querySelector('.musicas');
      zona.addEventListener('dragover', function (ev) { if (Array.prototype.indexOf.call(ev.dataTransfer.types, 'Files') >= 0) { ev.preventDefault(); zona.classList.add('soltando'); } });
      zona.addEventListener('dragleave', function (ev) { if (ev.target === zona) zona.classList.remove('soltando'); });
      zona.addEventListener('drop', function (ev) { if (!ev.dataTransfer.files.length) return; ev.preventDefault(); zona.classList.remove('soltando'); enviar(Array.prototype.slice.call(ev.dataTransfer.files), sub === 'playlist' ? param : null); });
    },
    marcarTocando: function () { const a = document.activeElement; if (App.rota().tela === 'musicas' && !document.querySelector('.modal-fundo') && !(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) App.redesenhar(); },
    adicionarDaNuvem: async function (x) { const b = await Dados.lerArquivo(x.id); if (!b) return aviso('Arquivo não encontrado.', 'erro'); await enviar([new File([b], x.nome, { type: x.mime || b.type })]); location.hash = '#/musicas/biblioteca'; },
    embed: embed
  };
})();
