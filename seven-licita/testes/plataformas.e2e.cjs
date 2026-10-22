// Músicas › Plataformas: Deezer (JSONP), Apple Music e Spotify (OAuth PKCE) simulados; players oficiais trocados por páginas vazias.
// Uso: node testes/plataformas.e2e.cjs [pasta-de-capturas]
const path = require('path');
const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');

function wav() { const n = 8000, b = Buffer.alloc(44 + n); b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); for (let i = 0; i < n; i++) b[44 + i] = 128 + Math.round(40 * Math.sin(i / 4)); return b; }
const DEEZER = { data: [
  { id: 3530724, type: 'track', title: 'Tempo Perdido', duration: 300, preview: 'https://cdnt-preview.dzcdn.net/api/1/1/x.mp3', link: 'https://www.deezer.com/track/3530724', artist: { name: 'Legiao Urbana' }, album: { title: 'Dois', cover_medium: 'https://e-cdns-images.dzcdn.net/images/cover/x/250x250.jpg' } },
  { id: 3530725, type: 'track', title: 'Índios', duration: 254, preview: 'https://cdnt-preview.dzcdn.net/api/1/1/y.mp3', link: 'https://www.deezer.com/track/3530725', artist: { name: 'Legiao Urbana' }, album: { title: 'Dois' } }] };
const APPLE = { resultCount: 1, results: [{ wrapperType: 'track', trackId: 713691774, trackName: 'Tempo Perdido', artistName: 'Legião Urbana', collectionName: 'Mais do Mesmo', trackTimeMillis: 301000, previewUrl: 'https://audio-ssl.itunes.apple.com/p.m4a', artworkUrl100: 'https://is1-ssl.mzstatic.com/x/100x100bb.jpg', trackViewUrl: 'https://music.apple.com/br/album/tempo-perdido/713691722?i=713691774&uo=4' }] };

