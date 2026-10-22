const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/sevenai.js');

test('requisição: Opus 5.5 padrão, streaming longo, cache, esforço explícito, fallback "default"', () => {
  const r = A.montarRequisicao([A.mensagemUsuario('Oi')], { modelo: 'claude-opus-5-5' });
  assert.equal(r.model, 'claude-opus-5-5'); assert.equal(r.max_tokens, 64000);
  assert.deepEqual(r.cache_control, { type: 'ephemeral' }); assert.deepEqual(r.output_config, { effort: 'medium' });
  assert.equal(r.thinking, undefined); assert.equal(r.tools, undefined);
  assert.equal(r.fallbacks, 'default'); assert.deepEqual(r.betas, ['server-side-fallback-2026-07-01']);
  assert.deepEqual(r.messages, [{ role: 'user', content: [{ type: 'text', text: 'Oi' }] }]);
  assert.match(r.system, /Seven/); assert.match(r.system, /nunca invente link/);
});

test('requisição: raciocínio resumido, pesquisa na web só onde a versão foi confirmada, Haiku sem fallback', () => {
  const r = A.montarRequisicao([A.mensagemUsuario('x')], { modelo: 'claude-sonnet-5-5', raciocinio: true, busca: true, esforco: 'high' });
  assert.deepEqual(r.thinking, { type: 'adaptive', display: 'summarized' });
  assert.deepEqual(r.tools, [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }]); assert.equal(r.output_config.effort, 'high');
  const h = A.montarRequisicao([A.mensagemUsuario('x')], { modelo: 'claude-haiku-5-5', busca: true });
  assert.equal(h.tools, undefined); assert.equal(h.fallbacks, undefined); assert.equal(h.betas, undefined);
  assert.equal(A.modelo('desconhecido').id, A.PADRAO);
});

test('sistema: projeto, fontes e dados do app entram; data de hoje', () => {
  const s = A.blocosSistema({ data: '22/10/2026', projeto: { nome: 'Cliente X', instrucoes: 'Sempre em tabela.' }, fontes: [{ nome: 'Edital "1"', texto: 'Cláusula 5' }], contextoApp: 'Clientes: X' });
  assert.match(s, /Hoje é 22\/10\/2026/); assert.match(s, /Instruções do projeto "Cliente X":\nSempre em tabela/);
  assert.match(s, /<documento nome="Edital '1'">\nCláusula 5/); assert.match(s, /Clientes: X/);
});

test('histórico: assistente volta sem alteração (pensamento incluído); recusas e vazios ficam fora', () => {
  const pens = { type: 'thinking', thinking: 'resumo', signature: 'abc' };
  const msgs = [A.mensagemUsuario('a'), { role: 'assistant', content: [pens, { type: 'text', text: 'b' }] }, A.mensagemUsuario('c'), { role: 'assistant', recusa: true, content: [] }, A.mensagemUsuario('d')];
  const h = A.historicoAPI(msgs);
  assert.equal(h.length, 4); assert.deepEqual(h[1].content[0], pens); assert.equal(h[3].content[0].text, 'd');
});

test('eco após fallback no meio da resposta: descarta pensamento e ferramenta sem par antes do marcador', () => {
  const c = [
    { type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: 'parcial ' },
    { type: 'server_tool_use', id: 'u1', name: 'web_search', input: {} }, { type: 'web_search_tool_result', tool_use_id: 'u1', content: [] },
    { type: 'server_tool_use', id: 'u2', name: 'web_search', input: {} },
    { type: 'fallback', from: { model: 'a' }, to: { model: 'b' } },
    { type: 'thinking', thinking: '', signature: 't' }, { type: 'text', text: 'resto' }
  ];
  assert.deepEqual(A.paraEco(c).map(b => b.type + (b.id || '')), ['text', 'server_tool_useu1', 'web_search_tool_result', 'thinking', 'text']);
  const semFb = [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: 'x' }];
  assert.deepEqual(A.paraEco(semFb), semFb);
});

