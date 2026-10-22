/* Monitorar: licitações acompanhadas, mensagens do pregoeiro com palavras-chave, prazos e recursos. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, dataHora, campo, opcoes, modal, confirmar, aviso, abas, emQuanto } = UI;
  const CORES = { vermelho: 'Vermelho · risco crítico', amarelo: 'Amarelo · documentação', verde: 'Verde · financeiro', azul: 'Azul · operação', rosa: 'Rosa · vantagem', laranja: 'Laranja', roxo: 'Roxo' };
  const TIPOS_PRAZO = ['Envio de proposta atualizada', 'Envio de documentos de habilitação', 'Diligência', 'Intenção de recurso', 'Razões de recurso', 'Contrarrazões', 'Assinatura de ata/contrato', 'Outro'];
  let filtroCat = '';

  function e() { return Dados.e; }
  function daEmpresa(l) { const a = Dados.empresaAtiva(); return a ? l.filter(function (x) { return !x.empresaId || x.empresaId === a.id; }) : l; }

  function adicionar(a, portal) {
    const emp = Dados.e.empresaAtiva;
    if (e().monitor.some(function (m) { return m.avisoId === a.id && m.empresaId === emp; })) { aviso('Já está no Monitorar.'); return; }
    e().monitor.unshift({
      id: Dados.id('mon'), avisoId: a.id, empresaId: emp, titulo: (a.modalidade || '') + ' ' + (a.numero || '') + ' · ' + (a.orgao || ''), objeto: a.objeto, edital: a.edital, linkOrigem: a.linkOrigem,
      portal: portal || Telas.cadastrar.portalDe(a), situacao: 'Agendada', sessao: a.encerramento, responsavel: e().config.responsavel || '', mensagens: [], prazos: [], recursos: [], criadoEm: new Date().toISOString()
    });
    Dados.salvar(); aviso('Adicionado ao Monitorar.');
  }

  function prazosAbertos() {
    const out = [];
    e().monitor.forEach(function (m) { (m.prazos || []).forEach(function (p) { if (!p.feito) out.push({ m: m, p: p }); }); });
    return out.sort(function (a, b) { return new Date(a.p.ate) - new Date(b.p.ate); });
  }

  function telaLista(el) {
    let l = daEmpresa(e().monitor);
    const cont = {}; Nucleo.CATEGORIAS.forEach(function (c) { cont[c] = l.filter(function (m) { return m.situacao === c; }).length; });
    if (filtroCat) l = l.filter(function (m) { return m.situacao === filtroCat; });
    const pz = prazosAbertos().filter(function (x) { return l.indexOf(x.m) >= 0; });
    el.innerHTML = '<div class="nota-importante">O chat do pregoeiro é lido no portal. Cole aqui as mensagens (ou registre-as à mão) para destacar palavras-chave, controlar prazos e não perder convocação. A resposta é sempre enviada no portal.</div>' +
      '<div class="pilulas">' + ['', ].concat(Nucleo.CATEGORIAS).map(function (c) { return '<button class="pilula ' + (filtroCat === c ? 'ativa' : '') + '" data-cat="' + esc(c) + '">' + esc(c || 'Todas') + (c ? ' <b>' + cont[c] + '</b>' : '') + '</button>'; }).join('') + '</div>' +
      (pz.length ? '<section class="cartao"><h3>Prazos abertos</h3><ul class="lista-prazos">' + pz.slice(0, 12).map(function (x) { const ms = new Date(x.p.ate) - Date.now(); return '<li class="' + (ms < 0 ? 'atrasado' : ms < 86400000 ? 'logo' : '') + '"><b>' + dataHora(x.p.ate) + '</b> (' + emQuanto(x.p.ate) + ') · ' + esc(x.p.tipo) + ' — <a href="#/monitorar/licitacao/' + x.m.id + '">' + esc(x.m.titulo) + '</a></li>'; }).join('') + '</ul></section>' : '') +
      (l.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Licitação</th><th>Portal</th><th>Situação</th><th>Responsável</th><th>Mensagens</th><th>Próximo prazo</th></tr></thead><tbody>' +
        l.map(function (m) {
          const dest = m.mensagens.filter(function (x) { return !x.lida && Nucleo.destacar(x.texto, e().palavrasChave).length; }).length;
          const prox = (m.prazos || []).filter(function (p) { return !p.feito; }).sort(function (a, b) { return new Date(a.ate) - new Date(b.ate); })[0];
          return '<tr class="clicavel" data-id="' + m.id + '"><td><b>' + esc(m.titulo) + '</b><br><span class="mini mudo">' + esc(String(m.objeto || '').slice(0, 100)) + '</span></td><td>' + esc(m.portal || '') + '</td><td><span class="tag">' + esc(m.situacao) + '</span></td><td>' + esc(m.responsavel || '—') + '</td><td>' + m.mensagens.length + (dest ? ' <span class="tag vermelho">' + dest + ' destaque(s)</span>' : '') + '</td><td>' + (prox ? esc(prox.tipo) + '<br><small>' + dataHora(prox.ate) + '</small>' : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : UI.vazio('Nada sendo monitorado', 'Adicione licitações a partir do Encontrar ou de uma proposta.', '<a class="btn" href="#/encontrar">Ir para o Encontrar</a>'));
    el.onclick = function (ev) {
      const c = ev.target.closest('[data-cat]'); if (c) { filtroCat = c.dataset.cat; App.redesenhar(); return; }
      const tr = ev.target.closest('tr[data-id]'); if (tr) location.hash = '#/monitorar/licitacao/' + tr.dataset.id;
    };
  }

  function destacarHTML(texto) {
    let h = esc(texto);
    e().palavrasChave.forEach(function (p) {
      if (!p.termo) return;
      const re = new RegExp('(' + esc(p.termo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      h = h.replace(re, '<mark class="pk-' + p.cor + '">$1</mark>');
    });
    return h;
  }

  function telaLicitacao(el, id) {
    const m = e().monitor.find(function (x) { return x.id === id; });
    if (!m) { el.innerHTML = UI.vazio('Não encontrada', '', '<a class="btn" href="#/monitorar">Voltar</a>'); return; }
    m.mensagens.forEach(function (x) { x.lida = true; }); Dados.salvar();
    el.innerHTML = '<p><a href="#/monitorar">← Minhas licitações</a></p>' +
      '<section class="cartao"><header><h2>' + esc(m.titulo) + '</h2><div class="grupo-botoes">' + (m.edital ? '<a class="btn fantasma" href="' + esc(m.edital) + '" target="_blank" rel="noopener">Edital ↗</a>' : '') + (m.linkOrigem ? '<a class="btn fantasma" href="' + esc(m.linkOrigem) + '" target="_blank" rel="noopener">Abrir no portal ↗</a>' : '') + '</div></header>' +
      '<p class="mini">' + esc(m.objeto || '') + '</p><form id="cab" class="linha">' + campo('Situação', '<select name="situacao">' + opcoes(Nucleo.CATEGORIAS, m.situacao) + '</select>') + campo('Responsável', '<input name="responsavel" value="' + esc(m.responsavel || '') + '" list="membros-mon"><datalist id="membros-mon">' + (e().membros || []).map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>') + campo('Sessão', '<input type="datetime-local" name="sessao" value="' + esc(String(m.sessao || '').slice(0, 16)) + '">') + '</form>' +
      '<p class="mini mudo">"Disputa encerrada" não é o fim: ainda há julgamento, habilitação e recurso. Ao transferir o responsável, o histórico fica aqui para o novo responsável.</p></section>' +
      '<div class="cartoes largos"><section class="cartao"><header><h3>Mensagens do pregoeiro</h3><button class="btn mini" data-a="colar">Colar mensagens do chat</button></header>' +
      '<form id="nova-msg" class="kitem-novo"><select name="autor">' + opcoes(['Pregoeiro', 'Sistema', 'Nós', 'Licitante']) + '</select><input name="texto" placeholder="Registrar mensagem…" required><button class="btn mini">+</button></form>' +
      '<ul class="chat">' + m.mensagens.slice().reverse().map(function (x, k) { const pk = Nucleo.destacar(x.texto, e().palavrasChave); return '<li class="' + (x.autor === 'Nós' ? 'nos' : '') + (pk.length ? ' destaque pk-borda-' + pk[0].cor : '') + '"><span class="mini mudo">' + esc(x.autor) + ' · ' + dataHora(x.em) + '</span><p>' + destacarHTML(x.texto) + '</p><button class="icone" data-a="prazo-msg" data-k="' + (m.mensagens.length - 1 - k) + '" title="Criar prazo a partir desta mensagem">◷</button></li>'; }).join('') + '</ul></section>' +
      '<section class="cartao"><header><h3>Prazos</h3><button class="btn mini" data-a="novo-prazo">+ Prazo</button></header><ul class="lista-prazos">' + (m.prazos || []).slice().sort(function (a, b) { return new Date(a.ate) - new Date(b.ate); }).map(function (p) { const ms = new Date(p.ate) - Date.now(); return '<li class="' + (p.feito ? 'feito' : ms < 0 ? 'atrasado' : ms < 86400000 ? 'logo' : '') + '" data-p="' + p.id + '"><label class="check"><input type="checkbox" data-a="feito"' + (p.feito ? ' checked' : '') + '> <b>' + esc(p.tipo) + '</b></label> até ' + dataHora(p.ate) + (p.feito ? '' : ' (' + emQuanto(p.ate) + ')') + (p.obs ? '<br><span class="mini">' + esc(p.obs) + '</span>' : '') + '</li>'; }).join('') + '</ul>' +
      '<h3>Recursos</h3><p class="mini mudo">Registro da intenção e controle das razões/contrarrazões. A intenção é registrada no portal, dentro do prazo aberto pelo pregoeiro.</p><button class="btn mini" data-a="recurso">+ Registrar intenção / recurso</button><ul class="lista-notas">' + (m.recursos || []).map(function (r) { return '<li><b>' + esc(r.tipo) + '</b> · item/lote ' + esc(r.item || '—') + ' · ' + dataHora(r.em) + '<br>' + esc(r.obs || '') + ' <a href="#/pecas/nova/' + encodeURIComponent('mon:' + m.id) + '">gerar peça</a></li>'; }).join('') + '</ul></section></div>' +
      '<p><button class="btn fantasma perigo" data-a="remover">Remover do Monitorar</button></p>';
    el.insertAdjacentHTML('beforeend', Telas.oport.secao(Telas.oport.chaveMonitor(m), 'monitorar'));
    el.querySelector('#cab').onchange = function () { const fd = new FormData(this); if (m.responsavel !== fd.get('responsavel')) m.historicoResp = (m.historicoResp || []).concat({ de: m.responsavel, para: fd.get('responsavel'), em: new Date().toISOString() }); m.situacao = fd.get('situacao'); m.responsavel = fd.get('responsavel'); m.sessao = fd.get('sessao'); Dados.salvar(); };
    el.querySelector('#nova-msg').onsubmit = function (ev) { ev.preventDefault(); const fd = new FormData(this); m.mensagens.push({ autor: fd.get('autor'), texto: fd.get('texto'), em: new Date().toISOString(), lida: true }); detectarPrazo(m, fd.get('texto')); Dados.salvar(); App.redesenhar(); };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'colar') {
        const f = await modal({ titulo: 'Colar mensagens do chat', largo: true, corpo: campo('Texto copiado do chat do portal', '<textarea name="t" rows="12" required placeholder="Cole aqui. Cada linha (ou bloco iniciado por data/hora) vira uma mensagem."></textarea>') });
        if (!f) return;
        const blocos = String(f.get('t')).split(/\n(?=\s*\d{2}\/\d{2}\/\d{4})|\n{2,}/).map(function (s) { return s.trim(); }).filter(Boolean);
        blocos.forEach(function (t) { const mm = t.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/); const em = mm ? new Date(+mm[3], +mm[2] - 1, +mm[1], +mm[4], +mm[5], +(mm[6] || 0)).toISOString() : new Date().toISOString(); if (!m.mensagens.some(function (x) { return x.texto === t; })) { m.mensagens.push({ autor: /pregoeiro|agente de contrata/i.test(t) ? 'Pregoeiro' : /sistema/i.test(t) ? 'Sistema' : 'Pregoeiro', texto: t, em: em, lida: true }); detectarPrazo(m, t); } });
        m.mensagens.sort(function (x, y) { return new Date(x.em) - new Date(y.em); });
        aviso(blocos.length + ' mensagem(ns) registradas.');
      }
      if (a === 'novo-prazo' || a === 'prazo-msg') {
        const msg = a === 'prazo-msg' ? m.mensagens[b.dataset.k] : null;
        const f = await modal({ titulo: 'Novo prazo', corpo: campo('Tipo', '<select name="tipo">' + opcoes(TIPOS_PRAZO, msg ? sugerirTipo(msg.texto) : '') + '</select>') + campo('Até', '<input type="datetime-local" name="ate" required>') + campo('Observação', '<input name="obs" value="' + esc(msg ? msg.texto.slice(0, 160) : '') + '">') });
        if (!f) return; m.prazos = (m.prazos || []).concat({ id: Dados.id('pz'), tipo: f.get('tipo'), ate: f.get('ate'), obs: f.get('obs'), feito: false });
      }
      if (a === 'feito') { const p = m.prazos.find(function (x) { return x.id === b.closest('[data-p]').dataset.p; }); p.feito = b.checked; }
      if (a === 'recurso') {
        const f = await modal({ titulo: 'Recurso', corpo: campo('Tipo', '<select name="tipo">' + opcoes(['Intenção de recurso registrada', 'Razões de recurso protocoladas', 'Contrarrazões protocoladas', 'Concorrente recorreu']) + '</select>') + campo('Item / lote', '<input name="item">') + campo('Observação', '<textarea name="obs" rows="3"></textarea>') + '<label class="check"><input type="checkbox" name="prazo" checked> Criar prazo de 3 dias úteis para razões/contrarrazões (art. 165 da Lei 14.133)</label>' });
        if (!f) return;
        m.recursos = (m.recursos || []).concat({ tipo: f.get('tipo'), item: f.get('item'), obs: f.get('obs'), em: new Date().toISOString() });
        if (f.get('prazo')) m.prazos = (m.prazos || []).concat({ id: Dados.id('pz'), tipo: /concorrente/i.test(f.get('tipo')) ? 'Contrarrazões' : 'Razões de recurso', ate: diasUteis(3), obs: 'Confira no portal a data exata aberta pelo pregoeiro.', feito: false });
      }
      if (a === 'remover' && await confirmar('Remover', 'Remover do Monitorar? Mensagens e prazos registrados serão perdidos.', 'Remover')) { e().monitor = e().monitor.filter(function (x) { return x !== m; }); Dados.salvar(); location.hash = '#/monitorar'; return; }
      Dados.salvar(); App.redesenhar();
    };
  }

  function diasUteis(n) {
    const d = new Date(); let k = 0;
    while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) k++; }
    d.setHours(23, 59, 0, 0);
    return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function sugerirTipo(t) {
    const n = Nucleo.normalizar(t);
    if (/diligencia/.test(n)) return 'Diligência';
    if (/proposta (ajustada|atualizada|readequada)/.test(n)) return 'Envio de proposta atualizada';
    if (/habilita|documento/.test(n)) return 'Envio de documentos de habilitação';
    if (/intencao de recurso/.test(n)) return 'Intenção de recurso';
    if (/contrarraz/.test(n)) return 'Contrarrazões';
    if (/assinatura|assinar/.test(n)) return 'Assinatura de ata/contrato';
    return 'Outro';
  }

  // Mensagem com "prazo de N horas/minutos" ou "até dd/mm/aaaa hh:mm" vira prazo automaticamente.
  function detectarPrazo(m, texto) {
    const n = Nucleo.normalizar(texto); let ate = null;
    let r = n.match(/prazo de (\d+) ?(hora|horas|h|minuto|minutos|min)/);
    if (r) ate = new Date(Date.now() + Number(r[1]) * (/^h/.test(r[2]) ? 3600000 : 60000));
    r = texto.match(/at[ée]\s+(?:o dia\s+)?(\d{2})\/(\d{2})\/(\d{4})(?:\s*(?:às|as)?\s*(\d{2})[:h](\d{2}))?/i);
    if (r) ate = new Date(+r[3], +r[2] - 1, +r[1], +(r[4] || 23), +(r[5] || 59));
    if (!ate || isNaN(ate)) return;
    m.prazos = (m.prazos || []).concat({ id: Dados.id('pz'), tipo: sugerirTipo(texto), ate: new Date(ate - ate.getTimezoneOffset() * 60000).toISOString().slice(0, 16), obs: 'Detectado na mensagem: ' + texto.slice(0, 140), feito: false });
    aviso('Prazo detectado na mensagem e registrado.');
  }

  function telaPalavras(el) {
    el.innerHTML = '<p class="mudo">Termos destacados nas mensagens do chat, com até cinco cores de prioridade (número do item, "recurso", "documento"…).</p><form id="pk"><table class="tabela compacta"><tbody>' + e().palavrasChave.concat([{ termo: '', cor: 'amarelo' }]).map(function (p, i) { return '<tr><td><input name="t' + i + '" value="' + esc(p.termo) + '" placeholder="Nova palavra-chave"></td><td><select name="c' + i + '">' + opcoes(Object.keys(CORES).map(function (k) { return { v: k, t: CORES[k] }; }), p.cor) + '</select></td><td><mark class="pk-' + p.cor + '">' + esc(p.termo || 'exemplo') + '</mark></td></tr>'; }).join('') + '</tbody></table><p class="mini mudo">Apague o texto para remover.</p><button class="btn primario">Salvar</button></form>';
    el.querySelector('#pk').onsubmit = function (ev) { ev.preventDefault(); const fd = new FormData(this); const out = []; for (let i = 0; i <= e().palavrasChave.length; i++) { const t = (fd.get('t' + i) || '').trim(); if (t) out.push({ termo: t, cor: fd.get('c' + i) }); } e().palavrasChave = out; Dados.salvar(); aviso('Palavras-chave salvas.'); App.redesenhar(); };
  }

  Telas.monitorar = {
    titulo: 'Monitorar',
    render: function (el, sub, param) {
      el.innerHTML = abas([{ id: 'licitacoes', t: 'Minhas licitações', n: prazosAbertos().filter(function (x) { return new Date(x.p.ate) - Date.now() < 86400000; }).length }, { id: 'palavras', t: 'Palavras-chave' }], sub === 'palavras' ? 'palavras' : 'licitacoes', 'monitorar') + '<div id="aba"></div>';
      const aba = el.querySelector('#aba');
      if (sub === 'licitacao') telaLicitacao(aba, param); else if (sub === 'palavras') telaPalavras(aba); else telaLista(aba);
      el.onclick = null;
    },
    adicionar: adicionar,
    prazosAbertos: prazosAbertos
  };
})();
