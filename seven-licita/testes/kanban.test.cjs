const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../js/kanban.js');

let n = 0; const id = (p) => p + (++n);
function quadro() {
  return {
    listas: [{ id: 'l1', nome: 'A fazer' }, { id: 'l2', nome: 'Fazendo' }, { id: 'l3', nome: 'Feito' }],
    etiquetas: [{ id: 'e1', nome: 'Urgente', cor: 'vermelho' }, { id: 'e2', nome: 'Documentação', cor: 'amarelo' }],
    cartoes: [], automacoes: []
  };
}

test('markdown escapa HTML e formata', () => {
  const h = K.markdown('**negrito** e *itálico* ~~x~~ `<b>` [site](https://a.b)\n- [x] feito\n- [ ] pendente\n> citação\n<script>alert(1)</script>');
  assert.match(h, /<strong>negrito<\/strong>/);
  assert.match(h, /<em>itálico<\/em>/);
  assert.match(h, /<del>x<\/del>/);
  assert.match(h, /<code>&lt;b&gt;<\/code>/);
  assert.match(h, /<a href="https:\/\/a\.b"/);
  assert.match(h, /type="checkbox" disabled checked/);
  assert.match(h, /<blockquote>/);
  assert.doesNotMatch(h, /<script>/);
  assert.doesNotMatch(K.markdown('[x](javascript:alert(1))'), /href="javascript/);
});

test('menções casam pelo primeiro nome', () => {
  assert.deepEqual(K.mencoes('ok @lucas veja', ['Lucas Neves', 'Ana']), ['Lucas Neves']);
});

test('filtros: etiquetas qualquer/todas, sem membro, meus, prazo e atividade', () => {
  const agora = new Date('2026-10-21T12:00:00').getTime();
  const c1 = { titulo: 'Pregão papel', etiquetas: ['e1', 'e2'], membros: ['Lucas'], prazo: '2026-10-21T18:00', atualizadoEm: '2026-10-20T10:00:00Z' };
  const c2 = { titulo: 'Contrato', etiquetas: [], membros: [], prazo: '', atualizadoEm: '2026-08-01T10:00:00Z' };
  const f = Object.assign(K.vazioFiltro(), { etiquetas: ['e1', 'e2'], modoEtiqueta: 'all' });
  assert.equal(K.passaFiltro(c1, f, { agora }), true);
  assert.equal(K.passaFiltro({ ...c1, etiquetas: ['e1'] }, f, { agora }), false);
  assert.equal(K.passaFiltro({ ...c1, etiquetas: ['e1'] }, { ...f, modoEtiqueta: 'any' }, { agora }), true);
  assert.equal(K.passaFiltro(c2, Object.assign(K.vazioFiltro(), { semEtiqueta: true }), { agora }), true);
  assert.equal(K.passaFiltro(c2, Object.assign(K.vazioFiltro(), { semMembro: true }), { agora }), true);
  assert.equal(K.passaFiltro(c2, Object.assign(K.vazioFiltro(), { meus: true }), { agora, eu: 'Lucas' }), false);
  assert.equal(K.passaFiltro(c1, Object.assign(K.vazioFiltro(), { prazo: 'dia' }), { agora }), true);
  assert.equal(K.passaFiltro(c2, Object.assign(K.vazioFiltro(), { prazo: 'sem' }), { agora }), true);
  assert.equal(K.passaFiltro(c2, Object.assign(K.vazioFiltro(), { atividade: 'sem4' }), { agora }), true);
  assert.equal(K.passaFiltro(c1, Object.assign(K.vazioFiltro(), { atividade: '1' }), { agora }), true);
  assert.equal(K.passaFiltro(c1, Object.assign(K.vazioFiltro(), { texto: 'papel pregao' }), { agora }), true);
  assert.equal(K.contaFiltros(f), 2);
});

test('automação: entrar na lista dispara várias ações e encadeia eventos', () => {
  const q = quadro();
  q.automacoes = [
    { id: 'r1', gatilho: { tipo: 'entrar-lista', lista: 'Fazendo' }, acoes: [{ tipo: 'add-etiqueta', valor: 'Urgente' }, { tipo: 'add-membro', valor: 'Lucas' }, { tipo: 'prazo', valor: 2 }] },
    { id: 'r2', gatilho: { tipo: 'etiqueta', etiqueta: 'e1' }, acoes: [{ tipo: 'comentar', valor: 'Prioridade!' }] },
    { id: 'r3', gatilho: { tipo: 'concluir' }, acoes: [{ tipo: 'mover', valor: 'Feito' }] }
  ];
  const c = { id: 'c1', titulo: 'T', lista: 'l2', etiquetas: [], membros: [], comentarios: [] };
  q.cartoes.push(c);
  const agora = new Date('2026-10-21T12:00:00').getTime();
  K.dispararEvento(q, c, { tipo: 'entrar-lista' }, { id, agora });
  assert.deepEqual(c.etiquetas, ['e1']);
  assert.deepEqual(c.membros, ['Lucas']);
  assert.equal(c.prazo, K.dataLocal(agora + 2 * 86400000));
  assert.equal(c.comentarios[0].texto, 'Prioridade!');
  K.aplicarAcoes(q, c, [{ tipo: 'concluir' }], { id, agora });
  assert.equal(c.lista, 'l3');
});

test('automação: regra antiga é migrada e checklist da etapa entra uma vez', () => {
  const q = quadro();
  q.automacoes = [{ id: 'x', quando: 'mover', lista: '*', acao: 'checklist-etapa', ativo: true }];
  const c = { id: 'c', titulo: 'T', lista: 'l1', checklists: [] };
  const ctx = { id, checkEtapa: { 'A fazer': ['a', 'b'] } };
  K.dispararEvento(q, c, { tipo: 'entrar-lista' }, ctx);
  K.dispararEvento(q, c, { tipo: 'entrar-lista' }, ctx);
  assert.equal(c.checklists.length, 1);
  assert.equal(c.checklists[0].itens.length, 2);
});

test('automação não entra em laço infinito', () => {
  const q = quadro();
  q.automacoes = [{ id: 'a', gatilho: { tipo: 'entrar-lista', lista: 'A fazer' }, acoes: [{ tipo: 'mover', valor: 'Fazendo' }] }, { id: 'b', gatilho: { tipo: 'entrar-lista', lista: 'Fazendo' }, acoes: [{ tipo: 'mover', valor: 'A fazer' }] }];
  const c = { id: 'c', titulo: 'T', lista: 'l1' };
  K.dispararEvento(q, c, { tipo: 'entrar-lista' }, { id });
  assert.ok(['l1', 'l2'].includes(c.lista));
});

test('varredura: prazo próximo dispara uma vez; recorrência cria cópias', () => {
  const q = quadro();
  q.automacoes = [{ id: 'p', gatilho: { tipo: 'prazo-proximo', dias: 2 }, acoes: [{ tipo: 'add-etiqueta', valor: 'Urgente' }] }];
  const agora = new Date('2026-10-21T12:00:00').getTime();
  const c = { id: 'c', titulo: 'Certidão FGTS', lista: 'l1', etiquetas: [], prazo: '2026-10-22T12:00', recorrencia: { freq: 'mensal', proxima: '2026-10-01T09:00' } };
  q.cartoes.push(c);
  K.varrer(q, { id, agora });
  K.varrer(q, { id, agora });
  assert.deepEqual(c.etiquetas, ['e1']);
  assert.equal(q.cartoes.length, 2);
  assert.equal(c.recorrencia.proxima.slice(0, 10), '2026-11-01');
  assert.equal(q.cartoes[1].prazo.slice(0, 10), '2026-11-22');
});

test('importa quadro do Trello', () => {
  const j = {
    name: 'Clientes', desc: 'sobre', prefs: { backgroundColor: '#0079bf' },
    members: [{ id: 'm1', fullName: 'Ana Souza' }],
    labels: [{ id: 'lb1', name: 'Urgente', color: 'red' }, { id: 'lb2', name: '', color: 'sky_dark' }],
    lists: [{ id: 'L2', name: 'Feito', pos: 2 }, { id: 'L1', name: 'A fazer', pos: 1 }],
    customFields: [{ id: 'cf1', name: 'Valor', type: 'number' }, { id: 'cf2', name: 'Portal', type: 'list', options: [{ id: 'o1', value: { text: 'BLL' } }] }],
    cards: [{ id: 'k1', idShort: 7, name: 'Cartão', desc: 'd', idList: 'L1', idLabels: ['lb1'], idMembers: ['m1'], due: '2026-10-30T15:00:00.000Z', dueComplete: false, closed: false, pos: 1, cover: { color: 'green', size: 'full' }, attachments: [{ name: 'Edital', url: 'https://x.y/e.pdf' }], customFieldItems: [{ idCustomField: 'cf1', value: { number: '1500.5' } }, { idCustomField: 'cf2', idValue: 'o1' }] }],
    checklists: [{ id: 'ch', idCard: 'k1', name: 'Docs', checkItems: [{ name: 'CND', state: 'complete', pos: 1 }, { name: 'FGTS', state: 'incomplete', pos: 2, idMember: 'm1' }] }],
    actions: [{ type: 'commentCard', date: '2026-10-01T10:00:00Z', data: { text: 'oi', card: { id: 'k1' } }, memberCreator: { fullName: 'Ana Souza' } }]
  };
  const r = K.importarTrello(j, { id });
  assert.deepEqual(r.listas.map(l => l.nome), ['A fazer', 'Feito']);
  const c = r.cartoes[0];
  assert.equal(c.num, 7);
  assert.equal(c.lista, r.listas[0].id);
  assert.deepEqual(c.membros, ['Ana Souza']);
  assert.equal(r.etiquetas[0].cor, 'vermelho');
  assert.equal(r.etiquetas[1].cor, 'ciano');
  assert.equal(c.capa, 'verde'); assert.equal(c.capaTamanho, 'cheia');
  assert.equal(c.checklists[0].itens[1].membro, 'Ana Souza');
  assert.equal(c.checklists[0].itens[0].feito, true);
  assert.equal(c.comentarios[0].por, 'Ana Souza');
  assert.equal(c.anexos[0].link, 'https://x.y/e.pdf');
  assert.equal(c.valores[r.campos[0].id], 1500.5);
  assert.equal(c.valores[r.campos[1].id], 'BLL');
  assert.equal(r.fundo, '#0079bf');
  assert.throws(() => K.importarTrello({}), /Trello/);
});

test('copiar cartão zera comentários e checklists marcados', () => {
  const c = { id: 'a', titulo: 'x', comentarios: [{ texto: 'c' }], checklists: [{ id: 'k', titulo: 't', itens: [{ id: 'i', texto: 'a', feito: true }] }], anexos: [{ id: 'f' }], num: 3 };
  const n = K.copiarCartao(c, { id });
  assert.notEqual(n.id, 'a'); assert.equal(n.comentarios.length, 0); assert.equal(n.checklists[0].itens[0].feito, false); assert.equal(n.anexos.length, 0); assert.equal(n.num, null);
});
