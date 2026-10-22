/* Seven Bid: propostas (itens do PNCP, planilha, impressão), Meus Documentos e Meus Produtos. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, num, data, dataHora, cnpj, campo, opcoes, modal, confirmar, aviso, abas, emQuanto } = UI;
  const STATUS = { rascunho: 'Rascunho', pronta: 'Pronta para envio', enviada: 'Enviada no portal', erro: 'Envio com erro', vencida: 'Ganha / readequada', perdida: 'Não vencida' };
  const PORTAIS = ['Compras.gov.br', 'BLL', 'BNC', 'Licitanet', 'Compras Públicas', 'SISLOG-GO', 'Licitações-e', 'Licitar Digital', 'BBMNet', 'Portal próprio do órgão', 'Outro'];
  const LINKS_CERTIDOES = [
    { t: 'CND Federal (Receita/PGFN)', u: 'https://www.gov.br/pt-br/servicos/emitir-certidao-de-regularidade-fiscal' },
    { t: 'CRF do FGTS (Caixa)', u: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf' },
    { t: 'CNDT (TST)', u: 'https://cndt-certidao.tst.jus.br/inicio.faces' },
    { t: 'SICAF', u: 'https://www3.comprasnet.gov.br/sicaf-web/index.jsf' }
  ];
  let editando = null;

  function e() { return Dados.e; }
  function daEmpresa(l) { const a = Dados.empresaAtiva(); return a ? l.filter(function (x) { return !x.empresaId || x.empresaId === a.id; }) : l; }
  function totalItem(i) { return (Number(i.unitario) || 0) * (Number(i.quantidade) || 0); }
  function totalProposta(p) { return p.itens.filter(function (i) { return i.participar !== false; }).reduce(function (s, i) { return s + totalItem(i); }, 0); }
  function portalDe(a) {
    const t = ((a && (a.linkOrigem || '')) + ' ' + (a && a.sistema || '')).toLowerCase();
    if (/compras\.gov|comprasnet|serpro|cnetmobile/.test(t)) return 'Compras.gov.br';
    if (/bll/.test(t)) return 'BLL'; if (/bnc/.test(t)) return 'BNC'; if (/licitanet/.test(t)) return 'Licitanet';
    if (/compraspublicas|portaldecompraspublicas/.test(t)) return 'Compras Públicas'; if (/sislog|go\.gov/.test(t)) return 'SISLOG-GO';
    if (/licitacoes-e|bb\.com/.test(t)) return 'Licitações-e'; return 'Outro';
  }

  // ---------- propostas ----------
  async function novaDeAviso(a) {
    const emp = Dados.empresaAtiva();
    if (!emp) { aviso('Cadastre um cliente (CNPJ) antes de criar a proposta.', 'erro'); location.hash = '#/empresas'; return; }
    const ja = e().propostas.find(function (p) { return p.avisoId === a.id && p.empresaId === emp.id; });
    if (ja) { location.hash = '#/cadastrar/proposta/' + ja.id; return; }
    const p = {
      id: Dados.id('ppt'), empresaId: emp.id, avisoId: a.id, ref: { cnpj: a.cnpj, ano: a.ano, seq: a.seq }, objeto: a.objeto, orgao: a.orgao, uf: a.uf, municipio: a.municipio,
      modalidade: a.modalidade, numero: a.numero, processo: a.processo, encerramento: a.encerramento, edital: a.edital, linkOrigem: a.linkOrigem, portal: portalDe(a),
      itens: [], status: 'rascunho', criadaEm: new Date().toISOString(), declaracoes: {}, validade: 60, prazoEntrega: '', condicoes: '', impostos: 0, margem: 0
    };
    e().propostas.unshift(p); Dados.salvar();
    location.hash = '#/cadastrar/proposta/' + p.id;
    carregarItens(p, true);
  }

  async function carregarItens(p, silencioso) {
    if (!p.ref) { aviso('Informe a licitação (link do PNCP) para carregar os itens.', 'erro'); return; }
    try {
      const l = await PNCP.itens(p.ref.cnpj, p.ref.ano, p.ref.seq);
      if (!l.length) { aviso('O PNCP não tem itens publicados para esta licitação. Inclua à mão ou importe a planilha.', 'erro'); return; }
      const antigos = {}; p.itens.forEach(function (i) { antigos[i.numero] = i; });
      let preservados = 0;
      p.itens = l.map(function (i) {
        const v = antigos[i.numero];
        if (v && (v.unitario || v.marca)) { preservados++; return Object.assign({}, v, { descricao: i.descricao, refUnitaria: i.refUnitaria, meEpp: i.meEpp, margemPref: i.margem }); }
        return { numero: i.numero, descricao: i.descricao, quantidade: i.quantidade, unidade: i.unidade, refUnitaria: i.refUnitaria, meEpp: i.meEpp, margemPref: i.margem, tipo: i.tipo, criterio: i.criterio, participar: true, marca: '', modelo: '', custo: null, unitario: null };
      });
      Dados.salvar();
      if (!silencioso || preservados) aviso(l.length + ' item(ns) carregados do PNCP.' + (preservados ? ' ' + preservados + ' item(ns) já orçados foram mantidos: confira à mão.' : ''));
      if (App.rota().tela === 'cadastrar') App.redesenhar();
    } catch (err) { aviso('Falha ao carregar itens do PNCP: ' + err.message, 'erro'); }
  }

  async function novaManual() {
    const emp = Dados.empresaAtiva();
    if (!emp) { aviso('Cadastre um cliente antes.', 'erro'); return; }
    const f = await modal({
      titulo: 'Cadastrar proposta',
      corpo: campo('Licitação no PNCP', '<input name="ref" placeholder="Link do PNCP, nº de controle ou CNPJ ANO SEQUENCIAL">', 'Ex.: https://pncp.gov.br/app/editais/08829974003886/2026/27. Deixe em branco para uma proposta sem PNCP (preencha os itens à mão).') +
        '<div class="linha">' + campo('Portal', '<select name="portal">' + opcoes(PORTAIS) + '</select>') + campo('Nº da licitação', '<input name="numero">') + '</div>' + campo('Órgão', '<input name="orgao">') + campo('Objeto', '<textarea name="objeto" rows="2"></textarea>')
    });
    if (!f) return;
    const ref = PNCP.lerReferencia(f.get('ref'));
    if (f.get('ref') && !ref) { aviso('Não reconheci a referência do PNCP.', 'erro'); return; }
    if (ref) {
      try { const c = await PNCP.compra(ref.cnpj, ref.ano, ref.seq); if (c) { Dados.e.avisos[c.id] = Dados.e.avisos[c.id] || Object.assign({}, c, { perfis: [], produtos: [], lido: true, favorito: false, lixeira: false, anotacoes: [], capturadoEm: new Date().toISOString() }); return novaDeAviso(c); } }
      catch (err) { aviso('Licitação não encontrada no PNCP: ' + err.message, 'erro'); return; }
    }
    const p = { id: Dados.id('ppt'), empresaId: emp.id, ref: null, objeto: f.get('objeto'), orgao: f.get('orgao'), numero: f.get('numero'), portal: f.get('portal'), itens: [], status: 'rascunho', criadaEm: new Date().toISOString(), declaracoes: {}, validade: 60, impostos: 0, margem: 0 };
    e().propostas.unshift(p); Dados.salvar(); location.hash = '#/cadastrar/proposta/' + p.id;
  }

  function telaPropostas(el) {
    const l = daEmpresa(e().propostas);
    el.innerHTML = '<div class="barra-acoes"><p class="mudo">Propostas do cliente ativo. O envio ao portal é feito no próprio portal; aqui você prepara itens, preços, declarações e anexos, e registra o status do envio.</p><button class="btn primario" data-a="nova">+ Cadastrar proposta</button></div>' +
      (l.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Licitação</th><th>Portal</th><th>Prazo</th><th class="n">Itens</th><th class="n">Total</th><th>Status</th><th>Seven Sniper</th></tr></thead><tbody>' +
        l.map(function (p) {
          const fim = p.encerramento && new Date(p.encerramento);
          return '<tr class="clicavel" data-id="' + p.id + '"><td><b>' + esc((p.modalidade || '') + ' ' + (p.numero || '')) + '</b><br><span class="mini">' + esc(p.orgao) + '</span><br><span class="mini mudo">' + esc(String(p.objeto || '').slice(0, 120)) + '</span></td><td>' + esc(p.portal) + '</td><td class="' + (fim && fim - Date.now() < 2 * 86400000 && fim > Date.now() ? 'alerta' : '') + '">' + dataHora(p.encerramento) + (fim ? '<br><small>' + emQuanto(p.encerramento) + '</small>' : '') + '</td><td class="n">' + p.itens.filter(function (i) { return i.participar !== false; }).length + '/' + p.itens.length + '</td><td class="n">' + moeda(totalProposta(p)) + '</td><td><span class="tag st-' + p.status + '">' + STATUS[p.status] + '</span></td><td>' + (p.disputar ? '⚡ Sim' : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : UI.vazio('Nenhuma proposta', 'Envie um aviso do Seven Radar para o Seven Bid, ou cadastre a partir do link do PNCP.', '<button class="btn primario" data-a="nova">+ Cadastrar proposta</button>'));
    el.onclick = function (ev) {
      if (ev.target.closest('[data-a=nova]')) return novaManual();
      const tr = ev.target.closest('tr[data-id]'); if (tr) location.hash = '#/cadastrar/proposta/' + tr.dataset.id;
    };
  }

  function telaProposta(el, id) {
    const p = e().propostas.find(function (x) { return x.id === id; });
    if (!p) { el.innerHTML = UI.vazio('Proposta não encontrada', '', '<a class="btn" href="#/cadastrar">Voltar</a>'); return; }
    editando = p;
    const emp = Dados.empresa(p.empresaId);
    const docs = e().documentos.filter(function (d) { return d.empresaId === p.empresaId; });
    const ref = p.itens.filter(function (i) { return i.refUnitaria; }).length;
    const acima = p.itens.filter(function (i) { return i.participar !== false && i.unitario && i.refUnitaria && i.unitario > i.refUnitaria; }).length;
    el.innerHTML = '<p><a href="#/cadastrar">← Minhas propostas</a></p>' +
      '<section class="cartao"><header><h2>' + esc((p.modalidade || '') + ' ' + (p.numero || '')) + ' · ' + esc(p.orgao || '') + '</h2><span class="tag st-' + p.status + '">' + STATUS[p.status] + '</span></header>' +
      '<p>' + esc(p.objeto || '') + '</p><p class="mini">Cliente: <b>' + esc(emp ? emp.razao + ' · CNPJ ' + cnpj(emp.cnpj) : '—') + '</b> · Propostas até <b>' + dataHora(p.encerramento) + '</b>' + (p.edital ? ' · <a href="' + esc(UI.url(p.edital)) + '" target="_blank" rel="noopener">Edital ↗</a>' : '') + (p.linkOrigem ? ' · <a href="' + esc(UI.url(p.linkOrigem)) + '" target="_blank" rel="noopener">Portal ↗</a>' : '') + '</p>' +
      '<form id="cab" class="linha">' + campo('Portal', '<select name="portal">' + opcoes(PORTAIS, p.portal) + '</select>') + campo('Validade da proposta (dias)', '<input name="validade" inputmode="numeric" value="' + esc(p.validade) + '">') + campo('Prazo de entrega', '<input name="prazoEntrega" value="' + esc(p.prazoEntrega || '') + '" placeholder="conforme edital">') +
      campo('Impostos % (para preço sugerido)', '<input name="impostos" inputmode="decimal" value="' + esc(String(p.impostos || 0).replace('.', ',')) + '">') + campo('Margem % mínima', '<input name="margem" inputmode="decimal" value="' + esc(String(p.margem || 0).replace('.', ',')) + '">') + '</form></section>' +
      '<div class="barra-acoes"><div class="grupo-botoes">' + (p.ref ? '<button class="btn" data-a="carregar">' + (p.itens.length ? 'Importar itens do portal (atualizar)' : 'Carregar itens') + '</button>' : '') + '<button class="btn fantasma" data-a="add-item">+ Item manual</button>' +
      (ref ? '<button class="btn fantasma" data-a="usar-ref">Usar todos os valores de referência</button>' : '') + '<button class="btn fantasma" data-a="sugerido">Aplicar preço sugerido</button>' +
      '<button class="btn fantasma" data-a="exportar">Exportar planilha</button><button class="btn fantasma" data-a="importar">Importar planilha</button></div>' +
      '<b>Total: ' + moeda(totalProposta(p)) + '</b></div>' +
      (acima ? '<p class="alerta mini">' + acima + ' item(ns) com valor acima da referência do órgão. Pode levar à desclassificação; confira o edital.</p>' : '') +
      (p.itens.length ? '<div class="tabela-rolagem"><table class="tabela itens-proposta" id="itens"><thead><tr><th>Part.</th><th>Item</th><th>Descrição</th><th class="n">Qtd</th><th>Un.</th><th class="n">Ref. unit.</th><th>Marca / fabricante</th><th>Modelo / versão</th><th class="n">Custo unit.</th><th class="n">Valor unit.</th><th class="n">Total</th><th></th></tr></thead><tbody>' +
        p.itens.map(function (i, k) {
          const caro = i.unitario && i.refUnitaria && i.unitario > i.refUnitaria;
          const margem = i.custo && i.unitario ? (i.unitario - i.custo) / i.unitario : null;
          return '<tr data-k="' + k + '" class="' + (i.participar === false ? 'inativo' : '') + '"><td><input type="checkbox" data-c="participar"' + (i.participar !== false ? ' checked' : '') + ' aria-label="Participar do item"></td><td>' + esc(i.numero) + (i.meEpp ? '<br><span class="tag ouro mini">' + esc(i.meEpp) + '</span>' : '') + (i.margemPref ? '<br><span class="tag laranja mini" title="Item com margem de preferência: preencher no portal">MP</span>' : '') + '</td>' +
            '<td class="desc"><textarea data-c="descricao" rows="2">' + esc(i.descricao) + '</textarea></td><td class="n"><input data-c="quantidade" inputmode="decimal" value="' + esc(num(i.quantidade, null)) + '"></td><td><input data-c="unidade" class="curto" value="' + esc(i.unidade || '') + '"></td>' +
            '<td class="n">' + (i.refUnitaria ? moeda(i.refUnitaria) : '—') + '</td><td><input data-c="marca" value="' + esc(i.marca || '') + '" list="lista-marcas"></td><td><input data-c="modelo" value="' + esc(i.modelo || '') + '"></td>' +
            '<td class="n"><input data-c="custo" inputmode="decimal" value="' + (i.custo != null ? esc(String(Nucleo.arredondar(i.custo, 4)).replace('.', ',')) : '') + '"></td><td class="n"><input data-c="unitario" inputmode="decimal" class="' + (caro ? 'erro' : '') + '" value="' + (i.unitario != null ? esc(String(i.unitario).replace('.', ',')) : '') + '"></td>' +
            '<td class="n">' + moeda(totalItem(i)) + (margem != null ? '<br><small class="' + (margem < (p.margem || 0) / 100 ? 'alerta' : 'mudo') + '">margem ' + UI.pct(margem) + '</small>' : '') + '</td><td><button class="btn mini fantasma" data-a="produto" title="Preencher com um produto de Meus Produtos">▤</button></td></tr>';
        }).join('') + '</tbody></table><datalist id="lista-marcas">' + unicos(e().produtos.map(function (x) { return x.marca; })).map(function (m) { return '<option value="' + esc(m) + '">'; }).join('') + '</datalist></div>' : UI.vazio('Sem itens', p.ref ? 'Clique em <b>Carregar itens</b> para trazer os itens publicados no PNCP.' : 'Adicione itens à mão ou importe uma planilha.')) +
      '<div class="cartoes">' +
      '<section class="cartao"><h3>Termos e declarações</h3><form id="decl">' + [['integridade', 'Programa de integridade (resposta registrada)'], ['meepp', 'Enquadramento ME/EPP (art. 4º da Lei 14.133 / LC 123)'], ['menor', 'Não emprega menor (art. 7º, XXXIII, CF)'], ['inexistencia', 'Inexistência de fato impeditivo'], ['reserva', 'Cumpre reserva de cargos para PcD e reabilitados'], ['trabalho', 'Não utiliza trabalho degradante ou forçado'], ['proposta', 'Proposta compatível com o edital e custos incluídos']].map(function (d) { return '<label class="check"><input type="checkbox" name="' + d[0] + '"' + (p.declaracoes[d[0]] ? ' checked' : '') + '> ' + d[1] + '</label>'; }).join('') + '</form><p class="mini mudo">Marque depois de conferir no portal. Declaração de porte vem do cadastro no portal.</p></section>' +
      '<section class="cartao"><h3>Documentos anexos</h3>' + (docs.length ? '<form id="docs">' + docs.map(function (d) { const s = Nucleo.statusDocumento(d.validade); return '<label class="check"><input type="checkbox" name="doc" value="' + d.id + '"' + ((p.documentos || []).indexOf(d.id) >= 0 ? ' checked' : '') + '> ' + esc(d.nome) + ' <span class="tag st-doc-' + s.codigo + '">' + esc(s.rotulo) + '</span></label>'; }).join('') + '</form>' : '<p class="mudo">Nenhum documento do cliente. <a href="#/cadastrar/documentos">Cadastrar documentos</a></p>') + '</section>' +
      '<section class="cartao"><h3>Envio e próximos passos</h3><p class="mini">' + (p.enviadaEm ? 'Enviada em ' + dataHora(p.enviadaEm) + (p.protocolo ? ' · protocolo ' + esc(p.protocolo) : '') : 'Ainda não registrada como enviada.') + '</p>' +
      '<div class="grupo-botoes vertical"><button class="btn" data-a="pronta">Marcar como pronta</button><button class="btn primario" data-a="enviada">Registrar envio no portal</button><button class="btn" data-a="erro">Registrar erro no envio</button>' +
      '<label class="check"><input type="checkbox" data-a="disputar"' + (p.disputar ? ' checked' : '') + '> Enviar ao Seven Sniper</label>' +
      '<button class="btn fantasma" data-a="imprimir">Imprimir proposta</button><button class="btn fantasma" data-a="readequar">Proposta atualizada (pós-lances)</button>' +
      '<button class="btn fantasma" data-a="monitorar">Adicionar ao Seven Watch</button><button class="btn fantasma" data-a="quadro">Criar cartão no Quadro</button><button class="btn fantasma perigo" data-a="excluir">Excluir proposta</button></div></section></div>';

    el.insertAdjacentHTML('beforeend', Telas.oport.secao(Telas.oport.chaveProposta(p), 'cadastrar'));
    el.querySelector('#cab').oninput = function () { const fd = new FormData(this); p.portal = fd.get('portal'); p.validade = fd.get('validade'); p.prazoEntrega = fd.get('prazoEntrega'); p.impostos = Nucleo.lerNumeroBR(fd.get('impostos')) || 0; p.margem = Nucleo.lerNumeroBR(fd.get('margem')) || 0; Dados.salvar(); };
    const decl = el.querySelector('#decl'); decl.onchange = function () { const fd = new FormData(decl); p.declaracoes = {}; Array.prototype.forEach.call(decl.elements, function (x) { p.declaracoes[x.name] = !!fd.get(x.name); }); Dados.salvar(); };
    const fdocs = el.querySelector('#docs'); if (fdocs) fdocs.onchange = function () { p.documentos = new FormData(fdocs).getAll('doc'); Dados.salvar(); };
    const tab = el.querySelector('#itens');
    if (tab) tab.onchange = function (ev) {
      const c = ev.target.dataset.c; if (!c) return;
      const i = p.itens[ev.target.closest('tr').dataset.k];
      if (c === 'participar') i.participar = ev.target.checked;
      else if (c === 'quantidade' || c === 'custo' || c === 'unitario') { const v = Nucleo.lerNumeroBR(ev.target.value); i[c] = isFinite(v) ? Nucleo.arredondar(v, 4) : null; }
      else i[c] = ev.target.value;
      Dados.salvar(); App.redesenhar();
    };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'carregar') { b.disabled = true; await carregarItens(p); return; }
      if (a === 'add-item') p.itens.push({ numero: p.itens.length + 1, descricao: '', quantidade: 1, unidade: 'UN', participar: true });
      if (a === 'usar-ref' && await confirmar('Usar valores de referência', 'Isso <b>sobrescreve</b> o valor unitário de todos os itens com referência. Continuar?')) p.itens.forEach(function (i) { if (i.refUnitaria) i.unitario = i.refUnitaria; });
      if (a === 'sugerido') {
        let n = 0; p.itens.forEach(function (i) { if (i.custo) { i.unitario = Nucleo.arredondarCima(Nucleo.precoSugerido(i.custo, p.impostos, p.margem, 0), 2); n++; } });
        aviso(n ? n + ' item(ns) com preço = custo ÷ (1 − impostos − margem).' : 'Preencha o custo unitário dos itens primeiro.', n ? '' : 'erro');
      }
      if (a === 'exportar') exportarPlanilha(p);
      if (a === 'importar') { await importarPlanilha(p); }
      if (a === 'produto') { await aplicarProduto(p.itens[b.closest('tr').dataset.k]); }
      if (a === 'pronta') { const falta = p.itens.filter(function (i) { return i.participar !== false && !i.unitario; }).length; if (falta) { aviso(falta + ' item(ns) marcados para participar estão sem valor.', 'erro'); return; } p.status = 'pronta'; }
      if (a === 'enviada' || a === 'erro') {
        const f = await modal({ titulo: a === 'enviada' ? 'Registrar envio no portal' : 'Registrar erro no envio', corpo: campo('Data e hora', '<input type="datetime-local" name="quando" value="' + new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) + '">') + campo(a === 'enviada' ? 'Protocolo / comprovante' : 'Motivo informado pelo portal', '<input name="info">') });
        if (!f) return;
        p.status = a; if (a === 'enviada') { p.enviadaEm = f.get('quando'); p.protocolo = f.get('info'); } else p.erroEnvio = f.get('info');
        if (a === 'enviada') aviso('Envio registrado. Confira no portal se a proposta aparece como cadastrada.');
      }
      if (a === 'disputar') { p.disputar = b.checked; if (p.disputar) Telas.disputar.deProposta(p); }
      if (a === 'imprimir') { imprimir(p, false); return; }
      if (a === 'readequar') { await readequar(p); }
      if (a === 'monitorar') { const av = e().avisos[p.avisoId]; Telas.monitorar.adicionar(av || { id: p.id, objeto: p.objeto, orgao: p.orgao, numero: p.numero, modalidade: p.modalidade, edital: p.edital, linkOrigem: p.linkOrigem, encerramento: p.encerramento }, p.portal); }
      if (a === 'quadro') { const av = e().avisos[p.avisoId]; if (av) Telas.quadros.cartaoDeAviso(av); else aviso('Proposta sem licitação do PNCP vinculada.', 'erro'); }
      if (a === 'excluir' && await confirmar('Excluir proposta', 'Excluir esta proposta?', 'Excluir')) { e().propostas = e().propostas.filter(function (x) { return x !== p; }); Dados.salvar(); location.hash = '#/cadastrar'; return; }
      Dados.salvar(); App.redesenhar();
    };
  }

  function unicos(l) { return l.filter(function (x, i) { return x && l.indexOf(x) === i; }); }

  async function aplicarProduto(item) {
    const ps = daEmpresa(e().produtos);
    if (!ps.length) { aviso('Cadastre produtos em Meus Produtos.', 'erro'); return; }
    const sug = ps.map(function (p) { return { p: p, s: Nucleo.produtosQueCasam(item.descricao, [{ oQueVendo: p.descricao.split(' ').slice(0, 2).join(' ') }]).length }; }).sort(function (a, b) { return b.s - a.s; });
    const f = await modal({ titulo: 'Preencher com produto', corpo: '<p class="mini">' + esc(item.descricao) + '</p>' + campo('Produto', '<select name="p">' + opcoes(sug.map(function (x) { return { v: x.p.id, t: x.p.descricao + ' · ' + (x.p.marca || '') + ' ' + (x.p.modelo || '') }; })) + '</select>') });
    if (!f) return;
    const p = ps.find(function (x) { return x.id === f.get('p'); });
    item.marca = p.marca; item.modelo = p.modelo; item.custo = p.custo; if (p.preco) item.unitario = p.preco;
  }

  function exportarPlanilha(p) {
    const linhas = [['Item', 'Descrição', 'Quantidade', 'Unidade', 'Ref. unitária', 'Participar (S/N)', 'Marca', 'Modelo', 'Custo unitário', 'Valor unitário']].concat(
      p.itens.map(function (i) { return [i.numero, i.descricao, i.quantidade, i.unidade, i.refUnitaria, i.participar === false ? 'N' : 'S', i.marca, i.modelo, i.custo, i.unitario]; }));
    UI.baixar('proposta-' + (p.numero || p.id) + '.csv', '﻿' + Nucleo.paraCSV(linhas), 'text/csv;charset=utf-8');
    aviso('Planilha exportada (CSV, separador ";"). No Excel, mantenha 2 casas decimais: =ARRED(célula;2).');
  }

  async function importarPlanilha(p) {
    const f = await UI.escolherArquivo('.csv,text/csv'); if (!f) return;
    const linhas = Nucleo.lerCSV(await UI.lerArquivoTexto(f));
    if (linhas.length < 2) { aviso('Planilha vazia.', 'erro'); return; }
    const cab = linhas[0].map(Nucleo.normalizar);
    const col = function (nome) { return cab.findIndex(function (c) { return c.indexOf(nome) === 0; }); };
    const ci = { item: col('item'), desc: col('descricao'), qtd: col('quantidade'), un: col('unidade'), part: col('participar'), marca: col('marca'), modelo: col('modelo'), custo: col('custo'), valor: col('valor unitario') };
    if (ci.item < 0) { aviso('A planilha precisa da coluna "Item". Exporte o modelo primeiro.', 'erro'); return; }
    let n = 0;
    linhas.slice(1).forEach(function (l) {
      const numero = l[ci.item]; let it = p.itens.find(function (i) { return String(i.numero) === String(numero).trim(); });
      if (!it) { it = { numero: numero, participar: true }; p.itens.push(it); }
      if (ci.desc >= 0 && l[ci.desc]) it.descricao = l[ci.desc];
      if (ci.qtd >= 0 && l[ci.qtd]) it.quantidade = Nucleo.lerNumeroBR(l[ci.qtd]);
      if (ci.un >= 0 && l[ci.un]) it.unidade = l[ci.un];
      if (ci.part >= 0) it.participar = !/^n/i.test(l[ci.part] || 'S');
      if (ci.marca >= 0) it.marca = l[ci.marca]; if (ci.modelo >= 0) it.modelo = l[ci.modelo];
      if (ci.custo >= 0 && l[ci.custo]) it.custo = Nucleo.arredondar(Nucleo.lerNumeroBR(l[ci.custo]), 4);
      if (ci.valor >= 0 && l[ci.valor]) it.unitario = Nucleo.arredondar(Nucleo.lerNumeroBR(l[ci.valor]), 2);
      n++;
    });
    aviso(n + ' linha(s) importadas.');
  }

  // Redistribui os valores para o total bater com o lance vencedor (processo por lote).
  async function readequar(p) {
    const itens = p.itens.filter(function (i) { return i.participar !== false && i.unitario; });
    if (!itens.length) { aviso('Sem itens com valor.', 'erro'); return; }
    const f = await modal({
      titulo: 'Proposta atualizada (pós-lances)',
      corpo: '<p class="mini">Total atual: <b>' + moeda(totalProposta(p)) + '</b>. Informe o valor do lance vencedor do lote; os valores unitários serão reduzidos na mesma proporção (2 casas), com o ajuste de centavos no último item.</p>' + campo('Valor final do lance (R$)', '<input name="v" inputmode="decimal" required>') +
        '<label class="check"><input type="checkbox" name="imprimir" checked> Imprimir em seguida</label>'
    });
    if (!f) return;
    const alvo = Nucleo.lerNumeroBR(f.get('v')); const atual = totalProposta(p);
    if (!(alvo > 0) || alvo > atual) { aviso('O valor final precisa ser positivo e menor ou igual ao total atual.', 'erro'); return; }
    const fator = alvo / atual; let soma = 0;
    itens.forEach(function (i, k) {
      if (k < itens.length - 1) { i.unitario = Nucleo.arredondarBaixo(i.unitario * fator, 2); soma += totalItem(i); }
      else { i.unitario = Nucleo.arredondarBaixo((alvo - soma) / i.quantidade, 2); }
    });
    p.status = 'vencida'; p.lanceFinal = alvo;
    const dif = alvo - totalProposta(p);
    aviso('Valores readequados. Total: ' + moeda(totalProposta(p)) + (Math.abs(dif) > 0.001 ? ' (diferença de ' + moeda(dif) + ' por arredondamento; ajuste à mão se o portal exigir valor exato)' : ''));
    Dados.salvar();
    if (f.get('imprimir')) imprimir(p, true);
  }

  function imprimir(p, atualizada) {
    const emp = Dados.empresa(p.empresaId) || {};
    const itens = p.itens.filter(function (i) { return i.participar !== false; });
    const w = window.open('', '_blank');
    if (!w) { aviso('Permita pop-ups para imprimir.', 'erro'); return; }
    w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Proposta ' + esc(p.numero || '') + '</title><style>body{font:12px/1.45 Arial,sans-serif;color:#111;margin:28px}h1{font-size:16px;margin:0 0 4px}h2{font-size:13px;margin:18px 0 6px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:4px 6px;vertical-align:top}th{background:#eee}td.n{text-align:right;white-space:nowrap}.ass{margin-top:60px;text-align:center}.mini{font-size:11px;color:#444}@media print{button{display:none}}</style></head><body>' +
      '<button onclick="print()">Imprimir / salvar PDF</button>' +
      '<h1>' + esc(emp.razao || '') + '</h1><div class="mini">CNPJ ' + esc(cnpj(emp.cnpj)) + ' · ' + esc((emp.municipio ? emp.municipio + '-' : '') + (emp.uf || '')) + (emp.representante ? ' · Representante: ' + esc(emp.representante) : '') + '</div>' +
      '<h2>' + (atualizada ? 'PROPOSTA COMERCIAL ATUALIZADA' : 'PROPOSTA COMERCIAL') + '</h2>' +
      '<p>Ao(À) ' + esc(p.orgao || '') + '<br>' + esc((p.modalidade || '') + ' nº ' + (p.numero || '')) + (p.processo ? ' · Processo ' + esc(p.processo) : '') + '<br>Objeto: ' + esc(p.objeto || '') + '</p>' +
      '<table><thead><tr><th>Item</th><th>Descrição</th><th>Marca</th><th>Modelo</th><th>Un.</th><th>Qtd</th><th>Valor unit.</th><th>Valor total</th></tr></thead><tbody>' +
      itens.map(function (i) { return '<tr><td>' + esc(i.numero) + '</td><td>' + esc(i.descricao) + '</td><td>' + esc(i.marca || '') + '</td><td>' + esc(i.modelo || '') + '</td><td>' + esc(i.unidade || '') + '</td><td class="n">' + num(i.quantidade) + '</td><td class="n">' + moeda(i.unitario) + '</td><td class="n">' + moeda(totalItem(i)) + '</td></tr>'; }).join('') +
      '<tr><th colspan="7" style="text-align:right">TOTAL</th><th class="n">' + moeda(totalProposta(p)) + '</th></tr></tbody></table>' +
      '<p>Validade da proposta: ' + esc(p.validade || 60) + ' dias. Prazo de entrega: ' + esc(p.prazoEntrega || 'conforme edital') + '.<br>Declaramos que nos preços estão incluídos todos os custos, tributos, encargos, fretes e demais despesas necessárias ao fornecimento.</p>' +
      '<p>' + esc(emp.municipio || '') + ', ' + new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) + '.</p>' +
      '<div class="ass">______________________________________<br>' + esc(emp.representante || 'Representante legal') + '<br>' + esc(emp.razao || '') + '</div></body></html>');
    w.document.close();
  }

  // ---------- documentos ----------
  function telaDocumentos(el) {
    const emp = Dados.empresaAtiva();
    if (!emp) { el.innerHTML = UI.vazio('Sem cliente', 'Cadastre um cliente para guardar documentos.', '<a class="btn primario" href="#/empresas">Cadastrar cliente</a>'); return; }
    const l = e().documentos.filter(function (d) { return d.empresaId === emp.id; }).sort(function (a, b) { return (a.validade || '9999') < (b.validade || '9999') ? -1 : 1; });
    el.innerHTML = '<div class="barra-acoes"><p class="mudo">Documentos de <b>' + esc(emp.fantasia || emp.razao) + '</b>. Aviso 7 dias antes do vencimento. Diferente da referência, nada é apagado sozinho: o vencido fica marcado.</p><button class="btn primario" data-a="novo">+ Adicionar documentos</button></div>' +
      '<p class="mini">Emitir certidões: ' + LINKS_CERTIDOES.map(function (x) { return '<a href="' + x.u + '" target="_blank" rel="noopener">' + esc(x.t) + ' ↗</a>'; }).join(' · ') + ' · <a href="#/habilitacao"><b>Todos os estados e municípios →</b></a></p>' +
      (l.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Documento</th><th>Tipo</th><th>Número</th><th>Órgão expedidor</th><th>Emissão</th><th>Validade</th><th>Status</th><th></th></tr></thead><tbody>' +
        l.map(function (d) { const s = Nucleo.statusDocumento(d.validade); return '<tr data-id="' + d.id + '"><td><b>' + esc(d.nome) + '</b>' + (d.arquivo ? '<br><a href="#" data-a="abrir" class="mini">' + esc(d.arquivo.nome) + '</a>' : '') + '</td><td>' + esc(d.tipo) + '</td><td>' + esc(d.numero || '') + '</td><td>' + esc(d.orgao || '') + '</td><td>' + data(d.emissao) + '</td><td>' + data(d.validade) + '</td><td><span class="tag st-doc-' + s.codigo + '">' + esc(s.rotulo) + '</span></td><td class="acoes"><button class="btn mini fantasma" data-a="editar">Editar</button><button class="btn mini fantasma" data-a="substituir">Nova versão</button><button class="btn mini fantasma perigo" data-a="excluir">×</button></td></tr>'; }).join('') + '</tbody></table></div>'
        : UI.vazio('Nenhum documento', 'Adicione certidões, contrato social, atestados e balanço. Até 10 arquivos por vez.', '<button class="btn primario" data-a="novo">+ Adicionar documentos</button>'));
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return; ev.preventDefault();
      const tr = b.closest('tr[data-id]'); const d = tr && e().documentos.find(function (x) { return x.id === tr.dataset.id; });
      if (b.dataset.a === 'novo') {
        const fs = await UI.escolherArquivo('', true); if (!fs || !fs.length) return;
        if (fs.length > 10) { aviso('Até 10 arquivos por vez.', 'erro'); return; }
        for (const f of fs) {
          if (f.size > 100 * 1024 * 1024) { aviso(f.name + ': acima de 100 MB.', 'erro'); continue; }
          const meta = await formDocumento({ nome: f.name.replace(/\.[^.]+$/, ''), tipo: 'Habilitação' }, f.name);
          if (!meta) continue;
          const id = Dados.id('doc'); await Dados.guardarArquivo(id, f);
          e().documentos.push(Object.assign({ id: id, empresaId: emp.id, arquivo: { nome: f.name, tamanho: f.size, tipo: f.type }, criadoEm: new Date().toISOString() }, meta));
          Dados.salvar();
        }
      }
      if (b.dataset.a === 'editar') { const m = await formDocumento(d); if (m) Object.assign(d, m); }
      if (b.dataset.a === 'substituir') { const f = await UI.escolherArquivo(''); if (!f) return; const m = await formDocumento(Object.assign({}, d, { emissao: '', validade: '' }), f.name); if (!m) return; await Dados.guardarArquivo(d.id, f); Object.assign(d, m, { arquivo: { nome: f.name, tamanho: f.size, tipo: f.type } }); }
      if (b.dataset.a === 'abrir') { const blob = await Dados.lerArquivo(d.id); if (blob) UI.abrirArquivo(blob, (d.arquivo || {}).nome || d.nome); else aviso('Arquivo não está neste navegador.', 'erro'); return; }
      if (b.dataset.a === 'excluir' && await confirmar('Excluir documento', 'Excluir <b>' + esc(d.nome) + '</b>?', 'Excluir')) { await Dados.apagarArquivo(d.id); e().documentos = e().documentos.filter(function (x) { return x !== d; }); }
      Dados.salvar(); App.redesenhar();
    };
  }

  async function formDocumento(d, arquivo) {
    const f = await modal({
      titulo: arquivo ? 'Documento: ' + arquivo : 'Editar documento',
      corpo: campo('Nome *', '<input name="nome" required value="' + esc(d.nome || '') + '" list="nomes-doc"><datalist id="nomes-doc">' + ['CND Federal', 'CRF FGTS', 'CNDT', 'Certidão Estadual', 'Certidão Municipal', 'Certidão de Falência', 'Contrato Social', 'Balanço Patrimonial', 'Atestado de Capacidade Técnica', 'Alvará', 'SICAF'].map(function (x) { return '<option value="' + x + '">'; }).join('') + '</datalist>') +
        '<div class="linha">' + campo('Tipo', '<select name="tipo">' + opcoes(['Habilitação', 'Técnico', 'Outros'], d.tipo) + '</select>') + campo('Número', '<input name="numero" value="' + esc(d.numero || '') + '">') + campo('Órgão expedidor', '<input name="orgao" value="' + esc(d.orgao || '') + '">') + '</div>' +
        '<div class="linha">' + campo('Emissão', '<input type="date" name="emissao" value="' + esc(d.emissao || '') + '">') + campo('Validade', '<input type="date" name="validade" value="' + esc(d.validade || '') + '">', 'Em branco para documento sem validade.') + '</div>'
    });
    return f ? { nome: f.get('nome'), tipo: f.get('tipo'), numero: f.get('numero'), orgao: f.get('orgao'), emissao: f.get('emissao'), validade: f.get('validade') } : null;
  }

  // ---------- produtos ----------
  function telaProdutos(el) {
    const l = daEmpresa(e().produtos);
    el.innerHTML = '<div class="barra-acoes"><p class="mudo">Produtos do cliente para reaproveitar nas propostas (marca, modelo, custo).</p><div class="grupo-botoes"><button class="btn fantasma" data-a="importar">Importar CSV</button><button class="btn primario" data-a="novo">+ Produto</button></div></div>' +
      (l.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Descrição</th><th>Marca</th><th>Modelo</th><th>Un.</th><th class="n">Custo</th><th class="n">Preço padrão</th><th></th></tr></thead><tbody>' +
        l.map(function (p) { return '<tr data-id="' + p.id + '"><td>' + esc(p.descricao) + '</td><td>' + esc(p.marca || '') + '</td><td>' + esc(p.modelo || '') + '</td><td>' + esc(p.unidade || '') + '</td><td class="n">' + moeda(p.custo) + '</td><td class="n">' + moeda(p.preco) + '</td><td class="acoes"><button class="btn mini fantasma" data-a="editar">Editar</button><button class="btn mini fantasma perigo" data-a="excluir">×</button></td></tr>'; }).join('') + '</tbody></table></div>'
        : UI.vazio('Nenhum produto', 'Cadastre os produtos do cliente ou importe um CSV com colunas Descrição; Marca; Modelo; Unidade; Custo; Preço.'));
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      const tr = b.closest('tr[data-id]'); const p = tr && e().produtos.find(function (x) { return x.id === tr.dataset.id; });
      if (b.dataset.a === 'novo' || b.dataset.a === 'editar') {
        const x = p || {};
        const f = await modal({ titulo: p ? 'Editar produto' : 'Novo produto', corpo: campo('Descrição *', '<input name="descricao" required value="' + esc(x.descricao || '') + '">') + '<div class="linha">' + campo('Marca / fabricante', '<input name="marca" value="' + esc(x.marca || '') + '">') + campo('Modelo / versão', '<input name="modelo" value="' + esc(x.modelo || '') + '">') + campo('Unidade', '<input name="unidade" value="' + esc(x.unidade || 'UN') + '">') + '</div><div class="linha">' + campo('Custo unitário', '<input name="custo" inputmode="decimal" value="' + esc(x.custo != null ? String(x.custo).replace('.', ',') : '') + '">') + campo('Preço padrão', '<input name="preco" inputmode="decimal" value="' + esc(x.preco != null ? String(x.preco).replace('.', ',') : '') + '">') + '</div>' + campo('Ficha técnica / observações', '<textarea name="obs" rows="3">' + esc(x.obs || '') + '</textarea>') });
        if (!f) return;
        const d = { descricao: f.get('descricao'), marca: f.get('marca'), modelo: f.get('modelo'), unidade: f.get('unidade'), custo: f.get('custo') ? Nucleo.lerNumeroBR(f.get('custo')) : null, preco: f.get('preco') ? Nucleo.lerNumeroBR(f.get('preco')) : null, obs: f.get('obs') };
        if (p) Object.assign(p, d); else e().produtos.push(Object.assign({ id: Dados.id('pd'), empresaId: Dados.e.empresaAtiva }, d));
      }
      if (b.dataset.a === 'excluir' && await confirmar('Excluir produto', 'Excluir <b>' + esc(p.descricao) + '</b>?', 'Excluir')) e().produtos = e().produtos.filter(function (x) { return x !== p; });
      if (b.dataset.a === 'importar') {
        const f = await UI.escolherArquivo('.csv,text/csv'); if (!f) return;
        const linhas = Nucleo.lerCSV(await UI.lerArquivoTexto(f)); const cab = (linhas[0] || []).map(Nucleo.normalizar);
        const c = function (n) { return cab.findIndex(function (x) { return x.indexOf(n) === 0; }); };
        const ci = { d: c('descricao'), m: c('marca'), mo: c('modelo'), u: c('unidade'), c: c('custo'), p: c('preco') };
        if (ci.d < 0) { aviso('Falta a coluna "Descrição".', 'erro'); return; }
        linhas.slice(1).forEach(function (l) { if (l[ci.d]) e().produtos.push({ id: Dados.id('pd'), empresaId: Dados.e.empresaAtiva, descricao: l[ci.d], marca: l[ci.m] || '', modelo: l[ci.mo] || '', unidade: l[ci.u] || '', custo: ci.c >= 0 && l[ci.c] ? Nucleo.lerNumeroBR(l[ci.c]) : null, preco: ci.p >= 0 && l[ci.p] ? Nucleo.lerNumeroBR(l[ci.p]) : null }); });
        aviso((linhas.length - 1) + ' produto(s) importados.');
      }
      Dados.salvar(); App.redesenhar();
    };
  }

  Telas.cadastrar = {
    titulo: 'Seven Bid',
    render: function (el, sub, param) {
      sub = sub || 'propostas';
      const docs = Dados.empresaAtiva() ? e().documentos.filter(function (d) { return d.empresaId === Dados.empresaAtiva().id && d.validade && Nucleo.statusDocumento(d.validade).codigo !== 'valido'; }).length : 0;
      el.innerHTML = abas([{ id: 'propostas', t: 'Minhas Propostas', n: daEmpresa(e().propostas).filter(function (p) { return p.status === 'rascunho' || p.status === 'pronta'; }).length }, { id: 'documentos', t: 'Meus Documentos', n: docs }, { id: 'produtos', t: 'Meus Produtos' }], sub === 'proposta' ? 'propostas' : sub, 'cadastrar') + '<div id="aba"></div>';
      const aba = el.querySelector('#aba');
      if (sub === 'proposta') telaProposta(aba, param);
      else ({ propostas: telaPropostas, documentos: telaDocumentos, produtos: telaProdutos }[sub] || telaPropostas)(aba);
      el.onclick = null;
    },
    novaDeAviso: novaDeAviso,
    totalProposta: totalProposta,
    portalDe: portalDe
  };
})();
