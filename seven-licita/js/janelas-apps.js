/* Seven Not, Seven IA, Seven Chat e Seven Agenda em janela flutuante (mesma moldura da Calculadora e da Comissão).
   Cada janela lê e grava nos mesmos dados da tela completa, pelas mesmas funções dela: uma nota criada aqui é a
   mesma nota da tela Seven Not, a conversa da IA continua na tela Seven IA, e assim por diante. */
(function () {
  'use strict';
  const { esc, aviso } = UI;
  const limpar = function (html) { return String(html || '').replace(/<\s*\/?\s*(script|iframe|object|embed|style|link|meta|svg|math)[^>]*>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/javascript:/gi, ''); };
  const vazio = function (t) { return '<p class="cf-vazio">' + t + '</p>'; };

  // ---------- Seven Not ----------
  (function () {
    const est = { q: '', aba: 'notas', aberta: null };
    let J = null, salvarT = null;
    const N = function () { return Telas.anotacoes; };
    function notas() { return N().dados().notas; }
    function opNotas() {
      const loja = Dados.e.notasOport || {}; const out = [];
      Object.keys(loja).forEach(function (k) { (loja[k] || []).forEach(function (n) { out.push(Object.assign({ chave: k }, n)); }); });
      return out.sort(function (a, b) { return String(b.em || '') < String(a.em || '') ? -1 : 1; });
    }
    function tituloOp(k) { const a = (Dados.e.avisos || {})[k]; if (a) return [a.modalidade, a.numero, a.orgao].filter(Boolean).join(' · ') || a.objeto || 'Oportunidade'; const p = (Dados.e.propostas || []).find(function (x) { return x.id === k || x.avisoId === k; }); return p ? [p.modalidade, p.numero, p.orgao].filter(Boolean).join(' · ') : 'Oportunidade'; }
    function desenhar() {
      const c = J.corpo; const n = est.aberta && notas().find(function (x) { return x.id === est.aberta; });
      if (n && !n.apagadaEm) {
        const bloqueada = n.cifrado || (n.tracos && n.tracos.length);
        c.innerHTML = '<div class="cfj-topo"><button type="button" class="btn mini" data-j="voltar">‹ Notas</button><a class="btn mini" href="#/anotacoes/nota/' + esc(n.id) + '">Abrir completa</a></div>' +
          (bloqueada ? vazio(n.cifrado ? '🔒 Nota bloqueada: abra no Seven Not completo para ver.' : 'Esta nota tem escrita à mão: edite no Seven Not completo.') :
            '<input class="cfj-tit" name="titulo" placeholder="Título" value="' + esc(n.titulo || '') + '" aria-label="Título"><div class="cfj-ed" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Texto da nota">' + limpar(n.html) + '</div><p class="cfj-dica">Salva sozinha · ' + esc(N().quando(n.editadaEm)) + '</p>');
        if (!bloqueada) {
          const t = c.querySelector('.cfj-tit'), ed = c.querySelector('.cfj-ed');
          const gravar = function () { clearTimeout(salvarT); salvarT = setTimeout(function () { n.titulo = t.value; n.html = limpar(ed.innerHTML); n.editadaEm = Date.now(); Dados.salvar(); }, 300); };
          t.oninput = gravar; ed.oninput = gravar;
          ed.onpaste = function (ev) { ev.preventDefault(); const txt = (ev.clipboardData || window.clipboardData).getData('text'); document.execCommand('insertText', false, txt); };
        }
        return;
      }
      est.aberta = null;
      const A = Anotacoes; const ls = A.ordenar(A.filtrar(notas(), { q: est.q }), 'editada').slice(0, 40); const ops = est.aba === 'oport' ? opNotas().filter(function (x) { return !est.q || A.normalizar(x.texto + ' ' + tituloOp(x.chave)).indexOf(A.normalizar(est.q)) >= 0; }).slice(0, 40) : [];
      c.innerHTML = '<div class="cfj-topo"><input type="search" class="cfj-busca" placeholder="Pesquisar" value="' + esc(est.q) + '" aria-label="Pesquisar anotações"><button type="button" class="btn mini primario" data-j="nova">＋ Nova</button></div>' +
        '<div class="cfj-abas" role="tablist"><button type="button" role="tab" data-aba="notas" aria-selected="' + (est.aba === 'notas') + '">Minhas notas</button><button type="button" role="tab" data-aba="oport" aria-selected="' + (est.aba === 'oport') + '">Das oportunidades</button></div>' +
        (est.aba === 'notas' ? (ls.length ? '<ul class="cfj-lista">' + ls.map(function (x) { return '<li><button type="button" data-nota="' + esc(x.id) + '"><b>' + (x.fixada ? '📌 ' : '') + (x.cifrado ? '🔒 ' : '') + esc(A.titulo(x)) + '</b><small>' + esc(x.cifrado ? 'Bloqueada' : A.previa(x, 90)) + '</small><time>' + esc(N().quando(x.editadaEm)) + '</time></button></li>'; }).join('') + '</ul>' : vazio(est.q ? 'Nada encontrado.' : 'Nenhuma anotação ainda.'))
          : (ops.length ? '<ul class="cfj-lista">' + ops.map(function (x) { return '<li><button type="button" data-op="' + esc(x.chave) + '"><b>' + esc(tituloOp(x.chave)) + '</b><small>' + esc(String(x.texto || '').slice(0, 120)) + '</small><time>' + esc(x.em ? new Date(x.em).toLocaleDateString('pt-BR') : '') + (x.etapa ? ' · ' + esc(x.etapa) : '') + '</time></button></li>'; }).join('') + '</ul>' : vazio('As anotações feitas em Seven Oportunidade, Proposta, Disputar e Acompanhar aparecem aqui.')));
      const b = c.querySelector('.cfj-busca'); b.oninput = function () { est.q = b.value; const p = b.selectionStart; desenhar(); const nb = J.corpo.querySelector('.cfj-busca'); nb.focus(); nb.setSelectionRange(p, p); };
    }
    J = Janela.criar({ id: 'not-flutuante', classe: 'cfj', titulo: '🗒 Seven Not', rotulo: 'Seven Not', rota: '#/anotacoes', rotaTitulo: 'Abrir o Seven Not completo', chave: 'seven-not-janela', botao: 'botao-not', tecla: 'KeyN',
      montar: function (corpo) {
        corpo.addEventListener('click', function (ev) {
          const t = ev.target.closest('[data-j],[data-nota],[data-aba],[data-op]'); if (!t) return;
          if (t.dataset.nota) { est.aberta = t.dataset.nota; desenhar(); const ed = J.corpo.querySelector('.cfj-ed'); if (ed) ed.focus(); }
          else if (t.dataset.aba) { est.aba = t.dataset.aba; desenhar(); }
          else if (t.dataset.op) Telas.oport.abrir(t.dataset.op);
          else if (t.dataset.j === 'voltar') { est.aberta = null; desenhar(); }
          else if (t.dataset.j === 'nova') { const n = N().criar({ origem: { tipo: 'janela', rota: location.hash } }); est.aberta = n.id; desenhar(); J.corpo.querySelector('.cfj-tit').focus(); }
        });
      },
      aoAbrir: function () { desenhar(); }, atualizar: function () { desenhar(); } });
    self.NotFlutuante = J;
  })();

  // ---------- Seven IA ----------
  (function () {
    let J = null;
    const I = function () { return Telas.ia.api; };
    function rolarFim() { const r = J.corpo.querySelector('.cfj-fio'); if (r) r.scrollTop = r.scrollHeight; }
    function desenharFio() {
      const f = J.corpo.querySelector('.cfj-fio'); if (!f) return; const m = I().mem; const conv = m.id && I().conversa(m.id);
      const fim = f.scrollHeight - f.scrollTop - f.clientHeight < 60;
      f.innerHTML = (conv ? m.msgs.map(function (x, i) { return I().mensagemHTML(x, i, conv); }).join('') + (m.enviando && m.enviando.id === conv.id ? I().aoVivoHTML() : '') : '<p class="cf-vazio">Pergunte sobre editais, prazos, recursos ou peça um texto. A conversa fica salva na Seven IA.</p>');
      if (fim) rolarFim();
      const b = J.corpo.querySelector('.cfj-enviar'); if (b) { b.textContent = m.enviando ? '■' : '↑'; b.title = m.enviando ? 'Parar resposta' : 'Enviar (Enter)'; }
    }
    function desenhar() {
      const c = J.corpo; const api = I(); const m = api.mem;
      if (!api.chave()) { c.innerHTML = vazio('Para conversar, cadastre a chave da API da Anthropic (fica só neste navegador).') + '<button type="button" class="btn mini primario" data-j="config">Cadastrar chave</button>'; return; }
      const cs = api.dados().conversas.slice().sort(function (a, b) { return (b.editadaEm || 0) - (a.editadaEm || 0); }).slice(0, 25);
      c.innerHTML = '<div class="cfj-topo"><select class="cfj-conv" aria-label="Conversa"><option value="">＋ Nova conversa</option>' + cs.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === m.id ? ' selected' : '') + '>' + esc(x.titulo) + '</option>'; }).join('') + '</select>' + (m.id ? '<a class="btn mini" href="#/ia/c/' + esc(m.id) + '" title="Abrir na Seven IA">Abrir completa</a>' : '') + '</div>' +
        '<div class="cfj-fio ia-fio" aria-live="polite"></div>' +
        '<form class="cfj-comp" autocomplete="off"><textarea rows="2" placeholder="Pergunte à Seven IA" aria-label="Mensagem"></textarea><button type="submit" class="cfj-enviar" aria-label="Enviar">↑</button></form>';
      desenharFio(); rolarFim();
      const ta = c.querySelector('textarea');
      ta.onkeydown = function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); c.querySelector('.cfj-comp').requestSubmit(); } };
      c.querySelector('.cfj-comp').onsubmit = function (ev) { ev.preventDefault(); if (I().mem.enviando) { I().parar(); return; } const t = ta.value; if (!t.trim()) return; ta.value = ''; I().perguntar(t).then(function () { desenhar(); }); };
      c.querySelector('.cfj-conv').onchange = function () { const id = this.value; if (!id) { I().nova(); desenhar(); return; } I().abrirConversa(id).then(desenhar); };
    }
    J = Janela.criar({ id: 'ia-flutuante', classe: 'cfj cfj-ia', titulo: '✦ Seven IA', rotulo: 'Seven IA', rota: '#/ia', rotaTitulo: 'Abrir a Seven IA completa', chave: 'seven-ia-janela', botao: 'botao-ia', tecla: 'KeyI',
      montar: function (corpo) {
        corpo.addEventListener('click', async function (ev) {
          const t = ev.target.closest('[data-j],[data-ia]'); if (!t) return;
          if (t.dataset.j === 'config') { await I().configurar(false); desenhar(); return; }
          const m = I().mem; const conv = m.id && I().conversa(m.id); const i = Number(t.dataset.i); const msg = m.msgs[i];
          if (t.dataset.ia === 'copiar' && msg) I().copiar(SevenAI.textoDe(msg.content), t);
          if (t.dataset.ia === 'nota' && msg) I().salvarNota(msg, conv);
        });
      },
      aoAbrir: function (api, restaurar) { desenhar(); if (!restaurar) { const ta = J.corpo.querySelector('textarea'); if (ta) ta.focus(); } } });
    document.addEventListener('ia:mudou', function () { if (J.aberta()) { if (!J.corpo.querySelector('.cfj-fio')) desenhar(); else desenharFio(); } });
    self.IAFlutuante = J;
  })();

  // ---------- Seven Chat ----------
  (function () {
    let J = null; const est = { canal: null };
    const C = function () { return Telas.pleiade.api; };
    function visiveis() {
      const api = C(); const cs = api.canais(); const eu = api.eu();
      return Object.keys(cs).filter(function (cid) { const c = cs[cid]; return api.vejo(c, cid) && (api.souMembro(c) || c.dm); }).map(function (cid) {
        const ms = Pleiade.lista(api.msgs(cid)); const ult = ms[ms.length - 1]; const r = Pleiade.naoLidas(api.msgs(cid), api.cfg().lidos[cid], eu);
        return { cid: cid, c: cs[cid], nome: api.prefixo(cs[cid]) + api.nomeCanal(cid), ult: ult ? ult.em : 0, n: r.n || 0, men: r.mencoes || 0 };
      }).sort(function (a, b) { return b.ult - a.ult; });
    }
    function desenhar() {
      const c = J.corpo; const api = C();
      if (!api.eu() || !api.membros()[api.eu()]) { c.innerHTML = vazio('Entre no Seven Chat uma vez para conversar daqui.') + '<a class="btn mini primario" href="#/pleiade">Abrir o Seven Chat</a>'; return; }
      const cs = api.canais()[est.canal];
      if (!est.canal || !cs) {
        est.canal = null; const l = visiveis();
        c.innerHTML = (l.length ? '<ul class="cfj-lista cfj-canais">' + l.map(function (x) { return '<li><button type="button" data-canal="' + esc(x.cid) + '"><b>' + esc(x.nome) + '</b>' + (x.n ? '<span class="cfj-n' + (x.men ? ' men' : '') + '">' + x.n + '</span>' : '') + '<time>' + (x.ult ? esc(new Date(x.ult).toLocaleDateString('pt-BR') === new Date().toLocaleDateString('pt-BR') ? api.hora(x.ult) : new Date(x.ult).toLocaleDateString('pt-BR')) : '') + '</time></button></li>'; }).join('') + '</ul>' : vazio('Nenhum canal ainda. Crie no Seven Chat.'));
        return;
      }
      const ms = Pleiade.doCanal(api.msgs(est.canal)).slice(-60);
      c.innerHTML = '<div class="cfj-topo"><button type="button" class="btn mini" data-j="voltar">‹ Canais</button><b class="cfj-canal">' + esc(api.prefixo(cs) + api.nomeCanal(est.canal)) + '</b><a class="btn mini" href="#/pleiade/c/' + esc(est.canal) + '">Abrir</a></div>' +
        '<div class="cfj-fio cfj-chat">' + (ms.length ? ms.map(function (m) { const au = api.membro(m.u); return '<div class="cfj-msg' + (m.u === api.eu() ? ' eu' : '') + (m.sistema ? ' sis' : '') + '"><small><b>' + esc(au.nome) + '</b> ' + api.hora(m.em) + '</small><div>' + Pleiade.formatar(m.t || '', api.ctx()) + (m.anexos && m.anexos.length ? ' <span class="mudo">📎 ' + m.anexos.length + ' anexo(s)</span>' : '') + (Number(m.nResp) > 0 ? ' <span class="mudo">· ' + m.nResp + ' resposta(s)</span>' : '') + '</div></div>'; }).join('') : vazio('Sem mensagens ainda.')) + '</div>' +
        '<form class="cfj-comp" autocomplete="off"><textarea rows="2" placeholder="Mensagem para ' + esc(api.nomeCanal(est.canal)) + '" aria-label="Mensagem"></textarea><button type="submit" class="cfj-enviar" aria-label="Enviar">↑</button></form>';
      const f = c.querySelector('.cfj-fio'); f.scrollTop = f.scrollHeight;
      api.cfg().lidos[est.canal] = Date.now(); Dados.salvar(); api.atualizarSelo();
      const ta = c.querySelector('textarea');
      ta.onkeydown = function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); c.querySelector('.cfj-comp').requestSubmit(); } };
      c.querySelector('.cfj-comp').onsubmit = async function (ev) { ev.preventDefault(); const t = ta.value; if (!t.trim()) return; ta.value = ''; await api.enviar(est.canal, t); desenhar(); J.corpo.querySelector('textarea').focus(); };
    }
    J = Janela.criar({ id: 'chat-flutuante', classe: 'cfj', titulo: '💬 Seven Chat', rotulo: 'Seven Chat', rota: '#/pleiade', rotaTitulo: 'Abrir o Seven Chat completo', chave: 'seven-chat-janela', botao: 'botao-chat', tecla: 'KeyB',
      montar: function (corpo) {
        corpo.addEventListener('click', function (ev) {
          const t = ev.target.closest('[data-canal],[data-j]'); if (!t) return;
          if (t.dataset.canal) { est.canal = t.dataset.canal; desenhar(); const ta = J.corpo.querySelector('textarea'); if (ta) ta.focus(); }
          if (t.dataset.j === 'voltar') { est.canal = null; desenhar(); }
        });
      },
      aoAbrir: function () { desenhar(); }, atualizar: function () { desenhar(); } });
    const ligar = function () { if (Telas.pleiade && Telas.pleiade.api.ouvir) Telas.pleiade.api.ouvir(function () { if (J.aberta() && !J.el.contains(document.activeElement)) desenhar(); }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();
    self.ChatFlutuante = J;
  })();

  // ---------- Seven Agenda ----------
  (function () {
    let J = null;
    const G = function () { return Telas.agenda; };
    function linha(t) { return '<li class="cfj-tarefa' + (t.feita ? ' feita' : '') + '"><label><input type="checkbox" data-t="' + esc(t.id) + '"' + (t.feita ? ' checked' : '') + ' aria-label="Concluir ' + esc(t.titulo) + '"><span>' + esc(t.titulo) + '</span></label><small>' + esc(G().rotuloData(t)) + (t.lista && t.lista !== 'inbox' ? ' · ' + esc(G().nomeLista(t.lista)) : '') + '</small></li>'; }
    function desenhar() {
      const c = J.corpo; const h = Agenda.hojeLocal(); const fim = Agenda.somar(h, 7); const ts = G().dados().tarefas.filter(function (t) { return !t.excluida; });
      const hoje = ts.filter(function (t) { return Agenda.naLista(t, 'hoje', h); }).sort(Agenda.comparar);
      const semana = ts.filter(function (t) { return Agenda.naLista(t, 'semana', h) && !Agenda.naLista(t, 'hoje', h); }).sort(Agenda.comparar).slice(0, 15);
      const ev = G().eventosLicita(h, fim).sort(function (a, b) { return (a.data + (a.hora || '')) < (b.data + (b.hora || '')) ? -1 : 1; }).slice(0, 15);
      c.innerHTML = '<form class="cfj-add" autocomplete="off"><input name="t" placeholder="Nova tarefa: ex. enviar proposta amanhã 14h #cliente" aria-label="Nova tarefa"><button class="btn mini primario">＋</button></form>' +
        '<h4>Hoje' + (hoje.length ? ' · ' + hoje.length : '') + '</h4>' + (hoje.length ? '<ul class="cfj-lista cfj-tarefas">' + hoje.map(linha).join('') + '</ul>' : vazio('Nada para hoje.')) +
        (semana.length ? '<h4>Próximos 7 dias</h4><ul class="cfj-lista cfj-tarefas">' + semana.map(linha).join('') + '</ul>' : '') +
        '<h4>Licitações (7 dias)</h4>' + (ev.length ? '<ul class="cfj-lista cfj-eventos">' + ev.map(function (x) { return '<li><a href="' + esc(x.link || '#/agenda/calendario') + '"><b>' + esc(x.titulo) + '</b><small>' + esc(x.data.split('-').reverse().join('/')) + (x.hora ? ' ' + esc(x.hora) : '') + '</small></a></li>'; }).join('') + '</ul>' : vazio('Sem sessões ou prazos nos próximos 7 dias.'));
      const f = c.querySelector('.cfj-add'); f.onsubmit = function (e2) { e2.preventDefault(); const v = f.elements.t.value; if (!v.trim()) return; const t = G().criar(v, { data: h }); if (t) aviso('☑ Tarefa criada: ' + t.titulo); desenhar(); J.corpo.querySelector('.cfj-add input').focus(); };
    }
    J = Janela.criar({ id: 'agenda-flutuante', classe: 'cfj', titulo: '☑ Seven Agenda', rotulo: 'Seven Agenda', rota: '#/agenda', rotaTitulo: 'Abrir a Seven Agenda completa', chave: 'seven-agenda-janela', botao: 'botao-agenda', tecla: 'KeyA',
      montar: function (corpo) {
        corpo.addEventListener('change', function (ev) { const t = ev.target.closest('[data-t]'); if (!t) return; const x = G().dados().tarefas.find(function (k) { return k.id === t.dataset.t; }); if (x) { G().concluir(x); desenhar(); } });
      },
      aoAbrir: function (api, restaurar) { desenhar(); if (!restaurar) J.corpo.querySelector('.cfj-add input').focus(); }, atualizar: function () { desenhar(); } });
    self.AgendaFlutuante = J;
  })();
})();
