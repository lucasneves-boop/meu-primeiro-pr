/* Precificação de produto e de serviço, item a item ou em lote, ligada a propostas e disputas. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, num, campo, opcoes, modal, aviso, abas, confirmar, dataHora } = UI;
  const P = Precos;
  const PADRAO_PRODUTO = { nome: '', regime: 'simples', custo: '', freteCompra: '', embalagem: '', outrosDiretos: '', freteEntregaTotal: '', quantidade: 1, difal: 0, impostos: 6, comissao: 0, prazoPagamento: 30, taxaMes: 1.5, custoFinanceiro: '', taxaBpo: 0, despesasFixas: 5, garantia: 0, outrosPct: 0, margem: 10, referencia: '' };
  const PADRAO_SERVICO = { nome: '', regime: 'simples', salario: '', adicionais: 0, encargos: 70, beneficios: '', uniformes: '', insumos: '', equipamentos: '', outros: '', postos: 1, meses: 12, administracao: 4, seguro: 0.8, risco: 1.27, garantia: 0, financeiro: 1.23, lucro: 7.4, tributos: 6, referencia: '' };
  const est = { produto: Object.assign({}, PADRAO_PRODUTO), servico: Object.assign({}, PADRAO_SERVICO), editando: { produto: null, servico: null }, lote: { proposta: '', custos: {}, params: Object.assign({}, PADRAO_PRODUTO) } };

  function e() { const d = Dados.e; d.precificacoes = d.precificacoes || []; return d; }
  const n = function (v) { return typeof v === 'number' ? v : Nucleo.lerNumeroBR(v); };
  const pc = function (v) { return v == null || !isFinite(v) ? '—' : num(v, 2) + '%'; };
  function entrada(nome, rotulo, v, dica, sufixo) { return campo(rotulo, '<div class="p-campo"><input name="' + nome + '" inputmode="decimal" value="' + esc(v == null ? '' : String(v).replace('.', ',')) + '">' + (sufixo ? '<span>' + sufixo + '</span>' : '') + '</div>', dica); }
  function lerForm(form, base) { const d = Object.assign({}, base); new FormData(form).forEach(function (v, k) { d[k] = k === 'nome' || k === 'regime' ? v : v === '' ? '' : n(v); }); return d; }

  // ---------- produto ----------
  function telaProduto(el) {
    const p = est.produto;
    el.innerHTML = '<div class="p-grade"><form class="cartao p-form" id="p-form">' +
      '<div class="linha">' + campo('Produto / item', '<input name="nome" value="' + esc(p.nome) + '" placeholder="ex.: Papel A4 75 g, resma">') + campo('Regime tributário', '<select name="regime">' + opcoes(Object.keys(P.REGIMES).map(function (k) { return { v: k, t: P.REGIMES[k].t }; }), p.regime) + '</select>') + '</div>' +
      '<fieldset><legend>Custos diretos por unidade</legend><div class="linha">' + entrada('custo', 'Custo de compra', p.custo, '', 'R$') + entrada('freteCompra', 'Frete de compra', p.freteCompra, '', 'R$') + entrada('embalagem', 'Embalagem', p.embalagem, '', 'R$') + entrada('outrosDiretos', 'Outros custos', p.outrosDiretos, '', 'R$') + '</div>' +
      '<div class="linha">' + entrada('quantidade', 'Quantidade licitada', p.quantidade, '', 'un.') + entrada('freteEntregaTotal', 'Frete até o órgão (total)', p.freteEntregaTotal, 'Rateado pela quantidade.', 'R$') + entrada('difal', 'DIFAL / ICMS não recuperável', p.difal, 'Sobre o custo de compra.', '%') + '</div></fieldset>' +
      '<fieldset><legend>Percentuais sobre o preço de venda</legend><div class="linha">' + entrada('impostos', 'Impostos sobre a venda', p.impostos, 'Ponto de partida do regime; confirme com o contador.', '%') + entrada('comissao', 'Comissão', p.comissao, '', '%') + entrada('taxaBpo', 'Taxa da Seven (BPO)', p.taxaBpo, '', '%') + entrada('despesasFixas', 'Rateio de despesas fixas', p.despesasFixas, '', '%') + '</div>' +
      '<div class="linha">' + entrada('prazoPagamento', 'Prazo de pagamento do órgão', p.prazoPagamento, 'Dias após a entrega.', 'dias') + entrada('taxaMes', 'Custo do dinheiro', p.taxaMes, 'Ao mês.', '%') + entrada('custoFinanceiro', 'Custo financeiro (opcional)', p.custoFinanceiro, 'Em branco = calculado pelo prazo.', '%') + entrada('garantia', 'Seguro-garantia', p.garantia, 'Custo do seguro sobre o preço.', '%') + entrada('outrosPct', 'Outros', p.outrosPct, '', '%') + '</div></fieldset>' +
      '<fieldset><legend>Resultado esperado</legend><div class="linha">' + entrada('margem', 'Margem líquida desejada', p.margem, '', '%') + entrada('referencia', 'Valor de referência do edital (unitário)', p.referencia, 'Para ver o desconto possível.', 'R$') + '</div></fieldset>' +
      '<div class="grupo-botoes"><button type="button" class="btn primario" data-a="salvar">' + (est.editando.produto ? 'Salvar alterações' : 'Salvar precificação') + '</button><button type="button" class="btn" data-a="aplicar">Aplicar à proposta</button><button type="button" class="btn" data-a="limite">Usar como valor limite</button><button type="button" class="btn fantasma" data-a="imprimir">Imprimir</button><button type="button" class="btn fantasma" data-a="limpar">Limpar</button></div></form>' +
      '<aside class="p-res" id="p-res"></aside></div>';
    const form = el.querySelector('#p-form');
    const atualizar = function () { est.produto = lerForm(form, est.produto); el.querySelector('#p-res').innerHTML = resultadoProduto(P.produto(est.produto)); };
    form.oninput = atualizar;
    form.onchange = function (ev) { if (ev.target.name === 'regime') { const r = P.REGIMES[ev.target.value].produto; if (r.impostos != null) form.impostos.value = String(r.impostos).replace('.', ','); atualizar(); } };
    atualizar();
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return; const r = P.produto(est.produto);
      if (b.dataset.a === 'salvar') salvarPrec('produto', est.produto);
      if (b.dataset.a === 'limpar') { est.produto = Object.assign({}, PADRAO_PRODUTO); est.editando.produto = null; App.redesenhar(); }
      if (b.dataset.a === 'aplicar') { if (!r.valido) return aviso('Ajuste os percentuais: somam 100% ou mais.', 'erro'); await aplicarProposta([{ custo: r.custoDireto, preco: r.preco }]); }
      if (b.dataset.a === 'limite') { if (!r.valido) return; await aplicarLimite(r.precoMinimo); }
      if (b.dataset.a === 'imprimir') imprimir('Precificação de produto: ' + (est.produto.nome || ''), el.querySelector('#p-res').innerHTML);
    };
  }

  function resultadoProduto(r) {
    if (!r.valido) return '<div class="cartao"><p class="alerta">Os percentuais sobre o preço somam 100% ou mais. Reduza margem ou despesas.</p></div>';
    if (!r.custoDireto) return '<div class="cartao"><h3>Resultado</h3><p class="mudo">Informe o custo de compra para calcular.</p></div>';
    const linhas = [['Compra', r.diretos.compra], ['Frete de compra', r.diretos.freteCompra], ['Embalagem', r.diretos.embalagem], ['Outros custos', r.diretos.outros], ['Frete de entrega (rateado)', r.diretos.freteEntrega], ['DIFAL', r.diretos.difal]].filter(function (x) { return x[1]; });
    const pcts = [['Impostos', 'impostos'], ['Comissão', 'comissao'], ['Custo financeiro', 'financeiro'], ['Taxa da Seven', 'bpo'], ['Despesas fixas', 'fixas'], ['Seguro-garantia', 'garantia'], ['Outros', 'outrosPct']].filter(function (x) { return r.sobrePreco[x[1]]; });
    return '<div class="cartao p-destaque"><span class="mudo">Preço de venda sugerido (unitário)</span><b class="p-preco">' + moeda(r.preco) + '</b><div class="p-mini"><span>Markup <b>' + num(r.markup, 3) + '×</b></span><span>Lucro <b>' + moeda(r.lucro) + '</b> (' + pc(r.margem) + ')</span><span>Total <b>' + moeda(r.total) + '</b></span></div></div>' +
      '<div class="cartao p-minimo"><span class="mudo">Preço mínimo (margem zero) — use como valor limite do lance</span><b>' + moeda(r.precoMinimo) + '</b><small>Total no mínimo: ' + moeda(r.totalMinimo) + '</small></div>' +
      (r.referencia ? '<div class="cartao ' + (r.cabe ? '' : 'p-alerta') + '"><h4>Contra o valor de referência (' + moeda(r.referencia) + ')</h4><p>Preço sugerido = <b>' + pc(r.descontoSobreRef * 100) + '</b> de desconto sobre a referência.<br>Vendendo pela referência, a margem seria <b>' + pc(r.margemNaReferencia) + '</b>.<br>' + (r.cabe ? 'Há espaço até o mínimo: desconto máximo de <b>' + pc((1 - r.precoMinimo / r.referencia) * 100) + '</b>.' : '<b class="alerta">O preço mínimo está acima da referência: o item não fecha a conta.</b>') + '</p></div>' : '') +
      '<div class="cartao"><h4>Composição do preço</h4><table class="tabela compacta"><tbody>' + linhas.map(function (x) { return '<tr><td>' + x[0] + '</td><td class="n">' + moeda(x[1]) + '</td><td class="n mudo">' + pc(x[1] / r.preco * 100) + '</td></tr>'; }).join('') +
      '<tr><th>Custo direto</th><th class="n">' + moeda(r.custoDireto) + '</th><th class="n">' + pc(r.custoDireto / r.preco * 100) + '</th></tr>' +
      pcts.map(function (x) { return '<tr><td>' + x[0] + '</td><td class="n">' + moeda(r.valores[x[1]]) + '</td><td class="n mudo">' + pc(r.sobrePreco[x[1]]) + '</td></tr>'; }).join('') +
      '<tr><td>Lucro líquido</td><td class="n">' + moeda(r.lucro) + '</td><td class="n mudo">' + pc(r.margem) + '</td></tr><tr><th>Preço</th><th class="n">' + moeda(r.preco) + '</th><th class="n">100%</th></tr></tbody></table>' +
      '<p class="mini mudo">Preço = custo direto ÷ (1 − soma dos percentuais sobre o preço). Margem de contribuição: ' + moeda(r.margemContribuicao) + ' por unidade.</p></div>' +
      '<div class="cartao"><h4>Simulador de lances</h4><table class="tabela compacta"><thead><tr><th class="n">Lance</th>' + (r.referencia ? '<th class="n">Desconto</th>' : '') + '<th class="n">Margem</th><th class="n">Lucro total</th></tr></thead><tbody>' + P.tabelaLances(r, 8).map(function (l) { return '<tr class="' + (l.margem < 0.0001 ? 'p-zero' : '') + '"><td class="n">' + moeda(l.preco) + '</td>' + (r.referencia ? '<td class="n">' + pc(l.desconto * 100) + '</td>' : '') + '<td class="n">' + pc(l.margem) + '</td><td class="n">' + moeda(l.lucroTotal) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  // ---------- serviço ----------
  function telaServico(el) {
    const s = est.servico;
    el.innerHTML = '<div class="p-grade"><form class="cartao p-form" id="s-form">' +
      '<div class="linha">' + campo('Serviço / posto', '<input name="nome" value="' + esc(s.nome) + '" placeholder="ex.: Posto de limpeza 44 h">') + campo('Regime tributário', '<select name="regime">' + opcoes(Object.keys(P.REGIMES).map(function (k) { return { v: k, t: P.REGIMES[k].t }; }), s.regime) + '</select>') + '</div>' +
      '<fieldset><legend>Custo mensal de um posto</legend><div class="linha">' + entrada('salario', 'Salário base', s.salario, 'Piso da convenção coletiva.', 'R$') + entrada('adicionais', 'Adicionais (insalubridade, periculosidade, noturno)', s.adicionais, 'Sobre o salário.', '%') + entrada('encargos', 'Encargos sociais e trabalhistas', s.encargos, 'INSS, FGTS, férias, 13º, provisões. Varia com o regime.', '%') + '</div>' +
      '<div class="linha">' + entrada('beneficios', 'Benefícios (VT, VA, plano)', s.beneficios, '', 'R$') + entrada('uniformes', 'Uniformes e EPI', s.uniformes, 'Por mês.', 'R$') + entrada('insumos', 'Materiais e insumos', s.insumos, 'Por mês.', 'R$') + entrada('equipamentos', 'Equipamentos (depreciação)', s.equipamentos, 'Por mês.', 'R$') + entrada('outros', 'Outros', s.outros, '', 'R$') + '</div>' +
      '<div class="linha">' + entrada('postos', 'Quantidade de postos', s.postos, '', 'postos') + entrada('meses', 'Meses de contrato', s.meses, '', 'meses') + '</div></fieldset>' +
      '<fieldset><legend>BDI (Benefícios e Despesas Indiretas)</legend><div class="linha">' + entrada('administracao', 'Administração central (AC)', s.administracao, '', '%') + entrada('seguro', 'Seguro (S)', s.seguro, '', '%') + entrada('risco', 'Risco (R)', s.risco, '', '%') + entrada('garantia', 'Garantia (G)', s.garantia, '', '%') + '</div><div class="linha">' + entrada('financeiro', 'Despesas financeiras (DF)', s.financeiro, '', '%') + entrada('lucro', 'Lucro (L)', s.lucro, '', '%') + entrada('tributos', 'Tributos sobre o faturamento (T)', s.tributos, 'ISS, PIS, COFINS e outros.', '%') + '</div>' +
      '<p class="mini mudo">BDI = ((1 + AC + S + R + G) × (1 + DF) × (1 + L)) ÷ (1 − T) − 1 — fórmula do Acórdão 2.622/2013 do TCU. Os valores iniciais são exemplo; ajuste ao edital e à realidade da empresa.</p></fieldset>' +
      '<fieldset><legend>Referência</legend><div class="linha">' + entrada('referencia', 'Valor mensal de referência do edital', s.referencia, '', 'R$') + '</div></fieldset>' +
      '<div class="grupo-botoes"><button type="button" class="btn primario" data-a="salvar">' + (est.editando.servico ? 'Salvar alterações' : 'Salvar precificação') + '</button><button type="button" class="btn" data-a="aplicar">Aplicar à proposta</button><button type="button" class="btn" data-a="limite">Usar como valor limite</button><button type="button" class="btn fantasma" data-a="imprimir">Imprimir planilha</button><button type="button" class="btn fantasma" data-a="limpar">Limpar</button></div></form>' +
      '<aside class="p-res" id="s-res"></aside></div>';
    const form = el.querySelector('#s-form');
    const atualizar = function () { est.servico = lerForm(form, est.servico); el.querySelector('#s-res').innerHTML = resultadoServico(P.servico(est.servico), est.servico); };
    form.oninput = atualizar;
    form.onchange = function (ev) { if (ev.target.name === 'regime') { const r = P.REGIMES[ev.target.value].servico; if (r.tributos != null) form.tributos.value = String(r.tributos).replace('.', ','); atualizar(); } };
    atualizar();
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return; const r = P.servico(est.servico);
      if (b.dataset.a === 'salvar') salvarPrec('servico', est.servico);
      if (b.dataset.a === 'limpar') { est.servico = Object.assign({}, PADRAO_SERVICO); est.editando.servico = null; App.redesenhar(); }
      if (b.dataset.a === 'aplicar') { if (!r.valido) return aviso('Tributos de 100% ou mais.', 'erro'); await aplicarProposta([{ custo: r.custoMensal, preco: r.precoMensal }]); }
      if (b.dataset.a === 'limite') { if (!r.valido) return; await aplicarLimite(r.precoMinimoMensal); }
      if (b.dataset.a === 'imprimir') imprimir('Planilha de custos e formação de preços: ' + (est.servico.nome || ''), el.querySelector('#s-res').innerHTML);
    };
  }

  function resultadoServico(r, s) {
    if (!r.valido) return '<div class="cartao"><p class="alerta">Tributos de 100% ou mais.</p></div>';
    if (!r.custoPosto) return '<div class="cartao"><h3>Resultado</h3><p class="mudo">Informe o salário e os custos do posto.</p></div>';
    const linhas = [['Remuneração (com adicionais)', r.posto.remuneracao], ['Encargos sociais', r.posto.encargos], ['Benefícios', r.posto.beneficios], ['Uniformes e EPI', r.posto.uniformes], ['Materiais e insumos', r.posto.insumos], ['Equipamentos', r.posto.equipamentos], ['Outros', r.posto.outros]].filter(function (x) { return x[1]; });
    return '<div class="cartao p-destaque"><span class="mudo">Preço mensal (' + r.postos + ' posto(s))</span><b class="p-preco">' + moeda(r.precoMensal) + '</b><div class="p-mini"><span>BDI <b>' + pc(r.bdi * 100) + '</b></span><span>Por posto <b>' + moeda(r.precoPosto) + '</b></span><span>' + r.meses + ' meses <b>' + moeda(r.precoTotal) + '</b></span></div></div>' +
      '<div class="cartao p-minimo"><span class="mudo">Preço mínimo mensal (lucro zero)</span><b>' + moeda(r.precoMinimoMensal) + '</b><small>No contrato todo: ' + moeda(r.precoMinimoMensal * r.meses) + '</small></div>' +
      (r.referencia ? '<div class="cartao ' + (r.cabe ? '' : 'p-alerta') + '"><h4>Contra a referência (' + moeda(r.referencia) + '/mês)</h4><p>Desconto do preço sugerido: <b>' + pc(r.descontoSobreRef * 100) + '</b>. ' + (r.cabe ? 'Desconto máximo até o mínimo: <b>' + pc((1 - r.precoMinimoMensal / r.referencia) * 100) + '</b>.' : '<b class="alerta">O mínimo está acima da referência.</b>') + '</p></div>' : '') +
      '<div class="cartao"><h4>Custo de um posto</h4><table class="tabela compacta"><tbody>' + linhas.map(function (x) { return '<tr><td>' + x[0] + '</td><td class="n">' + moeda(x[1]) + '</td></tr>'; }).join('') + '<tr><th>Custo do posto</th><th class="n">' + moeda(r.custoPosto) + '</th></tr><tr><td>× ' + r.postos + ' posto(s) = custo mensal</td><td class="n">' + moeda(r.custoMensal) + '</td></tr><tr><td>Tributos no mês</td><td class="n">' + moeda(r.tributosValor) + '</td></tr><tr><td>Lucro no mês</td><td class="n">' + moeda(r.lucroValor) + '</td></tr></tbody></table></div>' +
      '<div class="cartao"><h4>Composição do BDI</h4><table class="tabela compacta"><tbody>' + [['Administração central', s.administracao], ['Seguro', s.seguro], ['Risco', s.risco], ['Garantia', s.garantia], ['Despesas financeiras', s.financeiro], ['Lucro', s.lucro], ['Tributos', s.tributos]].map(function (x) { return '<tr><td>' + x[0] + '</td><td class="n">' + pc(n(x[1]) || 0) + '</td></tr>'; }).join('') + '<tr><th>BDI</th><th class="n">' + pc(r.bdi * 100) + '</th></tr></tbody></table></div>';
  }

  // ---------- salvas ----------
  function salvarPrec(tipo, dados) {
    const id = est.editando[tipo];
    if (id) { const x = e().precificacoes.find(function (p) { return p.id === id; }); if (x) { x.dados = Object.assign({}, dados); x.nome = dados.nome || x.nome; x.atualizadoEm = new Date().toISOString(); Dados.salvar(); aviso('Precificação atualizada.'); return; } }
    const x = { id: Dados.id('pr'), tipo: tipo, nome: dados.nome || (tipo === 'produto' ? 'Produto sem nome' : 'Serviço sem nome'), empresaId: Dados.e.empresaAtiva, dados: Object.assign({}, dados), criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() };
    e().precificacoes.unshift(x); est.editando[tipo] = x.id; Dados.salvar(); aviso('Precificação salva.'); App.redesenhar();
  }

  function telaSalvas(el) {
    const emp = Dados.empresaAtiva(); const l = e().precificacoes.filter(function (p) { return !emp || !p.empresaId || p.empresaId === emp.id; });
    el.innerHTML = l.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Nome</th><th>Tipo</th><th class="n">Preço</th><th class="n">Mínimo</th><th>Atualizada</th><th></th></tr></thead><tbody>' +
      l.map(function (p) { const r = p.tipo === 'produto' ? P.produto(p.dados) : P.servico(p.dados); const preco = p.tipo === 'produto' ? r.preco : r.precoMensal; const min = p.tipo === 'produto' ? r.precoMinimo : r.precoMinimoMensal; return '<tr data-id="' + p.id + '"><td><b>' + esc(p.nome) + '</b></td><td>' + (p.tipo === 'produto' ? 'Produto' : 'Serviço (mensal)') + '</td><td class="n">' + moeda(preco) + '</td><td class="n">' + moeda(min) + '</td><td>' + dataHora(p.atualizadoEm) + '</td><td class="acoes"><button class="btn mini" data-a="abrir">Abrir</button><button class="btn mini fantasma" data-a="duplicar">Duplicar</button><button class="btn mini fantasma perigo" data-a="excluir">×</button></td></tr>'; }).join('') + '</tbody></table></div>'
      : UI.vazio('Nenhuma precificação salva', 'Monte o preço de um produto ou serviço e clique em Salvar.');
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return; const x = e().precificacoes.find(function (p) { return p.id === b.closest('[data-id]').dataset.id; });
      if (b.dataset.a === 'abrir') { est[x.tipo] = Object.assign({}, x.tipo === 'produto' ? PADRAO_PRODUTO : PADRAO_SERVICO, x.dados); est.editando[x.tipo] = x.id; location.hash = '#/precificacao/' + x.tipo; }
      if (b.dataset.a === 'duplicar') { const c = JSON.parse(JSON.stringify(x)); c.id = Dados.id('pr'); c.nome = x.nome + ' (cópia)'; c.dados.nome = c.nome; e().precificacoes.unshift(c); Dados.salvar(); App.redesenhar(); }
      if (b.dataset.a === 'excluir' && await confirmar('Excluir', 'Excluir a precificação "' + esc(x.nome) + '"?', 'Excluir')) { e().precificacoes = e().precificacoes.filter(function (p) { return p !== x; }); Dados.salvar(); App.redesenhar(); }
    };
  }

  // ---------- ligações com proposta e disputa ----------
  async function aplicarProposta(valores) {
    const ps = Dados.e.propostas.filter(function (p) { return p.itens && p.itens.length; });
    if (!ps.length) { aviso('Nenhuma proposta com itens.', 'erro'); return; }
    const f = await modal({ titulo: 'Aplicar à proposta', corpo: campo('Proposta', '<select name="p" id="ap-p">' + opcoes(ps.map(function (x) { return { v: x.id, t: (x.modalidade || '') + ' ' + (x.numero || '') + ' · ' + (x.orgao || '') }; })) + '</select>') + campo('Item', '<select name="i" id="ap-i"></select>') + '<p class="mini">Grava o custo direto e o preço sugerido (' + moeda(valores[0].preco) + ') no item.</p>', botao: 'Aplicar',
      aoAbrir: function (form) { const sp = form.querySelector('#ap-p'), si = form.querySelector('#ap-i'); const preencher = function () { const p = ps.find(function (x) { return x.id === sp.value; }); si.innerHTML = opcoes(p.itens.map(function (i) { return { v: i.numero, t: i.numero + ' · ' + String(i.descricao || '').slice(0, 70) }; })); }; sp.onchange = preencher; preencher(); } });
    if (!f) return;
    const p = ps.find(function (x) { return x.id === f.get('p'); }); const it = p.itens.find(function (i) { return String(i.numero) === f.get('i'); });
    it.custo = Nucleo.arredondar(valores[0].custo, 4); it.unitario = Nucleo.arredondarCima(valores[0].preco, 2); Dados.salvar();
    aviso('Item ' + it.numero + ' atualizado na proposta.');
  }

  async function aplicarLimite(minimo) {
    const ds = Dados.e.disputas; if (!ds.length) { aviso('Nenhuma disputa cadastrada.', 'erro'); return; }
    const f = await modal({ titulo: 'Usar como valor limite', corpo: campo('Disputa', '<select name="d" id="al-d">' + opcoes(ds.map(function (d) { return { v: d.id, t: d.titulo }; })) + '</select>') + campo('Item', '<select name="i" id="al-i"></select>') + '<p class="mini">Valor limite = preço mínimo ' + moeda(minimo) + '. Marque "Aprovado" depois do aceite do cliente.</p>', botao: 'Definir',
      aoAbrir: function (form) { const sd = form.querySelector('#al-d'), si = form.querySelector('#al-i'); const preencher = function () { const d = ds.find(function (x) { return x.id === sd.value; }); si.innerHTML = opcoes(d.itens.map(function (i) { return { v: i.numero, t: i.numero + ' · ' + String(i.descricao || '').slice(0, 70) }; })); }; sd.onchange = preencher; preencher(); } });
    if (!f) return;
    const d = ds.find(function (x) { return x.id === f.get('d'); }); const it = d.itens.find(function (i) { return String(i.numero) === f.get('i'); });
    it.limite = Nucleo.arredondarCima(minimo, d.config.casas == null ? 2 : d.config.casas); it.aprovado = false; Dados.salvar(); aviso('Valor limite definido no item ' + it.numero + '.');
  }

  function imprimir(titulo, html) {
    const w = window.open('', '_blank'); if (!w) return aviso('Permita pop-ups para imprimir.', 'erro');
    const base = location.href.replace(/#.*$/, '').replace(/[^/]*$/, '');
    w.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title><link rel="stylesheet" href="' + base + 'css/app.css"></head><body class="impressao"><div class="cabecalho-seven"><img src="' + base + 'img/seven-marca.png" alt=""><div><b>SEVEN</b><small>BPO DE LICITAÇÕES</small></div></div><h1>' + esc(titulo) + '</h1><div class="p-res">' + html + '</div><p class="mini">Gerado em ' + new Date().toLocaleString('pt-BR') + ' · Seven · (61) 98347-2232</p><script>setTimeout(function(){print()},500)<\/script></body></html>');
    w.document.close();
  }

  Telas.precificacao = {
    titulo: 'Seven Price',
    resultadoProduto: resultadoProduto,
    render: function (el, sub) {
      sub = sub || 'produto';
      el.innerHTML = abas([{ id: 'produto', t: 'Produto' }, { id: 'servico', t: 'Serviço (mão de obra)' }, { id: 'lote', t: 'Vários itens (proposta inteira)' }, { id: 'salvas', t: 'Salvas', n: e().precificacoes.length }], sub, 'precificacao') + '<div id="aba"></div>';
      ({ produto: telaProduto, servico: telaServico, lote: Telas.planilhaPrecos.render, salvas: telaSalvas }[sub] || telaProduto)(el.querySelector('#aba'));
      el.onclick = null;
    }
  };
})();
