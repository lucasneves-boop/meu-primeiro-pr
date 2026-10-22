/* Seven.ai: assistente estilo claude.ai sobre a API da Anthropic. Aqui só a parte pura: modelos, montagem da
   requisição, histórico para a API (eco correto de blocos), markdown seguro, fontes, custo e contexto do app. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.SevenAI = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.132.0/+esm';

  // Preços em US$ por milhão de tokens (tabela da Anthropic, out/2026). cr = leitura de cache.
  // busca: versão da ferramenta de pesquisa na web confirmada para o modelo (null = não oferecer).
  // fallback: o servidor refaz no modelo recomendado se o pedido for recusado pelos filtros (Haiku não tem).
  const MODELOS = [
    { id: 'claude-opus-5-5', nome: 'Opus 5.5', desc: 'Padrão. Análise de edital, peças e raciocínio.', preco: { in: 4, out: 20, cr: 0.2 }, busca: 'web_search_20260209', fallback: true },
    { id: 'claude-sonnet-5-5', nome: 'Sonnet 5.5', desc: 'Rápido e capaz para o dia a dia.', preco: { in: 2, out: 10, cr: 0.2 }, busca: 'web_search_20260209', fallback: true },
    { id: 'claude-haiku-5-5', nome: 'Haiku 5.5', desc: 'O mais barato, para tarefas simples.', preco: { in: 0.1, out: 0.5, cr: null }, busca: null, fallback: false },
    { id: 'claude-fable-5-1', nome: 'Fable 5.1', desc: 'O mais capaz. Mais caro e mais lento.', preco: { in: 10, out: 50, cr: 0.25 }, busca: null, fallback: true }
  ];
  const PADRAO = 'claude-opus-5-5';
  const ESFORCOS = [
    { id: 'low', t: 'Rápido' }, { id: 'medium', t: 'Equilibrado' }, { id: 'high', t: 'Profundo' }, { id: 'max', t: 'Máximo' }
  ];
  function modelo(id) { return MODELOS.find(function (m) { return m.id === id; }) || MODELOS[0]; }

  const SISTEMA = [
    'Você é o Seven.ai, assistente da Seven, BPO de Licitações: terceirização completa do departamento de licitações, do edital ao pagamento, para empresas que vendem ou querem vender ao poder público. Fundador: Lucas Neves. Atendimento presencial em Catalão-GO, sede em Brasília-DF.',
    'Domínio: Lei 14.133/2021, LC 123/2006, Lei 4.320/1964, editais, PNCP, Compras.gov.br, BLL, SISLOG-GO, habilitação, SICAF, certidões, propostas, sessões de lance, recursos, contratos, empenho e pagamento.',
    'Responda em português do Brasil, direto e objetivo, sem enrolação. Use markdown quando ajudar (listas, tabelas, títulos curtos).',
    'Cite o artigo da lei quando afirmar uma regra. Se não tiver certeza de um número, prazo ou dispositivo, diga que precisa conferir em vez de inventar. Prazos e exigências de um edital específico devem ser conferidos no próprio edital.',
    'A Seven não tem site: nunca invente link, site ou e-mail da Seven. Contato: (61) 98347-2232. Atendimento: seg a sex 9h às 18h, sábado até 12h.',
    'Mensagens para clientes ou leads (WhatsApp, e-mail) são sempre rascunhos para o Lucas revisar antes de enviar; assine "Lucas Neves | Seven".',
    'Peças jurídicas (impugnação, recurso, contrarrazão) saem como minuta para revisão de quem assina.'
  ].join('\n');

  const ATALHOS = [
    { ic: '📄', t: 'Analisar edital', p: 'Analise o edital anexo e me entregue: objeto, órgão, modalidade e critério de julgamento, data e portal da sessão, exigências de habilitação (jurídica, fiscal, técnica, econômica), prazos de impugnação e esclarecimento, garantia, amostra, prazo de entrega e pagamento, penalidades e os pontos de risco. Indique a página ou item de cada informação.' },
    { ic: '⚖️', t: 'Minuta de impugnação', p: 'Monte uma minuta de impugnação ao edital com base nos fatos abaixo, citando a Lei 14.133/2021 e jurisprudência do TCU apenas se tiver certeza do número do acórdão.\n\nFatos: ' },
    { ic: '🛡️', t: 'Recurso / contrarrazão', p: 'Preciso de uma minuta de recurso administrativo (Lei 14.133, art. 165). Situação: ' },
    { ic: '💬', t: 'Mensagem para cliente', p: 'Escreva uma mensagem de WhatsApp para o cliente, curta e cordial, sobre: ' },
    { ic: '🧮', t: 'Formação de preço', p: 'Me ajude a formar o preço de venda para disputa. Custo do produto, frete, impostos e margem desejada: ' },
    { ic: '📋', t: 'Checklist de habilitação', p: 'Liste os documentos de habilitação normalmente exigidos (Lei 14.133, arts. 62 a 70) para o objeto abaixo e o que costuma reprovar empresas. Objeto: ' }
  ];

  // ---------- requisição ----------
  function blocosSistema(o) {
    o = o || {};
    const partes = [SISTEMA];
    if (o.data) partes.push('Hoje é ' + o.data + '.');
    if (o.projeto && o.projeto.instrucoes) partes.push('Instruções do projeto "' + o.projeto.nome + '":\n' + o.projeto.instrucoes);
    if (o.fontes && o.fontes.length) partes.push('Documentos de referência do projeto. Use-os como base e diga quando a resposta vier deles:\n\n' + o.fontes.map(function (f) { return '<documento nome="' + String(f.nome).replace(/"/g, "'") + '">\n' + f.texto + '\n</documento>'; }).join('\n\n'));
    if (o.contextoApp) partes.push('Dados atuais do Seven Licita (do próprio usuário):\n' + o.contextoApp);
    return partes.join('\n\n');
  }

  // Blocos que a API devolveu e precisam voltar sem alteração; após um fallback no meio da resposta, o que veio
  // antes do último bloco "fallback" só volta se for texto ou ferramenta de servidor com resultado.
  function paraEco(content) {
    if (!Array.isArray(content)) return content;
    let ult = -1; content.forEach(function (b, i) { if (b && b.type === 'fallback') ult = i; });
    const resultados = {}; content.forEach(function (b) { if (b && /_tool_result$/.test(b.type) && b.tool_use_id) resultados[b.tool_use_id] = 1; });
    return content.filter(function (b, i) {
      if (!b || b.type === 'fallback') return false;
      if (i < ult) {
        if (b.type === 'text') return true;
        if (b.type === 'server_tool_use') return !!resultados[b.id];
        return /_tool_result$/.test(b.type);
      }
      return true;
    });
  }

  function historicoAPI(mensagens) {
    const out = [];
    (mensagens || []).forEach(function (m) {
      if (m.role === 'user') out.push({ role: 'user', content: m.content });
      else if (m.role === 'assistant' && !m.recusa && m.content && m.content.length) {
        const c = paraEco(m.content); if (c.length) out.push({ role: 'assistant', content: c });
      }
    });
    return out;
  }

  function montarRequisicao(mensagens, o) {
    o = o || {}; const m = modelo(o.modelo);
    const r = {
      model: m.id, max_tokens: 64000,
      system: blocosSistema(o),
      messages: historicoAPI(mensagens),
      cache_control: { type: 'ephemeral' },
      output_config: { effort: o.esforco || 'medium' }
    };
    if (o.raciocinio) r.thinking = { type: 'adaptive', display: 'summarized' };
    if (o.busca && m.busca) r.tools = [{ type: m.busca, name: 'web_search', max_uses: 5 }];
    if (m.fallback) { r.betas = ['server-side-fallback-2026-07-01']; r.fallbacks = 'default'; }
    return r;
  }

  // ---------- leitura da resposta ----------
  function textoDe(content) { return (content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join(''); }
  function raciocinioDe(content) { return (content || []).filter(function (b) { return b.type === 'thinking' && b.thinking; }).map(function (b) { return b.thinking; }).join('\n\n'); }
  function buscasDe(content) { return (content || []).filter(function (b) { return b.type === 'server_tool_use' && b.name === 'web_search'; }).map(function (b) { return (b.input && b.input.query) || ''; }); }
  function fontesDe(content) {
    const vistas = {}; const lista = [];
    function add(url, titulo) { if (!/^https?:\/\//i.test(url || '') || vistas[url]) return; vistas[url] = 1; lista.push({ url: url, titulo: titulo || url }); }
    (content || []).forEach(function (b) {
      if (b.type === 'text' && b.citations) b.citations.forEach(function (c) { if (c.url) add(c.url, c.title); });
    });
    (content || []).forEach(function (b) {
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) b.content.forEach(function (x) { if (x.type === 'web_search_result') add(x.url, x.title); });
    });
    return lista;
  }
  function erroBusca(content) { const b = (content || []).find(function (x) { return x.type === 'web_search_tool_result' && x.content && !Array.isArray(x.content); }); return b ? (b.content.error_code || 'erro') : null; }

  // ---------- custo ----------
  function somarUso(a, b) {
    a = Object.assign({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, buscas: 0 }, a || {});
    if (!b) return a;
    ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'].forEach(function (k) { a[k] += b[k] || 0; });
    a.buscas += (b.server_tool_use && b.server_tool_use.web_search_requests) || b.buscas || 0;
    return a;
  }
  // Estimativa em US$ (sem o custo por pesquisa na web). Escrita em cache = 1,25 × entrada.
  function custo(uso, idModelo) {
    if (!uso) return 0; const p = modelo(idModelo).preco;
    const cr = p.cr == null ? p.in * 0.1 : p.cr;
    return ((uso.input_tokens || 0) * p.in + (uso.output_tokens || 0) * p.out + (uso.cache_read_input_tokens || 0) * cr + (uso.cache_creation_input_tokens || 0) * p.in * 1.25) / 1e6;
  }
  function dolar(v) { return 'US$ ' + (v < 0.01 && v > 0 ? v.toFixed(4) : v.toFixed(2)).replace('.', ','); }

  // ---------- markdown seguro ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inline(t) {
    const cod = [];
    t = t.replace(/`([^`\n]+)`/g, function (_, c) { cod.push(c); return '\u0000' + (cod.length - 1) + '\u0000'; });
    t = esc(t);
    t = t.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, function (_, txt, url) { return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + txt + '</a>'; });
    t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>').replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    return t.replace(/\u0000(\d+)\u0000/g, function (_, i) { return '<code>' + esc(cod[+i]) + '</code>'; });
  }
  function celulas(l) { return l.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); }
  function markdown(texto) {
    const linhas = String(texto || '').replace(/\r/g, '').split('\n'); const out = []; let i = 0;
    while (i < linhas.length) {
      const l = linhas[i];
      let m = l.match(/^```\s*([\w+-]*)/);
      if (m) {
        const cod = []; i++; while (i < linhas.length && !/^```/.test(linhas[i])) cod.push(linhas[i++]); i++;
        out.push('<div class="ia-codigo"><div class="ia-codigo-topo"><span>' + esc(m[1] || 'texto') + '</span><button type="button" data-ia="copiar-codigo">Copiar</button></div><pre><code>' + esc(cod.join('\n')) + '</code></pre></div>'); continue;
      }
      if ((m = l.match(/^(#{1,4})\s+(.*)/))) { const n = Math.min(6, m[1].length + 2); out.push('<h' + n + '>' + inline(m[2]) + '</h' + n + '>'); i++; continue; }
      if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < linhas.length && /^\s*\|?\s*:?-{2,}/.test(linhas[i + 1])) {
        const cab = celulas(l); i += 2; const corpo = [];
        while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) corpo.push(celulas(linhas[i++]));
        out.push('<div class="ia-tabela"><table><thead><tr>' + cab.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + corpo.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'); continue;
      }
      if (/^>\s?/.test(l)) { const q = []; while (i < linhas.length && /^>\s?/.test(linhas[i])) q.push(linhas[i++].replace(/^>\s?/, '')); out.push('<blockquote>' + markdown(q.join('\n')) + '</blockquote>'); continue; }
      if ((m = l.match(/^\s*([-*+]|\d+[.)])\s+/))) {
        const ord = /\d/.test(m[1]); const itens = []; const re = ord ? /^\s*\d+[.)]\s+(.*)/ : /^\s*[-*+]\s+(.*)/;
        while (i < linhas.length && re.test(linhas[i])) {
          let it = linhas[i].match(re)[1]; i++;
          while (i < linhas.length && /^\s{2,}\S/.test(linhas[i]) && !re.test(linhas[i])) it += ' ' + linhas[i++].trim();
          const ck = it.match(/^\[([ xX])\]\s+(.*)/);
          itens.push(ck ? '<li class="ck"><input type="checkbox" disabled' + (ck[1] !== ' ' ? ' checked' : '') + '> ' + inline(ck[2]) + '</li>' : '<li>' + inline(it) + '</li>');
        }
        out.push((ord ? '<ol>' : '<ul>') + itens.join('') + (ord ? '</ol>' : '</ul>')); continue;
      }
      if (!l.trim()) { i++; continue; }
      const p = []; while (i < linhas.length && linhas[i].trim() && !/^(```|#{1,4}\s|>|\s*([-*+]|\d+[.)])\s+|\s*\|.*\|\s*$)/.test(linhas[i])) p.push(linhas[i++]);
      if (!p.length) p.push(linhas[i++]);
      out.push('<p>' + p.map(inline).join('<br>') + '</p>');
    }
    return out.join('');
  }

  // ---------- conversas ----------
  function tituloDe(texto) {
    const l = String(texto || '').replace(/\s+/g, ' ').trim(); if (!l) return 'Nova conversa';
    if (l.length <= 48) return l;
    const corte = l.slice(0, 48); const esp = corte.lastIndexOf(' ');
    return (esp > 24 ? corte.slice(0, esp) : corte) + '…';
  }
  function semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function buscar(conversas, termo) {
    const t = semAcento(termo).trim(); if (!t) return conversas.slice();
    return conversas.filter(function (c) { return semAcento(c.titulo + ' ' + (c.resumo || '')).indexOf(t) >= 0; });
  }
  function agrupar(conversas, agora) {
    const d0 = new Date(agora || Date.now()); d0.setHours(0, 0, 0, 0); const hoje = d0.getTime();
    const g = [{ t: 'Fixadas', l: [] }, { t: 'Hoje', l: [] }, { t: 'Ontem', l: [] }, { t: 'Últimos 7 dias', l: [] }, { t: 'Últimos 30 dias', l: [] }, { t: 'Mais antigas', l: [] }];
    conversas.slice().sort(function (a, b) { return b.editadaEm - a.editadaEm; }).forEach(function (c) {
      const k = c.fixada ? 0 : c.editadaEm >= hoje ? 1 : c.editadaEm >= hoje - 864e5 ? 2 : c.editadaEm >= hoje - 7 * 864e5 ? 3 : c.editadaEm >= hoje - 30 * 864e5 ? 4 : 5;
      g[k].l.push(c);
    });
    return g.filter(function (x) { return x.l.length; });
  }

  // ---------- anexos ----------
  const IMAGENS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  function tipoAnexo(nome, mime) {
    if (IMAGENS.indexOf(mime) >= 0) return 'imagem';
    if (mime === 'application/pdf' || /\.pdf$/i.test(nome)) return 'pdf';
    if (/\.docx$/i.test(nome)) return 'docx';
    if (/^text\//.test(mime || '') || /\.(txt|md|csv|json|xml|html?)$/i.test(nome)) return 'texto';
    return null;
  }
  // a = { nome, tipo: 'imagem'|'pdf'|'texto', mime, dados (base64) | texto }
  function blocoAnexo(a) {
    if (a.tipo === 'imagem') return { type: 'image', source: { type: 'base64', media_type: a.mime, data: a.dados } };
    if (a.tipo === 'pdf') return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.dados }, title: a.nome };
    return { type: 'document', source: { type: 'text', media_type: 'text/plain', data: a.texto || '' }, title: a.nome };
  }
  function mensagemUsuario(texto, anexos) {
    const c = (anexos || []).map(blocoAnexo); if (texto && texto.trim()) c.push({ type: 'text', text: texto });
    const m = { role: 'user', content: c }; if (anexos && anexos.length) m.nomes = anexos.map(function (a) { return a.nome; });
    return m;
  }
  function textoUsuario(m) { return (m.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n'); }
  // A API não aceita título em bloco de imagem: os nomes dos anexos ficam em m.nomes (não vão para a API).
  function anexosUsuario(m) { return (m.content || []).filter(function (b) { return b.type !== 'text'; }).map(function (b, i) { return { tipo: b.type === 'image' ? 'imagem' : b.source && b.source.media_type === 'application/pdf' ? 'pdf' : 'texto', nome: (m.nomes && m.nomes[i]) || b.title || 'imagem' }; }); }
  const LIMITE_BYTES = 30 * 1024 * 1024; // requisição aceita até 32 MB
  function tamanhoMensagens(mensagens) { return JSON.stringify(historicoAPI(mensagens)).length; }

  // ---------- contexto do app ----------
  function dataBR(iso) { const p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function contextoApp(d, hojeISO) {
    d = d || {}; const hoje = hojeISO || new Date().toISOString().slice(0, 10); const ate = new Date(new Date(hoje + 'T12:00:00').getTime() + 7 * 864e5).toISOString().slice(0, 10);
    const linhas = [];
    const emp = (d.empresas || []).slice(0, 30);
    if (emp.length) linhas.push('Clientes (CNPJs): ' + emp.map(function (e) { return (e.fantasia || e.razao) + (e.cnpj ? ' (' + e.cnpj + ')' : ''); }).join('; '));
    const at = d.empresaAtiva && emp.find(function (e) { return e.id === d.empresaAtiva; }); if (at) linhas.push('Cliente ativo: ' + (at.fantasia || at.razao));
    const tar = ((d.agenda && d.agenda.tarefas) || []).filter(function (t) { return !t.feita && t.data && t.data >= hoje && t.data <= ate; }).sort(function (a, b) { return (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')); }).slice(0, 20);
    if (tar.length) linhas.push('Agenda dos próximos 7 dias:\n' + tar.map(function (t) { return '- ' + dataBR(t.data) + (t.hora ? ' ' + t.hora : '') + ': ' + t.titulo; }).join('\n'));
    const mon = (d.monitor || []).filter(function (m) { return !/conclu|homolog|cancel|fracass/i.test(m.situacao || ''); }).slice(0, 15);
    if (mon.length) linhas.push('Licitações em acompanhamento:\n' + mon.map(function (m) { return '- ' + m.titulo + (m.situacao ? ' (' + m.situacao + ')' : ''); }).join('\n'));
    const docs = (d.documentos || []).filter(function (x) { return x.validade && x.validade <= ate; }).slice(0, 15);
    if (docs.length) linhas.push('Documentos vencendo ou vencidos:\n' + docs.map(function (x) { return '- ' + (x.nome || x.tipo || 'documento') + ': validade ' + dataBR(x.validade); }).join('\n'));
    return linhas.join('\n\n');
  }

  function exportarMarkdown(conv, mensagens) {
    const out = ['# ' + conv.titulo, '', '_Seven.ai · ' + modelo(conv.modelo).nome + ' · ' + new Date(conv.criadaEm).toLocaleDateString('pt-BR') + '_', ''];
    (mensagens || []).forEach(function (m) {
      if (m.role === 'user') { const an = anexosUsuario(m); out.push('## Você', '', textoUsuario(m) + (an.length ? '\n\n_Anexos: ' + an.map(function (a) { return a.nome; }).join(', ') + '_' : ''), ''); }
      else if (m.recusa) out.push('## Seven.ai', '', '_(pedido recusado pelos filtros de segurança)_', '');
      else { const f = fontesDe(m.content); out.push('## Seven.ai', '', textoDe(m.content) + (f.length ? '\n\nFontes:\n' + f.map(function (x) { return '- [' + x.titulo + '](' + x.url + ')'; }).join('\n') : ''), ''); }
    });
    return out.join('\n');
  }

  return { SDK_URL: SDK_URL, MODELOS: MODELOS, PADRAO: PADRAO, ESFORCOS: ESFORCOS, modelo: modelo, SISTEMA: SISTEMA, ATALHOS: ATALHOS,
    blocosSistema: blocosSistema, paraEco: paraEco, historicoAPI: historicoAPI, montarRequisicao: montarRequisicao,
    textoDe: textoDe, raciocinioDe: raciocinioDe, buscasDe: buscasDe, fontesDe: fontesDe, erroBusca: erroBusca, somarUso: somarUso, custo: custo, dolar: dolar,
    markdown: markdown, tituloDe: tituloDe, buscar: buscar, agrupar: agrupar, tipoAnexo: tipoAnexo, blocoAnexo: blocoAnexo, mensagemUsuario: mensagemUsuario,
    textoUsuario: textoUsuario, anexosUsuario: anexosUsuario, LIMITE_BYTES: LIMITE_BYTES, tamanhoMensagens: tamanhoMensagens, contextoApp: contextoApp, exportarMarkdown: exportarMarkdown };
});
