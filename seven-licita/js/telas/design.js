/* Design (estilo Canva Pro): formatos, modelos da marca Seven, kit de marca, editor com páginas, camadas, grupos,
   formas, ícones, molduras, gráficos, efeitos de texto, gradientes, sombras, edição de fotos, remoção de fundo,
   redimensionamento mágico, versões, apresentação e exportação PNG/JPG/PDF.
   O que aparece na tela e o que é exportado saem das mesmas regras (js/design.js). */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, confirmar, aviso } = UI;
  const D = self.Design;
  const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const urls = {};
  let ed = null; // estado do editor aberto
  let gSeq = 0;
  const medidor = document.createElement('canvas').getContext('2d');
  const CONTEXTUAIS = ['efeitos', 'foto', 'fontes', 'grafico'];

  function e() { const d = Dados.e; d.design = d.design || {}; const x = d.design; x.designs = x.designs || []; x.uploads = x.uploads || []; x.kit = x.kit || D.kitPadrao(); x.prefs = x.prefs || { grade: 0, margem: false }; return x; }
  function achar(id) { return e().designs.find(function (d) { return d.id === id; }); }
  function carregarFontes() { if (document.getElementById('ds-fontes')) return; const l = document.createElement('link'); l.id = 'ds-fontes'; l.rel = 'stylesheet'; l.href = D.fontesUrl(); document.head.appendChild(l); }
  async function srcImagem(x) { if (x.src) return x.src; if (!x.arq) return ''; if (!urls[x.arq]) { const b = await Dados.lerArquivo(x.arq); if (b) urls[x.arq] = URL.createObjectURL(b); } return urls[x.arq] || ''; }
  async function hidratar(raiz) {
    if (!raiz) return;
    for (const im of raiz.querySelectorAll('img[data-arq]')) { const s = await srcImagem({ arq: im.dataset.arq }); if (s) im.src = s; }
    for (const cv of raiz.querySelectorAll('canvas[data-cvx]')) pintarCanvas(cv);
  }
  function fonteDe(x, tam) { return (x.italico ? 'italic ' : '') + (x.peso || 400) + ' ' + (tam || x.tam) + 'px "' + (x.fonte || 'Montserrat') + '", sans-serif'; }
  async function garantirFonte(x) { if (document.fonts && x.fonte) { try { await document.fonts.load(fonteDe(x, 20)); } catch (er) { /* fonte de sistema */ } } }
  function hexOu(c, pad) { return /^#[0-9a-f]{6}$/i.test(c || '') ? c : pad; }

  // ---------- desenho DOM de um elemento ----------
  function transformCss(x) { return 'rotate(' + (x.rot || 0) + 'deg)' + (x.flipH || x.flipV ? ' scale(' + (x.flipH ? -1 : 1) + ',' + (x.flipV ? -1 : 1) + ')' : ''); }
  function estiloCaixa(x) { return 'left:' + x.x + 'px;top:' + x.y + 'px;width:' + x.w + 'px;height:' + x.h + 'px;transform:' + transformCss(x) + ';'; }
  function sombraCss(s) { return 'drop-shadow(' + (s.dx || 0) + 'px ' + (s.dy || 0) + 'px ' + (s.blur || 0) + 'px ' + D.rgba(s.cor || '#000000', s.opac == null ? 1 : s.opac) + ')'; }
  function estiloBase(x) {
    return estiloCaixa(x) + 'opacity:' + (x.opac == null ? 1 : x.opac) + ';' + (x.sombra ? 'filter:' + sombraCss(x.sombra) + ';' : '') +
      (x.mistura && x.mistura !== 'normal' ? 'mix-blend-mode:' + x.mistura + ';' : '') + (x.oculto ? 'display:none;' : '');
  }
  // Preenchimento em SVG (cor ou gradiente). inv = transformação que leva o gradiente de volta à caixa do elemento.
  function svgFill(x, w, h, inv) {
    if (!x.grad) return { defs: '', fill: esc(x.cor) };
    const g = x.grad, gid = 'dsg' + (++gSeq), tr = inv ? ' gradientTransform="' + inv + '"' : '';
    const stops = '<stop offset="0" stop-color="' + esc(g.c1) + '"/><stop offset="1" stop-color="' + esc(g.c2) + '"/>';
    if (g.tipo === 'radial') return { defs: '<defs><radialGradient id="' + gid + '" gradientUnits="userSpaceOnUse" cx="' + w / 2 + '" cy="' + h / 2 + '" r="' + D.gradRaio(w, h) + '"' + tr + '>' + stops + '</radialGradient></defs>', fill: 'url(#' + gid + ')' };
    const l = D.gradLinha(w, h, g.ang); return { defs: '<defs><linearGradient id="' + gid + '" gradientUnits="userSpaceOnUse" x1="' + l.x1 + '" y1="' + l.y1 + '" x2="' + l.x2 + '" y2="' + l.y2 + '"' + tr + '>' + stops + '</linearGradient></defs>', fill: 'url(#' + gid + ')' };
  }
  function svgPoligono(x, pts) { const f = svgFill(x, x.w, x.h); return '<svg viewBox="0 0 ' + x.w + ' ' + x.h + '" preserveAspectRatio="none" width="100%" height="100%">' + f.defs + '<polygon points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '" fill="' + f.fill + '"/></svg>'; }
  function caixaCaminho(x) { const vb = x.vb || [100, 100]; if (x.prop) { const s = Math.min(x.w / vb[0], x.h / vb[1]); return { sx: s, sy: s, ox: (x.w - vb[0] * s) / 2, oy: (x.h - vb[1] * s) / 2 }; } return { sx: x.w / vb[0], sy: x.h / vb[1], ox: 0, oy: 0 }; }
  function svgCaminho(x) {
    const t = caixaCaminho(x); const f = svgFill(x, x.w, x.h, 'scale(' + 1 / t.sx + ' ' + 1 / t.sy + ') translate(' + -t.ox + ' ' + -t.oy + ')');
    return '<svg viewBox="0 0 ' + x.w + ' ' + x.h + '" width="100%" height="100%">' + f.defs + '<g transform="translate(' + t.ox + ' ' + t.oy + ') scale(' + t.sx + ' ' + t.sy + ')"><path d="' + esc(x.d) + '" fill-rule="evenodd" fill="' + f.fill + '"/></g></svg>';
  }
  function canvasEl(x, r) { return '<canvas class="ds-cv" data-r="' + r + '" data-cvx="' + esc(JSON.stringify(x)) + '"></canvas>'; }
  function htmlEl(x, r) {
    r = r || 1; const b = estiloBase(x); const a = 'class="ds-el ds-' + x.tipo + (x.travado ? ' travado' : '') + (x.destaque && !x.curva ? ' ds-dest' : '') + '" data-id="' + x.id + '"';
    if (x.tipo === 'texto') {
      if (x.curva) return '<div ' + a + ' style="' + b + '">' + canvasEl(x, r) + '</div>';
      const ct = x.contorno ? '-webkit-text-stroke:' + x.contorno.larg + 'px ' + esc(x.contorno.cor) + ';paint-order:stroke fill;' : '';
      const dt = x.destaque ? '--dc:' + esc(x.destaque.cor) + ';--dp:' + (x.destaque.pad || 0) + ';--dr:' + (x.destaque.raio || 0) + ';' : '';
      return '<div ' + a + ' style="' + b + 'font-family:\'' + esc(x.fonte) + '\',sans-serif;font-size:' + x.tam + 'px;font-weight:' + x.peso + ';color:' + (x.vazado ? 'transparent' : esc(x.cor)) + ';text-align:' + x.alinh + ';line-height:' + x.entrelinha + ';letter-spacing:' + (x.espaco || 0) + 'px;font-style:' + (x.italico ? 'italic' : 'normal') + ';text-decoration:' + (x.sublinhado ? 'underline' : 'none') + ';text-transform:' + (x.maiusc ? 'uppercase' : 'none') + ';height:auto;min-height:' + x.h + 'px;' + ct + dt + '"><div class="ds-txt">' + esc(x.texto) + '</div></div>';
    }
    if (x.tipo === 'ret') return '<div ' + a + ' style="' + b + 'background:' + esc(D.corCss(x)) + ';border-radius:' + (x.raio || 0) + 'px;' + (x.borda ? 'border:' + x.borda + 'px solid ' + esc(x.corBorda) + ';' : '') + '"></div>';
    if (x.tipo === 'elipse') return '<div ' + a + ' style="' + b + 'background:' + esc(D.corCss(x)) + ';border-radius:50%;' + (x.borda ? 'border:' + x.borda + 'px solid ' + esc(x.corBorda) + ';' : '') + '"></div>';
    if (x.tipo === 'linha') return '<div ' + a + ' style="' + b + '"><svg viewBox="0 0 ' + x.w + ' ' + x.h + '" preserveAspectRatio="none" width="100%" height="100%">' + D.tracos(x.w, x.h, x.estilo).map(function (s) { return '<rect x="' + s[0] + '" y="0" width="' + Math.max(0.1, s[1] - s[0]) + '" height="' + x.h + '" rx="' + x.h / 2 + '" fill="' + esc(x.cor) + '"/>'; }).join('') + '</svg></div>';
    if (x.tipo === 'triangulo') return '<div ' + a + ' style="' + b + '">' + svgPoligono(x, [[x.w / 2, 0], [x.w, x.h], [0, x.h]]) + '</div>';
    if (x.tipo === 'estrela') return '<div ' + a + ' style="' + b + '">' + svgPoligono(x, D.pontosEstrela(x.w, x.h, x.pontas)) + '</div>';
    if (x.tipo === 'seta') return '<div ' + a + ' style="' + b + '">' + svgPoligono(x, D.pontosSeta(x.w, x.h)) + '</div>';
    if (x.tipo === 'poligono') return '<div ' + a + ' style="' + b + '">' + svgPoligono(x, D.pontosPoligono(x.w, x.h, x.lados)) + '</div>';
    if (x.tipo === 'caminho') return '<div ' + a + ' style="' + b + '">' + svgCaminho(x) + '</div>';
    if (x.tipo === 'grafico') return '<div ' + a + ' style="' + b + '">' + canvasEl(x, r) + '</div>';
    if (x.tipo === 'imagem') {
      const msk = x.mascara ? 'clip-path:' + D.clipCss(x.mascara) + ';' : 'border-radius:' + (x.raio || 0) + 'px;';
      const f = D.filtroCss(x.ajustes); const fx = x.fx == null ? 50 : x.fx * 100, fy = x.fy == null ? 50 : x.fy * 100;
      const zoom = x.ajuste !== 'contain' && x.zoom > 1 ? 'transform:scale(' + x.zoom + ');transform-origin:' + fx + '% ' + fy + '%;' : '';
      const img = x.src || x.arq ? '<img ' + (x.arq ? 'data-arq="' + esc(x.arq) + '"' : 'src="' + esc(x.src) + '"') + ' alt="" draggable="false" style="object-fit:' + x.ajuste + ';object-position:' + fx + '% ' + fy + '%;' + zoom + (f !== 'none' ? 'filter:' + f + ';' : '') + '">' : '<div class="ds-vazio"><span>＋</span>Moldura<br>escolha uma foto em Uploads</div>';
      return '<div ' + a + ' style="' + b + '"><div class="ds-msk" style="' + msk + '">' + img + '</div></div>';
    }
    return '';
  }
  function fundoCss(p) { return p.grad ? D.gradCss(p.grad) : p.fundo; }
  function htmlPagina(d, p, escala, interativo) {
    const pr = e().prefs; const r = Math.max(0.25, Math.min(2, escala * (window.devicePixelRatio || 1)));
    const extra = interativo ? '<div class="ds-guias"></div>' + (pr.grade ? '<div class="ds-grade" style="background-size:' + pr.grade + 'px ' + pr.grade + 'px"></div>' : '') + (pr.margem ? '<div class="ds-margem" style="inset:' + Math.round(Math.min(d.w, d.h) * 0.05) + 'px"></div>' : '') : '';
    return '<div class="ds-pg-caixa" style="width:' + d.w * escala + 'px;height:' + d.h * escala + 'px"><div class="ds-pg" data-pg="' + p.id + '" style="width:' + d.w + 'px;height:' + d.h + 'px;background:' + esc(fundoCss(p)) + ';transform:scale(' + escala + ');--inv:' + (1 / escala) + '">' + p.elementos.map(function (x) { return htmlEl(x, r); }).join('') + extra + '</div></div>';
  }
  // Elementos desenhados em canvas também na tela (texto curvo e gráficos): mesma função da exportação.
  async function pintarCanvas(cv) {
    let x; try { x = JSON.parse(cv.dataset.cvx); } catch (er) { return; }
    await garantirFonte(x);
    const r = Number(cv.dataset.r) || 1; cv.width = Math.max(1, Math.round(x.w * r)); cv.height = Math.max(1, Math.round(x.h * r));
    const c = cv.getContext('2d'); c.setTransform(r, 0, 0, r, 0, 0); c.clearRect(0, 0, x.w, x.h);
    if (x.tipo === 'grafico') desenharGrafico(c, x, x.w, x.h); else desenharCurvo(c, x, x.w, x.h);
  }

  // ---------- desenho em canvas (exportação e canvases da tela) ----------
  function estiloPreench(c, x, w, h) {
    if (!x.grad) return x.cor; const g = x.grad; let gr;
    if (g.tipo === 'radial') gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, D.gradRaio(w, h)); else { const l = D.gradLinha(w, h, g.ang); gr = c.createLinearGradient(l.x1, l.y1, l.x2, l.y2); }
    gr.addColorStop(0, g.c1); gr.addColorStop(1, g.c2); return gr;
  }
  function caminhoPontos(pts) { const p = new Path2D(); pts.forEach(function (q, i) { if (i) p.lineTo(q[0], q[1]); else p.moveTo(q[0], q[1]); }); p.closePath(); return p; }
  function caminhoArred(c, x, y, w, h, r) { r = Math.max(0, Math.min(r || 0, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function linhasTexto(c, x) { c.font = fonteDe(x); if ('letterSpacing' in c) c.letterSpacing = (x.espaco || 0) + 'px'; const txt = x.maiusc ? x.texto.toUpperCase() : x.texto; return D.quebrarTexto(txt, x.w + 0.5, function (s) { return c.measureText(s).width; }); }
  function alturaReal(x) { if (x.tipo !== 'texto' || x.curva) return x.h; return Math.max(x.h, linhasTexto(medidor, x).length * x.tam * x.entrelinha); }
  function desenharTexto(c, x, hT) {
    const linhas = linhasTexto(c, x); const lh = x.tam * x.entrelinha;
    if (x.destaque) { c.fillStyle = x.destaque.cor; const p = x.destaque.pad || 0; c.beginPath(); c.roundRect(-p, -p, x.w + 2 * p, hT + 2 * p, x.destaque.raio || 0); c.fill(); }
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.lineJoin = 'round';
    linhas.forEach(function (l, i) {
      const w = c.measureText(l).width; const px = x.alinh === 'center' ? (x.w - w) / 2 : x.alinh === 'right' ? x.w - w : 0; const py = lh * i + lh / 2;
      if (x.contorno && x.contorno.larg) { c.lineWidth = x.contorno.larg; c.strokeStyle = x.contorno.cor; c.strokeText(l, px, py); }
      if (!x.vazado) { c.fillStyle = x.cor; c.fillText(l, px, py); }
      if (x.sublinhado) { c.fillStyle = x.vazado && x.contorno ? x.contorno.cor : x.cor; c.fillRect(px, py + x.tam * 0.45, w, Math.max(1, x.tam / 16)); }
    });
  }
  function layoutCurvo(c, x) {
    c.font = fonteDe(x); if ('letterSpacing' in c) c.letterSpacing = (x.espaco || 0) + 'px';
    const chars = Array.from((x.maiusc ? x.texto.toUpperCase() : x.texto).replace(/\n/g, ' '));
    return { chars: chars, L: D.curvaLayout(chars.map(function (ch) { return c.measureText(ch).width; }), x.tam, x.curva) };
  }
  function desenharCurvo(c, x, w, h) {
    const lc = layoutCurvo(c, x), L = lc.L; const s = Math.min(w / L.w, h / L.h);
    c.save(); c.translate(w / 2, h / 2); c.scale(s, s); c.translate(-(L.x0 + L.w / 2), -(L.y0 + L.h / 2));
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    lc.chars.forEach(function (ch, i) {
      const p = L.pos[i]; c.save(); c.translate(p.x, p.y); c.rotate(p.ang);
      if (x.contorno && x.contorno.larg) { c.lineWidth = x.contorno.larg; c.strokeStyle = x.contorno.cor; c.strokeText(ch, 0, 0); }
      if (!x.vazado) { c.fillStyle = x.cor; c.fillText(ch, 0, 0); }
      c.restore();
    });
    c.restore();
  }
  function tamanhoCurvo(x) { const L = layoutCurvo(medidor, x).L; return { w: Math.round(L.w), h: Math.round(L.h) }; }
  function clipMascara(c, x) {
    const w = x.w, h = x.h, m = x.mascara;
    c.beginPath();
    if (m === 'circulo') c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (m === 'arredondado') c.roundRect(0, 0, w, h, [{ x: w * 0.12, y: h * 0.12 }]);
    else if (m === 'arco') c.roundRect(0, 0, w, h, [{ x: w / 2, y: h / 2 }, { x: w / 2, y: h / 2 }, 0, 0]);
    else if (D.mascaraPontos(m)) { D.mascaraPontos(m).forEach(function (q, i) { if (i) c.lineTo(q[0] * w, q[1] * h); else c.moveTo(q[0] * w, q[1] * h); }); c.closePath(); }
    else c.roundRect(0, 0, w, h, Math.min(x.raio || 0, w / 2, h / 2));
    c.clip();
  }
  async function desenharEl(c, x, hT, escala) {
    const w = x.w, h = x.h;
    if (x.tipo === 'texto') { if (x.curva) desenharCurvo(c, x, w, h); else desenharTexto(c, x, hT); return; }
    if (x.tipo === 'ret') { caminhoArred(c, 0, 0, w, h, x.raio); if (x.cor !== 'transparent' || x.grad) { c.fillStyle = estiloPreench(c, x, w, h); c.fill(); } if (x.borda) { caminhoArred(c, x.borda / 2, x.borda / 2, w - x.borda, h - x.borda, Math.max(0, (x.raio || 0) - x.borda / 2)); c.lineWidth = x.borda; c.strokeStyle = x.corBorda; c.stroke(); } return; }
    if (x.tipo === 'elipse') { c.beginPath(); c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); c.fillStyle = estiloPreench(c, x, w, h); c.fill(); if (x.borda) { c.beginPath(); c.ellipse(w / 2, h / 2, Math.max(0, w / 2 - x.borda / 2), Math.max(0, h / 2 - x.borda / 2), 0, 0, Math.PI * 2); c.lineWidth = x.borda; c.strokeStyle = x.corBorda; c.stroke(); } return; }
    if (x.tipo === 'linha') { c.fillStyle = x.cor; D.tracos(w, h, x.estilo).forEach(function (s) { c.beginPath(); c.roundRect(s[0], 0, Math.max(0.1, s[1] - s[0]), h, h / 2); c.fill(); }); return; }
    if (['triangulo', 'estrela', 'seta', 'poligono'].indexOf(x.tipo) >= 0) {
      const pts = x.tipo === 'triangulo' ? [[w / 2, 0], [w, h], [0, h]] : x.tipo === 'estrela' ? D.pontosEstrela(w, h, x.pontas) : x.tipo === 'seta' ? D.pontosSeta(w, h) : D.pontosPoligono(w, h, x.lados);
      c.fillStyle = estiloPreench(c, x, w, h); c.fill(caminhoPontos(pts)); return;
    }
    if (x.tipo === 'caminho') { const t = caixaCaminho(x); const p = new Path2D(); p.addPath(new Path2D(x.d), new DOMMatrix().translate(t.ox, t.oy).scale(t.sx, t.sy)); c.fillStyle = estiloPreench(c, x, w, h); c.fill(p, 'evenodd'); return; }
    if (x.tipo === 'grafico') { desenharGrafico(c, x, w, h); return; }
    if (x.tipo === 'imagem') {
      c.save(); clipMascara(c, x);
      const s = await srcImagem(x); const im = s ? await carregarImg(s) : null;
      if (im) { const r = D.recorte(im.width, im.height, w, h, x.ajuste, x.zoom, x.fx, x.fy); const f = D.filtroCss(x.ajustes, escala); if (f !== 'none') c.filter = f; c.drawImage(im, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh); }
      else if (!s) { c.fillStyle = '#e9e4da'; c.fillRect(0, 0, w, h); }
      c.restore();
    }
  }
  function margemEl(x) { if (x.tipo !== 'texto') return 4; return Math.ceil(Math.max(x.tam * 0.4, (x.destaque ? x.destaque.pad || 0 : 0) + 4, (x.contorno ? x.contorno.larg : 0) + 4)); }
  // Desenha um elemento numa camada à parte e cola na página com giro, espelho, transparência, mistura e sombra.
  async function comporEl(c, x, escala) {
    const hT = alturaReal(x), M = margemEl(x);
    const off = document.createElement('canvas'); off.width = Math.max(1, Math.ceil((x.w + 2 * M) * escala)); off.height = Math.max(1, Math.ceil((hT + 2 * M) * escala));
    const oc = off.getContext('2d'); oc.scale(escala, escala); oc.translate(M, M);
    if (x.tipo === 'texto' || x.tipo === 'grafico') await garantirFonte(x);
    await desenharEl(oc, x, hT, escala);
    c.save(); c.globalAlpha = x.opac == null ? 1 : x.opac; c.globalCompositeOperation = x.mistura && x.mistura !== 'normal' ? x.mistura : 'source-over';
    if (x.sombra) {
      const fx = x.flipH ? -1 : 1, fy = x.flipV ? -1 : 1, a = (x.rot || 0) * Math.PI / 180; const dx = (x.sombra.dx || 0) * fx, dy = (x.sombra.dy || 0) * fy;
      c.shadowOffsetX = (dx * Math.cos(a) - dy * Math.sin(a)) * escala; c.shadowOffsetY = (dx * Math.sin(a) + dy * Math.cos(a)) * escala;
      c.shadowBlur = (x.sombra.blur || 0) * escala; c.shadowColor = D.rgba(x.sombra.cor || '#000000', x.sombra.opac == null ? 1 : x.sombra.opac);
    }
    c.translate(x.x + x.w / 2, x.y + hT / 2); c.rotate((x.rot || 0) * Math.PI / 180); if (x.flipH || x.flipV) c.scale(x.flipH ? -1 : 1, x.flipV ? -1 : 1);
    c.drawImage(off, -x.w / 2 - M, -hT / 2 - M, x.w + 2 * M, hT + 2 * M);
    c.restore();
  }

  // ---------- gráficos (barras, colunas, linha, pizza, rosca) ----------
  function cortar(c, t, max) { t = String(t); if (c.measureText(t).width <= max) return t; while (t.length > 1 && c.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; }
  function desenharGrafico(c, x, w, h) {
    const fonte = '"' + (x.fonte || 'Montserrat') + '", sans-serif', ct = x.corTexto || '#0a1929', base = Math.max(10, Math.min(w, h) * 0.045);
    const cores = x.cores && x.cores.length ? x.cores : D.CORES_GRAFICO; let dados = (x.dados || []).map(function (d) { return { r: d.r, v: Math.max(0, Number(d.v) || 0) }; });
    let topo = 0; c.textBaseline = 'middle';
    if (x.titulo) { c.font = '700 ' + base * 1.3 + 'px ' + fonte; c.fillStyle = ct; c.textAlign = 'left'; c.fillText(cortar(c, x.titulo, w), 0, base * 0.8); topo = base * 2.2; }
    if (!dados.length) return;
    const grade = D.rgba(hexOu(ct, '#0a1929'), 0.14); const t = x.tipoG || 'colunas';
    if (t === 'pizza' || t === 'rosca') {
      if (dados.length > 6) { const ord = dados.slice().sort(function (a, b) { return b.v - a.v; }); dados = ord.slice(0, 5).concat([{ r: 'Outros', v: ord.slice(5).reduce(function (s, d) { return s + d.v; }, 0) }]); }
      const total = dados.reduce(function (s, d) { return s + d.v; }, 0) || 1; const lado = w > (h - topo) * 1.25;
      const legW = lado ? w * 0.42 : w, legH = lado ? 0 : dados.length * base * 1.7;
      const r = Math.max(4, Math.min((lado ? w - legW : w) / 2, (h - topo - legH) / 2) - 2), cx = lado ? r + 2 : w / 2, cy = topo + r + 2;
      let a0 = -Math.PI / 2;
      dados.forEach(function (d, i) { const a1 = a0 + d.v / total * Math.PI * 2; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, a0, a1); c.closePath(); c.fillStyle = cores[i % cores.length]; c.fill(); c.lineWidth = Math.max(1.5, r * 0.02); c.strokeStyle = x.corGap || '#ffffff'; c.stroke(); a0 = a1; });
      if (t === 'rosca') { c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(cx, cy, r * 0.58, 0, Math.PI * 2); c.fill(); c.restore(); c.fillStyle = ct; c.textAlign = 'center'; c.font = '800 ' + r * 0.28 + 'px ' + fonte; c.fillText(D.formatarValor(total), cx, cy - r * 0.04); c.font = '500 ' + r * 0.12 + 'px ' + fonte; c.fillText('total', cx, cy + r * 0.2); }
      c.textAlign = 'left'; c.font = '500 ' + base + 'px ' + fonte;
      dados.forEach(function (d, i) {
        const lx = lado ? w - legW + base * 0.5 : base * 0.5, ly = lado ? topo + base + i * base * 1.8 : topo + 2 * r + base * 1.4 + i * base * 1.7;
        c.fillStyle = cores[i % cores.length]; c.beginPath(); c.roundRect(lx, ly - base * 0.45, base * 0.9, base * 0.9, 2); c.fill();
        c.fillStyle = ct; c.fillText(cortar(c, d.r + ' · ' + Math.round(d.v / total * 100) + '%', (lado ? legW : w) - base * 2.2), lx + base * 1.4, ly);
      });
      return;
    }
    const esc0 = D.escalaEixo(Math.max.apply(null, dados.map(function (d) { return d.v; })));
    c.font = '500 ' + base * 0.9 + 'px ' + fonte;
    const ticks = []; for (let v = 0; v <= esc0.max + 1e-9; v += esc0.passo) ticks.push(v);
    if (t === 'barras') {
      c.font = '500 ' + base + 'px ' + fonte; const rotW = Math.min(w * 0.35, Math.max.apply(null, dados.map(function (d) { return c.measureText(d.r).width; })) + base * 0.6);
      const x0 = rotW, x1 = w - base * 3.2, y0 = topo, y1 = h - base * 1.6, banda = (y1 - y0) / dados.length, bh = Math.min(banda * 0.62, base * 3);
      c.strokeStyle = grade; c.lineWidth = 1; c.font = '500 ' + base * 0.85 + 'px ' + fonte; c.fillStyle = D.rgba(hexOu(ct, '#0a1929'), 0.7); c.textAlign = 'center';
      ticks.forEach(function (v) { const px = x0 + (x1 - x0) * v / esc0.max; c.beginPath(); c.moveTo(px, y0); c.lineTo(px, y1); c.stroke(); c.fillText(D.formatarValor(v), px, y1 + base * 0.9); });
      dados.forEach(function (d, i) {
        const cy = y0 + banda * i + banda / 2, bw = (x1 - x0) * d.v / esc0.max;
        c.fillStyle = cores[0]; c.beginPath(); c.roundRect(x0, cy - bh / 2, Math.max(0.5, bw), bh, [0, 4, 4, 0]); c.fill();
        c.fillStyle = ct; c.textAlign = 'right'; c.font = '500 ' + base + 'px ' + fonte; c.fillText(cortar(c, d.r, rotW - base * 0.6), x0 - base * 0.5, cy);
        if (x.valores !== false) { c.textAlign = 'left'; c.font = '700 ' + base + 'px ' + fonte; c.fillText(D.formatarValor(d.v), x0 + bw + base * 0.4, cy); }
      });
      return;
    }
    const tickW = Math.max.apply(null, ticks.map(function (v) { return c.measureText(D.formatarValor(v)).width; })) + base * 0.6;
    const x0 = tickW, x1 = w - base * 0.4, y0 = topo + base * (x.valores !== false ? 1.2 : 0.4), y1 = h - base * 1.8;
    const py = function (v) { return y1 - (y1 - y0) * v / esc0.max; };
    c.strokeStyle = grade; c.lineWidth = 1; c.textAlign = 'right'; c.fillStyle = D.rgba(hexOu(ct, '#0a1929'), 0.7);
    ticks.forEach(function (v) { c.beginPath(); c.moveTo(x0, py(v)); c.lineTo(x1, py(v)); c.stroke(); c.fillText(D.formatarValor(v), x0 - base * 0.4, py(v)); });
    const banda = (x1 - x0) / dados.length;
    if (t === 'linha') {
      const pts = dados.map(function (d, i) { return [x0 + banda * i + banda / 2, py(d.v)]; });
      c.strokeStyle = cores[0]; c.lineWidth = Math.max(2, base * 0.18); c.lineJoin = 'round'; c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke();
      pts.forEach(function (p, i) { c.beginPath(); c.arc(p[0], p[1], Math.max(4, base * 0.35), 0, Math.PI * 2); c.fillStyle = cores[0]; c.fill(); c.lineWidth = 2; c.strokeStyle = x.corGap || '#ffffff'; c.stroke(); if (x.valores !== false) { c.fillStyle = ct; c.textAlign = 'center'; c.font = '700 ' + base + 'px ' + fonte; c.fillText(D.formatarValor(dados[i].v), p[0], p[1] - base * 1.1); } });
    } else {
      const bw = Math.min(banda * 0.62, base * 5);
      dados.forEach(function (d, i) {
        const cx = x0 + banda * i + banda / 2, top = py(d.v);
        c.fillStyle = cores[0]; c.beginPath(); c.roundRect(cx - bw / 2, top, bw, Math.max(0.5, y1 - top), [4, 4, 0, 0]); c.fill();
        if (x.valores !== false) { c.fillStyle = ct; c.textAlign = 'center'; c.font = '700 ' + base + 'px ' + fonte; c.fillText(D.formatarValor(d.v), cx, top - base * 0.7); }
      });
    }
    c.fillStyle = ct; c.textAlign = 'center'; c.font = '500 ' + base + 'px ' + fonte;
    dados.forEach(function (d, i) { c.fillText(cortar(c, d.r, banda - 4), x0 + banda * i + banda / 2, y1 + base * 0.95); });
  }

  // ---------- início ----------
  function telaInicio(el) {
    carregarFontes();
    const x = e(); const lista = x.designs.slice().sort(function (a, b) { return b.editadoEm - a.editadoEm; });
    const thumb = function (d, larg) { const s = larg / Math.max(d.w, d.h); return '<div class="ds-thumb" style="height:' + Math.round(d.h * s) + 'px;width:' + Math.round(d.w * s) + 'px">' + htmlPagina(d, d.paginas[0], s, false) + '</div>'; };
    el.innerHTML = '<div class="ds-home"><section class="ds-hero"><h1>O que vamos criar hoje?</h1><p>Posts, stories, apresentações, propostas e gráficos com a identidade da Seven.</p><div class="ds-hero-tags"><span>Kit de marca</span><span>Efeitos de texto</span><span>Edição de fotos</span><span>Remover fundo</span><span>Gráficos</span><span>Redimensionar</span><span>Versões</span></div></section>' +
      '<div class="ds-formatos">' + D.FORMATOS.map(function (f) { const k = 54 / Math.max(f.w, f.h); return '<button class="ds-formato" data-f="' + f.id + '"><span class="ds-fmt-ic"><i style="width:' + Math.round(f.w * k) + 'px;height:' + Math.round(f.h * k) + 'px"></i></span><b>' + esc(f.t) + '</b><small>' + f.w + ' × ' + f.h + ' px</small></button>'; }).join('') + '<button class="ds-formato" data-f="custom"><span class="ds-fmt-ic">＋</span><b>Tamanho personalizado</b><small>largura × altura</small></button></div>' +
      '<h2>Modelos Seven</h2><div class="ds-modelos">' + D.MODELOS.map(function (m) { const d = D.modelo(m.id); return '<button class="ds-modelo" data-m="' + m.id + '">' + thumb(d, 220) + '<b>' + esc(m.t) + '</b></button>'; }).join('') + '</div>' +
      '<h2>Seus designs</h2>' + (lista.length ? '<div class="ds-meus">' + lista.map(function (d) { return '<div class="ds-meu" data-d="' + d.id + '"><a href="#/design/editar/' + d.id + '">' + thumb(d, 200) + '</a><div><b>' + esc(d.titulo) + '</b><small>' + esc((D.FORMATOS.find(function (f) { return f.id === d.formato; }) || { t: d.w + '×' + d.h }).t) + ' · ' + d.paginas.length + ' pág. · ' + new Date(d.editadoEm).toLocaleDateString('pt-BR') + '</small></div><button class="icone" data-a="menu" aria-label="Opções">⋯</button></div>'; }).join('') + '</div>' : '<p class="mudo">Nenhum design ainda. Escolha um formato ou modelo acima.</p>') + '</div>';
    hidratar(el);
    el.onclick = async function (ev) {
      const f = ev.target.closest('[data-f]'), m = ev.target.closest('[data-m]'), mn = ev.target.closest('[data-a=menu]');
      if (f) {
        let fmt = D.FORMATOS.find(function (x2) { return x2.id === f.dataset.f; });
        if (!fmt) { const r = await modal({ titulo: 'Tamanho personalizado', corpo: '<div class="linha">' + campo('Largura (px)', '<input type="number" name="w" min="50" max="5000" value="1080" required>') + campo('Altura (px)', '<input type="number" name="h" min="50" max="5000" value="1080" required>') + '</div>' }); if (!r) return; fmt = { id: 'custom', t: 'Personalizado', w: Number(r.get('w')), h: Number(r.get('h')) }; }
        const d = D.novoDesign(fmt); x.designs.push(d); Dados.salvar(); location.hash = '#/design/editar/' + d.id;
      }
      if (m) { const d = D.modelo(m.dataset.m); x.designs.push(d); Dados.salvar(); location.hash = '#/design/editar/' + d.id; }
      if (mn) {
        const d = achar(mn.closest('[data-d]').dataset.d);
        const r = await modal({ titulo: d.titulo, botao: 'OK', corpo: [['abrir', 'Abrir'], ['duplicar', 'Fazer uma cópia'], ['renomear', 'Renomear'], ['excluir', 'Excluir']].map(function (o, i) { return '<label class="check an-op"><input type="radio" name="op" value="' + o[0] + '"' + (i === 0 ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('') });
        if (!r) return; const op = r.get('op');
        if (op === 'abrir') location.hash = '#/design/editar/' + d.id;
        if (op === 'duplicar') { const c = D.redimensionarDesign(d, { id: d.formato, w: d.w, h: d.h }); c.titulo = d.titulo + ' (cópia)'; x.designs.push(c); }
        if (op === 'renomear') { const r2 = await modal({ titulo: 'Renomear', corpo: campo('Nome', '<input name="t" value="' + esc(d.titulo) + '">') }); if (r2) d.titulo = r2.get('t').trim() || d.titulo; }
        if (op === 'excluir' && await confirmar('Excluir design', 'Excluir <b>' + esc(d.titulo) + '</b>?', 'Excluir')) x.designs = x.designs.filter(function (y) { return y !== d; });
        Dados.salvar(); App.redesenhar();
      }
    };
  }

  // ---------- editor ----------
  function todosEls() { return ed.d.paginas.reduce(function (a, p) { return a.concat(p.elementos); }, []); }
  function elPorId(id) { return todosEls().find(function (x) { return x.id === id; }); }
  function paginaDe(id) { return ed.d.paginas.find(function (p) { return p.elementos.some(function (x) { return x.id === id; }); }); }
  function selecionados() { return ed.sel.map(elPorId).filter(Boolean); }
  function salvar(hist) { ed.d.editadoEm = Date.now(); Dados.salvar(); if (hist !== false) ed.hist.registrar(ed.d.paginas); }
  let tSalvar = null;
  function salvarDepois() { clearTimeout(tSalvar); tSalvar = setTimeout(function () { if (ed) salvar(); }, 350); }
  function paginaAtiva() { return ed.d.paginas.find(function (p) { return p.id === ed.pg; }) || ed.d.paginas[0]; }
  function kit() { return e().kit; }
  function paleta() { const k = kit().cores || []; return k.concat(D.PALETA.filter(function (c) { return k.indexOf(c) < 0; })); }

  function telaEditor(el, id) {
    carregarFontes();
    const d = achar(id); if (!d) { el.innerHTML = UI.vazio('Design não encontrado', '', '<a class="btn" href="#/design">Voltar</a>'); return; }
    if (!ed || ed.d !== d) { ed = { d: d, sel: [], pg: d.paginas[0].id, zoom: null, aba: 'modelos', hist: D.historico(), clip: null, tolFundo: 40 }; ed.hist.registrar(d.paginas); if (!(d.versoes || []).length) { D.salvarVersao(d, 'Versão inicial', true); Dados.salvar(); } }
    el.innerHTML = '<div class="ds-ed">' +
      '<header class="ds-topo"><a class="btn mini fantasma" href="#/design">← Início</a><input id="ds-tit" value="' + esc(d.titulo) + '" aria-label="Nome do design"><span class="mini mudo">' + d.w + ' × ' + d.h + ' px</span><span class="ds-espaco"></span>' +
      '<button class="icone" data-a="desfazer" title="Desfazer (Ctrl+Z)" aria-label="Desfazer">↶</button><button class="icone" data-a="refazer" title="Refazer (Ctrl+Y)" aria-label="Refazer">↷</button>' +
      '<div class="ds-zoom"><button class="icone" data-a="zoom-" aria-label="Diminuir zoom">−</button><button class="btn mini fantasma" data-a="zoom-ajustar" id="ds-zoom-v">100%</button><button class="icone" data-a="zoom+" aria-label="Aumentar zoom">＋</button></div>' +
      '<button class="btn mini fantasma" data-a="redimensionar" title="Redimensionar para outro formato">⤢ Redimensionar</button><button class="btn mini fantasma" data-a="apresentar" title="Apresentar em tela cheia">▶ Apresentar</button>' +
      '<button class="btn primario" data-a="baixar">⤓ Baixar</button></header>' +
      '<nav class="ds-abas">' + [['modelos', '▦', 'Modelos'], ['elementos', '◆', 'Elementos'], ['texto', 'T', 'Texto'], ['marca', '★', 'Marca'], ['uploads', '⤒', 'Uploads'], ['fundo', '▣', 'Fundo'], ['camadas', '☰', 'Camadas'], ['ferramentas', '⚙', 'Ferramentas']].map(function (a) { return '<button data-aba="' + a[0] + '" class="' + (ed.aba === a[0] ? 'on' : '') + '"><span>' + a[1] + '</span>' + a[2] + '</button>'; }).join('') + '</nav>' +
      '<aside class="ds-painel" id="ds-painel"></aside>' +
      '<main class="ds-area" id="ds-area"><div class="ds-props" id="ds-props"></div><div class="ds-paginas" id="ds-paginas"></div></main></div>';
    if (ed.zoom == null) { const area = el.querySelector('#ds-area'); ed.zoom = Math.max(0.1, Math.min(1, (area.clientWidth - 80) / d.w, (window.innerHeight - 220) / d.h)); }
    desenharPainel(); desenharPaginas(); desenharProps();
    ligarEditor(el);
  }

  function desenharPaginas() {
    const box = document.getElementById('ds-paginas'); if (!box) return; const d = ed.d;
    box.innerHTML = d.paginas.map(function (p, i) {
      return '<section class="ds-pagina' + (p.id === ed.pg ? ' ativa' : '') + '" data-pgw="' + p.id + '"><header><span>Página ' + (i + 1) + (d.paginas.length > 1 ? ' de ' + d.paginas.length : '') + '</span><span><button class="icone" data-pa="subir" title="Mover para cima" aria-label="Mover página para cima"' + (i ? '' : ' disabled') + '>↑</button><button class="icone" data-pa="descer" title="Mover para baixo" aria-label="Mover página para baixo"' + (i < d.paginas.length - 1 ? '' : ' disabled') + '>↓</button><button class="icone" data-pa="duplicar" title="Duplicar página" aria-label="Duplicar página">⧉</button><button class="icone" data-pa="excluir" title="Excluir página" aria-label="Excluir página"' + (d.paginas.length > 1 ? '' : ' disabled') + '>🗑</button></span></header>' + htmlPagina(d, p, ed.zoom, true) + '</section>';
    }).join('') + '<button class="btn ds-add-pg" data-a="add-pagina">＋ Adicionar página</button>';
    const z = document.getElementById('ds-zoom-v'); if (z) z.textContent = Math.round(ed.zoom * 100) + '%';
    marcarSelecao(); hidratar(box);
    if (ed.aba === 'camadas') desenharPainel();
  }
  function marcarSelecao() {
    document.querySelectorAll('.ds-el.sel').forEach(function (n) { n.classList.remove('sel'); });
    document.querySelectorAll('.ds-alcas').forEach(function (n) { n.remove(); });
    ed.sel.forEach(function (id) { const n = document.querySelector('.ds-paginas .ds-el[data-id="' + id + '"]'); if (n) n.classList.add('sel'); });
    if (ed.sel.length === 1) {
      const x = elPorId(ed.sel[0]); const n = x && document.querySelector('.ds-paginas .ds-el[data-id="' + x.id + '"]'); if (!n || x.travado || x.oculto) return;
      const h = document.createElement('div'); h.className = 'ds-alcas'; h.style.cssText = estiloCaixa(Object.assign({}, x, { h: n.offsetHeight, flipH: false, flipV: false })) + '--inv:' + (1 / ed.zoom) + ';';
      const so = x.tipo === 'texto' && !x.curva;
      h.innerHTML = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].filter(function (k) { return !so || /e|w/.test(k); }).map(function (k) { return '<i class="ds-alca a-' + k + '" data-alca="' + k + '"></i>'; }).join('') + '<i class="ds-alca a-rot" data-alca="rot" title="Girar">↻</i>';
      n.parentNode.appendChild(h);
    }
    if (ed.aba === 'camadas') document.querySelectorAll('.ds-camadas li').forEach(function (li) { li.classList.toggle('on', ed.sel.indexOf(li.dataset.lid) >= 0); });
  }
  function atualizarEl(x) {
    document.querySelectorAll('.ds-paginas .ds-el[data-id="' + x.id + '"]').forEach(function (n) {
      const t = document.createElement('div'); t.innerHTML = htmlEl(x, Math.max(0.25, Math.min(2, ed.zoom * (window.devicePixelRatio || 1)))); const novo = t.firstChild; if (n.classList.contains('sel')) novo.classList.add('sel'); n.replaceWith(novo); hidratar(novo);
    });
  }

  // ---------- painel esquerdo ----------
  function icSvg(i, vb) { return '<svg viewBox="0 0 ' + (vb || 24) + ' ' + (vb || 24) + '" width="34" height="34"><path d="' + esc(i.d) + '" fill-rule="evenodd" fill="currentColor"/></svg>'; }
  function faixa(caminho, rot, v, min, max, passo, sufixo) { return '<label class="ds-faixa"><span>' + rot + '</span><input type="range" data-ef="' + caminho + '" min="' + min + '" max="' + max + '" step="' + (passo || 1) + '" value="' + v + '"><output>' + (Math.round(v * 100) / 100) + (sufixo || '') + '</output></label>'; }
  function corEf(caminho, v, rot) { return '<label class="ds-corl"><input type="color" data-ef="' + caminho + '" value="' + hexOu(v, '#000000') + '"><span>' + (rot || 'Cor') + '</span></label>'; }
  function secao(t, corpo, chave, ligado) { return '<section class="ds-sec"><header><h4>' + t + '</h4>' + (chave ? '<label class="ds-chave"><input type="checkbox" data-eftog="' + chave + '"' + (ligado ? ' checked' : '') + '><i></i></label>' : '') + '</header>' + (chave && !ligado ? '' : corpo) + '</section>'; }
  function desenharPainel() {
    const box = document.getElementById('ds-painel'); if (!box) return; let a = ed.aba; let h = '';
    const s = selecionados(); const x = s.length === 1 ? s[0] : null;
    if (CONTEXTUAIS.indexOf(a) >= 0 && (!x || (a === 'foto' && x.tipo !== 'imagem') || (a === 'grafico' && x.tipo !== 'grafico') || (a === 'fontes' && x.tipo !== 'texto'))) {
      if (!(a === 'fontes' && s.length && s.every(function (y) { return y.tipo === 'texto'; }))) a = ed.aba = 'elementos';
    }
    const k = kit();
    if (a === 'modelos') h = '<h3>Modelos</h3><p class="mini mudo">Aplicar um modelo substitui as páginas atuais (dá para desfazer).</p><div class="ds-pmodelos">' + D.MODELOS.map(function (m) { const d = D.modelo(m.id); const sc = 130 / Math.max(d.w, d.h); return '<button data-modelo="' + m.id + '"><div class="ds-thumb" style="width:' + Math.round(d.w * sc) + 'px;height:' + Math.round(d.h * sc) + 'px">' + htmlPagina(d, d.paginas[0], sc, false) + '</div><small>' + esc(m.t) + '</small></button>'; }).join('') + '</div>';
    if (a === 'elementos') h = '<h3>Elementos</h3><h4>Formas</h4><div class="ds-formas">' + [['ret', '<i class="f-ret"></i>', 'Retângulo'], ['ret-r', '<i class="f-ret r"></i>', 'Retângulo arredondado'], ['elipse', '<i class="f-cir"></i>', 'Círculo'], ['triangulo', '▲', 'Triângulo'], ['estrela', '★', 'Estrela'], ['seta', '➜', 'Seta'], ['pentagono', '⬟', 'Pentágono'], ['hexagono', '⬢', 'Hexágono'], ['losango', '◆', 'Losango']].map(function (f) { return '<button data-add="' + f[0] + '" title="' + f[2] + '" aria-label="' + f[2] + '">' + f[1] + '</button>'; }).join('') + D.FORMAS.map(function (f) { return '<button data-forma="' + f.id + '" title="' + esc(f.t) + '" aria-label="' + esc(f.t) + '">' + icSvg(f, 100) + '</button>'; }).join('') + '</div>' +
      '<h4>Linhas</h4><div class="ds-linhas">' + [['solido', 'Sólida'], ['tracejado', 'Tracejada'], ['pontilhado', 'Pontilhada']].map(function (l) { return '<button data-linha="' + l[0] + '" title="Linha ' + l[1].toLowerCase() + '"><i class="l-' + l[0] + '"></i><small>' + l[1] + '</small></button>'; }).join('') + '</div>' +
      '<h4>Ícones</h4><div class="ds-icones">' + D.ICONES.map(function (i) { return '<button data-icone="' + i.id + '" title="' + esc(i.t) + '" aria-label="Ícone ' + esc(i.t) + '">' + icSvg(i) + '</button>'; }).join('') + '</div>' +
      '<h4>Molduras para fotos</h4><div class="ds-molduras">' + D.MOLDURAS.map(function (m) { return '<button data-moldura="' + m.id + '" title="Moldura ' + esc(m.t) + '"><i style="clip-path:' + D.clipCss(m.id) + '"></i><small>' + esc(m.t) + '</small></button>'; }).join('') + '</div>' +
      '<h4>Gráficos</h4><div class="ds-graficos">' + [['colunas', '▮▮▮', 'Colunas'], ['barras', '☰', 'Barras'], ['linha', '⟋', 'Linha'], ['pizza', '◔', 'Pizza'], ['rosca', '◎', 'Rosca']].map(function (g) { return '<button data-grafico="' + g[0] + '"><span>' + g[1] + '</span><small>' + g[2] + '</small></button>'; }).join('') + '</div>';
    if (a === 'texto') h = '<h3>Texto</h3><button class="ds-add-t t1" data-add="titulo" style="font-family:\'' + esc(k.fonteTitulo) + '\'">Adicionar um título</button><button class="ds-add-t t2" data-add="subtitulo" style="font-family:\'' + esc(k.fonteSub) + '\'">Adicionar um subtítulo</button><button class="ds-add-t t3" data-add="corpo" style="font-family:\'' + esc(k.fonteCorpo) + '\'">Adicionar corpo de texto</button>' +
      '<h4>Estilos de texto</h4><div class="ds-estilos-t">' + [['combo', '<b>Título forte</b><small>com subtítulo dourado</small>', 'combo'], ['neon', '<b class="e-neon">NEON</b>', ''], ['contorno', '<b class="e-contorno">CONTORNO</b>', ''], ['etiqueta', '<b class="e-etiqueta">ETIQUETA</b>', ''], ['eco', '<b class="e-eco">ECO</b>', ''], ['curvo', '<b class="e-curvo">⌒ SELO CURVO</b>', ''], ['vazado', '<b class="e-vazado">VAZADO</b>', ''], ['elevado', '<b class="e-elevado">Elevado</b>', '']].map(function (t) { return '<button class="ds-add-t ' + t[2] + '" data-add="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><p class="mini mudo">Selecione um texto e use <b>Efeitos</b> na barra de cima para sombra, contorno, destaque, neon e curvatura.</p>';
    if (a === 'marca') h = '<h3>Kit de marca</h3><h4>Logos</h4><div class="ds-logos"><button data-logo="img/seven-logo.png"><img src="img/seven-logo.png" alt="Logo Seven"></button><button data-logo="img/seven-marca.png"><img src="img/seven-marca.png" alt="Marca Seven"></button>' + (k.logos || []).map(function (l) { return '<button data-up="' + esc(l) + '" title="Logo da marca"><img data-arq="' + esc(l) + '" alt="Logo"></button>'; }).join('') + '</div><button class="btn mini" data-a="kit-logo">⤒ Adicionar logo</button>' +
      '<h4>Cores da marca</h4><div class="ds-paleta">' + (k.cores || []).map(function (c, i) { return '<span class="ds-kitcor"><button data-cor="' + esc(c) + '" style="background:' + esc(c) + '" title="' + esc(c) + '" aria-label="Aplicar cor ' + esc(c) + '"></button><button class="ds-kitdel" data-kitdel="' + i + '" aria-label="Remover cor ' + esc(c) + '">×</button></span>'; }).join('') + '<label class="ds-kitadd" title="Adicionar cor"><input type="color" id="ds-kit-cor" value="#b68d40">＋</label></div><p class="mini mudo">Clique numa cor para aplicar ao elemento selecionado (ou ao fundo, se nada estiver selecionado).</p>' +
      '<h4>Fontes da marca</h4>' + [['fonteTitulo', 'Título'], ['fonteSub', 'Subtítulo'], ['fonteCorpo', 'Corpo']].map(function (f) { return campo(f[1], '<select data-kit="' + f[0] + '">' + opcoes(D.FONTES, k[f[0]]) + '</select>'); }).join('') +
      '<button class="btn mini" data-a="kit-aplicar">Aplicar no design todo</button>';
    if (a === 'uploads') h = '<h3>Uploads</h3><button class="btn primario" data-a="upload">⤒ Enviar imagens</button><p class="mini mudo">Ficam guardadas neste navegador. Com uma moldura vazia selecionada, a foto entra nela.</p><div class="ds-ups">' + e().uploads.map(function (u) { return '<button data-up="' + esc(u.arq) + '" title="' + esc(u.nome) + '"><img data-arq="' + esc(u.arq) + '" alt="' + esc(u.nome) + '"></button>'; }).join('') + '</div>';
    if (a === 'fundo') { const p = paginaAtiva(); const g = p.grad || { tipo: 'linear', c1: hexOu(p.fundo, '#050505'), c2: '#b68d40', ang: 135 };
      h = '<h3>Fundo da página</h3><h4>Cores</h4><div class="ds-paleta grande">' + paleta().map(function (c) { return '<button data-fundo="' + esc(c) + '" style="background:' + esc(c) + '" aria-label="Fundo ' + esc(c) + '"></button>'; }).join('') + '</div>' + campo('Outra cor', '<input type="color" id="ds-fundo-cor" value="' + esc(hexOu(p.fundo, '#ffffff')) + '">') +
      '<h4>Gradientes</h4><div class="ds-paleta grande">' + D.GRADIENTES.map(function (gr, i) { return '<button data-fundo-grad="' + i + '" style="background:' + esc(D.gradCss(gr)) + '" aria-label="Gradiente ' + (i + 1) + '"></button>'; }).join('') + '</div>' +
      '<div class="ds-gradcustom"><label class="ds-corl"><input type="color" id="ds-fg1" value="' + esc(hexOu(g.c1, '#050505')) + '"><span>Cor 1</span></label><label class="ds-corl"><input type="color" id="ds-fg2" value="' + esc(hexOu(g.c2, '#b68d40')) + '"><span>Cor 2</span></label><select id="ds-fgt">' + opcoes([{ v: 'linear', t: 'Linear' }, { v: 'radial', t: 'Radial' }], g.tipo) + '</select></div>' +
      '<label class="ds-faixa"><span>Ângulo</span><input type="range" id="ds-fga" min="0" max="360" value="' + (g.ang || 0) + '"><output>' + (g.ang || 0) + '°</output></label><div class="grupo-botoes"><button class="btn mini" data-a="fundo-grad">Aplicar gradiente</button>' + (p.grad ? '<button class="btn mini fantasma" data-a="fundo-sem-grad">Tirar gradiente</button>' : '') + '</div>'; }
    if (a === 'camadas') { const p = paginaAtiva();
      h = '<h3>Camadas</h3><p class="mini mudo">De cima (à frente) para baixo. Arraste para reordenar.</p>' + (p.elementos.length ? '<ol class="ds-camadas">' + p.elementos.slice().reverse().map(function (y) { return '<li draggable="true" data-lid="' + y.id + '" class="' + (ed.sel.indexOf(y.id) >= 0 ? 'on' : '') + (y.oculto ? ' oculto' : '') + '"><span class="ds-cam-tipo">' + ({ texto: 'T', imagem: '▣', grafico: '▮', caminho: '◆' }[y.tipo] || '■') + '</span><span class="ds-cam-nome">' + esc(D.nomeEl(y)) + (y.grupo ? ' <small>· grupo</small>' : '') + '</span><button class="icone" data-cam="oculto" title="' + (y.oculto ? 'Mostrar' : 'Ocultar') + '" aria-label="' + (y.oculto ? 'Mostrar' : 'Ocultar') + '">' + (y.oculto ? '◌' : '◉') + '</button><button class="icone" data-cam="travado" title="' + (y.travado ? 'Destravar' : 'Travar') + '" aria-label="' + (y.travado ? 'Destravar' : 'Travar') + '">' + (y.travado ? '🔒' : '🔓') + '</button></li>'; }).join('') + '</ol>' : '<p class="mudo">Página vazia.</p>'); }
    if (a === 'ferramentas') { const pr = e().prefs;
      h = '<h3>Ferramentas</h3><section class="ds-sec"><header><h4>Redimensionar mágico</h4></header><p class="mini mudo">Leva o design para outro formato, ajustando tudo proporcionalmente.</p><button class="btn mini primario" data-a="redimensionar">⤢ Redimensionar…</button></section>' +
        '<section class="ds-sec"><header><h4>Histórico de versões</h4></header><button class="btn mini" data-a="versao">Salvar versão agora</button><ol class="ds-versoes">' + (ed.d.versoes || []).slice().reverse().map(function (v) { return '<li><span><b>' + esc(v.nome || (v.auto ? 'Automática' : 'Versão')) + '</b><small>' + new Date(v.em).toLocaleString('pt-BR') + '</small></span><button class="btn mini" data-versao="' + v.id + '">Restaurar</button></li>'; }).join('') + '</ol></section>' +
        '<section class="ds-sec"><header><h4>Exibir</h4></header>' + campo('Grade', '<select data-pref="grade">' + opcoes([{ v: '0', t: 'Sem grade' }, { v: '20', t: '20 px' }, { v: '40', t: '40 px' }, { v: '60', t: '60 px' }, { v: '100', t: '100 px' }], String(pr.grade || 0)) + '</select>', 'Com grade, os elementos se encaixam nela ao arrastar (Alt solta).') + '<label class="check-inline"><input type="checkbox" data-pref="margem"' + (pr.margem ? ' checked' : '') + '> Margem de segurança</label></section>' +
        '<section class="ds-sec"><header><h4>Atalhos</h4></header><dl class="ds-atalhos">' + [['Ctrl+Z / Ctrl+Y', 'Desfazer / refazer'], ['Ctrl+C / Ctrl+V', 'Copiar / colar'], ['Ctrl+D', 'Duplicar'], ['Ctrl+G / Ctrl+Shift+G', 'Agrupar / desagrupar'], ['Ctrl+Alt+C / Ctrl+Alt+V', 'Copiar / colar estilo'], ['Ctrl+B / I / U', 'Negrito, itálico, sublinhado'], ['Ctrl+] / Ctrl+[', 'Avançar / recuar camada'], ['Setas (Shift = 10 px)', 'Mover'], ['Shift + arrastar alça', 'Manter proporção'], ['Alt + arrastar', 'Sem guias'], ['Enter', 'Editar texto'], ['Delete', 'Excluir']].map(function (t) { return '<dt><kbd>' + t[0] + '</kbd></dt><dd>' + t[1] + '</dd>'; }).join('') + '</dl></section>'; }
    if (a === 'efeitos' && x) h = painelEfeitos(x);
    if (a === 'foto' && x) h = painelFoto(x);
    if (a === 'grafico' && x) h = painelGrafico(x);
    if (a === 'fontes') { const q = Nucleo.normalizar(ed.buscaFonte || ''); const atual = s[0].fonte; const lista = [k.fonteTitulo, k.fonteSub, k.fonteCorpo].filter(function (f, i, l) { return l.indexOf(f) === i; });
      h = '<h3>Fontes</h3><input type="search" id="ds-bfonte" placeholder="Buscar fonte" value="' + esc(ed.buscaFonte || '') + '"><h4>Da marca</h4><div class="ds-fontes">' + lista.map(function (f) { return '<button data-fonte="' + esc(f) + '" class="' + (f === atual ? 'on' : '') + '" style="font-family:\'' + esc(f) + '\'">' + esc(f) + '</button>'; }).join('') + '</div><h4>Todas</h4><div class="ds-fontes" id="ds-lfontes">' + D.FONTES.filter(function (f) { return !q || Nucleo.normalizar(f).indexOf(q) >= 0; }).map(function (f) { return '<button data-fonte="' + esc(f) + '" class="' + (f === atual ? 'on' : '') + '" style="font-family:\'' + esc(f) + '\'">' + esc(f) + '<small>' + (D.CATEGORIA_FONTE[f] || 'sem serifa') + '</small></button>'; }).join('') + '</div>'; }
    box.innerHTML = h; hidratar(box);
    document.querySelectorAll('.ds-abas button').forEach(function (b) { b.classList.toggle('on', b.dataset.aba === a); });
  }
  function painelEfeitos(x) {
    let h = '<h3>Efeitos</h3>'; const so = x.sombra || {};
    if (x.tipo === 'texto') {
      h += '<div class="ds-efeitos">' + [['nenhum', 'Nenhum'], ['sombra', 'Sombra'], ['elevado', 'Elevado'], ['eco', 'Eco'], ['neon', 'Neon'], ['contorno', 'Contorno'], ['vazado', 'Vazado'], ['destaque', 'Destaque']].map(function (f) { return '<button data-efeito="' + f[0] + '"><span class="e-' + f[0] + '">Aa</span><small>' + f[1] + '</small></button>'; }).join('') + '</div>';
    }
    h += secao('Sombra', faixa('sombra.dx', 'Deslocar X', so.dx || 0, -100, 100) + faixa('sombra.dy', 'Deslocar Y', so.dy || 0, -100, 100) + faixa('sombra.blur', 'Desfoque', so.blur || 0, 0, 120) + faixa('sombra.opac', 'Intensidade', so.opac == null ? 1 : so.opac, 0, 1, 0.05) + corEf('sombra.cor', so.cor || '#000000'), 'sombra', !!x.sombra);
    if (x.tipo === 'texto') {
      const ct = x.contorno || {}, dt = x.destaque || {};
      h += secao('Contorno', faixa('contorno.larg', 'Espessura', ct.larg || 2, 0.5, 30, 0.5) + corEf('contorno.cor', ct.cor || '#050505') + '<label class="check-inline"><input type="checkbox" data-eftog="vazado"' + (x.vazado ? ' checked' : '') + '> Vazado (só o contorno)</label>', 'contorno', !!x.contorno);
      if (!x.curva) h += secao('Destaque (fundo do texto)', faixa('destaque.pad', 'Espaço', dt.pad || 0, 0, 80) + faixa('destaque.raio', 'Arredondar', dt.raio || 0, 0, 80) + corEf('destaque.cor', dt.cor || '#b68d40'), 'destaque', !!x.destaque);
      h += secao('Curvar', faixa('curva', 'Curva', x.curva || 0, -100, 100) + '<p class="mini mudo">Positivo arqueia para cima; negativo, para baixo. Duplo clique edita o texto.</p>', 'curva', !!x.curva);
    }
    if (['ret', 'elipse', 'triangulo', 'estrela', 'seta', 'poligono', 'caminho'].indexOf(x.tipo) >= 0) {
      const g = x.grad || { tipo: 'linear', c1: hexOu(x.cor, '#050505'), c2: '#b68d40', ang: 135 };
      h += '<section class="ds-sec"><header><h4>Preenchimento</h4></header><div class="ds-seg">' + [['', 'Sólido'], ['linear', 'Linear'], ['radial', 'Radial']].map(function (o) { return '<button data-preench="' + o[0] + '" class="' + ((x.grad ? x.grad.tipo : '') === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>' +
        (x.grad ? corEf('grad.c1', g.c1, 'Cor 1') + corEf('grad.c2', g.c2, 'Cor 2') + (g.tipo === 'linear' ? faixa('grad.ang', 'Ângulo', g.ang || 0, 0, 360, 1, '°') : '') + '<div class="ds-paleta grande">' + D.GRADIENTES.map(function (gr, i) { return '<button data-elgrad="' + i + '" style="background:' + esc(D.gradCss(gr)) + '" aria-label="Gradiente ' + (i + 1) + '"></button>'; }).join('') + '</div>' : corEf('cor', x.cor)) + '</section>';
    }
    if (x.tipo === 'linha') h += '<section class="ds-sec"><header><h4>Estilo da linha</h4></header><div class="ds-seg">' + [['solido', 'Sólida'], ['tracejado', 'Tracejada'], ['pontilhado', 'Pontilhada']].map(function (o) { return '<button data-estilo-linha="' + o[0] + '" class="' + ((x.estilo || 'solido') === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>' + faixa('h', 'Espessura', x.h, 1, 60) + '</section>';
    h += '<section class="ds-sec"><header><h4>Transparência e mistura</h4></header>' + faixa('opac', 'Opacidade', x.opac == null ? 1 : x.opac, 0, 1, 0.05) + campo('Modo de mistura', '<select data-ef="mistura">' + opcoes(D.MISTURAS.map(function (m) { return { v: m[0], t: m[1] }; }), x.mistura || 'normal') + '</select>') + '</section>';
    return h;
  }
  function painelFoto(x) {
    const aj = D.ajustesDe(x); const prev = function (f) { return '<img ' + (x.arq ? 'data-arq="' + esc(x.arq) + '"' : 'src="' + esc(x.src) + '"') + ' alt="" style="filter:' + D.filtroCss(f.a) + '">'; };
    return '<h3>Editar foto</h3>' + (x.src || x.arq ? '<h4>Filtros</h4><div class="ds-filtros">' + D.FILTROS.map(function (f) { return '<button data-filtro="' + f.id + '" class="' + ((x.filtro || 'original') === f.id ? 'on' : '') + '">' + prev(f) + '<small>' + esc(f.t) + '</small></button>'; }).join('') + '</div>' +
      secao('Ajustes', faixa('ajustes.brilho', 'Brilho', aj.brilho, 0, 200, 1, '%') + faixa('ajustes.contraste', 'Contraste', aj.contraste, 0, 200, 1, '%') + faixa('ajustes.saturacao', 'Saturação', aj.saturacao, 0, 200, 1, '%') + faixa('ajustes.matiz', 'Matiz', aj.matiz, -180, 180, 1, '°') + faixa('ajustes.sepia', 'Sépia', aj.sepia, 0, 100, 1, '%') + faixa('ajustes.pb', 'Preto e branco', aj.pb, 0, 100, 1, '%') + faixa('ajustes.desfoque', 'Desfoque', aj.desfoque, 0, 20, 0.5, ' px') + '<button class="btn mini fantasma" data-a="foto-reset">Restaurar ajustes</button>') +
      secao('Recortar e posicionar', '<div class="ds-seg">' + [['cover', 'Preencher'], ['contain', 'Ajustar']].map(function (o) { return '<button data-ajuste="' + o[0] + '" class="' + (x.ajuste === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>' + (x.ajuste !== 'contain' ? faixa('zoom', 'Zoom', x.zoom || 1, 1, 4, 0.05, '×') : '') + faixa('fx', 'Horizontal', x.fx == null ? 0.5 : x.fx, 0, 1, 0.01) + faixa('fy', 'Vertical', x.fy == null ? 0.5 : x.fy, 0, 1, 0.01)) +
      secao('Remover fundo', '<p class="mini mudo">Apaga o fundo de cor uniforme (branco, verde, cinza…) a partir das bordas. Não é IA: funciona melhor em logos, produtos e fotos de estúdio.</p><label class="ds-faixa"><span>Tolerância</span><input type="range" id="ds-tol" min="5" max="120" value="' + ed.tolFundo + '"><output>' + ed.tolFundo + '</output></label><button class="btn mini primario" data-a="remover-fundo">✂ Remover fundo</button>') : '<p class="mudo">Moldura vazia: escolha uma foto abaixo.</p>') +
      secao('Moldura', '<div class="ds-molduras">' + [{ id: '', t: 'Nenhuma' }].concat(D.MOLDURAS).map(function (m) { return '<button data-mascara="' + m.id + '" class="' + ((x.mascara || '') === m.id ? 'on' : '') + '"><i style="' + (m.id ? 'clip-path:' + D.clipCss(m.id) : '') + '"></i><small>' + esc(m.t) + '</small></button>'; }).join('') + '</div>') +
      secao('Trocar a foto', e().uploads.length ? '<div class="ds-ups">' + e().uploads.map(function (u) { return '<button data-trocar="' + esc(u.arq) + '" title="' + esc(u.nome) + '"><img data-arq="' + esc(u.arq) + '" alt="' + esc(u.nome) + '"></button>'; }).join('') + '</div>' : '<p class="mini mudo">Envie fotos na aba Uploads.</p>');
  }
  function painelGrafico(x) {
    return '<h3>Gráfico</h3><div class="ds-seg">' + [['colunas', 'Colunas'], ['barras', 'Barras'], ['linha', 'Linha'], ['pizza', 'Pizza'], ['rosca', 'Rosca']].map(function (o) { return '<button data-gtipo="' + o[0] + '" class="' + (x.tipoG === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      campo('Título', '<input data-ef="titulo" value="' + esc(x.titulo || '') + '" placeholder="opcional">') +
      campo('Dados', '<textarea id="ds-gdados" rows="8" spellcheck="false">' + esc(D.dadosTexto(x.dados)) + '</textarea>', 'Um item por linha: rótulo; valor (aceita 1.234,56).') +
      '<label class="check-inline"><input type="checkbox" data-eftog="valores"' + (x.valores !== false ? ' checked' : '') + '> Mostrar valores</label>' +
      '<h4>Cores</h4><div class="ds-gcores">' + (x.tipoG === 'pizza' || x.tipoG === 'rosca' ? (x.cores || D.CORES_GRAFICO) : (x.cores || D.CORES_GRAFICO).slice(0, 1)).map(function (c, i) { return corEf('cores.' + i, c, x.tipoG === 'pizza' || x.tipoG === 'rosca' ? String(i + 1) : 'Barras'); }).join('') + corEf('corTexto', x.corTexto || '#0a1929', 'Texto') + '</div>' +
      campo('Fonte', '<select data-ef="fonte">' + opcoes(D.FONTES, x.fonte || 'Montserrat') + '</select>');
  }

  // ---------- barra de propriedades ----------
  function cores(k, atual, rot) { const p = paleta(); return '<details class="ds-cor-pop"><summary title="' + (rot || 'Cor') + '" aria-label="' + (rot || 'Cor') + '"><i style="background:' + esc(atual) + '"></i></summary><div class="ds-cores">' + p.slice(0, 12).map(function (c) { return '<button data-prop="' + k + '" data-v="' + esc(c) + '" class="' + (c === atual ? 'on' : '') + '" style="background:' + esc(c) + '" aria-label="' + esc(c) + '"></button>'; }).join('') + '<label class="ds-cor-outra" title="Outra cor"><input type="color" data-propc="' + k + '" value="' + esc(hexOu(atual, '#000000')) + '" aria-label="Escolher outra cor">＋</label></div></details>'; }
  function num(k, v, rot, min, max, passo) { return '<label class="ds-num"><span>' + rot + '</span><input type="number" data-num="' + k + '" value="' + (Math.round(v * 10) / 10) + '"' + (min != null ? ' min="' + min + '"' : '') + (max != null ? ' max="' + max + '"' : '') + ' step="' + (passo || 1) + '"></label>'; }
  function desenharProps() {
    const box = document.getElementById('ds-props'); if (!box) return; const s = selecionados();
    if (CONTEXTUAIS.indexOf(ed.aba) >= 0 || ed.aba === 'camadas') desenharPainel();
    const pincel = ed.pincel ? '<span class="ds-pincel-on">🖌 Clique num elemento para colar o estilo · <button class="btn mini fantasma" data-a="pincel-cancelar">Cancelar</button></span>' : '';
    if (!s.length) { const p = paginaAtiva(); box.innerHTML = pincel + '<span class="mini mudo">Página ' + (ed.d.paginas.indexOf(p) + 1) + ' · fundo</span>' + cores('fundo', p.fundo, 'Cor de fundo') + '<span class="ds-dica mini mudo">Clique num elemento para editar · arraste na página para selecionar vários</span>'; return; }
    if (s.length > 1) { const agrupados = s[0].grupo && s.every(function (y) { return y.grupo === s[0].grupo; });
      box.innerHTML = pincel + '<span class="mini mudo">' + s.length + ' selecionados</span>' + (agrupados ? '<button class="btn mini" data-a="desagrupar" title="Ctrl+Shift+G">Desagrupar</button>' : '<button class="btn mini" data-a="agrupar" title="Ctrl+G">Agrupar</button>') + [['esquerda', '⇤'], ['centro-h', '↔'], ['direita', '⇥'], ['topo', '⤒'], ['centro-v', '↕'], ['base', '⤓']].map(function (a) { return '<button class="icone" data-alinhar="' + a[0] + '" title="Alinhar ' + a[0] + '" aria-label="Alinhar ' + a[0] + '">' + a[1] + '</button>'; }).join('') + '<button class="btn mini" data-distribuir="h">Distribuir ↔</button><button class="btn mini" data-distribuir="v">Distribuir ↕</button>' + num('opac', Math.round((s[0].opac == null ? 1 : s[0].opac) * 100), 'Opac.%', 0, 100) + '<span class="ds-espaco"></span><button class="icone" data-a="duplicar" title="Duplicar (Ctrl+D)" aria-label="Duplicar">⧉</button><button class="icone perigo" data-a="excluir" title="Excluir (Del)" aria-label="Excluir">🗑</button>'; return; }
    const x = s[0]; let h = pincel;
    if (x.tipo === 'texto') h += '<select data-prop-sel="fonte" aria-label="Fonte">' + opcoes(D.FONTES, x.fonte) + '</select><button class="btn mini fantasma" data-a="fontes" title="Ver todas as fontes">Aa</button>' + num('tam', x.tam, 'Tam', 6, 400) + '<select data-prop-sel="peso" aria-label="Peso">' + opcoes([{ v: '400', t: 'Normal' }, { v: '500', t: 'Médio' }, { v: '600', t: 'Seminegrito' }, { v: '700', t: 'Negrito' }, { v: '800', t: 'Extra' }], String(x.peso)) + '</select>' + cores('cor', x.cor) +
      ['left', 'center', 'right'].map(function (al) { return '<button class="icone' + (x.alinh === al ? ' on' : '') + '" data-prop="alinh" data-v="' + al + '" aria-label="Alinhar ' + al + '">' + { left: '⯇', center: '≡', right: '⯈' }[al] + '</button>'; }).join('') +
      '<button class="icone' + (x.italico ? ' on' : '') + '" data-tog="italico" aria-label="Itálico"><i>I</i></button><button class="icone' + (x.sublinhado ? ' on' : '') + '" data-tog="sublinhado" aria-label="Sublinhado"><u>U</u></button><button class="icone' + (x.maiusc ? ' on' : '') + '" data-tog="maiusc" aria-label="Maiúsculas">aA</button>' +
      '<details class="ds-mais"><summary class="btn mini fantasma" title="Espaçamento entre letras e linhas">↕ Espaço</summary><div>' + num('espaco', x.espaco || 0, 'Letras', -10, 60) + num('entrelinha', x.entrelinha, 'Linhas', 0.6, 3, 0.1) + '</div></details>';
    if (['ret', 'elipse', 'triangulo', 'estrela', 'seta', 'linha', 'poligono', 'caminho'].indexOf(x.tipo) >= 0) h += x.grad ? '<button class="ds-gradbtn" data-a="efeitos" style="background:' + esc(D.gradCss(x.grad)) + '" title="Gradiente: editar em Efeitos" aria-label="Editar gradiente"></button>' : cores('cor', x.cor);
    if (x.tipo === 'ret') h += num('raio', x.raio || 0, 'Raio', 0, 2000);
    if (x.tipo === 'ret' || x.tipo === 'elipse') h += num('borda', x.borda || 0, 'Borda', 0, 100) + (x.borda ? cores('corBorda', x.corBorda, 'Cor da borda') : '');
    if (x.tipo === 'estrela') h += num('pontas', x.pontas, 'Pontas', 3, 12);
    if (x.tipo === 'poligono') h += num('lados', x.lados, 'Lados', 3, 12);
    if (x.tipo === 'imagem') h += '<button class="btn mini primario" data-a="foto">✎ Editar foto</button><select data-prop-sel="ajuste" aria-label="Ajuste">' + opcoes([{ v: 'cover', t: 'Preencher' }, { v: 'contain', t: 'Ajustar' }], x.ajuste) + '</select>' + (x.mascara ? '' : num('raio', x.raio || 0, 'Raio', 0, 2000));
    if (x.tipo === 'grafico') h += '<button class="btn mini primario" data-a="grafico">▮ Editar dados</button><select data-prop-sel="tipoG" aria-label="Tipo de gráfico">' + opcoes([{ v: 'colunas', t: 'Colunas' }, { v: 'barras', t: 'Barras' }, { v: 'linha', t: 'Linha' }, { v: 'pizza', t: 'Pizza' }, { v: 'rosca', t: 'Rosca' }], x.tipoG) + '</select>';
    h += '<button class="btn mini" data-a="efeitos">✦ Efeitos</button><span class="ds-sep"></span>' +
      '<button class="icone' + (x.flipH ? ' on' : '') + '" data-tog="flipH" title="Espelhar na horizontal" aria-label="Espelhar na horizontal">⇋</button><button class="icone' + (x.flipV ? ' on' : '') + '" data-tog="flipV" title="Espelhar na vertical" aria-label="Espelhar na vertical">⇵</button>' +
      '<button class="icone" data-a="pincel" title="Copiar estilo (Ctrl+Alt+C)" aria-label="Copiar estilo">🖌</button>' +
      '<details class="ds-mais"><summary class="btn mini fantasma">Posição</summary><div>' + num('x', x.x, 'X') + num('y', x.y, 'Y') + num('w', x.w, 'L', 1) + num('h', x.h, 'A', 1) + num('rot', x.rot || 0, 'Giro°', -360, 360) + num('opac', Math.round((x.opac == null ? 1 : x.opac) * 100), 'Opac.%', 0, 100) + '<div class="ds-al">' + [['esquerda', '⇤'], ['centro-h', '↔'], ['direita', '⇥'], ['topo', '⤒'], ['centro-v', '↕'], ['base', '⤓']].map(function (a) { return '<button class="icone" data-alinhar="' + a[0] + '" aria-label="Alinhar na página ' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div><div class="ds-al">' + [['frente', 'Trazer à frente'], ['subir', 'Avançar'], ['descer', 'Recuar'], ['tras', 'Enviar para trás']].map(function (a) { return '<button class="btn mini" data-ordem="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div></div></details>' +
      '<span class="ds-espaco"></span><button class="icone' + (x.travado ? ' on' : '') + '" data-tog="travado" title="Travar" aria-label="Travar">' + (x.travado ? '🔒' : '🔓') + '</button><button class="icone" data-a="duplicar" title="Duplicar (Ctrl+D)" aria-label="Duplicar">⧉</button><button class="icone perigo" data-a="excluir" title="Excluir (Del)" aria-label="Excluir">🗑</button>';
    box.innerHTML = h;
  }

  // ---------- ações ----------
  function escalaPg() { return Math.min(ed.d.w, ed.d.h) / 1080; }
  function adicionar(x, manterTam) {
    const p = paginaAtiva(); const d = ed.d; const k = escalaPg();
    if (!manterTam) { if (x.tipo !== 'texto' || x.w === 300) { x.w = Math.round(x.w * k * (x.tipo === 'texto' ? 2 : 1)); } if (x.tipo !== 'texto') x.h = Math.round(x.h * k); }
    x.x = Math.round((d.w - x.w) / 2); x.y = Math.round((d.h - x.h) / 2);
    p.elementos.push(x); ed.sel = [x.id]; salvar(); desenharPaginas(); desenharProps();
  }
  function aplicarCor(c) {
    const s = selecionados();
    if (!s.length) { const p = paginaAtiva(); p.fundo = c; delete p.grad; salvar(); desenharPaginas(); desenharProps(); return; }
    s.forEach(function (x) { if (x.tipo === 'imagem') return; if (x.tipo === 'grafico') x.cores = [c].concat((x.cores || D.CORES_GRAFICO).slice(1)); else { x.cor = c; delete x.grad; } atualizarEl(x); }); salvar(); marcarSelecao(); desenharProps();
  }
  function setCaminho(x, caminho, v) { const ps = caminho.split('.'); let o = x; for (let i = 0; i < ps.length - 1; i++) { if (o[ps[i]] == null || typeof o[ps[i]] !== 'object') o[ps[i]] = /^\d+$/.test(ps[i + 1]) ? [] : {}; o = o[ps[i]]; } o[ps[ps.length - 1]] = v; }
  function padraoEfeito(x, k) {
    const t = x.tam || 48;
    if (k === 'sombra') return { dx: Math.round(t * 0.06) || 6, dy: Math.round(t * 0.06) || 6, blur: Math.round(t * 0.12) || 10, cor: '#000000', opac: 0.45 };
    if (k === 'contorno') return { larg: Math.max(1, Math.round(t * 0.04)), cor: '#050505' };
    if (k === 'destaque') return { cor: '#b68d40', pad: Math.round(t * 0.25), raio: Math.round(t * 0.15) };
    return null;
  }
  function aplicarCurva(x, v) {
    const cx = x.x + x.w / 2, cy = x.y + alturaReal(x) / 2;
    if (v) { if (!x.curva) x.wReta = x.w; x.curva = v; delete x.destaque; const t = tamanhoCurvo(x); x.w = t.w; x.h = t.h; }
    else { delete x.curva; x.w = x.wReta || x.w; delete x.wReta; x.h = Math.round(x.tam * x.entrelinha); }
    x.x = Math.round(cx - x.w / 2); x.y = Math.round(cy - alturaReal(x) / 2);
  }
  function textoPronto(tipo) {
    const kk = escalaPg(), k = kit(), M = D.MARCA;
    const base = function (o) { return D.el('texto', Object.assign({ fonte: k.fonteTitulo, peso: 800, alinh: 'center' }, o)); };
    if (tipo === 'neon') { const x = base({ texto: 'NEON', tam: Math.round(120 * kk), cor: '#fff7e0', w: Math.round(700 * kk), h: Math.round(140 * kk) }); return Object.assign(x, D.efeitoTexto('neon', Object.assign({}, x, { cor: M.dourado }))); }
    if (tipo === 'contorno') { const x = base({ texto: 'CONTORNO', tam: Math.round(110 * kk), cor: M.dourado, w: Math.round(900 * kk), h: Math.round(130 * kk) }); return Object.assign(x, D.efeitoTexto('contorno', x)); }
    if (tipo === 'etiqueta') { const x = base({ texto: 'ETIQUETA', tam: Math.round(56 * kk), cor: M.preto, espaco: Math.round(4 * kk), w: Math.round(420 * kk), h: Math.round(70 * kk) }); return Object.assign(x, D.efeitoTexto('destaque', x)); }
    if (tipo === 'eco') { const x = base({ texto: 'ECO', tam: Math.round(140 * kk), cor: M.navy, w: Math.round(600 * kk), h: Math.round(160 * kk) }); return Object.assign(x, D.efeitoTexto('eco', Object.assign({}, x, { cor: M.dourado }))); }
    if (tipo === 'vazado') { const x = base({ texto: 'VAZADO', tam: Math.round(120 * kk), cor: M.dourado, w: Math.round(800 * kk), h: Math.round(140 * kk) }); return Object.assign(x, D.efeitoTexto('vazado', x)); }
    if (tipo === 'elevado') { const x = base({ texto: 'Elevado', tam: Math.round(100 * kk), cor: M.preto, w: Math.round(700 * kk), h: Math.round(120 * kk) }); return Object.assign(x, D.efeitoTexto('elevado', x)); }
    if (tipo === 'curvo') { const x = base({ texto: 'SEVEN · BPO DE LICITAÇÕES', tam: Math.round(54 * kk), cor: M.dourado, espaco: Math.round(4 * kk) }); aplicarCurva(x, 70); return x; }
    return null;
  }

  function ligarEditor(el) {
    const area = el.querySelector('#ds-area');
    el.querySelector('#ds-tit').oninput = function () { ed.d.titulo = this.value; salvar(false); };
    // ---- painel esquerdo e topo ----
    el.onclick = async function (ev) {
      const t = ev.target;
      el.querySelectorAll('.ds-props details[open]').forEach(function (dt) { if (!dt.contains(t)) dt.open = false; });
      const aba = t.closest('[data-aba]'); if (aba) { ed.aba = aba.dataset.aba; desenharPainel(); return; }
      const add = t.closest('[data-add]');
      if (add) {
        const k = add.dataset.add; const M = D.MARCA; const kk = escalaPg(); const kt = kit();
        if (k === 'ret') adicionar(D.el('ret', { w: 400, h: 300 })); if (k === 'ret-r') adicionar(D.el('ret', { w: 400, h: 300, raio: 40 }));
        if (k === 'elipse') adicionar(D.el('elipse', { w: 300, h: 300 })); if (k === 'triangulo') adicionar(D.el('triangulo', { w: 300, h: 260 }));
        if (k === 'estrela') adicionar(D.el('estrela', { w: 300, h: 300 })); if (k === 'seta') adicionar(D.el('seta', { w: 400, h: 120 })); if (k === 'linha') adicionar(D.el('linha', { w: 500, h: 8 }));
        if (k === 'pentagono' || k === 'hexagono' || k === 'losango') adicionar(D.el('poligono', { w: 300, h: 300, lados: { pentagono: 5, hexagono: 6, losango: 4 }[k] }));
        if (k === 'titulo') adicionar(D.el('texto', { texto: 'Adicione um título', fonte: kt.fonteTitulo, tam: Math.round(96 * kk), peso: 800, w: Math.round(900 * kk), h: Math.round(120 * kk) }));
        if (k === 'subtitulo') adicionar(D.el('texto', { texto: 'Adicione um subtítulo', fonte: kt.fonteSub, tam: Math.round(56 * kk), peso: 600, w: Math.round(800 * kk), h: Math.round(70 * kk) }));
        if (k === 'corpo') adicionar(D.el('texto', { texto: 'Adicione um pouco de texto', fonte: kt.fonteCorpo, tam: Math.round(34 * kk), peso: 400, w: Math.round(700 * kk), h: Math.round(45 * kk) }));
        if (k === 'combo') { const a1 = D.el('texto', { texto: 'TÍTULO FORTE', fonte: kt.fonteTitulo, tam: Math.round(90 * kk), peso: 800, w: Math.round(900 * kk), h: Math.round(110 * kk), alinh: 'center' }); const a2 = D.el('texto', { texto: 'subtítulo dourado', fonte: kt.fonteSub, tam: Math.round(44 * kk), peso: 600, cor: M.dourado, w: Math.round(900 * kk), h: Math.round(60 * kk), alinh: 'center', espaco: 4 }); adicionar(a1, true); a2.x = a1.x; a2.y = a1.y + a1.h + Math.round(10 * kk); paginaAtiva().elementos.push(a2); D.agrupar([a1, a2]); ed.sel = [a1.id, a2.id]; salvar(); desenharPaginas(); desenharProps(); }
        const pronto = textoPronto(k); if (pronto) adicionar(pronto, true);
        return;
      }
      const fm = t.closest('[data-forma]'); if (fm) { adicionar(D.forma(fm.dataset.forma, { w: 300, h: 300 })); return; }
      const ic = t.closest('[data-icone]'); if (ic) { adicionar(D.icone(ic.dataset.icone, { w: 200, h: 200, cor: D.MARCA.preto })); return; }
      const ln = t.closest('[data-linha]'); if (ln) { adicionar(D.el('linha', { w: 500, h: ln.dataset.linha === 'pontilhado' ? 10 : 8, estilo: ln.dataset.linha })); return; }
      const mo = t.closest('[data-moldura]'); if (mo) { adicionar(D.el('imagem', { w: 500, h: 500, mascara: mo.dataset.moldura, moldura: true })); ed.aba = 'uploads'; desenharPainel(); return; }
      const gf = t.closest('[data-grafico]'); if (gf) { const k2 = escalaPg(); adicionar(D.el('grafico', { tipoG: gf.dataset.grafico, w: Math.round(700 * k2), h: Math.round(480 * k2), cores: (gf.dataset.grafico === 'pizza' || gf.dataset.grafico === 'rosca') ? D.CORES_GRAFICO.slice() : [kit().cores[1] || D.MARCA.dourado].concat(D.CORES_GRAFICO.slice(1)), corGap: hexOu(paginaAtiva().fundo, '#ffffff') }), true); ed.aba = 'grafico'; desenharPainel(); return; }
      const logo = t.closest('[data-logo]'); if (logo) { const k2 = escalaPg(); adicionar(D.el('imagem', { src: logo.dataset.logo, ajuste: 'contain', w: Math.round(400 * k2) || 200, h: Math.round(400 * k2) || 200 }), true); return; }
      const up = t.closest('[data-up]');
      if (up) {
        const s0 = selecionados(); const alvo = s0.length === 1 && s0[0].tipo === 'imagem' && s0[0].moldura && !s0[0].arq && !s0[0].src ? s0[0] : null;
        if (alvo) { alvo.arq = up.dataset.up; atualizarEl(alvo); salvar(); marcarSelecao(); desenharProps(); return; }
        const im = up.querySelector('img'); const r = im.naturalWidth && im.naturalHeight ? im.naturalHeight / im.naturalWidth : 1; const w = Math.round(Math.min(ed.d.w, ed.d.h) * 0.6); adicionar(D.el('imagem', { arq: up.dataset.up, w: w, h: Math.round(w * r) }), true); return;
      }
      const tr = t.closest('[data-trocar]'); if (tr) { const x = selecionados()[0]; x.arq = tr.dataset.trocar; x.src = ''; atualizarEl(x); salvar(); marcarSelecao(); desenharPainel(); return; }
      const cor = t.closest('[data-cor]'); if (cor) { aplicarCor(cor.dataset.cor); return; }
      const kd = t.closest('[data-kitdel]'); if (kd) { kit().cores.splice(Number(kd.dataset.kitdel), 1); Dados.salvar(); desenharPainel(); desenharProps(); return; }
      const fundo = t.closest('[data-fundo]'); if (fundo) { const p = paginaAtiva(); p.fundo = fundo.dataset.fundo; delete p.grad; salvar(); desenharPaginas(); desenharProps(); desenharPainel(); return; }
      const fg = t.closest('[data-fundo-grad]'); if (fg) { const p = paginaAtiva(); p.grad = Object.assign({}, D.GRADIENTES[Number(fg.dataset.fundoGrad)]); p.fundo = p.grad.c1; salvar(); desenharPaginas(); desenharPainel(); return; }
      const mod = t.closest('[data-modelo]'); if (mod) { const nd = D.modelo(mod.dataset.modelo); const k3 = D.redimensionarDesign(nd, { id: ed.d.formato, w: ed.d.w, h: ed.d.h }); ed.d.paginas = k3.paginas; ed.pg = k3.paginas[0].id; ed.sel = []; salvar(); desenharPaginas(); desenharProps(); return; }
      // camadas
      const cam = t.closest('[data-cam]'); if (cam) { const x = elPorId(cam.closest('[data-lid]').dataset.lid); x[cam.dataset.cam] = !x[cam.dataset.cam]; if (x.oculto || x.travado) ed.sel = ed.sel.filter(function (i) { return i !== x.id; }); atualizarEl(x); salvar(); marcarSelecao(); desenharPainel(); desenharProps(); return; }
      const li = t.closest('.ds-camadas li'); if (li) { const x = elPorId(li.dataset.lid); if (x.oculto) return; ed.sel = ev.shiftKey ? ed.sel.concat(x.id) : [x.id]; marcarSelecao(); desenharProps(); return; }
      // efeitos e foto
      const ef = t.closest('[data-efeito]'); if (ef) { const x = selecionados()[0]; const curva = x.curva; Object.assign(x, D.efeitoTexto(ef.dataset.efeito, x)); ['sombra', 'contorno', 'destaque'].forEach(function (k) { if (!x[k]) delete x[k]; }); if (!x.vazado) delete x.vazado; if (curva) x.curva = curva; atualizarEl(x); salvar(); marcarSelecao(); desenharPainel(); return; }
      const pre = t.closest('[data-preench]'); if (pre) { const x = selecionados()[0]; if (!pre.dataset.preench) { if (x.grad) x.cor = x.grad.c1; delete x.grad; } else x.grad = Object.assign({ c1: hexOu(x.cor, '#050505'), c2: '#b68d40', ang: 135 }, x.grad, { tipo: pre.dataset.preench }); atualizarEl(x); salvar(); desenharPainel(); desenharProps(); return; }
      const eg = t.closest('[data-elgrad]'); if (eg) { const x = selecionados()[0]; x.grad = Object.assign({}, D.GRADIENTES[Number(eg.dataset.elgrad)]); atualizarEl(x); salvar(); desenharPainel(); desenharProps(); return; }
      const el2 = t.closest('[data-estilo-linha]'); if (el2) { const x = selecionados()[0]; x.estilo = el2.dataset.estiloLinha; atualizarEl(x); salvar(); desenharPainel(); return; }
      const fi = t.closest('[data-filtro]'); if (fi) { const x = selecionados()[0]; const f = D.FILTROS.find(function (y) { return y.id === fi.dataset.filtro; }); x.filtro = f.id; x.ajustes = Object.assign({}, f.a); if (f.id === 'original') { delete x.filtro; delete x.ajustes; } atualizarEl(x); salvar(); desenharPainel(); return; }
      const msk = t.closest('[data-mascara]'); if (msk) { const x = selecionados()[0]; if (msk.dataset.mascara) x.mascara = msk.dataset.mascara; else delete x.mascara; atualizarEl(x); salvar(); marcarSelecao(); desenharPainel(); desenharProps(); return; }
      const aj = t.closest('[data-ajuste]'); if (aj) { const x = selecionados()[0]; x.ajuste = aj.dataset.ajuste; atualizarEl(x); salvar(); desenharPainel(); desenharProps(); return; }
      const gt = t.closest('[data-gtipo]'); if (gt) { const x = selecionados()[0]; x.tipoG = gt.dataset.gtipo; if ((x.tipoG === 'pizza' || x.tipoG === 'rosca') && (x.cores || []).length < 2) x.cores = D.CORES_GRAFICO.slice(); atualizarEl(x); salvar(); desenharPainel(); desenharProps(); return; }
      const fo = t.closest('[data-fonte]'); if (fo) { selecionados().forEach(function (x) { if (x.tipo === 'texto') { x.fonte = fo.dataset.fonte; if (x.curva) aplicarCurva(x, x.curva); atualizarEl(x); } }); salvar(); marcarSelecao(); desenharPainel(); desenharProps(); return; }
      const vs = t.closest('[data-versao]'); if (vs) { const v = (ed.d.versoes || []).find(function (y) { return y.id === vs.dataset.versao; }); if (v && await confirmar('Restaurar versão', 'O design volta para a versão de ' + new Date(v.em).toLocaleString('pt-BR') + '. A situação atual fica salva como versão.', 'Restaurar')) { D.salvarVersao(ed.d, 'Antes de restaurar', true); ed.d.paginas = JSON.parse(v.paginas); ed.pg = ed.d.paginas[0].id; ed.sel = []; salvar(); desenharPaginas(); desenharProps(); desenharPainel(); aviso('Versão restaurada.'); } return; }
      const pa = t.closest('[data-pa]');
      if (pa) {
        const sec = pa.closest('[data-pgw]'); const i = ed.d.paginas.findIndex(function (p) { return p.id === sec.dataset.pgw; }); const ps = ed.d.paginas;
        if (pa.dataset.pa === 'duplicar') { const c = JSON.parse(JSON.stringify(ps[i])); c.id = D.pagina().id; const gs = {}; c.elementos.forEach(function (x) { x.id = D.el('ret').id; if (x.grupo) x.grupo = gs[x.grupo] = gs[x.grupo] || 'g' + D.el('ret').id; }); ps.splice(i + 1, 0, c); ed.pg = c.id; }
        if (pa.dataset.pa === 'excluir' && ps.length > 1 && await confirmar('Excluir página', 'Excluir a página ' + (i + 1) + '?', 'Excluir')) { ps.splice(i, 1); ed.pg = ps[Math.max(0, i - 1)].id; ed.sel = []; }
        if (pa.dataset.pa === 'subir' && i > 0) ps.splice(i - 1, 0, ps.splice(i, 1)[0]);
        if (pa.dataset.pa === 'descer' && i < ps.length - 1) ps.splice(i + 1, 0, ps.splice(i, 1)[0]);
        salvar(); desenharPaginas(); desenharProps(); return;
      }
      const b = t.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'add-pagina') { const p0 = paginaAtiva(); const p = D.pagina({ fundo: p0.fundo }); if (p0.grad) p.grad = Object.assign({}, p0.grad); ed.d.paginas.push(p); ed.pg = p.id; salvar(); desenharPaginas(); document.querySelector('[data-pgw="' + p.id + '"]').scrollIntoView({ behavior: 'smooth' }); }
      if (a === 'zoom+' || a === 'zoom-') { ed.zoom = Math.max(0.05, Math.min(3, ed.zoom * (a === 'zoom+' ? 1.2 : 1 / 1.2))); desenharPaginas(); }
      if (a === 'zoom-ajustar') { ed.zoom = Math.max(0.05, Math.min(1, (area.clientWidth - 80) / ed.d.w, (window.innerHeight - 220) / ed.d.h)); desenharPaginas(); }
      if (a === 'desfazer' || a === 'refazer') historicoPasso(a);
      if (a === 'duplicar') duplicar();
      if (a === 'excluir') excluirSel();
      if (a === 'agrupar') agruparSel(); if (a === 'desagrupar') desagruparSel();
      if (a === 'efeitos' || a === 'foto' || a === 'grafico' || a === 'fontes') { ed.aba = a; desenharPainel(); }
      if (a === 'pincel') copiarEstiloSel(); if (a === 'pincel-cancelar') { ed.pincel = null; desenharProps(); }
      if (a === 'upload') { const fs = await UI.escolherArquivo('image/*', true); for (const f of fs || []) { if (f.size > 10 * 1024 * 1024) { aviso(f.name + ': acima de 10 MB.', 'erro'); continue; } const id = Dados.id('dsu'); await Dados.guardarArquivo(id, f); e().uploads.unshift({ arq: id, nome: f.name }); } Dados.salvar(); desenharPainel(); }
      if (a === 'kit-logo') { const f = await UI.escolherArquivo('image/*'); if (!f) return; const id = Dados.id('dsu'); await Dados.guardarArquivo(id, f); e().uploads.unshift({ arq: id, nome: f.name }); kit().logos = (kit().logos || []).concat(id); Dados.salvar(); desenharPainel(); }
      if (a === 'kit-aplicar') { const n = D.aplicarKit(ed.d.paginas, kit()); salvar(); desenharPaginas(); aviso(n ? n + ' texto(s) com as fontes da marca.' : 'Os textos já usam as fontes da marca.'); }
      if (a === 'fundo-grad') { const p = paginaAtiva(); p.grad = { tipo: el.querySelector('#ds-fgt').value, c1: el.querySelector('#ds-fg1').value, c2: el.querySelector('#ds-fg2').value, ang: Number(el.querySelector('#ds-fga').value) }; p.fundo = p.grad.c1; salvar(); desenharPaginas(); desenharPainel(); }
      if (a === 'fundo-sem-grad') { delete paginaAtiva().grad; salvar(); desenharPaginas(); desenharPainel(); }
      if (a === 'foto-reset') { const x = selecionados()[0]; delete x.ajustes; delete x.filtro; atualizarEl(x); salvar(); desenharPainel(); }
      if (a === 'remover-fundo') removerFundoSel();
      if (a === 'versao') { const r = await modal({ titulo: 'Salvar versão', corpo: campo('Nome da versão', '<input name="n" placeholder="Ex.: aprovada pelo cliente">') }); if (!r) return; if (D.salvarVersao(ed.d, r.get('n').trim() || 'Versão', false)) { Dados.salvar(); aviso('Versão salva.'); } else aviso('Nada mudou desde a última versão.'); desenharPainel(); }
      if (a === 'redimensionar') redimensionarMagico();
      if (a === 'apresentar') apresentar();
      if (a === 'baixar') baixar();
    };
    // ---- propriedades ----
    const props = el.querySelector('#ds-props');
    props.addEventListener('click', function (ev) {
      const t = ev.target; const s = selecionados();
      const p = t.closest('[data-prop]'); if (p) { if (p.dataset.prop === 'fundo') { const pg = paginaAtiva(); pg.fundo = p.dataset.v; delete pg.grad; salvar(); desenharPaginas(); desenharProps(); return; } if (p.dataset.prop === 'cor') { aplicarCor(p.dataset.v); return; } s.forEach(function (x) { x[p.dataset.prop] = p.dataset.v; atualizarEl(x); }); salvar(); marcarSelecao(); desenharProps(); return; }
      const tg = t.closest('[data-tog]'); if (tg) { s.forEach(function (x) { x[tg.dataset.tog] = !x[tg.dataset.tog]; atualizarEl(x); }); salvar(); marcarSelecao(); desenharProps(); return; }
      const al = t.closest('[data-alinhar]'); if (al) { D.alinhar(s, al.dataset.alinhar, ed.d.w, ed.d.h); s.forEach(atualizarEl); salvar(); marcarSelecao(); desenharProps(); return; }
      const di = t.closest('[data-distribuir]'); if (di) { D.distribuir(s, di.dataset.distribuir); s.forEach(atualizarEl); salvar(); marcarSelecao(); return; }
      const or = t.closest('[data-ordem]'); if (or) { const pg = paginaDe(s[0].id); D.ordem(pg.elementos, s[0].id, or.dataset.ordem); salvar(); desenharPaginas(); return; }
    });
    props.addEventListener('change', function (ev) {
      const t = ev.target; const s = selecionados();
      if (t.dataset.propSel) { s.forEach(function (x) { x[t.dataset.propSel] = t.dataset.propSel === 'peso' ? Number(t.value) : t.value; if (x.curva && t.dataset.propSel !== 'ajuste') aplicarCurva(x, x.curva); atualizarEl(x); }); salvar(); marcarSelecao(); if (t.dataset.propSel === 'tipoG') desenharPainel(); }
      if (t.dataset.propc) { if (t.dataset.propc === 'fundo') { const pg = paginaAtiva(); pg.fundo = t.value; delete pg.grad; salvar(); desenharPaginas(); } else if (t.dataset.propc === 'cor') aplicarCor(t.value); else { s.forEach(function (x) { x[t.dataset.propc] = t.value; atualizarEl(x); }); salvar(); marcarSelecao(); } }
      if (t.dataset.num) { const v = Number(t.value); if (isNaN(v)) return; s.forEach(function (x) { x[t.dataset.num] = t.dataset.num === 'opac' ? v / 100 : v; if (x.curva && (t.dataset.num === 'tam' || t.dataset.num === 'espaco')) aplicarCurva(x, x.curva); atualizarEl(x); }); salvar(); marcarSelecao(); }
    });
    // ---- painel: controles contínuos (faixas, cores, campos) ----
    const painel = el.querySelector('#ds-painel');
    painel.addEventListener('input', function (ev) {
      const t = ev.target; const x = selecionados()[0];
      if (t.id === 'ds-bfonte') { ed.buscaFonte = t.value; const q = Nucleo.normalizar(t.value); painel.querySelectorAll('#ds-lfontes [data-fonte]').forEach(function (b) { b.hidden = q && Nucleo.normalizar(b.dataset.fonte).indexOf(q) < 0; }); return; }
      if (t.id === 'ds-tol') { ed.tolFundo = Number(t.value); t.nextElementSibling.textContent = t.value; return; }
      if (t.id === 'ds-fga') { t.nextElementSibling.textContent = t.value + '°'; return; }
      if (t.id === 'ds-gdados' && x) { const dd = D.lerDados(t.value); if (dd.length) { x.dados = dd; atualizarEl(x); salvarDepois(); } return; }
      if (t.dataset.ef && x) {
        const c = t.dataset.ef; let v = t.type === 'range' || t.type === 'number' ? Number(t.value) : t.value;
        if (c === 'curva') { if (v) aplicarCurva(x, v); } else if (c === 'h' && x.tipo === 'linha') x.h = v; else setCaminho(x, c, v);
        if (t.type === 'range') { const o = t.nextElementSibling; if (o) o.textContent = Math.round(v * 100) / 100 + (/ang/.test(c) ? '°' : /ajustes\.(brilho|contraste|saturacao|sepia|pb)/.test(c) ? '%' : /matiz/.test(c) ? '°' : /desfoque/.test(c) ? ' px' : c === 'zoom' ? '×' : ''); }
        atualizarEl(x); marcarSelecao(); salvarDepois();
      }
    });
    painel.addEventListener('change', function (ev) {
      const t = ev.target; const x = selecionados()[0];
      if (t.id === 'ds-fundo-cor') { const p = paginaAtiva(); p.fundo = t.value; delete p.grad; salvar(); desenharPaginas(); desenharProps(); return; }
      if (t.id === 'ds-kit-cor') { const k = kit(); if (k.cores.indexOf(t.value) < 0) k.cores.push(t.value); Dados.salvar(); desenharPainel(); desenharProps(); return; }
      if (t.dataset.kit) { kit()[t.dataset.kit] = t.value; Dados.salvar(); return; }
      if (t.dataset.pref) { const pr = e().prefs; pr[t.dataset.pref] = t.type === 'checkbox' ? t.checked : Number(t.value); Dados.salvar(); desenharPaginas(); return; }
      if (t.dataset.eftog && x) {
        const k = t.dataset.eftog;
        if (k === 'curva') aplicarCurva(x, t.checked ? 50 : 0);
        else if (k === 'vazado') x.vazado = t.checked;
        else if (k === 'valores') x.valores = t.checked;
        else if (t.checked) x[k] = padraoEfeito(x, k); else delete x[k];
        atualizarEl(x); salvar(); marcarSelecao(); desenharPainel(); return;
      }
      if (t.dataset.ef && x && t.tagName === 'SELECT') { setCaminho(x, t.dataset.ef, t.value); atualizarEl(x); salvar(); return; }
      if (t.dataset.ef) { salvar(); if (t.dataset.ef === 'curva' && Number(t.value) === 0) { aplicarCurva(x, 0); atualizarEl(x); marcarSelecao(); desenharPainel(); } }
      if (t.id === 'ds-gdados') salvar();
    });
    // camadas: arrastar para reordenar
    let arrCam = null;
    painel.addEventListener('dragstart', function (ev) { const li = ev.target.closest('.ds-camadas li'); if (!li) return; arrCam = li.dataset.lid; ev.dataTransfer.effectAllowed = 'move'; });
    painel.addEventListener('dragover', function (ev) { if (arrCam && ev.target.closest('.ds-camadas li')) { ev.preventDefault(); painel.querySelectorAll('.ds-camadas li').forEach(function (l) { l.classList.toggle('alvo', l === ev.target.closest('li')); }); } });
    painel.addEventListener('drop', function (ev) {
      const li = ev.target.closest('.ds-camadas li'); if (!li || !arrCam) return; ev.preventDefault();
      const p = paginaAtiva(); const de = p.elementos.findIndex(function (y) { return y.id === arrCam; }); const para = p.elementos.findIndex(function (y) { return y.id === li.dataset.lid; });
      if (de >= 0 && para >= 0 && de !== para) { const [m] = p.elementos.splice(de, 1); p.elementos.splice(para, 0, m); salvar(); desenharPaginas(); }
      arrCam = null;
    });

    // ---- interação na página ----
    let arr = null;
    const ponto = function (ev, pgEl) { const r = pgEl.getBoundingClientRect(); return { x: (ev.clientX - r.left) / ed.zoom, y: (ev.clientY - r.top) / ed.zoom }; };
    area.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      const pgEl = ev.target.closest('.ds-pg'); const alca = ev.target.closest('[data-alca]'); const n = ev.target.closest('.ds-el');
      if (ev.target.closest('.ds-txt[contenteditable=true]')) return;
      const editando = document.querySelector('.ds-txt[contenteditable=true]'); if (editando) editando.blur();
      if (!pgEl) { if (!ev.target.closest('.ds-props,.ds-pagina header,button,input,select,summary')) { ed.sel = []; marcarSelecao(); desenharProps(); } return; }
      if (pgEl.dataset.pg !== ed.pg) { ed.pg = pgEl.dataset.pg; document.querySelectorAll('.ds-pagina').forEach(function (s) { s.classList.toggle('ativa', s.dataset.pgw === ed.pg); }); if (ed.aba === 'fundo' || ed.aba === 'camadas') desenharPainel(); }
      const p0 = ponto(ev, pgEl);
      if (alca) {
        const x = elPorId(ed.sel[0]); const nEl = document.querySelector('.ds-paginas .ds-el[data-id="' + x.id + '"]');
        arr = { tipo: alca.dataset.alca === 'rot' ? 'rot' : 'res', alca: alca.dataset.alca, x: x, orig: { x: x.x, y: x.y, w: x.w, h: x.tipo === 'texto' ? nEl.offsetHeight : x.h, tam: x.tam }, p0: p0, pgEl: pgEl };
      } else if (n) {
        const id = n.dataset.id; const x = elPorId(id); const pg = ed.d.paginas.find(function (q) { return q.id === pgEl.dataset.pg; });
        if (ed.pincel) { const alvos = D.membrosGrupo(pg.elementos, id).map(elPorId); alvos.forEach(function (y) { D.copiarEstilo(ed.pincel, y); if (y.curva) aplicarCurva(y, y.curva); atualizarEl(y); }); ed.pincel = null; ed.sel = alvos.map(function (y) { return y.id; }); salvar(); marcarSelecao(); desenharProps(); aviso('Estilo aplicado.'); return; }
        const grupo = D.membrosGrupo(pg.elementos, id);
        if (ev.shiftKey) { ed.sel = ed.sel.indexOf(id) >= 0 ? ed.sel.filter(function (y) { return grupo.indexOf(y) < 0; }) : ed.sel.concat(grupo); }
        else if (ed.sel.indexOf(id) < 0) ed.sel = grupo;
        marcarSelecao(); desenharProps();
        if (!x.travado) arr = { tipo: 'mover', p0: p0, orig: selecionados().filter(function (y) { return !y.travado; }).map(function (y) { return { y: y, x: y.x, yy: y.y }; }), pgEl: pgEl, moveu: false };
      } else {
        ed.sel = []; marcarSelecao(); desenharProps();
        arr = { tipo: 'area', p0: p0, pgEl: pgEl, box: document.createElement('div') }; arr.box.className = 'ds-laco'; pgEl.appendChild(arr.box);
      }
      if (arr) { area.setPointerCapture(ev.pointerId); ev.preventDefault(); }
    });
    area.addEventListener('pointermove', function (ev) {
      if (!arr) return; const p = ponto(ev, arr.pgEl); const dx = p.x - arr.p0.x, dy = p.y - arr.p0.y;
      const guiasEl = arr.pgEl.querySelector('.ds-guias');
      if (arr.tipo === 'mover') {
        if (!arr.moveu && Math.abs(dx) + Math.abs(dy) < 2 / ed.zoom) return; arr.moveu = true;
        const pg = ed.d.paginas.find(function (q) { return q.id === arr.pgEl.dataset.pg; }); let ajx = 0, ajy = 0, linhas = []; const gr = e().prefs.grade;
        if (gr && !ev.altKey) { const o = arr.orig[0]; ajx = Math.round((o.x + dx) / gr) * gr - (o.x + dx); ajy = Math.round((o.yy + dy) / gr) * gr - (o.yy + dy); }
        else if (arr.orig.length === 1 && !ev.altKey) { const o = arr.orig[0]; const nEl = document.querySelector('.ds-paginas .ds-el[data-id="' + o.y.id + '"]'); const g = D.guias({ x: o.x + dx, y: o.yy + dy, w: o.y.w, h: nEl ? nEl.offsetHeight : o.y.h }, pg.elementos.filter(function (q) { return q !== o.y && !q.oculto; }), ed.d.w, ed.d.h, 6 / ed.zoom); ajx = g.x - (o.x + dx); ajy = g.y - (o.yy + dy); linhas = g.linhas; }
        arr.orig.forEach(function (o) { o.y.x = Math.round(o.x + dx + ajx); o.y.y = Math.round(o.yy + dy + ajy); const nEl = document.querySelector('.ds-paginas .ds-el[data-id="' + o.y.id + '"]'); if (nEl) { nEl.style.left = o.y.x + 'px'; nEl.style.top = o.y.y + 'px'; } });
        const al = arr.pgEl.querySelector('.ds-alcas'); if (al && arr.orig.length === 1) { al.style.left = arr.orig[0].y.x + 'px'; al.style.top = arr.orig[0].y.y + 'px'; }
        guiasEl.innerHTML = linhas.map(function (l) { return '<i class="ds-guia ' + l.eixo + '" style="' + (l.eixo === 'x' ? 'left:' + l.v + 'px' : 'top:' + l.v + 'px') + '"></i>'; }).join('');
      }
      if (arr.tipo === 'res') {
        const x = arr.x; const prop = x.tipo === 'imagem' || x.tipo === 'caminho' && x.prop || (x.tipo === 'texto' && x.curva) || ev.shiftKey;
        const r = D.redimensionar(arr.orig, arr.alca, dx, dy, prop, 8);
        if (x.tipo === 'texto' && !x.curva) Object.assign(x, { x: r.x, w: r.w });
        else { Object.assign(x, r); if (x.tipo === 'texto' && x.curva && arr.orig.tam) x.tam = Math.max(6, Math.round(arr.orig.tam * r.w / arr.orig.w)); }
        atualizarEl(x); marcarSelecao();
      }
      if (arr.tipo === 'rot') { const cx = arr.orig.x + arr.orig.w / 2, cy = arr.orig.y + arr.orig.h / 2; arr.x.rot = D.angulo(cx, cy, p.x, p.y, ev.shiftKey ? 15 : 0); const nEl = document.querySelector('.ds-paginas .ds-el[data-id="' + arr.x.id + '"]'); nEl.style.transform = transformCss(arr.x); const al = arr.pgEl.querySelector('.ds-alcas'); if (al) al.style.transform = 'rotate(' + arr.x.rot + 'deg)'; }
      if (arr.tipo === 'area') { const x1 = Math.min(arr.p0.x, p.x), y1 = Math.min(arr.p0.y, p.y); arr.box.style.cssText = 'left:' + x1 + 'px;top:' + y1 + 'px;width:' + Math.abs(dx) + 'px;height:' + Math.abs(dy) + 'px'; arr.fim = p; }
    });
    const soltar = function () {
      if (!arr) return; const a = arr; arr = null;
      const g = a.pgEl.querySelector('.ds-guias'); if (g) g.innerHTML = '';
      if (a.tipo === 'area') { a.box.remove(); if (a.fim) { const pg = ed.d.paginas.find(function (q) { return q.id === a.pgEl.dataset.pg; }); const ids = D.selecaoRetangulo(pg.elementos.filter(function (q) { return !q.travado && !q.oculto; }), { x1: a.p0.x, y1: a.p0.y, x2: a.fim.x, y2: a.fim.y }); ed.sel = ids.reduce(function (acc, i) { return acc.concat(D.membrosGrupo(pg.elementos, i).filter(function (j) { return acc.indexOf(j) < 0; })); }, []); marcarSelecao(); desenharProps(); } return; }
      if (a.tipo === 'mover' && !a.moveu) return;
      salvar(); marcarSelecao(); desenharProps();
    };
    area.addEventListener('pointerup', soltar); area.addEventListener('pointercancel', soltar);
    // edição de texto com duplo clique
    area.addEventListener('dblclick', async function (ev) {
      const alvo = document.elementFromPoint(ev.clientX, ev.clientY) || ev.target;
      const n = alvo.closest('.ds-paginas .ds-texto') || (ed.sel.length === 1 && document.querySelector('.ds-paginas .ds-texto[data-id="' + ed.sel[0] + '"]'));
      if (!n || (ev.isTrusted && !n.contains(alvo) && !alvo.closest('.ds-alcas'))) return; const x = elPorId(n.dataset.id); if (x.travado) return;
      if (x.curva) { const r = await modal({ titulo: 'Editar texto curvo', corpo: campo('Texto', '<input name="t" value="' + esc(x.texto) + '">') }); if (!r) return; x.texto = r.get('t') || x.texto; aplicarCurva(x, x.curva); atualizarEl(x); salvar(); marcarSelecao(); return; }
      ed.sel = [x.id];
      const t = n.querySelector('.ds-txt'); t.contentEditable = 'true'; t.focus(); document.getSelection().selectAllChildren(t);
      document.querySelectorAll('.ds-alcas').forEach(function (h) { h.remove(); });
      t.onpaste = function (e2) { e2.preventDefault(); document.execCommand('insertText', false, (e2.clipboardData || window.clipboardData).getData('text/plain')); };
      t.onblur = function () { t.contentEditable = 'false'; x.texto = t.innerText.replace(/\n$/, ''); x.h = Math.round(n.offsetHeight); salvar(); marcarSelecao(); if (ed.aba === 'camadas') desenharPainel(); };
      t.onkeydown = function (e2) { if (e2.key === 'Escape') t.blur(); e2.stopPropagation(); };
    });
    // teclado
    el.tabIndex = -1;
    el.onkeydown = function (ev) {
      if (ev.target.closest('input,select,textarea,[contenteditable=true]')) return;
      const mod = ev.ctrlKey || ev.metaKey; const s = selecionados(); const k = ev.key.toLowerCase();
      if (mod && ev.altKey && k === 'c') { ev.preventDefault(); copiarEstiloSel(); }
      else if (mod && ev.altKey && k === 'v' && ed.estiloCopiado) { ev.preventDefault(); s.forEach(function (x) { D.copiarEstilo(ed.estiloCopiado, x); atualizarEl(x); }); salvar(); marcarSelecao(); desenharProps(); }
      else if (mod && k === 'z') { ev.preventDefault(); historicoPasso(ev.shiftKey ? 'refazer' : 'desfazer'); }
      else if (mod && k === 'y') { ev.preventDefault(); historicoPasso('refazer'); }
      else if (mod && k === 'd') { ev.preventDefault(); duplicar(); }
      else if (mod && k === 'g') { ev.preventDefault(); if (ev.shiftKey) desagruparSel(); else agruparSel(); }
      else if (mod && (k === 'b' || k === 'i' || k === 'u') && s.length && s.every(function (x) { return x.tipo === 'texto'; })) { ev.preventDefault(); s.forEach(function (x) { if (k === 'b') x.peso = x.peso >= 700 ? 400 : 700; if (k === 'i') x.italico = !x.italico; if (k === 'u') x.sublinhado = !x.sublinhado; atualizarEl(x); }); salvar(); marcarSelecao(); desenharProps(); }
      else if (mod && (ev.key === ']' || ev.key === '[') && s.length === 1) { ev.preventDefault(); D.ordem(paginaDe(s[0].id).elementos, s[0].id, ev.key === ']' ? (ev.shiftKey ? 'frente' : 'subir') : (ev.shiftKey ? 'tras' : 'descer')); salvar(); desenharPaginas(); }
      else if (mod && k === 'c' && s.length) { ed.clip = JSON.parse(JSON.stringify(s)); }
      else if (mod && k === 'v' && ed.clip) { ev.preventDefault(); const gs = {}; const novos = ed.clip.map(function (x) { const c = Object.assign(JSON.parse(JSON.stringify(x)), { id: D.el('ret').id, x: x.x + 20, y: x.y + 20 }); if (c.grupo) c.grupo = gs[c.grupo] = gs[c.grupo] || 'g' + D.el('ret').id; return c; }); paginaAtiva().elementos.push.apply(paginaAtiva().elementos, novos); ed.sel = novos.map(function (x) { return x.id; }); salvar(); desenharPaginas(); desenharProps(); }
      else if (mod && k === 'a') { ev.preventDefault(); ed.sel = paginaAtiva().elementos.filter(function (x) { return !x.travado && !x.oculto; }).map(function (x) { return x.id; }); marcarSelecao(); desenharProps(); }
      else if ((ev.key === 'Delete' || ev.key === 'Backspace') && s.length) { ev.preventDefault(); excluirSel(); }
      else if (ev.key === 'Escape') { ed.pincel = null; ed.sel = []; marcarSelecao(); desenharProps(); }
      else if (/^Arrow/.test(ev.key) && s.length) { ev.preventDefault(); const p = ev.shiftKey ? 10 : 1; s.forEach(function (x) { if (x.travado) return; if (ev.key === 'ArrowLeft') x.x -= p; if (ev.key === 'ArrowRight') x.x += p; if (ev.key === 'ArrowUp') x.y -= p; if (ev.key === 'ArrowDown') x.y += p; atualizarEl(x); }); marcarSelecao(); clearTimeout(ed.tSeta); ed.tSeta = setTimeout(function () { salvar(); desenharProps(); }, 300); }
      else if (ev.key === 'Enter' && s.length === 1 && s[0].tipo === 'texto') { ev.preventDefault(); const n = document.querySelector('.ds-paginas .ds-el[data-id="' + s[0].id + '"]'); n.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); }
    };
    el.focus({ preventScroll: true });
  }
  function duplicar() { const s = selecionados(); if (!s.length) return; const gs = {}; const novos = s.map(function (x) { const c = JSON.parse(JSON.stringify(x)); c.id = D.el('ret').id; c.x += 20; c.y += 20; if (c.grupo) c.grupo = gs[c.grupo] = gs[c.grupo] || 'g' + D.el('ret').id; paginaDe(x.id).elementos.push(c); return c.id; }); ed.sel = novos; salvar(); desenharPaginas(); desenharProps(); }
  function excluirSel() { const ids = ed.sel; ed.d.paginas.forEach(function (p) { p.elementos = p.elementos.filter(function (x) { return ids.indexOf(x.id) < 0 || x.travado; }); }); ed.sel = []; salvar(); desenharPaginas(); desenharProps(); }
  function agruparSel() { const s = selecionados(); if (s.length < 2) return; const pg = paginaDe(s[0].id); if (!s.every(function (x) { return paginaDe(x.id) === pg; })) return aviso('Só dá para agrupar elementos da mesma página.', 'erro'); D.agrupar(s); salvar(); desenharProps(); aviso('Agrupado. Clique em qualquer parte para mover o grupo.'); }
  function desagruparSel() { const s = selecionados(); D.desagrupar(s); salvar(); desenharProps(); }
  function copiarEstiloSel() { const s = selecionados(); if (s.length !== 1) return aviso('Selecione um elemento para copiar o estilo.', 'erro'); ed.pincel = JSON.parse(JSON.stringify(s[0])); ed.estiloCopiado = ed.pincel; desenharProps(); }
  function historicoPasso(a) { const v = a === 'desfazer' ? ed.hist.desfazer() : ed.hist.refazer(); if (!v) return; ed.d.paginas = v; if (!ed.d.paginas.some(function (p) { return p.id === ed.pg; })) ed.pg = ed.d.paginas[0].id; ed.sel = ed.sel.filter(elPorId); salvar(false); desenharPaginas(); desenharProps(); }

  async function removerFundoSel() {
    const x = selecionados()[0]; if (!x || x.tipo !== 'imagem') return;
    const im = await carregarImg(await srcImagem(x)); if (!im) return aviso('Não consegui abrir a imagem.', 'erro');
    const k = Math.min(1, 2400 / Math.max(im.width, im.height)); const cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
    const c = cv.getContext('2d'); c.drawImage(im, 0, 0, cv.width, cv.height); const dados = c.getImageData(0, 0, cv.width, cv.height);
    const n = D.removerFundo(dados.data, cv.width, cv.height, ed.tolFundo);
    if (n < cv.width * cv.height * 0.01) return aviso('Não encontrei um fundo uniforme nas bordas. Aumente a tolerância.', 'erro');
    c.putImageData(dados, 0, 0); const blob = await new Promise(function (ok) { cv.toBlob(ok, 'image/png'); });
    const id = Dados.id('dsu'); await Dados.guardarArquivo(id, blob); e().uploads.unshift({ arq: id, nome: 'sem fundo.png' });
    x.arq = id; x.src = ''; atualizarEl(x); salvar(); marcarSelecao(); desenharPainel();
    aviso('Fundo removido (' + Math.round(n / (cv.width * cv.height) * 100) + '% da imagem). Desfaça se não ficou bom.');
  }
  async function redimensionarMagico() {
    const d = ed.d;
    const r = await modal({ titulo: 'Redimensionar design', botao: 'Redimensionar', corpo: campo('Novo formato', '<select name="f">' + opcoes(D.FORMATOS.filter(function (f) { return f.id !== d.formato; }).map(function (f) { return { v: f.id, t: f.t + ' (' + f.w + ' × ' + f.h + ')' }; }).concat([{ v: 'custom', t: 'Tamanho personalizado…' }])) + '</select>') + '<div class="linha">' + campo('Largura', '<input type="number" name="w" min="50" max="5000" value="' + d.w + '">') + campo('Altura', '<input type="number" name="h" min="50" max="5000" value="' + d.h + '">') + '</div>' +
      '<label class="check-inline"><input type="radio" name="modo" value="copia" checked> Criar uma cópia no novo formato</label><label class="check-inline"><input type="radio" name="modo" value="este"> Redimensionar este design</label><p class="mini mudo">Tudo é escalado na mesma proporção e centralizado. Revise posições depois.</p>' });
    if (!r) return; let fmt = D.FORMATOS.find(function (f) { return f.id === r.get('f'); }); if (!fmt) fmt = { id: 'custom', t: 'Personalizado', w: Number(r.get('w')) || d.w, h: Number(r.get('h')) || d.h };
    const n = D.redimensionarDesign(d, fmt);
    if (r.get('modo') === 'este') { D.salvarVersao(d, 'Antes de redimensionar', true); d.w = n.w; d.h = n.h; d.formato = n.formato; d.paginas = n.paginas; ed.pg = d.paginas[0].id; ed.sel = []; ed.zoom = null; ed.hist = D.historico(); salvar(); App.redesenhar(); aviso('Design redimensionado para ' + fmt.t + '.'); }
    else { n.titulo = d.titulo + ' · ' + fmt.t; e().designs.push(n); Dados.salvar(); location.hash = '#/design/editar/' + n.id; aviso('Cópia criada em ' + fmt.t + '.'); }
  }
  function apresentar() {
    const d = ed.d; let i = Math.max(0, d.paginas.indexOf(paginaAtiva()));
    const ov = document.createElement('div'); ov.className = 'ds-apresentar'; ov.tabIndex = -1; document.body.appendChild(ov);
    const mostrar = function () { const k = Math.min(innerWidth / d.w, innerHeight / d.h); ov.innerHTML = htmlPagina(d, d.paginas[i], k, false) + '<div class="ds-ap-barra"><button data-ap="ant" aria-label="Anterior">‹</button><span>' + (i + 1) + ' / ' + d.paginas.length + '</span><button data-ap="prox" aria-label="Próxima">›</button><button data-ap="sair" aria-label="Sair">✕</button></div>'; hidratar(ov); };
    const sair = function () { document.removeEventListener('keydown', tecla); if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); ov.remove(); };
    const tecla = function (ev) { if (ev.key === 'Escape') sair(); else if (ev.key === 'ArrowRight' || ev.key === ' ' || ev.key === 'PageDown') { i = Math.min(d.paginas.length - 1, i + 1); mostrar(); } else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { i = Math.max(0, i - 1); mostrar(); } };
    ov.onclick = function (ev) { const b = ev.target.closest('[data-ap]'); if (b && b.dataset.ap === 'sair') return sair(); if (b && b.dataset.ap === 'ant') i = Math.max(0, i - 1); else i = Math.min(d.paginas.length - 1, i + 1); mostrar(); };
    document.addEventListener('keydown', tecla); mostrar();
    if (ov.requestFullscreen) ov.requestFullscreen().catch(function () { /* sem tela cheia: segue na janela */ });
    ov.focus();
  }

  // ---------- exportação (Canvas 2D) ----------
  function carregarImg(src) { return new Promise(function (ok) { const i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  async function renderizar(d, p, escala, transparente) {
    if (document.fonts) { const fs = {}; p.elementos.forEach(function (x) { if (x.fonte) fs[x.fonte] = 1; }); await Promise.all(Object.keys(fs).map(function (f) { return document.fonts.load('700 20px "' + f + '"').catch(function () { /* fonte de sistema */ }); })); await document.fonts.ready; }
    const cv = document.createElement('canvas'); cv.width = Math.round(d.w * escala); cv.height = Math.round(d.h * escala); const c = cv.getContext('2d'); c.scale(escala, escala);
    if (!transparente) { c.fillStyle = p.grad ? estiloPreench(c, { grad: p.grad }, d.w, d.h) : (p.fundo || '#fff'); c.fillRect(0, 0, d.w, d.h); }
    for (const x of p.elementos) { if (!x.oculto) await comporEl(c, x, escala); }
    return cv;
  }
  function carregarJsPDF() { if (self.jspdf) return Promise.resolve(self.jspdf); return new Promise(function (ok, erro) { const s = document.createElement('script'); s.src = JSPDF; s.onload = function () { ok(self.jspdf); }; s.onerror = function () { erro(new Error('Sem acesso à biblioteca de PDF (verifique a internet).')); }; document.head.appendChild(s); }); }
  async function baixar() {
    const d = ed.d;
    const r = await modal({ titulo: 'Baixar', botao: 'Baixar', corpo: campo('Tipo de arquivo', '<select name="tipo">' + opcoes([{ v: 'png', t: 'PNG (melhor qualidade)' }, { v: 'jpg', t: 'JPG (arquivo menor)' }, { v: 'pdf', t: 'PDF padrão' }, { v: 'pdf-hd', t: 'PDF para impressão (alta resolução)' }]) + '</select>') + campo('Páginas', '<select name="pags">' + opcoes([{ v: 'todas', t: 'Todas (' + d.paginas.length + ')' }, { v: 'atual', t: 'Só a página selecionada' }]) + '</select>') + campo('Tamanho', '<select name="esc">' + opcoes([{ v: '0.5', t: '0,5× (' + Math.round(d.w / 2) + ' × ' + Math.round(d.h / 2) + ')' }, { v: '1', t: '1× (' + d.w + ' × ' + d.h + ')' }, { v: '2', t: '2× (alta resolução)' }, { v: '3', t: '3× (máxima)' }], '1') + '</select>') +
      '<label class="check-inline" id="ds-transp"><input type="checkbox" name="transp"> Fundo transparente (PNG)</label><label class="ds-faixa" id="ds-qual" hidden><span>Qualidade</span><input type="range" name="qual" min="50" max="100" value="92"><output>92</output></label>',
      aoAbrir: function (f) { const at = function () { f.querySelector('#ds-transp').hidden = f.tipo.value !== 'png'; f.querySelector('#ds-qual').hidden = f.tipo.value !== 'jpg'; }; f.tipo.onchange = at; f.qual.oninput = function () { this.nextElementSibling.textContent = this.value; }; at(); } });
    if (!r) return;
    const tipo = r.get('tipo'), esc2 = tipo === 'pdf-hd' ? Math.max(2, Number(r.get('esc'))) : Number(r.get('esc')); const pags = r.get('pags') === 'atual' ? [paginaAtiva()] : d.paginas;
    const transp = tipo === 'png' && !!r.get('transp'), q = Number(r.get('qual') || 92) / 100;
    aviso('Gerando ' + tipo.replace('-hd', '').toUpperCase() + '…');
    try {
      if (tipo === 'pdf' || tipo === 'pdf-hd') {
        const J = await carregarJsPDF(); const doc = new J.jsPDF({ orientation: d.w > d.h ? 'landscape' : 'portrait', unit: 'px', format: [d.w, d.h], hotfixes: ['px_scaling'] });
        for (let i = 0; i < pags.length; i++) { const cv = await renderizar(d, pags[i], esc2); if (i) doc.addPage([d.w, d.h], d.w > d.h ? 'landscape' : 'portrait'); doc.addImage(cv.toDataURL('image/jpeg', tipo === 'pdf-hd' ? 0.97 : 0.92), 'JPEG', 0, 0, d.w, d.h); }
        UI.baixar(D.nomeArquivo(d, 'pdf'), doc.output('blob'));
      } else {
        for (let i = 0; i < pags.length; i++) {
          const cv = await renderizar(d, pags[i], esc2, transp);
          const blob = await new Promise(function (ok) { cv.toBlob(ok, tipo === 'jpg' ? 'image/jpeg' : 'image/png', tipo === 'jpg' ? q : undefined); });
          UI.baixar(D.nomeArquivo(d, tipo, pags.length > 1 ? d.paginas.indexOf(pags[i]) : null), blob);
        }
      }
    } catch (err) { aviso(err.message, 'erro'); }
  }

  // Ao sair do editor, guarda uma versão automática se houve mudança.
  window.addEventListener('hashchange', function () { if (!/^#\/design\/editar\//.test(location.hash) && ed) { if (D.salvarVersao(ed.d, '', true)) Dados.salvar(); ed = null; } });

  Telas.design = {
    titulo: 'Design',
    render: function (el, sub, param) { if (sub === 'editar') return telaEditor(el, param); ed = null; telaInicio(el); },
    _renderizar: renderizar
  };
})();
