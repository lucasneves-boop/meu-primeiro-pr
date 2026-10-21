/* Seven Licita — player de música global (barra fixa que continua tocando entre as telas). */
(function (raiz) {
  'use strict';

  // Lê título, artista, álbum e capa de tags ID3v2 (v2.3 e v2.4) de um MP3.
  function lerID3(buf) {
    const b = new Uint8Array(buf); const out = {};
    if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return out;
    const ver = b[3]; const sinc = function (i) { return (b[i] << 21) | (b[i + 1] << 14) | (b[i + 2] << 7) | b[i + 3]; };
    const fim = 10 + sinc(6); let p = 10;
    if (b[5] & 0x40) p += ver === 4 ? sinc(10) : ((b[10] << 24) | (b[11] << 16) | (b[12] << 8) | b[13]) + 4;
    const texto = function (ini, len) {
      const enc = b[ini]; const d = b.subarray(ini + 1, ini + len); let s;
      if (enc === 1 || enc === 2) { const le = enc === 1 ? !(d[0] === 0xFE && d[1] === 0xFF) : false; const ini2 = enc === 1 && (d[0] === 0xFF || d[0] === 0xFE) ? 2 : 0; s = ''; for (let i = ini2; i + 1 < d.length; i += 2) { const c = le ? d[i] | (d[i + 1] << 8) : (d[i] << 8) | d[i + 1]; if (!c) break; s += String.fromCharCode(c); } }
      else s = new TextDecoder(enc === 3 ? 'utf-8' : 'latin1').decode(d).replace(/\0[\s\S]*$/, '');
      return s.trim();
    };
    while (p + 10 < fim && p + 10 < b.length) {
      const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]); if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const tam = ver === 4 ? sinc(p + 4) : (b[p + 4] << 24) | (b[p + 5] << 16) | (b[p + 6] << 8) | b[p + 7]; const ini = p + 10;
      if (tam <= 0 || ini + tam > b.length) break;
      if (id === 'TIT2') out.titulo = texto(ini, tam); if (id === 'TPE1') out.artista = texto(ini, tam); if (id === 'TALB') out.album = texto(ini, tam);
      if (id === 'APIC') { const enc = b[ini]; let i = ini + 1; let mime = ''; while (b[i]) mime += String.fromCharCode(b[i++]); i += 2; if (enc === 1 || enc === 2) { while (i + 1 < ini + tam && (b[i] || b[i + 1])) i += 2; i += 2; } else { while (b[i]) i++; i++; } out.capa = { mime: mime || 'image/jpeg', dados: b.slice(i, ini + tam) }; }
      p = ini + tam;
    }
    return out;
  }

  // Nome de arquivo "Artista - Título.mp3" vira metadados quando não há tags.
  function doNome(nome) { const base = String(nome).replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim(); const m = base.match(/^(.+?)\s+[-–]\s+(.+)$/); return m ? { artista: m[1].trim(), titulo: m[2].trim() } : { titulo: base }; }

  const exp = { lerID3: lerID3, doNome: doNome };
  if (typeof module === 'object' && module.exports) { module.exports = exp; return; }

  // ---------- player (navegador) ----------
  const audio = new Audio(); audio.preload = 'metadata';
  const est = { fila: [], idx: -1, aleatorio: false, repetir: 'nao', ordemOriginal: null, url: null, filaAberta: false };
  const urls = {};
  function m() { const d = Dados.e; d.musicas = d.musicas || { faixas: [], playlists: [], externos: [], recentes: [], volume: 0.8 }; return d.musicas; }
  function faixa(id) { return m().faixas.find(function (f) { return f.id === id; }); }
  function atual() { return faixa(est.fila[est.idx]); }
  function tempo(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  async function urlCapa(f) { if (!f || !f.capa) return ''; if (!urls[f.capa]) { const b = await Dados.lerArquivo(f.capa); if (b) urls[f.capa] = URL.createObjectURL(b); } return urls[f.capa] || ''; }

  async function tocarFila(ids, inicio) {
    est.fila = ids.slice(); est.ordemOriginal = null; est.idx = Math.max(0, inicio || 0);
    if (est.aleatorio) embaralhar(true);
    await carregar(true);
  }
  function embaralhar(manterAtual) {
    const cur = est.fila[est.idx]; est.ordemOriginal = est.fila.slice();
    const resto = est.fila.filter(function (_, i) { return i !== est.idx; });
    for (let i = resto.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = resto[i]; resto[i] = resto[j]; resto[j] = t; }
    est.fila = manterAtual && cur ? [cur].concat(resto) : resto; est.idx = 0;
  }
  async function carregar(tocar) {
    const f = atual(); if (!f) return;
    const b = await Dados.lerArquivo(f.arquivo); if (!b) { UI.aviso('O arquivo de "' + f.titulo + '" não está neste navegador.', 'erro'); return; }
    if (est.url) URL.revokeObjectURL(est.url); est.url = URL.createObjectURL(b); audio.src = est.url;
    audio.volume = m().volume == null ? 0.8 : m().volume;
    if (tocar) { try { await audio.play(); } catch (err) { /* o navegador pode exigir um clique antes */ } }
    f.plays = (f.plays || 0) + 1; f.ultimaVez = new Date().toISOString();
    m().recentes = [f.id].concat((m().recentes || []).filter(function (x) { return x !== f.id; })).slice(0, 30);
    Dados.salvar(); sessao(f); pintar();
  }
  function proxima(auto) {
    if (!est.fila.length) return;
    if (auto && est.repetir === 'uma') { audio.currentTime = 0; audio.play(); return; }
    if (est.idx < est.fila.length - 1) est.idx++; else if (est.repetir === 'todas' || !auto) est.idx = 0; else { pintar(); return; }
    carregar(true);
  }
  function anterior() { if (audio.currentTime > 3) { audio.currentTime = 0; return; } if (est.idx > 0) est.idx--; else if (est.repetir === 'todas') est.idx = est.fila.length - 1; carregar(true); }
  function alternar() { if (!atual()) return; if (audio.paused) audio.play(); else audio.pause(); }
  function adicionarFila(id, seguinte) { if (!est.fila.length) return tocarFila([id], 0); if (seguinte) est.fila.splice(est.idx + 1, 0, id); else est.fila.push(id); UI.aviso('Adicionada à fila.'); pintar(); }

  async function sessao(f) {
    if (!('mediaSession' in navigator)) return;
    const capa = await urlCapa(f);
    try { navigator.mediaSession.metadata = new MediaMetadata({ title: f.titulo, artist: f.artista || '', album: f.album || '', artwork: capa ? [{ src: capa, sizes: '512x512' }] : [{ src: 'img/seven-marca.png', sizes: '377x274', type: 'image/png' }] }); } catch (err) { /* sem suporte */ }
    [['play', function () { audio.play(); }], ['pause', function () { audio.pause(); }], ['previoustrack', anterior], ['nexttrack', function () { proxima(false); }], ['seekto', function (d) { audio.currentTime = d.seekTime; }]].forEach(function (x) { try { navigator.mediaSession.setActionHandler(x[0], x[1]); } catch (err) { /* ação não suportada */ } });
  }

  function barra() { let b = document.getElementById('player'); if (!b) { b = document.createElement('div'); b.id = 'player'; b.className = 'player'; document.body.appendChild(b); b.addEventListener('click', clique); b.addEventListener('input', entrada); } return b; }

  async function pintar() {
    const f = atual(); const b = barra();
    document.body.classList.toggle('com-player', !!f);
    if (!f) { b.innerHTML = ''; return; }
    const capa = await urlCapa(f);
    b.innerHTML = '<div class="pl-faixa">' + (capa ? '<img src="' + capa + '" alt="">' : '<span class="pl-capa">♪</span>') + '<div><b>' + UI.esc(f.titulo) + '</b><small>' + UI.esc(f.artista || 'Artista desconhecido') + '</small></div><button class="icone pl-curtir ' + (f.curtida ? 'on' : '') + '" data-p="curtir" aria-label="Curtir">♥</button></div>' +
      '<div class="pl-centro"><div class="pl-botoes"><button class="icone ' + (est.aleatorio ? 'on' : '') + '" data-p="aleatorio" aria-label="Aleatório" title="Aleatório">⤮</button><button class="icone" data-p="ant" aria-label="Anterior">⏮</button><button class="pl-play" data-p="play" aria-label="' + (audio.paused ? 'Tocar' : 'Pausar') + '">' + (audio.paused ? '▶' : '❚❚') + '</button><button class="icone" data-p="prox" aria-label="Próxima">⏭</button><button class="icone ' + (est.repetir !== 'nao' ? 'on' : '') + '" data-p="repetir" aria-label="Repetir" title="Repetir: ' + { nao: 'não', todas: 'todas', uma: 'uma' }[est.repetir] + '">' + (est.repetir === 'uma' ? '🔂' : '🔁') + '</button></div>' +
      '<div class="pl-tempo"><span id="pl-atual">' + tempo(audio.currentTime) + '</span><input type="range" id="pl-seek" min="0" max="' + (audio.duration || f.duracao || 0) + '" step="0.5" value="' + audio.currentTime + '" aria-label="Posição"><span>' + tempo(audio.duration || f.duracao) + '</span></div></div>' +
      '<div class="pl-dir"><button class="icone ' + (est.filaAberta ? 'on' : '') + '" data-p="fila" aria-label="Fila" title="Fila">☰</button><span>🔊</span><input type="range" id="pl-vol" min="0" max="1" step="0.01" value="' + audio.volume + '" aria-label="Volume"></div>' +
      (est.filaAberta ? '<div class="pl-fila"><h4>Tocando agora</h4>' + linhaFila(est.idx) + '<h4>Próximas</h4>' + (est.fila.slice(est.idx + 1).map(function (_, i) { return linhaFila(est.idx + 1 + i); }).join('') || '<p class="mudo mini">Fila vazia.</p>') + '</div>' : '');
  }
  function linhaFila(i) { const f = faixa(est.fila[i]); return f ? '<div class="pl-fila-item ' + (i === est.idx ? 'atual' : '') + '" data-fi="' + i + '"><b>' + UI.esc(f.titulo) + '</b><small>' + UI.esc(f.artista || '') + '</small>' + (i !== est.idx ? '<button class="icone" data-tira="' + i + '" aria-label="Tirar da fila">×</button>' : '') + '</div>' : ''; }

  function clique(ev) {
    const t = ev.target.closest('[data-tira]'); if (t) { ev.stopPropagation(); est.fila.splice(Number(t.dataset.tira), 1); pintar(); return; }
    const fi = ev.target.closest('[data-fi]'); if (fi) { est.idx = Number(fi.dataset.fi); carregar(true); return; }
    const b = ev.target.closest('[data-p]'); if (!b) return; const a = b.dataset.p;
    if (a === 'play') alternar(); if (a === 'prox') proxima(false); if (a === 'ant') anterior();
    if (a === 'aleatorio') { est.aleatorio = !est.aleatorio; if (est.aleatorio) embaralhar(true); else if (est.ordemOriginal) { const cur = est.fila[est.idx]; est.fila = est.ordemOriginal; est.idx = est.fila.indexOf(cur); est.ordemOriginal = null; } pintar(); }
    if (a === 'repetir') { est.repetir = { nao: 'todas', todas: 'uma', uma: 'nao' }[est.repetir]; pintar(); }
    if (a === 'curtir') { const f = atual(); f.curtida = !f.curtida; Dados.salvar(); pintar(); if (App.rota().tela === 'musicas') App.redesenhar(); }
    if (a === 'fila') { est.filaAberta = !est.filaAberta; pintar(); }
  }
  function entrada(ev) {
    if (ev.target.id === 'pl-seek') audio.currentTime = Number(ev.target.value);
    if (ev.target.id === 'pl-vol') { audio.volume = Number(ev.target.value); m().volume = audio.volume; clearTimeout(entrada._t); entrada._t = setTimeout(Dados.salvar, 400); }
  }

  audio.addEventListener('timeupdate', function () { const s = document.getElementById('pl-seek'); if (s && document.activeElement !== s) { s.value = audio.currentTime; if (audio.duration && Number(s.max) !== audio.duration) s.max = audio.duration; } const a = document.getElementById('pl-atual'); if (a) a.textContent = tempo(audio.currentTime); });
  audio.addEventListener('loadedmetadata', function () { const f = atual(); if (f && isFinite(audio.duration) && Math.round(f.duracao || 0) !== Math.round(audio.duration)) { f.duracao = audio.duration; Dados.salvar(); } pintar(); });
  audio.addEventListener('play', function () { pintar(); if (raiz.Telas && Telas.musicas && App.rota().tela === 'musicas') Telas.musicas.marcarTocando(); });
  audio.addEventListener('pause', pintar);
  audio.addEventListener('ended', function () { proxima(true); });

  raiz.Player = Object.assign(exp, { tocarFila: tocarFila, alternar: alternar, adicionarFila: adicionarFila, atual: atual, tocando: function () { return !audio.paused; }, audio: audio, tempo: tempo, urlCapa: urlCapa });
})(typeof self !== 'undefined' ? self : this);
