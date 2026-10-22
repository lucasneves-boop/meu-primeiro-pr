const test = require('node:test');
const assert = require('node:assert/strict');
const Z = require('../js/doze.js');

test('calendário: ajusta para segunda, 13 semanas e fases', () => {
  const c = Z.calendario('2026-10-21'); // quarta
  assert.equal(c.inicio, '2026-10-26'); assert.ok(c.ajustado);
  assert.equal(c.fim, '2027-01-17'); assert.equal(c.fim13, '2027-01-24');
  assert.equal(c.semanas.length, 13); assert.equal(c.semanas[4].fase, 'Zona de risco: manter o ritmo'); assert.equal(c.semanas[12].fase, 'Recuperar, revisar e comemorar');
  assert.equal(Z.calendario('2026-10-26').ajustado, false);
  assert.equal(Z.semanaAtual('2026-10-26', '2026-10-25'), 0); assert.equal(Z.semanaAtual('2026-10-26', '2026-11-01'), 1); assert.equal(Z.semanaAtual('2026-10-26', '2026-11-02'), 2); assert.equal(Z.semanaAtual('2026-10-26', '2027-03-01'), 14);
  assert.equal(Z.diasRestantes('2026-10-26', '2027-01-10'), 7);
});

const plano = () => ({
  inicio: '2026-10-26', equipe: false, horasDisponiveis: 10,
  visao: { longo: 'Ter a Seven atendendo 50 clientes', porque: 'Liberdade e impacto', tres: '20 clientes, equipe de 6' },
  metas: [{ id: 'm1', texto: 'Novos contratos de BPO', de: 2, para: 6, unidade: 'clientes' }],
  taticas: [
    { id: 't1', meta: 'm1', texto: 'Montar lista com 40 empresas que vendem ao governo em Goiás', quando: { tipo: 'unica', semana: 1 }, horas: 3 },
    { id: 't2', meta: 'm1', texto: 'Enviar 7 propostas por semana', quando: { tipo: 'recorrente', de: 2, ate: 12 }, horas: 4, fundamental: true },
    { id: 't3', meta: 'm1', texto: 'Visitar 2 empresas em Catalão', quando: { tipo: 'recorrente', de: 1, ate: 12 }, horas: 3 },
    { id: 't4', meta: 'm1', texto: 'Publicar estudo de caso no LinkedIn', quando: { tipo: 'unica', semana: 6 }, horas: 2 }
  ],
  tempo: { estrategico: 'Terça 8h–11h', rotina: 'Segunda 7h30' }, compromisso: { parceiro: 'Sócio' },
  execucao: { 1: { t1: true, t3: false }, 2: { t2: true, t3: true } }, pontuadas: { 1: true, 2: true }
});

test('táticas da semana e pontuação honesta', () => {
  const p = plano();
  assert.deepEqual(Z.taticasDaSemana(p, 1).map(t => t.id), ['t1', 't3']);
  assert.deepEqual(Z.taticasDaSemana(p, 6).map(t => t.id), ['t2', 't3', 't4']);
  assert.deepEqual(Z.pontuacao(p, 1), { previstas: 2, feitas: 1, pct: 50 });
  assert.equal(Z.pontuacao(p, 2).pct, 100);
  assert.equal(Z.media(p, 12), 75);
  assert.deepEqual(Z.serie(p).slice(0, 3).map(s => s.pct), [50, 100, null]);
  assert.equal(Z.leitura(85).nivel, 'otimo'); assert.equal(Z.leitura(60).nivel, 'medio'); assert.equal(Z.leitura(59).nivel, 'baixo');
  assert.equal(Z.horasSemana(p, 6), 9); assert.equal(Z.maiorCarga(p), 9);
});

test('diagnóstico execução × plano', () => {
  assert.equal(Z.diagnostico(70, false).t, 'Problema de execução');
  assert.equal(Z.diagnostico(90, false, 4).t, 'Problema de plano');
  assert.equal(Z.diagnostico(90, false, 1).t, 'Aguarde mais semanas');
  assert.equal(Z.diagnostico(90, true).t, 'No caminho');
  assert.match(Z.diagnostico(50, true).t, /sorte/);
});

test('checagem de qualidade do plano', () => {
  const c = Z.checarPlano(plano()); assert.equal(c.ok, c.total, JSON.stringify(c.itens.filter(i => !i.ok)));
  const p = plano(); p.taticas[0].texto = 'Lista de empresas'; p.taticas[2].texto = 'Visitar empresas em Catalão'; p.taticas[1].fundamental = false; p.horasDisponiveis = 5;
  p.metas.push({ id: 'm2', texto: 'a', de: 1, para: 2 }, { id: 'm3', texto: 'b', de: 1, para: 2 }, { id: 'm4', texto: 'c', de: 1, para: 2 });
  const r = Z.checarPlano(p); const falhas = r.itens.filter(i => !i.ok).map(i => i.t);
  ['De 1 a 3 metas', 'Ação fundamental marcada em cada meta', 'Táticas começam com verbo', 'Táticas cabem na semana', 'Cada meta tem táticas', 'Táticas recorrentes com quantidade'].forEach(f => assert.ok(falhas.includes(f), f));
  assert.ok(Z.comecaComVerbo('Enviar 7 propostas')); assert.ok(Z.comecaComVerbo('Ler 10 páginas')); assert.ok(!Z.comecaComVerbo('Propostas enviadas'));
  assert.ok(Z.temQuantidade('Treinar três vezes')); assert.ok(!Z.temQuantidade('Melhorar o marketing'));
});

test('conta de trás para frente, progresso e markdown', () => {
  assert.deepEqual(Z.regressiva({ meta: 30000, ticket: 1500, conversao: 25 }), { vendas: 20, propostas: 80, porSemana: 7 });
  assert.equal(Z.progressoMeta({ de: 2, para: 6 }, 4), 50); assert.equal(Z.progressoMeta({ de: 2, para: 6 }, 9), 100);
  const md = Z.markdown(plano());
  assert.match(md, /^# Meu Ano em 12 Semanas: 26\/10\/2026 a 17\/01\/2027/); assert.match(md, /Enviar 7 propostas por semana ⭐ \| Semanas 2 a 12/); assert.match(md, /Toda semana/);
});
