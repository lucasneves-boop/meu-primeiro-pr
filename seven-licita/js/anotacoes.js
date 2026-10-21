/* Anotações (estilo Samsung Notes): busca, ordenação, filtros, tags, traços de caneta e notas trancadas com AES-GCM. Puro. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Anotacoes = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LIXEIRA_DIAS = 30;
  const CORES = ['', '#fff4b8', '#ffd8c2', '#d6f5d6', '#d4e8ff', '#ecdcff', '#ffd6e7', '#e6e6e6'];

  function normalizar(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function textoDe(html) {
    return String(html || '').replace(/<(br|\/?p|\/?div|\/?li|\/?ul|\/?ol|\/?h\d)(\s[^>]*)?>/gi, '\n').replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function titulo(n) { if (n.titulo && n.titulo.trim()) return n.titulo.trim(); if (n.cifrado) return 'Nota bloqueada'; const t = textoDe(n.html).split('\n').find(function (l) { return l.trim(); }); return t ? t.trim().slice(0, 60) : (n.tracos && n.tracos.length ? 'Anotação à mão' : 'Sem título'); }
  function previa(n, max) { if (n.cifrado) return ''; const t = textoDe(n.html); const tt = n.titulo ? t : t.split('\n').slice(1).join(' '); return tt.replace(/\s+/g, ' ').trim().slice(0, max || 140); }
  function tags(n) { if (n.cifrado) return n.tags || []; const out = []; (textoDe(n.html) + ' ' + (n.titulo || '')).replace(/(^|\s)#([\p{L}\p{N}_-]{2,30})/gu, function (m, a, t) { const k = normalizar(t); if (out.indexOf(k) < 0) out.push(k); return m; }); return out; }
  function checklist(n) { const h = String(n.html || ''); const tot = (h.match(/<li[^>]*data-check/gi) || []).length; const ok = (h.match(/<li[^>]*data-check="1"/gi) || []).length; return { total: tot, feitos: ok }; }

  function filtrar(notas, f) {
    f = f || {}; const agora = f.agora || Date.now();
    return (notas || []).filter(function (n) {
      if (f.lixeira) return !!n.apagadaEm;
      if (n.apagadaEm) return false;
      if (f.pasta && n.pasta !== f.pasta) return false;
      if (f.fav && !n.fav) return false;
      if (f.bloqueadas && !n.cifrado) return false;
      if (f.tag && tags(n).indexOf(f.tag) < 0) return false;
      if (f.q) { const q = normalizar(f.q).split(/\s+/).filter(Boolean); const t = normalizar(titulo(n) + ' ' + (n.cifrado ? '' : textoDe(n.html)) + ' ' + (n.tags || []).join(' ')); if (!q.every(function (x) { return t.indexOf(x) >= 0; })) return false; }
      return agora >= 0;
    });
  }
  function ordenar(notas, crit) {
    const c = crit || 'editada';
    const cmp = {
      editada: function (a, b) { return (b.editadaEm || 0) - (a.editadaEm || 0); },
      criada: function (a, b) { return (b.criadaEm || 0) - (a.criadaEm || 0); },
      titulo: function (a, b) { return titulo(a).localeCompare(titulo(b), 'pt-BR'); }
    }[c];
    return notas.slice().sort(function (a, b) { return (b.fixada ? 1 : 0) - (a.fixada ? 1 : 0) || cmp(a, b); });
  }
  function expurgar(notas, agora) { const lim = (agora || Date.now()) - LIXEIRA_DIAS * 864e5; return (notas || []).filter(function (n) { return !n.apagadaEm || n.apagadaEm > lim; }); }
  function diasNaLixeira(n, agora) { return n.apagadaEm ? Math.max(0, LIXEIRA_DIAS - Math.floor(((agora || Date.now()) - n.apagadaEm) / 864e5)) : null; }

  // ---------- traços (escrita à mão) ----------
  // Ramer–Douglas–Peucker: reduz pontos mantendo a forma (tolerância em px).
  function simplificar(pts, tol) {
    if (pts.length < 3) return pts.slice(); tol = tol == null ? 0.8 : tol;
    const d2 = function (p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1]; const l = dx * dx + dy * dy; let t = l ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); const x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1]; return x * x + y * y; };
    const marca = new Array(pts.length).fill(false); marca[0] = marca[pts.length - 1] = true; const pilha = [[0, pts.length - 1]];
    while (pilha.length) { const [i, j] = pilha.pop(); let m = -1, max = tol * tol; for (let k = i + 1; k < j; k++) { const d = d2(pts[k], pts[i], pts[j]); if (d > max) { max = d; m = k; } } if (m >= 0) { marca[m] = true; pilha.push([i, m], [m, j]); } }
    return pts.filter(function (_, i) { return marca[i]; });
  }
  function caminho(pts) {
    if (!pts.length) return '';
    if (pts.length === 1) return 'M' + pts[0][0] + ' ' + pts[0][1] + 'l0.01 0';
    let d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += 'Q' + pts[i][0] + ' ' + pts[i][1] + ' ' + mx + ' ' + my; }
    const u = pts[pts.length - 1]; return d + 'L' + u[0] + ' ' + u[1];
  }
  function caixa(tracos) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    (tracos || []).forEach(function (t) { t.pts.forEach(function (p) { x0 = Math.min(x0, p[0] - t.esp); y0 = Math.min(y0, p[1] - t.esp); x1 = Math.max(x1, p[0] + t.esp); y1 = Math.max(y1, p[1] + t.esp); }); });
    return isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }
  function svg(tracos, largura) {
    const c = caixa(tracos); if (!c) return '';
    return '<svg viewBox="' + [c.x, c.y, c.w, c.h].map(function (v) { return Math.round(v); }).join(' ') + '"' + (largura ? ' width="' + largura + '"' : '') + ' fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      tracos.map(function (t) { return '<path d="' + caminho(t.pts) + '" stroke="' + String(t.cor).replace(/"/g, '') + '" stroke-width="' + t.esp + '"' + (t.ferr === 'marca' ? ' stroke-opacity=".35"' : t.ferr === 'lapis' ? ' stroke-opacity=".8"' : '') + '/>'; }).join('') + '</svg>';
  }
  // Borracha de traço inteiro: remove traços que passam a menos de r px do ponto.
  function apagarEm(tracos, x, y, r) {
    const perto = function (a, b, lim) { const dx = b[0] - a[0], dy = b[1] - a[1]; const l = dx * dx + dy * dy; let k = l ? ((x - a[0]) * dx + (y - a[1]) * dy) / l : 0; k = Math.max(0, Math.min(1, k)); const px = a[0] + k * dx - x, py = a[1] + k * dy - y; return px * px + py * py <= lim * lim; };
    return tracos.filter(function (t) { const lim = r + t.esp / 2; if (t.pts.length === 1) return !perto(t.pts[0], t.pts[0], lim); for (let i = 1; i < t.pts.length; i++) if (perto(t.pts[i - 1], t.pts[i], lim)) return false; return true; });
  }

  // ---------- notas bloqueadas (PBKDF2 + AES-GCM) ----------
  function cripto() { const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || (typeof self !== 'undefined' && self.crypto); if (!c || !c.subtle) throw new Error('Criptografia indisponível neste navegador.'); return c; }
  function b64(buf) { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(s, 'binary').toString('base64'); }
  function deB64(s) { const bin = typeof atob !== 'undefined' ? atob(s) : Buffer.from(s, 'base64').toString('binary'); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }
  async function chave(senha, sal, iter) {
    const c = cripto(); const base = await c.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
    return c.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function cifrar(conteudo, senha, iter) {
    const c = cripto(); iter = iter || 150000; const sal = c.getRandomValues(new Uint8Array(16)), iv = c.getRandomValues(new Uint8Array(12));
    const k = await chave(senha, sal, iter);
    const dados = await c.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(JSON.stringify(conteudo)));
    return { v: 1, iter: iter, sal: b64(sal), iv: b64(iv), dados: b64(dados) };
  }
  async function decifrar(obj, senha) {
    const c = cripto(); const k = await chave(senha, deB64(obj.sal), obj.iter);
    try { const p = await c.subtle.decrypt({ name: 'AES-GCM', iv: deB64(obj.iv) }, k, deB64(obj.dados)); return JSON.parse(new TextDecoder().decode(p)); }
    catch (e) { throw new Error('Senha incorreta.'); }
  }

  function paraTexto(n) { return titulo(n) + '\n\n' + textoDe(n.html); }
  function nomeArquivo(n, ext) { return (titulo(n).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'anotacao') + '.' + ext; }

  return { LIXEIRA_DIAS: LIXEIRA_DIAS, CORES: CORES, normalizar: normalizar, textoDe: textoDe, titulo: titulo, previa: previa, tags: tags, checklist: checklist, filtrar: filtrar, ordenar: ordenar, expurgar: expurgar, diasNaLixeira: diasNaLixeira,
    simplificar: simplificar, caminho: caminho, caixa: caixa, svg: svg, apagarEm: apagarEm, cifrar: cifrar, decifrar: decifrar, paraTexto: paraTexto, nomeArquivo: nomeArquivo };
});
