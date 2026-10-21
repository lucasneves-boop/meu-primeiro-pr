/* Xadrez: regras completas (roque, en passant, promoção, xeque, mate, afogamento, 50 lances, repetição, material insuficiente) e adversário alfa-beta. Puro. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Xadrez = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const INICIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const N = -8, S = 8, L = 1, O = -1;
  const DIR_C = [-17, -15, -10, -6, 6, 10, 15, 17];
  const DIR_B = [[-1, -1], [-1, 1], [1, -1], [1, 1]], DIR_R = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function col(i) { return i & 7; } function lin(i) { return i >> 3; }
  function branca(p) { return p && p === p.toUpperCase(); }
  function cor(p) { return !p ? null : branca(p) ? 'w' : 'b'; }
  function casa(nome) { return (8 - Number(nome[1])) * 8 + 'abcdefgh'.indexOf(nome[0]); }
  function nomeCasa(i) { return 'abcdefgh'[col(i)] + (8 - lin(i)); }

  function lerFEN(fen) {
    const p = fen.trim().split(/\s+/); const b = new Array(64).fill('');
    let i = 0; for (const ch of p[0]) { if (ch === '/') continue; if (/\d/.test(ch)) i += Number(ch); else b[i++] = ch; }
    return { b: b, vez: p[1] || 'w', roque: p[2] && p[2] !== '-' ? p[2] : '', ep: p[3] && p[3] !== '-' ? casa(p[3]) : -1, meio: Number(p[4] || 0), num: Number(p[5] || 1), hist: [] };
  }
  function fen(e) {
    let s = ''; for (let r = 0; r < 8; r++) { let v = 0; for (let c = 0; c < 8; c++) { const x = e.b[r * 8 + c]; if (!x) v++; else { if (v) { s += v; v = 0; } s += x; } } if (v) s += v; if (r < 7) s += '/'; }
    return s + ' ' + e.vez + ' ' + (e.roque || '-') + ' ' + (e.ep >= 0 ? nomeCasa(e.ep) : '-') + ' ' + e.meio + ' ' + e.num;
  }
  function chavePosicao(e) { return fen(e).split(' ').slice(0, 4).join(' '); }

  function atacada(e, i, por) {
    const b = e.b, r = lin(i), c = col(i);
    // peões
    const dp = por === 'w' ? 1 : -1; const P = por === 'w' ? 'P' : 'p';
    for (const dc of [-1, 1]) { const rr = r + dp, cc = c + dc; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === P) return true; }
    const Cv = por === 'w' ? 'N' : 'n';
    for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === Cv) return true; }
    const K = por === 'w' ? 'K' : 'k';
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === K) return true; }
    const raio = function (dirs, alvos) {
      for (const [dr, dc] of dirs) { let rr = r + dr, cc = c + dc; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { const x = b[rr * 8 + cc]; if (x) { if (cor(x) === por && alvos.indexOf(x.toLowerCase()) >= 0) return true; break; } rr += dr; cc += dc; } }
      return false;
    };
    return raio(DIR_B, ['b', 'q']) || raio(DIR_R, ['r', 'q']);
  }
  function emXeque(e, quem) { const K = (quem || e.vez) === 'w' ? 'K' : 'k'; const i = e.b.indexOf(K); return i >= 0 && atacada(e, i, (quem || e.vez) === 'w' ? 'b' : 'w'); }

  function pseudo(e) {
    const b = e.b, eu = e.vez, ms = [];
    const add = function (de, para, extra) { ms.push(Object.assign({ de: de, para: para, peca: b[de], cap: b[para] || '' }, extra || {})); };
    for (let i = 0; i < 64; i++) {
      const p = b[i]; if (!p || cor(p) !== eu) continue;
      const t = p.toLowerCase(), r = lin(i), c = col(i);
      if (t === 'p') {
        const d = eu === 'w' ? -1 : 1, ini = eu === 'w' ? 6 : 1, ult = eu === 'w' ? 0 : 7;
        const f = i + d * 8;
        const promo = function (de, para, ex) { if (lin(para) === ult) ['q', 'r', 'b', 'n'].forEach(function (pr) { add(de, para, Object.assign({ promo: eu === 'w' ? pr.toUpperCase() : pr }, ex)); }); else add(de, para, ex); };
        if (f >= 0 && f < 64 && !b[f]) { promo(i, f); if (r === ini && !b[f + d * 8]) add(i, f + d * 8, { duplo: true }); }
        for (const dc of [-1, 1]) {
          const cc = c + dc; if (cc < 0 || cc > 7) continue; const a = (r + d) * 8 + cc; if (a < 0 || a > 63) continue;
          if (b[a] && cor(b[a]) !== eu) promo(i, a);
          else if (a === e.ep) add(i, a, { epCap: a - d * 8, cap: b[a - d * 8] });
        }
      } else if (t === 'n') {
        for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) { const rr = r + dr, cc = c + dc; if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue; const a = rr * 8 + cc; if (!b[a] || cor(b[a]) !== eu) add(i, a); }
      } else if (t === 'k') {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue; const a = rr * 8 + cc; if (!b[a] || cor(b[a]) !== eu) add(i, a); }
        const op = eu === 'w' ? 'b' : 'w', base = eu === 'w' ? 60 : 4;
        if (i === base && !atacada(e, i, op)) {
          if (e.roque.indexOf(eu === 'w' ? 'K' : 'k') >= 0 && !b[i + 1] && !b[i + 2] && b[i + 3] === (eu === 'w' ? 'R' : 'r') && !atacada(e, i + 1, op) && !atacada(e, i + 2, op)) add(i, i + 2, { roque: 'curto' });
          if (e.roque.indexOf(eu === 'w' ? 'Q' : 'q') >= 0 && !b[i - 1] && !b[i - 2] && !b[i - 3] && b[i - 4] === (eu === 'w' ? 'R' : 'r') && !atacada(e, i - 1, op) && !atacada(e, i - 2, op)) add(i, i - 2, { roque: 'longo' });
        }
      } else {
        const dirs = t === 'b' ? DIR_B : t === 'r' ? DIR_R : DIR_B.concat(DIR_R);
        for (const [dr, dc] of dirs) { let rr = r + dr, cc = c + dc; while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) { const a = rr * 8 + cc; if (b[a]) { if (cor(b[a]) !== eu) add(i, a); break; } add(i, a); rr += dr; cc += dc; } }
      }
    }
    return ms;
  }

  function fazer(e, m) {
    const b = e.b; const des = { m: m, roque: e.roque, ep: e.ep, meio: e.meio, num: e.num, capturada: m.epCap != null ? b[m.epCap] : b[m.para] };
    b[m.para] = m.promo || b[m.de]; b[m.de] = '';
    if (m.epCap != null) b[m.epCap] = '';
    if (m.roque === 'curto') { b[m.para - 1] = b[m.para + 1]; b[m.para + 1] = ''; }
    if (m.roque === 'longo') { b[m.para + 1] = b[m.para - 2]; b[m.para - 2] = ''; }
    let rq = e.roque;
    const tira = function (ch) { rq = rq.replace(ch, ''); };
    if (m.peca === 'K') { tira('K'); tira('Q'); } if (m.peca === 'k') { tira('k'); tira('q'); }
    [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']].forEach(function (x) { if (m.de === x[0] || m.para === x[0]) tira(x[1]); });
    e.roque = rq;
    e.ep = m.duplo ? (m.de + m.para) / 2 : -1;
    e.meio = m.peca.toLowerCase() === 'p' || des.capturada ? 0 : e.meio + 1;
    if (e.vez === 'b') e.num++;
    e.vez = e.vez === 'w' ? 'b' : 'w';
    return des;
  }
  function desfazer(e, des) {
    const m = des.m, b = e.b;
    e.vez = e.vez === 'w' ? 'b' : 'w';
    b[m.de] = m.peca; b[m.para] = m.epCap != null ? '' : des.capturada;
    if (m.epCap != null) b[m.epCap] = des.capturada;
    if (m.roque === 'curto') { b[m.para + 1] = b[m.para - 1]; b[m.para - 1] = ''; }
    if (m.roque === 'longo') { b[m.para - 2] = b[m.para + 1]; b[m.para + 1] = ''; }
    e.roque = des.roque; e.ep = des.ep; e.meio = des.meio; e.num = des.num;
  }

  function lances(e) {
    const eu = e.vez; return pseudo(e).filter(function (m) { const d = fazer(e, m); const ok = !emXeque(e, eu); desfazer(e, d); return ok; });
  }

  function perft(e, prof) {
    if (prof === 0) return 1; let n = 0;
    for (const m of lances(e)) { const d = fazer(e, m); n += perft(e, prof - 1); desfazer(e, d); }
    return n;
  }

  function materialInsuficiente(e) {
    const ps = e.b.filter(Boolean).filter(function (p) { return p.toLowerCase() !== 'k'; });
    if (!ps.length) return true;
    if (ps.length === 1 && /[nbNB]/.test(ps[0])) return true;
    if (ps.every(function (p) { return /[bB]/.test(p); })) { const cores = {}; e.b.forEach(function (p, i) { if (/[bB]/.test(p)) cores[(lin(i) + col(i)) % 2] = 1; }); return Object.keys(cores).length === 1; }
    return false;
  }

  // Situação: em andamento, xeque, mate, afogamento ou empate.
  function situacao(e) {
    const ls = lances(e); const xq = emXeque(e);
    if (!ls.length) return xq ? { fim: true, tipo: 'mate', vencedor: e.vez === 'w' ? 'b' : 'w' } : { fim: true, tipo: 'afogamento' };
    if (e.meio >= 100) return { fim: true, tipo: '50 lances' };
    if (materialInsuficiente(e)) return { fim: true, tipo: 'material insuficiente' };
    const k = chavePosicao(e); if ((e.hist || []).filter(function (x) { return x === k; }).length >= 2) return { fim: true, tipo: 'repetição' };
    return { fim: false, xeque: xq };
  }

  // Notação algébrica (SAN) do lance m na posição e (antes de jogar).
  function san(e, m) {
    if (m.roque) return m.roque === 'curto' ? 'O-O' : 'O-O-O';
    const t = m.peca.toUpperCase(); let s = '';
    if (t !== 'P') {
      s = t;
      const amb = lances(e).filter(function (x) { return x.peca === m.peca && x.para === m.para && x.de !== m.de; });
      if (amb.length) { if (amb.every(function (x) { return col(x.de) !== col(m.de); })) s += 'abcdefgh'[col(m.de)]; else if (amb.every(function (x) { return lin(x.de) !== lin(m.de); })) s += 8 - lin(m.de); else s += nomeCasa(m.de); }
    } else if (m.cap) s = 'abcdefgh'[col(m.de)];
    if (m.cap) s += 'x';
    s += nomeCasa(m.para);
    if (m.promo) s += '=' + m.promo.toUpperCase();
    const d = fazer(e, m); const ls = lances(e); const xq = emXeque(e); desfazer(e, d);
    return s + (xq ? (ls.length ? '+' : '#') : '');
  }

  function jogar(e, m) { e.hist = e.hist || []; const nota = san(e, m); e.hist.push(chavePosicao(e)); fazer(e, m); return nota; }

  // ---------- avaliação ----------
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
  };
  function avaliar(e) {
    let s = 0;
    for (let i = 0; i < 64; i++) { const p = e.b[i]; if (!p) continue; const t = p.toLowerCase(); const v = VAL[t] + PST[t][branca(p) ? i : (7 - lin(i)) * 8 + col(i)]; s += branca(p) ? v : -v; }
    return e.vez === 'w' ? s : -s;
  }
  function ordenar(ms) { return ms.sort(function (a, b) { return ((b.cap ? VAL[b.cap.toLowerCase()] * 10 - VAL[b.peca.toLowerCase()] : 0) + (b.promo ? 800 : 0)) - ((a.cap ? VAL[a.cap.toLowerCase()] * 10 - VAL[a.peca.toLowerCase()] : 0) + (a.promo ? 800 : 0)); }); }
  function quiesc(e, alfa, beta, prof) {
    const pa = avaliar(e); if (pa >= beta) return beta; if (pa > alfa) alfa = pa; if (prof <= 0) return alfa;
    for (const m of ordenar(lances(e).filter(function (x) { return x.cap || x.promo; }))) { const d = fazer(e, m); const v = -quiesc(e, -beta, -alfa, prof - 1); desfazer(e, d); if (v >= beta) return beta; if (v > alfa) alfa = v; }
    return alfa;
  }
  function alfabeta(e, prof, alfa, beta, ply) {
    const ms = lances(e);
    if (!ms.length) return emXeque(e) ? -100000 + ply : 0;
    if (prof === 0) return quiesc(e, alfa, beta, 4);
    for (const m of ordenar(ms)) { const d = fazer(e, m); const v = -alfabeta(e, prof - 1, -beta, -alfa, ply + 1); desfazer(e, d); if (v >= beta) return beta; if (v > alfa) alfa = v; }
    return alfa;
  }
  // nivel 1..4: profundidade e um pouco de aleatoriedade nos níveis baixos
  function melhorLance(e, nivel, aleatorio) {
    const r = aleatorio || Math.random; const prof = Math.max(1, Math.min(4, nivel || 2));
    const ms = ordenar(lances(e)); if (!ms.length) return null;
    const notas = ms.map(function (m) { const d = fazer(e, m); const v = -alfabeta(e, prof - 1, -Infinity, Infinity, 1); desfazer(e, d); return { m: m, v: v }; }).sort(function (a, b) { return b.v - a.v; });
    const margem = nivel <= 1 ? 120 : nivel === 2 ? 40 : 0;
    const bons = notas.filter(function (x) { return x.v >= notas[0].v - margem; });
    return bons[Math.floor(r() * bons.length)].m;
  }

  return { INICIAL: INICIAL, lerFEN: lerFEN, fen: fen, casa: casa, nomeCasa: nomeCasa, cor: cor, lances: lances, fazer: fazer, desfazer: desfazer, jogar: jogar, perft: perft, emXeque: emXeque, situacao: situacao, san: san, avaliar: avaliar, melhorLance: melhorLance, materialInsuficiente: materialInsuficiente };
});
