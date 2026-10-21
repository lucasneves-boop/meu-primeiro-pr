/* Cotações com fornecedores: do edital à planilha, mensagens de e-mail/WhatsApp, respostas, mapa comparativo e follow-up. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, confirmar, aviso, dataHora, moeda, data } = UI;
  const C = Cotacoes;
  const LIB = { pdf: ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdfjsLib'], mammoth: ['https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', 'mammoth'] };
  const STATUS_COT = { rascunho: 'Rascunho', 'em-andamento': 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada' };
  const est = { aba: 'itens', de: null, filtro: 'abertas', busca: '', respForn: null };
  const libs = {};

  function lista() { Dados.e.cotacoes = Dados.e.cotacoes || []; return Dados.e.cotacoes; }
  function achar(id) { return lista().find(function (c) { return c.id === id; }); }
  function F() { return Telas.fornecedores; }
  function comCadastro(x) { return Object.assign({}, x, { cadastro: F().achar(x.fid) || { fantasia: x.nome } }); }
  function nomeF(x) { const f = F().achar(x.fid); return f ? F().nome(f) : (x.nome || 'Fornecedor excluído'); }
  function cfg() { const c = Dados.e.config || {}; return { assinatura: c.assinaturaCotacao || 'Lucas Neves | Seven', modelos: c.modelosCotacao || {} }; }
  function log(c, texto) { c.historico = c.historico || []; c.historico.unshift({ em: new Date().toISOString(), texto: texto }); }
  function salvar() { Dados.salvar(); }
  function carregar(n) { const x = LIB[n]; if (self[x[1]]) return Promise.resolve(self[x[1]]); return libs[n] = libs[n] || new Promise(function (ok, erro) { const s = document.createElement('script'); s.src = x[0]; s.onload = function () { ok(self[x[1]]); }; s.onerror = function () { libs[n] = null; erro(new Error('Sem internet para ler ' + n.toUpperCase() + '.')); }; document.head.appendChild(s); }); }
  function hojeMais(dias) { const d = new Date(); const iso = new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); try { return Calc.somar(iso, dias, true); } catch (err) { return iso; } }

  // ---------- leitura de edital e anexos ----------
  async function lerArquivo(arq) {
    const nome = arq.name.toLowerCase(); const out = { nome: arq.name, texto: '', tabelas: [] };
    if (/\.pdf$/.test(nome)) {
      const pdfjs = await carregar('pdf'); pdfjs.GlobalWorkerOptions.workerSrc = LIB.pdf[0].replace('pdf.min.js', 'pdf.worker.min.js');
      const doc = await pdfjs.getDocument({ data: await arq.arrayBuffer() }).promise; const partes = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const tc = await (await doc.getPage(p)).getTextContent(); let linha = [], ultY = null; const linhas = [];
        tc.items.forEach(function (i) { const y = Math.round(i.transform[5]); if (ultY !== null && Math.abs(y - ultY) > 3 && linha.length) { linhas.push(linha.join(' ')); linha = []; } if (i.str.trim()) linha.push(i.str.trim()); ultY = y; if (i.hasEOL && linha.length) { linhas.push(linha.join(' ')); linha = []; ultY = null; } });
        if (linha.length) linhas.push(linha.join(' ')); partes.push(linhas.join('\n'));
      }
      out.texto = partes.join('\n'); out.paginas = doc.numPages; doc.destroy();
    } else if (/\.docx$/.test(nome)) {
      const m = await carregar('mammoth'); const html = (await m.convertToHtml({ arrayBuffer: await arq.arrayBuffer() })).value;
      const d = new DOMParser().parseFromString(html, 'text/html');
      d.querySelectorAll('table').forEach(function (t) { out.tabelas.push(Array.prototype.map.call(t.querySelectorAll('tr'), function (tr) { return Array.prototype.map.call(tr.querySelectorAll('td,th'), function (td) { return td.textContent.replace(/\s+/g, ' ').trim(); }); })); });
      d.querySelectorAll('table tr').forEach(function (tr) { tr.textContent = Array.prototype.map.call(tr.children, function (td) { return td.textContent.replace(/\s+/g, ' ').trim(); }).join(' ') + '\n'; });
      out.texto = Array.prototype.map.call(d.body.children, function (x) { return x.innerText || x.textContent; }).join('\n');
    } else if (/\.(xlsx|xls|csv)$/.test(nome)) {
      const t = await F().lerTabela(arq); Object.keys(t.abas).forEach(function (k) { out.tabelas.push(t.abas[k]); }); out.texto = out.tabelas.map(function (t) { return t.map(function (r) { return r.join(' '); }).join('\n'); }).join('\n');
    } else if (/\.(html?|txt|md)$/.test(nome)) { const t = await arq.text(); out.texto = /\.html?$/.test(nome) ? new DOMParser().parseFromString(t, 'text/html').body.textContent : t; }
    else out.ignorado = true;
    return out;
  }
  async function analisarArquivos(arqs, progresso) {
    const lidos = []; for (let k = 0; k < arqs.length; k++) { progresso && progresso('Lendo ' + arqs[k].name + '…', k / arqs.length); try { lidos.push(await lerArquivo(arqs[k])); } catch (err) { lidos.push({ nome: arqs[k].name, erro: err.message, texto: '', tabelas: [] }); } }
    const texto = lidos.map(function (l) { return l.texto; }).join('\n\n');
    let melhor = { itens: [], origem: '' };
    lidos.forEach(function (l) {
      l.tabelas.forEach(function (t) { const it = C.itensDePlanilha(t); if (it.length > melhor.itens.length) melhor = { itens: it, origem: l.nome + ' (tabela)' }; });
      const it = C.extrairItens(l.texto); if (it.length > melhor.itens.length) melhor = { itens: it, origem: l.nome };
    });
    return { lidos: lidos, texto: texto, cabecalho: C.extrairCabecalho(texto), itens: melhor.itens, origem: melhor.origem };
  }

  // ---------- criar ----------
  function novaBase(titulo, prazo) {
    const emp = Dados.empresaAtiva();
    return { id: Dados.id('cot'), numero: C.proximoNumero(lista()), titulo: titulo || 'Nova cotação', empresaId: emp ? emp.id : '', status: 'rascunho', prazoResposta: prazo || hojeMais(2), licitacao: {}, itens: [], fornecedores: [], anexos: [], identificarOrgao: false, criadoEm: new Date().toISOString(), historico: [] };
  }
  async function nova(pre) {
    const props = (Dados.e.propostas || []).filter(function (p) { return p.itens && p.itens.length; });
    const r = await modal({ titulo: 'Nova cotação', largo: true, botao: 'Criar cotação', corpo:
      '<div class="linha">' + campo('Título', '<input name="titulo" placeholder="ex.: Material de expediente — Pregão 90021/2026">', 'Se ficar em branco, uso o objeto do edital.') + campo('Responder até', '<input type="date" name="prazo" value="' + hojeMais(2) + '">') + '</div>' +
      '<fieldset class="co-origens"><legend>De onde vêm os itens?</legend>' +
      '<label class="co-origem"><input type="radio" name="origem" value="edital" checked><span><b>📄 Upload do edital e anexos</b><small>PDF, Word, Excel ou CSV. Leio o termo de referência e monto a lista de itens, o órgão, a data da sessão e o local de entrega.</small><input type="file" name="arquivos" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.html,.htm"></span></label>' +
      '<label class="co-origem"><input type="radio" name="origem" value="pncp"><span><b>🔗 Licitação do PNCP</b><small>Cole o link ou o número de controle.</small><input name="ref" placeholder="https://pncp.gov.br/app/editais/…"></span></label>' +
      (props.length ? '<label class="co-origem"><input type="radio" name="origem" value="proposta"' + (pre && pre.proposta ? ' checked' : '') + '><span><b>📋 Proposta já cadastrada</b><small>Usa os itens da proposta. Depois, os melhores preços voltam como custo.</small><select name="proposta">' + opcoes(props.map(function (p) { return { v: p.id, t: (p.numero || '') + ' · ' + (p.orgao || '') + ' · ' + String(p.objeto || '').slice(0, 60) }; }), pre && pre.proposta) + '</select></span></label>' : '') +
      '<label class="co-origem"><input type="radio" name="origem" value="branco"><span><b>✏️ Em branco</b><small>Digite ou cole os itens depois.</small></span></label></fieldset>',
      aoAbrir: function (form) { form.addEventListener('change', function (ev) { if (ev.target.type === 'file' || ev.target.name === 'ref' || ev.target.name === 'proposta') { const rd = ev.target.closest('.co-origem').querySelector('[type=radio]'); rd.checked = true; } }); form.addEventListener('focusin', function (ev) { if (ev.target.name === 'ref' || ev.target.name === 'proposta') ev.target.closest('.co-origem').querySelector('[type=radio]').checked = true; }); },
      validar: function (fd) { if (fd.get('origem') === 'edital' && !fd.getAll('arquivos').filter(function (x) { return x && x.size; }).length) return 'Escolha o edital e os anexos (ou outra origem).'; if (fd.get('origem') === 'pncp' && !PNCP.lerReferencia(fd.get('ref'))) return 'Não reconheci o link do PNCP.'; return ''; } });
    if (!r) return;
    const c = novaBase(r.get('titulo').trim(), r.get('prazo')); const origem = r.get('origem');
    const tela = document.getElementById('conteudo');
    try {
      if (origem === 'edital') {
        const arqs = r.getAll('arquivos').filter(function (x) { return x && x.size; });
        const res = await analisarArquivos(arqs, function (t, f) { UI.progresso(tela, t, f); });
        for (const a of arqs) { const aid = Dados.id('cax'); await Dados.guardarArquivo(aid, a); c.anexos.push({ id: aid, nome: a.name, tipo: a.type, tamanho: a.size }); }
        await Dados.guardarArquivo('txt-' + c.id, new Blob([res.texto]));
        const h = res.cabecalho; c.licitacao = { orgao: h.orgao || '', numero: h.numero || '', modalidade: h.modalidade || '', processo: h.processo || '', uasg: h.uasg || '', portal: h.portal || '', dataSessao: h.dataSessao || '', objeto: h.objeto || '', localEntrega: h.localEntrega || '', prazoEntrega: h.prazoEntrega || '', cidade: h.cidade || '', uf: h.uf || '' };
        c.itens = res.itens.map(function (i) { return Object.assign({ id: Dados.id('ci') }, i); });
        c.leitura = { origem: res.origem, arquivos: res.lidos.map(function (l) { return { nome: l.nome, paginas: l.paginas, erro: l.erro, ignorado: l.ignorado, caracteres: l.texto.length }; }) };
        log(c, 'Cotação criada a partir de ' + arqs.length + ' arquivo(s). ' + c.itens.length + ' item(ns) encontrados' + (res.origem ? ' em ' + res.origem : '') + '.');
        aviso(c.itens.length ? c.itens.length + ' item(ns) encontrados no edital. Confira a lista.' : 'Não achei a tabela de itens automaticamente. Cole os itens ou importe a planilha.', c.itens.length ? '' : 'erro');
      } else if (origem === 'pncp') {
        const ref = PNCP.lerReferencia(r.get('ref')); UI.progresso(tela, 'Buscando no PNCP…', 0.3);
        const cp = await PNCP.compra(ref.cnpj, ref.ano, ref.seq); const its = await PNCP.itens(ref.cnpj, ref.ano, ref.seq);
        c.ref = ref; c.licitacao = { orgao: cp ? cp.orgao : '', numero: cp ? cp.numero + '/' + cp.ano : '', modalidade: cp ? cp.modalidade : '', processo: cp ? cp.processo : '', portal: cp ? cp.sistema : '', dataSessao: cp ? cp.abertura : '', objeto: cp ? cp.objeto : '', cidade: cp ? cp.municipio : '', uf: cp ? cp.uf : '', link: cp ? cp.edital : '' };
        c.itens = its.map(function (i) { return { id: Dados.id('ci'), n: i.numero, lote: '', descricao: i.descricao, unidade: i.unidade, quantidade: i.quantidade, valorRef: i.refUnitaria }; });
        log(c, 'Cotação criada a partir do PNCP com ' + c.itens.length + ' item(ns).');
      } else if (origem === 'proposta') {
        const p = (Dados.e.propostas || []).find(function (x) { return x.id === r.get('proposta'); }); c.propostaId = p.id; c.empresaId = p.empresaId || c.empresaId;
        c.licitacao = { orgao: p.orgao || '', numero: p.numero || '', portal: p.portal || '', objeto: p.objeto || '', prazoEntrega: p.prazoEntrega || '' };
        c.itens = p.itens.filter(function (i) { return i.participar !== false; }).map(function (i) { return { id: Dados.id('ci'), n: i.numero, lote: i.lote || '', descricao: i.descricao, unidade: i.unidade, quantidade: i.quantidade, valorRef: i.refUnitaria }; });
        log(c, 'Cotação criada a partir da proposta ' + (p.numero || '') + '.');
      } else log(c, 'Cotação criada em branco.');
    } catch (err) { aviso('Falha ao ler: ' + err.message, 'erro'); log(c, 'Falha na leitura automática: ' + err.message); }
    if (!r.get('titulo').trim()) c.titulo = (c.licitacao.objeto || 'Cotação').replace(/^(aquisi[çc][ãa]o|contrata[çc][ãa]o)\s+de\s+/i, '').replace(/^./, function (x) { return x.toUpperCase(); }).slice(0, 90).replace(/[\s.;,]+$/, '') + (c.licitacao.numero ? ' — ' + c.licitacao.numero : '');
    lista().unshift(c); salvar(); est.aba = 'itens'; est.de = c.id; location.hash = '#/cotacoes/ver/' + c.id;
  }

  // ---------- lista ----------
  function resumoResp(c) { const t = c.fornecedores.length, r = c.fornecedores.filter(function (f) { return f.resposta; }).length; return { t: t, r: r }; }
  function telaLista(el) {
    const L = lista(); const pend = C.pendencias(L);
    const q = C.normalizar(est.busca);
    const vis = L.filter(function (c) { if (est.filtro === 'abertas' && (c.status === 'concluida' || c.status === 'cancelada')) return false; if (est.filtro === 'concluidas' && c.status !== 'concluida') return false; if (q && C.normalizar([c.numero, c.titulo, c.licitacao.orgao, c.licitacao.numero].join(' ')).indexOf(q) < 0) return false; return true; });
    el.innerHTML = '<div class="kpis pequenos"><div><span>Em andamento</span><b>' + L.filter(function (c) { return c.status === 'em-andamento'; }).length + '</b></div><div><span>Rascunhos</span><b>' + L.filter(function (c) { return c.status === 'rascunho'; }).length + '</b></div><div><span>Aguardando resposta</span><b>' + L.reduce(function (s, c) { return s + c.fornecedores.filter(C.aguardando).length; }, 0) + '</b></div><div><span>Follow-ups para fazer</span><b class="' + (pend.length ? 'alerta' : '') + '">' + pend.length + '</b></div></div>' +
      (pend.length ? '<section class="cartao co-pend"><header><h3>⏰ Follow-up para fazer agora</h3><small class="mudo">Fornecedores sem resposta: cobrança a cada 24 h, ou a cada 4 h na véspera do prazo.</small></header><ul class="lista-notas">' + pend.slice(0, 12).map(function (p) { return '<li><b>' + esc(nomeF(p.fornecedor)) + '</b> · <a href="#/cotacoes/ver/' + p.cotacao.id + '">' + esc(p.cotacao.numero + ' ' + p.cotacao.titulo) + '</a> <small class="mudo">último contato ' + UI.emQuanto(p.ultimo) + (p.tentativas ? ' · ' + p.tentativas + ' follow-up(s)' : '') + ' · prazo ' + C.dataBR(p.cotacao.prazoResposta) + '</small> <button class="btn mini" data-fu="' + p.cotacao.id + '|' + p.fornecedor.fid + '">Cobrar</button></li>'; }).join('') + '</ul></section>' : '') +
      '<div class="barra-acoes"><div class="filtros" style="margin:0;flex:1"><input type="search" id="co-busca" placeholder="Buscar cotação, órgão, nº do pregão" value="' + esc(est.busca) + '"><div class="pilulas" style="margin:0">' + [['abertas', 'Abertas'], ['concluidas', 'Concluídas'], ['todas', 'Todas']].map(function (x) { return '<button class="pilula ' + (est.filtro === x[0] ? 'ativa' : '') + '" data-filtro="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div><div class="grupo-botoes"><button class="btn" data-a="importar">Importar resposta</button><a class="btn" href="#/fornecedores">Fornecedores</a><button class="btn primario" data-a="nova">+ Nova cotação</button></div></div>' +
      (vis.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Cotação</th><th>Licitação</th><th>Status</th><th class="n">Itens</th><th>Respostas</th><th>Prazo</th><th class="n">Melhor total</th></tr></thead><tbody>' + vis.map(function (c) { const rr = resumoResp(c); const m = C.mapa(c); const venc = c.prazoResposta && c.prazoResposta < new Date().toISOString().slice(0, 10) && c.status === 'em-andamento';
        return '<tr class="clicavel" data-ver="' + c.id + '"><td><b>' + esc(c.numero) + '</b><br>' + esc(c.titulo) + '</td><td>' + esc(c.licitacao.orgao || '—') + '<br><small class="mudo">' + esc([c.licitacao.modalidade, c.licitacao.numero].filter(Boolean).join(' ')) + (c.licitacao.dataSessao ? ' · sessão ' + C.dataBR(c.licitacao.dataSessao) : '') + '</small></td><td><span class="tag co-st-' + c.status + '">' + STATUS_COT[c.status] + '</span></td><td class="n">' + c.itens.length + '</td><td><div class="co-resp"><div class="barra"><i style="width:' + (rr.t ? rr.r / rr.t * 100 : 0) + '%"></i></div><small>' + rr.r + '/' + rr.t + '</small></div></td><td' + (venc ? ' class="co-vencido"' : '') + '>' + C.dataBR(c.prazoResposta) + '</td><td class="n">' + (m.melhorCombinado ? moeda(m.melhorCombinado) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>'
        : UI.vazio(L.length ? 'Nada por aqui' : 'Nenhuma cotação ainda', L.length ? 'Troque o filtro.' : 'Envie o edital e os anexos: eu monto a lista de itens, sugiro os fornecedores pelo portfólio e gero as mensagens de e-mail e WhatsApp e a planilha para eles preencherem.', '<button class="btn primario" data-a="nova">+ Nova cotação</button>'));
    const b = el.querySelector('#co-busca'); b.oninput = function () { est.busca = b.value; clearTimeout(b._t); b._t = setTimeout(function () { App.redesenhar(); const i = document.getElementById('co-busca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    el.onclick = function (ev) {
      const fl = ev.target.closest('[data-filtro]'); if (fl) { est.filtro = fl.dataset.filtro; App.redesenhar(); return; }
      const fu = ev.target.closest('[data-fu]'); if (fu) { const p = fu.dataset.fu.split('|'); const c = achar(p[0]); enviar(c, c.fornecedores.find(function (x) { return x.fid === p[1]; }), true); return; }
      const a = ev.target.closest('[data-a]'); if (a) { if (a.dataset.a === 'nova') nova(); if (a.dataset.a === 'importar') importarResposta(null); return; }
      const v = ev.target.closest('[data-ver]'); if (v) location.hash = '#/cotacoes/ver/' + v.dataset.ver;
    };
  }

  // ---------- envio, follow-up e planilha ----------
  async function baixarPlanilha(c, x) {
    const emp = Dados.empresaAtiva(); const p = C.planilhaFornecedor(c, x ? comCadastro(x) : null, cfg().assinatura.split('|').pop().trim() || (emp && emp.fantasia));
    const nome = c.numero + (x ? '-' + C.normalizar(nomeF(x)).replace(/ /g, '-').slice(0, 30) : '');
    await F().baixarPlanilha(nome, [{ nome: 'Cotação', linhas: p.linhas, larguras: [10, 6, 6, 60, 8, 8, 16, 20, 16, 16, 14, 30], mesclar: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }] }, { nome: '_seven', linhas: p.meta, oculta: true }]);
  }
  async function enviar(c, x, followup) {
    const fc = comCadastro(x); const f = fc.cadastro; const w = C.telefoneWhats(f.whatsapp || f.telefone); const opc = { assinatura: cfg().assinatura, modelos: cfg().modelos };
    let canal = w ? 'whatsapp' : 'email';
    const texto = function (k) { return C.mensagem(followup ? 'followup_' + k : k, c, fc, opc); };
    const r = await modal({ titulo: (followup ? 'Follow-up' : 'Enviar cotação') + ' — ' + nomeF(x), largo: true, botao: false, corpo:
      '<p class="mudo co-aviso-envio">Confira o texto. O botão abre o seu WhatsApp ou e-mail com a mensagem pronta; quem envia é você. Ao abrir, registro o envio no histórico.</p>' +
      '<nav class="pilulas co-canais"><button type="button" class="pilula" data-canal="whatsapp">💬 WhatsApp' + (w ? '' : ' (sem número)') + '</button><button type="button" class="pilula" data-canal="email">✉️ E-mail' + (f.email ? '' : ' (sem e-mail)') + '</button></nav>' +
      '<div data-painel="whatsapp">' + campo('Mensagem do WhatsApp para ' + (f.whatsapp || 'número não cadastrado'), '<textarea name="tw" rows="14">' + esc(texto('whatsapp')) + '</textarea>') + '</div>' +
      '<div data-painel="email" hidden>' + campo('Para', '<input name="para" value="' + esc(f.email || '') + '">') + campo('Assunto', '<input name="assunto" value="' + esc((followup ? 'Lembrete: ' : '') + C.mensagem('assunto', c, fc, opc)) + '">') + campo('Mensagem', '<textarea name="te" rows="14">' + esc(texto('email')) + '</textarea>') + '<p class="mini mudo">📎 Baixe a planilha e anexe no e-mail antes de enviar.</p></div>' +
      (followup ? campo('Anotação do follow-up (opcional)', '<input name="nota" placeholder="ex.: disse que responde amanhã">') : '') +
      '<div class="grupo-botoes co-envio"><button type="button" class="btn primario" data-ir>Abrir no WhatsApp</button><button type="button" class="btn" data-copiar>Copiar texto</button><button type="button" class="btn" data-planilha>Baixar planilha</button>' + (followup ? '<button type="button" class="btn" data-so-registrar>Só registrar (liguei / falei)</button>' : '<button type="button" class="btn" data-so-registrar>Já enviei por outro meio</button>') + '</div>',
      aoAbrir: function (form) {
        const mostra = function () { form.querySelectorAll('[data-canal]').forEach(function (b) { b.classList.toggle('ativa', b.dataset.canal === canal); }); form.querySelectorAll('[data-painel]').forEach(function (p) { p.hidden = p.dataset.painel !== canal; }); form.querySelector('[data-ir]').textContent = canal === 'whatsapp' ? 'Abrir no WhatsApp' : 'Abrir no e-mail'; };
        mostra();
        const registrar = function (via) {
          const agora = new Date().toISOString();
          if (followup) { x.followups = x.followups || []; x.followups.push({ em: agora, canal: via, nota: form.nota ? form.nota.value.trim() : '' }); log(c, 'Follow-up ' + x.followups.length + ' com ' + nomeF(x) + ' por ' + via + '.'); }
          else { if (!x.enviadaEm) x.enviadaEm = agora; x.canal = via; if (x.status === 'a-enviar' || x.status === 'sem-resposta') x.status = 'enviada'; log(c, 'Cotação enviada a ' + nomeF(x) + ' por ' + via + '.'); if (c.status === 'rascunho') c.status = 'em-andamento'; }
          salvar(); form.closest('.modal-fundo').remove(); App.redesenhar();
        };
        form.addEventListener('click', function (ev) {
          const cb = ev.target.closest('[data-canal]'); if (cb) { canal = cb.dataset.canal; mostra(); return; }
          if (ev.target.closest('[data-copiar]')) { navigator.clipboard.writeText(canal === 'whatsapp' ? form.tw.value : form.te.value).then(function () { aviso('Texto copiado.'); }, function () { aviso('Selecione e copie com Ctrl+C.'); }); return; }
          if (ev.target.closest('[data-planilha]')) { baixarPlanilha(c, x); return; }
          if (ev.target.closest('[data-so-registrar]')) { registrar(followup ? 'ligação' : 'outro meio'); return; }
          if (ev.target.closest('[data-ir]')) {
            if (canal === 'whatsapp') { if (!w) return aviso('Cadastre o WhatsApp do fornecedor.', 'erro'); window.open(C.linkWhats(w, form.tw.value), '_blank', 'noopener'); registrar('whatsapp'); }
            else { if (!form.para.value) return aviso('Informe o e-mail do fornecedor.', 'erro'); const u = C.linkEmail(form.para.value, form.assunto.value, form.te.value); if (u.length > 1900) aviso('Mensagem longa: se o e-mail cortar, use "Copiar texto" e cole no corpo.'); location.href = u; registrar('email'); }
          }
        });
      } });
    void r;
  }
  async function emailParaTodos(c) {
    const xs = c.fornecedores.filter(function (x) { return !x.resposta && x.status !== 'recusou'; }); const emails = xs.map(function (x) { const f = F().achar(x.fid); return f && f.email; }).filter(Boolean);
    if (!emails.length) return aviso('Nenhum fornecedor pendente tem e-mail cadastrado.', 'erro');
    const corpo = C.mensagem('email', c, { cadastro: { contato: 'fornecedor' } }, { assinatura: cfg().assinatura, modelos: cfg().modelos }).replace(/^Olá, fornecedor!/, 'Olá!');
    const r = await modal({ titulo: 'E-mail para todos (' + emails.length + ', em cópia oculta)', largo: true, botao: 'Abrir no e-mail', corpo: campo('Cco', '<input name="cco" value="' + esc(emails.join(', ')) + '">') + campo('Assunto', '<input name="assunto" value="' + esc(C.mensagem('assunto', c)) + '">') + campo('Mensagem', '<textarea name="te" rows="14">' + esc(corpo) + '</textarea>') + '<p class="mini mudo">Anexe a planilha geral (botão "Planilha geral") antes de enviar. Quem envia é você.</p>' });
    if (!r) return;
    location.href = 'mailto:?bcc=' + encodeURIComponent(r.get('cco')).replace(/%40/g, '@').replace(/%2C/g, ',') + '&subject=' + encodeURIComponent(r.get('assunto')) + '&body=' + encodeURIComponent(r.get('te'));
    const agora = new Date().toISOString(); xs.forEach(function (x) { const f = F().achar(x.fid); if (f && f.email) { if (!x.enviadaEm) x.enviadaEm = agora; x.canal = 'email'; if (x.status === 'a-enviar') x.status = 'enviada'; } });
    if (c.status === 'rascunho') c.status = 'em-andamento'; log(c, 'E-mail para ' + emails.length + ' fornecedor(es) em cópia oculta.'); salvar(); App.redesenhar();
  }

  // ---------- respostas ----------
  function aplicarResposta(c, x, itens, cond) {
    const agora = new Date().toISOString(); x.resposta = x.resposta || { recebidaEm: agora, itens: {} };
    Object.assign(x.resposta.itens, itens); Object.assign(x.resposta, cond || {});
    const cot = Object.keys(x.resposta.itens).filter(function (k) { return x.resposta.itens[k].preco != null; }).length;
    const tratados = c.itens.filter(function (i) { const r = x.resposta.itens[i.id]; return r && (r.preco != null || r.naoAtende); }).length; // preço ou "não atende"
    x.status = tratados >= c.itens.length && cot ? 'respondida' : cot ? 'parcial' : (tratados ? 'recusou' : x.status);
    if (!x.enviadaEm) x.enviadaEm = x.resposta.recebidaEm;
    F().registrarPrecos(x.fid, c, x.resposta); log(c, 'Resposta de ' + nomeF(x) + ': ' + cot + ' de ' + c.itens.length + ' item(ns) com preço.');
    if (c.status === 'rascunho') c.status = 'em-andamento';
  }
  async function importarResposta(c) {
    const arq = await UI.escolherArquivo('.xlsx,.xls,.csv', false); if (!arq) return;
    try {
      const t = await F().lerTabela(arq); let cid = c && c.id, fid = null;
      if (t.abas._seven) t.abas._seven.forEach(function (r) { if (r[0] === 'cotacao') cid = cid || r[1]; if (r[0] === 'fornecedor') fid = r[1]; });
      c = c || achar(cid); if (!c) return aviso('Não identifiquei a cotação desta planilha. Abra a cotação e importe por lá.', 'erro');
      if (cid && cid !== c.id) return aviso('Esta planilha é de outra cotação (' + ((achar(cid) || {}).numero || '?') + ').', 'erro');
      let x = fid && c.fornecedores.find(function (y) { return y.fid === fid; });
      if (!x) { if (!c.fornecedores.length) return aviso('Inclua o fornecedor na cotação antes.', 'erro'); const r = await modal({ titulo: 'De qual fornecedor é esta planilha?', corpo: campo('Fornecedor', '<select name="f">' + opcoes(c.fornecedores.map(function (y) { return { v: y.fid, t: nomeF(y) }; }), est.respForn) + '</select>') }); if (!r) return; x = c.fornecedores.find(function (y) { return y.fid === r.get('f'); }); }
      const aba = t.abas['Cotação'] || t.abas[Object.keys(t.abas)[0]]; const res = C.lerPlanilhaFornecedor(aba, c);
      if (!res.lidos) return aviso('Não encontrei preços preenchidos na planilha.', 'erro');
      aplicarResposta(c, x, res.itens, { validade: res.condicoes.validade, pagamento: res.condicoes.pagamento, frete: res.condicoes.frete, faturamentoMinimo: res.condicoes.faturamentoMinimo, arquivo: arq.name });
      salvar(); aviso(res.lidos + ' item(ns) importados de ' + nomeF(x) + '.'); est.de = c.id; est.aba = 'mapa'; if (location.hash === '#/cotacoes/ver/' + c.id) App.redesenhar(); else location.hash = '#/cotacoes/ver/' + c.id;
    } catch (err) { aviso(err.message, 'erro'); }
  }

  // ---------- tela da cotação ----------
  function telaCotacao(el, id) {
    const c = achar(id); if (!c) { el.innerHTML = UI.vazio('Cotação não encontrada', '<a href="#/cotacoes">Voltar</a>'); return; }
    if (est.de !== id) { est.de = id; est.aba = c.itens.length ? (c.fornecedores.length ? 'fornecedores' : 'itens') : 'itens'; est.respForn = null; }
    const rr = resumoResp(c); const m = C.mapa(c); const L = c.licitacao || {};
    const abas = [['itens', 'Itens (' + c.itens.length + ')'], ['fornecedores', 'Fornecedores (' + c.fornecedores.length + ')'], ['respostas', 'Respostas (' + rr.r + ')'], ['mapa', 'Mapa comparativo'], ['edital', 'Edital e anexos (' + c.anexos.length + ')'], ['historico', 'Histórico']];
    el.innerHTML = '<p class="migalhas"><a href="#/cotacoes">Cotações</a> › ' + esc(c.numero) + '</p>' +
      '<section class="cartao co-cab"><div class="co-cab-l"><h2><span class="mudo">' + esc(c.numero) + '</span> ' + esc(c.titulo) + '</h2><p class="mudo">' + esc([L.orgao, [L.modalidade, L.numero].filter(Boolean).join(' '), L.portal].filter(Boolean).join(' · ') || 'Sem licitação vinculada') + (L.dataSessao ? ' · <b>Sessão ' + esc(C.dataBR(L.dataSessao)) + '</b>' : '') + '</p></div>' +
      '<div class="co-cab-d"><label>Status <select id="co-status">' + opcoes(Object.keys(STATUS_COT).map(function (k) { return { v: k, t: STATUS_COT[k] }; }), c.status) + '</select></label><label>Responder até <input type="date" id="co-prazo" value="' + esc(c.prazoResposta || '') + '"></label><div class="co-resp"><div class="barra"><i style="width:' + (rr.t ? rr.r / rr.t * 100 : 0) + '%"></i></div><small>' + rr.r + ' de ' + rr.t + ' responderam</small></div></div>' +
      '<footer><button class="btn" data-a="editar">Editar dados</button><button class="btn" data-a="planilha">Planilha geral</button><button class="btn" data-a="todos">E-mail para todos</button><button class="btn" data-a="importar">Importar resposta</button><label class="check"><input type="checkbox" id="co-orgao"' + (c.identificarOrgao ? ' checked' : '') + '> Identificar o órgão nas mensagens</label><span style="flex:1"></span><button class="btn perigo" data-a="excluir">Excluir</button></footer></section>' +
      '<nav class="abas">' + abas.map(function (a) { return '<a href="#" data-aba="' + a[0] + '" class="' + (est.aba === a[0] ? 'ativa' : '') + '">' + esc(a[1]) + '</a>'; }).join('') + '</nav><div id="co-aba"></div>';
    const box = el.querySelector('#co-aba');
    ({ itens: abaItens, fornecedores: abaFornecedores, respostas: abaRespostas, mapa: abaMapa, edital: abaEdital, historico: abaHistorico })[est.aba](box, c, m);
    el.querySelector('#co-status').onchange = function () { c.status = this.value; log(c, 'Status: ' + STATUS_COT[c.status] + '.'); salvar(); App.redesenhar(); };
    el.querySelector('#co-prazo').onchange = function () { c.prazoResposta = this.value; log(c, 'Prazo de resposta: ' + C.dataBR(c.prazoResposta) + '.'); salvar(); };
    el.querySelector('#co-orgao').onchange = function () { c.identificarOrgao = this.checked; salvar(); aviso(this.checked ? 'As mensagens vão citar o órgão e o nº da licitação.' : 'As mensagens citam só a cidade de entrega.'); };
    el.onclick = async function (ev) {
      const ab = ev.target.closest('[data-aba]'); if (ab) { ev.preventDefault(); est.aba = ab.dataset.aba; App.redesenhar(); return; }
      const a = ev.target.closest('[data-a]'); if (!a) return; const act = a.dataset.a;
      if (act === 'editar') editarDados(c);
      if (act === 'planilha') baixarPlanilha(c, null);
      if (act === 'todos') emailParaTodos(c);
      if (act === 'importar') importarResposta(c);
      if (act === 'excluir' && await confirmar('Excluir cotação', 'Excluir ' + esc(c.numero) + ' com respostas e anexos?', 'Excluir')) { c.anexos.forEach(function (x) { Dados.apagarArquivo(x.id); }); Dados.apagarArquivo('txt-' + c.id); Dados.e.cotacoes = lista().filter(function (x) { return x !== c; }); salvar(); location.hash = '#/cotacoes'; }
    };
  }

  async function editarDados(c) {
    const L = c.licitacao || {};
    const r = await modal({ titulo: 'Dados da cotação', largo: true, corpo: campo('Título', '<input name="titulo" value="' + esc(c.titulo) + '">') + '<div class="linha">' + campo('Órgão', '<input name="orgao" value="' + esc(L.orgao || '') + '">') + campo('Modalidade', '<input name="modalidade" value="' + esc(L.modalidade || '') + '">') + campo('Nº', '<input name="numero" value="' + esc(L.numero || '') + '">') + '</div><div class="linha">' + campo('Portal', '<input name="portal" value="' + esc(L.portal || '') + '">') + campo('Sessão', '<input type="datetime-local" name="dataSessao" value="' + esc((L.dataSessao || '').slice(0, 16)) + '">') + campo('UASG', '<input name="uasg" value="' + esc(L.uasg || '') + '">') + '</div>' + campo('Objeto', '<textarea name="objeto" rows="2">' + esc(L.objeto || '') + '</textarea>') + '<div class="linha">' + campo('Cidade de entrega', '<input name="cidade" value="' + esc(L.cidade || '') + '">') + campo('UF', '<input name="uf" maxlength="2" value="' + esc(L.uf || '') + '">') + campo('Prazo de entrega exigido', '<input name="prazoEntrega" value="' + esc(L.prazoEntrega || '') + '">') + '</div>' + campo('Local de entrega', '<input name="localEntrega" value="' + esc(L.localEntrega || '') + '">') });
    if (!r) return; c.titulo = r.get('titulo').trim() || c.titulo; ['orgao', 'modalidade', 'numero', 'portal', 'dataSessao', 'uasg', 'objeto', 'cidade', 'prazoEntrega', 'localEntrega'].forEach(function (k) { L[k] = r.get(k).trim(); }); L.uf = r.get('uf').toUpperCase(); c.licitacao = L; salvar(); App.redesenhar();
  }

  function abaItens(box, c) {
    box.innerHTML = '<div class="barra-acoes"><p class="mudo">' + (c.leitura && c.leitura.origem ? 'Itens lidos de <b>' + esc(c.leitura.origem) + '</b>. ' : '') + 'Confira descrição, unidade e quantidade antes de enviar aos fornecedores. Edite direto na tabela.</p><div class="grupo-botoes"><button class="btn" data-i="colar">Colar lista</button><button class="btn" data-i="planilha">Importar planilha de itens</button><button class="btn" data-i="add">+ Item</button></div></div>' +
      (c.itens.length ? '<div class="tabela-rolagem"><table class="tabela co-itens"><thead><tr><th>Lote</th><th>Item</th><th>Descrição</th><th>Unid.</th><th class="n">Qtd.</th><th class="n">Valor ref. unit.</th><th class="n">Ref. total</th><th></th></tr></thead><tbody>' + c.itens.map(function (i) { return '<tr data-id="' + i.id + '"><td><input data-c="lote" value="' + esc(i.lote || '') + '" size="2"></td><td><input data-c="n" value="' + esc(i.n) + '" size="3"></td><td><textarea data-c="descricao" rows="2">' + esc(i.descricao) + '</textarea></td><td><input data-c="unidade" value="' + esc(i.unidade || '') + '" size="5"></td><td class="n"><input data-c="quantidade" inputmode="decimal" value="' + esc(String(i.quantidade == null ? '' : i.quantidade).replace('.', ',')) + '" size="7"></td><td class="n"><input data-c="valorRef" inputmode="decimal" value="' + esc(i.valorRef == null ? '' : String(i.valorRef).replace('.', ',')) + '" size="9"></td><td class="n">' + (i.valorRef ? moeda(i.valorRef * (i.quantidade || 0)) : '—') + '</td><td><button class="icone" data-del="' + i.id + '" aria-label="Excluir item">×</button></td></tr>'; }).join('') + '</tbody><tfoot><tr><td colspan="6"><b>Total de referência</b></td><td class="n"><b>' + moeda(c.itens.reduce(function (s, i) { return s + (i.valorRef || 0) * (i.quantidade || 0); }, 0)) + '</b></td><td></td></tr></tfoot></table></div>' + (c.fornecedores.length ? '' : '<p><button class="btn primario" data-i="seguir">Próximo: escolher fornecedores →</button></p>')
        : UI.vazio('Sem itens', 'Cole a lista de itens (copiada do termo de referência ou do Excel), importe uma planilha ou adicione item a item.', '<button class="btn primario" data-i="colar">Colar lista</button>'));
    box.onchange = function (ev) { const t = ev.target; const tr = t.closest('tr[data-id]'); if (!tr || !t.dataset.c) return; const i = c.itens.find(function (x) { return x.id === tr.dataset.id; }); const k = t.dataset.c; i[k] = ['quantidade', 'valorRef', 'n'].indexOf(k) >= 0 ? C.numeroBR(t.value) : (k === 'unidade' ? t.value.toUpperCase().trim() : t.value.trim()); salvar(); if (k === 'quantidade' || k === 'valorRef') App.redesenhar(); };
    box.onclick = async function (ev) {
      const d = ev.target.closest('[data-del]'); if (d) { c.itens = c.itens.filter(function (x) { return x.id !== d.dataset.del; }); salvar(); App.redesenhar(); return; }
      const b = ev.target.closest('[data-i]'); if (!b) return;
      if (b.dataset.i === 'seguir') { est.aba = 'fornecedores'; App.redesenhar(); }
      if (b.dataset.i === 'add') { c.itens.push({ id: Dados.id('ci'), n: (c.itens.length ? Math.max.apply(null, c.itens.map(function (x) { return x.n || 0; })) : 0) + 1, lote: '', descricao: '', unidade: 'UN', quantidade: 1, valorRef: null }); salvar(); App.redesenhar(); setTimeout(function () { const t = document.querySelectorAll('.co-itens textarea'); if (t.length) t[t.length - 1].focus(); }, 30); }
      if (b.dataset.i === 'colar') { const r = await modal({ titulo: 'Colar lista de itens', largo: true, botao: 'Ler itens', corpo: campo('Cole aqui', '<textarea name="t" rows="12" placeholder="1  Papel A4 75 g, caixa com 10 resmas  CX  200  245,90\n2  Caneta esferográfica azul  UN  1.500  1,35"></textarea>', 'Uma linha por item: número, descrição, unidade e quantidade (e o valor de referência, se tiver). Do Excel, pode colar as colunas direto.') }); if (!r) return; const t = r.get('t'); let its = C.itensDePlanilha(t.split('\n').map(function (l) { return l.split('\t'); })); if (!its.length) its = C.extrairItens(t); if (!its.length && /\t/.test(t)) its = t.split('\n').map(function (l) { return l.split('\t'); }).filter(function (r) { return r.length >= 3; }).map(function (r, k) { return { n: C.numeroBR(r[0]) || k + 1, lote: '', descricao: r[1], unidade: (r[2] || 'UN').toUpperCase(), quantidade: C.numeroBR(r[3]) || 1, valorRef: C.numeroBR(r[4]) }; }); if (!its.length) return aviso('Não reconheci itens. Use: número, descrição, unidade, quantidade.', 'erro'); its.forEach(function (i) { c.itens.push(Object.assign({ id: Dados.id('ci') }, i)); }); log(c, its.length + ' item(ns) colados.'); salvar(); aviso(its.length + ' item(ns) adicionados.'); App.redesenhar(); }
      if (b.dataset.i === 'planilha') { const arq = await UI.escolherArquivo('.xlsx,.xls,.csv', false); if (!arq) return; try { const t = await F().lerTabela(arq); let its = []; Object.keys(t.abas).forEach(function (k) { const x = C.itensDePlanilha(t.abas[k]); if (x.length > its.length) its = x; }); if (!its.length) return aviso('Não encontrei colunas de descrição e quantidade.', 'erro'); its.forEach(function (i) { c.itens.push(Object.assign({ id: Dados.id('ci') }, i)); }); log(c, its.length + ' item(ns) importados de ' + arq.name + '.'); salvar(); aviso(its.length + ' item(ns) importados.'); App.redesenhar(); } catch (err) { aviso(err.message, 'erro'); } }
    };
  }

  function abaFornecedores(box, c) {
    const ja = {}; c.fornecedores.forEach(function (x) { ja[x.fid] = true; });
    const sug = C.sugerirFornecedores(c.itens, F().lista().filter(function (f) { return !ja[f.id]; })).slice(0, 8);
    const outros = F().lista().filter(function (f) { return !ja[f.id] && f.status !== 'bloqueado'; });
    box.innerHTML = (sug.length ? '<section class="cartao co-sug"><header><h3>✨ Sugeridos pelo portfólio</h3><button class="btn mini" data-f="todos-sug">Incluir todos</button></header><div class="co-sug-l">' + sug.map(function (s) { return '<div class="co-sug-i"><b>' + esc(F().nome(s.fornecedor)) + '</b> ' + F().estrelas(Cotacoes.indicadores(s.fornecedor.id, lista()).nota) + '<small>atende ' + s.itens.length + ' de ' + c.itens.length + ' item(ns): ' + esc(s.itens.slice(0, 4).map(function (k) { return c.itens[k].n; }).join(', ')) + (s.itens.length > 4 ? '…' : '') + '</small><button class="btn mini primario" data-incluir="' + s.fornecedor.id + '">+ Incluir</button></div>'; }).join('') + '</div></section>' : '') +
      '<div class="barra-acoes"><div class="filtros" style="margin:0;flex:1"><select id="co-add"><option value="">Incluir fornecedor cadastrado…</option>' + opcoes(outros.map(function (f) { return { v: f.id, t: F().nome(f) + ((f.categorias || []).length ? ' — ' + f.categorias.slice(0, 2).join(', ') : '') }; })) + '</select></div><div class="grupo-botoes"><button class="btn" data-f="novo">+ Novo fornecedor</button></div></div>' +
      (c.fornecedores.length ? '<div class="tabela-rolagem"><table class="tabela co-forn"><thead><tr><th>Fornecedor</th><th>Status</th><th>Enviada</th><th>Último contato</th><th class="n">Follow-ups</th><th>Ações</th></tr></thead><tbody>' + c.fornecedores.map(function (x) {
        const f = F().achar(x.fid) || {}; const fu = C.precisaFollowup(c, x);
        return '<tr data-fid="' + x.fid + '"><td><a href="#/fornecedores/ver/' + x.fid + '"><b>' + esc(nomeF(x)) + '</b></a><br><small class="mudo">' + esc([f.contato, f.whatsapp || f.telefone, f.email].filter(Boolean).join(' · ') || 'sem contato cadastrado') + '</small></td><td><span class="tag fo-st-' + x.status + '">' + esc(C.STATUS[x.status]) + '</span>' + (fu ? ' <span class="tag laranja mini">cobrar</span>' : '') + '</td><td>' + (x.enviadaEm ? dataHora(x.enviadaEm) + '<br><small class="mudo">' + esc(x.canal || '') + '</small>' : '—') + '</td><td>' + (C.ultimoContato(x) ? UI.emQuanto(C.ultimoContato(x)) : '—') + '</td><td class="n">' + (x.followups || []).length + '</td>' +
          '<td class="co-acoes">' + (x.status === 'a-enviar' ? '<button class="btn mini primario" data-x="enviar">Enviar</button>' : '<button class="btn mini" data-x="enviar">Reenviar</button>') + (C.aguardando(x) ? '<button class="btn mini' + (fu ? ' primario' : '') + '" data-x="followup">Follow-up</button>' : '') + '<button class="btn mini" data-x="planilha">Planilha</button><button class="btn mini" data-x="resposta">' + (x.resposta ? 'Ver resposta' : 'Lançar resposta') + '</button><select data-x="status" aria-label="Mudar status"><option value="">⋯</option><option value="recusou">Recusou</option><option value="sem-resposta">Sem resposta</option><option value="a-enviar">Voltar para "a enviar"</option><option value="remover">Remover da cotação</option></select></td></tr>';
      }).join('') + '</tbody></table></div>' : UI.vazio('Nenhum fornecedor na cotação', F().lista().length ? 'Inclua os sugeridos ou escolha na lista acima.' : 'Cadastre fornecedores (com categorias e portfólio) para eu sugerir automaticamente.', '<button class="btn primario" data-f="novo">+ Novo fornecedor</button>'));
    const incluir = function (fid) { if (c.fornecedores.some(function (x) { return x.fid === fid; })) return; c.fornecedores.push({ fid: fid, nome: F().nome(F().achar(fid)), status: 'a-enviar', incluidoEm: new Date().toISOString(), followups: [] }); log(c, nomeF({ fid: fid }) + ' incluído na cotação.'); };
    box.querySelector('#co-add').onchange = function () { if (this.value) { incluir(this.value); salvar(); App.redesenhar(); } };
    box.onchange = function (ev) {
      const s = ev.target.closest('select[data-x=status]'); if (!s || !s.value) return; const x = c.fornecedores.find(function (y) { return y.fid === s.closest('tr').dataset.fid; });
      if (s.value === 'remover') { c.fornecedores = c.fornecedores.filter(function (y) { return y !== x; }); log(c, nomeF(x) + ' removido da cotação.'); }
      else { x.status = s.value; if (s.value === 'recusou') x.recusouEm = new Date().toISOString(); log(c, nomeF(x) + ': ' + C.STATUS[s.value] + '.'); }
      salvar(); App.redesenhar();
    };
    box.onclick = async function (ev) {
      const inc = ev.target.closest('[data-incluir]'); if (inc) { incluir(inc.dataset.incluir); salvar(); App.redesenhar(); return; }
      const fb = ev.target.closest('[data-f]'); if (fb) { if (fb.dataset.f === 'todos-sug') { sug.forEach(function (s) { incluir(s.fornecedor.id); }); salvar(); App.redesenhar(); } if (fb.dataset.f === 'novo') { const f = await F().editar(); if (f) { incluir(f.id); salvar(); App.redesenhar(); } } return; }
      const b = ev.target.closest('button[data-x]'); if (!b) return; const x = c.fornecedores.find(function (y) { return y.fid === b.closest('tr').dataset.fid; });
      if (b.dataset.x === 'enviar') enviar(c, x, false);
      if (b.dataset.x === 'followup') enviar(c, x, true);
      if (b.dataset.x === 'planilha') baixarPlanilha(c, x);
      if (b.dataset.x === 'resposta') { est.respForn = x.fid; est.aba = 'respostas'; App.redesenhar(); }
    };
  }

  function abaRespostas(box, c) {
    if (!c.fornecedores.length) { box.innerHTML = UI.vazio('Inclua fornecedores primeiro', 'As respostas são lançadas por fornecedor.'); return; }
    if (!est.respForn || !c.fornecedores.some(function (x) { return x.fid === est.respForn; })) est.respForn = (c.fornecedores.find(function (x) { return !x.resposta && x.status !== 'a-enviar'; }) || c.fornecedores[0]).fid;
    const x = c.fornecedores.find(function (y) { return y.fid === est.respForn; }); const R = (x.resposta && x.resposta.itens) || {};
    box.innerHTML = '<div class="pilulas">' + c.fornecedores.map(function (y) { return '<button class="pilula ' + (y.fid === x.fid ? 'ativa' : '') + '" data-rf="' + y.fid + '">' + (y.resposta ? '✓ ' : '') + esc(nomeF(y)) + '</button>'; }).join('') + '</div>' +
      '<form id="co-resp" class="cartao"><header><h3>Resposta de ' + esc(nomeF(x)) + '</h3><div class="grupo-botoes"><button type="button" class="btn" data-imp>Importar planilha preenchida</button></div></header>' +
      '<div class="tabela-rolagem"><table class="tabela co-resp-t"><thead><tr><th>Item</th><th>Descrição</th><th class="n">Qtd.</th><th class="n">Ref.</th><th>Preço unit. (R$)</th><th>Marca</th><th>Modelo</th><th>Prazo (dias)</th><th>Não atende</th><th class="n">Total</th></tr></thead><tbody>' + c.itens.map(function (i) { const r = R[i.id] || {}; return '<tr data-id="' + i.id + '"><td>' + (i.lote ? 'L' + esc(i.lote) + '·' : '') + esc(i.n) + '</td><td class="co-desc">' + esc(i.descricao) + '</td><td class="n">' + esc(String(i.quantidade).replace('.', ',')) + ' ' + esc(i.unidade || '') + '</td><td class="n">' + (i.valorRef ? moeda(i.valorRef) : '—') + '</td><td><input name="p-' + i.id + '" inputmode="decimal" size="9" value="' + esc(r.preco != null ? String(r.preco).replace('.', ',') : '') + '"></td><td><input name="m-' + i.id + '" size="10" value="' + esc(r.marca || '') + '"></td><td><input name="o-' + i.id + '" size="10" value="' + esc(r.modelo || '') + '"></td><td><input name="z-' + i.id + '" size="4" value="' + esc(r.prazo || '') + '"></td><td class="c"><input type="checkbox" name="n-' + i.id + '"' + (r.naoAtende ? ' checked' : '') + '></td><td class="n">' + (r.preco != null ? moeda(r.preco * (i.quantidade || 0)) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="linha">' + campo('Validade da proposta', '<input name="validade" value="' + esc((x.resposta && x.resposta.validade) || '') + '" placeholder="30 dias">') + campo('Pagamento', '<input name="pagamento" value="' + esc((x.resposta && x.resposta.pagamento) || '') + '">') + campo('Frete', '<input name="frete" value="' + esc((x.resposta && x.resposta.frete) || '') + '" placeholder="CIF / FOB">') + campo('Faturamento mínimo (R$)', '<input name="minimo" inputmode="decimal" value="' + esc(x.resposta && x.resposta.faturamentoMinimo != null ? String(x.resposta.faturamentoMinimo).replace('.', ',') : '') + '">') + '</div>' +
      campo('Observações', '<textarea name="obs" rows="2">' + esc((x.resposta && x.resposta.obs) || '') + '</textarea>') + '<footer><button class="btn primario">Salvar resposta</button>' + (x.resposta ? '<span class="mudo">Recebida ' + dataHora(x.resposta.recebidaEm) + (x.resposta.arquivo ? ' · ' + esc(x.resposta.arquivo) : '') + '</span>' : '') + '</footer></form>';
    const form = box.querySelector('#co-resp');
    form.onsubmit = function (ev) {
      ev.preventDefault(); const d = new FormData(form); const its = {};
      c.itens.forEach(function (i) { const p = C.numeroBR(d.get('p-' + i.id)); const na = !!d.get('n-' + i.id); if (p == null && !na && !d.get('m-' + i.id)) return; its[i.id] = { preco: na ? null : p, marca: d.get('m-' + i.id).trim(), modelo: d.get('o-' + i.id).trim(), prazo: d.get('z-' + i.id).trim(), naoAtende: na }; });
      if (!Object.keys(its).length) return aviso('Preencha ao menos um preço ou marque "não atende".', 'erro');
      x.resposta = x.resposta ? Object.assign(x.resposta, { itens: {} }) : null;
      aplicarResposta(c, x, its, { validade: d.get('validade'), pagamento: d.get('pagamento'), frete: d.get('frete'), faturamentoMinimo: C.numeroBR(d.get('minimo')), obs: d.get('obs') });
      salvar(); aviso('Resposta salva. Preços gravados no portfólio do fornecedor.'); App.redesenhar();
    };
    box.onclick = function (ev) { const rf = ev.target.closest('[data-rf]'); if (rf) { est.respForn = rf.dataset.rf; App.redesenhar(); } if (ev.target.closest('[data-imp]')) importarResposta(c); };
  }

  function abaMapa(box, c, m) {
    const fs = m.fornecedores; if (!fs.length) { box.innerHTML = UI.vazio('Sem respostas ainda', 'Quando os fornecedores responderem (lançando os preços ou importando a planilha), o comparativo aparece aqui.'); return; }
    const ref = m.linhas.reduce(function (s, l) { return s + (l.melhor && l.item.valorRef ? l.item.valorRef * (l.item.quantidade || 0) : 0); }, 0); // só itens com preço, para comparar igual com igual
    const prop = c.propostaId && (Dados.e.propostas || []).find(function (p) { return p.id === c.propostaId; });
    box.innerHTML = '<div class="kpis pequenos"><div><span>Melhor combinação (por item)</span><b>' + moeda(m.melhorCombinado) + '</b>' + (m.semPreco ? '<small class="mudo">' + m.semPreco + ' item(ns) sem preço</small>' : '') + '</div><div><span>Melhor fornecedor único</span><b>' + (m.melhorUnico ? moeda(m.melhorUnico.total) : '—') + '</b><small class="mudo">' + (m.melhorUnico ? esc(nomeF({ fid: m.melhorUnico.fid })) : 'ninguém cotou tudo') + '</small></div><div><span>Referência do edital</span><b>' + (ref ? moeda(ref) : '—') + '</b></div><div><span>Abaixo da referência</span><b class="' + (ref && m.melhorCombinado > ref ? 'alerta' : '') + '">' + (ref ? String(Math.round((1 - m.melhorCombinado / ref) * 1000) / 10).replace('.', ',') + '%' : '—') + '</b></div></div>' +
      '<div class="barra-acoes"><p class="mudo">🟢 menor preço do item · 🔴 acima do valor de referência. O custo final ainda precisa de impostos, frete e margem na <a href="#/precificacao">Precificação</a>.</p><div class="grupo-botoes"><button class="btn" data-m="xlsx">Exportar mapa</button>' + (prop ? '<button class="btn primario" data-m="proposta">Levar melhores preços para a proposta</button>' : '') + '</div></div>' +
      '<div class="tabela-rolagem"><table class="tabela co-mapa"><thead><tr><th>Item</th><th>Descrição</th><th class="n">Qtd.</th><th class="n">Ref.</th>' + fs.map(function (f) { return '<th class="n">' + esc(nomeF({ fid: f.fid })) + '</th>'; }).join('') + '<th class="n">Melhor</th><th class="n">Mediana</th><th class="n">vs. ref.</th></tr></thead><tbody>' +
      m.linhas.map(function (l) { const i = l.item; return '<tr><td>' + (i.lote ? 'L' + esc(i.lote) + '·' : '') + esc(i.n) + '</td><td class="co-desc">' + esc(i.descricao) + '</td><td class="n">' + esc(String(i.quantidade).replace('.', ',')) + ' ' + esc(i.unidade || '') + '</td><td class="n">' + (i.valorRef ? moeda(i.valorRef) : '—') + '</td>' + fs.map(function (f) { const x = c.fornecedores.find(function (y) { return y.fid === f.fid; }); const p = C.precoDe(x, i.id); const r = x.resposta.itens[i.id]; return '<td class="n' + (l.melhor && l.melhor.fid === f.fid ? ' co-melhor' : '') + (p != null && i.valorRef && p > i.valorRef ? ' co-acima' : '') + '">' + (p != null ? moeda(p) + (r && r.marca ? '<small>' + esc(r.marca) + '</small>' : '') : (r && r.naoAtende ? '<small class="mudo">não atende</small>' : '—')) + '</td>'; }).join('') + '<td class="n"><b>' + (l.melhor ? moeda(l.melhor.preco) : '—') + '</b></td><td class="n">' + (l.mediana != null ? moeda(l.mediana) : '—') + '</td><td class="n ' + (l.economia != null && l.economia < 0 ? 'co-acima' : '') + '">' + (l.economia != null ? (l.economia >= 0 ? '−' : '+') + Math.abs(Math.round(l.economia * 1000) / 10) + '%' : '—') + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="4"><b>Total</b> <small class="mudo">(itens cotados)</small></td>' + fs.map(function (f) { return '<td class="n"><b>' + moeda(f.total) + '</b><small>' + f.cobertos + '/' + c.itens.length + ' itens · ' + f.venceu + ' 🟢</small></td>'; }).join('') + '<td class="n"><b>' + moeda(m.melhorCombinado) + '</b></td><td></td><td></td></tr></tfoot></table></div>';
    box.onclick = function (ev) {
      const b = ev.target.closest('[data-m]'); if (!b) return;
      if (b.dataset.m === 'xlsx') { const L = [['Mapa comparativo ' + c.numero + ' — ' + c.titulo], [], ['Lote', 'Item', 'Descrição', 'Unid.', 'Qtd.', 'Ref. unit.'].concat(fs.map(function (f) { return nomeF({ fid: f.fid }); })).concat(['Melhor preço', 'Fornecedor', 'Marca', 'Total melhor'])]; m.linhas.forEach(function (l) { const i = l.item; const w = l.melhor && c.fornecedores.find(function (y) { return y.fid === l.melhor.fid; }); L.push([i.lote || '', i.n, i.descricao, i.unidade, i.quantidade, i.valorRef == null ? '' : i.valorRef].concat(fs.map(function (f) { const p = C.precoDe(c.fornecedores.find(function (y) { return y.fid === f.fid; }), i.id); return p == null ? '' : p; })).concat([l.melhor ? l.melhor.preco : '', w ? nomeF(w) : '', w && w.resposta.itens[i.id] ? w.resposta.itens[i.id].marca || '' : '', l.melhor ? l.melhor.preco * i.quantidade : ''])); }); L.push([]); L.push(['', '', 'TOTAL', '', '', ''].concat(fs.map(function (f) { return f.total; })).concat(['', '', '', m.melhorCombinado])); F().baixarPlanilha('mapa-' + c.numero, [{ nome: 'Mapa', linhas: L }], [6, 6, 50, 8, 8, 12].concat(fs.map(function () { return 16; })).concat([14, 24, 14, 14])); }
      if (b.dataset.m === 'proposta') { let n = 0; m.linhas.forEach(function (l) { if (!l.melhor) return; const w = c.fornecedores.find(function (y) { return y.fid === l.melhor.fid; }); const r = w.resposta.itens[l.item.id] || {}; const it = prop.itens.find(function (pi) { return String(pi.numero) === String(l.item.n) && String(pi.lote || '') === String(l.item.lote || ''); }) || prop.itens.find(function (pi) { return String(pi.numero) === String(l.item.n); }); if (!it) return; it.custo = l.melhor.preco; if (r.marca) it.marca = r.marca; if (r.modelo) it.modelo = r.modelo; it.fornecedorCotacao = nomeF(w); n++; }); log(c, n + ' custo(s) levados para a proposta.'); salvar(); aviso(n + ' item(ns) da proposta receberam custo, marca e modelo do melhor fornecedor.'); }
    };
  }

  async function abaEdital(box, c) {
    const L = c.licitacao || {};
    box.innerHTML = '<div class="cartao"><h3>Dados lidos do edital</h3><dl class="numeros">' + [['Órgão', L.orgao], ['Modalidade', L.modalidade], ['Número', L.numero], ['Processo', L.processo], ['UASG', L.uasg], ['Portal', L.portal], ['Sessão', C.dataBR(L.dataSessao)], ['Cidade', [L.cidade, L.uf].filter(Boolean).join('-')], ['Prazo de entrega', L.prazoEntrega], ['Local de entrega', L.localEntrega]].map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + esc(x[1] || '—') + '</dd></div>'; }).join('') + '</dl>' + (L.objeto ? '<p><b>Objeto:</b> ' + esc(L.objeto) + '</p>' : '') + (L.link ? '<p><a href="' + esc(L.link) + '" target="_blank" rel="noopener">Abrir edital no PNCP</a></p>' : '') + '<button class="btn" data-e="editar">Corrigir dados</button></div>' +
      '<div class="cartao"><header><h3>Arquivos</h3><button class="btn" data-e="anexar">+ Anexar</button></header>' + (c.anexos.length ? '<ul class="lista-notas">' + c.anexos.map(function (a) { const info = c.leitura && c.leitura.arquivos.find(function (x) { return x.nome === a.nome; }); return '<li><b>' + esc(a.nome) + '</b> <small class="mudo">' + Math.round((a.tamanho || 0) / 1024) + ' KB' + (info ? (info.paginas ? ' · ' + info.paginas + ' pág.' : '') + (info.erro ? ' · erro: ' + esc(info.erro) : info.ignorado ? ' · formato não lido' : ' · ' + info.caracteres + ' caracteres lidos') : '') + '</small> <span class="grupo-botoes"><button class="btn mini" data-baixar="' + a.id + '">Baixar</button>' + (Telas.leitor ? '<button class="btn mini" data-ler="' + a.id + '">Abrir no Leitor</button>' : '') + '<button class="btn mini" data-reler="' + a.id + '">Reler itens</button></span></li>'; }).join('') + '</ul>' : '<p class="mudo">Nenhum arquivo.</p>') + '</div>' +
      '<details class="cartao"><summary>Texto extraído (para conferir a leitura)</summary><pre class="co-texto" id="co-texto">Carregando…</pre></details>';
    const b = await Dados.lerArquivo('txt-' + c.id); const pre = box.querySelector('#co-texto'); if (pre) pre.textContent = b ? (await b.text()).slice(0, 60000) : 'Sem texto extraído.';
    box.onclick = async function (ev) {
      const e = ev.target.closest('[data-e]'); if (e && e.dataset.e === 'editar') editarDados(c);
      if (e && e.dataset.e === 'anexar') { const fs = await UI.escolherArquivo('.pdf,.docx,.xlsx,.xls,.csv,.txt', true); if (!fs || !fs.length) return; for (const a of fs) { const aid = Dados.id('cax'); await Dados.guardarArquivo(aid, a); c.anexos.push({ id: aid, nome: a.name, tipo: a.type, tamanho: a.size }); } log(c, fs.length + ' anexo(s) incluídos.'); salvar(); App.redesenhar(); }
      const bx = ev.target.closest('[data-baixar]'); if (bx) { const a = c.anexos.find(function (x) { return x.id === bx.dataset.baixar; }); const bl = await Dados.lerArquivo(a.id); if (bl) UI.baixar(a.nome, bl); }
      const lr = ev.target.closest('[data-ler]'); if (lr) { const a = c.anexos.find(function (x) { return x.id === lr.dataset.ler; }); Telas.leitor.adicionarDaNuvem({ id: a.id, nome: a.nome, mime: a.tipo }); }
      const rl = ev.target.closest('[data-reler]'); if (rl) { const a = c.anexos.find(function (x) { return x.id === rl.dataset.reler; }); const bl = await Dados.lerArquivo(a.id); if (!bl) return; try { const res = await analisarArquivos([new File([bl], a.nome, { type: a.tipo })]); if (!res.itens.length) return aviso('Nenhum item encontrado neste arquivo.', 'erro'); if (c.itens.length && !(await confirmar('Substituir itens', 'Encontrei ' + res.itens.length + ' item(ns) em ' + esc(a.nome) + '. Substituir os ' + c.itens.length + ' atuais? (respostas já lançadas perdem o vínculo)', 'Substituir'))) return; c.itens = res.itens.map(function (i) { return Object.assign({ id: Dados.id('ci') }, i); }); log(c, 'Itens relidos de ' + a.nome + ' (' + c.itens.length + ').'); salvar(); est.aba = 'itens'; App.redesenhar(); } catch (err) { aviso(err.message, 'erro'); } }
    };
  }

  function abaHistorico(box, c) {
    box.innerHTML = (c.historico || []).length ? '<ol class="fo-linha">' + c.historico.map(function (h) { return '<li><small>' + dataHora(h.em) + '</small><p>' + esc(h.texto) + '</p></li>'; }).join('') + '</ol>' : '<p class="mudo">Sem eventos.</p>';
  }

  Telas.cotacoes = {
    titulo: 'Cotações',
    render: function (el, sub, param) { if (sub === 'ver') telaCotacao(el, param); else telaLista(el); },
    nova: nova, pendencias: function () { return C.pendencias(lista()); }
  };
})();
