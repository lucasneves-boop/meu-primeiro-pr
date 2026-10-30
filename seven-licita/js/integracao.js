/* Integração entre as ferramentas: o que é lançado numa aparece nas outras, sem digitar de novo.
   Regras puras sobre o estado (Dados.e), idempotentes: podem rodar a cada gravação sem duplicar nada.
   - Seven Proposta ↔ Seven Disputar: itens e preços da proposta seguem para a disputa.
   - Resultado (ganha/perdida) vale para proposta, disputa, Seven Acompanhar e cartão do Seven Processo.
   - Seven NFe → Execução do cartão (NF e empenho) → Seven Financeiro (contas a receber), e pagamentos nos dois sentidos.
   - Prazos de todas as ferramentas aparecem na Seven Agenda.
   - Contatos: lançamentos ganham o nome do cliente/órgão; clientes herdam e-mail e telefone do Seven CRM. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Integracao = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function cent(v) { return Math.round((Number(v) || 0) * 100) / 100; }
  function dig(t) { return String(t || '').replace(/\D/g, ''); }
  function lista(x) { return Array.isArray(x) ? x : []; }
  function cartoes(e) { const out = []; lista(e.quadros).forEach(function (q) { lista(q.cartoes).forEach(function (c) { out.push({ q: q, c: c }); }); }); return out; }
  function proposta(e, id) { return lista(e.propostas).find(function (p) { return p.id === id; }); }
  function totalProposta(p) { return cent(lista(p.itens).filter(function (i) { return i.participar !== false; }).reduce(function (s, i) { return s + (Number(i.quantidade) || 0) * (Number(i.unitario) || 0); }, 0)); }
  function totalVencido(p) { const v = lista(p.itens).filter(function (i) { return i.vencido; }); return v.length ? cent(v.reduce(function (s, i) { return s + (Number(i.quantidade) || 0) * (Number(i.unitario) || 0); }, 0)) : totalProposta(p); }
  function mesmoItem(a, b) { return String(a.numero) === String(b.numero) && String(a.lote || '') === String(b.lote || ''); }

  // Cartões e acompanhamentos criados a partir do aviso ganham o vínculo com a proposta.
  function ligar(e) {
    let n = 0;
    const porAviso = function (avisoId, empresaId) { return lista(e.propostas).find(function (p) { return p.avisoId && p.avisoId === avisoId && (!empresaId || !p.empresaId || p.empresaId === empresaId); }); };
    cartoes(e).forEach(function (x) { if (!x.c.propostaId && x.c.avisoId) { const p = porAviso(x.c.avisoId, x.c.empresaId); if (p) { x.c.propostaId = p.id; n++; } } });
    lista(e.monitor).forEach(function (m) { if (!m.propostaId && m.avisoId) { const p = porAviso(m.avisoId, m.empresaId) || proposta(e, m.avisoId); if (p) { m.propostaId = p.id; n++; } } });
    return n;
  }
  function cartaoDaProposta(e, p) { return cartoes(e).find(function (x) { return !x.c.arquivado && (x.c.propostaId === p.id || (p.avisoId && x.c.avisoId === p.avisoId && (!x.c.empresaId || x.c.empresaId === p.empresaId))); }); }

  // Seven Proposta → Seven Disputar: descrição, quantidade, preço proposto, custo e referência acompanham a proposta.
  function syncDisputas(e) {
    let n = 0;
    lista(e.disputas).forEach(function (d) {
      const p = proposta(e, d.propostaId); if (!p) return;
      d.itens = lista(d.itens);
      lista(p.itens).filter(function (i) { return i.participar !== false; }).forEach(function (i) {
        let di = d.itens.find(function (x) { return mesmoItem(x, i); });
        if (!di) { di = { numero: i.numero, lote: i.lote || '', limite: null, lanceFechado: null, pausado: false, aprovado: false }; d.itens.push(di); n++; }
        [['descricao', i.descricao], ['quantidade', i.quantidade], ['proposta', i.unitario], ['custo', i.custo], ['referencia', i.refUnitaria]].forEach(function (k) { if (k[1] != null && di[k[0]] !== k[1]) { di[k[0]] = k[1]; n++; } });
      });
      if (p.encerramento && !d.sessaoManual && d.sessao !== p.encerramento) { d.sessao = p.encerramento; n++; }
    });
    return n;
  }

  // Resultado único para proposta, disputa, acompanhamento e cartão. r: 'ganha' | 'perdida' | 'fracassada'.
  function registrarResultado(e, propostaId, r, extra) {
    const p = proposta(e, propostaId); if (!p) return null;
    extra = extra || {};
    p.resultado = r; p.resultadoEm = extra.em || new Date().toISOString();
    p.status = r === 'ganha' ? 'vencida' : 'perdida';
    if (extra.valorFinal != null && extra.valorFinal !== '') p.lanceFinal = Number(extra.valorFinal);
    if (r === 'ganha') { const itens = lista(p.itens).filter(function (i) { return i.participar !== false; }); if (extra.itens) itens.forEach(function (i) { i.vencido = extra.itens.indexOf(String(i.numero)) >= 0; }); else if (!itens.some(function (i) { return i.vencido; })) itens.forEach(function (i) { i.vencido = true; }); }
    lista(e.disputas).forEach(function (d) { if (d.propostaId === p.id) { d.resultado = r; d.situacao = 'Encerrada'; d.ativa = false; } });
    lista(e.monitor).forEach(function (m) { if (m.propostaId === p.id || (p.avisoId && m.avisoId === p.avisoId && m.empresaId === p.empresaId)) m.situacao = r === 'fracassada' ? 'Cancelada/fracassada' : 'Concluída/homologada'; });
    p.pendenteHub = r;
    return p;
  }
  // Descobre resultados marcados por outros caminhos (readequação no Seven Proposta, resultado na disputa, etiqueta no cartão).
  function detectarResultados(e) {
    let n = 0;
    lista(e.propostas).forEach(function (p) {
      if (p.resultado) return;
      if (p.status === 'vencida') { registrarResultado(e, p.id, 'ganha', { em: p.readequadaEm }); n++; return; }
      if (p.status === 'perdida') { registrarResultado(e, p.id, 'perdida'); n++; return; }
      const d = lista(e.disputas).find(function (x) { return x.propostaId === p.id && x.resultado; });
      if (d) { registrarResultado(e, p.id, d.resultado); n++; return; }
    });
    cartoes(e).forEach(function (x) {
      const c = x.c; if (!c.propostaId) return; const p = proposta(e, c.propostaId); if (!p || p.resultado) return;
      const nomes = lista(c.etiquetas).map(function (id) { const et = lista(x.q.etiquetas).find(function (y) { return y.id === id; }); return et ? et.nome : ''; });
      if (nomes.indexOf('Ganha') >= 0) { registrarResultado(e, p.id, 'ganha'); delete p.pendenteHub; c.resultadoAplicado = 'ganha'; n++; }
      else if (nomes.indexOf('Perdida') >= 0) { registrarResultado(e, p.id, 'perdida'); delete p.pendenteHub; c.resultadoAplicado = 'perdida'; n++; }
    });
    return n;
  }

  // Seven NFe → Execução do cartão: a NF autorizada entra na lista de notas, com o empenho informado nela.
  function syncNotas(e) {
    let n = 0;
    lista(e.notas).forEach(function (nf) {
      if (nf.operacao !== 'saida' || !nf.propostaId) return;
      const p = proposta(e, nf.propostaId); if (!p) return;
      const alvo = cartaoDaProposta(e, p); if (!alvo) return;
      if (nf.situacao === 'cancelada') {
        const xc = alvo.c.execucao; const en0 = xc && lista(xc.notas).find(function (z) { return z.nfId === nf.id; });
        if (en0 && !lista(xc.pagamentos).some(function (pg) { return pg.notaId === en0.id; })) { xc.notas.splice(xc.notas.indexOf(en0), 1); n++; }
        return;
      }
      if (nf.situacao !== 'autorizada') return;
      const x = alvo.c.execucao = alvo.c.execucao || { empenhos: [], notas: [], pagamentos: [] };
      x.empenhos = lista(x.empenhos); x.notas = lista(x.notas); x.pagamentos = lista(x.pagamentos);
      let en = x.notas.find(function (z) { return z.nfId === nf.id; });
      let empenhoId = '';
      const numEmp = nf.contrato && String(nf.contrato.empenho || '').trim();
      if (numEmp) {
        let em = x.empenhos.find(function (z) { return String(z.numero).trim() === numEmp; });
        if (!em) { em = { id: 'em-nf-' + nf.id, numero: numEmp, data: String(nf.emissao || '').slice(0, 10), valor: cent(nf.totalNota), obs: 'Criado a partir da NF; confira o valor do empenho.' }; x.empenhos.push(em); n++; }
        empenhoId = em.id;
      } else if (x.empenhos.length === 1) empenhoId = x.empenhos[0].id;
      const dup = lista(nf.duplicatas)[0];
      const dados = { numero: nf.numero ? String(nf.numero) : '', data: String(nf.emissao || '').slice(0, 10), valor: cent(nf.liquido || nf.totalNota), vencimento: dup && dup.vencimento ? dup.vencimento : (en && en.vencimento) || '', empenhoId: empenhoId || (en && en.empenhoId) || '' };
      if (!en) { en = Object.assign({ id: 'nf-' + nf.id, nfId: nf.id, atesto: '' }, dados); x.notas.push(en); n++; }
      else Object.keys(dados).forEach(function (k) { if (dados[k] !== '' && en[k] !== dados[k]) { en[k] = dados[k]; n++; } });
      if (!x.valor && (p.lanceFinal || totalVencido(p))) { x.valor = cent(p.lanceFinal || totalVencido(p)); n++; }
    });
    return n;
  }

  // Execução ↔ Seven Financeiro: pagamento registrado num lado dá baixa no outro.
  function syncPagamentos(e) {
    const f = e.financas; if (!f) return 0; let n = 0;
    const lancs = lista(f.lancamentos);
    cartoes(e).forEach(function (xc) {
      const x = xc.c.execucao; if (!x) return; x.pagamentos = lista(x.pagamentos);
      lista(x.notas).forEach(function (en) {
        if (!en.nfId) return;
        const ls = lancs.filter(function (l) { return l.origem === 'nota:' + en.nfId; }).sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
        if (!ls.length) return;
        // Baixa no Seven Financeiro → pagamento na Execução.
        ls.forEach(function (l) {
          const ligado = x.pagamentos.find(function (pg) { return pg.lancId === l.id; });
          if (l.pago && !ligado) { const pg = { id: 'pg-' + l.id, data: l.data, valor: cent(l.valor), notaId: en.id, lancId: l.id, obs: 'Baixa no Seven Financeiro' }; x.pagamentos.push(pg); l.pagamentoId = pg.id; n++; }
          else if (!l.pago && ligado && ligado.id === 'pg-' + l.id) { x.pagamentos.splice(x.pagamentos.indexOf(ligado), 1); delete l.pagamentoId; n++; }
        });
        // Pagamento lançado na Execução → baixa no Seven Financeiro.
        x.pagamentos.filter(function (pg) { return pg.notaId === en.id && !pg.lancId; }).forEach(function (pg) {
          const abertos = ls.filter(function (l) { return !l.pago; }); if (!abertos.length) return;
          const l = abertos.find(function (z) { return Math.abs(cent(z.valor) - cent(pg.valor)) < 0.01; }) || abertos[0];
          l.pago = true; l.pagamentoId = pg.id; pg.lancId = l.id; n++;
        });
      });
    });
    return n;
  }

  // Nome do cliente/fornecedor nos lançamentos que vieram de outras ferramentas.
  function syncContatos(e) {
    let n = 0; const f = e.financas;
    if (f) lista(f.lancamentos).forEach(function (l) {
      if (l.contato || !l.origem) return; let nome = '';
      if (l.origem.indexOf('nota:') === 0) { const nf = lista(e.notas).find(function (z) { return 'nota:' + z.id === l.origem; }); if (nf) nome = nf.operacao === 'entrada' ? (nf.emitenteExterno || {}).nome : (nf.destinatario || {}).nome; }
      if (l.origem.indexOf('loja:') === 0 && e.loja) { const o = lista(e.loja.pedidos).find(function (z) { return 'loja:' + z.id === l.origem; }); if (o && o.cliente) nome = o.cliente.razao; }
      if (nome) { l.contato = nome; n++; }
    });
    // Cliente ganho no Seven CRM: e-mail, telefone e representante vão para o cadastro do cliente.
    const contas = lista(e.comercial && e.comercial.contas);
    lista(e.empresas).forEach(function (emp) {
      const c = contas.find(function (z) { return dig(z.cnpj) && dig(z.cnpj) === dig(emp.cnpj); }); if (!c) return;
      const pr = lista(c.contatos)[0] || {};
      [['email', pr.email], ['telefone', pr.telefone || pr.whatsapp], ['representante', pr.nome]].forEach(function (k) { if (k[1] && !emp[k[0]]) { emp[k[0]] = k[1]; n++; } });
      if (!emp.contaId) { emp.contaId = c.id; n++; }
    });
    return n;
  }

  function sincronizar(e) {
    let n = 0;
    try { n += ligar(e); n += syncDisputas(e); n += detectarResultados(e); n += syncNotas(e); n += syncPagamentos(e); n += syncContatos(e); }
    catch (err) { if (typeof console !== 'undefined') console.warn('Integração:', err); }
    return n;
  }

  // Prazos de todas as ferramentas para a Seven Agenda (somente leitura, com link para a origem).
  // Fonte única dos compromissos de licitação (Seven Agenda, janela da Agenda e Seven Relatórios).
  // o: { empresaId } filtra pelos compromissos daquele cliente.
  function eventosAgenda(e, de, ate, o) {
    o = o || {}; const out = []; let emp = null;
    const dentro = function (d) { d = String(d || '').slice(0, 10); return d && d >= de && d <= ate; };
    const hora = function (d) { d = String(d || ''); return d.length > 10 && d.slice(11, 16) !== '00:00' ? d.slice(11, 16) : null; };
    const add = function (d, titulo, tipo, link) { if (dentro(d) && (!o.empresaId || emp === o.empresaId)) out.push({ data: String(d).slice(0, 10), hora: hora(d), titulo: titulo, tipo: tipo, link: link, empresaId: emp }); };
    const de_ = function (x) { emp = (x && x.empresaId) || null; return x; };
    lista(e.propostas).forEach(function (p) { de_(p); const cart = cartaoDaProposta(e, p); if (cart && cart.c.prazo && String(cart.c.prazo).slice(0, 10) === String(p.encerramento).slice(0, 10)) return; if (!p.resultado && p.encerramento) add(p.encerramento, 'Sessão ' + (p.numero || '') + ' · ' + (p.orgao || ''), 'sessao', '#/cadastrar/proposta/' + p.id); });
    lista(e.disputas).forEach(function (d) { de_(d); const p = proposta(e, d.propostaId); if (!d.resultado && d.sessao && (!p || p.encerramento !== d.sessao)) add(d.sessao, 'Disputa ' + d.titulo, 'sessao', '#/disputar/disputa/' + d.id); });
    lista(e.monitor).forEach(function (m) { de_(m); lista(m.prazos).forEach(function (pz) { if (!pz.feito && pz.ate) add(pz.ate, (pz.tipo || 'Prazo') + ' · ' + m.titulo, 'prazo', '#/monitorar/licitacao/' + m.id); }); });
    lista(e.contratos).forEach(function (c) { de_(c); if (c.situacao === 'enviado' && c.prazo) add(c.prazo, 'Assinaturas: ' + c.titulo, 'contrato', '#/contratos/ver/' + c.id); });
    lista(e.documentos).forEach(function (d) { de_(d); if (d.validade) add(d.validade, 'Vence: ' + d.nome, 'documento', '#/habilitacao'); });
    // cotações (prazo de resposta e sessão) e prazos dos cartões do Seven Processo
    lista(e.cotacoes).forEach(function (c) { de_(c); if (c.status === 'cancelada') return; if (c.prazoResposta && c.status !== 'concluida') add(c.prazoResposta, 'Prazo cotação ' + c.numero, 'cotacao', '#/cotacoes/ver/' + c.id); const s = c.licitacao && c.licitacao.dataSessao; if (s) add(s, 'Sessão ' + (c.licitacao.numero || c.titulo), 'sessao', '#/cotacoes/ver/' + c.id); });
    lista(e.quadros).forEach(function (q) { if (q.arquivado) return; lista(q.cartoes).forEach(function (c) { de_(c); if (!c.prazo || c.concluido || c.arquivado) return; if (/^\d{4}-\d{2}-\d{2}$/.test(c.prazo)) { add(c.prazo, c.titulo || c.nome || 'Cartão', 'quadro', '#/quadros/' + q.id); return; } const dt = new Date(c.prazo); if (isNaN(dt)) return; const p2 = function (n) { return ('0' + n).slice(-2); }; const loc = dt.getFullYear() + '-' + p2(dt.getMonth() + 1) + '-' + p2(dt.getDate()); const hh = p2(dt.getHours()) + ':' + p2(dt.getMinutes()); add(loc + (hh === '00:00' ? '' : 'T' + hh), c.titulo || c.nome || 'Cartão', 'quadro', '#/quadros/' + q.id); }); });
    cartoes(e).forEach(function (xc) {
      de_(xc.c); const x = xc.c.execucao; if (!x || xc.c.arquivado) return;
      lista(x.notas).forEach(function (en) { const pago = lista(x.pagamentos).filter(function (pg) { return pg.notaId === en.id; }).reduce(function (s, pg) { return s + (Number(pg.valor) || 0); }, 0); if (en.vencimento && pago + 0.01 < (Number(en.valor) || 0)) add(en.vencimento, 'Pagamento NF ' + (en.numero || '') + ' · ' + xc.c.titulo, 'pagamento', '#/quadros/' + xc.q.id + '/' + xc.c.id); });
      if (x.vigenciaFim) add(x.vigenciaFim, 'Fim da vigência · ' + xc.c.titulo, 'contrato', '#/quadros/' + xc.q.id + '/' + xc.c.id);
    });
    // Contas do Seven Financeiro (as NFs já ligadas a um contrato aparecem pelo pagamento da Execução, sem repetir).
    const nfNaExecucao = {}; cartoes(e).forEach(function (xc) { lista(xc.c.execucao && xc.c.execucao.notas).forEach(function (en) { if (en.nfId) nfNaExecucao['nota:' + en.nfId] = 1; }); });
    if (e.financas) lista(e.financas.lancamentos).forEach(function (l) { de_(l); if (!l.pago && l.data && !nfNaExecucao[l.origem]) add(l.data, (l.tipo === 'despesa' ? 'Pagar: ' : 'Receber: ') + l.descricao, 'financeiro', '#/financas'); });
    lista(e.comercial && e.comercial.atividades).forEach(function (a) { de_(null); if (!a.feita && a.data) add(a.data, a.titulo, 'comercial', '#/comercial'); });
    return out;
  }

  return { sincronizar: sincronizar, ligar: ligar, syncDisputas: syncDisputas, registrarResultado: registrarResultado, detectarResultados: detectarResultados, syncNotas: syncNotas, syncPagamentos: syncPagamentos, syncContatos: syncContatos, eventosAgenda: eventosAgenda, cartaoDaProposta: cartaoDaProposta, totalProposta: totalProposta, totalVencido: totalVencido };
});
