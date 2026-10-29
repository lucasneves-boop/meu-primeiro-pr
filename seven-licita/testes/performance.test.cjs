const test = require('node:test'); const assert = require('node:assert');
const P = require('../js/performance.js');
const perto = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, (msg || '') + ' esperado ' + b + ', veio ' + a);

function estado() {
  const L = ['Oportunidade', 'Análise do edital', 'Proposta', 'Disputa', 'Habilitação / Recurso', 'Contrato', 'Empenho', 'Entrega', 'Pagamento', 'Concluído'];
  const listas = L.map((n, i) => ({ id: 'l' + i, nome: n }));
  const et = [{ id: 'eg', nome: 'Ganha' }, { id: 'ep', nome: 'Perdida' }];
  const c = (id, l, extra) => Object.assign({ id, titulo: id, lista: 'l' + l, etiquetas: [], valores: {}, empresaId: 'A', criadoEm: '2026-10-05T10:00:00Z' }, extra);
  return {
    empresas: [{ id: 'A', razao: 'Alfa' }, { id: 'B', razao: 'Beta' }],
    propostas: [{ id: 'p1', resultado: 'ganha', resultadoEm: '2026-10-20T12:00:00Z' }],
    quadros: [
      { id: 'q1', nome: 'Licitações', listas, etiquetas: et, cartoes: [
        c('opo', 0), c('ana', 1), c('pro', 2), c('dis', 3),
        c('perd', 3, { etiquetas: ['ep'], atualizadoEm: '2026-10-12T10:00:00Z' }),
        c('ganho', 6, { propostaId: 'p1', execucao: { valor: 100000, empenhos: [{ id: 'e1', valor: 100000 }], notas: [{ id: 'n1', numero: '10', data: '2026-10-25', valor: 40000, vencimento: '2026-10-28' }, { id: 'n2', numero: '11', data: '2026-11-02', valor: 20000, vencimento: '2026-12-01' }], pagamentos: [{ id: 'g1', notaId: 'n1', data: '2026-10-30', valor: 40000 }] } }),
        c('ganhoB', 5, { empresaId: 'B', valores: { valor: 50000 }, atividade: [{ em: '2026-09-10T10:00:00Z', texto: 'moveu de "Habilitação / Recurso" para "Contrato"' }] })
      ] },
      { id: 'q2', nome: 'Tarefas', listas: [{ id: 'x', nome: 'A fazer' }], cartoes: [{ id: 'fora', lista: 'x', empresaId: 'A' }] }
    ]
  };
}

test('etapa pelo nome da lista', () => {
  assert.strictEqual(P.etapaDaLista('Análise do edital'), 1); assert.strictEqual(P.etapaDaLista('Habilitação / Recurso'), 4);
  assert.strictEqual(P.etapaDaLista('Contrato'), 5); assert.strictEqual(P.etapaDaLista('Aguardando pagamento'), 6); assert.strictEqual(P.etapaDaLista('A fazer'), null);
});

test('funil real e totais do cliente', () => {
  const r = P.desempenho(estado(), { empresaId: 'A', cfg: { base: 'venda', pct: 5 }, hoje: '2026-11-10' });
  assert.strictEqual(r.cartoes.length, 6, 'ignora quadro que não é de licitação e o outro cliente');
  assert.deepStrictEqual(r.funil, { encontrados: 6, viaveis: 5, propostas: 4, disputas: 3, vencidas: 1, homologadas: 1, contratadas: 1 });
  assert.strictEqual(r.totais.ganhas, 1); assert.strictEqual(r.totais.perdidas, 1); perto(r.totais.taxaSucesso, 50);
  perto(r.totais.valorGanho, 100000); perto(r.totais.faturado, 60000); perto(r.totais.recebido, 40000); perto(r.totais.aReceber, 20000);
  perto(r.totais.comissaoPrevista, 5000); perto(r.totais.comissaoRecebida, 2000); perto(r.totais.comissaoAReceber, 3000);
  assert.strictEqual(r.proximos.length, 1); assert.strictEqual(r.proximos[0].numero, '11');
  assert.strictEqual(r.emDisputa.length, 4);
});

test('relatório do mês', () => {
  const m = P.mes('2026-10'); assert.deepStrictEqual(m, { de: '2026-10-01', ate: '2026-10-31' });
  const r = P.desempenho(estado(), Object.assign({ cfg: { base: 'lucro', pct: 30, margem: 10, retencao: 10 } }, m));
  assert.strictEqual(r.periodo.ganhas.length, 1, 'ganho de setembro fica fora'); assert.strictEqual(r.periodo.perdidas.length, 1);
  assert.strictEqual(r.periodo.novas.length, 7); perto(r.periodo.faturado, 40000); perto(r.periodo.recebido, 40000);
  perto(r.periodo.comissao, 40000 * 0.3 * 0.1 * 0.9, 'comissão sobre o lucro do recebido, com retenção');
  assert.strictEqual(r.porCliente.length, 2); assert.strictEqual(r.porCliente[0].empresaId, 'A');
  assert.strictEqual(P.mes('x'), null);
});

