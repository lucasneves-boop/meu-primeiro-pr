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
