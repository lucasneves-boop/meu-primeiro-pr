/* Seven Comunidade: rede social estilo X para profissionais de licitação. Sincroniza pela mesma infraestrutura do Seven Chat (Firebase Realtime Database). */
(function () {
  'use strict';
  function corOk(c) { return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#8c9bab'; }
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, confirmar, aviso } = UI;
  const A = self.Agora, P = self.Pleiade;
  const CORES = ['#b68d40', '#1f5fbf', '#1f7a4a', '#800000', '#6b4fbf', '#0a7ea4', '#c2410c', '#3b3b3b'];
  const CARGOS = ['Analista de licitações', 'Pregoeiro(a) / agente de contratação', 'Servidor(a) público(a)', 'Advogado(a)', 'Consultor(a)', 'Empresário(a) / fornecedor', 'Contador(a)', 'Estudante', 'Outro'];
  const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
  const DENUNCIAS_OCULTAR = 3;
  const est = { aba: 'paravoce', rascunho: {}, img: {}, enquete: {}, verOcultos: {}, perfilAba: 'posts' };

  function cfg() {
    const d = Dados.e; const pl = d.pleiadeCfg || {};
    d.agoraCfg = d.agoraCfg || { modo: pl.modo === 'firebase' ? 'firebase' : 'local', url: pl.url || '', token: pl.token || '', comunidade: 'licitantes', eu: null, vistoNotif: 0, silenciados: {}, bloqueados: {}, salvos: {} };
    const c = d.agoraCfg; ['silenciados', 'bloqueados', 'salvos'].forEach(function (k) { c[k] = c[k] || {}; }); return c;
  }
  function eu() { return cfg().eu; }

  // ---------- transporte (mesmo formato do Seven Chat) ----------
  const T = {
    arv: {}, fonte: null, conectado: false, erro: '', iniciado: false, base: '',
    remoto: function () { return cfg().modo === 'firebase' && !!cfg().url; },
    iniciar: function () {
      if (this.fonte) { this.fonte.close(); this.fonte = null; }
      const c = cfg(); this.iniciado = true; this.erro = ''; this.conectado = false;
      if (this.remoto()) {
        this.base = c.url.replace(/\/+$/, '').replace(/\.json$/, '') + '/agora/' + P.slug(c.comunidade || 'licitantes');
        this.arv = JSON.parse(JSON.stringify(Dados.e.agoraCache || {}));
        try {
          const src = this.fonte = new EventSource(this.base + '.json' + (c.token ? '?auth=' + encodeURIComponent(c.token) : ''));
          const me = this;
          const ev = function (tipo) { return function (m) { let d; try { d = JSON.parse(m.data); } catch (err) { return; } if (!d) return; me.conectado = true; me.arv = P.aplicarEvento(me.arv, tipo, d) || {}; me.mudou(); }; };
          src.addEventListener('put', ev('put')); src.addEventListener('patch', ev('patch'));
          src.addEventListener('cancel', function () { me.erro = 'Acesso negado pelas regras do banco.'; me.conectado = false; agendar(); });
          src.onerror = function () { me.conectado = false; me.erro = 'Sem conexão (tentando de novo…)'; agendar(); };
          src.onopen = function () { me.erro = ''; };
        } catch (err) { this.erro = err.message; }
      } else { this.arv = Dados.e.agora || {}; Dados.e.agora = this.arv; this.conectado = true; }
    },
    url: function (caminho) { const c = cfg(); return this.base + '/' + String(caminho).replace(/^\/+/, '') + '.json' + (c.token ? '?auth=' + encodeURIComponent(c.token) : ''); },
    enviar: function (metodo, caminho, valor) {
      if (!this.remoto()) { Dados.salvar(); return Promise.resolve(); }
      return fetch(this.url(caminho), { method: metodo, headers: { 'Content-Type': 'application/json' }, body: metodo === 'DELETE' ? undefined : JSON.stringify(valor) })
        .then(function (r) { if (!r.ok) throw new Error('servidor respondeu ' + r.status); }).catch(function (err) { aviso('Seven Comunidade: não foi possível salvar (' + err.message + ').', 'erro'); });
    },
    set: function (caminho, valor) { this.arv = P.definir(this.arv, caminho, valor); if (!this.remoto()) Dados.e.agora = this.arv; this.mudou(); return this.enviar(valor == null ? 'DELETE' : 'PUT', caminho, valor); },
    patch: function (caminho, obj) { this.arv = P.mesclar(this.arv, caminho, obj); if (!this.remoto()) Dados.e.agora = this.arv; this.mudou(); return this.enviar('PATCH', caminho, obj); },
    mudou: function () { if (this.remoto()) { clearTimeout(this._c); this._c = setTimeout(function () { Dados.e.agoraCache = T.arv; Dados.salvar(); }, 1500); } agendar(); }
  };
  function arv() { if (!T.iniciado) T.iniciar(); return T.arv; }
  function perfis() { return arv().perfis || {}; }
  function posts() { return arv().posts || {}; }
  function seguir() { return arv().seguir || {}; }
  function perfil(uid) { return perfis()[uid] || { nome: 'Perfil removido', handle: 'removido', cor: '#8c9bab' }; }
  function porHandle(h) { const ps = perfis(); return Object.keys(ps).find(function (k) { return ps[k].handle === h; }); }
  function handles() { const r = {}; const ps = perfis(); Object.keys(ps).forEach(function (k) { r[ps[k].handle] = k; }); return r; }
  function ocultos() { return Object.assign({}, cfg().silenciados, cfg().bloqueados); }
  function sigo(uid) { return !!((seguir()[eu()] || {})[uid]); }

  let redT = null;
  function agendar() {
    clearTimeout(redT);
    redT = setTimeout(function () { atualizarSelo(); if (/^#\/agora/.test(location.hash) && !document.querySelector('.modal-fundo')) redesenharPreservando(); }, 80);
  }
  function redesenharPreservando() {
    const a = document.activeElement; const k = a && a.dataset && a.dataset.rasc; const ini = k ? a.selectionStart : 0;
    App.redesenhar();
    if (k) { const n = document.querySelector('[data-rasc="' + k + '"]'); if (n) { n.focus(); try { n.setSelectionRange(ini, ini); } catch (e) { /* campo sem seleção */ } } }
  }
  function naoVistas() { if (!eu()) return 0; const v = cfg().vistoNotif || 0; return A.notificacoes(arv(), eu(), perfil(eu()).handle).filter(function (x) { return x.em > v && !ocultos()[x.u]; }).length; }
  function atualizarSelo() {
    const a = document.querySelector('.menu a[data-rota="agora"]'); if (!a) return;
    let s = a.querySelector('.pl-selo'); const nv = naoVistas();
    if (!s) { s = document.createElement('b'); s.className = 'pl-selo'; a.appendChild(s); }
    s.textContent = nv > 99 ? '99+' : nv; s.hidden = !nv;
  }

  // ---------- peças ----------
  function avatar(uid, tam) {
    const m = perfil(uid); tam = tam || 40;
    return '<a class="go-av" href="#/agora/u/' + esc(m.handle) + '" style="background:' + corOk(m.cor) + ';width:' + tam + 'px;height:' + tam + 'px;font-size:' + Math.round(tam / 2.5) + 'px" aria-label="Perfil de ' + esc(m.nome) + '">' + esc((m.nome || '?').split(' ').map(function (x) { return x[0]; }).slice(0, 2).join('').toUpperCase()) + '</a>';
  }
  function nomeLinha(uid, extra) {
    const m = perfil(uid);
    return '<span class="go-nome"><a href="#/agora/u/' + esc(m.handle) + '"><b>' + esc(m.nome) + '</b></a>' + (m.cargo ? '<span class="go-cargo" title="' + esc(m.cargo) + '">' + esc(cargoCurto(m.cargo)) + '</span>' : '') + ' <span class="go-h">@' + esc(m.handle) + '</span>' + (extra || '') + '</span>';
  }
  function cargoCurto(c) { return String(c).split(' / ')[0].replace(/\(a\)/g, ''); }
  function denuncias(p) { return Object.keys(p.denuncias || {}).length; }

  function enqueteHTML(p) {
    const e = A.enquete(p, eu()); if (!e) return '';
    const mostrar = e.encerrada || e.meuVoto != null || p.u === eu();
    return '<div class="go-enq">' + e.opcoes.map(function (o, i) {
      return mostrar ? '<div class="go-enq-r' + (e.meuVoto === i ? ' meu' : '') + '"><i style="width:' + o.pct + '%"></i><span>' + esc(o.t) + (e.meuVoto === i ? ' ✓' : '') + '</span><b>' + o.pct + '%</b></div>'
        : '<button class="go-enq-b" data-ag="votar" data-i="' + i + '">' + esc(o.t) + '</button>';
    }).join('') + '<p class="mini mudo">' + e.total + ' voto' + (e.total === 1 ? '' : 's') + ' · ' + (e.encerrada ? 'Resultado final' : 'termina ' + new Date(e.fim).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</p></div>';
  }

  function citado(pid) {
    const q = posts()[pid];
    if (!q || q.apagado) return '<div class="go-cit go-cit-x">Este post não está mais disponível.</div>';
    return '<a class="go-cit" href="#/agora/post/' + esc(pid) + '"><div class="go-cit-cab">' + avatar(q.u, 20).replace(/^<a/, '<span').replace(/<\/a>$/, '</span>') + ' <b>' + esc(perfil(q.u).nome) + '</b> <span class="go-h">@' + esc(perfil(q.u).handle) + ' · ' + A.tempoRelativo(q.em) + '</span></div><div class="go-txt">' + A.esc(q.t).slice(0, 400).replace(/\n/g, '<br>') + '</div>' + (q.img ? '<img class="go-img" src="' + esc(q.img) + '" alt="">' : '') + '</a>';
  }

  function cartao(p, o) {
    o = o || {}; const meu = p.u === eu();
    if (p.apagado) return '<article class="go-post go-apagado">Este post foi apagado pelo autor.</article>';
    if (denuncias(p) >= DENUNCIAS_OCULTAR && !est.verOcultos[p.id] && !meu) return '<article class="go-post go-apagado" data-pid="' + esc(p.id) + '">Post oculto após denúncias da comunidade. <button class="btn mini fantasma" data-ag="ver-oculto">Mostrar</button></article>';
    const c = A.contagens(posts(), p);
    const curti = !!(p.curtidas || {})[eu()], repostei = !!(p.reposts || {})[eu()], salvo = !!cfg().salvos[p.id];
    const pai = p.resp && posts()[p.resp];
    return '<article class="go-post' + (o.foco ? ' go-foco' : '') + (o.fio ? ' go-fio' : '') + '" data-pid="' + esc(p.id) + '">' +
      (o.por ? '<p class="go-rep">🔁 ' + (o.por === eu() ? 'Você repostou' : esc(perfil(o.por).nome) + ' repostou') + '</p>' : p.fixado && o.perfil ? '<p class="go-rep">📌 Fixado</p>' : '') +
      '<div class="go-post-g">' + avatar(p.u, o.foco ? 48 : 40) + '<div class="go-post-c">' +
      '<header>' + nomeLinha(p.u, o.foco ? '' : ' <span class="go-h">· <a class="go-tempo" href="#/agora/post/' + esc(p.id) + '" title="' + new Date(p.em).toLocaleString('pt-BR') + '">' + A.tempoRelativo(p.em) + '</a></span>') + '<button class="go-mais" data-ag="menu" aria-label="Mais opções">⋯</button></header>' +
      (pai && !o.fio ? '<p class="go-em-resp">Respondendo a <a href="#/agora/u/' + esc(perfil(pai.u).handle) + '">@' + esc(perfil(pai.u).handle) + '</a></p>' : '') +
      '<div class="go-txt' + (o.foco ? ' grande' : '') + '">' + A.formatar(p.t, handles()) + '</div>' +
      (p.img ? '<img class="go-img" src="' + esc(p.img) + '" alt="Imagem do post" loading="lazy">' : '') +
      enqueteHTML(p) + (p.cit ? citado(p.cit) : '') +
      (o.foco ? '<p class="go-quando">' + new Date(p.em).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', year: 'numeric' }) + (p.editado ? ' · editado' : '') + '</p>' : (p.editado ? '<p class="mini mudo">editado</p>' : '')) +
      '<footer class="go-acoes">' +
      '<button data-ag="responder" title="Responder" aria-label="Responder, ' + c.respostas + '">💬 <span>' + (c.respostas || '') + '</span></button>' +
      '<button data-ag="repost" class="' + (repostei ? 'on-rep' : '') + '" title="Repostar ou citar" aria-label="Repostar, ' + c.reposts + '">🔁 <span>' + (c.reposts || '') + '</span></button>' +
      '<button data-ag="curtir" class="' + (curti ? 'on-cur' : '') + '" title="Curtir" aria-pressed="' + curti + '" aria-label="Curtir, ' + c.curtidas + '">' + (curti ? '♥' : '♡') + ' <span>' + (c.curtidas || '') + '</span></button>' +
      '<button data-ag="salvar" class="' + (salvo ? 'on-sal' : '') + '" title="' + (salvo ? 'Remover dos salvos' : 'Salvar') + '" aria-pressed="' + salvo + '">' + (salvo ? '🔖' : '🏷️') + '</button>' +
      '<button data-ag="copiar" title="Copiar link">⤴</button></footer></div></div></article>';
  }

  // ---------- compositor ----------
  function anel(len) {
    const r = 10, c = 2 * Math.PI * r, f = Math.min(1, len / A.LIMITE), resto = A.LIMITE - len;
    const cor = resto < 0 ? 'var(--perigo)' : resto <= 20 ? 'var(--alerta)' : 'var(--ouro)';
    return '<span class="go-anel" aria-live="polite"><svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="' + r + '" fill="none" stroke="var(--borda)" stroke-width="2.5"/><circle cx="12" cy="12" r="' + r + '" fill="none" stroke="' + cor + '" stroke-width="2.5" stroke-dasharray="' + (c * f) + ' ' + c + '" transform="rotate(-90 12 12)"/></svg>' + (resto <= 20 ? '<b style="color:' + cor + '">' + resto + '</b>' : '') + '</span>';
  }
  function compositor(chave, o) {
    o = o || {}; const t = est.rascunho[chave] || ''; const en = est.enquete[chave]; const im = est.img[chave];
    const len = A.comprimento(t);
    return '<form class="go-comp" data-comp="' + esc(chave) + '"' + (o.resp ? ' data-resp="' + esc(o.resp) + '"' : '') + (o.cit ? ' data-cit="' + esc(o.cit) + '"' : '') + '>' + avatar(eu(), 40) + '<div class="go-comp-c">' +
      '<textarea data-rasc="' + esc(chave) + '" rows="' + (o.resp ? 1 : 2) + '" placeholder="' + esc(o.ph || 'O que está acontecendo nas licitações?') + '" aria-label="Escrever post">' + esc(t) + '</textarea>' +
      (im ? '<div class="go-comp-img"><img src="' + esc(im) + '" alt=""><button type="button" data-ag="tirar-img" aria-label="Remover imagem">×</button></div>' : '') +
      (en ? '<div class="go-comp-enq">' + en.opcoes.map(function (x, i) { return '<input data-enq="' + i + '" maxlength="25" placeholder="Opção ' + (i + 1) + (i > 1 ? ' (opcional)' : '') + '" value="' + esc(x) + '">'; }).join('') + (en.opcoes.length < 4 ? '<button type="button" class="btn mini fantasma" data-ag="enq-mais">+ opção</button>' : '') + '<label>Duração <select data-enq-dur>' + opcoes([{ v: '1', t: '1 hora' }, { v: '24', t: '1 dia' }, { v: '72', t: '3 dias' }, { v: '168', t: '7 dias' }], String(en.horas)) + '</select></label><button type="button" class="btn mini fantasma perigo" data-ag="enq-tirar">Remover enquete</button></div>' : '') +
      (o.cit ? citado(o.cit) : '') +
      '<div class="go-comp-barra"><div><button type="button" data-ag="img" title="Imagem" aria-label="Adicionar imagem">🖼</button>' + (o.resp || o.cit ? '' : '<button type="button" data-ag="enq" title="Enquete" aria-label="Adicionar enquete">📊</button>') + '</div>' + anel(len) + '<button class="btn primario go-postar"' + ((!t.trim() && !im) || len > A.LIMITE ? ' disabled' : '') + '>' + (o.resp ? 'Responder' : 'Postar') + '</button></div></div></form>';
  }

  async function publicar(form) {
    const ch = form.dataset.comp; const t = (est.rascunho[ch] || '').trim(); const im = est.img[ch]; const en = est.enquete[ch];
    if ((!t && !im) || A.comprimento(t) > A.LIMITE) return;
    const p = { u: eu(), t: t, em: Date.now() };
    if (form.dataset.resp) p.resp = form.dataset.resp;
    if (form.dataset.cit) p.cit = form.dataset.cit;
    if (im) p.img = im;
    if (en) { const ops = en.opcoes.map(function (x) { return x.trim(); }).filter(Boolean); if (ops.length < 2) { aviso('A enquete precisa de pelo menos 2 opções.', 'erro'); return; } p.enquete = { opcoes: ops, fim: Date.now() + en.horas * 36e5 }; }
    const pid = A.id();
    delete est.rascunho[ch]; delete est.img[ch]; delete est.enquete[ch];
    await T.set('posts/' + pid, p);
    aviso(p.resp ? 'Resposta publicada.' : 'Post publicado.');
    return pid;
  }

  function lerImagem() {
    return UI.escolherArquivo('image/*').then(function (f) {
      if (!f) return null;
      return new Promise(function (ok) {
        const r = new FileReader(); r.onload = function () {
          const im = new Image(); im.onload = function () {
            const max = 1200, k = Math.min(1, max / Math.max(im.width, im.height));
            const cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
            cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
            const url = cv.toDataURL('image/jpeg', .82);
            if (url.length > 900 * 1024) { aviso('Imagem grande demais mesmo após reduzir.', 'erro'); ok(null); } else ok(url);
          }; im.onerror = function () { aviso('Não consegui ler a imagem.', 'erro'); ok(null); }; im.src = r.result;
        }; r.readAsDataURL(f);
      });
    });
  }

  // ---------- perfil (entrada) ----------
  async function formPerfil(atual) {
    const lista = Object.keys(perfis()).map(function (k) { return Object.assign({ id: k }, perfis()[k]); });
    const novo = !atual; const m = atual || { cor: CORES[lista.length % CORES.length], uf: (Dados.empresaAtiva() || {}).uf || 'GO', nome: (Dados.e.config && Dados.e.config.responsavel) || '' };
    const r = await modal({
      titulo: novo ? 'Entrar na Seven Comunidade' : 'Editar perfil', botao: novo ? 'Entrar' : 'Salvar', semCancelar: novo && !eu(), largo: true,
      corpo: (novo ? '<p>A Seven Comunidade é a praça pública dos profissionais de licitação: poste, comente, debata e siga quem entende do assunto.</p>' + (lista.length ? campo('Já tenho perfil nesta comunidade', '<select name="existente"><option value="">— sou novo —</option>' + opcoes(lista.map(function (x) { return { v: x.id, t: x.nome + ' @' + x.handle }; })) + '</select>') : '') : '') +
        '<div class="linha">' + campo('Nome *', '<input name="nome" value="' + esc(m.nome || '') + '" maxlength="50">') + campo('@usuário', '<input name="handle" value="' + esc(m.handle || '') + '" maxlength="15" placeholder="gerado do nome" pattern="[a-z0-9_]*">', 'Letras minúsculas, números e _') + '</div>' +
        '<div class="linha">' + campo('Atuação', '<select name="cargo">' + opcoes(CARGOS, m.cargo || CARGOS[0]) + '</select>') + campo('Empresa ou órgão', '<input name="empresa" value="' + esc(m.empresa || '') + '" maxlength="60">') + campo('UF', '<select name="uf">' + opcoes(UFS, m.uf) + '</select>') + '</div>' +
        campo('Bio', '<textarea name="bio" rows="2" maxlength="160">' + esc(m.bio || '') + '</textarea>') +
        '<fieldset><legend>Cor do avatar</legend><div class="go-cores">' + CORES.map(function (c) { return '<label><input type="radio" name="cor" value="' + c + '"' + (c === m.cor ? ' checked' : '') + '><i style="background:' + c + '"></i></label>'; }).join('') + '</div></fieldset>' +
        (novo ? '<label class="check"><input type="checkbox" name="regras"> Concordo com as regras de convivência: debate respeitoso, sem ataques pessoais, sem dados pessoais de terceiros nem informações sigilosas de processos.</label>' : ''),
      validar: function (fd) {
        if (fd.get('existente')) return '';
        if (!String(fd.get('nome') || '').trim()) return 'Digite seu nome.';
        const h = String(fd.get('handle') || '').trim().toLowerCase();
        if (h && !/^[a-z0-9_]{2,15}$/.test(h)) return '@usuário: 2 a 15 caracteres (a-z, 0-9, _).';
        const dono = h && porHandle(h); if (dono && (!atual || dono !== eu())) return '@' + h + ' já está em uso.';
        if (novo && !fd.get('regras')) return 'Aceite as regras de convivência para entrar.';
        return '';
      }
    });
    if (!r) return false;
    const c = cfg();
    if (r.get('existente')) { c.eu = r.get('existente'); Dados.salvar(); return true; }
    const dados = { nome: r.get('nome').trim(), handle: (r.get('handle').trim().toLowerCase()) || A.handleLivre(r.get('nome'), perfis()), cargo: r.get('cargo'), empresa: r.get('empresa').trim(), uf: r.get('uf'), bio: r.get('bio').trim(), cor: r.get('cor') || CORES[0] };
    if (novo) { const uid = 'u' + A.id(); dados.criadoEm = Date.now(); c.eu = uid; Dados.salvar(); await T.set('perfis/' + uid, dados); }
    else await T.patch('perfis/' + eu(), dados);
    return true;
  }

  // ---------- molduras ----------
  function nav(rota) {
    const nv = naoVistas(); const me = perfil(eu());
    const it = function (r, ic, t, extra) { return '<a href="#/agora' + (r ? '/' + r : '') + '" class="' + (rota === r ? 'ativo' : '') + '"><span class="go-ic">' + ic + '</span><span class="go-nt">' + t + '</span>' + (extra || '') + '</a>'; };
    return '<nav class="go-nav" aria-label="Seven Comunidade"><a class="go-marca" href="#/agora" aria-label="Seven Comunidade — início">Ἀ<span>Seven Comunidade</span></a>' +
      it('', '⌂', 'Página inicial') + it('explorar', '⌕', 'Explorar') + it('notificacoes', '🔔', 'Notificações', nv ? '<b class="go-badge">' + (nv > 99 ? '99+' : nv) + '</b>' : '') + it('salvos', '🔖', 'Salvos') + it('u/' + me.handle, '👤', 'Perfil') + it('config', '⚙', 'Configurações') +
      '<button class="btn primario go-btn-postar" data-ag="novo-post"><span class="go-nt">Postar</span><span class="go-ic">✎</span></button>' +
      '<div class="go-eu">' + avatar(eu(), 36) + '<div><b>' + esc(me.nome) + '</b><small>@' + esc(me.handle) + '</small></div><span class="go-con' + (T.conectado ? ' ok' : '') + '" title="' + esc(T.erro || (T.remoto() ? 'Conectado à comunidade' : 'Modo local: só este navegador')) + '">●</span></div></nav>';
  }
  function lateral() {
    const tr = A.tendencias(posts(), { limite: 6 });
    const sug = A.quemSeguir(perfis(), seguir(), eu(), posts(), 3).filter(function (u) { return !ocultos()[u]; });
    return '<aside class="go-lado"><form class="go-pesq" id="go-pesq" role="search"><input name="q" placeholder="Buscar na Seven Comunidade" aria-label="Buscar"></form>' +
      '<section class="go-box"><h3>O que está acontecendo</h3>' + (tr.length ? tr.map(function (t, i) { return '<a class="go-trend" href="#/agora/tag/' + encodeURIComponent(t.tag) + '"><small>' + (i + 1) + ' · Assunto do momento</small><b>#' + esc(t.tag) + '</b><small>' + t.posts + ' post' + (t.posts > 1 ? 's' : '') + ' · ' + t.autores + ' pessoa' + (t.autores > 1 ? 's' : '') + '</small></a>'; }).join('') : '<p class="mini mudo">Use #hashtags nos posts (ex.: #Lei14133, #pregão, #SRP) para aparecerem aqui.</p>') + '</section>' +
      (sug.length ? '<section class="go-box"><h3>Quem seguir</h3>' + sug.map(function (u) { const m = perfil(u); return '<div class="go-sug" data-uid="' + esc(u) + '">' + avatar(u, 40) + '<div><a href="#/agora/u/' + esc(m.handle) + '"><b>' + esc(m.nome) + '</b></a><small>@' + esc(m.handle) + (m.cargo ? ' · ' + esc(cargoCurto(m.cargo)) : '') + '</small></div><button class="btn mini" data-ag="seguir">Seguir</button></div>'; }).join('') + '</section>' : '') +
      '<p class="go-rodape">Regras: respeito, sem dados pessoais de terceiros e sem informação sigilosa de processos. Denuncie o que violar.</p></aside>';
  }
  function moldura(rota, centro) {
    return '<div class="go">' + nav(rota) + '<main class="go-centro">' + centro + '</main>' + lateral() + '</div>';
  }
  function cab(titulo, sub, voltar) { return '<header class="go-cab">' + (voltar ? '<button class="go-voltar" data-ag="voltar" aria-label="Voltar">←</button>' : '') + '<div><h2>' + titulo + '</h2>' + (sub ? '<small>' + sub + '</small>' : '') + '</div></header>'; }
  function listaItens(itens, o) { return itens.length ? itens.map(function (x) { return cartao(x.post || x, Object.assign({ por: x.por }, o || {})); }).join('') : ''; }

  // ---------- telas ----------
  function telaInicio() {
    const itens = A.feed(posts(), { modo: est.aba, eu: eu(), seguindo: seguir()[eu()] || {}, ocultos: ocultos(), limite: 200 });
    return cab('Página inicial') + '<div class="go-abas" role="tablist"><button role="tab" data-ag="aba" data-v="paravoce" aria-selected="' + (est.aba === 'paravoce') + '" class="' + (est.aba === 'paravoce' ? 'ativa' : '') + '">Para você</button><button role="tab" data-ag="aba" data-v="seguindo" aria-selected="' + (est.aba === 'seguindo') + '" class="' + (est.aba === 'seguindo' ? 'ativa' : '') + '">Seguindo</button></div>' +
      compositor('inicio') + (itens.length ? listaItens(itens) : '<div class="go-vazio"><h3>' + (est.aba === 'seguindo' ? 'Siga profissionais para ver os posts deles aqui' : 'Seja a primeira voz da comunidade') + '</h3><p>' + (est.aba === 'seguindo' ? 'Use "Quem seguir" ou Explorar.' : 'Conte uma vitória, tire uma dúvida sobre um edital, comente uma decisão do TCU.') + '</p></div>');
  }
  function telaPost(pid) {
    const p = posts()[pid];
    if (!p) return cab('Post', '', true) + '<div class="go-vazio"><h3>Este post não existe</h3><p>Ele pode ter sido apagado.</p></div>';
    const cadeia = []; let x = p; const vistos = {};
    while (x && x.resp && posts()[x.resp] && !vistos[x.resp]) { vistos[x.resp] = 1; cadeia.unshift(Object.assign({ id: x.resp }, posts()[x.resp])); x = posts()[x.resp]; }
    const resps = A.respostasDe(posts(), pid).filter(function (r) { return !ocultos()[r.u]; });
    return cab('Post', '', true) + cadeia.map(function (c) { return cartao(c, { fio: true }); }).join('') + cartao(Object.assign({ id: pid }, p), { foco: true }) +
      (p.apagado ? '' : compositor('resp-' + pid, { resp: pid, ph: 'Poste sua resposta' })) + listaItens(resps);
  }
  function telaPerfil(h) {
    const uid = porHandle(h);
    if (!uid) return cab('Perfil', '', true) + '<div class="go-vazio"><h3>Esta conta não existe</h3><p>Tente buscar outro @.</p></div>';
    const m = perfil(uid); const meu = uid === eu();
    const seguidores = A.seguidoresDe(seguir(), uid).length, seguindo = Object.keys(seguir()[uid] || {}).length;
    const npost = A.lista(posts()).filter(function (p) { return p.u === uid && !p.apagado; }).length;
    const meSegue = !!((seguir()[uid] || {})[eu()]);
    const bloq = cfg().bloqueados[uid], sil = cfg().silenciados[uid];
    const itens = bloq ? [] : A.doPerfil(posts(), uid, est.perfilAba);
    return cab(esc(m.nome), npost + ' post' + (npost === 1 ? '' : 's'), true) +
      '<section class="go-perfil" data-uid="' + esc(uid) + '"><div class="go-capa" style="background:linear-gradient(120deg,' + corOk(m.cor) + ',#0a1929)"></div><div class="go-perfil-c">' + avatar(uid, 96) +
      '<div class="go-perfil-ac">' + (meu ? '<button class="btn" data-ag="editar-perfil">Editar perfil</button>' : '<button class="btn mini fantasma" data-ag="menu-perfil" aria-label="Mais opções">⋯</button>' + (bloq ? '<button class="btn perigo" data-ag="desbloquear">Desbloquear</button>' : '<button class="btn ' + (sigo(uid) ? 'go-seguindo' : 'primario') + '" data-ag="seguir">' + (sigo(uid) ? 'Seguindo' : 'Seguir') + '</button>')) + '</div>' +
      '<h2>' + esc(m.nome) + '</h2><p class="go-h">@' + esc(m.handle) + (meSegue && !meu ? ' <span class="go-segue-voce">Segue você</span>' : '') + '</p>' + (m.bio ? '<p>' + A.formatar(m.bio, handles()) + '</p>' : '') +
      '<p class="go-meta">' + [m.cargo ? '💼 ' + esc(m.cargo) : '', m.empresa ? '🏢 ' + esc(m.empresa) : '', m.uf ? '📍 ' + esc(m.uf) : '', m.criadoEm ? '📅 Entrou em ' + new Date(m.criadoEm).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : ''].filter(Boolean).join(' · ') + '</p>' +
      '<p class="go-segs"><button class="go-link" data-ag="lista-seguindo"><b>' + seguindo + '</b> Seguindo</button> <button class="go-link" data-ag="lista-seguidores"><b>' + seguidores + '</b> Seguidores</button></p>' +
      (sil ? '<p class="mini alerta">Você silenciou este perfil. <button class="go-link" data-ag="dessilenciar">Desfazer</button></p>' : '') + '</div></section>' +
      '<div class="go-abas" role="tablist">' + [['posts', 'Posts'], ['respostas', 'Respostas'], ['midia', 'Mídia'], ['curtidas', 'Curtidas']].map(function (a) { return '<button role="tab" data-ag="perfil-aba" data-v="' + a[0] + '" aria-selected="' + (est.perfilAba === a[0]) + '" class="' + (est.perfilAba === a[0] ? 'ativa' : '') + '">' + a[1] + '</button>'; }).join('') + '</div>' +
      (bloq ? '<div class="go-vazio"><h3>Você bloqueou @' + esc(m.handle) + '</h3></div>' : listaItens(itens, { perfil: true }) || '<div class="go-vazio"><p>Nada por aqui ainda.</p></div>');
  }
  function telaExplorar(q) {
    const tr = A.tendencias(posts(), { limite: 10, horas: 24 * 7 });
    const r = A.buscar(posts(), perfis(), q);
    return cab('Explorar') + '<form class="go-pesq go-pesq-g" id="go-pesq2" role="search"><input name="q" value="' + esc(q || '') + '" placeholder="Buscar posts, pessoas ou #hashtags" aria-label="Buscar"></form>' +
      (q ? (r.perfis.length ? '<h3 class="go-sec">Pessoas</h3>' + r.perfis.map(function (u) { return '<div class="go-sug go-sug-l" data-uid="' + esc(u.id) + '">' + avatar(u.id, 44) + '<div><a href="#/agora/u/' + esc(u.handle) + '"><b>' + esc(u.nome) + '</b></a><small>@' + esc(u.handle) + (u.cargo ? ' · ' + esc(u.cargo) : '') + (u.empresa ? ' · ' + esc(u.empresa) : '') + '</small>' + (u.bio ? '<p class="mini">' + esc(u.bio) + '</p>' : '') + '</div>' + (u.id === eu() ? '' : '<button class="btn mini' + (sigo(u.id) ? '' : ' primario') + '" data-ag="seguir">' + (sigo(u.id) ? 'Seguindo' : 'Seguir') + '</button>') + '</div>'; }).join('') : '') +
        '<h3 class="go-sec">Posts</h3>' + (r.posts.length ? listaItens(r.posts.filter(function (p) { return !ocultos()[p.u]; })) : '<div class="go-vazio"><p>Nenhum post com "' + esc(q) + '".</p></div>')
        : '<h3 class="go-sec">Assuntos da semana</h3>' + (tr.length ? tr.map(function (t, i) { return '<a class="go-trend go-trend-l" href="#/agora/tag/' + encodeURIComponent(t.tag) + '"><small>' + (i + 1) + ' · Licitações</small><b>#' + esc(t.tag) + '</b><small>' + t.posts + ' posts</small></a>'; }).join('') : '<div class="go-vazio"><p>Ainda sem hashtags na semana.</p></div>'));
  }
  function telaTag(tag) {
    const r = A.buscar(posts(), perfis(), '#' + tag).posts.filter(function (p) { return !ocultos()[p.u]; });
    return cab('#' + esc(tag), r.length + ' post' + (r.length === 1 ? '' : 's'), true) + (r.length ? listaItens(r) : '<div class="go-vazio"><p>Nenhum post com #' + esc(tag) + '.</p></div>');
  }
  function telaNotificacoes() {
    const ns = A.notificacoes(arv(), eu(), perfil(eu()).handle).filter(function (x) { return !ocultos()[x.u]; }).slice(0, 200);
    const visto = cfg().vistoNotif || 0;
    const ICONE = { curtida: '♥', repost: '🔁', resposta: '💬', citacao: '❝', mencao: '@', seguiu: '👤' };
    const TXT = { curtida: 'curtiu seu post', repost: 'repostou seu post', resposta: 'respondeu', citacao: 'citou seu post', mencao: 'mencionou você', seguiu: 'seguiu você' };
    const html = cab('Notificações') + (ns.length ? ns.map(function (x) {
      const p = x.post && posts()[x.post];
      return '<a class="go-notif' + (x.em > visto ? ' nova' : '') + '" href="' + (x.post ? '#/agora/post/' + esc(x.post) : '#/agora/u/' + esc(perfil(x.u).handle)) + '"><span class="go-notif-ic ic-' + x.tipo + '">' + ICONE[x.tipo] + '</span><div>' + avatar(x.u, 32).replace(/^<a/, '<span').replace(/<\/a>$/, '</span>') + '<p><b>' + esc(perfil(x.u).nome) + '</b> ' + TXT[x.tipo] + ' <span class="go-h">· ' + A.tempoRelativo(x.em) + '</span></p>' + (p && !p.apagado ? '<p class="go-notif-t">' + A.esc(p.t).slice(0, 200) + '</p>' : '') + '</div></a>';
    }).join('') : '<div class="go-vazio"><h3>Nada por enquanto</h3><p>Curtidas, respostas, menções e novos seguidores aparecem aqui.</p></div>');
    cfg().vistoNotif = Date.now(); Dados.salvar(); setTimeout(atualizarSelo, 0);
    return html;
  }
  function telaSalvos() {
    const ids = Object.keys(cfg().salvos).sort(function (a, b) { return cfg().salvos[b] - cfg().salvos[a]; });
    const ps = ids.map(function (k) { return posts()[k] ? Object.assign({ id: k }, posts()[k]) : null; }).filter(Boolean);
    return cab('Salvos', 'Só você vê') + (ps.length ? listaItens(ps) : '<div class="go-vazio"><h3>Salve posts para ler depois</h3><p>Toque em 🏷️ em qualquer post.</p></div>');
  }
  function telaConfig() {
    const c = cfg(); const pl = Dados.e.pleiadeCfg || {};
    const lst = function (obj, acao) { const ks = Object.keys(obj); return ks.length ? ks.map(function (u) { return '<div class="go-sug" data-uid="' + esc(u) + '">' + avatar(u, 32) + '<div><b>' + esc(perfil(u).nome) + '</b><small>@' + esc(perfil(u).handle) + '</small></div><button class="btn mini" data-ag="' + acao + '">Desfazer</button></div>'; }).join('') : '<p class="mini mudo">Ninguém.</p>'; };
    return cab('Configurações') + '<div class="go-cfg">' +
      '<form class="cartao" id="go-con"><h3>Conexão da comunidade</h3>' +
      '<label class="co-origem"><input type="radio" name="modo" value="local"' + (c.modo !== 'firebase' ? ' checked' : '') + '><span><b>Local (este navegador)</b><small>Para testar. Os posts ficam só aqui.</small></span></label>' +
      '<label class="co-origem"><input type="radio" name="modo" value="firebase"' + (c.modo === 'firebase' ? ' checked' : '') + '><span><b>Comunidade online (Firebase Realtime Database)</b><small>Todos que usarem o mesmo endereço e comunidade veem o mesmo feed, em tempo real.</small></span></label>' +
      campo('Endereço do banco', '<input name="url" value="' + esc(c.url) + '" placeholder="https://seu-projeto-default-rtdb.firebaseio.com">') +
      '<div class="linha">' + campo('Comunidade', '<input name="comunidade" value="' + esc(c.comunidade) + '">', 'Ex.: licitantes, licitantes-go') + campo('Token (opcional)', '<input name="token" type="password" value="' + esc(c.token) + '">') + '</div>' +
      (pl.url ? '<button type="button" class="btn mini fantasma" data-ag="usar-pleiade">Usar a mesma conexão do Seven Chat</button> ' : '') + '<button class="btn primario">Salvar conexão</button>' +
      '<p class="mini mudo">Os dados ficam em <code>/agora/&lt;comunidade&gt;</code> do mesmo banco usado pelo Seven Chat. Nas regras do Firebase, libere leitura e escrita desse caminho só para usuários autenticados.</p></form>' +
      '<section class="cartao"><h3>Sua conta</h3><p>' + esc(perfil(eu()).nome) + ' @' + esc(perfil(eu()).handle) + '</p><button class="btn" data-ag="editar-perfil">Editar perfil</button> <button class="btn fantasma" data-ag="trocar">Trocar de perfil</button></section>' +
      '<section class="cartao"><h3>Silenciados</h3><p class="mini mudo">Posts deles somem do seu feed; eles não sabem.</p>' + lst(c.silenciados, 'dessilenciar') + '<h3>Bloqueados</h3>' + lst(c.bloqueados, 'desbloquear') + '</section></div>';
  }

  // ---------- ações ----------
  async function menuPost(p) {
    const meu = p.u === eu(); const m = perfil(p.u);
    const ops = meu ? [{ v: 'fixar', t: p.fixado ? 'Desafixar do perfil' : 'Fixar no perfil' }].concat(A.podeEditar(p, eu()) ? [{ v: 'editar', t: 'Editar (até 1 h após postar)' }] : []).concat([{ v: 'apagar', t: 'Apagar post' }])
      : [{ v: 'seguir', t: (sigo(p.u) ? 'Deixar de seguir' : 'Seguir') + ' @' + m.handle }, { v: 'silenciar', t: 'Silenciar @' + m.handle }, { v: 'bloquear', t: 'Bloquear @' + m.handle }, { v: 'denunciar', t: 'Denunciar post' }];
    const r = await modal({ titulo: 'Opções do post', botao: 'OK', corpo: ops.map(function (o, i) { return '<label class="check go-op"><input type="radio" name="op" value="' + o.v + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(o.t) + '</label>'; }).join('') });
    if (!r) return;
    const op = r.get('op');
    if (op === 'apagar' && await confirmar('Apagar post', 'Apagar este post? Respostas e citações continuam, mas ele some.', 'Apagar')) await T.set('posts/' + p.id, Object.assign({}, posts()[p.id], { t: '', img: null, enquete: null, apagado: true, curtidas: null, reposts: null }));
    if (op === 'editar') { const e2 = await modal({ titulo: 'Editar post', corpo: campo('Texto', '<textarea name="t" rows="4" maxlength="2000">' + esc(p.t) + '</textarea>'), validar: function (fd) { const t = fd.get('t').trim(); return !t ? 'O post não pode ficar vazio.' : A.comprimento(t) > A.LIMITE ? 'Passou de ' + A.LIMITE + ' caracteres.' : ''; } }); if (e2) await T.patch('posts/' + p.id, { t: e2.get('t').trim(), editado: Date.now() }); }
    if (op === 'fixar') { const outros = A.lista(posts()).filter(function (x) { return x.u === eu() && x.fixado && x.id !== p.id; }); for (const o of outros) await T.set('posts/' + o.id + '/fixado', null); await T.set('posts/' + p.id + '/fixado', p.fixado ? null : true); }
    if (op === 'seguir') await alternarSeguir(p.u);
    if (op === 'silenciar') { cfg().silenciados[p.u] = Date.now(); Dados.salvar(); aviso('@' + m.handle + ' silenciado.'); App.redesenhar(); }
    if (op === 'bloquear' && await confirmar('Bloquear @' + esc(m.handle), 'Você deixa de ver os posts e notificações desse perfil e deixa de segui-lo.', 'Bloquear')) { cfg().bloqueados[p.u] = Date.now(); Dados.salvar(); if (sigo(p.u)) await T.set('seguir/' + eu() + '/' + p.u, null); aviso('@' + m.handle + ' bloqueado.'); App.redesenhar(); }
    if (op === 'denunciar') {
      const d = await modal({ titulo: 'Denunciar post', botao: 'Enviar denúncia', corpo: '<p class="mini mudo">Com ' + DENUNCIAS_OCULTAR + ' denúncias de pessoas diferentes, o post fica oculto para a comunidade.</p>' + ['Ataque pessoal ou assédio', 'Dados pessoais de terceiros', 'Informação sigilosa de processo', 'Spam ou propaganda enganosa', 'Desinformação'].map(function (x, i) { return '<label class="check"><input type="radio" name="m" value="' + x + '"' + (i === 0 ? ' checked' : '') + '> ' + x + '</label>'; }).join('') });
      if (d) { await T.set('posts/' + p.id + '/denuncias/' + eu(), { m: d.get('m'), em: Date.now() }); aviso('Denúncia registrada. Obrigado.'); }
    }
  }
  async function alternarSeguir(uid) {
    if (uid === eu()) return;
    if (cfg().bloqueados[uid]) { aviso('Desbloqueie o perfil para seguir.', 'erro'); return; }
    await T.set('seguir/' + eu() + '/' + uid, sigo(uid) ? null : Date.now());
  }
  async function listaPessoas(uid, tipo) {
    const ids = tipo === 'seguidores' ? A.seguidoresDe(seguir(), uid) : Object.keys(seguir()[uid] || {});
    await modal({ titulo: tipo === 'seguidores' ? 'Seguidores' : 'Seguindo', botao: 'Fechar', semCancelar: true, corpo: ids.length ? ids.map(function (u) { const m = perfil(u); return '<div class="go-sug">' + avatar(u, 36) + '<div><a href="#/agora/u/' + esc(m.handle) + '" data-fechar><b>' + esc(m.nome) + '</b></a><small>@' + esc(m.handle) + '</small></div></div>'; }).join('') : '<p class="mudo">Ninguém ainda.</p>',
      aoAbrir: function (f) { f.querySelectorAll('[data-fechar]').forEach(function (a) { a.addEventListener('click', function () { const b = f.closest('.modal-fundo'); if (b) b.remove(); }); }); } });
  }

  function ligar(el, rota, param) {
    el.oninput = function (ev) {
      const t = ev.target;
      if (t.dataset.rasc != null) {
        const ch = t.dataset.rasc; est.rascunho[ch] = t.value;
        t.style.height = 'auto'; t.style.height = Math.min(400, t.scrollHeight) + 'px';
        const f = t.closest('form'); const len = A.comprimento(t.value);
        f.querySelector('.go-anel').outerHTML = anel(len);
        f.querySelector('.go-postar').disabled = (!t.value.trim() && !est.img[ch]) || len > A.LIMITE;
      }
      if (t.dataset.enq != null) { const ch = t.closest('form').dataset.comp; est.enquete[ch].opcoes[Number(t.dataset.enq)] = t.value; }
    };
    el.onchange = function (ev) { const t = ev.target; if (t.dataset.enqDur != null) { est.enquete[t.closest('form').dataset.comp].horas = Number(t.value); } };
    el.onkeydown = function (ev) { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && ev.target.dataset.rasc != null) { ev.preventDefault(); const f = ev.target.closest('form'); if (!f.querySelector('.go-postar').disabled) f.requestSubmit(); } };
    if (!el.__agSubmit) { el.__agSubmit = true; el.addEventListener('submit', function (ev) { if (/^#\/agora/.test(location.hash) && el.__agEnviar) el.__agEnviar(ev); }); }
    el.__agEnviar = async function (ev) {
      const f = ev.target;
      if (f.classList.contains('go-comp')) { ev.preventDefault(); const pid = await publicar(f); if (pid && f.dataset.cit) location.hash = '#/agora'; return; }
      if (f.id === 'go-pesq' || f.id === 'go-pesq2') { ev.preventDefault(); const q = new FormData(f).get('q').trim(); location.hash = q[0] === '#' && q.length > 1 ? '#/agora/tag/' + encodeURIComponent(A.normalizar(q.slice(1))) : '#/agora/explorar/' + encodeURIComponent(q); return; }
      if (f.id === 'go-con') {
        ev.preventDefault(); const d = new FormData(f); const c = cfg();
        Object.assign(c, { modo: d.get('modo'), url: d.get('url').trim(), token: d.get('token').trim(), comunidade: P.slug(d.get('comunidade')) || 'licitantes' });
        if (c.modo === 'firebase' && !/^https:\/\//.test(c.url)) { aviso('Informe o endereço https:// do banco.', 'erro'); return; }
        Dados.e.agoraCache = {}; Dados.salvar(); T.iniciar(); aviso('Conexão salva.'); App.redesenhar();
      }
    };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-ag]');
      const card = ev.target.closest('.go-post[data-pid]');
      if (!b) {
        if (card && !ev.target.closest('a,button,input,textarea,select,img.go-img') && !card.classList.contains('go-foco') && !window.getSelection().toString()) location.hash = '#/agora/post/' + card.dataset.pid;
        return;
      }
      const a = b.dataset.ag; const pid = card && card.dataset.pid; const p = pid && Object.assign({ id: pid }, posts()[pid]);
      const form = b.closest('form.go-comp'); const ch = form && form.dataset.comp;
      const uidEl = b.closest('[data-uid]'); const uid = uidEl && uidEl.dataset.uid;
      if (a === 'aba') { est.aba = b.dataset.v; App.redesenhar(); }
      if (a === 'perfil-aba') { est.perfilAba = b.dataset.v; App.redesenhar(); }
      if (a === 'voltar') { if (history.length > 1) history.back(); else location.hash = '#/agora'; }
      if (a === 'novo-post') { const f = el.querySelector('[data-rasc="inicio"]'); if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); } else { location.hash = '#/agora'; setTimeout(function () { const g = document.querySelector('[data-rasc="inicio"]'); if (g) g.focus(); }, 50); } }
      if (a === 'curtir' && p) await T.set('posts/' + pid + '/curtidas/' + eu(), (p.curtidas || {})[eu()] ? null : Date.now());
      if (a === 'salvar' && p) { const s = cfg().salvos; if (s[pid]) delete s[pid]; else s[pid] = Date.now(); Dados.salvar(); aviso(s[pid] ? 'Post salvo.' : 'Removido dos salvos.'); App.redesenhar(); }
      if (a === 'copiar' && p) { const u = location.href.split('#')[0] + '#/agora/post/' + pid; try { await navigator.clipboard.writeText(u); aviso('Link copiado.'); } catch (e) { aviso(u); } }
      if (a === 'responder' && p) { if (rota === 'post' && param === pid) { const t = el.querySelector('[data-rasc="resp-' + pid + '"]'); if (t) t.focus(); } else location.hash = '#/agora/post/' + pid; }
      if (a === 'repost' && p) {
        const ja = (p.reposts || {})[eu()];
        const r = await modal({ titulo: 'Repostar', botao: 'Continuar', corpo: '<label class="check go-op"><input type="radio" name="op" value="rep" checked> ' + (ja ? 'Desfazer repost' : 'Repostar') + '</label><label class="check go-op"><input type="radio" name="op" value="cit"> Citar (comentar junto)</label>' });
        if (!r) return;
        if (r.get('op') === 'rep') await T.set('posts/' + pid + '/reposts/' + eu(), ja ? null : Date.now());
        else {
          const chave = 'cit-' + pid;
          const q = await modal({ titulo: 'Citar post', botao: 'Postar', largo: true, corpo: '<textarea name="t" rows="3" maxlength="2000" placeholder="Adicione um comentário" aria-label="Comentário"></textarea>' + citado(pid), validar: function (fd) { const t = fd.get('t').trim(); return !t ? 'Escreva um comentário.' : A.comprimento(t) > A.LIMITE ? 'Passou de ' + A.LIMITE + ' caracteres.' : ''; } });
          if (q) { await T.set('posts/' + A.id(), { u: eu(), t: q.get('t').trim(), em: Date.now(), cit: pid }); delete est.rascunho[chave]; aviso('Post publicado.'); }
        }
      }
      if (a === 'votar' && p && p.enquete && !A.enquete(p, eu()).encerrada) await T.set('posts/' + pid + '/enquete/votos/' + eu(), Number(b.dataset.i));
      if (a === 'menu' && p) await menuPost(p);
      if (a === 'ver-oculto') { est.verOcultos[pid] = true; App.redesenhar(); }
      if (a === 'img' && form) { const im = await lerImagem(); if (im) { est.img[ch] = im; App.redesenhar(); } }
      if (a === 'tirar-img' && form) { delete est.img[ch]; App.redesenhar(); }
      if (a === 'enq' && form) { est.enquete[ch] = { opcoes: ['', ''], horas: 24 }; App.redesenhar(); }
      if (a === 'enq-mais' && form) { est.enquete[ch].opcoes.push(''); App.redesenhar(); }
      if (a === 'enq-tirar' && form) { delete est.enquete[ch]; App.redesenhar(); }
      if (a === 'seguir') { const alvo = uid || (el.querySelector('.go-perfil') || {}).dataset && el.querySelector('.go-perfil').dataset.uid; if (alvo) await alternarSeguir(alvo); }
      const perfilUid = (el.querySelector('.go-perfil') || { dataset: {} }).dataset.uid;
      if (a === 'menu-perfil' && perfilUid) {
        const m = perfil(perfilUid);
        const r = await modal({ titulo: '@' + m.handle, botao: 'OK', corpo: ['silenciar', 'bloquear'].map(function (o, i) { return '<label class="check go-op"><input type="radio" name="op" value="' + o + '"' + (i === 0 ? ' checked' : '') + '> ' + (o === 'silenciar' ? (cfg().silenciados[perfilUid] ? 'Desfazer silenciar' : 'Silenciar') : 'Bloquear') + ' @' + esc(m.handle) + '</label>'; }).join('') });
        if (r && r.get('op') === 'silenciar') { if (cfg().silenciados[perfilUid]) delete cfg().silenciados[perfilUid]; else cfg().silenciados[perfilUid] = Date.now(); Dados.salvar(); App.redesenhar(); }
        if (r && r.get('op') === 'bloquear' && await confirmar('Bloquear @' + esc(m.handle), 'Você deixa de ver os posts desse perfil e deixa de segui-lo.', 'Bloquear')) { cfg().bloqueados[perfilUid] = Date.now(); Dados.salvar(); if (sigo(perfilUid)) await T.set('seguir/' + eu() + '/' + perfilUid, null); App.redesenhar(); }
      }
      if (a === 'desbloquear') { delete cfg().bloqueados[uid || perfilUid]; Dados.salvar(); App.redesenhar(); }
      if (a === 'dessilenciar') { delete cfg().silenciados[uid || perfilUid]; Dados.salvar(); App.redesenhar(); }
      if (a === 'lista-seguindo' || a === 'lista-seguidores') await listaPessoas(perfilUid, a === 'lista-seguidores' ? 'seguidores' : 'seguindo');
      if (a === 'editar-perfil') { if (await formPerfil(Object.assign({}, perfil(eu())))) App.redesenhar(); }
      if (a === 'trocar') { cfg().eu = null; Dados.salvar(); App.redesenhar(); }
      if (a === 'usar-pleiade') { const pl = Dados.e.pleiadeCfg || {}; const f = el.querySelector('#go-con'); f.url.value = pl.url || ''; f.token.value = pl.token || ''; f.querySelector('[value=firebase]').checked = true; }
    };
  }

  Telas.agora = {
    titulo: 'Seven Comunidade',
    render: async function (el, sub, param) {
      arv();
      if (eu() && !perfis()[eu()] && T.remoto() && !T.conectado && sub !== 'config') { el.innerHTML = '<div class="go-vazio go-boas"><h2>Seven Comunidade</h2><p>Conectando à comunidade…</p>' + (T.erro ? '<p class="alerta">' + esc(T.erro) + '</p><a class="btn" href="#/agora/config">Configurações</a>' : '') + '</div>'; return; }
      if ((!eu() || !perfis()[eu()]) && !(sub === 'config' && eu())) {
        if (eu()) { cfg().eu = null; Dados.salvar(); }
        el.innerHTML = '<div class="go-vazio go-boas"><h2>Seven Comunidade</h2><p>A rede dos profissionais de licitação.</p></div>';
        if (!document.querySelector('.modal-fundo') && await formPerfil(null)) App.redesenhar();
        return;
      }
      const telas = { '': telaInicio, explorar: telaExplorar, tag: telaTag, post: telaPost, u: telaPerfil, notificacoes: telaNotificacoes, salvos: telaSalvos, config: telaConfig };
      const rota = telas[sub] ? sub : '';
      const ativo = rota === 'u' && param === perfil(eu()).handle ? 'u/' + param : rota;
      if (rota !== 'u') est.perfilAba = rota === '' ? est.perfilAba : 'posts';
      el.innerHTML = moldura(ativo, telas[rota](param));
      ligar(el, rota, param);
      el.querySelectorAll('textarea[data-rasc]').forEach(function (t) { if (t.value) { t.style.height = 'auto'; t.style.height = Math.min(400, t.scrollHeight) + 'px'; } });
      atualizarSelo();
    }
  };
  // selo de notificações no menu mesmo fora da tela
  setTimeout(function () { if (Dados.e.agoraCfg && Dados.e.agoraCfg.eu) { arv(); atualizarSelo(); } }, 500);
})();
