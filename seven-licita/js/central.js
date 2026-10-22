/* Central da operação: filtro avançado de avisos (palavras com ";" e exclusão, faixa de valor, ME/EPP, SRP, órgão),
   notificações (o "sino"), carteira de clientes do BPO e diretório de órgãos. Puro, testável no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Central = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DIA = 864e5;
  function normalizar(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function numero(v) { if (typeof v === 'number') return v; let t = String(v == null ? '' : v).replace(/[R$\s]/g, ''); if (!t) return null; if (t.indexOf(',') >= 0 || /^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); const n = Number(t); return isFinite(n) ? n : null; }

  // ---------- consulta por palavras ----------
  // "papel a4; sulfite; -reciclado": casa se tiver ALGUM dos termos e NENHUM dos excluídos (marcados com hífen).
  // Dentro de um termo, todas as palavras precisam aparecer (palavras curtas, até 3 letras, só como palavra inteira).
  function lerConsulta(q) {
    const incluir = [], excluir = [];
    String(q || '').split(/[;,]/).map(function (t) { return t.trim(); }).filter(Boolean).forEach(function (t) {
      const m = t.match(/^-\s*(.+)$/); /* só o hífen exclui: "sem fio" e "não tecido" são produtos */ const alvo = normalizar(m ? m[1] : t); if (!alvo) return;
      (m ? excluir : incluir).push(alvo);
    });
    return { incluir: incluir, excluir: excluir };
  }
  function contem(textoNorm, termo) { const alvo = ' ' + textoNorm + ' '; return termo.split(' ').every(function (p) { return p.length <= 3 ? alvo.indexOf(' ' + p + ' ') >= 0 : alvo.indexOf(p) >= 0; }); }
  function casaConsulta(texto, q) {
    const c = typeof q === 'string' ? lerConsulta(q) : q; const t = normalizar(texto);
    if (c.excluir.some(function (x) { return contem(t, x); })) return false;
    return !c.incluir.length || c.incluir.some(function (x) { return contem(t, x); });
  }

  // Busca inteligente: cada palavra do termo em qualquer ordem, singular/plural e começo de palavra
  // ("uniforme escolar" casa "uniformes para uso escolar"; "notebook" casa "notebooks").
  function radical(w) { if (w.length <= 4) return w; w = w.replace(/(coes|cao)$/, 'c').replace(/(oes|aes|ao)$/, 'a').replace(/ais$/, 'al').replace(/eis$/, 'el').replace(/s$/, ''); return w.length > 5 ? w.replace(/e$/, '') : w; }
  function contemInteligente(textoNorm, termo) {
    const pals = textoNorm.split(' ').map(radical);
    return termo.split(' ').filter(function (p) { return p.length > 1 && !/^(de|da|do|das|dos|e|para|com|em)$/.test(p); }).every(function (p) { const r = radical(p); return pals.some(function (w) { return w.indexOf(r) === 0; }); });
  }
  function casaConsultaInteligente(texto, q) {
    const c = typeof q === 'string' ? lerConsulta(q) : q; const t = normalizar(texto);
    if (c.excluir.some(function (x) { return contemInteligente(t, x); })) return false;
    return !c.incluir.length || c.incluir.some(function (x) { return contemInteligente(t, x); });
  }
  // Carimbo em UTC (toISOString) → dia no fuso de quem usa.
  function dataLocal(iso) { if (!iso || !/T.*(Z|[+-]\d\d:?\d\d)$/.test(iso)) return iso; const d = new Date(iso); if (isNaN(d)) return iso; return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function entre(valorISO, de, ate) { const v = String(valorISO || '').slice(0, 10); if (!de && !ate) return true; if (!v) return false; return (!de || v >= de) && (!ate || v <= ate); }
  // Busca de Licitações: f = { texto, inteligente, portal, numero, minhas, ids (Set/obj dos meus), aberturaDe/Ate, encerramentoDe/Ate,
  //   publicacaoDe/Ate, esferas [M,E,F,D], modalidades [ids], orgao, ufs [], cidades "a; b", + filtros de valor/ME/SRP }.
  function filtrarBusca(lista, f) {
    f = f || {}; const cids = String(f.cidades || '').split(/[;,]/).map(normalizar).filter(Boolean); const portal = normalizar(f.portal); const num = normalizar(f.numero);
    const base = (lista || []).filter(function (a) {
      if (f.minhas && !(f.ids && f.ids[a.id])) return false;
      if (portal && normalizar((a.sistema || '') + ' ' + (a.linkOrigem || '')).indexOf(portal) < 0) return false;
      if (num && normalizar((a.numero || '') + ' ' + (a.processo || '') + ' ' + (a.id || '')).indexOf(num) < 0) return false;
      if (!entre(a.abertura, f.aberturaDe, f.aberturaAte)) return false;
      if (!entre(a.encerramento, f.encerramentoDe, f.encerramentoAte)) return false;
      if (!entre(a.publicacao, f.publicacaoDe, f.publicacaoAte)) return false;
      if (f.esferas && f.esferas.length && f.esferas.indexOf(a.esfera) < 0) return false;
      if (f.modalidades && f.modalidades.length && f.modalidades.map(String).indexOf(String(a.modalidadeId)) < 0) return false;
      if (f.ufs && f.ufs.length && f.ufs.indexOf(a.uf) < 0) return false;
      if (cids.length && cids.indexOf(normalizar(a.municipio)) < 0) return false;
      if (f.texto && !(f.inteligente ? casaConsultaInteligente : casaConsulta)(a.objeto + ' ' + (a.info || '') + ' ' + (f.inteligente ? a.orgao : ''), f.texto)) return false;
      return true;
    });
    return filtrarAvisos(base, { valorMin: f.valorMin, valorMax: f.valorMax, meEpp: f.meEpp, srp: f.srp, orgao: f.orgao, sigiloso: f.sigiloso });
  }

  // f: { texto, valorMin, valorMax, meEpp: ''|'exclusivo'|'com'|'sem', srp: ''|'sem'|'so', orgao, uf, sigiloso: bool,
  //   e (Meus Avisos) portais [], codigo, uasg, id, modalidades [], esferas [], ufs [], municipios [], perfis [], palavras [],
  //   aberturaDe/Ate, encerramentoDe/Ate, publicacaoDe/Ate, enviadoDe/Ate, cadastro ''|'sim'|'nao' + cadastrados {id:1},
  //   capag [notas] + notaCapag(a) → 'A'..'D' ou '', valorAlvo ''|'item'|'itemTotal'|'grupo' + itemMin/itemMax }
  function filtrarAvisos(avisos, f) {
    f = f || {}; const c = lerConsulta(f.texto); const vmin = numero(f.valorMin), vmax = numero(f.valorMax); const org = normalizar(f.orgao);
    const imin = numero(f.itemMin), imax = numero(f.itemMax); const porItem = f.valorAlvo && (imin != null || imax != null);
    const cod = normalizar(f.codigo), uasg = normalizar(f.uasg), idq = normalizar(f.id);
    const lista = function (x) { return x && x.length ? x : null; };
    const portais = lista(f.portais), mods = lista(f.modalidades), esf = lista(f.esferas), ufs = lista(f.ufs), perfis = lista(f.perfis), pals = lista(f.palavras), capag = lista(f.capag);
    const muns = lista((f.municipios || []).map(normalizar));
    return (avisos || []).filter(function (a) {
      if (f.uf && a.uf !== f.uf) return false;
      if (f.sigiloso) { if (a.valorEstimado) return false; }
      else { if (vmin != null && !(a.valorEstimado >= vmin)) return false; if (vmax != null && !(a.valorEstimado && a.valorEstimado <= vmax)) return false; }
      if (f.meEpp === 'exclusivo' && !/exclusivo/i.test(a.meEpp || '')) return false;
      if (f.meEpp === 'com' && !a.meEpp) return false;
      if (f.meEpp === 'sem' && a.meEpp) return false;
      if (f.srp === 'sem' && a.srp) return false;
      if (f.srp === 'so' && !a.srp) return false;
      if (org && normalizar(a.orgao + ' ' + (a.unidade || '') + ' ' + (a.cnpj || '')).indexOf(org) < 0) return false;
      if (portais && portais.indexOf(a.sistema || 'Não informado') < 0) return false;
      if (cod && normalizar((a.numero || '') + ' ' + (a.processo || '')).indexOf(cod) < 0) return false;
      if (uasg && normalizar((a.uasg || '') + ' ' + (a.unidade || '')).indexOf(uasg) < 0) return false;
      if (idq && normalizar(a.id).indexOf(idq) < 0) return false;
      if (mods && mods.map(String).indexOf(String(a.modalidadeId)) < 0) return false;
      if (esf && esf.indexOf(a.esfera) < 0) return false;
      if (ufs && ufs.indexOf(a.uf) < 0) return false;
      if (muns && muns.indexOf(normalizar(a.municipio)) < 0) return false;
      if (perfis && !(a.perfis || []).some(function (p) { return perfis.indexOf(p) >= 0; })) return false;
      if (pals && !(a.produtos || []).some(function (p) { return pals.indexOf(p) >= 0; })) return false;
      if (!entre(a.abertura, f.aberturaDe, f.aberturaAte)) return false;
      if (!entre(a.encerramento, f.encerramentoDe, f.encerramentoAte)) return false;
      if (!entre(a.publicacao, f.publicacaoDe, f.publicacaoAte)) return false;
      if (!entre(dataLocal(a.capturadoEm), f.enviadoDe, f.enviadoAte)) return false;
      if (f.cadastro === 'sim' && !(f.cadastrados && f.cadastrados[a.id])) return false;
      if (f.cadastro === 'nao' && f.cadastrados && f.cadastrados[a.id]) return false;
      if (capag && capag.indexOf((f.notaCapag ? f.notaCapag(a) : '') || 'sem') < 0) return false;
      if (porItem && !valoresAlvo(a.itensValores, f.valorAlvo).some(function (v) { return (imin == null || v >= imin) && (imax == null || v <= imax); })) return false;
      if ((c.incluir.length || c.excluir.length) && !casaConsulta(a.objeto + ' ' + a.orgao + ' ' + (a.municipio || ''), c)) return false;
      return true;
    });
  }

  // ---------- valores por item, grupo e lote ----------
  // Grupo/lote vem do campo do PNCP quando existe, senão da descrição ("LOTE 02 - ...", "Grupo 3:").
  function grupoDoItem(i) {
    if (i.grupo != null && i.grupo !== '') return String(i.grupo);
    const m = String(i.descricao || '').match(/\b(lote|grupo)\s*(?:n[º°o.]*\s*)?0*(\d+)/i);
    return m ? m[2] : null;
  }
  // Resumo compacto guardado no aviso: n (item), u (unitário estimado), t (total estimado), g (grupo/lote ou null).
  function resumoItens(itens) {
    return (itens || []).map(function (i) {
      const u = i.sigiloso ? null : numero(i.refUnitaria); const q = numero(i.quantidade);
      let t = i.sigiloso ? null : numero(i.total); if (t == null && u != null && q != null) t = Math.round(u * q * 100) / 100;
      return { n: i.numero, u: u, t: t, g: grupoDoItem(i) };
    });
  }
  // item: unitário de cada item · itemTotal: total de cada item · grupo: soma dos itens do mesmo grupo/lote
  // (item sem grupo informado conta como lote próprio, que é como o PNCP publica a maioria dos lotes).
  function valoresAlvo(resumo, alvo) {
    if (!resumo || !resumo.length) return [];
    if (alvo === 'item') return resumo.map(function (r) { return r.u; }).filter(function (v) { return v != null; });
    if (alvo === 'itemTotal') return resumo.map(function (r) { return r.t; }).filter(function (v) { return v != null; });
    const g = {};
    resumo.forEach(function (r) { if (r.t == null) return; const k = r.g != null ? 'g' + r.g : 'i' + r.n; g[k] = Math.round(((g[k] || 0) + r.t) * 100) / 100; });
    return Object.keys(g).map(function (k) { return g[k]; });
  }

  // ---------- notificações ----------
  // fontes já coletadas pelas telas; cada notificação tem id estável (para marcar como lida) e prioridade.
  function notificacoes(fontes, agoraMs) {
    const agora = agoraMs || Date.now(); const out = [];
    const add = function (n) { out.push(n); };
    const novos = fontes.avisosNovos || [];
    if (novos.length) add({ id: 'avisos:' + novos.map(function (a) { return a.id; }).sort().join('|').slice(0, 300), tipo: 'avisos', icone: '🔎', titulo: novos.length + ' aviso(s) novo(s) de licitação', texto: novos.slice(0, 3).map(function (a) { return String(a.objeto || '').slice(0, 70); }).join(' · '), link: '#/encontrar', quando: novos.reduce(function (m, a) { return a.capturadoEm > m ? a.capturadoEm : m; }, ''), prioridade: 2 });
    (fontes.sessoes || []).forEach(function (s) { const ms = new Date(s.quando) - agora; if (ms < 0 || ms > 2 * DIA) return; add({ id: 'sessao:' + s.id + ':' + s.quando, tipo: 'sessao', icone: '⚡', titulo: (ms < DIA ? 'Sessão em menos de 24 h' : 'Sessão em até 48 h'), texto: String(s.titulo || '').slice(0, 120), link: s.link, quando: s.quando, prioridade: ms < DIA ? 4 : 3 }); });
    (fontes.prazos || []).forEach(function (p) { const ms = new Date(p.quando) - agora; if (ms > 2 * DIA) return; add({ id: 'prazo:' + p.id, tipo: 'prazo', icone: '⏰', titulo: ms < 0 ? 'Prazo do pregoeiro vencido' : 'Prazo do pregoeiro: ' + (p.tipo || 'prazo aberto'), texto: String(p.titulo || ''), link: p.link, quando: p.quando, prioridade: ms < 0 ? 5 : 4 }); });
    (fontes.documentos || []).forEach(function (d) { const ms = new Date(d.validade + 'T23:59:59') - agora; if (ms > 7 * DIA) return; add({ id: 'doc:' + d.id + ':' + d.validade, tipo: 'documento', icone: '📄', titulo: ms < 0 ? 'Documento vencido' : 'Documento vence em ' + Math.max(0, Math.floor(ms / DIA)) + ' dia(s)', texto: d.nome + (d.empresa ? ' · ' + d.empresa : ''), link: '#/cadastrar/documentos', quando: d.validade, prioridade: ms < 0 ? 4 : 3 }); });
    (fontes.pendencias || []).forEach(function (p) { add({ id: 'quadro:' + p.id + ':' + p.quando, tipo: 'quadro', icone: '▦', titulo: p.atrasado ? 'Pendência atrasada no Quadro' : 'Pendência vencendo no Quadro', texto: p.titulo, link: p.link, quando: p.quando, prioridade: p.atrasado ? 3 : 2 }); });
    (fontes.atividades || []).forEach(function (a) { add({ id: 'atv:' + a.id, tipo: 'comercial', icone: '📈', titulo: a.atrasada ? 'Atividade comercial atrasada' : 'Atividade comercial para hoje', texto: a.titulo, link: '#/comercial/atividades', quando: a.quando, prioridade: a.atrasada ? 2 : 1 }); });
    (fontes.tarefas || []).forEach(function (t) { add({ id: 'tarefa:' + t.id + ':' + t.quando, tipo: 'agenda', icone: '☑', titulo: t.atrasada ? 'Tarefa atrasada' : 'Tarefa para hoje', texto: t.titulo, link: '#/agenda', quando: t.quando, prioridade: t.atrasada ? 2 : 1 }); });
    return out.sort(function (a, b) { return b.prioridade - a.prioridade || String(a.quando).localeCompare(String(b.quando)); });
  }
  function naoLidas(lista, lidas) { lidas = lidas || {}; return lista.filter(function (n) { return !lidas[n.id]; }); }
  // Guarda só as marcas de lidas que ainda existem (para não crescer para sempre).
  function podarLidas(lidas, lista) { const ids = {}; lista.forEach(function (n) { ids[n.id] = 1; }); const out = {}; Object.keys(lidas || {}).forEach(function (k) { if (ids[k]) out[k] = lidas[k]; }); return out; }

  // ---------- carteira do BPO ----------
  // d: estado (empresas, perfis, avisos, propostas, disputas, monitor, documentos). Um resumo por cliente.
  function carteira(d, agoraMs) {
    const agora = agoraMs || Date.now(); const perfisDe = {};
    (d.perfis || []).forEach(function (p) { if (p.empresaId) perfisDe[p.id] = p.empresaId; });
    const avisos = Object.keys(d.avisos || {}).map(function (k) { return d.avisos[k]; });
    return (d.empresas || []).map(function (e) {
      const meu = function (x) { return x.empresaId === e.id; };
      const novos = avisos.filter(function (a) { return !a.lido && !a.lixeira && (a.perfis || []).some(function (p) { return perfisDe[p] === e.id; }); }).length;
      const props = (d.propostas || []).filter(meu);
      const sess = props.filter(function (p) { const ms = new Date(p.encerramento) - agora; return p.encerramento && ms > 0 && ms < 7 * DIA && p.status !== 'perdida'; });
      const mon = (d.monitor || []).filter(meu);
      const prazos = []; mon.forEach(function (m) { (m.prazos || []).forEach(function (p) { if (!p.feito) prazos.push(p); }); });
      const docs = (d.documentos || []).filter(meu).filter(function (x) { return x.validade; });
      const vencidos = docs.filter(function (x) { return new Date(x.validade + 'T23:59:59') < agora; }).length;
      const vencendo = docs.filter(function (x) { const ms = new Date(x.validade + 'T23:59:59') - agora; return ms >= 0 && ms <= 7 * DIA; }).length;
      const semLimite = (d.disputas || []).filter(meu).filter(function (x) { return (x.itens || []).some(function (i) { return !i.limite || !i.aprovado; }); }).length;
      const ganhas = props.filter(function (p) { return p.status === 'vencida'; }).length; const fechadas = ganhas + props.filter(function (p) { return p.status === 'perdida'; }).length;
      const alertas = vencidos + semLimite + prazos.filter(function (p) { return new Date(p.ate) < agora; }).length;
      return { id: e.id, nome: e.fantasia || e.razao, cnpj: e.cnpj, uf: e.uf, responsavel: e.responsavel || '', avisosNovos: novos, emPreparo: props.filter(function (p) { return p.status === 'rascunho' || p.status === 'pronta'; }).length,
        sessoes7: sess.length, proximaSessao: sess.map(function (p) { return p.encerramento; }).sort()[0] || null, monitorados: mon.length, prazosAbertos: prazos.length, docsVencidos: vencidos, docsVencendo: vencendo, disputasSemLimite: semLimite,
        taxaVitoria: fechadas ? ganhas / fechadas : null, alertas: alertas, situacao: alertas ? 'atencao' : (vencendo || sess.length ? 'acompanhar' : 'em-dia') };
    });
  }
  // Sessões dos próximos dias, com o responsável (do processo ou, na falta, do cliente) e se cai fora do horário da Seven.
  function horarioSeven(dt) { const d = new Date(dt); const dia = d.getDay(); const h = d.getHours() + d.getMinutes() / 60; if (dia === 0) return false; if (dia === 6) return h >= 9 && h < 12; return h >= 9 && h < 18; }
  function escala(d, agoraMs, dias) {
    const agora = agoraMs || Date.now(); const lim = agora + (dias || 14) * DIA; const emp = {}; (d.empresas || []).forEach(function (e) { emp[e.id] = e; });
    const out = [];
    (d.propostas || []).forEach(function (p) { const t = new Date(p.encerramento).getTime(); if (!p.encerramento || t < agora - 3600e3 || t > lim || p.status === 'perdida') return; const e = emp[p.empresaId] || {}; out.push({ id: 'prop:' + p.id, quando: p.encerramento, titulo: [p.modalidade, p.numero].filter(Boolean).join(' ') + ' · ' + (p.orgao || ''), objeto: p.objeto || '', cliente: e.fantasia || e.razao || '—', responsavel: p.responsavel || e.responsavel || '', link: '#/cadastrar/proposta/' + p.id, foraHorario: !horarioSeven(p.encerramento) }); });
    (d.monitor || []).forEach(function (m) { if (!m.sessao) return; const t = new Date(m.sessao).getTime(); if (t < agora - 3600e3 || t > lim) return; if (out.some(function (x) { return x.quando === m.sessao && x.titulo.indexOf(m.numero || '¤') >= 0; })) return; const e = emp[m.empresaId] || {}; out.push({ id: 'mon:' + m.id, quando: m.sessao, titulo: m.titulo || '', objeto: m.objeto || '', cliente: e.fantasia || e.razao || '—', responsavel: m.responsavel || e.responsavel || '', link: '#/monitorar/licitacao/' + m.id, foraHorario: !horarioSeven(m.sessao) }); });
    return out.sort(function (a, b) { return new Date(a.quando) - new Date(b.quando); });
  }

  // ---------- órgãos ----------
  // Junta avisos, propostas, processos monitorados, CAPAG e pagamentos (execução) por CNPJ do órgão.
  function orgaos(d, pagamentos) {
    const m = {};
    const pegar = function (cnpj, nome, uf, municipio, esfera) { const k = String(cnpj || '').replace(/\D/g, '') || 'nome:' + normalizar(nome); if (!m[k]) m[k] = { chave: k, cnpj: String(cnpj || '').replace(/\D/g, ''), nome: nome || '', uf: uf || '', municipio: municipio || '', esfera: esfera || '', avisos: 0, abertos: 0, valor: 0, propostas: 0, ganhas: 0, monitorados: 0, favorito: false, ultima: '' }; const o = m[k]; if (!o.nome && nome) o.nome = nome; if (!o.uf && uf) o.uf = uf; if (!o.municipio && municipio) o.municipio = municipio; if (!o.esfera && esfera) o.esfera = esfera; return o; };
    Object.keys(d.avisos || {}).forEach(function (k) { const a = d.avisos[k]; if (a.lixeira) return; const o = pegar(a.cnpj, a.orgao, a.uf, a.municipio, a.esfera); o.avisos++; o.valor += a.valorEstimado || 0; if (a.encerramento && new Date(a.encerramento) > Date.now()) o.abertos++; if (String(a.publicacao || '') > o.ultima) o.ultima = String(a.publicacao || ''); if (a.ibge) o.ibge = a.ibge; });
    (d.propostas || []).forEach(function (p) { const o = pegar(p.ref && p.ref.cnpj, p.orgao, p.uf, p.municipio); o.propostas++; if (p.status === 'vencida') o.ganhas++; });
    (d.monitor || []).forEach(function (x) { const a = (d.avisos || {})[x.avisoId]; if (!a) return; const o = pegar(a.cnpj, a.orgao, a.uf, a.municipio, a.esfera); o.monitorados++; });
    (d.orgaosFavoritos || []).forEach(function (c) { const k = String(c).replace(/\D/g, ''); if (m[k]) m[k].favorito = true; else { const o = pegar(c, '', '', ''); o.favorito = true; } });
    const capag = (d.config || {}).capag || {}; const pag = {}; (pagamentos || []).forEach(function (p) { pag[normalizar(p.orgao)] = p; });
    return Object.keys(m).map(function (k) {
      const o = m[k]; o.valor = Math.round(o.valor * 100) / 100;
      const c = (o.ibge && capag[o.ibge]) || capag[normalizar(o.municipio) + '-' + String(o.uf || '').toUpperCase()];
      o.capag = o.esfera === 'M' || (!o.esfera && c) ? (c ? c.nota : null) : null;
      const p = pag[normalizar(o.nome)]; o.atrasoMedio = p && p.media != null ? Math.round(p.media) : null; o.emAberto = p ? p.aberto : 0;
      return o;
    }).sort(function (a, b) { return (b.favorito - a.favorito) || (b.abertos - a.abertos) || (b.avisos - a.avisos) || a.nome.localeCompare(b.nome); });
  }

  return { normalizar: normalizar, numero: numero, lerConsulta: lerConsulta, casaConsulta: casaConsulta, casaConsultaInteligente: casaConsultaInteligente, radical: radical, filtrarBusca: filtrarBusca, filtrarAvisos: filtrarAvisos, grupoDoItem: grupoDoItem, resumoItens: resumoItens, valoresAlvo: valoresAlvo, notificacoes: notificacoes, naoLidas: naoLidas, podarLidas: podarLidas,
    carteira: carteira, horarioSeven: horarioSeven, escala: escala, orgaos: orgaos };
});
