/* Quadros: gestão das licitações em quadros, listas e cartões (estilo kanban), do edital ao pagamento. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, data, dataHora, campo, opcoes, modal, confirmar, aviso } = UI;

  const CORES = ['verde', 'amarelo', 'laranja', 'vermelho', 'roxo', 'azul', 'ciano', 'lima', 'rosa', 'cinza'];
  const LISTAS_PADRAO = ['Oportunidade', 'Análise do edital', 'Proposta', 'Disputa', 'Habilitação / Recurso', 'Contrato', 'Empenho', 'Entrega', 'Pagamento', 'Concluído'];
  // Checklist sugerido por etapa (aplicado pela automação padrão ao mover o cartão).
  const CHECK_ETAPA = {
    'Oportunidade': ['Conferir objeto e prazo', 'Verificar se o cliente atende', 'Decidir participar (go / no-go)'],
    'Análise do edital': ['Ler edital e termo de referência', 'Listar documentos de habilitação', 'Pedir esclarecimento / impugnar, se for o caso', 'Conferir garantia, amostra e visita técnica'],
    'Proposta': ['Formar preço (custo, impostos, frete, margem)', 'Aprovação do valor limite pelo cliente, por escrito', 'Cadastrar proposta no portal', 'Conferir status do envio'],
    'Disputa': ['Configurar robô / estratégia', 'Computador ligado e responsável na sessão', 'Play da disputa no dia'],
    'Habilitação / Recurso': ['Enviar proposta atualizada', 'Enviar documentos de habilitação', 'Acompanhar chat do pregoeiro', 'Intenção de recurso, se cabível'],
    'Contrato': ['Assinar ata / contrato', 'Registrar vigência e gestor do contrato', 'Garantia contratual, se exigida'],
    'Empenho': ['Receber nota de empenho', 'Conferir valor e itens do empenho'],
    'Entrega': ['Programar entrega', 'Emitir nota fiscal', 'Recolher atesto / recebimento'],
    'Pagamento': ['Acompanhar liquidação', 'Cobrar pagamento em atraso', 'Baixar pagamento']
  };
  const MEMBROS_PADRAO = ['Lucas Neves'];

  let quadroAtual = null; let filtro = { texto: '', etiqueta: '', membro: '', prazo: '' }; let visao = 'quadro';

  function e() { const d = Dados.e; d.quadros = d.quadros || []; d.membros = d.membros || MEMBROS_PADRAO.slice(); return d; }

  function novoQuadro(nome, modelo) {
    const q = {
      id: Dados.id('qd'), nome: nome, cor: 'verde', criadoEm: new Date().toISOString(), arquivado: false,
      listas: (modelo === 'licitacoes' ? LISTAS_PADRAO : ['A fazer', 'Fazendo', 'Feito']).map(function (n) { return { id: Dados.id('ls'), nome: n, arquivada: false }; }),
      cartoes: [],
      etiquetas: modelo === 'licitacoes'
        ? [{ id: Dados.id('et'), nome: 'Pregão', cor: 'azul' }, { id: Dados.id('et'), nome: 'Dispensa', cor: 'ciano' }, { id: Dados.id('et'), nome: 'Urgente', cor: 'vermelho' }, { id: Dados.id('et'), nome: 'ME/EPP', cor: 'amarelo' }, { id: Dados.id('et'), nome: 'SRP', cor: 'roxo' }, { id: Dados.id('et'), nome: 'Ganha', cor: 'verde' }, { id: Dados.id('et'), nome: 'Perdida', cor: 'cinza' }]
        : CORES.slice(0, 6).map(function (c) { return { id: Dados.id('et'), nome: '', cor: c }; }),
      campos: modelo === 'licitacoes'
        ? [{ id: 'valor', nome: 'Valor estimado', tipo: 'moeda' }, { id: 'orgao', nome: 'Órgão', tipo: 'texto' }, { id: 'numero', nome: 'Nº do processo', tipo: 'texto' }, { id: 'portal', nome: 'Portal', tipo: 'lista', opcoes: ['Compras.gov.br', 'BLL', 'BNC', 'Licitanet', 'Compras Públicas', 'SISLOG-GO', 'Licitações-e', 'Outro'] }]
        : [],
      automacoes: modelo === 'licitacoes' ? [{ id: Dados.id('au'), quando: 'mover', lista: '*', acao: 'checklist-etapa', ativo: true }, { id: Dados.id('au'), quando: 'mover', lista: 'Concluído', acao: 'marcar-concluido', ativo: true }] : [],
      atividade: []
    };
    e().quadros.push(q);
    return q;
  }

  function garantirQuadroPadrao() {
    if (!e().quadros.length) { novoQuadro('Licitações', 'licitacoes'); Dados.salvar(); }
  }

  function lista(q, id) { return q.listas.find(function (l) { return l.id === id; }); }
  function cartao(q, id) { return q.cartoes.find(function (c) { return c.id === id; }); }
  function registrar(q, c, texto) {
    const a = { em: new Date().toISOString(), por: e().config.responsavel || 'Equipe', texto: texto };
    if (c) { c.atividade = c.atividade || []; c.atividade.unshift(a); }
    q.atividade.unshift(Object.assign({ cartao: c && c.titulo }, a)); q.atividade = q.atividade.slice(0, 300);
  }

  function statusPrazo(c) {
    if (!c.prazo) return null;
    if (c.concluido) return { cls: 'feito', t: 'Concluído' };
    const ms = new Date(c.prazo) - Date.now();
    if (ms < 0) return { cls: 'atrasado', t: 'Atrasado' };
    if (ms < 86400000) return { cls: 'logo', t: 'Vence em breve' };
    return { cls: '', t: '' };
  }

  function progressoChecklists(c) {
    let t = 0, f = 0; (c.checklists || []).forEach(function (cl) { cl.itens.forEach(function (i) { t++; if (i.feito) f++; }); });
    return { t: t, f: f };
  }

  function passaFiltro(q, c) {
    if (c.arquivado) return false;
    if (filtro.texto && !Nucleo.contemTermo(Nucleo.normalizar(c.titulo + ' ' + (c.descricao || '') + ' ' + JSON.stringify(c.valores || {})), Nucleo.normalizar(filtro.texto))) return false;
    if (filtro.etiqueta && (c.etiquetas || []).indexOf(filtro.etiqueta) < 0) return false;
    if (filtro.membro && (c.membros || []).indexOf(filtro.membro) < 0) return false;
    if (filtro.prazo) {
      const s = statusPrazo(c);
      if (filtro.prazo === 'sem' && c.prazo) return false;
      if (filtro.prazo === 'atrasado' && !(s && s.cls === 'atrasado')) return false;
      if (filtro.prazo === 'semana' && !(c.prazo && !c.concluido && new Date(c.prazo) - Date.now() < 7 * 86400000 && new Date(c.prazo) > Date.now())) return false;
      if (filtro.prazo === 'concluido' && !c.concluido) return false;
    }
    return true;
  }

  // ---------- desenho ----------
  function miniCartao(q, c) {
    const s = statusPrazo(c); const p = progressoChecklists(c);
    const ets = (c.etiquetas || []).map(function (id) { return q.etiquetas.find(function (x) { return x.id === id; }); }).filter(Boolean);
    const valor = c.valores && c.valores.valor;
    return '<article class="kcartao" draggable="true" data-cartao="' + c.id + '" tabindex="0" aria-label="' + esc(c.titulo) + '">' +
      (c.capa ? '<div class="kcapa cor-' + c.capa + '"></div>' : '') +
      (ets.length ? '<div class="ketiquetas">' + ets.map(function (x) { return '<span class="ket cor-' + x.cor + '" title="' + esc(x.nome) + '">' + esc(x.nome) + '</span>'; }).join('') + '</div>' : '') +
      '<p class="ktitulo">' + esc(c.titulo) + '</p>' +
      '<div class="kmeta">' +
      (c.prazo ? '<span class="kprazo ' + (s ? s.cls : '') + '" title="' + esc(s ? s.t : '') + '">◷ ' + UI.dataHora(c.prazo) + '</span>' : '') +
      (valor ? '<span>' + moeda(valor) + '</span>' : '') +
      (c.descricao ? '<span title="Tem descrição">≡</span>' : '') +
      ((c.comentarios || []).length ? '<span title="Comentários">💬 ' + c.comentarios.length + '</span>' : '') +
      ((c.anexos || []).length ? '<span title="Anexos">📎 ' + c.anexos.length + '</span>' : '') +
      (p.t ? '<span class="' + (p.f === p.t ? 'kcheck-ok' : '') + '" title="Checklist">☑ ' + p.f + '/' + p.t + '</span>' : '') +
      ((c.membros || []).length ? '<span class="kmembros">' + c.membros.map(function (m) { return '<i title="' + esc(m) + '">' + esc(iniciais(m)) + '</i>'; }).join('') + '</span>' : '') +
      '</div></article>';
  }

  function iniciais(n) { return String(n).split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p[0].toUpperCase(); }).join(''); }

  function desenharQuadro(el, q) {
    const listas = q.listas.filter(function (l) { return !l.arquivada; });
    el.innerHTML = cabecalho(q) +
      (visao === 'quadro' ? '<div class="kquadro" id="kquadro">' + listas.map(function (l) {
        const cs = q.cartoes.filter(function (c) { return c.lista === l.id && passaFiltro(q, c); }).sort(function (a, b) { return a.ordem - b.ordem; });
        const valor = cs.reduce(function (s, c) { return s + (Number(c.valores && c.valores.valor) || 0); }, 0);
        return '<section class="klista" data-lista="' + l.id + '"><header draggable="true" data-arrasta-lista="' + l.id + '"><h3 contenteditable="true" spellcheck="false" data-renomear="' + l.id + '">' + esc(l.nome) + '</h3><span class="mudo">' + cs.length + (valor ? ' · ' + moeda(valor) : '') + '</span><button class="icone" data-a="menu-lista" aria-label="Ações da lista">⋯</button></header>' +
          '<div class="kcartoes" data-soltar="' + l.id + '">' + cs.map(function (c) { return miniCartao(q, c); }).join('') + '</div>' +
          '<button class="kadicionar" data-a="novo-cartao" data-lista="' + l.id + '">+ Adicionar cartão</button></section>';
      }).join('') + '<section class="klista nova"><button class="kadicionar" data-a="nova-lista">+ Adicionar lista</button></section></div>'
        : visao === 'calendario' ? calendario(q) : visao === 'tabela' ? tabela(q) : painelQuadro(q));
    ligarArrastar(el, q);
  }

  function cabecalho(q) {
    const ativos = e().quadros.filter(function (x) { return !x.arquivado; });
    return '<div class="kcabecalho"><select id="trocar-quadro" aria-label="Quadro">' + opcoes(ativos.map(function (x) { return { v: x.id, t: (x.favorito ? '★ ' : '') + x.nome }; }), q.id) + '</select>' +
      '<button class="icone estrela ' + (q.favorito ? 'on' : '') + '" data-a="fav-quadro" aria-label="Favoritar quadro">★</button>' +
      '<nav class="kvisoes">' + [['quadro', 'Quadro'], ['tabela', 'Tabela'], ['calendario', 'Calendário'], ['painel', 'Painel']].map(function (v) { return '<button class="' + (visao === v[0] ? 'ativa' : '') + '" data-visao="' + v[0] + '">' + v[1] + '</button>'; }).join('') + '</nav>' +
      '<form class="kfiltros" id="kfiltros"><input type="search" name="texto" placeholder="Buscar cartões…" value="' + esc(filtro.texto) + '">' +
      '<select name="etiqueta"><option value="">Etiqueta</option>' + opcoes(q.etiquetas.map(function (x) { return { v: x.id, t: x.nome || x.cor }; }), filtro.etiqueta) + '</select>' +
      '<select name="membro"><option value="">Membro</option>' + opcoes(e().membros, filtro.membro) + '</select>' +
      '<select name="prazo"><option value="">Prazo</option>' + opcoes([{ v: 'atrasado', t: 'Atrasados' }, { v: 'semana', t: 'Próximos 7 dias' }, { v: 'sem', t: 'Sem prazo' }, { v: 'concluido', t: 'Concluídos' }], filtro.prazo) + '</select></form>' +
      '<div class="grupo-botoes"><button class="btn" data-a="novo-quadro">+ Quadro</button><button class="btn fantasma" data-a="menu-quadro">⋯ Menu</button></div></div>';
  }

  function tabela(q) {
    const cs = q.cartoes.filter(function (c) { return passaFiltro(q, c); });
    return '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Cartão</th><th>Lista</th><th>Etiquetas</th><th>Membros</th><th>Prazo</th><th class="n">Checklist</th>' + q.campos.map(function (f) { return '<th>' + esc(f.nome) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      cs.map(function (c) {
        const p = progressoChecklists(c); const s = statusPrazo(c);
        return '<tr data-cartao="' + c.id + '" class="clicavel"><td><b>' + esc(c.titulo) + '</b></td><td>' + esc((lista(q, c.lista) || {}).nome) + '</td><td>' + (c.etiquetas || []).map(function (id) { const x = q.etiquetas.find(function (y) { return y.id === id; }); return x ? '<span class="ket cor-' + x.cor + '">' + esc(x.nome) + '</span>' : ''; }).join(' ') + '</td><td>' + esc((c.membros || []).join(', ')) + '</td><td class="' + (s ? s.cls : '') + '">' + (c.prazo ? dataHora(c.prazo) : '—') + '</td><td class="n">' + (p.t ? p.f + '/' + p.t : '—') + '</td>' +
          q.campos.map(function (f) { const v = (c.valores || {})[f.id]; return '<td>' + (f.tipo === 'moeda' ? moeda(v) : f.tipo === 'data' ? data(v) : f.tipo === 'check' ? (v ? '✓' : '') : esc(v || '')) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  let mesCal = null;
  function calendario(q) {
    const hoje = new Date(); mesCal = mesCal || new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ini = new Date(mesCal); ini.setDate(1 - ((ini.getDay() + 6) % 7));
    const cs = q.cartoes.filter(function (c) { return c.prazo && passaFiltro(q, c); });
    let html = '<div class="kcal-topo"><button class="btn fantasma" data-cal="-1">‹</button><h3>' + mesCal.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) + '</h3><button class="btn fantasma" data-cal="1">›</button></div><div class="kcal"><b>seg</b><b>ter</b><b>qua</b><b>qui</b><b>sex</b><b>sáb</b><b>dom</b>';
    for (let i = 0; i < 42; i++) {
      const d = new Date(ini); d.setDate(ini.getDate() + i);
      const doDia = cs.filter(function (c) { const p = new Date(c.prazo); return p.toDateString() === d.toDateString(); });
      html += '<div class="kdia ' + (d.getMonth() !== mesCal.getMonth() ? 'fora' : '') + (d.toDateString() === hoje.toDateString() ? ' hoje' : '') + '" data-dia="' + Nucleo.yyyymmdd(d) + '"><span>' + d.getDate() + '</span>' +
        doDia.map(function (c) { const s = statusPrazo(c); return '<a class="kcal-item ' + (s ? s.cls : '') + '" data-cartao="' + c.id + '">' + esc(c.titulo) + '</a>'; }).join('') + '</div>';
    }
    return html + '</div>';
  }

  function painelQuadro(q) {
    const cs = q.cartoes.filter(function (c) { return !c.arquivado; });
    const porLista = q.listas.filter(function (l) { return !l.arquivada; }).map(function (l) { return { t: l.nome.split(' ')[0], v: cs.filter(function (c) { return c.lista === l.id; }).length }; });
    const atras = cs.filter(function (c) { const s = statusPrazo(c); return s && s.cls === 'atrasado'; }).length;
    const porMembro = e().membros.map(function (m) { return { t: iniciais(m), v: cs.filter(function (c) { return (c.membros || []).indexOf(m) >= 0; }).length }; });
    const valor = cs.reduce(function (s, c) { return s + (Number(c.valores && c.valores.valor) || 0); }, 0);
    return '<div class="kpis"><div><b>' + cs.length + '</b><span>cartões</span></div><div><b class="' + (atras ? 'alerta' : '') + '">' + atras + '</b><span>atrasados</span></div><div><b>' + moeda(valor) + '</b><span>valor no funil</span></div><div><b>' + cs.filter(function (c) { return c.concluido; }).length + '</b><span>concluídos</span></div></div>' +
      '<div class="cartoes"><section class="cartao"><h3>Cartões por lista</h3>' + UI.barras(porLista, { rotulo: 'Cartões por lista' }) + '</section><section class="cartao"><h3>Cartões por membro</h3>' + UI.barras(porMembro, { rotulo: 'Cartões por membro' }) + '</section></div>' +
      '<section class="cartao"><h3>Atividade recente</h3><ul class="lista-notas">' + q.atividade.slice(0, 25).map(function (a) { return '<li><b>' + esc(a.por) + '</b> ' + esc(a.texto) + (a.cartao ? ' — <i>' + esc(a.cartao) + '</i>' : '') + ' <span class="mudo">' + dataHora(a.em) + '</span></li>'; }).join('') + '</ul></section>';
  }

  // ---------- arrastar e soltar ----------
  function ligarArrastar(el, q) {
    let arrastando = null; let arrastandoLista = null;
    el.querySelectorAll('.kcartao').forEach(function (k) {
      k.addEventListener('dragstart', function (ev) { arrastando = k.dataset.cartao; k.classList.add('arrastando'); ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', arrastando); ev.stopPropagation(); });
      k.addEventListener('dragend', function () { k.classList.remove('arrastando'); });
    });
    el.querySelectorAll('[data-arrasta-lista]').forEach(function (h) {
      h.addEventListener('dragstart', function (ev) { if (arrastando) return; arrastandoLista = h.dataset.arrastaLista; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', 'lista'); });
    });
    el.querySelectorAll('.kcartoes').forEach(function (zona) {
      zona.addEventListener('dragover', function (ev) {
        if (!arrastando) return; ev.preventDefault();
        zona.classList.add('sobre');
        const depois = elementoDepois(zona, ev.clientY);
        const arr = el.querySelector('.kcartao.arrastando');
        if (arr) { if (depois) zona.insertBefore(arr, depois); else zona.appendChild(arr); }
      });
      zona.addEventListener('dragleave', function () { zona.classList.remove('sobre'); });
      zona.addEventListener('drop', function (ev) {
        if (!arrastando) return; ev.preventDefault(); zona.classList.remove('sobre');
        const ids = Array.prototype.map.call(zona.querySelectorAll('.kcartao'), function (k) { return k.dataset.cartao; });
        moverCartao(q, arrastando, zona.dataset.soltar, ids); arrastando = null;
      });
    });
    const kq = el.querySelector('#kquadro');
    if (kq) {
      kq.addEventListener('dragover', function (ev) { if (arrastandoLista) ev.preventDefault(); });
      kq.addEventListener('drop', function (ev) {
        if (!arrastandoLista) return; ev.preventDefault();
        const alvo = ev.target.closest('.klista[data-lista]');
        if (alvo && alvo.dataset.lista !== arrastandoLista) {
          const de = q.listas.findIndex(function (l) { return l.id === arrastandoLista; });
          const l = q.listas.splice(de, 1)[0];
          const para = q.listas.findIndex(function (x) { return x.id === alvo.dataset.lista; });
          q.listas.splice(para + (de <= para ? 1 : 0), 0, l);
          registrar(q, null, 'moveu a lista ' + l.nome); Dados.salvar();
        }
        arrastandoLista = null; App.redesenhar();
      });
    }
  }

  function elementoDepois(zona, y) {
    const els = Array.prototype.slice.call(zona.querySelectorAll('.kcartao:not(.arrastando)'));
    let melhor = null; let dist = -Infinity;
    els.forEach(function (k) { const r = k.getBoundingClientRect(); const o = y - r.top - r.height / 2; if (o < 0 && o > dist) { dist = o; melhor = k; } });
    return melhor;
  }

  function moverCartao(q, idCartao, idLista, ordemIds) {
    const c = cartao(q, idCartao); if (!c) return;
    const mudouLista = c.lista !== idLista;
    const de = lista(q, c.lista);
    c.lista = idLista;
    (ordemIds || []).forEach(function (id, i) { const x = cartao(q, id); if (x) x.ordem = i; });
    if (mudouLista) { registrar(q, c, 'moveu de "' + (de ? de.nome : '?') + '" para "' + lista(q, idLista).nome + '"'); automacoes(q, c, 'mover'); }
    Dados.salvar(); App.redesenhar();
  }

  // ---------- automações (regras simples, no estilo "quando… então…") ----------
  const ACOES = {
    'checklist-etapa': 'adicionar o checklist padrão da etapa',
    'marcar-concluido': 'marcar o cartão como concluído',
    'etiqueta': 'adicionar a etiqueta',
    'membro': 'atribuir o membro',
    'prazo': 'definir prazo em N dias',
    'arquivar': 'arquivar o cartão'
  };
  function automacoes(q, c, evento) {
    const l = lista(q, c.lista);
    (q.automacoes || []).filter(function (a) { return a.ativo !== false && a.quando === evento && (a.lista === '*' || a.lista === l.nome || a.lista === l.id); }).forEach(function (a) {
      if (a.acao === 'checklist-etapa' && CHECK_ETAPA[l.nome]) {
        c.checklists = c.checklists || [];
        if (!c.checklists.some(function (cl) { return cl.titulo === l.nome; })) c.checklists.push({ id: Dados.id('cl'), titulo: l.nome, itens: CHECK_ETAPA[l.nome].map(function (t) { return { id: Dados.id('ci'), texto: t, feito: false }; }) });
      }
      if (a.acao === 'marcar-concluido') c.concluido = true;
      if (a.acao === 'etiqueta' && a.valor && (c.etiquetas || []).indexOf(a.valor) < 0) { c.etiquetas = (c.etiquetas || []).concat(a.valor); }
      if (a.acao === 'membro' && a.valor && (c.membros || []).indexOf(a.valor) < 0) { c.membros = (c.membros || []).concat(a.valor); }
      if (a.acao === 'prazo' && a.valor) { c.prazo = new Date(Date.now() + Number(a.valor) * 86400000).toISOString().slice(0, 16); c.concluido = false; }
      if (a.acao === 'arquivar') c.arquivado = true;
      registrar(q, c, 'automação: ' + ACOES[a.acao]);
    });
  }

  // ---------- cartão (detalhe) ----------
  async function abrirCartao(q, c) {
    const corpo = function () {
      const ets = q.etiquetas; const p = progressoChecklists(c);
      return '<div class="kdetalhe">' +
        '<div class="kprincipal">' +
        campo('Título', '<input name="titulo" value="' + esc(c.titulo) + '" required>') +
        '<p class="mini">Na lista <b>' + esc((lista(q, c.lista) || {}).nome) + '</b>' + (c.avisoId ? ' · <a href="' + esc((Dados.e.avisos[c.avisoId] || {}).edital || '#') + '" target="_blank" rel="noopener">edital no PNCP ↗</a>' : '') + '</p>' +
        '<fieldset><legend>Etiquetas</legend><div class="grade-checks">' + ets.map(function (x) { return '<label class="ket-check"><input type="checkbox" name="etiqueta" value="' + x.id + '"' + ((c.etiquetas || []).indexOf(x.id) >= 0 ? ' checked' : '') + '><span class="ket cor-' + x.cor + '">' + esc(x.nome || ' ') + '</span></label>'; }).join('') + '</div></fieldset>' +
        '<fieldset><legend>Membros</legend><div class="grade-checks">' + e().membros.map(function (m) { return '<label><input type="checkbox" name="membro" value="' + esc(m) + '"' + ((c.membros || []).indexOf(m) >= 0 ? ' checked' : '') + '> ' + esc(m) + '</label>'; }).join('') + '</div></fieldset>' +
        '<div class="linha">' + campo('Início', '<input type="datetime-local" name="inicio" value="' + esc(c.inicio || '') + '">') + campo('Prazo', '<input type="datetime-local" name="prazo" value="' + esc(c.prazo || '') + '">') +
        campo('Lembrete', '<select name="lembrete">' + opcoes([{ v: '', t: 'Nenhum' }, { v: '60', t: '1 hora antes' }, { v: '1440', t: '1 dia antes' }, { v: '2880', t: '2 dias antes' }], c.lembrete || '') + '</select>') + '</div>' +
        '<label class="check"><input type="checkbox" name="concluido"' + (c.concluido ? ' checked' : '') + '> Concluído</label>' +
        campo('Descrição', '<textarea name="descricao" rows="4" placeholder="Detalhes, links, combinados…">' + esc(c.descricao || '') + '</textarea>') +
        (q.campos.length ? '<fieldset><legend>Campos personalizados</legend><div class="linha">' + q.campos.map(function (f) {
          const v = (c.valores || {})[f.id];
          const inp = f.tipo === 'lista' ? '<select name="cf_' + f.id + '"><option value=""></option>' + opcoes(f.opcoes || [], v) + '</select>'
            : f.tipo === 'check' ? '<input type="checkbox" name="cf_' + f.id + '"' + (v ? ' checked' : '') + '>'
              : '<input name="cf_' + f.id + '" ' + (f.tipo === 'data' ? 'type="date"' : f.tipo === 'moeda' || f.tipo === 'numero' ? 'inputmode="decimal"' : '') + ' value="' + esc(f.tipo === 'moeda' && v != null ? String(v).replace('.', ',') : v || '') + '">';
          return campo(f.nome, inp);
        }).join('') + '</div></fieldset>' : '') +
        '<section><h4>Checklists ' + (p.t ? '<small>' + p.f + '/' + p.t + '</small>' : '') + '</h4><div class="barra"><i style="width:' + (p.t ? Math.round(p.f / p.t * 100) : 0) + '%"></i></div>' +
        (c.checklists || []).map(function (cl) {
          return '<div class="kchecklist" data-cl="' + cl.id + '"><header><b>' + esc(cl.titulo) + '</b><button type="button" class="btn mini fantasma" data-k="ocultar-feitos">' + (cl.ocultarFeitos ? 'Mostrar feitos' : 'Ocultar feitos') + '</button><button type="button" class="btn mini fantasma perigo" data-k="del-cl">Excluir</button></header>' +
            cl.itens.filter(function (i) { return !(cl.ocultarFeitos && i.feito); }).map(function (i) { return '<label class="kitem"><input type="checkbox" data-k="item" data-item="' + i.id + '"' + (i.feito ? ' checked' : '') + '> <span class="' + (i.feito ? 'riscado' : '') + '">' + esc(i.texto) + '</span>' + (i.membro ? ' <i class="mudo">@' + esc(i.membro) + '</i>' : '') + (i.prazo ? ' <i class="mudo">até ' + data(i.prazo) + '</i>' : '') + '<button type="button" class="icone" data-k="del-item" data-item="' + i.id + '" aria-label="Excluir item">×</button></label>'; }).join('') +
            '<div class="kitem-novo"><input placeholder="Adicionar item…" data-novo-item="' + cl.id + '"><button type="button" class="btn mini" data-k="add-item">+</button></div></div>';
        }).join('') + '<button type="button" class="btn mini" data-k="add-cl">+ Checklist</button></section>' +
        '<section><h4>Execução (contrato, empenho, pagamento)</h4>' + execucaoResumo(c) + '<button type="button" class="btn mini" data-k="execucao">Editar execução</button></section>' +
        '<section><h4>Anexos</h4><ul class="lista-links">' + (c.anexos || []).map(function (a) { return '<li><a href="#" data-k="abrir-anexo" data-anexo="' + a.id + '">' + esc(a.nome) + '</a> <span class="mudo">' + UI.num(a.tamanho / 1024, 0) + ' KB · ' + dataHora(a.em) + '</span> <button type="button" class="icone" data-k="del-anexo" data-anexo="' + a.id + '" aria-label="Remover anexo">×</button></li>'; }).join('') + '</ul><button type="button" class="btn mini" data-k="add-anexo">+ Anexar arquivo</button> <button type="button" class="btn mini fantasma" data-k="add-link">+ Link</button></section>' +
        '<section><h4>Comentários e atividade</h4><div class="kitem-novo"><textarea rows="2" placeholder="Escreva um comentário… use @nome para mencionar" data-novo-comentario></textarea><button type="button" class="btn mini" data-k="comentar">Salvar</button></div><ul class="lista-notas">' +
        (c.comentarios || []).map(function (m) { return '<li><b>' + esc(m.por) + '</b> <span class="mudo">' + dataHora(m.em) + '</span><br>' + esc(m.texto).replace(/@([\wÀ-ú]+)/g, '<mark>@$1</mark>') + '</li>'; }).join('') +
        (c.atividade || []).slice(0, 15).map(function (a) { return '<li class="mudo">' + esc(a.por) + ' ' + esc(a.texto) + ' · ' + dataHora(a.em) + '</li>'; }).join('') + '</ul></section>' +
        '</div><aside class="klateral"><h4>Ações</h4>' +
        '<label class="campo"><span>Capa</span><select name="capa"><option value="">Sem capa</option>' + opcoes(CORES.map(function (x) { return { v: x, t: x }; }), c.capa) + '</select></label>' +
        '<button type="button" class="btn" data-k="mover">Mover</button><button type="button" class="btn" data-k="copiar">Copiar</button>' +
        '<button type="button" class="btn" data-k="modelo">' + (c.modelo ? 'Deixar de ser modelo' : 'Tornar modelo') + '</button>' +
        '<button type="button" class="btn" data-k="seguir">' + (c.seguindo ? 'Seguindo ✓' : 'Seguir') + '</button>' +
        '<button type="button" class="btn" data-k="peca">Gerar peça jurídica</button>' +
        '<button type="button" class="btn" data-k="arquivar">' + (c.arquivado ? 'Restaurar' : 'Arquivar') + '</button>' +
        (c.arquivado ? '<button type="button" class="btn perigo" data-k="excluir">Excluir de vez</button>' : '') +
        '<p class="mini mudo">Criado em ' + dataHora(c.criadoEm) + '</p></aside></div>';
    };
    let resolverAcoes;
    const p = modal({ titulo: c.titulo, largo: true, corpo: corpo(), botao: 'Salvar e fechar', aoAbrir: function (form) { resolverAcoes = form; } });
    const form = resolverAcoes;
    function salvarCampos() {
      const fd = new FormData(form);
      c.titulo = fd.get('titulo') || c.titulo; c.descricao = fd.get('descricao'); c.inicio = fd.get('inicio'); c.prazo = fd.get('prazo'); c.lembrete = fd.get('lembrete');
      const conc = !!fd.get('concluido'); if (conc !== !!c.concluido) registrar(q, c, conc ? 'concluiu o cartão' : 'reabriu o cartão'); c.concluido = conc;
      c.etiquetas = fd.getAll('etiqueta'); c.membros = fd.getAll('membro'); c.capa = fd.get('capa');
      c.valores = c.valores || {};
      q.campos.forEach(function (f) {
        const v = fd.get('cf_' + f.id);
        c.valores[f.id] = f.tipo === 'check' ? !!v : f.tipo === 'moeda' || f.tipo === 'numero' ? (v ? Nucleo.lerNumeroBR(v) : null) : v;
      });
    }
    function redesenharModal() { salvarCampos(); form.querySelector('.modal-corpo').innerHTML = corpo(); }
    form.addEventListener('click', async function (ev) {
      const b = ev.target.closest('[data-k]'); if (!b) return;
      const k = b.dataset.k; const clEl = b.closest('[data-cl]'); const cl = clEl && c.checklists.find(function (x) { return x.id === clEl.dataset.cl; });
      if (k === 'item') { const it = cl.itens.find(function (i) { return i.id === b.dataset.item; }); it.feito = b.checked; if (it.feito) registrar(q, c, 'concluiu "' + it.texto + '"'); redesenharModal(); return; }
      ev.preventDefault();
      if (k === 'add-cl') { const n = await pedir('Novo checklist', 'Título', 'Checklist', modeloChecklists()); if (n) { const base = CHECK_ETAPA[n] || []; c.checklists = (c.checklists || []).concat({ id: Dados.id('cl'), titulo: n, itens: base.map(function (t) { return { id: Dados.id('ci'), texto: t, feito: false }; }) }); } }
      if (k === 'del-cl') c.checklists = c.checklists.filter(function (x) { return x !== cl; });
      if (k === 'ocultar-feitos') cl.ocultarFeitos = !cl.ocultarFeitos;
      if (k === 'add-item') { const i = clEl.querySelector('[data-novo-item]'); addItem(cl, i.value); }
      if (k === 'del-item') cl.itens = cl.itens.filter(function (i) { return i.id !== b.dataset.item; });
      if (k === 'comentar') { const t = form.querySelector('[data-novo-comentario]').value.trim(); if (t) { c.comentarios = [{ texto: t, em: new Date().toISOString(), por: e().config.responsavel || 'Equipe' }].concat(c.comentarios || []); } }
      if (k === 'add-anexo') { const fs = await UI.escolherArquivo('', true); for (const f of fs || []) { const id = Dados.id('anx'); await Dados.guardarArquivo(id, f); c.anexos = (c.anexos || []).concat({ id: id, nome: f.name, tamanho: f.size, tipo: f.type, em: new Date().toISOString() }); registrar(q, c, 'anexou ' + f.name); } }
      if (k === 'add-link') { const u = await pedir('Anexar link', 'Endereço (https://…)', ''); if (u) c.links = (c.links || []).concat(u), c.descricao = (c.descricao || '') + '\n' + u; }
      if (k === 'abrir-anexo') { const a = c.anexos.find(function (x) { return x.id === b.dataset.anexo; }); const blob = await Dados.lerArquivo(a.id); if (blob) window.open(URL.createObjectURL(blob), '_blank'); else aviso('Arquivo não encontrado neste navegador.', 'erro'); return; }
      if (k === 'del-anexo') { await Dados.apagarArquivo(b.dataset.anexo); c.anexos = c.anexos.filter(function (x) { return x.id !== b.dataset.anexo; }); }
      if (k === 'execucao') { salvarCampos(); await editarExecucao(q, c); }
      if (k === 'peca') { salvarCampos(); Dados.salvar(); location.hash = '#/pecas/nova/' + encodeURIComponent(q.id + ':' + c.id); form.closest('.modal-fundo').remove(); return; }
      if (k === 'modelo') c.modelo = !c.modelo;
      if (k === 'seguir') c.seguindo = !c.seguindo;
      if (k === 'arquivar') { c.arquivado = !c.arquivado; registrar(q, c, c.arquivado ? 'arquivou' : 'restaurou'); }
      if (k === 'excluir' && await confirmar('Excluir cartão', 'Excluir de vez? Não dá para desfazer.', 'Excluir')) { q.cartoes = q.cartoes.filter(function (x) { return x !== c; }); Dados.salvar(); form.closest('.modal-fundo').remove(); App.redesenhar(); return; }
      if (k === 'mover' || k === 'copiar') { salvarCampos(); await moverCopiar(q, c, k === 'copiar'); }
      Dados.salvar(); redesenharModal();
    });
    form.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && ev.target.dataset.novoItem) { ev.preventDefault(); const cl = c.checklists.find(function (x) { return x.id === ev.target.dataset.novoItem; }); addItem(cl, ev.target.value); Dados.salvar(); redesenharModal(); form.querySelector('[data-novo-item="' + cl.id + '"]').focus(); }
    });
    const r = await p;
    if (r) { salvarCamposDe(r, q, c); registrar(q, c, 'atualizou o cartão'); }
    Dados.salvar(); App.redesenhar();
  }

  // O modal já foi removido quando o Promise resolve; aplica os valores do FormData final.
  function salvarCamposDe(fd, q, c) {
    c.titulo = fd.get('titulo') || c.titulo; c.descricao = fd.get('descricao'); c.inicio = fd.get('inicio'); c.prazo = fd.get('prazo'); c.lembrete = fd.get('lembrete');
    c.concluido = !!fd.get('concluido'); c.etiquetas = fd.getAll('etiqueta'); c.membros = fd.getAll('membro'); c.capa = fd.get('capa');
    c.valores = c.valores || {};
    q.campos.forEach(function (f) { const v = fd.get('cf_' + f.id); c.valores[f.id] = f.tipo === 'check' ? !!v : f.tipo === 'moeda' || f.tipo === 'numero' ? (v ? Nucleo.lerNumeroBR(v) : null) : v; });
  }

  function addItem(cl, texto) {
    texto = String(texto || '').trim(); if (!texto) return;
    // "@Nome" atribui e "!dd/mm" define prazo do item
    const m = texto.match(/@([\wÀ-ú]+(?:\s[\wÀ-ú]+)?)/); const pz = texto.match(/!(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
    let membro = ''; if (m) { const achado = e().membros.find(function (x) { return Nucleo.normalizar(x).indexOf(Nucleo.normalizar(m[1])) === 0; }); if (achado) { membro = achado; texto = texto.replace(m[0], '').trim(); } }
    let prazo = ''; if (pz) { prazo = (pz[3] || new Date().getFullYear()) + '-' + pz[2].padStart(2, '0') + '-' + pz[1].padStart(2, '0'); texto = texto.replace(pz[0], '').trim(); }
    cl.itens.push({ id: Dados.id('ci'), texto: texto, feito: false, membro: membro, prazo: prazo });
  }

  function modeloChecklists() { return Object.keys(CHECK_ETAPA); }

  async function pedir(titulo, rotulo, valor, sugestoes) {
    const f = await modal({ titulo: titulo, corpo: campo(rotulo, '<input name="v" value="' + esc(valor || '') + '" list="sug-pedir">' + (sugestoes ? '<datalist id="sug-pedir">' + sugestoes.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist>' : ''), sugestoes ? 'Escolha um modelo de etapa para já vir com os itens.' : '') });
    return f ? String(f.get('v') || '').trim() : null;
  }

  async function moverCopiar(q, c, copiar) {
    const qs = e().quadros.filter(function (x) { return !x.arquivado; });
    const f = await modal({
      titulo: copiar ? 'Copiar cartão' : 'Mover cartão',
      corpo: campo('Quadro', '<select name="quadro" id="mc-quadro">' + opcoes(qs.map(function (x) { return { v: x.id, t: x.nome }; }), q.id) + '</select>') + campo('Lista', '<select name="lista" id="mc-lista"></select>') +
        (copiar ? campo('Título', '<input name="titulo" value="' + esc(c.titulo) + '">') + '<label class="check"><input type="checkbox" name="manter" checked> Manter checklists, etiquetas e campos</label>' : ''),
      aoAbrir: function (form) {
        const sq = form.querySelector('#mc-quadro'); const sl = form.querySelector('#mc-lista');
        const preencher = function () { const qq = qs.find(function (x) { return x.id === sq.value; }); sl.innerHTML = opcoes(qq.listas.filter(function (l) { return !l.arquivada; }).map(function (l) { return { v: l.id, t: l.nome }; }), c.lista); };
        sq.onchange = preencher; preencher();
      }
    });
    if (!f) return;
    const destino = qs.find(function (x) { return x.id === f.get('quadro'); });
    if (copiar) {
      const novo = JSON.parse(JSON.stringify(c)); novo.id = Dados.id('ct'); novo.titulo = f.get('titulo') || c.titulo; novo.lista = f.get('lista'); novo.ordem = 9999; novo.criadoEm = new Date().toISOString(); novo.comentarios = []; novo.atividade = []; novo.modelo = false; novo.anexos = [];
      if (!f.get('manter')) { novo.checklists = []; novo.etiquetas = []; novo.valores = {}; }
      if (destino !== q) novo.etiquetas = [];
      destino.cartoes.push(novo); registrar(destino, novo, 'copiou de "' + c.titulo + '"');
    } else {
      if (destino !== q) { q.cartoes = q.cartoes.filter(function (x) { return x !== c; }); c.etiquetas = []; destino.cartoes.push(c); }
      c.lista = f.get('lista'); c.ordem = 9999; registrar(destino, c, 'moveu para "' + lista(destino, c.lista).nome + '"'); automacoes(destino, c, 'mover');
    }
    Dados.salvar(); aviso(copiar ? 'Cartão copiado.' : 'Cartão movido.');
  }

  // ---------- execução: contrato, empenhos, entregas/NF, pagamentos ----------
  function execucaoResumo(c) {
    const x = c.execucao; if (!x) return '<p class="mudo mini">Sem dados de execução.</p>';
    const emp = (x.empenhos || []).reduce(function (s, i) { return s + (Number(i.valor) || 0); }, 0);
    const nf = (x.notas || []).reduce(function (s, i) { return s + (Number(i.valor) || 0); }, 0);
    const pg = (x.pagamentos || []).reduce(function (s, i) { return s + (Number(i.valor) || 0); }, 0);
    const vig = x.vigenciaFim ? Nucleo.diasEntre(new Date(), x.vigenciaFim + 'T12:00:00') : null;
    return '<dl class="numeros"><div><dt>Contrato</dt><dd>' + esc(x.numero || '—') + ' · ' + moeda(x.valor) + '</dd></div><div><dt>Vigência</dt><dd class="' + (vig != null && vig < 30 ? 'alerta' : '') + '">' + data(x.vigenciaFim) + (vig != null ? ' (' + vig + ' d)' : '') + '</dd></div>' +
      '<div><dt>Empenhado</dt><dd>' + moeda(emp) + '</dd></div><div><dt>Faturado (NF)</dt><dd>' + moeda(nf) + '</dd></div><div><dt>Recebido</dt><dd>' + moeda(pg) + '</dd></div><div><dt>A receber</dt><dd class="' + (nf - pg > 0.01 ? 'alerta' : '') + '">' + moeda(nf - pg) + '</dd></div><div><dt>Saldo do contrato</dt><dd>' + moeda((Number(x.valor) || 0) - emp) + '</dd></div></dl>';
  }

  async function editarExecucao(q, c) {
    const x = c.execucao = c.execucao || { empenhos: [], notas: [], pagamentos: [] };
    const linhas = function (nome, l, cols) {
      return '<fieldset><legend>' + nome + '</legend><table class="tabela compacta" data-tabela="' + nome + '"><thead><tr>' + cols.map(function (k) { return '<th>' + k[1] + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
        l.concat([{}]).map(function (it, i) { return '<tr>' + cols.map(function (k) { return '<td><input name="' + nome + '_' + k[0] + '_' + i + '" ' + (k[2] === 'data' ? 'type="date"' : k[2] === 'moeda' ? 'inputmode="decimal"' : '') + ' value="' + esc(it[k[0]] == null ? '' : k[2] === 'moeda' ? String(it[k[0]]).replace('.', ',') : it[k[0]]) + '"></td>'; }).join('') + '<td class="mudo mini">' + (i === l.length ? 'novo' : '') + '</td></tr>'; }).join('') + '</tbody></table></fieldset>';
    };
    const cols = { Empenhos: [['numero', 'Nº empenho'], ['data', 'Data', 'data'], ['valor', 'Valor', 'moeda']], Notas: [['numero', 'Nº NF'], ['data', 'Emissão', 'data'], ['atesto', 'Atesto', 'data'], ['vencimento', 'Vencimento', 'data'], ['valor', 'Valor', 'moeda']], Pagamentos: [['data', 'Data', 'data'], ['valor', 'Valor', 'moeda'], ['ref', 'Ref. NF']] };
    const f = await modal({
      titulo: 'Execução: ' + c.titulo, largo: true,
      corpo: '<div class="linha">' + campo('Nº contrato / ata', '<input name="numero" value="' + esc(x.numero || '') + '">') + campo('Valor do contrato', '<input name="valor" inputmode="decimal" value="' + esc(x.valor != null ? String(x.valor).replace('.', ',') : '') + '">') + campo('Assinatura', '<input type="date" name="assinatura" value="' + esc(x.assinatura || '') + '">') + campo('Fim da vigência', '<input type="date" name="vigenciaFim" value="' + esc(x.vigenciaFim || '') + '">') + '</div>' +
        '<div class="linha">' + campo('Gestor / fiscal do contrato', '<input name="gestor" value="' + esc(x.gestor || '') + '">') + campo('Prazo de pagamento (dias após atesto)', '<input name="prazoPagamento" inputmode="numeric" value="' + esc(x.prazoPagamento || '30') + '">') + '</div>' +
        linhas('Empenhos', x.empenhos, cols.Empenhos) + linhas('Notas', x.notas, cols.Notas) + linhas('Pagamentos', x.pagamentos, cols.Pagamentos) +
        '<p class="mini mudo">Linhas sem valor são descartadas. Para remover uma linha, apague o valor.</p>'
    });
    if (!f) return;
    x.numero = f.get('numero'); x.valor = f.get('valor') ? Nucleo.lerNumeroBR(f.get('valor')) : null; x.assinatura = f.get('assinatura'); x.vigenciaFim = f.get('vigenciaFim'); x.gestor = f.get('gestor'); x.prazoPagamento = Number(f.get('prazoPagamento')) || 30;
    Object.keys(cols).forEach(function (nome) {
      const chave = nome === 'Empenhos' ? 'empenhos' : nome === 'Notas' ? 'notas' : 'pagamentos';
      const out = [];
      for (let i = 0; i <= x[chave].length; i++) {
        const it = {}; cols[nome].forEach(function (k) { const v = f.get(nome + '_' + k[0] + '_' + i); it[k[0]] = k[2] === 'moeda' ? (v ? Nucleo.lerNumeroBR(v) : null) : v; });
        if (it.valor) out.push(it);
      }
      x[chave] = out;
    });
    // vencimento da NF = atesto + prazo, quando não informado
    x.notas.forEach(function (n) { if (!n.vencimento && n.atesto) { const d = new Date(n.atesto + 'T12:00:00'); d.setDate(d.getDate() + x.prazoPagamento); n.vencimento = d.toISOString().slice(0, 10); } });
    registrar(q, c, 'atualizou a execução do contrato');
  }

  // ---------- criação a partir de outras telas ----------
  function criarCartao(q, idLista, dados) {
    const l = lista(q, idLista) || q.listas[0];
    const c = Object.assign({ id: Dados.id('ct'), titulo: 'Novo cartão', lista: l.id, ordem: q.cartoes.filter(function (x) { return x.lista === l.id; }).length, etiquetas: [], membros: [], checklists: [], comentarios: [], anexos: [], valores: {}, criadoEm: new Date().toISOString() }, dados);
    q.cartoes.push(c); registrar(q, c, 'criou o cartão em "' + l.nome + '"'); automacoes(q, c, 'mover');
    return c;
  }

  function cartaoDeAviso(a) {
    garantirQuadroPadrao();
    const q = e().quadros.find(function (x) { return !x.arquivado && x.listas.some(function (l) { return l.nome === 'Oportunidade'; }); }) || e().quadros[0];
    const ja = q.cartoes.find(function (c) { return c.avisoId === a.id; });
    if (ja) { aviso('Esta licitação já está no quadro "' + q.nome + '".'); return ja; }
    const et = function (n) { const x = q.etiquetas.find(function (y) { return y.nome === n; }); return x ? [x.id] : []; };
    const c = criarCartao(q, (q.listas.find(function (l) { return l.nome === 'Oportunidade'; }) || q.listas[0]).id, {
      titulo: (a.modalidade || '') + ' ' + (a.numero || '') + ' · ' + (a.municipio || '') + '-' + (a.uf || '') + ' · ' + String(a.objeto || '').slice(0, 90),
      descricao: a.objeto + '\n\nÓrgão: ' + a.orgao + '\nEdital: ' + a.edital, avisoId: a.id, empresaId: Dados.e.empresaAtiva,
      prazo: a.encerramento ? String(a.encerramento).slice(0, 16) : '', lembrete: '1440',
      etiquetas: [].concat(/preg/i.test(a.modalidade) ? et('Pregão') : [], /dispensa/i.test(a.modalidade) ? et('Dispensa') : [], a.srp ? et('SRP') : [], a.meEpp ? et('ME/EPP') : []),
      membros: [e().config.responsavel || MEMBROS_PADRAO[0]].filter(function (m) { return e().membros.indexOf(m) >= 0; }),
      valores: { valor: a.valorEstimado, orgao: a.orgao, numero: a.numero, portal: /compras\.gov|comprasnet|serpro/i.test(a.linkOrigem + a.sistema) ? 'Compras.gov.br' : /bll/i.test(a.sistema) ? 'BLL' : /bnc/i.test(a.sistema) ? 'BNC' : '' }
    });
    Dados.salvar(); aviso('Cartão criado no quadro "' + q.nome + '".');
    return c;
  }

  // ---------- menus ----------
  async function menuQuadro(q) {
    const arqC = q.cartoes.filter(function (c) { return c.arquivado; });
    const arqL = q.listas.filter(function (l) { return l.arquivada; });
    const f = await modal({
      titulo: 'Menu do quadro', largo: true, botao: 'Salvar',
      corpo: '<div class="linha">' + campo('Nome do quadro', '<input name="nome" value="' + esc(q.nome) + '">') + campo('Cor', '<select name="cor">' + opcoes(CORES, q.cor) + '</select>') + '</div>' +
        '<fieldset><legend>Etiquetas</legend><table class="tabela compacta"><tbody>' + q.etiquetas.concat([{ id: '', nome: '', cor: 'cinza' }]).map(function (x, i) { return '<tr><td><input name="et_nome_' + i + '" value="' + esc(x.nome) + '" placeholder="' + (x.id ? '' : 'Nova etiqueta') + '"><input type="hidden" name="et_id_' + i + '" value="' + x.id + '"></td><td><select name="et_cor_' + i + '">' + opcoes(CORES, x.cor) + '</select></td><td>' + (x.id ? '<label class="check"><input type="checkbox" name="et_del_' + i + '"> excluir</label>' : '') + '</td></tr>'; }).join('') + '</tbody></table></fieldset>' +
        '<fieldset><legend>Membros da equipe</legend><textarea name="membros" rows="3">' + esc(e().membros.join('\n')) + '</textarea><small>Um por linha. Valem para todos os quadros.</small></fieldset>' +
        '<fieldset><legend>Campos personalizados</legend><table class="tabela compacta"><tbody>' + q.campos.concat([{ id: '', nome: '', tipo: 'texto' }]).map(function (x, i) { return '<tr><td><input name="cf_nome_' + i + '" value="' + esc(x.nome) + '" placeholder="' + (x.id ? '' : 'Novo campo') + '"><input type="hidden" name="cf_id_' + i + '" value="' + x.id + '"></td><td><select name="cf_tipo_' + i + '">' + opcoes([{ v: 'texto', t: 'Texto' }, { v: 'numero', t: 'Número' }, { v: 'moeda', t: 'Moeda' }, { v: 'data', t: 'Data' }, { v: 'check', t: 'Caixa de seleção' }, { v: 'lista', t: 'Lista suspensa' }], x.tipo) + '</select></td><td><input name="cf_op_' + i + '" value="' + esc((x.opcoes || []).join(', ')) + '" placeholder="opções (lista), separadas por vírgula"></td><td>' + (x.id ? '<label class="check"><input type="checkbox" name="cf_del_' + i + '"> excluir</label>' : '') + '</td></tr>'; }).join('') + '</tbody></table></fieldset>' +
        '<fieldset><legend>Automações</legend><table class="tabela compacta"><tbody>' + (q.automacoes || []).concat([{ id: '', quando: 'mover', lista: '', acao: '', ativo: true }]).map(function (a, i) {
          return '<tr><td>Quando um cartão entrar em</td><td><select name="au_lista_' + i + '"><option value="">—</option><option value="*"' + (a.lista === '*' ? ' selected' : '') + '>qualquer lista</option>' + opcoes(q.listas.map(function (l) { return l.nome; }), a.lista) + '</select></td><td>então</td><td><select name="au_acao_' + i + '"><option value="">—</option>' + opcoes(Object.keys(ACOES).map(function (k) { return { v: k, t: ACOES[k] }; }), a.acao) + '</select></td><td><input name="au_valor_' + i + '" value="' + esc(a.valor || '') + '" placeholder="etiqueta / membro / dias" list="au-valores"></td><td><input type="hidden" name="au_id_' + i + '" value="' + a.id + '"><label class="check"><input type="checkbox" name="au_ativo_' + i + '"' + (a.ativo !== false ? ' checked' : '') + '> ativa</label></td></tr>';
        }).join('') + '</tbody></table><datalist id="au-valores">' + q.etiquetas.map(function (x) { return '<option value="' + esc(x.nome) + '">'; }).join('') + e().membros.map(function (m) { return '<option value="' + esc(m) + '">'; }).join('') + '</datalist><small>Para "adicionar a etiqueta", escreva o nome da etiqueta; para "atribuir o membro", o nome; para "definir prazo", o número de dias.</small></fieldset>' +
        '<fieldset><legend>Itens arquivados</legend>' + (arqC.length || arqL.length ? '<ul class="lista-links">' + arqL.map(function (l) { return '<li>Lista: ' + esc(l.nome) + ' <label class="check"><input type="checkbox" name="rest_l" value="' + l.id + '"> restaurar</label></li>'; }).join('') + arqC.map(function (c) { return '<li>' + esc(c.titulo) + ' <label class="check"><input type="checkbox" name="rest_c" value="' + c.id + '"> restaurar</label></li>'; }).join('') + '</ul>' : '<p class="mudo">Nada arquivado.</p>') + '</fieldset>' +
        '<fieldset><legend>Quadro</legend><label class="check"><input type="checkbox" name="exportar"> Exportar cartões em CSV</label><label class="check"><input type="checkbox" name="arquivar_quadro"> Arquivar este quadro</label></fieldset>'
    });
    if (!f) return;
    q.nome = f.get('nome') || q.nome; q.cor = f.get('cor');
    const ets = [];
    for (let i = 0; i <= q.etiquetas.length; i++) {
      const id = f.get('et_id_' + i); const nome = f.get('et_nome_' + i); const cor = f.get('et_cor_' + i);
      if (f.get('et_del_' + i)) { q.cartoes.forEach(function (c) { c.etiquetas = (c.etiquetas || []).filter(function (x) { return x !== id; }); }); continue; }
      if (id) ets.push({ id: id, nome: nome, cor: cor }); else if (nome) ets.push({ id: Dados.id('et'), nome: nome, cor: cor });
    }
    q.etiquetas = ets;
    e().membros = String(f.get('membros') || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    const cfs = [];
    for (let i = 0; i <= q.campos.length; i++) {
      const id = f.get('cf_id_' + i); const nome = f.get('cf_nome_' + i);
      if (f.get('cf_del_' + i) || !nome) continue;
      cfs.push({ id: id || Dados.id('cf'), nome: nome, tipo: f.get('cf_tipo_' + i), opcoes: String(f.get('cf_op_' + i) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean) });
    }
    q.campos = cfs;
    const aus = [];
    for (let i = 0; i <= (q.automacoes || []).length; i++) {
      const l = f.get('au_lista_' + i); const ac = f.get('au_acao_' + i); if (!l || !ac) continue;
      let valor = f.get('au_valor_' + i);
      if (ac === 'etiqueta') { const x = q.etiquetas.find(function (y) { return y.nome === valor || y.id === valor; }); valor = x ? x.id : ''; }
      aus.push({ id: f.get('au_id_' + i) || Dados.id('au'), quando: 'mover', lista: l, acao: ac, valor: valor, ativo: !!f.get('au_ativo_' + i) });
    }
    q.automacoes = aus;
    f.getAll('rest_l').forEach(function (id) { lista(q, id).arquivada = false; });
    f.getAll('rest_c').forEach(function (id) { cartao(q, id).arquivado = false; });
    if (f.get('exportar')) exportarCSV(q);
    if (f.get('arquivar_quadro')) { q.arquivado = true; quadroAtual = null; }
    registrar(q, null, 'alterou as configurações do quadro');
  }

  function exportarCSV(q) {
    const cab = ['Cartão', 'Lista', 'Etiquetas', 'Membros', 'Prazo', 'Concluído', 'Checklist'].concat(q.campos.map(function (f) { return f.nome; })).concat(['Descrição']);
    const linhas = q.cartoes.filter(function (c) { return !c.arquivado; }).map(function (c) {
      const p = progressoChecklists(c);
      return [c.titulo, (lista(q, c.lista) || {}).nome, (c.etiquetas || []).map(function (id) { const x = q.etiquetas.find(function (y) { return y.id === id; }); return x ? x.nome : ''; }).join(', '), (c.membros || []).join(', '), c.prazo || '', c.concluido ? 'sim' : 'não', p.t ? p.f + '/' + p.t : ''].concat(q.campos.map(function (f) { return (c.valores || {})[f.id]; })).concat([c.descricao || '']);
    });
    UI.baixar('quadro-' + Nucleo.normalizar(q.nome).replace(/ /g, '-') + '.csv', '﻿' + Nucleo.paraCSV([cab].concat(linhas)), 'text/csv;charset=utf-8');
  }

  async function menuLista(q, l) {
    const f = await modal({
      titulo: 'Lista: ' + l.nome, botao: 'Aplicar',
      corpo: '<div class="opcoes-radio">' + [['ordenar-prazo', 'Ordenar por prazo'], ['ordenar-nome', 'Ordenar por nome'], ['ordenar-valor', 'Ordenar por valor'], ['mover-todos', 'Mover todos os cartões para outra lista'], ['arquivar-todos', 'Arquivar todos os cartões'], ['copiar', 'Copiar lista'], ['arquivar', 'Arquivar esta lista']].map(function (o, i) { return '<label><input type="radio" name="acao" value="' + o[0] + '"' + (i === 0 ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('') + '</div>' +
        campo('Lista de destino (para mover)', '<select name="destino">' + opcoes(q.listas.filter(function (x) { return x !== l && !x.arquivada; }).map(function (x) { return { v: x.id, t: x.nome }; })) + '</select>') +
        campo('Limite de cartões (WIP, 0 = sem limite)', '<input name="limite" inputmode="numeric" value="' + esc(l.limite || 0) + '">')
    });
    if (!f) return;
    l.limite = Number(f.get('limite')) || 0;
    const cs = q.cartoes.filter(function (c) { return c.lista === l.id && !c.arquivado; });
    const a = f.get('acao');
    const ord = function (fn) { cs.sort(fn).forEach(function (c, i) { c.ordem = i; }); };
    if (a === 'ordenar-prazo') ord(function (x, y) { return new Date(x.prazo || '2999') - new Date(y.prazo || '2999'); });
    if (a === 'ordenar-nome') ord(function (x, y) { return x.titulo.localeCompare(y.titulo, 'pt-BR'); });
    if (a === 'ordenar-valor') ord(function (x, y) { return ((y.valores || {}).valor || 0) - ((x.valores || {}).valor || 0); });
    if (a === 'mover-todos') cs.forEach(function (c) { c.lista = f.get('destino'); registrar(q, c, 'movido em lote'); automacoes(q, c, 'mover'); });
    if (a === 'arquivar-todos') cs.forEach(function (c) { c.arquivado = true; });
    if (a === 'copiar') { const nl = { id: Dados.id('ls'), nome: l.nome + ' (cópia)' }; q.listas.splice(q.listas.indexOf(l) + 1, 0, nl); cs.forEach(function (c) { const n = JSON.parse(JSON.stringify(c)); n.id = Dados.id('ct'); n.lista = nl.id; n.comentarios = []; n.atividade = []; n.anexos = []; q.cartoes.push(n); }); }
    if (a === 'arquivar') l.arquivada = true;
    registrar(q, null, 'lista ' + l.nome + ': ' + a);
  }

  async function novoCartaoRapido(q, idLista) {
    const modelos = q.cartoes.filter(function (c) { return c.modelo; });
    const f = await modal({ titulo: 'Novo cartão', corpo: campo('Título', '<input name="titulo" required>') + (modelos.length ? campo('Usar modelo', '<select name="modelo"><option value="">—</option>' + opcoes(modelos.map(function (c) { return { v: c.id, t: c.titulo }; })) + '</select>') : ''), botao: 'Adicionar' });
    if (!f) return;
    const m = f.get('modelo') && cartao(q, f.get('modelo'));
    const base = m ? JSON.parse(JSON.stringify(m)) : {};
    if (m) { delete base.id; base.modelo = false; base.comentarios = []; base.atividade = []; base.anexos = []; (base.checklists || []).forEach(function (cl) { cl.id = Dados.id('cl'); cl.itens.forEach(function (i) { i.feito = false; i.id = Dados.id('ci'); }); }); }
    const l = lista(q, idLista);
    if (l.limite && q.cartoes.filter(function (c) { return c.lista === l.id && !c.arquivado; }).length >= l.limite) aviso('A lista "' + l.nome + '" passou do limite de ' + l.limite + ' cartões.', 'erro');
    criarCartao(q, idLista, Object.assign(base, { titulo: f.get('titulo'), lista: idLista, empresaId: Dados.e.empresaAtiva }));
  }

  // Lembretes e prazos para o Painel.
  function pendencias() {
    const out = [];
    e().quadros.filter(function (q) { return !q.arquivado; }).forEach(function (q) {
      q.cartoes.filter(function (c) { return !c.arquivado && !c.concluido; }).forEach(function (c) {
        if (c.prazo) {
          const ms = new Date(c.prazo) - Date.now();
          const lemb = (Number(c.lembrete) || 0) * 60000;
          if (ms < 0 || (lemb && ms < lemb) || ms < 2 * 86400000) out.push({ quadro: q, cartao: c, quando: c.prazo, tipo: ms < 0 ? 'atrasado' : 'proximo', texto: c.titulo });
        }
        (c.checklists || []).forEach(function (cl) { cl.itens.forEach(function (i) { if (!i.feito && i.prazo && new Date(i.prazo + 'T23:59') - Date.now() < 86400000) out.push({ quadro: q, cartao: c, quando: i.prazo, tipo: new Date(i.prazo + 'T23:59') < Date.now() ? 'atrasado' : 'proximo', texto: i.texto + ' — ' + c.titulo }); }); });
        const x = c.execucao;
        if (x) (x.notas || []).forEach(function (n) {
          const pago = (x.pagamentos || []).filter(function (p) { return p.ref && String(p.ref) === String(n.numero); }).reduce(function (s, p) { return s + (p.valor || 0); }, 0);
          if (n.vencimento && pago + 0.01 < n.valor && new Date(n.vencimento + 'T23:59') < Date.now()) out.push({ quadro: q, cartao: c, quando: n.vencimento, tipo: 'atrasado', texto: 'Pagamento da NF ' + n.numero + ' em atraso (' + moeda(n.valor - pago) + ') — ' + c.titulo });
        });
      });
    });
    return out.sort(function (a, b) { return new Date(a.quando) - new Date(b.quando); });
  }

  Telas.quadros = {
    titulo: 'Quadros',
    render: function (el, sub) {
      garantirQuadroPadrao();
      const ativos = e().quadros.filter(function (q) { return !q.arquivado; });
      if (sub && ativos.some(function (q) { return q.id === sub; })) quadroAtual = sub;
      let q = ativos.find(function (x) { return x.id === quadroAtual; }) || ativos.find(function (x) { return x.favorito; }) || ativos[0];
      if (!q) { q = novoQuadro('Licitações', 'licitacoes'); Dados.salvar(); }
      quadroAtual = q.id;
      desenharQuadro(el, q);
      el.onclick = async function (ev) {
        const v = ev.target.closest('[data-visao]'); if (v) { visao = v.dataset.visao; App.redesenhar(); return; }
        const cal = ev.target.closest('[data-cal]'); if (cal) { mesCal = new Date(mesCal.getFullYear(), mesCal.getMonth() + Number(cal.dataset.cal), 1); App.redesenhar(); return; }
        const b = ev.target.closest('[data-a]');
        if (b) {
          const a = b.dataset.a;
          if (a === 'novo-cartao') { await novoCartaoRapido(q, b.dataset.lista); }
          if (a === 'nova-lista') { const n = await pedir('Nova lista', 'Nome', ''); if (n) q.listas.push({ id: Dados.id('ls'), nome: n }); }
          if (a === 'menu-lista') await menuLista(q, lista(q, b.closest('[data-lista]').dataset.lista));
          if (a === 'menu-quadro') await menuQuadro(q);
          if (a === 'fav-quadro') q.favorito = !q.favorito;
          if (a === 'novo-quadro') {
            const f = await modal({ titulo: 'Novo quadro', corpo: campo('Nome', '<input name="nome" required>') + campo('Modelo', '<select name="modelo">' + opcoes([{ v: 'licitacoes', t: 'Licitações (edital ao pagamento)' }, { v: 'simples', t: 'Simples (A fazer / Fazendo / Feito)' }]) + '</select>') });
            if (f) quadroAtual = novoQuadro(f.get('nome'), f.get('modelo')).id;
          }
          Dados.salvar(); App.redesenhar(); return;
        }
        const k = ev.target.closest('[data-cartao]'); if (k) { const c = cartao(q, k.dataset.cartao); if (c) abrirCartao(q, c); }
      };
      el.onkeydown = function (ev) { if (ev.target.dataset && ev.target.dataset.renomear && ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); return; } const k = ev.target.closest('.kcartao'); if (k && ev.key === 'Enter') { abrirCartao(q, cartao(q, k.dataset.cartao)); } };
      el.ondblclick = async function (ev) {
        const d = ev.target.closest('.kdia'); if (!d || ev.target.closest('[data-cartao]')) return;
        const t = await pedir('Novo cartão em ' + d.dataset.dia.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1'), 'Título', '');
        if (t) { criarCartao(q, q.listas[0].id, { titulo: t, prazo: d.dataset.dia.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') + 'T09:00' }); Dados.salvar(); App.redesenhar(); }
      };
      el.onfocusout = function (ev) {
        const h = ev.target.closest && ev.target.closest('[data-renomear]'); if (!h) return;
        const l = lista(q, h.dataset.renomear); const n = h.textContent.trim();
        if (l && n && n !== l.nome) { registrar(q, null, 'renomeou a lista "' + l.nome + '" para "' + n + '"'); l.nome = n; Dados.salvar(); }
      };
      const sel = el.querySelector('#trocar-quadro'); if (sel) sel.onchange = function () { quadroAtual = sel.value; App.redesenhar(); };
      const kf = el.querySelector('#kfiltros');
      if (kf) { kf.onsubmit = function (ev) { ev.preventDefault(); }; kf.onchange = kf.oninput = function () { const fd = new FormData(kf); filtro = { texto: fd.get('texto'), etiqueta: fd.get('etiqueta'), membro: fd.get('membro'), prazo: fd.get('prazo') }; clearTimeout(kf._t); kf._t = setTimeout(function () { App.redesenhar(); const i = document.querySelector('#kfiltros [name=texto]'); if (i && filtro.texto) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); }; }
    },
    cartaoDeAviso: cartaoDeAviso,
    pendencias: pendencias,
    todosCartoes: function () { const out = []; e().quadros.forEach(function (q) { q.cartoes.forEach(function (c) { out.push({ quadro: q, cartao: c }); }); }); return out; },
    achar: function (qid, cid) { const q = e().quadros.find(function (x) { return x.id === qid; }); return q ? { quadro: q, cartao: cartao(q, cid) } : null; }
  };
})();
