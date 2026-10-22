// Seven.ai: o módulo do SDK da Anthropic (jsDelivr) é trocado por um simulado que transmite eventos como a API.
// Uso: node testes/sevenai.e2e.cjs [pasta-de-capturas]
const path = require('path'); const fs = require('fs');
const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');

const SDK_SIMULADO = `
class APIError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
class AuthenticationError extends APIError {} class PermissionDeniedError extends APIError {} class RateLimitError extends APIError {}
class BadRequestError extends APIError {} class APIConnectionError extends APIError {} class APIUserAbortError extends APIError {}
const espera = (ms) => new Promise(r => setTimeout(r, ms));
function ultimoTexto(p) { const u = p.messages[p.messages.length - 1]; if (u.role !== 'user') return '#pausa-volta'; const c = Array.isArray(u.content) ? u.content : [{ type: 'text', text: u.content }]; return c.filter(b => b.type === 'text').map(b => b.text).join(' '); }
function roteiro(p) {
  const t = ultimoTexto(p); const uso = { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 800 };
  if (/chave ruim/.test(t)) return { erro: new AuthenticationError(401, 'invalid x-api-key') };
  if (/recuse/.test(t)) return { blocos: [], parada: 'refusal', uso };
  if (/pausa/.test(t) && t !== '#pausa-volta') return { blocos: [{ type: 'server_tool_use', id: 'su1', name: 'web_search', input: { query: 'pausa' } }], parada: 'pause_turn', uso };
  if (t === '#pausa-volta') return { blocos: [{ type: 'text', text: 'Retomei depois da pausa.' }], parada: 'end_turn', uso };
  const blocos = [];
  if (p.thinking) blocos.push({ type: 'thinking', thinking: 'Vou checar a Lei 14.133.', signature: 'sig' });
  if (/pesquise/.test(t)) {
    blocos.push({ type: 'server_tool_use', id: 'su2', name: 'web_search', input: { query: 'PNCP portal' } });
    blocos.push({ type: 'web_search_tool_result', tool_use_id: 'su2', content: [{ type: 'web_search_result', url: 'https://www.gov.br/pncp/pt-br', title: 'Portal Nacional de Contratações Públicas', encrypted_content: 'x' }] });
    blocos.push({ type: 'text', text: 'O PNCP é o portal oficial de divulgação.', citations: [{ type: 'web_search_result_location', url: 'https://www.gov.br/pncp/pt-br', title: 'Portal Nacional de Contratações Públicas', cited_text: '...' }] });
    uso.server_tool_use = { web_search_requests: 1 };
  } else if (/longo/.test(t)) blocos.push({ type: 'text', text: Array.from({ length: 400 }, (_, i) => 'palavra' + i).join(' ') });
  else blocos.push({ type: 'text', text: '**Resposta ' + p.messages.length + '** para: ' + t.slice(0, 40) + '\\n\\n| Item | Prazo |\\n|---|---|\\n| Impugnação | 3 dias úteis |\\n\\n- [x] conferido' });
  return { blocos, parada: 'end_turn', uso };
}
class Stream {
  constructor(p) { this.p = p; this.r = roteiro(p); this.abortado = false; (window.__iaPedidos = window.__iaPedidos || []).push(JSON.parse(JSON.stringify(p))); }
  abort() { this.abortado = true; }
  async *[Symbol.asyncIterator]() {
    await espera(30);
    if (this.r.erro) throw this.r.erro;
    yield { type: 'message_start', message: { model: this.p.model } };
    const lento = this.r.blocos.some(b => b.type === 'text' && /palavra399/.test(b.text));
    for (let i = 0; i < this.r.blocos.length; i++) {
      const b = this.r.blocos[i];
      if (b.type === 'text') {
        yield { type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } };
        const partes = b.text.match(/.{1,12}/gs) || [];
        for (const pedaco of partes) { if (this.abortado) throw new APIUserAbortError(undefined, 'Request was aborted.'); await espera(lento ? 25 : 3); yield { type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: pedaco } }; }
      } else if (b.type === 'thinking') {
        yield { type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '' } };
        yield { type: 'content_block_delta', index: i, delta: { type: 'thinking_delta', thinking: b.thinking } };
      } else yield { type: 'content_block_start', index: i, content_block: b };
      yield { type: 'content_block_stop', index: i };
    }
    yield { type: 'message_delta', delta: { stop_reason: this.r.parada } };
  }
  async finalMessage() { return { model: this.p.model, content: this.r.blocos, stop_reason: this.r.parada, usage: this.r.uso }; }
}
export default class Anthropic {
  constructor(o) { window.__iaOpcoes = o; this.beta = { messages: { stream: (p) => new Stream(p) } }; }
}
Object.assign(Anthropic, { APIError, AuthenticationError, PermissionDeniedError, RateLimitError, BadRequestError, APIConnectionError, APIUserAbortError });
`;

