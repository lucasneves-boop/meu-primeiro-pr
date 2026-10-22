/* Peças jurídicas: modelos de esclarecimento, impugnação, recurso, contrarrazões e pedidos na execução. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, dataHora, campo, opcoes, modal, confirmar, aviso, cnpj } = UI;

  const CAB = '{cidade}, {data}.\n\nAo(À) Sr(a). Agente de Contratação / Pregoeiro(a)\n{orgao}\nRef.: {modalidade} nº {numero} — Processo {processo}\nObjeto: {objeto}\n\n';
  const ASS = '\n\nNestes termos, pede deferimento.\n\n{cidade}, {data}.\n\n______________________________\n{representante}\nRepresentante legal\n{empresa} — CNPJ {cnpj}';
  const MODELOS = [
    { id: 'esclarecimento', t: 'Pedido de esclarecimento', prazo: 'Até 3 dias úteis antes da abertura do certame (art. 164 da Lei 14.133/2021).',
      campos: [['duvidas', 'Dúvidas (uma por linha)']],
      texto: CAB + 'PEDIDO DE ESCLARECIMENTO\n\n{empresa}, inscrita no CNPJ sob o nº {cnpj}, por seu representante legal, com fundamento no art. 164 da Lei nº 14.133/2021, vem, tempestivamente, solicitar os seguintes esclarecimentos sobre o edital em referência:\n\n{duvidas_numeradas}\n\nSolicita que a resposta seja divulgada no sítio oficial, nos termos do parágrafo único do art. 164, e, se alterar a formulação das propostas, que o prazo seja reaberto (art. 55, § 1º).' + ASS },
    { id: 'impugnacao', t: 'Impugnação ao edital', prazo: 'Até 3 dias úteis antes da abertura do certame (art. 164 da Lei 14.133/2021). Resposta em até 3 dias úteis, limitada ao último dia útil anterior à abertura.',
      campos: [['clausula', 'Cláusula / item impugnado'], ['fatos', 'O que o edital exige e por que é irregular'], ['fundamento', 'Fundamentação (artigos, princípios, jurisprudência)'], ['pedido', 'O que se pede (alterar, excluir, republicar)']],
      texto: CAB + 'IMPUGNAÇÃO AO EDITAL\n\n{empresa}, inscrita no CNPJ sob o nº {cnpj}, por seu representante legal, com fundamento no art. 164 da Lei nº 14.133/2021, vem, tempestivamente, apresentar IMPUGNAÇÃO ao edital em referência, pelos motivos a seguir.\n\nI — DA TEMPESTIVIDADE\nA presente impugnação é apresentada dentro do prazo de 3 (três) dias úteis anteriores à data de abertura do certame.\n\nII — DO ITEM IMPUGNADO\n{clausula}\n\nIII — DOS FATOS\n{fatos}\n\nIV — DO DIREITO\n{fundamento}\n\nA exigência restringe a competitividade, contrariando os princípios do art. 5º da Lei nº 14.133/2021, em especial os da competitividade, da isonomia e da razoabilidade.\n\nV — DO PEDIDO\nDiante do exposto, requer:\na) o recebimento e o provimento desta impugnação;\nb) {pedido};\nc) a republicação do edital com a reabertura do prazo, se a alteração afetar a formulação das propostas (art. 55, § 1º).' + ASS },
    { id: 'intencao', t: 'Intenção de recurso', prazo: 'Imediatamente após o ato (julgamento das propostas ou habilitação), na própria sessão, no prazo aberto pelo agente de contratação, sob pena de preclusão (art. 165, § 1º, I, da Lei 14.133/2021). No portal, o campo costuma aceitar texto curto: use a motivação sucinta.',
      campos: [['item', 'Item / lote'], ['decisao', 'Decisão contestada (aceitação, habilitação ou inabilitação de quem)'], ['motivo', 'Motivo em uma ou duas frases']],
      texto: 'INTENÇÃO DE RECURSO — {modalidade} nº {numero} — item/lote {item}\n\n{empresa}, CNPJ {cnpj}, manifesta intenção de recorrer contra a decisão que {decisao}, com fundamento no art. 165, I, da Lei nº 14.133/2021.\n\nMotivação sucinta: {motivo}\n\nAs razões serão apresentadas no prazo de 3 (três) dias úteis.' },
    { id: 'recurso', t: 'Recurso administrativo (razões)', prazo: '3 dias úteis da intimação ou da lavratura da ata (art. 165, I, da Lei 14.133/2021), após manifestar a intenção de recorrer de imediato, sob pena de preclusão (art. 165, § 1º, I).',
      campos: [['decisao', 'Decisão recorrida (habilitação, julgamento, item/lote)'], ['recorrida', 'Empresa beneficiada pela decisão'], ['fatos', 'Fatos'], ['fundamento', 'Fundamentação'], ['pedido', 'O que se pede']],
      texto: CAB + 'RECURSO ADMINISTRATIVO\n\n{empresa}, inscrita no CNPJ sob o nº {cnpj}, por seu representante legal, tendo manifestado a intenção de recorrer na sessão pública, vem, com fundamento no art. 165, I, da Lei nº 14.133/2021, apresentar as RAZÕES DE RECURSO contra a decisão que {decisao}, em favor de {recorrida}.\n\nI — DA TEMPESTIVIDADE\nO recurso é apresentado no prazo de 3 (três) dias úteis contado da intimação / lavratura da ata.\n\nII — DOS FATOS\n{fatos}\n\nIII — DAS RAZÕES\n{fundamento}\n\nA decisão afronta o princípio da vinculação ao edital (art. 5º da Lei nº 14.133/2021) e o julgamento objetivo.\n\nIV — DO PEDIDO\nRequer:\na) o conhecimento e o provimento do recurso;\nb) {pedido};\nc) caso a decisão não seja reconsiderada em 3 dias úteis, o encaminhamento à autoridade superior (art. 165, § 2º).' + ASS },
    { id: 'contrarrazoes', t: 'Contrarrazões de recurso', prazo: 'Mesmo prazo do recurso, contado da intimação ou da divulgação da interposição (art. 165, § 4º, da Lei 14.133/2021).',
      campos: [['recorrente', 'Empresa recorrente'], ['alegacoes', 'Resumo das alegações do recurso'], ['defesa', 'Por que a decisão deve ser mantida']],
      texto: CAB + 'CONTRARRAZÕES DE RECURSO\n\n{empresa}, inscrita no CNPJ sob o nº {cnpj}, por seu representante legal, vem, com fundamento no art. 165, § 4º, da Lei nº 14.133/2021, apresentar CONTRARRAZÕES ao recurso interposto por {recorrente}.\n\nI — DA TEMPESTIVIDADE\nAs contrarrazões são apresentadas no prazo legal.\n\nII — SÍNTESE DO RECURSO\n{alegacoes}\n\nIII — DAS RAZÕES PARA MANTER A DECISÃO\n{defesa}\n\nA decisão recorrida observou o edital e o julgamento objetivo, não havendo razão para reformá-la.\n\nIV — DO PEDIDO\nRequer o conhecimento das contrarrazões e o não provimento do recurso, mantendo-se integralmente a decisão.' + ASS },
    { id: 'reequilibrio', t: 'Pedido de reequilíbrio econômico-financeiro', prazo: 'Durante a execução, assim que o fato for conhecido. Junte notas fiscais de compra antes e depois, índices e cotações.',
      campos: [['contrato', 'Contrato / ata nº'], ['fato', 'Fato imprevisível ou de consequências incalculáveis'], ['impacto', 'Impacto nos custos (valores, % e documentos anexos)'], ['novo', 'Valores pretendidos']],
      texto: '{cidade}, {data}.\n\nAo(À) {orgao}\nRef.: Contrato / Ata nº {contrato} — {modalidade} nº {numero}\n\nPEDIDO DE REEQUILÍBRIO ECONÔMICO-FINANCEIRO\n\n{empresa}, inscrita no CNPJ sob o nº {cnpj}, contratada no instrumento em referência, vem, com fundamento no art. 124, II, "d", da Lei nº 14.133/2021, requerer o restabelecimento do equilíbrio econômico-financeiro, pelos motivos a seguir.\n\nI — DO FATO\n{fato}\n\nII — DO IMPACTO NOS CUSTOS\n{impacto}\n\nIII — DO PEDIDO\nRequer a revisão dos valores para: {novo}, com efeitos a partir do protocolo deste pedido, e a análise dos documentos anexos.' + ASS },
    { id: 'pagamento', t: 'Cobrança de pagamento em atraso', prazo: 'Após o vencimento. Atraso superior a 2 meses da emissão da nota fiscal dá direito à extinção do contrato (art. 137, § 2º, IV, da Lei 14.133/2021).',
      campos: [['contrato', 'Contrato / empenho nº'], ['notas', 'Notas fiscais em aberto (nº, emissão, valor)'], ['total', 'Valor total em atraso']],
      texto: '{cidade}, {data}.\n\nAo(À) {orgao}\nSetor financeiro / Gestor do contrato\nRef.: Contrato / Empenho nº {contrato}\n\nCOBRANÇA DE PAGAMENTO\n\n{empresa}, inscrita no CNPJ sob o nº {cnpj}, informa que os seguintes documentos fiscais, referentes a fornecimentos entregues e atestados, permanecem sem pagamento:\n\n{notas}\n\nValor total em atraso: {total}.\n\nRequer o pagamento, observada a ordem cronológica de pagamentos (art. 141 da Lei nº 14.133/2021), com atualização monetária e juros previstos no contrato, e informa que o atraso superior a 2 (dois) meses autoriza o pedido de extinção contratual (art. 137, § 2º, IV).' + ASS }
  ];

  // Categorias do menu Jurídico (a peça herda a categoria do modelo).
  const CATEGORIAS = [{ id: 'impugnacao', t: 'Impugnação', modelos: ['impugnacao'] }, { id: 'esclarecimento', t: 'Esclarecimento', modelos: ['esclarecimento'] }, { id: 'intencao', t: 'Intenção de recurso', modelos: ['intencao'] }, { id: 'recurso', t: 'Recurso', modelos: ['recurso'] }, { id: 'contrarrazoes', t: 'Contrarrazões', modelos: ['contrarrazoes'] }, { id: 'execucao', t: 'Execução do contrato', modelos: ['reequilibrio', 'pagamento'] }];
  function categoriaDe(modelo) { const c = CATEGORIAS.find(function (x) { return x.modelos.indexOf(modelo) >= 0; }); return c ? c.id : 'execucao'; }
  let filtro = { cat: '', q: '' };

  function e() { const d = Dados.e; d.pecas = d.pecas || []; return d; }

  function contexto(ref) {
    // Cliente da própria licitação (não o cliente ativo), e notas em aberto da Execução para a cobrança.
    let emp = Dados.empresaAtiva() || {};
    const reg = ref && ref.indexOf('mon:') === 0 ? (e().monitor || []).find(function (x) { return x.id === ref.slice(4); }) : ref ? ((Telas.quadros.achar(ref.split(':')[0], ref.split(':')[1]) || {}).cartao) : null;
    if (reg && reg.empresaId) emp = (Dados.e.empresas || []).find(function (x) { return x.id === reg.empresaId; }) || emp;
    const ctx = { empresa: emp.razao || '', cnpj: cnpj(emp.cnpj), representante: emp.representante || '', cidade: emp.municipio || '', data: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }), orgao: '', modalidade: '', numero: '', processo: '', objeto: '' };
    if (!ref) return ctx;
    let av = null;
    if (ref.indexOf('mon:') === 0) { const m = e().monitor.find(function (x) { return x.id === ref.slice(4); }); if (m) av = Dados.e.avisos[m.avisoId] || { orgao: m.titulo, objeto: m.objeto }; }
    else { const p = ref.split(':'); const r = Telas.quadros.achar(p[0], p[1]); if (r && r.cartao) { av = Dados.e.avisos[r.cartao.avisoId] || { orgao: (r.cartao.valores || {}).orgao, numero: (r.cartao.valores || {}).numero, objeto: r.cartao.titulo }; if (r.cartao.execucao) { const x = r.cartao.execucao; ctx.contrato = x.numero || (x.empenhos || []).map(function (y) { return y.numero; }).filter(Boolean).join(', '); const rs = Execucao.resumo(Execucao.normalizar(x)); const ab = rs.notas.filter(function (n) { return n.aberto > 0.009; }); if (ab.length) { ctx.notas = ab.map(function (n) { return 'NF ' + n.numero + ' · ' + UI.moeda(n.aberto) + (n.vencimento ? ' · vencimento ' + n.vencimento.split('-').reverse().join('/') : ''); }).join('\n'); ctx.total = UI.moeda(ab.reduce(function (s, n) { return s + n.aberto; }, 0)); } } } }
    if (av) Object.assign(ctx, { orgao: av.orgao || '', modalidade: av.modalidade || '', numero: av.numero || '', processo: av.processo || '', objeto: av.objeto || '' });
    return ctx;
  }

  function preencher(texto, v) {
    const dn = String(v.duvidas || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).map(function (s, i) { return (i + 1) + ') ' + s; }).join('\n');
    return texto.replace(/\{duvidas_numeradas\}/g, dn || '1) ').replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null && v[k] !== '' ? v[k] : '[' + k.toUpperCase() + ']'; });
  }

  async function nova(ref, cat) {
    const ctx = contexto(ref);
    const cMod = CATEGORIAS.find(function (x) { return x.id === cat; });
    const f = await modal({
      titulo: 'Nova peça', largo: true,
      corpo: campo('Modelo', '<select name="modelo" id="pc-modelo">' + opcoes(MODELOS.map(function (m) { return { v: m.id, t: m.t }; }), cMod ? cMod.modelos[0] : '') + '</select>') + '<p class="mini alerta" id="pc-prazo"></p>' +
        '<div class="linha">' + ['orgao', 'modalidade', 'numero', 'processo'].map(function (k) { return campo({ orgao: 'Órgão', modalidade: 'Modalidade', numero: 'Nº', processo: 'Processo' }[k], '<input name="' + k + '" value="' + esc(ctx[k]) + '">'); }).join('') + '</div>' +
        campo('Objeto', '<input name="objeto" value="' + esc(ctx.objeto) + '">') + '<div id="pc-campos"></div>',
      botao: 'Gerar peça',
      aoAbrir: function (form) {
        const s = form.querySelector('#pc-modelo');
        const atualizar = function () { const m = MODELOS.find(function (x) { return x.id === s.value; }); form.querySelector('#pc-prazo').textContent = 'Prazo: ' + m.prazo; form.querySelector('#pc-campos').innerHTML = m.campos.map(function (c) { return campo(c[1], '<textarea name="' + c[0] + '" rows="3">' + esc(ctx[c[0]] || '') + '</textarea>'); }).join(''); };
        s.onchange = atualizar; atualizar();
      }
    });
    if (!f) { location.hash = '#/pecas'; return; }
    const m = MODELOS.find(function (x) { return x.id === f.get('modelo'); });
    const v = Object.assign({}, ctx); f.forEach(function (val, k) { v[k] = val; });
    const peca = { id: Dados.id('pc'), modelo: m.id, titulo: [m.t, [v.orgao, v.numero].filter(Boolean).join(' ')].filter(Boolean).join(' · '), texto: preencher(m.texto, v), criadaEm: new Date().toISOString(), ref: ref || '', empresaId: Dados.e.empresaAtiva };
    e().pecas.unshift(peca); Dados.salvar(); location.hash = '#/pecas/editar/' + peca.id;
  }

  function telaLista(el) {
    const todas = e().pecas;
    const conta = {}; todas.forEach(function (p) { const c = categoriaDe(p.modelo); conta[c] = (conta[c] || 0) + 1; });
    const q = Nucleo.normalizar(filtro.q);
    const l = todas.filter(function (p) { return (!filtro.cat || categoriaDe(p.modelo) === filtro.cat) && (!q || Nucleo.normalizar(p.titulo + ' ' + p.texto).indexOf(q) >= 0); });
    const cat = CATEGORIAS.find(function (x) { return x.id === filtro.cat; });
    const nomeModelo = function (id) { const m = MODELOS.find(function (x) { return x.id === id; }); return m ? m.t : ''; };
    el.innerHTML = '<div class="nota-importante">Modelos de apoio, para revisar antes de protocolar: confira prazos, artigos e exigências no edital e na regulamentação do órgão. Os trechos entre [COLCHETES] ficaram sem preencher.</div>' +
      '<div class="pc-cats" role="tablist" aria-label="Categorias de peças">' + [{ id: '', t: 'Todas' }].concat(CATEGORIAS).map(function (c) { const n = c.id ? conta[c.id] || 0 : todas.length; return '<button type="button" role="tab" class="pc-cat' + (filtro.cat === c.id ? ' on' : '') + '" aria-selected="' + (filtro.cat === c.id) + '" data-cat="' + c.id + '">' + esc(c.t) + ' <span class="pc-n">' + n + '</span></button>'; }).join('') + '</div>' +
      '<div class="barra-acoes"><input type="search" id="pc-busca" placeholder="Buscar por órgão, número ou texto" value="' + esc(filtro.q) + '" aria-label="Buscar peças"><button class="btn primario" data-a="nova">+ Nova peça' + (cat ? ': ' + esc(cat.t.toLowerCase()) : '') + '</button></div>' +
      (l.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Peça</th><th>Categoria</th><th>Modelo</th><th>Criada em</th></tr></thead><tbody>' + l.map(function (p) { const c = CATEGORIAS.find(function (x) { return x.id === categoriaDe(p.modelo); }); return '<tr class="clicavel" data-id="' + p.id + '"><td><a href="#/pecas/editar/' + p.id + '">' + esc(p.titulo) + '</a></td><td><span class="tag pc-tag-' + c.id + '">' + esc(c.t) + '</span></td><td class="mudo">' + esc(nomeModelo(p.modelo)) + '</td><td>' + dataHora(p.criadaEm) + '</td></tr>'; }).join('') + '</tbody></table></div>' :
        UI.vazio(todas.length ? 'Nenhuma peça nesta categoria' : 'Nenhuma peça', todas.length ? 'Troque a categoria ou a busca, ou crie uma nova peça.' : 'Gere a partir de um cartão do Quadro, de um recurso no Monitorar, ou aqui.'));
    el.onclick = function (ev) {
      const c = ev.target.closest('[data-cat]'); if (c) { filtro.cat = c.dataset.cat; telaLista(el); return; }
      if (ev.target.closest('[data-a=nova]')) { nova('', filtro.cat); return; }
      const tr = ev.target.closest('tr[data-id]'); if (tr && !ev.target.closest('a')) location.hash = '#/pecas/editar/' + tr.dataset.id;
    };
    const busca = el.querySelector('#pc-busca');
    busca.oninput = function () { filtro.q = busca.value; clearTimeout(busca._t); busca._t = setTimeout(function () { telaLista(el); const b = el.querySelector('#pc-busca'); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }, 250); };
  }

  function telaEditar(el, id) {
    const p = e().pecas.find(function (x) { return x.id === id; });
    if (!p) { el.innerHTML = UI.vazio('Peça não encontrada', '', '<a class="btn" href="#/pecas">Voltar</a>'); return; }
    const pend = (p.texto.match(/\[[A-Z_]+\]/g) || []).length;
    el.innerHTML = '<p><a href="#/pecas">← Peças</a></p><section class="cartao"><header><input class="titulo-editavel" id="pc-titulo" value="' + esc(p.titulo) + '"><div class="grupo-botoes"><button class="btn" data-a="copiar">Copiar texto</button><button class="btn" data-a="word">Baixar .doc</button><button class="btn" data-a="imprimir">Imprimir / PDF</button><button class="btn fantasma perigo" data-a="excluir">Excluir</button></div></header>' +
      (pend ? '<p class="alerta mini">' + pend + ' campo(s) entre colchetes para completar.</p>' : '') +
      '<textarea id="pc-texto" class="peca" rows="30" spellcheck="true">' + esc(p.texto) + '</textarea></section>';
    const ta = el.querySelector('#pc-texto'); const ti = el.querySelector('#pc-titulo');
    ta.oninput = ti.oninput = function () { p.texto = ta.value; p.titulo = ti.value; clearTimeout(ta._t); ta._t = setTimeout(Dados.salvar, 400); };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'copiar') { try { await navigator.clipboard.writeText(p.texto); aviso('Texto copiado.'); } catch (err) { ta.select(); aviso('Selecionei o texto: use Ctrl+C.'); } }
      if (b.dataset.a === 'word') UI.baixar(Nucleo.normalizar(p.titulo).replace(/ /g, '-').slice(0, 60) + '.doc', '<html><head><meta charset="utf-8"></head><body style="font-family:Arial;font-size:12pt;white-space:pre-wrap">' + esc(p.texto) + '</body></html>', 'application/msword');
      if (b.dataset.a === 'imprimir') { const w = window.open('', '_blank'); if (!w) return; w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(p.titulo) + '</title><style>body{font:12pt/1.5 Arial,sans-serif;margin:2.5cm;white-space:pre-wrap}</style></head><body>' + esc(p.texto) + '<script>print()<\/script></body></html>'); w.document.close(); }
      if (b.dataset.a === 'excluir' && await confirmar('Excluir peça', 'Excluir esta peça?', 'Excluir')) { e().pecas = e().pecas.filter(function (x) { return x !== p; }); Dados.salvar(); location.hash = '#/pecas'; }
    };
  }

  Telas.pecas = {
    titulo: 'Seven Jus',
    render: function (el, sub, param) {
      el.onclick = null;
      if (sub === 'categoria') { filtro.cat = param || ''; telaLista(el); }
      else if (sub === 'nova') { telaLista(el); nova(param); }
      else if (sub === 'editar') telaEditar(el, param);
      else telaLista(el);
    },
    MODELOS: MODELOS, CATEGORIAS: CATEGORIAS, categoriaDe: categoriaDe, preencher: preencher
  };
})();
