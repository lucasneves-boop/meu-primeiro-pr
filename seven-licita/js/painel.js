/* Painel personalizável: catálogo de blocos, layout (adicionar, retirar, mover, redimensionar) e agregações por mês.
   Cada bloco aparece no máximo uma vez. Puro, testável no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.PainelCfg = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // tam: 'p' (1 coluna), 'm' (2 colunas), 'g' (linha inteira).
  const CATALOGO = [
    { id: 'kpis', t: 'Indicadores do dia', g: 'Licitações', tam: 'g', d: 'Avisos novos, propostas, disputas, prazos, documentos e pendências.' },
    { id: 'sessoes', t: 'Próximas sessões', g: 'Licitações', tam: 'm', d: 'Sessões de avisos favoritos e prazos de proposta.' },
    { id: 'prazos', t: 'Prazos do pregoeiro', g: 'Licitações', tam: 'm', d: 'Prazos abertos no Seven Watch, do mais urgente.' },
    { id: 'pendencias', t: 'Pendências do Quadro', g: 'Licitações', tam: 'm', d: 'Cartões e checklists atrasados ou vencendo.' },
    { id: 'propostas', t: 'Propostas por situação', g: 'Licitações', tam: 'm', d: 'Rascunho, pronta, enviada, ganha e não vencida.' },
    { id: 'monitor', t: 'Licitações acompanhadas', g: 'Licitações', tam: 'p', d: 'Processos no Seven Watch por situação.' },
    { id: 'quadro', t: 'Funil das licitações', g: 'Licitações', tam: 'm', d: 'Cartões em cada lista do quadro de licitações.' },
    { id: 'documentos', t: 'Documentos de habilitação', g: 'Licitações', tam: 'p', d: 'Válidos, vencendo e vencidos.' },
    { id: 'pncp', t: 'Publicadas hoje no PNCP', g: 'Licitações', tam: 'm', d: 'Licitações do dia por faixa de valor (consulta ao PNCP).' },
    { id: 'cotacoes', t: 'Cotações com fornecedores', g: 'Licitações', tam: 'p', d: 'Cotações por situação.' },
    { id: 'capag', t: 'CAPAG dos municípios', g: 'Licitações', tam: 'p', d: 'Municípios por nota de capacidade de pagamento.' },
    { id: 'com-kpis', t: 'Resultado comercial', g: 'Comercial', tam: 'g', d: 'Pipeline, previsão, taxa de ganho, ticket e clientes no mês.' },
    { id: 'com-funil', t: 'Funil comercial', g: 'Comercial', tam: 'm', d: 'Negócios e valor em cada etapa.' },
    { id: 'com-ganhos', t: 'Clientes ganhos por mês', g: 'Comercial', tam: 'm', d: 'Novos contratos nos últimos 6 meses.' },
    { id: 'com-origem', t: 'Contas por origem', g: 'Comercial', tam: 'p', d: 'De onde vêm os leads.' },
    { id: 'com-atividades', t: 'Atividades comerciais', g: 'Comercial', tam: 'm', d: 'O que fazer hoje e o que está atrasado.' },
    { id: 'fin-fluxo', t: 'Receitas e despesas', g: 'Financeiro', tam: 'm', d: 'Últimos 6 meses (Seven Pay).' },
    { id: 'fin-categorias', t: 'Despesas do mês', g: 'Financeiro', tam: 'p', d: 'Por categoria (Seven Pay).' },
    { id: 'nf-faturamento', t: 'Faturamento (notas fiscais)', g: 'Financeiro', tam: 'm', d: 'Notas de saída autorizadas, últimos 12 meses.' },
    { id: 'loja', t: 'Pedidos da Loja', g: 'Financeiro', tam: 'p', d: 'Pedidos por mês nos últimos 6 meses.' },
    { id: 'agenda', t: 'Agenda da semana', g: 'Gestão', tam: 'm', d: 'Tarefas nos próximos 7 dias e atrasadas.' },
    { id: 'semanas', t: 'Seven 12S', g: 'Gestão', tam: 'm', d: 'Execução semanal do ciclo ativo (linha dos 85%).' },
    { id: 'atalhos', t: 'Atalhos', g: 'Gestão', tam: 'p', d: 'Acesso rápido às telas mais usadas.' }
  ];
  const PADRAO = ['kpis', 'sessoes', 'prazos', 'com-funil', 'fin-fluxo', 'propostas', 'documentos', 'agenda', 'pendencias', 'com-ganhos', 'nf-faturamento', 'atalhos'];
  const TAMANHOS = ['p', 'm', 'g'];
  function bloco(id) { return CATALOGO.find(function (b) { return b.id === id; }); }
  function padrao() { return PADRAO.map(function (id) { return { id: id, tam: bloco(id).tam }; }); }
  // Remove blocos desconhecidos ou repetidos e corrige tamanhos inválidos.
  function normalizar(layout) {
    if (!Array.isArray(layout)) return padrao();
    const vistos = {}; return layout.filter(function (x) { if (!x || !bloco(x.id) || vistos[x.id]) return false; vistos[x.id] = 1; return true; })
      .map(function (x) { return { id: x.id, tam: TAMANHOS.indexOf(x.tam) >= 0 ? x.tam : bloco(x.id).tam }; });
  }
  function adicionar(layout, id, pos) {
    const l = normalizar(layout); if (!bloco(id) || l.some(function (x) { return x.id === id; })) return l;
    const item = { id: id, tam: bloco(id).tam }; if (pos == null || pos >= l.length) l.push(item); else l.splice(Math.max(0, pos), 0, item);
    return l;
  }
  function remover(layout, id) { return normalizar(layout).filter(function (x) { return x.id !== id; }); }
  // Move o bloco para a posição "para" (índice final).
  function mover(layout, id, para) {
    const l = normalizar(layout); const de = l.findIndex(function (x) { return x.id === id; }); if (de < 0) return l;
    const [it] = l.splice(de, 1); l.splice(Math.max(0, Math.min(l.length, para)), 0, it); return l;
  }
  function deslocar(layout, id, delta) { const l = normalizar(layout); const i = l.findIndex(function (x) { return x.id === id; }); return i < 0 ? l : mover(l, id, i + delta); }
  function redimensionar(layout, id, tam) { return normalizar(layout).map(function (x) { return x.id === id && TAMANHOS.indexOf(tam) >= 0 ? { id: x.id, tam: tam } : x; }); }
  function proximoTamanho(t) { return TAMANHOS[(TAMANHOS.indexOf(t) + 1) % TAMANHOS.length]; }
  function disponiveis(layout) { const l = normalizar(layout); return CATALOGO.filter(function (b) { return !l.some(function (x) { return x.id === b.id; }); }); }

  // ---------- agregações ----------
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function mesesAte(hojeISO, n) {
    const [a, m] = String(hojeISO).slice(0, 7).split('-').map(Number); const out = [];
    for (let i = n - 1; i >= 0; i--) { let mm = m - i, aa = a; while (mm < 1) { mm += 12; aa--; } out.push(aa + '-' + String(mm).padStart(2, '0')); }
    return out;
  }
  function rotuloMes(ym) { const [a, m] = ym.split('-'); return MESES[Number(m) - 1] + (m === '01' ? '/' + a.slice(2) : ''); }
  // Soma (ou conta) por mês: data(x) devolve uma data ISO; valor(x) o número (padrão: 1 = contar).
  function porMes(lista, data, valor, hojeISO, n) {
    const ms = mesesAte(hojeISO, n); const soma = {}; ms.forEach(function (k) { soma[k] = 0; });
    (lista || []).forEach(function (x) { const k = String(data(x) || '').slice(0, 7); if (k in soma) soma[k] += valor ? Number(valor(x)) || 0 : 1; });
    return ms.map(function (k) { return { mes: k, r: rotuloMes(k), v: Math.round(soma[k] * 100) / 100 }; });
  }
  // Conta por chave, na ordem dada (as que não estão na ordem vão para o fim).
  function contar(lista, chave, ordem) {
    const c = {}; (lista || []).forEach(function (x) { const k = chave(x); if (k == null || k === '') return; c[k] = (c[k] || 0) + 1; });
    const ks = (ordem || []).filter(function (k) { return c[k]; }).concat(Object.keys(c).filter(function (k) { return !(ordem || []).includes(k); }).sort(function (a, b) { return c[b] - c[a]; }));
    return ks.map(function (k) { return { r: k, v: c[k] }; });
  }
  function proximosDias(hojeISO, n) { const out = []; const d = new Date(String(hojeISO).slice(0, 10) + 'T12:00:00Z'); for (let i = 0; i < n; i++) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); } return out; }

  return { CATALOGO: CATALOGO, PADRAO: PADRAO, bloco: bloco, padrao: padrao, normalizar: normalizar, adicionar: adicionar, remover: remover, mover: mover, deslocar: deslocar,
    redimensionar: redimensionar, proximoTamanho: proximoTamanho, disponiveis: disponiveis, mesesAte: mesesAte, rotuloMes: rotuloMes, porMes: porMes, contar: contar, proximosDias: proximosDias };
});
