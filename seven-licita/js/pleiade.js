/* Regras da Plêiade (comunicação interna estilo Slack): árvore sincronizada, formatação, menções, não lidas e busca. Puro, testável no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Pleiade = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- árvore (espelho do servidor, no formato do Firebase Realtime Database) ----------
  function partes(caminho) { return String(caminho || '').split('/').filter(Boolean); }
  function obter(arv, caminho) { let x = arv; for (const p of partes(caminho)) { if (x == null || typeof x !== 'object') return undefined; x = x[p]; } return x; }
  function vazio(o) { return o == null || (typeof o === 'object' && !Object.keys(o).length); }
  function definir(arv, caminho, valor) {
    const ps = partes(caminho); if (!ps.length) return valor == null ? {} : JSON.parse(JSON.stringify(valor));
    let x = arv; const pilha = [];
    for (let i = 0; i < ps.length - 1; i++) { if (x[ps[i]] == null || typeof x[ps[i]] !== 'object') { if (valor == null) return arv; x[ps[i]] = {}; } pilha.push([x, ps[i]]); x = x[ps[i]]; }
    const k = ps[ps.length - 1];
    if (valor == null) { delete x[k]; for (let i = pilha.length - 1; i >= 0; i--) { const pai = pilha[i][0], ch = pilha[i][1]; if (vazio(pai[ch])) delete pai[ch]; else break; } }
    else x[k] = JSON.parse(JSON.stringify(valor));
    return arv;
  }
  function mesclar(arv, caminho, obj) { Object.keys(obj || {}).forEach(function (k) { arv = definir(arv, (caminho ? caminho.replace(/\/$/, '') + '/' : '') + k, obj[k]); }); return arv; }
  // Evento do fluxo (EventSource) do Firebase: put / patch com {path, data}.
  function aplicarEvento(arv, tipo, ev) { if (tipo === 'put') return definir(arv, ev.path, ev.data); if (tipo === 'patch') return mesclar(arv, ev.path, ev.data); return arv; }
  function id(agora) { return (agora || Date.now()).toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 7); }
  function dmId(uids) { return 'dm-' + uids.slice().sort().join('-'); }
  function slug(nome) { return String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }

  // ---------- formatação estilo Slack ----------
  const EMOJIS = { sorriso: '😄', smile: '😄', joinha: '👍', '+1': '👍', thumbsup: '👍', '-1': '👎', coracao: '❤️', heart: '❤️', fogo: '🔥', fire: '🔥', festa: '🎉', tada: '🎉', olhos: '👀', eyes: '👀', ok: '✅', white_check_mark: '✅', x: '❌', alerta: '⚠️', warning: '⚠️', relogio: '⏰', foguete: '🚀', rocket: '🚀', rindo: '😂', joy: '😂', pensando: '🤔', thinking_face: '🤔', palmas: '👏', clap: '👏', oracao: '🙏', pray: '🙏', martelo: '🔨', hammer: '🔨', trofeu: '🏆', trophy: '🏆', dinheiro: '💰', moneybag: '💰', documento: '📄', page_facing_up: '📄', pasta: '📁', calendario: '📅', calendar: '📅', alfinete: '📌', pushpin: '📌', raio: '⚡', zap: '⚡', estrela: '⭐', star: '⭐', cem: '💯', '100': '💯', muscle: '💪', forca: '💪', triste: '😢', cry: '😢', ola: '👋', wave: '👋', cafe: '☕', coffee: '☕' };
  const REACOES_RAPIDAS = ['👍', '✅', '👀', '🎉', '🔥', '🙏'];
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function emojis(t) { return String(t).replace(/:([a-z0-9_+\-]+):/gi, function (m, k) { return EMOJIS[k.toLowerCase()] || m; }); }
  // ctx: { membros: {uid: {nome}}, canais: {cid: {nome}}, eu }
  function formatar(texto, ctx) {
    ctx = ctx || {}; const blocos = []; let t = String(texto || '');
    t = t.replace(/```\n?([\s\S]*?)```/g, function (m, c) { blocos.push('<pre class="pl-pre">' + esc(c.replace(/\n$/, '')) + '</pre>'); return '\u0000' + (blocos.length - 1) + '\u0000'; });
    t = t.replace(/`([^`\n]+)`/g, function (m, c) { blocos.push('<code>' + esc(c) + '</code>'); return '\u0000' + (blocos.length - 1) + '\u0000'; });
    t = esc(emojis(t));
    // links (sem quebrar menções e e-mails)
    t = t.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)])/g, function (m, a, u) { const href = /^www\./.test(u) ? 'https://' + u : u; return a + '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + u + '</a>'; });
    t = t.replace(/(^|[\s(>])@(canal|aqui|channel|here)\b/g, function (m, a, k) { return a + '<span class="pl-men pl-men-todos">@' + k + '</span>'; });
    t = t.replace(/&lt;@([\w-]+)&gt;/g, function (m, uid) { const u = (ctx.membros || {})[uid]; return '<span class="pl-men' + (uid === ctx.eu ? ' pl-men-eu' : '') + '" data-u="' + esc(uid) + '">@' + esc(u ? u.nome : 'desconhecido') + '</span>'; });
    t = t.replace(/&lt;#([\w-]+)&gt;/g, function (m, cid) { const c = (ctx.canais || {})[cid]; return '<a class="pl-canal-link" href="#/pleiade/c/' + esc(cid) + '">#' + esc(c ? c.nome : cid) + '</a>'; });
    t = t.replace(/(^|[\s(>])\*([^*\n]+)\*(?=$|[\s).,;:!?<])/g, '$1<b>$2</b>').replace(/(^|[\s(>])_([^_\n]+)_(?=$|[\s).,;:!?<])/g, '$1<i>$2</i>').replace(/(^|[\s(>])~([^~\n]+)~(?=$|[\s).,;:!?<])/g, '$1<s>$2</s>');
    // citações e listas por linha
    const linhas = t.split('\n'); const out = []; let lista = null;
    linhas.forEach(function (l) {
      const ul = l.match(/^\s*[-•]\s+(.*)$/), ol = l.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ul || ol) { const tipo = ul ? 'ul' : 'ol'; if (lista !== tipo) { if (lista) out.push('</' + lista + '>'); out.push('<' + tipo + '>'); lista = tipo; } out.push('<li>' + (ul || ol)[1] + '</li>'); return; }
      if (lista) { out.push('</' + lista + '>'); lista = null; }
      const q = l.match(/^&gt;\s?(.*)$/); out.push(q ? '<blockquote>' + q[1] + '</blockquote>' : l + '\n');
    });
    if (lista) out.push('</' + lista + '>');
    t = out.join('').replace(/\n$/, '').replace(/\n/g, '<br>');
    return t.replace(/\u0000(\d+)\u0000/g, function (m, i) { return blocos[Number(i)]; });
  }
  // Converte "@Ana Souza" digitado em <@uid> antes de enviar (maior nome primeiro).
  function codificarMencoes(texto, membros) {
    let t = String(texto || ''); const lista = Object.keys(membros || {}).map(function (k) { return { id: k, nome: membros[k].nome }; }).filter(function (m) { return m.nome; }).sort(function (a, b) { return b.nome.length - a.nome.length; });
    lista.forEach(function (m) { const re = new RegExp('(^|[\\s(])@' + m.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[\\s,.;:!?)])', 'gi'); t = t.replace(re, '$1<@' + m.id + '>'); });
    return t;
  }
  function codificarCanais(texto, canais) {
    let t = String(texto || ''); Object.keys(canais || {}).filter(function (k) { return !canais[k].dm; }).sort(function (a, b) { return canais[b].nome.length - canais[a].nome.length; }).forEach(function (k) { const re = new RegExp('(^|[\\s(])#' + canais[k].nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[\\s,.;:!?)])', 'g'); t = t.replace(re, '$1<#' + k + '>'); });
    return t;
  }
  function mencoes(texto) { const out = []; String(texto || '').replace(/<@([\w-]+)>/g, function (m, u) { if (out.indexOf(u) < 0) out.push(u); }); return out; }
  function mencionaTodos(texto) { return /(^|[\s(])@(canal|aqui|channel|here)\b/.test(String(texto || '')); }
  function textoPuro(texto, ctx) { return String(texto || '').replace(/<@([\w-]+)>/g, function (m, u) { const x = ((ctx || {}).membros || {})[u]; return '@' + (x ? x.nome : 'alguém'); }).replace(/<#([\w-]+)>/g, function (m, c) { const x = ((ctx || {}).canais || {})[c]; return '#' + (x ? x.nome : c); }); }

  // ---------- mensagens ----------
  function lista(msgs) { return Object.keys(msgs || {}).map(function (k) { return Object.assign({ id: k }, msgs[k]); }).sort(function (a, b) { return a.em - b.em || (a.id < b.id ? -1 : 1); }); }
  function doCanal(msgs) { return lista(msgs).filter(function (m) { return !m.pai || m.tambemCanal; }); }
  function respostas(msgs, pai) { return lista(msgs).filter(function (m) { return m.pai === pai; }); }
  // Agrupa mensagens seguidas do mesmo autor (até 5 min) e marca a troca de dia.
  function agrupar(ms) {
    let ant = null; return ms.map(function (m) {
      const dia = new Date(m.em).toDateString(); const novoDia = !ant || new Date(ant.em).toDateString() !== dia;
      const continua = !!ant && !novoDia && ant.u === m.u && m.em - ant.em < 5 * 6e4 && !m.pai === !ant.pai && !ant.sistema && !m.sistema;
      ant = m; return Object.assign({}, m, { novoDia: novoDia, continua: continua });
    });
  }
  function naoLidas(msgs, lidoEm, eu) {
    let n = 0, men = 0; lista(msgs).forEach(function (m) { if (m.pai && !m.tambemCanal) return; if (m.u === eu || m.em <= (lidoEm || 0)) return; n++; if (mencoes(m.t).indexOf(eu) >= 0 || mencionaTodos(m.t)) men++; });
    return { n: n, mencoes: men };
  }
  // Threads em que participo (autor da original ou respondi) e as respostas novas.
  function minhasThreads(tree, eu, lidas) {
    const out = []; const M = tree.mensagens || {};
    Object.keys(M).forEach(function (cid) {
      const ms = M[cid]; const pais = {};
      Object.keys(ms).forEach(function (k) { const m = ms[k]; if (m.pai) { (pais[m.pai] = pais[m.pai] || []).push(Object.assign({ id: k }, m)); } });
      Object.keys(pais).forEach(function (pid) { const p = ms[pid]; if (!p) return; const rs = pais[pid].sort(function (a, b) { return a.em - b.em; }); if (p.u !== eu && !rs.some(function (r) { return r.u === eu; }) && mencoes(p.t).indexOf(eu) < 0) return; const visto = (lidas || {})[cid + '/' + pid] || 0; out.push({ canal: cid, pai: Object.assign({ id: pid }, p), respostas: rs, novas: rs.filter(function (r) { return r.em > visto && r.u !== eu; }).length, ultima: rs[rs.length - 1].em }); });
    });
    return out.sort(function (a, b) { return b.ultima - a.ultima; });
  }
  // Menções a mim e reações às minhas mensagens (aba Atividade).
  function atividade(tree, eu) {
    const out = []; const M = tree.mensagens || {};
    Object.keys(M).forEach(function (cid) { const can = (tree.canais || {})[cid]; if (!can) return; Object.keys(M[cid]).forEach(function (k) { const m = M[cid][k];
      if (m.u !== eu && (mencoes(m.t).indexOf(eu) >= 0 || (mencionaTodos(m.t) && !can.dm))) out.push({ tipo: 'mencao', canal: cid, msg: Object.assign({ id: k }, m), em: m.em });
      if (m.u === eu) Object.keys(m.reacoes || {}).forEach(function (e) { Object.keys(m.reacoes[e]).forEach(function (u) { if (u !== eu) out.push({ tipo: 'reacao', canal: cid, msg: Object.assign({ id: k }, m), emoji: e, de: u, em: m.reacoes[e][u] === true ? m.em : m.reacoes[e][u] }); }); });
    }); });
    return out.sort(function (a, b) { return b.em - a.em; });
  }

  // ---------- busca: texto livre + in:#canal + from:@pessoa + has:arquivo ----------
  function buscar(tree, consulta, eu) {
    const norm = function (x) { return String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
    let q = ' ' + String(consulta || '') + ' '; let canal = null, autor = null, arquivo = false;
    q = q.replace(/\s(?:in|em):#?([^\s]+)/i, function (m, c) { canal = norm(c); return ' '; });
    q = q.replace(/\s(?:from|de):@?([^\s]+)/i, function (m, a) { autor = norm(a); return ' '; });
    q = q.replace(/\shas:(?:arquivo|file|anexo)/i, function () { arquivo = true; return ' '; });
    const termos = norm(q).split(/\s+/).filter(Boolean); const out = [];
    const ctx = { membros: tree.membros, canais: tree.canais };
    Object.keys(tree.mensagens || {}).forEach(function (cid) {
      const c = (tree.canais || {})[cid]; if (!c) return; if (c.privado && !(c.membros || {})[eu]) return;
      if (canal && norm(c.nome) !== canal && cid !== canal) return;
      lista(tree.mensagens[cid]).forEach(function (m) {
        if (m.sistema) return; const au = (tree.membros || {})[m.u]; if (autor && !(au && norm(au.nome).split(' ')[0] === autor.split(' ')[0]) && m.u !== autor) return;
        if (arquivo && !(m.anexos && m.anexos.length)) return;
        const txt = norm(textoPuro(m.t, ctx) + ' ' + (m.anexos || []).map(function (a) { return a.nome; }).join(' '));
        if (termos.every(function (w) { return txt.indexOf(w) >= 0; }) && (termos.length || canal || autor || arquivo)) out.push({ canal: cid, msg: m });
      });
    });
    return out.sort(function (a, b) { return b.msg.em - a.msg.em; }).slice(0, 200);
  }

  // Comandos de barra: /tarefa, /status, /lembrar, /me
  function comando(texto) { const m = String(texto || '').match(/^\/(\w+)\s*([\s\S]*)$/); return m ? { nome: m[1].toLowerCase(), arg: m[2].trim() } : null; }

  return { obter: obter, definir: definir, mesclar: mesclar, aplicarEvento: aplicarEvento, id: id, dmId: dmId, slug: slug, EMOJIS: EMOJIS, REACOES_RAPIDAS: REACOES_RAPIDAS, esc: esc, emojis: emojis, formatar: formatar, codificarMencoes: codificarMencoes, codificarCanais: codificarCanais, mencoes: mencoes, mencionaTodos: mencionaTodos, textoPuro: textoPuro, lista: lista, doCanal: doCanal, respostas: respostas, agrupar: agrupar, naoLidas: naoLidas, minhasThreads: minhasThreads, atividade: atividade, buscar: buscar, comando: comando };
});
