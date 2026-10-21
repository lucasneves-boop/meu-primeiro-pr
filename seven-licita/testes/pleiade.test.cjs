const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/pleiade.js');

test('árvore: definir, apagar limpando vazios, mesclar e eventos do Firebase', () => {
  let a = {}; a = P.definir(a, '/mensagens/geral/m1', { t: 'oi', u: 'u1' }); assert.equal(P.obter(a, 'mensagens/geral/m1/t'), 'oi');
  a = P.definir(a, 'mensagens/geral/m1', null); assert.deepEqual(a, {}, 'remove pais vazios');
  a = P.aplicarEvento(a, 'put', { path: '/', data: { canais: { geral: { nome: 'geral' } } } }); assert.equal(a.canais.geral.nome, 'geral');
  a = P.aplicarEvento(a, 'patch', { path: '/canais/geral', data: { topico: 'Pregões da semana', nome: 'geral-seven' } }); assert.deepEqual(a.canais.geral, { nome: 'geral-seven', topico: 'Pregões da semana' });
  a = P.aplicarEvento(a, 'put', { path: '/canais/geral/topico', data: null }); assert.deepEqual(a.canais.geral, { nome: 'geral-seven' });
  const v = { x: 1 }; a = P.definir(a, 'y', v); v.x = 2; assert.equal(a.y.x, 1, 'cópia, não referência');
  assert.equal(P.dmId(['b', 'a']), 'dm-a-b'); assert.equal(P.slug('Pregões GO 2026!'), 'pregoes-go-2026');
  assert.ok(P.id(1000) < P.id(2000), 'ids em ordem de tempo');
});

