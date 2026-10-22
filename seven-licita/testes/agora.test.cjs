const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/agora.js');
const H = 36e5, T0 = Date.UTC(2026, 9, 21, 12);

test('comprimento conta link como 23 e extrai tags/menções', () => {
  assert.equal(A.comprimento('ver https://www.gov.br/compras/pt-br/acesso-a-informacao/legislacao'), 4 + 23);
  const x = A.extrair('Dúvida sobre #Lei14133 e #pregão com @ana_licita e @Ana_Licita. email@x.com #a');
  assert.deepEqual(x.tags, ['lei14133', 'pregao']); assert.deepEqual(x.mencoes, ['ana_licita']);
});

test('formatar escapa HTML e linka tags, menções conhecidas e URLs', () => {
  const h = A.formatar('<b>oi</b> #SICAF @ana @fantasma https://pncp.gov.br/app/editais?x=1\nlinha', { ana: 'u1' });
  assert.match(h, /&lt;b&gt;oi&lt;\/b&gt;/);
  assert.match(h, /<a class="go-tag" href="#\/agora\/tag\/sicaf">#SICAF<\/a>/);
  assert.match(h, /<a class="go-men" href="#\/agora\/u\/ana">@ana<\/a>/);
  assert.match(h, / @fantasma /);
  assert.match(h, /href="https:\/\/pncp\.gov\.br\/app\/editais\?x=1" target="_blank" rel="noopener noreferrer nofollow">pncp\.gov\.br\/app\/editais\?x=1<\/a><br>linha/);
  assert.doesNotMatch(A.formatar('"><img src=x onerror=alert(1)>'), /<img/);
  assert.doesNotMatch(A.formatar('javascript:alert(1)'), /href/);
});

test('handle único', () => {
  assert.equal(A.handle('Lucas Neves'), 'lucasneves');
  assert.equal(A.handleLivre('Lucas Neves', { a: { handle: 'lucasneves' }, b: { handle: 'lucasneves2' } }), 'lucasneves3');
});

const posts = {
  p1: { u: 'ana', t: 'Edital com exigência de atestado de 100%. #impugnacao', em: T0 - 5 * H, curtidas: { bia: T0 - 4 * H, caio: T0 - 4 * H }, reposts: { bia: T0 - 3 * H } },
  p2: { u: 'bia', t: 'Bom dia', em: T0 - 1 * H },
  p3: { u: 'caio', t: 'Concordo, cabe impugnação.', em: T0 - 4 * H, resp: 'p1' },
  p4: { u: 'caio', t: 'Olha isso @ana', em: T0 - 2 * H, cit: 'p1' },
  p5: { u: 'dani', t: 'post apagado', em: T0, apagado: true }
};

test('feed Seguindo: cronológico com reposts de quem sigo, sem respostas nem apagados', () => {
  const f = A.feed(posts, { modo: 'seguindo', eu: 'eu', seguindo: { bia: 1, caio: 1 }, agora: T0 });
  assert.deepEqual(f.map(x => x.post.id + (x.por ? '<' + x.por : '')), ['p2', 'p4', 'p1<bia']);
});

test('feed Para você: engajamento pesa, sem duplicar, oculta silenciados', () => {
  const f = A.feed(posts, { modo: 'paravoce', eu: 'eu', agora: T0 });
  assert.equal(f[0].post.id, 'p1'); assert.equal(new Set(f.map(x => x.post.id)).size, f.length);
  assert.ok(!f.some(x => x.post.id === 'p3' || x.post.id === 'p5'));
  assert.ok(!A.feed(posts, { eu: 'eu', agora: T0, ocultos: { ana: 1 } }).some(x => x.post.u === 'ana'));
  const c = A.contagens(posts, Object.assign({ id: 'p1' }, posts.p1)); assert.deepEqual(c, { respostas: 1, reposts: 2, curtidas: 2 });
});

test('perfil: posts, respostas, curtidas, fixado primeiro', () => {
  const ps = Object.assign({}, posts, { p6: { u: 'caio', t: 'fixado', em: T0 - 10 * H, fixado: true } });
  assert.deepEqual(A.doPerfil(ps, 'caio').map(x => x.post.id), ['p6', 'p4']);
  assert.deepEqual(A.doPerfil(ps, 'caio', 'respostas').map(x => x.post.id), ['p3']);
  assert.deepEqual(A.doPerfil(ps, 'bia', 'curtidas').map(x => x.post.id), ['p1']);
  assert.deepEqual(A.doPerfil(ps, 'bia').map(x => x.post.id + (x.por ? '<' : '')), ['p2', 'p1<']);
});

test('tendências contam autores distintos nas últimas 24h', () => {
  const ps = { a: { u: '1', t: '#SRP x', em: T0 - H }, b: { u: '2', t: '#srp y', em: T0 - H }, c: { u: '1', t: '#dispensa #dispensa', em: T0 - H }, d: { u: '3', t: '#velho', em: T0 - 30 * H } };
  const t = A.tendencias(ps, { agora: T0 });
  assert.deepEqual(t.map(x => x.tag), ['srp', 'dispensa']); assert.equal(t[0].autores, 2);
});

test('busca de posts, perfis e hashtag', () => {
  const perfis = { ana: { nome: 'Ana Souza', handle: 'ana', cargo: 'Pregoeira' } };
  assert.deepEqual(A.buscar(posts, perfis, 'impugnação').posts.map(p => p.id), ['p3', 'p1']);
  assert.deepEqual(A.buscar(posts, perfis, 'cabe impugnação').posts.map(p => p.id), ['p3']);
  assert.deepEqual(A.buscar(posts, perfis, '#impugnacao').posts.map(p => p.id), ['p1']);
  assert.deepEqual(A.buscar(posts, perfis, 'pregoeira').perfis.map(p => p.id), ['ana']);
});

test('quem seguir prioriza amigos de amigos', () => {
  const perfis = { eu: {}, a: {}, b: {}, c: {} };
  assert.deepEqual(A.quemSeguir(perfis, { eu: { a: 1 }, a: { c: 1 } }, 'eu', {}, 2), ['c', 'b']);
  assert.deepEqual(A.seguidoresDe({ eu: { a: 1 }, b: { a: 1 } }, 'a'), ['eu', 'b']);
});

test('notificações de curtida, repost, resposta, citação, menção e seguidor', () => {
  const tipos = A.notificacoes({ posts, seguir: { caio: { ana: T0 } } }, 'ana', 'ana').map(n => n.tipo).sort();
  assert.deepEqual(tipos, ['citacao', 'curtida', 'curtida', 'mencao', 'repost', 'resposta', 'seguiu']);
});

test('enquete e edição', () => {
  const p = { u: 'ana', em: T0, enquete: { opcoes: ['Sim', 'Não'], votos: { a: 0, b: 0, c: 1 }, fim: T0 + H } };
  const e = A.enquete(p, 'c', T0);
  assert.deepEqual(e.opcoes.map(o => o.pct), [67, 33]); assert.equal(e.meuVoto, 1); assert.equal(e.encerrada, false);
  assert.equal(A.enquete(p, 'c', T0 + 2 * H).encerrada, true);
  assert.equal(A.podeEditar(p, 'ana', T0 + 59 * 60e3), true); assert.equal(A.podeEditar(p, 'ana', T0 + 61 * 60e3), false); assert.equal(A.podeEditar(p, 'bia', T0), false);
  assert.equal(A.tempoRelativo(T0 - 90e3, T0), '1min'); assert.equal(A.tempoRelativo(T0 - 3 * H, T0), '3h');
});
