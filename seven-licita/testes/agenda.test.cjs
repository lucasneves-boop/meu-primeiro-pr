const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/agenda.js');
const AG = '2026-10-21T10:00:00'; // quarta-feira

test('adição rápida: data, hora, prioridade, tags e lista', () => {
  const r = A.interpretar('Enviar proposta amanhã às 14h !alta #cliente #pregão ^Seven', AG);
  assert.deepEqual([r.titulo, r.data, r.hora, r.prioridade, r.tags, r.lista], ['Enviar proposta', '2026-10-22', '14:00', 3, ['cliente', 'pregão'], 'Seven']);
  assert.equal(A.interpretar('Ligar pro pregoeiro hoje 9h30', AG).hora, '09:30');
  assert.equal(A.interpretar('Reunião 15:45', AG).data, '2026-10-21');
  assert.equal(A.interpretar('Café depois de amanhã', AG).data, '2026-10-23');
  const s = A.interpretar('Sessão BLL sexta 8h da manhã !!', AG); assert.deepEqual([s.titulo, s.data, s.hora, s.prioridade], ['Sessão BLL', '2026-10-23', '08:00', 2]);
  assert.equal(A.interpretar('Impugnar edital quarta', AG).data, '2026-10-28', 'mesmo dia da semana = semana seguinte');
  assert.equal(A.interpretar('Entregar 05/11', AG).data, '2026-11-05');
  assert.equal(A.interpretar('Renovar certidão 10/01', AG).data, '2027-01-10', 'data passada sem ano vai para o ano seguinte');
  assert.equal(A.interpretar('Pagar boleto dia 15', AG).data, '2026-11-15');
  assert.equal(A.interpretar('Revisar em 3 dias', AG).data, '2026-10-24');
  assert.equal(A.interpretar('Planejar próxima semana', AG).data, '2026-10-26');
  assert.deepEqual([A.interpretar('Reunião às 7 da noite', AG).hora], ['19:00']);
  assert.equal(A.interpretar('Comprar 2 resmas', AG).data, null, 'número solto não vira data');
  assert.equal(A.interpretar('Item 10 do lote 3', AG).titulo, 'Item 10 do lote 3');
});

test('adição rápida: recorrência', () => {
  const a = A.interpretar('Conferir PNCP todo dia útil 8h', AG); assert.deepEqual([a.titulo, a.recorrencia.tipo, a.data, a.hora], ['Conferir PNCP', 'uteis', '2026-10-21', '08:00']);
  const b = A.interpretar('Relatório toda segunda e quinta', AG); assert.deepEqual([b.titulo, b.recorrencia.tipo, b.recorrencia.dias, b.data], ['Relatório', 'semanal', [1, 4], '2026-10-22']);
  const c = A.interpretar('Pagar DAS todo mês dia 20', AG); assert.deepEqual([c.titulo, c.recorrencia.tipo, c.data], ['Pagar DAS', 'mensal', '2026-11-20']);
  const d = A.interpretar('Backup a cada 2 semanas', AG); assert.deepEqual([d.recorrencia.tipo, d.recorrencia.intervalo, d.recorrencia.dias], ['semanal', 2, [3]]);
});

test('próxima ocorrência', () => {
  assert.equal(A.proximaOcorrencia('2026-10-23', { tipo: 'uteis' }), '2026-10-26');
  assert.equal(A.proximaOcorrencia('2026-10-30', { tipo: 'uteis' }, (x) => x !== '2026-11-02'), '2026-11-03', 'pula feriado');
  assert.equal(A.proximaOcorrencia('2026-10-22', { tipo: 'semanal', dias: [1, 4] }), '2026-10-26');
  assert.equal(A.proximaOcorrencia('2026-10-26', { tipo: 'semanal', dias: [1, 4] }), '2026-10-29');
  assert.equal(A.proximaOcorrencia('2026-10-21', { tipo: 'semanal', intervalo: 2, dias: [3] }), '2026-11-04');
  assert.equal(A.proximaOcorrencia('2026-01-31', { tipo: 'mensal' }), '2026-02-28');
  assert.equal(A.proximaOcorrencia('2026-10-21', { tipo: 'diaria', intervalo: 3 }), '2026-10-24');
  assert.equal(A.descreverRecorrencia({ tipo: 'semanal', dias: [1, 4] }), 'Toda semana (seg, qui)');
  assert.deepEqual(A.ocorrencias({ data: '2026-10-21', recorrencia: { tipo: 'semanal', dias: [3] } }, '2026-10-01', '2026-11-11'), ['2026-10-21', '2026-10-28', '2026-11-04', '2026-11-11']);
});

test('concluir tarefa recorrente avança e zera subtarefas', () => {
  const t = { data: '2026-10-21', recorrencia: { tipo: 'diaria' }, subtarefas: [{ feita: true }] };
  assert.equal(A.concluir(t, AG), 'avancou'); assert.equal(t.data, '2026-10-22'); assert.equal(t.feita, undefined); assert.equal(t.subtarefas[0].feita, false); assert.equal(t.historico.length, 1);
  const u = { data: '2026-10-21' }; assert.equal(A.concluir(u, AG), 'feita'); assert.equal(u.feita, true);
  const v = { data: '2026-10-21', recorrencia: { tipo: 'diaria', ate: '2026-10-21' } }; assert.equal(A.concluir(v, AG), 'feita');
});