test('faixas e parceiros por cliente na performance', () => {
  const cfg = { A: { base: 'venda', faixas: [{ ate: 50000, pct: 2 }, { ate: '', pct: 4 }], parceiros: [{ nome: 'Ana', pct: 25 }] }, B: { base: 'venda', pct: 10 } };
  const r = P.desempenho(estado(), { cfgDe: id => cfg[id], hoje: '2026-11-10' });
  const g = r.contratos.find(c => c.id === 'ganho'); perto(g.comissao, 100000 * 0.04 * 0.75, 'faixa de 4% e 25% para a parceira');
  perto(g.comissaoRecebida, 40000 * 0.03); perto(r.contratos.find(c => c.id === 'ganhoB').comissao, 5000, 'cliente B: 10% de 50 mil');
});

test('extrato de comissões com fixo mensal e situação pelo Seven Financeiro', () => {
  const e = estado(); const cfg = { A: { base: 'venda', pct: 5, parceiros: [{ nome: 'Ana', pct: 20 }], fixo: 1500, fixoDesde: '2026-09', diaVenc: 10 } };
  const lancs = [{ id: 'L1', origem: 'comissao:fixo:A:2026-09', pago: true }, { id: 'L2', origem: 'comissao:fixo:A:2026-10', pago: false }];
  const x = P.extrato(e, { empresaId: 'A', cfgDe: id => cfg[id], hoje: '2026-11-10', lancamentos: lancs, registros: {} });
  assert.strictEqual(x.itens.length, 4, '1 pagamento + 3 mensalidades (set, out, nov)');
  const pg = x.itens.find(i => i.tipo === 'comissao'); perto(pg.valor, 40000 * 0.05 * 0.8); perto(pg.repasses[0].valor, 400); assert.strictEqual(pg.status, 'a cobrar');
  assert.strictEqual(x.itens.find(i => i.chave === 'fixo:A:2026-09').status, 'recebida'); assert.strictEqual(x.itens.find(i => i.chave === 'fixo:A:2026-10').status, 'cobrada');
  perto(x.gerada, 1600 + 4500); perto(x.recebida, 1500); perto(x.cobrada, 1500); perto(x.aCobrar, 3100); perto(x.repasses, 400);
  assert.deepStrictEqual(P.meses('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02']);
});

test('Seven Relatórios: período anterior, comparação, veredito e evolução', () => {
  assert.deepStrictEqual(P.periodoAnterior('2026-10-01', '2026-10-31'), { de: '2026-09-01', ate: '2026-09-30' });
  assert.deepStrictEqual(P.periodoAnterior('2026-07-01', '2026-09-30'), { de: '2026-04-01', ate: '2026-06-30' }, 'trimestre');
  assert.deepStrictEqual(P.periodoAnterior('2026-01-01', '2026-12-31'), { de: '2025-01-01', ate: '2025-12-31' }, 'ano');
  assert.deepStrictEqual(P.periodoAnterior('2026-10-10', '2026-10-19'), { de: '2026-09-30', ate: '2026-10-09' }, 'personalizado: mesma quantidade de dias');
  const e = estado(); const cfg = () => ({ base: 'venda', pct: 5 });
  const out = P.resumoPeriodo(e, { empresaId: 'A', cfgDe: cfg, de: '2026-10-01', ate: '2026-10-31' });
  assert.strictEqual(out.ganhas, 1); assert.strictEqual(out.perdidas, 1); perto(out.taxa, 50); perto(out.recebido, 40000); perto(out.comissao, 2000);
  const set = P.resumoPeriodo(e, { empresaId: 'A', cfgDe: cfg, de: '2026-09-01', ate: '2026-09-30' });
  const c = P.comparar(out, set); const vg = c.find(x => x.chave === 'valorGanho');
  assert.strictEqual(vg.sentido, 'subiu'); assert.strictEqual(vg.pct, null, 'sem base no anterior não há %');
  assert.strictEqual(P.veredito(c), 'avancando');
  const ev = P.evolucao(e, { empresaId: null, cfgDe: cfg, de: '2026-09-01', ate: '2026-11-30' });
  assert.deepStrictEqual(ev.map(x => x.mes), ['2026-09', '2026-10', '2026-11']); assert.strictEqual(ev[0].ganhas, 1, 'ganho do cliente B em setembro'); assert.strictEqual(ev[1].ganhas, 1);
});

