const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/plataformas.js');

test('reconhece links do Spotify (inclusive URI e /intl-pt/) e monta o player oficial', () => {
  const a = P.reconhecer('https://open.spotify.com/intl-pt/playlist/37i9dQZF1DX8NTLI2TtZa6?si=abc');
  assert.deepEqual([a.plataforma, a.tipo, a.id, a.embed, a.alt], ['spotify', 'playlist', '37i9dQZF1DX8NTLI2TtZa6', 'https://open.spotify.com/embed/playlist/37i9dQZF1DX8NTLI2TtZa6', 380]);
  const b = P.reconhecer('spotify:track:4uLU6hMCjMI75M1A2tKUQC');
  assert.equal(b.embed, 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC'); assert.equal(b.alt, 152);
});

test('reconhece Deezer, Apple Music, YouTube Music, SoundCloud e Amazon Music', () => {
  assert.equal(P.reconhecer('https://www.deezer.com/br/album/302127').embed, 'https://widget.deezer.com/widget/dark/album/302127');
  assert.equal(P.reconhecer('https://www.deezer.com/artist/15810').embed, 'https://widget.deezer.com/widget/dark/artist/15810/top_tracks');
  assert.equal(P.reconhecer('https://link.deezer.com/s/abc').curto, true);
  const ap = P.reconhecer('https://music.apple.com/br/album/tempo-perdido/713691722?i=713691774');
  assert.deepEqual([ap.plataforma, ap.tipo, ap.embed], ['apple', 'song', 'https://embed.music.apple.com/br/album/tempo-perdido/713691722?i=713691774']);
  assert.equal(P.reconhecer('https://music.apple.com/br/playlist/hits/pl.123abc').embed, 'https://embed.music.apple.com/br/playlist/hits/pl.123abc');
  const yt = P.reconhecer('https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share');
  assert.deepEqual([yt.plataforma, yt.embed, yt.abrir], ['youtube', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://music.youtube.com/watch?v=dQw4w9WgXcQ']);
  assert.equal(P.reconhecer('https://music.youtube.com/playlist?list=PLabc-123').embed, 'https://www.youtube.com/embed/videoseries?list=PLabc-123');
  const sc = P.reconhecer('https://soundcloud.com/artista/sets/trilha');
  assert.equal(sc.tipo, 'set'); assert.match(sc.embed, /^https:\/\/w\.soundcloud\.com\/player\/\?url=https%3A%2F%2Fsoundcloud\.com%2Fartista%2Fsets%2Ftrilha/);
  const am = P.reconhecer('https://music.amazon.com.br/albums/B0ABC12345');
  assert.deepEqual([am.plataforma, am.tipo, am.embed], ['amazon', 'album', null]);
  assert.equal(P.reconhecer('https://example.com/musica'), null); assert.equal(P.reconhecer(''), null);
});

test('busca pública: URLs do Deezer (JSONP) e da Apple Music (Brasil)', () => {
  assert.equal(P.urlBuscaDeezer('legião urbana', 'track', 'cb1'), 'https://api.deezer.com/search?q=legi%C3%A3o%20urbana&limit=20&output=jsonp&callback=cb1');
  assert.equal(P.urlBuscaDeezer('rock', 'playlist', 'cb2'), 'https://api.deezer.com/search/playlist?q=rock&limit=20&output=jsonp&callback=cb2');
  assert.match(P.urlBuscaApple('tempo perdido', 'album'), /entity=album&limit=20&country=BR$/);
});

test('normaliza resultados do Deezer e da Apple Music', () => {
  const dz = P.deezerItens({ data: [{ id: 3530724, type: 'track', title: 'Tempo Perdido', duration: 300, preview: 'https://cdnt-preview.dzcdn.net/x.mp3', link: 'https://www.deezer.com/track/3530724', artist: { name: 'Legiao Urbana' }, album: { title: 'Dois', cover_medium: 'https://e-cdns-images.dzcdn.net/c.jpg' } }, { id: 9, type: 'playlist', title: 'Foco', user: { name: 'Deezer' }, picture_medium: 'p.jpg', link: 'https://www.deezer.com/playlist/9' }] });
  assert.deepEqual([dz[0].titulo, dz[0].artista, dz[0].album, dz[0].duracao, dz[0].ref.embed], ['Tempo Perdido', 'Legiao Urbana', 'Dois', '5:00', 'https://widget.deezer.com/widget/dark/track/3530724']);
  assert.deepEqual([dz[1].tipo, dz[1].artista, dz[1].capa], ['playlist', 'Deezer', 'p.jpg']);
  const ap = P.appleItens({ results: [{ wrapperType: 'track', trackId: 713691774, trackName: 'Tempo Perdido', artistName: 'Legião Urbana', collectionName: 'Mais do Mesmo', trackTimeMillis: 301000, previewUrl: 'https://audio-ssl.itunes.apple.com/p.m4a', artworkUrl100: 'https://is1-ssl.mzstatic.com/x/100x100bb.jpg', trackViewUrl: 'https://music.apple.com/br/album/tempo-perdido/713691722?i=713691774&uo=4' }] });
  assert.deepEqual([ap[0].tipo, ap[0].duracao, ap[0].capa, ap[0].link, ap[0].ref.embed], ['song', '5:01', 'https://is1-ssl.mzstatic.com/x/200x200bb.jpg', 'https://music.apple.com/br/album/tempo-perdido/713691722?i=713691774', 'https://embed.music.apple.com/br/album/tempo-perdido/713691722?i=713691774']);
  assert.deepEqual(P.deezerItens(null), []); assert.deepEqual(P.appleItens({}), []);
});

test('Spotify: autorização PKCE, corpo do token, retorno e listas', () => {
  const u = new URL(P.urlAutorizarSpotify({ clientId: 'abc', redirect: 'https://licita.sevenneves.com.br/seven-licita/', desafio: 'XYZ', estado: 'st1' }));
  assert.equal(u.origin + u.pathname, 'https://accounts.spotify.com/authorize');
  assert.deepEqual(['client_id', 'response_type', 'redirect_uri', 'code_challenge_method', 'code_challenge', 'state'].map(k => u.searchParams.get(k)), ['abc', 'code', 'https://licita.sevenneves.com.br/seven-licita/', 'S256', 'XYZ', 'st1']);
  assert.match(u.searchParams.get('scope'), /playlist-read-private/);
  assert.equal(P.corpoTokenSpotify({ codigo: 'c d', redirect: 'https://x/', clientId: 'abc', verificador: 'v' }), 'grant_type=authorization_code&code=c%20d&redirect_uri=https%3A%2F%2Fx%2F&client_id=abc&code_verifier=v');
  assert.equal(P.corpoTokenSpotify({ refresh: 'r', clientId: 'abc' }), 'grant_type=refresh_token&refresh_token=r&client_id=abc');
  assert.equal(P.redirecionamento('https://licita.sevenneves.com.br/seven-licita/?code=1&state=2#/musicas'), 'https://licita.sevenneves.com.br/seven-licita/');
  assert.equal(P.base64url(new Uint8Array([251, 255, 191])), '-_-_');
  const pls = P.spotifyLista({ items: [{ id: 'p1', type: 'playlist', name: 'Foco', owner: { display_name: 'Lucas' }, images: [{ url: 'g.jpg' }], tracks: { total: 12 } }] });
  assert.deepEqual([pls[0].titulo, pls[0].artista, pls[0].capa, pls[0].total, pls[0].ref.embed], ['Foco', 'Lucas', 'g.jpg', 12, 'https://open.spotify.com/embed/playlist/p1']);
  const busca = P.spotifyLista({ tracks: { items: [{ id: 't1', type: 'track', name: 'Música', artists: [{ name: 'A' }, { name: 'B' }], duration_ms: 61000, album: { name: 'Disco', images: [{ url: 'g' }, { url: 'm' }] } }] } }, 'track');
  assert.deepEqual([busca[0].artista, busca[0].duracao, busca[0].capa], ['A, B', '1:01', 'm']);
  const salvos = P.spotifyLista({ items: [{ track: { id: 't2', type: 'track', name: 'X', artists: [] } }, { track: null }] });
  assert.equal(salvos.length, 1);
  assert.equal(P.expirou({ token: 't', expira: 100000 }, 30000), false); assert.equal(P.expirou({ token: 't', expira: 100000 }, 50000), true); assert.equal(P.expirou(null), true);
});
