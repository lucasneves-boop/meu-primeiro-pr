/* Plataformas de música: reconhece links (Spotify, Deezer, YouTube/YouTube Music, Apple Music, SoundCloud,
   Amazon Music), monta o player oficial embutido, normaliza a busca pública do Deezer e da Apple Music e
   prepara o login do Spotify (OAuth com PKCE, sem servidor). Puro. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Plataformas = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PLATAFORMAS = [
    { id: 'spotify', nome: 'Spotify', cor: '#1db954', site: 'https://open.spotify.com', recursos: 'Conta, busca e player' },
    { id: 'deezer', nome: 'Deezer', cor: '#a238ff', site: 'https://www.deezer.com', recursos: 'Busca e player' },
    { id: 'apple', nome: 'Apple Music', cor: '#fa2d48', site: 'https://music.apple.com', recursos: 'Busca e player' },
    { id: 'youtube', nome: 'YouTube Music', cor: '#ff0000', site: 'https://music.youtube.com', recursos: 'Player por link' },
    { id: 'soundcloud', nome: 'SoundCloud', cor: '#ff5500', site: 'https://soundcloud.com', recursos: 'Player por link' },
    { id: 'amazon', nome: 'Amazon Music', cor: '#25d1da', site: 'https://music.amazon.com.br', recursos: 'Abre no app' }
  ];
  function plataforma(id) { return PLATAFORMAS.find(function (p) { return p.id === id; }); }
  const TIPOS = { track: 'Faixa', album: 'Álbum', playlist: 'Playlist', artist: 'Artista', episode: 'Episódio', show: 'Podcast', song: 'Faixa', video: 'Vídeo', set: 'Playlist' };

  // Link → { plataforma, tipo, id, embed, alt, abrir }. embed nulo = só abre no site/app do serviço.
  function reconhecer(u) {
    const s = String(u || '').trim(); let x;
    if ((x = s.match(/^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)$/)) || (x = s.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(?:embed\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/)))
      return { plataforma: 'spotify', tipo: x[1], id: x[2], embed: 'https://open.spotify.com/embed/' + x[1] + '/' + x[2], alt: x[1] === 'track' || x[1] === 'episode' ? 152 : 380, abrir: 'https://open.spotify.com/' + x[1] + '/' + x[2] };
    if ((x = s.match(/deezer\.com\/(?:[a-z]{2}\/)?(track|album|playlist|artist|episode|show)\/(\d+)/)))
      return { plataforma: 'deezer', tipo: x[1], id: x[2], embed: x[1] === 'artist' ? 'https://widget.deezer.com/widget/dark/artist/' + x[2] + '/top_tracks' : 'https://widget.deezer.com/widget/dark/' + x[1] + '/' + x[2], alt: x[1] === 'track' ? 150 : 380, abrir: 'https://www.deezer.com/' + x[1] + '/' + x[2] };
    if (/(?:deezer\.page\.link|link\.deezer\.com)\//.test(s)) return { plataforma: 'deezer', curto: true };
    if ((x = s.match(/music\.apple\.com\/([a-z]{2})\/(album|playlist|song|artist|music-video)\/([^?#]+)/))) {
      const fx = s.match(/[?&]i=(\d+)/);
      const caminho = x[1] + '/' + x[2] + '/' + x[3] + (fx ? '?i=' + fx[1] : '');
      return { plataforma: 'apple', tipo: fx ? 'song' : x[2], id: x[3].split('/').pop(), embed: x[2] === 'artist' ? null : 'https://embed.music.apple.com/' + caminho, alt: fx || x[2] === 'song' ? 175 : 450, abrir: 'https://music.apple.com/' + caminho };
    }
    if ((x = s.match(/[?&]list=([\w-]+)/)) && /youtu/.test(s)) return { plataforma: 'youtube', tipo: 'playlist', id: x[1], embed: 'https://www.youtube.com/embed/videoseries?list=' + x[1], alt: 315, abrir: (/music\.youtube/.test(s) ? 'https://music.youtube.com/playlist?list=' : 'https://www.youtube.com/playlist?list=') + x[1] };
    if ((x = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/|music\.youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/))) return { plataforma: 'youtube', tipo: 'video', id: x[1], embed: 'https://www.youtube.com/embed/' + x[1], alt: 315, abrir: (/music\.youtube/.test(s) ? 'https://music.youtube.com/watch?v=' : 'https://www.youtube.com/watch?v=') + x[1] };
    if ((x = s.match(/^https?:\/\/(?:www\.|m\.)?soundcloud\.com\/([\w-]+)(?:\/(sets\/)?([\w-]+))?/))) return { plataforma: 'soundcloud', tipo: x[2] ? 'set' : x[3] ? 'track' : 'artist', id: x[1] + (x[3] ? '/' + (x[2] || '') + x[3] : ''), embed: 'https://w.soundcloud.com/player/?url=' + encodeURIComponent('https://soundcloud.com/' + x[1] + (x[3] ? '/' + (x[2] || '') + x[3] : '')) + '&color=%23b68d40&visual=' + (x[3] && !x[2] ? 'false' : 'true'), alt: x[3] && !x[2] ? 166 : 380, abrir: 'https://soundcloud.com/' + x[1] + (x[3] ? '/' + (x[2] || '') + x[3] : '') };
    if ((x = s.match(/music\.amazon\.[a-z.]+\/(albums|playlists|user-playlists|artists|tracks)\/([\w]+)/))) return { plataforma: 'amazon', tipo: { albums: 'album', playlists: 'playlist', 'user-playlists': 'playlist', artists: 'artist', tracks: 'track' }[x[1]], id: x[2], embed: null, abrir: s.split('#')[0] };
    return null;
  }
  function rotuloTipo(t) { return TIPOS[t] || 'Link'; }

  // ---------- busca pública ----------
  function urlBuscaDeezer(q, tipo, cb) { return 'https://api.deezer.com/search' + (tipo && tipo !== 'track' ? '/' + tipo : '') + '?q=' + encodeURIComponent(q) + '&limit=20&output=jsonp&callback=' + cb; }
  function urlBuscaApple(q, tipo) { return 'https://itunes.apple.com/search?term=' + encodeURIComponent(q) + '&media=music&entity=' + ({ album: 'album', artist: 'musicArtist' }[tipo] || 'song') + '&limit=20&country=BR'; }
  function minSeg(s) { s = Math.round(s || 0); return s ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : ''; }
  function deezerItens(j) {
    return ((j && j.data) || []).map(function (d) {
      const tipo = d.type || 'track';
      const link = d.link || ('https://www.deezer.com/' + tipo + '/' + d.id);
      return { fonte: 'deezer', tipo: tipo, id: String(d.id), titulo: d.title || d.name || '', artista: (d.artist && d.artist.name) || (d.user && d.user.name) || '', album: (d.album && d.album.title) || '',
        capa: (d.album && (d.album.cover_medium || d.album.cover)) || d.cover_medium || d.picture_medium || '', duracao: minSeg(d.duration), previa: d.preview || '', link: link, ref: reconhecer(link) };
    });
  }
  function appleItens(j) {
    return ((j && j.results) || []).map(function (d) {
      const tipo = d.wrapperType === 'collection' ? 'album' : d.wrapperType === 'artist' ? 'artist' : 'song';
      const link = String(d.trackViewUrl || d.collectionViewUrl || d.artistLinkUrl || '').replace(/[?&]uo=\d+/, '').replace(/\?$/, '');
      return { fonte: 'apple', tipo: tipo, id: String(d.trackId || d.collectionId || d.artistId), titulo: d.trackName || d.collectionName || d.artistName || '', artista: tipo === 'artist' ? '' : d.artistName || '', album: tipo === 'song' ? d.collectionName || '' : '',
        capa: String(d.artworkUrl100 || '').replace('100x100bb', '200x200bb'), duracao: minSeg((d.trackTimeMillis || 0) / 1000), previa: d.previewUrl || '', link: link, ref: reconhecer(link) };
    });
  }

  // ---------- Spotify (OAuth com PKCE) ----------
  const ESCOPOS_SPOTIFY = 'playlist-read-private playlist-read-collaborative user-library-read user-read-recently-played user-top-read';
  function urlAutorizarSpotify(o) {
    return 'https://accounts.spotify.com/authorize?' + [['client_id', o.clientId], ['response_type', 'code'], ['redirect_uri', o.redirect], ['code_challenge_method', 'S256'], ['code_challenge', o.desafio], ['state', o.estado], ['scope', ESCOPOS_SPOTIFY]]
      .map(function (p) { return p[0] + '=' + encodeURIComponent(p[1]); }).join('&');
  }
  function corpoTokenSpotify(o) {
    const p = o.refresh ? [['grant_type', 'refresh_token'], ['refresh_token', o.refresh], ['client_id', o.clientId]] : [['grant_type', 'authorization_code'], ['code', o.codigo], ['redirect_uri', o.redirect], ['client_id', o.clientId], ['code_verifier', o.verificador]];
    return p.map(function (x) { return x[0] + '=' + encodeURIComponent(x[1]); }).join('&');
  }
  // Endereço de retorno: a página do app sem consulta nem âncora (é ele que se cadastra no painel do Spotify).
  function redirecionamento(href) { return String(href).split('#')[0].split('?')[0]; }
  function base64url(bytes) { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function spotifyItem(d, tipo) {
    if (!d) return null; tipo = d.type || tipo;
    const imgs = d.images || (d.album && d.album.images) || [];
    const link = (d.external_urls && d.external_urls.spotify) || ('https://open.spotify.com/' + tipo + '/' + d.id);
    return { fonte: 'spotify', tipo: tipo, id: d.id, titulo: d.name || '', artista: (d.artists || []).map(function (a) { return a.name; }).join(', ') || (d.owner && d.owner.display_name) || '', album: (d.album && d.album.name) || '',
      capa: (imgs[1] || imgs[0] || {}).url || '', duracao: minSeg((d.duration_ms || 0) / 1000), previa: d.preview_url || '', link: link, ref: reconhecer(link), total: d.tracks && d.tracks.total };
  }
  function spotifyLista(j, tipo) {
    if (!j) return [];
    if (j.items) return j.items.map(function (x) { return spotifyItem('track' in x ? x.track : 'album' in x && !x.type ? x.album : x, tipo); }).filter(Boolean);
    const k = { track: 'tracks', album: 'albums', playlist: 'playlists', artist: 'artists' }[tipo];
    return (((j[k] || {}).items) || []).filter(Boolean).map(function (x) { return spotifyItem(x, tipo); });
  }
  function expirou(sessao, agora) { return !sessao || !sessao.token || (agora || Date.now()) > (sessao.expira || 0) - 60000; }

  return { PLATAFORMAS: PLATAFORMAS, plataforma: plataforma, reconhecer: reconhecer, rotuloTipo: rotuloTipo, urlBuscaDeezer: urlBuscaDeezer, urlBuscaApple: urlBuscaApple,
    deezerItens: deezerItens, appleItens: appleItens, ESCOPOS_SPOTIFY: ESCOPOS_SPOTIFY, urlAutorizarSpotify: urlAutorizarSpotify, corpoTokenSpotify: corpoTokenSpotify,
    redirecionamento: redirecionamento, base64url: base64url, spotifyItem: spotifyItem, spotifyLista: spotifyLista, expirou: expirou, minSeg: minSeg };
});
