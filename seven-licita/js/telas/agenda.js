/* Agenda no estilo TickTick: tarefas, listas inteligentes, calendário, matriz de Eisenhower, foco (Pomodoro) e hábitos. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, confirmar, aviso, dataHora } = UI;
  const A = Agenda;
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const SMART = [['inbox', '📥', 'Caixa de entrada'], ['hoje', '☀️', 'Hoje'], ['amanha', '🌅', 'Amanhã'], ['semana', '📆', 'Próximos 7 dias'], ['todas', '🗂️', 'Todas'], ['concluidas', '✅', 'Concluídas'], ['lixeira', '🗑️', 'Lixeira']];
  const CORES_LISTA = ['#b68d40', '#579dff', '#4bce97', '#f87168', '#9f8fef', '#fea362', '#6cc3e0', '#f29ac6', '#8c9bab'];
  const LEMBRETES = [{ v: '', t: 'Sem lembrete' }, { v: '0', t: 'No horário' }, { v: '5', t: '5 min antes' }, { v: '15', t: '15 min antes' }, { v: '30', t: '30 min antes' }, { v: '60', t: '1 hora antes' }, { v: '1440', t: '1 dia antes' }];
  const est = { lista: 'hoje', sel: null, grupo: 'data', calModo: 'mes', calRef: null, mostraFeitas: false, habSel: null };

  function e() {
    const d = Dados.e; d.agenda = d.agenda || {};
    const a = d.agenda; a.tarefas = a.tarefas || []; a.listas = a.listas || []; a.habitos = a.habitos || []; a.foco = a.foco || [];
    a.pref = Object.assign({ pomo: 25, pausa: 5, longa: 15, ciclo: 4, licita: true, inicioSemana: 0 }, a.pref || {}); return a;
  }
  function hoje() { return A.hojeLocal(); }
  function tarefa(id) { return e().tarefas.find(function (t) { return t.id === id; }); }
  function lista(id) { return e().listas.find(function (l) { return l.id === id; }); }
  function salvar() { Dados.salvar(); }
  function ehUtil(x) { try { return Calc.ehUtil(new Date(x + 'T12:00:00')); } catch (err) { return true; } } // pula feriados nacionais
  function rotuloData(t) {
    if (!t.data) return ''; const h = hoje(); const n = A.dias(h, t.data); let s;
    if (n === 0) s = 'Hoje'; else if (n === 1) s = 'Amanhã'; else if (n === -1) s = 'Ontem'; else if (n > 1 && n < 7) s = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][A.semana(t.data)];
    else s = t.data.slice(8, 10) + '/' + t.data.slice(5, 7) + (t.data.slice(0, 4) !== h.slice(0, 4) ? '/' + t.data.slice(0, 4) : '');
    return s + (t.hora ? ' ' + t.hora : '');
  }
  function nomeLista(id) { if (!id || id === 'inbox') return 'Caixa de entrada'; if (String(id).indexOf('tag:') === 0) return '#' + id.slice(4); const s = SMART.find(function (x) { return x[0] === id; }); if (s) return s[2]; const l = lista(id); return l ? l.nome : 'Lista'; }
  function tags() { const c = {}; e().tarefas.forEach(function (t) { if (!A.ativa(t)) return; (t.tags || []).forEach(function (g) { c[g] = (c[g] || 0) + 1; }); }); return c; }
  function contar(l) { const h = hoje(); return e().tarefas.filter(function (t) { return A.naLista(t, l, h); }).length; }

  function criar(texto, extra) {
    const r = A.interpretar(texto); if (!r.titulo) return null; const a = e();
    let listaId = extra && extra.lista;
    if (r.lista) { const n = Cotacoes.normalizar(r.lista); let l = a.listas.find(function (x) { return Cotacoes.normalizar(x.nome) === n; }) || a.listas.find(function (x) { return Cotacoes.normalizar(x.nome).indexOf(n) === 0; }); if (!l) { l = { id: Dados.id('agl'), nome: r.lista, cor: CORES_LISTA[a.listas.length % CORES_LISTA.length] }; a.listas.push(l); } listaId = l.id; }
    const t = { id: Dados.id('agt'), titulo: r.titulo, notas: '', lista: listaId || 'inbox', data: (r.dataImplicita && extra && extra.data) || r.data || (extra && extra.data) || null, hora: r.hora || (extra && extra.hora) || null, duracao: 30, lembrete: r.hora ? 0 : null, prioridade: r.prioridade || (extra && extra.prioridade) || 0, tags: r.tags.concat((extra && extra.tags) || []).filter(function (x, i, v) { return v.indexOf(x) === i; }), subtarefas: [], recorrencia: r.recorrencia, criadaEm: new Date().toISOString(), ordem: Date.now() };
    a.tarefas.push(t); salvar(); return t;
  }
  function extraDaLista(l) { const h = hoje(); if (l === 'hoje') return { data: h }; if (l === 'amanha') return { data: A.somar(h, 1) }; if (l === 'semana') return { data: h }; if (String(l).indexOf('tag:') === 0) return { tags: [l.slice(4)] }; if (lista(l)) return { lista: l }; return {}; }
  function concluir(t) {
    if (t.feita) { t.feita = false; t.feitaEm = null; salvar(); return; }
    const r = A.concluir(t, null, ehUtil); salvar();
    aviso(r === 'avancou' ? '✓ Concluída. Próxima: ' + rotuloData(t) : '✓ "' + t.titulo + '" concluída');
  }
  function preview(texto) {
    const r = A.interpretar(texto); const p = [];
    if (r.data) p.push(['', '📅 ' + rotuloData({ data: r.data, hora: r.hora })]); if (r.recorrencia) p.push(['', '↻ ' + A.descreverRecorrencia(r.recorrencia)]);
    if (r.prioridade) p.push(['ag-pr' + r.prioridade, '⚑ ' + A.PRIORIDADES[r.prioridade].nome]); r.tags.forEach(function (g) { p.push(['', '#' + g]); }); if (r.lista) p.push(['', '▤ ' + r.lista]);
    return p.map(function (x) { return '<span class="ag-chip ' + x[0] + '">' + esc(x[1]) + '</span>'; }).join('');
  }

  // ---------- casca ----------
  function casca(el, vista, conteudo, lateral) {
    const pf = Pomo.ativo();
    el.innerHTML = '<div class="ag' + (est.sel ? ' com-det' : '') + (lateral ? '' : ' sem-lado') + '"><nav class="ag-trilho">' + [['tarefas', '☑', 'Tarefas'], ['calendario', '📅', 'Calendário'], ['matriz', '▦', 'Matriz'], ['foco', '⏱', 'Foco'], ['habitos', '◎', 'Hábitos']].map(function (x) { return '<a href="#/agenda/' + x[0] + '" class="' + (vista === x[0] ? 'ativo' : '') + '" title="' + x[2] + '"><span>' + x[1] + '</span><small>' + x[2] + '</small></a>'; }).join('') + '<button class="ag-cfg" data-ag="config" title="Configurações e exportação"><span>⚙</span><small>Ajustes</small></button></nav>' +
      (lateral || '') + '<section class="ag-main">' + conteudo + '</section>' + (est.sel && tarefa(est.sel) ? detalhe(tarefa(est.sel)) : '') + '</div>' + (pf && vista !== 'foco' ? '<a class="ag-pomo-mini" href="#/agenda/foco">⏱ <b id="ag-pomo-mini">' + Pomo.texto() + '</b></a>' : '');
  }
  function lateralTarefas() {
    const a = e(); const tg = tags();
    return '<aside class="ag-lado"><ul class="ag-smart">' + SMART.map(function (s) { const n = s[0] === 'concluidas' || s[0] === 'lixeira' ? '' : contar(s[0]); return '<li><a href="#/agenda/tarefas/' + s[0] + '" class="' + (est.lista === s[0] ? 'ativo' : '') + '" data-soltar="' + s[0] + '"><span>' + s[1] + '</span>' + s[2] + '<small>' + (n || '') + '</small></a></li>'; }).join('') + '</ul>' +
      '<h4>Listas <button class="icone" data-ag="nova-lista" aria-label="Nova lista">＋</button></h4><ul class="ag-smart">' + a.listas.map(function (l) { return '<li><a href="#/agenda/tarefas/' + l.id + '" class="' + (est.lista === l.id ? 'ativo' : '') + '" data-soltar="' + l.id + '"><i class="ag-bola" style="background:' + l.cor + '"></i>' + esc(l.nome) + '<small>' + (contar(l.id) || '') + '</small></a></li>'; }).join('') + (a.listas.length ? '' : '<li class="mudo mini">Crie listas por cliente, licitação ou área.</li>') + '</ul>' +
      (Object.keys(tg).length ? '<h4>Tags</h4><ul class="ag-smart">' + Object.keys(tg).sort().map(function (g) { return '<li><a href="#/agenda/tarefas/tag:' + encodeURIComponent(g) + '" class="' + (est.lista === 'tag:' + g ? 'ativo' : '') + '"><span>#</span>' + esc(g) + '<small>' + tg[g] + '</small></a></li>'; }).join('') + '</ul>' : '') + '</aside>';
  }
  function linhaTarefa(t, opc) {
    const h = hoje(); const atras = t.data && t.data < h && !t.feita; const st = t.subtarefas || [];
    return '<li class="ag-t' + (t.feita ? ' feita' : '') + (est.sel === t.id ? ' sel' : '') + '" data-t="' + t.id + '" draggable="true"><button class="ag-chk ag-pr' + (t.prioridade || 0) + '" data-chk="' + t.id + '" aria-label="' + (t.feita ? 'Reabrir' : 'Concluir') + '">' + (t.feita ? '✓' : '') + '</button>' +
      '<div class="ag-t-c"><span class="ag-t-tit">' + esc(t.titulo) + '</span><span class="ag-t-meta">' + (st.length ? '<small>☑ ' + st.filter(function (s) { return s.feita; }).length + '/' + st.length + '</small>' : '') + (t.notas ? '<small>≡</small>' : '') + (t.tags || []).map(function (g) { return '<small class="ag-tag">#' + esc(g) + '</small>'; }).join('') + (opc && opc.lista && t.lista && t.lista !== 'inbox' && lista(t.lista) ? '<small class="ag-tl"><i class="ag-bola" style="background:' + lista(t.lista).cor + '"></i>' + esc(lista(t.lista).nome) + '</small>' : '') + '</span></div>' +
      '<span class="ag-t-data' + (atras ? ' atras' : '') + '">' + (t.recorrencia ? '↻ ' : '') + (t.lembrete != null && t.data ? '🔔 ' : '') + esc(rotuloData(t)) + '</span></li>';
  }

  // ---------- tarefas ----------
  function telaTarefas(el, l) {
    est.lista = l || est.lista || 'hoje'; const a = e(); const h = hoje(); const L = est.lista;
    const todas = a.tarefas.filter(function (t) { return A.naLista(t, L, h); });
    const especial = L === 'concluidas' || L === 'lixeira';
    const grupos = especial ? [{ chave: 'x', titulo: '', tarefas: todas.sort(function (x, y) { return String(y.feitaEm || y.excluidaEm || '').localeCompare(String(x.feitaEm || x.excluidaEm || '')); }) }] : est.grupo === 'nenhum' ? [{ chave: 'x', titulo: '', tarefas: todas.sort(A.comparar) }] : A.agrupar(todas, h, est.grupo);
    const feitasLista = !especial && L !== 'todas' ? a.tarefas.filter(function (t) { return t.feita && !t.excluida && (A.naLista(Object.assign({}, t, { feita: false }), L, h) || (L === 'hoje' && t.feitaEm && A.hojeLocal(t.feitaEm) === h)); }) : [];
    const lst = lista(L);
    const conteudo = '<header class="ag-cab"><h2>' + (lst ? '<i class="ag-bola" style="background:' + lst.cor + '"></i>' : '') + esc(nomeLista(L)) + '</h2><div class="grupo-botoes">' + (especial ? (L === 'lixeira' && todas.length ? '<button class="btn mini perigo" data-ag="esvaziar">Esvaziar lixeira</button>' : '') : '<select id="ag-grupo" aria-label="Agrupar">' + opcoes([{ v: 'data', t: 'Agrupar por data' }, { v: 'prioridade', t: 'Agrupar por prioridade' }, { v: 'nenhum', t: 'Sem grupos' }], est.grupo) + '</select>') + (lst ? '<button class="btn mini" data-ag="editar-lista">Editar lista</button>' : '') + '</div></header>' +
      (especial ? '' : '<form class="ag-add" id="ag-add"><input id="ag-novo" autocomplete="off" placeholder="+ Adicionar tarefa em &quot;' + esc(nomeLista(L)) + '&quot; — ex.: Enviar proposta amanhã 14h !alta #cliente"><div class="ag-prev" id="ag-prev"></div></form>') +
      (todas.length ? grupos.map(function (g) { return (g.titulo ? '<h3 class="ag-grupo' + (g.chave === 'atrasadas' ? ' atras' : '') + '">' + esc(g.titulo) + ' <small>' + g.tarefas.length + '</small>' + (g.chave === 'atrasadas' ? ' <button class="btn mini" data-ag="reagendar">Mover para hoje</button>' : '') + '</h3>' : '') + '<ul class="ag-lista">' + g.tarefas.map(function (t) { return linhaTarefa(t, { lista: !lst }); }).join('') + '</ul>'; }).join('')
        : '<div class="ag-vazio"><div>' + ({ hoje: '☀️', lixeira: '🗑️', concluidas: '✅' }[L] || '📝') + '</div><h3>' + (L === 'hoje' ? 'Nada para hoje' : L === 'lixeira' ? 'Lixeira vazia' : L === 'concluidas' ? 'Nenhuma tarefa concluída' : 'Sem tarefas') + '</h3>' + (especial ? '' : '<p>Digite acima. A adição rápida entende:<br><code>amanhã 14h</code> <code>sexta</code> <code>05/11</code> <code>dia 15</code> <code>em 3 dias</code> <code>todo dia útil</code> <code>toda segunda e quinta</code> <code>!alta</code> <code>#tag</code> <code>^lista</code></p>') + '</div>') +
      (feitasLista.length ? '<h3 class="ag-grupo ag-feitas-t"><button class="btn-link" data-ag="ver-feitas">' + (est.mostraFeitas ? '▾' : '▸') + ' Concluídas</button> <small>' + feitasLista.length + '</small></h3>' + (est.mostraFeitas ? '<ul class="ag-lista">' + feitasLista.map(function (t) { return linhaTarefa(t); }).join('') + '</ul>' : '') : '');
    casca(el, 'tarefas', conteudo, lateralTarefas());
    const inp = el.querySelector('#ag-novo');
    if (inp) { inp.oninput = function () { el.querySelector('#ag-prev').innerHTML = inp.value.trim() ? preview(inp.value) : ''; }; el.querySelector('#ag-add').onsubmit = function (ev) { ev.preventDefault(); const t = criar(inp.value, extraDaLista(L)); if (!t) return; inp.value = ''; App.redesenhar(); const n = document.getElementById('ag-novo'); if (n) n.focus(); if (t.data && !A.naLista(t, L, hoje())) aviso('Tarefa criada em ' + nomeLista(t.lista) + ' para ' + rotuloData(t) + '.'); }; }
    const g = el.querySelector('#ag-grupo'); if (g) g.onchange = function () { est.grupo = g.value; App.redesenhar(); };
    ligarComum(el);
    // arrastar tarefa para lista (lateral) ou para reordenar
    el.ondragstart = function (ev) { const li = ev.target.closest && ev.target.closest('[data-t]'); if (li) { ev.dataTransfer.setData('text/agenda', li.dataset.t); ev.dataTransfer.effectAllowed = 'move'; } };
    el.querySelectorAll('[data-soltar]').forEach(function (a) {
      a.addEventListener('dragover', function (ev) { if (Array.prototype.indexOf.call(ev.dataTransfer.types, 'text/agenda') >= 0) { ev.preventDefault(); a.classList.add('alvo'); } });
      a.addEventListener('dragleave', function () { a.classList.remove('alvo'); });
      a.addEventListener('drop', function (ev) { ev.preventDefault(); const t = tarefa(ev.dataTransfer.getData('text/agenda')); if (!t) return; const k = a.dataset.soltar; const h = hoje(); if (k === 'hoje') t.data = h; else if (k === 'amanha') t.data = A.somar(h, 1); else if (k === 'semana') t.data = t.data || h; else if (k === 'lixeira') { t.excluida = true; t.excluidaEm = new Date().toISOString(); } else if (k === 'concluidas') A.concluir(t, null, ehUtil); else if (k === 'todas') { /* nada */ } else t.lista = k; salvar(); App.redesenhar(); });
    });
    el.querySelectorAll('.ag-lista [data-t]').forEach(function (li) {
      li.addEventListener('dragover', function (ev) { if (Array.prototype.indexOf.call(ev.dataTransfer.types, 'text/agenda') >= 0) { ev.preventDefault(); li.classList.add('alvo'); } });
      li.addEventListener('dragleave', function () { li.classList.remove('alvo'); });
      li.addEventListener('drop', function (ev) { ev.preventDefault(); const t = tarefa(ev.dataTransfer.getData('text/agenda')), alvo = tarefa(li.dataset.t); if (!t || t === alvo) return; t.ordem = (alvo.ordem || 0) - 1; t.prioridade = alvo.prioridade; if (est.grupo === 'data' && alvo.data !== t.data && !t.recorrencia) t.data = alvo.data; salvar(); App.redesenhar(); });
    });
  }

  // ---------- detalhe ----------
  function detalhe(t) {
    const a = e(); const rec = t.recorrencia; const recV = !rec ? '' : rec.tipo === 'uteis' ? 'uteis' : rec.intervalo > 1 || (rec.tipo === 'semanal' && rec.dias && rec.dias.length > 1) || rec.ate ? 'perso' : rec.tipo;
    return '<aside class="ag-det" id="ag-det" data-id="' + t.id + '"><header><button class="ag-chk ag-pr' + (t.prioridade || 0) + '" data-chk="' + t.id + '">' + (t.feita ? '✓' : '') + '</button><div class="ag-flags">' + [3, 2, 1, 0].map(function (p) { return '<button class="ag-flag ag-pr' + p + (t.prioridade === p ? ' sel' : '') + '" data-pr="' + p + '" title="' + A.PRIORIDADES[p].nome + '">⚑</button>'; }).join('') + '</div><button class="icone" data-ag="fechar-det" aria-label="Fechar">×</button></header>' +
      '<input class="ag-det-tit" data-f="titulo" value="' + esc(t.titulo) + '" aria-label="Título">' +
      '<div class="ag-det-grade"><label>📅 <input type="date" data-f="data" value="' + esc(t.data || '') + '"></label><label>🕒 <input type="time" data-f="hora" value="' + esc(t.hora || '') + '"></label>' +
      '<label>⏳ <select data-f="duracao">' + opcoes([15, 30, 45, 60, 90, 120, 180, 240].map(function (m) { return { v: m, t: m < 60 ? m + ' min' : (m / 60) + ' h' }; }), t.duracao || 30) + '</select></label>' +
      '<label>🔔 <select data-f="lembrete">' + opcoes(LEMBRETES, t.lembrete == null ? '' : String(t.lembrete)) + '</select></label>' +
      '<label>↻ <select data-f="repetir">' + opcoes([{ v: '', t: 'Não repete' }, { v: 'diaria', t: 'Todo dia' }, { v: 'uteis', t: 'Dias úteis (seg–sex)' }, { v: 'semanal', t: 'Toda semana' }, { v: 'mensal', t: 'Todo mês' }, { v: 'anual', t: 'Todo ano' }, { v: 'perso', t: rec && recV === 'perso' ? A.descreverRecorrencia(rec) : 'Personalizar…' }], recV) + '</select></label>' +
      '<label>▤ <select data-f="lista">' + opcoes([{ v: 'inbox', t: 'Caixa de entrada' }].concat(a.listas.map(function (l) { return { v: l.id, t: l.nome }; })), t.lista || 'inbox') + '</select></label></div>' +
      '<input class="ag-det-tags" data-f="tags" value="' + esc((t.tags || []).map(function (g) { return '#' + g; }).join(' ')) + '" placeholder="#tags">' +
      '<textarea class="ag-det-notas" data-f="notas" rows="4" placeholder="Descrição">' + esc(t.notas || '') + '</textarea>' +
      '<h4>Subtarefas</h4><ul class="ag-sub">' + (t.subtarefas || []).map(function (s) { return '<li data-s="' + s.id + '"><input type="checkbox"' + (s.feita ? ' checked' : '') + ' data-sf aria-label="Concluir subtarefa"><input data-st value="' + esc(s.t) + '" class="' + (s.feita ? 'feita' : '') + '"><button class="icone" data-sx aria-label="Excluir">×</button></li>'; }).join('') + '</ul><input class="ag-sub-add" id="ag-sub-add" placeholder="+ Adicionar subtarefa">' +
      (t.historico && t.historico.length ? '<p class="mini mudo">Concluída ' + t.historico.length + ' vez(es) · última ' + dataHora(t.historico[t.historico.length - 1].em) + '</p>' : '') +
      '<footer>' + (t.excluida ? '<button class="btn mini" data-ag="restaurar">Restaurar</button><button class="btn mini perigo" data-ag="apagar">Excluir de vez</button>' : '<button class="btn mini" data-ag="foco">⏱ Focar</button>' + (t.data ? '<a class="btn mini" target="_blank" rel="noopener" href="' + esc(UI.url(A.linkGoogle(t))) + '">Google Agenda</a>' : '') + '<button class="btn mini" data-ag="duplicar">Duplicar</button><button class="btn mini perigo" data-ag="excluir">Excluir</button>') + '<small class="mudo">Criada ' + dataHora(t.criadaEm) + '</small></footer></aside>';
  }
  async function personalizar(t) {
    const r0 = t.recorrencia || { tipo: 'semanal', intervalo: 1, dias: [A.semana(t.data || hoje())] };
    const r = await modal({ titulo: 'Repetição personalizada', corpo: '<div class="linha">' + campo('A cada', '<input name="n" type="number" min="1" value="' + (r0.intervalo || 1) + '">') + campo('Período', '<select name="tipo">' + opcoes([{ v: 'diaria', t: 'dia(s)' }, { v: 'semanal', t: 'semana(s)' }, { v: 'mensal', t: 'mês(es)' }, { v: 'anual', t: 'ano(s)' }], r0.tipo === 'uteis' ? 'semanal' : r0.tipo) + '</select>') + '</div><fieldset><legend>Dias da semana (se semanal)</legend><div class="grade-checks">' + A.DIAS_CURTO.map(function (d, i) { return '<label><input type="checkbox" name="d" value="' + i + '"' + ((r0.dias || []).indexOf(i) >= 0 ? ' checked' : '') + '> ' + d + '</label>'; }).join('') + '</div></fieldset>' + campo('Termina em (opcional)', '<input type="date" name="ate" value="' + esc(r0.ate || '') + '">') });
    if (!r) return; t.recorrencia = { tipo: r.get('tipo'), intervalo: Math.max(1, Number(r.get('n')) || 1) }; if (t.recorrencia.tipo === 'semanal') t.recorrencia.dias = r.getAll('d').map(Number).sort(); if (r.get('ate')) t.recorrencia.ate = r.get('ate'); if (!t.data) t.data = hoje(); salvar(); App.redesenhar();
  }
  function salvarCampo(t, f, v) {
    if (f === 'titulo') { if (v.trim()) t.titulo = v.trim(); }
    else if (f === 'data') { t.data = v || null; if (!v) { t.hora = null; t.recorrencia = null; } }
    else if (f === 'hora') { t.hora = v || null; if (v && !t.data) t.data = hoje(); if (v && t.lembrete == null) t.lembrete = 0; }
    else if (f === 'duracao') t.duracao = Number(v);
    else if (f === 'lembrete') { t.lembrete = v === '' ? null : Number(v); if (t.lembrete != null && !t.data) t.data = hoje(); if (t.lembrete != null && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); t.notificado = null; }
    else if (f === 'repetir') { if (v === 'perso') return personalizar(t); if (!v) t.recorrencia = null; else { if (!t.data) t.data = hoje(); t.recorrencia = { tipo: v, intervalo: 1 }; if (v === 'semanal') t.recorrencia.dias = [A.semana(t.data)]; } }
    else if (f === 'lista') t.lista = v;
    else if (f === 'tags') t.tags = v.split(/[\s,]+/).map(function (x) { return x.replace(/^#/, '').trim(); }).filter(Boolean).filter(function (x, i, a) { return a.indexOf(x) === i; });
    else if (f === 'notas') t.notas = v;
    salvar(); App.redesenhar();
  }

  // eventos comuns a todas as vistas (lista, detalhe, configurações)
  function ligarComum(el) {
    el.onclick = async function (ev) {
      const chk = ev.target.closest('[data-chk]'); if (chk) { ev.stopPropagation(); concluir(tarefa(chk.dataset.chk)); App.redesenhar(); return; }
      const pr = ev.target.closest('[data-pr]'); if (pr) { const t = tarefa(est.sel); t.prioridade = Number(pr.dataset.pr); salvar(); App.redesenhar(); return; }
      const sx = ev.target.closest('[data-sx]'); if (sx) { const t = tarefa(est.sel); t.subtarefas = t.subtarefas.filter(function (s) { return s.id !== sx.closest('[data-s]').dataset.s; }); salvar(); App.redesenhar(); return; }
      const a = ev.target.closest('[data-ag]'); if (a) { await acao(a.dataset.ag, a); return; }
      const li = ev.target.closest('[data-t]'); if (li && !ev.target.closest('a')) { est.sel = est.sel === li.dataset.t ? null : li.dataset.t; App.redesenhar(); return; }
      const ex = ev.target.closest('[data-ext]'); if (ex) { location.hash = ex.dataset.ext; }
    };
    el.onchange = function (ev) {
      const det = ev.target.closest('#ag-det'); if (!det) return; const t = tarefa(det.dataset.id);
      if (ev.target.dataset.f) return salvarCampo(t, ev.target.dataset.f, ev.target.value);
      const s = ev.target.closest('[data-s]'); if (s) { const st = t.subtarefas.find(function (x) { return x.id === s.dataset.s; }); if (ev.target.hasAttribute('data-sf')) st.feita = ev.target.checked; if (ev.target.hasAttribute('data-st')) st.t = ev.target.value; salvar(); if (ev.target.hasAttribute('data-sf')) App.redesenhar(); }
    };
    el.onkeydown = function (ev) {
      if (ev.target.id === 'ag-sub-add' && ev.key === 'Enter' && ev.target.value.trim()) { const t = tarefa(est.sel); t.subtarefas = t.subtarefas || []; t.subtarefas.push({ id: Dados.id('ags'), t: ev.target.value.trim(), feita: false }); salvar(); App.redesenhar(); const n = document.getElementById('ag-sub-add'); if (n) n.focus(); }
      if (ev.target.classList && ev.target.classList.contains('ag-det-tit') && ev.key === 'Enter') ev.target.blur();
    };
  }
  async function acao(k, b) {
    const t = est.sel && tarefa(est.sel); const a = e();
    if (k === 'fechar-det') { est.sel = null; App.redesenhar(); }
    if (k === 'excluir' && t) { t.excluida = true; t.excluidaEm = new Date().toISOString(); est.sel = null; salvar(); aviso('Movida para a lixeira.'); App.redesenhar(); }
    if (k === 'restaurar' && t) { t.excluida = false; salvar(); App.redesenhar(); }
    if (k === 'apagar' && t) { a.tarefas = a.tarefas.filter(function (x) { return x !== t; }); est.sel = null; salvar(); App.redesenhar(); }
    if (k === 'duplicar' && t) { const c = JSON.parse(JSON.stringify(t)); c.id = Dados.id('agt'); c.titulo += ' (cópia)'; c.criadaEm = new Date().toISOString(); c.historico = []; c.feita = false; a.tarefas.push(c); est.sel = c.id; salvar(); App.redesenhar(); }
    if (k === 'foco' && t) { Pomo.tarefa = t.id; location.hash = '#/agenda/foco'; }
    if (k === 'esvaziar' && await confirmar('Esvaziar lixeira', 'Excluir de vez as tarefas da lixeira?', 'Esvaziar')) { a.tarefas = a.tarefas.filter(function (x) { return !x.excluida; }); salvar(); App.redesenhar(); }
    if (k === 'reagendar') { const h = hoje(); a.tarefas.forEach(function (x) { if (A.ativa(x) && x.data && x.data < h) x.data = h; }); salvar(); App.redesenhar(); }
    if (k === 'ver-feitas') { est.mostraFeitas = !est.mostraFeitas; App.redesenhar(); }
    if (k === 'nova-lista' || k === 'editar-lista') {
      const l = k === 'editar-lista' ? lista(est.lista) : null;
      const r = await modal({ titulo: l ? 'Editar lista' : 'Nova lista', corpo: campo('Nome', '<input name="n" required value="' + esc(l ? l.nome : '') + '" placeholder="ex.: Papelaria Exemplo, Pregões GO, Pessoal">') + '<fieldset><legend>Cor</legend><div class="ag-cores">' + CORES_LISTA.map(function (c, i) { return '<label><input type="radio" name="c" value="' + c + '"' + ((l ? l.cor === c : i === a.listas.length % CORES_LISTA.length) ? ' checked' : '') + '><i style="background:' + c + '"></i></label>'; }).join('') + '</div></fieldset>' + (l ? '<button type="button" class="btn perigo" data-excluir-lista>Excluir lista</button>' : ''),
        aoAbrir: function (form) { const x = form.querySelector('[data-excluir-lista]'); if (x) x.onclick = async function () { form.closest('.modal-fundo').remove(); if (await confirmar('Excluir lista', 'Excluir "' + esc(l.nome) + '"? As tarefas vão para a Caixa de entrada.', 'Excluir')) { a.tarefas.forEach(function (t) { if (t.lista === l.id) t.lista = 'inbox'; }); a.listas = a.listas.filter(function (y) { return y !== l; }); salvar(); location.hash = '#/agenda/tarefas/inbox'; } }; } });
      if (!r) return; if (l) { l.nome = r.get('n').trim(); l.cor = r.get('c'); } else { const nl = { id: Dados.id('agl'), nome: r.get('n').trim(), cor: r.get('c') }; a.listas.push(nl); location.hash = '#/agenda/tarefas/' + nl.id; } salvar(); App.redesenhar();
    }
    if (k === 'config') configurar();
    void b;
  }

  async function configurar() {
    const a = e(); const p = a.pref;
    const r = await modal({ titulo: 'Ajustes da Seven Task', corpo: '<fieldset><legend>Foco (Pomodoro)</legend><div class="linha">' + campo('Foco (min)', '<input name="pomo" type="number" min="5" max="120" value="' + p.pomo + '">') + campo('Pausa curta', '<input name="pausa" type="number" min="1" max="30" value="' + p.pausa + '">') + campo('Pausa longa', '<input name="longa" type="number" min="5" max="60" value="' + p.longa + '">') + campo('Pausa longa a cada', '<input name="ciclo" type="number" min="2" max="8" value="' + p.ciclo + '">') + '</div></fieldset>' +
      '<fieldset><legend>Calendário</legend><label class="check"><input type="checkbox" name="licita"' + (p.licita ? ' checked' : '') + '> Mostrar sessões e prazos de cotação e os prazos do Seven Hub</label>' + campo('Semana começa no', '<select name="ini">' + opcoes([{ v: 0, t: 'Domingo' }, { v: 1, t: 'Segunda' }], p.inicioSemana) + '</select>') + '</fieldset>' +
      '<fieldset><legend>Lembretes</legend><p class="mini">Notificações do navegador: <b>' + ('Notification' in window ? { granted: 'ativadas', denied: 'bloqueadas no navegador', default: 'não ativadas' }[Notification.permission] : 'indisponíveis') + '</b>. Os lembretes funcionam com o sistema aberto.</p>' + ('Notification' in window && Notification.permission === 'default' ? '<button type="button" class="btn" data-notif>Ativar notificações</button>' : '') + '</fieldset>' +
      '<fieldset><legend>Exportar / importar</legend><div class="grupo-botoes"><button type="button" class="btn" data-ics>Exportar .ics (Google, Outlook, celular)</button><button type="button" class="btn" data-imp-ics>Importar .ics</button></div></fieldset>',
      aoAbrir: function (form) {
        form.addEventListener('click', async function (ev) {
          if (ev.target.closest('[data-notif]')) Notification.requestPermission().then(function (x) { aviso(x === 'granted' ? 'Notificações ativadas.' : 'Notificações não permitidas.'); });
          if (ev.target.closest('[data-ics]')) UI.baixar('agenda-seven.ics', A.ics(a.tarefas.filter(A.ativa)), 'text/calendar;charset=utf-8');
          if (ev.target.closest('[data-imp-ics]')) { const f = await UI.escolherArquivo('.ics', false); if (!f) return; const evs = A.lerICS(await f.text()); evs.forEach(function (x) { a.tarefas.push({ id: Dados.id('agt'), titulo: x.titulo, notas: x.notas || '', lista: 'inbox', data: x.data, hora: x.hora || null, duracao: 30, lembrete: null, prioridade: 0, tags: ['importado'], subtarefas: [], recorrencia: x.recorrencia || null, criadaEm: new Date().toISOString(), ordem: Date.now() }); }); salvar(); aviso(evs.length + ' evento(s) importados como tarefas (#importado).'); }
        });
      } });
    if (!r) return; ['pomo', 'pausa', 'longa', 'ciclo'].forEach(function (k) { p[k] = Math.max(1, Number(r.get(k)) || p[k]); }); p.licita = !!r.get('licita'); p.inicioSemana = Number(r.get('ini')); salvar(); if (!Pomo.rodando) Pomo.reiniciar(); App.redesenhar();
  }

  // ---------- calendário ----------
  function eventosLicita(de, ate) {
    if (!e().pref.licita) return []; const out = [];
    (Dados.e.cotacoes || []).forEach(function (c) {
      if (c.status === 'cancelada') return;
      if (c.prazoResposta && c.prazoResposta >= de && c.prazoResposta <= ate && c.status !== 'concluida') out.push({ data: c.prazoResposta, titulo: 'Prazo cotação ' + c.numero, tipo: 'cotacao', link: '#/cotacoes/ver/' + c.id });
      const s = c.licitacao && c.licitacao.dataSessao; if (s && s.slice(0, 10) >= de && s.slice(0, 10) <= ate) out.push({ data: s.slice(0, 10), hora: s.length > 10 ? s.slice(11, 16) : null, titulo: 'Sessão ' + (c.licitacao.numero || c.titulo), tipo: 'sessao', link: '#/cotacoes/ver/' + c.id });
    });
    try { Telas.quadros.todosCartoes().forEach(function (x) { const c = x.cartao; if (!c.prazo || c.concluido || c.arquivado || x.quadro.arquivado) return; const dt = new Date(c.prazo); const s = A.hojeLocal(dt); if (s < de || s > ate) return; const hh = ('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2); out.push({ data: s, hora: hh === '00:00' ? null : hh, titulo: c.titulo || c.nome || 'Cartão', tipo: 'quadro', link: '#/quadros/' + x.quadro.id }); }); } catch (err) { /* sem quadros */ }
    // Prazos de todas as outras ferramentas (Seven Bid, Sniper, Watch, Sign, Docs, Hub, Pay e Sales), sem lançar de novo.
    if (self.Integracao) Integracao.eventosAgenda(Dados.e, de, ate).forEach(function (x) { out.push(x); });
    return out;
  }
  function itensPeriodo(de, ate) {
    const out = [];
    e().tarefas.forEach(function (t) { if (t.excluida || !t.data) return; if (t.feita) { if (t.data >= de && t.data <= ate) out.push({ t: t, data: t.data }); return; } A.ocorrencias(t, de, ate).forEach(function (x, i) { out.push({ t: t, data: x, repeticao: i > 0 || x !== t.data }); }); });
    return out.sort(function (a, b) { return a.data.localeCompare(b.data) || String(a.t.hora || '99').localeCompare(String(b.t.hora || '99')) || (b.t.prioridade || 0) - (a.t.prioridade || 0); });
  }
  function chip(i) { const t = i.t; return '<div class="ag-ev ag-ev-pr' + (t.prioridade || 0) + (t.feita ? ' feita' : '') + (i.repeticao ? ' rep' : '') + '" data-t="' + t.id + '" draggable="' + (!i.repeticao) + '" title="' + esc(t.titulo) + '">' + (t.hora ? '<b>' + t.hora + '</b> ' : '') + esc(t.titulo) + '</div>'; }
  function chipExt(x) { return '<div class="ag-ev ag-ext ag-ext-' + x.tipo + '" data-ext="' + esc(x.link) + '" title="' + esc(x.titulo) + '">' + (x.hora ? '<b>' + x.hora + '</b> ' : '') + esc(x.titulo) + '</div>'; }
  function telaCalendario(el, modo) {
    est.calModo = modo || est.calModo; const p = e().pref; const ref = est.calRef || hoje(); const h = hoje();
    let de, ate, titulo, corpo;
    if (est.calModo === 'mes') {
      const ini = ref.slice(0, 8) + '01'; de = A.somar(ini, -((A.semana(ini) - p.inicioSemana + 7) % 7)); ate = A.somar(de, 41);
      const its = itensPeriodo(de, ate), ext = eventosLicita(de, ate);
      titulo = MESES[Number(ref.slice(5, 7)) - 1].replace(/^./, function (c) { return c.toUpperCase(); }) + ' de ' + ref.slice(0, 4);
      corpo = '<div class="ag-mes"><div class="ag-mes-cab">' + [0, 1, 2, 3, 4, 5, 6].map(function (k) { return '<span>' + A.DIAS_CURTO[(k + p.inicioSemana) % 7] + '</span>'; }).join('') + '</div><div class="ag-mes-grade">' + Array.from({ length: 42 }, function (x, k) { const dia = A.somar(de, k); const doDia = its.filter(function (i) { return i.data === dia; }), exDia = ext.filter(function (x) { return x.data === dia; }); const todos = exDia.map(chipExt).concat(doDia.map(chip)); return '<div class="ag-dia' + (dia.slice(0, 7) !== ref.slice(0, 7) ? ' fora' : '') + (dia === h ? ' hoje' : '') + '" data-dia="' + dia + '"><span class="ag-dia-n">' + Number(dia.slice(8)) + '</span>' + todos.slice(0, 4).join('') + (todos.length > 4 ? '<button class="btn-link mini" data-mais="' + dia + '">+' + (todos.length - 4) + ' mais</button>' : '') + '</div>'; }).join('') + '</div></div>';
    } else {
      const n = est.calModo === 'semana' ? 7 : 1; de = est.calModo === 'semana' ? A.somar(ref, -((A.semana(ref) - p.inicioSemana + 7) % 7)) : ref; ate = A.somar(de, n - 1);
      const its = itensPeriodo(de, ate), ext = eventosLicita(de, ate); const ds = Array.from({ length: n }, function (x, k) { return A.somar(de, k); });
      titulo = n === 1 ? ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][A.semana(de)] + ', ' + Number(de.slice(8)) + ' de ' + MESES[Number(de.slice(5, 7)) - 1] : Number(de.slice(8)) + ' de ' + MESES[Number(de.slice(5, 7)) - 1] + ' – ' + Number(ate.slice(8)) + ' de ' + MESES[Number(ate.slice(5, 7)) - 1];
      const HORA = 48;
      titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1);
      corpo = '<div class="ag-sem" style="--n:' + n + '"><div class="ag-sem-cab"><span></span>' + ds.map(function (d) { return '<span class="' + (d === h ? 'hoje' : '') + '">' + A.DIAS_CURTO[A.semana(d)] + ' <b>' + Number(d.slice(8)) + '</b></span>'; }).join('') + '</div>' +
        '<div class="ag-sem-dia"><span class="mini mudo">dia todo</span>' + ds.map(function (d) { return '<div data-dia="' + d + '">' + ext.filter(function (x) { return x.data === d && !x.hora; }).map(chipExt).join('') + its.filter(function (i) { return i.data === d && !i.t.hora; }).map(chip).join('') + '</div>'; }).join('') + '</div>' +
        '<div class="ag-sem-corpo" id="ag-sem-corpo"><div class="ag-horas">' + Array.from({ length: 24 }, function (x, k) { return '<span style="top:' + k * HORA + 'px">' + ('0' + k).slice(-2) + ':00</span>'; }).join('') + '</div>' + ds.map(function (d) { return '<div class="ag-col' + (d === h ? ' hoje' : '') + '" data-col="' + d + '" style="height:' + 24 * HORA + 'px">' + ext.filter(function (x) { return x.data === d && x.hora; }).map(function (x) { const m = Number(x.hora.slice(0, 2)) * 60 + Number(x.hora.slice(3)); return '<div class="ag-bloco ag-ext ag-ext-' + x.tipo + '" data-ext="' + esc(x.link) + '" style="top:' + m / 60 * HORA + 'px;height:' + HORA * 0.75 + 'px"><b>' + x.hora + '</b> ' + esc(x.titulo) + '</div>'; }).join('') + its.filter(function (i) { return i.data === d && i.t.hora; }).map(function (i) { const t = i.t; const m = Number(t.hora.slice(0, 2)) * 60 + Number(t.hora.slice(3)); return '<div class="ag-bloco ag-ev-pr' + (t.prioridade || 0) + (t.feita ? ' feita' : '') + '" data-t="' + t.id + '" draggable="' + (!i.repeticao) + '" style="top:' + m / 60 * HORA + 'px;height:' + Math.max(22, (t.duracao || 30) / 60 * HORA - 2) + 'px"><b>' + t.hora + '</b> ' + esc(t.titulo) + '</div>'; }).join('') + (d === h ? '<i class="ag-agora" style="top:' + (new Date().getHours() * 60 + new Date().getMinutes()) / 60 * HORA + 'px"></i>' : '') + '</div>'; }).join('') + '</div></div>';
    }
    const conteudo = '<header class="ag-cab"><div class="grupo-botoes"><button class="btn mini" data-nav="-1" aria-label="Anterior">‹</button><button class="btn mini" data-nav="0">Hoje</button><button class="btn mini" data-nav="1" aria-label="Próximo">›</button><h2 class="ag-cal-tit">' + esc(titulo) + '</h2></div><div class="pilulas" style="margin:0">' + [['mes', 'Mês'], ['semana', 'Semana'], ['dia', 'Dia']].map(function (x) { return '<a class="pilula ' + (est.calModo === x[0] ? 'ativa' : '') + '" href="#/agenda/calendario/' + x[0] + '">' + x[1] + '</a>'; }).join('') + '</div></header>' + corpo + '<p class="mini mudo">Dê dois cliques num dia para criar tarefa · arraste para remarcar' + (e().pref.licita ? ' · <span class="ag-ext-legenda">■</span> prazos das outras ferramentas: sessões, cotações, Seven Hub, certidões, contratos, pagamentos e Seven Sales' : '') + '</p>';
    casca(el, 'calendario', conteudo, '');
    ligarComum(el); const comum = el.onclick;
    el.onclick = function (ev) {
      const nv = ev.target.closest('[data-nav]'); if (nv) { const k = Number(nv.dataset.nav); est.calRef = k === 0 ? hoje() : est.calModo === 'mes' ? A.somarMeses(ref.slice(0, 8) + '01', k) : A.somar(ref, k * (est.calModo === 'semana' ? 7 : 1)); App.redesenhar(); return; }
      const mais = ev.target.closest('[data-mais]'); if (mais) { est.calRef = mais.dataset.mais; location.hash = '#/agenda/calendario/dia'; return; }
      return comum(ev);
    };
    el.ondblclick = async function (ev) {
      const dia = ev.target.closest('[data-dia],[data-col]'); if (!dia || ev.target.closest('[data-t],[data-ext]')) return; const d = dia.dataset.dia || dia.dataset.col; let hora = null;
      if (dia.dataset.col) { const y = ev.clientY - dia.getBoundingClientRect().top; const m = Math.floor(y / 48 * 4) * 15; hora = ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2); }
      const r = await modal({ titulo: 'Nova tarefa em ' + d.slice(8) + '/' + d.slice(5, 7) + (hora ? ' às ' + hora : ''), botao: 'Criar', corpo: campo('Tarefa', '<input name="t" required autocomplete="off" placeholder="ex.: Conferir habilitação !alta #cliente">') });
      if (!r) return; const t = criar(r.get('t'), { data: d, hora: hora }); if (t && hora && !A.interpretar(r.get('t')).hora) t.hora = hora; salvar(); App.redesenhar();
    };
    el.ondragstart = function (ev) { const x = ev.target.closest && ev.target.closest('[data-t]'); if (x) { ev.dataTransfer.setData('text/agenda', x.dataset.t); est.agarre = ev.offsetY || 0; } };
    el.querySelectorAll('[data-dia],[data-col]').forEach(function (z) {
      z.addEventListener('dragover', function (ev) { if (Array.prototype.indexOf.call(ev.dataTransfer.types, 'text/agenda') >= 0) { ev.preventDefault(); z.classList.add('alvo'); } });
      z.addEventListener('dragleave', function () { z.classList.remove('alvo'); });
      z.addEventListener('drop', function (ev) { ev.preventDefault(); const t = tarefa(ev.dataTransfer.getData('text/agenda')); if (!t) return; t.data = z.dataset.dia || z.dataset.col; if (z.dataset.col) { const y = ev.clientY - z.getBoundingClientRect().top - (est.agarre || 0); const m = Math.max(0, Math.min(23 * 60 + 45, Math.round(y / 48 * 4) * 15)); t.hora = ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2); } else if (z.closest('.ag-sem-dia')) t.hora = null; t.notificado = null; salvar(); App.redesenhar(); });
    });
    const corpoS = el.querySelector('#ag-sem-corpo'); if (corpoS) corpoS.scrollTop = 7 * 48;
  }

  // ---------- matriz ----------
  function telaMatriz(el) {
    const ts = e().tarefas.filter(A.ativa);
    const conteudo = '<header class="ag-cab"><h2>Matriz de Eisenhower</h2><small class="mudo">Arraste entre os quadrantes para mudar a prioridade</small></header><div class="ag-matriz">' + A.QUADRANTES.map(function (q, k) { const its = ts.filter(function (t) { return (t.prioridade || 0) === q.p; }).sort(A.comparar); return '<section class="ag-q ag-q' + k + '" data-q="' + q.p + '"><header><b>' + ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ'][k] + ' ' + q.nome + '</b><small>' + q.dica + ' · ' + its.length + '</small></header><form data-qadd="' + q.p + '"><input placeholder="+ Adicionar"></form><ul class="ag-lista">' + its.map(function (t) { return linhaTarefa(t, { lista: true }); }).join('') + '</ul></section>'; }).join('') + '</div>';
    casca(el, 'matriz', conteudo, ''); ligarComum(el);
    el.querySelectorAll('[data-qadd]').forEach(function (f) { f.onsubmit = function (ev) { ev.preventDefault(); const i = f.querySelector('input'); const t = criar(i.value, {}); if (!t) return; if (!A.interpretar(i.value).prioridade) t.prioridade = Number(f.dataset.qadd); salvar(); App.redesenhar(); }; });
    el.ondragstart = function (ev) { const x = ev.target.closest && ev.target.closest('[data-t]'); if (x) ev.dataTransfer.setData('text/agenda', x.dataset.t); };
    el.querySelectorAll('[data-q]').forEach(function (q) {
      q.addEventListener('dragover', function (ev) { ev.preventDefault(); q.classList.add('alvo'); }); q.addEventListener('dragleave', function (ev) { if (!q.contains(ev.relatedTarget)) q.classList.remove('alvo'); });
      q.addEventListener('drop', function (ev) { ev.preventDefault(); const t = tarefa(ev.dataTransfer.getData('text/agenda')); if (t) { t.prioridade = Number(q.dataset.q); salvar(); App.redesenhar(); } });
    });
  }

  // ---------- foco (Pomodoro) ----------
  const Pomo = {
    modo: 'foco', restante: null, total: null, rodando: false, tarefa: null, inicio: null, ciclos: 0, timer: null,
    duracao: function (m) { const p = e().pref; return (m === 'foco' ? p.pomo : m === 'pausa' ? p.pausa : p.longa) * 60; },
    reiniciar: function (m) { this.modo = m || this.modo; this.total = this.restante = this.duracao(this.modo); this.rodando = false; this.inicio = null; clearInterval(this.timer); this.timer = null; },
    ativo: function () { return this.rodando || (this.restante != null && this.restante < this.total); },
    texto: function () { const s = Math.max(0, this.restante == null ? this.duracao(this.modo) : this.restante); return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + s % 60).slice(-2); },
    iniciar: function () { if (this.restante == null) this.reiniciar(); this.rodando = true; this.inicio = this.inicio || new Date().toISOString(); const self_ = this; this.fimEm = Date.now() + this.restante * 1000; clearInterval(this.timer); this.timer = setInterval(function () { self_.tique(); }, 250); },
    pausar: function () { this.rodando = false; clearInterval(this.timer); this.timer = null; this.atualizar(); },
    tique: function () { this.restante = Math.max(0, Math.round((this.fimEm - Date.now()) / 1000)); this.atualizar(); if (this.restante <= 0) this.terminar(true); },
    registrar: function (completo) { const min = Math.round((this.total - this.restante) / 60); if (min < 1 && !completo) return; e().foco.push({ id: Dados.id('agf'), inicio: this.inicio || new Date().toISOString(), fim: new Date().toISOString(), minutos: completo ? this.total / 60 : min, tipo: this.modo === 'foco' ? 'foco' : 'pausa', tarefa: this.modo === 'foco' ? this.tarefa : null, completo: !!completo }); salvar(); },
    terminar: function (completo) {
      clearInterval(this.timer); this.timer = null; this.rodando = false; this.registrar(completo);
      if (completo) {
        const eraFoco = this.modo === 'foco'; if (eraFoco) this.ciclos++;
        const msg = eraFoco ? 'Pomodoro concluído! Hora da pausa.' : 'Pausa encerrada. Bora focar!'; aviso('⏱ ' + msg); beep(); notificar('Foco · Seven', msg);
        this.reiniciar(eraFoco ? (this.ciclos % e().pref.ciclo === 0 ? 'longa' : 'pausa') : 'foco');
      } else this.reiniciar();
      document.title = document.title.replace(/^⏱ [\d:]+ · /, ''); App.redesenhar();
    },
    atualizar: function () { const t = this.texto(); const r = document.getElementById('ag-relogio'); if (r) { r.textContent = t; const c = document.getElementById('ag-anel'); if (c) c.style.strokeDashoffset = String(691 * (1 - (this.total - this.restante) / this.total)); } const m = document.getElementById('ag-pomo-mini'); if (m) m.textContent = t; document.title = (this.rodando ? '⏱ ' + t + ' · ' : '') + document.title.replace(/^⏱ [\d:]+ · /, ''); }
  };
  function beep() { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); [0, 0.25, 0.5].forEach(function (d) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.15, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.2); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.22); }); } catch (err) { /* sem áudio */ } }
  function notificar(titulo, corpo) { try { if ('Notification' in window && Notification.permission === 'granted') new Notification(titulo, { body: corpo, icon: 'img/seven-marca.png' }); } catch (err) { /* sem notificação */ } }

  function horas(min) { return min < 60 ? min + ' min' : String(Math.round(min / 6) / 10).replace('.', ',') + ' h'; }
  function telaFoco(el) {
    if (Pomo.restante == null) Pomo.reiniciar('foco');
    const st = A.estatisticasFoco(e().foco, hoje()); const ativas = e().tarefas.filter(A.ativa).sort(A.comparar);
    const hist = e().foco.filter(function (s) { return A.hojeLocal(s.inicio) === hoje(); }).slice().reverse();
    const conteudo = '<header class="ag-cab"><h2>Foco</h2></header><div class="ag-foco"><div class="ag-pomo"><div class="pilulas">' + [['foco', 'Pomo'], ['pausa', 'Pausa curta'], ['longa', 'Pausa longa']].map(function (x) { return '<button class="pilula ' + (Pomo.modo === x[0] ? 'ativa' : '') + '" data-pm="' + x[0] + '"' + (Pomo.rodando ? ' disabled' : '') + '>' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="ag-relogio ag-modo-' + Pomo.modo + '"><svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="110" class="fundo"/><circle cx="120" cy="120" r="110" class="anel" id="ag-anel" style="stroke-dasharray:691;stroke-dashoffset:' + 691 * (1 - (Pomo.total - Pomo.restante) / Pomo.total) + '"/></svg><div><b id="ag-relogio">' + Pomo.texto() + '</b><small>' + (Pomo.modo === 'foco' ? 'Foco' : 'Pausa') + '</small></div></div>' +
      '<select id="ag-pomo-t" aria-label="Tarefa em foco"><option value="">Focar sem tarefa</option>' + opcoes(ativas.map(function (t) { return { v: t.id, t: t.titulo + (t.data ? ' · ' + rotuloData(t) : '') }; }), Pomo.tarefa || '') + '</select>' +
      '<div class="grupo-botoes">' + (Pomo.rodando ? '<button class="btn" data-pa="pausar">Pausar</button>' : '<button class="btn primario" data-pa="iniciar">' + (Pomo.restante < Pomo.total ? 'Continuar' : 'Iniciar') + '</button>') + (Pomo.ativo() ? '<button class="btn" data-pa="parar">Encerrar</button>' : '') + '<button class="btn" data-pa="pular">Pular ⏭</button></div></div>' +
      '<div class="ag-foco-stats"><div class="kpis pequenos"><div><span>Pomos hoje</span><b>' + st.pomosHoje + '</b></div><div><span>Foco hoje</span><b>' + st.minutosHoje + ' min</b></div><div><span>Últimos 7 dias</span><b>' + horas(st.minutosSemana) + '</b></div><div><span>Total</span><b>' + horas(st.total) + '</b></div></div><h3>Registro de hoje</h3>' + (hist.length ? '<ol class="fo-linha">' + hist.map(function (s) { const t = s.tarefa && tarefa(s.tarefa); return '<li><small>' + new Date(s.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' · ' + s.minutos + ' min' + (s.tipo === 'pausa' ? ' · pausa' : s.completo ? ' · 🍅' : ' · interrompido') + '</small><p>' + esc(t ? t.titulo : s.tipo === 'pausa' ? 'Pausa' : 'Foco livre') + '</p></li>'; }).join('') + '</ol>' : '<p class="mudo">Nenhuma sessão hoje. Técnica Pomodoro: blocos de foco com pausas curtas e uma pausa longa a cada ' + e().pref.ciclo + ' blocos.</p>') + '</div></div>';
    casca(el, 'foco', conteudo, ''); ligarComum(el); const comum = el.onclick;
    el.querySelector('#ag-pomo-t').onchange = function () { Pomo.tarefa = this.value || null; };
    el.onclick = function (ev) {
      const pm = ev.target.closest('[data-pm]'); if (pm && !Pomo.rodando) { Pomo.reiniciar(pm.dataset.pm); App.redesenhar(); return; }
      const pa = ev.target.closest('[data-pa]'); if (pa) { const k = pa.dataset.pa; if (k === 'iniciar') { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); Pomo.iniciar(); } if (k === 'pausar') Pomo.pausar(); if (k === 'parar') Pomo.terminar(false); if (k === 'pular') { Pomo.registrar(false); Pomo.reiniciar(Pomo.modo === 'foco' ? 'pausa' : 'foco'); } App.redesenhar(); return; }
      return comum(ev);
    };
  }

  // ---------- hábitos ----------
  function telaHabitos(el) {
    const a = e(); const h = hoje(); const ult = Array.from({ length: 7 }, function (x, k) { return A.somar(h, k - 6); });
    const sel = est.habSel && a.habitos.find(function (x) { return x.id === est.habSel; });
    let det = '';
    if (sel) { const ini = h.slice(0, 8) + '01'; const de = A.somar(ini, -A.semana(ini)); det = '<section class="cartao ag-hab-det"><header><h3>' + esc((sel.emoji || '') + ' ' + sel.nome) + '</h3><div class="grupo-botoes"><button class="btn mini" data-hb="editar">Editar</button><button class="btn mini perigo" data-hb="excluir">Excluir</button><button class="icone" data-hb="fechar" aria-label="Fechar">×</button></div></header><div class="kpis pequenos"><div><span>Sequência atual</span><b>🔥 ' + A.sequencia(sel, h) + '</b></div><div><span>Melhor sequência</span><b>' + A.melhorSequencia(sel) + '</b></div><div><span>Este mês</span><b>' + Math.round(A.taxaHabito(sel, [ini, A.hojeLocal(sel.criadoEm)].concat(Object.keys(sel.registros || {})).sort().filter(function (x) { return x >= ini; })[0] || ini, h) * 100) + '%</b></div><div><span>Total de check-ins</span><b>' + Object.keys(sel.registros || {}).filter(function (k) { return sel.registros[k]; }).length + '</b></div></div><h4>' + MESES[Number(h.slice(5, 7)) - 1] + '</h4><div class="ag-hab-mes">' + A.DIAS_CURTO.map(function (d) { return '<span class="mini mudo">' + d + '</span>'; }).join('') + Array.from({ length: 42 }, function (x, k) { const d = A.somar(de, k); if (d.slice(0, 7) !== h.slice(0, 7)) return '<span></span>'; const ok = (sel.registros || {})[d]; const alvo = A.habitoNoDia(sel, d); return '<button class="ag-hab-c' + (ok ? ' ok' : '') + (alvo ? '' : ' fora') + (d === h ? ' hoje' : '') + '" data-hd="' + d + '"' + (d > h ? ' disabled' : '') + '>' + Number(d.slice(8)) + '</button>'; }).join('') + '</div>' + (sel.meta ? '<p><b>Por quê:</b> ' + esc(sel.meta) + '</p>' : '') + '</section>'; }
    const conteudo = '<header class="ag-cab"><h2>Hábitos</h2><button class="btn primario" data-hb="novo">+ Novo hábito</button></header>' + det +
      (a.habitos.length ? '<div class="ag-habs"><div class="ag-hab-cab"><span></span>' + ult.map(function (d) { return '<span class="' + (d === h ? 'hoje' : '') + '">' + A.DIAS_CURTO[A.semana(d)] + '<b>' + Number(d.slice(8)) + '</b></span>'; }).join('') + '<span>🔥</span></div>' + a.habitos.map(function (x) { return '<div class="ag-hab' + (est.habSel === x.id ? ' sel' : '') + '" data-hab="' + x.id + '"><button class="ag-hab-nome" data-hb="ver"><span>' + esc(x.emoji || '◎') + '</span><b>' + esc(x.nome) + '</b><small>' + (x.dias && x.dias.length ? x.dias.map(function (d) { return A.DIAS_CURTO[d]; }).join(', ') : 'todo dia') + (x.hora ? ' · ' + x.hora : '') + '</small></button>' + ult.map(function (d) { const alvo = A.habitoNoDia(x, d); const ok = (x.registros || {})[d]; return '<button class="ag-hab-c' + (ok ? ' ok' : '') + (alvo ? '' : ' fora') + '" data-hd="' + d + '" aria-label="' + esc(x.nome) + ' em ' + d + '">' + (ok ? '✓' : '') + '</button>'; }).join('') + '<b class="ag-hab-seq">' + A.sequencia(x, h) + '</b></div>'; }).join('') + '</div>'
        : '<div class="ag-vazio"><div>◎</div><h3>Construa hábitos</h3><p>Ex.: "Conferir PNCP e Compras.gov.br" nos dias úteis, "Ler 10 páginas da Lei 14.133", "Atualizar certidões" toda segunda. Marque o check-in todo dia e acompanhe a sequência 🔥.</p></div>');
    casca(el, 'habitos', conteudo, ''); ligarComum(el); const comum = el.onclick;
    el.onclick = async function (ev) {
      const hd = ev.target.closest('[data-hd]'); if (hd) { const x = a.habitos.find(function (y) { return y.id === (hd.closest('[data-hab]') ? hd.closest('[data-hab]').dataset.hab : est.habSel); }); x.registros = x.registros || {}; if (x.registros[hd.dataset.hd]) delete x.registros[hd.dataset.hd]; else { x.registros[hd.dataset.hd] = true; if (hd.dataset.hd === h) aviso('🔥 Sequência de ' + A.sequencia(x, h) + ' dia(s) em "' + x.nome + '"'); } salvar(); App.redesenhar(); return; }
      const hb = ev.target.closest('[data-hb]'); if (hb) { const k = hb.dataset.hb; const card = hb.closest('[data-hab]'); if (k === 'ver') { est.habSel = est.habSel === card.dataset.hab ? null : card.dataset.hab; App.redesenhar(); } if (k === 'fechar') { est.habSel = null; App.redesenhar(); } if (k === 'novo') editarHabito(); if (k === 'editar') editarHabito(sel); if (k === 'excluir' && await confirmar('Excluir hábito', 'Excluir "' + esc(sel.nome) + '" e o histórico?', 'Excluir')) { a.habitos = a.habitos.filter(function (y) { return y !== sel; }); est.habSel = null; salvar(); App.redesenhar(); } return; }
      return comum(ev);
    };
  }
  async function editarHabito(x) {
    const novo = !x; x = x || { dias: [] };
    const r = await modal({ titulo: novo ? 'Novo hábito' : 'Editar hábito', corpo: '<div class="linha">' + campo('Ícone', '<input name="emoji" maxlength="4" value="' + esc(x.emoji || '📚') + '" style="width:70px">') + campo('Hábito', '<input name="nome" required value="' + esc(x.nome || '') + '" placeholder="ex.: Conferir novas licitações">') + '</div><fieldset><legend>Frequência</legend><div class="grade-checks">' + A.DIAS_CURTO.map(function (d, i) { return '<label><input type="checkbox" name="d" value="' + i + '"' + (!x.dias.length || x.dias.indexOf(i) >= 0 ? ' checked' : '') + '> ' + d + '</label>'; }).join('') + '</div></fieldset><div class="linha">' + campo('Lembrete (hora)', '<input type="time" name="hora" value="' + esc(x.hora || '') + '">') + '</div>' + campo('Por que esse hábito importa?', '<input name="meta" value="' + esc(x.meta || '') + '">') });
    if (!r) return; const ds = r.getAll('d').map(Number); Object.assign(x, { emoji: r.get('emoji'), nome: r.get('nome').trim(), dias: ds.length === 7 ? [] : ds, hora: r.get('hora') || null, meta: r.get('meta') });
    if (novo) { x.id = Dados.id('agh'); x.registros = {}; x.criadoEm = new Date().toISOString(); e().habitos.push(x); } salvar(); App.redesenhar();
  }

  // ---------- lembretes (rodam com o sistema aberto, em qualquer tela) ----------
  function verificarLembretes() {
    if (!Dados.e) return; const a = e(); let mudou = false;
    A.lembretesDevidos(a.tarefas).forEach(function (x) { x.tarefa.notificado = x.chave; mudou = true; const msg = x.tarefa.titulo + (x.tarefa.hora ? ' · ' + x.tarefa.hora : ''); aviso('⏰ ' + msg); notificar('Lembrete · Seven', msg); beep(); });
    const h = hoje(), agora = new Date(); const hm = ('0' + agora.getHours()).slice(-2) + ':' + ('0' + agora.getMinutes()).slice(-2);
    a.habitos.forEach(function (x) { if (!x.hora || x.hora > hm || !A.habitoNoDia(x, h) || (x.registros || {})[h] || x.avisado === h) return; x.avisado = h; mudou = true; aviso('◎ Hábito: ' + x.nome); notificar('Hábito · Seven', x.nome); });
    if (mudou) salvar();
  }
  setInterval(verificarLembretes, 30000); setTimeout(verificarLembretes, 3000);
  document.addEventListener('keydown', function (ev) {
    if (!/^#\/agenda/.test(location.hash) || document.querySelector('.modal-fundo') || /INPUT|TEXTAREA|SELECT/.test((ev.target.tagName || ''))) return;
    if (ev.key === 'n' || ev.key === '+') { const i = document.getElementById('ag-novo'); if (i) { ev.preventDefault(); i.focus(); } }
    if (ev.key === 'Escape' && est.sel) { est.sel = null; App.redesenhar(); }
    if (ev.key === 'Delete' && est.sel) { const t = tarefa(est.sel); if (t && !t.excluida) { t.excluida = true; t.excluidaEm = new Date().toISOString(); est.sel = null; salvar(); App.redesenhar(); } }
  });

  Telas.agenda = {
    titulo: 'Seven Task',
    render: function (el, sub, param) {
      e();
      const vista = sub || 'tarefas';
      if (est.vista !== vista || (est.sel && !tarefa(est.sel))) est.sel = null; // o painel de detalhe fecha ao trocar de vista
      est.vista = vista;
      if (sub === 'calendario') return telaCalendario(el, param);
      if (sub === 'matriz') return telaMatriz(el);
      if (sub === 'foco') return telaFoco(el);
      if (sub === 'habitos') return telaHabitos(el);
      return telaTarefas(el, param || est.lista);
    },
    _pomo: Pomo, _lembretes: verificarLembretes, // usados pelos testes
    criar: criar, hoje: function () { const h = hoje(); return e().tarefas.filter(function (t) { return A.naLista(t, 'hoje', h); }).sort(A.comparar); }
  };
})();
