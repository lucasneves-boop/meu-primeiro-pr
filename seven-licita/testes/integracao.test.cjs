const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../js/integracao.js');

function base() {
  return {
    empresas: [{ id: 'emp1', cnpj: '11.222.333/0001-81', razao: 'Cliente' }],
    avisos: { av1: { id: 'av1', orgao: 'Prefeitura' } },
    propostas: [{ id: 'p1', empresaId: 'emp1', avisoId: 'av1', orgao: 'Prefeitura', numero: '90021/2026', encerramento: '2030-11-15T09:00', itens: [{ numero: 1, descricao: 'Caneta', quantidade: 100, unitario: 2, custo: 1.2 }, { numero: 2, descricao: 'Lápis', quantidade: 50, unitario: 1, participar: true }] }],
    disputas: [{ id: 'd1', propostaId: 'p1', sessao: '2030-11-15T09:00', itens: [{ numero: 1, descricao: 'Caneta', quantidade: 100, proposta: 1.9, limite: 1.5 }] }],
    monitor: [{ id: 'm1', avisoId: 'av1', empresaId: 'emp1', titulo: 'PE 90021', situacao: 'Agendada', prazos: [{ id: 'z', tipo: 'Recurso', ate: '2030-11-20', feito: false }] }],
    quadros: [{ id: 'q1', etiquetas: [{ id: 'eg', nome: 'Ganha' }, { id: 'ep', nome: 'Perdida' }], listas: [{ id: 'l1', nome: 'Oportunidade' }], cartoes: [{ id: 'c1', titulo: 'PE 90021', avisoId: 'av1', empresaId: 'emp1', etiquetas: [] }] }],
    notas: [], financas: { lancamentos: [] }, documentos: [{ id: 'd', nome: 'CND Federal', validade: '2030-11-18' }]
  };
}

test('liga cartão e acompanhamento à proposta pelo aviso', () => {
  const e = base(); I.ligar(e);
  assert.equal(e.quadros[0].cartoes[0].propostaId, 'p1'); assert.equal(e.monitor[0].propostaId, 'p1');
  assert.equal(I.cartaoDaProposta(e, e.propostas[0]).c.id, 'c1');
});

test('preço alterado no Seven Bid chega ao Seven Sniper sem perder o valor limite; item novo entra', () => {
  const e = base(); I.syncDisputas(e);
  const it = e.disputas[0].itens; assert.equal(it[0].proposta, 2); assert.equal(it[0].custo, 1.2); assert.equal(it[0].limite, 1.5);
  assert.equal(it.length, 2); assert.equal(it[1].descricao, 'Lápis');
  e.propostas[0].itens[0].unitario = 1.95; I.syncDisputas(e); assert.equal(e.disputas[0].itens[0].proposta, 1.95);
  assert.equal(I.syncDisputas(e), 0, 'idempotente');
});

test('resultado ganha vale para proposta, disputa e Seven Watch, uma vez só', () => {
  const e = base(); I.ligar(e);
  I.registrarResultado(e, 'p1', 'ganha', { valorFinal: 180, itens: ['1'] });
  const p = e.propostas[0];
  assert.equal(p.status, 'vencida'); assert.equal(p.lanceFinal, 180); assert.equal(p.itens[0].vencido, true); assert.equal(p.itens[1].vencido, false);
  assert.equal(e.disputas[0].resultado, 'ganha'); assert.equal(e.monitor[0].situacao, 'Concluída/homologada'); assert.equal(p.pendenteHub, 'ganha');
  assert.equal(I.totalVencido(p), 200);
  delete p.pendenteHub; assert.equal(I.detectarResultados(e), 0, 'não registra de novo');
});

test('resultado marcado em outro lugar (readequação, disputa ou etiqueta do cartão) é detectado', () => {
  let e = base(); e.propostas[0].status = 'vencida'; I.detectarResultados(e); assert.equal(e.propostas[0].resultado, 'ganha'); assert.equal(e.disputas[0].resultado, 'ganha');
  e = base(); e.disputas[0].resultado = 'perdida'; I.detectarResultados(e); assert.equal(e.propostas[0].status, 'perdida');
  e = base(); I.ligar(e); e.quadros[0].cartoes[0].etiquetas = ['eg']; I.detectarResultados(e);
  assert.equal(e.propostas[0].resultado, 'ganha'); assert.equal(e.propostas[0].pendenteHub, undefined, 'cartão já está marcado');
});

