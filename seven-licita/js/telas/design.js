/* Design (estilo Canva): formatos, modelos da marca Seven, editor com páginas, formas, texto, imagens e exportação PNG/JPG/PDF. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, confirmar, aviso } = UI;
  const D = self.Design;
  const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const FONTES_URL = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Playfair+Display:wght@400;700;800&family=Lora:wght@400;700&family=Bebas+Neue&family=Roboto+Mono:wght@400;700&display=swap';
  const urls = {};
  let ed = null; // estado do editor aberto

  function e() { const d = Dados.e; d.design = d.design || {}; const x = d.design; x.designs = x.designs || []; x.uploads = x.uploads || []; return x; }
  function achar(id) { return e().designs.find(function (d) { return d.id === id; }); }
  function carregarFontes() { if (document.getElementById('ds-fontes')) return; const l = document.createElement('link'); l.id = 'ds-fontes'; l.rel = 'stylesheet'; l.href = FONTES_URL; document.head.appendChild(l); }
  async function srcImagem(x) { if (x.src) return x.src; if (!x.arq) return ''; if (!urls[x.arq]) { const b = await Dados.lerArquivo(x.arq); if (b) urls[x.arq] = URL.createObjectURL(b); } return urls[x.arq] || ''; }
  async function hidratar(raiz) { for (const im of raiz.querySelectorAll('img[data-arq]')) { const s = await srcImagem({ arq: im.dataset.arq }); if (s) im.src = s; } }

  // ---------- desenho DOM de um elemento ----------
  function estiloBase(x) { return 'left:' + x.x + 'px;top:' + x.y + 'px;width:' + x.w + 'px;height:' + x.h + 'px;transform:rotate(' + (x.rot || 0) + 'deg);opacity:' + (x.opac == null ? 1 : x.opac) + ';'; }
  function poligono(pts, cor) { return '<svg viewBox="0 0 ' + Math.max(...pts.map(function (p) { return p[0]; })) + ' ' + Math.max(...pts.map(function (p) { return p[1]; })) + '" preserveAspectRatio="none" width="100%" height="100%"><polygon points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '" fill="' + esc(cor) + '"/></svg>'; }
  function htmlEl(x) {
    const b = estiloBase(x); const a = 'class="ds-el ds-' + x.tipo + (x.travado ? ' travado' : '') + '" data-id="' + x.id + '"';
    if (x.tipo === 'texto') return '<div ' + a + ' style="' + b + 'font-family:\'' + esc(x.fonte) + '\',sans-serif;font-size:' + x.tam + 'px;font-weight:' + x.peso + ';color:' + esc(x.cor) + ';text-align:' + x.alinh + ';line-height:' + x.entrelinha + ';letter-spacing:' + (x.espaco || 0) + 'px;font-style:' + (x.italico ? 'italic' : 'normal') + ';text-decoration:' + (x.sublinhado ? 'underline' : 'none') + ';text-transform:' + (x.maiusc ? 'uppercase' : 'none') + ';height:auto;min-height:' + x.h + 'px"><div class="ds-txt">' + esc(x.texto) + '</div></div>';
    if (x.tipo === 'ret') return '<div ' + a + ' style="' + b + 'background:' + esc(x.cor) + ';border-radius:' + (x.raio || 0) + 'px;' + (x.borda ? 'border:' + x.borda + 'px solid ' + esc(x.corBorda) + ';' : '') + '"></div>';
    if (x.tipo === 'elipse') return '<div ' + a + ' style="' + b + 'background:' + esc(x.cor) + ';border-radius:50%;' + (x.borda ? 'border:' + x.borda + 'px solid ' + esc(x.corBorda) + ';' : '') + '"></div>';
    if (x.tipo === 'linha') return '<div ' + a + ' style="' + b + 'background:' + esc(x.cor) + ';border-radius:' + x.h / 2 + 'px"></div>';
    if (x.tipo === 'triangulo') return '<div ' + a + ' style="' + b + '">' + poligono([[x.w / 2, 0], [x.w, x.h], [0, x.h]], x.cor) + '</div>';
    if (x.tipo === 'estrela') return '<div ' + a + ' style="' + b + '">' + poligono(D.pontosEstrela(x.w, x.h, x.pontas), x.cor) + '</div>';
    if (x.tipo === 'seta') return '<div ' + a + ' style="' + b + '">' + poligono(D.pontosSeta(x.w, x.h), x.cor) + '</div>';
    if (x.tipo === 'imagem') return '<div ' + a + ' style="' + b + 'border-radius:' + (x.raio || 0) + 'px;overflow:hidden"><img ' + (x.arq ? 'data-arq="' + esc(x.arq) + '"' : 'src="' + esc(x.src) + '"') + ' alt="" draggable="false" style="object-fit:' + x.ajuste + '"></div>';
    return '';
  }
  function htmlPagina(d, p, escala, interativo) {
    return '<div class="ds-pg-caixa" style="width:' + d.w * escala + 'px;height:' + d.h * escala + 'px"><div class="ds-pg" data-pg="' + p.id + '" style="width:' + d.w + 'px;height:' + d.h + 'px;background:' + esc(p.fundo) + ';transform:scale(' + escala + ');--inv:' + (1 / escala) + '">' + p.elementos.map(htmlEl).join('') + (interativo ? '<div class="ds-guias"></div>' : '') + '</div></div>';
  }

  // ---------- início ----------
  function telaInicio(el) {
    carregarFontes();
    const x = e(); const lista = x.designs.slice().sort(function (a, b) { return b.editadoEm - a.editadoEm; });
    const thumb = function (d, larg) { const s = larg / Math.max(d.w, d.h); return '<div class="ds-thumb" style="height:' + Math.round(d.h * s) + 'px;width:' + Math.round(d.w * s) + 'px">' + htmlPagina(d, d.paginas[0], s, false) + '</div>'; };
    el.innerHTML = '<div class="ds-home"><section class="ds-hero"><h1>O que vamos criar hoje?</h1><p>Posts, stories, apresentações e propostas com a identidade da Seven.</p></section>' +
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
        if (op === 'duplicar') { const c = JSON.parse(JSON.stringify(d)); c.id = D.novoDesign(D.FORMATOS[0]).id; c.titulo += ' (cópia)'; c.criadoEm = c.editadoEm = Date.now(); x.designs.push(c); }
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
  function paginaAtiva() { return ed.d.paginas.find(function (p) { return p.id === ed.pg; }) || ed.d.paginas[0]; }

  function telaEditor(el, id) {
    carregarFontes();
    const d = achar(id); if (!d) { el.innerHTML = UI.vazio('Design não encontrado', '', '<a class="btn" href="#/design">Voltar</a>'); return; }
    if (!ed || ed.d !== d) { ed = { d: d, sel: [], pg: d.paginas[0].id, zoom: null, aba: 'modelos', hist: D.historico(), clip: null }; ed.hist.registrar(d.paginas); }
    el.innerHTML = '<div class="ds-ed">' +
      '<header class="ds-topo"><a class="btn mini fantasma" href="#/design">← Início</a><input id="ds-tit" value="' + esc(d.titulo) + '" aria-label="Nome do design"><span class="mini mudo">' + d.w + ' × ' + d.h + ' px</span><span class="ds-espaco"></span>' +
      '<button class="icone" data-a="desfazer" title="Desfazer (Ctrl+Z)" aria-label="Desfazer">↶</button><button class="icone" data-a="refazer" title="Refazer (Ctrl+Y)" aria-label="Refazer">↷</button>' +
      '<div class="ds-zoom"><button class="icone" data-a="zoom-" aria-label="Diminuir zoom">−</button><button class="btn mini fantasma" data-a="zoom-ajustar" id="ds-zoom-v">100%</button><button class="icone" data-a="zoom+" aria-label="Aumentar zoom">＋</button></div>' +
      '<button class="btn primario" data-a="baixar">⤓ Baixar</button></header>' +
      '<nav class="ds-abas">' + [['modelos', '▦', 'Modelos'], ['elementos', '◆', 'Elementos'], ['texto', 'T', 'Texto'], ['marca', '★', 'Marca'], ['uploads', '⤒', 'Uploads'], ['fundo', '◐', 'Fundo']].map(function (a) { return '<button data-aba="' + a[0] + '" class="' + (ed.aba === a[0] ? 'on' : '') + '"><span>' + a[1] + '</span>' + a[2] + '</button>'; }).join('') + '</nav>' +
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
  }
  function marcarSelecao() {
    document.querySelectorAll('.ds-el.sel').forEach(function (n) { n.classList.remove('sel'); });
    document.querySelectorAll('.ds-alcas').forEach(function (n) { n.remove(); });
    ed.sel.forEach(function (id) { const n = document.querySelector('.ds-el[data-id="' + id + '"]'); if (n) n.classList.add('sel'); });
    if (ed.sel.length === 1) {
      const x = elPorId(ed.sel[0]); const n = document.querySelector('.ds-el[data-id="' + x.id + '"]'); if (!n || x.travado) return;
      const h = document.createElement('div'); h.className = 'ds-alcas'; h.style.cssText = estiloBase(Object.assign({}, x, { h: n.offsetHeight, opac: 1 })) + '--inv:' + (1 / ed.zoom) + ';';
      h.innerHTML = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].filter(function (k) { return x.tipo !== 'texto' || /e|w/.test(k); }).map(function (k) { return '<i class="ds-alca a-' + k + '" data-alca="' + k + '"></i>'; }).join('') + '<i class="ds-alca a-rot" data-alca="rot" title="Girar">↻</i>';
      n.parentNode.appendChild(h);
    }
  }
  function atualizarEl(x) {
    const n = document.querySelector('.ds-el[data-id="' + x.id + '"]'); if (!n) return;
    const t = document.createElement('div'); t.innerHTML = htmlEl(x); const novo = t.firstChild; if (n.classList.contains('sel')) novo.classList.add('sel'); n.replaceWith(novo); hidratar(novo.parentNode);
  }

  // ---------- painel esquerdo ----------
  function desenharPainel() {
    const box = document.getElementById('ds-painel'); if (!box) return; const a = ed.aba; let h = '';
    if (a === 'modelos') h = '<h3>Modelos</h3><p class="mini mudo">Aplicar um modelo substitui as páginas atuais (dá para desfazer).</p><div class="ds-pmodelos">' + D.MODELOS.map(function (m) { const d = D.modelo(m.id); const s = 130 / Math.max(d.w, d.h); return '<button data-modelo="' + m.id + '"><div class="ds-thumb" style="width:' + Math.round(d.w * s) + 'px;height:' + Math.round(d.h * s) + 'px">' + htmlPagina(d, d.paginas[0], s, false) + '</div><small>' + esc(m.t) + '</small></button>'; }).join('') + '</div>';
    if (a === 'elementos') h = '<h3>Formas</h3><div class="ds-formas">' + [['ret', '<i class="f-ret"></i>', 'Retângulo'], ['ret-r', '<i class="f-ret r"></i>', 'Retângulo arredondado'], ['elipse', '<i class="f-cir"></i>', 'Círculo'], ['triangulo', '▲', 'Triângulo'], ['estrela', '★', 'Estrela'], ['seta', '➜', 'Seta'], ['linha', '<i class="f-lin"></i>', 'Linha']].map(function (f) { return '<button data-add="' + f[0] + '" title="' + f[2] + '" aria-label="' + f[2] + '">' + f[1] + '</button>'; }).join('') + '</div>';
    if (a === 'texto') h = '<h3>Texto</h3><button class="ds-add-t t1" data-add="titulo">Adicionar um título</button><button class="ds-add-t t2" data-add="subtitulo">Adicionar um subtítulo</button><button class="ds-add-t t3" data-add="corpo">Adicionar corpo de texto</button><h4>Combinações</h4><button class="ds-add-t combo" data-add="combo"><b>Título forte</b><small>com subtítulo dourado</small></button>';
    if (a === 'marca') h = '<h3>Marca Seven</h3><h4>Logos</h4><div class="ds-logos"><button data-logo="img/seven-logo.png"><img src="img/seven-logo.png" alt="Logo Seven"></button><button data-logo="img/seven-marca.png"><img src="img/seven-marca.png" alt="Marca Seven"></button></div><h4>Cores</h4><div class="ds-paleta">' + D.PALETA.slice(0, 6).map(function (c) { return '<button data-cor="' + c + '" style="background:' + c + '" title="' + c + '" aria-label="Aplicar cor ' + c + '"></button>'; }).join('') + '</div><p class="mini mudo">Clique numa cor para aplicar ao elemento selecionado (ou ao fundo, se nada estiver selecionado).</p><h4>Fonte</h4><p style="font-family:Montserrat;font-weight:800;font-size:22px;margin:0">Montserrat</p>';
    if (a === 'uploads') h = '<h3>Uploads</h3><button class="btn primario" data-a="upload">⤒ Enviar imagens</button><p class="mini mudo">Ficam guardadas neste navegador.</p><div class="ds-ups">' + e().uploads.map(function (u) { return '<button data-up="' + esc(u.arq) + '" title="' + esc(u.nome) + '"><img data-arq="' + esc(u.arq) + '" alt="' + esc(u.nome) + '"></button>'; }).join('') + '</div>';
    if (a === 'fundo') h = '<h3>Fundo da página</h3><div class="ds-paleta grande">' + D.PALETA.map(function (c) { return '<button data-fundo="' + c + '" style="background:' + c + '" aria-label="Fundo ' + c + '"></button>'; }).join('') + '</div>' + campo('Outra cor', '<input type="color" id="ds-fundo-cor" value="' + esc(/^#[0-9a-f]{6}$/i.test(paginaAtiva().fundo) ? paginaAtiva().fundo : '#ffffff') + '">');
    box.innerHTML = h; hidratar(box);
    document.querySelectorAll('.ds-abas button').forEach(function (b) { b.classList.toggle('on', b.dataset.aba === a); });
  }

  // ---------- propriedades ----------
  function cores(k, atual) { return '<span class="ds-cores">' + D.PALETA.slice(0, 8).map(function (c) { return '<button data-prop="' + k + '" data-v="' + c + '" class="' + (c === atual ? 'on' : '') + '" style="background:' + c + '" aria-label="' + c + '"></button>'; }).join('') + '<input type="color" data-propc="' + k + '" value="' + esc(/^#[0-9a-f]{6}$/i.test(atual) ? atual : '#000000') + '" aria-label="Escolher cor"></span>'; }
  function num(k, v, rot, min, max, passo) { return '<label class="ds-num"><span>' + rot + '</span><input type="number" data-num="' + k + '" value="' + (Math.round(v * 10) / 10) + '"' + (min != null ? ' min="' + min + '"' : '') + (max != null ? ' max="' + max + '"' : '') + ' step="' + (passo || 1) + '"></label>'; }
  function desenharProps() {
    const box = document.getElementById('ds-props'); if (!box) return; const s = selecionados();
    if (!s.length) { const p = paginaAtiva(); box.innerHTML = '<span class="mini mudo">Página ' + (ed.d.paginas.indexOf(p) + 1) + ' · fundo</span>' + cores('fundo', p.fundo) + '<span class="ds-dica mini mudo">Clique num elemento para editar · arraste na página para selecionar vários</span>'; return; }
    if (s.length > 1) { box.innerHTML = '<span class="mini mudo">' + s.length + ' selecionados</span>' + [['esquerda', '⇤'], ['centro-h', '↔'], ['direita', '⇥'], ['topo', '⤒'], ['centro-v', '↕'], ['base', '⤓']].map(function (a) { return '<button class="icone" data-alinhar="' + a[0] + '" title="Alinhar ' + a[0] + '" aria-label="Alinhar ' + a[0] + '">' + a[1] + '</button>'; }).join('') + '<button class="btn mini" data-distribuir="h">Distribuir ↔</button><button class="btn mini" data-distribuir="v">Distribuir ↕</button><span class="ds-espaco"></span><button class="icone" data-a="duplicar" title="Duplicar (Ctrl+D)" aria-label="Duplicar">⧉</button><button class="icone perigo" data-a="excluir" title="Excluir (Del)" aria-label="Excluir">🗑</button>'; return; }
    const x = s[0]; let h = '';
    if (x.tipo === 'texto') h += '<select data-prop-sel="fonte" aria-label="Fonte">' + opcoes(D.FONTES, x.fonte) + '</select>' + num('tam', x.tam, 'Tam', 6, 400) + '<select data-prop-sel="peso" aria-label="Peso">' + opcoes([{ v: '400', t: 'Normal' }, { v: '500', t: 'Médio' }, { v: '600', t: 'Seminegrito' }, { v: '700', t: 'Negrito' }, { v: '800', t: 'Extra' }], String(x.peso)) + '</select>' + cores('cor', x.cor) +
      ['left', 'center', 'right'].map(function (al) { return '<button class="icone' + (x.alinh === al ? ' on' : '') + '" data-prop="alinh" data-v="' + al + '" aria-label="Alinhar ' + al + '">' + { left: '⯇', center: '≡', right: '⯈' }[al] + '</button>'; }).join('') +
      '<button class="icone' + (x.italico ? ' on' : '') + '" data-tog="italico" aria-label="Itálico"><i>I</i></button><button class="icone' + (x.sublinhado ? ' on' : '') + '" data-tog="sublinhado" aria-label="Sublinhado"><u>U</u></button><button class="icone' + (x.maiusc ? ' on' : '') + '" data-tog="maiusc" aria-label="Maiúsculas">aA</button>' + num('espaco', x.espaco || 0, 'Letras', -10, 60) + num('entrelinha', x.entrelinha, 'Linhas', 0.6, 3, 0.1);
    if (['ret', 'elipse', 'triangulo', 'estrela', 'seta', 'linha'].indexOf(x.tipo) >= 0) h += cores('cor', x.cor);
    if (x.tipo === 'ret') h += num('raio', x.raio || 0, 'Raio', 0, 2000);
    if (x.tipo === 'ret' || x.tipo === 'elipse') h += num('borda', x.borda || 0, 'Borda', 0, 100) + (x.borda ? cores('corBorda', x.corBorda) : '');
    if (x.tipo === 'estrela') h += num('pontas', x.pontas, 'Pontas', 3, 12);
    if (x.tipo === 'imagem') h += '<select data-prop-sel="ajuste" aria-label="Ajuste">' + opcoes([{ v: 'cover', t: 'Preencher' }, { v: 'contain', t: 'Ajustar' }], x.ajuste) + '</select>' + num('raio', x.raio || 0, 'Raio', 0, 2000);
    h += '<span class="ds-sep"></span>' + num('opac', Math.round((x.opac == null ? 1 : x.opac) * 100), 'Opac.%', 0, 100) + num('rot', x.rot || 0, 'Giro°', -360, 360) +
      '<details class="ds-mais"><summary class="btn mini fantasma">Posição</summary><div>' + num('x', x.x, 'X') + num('y', x.y, 'Y') + num('w', x.w, 'L', 1) + num('h', x.h, 'A', 1) + '<div class="ds-al">' + [['esquerda', '⇤'], ['centro-h', '↔'], ['direita', '⇥'], ['topo', '⤒'], ['centro-v', '↕'], ['base', '⤓']].map(function (a) { return '<button class="icone" data-alinhar="' + a[0] + '" aria-label="Alinhar na página ' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div><div class="ds-al">' + [['frente', 'Trazer à frente'], ['subir', 'Avançar'], ['descer', 'Recuar'], ['tras', 'Enviar para trás']].map(function (a) { return '<button class="btn mini" data-ordem="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div></div></details>' +
      '<span class="ds-espaco"></span><button class="icone' + (x.travado ? ' on' : '') + '" data-tog="travado" title="Travar" aria-label="Travar">' + (x.travado ? '🔒' : '🔓') + '</button><button class="icone" data-a="duplicar" title="Duplicar (Ctrl+D)" aria-label="Duplicar">⧉</button><button class="icone perigo" data-a="excluir" title="Excluir (Del)" aria-label="Excluir">🗑</button>';
    box.innerHTML = h;
  }

  function adicionar(x) {
    const p = paginaAtiva(); const d = ed.d; const k = Math.min(d.w, d.h) / 1080;
    if (x.tipo !== 'texto' || x.w === 300) { x.w = Math.round(x.w * k * (x.tipo === 'texto' ? 2 : 1)); }
    if (x.tipo !== 'texto') x.h = Math.round(x.h * k);
    x.x = Math.round((d.w - x.w) / 2); x.y = Math.round((d.h - x.h) / 2);
    p.elementos.push(x); ed.sel = [x.id]; salvar(); desenharPaginas(); desenharProps();
  }
  function aplicarCor(c) {
    const s = selecionados();
    if (!s.length) { paginaAtiva().fundo = c; salvar(); desenharPaginas(); desenharProps(); return; }
    s.forEach(function (x) { if (x.tipo !== 'imagem') { x.cor = c; atualizarEl(x); } }); salvar(); marcarSelecao(); desenharProps();
  }

  function ligarEditor(el) {
    const area = el.querySelector('#ds-area');
    el.querySelector('#ds-tit').oninput = function () { ed.d.titulo = this.value; salvar(false); };
    // ---- painel esquerdo e topo ----
    el.onclick = async function (ev) {
      const t = ev.target;
      const aba = t.closest('[data-aba]'); if (aba) { ed.aba = aba.dataset.aba; desenharPainel(); return; }
      const add = t.closest('[data-add]');
      if (add) {
        const k = add.dataset.add; const M = D.MARCA;
        if (k === 'ret') adicionar(D.el('ret', { w: 400, h: 300 })); if (k === 'ret-r') adicionar(D.el('ret', { w: 400, h: 300, raio: 40 }));
        if (k === 'elipse') adicionar(D.el('elipse', { w: 300, h: 300 })); if (k === 'triangulo') adicionar(D.el('triangulo', { w: 300, h: 260 }));
        if (k === 'estrela') adicionar(D.el('estrela', { w: 300, h: 300 })); if (k === 'seta') adicionar(D.el('seta', { w: 400, h: 120 })); if (k === 'linha') adicionar(D.el('linha', { w: 500, h: 8 }));
        const kk = Math.min(ed.d.w, ed.d.h) / 1080;
        if (k === 'titulo') adicionar(D.el('texto', { texto: 'Adicione um título', tam: Math.round(96 * kk), peso: 800, w: Math.round(900 * kk), h: Math.round(120 * kk) }));
        if (k === 'subtitulo') adicionar(D.el('texto', { texto: 'Adicione um subtítulo', tam: Math.round(56 * kk), peso: 600, w: Math.round(800 * kk), h: Math.round(70 * kk) }));
        if (k === 'corpo') adicionar(D.el('texto', { texto: 'Adicione um pouco de texto', tam: Math.round(34 * kk), peso: 400, w: Math.round(700 * kk), h: Math.round(45 * kk) }));
        if (k === 'combo') { const a1 = D.el('texto', { texto: 'TÍTULO FORTE', tam: Math.round(90 * kk), peso: 800, w: Math.round(900 * kk), h: Math.round(110 * kk), alinh: 'center' }); const a2 = D.el('texto', { texto: 'subtítulo dourado', tam: Math.round(44 * kk), peso: 600, cor: M.dourado, w: Math.round(900 * kk), h: Math.round(60 * kk), alinh: 'center', espaco: 4 }); adicionar(a1); a2.x = a1.x; a2.y = a1.y + a1.h + Math.round(10 * kk); paginaAtiva().elementos.push(a2); ed.sel = [a1.id, a2.id]; salvar(); desenharPaginas(); desenharProps(); }
        return;
      }
      const logo = t.closest('[data-logo]'); if (logo) { const k2 = Math.min(ed.d.w, ed.d.h) / 1080; adicionar(D.el('imagem', { src: logo.dataset.logo, ajuste: 'contain', w: Math.round(400 * k2) || 200, h: Math.round(400 * k2) || 200 })); return; }
      const up = t.closest('[data-up]'); if (up) { const im = up.querySelector('img'); const r = im.naturalWidth && im.naturalHeight ? im.naturalHeight / im.naturalWidth : 1; const w = Math.round(Math.min(ed.d.w, ed.d.h) * 0.6); adicionar(D.el('imagem', { arq: up.dataset.up, w: w, h: Math.round(w * r) })); return; }
      const cor = t.closest('[data-cor]'); if (cor) { aplicarCor(cor.dataset.cor); return; }
      const fundo = t.closest('[data-fundo]'); if (fundo) { paginaAtiva().fundo = fundo.dataset.fundo; salvar(); desenharPaginas(); desenharProps(); return; }
      const mod = t.closest('[data-modelo]'); if (mod) { const nd = D.modelo(mod.dataset.modelo); const k3 = Math.min(ed.d.w / nd.w, ed.d.h / nd.h); nd.paginas.forEach(function (p) { p.elementos.forEach(function (x) { ['x', 'y', 'w', 'h'].forEach(function (c) { x[c] = Math.round(x[c] * k3); }); if (x.tam) x.tam = Math.round(x.tam * k3); if (x.espaco) x.espaco = Math.round(x.espaco * k3); }); }); ed.d.paginas = nd.paginas; ed.pg = nd.paginas[0].id; ed.sel = []; salvar(); desenharPaginas(); desenharProps(); return; }
      const pa = t.closest('[data-pa]');
      if (pa) {
        const sec = pa.closest('[data-pgw]'); const i = ed.d.paginas.findIndex(function (p) { return p.id === sec.dataset.pgw; }); const ps = ed.d.paginas;
        if (pa.dataset.pa === 'duplicar') { const c = JSON.parse(JSON.stringify(ps[i])); c.id = D.pagina().id; c.elementos.forEach(function (x) { x.id = D.el('ret').id; }); ps.splice(i + 1, 0, c); ed.pg = c.id; }
        if (pa.dataset.pa === 'excluir' && ps.length > 1 && await confirmar('Excluir página', 'Excluir a página ' + (i + 1) + '?', 'Excluir')) { ps.splice(i, 1); ed.pg = ps[Math.max(0, i - 1)].id; ed.sel = []; }
        if (pa.dataset.pa === 'subir' && i > 0) ps.splice(i - 1, 0, ps.splice(i, 1)[0]);
        if (pa.dataset.pa === 'descer' && i < ps.length - 1) ps.splice(i + 1, 0, ps.splice(i, 1)[0]);
        salvar(); desenharPaginas(); desenharProps(); return;
      }
      const b = t.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'add-pagina') { const p = D.pagina({ fundo: paginaAtiva().fundo }); ed.d.paginas.push(p); ed.pg = p.id; salvar(); desenharPaginas(); document.querySelector('[data-pgw="' + p.id + '"]').scrollIntoView({ behavior: 'smooth' }); }
      if (a === 'zoom+' || a === 'zoom-') { ed.zoom = Math.max(0.05, Math.min(3, ed.zoom * (a === 'zoom+' ? 1.2 : 1 / 1.2))); desenharPaginas(); }
      if (a === 'zoom-ajustar') { ed.zoom = Math.max(0.05, Math.min(1, (area.clientWidth - 80) / ed.d.w, (window.innerHeight - 220) / ed.d.h)); desenharPaginas(); }
      if (a === 'desfazer' || a === 'refazer') historicoPasso(a);
      if (a === 'duplicar') duplicar();
      if (a === 'excluir') excluirSel();
      if (a === 'upload') { const fs = await UI.escolherArquivo('image/*', true); for (const f of fs || []) { if (f.size > 10 * 1024 * 1024) { aviso(f.name + ': acima de 10 MB.', 'erro'); continue; } const id = Dados.id('dsu'); await Dados.guardarArquivo(id, f); e().uploads.unshift({ arq: id, nome: f.name }); } Dados.salvar(); desenharPainel(); }
      if (a === 'baixar') baixar();
    };
    // ---- propriedades ----
    const props = el.querySelector('#ds-props');
    props.addEventListener('click', function (ev) {
      const t = ev.target; const s = selecionados();
      const p = t.closest('[data-prop]'); if (p) { if (p.dataset.prop === 'fundo') { paginaAtiva().fundo = p.dataset.v; salvar(); desenharPaginas(); desenharProps(); return; } s.forEach(function (x) { x[p.dataset.prop] = p.dataset.v; atualizarEl(x); }); salvar(); marcarSelecao(); desenharProps(); return; }
      const tg = t.closest('[data-tog]'); if (tg) { s.forEach(function (x) { x[tg.dataset.tog] = !x[tg.dataset.tog]; atualizarEl(x); }); salvar(); marcarSelecao(); desenharProps(); return; }
      const al = t.closest('[data-alinhar]'); if (al) { D.alinhar(s, al.dataset.alinhar, ed.d.w, ed.d.h); s.forEach(atualizarEl); salvar(); marcarSelecao(); desenharProps(); return; }
      const di = t.closest('[data-distribuir]'); if (di) { D.distribuir(s, di.dataset.distribuir); s.forEach(atualizarEl); salvar(); marcarSelecao(); return; }
      const or = t.closest('[data-ordem]'); if (or) { const pg = paginaDe(s[0].id); D.ordem(pg.elementos, s[0].id, or.dataset.ordem); salvar(); desenharPaginas(); return; }
    });
    props.addEventListener('change', function (ev) {
      const t = ev.target; const s = selecionados();
      if (t.dataset.propSel) { s.forEach(function (x) { x[t.dataset.propSel] = t.dataset.propSel === 'peso' ? Number(t.value) : t.value; atualizarEl(x); }); salvar(); marcarSelecao(); }
      if (t.dataset.propc) { if (t.dataset.propc === 'fundo') { paginaAtiva().fundo = t.value; salvar(); desenharPaginas(); } else { s.forEach(function (x) { x[t.dataset.propc] = t.value; atualizarEl(x); }); salvar(); marcarSelecao(); } }
      if (t.dataset.num) { const v = Number(t.value); if (isNaN(v)) return; s.forEach(function (x) { x[t.dataset.num] = t.dataset.num === 'opac' ? v / 100 : v; atualizarEl(x); }); salvar(); marcarSelecao(); }
    });
    el.querySelector('#ds-painel').addEventListener('change', function (ev) { if (ev.target.id === 'ds-fundo-cor') { paginaAtiva().fundo = ev.target.value; salvar(); desenharPaginas(); desenharProps(); } });

    // ---- interação na página ----
    let arr = null;
    const ponto = function (ev, pgEl) { const r = pgEl.getBoundingClientRect(); return { x: (ev.clientX - r.left) / ed.zoom, y: (ev.clientY - r.top) / ed.zoom }; };
    area.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      const pgEl = ev.target.closest('.ds-pg'); const alca = ev.target.closest('[data-alca]'); const n = ev.target.closest('.ds-el');
      if (ev.target.closest('.ds-txt[contenteditable=true]')) return;
      const editando = document.querySelector('.ds-txt[contenteditable=true]'); if (editando) editando.blur();
      if (!pgEl) { if (!ev.target.closest('.ds-props,.ds-pagina header,button,input,select,summary')) { ed.sel = []; marcarSelecao(); desenharProps(); } return; }
      if (pgEl.dataset.pg !== ed.pg) { ed.pg = pgEl.dataset.pg; document.querySelectorAll('.ds-pagina').forEach(function (s) { s.classList.toggle('ativa', s.dataset.pgw === ed.pg); }); }
      const p0 = ponto(ev, pgEl);
      if (alca) {
        const x = elPorId(ed.sel[0]); const nEl = document.querySelector('.ds-el[data-id="' + x.id + '"]');
        arr = { tipo: alca.dataset.alca === 'rot' ? 'rot' : 'res', alca: alca.dataset.alca, x: x, orig: { x: x.x, y: x.y, w: x.w, h: x.tipo === 'texto' ? nEl.offsetHeight : x.h }, p0: p0, pgEl: pgEl };
      } else if (n) {
        const id = n.dataset.id; const x = elPorId(id);
        if (ev.shiftKey) { ed.sel = ed.sel.indexOf(id) >= 0 ? ed.sel.filter(function (y) { return y !== id; }) : ed.sel.concat(id); }
        else if (ed.sel.indexOf(id) < 0) ed.sel = [id];
        marcarSelecao(); desenharProps();
        if (!x.travado) arr = { tipo: 'mover', p0: p0, orig: selecionados().map(function (y) { return { y: y, x: y.x, yy: y.y }; }), pgEl: pgEl, moveu: false };
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
        const pg = ed.d.paginas.find(function (q) { return q.id === arr.pgEl.dataset.pg; }); let ajx = 0, ajy = 0, linhas = [];
        if (arr.orig.length === 1 && !ev.altKey) { const o = arr.orig[0]; const nEl = document.querySelector('.ds-el[data-id="' + o.y.id + '"]'); const g = D.guias({ x: o.x + dx, y: o.yy + dy, w: o.y.w, h: nEl ? nEl.offsetHeight : o.y.h }, pg.elementos.filter(function (q) { return q !== o.y; }), ed.d.w, ed.d.h, 6 / ed.zoom); ajx = g.x - (o.x + dx); ajy = g.y - (o.yy + dy); linhas = g.linhas; }
        arr.orig.forEach(function (o) { o.y.x = Math.round(o.x + dx + ajx); o.y.y = Math.round(o.yy + dy + ajy); const nEl = document.querySelector('.ds-el[data-id="' + o.y.id + '"]'); if (nEl) { nEl.style.left = o.y.x + 'px'; nEl.style.top = o.y.y + 'px'; } });
        const al = arr.pgEl.querySelector('.ds-alcas'); if (al && arr.orig.length === 1) { al.style.left = arr.orig[0].y.x + 'px'; al.style.top = arr.orig[0].y.y + 'px'; }
        guiasEl.innerHTML = linhas.map(function (l) { return '<i class="ds-guia ' + l.eixo + '" style="' + (l.eixo === 'x' ? 'left:' + l.v + 'px' : 'top:' + l.v + 'px') + '"></i>'; }).join('');
      }
      if (arr.tipo === 'res') {
        const r = D.redimensionar(arr.orig, arr.alca, dx, dy, arr.x.tipo === 'imagem' || ev.shiftKey, 8);
        Object.assign(arr.x, arr.x.tipo === 'texto' ? { x: r.x, w: r.w } : r); atualizarEl(arr.x); marcarSelecao();
      }
      if (arr.tipo === 'rot') { const cx = arr.orig.x + arr.orig.w / 2, cy = arr.orig.y + arr.orig.h / 2; arr.x.rot = D.angulo(cx, cy, p.x, p.y, ev.shiftKey ? 15 : 0); const nEl = document.querySelector('.ds-el[data-id="' + arr.x.id + '"]'); nEl.style.transform = 'rotate(' + arr.x.rot + 'deg)'; const al = arr.pgEl.querySelector('.ds-alcas'); if (al) al.style.transform = 'rotate(' + arr.x.rot + 'deg)'; }
      if (arr.tipo === 'area') { const x1 = Math.min(arr.p0.x, p.x), y1 = Math.min(arr.p0.y, p.y); arr.box.style.cssText = 'left:' + x1 + 'px;top:' + y1 + 'px;width:' + Math.abs(dx) + 'px;height:' + Math.abs(dy) + 'px'; arr.fim = p; }
    });
    const soltar = function () {
      if (!arr) return; const a = arr; arr = null;
      const g = a.pgEl.querySelector('.ds-guias'); if (g) g.innerHTML = '';
      if (a.tipo === 'area') { a.box.remove(); if (a.fim) { const pg = ed.d.paginas.find(function (q) { return q.id === a.pgEl.dataset.pg; }); ed.sel = D.selecaoRetangulo(pg.elementos.filter(function (q) { return !q.travado; }), { x1: a.p0.x, y1: a.p0.y, x2: a.fim.x, y2: a.fim.y }); marcarSelecao(); desenharProps(); } return; }
      if (a.tipo === 'mover' && !a.moveu) return;
      salvar(); marcarSelecao(); desenharProps();
    };
    area.addEventListener('pointerup', soltar); area.addEventListener('pointercancel', soltar);
    // edição de texto com duplo clique
    area.addEventListener('dblclick', function (ev) {
      const alvo = document.elementFromPoint(ev.clientX, ev.clientY) || ev.target;
      const n = alvo.closest('.ds-paginas .ds-texto') || (ed.sel.length === 1 && document.querySelector('.ds-paginas .ds-texto[data-id="' + ed.sel[0] + '"]'));
      if (!n || (ev.isTrusted && !n.contains(alvo) && !alvo.closest('.ds-alcas'))) return; const x = elPorId(n.dataset.id); if (x.travado) return;
      const t = n.querySelector('.ds-txt'); t.contentEditable = 'true'; t.focus(); document.getSelection().selectAllChildren(t);
      document.querySelectorAll('.ds-alcas').forEach(function (h) { h.remove(); });
      t.onpaste = function (e2) { e2.preventDefault(); document.execCommand('insertText', false, (e2.clipboardData || window.clipboardData).getData('text/plain')); };
      t.onblur = function () { t.contentEditable = 'false'; x.texto = t.innerText.replace(/\n$/, ''); x.h = Math.round(n.offsetHeight); salvar(); marcarSelecao(); };
      t.onkeydown = function (e2) { if (e2.key === 'Escape') t.blur(); e2.stopPropagation(); };
    });
    // teclado
    el.tabIndex = -1;
    el.onkeydown = function (ev) {
      if (ev.target.closest('input,select,textarea,[contenteditable=true]')) return;
      const mod = ev.ctrlKey || ev.metaKey; const s = selecionados();
      if (mod && ev.key.toLowerCase() === 'z') { ev.preventDefault(); historicoPasso(ev.shiftKey ? 'refazer' : 'desfazer'); }
      else if (mod && ev.key.toLowerCase() === 'y') { ev.preventDefault(); historicoPasso('refazer'); }
      else if (mod && ev.key.toLowerCase() === 'd') { ev.preventDefault(); duplicar(); }
      else if (mod && ev.key.toLowerCase() === 'c' && s.length) { ed.clip = JSON.parse(JSON.stringify(s)); }
      else if (mod && ev.key.toLowerCase() === 'v' && ed.clip) { ev.preventDefault(); const novos = ed.clip.map(function (x) { return Object.assign(JSON.parse(JSON.stringify(x)), { id: D.el('ret').id, x: x.x + 20, y: x.y + 20 }); }); paginaAtiva().elementos.push.apply(paginaAtiva().elementos, novos); ed.sel = novos.map(function (x) { return x.id; }); salvar(); desenharPaginas(); desenharProps(); }
      else if (mod && ev.key.toLowerCase() === 'a') { ev.preventDefault(); ed.sel = paginaAtiva().elementos.filter(function (x) { return !x.travado; }).map(function (x) { return x.id; }); marcarSelecao(); desenharProps(); }
      else if ((ev.key === 'Delete' || ev.key === 'Backspace') && s.length) { ev.preventDefault(); excluirSel(); }
      else if (ev.key === 'Escape') { ed.sel = []; marcarSelecao(); desenharProps(); }
      else if (/^Arrow/.test(ev.key) && s.length) { ev.preventDefault(); const p = ev.shiftKey ? 10 : 1; s.forEach(function (x) { if (x.travado) return; if (ev.key === 'ArrowLeft') x.x -= p; if (ev.key === 'ArrowRight') x.x += p; if (ev.key === 'ArrowUp') x.y -= p; if (ev.key === 'ArrowDown') x.y += p; atualizarEl(x); }); marcarSelecao(); clearTimeout(ed.tSeta); ed.tSeta = setTimeout(function () { salvar(); desenharProps(); }, 300); }
      else if (ev.key === 'Enter' && s.length === 1 && s[0].tipo === 'texto') { ev.preventDefault(); const n = document.querySelector('.ds-el[data-id="' + s[0].id + '"]'); n.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); }
    };
    el.focus({ preventScroll: true });
  }
  function duplicar() { const s = selecionados(); if (!s.length) return; const novos = s.map(function (x) { const c = JSON.parse(JSON.stringify(x)); c.id = D.el('ret').id; c.x += 20; c.y += 20; paginaDe(x.id).elementos.push(c); return c.id; }); ed.sel = novos; salvar(); desenharPaginas(); desenharProps(); }
  function excluirSel() { const ids = ed.sel; ed.d.paginas.forEach(function (p) { p.elementos = p.elementos.filter(function (x) { return ids.indexOf(x.id) < 0 || x.travado; }); }); ed.sel = []; salvar(); desenharPaginas(); desenharProps(); }
  function historicoPasso(a) { const v = a === 'desfazer' ? ed.hist.desfazer() : ed.hist.refazer(); if (!v) return; ed.d.paginas = v; if (!ed.d.paginas.some(function (p) { return p.id === ed.pg; })) ed.pg = ed.d.paginas[0].id; ed.sel = ed.sel.filter(elPorId); salvar(false); desenharPaginas(); desenharProps(); }

  // ---------- exportação (Canvas 2D) ----------
  function carregarImg(src) { return new Promise(function (ok) { const i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  function caminhoArred(c, x, y, w, h, r) { r = Math.max(0, Math.min(r || 0, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  async function renderizar(d, p, escala) {
    if (document.fonts) { await Promise.all(D.FONTES.map(function (f) { return document.fonts.load('700 20px "' + f + '"').catch(function () { /* fonte de sistema */ }); })); await document.fonts.ready; }
    const cv = document.createElement('canvas'); cv.width = Math.round(d.w * escala); cv.height = Math.round(d.h * escala); const c = cv.getContext('2d'); c.scale(escala, escala);
    c.fillStyle = p.fundo || '#fff'; c.fillRect(0, 0, d.w, d.h);
    for (const x of p.elementos) {
      c.save(); c.globalAlpha = x.opac == null ? 1 : x.opac; c.translate(x.x + x.w / 2, x.y + x.h / 2); c.rotate((x.rot || 0) * Math.PI / 180); c.translate(-x.w / 2, -x.h / 2);
      if (x.tipo === 'ret') { caminhoArred(c, 0, 0, x.w, x.h, x.raio); if (x.cor !== 'transparent') { c.fillStyle = x.cor; c.fill(); } if (x.borda) { c.save(); caminhoArred(c, x.borda / 2, x.borda / 2, x.w - x.borda, x.h - x.borda, Math.max(0, (x.raio || 0) - x.borda / 2)); c.lineWidth = x.borda; c.strokeStyle = x.corBorda; c.stroke(); c.restore(); } }
      if (x.tipo === 'elipse') { c.beginPath(); c.ellipse(x.w / 2, x.h / 2, x.w / 2, x.h / 2, 0, 0, Math.PI * 2); c.fillStyle = x.cor; c.fill(); if (x.borda) { c.beginPath(); c.ellipse(x.w / 2, x.h / 2, Math.max(0, x.w / 2 - x.borda / 2), Math.max(0, x.h / 2 - x.borda / 2), 0, 0, Math.PI * 2); c.lineWidth = x.borda; c.strokeStyle = x.corBorda; c.stroke(); } }
      if (x.tipo === 'linha') { caminhoArred(c, 0, 0, x.w, x.h, x.h / 2); c.fillStyle = x.cor; c.fill(); }
      if (x.tipo === 'triangulo' || x.tipo === 'estrela' || x.tipo === 'seta') { const pts = x.tipo === 'triangulo' ? [[x.w / 2, 0], [x.w, x.h], [0, x.h]] : x.tipo === 'estrela' ? D.pontosEstrela(x.w, x.h, x.pontas) : D.pontosSeta(x.w, x.h); c.beginPath(); pts.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); c.fillStyle = x.cor; c.fill(); }
      if (x.tipo === 'imagem') {
        const im = await carregarImg(await srcImagem(x));
        if (im) { caminhoArred(c, 0, 0, x.w, x.h, x.raio); c.clip(); const ri = im.width / im.height, re = x.w / x.h; let sw = im.width, sh = im.height, sx = 0, sy = 0, dx = 0, dy = 0, dw = x.w, dh = x.h;
          if (x.ajuste === 'cover') { if (ri > re) { sw = im.height * re; sx = (im.width - sw) / 2; } else { sh = im.width / re; sy = (im.height - sh) / 2; } }
          else { if (ri > re) { dh = x.w / ri; dy = (x.h - dh) / 2; } else { dw = x.h * ri; dx = (x.w - dw) / 2; } }
          c.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh); }
      }
      if (x.tipo === 'texto') {
        c.font = (x.italico ? 'italic ' : '') + x.peso + ' ' + x.tam + 'px "' + x.fonte + '", sans-serif'; c.fillStyle = x.cor; c.textBaseline = 'middle';
        if ('letterSpacing' in c) c.letterSpacing = (x.espaco || 0) + 'px';
        const txt = x.maiusc ? x.texto.toUpperCase() : x.texto; const lh = x.tam * x.entrelinha;
        const linhas = D.quebrarTexto(txt, x.w + 0.5, function (s) { return c.measureText(s).width; });
        linhas.forEach(function (l, i) {
          const w = c.measureText(l).width; const px = x.alinh === 'center' ? (x.w - w) / 2 : x.alinh === 'right' ? x.w - w : 0; const py = lh * i + lh / 2;
          c.textAlign = 'left'; c.fillText(l, px, py);
          if (x.sublinhado) c.fillRect(px, py + x.tam * 0.45, w, Math.max(1, x.tam / 16));
        });
      }
      c.restore();
    }
    return cv;
  }
  function carregarJsPDF() { if (self.jspdf) return Promise.resolve(self.jspdf); return new Promise(function (ok, erro) { const s = document.createElement('script'); s.src = JSPDF; s.onload = function () { ok(self.jspdf); }; s.onerror = function () { erro(new Error('Sem acesso à biblioteca de PDF (verifique a internet).')); }; document.head.appendChild(s); }); }
  async function baixar() {
    const d = ed.d;
    const r = await modal({ titulo: 'Baixar', botao: 'Baixar', corpo: campo('Tipo de arquivo', '<select name="tipo">' + opcoes([{ v: 'png', t: 'PNG (melhor qualidade)' }, { v: 'jpg', t: 'JPG (arquivo menor)' }, { v: 'pdf', t: 'PDF (todas as páginas)' }]) + '</select>') + campo('Páginas', '<select name="pags">' + opcoes([{ v: 'todas', t: 'Todas (' + d.paginas.length + ')' }, { v: 'atual', t: 'Só a página selecionada' }]) + '</select>') + campo('Tamanho', '<select name="esc">' + opcoes([{ v: '1', t: '1× (' + d.w + ' × ' + d.h + ')' }, { v: '2', t: '2× (alta resolução)' }]) + '</select>') });
    if (!r) return;
    const tipo = r.get('tipo'), esc2 = Number(r.get('esc')); const pags = r.get('pags') === 'atual' ? [paginaAtiva()] : d.paginas;
    aviso('Gerando ' + tipo.toUpperCase() + '…');
    try {
      if (tipo === 'pdf') {
        const J = await carregarJsPDF(); const doc = new J.jsPDF({ orientation: d.w > d.h ? 'landscape' : 'portrait', unit: 'px', format: [d.w, d.h], hotfixes: ['px_scaling'] });
        for (let i = 0; i < pags.length; i++) { const cv = await renderizar(d, pags[i], esc2); if (i) doc.addPage([d.w, d.h], d.w > d.h ? 'landscape' : 'portrait'); doc.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, d.w, d.h); }
        UI.baixar(D.nomeArquivo(d, 'pdf'), doc.output('blob'));
      } else {
        for (let i = 0; i < pags.length; i++) {
          const cv = await renderizar(d, pags[i], esc2);
          const blob = await new Promise(function (ok) { cv.toBlob(ok, tipo === 'jpg' ? 'image/jpeg' : 'image/png', 0.92); });
          UI.baixar(D.nomeArquivo(d, tipo, pags.length > 1 ? d.paginas.indexOf(pags[i]) : null), blob);
        }
      }
    } catch (err) { aviso(err.message, 'erro'); }
  }

  window.addEventListener('hashchange', function () { if (!/^#\/design\/editar\//.test(location.hash)) ed = null; });

  Telas.design = {
    titulo: 'Design',
    render: function (el, sub, param) { if (sub === 'editar') return telaEditor(el, param); ed = null; telaInicio(el); },
    _renderizar: renderizar
  };
})();
