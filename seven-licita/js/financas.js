/* Plataforma 7 — motor de Minhas Finanças: saldos, faturas, parcelas, orçamentos, relatórios e importação OFX/CSV. Sem DOM. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Financas = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const r2 = function (v) { return Math.round((Number(v) || 0) * 100) / 100; };
  const mesDe = function (d) { return String(d || '').slice(0, 7); };
  function addMeses(iso, n) {
    const p = String(iso).slice(0, 10).split('-').map(Number); const d = new Date(p[0], p[1] - 1 + n, 1);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(Math.min(p[2], ultimo)).padStart(2, '0');
  }
  function addDias(iso, n) { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

  const CATEGORIAS_PADRAO = [
    ['Salário', 'receita', '#2e9e5b', 'receita'], ['Vendas / serviços', 'receita', '#127a64', 'receita'], ['Honorários', 'receita', '#3d7be0', 'receita'], ['Rendimentos', 'receita', '#7a55c7', 'receita'], ['Outras receitas', 'receita', '#8c9bab', 'receita'],
    ['Moradia', 'despesa', '#b68d40', 'fixa'], ['Alimentação', 'despesa', '#e8892e', 'variavel'], ['Transporte', 'despesa', '#3d7be0', 'variavel'], ['Saúde', 'despesa', '#d9559a', 'fixa'], ['Educação', 'despesa', '#7a55c7', 'fixa'],
    ['Lazer', 'despesa', '#e6b800', 'variavel'], ['Compras', 'despesa', '#d94b3f', 'variavel'], ['Contas da casa', 'despesa', '#5f6670', 'fixa'], ['Impostos e taxas', 'despesa', '#800000', 'imposto'], ['Fornecedores / custos', 'despesa', '#0a1929', 'custo'],
    ['Pessoal / pró-labore', 'despesa', '#127a64', 'operacional'], ['Marketing', 'despesa', '#e774bb', 'operacional'], ['Tarifas bancárias', 'despesa', '#69727d', 'financeira'], ['Investimentos', 'despesa', '#2f7be0', 'investimento'], ['Outras despesas', 'despesa', '#8c9bab', 'variavel']
  ];

  // Mês da fatura de uma compra no cartão: compras a partir do dia de fechamento vão para a fatura seguinte.
  // A fatura recebe o nome do mês do vencimento.
  function mesFatura(dataCompra, fechamento, vencimento) {
    const p = String(dataCompra).slice(0, 10).split('-').map(Number);
    let ano = p[0], mes = p[1];
    if (p[2] >= Number(fechamento || 1)) { mes++; if (mes > 12) { mes = 1; ano++; } }
    if (Number(vencimento) <= Number(fechamento)) { mes++; if (mes > 12) { mes = 1; ano++; } }
    return ano + '-' + String(mes).padStart(2, '0');
  }

  function fatura(cartao, lancs, mes) {
    const itens = lancs.filter(function (l) { return l.cartao === cartao.id && l.tipo === 'despesa' && (l.fatura || mesFatura(l.data, cartao.fechamento, cartao.vencimento)) === mes; });
    const estornos = lancs.filter(function (l) { return l.cartao === cartao.id && l.tipo === 'receita' && (l.fatura || mesFatura(l.data, cartao.fechamento, cartao.vencimento)) === mes; });
    const total = r2(itens.reduce(function (s, l) { return s + Number(l.valor); }, 0) - estornos.reduce(function (s, l) { return s + Number(l.valor); }, 0));
    const pagamentos = lancs.filter(function (l) { return l.tipo === 'pagamento-fatura' && l.cartao === cartao.id && l.fatura === mes && l.pago; });
    const pago = r2(pagamentos.reduce(function (s, l) { return s + Number(l.valor); }, 0));
    const p = mes.split('-').map(Number); const venc = mes + '-' + String(Math.min(Number(cartao.vencimento) || 10, new Date(p[0], p[1], 0).getDate())).padStart(2, '0');
    return { mes: mes, itens: itens.concat(estornos), total: total, pago: pago, aberto: r2(total - pago), vencimento: venc };
  }

  function limiteUsado(cartao, lancs) {
    const gastos = lancs.filter(function (l) { return l.cartao === cartao.id && l.tipo === 'despesa'; }).reduce(function (s, l) { return s + Number(l.valor); }, 0);
    const creditos = lancs.filter(function (l) { return l.cartao === cartao.id && (l.tipo === 'receita' || (l.tipo === 'pagamento-fatura' && l.pago)); }).reduce(function (s, l) { return s + Number(l.valor); }, 0);
    return r2(gastos - creditos);
  }

  // Saldo de uma conta até uma data (inclusive). Só lançamentos efetivados; cartão não mexe na conta até o pagamento da fatura.
  function saldoConta(conta, lancs, ate) {
    let s = Number(conta.saldoInicial) || 0;
    lancs.forEach(function (l) {
      if (!l.pago || (ate && l.data > ate)) return;
      const v = Number(l.valor) || 0;
      if (l.tipo === 'receita' && l.conta === conta.id && !l.cartao) s += v;
      if (l.tipo === 'despesa' && l.conta === conta.id && !l.cartao) s -= v;
      if (l.tipo === 'pagamento-fatura' && l.conta === conta.id) s -= v;
      if (l.tipo === 'ajuste' && l.conta === conta.id) s += Number(l.valor) || 0; // ajuste de saldo: valor com sinal, fora de receitas e despesas
      if (l.tipo === 'transferencia') { if (l.conta === conta.id) s -= v; if (l.contaDestino === conta.id) s += v; }
    });
    return r2(s);
  }

  // Parcelas (compra parcelada) ou repetições (fixa) a partir de um lançamento-modelo.
  function gerarSerie(base, n, modo, id) {
    n = Math.max(1, Math.floor(Number(n) || 1)); const grupo = id('sr'); const out = [];
    const valorParcela = modo === 'parcelada' ? r2(Number(base.valor) / n) : r2(base.valor);
    const resto = modo === 'parcelada' ? r2(Number(base.valor) - valorParcela * n) : 0;
    for (let i = 0; i < n; i++) {
      const l = Object.assign({}, base, { id: id('lc'), data: addMeses(base.data, i), valor: r2(valorParcela + (i === 0 ? resto : 0)), serie: { grupo: grupo, i: i + 1, n: n, modo: modo }, pago: i === 0 ? !!base.pago : false });
      if (modo === 'parcelada') l.descricao = base.descricao + ' (' + (i + 1) + '/' + n + ')';
      out.push(l);
    }
    return out;
  }

  function doMes(lancs, mes) { return lancs.filter(function (l) { return mesDe(l.data) === mes; }); }

  // Resumo por competência: compras no cartão contam como despesa na data da compra.
  function resumo(lancs, mes) {
    const l = mes ? doMes(lancs, mes) : lancs;
    const soma = function (f) { return r2(l.filter(f).reduce(function (s, x) { return s + Number(x.valor); }, 0)); };
    const receitas = soma(function (x) { return x.tipo === 'receita' && !x.cartao; });
    const despesas = soma(function (x) { return x.tipo === 'despesa'; });
    const receitasPagas = soma(function (x) { return x.tipo === 'receita' && !x.cartao && x.pago; });
    const despesasPagas = soma(function (x) { return x.tipo === 'despesa' && (x.pago || x.cartao); });
    return { receitas: receitas, despesas: despesas, resultado: r2(receitas - despesas), receitasPagas: receitasPagas, despesasPagas: despesasPagas, aReceber: r2(receitas - receitasPagas), aPagar: r2(despesas - despesasPagas) };
  }

  function porCategoria(lancs, tipo) {
    const m = {};
    lancs.filter(function (l) { return l.tipo === tipo; }).forEach(function (l) { const k = l.categoria || '—'; m[k] = r2((m[k] || 0) + Number(l.valor)); });
    const total = Object.keys(m).reduce(function (s, k) { return s + m[k]; }, 0);
    return Object.keys(m).map(function (k) { return { categoria: k, valor: m[k], pct: total ? m[k] / total : 0 }; }).sort(function (a, b) { return b.valor - a.valor; });
  }

  function orcamentos(orcs, lancs, mes) {
    const gastos = porCategoria(doMes(lancs, mes), 'despesa');
    return orcs.map(function (o) { const g = (gastos.find(function (x) { return x.categoria === o.categoria; }) || {}).valor || 0; const uso = o.valor ? g / o.valor : 0; return { categoria: o.categoria, previsto: Number(o.valor), gasto: g, uso: uso, restante: r2(o.valor - g), estado: uso >= 1 ? 'estourado' : uso >= 0.8 ? 'alerta' : 'ok' }; });
  }

  // DRE simples pelo "grupo" da categoria (receita, imposto, custo, operacional, financeira…).
  function dre(lancs, categorias) {
    const g = function (id) { const c = categorias.find(function (x) { return x.id === id; }); return c ? c.grupo || (c.tipo === 'receita' ? 'receita' : 'variavel') : 'variavel'; };
    const soma = function (f) { return r2(lancs.filter(f).reduce(function (s, l) { return s + Number(l.valor); }, 0)); };
    const receita = soma(function (l) { return l.tipo === 'receita' && !l.cartao; });
    const impostos = soma(function (l) { return l.tipo === 'despesa' && g(l.categoria) === 'imposto'; });
    const custos = soma(function (l) { return l.tipo === 'despesa' && g(l.categoria) === 'custo'; });
    const financeiras = soma(function (l) { return l.tipo === 'despesa' && g(l.categoria) === 'financeira'; });
    const investimentos = soma(function (l) { return l.tipo === 'despesa' && g(l.categoria) === 'investimento'; });
    const operacionais = soma(function (l) { return l.tipo === 'despesa' && ['imposto', 'custo', 'financeira', 'investimento'].indexOf(g(l.categoria)) < 0; });
    const liquida = r2(receita - impostos); const bruto = r2(liquida - custos); const operacional = r2(bruto - operacionais);
    return { receita: receita, impostos: impostos, receitaLiquida: liquida, custos: custos, lucroBruto: bruto, operacionais: operacionais, resultadoOperacional: operacional, financeiras: financeiras, resultado: r2(operacional - financeiras), investimentos: investimentos, margem: receita ? (operacional - financeiras) / receita : null };
  }

  // Análise do mês em linguagem simples (regras, sem IA): compara com o mês anterior e aponta o que merece atenção.
  function analise(lancs, mes, categorias, orcs) {
    const ant = addMeses(mes + '-01', -1).slice(0, 7);
    const a = resumo(lancs, mes), b = resumo(lancs, ant); const nome = function (id) { const c = categorias.find(function (x) { return x.id === id; }); return c ? c.nome : 'Sem categoria'; };
    const frases = [];
    frases.push(a.resultado >= 0 ? 'O mês fecha positivo em ' + moeda(a.resultado) + '.' : 'O mês fecha negativo em ' + moeda(-a.resultado) + ': as despesas passaram as receitas.');
    if (b.despesas) { const v = (a.despesas - b.despesas) / b.despesas; if (Math.abs(v) >= 0.1) frases.push('As despesas ' + (v > 0 ? 'subiram ' : 'caíram ') + Math.round(Math.abs(v) * 100) + '% em relação ao mês anterior.'); }
    const top = porCategoria(doMes(lancs, mes), 'despesa')[0]; if (top) frases.push('O maior gasto foi com ' + nome(top.categoria) + ' (' + moeda(top.valor) + ', ' + Math.round(top.pct * 100) + '% das despesas).');
    const catAnt = porCategoria(doMes(lancs, ant), 'despesa');
    porCategoria(doMes(lancs, mes), 'despesa').forEach(function (c) { const x = catAnt.find(function (y) { return y.categoria === c.categoria; }); if (x && x.valor > 0 && c.valor > x.valor * 1.3 && c.valor - x.valor > 100) frases.push(nome(c.categoria) + ' cresceu ' + Math.round((c.valor / x.valor - 1) * 100) + '% (' + moeda(x.valor) + ' → ' + moeda(c.valor) + ').'); });
    orcamentos(orcs || [], lancs, mes).forEach(function (o) { if (o.estado === 'estourado') frases.push('Orçamento de ' + nome(o.categoria) + ' estourado em ' + moeda(-o.restante) + '.'); else if (o.estado === 'alerta') frases.push('Orçamento de ' + nome(o.categoria) + ' em ' + Math.round(o.uso * 100) + '% do previsto.'); });
    if (a.aPagar > 0) frases.push('Ainda há ' + moeda(a.aPagar) + ' em despesas a pagar neste mês.');
    if (a.receitas && a.resultado / a.receitas >= 0.2) frases.push('Boa margem de sobra: considere direcionar parte para metas ou reserva.');
    return frases;
  }
  function moeda(v) { return 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  // ---------- importação ----------
  // OFX (SGML ou XML), formato que a maioria dos bancos exporta.
  function lerOFX(texto) {
    const t = String(texto || '');
    const blocos = t.split(/<STMTTRN>/i).slice(1);
    return blocos.map(function (b) {
      const campo = function (n) { const m = b.match(new RegExp('<' + n + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
      const valor = Number(campo('TRNAMT').replace(',', '.'));
      const d = campo('DTPOSTED');
      return { data: d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8), valor: Math.abs(valor), tipo: valor < 0 ? 'despesa' : 'receita', descricao: (campo('MEMO') || campo('NAME') || 'Lançamento importado').replace(/\s+/g, ' '), idBanco: campo('FITID') };
    }).filter(function (x) { return x.data.length === 10 && isFinite(x.valor) && x.valor > 0; });
  }

  // CSV com colunas de data, descrição e valor (negativo = despesa), em qualquer ordem.
  function lerExtratoCSV(linhas, lerNumero) {
    if (!linhas.length) return [];
    const norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); };
    const cab = linhas[0].map(norm);
    const ci = function (res) { for (const re of res) { const i = cab.findIndex(function (c) { return re.test(c); }); if (i >= 0) return i; } return -1; };
    const iD = ci([/^data/]), iDesc = ci([/descri|histor|lancamento|memo/]), iV = ci([/^valor/, /quantia|montante|amount/]), iTipo = ci([/^tipo|d\/c|debito|natureza/]);
    if (iD < 0 || iV < 0) return [];
    return linhas.slice(1).map(function (l) {
      const dt = String(l[iD] || '').trim(); let iso = '';
      let m = dt.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) iso = m[3] + '-' + m[2] + '-' + m[1];
      m = dt.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) iso = m[0];
      let v = lerNumero(l[iV]); const tipoTxt = iTipo >= 0 ? norm(l[iTipo]) : '';
      const debito = v < 0 || /^d|debito|saida/.test(tipoTxt);
      return { data: iso, valor: Math.abs(v), tipo: debito ? 'despesa' : 'receita', descricao: String(l[iDesc] || 'Lançamento importado').trim() };
    }).filter(function (x) { return x.data && isFinite(x.valor) && x.valor > 0; });
  }

  // Sugestão de categoria pela descrição, aprendendo com lançamentos já categorizados.
  function sugerirCategoria(descricao, historico) {
    const palavras = norm2(descricao).split(' ').filter(function (p) { return p.length > 3; });
    let melhor = null, pontos = 0;
    historico.forEach(function (l) { if (!l.categoria) return; const d = norm2(l.descricao); const p = palavras.filter(function (w) { return d.indexOf(w) >= 0; }).length; if (p > pontos) { pontos = p; melhor = l.categoria; } });
    return melhor;
  }
  function norm2(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }


  // ---------- gestão financeira (modelo Conta Azul) ----------
  // Efeito no caixa de um lançamento (só os que passam por conta; cartão entra no pagamento da fatura).
  function efeitoCaixa(l) {
    const v = Number(l.valor) || 0;
    if (l.tipo === 'receita' && !l.cartao) return v;
    if (l.tipo === 'despesa' && !l.cartao) return -v;
    if (l.tipo === 'pagamento-fatura') return -v;
    if (l.tipo === 'ajuste') return v;
    return 0;
  }
  // Fluxo de caixa diário projetado: saldo de hoje (efetivado) + previstos de cada dia. Atrasados entram no 1º dia.
  function fluxoDiario(lancs, contas, inicio, dias) {
    const ontem = addDias(inicio, -1);
    let saldo = r2((contas || []).reduce(function (s, c) { return s + saldoConta(c, lancs, ontem); }, 0));
    const abertoAntes = lancs.filter(function (l) { return !l.pago && l.data < inicio; });
    const atrasadoEntrada = r2(abertoAntes.reduce(function (s, l) { const e = efeitoCaixa(l); return s + (e > 0 ? e : 0); }, 0));
    const atrasadoSaida = r2(abertoAntes.reduce(function (s, l) { const e = efeitoCaixa(l); return s + (e < 0 ? -e : 0); }, 0));
    const saldoInicial = saldo; const out = []; let minimo = null;
    for (let i = 0; i < dias; i++) {
      const d = addDias(inicio, i);
      let ent = 0, sai = 0;
      lancs.forEach(function (l) { if (l.data !== d) return; const e = efeitoCaixa(l); if (e > 0) ent += e; else sai -= e; });
      if (i === 0) { ent += atrasadoEntrada; sai += atrasadoSaida; }
      saldo = r2(saldo + ent - sai);
      out.push({ data: d, entradas: r2(ent), saidas: r2(sai), saldo: saldo });
      if (minimo == null || saldo < minimo.saldo) minimo = { data: d, saldo: saldo };
    }
    return { saldoInicial: saldoInicial, dias: out, minimo: minimo, primeiroNegativo: (out.find(function (x) { return x.saldo < 0; }) || null), atrasadoEntrada: atrasadoEntrada, atrasadoSaida: atrasadoSaida };
  }
  // Previsto × realizado por mês (regime de caixa).
  function fluxoMensal(lancs, meses) {
    return meses.map(function (m) {
      const o = { mes: m, previstoEntradas: 0, previstoSaidas: 0, realizadoEntradas: 0, realizadoSaidas: 0 };
      lancs.forEach(function (l) { if (mesDe(l.data) !== m) return; const e = efeitoCaixa(l); if (!e) return; if (e > 0) { o.previstoEntradas += e; if (l.pago) o.realizadoEntradas += e; } else { o.previstoSaidas -= e; if (l.pago) o.realizadoSaidas -= e; } });
      Object.keys(o).forEach(function (k) { if (k !== 'mes') o[k] = r2(o[k]); });
      o.previstoResultado = r2(o.previstoEntradas - o.previstoSaidas); o.realizadoResultado = r2(o.realizadoEntradas - o.realizadoSaidas);
      return o;
    });
  }
  // Contas em aberto por cliente/fornecedor, com faixas de atraso (aging).
  function aging(lancs, hoje, tipo) {
    const m = {};
    lancs.forEach(function (l) {
      if (l.pago || l.tipo !== tipo || l.cartao) return;
      const k = l.contato || 'Sem contato';
      const o = m[k] = m[k] || { contato: k, aVencer: 0, d30: 0, d60: 0, d90: 0, mais90: 0, total: 0, atrasado: 0, qtd: 0, maisAntigo: null };
      const v = Number(l.valor) || 0; const atraso = Math.floor((new Date(hoje + 'T12:00:00') - new Date(l.data + 'T12:00:00')) / 864e5);
      if (atraso <= 0) o.aVencer += v; else if (atraso <= 30) o.d30 += v; else if (atraso <= 60) o.d60 += v; else if (atraso <= 90) o.d90 += v; else o.mais90 += v;
      if (atraso > 0) { o.atrasado += v; if (!o.maisAntigo || l.data < o.maisAntigo) o.maisAntigo = l.data; }
      o.total += v; o.qtd++;
    });
    return Object.keys(m).map(function (k) { const o = m[k]; ['aVencer', 'd30', 'd60', 'd90', 'mais90', 'total', 'atrasado'].forEach(function (x) { o[x] = r2(o[x]); }); return o; }).sort(function (a, b) { return b.atrasado - a.atrasado || b.total - a.total; });
  }
  // Conciliação: para cada linha do extrato, o lançamento em aberto mais provável (mesmo sentido, mesmo valor, até `tolDias` de distância).
  function conciliar(extrato, abertos, tolDias) {
    tolDias = tolDias == null ? 5 : tolDias; const usados = {};
    return extrato.map(function (x) {
      let melhor = null, dist = Infinity;
      abertos.forEach(function (l) {
        if (usados[l.id] || l.tipo !== x.tipo || Math.abs((Number(l.valor) || 0) - x.valor) > 0.009) return;
        const d = Math.abs((new Date(l.data + 'T12:00:00') - new Date(x.data + 'T12:00:00')) / 864e5);
        if (d <= tolDias && d < dist) { melhor = l; dist = d; }
      });
      if (melhor) usados[melhor.id] = 1;
      return { linha: x, lancamento: melhor, dias: melhor ? dist : null };
    });
  }
  // DRE por centro de custo (ou por qualquer campo do lançamento).
  function porCampo(lancs, campo) {
    const m = {};
    lancs.forEach(function (l) { if (l.tipo !== 'receita' && l.tipo !== 'despesa') return; const k = l[campo] || ''; const o = m[k] = m[k] || { chave: k, receitas: 0, despesas: 0 }; if (l.tipo === 'receita') o.receitas += Number(l.valor) || 0; else o.despesas += Number(l.valor) || 0; });
    return Object.keys(m).map(function (k) { const o = m[k]; o.receitas = r2(o.receitas); o.despesas = r2(o.despesas); o.resultado = r2(o.receitas - o.despesas); return o; }).sort(function (a, b) { return b.receitas + b.despesas - a.receitas - a.despesas; });
  }

  return { efeitoCaixa: efeitoCaixa, fluxoDiario: fluxoDiario, fluxoMensal: fluxoMensal, aging: aging, conciliar: conciliar, porCampo: porCampo, CATEGORIAS_PADRAO: CATEGORIAS_PADRAO, addMeses: addMeses, addDias: addDias, mesDe: mesDe, mesFatura: mesFatura, fatura: fatura, limiteUsado: limiteUsado, saldoConta: saldoConta, gerarSerie: gerarSerie, doMes: doMes, resumo: resumo, porCategoria: porCategoria, orcamentos: orcamentos, dre: dre, analise: analise, lerOFX: lerOFX, lerExtratoCSV: lerExtratoCSV, sugerirCategoria: sugerirCategoria };
});