test('Relatórios: trabalho da Seven no período', () => {
  const e = estado();
  e.propostas.push({ id: 'p2', empresaId: 'A', avisoId: 'av2', criadaEm: '2026-10-03T10:00:00Z', enviadaEm: '2026-10-08T10:00:00Z' }, { id: 'p3', empresaId: 'B', criadaEm: '2026-10-03T10:00:00Z' });
  e.disputas = [{ id: 'd1', empresaId: 'A', propostaId: 'p2', sessao: '2026-10-15T09:00:00' }, { id: 'd2', empresaId: 'A', sessao: '2026-12-15T09:00:00' }];
  e.monitor = [{ id: 'm1', empresaId: 'A', avisoId: 'av2', sessao: '2026-10-15T09:00:00', recursos: [{ em: '2026-10-16T10:00:00Z' }] }];
  e.pecas = [{ modelo: 'impugnacao', empresaId: 'A', criadaEm: '2026-10-02T10:00:00Z' }, { modelo: 'recurso', empresaId: 'A', criadaEm: '2026-10-20T10:00:00Z' }, { modelo: 'reequilibrio', empresaId: 'A', criadaEm: '2026-10-21T10:00:00Z' }, { modelo: 'recurso', empresaId: 'A', criadaEm: '2026-09-20T10:00:00Z' }];
  e.documentos = [{ empresaId: 'A', criadoEm: '2026-10-09T10:00:00Z' }];
  const t = P.trabalho(e, { empresaId: 'A', de: '2026-10-01', ate: '2026-10-31', hoje: '2026-11-10', analisados: 12 }).n;
  assert.strictEqual(t.oportunidades, 6); assert.strictEqual(t.analisados, 12); assert.strictEqual(t.propostasCadastradas, 1); assert.strictEqual(t.propostasEnviadas, 1);
  assert.strictEqual(t.sessoes, 1, 'mesma licitação no Pregão e na Sessão conta uma vez; sessão futura não conta');
  assert.strictEqual(t.impugnacoes, 1); assert.strictEqual(t.recursos, 2, 'peça de recurso + intenção registrada'); assert.strictEqual(t.outrasPecas, 1); assert.strictEqual(t.documentos, 1);
});

test('Relatórios: motivos de perda, deságio, concorrentes e distribuição', () => {
  const e = estado(); const q = e.quadros[0];
  q.cartoes.find(c => c.id === 'perd').perda = { motivo: 'preco', vencedor: 'Concorrente X', valorVencedor: 90000, nossoValor: 99000 };
  q.cartoes.find(c => c.id === 'ganho').licitacao = { valorEstimado: 125000, uf: 'go' };
  q.cartoes.find(c => c.id === 'ganho').valores = { orgao: 'Prefeitura de Catalão', portal: 'BLL' };
  const d = P.desempenho(e, { empresaId: 'A', hoje: '2026-11-10' }).cartoes;
  const pe = P.perdas(d, '2026-10-01', '2026-10-31'); assert.strictEqual(pe.lista.length, 1); assert.strictEqual(pe.principal.chave, 'preco'); assert.strictEqual(pe.semMotivo, 0);
  const co = P.concorrencia(d, '2026-10-01', '2026-10-31'); perto(co.desagioMedio, 20); perto(co.distanciaMedia, 10); assert.strictEqual(co.concorrentes[0].nome, 'Concorrente X');
  const di = P.distribuicao(d, '2026-10-01', '2026-10-31'); assert.strictEqual(di.decididas, 2); assert.strictEqual(di.orgao[0].nome, 'Prefeitura de Catalão'); assert.strictEqual(di.uf[0].nome, 'GO'); perto(di.portal[0].taxa, 100);
});

test('Relatórios: metas proporcionais ao período e habilitação', () => {
  const m = P.metas({ valorGanho: 50000, ganhas: 1 }, { de: '2026-10-01', ate: '2026-12-31', valorGanho: 120000, ganhas: 2 });
  assert.strictEqual(m.length, 2); perto(m[0].alvo, 150000); perto(m[0].pct, 80); assert.strictEqual(m[1].alvo, 3); assert.strictEqual(m[0].atingida, false);
  const e = estado();
  e.documentos = [{ empresaId: 'A', nome: 'CRF', validade: '2026-11-05' }, { empresaId: 'A', nome: 'CND', validade: '2026-11-25' }, { empresaId: 'A', nome: 'Balanço', validade: '2027-05-01' }, { empresaId: 'A', nome: 'Contrato social' }];
  const h = P.habilitacao(e, { empresaId: 'A', hoje: '2026-11-10' });
  assert.strictEqual(h.vencidos.length, 1); assert.strictEqual(h.vencendo[0].nome, 'CND'); assert.strictEqual(h.validos, 1); assert.strictEqual(h.semValidade, 1);
});
