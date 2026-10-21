/* Ágora: rede social estilo X para profissionais de licitação. Regras puras (feed, ranking, tendências, busca, notificações). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Agora = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LIMITE = 280;
  const PESO_LINK = 23;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function normalizar(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function handle(nome) { return normalizar(nome).replace(/[^a-z0-9_]+/g, '').slice(0, 15) || 'perfil'; }
  function handleLivre(base, perfis) {
    const usados = {}; Object.keys(perfis || {}).forEach(function (k) { usados[perfis[k].handle] = true; });
    let h = handle(base), n = 1; const raizH = h.slice(0, 13);
    while (usados[h]) h = raizH + (++n);
    return h;
  }
  function id(agora) { return (agora || Date.now()).toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 7); }

  const RE_URL = /(?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)"']/g;
  const RE_TAG = /(^|[^\w&])#([\p{L}\p{N}_]{2,40})/gu;
  const RE_MEN = /(^|[^\w@])@([a-z0-9_]{2,15})\b/gi;

  // Comprimento como no X: link conta 23.
  function comprimento(t) { return String(t || '').replace(RE_URL, ' '.repeat(PESO_LINK)).length; }

  function extrair(t) {
    t = String(t || ''); const tags = [], men = [];
    t.replace(RE_TAG, function (m, a, k) { const n = normalizar(k); if (tags.indexOf(n) < 0) tags.push(n); return m; });
    t.replace(RE_MEN, function (m, a, k) { const n = k.toLowerCase(); if (men.indexOf(n) < 0) men.push(n); return m; });
    return { tags: tags, mencoes: men, links: t.match(RE_URL) || [] };
  }

  // HTML seguro: escapa e só depois cria links, hashtags e menções.
  function formatar(t, handles) {
    const urls = [];
    let s = String(t || '').replace(RE_URL, function (u) { urls.push(u); return '\u0000' + (urls.length - 1) + '\u0000'; });
    s = esc(s);
    s = s.replace(RE_TAG, function (m, a, k) { return a + '<a class="ag-tag" href="#/agora/tag/' + encodeURIComponent(normalizar(k)) + '">#' + k + '</a>'; });
    s = s.replace(RE_MEN, function (m, a, k) { const h = k.toLowerCase(); return a + (!handles || handles[h] ? '<a class="ag-men" href="#/agora/u/' + h + '">@' + k + '</a>' : '@' + k); });
    s = s.replace(/\u0000(\d+)\u0000/g, function (m, i) { const u = urls[i]; const href = /^www\./i.test(u) ? 'https://' + u : u; const vis = u.replace(/^https?:\/\/(www\.)?/i, ''); return '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer nofollow">' + esc(vis.length > 32 ? vis.slice(0, 31) + '…' : vis) + '</a>'; });
    return s.replace(/\n/g, '<br>');
  }

  function n(o) { return Object.keys(o || {}).length; }
  function lista(posts) { return Object.keys(posts || {}).map(function (k) { return Object.assign({ id: k }, posts[k]); }); }
  function respostasDe(posts, pid) { return lista(posts).filter(function (p) { return p.resp === pid && !p.apagado; }).sort(function (a, b) { return a.em - b.em; }); }
  function contagens(posts, p) {
    const L = lista(posts);
    return { respostas: L.filter(function (x) { return x.resp === p.id && !x.apagado; }).length, reposts: n(p.reposts) + L.filter(function (x) { return x.cit === p.id && !x.apagado; }).length, curtidas: n(p.curtidas) };
  }

  // Pontuação "Para você": engajamento com decaimento no tempo (horas).
  function pontuacao(p, c, agora, seguidos) {
    const h = Math.max(0, (agora - p.em) / 36e5);
    const eng = 1 + c.curtidas + 2 * c.reposts + 3 * c.respostas;
    return eng * (seguidos && seguidos[p.u] ? 1.5 : 1) / Math.pow(h + 2, 1.5);
  }

  // Itens do feed: { post, por (quem repostou, se for repost), em }
  function feed(posts, o) {
    o = o || {}; const agora = o.agora || Date.now(); const eu = o.eu; const seg = o.seguindo || {}; const ocultos = o.ocultos || {};
    const L = lista(posts).filter(function (p) { return !p.apagado && !ocultos[p.u]; });
    const itens = [];
    L.forEach(function (p) {
      if (!p.resp) itens.push({ post: p, em: p.em });
      Object.keys(p.reposts || {}).forEach(function (u) { if (ocultos[u]) return; if (o.modo === 'seguindo' ? (seg[u] || u === eu) : u !== p.u) itens.push({ post: p, por: u, em: p.reposts[u] }); });
    });
    let r;
    if (o.modo === 'seguindo') r = itens.filter(function (x) { return x.por ? true : (seg[x.post.u] || x.post.u === eu); }).sort(function (a, b) { return b.em - a.em; });
    else {
      const visto = {};
      r = itens.filter(function (x) { if (visto[x.post.id]) return false; visto[x.post.id] = true; return true; })
        .map(function (x) { return { x: x, s: pontuacao(x.post, contagens(posts, x.post), agora, seg) }; })
        .sort(function (a, b) { return b.s - a.s || b.x.em - a.x.em; }).map(function (y) { return y.x; });
    }
    return o.limite ? r.slice(0, o.limite) : r;
  }

  function doPerfil(posts, uid, aba) {
    const L = lista(posts).filter(function (p) { return !p.apagado; });
    if (aba === 'curtidas') return L.filter(function (p) { return (p.curtidas || {})[uid]; }).sort(function (a, b) { return b.curtidas[uid] - a.curtidas[uid]; }).map(function (p) { return { post: p, em: p.curtidas[uid] }; });
    if (aba === 'respostas') return L.filter(function (p) { return p.u === uid && p.resp; }).sort(function (a, b) { return b.em - a.em; }).map(function (p) { return { post: p, em: p.em }; });
    if (aba === 'midia') return L.filter(function (p) { return p.u === uid && p.img; }).sort(function (a, b) { return b.em - a.em; }).map(function (p) { return { post: p, em: p.em }; });
    const it = L.filter(function (p) { return p.u === uid && !p.resp; }).map(function (p) { return { post: p, em: p.em }; });
    L.forEach(function (p) { if ((p.reposts || {})[uid] && p.u !== uid) it.push({ post: p, por: uid, em: p.reposts[uid] }); });
    const fixo = it.find(function (x) { return x.post.fixado && !x.por; });
    const resto = it.filter(function (x) { return x !== fixo; }).sort(function (a, b) { return b.em - a.em; });
    return fixo ? [fixo].concat(resto) : resto;
  }

  function tendencias(posts, o) {
    o = o || {}; const agora = o.agora || Date.now(); const janela = (o.horas || 24) * 36e5;
    const c = {};
    lista(posts).forEach(function (p) {
      if (p.apagado || agora - p.em > janela) return;
      extrair(p.t).tags.forEach(function (t) { c[t] = c[t] || { tag: t, posts: 0, autores: {} }; c[t].posts++; c[t].autores[p.u] = 1; });
    });
    return Object.keys(c).map(function (k) { const x = c[k]; return { tag: x.tag, posts: x.posts, autores: n(x.autores), peso: n(x.autores) * 2 + x.posts }; })
      .sort(function (a, b) { return b.peso - a.peso || a.tag.localeCompare(b.tag); }).slice(0, o.limite || 8);
  }

  function buscar(posts, perfis, q) {
    q = String(q || '').trim(); if (!q) return { posts: [], perfis: [] };
    const nq = normalizar(q);
    if (nq[0] === '#') { const t = nq.slice(1); return { posts: lista(posts).filter(function (p) { return !p.apagado && extrair(p.t).tags.indexOf(t) >= 0; }).sort(function (a, b) { return b.em - a.em; }), perfis: [] }; }
    const termos = nq.replace(/^@/, '').split(/\s+/).filter(Boolean);
    const P = lista(posts).filter(function (p) { if (p.apagado) return false; const t = normalizar(p.t); return termos.every(function (x) { return t.indexOf(x) >= 0; }); }).sort(function (a, b) { return b.em - a.em; });
    const U = Object.keys(perfis || {}).map(function (k) { return Object.assign({ id: k }, perfis[k]); }).filter(function (u) { const t = normalizar(u.nome + ' ' + u.handle + ' ' + (u.cargo || '') + ' ' + (u.empresa || '') + ' ' + (u.bio || '')); return termos.every(function (x) { return t.indexOf(x) >= 0; }); });
    return { posts: P, perfis: U };
  }

  function quemSeguir(perfis, seguir, eu, posts, limite) {
    const meus = (seguir || {})[eu] || {};
    const ativ = {}; lista(posts).forEach(function (p) { if (!p.apagado) ativ[p.u] = (ativ[p.u] || 0) + 1; });
    const seguidores = {}; Object.keys(seguir || {}).forEach(function (u) { Object.keys(seguir[u] || {}).forEach(function (a) { seguidores[a] = (seguidores[a] || 0) + 1; }); });
    // amigos de amigos pesam mais
    const fof = {}; Object.keys(meus).forEach(function (a) { Object.keys((seguir || {})[a] || {}).forEach(function (b) { fof[b] = (fof[b] || 0) + 1; }); });
    return Object.keys(perfis || {}).filter(function (u) { return u !== eu && !meus[u]; })
      .map(function (u) { return { id: u, s: (fof[u] || 0) * 5 + (seguidores[u] || 0) * 2 + (ativ[u] || 0) }; })
      .sort(function (a, b) { return b.s - a.s || a.id.localeCompare(b.id); }).slice(0, limite || 3).map(function (x) { return x.id; });
  }

  function seguidoresDe(seguir, uid) { return Object.keys(seguir || {}).filter(function (u) { return (seguir[u] || {})[uid]; }); }

  // Notificações para "eu": curtidas, reposts, respostas, citações, menções e novos seguidores.
  function notificacoes(arv, eu, handleEu) {
    const out = []; const posts = arv.posts || {};
    lista(posts).forEach(function (p) {
      if (p.apagado) return;
      if (p.u === eu) {
        Object.keys(p.curtidas || {}).forEach(function (u) { if (u !== eu) out.push({ tipo: 'curtida', u: u, post: p.id, em: p.curtidas[u] }); });
        Object.keys(p.reposts || {}).forEach(function (u) { if (u !== eu) out.push({ tipo: 'repost', u: u, post: p.id, em: p.reposts[u] }); });
      } else {
        const pai = p.resp && posts[p.resp];
        if (pai && pai.u === eu) out.push({ tipo: 'resposta', u: p.u, post: p.id, em: p.em });
        const cit = p.cit && posts[p.cit];
        if (cit && cit.u === eu) out.push({ tipo: 'citacao', u: p.u, post: p.id, em: p.em });
        if (handleEu && extrair(p.t).mencoes.indexOf(handleEu) >= 0 && !(pai && pai.u === eu)) out.push({ tipo: 'mencao', u: p.u, post: p.id, em: p.em });
      }
    });
    Object.keys(arv.seguir || {}).forEach(function (u) { const ts = (arv.seguir[u] || {})[eu]; if (ts && u !== eu) out.push({ tipo: 'seguiu', u: u, em: ts }); });
    return out.sort(function (a, b) { return b.em - a.em; });
  }

  function enquete(p, eu, agora) {
    if (!p.enquete) return null;
    const e = p.enquete; const votos = e.votos || {}; const tot = n(votos);
    const cont = e.opcoes.map(function (_, i) { return Object.keys(votos).filter(function (u) { return votos[u] === i; }).length; });
    return { opcoes: e.opcoes.map(function (t, i) { return { t: t, votos: cont[i], pct: tot ? Math.round(cont[i] / tot * 100) : 0 }; }), total: tot, meuVoto: votos[eu], encerrada: (agora || Date.now()) >= e.fim, fim: e.fim };
  }

  function tempoRelativo(ts, agora) {
    const s = Math.max(0, Math.round(((agora || Date.now()) - ts) / 1000));
    if (s < 60) return s + 's'; if (s < 3600) return Math.floor(s / 60) + 'min'; if (s < 86400) return Math.floor(s / 3600) + 'h';
    const d = new Date(ts), h = new Date(agora || Date.now());
    return d.toLocaleDateString('pt-BR', d.getFullYear() === h.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
  }

  function podeEditar(p, eu, agora) { return p.u === eu && ((agora || Date.now()) - p.em) < 60 * 60 * 1000; }

  return { LIMITE: LIMITE, esc: esc, normalizar: normalizar, handle: handle, handleLivre: handleLivre, id: id, comprimento: comprimento, extrair: extrair, formatar: formatar,
    lista: lista, respostasDe: respostasDe, contagens: contagens, pontuacao: pontuacao, feed: feed, doPerfil: doPerfil, tendencias: tendencias, buscar: buscar,
    quemSeguir: quemSeguir, seguidoresDe: seguidoresDe, notificacoes: notificacoes, enquete: enquete, tempoRelativo: tempoRelativo, podeEditar: podeEditar };
});
