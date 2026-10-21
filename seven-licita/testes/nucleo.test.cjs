const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../js/nucleo.js');

test('normalizar tira acento e caixa', () => {
  assert.equal(N.normalizar('Papel A4 — Sulfite, Ação'), 'papel a4 sulfite acao');
});

test('catálogo: o que vendo, qual tipo e o que não vendo', () => {
  const p = { oQueVendo: 'papel sulfite, papel a4', qualTipo: '75g, 75 g', oQueNaoVendo: 'reciclado', ativo: true };
  assert.equal(N.casaProduto('Aquisição de PAPEL A4 75g branco', p), true);
  assert.equal(N.casaProduto('Aquisição de papel A4 reciclado 75g', p), false);
  assert.equal(N.casaProduto('Aquisição de papel A4 90g', p), false);
  assert.equal(N.casaProduto('Aquisição de toner', p), false);
  assert.equal(N.casaProduto('Aquisição de papel A4 75g', { ...p, ativo: false }), false);
});

test('palavra curta casa só como palavra inteira', () => {
  assert.equal(N.casaProduto('kit de pneus', { oQueVendo: 'pc' }), false);
  assert.equal(N.casaProduto('aquisição de pc desktop', { oQueVendo: 'pc' }), true);
});

test('status do documento: vencido, vencendo (7 dias) e válido', () => {
  const hoje = new Date('2026-10-21T10:00:00');
  assert.equal(N.statusDocumento('2026-10-20', hoje).codigo, 'vencido');
  assert.equal(N.statusDocumento('2026-10-21', hoje).codigo, 'vencendo');
  assert.equal(N.statusDocumento('2026-10-28', hoje).codigo, 'vencendo');
  assert.equal(N.statusDocumento('2026-10-29', hoje).codigo, 'valido');
});

test('robô: disputa o 1º lugar sem passar do valor limite', () => {
  const base = { limite: 90, meuLance: 100, casas: 2, reducao: { tipo: 'valor', min: 0.5, max: 0.5 }, sorteio: 0 };
  assert.equal(N.decidirLance({ ...base, lances: [95, 99], estrategia: 'primeiro' }).lance, 94.5);
  assert.equal(N.decidirLance({ ...base, lances: [89, 99], estrategia: 'primeiro' }).lance, null);
  assert.equal(N.decidirLance({ ...base, lances: [89, 99], estrategia: 'limite' }).lance, 90);
  // melhor posição: passa o 99 (fica em 2º) com 98,5
  assert.equal(N.decidirLance({ ...base, lances: [89, 99], estrategia: 'melhor' }).lance, 98.5);
  assert.equal(N.decidirLance({ ...base, meuLance: 94, lances: [95, 99], estrategia: 'melhor' }).lance, null);
});

test('robô: intervalo mínimo do portal prevalece sobre a redução configurada', () => {
  const d = N.decidirLance({ limite: 1, meuLance: 100, lances: [50], reducao: { tipo: 'valor', min: 0.01, max: 0.01 }, intervaloMinimo: { tipo: 'percentual', valor: 1 }, sorteio: 0, estrategia: 'primeiro' });
  assert.equal(d.lance, 49.5);
});

test('robô: nunca envia abaixo do limite por arredondamento', () => {
  const d = N.decidirLance({ limite: 10.005, meuLance: 20, lances: [10.01], casas: 2, reducao: { tipo: 'valor', min: 0.01, max: 0.01 }, sorteio: 0, estrategia: 'limite' });
  assert.ok(d.lance >= 10.005);
});

test('etapa fechada: até 10% do melhor, ou os três melhores', () => {
  const l = [{ valor: 100 }, { valor: 105 }, { valor: 109 }, { valor: 111 }];
  assert.deepEqual(N.convocadosEtapaFechada(l).map(x => x.valor), [100, 105, 109]);
  const l2 = [{ valor: 100 }, { valor: 130 }, { valor: 140 }, { valor: 150 }];
  assert.deepEqual(N.convocadosEtapaFechada(l2).map(x => x.valor), [100, 130, 140]);
});

test('simulação termina e nunca lança abaixo do limite', () => {
  for (const modo of ['aberto', 'aberto-fechado', 'dispensa']) {
    const s = N.criarSimulacao({ referencia: 1000, limite: 850, modo, estrategia: 'melhor', concorrentes: 5, semente: 42, reducao: { tipo: 'percentual', min: 0.1, max: 0.5 }, estrategiasAF: { top3: true } });
    let passos = 0;
    while (!s.encerrada && passos++ < 10000) N.passoSimulacao(s);
    assert.ok(s.encerrada, modo);
    assert.ok(s.meuLance >= 850, modo + ' ' + s.meuLance);
  }
});

test('CSV ida e volta com vírgula decimal', () => {
  const csv = N.paraCSV([['item', 'valor'], ['Papel; A4', 12.5]]);
  assert.deepEqual(N.lerCSV(csv), [['item', 'valor'], ['Papel; A4', '12,5']]);
  assert.equal(N.lerNumeroBR('R$ 1.234,56'), 1234.56);
});

test('ranking e concentração', () => {
  const r = N.ranking([{ f: 'A', v: 60 }, { f: 'B', v: 30 }, { f: 'A', v: 10 }], x => x.f, x => x.v);
  assert.equal(r[0].chave, 'A');
  assert.equal(r[0].total, 70);
  assert.equal(N.concentracao(r, 1), 0.7);
});

test('preço sugerido por custo, impostos e margem', () => {
  assert.equal(N.arredondar(N.precoSugerido(80, 10, 10, 0), 2), 100);
});
