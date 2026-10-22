/* Seven Contrato: envio de contratos para assinatura eletrônica no estilo do Clicksign, sem servidor.
   O signatário recebe um link e o PDF; o app dele confere se o arquivo é o mesmo (SHA-256), ele assina e
   devolve um comprovante protegido por HMAC com a chave do link, que você registra aqui. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, aviso, confirmar, dataHora, data } = UI;
  const K = self.Contratos;
  const PDFLIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
  const LEIS = [['Lei 14.063/2020 (assinaturas eletrônicas)', 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14063.htm'], ['MP 2.200-2/2001 (ICP-Brasil e outros meios)', 'https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm'], ['Assinatura eletrônica gov.br', 'https://www.gov.br/governodigital/pt-br/identidade/assinatura-eletronica'], ['Assinador gov.br (ITI)', 'https://assinador.iti.br/'], ['Validador de assinaturas ICP-Brasil (ITI)', 'https://validar.iti.gov.br/'], ['LGPD, Lei 13.709/2018', 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm']];
  const MODELOS = {
    bpo: { t: 'Prestação de serviços de BPO de licitações', texto: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE BPO DE LICITAÇÕES\n\nCONTRATANTE: {cliente}, CNPJ {cnpjCliente}, com sede em {enderecoCliente}, representada por {representanteCliente}.\nCONTRATADA: {contratada}, CNPJ {cnpjContratada}, representada por {representanteContratada}.\n\nCLÁUSULA 1ª – OBJETO\nA CONTRATADA prestará à CONTRATANTE serviços de gestão terceirizada de licitações: busca e triagem de editais, análise, cadastro de propostas, acompanhamento de sessões, habilitação, recursos, contratos, empenhos e pagamentos, conforme o plano {plano}.\n\nCLÁUSULA 2ª – PREÇO E PAGAMENTO\nMensalidade de {valorMensal}, com vencimento todo dia {diaVencimento}, e taxa de êxito de {taxaExito} sobre os contratos assinados por intermédio da CONTRATADA, quando houver.\n\nCLÁUSULA 3ª – PRAZO\nVigência de {prazoMeses} meses a partir de {inicio}, renovável por igual período, salvo aviso com 30 dias de antecedência.\n\nCLÁUSULA 4ª – OBRIGAÇÕES DA CONTRATANTE\nFornecer documentos, certidões, preços e autorizações em tempo hábil; aprovar por escrito os valores limite de lance; manter os cadastros nos portais.\n\nCLÁUSULA 5ª – OBRIGAÇÕES DA CONTRATADA\nExecutar os serviços com diligência, observar os prazos dos editais, informar riscos e manter sigilo das informações da CONTRATANTE.\n\nCLÁUSULA 6ª – CONFIDENCIALIDADE E DADOS PESSOAIS\nAs partes tratarão dados pessoais conforme a Lei 13.709/2018 (LGPD), apenas para a execução deste contrato.\n\nCLÁUSULA 7ª – RESCISÃO\nQualquer parte pode rescindir com aviso prévio de 30 dias, sem multa, quitados os valores devidos até a data.\n\nCLÁUSULA 8ª – FORO\nFica eleito o foro da comarca de {foro}.\n\nAs partes assinam eletronicamente, nos termos da Lei 14.063/2020.\n\n{cidade}, {dataExtenso}.' },
    nda: { t: 'Termo de confidencialidade (NDA)', texto: 'TERMO DE CONFIDENCIALIDADE\n\nPARTE REVELADORA: {cliente}, CNPJ {cnpjCliente}.\nPARTE RECEPTORA: {contratada}, CNPJ {cnpjContratada}.\n\n1. Informações confidenciais são preços, custos, margens, estratégias de disputa, documentos societários e dados de clientes trocados entre as partes.\n2. A parte receptora usará as informações apenas para {finalidade} e não as divulgará sem autorização escrita.\n3. A obrigação dura {prazoMeses} meses após o fim da relação entre as partes.\n4. Dados pessoais serão tratados conforme a Lei 13.709/2018 (LGPD).\n\nForo da comarca de {foro}.\n\n{cidade}, {dataExtenso}.' },
    aditivo: { t: 'Termo aditivo', texto: 'TERMO ADITIVO Nº {numeroAditivo} AO CONTRATO {numeroContrato}\n\nCONTRATANTE: {cliente}, CNPJ {cnpjCliente}.\nCONTRATADA: {contratada}, CNPJ {cnpjContratada}.\n\nCLÁUSULA 1ª – OBJETO DO ADITIVO\n{objetoAditivo}\n\nCLÁUSULA 2ª – RATIFICAÇÃO\nPermanecem inalteradas as demais cláusulas do contrato original.\n\n{cidade}, {dataExtenso}.' }
  };
  let est = { filtro: '', busca: '', etapa: {} };
  let pdfP = null;

  function e() { const d = Dados.e; d.contratos = d.contratos || []; return d; }
  function lista() { const a = Dados.empresaAtiva(); return e().contratos.filter(function (c) { return !a || !c.empresaId || c.empresaId === a.id; }); }
  function contrato(id) { return e().contratos.find(function (c) { return c.id === id; }); }
  function salvar() { Dados.salvar(); }
  function carregarPdfLib() { if (self.PDFLib) return Promise.resolve(self.PDFLib); return pdfP = pdfP || new Promise(function (ok, erro) { const s = document.createElement('script'); s.src = PDFLIB; s.onload = function () { ok(self.PDFLib); }; s.onerror = function () { pdfP = null; erro(new Error('Não consegui carregar o gerador de PDF. Verifique a internet.')); }; document.head.appendChild(s); }); }
  function rotSit(c) { const s = K.situacao(c); return '<span class="tag ct-st-' + s + '">' + esc(K.SITUACOES[s]) + '</span>'; }
  function b64url(obj) { const t = typeof obj === 'string' ? obj : JSON.stringify(obj); return btoa(unescape(encodeURIComponent(t))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function deB64url(s) { s = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return JSON.parse(decodeURIComponent(escape(atob(s)))); }
  async function hmac(chave, msg) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(chave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)); return Array.from(new Uint8Array(s)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
  function baseApp() { return location.href.split('#')[0]; }
  function linkAssinatura(c, s) { return baseApp() + '#/assinar/' + b64url({ v: 1, c: c.id, s: s.id, t: s.token, h: c.documento.hash, n: c.titulo, nome: s.nome, papel: s.papel, de: c.criadoPor || '', emp: (Dados.empresaAtiva() || {}).razao || '' }); }
  function camposComprovante(x) { return [x.v, x.c, x.s, x.acao, x.nome, x.cpf || '', x.email || '', x.em, x.h, x.metodo || '', x.ass || '', x.motivo || '', x.disp || '', x.geo || ''].join('|'); }

  // ---------- lista ----------
  function telaLista(el) {
    const l = lista(); const cont = {}; l.forEach(function (c) { const s = K.situacao(c); cont[s] = (cont[s] || 0) + 1; });
    const q = Nucleo.normalizar(est.busca);
    const vis = l.filter(function (c) { return (!est.filtro || K.situacao(c) === est.filtro) && (!q || Nucleo.normalizar(c.titulo + ' ' + c.signatarios.map(function (s) { return s.nome; }).join(' ')).indexOf(q) >= 0); }).sort(function (a, b) { return String(b.atualizadoEm || b.criadoEm).localeCompare(String(a.atualizadoEm || a.criadoEm)); });
    el.innerHTML = abasCt('lista') + '<div class="kpis ct-kpis">' + [['enviado', 'Aguardando assinaturas'], ['assinado', 'Assinados'], ['recusado', 'Recusados'], ['expirado', 'Prazo vencido'], ['rascunho', 'Rascunhos']].map(function (x) { return '<button type="button" class="ct-kpi' + (est.filtro === x[0] ? ' on' : '') + '" data-filtro="' + x[0] + '"><span>' + x[1] + '</span><b>' + (cont[x[0]] || 0) + '</b></button>'; }).join('') + '</div>' +
      '<div class="barra-acoes"><input type="search" id="ct-busca" placeholder="Buscar por documento ou signatário" value="' + esc(est.busca) + '" aria-label="Buscar contratos"><div class="grupo-botoes"><button class="btn" data-a="receber">↩ Registrar assinatura recebida</button><button class="btn primario" data-a="novo">+ Novo documento</button></div></div>' +
      (vis.length ? '<div class="ct-lista">' + vis.map(function (c) { const p = K.progresso(c); return '<a class="ct-item" href="#/contratos/ver/' + c.id + '"><div class="ct-item-t"><b>' + esc(c.titulo) + '</b>' + rotSit(c) + '</div><div class="ct-item-s">' + c.signatarios.map(function (s) { return '<span class="ct-sig ' + (s.assinadoEm ? 'ok' : s.recusadoEm ? 'nao' : '') + '" title="' + esc(s.nome + ' · ' + (s.assinadoEm ? 'assinou' : s.recusadoEm ? 'recusou' : 'pendente')) + '">' + esc(s.nome.split(' ')[0]) + '</span>'; }).join('') + '</div><div class="ct-item-p"><div class="barra"><i style="width:' + Math.round(p.pct * 100) + '%"></i></div><small>' + p.feitas + ' de ' + p.total + ' assinaturas' + (c.prazo ? ' · prazo ' + data(c.prazo) : '') + '</small></div></a>'; }).join('') + '</div>'
        : UI.vazio(l.length ? 'Nada com esse filtro' : 'Nenhum documento ainda', 'Envie um contrato, proposta ou termo para assinatura eletrônica. Você pode anexar um PDF ou gerar a partir de um modelo da Seven.', '<button class="btn primario" data-a="novo">+ Novo documento</button>'));
    el.onclick = function (ev) {
      const f = ev.target.closest('[data-filtro]'); if (f) { est.filtro = est.filtro === f.dataset.filtro ? '' : f.dataset.filtro; telaLista(el); return; }
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'novo') { const c = novo(); location.hash = '#/contratos/editar/' + c.id; }
      if (b.dataset.a === 'receber') receberComprovante();
    };
    const bu = el.querySelector('#ct-busca'); bu.oninput = function () { est.busca = bu.value; clearTimeout(bu._t); bu._t = setTimeout(function () { telaLista(el); const n = el.querySelector('#ct-busca'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  }
  function abasCt(a) { return UI.abas([{ id: 'lista', t: 'Documentos' }, { id: 'validar', t: 'Validar documento' }, { id: 'sobre', t: 'Validade jurídica' }], a, 'contratos'); }
  function novo() {
    const c = { id: Dados.id('ct'), titulo: 'Novo documento', empresaId: Dados.e.empresaAtiva, criadoEm: new Date().toISOString(), criadoPor: Dados.e.config.responsavel || 'Seven', situacao: 'rascunho', sequencial: false, prazo: '', mensagem: 'Olá! Segue o documento para sua assinatura eletrônica. Qualquer dúvida, estou à disposição.', documento: null, signatarios: [], trilha: [] };
    K.evento(c, 'criado', 'Documento criado por ' + c.criadoPor + '.'); e().contratos.unshift(c); salvar(); return c;
  }

  // ---------- editor (Documento → Signatários → Mensagem e prazo → Enviar) ----------
  const ETAPAS = [['documento', '1', 'Documento'], ['signatarios', '2', 'Signatários'], ['envio', '3', 'Mensagem e prazo'], ['revisar', '4', 'Revisar e enviar']];
  function telaEditor(el, id) {
    const c = contrato(id); if (!c) { el.innerHTML = UI.vazio('Documento não encontrado', '', '<a class="btn" href="#/contratos">Voltar</a>'); return; }
    if (c.situacao !== 'rascunho') { location.hash = '#/contratos/ver/' + c.id; return; }
    const et = est.etapa[c.id] || 'documento';
    let corpo = '';
    if (et === 'documento') corpo = '<section class="cartao"><h3>Qual documento será assinado?</h3>' + campo('Nome do documento', '<input data-c="titulo" value="' + esc(c.titulo) + '">') +
      (c.documento ? '<div class="ct-doc"><span class="ct-pdf">PDF</span><div><b>' + esc(c.documento.nome) + '</b><small>' + Math.round((c.documento.tamanho || 0) / 1024) + ' KB · código ' + esc(K.codigoVerificacao(c.documento.hash)) + (c.documento.origem === 'modelo' ? ' · gerado do modelo' : '') + '</small></div><button type="button" class="btn mini" data-a="ver-doc">Ver</button><button type="button" class="btn mini fantasma perigo" data-a="tirar-doc">Trocar</button></div>' :
        '<div class="ct-opcoes"><button type="button" class="ct-op" data-a="anexar"><span>⇪</span><b>Enviar um PDF</b><small>Contrato, proposta, procuração, termo… do seu computador.</small></button><button type="button" class="ct-op" data-a="modelo"><span>✎</span><b>Usar um modelo da Seven</b><small>Prestação de serviços de BPO, confidencialidade ou aditivo, já com os dados do cliente.</small></button></div>') +
      '<p class="mini mudo">O documento recebe uma impressão digital (SHA-256). Se alguém mudar uma vírgula depois, o código muda e a assinatura deixa de valer para aquele arquivo.</p></section>';
    if (et === 'signatarios') corpo = '<section class="cartao"><header class="ct-cab"><h3>Quem vai assinar?</h3><button type="button" class="btn primario" data-a="add-sig">+ Signatário</button></header>' +
      '<label class="check-inline ct-ck"><input type="checkbox" data-c="sequencial"' + (c.sequencial ? ' checked' : '') + '> Definir ordem de assinatura (cada um assina na sua vez)</label>' +
      (c.signatarios.length ? '<div class="ct-sigs">' + c.signatarios.map(function (s, i) { return '<div class="ct-sig-ed" data-sid="' + s.id + '">' + (c.sequencial ? '<label class="ct-ordem">Ordem<input type="number" min="1" max="20" data-s="ordem" value="' + (s.ordem || 1) + '"></label>' : '<span class="ct-num">' + (i + 1) + '</span>') +
        '<div class="ct-sig-campos">' + campo('Nome completo', '<input data-s="nome" value="' + esc(s.nome) + '" required>') + campo('E-mail', '<input type="email" data-s="email" value="' + esc(s.email || '') + '">') + campo('WhatsApp', '<input data-s="telefone" inputmode="tel" value="' + esc(s.telefone || '') + '" placeholder="(61) 99999-9999">') + campo('CPF', '<input data-s="cpf" inputmode="numeric" value="' + esc(s.cpf || '') + '" placeholder="opcional, recomendado">') + campo('Assina como', '<select data-s="papel">' + opcoes(Object.keys(K.PAPEIS).map(function (k) { return { v: k, t: K.PAPEIS[k] }; }), s.papel) + '</select>') + '</div><button type="button" class="icone" data-a="tirar-sig" aria-label="Remover signatário">×</button></div>'; }).join('') + '</div>' : '<p class="mudo">Nenhum signatário. Adicione as partes e as testemunhas.</p>') +
      '<div class="grupo-botoes"><button type="button" class="btn fantasma" data-a="eu">+ Eu assino também</button>' + (Dados.empresaAtiva() ? '<button type="button" class="btn fantasma" data-a="cliente">+ Representante do cliente</button>' : '') + '</div></section>';
    if (et === 'envio') corpo = '<section class="cartao"><h3>Mensagem e prazo</h3>' + campo('Mensagem para os signatários', '<textarea data-c="mensagem" rows="4">' + esc(c.mensagem) + '</textarea>', 'Vai junto com o link. Você revisa o texto antes de enviar cada mensagem.') +
      '<div class="linha">' + campo('Prazo para assinar', '<input type="date" data-c="prazo" value="' + esc(c.prazo || '') + '">', 'Depois dele, o link deixa de aceitar assinaturas.') + '</div>' +
      '<label class="check-inline ct-ck"><input type="checkbox" data-c="lembreteAgenda"' + (c.lembreteAgenda ? ' checked' : '') + '> Criar tarefa na Seven Agenda para cobrar as assinaturas no prazo</label></section>';
    if (et === 'revisar') { const er = K.validarEnvio(c); corpo = '<section class="cartao"><h3>Revisar e enviar</h3><dl class="ct-rev"><dt>Documento</dt><dd>' + esc(c.titulo) + (c.documento ? ' · código ' + esc(K.codigoVerificacao(c.documento.hash)) : '') + '</dd><dt>Signatários</dt><dd>' + (c.signatarios.map(function (s) { return esc(s.nome) + ' (' + esc(K.PAPEIS[s.papel] || '') + (c.sequencial ? ', ' + (s.ordem || 1) + 'º' : '') + ')'; }).join(', ') || '—') + '</dd><dt>Ordem</dt><dd>' + (c.sequencial ? 'Na ordem definida' : 'Todos ao mesmo tempo') + '</dd><dt>Prazo</dt><dd>' + (c.prazo ? data(c.prazo) : 'Sem prazo') + '</dd></dl>' +
      (er.length ? '<ul class="nf-val">' + er.map(function (x) { return '<li class="erro">' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="ok">Tudo certo para enviar.</p>') +
      '<div class="grupo-botoes"><button type="button" class="btn primario" data-a="enviar"' + (er.length ? ' disabled' : '') + '>Enviar para assinatura</button></div><p class="mini mudo">Ao enviar, o documento fica travado (não pode mais ser alterado) e cada signatário ganha um link próprio.</p></section>'; }
    const idx = ETAPAS.findIndex(function (x) { return x[0] === et; });
    el.innerHTML = '<p class="migalhas"><a href="#/contratos">Seven Contrato</a> › ' + esc(c.titulo) + ' ' + rotSit(c) + '</p><nav class="ct-passos">' + ETAPAS.map(function (x, i) { return '<button type="button" class="ct-passo' + (x[0] === et ? ' on' : '') + (i < idx ? ' feito' : '') + '" data-etapa="' + x[0] + '"><span>' + x[1] + '</span>' + x[2] + '</button>'; }).join('') + '</nav>' + corpo +
      '<div class="ct-nav">' + (idx > 0 ? '<button type="button" class="btn" data-etapa="' + ETAPAS[idx - 1][0] + '">← Voltar</button>' : '<button type="button" class="btn fantasma perigo" data-a="excluir">Excluir rascunho</button>') + (idx < ETAPAS.length - 1 ? '<button type="button" class="btn primario" data-etapa="' + ETAPAS[idx + 1][0] + '">Continuar →</button>' : '') + '</div>';
    el.oninput = el.onchange = function (ev) {
      const t = ev.target;
      if (t.dataset.c) { c[t.dataset.c] = t.type === 'checkbox' ? t.checked : t.value; salvar(); if (t.type === 'checkbox' && t.dataset.c === 'sequencial' && ev.type === 'change') { c.signatarios.forEach(function (s, i) { s.ordem = s.ordem || i + 1; }); App.redesenhar(); } return; }
      if (t.dataset.s) { const s = c.signatarios.find(function (x) { return x.id === t.closest('[data-sid]').dataset.sid; }); s[t.dataset.s] = t.dataset.s === 'ordem' ? Number(t.value) || 1 : t.value; salvar(); }
    };
    el.onclick = async function (ev) {
      const p = ev.target.closest('[data-etapa]'); if (p) { est.etapa[c.id] = p.dataset.etapa; App.redesenhar(); return; }
      const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'anexar') { const f = await UI.escolherArquivo('application/pdf,.pdf'); if (!f) return; if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) return aviso('Envie um arquivo PDF.', 'erro'); await guardarDoc(c, f, f.name, 'upload'); if (/^Novo documento$/.test(c.titulo)) c.titulo = f.name.replace(/\.pdf$/i, ''); salvar(); App.redesenhar(); }
      if (a === 'modelo') { await doModelo(c); App.redesenhar(); }
      if (a === 'ver-doc') { const blob = await Dados.lerArquivo(c.documento.arq); UI.abrirArquivo(blob, c.documento.nome); }
      if (a === 'tirar-doc') { c.documento = null; salvar(); App.redesenhar(); }
      if (a === 'add-sig' || a === 'eu' || a === 'cliente') { const emp = Dados.empresaAtiva() || {}; const base = a === 'eu' ? { nome: Dados.e.config.responsavel || '', papel: 'contratado' } : a === 'cliente' ? { nome: emp.representante || '', email: emp.email || '', telefone: emp.telefone || '', papel: 'contratante' } : { nome: '', papel: 'parte' }; c.signatarios.push(Object.assign({ id: Dados.id('sg'), email: '', telefone: '', cpf: '', ordem: c.signatarios.length + 1, token: K.token(16) }, base)); salvar(); App.redesenhar(); }
      if (a === 'tirar-sig') { const sid = b.closest('[data-sid]').dataset.sid; c.signatarios = c.signatarios.filter(function (s) { return s.id !== sid; }); salvar(); App.redesenhar(); }
      if (a === 'excluir' && await confirmar('Excluir rascunho', 'Excluir este rascunho?', 'Excluir')) { e().contratos = e().contratos.filter(function (x) { return x !== c; }); salvar(); location.hash = '#/contratos'; }
      if (a === 'enviar') {
        const er = K.validarEnvio(c); if (er.length) return aviso(er[0], 'erro');
        c.situacao = 'enviado'; c.enviadoEm = new Date().toISOString(); c.atualizadoEm = c.enviadoEm;
        K.evento(c, 'enviado', 'Enviado para assinatura (' + c.signatarios.length + ' signatário(s), ' + (c.sequencial ? 'em ordem' : 'todos ao mesmo tempo') + ').');
        if (c.lembreteAgenda && c.prazo && Telas.agenda && Telas.agenda.criar) Telas.agenda.criar('Cobrar assinaturas: ' + c.titulo, { data: c.prazo, tags: ['contrato'] });
        salvar(); location.hash = '#/contratos/ver/' + c.id; aviso('Pronto! Agora envie o link de cada signatário.');
      }
    };
  }
  async function guardarDoc(c, blob, nome, origem, texto) {
    const buf = await blob.arrayBuffer(); const hash = await K.sha256(buf); const arq = Dados.id('ctd');
    await Dados.guardarArquivo(arq, new Blob([buf], { type: 'application/pdf' }));
    c.documento = { arq: arq, nome: nome, hash: hash, tamanho: buf.byteLength, origem: origem, texto: texto || null };
    K.evento(c, 'documento', 'Documento "' + nome + '" anexado (SHA-256 ' + hash.slice(0, 16) + '…).');
  }
  async function doModelo(c) {
    const emp = Dados.empresaAtiva() || {};
    const f = await modal({ titulo: 'Gerar documento a partir de modelo', largo: true, botao: 'Gerar PDF', corpo: campo('Modelo', '<select name="m" id="ct-m">' + opcoes(Object.keys(MODELOS).map(function (k) { return { v: k, t: MODELOS[k].t }; })) + '</select>') + '<div id="ct-vars"></div><p class="mini mudo">Campos em branco ficam entre [COLCHETES] para você revisar antes de enviar.</p>',
      aoAbrir: function (form) {
        const pinta = function () {
          const m = MODELOS[form.m.value]; const vars = (m.texto.match(/\{(\w+)\}/g) || []).map(function (x) { return x.slice(1, -1); }).filter(function (x, i, a) { return a.indexOf(x) === i && x !== 'dataExtenso'; });
          const pad = { cliente: emp.razao || '', cnpjCliente: emp.cnpj ? UI.cnpj(emp.cnpj) : '', enderecoCliente: [emp.logradouro, emp.municipio, emp.uf].filter(Boolean).join(', '), representanteCliente: emp.representante || '', contratada: 'SEVEN', representanteContratada: Dados.e.config.responsavel || 'Lucas Neves', cidade: emp.municipio || 'Brasília', foro: emp.municipio || 'Brasília', prazoMeses: '12', diaVencimento: '10', inicio: new Date().toLocaleDateString('pt-BR'), finalidade: 'a prestação de serviços de BPO de licitações' };
          form.querySelector('#ct-vars').innerHTML = '<div class="ct-vars">' + vars.map(function (v) { return campo(v.replace(/([A-Z])/g, ' $1').replace(/^./, function (x) { return x.toUpperCase(); }), '<input name="v_' + v + '" value="' + esc(pad[v] || '') + '">'); }).join('') + '</div>';
        };
        form.m.onchange = pinta; pinta();
      } });
    if (!f) return;
    const m = MODELOS[f.get('m')]; const v = { dataExtenso: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) }; f.forEach(function (val, k) { if (k.indexOf('v_') === 0) v[k.slice(2)] = String(val).trim(); });
    const texto = K.preencher(m.texto, v);
    try { const blob = await textoParaPdf(m.t, texto); await guardarDoc(c, blob, m.t + '.pdf', 'modelo', texto); if (/^Novo documento$/.test(c.titulo)) c.titulo = m.t + (v.cliente ? ' · ' + v.cliente : ''); salvar(); const pend = K.pendencias(texto); aviso(pend.length ? 'PDF gerado. Revise ' + pend.length + ' campo(s) em branco: ' + pend.join(', ') : 'PDF gerado a partir do modelo.', pend.length ? 'erro' : ''); }
    catch (x) { aviso(x.message, 'erro'); }
  }
  // Texto → PDF A4 com quebra de linha (pdf-lib).
  async function textoParaPdf(titulo, texto) {
    const L = await carregarPdfLib(); const doc = await L.PDFDocument.create(); doc.setTitle(titulo); doc.setProducer('Seven Contrato · Seven');
    const fonte = await doc.embedFont(L.StandardFonts.Helvetica), negrito = await doc.embedFont(L.StandardFonts.HelveticaBold);
    const W = 595.28, H = 841.89, M = 56, larg = W - 2 * M; let pg = doc.addPage([W, H]); let y = H - M;
    const quebrar = function (t, f, tam) { const out = []; let lin = ''; String(t).split(' ').forEach(function (p) { const tst = lin ? lin + ' ' + p : p; if (lin && f.widthOfTextAtSize(tst, tam) > larg) { out.push(lin); lin = p; } else lin = tst; }); out.push(lin); return out; };
    String(texto).split('\n').forEach(function (par, i) {
      const tit = i === 0 || /^(CLÁUSULA|\d+\.|PARTE|CONTRATANTE|CONTRATADA)/.test(par) && par === par.toUpperCase();
      const f = tit ? negrito : fonte, tam = i === 0 ? 13 : 10.5;
      const linhas = par.trim() ? quebrar(par, f, tam) : [''];
      linhas.forEach(function (ln) { if (y < M + 20) { pg = doc.addPage([W, H]); y = H - M; } pg.drawText(ln, { x: M, y: y, size: tam, font: f }); y -= tam * 1.45; });
      if (!par.trim()) y -= 2;
    });
    return new Blob([await doc.save()], { type: 'application/pdf' });
  }

  // ---------- acompanhar ----------
  function telaVer(el, id) {
    const c = contrato(id); if (!c) { el.innerHTML = UI.vazio('Documento não encontrado', '', '<a class="btn" href="#/contratos">Voltar</a>'); return; }
    if (c.situacao === 'rascunho') { location.hash = '#/contratos/editar/' + c.id; return; }
    const s0 = K.situacao(c); if (s0 !== c.situacaoVista) { if (s0 === 'assinado' && !c.concluidoEm) { c.concluidoEm = new Date().toISOString(); K.evento(c, 'concluido', 'Todas as assinaturas recebidas. Documento concluído.'); } c.situacaoVista = s0; salvar(); }
    const p = K.progresso(c);
    el.innerHTML = '<p class="migalhas"><a href="#/contratos">Seven Contrato</a> › ' + esc(c.titulo) + '</p>' +
      '<section class="cartao ct-topo"><div><h2>' + esc(c.titulo) + '</h2><p class="mini mudo">Código de verificação <b>' + esc(K.codigoVerificacao(c.documento.hash)) + '</b> · enviado ' + dataHora(c.enviadoEm) + (c.prazo ? ' · prazo ' + data(c.prazo) : '') + '</p></div>' + rotSit(c) + '<div class="ct-prog"><div class="barra"><i style="width:' + Math.round(p.pct * 100) + '%"></i></div><small>' + p.feitas + ' de ' + p.total + ' assinaturas</small></div>' +
      '<div class="grupo-botoes"><button class="btn" data-a="ver-doc">Ver original</button>' + (s0 === 'assinado' ? '<button class="btn primario" data-a="final">⬇ Baixar PDF assinado</button>' : '<button class="btn" data-a="baixar-doc">⬇ Baixar PDF para enviar</button><button class="btn" data-a="receber">↩ Registrar assinatura recebida</button>') + (s0 !== 'assinado' && s0 !== 'cancelado' ? '<button class="btn fantasma perigo" data-a="cancelar">Cancelar</button>' : '') + '</div></section>' +
      '<section class="cartao"><h3>Signatários</h3><div class="ct-sig-lista">' + c.signatarios.map(function (s) { const pode = K.podeAssinar(c, s.id); return '<div class="ct-sig-l ' + (s.assinadoEm ? 'ok' : s.recusadoEm ? 'nao' : '') + '" data-sid="' + s.id + '"><span class="ct-sig-ic">' + (s.assinadoEm ? '✓' : s.recusadoEm ? '✕' : c.sequencial ? (s.ordem || 1) + 'º' : '…') + '</span><div class="ct-sig-info"><b>' + esc(s.nome) + '</b><small>' + esc(K.PAPEIS[s.papel] || '') + (s.email ? ' · ' + esc(s.email) : '') + (s.telefone ? ' · ' + esc(s.telefone) : '') + '</small><small>' + (s.assinadoEm ? 'Assinou em ' + dataHora(s.assinadoEm) : s.recusadoEm ? 'Recusou em ' + dataHora(s.recusadoEm) + ': ' + esc(s.motivo || '') : pode ? 'Pode assinar agora' : c.sequencial ? 'Aguardando a vez' : 'Pendente') + '</small></div>' +
        (!s.assinadoEm && !s.recusadoEm && s0 === 'enviado' ? '<div class="grupo-botoes"><button class="btn mini" data-a="whats"' + (pode ? '' : ' disabled') + '>WhatsApp</button><button class="btn mini" data-a="email"' + (pode ? '' : ' disabled') + '>E-mail</button><button class="btn mini" data-a="copiar"' + (pode ? '' : ' disabled') + '>Copiar link</button><button class="btn mini fantasma" data-a="presencial"' + (pode ? '' : ' disabled') + ' title="O signatário assina na sua frente, neste dispositivo">Assinar aqui</button></div>' : '') + '</div>'; }).join('') + '</div></section>' +
      '<section class="cartao"><h3>Histórico (trilha de auditoria)</h3><ol class="ct-trilha">' + (c.trilha || []).slice().reverse().map(function (t) { return '<li class="ct-tr-' + esc(t.tipo) + '"><time>' + dataHora(t.em) + '</time><span>' + esc(t.texto) + '</span></li>'; }).join('') + '</ol></section>';
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; const sEl = b.closest('[data-sid]'); const s = sEl && c.signatarios.find(function (x) { return x.id === sEl.dataset.sid; });
      if (a === 'ver-doc' || a === 'baixar-doc') { const blob = await Dados.lerArquivo(c.documento.arq); if (!blob) return aviso('O PDF não está neste navegador.', 'erro'); if (a === 'ver-doc') UI.abrirArquivo(blob, c.documento.nome); else UI.baixar(c.documento.nome, blob); }
      if (a === 'final') baixarFinal(c);
      if (a === 'receber') receberComprovante(c);
      if (a === 'cancelar' && await confirmar('Cancelar documento', 'Os links deixam de aceitar assinaturas. Continuar?', 'Cancelar documento')) { c.situacao = 'cancelado'; K.evento(c, 'cancelado', 'Documento cancelado.'); salvar(); App.redesenhar(); }
      if (a === 'copiar') { const l = linkAssinatura(c, s); try { await navigator.clipboard.writeText(l); aviso('Link copiado. Envie junto com o PDF.'); } catch (x) { await modal({ titulo: 'Link de ' + s.nome, botao: false, corpo: '<textarea rows="4" readonly>' + esc(l) + '</textarea>' }); } K.evento(c, 'link', 'Link de assinatura copiado para ' + s.nome + '.'); salvar(); App.redesenhar(); }
      if (a === 'whats' || a === 'email') enviarLink(c, s, a);
      if (a === 'presencial') { sessionStorage && sessionStorage.setItem('ct-presencial', c.id); location.hash = '#/assinar/' + linkAssinatura(c, s).split('#/assinar/')[1]; }
    };
  }
  // Mostra o texto antes de abrir o WhatsApp/e-mail: quem envia é você.
  async function enviarLink(c, s, canal) {
    const l = linkAssinatura(c, s);
    const txt = 'Olá, ' + s.nome.split(' ')[0] + '! ' + c.mensagem + '\n\nDocumento: ' + c.titulo + '\nCódigo de verificação: ' + K.codigoVerificacao(c.documento.hash) + '\n\n1. Abra o PDF que enviei junto com esta mensagem.\n2. Acesse o link, carregue o PDF (o sistema confere se é o mesmo arquivo) e assine:\n' + l + '\n3. Ao final, me devolva o comprovante que aparece na tela.' + (c.prazo ? '\n\nPrazo: ' + data(c.prazo) + '.' : '') + '\n\nLucas Neves | Seven';
    const f = await modal({ titulo: 'Revise a mensagem para ' + s.nome, largo: true, botao: canal === 'whats' ? 'Abrir no WhatsApp' : 'Abrir no e-mail', corpo: '<textarea name="t" rows="12">' + esc(txt) + '</textarea><p class="mini alerta">Anexe o PDF do documento na conversa (botão "Baixar PDF para enviar"). O link sozinho não leva o arquivo.</p>' });
    if (!f) return; const t = f.get('t');
    if (canal === 'whats') { const tel = K.soDigitos(s.telefone); window.open('https://wa.me/' + (tel ? (tel.length <= 11 ? '55' + tel : tel) : '') + '?text=' + encodeURIComponent(t), '_blank', 'noopener'); }
    else window.open('mailto:' + encodeURIComponent(s.email || '') + '?subject=' + encodeURIComponent('Assinatura: ' + c.titulo) + '&body=' + encodeURIComponent(t), '_blank');
    K.evento(c, 'link', 'Link enviado a ' + s.nome + ' por ' + (canal === 'whats' ? 'WhatsApp' : 'e-mail') + '.'); salvar(); App.redesenhar();
  }
  // Recebe o comprovante (código colado ou arquivo .json) e confere a autenticidade.
  async function receberComprovante(cAlvo) {
    const f = await modal({ titulo: 'Registrar assinatura recebida', largo: true, botao: 'Conferir e registrar', corpo: '<p class="mini">Cole o código que o signatário devolveu (começa com <b>P7-ASS-</b>) ou escolha o arquivo do comprovante.</p><textarea name="codigo" rows="5" placeholder="P7-ASS-…"></textarea><p><button type="button" class="btn mini" id="ct-arq">Escolher arquivo do comprovante</button></p>',
      aoAbrir: function (form) { form.querySelector('#ct-arq').onclick = async function () { const a = await UI.escolherArquivo('.json,.txt'); if (a) form.codigo.value = (await UI.lerArquivoTexto(a)).trim(); }; } });
    if (!f) return;
    try { const r = await registrar(String(f.get('codigo') || '').trim(), cAlvo); aviso(r); App.redesenhar(); } catch (x) { aviso(x.message, 'erro'); }
  }
  async function registrar(codigo, cAlvo) {
    const m = codigo.match(/P7-ASS-([A-Za-z0-9_-]+)/); if (!m) throw new Error('Código não reconhecido. Ele começa com P7-ASS-.');
    let x; try { x = deB64url(m[1]); } catch (err) { throw new Error('Código incompleto ou alterado.'); }
    const c = contrato(x.c); if (!c) throw new Error('Esse comprovante é de um documento que não está neste navegador.');
    if (cAlvo && cAlvo.id !== c.id) throw new Error('Esse comprovante é de outro documento: ' + c.titulo + '.');
    const s = c.signatarios.find(function (y) { return y.id === x.s; }); if (!s) throw new Error('Signatário não encontrado neste documento.');
    if (x.h !== c.documento.hash) throw new Error('O signatário assinou um arquivo diferente do enviado (o código não confere). Não registrado.');
    if (await hmac(s.token, camposComprovante(x)) !== x.mac) throw new Error('Comprovante não é autêntico (assinatura digital do link não confere).');
    if (s.assinadoEm || s.recusadoEm) return 'Esse comprovante já tinha sido registrado.';
    if (c.situacao !== 'enviado' || K.situacao(c) === 'expirado') throw new Error('O documento não está mais aceitando assinaturas.');
    if (x.acao === 'recusa') { s.recusadoEm = x.em; s.motivo = x.motivo; K.evento(c, 'recusado', s.nome + ' recusou: ' + x.motivo); }
    else { Object.assign(s, { assinadoEm: x.em, cpf: x.cpf || s.cpf, email: x.email || s.email, evidencias: { metodo: x.metodo, assinatura: x.ass, dispositivo: x.disp, geo: x.geo, hashVisto: x.h, mac: x.mac } }); K.evento(c, 'assinado', s.nome + ' assinou' + (x.cpf ? ' (CPF ' + K.mascaraCpf(x.cpf) + ')' : '') + '. Comprovante autêntico e documento conferido.'); }
    c.atualizadoEm = new Date().toISOString(); salvar();
    return x.acao === 'recusa' ? 'Recusa de ' + s.nome + ' registrada.' : 'Assinatura de ' + s.nome + ' registrada.' + (K.situacao(c) === 'assinado' ? ' Todas as assinaturas recebidas!' : '');
  }
  // PDF final: original + página de registro com as assinaturas.
  async function baixarFinal(c) {
    try {
      const L = await carregarPdfLib(); const orig = await Dados.lerArquivo(c.documento.arq); if (!orig) throw new Error('O PDF original não está neste navegador.');
      const doc = await L.PDFDocument.load(await orig.arrayBuffer(), { ignoreEncryption: true });
      const fonte = await doc.embedFont(L.StandardFonts.Helvetica), negrito = await doc.embedFont(L.StandardFonts.HelveticaBold);
      const W = 595.28, H = 841.89, M = 50; let pg = doc.addPage([W, H]); let y = H - M;
      const nova = function () { pg = doc.addPage([W, H]); y = H - M; };
      const linha = function (t, f, tam, cor) { const lim = W - 2 * M; let resto = String(t); while (resto) { let n = resto.length; while (f.widthOfTextAtSize(resto.slice(0, n), tam) > lim && n > 10) n--; if (n < resto.length) { const sp = resto.lastIndexOf(' ', n); if (sp > 10) n = sp; } if (y < M + 30) nova(); pg.drawText(resto.slice(0, n).trim(), { x: M, y: y, size: tam, font: f, color: cor || L.rgb(0, 0, 0) }); y -= tam * 1.5; resto = resto.slice(n).trim(); } };
      pg.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: L.rgb(0.71, 0.55, 0.25) });
      K.registro(c).forEach(function (t, i) { linha(t, i === 0 ? negrito : fonte, i === 0 ? 14 : 9.5); });
      y -= 8;
      for (const s of c.signatarios.filter(function (x) { return x.assinadoEm; })) {
        if (y < M + 90) nova();
        linha(s.nome + ' · ' + (K.PAPEIS[s.papel] || ''), negrito, 10);
        const ev = s.evidencias || {};
        if (ev.metodo === 'desenho' && ev.assinatura) { const pts = String(ev.assinatura).split(';').map(function (tr) { return tr.split(' ').map(function (p) { return p.split(',').map(Number); }); }); pts.forEach(function (tr) { for (let i = 1; i < tr.length; i++) pg.drawLine({ start: { x: M + tr[i - 1][0] * 2, y: y - 6 - tr[i - 1][1] * 0.5 }, end: { x: M + tr[i][0] * 2, y: y - 6 - tr[i][1] * 0.5 }, thickness: 1.2, color: L.rgb(0.05, 0.1, 0.3) }); }); y -= 58; }
        else { pg.drawText(ev.assinatura || s.nome, { x: M, y: y - 18, size: 18, font: await doc.embedFont(L.StandardFonts.TimesRomanItalic), color: L.rgb(0.05, 0.1, 0.3) }); y -= 30; }
        pg.drawLine({ start: { x: M, y: y }, end: { x: M + 220, y: y }, thickness: 0.5, color: L.rgb(0.5, 0.5, 0.5) }); y -= 16;
      }
      doc.setSubject('Assinado eletronicamente · código ' + K.codigoVerificacao(c.documento.hash));
      const bytes = await doc.save(); const hashFinal = await K.sha256(bytes);
      if (!c.final || c.final.hash !== hashFinal) { const arq = Dados.id('ctf'); await Dados.guardarArquivo(arq, new Blob([bytes], { type: 'application/pdf' })); c.final = { arq: arq, hash: hashFinal, em: new Date().toISOString() }; K.evento(c, 'final', 'PDF assinado gerado (SHA-256 ' + hashFinal.slice(0, 16) + '…).'); salvar(); }
      UI.baixar(c.titulo.replace(/[^\w\- ]+/g, '').trim() + ' - assinado.pdf', new Blob([bytes], { type: 'application/pdf' }));
    } catch (x) { aviso(x.message, 'erro'); }
  }

  // ---------- validar ----------
  function telaValidar(el) {
    el.innerHTML = abasCt('validar') + '<section class="cartao"><h3>Validar um documento</h3><p>Escolha um PDF ou digite o código de verificação. O sistema calcula a impressão digital (SHA-256) e procura nos documentos deste navegador: se bater, o arquivo é exatamente o que foi assinado.</p><div class="linha"><button class="btn primario" data-a="arquivo">Escolher PDF…</button>' + campo('ou código de verificação', '<input id="ct-cod" placeholder="ABCD-1234-…">') + '</div><div id="ct-res"></div><p class="mini mudo">Documentos assinados com certificado ICP-Brasil ou gov.br são validados no <a href="https://validar.iti.gov.br/" target="_blank" rel="noopener">validador oficial do ITI ↗</a>.</p></section>';
    const mostrar = function (c, qual, hash) {
      el.querySelector('#ct-res').innerHTML = c ? '<div class="ct-valido"><b>✓ Documento reconhecido</b><p>' + esc(c.titulo) + ' · ' + (qual === 'final' ? 'PDF assinado (com o registro de assinaturas)' : 'documento original enviado para assinatura') + '</p><p class="mini">Situação: ' + esc(K.SITUACOES[K.situacao(c)]) + ' · ' + K.progresso(c).feitas + ' de ' + K.progresso(c).total + ' assinaturas</p><pre class="ct-reg">' + esc(K.registro(c).join('\n')) + '</pre></div>' : '<div class="ct-invalido"><b>✕ Não encontrado</b><p>Esse arquivo não corresponde a nenhum documento deste navegador' + (hash ? ' (SHA-256 ' + esc(hash.slice(0, 16)) + '…)' : '') + '. Qualquer alteração, por menor que seja, muda a impressão digital.</p></div>';
    };
    el.onclick = async function (ev) {
      if (!ev.target.closest('[data-a=arquivo]')) return; const a = await UI.escolherArquivo('application/pdf,.pdf'); if (!a) return;
      const h = await K.sha256(await a.arrayBuffer()); const c = e().contratos.find(function (x) { return (x.documento && x.documento.hash === h) || (x.final && x.final.hash === h); });
      mostrar(c, c && c.final && c.final.hash === h ? 'final' : 'original', h);
    };
    el.querySelector('#ct-cod').oninput = function () { const v = this.value.toUpperCase().replace(/[^0-9A-F]/g, ''); if (v.length < 16) { el.querySelector('#ct-res').innerHTML = ''; return; } const c = e().contratos.find(function (x) { return x.documento && x.documento.hash.toUpperCase().indexOf(v) === 0; }); mostrar(c, 'original'); };
  }
  function telaSobre(el) {
    el.innerHTML = abasCt('sobre') + '<section class="cartao nf-intro"><h3>Assinatura eletrônica vale?</h3><p class="nf-feynman">Vale. A lei brasileira aceita contratos assinados eletronicamente, desde que dê para provar <b>quem</b> assinou e que o documento <b>não mudou</b> depois. É isso que este módulo guarda: a impressão digital do arquivo (SHA-256), os dados de quem assinou, a data e a hora, o dispositivo e uma trilha de tudo o que aconteceu.</p>' +
      '<h4>Os três tipos (Lei 14.063/2020)</h4><ul><li><b>Simples:</b> identifica quem assinou e associa ao documento. É a deste módulo, com evidências reforçadas (CPF, aceite, hash conferido, comprovante protegido).</li><li><b>Avançada:</b> usa um meio que garante a ligação única com quem assina, como a conta gov.br prata ou ouro.</li><li><b>Qualificada:</b> usa certificado digital ICP-Brasil (e-CPF, e-CNPJ).</li></ul>' +
      '<h4>Quando usar o quê</h4><ul><li>Contratos entre empresas, propostas comerciais, termos com clientes da Seven: assinatura deste módulo, com CPF e testemunhas.</li><li>Documentos para órgãos públicos que exigem certificado ou gov.br (procurações, declarações em alguns portais): use o assinador gov.br ou o certificado digital e confira no validador do ITI.</li><li>Na dúvida sobre um contrato de alto valor, consulte o jurídico.</li></ul>' +
      '<h4>Fontes oficiais</h4><ul class="nf-fontes">' + LEIS.map(function (x) { return '<li><a href="' + esc(x[1]) + '" target="_blank" rel="noopener">' + esc(x[0]) + ' ↗</a></li>'; }).join('') + '</ul></section>';
  }

  // ---------- tela pública de assinatura (#/assinar/…) ----------
  function telaAssinar(el, codigo) {
    let x; try { x = deB64url(codigo); } catch (err) { el.innerHTML = UI.vazio('Link inválido', 'Peça um novo link a quem enviou o documento.'); return; }
    const presencial = (function () { try { return sessionStorage.getItem('ct-presencial') === x.c; } catch (er) { return false; } })();
    const st = { conferido: false, metodo: 'digitada', tracos: [] };
    el.innerHTML = '<div class="as"><header class="as-cab"><span class="as-selo">✍</span><div><small>Seven Contrato · Assinatura eletrônica</small><h2>' + esc(x.n) + '</h2><p>Enviado por ' + esc(x.de) + ' para <b>' + esc(x.nome) + '</b> (' + esc(K.PAPEIS[x.papel] || '') + ')</p></div></header>' +
      '<section class="cartao as-passo" id="as-1"><h3><span>1</span> Confira o documento</h3><p>Abra o PDF que você recebeu junto com o link. O sistema calcula a impressão digital do arquivo e confere se é <b>exatamente</b> o documento enviado para você.</p><p class="mini">Código de verificação esperado: <b>' + esc(K.codigoVerificacao(x.h)) + '</b></p><button class="btn primario" data-a="pdf">Abrir o PDF recebido…</button><div id="as-conf"></div><div id="as-ver"></div></section>' +
      '<section class="cartao as-passo" id="as-2" hidden><h3><span>2</span> Seus dados</h3><div class="linha">' + campo('Nome completo', '<input id="as-nome" value="' + esc(x.nome) + '" autocomplete="name">') + campo('CPF', '<input id="as-cpf" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00">') + campo('E-mail', '<input id="as-email" type="email" autocomplete="email">') + '</div></section>' +
      '<section class="cartao as-passo" id="as-3" hidden><h3><span>3</span> Sua assinatura</h3><div class="as-modos"><button type="button" class="btn ativo" data-m="digitada">Digitar</button><button type="button" class="btn" data-m="desenho">Desenhar</button></div><div id="as-dig"><input id="as-ass" class="as-ass" placeholder="Digite seu nome"></div><div id="as-des" hidden><canvas id="as-canvas" width="500" height="150" aria-label="Área para desenhar a assinatura"></canvas><button type="button" class="btn mini fantasma" data-a="limpar">Limpar</button></div>' +
      '<label class="check-inline ct-ck as-aceite"><input type="checkbox" id="as-aceite"> Li o documento e concordo em assiná-lo eletronicamente, com validade jurídica (Lei 14.063/2020).</label><label class="check-inline ct-ck"><input type="checkbox" id="as-geo"> Registrar minha localização aproximada (opcional)</label>' +
      '<div class="grupo-botoes"><button class="btn primario" data-a="assinar">Assinar</button><button class="btn fantasma perigo" data-a="recusar">Recusar</button></div></section><div id="as-fim"></div>' +
      '<p class="mini mudo as-rodape">Seus dados são usados só como evidência desta assinatura (LGPD). Nada é enviado a servidores: você devolve o comprovante a quem enviou o documento.</p></div>';
    const cv = el.querySelector('#as-canvas'); const g = cv.getContext('2d'); g.lineWidth = 2.2; g.lineCap = 'round'; g.strokeStyle = '#0a1929';
    let tr = null; const pt = function (ev) { const r = cv.getBoundingClientRect(); return [Math.round((ev.clientX - r.left) / r.width * 100), Math.round((ev.clientY - r.top) / r.height * 100)]; };
    cv.addEventListener('pointerdown', function (ev) { cv.setPointerCapture(ev.pointerId); tr = [pt(ev)]; st.tracos.push(tr); });
    cv.addEventListener('pointermove', function (ev) { if (!tr) return; const p = pt(ev); const a = tr[tr.length - 1]; if (Math.abs(a[0] - p[0]) + Math.abs(a[1] - p[1]) < 1) return; tr.push(p); g.beginPath(); g.moveTo(a[0] * cv.width / 100, a[1] * cv.height / 100); g.lineTo(p[0] * cv.width / 100, p[1] * cv.height / 100); g.stroke(); });
    const fim = function () { tr = null; }; cv.addEventListener('pointerup', fim); cv.addEventListener('pointercancel', fim);
    const comprovante = async function (acao, extra) {
      const geo = el.querySelector('#as-geo').checked ? await new Promise(function (ok) { if (!navigator.geolocation) return ok(''); navigator.geolocation.getCurrentPosition(function (p) { ok(p.coords.latitude.toFixed(2) + ',' + p.coords.longitude.toFixed(2)); }, function () { ok(''); }, { timeout: 8000 }); }) : '';
      const y = Object.assign({ v: 1, c: x.c, s: x.s, acao: acao, nome: el.querySelector('#as-nome').value.trim(), cpf: K.soDigitos(el.querySelector('#as-cpf').value), email: el.querySelector('#as-email').value.trim(), em: new Date().toISOString(), h: x.h, disp: (navigator.userAgentData && navigator.userAgentData.platform ? navigator.userAgentData.platform + ' · ' : '') + (Intl.DateTimeFormat().resolvedOptions().timeZone || ''), geo: geo }, extra);
      y.mac = await hmac(x.t, camposComprovante(y)); return 'P7-ASS-' + b64url(y);
    };
    const concluir = async function (cod, acao) {
      el.querySelectorAll('.as-passo').forEach(function (s) { s.hidden = true; });
      if (presencial) { try { const r = await registrar(cod); sessionStorage.removeItem('ct-presencial'); el.querySelector('#as-fim').innerHTML = '<section class="cartao as-ok"><h3>✓ ' + esc(r) + '</h3><a class="btn primario" href="#/contratos/ver/' + esc(x.c) + '">Voltar ao documento</a></section>'; } catch (er) { aviso(er.message, 'erro'); } return; }
      const msg = (acao === 'recusa' ? 'Recusei o documento "' : 'Assinei o documento "') + x.n + '". Segue o comprovante:\n\n' + cod;
      el.querySelector('#as-fim').innerHTML = '<section class="cartao as-ok"><h3>' + (acao === 'recusa' ? 'Recusa registrada' : '✓ Documento assinado') + '</h3><p>Agora devolva o comprovante a <b>' + esc(x.de) + '</b>. Sem ele a assinatura não fica registrada.</p><textarea rows="5" readonly id="as-cod">' + esc(cod) + '</textarea>' +
        '<div class="grupo-botoes"><button class="btn primario" data-a="copiar-cod">Copiar comprovante</button><button class="btn" data-a="baixar-cod">Baixar arquivo</button><a class="btn" href="https://wa.me/?text=' + encodeURIComponent(msg) + '" target="_blank" rel="noopener">Enviar pelo WhatsApp</a><a class="btn" href="mailto:?subject=' + encodeURIComponent('Comprovante: ' + x.n) + '&body=' + encodeURIComponent(msg) + '">Enviar por e-mail</a></div></section>';
      st.cod = cod;
    };
    el.onclick = async function (ev) {
      const m = ev.target.closest('[data-m]'); if (m) { st.metodo = m.dataset.m; el.querySelectorAll('[data-m]').forEach(function (b) { b.classList.toggle('ativo', b === m); }); el.querySelector('#as-dig').hidden = st.metodo !== 'digitada'; el.querySelector('#as-des').hidden = st.metodo !== 'desenho'; return; }
      const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'pdf') {
        let blob = await UI.escolherArquivo('application/pdf,.pdf'); if (!blob) return;
        const h = await K.sha256(await blob.arrayBuffer());
        if (h !== x.h) { st.conferido = false; el.querySelector('#as-conf').innerHTML = '<p class="ct-invalido">✕ Este arquivo <b>não é</b> o documento enviado para você (código ' + esc(K.codigoVerificacao(h)) + '). Não assine: peça o arquivo correto.</p>'; el.querySelector('#as-2').hidden = el.querySelector('#as-3').hidden = true; return; }
        st.conferido = true; el.querySelector('#as-conf').innerHTML = '<p class="ct-valido">✓ É o mesmo documento (código ' + esc(K.codigoVerificacao(h)) + '). Leia com atenção antes de assinar.</p>';
        const u = URL.createObjectURL(new Blob([await blob.arrayBuffer()], { type: 'application/pdf' })); el.querySelector('#as-ver').innerHTML = '<iframe class="as-pdf" src="' + u + '" title="Documento"></iframe>';
        el.querySelector('#as-2').hidden = el.querySelector('#as-3').hidden = false; el.querySelector('#as-ass').value = el.querySelector('#as-nome').value;
      }
      if (a === 'limpar') { st.tracos = []; g.clearRect(0, 0, cv.width, cv.height); }
      if (a === 'assinar') {
        if (!st.conferido) return aviso('Abra e confira o PDF primeiro.', 'erro');
        const nome = el.querySelector('#as-nome').value.trim(), cpf = el.querySelector('#as-cpf').value;
        if (nome.length < 5) return aviso('Informe seu nome completo.', 'erro');
        if (!K.cpfValido(cpf)) return aviso('Informe um CPF válido.', 'erro');
        if (!el.querySelector('#as-aceite').checked) return aviso('Marque que leu e concorda em assinar.', 'erro');
        let ass = '';
        if (st.metodo === 'desenho') { if (!st.tracos.length || st.tracos.reduce(function (s, t) { return s + t.length; }, 0) < 8) return aviso('Desenhe sua assinatura.', 'erro'); ass = st.tracos.map(function (t) { return t.map(function (p) { return p.join(','); }).join(' '); }).join(';'); }
        else { ass = el.querySelector('#as-ass').value.trim(); if (ass.length < 3) return aviso('Digite sua assinatura.', 'erro'); }
        concluir(await comprovante('assinatura', { metodo: st.metodo, ass: ass }), 'assinatura');
      }
      if (a === 'recusar') { const f = await modal({ titulo: 'Recusar o documento', botao: 'Recusar', corpo: campo('Motivo da recusa', '<textarea name="m" rows="3" required></textarea>') }); if (!f) return; concluir(await comprovante('recusa', { motivo: f.get('m').trim() }), 'recusa'); }
      if (a === 'copiar-cod') { try { await navigator.clipboard.writeText(st.cod); aviso('Comprovante copiado.'); } catch (er) { el.querySelector('#as-cod').select(); } }
      if (a === 'baixar-cod') UI.baixar('comprovante-assinatura.json', st.cod, 'application/json');
    };
  }

  Telas.contratos = {
    titulo: 'Seven Contrato',
    render: function (el, sub, param) {
      if (sub === 'editar') return telaEditor(el, param);
      if (sub === 'ver') return telaVer(el, param);
      if (sub === 'validar') return telaValidar(el);
      if (sub === 'sobre') return telaSobre(el);
      return telaLista(el);
    },
    registrar: registrar
  };
  Telas.assinar = { titulo: 'Seven Contrato · Assinar documento', render: function (el, sub) { telaAssinar(el, sub); } };
})();
