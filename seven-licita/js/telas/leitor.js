/* Seven Leitor (leitor no estilo Kindle): biblioteca, leitura paginada de EPUB, PDF, Word e texto, destaques, notas e marcadores. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, confirmar, aviso, dataHora } = UI;
  const LIB = {
    jszip: ['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip'],
    epub: ['https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js', 'ePub'],
    pdf: ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdfjsLib'],
    mammoth: ['https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', 'mammoth']
  };
  const TEMAS = { branco: { f: '#ffffff', t: '#1a1a1a', n: 'Branco' }, sepia: { f: '#f4ecd8', t: '#5b4636', n: 'Sépia' }, verde: { f: '#d9ead3', t: '#1e3320', n: 'Verde' }, preto: { f: '#000000', t: '#cfcfcf', n: 'Preto' } };
  const FONTES = { Literata: '"Literata", Georgia, serif', Georgia: 'Georgia, "Times New Roman", serif', Montserrat: '"Montserrat", Arial, sans-serif', Atkinson: '"Atkinson Hyperlegible", Verdana, sans-serif' };
  const CORES = { amarelo: '#f5d75a', azul: '#8ec5ff', rosa: '#f6a5c8', laranja: '#ffb36b' };
  const MARGENS = { p: 0.04, m: 0.08, g: 0.14 };
  const est = { busca: '', filtro: '', ordem: 'recentes', modo: 'grade' };
  const libs = {};

  function e() { const d = Dados.e; d.leitor = d.leitor || { livros: [], colecoes: [], pref: { fonte: 'Literata', tamanho: 19, espaco: 1.6, margem: 'm', alinhar: 'justify', tema: 'branco', colunas: 'auto', brilho: 1 } }; return d.leitor; }
  function livro(id) { return e().livros.find(function (l) { return l.id === id; }); }
  function salvar() { Dados.salvar(); }
  function carregar(nome) { const x = LIB[nome]; if (self[x[1]]) return Promise.resolve(self[x[1]]); return libs[nome] = libs[nome] || new Promise(function (ok, erro) { const s = document.createElement('script'); s.src = x[0]; s.onload = function () { ok(self[x[1]]); }; s.onerror = function () { libs[nome] = null; erro(new Error('Sem acesso à biblioteca de leitura (' + nome + '). Verifique a internet.')); }; document.head.appendChild(s); }); }
  function fontesLeitura() { if (!document.getElementById('fontes-leitor')) { const l = document.createElement('link'); l.id = 'fontes-leitor'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Literata:ital,wght@0,400;0,700;1,400&family=Atkinson+Hyperlegible:wght@400;700&display=swap'; document.head.appendChild(l); } }
  function formato(nome, tipo) { const x = String(nome).toLowerCase(); if (/\.epub$/.test(x) || /epub/.test(tipo)) return 'epub'; if (/\.pdf$/.test(x) || /pdf/.test(tipo)) return 'pdf'; if (/\.docx$/.test(x)) return 'docx'; if (/\.(md|markdown)$/.test(x)) return 'md'; if (/\.html?$/.test(x)) return 'html'; return 'txt'; }
  // normaliza caractere a caractere, mantendo o comprimento para os índices de busca baterem com o texto original
  function igualar(t) { return String(t).split('').map(function (c) { return (c.normalize('NFD')[0] || c).toLowerCase()[0] || c; }).join(''); }
  function corCapa(t) { let h = 0; String(t).split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) % 360; }); return 'linear-gradient(160deg,hsl(' + h + ' 45% 32%),hsl(' + ((h + 40) % 360) + ' 40% 14%))'; }

  // ---------- adicionar ----------
  async function adicionar(arquivos) {
    let k = 0;
    for (const arq of arquivos) {
      const fmt = formato(arq.name, arq.type);
      const id = Dados.id('lv'); await Dados.guardarArquivo(id, arq);
      const l = { id: id, arquivo: id, nome: arq.name, titulo: arq.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' '), autor: '', formato: fmt, tipo: fmt === 'epub' ? 'livro' : 'documento', tamanho: arq.size, adicionadoEm: new Date().toISOString(), progresso: 0, destaques: [], marcadores: [], colecoes: [] };
      e().livros.unshift(l); k++;
      try { await extrairCapa(l, arq); } catch (err) { /* capa gerada */ }
    }
    salvar(); if (k) aviso(k + ' item(ns) adicionados à biblioteca.'); App.redesenhar();
  }

  async function extrairCapa(l, arq) {
    if (l.formato === 'epub') {
      await carregar('jszip'); const ePub = await carregar('epub');
      const book = ePub(await arq.arrayBuffer()); const meta = await book.loaded.metadata;
      if (meta.title) l.titulo = meta.title; if (meta.creator) l.autor = meta.creator;
      const u = await book.coverUrl(); if (u) { const b = await (await fetch(u)).blob(); l.capa = Dados.id('lvc'); await Dados.guardarArquivo(l.capa, b); }
      book.destroy();
    }
    if (l.formato === 'pdf') {
      const pdfjs = await carregar('pdf'); pdfjs.GlobalWorkerOptions.workerSrc = LIB.pdf[0].replace('pdf.min.js', 'pdf.worker.min.js');
      const doc = await pdfjs.getDocument({ data: await arq.arrayBuffer() }).promise; const meta = await doc.getMetadata().catch(function () { return {}; });
      if (meta.info && meta.info.Title && meta.info.Title.trim().length > 2) l.titulo = meta.info.Title.trim(); if (meta.info && meta.info.Author) l.autor = meta.info.Author;
      l.paginas = doc.numPages; const pg = await doc.getPage(1); const vp = pg.getViewport({ scale: 360 / pg.getViewport({ scale: 1 }).width });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      const b = await new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', 0.8); }); l.capa = Dados.id('lvc'); await Dados.guardarArquivo(l.capa, b); doc.destroy();
    }
  }

  // ---------- biblioteca ----------
  const urlsCapa = {};
  async function urlCapa(l) { if (!l.capa) return ''; if (!urlsCapa[l.capa]) { const b = await Dados.lerArquivo(l.capa); if (b) urlsCapa[l.capa] = URL.createObjectURL(b); } return urlsCapa[l.capa] || ''; }

  function biblioteca(el) {
    const L = e();
    let lista = L.livros.filter(function (l) {
      if (est.filtro === 'livros' && l.tipo !== 'livro') return false; if (est.filtro === 'documentos' && l.tipo !== 'documento') return false;
      if (est.filtro === 'lendo' && !(l.progresso > 0 && !l.terminado)) return false; if (est.filtro === 'lidos' && !l.terminado) return false;
      if (est.filtro.indexOf('col:') === 0 && l.colecoes.indexOf(est.filtro.slice(4)) < 0) return false;
      if (est.busca && Nucleo.normalizar(l.titulo + ' ' + l.autor).indexOf(Nucleo.normalizar(est.busca)) < 0) return false; return true;
    });
    lista.sort(function (a, b) { if (est.ordem === 'titulo') return a.titulo.localeCompare(b.titulo, 'pt-BR'); if (est.ordem === 'autor') return (a.autor || '~').localeCompare(b.autor || '~', 'pt-BR'); if (est.ordem === 'progresso') return (b.progresso || 0) - (a.progresso || 0); return new Date(b.abertoEm || b.adicionadoEm) - new Date(a.abertoEm || a.adicionadoEm); });
    const ultimo = L.livros.filter(function (l) { return l.abertoEm; }).sort(function (a, b) { return new Date(b.abertoEm) - new Date(a.abertoEm); })[0];
    el.innerHTML = '<div class="kd-bib"><header class="kd-cab"><h1>Seven Leitor</h1><p class="mudo">Leia editais, leis, atas e livros com conforto. Destaque prazos e exigências por cor, anote, busque no texto, ouça em voz alta e exporte suas notas.</p></header>' +
      (ultimo ? '<section class="kd-continuar" data-abrir="' + ultimo.id + '"><div class="kd-capa mini" style="background:' + corCapa(ultimo.titulo) + '"><img data-capa="' + ultimo.id + '" alt=""><span>' + esc(ultimo.titulo) + '</span></div><div><small>Continuar lendo</small><b>' + esc(ultimo.titulo) + '</b><span class="mudo">' + esc(ultimo.autor || '') + '</span><div class="barra"><i style="width:' + Math.round((ultimo.progresso || 0) * 100) + '%"></i></div><small>' + Math.round((ultimo.progresso || 0) * 100) + '% lido</small></div></section>' : '') +
      '<div class="kd-barra"><div class="pilulas">' + [['', 'Todos'], ['livros', 'Livros'], ['documentos', 'Documentos'], ['lendo', 'Lendo'], ['lidos', 'Lidos']].concat(L.colecoes.map(function (c) { return ['col:' + c, '▤ ' + c]; })).map(function (x) { return '<button class="pilula ' + (est.filtro === x[0] ? 'ativa' : '') + '" data-filtro="' + esc(x[0]) + '">' + esc(x[1]) + '</button>'; }).join('') + '<button class="pilula" data-a="colecao">＋ Coleção</button></div>' +
      '<div class="grupo-botoes"><input type="search" id="kd-busca" placeholder="Buscar na biblioteca" value="' + esc(est.busca) + '"><select id="kd-ordem">' + opcoes([{ v: 'recentes', t: 'Recentes' }, { v: 'titulo', t: 'Título' }, { v: 'autor', t: 'Autor' }, { v: 'progresso', t: 'Progresso' }], est.ordem) + '</select><button class="btn" data-a="modo">' + (est.modo === 'grade' ? '☰' : '▦') + '</button><button class="btn primario" data-a="adicionar">+ Adicionar</button></div></div>' +
      (lista.length ? (est.modo === 'grade' ? '<div class="kd-grade">' + lista.map(function (l) {
        return '<article class="kd-item" data-abrir="' + l.id + '" tabindex="0"><div class="kd-capa" style="background:' + corCapa(l.titulo) + '"><img data-capa="' + l.id + '" alt=""><span>' + esc(l.titulo) + '</span>' + (!l.abertoEm ? '<em class="kd-novo">NOVO</em>' : '') + '<i class="kd-fmt">' + esc(l.formato.toUpperCase()) + '</i></div><b>' + esc(l.titulo) + '</b><small>' + esc(l.autor || ' ') + '</small><div class="kd-prog"><div class="barra"><i style="width:' + Math.round((l.progresso || 0) * 100) + '%"></i></div><span>' + (l.terminado ? 'Lido' : Math.round((l.progresso || 0) * 100) + '%') + '</span><button class="icone" data-menu="' + l.id + '" aria-label="Opções">⋯</button></div></article>';
      }).join('') + '</div>' : '<table class="tabela"><thead><tr><th>Título</th><th>Autor</th><th>Formato</th><th class="n">Progresso</th><th>Último acesso</th><th></th></tr></thead><tbody>' + lista.map(function (l) { return '<tr class="clicavel" data-abrir="' + l.id + '"><td><b>' + esc(l.titulo) + '</b></td><td>' + esc(l.autor || '') + '</td><td>' + esc(l.formato.toUpperCase()) + '</td><td class="n">' + Math.round((l.progresso || 0) * 100) + '%</td><td>' + (l.abertoEm ? dataHora(l.abertoEm) : '—') + '</td><td><button class="icone" data-menu="' + l.id + '" aria-label="Opções">⋯</button></td></tr>'; }).join('') + '</tbody></table>')
        : UI.vazio(L.livros.length ? 'Nada encontrado' : 'Sua biblioteca está vazia', L.livros.length ? 'Tente outro filtro.' : 'Adicione livros e documentos: EPUB, PDF, Word (.docx), TXT, Markdown ou HTML. Também dá para arrastar os arquivos para cá ou abrir arquivos do Seven Arquivos.', !L.livros.length ? '<button class="btn primario" data-a="adicionar">+ Adicionar</button>' : '')) +
      '<input type="file" id="kd-up" multiple hidden accept=".epub,.pdf,.docx,.txt,.md,.markdown,.html,.htm"></div>';
    el.querySelectorAll('img[data-capa]').forEach(async function (img) { const u = await urlCapa(livro(img.dataset.capa)); if (u) { img.src = u; img.parentNode.classList.add('com-img'); } else img.remove(); });
    el.querySelector('#kd-up').onchange = function () { adicionar(Array.prototype.slice.call(this.files)); };
    const b = el.querySelector('#kd-busca'); b.oninput = function () { est.busca = b.value; clearTimeout(b._t); b._t = setTimeout(function () { App.redesenhar(); const i = document.getElementById('kd-busca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    el.querySelector('#kd-ordem').onchange = function () { est.ordem = this.value; App.redesenhar(); };
    el.onclick = async function (ev) {
      const fl = ev.target.closest('[data-filtro]'); if (fl) { est.filtro = fl.dataset.filtro; App.redesenhar(); return; }
      const mn = ev.target.closest('[data-menu]'); if (mn) { ev.stopPropagation(); await menuLivro(livro(mn.dataset.menu)); return; }
      const a = ev.target.closest('[data-a]');
      if (a) { if (a.dataset.a === 'adicionar') el.querySelector('#kd-up').click(); if (a.dataset.a === 'modo') { est.modo = est.modo === 'grade' ? 'lista' : 'grade'; App.redesenhar(); } if (a.dataset.a === 'colecao') { const r = await modal({ titulo: 'Nova coleção', corpo: campo('Nome', '<input name="n" required placeholder="ex.: Lei 14.133, Editais, Gestão">') }); if (r && e().colecoes.indexOf(r.get('n')) < 0) { e().colecoes.push(r.get('n').trim()); salvar(); App.redesenhar(); } } return; }
      const ab = ev.target.closest('[data-abrir]'); if (ab) location.hash = '#/leitor/ler/' + ab.dataset.abrir;
    };
    el.onkeydown = function (ev) { const ab = ev.target.closest && ev.target.closest('[data-abrir]'); if (ab && ev.key === 'Enter') location.hash = '#/leitor/ler/' + ab.dataset.abrir; };
    const zona = el.querySelector('.kd-bib');
    zona.addEventListener('dragover', function (ev) { if (Array.prototype.indexOf.call(ev.dataTransfer.types, 'Files') >= 0) { ev.preventDefault(); zona.classList.add('soltando'); } });
    zona.addEventListener('dragleave', function (ev) { if (ev.target === zona) zona.classList.remove('soltando'); });
    zona.addEventListener('drop', function (ev) { if (!ev.dataTransfer.files.length) return; ev.preventDefault(); zona.classList.remove('soltando'); adicionar(Array.prototype.slice.call(ev.dataTransfer.files)); });
  }

  async function menuLivro(l) {
    const r = await modal({ titulo: l.titulo, corpo: '<div class="linha">' + campo('Título', '<input name="t" value="' + esc(l.titulo) + '">') + campo('Autor', '<input name="a" value="' + esc(l.autor || '') + '">') + campo('Tipo', '<select name="tipo">' + opcoes([{ v: 'livro', t: 'Livro' }, { v: 'documento', t: 'Documento' }], l.tipo) + '</select>') + '</div>' +
      (e().colecoes.length ? '<fieldset><legend>Coleções</legend><div class="grade-checks">' + e().colecoes.map(function (c) { return '<label><input type="checkbox" name="col" value="' + esc(c) + '"' + (l.colecoes.indexOf(c) >= 0 ? ' checked' : '') + '> ' + esc(c) + '</label>'; }).join('') + '</div></fieldset>' : '') +
      '<label class="check"><input type="checkbox" name="lido"' + (l.terminado ? ' checked' : '') + '> Marcar como lido</label><p class="mini mudo">' + esc(l.nome) + ' · ' + (l.destaques.length) + ' destaque(s) · ' + l.marcadores.length + ' marcador(es)</p>' +
      '<div class="grupo-botoes"><button type="button" class="btn" data-baixar>Baixar arquivo</button><button type="button" class="btn" data-notas>Exportar notas</button><button type="button" class="btn perigo" data-excluir>Remover da biblioteca</button></div>',
      aoAbrir: function (form) { form.addEventListener('click', async function (ev) {
        if (ev.target.closest('[data-baixar]')) { const b = await Dados.lerArquivo(l.arquivo); if (b) UI.baixar(l.nome, b); }
        if (ev.target.closest('[data-notas]')) exportarNotas(l);
        if (ev.target.closest('[data-excluir]')) { form.closest('.modal-fundo').remove(); if (await confirmar('Remover', 'Remover "' + esc(l.titulo) + '" e suas notas da biblioteca?', 'Remover')) { Dados.apagarArquivo(l.arquivo); if (l.capa) Dados.apagarArquivo(l.capa); Dados.apagarArquivo('loc-' + l.id); e().livros = e().livros.filter(function (x) { return x !== l; }); salvar(); App.redesenhar(); } }
      }); } });
    if (!r) return;
    l.titulo = r.get('t') || l.titulo; l.autor = r.get('a'); l.tipo = r.get('tipo'); l.colecoes = r.getAll('col'); l.terminado = !!r.get('lido'); if (l.terminado) l.progresso = 1; salvar(); App.redesenhar();
  }

  function exportarNotas(l) {
    const linhas = ['# ' + l.titulo + (l.autor ? ' — ' + l.autor : ''), '', 'Notas e destaques exportados do Seven Leitor em ' + new Date().toLocaleString('pt-BR'), ''];
    l.destaques.slice().sort(function (a, b) { return (a.pct || 0) - (b.pct || 0); }).forEach(function (d) { linhas.push('> ' + d.texto.replace(/\n+/g, ' ')); linhas.push('— ' + (d.local || '') + ' · destaque ' + d.cor + (d.nota ? '\n\n**Nota:** ' + d.nota : '')); linhas.push(''); });
    if (l.marcadores.length) { linhas.push('## Marcadores'); l.marcadores.forEach(function (m) { linhas.push('- ' + (m.rotulo || '') + ' (' + Math.round((m.pct || 0) * 100) + '%)'); }); }
    UI.baixar(Nucleo.normalizar(l.titulo).replace(/ /g, '-').slice(0, 60) + '-notas.md', linhas.join('\n'), 'text/markdown;charset=utf-8');
  }

  // ---------- leitura ----------
  let R = null; // estado do leitor aberto

  async function abrir(id) {
    const l = livro(id); if (!l) { location.hash = '#/leitor'; return; }
    fechar(true); fontesLeitura();
    const b = await Dados.lerArquivo(l.arquivo); if (!b) { aviso('O arquivo não está neste navegador.', 'erro'); location.hash = '#/leitor'; return; }
    l.abertoEm = new Date().toISOString(); salvar();
    const ov = document.createElement('div'); ov.className = 'kd-leitor'; ov.id = 'kd-leitor'; ov.tabIndex = -1;
    ov.innerHTML = '<header class="kd-topo"><button class="kd-b" data-k="sair" aria-label="Voltar à biblioteca">‹ Biblioteca</button><b class="kd-titulo">' + esc(l.titulo) + '</b><span class="kespaco"></span><button class="kd-b" data-k="sumario" title="Sumário" aria-label="Sumário">☰</button><button class="kd-b" data-k="aa" title="Exibição" aria-label="Configurações de exibição">Aa</button><button class="kd-b" data-k="ouvir" title="Ouvir (leitura em voz alta)" aria-label="Ouvir o livro em voz alta">🔊</button><button class="kd-b" data-k="buscar" title="Buscar" aria-label="Buscar">🔍</button><button class="kd-b" data-k="caderno" title="Notas e destaques" aria-label="Notas e destaques">✎</button><button class="kd-b kd-marcar" data-k="marcar" title="Marcador" aria-label="Marcador">🔖</button></header>' +
      '<div class="kd-palco"><div class="kd-zona ant" data-k="ant"></div><div class="kd-pagina" id="kd-pagina"></div><div class="kd-zona prox" data-k="prox"></div><div class="kd-fita" hidden>🔖</div></div>' +
      '<footer class="kd-rodape"><span id="kd-local"></span><input type="range" id="kd-pos" min="0" max="1000" value="0" aria-label="Posição no livro"><span id="kd-resta"></span></footer><div class="kd-painel" id="kd-painel" hidden></div><div class="kd-pop" id="kd-pop" hidden></div><div class="kd-brilho"></div>';
    document.body.appendChild(ov); document.body.classList.add('lendo');
    R = { l: l, ov: ov, pagina: ov.querySelector('#kd-pagina'), blob: b, pct: l.progresso || 0, painel: null };
    aplicarTema();
    ov.addEventListener('click', clique); ov.addEventListener('input', entrada); ov.addEventListener('change', entrada);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', redimensionar);
    mostrarChrome();
    try {
      if (l.formato === 'epub') await motorEpub(); else if (l.formato === 'pdf') await motorPdf(); else await motorTexto();
    } catch (err) { R.pagina.innerHTML = '<div class="vazio"><h3>Não foi possível abrir</h3><p>' + esc(err.message) + '</p></div>'; }
    ov.focus();
  }

  function fechar(silencioso) {
    if (!R) return;
    ttsParar();
    try { if (R.motor && R.motor.destruir) R.motor.destruir(); } catch (err) { /* já destruído */ }
    R.ov.remove(); document.body.classList.remove('lendo'); document.removeEventListener('keydown', tecla); window.removeEventListener('resize', redimensionar);
    R = null; if (!silencioso) { location.hash = '#/leitor'; }
  }

  function pref() { return e().pref; }
  function aplicarTema() {
    const p = pref(), t = TEMAS[p.tema] || TEMAS.branco;
    R.ov.style.setProperty('--kd-fundo', t.f); R.ov.style.setProperty('--kd-texto', t.t); R.ov.dataset.tema = p.tema;
    R.ov.querySelector('.kd-brilho').style.opacity = String(1 - (p.brilho == null ? 1 : p.brilho));
    if (R.motor && R.motor.estilo) R.motor.estilo();
  }
  function colunas() { const p = pref(); return p.colunas === '2' || (p.colunas === 'auto' && R.ov.clientWidth > 1100) ? 2 : 1; }

  let chromeT;
  function mostrarChrome() { if (!R) return; R.ov.classList.add('chrome'); clearTimeout(chromeT); chromeT = setTimeout(function () { if (R && !R.painel) R.ov.classList.remove('chrome'); }, 3500); }

  function atualizarProgresso(pct, local, restaMin) {
    if (!R) return; R.pct = pct; const l = R.l; l.progresso = pct; if (pct >= 0.995) l.terminado = true;
    const s = R.ov.querySelector('#kd-pos'); if (s && document.activeElement !== s) s.value = Math.round(pct * 1000);
    R.ov.querySelector('#kd-local').textContent = (local ? local + ' · ' : '') + Math.round(pct * 100) + '%';
    R.ov.querySelector('#kd-resta').textContent = restaMin != null ? (restaMin < 1 ? 'Menos de 1 min restante' : (restaMin >= 60 ? Math.floor(restaMin / 60) + ' h ' + Math.round(restaMin % 60) + ' min' : Math.round(restaMin) + ' min') + ' restantes no livro') : '';
    const marcado = l.marcadores.some(function (m) { return R.motor && R.motor.mesmaPosicao && R.motor.mesmaPosicao(m.pos); });
    R.ov.querySelector('.kd-fita').hidden = !marcado; R.ov.querySelector('.kd-marcar').classList.toggle('on', marcado);
    clearTimeout(atualizarProgresso._t); atualizarProgresso._t = setTimeout(salvar, 600);
  }

  // ----- motor de texto próprio (TXT, Markdown, HTML, Word) com paginação em colunas -----
  async function motorTexto() {
    const l = R.l; let html;
    if (l.formato === 'docx') { const mammoth = await carregar('mammoth'); html = limparHTML((await mammoth.convertToHtml({ arrayBuffer: await R.blob.arrayBuffer() })).value); }
    else if (l.formato === 'html') { html = limparHTML(await R.blob.text()); }
    else if (l.formato === 'md') html = Kanban.markdown(await R.blob.text()).replace(/<(\/?)h([345])>/g, function (x, f, n) { return '<' + f + 'h' + (n - 2) + '>'; }); // o markdown dos cartões rebaixa títulos
    else { const t = await R.blob.text(); html = t.split(/\n{2,}/).map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join(''); }
    R.pagina.innerHTML = '<div class="kd-txt-janela"><div class="kd-txt" id="kd-txt">' + html + '</div></div>';
    const janela = R.pagina.querySelector('.kd-txt-janela'), txt = R.pagina.querySelector('#kd-txt');
    const palavras = (txt.textContent.match(/\S+/g) || []).length;
    const M = R.motor = { pag: 0, total: 1 };
    M.estilo = function () {
      const p = pref(); const c = colunas(); const w = janela.clientWidth; const gap = Math.round(w * MARGENS[p.margem] * 2);
      txt.style.cssText = 'font-family:' + FONTES[p.fonte] + ';font-size:' + p.tamanho + 'px;line-height:' + p.espaco + ';text-align:' + p.alinhar + ';column-width:' + Math.floor((w - gap * (c - 1)) / c) + 'px;column-gap:' + gap + 'px;height:' + janela.clientHeight + 'px;';
      requestAnimationFrame(function () { M.passo = w + gap; M.total = Math.max(1, Math.round(txt.scrollWidth / M.passo + 0.49)); M.ir(Math.round(R.pct * (M.total - 1)), true); });
    };
    M.ir = function (pg, silencioso) { M.pag = Math.max(0, Math.min(M.total - 1, pg)); txt.style.transform = 'translateX(' + (-M.pag * M.passo) + 'px)'; const pct = M.total > 1 ? M.pag / (M.total - 1) : 1; atualizarProgresso(pct, 'Página ' + (M.pag + 1) + ' de ' + M.total, palavras * (1 - pct) / 250); R.l.posicao = pct; void silencioso; };
    M.proxima = function () { if (M.pag < M.total - 1) M.ir(M.pag + 1); };
    M.anterior = function () { if (M.pag > 0) M.ir(M.pag - 1); };
    M.irPct = function (p) { M.ir(Math.round(p * (M.total - 1))); };
    M.posAtual = function () { return M.total > 1 ? M.pag / (M.total - 1) : 0; };
    M.mesmaPosicao = function (pos) { return M.total > 1 && Math.round(pos * (M.total - 1)) === M.pag; };
    M.rotulo = function () { return 'Página ' + (M.pag + 1); };
    // offsets de texto para guardar destaques independentemente do tamanho da letra
    const offset = function (no, off) { const w = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT); let n, t = 0; while ((n = w.nextNode())) { if (n === no) return t + off; t += n.length; } return t; };
    const intervalo = function (s, f) { const w = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT); let n, t = 0; const r = document.createRange(); let ini = false; while ((n = w.nextNode())) { if (!ini && t + n.length >= s) { r.setStart(n, s - t); ini = true; } if (ini && t + n.length >= f) { r.setEnd(n, f - t); return r; } t += n.length; } return null; };
    const paginaDe = function (r) { const rc = r.getClientRects()[0] || r.getBoundingClientRect(); const base = txt.getBoundingClientRect(); return Math.floor((rc.left - base.left) / M.passo); };
    M.pintarDestaques = function () {
      txt.querySelectorAll('mark.kd-hl').forEach(function (m) { const p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize(); });
      R.l.destaques.slice().sort(function (a, b) { return b.pos.s - a.pos.s; }).forEach(function (d) {
        const r = intervalo(d.pos.s, d.pos.e); if (!r) return;
        const nos = []; const w = document.createTreeWalker(r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (r.intersectsNode(n)) nos.push(n);
        nos.forEach(function (no) { const s = no === r.startContainer ? r.startOffset : 0; const f = no === r.endContainer ? r.endOffset : no.length; if (f <= s) return; const alvo = no.splitText(s); alvo.splitText(f - s); const m = document.createElement('mark'); m.className = 'kd-hl ' + d.cor; m.dataset.hl = d.id; alvo.parentNode.insertBefore(m, alvo); m.appendChild(alvo); });
      });
    };
    M.selecao = function () { const s = window.getSelection(); if (!s || s.isCollapsed || !txt.contains(s.anchorNode)) return null; const r = s.getRangeAt(0); const a = offset(r.startContainer, r.startOffset), b = offset(r.endContainer, r.endOffset); return { texto: s.toString(), pos: { s: Math.min(a, b), e: Math.max(a, b) }, pct: M.posAtual(), rect: r.getBoundingClientRect(), local: M.rotulo() }; };
    M.irPos = function (pos) { if (typeof pos === 'number') return M.irPct(pos); const r = intervalo(pos.s, pos.s + 1); if (r) M.ir(paginaDe(r)); };
    M.buscar = function (q) { const t = txt.textContent; const nt = igualar(t), nq = igualar(q); const out = []; let i = 0; while (nq && (i = nt.indexOf(nq, i)) >= 0 && out.length < 200) { out.push({ pos: { s: i, e: i + q.length }, trecho: t.slice(Math.max(0, i - 50), i + q.length + 60), local: '' }); i += nq.length; } return out; };
    M.sumario = function () { return Array.prototype.map.call(txt.querySelectorAll('h1,h2,h3'), function (h, i) { h.id = h.id || 'kd-h' + i; return { rotulo: h.textContent, nivel: Number(h.tagName[1]), pos: { s: offset(h.firstChild || h, 0), e: 0 } }; }); };
    M.estilo(); M.pintarDestaques();
    if (R.l.posicao != null) R.pct = R.l.posicao;
  }

  // Sanitização por lista de permissão (HTML e DOCX de terceiros): só tags de texto e links http(s).
  const TAGS_OK = { P: 1, BR: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, SUB: 1, SUP: 1, SMALL: 1, MARK: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, PRE: 1, CODE: 1, HR: 1, TABLE: 1, THEAD: 1, TBODY: 1, TFOOT: 1, TR: 1, TD: 1, TH: 1, CAPTION: 1, A: 1, IMG: 1, FIGURE: 1, FIGCAPTION: 1, DIV: 1, SPAN: 1, SECTION: 1, ARTICLE: 1, DL: 1, DT: 1, DD: 1 };
  const DESCARTAR = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, SVG: 1, MATH: 1, FORM: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1, LINK: 1, META: 1, BASE: 1, NOSCRIPT: 1, TEMPLATE: 1, FRAME: 1, FRAMESET: 1, AUDIO: 1, VIDEO: 1 };
  function limparHTML(h) {
    const doc = new DOMParser().parseFromString(String(h || ''), 'text/html');
    (function limpar(no) {
      Array.prototype.slice.call(no.childNodes).forEach(function (f) {
        if (f.nodeType === 3) return;
        if (f.nodeType !== 1) { f.remove(); return; }
        const tag = f.tagName.toUpperCase();
        if (DESCARTAR[tag]) { f.remove(); return; }
        if (!TAGS_OK[tag]) { limpar(f); while (f.firstChild) f.parentNode.insertBefore(f.firstChild, f); f.remove(); return; }
        Array.prototype.slice.call(f.attributes).forEach(function (at) {
          const n = at.name.toLowerCase();
          const ok = (n === 'href' && tag === 'A' && UI.url(at.value) !== '#') || (n === 'src' && tag === 'IMG' && /^(https?:|data:image\/(png|jpe?g|gif|webp);)/i.test(at.value.trim())) || n === 'alt' || n === 'title' || n === 'colspan' || n === 'rowspan' || (n === 'id' && /^[\w-]+$/.test(at.value));
          if (!ok) f.removeAttribute(at.name);
        });
        if (tag === 'A') { f.setAttribute('target', '_blank'); f.setAttribute('rel', 'noopener noreferrer'); }
        limpar(f);
      });
    })(doc.body);
    return doc.body.innerHTML;
  }


  // ----- EPUB (epub.js) -----
  async function motorEpub() {
    await carregar('jszip'); const ePub = await carregar('epub');
    const book = ePub(await R.blob.arrayBuffer());
    R.pagina.innerHTML = '<div id="kd-epub" class="kd-epub"></div>';
    const M = R.motor = { book: book };
    const criar = function () {
      if (M.rendition) M.rendition.destroy();
      const p = pref();
      M.rendition = book.renderTo('kd-epub', { width: '100%', height: '100%', flow: 'paginated', spread: colunas() === 2 ? 'always' : 'none', allowScriptedContent: false });
      M.estilo();
      M.rendition.on('relocated', function (loc) {
        M.loc = loc; const pct = book.locations.length() ? book.locations.percentageFromCfi(loc.start.cfi) : (loc.start.percentage || 0);
        R.l.posicao = loc.start.cfi; const capitulo = (book.navigation && M.capitulo(loc.start.href)) || '';
        const total = book.locations.length(); const atual = total ? book.locations.locationFromCfi(loc.start.cfi) : null;
        atualizarProgresso(pct, (capitulo ? capitulo + ' · ' : '') + (atual != null ? 'Localização ' + (atual + 1) + ' de ' + total : ''), total ? (total - (atual || 0)) * 1600 / 6 / 250 : null);
      });
      M.rendition.on('selected', function (cfi, contents) { const r = contents.range(cfi); const ifr = R.pagina.querySelector('iframe'); const rr = r.getBoundingClientRect(), fr = ifr ? ifr.getBoundingClientRect() : { left: 0, top: 0 }; abrirPop({ texto: r.toString(), pos: cfi, pct: book.locations.length() ? book.locations.percentageFromCfi(cfi) : R.pct, rect: { left: rr.left + fr.left, top: rr.top + fr.top, bottom: rr.bottom + fr.top, width: rr.width }, local: M.rotulo() }); });
      M.rendition.on('click', function (ev) { const sel = ev.view.getSelection(); if (sel && !sel.isCollapsed) return; const w = ev.view.innerWidth; const x = ev.clientX % w; if (x < w * 0.25) M.anterior(); else if (x > w * 0.75) M.proxima(); else mostrarChrome(); });
      M.rendition.on('keyup', tecla);
      M.rendition.on('markClicked', function () {});
      M.pintarDestaques();
      return M.rendition.display(R.l.posicao || undefined);
    };
    M.estilo = function () {
      if (!M.rendition) return; const p = pref(), t = TEMAS[p.tema];
      M.rendition.themes.default({ body: { 'font-family': FONTES[p.fonte] + ' !important', 'line-height': p.espaco + ' !important', 'text-align': p.alinhar + ' !important', color: t.t + ' !important', background: t.f + ' !important', padding: '0 ' + Math.round(MARGENS[p.margem] * 100) + '% !important' }, 'p, li, div, span': { 'font-family': 'inherit !important', 'line-height': 'inherit !important', color: 'inherit !important' }, a: { color: 'inherit !important' }, '::selection': { background: 'rgba(182,141,64,.35)' } });
      M.rendition.themes.fontSize(p.tamanho + 'px');
    };
    M.capitulo = function (href) { let nome = ''; const procurar = function (itens) { itens.forEach(function (i) { if (href && i.href && href.indexOf(i.href.split('#')[0]) >= 0) nome = i.label.trim(); if (i.subitems) procurar(i.subitems); }); }; procurar(book.navigation.toc || []); return nome; };
    M.proxima = function () { M.rendition.next(); }; M.anterior = function () { M.rendition.prev(); };
    M.irPct = function (p) { if (book.locations.length()) M.rendition.display(book.locations.cfiFromPercentage(p)); };
    M.irPos = function (pos) { if (typeof pos === 'number') return M.irPct(pos); M.rendition.display(pos); };
    M.posAtual = function () { return M.loc ? M.loc.start.cfi : null; };
    M.mesmaPosicao = function (pos) { return M.loc && typeof pos === 'string' && pos === M.loc.start.cfi; };
    M.rotulo = function () { return M.loc ? (M.capitulo(M.loc.start.href) || 'Localização') : ''; };
    M.pintarDestaques = function () { if (!M.rendition) return; (M.desenhados || []).forEach(function (c) { try { M.rendition.annotations.remove(c, 'highlight'); } catch (err) { /* já removido */ } }); M.desenhados = []; R.l.destaques.forEach(function (d) { try { M.rendition.annotations.highlight(d.pos, { id: d.id }, function () { abrirPainel('caderno'); }, 'kd-hl-' + d.cor, { fill: CORES[d.cor], 'fill-opacity': '0.45', 'mix-blend-mode': 'multiply' }); M.desenhados.push(d.pos); } catch (err) { /* cfi inválido */ } }); };
    M.buscar = async function (q) { const out = []; await Promise.all(book.spine.spineItems.map(function (it) { return it.load(book.load.bind(book)).then(function () { return it.find(q); }).then(function (r) { r.forEach(function (x) { out.push({ pos: x.cfi, trecho: x.excerpt, local: M.capitulo(it.href) }); }); it.unload(); }).catch(function () {}); })); return out.slice(0, 200); };
    M.sumario = function () { const out = []; const add = function (itens, n) { itens.forEach(function (i) { out.push({ rotulo: i.label.trim(), nivel: n, pos: i.href }); if (i.subitems) add(i.subitems, n + 1); }); }; add(book.navigation.toc || [], 1); return out; };
    M.recriar = criar;
    M.destruir = function () { book.destroy(); };
    await book.ready;
    const salvo = await Dados.lerArquivo('loc-' + R.l.id);
    if (salvo) book.locations.load(await salvo.text()); else book.locations.generate(1600).then(function () { Dados.guardarArquivo('loc-' + R.l.id, new Blob([book.locations.save()])); if (M.loc) M.rendition.reportLocation(); });
    await criar();
  }

  // ----- PDF (pdf.js) -----
  async function motorPdf() {
    const pdfjs = await carregar('pdf'); pdfjs.GlobalWorkerOptions.workerSrc = LIB.pdf[0].replace('pdf.min.js', 'pdf.worker.min.js');
    const doc = await pdfjs.getDocument({ data: await R.blob.arrayBuffer() }).promise;
    const M = R.motor = { doc: doc, pag: Math.max(1, Math.min(doc.numPages, typeof R.l.posicao === 'number' && R.l.posicao >= 1 ? R.l.posicao : 1)), zoom: 'pagina', textos: {} };
    R.pagina.innerHTML = '<div class="kd-pdf" id="kd-pdf"></div>';
    const box = R.pagina.querySelector('#kd-pdf');
    M.estilo = function () { M.render(); };
    M.render = async function () {
      const c = colunas(); const pags = [M.pag]; if (c === 2 && M.pag + 1 <= doc.numPages) pags.push(M.pag + 1);
      const token = M.token = {}; box.innerHTML = ''; box.className = 'kd-pdf tema-' + pref().tema;
      for (const n of pags) {
        const pg = await doc.getPage(n); if (token !== M.token) return;
        const base = pg.getViewport({ scale: 1 }); const larg = (box.clientWidth - 24) / pags.length, alt = box.clientHeight - 16;
        const escala = M.zoom === 'largura' ? larg / base.width : Math.min(larg / base.width, alt / base.height); const vp = pg.getViewport({ scale: escala * (window.devicePixelRatio || 1) }); const vpCss = pg.getViewport({ scale: escala });
        const wrap = document.createElement('div'); wrap.className = 'kd-pdf-pag'; wrap.style.width = vpCss.width + 'px'; wrap.style.height = vpCss.height + 'px'; wrap.dataset.pag = n;
        const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; cv.style.width = vpCss.width + 'px'; cv.style.height = vpCss.height + 'px'; wrap.appendChild(cv);
        const camada = document.createElement('div'); camada.className = 'textLayer'; wrap.appendChild(camada); const marcas = document.createElement('div'); marcas.className = 'kd-pdf-marcas'; wrap.appendChild(marcas);
        box.appendChild(wrap);
        await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        const tc = await pg.getTextContent(); M.textos[n] = tc.items.map(function (i) { return i.str; }).join(' ');
        camada.style.setProperty('--scale-factor', escala);
        try { await pdfjs.renderTextLayer({ textContentSource: tc, container: camada, viewport: vpCss, textDivs: [] }).promise; } catch (err) { /* sem camada de texto */ }
        M.pintarMarcas(wrap, n);
      }
      atualizarProgresso(doc.numPages > 1 ? (M.pag - 1) / (doc.numPages - 1) : 1, 'Página ' + M.pag + (pags.length > 1 ? '–' + (M.pag + 1) : '') + ' de ' + doc.numPages, (doc.numPages - M.pag) * 1.5);
      R.l.posicao = M.pag;
    };
    M.pintarMarcas = function (wrap, n) { const m = wrap.querySelector('.kd-pdf-marcas'); m.innerHTML = R.l.destaques.filter(function (d) { return d.pos.pag === n; }).map(function (d) { return d.pos.rects.map(function (r) { return '<i class="kd-pdf-hl ' + d.cor + '" data-hl="' + d.id + '" style="left:' + r[0] * 100 + '%;top:' + r[1] * 100 + '%;width:' + r[2] * 100 + '%;height:' + r[3] * 100 + '%"></i>'; }).join(''); }).join(''); };
    M.pintarDestaques = function () { R.pagina.querySelectorAll('.kd-pdf-pag').forEach(function (w) { M.pintarMarcas(w, Number(w.dataset.pag)); }); };
    const passo = function () { return colunas() === 2 ? 2 : 1; };
    M.proxima = function () { if (M.pag + passo() <= doc.numPages) { M.pag += passo(); M.render(); } };
    M.anterior = function () { if (M.pag > 1) { M.pag = Math.max(1, M.pag - passo()); M.render(); } };
    M.irPct = function (p) { M.pag = Math.max(1, Math.round(1 + p * (doc.numPages - 1))); M.render(); };
    M.irPos = function (pos) { if (typeof pos === 'number' && pos < 1) return M.irPct(pos); M.pag = typeof pos === 'object' ? pos.pag : pos; M.render(); };
    M.posAtual = function () { return M.pag; };
    M.mesmaPosicao = function (pos) { return pos === M.pag; };
    M.rotulo = function () { return 'Página ' + M.pag; };
    M.selecao = function () {
      const s = window.getSelection(); if (!s || s.isCollapsed) return null; const r = s.getRangeAt(0); const wrap = r.startContainer.parentElement && r.startContainer.parentElement.closest('.kd-pdf-pag'); if (!wrap) return null;
      const b = wrap.getBoundingClientRect(); const rects = Array.prototype.filter.call(r.getClientRects(), function (x) { return x.width > 1; }).map(function (x) { return [(x.left - b.left) / b.width, (x.top - b.top) / b.height, x.width / b.width, x.height / b.height]; });
      return { texto: s.toString(), pos: { pag: Number(wrap.dataset.pag), rects: rects }, pct: R.pct, rect: r.getBoundingClientRect(), local: 'Página ' + wrap.dataset.pag };
    };
    M.buscar = async function (q) { const out = []; const nq = igualar(q); for (let n = 1; n <= doc.numPages && out.length < 200; n++) { if (M.textos[n] == null) { const tc = await (await doc.getPage(n)).getTextContent(); M.textos[n] = tc.items.map(function (i) { return i.str; }).join(' '); } const t = M.textos[n]; const i = igualar(t).indexOf(nq); if (nq && i >= 0) out.push({ pos: n, trecho: t.slice(Math.max(0, i - 50), i + q.length + 60), local: 'Página ' + n }); } return out; };
    M.sumario = async function () { const o = await doc.getOutline(); const out = []; const add = async function (itens, nv) { for (const i of itens || []) { let pag = null; try { const dest = typeof i.dest === 'string' ? await doc.getDestination(i.dest) : i.dest; if (dest) pag = (await doc.getPageIndex(dest[0])) + 1; } catch (err) { /* destino inválido */ } out.push({ rotulo: i.title, nivel: nv, pos: pag || 1 }); await add(i.items, nv + 1); } }; await add(o, 1); if (!out.length) for (let n = 1; n <= doc.numPages; n++) out.push({ rotulo: 'Página ' + n, nivel: 1, pos: n }); return out; };
    M.destruir = function () { doc.destroy(); };
    R.ov.querySelector('.kd-topo').insertAdjacentHTML('beforeend', '<button class="kd-b" data-k="zoom" title="Ajustar à largura / página">⤢</button>');
    await M.render();
  }

  // ---------- interação ----------
  function clique(ev) {
    if (!R) return;
    const hl = ev.target.closest('[data-hl]'); if (hl && !ev.target.closest('.kd-pop')) { const d = R.l.destaques.find(function (x) { return x.id === hl.dataset.hl; }); if (d) { abrirPop(Object.assign({}, d, { rect: hl.getBoundingClientRect(), existente: d })); return; } }
    const k = ev.target.closest('[data-k]'); const a = k && k.dataset.k; if (k && k.tagName === 'A') ev.preventDefault();
    if (!a) { if (!ev.target.closest('.kd-painel, .kd-pop, .kd-rodape, .kd-topo')) { const s = R.motor && R.motor.selecao && R.motor.selecao(); if (s && s.texto.trim()) abrirPop(s); else { fecharPop(); mostrarChrome(); } } return; }
    if (a === 'sair') return fechar();
    if (a === 'ant') { fecharPop(); return R.motor && R.motor.anterior(); }
    if (a === 'prox') { fecharPop(); return R.motor && R.motor.proxima(); }
    if (a === 'zoom') { R.motor.zoom = R.motor.zoom === 'pagina' ? 'largura' : 'pagina'; R.motor.render(); return; }
    if (a === 'marcar') { alternarMarcador(); return; }
    if (['aa', 'sumario', 'buscar', 'caderno', 'ouvir'].indexOf(a) >= 0) { abrirPainel(R.painel === a ? null : a); return; }
    if (a === 'fechar-painel') { abrirPainel(null); return; }
    if (a === 'ir') { R.motor.irPos(JSON.parse(k.dataset.pos)); if (window.innerWidth < 900) abrirPainel(null); return; }
    if (a === 'tema') { pref().tema = k.dataset.v; salvar(); aplicarTema(); abrirPainel('aa'); return; }
    if (a === 'fonte') { pref().fonte = k.dataset.v; salvar(); R.motor.estilo(); abrirPainel('aa'); return; }
    if (a === 'margem' || a === 'alinhar' || a === 'colunas') { pref()[a] = k.dataset.v; salvar(); if (a === 'colunas' && R.motor.recriar) R.motor.recriar(); else R.motor.estilo(); abrirPainel('aa'); return; }
    if (a === 'cor' || a === 'nota' || a === 'copiar' || a === 'pesquisar' || a === 'wiki' || a === 'apagar') { acaoPop(a, k.dataset.v); return; }
    if (a === 'del-marc') { R.l.marcadores.splice(Number(k.dataset.i), 1); salvar(); atualizarProgresso(R.pct, R.ov.querySelector('#kd-local').textContent.replace(/ · \d+%$/, '')); abrirPainel('caderno'); return; }
    if (a === 'filtro-cor') { R.filtroCor = R.filtroCor === k.dataset.v ? '' : k.dataset.v; abrirPainel('caderno'); return; }
    if (a === 'exportar') { exportarNotas(R.l); return; }
    if (a === 'tts-play') { ttsAlternar(); return; }
    if (a === 'tts-parar') { ttsParar(); abrirPainel('ouvir'); return; }
  }

  function entrada(ev) {
    if (!R) return; const t = ev.target;
    if (t.id === 'kd-pos' && ev.type === 'change') R.motor.irPct(Number(t.value) / 1000);
    if (t.id === 'kd-pos' && ev.type === 'input') R.ov.querySelector('#kd-local').textContent = Math.round(Number(t.value) / 10) + '%';
    if (t.dataset.pref && /^tts/.test(t.dataset.pref)) { pref()[t.dataset.pref] = t.dataset.pref === 'ttsVoz' ? t.value : Number(t.value); salvar(); if (ev.type === 'change' && R.painel === 'ouvir') abrirPainel('ouvir'); return; }
    if (t.dataset.pref) { pref()[t.dataset.pref] = Number(t.value); salvar(); if (t.dataset.pref === 'brilho') aplicarTema(); else { clearTimeout(entrada._t); entrada._t = setTimeout(function () { R.motor.estilo(); }, 150); } }
    if (t.id === 'kd-q' && ev.type === 'change') buscar(t.value);
  }

  function tecla(ev) {
    if (!R) return;
    if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName || '') && ev.key !== 'Escape') return;
    if (document.querySelector('.modal-fundo')) return;
    if (ev.key === 'ArrowRight' || ev.key === 'PageDown' || (ev.key === ' ' && !ev.shiftKey)) { ev.preventDefault && ev.preventDefault(); fecharPop(); R.motor.proxima(); }
    else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp' || (ev.key === ' ' && ev.shiftKey)) { ev.preventDefault && ev.preventDefault(); fecharPop(); R.motor.anterior(); }
    else if (ev.key === 'Escape') { if (!R.ov.querySelector('#kd-pop').hidden) fecharPop(); else if (R.painel) abrirPainel(null); else fechar(); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key === 'f') { ev.preventDefault && ev.preventDefault(); abrirPainel('buscar'); }
  }

  function redimensionar() { if (!R || !R.motor) return; clearTimeout(redimensionar._t); redimensionar._t = setTimeout(function () { if (R.motor.recriar) R.motor.recriar(); else R.motor.estilo(); }, 250); }

  function alternarMarcador() {
    const pos = R.motor.posAtual(); const i = R.l.marcadores.findIndex(function (m) { return R.motor.mesmaPosicao(m.pos); });
    if (i >= 0) { R.l.marcadores.splice(i, 1); aviso('Marcador removido.'); } else { R.l.marcadores.push({ id: Dados.id('mk'), pos: pos, pct: R.pct, rotulo: R.motor.rotulo(), em: new Date().toISOString() }); aviso('Página marcada.'); }
    salvar(); atualizarProgresso(R.pct, R.ov.querySelector('#kd-local').textContent.replace(/ · \d+%$/, ''));
  }

  // ----- popup de seleção (destacar, nota, copiar, pesquisar) -----
  function abrirPop(s) {
    const pop = R.ov.querySelector('#kd-pop'); R.sel = s;
    const ex = s.existente;
    pop.innerHTML = '<div class="kd-pop-cores">' + Object.keys(CORES).map(function (c) { return '<button class="kd-cor ' + c + (ex && ex.cor === c ? ' sel' : '') + '" data-k="cor" data-v="' + c + '" aria-label="Destacar em ' + c + '"></button>'; }).join('') + '</div><div class="kd-pop-acoes"><button data-k="nota">✎ Nota</button><button data-k="copiar">Copiar</button><button data-k="pesquisar">Dicionário</button><button data-k="wiki">Wikipédia</button>' + (ex ? '<button data-k="apagar">Apagar</button>' : '') + '</div>' + (ex && ex.nota ? '<p class="kd-pop-nota">' + esc(ex.nota) + '</p>' : '');
    pop.hidden = false;
    const r = s.rect; const w = 330; let x = Math.min(window.innerWidth - w - 10, Math.max(10, r.left + (r.width || 0) / 2 - w / 2)); let y = (r.top || 0) - 96; if (y < 60) y = (r.bottom || r.top || 0) + 12;
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function fecharPop() { if (!R) return; R.ov.querySelector('#kd-pop').hidden = true; R.sel = null; }
  async function acaoPop(a, v) {
    const s = R.sel; if (!s) return; let d = s.existente;
    if (a === 'cor') { if (d) d.cor = v; else { d = { id: Dados.id('hl'), cor: v, texto: s.texto.trim(), pos: s.pos, pct: s.pct, local: s.local, em: new Date().toISOString(), nota: '' }; R.l.destaques.push(d); } salvar(); R.motor.pintarDestaques(); limparSelecao(); fecharPop(); return; }
    if (a === 'nota') { fecharPop(); const r = await modal({ titulo: 'Nota', corpo: '<blockquote class="kd-cit">' + esc(s.texto.slice(0, 400)) + '</blockquote>' + campo('Sua nota', '<textarea name="n" rows="4">' + esc(d ? d.nota : '') + '</textarea>') }); if (!r) return; if (!d) { d = { id: Dados.id('hl'), cor: 'amarelo', texto: s.texto.trim(), pos: s.pos, pct: s.pct, local: s.local, em: new Date().toISOString() }; R.l.destaques.push(d); } d.nota = r.get('n'); salvar(); R.motor.pintarDestaques(); limparSelecao(); return; }
    if (a === 'copiar') { try { await navigator.clipboard.writeText(s.texto); aviso('Texto copiado.'); } catch (err) { aviso('Use Ctrl+C para copiar.'); } fecharPop(); return; }
    const palavra = s.texto.trim().split(/\s+/).slice(0, 6).join(' ');
    if (a === 'pesquisar') { window.open('https://www.dicio.com.br/' + encodeURIComponent(Nucleo.normalizar(palavra.split(' ')[0])) + '/', '_blank', 'noopener'); fecharPop(); return; }
    if (a === 'wiki') { window.open('https://pt.wikipedia.org/w/index.php?search=' + encodeURIComponent(palavra), '_blank', 'noopener'); fecharPop(); return; }
    if (a === 'apagar' && d) { R.l.destaques = R.l.destaques.filter(function (x) { return x !== d; }); salvar(); R.motor.pintarDestaques(); fecharPop(); }
  }
  function limparSelecao() { try { window.getSelection().removeAllRanges(); const f = R.pagina.querySelector('iframe'); if (f) f.contentWindow.getSelection().removeAllRanges(); } catch (err) { /* sem seleção */ } }

  // ----- painéis -----
  // ---------- leitura em voz alta (como o Audible/Kindle) ----------
  function ttsVozes() { if (!window.speechSynthesis) return []; const v = speechSynthesis.getVoices(); const pt = v.filter(function (x) { return /^pt/i.test(x.lang); }); return pt.length ? pt : v; }
  // Blocos de texto visíveis na página atual (texto, EPUB em iframe ou PDF).
  function blocosVisiveis() {
    const fr = R.pagina.querySelector('iframe'); const doc = fr && fr.contentDocument ? fr.contentDocument : document;
    const raiz = fr && fr.contentDocument ? doc.body : R.pagina;
    const caixa = fr ? { left: 0, right: fr.clientWidth, top: 0, bottom: fr.clientHeight } : R.pagina.getBoundingClientRect();
    let els = Array.prototype.slice.call(raiz.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, td, .textLayer span'));
    els = els.filter(function (el) { if (el.querySelector('p, li, h1, h2, h3, h4, h5, h6, blockquote')) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.right > caixa.left + 2 && r.left < caixa.right - 2 && r.bottom > caixa.top && r.top < caixa.bottom; });
    const textos = els.map(function (el) { return el.textContent.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    return textos.length ? textos : [String(raiz.innerText || '').replace(/\s+/g, ' ').trim()].filter(Boolean);
  }
  function frases(t) { return (t.match(/[^.!?;:]+[.!?;:]*\s*/g) || [t]).reduce(function (out, f) { if (out.length && (out[out.length - 1] + f).length < 220) out[out.length - 1] += f; else out.push(f); return out; }, []).map(function (f) { return f.trim(); }).filter(Boolean); }
  function ttsLerPagina() {
    if (!R || !R.tts || !R.tts.tocando) return;
    const tts = R.tts; const fila = blocosVisiveis().reduce(function (a, b) { return a.concat(frases(b)); }, []);
    // não repete o que já foi lido quando um bloco atravessa duas páginas
    if (tts.ultimo) { const i = fila.indexOf(tts.ultimo); if (i >= 0) fila.splice(0, i + 1); }
    tts.fila = fila; ttsProxima();
  }
  function ttsProxima() {
    if (!R || !R.tts || !R.tts.tocando) return;
    const tts = R.tts;
    if (!tts.fila.length) {
      const antes = R.motor.posAtual ? R.motor.posAtual() : null; R.motor.proxima();
      setTimeout(function () { if (!R || !R.tts) return; const depois = R.motor.posAtual ? R.motor.posAtual() : null; if (antes != null && depois === antes) { ttsParar(); aviso('Fim do livro.'); if (R.painel === 'ouvir') abrirPainel('ouvir'); return; } ttsLerPagina(); }, 450);
      return;
    }
    const f = tts.fila.shift(); tts.ultimo = f; tts.trecho = f;
    const u = new SpeechSynthesisUtterance(f); const pr = pref(); u.lang = 'pt-BR'; u.rate = Number(pr.ttsVel) || 1;
    const voz = ttsVozes().find(function (v) { return v.name === pr.ttsVoz; }); if (voz) u.voice = voz;
    u.onend = function () { if (R && R.tts === tts && !tts.pausado) ttsProxima(); };
    u.onerror = function (e) { if (e.error !== 'interrupted' && e.error !== 'canceled' && R && R.tts === tts) ttsProxima(); };
    speechSynthesis.speak(u);
    if (R.painel === 'ouvir') { const t = R.ov.querySelector('.kd-tts-trecho'); if (t) t.textContent = f.slice(0, 220); else abrirPainel('ouvir'); }
  }
  function ttsAlternar() {
    if (!window.speechSynthesis) { aviso('Este navegador não tem leitura em voz alta.', 'erro'); return; }
    if (!R.tts) { R.tts = { tocando: true, pausado: false, fila: [], ultimo: '' }; speechSynthesis.cancel(); ttsLerPagina(); }
    else if (R.tts.pausado) { R.tts.pausado = false; speechSynthesis.resume(); if (!speechSynthesis.speaking) ttsProxima(); }
    else { R.tts.pausado = true; speechSynthesis.pause(); }
    abrirPainel('ouvir');
  }
  function ttsParar() { if (!R || !R.tts) return; R.tts = null; try { speechSynthesis.cancel(); } catch (e) { /* sem voz */ } }
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = function () { if (R && R.painel === 'ouvir') abrirPainel('ouvir'); };

  async function abrirPainel(qual) {
    const p = R.ov.querySelector('#kd-painel'); R.painel = qual; p.hidden = !qual; R.ov.classList.toggle('chrome', !!qual); if (!qual) { mostrarChrome(); return; }
    const pr = pref(); const fechar_ = '<button class="icone kd-fechar" data-k="fechar-painel" aria-label="Fechar">×</button>';
    if (qual === 'aa') p.innerHTML = fechar_ + '<h3>Exibição</h3><h4>Fonte</h4><div class="kd-ops">' + Object.keys(FONTES).map(function (f) { return '<button class="' + (pr.fonte === f ? 'sel' : '') + '" data-k="fonte" data-v="' + f + '" style="font-family:' + FONTES[f] + '">Aa ' + f + '</button>'; }).join('') + '</div>' +
      '<h4>Tamanho</h4><input type="range" min="12" max="34" value="' + pr.tamanho + '" data-pref="tamanho" aria-label="Tamanho da letra"><h4>Espaçamento</h4><input type="range" min="1.2" max="2.2" step="0.1" value="' + pr.espaco + '" data-pref="espaco" aria-label="Espaçamento entre linhas">' +
      '<h4>Margens</h4><div class="kd-ops">' + [['p', 'Estreita'], ['m', 'Média'], ['g', 'Larga']].map(function (x) { return '<button class="' + (pr.margem === x[0] ? 'sel' : '') + '" data-k="margem" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<h4>Alinhamento</h4><div class="kd-ops"><button class="' + (pr.alinhar === 'justify' ? 'sel' : '') + '" data-k="alinhar" data-v="justify">Justificado</button><button class="' + (pr.alinhar === 'left' ? 'sel' : '') + '" data-k="alinhar" data-v="left">À esquerda</button></div>' +
      '<h4>Colunas</h4><div class="kd-ops">' + [['auto', 'Automático'], ['1', 'Uma'], ['2', 'Duas']].map(function (x) { return '<button class="' + (pr.colunas === x[0] ? 'sel' : '') + '" data-k="colunas" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<h4>Tema</h4><div class="kd-temas">' + Object.keys(TEMAS).map(function (t) { return '<button class="' + (pr.tema === t ? 'sel' : '') + '" data-k="tema" data-v="' + t + '" style="background:' + TEMAS[t].f + ';color:' + TEMAS[t].t + '">' + TEMAS[t].n + '</button>'; }).join('') + '</div>' +
      '<h4>Brilho</h4><input type="range" min="0.35" max="1" step="0.05" value="' + (pr.brilho == null ? 1 : pr.brilho) + '" data-pref="brilho" aria-label="Brilho">';
    if (qual === 'ouvir') {
      const vozes = ttsVozes(); const tts = R.tts || {};
      p.innerHTML = fechar_ + '<h3>Ouvir o livro</h3>' + (!window.speechSynthesis ? '<p class="alerta">Este navegador não tem leitura em voz alta.</p>' :
        '<p class="mini mudo">Lê a partir da página atual e vira as páginas sozinho. Use fones para não incomodar a equipe.</p><div class="kd-tts"><button class="btn primario" data-k="tts-play">' + (tts.tocando && !tts.pausado ? '⏸ Pausar' : tts.tocando ? '▶ Continuar' : '▶ Ouvir daqui') + '</button>' + (tts.tocando ? '<button class="btn" data-k="tts-parar">⏹ Parar</button>' : '') + '</div>' +
        '<h4>Velocidade</h4><input type="range" min="0.6" max="2" step="0.1" value="' + (pr.ttsVel || 1) + '" data-pref="ttsVel" aria-label="Velocidade da leitura"><p class="mini mudo">' + String(pr.ttsVel || 1).replace('.', ',') + '×</p>' +
        '<h4>Voz</h4><select data-pref="ttsVoz" aria-label="Voz">' + (vozes.length ? vozes.map(function (v) { return '<option value="' + esc(v.name) + '"' + (pr.ttsVoz === v.name ? ' selected' : '') + '>' + esc(v.name + ' (' + v.lang + ')') + '</option>'; }).join('') : '<option>Voz padrão do sistema</option>') + '</select>' +
        (tts.trecho ? '<h4>Lendo agora</h4><p class="kd-tts-trecho">' + esc(tts.trecho.slice(0, 220)) + '</p>' : ''));
    }
    if (qual === 'sumario') { p.innerHTML = fechar_ + '<h3>Sumário</h3><p class="mudo">Carregando…</p>'; const s = await R.motor.sumario(); if (R.painel !== 'sumario') return; p.innerHTML = fechar_ + '<h3>Sumário</h3>' + (s.length ? '<ol class="kd-sum">' + s.map(function (i) { return '<li style="padding-left:' + (i.nivel - 1) * 14 + 'px"><a href="#" data-k="ir" data-pos=\'' + esc(JSON.stringify(i.pos)) + '\'>' + esc(i.rotulo) + '</a></li>'; }).join('') + '</ol>' : '<p class="mudo">Sem sumário. Documentos com títulos (H1–H3) geram o sumário automaticamente.</p>') + '<h4>Ir para</h4><p class="mini mudo">Arraste a barra inferior para ir a qualquer posição.</p>'; }
    if (qual === 'buscar') { p.innerHTML = fechar_ + '<h3>Buscar no livro</h3><input type="search" id="kd-q" placeholder="Digite e aperte Enter" value="' + esc(R.ultimaBusca || '') + '"><div id="kd-res"></div>'; const q = p.querySelector('#kd-q'); q.focus(); q.onkeydown = function (ev) { if (ev.key === 'Enter') buscar(q.value); }; if (R.ultimaBusca) buscar(R.ultimaBusca); }
    if (qual === 'caderno') {
      const ds = R.l.destaques.filter(function (d) { return !R.filtroCor || d.cor === R.filtroCor; }).slice().sort(function (a, b) { return (a.pct || 0) - (b.pct || 0); });
      p.innerHTML = fechar_ + '<h3>Caderno</h3><div class="kd-ops">' + Object.keys(CORES).map(function (c) { return '<button class="kd-cor ' + c + (R.filtroCor === c ? ' sel' : '') + '" data-k="filtro-cor" data-v="' + c + '" aria-label="Filtrar ' + c + '"></button>'; }).join('') + '<button data-k="exportar">Exportar</button></div>' +
        '<h4>Destaques e notas (' + R.l.destaques.length + ')</h4>' + (ds.length ? '<ul class="kd-notas">' + ds.map(function (d) { return '<li class="' + d.cor + '"><a href="#" data-k="ir" data-pos=\'' + esc(JSON.stringify(d.pos)) + '\'><q>' + esc(d.texto.slice(0, 300)) + '</q></a>' + (d.nota ? '<p class="kd-n">✎ ' + esc(d.nota) + '</p>' : '') + '<small>' + esc(d.local || '') + ' · ' + dataHora(d.em) + '</small></li>'; }).join('') + '</ul>' : '<p class="mudo">Selecione um trecho do texto para destacar ou anotar.</p>') +
        '<h4>Marcadores (' + R.l.marcadores.length + ')</h4>' + (R.l.marcadores.length ? '<ul class="kd-notas">' + R.l.marcadores.map(function (m, i) { return '<li><a href="#" data-k="ir" data-pos=\'' + esc(JSON.stringify(m.pos)) + '\'>🔖 ' + esc(m.rotulo || '') + ' · ' + Math.round((m.pct || 0) * 100) + '%</a> <button class="icone" data-k="del-marc" data-i="' + i + '" aria-label="Remover">×</button></li>'; }).join('') + '</ul>' : '<p class="mudo">Toque em 🔖 para marcar a página.</p>');
    }
  }
  async function buscar(q) {
    R.ultimaBusca = q; const box = R.ov.querySelector('#kd-res'); if (!box) return; if (!q.trim()) { box.innerHTML = ''; return; }
    box.innerHTML = '<p class="mudo">Buscando…</p>'; const r = await R.motor.buscar(q.trim()); if (!R || R.painel !== 'buscar') return;
    const marcar = function (t) { return esc(t).replace(new RegExp('(' + q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); };
    box.innerHTML = '<p class="mini">' + r.length + ' resultado(s)</p><ul class="kd-notas">' + r.map(function (x) { return '<li><a href="#" data-k="ir" data-pos=\'' + esc(JSON.stringify(x.pos)) + '\'>…' + marcar(x.trecho) + '…</a>' + (x.local ? '<small>' + esc(x.local) + '</small>' : '') + '</li>'; }).join('') + '</ul>';
  }

  Telas.leitor = {
    titulo: 'Seven Leitor',
    render: function (el, sub, param) {
      el.onclick = null;
      if (sub === 'ler') { biblioteca(el); abrir(param); return; }
      if (R) fechar(true);
      biblioteca(el);
    },
    adicionarDaNuvem: async function (x) { const b = await Dados.lerArquivo(x.id); if (!b) return aviso('Arquivo não encontrado.', 'erro'); await adicionar([new File([b], x.nome, { type: x.mime || b.type })]); location.hash = '#/leitor/ler/' + e().livros[0].id; }
  };
  window.addEventListener('hashchange', function () { if (R && location.hash.indexOf('#/leitor/ler/') !== 0) fechar(true); });
})();
