/* Seven Comissão: comissão sobre o preço de venda ou sobre o lucro líquido, com metas e todos os cenários.
   O cálculo está em js/comissao.js; os valores digitados ficam salvos e são os mesmos da janela flutuante. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, campo, aviso } = UI;
  const K = Comissao;
  const PADRAO = { base: 'venda', pct: '5', venda: '', margem: '', alvo: '', retencao: '', contratos: '1', usarCustos: false, custo: '', impostos: '', despesas: '', pcts: '1 2 3 4 5 7,5 10 15 20 25 30', margens: '5 10 15 20 25 30', dataSessao: '', prazos: {}, taxa: '20', disputasMes: '8', custoDisputa: '', custoFixo: '' };

  function estado() { const d = Dados.e; d.comissao = Object.assign({}, PADRAO, d.comissao || {}); return d.comissao; }
  function n(v) { if (v == null || String(v).trim() === '') return null; const x = Nucleo.lerNumeroBR(v); return isFinite(x) ? x : null; }
  function pc(v, c) { return v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: c == null ? 2 : c }) + '%'; }
  // números a partir do que foi digitado (margem pelos custos quando marcado)
  function entrada(s) {
    s = s || estado(); const venda = n(s.venda);
    const margem = s.usarCustos ? K.margemDosCustos(venda, n(s.custo), n(s.impostos), n(s.despesas)) : n(s.margem);
    return { base: s.base, pct: n(s.pct), venda: venda, margem: margem, alvo: n(s.alvo), retencao: n(s.retencao), contratos: n(s.contratos) };
  }
  let tSalvar = null;
  function salvarDepois() { clearTimeout(tSalvar); tSalvar = setTimeout(function () { tSalvar = null; Dados.salvar(); }, 500); }
  function salvarJa() { if (tSalvar) { clearTimeout(tSalvar); tSalvar = null; Dados.salvar(); } }
  window.addEventListener('pagehide', salvarJa); window.addEventListener('beforeunload', salvarJa); window.addEventListener('hashchange', salvarJa);
  function avisarMudanca(origem) { document.dispatchEvent(new CustomEvent('comissao:mudou', { detail: { origem: origem } })); }

  // ---------- partes reaproveitadas pela janela flutuante ----------
  function camposBase(s, compacto) {
    const nomeBase = { venda: 'Sobre o preço de venda', lucro: 'Sobre o lucro líquido' };
    return '<div class="cm-base" role="radiogroup" aria-label="Base da comissão">' + ['venda', 'lucro'].map(function (b) { return '<label class="cm-pilula"><input type="radio" name="base" value="' + b + '"' + (s.base === b ? ' checked' : '') + '><span>' + (compacto ? (b === 'venda' ? 'Sobre a venda' : 'Sobre o lucro') : nomeBase[b]) + '</span></label>'; }).join('') + '</div>' +
      '<div class="linha">' + campo(compacto ? 'Comissão %' : 'Comissão (%)', '<input name="pct" inputmode="decimal" value="' + esc(s.pct) + '" placeholder="5">') + campo(compacto ? 'Venda (R$)' : 'Valor da venda / contrato (R$)', '<input name="venda" inputmode="decimal" value="' + esc(s.venda) + '" placeholder="200.000,00">') + '</div>' +
      '<div class="linha">' + campo(compacto ? 'Margem líquida %' : 'Margem de lucro líquido (%)', '<input name="margem" inputmode="decimal" value="' + esc(s.margem) + '" placeholder="12"' + (s.usarCustos && !compacto ? ' disabled' : '') + '>', compacto ? '' : 'Lucro que sobra da venda depois de custos, impostos e despesas.') + campo(compacto ? 'Meta (R$)' : 'Quanto quero receber (R$)', '<input name="alvo" inputmode="decimal" value="' + esc(s.alvo) + '" placeholder="15.000,00">', compacto ? '' : 'Sua meta de comissão.') + '</div>' +
      '<div class="linha">' + campo(compacto ? 'Retenção %' : 'Retenções sobre a comissão (%)', '<input name="retencao" inputmode="decimal" value="' + esc(s.retencao) + '" placeholder="0">', compacto ? '' : 'Impostos ou descontos sobre o que você recebe. A meta é líquida.') + campo(compacto ? 'Licitações' : 'Nº de licitações', '<input name="contratos" inputmode="numeric" value="' + esc(s.contratos) + '" placeholder="1">', compacto ? '' : 'Divide a venda necessária entre os contratos.') + '</div>';
  }
  function resumo(r, compacto) {
    const linhas = [];
    const titulo = r.base === 'venda' ? 'sobre o preço de venda' : 'sobre o lucro líquido';
    linhas.push('<div class="cm-destaque"><small>Você recebe (' + esc(titulo) + ')</small><b>' + moeda(r.comissaoLiquida) + '</b>' + (r.retida ? '<span class="mini mudo">Bruto ' + moeda(r.comissaoBruta) + ' · retido ' + moeda(r.retida) + '</span>' : '') + '</div>');
    if (r.base === 'lucro' && r.prejuizo) linhas.push('<p class="alerta mini">Sem lucro líquido neste contrato: não há comissão sobre o lucro.</p>');
    if (r.atingiu != null) linhas.push(r.atingiu ? '<p class="cm-ok">✓ Alcança a meta de ' + moeda(r.alvo) + '</p>' : '<p class="cm-falta">Faltam ' + moeda(r.falta) + ' para a meta de ' + moeda(r.alvo) + '</p>');
    const dl = [];
    if (r.alvo != null) {
      dl.push(['Venda necessária para a meta', r.vendaNecessaria != null ? moeda(r.vendaNecessaria) : (r.base === 'lucro' ? 'informe uma margem positiva' : 'informe o percentual'), 1]);
      if (r.contratos > 1 && r.vendaPorContrato != null) dl.push(['Por licitação (' + r.contratos + ')', moeda(r.vendaPorContrato)]);
      if (r.base === 'lucro' && r.margemNecessaria != null) dl.push(['Margem líquida necessária', r.margemImpossivel ? pc(r.margemNecessaria, 1) + ' (inviável)' : pc(r.margemNecessaria, 2), 1]);
      if (r.pctNecessario != null) dl.push(['Comissão necessária nesta venda', pc(r.pctNecessario, 2)]);
    }
    if (r.lucro != null) dl.push(['Lucro líquido do contrato', moeda(r.lucro) + ' (' + pc(r.margem, 2) + ')']);
    if (r.equivalente != null) dl.push([r.base === 'lucro' ? 'Equivale sobre a venda a' : 'Equivale sobre o lucro a', pc(r.equivalente, 2)]);
    if (!compacto && r.comissaoSobreVenda != null && r.comissaoSobreLucro != null) dl.push(['Comparando no mesmo %', 'venda ' + moeda(r.comissaoSobreVenda) + ' · lucro ' + moeda(r.comissaoSobreLucro)]);
    if (dl.length) linhas.push('<dl class="cl-res">' + dl.map(function (l) { return '<div' + (l[2] ? ' class="dest"' : '') + '><dt>' + esc(l[0]) + '</dt><dd>' + l[1] + '</dd></div>'; }).join('') + '</dl>');
    if (r.venda == null && r.alvo == null) linhas.push('<p class="mudo mini">Informe a comissão e o valor da venda, ou a meta que quer receber.</p>');
    return linhas.join('');
  }
  // aplica o que foi digitado num formulário ao estado salvo
  function lerForm(form) {
    const s = estado(); const fd = new FormData(form);
    ['pct', 'venda', 'margem', 'alvo', 'retencao', 'contratos', 'custo', 'impostos', 'despesas', 'pcts', 'margens'].forEach(function (k) { if (form.elements[k] && !form.elements[k].disabled) s[k] = fd.get(k); });
    ['dataSessao', 'taxa', 'disputasMes', 'custoDisputa', 'custoFixo'].forEach(function (k) { if (form.elements[k]) s[k] = fd.get(k); });
    K.ETAPAS.forEach(function (e) { if (form.elements['p_' + e.id]) { s.prazos = Object.assign({}, s.prazos); s.prazos[e.id] = fd.get('p_' + e.id); } });
    if (fd.get('base')) s.base = fd.get('base');
    if (form.elements.usarCustos) s.usarCustos = form.elements.usarCustos.checked;
    return s;
  }

  // ---------- prazos, chances e retorno ----------
  function hoje() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function etapas(s) { return K.ETAPAS.map(function (e) { const v = (s.prazos || {})[e.id]; return { id: e.id, nome: e.nome, dias: v == null || String(v).trim() === '' ? e.dias : n(v) }; }); }
  function dataBR(iso) { return iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; }
  function extras(s) {
    s = s || estado(); const r = K.calcular(entrada(s));
    const pz = K.prazos(s.dataSessao || hoje(), etapas(s));
    const ch = K.chances(n(s.taxa), n(s.contratos));
    const rt = K.retorno({ taxa: n(s.taxa), disputasMes: n(s.disputasMes), custoDisputa: n(s.custoDisputa), custoFixo: n(s.custoFixo), comissaoPorVitoria: r.comissaoLiquida, diasRecebimento: pz ? pz.totalDias : 0, meses: 36 });
    return { r: r, prazo: pz, chances: ch, retorno: rt };
  }
  function meses(m) { return m == null ? '—' : m + (m === 1 ? ' mês' : ' meses'); }
  function resumoExtra(x, compacto) {
    const dl = [];
    if (x.prazo) dl.push(['Comissão chega em', dataBR(x.prazo.dataFinal) + ' (' + x.prazo.totalDias + ' dias)']);
    if (x.chances) dl.push(['Disputas para a 1ª vitória', '~' + Math.ceil(x.chances.esperadoPrimeira) + ' (90% de chance: ' + x.chances.confianca[2].disputas + ')']);
    if (x.chances && x.chances.vitorias > 1) dl.push(['Disputas para ' + x.chances.vitorias + ' vitórias', '~' + Math.ceil(x.chances.esperadoVitorias)]);
    if (x.retorno) dl.push(['Retorno do investimento', x.retorno.mesRetorno ? 'no ' + x.retorno.mesRetorno + 'º mês' : 'não se paga em 36 meses', 1]);
    if (x.retorno && !compacto) dl.push(['Caixa necessário até o retorno', moeda(x.retorno.investimentoMaximo)]);
    return dl.length ? '<dl class="cl-res cm-extra-res">' + dl.map(function (l) { return '<div' + (l[2] ? ' class="dest"' : '') + '><dt>' + esc(l[0]) + '</dt><dd>' + l[1] + '</dd></div>'; }).join('') + '</dl>' : '';
  }
  function secoesExtras(s) {
    const x = extras(s); let h = '';
    // prazo
    h += '<section class="cartao"><h3>Prazo para recebimento</h3>';
    h += x.prazo ? '<ol class="cm-linha-tempo"><li class="ini"><b>' + dataBR(x.prazo.inicio) + '</b><span>Sessão da licitação</span></li>' + x.prazo.etapas.map(function (e) { return '<li' + (e.id === 'pagamento' ? ' class="pg"' : e.id === 'comissao' ? ' class="fim"' : '') + '><b>' + dataBR(e.data) + '</b><span>' + esc(e.nome) + '</span><small>+' + e.dias + ' dias · ' + e.acumulado + ' no total</small></li>'; }).join('') + '</ol>' +
      '<p class="cm-prazo-res">O órgão paga por volta de <b>' + dataBR(x.prazo.dataPagamento) + '</b> (' + x.prazo.diasAtePagamento + ' dias após a sessão) e a comissão chega por volta de <b>' + dataBR(x.prazo.dataFinal) + '</b> (' + x.prazo.totalDias + ' dias).</p>' : '<p class="mudo">Informe a data da sessão.</p>';
    h += '<p class="mini mudo">Dias corridos e prazos médios: ajuste cada etapa pelo edital, pelo contrato e pelo histórico de pagamento do órgão (veja o Seven CAPAG).</p></section>';
    // chances
    h += '<section class="cartao"><h3>Quantas licitações disputar para ganhar</h3>';
    if (x.chances) {
      const c = x.chances;
      h += '<div class="cm-numeros"><div><small>Em média, para a 1ª vitória</small><b>' + Math.ceil(c.esperadoPrimeira) + ' disputas</b></div>' + (c.vitorias > 1 ? '<div><small>Em média, para ' + c.vitorias + ' vitórias</small><b>' + Math.ceil(c.esperadoVitorias) + ' disputas</b></div>' : '') + c.confianca.map(function (k) { return '<div><small>' + k.confianca + '% de chance de ganhar ao menos uma</small><b>' + k.disputas + ' disputas</b></div>'; }).join('') + '</div>' +
        '<div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>Disputas</th>' + c.tabela.map(function (t) { return '<th class="n">' + t.disputas + '</th>'; }).join('') + '</tr></thead><tbody><tr><th>Chance de ganhar ao menos 1</th>' + c.tabela.map(function (t) { return '<td class="n">' + pc(t.chance, 0) + '</td>'; }).join('') + '</tr><tr><th>Vitórias esperadas</th>' + c.tabela.map(function (t) { return '<td class="n">' + Number(t.esperadas).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '</td>'; }).join('') + '</tr></tbody></table></div>' +
        '<p class="mini mudo">Com taxa de sucesso de ' + pc(c.taxa) + ' por disputa. Cada licitação é tratada como independente; a taxa real sai do seu histórico de propostas ganhas e perdidas.</p>';
    } else h += '<p class="mudo">Informe a taxa de sucesso (de 1% a 100%).</p>';
    h += '</section>';
    // retorno
    h += '<section class="cartao"><h3>Prazo de retorno</h3>';
    if (x.retorno) {
      const t = x.retorno; const ate = Math.min(t.linhas.length, Math.max(12, (t.mesRetorno || 0) + 3));
      h += '<div class="cm-numeros"><div><small>1ª vitória esperada</small><b>' + meses(t.mesPrimeiraVitoria) + '</b></div><div><small>1º recebimento</small><b>' + meses(t.mesPrimeiroRecebimento) + '</b></div><div class="' + (t.mesRetorno ? 'ok' : 'ruim') + '"><small>Retorno (acumulado positivo)</small><b>' + (t.mesRetorno ? 'no ' + t.mesRetorno + 'º mês' : 'não se paga') + '</b></div><div><small>Caixa necessário até lá</small><b>' + moeda(t.investimentoMaximo) + '</b></div><div class="' + (t.viavel ? 'ok' : 'ruim') + '"><small>Resultado por mês, depois de receber</small><b>' + moeda(t.lucroMes) + '</b></div></div>' +
        (t.viavel ? '' : '<p class="alerta mini">Os custos por mês (' + moeda(t.custoMes) + ') são maiores que as comissões esperadas (' + moeda(t.receitaMes) + '). Aumente o ritmo de disputas, a taxa de sucesso ou a comissão, ou reduza os custos.</p>') +
        '<div class="tabela-rolagem"><table class="tabela compacta cm-retorno"><thead><tr><th>Mês</th><th class="n">Vitórias</th><th class="n">Comissões recebidas</th><th class="n">Custos</th><th class="n">Saldo do mês</th><th class="n">Acumulado</th></tr></thead><tbody>' + t.linhas.slice(0, ate).map(function (l) { return '<tr' + (l.mes === t.mesRetorno ? ' class="cm-atual"' : '') + '><th>' + l.mes + 'º</th><td class="n">' + Number(l.vitorias).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '</td><td class="n">' + moeda(l.receita) + '</td><td class="n">' + moeda(l.custo) + '</td><td class="n">' + moeda(l.saldo) + '</td><td class="n ' + (l.acumulado >= 0 ? 'pos' : 'neg') + '">' + moeda(l.acumulado) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<p class="mini mudo">Média esperada: ' + Number(n(s.disputasMes)).toLocaleString('pt-BR') + ' disputas por mês × ' + pc(n(s.taxa)) + ' de sucesso × ' + moeda(x.r.comissaoLiquida) + ' por vitória, recebidas ' + t.atrasoMeses + ' mês(es) depois (prazo para recebimento acima).</p>';
    } else h += '<p class="mudo">Informe a comissão e a venda (para saber quanto cada vitória rende), a taxa de sucesso e quantas licitações disputa por mês.</p>';
    h += '</section>';
    return h;
  }

  // ---------- cenários ----------
  function tabelaCenarios(s) {
    const o = entrada(s); const pcts = K.lerLista(s.pcts), margens = K.lerLista(s.margens); const c = K.cenarios(o, pcts, margens);
    const cab = '<thead><tr><th>Comissão</th>' + c.colunas.map(function (col) { return '<th class="n' + (col.base === o.base && (col.base === 'venda' || Math.abs(col.margem - (o.margem || -1)) < 1e-9) ? ' cm-atual' : '') + '">' + (col.base === 'venda' ? 'Sobre a venda' : 'Lucro · margem ' + pc(col.margem, 1)) + '</th>'; }).join('') + '</tr></thead>';
    const linhaAtual = function (x) { return o.pct != null && Math.abs(x - o.pct) < 1e-9; };
    const tab = function (campoValor, vazio) {
      return '<div class="tabela-rolagem"><table class="tabela compacta cm-tab">' + cab + '<tbody>' + c.linhas.map(function (l) { return '<tr' + (linhaAtual(l.pct) ? ' class="cm-atual"' : '') + '><th>' + pc(l.pct, 2) + '</th>' + l.celulas.map(function (cel) { const v = cel[campoValor]; return '<td class="n' + (campoValor === 'comissao' && cel.atingiu ? ' cm-bate' : '') + '">' + (v == null ? vazio : moeda(v)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    };
    let h = '<section class="cartao"><h3>Quanto você recebe em cada cenário</h3>' + (o.venda == null ? '<p class="mudo">Informe o valor da venda para ver a comissão em cada cenário.</p>' : '<p class="mini mudo">Venda de ' + moeda(o.venda) + (o.retencao ? ', já descontadas as retenções de ' + pc(o.retencao) : '') + '.' + (o.alvo != null ? ' Em verde, os cenários que alcançam a meta de ' + moeda(o.alvo) + '.' : '') + '</p>' + tab('comissao', '—')) + '</section>';
    h += '<section class="cartao"><h3>Quanto precisa vender em licitação para chegar à meta</h3>' + (o.alvo == null ? '<p class="mudo">Informe quanto quer receber para ver a venda necessária.</p>' : '<p class="mini mudo">Meta de ' + moeda(o.alvo) + (o.retencao ? ' líquidos (' + moeda(o.alvo / (1 - o.retencao / 100)) + ' brutos)' : '') + (o.contratos > 1 ? ', valor total somando as ' + Math.round(o.contratos) + ' licitações' : '') + '.</p>' + tab('vendaNecessaria', '—')) + '</section>';
    h += '<section class="cartao"><h3>Margem de lucro líquido necessária (comissão sobre o lucro)</h3>' + (o.alvo == null || o.venda == null ? '<p class="mudo">Informe a venda e a meta para ver a margem que o contrato precisa ter.</p>' : '<p class="mini mudo">Com venda de ' + moeda(o.venda) + ' e meta de ' + moeda(o.alvo) + '.</p><div class="cm-margens">' + c.margensNecessarias.map(function (x) { return '<div class="cm-mg' + (x.impossivel ? ' inviavel' : '') + (linhaAtual(x.pct) ? ' atual' : '') + '"><small>' + pc(x.pct, 2) + ' do lucro</small><b>' + (x.margem == null ? '—' : pc(x.margem, 1)) + '</b>' + (x.impossivel ? '<span>inviável</span>' : '') + '</div>'; }).join('') + '</div>') + '</section>';
    return h;
  }

  function render(el) {
    const s = estado();
    el.innerHTML = '<div class="cm"><form class="cartao cm-form" id="cm-form" autocomplete="off"><h3>Dados da comissão</h3>' + camposBase(s, false) +
      '<label class="check"><input type="checkbox" name="usarCustos"' + (s.usarCustos ? ' checked' : '') + '> Calcular a margem pelos custos do contrato</label>' +
      '<div class="linha cm-custos"' + (s.usarCustos ? '' : ' hidden') + '>' + campo('Custo dos produtos/serviços (R$)', '<input name="custo" inputmode="decimal" value="' + esc(s.custo) + '">') + campo('Impostos sobre a venda (%)', '<input name="impostos" inputmode="decimal" value="' + esc(s.impostos) + '">') + campo('Outras despesas (%)', '<input name="despesas" inputmode="decimal" value="' + esc(s.despesas) + '">', 'Frete, taxas, financeiro.') + '</div>' +
      '<div class="grupo-botoes"><button type="button" class="btn mini" data-a="janela" title="Abre a Seven Comissão em janela por cima de qualquer tela (Alt+M)">⧉ Abrir em janela flutuante</button><button type="button" class="btn mini fantasma" data-a="limpar">Limpar</button></div></form>' +
      '<section class="cartao cm-res" id="cm-res" aria-live="polite"></section></div>' +
      '<form class="cartao cm-extra" id="cm-extra" autocomplete="off"><h3>Prazos, chances e retorno</h3><div class="linha">' + campo('Data da sessão', '<input type="date" name="dataSessao" value="' + esc(s.dataSessao || hoje()) + '">') + campo('Taxa de sucesso (%)', '<input name="taxa" inputmode="decimal" value="' + esc(s.taxa) + '">', 'De cada 100 disputas, quantas você ganha.') + campo('Disputas por mês', '<input name="disputasMes" inputmode="decimal" value="' + esc(s.disputasMes) + '">') + campo('Custo por disputa (R$)', '<input name="custoDisputa" inputmode="decimal" value="' + esc(s.custoDisputa) + '">', 'Certidões, garantias, viagens, plataformas.') + campo('Custo fixo mensal (R$)', '<input name="custoFixo" inputmode="decimal" value="' + esc(s.custoFixo) + '">', 'Equipe, sistemas, escritório.') + '</div>' +
      '<details class="cm-etapas"><summary>Dias de cada etapa até receber</summary><div class="linha">' + etapas(s).map(function (e) { return campo(e.nome, '<input name="p_' + e.id + '" inputmode="numeric" value="' + esc(String(e.dias)) + '">'); }).join('') + '</div></details></form>' +
      '<div id="cm-extra-res"></div>' +
      '<form class="cartao cm-listas" id="cm-listas"><h3>Todos os cenários</h3><div class="linha">' + campo('Percentuais de comissão', '<input name="pcts" value="' + esc(s.pcts) + '">', 'Separe por espaço. Ex.: 1 2 5 10 20 30') + campo('Margens de lucro líquido (%)', '<input name="margens" value="' + esc(s.margens) + '">', 'Colunas das tabelas de comissão sobre o lucro.') + '</div></form>' +
      '<div id="cm-cen"></div>' +
      '<details class="cartao cm-formulas"><summary>Como é calculado</summary><ul class="mini">' +
      '<li><b>Sobre a venda:</b> comissão = venda × % · venda necessária = meta ÷ %</li>' +
      '<li><b>Sobre o lucro líquido:</b> lucro = venda × margem · comissão = lucro × % · venda necessária = meta ÷ (% × margem) · margem necessária = meta ÷ (venda × %)</li>' +
      '<li><b>Retenções:</b> a meta é o que você recebe líquido; a comissão bruta necessária = meta ÷ (1 − retenção).</li>' +
      '<li><b>Equivalência:</b> X% do lucro com margem M% = X × M% da venda. Ex.: 30% do lucro com 12% de margem = 3,6% da venda.</li>' +
      '<li><b>Margem pelos custos:</b> (venda − custo − impostos − despesas) ÷ venda.</li>' +
      '<li><b>Disputas para ganhar:</b> em média 1 ÷ taxa de sucesso; para ter C% de chance de ao menos uma vitória, n = ln(1 − C) ÷ ln(1 − taxa).</li>' +
      '<li><b>Retorno:</b> por mês, vitórias = disputas × taxa; a comissão de cada vitória entra depois do prazo para recebimento; o retorno é o mês em que o acumulado (comissões − custos) fica positivo.</li></ul></details>';
    const form = el.querySelector('#cm-form'), listas = el.querySelector('#cm-listas'), extra = el.querySelector('#cm-extra');
    const atualizar = function () {
      const r = K.calcular(entrada()); el.querySelector('#cm-res').innerHTML = '<h3>Resultado</h3>' + resumo(r, false);
      el.querySelector('#cm-cen').innerHTML = tabelaCenarios(estado());
      el.querySelector('#cm-extra-res').innerHTML = secoesExtras(estado());
      if (estado().usarCustos) { const m = entrada().margem; form.elements.margem.value = m == null ? '' : String(Math.round(m * 100) / 100).replace('.', ','); }
    };
    const mudou = function (ev) {
      lerForm(form); lerForm(listas); lerForm(extra);
      if (ev && ev.target && ev.target.name === 'usarCustos') { form.querySelector('.cm-custos').hidden = !estado().usarCustos; form.elements.margem.disabled = estado().usarCustos; }
      atualizar(); salvarDepois(); avisarMudanca('tela');
    };
    form.oninput = form.onchange = mudou; listas.oninput = mudou; extra.oninput = extra.onchange = mudou;
    form.onsubmit = listas.onsubmit = extra.onsubmit = function (ev) { ev.preventDefault(); };
    el.onclick = function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'janela') ComissaoFlutuante.abrir();
      if (b.dataset.a === 'limpar') { Dados.e.comissao = Object.assign({}, PADRAO); Dados.salvar(); avisarMudanca('tela'); App.redesenhar(); aviso('Campos limpos.'); }
    };
    atualizar();
  }
  // a janela flutuante mudou algo: redesenha a tela se ela estiver aberta
  document.addEventListener('comissao:mudou', function (ev) { if (ev.detail && ev.detail.origem === 'janela' && /^#\/comissao/.test(location.hash) && document.querySelector('#cm-form')) render(document.getElementById('conteudo')); });

  Telas.comissao = { titulo: 'Seven Comissão', render: render, estado: estado, entrada: entrada, camposBase: camposBase, resumo: resumo, lerForm: lerForm, extras: extras, resumoExtra: resumoExtra, salvarDepois: salvarDepois, avisarMudanca: avisarMudanca };
})();
