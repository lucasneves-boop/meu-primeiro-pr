/* Execução do contrato: empenhos, notas fiscais e pagamentos ligados entre si.
   A NF aponta para o empenho (empenhoId) e o pagamento aponta para a NF (notaId).
   Puro, testável no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Execucao = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  let seq = 0;
  function novoId(p) { seq++; return p + Date.now().toString(36) + seq.toString(36) + Math.random().toString(36).slice(2, 5); }
  function cent(v) { return Math.round((Number(v) || 0) * 100) / 100; }

  // Garante ids e converte o formato antigo (pagamento.ref = número da NF).
  function normalizar(x) {
    x = x || {};
    x.empenhos = (x.empenhos || []).map(function (i) { const o = Object.assign({}, i); if (!o.id) o.id = novoId('em'); return o; });
    x.notas = (x.notas || []).map(function (n) { const o = Object.assign({}, n); if (!o.id) o.id = novoId('nf'); return o; });
    x.pagamentos = (x.pagamentos || []).map(function (p) { const o = Object.assign({}, p); if (!o.id) o.id = novoId('pg'); return o; });
    x.notas.forEach(function (n) { if (!n.empenhoId && n.empenho) { const e = x.empenhos.find(function (m) { return String(m.numero) === String(n.empenho); }); if (e) n.empenhoId = e.id; } });
    x.pagamentos.forEach(function (p) { if (!p.notaId && p.ref) { const n = x.notas.find(function (m) { return String(m.numero) === String(p.ref); }); if (n) p.notaId = n.id; } });
    return x;
  }

  function pagoDaNota(x, nota) { return cent((x.pagamentos || []).filter(function (p) { return p.notaId === nota.id; }).reduce(function (s, p) { return s + (Number(p.valor) || 0); }, 0)); }
  function notasDoEmpenho(x, emp) { return (x.notas || []).filter(function (n) { return n.empenhoId === emp.id; }); }

  // hojeISO: 'AAAA-MM-DD'
  function resumo(x, hojeISO) {
    x = x || {}; const agora = new Date(); const hoje = hojeISO || agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-' + String(agora.getDate()).padStart(2, '0');
    const soma = function (l) { return cent((l || []).reduce(function (s, i) { return s + (Number(i.valor) || 0); }, 0)); };
    const empenhos = (x.empenhos || []).map(function (e) {
      const ns = notasDoEmpenho(x, e); const faturado = soma(ns);
      return { id: e.id, numero: e.numero, valor: cent(e.valor), notas: ns.map(function (n) { return n.numero; }), faturado: faturado, saldo: cent((Number(e.valor) || 0) - faturado), excedido: faturado - (Number(e.valor) || 0) > 0.009 };
    });
    const notas = (x.notas || []).map(function (n) {
      const pago = pagoDaNota(x, n); const aberto = cent((Number(n.valor) || 0) - pago);
      const emp = (x.empenhos || []).find(function (e) { return e.id === n.empenhoId; });
      const status = aberto <= 0.009 ? 'paga' : n.vencimento && n.vencimento < hoje ? 'atrasada' : pago > 0 ? 'parcial' : 'aberta';
      return { id: n.id, numero: n.numero, valor: cent(n.valor), pago: pago, aberto: Math.max(0, aberto), empenho: emp ? emp.numero : '', semEmpenho: !emp, vencimento: n.vencimento || '', status: status };
    });
    const pagamentos = (x.pagamentos || []).map(function (p) { const n = (x.notas || []).find(function (m) { return m.id === p.notaId; }); return { id: p.id, data: p.data, valor: cent(p.valor), nota: n ? n.numero : '', semNota: !n }; });
    const empenhado = soma(x.empenhos), faturado = soma(x.notas), recebido = soma(x.pagamentos);
    const alertas = [];
    empenhos.filter(function (e) { return e.excedido; }).forEach(function (e) { alertas.push('NF acima do saldo do empenho ' + (e.numero || '(sem número)')); });
    notas.filter(function (n) { return n.semEmpenho; }).forEach(function (n) { alertas.push('NF ' + (n.numero || '(sem número)') + ' sem empenho vinculado'); });
    notas.filter(function (n) { return n.status === 'atrasada'; }).forEach(function (n) { alertas.push('NF ' + (n.numero || '') + ' com pagamento em atraso'); });
    pagamentos.filter(function (p) { return p.semNota; }).forEach(function () { alertas.push('Pagamento sem NF vinculada'); });
    notas.forEach(function (n) { if (n.pago - n.valor > 0.009) alertas.push('NF ' + n.numero + ' recebeu mais do que o valor da nota'); });
    if (x.valor && empenhado - Number(x.valor) > 0.009) alertas.push('Empenhos acima do valor do contrato');
    return { empenhado: empenhado, faturado: faturado, recebido: recebido, aReceber: cent(faturado - recebido), aFaturar: cent(empenhado - faturado), saldoContrato: cent((Number(x.valor) || 0) - empenhado), empenhos: empenhos, notas: notas, pagamentos: pagamentos, alertas: alertas };
  }

  // Vencimento = atesto + prazo (dias), quando a NF não tiver vencimento próprio.
  function vencimentoPadrao(atesto, prazoDias) {
    if (!atesto) return ''; const d = new Date(atesto + 'T12:00:00'); d.setDate(d.getDate() + (Number(prazoDias) || 30)); return d.toISOString().slice(0, 10);
  }

  return { normalizar: normalizar, resumo: resumo, pagoDaNota: pagoDaNota, notasDoEmpenho: notasDoEmpenho, vencimentoPadrao: vencimentoPadrao, novoId: novoId };
});