(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t; const pedidos = [];
  const IMG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await pg.route('https://api.deezer.com/**', r => { const u = new URL(r.request().url()); pedidos.push(u.href); r.fulfill({ contentType: 'text/javascript', body: u.searchParams.get('callback') + '(' + JSON.stringify(DEEZER) + ')' }); });
  await pg.route('https://itunes.apple.com/**', r => { pedidos.push(r.request().url()); r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(APPLE) }); });
  await pg.route(/dzcdn\.net\/api|audio-ssl\.itunes/, r => r.fulfill({ contentType: 'audio/wav', body: wav() }));
  await pg.route(/dzcdn\.net\/images|mzstatic|scdn\.co/, r => r.fulfill({ contentType: 'image/png', body: IMG }));
  await pg.route(/widget\.deezer\.com|open\.spotify\.com\/embed|embed\.music\.apple\.com|youtube\.com\/embed|w\.soundcloud\.com/, r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>player</title><p>player oficial</p>' }));
  let estadoOAuth = null;
  await pg.route('https://accounts.spotify.com/authorize**', r => { const u = new URL(r.request().url()); estadoOAuth = Object.fromEntries(u.searchParams); r.fulfill({ status: 302, headers: { Location: u.searchParams.get('redirect_uri') + '?code=COD123&state=' + u.searchParams.get('state') } }); });
  let corpoToken = '';
  await pg.route('https://accounts.spotify.com/api/token', r => { corpoToken = r.request().postData(); r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ access_token: 'TOK', refresh_token: 'REF', expires_in: 3600 }) }); });
  const SP = {
    '/v1/me': { id: 'lucas', display_name: 'Lucas Neves', product: 'premium' },
    '/v1/me/playlists': { items: [{ id: 'pl1', type: 'playlist', name: 'Foco no pregão', owner: { display_name: 'Lucas Neves' }, images: [{ url: 'https://i.scdn.co/a.jpg' }], tracks: { total: 42 }, external_urls: { spotify: 'https://open.spotify.com/playlist/pl1' } }] },
    '/v1/me/albums': { items: [{ album: { id: 'al1', type: 'album', name: 'Mais do Mesmo', artists: [{ name: 'Legião Urbana' }], images: [], external_urls: { spotify: 'https://open.spotify.com/album/al1' } } }] },
    '/v1/search': { tracks: { items: [{ id: 'tr1', type: 'track', name: 'Pais e Filhos', artists: [{ name: 'Legião Urbana' }], duration_ms: 306000, album: { name: 'As Quatro Estações', images: [] }, external_urls: { spotify: 'https://open.spotify.com/track/tr1' } }] }, albums: { items: [] }, playlists: { items: [null] } }
  };
  let autorizacao = '';
  await pg.route('https://api.spotify.com/**', r => { const u = new URL(r.request().url()); autorizacao = r.request().headers().authorization; if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization' } }); r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(SP[u.pathname] || {}) }); });
  try {
    await pg.goto(url + '#/musicas'); await pg.waitForSelector('.musicas');
    ok(await pg.locator('.mu-lado a[href="#/musicas/plataformas"]').count() === 1, 'Plataformas no menu de Músicas');
    await pg.click('.mu-lado a[href="#/musicas/plataformas"]'); await pg.waitForSelector('.mu-plats');
    ok(await pg.locator('.mu-plat').count() === 6, 'seis plataformas: Spotify, Deezer, Apple Music, YouTube Music, SoundCloud, Amazon Music');

    // Deezer
    await pg.fill('#mu-busca-pl [name=q]', 'legião urbana'); await pg.click('#mu-busca-pl button');
    await pg.waitForSelector('.mu-res'); ok(await pg.locator('.mu-res').count() === 2, 'busca no Deezer por JSONP');
    ok(pedidos.some(p => p.includes('q=legi%C3%A3o%20urbana') && p.includes('output=jsonp')), 'termo enviado ao Deezer');
    ok(/Tempo Perdido/.test(await pg.locator('.mu-res').first().innerText()) && /5:00/.test(await pg.locator('.mu-res').first().innerText()), 'título, artista e duração');
    await pg.click('.mu-res >> nth=0 >> .mu-prev'); await pg.waitForSelector('.mu-prev.on'); ok(true, 'prévia de 30 s tocando');
    await pg.click('.mu-res >> nth=0 >> .mu-prev'); await pg.waitForSelector('.mu-prev.on', { state: 'detached' }); ok(true, 'prévia pausa');
    await pg.click('.mu-res >> nth=0 >> [data-ouvir]'); await pg.waitForSelector('.mu-agora iframe');
    ok(await pg.getAttribute('.mu-agora iframe', 'src') === 'https://widget.deezer.com/widget/dark/track/3530724', 'música completa no player oficial do Deezer');
    await pg.click('.mu-res >> nth=0 >> [data-salvar]'); ok(await pg.evaluate(() => Dados.e.musicas.externos[0].url === 'https://www.deezer.com/track/3530724'), 'salvar resultado');
    await foto('musicas-plataformas');

    // Apple Music
    await pg.selectOption('#mu-busca-pl [name=fonte]', 'apple'); await pg.fill('#mu-busca-pl [name=q]', 'tempo perdido'); await pg.click('#mu-busca-pl button');
    await pg.waitForFunction(() => /Mais do Mesmo/.test(document.querySelector('.mu-resultados')?.innerText || ''));
    ok(pedidos.some(p => p.startsWith('https://itunes.apple.com/search?term=tempo%20perdido') && p.includes('country=BR')), 'busca na Apple Music (Brasil)');
    await pg.click('.mu-res >> nth=0 >> [data-ouvir]'); await pg.waitForFunction(() => document.querySelector('.mu-agora iframe').src.startsWith('https://embed.music.apple.com/br/album/'));
    ok(true, 'player oficial da Apple Music');
    await pg.click('[data-fechar-agora]'); ok(await pg.locator('.mu-agora').count() === 0, 'fechar player');

    // Salvos por link
    await pg.click('.mu-abas a[href$="/salvos"]'); await pg.waitForSelector('#mu-ext');
    await pg.fill('#mu-ext [name=u]', 'https://link.deezer.com/s/abc'); await pg.click('#mu-ext button');
    ok(/link curto do Deezer/.test(await pg.locator('#avisos-flutuantes').innerText()), 'link curto do Deezer explicado');
    for (const u of ['https://music.youtube.com/playlist?list=PLabc-123', 'https://music.amazon.com.br/albums/B0ABC12345', 'https://soundcloud.com/artista/sets/trilha']) { await pg.fill('#mu-ext [name=u]', u); await pg.click('#mu-ext button'); await pg.waitForSelector('#mu-ext'); }
    ok(await pg.locator('.mu-ext .cartao').count() === 4, 'links de YouTube Music, Amazon Music e SoundCloud salvos');
    ok(/não permite tocar dentro de outros sites/.test(await pg.locator('.mu-ext .cartao', { hasText: 'Amazon' }).innerText()), 'Amazon Music abre no app (sem player embutido)');
    ok(await pg.locator('.mu-ext iframe[src^="https://www.youtube.com/embed/videoseries?list=PLabc-123"]').count() === 1, 'YouTube Music embutido');

    // Spotify
    await pg.click('.mu-abas a[href$="/spotify"]'); await pg.waitForSelector('#mu-sp-form');
    ok(/Redirect URIs/.test(await pg.locator('.mu-sp-cfg').innerText()) && await pg.locator('.mu-copiar').innerText() === url, 'instruções com o endereço de retorno exato');
    await pg.fill('#mu-sp-form [name=cid]', 'curto'); await pg.click('#mu-sp-form button'); ok(pg.url().startsWith(url), 'Client ID inválido não sai da página');
    await pg.fill('#mu-sp-form [name=cid]', '0123456789abcdef0123456789abcdef'); await pg.click('#mu-sp-form button');
    await pg.waitForSelector('.mu-sp-on', { timeout: 15000 });
    ok(estadoOAuth.code_challenge_method === 'S256' && estadoOAuth.code_challenge.length === 43 && estadoOAuth.client_id === '0123456789abcdef0123456789abcdef' && estadoOAuth.redirect_uri === url, 'login PKCE com desafio S256');
    ok(/grant_type=authorization_code/.test(corpoToken) && /code=COD123/.test(corpoToken) && /code_verifier=[\w-]{64}/.test(corpoToken), 'troca do código por token com o verificador');
    ok(pg.url() === url + '#/musicas/plataformas/spotify', 'código removido do endereço após o login');
    ok(/Lucas Neves/.test(await pg.locator('.mu-sp-on').innerText()) && autorizacao === 'Bearer TOK', 'conectado como Lucas Neves');
    await pg.waitForFunction(() => /Foco no pregão/.test(document.querySelector('.mu-aba').innerText));
    ok(/42 faixas/.test(await pg.locator('.mu-aba').innerText()) && /Mais do Mesmo/.test(await pg.locator('.mu-aba').innerText()), 'playlists e álbuns salvos da conta');
    await pg.fill('#mu-sp-busca [name=q]', 'pais e filhos'); await pg.click('#mu-sp-busca button');
    await pg.waitForFunction(() => /Pais e Filhos/.test(document.querySelector('.mu-aba').innerText)); ok(true, 'busca no catálogo do Spotify');
    await pg.click('.mu-res:has-text("Foco no pregão") [data-ouvir]'); await pg.waitForSelector('.mu-agora iframe');
    ok(await pg.getAttribute('.mu-agora iframe', 'src') === 'https://open.spotify.com/embed/playlist/pl1', 'playlist da conta no player do Spotify');
    ok(await pg.evaluate(() => !/TOK|REF/.test(Dados.exportar())), 'token do Spotify fora do backup');
    await foto('musicas-spotify');
    await pg.reload(); await pg.waitForSelector('.mu-sp-on'); ok(true, 'continua conectado após recarregar');
    await pg.click('[data-sp=sair]'); await pg.waitForSelector('#mu-sp-form'); ok(await pg.evaluate(() => !JSON.parse(localStorage.getItem('seven-musica:spotify')).token), 'desconectar apaga o token');

    // celular
    await pg.setViewportSize({ width: 390, height: 820 }); await pg.goto(url + '#/musicas/plataformas/buscar'); await pg.reload(); await pg.fill('#mu-busca-pl [name=q]', 'x'); await pg.click('#mu-busca-pl button'); await pg.waitForSelector('.mu-res');
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= 390), 'sem rolagem lateral no celular'); await foto('musicas-plataformas-celular');
  } catch (x) { await foto('plataformas-erro'); throw x; }
  await t.fechar();
})().catch(e => { console.error(e); process.exit(1); });
