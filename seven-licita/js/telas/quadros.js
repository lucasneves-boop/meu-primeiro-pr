/* Seven Processo: clone funcional do Trello para gerir as licitações, do edital ao pagamento. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, data, dataHora, campo, opcoes, modal, confirmar, aviso } = UI;
  const K = Kanban;
  const DIA = 86400000;

  const CORES = ['vermelho', 'amarelo', 'verde', 'azul', 'rosa', 'dourado', 'preto', 'laranja', 'roxo', 'ciano', 'lima', 'cinza'];
  const FUNDOS = {
    ouro: 'linear-gradient(135deg,#b68d40,#5c4520)', preto: 'linear-gradient(135deg,#1c1c1c,#050505)', marinho: 'linear-gradient(135deg,#1d3a5c,#0a1929)',
    vinho: 'linear-gradient(135deg,#a11a1a,#3a0000)', petroleo: 'linear-gradient(135deg,#127a64,#073b31)', azul: 'linear-gradient(135deg,#2f7be0,#0b3c86)',
    roxo: 'linear-gradient(135deg,#7a55c7,#2d1f55)', rosa: 'linear-gradient(135deg,#e774bb,#8c2b67)', grafite: 'linear-gradient(135deg,#69727d,#2c3138)',
    areia: '#ece6da', verde: '#2e8b57', laranja: '#d9822b'
  };
  const FUNDOS_CLAROS = ['areia'];
  const REACOES = ['👍', '❤️', '🎉', '👀', '✅'];
  const LISTAS_LICITACAO = ['Oportunidade', 'Análise do edital', 'Proposta', 'Disputa', 'Habilitação / Recurso', 'Contrato', 'Empenho', 'Entrega', 'Pagamento', 'Concluído'];
  // Checklist sugerido por etapa (aplicado pela automação padrão ao entrar na lista).
  const CHECK_ETAPA = {
    'Oportunidade': ['Conferir objeto e prazo', 'Verificar se o cliente atende', 'Decidir participar (go / no-go)'],
    'Análise do edital': ['Grifar o edital no método Smart Colors (vermelho, amarelo, verde, azul, rosa)', 'Ler edital e termo de referência', 'Listar documentos de habilitação', 'Pedir esclarecimento / impugnar, se for o caso', 'Conferir garantia, amostra e visita técnica'],
    'Proposta': ['Formar preço (custo, impostos, frete, margem)', 'Aprovação do valor limite pelo cliente, por escrito', 'Cadastrar proposta no portal', 'Conferir status do envio'],
    'Disputa': ['Configurar robô / estratégia', 'Computador ligado e responsável na sessão', 'Play da disputa no dia'],
    'Habilitação / Recurso': ['Enviar proposta atualizada', 'Enviar documentos de habilitação', 'Acompanhar chat do pregoeiro', 'Intenção de recurso, se cabível'],
    'Contrato': ['Assinar ata / contrato', 'Registrar vigência e gestor do contrato', 'Garantia contratual, se exigida'],
    'Empenho': ['Receber nota de empenho', 'Conferir valor e itens do empenho'],
    'Entrega': ['Programar entrega', 'Emitir nota fiscal', 'Recolher atesto / recebimento'],
    'Pagamento': ['Acompanhar liquidação', 'Cobrar pagamento em atraso', 'Baixar pagamento']
  };
  const MODELOS = {
    licitacoes: { t: 'Licitações (do edital ao pagamento)', fundo: 'preto', listas: LISTAS_LICITACAO },
    execucao: { t: 'Execução de contratos', fundo: 'marinho', listas: ['Contratos vigentes', 'Aguardando empenho', 'Entrega programada', 'Faturado (NF emitida)', 'Aguardando pagamento', 'Pago', 'Encerrado'] },
    documentos: { t: 'Documentos e certidões', fundo: 'petroleo', listas: ['Em emissão', 'Válidos', 'Vencendo em 30 dias', 'Vencidos'] },
    simples: { t: 'Simples (A fazer / Fazendo / Feito)', fundo: 'ouro', listas: ['A fazer', 'Fazendo', 'Feito'] },
    vazio: { t: 'Em branco', fundo: 'grafite', listas: [] }
  };

  const est = { visao: 'quadro', filtros: {}, calModo: 'mes', calRef: null, ord: { col: '', dir: 1 }, inbox: false, sobre: null, sobreLista: null, busca: '', detalhes: true };
  const urls = {};

  function e() {
    const d = Dados.e;
    d.quadros = d.quadros || []; d.membros = d.membros && d.membros.length ? d.membros : [d.config.responsavel || 'Lucas Neves'];
    d.inbox = d.inbox || []; d.notificacoes = d.notificacoes || [];
    d.quadros.forEach(migrar);
    return d;
  }
  function eu() { return Dados.e.config.responsavel || e().membros[0]; }

  // Quadros criados nas versões anteriores ganham os campos novos sem perder nada.
  function migrar(q) {
    if (q._v === 2) return;
    q.config = q.config || { numeros: true, envelhecimento: false, capas: true, votacao: true };
    q.fundo = q.fundo || 'preto'; q.descricao = q.descricao || ''; q.botoes = q.botoes || []; q.botoesCartao = q.botoesCartao || [];
    q.automacoes = (q.automacoes || []).map(K.migrarRegra); q.atividade = q.atividade || []; q.campos = q.campos || []; q.etiquetas = q.etiquetas || [];
    q.seq = q.seq || 0;
    q.cartoes.slice().sort(function (a, b) { return new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0); }).forEach(function (c) { if (!c.num) c.num = ++q.seq; });
    q._v = 2;
  }

  function ctx() {
    return {
      id: Dados.id, agora: Date.now(), eu: eu(), checkEtapa: CHECK_ETAPA, registrar: registrar,
      notificar: function (t, c) { notificar(t, c ? link(quadroDe(c), c) : ''); }
    };
  }
  function quadroDe(c) { return e().quadros.find(function (q) { return q.cartoes.indexOf(c) >= 0; }); }
  function link(q, c) { return '#/quadros/' + (q ? q.id : '') + (c ? '/' + c.id : ''); }
  function lista(q, id) { return q.listas.find(function (l) { return l.id === id; }); }
  function cartao(q, id) { return q.cartoes.find(function (c) { return c.id === id; }); }
  function registrar(q, c, texto) {
    const a = { em: new Date().toISOString(), por: eu(), texto: texto };
    if (c) { c.atividade = c.atividade || []; c.atividade.unshift(a); c.atividade = c.atividade.slice(0, 120); c.atualizadoEm = a.em; }
    q.atividade.unshift(Object.assign({ cartao: c && c.titulo, cartaoId: c && c.id }, a)); q.atividade = q.atividade.slice(0, 400);
  }
  function notificar(texto, href) {
    e().notificacoes.unshift({ id: Dados.id('nt'), em: new Date().toISOString(), texto: texto, link: href || '', lida: false });
    e().notificacoes = e().notificacoes.slice(0, 200);
    try { if (self.Notification && Notification.permission === 'granted' && document.hidden) new Notification('Seven', { body: texto, icon: 'img/seven-marca.png' }); } catch (err) { /* navegador sem suporte */ }
    atualizarSino();
  }
  function iniciais(n) { return String(n).split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p[0].toUpperCase(); }).join(''); }
  function corMembro(n) { let h = 0; String(n).split('').forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) % 360; }); return 'hsl(' + h + ' 45% 38%)'; }
  function avatar(m, extra) { return '<i class="kav" style="background:' + corMembro(m) + '" title="' + esc(m) + '">' + esc(iniciais(m)) + (extra || '') + '</i>'; }
  function fundoCss(q) { return FUNDOS[q.fundo] || (/^#[0-9a-f]{3,8}$/i.test(q.fundo || '') ? q.fundo : FUNDOS.preto); }
  function progresso(c) { let t = 0, f = 0; (c.checklists || []).forEach(function (cl) { cl.itens.forEach(function (i) { t++; if (i.feito) f++; }); }); return { t: t, f: f }; }
  function filtroDe(q) { return est.filtros[q.id] = est.filtros[q.id] || K.vazioFiltro(); }
  function visiveis(q) { const f = filtroDe(q); const cx = { eu: eu() }; return q.cartoes.filter(function (c) { return K.passaFiltro(c, f, cx); }); }
  function salvar() { Dados.salvar(); }
  function fmtPrazo(c) {
    if (!c.prazo && !c.inicio) return '';
    const d = function (v) { const x = new Date(v); return x.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''); };
    return (c.inicio ? d(c.inicio) + ' – ' : '') + (c.prazo ? d(c.prazo) : '');
  }

  // ---------- criação ----------
  function novoQuadro(nome, modelo) {
    const m = MODELOS[modelo] || MODELOS.simples;
    const q = { id: Dados.id('qd'), nome: nome, criadoEm: new Date().toISOString(), arquivado: false, fundo: m.fundo, descricao: '', seq: 0, _v: 2,
      config: { numeros: true, envelhecimento: false, capas: true, votacao: true }, botoes: [], botoesCartao: [], atividade: [], campos: [], automacoes: [],
      listas: m.listas.map(function (n) { return { id: Dados.id('ls'), nome: n }; }), cartoes: [],
      etiquetas: [['Risco crítico', 'vermelho'], ['Documentação', 'amarelo'], ['Viabilidade financeira', 'verde'], ['Operação e logística', 'azul'], ['Vantagem competitiva', 'rosa']].map(function (x) { return { id: Dados.id('et'), nome: x[0], cor: x[1] }; }) };
    if (modelo === 'licitacoes') {
      q.etiquetas = q.etiquetas.concat([['Pregão', 'preto'], ['Dispensa', 'cinza'], ['ME/EPP', 'dourado'], ['SRP', 'roxo'], ['Ganha', 'lima'], ['Perdida', 'laranja']].map(function (x) { return { id: Dados.id('et'), nome: x[0], cor: x[1] }; }));
      q.campos = [{ id: 'valor', nome: 'Valor estimado', tipo: 'moeda' }, { id: 'orgao', nome: 'Órgão', tipo: 'texto' }, { id: 'numero', nome: 'Nº do processo', tipo: 'texto' }, { id: 'portal', nome: 'Portal', tipo: 'lista', opcoes: ['Compras.gov.br', 'BLL', 'BNC', 'Licitanet', 'Compras Públicas', 'SISLOG-GO', 'Licitações-e', 'Outro'] }];
      q.automacoes = [
        { id: Dados.id('au'), ativo: true, gatilho: { tipo: 'entrar-lista', lista: '*' }, acoes: [{ tipo: 'checklist-etapa' }] },
        { id: Dados.id('au'), ativo: true, gatilho: { tipo: 'entrar-lista', lista: 'Concluído' }, acoes: [{ tipo: 'concluir' }] },
        { id: Dados.id('au'), ativo: true, gatilho: { tipo: 'prazo-proximo', dias: 1 }, acoes: [{ tipo: 'add-etiqueta', valor: 'Risco crítico' }, { tipo: 'notificar', valor: 'Prazo em menos de 24 h' }] }
      ];
      q.botoes = [{ id: Dados.id('bt'), nome: 'Arquivar concluídos', lista: 'Concluído', acoes: [{ tipo: 'arquivar' }] }];
      q.botoesCartao = [{ id: Dados.id('bt'), nome: 'Marcar como ganha', acoes: [{ tipo: 'add-etiqueta', valor: 'Ganha' }, { tipo: 'mover', valor: 'Contrato' }] }, { id: Dados.id('bt'), nome: 'Marcar como perdida', acoes: [{ tipo: 'add-etiqueta', valor: 'Perdida' }, { tipo: 'arquivar' }] }];
    }
    if (modelo === 'execucao') {
      q.campos = [{ id: Dados.id('cf'), nome: 'Nº contrato', tipo: 'texto' }, { id: 'valor', nome: 'Valor', tipo: 'moeda' }, { id: 'orgao', nome: 'Órgão', tipo: 'texto' }, { id: Dados.id('cf'), nome: 'Fim da vigência', tipo: 'data' }];
      q.automacoes = [{ id: Dados.id('au'), ativo: true, gatilho: { tipo: 'entrar-lista', lista: 'Pago' }, acoes: [{ tipo: 'concluir' }] }, { id: Dados.id('au'), ativo: true, gatilho: { tipo: 'entrar-lista', lista: 'Aguardando pagamento' }, acoes: [{ tipo: 'prazo', valor: 30 }] }];
    }
    if (modelo === 'documentos') q.automacoes = [{ id: Dados.id('au'), ativo: true, gatilho: { tipo: 'prazo-proximo', dias: 30 }, acoes: [{ tipo: 'mover', valor: 'Vencendo em 30 dias' }] }];
    e().quadros.push(q);
    return q;
  }

  function garantirQuadroPadrao() { if (!e().quadros.length) { novoQuadro('Licitações', 'licitacoes'); salvar(); } }

  function criarCartao(q, idLista, dados, topo) {
    const l = lista(q, idLista) || q.listas[0];
    const doLista = q.cartoes.filter(function (x) { return x.lista === l.id; });
    const c = Object.assign({ titulo: 'Novo cartão', etiquetas: [], membros: [], checklists: [], comentarios: [], anexos: [], valores: {}, votos: [] }, dados);
    c.id = c.id || Dados.id('ct'); c.num = c.num || ++q.seq; c.lista = l.id;
    c.ordem = topo ? Math.min.apply(null, [0].concat(doLista.map(function (x) { return x.ordem || 0; }))) - 1 : doLista.length;
    c.criadoEm = c.atualizadoEm = new Date().toISOString();
    q.cartoes.push(c); registrar(q, c, 'criou o cartão em "' + l.nome + '"');
    K.dispararEvento(q, c, { tipo: 'criar' }, ctx()); K.dispararEvento(q, c, { tipo: 'entrar-lista' }, ctx());
    if (l.limite && q.cartoes.filter(function (x) { return x.lista === l.id && !x.arquivado; }).length > l.limite) aviso('A lista "' + l.nome + '" passou do limite de ' + l.limite + ' cartões.', 'erro');
    return c;
  }

  function moverCartao(q, c, idLista, ordemIds) {
    const de = lista(q, c.lista); const mudou = c.lista !== idLista;
    c.lista = idLista;
    (ordemIds || []).forEach(function (id, i) { const x = cartao(q, id); if (x) x.ordem = i; });
    if (mudou) {
      registrar(q, c, 'moveu de "' + (de ? de.nome : '?') + '" para "' + lista(q, idLista).nome + '"');
      K.dispararEvento(q, c, { tipo: 'entrar-lista' }, ctx());
      const l = lista(q, idLista);
      if (l.seguindo) notificar('Cartão entrou na lista seguida "' + l.nome + '": ' + c.titulo, link(q, c));
      if (l.limite && q.cartoes.filter(function (x) { return x.lista === l.id && !x.arquivado; }).length > l.limite) aviso('A lista "' + l.nome + '" passou do limite de ' + l.limite + ' cartões.', 'erro');
    }
    salvar();
  }

  // Varredura: automações de prazo, repetições e lembretes de prazo para cartões meus ou seguidos.
  function varrerTudo() {
    let algo = false;
    e().quadros.filter(function (q) { return !q.arquivado; }).forEach(function (q) {
      if (K.varrer(q, ctx()).length) algo = true;
      q.cartoes.forEach(function (c) {
        if (c.arquivado || c.concluido || !c.prazo) return;
        const ms = new Date(c.prazo) - Date.now();
        const janela = Math.max(DIA, (Number(c.lembrete) || 0) * 60000);
        if (ms > 0 && ms < janela && c.avisadoPrazo !== c.prazo && ((c.membros || []).indexOf(eu()) >= 0 || c.seguindo)) {
          c.avisadoPrazo = c.prazo; notificar('Prazo ' + UI.emQuanto(c.prazo) + ': ' + c.titulo, link(q, c)); algo = true;
        }
      });
    });
    if (algo) salvar();
    return algo;
  }

  // ---------- área de trabalho ----------
  function telaInicio(el) {
    const qs = e().quadros.filter(function (q) { return !q.arquivado; });
    const fav = qs.filter(function (q) { return q.favorito; });
    const rec = qs.slice().filter(function (q) { return q.visitadoEm; }).sort(function (a, b) { return new Date(b.visitadoEm) - new Date(a.visitadoEm); }).slice(0, 4);
    const fechados = e().quadros.filter(function (q) { return q.arquivado; });
    const tile = function (q) { const n = q.cartoes.filter(function (c) { return !c.arquivado; }).length; return '<a class="ktile" href="' + link(q) + '" style="background:' + fundoCss(q) + '"><b>' + esc(q.nome) + '</b><span>' + n + ' cartão(ões)</span><button class="icone estrela ' + (q.favorito ? 'on' : '') + '" data-fav="' + q.id + '" aria-label="Favoritar">★</button></a>'; };
    const busca = est.busca ? buscarGlobal(est.busca) : null;
    el.innerHTML = '<div class="kinicio"><div class="barra-acoes"><form id="kbusca" class="kbusca-global"><input type="search" name="q" placeholder="Buscar cartões em todos os quadros…" value="' + esc(est.busca) + '"></form><div class="grupo-botoes">' + sino() + '<button class="btn" data-a="inbox">Caixa de entrada (' + e().inbox.length + ')</button><button class="btn" data-a="importar">Importar do Trello</button><button class="btn primario" data-a="novo">+ Criar quadro</button></div></div>' +
      (busca ? '<section class="cartao"><h3>Resultado da busca (' + busca.length + ')</h3>' + (busca.length ? '<ul class="lista-links">' + busca.slice(0, 50).map(function (x) { return '<li><a href="' + link(x.q, x.c) + '">' + (x.c.num ? '#' + x.c.num + ' ' : '') + esc(x.c.titulo) + '</a> <span class="mudo">· ' + esc(x.q.nome) + ' · ' + esc((lista(x.q, x.c.lista) || {}).nome || '') + (x.c.arquivado ? ' · arquivado' : '') + '</span></li>'; }).join('') + '</ul>' : '<p class="mudo">Nada encontrado.</p>') + '</section>' : '') +
      (est.inbox ? painelInbox() : '') +
      (fav.length ? '<h3 class="ktit">★ Favoritos</h3><div class="ktiles">' + fav.map(tile).join('') + '</div>' : '') +
      (rec.length ? '<h3 class="ktit">Vistos recentemente</h3><div class="ktiles">' + rec.map(tile).join('') + '</div>' : '') +
      '<h3 class="ktit">Seus quadros</h3><div class="ktiles">' + qs.map(tile).join('') + '<button class="ktile novo" data-a="novo">+ Criar quadro</button></div>' +
      (fechados.length ? '<details class="kfechados"><summary>Quadros fechados (' + fechados.length + ')</summary><ul class="lista-links">' + fechados.map(function (q) { return '<li><b>' + esc(q.nome) + '</b> <button class="btn mini" data-reabrir="' + q.id + '">Reabrir</button> <button class="btn mini fantasma perigo" data-excluir="' + q.id + '">Excluir de vez</button></li>'; }).join('') + '</ul></details>' : '') + '</div>';
    el.querySelector('#kbusca').onsubmit = function (ev) { ev.preventDefault(); est.busca = new FormData(this).get('q').trim(); App.redesenhar(); };
    ligarInbox(el, null);
    el.onclick = async function (ev) {
      const f = ev.target.closest('[data-fav]'); if (f) { ev.preventDefault(); const q = e().quadros.find(function (x) { return x.id === f.dataset.fav; }); q.favorito = !q.favorito; salvar(); App.redesenhar(); return; }
      const r = ev.target.closest('[data-reabrir]'); if (r) { e().quadros.find(function (x) { return x.id === r.dataset.reabrir; }).arquivado = false; salvar(); App.redesenhar(); return; }
      const x = ev.target.closest('[data-excluir]'); if (x) { const q = e().quadros.find(function (y) { return y.id === x.dataset.excluir; }); if (await confirmar('Excluir quadro', 'Excluir <b>' + esc(q.nome) + '</b> e todos os cartões? Não dá para desfazer.', 'Excluir')) { e().quadros = e().quadros.filter(function (y) { return y !== q; }); salvar(); App.redesenhar(); } return; }
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'novo') await dialogoNovoQuadro();
      if (b.dataset.a === 'importar') await importarArquivo();
      if (b.dataset.a === 'inbox') { est.inbox = !est.inbox; App.redesenhar(); }
      if (b.dataset.a === 'sino') abrirNotificacoes();
    };
  }

  function buscarGlobal(t) {
    const out = []; const f = Object.assign(K.vazioFiltro(), { texto: t });
    e().quadros.forEach(function (q) { q.cartoes.forEach(function (c) { if (K.passaFiltro(Object.assign({}, c, { arquivado: false }), f, {})) out.push({ q: q, c: c }); }); });
    const n = (t.match(/^#(\d+)$/) || [])[1];
    return n ? out.concat([]).filter(function (x) { return String(x.c.num) === n; }) : out;
  }

  async function dialogoNovoQuadro() {
    const qs = e().quadros.filter(function (q) { return !q.arquivado; });
    const f = await modal({
      titulo: 'Criar quadro',
      corpo: campo('Título do quadro', '<input name="nome" required>') +
        campo('Começar de', '<select name="modelo">' + opcoes(Object.keys(MODELOS).map(function (k) { return { v: k, t: 'Modelo: ' + MODELOS[k].t }; }).concat(qs.map(function (q) { return { v: 'copia:' + q.id, t: 'Copiar o quadro "' + q.nome + '"' }; })), 'licitacoes') + '</select>') +
        '<label class="check"><input type="checkbox" name="cartoes" checked> Ao copiar um quadro, levar os cartões</label>' +
        '<fieldset><legend>Fundo</legend><div class="kfundos">' + Object.keys(FUNDOS).map(function (k, i) { return '<label><input type="radio" name="fundo" value="' + k + '"' + (i === 0 ? ' checked' : '') + '><span style="background:' + FUNDOS[k] + '"></span></label>'; }).join('') + '</div></fieldset>',
      botao: 'Criar'
    });
    if (!f) return;
    let q;
    const m = f.get('modelo');
    if (m.indexOf('copia:') === 0) {
      const o = e().quadros.find(function (x) { return x.id === m.slice(6); });
      q = JSON.parse(JSON.stringify(o)); q.id = Dados.id('qd'); q.nome = f.get('nome'); q.favorito = false; q.atividade = []; q.criadoEm = new Date().toISOString();
      if (!f.get('cartoes')) { q.cartoes = []; q.seq = 0; } else q.cartoes.forEach(function (c) { c.id = Dados.id('ct'); c.anexos = []; c.vinculos = []; });
      e().quadros.push(q);
    } else q = novoQuadro(f.get('nome'), m);
    q.fundo = f.get('fundo') || q.fundo;
    salvar(); location.hash = link(q);
  }

  // Quadro vindo de arquivo de terceiros: ids novos, números como número e cores só da paleta (nada vira HTML/atributo cru).
  function higienizar(q) {
    const idOk = function (v) { return typeof v === 'string' && /^[\w-]{1,64}$/.test(v); };
    const cor = function (v) { return CORES.indexOf(v) >= 0 ? v : ''; };
    const mapa = {}; const novoId = function (v, pre) { if (!idOk(v)) { const n = Dados.id(pre); mapa[v] = n; return n; } return v; };
    q.listas = (q.listas || []).map(function (l) { return Object.assign({}, l, { id: novoId(l.id, 'ls'), nome: String(l.nome || '') }); });
    q.etiquetas = (q.etiquetas || []).map(function (x) { return Object.assign({}, x, { id: novoId(x.id, 'et'), cor: cor(x.cor) || 'cinza', nome: String(x.nome || '') }); });
    q.cartoes = (q.cartoes || []).map(function (c) { const lista = mapa[c.lista] || c.lista; return Object.assign({}, c, { id: novoId(c.id, 'ct'), lista: idOk(lista) ? lista : (q.listas[0] || {}).id, num: Number(c.num) || 0, capa: cor(c.capa), titulo: String(c.titulo || ''), etiquetas: (c.etiquetas || []).map(function (i) { return mapa[i] || i; }).filter(idOk) }); });
    if (!FUNDOS[q.fundo] && !/^#[0-9a-f]{3,8}$/i.test(q.fundo || '')) q.fundo = 'azul';
    q.seq = Number(q.seq) || q.cartoes.length;
    return q;
  }
  async function importarArquivo() {
    const arq = await UI.escolherArquivo('.json,application/json'); if (!arq) return;
    try {
      const j = JSON.parse(await UI.lerArquivoTexto(arq));
      let q;
      if (j.app === 'seven-licita-quadro' && j.quadro) { q = j.quadro; q.id = Dados.id('qd'); q.nome = q.nome + ' (importado)'; q._v = 0; }
      else {
        const r = K.importarTrello(j, { id: Dados.id });
        q = { id: Dados.id('qd'), nome: r.nome, descricao: r.descricao, fundo: r.fundo || 'azul', listas: r.listas, cartoes: r.cartoes, etiquetas: r.etiquetas, campos: r.campos, seq: r.seq, criadoEm: new Date().toISOString(), automacoes: [], botoes: [], botoesCartao: [], atividade: [] };
        r.membros.forEach(function (m) { if (e().membros.indexOf(m) < 0) e().membros.push(m); });
      }
      higienizar(q); migrar(q); e().quadros.push(q); registrar(q, null, 'importou o quadro de ' + arq.name); salvar();
      aviso('Quadro "' + q.nome + '" importado: ' + q.listas.length + ' listas, ' + q.cartoes.length + ' cartões.');
      location.hash = link(q);
    } catch (err) { aviso('Não foi possível importar: ' + err.message, 'erro'); }
  }

  // ---------- caixa de entrada ----------
  function painelInbox() {
    return '<aside class="kinbox"><header><b>Caixa de entrada</b><button class="icone" data-a="inbox" aria-label="Fechar">×</button></header><form id="kinbox-form"><input name="t" placeholder="Anote algo rápido e aperte Enter…" autocomplete="off"></form>' +
      '<p class="mini mudo">Arraste para uma lista do quadro.</p><div class="kinbox-itens">' + e().inbox.map(function (x) { return '<div class="kcartao kinbox-item" draggable="true" data-inbox="' + x.id + '"><p class="ktitulo">' + esc(x.titulo) + '</p><button class="icone" data-del-inbox="' + x.id + '" aria-label="Excluir">×</button></div>'; }).join('') + '</div></aside>';
  }
  function ligarInbox(el, q) {
    const f = el.querySelector('#kinbox-form');
    if (f) { f.onsubmit = function (ev) { ev.preventDefault(); const t = new FormData(f).get('t').trim(); if (!t) return; e().inbox.unshift({ id: Dados.id('ib'), titulo: t, criadoEm: new Date().toISOString() }); salvar(); App.redesenhar(); const i = document.querySelector('#kinbox-form input'); if (i) i.focus(); }; }
    el.querySelectorAll('[data-del-inbox]').forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); e().inbox = e().inbox.filter(function (x) { return x.id !== b.dataset.delInbox; }); salvar(); App.redesenhar(); }; });
    void q;
  }

  // ---------- quadro ----------
  function telaQuadro(el, q, idCartao) {
    q.visitadoEm = new Date().toISOString();
    if (varrerTudo()) { /* mudanças já salvas */ }
    const f = filtroDe(q); const nf = K.contaFiltros(f);
    const claro = FUNDOS_CLAROS.indexOf(q.fundo) >= 0;
    el.innerHTML = '<div class="kpagina ' + (claro ? 'claro' : 'escuro') + '" style="background:' + fundoCss(q) + '">' +
      '<div class="kcab"><a class="kvoltar" href="#/quadros" title="Todos os quadros">▦</a><h2 class="knome" contenteditable="true" spellcheck="false" data-renomear-quadro>' + esc(q.nome) + '</h2>' +
      '<button class="icone estrela ' + (q.favorito ? 'on' : '') + '" data-a="fav" aria-label="Favoritar quadro">★</button>' +
      '<nav class="kvisoes">' + [['quadro', 'Quadro'], ['tabela', 'Tabela'], ['calendario', 'Calendário'], ['cronograma', 'Cronograma'], ['painel', 'Painel']].map(function (v) { return '<button class="' + (est.visao === v[0] ? 'ativa' : '') + '" data-visao="' + v[0] + '">' + v[1] + '</button>'; }).join('') + '</nav>' +
      '<span class="kespaco"></span>' +
      '<input class="kbusca" type="search" placeholder="Buscar neste quadro ( / )" value="' + esc(f.texto) + '" id="kbusca-quadro">' +
      '<button class="btn kbtn ' + (nf ? 'ativo' : '') + '" data-a="filtros">Filtros' + (nf ? ' (' + nf + ')' : '') + '</button>' + (nf ? '<button class="btn kbtn" data-a="limpar">Limpar</button>' : '') +
      '<span class="kmembros-cab">' + e().membros.slice(0, 5).map(function (m) { return avatar(m); }).join('') + '</span>' +
      (q.botoes.length ? q.botoes.map(function (b) { return '<button class="btn kbtn" data-botao="' + b.id + '" title="Botão do quadro">▶ ' + esc(b.nome) + '</button>'; }).join('') : '') +
      '<button class="btn kbtn" data-a="inbox">Caixa de entrada' + (e().inbox.length ? ' (' + e().inbox.length + ')' : '') + '</button>' +
      '<button class="btn kbtn" data-a="automacao">⚡ Automação</button>' + sino('kbtn') + '<button class="btn kbtn" data-a="menu">⋯ Menu</button></div>' +
      '<div class="kcorpo">' + (est.inbox ? painelInbox() : '') + '<div class="kvisao" id="kvisao">' + desenharVisao(q) + '</div></div></div>';
    ligarQuadro(el, q);
    ligarInbox(el, q);
    if (idCartao) { const c = cartao(q, idCartao); if (c) abrirCartao(q, c); }
  }

  function desenharVisao(q) {
    if (est.visao === 'tabela') return visaoTabela(q);
    if (est.visao === 'calendario') return visaoCalendario(q);
    if (est.visao === 'cronograma') return visaoCronograma(q);
    if (est.visao === 'painel') return visaoPainel(q);
    return visaoQuadro(q);
  }

  function miniCartao(q, c) {
    const s = K.statusPrazo(c); const p = progresso(c);
    const ets = (c.etiquetas || []).map(function (id) { return q.etiquetas.find(function (x) { return x.id === id; }); }).filter(Boolean);
    const idade = q.config.envelhecimento ? Math.floor((Date.now() - K.ultimaAtividade(c)) / (7 * DIA)) : 0;
    const cheia = q.config.capas !== false && c.capa && c.capaTamanho === 'cheia' && !c.capaAnexo;
    const img = q.config.capas !== false && c.capaAnexo;
    return '<article class="kcartao' + (cheia ? ' capa-cheia cor-' + c.capa : '') + (idade >= 1 ? ' idade-' + Math.min(3, idade) : '') + (c.concluido ? ' feito' : '') + '" draggable="true" data-cartao="' + c.id + '" tabindex="0" aria-label="' + esc(c.titulo) + '">' +
      (img ? '<div class="kcapa-img"><img data-anexo-img="' + esc(c.capaAnexo) + '" alt=""></div>' : (!cheia && q.config.capas !== false && c.capa ? '<div class="kcapa cor-' + c.capa + '"></div>' : '')) +
      (ets.length ? '<div class="ketiquetas">' + ets.map(function (x) { return '<span class="ket cor-' + x.cor + '" title="' + esc(x.nome) + '">' + esc(x.nome) + '</span>'; }).join('') + '</div>' : '') +
      '<p class="ktitulo">' + (c.concluido ? '<span class="kok">✓</span> ' : '') + esc(c.titulo) + '</p>' +
      '<div class="kmeta">' +
      (q.config.numeros && c.num ? '<span class="knum">#' + c.num + '</span>' : '') +
      (c.prazo || c.inicio ? '<span class="kprazo ' + (s || '') + '">◷ ' + esc(fmtPrazo(c)) + '</span>' : '') +
      (c.valores && c.valores.valor ? '<span>' + moeda(c.valores.valor) + '</span>' : '') +
      (c.seguindo ? '<span title="Você segue este cartão">👁</span>' : '') +
      (c.descricao ? '<span title="Tem descrição">≡</span>' : '') +
      ((c.comentarios || []).length ? '<span title="Comentários">💬 ' + c.comentarios.length + '</span>' : '') +
      ((c.anexos || []).length ? '<span title="Anexos">📎 ' + c.anexos.length + '</span>' : '') +
      (p.t ? '<span class="' + (p.f === p.t ? 'kcheck-ok' : '') + '" title="Checklist">☑ ' + p.f + '/' + p.t + '</span>' : '') +
      (q.config.votacao !== false && (c.votos || []).length ? '<span title="Votos">👍 ' + c.votos.length + '</span>' : '') +
      ((c.vinculos || []).length ? '<span title="Cartões vinculados">🔗 ' + c.vinculos.length + '</span>' : '') +
      (c.recorrencia && c.recorrencia.freq ? '<span title="Repete">↻</span>' : '') +
      ((c.membros || []).length ? '<span class="kmembros">' + c.membros.map(function (m) { return avatar(m); }).join('') + '</span>' : '') +
      '</div><button class="klapis" data-lapis="' + c.id + '" aria-label="Edição rápida" title="Edição rápida (e)">✎</button></article>';
  }

  function visaoQuadro(q) {
    const vis = visiveis(q);
    return '<div class="kquadro" id="kquadro">' + q.listas.filter(function (l) { return !l.arquivada; }).map(function (l) {
      const cs = vis.filter(function (c) { return c.lista === l.id; }).sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
      const total = q.cartoes.filter(function (c) { return c.lista === l.id && !c.arquivado; }).length;
      if (l.recolhida) return '<section class="klista recolhida" data-lista="' + l.id + '"><button class="krecolher" data-recolher="' + l.id + '" title="Expandir">' + esc(l.nome) + ' <b>' + total + '</b></button></section>';
      const valor = cs.reduce(function (s, c) { return s + (Number(c.valores && c.valores.valor) || 0); }, 0);
      const excedeu = l.limite && total > l.limite;
      return '<section class="klista' + (l.cor ? ' lcor-' + l.cor : '') + (excedeu ? ' excedeu' : '') + '" data-lista="' + l.id + '"><header draggable="true" data-arrasta-lista="' + l.id + '"><h3 contenteditable="true" spellcheck="false" data-renomear="' + l.id + '">' + esc(l.nome) + '</h3>' +
        '<span class="kcont">' + (cs.length !== total ? cs.length + '/' : '') + total + (l.limite ? ' de ' + l.limite : '') + (valor ? ' · ' + moeda(valor) : '') + '</span>' + (l.seguindo ? '<span title="Seguindo">👁</span>' : '') +
        '<button class="icone" data-recolher="' + l.id + '" aria-label="Recolher lista" title="Recolher">‹</button><button class="icone" data-a="menu-lista" aria-label="Ações da lista">⋯</button></header>' +
        '<div class="kcartoes" data-soltar="' + l.id + '">' + cs.map(function (c) { return miniCartao(q, c); }).join('') + '</div>' +
        '<div class="kcompor" data-compor="' + l.id + '"><button class="kadicionar" data-a="compor" data-lista="' + l.id + '">+ Adicionar um cartão</button><button class="icone" data-a="modelo-cartao" data-lista="' + l.id + '" title="Criar a partir de modelo">▤</button></div></section>';
    }).join('') + '<section class="klista nova"><button class="kadicionar" data-a="nova-lista">+ Adicionar outra lista</button></section></div>';
  }

  function visaoTabela(q) {
    const cs = visiveis(q).slice();
    const col = est.ord.col; const dir = est.ord.dir;
    const val = function (c, k) {
      if (k === 'titulo') return c.titulo.toLowerCase(); if (k === 'lista') return q.listas.indexOf(lista(q, c.lista)); if (k === 'prazo') return c.prazo || '9999'; if (k === 'inicio') return c.inicio || '9999';
      if (k === 'membros') return (c.membros || []).join(','); if (k === 'etiquetas') return (c.etiquetas || []).length; if (k === 'num') return c.num || 0; if (k === 'status') return c.concluido ? 1 : 0; if (k === 'check') { const p = progresso(c); return p.t ? p.f / p.t : -1; }
      const v = (c.valores || {})[k]; return v == null ? '' : v;
    };
    if (col) cs.sort(function (a, b) { const x = val(a, col), y = val(b, col); return (x > y ? 1 : x < y ? -1 : 0) * dir; });
    const th = function (k, t) { return '<th data-ord="' + k + '" class="ordenavel">' + esc(t) + (col === k ? (dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; };
    return '<div class="kfolha"><div class="tabela-rolagem"><table class="tabela"><thead><tr>' + th('num', '#') + th('titulo', 'Cartão') + th('lista', 'Lista') + th('etiquetas', 'Etiquetas') + th('membros', 'Membros') + th('inicio', 'Início') + th('prazo', 'Prazo') + th('status', 'Status') + th('check', 'Checklist') + q.campos.map(function (f) { return th(f.id, f.nome); }).join('') + '</tr></thead><tbody>' +
      cs.map(function (c) {
        const p = progresso(c); const s = K.statusPrazo(c);
        return '<tr data-cartao="' + c.id + '" class="clicavel"><td class="mudo">' + (c.num || '') + '</td><td><b>' + esc(c.titulo) + '</b></td><td>' + esc((lista(q, c.lista) || {}).nome) + '</td><td>' + (c.etiquetas || []).map(function (id) { const x = q.etiquetas.find(function (y) { return y.id === id; }); return x ? '<span class="ket cor-' + x.cor + '">' + esc(x.nome) + '</span>' : ''; }).join(' ') + '</td><td>' + (c.membros || []).map(function (m) { return avatar(m); }).join('') + '</td><td>' + (c.inicio ? dataHora(c.inicio) : '—') + '</td><td class="' + (s || '') + '">' + (c.prazo ? dataHora(c.prazo) : '—') + '</td><td>' + (c.concluido ? '<span class="tag verde">Concluído</span>' : s === 'atrasado' ? '<span class="tag vermelho">Atrasado</span>' : '<span class="tag claro">Pendente</span>') + '</td><td class="n">' + (p.t ? p.f + '/' + p.t : '—') + '</td>' +
          q.campos.map(function (f) { const v = (c.valores || {})[f.id]; return '<td>' + (f.tipo === 'moeda' ? moeda(v) : f.tipo === 'data' ? data(v) : f.tipo === 'check' ? (v ? '✓' : '') : esc(v == null ? '' : v)) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div><p class="mini mudo">' + cs.length + ' cartão(ões). Clique no título da coluna para ordenar.</p></div>';
  }

  function visaoCalendario(q) {
    const hoje = new Date(); est.calRef = est.calRef || new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const ref = new Date(est.calRef); const semana = est.calModo === 'semana';
    let ini;
    if (semana) { ini = new Date(ref); ini.setDate(ref.getDate() - ((ref.getDay() + 6) % 7)); }
    else { ini = new Date(ref.getFullYear(), ref.getMonth(), 1); ini.setDate(1 - ((ini.getDay() + 6) % 7)); }
    const dias = semana ? 7 : 42;
    const cs = visiveis(q);
    const comData = cs.filter(function (c) { return c.prazo; }); const semData = cs.filter(function (c) { return !c.prazo; });
    const titulo = semana ? 'Semana de ' + ini.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    let html = '<div class="kfolha"><div class="kcal-topo"><button class="btn fantasma" data-cal="-1">‹</button><h3>' + esc(titulo) + '</h3><button class="btn fantasma" data-cal="1">›</button><button class="btn fantasma" data-cal="0">Hoje</button><span class="kespaco"></span><div class="kvisoes mini"><button class="' + (!semana ? 'ativa' : '') + '" data-calmodo="mes">Mês</button><button class="' + (semana ? 'ativa' : '') + '" data-calmodo="semana">Semana</button></div></div>' +
      '<div class="kcal-grade"><div class="kcal ' + (semana ? 'semana' : '') + '"><b>seg</b><b>ter</b><b>qua</b><b>qui</b><b>sex</b><b>sáb</b><b>dom</b>';
    for (let i = 0; i < dias; i++) {
      const d = new Date(ini); d.setDate(ini.getDate() + i);
      const doDia = comData.filter(function (c) { return new Date(c.prazo).toDateString() === d.toDateString(); });
      html += '<div class="kdia ' + (!semana && d.getMonth() !== ref.getMonth() ? 'fora' : '') + (d.toDateString() === hoje.toDateString() ? ' hoje' : '') + '" data-dia="' + Nucleo.yyyymmdd(d) + '"><span>' + d.getDate() + '</span>' +
        doDia.map(function (c) { const s = K.statusPrazo(c); return '<a class="kcal-item ' + (s || '') + '" draggable="true" data-cal-cartao="' + c.id + '" data-cartao="' + c.id + '">' + (semana ? new Date(c.prazo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' ' : '') + esc(c.titulo) + '</a>'; }).join('') + '</div>';
    }
    html += '</div><aside class="kcal-semdata"><h4>Sem data (' + semData.length + ')</h4><p class="mini mudo">Arraste para um dia.</p>' + semData.slice(0, 60).map(function (c) { return '<a class="kcal-item" draggable="true" data-cal-cartao="' + c.id + '" data-cartao="' + c.id + '">' + esc(c.titulo) + '</a>'; }).join('') + '</aside></div><p class="mini mudo">Arraste um cartão para outro dia para mudar o prazo. Clique duas vezes num dia para criar um cartão.</p></div>';
    return html;
  }

  function visaoCronograma(q) {
    const cs = visiveis(q).filter(function (c) { return c.prazo; });
    if (!cs.length) return '<div class="kfolha">' + UI.vazio('Nada no cronograma', 'Defina início e prazo nos cartões para vê-los aqui.') + '</div>';
    const ini0 = function (c) { return new Date(c.inicio || new Date(new Date(c.prazo) - DIA)); };
    let min = Math.min.apply(null, cs.map(function (c) { return ini0(c).getTime(); }).concat([Date.now() - 3 * DIA]));
    let max = Math.max.apply(null, cs.map(function (c) { return new Date(c.prazo).getTime(); }).concat([Date.now() + 7 * DIA]));
    const a = new Date(min); a.setHours(0, 0, 0, 0); min = a.getTime();
    const nd = Math.min(180, Math.ceil((max - min) / DIA) + 2); const px = 30;
    const x = function (t) { return Math.max(0, (t - min) / DIA * px); };
    let cab = ''; let mesAnt = -1;
    for (let i = 0; i < nd; i++) { const d = new Date(min + i * DIA); cab += '<span class="kcr-dia ' + (d.getDay() === 0 || d.getDay() === 6 ? 'fds' : '') + '" style="left:' + i * px + 'px">' + (d.getMonth() !== mesAnt ? '<b>' + d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '</b>' : '') + d.getDate() + '</span>'; mesAnt = d.getMonth(); }
    let linhas = '';
    q.listas.filter(function (l) { return !l.arquivada; }).forEach(function (l) {
      const doL = cs.filter(function (c) { return c.lista === l.id; }); if (!doL.length) return;
      linhas += '<div class="kcr-grupo">' + esc(l.nome) + '</div>';
      doL.sort(function (a, b) { return ini0(a) - ini0(b); }).forEach(function (c) {
        const et = q.etiquetas.find(function (y) { return (c.etiquetas || [])[0] === y.id; });
        const l0 = x(ini0(c).getTime()); const w = Math.max(px * 0.8, x(new Date(c.prazo).getTime()) - l0);
        linhas += '<div class="kcr-linha"><span class="kcr-nome" data-cartao="' + c.id + '">' + esc(c.titulo) + '</span><div class="kcr-trilho" style="width:' + nd * px + 'px"><a class="kcr-barra cor-' + (c.capa || (et ? et.cor : 'dourado')) + (c.concluido ? ' feito' : '') + (K.statusPrazo(c) === 'atrasado' ? ' atrasado' : '') + '" style="left:' + l0 + 'px;width:' + w + 'px" data-cartao="' + c.id + '" title="' + esc(c.titulo + ' · ' + fmtPrazo(c)) + '">' + esc(c.titulo) + '</a></div></div>';
      });
    });
    return '<div class="kfolha"><div class="kcronograma"><div class="kcr-cab"><span class="kcr-nome"></span><div class="kcr-trilho" style="width:' + nd * px + 'px">' + cab + '<i class="kcr-hoje" style="left:' + x(Date.now()) + 'px"></i></div></div>' + linhas + '</div><p class="mini mudo">Barras do início ao prazo. Sem início, a barra cobre o dia anterior ao prazo.</p></div>';
  }

  function visaoPainel(q) {
    const cs = visiveis(q);
    const porLista = q.listas.filter(function (l) { return !l.arquivada; }).map(function (l) { return { t: l.nome.split(' ')[0], v: cs.filter(function (c) { return c.lista === l.id; }).length }; });
    const porMembro = e().membros.map(function (m) { return { t: iniciais(m), v: cs.filter(function (c) { return (c.membros || []).indexOf(m) >= 0; }).length }; }).concat([{ t: 'sem', v: cs.filter(function (c) { return !(c.membros || []).length; }).length }]);
    const porEt = q.etiquetas.map(function (x) { return { nome: x.nome || x.cor, cor: x.cor, v: cs.filter(function (c) { return (c.etiquetas || []).indexOf(x.id) >= 0; }).length }; });
    const st = { concluido: 0, atrasado: 0, logo: 0, futuro: 0, sem: 0 }; cs.forEach(function (c) { st[K.statusPrazo(c) || 'sem']++; });
    const maxEt = Math.max.apply(null, porEt.map(function (x) { return x.v; }).concat([1]));
    const valor = cs.reduce(function (s, c) { return s + (Number(c.valores && c.valores.valor) || 0); }, 0);
    return '<div class="kfolha"><div class="kpis"><div><b>' + cs.length + '</b><span>cartões</span></div><div><b class="' + (st.atrasado ? 'alerta' : '') + '">' + st.atrasado + '</b><span>atrasados</span></div><div><b>' + st.logo + '</b><span>vencem em 24 h</span></div><div><b>' + st.concluido + '</b><span>concluídos</span></div><div><b>' + moeda(valor) + '</b><span>valor no funil</span></div></div>' +
      '<div class="cartoes"><section class="cartao"><h3>Cartões por lista</h3>' + UI.barras(porLista, { rotulo: 'por lista' }) + '</section><section class="cartao"><h3>Cartões por membro</h3>' + UI.barras(porMembro, { rotulo: 'por membro' }) + '</section>' +
      '<section class="cartao"><h3>Cartões por etiqueta</h3><ul class="kbarras-h">' + porEt.map(function (x) { return '<li><span>' + esc(x.nome) + '</span><i class="cor-' + x.cor + '" style="width:' + Math.round(x.v / maxEt * 100) + '%"></i><b>' + x.v + '</b></li>'; }).join('') + '</ul></section>' +
      '<section class="cartao"><h3>Prazos</h3><ul class="kbarras-h">' + [['concluido', 'Concluídos', 'verde'], ['atrasado', 'Atrasados', 'vermelho'], ['logo', 'Vencem em 24 h', 'amarelo'], ['futuro', 'Futuros', 'azul'], ['sem', 'Sem data', 'cinza']].map(function (x) { return '<li><span>' + x[1] + '</span><i class="cor-' + x[2] + '" style="width:' + Math.round(st[x[0]] / Math.max(1, cs.length) * 100) + '%"></i><b>' + st[x[0]] + '</b></li>'; }).join('') + '</ul></section></div>' +
      '<section class="cartao"><h3>Atividade recente</h3><ul class="lista-notas">' + q.atividade.slice(0, 30).map(function (a) { return '<li>' + avatar(a.por) + ' <b>' + esc(a.por) + '</b> ' + esc(a.texto) + (a.cartao ? ' — <a href="' + link(q, { id: a.cartaoId }) + '">' + esc(a.cartao) + '</a>' : '') + ' <span class="mudo">' + dataHora(a.em) + '</span></li>'; }).join('') + '</ul></section></div>';
  }

  // ---------- eventos do quadro ----------
  function ligarQuadro(el, q) {
    const raiz = el.querySelector('.kpagina');
    raiz.addEventListener('click', async function (ev) {
      const v = ev.target.closest('[data-visao]'); if (v) { est.visao = v.dataset.visao; App.redesenhar(); return; }
      const cal = ev.target.closest('[data-cal]'); if (cal) { const n = Number(cal.dataset.cal); const r = new Date(est.calRef || Date.now()); if (n === 0) est.calRef = new Date(); else if (est.calModo === 'semana') { r.setDate(r.getDate() + 7 * n); est.calRef = r; } else est.calRef = new Date(r.getFullYear(), r.getMonth() + n, 1); App.redesenhar(); return; }
      const cm = ev.target.closest('[data-calmodo]'); if (cm) { est.calModo = cm.dataset.calmodo; App.redesenhar(); return; }
      const ord = ev.target.closest('[data-ord]'); if (ord) { est.ord = { col: ord.dataset.ord, dir: est.ord.col === ord.dataset.ord ? -est.ord.dir : 1 }; App.redesenhar(); return; }
      const rec = ev.target.closest('[data-recolher]'); if (rec) { const l = lista(q, rec.dataset.recolher); l.recolhida = !l.recolhida; salvar(); App.redesenhar(); return; }
      const bt = ev.target.closest('[data-botao]'); if (bt) { executarBotaoQuadro(q, q.botoes.find(function (b) { return b.id === bt.dataset.botao; })); return; }
      const lp = ev.target.closest('[data-lapis]'); if (lp) { ev.stopPropagation(); edicaoRapida(q, cartao(q, lp.dataset.lapis)); return; }
      const b = ev.target.closest('[data-a]');
      if (b) {
        const a = b.dataset.a;
        if (a === 'compor') { abrirCompositor(raiz, q, b.dataset.lista); return; }
        if (a === 'modelo-cartao') { await cartaoDeModelo(q, b.dataset.lista); }
        if (a === 'nova-lista') { const n = await pedir('Nova lista', 'Nome da lista', ''); if (n) { q.listas.push({ id: Dados.id('ls'), nome: n }); registrar(q, null, 'criou a lista "' + n + '"'); } }
        if (a === 'menu-lista') await menuLista(q, lista(q, b.closest('[data-lista]').dataset.lista));
        if (a === 'menu') await menuQuadro(q);
        if (a === 'automacao') await menuAutomacao(q);
        if (a === 'filtros') await painelFiltros(q);
        if (a === 'limpar') est.filtros[q.id] = K.vazioFiltro();
        if (a === 'fav') q.favorito = !q.favorito;
        if (a === 'inbox') est.inbox = !est.inbox;
        if (a === 'sino') { abrirNotificacoes(); return; }
        salvar(); App.redesenhar(); return;
      }
      const k = ev.target.closest('[data-cartao]'); if (k && !ev.target.closest('a[href]')) { const c = cartao(q, k.dataset.cartao); if (c) abrirCartao(q, c); }
    });
    raiz.addEventListener('dblclick', async function (ev) {
      const d = ev.target.closest('.kdia'); if (!d || ev.target.closest('[data-cartao]')) return;
      const t = await pedir('Novo cartão em ' + d.dataset.dia.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1'), 'Título', '');
      if (t) { criarCartao(q, q.listas.filter(function (l) { return !l.arquivada; })[0].id, { titulo: t, prazo: d.dataset.dia.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') + 'T12:00' }); salvar(); App.redesenhar(); }
    });
    raiz.addEventListener('focusout', function (ev) {
      const h = ev.target.closest && ev.target.closest('[data-renomear]');
      if (h) { const l = lista(q, h.dataset.renomear); const n = h.textContent.trim(); if (l && n && n !== l.nome) { registrar(q, null, 'renomeou a lista "' + l.nome + '" para "' + n + '"'); l.nome = n; salvar(); } else if (l) h.textContent = l.nome; }
      if (ev.target.hasAttribute && ev.target.hasAttribute('data-renomear-quadro')) { const n = ev.target.textContent.trim(); if (n && n !== q.nome) { registrar(q, null, 'renomeou o quadro para "' + n + '"'); q.nome = n; salvar(); } else ev.target.textContent = q.nome; }
    });
    raiz.addEventListener('keydown', function (ev) { if ((ev.target.dataset && ev.target.dataset.renomear !== undefined || ev.target.hasAttribute('data-renomear-quadro')) && ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); } });
    raiz.addEventListener('mouseover', function (ev) { const k = ev.target.closest('.kcartao[data-cartao]'); est.sobre = k ? k.dataset.cartao : null; const l = ev.target.closest('.klista[data-lista]'); est.sobreLista = l ? l.dataset.lista : est.sobreLista; });
    const busca = el.querySelector('#kbusca-quadro');
    if (busca) busca.oninput = function () { filtroDe(q).texto = busca.value; clearTimeout(busca._t); busca._t = setTimeout(function () { const vz = el.querySelector('#kvisao'); vz.innerHTML = desenharVisao(q); ligarArrastar(el, q); carregarImagens(el); }, 200); };
    ligarArrastar(el, q);
    carregarImagens(el);
  }

  function abrirCompositor(raiz, q, idLista, topo) {
    const box = raiz.querySelector('[data-compor="' + idLista + '"]'); if (!box) return;
    box.innerHTML = '<form class="kcompositor"><textarea rows="3" placeholder="Insira um título para este cartão…" required></textarea><div class="grupo-botoes"><button class="btn primario">Adicionar cartão</button><button type="button" class="icone" data-fechar-compor>×</button></div></form>';
    const f = box.querySelector('form'); const t = f.querySelector('textarea'); t.focus();
    f.onsubmit = function (ev) { ev.preventDefault(); const v = t.value.trim(); if (!v) return; criarCartao(q, idLista, { titulo: v, empresaId: Dados.e.empresaAtiva }, topo); salvar(); App.redesenhar(); abrirCompositor(document.querySelector('.kpagina'), q, idLista, topo); };
    t.onkeydown = function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); f.requestSubmit(); } if (ev.key === 'Escape') App.redesenhar(); };
    box.querySelector('[data-fechar-compor]').onclick = function () { App.redesenhar(); };
  }

  async function cartaoDeModelo(q, idLista) {
    const modelos = []; e().quadros.forEach(function (x) { x.cartoes.forEach(function (c) { if (c.modelo && !c.arquivado) modelos.push({ q: x, c: c }); }); });
    if (!modelos.length) { aviso('Nenhum cartão modelo. Abra um cartão e use "Tornar modelo".', 'erro'); return; }
    const f = await modal({ titulo: 'Criar a partir de modelo', corpo: campo('Modelo', '<select name="m">' + opcoes(modelos.map(function (m, i) { return { v: i, t: m.c.titulo + ' (' + m.q.nome + ')' }; })) + '</select>') + campo('Título do novo cartão', '<input name="t">'), botao: 'Criar' });
    if (!f) return;
    const m = modelos[Number(f.get('m'))]; const n = K.copiarCartao(m.c, { id: Dados.id });
    if (m.q !== q) { n.etiquetas = []; }
    delete n.id; criarCartao(q, idLista, Object.assign(n, { titulo: f.get('t') || m.c.titulo, lista: idLista }));
  }

  function carregarImagens(raiz) {
    raiz.querySelectorAll('img[data-anexo-img]').forEach(async function (img) {
      const id = img.dataset.anexoImg;
      if (!urls[id]) { try { const b = await Dados.lerArquivo(id); if (b) urls[id] = URL.createObjectURL(b); } catch (err) { /* sem arquivo neste navegador */ } }
      if (urls[id]) img.src = urls[id]; else img.closest('.kcapa-img, .kanexo-mini') && img.remove();
    });
  }

  // ---------- arrastar e soltar ----------
  function ligarArrastar(el, q) {
    let arr = null, arrLista = null, arrInbox = null, arrCal = null;
    el.querySelectorAll('.kcartao[data-cartao]').forEach(function (k) {
      k.addEventListener('dragstart', function (ev) { arr = k.dataset.cartao; k.classList.add('arrastando'); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', arr); ev.stopPropagation(); });
      k.addEventListener('dragend', function () { k.classList.remove('arrastando'); });
    });
    el.querySelectorAll('[data-inbox]').forEach(function (k) { k.addEventListener('dragstart', function (ev) { arrInbox = k.dataset.inbox; ev.dataTransfer.setData('text/plain', 'inbox'); }); });
    el.querySelectorAll('[data-cal-cartao]').forEach(function (k) { k.addEventListener('dragstart', function (ev) { arrCal = k.dataset.calCartao; ev.dataTransfer.setData('text/plain', 'cal'); ev.stopPropagation(); }); });
    el.querySelectorAll('[data-arrasta-lista]').forEach(function (h) { h.addEventListener('dragstart', function (ev) { if (arr) return; arrLista = h.dataset.arrastaLista; ev.dataTransfer.setData('text/plain', 'lista'); }); });
    el.querySelectorAll('.kcartoes').forEach(function (zona) {
      zona.addEventListener('dragover', function (ev) {
        if (!arr && !arrInbox) return; ev.preventDefault(); zona.classList.add('sobre');
        if (arr) { const depois = elementoDepois(zona, ev.clientY); const a = el.querySelector('.kcartao.arrastando'); if (a) { if (depois) zona.insertBefore(a, depois); else zona.appendChild(a); } }
      });
      zona.addEventListener('dragleave', function () { zona.classList.remove('sobre'); });
      zona.addEventListener('drop', function (ev) {
        ev.preventDefault(); zona.classList.remove('sobre');
        if (arrInbox) { const it = e().inbox.find(function (x) { return x.id === arrInbox; }); if (it) { e().inbox = e().inbox.filter(function (x) { return x !== it; }); criarCartao(q, zona.dataset.soltar, { titulo: it.titulo }); salvar(); } arrInbox = null; App.redesenhar(); return; }
        if (!arr) return;
        const ids = Array.prototype.map.call(zona.querySelectorAll('.kcartao[data-cartao]'), function (k) { return k.dataset.cartao; });
        moverCartao(q, cartao(q, arr), zona.dataset.soltar, ids); arr = null; App.redesenhar();
      });
    });
    el.querySelectorAll('.kdia').forEach(function (d) {
      d.addEventListener('dragover', function (ev) { if (arrCal) { ev.preventDefault(); d.classList.add('sobre'); } });
      d.addEventListener('dragleave', function () { d.classList.remove('sobre'); });
      d.addEventListener('drop', function (ev) {
        if (!arrCal) return; ev.preventDefault();
        const c = cartao(q, arrCal); const hora = c.prazo ? c.prazo.slice(11, 16) : '12:00';
        c.prazo = d.dataset.dia.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') + 'T' + (hora || '12:00'); c.avisadoPrazo = null;
        registrar(q, c, 'mudou o prazo para ' + dataHora(c.prazo)); arrCal = null; salvar(); App.redesenhar();
      });
    });
    const kq = el.querySelector('#kquadro');
    if (kq) {
      kq.addEventListener('dragover', function (ev) { if (arrLista) ev.preventDefault(); });
      kq.addEventListener('drop', function (ev) {
        if (!arrLista) return; ev.preventDefault();
        const alvo = ev.target.closest('.klista[data-lista]');
        if (alvo && alvo.dataset.lista !== arrLista) {
          const de = q.listas.findIndex(function (l) { return l.id === arrLista; }); const l = q.listas.splice(de, 1)[0];
          const para = q.listas.findIndex(function (x) { return x.id === alvo.dataset.lista; }); q.listas.splice(para + (de <= para ? 1 : 0), 0, l);
          registrar(q, null, 'moveu a lista "' + l.nome + '"'); salvar();
        }
        arrLista = null; App.redesenhar();
      });
    }
  }
  function elementoDepois(zona, y) {
    let melhor = null, dist = -Infinity;
    zona.querySelectorAll('.kcartao:not(.arrastando)').forEach(function (k) { const r = k.getBoundingClientRect(); const o = y - r.top - r.height / 2; if (o < 0 && o > dist) { dist = o; melhor = k; } });
    return melhor;
  }

  // ---------- edição rápida ----------
  async function edicaoRapida(q, c) {
    const f = await modal({
      titulo: 'Edição rápida', botao: 'Salvar',
      corpo: '<textarea name="titulo" rows="3">' + esc(c.titulo) + '</textarea><div class="kbotoes-rapidos">' + [['abrir', 'Abrir cartão'], ['etiquetas', 'Editar etiquetas'], ['membros', 'Alterar membros'], ['datas', 'Editar datas'], ['capa', 'Alterar capa'], ['mover', 'Mover'], ['copiar', 'Copiar'], ['arquivar', 'Arquivar']].map(function (x) { return '<button type="button" class="btn" data-rapido="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>',
      aoAbrir: function (form) {
        form.addEventListener('click', function (ev) {
          const b = ev.target.closest('[data-rapido]'); if (!b) return;
          const t = form.querySelector('[name=titulo]').value.trim(); if (t) c.titulo = t;
          form.closest('.modal-fundo').remove();
          if (b.dataset.rapido === 'arquivar') { c.arquivado = true; registrar(q, c, 'arquivou'); salvar(); App.redesenhar(); return; }
          abrirCartao(q, c, b.dataset.rapido === 'abrir' ? null : b.dataset.rapido);
        });
      }
    });
    if (f && f.get('titulo').trim() && f.get('titulo').trim() !== c.titulo) { c.titulo = f.get('titulo').trim(); registrar(q, c, 'renomeou o cartão'); salvar(); App.redesenhar(); }
  }

  // ---------- cartão (janela) ----------
  let aberto = null; // { q, c, painel, editandoDesc, editandoComentario }
  function abrirCartao(q, c, painel) {
    fecharCartao(true);
    aberto = { q: q, c: c, painel: painel || null, editandoDesc: false, editandoComentario: null };
    if (location.hash !== link(q, c)) history.replaceState(null, '', link(q, c));
    const fundo = document.createElement('div'); fundo.className = 'kov'; fundo.id = 'kov';
    fundo.innerHTML = '<div class="kjanela" role="dialog" aria-modal="true" aria-label="' + esc(c.titulo) + '"></div>';
    document.body.appendChild(fundo);
    pintar();
    fundo.addEventListener('mousedown', function (ev) { if (ev.target === fundo) fecharCartao(); });
    const jan = fundo.querySelector('.kjanela');
    jan.addEventListener('click', cliqueCartao);
    jan.addEventListener('change', mudancaCartao);
    jan.addEventListener('keydown', teclaCartao);
    jan.addEventListener('dragover', function (ev) { if (ev.dataTransfer && Array.prototype.indexOf.call(ev.dataTransfer.types, 'Files') >= 0) { ev.preventDefault(); jan.classList.add('soltando'); } });
    jan.addEventListener('dragleave', function (ev) { if (ev.target === jan) jan.classList.remove('soltando'); });
    jan.addEventListener('drop', function (ev) { if (!ev.dataTransfer.files.length) return; ev.preventDefault(); jan.classList.remove('soltando'); anexarArquivos(Array.prototype.slice.call(ev.dataTransfer.files)); });
  }
  function fecharCartao(semRedesenhar) {
    const o = document.getElementById('kov'); if (o) o.remove();
    if (aberto && !semRedesenhar) { const q = aberto.q; aberto = null; history.replaceState(null, '', link(q)); App.redesenhar(); }
    aberto = semRedesenhar ? aberto : null;
  }
  function mudou(texto) { const a = aberto; if (texto) registrar(a.q, a.c, texto); a.c.atualizadoEm = new Date().toISOString(); salvar(); pintar(); }

  function pintar() {
    const a = aberto; if (!a) return;
    const jan = document.querySelector('#kov .kjanela'); if (!jan) return;
    const rolagem = jan.scrollTop;
    const q = a.q, c = a.c;
    const l = lista(q, c.lista); const s = K.statusPrazo(c); const p = progresso(c);
    const ets = (c.etiquetas || []).map(function (id) { return q.etiquetas.find(function (x) { return x.id === id; }); }).filter(Boolean);
    const souMembro = (c.membros || []).indexOf(eu()) >= 0;
    const capa = c.capaAnexo ? '<div class="kj-capa img"><img data-anexo-img="' + esc(c.capaAnexo) + '" alt=""></div>' : c.capa ? '<div class="kj-capa cor-' + c.capa + '"></div>' : '';
    jan.innerHTML = capa + '<button class="icone kj-fechar" data-k="fechar" aria-label="Fechar">×</button>' +
      '<header class="kj-cab"><textarea class="kj-titulo" data-campo="titulo" rows="1" spellcheck="false">' + esc(c.titulo) + '</textarea>' +
      '<p class="mini">na lista <select data-campo="lista">' + opcoes(q.listas.filter(function (x) { return !x.arquivada; }).map(function (x) { return { v: x.id, t: x.nome }; }), c.lista) + '</select>' + (q.config.numeros && c.num ? ' · <b>#' + c.num + '</b>' : '') + (c.seguindo ? ' · 👁 seguindo' : '') + (c.arquivado ? ' · <span class="tag vermelho">Arquivado</span>' : '') + (c.modelo ? ' · <span class="tag ouro">Modelo</span>' : '') +
      (c.avisoId && Dados.e.avisos[c.avisoId] ? ' · <a href="' + esc(UI.url(Dados.e.avisos[c.avisoId].edital)) + '" target="_blank" rel="noopener">edital no PNCP ↗</a> · <button type="button" class="link-btn" data-op-abrir="' + esc(c.avisoId) + '">✎ Anotações da oportunidade (' + Telas.oport.quantas(c.avisoId) + ')</button>' : '') + '</p></header>' +
      '<div class="kj-corpo"><div class="kj-principal">' +
      (a.painel ? '<section class="kj-painel">' + painelCartao(a.painel) + '</section>' : '') +
      '<div class="kj-badges">' +
      ((c.membros || []).length ? '<div><h4>Membros</h4><div class="kj-avatares">' + c.membros.map(function (m) { return avatar(m); }).join('') + '<button class="kav mais" data-painel="membros" aria-label="Membros">+</button></div></div>' : '') +
      (ets.length ? '<div><h4>Etiquetas</h4><div class="ketiquetas">' + ets.map(function (x) { return '<span class="ket grande cor-' + x.cor + '" data-painel="etiquetas">' + esc(x.nome || ' ') + '</span>'; }).join('') + '<button class="ket grande mais" data-painel="etiquetas" aria-label="Etiquetas">+</button></div></div>' : '') +
      (c.prazo || c.inicio ? '<div><h4>Datas</h4><label class="kj-data ' + (s || '') + '"><input type="checkbox" data-campo="concluido"' + (c.concluido ? ' checked' : '') + ' aria-label="Concluído"> <span data-painel="datas">' + esc(fmtPrazo(c)) + (c.prazo ? ' às ' + new Date(c.prazo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '') + '</span> ' + (c.concluido ? '<span class="tag verde">Concluído</span>' : s === 'atrasado' ? '<span class="tag vermelho">Atrasado</span>' : s === 'logo' ? '<span class="tag ouro">Vence em breve</span>' : '') + '</label></div>' : '') +
      (q.config.votacao !== false && (c.votos || []).length ? '<div><h4>Votos</h4><button class="btn mini ' + ((c.votos || []).indexOf(eu()) >= 0 ? 'primario' : '') + '" data-k="votar">👍 ' + c.votos.length + '</button></div>' : '') +
      (c.recorrencia && c.recorrencia.freq ? '<div><h4>Repete</h4><span class="tag claro" data-painel="repetir">↻ ' + { diaria: 'todo dia', semanal: 'toda semana', mensal: 'todo mês', anual: 'todo ano' }[c.recorrencia.freq] + ' · próxima ' + dataHora(c.recorrencia.proxima) + '</span></div>' : '') +
      '</div>' +
      '<section class="kj-sec"><h4>≡ Descrição ' + (!a.editandoDesc && c.descricao ? '<button class="btn mini fantasma" data-k="editar-desc">Editar</button>' : '') + '</h4>' +
      (a.editandoDesc || !c.descricao ? '<textarea class="kj-desc" data-desc rows="' + (a.editandoDesc ? 8 : 3) + '" placeholder="Adicione uma descrição mais detalhada… (aceita Markdown: **negrito**, *itálico*, - [ ] tarefa, [link](https://…))">' + esc(c.descricao || '') + '</textarea>' + '<div class="grupo-botoes"><button class="btn primario mini" data-k="salvar-desc">Salvar</button>' + (a.editandoDesc ? '<button class="btn fantasma mini" data-k="cancelar-desc">Cancelar</button>' : '') + '</div>' : '<div class="md" data-k="editar-desc-clique">' + K.markdown(c.descricao) + '</div>') + '</section>' +
      (q.campos.length ? '<section class="kj-sec"><h4>▦ Campos personalizados</h4><div class="kj-campos">' + q.campos.map(function (f) {
        const v = (c.valores || {})[f.id];
        const inp = f.tipo === 'lista' ? '<select data-cf="' + f.id + '"><option value=""></option>' + opcoes(f.opcoes || [], v) + '</select>'
          : f.tipo === 'check' ? '<input type="checkbox" data-cf="' + f.id + '"' + (v ? ' checked' : '') + '>'
            : '<input data-cf="' + f.id + '" ' + (f.tipo === 'data' ? 'type="date"' : f.tipo === 'moeda' || f.tipo === 'numero' ? 'inputmode="decimal"' : '') + ' value="' + esc(f.tipo === 'moeda' && v != null ? String(v).replace('.', ',') : v == null ? '' : v) + '">';
        return campo(f.nome, inp);
      }).join('') + '</div></section>' : '') +
      (c.checklists || []).map(function (cl) {
        const pt = cl.itens.filter(function (i) { return i.feito; }).length; const pc = cl.itens.length ? Math.round(pt / cl.itens.length * 100) : 0;
        return '<section class="kj-sec kchecklist" data-cl="' + cl.id + '"><h4>☑ <span class="kcl-titulo" data-k="renomear-cl">' + esc(cl.titulo) + '</span><span class="kespaco"></span><button class="btn mini fantasma" data-k="ocultar-feitos">' + (cl.ocultarFeitos ? 'Mostrar marcados (' + pt + ')' : 'Ocultar marcados') + '</button><button class="btn mini fantasma perigo" data-k="del-cl">Excluir</button></h4>' +
          '<div class="kcl-prog"><small>' + pc + '%</small><div class="barra"><i style="width:' + pc + '%' + (pc === 100 ? ';background:var(--ok)' : '') + '"></i></div></div>' +
          cl.itens.filter(function (i) { return !(cl.ocultarFeitos && i.feito); }).map(function (i) {
            return '<div class="kitem" data-item="' + i.id + '"><input type="checkbox" data-k="item"' + (i.feito ? ' checked' : '') + ' aria-label="Concluir item"><span class="kitem-txt ' + (i.feito ? 'riscado' : '') + '" data-k="editar-item">' + K.markdown(i.texto).replace(/^<p>|<\/p>$/g, '') + '</span>' +
              (i.membro ? avatar(i.membro) : '') + (i.prazo ? '<span class="kprazo ' + (!i.feito && new Date(i.prazo + 'T23:59') < Date.now() ? 'atrasado' : '') + '">' + data(i.prazo) + '</span>' : '') +
              '<span class="kitem-acoes"><select data-item-membro aria-label="Atribuir"><option value="">@</option>' + opcoes(e().membros, i.membro) + '</select><input type="date" data-item-prazo value="' + esc(i.prazo || '') + '" aria-label="Prazo do item"><button class="btn mini fantasma" data-k="item-cartao" title="Transformar em cartão">⇱</button><button class="icone" data-k="del-item" aria-label="Excluir item">×</button></span></div>';
          }).join('') +
          '<form class="kitem-novo" data-novo-item="' + cl.id + '"><input placeholder="Adicionar um item… (@nome atribui, !dd/mm define prazo)"><button class="btn mini">Adicionar</button></form></section>';
      }).join('') +
      ((c.vinculos || []).length ? '<section class="kj-sec"><h4>🔗 Cartões vinculados</h4><ul class="lista-links">' + c.vinculos.map(function (v, i) { const r = acharId(v.q, v.c); return '<li>' + (r ? '<a href="' + link(r.quadro, r.cartao) + '" data-ir="' + i + '">' + esc(r.cartao.titulo) + '</a> <span class="mudo">· ' + esc(r.quadro.nome) + ' · ' + esc((lista(r.quadro, r.cartao.lista) || {}).nome || '') + '</span>' : '<span class="mudo">cartão removido</span>') + ' <button class="icone" data-k="desvincular" data-i="' + i + '" aria-label="Desvincular">×</button></li>'; }).join('') + '</ul></section>' : '') +
      ((c.anexos || []).length ? '<section class="kj-sec"><h4>📎 Anexos <span class="kespaco"></span><button class="btn mini fantasma" data-painel="anexo">Adicionar</button></h4><ul class="kanexos">' + c.anexos.map(function (x) {
        const img = /^image\//.test(x.tipo || '') && !x.link;
        return '<li><span class="kanexo-mini">' + (img ? '<img data-anexo-img="' + esc(x.id) + '" alt="">' : '<b>' + esc((x.nome.split('.').pop() || 'link').slice(0, 4).toUpperCase()) + '</b>') + '</span><div><a href="' + (x.link ? esc(x.link) + '" target="_blank" rel="noopener' : '#" data-k="abrir-anexo" data-anexo="' + x.id) + '">' + esc(x.nome) + '</a><br><span class="mini mudo">' + (x.tamanho ? UI.num(x.tamanho / 1024, 0) + ' KB · ' : '') + dataHora(x.em) + '</span> ' +
          (img ? '<button class="btn mini fantasma" data-k="capa-anexo" data-anexo="' + x.id + '">' + (c.capaAnexo === x.id ? 'Remover capa' : 'Usar como capa') + '</button>' : '') + '<button class="btn mini fantasma perigo" data-k="del-anexo" data-anexo="' + x.id + '">Excluir</button></div></li>';
      }).join('') + '</ul></section>' : '') +
      '<section class="kj-sec"><h4>Execução (contrato, empenho, pagamento) <span class="kespaco"></span><button class="btn mini fantasma" data-k="execucao">Editar</button></h4>' + execucaoResumo(c) + '</section>' +
      '<section class="kj-sec"><h4>☰ Atividade <span class="kespaco"></span><button class="btn mini fantasma" data-k="detalhes">' + (est.detalhes ? 'Ocultar detalhes' : 'Mostrar detalhes') + '</button></h4>' +
      '<div class="kj-comentar">' + avatar(eu()) + '<div><textarea data-novo-comentario rows="2" placeholder="Escrever um comentário… (@nome menciona; aceita Markdown)"></textarea><button class="btn primario mini" data-k="comentar">Salvar</button></div></div>' +
      '<ul class="kj-atividade">' + linhaDoTempo(c).map(function (x) {
        if (x.tipo === 'atividade') return est.detalhes ? '<li class="mudo mini">' + avatar(x.a.por) + ' <b>' + esc(x.a.por) + '</b> ' + esc(x.a.texto) + ' · ' + dataHora(x.a.em) + '</li>' : '';
        const m = x.m; const editando = a.editandoComentario === m.id;
        return '<li class="kcom" data-com="' + m.id + '">' + avatar(m.por) + '<div><b>' + esc(m.por) + '</b> <span class="mini mudo">' + dataHora(m.em) + (m.editadoEm ? ' (editado)' : '') + '</span>' +
          (editando ? '<textarea data-editar-com rows="3">' + esc(m.texto) + '</textarea><div class="grupo-botoes"><button class="btn primario mini" data-k="salvar-com">Salvar</button><button class="btn fantasma mini" data-k="cancelar-com">Cancelar</button></div>' : '<div class="md balao">' + K.markdown(m.texto) + '</div>') +
          '<div class="kreacoes">' + REACOES.map(function (r) { const quem = (m.reacoes || {})[r] || []; return quem.length ? '<button class="kreacao ' + (quem.indexOf(eu()) >= 0 ? 'minha' : '') + '" data-k="reagir" data-r="' + r + '" title="' + esc(quem.join(', ')) + '">' + r + ' ' + quem.length + '</button>' : ''; }).join('') +
          '<span class="kreacoes-add">' + REACOES.map(function (r) { return '<button class="kreacao nova" data-k="reagir" data-r="' + r + '" aria-label="Reagir ' + r + '">' + r + '</button>'; }).join('') + '</span>' +
          (m.por === eu() || m.por === 'Automação' ? ' · <a href="#" data-k="editar-com">Editar</a> · <a href="#" data-k="del-com">Excluir</a>' : '') + '</div></div></li>';
      }).join('') + '</ul></section>' +
      '</div><aside class="kj-lateral">' +
      '<h4>Adicionar ao cartão</h4>' +
      '<button class="btn" data-k="entrar">' + (souMembro ? '− Sair' : '+ Entrar') + '</button>' +
      [['membros', '👤 Membros'], ['etiquetas', '🏷 Etiquetas'], ['checklist', '☑ Checklist'], ['datas', '◷ Datas'], ['anexo', '📎 Anexo'], ['capa', '▭ Capa'], ['repetir', '↻ Repetir'], ['vincular', '🔗 Vincular cartão']].map(function (x) { return '<button class="btn ' + (a.painel === x[0] ? 'ativo' : '') + '" data-painel="' + x[0] + '">' + x[1] + '</button>'; }).join('') +
      (q.botoesCartao.length ? '<h4>Botões do cartão</h4>' + q.botoesCartao.map(function (b) { return '<button class="btn" data-botao-cartao="' + b.id + '">▶ ' + esc(b.nome) + '</button>'; }).join('') : '') +
      '<h4>Ações</h4>' +
      '<button class="btn ' + (a.painel === 'mover' ? 'ativo' : '') + '" data-painel="mover">→ Mover</button><button class="btn ' + (a.painel === 'copiar' ? 'ativo' : '') + '" data-painel="copiar">⧉ Copiar</button>' +
      '<button class="btn" data-k="modelo">▤ ' + (c.modelo ? 'Deixar de ser modelo' : 'Tornar modelo') + '</button>' +
      '<button class="btn" data-k="seguir">👁 ' + (c.seguindo ? 'Seguindo ✓' : 'Seguir') + '</button>' +
      (q.config.votacao !== false ? '<button class="btn" data-k="votar">👍 ' + ((c.votos || []).indexOf(eu()) >= 0 ? 'Retirar voto' : 'Votar') + '</button>' : '') +
      '<button class="btn" data-k="compartilhar">↗ Copiar link</button>' +
      '<button class="btn" data-k="peca">§ Peça jurídica</button>' +
      '<button class="btn" data-k="arquivar">' + (c.arquivado ? '↺ Restaurar' : '🗄 Arquivar') + '</button>' +
      (c.arquivado ? '<button class="btn perigo" data-k="excluir">Excluir de vez</button>' : '') +
      '<p class="mini mudo">Criado em ' + dataHora(c.criadoEm) + '<br>Atalhos: Esc fecha.</p></aside></div>';
    jan.scrollTop = rolagem;
    const ta = jan.querySelector('.kj-titulo'); autoAltura(ta); ta.addEventListener('input', function () { autoAltura(ta); });
    jan.querySelectorAll('[data-novo-item]').forEach(function (f) { f.onsubmit = function (ev) { ev.preventDefault(); const cl = c.checklists.find(function (x) { return x.id === f.dataset.novoItem; }); const i = f.querySelector('input'); if (adicionarItem(cl, i.value)) { mudou('adicionou "' + i.value.trim() + '" ao checklist'); const n = document.querySelector('[data-novo-item="' + cl.id + '"] input'); if (n) n.focus(); } }; });
    jan.querySelectorAll('.md input[type=checkbox][data-md-linha]').forEach(function (cb) { cb.disabled = false; });
    carregarImagens(jan);
  }

  function autoAltura(t) { if (!t) return; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }

  function linhaDoTempo(c) {
    return (c.comentarios || []).map(function (m) { if (!m.id) m.id = Dados.id('cm'); return { tipo: 'comentario', em: m.em, m: m }; })
      .concat((c.atividade || []).map(function (a) { return { tipo: 'atividade', em: a.em, a: a }; }))
      .sort(function (x, y) { return new Date(y.em) - new Date(x.em); });
  }

  function painelCartao(p) {
    const a = aberto; const q = a.q, c = a.c;
    const fechar = '<button class="icone kj-painel-fechar" data-k="fechar-painel" aria-label="Fechar">×</button>';
    if (p === 'membros') return fechar + '<h4>Membros</h4><div class="grade-checks">' + e().membros.map(function (m) { return '<label><input type="checkbox" data-membro="' + esc(m) + '"' + ((c.membros || []).indexOf(m) >= 0 ? ' checked' : '') + '> ' + avatar(m) + ' ' + esc(m) + '</label>'; }).join('') + '</div><form class="kitem-novo" data-novo-membro><input placeholder="Adicionar pessoa à equipe…"><button class="btn mini">+</button></form>';
    if (p === 'etiquetas') return fechar + '<h4>Etiquetas</h4><div class="ketiquetas-sel">' + q.etiquetas.map(function (x, i) { return '<label><input type="checkbox" data-etiqueta="' + x.id + '"' + ((c.etiquetas || []).indexOf(x.id) >= 0 ? ' checked' : '') + '><span class="ket grande cor-' + x.cor + '">' + esc(x.nome || ' ') + '</span>' + (i < 9 ? '<small class="mudo">' + (i + 1) + '</small>' : '') + '</label>'; }).join('') + '</div><form class="linha" data-nova-etiqueta><input name="nome" placeholder="Nova etiqueta"><select name="cor">' + opcoes(CORES) + '</select><button class="btn mini">Criar</button></form>';
    if (p === 'datas') return fechar + '<h4>Datas</h4><form data-datas class="linha">' + campo('Início', '<input type="datetime-local" name="inicio" value="' + esc(c.inicio || '') + '">') + campo('Prazo', '<input type="datetime-local" name="prazo" value="' + esc(c.prazo || '') + '">') + campo('Lembrete', '<select name="lembrete">' + opcoes([{ v: '', t: 'Nenhum' }, { v: '0', t: 'Na hora' }, { v: '5', t: '5 min antes' }, { v: '60', t: '1 hora antes' }, { v: '1440', t: '1 dia antes' }, { v: '2880', t: '2 dias antes' }], c.lembrete || '') + '</select>') + '<div class="grupo-botoes"><button class="btn primario mini">Salvar</button><button type="button" class="btn fantasma mini" data-k="limpar-datas">Remover datas</button></div></form>';
    if (p === 'checklist') {
      const outras = []; q.cartoes.forEach(function (x) { if (x !== c) (x.checklists || []).forEach(function (cl) { outras.push({ c: x, cl: cl }); }); });
      return fechar + '<h4>Adicionar checklist</h4><form data-novo-checklist class="linha">' + campo('Título', '<input name="t" value="Checklist" list="kcl-sug"><datalist id="kcl-sug">' + Object.keys(CHECK_ETAPA).map(function (k) { return '<option value="' + esc(k) + '">'; }).join('') + '</datalist>', 'Um nome de etapa (ex.: Proposta) já vem com os itens padrão.') + campo('Copiar itens de', '<select name="de"><option value="">(nenhum)</option>' + opcoes(outras.map(function (o, i) { return { v: i, t: o.cl.titulo + ' — ' + o.c.titulo.slice(0, 40) }; })) + '</select>') + '<button class="btn primario mini">Adicionar</button></form>';
    }
    if (p === 'anexo') return fechar + '<h4>Anexar</h4><div class="grupo-botoes"><button class="btn" data-k="add-arquivo">Escolher arquivo(s)</button><span class="mini mudo">ou arraste arquivos para dentro do cartão</span></div><form data-novo-link class="linha">' + campo('Link', '<input name="u" type="url" placeholder="https://…" required>') + campo('Nome (opcional)', '<input name="n">') + '<button class="btn mini">Anexar link</button></form>';
    if (p === 'capa') {
      const imgs = (c.anexos || []).filter(function (x) { return /^image\//.test(x.tipo || '') && !x.link; });
      return fechar + '<h4>Capa</h4><div class="linha"><label class="check"><input type="radio" name="tam" data-tam="meia"' + (c.capaTamanho !== 'cheia' ? ' checked' : '') + '> Meia (faixa)</label><label class="check"><input type="radio" name="tam" data-tam="cheia"' + (c.capaTamanho === 'cheia' ? ' checked' : '') + '> Cheia (cartão colorido)</label></div>' +
        '<div class="kcores">' + CORES.map(function (x) { return '<button class="kcor cor-' + x + (c.capa === x && !c.capaAnexo ? ' sel' : '') + '" data-capa="' + x + '" aria-label="' + x + '"></button>'; }).join('') + '</div>' +
        (imgs.length ? '<p class="mini">Imagens anexadas:</p><div class="kcores">' + imgs.map(function (x) { return '<button class="kcor img' + (c.capaAnexo === x.id ? ' sel' : '') + '" data-k="capa-anexo" data-anexo="' + x.id + '"><img data-anexo-img="' + esc(x.id) + '" alt=""></button>'; }).join('') + '</div>' : '<p class="mini mudo">Anexe uma imagem para usá-la como capa.</p>') +
        '<button class="btn mini fantasma" data-k="sem-capa">Remover capa</button>';
    }
    if (p === 'repetir') {
      const r = c.recorrencia || {};
      return fechar + '<h4>Repetir cartão</h4><p class="mini mudo">Na data indicada, uma cópia do cartão é criada na mesma lista (sem comentários, checklists desmarcados, prazo avançado no mesmo intervalo). Útil para certidões, relatórios e cobranças.</p><form data-repetir class="linha">' + campo('Frequência', '<select name="f">' + opcoes([{ v: '', t: 'Não repetir' }, { v: 'diaria', t: 'Todo dia' }, { v: 'semanal', t: 'Toda semana' }, { v: 'mensal', t: 'Todo mês' }, { v: 'anual', t: 'Todo ano' }], r.freq || '') + '</select>') + campo('Próxima cópia em', '<input type="datetime-local" name="p" value="' + esc(r.proxima || K.dataLocal(Date.now() + 7 * DIA)) + '">') + '<button class="btn primario mini">Salvar</button></form>';
    }
    if (p === 'mover' || p === 'copiar') {
      const qs = e().quadros.filter(function (x) { return !x.arquivado; });
      return fechar + '<h4>' + (p === 'mover' ? 'Mover cartão' : 'Copiar cartão') + '</h4><form data-mover="' + p + '" class="linha">' + (p === 'copiar' ? campo('Título', '<input name="titulo" value="' + esc(c.titulo) + '">') : '') +
        campo('Quadro', '<select name="quadro" data-mc-quadro>' + opcoes(qs.map(function (x) { return { v: x.id, t: x.nome }; }), q.id) + '</select>') + campo('Lista', '<select name="lista" data-mc-lista>' + opcoes(q.listas.filter(function (x) { return !x.arquivada; }).map(function (x) { return { v: x.id, t: x.nome }; }), c.lista) + '</select>') + campo('Posição', '<select name="pos">' + opcoes([{ v: 'fim', t: 'No fim' }, { v: 'topo', t: 'No topo' }]) + '</select>') +
        (p === 'copiar' ? '<fieldset><legend>Manter</legend><div class="grade-checks"><label><input type="checkbox" name="checklists" checked> Checklists</label><label><input type="checkbox" name="etiquetas" checked> Etiquetas</label><label><input type="checkbox" name="membros" checked> Membros</label><label><input type="checkbox" name="comentarios"> Comentários</label></div></fieldset>' : '') +
        '<button class="btn primario mini">' + (p === 'mover' ? 'Mover' : 'Criar cópia') + '</button></form>';
    }
    if (p === 'vincular') {
      const opc = []; e().quadros.filter(function (x) { return !x.arquivado; }).forEach(function (x) { x.cartoes.forEach(function (k) { if (k !== c && !k.arquivado) opc.push({ v: x.id + ':' + k.id, t: x.nome + ' › ' + (k.num ? '#' + k.num + ' ' : '') + k.titulo.slice(0, 70) }); }); });
      return fechar + '<h4>Vincular a outro cartão</h4><form data-vincular class="linha">' + campo('Cartão', '<input name="c" list="kvinc" placeholder="Digite para buscar…" required><datalist id="kvinc">' + opc.map(function (o) { return '<option value="' + esc(o.t) + '" data-v="' + esc(o.v) + '">'; }).join('') + '</datalist>') + '<button class="btn primario mini">Vincular</button></form><p class="mini mudo">O vínculo aparece nos dois cartões.</p>';
    }
    return '';
  }

  function acharId(qid, cid) { const q = e().quadros.find(function (x) { return x.id === qid; }); const c = q && cartao(q, cid); return c ? { quadro: q, cartao: c } : null; }

  function adicionarItem(cl, texto) {
    texto = String(texto || '').trim(); if (!texto) return false;
    const m = texto.match(/@([\wÀ-ÿ]+(?:\s[\wÀ-ÿ]+)?)/); const pz = texto.match(/!(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
    let membro = ''; if (m) { const achado = e().membros.find(function (x) { return Nucleo.normalizar(x).indexOf(Nucleo.normalizar(m[1]).split(' ')[0]) === 0; }); if (achado) { membro = achado; texto = texto.replace(m[0], '').trim(); } }
    let prazo = ''; if (pz) { prazo = (pz[3] || new Date().getFullYear()) + '-' + pz[2].padStart(2, '0') + '-' + pz[1].padStart(2, '0'); texto = texto.replace(pz[0], '').trim(); }
    cl.itens.push({ id: Dados.id('ci'), texto: texto, feito: false, membro: membro, prazo: prazo });
    if (membro && membro !== eu()) notificar(eu() + ' atribuiu a você o item "' + texto + '"', link(aberto.q, aberto.c));
    return true;
  }

  async function anexarArquivos(fs) {
    const a = aberto; if (!a || !fs || !fs.length) return;
    for (const f of fs) {
      if (f.size > 100 * 1024 * 1024) { aviso(f.name + ': acima de 100 MB.', 'erro'); continue; }
      const id = Dados.id('anx'); await Dados.guardarArquivo(id, f);
      a.c.anexos = (a.c.anexos || []).concat({ id: id, nome: f.name, tamanho: f.size, tipo: f.type, em: new Date().toISOString() });
      if (/^image\//.test(f.type) && !a.c.capaAnexo && !a.c.capa && a.q.config.capas !== false) a.c.capaAnexo = id;
      registrar(a.q, a.c, 'anexou ' + f.name);
    }
    a.painel = null; mudou();
  }

  async function cliqueCartao(ev) {
    const a = aberto; if (!a) return; const q = a.q, c = a.c;
    const pn = ev.target.closest('[data-painel]'); if (pn) { a.painel = a.painel === pn.dataset.painel ? null : pn.dataset.painel; pintar(); return; }
    const bc = ev.target.closest('[data-botao-cartao]'); if (bc) { const b = q.botoesCartao.find(function (x) { return x.id === bc.dataset.botaoCartao; }); K.aplicarAcoes(q, c, b.acoes, Object.assign(ctx(), { origem: 'botão "' + b.nome + '"' })); aviso('Botão "' + b.nome + '" executado.'); if (!cartao(q, c.id) || c.arquivado) { salvar(); fecharCartao(); return; } mudou(); return; }
    const capa = ev.target.closest('[data-capa]'); if (capa) { c.capa = capa.dataset.capa; c.capaAnexo = ''; mudou('mudou a capa'); return; }
    const ir = ev.target.closest('[data-ir]'); if (ir) { ev.preventDefault(); const v = c.vinculos[Number(ir.dataset.ir)]; const r = acharId(v.q, v.c); fecharCartao(true); aberto = null; location.hash = link(r.quadro, r.cartao); return; }
    const md = ev.target.closest('.md input[type=checkbox][data-md-linha]');
    if (md) { const n = Number(md.dataset.mdLinha); const linhas = c.descricao.split('\n'); linhas[n] = linhas[n].replace(/\[( |x|X)\]/, md.checked ? '[x]' : '[ ]'); c.descricao = linhas.join('\n'); mudou(); return; }
    const b = ev.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k;
    const clEl = b.closest('[data-cl]'); const cl = clEl && c.checklists.find(function (x) { return x.id === clEl.dataset.cl; });
    const itEl = b.closest('[data-item]'); const it = itEl && cl && cl.itens.find(function (x) { return x.id === itEl.dataset.item; });
    const comEl = b.closest('[data-com]'); const com = comEl && c.comentarios.find(function (x) { return x.id === comEl.dataset.com; });
    if (k === 'item') { it.feito = b.checked; registrar(q, c, (it.feito ? 'concluiu' : 'reabriu') + ' "' + it.texto + '"'); if (cl.itens.every(function (i) { return i.feito; })) K.dispararEvento(q, c, { tipo: 'checklist-completo' }, ctx()); mudou(); return; }
    if (b.tagName === 'A' || b.tagName === 'BUTTON') ev.preventDefault();
    if (k === 'fechar') { fecharCartao(); return; }
    if (k === 'fechar-painel') { a.painel = null; pintar(); return; }
    if (k === 'editar-desc' || (k === 'editar-desc-clique' && !ev.target.closest('a, input'))) { a.editandoDesc = true; pintar(); const t = document.querySelector('[data-desc]'); if (t) t.focus(); return; }
    if (k === 'salvar-desc') { c.descricao = document.querySelector('[data-desc]').value; a.editandoDesc = false; mudou('editou a descrição'); return; }
    if (k === 'cancelar-desc') { a.editandoDesc = false; pintar(); return; }
    if (k === 'renomear-cl') { const n = await pedir('Renomear checklist', 'Título', cl.titulo); if (n) { cl.titulo = n; mudou(); } return; }
    if (k === 'ocultar-feitos') { cl.ocultarFeitos = !cl.ocultarFeitos; mudou(); return; }
    if (k === 'del-cl') { if (await confirmar('Excluir checklist', 'Excluir o checklist "' + esc(cl.titulo) + '"?', 'Excluir')) { c.checklists = c.checklists.filter(function (x) { return x !== cl; }); mudou('excluiu o checklist ' + cl.titulo); } return; }
    if (k === 'editar-item') { if (ev.target.closest('a')) return; const n = await pedir('Editar item', 'Texto', it.texto); if (n) { it.texto = n; mudou(); } return; }
    if (k === 'del-item') { cl.itens = cl.itens.filter(function (x) { return x !== it; }); mudou(); return; }
    if (k === 'item-cartao') { const novo = criarCartao(q, c.lista, { titulo: it.texto, membros: it.membro ? [it.membro] : [], prazo: it.prazo ? it.prazo + 'T12:00' : '', vinculos: [{ q: q.id, c: c.id }] }); c.vinculos = (c.vinculos || []).concat({ q: q.id, c: novo.id }); cl.itens = cl.itens.filter(function (x) { return x !== it; }); mudou('transformou o item "' + it.texto + '" em cartão'); aviso('Cartão criado e vinculado.'); return; }
    if (k === 'comentar') {
      const t = document.querySelector('[data-novo-comentario]').value.trim(); if (!t) return;
      c.comentarios = [{ id: Dados.id('cm'), texto: t, em: new Date().toISOString(), por: eu(), reacoes: {} }].concat(c.comentarios || []);
      K.mencoes(t, e().membros).forEach(function (m) { if (m !== eu()) notificar(eu() + ' mencionou ' + m + ' em "' + c.titulo + '": ' + t.slice(0, 120), link(q, c)); });
      if (c.seguindo) notificar('Novo comentário em "' + c.titulo + '"', link(q, c));
      mudou(); return;
    }
    if (k === 'editar-com') { a.editandoComentario = com.id; pintar(); return; }
    if (k === 'cancelar-com') { a.editandoComentario = null; pintar(); return; }
    if (k === 'salvar-com') { com.texto = document.querySelector('[data-editar-com]').value; com.editadoEm = new Date().toISOString(); a.editandoComentario = null; mudou(); return; }
    if (k === 'del-com') { if (await confirmar('Excluir comentário', 'Excluir este comentário?', 'Excluir')) { c.comentarios = c.comentarios.filter(function (x) { return x !== com; }); mudou(); } return; }
    if (k === 'reagir') { com.reacoes = com.reacoes || {}; const l = com.reacoes[b.dataset.r] = com.reacoes[b.dataset.r] || []; const i = l.indexOf(eu()); if (i >= 0) l.splice(i, 1); else l.push(eu()); mudou(); return; }
    if (k === 'detalhes') { est.detalhes = !est.detalhes; pintar(); return; }
    if (k === 'entrar') { const i = (c.membros || []).indexOf(eu()); if (i >= 0) { c.membros.splice(i, 1); mudou('saiu do cartão'); } else { c.membros = (c.membros || []).concat(eu()); K.dispararEvento(q, c, { tipo: 'membro', membro: eu() }, ctx()); mudou('entrou no cartão'); } return; }
    if (k === 'votar') { c.votos = c.votos || []; const i = c.votos.indexOf(eu()); if (i >= 0) c.votos.splice(i, 1); else c.votos.push(eu()); mudou(); return; }
    if (k === 'seguir') { c.seguindo = !c.seguindo; mudou(c.seguindo ? 'passou a seguir' : 'deixou de seguir'); return; }
    if (k === 'modelo') { c.modelo = !c.modelo; mudou(c.modelo ? 'tornou o cartão um modelo' : 'deixou de ser modelo'); return; }
    if (k === 'compartilhar') { const u = location.href.replace(/#.*$/, '') + link(q, c); try { await navigator.clipboard.writeText(u); aviso('Link do cartão copiado.'); } catch (err) { await pedir('Link do cartão', 'Copie o endereço', u); } return; }
    if (k === 'peca') { salvar(); fecharCartao(true); aberto = null; location.hash = '#/pecas/nova/' + encodeURIComponent(q.id + ':' + c.id); return; }
    if (k === 'arquivar') { c.arquivado = !c.arquivado; mudou(c.arquivado ? 'arquivou o cartão' : 'restaurou o cartão'); return; }
    if (k === 'excluir') { if (await confirmar('Excluir cartão', 'Excluir de vez? Não dá para desfazer.', 'Excluir')) { (c.anexos || []).forEach(function (x) { if (!x.link) Dados.apagarArquivo(x.id); }); q.cartoes = q.cartoes.filter(function (x) { return x !== c; }); registrar(q, null, 'excluiu o cartão "' + c.titulo + '"'); salvar(); fecharCartao(); } return; }
    if (k === 'execucao') { await editarExecucao(q, c); mudou(); return; }
    if (k === 'limpar-datas') { c.inicio = ''; c.prazo = ''; c.lembrete = ''; a.painel = null; mudou('removeu as datas'); return; }
    if (k === 'add-arquivo') { const fs = await UI.escolherArquivo('', true); anexarArquivos(fs); return; }
    if (k === 'abrir-anexo') { const blob = await Dados.lerArquivo(b.dataset.anexo); if (blob) UI.abrirArquivo(blob, b.dataset.nome || 'anexo'); else aviso('Arquivo não está neste navegador.', 'erro'); return; }
    if (k === 'del-anexo') { const x = c.anexos.find(function (y) { return y.id === b.dataset.anexo; }); if (!x.link) await Dados.apagarArquivo(x.id); c.anexos = c.anexos.filter(function (y) { return y !== x; }); if (c.capaAnexo === x.id) c.capaAnexo = ''; mudou('removeu o anexo ' + x.nome); return; }
    if (k === 'capa-anexo') { c.capaAnexo = c.capaAnexo === b.dataset.anexo ? '' : b.dataset.anexo; mudou('mudou a capa'); return; }
    if (k === 'sem-capa') { c.capa = ''; c.capaAnexo = ''; mudou('removeu a capa'); return; }
    if (k === 'desvincular') { const v = c.vinculos[Number(b.dataset.i)]; c.vinculos.splice(Number(b.dataset.i), 1); const r = acharId(v.q, v.c); if (r) r.cartao.vinculos = (r.cartao.vinculos || []).filter(function (x) { return !(x.q === q.id && x.c === c.id); }); mudou(); return; }
  }

  function mudancaCartao(ev) {
    const a = aberto; if (!a) return; const q = a.q, c = a.c; const t = ev.target;
    if (t.hasAttribute('data-desc')) { if (t.value !== (c.descricao || '')) { c.descricao = t.value; a.editandoDesc = false; mudou('editou a descrição'); } return; }
    if (t.dataset.campo === 'titulo') { const v = t.value.replace(/\n/g, ' ').trim(); if (v && v !== c.titulo) { c.titulo = v; mudou('renomeou o cartão'); } return; }
    if (t.dataset.campo === 'lista') { moverCartao(q, c, t.value); a.painel = null; pintar(); return; }
    if (t.dataset.campo === 'concluido') { c.concluido = t.checked; if (c.concluido) K.dispararEvento(q, c, { tipo: 'concluir' }, ctx()); mudou(c.concluido ? 'marcou como concluído' : 'marcou como pendente'); return; }
    if (t.dataset.cf) { const f = q.campos.find(function (x) { return x.id === t.dataset.cf; }); c.valores = c.valores || {}; c.valores[f.id] = f.tipo === 'check' ? t.checked : f.tipo === 'moeda' || f.tipo === 'numero' ? (t.value ? Nucleo.lerNumeroBR(t.value) : null) : t.value; mudou('alterou ' + f.nome); return; }
    if (t.dataset.membro) { const m = t.dataset.membro; if (t.checked) { c.membros = (c.membros || []).concat(m); K.dispararEvento(q, c, { tipo: 'membro', membro: m }, ctx()); if (m !== eu()) notificar(eu() + ' adicionou ' + m + ' ao cartão "' + c.titulo + '"', link(q, c)); mudou('adicionou ' + m); } else { c.membros = c.membros.filter(function (x) { return x !== m; }); mudou('removeu ' + m); } return; }
    if (t.dataset.etiqueta) { const id = t.dataset.etiqueta; if (t.checked) { c.etiquetas = (c.etiquetas || []).concat(id); K.dispararEvento(q, c, { tipo: 'etiqueta', etiqueta: id }, ctx()); } else c.etiquetas = c.etiquetas.filter(function (x) { return x !== id; }); mudou(); return; }
    if (t.dataset.tam) { c.capaTamanho = t.dataset.tam; mudou(); return; }
    if (t.hasAttribute('data-item-membro')) { const cl = c.checklists.find(function (x) { return x.id === t.closest('[data-cl]').dataset.cl; }); const it = cl.itens.find(function (x) { return x.id === t.closest('[data-item]').dataset.item; }); it.membro = t.value; if (t.value && t.value !== eu()) notificar(eu() + ' atribuiu a ' + t.value + ' o item "' + it.texto + '"', link(q, c)); mudou(); return; }
    if (t.hasAttribute('data-item-prazo')) { const cl = c.checklists.find(function (x) { return x.id === t.closest('[data-cl]').dataset.cl; }); const it = cl.itens.find(function (x) { return x.id === t.closest('[data-item]').dataset.item; }); it.prazo = t.value; mudou(); return; }
    if (t.hasAttribute('data-mc-quadro')) { const qq = e().quadros.find(function (x) { return x.id === t.value; }); t.form.querySelector('[data-mc-lista]').innerHTML = opcoes(qq.listas.filter(function (x) { return !x.arquivada; }).map(function (x) { return { v: x.id, t: x.nome }; })); return; }
  }

  // Formulários dos painéis (submit) e teclas dentro da janela.
  document.addEventListener('submit', function (ev) {
    const a = aberto; const f = ev.target; if (!a || !f.closest || !f.closest('#kov')) return;
    const q = a.q, c = a.c;
    if (f.hasAttribute('data-novo-membro')) { ev.preventDefault(); const n = f.querySelector('input').value.trim(); if (n && e().membros.indexOf(n) < 0) { e().membros.push(n); mudou(); } return; }
    if (f.hasAttribute('data-nova-etiqueta')) { ev.preventDefault(); const fd = new FormData(f); const x = { id: Dados.id('et'), nome: fd.get('nome').trim(), cor: fd.get('cor') }; q.etiquetas.push(x); c.etiquetas = (c.etiquetas || []).concat(x.id); mudou('criou a etiqueta ' + (x.nome || x.cor)); return; }
    if (f.hasAttribute('data-datas')) { ev.preventDefault(); const fd = new FormData(f); c.inicio = fd.get('inicio'); if (c.prazo !== fd.get('prazo')) c.avisadoPrazo = null; c.prazo = fd.get('prazo'); c.lembrete = fd.get('lembrete'); a.painel = null; mudou('alterou as datas'); return; }
    if (f.hasAttribute('data-novo-checklist')) {
      ev.preventDefault(); const fd = new FormData(f); const t = fd.get('t').trim() || 'Checklist';
      const outras = []; q.cartoes.forEach(function (x) { if (x !== c) (x.checklists || []).forEach(function (cl) { outras.push(cl); }); });
      const base = fd.get('de') !== '' ? outras[Number(fd.get('de'))].itens.map(function (i) { return i.texto; }) : (CHECK_ETAPA[t] || []);
      c.checklists = (c.checklists || []).concat({ id: Dados.id('cl'), titulo: t, itens: base.map(function (x) { return { id: Dados.id('ci'), texto: x, feito: false }; }) });
      a.painel = null; mudou('adicionou o checklist ' + t); const n = document.querySelector('[data-novo-item] input:last-of-type'); if (n) n.focus(); return;
    }
    if (f.hasAttribute('data-novo-link')) { ev.preventDefault(); const fd = new FormData(f); c.anexos = (c.anexos || []).concat({ id: Dados.id('lk'), nome: fd.get('n') || fd.get('u'), link: fd.get('u'), em: new Date().toISOString() }); a.painel = null; mudou('anexou um link'); return; }
    if (f.hasAttribute('data-repetir')) { ev.preventDefault(); const fd = new FormData(f); c.recorrencia = fd.get('f') ? { freq: fd.get('f'), proxima: fd.get('p') } : null; a.painel = null; mudou(c.recorrencia ? 'configurou a repetição' : 'removeu a repetição'); return; }
    if (f.hasAttribute('data-vincular')) {
      ev.preventDefault(); const t = new FormData(f).get('c');
      const op = Array.prototype.find.call(f.querySelectorAll('datalist option'), function (o) { return o.value === t; });
      if (!op) { aviso('Escolha um cartão da lista.', 'erro'); return; }
      const p = op.dataset.v.split(':'); const r = acharId(p[0], p[1]);
      c.vinculos = (c.vinculos || []).concat({ q: p[0], c: p[1] }); r.cartao.vinculos = (r.cartao.vinculos || []).concat({ q: q.id, c: c.id });
      a.painel = null; mudou('vinculou a "' + r.cartao.titulo + '"'); return;
    }
    if (f.dataset.mover) {
      ev.preventDefault(); const fd = new FormData(f); const destino = e().quadros.find(function (x) { return x.id === fd.get('quadro'); }); const topo = fd.get('pos') === 'topo';
      if (f.dataset.mover === 'copiar') {
        const n = K.copiarCartao(c, { id: Dados.id }, { checklists: !!fd.get('checklists'), etiquetas: !!fd.get('etiquetas') && destino === q, membros: !!fd.get('membros'), comentarios: !!fd.get('comentarios') });
        delete n.id; const novo = criarCartao(destino, fd.get('lista'), Object.assign(n, { titulo: fd.get('titulo') || c.titulo }), topo);
        registrar(q, c, 'copiou para "' + destino.nome + '"'); a.painel = null; salvar(); aviso('Cópia criada.'); abrirCartao(destino, novo); return;
      }
      if (destino !== q) { q.cartoes = q.cartoes.filter(function (x) { return x !== c; }); c.etiquetas = []; c.num = ++destino.seq; destino.cartoes.push(c); registrar(q, null, 'moveu "' + c.titulo + '" para o quadro ' + destino.nome); a.q = destino; }
      c.ordem = topo ? -1e6 : 1e6; moverCartao(destino, c, fd.get('lista')); a.painel = null; mudou(); return;
    }
  });

  function teclaCartao(ev) {
    if (ev.key === 'Escape') { ev.stopPropagation(); if (aberto.painel) { aberto.painel = null; pintar(); } else fecharCartao(); }
    if (ev.target.classList.contains('kj-titulo') && ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); }
    if (ev.target.hasAttribute('data-novo-comentario') && ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); document.querySelector('[data-k=comentar]').click(); }
  }

  // ---------- execução: contrato, empenhos, notas, pagamentos ----------
  const ST_NF = { paga: 'Paga', parcial: 'Paga em parte', aberta: 'Em aberto', atrasada: 'Em atraso' };
  function execucaoResumo(c) {
    const x = c.execucao; if (!x) return '<p class="mudo mini">Sem dados de execução.</p>';
    Execucao.normalizar(x); const r = Execucao.resumo(x);
    const vig = x.vigenciaFim ? Nucleo.diasEntre(new Date(), x.vigenciaFim + 'T12:00:00') : null;
    return '<dl class="numeros"><div><dt>Contrato</dt><dd>' + esc(x.numero || '—') + ' · ' + moeda(x.valor) + '</dd></div><div><dt>Vigência</dt><dd class="' + (vig != null && vig < 30 ? 'alerta' : '') + '">' + data(x.vigenciaFim) + (vig != null ? ' (' + vig + ' d)' : '') + '</dd></div>' +
      '<div><dt>Empenhado</dt><dd>' + moeda(r.empenhado) + '</dd></div><div><dt>Faturado (NF)</dt><dd>' + moeda(r.faturado) + '</dd></div><div><dt>Recebido</dt><dd>' + moeda(r.recebido) + '</dd></div><div><dt>A receber</dt><dd class="' + (r.aReceber > 0.009 ? 'alerta' : '') + '">' + moeda(r.aReceber) + '</dd></div><div><dt>Saldo do contrato</dt><dd>' + moeda(r.saldoContrato) + '</dd></div></dl>' +
      (r.empenhos.length ? '<h5 class="ex-sub">Empenhos</h5><ul class="ex-lista">' + r.empenhos.map(function (m) { return '<li><b>' + esc(m.numero || '(sem número)') + '</b> · ' + moeda(m.valor) + ' · NF: ' + (m.notas.length ? esc(m.notas.join(', ')) : '—') + ' · <span class="' + (m.excedido ? 'alerta' : 'mudo') + '">saldo ' + moeda(m.saldo) + '</span></li>'; }).join('') + '</ul>' : '') +
      (r.notas.length ? '<h5 class="ex-sub">Notas fiscais</h5><ul class="ex-lista">' + r.notas.map(function (n) { return '<li><b>NF ' + esc(n.numero || '—') + '</b> · ' + moeda(n.valor) + ' · empenho ' + esc(n.empenho || '—') + ' · <span class="tag ex-' + n.status + '">' + ST_NF[n.status] + '</span>' + (n.aberto ? ' <span class="mudo">falta ' + moeda(n.aberto) + (n.vencimento ? ', vence ' + data(n.vencimento) : '') + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '') +
      (r.alertas.length ? '<ul class="ex-alertas">' + r.alertas.map(function (t) { return '<li>⚠ ' + esc(t) + '</li>'; }).join('') + '</ul>' : '');
  }

  const EX_COLS = {
    empenhos: { rot: 'Empenhos', novo: '+ Adicionar empenho', cols: [['numero', 'Nº do empenho'], ['data', 'Data', 'date'], ['valor', 'Valor (R$)', 'moeda'], ['vinculo', 'Notas fiscais vinculadas', 'nfs']] },
    notas: { rot: 'Notas fiscais', novo: '+ Adicionar nota fiscal', cols: [['numero', 'Nº da NF'], ['data', 'Emissão', 'date'], ['atesto', 'Atesto', 'date'], ['vencimento', 'Vencimento', 'date'], ['valor', 'Valor (R$)', 'moeda'], ['empenhoId', 'Empenho', 'empenho']] },
    pagamentos: { rot: 'Pagamentos', novo: '+ Adicionar pagamento', cols: [['data', 'Data', 'date'], ['valor', 'Valor (R$)', 'moeda'], ['notaId', 'Nota fiscal paga', 'nota'], ['obs', 'Observação (OB, banco)']] }
  };
  function exLinha(tipo, it) {
    const d = EX_COLS[tipo];
    return '<div class="ex-linha ex-' + tipo + '" data-ex-id="' + esc(it.id) + '">' + d.cols.map(function (k) {
      const v = it[k[0]] == null ? '' : it[k[0]];
      let h;
      if (k[2] === 'date') h = '<input type="date" data-c="' + k[0] + '" value="' + esc(v) + '" aria-label="' + k[1] + '">';
      else if (k[2] === 'moeda') h = '<input inputmode="decimal" data-c="' + k[0] + '" value="' + esc(v === '' ? '' : String(v).replace('.', ',')) + '" placeholder="0,00" aria-label="' + k[1] + '">';
      else if (k[2] === 'empenho' || k[2] === 'nota') h = '<select data-c="' + k[0] + '" data-sel="' + esc(v) + '" aria-label="' + k[1] + '"></select>';
      else if (k[2] === 'nfs') h = '<details class="ms ex-nfs"><summary></summary><div class="ms-lista"></div></details>';
      else h = '<input data-c="' + k[0] + '" value="' + esc(v) + '" aria-label="' + k[1] + '">';
      return '<div class="ex-cel" data-rot="' + k[1] + '">' + h + '</div>';
    }).join('') + '<button type="button" class="icone ex-tirar" data-ex-tirar aria-label="Remover linha" title="Remover">×</button></div>';
  }
  function exSecao(tipo, l) {
    const d = EX_COLS[tipo];
    return '<section class="ex-secao" data-ex="' + tipo + '"><header><h4>' + d.rot + '</h4><button type="button" class="btn mini" data-ex-add="' + tipo + '">' + d.novo + '</button></header>' +
      '<div class="ex-linha ex-cab ex-' + tipo + '">' + d.cols.map(function (k) { return '<span>' + k[1] + '</span>'; }).join('') + '<span></span></div>' +
      '<div class="ex-corpo">' + l.map(function (it) { return exLinha(tipo, it); }).join('') + '</div><p class="mini mudo ex-vazio"' + (l.length ? ' hidden' : '') + '>Nenhum registro. Use o botão acima para adicionar.</p></section>';
  }
  // Lê as linhas do formulário (antes de fechar a janela).
  function exLer(form) {
    const out = {};
    Object.keys(EX_COLS).forEach(function (tipo) {
      out[tipo] = Array.prototype.map.call(form.querySelectorAll('.ex-secao[data-ex=' + tipo + '] .ex-corpo .ex-linha'), function (ln) {
        const it = { id: ln.dataset.exId };
        EX_COLS[tipo].cols.forEach(function (k) { const i = ln.querySelector('[data-c=' + k[0] + ']'); if (!i) return; it[k[0]] = k[2] === 'moeda' ? (i.value.trim() ? Nucleo.lerNumeroBR(i.value) : null) : i.value.trim(); });
        return it;
      }).filter(function (it) { return Object.keys(it).some(function (k) { return k !== 'id' && it[k] !== '' && it[k] != null; }); });
    });
    return out;
  }
  // Mantém as listas de vínculo coerentes enquanto a janela está aberta.
  function exSincronizar(form) {
    const ler = exLer(form);
    const fmtNum = function (n, pre) { return (pre || '') + (n.numero || '(sem número)'); };
    form.querySelectorAll('.ex-notas select[data-c=empenhoId]').forEach(function (s) {
      const atual = s.value || s.dataset.sel || '';
      s.innerHTML = '<option value="">Sem empenho</option>' + ler.empenhos.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(fmtNum(m)) + '</option>'; }).join('');
      s.value = ler.empenhos.some(function (m) { return m.id === atual; }) ? atual : ''; s.dataset.sel = s.value;
    });
    const ler2 = exLer(form);
    form.querySelectorAll('.ex-pagamentos select[data-c=notaId]').forEach(function (s) {
      const atual = s.value || s.dataset.sel || '';
      s.innerHTML = '<option value="">Sem nota</option>' + ler2.notas.map(function (n) { return '<option value="' + esc(n.id) + '">' + esc(fmtNum(n, 'NF ')) + (n.valor ? ' · ' + moeda(n.valor) : '') + '</option>'; }).join('');
      s.value = ler2.notas.some(function (n) { return n.id === atual; }) ? atual : ''; s.dataset.sel = s.value;
    });
    form.querySelectorAll('.ex-linha.ex-empenhos[data-ex-id]').forEach(function (ln) {
      const id = ln.dataset.exId; const det = ln.querySelector('.ex-nfs'); if (!det) return;
      const ligadas = ler2.notas.filter(function (n) { return n.empenhoId === id; });
      det.querySelector('summary').textContent = ligadas.length ? ligadas.map(function (n) { return 'NF ' + (n.numero || '?'); }).join(', ') : 'Vincular notas';
      const lista = det.querySelector('.ms-lista');
      lista.innerHTML = ler2.notas.length ? ler2.notas.map(function (n) { return '<label><input type="checkbox" data-ex-nf="' + esc(n.id) + '"' + (n.empenhoId === id ? ' checked' : '') + '> <span>' + esc(fmtNum(n, 'NF ')) + (n.empenhoId && n.empenhoId !== id ? ' <small class="mudo">(em outro empenho)</small>' : '') + '</span></label>'; }).join('') : '<p class="mini mudo">Cadastre a nota fiscal abaixo para vincular.</p>';
    });
    form.querySelectorAll('.ex-secao').forEach(function (sec) { sec.querySelector('.ex-vazio').hidden = !!sec.querySelector('.ex-corpo .ex-linha'); });
  }

  async function editarExecucao(q, c) {
    const x = Execucao.normalizar(c.execucao = c.execucao || { empenhos: [], notas: [], pagamentos: [] });
    let lido = null;
    const f = await modal({
      titulo: 'Execução: ' + c.titulo, largo: true,
      corpo: '<div class="ex-cab-contrato">' + campo('Nº contrato / ata', '<input name="numero" value="' + esc(x.numero || '') + '">') + campo('Valor do contrato (R$)', '<input name="valor" inputmode="decimal" value="' + esc(x.valor != null ? String(x.valor).replace('.', ',') : '') + '">') + campo('Assinatura', '<input type="date" name="assinatura" value="' + esc(x.assinatura || '') + '">') + campo('Fim da vigência', '<input type="date" name="vigenciaFim" value="' + esc(x.vigenciaFim || '') + '">') +
        campo('Gestor / fiscal do contrato', '<input name="gestor" value="' + esc(x.gestor || '') + '">') + campo('Prazo de pagamento (dias após atesto)', '<input name="prazoPagamento" inputmode="numeric" value="' + esc(x.prazoPagamento || '30') + '">') + '</div>' +
        exSecao('empenhos', x.empenhos) + exSecao('notas', x.notas) + exSecao('pagamentos', x.pagamentos) +
        '<p class="mini mudo">Vincule cada nota fiscal ao empenho (na nota ou na coluna "Notas fiscais vinculadas" do empenho) e cada pagamento à nota paga. Vencimento em branco = atesto + prazo de pagamento.</p>',
      aoAbrir: function (form) {
        exSincronizar(form);
        form.addEventListener('click', function (ev) {
          const add = ev.target.closest('[data-ex-add]');
          if (add) { const tipo = add.dataset.exAdd; const sec = form.querySelector('.ex-secao[data-ex=' + tipo + '] .ex-corpo'); sec.insertAdjacentHTML('beforeend', exLinha(tipo, { id: Execucao.novoId(tipo.slice(0, 2)) })); exSincronizar(form); const p = sec.lastElementChild.querySelector('input'); if (p) p.focus(); return; }
          const tirar = ev.target.closest('[data-ex-tirar]');
          if (tirar) { tirar.closest('.ex-linha').remove(); exSincronizar(form); }
        });
        form.addEventListener('change', function (ev) {
          const nf = ev.target.closest('[data-ex-nf]');
          if (nf) { const emp = ev.target.closest('.ex-linha').dataset.exId; const s = form.querySelector('.ex-linha.ex-notas[data-ex-id="' + nf.dataset.exNf + '"] select[data-c=empenhoId]'); if (s) { s.value = nf.checked ? emp : ''; s.dataset.sel = s.value; } }
          if (ev.target.matches('select[data-c]')) ev.target.dataset.sel = ev.target.value;
          exSincronizar(form);
          if (nf) { const det = nf.closest('details'); if (det) det.open = true; }
        });
        form.addEventListener('input', function (ev) { if (ev.target.matches('[data-c=numero], [data-c=valor]')) { clearTimeout(form._exT); form._exT = setTimeout(function () { const ab = form.querySelector('details[open]'); exSincronizar(form); if (ab) ab.open = true; }, 300); } });
      },
      validar: function (fd, form) {
        lido = exLer(form);
        const semValor = ['empenhos', 'notas', 'pagamentos'].filter(function (t) { return lido[t].some(function (i) { return !i.valor; }); });
        if (semValor.length) return 'Informe o valor em todas as linhas de ' + semValor.map(function (t) { return EX_COLS[t].rot.toLowerCase(); }).join(', ') + ' (ou remova a linha).';
        return '';
      }
    });
    if (!f || !lido) return;
    x.numero = f.get('numero'); x.valor = f.get('valor') ? Nucleo.lerNumeroBR(f.get('valor')) : null; x.assinatura = f.get('assinatura'); x.vigenciaFim = f.get('vigenciaFim'); x.gestor = f.get('gestor'); x.prazoPagamento = Number(f.get('prazoPagamento')) || 30;
    x.empenhos = lido.empenhos.map(function (m) { delete m.vinculo; return m; }); x.notas = lido.notas; x.pagamentos = lido.pagamentos;
    x.notas.forEach(function (n) { if (!n.vencimento && n.atesto) n.vencimento = Execucao.vencimentoPadrao(n.atesto, x.prazoPagamento); n.empenho = (x.empenhos.find(function (m) { return m.id === n.empenhoId; }) || {}).numero || ''; });
    x.pagamentos.forEach(function (p) { p.ref = (x.notas.find(function (n) { return n.id === p.notaId; }) || {}).numero || ''; });
    registrar(q, c, 'atualizou a execução do contrato');
  }

  // ---------- menus ----------
  async function pedir(titulo, rotulo, valor) {
    const f = await modal({ titulo: titulo, corpo: campo(rotulo, '<input name="v" value="' + esc(valor || '') + '">') });
    return f ? String(f.get('v') || '').trim() : null;
  }

  async function painelFiltros(q) {
    const f = filtroDe(q);
    const r = await modal({
      titulo: 'Filtrar cartões', botao: 'Aplicar',
      corpo: campo('Palavra-chave', '<input name="texto" value="' + esc(f.texto) + '" placeholder="Título, descrição, checklist, #número…">') +
        '<fieldset><legend>Membros</legend><div class="grade-checks"><label><input type="checkbox" name="semMembro"' + (f.semMembro ? ' checked' : '') + '> Sem membros</label><label><input type="checkbox" name="meus"' + (f.meus ? ' checked' : '') + '> Cartões atribuídos a mim</label>' + e().membros.map(function (m) { return '<label><input type="checkbox" name="membros" value="' + esc(m) + '"' + (f.membros.indexOf(m) >= 0 ? ' checked' : '') + '> ' + avatar(m) + ' ' + esc(m) + '</label>'; }).join('') + '</div></fieldset>' +
        '<fieldset><legend>Etiquetas</legend><div class="grade-checks"><label><input type="checkbox" name="semEtiqueta"' + (f.semEtiqueta ? ' checked' : '') + '> Sem etiquetas</label>' + q.etiquetas.map(function (x) { return '<label><input type="checkbox" name="etiquetas" value="' + x.id + '"' + (f.etiquetas.indexOf(x.id) >= 0 ? ' checked' : '') + '><span class="ket cor-' + x.cor + '">' + esc(x.nome || x.cor) + '</span></label>'; }).join('') + '</div></fieldset>' +
        '<div class="linha">' + campo('Prazo', '<select name="prazo">' + opcoes([{ v: '', t: 'Qualquer' }, { v: 'atrasado', t: 'Atrasados' }, { v: 'dia', t: 'Vencem no próximo dia' }, { v: 'semana', t: 'Vencem na próxima semana' }, { v: 'mes', t: 'Vencem no próximo mês' }, { v: 'com', t: 'Com data' }, { v: 'sem', t: 'Sem data' }], f.prazo) + '</select>') +
        campo('Status', '<select name="status">' + opcoes([{ v: '', t: 'Todos' }, { v: 'concluido', t: 'Marcados como concluídos' }, { v: 'pendente', t: 'Não concluídos' }], f.status) + '</select>') +
        campo('Atividade', '<select name="atividade">' + opcoes([{ v: '', t: 'Qualquer' }, { v: '1', t: 'Última semana' }, { v: '2', t: 'Últimas 2 semanas' }, { v: '4', t: 'Últimas 4 semanas' }, { v: 'sem4', t: 'Sem atividade há 4 semanas' }], f.atividade) + '</select>') +
        campo('Combinar etiquetas', '<select name="modoEtiqueta">' + opcoes([{ v: 'any', t: 'Qualquer correspondência' }, { v: 'all', t: 'Correspondência exata (todas)' }], f.modoEtiqueta) + '</select>') + '</div>'
    });
    if (!r) return;
    est.filtros[q.id] = { texto: r.get('texto'), membros: r.getAll('membros'), semMembro: !!r.get('semMembro'), meus: !!r.get('meus'), etiquetas: r.getAll('etiquetas'), semEtiqueta: !!r.get('semEtiqueta'), prazo: r.get('prazo'), status: r.get('status'), atividade: r.get('atividade'), modoEtiqueta: r.get('modoEtiqueta') };
  }

  async function menuLista(q, l) {
    const qs = e().quadros.filter(function (x) { return !x.arquivado; });
    const f = await modal({
      titulo: 'Ações da lista: ' + l.nome, botao: 'Aplicar',
      corpo: '<div class="opcoes-radio">' + [['nada', 'Só salvar as configurações abaixo'], ['topo', 'Adicionar cartão no topo'], ['ordenar-prazo', 'Ordenar por prazo'], ['ordenar-nome', 'Ordenar por nome (A–Z)'], ['ordenar-criacao', 'Ordenar por data de criação (mais novo primeiro)'], ['ordenar-valor', 'Ordenar por valor'], ['mover-todos', 'Mover todos os cartões desta lista para…'], ['arquivar-todos', 'Arquivar todos os cartões desta lista'], ['copiar', 'Copiar lista'], ['mover-quadro', 'Mover lista para outro quadro'], ['arquivar', 'Arquivar esta lista']].map(function (o, i) { return '<label><input type="radio" name="acao" value="' + o[0] + '"' + (i === 0 ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('') + '</div>' +
        '<div class="linha">' + campo('Lista de destino', '<select name="destino">' + opcoes(q.listas.filter(function (x) { return x !== l && !x.arquivada; }).map(function (x) { return { v: x.id, t: x.nome }; })) + '</select>') + campo('Quadro de destino', '<select name="quadro">' + opcoes(qs.filter(function (x) { return x !== q; }).map(function (x) { return { v: x.id, t: x.nome }; })) + '</select>') + '</div>' +
        '<fieldset><legend>Configurações</legend><div class="linha">' + campo('Cor da lista', '<select name="cor"><option value="">Sem cor</option>' + opcoes(CORES, l.cor) + '</select>') + campo('Limite de cartões (0 = sem limite)', '<input name="limite" inputmode="numeric" value="' + esc(l.limite || 0) + '">') + '</div><label class="check"><input type="checkbox" name="seguir"' + (l.seguindo ? ' checked' : '') + '> Seguir lista (notificar quando um cartão entrar)</label></fieldset>'
    });
    if (!f) return;
    l.cor = f.get('cor'); l.limite = Number(f.get('limite')) || 0; l.seguindo = !!f.get('seguir');
    const cs = q.cartoes.filter(function (c) { return c.lista === l.id && !c.arquivado; });
    const a = f.get('acao'); const ord = function (fn) { cs.sort(fn).forEach(function (c, i) { c.ordem = i; }); };
    if (a === 'topo') { setTimeout(function () { abrirCompositor(document.querySelector('.kpagina'), q, l.id, true); }, 50); }
    if (a === 'ordenar-prazo') ord(function (x, y) { return new Date(x.prazo || '2999') - new Date(y.prazo || '2999'); });
    if (a === 'ordenar-nome') ord(function (x, y) { return x.titulo.localeCompare(y.titulo, 'pt-BR'); });
    if (a === 'ordenar-criacao') ord(function (x, y) { return new Date(y.criadoEm) - new Date(x.criadoEm); });
    if (a === 'ordenar-valor') ord(function (x, y) { return ((y.valores || {}).valor || 0) - ((x.valores || {}).valor || 0); });
    if (a === 'mover-todos' && f.get('destino')) cs.forEach(function (c) { moverCartao(q, c, f.get('destino')); });
    if (a === 'arquivar-todos' && await confirmar('Arquivar todos', 'Arquivar os ' + cs.length + ' cartões de "' + esc(l.nome) + '"?', 'Arquivar')) cs.forEach(function (c) { c.arquivado = true; });
    if (a === 'copiar') { const nl = { id: Dados.id('ls'), nome: l.nome + ' (cópia)', cor: l.cor }; q.listas.splice(q.listas.indexOf(l) + 1, 0, nl); cs.forEach(function (c) { const n = K.copiarCartao(c, { id: Dados.id }); n.lista = nl.id; n.num = ++q.seq; q.cartoes.push(n); }); }
    if (a === 'mover-quadro' && f.get('quadro')) {
      const d = e().quadros.find(function (x) { return x.id === f.get('quadro'); });
      q.listas = q.listas.filter(function (x) { return x !== l; }); d.listas.push(l);
      const todos = q.cartoes.filter(function (c) { return c.lista === l.id; });
      q.cartoes = q.cartoes.filter(function (c) { return c.lista !== l.id; });
      todos.forEach(function (c) { c.etiquetas = []; c.num = ++d.seq; d.cartoes.push(c); });
      registrar(d, null, 'recebeu a lista "' + l.nome + '" do quadro ' + q.nome); aviso('Lista movida para "' + d.nome + '".');
    }
    if (a === 'arquivar') l.arquivada = true;
    registrar(q, null, 'lista "' + l.nome + '": ' + a);
  }

  async function menuQuadro(q) {
    const arqC = q.cartoes.filter(function (c) { return c.arquivado; }); const arqL = q.listas.filter(function (l) { return l.arquivada; });
    const f = await modal({
      titulo: 'Menu do quadro', largo: true, botao: 'Salvar',
      corpo: '<div class="linha">' + campo('Nome do quadro', '<input name="nome" value="' + esc(q.nome) + '">') + '</div>' +
        campo('Sobre este quadro (descrição, aceita Markdown)', '<textarea name="descricao" rows="3">' + esc(q.descricao || '') + '</textarea>') +
        '<fieldset><legend>Fundo</legend><div class="kfundos">' + Object.keys(FUNDOS).map(function (k) { return '<label><input type="radio" name="fundo" value="' + k + '"' + (q.fundo === k ? ' checked' : '') + '><span style="background:' + FUNDOS[k] + '"></span></label>'; }).join('') + '</div></fieldset>' +
        '<fieldset><legend>Configurações</legend><div class="grade-checks"><label><input type="checkbox" name="numeros"' + (q.config.numeros ? ' checked' : '') + '> Mostrar número dos cartões</label><label><input type="checkbox" name="envelhecimento"' + (q.config.envelhecimento ? ' checked' : '') + '> Envelhecimento (cartões parados ficam mais apagados)</label><label><input type="checkbox" name="capas"' + (q.config.capas !== false ? ' checked' : '') + '> Mostrar capas</label><label><input type="checkbox" name="votacao"' + (q.config.votacao !== false ? ' checked' : '') + '> Votação nos cartões</label></div></fieldset>' +
        '<fieldset><legend>Etiquetas</legend><table class="tabela compacta"><tbody>' + q.etiquetas.concat([{ id: '', nome: '', cor: 'cinza' }]).map(function (x, i) { return '<tr><td><span class="ket cor-' + x.cor + '">' + (i < 9 && x.id ? i + 1 : '') + '</span></td><td><input name="et_nome_' + i + '" value="' + esc(x.nome) + '" placeholder="' + (x.id ? '' : 'Nova etiqueta') + '"><input type="hidden" name="et_id_' + i + '" value="' + x.id + '"></td><td><select name="et_cor_' + i + '">' + opcoes(CORES, x.cor) + '</select></td><td>' + (x.id ? '<label class="check"><input type="checkbox" name="et_del_' + i + '"> excluir</label>' : '') + '</td></tr>'; }).join('') + '</tbody></table><small>As 9 primeiras podem ser alternadas com as teclas 1 a 9 sobre o cartão.</small></fieldset>' +
        '<fieldset><legend>Membros da equipe</legend><textarea name="membros" rows="3">' + esc(e().membros.join('\n')) + '</textarea><small>Um por linha. Valem para todos os quadros. Quem opera agora: ' + esc(eu()) + ' (mude em Configurações).</small></fieldset>' +
        '<fieldset><legend>Campos personalizados</legend><table class="tabela compacta"><tbody>' + q.campos.concat([{ id: '', nome: '', tipo: 'texto' }]).map(function (x, i) { return '<tr><td><input name="cf_nome_' + i + '" value="' + esc(x.nome) + '" placeholder="' + (x.id ? '' : 'Novo campo') + '"><input type="hidden" name="cf_id_' + i + '" value="' + x.id + '"></td><td><select name="cf_tipo_' + i + '">' + opcoes([{ v: 'texto', t: 'Texto' }, { v: 'numero', t: 'Número' }, { v: 'moeda', t: 'Moeda' }, { v: 'data', t: 'Data' }, { v: 'check', t: 'Caixa de seleção' }, { v: 'lista', t: 'Lista suspensa' }], x.tipo) + '</select></td><td><input name="cf_op_' + i + '" value="' + esc((x.opcoes || []).join(', ')) + '" placeholder="opções da lista, separadas por vírgula"></td><td>' + (x.id ? '<label class="check"><input type="checkbox" name="cf_del_' + i + '"> excluir</label>' : '') + '</td></tr>'; }).join('') + '</tbody></table></fieldset>' +
        '<fieldset><legend>Itens arquivados</legend>' + (arqC.length || arqL.length ? '<ul class="lista-links">' + arqL.map(function (l) { return '<li>Lista: ' + esc(l.nome) + ' <label class="check"><input type="checkbox" name="rest_l" value="' + l.id + '"> restaurar</label></li>'; }).join('') + arqC.map(function (c) { return '<li>' + (c.num ? '#' + c.num + ' ' : '') + esc(c.titulo) + ' <label class="check"><input type="checkbox" name="rest_c" value="' + c.id + '"> restaurar</label> <label class="check"><input type="checkbox" name="del_c" value="' + c.id + '"> excluir de vez</label></li>'; }).join('') + '</ul>' : '<p class="mudo">Nada arquivado.</p>') + '</fieldset>' +
        '<fieldset><legend>Atividade do quadro</legend><ul class="lista-notas kmenu-atividade">' + q.atividade.slice(0, 40).map(function (a) { return '<li><b>' + esc(a.por) + '</b> ' + esc(a.texto) + (a.cartao ? ' — <i>' + esc(a.cartao) + '</i>' : '') + ' <span class="mudo">' + dataHora(a.em) + '</span></li>'; }).join('') + '</ul></fieldset>' +
        '<fieldset><legend>Imprimir, exportar e compartilhar</legend><div class="grade-checks"><label><input type="checkbox" name="exp_json"> Exportar quadro (JSON)</label><label><input type="checkbox" name="exp_csv"> Exportar cartões (CSV)</label><label><input type="checkbox" name="imprimir"> Imprimir</label><label><input type="checkbox" name="copiar"> Fazer uma cópia do quadro</label><label><input type="checkbox" name="fechar"> Fechar este quadro</label></div></fieldset>'
    });
    if (!f) return;
    q.nome = f.get('nome') || q.nome; q.descricao = f.get('descricao'); q.fundo = f.get('fundo') || q.fundo;
    q.config = { numeros: !!f.get('numeros'), envelhecimento: !!f.get('envelhecimento'), capas: !!f.get('capas'), votacao: !!f.get('votacao') };
    const ets = [];
    for (let i = 0; i <= q.etiquetas.length; i++) {
      const id = f.get('et_id_' + i); const nome = f.get('et_nome_' + i); const cor = f.get('et_cor_' + i);
      if (f.get('et_del_' + i)) { q.cartoes.forEach(function (c) { c.etiquetas = (c.etiquetas || []).filter(function (x) { return x !== id; }); }); continue; }
      if (id) ets.push({ id: id, nome: nome, cor: cor }); else if (nome) ets.push({ id: Dados.id('et'), nome: nome, cor: cor });
    }
    q.etiquetas = ets;
    const ms = String(f.get('membros') || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean); if (ms.length) e().membros = ms;
    const cfs = [];
    for (let i = 0; i <= q.campos.length; i++) { const nome = f.get('cf_nome_' + i); if (f.get('cf_del_' + i) || !nome) continue; cfs.push({ id: f.get('cf_id_' + i) || Dados.id('cf'), nome: nome, tipo: f.get('cf_tipo_' + i), opcoes: String(f.get('cf_op_' + i) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean) }); }
    q.campos = cfs;
    f.getAll('rest_l').forEach(function (id) { lista(q, id).arquivada = false; });
    f.getAll('rest_c').forEach(function (id) { cartao(q, id).arquivado = false; });
    const del = f.getAll('del_c'); if (del.length && await confirmar('Excluir cartões', 'Excluir de vez ' + del.length + ' cartão(ões)?', 'Excluir')) q.cartoes = q.cartoes.filter(function (c) { return del.indexOf(c.id) < 0; });
    if (f.get('exp_json')) UI.baixar('quadro-' + Nucleo.normalizar(q.nome).replace(/ /g, '-') + '.json', JSON.stringify({ app: 'seven-licita-quadro', versao: 2, exportadoEm: new Date().toISOString(), quadro: q }, null, 1), 'application/json');
    if (f.get('exp_csv')) exportarCSV(q);
    if (f.get('imprimir')) imprimirQuadro(q);
    if (f.get('copiar')) { const n = JSON.parse(JSON.stringify(q)); n.id = Dados.id('qd'); n.nome = q.nome + ' (cópia)'; n.favorito = false; n.atividade = []; n.cartoes.forEach(function (c) { c.id = Dados.id('ct'); c.anexos = []; c.vinculos = []; }); e().quadros.push(n); aviso('Cópia criada: ' + n.nome); }
    if (f.get('fechar')) { q.arquivado = true; registrar(q, null, 'fechou o quadro'); salvar(); location.hash = '#/quadros'; return; }
    registrar(q, null, 'alterou as configurações do quadro');
  }

  function exportarCSV(q) {
    const cab = ['Número', 'Cartão', 'Lista', 'Etiquetas', 'Membros', 'Início', 'Prazo', 'Concluído', 'Checklist', 'Arquivado'].concat(q.campos.map(function (f) { return f.nome; })).concat(['Descrição']);
    const linhas = q.cartoes.map(function (c) {
      const p = progresso(c);
      return [c.num, c.titulo, (lista(q, c.lista) || {}).nome, (c.etiquetas || []).map(function (id) { const x = q.etiquetas.find(function (y) { return y.id === id; }); return x ? x.nome || x.cor : ''; }).join(', '), (c.membros || []).join(', '), c.inicio || '', c.prazo || '', c.concluido ? 'sim' : 'não', p.t ? p.f + '/' + p.t : '', c.arquivado ? 'sim' : 'não'].concat(q.campos.map(function (f) { return (c.valores || {})[f.id]; })).concat([c.descricao || '']);
    });
    UI.baixar('quadro-' + Nucleo.normalizar(q.nome).replace(/ /g, '-') + '.csv', '﻿' + Nucleo.paraCSV([cab].concat(linhas)), 'text/csv;charset=utf-8');
  }

  function imprimirQuadro(q) {
    const w = window.open('', '_blank'); if (!w) { aviso('Permita pop-ups para imprimir.', 'erro'); return; }
    const base = location.href.replace(/#.*$/, '').replace(/[^/]*$/, '');
    w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(q.nome) + '</title><link rel="stylesheet" href="' + base + 'css/app.css"></head><body class="impressao"><div class="cabecalho-seven"><img src="' + base + 'img/seven-marca.png" alt=""><div><b>SEVEN</b><small>BPO DE LICITAÇÕES</small></div></div><h1>' + esc(q.nome) + '</h1>' +
      q.listas.filter(function (l) { return !l.arquivada; }).map(function (l) { const cs = q.cartoes.filter(function (c) { return c.lista === l.id && !c.arquivado; }); return '<h2>' + esc(l.nome) + ' (' + cs.length + ')</h2><ul>' + cs.map(function (c) { return '<li>' + (c.num ? '#' + c.num + ' ' : '') + esc(c.titulo) + (c.prazo ? ' — prazo ' + dataHora(c.prazo) : '') + ((c.membros || []).length ? ' — ' + esc(c.membros.join(', ')) : '') + '</li>'; }).join('') + '</ul>'; }).join('') + '<script>setTimeout(function(){print()},500)<\/script></body></html>');
    w.document.close();
  }

  // Automação (regras e botões), no estilo do Butler.
  async function menuAutomacao(q) {
    const regras = q.automacoes.map(K.migrarRegra);
    const optLista = function (sel, todas) { return (todas ? '<option value="*"' + (sel === '*' ? ' selected' : '') + '>qualquer lista</option>' : '') + opcoes(q.listas.filter(function (l) { return !l.arquivada; }).map(function (l) { return l.nome; }), sel); };
    const valorPara = function (tipo, v) {
      if (tipo === 'mover' || tipo === 'mover-topo') return '<select data-valor>' + optLista(v) + '</select>';
      if (tipo === 'add-etiqueta' || tipo === 'rem-etiqueta') return '<select data-valor>' + opcoes(q.etiquetas.map(function (x) { return { v: x.nome || x.id, t: x.nome || x.cor }; }), v) + '</select>';
      if (tipo === 'add-membro' || tipo === 'rem-membro') return '<select data-valor>' + opcoes(e().membros, v) + '</select>';
      if (tipo === 'prazo') return '<input data-valor inputmode="numeric" value="' + esc(v == null ? 1 : v) + '" class="curto"> dias';
      if (tipo === 'comentar' || tipo === 'notificar' || tipo === 'checklist') return '<input data-valor value="' + esc(v || '') + '" placeholder="' + (tipo === 'checklist' ? 'Título; item 1; item 2' : 'texto') + '">';
      return '<input type="hidden" data-valor value="">';
    };
    const linhaAcao = function (a) { return '<div class="kau-acao"><select data-tipo>' + opcoes(Object.keys(K.ACOES).map(function (k) { return { v: k, t: K.ACOES[k] }; }), a.tipo) + '</select><span data-valor-box>' + valorPara(a.tipo, a.valor) + '</span><button type="button" class="icone" data-rem-acao aria-label="Remover ação">×</button></div>'; };
    const blocoGatilho = function (g) {
      return '<select data-gtipo>' + opcoes(Object.keys(K.GATILHOS).map(function (k) { return { v: k, t: K.GATILHOS[k] }; }), g.tipo) + '</select>' +
        '<span data-gbox>' + (g.tipo === 'entrar-lista' || g.tipo === 'criar' ? '<select data-glista>' + optLista(g.lista || '*', true) + '</select>' : g.tipo === 'etiqueta' ? '<select data-getiqueta>' + opcoes(q.etiquetas.map(function (x) { return { v: x.id, t: x.nome || x.cor }; }), g.etiqueta) + '</select>' : g.tipo === 'membro' ? '<select data-gmembro><option value="">qualquer</option>' + opcoes(e().membros, g.membro) + '</select>' : g.tipo === 'prazo-proximo' ? '<input data-gdias inputmode="numeric" class="curto" value="' + esc(g.dias || 1) + '"> dias' : '') + '</span>';
    };
    const regraHTML = function (r) { return '<div class="kau-regra" data-regra="' + r.id + '"><header><label class="check"><input type="checkbox" data-ativo' + (r.ativo !== false ? ' checked' : '') + '> ativa</label><span class="kespaco"></span><button type="button" class="btn mini fantasma perigo" data-rem-regra>Excluir regra</button></header><div class="kau-gat">' + blocoGatilho(r.gatilho) + '</div><p class="mini mudo">então</p><div class="kau-acoes">' + (r.acoes || []).map(linhaAcao).join('') + '</div><button type="button" class="btn mini" data-add-acao>+ ação</button></div>'; };
    const botaoHTML = function (b, tipo) { return '<div class="kau-regra" data-botao-cfg="' + tipo + '"><header><input data-bnome value="' + esc(b.nome || '') + '" placeholder="Nome do botão">' + (tipo === 'quadro' ? ' em todos os cartões de <select data-blista>' + optLista(b.lista) + '</select>' : '') + '<span class="kespaco"></span><button type="button" class="btn mini fantasma perigo" data-rem-regra>Excluir</button></header><div class="kau-acoes">' + (b.acoes || []).map(linhaAcao).join('') + '</div><button type="button" class="btn mini" data-add-acao>+ ação</button></div>'; };
    const r = await modal({
      titulo: 'Automação', largo: true, botao: 'Salvar automações',
      corpo: '<p class="mini mudo">Regras rodam sozinhas quando o gatilho acontece. Botões rodam quando você clica (no topo do quadro ou dentro do cartão). As ações de uma regra podem disparar outras regras, até 4 níveis.</p>' +
        '<h3>Regras</h3><div id="kau-regras">' + regras.map(regraHTML).join('') + '</div><button type="button" class="btn" data-nova-regra>+ Nova regra</button>' +
        '<h3>Botões do quadro</h3><div id="kau-bq">' + q.botoes.map(function (b) { return botaoHTML(b, 'quadro'); }).join('') + '</div><button type="button" class="btn" data-novo-botao="quadro">+ Botão do quadro</button>' +
        '<h3>Botões do cartão</h3><div id="kau-bc">' + q.botoesCartao.map(function (b) { return botaoHTML(b, 'cartao'); }).join('') + '</div><button type="button" class="btn" data-novo-botao="cartao">+ Botão do cartão</button>',
      aoAbrir: function (form) {
        form.addEventListener('click', function (ev) {
          if (ev.target.closest('[data-nova-regra]')) form.querySelector('#kau-regras').insertAdjacentHTML('beforeend', regraHTML({ id: Dados.id('au'), ativo: true, gatilho: { tipo: 'entrar-lista', lista: '*' }, acoes: [{ tipo: 'add-etiqueta' }] }));
          const nb = ev.target.closest('[data-novo-botao]'); if (nb) form.querySelector(nb.dataset.novoBotao === 'quadro' ? '#kau-bq' : '#kau-bc').insertAdjacentHTML('beforeend', botaoHTML({ nome: '', acoes: [{ tipo: 'arquivar' }] }, nb.dataset.novoBotao));
          if (ev.target.closest('[data-add-acao]')) ev.target.closest('.kau-regra').querySelector('.kau-acoes').insertAdjacentHTML('beforeend', linhaAcao({ tipo: 'add-etiqueta' }));
          if (ev.target.closest('[data-rem-acao]')) ev.target.closest('.kau-acao').remove();
          if (ev.target.closest('[data-rem-regra]')) ev.target.closest('.kau-regra').remove();
        });
        form.addEventListener('change', function (ev) {
          if (ev.target.hasAttribute('data-tipo')) ev.target.parentNode.querySelector('[data-valor-box]').innerHTML = valorPara(ev.target.value, '');
          if (ev.target.hasAttribute('data-gtipo')) { const box = document.createElement('div'); box.innerHTML = blocoGatilho({ tipo: ev.target.value }); ev.target.parentNode.querySelector('[data-gbox]').innerHTML = box.querySelector('[data-gbox]').innerHTML; }
        });
      },
      validar: function (fd, form) {
        const lerAcoes = function (el) { return Array.prototype.map.call(el.querySelectorAll('.kau-acao'), function (a) { const v = a.querySelector('[data-valor]'); return { tipo: a.querySelector('[data-tipo]').value, valor: v ? v.value : '' }; }); };
        q.automacoes = Array.prototype.map.call(form.querySelectorAll('[data-regra]'), function (el) {
          const g = { tipo: el.querySelector('[data-gtipo]').value }; const gl = el.querySelector('[data-glista]'), ge = el.querySelector('[data-getiqueta]'), gm = el.querySelector('[data-gmembro]'), gd = el.querySelector('[data-gdias]');
          if (gl) g.lista = gl.value; if (ge) g.etiqueta = ge.value; if (gm) g.membro = gm.value; if (gd) g.dias = Number(gd.value) || 1;
          return { id: el.dataset.regra, ativo: el.querySelector('[data-ativo]').checked, gatilho: g, acoes: lerAcoes(el) };
        });
        const lerBotoes = function (tipo) { return Array.prototype.filter.call(form.querySelectorAll('[data-botao-cfg="' + tipo + '"]'), function (el) { return el.querySelector('[data-bnome]').value.trim(); }).map(function (el) { const bl = el.querySelector('[data-blista]'); return { id: Dados.id('bt'), nome: el.querySelector('[data-bnome]').value.trim(), lista: bl ? bl.value : '', acoes: lerAcoes(el) }; }); };
        q.botoes = lerBotoes('quadro'); q.botoesCartao = lerBotoes('cartao');
        return '';
      }
    });
    if (r) { registrar(q, null, 'atualizou as automações'); aviso('Automações salvas.'); }
  }

  function executarBotaoQuadro(q, b) {
    const l = q.listas.find(function (x) { return x.nome === b.lista || x.id === b.lista; });
    const cs = q.cartoes.filter(function (c) { return !c.arquivado && (!l || c.lista === l.id); });
    cs.forEach(function (c) { K.aplicarAcoes(q, c, b.acoes, Object.assign(ctx(), { origem: 'botão "' + b.nome + '"' })); });
    registrar(q, null, 'rodou o botão "' + b.nome + '" em ' + cs.length + ' cartão(ões)');
    salvar(); aviso('Botão "' + b.nome + '": ' + cs.length + ' cartão(ões).'); App.redesenhar();
  }

  // ---------- notificações ----------
  function sino(cls) { const n = (Dados.e.notificacoes || []).filter(function (x) { return !x.lida; }).length; return '<button class="btn ' + (cls || '') + ' ksino" data-a="sino" aria-label="Notificações">🔔' + (n ? '<b class="ksino-n">' + n + '</b>' : '') + '</button>'; }
  function atualizarSino() { document.querySelectorAll('.ksino').forEach(function (b) { const n = e().notificacoes.filter(function (x) { return !x.lida; }).length; b.innerHTML = '🔔' + (n ? '<b class="ksino-n">' + n + '</b>' : ''); }); }
  async function abrirNotificacoes() {
    const l = e().notificacoes;
    const p = modal({
      titulo: 'Notificações', botao: false,
      corpo: '<div class="grupo-botoes"><button type="button" class="btn mini" data-ler-todas>Marcar todas como lidas</button>' + (self.Notification && Notification.permission !== 'granted' ? '<button type="button" class="btn mini" data-permitir>Ativar notificações do navegador</button>' : '') + '<button type="button" class="btn mini fantasma" data-limpar-not>Limpar</button></div>' +
        (l.length ? '<ul class="knotificacoes">' + l.slice(0, 80).map(function (n) { return '<li class="' + (n.lida ? '' : 'nova') + '"><a href="' + esc(UI.url(n.link || '#/quadros')) + '" data-not="' + n.id + '">' + esc(n.texto) + '</a><br><span class="mini mudo">' + dataHora(n.em) + '</span></li>'; }).join('') + '</ul>' : '<p class="mudo">Nenhuma notificação.</p>'),
      aoAbrir: function (form) {
        form.addEventListener('click', async function (ev) {
          if (ev.target.closest('[data-ler-todas]')) { l.forEach(function (n) { n.lida = true; }); salvar(); atualizarSino(); form.querySelectorAll('.nova').forEach(function (x) { x.classList.remove('nova'); }); }
          if (ev.target.closest('[data-limpar-not]')) { e().notificacoes = []; salvar(); atualizarSino(); form.closest('.modal-fundo').remove(); }
          if (ev.target.closest('[data-permitir]')) { try { await Notification.requestPermission(); } catch (err) { /* sem suporte */ } }
          const a = ev.target.closest('[data-not]'); if (a) { const n = l.find(function (x) { return x.id === a.dataset.not; }); n.lida = true; salvar(); atualizarSino(); form.closest('.modal-fundo').remove(); }
        });
      }
    });
    await p;
  }

  // ---------- atalhos de teclado ----------
  document.addEventListener('keydown', async function (ev) {
    if (App.rota().tela !== 'quadros' || !document.querySelector('.kpagina')) return;
    if (ev.key === 'Escape' && document.getElementById('kov') && !document.querySelector('.modal-fundo') && !(ev.target.closest && ev.target.closest('#kov'))) { if (aberto && aberto.painel) { aberto.painel = null; pintar(); } else fecharCartao(); return; }
    if (document.querySelector('.modal-fundo') || document.getElementById('kov')) return;
    const t = ev.target; if (t.closest && t.closest('input, textarea, select, [contenteditable=true]')) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const q = e().quadros.find(function (x) { return location.hash.indexOf(x.id) >= 0; }); if (!q) return;
    const c = est.sobre && cartao(q, est.sobre); const k = ev.key;
    const fim = function () { ev.preventDefault(); salvar(); App.redesenhar(); };
    if (k === '?') { ev.preventDefault(); ajudaAtalhos(); return; }
    if (k === '/') { ev.preventDefault(); const i = document.getElementById('kbusca-quadro'); if (i) i.focus(); return; }
    if (k === 'q') { const f = filtroDe(q); f.meus = !f.meus; return fim(); }
    if (k === 'x') { est.filtros[q.id] = K.vazioFiltro(); return fim(); }
    if (k === 'f') { ev.preventDefault(); await painelFiltros(q); return fim(); }
    if (k === 'n') { ev.preventDefault(); const l = est.sobreLista && lista(q, est.sobreLista) || q.listas.find(function (x) { return !x.arquivada; }); if (l && est.visao === 'quadro') abrirCompositor(document.querySelector('.kpagina'), q, l.id); return; }
    if (!c) return;
    if (k === 'Enter') { ev.preventDefault(); abrirCartao(q, c); return; }
    if (k === 'e') { ev.preventDefault(); edicaoRapida(q, c); return; }
    if (k === ' ') { const i = (c.membros || []).indexOf(eu()); if (i >= 0) c.membros.splice(i, 1); else { c.membros = (c.membros || []).concat(eu()); K.dispararEvento(q, c, { tipo: 'membro', membro: eu() }, ctx()); } registrar(q, c, i >= 0 ? 'saiu do cartão' : 'entrou no cartão'); return fim(); }
    if (k === 'c') { c.arquivado = true; registrar(q, c, 'arquivou'); aviso('Cartão arquivado. Restaure pelo Menu do quadro.'); return fim(); }
    if (k === 'd') { ev.preventDefault(); abrirCartao(q, c, 'datas'); return; }
    if (k === 'm') { ev.preventDefault(); abrirCartao(q, c, 'membros'); return; }
    if (k === 'l') { ev.preventDefault(); abrirCartao(q, c, 'etiquetas'); return; }
    if (/^[1-9]$/.test(k)) { const et = q.etiquetas[Number(k) - 1]; if (!et) return; const i = (c.etiquetas || []).indexOf(et.id); if (i >= 0) c.etiquetas.splice(i, 1); else { c.etiquetas = (c.etiquetas || []).concat(et.id); K.dispararEvento(q, c, { tipo: 'etiqueta', etiqueta: et.id }, ctx()); } return fim(); }
  });

  function ajudaAtalhos() {
    modal({ titulo: 'Atalhos de teclado', botao: false, corpo: '<table class="tabela compacta"><tbody>' + [['?', 'Mostrar esta ajuda'], ['/', 'Buscar neste quadro'], ['n', 'Novo cartão na lista sob o mouse'], ['f', 'Abrir filtros'], ['q', 'Meus cartões (liga/desliga)'], ['x', 'Limpar filtros'], ['Enter', 'Abrir o cartão sob o mouse'], ['e', 'Edição rápida do cartão'], ['espaço', 'Entrar/sair do cartão'], ['c', 'Arquivar o cartão'], ['d', 'Datas do cartão'], ['m', 'Membros do cartão'], ['l', 'Etiquetas do cartão'], ['1 a 9', 'Alternar a etiqueta correspondente'], ['Esc', 'Fechar janela/painel'], ['Ctrl+Enter', 'Salvar comentário']].map(function (x) { return '<tr><td><kbd>' + esc(x[0]) + '</kbd></td><td>' + esc(x[1]) + '</td></tr>'; }).join('') + '</tbody></table>' });
  }

  // ---------- integrações com outras telas ----------
  function quadroLicitacoes() { garantirQuadroPadrao(); return e().quadros.find(function (x) { return !x.arquivado && x.listas.some(function (l) { return l.nome === 'Oportunidade'; }); }) || e().quadros.find(function (x) { return !x.arquivado; }); }
  function cartaoDeAviso(a, silencioso) {
    const q = quadroLicitacoes();
    const ja = q.cartoes.find(function (c) { return c.avisoId === a.id; });
    if (ja) { if (!silencioso) aviso('Esta licitação já está no quadro "' + q.nome + '".'); return ja; }
    const et = function (n) { const x = q.etiquetas.find(function (y) { return y.nome === n; }); return x ? [x.id] : []; };
    const c = criarCartao(q, (q.listas.find(function (l) { return l.nome === 'Oportunidade'; }) || q.listas[0]).id, {
      titulo: (a.modalidade || '') + ' ' + (a.numero || '') + ' · ' + (a.municipio || '') + '-' + (a.uf || '') + ' · ' + String(a.objeto || '').slice(0, 90),
      descricao: a.objeto + '\n\n**Órgão:** ' + a.orgao + '\n**Edital:** ' + a.edital, avisoId: a.id, empresaId: Dados.e.empresaAtiva,
      prazo: a.encerramento ? String(a.encerramento).slice(0, 16) : '', lembrete: '1440',
      etiquetas: [].concat(/preg/i.test(a.modalidade) ? et('Pregão') : [], /dispensa/i.test(a.modalidade) ? et('Dispensa') : [], a.srp ? et('SRP') : [], a.meEpp ? et('ME/EPP').concat(et('Vantagem competitiva')) : []),
      membros: [eu()],
      valores: { valor: a.valorEstimado, orgao: a.orgao, numero: a.numero, portal: /compras\.gov|comprasnet|serpro|cnetmobile/i.test((a.linkOrigem || '') + (a.sistema || '')) ? 'Compras.gov.br' : /bll/i.test(a.sistema) ? 'BLL' : /bnc/i.test(a.sistema) ? 'BNC' : '' }
    });
    salvar(); if (!silencioso) aviso('Cartão criado no quadro "' + q.nome + '".');
    return c;
  }
  // Cartão da proposta (cria se não existir, com os dados que já estão na proposta e no aviso).
  function cartaoDaProposta(p, silencioso) {
    const ja = Integracao.cartaoDaProposta(Dados.e, p); if (ja) return ja;
    const av = Dados.e.avisos[p.avisoId] || { id: p.avisoId || 'ppt:' + p.id, modalidade: p.modalidade, numero: p.numero, municipio: p.municipio, uf: p.uf, objeto: p.objeto || '', orgao: p.orgao || '', edital: p.edital || '', encerramento: p.encerramento, linkOrigem: p.linkOrigem, valorEstimado: Integracao.totalProposta(p) };
    const c = cartaoDeAviso(av, silencioso); c.propostaId = p.id; if (p.empresaId) c.empresaId = p.empresaId;
    const q = e().quadros.find(function (x) { return x.cartoes.indexOf(c) >= 0; });
    return { q: q, c: c };
  }
  // Resultado da licitação no cartão: ganha vai para "Contrato" com a Execução preparada; perdida é arquivada.
  function aplicarResultado(p, r) {
    const x = cartaoDaProposta(p, true); const q = x.q, c = x.c; if (!q || c.resultadoAplicado === r) return x;
    const et = q.etiquetas.find(function (y) { return y.nome === (r === 'ganha' ? 'Ganha' : 'Perdida'); });
    if (et && (c.etiquetas || []).indexOf(et.id) < 0) c.etiquetas = (c.etiquetas || []).concat(et.id);
    c.resultadoAplicado = r;
    if (r === 'ganha') {
      const total = p.lanceFinal || Integracao.totalVencido(p);
      c.execucao = c.execucao || { numero: '', valor: total, empenhos: [], notas: [], pagamentos: [] }; if (!c.execucao.valor) c.execucao.valor = total;
      c.valores = Object.assign({}, c.valores, { valor: total });
      const l = q.listas.find(function (y) { return y.nome === 'Contrato'; }); if (l && c.lista !== l.id) moverCartao(q, c, l.id);
      registrar(q, c, 'licitação ganha: cartão preparado para o contrato');
    } else { c.arquivado = true; registrar(q, c, r === 'fracassada' ? 'licitação fracassada' : 'licitação não vencida'); }
    return x;
  }

  function pendencias() {
    const out = [];
    e().quadros.filter(function (q) { return !q.arquivado; }).forEach(function (q) {
      q.cartoes.filter(function (c) { return !c.arquivado && !c.concluido; }).forEach(function (c) {
        if (c.prazo) { const ms = new Date(c.prazo) - Date.now(); const lemb = (Number(c.lembrete) || 0) * 60000; if (ms < 0 || (lemb && ms < lemb) || ms < 2 * DIA) out.push({ quadro: q, cartao: c, quando: c.prazo, tipo: ms < 0 ? 'atrasado' : 'proximo', texto: c.titulo }); }
        (c.checklists || []).forEach(function (cl) { cl.itens.forEach(function (i) { if (!i.feito && i.prazo && new Date(i.prazo + 'T23:59') - Date.now() < DIA) out.push({ quadro: q, cartao: c, quando: i.prazo, tipo: new Date(i.prazo + 'T23:59') < Date.now() ? 'atrasado' : 'proximo', texto: i.texto + ' — ' + c.titulo }); }); });
        const x = c.execucao;
        if (x) { Execucao.normalizar(x); } if (x) (x.notas || []).forEach(function (n) { const pago = Execucao.pagoDaNota(x, n); if (n.vencimento && pago + 0.01 < n.valor && new Date(n.vencimento + 'T23:59') < Date.now()) out.push({ quadro: q, cartao: c, quando: n.vencimento, tipo: 'atrasado', texto: 'Pagamento da NF ' + n.numero + ' em atraso (' + moeda(n.valor - pago) + ') — ' + c.titulo }); });
      });
    });
    return out.sort(function (a, b) { return new Date(a.quando) - new Date(b.quando); });
  }

  setInterval(function () { if (varrerTudo() && App.rota().tela === 'quadros' && !document.getElementById('kov') && !document.querySelector('.modal-fundo')) App.redesenhar(); }, 60000);

  Telas.quadros = {
    titulo: 'Seven Processo',
    render: function (el, sub, param) {
      if (aberto && (!document.getElementById('kov'))) aberto = null;
      garantirQuadroPadrao();
      const q = sub && e().quadros.find(function (x) { return x.id === sub; });
      if (!q) { telaInicio(el); return; }
      if (q.arquivado) { el.innerHTML = UI.vazio('Quadro fechado', 'Reabra o quadro pela página de quadros.', '<a class="btn" href="#/quadros">Ver quadros</a>'); return; }
      const reabrir = aberto && aberto.q === q && document.getElementById('kov');
      telaQuadro(el, q, reabrir ? null : param);
      if (reabrir) { /* a janela do cartão continua aberta por cima */ }
    },
    cartaoDeAviso: cartaoDeAviso,
    cartaoDaProposta: cartaoDaProposta,
    aplicarResultado: aplicarResultado,
    pendencias: pendencias,
    todosCartoes: function () { const out = []; e().quadros.forEach(function (q) { q.cartoes.forEach(function (c) { out.push({ quadro: q, cartao: c }); }); }); return out; },
    achar: acharId,
    notificar: notificar
  };
})();
