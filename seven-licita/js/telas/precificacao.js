/* Precificação de produto e de serviço, item a item ou em lote, ligada a propostas e disputas. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, num, campo, opcoes, modal, aviso, abas, confirmar, dataHora } = UI;
  const P = Precos;
  const PADRAO_PRODUTO = { nome: '', regime: 'simples', custo: '', freteCompra: '', embalagem: '', outrosDiretos: '', freteEntregaTotal: '', quantidade: 1, difal: 0, impostos: 6, comissao: 0, comissaoBase: 'preco', bpoBase: 'preco', anexo: 'I', rbt12: '', icmsVenda: 0, icmsCredito: 0, icmsST: '', custosParticipacao: '', orgao: '', atrasoOrgao: 0, inflacaoAno: 0, mesesCompra: 0, prazoPagamento: 30, taxaMes: 1.5, custoFinanceiro: '', taxaBpo: 0, despesasFixas: 5, garantia: 0, outrosPct: 0, margem: 10, referencia: '' };
  const PADRAO_SERVICO = { nome: '', regime: 'simples', salario: '', adicionais: 0, encargos: 70, beneficios: '', uniformes: '', insumos: '', equipamentos: '', outros: '', postos: 1, meses: 12, administracao: 4, seguro: 0.8, risco: 1.27, garantia: 0, financeiro: 1.23, lucro: 7.4, tributos: 6, referencia: '' };
  const est = { produto: Object.assign({}, PADRAO_PRODUTO), servico: Object.assign({}, PADRAO_SERVICO), editando: { produto: null, servico: null }, lote: { proposta: '', custos: {}, params: Object.assign({}, PADRAO_PRODUTO) } };

  function e() { const d = Dados.e; d.precificacoes = d.precificacoes || []; return d; }
  const n = function (v) { return typeof v === 'number' ? v : Nucleo.lerNumeroBR(v); };
  const pc = function (v) { return v == null || !isFinite(v) ? '—' : num(v, 2) + '%'; };
  // valores em R$ já aparecem formatados (500.000,00); os demais com vírgula decimal
  const mostrar = function (v, sufixo) { if (v == null || v === '') return ''; if (sufixo === 'R$' && typeof v === 'number' && isFinite(v)) return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }); return String(v).replace('.', ','); };
  function entrada(nome, rotulo, v, dica, sufixo) { return campo(rotulo, '<div class="p-campo"><input name="' + nome + '" inputmode="decimal" value="' + esc(mostrar(v, sufixo)) + '">' + (sufixo ? '<span>' + sufixo + '</span>' : '') + '</div>', dica); }
  // campo de % com a base escolhida ao lado (sobre o preço ou sobre o lucro líquido)
  function entradaBase(nome, nomeBase, rotulo, v, base, dica) { return campo(rotulo, '<div class="p-campo p-campo-base"><input name="' + nome + '" inputmode="decimal" value="' + esc(v == null ? '' : String(v).replace('.', ',')) + '"><select name="' + nomeBase + '" aria-label="Base de ' + esc(rotulo) + '"><option value="preco"' + (base !== 'lucro' ? ' selected' : '') + '>% do preço</option><option value="lucro"' + (base === 'lucro' ? ' selected' : '') + '>% do lucro líquido</option></select></div>', dica); }
  function lerForm(form, base) { const d = Object.assign({}, base); new FormData(form).forEach(function (v, k) { d[k] = k === 'nome' || k === 'regime' || k === 'anexo' || k === 'orgao' || /Base$/.test(k) ? v : v === '' ? '' : n(v); }); return d; }

  // ---------- produto ----------
  // comissão e taxa da Seven são a mesma coisa: dados antigos com as duas viram um campo só
  function unificarComissao(p) {
    if (!(n(p.taxaBpo) > 0)) { p.taxaBpo = 0; return p; }
    // bases diferentes (uma no preço, outra no lucro) não se somam: a parte antiga continua no cálculo, como complemento
    if ((p.bpoBase || 'preco') !== (p.comissaoBase || 'preco') && n(p.comissao) > 0) return p;
    if (!(n(p.comissao) > 0)) p.comissaoBase = p.bpoBase || 'preco';
    p.comissao = n(p.comissao) + n(p.taxaBpo); p.taxaBpo = 0; p.bpoBase = 'preco'; return p;
  }
  function orgaosComHistorico() { try { return (Telas.mercado && Telas.mercado.historicoPagamentos ? Telas.mercado.historicoPagamentos() : []).filter(function (o) { return o.media != null; }); } catch (err) { return []; } }
  function telaProduto(el) {
    const p = unificarComissao(est.produto); const simples = p.regime === 'simples';
    const sim = simples ? P.simplesEfetiva(p.anexo || 'I', n(p.rbt12)) : null;
    const orgs = orgaosComHistorico();
    el.innerHTML = '<div class="p-grade"><form class="cartao p-form" id="p-form">' +
      '<div class="linha">' + campo('Produto / item', '<input name="nome" value="' + esc(p.nome) + '" placeholder="ex.: Papel A4 75 g, resma">', 'O nome também busca o preço de mercado no PNCP.') + campo('Regime tributário', '<select name="regime">' + opcoes(Object.keys(P.REGIMES).map(function (k) { return { v: k, t: P.REGIMES[k].t }; }), p.regime) + '</select>') + '</div>' +
      (simples ? '<fieldset><legend>Simples Nacional: alíquota efetiva</legend><div class="linha">' + campo('Anexo', '<select name="anexo">' + opcoes(Object.keys(P.SIMPLES).map(function (k) { return { v: k, t: P.SIMPLES[k].t }; }), p.anexo || 'I') + '</select>') + entrada('rbt12', 'Receita bruta dos últimos 12 meses', p.rbt12, 'Do cliente que vai vender.', 'R$') + '</div>' +
        '<p class="mini">Faixa ' + sim.faixa + ' · nominal ' + pc(sim.nominal) + ' · dedução ' + moeda(sim.deducao) + ' → <b>alíquota efetiva ' + pc(sim.aliquota) + '</b>' + (sim.acimaSublimite ? ' · <span class="alerta">acima do sublimite de R$ 3,6 milhões: ICMS/ISS são recolhidos fora do DAS</span>' : '') + (sim.acimaLimite ? ' · <span class="alerta">acima do limite do Simples</span>' : '') + '</p></fieldset>' : '') +
      '<fieldset><legend>Custos diretos por unidade</legend><div class="linha">' + entrada('custo', 'Custo de compra', p.custo, '', 'R$') + entrada('freteCompra', 'Frete de compra', p.freteCompra, '', 'R$') + entrada('embalagem', 'Embalagem', p.embalagem, '', 'R$') + entrada('outrosDiretos', 'Outros custos', p.outrosDiretos, '', 'R$') + '</div>' +
      '<div class="linha">' + entrada('quantidade', 'Quantidade licitada', p.quantidade, '', 'un.') + entrada('freteEntregaTotal', 'Frete até o órgão (total)', p.freteEntregaTotal, 'Rateado pela quantidade.', 'R$') + entrada('custosParticipacao', 'Custos de participação (total)', p.custosParticipacao, 'Garantia de proposta, amostras, viagens, certidões; rateados.', 'R$') + entrada('icmsST', 'ICMS-ST pago na compra', p.icmsST, 'Por unidade, se o produto tem substituição tributária.', 'R$') + '</div>' +
      '<div class="linha">' + entrada('difal', 'DIFAL / ICMS não recuperável na compra', p.difal, 'Sobre o custo de compra.', '%') + '</div></fieldset>' +
      (simples && !sim.acimaSublimite ? '' : '<fieldset><legend>ICMS na venda (fora do Simples)</legend><div class="linha">' + entrada('icmsVenda', 'Alíquota de ICMS na venda', p.icmsVenda, 'Mesmo estado: alíquota interna. Para órgão de outro estado (não contribuinte): interestadual + DIFAL = alíquota interna do destino.', '%') + entrada('icmsCredito', 'Crédito de ICMS da compra', p.icmsCredito, 'Alíquota destacada na nota do fornecedor (ex.: 12% interestadual, 4% importado). Zero se não há crédito.', '%') + '</div></fieldset>') +
      '<fieldset><legend>Percentuais sobre o preço (ou sobre o lucro)</legend><div class="linha">' + entrada('impostos', simples ? 'DAS (Simples Nacional)' : 'Impostos federais sobre a venda', p.impostos, simples ? 'Preenchido pela alíquota efetiva acima.' : 'PIS/COFINS e IRPJ/CSLL presumidos. Ponto de partida do regime; confirme com o contador.', '%') +
        entradaBase('comissao', 'comissaoBase', 'Comissão da Seven', p.comissao, p.comissaoBase, 'Sobre o lucro: só existe se houver lucro.') + entrada('despesasFixas', 'Rateio de despesas fixas', p.despesasFixas, '', '%') + entrada('garantia', 'Seguro-garantia', p.garantia, 'Custo do seguro sobre o preço.', '%') + entrada('outrosPct', 'Outros', p.outrosPct, '', '%') + '</div>' +
        (Dados.empresaAtiva() ? '<button type="button" class="btn mini" data-a="comissao-cliente">Usar a comissão de ' + esc(Dados.empresaAtiva().fantasia || Dados.empresaAtiva().razao) + ' (Seven Comissão)</button>' : '') + '</fieldset>' +
      '<fieldset><legend>Recebimento</legend><div class="linha">' + campo('Órgão comprador', '<input name="orgao" list="p-orgaos" value="' + esc(p.orgao || '') + '" placeholder="Digite para ver o histórico">' + '<datalist id="p-orgaos">' + orgs.map(function (o) { return '<option value="' + esc(o.orgao) + '">'; }).join('') + '</datalist>', orgs.length ? orgs.length + ' órgão(s) com histórico de pagamento na Seven.' : 'Sem histórico: registre pagamentos na Execução dos cartões.') +
        entrada('prazoPagamento', 'Prazo de pagamento do edital', p.prazoPagamento, 'Dias após a entrega.', 'dias') + entrada('atrasoOrgao', 'Atraso médio real do órgão', p.atrasoOrgao, 'Preenchido pelo histórico; some ao prazo.', 'dias') + '</div>' +
        '<div class="linha">' + entrada('taxaMes', 'Custo do dinheiro', p.taxaMes, 'Ao mês.', '%') + entrada('custoFinanceiro', 'Custo financeiro (opcional)', p.custoFinanceiro, 'Em branco = calculado pelo prazo + atraso.', '%') + '</div></fieldset>' +
      '<fieldset><legend>Ata de registro de preços (SRP)</legend><div class="linha">' + entrada('inflacaoAno', 'Inflação esperada do custo', p.inflacaoAno, 'Ao ano. A ata vale 12 meses sem reajuste.', '%') + entrada('mesesCompra', 'Meses até a compra média', p.mesesCompra, 'Ex.: 6 para uma ata de 12 meses.', 'meses') + '</div></fieldset>' +
      '<fieldset><legend>Resultado esperado</legend><div class="linha">' + entrada('margem', 'Margem líquida desejada', p.margem, 'O que fica para a empresa, depois de tudo.', '%') + entrada('referencia', 'Valor de referência do edital (unitário)', p.referencia, 'Para ver o desconto possível.', 'R$') + '</div></fieldset>' +
      '<div class="grupo-botoes"><button type="button" class="btn primario" data-a="salvar">' + (est.editando.produto ? 'Salvar alterações' : 'Salvar precificação') + '</button><button type="button" class="btn" data-a="aplicar">Aplicar à proposta</button><button type="button" class="btn" data-a="limite">Usar como valor limite</button><button type="button" class="btn" data-a="exequibilidade">📄 Planilha de exequibilidade (PDF)</button><button type="button" class="btn fantasma" data-a="imprimir">Imprimir</button><button type="button" class="btn fantasma" data-a="limpar">Limpar</button></div></form>' +
      '<aside class="p-res" id="p-res"></aside></div>';
    const form = el.querySelector('#p-form');
    const atualizar = function () { est.produto = lerForm(form, est.produto); el.querySelector('#p-res').innerHTML = resultadoProduto(P.produto(est.produto)); };
    form.oninput = atualizar;
    form.onchange = function (ev) {
      const t = ev.target.name;
      if (t === 'regime') { const r = P.REGIMES[ev.target.value].produto; est.produto = lerForm(form, est.produto); if (ev.target.value === 'simples') { est.produto.impostos = Math.round(P.simplesEfetiva(est.produto.anexo || 'I', n(est.produto.rbt12)).aliquota * 100) / 100; est.produto.icmsVenda = 0; est.produto.icmsCredito = 0; } else if (r.impostos != null) est.produto.impostos = r.impostos; form.impostos.value = mostrar(est.produto.impostos); App.redesenhar(); return; }
      if (t === 'anexo' || t === 'rbt12') { est.produto = lerForm(form, est.produto); est.produto.impostos = Math.round(P.simplesEfetiva(est.produto.anexo || 'I', n(est.produto.rbt12)).aliquota * 100) / 100; form.impostos.value = mostrar(est.produto.impostos); App.redesenhar(); return; }
      if (t === 'orgao') { const o = orgs.find(function (x) { return x.orgao === ev.target.value; }); if (o) { form.atrasoOrgao.value = String(Math.max(0, Math.round(o.media))); aviso('Atraso médio de ' + o.orgao + ': ' + Math.round(o.media) + ' dia(s) (' + o.pagas + ' nota(s) paga(s)).'); } }
      atualizar();
    };
    atualizar();
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return; const r = P.produto(est.produto);
      if (b.dataset.a === 'salvar') salvarPrec('produto', est.produto);
      if (b.dataset.a === 'limpar') { est.produto = Object.assign({}, PADRAO_PRODUTO); est.editando.produto = null; App.redesenhar(); }
      if (b.dataset.a === 'aplicar') { if (!r.valido) return aviso('Ajuste os percentuais: somam 100% ou mais.', 'erro'); await aplicarProposta([{ custo: r.custoDireto, preco: r.preco }]); }
      if (b.dataset.a === 'limite') { if (!r.valido) return; await aplicarLimite(r.precoMinimo); }
      if (b.dataset.a === 'imprimir') imprimir('Precificação de produto: ' + (est.produto.nome || ''), el.querySelector('#p-res').innerHTML);
      if (b.dataset.a === 'exequibilidade') { if (!r.valido || !r.custoDireto) return aviso('Informe o custo e confira os percentuais.', 'erro'); await exequibilidade([{ nome: est.produto.nome || 'Item', p: est.produto, r: r }]); }
      if (b.dataset.a === 'comissao-cliente') { const id = Dados.e.empresaAtiva; const c = Telas.comissao && Telas.comissao.rel ? Telas.comissao.rel.cfgCliente(id) : null; if (!c || !n(c.pct)) return aviso('Sem condições de comissão para este cliente na Seven Comissão.', 'erro'); est.produto.comissao = n(c.pct); est.produto.comissaoBase = c.base === 'lucro' ? 'lucro' : 'preco'; App.redesenhar(); aviso('Comissão de ' + String(n(c.pct)).replace('.', ',') + '% ' + (c.base === 'lucro' ? 'do lucro' : 'do preço') + ' aplicada.'); }
      if (b.dataset.a === 'mercado-buscar') await buscarMercado(est.produto.nome, b);
      if (b.dataset.a === 'mercado-abrir') Telas.mercado.pesquisar(est.produto.nome || '');
    };
  }

  // busca no PNCP agora (últimos 180 dias, estado do cliente) e guarda a análise na Seven Preços
  async function buscarMercado(termo, botao) {
    if (!String(termo || '').trim()) return aviso('Informe o nome do produto.', 'erro');
    const caixa = document.createElement('div'); botao.after(caixa); botao.disabled = true;
    try {
      const emp = Dados.empresaAtiva(); const hoje = new Date(); const ini = new Date(Date.now() - 180 * 864e5);
      const a = await Telas.mercado.coletar({ termo: termo, excluir: '', ufs: [(emp && emp.uf) || 'GO'], modalidades: [6, 8], inicio: ini.toISOString().slice(0, 10), fim: hoje.toISOString().slice(0, 10), esferas: [], maxDetalhe: 15 }, caixa);
      Dados.e.analises = [a].concat(Dados.e.analises || []).slice(0, 15); Dados.salvar(); aviso(a.amostras.length ? a.amostras.length + ' preço(s) homologado(s) encontrados.' : 'Nenhum preço homologado no período.'); App.redesenhar();
    } catch (err) { aviso('Não foi possível consultar o PNCP: ' + (err && err.message || err), 'erro'); }
    finally { botao.disabled = false; caixa.remove(); }
  }

  function blocoMercado(nome, r) {
    const m = P.mercado(Dados.e.analises, nome);
    if (!String(nome || '').trim()) return '<div class="cartao"><h4>Preço de mercado (PNCP)</h4><p class="mini mudo">Escreva o nome do produto para comparar com os preços homologados.</p></div>';
    if (!m || !m.n) return '<div class="cartao"><h4>Preço de mercado (PNCP)</h4><p class="mini mudo">Nenhum preço homologado deste item nas pesquisas salvas.</p><div class="grupo-botoes"><button type="button" class="btn mini primario" data-a="mercado-buscar">Buscar no PNCP agora</button><button type="button" class="btn mini" data-a="mercado-abrir">Pesquisa completa na Seven Preços</button></div></div>';
    const pos = r.valido ? (r.preco <= m.q1 ? ['ok', 'Seu preço está entre os 25% mais baixos homologados: boa chance de vencer.'] : r.preco <= m.mediana ? ['ok', 'Seu preço está abaixo da mediana homologada.'] : r.preco <= m.q3 ? ['alerta', 'Seu preço está acima da mediana: risco de perder no lance.'] : ['ruim', 'Seu preço está acima de 75% dos homologados: dificilmente vence.']) : null;
    return '<div class="cartao"><h4>Preço de mercado (PNCP) · ' + m.n + ' homologação(ões)</h4>' +
      '<div class="cm-numeros cm-kpis"><div><small>Menor</small><b>' + moeda(m.minimo) + '</b></div><div><small>Mediana</small><b>' + moeda(m.mediana) + '</b></div><div><small>Maior</small><b>' + moeda(m.maximo) + '</b></div>' + (m.descontoMedio != null ? '<div><small>Deságio médio</small><b>' + pc(m.descontoMedio * 100) + '</b></div>' : '') + '</div>' +
      (pos ? '<p class="p-mercado-pos ' + pos[0] + '">' + pos[1] + '</p>' : '') + (m.unidades.length > 1 ? '<p class="mini alerta">Unidades diferentes nas amostras (' + esc(m.unidades.join(', ')) + '): compare com cuidado.</p>' : '') +
      '<details><summary>Homologações recentes</summary><table class="tabela compacta"><tbody>' + m.recentes.map(function (x) { return '<tr><td>' + esc(String(x.data || '').slice(0, 10).split('-').reverse().join('/')) + '</td><td>' + esc(x.orgao || '') + (x.uf ? ' · ' + esc(x.uf) : '') + '</td><td class="n">' + moeda(x.unitario) + '</td></tr>'; }).join('') + '</tbody></table></details>' +
      '<div class="grupo-botoes"><button type="button" class="btn mini" data-a="mercado-buscar">Atualizar no PNCP</button><button type="button" class="btn mini fantasma" data-a="mercado-abrir">Ver na Seven Preços</button></div></div>';
  }

  function resultadoProduto(r) {
    if (!r.valido) return '<div class="cartao"><p class="alerta">Os percentuais sobre o preço somam 100% ou mais. Reduza margem ou despesas.</p></div>';
    if (!r.custoDireto) return '<div class="cartao"><h3>Resultado</h3><p class="mudo">Informe o custo de compra para calcular.</p></div>' + blocoMercado(est.produto.nome, r);
    const p = est.produto;
    const linhas = [['Compra', r.diretos.compra], ['Frete de compra', r.diretos.freteCompra], ['Embalagem', r.diretos.embalagem], ['Outros custos', r.diretos.outros], ['Frete de entrega (rateado)', r.diretos.freteEntrega], ['Custos de participação (rateados)', r.diretos.participacao], ['ICMS-ST pago na compra', r.diretos.st], ['DIFAL', r.diretos.difal], ['Reajuste esperado até a compra', r.diretos.reajuste], ['Crédito de ICMS da compra', r.diretos.creditoIcms]].filter(function (x) { return x[1]; });
    const pcts = [[p.regime === 'simples' ? 'DAS (Simples)' : 'Impostos federais', 'impostos'], ['ICMS na venda', 'icms'], [r.comissaoBase === 'lucro' ? 'Comissão da Seven (' + pc(p.comissao) + ' do lucro)' : 'Comissão da Seven', 'comissao'], ['Comissão da Seven (complemento ' + (r.bpoBase === 'lucro' ? 'do lucro' : 'do preço') + ')', 'bpo'], ['Custo financeiro', 'financeiro'], ['Despesas fixas', 'fixas'], ['Seguro-garantia', 'garantia'], ['Outros', 'outrosPct']].filter(function (x) { return r.sobrePreco[x[1]]; });
    const vol = n(p.quantidade) > 1 ? P.cenariosVolume(p, [0.3, 0.6, 1]) : null;
    const regs = P.compararRegimes(p, { anexo: p.anexo || 'I', rbt12: p.rbt12 });
    const base = p.regime === 'real' ? { pisCofins: 9.25, fora: 0 } : { pisCofins: 3.65, fora: 2.28 };
    const reforma = P.simularReforma(p, { pisCofins: base.pisCofins, tributosForaIcms: base.fora });
    return '<div class="cartao p-destaque"><span class="mudo">Preço de venda sugerido (unitário)</span><b class="p-preco">' + moeda(r.preco) + '</b><div class="p-mini"><span>Markup <b>' + num(r.markup, 3) + '×</b></span><span>Lucro <b>' + moeda(r.lucro) + '</b> (' + pc(r.margem) + ')</span><span>Total <b>' + moeda(r.total) + '</b></span></div></div>' +
      '<div class="cartao p-minimo"><span class="mudo">Preço mínimo (margem zero) — use como valor limite do lance</span><b>' + moeda(r.precoMinimo) + '</b><small>Total no mínimo: ' + moeda(r.totalMinimo) + '</small></div>' +
      (r.referencia ? '<div class="cartao ' + (r.cabe ? '' : 'p-alerta') + '"><h4>Contra o valor de referência (' + moeda(r.referencia) + ')</h4><p>Preço sugerido = <b>' + pc(r.descontoSobreRef * 100) + '</b> de desconto sobre a referência.<br>Vendendo pela referência, a margem seria <b>' + pc(r.margemNaReferencia) + '</b>.<br>' + (r.cabe ? 'O preço mínimo cabe na referência: dá para disputar.' : 'Nem com margem zero cabe na referência.') + (r.preco < r.referencia * 0.5 ? '<br><span class="alerta">Abaixo de 50% da referência: tenha a planilha de exequibilidade pronta.</span>' : '') + '</p></div>' : '') +
      blocoMercado(p.nome, r) +
      '<div class="cartao"><h4>Composição do preço</h4><table class="tabela compacta"><tbody>' + linhas.map(function (x) { return '<tr><td>' + x[0] + '</td><td class="n">' + moeda(x[1]) + '</td><td class="n mudo">' + pc(x[1] / r.preco * 100) + '</td></tr>'; }).join('') +
      '<tr><th>Custo direto</th><th class="n">' + moeda(r.custoDireto) + '</th><th class="n">' + pc(r.custoDireto / r.preco * 100) + '</th></tr>' +
      pcts.map(function (x) { return '<tr><td>' + x[0] + '</td><td class="n">' + moeda(r.valores[x[1]]) + '</td><td class="n mudo">' + pc(r.sobrePreco[x[1]]) + '</td></tr>'; }).join('') +
      (r.partLucro ? '<tr class="mudo"><td>Lucro antes da comissão sobre o lucro</td><td class="n">' + moeda(r.lucroAntes) + '</td><td class="n">' + pc(r.margemAntes) + '</td></tr>' : '') +
      '<tr><td>Lucro líquido' + (r.partLucro ? ' (fica para a empresa)' : '') + '</td><td class="n">' + moeda(r.lucro) + '</td><td class="n mudo">' + pc(r.margem) + '</td></tr><tr><th>Preço</th><th class="n">' + moeda(r.preco) + '</th><th class="n">100%</th></tr></tbody></table>' +
      '<p class="mini mudo">' + (r.partLucro ? 'Preço = custo direto ÷ (1 − percentuais sobre o preço − lucro antes da comissão sobre o lucro). A comissão sobre o lucro não existe se não houver lucro. ' : 'Preço = custo direto ÷ (1 − soma dos percentuais sobre o preço). ') + 'Margem de contribuição: ' + moeda(r.margemContribuicao) + ' por unidade.</p></div>' +
      '<div class="cartao"><h4>Comparar regimes tributários</h4><table class="tabela compacta"><thead><tr><th>Regime</th><th class="n">Preço</th><th class="n">Tributos/un.</th></tr></thead><tbody>' + regs.map(function (g, i) { return '<tr' + (i === 0 ? ' class="p-melhor"' : '') + '><td>' + esc(g.nome) + (g.id === p.regime ? ' <small class="mudo">(atual)</small>' : '') + '<br><small class="mudo">' + esc(g.nota) + '</small></td><td class="n">' + moeda(g.preco) + '</td><td class="n">' + moeda(g.impostos) + '</td></tr>'; }).join('') + '</tbody></table><p class="mini mudo">Mesma margem final (' + pc(p.margem) + '). No Lucro Real o IRPJ/CSLL (34%) incide sobre o lucro. Estimativa para decidir com o contador.</p></div>' +
      (vol ? '<div class="cartao"><h4>Ata (SRP): e se o órgão comprar menos?</h4><table class="tabela compacta"><thead><tr><th>Compra</th><th class="n">Qtd.</th><th class="n">Preço necessário</th><th class="n">Margem no seu preço</th></tr></thead><tbody>' + vol.map(function (v) { return '<tr><td>' + Math.round(v.fracao * 100) + '% da ata</td><td class="n">' + v.quantidade + '</td><td class="n">' + moeda(v.preco) + '</td><td class="n ' + (v.margemNoPrecoCheio < 0 ? 'atrasado' : '') + '">' + pc(v.margemNoPrecoCheio) + '</td></tr>'; }).join('') + '</tbody></table><p class="mini mudo">Frete e custos de participação são totais: com menos unidades, pesam mais em cada uma.</p></div>' : '') +
      '<details class="cartao"><summary><b>Reforma tributária: preço por ano (CBS e IBS)</b></summary><table class="tabela compacta"><thead><tr><th>Ano</th><th class="n">CBS</th><th class="n">IBS</th><th class="n">ICMS</th><th class="n">Carga s/ preço</th><th class="n">Preço</th></tr></thead><tbody>' + reforma.map(function (x) { return '<tr><td>' + x.ano + (x.teste ? ' <small class="mudo">teste</small>' : '') + '</td><td class="n">' + pc(x.cbs) + '</td><td class="n">' + pc(x.ibs) + '</td><td class="n">' + Math.round(x.icmsFracao * 100) + '%</td><td class="n">' + pc(x.cargaSobrePreco) + '</td><td class="n">' + moeda(x.preco) + '</td></tr>'; }).join('') + '</tbody></table><p class="mini mudo">Alíquotas de CBS (8,8%) e IBS (17,7%) são estimativas de referência; confirme as fixadas em lei. A partir de 2027 o PIS/COFINS sai e a CBS entra com crédito sobre a compra; de 2029 a 2032 o ICMS cai 10% ao ano e o IBS sobe. Base: ' + (p.regime === 'real' ? 'Lucro Real' : 'Lucro Presumido') + '. Use para contratos que passam de 2026.</p></details>' +
      '<div class="cartao"><h4>Simulador de lances</h4><table class="tabela compacta"><thead><tr><th class="n">Lance</th>' + (r.referencia ? '<th class="n">Desconto</th>' : '') + '<th class="n">Margem</th><th class="n">Lucro total</th></tr></thead><tbody>' + P.tabelaLances(r, 8).map(function (l) { return '<tr class="' + (l.margem < 0 ? 'atrasado' : '') + '"><td class="n">' + moeda(l.preco) + '</td>' + (r.referencia ? '<td class="n">' + pc(l.desconto * 100) + '</td>' : '') + '<td class="n">' + pc(l.margem) + '</td><td class="n">' + moeda(l.lucroTotal) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  // ---------- planilha de exequibilidade (PDF no papel timbrado) ----------
  async function exequibilidade(itens, cab) {
    cab = cab || {}; const emp = Dados.empresaAtiva(); const caixa = document.createElement('div'); caixa.className = 'cm-relatorio p-exeq';
    caixa.innerHTML = '<header class="cabecalho-seven cm-cab-rel"><div><b>Planilha de composição de custos e formação de preço</b><small>' + esc([emp ? (emp.razao || emp.fantasia) + (emp.cnpj ? ' · CNPJ ' + UI.cnpj(emp.cnpj) : '') : '', cab.licitacao || ''].filter(Boolean).join(' · ')) + '</small></div></header>' +
      '<p>Demonstração da exequibilidade do preço ofertado (art. 59, § 2º, da Lei 14.133/2021 e art. 34 da IN SEGES/ME 73/2022). Valores unitários em reais.</p>' +
      itens.map(function (it) {
        const r = it.r, p = it.p; const lin = [['Custo de aquisição', r.diretos.compra], ['Frete de compra', r.diretos.freteCompra], ['Embalagem', r.diretos.embalagem], ['Outros custos diretos', r.diretos.outros], ['Frete até o órgão (rateado)', r.diretos.freteEntrega], ['Custos de participação (rateados)', r.diretos.participacao], ['ICMS-ST na compra', r.diretos.st], ['DIFAL na compra', r.diretos.difal], ['Reajuste esperado do custo', r.diretos.reajuste], ['(−) Crédito de ICMS', r.diretos.creditoIcms]].filter(function (x) { return x[1]; });
        const pcts = [['Tributos sobre a venda', 'impostos'], ['ICMS na venda', 'icms'], ['Comissão de intermediação', 'comissao'], ['Comissão de intermediação (complemento)', 'bpo'], ['Custo financeiro', 'financeiro'], ['Despesas administrativas', 'fixas'], ['Seguro-garantia', 'garantia'], ['Outras despesas', 'outrosPct']].filter(function (x) { return r.sobrePreco[x[1]]; });
        return '<section class="cartao"><h3>' + esc(it.nome) + (it.qtd ? ' · ' + esc(String(it.qtd)) + ' ' + esc(it.unidade || 'un.') : '') + '</h3><table class="tabela"><thead><tr><th>Componente</th><th class="n">Valor unitário</th><th class="n">% do preço</th></tr></thead><tbody>' +
          lin.map(function (x) { return '<tr><td>' + x[0] + '</td><td class="n">' + moeda(x[1]) + '</td><td class="n">' + pc(x[1] / (it.preco || r.preco) * 100) + '</td></tr>'; }).join('') +
          '<tr><th>Custo direto</th><th class="n">' + moeda(r.custoDireto) + '</th><th class="n">' + pc(r.custoDireto / (it.preco || r.preco) * 100) + '</th></tr>' +
          pcts.map(function (x) {
            // comissão sobre o lucro acompanha o lucro do preço ofertado (que pode ser diferente do sugerido)
            const sobreLucro = (x[1] === 'comissao' && r.comissaoBase === 'lucro') || (x[1] === 'bpo' && r.bpoBase === 'lucro');
            const m = it.margem != null ? it.margem : r.margem; const pp = sobreLucro && r.partLucro ? m / (1 - r.partLucro) * (x[1] === 'comissao' ? n(p.comissao) : n(p.taxaBpo)) / 100 : r.sobrePreco[x[1]];
            return '<tr><td>' + x[0] + '</td><td class="n">' + moeda((it.preco || r.preco) * pp / 100) + '</td><td class="n">' + pc(pp) + '</td></tr>'; }).join('') +
          '<tr><td>Lucro</td><td class="n">' + moeda((it.preco || r.preco) * (it.margem != null ? it.margem : r.margem) / 100) + '</td><td class="n">' + pc(it.margem != null ? it.margem : r.margem) + '</td></tr>' +
          '<tr><th>Preço ofertado</th><th class="n">' + moeda(it.preco || r.preco) + '</th><th class="n">100%</th></tr></tbody></table>' +
          '<p class="mini">Preço mínimo que cobre todos os custos e tributos (lucro zero): <b>' + moeda(r.precoMinimo) + '</b>. ' + (r.referencia ? 'Valor de referência: ' + moeda(r.referencia) + '.' : '') + '</p></section>';
      }).join('') +
      '<p class="mini">Declaramos que os preços ofertados cobrem integralmente os custos de aquisição, tributos, encargos e despesas da contratação, e que temos condições de executar o objeto pelo valor proposto. Documentos de suporte (notas de compra e cotações) ficam à disposição para diligência.</p>' +
      '<p class="mini">' + esc(UI.data(new Date().toISOString().slice(0, 10))) + '<br><br>______________________________________<br>' + esc(emp ? (emp.representante || 'Representante legal') + ' · ' + (emp.razao || emp.fantasia) : 'Representante legal') + '</p>';
    document.body.appendChild(caixa); caixa.style.position = 'absolute'; caixa.style.left = '-30000px';
    try { aviso('Gerando a planilha de exequibilidade…'); await RelatorioPDF.gerar(caixa, 'seven-exequibilidade-' + Nucleo.normalizar(itens.length === 1 ? itens[0].nome : (cab.licitacao || 'itens')).replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '.pdf'); aviso('Planilha de exequibilidade pronta.'); }
    catch (err) { aviso('Não foi possível gerar o PDF: ' + (err && err.message || err), 'erro'); }
    finally { caixa.remove(); }
  }

  // ---------- serviço ----------
  function telaServico(el) {
    const s = est.servico;
    el.innerHTML = '<div class="p-grade"><form class="cartao p-form" id="s-form">' +
      '<div class="linha">' + campo('Serviço / posto', '<input name="nome" value="' + esc(s.nome) + '" placeholder="ex.: Posto de limpeza 44 h">') + campo('Regime tributário', '<select name="regime">' + opcoes(Object.keys(P.REGIMES).map(function (k) { return { v: k, t: P.REGIMES[k].t }; }), s.regime) + '</select>') + '</div>' +
      '<fieldset><legend>Custo mensal de um posto</legend><div class="linha">' + entrada('salario', 'Salário base', s.salario, 'Piso da convenção coletiva.', 'R$') + entrada('adicionais', 'Adicionais (insalubridade, periculosidade, noturno)', s.adicionais, 'Sobre o salário.', '%') + (s.detalharEncargos ? '' : entrada('encargos', 'Encargos sociais e trabalhistas', s.encargos, 'INSS, FGTS, férias, 13º, provisões. Varia com o regime.', '%')) + '</div>' +
      '<label class="check-inline"><input type="checkbox" name="detalharEncargos"' + (s.detalharEncargos ? ' checked' : '') + '> Detalhar encargos pelos módulos da IN SEGES 05/2017 (planilha do edital)</label>' +
      (s.detalharEncargos ? '<div class="linha p-in05">' + [['decimo', '13º salário (Submódulo 2.1)'], ['ferias', 'Férias + 1/3 (Submódulo 2.1)'], ['sub22', 'GPS, FGTS e outras (Submódulo 2.2)'], ['rat', 'RAT × FAP (Submódulo 2.2)'], ['rescisao', 'Provisão para rescisão (Módulo 3)'], ['reposicao', 'Reposição do profissional ausente (Módulo 4)']].map(function (c) { const v = (s.encargosIN || {})[c[0]]; return entrada('in_' + c[0], c[1], v == null ? P.ENCARGOS_PADRAO[c[0]] : v, '', '%'); }).join('') + '</div><p class="mini mudo">Pontos de partida: INSS 20%, salário-educação 2,5%, SESI/SESC 1,5%, SENAI/SENAC 1%, SEBRAE 0,6%, INCRA 0,2% e FGTS 8% = 33,8%. No Simples (Anexo IV) o INSS patronal continua; nos Anexos I a III, sai. Siga a convenção coletiva e o modelo do edital.</p>' : '') +
      '<div class="linha">' + entrada('beneficios', 'Benefícios (VT, VA, plano)', s.beneficios, '', 'R$') + entrada('uniformes', 'Uniformes e EPI', s.uniformes, 'Por mês.', 'R$') + entrada('insumos', 'Materiais e insumos', s.insumos, 'Por mês.', 'R$') + entrada('equipamentos', 'Equipamentos (depreciação)', s.equipamentos, 'Por mês.', 'R$') + entrada('outros', 'Outros', s.outros, '', 'R$') + '</div>' +
      '<div class="linha">' + entrada('postos', 'Quantidade de postos', s.postos, '', 'postos') + entrada('meses', 'Meses de contrato', s.meses, '', 'meses') + '</div></fieldset>' +
      '<fieldset><legend>BDI (Benefícios e Despesas Indiretas)</legend><div class="linha">' + entrada('administracao', 'Administração central (AC)', s.administracao, '', '%') + entrada('seguro', 'Seguro (S)', s.seguro, '', '%') + entrada('risco', 'Risco (R)', s.risco, '', '%') + entrada('garantia', 'Garantia (G)', s.garantia, '', '%') + '</div><div class="linha">' + entrada('financeiro', 'Despesas financeiras (DF)', s.financeiro, '', '%') + entrada('lucro', 'Lucro (L)', s.lucro, '', '%') + entrada('tributos', 'Tributos sobre o faturamento (T)', s.tributos, 'ISS, PIS, COFINS e outros.', '%') + '</div>' +
      '<p class="mini mudo">BDI = ((1 + AC + S + R + G) × (1 + DF) × (1 + L)) ÷ (1 − T) − 1 — fórmula do Acórdão 2.622/2013 do TCU. Os valores iniciais são exemplo; ajuste ao edital e à realidade da empresa.</p></fieldset>' +
      '<fieldset><legend>Referência</legend><div class="linha">' + entrada('referencia', 'Valor mensal de referência do edital', s.referencia, '', 'R$') + '</div></fieldset>' +
      '<div class="grupo-botoes"><button type="button" class="btn primario" data-a="salvar">' + (est.editando.servico ? 'Salvar alterações' : 'Salvar precificação') + '</button><button type="button" class="btn" data-a="aplicar">Aplicar à proposta</button><button type="button" class="btn" data-a="limite">Usar como valor limite</button><button type="button" class="btn fantasma" data-a="imprimir">Imprimir planilha</button><button type="button" class="btn fantasma" data-a="limpar">Limpar</button></div></form>' +
      '<aside class="p-res" id="s-res"></aside></div>';
    const form = el.querySelector('#s-form');
    const atualizar = function () {
      const d = lerForm(form, est.servico); d.detalharEncargos = !!(form.detalharEncargos && form.detalharEncargos.checked); d.encargosIN = Object.assign({}, d.encargosIN);
      Object.keys(P.ENCARGOS_PADRAO).forEach(function (k) { if (form['in_' + k]) d.encargosIN[k] = n(form['in_' + k].value); delete d['in_' + k]; }); est.servico = d;
      el.querySelector('#s-res').innerHTML = resultadoServico(P.servico(est.servico), est.servico); };
    form.oninput = atualizar;
    form.onchange = function (ev) { if (ev.target.name === 'detalharEncargos') { atualizar(); App.redesenhar(); return; } if (ev.target.name === 'regime') { const r = P.REGIMES[ev.target.value].servico; if (r.tributos != null) form.tributos.value = String(r.tributos).replace('.', ','); atualizar(); } };
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
    const en = r.encargosIN05;
    const linhas = [['Remuneração (com adicionais)', r.posto.remuneracao], ['Encargos sociais' + (en ? ' (' + pc(en.pct) + ')' : ''), r.posto.encargos], ['Benefícios', r.posto.beneficios], ['Uniformes e EPI', r.posto.uniformes], ['Materiais e insumos', r.posto.insumos], ['Equipamentos', r.posto.equipamentos], ['Outros', r.posto.outros]].filter(function (x) { return x[1]; });
    return '<div class="cartao p-destaque"><span class="mudo">Preço mensal (' + r.postos + ' posto(s))</span><b class="p-preco">' + moeda(r.precoMensal) + '</b><div class="p-mini"><span>BDI <b>' + pc(r.bdi * 100) + '</b></span><span>Por posto <b>' + moeda(r.precoPosto) + '</b></span><span>' + r.meses + ' meses <b>' + moeda(r.precoTotal) + '</b></span></div></div>' +
      '<div class="cartao p-minimo"><span class="mudo">Preço mínimo mensal (lucro zero)</span><b>' + moeda(r.precoMinimoMensal) + '</b><small>No contrato todo: ' + moeda(r.precoMinimoMensal * r.meses) + '</small></div>' +
      (r.referencia ? '<div class="cartao ' + (r.cabe ? '' : 'p-alerta') + '"><h4>Contra a referência (' + moeda(r.referencia) + '/mês)</h4><p>Desconto do preço sugerido: <b>' + pc(r.descontoSobreRef * 100) + '</b>. ' + (r.cabe ? 'Desconto máximo até o mínimo: <b>' + pc((1 - r.precoMinimoMensal / r.referencia) * 100) + '</b>.' : '<b class="alerta">O mínimo está acima da referência.</b>') + '</p></div>' : '') +
      '<div class="cartao"><h4>Custo de um posto</h4><table class="tabela compacta"><tbody>' + linhas.map(function (x) { return '<tr><td>' + x[0] + '</td><td class="n">' + moeda(x[1]) + '</td></tr>'; }).join('') + '<tr><th>Custo do posto</th><th class="n">' + moeda(r.custoPosto) + '</th></tr><tr><td>× ' + r.postos + ' posto(s) = custo mensal</td><td class="n">' + moeda(r.custoMensal) + '</td></tr><tr><td>Tributos no mês</td><td class="n">' + moeda(r.tributosValor) + '</td></tr><tr><td>Lucro no mês</td><td class="n">' + moeda(r.lucroValor) + '</td></tr></tbody></table></div>' +
      (en ? '<div class="cartao"><h4>Encargos pela IN SEGES 05/2017</h4><table class="tabela compacta"><tbody>' + [['Módulo 1 · Remuneração', en.m1], ['Submódulo 2.1 · 13º, férias e adicional', en.m21], ['Submódulo 2.2 · GPS, FGTS e outras (incide também sobre o 2.1)', en.m22], ['Módulo 3 · Provisão para rescisão', en.m3], ['Módulo 4 · Reposição do profissional ausente', en.m4]].map(function (x) { return '<tr><td>' + x[0] + '</td><td class="n">' + moeda(x[1]) + '</td><td class="n mudo">' + pc(en.m1 ? x[1] / en.m1 * 100 : 0) + '</td></tr>'; }).join('') + '<tr><th>Encargos (2 + 3 + 4)</th><th class="n">' + moeda(en.total) + '</th><th class="n">' + pc(en.pct) + '</th></tr></tbody></table><p class="mini mudo">Módulos 5 (insumos) e 6 (custos indiretos, tributos e lucro) estão nos custos do posto e no BDI.</p></div>' : '') +
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
    titulo: 'Seven Precificação',
    resultadoProduto: resultadoProduto, exequibilidade: exequibilidade, unificarComissao: unificarComissao,
    render: function (el, sub) {
      sub = sub || 'produto';
      el.innerHTML = abas([{ id: 'produto', t: 'Produto' }, { id: 'servico', t: 'Serviço (mão de obra)' }, { id: 'lote', t: 'Vários itens (proposta inteira)' }, { id: 'salvas', t: 'Salvas', n: e().precificacoes.length }], sub, 'precificacao') + '<div id="aba"></div>';
      ({ produto: telaProduto, servico: telaServico, lote: Telas.planilhaPrecos.render, salvas: telaSalvas }[sub] || telaProduto)(el.querySelector('#aba'));
      el.onclick = null;
    }
  };
})();
