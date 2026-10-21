/* Design (estilo Canva): formatos, modelos com a marca Seven, operações de elementos, alinhamento, guias, histórico e quebra de texto. Puro. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Design = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MARCA = { preto: '#050505', dourado: '#b68d40', ouroClaro: '#f5ecdb', navy: '#0a1929', vinho: '#800000', branco: '#ffffff', cinza: '#5f6670', fonte: 'Montserrat' };
  const PALETA = [MARCA.preto, MARCA.dourado, MARCA.ouroClaro, MARCA.navy, MARCA.vinho, MARCA.branco, '#1f5fbf', '#1f7a4a', '#e67e22', '#8e44ad', '#f2f2f2', MARCA.cinza];
  const FONTES = ['Montserrat', 'Poppins', 'Playfair Display', 'Lora', 'Bebas Neue', 'Roboto Mono', 'Arial', 'Georgia'];
  const FORMATOS = [
    { id: 'post', t: 'Post Instagram', w: 1080, h: 1080 },
    { id: 'story', t: 'Story / Reels', w: 1080, h: 1920 },
    { id: 'apresentacao', t: 'Apresentação 16:9', w: 1920, h: 1080 },
    { id: 'a4', t: 'Documento A4', w: 794, h: 1123 },
    { id: 'linkedin', t: 'Post LinkedIn', w: 1200, h: 627 },
    { id: 'capa-linkedin', t: 'Capa LinkedIn', w: 1584, h: 396 },
    { id: 'cartao', t: 'Cartão de visita', w: 1050, h: 600 },
    { id: 'whatsapp', t: 'Status WhatsApp', w: 1080, h: 1920 }
  ];

  let seq = 0;
  function id() { return 'el' + Date.now().toString(36) + (seq++).toString(36); }

  function el(tipo, o) {
    const base = { id: id(), tipo: tipo, x: 100, y: 100, w: 300, h: 200, rot: 0, opac: 1, travado: false };
    const pad = {
      texto: { texto: 'Texto', fonte: MARCA.fonte, tam: 48, peso: 700, cor: MARCA.preto, alinh: 'left', italico: false, sublinhado: false, entrelinha: 1.2, espaco: 0, maiusc: false, h: 60 },
      ret: { cor: MARCA.dourado, raio: 0, borda: 0, corBorda: MARCA.preto },
      elipse: { cor: MARCA.dourado, borda: 0, corBorda: MARCA.preto },
      triangulo: { cor: MARCA.dourado },
      estrela: { cor: MARCA.dourado, pontas: 5 },
      seta: { cor: MARCA.preto, h: 60 },
      linha: { cor: MARCA.preto, h: 6 },
      imagem: { src: '', arq: '', ajuste: 'cover', raio: 0 }
    }[tipo] || {};
    return Object.assign(base, pad, o || {});
  }

  function pagina(o) { return Object.assign({ id: id(), fundo: '#ffffff', elementos: [] }, o || {}); }
  function novoDesign(formato, o) {
    const f = typeof formato === 'string' ? FORMATOS.find(function (x) { return x.id === formato; }) : formato;
    return Object.assign({ id: 'ds' + Date.now().toString(36) + (seq++).toString(36), titulo: 'Design sem título', w: f.w, h: f.h, formato: f.id || 'custom', paginas: [pagina()], criadoEm: Date.now(), editadoEm: Date.now() }, o || {});
  }

  // ---------- modelos com a marca (só texto editável, nada de dado inventado) ----------
  const LOGO = 'img/seven-logo.png', MARCA_IMG = 'img/seven-marca.png';
  function modelo(nome) {
    const M = MARCA;
    const fab = {
      'post-licitacao': function () {
        const d = novoDesign('post', { titulo: 'Post — oportunidade aberta' }); const p = d.paginas[0]; p.fundo = M.preto;
        p.elementos = [
          el('ret', { x: 0, y: 0, w: 1080, h: 14, cor: M.dourado }),
          el('imagem', { x: 80, y: 80, w: 120, h: 120, src: MARCA_IMG, ajuste: 'contain' }),
          el('texto', { x: 80, y: 300, w: 920, h: 70, texto: 'OPORTUNIDADE ABERTA', tam: 40, peso: 600, cor: M.dourado, espaco: 6 }),
          el('texto', { x: 80, y: 380, w: 920, h: 260, texto: 'Pregão eletrônico para [objeto]', tam: 84, peso: 800, cor: M.branco, entrelinha: 1.1 }),
          el('texto', { x: 80, y: 700, w: 920, h: 120, texto: 'Órgão: [nome do órgão]\nSessão: [data e hora]', tam: 36, peso: 500, cor: M.ouroClaro, entrelinha: 1.4 }),
          el('ret', { x: 80, y: 900, w: 520, h: 90, cor: M.dourado, raio: 45 }),
          el('texto', { x: 80, y: 922, w: 520, h: 50, texto: 'Fale com a Seven', tam: 34, peso: 700, cor: M.preto, alinh: 'center' })
        ]; return d;
      },
      'story-resultado': function () {
        const d = novoDesign('story', { titulo: 'Story — resultado de pregão' }); const p = d.paginas[0]; p.fundo = M.navy;
        p.elementos = [
          el('elipse', { x: 640, y: -200, w: 700, h: 700, cor: M.dourado, opac: 0.25 }),
          el('imagem', { x: 90, y: 140, w: 360, h: 120, src: LOGO, ajuste: 'contain' }),
          el('texto', { x: 90, y: 620, w: 900, h: 80, texto: 'RESULTADO', tam: 56, peso: 600, cor: M.dourado, espaco: 10 }),
          el('texto', { x: 90, y: 720, w: 900, h: 420, texto: 'Mais um pregão vencido pelo nosso cliente', tam: 104, peso: 800, cor: M.branco, entrelinha: 1.05 }),
          el('linha', { x: 90, y: 1220, w: 200, h: 8, cor: M.dourado }),
          el('texto', { x: 90, y: 1280, w: 900, h: 200, texto: '[Objeto]\n[Órgão — UF]', tam: 44, peso: 500, cor: M.ouroClaro, entrelinha: 1.4 }),
          el('texto', { x: 90, y: 1700, w: 900, h: 60, texto: 'Seven · BPO de Licitações', tam: 36, peso: 600, cor: M.branco })
        ]; return d;
      },
      'capa-proposta': function () {
        const d = novoDesign('a4', { titulo: 'Capa de proposta comercial' }); const p = d.paginas[0]; p.fundo = M.branco;
        p.elementos = [
          el('ret', { x: 0, y: 0, w: 260, h: 1123, cor: M.preto }),
          el('ret', { x: 260, y: 0, w: 10, h: 1123, cor: M.dourado }),
          el('imagem', { x: 50, y: 60, w: 160, h: 160, src: MARCA_IMG, ajuste: 'contain' }),
          el('texto', { x: 330, y: 360, w: 420, h: 40, texto: 'PROPOSTA COMERCIAL', tam: 20, peso: 600, cor: M.dourado, espaco: 4 }),
          el('texto', { x: 330, y: 410, w: 420, h: 200, texto: 'BPO de Licitações para [Cliente]', tam: 44, peso: 800, cor: M.preto, entrelinha: 1.1 }),
          el('texto', { x: 330, y: 650, w: 420, h: 120, texto: 'Do edital ao pagamento: encontrar, cadastrar, disputar e acompanhar.', tam: 18, peso: 400, cor: M.cinza, entrelinha: 1.5 }),
          el('texto', { x: 330, y: 1000, w: 420, h: 70, texto: 'Lucas Neves | Seven\n(61) 98347-2232', tam: 16, peso: 600, cor: M.preto, entrelinha: 1.5 })
        ]; return d;
      },
      'cartao': function () {
        const d = novoDesign('cartao', { titulo: 'Cartão de visita' }); const p = d.paginas[0]; p.fundo = M.preto;
        p.elementos = [
          el('imagem', { x: 70, y: 70, w: 300, h: 100, src: LOGO, ajuste: 'contain' }),
          el('ret', { x: 70, y: 300, w: 120, h: 6, cor: M.dourado }),
          el('texto', { x: 70, y: 330, w: 900, h: 60, texto: 'Lucas Neves', tam: 48, peso: 700, cor: M.branco }),
          el('texto', { x: 70, y: 395, w: 900, h: 40, texto: 'Fundador · BPO de Licitações', tam: 26, peso: 500, cor: M.dourado }),
          el('texto', { x: 70, y: 480, w: 900, h: 40, texto: '(61) 98347-2232 · Catalão-GO · Brasília-DF', tam: 24, peso: 500, cor: M.ouroClaro })
        ]; return d;
      },
      'apresentacao': function () {
        const d = novoDesign('apresentacao', { titulo: 'Apresentação comercial' });
        const capa = d.paginas[0]; capa.fundo = M.preto;
        capa.elementos = [
          el('imagem', { x: 120, y: 120, w: 420, h: 140, src: LOGO, ajuste: 'contain' }),
          el('texto', { x: 120, y: 420, w: 1300, h: 260, texto: 'Seu departamento de licitações, do edital ao pagamento', tam: 88, peso: 800, cor: M.branco, entrelinha: 1.1 }),
          el('ret', { x: 120, y: 760, w: 220, h: 10, cor: M.dourado }),
          el('texto', { x: 120, y: 810, w: 1300, h: 60, texto: 'Apresentação para [Cliente]', tam: 40, peso: 500, cor: M.ouroClaro })
        ];
        const p2 = pagina({ fundo: M.branco });
        p2.elementos = [el('texto', { x: 120, y: 100, w: 1680, h: 90, texto: 'Como a Seven trabalha', tam: 64, peso: 800, cor: M.preto })].concat(['Encontrar', 'Cadastrar', 'Disputar', 'Acompanhar'].reduce(function (a, t, i) {
          const x = 120 + i * 430;
          return a.concat([el('ret', { x: x, y: 330, w: 390, h: 520, cor: i % 2 ? M.ouroClaro : M.preto, raio: 24 }), el('texto', { x: x + 40, y: 380, w: 310, h: 80, texto: String(i + 1).padStart(2, '0'), tam: 64, peso: 800, cor: M.dourado }), el('texto', { x: x + 40, y: 480, w: 310, h: 70, texto: t, tam: 44, peso: 700, cor: i % 2 ? M.preto : M.branco }), el('texto', { x: x + 40, y: 570, w: 310, h: 220, texto: '[Descreva a etapa]', tam: 26, peso: 400, cor: i % 2 ? M.cinza : M.ouroClaro, entrelinha: 1.4 })]);
        }, []));
        d.paginas.push(p2); return d;
      },
      'certificado': function () {
        const d = novoDesign('apresentacao', { titulo: 'Certificado de treinamento' }); const p = d.paginas[0]; p.fundo = M.ouroClaro;
        p.elementos = [
          el('ret', { x: 40, y: 40, w: 1840, h: 1000, cor: 'transparent', borda: 6, corBorda: M.dourado }),
          el('imagem', { x: 860, y: 100, w: 200, h: 200, src: MARCA_IMG, ajuste: 'contain' }),
          el('texto', { x: 160, y: 340, w: 1600, h: 90, texto: 'CERTIFICADO', tam: 80, peso: 800, cor: M.preto, alinh: 'center', espaco: 12 }),
          el('texto', { x: 160, y: 470, w: 1600, h: 60, texto: 'Certificamos que', tam: 36, peso: 400, cor: M.cinza, alinh: 'center' }),
          el('texto', { x: 160, y: 550, w: 1600, h: 100, texto: '[Nome do participante]', tam: 72, peso: 700, cor: M.dourado, alinh: 'center', fonte: 'Playfair Display' }),
          el('texto', { x: 260, y: 690, w: 1400, h: 120, texto: 'concluiu o treinamento [nome do curso], com carga horária de [x] horas.', tam: 34, peso: 400, cor: M.preto, alinh: 'center', entrelinha: 1.5 }),
          el('linha', { x: 760, y: 920, w: 400, h: 3, cor: M.preto }),
          el('texto', { x: 660, y: 940, w: 600, h: 50, texto: 'Lucas Neves | Seven', tam: 28, peso: 600, cor: M.preto, alinh: 'center' })
        ]; return d;
      }
    }[nome];
    return fab ? fab() : null;
  }
  const MODELOS = [
    { id: 'post-licitacao', t: 'Post: oportunidade aberta', formato: 'post' }, { id: 'story-resultado', t: 'Story: resultado de pregão', formato: 'story' },
    { id: 'apresentacao', t: 'Apresentação comercial', formato: 'apresentacao' }, { id: 'capa-proposta', t: 'Capa de proposta', formato: 'a4' },
    { id: 'cartao', t: 'Cartão de visita', formato: 'cartao' }, { id: 'certificado', t: 'Certificado de treinamento', formato: 'apresentacao' }
  ];

  // ---------- geometria ----------
  function arred(v) { return Math.round(v * 10) / 10; }
  // Redimensiona pela alça (n, s, e, w, ne, nw, se, sw). prop = manter proporção.
  function redimensionar(o, alca, dx, dy, prop, min) {
    min = min || 10; let x = o.x, y = o.y, w = o.w, h = o.h;
    if (alca.indexOf('e') >= 0) w = o.w + dx; if (alca.indexOf('w') >= 0) { w = o.w - dx; x = o.x + dx; }
    if (alca.indexOf('s') >= 0) h = o.h + dy; if (alca.indexOf('n') >= 0) { h = o.h - dy; y = o.y + dy; }
    if (prop && alca.length === 2) { const k = Math.max(w / o.w, h / o.h); const nw = o.w * k, nh = o.h * k; if (alca.indexOf('w') >= 0) x = o.x + o.w - nw; if (alca.indexOf('n') >= 0) y = o.y + o.h - nh; w = nw; h = nh; }
    if (w < min) { if (alca.indexOf('w') >= 0) x -= min - w; w = min; } if (h < min) { if (alca.indexOf('n') >= 0) y -= min - h; h = min; }
    return { x: arred(x), y: arred(y), w: arred(w), h: arred(h) };
  }
  function angulo(cx, cy, px, py, passo) { let a = Math.atan2(py - cy, px - cx) * 180 / Math.PI + 90; a = ((a % 360) + 360) % 360; if (passo) a = Math.round(a / passo) * passo % 360; return Math.round(a); }

  // Atração para guias (centro e bordas da página e de outros elementos).
  function guias(o, outros, pw, ph, tol) {
    tol = tol || 6; const vx = [0, pw / 2, pw], vy = [0, ph / 2, ph];
    (outros || []).forEach(function (e) { vx.push(e.x, e.x + e.w / 2, e.x + e.w); vy.push(e.y, e.y + e.h / 2, e.y + e.h); });
    let x = o.x, y = o.y; const linhas = [];
    let melhor = tol + 1;
    [[o.x, 0], [o.x + o.w / 2, o.w / 2], [o.x + o.w, o.w]].forEach(function (p) { vx.forEach(function (g) { const d = Math.abs(p[0] - g); if (d <= tol && d < melhor) { melhor = d; x = g - p[1]; linhas[0] = { eixo: 'x', v: g }; } }); });
    melhor = tol + 1;
    [[o.y, 0], [o.y + o.h / 2, o.h / 2], [o.y + o.h, o.h]].forEach(function (p) { vy.forEach(function (g) { const d = Math.abs(p[0] - g); if (d <= tol && d < melhor) { melhor = d; y = g - p[1]; linhas[1] = { eixo: 'y', v: g }; } }); });
    return { x: arred(x), y: arred(y), linhas: linhas.filter(Boolean) };
  }

  function alinhar(els, modo, pw, ph) {
    if (!els.length) return els;
    const ref = els.length === 1 ? { x: 0, y: 0, w: pw, h: ph } : { x: Math.min.apply(null, els.map(function (e) { return e.x; })), y: Math.min.apply(null, els.map(function (e) { return e.y; })), x2: Math.max.apply(null, els.map(function (e) { return e.x + e.w; })), y2: Math.max.apply(null, els.map(function (e) { return e.y + e.h; })) };
    if (ref.x2 != null) { ref.w = ref.x2 - ref.x; ref.h = ref.y2 - ref.y; }
    els.forEach(function (e) {
      if (modo === 'esquerda') e.x = ref.x; if (modo === 'direita') e.x = ref.x + ref.w - e.w; if (modo === 'centro-h') e.x = arred(ref.x + (ref.w - e.w) / 2);
      if (modo === 'topo') e.y = ref.y; if (modo === 'base') e.y = ref.y + ref.h - e.h; if (modo === 'centro-v') e.y = arred(ref.y + (ref.h - e.h) / 2);
    });
    return els;
  }
  function distribuir(els, eixo) {
    if (els.length < 3) return els;
    const k = eixo === 'h' ? 'x' : 'y', t = eixo === 'h' ? 'w' : 'h';
    const ord = els.slice().sort(function (a, b) { return a[k] - b[k]; });
    const ini = ord[0][k], fim = ord[ord.length - 1][k] + ord[ord.length - 1][t];
    const ocup = ord.reduce(function (s, e) { return s + e[t]; }, 0); const gap = (fim - ini - ocup) / (ord.length - 1);
    let pos = ini; ord.forEach(function (e) { e[k] = arred(pos); pos += e[t] + gap; });
    return els;
  }
  function ordem(lista, idEl, acao) {
    const i = lista.findIndex(function (e) { return e.id === idEl; }); if (i < 0) return lista;
    const [x] = lista.splice(i, 1);
    const j = acao === 'frente' ? lista.length : acao === 'tras' ? 0 : acao === 'subir' ? Math.min(lista.length, i + 1) : Math.max(0, i - 1);
    lista.splice(j, 0, x); return lista;
  }
  function selecaoRetangulo(els, r) {
    const x1 = Math.min(r.x1, r.x2), x2 = Math.max(r.x1, r.x2), y1 = Math.min(r.y1, r.y2), y2 = Math.max(r.y1, r.y2);
    return els.filter(function (e) { return e.x < x2 && e.x + e.w > x1 && e.y < y2 && e.y + e.h > y1; }).map(function (e) { return e.id; });
  }

  // ---------- formas ----------
  function pontosEstrela(w, h, pontas) {
    const n = pontas || 5, pts = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? 0.45 : 1; const a = Math.PI * i / n - Math.PI / 2; pts.push([arred(w / 2 + Math.cos(a) * w / 2 * r), arred(h / 2 + Math.sin(a) * h / 2 * r)]); }
    return pts;
  }
  function pontosSeta(w, h) { const c = Math.min(h, w * 0.4); return [[0, h * 0.3], [w - c, h * 0.3], [w - c, 0], [w, h / 2], [w - c, h], [w - c, h * 0.7], [0, h * 0.7]].map(function (p) { return [arred(p[0]), arred(p[1])]; }); }

  // ---------- texto ----------
  // Quebra respeitando \n e largura; medir(t) devolve a largura em px.
  function quebrarTexto(texto, largura, medir) {
    const out = [];
    String(texto).split('\n').forEach(function (par) {
      const ps = par.split(' '); let linha = '';
      ps.forEach(function (p) {
        const tenta = linha ? linha + ' ' + p : p;
        if (medir(tenta) <= largura || !linha) {
          if (!linha && medir(p) > largura) { let pedaco = ''; for (const ch of p) { if (medir(pedaco + ch) > largura && pedaco) { out.push(pedaco); pedaco = ch; } else pedaco += ch; } linha = pedaco; }
          else linha = tenta;
        } else { out.push(linha); linha = p; }
      });
      out.push(linha);
    });
    return out;
  }

  // ---------- histórico ----------
  function historico(limite) {
    const h = { pilha: [], futuro: [], limite: limite || 60 };
    h.registrar = function (estado) { const s = JSON.stringify(estado); if (h.pilha[h.pilha.length - 1] === s) return; h.pilha.push(s); if (h.pilha.length > h.limite) h.pilha.shift(); h.futuro = []; };
    h.desfazer = function (atual) { if (h.pilha.length < 2) return null; h.futuro.push(h.pilha.pop()); return JSON.parse(h.pilha[h.pilha.length - 1]); };
    h.refazer = function () { if (!h.futuro.length) return null; const s = h.futuro.pop(); h.pilha.push(s); return JSON.parse(s); };
    return h;
  }

  function nomeArquivo(d, ext, pg) { return (String(d.titulo || 'design').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'design') + (pg != null ? '-' + (pg + 1) : '') + '.' + ext; }

  return { MARCA: MARCA, PALETA: PALETA, FONTES: FONTES, FORMATOS: FORMATOS, MODELOS: MODELOS, el: el, pagina: pagina, novoDesign: novoDesign, modelo: modelo,
    redimensionar: redimensionar, angulo: angulo, guias: guias, alinhar: alinhar, distribuir: distribuir, ordem: ordem, selecaoRetangulo: selecaoRetangulo,
    pontosEstrela: pontosEstrela, pontosSeta: pontosSeta, quebrarTexto: quebrarTexto, historico: historico, nomeArquivo: nomeArquivo };
});