(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t;
  await pg.route('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@*/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: SDK_SIMULADO }));
  const pedidos = () => pg.evaluate(() => window.__iaPedidos || []);
  const ultimo = async () => (await pedidos()).slice(-1)[0];
  const respostas = () => pg.locator('.ia-msg.bot:not(.ao-vivo)').count();
  const esperarFim = () => pg.waitForFunction(() => !document.querySelector('.ia-msg.ao-vivo') && !document.querySelector('[data-ia=parar]'), null, { timeout: 15000 });
  const perguntar = async (texto) => { const n = await respostas(); await pg.fill('.ia-comp textarea', texto); await pg.press('.ia-comp textarea', 'Enter'); await pg.waitForFunction(n => document.querySelectorAll('.ia-msg.bot:not(.ao-vivo)').length > n && !document.querySelector('.ia-msg.ao-vivo'), n, { timeout: 15000 }); };
  try {
    await pg.goto(url); await pg.evaluate(() => { Dados.e.empresas = [{ id: 'e1', razao: 'Alfa Comércio LTDA', fantasia: 'Alfa', cnpj: '11.222.333/0001-81' }]; Dados.e.empresaAtiva = 'e1'; Dados.salvar(); });
    await pg.goto(url + '#/ia'); await pg.waitForSelector('.ia-boas');
    ok(/Seven\.ai/.test(await pg.locator('.menu a[data-rota=ia]').innerText()), 'Seven.ai no menu');
    ok(await pg.locator('.ia-aviso-chave').count() === 1, 'sem chave: pede para cadastrar');
    ok(await pg.locator('.ia-atalhos button').count() === 6, 'atalhos de licitação na tela inicial');
    await foto('ia-inicio');
    await pg.click('.ia-aviso-chave button'); await pg.fill('.modal [name=chave]', 'abc'); await pg.click('.modal [type=submit]');
    ok(await pg.locator('.modal').count() === 1, 'chave fora do formato sk-ant- é recusada');
    await pg.fill('.modal [name=chave]', 'sk-ant-teste-123'); await pg.click('.modal [type=submit]'); await pg.waitForSelector('.modal', { state: 'detached' });
    ok(await pg.evaluate(() => localStorage.getItem('seven-ia:chave') === 'sk-ant-teste-123' && Dados.exportar().indexOf('sk-ant') < 0), 'chave guardada só no navegador, fora do backup');

    await pg.click('.ia-atalhos button >> nth=0'); ok(/Analise o edital anexo/.test(await pg.inputValue('.ia-comp textarea')), 'atalho preenche a mensagem');
    await perguntar('Qual o prazo de impugnação?');
    ok(/#\/ia\/c\/ia-/.test(await pg.evaluate(() => location.hash)), 'conversa criada com rota própria');
    ok(await pg.locator('.ia-md strong:has-text("Resposta 1")').count() === 1 && await pg.locator('.ia-md table td:has-text("3 dias úteis")').count() === 1, 'resposta transmitida e renderizada em markdown (negrito e tabela)');
    let p = await ultimo(); const op = await pg.evaluate(() => window.__iaOpcoes);
    ok(op.apiKey === 'sk-ant-teste-123' && op.dangerouslyAllowBrowser === true, 'SDK criado com a chave do usuário no modo navegador');
    ok(p.model === 'claude-opus-5-5' && p.max_tokens === 64000 && p.cache_control.type === 'ephemeral' && p.output_config.effort === 'medium', 'pedido: Opus 5.5, 64k, cache e esforço explícito');
    ok(p.fallbacks === 'default' && p.betas[0] === 'server-side-fallback-2026-07-01' && !p.tools && !p.thinking, 'fallback por recusa ligado; sem pesquisa nem raciocínio por padrão');
    ok(/BPO de Licitações/.test(p.system) && /nunca invente link/.test(p.system) && !/Dados atuais/.test(p.system), 'instruções da Seven no sistema, sem dados do app');
    ok(/Qual o prazo de impugnação/.test(await pg.locator('.ia-lista a.ativa').innerText()), 'título automático na lateral');
    ok(/US\$/.test(await pg.locator('.ia-custo').innerText()), 'custo estimado no topo');

    // pesquisa + raciocínio + dados do app
    await pg.click('[data-ia=tog][data-k=busca]'); await pg.click('[data-ia=tog][data-k=raciocinio]'); await pg.click('[data-ia=tog][data-k=contexto]');
    await perguntar('pesquise o PNCP');
    p = await ultimo();
    ok(p.tools && p.tools[0].type === 'web_search_20260209' && p.thinking.display === 'summarized', 'pesquisa na web e raciocínio resumido no pedido');
    ok(/Dados atuais do Seven Licita/.test(p.system) && /Alfa \(11\.222\.333\/0001-81\)/.test(p.system), 'dados do app entram quando ligados');
    ok(p.messages.length === 3 && p.messages[1].role === 'assistant', 'histórico enviado inteiro');
    const ultima = pg.locator('.ia-msg.bot').last();
    ok(await ultima.locator('.ia-fontes a[href="https://www.gov.br/pncp/pt-br"]').count() === 1, 'fontes da pesquisa com link');
    ok(/PNCP portal/.test(await ultima.locator('.ia-buscas').innerText()), 'termo pesquisado aparece');
    ok(/14\.133/.test(await ultima.locator('.ia-rac').textContent()), 'raciocínio em bloco recolhível');
    await foto('ia-conversa');
    await perguntar('e o prazo de recurso?');
    p = await ultimo(); ok(p.messages[3].content.some(b => b.type === 'thinking' && b.signature === 'sig') && p.messages[3].content.some(b => b.type === 'web_search_tool_result'), 'blocos do assistente (raciocínio e pesquisa) voltam sem alteração');
    await pg.click('[data-ia=tog][data-k=contexto]');

    // Haiku: sem pesquisa e sem fallback
    await pg.selectOption('.ia-comp [data-ia=modelo]', 'claude-haiku-5-5');
    ok(await pg.locator('[data-ia=tog][data-k=busca]').isDisabled(), 'pesquisa indisponível no Haiku');
    await perguntar('oi haiku'); p = await ultimo();
    ok(p.model === 'claude-haiku-5-5' && !p.tools && !p.fallbacks && !p.betas, 'Haiku sem ferramenta de pesquisa e sem fallback');
    await pg.selectOption('.ia-comp [data-ia=modelo]', 'claude-opus-5-5');

    // pause_turn
    const antes = (await pedidos()).length;
    await perguntar('faça uma pausa'); const ps = await pedidos();
    ok(ps.length === antes + 2 && ps[ps.length - 1].messages.slice(-1)[0].role === 'assistant', 'pause_turn: retoma reenviando o turno do assistente, sem "continue"');
    ok(/Retomei depois da pausa/.test(await pg.locator('.ia-msg.bot').last().innerText()), 'resposta retomada aparece');

    // recusa
    await perguntar('recuse isto'); ok(/recusado pelos filtros/.test(await pg.locator('.ia-msg.bot').last().innerText()), 'recusa explicada');
    await perguntar('depois da recusa'); p = await ultimo();
    ok(!p.messages.some(m => m.role === 'assistant' && (!m.content || !m.content.length)), 'recusa não volta ao histórico como mensagem vazia');

    // parar
    await pg.fill('.ia-comp textarea', 'texto longo'); await pg.press('.ia-comp textarea', 'Enter');
    await pg.waitForFunction(() => /palavra1\d/.test((document.querySelector('.ia-msg.ao-vivo') || {}).innerText || ''));
    await pg.click('[data-ia=parar]'); await esperarFim();
    const ult = await pg.locator('.ia-msg.bot').last().innerText(); ok(/Resposta interrompida/.test(ult) && !/palavra399/.test(ult), 'parar interrompe e guarda o parcial');

    // refazer e editar
    const nMsgs = await pg.locator('.ia-msg').count();
    await pg.click('[data-ia=regenerar]'); await esperarFim(); await pg.waitForSelector('[data-ia=regenerar]');
    ok(await pg.locator('.ia-msg').count() === nMsgs, 'refazer troca a última resposta');
    await pg.locator('.ia-msg.eu').first().hover(); await pg.click('.ia-msg.eu >> nth=0 >> [data-ia=editar]');
    const nPed = (await pedidos()).length;
    await pg.fill('.ia-msg.editando textarea', 'Pergunta editada'); await pg.click('.ia-msg.editando button.primario');
    await pg.waitForFunction(n => (window.__iaPedidos || []).length > n, nPed); await esperarFim();
    p = await ultimo(); ok(p.messages.length === 1 && p.messages[0].content.slice(-1)[0].text === 'Pergunta editada', 'editar reenvia a partir daquela mensagem');
    ok(await pg.locator('.ia-msg').count() === 2, 'conversa segue a partir da edição');

    // erro de chave
    await pg.fill('.ia-comp textarea', 'chave ruim'); await pg.press('.ia-comp textarea', 'Enter');
    await pg.waitForSelector('.ia-msg.erro'); ok(/Chave de API inválida/.test(await pg.locator('.ia-msg.erro').innerText()), 'erro de autenticação traduzido');
    await pg.waitForSelector('.modal [name=chave]'); await pg.click('.modal .cancelar');

    // anexos
    await pg.click('a.ia-nova'); await pg.waitForSelector('.ia-boas');
    const txt = t.arquivo('termo.txt', 'Termo de referência: entrega em 30 dias.');
    const png = t.arquivo('foto.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
    const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('[data-ia=anexar]')]); await fc.setFiles([txt, png]);
    await pg.waitForFunction(() => document.querySelectorAll('.ia-chips .ia-chip').length === 2); ok(true, 'dois anexos no compositor');
    await perguntar('resuma os anexos'); p = await ultimo();
    const c0 = p.messages[0].content;
    ok(c0[0].type === 'document' && c0[0].source.data === 'Termo de referência: entrega em 30 dias.' && c0[1].type === 'image' && c0[1].source.media_type === 'image/png' && c0[2].text === 'resuma os anexos', 'anexos viram blocos de documento e imagem antes do texto');
    ok(await pg.locator('.ia-msg.eu .ia-anexos .ia-chip').count() === 2, 'anexos aparecem na mensagem');

    // salvar nota, copiar, exportar, renomear, fixar
    await pg.click('.ia-msg.bot >> nth=-1 >> [data-ia=nota]'); ok(await pg.evaluate(() => Dados.e.anotacoes.notas.length === 1 && /Resposta 1/.test(Dados.e.anotacoes.notas[0].html)), 'resposta salva em Anotações');
    await pg.click('[data-ia=renomear]'); await pg.fill('.modal [name=t]', 'Termo de referência X'); await pg.click('.modal [type=submit]');
    ok(/Termo de referência X/.test(await pg.locator('.ia-titulo').innerText()), 'renomear conversa');
    await pg.click('[data-ia=fixar]'); ok(/Fixadas/.test(await pg.locator('.ia-lista').innerText()), 'conversa fixada no topo da lateral');
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-ia=exportar]')]);
    const md = fs.readFileSync(await dl.path(), 'utf8'); ok(dl.suggestedFilename() === 'Termo de referência X.md' && /## Você\n\nresuma os anexos/.test(md) && /_Anexos: termo\.txt, foto\.png_/.test(md), 'exporta em Markdown');
    await pg.fill('[data-ia=buscar]', 'prazo de impugnacao'); ok(await pg.locator('.ia-lista a').count() === 1, 'busca nas conversas (sem acento)'); await pg.fill('[data-ia=buscar]', '');

    // persistência
    const hash = await pg.evaluate(() => location.hash); await pg.reload(); await pg.waitForSelector('.ia-msg.bot');
    ok(hash === await pg.evaluate(() => location.hash) && await pg.locator('.ia-msg.eu .ia-anexos .ia-chip').count() === 2, 'conversa e anexos persistem após recarregar');

    // projetos
    await pg.evaluate(async () => { await Dados.guardarArquivo('cdf-1', new Blob(['Ata de registro de preços 7/2026: validade 12 meses.'])); Dados.e.cadernos = [{ id: 'cd1', titulo: 'Atas Catalão', fontes: [{ id: 'f1', nome: 'ata7.txt', arq: 'cdf-1', ativa: true }], notas: [], conversa: [], criadoEm: Date.now(), editadoEm: Date.now() }]; Dados.salvar(); });
    await pg.click('.ia-lat-link'); await pg.waitForSelector('.ia-pjs');
    await pg.click('[data-ia=novo-projeto]'); await pg.fill('.modal [name=nome]', 'Cliente Alfa'); await pg.fill('.modal [name=instrucoes]', 'O cliente é ME: lembre do benefício da LC 123.'); await pg.click('.modal [type=submit]');
    await pg.waitForSelector('.ia-pj h1'); ok(/Cliente Alfa/.test(await pg.locator('.ia-pj h1').innerText()), 'projeto criado');
    await pg.click('[data-ia=fonte-texto]'); await pg.fill('.modal [name=nome]', 'Contrato social'); await pg.fill('.modal [name=texto]', 'Capital social de R$ 100.000,00.'); await pg.click('.modal [type=submit]');
    await pg.waitForSelector('.ia-pj-fontes li'); await pg.click('[data-ia=fonte-caderno]'); await pg.click('.modal [type=submit]');
    await pg.waitForFunction(() => document.querySelectorAll('.ia-pj-fontes li').length === 2); ok(true, 'fonte de texto e caderno vinculados');
    await foto('ia-projeto');
    await perguntar('qual o capital social?'); p = await ultimo();
    ok(/lembre do benefício da LC 123/.test(p.system) && /<documento nome="Contrato social">\nCapital social de R\$ 100\.000,00\./.test(p.system) && /Atas Catalão › ata7\.txt/.test(p.system), 'instruções, fonte e caderno do projeto no sistema');
    ok(/Cliente Alfa/.test(await pg.locator('.ia-topo .ia-pj-tag').innerText()), 'conversa marcada com o projeto');

    // excluir
    const n = await pg.evaluate(() => Dados.e.ia.conversas.length);
    await pg.click('[data-ia=excluir]'); await pg.click('.modal [type=submit]'); await pg.waitForSelector('.ia-pj h1');
    ok(await pg.evaluate(() => Dados.e.ia.conversas.length) === n - 1, 'excluir conversa volta ao projeto');

    // celular
    await pg.setViewportSize({ width: 390, height: 800 }); await pg.goto(url + '#/ia'); await pg.waitForSelector('.ia-boas');
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= 390), 'sem rolagem lateral no celular');
    await pg.click('[data-ia=lateral]'); await pg.waitForTimeout(250); ok(await pg.locator('.ia-lat.aberta').count() === 1, 'lateral abre no celular');
    await foto('ia-celular');
  } catch (x) { await foto('ia-erro'); throw x; }
  await t.fechar();
})().catch(e => { console.error(e); process.exit(1); });
