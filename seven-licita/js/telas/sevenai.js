/* Seven.ia (estilo claude.ai): conversas com a API da Anthropic direto do navegador, com a chave do próprio usuário.
   Streaming, anexos (PDF, imagem, DOCX, texto), pesquisa na web com fontes, raciocínio visível, projetos com instruções
   e documentos (inclusive cadernos do Seven Synapse) e contexto opcional dos dados da Plataforma 7. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, confirmar, aviso } = UI;
  const S = self.SevenAI;
  const CHAVE = 'seven-ia:chave';
  const LIB = { pdf: ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdfjsLib'], mammoth: ['https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', 'mammoth'] };
  const libs = {};
  // Estado da sessão (fora do armazenamento): conversa aberta, mensagens, envio em andamento, anexos do compositor.
  const mem = { id: null, msgs: [], carregando: false, enviando: null, anexos: [], rascunho: '', busca: '', lateral: false, editando: -1 };
  let sdkP = null;

  function e() {
    const d = Dados.e; d.ia = d.ia || {}; const a = d.ia;
    a.conversas = a.conversas || []; a.projetos = a.projetos || [];
    if (!a.pref || !a.pref.modelo) a.pref = Object.assign({ modelo: S.PADRAO, esforco: 'medium', busca: false, raciocinio: false, contexto: false }, a.pref || {});
    return a;
  }
  function conversa(id) { return e().conversas.find(function (c) { return c.id === id; }); }
  function projeto(id) { return e().projetos.find(function (p) { return p.id === id; }); }
  function chave() { try { return localStorage.getItem(CHAVE) || ''; } catch (x) { return ''; } }
  function primeiroNome() { return String((Dados.e.config && Dados.e.config.responsavel) || '').split(' ')[0]; }
  function saudacao() { const h = new Date().getHours(); return (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite') + (primeiroNome() ? ', ' + primeiroNome() : ''); }

  function carregarLib(nome) { const x = LIB[nome]; if (self[x[1]]) return Promise.resolve(self[x[1]]); return libs[nome] = libs[nome] || new Promise(function (ok, erro) { const s = document.createElement('script'); s.src = x[0]; s.onload = function () { ok(self[x[1]]); }; s.onerror = function () { libs[nome] = null; erro(new Error('Sem acesso à biblioteca de leitura (' + nome + ').')); }; document.head.appendChild(s); }); }
  async function textoDoArquivo(f) {
    const nome = f.name.toLowerCase();
    if (/\.pdf$/.test(nome)) {
      const pdfjs = await carregarLib('pdf'); pdfjs.GlobalWorkerOptions.workerSrc = LIB.pdf[0].replace('pdf.min.js', 'pdf.worker.min.js');
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise; let t = '';
      for (let p = 1; p <= doc.numPages; p++) { const tc = await (await doc.getPage(p)).getTextContent(); t += tc.items.map(function (i) { return i.str + (i.hasEOL ? '\n' : ' '); }).join('') + '\n\n'; }
      return t;
    }
    if (/\.docx$/.test(nome)) { const m = await carregarLib('mammoth'); return (await m.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value; }
    return f.text();
  }
  function base64(f) { return new Promise(function (ok, erro) { const r = new FileReader(); r.onload = function () { ok(String(r.result).split(',')[1] || ''); }; r.onerror = erro; r.readAsDataURL(f); }); }

  // ---------- armazenamento das mensagens (IndexedDB) ----------
  async function lerMsgs(id) { const b = await Dados.lerArquivo('ia-msg-' + id); return b ? JSON.parse(await b.text()) : []; }
  function gravarMsgs(id, msgs) { return Dados.guardarArquivo('ia-msg-' + id, new Blob([JSON.stringify(msgs)], { type: 'application/json' })); }
  async function abrirConversa(id) {
    if (mem.id === id && !mem.carregando) return;
    mem.id = id; mem.carregando = true; mem.editando = -1;
    mem.msgs = await lerMsgs(id); mem.carregando = false;
  }

  // ---------- SDK ----------
  function sdk() {
    return sdkP = sdkP || import(S.SDK_URL).then(function (m) { return m.default || m.Anthropic; }).catch(function (x) { sdkP = null; throw new Error('Não consegui carregar o SDK da Anthropic. Verifique a internet. (' + x.message + ')'); });
  }
  function mensagemErro(Anthropic, err) {
    if (Anthropic && err instanceof Anthropic.AuthenticationError) return { t: 'Chave de API inválida ou revogada. Confira em Configurar.', config: true };
    if (Anthropic && err instanceof Anthropic.PermissionDeniedError) return { t: 'A chave não tem permissão para este modelo ou recurso. Tente outro modelo ou desligue a pesquisa na web.' };
    if (Anthropic && err instanceof Anthropic.RateLimitError) return { t: 'Limite de uso da conta atingido. Aguarde um pouco e tente de novo, ou confira os limites no console da Anthropic.' };
    if (Anthropic && err instanceof Anthropic.BadRequestError) return { t: 'A API recusou o pedido: ' + (err.message || '') + (/credit|billing|saldo/i.test(err.message || '') ? ' Verifique o saldo da conta na Anthropic.' : '') };
    if (Anthropic && err instanceof Anthropic.APIConnectionError) return { t: 'Sem conexão com a API da Anthropic. Verifique a internet.' };
    if (Anthropic && err instanceof Anthropic.APIError) return { t: 'Erro da API' + (err.status ? ' (' + err.status + ')' : '') + ': ' + (err.message || '') };
    return { t: err && err.message ? err.message : String(err) };
  }

  // ---------- fontes do projeto ----------
  async function fontesProjeto(p) {
    const out = [];
    for (const f of (p.fontes || [])) { const b = await Dados.lerArquivo(f.arq); if (b) out.push({ nome: f.nome, texto: await b.text() }); }
    for (const cid of (p.cadernos || [])) {
      const c = (Dados.e.cadernos || []).find(function (x) { return x.id === cid; }); if (!c) continue;
      for (const f of c.fontes) { if (f.ativa === false) continue; const b = await Dados.lerArquivo(f.arq); if (b) out.push({ nome: c.titulo + ' › ' + f.nome, texto: await b.text() }); }
    }
    return out;
  }

  // ---------- envio ----------
  function quandoRedesenhar(id) { return location.hash === '#/ia/c/' + id; }
  async function enviar(conv) {
    const pref = e().pref;
    const env = { id: conv.id, texto: '', raciocinio: '', status: 'Conectando…', stream: null, parado: false, fallback: false };
    mem.enviando = env; desenharConversa();
    let Anthropic = null; let acumulado = []; let uso = null; let parar = null;
    try {
      Anthropic = await sdk();
      const cliente = new Anthropic({ apiKey: chave(), dangerouslyAllowBrowser: true });
      const p = conv.projeto && projeto(conv.projeto);
      const opc = { modelo: conv.modelo, esforco: pref.esforco, busca: pref.busca, raciocinio: pref.raciocinio, data: new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }), projeto: p, fontes: p ? await fontesProjeto(p) : [], contextoApp: pref.contexto ? S.contextoApp(Dados.e, new Date().toISOString().slice(0, 10)) : '' };
      const params = S.montarRequisicao(mem.msgs, opc);
      for (let volta = 0; volta < 4; volta++) {
        if (volta) params.messages = S.historicoAPI(mem.msgs).concat([{ role: 'assistant', content: S.paraEco(acumulado) }]);
        const stream = cliente.beta.messages.stream(params); env.stream = stream;
        env.status = volta ? 'Continuando…' : 'Pensando…'; atualizarAoVivo();
        for await (const ev of stream) {
          if (ev.type === 'content_block_start') {
            const b = ev.content_block;
            if (b.type === 'server_tool_use') env.status = '🔎 Pesquisando na web…';
            else if (b.type === 'web_search_tool_result') env.status = '📖 Lendo os resultados…';
            else if (b.type === 'thinking') env.status = '💭 Raciocinando…';
            else if (b.type === 'fallback') { env.fallback = true; env.status = 'Outro modelo assumiu a resposta…'; }
            else if (b.type === 'text') env.status = '';
          } else if (ev.type === 'content_block_delta') {
            if (ev.delta.type === 'text_delta') { env.texto += ev.delta.text; env.status = ''; }
            else if (ev.delta.type === 'thinking_delta') env.raciocinio += ev.delta.thinking;
          }
          atualizarAoVivo();
        }
        const fim = await stream.finalMessage();
        acumulado = acumulado.concat(fim.content || []); uso = S.somarUso(uso, fim.usage); parar = fim.stop_reason;
        conv.modeloUsado = fim.model;
        if (parar !== 'pause_turn') break;
      }
      if (parar === 'refusal') mem.msgs.push({ role: 'assistant', recusa: true, content: [], em: Date.now() });
      else mem.msgs.push({ role: 'assistant', content: acumulado, uso: uso, modelo: conv.modeloUsado || conv.modelo, parada: parar, em: Date.now() });
    } catch (err) {
      if (Anthropic && err instanceof Anthropic.APIUserAbortError || env.parado) {
        if (env.texto.trim()) mem.msgs.push({ role: 'assistant', content: [{ type: 'text', text: env.texto }], uso: uso, modelo: conv.modelo, parada: 'interrompida', em: Date.now() });
      } else {
        const m = mensagemErro(Anthropic, err); console.warn(err);
        mem.msgs.push({ role: 'assistant', erro: m.t, content: [], em: Date.now() });
        if (m.config) setTimeout(function () { configurar(false); }, 50);
      }
    }
    if (uso) { conv.uso = S.somarUso(conv.uso, uso); conv.custo = (conv.custo || 0) + S.custo(uso, conv.modelo); }
    conv.editadaEm = Date.now(); conv.resumo = S.textoDe((mem.msgs[mem.msgs.length - 1] || {}).content).slice(0, 200);
    mem.enviando = null;
    await gravarMsgs(conv.id, mem.msgs.filter(function (m) { return !m.erro; }));
    Dados.salvar();
    if (quandoRedesenhar(conv.id)) desenharConversa();
  }

  async function novaPergunta(texto, projId) {
    if (mem.enviando) return;
    if (!chave()) { await configurar(true); if (!chave()) return; }
    const anexos = mem.anexos.slice();
    if (!texto.trim() && !anexos.length) return;
    let conv = mem.id && conversa(mem.id);
    if (!conv || location.hash.indexOf('#/ia/c/') !== 0) {
      conv = { id: Dados.id('ia'), titulo: S.tituloDe(texto || (anexos[0] && anexos[0].nome)), criadaEm: Date.now(), editadaEm: Date.now(), modelo: e().pref.modelo, projeto: projId || null, custo: 0 };
      e().conversas.push(conv); Dados.salvar(); mem.id = conv.id; mem.msgs = []; mem.carregando = false;
    }
    mem.msgs = mem.msgs.filter(function (m) { return !m.erro; });
    mem.msgs.push(S.mensagemUsuario(texto, anexos)); mem.msgs[mem.msgs.length - 1].em = Date.now();
    if (S.tamanhoMensagens(mem.msgs) > S.LIMITE_BYTES) { mem.msgs.pop(); aviso('A conversa passou do tamanho que a API aceita (32 MB). Remova anexos ou comece uma conversa nova.', 'erro'); return; }
    mem.anexos = []; mem.rascunho = ''; const ta = document.querySelector('.ia-comp textarea'); if (ta) ta.value = '';
    await gravarMsgs(conv.id, mem.msgs);
    if (location.hash !== '#/ia/c/' + conv.id) { location.hash = '#/ia/c/' + conv.id; }
    enviar(conv);
  }

  // ---------- anexos ----------
  async function anexar(arquivos) {
    for (const f of arquivos) {
      const t = S.tipoAnexo(f.name, f.type);
      if (!t) { aviso('Tipo não aceito: ' + f.name + '. Use PDF, imagem, DOCX ou texto.', 'erro'); continue; }
      if (f.size > 25 * 1024 * 1024) { aviso(f.name + ' passa de 25 MB.', 'erro'); continue; }
      try {
        if (t === 'imagem') mem.anexos.push({ tipo: 'imagem', nome: f.name, mime: f.type, dados: await base64(f), tam: f.size });
        else if (t === 'pdf') mem.anexos.push({ tipo: 'pdf', nome: f.name, dados: await base64(f), tam: f.size });
        else mem.anexos.push({ tipo: 'texto', nome: f.name, texto: await textoDoArquivo(f), tam: f.size });
      } catch (x) { aviso('Não consegui ler ' + f.name + ': ' + x.message, 'erro'); }
    }
    desenharChips();
  }
  function chipsHTML() {
    return mem.anexos.map(function (a, i) { return '<span class="ia-chip"><span>' + (a.tipo === 'imagem' ? '🖼' : a.tipo === 'pdf' ? '📕' : '📄') + '</span><b>' + esc(a.nome) + '</b><small>' + Math.max(1, Math.round((a.tam || 0) / 1024)) + ' KB</small><button type="button" data-ia="tirar-anexo" data-i="' + i + '" aria-label="Remover anexo ' + esc(a.nome) + '">×</button></span>'; }).join('');
  }
  function desenharChips() { const c = document.querySelector('.ia-chips'); if (c) c.innerHTML = chipsHTML(); }

  // ---------- compositor ----------
  function compositorHTML(conv) {
    const pref = e().pref; const mdl = S.modelo(conv ? conv.modelo : pref.modelo); const env = mem.enviando;
    return '<form class="ia-comp" data-ia="comp">' +
      '<div class="ia-chips">' + chipsHTML() + '</div>' +
      '<textarea name="q" rows="1" placeholder="' + (conv ? 'Responder…' : 'Como posso ajudar hoje?') + '" aria-label="Mensagem para a Seven.ia">' + esc(mem.rascunho) + '</textarea>' +
      '<div class="ia-comp-barra">' +
      '<button type="button" class="ia-ico" data-ia="anexar" title="Anexar PDF, imagem, DOCX ou texto" aria-label="Anexar arquivo">📎</button>' +
      '<button type="button" class="ia-tog' + (pref.busca && mdl.busca ? ' on' : '') + '" data-ia="tog" data-k="busca"' + (mdl.busca ? '' : ' disabled title="Pesquisa na web disponível no Opus 5.5 e no Sonnet 5.5"') + ' aria-pressed="' + !!(pref.busca && mdl.busca) + '">🌐 Pesquisa</button>' +
      '<button type="button" class="ia-tog' + (pref.raciocinio ? ' on' : '') + '" data-ia="tog" data-k="raciocinio" aria-pressed="' + pref.raciocinio + '" title="Mostra um resumo do raciocínio">💭 Raciocínio</button>' +
      '<button type="button" class="ia-tog' + (pref.contexto ? ' on' : '') + '" data-ia="tog" data-k="contexto" aria-pressed="' + pref.contexto + '" title="Envia à Anthropic um resumo dos seus clientes, agenda da semana, licitações e documentos vencendo">🗂 Dados do app</button>' +
      '<span class="ia-esp"></span>' +
      '<select data-ia="esforco" aria-label="Esforço" title="Quanto o modelo pensa antes de responder">' + opcoes(S.ESFORCOS.map(function (x) { return { v: x.id, t: x.t }; }), pref.esforco) + '</select>' +
      '<select data-ia="modelo" aria-label="Modelo">' + opcoes(S.MODELOS.map(function (m) { return { v: m.id, t: m.nome }; }), mdl.id) + '</select>' +
      (env ? '<button type="button" class="ia-enviar parar" data-ia="parar" aria-label="Parar resposta">■</button>' : '<button type="submit" class="ia-enviar" aria-label="Enviar">↑</button>') +
      '</div></form>';
  }
  function autoAltura(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 320) + 'px'; }

  // ---------- mensagens ----------
  function mensagemHTML(m, i, conv) {
    if (m.role === 'user') {
      const an = S.anexosUsuario(m);
      if (mem.editando === i) return '<div class="ia-msg eu editando"><form data-ia="salvar-edicao" data-i="' + i + '"><textarea name="t" rows="3">' + esc(S.textoUsuario(m)) + '</textarea><div><button type="button" class="btn fantasma mini" data-ia="cancelar-edicao">Cancelar</button><button class="btn primario mini">Salvar e enviar</button></div></form></div>';
      return '<div class="ia-msg eu" data-i="' + i + '">' + (an.length ? '<div class="ia-anexos">' + an.map(function (a) { return '<span class="ia-chip"><span>' + (a.tipo === 'imagem' ? '🖼' : a.tipo === 'pdf' ? '📕' : '📄') + '</span><b>' + esc(a.nome) + '</b></span>'; }).join('') + '</div>' : '') +
        '<div class="ia-bolha">' + esc(S.textoUsuario(m)).replace(/\n/g, '<br>') + '</div>' +
        (mem.enviando ? '' : '<button type="button" class="ia-acao ia-editar" data-ia="editar" data-i="' + i + '" title="Editar e reenviar">✎</button>') + '</div>';
    }
    if (m.erro) return '<div class="ia-msg bot erro"><div class="ia-av">⚠</div><div class="ia-corpo"><p>' + esc(m.erro) + '</p><button type="button" class="btn mini" data-ia="tentar">Tentar de novo</button></div></div>';
    if (m.recusa) return '<div class="ia-msg bot recusa"><div class="ia-av">7</div><div class="ia-corpo"><p>O pedido foi recusado pelos filtros de segurança da Anthropic. Reformule a pergunta ou dê mais contexto sobre o uso.</p></div></div>';
    const ultimo = i === mem.msgs.length - 1; const f = S.fontesDe(m.content); const rac = S.raciocinioDe(m.content); const bus = S.buscasDe(m.content); const eb = S.erroBusca(m.content);
    return '<div class="ia-msg bot" data-i="' + i + '"><div class="ia-av">7</div><div class="ia-corpo">' +
      (rac ? '<details class="ia-rac"><summary>💭 Raciocínio</summary><div>' + S.markdown(rac) + '</div></details>' : '') +
      (bus.length ? '<div class="ia-buscas">🔎 ' + bus.map(function (q) { return '<span>' + esc(q) + '</span>'; }).join('') + '</div>' : '') +
      (eb ? '<p class="ia-nota">A pesquisa na web falhou (' + esc(eb) + '); a resposta usa só o conhecimento do modelo.</p>' : '') +
      '<div class="ia-md">' + S.markdown(S.textoDe(m.content)) + '</div>' +
      (m.parada === 'max_tokens' ? '<p class="ia-nota">A resposta chegou ao limite de tamanho. <button type="button" class="btn mini" data-ia="continuar">Continuar</button></p>' : '') +
      (m.parada === 'interrompida' ? '<p class="ia-nota">Resposta interrompida.</p>' : '') +
      (f.length ? '<details class="ia-fontes" open><summary>Fontes (' + f.length + ')</summary><ol>' + f.map(function (x) { let h = ''; try { h = new URL(x.url).hostname.replace(/^www\./, ''); } catch (z) { } return '<li><a href="' + esc(UI.url(x.url)) + '" target="_blank" rel="noopener noreferrer">' + esc(x.titulo) + '</a> <small>' + esc(h) + '</small></li>'; }).join('') + '</ol></details>' : '') +
      '<div class="ia-acoes">' +
      '<button type="button" class="ia-acao" data-ia="copiar" data-i="' + i + '" title="Copiar">⧉ Copiar</button>' +
      (ultimo && !mem.enviando ? '<button type="button" class="ia-acao" data-ia="regenerar" title="Gerar outra resposta">↻ Refazer</button>' : '') +
      '<button type="button" class="ia-acao" data-ia="nota" data-i="' + i + '" title="Salvar em Anotações">🗒 Salvar nota</button>' +
      '<span class="ia-meta">' + esc(S.modelo(m.modelo).nome) + (m.uso ? ' · ' + S.dolar(S.custo(m.uso, m.modelo)) : '') + '</span></div>' +
      '</div></div>';
  }
  function aoVivoHTML() {
    const env = mem.enviando;
    return '<div class="ia-msg bot ao-vivo"><div class="ia-av girando">7</div><div class="ia-corpo">' +
      (env.raciocinio ? '<details class="ia-rac" open><summary>💭 Raciocínio</summary><div>' + S.markdown(env.raciocinio) + '</div></details>' : '') +
      (env.status ? '<p class="ia-status">' + esc(env.status) + '</p>' : '') +
      '<div class="ia-md">' + S.markdown(env.texto) + '<span class="ia-cursor"></span></div></div></div>';
  }
  let quadro = 0;
  function atualizarAoVivo() {
    if (quadro) return;
    quadro = requestAnimationFrame(function () {
      quadro = 0; const el = document.querySelector('.ia-msg.ao-vivo'); if (!el || !mem.enviando) return;
      const rol = document.querySelector('.ia-rolagem'); const noFim = rol && rol.scrollHeight - rol.scrollTop - rol.clientHeight < 80;
      el.outerHTML = aoVivoHTML();
      if (rol && noFim) rol.scrollTop = rol.scrollHeight;
    });
  }

  // ---------- lateral ----------
  function lateralHTML(ativa) {
    const lista = S.buscar(e().conversas, mem.busca);
    return '<aside class="ia-lat' + (mem.lateral ? ' aberta' : '') + '">' +
      '<a class="ia-nova" href="#/ia">＋ Nova conversa</a>' +
      '<a class="ia-lat-link" href="#/ia/projetos">📁 Projetos</a>' +
      '<input class="ia-lat-busca" type="search" placeholder="Buscar conversas" value="' + esc(mem.busca) + '" data-ia="buscar" aria-label="Buscar conversas">' +
      '<nav class="ia-lista">' + (lista.length ? S.agrupar(lista).map(function (g) { return '<p class="ia-grupo">' + esc(g.t) + '</p>' + g.l.map(function (c) { return '<a href="#/ia/c/' + c.id + '" class="' + (c.id === ativa ? 'ativa' : '') + '" title="' + esc(c.titulo) + '">' + (c.projeto ? '<span class="ia-pj-ic">📁</span>' : '') + esc(c.titulo) + '</a>'; }).join(''); }).join('') : '<p class="mudo mini">' + (mem.busca ? 'Nada encontrado.' : 'Suas conversas aparecem aqui.') + '</p>') + '</nav>' +
      '<button type="button" class="ia-lat-cfg" data-ia="config">⚙ Configurar chave da API' + (chave() ? ' ✓' : '') + '</button>' +
      '</aside>';
  }

  // ---------- telas ----------
  function casca(el, ativa, miolo) {
    el.innerHTML = '<div class="ia-app">' + lateralHTML(ativa) + '<section class="ia-main"><button type="button" class="ia-abrir-lat" data-ia="lateral" aria-label="Conversas">☰ Conversas</button>' + miolo + '</section></div>';
    ligar(el);
  }
  function telaInicio(el, projId) {
    mem.id = null; mem.msgs = []; mem.editando = -1;
    const p = projId && projeto(projId);
    casca(el, null, '<div class="ia-boas">' +
      (p ? '<a class="ia-pj-tag" href="#/ia/p/' + p.id + '">📁 ' + esc(p.nome) + '</a>' : '') +
      '<h1><span class="ia-logo">7</span> ' + esc(saudacao()) + '</h1>' +
      (!chave() ? '<div class="ia-aviso-chave"><p>Para conversar, cadastre uma chave da API da Anthropic. Ela fica só neste navegador.</p><button type="button" class="btn primario" data-ia="config">Cadastrar chave</button></div>' : '') +
      compositorHTML(null) +
      '<div class="ia-atalhos">' + S.ATALHOS.map(function (a, i) { return '<button type="button" data-ia="atalho" data-i="' + i + '">' + a.ic + ' ' + esc(a.t) + '</button>'; }).join('') + '</div>' +
      '<p class="ia-rodape mudo mini">A Seven.ia pode errar. Confira prazos, valores e artigos de lei no edital e na norma antes de agir.</p></div>');
    const t = el.querySelector('.ia-comp textarea'); if (t) { autoAltura(t); t.focus(); }
    el.querySelector('.ia-comp').dataset.projeto = projId || '';
  }
  function desenharConversa() {
    const el = document.getElementById('conteudo'); const conv = conversa(mem.id); if (!conv || !quandoRedesenhar(conv.id)) return;
    const rascunho = el.querySelector('.ia-comp textarea'); if (rascunho) mem.rascunho = rascunho.value;
    const p = conv.projeto && projeto(conv.projeto);
    casca(el, conv.id, '<header class="ia-topo">' + (p ? '<a class="ia-pj-tag" href="#/ia/p/' + p.id + '">📁 ' + esc(p.nome) + '</a>' : '') +
      '<button type="button" class="ia-titulo" data-ia="renomear" title="Renomear">' + esc(conv.titulo) + '</button>' +
      '<span class="ia-custo" title="Estimativa pelo preço de tabela, sem o custo das pesquisas na web">' + (conv.custo ? '≈ ' + S.dolar(conv.custo) : '') + (conv.uso && conv.uso.buscas ? ' · ' + conv.uso.buscas + ' pesquisa' + (conv.uso.buscas > 1 ? 's' : '') : '') + '</span>' +
      '<button type="button" class="ia-ico" data-ia="fixar" title="' + (conv.fixada ? 'Desafixar' : 'Fixar') + '" aria-pressed="' + !!conv.fixada + '">' + (conv.fixada ? '📌' : '📍') + '</button>' +
      '<button type="button" class="ia-ico" data-ia="exportar" title="Baixar em Markdown">⤓</button>' +
      '<button type="button" class="ia-ico" data-ia="excluir" title="Excluir conversa">🗑</button></header>' +
      '<div class="ia-rolagem"><div class="ia-fio">' + mem.msgs.map(function (m, i) { return mensagemHTML(m, i, conv); }).join('') + (mem.enviando && mem.enviando.id === conv.id ? aoVivoHTML() : '') + '</div></div>' +
      '<div class="ia-base">' + compositorHTML(conv) + '<p class="mudo mini">A Seven.ia pode errar. Confira no edital e na norma.</p></div>');
    const rol = el.querySelector('.ia-rolagem'); rol.scrollTop = rol.scrollHeight;
    const t = el.querySelector('.ia-comp textarea'); autoAltura(t); if (mem.editando < 0) t.focus({ preventScroll: true });
  }
  function telaConversa(el, id) {
    const conv = conversa(id); if (!conv) { casca(el, null, UI.vazio('Conversa não encontrada', 'Ela pode ter sido excluída.', '<a class="btn" href="#/ia">Nova conversa</a>')); return; }
    if (mem.id !== id || mem.carregando) {
      casca(el, id, '<div class="ia-carregando">Abrindo conversa…</div>');
      if (mem.id !== id) { mem.rascunho = ''; mem.anexos = []; }
      abrirConversa(id).then(function () { if (quandoRedesenhar(id)) desenharConversa(); }); return;
    }
    desenharConversa();
  }

  function telaProjetos(el) {
    const ps = e().projetos.slice().sort(function (a, b) { return (b.editadoEm || 0) - (a.editadoEm || 0); });
    casca(el, null, '<div class="ia-pjs"><header><div><h1>Projetos</h1><p class="mudo">Um projeto guarda instruções e documentos que entram em todas as conversas dele. Ex.: um por cliente, ou um para recursos.</p></div><button type="button" class="btn primario" data-ia="novo-projeto">＋ Novo projeto</button></header>' +
      (ps.length ? '<div class="ia-pjs-grade">' + ps.map(function (p) { const n = e().conversas.filter(function (c) { return c.projeto === p.id; }).length; return '<a class="ia-pj-card" href="#/ia/p/' + p.id + '"><b>📁 ' + esc(p.nome) + '</b><p>' + esc(p.descricao || 'Sem descrição') + '</p><small>' + n + ' conversa' + (n === 1 ? '' : 's') + ' · ' + ((p.fontes || []).length + (p.cadernos || []).length) + ' fonte' + (((p.fontes || []).length + (p.cadernos || []).length) === 1 ? '' : 's') + '</small></a>'; }).join('') + '</div>'
        : UI.vazio('Nenhum projeto ainda', 'Crie um projeto para cada cliente e anexe o contrato social, atestados e editais que ele costuma disputar.')) + '</div>');
  }
  function telaProjeto(el, id) {
    const p = projeto(id); if (!p) { location.hash = '#/ia/projetos'; return; }
    const convs = e().conversas.filter(function (c) { return c.projeto === p.id; }).sort(function (a, b) { return b.editadaEm - a.editadaEm; });
    const cads = (Dados.e.cadernos || []);
    casca(el, null, '<div class="ia-pj"><a class="mudo mini" href="#/ia/projetos">‹ Projetos</a><header><h1>📁 ' + esc(p.nome) + '</h1><button type="button" class="btn fantasma" data-ia="editar-projeto">Editar</button><button type="button" class="btn fantasma" data-ia="excluir-projeto">Excluir</button></header>' +
      (p.descricao ? '<p class="mudo">' + esc(p.descricao) + '</p>' : '') +
      '<div class="ia-pj-cols"><div>' + compositorHTML(null) +
      '<h3>Conversas</h3>' + (convs.length ? '<ul class="ia-pj-convs">' + convs.map(function (c) { return '<li><a href="#/ia/c/' + c.id + '"><b>' + esc(c.titulo) + '</b><small>' + new Date(c.editadaEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + '</small></a></li>'; }).join('') + '</ul>' : '<p class="mudo">Comece uma conversa acima; ela usará as instruções e as fontes do projeto.</p>') + '</div>' +
      '<aside class="ia-pj-lado"><section><h3>Instruções</h3><p class="ia-pj-instr">' + (p.instrucoes ? esc(p.instrucoes).replace(/\n/g, '<br>') : '<span class="mudo">Nenhuma. Ex.: "Responda sempre com tabela de prazos" ou "O cliente é ME e usa o benefício da LC 123".</span>') + '</p></section>' +
      '<section><h3>Fontes</h3><ul class="ia-pj-fontes">' + (p.fontes || []).map(function (f) { return '<li>📄 ' + esc(f.nome) + ' <small>' + (f.tam < 1000 ? f.tam + ' caracteres' : Math.round(f.tam / 1000) + ' mil caracteres') + '</small><button type="button" class="ia-acao" data-ia="tirar-fonte" data-id="' + f.id + '" aria-label="Remover fonte ' + esc(f.nome) + '">×</button></li>'; }).join('') +
      (p.cadernos || []).map(function (cid) { const c = cads.find(function (x) { return x.id === cid; }); return c ? '<li>📒 Seven Synapse: ' + esc(c.titulo) + ' <small>' + c.fontes.length + ' fonte' + (c.fontes.length === 1 ? '' : 's') + '</small><button type="button" class="ia-acao" data-ia="tirar-caderno" data-id="' + cid + '" aria-label="Desvincular caderno">×</button></li>' : ''; }).join('') + '</ul>' +
      '<div class="ia-pj-bts"><button type="button" class="btn mini" data-ia="fonte-arquivo">＋ Arquivo</button><button type="button" class="btn mini" data-ia="fonte-texto">＋ Texto</button>' + (cads.length ? '<button type="button" class="btn mini" data-ia="fonte-caderno">＋ Caderno do Synapse</button>' : '') + '</div>' +
      '<p class="mudo mini">As fontes vão inteiras em cada pergunta; o cache da API barateia as repetições.</p></section></aside></div></div>');
    el.querySelector('.ia-comp').dataset.projeto = p.id;
  }

  // ---------- modais ----------
  async function configurar(obrigatorio) {
    const r = await modal({ titulo: 'Chave da API da Anthropic', botao: 'Salvar',
      corpo: (obrigatorio ? '<p>Para usar a Seven.ia, informe uma chave da API.</p>' : '') +
        campo('Chave', '<input name="chave" type="password" autocomplete="off" placeholder="sk-ant-…" value="' + esc(chave()) + '">', 'Crie em console.anthropic.com → API Keys. Defina um limite de gasto mensal no console.') +
        '<p class="mini mudo">A chave fica guardada só neste navegador (não entra no backup) e é enviada direto à Anthropic. Quem usar este computador pode vê-la: use uma chave só para a Seven.ia e revogue se o aparelho for compartilhado.</p>' +
        (chave() ? '<p><button type="button" class="btn fantasma mini" data-esquecer>Esquecer a chave</button></p>' : ''),
      aoAbrir: function (f) { const b = f.querySelector('[data-esquecer]'); if (b) b.onclick = function () { f.chave.value = ''; }; },
      validar: function (fd) { const v = String(fd.get('chave') || '').trim(); return v && !/^sk-ant-/.test(v) ? 'A chave da Anthropic começa com "sk-ant-".' : ''; } });
    if (!r) return;
    const v = String(r.get('chave') || '').trim();
    try { if (v) localStorage.setItem(CHAVE, v); else localStorage.removeItem(CHAVE); } catch (x) { aviso('Não foi possível guardar a chave neste navegador.', 'erro'); return; }
    aviso(v ? 'Chave salva.' : 'Chave removida.'); App.redesenhar();
  }
  async function editarProjeto(p) {
    const r = await modal({ titulo: p ? 'Editar projeto' : 'Novo projeto', largo: true, botao: p ? 'Salvar' : 'Criar',
      corpo: campo('Nome *', '<input name="nome" required value="' + esc(p ? p.nome : '') + '">') + campo('Descrição', '<input name="descricao" value="' + esc(p ? p.descricao || '' : '') + '">') +
        campo('Instruções', '<textarea name="instrucoes" rows="6" placeholder="Como a Seven.ia deve responder neste projeto">' + esc(p ? p.instrucoes || '' : '') + '</textarea>') });
    if (!r) return null;
    const x = p || { id: Dados.id('iap'), fontes: [], cadernos: [] };
    x.nome = String(r.get('nome')).trim(); x.descricao = String(r.get('descricao') || '').trim(); x.instrucoes = String(r.get('instrucoes') || '').trim(); x.editadoEm = Date.now();
    if (!p) e().projetos.push(x); Dados.salvar(); return x;
  }
  async function guardarFonte(p, nome, texto) {
    const id = Dados.id('iaf'); const arq = 'ia-fonte-' + id;
    await Dados.guardarArquivo(arq, new Blob([texto], { type: 'text/plain' }));
    p.fontes = p.fontes || []; p.fontes.push({ id: id, nome: nome, arq: arq, tam: texto.length }); p.editadoEm = Date.now(); Dados.salvar();
  }

  // ---------- eventos ----------
  function ligar(el) {
    const comp = el.querySelector('.ia-comp');
    if (comp) {
      const t = comp.querySelector('textarea');
      t.addEventListener('input', function () { autoAltura(t); mem.rascunho = t.value; });
      t.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); comp.requestSubmit(); } });
      t.addEventListener('paste', function (ev) { const fs = Array.prototype.filter.call((ev.clipboardData && ev.clipboardData.files) || [], function (f) { return /^image\//.test(f.type); }); if (fs.length) { ev.preventDefault(); anexar(fs); } });
      comp.addEventListener('dragover', function (ev) { ev.preventDefault(); comp.classList.add('soltar'); });
      comp.addEventListener('dragleave', function () { comp.classList.remove('soltar'); });
      comp.addEventListener('drop', function (ev) { ev.preventDefault(); comp.classList.remove('soltar'); anexar(Array.prototype.slice.call(ev.dataTransfer.files)); });
      comp.addEventListener('submit', function (ev) { ev.preventDefault(); if (mem.enviando) return; const txt = t.value; novaPergunta(txt, comp.dataset.projeto || null); });
    }
    el.onchange = function (ev) {
      const a = ev.target.dataset.ia;
      if (a === 'modelo') { e().pref.modelo = ev.target.value; const c = mem.id && conversa(mem.id); if (c && quandoRedesenhar(c.id)) c.modelo = ev.target.value; Dados.salvar(); redesenharMantendo(); }
      if (a === 'esforco') { e().pref.esforco = ev.target.value; Dados.salvar(); }
    };
    el.oninput = function (ev) {
      if (ev.target.dataset.ia === 'buscar') { mem.busca = ev.target.value; const nav = el.querySelector('.ia-lista'); const tmp = document.createElement('div'); tmp.innerHTML = lateralHTML(mem.id); nav.innerHTML = tmp.querySelector('.ia-lista').innerHTML; }
    };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-ia]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT' || b.tagName === 'FORM') return;
      const a = b.dataset.ia; const conv = mem.id && conversa(mem.id); const i = +b.dataset.i;
      if (a === 'config') return configurar(false);
      if (a === 'lateral') { mem.lateral = !mem.lateral; el.querySelector('.ia-lat').classList.toggle('aberta', mem.lateral); return; }
      if (a === 'anexar') { const fs = await UI.escolherArquivo('.pdf,.docx,.txt,.md,.csv,.json,.xml,.html,image/png,image/jpeg,image/gif,image/webp', true); if (fs && fs.length) anexar(fs); return; }
      if (a === 'tirar-anexo') { mem.anexos.splice(i, 1); desenharChips(); return; }
      if (a === 'tog') { const k = b.dataset.k; e().pref[k] = !e().pref[k]; Dados.salvar(); b.classList.toggle('on', e().pref[k]); b.setAttribute('aria-pressed', e().pref[k]); if (k === 'contexto' && e().pref[k]) aviso('As próximas perguntas levam um resumo dos seus clientes, agenda da semana, licitações e documentos vencendo.'); return; }
      if (a === 'atalho') { const t = el.querySelector('.ia-comp textarea'); t.value = S.ATALHOS[i].p; mem.rascunho = t.value; autoAltura(t); t.focus(); t.setSelectionRange(t.value.length, t.value.length); return; }
      if (a === 'parar') { if (mem.enviando && mem.enviando.stream) { mem.enviando.parado = true; mem.enviando.stream.abort(); } return; }
      if (a === 'copiar-codigo') { copiar(b.closest('.ia-codigo').querySelector('code').textContent, b); return; }
      if (a === 'copiar') { copiar(S.textoDe(mem.msgs[i].content), b); return; }
      if (a === 'nota') { salvarNota(mem.msgs[i], conv); return; }
      if (a === 'regenerar' || a === 'tentar') { if (mem.enviando || !conv) return; while (mem.msgs.length && mem.msgs[mem.msgs.length - 1].role === 'assistant') mem.msgs.pop(); await gravarMsgs(conv.id, mem.msgs); enviar(conv); return; }
      if (a === 'continuar') { if (mem.enviando || !conv) return; mem.msgs.push(S.mensagemUsuario('Continue exatamente de onde parou.')); await gravarMsgs(conv.id, mem.msgs); enviar(conv); return; }
      if (a === 'editar') { mem.editando = i; desenharConversa(); const t = el.querySelector('.ia-msg.editando textarea'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); return; }
      if (a === 'cancelar-edicao') { mem.editando = -1; desenharConversa(); return; }
      if (a === 'renomear' && conv) { const r = await modal({ titulo: 'Renomear conversa', corpo: campo('Título', '<input name="t" required value="' + esc(conv.titulo) + '">') }); if (r) { conv.titulo = String(r.get('t')).trim() || conv.titulo; Dados.salvar(); desenharConversa(); } return; }
      if (a === 'fixar' && conv) { conv.fixada = !conv.fixada; Dados.salvar(); desenharConversa(); return; }
      if (a === 'exportar' && conv) { UI.baixar(conv.titulo.replace(/[\\/:*?"<>|]+/g, ' ').trim() + '.md', S.exportarMarkdown(conv, mem.msgs), 'text/markdown;charset=utf-8'); return; }
      if (a === 'excluir' && conv) { if (await confirmar('Excluir conversa', 'Excluir <b>' + esc(conv.titulo) + '</b>? Não dá para desfazer.', 'Excluir')) { if (mem.enviando && mem.enviando.id === conv.id && mem.enviando.stream) { mem.enviando.parado = true; mem.enviando.stream.abort(); } await Dados.apagarArquivo('ia-msg-' + conv.id); e().conversas = e().conversas.filter(function (c) { return c !== conv; }); Dados.salvar(); mem.id = null; location.hash = conv.projeto ? '#/ia/p/' + conv.projeto : '#/ia'; } return; }
      // projetos
      const r = App.rota(); const p = r.sub === 'p' && projeto(r.param);
      if (a === 'novo-projeto') { const x = await editarProjeto(null); if (x) location.hash = '#/ia/p/' + x.id; return; }
      if (a === 'editar-projeto' && p) { if (await editarProjeto(p)) App.redesenhar(); return; }
      if (a === 'excluir-projeto' && p) { if (await confirmar('Excluir projeto', 'Excluir <b>' + esc(p.nome) + '</b> e suas fontes? As conversas continuam, sem o projeto.', 'Excluir')) { for (const f of (p.fontes || [])) await Dados.apagarArquivo(f.arq); e().conversas.forEach(function (c) { if (c.projeto === p.id) c.projeto = null; }); e().projetos = e().projetos.filter(function (x) { return x !== p; }); Dados.salvar(); location.hash = '#/ia/projetos'; } return; }
      if (a === 'fonte-arquivo' && p) { const fs = await UI.escolherArquivo('.pdf,.docx,.txt,.md,.csv,.html', true); for (const f of (fs || [])) { try { const t = await textoDoArquivo(f); if (!t.trim()) { aviso(f.name + ' não tem texto legível (PDF escaneado?).', 'erro'); continue; } await guardarFonte(p, f.name, t); } catch (x) { aviso('Não consegui ler ' + f.name + ': ' + x.message, 'erro'); } } App.redesenhar(); return; }
      if (a === 'fonte-texto' && p) { const m = await modal({ titulo: 'Colar texto', largo: true, corpo: campo('Nome *', '<input name="nome" required>') + campo('Texto *', '<textarea name="texto" rows="10" required></textarea>') }); if (m) { await guardarFonte(p, String(m.get('nome')).trim(), String(m.get('texto'))); App.redesenhar(); } return; }
      if (a === 'fonte-caderno' && p) { const cads = (Dados.e.cadernos || []).filter(function (c) { return (p.cadernos || []).indexOf(c.id) < 0; }); if (!cads.length) { aviso('Todos os cadernos já estão vinculados.'); return; } const m = await modal({ titulo: 'Vincular caderno', corpo: campo('Caderno', '<select name="c">' + opcoes(cads.map(function (c) { return { v: c.id, t: c.titulo + ' (' + c.fontes.length + ' fontes)' }; })) + '</select>', 'As fontes ativas do caderno entram em cada conversa do projeto.') }); if (m) { p.cadernos = p.cadernos || []; p.cadernos.push(m.get('c')); Dados.salvar(); App.redesenhar(); } return; }
      if (a === 'tirar-fonte' && p) { const f = p.fontes.find(function (x) { return x.id === b.dataset.id; }); await Dados.apagarArquivo(f.arq); p.fontes = p.fontes.filter(function (x) { return x !== f; }); Dados.salvar(); App.redesenhar(); return; }
      if (a === 'tirar-caderno' && p) { p.cadernos = p.cadernos.filter(function (x) { return x !== b.dataset.id; }); Dados.salvar(); App.redesenhar(); return; }
    };
    el.onsubmit = async function (ev) {
      const f = ev.target; if (f.dataset.ia !== 'salvar-edicao') return; ev.preventDefault();
      const conv = conversa(mem.id); const i = +f.dataset.i; const m = mem.msgs[i]; const novo = f.t.value;
      if (!novo.trim() || mem.enviando) return;
      const cont = m.content.filter(function (b) { return b.type !== 'text'; }); cont.push({ type: 'text', text: novo });
      mem.msgs = mem.msgs.slice(0, i).concat([{ role: 'user', content: cont, nomes: m.nomes, em: Date.now() }]); mem.editando = -1;
      await gravarMsgs(conv.id, mem.msgs); enviar(conv);
    };
  }
  function redesenharMantendo() { if (mem.id && quandoRedesenhar(mem.id)) desenharConversa(); else { const t = document.querySelector('.ia-comp textarea'); if (t) mem.rascunho = t.value; App.redesenhar(); } }
  function copiar(texto, b) {
    const ok = function () { const o = b.textContent; b.textContent = '✓ Copiado'; setTimeout(function () { b.textContent = o; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok, function () { aviso('Não consegui copiar.', 'erro'); }); else aviso('Copiar não é permitido neste navegador.', 'erro');
  }
  function salvarNota(m, conv) {
    const d = Dados.e; d.anotacoes = d.anotacoes || {}; d.anotacoes.notas = d.anotacoes.notas || [];
    const html = S.markdown(S.textoDe(m.content)).replace(/<div class="ia-codigo-topo">.*?<\/div>/g, '') + '<p><small>Seven.ia · ' + esc(conv ? conv.titulo : '') + '</small></p>';
    d.anotacoes.notas.push({ id: Dados.id('an'), titulo: conv ? conv.titulo : 'Seven.ia', html: html, tracos: [], fundo: 'liso', cor: '', pasta: null, criadaEm: Date.now(), editadaEm: Date.now() });
    Dados.salvar(); aviso('Salvo em Anotações.');
  }

  Telas.ia = {
    titulo: 'Seven.ia',
    // Abre uma conversa nova com a pergunta já escrita (o usuário revisa, anexa o edital e envia).
    perguntar: function (texto) { mem.id = null; mem.msgs = []; mem.anexos = []; mem.rascunho = texto || ''; location.hash = '#/ia'; App.redesenhar(); },
    render: function (el, sub, param) {
      mem.lateral = false;
      if (sub === 'c' && param) return telaConversa(el, param);
      if (sub === 'projetos') return telaProjetos(el);
      if (sub === 'p' && param) return telaProjeto(el, param);
      telaInicio(el, null);
    }
  };
})();
