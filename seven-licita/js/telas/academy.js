/* Seven Academia: área de membros com cursos, mentorias e dicas (estilo plataforma de cursos). */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, data, dataHora, campo, opcoes, modal, confirmar, aviso } = UI;
  const CATEGORIAS = ['Cursos', 'Mentorias', 'Dicas', 'Ao vivo'];
  const TIPOS = { video: 'Vídeo (arquivo)', link: 'Vídeo por link (YouTube, Vimeo, Drive)', audio: 'Áudio / podcast', pdf: 'PDF / apostila', texto: 'Texto', aovivo: 'Encontro ao vivo' };
  const CAPAS = ['linear-gradient(135deg,#b68d40,#3a2a10)', 'linear-gradient(135deg,#0a1929,#24507a)', 'linear-gradient(135deg,#800000,#2a0000)', 'linear-gradient(135deg,#127a64,#05352c)', 'linear-gradient(135deg,#5b3fa0,#1e1440)', 'linear-gradient(135deg,#2b2b2b,#050505)'];
  const est = { gerenciar: false, categoria: '', busca: '', aba: 'comentarios' };
  const urls = {};

  function e() { const d = Dados.e; d.academy = d.academy || { cursos: [], progresso: {}, comentarios: {}, notas: {}, avaliacoes: {}, ultimo: null }; return d.academy; }
  function eu() { return Dados.e.config.responsavel || 'Aluno'; }
  function curso(id) { return e().cursos.find(function (c) { return c.id === id; }); }
  function aulas(c) { const out = []; c.modulos.forEach(function (m) { m.aulas.forEach(function (a) { out.push({ m: m, a: a }); }); }); return out; }
  function progresso(c) { const l = aulas(c); const f = l.filter(function (x) { return (e().progresso[x.a.id] || {}).feita; }).length; return { total: l.length, feitas: f, pct: l.length ? Math.round(f / l.length * 100) : 0 }; }
  function bloqueada(a) { return a.liberaEm && new Date(a.liberaEm + 'T00:00:00') > new Date(); }
  function cargaHoraria(c) { return aulas(c).reduce(function (s, x) { return s + (Number(x.a.duracao) || 0); }, 0); }
  function fmtMin(m) { m = Number(m) || 0; if (!m) return ''; const h = Math.floor(m / 60); return h ? h + 'h' + (m % 60 ? String(m % 60).padStart(2, '0') : '') : m + ' min'; }
  function capaEstilo(c) { return c.capaArquivo ? '' : 'background:' + (c.capa || CAPAS[0]); }
  function salvar() { Dados.salvar(); }

  async function url(id) { if (!id) return ''; if (!urls[id]) { try { const b = await Dados.lerArquivo(id); if (b) urls[id] = URL.createObjectURL(b); } catch (err) { /* arquivo ausente */ } } return urls[id] || ''; }
  function carregarImagens(el) { el.querySelectorAll('img[data-arq]').forEach(async function (img) { const u = await url(img.dataset.arq); if (u) img.src = u; else img.remove(); }); }

  function embed(link) {
    const s = String(link || '').trim(); let m;
    if ((m = s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/))) return 'https://www.youtube.com/embed/' + m[1] + '?rel=0';
    if ((m = s.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return 'https://player.vimeo.com/video/' + m[1];
    if ((m = s.match(/drive\.google\.com\/file\/d\/([\w-]+)/))) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    if ((m = s.match(/loom\.com\/share\/(\w+)/))) return 'https://www.loom.com/embed/' + m[1];
    return /^https:\/\//.test(s) ? s : '';
  }

  // ---------- vitrine ----------
  function vitrine(el) {
    const todos = e().cursos.filter(function (c) { return est.gerenciar || c.publicado !== false; });
    const lista = todos.filter(function (c) { return (!est.categoria || c.categoria === est.categoria) && (!est.busca || Nucleo.normalizar(c.titulo + ' ' + (c.subtitulo || '') + ' ' + (c.descricao || '')).indexOf(Nucleo.normalizar(est.busca)) >= 0); });
    const ult = e().ultimo && curso(e().ultimo.curso);
    const ultAula = ult && aulas(ult).find(function (x) { return x.a.id === e().ultimo.aula; });
    const emAndamento = todos.filter(function (c) { const p = progresso(c); return p.feitas && p.pct < 100; });
    const card = function (c) {
      const p = progresso(c);
      return '<a class="ac-card" href="#/academy/curso/' + c.id + '"><div class="ac-capa" style="' + capaEstilo(c) + '">' + (c.capaArquivo ? '<img data-arq="' + c.capaArquivo + '" alt="">' : '<span>' + esc(c.titulo) + '</span>') + (c.publicado === false ? '<em class="ac-rascunho">Rascunho</em>' : '') + '<i class="ac-cat">' + esc(c.categoria || 'Cursos') + '</i></div>' +
        '<div class="ac-info"><b>' + esc(c.titulo) + '</b><small>' + p.total + ' aula(s)' + (cargaHoraria(c) ? ' · ' + fmtMin(cargaHoraria(c)) : '') + '</small><div class="barra"><i style="width:' + p.pct + '%"></i></div><small>' + (p.pct === 100 ? '✓ Concluído' : p.pct ? p.pct + '% concluído' : 'Não iniciado') + '</small></div></a>';
    };
    el.innerHTML = '<div class="academy">' +
      '<header class="ac-hero"><div><span class="ac-selo">SEVEN ACADEMY</span><h2>' + (ultAula ? 'Continue de onde parou' : 'Aprenda licitação com quem vive o dia a dia') + '</h2>' +
      (ultAula ? '<p>' + esc(ult.titulo) + ' · ' + esc(ultAula.a.titulo) + '</p><a class="btn primario" href="#/academy/aula/' + ult.id + '/' + ultAula.a.id + '">▶ Continuar</a>' : '<p>Aulas, mentorias e dicas em um só lugar.</p>') + '</div>' +
      '<div class="grupo-botoes"><label class="check ac-ger"><input type="checkbox" id="ac-ger"' + (est.gerenciar ? ' checked' : '') + '> Gerenciar conteúdo</label>' + (est.gerenciar ? '<button class="btn primario" data-a="novo">+ Novo conteúdo</button>' : '') + '</div></header>' +
      '<div class="ac-filtros"><div class="pilulas">' + [''].concat(CATEGORIAS).map(function (c) { return '<button class="pilula ' + (est.categoria === c ? 'ativa' : '') + '" data-cat="' + esc(c) + '">' + esc(c || 'Tudo') + '</button>'; }).join('') + '</div><form id="ac-busca"><input type="search" name="q" placeholder="Buscar aulas e cursos…" value="' + esc(est.busca) + '"></form></div>' +
      (emAndamento.length && !est.categoria && !est.busca ? '<h3 class="ac-trilho">Em andamento</h3><div class="ac-linha">' + emAndamento.map(card).join('') + '</div>' : '') +
      (lista.length ? CATEGORIAS.filter(function (cat) { return lista.some(function (c) { return (c.categoria || 'Cursos') === cat; }); }).map(function (cat) { return '<h3 class="ac-trilho">' + esc(cat) + '</h3><div class="ac-grade">' + lista.filter(function (c) { return (c.categoria || 'Cursos') === cat; }).map(card).join('') + '</div>'; }).join('')
        : UI.vazio(todos.length ? 'Nada encontrado' : 'A Academy ainda está vazia', todos.length ? 'Tente outra busca.' : 'Marque <b>Gerenciar conteúdo</b> e crie o primeiro curso, mentoria ou dica. Você pode enviar vídeos, PDFs e áudios ou usar links do YouTube, Vimeo e Google Drive.', !todos.length ? '<button class="btn primario" data-a="novo">+ Criar primeiro conteúdo</button>' : '')) + '</div>';
    carregarImagens(el);
    el.querySelector('#ac-ger').onchange = function () { est.gerenciar = this.checked; App.redesenhar(); };
    el.querySelector('#ac-busca').onsubmit = function (ev) { ev.preventDefault(); est.busca = new FormData(this).get('q'); App.redesenhar(); };
    el.onclick = async function (ev) {
      const c = ev.target.closest('[data-cat]'); if (c) { est.categoria = c.dataset.cat; App.redesenhar(); return; }
      const b = ev.target.closest('[data-a=novo]'); if (b) { const x = await editarCurso(); if (x) location.hash = '#/academy/curso/' + x.id; }
    };
  }

  // ---------- curso ----------
  function telaCurso(el, id) {
    const c = curso(id); if (!c) { el.innerHTML = UI.vazio('Conteúdo não encontrado', '', '<a class="btn" href="#/academy">Voltar</a>'); return; }
    const p = progresso(c); const l = aulas(c);
    const prox = l.find(function (x) { return !(e().progresso[x.a.id] || {}).feita && !bloqueada(x.a); }) || l[0];
    const nota = e().avaliacoes[c.id] || 0;
    el.innerHTML = '<div class="academy"><p><a href="#/academy">← Seven Academia</a></p>' +
      '<header class="ac-banner" style="' + capaEstilo(c) + '">' + (c.capaArquivo ? '<img data-arq="' + c.capaArquivo + '" alt="">' : '') + '<div class="ac-banner-txt"><span class="ac-selo">' + esc(c.categoria || 'Cursos') + '</span><h2>' + esc(c.titulo) + '</h2>' + (c.subtitulo ? '<p>' + esc(c.subtitulo) + '</p>' : '') + '<p class="mini">' + (c.autor ? 'Com ' + esc(c.autor) + ' · ' : '') + p.total + ' aula(s)' + (cargaHoraria(c) ? ' · ' + fmtMin(cargaHoraria(c)) : '') + '</p>' +
      '<div class="grupo-botoes">' + (prox ? '<a class="btn primario" href="#/academy/aula/' + c.id + '/' + prox.a.id + '">▶ ' + (p.feitas ? 'Continuar' : 'Começar') + '</a>' : '') + (p.pct === 100 ? '<button class="btn" data-a="certificado">🎓 Certificado</button>' : '') + (est.gerenciar ? '<button class="btn" data-a="editar">Editar</button><button class="btn" data-a="modulo">+ Módulo</button><button class="btn perigo" data-a="excluir">Excluir</button>' : '') + '</div></div></header>' +
      '<div class="ac-curso"><section>' +
      '<div class="ac-prog"><div class="barra"><i style="width:' + p.pct + '%"></i></div><b>' + p.pct + '%</b><span class="mudo">' + p.feitas + ' de ' + p.total + ' aulas</span></div>' +
      (c.descricao ? '<div class="md cartao">' + Kanban.markdown(c.descricao) + '</div>' : '') +
      c.modulos.map(function (m, mi) {
        const feitas = m.aulas.filter(function (a) { return (e().progresso[a.id] || {}).feita; }).length;
        return '<details class="ac-modulo" open data-modulo="' + m.id + '"><summary><b>' + esc(m.titulo) + '</b><span class="mudo">' + feitas + '/' + m.aulas.length + '</span>' + (est.gerenciar ? '<span class="grupo-botoes ac-ger-mod"><button class="btn mini" data-a="aula" data-m="' + m.id + '">+ Aula</button><button class="btn mini fantasma" data-a="ren-mod" data-m="' + m.id + '">Renomear</button>' + (mi > 0 ? '<button class="btn mini fantasma" data-a="sobe-mod" data-m="' + m.id + '">↑</button>' : '') + '<button class="btn mini fantasma perigo" data-a="del-mod" data-m="' + m.id + '">×</button></span>' : '') + '</summary>' +
          '<ol class="ac-aulas">' + m.aulas.map(function (a, ai) {
            const pr = e().progresso[a.id] || {}; const bloq = bloqueada(a);
            return '<li class="' + (pr.feita ? 'feita' : '') + (bloq ? ' bloq' : '') + '"><span class="ac-check">' + (pr.feita ? '✓' : bloq ? '🔒' : '○') + '</span>' + (bloq ? '<span>' + esc(a.titulo) + ' <small class="mudo">libera em ' + data(a.liberaEm) + '</small></span>' : '<a href="#/academy/aula/' + c.id + '/' + a.id + '">' + esc(a.titulo) + '</a>') + '<small class="mudo">' + esc(TIPOS[a.tipo] ? TIPOS[a.tipo].split(' ')[0] : '') + (a.duracao ? ' · ' + fmtMin(a.duracao) : '') + (a.tipo === 'aovivo' && a.quando ? ' · ' + dataHora(a.quando) : '') + '</small>' +
              (est.gerenciar ? '<span class="grupo-botoes"><button class="btn mini fantasma" data-a="ed-aula" data-m="' + m.id + '" data-aula="' + a.id + '">Editar</button>' + (ai > 0 ? '<button class="btn mini fantasma" data-a="sobe-aula" data-m="' + m.id + '" data-aula="' + a.id + '">↑</button>' : '') + '<button class="btn mini fantasma perigo" data-a="del-aula" data-m="' + m.id + '" data-aula="' + a.id + '">×</button></span>' : '') + '</li>';
          }).join('') + '</ol></details>';
      }).join('') + (!c.modulos.length ? UI.vazio('Sem módulos', est.gerenciar ? 'Clique em <b>+ Módulo</b> e depois adicione as aulas.' : 'O conteúdo ainda está sendo preparado.') : '') +
      '</section><aside class="cartao"><h3>Avalie</h3><div class="ac-estrelas">' + [1, 2, 3, 4, 5].map(function (i) { return '<button class="icone ' + (i <= nota ? 'on' : '') + '" data-nota="' + i + '" aria-label="' + i + ' estrelas">★</button>'; }).join('') + '</div>' +
      '<h3>Materiais do curso</h3>' + (function () { const mats = []; aulas(c).forEach(function (x) { (x.a.materiais || []).forEach(function (mt) { mats.push(mt); }); }); return mats.length ? '<ul class="lista-links">' + mats.map(function (mt) { return '<li>' + linkMaterial(mt) + '</li>'; }).join('') + '</ul>' : '<p class="mudo mini">Nenhum material anexado.</p>'; })() + '</aside></div></div>';
    carregarImagens(el);
    el.onclick = async function (ev) {
      const nt = ev.target.closest('[data-nota]'); if (nt) { e().avaliacoes[c.id] = Number(nt.dataset.nota); salvar(); App.redesenhar(); return; }
      const mat = ev.target.closest('[data-material]'); if (mat) { ev.preventDefault(); abrirMaterial(mat.dataset.material, mat.dataset.nome); return; }
      const b = ev.target.closest('[data-a]'); if (!b) return; ev.preventDefault();
      const m = b.dataset.m && c.modulos.find(function (x) { return x.id === b.dataset.m; }); const a = m && b.dataset.aula && m.aulas.find(function (x) { return x.id === b.dataset.aula; });
      if (b.dataset.a === 'editar') await editarCurso(c);
      if (b.dataset.a === 'excluir' && await confirmar('Excluir', 'Excluir "' + esc(c.titulo) + '" e todas as aulas?', 'Excluir')) { aulas(c).forEach(function (x) { apagarArquivos(x.a); }); e().cursos = e().cursos.filter(function (x) { return x !== c; }); salvar(); location.hash = '#/academy'; return; }
      if (b.dataset.a === 'modulo') { const f = await modal({ titulo: 'Novo módulo', corpo: campo('Título', '<input name="t" required placeholder="ex.: Módulo 1 — Fundamentos">') }); if (f) c.modulos.push({ id: Dados.id('md'), titulo: f.get('t'), aulas: [] }); }
      if (b.dataset.a === 'ren-mod') { const f = await modal({ titulo: 'Renomear módulo', corpo: campo('Título', '<input name="t" value="' + esc(m.titulo) + '">') }); if (f) m.titulo = f.get('t'); }
      if (b.dataset.a === 'sobe-mod') { const i = c.modulos.indexOf(m); c.modulos.splice(i, 1); c.modulos.splice(i - 1, 0, m); }
      if (b.dataset.a === 'del-mod' && await confirmar('Excluir módulo', 'Excluir o módulo "' + esc(m.titulo) + '" e suas aulas?', 'Excluir')) { m.aulas.forEach(apagarArquivos); c.modulos = c.modulos.filter(function (x) { return x !== m; }); }
      if (b.dataset.a === 'aula' || b.dataset.a === 'ed-aula') await editarAula(m, a);
      if (b.dataset.a === 'sobe-aula') { const i = m.aulas.indexOf(a); m.aulas.splice(i, 1); m.aulas.splice(i - 1, 0, a); }
      if (b.dataset.a === 'del-aula' && await confirmar('Excluir aula', 'Excluir a aula "' + esc(a.titulo) + '"?', 'Excluir')) { apagarArquivos(a); m.aulas = m.aulas.filter(function (x) { return x !== a; }); }
      if (b.dataset.a === 'certificado') { certificado(c); return; }
      salvar(); App.redesenhar();
    };
  }

  function linkMaterial(mt) { return mt.link ? '<a href="' + esc(UI.url(mt.link)) + '" target="_blank" rel="noopener">📎 ' + esc(mt.nome) + '</a>' : '<a href="#" data-material="' + mt.arquivo + '" data-nome="' + esc(mt.nome) + '">📎 ' + esc(mt.nome) + '</a>'; }
  async function abrirMaterial(id, nome) { const b = await Dados.lerArquivo(id); if (!b) return aviso('Arquivo não está neste navegador.', 'erro'); UI.abrirArquivo(b, nome); }
  function apagarArquivos(a) { if (a.arquivo) Dados.apagarArquivo(a.arquivo); (a.materiais || []).forEach(function (m) { if (m.arquivo) Dados.apagarArquivo(m.arquivo); }); }

  // ---------- aula ----------
  async function telaAula(el, param) {
    const p = String(param || '').split('/'); const c = curso(p[0]); if (!c) { el.innerHTML = UI.vazio('Aula não encontrada', '', '<a class="btn" href="#/academy">Voltar</a>'); return; }
    const l = aulas(c); const idx = l.findIndex(function (x) { return x.a.id === p[1]; }); const x = l[idx]; if (!x) { location.hash = '#/academy/curso/' + c.id; return; }
    const a = x.a; const pr = e().progresso[a.id] = e().progresso[a.id] || {};
    if (bloqueada(a)) { el.innerHTML = UI.vazio('Aula bloqueada', 'Esta aula será liberada em ' + data(a.liberaEm) + '.', '<a class="btn" href="#/academy/curso/' + c.id + '">Voltar ao curso</a>'); return; }
    e().ultimo = { curso: c.id, aula: a.id, em: new Date().toISOString() }; salvar();
    const ant = l[idx - 1], prox = l[idx + 1]; const pg = progresso(c);
    el.innerHTML = '<div class="academy ac-sala"><div class="ac-palco"><p class="mini"><a href="#/academy">Academy</a> › <a href="#/academy/curso/' + c.id + '">' + esc(c.titulo) + '</a> › ' + esc(x.m.titulo) + '</p>' +
      '<div class="ac-player" id="ac-player"><p class="mudo">Carregando…</p></div>' +
      '<div class="ac-aula-cab"><div><h2>' + esc(a.titulo) + '</h2><p class="mini mudo">' + esc(TIPOS[a.tipo] || '') + (a.duracao ? ' · ' + fmtMin(a.duracao) : '') + '</p></div><div class="grupo-botoes">' +
      (ant ? '<a class="btn" href="#/academy/aula/' + c.id + '/' + ant.a.id + '">‹ Anterior</a>' : '') + '<button class="btn ' + (pr.feita ? '' : 'primario') + '" data-a="feita">' + (pr.feita ? '✓ Concluída' : 'Marcar como concluída') + '</button>' + (prox ? '<a class="btn" href="#/academy/aula/' + c.id + '/' + prox.a.id + '">Próxima ›</a>' : '') + '</div></div>' +
      (a.descricao ? '<div class="md cartao">' + Kanban.markdown(a.descricao) + '</div>' : '') +
      ((a.materiais || []).length ? '<div class="cartao"><h4>Materiais da aula</h4><ul class="lista-links">' + a.materiais.map(function (mt) { return '<li>' + linkMaterial(mt) + '</li>'; }).join('') + '</ul></div>' : '') +
      '<nav class="abas"><a href="#" data-aba="comentarios" class="' + (est.aba === 'comentarios' ? 'ativa' : '') + '">Comentários e dúvidas (' + (e().comentarios[a.id] || []).length + ')</a><a href="#" data-aba="notas" class="' + (est.aba === 'notas' ? 'ativa' : '') + '">Minhas anotações</a></nav>' +
      (est.aba === 'notas' ? '<textarea id="ac-notas" rows="8" placeholder="Suas anotações desta aula (salvas automaticamente)…">' + esc(e().notas[a.id] || '') + '</textarea><p class="mini mudo">Salvo automaticamente.</p>'
        : '<form id="ac-com" class="kitem-novo"><textarea name="t" rows="2" placeholder="Escreva um comentário ou dúvida…" required></textarea><button class="btn primario">Publicar</button></form><ul class="kj-atividade">' + (e().comentarios[a.id] || []).map(function (cm, i) { return '<li><i class="kav" style="background:#b68d40">' + esc(cm.por.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase()) + '</i><div><b>' + esc(cm.por) + '</b> <span class="mini mudo">' + dataHora(cm.em) + '</span><div class="md balao">' + Kanban.markdown(cm.texto) + '</div>' + (cm.por === eu() ? '<a href="#" class="mini" data-del-com="' + i + '">Excluir</a>' : '') + '</div></li>'; }).join('') + '</ul>') +
      '</div><aside class="ac-lista"><div class="ac-prog"><div class="barra"><i style="width:' + pg.pct + '%"></i></div><b>' + pg.pct + '%</b></div>' +
      c.modulos.map(function (m) { return '<h4>' + esc(m.titulo) + '</h4><ol class="ac-aulas mini-lista">' + m.aulas.map(function (aa) { const f = (e().progresso[aa.id] || {}).feita; return '<li class="' + (aa.id === a.id ? 'atual ' : '') + (f ? 'feita' : '') + '"><span class="ac-check">' + (f ? '✓' : bloqueada(aa) ? '🔒' : '○') + '</span>' + (bloqueada(aa) ? esc(aa.titulo) : '<a href="#/academy/aula/' + c.id + '/' + aa.id + '">' + esc(aa.titulo) + '</a>') + '</li>'; }).join('') + '</ol>'; }).join('') + '</aside></div>';
    // player
    const box = el.querySelector('#ac-player');
    if (a.tipo === 'video' || a.tipo === 'audio') {
      const u = await url(a.arquivo);
      if (!u) box.innerHTML = '<div class="vazio"><p>O arquivo desta aula não está neste navegador.</p></div>';
      else {
        box.innerHTML = a.tipo === 'video' ? '<video controls playsinline src="' + u + '"></video>' : '<div class="ac-audio"><span>🎧</span><audio controls src="' + u + '"></audio></div>';
        const m = box.querySelector('video, audio'); let ult = 0;
        m.addEventListener('loadedmetadata', function () { if (pr.pos && pr.pos < m.duration - 5) m.currentTime = pr.pos; if (!a.duracao && isFinite(m.duration)) { a.duracao = Math.round(m.duration / 60); salvar(); } });
        m.addEventListener('timeupdate', function () { if (Math.abs(m.currentTime - ult) > 5) { ult = m.currentTime; pr.pos = m.currentTime; if (!pr.feita && m.duration && m.currentTime / m.duration > 0.9) { pr.feita = true; pr.em = new Date().toISOString(); aviso('Aula concluída ✓'); } salvar(); } });
        m.addEventListener('ended', function () { pr.feita = true; pr.pos = 0; pr.em = pr.em || new Date().toISOString(); salvar(); if (prox) aviso('Próxima aula: ' + prox.a.titulo); });
      }
    } else if (a.tipo === 'link') { const u = embed(a.url); box.innerHTML = u ? '<iframe src="' + esc(u) + '" title="' + esc(a.titulo) + '" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>' : '<div class="vazio"><p>Link não reconhecido. <a href="' + esc(UI.url(a.url)) + '" target="_blank" rel="noopener">Abrir em nova aba ↗</a></p></div>'; }
    else if (a.tipo === 'pdf') { const u = a.arquivo ? await url(a.arquivo) : embed(a.url); box.innerHTML = u ? '<iframe class="ac-pdf" src="' + esc(u) + '" title="' + esc(a.titulo) + '"></iframe>' : '<div class="vazio"><p>Arquivo não encontrado.</p></div>'; }
    else if (a.tipo === 'aovivo') { box.innerHTML = '<div class="ac-aovivo"><span class="ac-selo">Encontro ao vivo</span><h3>' + esc(a.titulo) + '</h3><p>' + (a.quando ? dataHora(a.quando) + ' (' + UI.emQuanto(a.quando) + ')' : 'Data a definir') + '</p>' + (a.url ? '<a class="btn primario" href="' + esc(UI.url(a.url)) + '" target="_blank" rel="noopener">Entrar na sala ↗</a>' : '') + (a.gravacao ? '<p><a href="' + esc(UI.url(a.gravacao)) + '" target="_blank" rel="noopener">Ver gravação ↗</a></p>' : '') + '</div>'; }
    else box.innerHTML = '<div class="ac-texto md">' + Kanban.markdown(a.conteudo || a.descricao || '') + '</div>';
    if (a.tipo === 'texto') box.classList.add('texto');
    // eventos
    const notas = el.querySelector('#ac-notas'); if (notas) notas.oninput = function () { e().notas[a.id] = notas.value; clearTimeout(notas._t); notas._t = setTimeout(salvar, 400); };
    const fc = el.querySelector('#ac-com'); if (fc) fc.onsubmit = function (ev) { ev.preventDefault(); const t = new FormData(fc).get('t').trim(); if (!t) return; (e().comentarios[a.id] = e().comentarios[a.id] || []).unshift({ texto: t, por: eu(), em: new Date().toISOString() }); salvar(); App.redesenhar(); };
    el.onclick = function (ev) {
      const ab = ev.target.closest('[data-aba]'); if (ab) { ev.preventDefault(); est.aba = ab.dataset.aba; App.redesenhar(); return; }
      const dc = ev.target.closest('[data-del-com]'); if (dc) { ev.preventDefault(); e().comentarios[a.id].splice(Number(dc.dataset.delCom), 1); salvar(); App.redesenhar(); return; }
      const mat = ev.target.closest('[data-material]'); if (mat) { ev.preventDefault(); abrirMaterial(mat.dataset.material, mat.dataset.nome); return; }
      if (ev.target.closest('[data-a=feita]')) { pr.feita = !pr.feita; pr.em = new Date().toISOString(); salvar(); if (pr.feita && progresso(c).pct === 100) aviso('Parabéns! Você concluiu "' + c.titulo + '". O certificado está na página do curso.'); if (pr.feita && prox) location.hash = '#/academy/aula/' + c.id + '/' + prox.a.id; else App.redesenhar(); }
    };
  }

  // ---------- edição ----------
  async function editarCurso(c) {
    const x = c || { categoria: est.categoria || 'Cursos', capa: CAPAS[0], publicado: true };
    let capaNova = null;
    const f = await modal({
      titulo: c ? 'Editar conteúdo' : 'Novo conteúdo', largo: true,
      corpo: '<div class="linha">' + campo('Título *', '<input name="titulo" required value="' + esc(x.titulo || '') + '">') + campo('Categoria', '<select name="categoria">' + opcoes(CATEGORIAS, x.categoria) + '</select>') + '</div>' +
        campo('Subtítulo', '<input name="subtitulo" value="' + esc(x.subtitulo || '') + '">') + campo('Quem ministra', '<input name="autor" value="' + esc(x.autor || eu()) + '">') +
        campo('Descrição (aceita Markdown)', '<textarea name="descricao" rows="4">' + esc(x.descricao || '') + '</textarea>') +
        '<fieldset><legend>Capa</legend><div class="kfundos">' + CAPAS.map(function (cp, i) { return '<label><input type="radio" name="capa" value="' + i + '"' + (x.capa === cp ? ' checked' : '') + '><span style="background:' + cp + '"></span></label>'; }).join('') + '</div><p class="mini">ou imagem: <input type="file" accept="image/*" id="ac-capa-arq"> ' + (x.capaArquivo ? '<label class="check"><input type="checkbox" name="semImagem"> remover imagem atual</label>' : '') + '</p></fieldset>' +
        '<label class="check"><input type="checkbox" name="publicado"' + (x.publicado !== false ? ' checked' : '') + '> Publicado (aparece na vitrine)</label>',
      aoAbrir: function (form) { form.querySelector('#ac-capa-arq').onchange = function () { capaNova = this.files[0]; }; }
    });
    if (!f) return null;
    const d = { titulo: f.get('titulo'), categoria: f.get('categoria'), subtitulo: f.get('subtitulo'), autor: f.get('autor'), descricao: f.get('descricao'), publicado: !!f.get('publicado') };
    if (f.get('capa') !== null) d.capa = CAPAS[Number(f.get('capa'))];
    const alvo = c || Object.assign({ id: Dados.id('cs'), modulos: [], criadoEm: new Date().toISOString() }, { capa: CAPAS[e().cursos.length % CAPAS.length] });
    Object.assign(alvo, d);
    if (f.get('semImagem')) { Dados.apagarArquivo(alvo.capaArquivo); alvo.capaArquivo = ''; }
    if (capaNova) { const id = Dados.id('acf'); await Dados.guardarArquivo(id, capaNova); alvo.capaArquivo = id; }
    if (!c) { if (alvo.categoria === 'Dicas' || alvo.categoria === 'Mentorias') alvo.modulos.push({ id: Dados.id('md'), titulo: alvo.categoria === 'Dicas' ? 'Dicas' : 'Encontros', aulas: [] }); e().cursos.push(alvo); }
    salvar(); return alvo;
  }

  async function editarAula(m, a) {
    const x = a || { tipo: m.titulo === 'Encontros' ? 'aovivo' : 'video', materiais: [] };
    let arquivo = null; let mats = [];
    const f = await modal({
      titulo: a ? 'Editar aula' : 'Nova aula em "' + m.titulo + '"', largo: true,
      corpo: '<div class="linha">' + campo('Título *', '<input name="titulo" required value="' + esc(x.titulo || '') + '">') + campo('Tipo', '<select name="tipo" id="ac-tipo">' + opcoes(Object.keys(TIPOS).map(function (k) { return { v: k, t: TIPOS[k] }; }), x.tipo) + '</select>') + campo('Duração (min)', '<input name="duracao" inputmode="numeric" value="' + esc(x.duracao || '') + '">', 'Vídeos e áudios enviados preenchem sozinhos.') + '</div>' +
        '<div data-para="video audio pdf">' + campo('Arquivo', '<input type="file" id="ac-arq">', x.arquivo ? 'Já há um arquivo; escolha outro para substituir.' : 'Fica guardado neste navegador.') + '</div>' +
        '<div data-para="link pdf aovivo">' + campo('Link', '<input name="url" value="' + esc(x.url || '') + '" placeholder="YouTube, Vimeo, Google Drive, Loom ou sala de reunião">') + '</div>' +
        '<div data-para="aovivo"><div class="linha">' + campo('Data e hora', '<input type="datetime-local" name="quando" value="' + esc(x.quando || '') + '">') + campo('Link da gravação', '<input name="gravacao" value="' + esc(x.gravacao || '') + '">') + '</div></div>' +
        '<div data-para="texto">' + campo('Conteúdo (Markdown)', '<textarea name="conteudo" rows="8">' + esc(x.conteudo || '') + '</textarea>') + '</div>' +
        campo('Descrição / resumo (Markdown)', '<textarea name="descricao" rows="3">' + esc(x.descricao || '') + '</textarea>') +
        campo('Materiais complementares', '<input type="file" id="ac-mats" multiple>', (x.materiais || []).length ? 'Atuais: ' + x.materiais.map(function (mt) { return esc(mt.nome); }).join(', ') : '') +
        campo('Liberar a partir de (opcional)', '<input type="date" name="liberaEm" value="' + esc(x.liberaEm || '') + '">', 'Conteúdo com liberação programada.'),
      aoAbrir: function (form) {
        const t = form.querySelector('#ac-tipo'); const mostrar = function () { form.querySelectorAll('[data-para]').forEach(function (d) { d.hidden = d.dataset.para.split(' ').indexOf(t.value) < 0; }); };
        t.onchange = mostrar; mostrar();
        form.querySelector('#ac-arq').onchange = function () { arquivo = this.files[0]; if (arquivo && !form.titulo.value) form.titulo.value = arquivo.name.replace(/\.[^.]+$/, ''); };
        form.querySelector('#ac-mats').onchange = function () { mats = Array.prototype.slice.call(this.files); };
      }
    });
    if (!f) return;
    const alvo = a || { id: Dados.id('au'), materiais: [] };
    ['titulo', 'tipo', 'url', 'quando', 'gravacao', 'conteudo', 'descricao', 'liberaEm'].forEach(function (k) { alvo[k] = f.get(k) || ''; });
    alvo.duracao = Number(f.get('duracao')) || alvo.duracao || 0;
    if (arquivo) { if (alvo.arquivo) Dados.apagarArquivo(alvo.arquivo); const id = Dados.id('acv'); await Dados.guardarArquivo(id, arquivo); alvo.arquivo = id; }
    for (const mt of mats) { const id = Dados.id('acm'); await Dados.guardarArquivo(id, mt); alvo.materiais.push({ id: id, nome: mt.name, arquivo: id }); }
    if (!a) m.aulas.push(alvo);
    aviso('Aula salva.');
  }

  function certificado(c) {
    const w = window.open('', '_blank'); if (!w) return aviso('Permita pop-ups para gerar o certificado.', 'erro');
    const base = location.href.replace(/#.*$/, '').replace(/[^/]*$/, ''); const fim = aulas(c).map(function (x) { return (e().progresso[x.a.id] || {}).em; }).filter(Boolean).sort().pop();
    w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Certificado — ' + esc(c.titulo) + '</title><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800&display=swap" rel="stylesheet"><style>@page{size:A4 landscape;margin:0}body{margin:0;font-family:Montserrat,Arial,sans-serif}.cert{width:297mm;height:210mm;box-sizing:border-box;padding:22mm;background:#050505;color:#f2f2f2;display:flex;flex-direction:column;justify-content:space-between;border:10mm solid #050505;outline:2px solid #b68d40;outline-offset:-14mm}.topo{display:flex;align-items:center;gap:14px}.topo img{height:60px}.topo b{color:#b68d40;font-size:26px;letter-spacing:.06em}.topo small{display:block;color:#b68d40;letter-spacing:.3em;font-size:10px}h1{font-size:40px;color:#b68d40;margin:0;letter-spacing:.1em}.nome{font-size:34px;font-weight:800;margin:8px 0}p{font-size:16px;line-height:1.6;margin:0}.rodape{display:flex;justify-content:space-between;font-size:13px;color:#bbb}</style></head><body><div class="cert"><div class="topo"><img src="' + base + 'img/seven-marca.png" alt=""><div><b>SEVEN</b><small>ACADEMY</small></div></div><div><h1>CERTIFICADO</h1><p>Certificamos que</p><div class="nome">' + esc(eu()) + '</div><p>concluiu <b>' + esc(c.titulo) + '</b>' + (cargaHoraria(c) ? ', com carga horária de ' + fmtMin(cargaHoraria(c)) : '') + ', na Seven Academia.</p></div><div class="rodape"><span>Concluído em ' + (fim ? new Date(fim).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')) + '</span><span>' + esc(c.autor || 'Seven · BPO de Licitações') + '</span></div></div><script>setTimeout(function(){print()},700)<\/script></body></html>');
    w.document.close();
  }

  Telas.academy = {
    titulo: 'Seven Academia',
    render: function (el, sub, param) {
      el.onclick = null;
      if (sub === 'curso') telaCurso(el, param);
      else if (sub === 'aula') telaAula(el, param);
      else vitrine(el);
    },
    embed: embed
  };
})();
