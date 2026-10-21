/* Regras das videochamadas da Plêiade (estilo Meet): código da sala, quem inicia a negociação WebRTC, presença, grade e tempo. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Chamada = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PRESENCA_MS = 30000;     // sem batimento há 30 s = saiu
  const BATIMENTO_MS = 10000;
  const MAX_PARTICIPANTES = 8;   // malha (cada um conecta com todos)

  // Código no formato do Meet: abc-defg-hij
  function codigo(aleatorio) {
    const r = aleatorio || Math.random; const l = 'abcdefghijkmnopqrstuvwxyz';
    const g = function (n) { let s = ''; for (let i = 0; i < n; i++) s += l[Math.floor(r() * l.length)]; return s; };
    return g(3) + '-' + g(4) + '-' + g(3);
  }
  function codigoValido(c) { return /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(String(c || '').trim().toLowerCase()); }
  // Aceita o código puro ou um link que termine nele.
  function lerCodigo(txt) { const m = String(txt || '').toLowerCase().match(/([a-z]{3}-[a-z]{4}-[a-z]{3})\s*$/); return m ? m[1] : ''; }

  function ativos(sala, agora) {
    const ps = (sala && sala.participantes) || {}; agora = agora || Date.now();
    return Object.keys(ps).filter(function (u) { return agora - (ps[u].visto || 0) < PRESENCA_MS; })
      .sort(function (a, b) { return (ps[a].entrou || 0) - (ps[b].entrou || 0) || (a < b ? -1 : 1); });
  }

  // Quem chegou depois faz a oferta (evita as duas pontas oferecerem ao mesmo tempo).
  function devoOfertar(eu, outro, sala) {
    const ps = (sala && sala.participantes) || {}; const a = (ps[eu] || {}).entrou || 0, b = (ps[outro] || {}).entrou || 0;
    return a !== b ? a > b : eu > outro;
  }

  function cheia(sala, eu, agora) { const at = ativos(sala, agora); return at.indexOf(eu) < 0 && at.length >= MAX_PARTICIPANTES; }

  // Grade estilo Meet: colunas x linhas para n blocos numa área largura x altura (proporção 16:9).
  function grade(n, largura, altura) {
    if (n <= 0) return { colunas: 1, linhas: 1 };
    let melhor = { colunas: 1, linhas: n, lado: 0 };
    for (let c = 1; c <= n; c++) {
      const l = Math.ceil(n / c); const w = largura / c, h = altura / l;
      const lado = Math.min(w, h * 16 / 9);
      if (lado >= melhor.lado - 0.5) melhor = { colunas: c, linhas: l, lado: Math.max(lado, melhor.lado) };
    }
    return { colunas: melhor.colunas, linhas: melhor.linhas };
  }

  function duracao(ms) {
    const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(ss).padStart(2, '0');
  }

  // Sinais pendentes para mim, em ordem de chegada: [{de, id, tipo, dados}]
  function sinaisPara(sala, eu, processados) {
    const caixa = ((sala && sala.sinais) || {})[eu] || {}; const out = [];
    Object.keys(caixa).forEach(function (de) { Object.keys(caixa[de] || {}).forEach(function (id) { if (!(processados || {})[de + '/' + id]) out.push(Object.assign({ de: de, id: id }, caixa[de][id])); }); });
    return out.sort(function (a, b) { return (a.em || 0) - (b.em || 0) || (a.id < b.id ? -1 : 1); });
  }

  // Nível de voz (0..1) a partir das amostras do analisador de áudio (0..255, centro 128).
  function nivel(amostras) {
    if (!amostras || !amostras.length) return 0;
    let s = 0; for (let i = 0; i < amostras.length; i++) { const v = (amostras[i] - 128) / 128; s += v * v; }
    return Math.min(1, Math.sqrt(s / amostras.length) * 4);
  }

  return { PRESENCA_MS: PRESENCA_MS, BATIMENTO_MS: BATIMENTO_MS, MAX_PARTICIPANTES: MAX_PARTICIPANTES, codigo: codigo, codigoValido: codigoValido, lerCodigo: lerCodigo, ativos: ativos, devoOfertar: devoOfertar, cheia: cheia, grade: grade, duracao: duracao, sinaisPara: sinaisPara, nivel: nivel };
});
