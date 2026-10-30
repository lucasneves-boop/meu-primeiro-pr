/* Seven E-Reader: regras puras do leitor (sem DOM), testáveis no Node.
   - limitesPalavra: estende uma seleção até palavras inteiras (o destaque nunca corta "estim|ado").
   - mesclarRetangulos: junta os pedaços de seleção do PDF em um retângulo por linha (destaque limpo, sem manchas sobrepostas).
   - raioX: encontra no texto o que importa num edital: prazos, valores, datas, leis, artigos, e-mails, telefones e CNPJs.
   - estatísticas de leitura (tempo por dia e sequência de dias). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.EReader = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CORES = { amarelo: '#f7d84a', verde: '#8fd694', azul: '#8ec5ff', rosa: '#f6a5c8', laranja: '#ffb36b', roxo: '#c3a6ff' };
  // Significado de cada cor (editável nas preferências): ajuda a "ler" o edital pelas cores.
  const ROTULOS = { amarelo: 'Importante', verde: 'Prazo', azul: 'Exigência / documento', rosa: 'Risco / penalidade', laranja: 'Valor / preço', roxo: 'Dúvida / esclarecer' };

  const LETRA = /[\p{L}\p{N}\-]/u;
  // ini/fim: índices no texto. Expande para não cortar palavras e apara espaços nas pontas.
  function limitesPalavra(texto, ini, fim) {
    texto = String(texto || ''); ini = Math.max(0, Math.min(ini, texto.length)); fim = Math.max(ini, Math.min(fim, texto.length));
    while (ini < fim && /\s/.test(texto[ini])) ini++;
    while (fim > ini && /\s/.test(texto[fim - 1])) fim--;
    if (ini < fim) { while (ini > 0 && LETRA.test(texto[ini - 1]) && LETRA.test(texto[ini])) ini--; while (fim < texto.length && LETRA.test(texto[fim]) && LETRA.test(texto[fim - 1])) fim++; }
    return { ini: ini, fim: fim };
  }

  // rects: [[x, y, largura, altura], ...] em fração da página. Agrupa por linha e devolve um retângulo por linha, com folga.
  function mesclarRetangulos(rects, folga) {
    folga = folga == null ? 0.002 : folga;
    const rs = (rects || []).filter(function (r) { return r && r[2] > 0.0005 && r[3] > 0.0005; }).map(function (r) { return { x: r[0], y: r[1], d: r[0] + r[2], b: r[1] + r[3], h: r[3] }; })
      .sort(function (a, b) { return (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x; });
    const linhas = [];
    rs.forEach(function (r) {
      const meio = r.y + r.h / 2; const l = linhas.find(function (x) { return Math.abs((x.y + x.b) / 2 - meio) < Math.max(x.b - x.y, r.h) * 0.55; });
      if (l) { l.x = Math.min(l.x, r.x); l.d = Math.max(l.d, r.d); l.y = Math.min(l.y, r.y); l.b = Math.max(l.b, r.b); } else linhas.push({ x: r.x, d: r.d, y: r.y, b: r.b });
    });
    return linhas.sort(function (a, b) { return a.y - b.y; }).map(function (l) { return [Math.max(0, l.x - folga), Math.max(0, l.y - folga / 2), Math.min(1, l.d + folga) - Math.max(0, l.x - folga), l.b - l.y + folga]; });
  }

  // ---------- Raio-X do documento ----------
  const GRUPOS = [
    { id: 'prazos', t: 'Prazos', re: /\b\d{1,3}\s*\(?[a-zà-ú\s]{0,20}\)?\s*(?:dias?|horas?|meses|m[eê]s|anos?)(?:\s+(?:[uú]teis|corridos|consecutivos))?/gi },
    { id: 'valores', t: 'Valores', re: /R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\b\d{1,3}(?:,\d{1,2})?\s?%/g },
    { id: 'datas', t: 'Datas e horários', re: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b(?:\s*(?:às|as|-)?\s*\d{1,2}[h:]\d{0,2}(?:min)?)?|\b\d{1,2}\s+de\s+(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}/gi },
    { id: 'leis', t: 'Leis e normas', re: /\b(?:Lei(?:\s+Complementar)?|Decreto(?:-Lei)?|Instru[cç][aã]o\s+Normativa|IN|Portaria|Resolu[cç][aã]o|Ac[oó]rd[aã]o)\s+(?:n[ºo°.]*\s*)?\d[\d.]*(?:\/\d{2,4})?/gi },
    { id: 'artigos', t: 'Artigos citados', re: /\bart(?:igo)?\.?\s*\d+[ºo°]?(?:,\s*(?:§\s*\d+[ºo°]?|inciso\s+[IVXLC]+|[IVXLC]+))*/gi },
    { id: 'contatos', t: 'E-mails, telefones e CNPJs', re: /[\w.+-]+@[\w-]+\.[\w.-]+|\(?\d{2}\)?\s?\d{4,5}-?\d{4}|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g },
    { id: 'alertas', t: 'Palavras de atenção', re: /\b(?:sob pena de|desclassifica[çc][aã]o|inabilita[çc][aã]o|multa|penalidade|impedimento|vedad[oa]s?|obrigat[oó]ri[oa]|exclusiv[oa] para ME\/EPP|garantia de proposta|amostra|visita t[eé]cnica|atestado de capacidade)/gi }
  ];
  function raioX(texto, limite) {
    texto = String(texto || ''); limite = limite || 40;
    return GRUPOS.map(function (g) {
      const cont = {}; const ordem = []; let m; g.re.lastIndex = 0;
      while ((m = g.re.exec(texto))) { const k = m[0].replace(/\s+/g, ' ').trim(); if (k.length < 2) continue; const chave = k.toLowerCase(); if (!cont[chave]) { cont[chave] = { texto: k, n: 0 }; ordem.push(chave); } cont[chave].n++; }
      const itens = ordem.map(function (k) { return cont[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, limite);
      return { id: g.id, t: g.t, itens: itens };
    }).filter(function (g) { return g.itens.length; });
  }

  // ---------- estatísticas de leitura ----------
  function hojeISO(d) { d = d || new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function registrarTempo(stats, minutos, quando) { stats = stats || {}; const k = hojeISO(quando); stats[k] = Math.round(((stats[k] || 0) + Math.max(0, minutos)) * 10) / 10; return stats; }
  function sequencia(stats, hoje) {
    let n = 0; const d = new Date((hoje || hojeISO()) + 'T12:00:00Z');
    if (!(stats && stats[d.toISOString().slice(0, 10)] >= 1)) d.setUTCDate(d.getUTCDate() - 1); // hoje ainda não leu: conta até ontem
    while (stats && stats[d.toISOString().slice(0, 10)] >= 1) { n++; d.setUTCDate(d.getUTCDate() - 1); }
    return n;
  }
  function resumo(stats, hoje) {
    hoje = hoje || hojeISO(); stats = stats || {}; const semana = []; const d = new Date(hoje + 'T12:00:00Z');
    for (let i = 6; i >= 0; i--) { const x = new Date(d); x.setUTCDate(x.getUTCDate() - i); const k = x.toISOString().slice(0, 10); semana.push({ dia: k, min: stats[k] || 0 }); }
    const ano = hoje.slice(0, 4); const totalAno = Object.keys(stats).filter(function (k) { return k.slice(0, 4) === ano; }).reduce(function (s, k) { return s + stats[k]; }, 0);
    return { hoje: stats[hoje] || 0, semana: semana, minSemana: semana.reduce(function (s, x) { return s + x.min; }, 0), sequencia: sequencia(stats, hoje), horasAno: Math.round(totalAno / 6) / 10 };
  }

  return { CORES: CORES, ROTULOS: ROTULOS, limitesPalavra: limitesPalavra, mesclarRetangulos: mesclarRetangulos, GRUPOS: GRUPOS, raioX: raioX, hojeISO: hojeISO, registrarTempo: registrarTempo, sequencia: sequencia, resumo: resumo };
});
