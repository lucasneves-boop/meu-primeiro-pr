/* Anotações (estilo Samsung Notes): texto rico, escrita à mão, checklists, imagens, áudio, pastas, favoritas, notas bloqueadas e lixeira. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, confirmar, aviso } = UI;
  const A = self.Anotacoes;
  const CORES_TINTA = ['#111111', '#1f5fbf', '#c0392b', '#1f7a4a', '#b68d40', '#8e44ad', '#e67e22', '#7f8c8d'];
  const CORES_MARCA = ['#fff176', '#a5d6a7', '#90caf9', '#f8bbd0', '#ffcc80'];
  const FUNDOS = [{ v: 'liso', t: 'Liso' }, { v: 'linhas', t: 'Pautado' }, { v: 'grade', t: 'Quadriculado' }, { v: 'pontos', t: 'Pontilhado' }];
  const est = { q: '', abertas: {}, senhas: {}, caneta: { ferr: 'caneta', cor: '#111111', esp: 3 }, modo: 'texto', desfeitos: [] };
  const urls = {};

  function e() { const d = Dados.e; d.anotacoes = d.anotacoes || {}; const a = d.anotacoes; a.notas = a.notas || []; a.pastas = a.pastas || []; a.cfg = Object.assign({ vista: 'grade', ordem: 'editada' }, a.cfg || {}); return a; }
  function nota(id) { return e().notas.find(function (n) { return n.id === id; }); }
  function pasta(id) { return e().pastas.find(function (p) { return p.id === id; }); }
  function quando(ts) { const d = new Date(ts), h = new Date(); return d.toDateString() === h.toDateString() ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: d.getFullYear() === h.getFullYear() ? undefined : 'numeric' }); }
  async function hidratar(raiz) {
    for (const el of raiz.querySelectorAll('[data-arq]')) {
      const id = el.dataset.arq; if (!urls[id]) { const b = await Dados.lerArquivo(id); if (b) urls[id] = URL.createObjectURL(b); }
      if (urls[id] && el.getAttribute('src') !== urls[id]) el.src = urls[id];
    }
  }
  function conteudo(n) { return n.cifrado ? est.abertas[n.id] : { html: n.html || '', tracos: n.tracos || [] }; }

  // ---------- lista ----------
  function lateral(sub, param) {
    const a = e(); const ativas = a.notas.filter(function (n) { return !n.apagadaEm; });
    const todasTags = {}; ativas.forEach(function (n) { A.tags(n).forEach(function (t) { todasTags[t] = (todasTags[t] || 0) + 1; }); });
    const item = function (href, ic, t, n, ativo) { return '<a href="' + href + '" class="' + (ativo ? 'ativo' : '') + '"><span>' + ic + '</span>' + esc(t) + (n != null ? '<small>' + n + '</small>' : '') + '</a>'; };
    return '<aside class="an-lado"><button class="btn primario an-nova" data-a="nova">✎ Nova anotação</button>' +
      item('#/anotacoes', '🗒', 'Todas as anotações', ativas.length, !sub) + item('#/anotacoes/fav', '★', 'Favoritas', ativas.filter(function (n) { return n.fav; }).length, sub === 'fav') + item('#/anotacoes/bloqueadas', '🔒', 'Bloqueadas', ativas.filter(function (n) { return n.cifrado; }).length, sub === 'bloqueadas') +
      '<h4>Pastas <button class="icone" data-a="nova-pasta" aria-label="Nova pasta">＋</button></h4>' + a.pastas.map(function (p) { return '<a href="#/anotacoes/pasta/' + p.id + '" class="' + (sub === 'pasta' && param === p.id ? 'ativo' : '') + '" data-pasta="' + p.id + '"><span style="color:' + esc(p.cor || 'inherit') + '">📁</span>' + esc(p.nome) + '<small>' + ativas.filter(function (n) { return n.pasta === p.id; }).length + '</small></a>'; }).join('') +
      (Object.keys(todasTags).length ? '<h4>Tags</h4><div class="an-tags">' + Object.keys(todasTags).sort().map(function (t) { return '<a href="#/anotacoes/tag/' + encodeURIComponent(t) + '" class="' + (sub === 'tag' && param === t ? 'ativo' : '') + '">#' + esc(t) + '</a>'; }).join('') + '</div>' : '') +
      '<hr>' + item('#/anotacoes/lixeira', '🗑', 'Lixeira', a.notas.filter(function (n) { return n.apagadaEm; }).length, sub === 'lixeira') + '</aside>';
  }
  function cartao(n, lixo) {
    const ck = A.checklist(n); const p = n.pasta && pasta(n.pasta); const tr = !n.cifrado && n.tracos && n.tracos.length;
    const imgs = !n.cifrado && /<img/.test(n.html || ''); const aud = !n.cifrado && /<audio/.test(n.html || '');
    return '<article class="an-card' + (n.fixada ? ' fixada' : '') + '" data-id="' + n.id + '" style="' + (n.cor ? '--an-cor:' + esc(n.cor) : '') + '" tabindex="0">' +
      '<div class="an-card-c">' + (n.cifrado ? '<div class="an-trancada">🔒</div>' : (tr && !A.previa(n) ? '<div class="an-mini">' + A.svg(n.tracos) + '</div>' : '<p>' + esc(A.previa(n, 220)) + '</p>' + (tr ? '<div class="an-mini pequena">' + A.svg(n.tracos) + '</div>' : ''))) + '</div>' +
      '<footer><b>' + esc(A.titulo(n)) + '</b><small>' + (lixo ? 'Exclui em ' + A.diasNaLixeira(n) + ' dia(s)' : quando(n.editadaEm)) + (ck.total ? ' · ☑ ' + ck.feitos + '/' + ck.total : '') + (p ? ' · 📁 ' + esc(p.nome) : '') + '</small><span class="an-ics">' + (n.fixada ? '📌' : '') + (n.fav ? '★' : '') + (imgs ? '🖼' : '') + (aud ? '🎙' : '') + '</span></footer>' +
      '<button class="an-mais" data-a="menu" aria-label="Opções">⋯</button></article>';
  }
  function telaLista(el, sub, param) {
    const a = e(); a.notas = A.expurgar(a.notas);
    const f = { q: est.q }; let titulo = 'Todas as anotações';
    if (sub === 'fav') { f.fav = true; titulo = 'Favoritas'; }
    if (sub === 'bloqueadas') { f.bloqueadas = true; titulo = 'Bloqueadas'; }
    if (sub === 'lixeira') { f.lixeira = true; titulo = 'Lixeira'; }
    if (sub === 'pasta') { f.pasta = param; titulo = (pasta(param) || {}).nome || 'Pasta'; }
    if (sub === 'tag') { f.tag = param; titulo = '#' + param; }
    const ls = A.ordenar(A.filtrar(a.notas, f), a.cfg.ordem);
    el.innerHTML = '<div class="an">' + lateral(sub, param) + '<section class="an-main"><header class="an-topo"><h2>' + esc(titulo) + ' <small>' + ls.length + '</small></h2><input type="search" id="an-q" placeholder="Pesquisar anotações" value="' + esc(est.q) + '" aria-label="Pesquisar">' +
      '<select id="an-ordem" aria-label="Ordenar">' + opcoes([{ v: 'editada', t: 'Data de modificação' }, { v: 'criada', t: 'Data de criação' }, { v: 'titulo', t: 'Título' }], a.cfg.ordem) + '</select><button class="icone" data-a="vista" title="Alternar grade/lista" aria-label="Alternar visualização">' + (a.cfg.vista === 'grade' ? '☰' : '▦') + '</button>' +
      (sub === 'lixeira' && ls.length ? '<button class="btn mini perigo" data-a="esvaziar">Esvaziar lixeira</button>' : '') + (sub === 'pasta' ? '<button class="btn mini fantasma" data-a="editar-pasta">Editar pasta</button>' : '') + '</header>' +
      (sub === 'lixeira' ? '<p class="mini mudo">Anotações na lixeira são excluídas após ' + A.LIXEIRA_DIAS + ' dias.</p>' : '') +
      (ls.length ? '<div class="an-' + a.cfg.vista + '">' + ls.map(function (n) { return cartao(n, sub === 'lixeira'); }).join('') + '</div>' : UI.vazio(est.q ? 'Nada encontrado' : sub === 'lixeira' ? 'Lixeira vazia' : 'Nenhuma anotação', est.q ? 'Tente outra palavra.' : 'Escreva, desenhe, faça listas e grave áudios.', sub === 'lixeira' ? '' : '<button class="btn primario" data-a="nova">✎ Nova anotação</button>')) +
      '</section><button class="an-fab" data-a="nova" aria-label="Nova anotação">✎</button></div>';
    const q = el.querySelector('#an-q'); q.oninput = function () { est.q = q.value; const pos = q.selectionStart; App.redesenhar(); const n = document.getElementById('an-q'); n.focus(); n.setSelectionRange(pos, pos); };
    el.querySelector('#an-ordem').onchange = function () { a.cfg.ordem = this.value; Dados.salvar(); App.redesenhar(); };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); const card = ev.target.closest('.an-card');
      if (!b && card) { if (sub === 'lixeira') return menuCartao(nota(card.dataset.id), true); location.hash = '#/anotacoes/nota/' + card.dataset.id; return; }
      if (!b) return; const k = b.dataset.a;
      if (k === 'nova') { const n = novaNota(sub === 'pasta' ? param : null); location.hash = '#/anotacoes/nota/' + n.id; }
      if (k === 'vista') { a.cfg.vista = a.cfg.vista === 'grade' ? 'lista' : 'grade'; Dados.salvar(); App.redesenhar(); }
      if (k === 'nova-pasta' || k === 'editar-pasta') await editarPasta(k === 'editar-pasta' ? pasta(param) : null);
      if (k === 'esvaziar' && await confirmar('Esvaziar lixeira', 'Excluir definitivamente ' + ls.length + ' anotação(ões)?', 'Excluir')) { for (const n of ls) await apagarDeVez(n); App.redesenhar(); }
      if (k === 'menu') await menuCartao(nota(card.dataset.id), sub === 'lixeira');
    };
    el.onkeydown = function (ev) { const card = ev.target.closest('.an-card'); if (card && ev.key === 'Enter') location.hash = '#/anotacoes/nota/' + card.dataset.id; };
  }
  function novaNota(pastaId) { const n = { id: Dados.id('an'), titulo: '', html: '', tracos: [], fundo: 'liso', cor: '', pasta: pastaId || null, criadaEm: Date.now(), editadaEm: Date.now() }; e().notas.push(n); Dados.salvar(); return n; }
  async function apagarDeVez(n) { for (const m of String(n.html || '').matchAll(/data-arq="([^"]+)"/g)) await Dados.apagarArquivo(m[1]); e().notas = e().notas.filter(function (x) { return x !== n; }); Dados.salvar(); }
  async function editarPasta(p) {
    const r = await modal({ titulo: p ? 'Editar pasta' : 'Nova pasta', corpo: campo('Nome', '<input name="nome" required value="' + esc(p ? p.nome : '') + '">') + campo('Cor', '<input type="color" name="cor" value="' + esc(p && p.cor || '#b68d40') + '">') + (p ? '<label class="check"><input type="checkbox" name="apagar"> Apagar pasta (as anotações voltam para “Todas”)</label>' : '') });
    if (!r) return;
    if (p && r.get('apagar')) { e().notas.forEach(function (n) { if (n.pasta === p.id) n.pasta = null; }); e().pastas = e().pastas.filter(function (x) { return x !== p; }); location.hash = '#/anotacoes'; }
    else if (p) Object.assign(p, { nome: r.get('nome').trim(), cor: r.get('cor') });
    else e().pastas.push({ id: Dados.id('anp'), nome: r.get('nome').trim(), cor: r.get('cor') });
    Dados.salvar(); App.redesenhar();
  }
  async function menuCartao(n, lixo) {
    if (!n) return;
    const ops = lixo ? [['restaurar', 'Restaurar'], ['excluir', 'Excluir definitivamente']] : [['fixar', n.fixada ? 'Desafixar' : 'Fixar no topo'], ['fav', n.fav ? 'Tirar das favoritas' : 'Adicionar às favoritas'], ['mover', 'Mover para pasta'], ['duplicar', 'Duplicar'], ['apagar', 'Mover para a lixeira']];
    if (n.cifrado) ops.splice(3, 1);
    const r = await modal({ titulo: A.titulo(n), botao: 'OK', corpo: ops.map(function (o, i) { return '<label class="check an-op"><input type="radio" name="op" value="' + o[0] + '"' + (i === 0 ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('') });
    if (!r) return; const op = r.get('op');
    if (op === 'restaurar') delete n.apagadaEm;
    if (op === 'excluir' && await confirmar('Excluir', 'Excluir definitivamente?', 'Excluir')) await apagarDeVez(n);
    if (op === 'fixar') n.fixada = !n.fixada;
    if (op === 'fav') n.fav = !n.fav;
    if (op === 'apagar') { n.apagadaEm = Date.now(); aviso('Movida para a lixeira.'); }
    if (op === 'duplicar') { const c = JSON.parse(JSON.stringify(n)); c.id = Dados.id('an'); c.titulo = (n.titulo || A.titulo(n)) + ' (cópia)'; c.criadaEm = c.editadaEm = Date.now(); c.fixada = false; e().notas.push(c); }
    if (op === 'mover') await moverPasta(n);
    Dados.salvar(); App.redesenhar();
  }
  async function moverPasta(n) {
    const r = await modal({ titulo: 'Mover para pasta', corpo: campo('Pasta', '<select name="p"><option value="">— Sem pasta —</option>' + opcoes(e().pastas.map(function (p) { return { v: p.id, t: p.nome }; }), n.pasta || '') + '</select>') });
    if (r) { n.pasta = r.get('p') || null; Dados.salvar(); }
  }

  // ---------- editor ----------
  let salvarT = null;
  function telaNota(el, id) {
    const n = nota(id);
    if (!n) { el.innerHTML = UI.vazio('Anotação não encontrada', '', '<a class="btn" href="#/anotacoes">Voltar</a>'); return; }
    if (n.cifrado && !est.abertas[n.id]) return telaDesbloquear(el, n);
    const c = conteudo(n); const senhaNota = est.senhas[n.id];
    if (est.notaAtual !== n.id) { est.notaAtual = n.id; est.modo = 'texto'; est.desfeitos = []; }
    el.innerHTML = '<div class="an-ed' + (n.apagadaEm ? ' lixo' : '') + '" style="' + (n.cor ? '--an-cor:' + esc(n.cor) : '') + '">' +
      '<header class="an-ed-topo"><a class="icone" href="#/anotacoes' + (n.pasta ? '/pasta/' + n.pasta : '') + '" aria-label="Voltar">←</a><input id="an-tit" placeholder="Título" value="' + esc(n.titulo || '') + '" aria-label="Título"><span class="an-salvo mini mudo" id="an-salvo">Salvo</span>' +
      '<button class="icone' + (n.fav ? ' on' : '') + '" data-e="fav" title="Favorita" aria-pressed="' + !!n.fav + '">' + (n.fav ? '★' : '☆') + '</button><button class="icone" data-e="bloquear" title="' + (n.cifrado ? 'Bloqueada' : 'Bloquear') + '">' + (n.cifrado ? '🔒' : '🔓') + '</button><button class="icone" data-e="menu" title="Mais" aria-label="Mais opções">⋯</button></header>' +
      '<div class="an-barra"><div class="an-modos" role="tablist"><button data-e="modo-texto" class="' + (est.modo === 'texto' ? 'on' : '') + '" role="tab" aria-selected="' + (est.modo === 'texto') + '">Aa Texto</button><button data-e="modo-caneta" class="' + (est.modo === 'caneta' ? 'on' : '') + '" role="tab" aria-selected="' + (est.modo === 'caneta') + '">✎ Caneta</button></div>' +
      '<div class="an-ferr an-ferr-texto"' + (est.modo === 'texto' ? '' : ' hidden') + '>' +
      [['bold', '<b>B</b>', 'Negrito'], ['italic', '<i>I</i>', 'Itálico'], ['underline', '<u>U</u>', 'Sublinhado'], ['strikeThrough', '<s>S</s>', 'Tachado'], ['h1', 'H1', 'Título'], ['h2', 'H2', 'Subtítulo'], ['insertUnorderedList', '•', 'Lista'], ['insertOrderedList', '1.', 'Lista numerada'], ['check', '☑', 'Checklist']].map(function (x) { return '<button data-cmd="' + x[0] + '" title="' + x[2] + '" aria-label="' + x[2] + '">' + x[1] + '</button>'; }).join('') +
      '<span class="an-sep"></span>' + CORES_TINTA.slice(0, 5).map(function (c2) { return '<button class="an-cor" data-tinta="' + c2 + '" style="background:' + c2 + '" title="Cor do texto" aria-label="Cor do texto ' + c2 + '"></button>'; }).join('') + '<button data-realce="#fff176" title="Realçar" aria-label="Realçar">🖍</button>' +
      '<span class="an-sep"></span><button data-e="imagem" title="Imagem" aria-label="Inserir imagem">🖼</button><button data-e="audio" title="Gravar áudio" aria-label="Gravar áudio">🎙</button><button data-cmd="undo" title="Desfazer" aria-label="Desfazer">↶</button><button data-cmd="redo" title="Refazer" aria-label="Refazer">↷</button></div>' +
      '<div class="an-ferr an-ferr-caneta"' + (est.modo === 'caneta' ? '' : ' hidden') + '>' +
      [['caneta', '🖊', 'Caneta'], ['lapis', '✏️', 'Lápis'], ['marca', '🖍', 'Marca-texto'], ['borracha', '🧽', 'Borracha']].map(function (x) { return '<button data-ferr="' + x[0] + '" class="' + (est.caneta.ferr === x[0] ? 'on' : '') + '" title="' + x[2] + '" aria-label="' + x[2] + '">' + x[1] + '</button>'; }).join('') +
      '<span class="an-sep"></span>' + (est.caneta.ferr === 'marca' ? CORES_MARCA : CORES_TINTA).map(function (c2) { return '<button class="an-cor' + (est.caneta.cor === c2 ? ' on' : '') + '" data-pcor="' + c2 + '" style="background:' + c2 + '" aria-label="Cor ' + c2 + '"></button>'; }).join('') +
      '<label class="an-esp" title="Espessura"><input type="range" id="an-esp" min="1" max="' + (est.caneta.ferr === 'marca' ? 30 : 16) + '" value="' + est.caneta.esp + '" aria-label="Espessura"></label><button data-e="t-desfazer" title="Desfazer traço" aria-label="Desfazer traço">↶</button><button data-e="t-refazer" title="Refazer traço" aria-label="Refazer traço">↷</button><button data-e="t-limpar" title="Apagar todos os traços" aria-label="Apagar todos os traços">🗑</button></div></div>' +
      '<div class="an-pagina fundo-' + esc(n.fundo || 'liso') + (est.modo === 'caneta' ? ' caneta' : '') + '" id="an-pagina"><div class="an-texto" id="an-texto" contenteditable="' + (n.apagadaEm ? 'false' : 'true') + '" data-ph="Comece a escrever…" spellcheck="true">' + c.html + '</div><canvas class="an-tela" id="an-tela"></canvas></div>' +
      '<footer class="an-ed-rod mini mudo">Criada ' + new Date(n.criadaEm).toLocaleString('pt-BR') + ' · editada ' + new Date(n.editadaEm).toLocaleString('pt-BR') + (n.pasta && pasta(n.pasta) ? ' · 📁 ' + esc(pasta(n.pasta).nome) : '') + '</footer></div>';

    const tx = el.querySelector('#an-texto'), tit = el.querySelector('#an-tit'), pg = el.querySelector('#an-pagina'), cv = el.querySelector('#an-tela');
    hidratar(tx);
    const salvar = function () {
      clearTimeout(salvarT); el.querySelector('#an-salvo').textContent = 'Salvando…';
      salvarT = setTimeout(async function () {
        const cont = { html: tx.innerHTML, tracos: c.tracos };
        n.titulo = tit.value; n.editadaEm = Date.now();
        if (n.cifrado) { if (est.abertas[n.id]) est.abertas[n.id] = cont; n.cifrado = await A.cifrar(cont, senhaNota); n.tags = A.tags({ html: cont.html, titulo: n.titulo }); }
        else { n.html = cont.html; n.tracos = cont.tracos; }
        Dados.salvar(); const s = document.getElementById('an-salvo'); if (s) s.textContent = 'Salvo';
      }, 400);
    };
    tit.oninput = salvar; tx.oninput = salvar;
    tx.addEventListener('paste', function (ev) {
      const fs = Array.from((ev.clipboardData || {}).files || []).filter(function (f) { return /^image\//.test(f.type); });
      ev.preventDefault();
      if (fs.length) { fs.forEach(function (f) { inserirImagem(f); }); return; }
      const t = (ev.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t);
    });
    tx.addEventListener('drop', function (ev) { const fs = Array.from(ev.dataTransfer.files || []).filter(function (f) { return /^image\//.test(f.type); }); if (fs.length) { ev.preventDefault(); fs.forEach(function (f) { inserirImagem(f); }); } });
    tx.addEventListener('click', function (ev) { const li = ev.target.closest('li[data-check]'); if (li && ev.offsetX < 26) { li.dataset.check = li.dataset.check === '1' ? '0' : '1'; salvar(); } });
    async function inserirImagem(f) {
      const id = Dados.id('anf'); await Dados.guardarArquivo(id, f); urls[id] = URL.createObjectURL(f);
      tx.focus(); document.execCommand('insertHTML', false, '<img data-arq="' + id + '" src="' + urls[id] + '" alt="">'); salvar();
    }

    // ---- canvas de escrita ----
    const ctx = cv.getContext('2d'); let atual = null;
    const tamanho = function () { const r = pg.getBoundingClientRect(); const cx = A.caixa(c.tracos); const h = Math.max(tx.scrollHeight + 40, r.height, cx ? cx.y + cx.h + 200 : 0, 900); const dpr = window.devicePixelRatio || 1; cv.style.height = h + 'px'; pg.style.minHeight = h + 'px'; cv.width = Math.round(r.width * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); desenhar(); };
    const tracar = function (t) {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = t.cor; ctx.lineWidth = t.esp; ctx.globalAlpha = t.ferr === 'marca' ? 0.35 : t.ferr === 'lapis' ? 0.8 : 1;
      if (t.ferr === 'marca') ctx.globalCompositeOperation = 'multiply';
      const p = new Path2D(A.caminho(t.pts)); ctx.stroke(p); ctx.restore();
    };
    const desenhar = function () { ctx.clearRect(0, 0, cv.width, cv.height); c.tracos.forEach(tracar); if (atual) tracar(atual); };
    const ponto = function (ev) { const r = cv.getBoundingClientRect(); return [Math.round((ev.clientX - r.left) * 10) / 10, Math.round((ev.clientY - r.top) * 10) / 10]; };
    cv.onpointerdown = function (ev) {
      if (est.modo !== 'caneta' || n.apagadaEm) return; ev.preventDefault(); cv.setPointerCapture(ev.pointerId);
      const p = ponto(ev);
      if (est.caneta.ferr === 'borracha') { const antes = c.tracos.length; c.tracos = A.apagarEm(c.tracos, p[0], p[1], 8); if (c.tracos.length !== antes) { desenhar(); salvar(); } atual = { borracha: true }; return; }
      atual = { ferr: est.caneta.ferr, cor: est.caneta.cor, esp: est.caneta.ferr === 'lapis' ? Math.max(1, est.caneta.esp * 0.7) : est.caneta.esp, pts: [p] };
    };
    cv.onpointermove = function (ev) {
      if (!atual) return; const p = ponto(ev);
      if (atual.borracha) { const antes = c.tracos.length; c.tracos = A.apagarEm(c.tracos, p[0], p[1], 8); if (c.tracos.length !== antes) { desenhar(); salvar(); } return; }
      atual.pts.push(p); desenhar();
      if (p[1] > parseFloat(cv.style.height) - 120) tamanho();
    };
    cv.onpointerup = cv.onpointercancel = function () {
      if (!atual) return; if (!atual.borracha && atual.pts.length) { atual.pts = A.simplificar(atual.pts, 0.6); c.tracos.push(atual); est.desfeitos = []; salvar(); }
      atual = null; desenhar();
    };
    requestAnimationFrame(tamanho);
    const ro = new ResizeObserver(function () { if (document.body.contains(cv)) tamanho(); else ro.disconnect(); }); ro.observe(pg);

    el.querySelector('.an-barra').onmousedown = function (ev) { if (ev.target.closest('[data-cmd],[data-tinta],[data-realce]')) ev.preventDefault(); };
    el.onclick = async function (ev) {
      const cmd = ev.target.closest('[data-cmd]'), tinta = ev.target.closest('[data-tinta]'), realce = ev.target.closest('[data-realce]'), fer = ev.target.closest('[data-ferr]'), pc = ev.target.closest('[data-pcor]'), b = ev.target.closest('[data-e]');
      if (cmd) {
        const k = cmd.dataset.cmd; tx.focus();
        if (k === 'h1' || k === 'h2') document.execCommand('formatBlock', false, k);
        else if (k === 'check') document.execCommand('insertHTML', false, '<ul class="an-check"><li data-check="0">' + (window.getSelection().toString() ? esc(window.getSelection().toString()) : '<br>') + '</li></ul>');
        else document.execCommand(k, false, null);
        salvar(); return;
      }
      if (tinta) { tx.focus(); document.execCommand('foreColor', false, tinta.dataset.tinta); salvar(); return; }
      if (realce) { tx.focus(); document.execCommand('hiliteColor', false, realce.dataset.realce); salvar(); return; }
      if (fer) { est.caneta.ferr = fer.dataset.ferr; if (fer.dataset.ferr === 'marca') { est.caneta.cor = CORES_MARCA[0]; est.caneta.esp = 18; } else if (CORES_MARCA.indexOf(est.caneta.cor) >= 0) { est.caneta.cor = CORES_TINTA[0]; est.caneta.esp = 3; } redesenharBarra(); return; }
      if (pc) { est.caneta.cor = pc.dataset.pcor; redesenharBarra(); return; }
      if (!b) return; const k = b.dataset.e;
      if (k === 'modo-texto' || k === 'modo-caneta') { est.modo = k === 'modo-texto' ? 'texto' : 'caneta'; redesenharBarra(); if (est.modo === 'texto') tx.focus(); return; }
      if (k === 't-desfazer' && c.tracos.length) { est.desfeitos.push(c.tracos.pop()); desenhar(); salvar(); }
      if (k === 't-refazer' && est.desfeitos.length) { c.tracos.push(est.desfeitos.pop()); desenhar(); salvar(); }
      if (k === 't-limpar' && c.tracos.length && await confirmar('Apagar traços', 'Apagar todos os traços desta anotação?', 'Apagar')) { c.tracos = []; desenhar(); salvar(); }
      if (k === 'fav') { n.fav = !n.fav; Dados.salvar(); b.textContent = n.fav ? '★' : '☆'; b.classList.toggle('on', n.fav); }
      if (k === 'imagem') { const f = await UI.escolherArquivo('image/*'); if (f) inserirImagem(f); }
      if (k === 'audio') gravarAudio(tx, salvar, b);
      if (k === 'bloquear') { if (n.cifrado) await gerenciarBloqueio(n); else await bloquear(n, { html: tx.innerHTML, tracos: c.tracos }); }
      if (k === 'menu') await menuEditor(n, { html: tx.innerHTML, tracos: c.tracos }, tit.value);
    };
    el.oninput = function (ev) { if (ev.target.id === 'an-esp') est.caneta.esp = Number(ev.target.value); };
    function redesenharBarra() {
      const barra = el.querySelector('.an-barra'); const tmp = document.createElement('div');
      pg.classList.toggle('caneta', est.modo === 'caneta');
      el.querySelector('.an-ferr-texto').hidden = est.modo !== 'texto'; el.querySelector('.an-ferr-caneta').hidden = est.modo !== 'caneta';
      barra.querySelectorAll('[data-e^=modo]').forEach(function (x) { const on = x.dataset.e === 'modo-' + est.modo; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); });
      const fc = el.querySelector('.an-ferr-caneta');
      tmp.innerHTML = [['caneta', '🖊', 'Caneta'], ['lapis', '✏️', 'Lápis'], ['marca', '🖍', 'Marca-texto'], ['borracha', '🧽', 'Borracha']].map(function (x) { return '<button data-ferr="' + x[0] + '" class="' + (est.caneta.ferr === x[0] ? 'on' : '') + '" title="' + x[2] + '" aria-label="' + x[2] + '">' + x[1] + '</button>'; }).join('') + '<span class="an-sep"></span>' + (est.caneta.ferr === 'marca' ? CORES_MARCA : CORES_TINTA).map(function (c2) { return '<button class="an-cor' + (est.caneta.cor === c2 ? ' on' : '') + '" data-pcor="' + c2 + '" style="background:' + c2 + '" aria-label="Cor ' + c2 + '"></button>'; }).join('') + '<label class="an-esp" title="Espessura"><input type="range" id="an-esp" min="1" max="' + (est.caneta.ferr === 'marca' ? 30 : 16) + '" value="' + est.caneta.esp + '" aria-label="Espessura"></label><button data-e="t-desfazer" title="Desfazer traço" aria-label="Desfazer traço">↶</button><button data-e="t-refazer" title="Refazer traço" aria-label="Refazer traço">↷</button><button data-e="t-limpar" title="Apagar todos os traços" aria-label="Apagar todos os traços">🗑</button>';
      fc.innerHTML = tmp.innerHTML;
    }
    if (!n.html && !c.tracos.length && !n.titulo) setTimeout(function () { (est.modo === 'texto' ? tx : tit).focus(); }, 0);
  }

  let gravador = null;
  async function gravarAudio(tx, salvar, botao) {
    if (gravador) { gravador.stop(); return; }
    if (!navigator.mediaDevices || !self.MediaRecorder) { aviso('Gravação de áudio indisponível neste navegador.', 'erro'); return; }
    let s; try { s = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (err) { aviso('Sem permissão para o microfone.', 'erro'); return; }
    const partes = []; gravador = new MediaRecorder(s); const ini = Date.now();
    botao.classList.add('gravando'); botao.textContent = '⏹';
    const rel = setInterval(function () { botao.title = 'Parar gravação (' + Math.round((Date.now() - ini) / 1000) + ' s)'; }, 500);
    gravador.ondataavailable = function (ev) { if (ev.data.size) partes.push(ev.data); };
    gravador.onstop = async function () {
      clearInterval(rel); s.getTracks().forEach(function (t) { t.stop(); }); gravador = null; botao.classList.remove('gravando'); botao.textContent = '🎙';
      const blob = new Blob(partes, { type: partes[0] ? partes[0].type : 'audio/webm' }); const id = Dados.id('ana'); await Dados.guardarArquivo(id, blob); urls[id] = URL.createObjectURL(blob);
      tx.focus(); document.execCommand('insertHTML', false, '<p class="an-audio" contenteditable="false"><audio controls data-arq="' + id + '" src="' + urls[id] + '"></audio><small>Gravado em ' + new Date().toLocaleString('pt-BR') + '</small></p><p><br></p>'); salvar();
    };
    gravador.start();
  }

  async function menuEditor(n, cont, titulo) {
    const r = await modal({ titulo: 'Opções da anotação', botao: 'Aplicar', largo: true,
      corpo: '<div class="linha">' + campo('Fundo da página', '<select name="fundo">' + opcoes(FUNDOS, n.fundo || 'liso') + '</select>') + campo('Pasta', '<select name="pasta"><option value="">— Sem pasta —</option>' + opcoes(e().pastas.map(function (p) { return { v: p.id, t: p.nome }; }), n.pasta || '') + '</select>') + '</div>' +
        '<fieldset><legend>Cor da anotação</legend><div class="an-cores">' + A.CORES.map(function (c) { return '<label><input type="radio" name="cor" value="' + c + '"' + ((n.cor || '') === c ? ' checked' : '') + '><i style="background:' + (c || 'var(--superficie)') + '"></i></label>'; }).join('') + '</div></fieldset>' +
        '<fieldset><legend>Ação</legend>' + [['', 'Só aplicar as opções acima'], ['txt', 'Exportar como texto (.txt)'], ['html', 'Exportar como página (.html)'], ['pdf', 'Imprimir / salvar em PDF'], ['agenda', 'Criar tarefa na Agenda com o título'], ['fixar', n.fixada ? 'Desafixar do topo' : 'Fixar no topo'], ['lixeira', 'Mover para a lixeira']].map(function (o, i) { return '<label class="check an-op"><input type="radio" name="acao" value="' + o[0] + '"' + (i === 0 ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('') + '</fieldset>' });
    if (!r) return;
    Object.assign(n, { fundo: r.get('fundo'), pasta: r.get('pasta') || null, cor: r.get('cor') || '' });
    const a = r.get('acao'); const nn = Object.assign({}, n, { html: cont.html, titulo: titulo });
    if (a === 'txt') UI.baixar(A.nomeArquivo(nn, 'txt'), A.paraTexto(nn), 'text/plain;charset=utf-8');
    if (a === 'html') UI.baixar(A.nomeArquivo(nn, 'html'), '<!doctype html><meta charset="utf-8"><title>' + esc(A.titulo(nn)) + '</title><body style="font-family:sans-serif;max-width:760px;margin:40px auto;line-height:1.6"><h1>' + esc(A.titulo(nn)) + '</h1>' + cont.html.replace(/<img[^>]*>|<audio[^>]*><\/audio>/g, '') + (cont.tracos.length ? A.svg(cont.tracos, 700) : '') + '</body>', 'text/html;charset=utf-8');
    if (a === 'pdf') { Dados.salvar(); App.redesenhar(); setTimeout(function () { window.print(); }, 200); return; }
    if (a === 'agenda' && Telas.agenda) { Telas.agenda.criar(A.titulo(nn) + ' #anotacao'); aviso('Tarefa criada na Agenda.'); }
    if (a === 'fixar') n.fixada = !n.fixada;
    if (a === 'lixeira') { n.apagadaEm = Date.now(); Dados.salvar(); aviso('Movida para a lixeira.'); location.hash = '#/anotacoes'; return; }
    Dados.salvar(); App.redesenhar();
  }

  // ---------- bloqueio ----------
  async function bloquear(n, cont) {
    const r = await modal({ titulo: 'Bloquear anotação', botao: 'Bloquear',
      corpo: '<p>O conteúdo é cifrado (AES-256) com a senha. <b>Sem a senha não há como recuperar.</b> Imagens e áudios anexados ficam guardados à parte, sem cifra.</p>' + campo('Senha', '<input type="password" name="s1" minlength="4" required autocomplete="new-password">') + campo('Repita a senha', '<input type="password" name="s2" required autocomplete="new-password">'),
      validar: function (fd) { return fd.get('s1').length < 4 ? 'Use pelo menos 4 caracteres.' : fd.get('s1') !== fd.get('s2') ? 'As senhas não conferem.' : ''; } });
    if (!r) return;
    clearTimeout(salvarT);
    n.cifrado = await A.cifrar(cont, r.get('s1')); n.tags = A.tags({ html: cont.html, titulo: n.titulo }); n.html = ''; n.tracos = []; n.editadaEm = Date.now();
    est.senhas[n.id] = r.get('s1'); est.abertas[n.id] = cont; Dados.salvar(); aviso('Anotação bloqueada.'); App.redesenhar();
  }
  async function gerenciarBloqueio(n) {
    const r = await modal({ titulo: 'Anotação bloqueada', botao: 'OK', corpo: '<label class="check an-op"><input type="radio" name="op" value="fechar" checked> Trancar agora (pede a senha de novo)</label><label class="check an-op"><input type="radio" name="op" value="remover"> Remover o bloqueio</label>' });
    if (!r) return;
    if (r.get('op') === 'fechar') { delete est.abertas[n.id]; delete est.senhas[n.id]; location.hash = '#/anotacoes'; return; }
    clearTimeout(salvarT); const cont = est.abertas[n.id]; Object.assign(n, { html: cont.html, tracos: cont.tracos, editadaEm: Date.now() }); delete n.cifrado; delete n.tags; delete est.abertas[n.id]; delete est.senhas[n.id]; Dados.salvar(); aviso('Bloqueio removido.'); App.redesenhar();
  }
  function telaDesbloquear(el, n) {
    el.innerHTML = '<div class="an-bloq"><div class="an-bloq-c"><span>🔒</span><h2>' + esc(A.titulo(n)) + '</h2><p class="mudo">Esta anotação está bloqueada.</p><form id="an-desb"><input type="password" name="s" placeholder="Senha" autocomplete="current-password" aria-label="Senha" required><button class="btn primario">Desbloquear</button></form><p class="mini perigo" id="an-erro" hidden></p><a href="#/anotacoes" class="mini">Voltar</a></div></div>';
    const f = el.querySelector('#an-desb'); f.s.focus();
    f.onsubmit = async function (ev) { ev.preventDefault(); const s = f.s.value; try { est.abertas[n.id] = await A.decifrar(n.cifrado, s); est.senhas[n.id] = s; App.redesenhar(); } catch (err) { const m = el.querySelector('#an-erro'); m.hidden = false; m.textContent = err.message; f.s.select(); } };
  }
  window.addEventListener('hashchange', function () { if (!/^#\/anotacoes\/nota\//.test(location.hash)) { est.notaAtual = null; Object.keys(est.abertas).forEach(function (k) { delete est.abertas[k]; delete est.senhas[k]; }); } });

  Telas.anotacoes = {
    titulo: 'Anotações',
    render: function (el, sub, param) { e(); if (sub === 'nota') return telaNota(el, param); telaLista(el, sub, param); }
  };
})();
