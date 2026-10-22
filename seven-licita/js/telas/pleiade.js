/* Plêiade: comunicação interna no estilo Slack. Canais, mensagens diretas, threads, menções, reações, arquivos e busca.
   Modo local (só este navegador) ou modo equipe, sincronizado em tempo real por um Firebase Realtime Database. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, confirmar, aviso } = UI;
  const P = Pleiade;
  const CORES = ['#b68d40', '#579dff', '#4bce97', '#f87168', '#9f8fef', '#fea362', '#6cc3e0', '#f29ac6', '#0a1929', '#800000'];
  const STATUS_PRONTOS = [['🔨', 'Em sessão de pregão'], ['📄', 'Montando proposta'], ['📞', 'Em reunião'], ['🚗', 'Em deslocamento'], ['🤒', 'Doente'], ['🌴', 'De férias']];
  const EMOJI_GRADE = ['👍', '✅', '👀', '🎉', '🔥', '🙏', '😄', '😂', '❤️', '👏', '💯', '🤔', '😢', '⚠️', '❌', '⏰', '🚀', '🔨', '📄', '📌', '💰', '🏆', '💪', '☕'];
  const est = { canal: null, thread: null, painel: null, rascunho: {}, scroll: {}, busca: '', editando: null, auto: null, novasDe: {} };

  // ---------- configuração local de quem usa (não sincroniza) ----------
  function cfg() { const d = Dados.e; d.pleiadeCfg = d.pleiadeCfg || { modo: 'local', url: '', espaco: 'seven', token: '', eu: null, lidos: {}, threadsLidas: {}, salvos: {} }; return d.pleiadeCfg; }
  function eu() { return cfg().eu; }

  // ---------- transporte: espelho local da árvore + sincronização ----------
  const T = {
    arv: {}, fonte: null, conectado: false, erro: '', iniciado: false, base: '',
    iniciar: function () {
      if (this.fonte) { this.fonte.close(); this.fonte = null; }
      const c = cfg(); this.iniciado = true; this.erro = ''; this.conectado = false;
      if (c.modo === 'firebase' && c.url) {
        this.base = c.url.replace(/\/+$/, '').replace(/\.json$/, '') + '/pleiade/' + P.slug(c.espaco || 'seven');
        this.arv = JSON.parse(JSON.stringify(Dados.e.pleiadeCache || {}));
        try {
          const src = this.fonte = new EventSource(this.base + '.json' + (c.token ? '?auth=' + encodeURIComponent(c.token) : ''));
          const self_ = this;
          const ev = function (tipo) { return function (m) { let d; try { d = JSON.parse(m.data); } catch (err) { return; } if (!d) return; self_.conectado = true; self_.arv = P.aplicarEvento(self_.arv, tipo, d) || {}; self_.mudou(d); }; };
          src.addEventListener('put', ev('put')); src.addEventListener('patch', ev('patch'));
          src.addEventListener('cancel', function () { self_.erro = 'Acesso negado pelas regras do banco.'; self_.conectado = false; agendar(); });
          src.addEventListener('auth_revoked', function () { self_.erro = 'Token expirado.'; self_.conectado = false; agendar(); });
          src.onerror = function () { self_.conectado = false; self_.erro = 'Sem conexão com o servidor (tentando de novo…)'; agendar(); };
          src.onopen = function () { self_.erro = ''; };
        } catch (err) { this.erro = err.message; }
      } else { this.arv = Dados.e.pleiade || {}; Dados.e.pleiade = this.arv; this.conectado = true; }
    },
    remoto: function () { return cfg().modo === 'firebase' && !!cfg().url; },
    url: function (caminho) { const c = cfg(); return this.base + '/' + String(caminho).replace(/^\/+/, '') + '.json' + (c.token ? '?auth=' + encodeURIComponent(c.token) : ''); },
    enviar: function (metodo, caminho, valor) {
      if (!this.remoto()) { Dados.salvar(); return Promise.resolve(); }
      return fetch(this.url(caminho), { method: metodo, headers: { 'Content-Type': 'application/json' }, body: metodo === 'DELETE' ? undefined : JSON.stringify(valor) })
        .then(function (r) { if (!r.ok) throw new Error('servidor respondeu ' + r.status); }).catch(function (err) { aviso('Plêiade: não foi possível salvar no servidor (' + err.message + ').', 'erro'); });
    },
    set: function (caminho, valor) { this.arv = P.definir(this.arv, caminho, valor); if (!this.remoto()) Dados.e.pleiade = this.arv; this.mudou(); return this.enviar(valor == null ? 'DELETE' : 'PUT', caminho, valor); },
    patch: function (caminho, obj) { this.arv = P.mesclar(this.arv, caminho, obj); if (!this.remoto()) Dados.e.pleiade = this.arv; this.mudou(); return this.enviar('PATCH', caminho, obj); },
    ouvintes: [],
    mudou: function (ev) { this.ouvintes.forEach(function (f) { try { f(); } catch (err) { console.error(err); } }); if (this.remoto()) { clearTimeout(this._c); this._c = setTimeout(function () { Dados.e.pleiadeCache = T.arv; Dados.salvar(); }, 1500); } if (ev) notificarNovas(); agendar(); }
  };
  function arv() { if (!T.iniciado) T.iniciar(); return T.arv; }
  function membros() { return arv().membros || {}; }
  function canais() { return arv().canais || {}; }
  function msgs(cid) { return (arv().mensagens || {})[cid] || {}; }
  function membro(uid) { return membros()[uid] || { nome: 'Desconhecido', cor: '#8c9bab' }; }
  function ctx() { return { eu: eu(), membros: membros(), canais: canais() }; }
  function vejo(c, cid) { return c && !c.arquivado && (!c.privado && !c.dm || (c.membros || {})[eu()]) && (!c.dm || (c.membros || {})[eu()]) && cid; }
  function souMembro(c) { return !!(c && (c.membros || {})[eu()]); }
  function nomeCanal(cid) { const c = canais()[cid]; if (!c) return cid; if (c.dm) { const outros = Object.keys(c.membros || {}).filter(function (u) { return u !== eu(); }); return outros.length ? outros.map(function (u) { return membro(u).nome; }).join(', ') : membro(eu()).nome + ' (você)'; } return c.nome; }
  function prefixo(c) { return c.dm ? '' : c.privado ? '🔒 ' : '# '; }
  function ativo(uid) { const m = membros()[uid]; return m && m.visto && Date.now() - m.visto < 3 * 6e4; }
  function avatar(uid, tam) { const m = membro(uid); return '<span class="pl-av" style="background:' + (/^#[0-9a-f]{3,8}$/i.test(m.cor || '') ? m.cor : '#8c9bab') + (tam ? ';width:' + tam + 'px;height:' + tam + 'px;font-size:' + Math.round(tam / 2.4) + 'px' : '') + '">' + esc((m.nome || '?').split(' ').map(function (p) { return p[0]; }).slice(0, 2).join('').toUpperCase()) + '</span>'; }
  function hora(ts) { return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function diaTxt(ts) { const d = new Date(ts), h = new Date(); const o = new Date(); o.setDate(h.getDate() - 1); if (d.toDateString() === h.toDateString()) return 'Hoje'; if (d.toDateString() === o.toDateString()) return 'Ontem'; return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }); }

  // Redesenho agrupado (eventos do servidor chegam em rajadas).
  let redesenhoT;
  function agendar() { clearTimeout(redesenhoT); redesenhoT = setTimeout(function () { atualizarSelo(); if (/^#\/pleiade/.test(location.hash) && !document.querySelector('.modal-fundo')) App.redesenhar(); }, 60); }
  function totalNaoLidas() { let n = 0, men = 0; Object.keys(canais()).forEach(function (cid) { const c = canais()[cid]; if (!vejo(c, cid) || (!souMembro(c) && !c.dm)) return; const r = P.naoLidas(msgs(cid), cfg().lidos[cid], eu()); if (c.dm) men += r.n; else men += r.mencoes; n += r.n; }); return { n: n, mencoes: men }; }
  function atualizarSelo() { const a = document.querySelector('.menu a[data-rota="pleiade"]'); if (!a || !eu()) return; let s = a.querySelector('.pl-selo'); const t = totalNaoLidas(); if (!s) { s = document.createElement('b'); s.className = 'pl-selo'; a.appendChild(s); } s.textContent = t.mencoes || (t.n ? '•' : ''); s.hidden = !t.mencoes && !t.n; }
  let vistoGlobal = Date.now();
  function notificarNovas() {
    if (!eu()) return; let maior = vistoGlobal; const M = arv().mensagens || {};
    Object.keys(M).forEach(function (cid) { const c = canais()[cid]; if (!vejo(c, cid)) return; Object.keys(M[cid]).forEach(function (k) { const m = M[cid][k]; if (m.em <= vistoGlobal || m.u === eu()) return; maior = Math.max(maior, m.em);
      const pra_mim = c.dm || P.mencoes(m.t).indexOf(eu()) >= 0 || (P.mencionaTodos(m.t) && souMembro(c));
      const vendo = document.visibilityState === 'visible' && location.hash === '#/pleiade/c/' + cid;
      if (pra_mim && !vendo) { const tit = (c.dm ? membro(m.u).nome : membro(m.u).nome + ' em #' + c.nome); const corpo = P.textoPuro(m.t, ctx()).slice(0, 140); aviso('💬 ' + tit + ': ' + corpo); try { if ('Notification' in window && Notification.permission === 'granted') new Notification(tit, { body: corpo, icon: 'img/seven-marca.png' }); } catch (err) { /* sem notificação */ } } }); });
    vistoGlobal = maior;
  }

  // ---------- primeiro acesso ----------
  async function apresentar() {
    const nomePadrao = (Dados.e.config && Dados.e.config.responsavel) || '';
    const lista = Object.keys(membros()).map(function (k) { return Object.assign({ id: k }, membros()[k]); });
    const r = await modal({ titulo: 'Bem-vindo à Plêiade', botao: 'Entrar', semCancelar: true, corpo: '<p>A Plêiade é o canal de conversa da equipe: canais por assunto, mensagens diretas, threads e menções.</p>' + (lista.length ? campo('Já tenho perfil neste espaço', '<select name="existente"><option value="">— sou novo —</option>' + opcoes(lista.map(function (m) { return { v: m.id, t: m.nome + (m.cargo ? ' · ' + m.cargo : '') }; })) + '</select>') : '') + '<div class="linha">' + campo('Seu nome', '<input name="nome" value="' + esc(nomePadrao) + '" placeholder="ex.: Lucas Neves">') + campo('Cargo', '<input name="cargo" placeholder="ex.: Analista de licitações">') + '</div><fieldset><legend>Cor</legend><div class="ag-cores">' + CORES.map(function (c, i) { return '<label><input type="radio" name="cor" value="' + c + '"' + (i === lista.length % CORES.length ? ' checked' : '') + '><i style="background:' + c + '"></i></label>'; }).join('') + '</div></fieldset>',
      validar: function (fd) { return fd.get('existente') || fd.get('nome').trim() ? '' : 'Digite seu nome.'; } });
    if (!r) return false;
    const c = cfg();
    if (r.get('existente')) { c.eu = r.get('existente'); Dados.salvar(); T.patch('membros/' + c.eu, { visto: Date.now() }); return true; }
    c.eu = 'u' + P.id().slice(-10); Dados.salvar();
    await T.set('membros/' + c.eu, { nome: r.get('nome').trim(), cargo: r.get('cargo').trim(), cor: r.get('cor'), entrouEm: Date.now(), visto: Date.now() });
    if (!Object.keys(canais()).length) {
      const base = [['geral', 'Avisos e conversas de toda a equipe'], ['licitacoes', 'Editais, sessões e resultados do dia'], ['cotacoes', 'Fornecedores, preços e cotações em andamento']];
      for (const x of base) { const membrosC = {}; membrosC[c.eu] = true; await T.set('canais/' + x[0], { nome: x[0], descricao: x[1], topico: '', criadoPor: c.eu, criadoEm: Date.now(), membros: membrosC, padrao: true }); }
      await mensagemSistema('geral', '<@' + c.eu + '> criou o espaço da equipe na Plêiade. 👋');
    } else Object.keys(canais()).forEach(function (cid) { if (canais()[cid].padrao) T.set('canais/' + cid + '/membros/' + c.eu, true); });
    return true;
  }
  function emChamada() { return !!(Telas.reuniao && Telas.reuniao.atual()); }
  function cartaoChamada(sid) {
    const s = ((arv().chamadas || {})[sid]) || null; if (!s) return '';
    const ps = Object.keys(s.participantes || {}).filter(function (u) { return Date.now() - (s.participantes[u].visto || 0) < 30000; });
    const ativa = !s.encerrada && ps.length;
    return '<div class="pl-call' + (ativa ? ' ao-vivo' : '') + '"><span class="pl-call-ic">📹</span><div><b>' + esc(s.nome || 'Reunião') + '</b><small>' + (ativa ? ps.length + ' na chamada · ' + ps.map(function (u) { return esc(membro(u).nome.split(' ')[0]); }).join(', ') : 'Chamada encerrada') + '</small></div>' + (ativa || !s.encerrada ? '<a class="btn mini primario" href="#/reuniao/' + esc(sid) + '">Entrar</a>' : '') + '</div>';
  }
  function mensagemSistema(cid, t) { const id = P.id(); return T.set('mensagens/' + cid + '/' + id, { u: eu(), t: t, em: Date.now(), sistema: true }); }

  // ---------- envio ----------
  async function enviar(cid, texto, opc) {
    opc = opc || {}; let t = String(texto || '').trim(); if (!t && !(opc.anexos && opc.anexos.length)) return;
    if (T.remoto()) { T.set('digitando/' + cid + '/' + eu(), null); est.digitou = 0; } // a próxima digitação volta a avisar na hora
    const cmd = P.comando(t);
    if (cmd && !opc.pai) {
      if (cmd.nome === 'tarefa' && Telas.agenda) { const x = Telas.agenda.criar(cmd.arg || 'Nova tarefa'); aviso(x ? '☑ Tarefa criada na Agenda: ' + x.titulo : 'Escreva a tarefa depois de /tarefa'); return; }
      if (cmd.nome === 'status') { const m = cmd.arg.match(/^(\p{Extended_Pictographic}️?)?\s*(.*)$/u) || []; await T.set('membros/' + eu() + '/status', cmd.arg ? { emoji: m[1] || '💬', texto: m[2] || '' } : null); aviso(cmd.arg ? 'Status atualizado.' : 'Status limpo.'); return; }
      if (cmd.nome === 'me') t = '_' + cmd.arg + '_';
      else if (cmd.nome === 'ajuda' || cmd.nome === 'help') { aviso('/tarefa texto · /status 🔨 Em sessão · /me ação'); return; }
    }
    t = P.codificarCanais(P.codificarMencoes(t, membros()), canais());
    const id = P.id(); const m = { u: eu(), t: t, em: Date.now() };
    if (opc.anexos && opc.anexos.length) m.anexos = opc.anexos;
    if (opc.pai) { m.pai = opc.pai; if (opc.tambemCanal) m.tambemCanal = true; }
    await T.set('mensagens/' + cid + '/' + id, m);
    if (opc.pai) { const pai = msgs(cid)[opc.pai]; T.patch('mensagens/' + cid + '/' + opc.pai, { nResp: ((pai && pai.nResp) || 0) + 1, ultResp: m.em, ultU: eu() }); cfg().threadsLidas[cid + '/' + opc.pai] = m.em; }
    cfg().lidos[cid] = m.em; Dados.salvar();
  }
  async function anexar(arqs) {
    const out = [];
    for (const f of arqs) {
      if (T.remoto()) { if (f.size > 750 * 1024) { aviso('"' + f.name + '" passa de 750 KB. No modo equipe, envie arquivos grandes pela Nuvem e cole o link.', 'erro'); continue; } const url = await new Promise(function (ok) { const r = new FileReader(); r.onload = function () { ok(r.result); }; r.readAsDataURL(f); }); out.push({ nome: f.name, tipo: f.type, tam: f.size, dados: url }); }
      else { const aid = 'pl-' + P.id(); await Dados.guardarArquivo(aid, f); out.push({ nome: f.name, tipo: f.type, tam: f.size, arq: aid }); }
    }
    return out;
  }
  async function urlAnexo(a) { if (a.dados) return /^data:(image\/(png|jpe?g|gif|webp)|application\/pdf);base64,/i.test(String(a.dados)) ? a.dados : ''; if (a.arq) { const b = await Dados.lerArquivo(a.arq); return b ? URL.createObjectURL(b) : ''; } return ''; }

  // ---------- desenho ----------
  function lateral() {
    const C = canais(); const cfgL = cfg(); const meu = membro(eu());
    const meus = Object.keys(C).filter(function (k) { return vejo(C[k], k) && !C[k].dm && souMembro(C[k]); }).sort(function (a, b) { return C[a].nome.localeCompare(C[b].nome); });
    const dms = Object.keys(C).filter(function (k) { return vejo(C[k], k) && C[k].dm; }).sort(function (a, b) { return (C[b].ultima || 0) - (C[a].ultima || 0); });
    const item = function (k) { const c = C[k]; const r = P.naoLidas(msgs(k), cfgL.lidos[k], eu()); const n = c.dm ? r.n : r.mencoes; const outro = c.dm && Object.keys(c.membros || {}).find(function (u) { return u !== eu(); });
      return '<li><a href="#/pleiade/c/' + esc(k) + '" class="' + (est.canal === k && !est.vista ? 'ativo ' : '') + (r.n ? 'nl' : '') + '">' + (c.dm ? '<span class="pl-dm-av">' + avatar(outro || eu(), 20) + '<i class="pl-pres' + (ativo(outro || eu()) ? ' on' : '') + '"></i></span>' : '<span class="pl-hash">' + (c.privado ? '🔒' : '#') + '</span>') + '<span class="pl-nome">' + esc(nomeCanal(k)) + '</span>' + (n ? '<b class="pl-cont">' + n + '</b>' : '') + '</a></li>'; };
    const th = P.minhasThreads(arv(), eu(), cfgL.threadsLidas).reduce(function (s, x) { return s + x.novas; }, 0);
    return '<aside class="pl-lado"><header class="pl-espaco"><b>' + esc((cfgL.espaco || 'Seven').replace(/^./, function (x) { return x.toUpperCase(); })) + '</b><small class="pl-con' + (T.conectado ? ' ok' : '') + '" title="' + esc(T.erro || (T.remoto() ? 'Conectado ao servidor da equipe' : 'Modo local: só este navegador')) + '">' + (T.remoto() ? (T.conectado ? '● equipe' : '○ reconectando') : '● local') + '</small><button class="icone" data-pl="nova-dm" title="Nova mensagem" aria-label="Nova mensagem">✎</button></header>' +
      '<ul class="pl-nav"><li><a href="#/pleiade/threads" class="' + (est.vista === 'threads' ? 'ativo' : '') + '">🧵 Threads' + (th ? '<b class="pl-cont">' + th + '</b>' : '') + '</a></li><li><a href="#/pleiade/atividade" class="' + (est.vista === 'atividade' ? 'ativo' : '') + '">@ Menções e reações</a></li><li><a href="#/pleiade/salvos" class="' + (est.vista === 'salvos' ? 'ativo' : '') + '">🔖 Itens salvos</a></li><li><a href="#/pleiade/pessoas" class="' + (est.vista === 'pessoas' ? 'ativo' : '') + '">👥 Pessoas</a></li><li><a href="#/reuniao">📹 Reuniões' + (emChamada() ? '<b class="pl-cont">ao vivo</b>' : '') + '</a></li></ul>' +
      '<h4>Canais <span><button class="icone" data-pl="explorar" title="Explorar canais" aria-label="Explorar canais">⌕</button><button class="icone" data-pl="novo-canal" title="Criar canal" aria-label="Criar canal">＋</button></span></h4><ul class="pl-canais">' + meus.map(item).join('') + '</ul>' +
      '<h4>Mensagens diretas <button class="icone" data-pl="nova-dm" aria-label="Nova mensagem direta">＋</button></h4><ul class="pl-canais">' + dms.map(item).join('') + '</ul>' +
      '<footer class="pl-eu" data-pl="perfil">' + avatar(eu(), 28) + '<div><b>' + esc(meu.nome) + '</b><small>' + (meu.status ? esc(meu.status.emoji + ' ' + meu.status.texto) : 'Definir status') + '</small></div><button class="icone" data-pl="ajustes" title="Conexão e ajustes" aria-label="Ajustes">⚙</button></footer></aside>';
  }

  function linhaMsg(cid, m, opc) {
    opc = opc || {}; const au = membro(m.u); const c = canais()[cid]; const salvo = cfg().salvos[cid + '/' + m.id];
    const reac = Object.keys(m.reacoes || {}).filter(function (e) { return Object.keys(m.reacoes[e] || {}).length; });
    const editando = est.editando === cid + '/' + m.id;
    return (m.novoDia && !opc.semDia ? '<div class="pl-dia"><span>' + esc(diaTxt(m.em)) + '</span></div>' : '') + (opc.novas ? '<div class="pl-novas"><span>Novas mensagens</span></div>' : '') +
      '<div class="pl-msg' + (m.continua && !opc.novas ? ' cont' : '') + (m.sistema ? ' sis' : '') + (m.fixado ? ' fix' : '') + (m.u !== eu() && P.mencoes(m.t).indexOf(eu()) >= 0 ? ' men' : '') + '" data-m="' + esc(m.id) + '" data-c="' + esc(cid) + '">' +
      (m.continua && !opc.novas ? '<span class="pl-hora-mini">' + hora(m.em) + '</span>' : avatar(m.u, 36)) + '<div class="pl-corpo">' +
      (m.continua && !opc.novas ? '' : '<div class="pl-cab"><b>' + esc(au.nome) + '</b>' + (au.status ? '<span title="' + esc(au.status.texto) + '">' + esc(au.status.emoji) + '</span>' : '') + '<time title="' + new Date(m.em).toLocaleString('pt-BR') + '">' + hora(m.em) + '</time>' + (m.fixado ? '<span class="pl-fix-tag">📌 fixada</span>' : '') + (opc.origem ? '<a class="pl-origem" href="#/pleiade/c/' + esc(cid) + '">' + esc(prefixo(c) + nomeCanal(cid)) + '</a>' : '') + '</div>') +
      (editando ? '<form class="pl-editar" data-ed="' + esc(m.id) + '"><textarea rows="2">' + esc(est.editTexto != null ? est.editTexto : P.textoPuro(m.t, ctx())) + '</textarea><div class="grupo-botoes"><button type="button" class="btn mini" data-pl="cancelar-ed">Cancelar</button><button class="btn mini primario">Salvar</button></div></form>' : '<div class="pl-txt">' + P.formatar(m.t, ctx()) + (m.editado ? ' <small class="mudo">(editado)</small>' : '') + '</div>') +
      (m.chamada ? cartaoChamada(m.chamada) : '') +
      (m.tambemCanal && m.pai && !opc.naThread ? '<small class="mudo">respondeu numa thread</small>' : '') +
      (m.anexos ? '<div class="pl-anexos">' + m.anexos.map(function (a, i) { return /^image\//.test(a.tipo) ? '<button class="pl-img" data-anx="' + i + '"><img data-src-anx="' + i + '" alt="' + esc(a.nome) + '"></button>' : '<button class="pl-arq" data-anx="' + i + '"><span>📄</span><div><b>' + esc(a.nome) + '</b><small>' + Math.max(1, Math.round((a.tam || 0) / 1024)) + ' KB</small></div></button>'; }).join('') + '</div>' : '') +
      (reac.length ? '<div class="pl-reacoes">' + reac.map(function (e) { const us = Object.keys(m.reacoes[e]); return '<button class="pl-reac' + (us.indexOf(eu()) >= 0 ? ' minha' : '') + '" data-reac="' + esc(e) + '" title="' + esc(us.map(function (u) { return membro(u).nome; }).join(', ')) + '">' + esc(e) + ' <b>' + us.length + '</b></button>'; }).join('') + '<button class="pl-reac add" data-pl="emoji" aria-label="Adicionar reação">☺+</button></div>' : '') +
      (Number(m.nResp) > 0 && !opc.naThread ? '<button class="pl-resp" data-pl="thread">' + avatar(m.ultU || m.u, 18) + ' <b>' + (Number(m.nResp) || 0) + ' resposta' + (Number(m.nResp) > 1 ? 's' : '') + '</b> <small>última ' + (m.ultResp ? hora(m.ultResp) : '') + '</small></button>' : '') +
      '</div>' + (m.sistema || editando ? '' : '<div class="pl-acoes">' + P.REACOES_RAPIDAS.slice(0, 3).map(function (e) { return '<button data-reac="' + e + '" title="Reagir">' + e + '</button>'; }).join('') + '<button data-pl="emoji" title="Mais reações">☺</button>' + (opc.naThread ? '' : '<button data-pl="thread" title="Responder em thread">💬</button>') + '<button data-pl="salvar" title="' + (salvo ? 'Remover dos salvos' : 'Salvar') + '">' + (salvo ? '🔖' : '🏷️') + '</button><button data-pl="mais" title="Mais ações">⋯</button></div>') + (salvo ? '<span class="pl-salvo-tag">🔖</span>' : '') + '</div>';
  }

  function compositor(cid, pai) {
    const chave = pai ? cid + '/' + pai : cid; const c = canais()[cid];
    const dig = pai ? [] : Object.keys(((arv().digitando || {})[cid]) || {}).filter(function (u) { return u !== eu() && Date.now() - arv().digitando[cid][u] < 6000; });
    return '<form class="pl-comp" data-comp="' + esc(chave) + '"><div class="pl-ferr"><button type="button" data-fmt="*" title="Negrito"><b>B</b></button><button type="button" data-fmt="_" title="Itálico"><i>I</i></button><button type="button" data-fmt="~" title="Riscado"><s>S</s></button><button type="button" data-fmt="`" title="Código">&lt;/&gt;</button><button type="button" data-fmt="- " title="Lista">☰</button><button type="button" data-fmt="&gt; " title="Citação">❝</button></div>' +
      '<textarea rows="1" placeholder="' + esc(pai ? 'Responder…' : 'Mensagem para ' + (c ? prefixo(c) + nomeCanal(cid) : '')) + '" aria-label="Mensagem">' + esc(est.rascunho[chave] || '') + '</textarea>' +
      (pai ? '<label class="pl-tambem"><input type="checkbox" name="tambem"> Também enviar para ' + esc(prefixo(c) + nomeCanal(cid)) + '</label>' : '') +
      '<div class="pl-comp-pe"><span><button type="button" class="icone" data-pl="anexar" title="Anexar arquivo" aria-label="Anexar">📎</button><button type="button" class="icone" data-pl="emoji-comp" title="Emoji" aria-label="Emoji">☺</button><button type="button" class="icone" data-pl="mencionar" title="Mencionar" aria-label="Mencionar">@</button></span><small class="pl-dig">' + (dig.length ? esc(dig.map(function (u) { return membro(u).nome.split(' ')[0]; }).join(', ')) + (dig.length > 1 ? ' estão' : ' está') + ' digitando…' : '<span class="mudo">Enter envia · Shift+Enter quebra linha · /tarefa cria tarefa na Agenda</span>') + '</small><button class="btn mini primario pl-enviar" aria-label="Enviar">➤</button></div><div class="pl-auto" hidden></div></form>';
  }

  function telaCanal(cid) {
    const c = canais()[cid]; const lidoAntes = est.novasDe[cid] || 0;
    const ms = P.agrupar(P.doCanal(msgs(cid))); let marcouNovas = false;
    const corpo = ms.map(function (m) { const novas = !marcouNovas && m.em > lidoAntes && m.u !== eu() && lidoAntes > 0; if (novas) marcouNovas = true; return linhaMsg(cid, m, { novas: novas }); }).join('');
    const nMemb = Object.keys(c.membros || {}).length;
    const intro = '<div class="pl-intro">' + (c.dm ? '<h2>' + esc(nomeCanal(cid)) + '</h2><p>Esta é a conversa direta entre vocês.</p>' : '<h2>' + esc(prefixo(c) + c.nome) + '</h2><p>' + (c.descricao ? esc(c.descricao) + ' · ' : '') + 'Criado por ' + esc(membro(c.criadoPor).nome) + ' em ' + new Date(c.criadoEm || Date.now()).toLocaleDateString('pt-BR') + '.</p>') + '</div>';
    return '<header class="pl-topo"><div><h2>' + esc(prefixo(c) + nomeCanal(cid)) + '</h2>' + (c.topico ? '<small class="pl-topico" data-pl="topico" title="Editar tópico">' + P.formatar(c.topico, ctx()) + '</small>' : (c.dm ? '' : '<small class="pl-topico mudo" data-pl="topico">+ Adicionar tópico</small>')) + '</div><div class="pl-topo-d"><button class="btn mini pl-btn-call" data-pl="chamada" title="Iniciar videochamada neste ' + (c.dm ? 'chat' : 'canal') + '">📹 Chamada</button><button class="btn mini" data-pl="membros" title="Membros">👥 ' + nMemb + '</button><button class="btn mini" data-pl="fixados" title="Mensagens fixadas">📌 ' + P.lista(msgs(cid)).filter(function (m) { return m.fixado; }).length + '</button><button class="btn mini" data-pl="detalhes" title="Detalhes do canal">ⓘ</button></div></header>' +
      '<div class="pl-msgs" id="pl-msgs">' + intro + corpo + '</div>' + (souMembro(c) || c.dm ? compositor(cid) : '<div class="pl-entrar"><p>Você está vendo <b>#' + esc(c.nome) + '</b>.</p><button class="btn primario" data-pl="entrar">Entrar no canal</button></div>');
  }

  function telaThread() {
    const cid = est.thread.c, pid = est.thread.m; const pai = msgs(cid)[pid]; if (!pai) { est.thread = null; return ''; }
    const rs = P.agrupar(P.respostas(msgs(cid), pid)); cfg().threadsLidas[cid + '/' + pid] = Math.max(cfg().threadsLidas[cid + '/' + pid] || 0, rs.length ? rs[rs.length - 1].em : 0);
    return '<aside class="pl-painel"><header><div><b>Thread</b><small>' + esc(prefixo(canais()[cid]) + nomeCanal(cid)) + '</small></div><button class="icone" data-pl="fechar-painel" aria-label="Fechar">×</button></header><div class="pl-msgs pl-msgs-th">' + linhaMsg(cid, Object.assign({ id: pid }, pai), { naThread: true, semDia: true }) + '<div class="pl-th-sep">' + rs.length + ' resposta' + (rs.length === 1 ? '' : 's') + '</div>' + rs.map(function (m) { return linhaMsg(cid, m, { naThread: true, semDia: true }); }).join('') + '</div>' + compositor(cid, pid) + '</aside>';
  }

  function telaDetalhes(cid, aba) {
    const c = canais()[cid]; if (!c) return ''; const mem = Object.keys(c.membros || {});
    const fix = P.lista(msgs(cid)).filter(function (m) { return m.fixado; }); const arqs = []; P.lista(msgs(cid)).forEach(function (m) { (m.anexos || []).forEach(function (a, i) { arqs.push({ m: m, a: a, i: i }); }); });
    return '<aside class="pl-painel"><header><div><b>' + esc(prefixo(c) + nomeCanal(cid)) + '</b></div><button class="icone" data-pl="fechar-painel" aria-label="Fechar">×</button></header><nav class="pilulas">' + [['detalhes', 'Sobre'], ['membros', 'Membros ' + mem.length], ['fixados', 'Fixados ' + fix.length], ['arquivos', 'Arquivos ' + arqs.length]].map(function (x) { return '<button class="pilula ' + (aba === x[0] ? 'ativa' : '') + '" data-pl="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</nav><div class="pl-det">' +
      (aba === 'detalhes' ? (c.dm ? '<p>Conversa direta.</p>' : '<dl><dt>Nome</dt><dd>' + esc(c.nome) + '</dd><dt>Tópico</dt><dd>' + esc(c.topico || '—') + '</dd><dt>Descrição</dt><dd>' + esc(c.descricao || '—') + '</dd><dt>Criado por</dt><dd>' + esc(membro(c.criadoPor).nome) + '</dd></dl><div class="grupo-botoes"><button class="btn mini" data-pl="editar-canal">Editar</button>' + (souMembro(c) ? '<button class="btn mini" data-pl="sair">Sair do canal</button>' : '') + (c.criadoPor === eu() && !c.padrao ? '<button class="btn mini perigo" data-pl="arquivar">Arquivar</button>' : '') + '</div>') : '') +
      (aba === 'membros' ? '<ul class="pl-pessoas">' + mem.map(function (u) { return '<li>' + avatar(u, 28) + '<div><b>' + esc(membro(u).nome) + (u === eu() ? ' (você)' : '') + '</b><small>' + esc(membro(u).cargo || '') + '</small></div><i class="pl-pres' + (ativo(u) ? ' on' : '') + '"></i>' + (c.privado && u !== eu() && souMembro(c) ? '<button class="icone" data-tirar="' + esc(u) + '" aria-label="Remover">×</button>' : '') + '</li>'; }).join('') + '</ul>' + (!c.dm && souMembro(c) ? '<button class="btn mini" data-pl="adicionar-pessoas">+ Adicionar pessoas</button>' : '') : '') +
      (aba === 'fixados' ? (fix.length ? fix.map(function (m) { return '<div class="pl-cartao-msg" data-ir="' + esc(m.id) + '"><b>' + esc(membro(m.u).nome) + '</b> <small>' + new Date(m.em).toLocaleString('pt-BR') + '</small><div>' + P.formatar(m.t, ctx()) + '</div></div>'; }).join('') : '<p class="mudo">Nada fixado. Use ⋯ → Fixar na mensagem.</p>') : '') +
      (aba === 'arquivos' ? (arqs.length ? '<ul class="pl-pessoas">' + arqs.reverse().map(function (x) { return '<li data-m="' + esc(x.m.id) + '" data-c="' + esc(cid) + '"><span>📄</span><div><b>' + esc(x.a.nome) + '</b><small>' + esc(membro(x.m.u).nome) + ' · ' + new Date(x.m.em).toLocaleDateString('pt-BR') + '</small></div><button class="btn mini" data-anx="' + x.i + '">Abrir</button></li>'; }).join('') + '</ul>' : '<p class="mudo">Nenhum arquivo compartilhado.</p>') : '') + '</div></aside>';
  }

  function telaLista(titulo, itens, vazio) {
    return '<header class="pl-topo"><div><h2>' + esc(titulo) + '</h2></div></header><div class="pl-msgs pl-lista">' + (itens.length ? itens.join('') : '<div class="pl-intro"><p class="mudo">' + vazio + '</p></div>') + '</div>';
  }
  function telaThreads() {
    const ths = P.minhasThreads(arv(), eu(), cfg().threadsLidas).filter(function (x) { return vejo(canais()[x.canal], x.canal); });
    return telaLista('Threads', ths.map(function (x) { return '<section class="pl-th-card' + (x.novas ? ' nova' : '') + '"><header><a href="#/pleiade/c/' + esc(x.canal) + '">' + esc(prefixo(canais()[x.canal]) + nomeCanal(x.canal)) + '</a>' + (x.novas ? ' <b class="pl-cont">' + (Number(x.novas) || 0) + ' nova' + (x.novas > 1 ? 's' : '') + '</b>' : '') + '</header>' + linhaMsg(x.canal, Object.assign({}, x.pai, { continua: false }), { naThread: true, semDia: true }) + x.respostas.slice(-2).map(function (r) { return linhaMsg(x.canal, r, { naThread: true, semDia: true }); }).join('') + '<button class="btn mini" data-abrir-th="' + esc(x.canal + '|' + x.pai.id) + '">Responder</button></section>'; }), 'As conversas em threads de que você participa aparecem aqui.');
  }
  function telaAtividade() {
    const at = P.atividade(arv(), eu()).filter(function (x) { return vejo(canais()[x.canal], x.canal); }).slice(0, 100);
    return telaLista('Menções e reações', at.map(function (x) { return '<div class="pl-atv">' + (x.tipo === 'reacao' ? '<p><b>' + esc(membro(x.de).nome) + '</b> reagiu com ' + esc(x.emoji) + ' à sua mensagem em <a href="#/pleiade/c/' + esc(x.canal) + '">' + esc(prefixo(canais()[x.canal]) + nomeCanal(x.canal)) + '</a></p>' : '') + linhaMsg(x.canal, Object.assign({}, x.msg, { continua: false }), { origem: true, semDia: true }) + '</div>'; }), 'Quando alguém mencionar você ou reagir às suas mensagens, aparece aqui.');
  }
  function telaSalvos() {
    const S = Object.keys(cfg().salvos).map(function (k) { const p = k.split('/'); const m = msgs(p[0])[p[1]]; return m && vejo(canais()[p[0]], p[0]) ? { c: p[0], m: Object.assign({ id: p[1] }, m) } : null; }).filter(Boolean).sort(function (a, b) { return b.m.em - a.m.em; });
    return telaLista('Itens salvos', S.map(function (x) { return linhaMsg(x.c, x.m, { origem: true, semDia: true }); }), 'Salve mensagens importantes (🏷️) para achar depois: links de edital, decisões, senhas de portal não!');
  }
  function telaPessoas() {
    const M = membros(); return telaLista('Pessoas', Object.keys(M).sort(function (a, b) { return M[a].nome.localeCompare(M[b].nome); }).map(function (u) { const m = M[u]; return '<div class="pl-pessoa">' + avatar(u, 48) + '<div><b>' + esc(m.nome) + (u === eu() ? ' (você)' : '') + '</b><small>' + esc(m.cargo || '') + '</small>' + (m.status ? '<small>' + esc(m.status.emoji + ' ' + m.status.texto) + '</small>' : '') + '<small class="' + (ativo(u) ? 'pl-on' : 'mudo') + '">' + (ativo(u) ? '● ativo agora' : 'ausente') + '</small></div>' + (u !== eu() ? '<button class="btn mini" data-dm="' + esc(u) + '">Mensagem</button>' : '') + '</div>'; }), 'Ninguém ainda.');
  }
  function telaBusca(q) {
    const r = P.buscar(arv(), q, eu());
    return telaLista('Busca: ' + q, ['<p class="mini mudo">' + r.length + ' resultado(s). Filtros: <code>in:#canal</code> <code>from:@pessoa</code> <code>has:arquivo</code></p>'].concat(r.map(function (x) { return linhaMsg(x.canal, Object.assign({ id: Object.keys(msgs(x.canal)).find(function (k) { return msgs(x.canal)[k] === x.msg; }) }, x.msg, { continua: false }), { origem: true, semDia: true }); })), 'Nada encontrado.');
  }

  function render(el, sub, param) {
    if (!T.iniciado) T.iniciar();
    if (!eu() || !membros()[eu()]) { el.innerHTML = '<div class="pl-boas"><h2>Plêiade</h2><p>Comunicação da equipe Seven.</p>' + (T.remoto() && !T.conectado ? '<p class="mudo">Conectando ao servidor da equipe…</p>' : '') + '</div>'; if (!est.apresentando && (T.conectado || !T.remoto())) { est.apresentando = true; apresentar().then(function (ok) { est.apresentando = false; if (ok) App.redesenhar(); }); } return; }
    est.vista = sub === 'c' || !sub ? null : sub;
    if (sub === 'c') est.canal = param; else if (!sub) { const C = canais(); est.canal = est.canal && vejo(C[est.canal], est.canal) ? est.canal : (C.geral ? 'geral' : Object.keys(C).find(function (k) { return vejo(C[k], k); })); }
    if (est.canal && !vejo(canais()[est.canal], est.canal) && !(canais()[est.canal] && !canais()[est.canal].privado && !canais()[est.canal].dm && !canais()[est.canal].arquivado)) est.canal = 'geral';
    if (est.thread && est.thread.c !== est.canal && !est.vista) est.thread = null;
    const salvarScroll = document.getElementById('pl-msgs'); if (salvarScroll && est.ultimoCanal) est.scroll[est.ultimoCanal] = { topo: salvarScroll.scrollTop, fundo: salvarScroll.scrollHeight - salvarScroll.scrollTop - salvarScroll.clientHeight < 40 };
    const thScroll = document.querySelector('.pl-msgs-th'); const thFundo = !thScroll || thScroll.scrollHeight - thScroll.scrollTop - thScroll.clientHeight < 40;
    const ae = document.activeElement; const focoEra = ae && ae.closest && ae.closest('.pl-editar') ? 'ed' : ae && ae.closest && ae.closest('.pl-comp') ? (ae.closest('.pl-painel') ? 'th' : 'main') : null;
    if (est.segurarLido && est.segurarLido !== est.canal) est.segurarLido = null;
    // marcar como lido antes de desenhar (a lateral já sai sem o contador); guarda onde começam as novas
    if (est.canal && !est.vista && canais()[est.canal]) {
      if (est.ultimoCanal !== est.canal && est.segurarLido !== est.canal) est.novasDe[est.canal] = cfg().lidos[est.canal] || 0;
      const ult = P.lista(msgs(est.canal)).pop(); if (ult && est.segurarLido !== est.canal && (cfg().lidos[est.canal] || 0) < ult.em && document.visibilityState === 'visible') { cfg().lidos[est.canal] = ult.em; Dados.salvar(); setTimeout(atualizarSelo, 0); }
    }
    let main = '';
    if (est.vista === 'threads') main = telaThreads(); else if (est.vista === 'atividade') main = telaAtividade(); else if (est.vista === 'salvos') main = telaSalvos(); else if (est.vista === 'pessoas') main = telaPessoas(); else if (est.vista === 'busca') main = telaBusca(param);
    else if (est.canal && canais()[est.canal]) main = telaCanal(est.canal); else main = '<div class="pl-intro"><p>Nenhum canal. Crie um no ＋.</p></div>';
    const painel = est.thread ? telaThread() : (est.painel && est.canal && !est.vista ? telaDetalhes(est.canal, est.painel) : '');
    el.innerHTML = '<div class="pl' + (painel ? ' com-painel' : '') + '"><div class="pl-barra"><form id="pl-busca"><input type="search" placeholder="Buscar na Plêiade (ex.: edital in:#licitacoes from:@ana)" value="' + esc(est.vista === 'busca' ? param : '') + '"></form>' + (T.erro ? '<span class="pl-erro">⚠ ' + esc(T.erro) + '</span>' : '') + '</div>' + lateral() + '<section class="pl-main">' + main + '</section>' + painel + '</div><input type="file" id="pl-arquivo" multiple hidden>';
    // rolagem
    const box = el.querySelector('#pl-msgs'); if (box && !est.vista) { const s = est.scroll[est.canal]; if (!s || s.fundo || est.ultimoCanal !== est.canal) { const nv = box.querySelector('.pl-novas'); if (nv && est.ultimoCanal !== est.canal) box.scrollTop = nv.offsetTop - 60; else box.scrollTop = box.scrollHeight; } else box.scrollTop = s.topo; }
    const tb = el.querySelector('.pl-msgs-th'); if (tb && thFundo) tb.scrollTop = tb.scrollHeight;
    const trocouCanal = est.ultimoCanal !== (est.vista ? null : est.canal);
    est.ultimoCanal = est.vista ? null : est.canal;
    // imagens dos anexos
    el.querySelectorAll('img[data-src-anx]').forEach(async function (img) { const mEl = img.closest('[data-m]'); const m = msgs(mEl.dataset.c)[mEl.dataset.m]; const a = m && m.anexos[Number(img.dataset.srcAnx)]; if (a) img.src = await urlAnexo(a); });
    ligar(el);
    const alvoFoco = focoEra || (est.focoThread ? 'th' : trocouCanal ? 'main' : null); est.focoThread = false;
    const foco = (est.editando && el.querySelector('.pl-editar textarea')) || (alvoFoco && el.querySelector(alvoFoco === 'th' ? '.pl-painel .pl-comp textarea' : '.pl-main .pl-comp textarea'));
    el.querySelectorAll('.pl-comp textarea').forEach(ajustarAltura);
    if (foco && !document.querySelector('.modal-fundo')) { foco.focus(); foco.setSelectionRange(foco.value.length, foco.value.length); }
  }
  function ajustarAltura(t) { t.style.height = 'auto'; t.style.height = Math.min(220, t.scrollHeight) + 'px'; }

  // ---------- autocompletar @, #, : e / ----------
  function sugestoes(t, pos) {
    const antes = t.slice(0, pos); const m = antes.match(/(^|\s)([@#:\/])([\wÀ-ÿ\-]*)$/); if (!m || (m[2] === '/' && m[1] !== '' ) || (m[2] === ':' && m[3].length < 2)) return null;
    const q = Cotacoes.normalizar(m[3]); let itens = [];
    if (m[2] === '@') itens = Object.keys(membros()).map(function (u) { return { v: '@' + membro(u).nome + ' ', t: membro(u).nome, s: membro(u).cargo || '', av: u }; }).concat([{ v: '@canal ', t: 'canal', s: 'avisa todos do canal' }]).filter(function (x) { return Cotacoes.normalizar(x.t).indexOf(q) >= 0; });
    if (m[2] === '#') itens = Object.keys(canais()).filter(function (k) { return vejo(canais()[k], k) && !canais()[k].dm; }).map(function (k) { return { v: '#' + canais()[k].nome + ' ', t: '#' + canais()[k].nome, s: canais()[k].descricao || '' }; }).filter(function (x) { return Cotacoes.normalizar(x.t).indexOf(q) >= 0; });
    if (m[2] === ':') itens = Object.keys(P.EMOJIS).filter(function (k) { return k.indexOf(m[3].toLowerCase()) === 0; }).map(function (k) { return { v: P.EMOJIS[k] + ' ', t: P.EMOJIS[k] + ' :' + k + ':', s: '' }; }).filter(function (x, i, a) { return a.findIndex(function (y) { return y.v === x.v; }) === i; });
    if (m[2] === '/') itens = [{ v: '/tarefa ', t: '/tarefa', s: 'cria tarefa na Agenda (entende "amanhã 14h !alta")' }, { v: '/status ', t: '/status', s: 'define seu status, ex.: /status 🔨 Em sessão' }, { v: '/me ', t: '/me', s: 'mensagem em itálico' }].filter(function (x) { return x.t.indexOf('/' + m[3]) === 0; });
    return itens.length ? { ini: pos - m[3].length - 1, itens: itens.slice(0, 8) } : null;
  }
  function mostrarAuto(form, ta) {
    const box = form.querySelector('.pl-auto'); const s = sugestoes(ta.value, ta.selectionStart); est.auto = s ? { s: s, i: 0, form: form } : null;
    if (!s) { box.hidden = true; return; }
    box.hidden = false; box.innerHTML = s.itens.map(function (x, i) { return '<button type="button" class="' + (i === 0 ? 'sel' : '') + '" data-auto="' + i + '">' + (x.av ? avatar(x.av, 20) : '') + '<b>' + esc(x.t) + '</b><small>' + esc(x.s) + '</small></button>'; }).join('');
  }
  function aplicarAuto(ta, i) { const a = est.auto; if (!a) return; const x = a.s.itens[i]; ta.value = ta.value.slice(0, a.s.ini) + x.v + ta.value.slice(ta.selectionStart); const p = a.s.ini + x.v.length; ta.setSelectionRange(p, p); est.auto = null; a.form.querySelector('.pl-auto').hidden = true; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); }

  async function escolherEmoji(alvo) {
    return new Promise(function (ok) {
      const pop = document.createElement('div'); pop.className = 'pl-emojis'; pop.innerHTML = EMOJI_GRADE.map(function (e) { return '<button type="button">' + e + '</button>'; }).join('');
      document.body.appendChild(pop); const r = alvo.getBoundingClientRect(); pop.style.left = Math.min(window.innerWidth - 280, Math.max(8, r.left - 120)) + 'px'; pop.style.top = (r.top > 260 ? r.top - pop.offsetHeight - 6 : r.bottom + 6) + 'px';
      const fim = function (v) { pop.remove(); document.removeEventListener('mousedown', fora, true); ok(v); };
      const fora = function (ev) { if (!pop.contains(ev.target)) fim(null); };
      setTimeout(function () { document.addEventListener('mousedown', fora, true); }, 0);
      pop.onclick = function (ev) { const b = ev.target.closest('button'); if (b) fim(b.textContent); };
    });
  }
  function reagir(cid, mid, e) { const m = msgs(cid)[mid]; if (!m) return; const ja = m.reacoes && m.reacoes[e] && m.reacoes[e][eu()]; T.set('mensagens/' + cid + '/' + mid + '/reacoes/' + e + '/' + eu(), ja ? null : Date.now()); }

  // ---------- eventos ----------
  function ligar(el) {
    const busca = el.querySelector('#pl-busca'); busca.onsubmit = function (ev) { ev.preventDefault(); const q = busca.querySelector('input').value.trim(); if (q) location.hash = '#/pleiade/busca/' + encodeURIComponent(q); };
    el.oninput = function (ev) {
      const ta = ev.target; if (ta.tagName === 'TEXTAREA' && ta.closest('.pl-editar')) { est.editTexto = ta.value; return; }
      if (ta.tagName !== 'TEXTAREA' || !ta.closest('.pl-comp')) return; const f = ta.closest('.pl-comp'); est.rascunho[f.dataset.comp] = ta.value; ajustarAltura(ta); mostrarAuto(f, ta);
      if (T.remoto() && ta.value && (!est.digitou || Date.now() - est.digitou > 3000)) { est.digitou = Date.now(); T.enviar('PUT', 'digitando/' + f.dataset.comp.split('/')[0] + '/' + eu(), Date.now()); }
    };
    el.onkeydown = function (ev) {
      const ta = ev.target; if (ta.tagName !== 'TEXTAREA') return;
      if (ta.closest('.pl-editar')) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); ta.closest('form').requestSubmit(); } if (ev.key === 'Escape') { est.editando = null; est.editTexto = null; App.redesenhar(); } return; }
      if (!ta.closest('.pl-comp')) return;
      if (est.auto && est.auto.form === ta.closest('.pl-comp')) { const n = est.auto.s.itens.length; const box = est.auto.form.querySelector('.pl-auto');
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); est.auto.i = (est.auto.i + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n; box.querySelectorAll('button').forEach(function (b, i) { b.classList.toggle('sel', i === est.auto.i); }); return; }
        if (ev.key === 'Enter' || ev.key === 'Tab') { ev.preventDefault(); aplicarAuto(ta, est.auto.i); return; }
        if (ev.key === 'Escape') { est.auto = null; box.hidden = true; return; } }
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); ta.closest('form').requestSubmit(); }
      if (ev.key === 'ArrowUp' && !ta.value) { const ult = P.lista(msgs(est.canal)).filter(function (m) { return m.u === eu() && !m.sistema; }).pop(); if (ult) { est.editando = est.canal + '/' + ult.id; est.editTexto = null; App.redesenhar(); } }
    };
    el.onsubmit = async function (ev) {
      const f = ev.target; if (f.classList.contains('pl-comp')) { ev.preventDefault(); const ta = f.querySelector('textarea'); const p = f.dataset.comp.split('/'); const texto = ta.value; const tambem = f.querySelector('[name=tambem]'); est.rascunho[f.dataset.comp] = ''; ta.value = ''; est.focoThread = !!p[1]; await enviar(p[0], texto, { pai: p[1], tambemCanal: tambem && tambem.checked }); App.redesenhar(); }
      if (f.classList.contains('pl-editar')) { ev.preventDefault(); const mEl = f.closest('[data-m]'); const t = f.querySelector('textarea').value.trim(); est.editando = null; est.editTexto = null; if (t) T.patch('mensagens/' + mEl.dataset.c + '/' + mEl.dataset.m, { t: P.codificarCanais(P.codificarMencoes(t, membros()), canais()), editado: Date.now() }); App.redesenhar(); }
    };
    el.onchange = async function (ev) { if (ev.target.id === 'pl-arquivo') { const fs = Array.prototype.slice.call(ev.target.files); ev.target.value = ''; const an = await anexar(fs); if (!an.length) return; const alvo = est.anexarEm || { c: est.canal }; const f = el.querySelector('[data-comp="' + (alvo.p ? alvo.c + '/' + alvo.p : alvo.c) + '"] textarea'); const texto = f ? f.value : ''; if (f) { f.value = ''; est.rascunho[alvo.p ? alvo.c + '/' + alvo.p : alvo.c] = ''; } await enviar(alvo.c, texto, { anexos: an, pai: alvo.p }); App.redesenhar(); } };
    el.onclick = async function (ev) {
      const au = ev.target.closest('[data-auto]'); if (au) { aplicarAuto(au.closest('.pl-comp').querySelector('textarea'), Number(au.dataset.auto)); return; }
      const fmt = ev.target.closest('[data-fmt]'); if (fmt) { const ta = fmt.closest('.pl-comp').querySelector('textarea'); const s = ta.selectionStart, e2 = ta.selectionEnd, k = fmt.dataset.fmt.replace('&gt;', '>'); const sel = ta.value.slice(s, e2); const novo = /\s$/.test(k) ? k + sel : k + (sel || 'texto') + k; ta.setRangeText(novo, s, e2, sel ? 'end' : 'select'); if (!sel && !/\s$/.test(k)) ta.setSelectionRange(s + 1, s + 1 + 5); ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true })); return; }
      const rc = ev.target.closest('[data-reac]'); if (rc) { const mEl = rc.closest('[data-m]'); reagir(mEl.dataset.c, mEl.dataset.m, rc.dataset.reac); return; }
      const anx = ev.target.closest('[data-anx]'); if (anx) { const mEl = anx.closest('[data-m]'); const m = msgs(mEl.dataset.c)[mEl.dataset.m]; const a = m.anexos[Number(anx.dataset.anx)]; const u = await urlAnexo(a); if (!u) return aviso('Arquivo não está neste navegador.', 'erro'); const l = document.createElement('a'); l.href = u; l.download = a.nome; if (/^image\/|pdf/.test(a.tipo)) { l.target = '_blank'; l.removeAttribute('download'); } document.body.appendChild(l); l.click(); l.remove(); return; }
      const dm = ev.target.closest('[data-dm]'); if (dm) { abrirDM([dm.dataset.dm]); return; }
      const ath = ev.target.closest('[data-abrir-th]'); if (ath) { const p = ath.dataset.abrirTh.split('|'); est.thread = { c: p[0], m: p[1] }; est.focoThread = true; location.hash = '#/pleiade/c/' + p[0]; return; }
      const ir = ev.target.closest('[data-ir]'); if (ir) { const alvo = document.querySelector('.pl-main [data-m="' + ir.dataset.ir + '"]'); if (alvo) { alvo.scrollIntoView({ block: 'center' }); alvo.classList.add('pisca'); } return; }
      const tirar = ev.target.closest('[data-tirar]'); if (tirar) { T.set('canais/' + est.canal + '/membros/' + tirar.dataset.tirar, null); mensagemSistema(est.canal, '<@' + eu() + '> removeu <@' + tirar.dataset.tirar + '> do canal.'); return; }
      const a = ev.target.closest('[data-pl]'); if (!a) { const men = ev.target.closest('.pl-men[data-u]'); if (men && men.dataset.u !== eu()) abrirDM([men.dataset.u]); return; }
      const k = a.dataset.pl; const mEl = a.closest('[data-m]'); const cid = mEl ? mEl.dataset.c : est.canal; const mid = mEl && mEl.dataset.m;
      if (k === 'chamada') { if (!T.remoto()) { aviso('Videochamada precisa do modo equipe (servidor configurado em Configurações da Plêiade).', 'erro'); return; } const sid = Telas.reuniao.criar({ canal: est.canal, nome: '' + (canais()[est.canal].dm ? 'Chamada' : 'Reunião em #' + canais()[est.canal].nome) }); location.hash = '#/reuniao/' + sid; return; }
      if (k === 'thread') { est.thread = { c: cid, m: mid }; est.painel = null; est.focoThread = true; if (cid !== est.canal || est.vista) location.hash = '#/pleiade/c/' + cid; else App.redesenhar(); }
      if (k === 'fechar-painel') { est.thread = null; est.painel = null; est.focoThread = false; App.redesenhar(); }
      if (k === 'emoji') { const e = await escolherEmoji(a); if (e) reagir(cid, mid, e); }
      if (k === 'emoji-comp') { const ta = a.closest('.pl-comp').querySelector('textarea'); const e = await escolherEmoji(a); if (e) { ta.setRangeText(e, ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true })); } }
      if (k === 'mencionar') { const ta = a.closest('.pl-comp').querySelector('textarea'); ta.setRangeText((ta.value && !/\s$/.test(ta.value.slice(0, ta.selectionStart)) ? ' ' : '') + '@', ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true })); }
      if (k === 'anexar') { const p = a.closest('.pl-comp').dataset.comp.split('/'); est.anexarEm = { c: p[0], p: p[1] }; el.querySelector('#pl-arquivo').click(); }
      if (k === 'salvar') { const ch = cid + '/' + mid; if (cfg().salvos[ch]) delete cfg().salvos[ch]; else cfg().salvos[ch] = Date.now(); Dados.salvar(); App.redesenhar(); }
      if (k === 'mais') menuMensagem(cid, mid, a);
      if (k === 'cancelar-ed') { est.editando = null; est.editTexto = null; App.redesenhar(); }
      if (k === 'entrar') { await T.set('canais/' + est.canal + '/membros/' + eu(), true); mensagemSistema(est.canal, '<@' + eu() + '> entrou no canal.'); }
      if (k === 'sair' && await confirmar('Sair do canal', 'Sair de #' + esc(canais()[est.canal].nome) + '?', 'Sair')) { await mensagemSistema(est.canal, '<@' + eu() + '> saiu do canal.'); await T.set('canais/' + est.canal + '/membros/' + eu(), null); est.painel = null; location.hash = '#/pleiade/c/geral'; }
      if (k === 'arquivar' && await confirmar('Arquivar canal', 'Arquivar #' + esc(canais()[est.canal].nome) + '? Ninguém mais poderá enviar mensagens.', 'Arquivar')) { await T.set('canais/' + est.canal + '/arquivado', Date.now()); est.painel = null; location.hash = '#/pleiade/c/geral'; }
      if (['detalhes', 'membros', 'fixados', 'arquivos'].indexOf(k) >= 0) { est.painel = est.painel === k && !a.closest('.pl-painel') ? null : k; est.thread = null; App.redesenhar(); }
      if (k === 'topico') { const c = canais()[est.canal]; const r = await modal({ titulo: 'Tópico do canal', corpo: campo('Tópico', '<input name="t" maxlength="250" value="' + esc(c.topico || '') + '" placeholder="ex.: Sessões desta semana: PE 90021 (qua 9h), DE 15 (sex 14h)">') }); if (r) { T.set('canais/' + est.canal + '/topico', r.get('t').trim() || null); mensagemSistema(est.canal, '<@' + eu() + '> ' + (r.get('t').trim() ? 'definiu o tópico: ' + r.get('t').trim() : 'limpou o tópico.')); } }
      if (k === 'editar-canal') editarCanal(est.canal);
      if (k === 'adicionar-pessoas') adicionarPessoas(est.canal);
      if (k === 'novo-canal') editarCanal(null);
      if (k === 'explorar') explorar();
      if (k === 'nova-dm') novaDM();
      if (k === 'perfil') perfil();
      if (k === 'ajustes') { ev.stopPropagation(); ajustes(); }
    };
  }

  async function menuMensagem(cid, mid, alvo) {
    const m = msgs(cid)[mid]; const minha = m.u === eu();
    const pop = document.createElement('div'); pop.className = 'pl-menu';
    pop.innerHTML = [minha ? ['editar', '✎ Editar mensagem'] : null, ['fixar', m.fixado ? '📌 Desafixar' : '📌 Fixar no canal'], ['copiar', '⧉ Copiar texto'], ['naolida', '◉ Marcar como não lida'], Telas.agenda ? ['tarefa', '☑ Criar tarefa na Agenda'] : null, minha ? ['excluir', '🗑 Excluir mensagem'] : null].filter(Boolean).map(function (x) { return '<button data-op="' + x[0] + '"' + (x[0] === 'excluir' ? ' class="perigo"' : '') + '>' + x[1] + '</button>'; }).join('');
    document.body.appendChild(pop); const r = alvo.getBoundingClientRect(); pop.style.top = Math.min(window.innerHeight - pop.offsetHeight - 8, r.bottom + 4) + 'px'; pop.style.left = Math.max(8, r.right - pop.offsetWidth) + 'px';
    const fechar = function () { pop.remove(); document.removeEventListener('mousedown', fora, true); }; const fora = function (ev) { if (!pop.contains(ev.target)) fechar(); };
    setTimeout(function () { document.addEventListener('mousedown', fora, true); }, 0);
    pop.onclick = async function (ev) {
      const b = ev.target.closest('[data-op]'); if (!b) return; fechar(); const op = b.dataset.op;
      if (op === 'editar') { est.editando = cid + '/' + mid; est.editTexto = null; App.redesenhar(); }
      if (op === 'fixar') { T.set('mensagens/' + cid + '/' + mid + '/fixado', m.fixado ? null : Date.now()); }
      if (op === 'copiar') navigator.clipboard.writeText(P.textoPuro(m.t, ctx())).then(function () { aviso('Texto copiado.'); }, function () {});
      if (op === 'naolida') { cfg().lidos[cid] = m.em - 1; est.novasDe[cid] = m.em - 1; est.segurarLido = cid; Dados.salvar(); atualizarSelo(); App.redesenhar(); aviso('Marcada como não lida.'); }
      if (op === 'tarefa') { const x = Telas.agenda.criar(P.textoPuro(m.t, ctx()).slice(0, 140)); if (x) { x.notas = 'Da Plêiade · ' + prefixo(canais()[cid]) + nomeCanal(cid) + ' · ' + membro(m.u).nome; Dados.salvar(); aviso('☑ Tarefa criada na Agenda.'); } }
      if (op === 'excluir' && await confirmar('Excluir mensagem', 'Excluir esta mensagem? Não dá para desfazer.', 'Excluir')) { if (m.pai) { const pai = msgs(cid)[m.pai]; if (pai) T.patch('mensagens/' + cid + '/' + m.pai, { nResp: Math.max(0, (pai.nResp || 1) - 1) }); } P.respostas(msgs(cid), mid).forEach(function (r) { T.set('mensagens/' + cid + '/' + r.id, null); }); T.set('mensagens/' + cid + '/' + mid, null); if (est.thread && est.thread.m === mid) est.thread = null; }
    };
  }

  async function editarCanal(cid) {
    const c = cid ? canais()[cid] : null;
    const r = await modal({ titulo: c ? 'Editar canal' : 'Criar canal', corpo: campo('Nome', '<input name="nome" required maxlength="60" value="' + esc(c ? c.nome : '') + '" placeholder="ex.: pregao-90021-catalao">', 'Minúsculas, sem espaços. Ex.: um canal por cliente ou por licitação.') + campo('Descrição', '<input name="descricao" value="' + esc(c ? c.descricao || '' : '') + '" placeholder="Sobre o que é este canal?">') + (c ? '' : '<label class="check"><input type="checkbox" name="privado"> Tornar privado (só membros convidados veem)</label>') });
    if (!r) return; const nome = P.slug(r.get('nome')); if (!nome) return aviso('Nome inválido.', 'erro');
    if (Object.keys(canais()).some(function (k) { return k !== cid && !canais()[k].dm && canais()[k].nome === nome; })) return aviso('Já existe um canal #' + nome + '.', 'erro');
    if (c) { await T.patch('canais/' + cid, { nome: nome, descricao: r.get('descricao').trim() }); return; }
    const novo = (r.get('privado') ? 'p-' : '') + nome + '-' + P.id().slice(-4); const mem = {}; mem[eu()] = true;
    await T.set('canais/' + novo, { nome: nome, descricao: r.get('descricao').trim(), privado: !!r.get('privado'), criadoPor: eu(), criadoEm: Date.now(), membros: mem });
    await mensagemSistema(novo, '<@' + eu() + '> criou ' + (r.get('privado') ? 'o canal privado' : 'o canal') + ' #' + nome + '.');
    location.hash = '#/pleiade/c/' + novo; if (r.get('privado')) adicionarPessoas(novo);
  }
  async function adicionarPessoas(cid) {
    const c = canais()[cid]; const fora = Object.keys(membros()).filter(function (u) { return !(c.membros || {})[u]; });
    if (!fora.length) return aviso('Todos já estão no canal.');
    const r = await modal({ titulo: 'Adicionar a #' + c.nome, corpo: '<div class="grade-checks pl-escolha">' + fora.map(function (u) { return '<label><input type="checkbox" name="u" value="' + esc(u) + '"> ' + avatar(u, 22) + ' ' + esc(membro(u).nome) + '</label>'; }).join('') + '</div>' });
    if (!r) return; for (const u of r.getAll('u')) await T.set('canais/' + cid + '/membros/' + u, true);
    if (r.getAll('u').length) mensagemSistema(cid, '<@' + eu() + '> adicionou ' + r.getAll('u').map(function (u) { return '<@' + u + '>'; }).join(', ') + '.');
  }
  async function explorar() {
    const C = canais(); const pub = Object.keys(C).filter(function (k) { return !C[k].dm && !C[k].privado && !C[k].arquivado; });
    const r = await modal({ titulo: 'Explorar canais', botao: false, corpo: '<ul class="pl-pessoas">' + pub.map(function (k) { return '<li><span class="pl-hash">#</span><div><b>' + esc(C[k].nome) + '</b><small>' + Object.keys(C[k].membros || {}).length + ' membro(s)' + (C[k].descricao ? ' · ' + esc(C[k].descricao) : '') + '</small></div><a class="btn mini" href="#/pleiade/c/' + esc(k) + '" data-fechar-modal>' + (souMembro(C[k]) ? 'Abrir' : 'Ver') + '</a></li>'; }).join('') + '</ul><button type="button" class="btn primario" data-novo-canal>+ Criar canal</button>',
      aoAbrir: function (f) { f.addEventListener('click', function (ev) { if (ev.target.closest('[data-fechar-modal]')) f.closest('.modal-fundo').remove(); if (ev.target.closest('[data-novo-canal]')) { f.closest('.modal-fundo').remove(); editarCanal(null); } }); } });
    void r;
  }
  async function abrirDM(uids) { const todos = uids.concat([eu()]).filter(function (x, i, a) { return a.indexOf(x) === i; }); const id = P.dmId(todos); if (!canais()[id]) { const mem = {}; todos.forEach(function (u) { mem[u] = true; }); await T.set('canais/' + id, { nome: 'dm', dm: true, membros: mem, criadoPor: eu(), criadoEm: Date.now() }); } location.hash = '#/pleiade/c/' + id; }
  async function novaDM() {
    const outros = Object.keys(membros()).filter(function (u) { return u !== eu(); });
    if (!outros.length) return aviso(T.remoto() ? 'Ninguém mais entrou ainda. Peça para a equipe abrir a Plêiade com a mesma conexão.' : 'Modo local: só você neste navegador. Conecte o servidor da equipe em ⚙ para conversar com outras pessoas.', 'erro');
    const r = await modal({ titulo: 'Nova mensagem', botao: 'Abrir conversa', corpo: '<p class="mini mudo">Escolha uma ou mais pessoas (até 8).</p><div class="grade-checks pl-escolha">' + outros.map(function (u) { return '<label><input type="checkbox" name="u" value="' + esc(u) + '"> ' + avatar(u, 22) + ' ' + esc(membro(u).nome) + '</label>'; }).join('') + '</div>', validar: function (fd) { const n = fd.getAll('u').length; return !n ? 'Escolha alguém.' : n > 8 ? 'No máximo 8 pessoas.' : ''; } });
    if (r) abrirDM(r.getAll('u'));
  }
  async function perfil() {
    const m = membro(eu());
    const r = await modal({ titulo: 'Seu perfil e status', corpo: '<div class="linha">' + campo('Nome', '<input name="nome" required value="' + esc(m.nome) + '">') + campo('Cargo', '<input name="cargo" value="' + esc(m.cargo || '') + '">') + '</div><fieldset><legend>Status</legend><div class="linha">' + campo('Emoji', '<input name="se" maxlength="4" style="width:70px" value="' + esc(m.status ? m.status.emoji : '') + '">') + campo('Texto', '<input name="st" value="' + esc(m.status ? m.status.texto : '') + '" placeholder="O que você está fazendo?">') + '</div><div class="pilulas">' + STATUS_PRONTOS.map(function (s) { return '<button type="button" class="pilula" data-st="' + esc(s[0] + '|' + s[1]) + '">' + s[0] + ' ' + s[1] + '</button>'; }).join('') + '<button type="button" class="pilula" data-st="|">Limpar</button></div></fieldset><fieldset><legend>Cor</legend><div class="ag-cores">' + CORES.map(function (c) { return '<label><input type="radio" name="cor" value="' + c + '"' + (m.cor === c ? ' checked' : '') + '><i style="background:' + c + '"></i></label>'; }).join('') + '</div></fieldset>',
      aoAbrir: function (f) { f.addEventListener('click', function (ev) { const b = ev.target.closest('[data-st]'); if (b) { const p = b.dataset.st.split('|'); f.se.value = p[0]; f.st.value = p[1]; } }); } });
    if (!r) return; T.patch('membros/' + eu(), { nome: r.get('nome').trim(), cargo: r.get('cargo').trim(), cor: r.get('cor') || m.cor, status: r.get('st').trim() || r.get('se').trim() ? { emoji: r.get('se').trim() || '💬', texto: r.get('st').trim() } : null });
  }
  async function ajustes() {
    const c = cfg();
    const r = await modal({ titulo: 'Conexão da Plêiade', largo: true, corpo:
      '<label class="co-origem"><input type="radio" name="modo" value="local"' + (c.modo !== 'firebase' ? ' checked' : '') + '><span><b>Local (este navegador)</b><small>Funciona sem configurar, mas as mensagens ficam só neste computador. Serve para testar.</small></span></label>' +
      '<label class="co-origem"><input type="radio" name="modo" value="firebase"' + (c.modo === 'firebase' ? ' checked' : '') + '><span><b>Equipe — tempo real (Firebase Realtime Database)</b><small>Todos que usarem a mesma URL e o mesmo espaço conversam em tempo real. Passo a passo: em console.firebase.google.com crie um projeto → Realtime Database → Criar banco → copie a URL (termina em firebaseio.com ou firebasedatabase.app). Nas regras, libere leitura e escrita só para quem tiver o token, ou use regras com autenticação.</small>' + campo('URL do banco', '<input name="url" value="' + esc(c.url || '') + '" placeholder="https://seven-xxxx-default-rtdb.firebaseio.com">') + '<div class="linha">' + campo('Espaço', '<input name="espaco" value="' + esc(c.espaco || 'seven') + '">', 'Mesmo nome para toda a equipe.') + campo('Token (opcional)', '<input name="token" type="password" value="' + esc(c.token || '') + '">', 'Segredo do banco ou token de acesso. Fica só neste navegador.') + '</div></span></label>' +
      '<p class="mini mudo">Você está como <b>' + esc(membro(eu()).nome) + '</b>. <button type="button" class="btn-link" data-trocar>Trocar de pessoa</button> · Notificações: ' + ('Notification' in window ? Notification.permission : 'indisponíveis') + ('Notification' in window && Notification.permission === 'default' ? ' <button type="button" class="btn-link" data-notif>Ativar</button>' : '') + '</p>',
      aoAbrir: function (f) { f.addEventListener('click', function (ev) { if (ev.target.closest('[data-notif]')) Notification.requestPermission(); if (ev.target.closest('[data-trocar]')) { cfg().eu = null; Dados.salvar(); f.closest('.modal-fundo').remove(); App.redesenhar(); } }); },
      validar: function (fd) { if (fd.get('modo') === 'firebase' && !/^https:\/\/[^\s]+$/.test(fd.get('url').trim())) return 'Informe a URL https:// do banco.'; return ''; } });
    if (!r) return;
    const mudouServ = r.get('modo') !== c.modo || r.get('url').trim() !== c.url || P.slug(r.get('espaco')) !== P.slug(c.espaco) || r.get('token') !== c.token;
    c.modo = r.get('modo'); c.url = r.get('url').trim(); c.espaco = P.slug(r.get('espaco')) || 'seven'; c.token = r.get('token');
    if (mudouServ) { c.eu = null; c.lidos = {}; c.threadsLidas = {}; Dados.e.pleiadeCache = {}; est.canal = null; est.thread = null; T.iniciar(); aviso(c.modo === 'firebase' ? 'Conectando ao servidor da equipe…' : 'Modo local.'); }
    Dados.salvar(); App.redesenhar();
  }

  // presença: marca "visto" a cada minuto enquanto o sistema está aberto
  setInterval(function () { if (eu() && T.iniciado && membros()[eu()] && document.visibilityState === 'visible') T.enviar('PATCH', 'membros/' + eu(), { visto: Date.now() }).then(function () { if (!T.remoto()) { T.arv.membros[eu()].visto = Date.now(); } }); }, 60000);
  setTimeout(function () { if (Dados.e.pleiadeCfg && Dados.e.pleiadeCfg.eu) { T.iniciar(); atualizarSelo(); } }, 800);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && /^#\/pleiade/.test(location.hash)) App.redesenhar(); });

  Telas.pleiade = { titulo: 'Plêiade', render: render, _t: T, api: { eu: eu, membro: membro, membros: membros, arv: arv, cfg: cfg, avatar: avatar, canais: canais, nomeCanal: nomeCanal, aviso: aviso } };
})();