test('resposta: texto, raciocínio, buscas, fontes sem repetição e só http(s); erro da busca', () => {
  const c = [
    { type: 'thinking', thinking: 'pensei' },
    { type: 'server_tool_use', name: 'web_search', input: { query: 'PNCP lei 14.133' } },
    { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://www.gov.br/pncp', title: 'PNCP' }, { type: 'web_search_result', url: 'javascript:alert(1)', title: 'mau' }] },
    { type: 'text', text: 'Segundo o portal, ', citations: [{ url: 'https://www.gov.br/pncp', title: 'PNCP' }] }, { type: 'text', text: 'ok.' }
  ];
  assert.equal(A.textoDe(c), 'Segundo o portal, ok.'); assert.equal(A.raciocinioDe(c), 'pensei');
  assert.deepEqual(A.buscasDe(c), ['PNCP lei 14.133']); assert.deepEqual(A.fontesDe(c), [{ url: 'https://www.gov.br/pncp', titulo: 'PNCP' }]);
  assert.equal(A.erroBusca(c), null); assert.equal(A.erroBusca([{ type: 'web_search_tool_result', content: { error_code: 'max_uses_exceeded' } }]), 'max_uses_exceeded');
});

test('custo: preço por modelo, cache lido e escrito, soma de uso com buscas', () => {
  const u = A.somarUso(null, { input_tokens: 1e6, output_tokens: 1e6, server_tool_use: { web_search_requests: 2 } });
  assert.equal(u.buscas, 2); assert.equal(A.custo(u, 'claude-opus-5-5'), 24);
  assert.equal(A.custo({ cache_read_input_tokens: 1e6, cache_creation_input_tokens: 1e6 }, 'claude-sonnet-5-5'), 0.2 + 2.5);
  assert.equal(A.dolar(24), 'US$ 24,00'); assert.equal(A.dolar(0.0012), 'US$ 0,0012');
});

test('markdown: escapa HTML, links só http(s), código, tabela, listas, tarefas e citação', () => {
  const h = A.markdown('# Título\n<script>x</script> **negrito** e *itálico* `a<b`\n\n[ok](https://pncp.gov.br) [ruim](javascript:alert(1))\n\n```js\nif (a < b) {}\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- um\n- [x] feito\n\n1. primeiro\n2. segundo\n\n> nota');
  assert.ok(!/<script>/.test(h)); assert.match(h, /&lt;script&gt;/); assert.match(h, /<h3>Título<\/h3>/);
  assert.match(h, /<strong>negrito<\/strong>/); assert.match(h, /<em>itálico<\/em>/); assert.match(h, /<code>a&lt;b<\/code>/);
  assert.match(h, /<a href="https:\/\/pncp.gov.br" target="_blank" rel="noopener noreferrer">ok<\/a>/); assert.ok(!/href="javascript/.test(h));
  assert.match(h, /<pre><code>if \(a &lt; b\) \{\}<\/code><\/pre>/); assert.match(h, /<th>A<\/th>/); assert.match(h, /<td>2<\/td>/);
  assert.match(h, /<ul><li>um<\/li><li class="ck"><input type="checkbox" disabled checked> feito<\/li><\/ul>/); assert.match(h, /<ol><li>primeiro<\/li><li>segundo<\/li><\/ol>/);
  assert.match(h, /<blockquote><p>nota<\/p><\/blockquote>/);
  assert.equal(A.markdown('linha 1\nlinha 2'), '<p>linha 1<br>linha 2</p>');
});

test('conversas: título curto, busca sem acento, grupos por data e fixadas', () => {
  assert.equal(A.tituloDe('  Analise   o edital  '), 'Analise o edital');
  assert.equal(A.tituloDe('Preciso de uma minuta de impugnação ao edital do pregão eletrônico 90012/2026'), 'Preciso de uma minuta de impugnação ao edital…');
  const agora = new Date('2026-10-22T15:00:00').getTime();
  const cs = [{ id: 1, titulo: 'Impugnação', editadaEm: agora }, { id: 2, titulo: 'Habilitação', editadaEm: agora - 864e5 }, { id: 3, titulo: 'Velha', editadaEm: agora - 90 * 864e5, fixada: true }, { id: 4, titulo: 'Semana', editadaEm: agora - 3 * 864e5 }];
  assert.deepEqual(A.buscar(cs, 'impugnacao').map(c => c.id), [1]);
  assert.deepEqual(A.agrupar(cs, agora).map(g => g.t + ':' + g.l.map(c => c.id).join()), ['Fixadas:3', 'Hoje:1', 'Ontem:2', 'Últimos 7 dias:4']);
});

test('anexos: tipos aceitos e blocos da API (imagem, PDF, texto)', () => {
  assert.equal(A.tipoAnexo('a.png', 'image/png'), 'imagem'); assert.equal(A.tipoAnexo('edital.PDF', ''), 'pdf');
  assert.equal(A.tipoAnexo('tr.docx', ''), 'docx'); assert.equal(A.tipoAnexo('x.csv', ''), 'texto'); assert.equal(A.tipoAnexo('x.exe', 'application/x-msdownload'), null);
  const m = A.mensagemUsuario('analise', [{ tipo: 'pdf', nome: 'edital.pdf', dados: 'QUJD' }, { tipo: 'imagem', mime: 'image/png', nome: 'p.png', dados: 'AAA' }, { tipo: 'texto', nome: 'tr.docx', texto: 'termo' }]);
  assert.deepEqual(m.content[0], { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'QUJD' }, title: 'edital.pdf' });
  assert.equal(m.content[1].source.media_type, 'image/png'); assert.deepEqual(m.content[2].source, { type: 'text', media_type: 'text/plain', data: 'termo' });
  assert.equal(m.content[3].text, 'analise'); assert.equal(A.textoUsuario(m), 'analise');
  assert.deepEqual(A.anexosUsuario(m).map(a => a.tipo + ':' + a.nome), ['pdf:edital.pdf', 'imagem:p.png', 'texto:tr.docx']);
});

test('contexto do app: clientes, agenda da semana, licitações ativas e documentos vencendo', () => {
  const d = {
    empresas: [{ id: 'e1', razao: 'Alfa LTDA', fantasia: 'Alfa', cnpj: '11.222.333/0001-81' }], empresaAtiva: 'e1',
    agenda: { tarefas: [{ titulo: 'Sessão pregão 12', data: '2026-10-24', hora: '09:00' }, { titulo: 'Feita', data: '2026-10-23', feita: true }, { titulo: 'Longe', data: '2026-12-01' }] },
    monitor: [{ titulo: 'PE 12/2026 Catalão', situacao: 'Em andamento' }, { titulo: 'Antiga', situacao: 'Homologada' }],
    documentos: [{ nome: 'CNDT', validade: '2026-10-25' }, { nome: 'Contrato Social' }]
  };
  const c = A.contextoApp(d, '2026-10-22');
  assert.match(c, /Alfa \(11\.222\.333\/0001-81\)/); assert.match(c, /Cliente ativo: Alfa/); assert.match(c, /24\/10\/2026 09:00: Sessão pregão 12/);
  assert.ok(!/Feita|Longe|Antiga|Contrato Social/.test(c)); assert.match(c, /PE 12\/2026 Catalão \(Em andamento\)/); assert.match(c, /CNDT: validade 25\/10\/2026/);
  assert.equal(A.contextoApp({}, '2026-10-22'), '');
});

test('exportar conversa em markdown com fontes e recusa', () => {
  const md = A.exportarMarkdown({ titulo: 'Teste', modelo: 'claude-opus-5-5', criadaEm: Date.now() }, [A.mensagemUsuario('Pergunta'), { role: 'assistant', content: [{ type: 'text', text: 'Resposta', citations: [{ url: 'https://pncp.gov.br', title: 'PNCP' }] }] }, A.mensagemUsuario('outra'), { role: 'assistant', recusa: true, content: [] }]);
  assert.match(md, /^# Teste/); assert.match(md, /## Você\n\nPergunta/); assert.match(md, /- \[PNCP\]\(https:\/\/pncp.gov.br\)/); assert.match(md, /recusado/);
});