test('listas inteligentes, grupos e matriz', () => {
  const H = '2026-10-21';
  const ts = [{ id: 1, data: '2026-10-19' }, { id: 2, data: H, hora: '09:00' }, { id: 3, data: '2026-10-22' }, { id: 4, data: '2026-10-27' }, { id: 5, data: '2026-10-30' }, { id: 6 }, { id: 7, data: H, feita: true }, { id: 8, data: H, excluida: true }, { id: 9, lista: 'L1', tags: ['x'] }];
  const ids = (l) => ts.filter(t => A.naLista(t, l, H)).map(t => t.id);
  assert.deepEqual(ids('hoje'), [1, 2]); assert.deepEqual(ids('amanha'), [3]); assert.deepEqual(ids('semana'), [1, 2, 3, 4]);
  assert.deepEqual(ids('inbox'), [1, 2, 3, 4, 5, 6]); assert.deepEqual(ids('L1'), [9]); assert.deepEqual(ids('tag:x'), [9]);
  assert.deepEqual(ids('concluidas'), [7]); assert.deepEqual(ids('lixeira'), [8]);
  assert.deepEqual(A.agrupar(ts.filter(A.ativa), H).map(g => g.chave + ':' + g.tarefas.length), ['atrasadas:1', 'hoje:1', 'amanha:1', 'semana:1', 'depois:1', 'sem:2']);
  assert.equal(A.QUADRANTES[0].p, 3);
});

test('lembretes devidos uma vez só', () => {
  const t = { id: 1, titulo: 'Sessão', data: '2026-10-21', hora: '10:30', lembrete: 15 };
  assert.equal(A.lembretesDevidos([t], '2026-10-21T10:10:00').length, 0);
  const l = A.lembretesDevidos([t], '2026-10-21T10:16:00'); assert.equal(l.length, 1); t.notificado = l[0].chave;
  assert.equal(A.lembretesDevidos([t], '2026-10-21T10:20:00').length, 0);
});

test('hábitos: sequência atual, melhor e taxa', () => {
  const h = { registros: { '2026-10-17': true, '2026-10-18': true, '2026-10-19': true, '2026-10-20': true } };
  assert.equal(A.sequencia(h, '2026-10-21'), 4, 'hoje ainda não marcado não quebra');
  h.registros['2026-10-21'] = true; assert.equal(A.sequencia(h, '2026-10-21'), 5);
  const u = { dias: [1, 2, 3, 4, 5], registros: { '2026-10-16': true, '2026-10-19': true, '2026-10-20': true } };
  assert.equal(A.sequencia(u, '2026-10-21'), 3, 'fim de semana não conta para hábito de dias úteis');
  assert.equal(A.melhorSequencia({ registros: { '2026-10-01': true, '2026-10-02': true, '2026-10-05': true } }), 2);
  assert.equal(A.taxaHabito(u, '2026-10-19', '2026-10-21'), 2 / 3);
});

test('exportar .ics, Google Agenda e importar .ics', () => {
  const t = { id: 'a1', titulo: 'Sessão; pregão 90021', data: '2026-11-05', hora: '09:00', duracao: 60, lembrete: 30, recorrencia: { tipo: 'semanal', dias: [1, 4] }, notas: 'Levar\nproposta' };
  const s = A.ics([t, { id: 'b', titulo: 'Sem data' }], '2026-10-21T10:00:00Z');
  assert.match(s, /SUMMARY:Sessão\\; pregão 90021/); assert.match(s, /DTSTART:20261105T090000/); assert.match(s, /DTEND:20261105T100000/); assert.match(s, /RRULE:FREQ=WEEKLY;BYDAY=MO,TH/); assert.match(s, /TRIGGER:-PT30M/); assert.match(s, /DESCRIPTION:Levar\\nproposta/);
  assert.equal((s.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(A.linkGoogle(t), /dates=20261105T090000\/20261105T100000/);
  const ev = A.lerICS(s); assert.deepEqual([ev[0].titulo, ev[0].data, ev[0].hora, ev[0].recorrencia.dias, ev[0].notas], ['Sessão; pregão 90021', '2026-11-05', '09:00', [1, 4], 'Levar\nproposta']);
  const dia = A.lerICS('BEGIN:VEVENT\nSUMMARY:Feriado\nDTSTART;VALUE=DATE:20261102\nRRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR\nEND:VEVENT'); assert.deepEqual([dia[0].hora, dia[0].recorrencia.tipo], [undefined, 'uteis']);
});

test('estatísticas de foco', () => {
  const s = [{ inicio: '2026-10-21T09:00:00', minutos: 25, completo: true }, { inicio: '2026-10-21T09:30:00', minutos: 5, tipo: 'pausa' }, { inicio: '2026-10-20T09:00:00', minutos: 25, completo: true }, { inicio: '2026-10-21T11:00:00', minutos: 12 }];
  assert.deepEqual(A.estatisticasFoco(s, '2026-10-21'), { pomosHoje: 1, minutosHoje: 37, minutosSemana: 62, total: 62 });
});
