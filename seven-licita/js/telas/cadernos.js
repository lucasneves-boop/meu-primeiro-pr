/* Seven Cadernos (cadernos no estilo NotebookLM): fontes (PDF, DOCX, TXT, texto colado), chat com citações, estúdio (resumo, guia, FAQ,
   linha do tempo, quiz, análise de edital, resumo em áudio) e notas. Respostas extrativas: só o que está nas fontes. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, modal, confirmar, aviso } = UI;
  const C = self.Cadernos;
  const LIB = { pdf: ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdfjsLib'], mammoth: ['https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', 'mammoth'] };
  const libs = {};
  const EMOJIS = ['📒', '📘', '📗', '📕', '📙', '⚖️', '🏛️', '📑'];
  const mem = { id: null, fontes: [], ix: null, carregando: false, conversa: [], aba: 'estudio', saida: null, fonteAberta: null, falando: false };

  function e() { const d = Dados.e; d.cadernos = d.cadernos || []; return d.cadernos; }
  function caderno(id) { return e().find(function (c) { return c.id === id; }); }
  function carregar(nome) { const x = LIB[nome]; if (self[x[1]]) return Promise.resolve(self[x[1]]); return libs[nome] = libs[nome] || new Promise(function (ok, erro) { const s = document.createElement('script'); s.src = x[0]; s.onload = function () { ok(self[x[1]]); }; s.onerror = function () { libs[nome] = null; erro(new Error('Sem acesso à biblioteca de leitura (' + nome + '). Verifique a internet.')); }; document.head.appendChild(s); }); }

  async function extrairTexto(f) {
    const nome = f.name.toLowerCase();
    if (/\.pdf$/.test(nome)) {
      const pdfjs = await carregar('pdf'); pdfjs.GlobalWorkerOptions.workerSrc = LIB.pdf[0].replace('pdf.min.js', 'pdf.worker.min.js');
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise; let t = '';
      for (let p = 1; p <= doc.numPages; p++) { const tc = await (await doc.getPage(p)).getTextContent(); t += tc.items.map(function (i) { return i.str + (i.hasEOL ? '\n' : ' '); }).join('') + '\n\n'; }
      return { texto: t, paginas: doc.numPages };
    }
    if (/\.docx$/.test(nome)) { const m = await carregar('mammoth'); const r = await m.extractRawText({ arrayBuffer: await f.arrayBuffer() }); return { texto: r.value }; }
    if (/\.(html?|xml)$/.test(nome)) { const d = new DOMParser().parseFromString(await f.text(), 'text/html'); return { texto: d.body ? d.body.innerText || d.body.textContent : '' }; }
    return { texto: await f.text() };
  }

  async function abrirCaderno(c) {
    if (mem.id === c.id && mem.ix) return;
    mem.id = c.id; mem.fontes = []; mem.ix = null; mem.conversa = c.conversa ? c.conversa.slice() : []; mem.saida = null; mem.fonteAberta = null; mem.carregando = true;
    for (const f of c.fontes) { const b = await Dados.lerArquivo(f.arq); if (b) mem.fontes.push({ id: f.id, nome: f.nome, texto: await b.text(), ativa: f.ativa !== false }); }
    reindexar(); mem.carregando = false;
  }
  function reindexar() { const at = mem.fontes.filter(function (f) { return f.ativa; }); mem.ix = C.indexar(at.map(function (f) { return { id: f.id, nome: f.nome, texto: f.texto, trechos: C.dividir(f.texto, 700) }; })); }
  function trechoTexto(fid, i) { const f = mem.fontes.find(function (x) { return x.id === fid; }); return f ? (C.dividir(f.texto, 700)[i] || {}).texto || '' : ''; }

  // ---------- início ----------
  function telaInicio(el) {
    const ls = e().slice().sort(function (a, b) { return b.editadoEm - a.editadoEm; });
    el.innerHTML = '<div class="cd-home"><header><div><h1>Seven Cadernos</h1><p class="mudo">Junte editais, termos de referência, leis e atas num caderno e converse com eles. As respostas citam o trecho de onde vieram.</p></div><button class="btn primario" data-a="novo">＋ Novo caderno</button></header>' +
      '<div class="cd-grade">' + '<button class="cd-card novo" data-a="novo"><span>＋</span><b>Criar novo caderno</b></button>' + ls.map(function (c) { return '<a class="cd-card" href="#/cadernos/c/' + c.id + '" style="--cd-cor:' + esc(c.cor || '#f5ecdb') + '"><span class="cd-emoji">' + esc(c.emoji || '📒') + '</span><b>' + esc(c.titulo) + '</b><small>' + new Date(c.editadoEm).toLocaleDateString('pt-BR') + ' · ' + c.fontes.length + ' fonte' + (c.fontes.length === 1 ? '' : 's') + '</small><button class="icone cd-del" data-del="' + c.id + '" aria-label="Excluir caderno">🗑</button></a>'; }).join('') + '</div></div>';
    el.onclick = async function (ev) {
      const del = ev.target.closest('[data-del]'); if (del) { ev.preventDefault(); const c = caderno(del.dataset.del); if (await confirmar('Excluir caderno', 'Excluir <b>' + esc(c.titulo) + '</b> e suas fontes?', 'Excluir')) { for (const f of c.fontes) await Dados.apagarArquivo(f.arq); Dados.e.cadernos = e().filter(function (x) { return x !== c; }); Dados.salvar(); App.redesenhar(); } return; }
      if (ev.target.closest('[data-a=novo]')) { const c = { id: Dados.id('cd'), titulo: 'Caderno sem título', emoji: EMOJIS[e().length % EMOJIS.length], cor: ['#f5ecdb', '#dfe9f7', '#e3f2e5', '#f7e1e1'][e().length % 4], fontes: [], notas: [], conversa: [], criadoEm: Date.now(), editadoEm: Date.now() }; e().push(c); Dados.salvar(); location.hash = '#/cadernos/c/' + c.id; }
    };
  }

  // ---------- caderno ----------
  function citacaoHTML(r) { return r.partes.map(function (p) { return esc(p.frase) + ' <button class="cd-cit" data-cit="' + p.cit + '" title="Ver trecho">' + p.cit + '</button>'; }).join(' '); }
  function mensagemHTML(m, k) {
    if (m.eu) return '<div class="cd-msg eu"><p>' + esc(m.t) + '</p></div>';
    if (m.r.vazio) return '<div class="cd-msg ia"><p>Não encontrei isso nas fontes ativas. Reformule com palavras do documento ou adicione a fonte que trata do assunto.</p></div>';
    return '<div class="cd-msg ia" data-k="' + k + '"><p>' + citacaoHTML(m.r) + '</p><div class="cd-msg-ac"><button class="btn mini fantasma" data-a="salvar-nota" data-k="' + k + '">📌 Salvar em nota</button><button class="btn mini fantasma" data-a="copiar" data-k="' + k + '">Copiar</button></div><div class="cd-fontes-cit">' + m.r.citacoes.map(function (c) { return '<button class="cd-cit-l" data-fonte="' + esc(c.fonte) + '" data-trecho="' + c.trecho + '"><b>' + c.n + '</b> ' + esc(c.nome) + '</button>'; }).join('') + '</div></div>';
  }
  function telaCaderno(el, id) {
    const c = caderno(id); if (!c) { el.innerHTML = UI.vazio('Caderno não encontrado', '', '<a class="btn" href="#/cadernos">Voltar</a>'); return; }
    if (mem.id !== c.id || !mem.ix) { el.innerHTML = '<div class="cd-carregando">Abrindo caderno…</div>'; abrirCaderno(c).then(function () { if (location.hash === '#/cadernos/c/' + id) App.redesenhar(); }); return; }
    const sug = mem.ix.N ? C.perguntasSugeridas(mem.ix) : [];
    el.innerHTML = '<div class="cd">' +
      '<header class="cd-topo"><a class="icone" href="#/cadernos" aria-label="Voltar">←</a><button class="cd-emoji-b" data-a="emoji" title="Trocar ícone">' + esc(c.emoji) + '</button><input id="cd-tit" value="' + esc(c.titulo) + '" aria-label="Nome do caderno"></header>' +
      '<aside class="cd-col cd-fontes"><header><h3>Fontes</h3><button class="btn mini" data-a="add-fonte">＋ Adicionar</button></header>' +
      (mem.fontes.length ? '<label class="check cd-todas"><input type="checkbox" id="cd-todas"' + (mem.fontes.every(function (f) { return f.ativa; }) ? ' checked' : '') + '> Selecionar todas</label><ul>' + mem.fontes.map(function (f) { const meta = c.fontes.find(function (x) { return x.id === f.id; }) || {}; return '<li class="' + (mem.fonteAberta === f.id ? 'aberta' : '') + '"><input type="checkbox" data-ativa="' + f.id + '"' + (f.ativa ? ' checked' : '') + ' aria-label="Usar fonte"><button class="cd-fonte" data-ver="' + f.id + '"><span>' + (/\.pdf$/i.test(f.nome) ? '📄' : /\.docx$/i.test(f.nome) ? '📝' : '🗒') + '</span><div><b>' + esc(f.nome) + '</b><small>' + (f.texto.length < 1000 ? f.texto.length + ' caracteres' : Math.round(f.texto.length / 1000).toLocaleString('pt-BR') + ' mil caracteres') + (meta.paginas ? ' · ' + meta.paginas + ' pág.' : '') + '</small></div></button><button class="icone" data-rm="' + f.id + '" aria-label="Remover fonte">×</button></li>'; }).join('') + '</ul>' : '<div class="cd-sem"><p>Adicione PDFs, DOCX, TXT ou cole um texto (edital, TR, lei, ata…).</p><button class="btn primario" data-a="add-fonte">＋ Adicionar fonte</button></div>') + '</aside>' +
      '<section class="cd-col cd-chat">' + (mem.fonteAberta ? visorFonte() :
        '<div class="cd-msgs" id="cd-msgs">' + (mem.conversa.length ? mem.conversa.map(mensagemHTML).join('') : '<div class="cd-boas"><span>' + esc(c.emoji) + '</span><h2>' + esc(c.titulo) + '</h2><p class="mudo">' + (mem.fontes.length ? mem.fontes.length + ' fonte(s) · pergunte qualquer coisa sobre elas.' : 'Comece adicionando uma fonte.') + '</p></div>') + '</div>' +
        (sug.length ? '<div class="cd-sug">' + sug.map(function (s) { return '<button data-sug="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' : '') +
        '<form class="cd-perg" id="cd-perg"><input name="q" placeholder="' + (mem.fontes.length ? 'Pergunte sobre as fontes…' : 'Adicione uma fonte para começar') + '" autocomplete="off"' + (mem.ix.N ? '' : ' disabled') + ' aria-label="Pergunta"><span class="mini mudo">' + mem.fontes.filter(function (f) { return f.ativa; }).length + ' fonte(s)</span><button class="btn primario"' + (mem.ix.N ? '' : ' disabled') + ' aria-label="Enviar">➤</button></form>' +
        (mem.conversa.length ? '<button class="btn mini fantasma cd-limpar" data-a="limpar">Limpar conversa</button>' : '')) + '</section>' +
      '<aside class="cd-col cd-estudio"><nav class="cd-abas"><button data-aba="estudio" class="' + (mem.aba === 'estudio' ? 'on' : '') + '">Estúdio</button><button data-aba="notas" class="' + (mem.aba === 'notas' ? 'on' : '') + '">Notas (' + (c.notas || []).length + ')</button></nav>' + (mem.aba === 'notas' ? painelNotas(c) : painelEstudio()) + '</aside></div>';
    const box = el.querySelector('#cd-msgs'); if (box) box.scrollTop = box.scrollHeight;
    const fv = el.querySelector('.cd-trecho-on'); if (fv) fv.scrollIntoView({ block: 'center' });
    ligar(el, c);
  }
  function visorFonte() {
    const f = mem.fontes.find(function (x) { return x.id === mem.fonteAberta; }); if (!f) { mem.fonteAberta = null; return ''; }
    const ts = C.dividir(f.texto, 700);
    return '<div class="cd-visor"><header><button class="btn mini fantasma" data-a="fechar-fonte">← Voltar à conversa</button><b>' + esc(f.nome) + '</b></header><div class="cd-visor-t">' + ts.map(function (t) { return '<p data-t="' + t.i + '" class="' + (t.i === mem.trechoAberto ? 'cd-trecho-on' : '') + '">' + esc(t.texto) + '</p>'; }).join('') + '</div></div>';
  }
  function painelEstudio() {
    const btn = function (k, ic, t, d) { return '<button class="cd-ferr' + (mem.saida && mem.saida.tipo === k ? ' on' : '') + '" data-gerar="' + k + '"' + (mem.ix.N ? '' : ' disabled') + '><span>' + ic + '</span><b>' + t + '</b><small>' + d + '</small></button>'; };
    return '<div class="cd-est-rolagem"><div class="cd-ferrs">' + btn('edital', '⚖️', 'Análise de edital', 'Objeto, datas, valor, habilitação') + btn('resumo', '📝', 'Resumo', 'As frases mais importantes') + btn('guia', '🎓', 'Guia de estudo', 'Termos-chave e perguntas') + btn('faq', '❓', 'Perguntas frequentes', 'Respostas com citação') + btn('tempo', '🗓', 'Linha do tempo', 'Datas e prazos em ordem') + btn('quiz', '🧠', 'Quiz', 'Teste o que leu') + btn('audio', '🎧', 'Resumo em áudio', 'Ouvir o resumo') + '</div><div id="cd-saida">' + saidaHTML() + '</div></div>';
  }
  function origem(x) { return '<button class="cd-cit-l mini" data-fonte="' + esc(x.fonte) + '" data-trecho="' + x.trecho + '">' + esc(x.nome) + '</button>'; }
  function saidaHTML() {
    const s = mem.saida; if (!s) return '<p class="mini mudo cd-dica">Escolha uma ferramenta. Tudo é tirado das fontes ativas, com o link para o trecho.</p>';
    let h = '<div class="cd-saida"><header><h4>' + esc(s.titulo) + '</h4><button class="btn mini fantasma" data-a="saida-nota">📌 Salvar em nota</button></header>';
    if (s.tipo === 'edital') {
      h += '<table class="cd-ed">' + s.dados.campos.map(function (c) { return '<tr class="' + (c.achado ? '' : 'falta') + '"><th>' + esc(c.t) + '</th><td>' + (c.achado ? (c.destaque ? '<b>' + esc(c.destaque) + '</b><br>' : '') + esc(c.frase) + ' ' + origem(c) : '<span class="mudo">Não encontrado nas fontes</span>') + '</td></tr>'; }).join('') + '</table>' +
        '<h4>Habilitação exigida</h4>' + s.dados.habilitacao.map(function (g) { return '<details' + (g.itens.length ? ' open' : '') + '><summary>' + esc(g.t) + ' <small>(' + g.itens.length + ')</small></summary>' + (g.itens.length ? '<ul>' + g.itens.map(function (i) { return '<li>' + esc(i.frase) + ' ' + origem(i) + '</li>'; }).join('') + '</ul>' : '<p class="mini mudo">Nada encontrado.</p>') + '</details>'; }).join('') +
        (s.dados.datas.length ? '<h4>Datas citadas</h4><ul>' + s.dados.datas.map(function (d) { return '<li><b>' + d.data.split('-').reverse().join('/') + '</b> — ' + esc(d.frase) + '</li>'; }).join('') + '</ul>' : '') +
        '<p class="mini mudo">Extração automática: confira sempre no edital antes de decidir.</p><button class="btn mini" data-a="edital-agenda">🗓 Criar lembretes na Seven Agenda com as datas</button>';
    }
    if (s.tipo === 'resumo' || s.tipo === 'audio') h += '<ul class="cd-res">' + s.dados.map(function (x) { return '<li>' + esc(x.frase) + ' ' + origem(x) + '</li>'; }).join('') + '</ul>' + (s.tipo === 'audio' ? '<button class="btn primario" data-a="falar">' + (mem.falando ? '⏹ Parar' : '▶ Ouvir') + '</button>' : '');
    if (s.tipo === 'guia') h += '<h5>Termos-chave</h5><p class="cd-termos">' + s.dados.termos.map(function (t) { return '<button data-sug="O que diz sobre ' + esc(t) + '?">' + esc(t) + '</button>'; }).join('') + '</p><h5>Perguntas para revisar</h5><ol>' + s.dados.perguntas.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol>';
    if (s.tipo === 'faq') h += s.dados.map(function (f) { return '<details><summary>' + esc(f.pergunta) + '</summary><p>' + citacaoHTML(f.resposta) + '</p><p>' + f.resposta.citacoes.map(origem).join(' ') + '</p></details>'; }).join('') || '<p class="mudo">Sem material suficiente.</p>';
    if (s.tipo === 'tempo') h += s.dados.length ? '<ol class="cd-tempo">' + s.dados.map(function (d) { return '<li><b>' + d.data.split('-').reverse().join('/') + '</b><p>' + esc(d.frase) + ' ' + origem(d) + '</p></li>'; }).join('') + '</ol>' : '<p class="mudo">Nenhuma data encontrada.</p>';
    if (s.tipo === 'quiz') h += s.dados.length ? s.dados.map(function (q, i) { return '<div class="cd-q" data-q="' + i + '"><p><b>' + (i + 1) + '.</b> ' + esc(q.enunciado) + '</p>' + q.opcoes.map(function (o, j) { return '<button data-resp="' + j + '">' + esc(o) + '</button>'; }).join('') + '</div>'; }).join('') : '<p class="mudo">Sem material suficiente.</p>';
    return h + '</div>';
  }
  function painelNotas(c) {
    return '<div class="cd-notas"><button class="btn mini" data-a="nova-nota">＋ Nota</button>' + ((c.notas || []).length ? c.notas.slice().reverse().map(function (n) { return '<article class="cd-nota" data-n="' + n.id + '"><header><b>' + esc(n.titulo) + '</b><span><button class="icone" data-a="nota-anot" title="Enviar para o Seven Notas" aria-label="Enviar para o Seven Notas">🗒</button><button class="icone" data-a="nota-del" aria-label="Excluir nota">×</button></span></header><p>' + esc(n.texto).replace(/\n/g, '<br>') + '</p><small>' + new Date(n.em).toLocaleString('pt-BR') + '</small></article>'; }).join('') : '<p class="mini mudo">Salve respostas e resultados do estúdio aqui.</p>') + '</div>';
  }
  function textoSaida(s) {
    if (s.tipo === 'edital') return s.dados.campos.filter(function (c) { return c.achado; }).map(function (c) { return c.t + ': ' + (c.destaque ? c.destaque + ' — ' : '') + c.frase; }).join('\n') + '\n\nHabilitação:\n' + s.dados.habilitacao.map(function (g) { return '• ' + g.t + ': ' + g.itens.length + ' exigência(s)'; }).join('\n');
    if (s.tipo === 'resumo' || s.tipo === 'audio') return s.dados.map(function (x) { return '• ' + x.frase; }).join('\n');
    if (s.tipo === 'guia') return 'Termos: ' + s.dados.termos.join(', ') + '\n\n' + s.dados.perguntas.map(function (p, i) { return (i + 1) + '. ' + p; }).join('\n');
    if (s.tipo === 'faq') return s.dados.map(function (f) { return f.pergunta + '\n' + f.resposta.partes.map(function (p) { return p.frase; }).join(' '); }).join('\n\n');
    if (s.tipo === 'tempo') return s.dados.map(function (d) { return d.data.split('-').reverse().join('/') + ' — ' + d.frase; }).join('\n');
    if (s.tipo === 'quiz') return s.dados.map(function (q, i) { return (i + 1) + '. ' + q.enunciado + ' (resposta: ' + q.opcoes[q.correta] + ')'; }).join('\n');
    return '';
  }
  function gerar(tipo) {
    const ix = mem.ix;
    const s = { tipo: tipo };
    if (tipo === 'edital') { s.titulo = 'Análise de edital'; s.dados = C.analisarEdital(ix); }
    if (tipo === 'resumo') { s.titulo = 'Resumo'; s.dados = C.resumo(ix, 7); }
    if (tipo === 'audio') { s.titulo = 'Resumo em áudio'; s.dados = C.resumo(ix, 6); }
    if (tipo === 'guia') { const t = C.palavrasChave(ix, 12); s.titulo = 'Guia de estudo'; s.dados = { termos: t, perguntas: t.slice(0, 8).map(function (x) { return 'Explique, com base nas fontes, o papel de “' + x + '”.'; }) }; }
    if (tipo === 'faq') { s.titulo = 'Perguntas frequentes'; s.dados = C.faq(ix, 6); }
    if (tipo === 'tempo') { s.titulo = 'Linha do tempo'; s.dados = C.linhaDoTempo(ix); }
    if (tipo === 'quiz') { s.titulo = 'Quiz'; s.dados = C.quiz(ix, 6); }
    mem.saida = s;
  }
  function falar(textos) {
    if (!self.speechSynthesis) { aviso('Este navegador não tem leitura em voz alta.', 'erro'); return; }
    speechSynthesis.cancel(); if (mem.falando) { mem.falando = false; return; }
    mem.falando = true; textos.forEach(function (t, i) { const u = new SpeechSynthesisUtterance(t); u.lang = 'pt-BR'; u.rate = 1.05; if (i === textos.length - 1) u.onend = function () { mem.falando = false; const b = document.querySelector('[data-a=falar]'); if (b) b.textContent = '▶ Ouvir'; }; speechSynthesis.speak(u); });
  }

  function ligar(el, c) {
    const tocar = function () { c.editadoEm = Date.now(); Dados.salvar(); };
    el.querySelector('#cd-tit').oninput = function () { c.titulo = this.value || 'Caderno sem título'; tocar(); };
    const f = el.querySelector('#cd-perg');
    const perguntar = function (q) { q = String(q || '').trim(); if (!q || !mem.ix.N) return; const r = C.responder(mem.ix, q); mem.conversa.push({ eu: true, t: q }, { r: r }); c.conversa = mem.conversa.slice(-40); tocar(); App.redesenhar(); const i = document.querySelector('#cd-perg input'); if (i) i.focus(); };
    if (f) f.onsubmit = function (ev) { ev.preventDefault(); perguntar(f.q.value); };
    el.onchange = function (ev) {
      const a = ev.target.closest('[data-ativa]');
      if (a) { const fo = mem.fontes.find(function (x) { return x.id === a.dataset.ativa; }); fo.ativa = a.checked; const m = c.fontes.find(function (x) { return x.id === fo.id; }); m.ativa = a.checked; reindexar(); mem.saida = null; tocar(); App.redesenhar(); }
      if (ev.target.id === 'cd-todas') { mem.fontes.forEach(function (fo) { fo.ativa = ev.target.checked; }); c.fontes.forEach(function (m) { m.ativa = ev.target.checked; }); reindexar(); mem.saida = null; tocar(); App.redesenhar(); }
    };
    el.onclick = async function (ev) {
      const t = ev.target;
      const sug = t.closest('[data-sug]'); if (sug) { mem.fonteAberta = null; perguntar(sug.dataset.sug); return; }
      const cit = t.closest('.cd-cit'); if (cit) { const m = mem.conversa[Number(cit.closest('[data-k]') && cit.closest('[data-k]').dataset.k)]; const ci = m ? m.r.citacoes[Number(cit.dataset.cit) - 1] : null; if (ci) { mem.fonteAberta = ci.fonte; mem.trechoAberto = ci.trecho; App.redesenhar(); } return; }
      const cl = t.closest('.cd-cit-l'); if (cl) { mem.fonteAberta = cl.dataset.fonte; mem.trechoAberto = Number(cl.dataset.trecho); App.redesenhar(); return; }
      const ver = t.closest('[data-ver]'); if (ver) { mem.fonteAberta = mem.fonteAberta === ver.dataset.ver ? null : ver.dataset.ver; mem.trechoAberto = -1; App.redesenhar(); return; }
      const rm = t.closest('[data-rm]'); if (rm) { const fo = c.fontes.find(function (x) { return x.id === rm.dataset.rm; }); if (await confirmar('Remover fonte', 'Remover <b>' + esc(fo.nome) + '</b> do caderno?', 'Remover')) { await Dados.apagarArquivo(fo.arq); c.fontes = c.fontes.filter(function (x) { return x !== fo; }); mem.fontes = mem.fontes.filter(function (x) { return x.id !== fo.id; }); if (mem.fonteAberta === fo.id) mem.fonteAberta = null; reindexar(); mem.saida = null; tocar(); App.redesenhar(); } return; }
      const aba = t.closest('[data-aba]'); if (aba) { mem.aba = aba.dataset.aba; App.redesenhar(); return; }
      const g = t.closest('[data-gerar]'); if (g) { gerar(g.dataset.gerar); if (g.dataset.gerar === 'audio') falar(mem.saida.dados.map(function (x) { return x.frase; })); App.redesenhar(); return; }
      const resp = t.closest('[data-resp]'); if (resp) { const qd = resp.closest('[data-q]'); const q = mem.saida.dados[Number(qd.dataset.q)]; if (qd.querySelector('.certa')) return; qd.querySelectorAll('[data-resp]').forEach(function (b, j) { b.disabled = true; if (j === q.correta) b.classList.add('certa'); else if (b === resp) b.classList.add('errada'); }); return; }
      const b = t.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'add-fonte') await adicionarFonte(c);
      if (a === 'fechar-fonte') { mem.fonteAberta = null; App.redesenhar(); }
      if (a === 'limpar' && await confirmar('Limpar conversa', 'Apagar o histórico desta conversa?', 'Limpar')) { mem.conversa = []; c.conversa = []; tocar(); App.redesenhar(); }
      if (a === 'emoji') { c.emoji = EMOJIS[(EMOJIS.indexOf(c.emoji) + 1) % EMOJIS.length]; tocar(); App.redesenhar(); }
      if (a === 'salvar-nota' || a === 'copiar') { const m = mem.conversa[Number(b.dataset.k)]; const perg = mem.conversa[Number(b.dataset.k) - 1]; const txt = m.r.partes.map(function (p) { return p.frase; }).join(' ') + '\n\nFontes: ' + m.r.citacoes.map(function (x) { return '[' + x.n + '] ' + x.nome; }).join('; ');
        if (a === 'copiar') { try { await navigator.clipboard.writeText(txt); aviso('Copiado.'); } catch (err) { aviso('Não consegui copiar.', 'erro'); } return; }
        c.notas = c.notas || []; c.notas.push({ id: Dados.id('cdn'), titulo: perg ? perg.t : 'Resposta', texto: txt, em: Date.now() }); tocar(); aviso('Salvo nas notas do caderno.'); App.redesenhar(); }
      if (a === 'saida-nota' && mem.saida) { c.notas = c.notas || []; c.notas.push({ id: Dados.id('cdn'), titulo: mem.saida.titulo, texto: textoSaida(mem.saida), em: Date.now() }); tocar(); aviso('Salvo nas notas do caderno.'); App.redesenhar(); }
      if (a === 'nova-nota') { const r = await modal({ titulo: 'Nova nota', corpo: campo('Título', '<input name="t" required>') + campo('Texto', '<textarea name="x" rows="6"></textarea>') }); if (r) { c.notas = c.notas || []; c.notas.push({ id: Dados.id('cdn'), titulo: r.get('t').trim(), texto: r.get('x'), em: Date.now() }); tocar(); App.redesenhar(); } }
      if (a === 'nota-del') { c.notas = c.notas.filter(function (n) { return n.id !== b.closest('[data-n]').dataset.n; }); tocar(); App.redesenhar(); }
      if (a === 'nota-anot') { const n = c.notas.find(function (x) { return x.id === b.closest('[data-n]').dataset.n; }); const d = Dados.e; d.anotacoes = d.anotacoes || { notas: [], pastas: [] }; d.anotacoes.notas = d.anotacoes.notas || []; d.anotacoes.notas.push({ id: Dados.id('an'), titulo: n.titulo, html: '<p>' + esc(n.texto).replace(/\n/g, '</p><p>') + '</p><p>Caderno: ' + esc(c.titulo) + '</p>', tracos: [], fundo: 'liso', criadaEm: Date.now(), editadaEm: Date.now() }); Dados.salvar(); aviso('Enviada para o Seven Notas.'); }
      if (a === 'falar' && mem.saida) { falar(mem.saida.dados.map(function (x) { return x.frase; })); b.textContent = mem.falando ? '⏹ Parar' : '▶ Ouvir'; }
      if (a === 'edital-agenda' && mem.saida && Telas.agenda) { const ds = mem.saida.dados.datas.filter(function (d) { return d.data >= new Date().toISOString().slice(0, 10); }); ds.forEach(function (d) { Telas.agenda.criar(d.frase.slice(0, 90) + ' #edital', { data: d.data, tags: ['edital'] }); }); Dados.salvar(); aviso(ds.length ? ds.length + ' lembrete(s) criados na Seven Agenda.' : 'Nenhuma data futura encontrada.'); }
    };
  }

  async function adicionarFonte(c) {
    const r = await modal({ titulo: 'Adicionar fontes', largo: true, botao: 'Adicionar',
      corpo: '<p class="mini mudo">PDF, DOCX, TXT, MD ou HTML (até 30 MB cada). PDF digitalizado sem texto não é lido.</p><input type="file" name="arqs" multiple accept=".pdf,.docx,.txt,.md,.csv,.html,.htm,.xml"><p class="mini mudo" style="text-align:center">— ou —</p>' + campo('Nome do texto colado', '<input name="nome" placeholder="Ex.: Termo de referência">') + campo('Colar texto', '<textarea name="texto" rows="8" placeholder="Cole aqui o conteúdo"></textarea>') });
    if (!r) return;
    const arqs = r.getAll('arqs').filter(function (f) { return f && f.size; }); const novos = [];
    if (r.get('texto').trim()) novos.push({ nome: r.get('nome').trim() || 'Texto colado', texto: r.get('texto') });
    for (const f of arqs) {
      if (f.size > 30 * 1024 * 1024) { aviso(f.name + ': acima de 30 MB.', 'erro'); continue; }
      aviso('Lendo ' + f.name + '…');
      try { const x = await extrairTexto(f); if (!x.texto.trim()) { aviso(f.name + ': nenhum texto encontrado (PDF escaneado?).', 'erro'); continue; } novos.push({ nome: f.name, texto: x.texto, paginas: x.paginas }); }
      catch (err) { aviso(f.name + ': ' + err.message, 'erro'); }
    }
    for (const n of novos) {
      const id = Dados.id('cdf'), arq = Dados.id('cdt');
      await Dados.guardarArquivo(arq, new Blob([n.texto], { type: 'text/plain' }));
      c.fontes.push({ id: id, arq: arq, nome: n.nome, paginas: n.paginas || null, tam: n.texto.length, ativa: true, em: Date.now() });
      mem.fontes.push({ id: id, nome: n.nome, texto: n.texto, ativa: true });
      if (c.titulo === 'Caderno sem título') c.titulo = n.nome.replace(/\.[a-z0-9]+$/i, '');
    }
    if (novos.length) { reindexar(); mem.saida = null; c.editadoEm = Date.now(); Dados.salvar(); aviso(novos.length + ' fonte(s) adicionada(s).'); App.redesenhar(); }
  }

  window.addEventListener('hashchange', function () { if (!/^#\/cadernos\/c\//.test(location.hash)) { if (self.speechSynthesis) speechSynthesis.cancel(); mem.falando = false; } });

  Telas.cadernos = {
    titulo: 'Seven Cadernos',
    render: function (el, sub, param) { if (sub === 'c') return telaCaderno(el, param); mem.id = null; mem.ix = null; telaInicio(el); }
  };
})();