test('NF autorizada no Seven NFe entra na Execução com o empenho; cancelada sai', () => {
  const e = base(); I.ligar(e);
  e.notas.push({ id: 'n1', operacao: 'saida', propostaId: 'p1', situacao: 'rascunho', numero: 15, emissao: '2030-12-01', totalNota: 200, duplicatas: [{ vencimento: '2030-12-31', valor: 200 }], contrato: { empenho: '2030NE0007' } });
  I.syncNotas(e); assert.equal(e.quadros[0].cartoes[0].execucao, undefined, 'rascunho não entra');
  e.notas[0].situacao = 'autorizada'; I.syncNotas(e);
  const x = e.quadros[0].cartoes[0].execucao;
  assert.equal(x.notas.length, 1); assert.equal(x.notas[0].numero, '15'); assert.equal(x.notas[0].valor, 200); assert.equal(x.notas[0].vencimento, '2030-12-31');
  assert.equal(x.empenhos[0].numero, '2030NE0007'); assert.equal(x.notas[0].empenhoId, x.empenhos[0].id); assert.equal(x.valor, 250);
  assert.equal(I.syncNotas(e), 0, 'idempotente');
  e.notas[0].situacao = 'cancelada'; I.syncNotas(e); assert.equal(x.notas.length, 0);
});

test('pagamento nos dois sentidos entre Execução e Seven Pay, sem duplicar', () => {
  const e = base(); I.ligar(e);
  e.notas.push({ id: 'n1', operacao: 'saida', propostaId: 'p1', situacao: 'autorizada', numero: 15, emissao: '2030-12-01', totalNota: 200, contrato: {}, destinatario: { nome: 'Prefeitura de Catalão' } });
  I.syncNotas(e);
  e.financas.lancamentos.push({ id: 'l1', tipo: 'receita', valor: 120, data: '2030-12-31', pago: false, origem: 'nota:n1' }, { id: 'l2', tipo: 'receita', valor: 80, data: '2031-01-31', pago: false, origem: 'nota:n1' });
  const x = e.quadros[0].cartoes[0].execucao;
  // baixa no Seven Pay → pagamento na Execução
  e.financas.lancamentos[0].pago = true; I.syncPagamentos(e);
  assert.equal(x.pagamentos.length, 1); assert.equal(x.pagamentos[0].valor, 120); assert.equal(x.pagamentos[0].notaId, 'nf-n1');
  // pagamento lançado na Execução → baixa no Seven Pay
  x.pagamentos.push({ id: 'pgm', data: '2031-01-30', valor: 80, notaId: 'nf-n1' }); I.syncPagamentos(e);
  assert.equal(e.financas.lancamentos[1].pago, true); assert.equal(x.pagamentos[1].lancId, 'l2');
  assert.equal(I.syncPagamentos(e), 0, 'idempotente'); assert.equal(x.pagamentos.length, 2);
  // desfazer a baixa no Seven Pay tira o pagamento que veio de lá
  e.financas.lancamentos[0].pago = false; I.syncPagamentos(e); assert.equal(x.pagamentos.length, 1);
  // contato preenchido a partir da NF
  I.syncContatos(e); assert.equal(e.financas.lancamentos[0].contato, 'Prefeitura de Catalão');
});

test('cliente herda e-mail, telefone e representante do Seven Sales', () => {
  const e = base(); e.comercial = { contas: [{ id: 'ct1', cnpj: '11222333000181', contatos: [{ nome: 'Ana Souza', email: 'ana@cliente.com.br', telefone: '64 99999-0000' }] }] };
  I.syncContatos(e); const emp = e.empresas[0];
  assert.equal(emp.email, 'ana@cliente.com.br'); assert.equal(emp.telefone, '64 99999-0000'); assert.equal(emp.representante, 'Ana Souza'); assert.equal(emp.contaId, 'ct1');
  emp.email = 'outro@x.com'; I.syncContatos(e); assert.equal(emp.email, 'outro@x.com', 'não sobrescreve o que foi digitado');
});

test('prazos de todas as ferramentas na Seven Task, sem repetir o que já está no cartão', () => {
  const e = base(); I.ligar(e);
  e.contratos = [{ id: 'k', titulo: 'Contrato BPO', situacao: 'enviado', prazo: '2030-11-16' }];
  e.comercial = { atividades: [{ titulo: 'Ligar para Ana', data: '2030-11-17', feita: false }] };
  e.financas.lancamentos.push({ id: 'l', tipo: 'despesa', descricao: 'Aluguel', valor: 100, data: '2030-11-19', pago: false });
  const ev = I.eventosAgenda(e, '2030-11-01', '2030-11-30'); const tipos = ev.map(x => x.tipo).sort();
  assert.deepEqual(tipos, ['comercial', 'contrato', 'documento', 'financeiro', 'prazo', 'sessao']);
  assert.equal(ev.find(x => x.tipo === 'sessao').hora, '09:00');
  e.quadros[0].cartoes[0].prazo = '2030-11-15T09:00';
  assert.ok(!I.eventosAgenda(e, '2030-11-01', '2030-11-30').some(x => x.tipo === 'sessao' && /Sessão/.test(x.titulo)), 'sessão já aparece pelo cartão');
});

test('sincronizar roda tudo e não quebra com estado vazio', () => {
  assert.equal(I.sincronizar({}), 0);
  const e = base(); assert.ok(I.sincronizar(e) > 0); assert.equal(I.sincronizar(e), 0, 'segunda passada não muda nada');
});
