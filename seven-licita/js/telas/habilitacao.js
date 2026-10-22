/* SICAF e Certidões: onde emitir cada documento de habilitação (federal, 27 UFs, municípios) e controle de validade por cliente. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, confirmar, aviso, data } = UI;
  const H = self.Habilitacao;
  const SELO = { v: ['hb-v', 'Página oficial do serviço'], d: ['hb-d', 'Site oficial: procure "Certidões"'], n: ['hb-n', 'Não confirmado'], u: ['hb-u', 'Cadastrado pela equipe'] };
  const est = { filtro: '' };

  function e() { const d = Dados.e; d.linksHab = d.linksHab || []; d.sicafRev = d.sicafRev || {}; d.documentos = d.documentos || []; return d; }
  function hoje() { return new Date().toISOString().slice(0, 10); }
  function dataBR(iso) { return iso ? iso.split('-').reverse().join('/') : ''; }

  function link(l, busca) {
    if (!l) return '';
    const s = SELO[l.s] || SELO.d;
    const val = l.validade ? '<span class="hb-val">' + l.validade + ' dias</span>' : '';
    const principal = l.u ? '<a class="hb-link" href="' + esc(UI.url(l.u)) + '" target="_blank" rel="noopener">' + esc(l.t || l.m) + ' ↗</a>' : '<span class="hb-link hb-sem">' + esc(l.t || l.m) + '</span>';
    const b = (l.s === 'n' || l.s === 'd') && busca ? ' <a class="btn mini fantasma" href="' + esc(UI.url(H.buscaGoogle(busca))) + '" target="_blank" rel="noopener">Buscar ↗</a>' : '';
    const extra = l.extra ? ' · <a href="' + esc(UI.url(l.extra.u)) + '" target="_blank" rel="noopener">' + esc(l.extra.t) + ' ↗</a>' : '';
    return '<div class="hb-item">' + principal + extra + ' <span class="hb-selo ' + s[0] + '" title="' + s[1] + '">' + s[1] + '</span>' + val + b + (l.obs ? '<p class="mini mudo">' + esc(l.obs) + '</p>' : '') + '</div>';
  }

  function legenda() {
    return '<p class="mini mudo hb-legenda">Links conferidos em ' + dataBR(H.VERIFICADO_EM) + '. <span class="hb-selo hb-v">Página oficial do serviço</span> <span class="hb-selo hb-d">Site oficial: procure "Certidões"</span> <span class="hb-selo hb-n">Não confirmado</span> Órgãos mudam endereços: se um link quebrar, use "Buscar" e cadastre o novo na aba Municípios.</p>';
  }

  // ---------- onde emitir um item do checklist, para o cliente ----------
  function fontes(item, emp) {
    const f = item.fonte; if (!f) return [];
    const uf = (emp && emp.uf) || 'GO'; const mun = (emp && emp.municipio) || '';
    const U = H.UF[uf] || {};
    if (f.indexOf('federal:') === 0) { const x = H.FEDERAL.find(function (y) { return y.id === f.slice(8); }); return x ? [x] : []; }
    if (f === 'sefaz') return U.sefaz || [];
    if (f === 'junta') return U.junta ? [U.junta] : [];
    if (f === 'tj') return U.tj ? [U.tj] : [];
    if (f === 'municipio') {
      const m = H.acharMunicipio(uf, mun, e().linksHab);
      if (m) return [Object.assign({ t: 'Prefeitura de ' + m.m }, m)];
      return [{ t: 'Buscar certidão municipal de ' + (mun || 'seu município'), u: H.buscaGoogle('certidão negativa de débitos municipais ' + mun + ' ' + uf + ' prefeitura'), s: 'n' }];
    }
    if (f.indexOf('busca:') === 0) return [{ t: 'Buscar: ' + f.slice(6), u: H.buscaGoogle(f.slice(6) + ' ' + mun + ' ' + uf), s: 'n' }];
    return [];
  }
  function botoesEmitir(item, emp) {
    return fontes(item, emp).map(function (l) { return '<a class="btn mini' + (l.s === 'n' ? ' fantasma' : '') + '" href="' + esc(UI.url(l.u)) + '" target="_blank" rel="noopener" title="' + esc(l.t) + '">' + (l.s === 'n' ? 'Buscar' : 'Emitir') + ' ↗</a>'; }).join(' ');
  }

  // ---------- aba: cliente ----------
  function telaCliente(el) {
    const emp = Dados.empresaAtiva();
    if (!emp) { el.innerHTML = UI.vazio('Sem cliente', 'Cadastre um cliente para controlar os documentos de habilitação dele.', '<a class="btn primario" href="#/empresas">Cadastrar cliente</a>') + legenda(); return; }
    const docs = e().documentos.filter(function (d) { return d.empresaId === emp.id; });
    const P = H.painel(docs);
    const c = P.contagem;
    const rev = e().sicafRev[emp.id];
    el.innerHTML = '<section class="cartao hb-resumo"><div><h3>' + esc(emp.fantasia || emp.razao) + '</h3><p class="mudo">' + esc((emp.municipio ? emp.municipio + '-' : '') + (emp.uf || '')) + ' · documentos lidos de <a href="#/cadastrar/documentos">Meus Documentos</a> pelo nome</p></div>' +
      '<div class="hb-barra" role="progressbar" aria-valuenow="' + P.pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + P.pct + '%"></i></div>' +
      '<p class="hb-num"><b>' + P.pct + '%</b> pronto · <span class="ok">' + (c.ok + c['sem-validade']) + ' em dia</span> · <span class="alerta">' + c.vencendo + ' vencendo</span> · <span class="perigo">' + c.vencido + ' vencido(s)</span> · ' + c.falta + ' faltando</p>' +
      '<p class="mini">SICAF revisado: ' + (rev ? '<b>' + dataBR(rev) + '</b>' : '<b class="alerta">nunca registrado</b>') + ' · <a href="#/habilitacao/sicaf">Guia do SICAF</a></p>' +
      '<div class="grupo-botoes"><button class="btn" data-a="lembretes">Criar lembretes de renovação na Agenda</button><a class="btn fantasma" href="#/cadastrar/documentos">+ Anexar documentos</a></div></section>' +
      H.GRUPOS.map(function (g) {
        const ls = P.linhas.filter(function (l) { return l.item.g === g.id; });
        return '<section class="cartao"><h3>' + esc(g.t) + ' <span class="mini mudo">' + esc(g.base) + '</span></h3><div class="tabela-rolagem"><table class="tabela hb-tab"><thead><tr><th>Documento exigido</th><th>No sistema</th><th>Situação</th><th></th></tr></thead><tbody>' +
          ls.map(function (l) {
            const it = l.item;
            return '<tr data-item="' + it.id + '"><td><b>' + esc(it.t) + '</b>' + (it.validade ? '<br><span class="mini mudo">Validade usual: ' + it.validade + ' dias</span>' : '') + (it.obs ? '<br><span class="mini mudo">' + esc(it.obs) + '</span>' : '') + '</td>' +
              '<td>' + (l.doc ? esc(l.doc.nome) + (l.doc.validade ? '<br><span class="mini">até ' + data(l.doc.validade) + '</span>' : '') : '<span class="mudo">—</span>') + '</td>' +
              '<td><span class="tag hb-st-' + l.sit.codigo + '">' + esc(l.sit.rotulo) + '</span></td>' +
              '<td class="acoes">' + botoesEmitir(it, emp) + (l.doc && l.doc.validade ? ' <button class="btn mini fantasma" data-a="lembrar">Lembrete</button>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div></section>';
      }).join('') + legenda();

    el.onclick = function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      const linhas = b.dataset.a === 'lembretes' ? P.linhas.filter(function (l) { return l.doc && l.doc.validade; }) : P.linhas.filter(function (l) { return l.item.id === b.closest('tr').dataset.item; });
      if (!linhas.length) { aviso('Nenhum documento com validade cadastrada.', 'erro'); return; }
      if (!Telas.agenda || !Telas.agenda.criar) { aviso('Agenda indisponível.', 'erro'); return; }
      let n = 0;
      linhas.forEach(function (l) {
        const titulo = 'Renovar ' + l.doc.nome + ' — ' + (emp.fantasia || emp.razao);
        const ja = ((Dados.e.agenda || {}).tarefas || []).some(function (t) { return t.titulo === titulo && !t.feita && t.data === H.dataLembrete(l.doc.validade, 7); });
        if (ja) return;
        Telas.agenda.criar(titulo, { data: H.dataLembrete(l.doc.validade, 7), tags: ['certidao'] }); n++;
      });
      Dados.salvar();
      aviso(n ? n + ' lembrete(s) criados na Agenda, 7 dias antes de cada vencimento.' : 'Os lembretes já existiam.');
    };
  }

  // ---------- aba: federal ----------
  function telaFederal(el) {
    el.innerHTML = '<p class="mudo">Valem para empresas de qualquer UF. Emita no site do órgão e anexe em Meus Documentos com a validade.</p><div class="hb-grade">' +
      H.FEDERAL.map(function (f) { return '<section class="cartao hb-card"><h3>' + esc(f.t) + '</h3>' + link(Object.assign({}, f, { t: 'Abrir', validade: f.validade || null })) + '<p class="mini"><b>Base:</b> ' + esc(f.base) + '</p></section>'; }).join('') + '</div>' + legenda();
  }

  // ---------- aba: estados ----------
  function seletorUF(base, ativa) {
    return '<div class="pilulas hb-ufs">' + (base === 'estados' ? '<a class="pilula ' + (!ativa ? 'ativa' : '') + '" href="#/habilitacao/estados">Todas</a>' : '') + PNCP.UFS.map(function (u) { return '<a class="pilula ' + (u === ativa ? 'ativa' : '') + '" href="#/habilitacao/' + base + '/' + u + '">' + u + '</a>'; }).join('') + '</div>';
  }
  function telaEstados(el, uf) {
    if (uf && !H.UF[uf]) uf = '';
    if (!uf) {
      el.innerHTML = seletorUF('estados', '') + '<input class="hb-filtro" type="search" placeholder="Filtrar por estado ou órgão…" value="' + esc(est.filtro) + '" aria-label="Filtrar">' +
        '<div class="tabela-rolagem"><table class="tabela hb-tab"><thead><tr><th>UF</th><th>Fazenda estadual (SEFAZ / PGE)</th><th>Junta Comercial</th><th>TJ — falência e recuperação</th></tr></thead><tbody>' +
        PNCP.UFS.map(function (u) {
          const x = H.UF[u];
          const txt = H.normalizar(u + ' ' + x.nome + ' ' + x.sefaz.map(function (s) { return s.t; }).join(' ') + ' ' + x.junta.t + ' ' + x.tj.t);
          return '<tr data-txt="' + esc(txt) + '"><td><a href="#/habilitacao/estados/' + u + '"><b>' + u + '</b></a><br><span class="mini mudo">' + esc(x.nome) + '</span>' + (x.validade ? '<br><span class="hb-val">' + x.validade + ' dias</span>' : '') + '</td><td>' + x.sefaz.map(function (s) { return link(s, 'certidão negativa de débitos estaduais ' + x.nome); }).join('') + '</td><td>' + link(x.junta, 'certidão simplificada junta comercial ' + x.nome) + '</td><td>' + link(x.tj, 'certidão de falência e recuperação judicial TJ ' + u) + '</td></tr>';
        }).join('') + '</tbody></table></div>' + legenda();
      const f = el.querySelector('.hb-filtro');
      const aplicar = function () { const q = H.normalizar(f.value); est.filtro = f.value; el.querySelectorAll('tr[data-txt]').forEach(function (tr) { tr.hidden = q && tr.dataset.txt.indexOf(q) < 0; }); };
      f.oninput = aplicar; aplicar();
      return;
    }
    const x = H.UF[uf];
    const caps = H.municipiosDe(uf, e().linksHab);
    el.innerHTML = seletorUF('estados', uf) + '<h2 class="hb-tit">' + esc(x.nome) + ' (' + uf + ')</h2>' + (x.obs ? '<p class="alerta">' + esc(x.obs) + '</p>' : '') +
      '<div class="hb-grade">' +
      '<section class="cartao hb-card"><h3>Fazenda estadual</h3><p class="mini mudo">Regularidade fiscal estadual (art. 68, III)' + (x.validade ? ' · validade informada: ' + x.validade + ' dias' : ' · confira a validade na certidão') + '</p>' + x.sefaz.map(function (s) { return link(s, 'certidão negativa de débitos estaduais ' + x.nome); }).join('') + '</section>' +
      '<section class="cartao hb-card"><h3>Junta Comercial</h3><p class="mini mudo">Certidão simplificada e atos constitutivos (art. 66)</p>' + link(x.junta, 'certidão simplificada junta comercial ' + x.nome) + '</section>' +
      '<section class="cartao hb-card"><h3>Tribunal de Justiça</h3><p class="mini mudo">Certidão de falência e recuperação judicial (art. 69, II)</p>' + link(x.tj, 'certidão de falência e recuperação judicial TJ ' + uf) + '</section>' +
      '<section class="cartao hb-card"><h3>Prefeituras</h3><p class="mini mudo">Regularidade fiscal municipal (art. 68, III)</p>' + caps.map(function (m) { return link(Object.assign({ t: m.m }, m)); }).join('') + '<a class="btn mini" href="#/habilitacao/municipios/' + uf + '">Outros municípios de ' + uf + ' →</a></section>' +
      '</div>' + legenda();
  }

  // ---------- aba: municípios ----------
  function telaMunicipios(el, uf) {
    const emp = Dados.empresaAtiva();
    uf = H.UF[uf] ? uf : ((emp && emp.uf) || 'GO');
    const ls = H.municipiosDe(uf, e().linksHab);
    const sug = emp && emp.uf === uf ? emp.municipio || '' : '';
    el.innerHTML = seletorUF('municipios', uf) +
      '<section class="cartao"><h3>Prefeituras de ' + esc(H.UF[uf].nome) + '</h3><p class="mini mudo">Capitais e municípios conferidos pela Seven, mais os que a equipe cadastrar. Cada prefeitura tem seu próprio sistema: o link aponta para a página de certidões.</p>' +
      '<div class="tabela-rolagem"><table class="tabela hb-tab"><tbody>' + ls.map(function (m) {
        return '<tr data-id="' + esc(m.id || '') + '"><td><b>' + esc(m.m) + '</b></td><td>' + link(Object.assign({ t: m.t || 'Certidão municipal' }, m), 'certidão negativa de débitos municipais ' + m.m + ' ' + uf) + '</td><td class="acoes">' + (m.s === 'u' ? '<button class="btn mini fantasma" data-a="editar">Editar</button><button class="btn mini fantasma perigo" data-a="excluir" aria-label="Excluir">×</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></section>' +
      '<section class="cartao"><h3>Outro município</h3><form class="hb-busca" id="hb-busca"><input name="m" placeholder="Nome do município" value="' + esc(sug) + '" required aria-label="Município"><button class="btn">Buscar certidão ↗</button><button class="btn primario" type="button" data-a="novo">+ Cadastrar link</button></form>' +
      '<p class="mini mudo">A busca abre o Google filtrado para a certidão da prefeitura. Achou a página oficial (domínio .gov.br ou da prefeitura)? Cadastre aqui e ela fica disponível para toda a equipe neste navegador.</p></section>' + legenda();

    el.querySelector('#hb-busca').onsubmit = function (ev) { ev.preventDefault(); const m = new FormData(ev.target).get('m'); const ja = H.acharMunicipio(uf, m, e().linksHab); window.open(ja ? ja.u : H.buscaGoogle('certidão negativa de débitos municipais ' + m + ' ' + uf + ' prefeitura'), '_blank', 'noopener'); };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      const tr = b.closest('tr[data-id]'); const x = tr && e().linksHab.find(function (y) { return y.id === tr.dataset.id; });
      if (b.dataset.a === 'novo' || b.dataset.a === 'editar') {
        const v = x || { uf: uf, m: el.querySelector('#hb-busca input').value };
        const f = await modal({
          titulo: x ? 'Editar link municipal' : 'Cadastrar link municipal',
          corpo: '<div class="linha">' + campo('UF', '<select name="uf">' + opcoes(PNCP.UFS, v.uf) + '</select>') + campo('Município *', '<input name="m" required value="' + esc(v.m || '') + '">') + '</div>' +
            campo('Endereço da página de certidões *', '<input name="u" type="url" required placeholder="https://" value="' + esc(v.u || '') + '">') +
            campo('Descrição', '<input name="t" placeholder="Ex.: Certidão negativa — Portal do Contribuinte" value="' + esc(v.t || '') + '">') +
            '<div class="linha">' + campo('Validade (dias)', '<input name="validade" type="number" min="0" value="' + esc(v.validade || '') + '">') + campo('Observação', '<input name="obs" value="' + esc(v.obs || '') + '">') + '</div>',
          validar: function (fd) { return H.validarUrl(fd.get('u')) ? '' : 'Informe um endereço começando com https://'; }
        });
        if (!f) return;
        const dados = { uf: f.get('uf'), m: f.get('m').trim(), u: f.get('u').trim(), t: f.get('t').trim(), validade: Number(f.get('validade')) || null, obs: f.get('obs').trim(), em: hoje() };
        const dup = H.MUNICIPIOS.find(function (y) { return y.uf === dados.uf && H.normalizar(y.m) === H.normalizar(dados.m); });
        if (dup && !await confirmar('Município já listado', esc(dados.m) + ' já tem link conferido pela Seven. Cadastrar mais um?', 'Cadastrar')) return;
        if (x) Object.assign(x, dados); else e().linksHab.push(Object.assign({ id: Dados.id('lkh') }, dados));
        Dados.salvar(); location.hash = '#/habilitacao/municipios/' + dados.uf; App.redesenhar(); return;
      }
      if (b.dataset.a === 'excluir' && x && await confirmar('Excluir link', 'Excluir o link de <b>' + esc(x.m) + '</b>?', 'Excluir')) { e().linksHab = e().linksHab.filter(function (y) { return y !== x; }); Dados.salvar(); App.redesenhar(); }
    };
  }

  // ---------- aba: SICAF ----------
  function telaSicaf(el) {
    const emp = Dados.empresaAtiva();
    const docs = emp ? e().documentos.filter(function (d) { return d.empresaId === emp.id; }) : [];
    const P = H.painel(docs);
    const porNome = function (n) { return P.linhas.find(function (l) { return H.normalizar(l.item.t).indexOf(H.normalizar(n).split(' ')[0]) === 0; }); };
    const rev = emp && e().sicafRev[emp.id];
    const sicaf = H.FEDERAL.find(function (f) { return f.id === 'sicaf'; });
    const gov = H.FEDERAL.find(function (f) { return f.id === 'govbr'; });
    el.innerHTML = '<section class="cartao hb-resumo"><h3>Atualizar o SICAF</h3>' +
      '<ol class="hb-passos"><li>Conta gov.br do representante em nível <b>prata ou ouro</b>. ' + link(Object.assign({}, gov, { t: 'Conta gov.br' })) + '</li>' +
      '<li>Entre no SICAF como fornecedor. ' + link(Object.assign({}, sicaf, { t: 'Abrir SICAF' })) + '</li>' +
      '<li>Nível III (federal) atualiza sozinho pelas bases da Receita, Caixa e TST: só confira as datas.</li>' +
      '<li>Níveis IV e VI: emita as certidões estadual, municipal e de falência e anexe o PDF com a validade (links nas abas Estados e Municípios).</li>' +
      '<li>Depois do encerramento do exercício, atualize o balanço (nível VI) até o prazo legal do SPED.</li></ol>' +
      (emp ? '<p>Cliente: <b>' + esc(emp.fantasia || emp.razao) + '</b> · última revisão: ' + (rev ? '<b>' + dataBR(rev) + '</b>' : '<b class="alerta">não registrada</b>') + '</p><div class="grupo-botoes"><button class="btn primario" data-a="revisei">Registrar revisão de hoje</button><button class="btn" data-a="lembrete">Lembrete de revisão em 30 dias</button></div>' : '<p class="mudo">Selecione um cliente para registrar as revisões do SICAF dele.</p>') + '</section>' +
      '<div class="hb-grade">' + H.SICAF_NIVEIS.map(function (n) {
        return '<section class="cartao hb-card"><h3><span class="hb-nivel">' + n.n + '</span> ' + esc(n.t) + '</h3><p class="mini">' + esc(n.d) + '</p><ul class="hb-docs">' + n.docs.map(function (d) {
          const l = emp && porNome(d);
          return '<li>' + esc(d) + (l ? ' <span class="tag hb-st-' + l.sit.codigo + '">' + esc(l.sit.rotulo) + '</span>' : '') + '</li>';
        }).join('') + '</ul></section>';
      }).join('') + '</div><p class="mini mudo">Níveis conforme a IN SEGES/MP nº 3/2018. O SICAF substitui, na habilitação, os documentos que estiverem registrados e válidos nele (art. 70, III, da Lei 14.133/2021); o edital pode pedir complementos.</p>' + legenda();
    el.onclick = function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b || !emp) return;
      if (b.dataset.a === 'revisei') { e().sicafRev[emp.id] = hoje(); Dados.salvar(); aviso('Revisão do SICAF registrada.'); App.redesenhar(); }
      if (b.dataset.a === 'lembrete' && Telas.agenda) { const d = new Date(); d.setDate(d.getDate() + 30); Telas.agenda.criar('Revisar SICAF — ' + (emp.fantasia || emp.razao), { data: d.toISOString().slice(0, 10), tags: ['sicaf'] }); Dados.salvar(); aviso('Lembrete criado na Agenda.'); }
    };
  }

  Telas.habilitacao = {
    titulo: 'SICAF e Certidões',
    render: function (el, sub, param) {
      sub = sub || 'cliente';
      const telas = { cliente: telaCliente, federal: telaFederal, estados: telaEstados, municipios: telaMunicipios, sicaf: telaSicaf };
      if (!telas[sub]) sub = 'cliente';
      const emp = Dados.empresaAtiva();
      const P = emp ? H.painel(e().documentos.filter(function (d) { return d.empresaId === emp.id; })) : null;
      el.innerHTML = UI.abas([{ id: 'cliente', t: 'Checklist do cliente', n: P ? P.contagem.vencido + P.contagem.vencendo : 0 }, { id: 'federal', t: 'Federal' }, { id: 'estados', t: 'Estados' }, { id: 'municipios', t: 'Municípios' }, { id: 'sicaf', t: 'SICAF' }], sub, 'habilitacao') + '<div id="hb-aba"></div>';
      const aba = el.querySelector('#hb-aba');
      telas[sub](aba, (sub === 'estados' && !param ? '' : param) || (sub === 'municipios' && emp ? emp.uf : param));
    },
    fontes: fontes
  };
})();
