/* Seven Licita — motor dos Quadros: Markdown, filtros, automações, recorrência e importação do Trello. Sem DOM. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Kanban = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DIA = 86400000;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function normalizar(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

  // ---------- Markdown (escapa tudo antes; só aceita links http/https e #/) ----------
  function inline(t) {
    const codigos = [];
    t = t.replace(/`([^`]+)`/g, function (_, c) { codigos.push(c); return '\u0000' + (codigos.length - 1) + '\u0000'; });
    t = t.replace(/\[([^\]]+)\]\(((?:https?:\/\/|#\/)[^\s)]+)\)/g, function (_, txt, url) { return '<a href="' + url + '" target="_blank" rel="noopener">' + txt + '</a>'; });
    t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (_, a, url) { return a + '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>'; });
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/(^|[\s(])_([^_\s][^_]*)_/g, '$1<em>$2</em>');
    t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    t = t.replace(/(^|\s)@([\wÀ-ÿ]+)/g, '$1<span class="mencao">@$2</span>');
    return t.replace(/\u0000(\d+)\u0000/g, function (_, i) { return '<code>' + codigos[+i] + '</code>'; });
  }

  function markdown(texto) {
    const linhas = esc(texto).replace(/\r/g, '').split('\n');
    const out = []; let lista = null; let bloco = null;
    function fecharLista() { if (lista) { out.push('</' + lista + '>'); lista = null; } }
    linhas.forEach(function (l, n) {
      if (/^```/.test(l)) { if (bloco) { out.push('<pre><code>' + bloco.join('\n') + '</code></pre>'); bloco = null; } else { fecharLista(); bloco = []; } return; }
      if (bloco) { bloco.push(l); return; }
      let m;
      if ((m = l.match(/^(#{1,3})\s+(.*)$/))) { fecharLista(); out.push('<h' + (m[1].length + 2) + '>' + inline(m[2]) + '</h' + (m[1].length + 2) + '>'); return; }
      if ((m = l.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/))) { if (lista !== 'ul') { fecharLista(); out.push('<ul class="md-tarefas">'); lista = 'ul'; } out.push('<li><input type="checkbox" disabled' + (m[1] !== ' ' ? ' checked' : '') + ' data-md-linha="' + n + '"> ' + inline(m[2]) + '</li>'); return; }
      if ((m = l.match(/^\s*[-*]\s+(.*)$/))) { if (lista !== 'ul') { fecharLista(); out.push('<ul>'); lista = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); return; }
      if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) { if (lista !== 'ol') { fecharLista(); out.push('<ol>'); lista = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); return; }
      fecharLista();
      if ((m = l.match(/^&gt;\s?(.*)$/))) { out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); return; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); return; }
      if (!l.trim()) { out.push(''); return; }
      out.push('<p>' + inline(l) + '</p>');
    });
    if (bloco) out.push('<pre><code>' + bloco.join('\n') + '</code></pre>');
    fecharLista();
    return out.join('');
  }

  function mencoes(texto, membros) {
    const n = normalizar(texto);
    return (membros || []).filter(function (m) { const p = normalizar(m).split(/\s+/)[0]; return p && (n.indexOf('@' + p) >= 0 || n.indexOf('@' + normalizar(m).replace(/\s+/g, '')) >= 0); });
  }

  // ---------- datas ----------
  function statusPrazo(c, agora) {
    if (!c.prazo) return null;
    if (c.concluido) return 'concluido';
    const ms = new Date(c.prazo) - (agora || Date.now());
    if (ms < 0) return 'atrasado';
    if (ms < DIA) return 'logo';
    return 'futuro';
  }

  function ultimaAtividade(c) {
    let t = new Date(c.atualizadoEm || c.criadoEm || 0).getTime();
    (c.comentarios || []).forEach(function (m) { t = Math.max(t, new Date(m.em).getTime()); });
    (c.atividade || []).forEach(function (a) { t = Math.max(t, new Date(a.em).getTime()); });
    return t;
  }

  // ---------- filtros ----------
  // f: { texto, etiquetas:[], semEtiqueta, modoEtiqueta:'any'|'all', membros:[], semMembro, meus, eu,
  //      prazo:'atrasado'|'dia'|'semana'|'mes'|'sem'|'com', status:'concluido'|'pendente', atividade:'1'|'2'|'4'|'sem4' }
  function vazioFiltro() { return { texto: '', etiquetas: [], semEtiqueta: false, modoEtiqueta: 'any', membros: [], semMembro: false, meus: false, prazo: '', status: '', atividade: '' }; }
  function contaFiltros(f) {
    if (!f) return 0;
    return (f.texto ? 1 : 0) + (f.etiquetas || []).length + (f.semEtiqueta ? 1 : 0) + (f.membros || []).length + (f.semMembro ? 1 : 0) + (f.meus ? 1 : 0) + (f.prazo ? 1 : 0) + (f.status ? 1 : 0) + (f.atividade ? 1 : 0);
  }
  function passaFiltro(c, f, ctx) {
    ctx = ctx || {}; const agora = ctx.agora || Date.now();
    if (c.arquivado) return false;
    if (!f) return true;
    if (f.texto) {
      const alvo = normalizar([c.titulo, c.descricao, c.num ? '#' + c.num : ''].concat((c.checklists || []).map(function (cl) { return cl.itens.map(function (i) { return i.texto; }).join(' '); })).concat(Object.keys(c.valores || {}).map(function (k) { return c.valores[k]; })).join(' '));
      if (!normalizar(f.texto).split(/\s+/).every(function (p) { return alvo.indexOf(p) >= 0; })) return false;
    }
    const ets = c.etiquetas || [];
    const querEt = (f.etiquetas || []).length || f.semEtiqueta;
    if (querEt) {
      const casa = f.modoEtiqueta === 'all'
        ? (f.etiquetas || []).every(function (id) { return ets.indexOf(id) >= 0; }) && (!f.semEtiqueta || !ets.length)
        : (f.etiquetas || []).some(function (id) { return ets.indexOf(id) >= 0; }) || (f.semEtiqueta && !ets.length);
      if (!casa) return false;
    }
    const ms = c.membros || [];
    const alvosM = (f.membros || []).concat(f.meus && ctx.eu ? [ctx.eu] : []);
    if (alvosM.length || f.semMembro) {
      if (!(alvosM.some(function (m) { return ms.indexOf(m) >= 0; }) || (f.semMembro && !ms.length))) return false;
    }
    if (f.prazo) {
      const p = c.prazo ? new Date(c.prazo).getTime() : null;
      if (f.prazo === 'sem' && p) return false;
      if (f.prazo === 'com' && !p) return false;
      if (f.prazo === 'atrasado' && !(p && p < agora && !c.concluido)) return false;
      const lim = { dia: DIA, semana: 7 * DIA, mes: 30 * DIA }[f.prazo];
      if (lim && !(p && p >= agora && p - agora <= lim)) return false;
    }
    if (f.status === 'concluido' && !c.concluido) return false;
    if (f.status === 'pendente' && c.concluido) return false;
    if (f.atividade) {
      const ult = ultimaAtividade(c);
      if (f.atividade === 'sem4') { if (agora - ult < 28 * DIA) return false; }
      else if (agora - ult > Number(f.atividade) * 7 * DIA) return false;
    }
    return true;
  }

  // ---------- automações ----------
  const GATILHOS = {
    'entrar-lista': 'Quando um cartão entrar na lista',
    'criar': 'Quando um cartão for criado na lista',
    'etiqueta': 'Quando a etiqueta for adicionada',
    'membro': 'Quando um membro for adicionado',
    'concluir': 'Quando o cartão for marcado como concluído',
    'checklist-completo': 'Quando todos os itens do checklist forem concluídos',
    'prazo-proximo': 'Quando faltarem N dias para o prazo'
  };
  const ACOES = {
    'mover': 'mover para a lista', 'mover-topo': 'mover para o topo da lista', 'add-etiqueta': 'adicionar a etiqueta', 'rem-etiqueta': 'remover a etiqueta',
    'add-membro': 'adicionar o membro', 'rem-membro': 'remover o membro', 'prazo': 'definir prazo em N dias', 'limpar-prazo': 'remover o prazo',
    'concluir': 'marcar como concluído', 'reabrir': 'marcar como pendente', 'arquivar': 'arquivar o cartão', 'checklist-etapa': 'adicionar o checklist da etapa',
    'checklist': 'adicionar o checklist com itens (separe por ;)', 'comentar': 'comentar', 'ordenar-lista': 'ordenar a lista por prazo', 'notificar': 'enviar notificação'
  };

  function listaPorNomeOuId(q, v) { return q.listas.find(function (l) { return l.id === v || normalizar(l.nome) === normalizar(v); }); }
  function etiquetaPorNomeOuId(q, v) { return q.etiquetas.find(function (x) { return x.id === v || normalizar(x.nome) === normalizar(v); }); }

  // Migra regras antigas { quando, lista, acao, valor } para { gatilho, acoes }.
  function migrarRegra(r) {
    if (r.gatilho) return r;
    return { id: r.id, ativo: r.ativo !== false, gatilho: { tipo: 'entrar-lista', lista: r.lista }, acoes: [{ tipo: r.acao, valor: r.valor }] };
  }

  function regraCasa(q, r, evento, c) {
    const g = r.gatilho || {};
    if (r.ativo === false || g.tipo !== evento.tipo) return false;
    const l = listaPorNomeOuId(q, c.lista);
    if ((g.tipo === 'entrar-lista' || g.tipo === 'criar') && g.lista && g.lista !== '*') { const alvo = listaPorNomeOuId(q, g.lista); if (!alvo || !l || alvo.id !== l.id) return false; }
    if (g.tipo === 'etiqueta' && g.etiqueta) { const et = etiquetaPorNomeOuId(q, g.etiqueta); if (!et || et.id !== evento.etiqueta) return false; }
    if (g.tipo === 'membro' && g.membro && g.membro !== evento.membro) return false;
    return true;
  }

  // ctx: { id(prefixo), agora, eu, checkEtapa: {nomeLista: [itens]}, registrar(q,c,texto), notificar(texto, c), profundidade }
  function dispararEvento(q, c, evento, ctx) {
    ctx = ctx || {}; const prof = (ctx.profundidade || 0) + 1;
    if (prof > 4) return [];
    const feitas = [];
    (q.automacoes || []).map(migrarRegra).forEach(function (r) {
      if (!regraCasa(q, r, evento, c)) return;
      feitas.push(r.id);
      aplicarAcoes(q, c, r.acoes || [], Object.assign({}, ctx, { profundidade: prof, origem: 'automação' }));
    });
    return feitas;
  }

  function aplicarAcoes(q, c, acoes, ctx) {
    ctx = ctx || {}; const id = ctx.id || function (p) { return p + Math.random().toString(36).slice(2, 9); };
    const reg = function (t) { if (ctx.registrar) ctx.registrar(q, c, (ctx.origem ? ctx.origem + ': ' : '') + t); };
    acoes.forEach(function (a) {
      const v = a.valor;
      if (a.tipo === 'mover' || a.tipo === 'mover-topo') {
        const l = listaPorNomeOuId(q, v); if (!l || l.id === c.lista) { if (l && a.tipo === 'mover-topo') c.ordem = -1; return; }
        c.lista = l.id; c.ordem = a.tipo === 'mover-topo' ? -1 : 1e6; reg('moveu para "' + l.nome + '"');
        dispararEvento(q, c, { tipo: 'entrar-lista' }, ctx);
      }
      if (a.tipo === 'add-etiqueta') { const et = etiquetaPorNomeOuId(q, v); if (et && (c.etiquetas || []).indexOf(et.id) < 0) { c.etiquetas = (c.etiquetas || []).concat(et.id); reg('adicionou a etiqueta ' + (et.nome || et.cor)); dispararEvento(q, c, { tipo: 'etiqueta', etiqueta: et.id }, ctx); } }
      if (a.tipo === 'rem-etiqueta') { const et = etiquetaPorNomeOuId(q, v); if (et) c.etiquetas = (c.etiquetas || []).filter(function (x) { return x !== et.id; }); }
      if (a.tipo === 'add-membro' && v && (c.membros || []).indexOf(v) < 0) { c.membros = (c.membros || []).concat(v); reg('adicionou ' + v); dispararEvento(q, c, { tipo: 'membro', membro: v }, ctx); }
      if (a.tipo === 'rem-membro') c.membros = (c.membros || []).filter(function (x) { return x !== v; });
      if (a.tipo === 'prazo' && v !== '' && v != null) { c.prazo = dataLocal(new Date((ctx.agora || Date.now()) + Number(v) * DIA)); c.concluido = false; reg('definiu prazo para daqui a ' + v + ' dia(s)'); }
      if (a.tipo === 'limpar-prazo') { c.prazo = ''; c.inicio = ''; }
      if (a.tipo === 'concluir' && !c.concluido) { c.concluido = true; reg('marcou como concluído'); dispararEvento(q, c, { tipo: 'concluir' }, ctx); }
      if (a.tipo === 'reabrir') c.concluido = false;
      if (a.tipo === 'arquivar') { c.arquivado = true; reg('arquivou'); }
      if (a.tipo === 'checklist-etapa') {
        const l = listaPorNomeOuId(q, c.lista); const itens = l && ctx.checkEtapa && ctx.checkEtapa[l.nome];
        if (itens && !(c.checklists || []).some(function (cl) { return cl.titulo === l.nome; })) { c.checklists = (c.checklists || []).concat({ id: id('cl'), titulo: l.nome, itens: itens.map(function (t) { return { id: id('ci'), texto: t, feito: false }; }) }); reg('adicionou o checklist "' + l.nome + '"'); }
      }
      if (a.tipo === 'checklist' && v) {
        const partes = String(v).split(';').map(function (s) { return s.trim(); }).filter(Boolean);
        const titulo = partes.length > 1 ? partes.shift() : 'Checklist';
        if (!(c.checklists || []).some(function (cl) { return cl.titulo === titulo; })) c.checklists = (c.checklists || []).concat({ id: id('cl'), titulo: titulo, itens: partes.map(function (t) { return { id: id('ci'), texto: t, feito: false }; }) });
      }
      if (a.tipo === 'comentar' && v) c.comentarios = [{ id: id('cm'), texto: String(v), em: new Date(ctx.agora || Date.now()).toISOString(), por: 'Automação' }].concat(c.comentarios || []);
      if (a.tipo === 'ordenar-lista') { q.cartoes.filter(function (x) { return x.lista === c.lista && !x.arquivado; }).sort(function (x, y) { return new Date(x.prazo || '2999') - new Date(y.prazo || '2999'); }).forEach(function (x, i) { x.ordem = i; }); }
      if (a.tipo === 'notificar' && ctx.notificar) ctx.notificar(String(v || 'Automação executada') + ' — ' + c.titulo, c);
    });
    c.atualizadoEm = new Date(ctx.agora || Date.now()).toISOString();
  }

  // Varredura periódica: prazo se aproximando e cartões recorrentes. Devolve o que mudou.
  function varrer(q, ctx) {
    ctx = ctx || {}; const agora = ctx.agora || Date.now(); const mudou = [];
    const regras = (q.automacoes || []).map(migrarRegra).filter(function (r) { return r.ativo !== false && r.gatilho && r.gatilho.tipo === 'prazo-proximo'; });
    q.cartoes.slice().forEach(function (c) {
      if (c.arquivado) return;
      regras.forEach(function (r) {
        if (!c.prazo || c.concluido) return;
        const dias = Number(r.gatilho.dias || 1);
        const falta = new Date(c.prazo) - agora;
        c.disparos = c.disparos || {};
        const marca = r.id + '@' + c.prazo;
        if (falta >= 0 && falta <= dias * DIA && !c.disparos[marca]) { c.disparos[marca] = true; aplicarAcoes(q, c, r.acoes || [], Object.assign({}, ctx, { origem: 'automação' })); mudou.push(c.id); }
      });
      if (c.recorrencia && c.recorrencia.freq && c.recorrencia.proxima && new Date(c.recorrencia.proxima).getTime() <= agora) {
        let guarda = 0;
        while (new Date(c.recorrencia.proxima).getTime() <= agora && guarda++ < 24) {
          const novo = copiarCartao(c, ctx);
          novo.recorrencia = null; novo.concluido = false;
          if (c.prazo) novo.prazo = dataLocal(somarPeriodo(new Date(c.prazo), c.recorrencia.freq, guarda));
          novo.titulo = c.titulo;
          q.cartoes.push(novo); mudou.push(novo.id);
          c.recorrencia.proxima = dataLocal(somarPeriodo(new Date(c.recorrencia.proxima), c.recorrencia.freq, 1));
          if (ctx.registrar) ctx.registrar(q, novo, 'criado pela repetição de "' + c.titulo + '"');
        }
      }
    });
    return mudou;
  }

  function somarPeriodo(d, freq, n) {
    const x = new Date(d);
    if (freq === 'diaria') x.setDate(x.getDate() + n);
    else if (freq === 'semanal') x.setDate(x.getDate() + 7 * n);
    else if (freq === 'mensal') x.setMonth(x.getMonth() + n);
    else if (freq === 'anual') x.setFullYear(x.getFullYear() + n);
    return x;
  }

  function dataLocal(d) { const x = new Date(d); return new Date(x - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }

  function copiarCartao(c, ctx, opcoes) {
    opcoes = opcoes || {}; const id = (ctx && ctx.id) || function (p) { return p + Math.random().toString(36).slice(2, 9); };
    const n = JSON.parse(JSON.stringify(c));
    n.id = id('ct'); n.criadoEm = n.atualizadoEm = new Date((ctx && ctx.agora) || Date.now()).toISOString();
    n.comentarios = opcoes.comentarios ? n.comentarios : []; n.atividade = []; n.votos = []; n.disparos = {}; n.modelo = false; n.num = null;
    if (!opcoes.anexos) n.anexos = [];
    if (opcoes.checklists === false) n.checklists = []; else (n.checklists || []).forEach(function (cl) { cl.id = id('cl'); cl.itens.forEach(function (i) { i.id = id('ci'); if (opcoes.zerarChecklists !== false) i.feito = false; }); });
    if (opcoes.etiquetas === false) n.etiquetas = [];
    if (opcoes.membros === false) n.membros = [];
    return n;
  }

  // ---------- Trello (JSON exportado pelo menu "Imprimir, exportar e compartilhar") ----------
  const COR_TRELLO = { green: 'verde', yellow: 'amarelo', orange: 'laranja', red: 'vermelho', purple: 'roxo', blue: 'azul', sky: 'ciano', lime: 'lima', pink: 'rosa', black: 'preto' };
  function corTrello(c) { return COR_TRELLO[String(c || '').replace(/_(dark|light)$/, '')] || 'cinza'; }

  function importarTrello(j, ctx) {
    ctx = ctx || {}; const id = ctx.id || function (p) { return p + Math.random().toString(36).slice(2, 9); };
    if (!j || !Array.isArray(j.lists) || !Array.isArray(j.cards)) throw new Error('Arquivo não parece um quadro exportado do Trello (faltam listas ou cartões).');
    const mapaL = {}, mapaE = {}, mapaM = {}, mapaCF = {}, mapaC = {};
    const membros = (j.members || []).map(function (m) { mapaM[m.id] = m.fullName || m.username; return mapaM[m.id]; });
    const etiquetas = (j.labels || []).map(function (l) { const x = { id: id('et'), nome: l.name || '', cor: corTrello(l.color) }; mapaE[l.id] = x.id; return x; });
    const listas = j.lists.slice().sort(function (a, b) { return (a.pos || 0) - (b.pos || 0); }).map(function (l) { const x = { id: id('ls'), nome: l.name, arquivada: !!l.closed }; mapaL[l.id] = x.id; return x; });
    const campos = (j.customFields || []).map(function (f) {
      const tipo = { text: 'texto', number: 'numero', date: 'data', checkbox: 'check', list: 'lista' }[f.type] || 'texto';
      const x = { id: id('cf'), nome: f.name, tipo: tipo, opcoes: (f.options || []).map(function (o) { return o.value && o.value.text; }) };
      mapaCF[f.id] = { campo: x, opcoes: {} }; (f.options || []).forEach(function (o) { mapaCF[f.id].opcoes[o.id] = o.value && o.value.text; });
      return x;
    });
    const data = function (iso) { return iso ? dataLocal(new Date(iso)) : ''; };
    let seq = 0;
    const cartoes = j.cards.slice().sort(function (a, b) { return (a.pos || 0) - (b.pos || 0); }).map(function (k, i) {
      const c = {
        id: id('ct'), num: k.idShort || ++seq, titulo: k.name, descricao: k.desc || '', lista: mapaL[k.idList] || listas[0] && listas[0].id, ordem: i,
        etiquetas: (k.idLabels || []).map(function (x) { return mapaE[x]; }).filter(Boolean), membros: (k.idMembers || []).map(function (x) { return mapaM[x]; }).filter(Boolean),
        inicio: data(k.start), prazo: data(k.due), concluido: !!k.dueComplete, arquivado: !!k.closed, checklists: [], comentarios: [], anexos: [], valores: {}, atividade: [],
        capa: k.cover && k.cover.color ? corTrello(k.cover.color) : '', capaTamanho: k.cover && k.cover.size === 'full' ? 'cheia' : 'meia',
        criadoEm: k.dateLastActivity || new Date().toISOString(), atualizadoEm: k.dateLastActivity || new Date().toISOString(), modelo: !!k.isTemplate
      };
      (k.attachments || []).forEach(function (a) { if (a.url) c.anexos.push({ id: id('lk'), nome: a.name || a.url, link: a.url, em: a.date || c.criadoEm, tipo: a.mimeType || '' }); });
      (k.customFieldItems || []).forEach(function (it) {
        const m = mapaCF[it.idCustomField]; if (!m) return; const v = it.value || {};
        c.valores[m.campo.id] = it.idValue ? m.opcoes[it.idValue] : v.text != null ? v.text : v.number != null ? Number(v.number) : v.date ? v.date.slice(0, 10) : v.checked != null ? v.checked === 'true' : '';
      });
      mapaC[k.id] = c; return c;
    });
    seq = Math.max.apply(null, [0].concat(cartoes.map(function (c) { return c.num || 0; })));
    (j.checklists || []).forEach(function (cl) {
      const c = mapaC[cl.idCard]; if (!c) return;
      c.checklists.push({ id: id('cl'), titulo: cl.name, itens: (cl.checkItems || []).slice().sort(function (a, b) { return (a.pos || 0) - (b.pos || 0); }).map(function (i) { return { id: id('ci'), texto: i.name, feito: i.state === 'complete', membro: mapaM[i.idMember] || '', prazo: i.due ? i.due.slice(0, 10) : '' }; }) });
    });
    (j.actions || []).forEach(function (a) {
      if (a.type !== 'commentCard' || !a.data || !a.data.card) return;
      const c = mapaC[a.data.card.id]; if (!c) return;
      c.comentarios.push({ id: id('cm'), texto: a.data.text || '', em: a.date, por: (a.memberCreator && (a.memberCreator.fullName || a.memberCreator.username)) || 'Trello' });
    });
    cartoes.forEach(function (c) { c.comentarios.sort(function (a, b) { return new Date(b.em) - new Date(a.em); }); });
    const fundo = j.prefs && (j.prefs.backgroundColor || j.prefs.background);
    return { nome: j.name || 'Quadro importado', descricao: j.desc || '', listas: listas, cartoes: cartoes, etiquetas: etiquetas, campos: campos, membros: membros, seq: seq, fundo: fundo && /^#/.test(fundo) ? fundo : '' };
  }

  return {
    markdown: markdown, mencoes: mencoes, statusPrazo: statusPrazo, ultimaAtividade: ultimaAtividade, vazioFiltro: vazioFiltro, contaFiltros: contaFiltros,
    passaFiltro: passaFiltro, GATILHOS: GATILHOS, ACOES: ACOES, migrarRegra: migrarRegra, dispararEvento: dispararEvento, aplicarAcoes: aplicarAcoes,
    varrer: varrer, copiarCartao: copiarCartao, somarPeriodo: somarPeriodo, dataLocal: dataLocal, importarTrello: importarTrello, corTrello: corTrello
  };
});
