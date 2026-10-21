/* Regras da Agenda (estilo TickTick): adição rápida em português, recorrência, listas inteligentes, matriz, hábitos e .ics. Puro, testável no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Agenda = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- datas (sempre 'AAAA-MM-DD', calculadas em UTC para não sofrer com fuso) ----------
  function d(iso) { const p = String(iso).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function iso(x) { return x.toISOString().slice(0, 10); }
  function somar(s, n) { const x = d(s); x.setUTCDate(x.getUTCDate() + n); return iso(x); }
  function somarMeses(s, n) { const x = d(s); const dia = x.getUTCDate(); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() + n); const fim = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate(); x.setUTCDate(Math.min(dia, fim)); return iso(x); }
  function semana(s) { return d(s).getUTCDay(); }
  function dias(a, b) { return Math.round((d(b) - d(a)) / 864e5); }
  function hojeLocal(agora) { const x = agora ? new Date(agora) : new Date(); return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); }
  const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  function semAcento(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  // ---------- adição rápida ----------
  const DIA_RE = '(domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado)(?:-feira)?';
  const B = '(?:^|\\s)'; const F = '(?=$|[\\s,.;!?])';
  function idxDia(t) { return DIAS.indexOf(semAcento(t).replace(/-feira$/, '')); }
  function proximoDia(hoje, w, incluirHoje) { let n = (w - semana(hoje) + 7) % 7; if (n === 0 && !incluirHoje) n = 7; return somar(hoje, n); }

  // Interpreta "Enviar proposta amanhã às 14h !alta #cliente ^Seven" → campos da tarefa.
  function interpretar(texto, agora) {
    const hoje = hojeLocal(agora); let t = ' ' + String(texto || '') + ' '; const r = { tags: [], prioridade: 0, data: null, hora: null, recorrencia: null, lista: null, achados: [] };
    const tirar = function (re, fn) { t = t.replace(re, function () { const m = arguments; const v = fn.apply(null, m); if (v === false) return m[0]; r.achados.push(m[0].trim()); return ' '; }); };
    // prioridade
    tirar(new RegExp(B + '(!{1,3}|!(alta|m[ée]dia|baixa|nenhuma))' + F, 'gi'), function (m, a, nome) { r.prioridade = nome ? { alta: 3, media: 2, baixa: 1, nenhuma: 0 }[semAcento(nome)] : a.length; });
    tirar(/(^|\s)#([\wÀ-ÿ\-]+)/g, function (m, e, tag) { if (r.tags.indexOf(tag) < 0) r.tags.push(tag); });
    tirar(/(^|\s)\^([\wÀ-ÿ\-]+)/g, function (m, e, l) { r.lista = l; });
    // recorrência
    tirar(new RegExp(B + '(?:todo\\s+dia\\s+[úu]til|todos\\s+os\\s+dias\\s+[úu]teis|(?:nos\\s+|em\\s+)?dias\\s+[úu]teis)' + F, 'gi'), function () { r.recorrencia = { tipo: 'uteis', intervalo: 1 }; });
    tirar(new RegExp(B + '(?:todo\\s+dia|todos\\s+os\\s+dias|diariamente)' + F, 'gi'), function () { r.recorrencia = { tipo: 'diaria', intervalo: 1 }; });
    tirar(new RegExp(B + 'a\\s+cada\\s+(\\d+)\\s+(dias?|semanas?|m[eê]s(?:es)?|anos?)' + F, 'gi'), function (m, n, u) { const k = semAcento(u)[0]; r.recorrencia = { tipo: k === 'd' ? 'diaria' : k === 's' ? 'semanal' : k === 'm' ? 'mensal' : 'anual', intervalo: Number(n) }; });
    tirar(new RegExp(B + '(?:tod[oa]s?\\s+(?:as\\s+|os\\s+)?)' + DIA_RE + '((?:\\s*(?:,|e)\\s*' + DIA_RE + ')*)' + F, 'gi'), function (m) { const ds = (m.match(new RegExp(DIA_RE, 'gi')) || []).map(idxDia).filter(function (x) { return x >= 0; }); r.recorrencia = { tipo: 'semanal', intervalo: 1, dias: ds.sort() }; });
    tirar(new RegExp(B + '(?:toda\\s+semana|semanalmente)' + F, 'gi'), function () { r.recorrencia = { tipo: 'semanal', intervalo: 1 }; });
    tirar(new RegExp(B + '(?:todo\\s+m[eê]s|mensalmente)' + F, 'gi'), function () { r.recorrencia = { tipo: 'mensal', intervalo: 1 }; });
    tirar(new RegExp(B + '(?:todo\\s+ano|anualmente)' + F, 'gi'), function () { r.recorrencia = { tipo: 'anual', intervalo: 1 }; });
    // hora
    tirar(new RegExp(B + '(?:[àa]s?\\s+)?(meio[\\s-]dia|meia[\\s-]noite)' + F, 'gi'), function (m, x) { r.hora = /meio/i.test(x) ? '12:00' : '00:00'; });
    tirar(new RegExp(B + '(?:[àa]s?\\s+)?(\\d{1,2})\\s+(da\\s+manh[ãa]|da\\s+tarde|da\\s+noite)' + F, 'gi'), function (m, h, per) { let hh = Number(h); if (hh > 12) return false; if (/tarde|noite/i.test(per) && hh < 12) hh += 12; r.hora = ('0' + hh).slice(-2) + ':00'; });
    tirar(new RegExp(B + '(?:[àa]s?\\s+)?(\\d{1,2})(?::(\\d{2})|\\s?h(?:s|oras?)?\\s?(\\d{2})?)(?:\\s*(da\\s+manh[ãa]|da\\s+tarde|da\\s+noite))?' + F, 'gi'), function (m, h, mi, mi2, per) { let hh = Number(h); const mm = Number(mi || mi2 || 0); if (per && /tarde|noite/i.test(per) && hh < 12) hh += 12; if (hh > 23 || mm > 59) return false; r.hora = ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2); });
    // data
    tirar(new RegExp(B + 'depois\\s+de\\s+amanh[ãa]' + F, 'gi'), function () { r.data = somar(hoje, 2); });
    tirar(new RegExp(B + 'amanh[ãa]' + F, 'gi'), function () { r.data = somar(hoje, 1); });
    tirar(new RegExp(B + 'hoje' + F, 'gi'), function () { r.data = hoje; });
    tirar(new RegExp(B + 'em\\s+(\\d+)\\s+(dias?|semanas?|m[eê]s(?:es)?)' + F, 'gi'), function (m, n, u) { const k = semAcento(u)[0]; r.data = k === 'm' ? somarMeses(hoje, Number(n)) : somar(hoje, Number(n) * (k === 's' ? 7 : 1)); });
    tirar(new RegExp(B + '(?:na\\s+)?pr[óo]xima\\s+semana' + F, 'gi'), function () { r.data = proximoDia(hoje, 1); });
    tirar(new RegExp(B + '(?:no\\s+)?(?:fim|final)\\s+de\\s+semana' + F, 'gi'), function () { r.data = proximoDia(hoje, 6, true); });
    tirar(new RegExp(B + '(?:n[oa]\\s+)?(?:pr[óo]xim[oa]\\s+)?' + DIA_RE + F, 'gi'), function (m, dia) { r.data = proximoDia(hoje, idxDia(dia)); });
    tirar(/(^|\s)(?:em\s+|dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=$|[\s,.;!?])/g, function (m, e, dd, mm, aa) { let a = aa ? Number(aa.length === 2 ? '20' + aa : aa) : Number(hoje.slice(0, 4)); let s = a + '-' + ('0' + mm).slice(-2) + '-' + ('0' + dd).slice(-2); if (Number(mm) > 12 || Number(dd) > 31 || isNaN(d(s))) return false; if (!aa && s < hoje) s = (a + 1) + s.slice(4); r.data = s; });
    tirar(new RegExp(B + 'dia\\s+(\\d{1,2})' + F, 'gi'), function (m, dd) { const n = Number(dd); if (n < 1 || n > 31) return false; let s = hoje.slice(0, 8) + ('0' + n).slice(-2); if (s < hoje) s = somarMeses(hoje.slice(0, 8) + '01', 1).slice(0, 8) + ('0' + n).slice(-2); r.data = s; });
    if (r.hora && !r.data) { r.data = hoje; r.dataImplicita = true; }
    if (r.recorrencia && !r.data) r.data = r.recorrencia.tipo === 'semanal' && r.recorrencia.dias && r.recorrencia.dias.length ? proximaOcorrencia(somar(hoje, -1), r.recorrencia) : r.recorrencia.tipo === 'uteis' && (semana(hoje) === 0 || semana(hoje) === 6) ? proximaOcorrencia(hoje, r.recorrencia) : hoje;
    if (r.recorrencia && r.recorrencia.tipo === 'semanal' && !(r.recorrencia.dias && r.recorrencia.dias.length)) r.recorrencia.dias = [semana(r.data)];
    r.titulo = t.replace(/\s+/g, ' ').trim();
    return r;
  }

  // ---------- recorrência ----------
  function proximaOcorrencia(data, rec, ehUtil) {
    if (!rec || !data) return null; const n = Math.max(1, rec.intervalo || 1);
    if (rec.tipo === 'diaria') return somar(data, n);
    if (rec.tipo === 'uteis') { let x = somar(data, 1); for (let k = 0; k < 30; k++) { const w = semana(x); if (w !== 0 && w !== 6 && (!ehUtil || ehUtil(x))) return x; x = somar(x, 1); } return x; }
    if (rec.tipo === 'semanal') {
      const ds = rec.dias && rec.dias.length ? rec.dias : [semana(data)];
      const inicioSemana = function (s) { return somar(s, -semana(s)); };
      const base = inicioSemana(data);
      for (let k = 1; k <= 7 * n + 7; k++) { const x = somar(data, k); const sem = dias(base, inicioSemana(x)) / 7; if (sem % n === 0 && ds.indexOf(semana(x)) >= 0) return x; }
      return somar(data, 7 * n);
    }
    if (rec.tipo === 'mensal') return somarMeses(data, n);
    if (rec.tipo === 'anual') return somarMeses(data, 12 * n);
    return null;
  }
  function descreverRecorrencia(rec) {
    if (!rec) return ''; const n = rec.intervalo || 1;
    if (rec.tipo === 'uteis') return 'Dias úteis';
    if (rec.tipo === 'diaria') return n === 1 ? 'Todo dia' : 'A cada ' + n + ' dias';
    if (rec.tipo === 'semanal') return (n === 1 ? 'Toda semana' : 'A cada ' + n + ' semanas') + (rec.dias && rec.dias.length ? ' (' + rec.dias.map(function (x) { return DIAS_CURTO[x]; }).join(', ') + ')' : '');
    if (rec.tipo === 'mensal') return n === 1 ? 'Todo mês' : 'A cada ' + n + ' meses';
    if (rec.tipo === 'anual') return n === 1 ? 'Todo ano' : 'A cada ' + n + ' anos';
    return '';
  }
  // Ocorrências de uma tarefa recorrente dentro de um intervalo (para o calendário).
  function ocorrencias(t, de, ate, max) {
    if (!t.data) return []; const out = []; let x = t.data; let k = 0;
    if (!t.recorrencia) return x >= de && x <= ate ? [x] : [];
    while (x && x <= ate && k++ < (max || 400)) { if (x >= de && (!t.recorrencia.ate || x <= t.recorrencia.ate)) out.push(x); x = proximaOcorrencia(x, t.recorrencia); }
    return out;
  }

  // ---------- listas inteligentes e agrupamento ----------
  function ativa(t) { return !t.excluida && !t.feita; }
  function naLista(t, lista, hoje) {
    if (lista === 'lixeira') return !!t.excluida;
    if (t.excluida) return false;
    if (lista === 'concluidas') return !!t.feita;
    if (t.feita) return false;
    if (lista === 'todas') return true;
    if (lista === 'hoje') return !!t.data && t.data <= hoje;
    if (lista === 'amanha') return t.data === somar(hoje, 1);
    if (lista === 'semana') return !!t.data && t.data <= somar(hoje, 6);
    if (lista === 'inbox') return !t.lista || t.lista === 'inbox';
    if (String(lista).indexOf('tag:') === 0) return (t.tags || []).indexOf(lista.slice(4)) >= 0;
    return t.lista === lista;
  }
  function comparar(a, b) { return String(a.data || '9999').localeCompare(String(b.data || '9999')) || String(a.hora || '99').localeCompare(String(b.hora || '99')) || (b.prioridade || 0) - (a.prioridade || 0) || (a.ordem || 0) - (b.ordem || 0) || String(a.criadaEm).localeCompare(String(b.criadaEm)); }
  function grupoData(t, hoje) { if (!t.data) return 'sem'; if (t.data < hoje) return 'atrasadas'; if (t.data === hoje) return 'hoje'; if (t.data === somar(hoje, 1)) return 'amanha'; if (t.data <= somar(hoje, 6)) return 'semana'; return 'depois'; }
  const GRUPOS = { atrasadas: 'Atrasadas', hoje: 'Hoje', amanha: 'Amanhã', semana: 'Próximos 7 dias', depois: 'Mais adiante', sem: 'Sem data' };
  function agrupar(tarefas, hoje, modo) {
    const ordem = modo === 'prioridade' ? [3, 2, 1, 0] : Object.keys(GRUPOS); const g = {};
    tarefas.slice().sort(comparar).forEach(function (t) { const k = modo === 'prioridade' ? (t.prioridade || 0) : grupoData(t, hoje); (g[k] = g[k] || []).push(t); });
    return ordem.filter(function (k) { return g[k]; }).map(function (k) { return { chave: String(k), titulo: modo === 'prioridade' ? PRIORIDADES[k].nome : GRUPOS[k], tarefas: g[k] }; });
  }
  const PRIORIDADES = [{ nome: 'Sem prioridade', cor: 'cinza' }, { nome: 'Baixa', cor: 'azul' }, { nome: 'Média', cor: 'amarelo' }, { nome: 'Alta', cor: 'vermelho' }];
  // Matriz de Eisenhower no padrão do TickTick: o quadrante segue a prioridade.
  const QUADRANTES = [{ p: 3, nome: 'Urgente e importante', dica: 'Faça agora' }, { p: 2, nome: 'Importante, não urgente', dica: 'Agende' }, { p: 1, nome: 'Urgente, não importante', dica: 'Delegue' }, { p: 0, nome: 'Nem urgente nem importante', dica: 'Elimine' }];

  // Conclui: se recorrente, avança para a próxima data e guarda o histórico.
  function concluir(t, agora, ehUtil) {
    const quando = agora || new Date().toISOString();
    if (t.recorrencia && t.data) {
      t.historico = t.historico || []; t.historico.push({ data: t.data, em: quando });
      const prox = proximaOcorrencia(t.data, t.recorrencia, ehUtil);
      if (prox && (!t.recorrencia.ate || prox <= t.recorrencia.ate)) { t.data = prox; (t.subtarefas || []).forEach(function (s) { s.feita = false; }); t.notificado = null; return 'avancou'; }
    }
    t.feita = true; t.feitaEm = quando; return 'feita';
  }

  // ---------- lembretes ----------
  function momento(t) { if (!t.data) return null; return new Date(t.data + 'T' + (t.hora || '09:00') + ':00'); }
  function lembretesDevidos(tarefas, agora) {
    const ag = agora ? new Date(agora) : new Date();
    return tarefas.filter(function (t) {
      if (!ativa(t) || t.lembrete == null || !t.data) return false; const m = momento(t); if (!m) return false;
      const alvo = m.getTime() - t.lembrete * 6e4; const chave = t.data + ' ' + (t.hora || '') + ' ' + t.lembrete;
      return ag.getTime() >= alvo && ag.getTime() - alvo < 12 * 36e5 && t.notificado !== chave;
    }).map(function (t) { return { tarefa: t, chave: t.data + ' ' + (t.hora || '') + ' ' + t.lembrete }; });
  }

  // ---------- hábitos ----------
  function habitoNoDia(h, s) { return !h.dias || !h.dias.length || h.dias.indexOf(semana(s)) >= 0; }
  function sequencia(h, hoje) {
    const reg = h.registros || {}; let n = 0; let x = reg[hoje] ? hoje : somar(hoje, -1); let guarda = 0;
    while (guarda++ < 3660) { if (!habitoNoDia(h, x)) { x = somar(x, -1); continue; } if (!reg[x]) break; n++; x = somar(x, -1); }
    return n;
  }
  function melhorSequencia(h) {
    const ds = Object.keys(h.registros || {}).filter(function (k) { return h.registros[k]; }).sort(); if (!ds.length) return 0;
    let melhor = 0, atual = 0, ant = null;
    ds.forEach(function (x) { if (!habitoNoDia(h, x)) return; if (ant) { let y = somar(ant, 1); while (y < x && !habitoNoDia(h, y)) y = somar(y, 1); atual = y === x ? atual + 1 : 1; } else atual = 1; melhor = Math.max(melhor, atual); ant = x; });
    return melhor;
  }
  function taxaHabito(h, de, ate) { let alvo = 0, feitos = 0; for (let x = de; x <= ate; x = somar(x, 1)) if (habitoNoDia(h, x)) { alvo++; if ((h.registros || {})[x]) feitos++; } return alvo ? feitos / alvo : 0; }

  // ---------- foco (Pomodoro) ----------
  function estatisticasFoco(sessoes, hoje) {
    const doDia = (sessoes || []).filter(function (s) { return hojeLocal(s.inicio) === hoje && s.tipo !== 'pausa'; });
    const semanaIni = somar(hoje, -6); const naSemana = (sessoes || []).filter(function (s) { const x = hojeLocal(s.inicio); return x >= semanaIni && x <= hoje && s.tipo !== 'pausa'; });
    return { pomosHoje: doDia.filter(function (s) { return s.completo; }).length, minutosHoje: doDia.reduce(function (a, s) { return a + (s.minutos || 0); }, 0), minutosSemana: naSemana.reduce(function (a, s) { return a + (s.minutos || 0); }, 0), total: (sessoes || []).filter(function (s) { return s.tipo !== 'pausa'; }).reduce(function (a, s) { return a + (s.minutos || 0); }, 0) };
  }

  // ---------- exportação ----------
  function icsData(s, h) { return s.replace(/-/g, '') + (h ? 'T' + h.replace(':', '') + '00' : ''); }
  function icsTexto(t) { return String(t || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, function (c) { return '\\' + c; }); }
  function rrule(rec) {
    if (!rec) return ''; const n = rec.intervalo || 1; const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    if (rec.tipo === 'uteis') return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    const f = { diaria: 'DAILY', semanal: 'WEEKLY', mensal: 'MONTHLY', anual: 'YEARLY' }[rec.tipo]; if (!f) return '';
    return 'FREQ=' + f + (n > 1 ? ';INTERVAL=' + n : '') + (rec.tipo === 'semanal' && rec.dias && rec.dias.length ? ';BYDAY=' + rec.dias.map(function (x) { return BY[x]; }).join(',') : '') + (rec.ate ? ';UNTIL=' + rec.ate.replace(/-/g, '') : '');
  }
  function ics(tarefas, agoraISO) {
    const carimbo = (agoraISO || new Date().toISOString()).replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Seven Licita//Agenda//PT-BR', 'CALSCALE:GREGORIAN'];
    tarefas.filter(function (t) { return t.data && !t.excluida; }).forEach(function (t) {
      L.push('BEGIN:VEVENT', 'UID:' + t.id + '@seven-licita', 'DTSTAMP:' + carimbo, 'SUMMARY:' + icsTexto(t.titulo));
      if (t.hora) { const fim = new Date(new Date(t.data + 'T' + t.hora + ':00Z').getTime() + (t.duracao || 30) * 6e4).toISOString(); L.push('DTSTART:' + icsData(t.data, t.hora), 'DTEND:' + icsData(fim.slice(0, 10), fim.slice(11, 16))); }
      else L.push('DTSTART;VALUE=DATE:' + icsData(t.data), 'DTEND;VALUE=DATE:' + icsData(somar(t.data, 1)));
      const rr = rrule(t.recorrencia); if (rr) L.push('RRULE:' + rr);
      if (t.notas) L.push('DESCRIPTION:' + icsTexto(t.notas));
      if (t.feita) L.push('STATUS:CANCELLED');
      if (t.lembrete != null) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsTexto(t.titulo), 'TRIGGER:-PT' + t.lembrete + 'M', 'END:VALARM');
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.join('\r\n');
  }
  function linkGoogle(t) {
    const ini = t.hora ? icsData(t.data, t.hora) : icsData(t.data);
    let fim; if (t.hora) { const f = new Date(new Date(t.data + 'T' + t.hora + ':00Z').getTime() + (t.duracao || 30) * 6e4).toISOString(); fim = icsData(f.slice(0, 10), f.slice(11, 16)); } else fim = icsData(somar(t.data, 1));
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(t.titulo) + '&dates=' + ini + '/' + fim + (t.notas ? '&details=' + encodeURIComponent(t.notas) : '') + (t.recorrencia ? '&recur=' + encodeURIComponent('RRULE:' + rrule(t.recorrencia)) : '');
  }
  // Lê eventos de um .ics simples (Google Agenda, Outlook) como tarefas.
  function lerICS(texto) {
    const linhas = String(texto).replace(/\r\n[ \t]/g, '').split(/\r?\n/); const out = []; let ev = null, alarme = false;
    const des = function (v) { return v.replace(/\\n/g, '\n').replace(/\\([,;\\])/g, '$1'); };
    linhas.forEach(function (l) {
      if (l === 'BEGIN:VEVENT') ev = {}; else if (l === 'END:VEVENT' && ev) { if (ev.titulo && ev.data) out.push(ev); ev = null; }
      else if (l === 'BEGIN:VALARM') alarme = true; else if (l === 'END:VALARM') alarme = false;
      else if (ev && !alarme) { const i = l.indexOf(':'); const k = l.slice(0, i), v = l.slice(i + 1); const nome = k.split(';')[0];
        if (nome === 'SUMMARY') ev.titulo = des(v); if (nome === 'DESCRIPTION') ev.notas = des(v);
        if (nome === 'DTSTART') { const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/); if (m) { ev.data = m[1] + '-' + m[2] + '-' + m[3]; if (m[4] && !/VALUE=DATE(?!-)/.test(k)) ev.hora = m[4] + ':' + m[5]; } }
        if (nome === 'RRULE') { const f = (v.match(/FREQ=(\w+)/) || [])[1]; const n = Number((v.match(/INTERVAL=(\d+)/) || [])[1] || 1); const by = (v.match(/BYDAY=([\w,]+)/) || [])[1]; const tipo = { DAILY: 'diaria', WEEKLY: 'semanal', MONTHLY: 'mensal', YEARLY: 'anual' }[f]; if (tipo) { ev.recorrencia = { tipo: tipo, intervalo: n }; if (by) { ev.recorrencia.dias = by.split(',').map(function (x) { return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(x.slice(-2)); }).filter(function (x) { return x >= 0; }); if (tipo === 'semanal' && ev.recorrencia.dias.join() === '1,2,3,4,5' && n === 1) ev.recorrencia = { tipo: 'uteis', intervalo: 1 }; } } } }
    });
    return out;
  }

  return { d: d, iso: iso, somar: somar, somarMeses: somarMeses, semana: semana, dias: dias, hojeLocal: hojeLocal, DIAS_CURTO: DIAS_CURTO, interpretar: interpretar, proximaOcorrencia: proximaOcorrencia, descreverRecorrencia: descreverRecorrencia, ocorrencias: ocorrencias, ativa: ativa, naLista: naLista, comparar: comparar, grupoData: grupoData, agrupar: agrupar, GRUPOS: GRUPOS, PRIORIDADES: PRIORIDADES, QUADRANTES: QUADRANTES, concluir: concluir, momento: momento, lembretesDevidos: lembretesDevidos, habitoNoDia: habitoNoDia, sequencia: sequencia, melhorSequencia: melhorSequencia, taxaHabito: taxaHabito, estatisticasFoco: estatisticasFoco, ics: ics, rrule: rrule, linkGoogle: linkGoogle, lerICS: lerICS };
});
