/* Gráficos em SVG puro (sem biblioteca) para o Painel: colunas, barras horizontais, colunas agrupadas, linha, rosca,
   sparkline. Cores pelos papéis do CSS (--gf-1…--gf-6, validadas para daltonismo e contraste nos dois temas), marcas
   finas com pontas arredondadas, grade em linhas finas, rótulos seletivos e dica (data-dica) em cada marca. Puro. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Graficos = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function r1(v) { return Math.round(v * 10) / 10; }
  // Máximo "redondo" e marcas da escala (1, 2, 2,5, 5 × 10^n).
  function escala(max, n) {
    n = n || 4; if (!(max > 0)) return { max: 1, marcas: [0, 1] };
    const bruto = max / n; const p = Math.pow(10, Math.floor(Math.log10(bruto)));
    const passo = [1, 2, 2.5, 5, 10].map(function (m) { return m * p; }).find(function (s) { return s >= bruto; });
    const topo = Math.ceil(max / passo - 1e-9) * passo; const marcas = [];
    for (let v = 0; v <= topo + passo / 2; v += passo) marcas.push(Math.round(v * 1e6) / 1e6);
    return { max: topo, marcas: marcas };
  }
  // Rótulo curto do eixo: 1,2 mil · 3,4 mi.
  function compacto(v) {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',').replace(/,0$/, '') + ' mi';
    if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace('.', ',').replace(/,0$/, '') + ' mil';
    return String(Math.round(v * 100) / 100).replace('.', ',');
  }
  function cortar(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
  // Retângulo com as duas pontas de cima (ou da direita) arredondadas e a base reta, presa na linha de base.
  function barraV(x, y, w, h, raio) { const r = Math.min(raio, w / 2, h); if (h <= 0) return ''; return 'M' + r1(x) + ',' + r1(y + h) + 'V' + r1(y + r) + 'Q' + r1(x) + ',' + r1(y) + ' ' + r1(x + r) + ',' + r1(y) + 'H' + r1(x + w - r) + 'Q' + r1(x + w) + ',' + r1(y) + ' ' + r1(x + w) + ',' + r1(y + r) + 'V' + r1(y + h) + 'Z'; }
  function barraH(x, y, w, h, raio) { const r = Math.min(raio, h / 2, w); if (w <= 0) return ''; return 'M' + r1(x) + ',' + r1(y) + 'H' + r1(x + w - r) + 'Q' + r1(x + w) + ',' + r1(y) + ' ' + r1(x + w) + ',' + r1(y + r) + 'V' + r1(y + h - r) + 'Q' + r1(x + w) + ',' + r1(y + h) + ' ' + r1(x + w - r) + ',' + r1(y + h) + 'H' + r1(x) + 'Z'; }
  function svg(w, h, corpo, titulo) { return '<svg class="gf" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(titulo || 'Gráfico') + '" preserveAspectRatio="xMidYMid meet">' + corpo + '</svg>'; }
  function vazio(w, h, texto) { return svg(w, h, '<text class="gf-vazio" x="' + w / 2 + '" y="' + h / 2 + '" text-anchor="middle">' + esc(texto || 'Sem dados no período') + '</text>'); }
  function grade(esq, dir, topo, base, sc, fmt) {
    return sc.marcas.map(function (m) { const y = base - (m / sc.max) * (base - topo); return '<line class="gf-grade" x1="' + esq + '" x2="' + dir + '" y1="' + r1(y) + '" y2="' + r1(y) + '"/><text class="gf-eixo" x="' + (esq - 6) + '" y="' + r1(y + 3.5) + '" text-anchor="end">' + esc(fmt(m)) + '</text>'; }).join('');
  }

  // Colunas: itens [{r: rótulo, v: valor, dica?}]. Um só tom (série única); o maior leva o valor escrito.
  function colunas(itens, o) {
    o = o || {}; const W = o.largura || 480, H = o.altura || 200; const fmt = o.fmt || compacto; const fmtEixo = o.fmtEixo || compacto;
    if (!itens.length || !itens.some(function (x) { return x.v; })) return vazio(W, H, o.vazio);
    const esq = 44, dir = W - 8, topo = 18, base = H - 26; const sc = escala(Math.max.apply(null, itens.map(function (x) { return x.v || 0; })));
    const fatia = (dir - esq) / itens.length; const larg = Math.max(4, Math.min(42, fatia - 2 - fatia * 0.3));
    const imax = itens.reduce(function (b, x, i) { return (x.v || 0) > (itens[b].v || 0) ? i : b; }, 0);
    const passoRot = Math.ceil(itens.length / Math.max(1, Math.floor((dir - esq) / 46)));
    let c = grade(esq, dir, topo, base, sc, fmtEixo);
    itens.forEach(function (x, i) {
      const cx = esq + fatia * i + fatia / 2; const h = (x.v || 0) / sc.max * (base - topo); const y = base - h;
      const dica = x.dica || (x.r + ': ' + fmt(x.v || 0));
      c += '<rect class="gf-alvo" x="' + r1(esq + fatia * i) + '" y="' + topo + '" width="' + r1(fatia) + '" height="' + (base - topo) + '" data-dica="' + esc(dica) + '"/>';
      if (h > 0) c += '<path class="gf-m ' + (x.classe || 'gf-c1') + '" d="' + barraV(cx - larg / 2, y, larg, h, 4) + '"/>';
      if (i === imax && x.v) c += '<text class="gf-valor" x="' + r1(cx) + '" y="' + r1(y - 5) + '" text-anchor="middle">' + esc(fmt(x.v)) + '</text>';
      if (i % passoRot === 0) c += '<text class="gf-eixo" x="' + r1(cx) + '" y="' + (base + 15) + '" text-anchor="middle">' + esc(cortar(x.r, 9)) + '</text>';
    });
    c += '<line class="gf-base" x1="' + esq + '" x2="' + dir + '" y1="' + base + '" y2="' + base + '"/>';
    return svg(W, H, c, o.titulo);
  }

  // Colunas agrupadas: categorias [rótulos], series [{nome, valores, classe}]. Legenda fica no HTML (legenda()).
  function agrupadas(categorias, series, o) {
    o = o || {}; const W = o.largura || 480, H = o.altura || 200; const fmt = o.fmt || compacto;
    const todos = []; series.forEach(function (s) { s.valores.forEach(function (v) { todos.push(v || 0); }); });
    if (!categorias.length || !todos.some(Boolean)) return vazio(W, H, o.vazio);
    const esq = 44, dir = W - 8, topo = 14, base = H - 26; const sc = escala(Math.max.apply(null, todos));
    const fatia = (dir - esq) / categorias.length; const gap = 2; const grupo = Math.min(fatia * 0.72, 30 * series.length); const larg = (grupo - gap * (series.length - 1)) / series.length;
    let c = grade(esq, dir, topo, base, sc, compacto);
    categorias.forEach(function (cat, i) {
      const x0 = esq + fatia * i + (fatia - grupo) / 2;
      c += '<rect class="gf-alvo" x="' + r1(esq + fatia * i) + '" y="' + topo + '" width="' + r1(fatia) + '" height="' + (base - topo) + '" data-dica="' + esc(cat + ' · ' + series.map(function (s) { return s.nome + ': ' + fmt(s.valores[i] || 0); }).join(' · ')) + '"/>';
      series.forEach(function (s, k) { const v = s.valores[i] || 0; const h = v / sc.max * (base - topo); if (h > 0) c += '<path class="gf-m ' + (s.classe || 'gf-c' + (k + 1)) + '" d="' + barraV(x0 + k * (larg + gap), base - h, larg, h, 3) + '"/>'; });
      c += '<text class="gf-eixo" x="' + r1(esq + fatia * i + fatia / 2) + '" y="' + (base + 15) + '" text-anchor="middle">' + esc(cortar(cat, 8)) + '</text>';
    });
    c += '<line class="gf-base" x1="' + esq + '" x2="' + dir + '" y1="' + base + '" y2="' + base + '"/>';
    return svg(W, H, c, o.titulo);
  }

  // Barras horizontais (ranking, funil): rótulo à esquerda, valor no fim da barra.
  function barras(itens, o) {
    o = o || {}; const W = o.largura || 480; const fmt = o.fmt || compacto; const linha = o.linha || 26;
    if (!itens.length) return vazio(W, 120, o.vazio);
    const H = itens.length * linha + 8; const esq = Math.min(170, Math.round(W * 0.36));
    const maiorValor = Math.max.apply(null, itens.map(function (x) { return String(x.rotuloValor != null ? x.rotuloValor : fmt(x.v || 0)).length; })); const dir = W - Math.max(40, Math.round(maiorValor * 6.8) + 14);
    const max = Math.max.apply(null, itens.map(function (x) { return x.v || 0; }).concat([0]));
    let c = '';
    itens.forEach(function (x, i) {
      const y = 4 + i * linha; const w = max ? (x.v || 0) / max * (dir - esq) : 0; const h = Math.min(16, linha - 8);
      c += '<rect class="gf-alvo" x="0" y="' + y + '" width="' + W + '" height="' + linha + '" data-dica="' + esc(x.dica || (x.r + ': ' + fmt(x.v || 0))) + '"/>';
      c += '<text class="gf-rot" x="' + (esq - 8) + '" y="' + r1(y + linha / 2 + 4) + '" text-anchor="end">' + esc(cortar(x.r, Math.floor(esq / 7))) + '</text>';
      c += '<rect class="gf-trilho" x="' + esq + '" y="' + r1(y + (linha - h) / 2) + '" width="' + (dir - esq) + '" height="' + h + '" rx="4"/>';
      if (w > 0) c += '<path class="gf-m ' + (x.classe || 'gf-c1') + '" d="' + barraH(esq, y + (linha - h) / 2, Math.max(w, 3), h, 4) + '"/>';
      c += '<text class="gf-valor" x="' + r1(dir + 8) + '" y="' + r1(y + linha / 2 + 4) + '">' + esc(x.rotuloValor != null ? x.rotuloValor : fmt(x.v || 0)) + '</text>';
    });
    return svg(W, H, c, o.titulo);
  }

  // Linha: rotulos (eixo x) e series [{nome, valores (null = sem dado), classe}]. ref: linha de referência (ex.: 85%).
  function linha(rotulos, series, o) {
    o = o || {}; const W = o.largura || 480, H = o.altura || 200; const fmt = o.fmt || compacto;
    const todos = []; series.forEach(function (s) { s.valores.forEach(function (v) { if (v != null) todos.push(v); }); });
    if (!todos.length) return vazio(W, H, o.vazio);
    const esq = 44, dir = W - (o.rotuloFinal === false ? 10 : 56), topo = 14, base = H - 26;
    const sc = escala(Math.max.apply(null, todos.concat(o.ref != null ? [o.ref] : []).concat(o.max != null ? [o.max] : [])));
    const n = rotulos.length; const x = function (i) { return n === 1 ? (esq + dir) / 2 : esq + (dir - esq) * i / (n - 1); };
    const y = function (v) { return base - v / sc.max * (base - topo); };
    let c = grade(esq, dir, topo, base, sc, o.fmtEixo || compacto);
    if (o.ref != null) c += '<line class="gf-ref" x1="' + esq + '" x2="' + dir + '" y1="' + r1(y(o.ref)) + '" y2="' + r1(y(o.ref)) + '"/><text class="gf-eixo gf-ref-t" x="' + (dir + 4) + '" y="' + r1(y(o.ref) + 3.5) + '">' + esc(o.refRotulo || fmt(o.ref)) + '</text>';
    const passoRot = Math.ceil(n / Math.max(1, Math.floor((dir - esq) / 46)));
    rotulos.forEach(function (r, i) { if (i % passoRot === 0 || i === n - 1) c += '<text class="gf-eixo" x="' + r1(x(i)) + '" y="' + (base + 15) + '" text-anchor="middle">' + esc(cortar(r, 8)) + '</text>'; });
    series.forEach(function (s, k) {
      const cl = s.classe || 'gf-c' + (k + 1); let d = ''; let ult = null; let novo = true;
      s.valores.forEach(function (v, i) { if (v == null) { novo = true; return; } d += (novo ? 'M' : 'L') + r1(x(i)) + ',' + r1(y(v)); novo = false; ult = i; });
      c += '<path class="gf-linha ' + cl + '" d="' + d + '"/>';
      if (ult != null) {
        c += '<circle class="gf-ponto ' + cl + '" cx="' + r1(x(ult)) + '" cy="' + r1(y(s.valores[ult])) + '" r="4"/>';
        if (o.rotuloFinal !== false) c += '<text class="gf-valor" x="' + r1(x(ult) + 8) + '" y="' + r1(y(s.valores[ult]) + 4) + '">' + esc(fmt(s.valores[ult])) + '</text>';
      }
    });
    rotulos.forEach(function (r, i) {
      const meio = (dir - esq) / Math.max(1, n - 1);
      c += '<rect class="gf-alvo" x="' + r1(x(i) - meio / 2) + '" y="' + topo + '" width="' + r1(meio) + '" height="' + (base - topo) + '" data-dica="' + esc(r + ' · ' + series.map(function (s) { return (series.length > 1 ? s.nome + ': ' : '') + (s.valores[i] == null ? '—' : fmt(s.valores[i])); }).join(' · ')) + '" data-x="' + r1(x(i)) + '"/>';
    });
    c += '<line class="gf-base" x1="' + esq + '" x2="' + dir + '" y1="' + base + '" y2="' + base + '"/>';
    return svg(W, H, c, o.titulo);
  }

  // Rosca: fatias [{r, v, classe}]. No máximo 6; o resto vira "Outros". Centro com o total.
  function agruparOutros(fatias, max) {
    max = max || 6; const ord = fatias.filter(function (f) { return f.v > 0; });
    if (ord.length <= max) return ord;
    const fica = ord.slice().sort(function (a, b) { return b.v - a.v; }).slice(0, max - 1);
    const resto = ord.filter(function (f) { return fica.indexOf(f) < 0; }).reduce(function (s, f) { return s + f.v; }, 0);
    return ord.filter(function (f) { return fica.indexOf(f) >= 0; }).concat([{ r: 'Outros', v: resto, classe: 'gf-outros' }]);
  }
  function rosca(fatias, o) {
    o = o || {}; const T = o.tamanho || 180; const fmt = o.fmt || compacto;
    const fs = agruparOutros(fatias, 6); const total = fs.reduce(function (s, f) { return s + f.v; }, 0);
    if (!total) return vazio(T, T, o.vazio);
    const cx = T / 2, cy = T / 2, R = T / 2 - 4, r = R * 0.62; let ang = -Math.PI / 2; let c = '';
    const ponto = function (a, raio) { return r1(cx + raio * Math.cos(a)) + ',' + r1(cy + raio * Math.sin(a)); };
    const folga = fs.length > 1 ? 2 / R : 0; // 2px de superfície entre fatias
    fs.forEach(function (f, i) {
      const a0 = ang, a1 = ang + f.v / total * Math.PI * 2; ang = a1;
      const cl = f.classe || 'gf-c' + (i + 1); const dica = f.r + ': ' + fmt(f.v) + ' (' + Math.round(f.v / total * 100) + '%)';
      if (fs.length === 1) { c += '<circle class="gf-m ' + cl + '" cx="' + cx + '" cy="' + cy + '" r="' + r1((R + r) / 2) + '" fill="none" stroke-width="' + r1(R - r) + '" data-dica="' + esc(dica) + '"/>'; return; }
      const b0 = a0 + folga / 2, b1 = Math.max(b0 + 0.001, a1 - folga / 2); const g = b1 - b0 > Math.PI ? 1 : 0;
      c += '<path class="gf-m gf-fatia ' + cl + '" d="M' + ponto(b0, R) + 'A' + r1(R) + ',' + r1(R) + ' 0 ' + g + ' 1 ' + ponto(b1, R) + 'L' + ponto(b1, r) + 'A' + r1(r) + ',' + r1(r) + ' 0 ' + g + ' 0 ' + ponto(b0, r) + 'Z" data-dica="' + esc(dica) + '"/>';
    });
    c += '<text class="gf-total" x="' + cx + '" y="' + (cy + 2) + '" text-anchor="middle">' + esc(o.centro != null ? o.centro : fmt(total)) + '</text><text class="gf-eixo" x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle">' + esc(o.rotuloCentro || 'total') + '</text>';
    return svg(T, T, c, o.titulo);
  }
  // Legenda em HTML (identidade nunca só pela cor: nome + valor ao lado do quadradinho).
  function legenda(itens, fmt) {
    fmt = fmt || compacto; const total = itens.reduce(function (s, f) { return s + (f.v || 0); }, 0);
    return '<ul class="gf-leg">' + itens.map(function (f, i) { return '<li><i class="' + (f.classe || 'gf-c' + (i + 1)) + '"></i><span>' + esc(f.r) + '</span>' + (f.v != null ? '<b>' + esc(fmt(f.v)) + (total && itens.length > 1 && f.pct !== false ? ' <small>' + Math.round(f.v / total * 100) + '%</small>' : '') + '</b>' : '') + '</li>'; }).join('') + '</ul>';
  }
  function sparkline(valores, o) {
    o = o || {}; const W = o.largura || 120, H = o.altura || 32; const vs = valores.filter(function (v) { return v != null; });
    if (vs.length < 2) return '';
    const min = Math.min.apply(null, vs), max = Math.max.apply(null, vs); const amp = max - min || 1;
    const x = function (i) { return 2 + (W - 8) * i / (valores.length - 1); }; const y = function (v) { return H - 3 - (v - min) / amp * (H - 6); };
    let d = ''; valores.forEach(function (v, i) { if (v != null) d += (d ? 'L' : 'M') + r1(x(i)) + ',' + r1(y(v)); });
    const u = valores.length - 1;
    return '<svg class="gf gf-spark" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path class="gf-area ' + (o.classe || 'gf-c1') + '" d="' + d + 'L' + r1(x(u)) + ',' + H + 'L' + r1(x(0)) + ',' + H + 'Z"/><path class="gf-linha ' + (o.classe || 'gf-c1') + '" d="' + d + '"/><circle class="gf-ponto ' + (o.classe || 'gf-c1') + '" cx="' + r1(x(u)) + '" cy="' + r1(y(valores[u])) + '" r="3"/></svg>';
  }
  // Tabela equivalente ao gráfico (acessibilidade e leitura exata).
  function tabela(cabecalho, linhas) { return '<table class="tabela compacta gf-tab"><thead><tr>' + cabecalho.map(function (h, i) { return '<th' + (i ? ' class="n"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + linhas.map(function (l) { return '<tr>' + l.map(function (v, i) { return '<td' + (i ? ' class="n"' : '') + '>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; }

  return { escala: escala, compacto: compacto, colunas: colunas, agrupadas: agrupadas, barras: barras, linha: linha, rosca: rosca, agruparOutros: agruparOutros, legenda: legenda, sparkline: sparkline, tabela: tabela, esc: esc };
});
