/* Seven Synapse (cadernos no estilo NotebookLM): divide fontes em trechos, busca BM25, responde com citações, resume, extrai datas,
   termos-chave, perguntas e os campos de um edital. Tudo local e extrativo: só devolve o que está nas fontes. Puro. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Cadernos = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PARADAS = new Set(('a o as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para pra com sem sob sobre entre até após ante e ou nem mas que se não sim ' +
    'é são ser foi foram será serão era há haver ter tem têm tinha seu sua seus suas ele ela eles elas isso isto aquilo este esta estes estas esse essa esses essas aquele aquela ao aos à às ' +
    'como quando onde qual quais quem cujo cuja mais menos muito muita muitos muitas já também só apenas ainda bem mesmo mesma lhe lhes me te nos vos você vocês eu tu nós ' +
    'deve devem deverá deverão poderá poderão pode podem caso conforme cada qualquer todo toda todos todas outro outra outros outras sua seu art arts nº n inciso item itens').split(' '));
  const MESES = { janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

  function normalizar(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function raiz(p) { return p.length > 5 ? p.replace(/(coes|cao|mente|idades|idade|ais|eis|oes|ões|as|es|os|is|a|e|o|s)$/, '') : p; }
  function tokens(t) { return normalizar(t).split(/[^a-z0-9]+/).filter(function (p) { return p.length > 1 && !PARADAS.has(p); }).map(raiz); }

  // ---------- frases e trechos ----------
  const ABREV = /\b(art|arts|inc|al|n|nº|sr|sra|dr|dra|prof|fl|fls|p|pp|ex|obs|cf|etc|lei|dec|item|subitem|ltda|s\.a|me|epp)\.$/i;
  function frases(t) {
    const out = []; const partes = String(t || '').replace(/\r/g, '').split(/(?<=[.!?;:])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9"“(])|\n{2,}|\n(?=\s*(?:\d+(?:\.\d+)*[.)]?\s|[a-z]\)\s|[IVXLC]+\s*[-–.]\s|•|-\s))/);
    let acc = '';
    partes.forEach(function (p) { if (p == null) return; const s = p.replace(/\s+/g, ' ').trim(); if (!s) return; if (acc && (ABREV.test(acc) || /^(\d+(\.\d+)*\.?|[a-z]\)|[IVXLC]+\s*[-–.])$/.test(acc))) acc += ' ' + s; else { if (acc) out.push(acc); acc = s; } });
    if (acc) out.push(acc);
    return out.filter(function (f) { return f.length > 2; });
  }
  function dividir(texto, alvo) {
    alvo = alvo || 900; const fs = frases(texto); const out = []; let atual = [], tam = 0, inicio = 0;
    fs.forEach(function (f, i) { if (tam + f.length > alvo && atual.length) { out.push({ i: out.length, texto: atual.join(' '), frases: atual.slice(), de: inicio }); atual = []; tam = 0; inicio = i; } atual.push(f); tam += f.length + 1; });
    if (atual.length) out.push({ i: out.length, texto: atual.join(' '), frases: atual.slice(), de: inicio });
    return out;
  }

  // ---------- índice BM25 ----------
  function indexar(fontes) {
    const docs = []; fontes.forEach(function (f) { (f.trechos || dividir(f.texto)).forEach(function (t) { const tk = tokens(t.texto); const tf = {}; tk.forEach(function (w) { tf[w] = (tf[w] || 0) + 1; }); docs.push({ fonte: f.id, nome: f.nome, i: t.i, texto: t.texto, frases: t.frases, tf: tf, len: tk.length }); }); });
    const df = {}; docs.forEach(function (d) { Object.keys(d.tf).forEach(function (w) { df[w] = (df[w] || 0) + 1; }); });
    const media = docs.reduce(function (s, d) { return s + d.len; }, 0) / (docs.length || 1);
    return { docs: docs, df: df, N: docs.length, media: media };
  }
  function idf(ix, w) { const n = ix.df[w] || 0; return Math.log(1 + (ix.N - n + 0.5) / (n + 0.5)); }
  function buscar(ix, consulta, k) {
    const q = tokens(consulta); if (!q.length) return [];
    const k1 = 1.4, b = 0.75;
    return ix.docs.map(function (d) {
      let s = 0; q.forEach(function (w) { const f = d.tf[w]; if (!f) return; s += idf(ix, w) * f * (k1 + 1) / (f + k1 * (1 - b + b * d.len / ix.media)); });
      return { d: d, s: s };
    }).filter(function (x) { return x.s > 0; }).sort(function (a, b2) { return b2.s - a.s; }).slice(0, k || 5);
  }

  // ---------- resposta extrativa com citações ----------
  function responder(ix, pergunta, opc) {
    opc = opc || {}; const achados = buscar(ix, pergunta, 6); const q = tokens(pergunta);
    if (!achados.length || achados[0].s < (opc.minimo || 1)) return { texto: '', citacoes: [], vazio: true };
    const cands = [];
    achados.forEach(function (a, ia) { a.d.frases.forEach(function (f, j) { const tk = tokens(f); const set = new Set(tk); let s = 0; q.forEach(function (w) { if (set.has(w)) s += idf(ix, w); }); if (s > 0) cands.push({ f: f, s: s * (1 + a.s / 20) / Math.sqrt(1 + tk.length / 25), a: a, j: j, ia: ia }); }); });
    cands.sort(function (x, y) { return y.s - x.s; });
    const escolhidas = []; const vistos = new Set();
    for (const c of cands) { const k = normalizar(c.f).slice(0, 80); if (vistos.has(k)) continue; vistos.add(k); escolhidas.push(c); if (escolhidas.length >= (opc.frases || 4)) break; }
    const citacoes = []; const idxCit = {};
    escolhidas.forEach(function (c) { const chave = c.a.d.fonte + ':' + c.a.d.i; if (!(chave in idxCit)) { idxCit[chave] = citacoes.length; citacoes.push({ n: citacoes.length + 1, fonte: c.a.d.fonte, nome: c.a.d.nome, trecho: c.a.d.i, texto: c.a.d.texto }); } c.cit = idxCit[chave] + 1; });
    escolhidas.sort(function (x, y) { return x.cit - y.cit || x.j - y.j; });
    return { texto: escolhidas.map(function (c) { return c.f.replace(/\s*$/, '') + ' [' + c.cit + ']'; }).join(' '), partes: escolhidas.map(function (c) { return { frase: c.f, cit: c.cit }; }), citacoes: citacoes };
  }

  // ---------- termos, resumo, linha do tempo ----------
  function palavrasChave(ix, n) {
    const tf = {}; ix.docs.forEach(function (d) { Object.keys(d.tf).forEach(function (w) { tf[w] = (tf[w] || 0) + d.tf[w]; }); });
    // devolve a forma mais frequente da palavra no texto original
    const formas = {}; ix.docs.forEach(function (d) { (d.texto.match(/[A-Za-zÀ-ÿ0-9]{3,}/g) || []).forEach(function (p) { const r = raiz(normalizar(p)); if (PARADAS.has(normalizar(p))) return; formas[r] = formas[r] || {}; const k = p.toLowerCase(); formas[r][k] = (formas[r][k] || 0) + 1; }); });
    return Object.keys(tf).filter(function (w) { return w.length > 3 && !/^\d+$/.test(w); }).map(function (w) { return { w: w, s: tf[w] * idf(ix, w) * Math.min(1, (ix.df[w] || 0) / 1) }; })
      .sort(function (a, b) { return b.s - a.s; }).slice(0, n || 12).map(function (x) { const f = formas[x.w] || {}; return Object.keys(f).sort(function (a, b) { return f[b] - f[a]; })[0] || x.w; });
  }
  function resumo(ix, n) {
    const termos = {}; ix.docs.forEach(function (d) { Object.keys(d.tf).forEach(function (w) { termos[w] = (termos[w] || 0) + d.tf[w] * idf(ix, w); }); });
    const todas = []; ix.docs.forEach(function (d, di) { d.frases.forEach(function (f, j) { const tk = tokens(f); if (tk.length < 5 || f.length > 420) return; const s = tk.reduce(function (a, w) { return a + (termos[w] || 0); }, 0) / Math.pow(tk.length, 0.7) * (j === 0 && d.i === 0 ? 1.3 : 1); todas.push({ f: f, s: s, ordem: di * 1000 + j, fonte: d.fonte, nome: d.nome, trecho: d.i, tk: new Set(tk) }); }); });
    todas.sort(function (a, b) { return b.s - a.s; });
    const esc = [];
    for (const c of todas) { if (esc.some(function (e) { let comuns = 0; c.tk.forEach(function (w) { if (e.tk.has(w)) comuns++; }); return comuns / Math.min(c.tk.size, e.tk.size) > 0.6; })) continue; esc.push(c); if (esc.length >= (n || 6)) break; }
    return esc.sort(function (a, b) { return a.ordem - b.ordem; }).map(function (c) { return { frase: c.f, fonte: c.fonte, nome: c.nome, trecho: c.trecho }; });
  }
  function datasEm(f) {
    const out = [];
    f.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, function (m, d, mm, a) { out.push({ iso: a + '-' + String(mm).padStart(2, '0') + '-' + String(d).padStart(2, '0'), txt: m }); return m; });
    f.replace(/\b(\d{1,2})º?\s+de\s+([a-zçã]+)\s+de\s+(\d{4})\b/gi, function (m, d, mes, a) { const mm = MESES[mes.toLowerCase()]; if (mm) out.push({ iso: a + '-' + String(mm).padStart(2, '0') + '-' + String(d).padStart(2, '0'), txt: m }); return m; });
    return out.filter(function (x) { const d = new Date(x.iso + 'T12:00:00'); return !isNaN(d) && d.getUTCDate() === Number(x.iso.slice(8)); });
  }
  function linhaDoTempo(ix) {
    const out = []; const vistos = new Set();
    ix.docs.forEach(function (d) { d.frases.forEach(function (f) { datasEm(f).forEach(function (x) { const k = x.iso + normalizar(f).slice(0, 60); if (vistos.has(k)) return; vistos.add(k); out.push({ data: x.iso, frase: f.length > 300 ? f.slice(0, 297) + '…' : f, fonte: d.fonte, nome: d.nome, trecho: d.i }); }); }); });
    return out.sort(function (a, b) { return a.data.localeCompare(b.data); });
  }

  // ---------- perguntas frequentes e quiz ----------
  function faq(ix, n) {
    return palavrasChave(ix, (n || 6) * 2).map(function (t) {
      const r = responder(ix, t, { frases: 2, minimo: 0.5 }); if (r.vazio) return null;
      return { pergunta: 'O que as fontes dizem sobre “' + t + '”?', resposta: r };
    }).filter(Boolean).slice(0, n || 6);
  }
  function quiz(ix, n, aleatorio) {
    const r = aleatorio || Math.random; const termos = palavrasChave(ix, 30); const out = [];
    const frasesBoas = resumo(ix, 30);
    for (const s of frasesBoas) {
      const alvo = termos.find(function (t) { return new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(s.frase); });
      if (!alvo) continue;
      const outros = termos.filter(function (t) { return t !== alvo && !new RegExp('\\b' + t + '\\b', 'i').test(s.frase); }).sort(function () { return r() - 0.5; }).slice(0, 3);
      if (outros.length < 3) continue;
      const ops = outros.concat(alvo).sort(function () { return r() - 0.5; });
      out.push({ enunciado: s.frase.replace(new RegExp('\\b' + alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), '_____'), opcoes: ops, correta: ops.indexOf(alvo), fonte: s.fonte, nome: s.nome, trecho: s.trecho });
      if (out.length >= (n || 5)) break;
    }
    return out;
  }

  // ---------- análise de edital ----------
  const CAMPOS_EDITAL = [
    { id: 'objeto', t: 'Objeto', re: /\bobjeto\b/i, pref: /(constitui|tem por|é a|consiste)/i },
    { id: 'modalidade', t: 'Modalidade e número', re: /\b(preg[aã]o|concorr[eê]ncia|dispensa|inexigibilidade|leil[aã]o|concurso)\b.{0,40}\b(n[ºo°.]|n[uú]mero)\s*\d/i },
    { id: 'sessao', t: 'Data e hora da sessão', re: /\b(sess[aã]o p[uú]blica|abertura|in[ií]cio da disputa|data da sess[aã]o)\b/i, data: true },
    { id: 'valor', t: 'Valor estimado', re: /\b(valor (total )?estimado|valor m[aá]ximo|valor de refer[eê]ncia|or[cç]amento estimado)\b/i, dinheiro: true },
    { id: 'criterio', t: 'Critério de julgamento', re: /\b(menor pre[cç]o|maior desconto|t[eé]cnica e pre[cç]o|melhor t[eé]cnica|maior lance)\b/i },
    { id: 'disputa', t: 'Modo de disputa', re: /\bmodo de disputa\b|\b(aberto e fechado|fechado e aberto)\b/i },
    { id: 'meepp', t: 'ME/EPP (exclusividade ou cota)', re: /\b(exclusiv\w* .{0,40}(microempresa|me\/epp|me e epp)|cota reservada|lei complementar n?[ºo°.]?\s*123)\b/i },
    { id: 'srp', t: 'Registro de preços', re: /\b(registro de pre[cç]os|ata de registro)\b/i },
    { id: 'entrega', t: 'Prazo de entrega / execução', re: /\bprazo (de|para) (entrega|execu[cç][aã]o|fornecimento)\b/i },
    { id: 'vigencia', t: 'Vigência', re: /\bvig[eê]ncia\b/i },
    { id: 'pagamento', t: 'Pagamento', re: /\b(pagamento ser[aá]|prazo (de|para) pagamento)\b/i },
    { id: 'garantia', t: 'Garantia', re: /\bgarantia (contratual|de execu[cç][aã]o|da proposta)\b/i },
    { id: 'amostra', t: 'Amostra / prova de conceito', re: /\b(amostra|prova de conceito)\b/i },
    { id: 'visita', t: 'Visita técnica', re: /\bvisita (t[eé]cnica|ao local)|vistoria\b/i },
    { id: 'impugnacao', t: 'Impugnação e esclarecimentos', re: /\b(impugna[cç][aã]o|pedido de esclarecimento)\b/i },
    { id: 'penalidades', t: 'Sanções', re: /\b(multa|impedimento de licitar|inidoneidade|advert[eê]ncia)\b/i }
  ];
  const HABILITACAO = [
    { id: 'juridica', t: 'Habilitação jurídica', re: /\b(ato constitutivo|contrato social|estatuto|registro comercial|ccmei)\b/i },
    { id: 'fiscal', t: 'Regularidade fiscal e trabalhista', re: /\b(cnpj|fazenda (federal|estadual|municipal)|fgts|cndt|d[eé]bitos trabalhistas|regularidade fiscal)\b/i },
    { id: 'economica', t: 'Qualificação econômico-financeira', re: /\b(balan[cç]o patrimonial|fal[eê]ncia|recupera[cç][aã]o judicial|[ií]ndices? de liquidez|patrim[oô]nio l[ií]quido|capital social m[ií]nimo)\b/i },
    { id: 'tecnica', t: 'Qualificação técnica', re: /\b(atestados?|capacidade t[eé]cnica|crea|cau|registro (no|em) conselho|acervo t[eé]cnico|cat\b)/i },
    { id: 'declaracoes', t: 'Declarações', re: /\bdeclara[cç](ão|ões|ao|oes)\b/i }
  ];
  function dinheiro(f) { const m = f.match(/R\$\s?[\d.]+(,\d{2})?/); return m ? m[0] : ''; }
  function analisarEdital(ix) {
    const todas = []; ix.docs.forEach(function (d) { d.frases.forEach(function (f) { todas.push({ f: f, fonte: d.fonte, nome: d.nome, trecho: d.i }); }); });
    const campos = CAMPOS_EDITAL.map(function (c) {
      let ms = todas.filter(function (x) { return c.re.test(x.f); });
      if (c.data) ms = ms.filter(function (x) { return datasEm(x.f).length || /\d{1,2}h|\d{1,2}:\d{2}/.test(x.f); }).concat(ms);
      if (c.dinheiro) ms = ms.filter(function (x) { return dinheiro(x.f); }).concat(ms);
      if (c.pref) ms = ms.filter(function (x) { return c.pref.test(x.f); }).concat(ms);
      const x = ms[0]; if (!x) return { id: c.id, t: c.t, achado: false };
      return { id: c.id, t: c.t, achado: true, frase: x.f.length > 500 ? x.f.slice(0, 497) + '…' : x.f, destaque: c.dinheiro ? dinheiro(x.f) : c.data ? (datasEm(x.f)[0] || {}).txt || '' : '', fonte: x.fonte, nome: x.nome, trecho: x.trecho, mais: ms.length - 1 };
    });
    const habilitacao = HABILITACAO.map(function (h) {
      const ms = todas.filter(function (x) { return h.re.test(x.f); });
      const vistos = new Set(); const itens = ms.filter(function (x) { const k = normalizar(x.f).slice(0, 70); if (vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, 6).map(function (x) { return { frase: x.f.length > 300 ? x.f.slice(0, 297) + '…' : x.f, fonte: x.fonte, nome: x.nome, trecho: x.trecho }; });
      return { id: h.id, t: h.t, itens: itens };
    });
    return { campos: campos, habilitacao: habilitacao, datas: linhaDoTempo(ix) };
  }

  function perguntasSugeridas(ix) {
    const t = palavrasChave(ix, 8); const sug = [];
    if (/edital|preg|licita/i.test(ix.docs.map(function (d) { return d.texto; }).join(' ').slice(0, 20000))) sug.push('Qual é o objeto?', 'Quais documentos de habilitação são exigidos?', 'Qual o prazo de entrega?');
    t.slice(0, 4).forEach(function (x) { sug.push('O que diz sobre ' + x + '?'); });
    return sug.slice(0, 6);
  }

  return { normalizar: normalizar, tokens: tokens, frases: frases, dividir: dividir, indexar: indexar, buscar: buscar, responder: responder, palavrasChave: palavrasChave, resumo: resumo,
    datasEm: datasEm, linhaDoTempo: linhaDoTempo, faq: faq, quiz: quiz, analisarEdital: analisarEdital, perguntasSugeridas: perguntasSugeridas, CAMPOS_EDITAL: CAMPOS_EDITAL };
});