const ctx = { eu: 'u1', membros: { u1: { nome: 'Lucas Neves' }, u2: { nome: 'Ana' } }, canais: { c1: { nome: 'pregoes' } } };
test('formatação estilo Slack', () => {
  assert.equal(P.formatar('*negrito* _itálico_ ~riscado~ `código`', ctx), '<b>negrito</b> <i>itálico</i> <s>riscado</s> <code>código</code>');
  assert.equal(P.formatar('```\nif (a*b) {}\n```', ctx), '<pre class="pl-pre">if (a*b) {}</pre>');
  assert.equal(P.formatar('<script>alert(1)</script>', ctx), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.match(P.formatar('veja https://pncp.gov.br/app/editais.', ctx), /<a href="https:\/\/pncp\.gov\.br\/app\/editais" target="_blank" rel="noopener noreferrer">https:\/\/pncp\.gov\.br\/app\/editais<\/a>\./);
  assert.equal(P.formatar('oi <@u2> e <@u1>', ctx), 'oi <span class="pl-men" data-u="u2">@Ana</span> e <span class="pl-men pl-men-eu" data-u="u1">@Lucas Neves</span>');
  assert.match(P.formatar('ver <#c1>', ctx), /<a class="pl-canal-link" href="#\/pleiade\/c\/c1">#pregoes<\/a>/);
  assert.equal(P.formatar('- item 1\n- item 2\nfim', ctx), '<ul><li>item 1</li><li>item 2</li></ul>fim');
  assert.equal(P.formatar('> citado\nresposta', ctx), '<blockquote>citado</blockquote>resposta');
  assert.equal(P.formatar('valeu :joinha: :fogo:', ctx), 'valeu 👍 🔥');
  assert.equal(P.formatar('2*3*4 = 24', ctx), '2*3*4 = 24', 'asterisco no meio de conta não vira negrito');
  assert.match(P.formatar('@canal reunião', ctx), /pl-men-todos/);
});

test('codificar menções e canais ao enviar', () => {
  const m = { u1: { nome: 'Lucas Neves' }, u2: { nome: 'Ana' }, u3: { nome: 'Ana Paula' } };
  assert.equal(P.codificarMencoes('@Ana Paula e @ana, falem com @Lucas Neves.', m), '<@u3> e <@u2>, falem com <@u1>.');
  assert.equal(P.codificarMencoes('email ana@ana.com', m), 'email ana@ana.com');
  assert.equal(P.codificarCanais('postar em #pregoes agora', { c1: { nome: 'pregoes' } }), 'postar em <#c1> agora');
  assert.deepEqual(P.mencoes('<@u1> <@u2> <@u1>'), ['u1', 'u2']); assert.equal(P.mencionaTodos('@aqui pessoal'), true);
  assert.equal(P.textoPuro('<@u2> veja <#c1>', ctx), '@Ana veja #pregoes');
});

const arvore = () => ({
  membros: { u1: { nome: 'Lucas' }, u2: { nome: 'Ana' } },
  canais: { geral: { nome: 'geral' }, priv: { nome: 'diretoria', privado: true, membros: { u2: true } }, 'dm-u1-u2': { nome: 'dm', dm: true, membros: { u1: true, u2: true } } },
  mensagens: {
    geral: { a: { u: 'u2', t: 'Edital do pregão 90021 saiu', em: 100 }, b: { u: 'u2', t: '<@u1> pode conferir a habilitação?', em: 200, reacoes: { '👍': { u1: true } } }, c: { u: 'u1', t: 'Confiro sim', em: 300, pai: 'b' }, d: { u: 'u2', t: 'Obrigada!', em: 400, pai: 'b' }, e: { u: 'u1', t: 'Segue a planilha', em: 500, anexos: [{ nome: 'precos.xlsx' }], reacoes: { '🎉': { u2: 450 } } } },
    priv: { p: { u: 'u2', t: 'segredo do pregão', em: 100 } }
  }
});
test('não lidas, threads, atividade', () => {
  const a = arvore();
  assert.deepEqual(P.naoLidas(a.mensagens.geral, 150, 'u1'), { n: 1, mencoes: 1 }, 'respostas de thread não contam no canal');
  assert.deepEqual(P.naoLidas(a.mensagens.geral, 0, 'u1'), { n: 2, mencoes: 1 });
  assert.deepEqual(P.doCanal(a.mensagens.geral).map(m => m.id), ['a', 'b', 'e']); assert.deepEqual(P.respostas(a.mensagens.geral, 'b').map(m => m.id), ['c', 'd']);
  const th = P.minhasThreads(a, 'u1', {}); assert.equal(th.length, 1); assert.equal(th[0].novas, 1); assert.equal(P.minhasThreads(a, 'u1', { 'geral/b': 400 })[0].novas, 0);
  const at = P.atividade(a, 'u1'); assert.deepEqual(at.map(x => x.tipo + ':' + (x.emoji || x.msg.id)), ['reacao:🎉', 'mencao:b']);
  const g = P.agrupar([{ u: 'u1', em: Date.UTC(2026, 9, 21, 12) }, { u: 'u1', em: Date.UTC(2026, 9, 21, 12, 3) }, { u: 'u2', em: Date.UTC(2026, 9, 21, 12, 4) }, { u: 'u2', em: Date.UTC(2026, 9, 22, 12) }]);
  assert.deepEqual(g.map(m => [m.novoDia, m.continua]), [[true, false], [false, true], [false, false], [true, false]]);
});

test('busca com filtros e respeito a canal privado', () => {
  const a = arvore();
  assert.deepEqual(P.buscar(a, 'pregao', 'u1').map(r => r.msg.t), ['Edital do pregão 90021 saiu'], 'sem acento e sem ver canal privado');
  assert.equal(P.buscar(a, 'pregao', 'u2').length, 2);
  assert.deepEqual(P.buscar(a, 'from:@lucas', 'u1').map(r => r.msg.t), ['Segue a planilha', 'Confiro sim']);
  assert.deepEqual(P.buscar(a, 'has:arquivo in:#geral', 'u1').map(r => r.msg.t), ['Segue a planilha']);
  assert.equal(P.buscar(a, 'precos', 'u1').length, 1, 'acha pelo nome do anexo');
  assert.equal(P.buscar(a, '', 'u1').length, 0);
  assert.deepEqual(P.comando('/tarefa Enviar proposta amanhã'), { nome: 'tarefa', arg: 'Enviar proposta amanhã' }); assert.equal(P.comando('olá'), null);
});
