/* Calculadora completa: científica com histórico e dezenas de calculadoras do dia a dia. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, num, campo, opcoes, aviso } = UI;
  const C = Calc;
  const hoje = function () { return C.iso(new Date()); };
  const n = function (v) { return typeof v === 'number' ? v : Nucleo.lerNumeroBR(v); };
  const f = function (v, c) { return v == null || !isFinite(v) ? '—' : num(v, c == null ? 2 : c); };
  // Sem zeros à direita: 4,5 e não 4,5000000000.
  const g = function (v) { return v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 10 }); };
  const res = function (linhas) { return '<dl class="cl-res">' + linhas.map(function (l) { return '<div' + (l[2] ? ' class="dest"' : '') + '><dt>' + esc(l[0]) + '</dt><dd>' + l[1] + '</dd></div>'; }).join('') + '</dl>'; };
  const est = { expr: '', ans: 0, angulo: 'grau', mem: 0, hist: [], busca: '' };

  // Cada ferramenta: campos (n = nome, r = rótulo, t = tipo, v = valor inicial, o = opções) e calc(valores) → HTML.
  const FERRAMENTAS = [
    { id: 'porcentagem', nome: 'Porcentagem', ic: '%', g: 'Dia a dia', campos: [{ n: 'modo', r: 'Cálculo', t: 'sel', o: [['de', 'X% de Y'], ['quanto', 'X é quantos % de Y'], ['var', 'Variação de X para Y'], ['mais', 'Y aumentado em X%'], ['menos', 'Y reduzido em X%'], ['origem', 'Y já com X% embutido: valor original']], v: 'de' }, { n: 'x', r: 'X', v: '10' }, { n: 'y', r: 'Y', v: '250' }],
      calc: function (v) { const x = n(v.x), y = n(v.y); const r = { de: ['Resultado', f(x / 100 * y)], quanto: ['Percentual', f(x / y * 100) + '%'], var: ['Variação', f((y - x) / x * 100) + '% (' + (y >= x ? '+' : '') + f(y - x) + ')'], mais: ['Resultado', f(y * (1 + x / 100))], menos: ['Resultado', f(y * (1 - x / 100))], origem: ['Valor sem o acréscimo', f(y / (1 + x / 100))] }[v.modo]; return res([[r[0], r[1], 1]]); } },
    { id: 'desconto', nome: 'Desconto', ic: '🏷', g: 'Dia a dia', campos: [{ n: 'p', r: 'Preço', v: '1.000,00' }, { n: 'd1', r: 'Desconto (%)', v: '10' }, { n: 'd2', r: 'Desconto adicional (%)', v: '0' }],
      calc: function (v) { const p = n(v.p), a = n(v.d1) || 0, b = n(v.d2) || 0; const fim = p * (1 - a / 100) * (1 - b / 100); return res([['Preço final', moeda(fim), 1], ['Economia', moeda(p - fim)], ['Desconto total equivalente', f((1 - fim / p) * 100) + '%']]); } },
    { id: 'margem', nome: 'Margem e markup', ic: '📈', g: 'Negócios', campos: [{ n: 'c', r: 'Custo', v: '80' }, { n: 'p', r: 'Preço de venda', v: '100' }],
      calc: function (v) { const c = n(v.c), p = n(v.p); return res([['Margem sobre a venda', f((p - c) / p * 100) + '%', 1], ['Markup sobre o custo', f((p - c) / c * 100) + '% (multiplicador ' + f(p / c, 4) + ')'], ['Lucro bruto', moeda(p - c)]]) + '<p class="mini mudo">Para precificação completa (impostos, frete, BDI), use o Seven Precificação.</p>'; } },
    { id: 'juros', nome: 'Juros compostos e investimento', ic: '💹', g: 'Finanças', campos: [{ n: 'c', r: 'Valor inicial', v: '10.000' }, { n: 'a', r: 'Aporte mensal', v: '500' }, { n: 'i', r: 'Taxa (% ao mês)', v: '1' }, { n: 'm', r: 'Meses', v: '24' }],
      calc: function (v) { const r = C.jurosCompostos(n(v.c) || 0, n(v.i) || 0, Math.min(1200, n(v.m) || 0), n(v.a) || 0); return res([['Montante', moeda(r.montante), 1], ['Total investido', moeda(r.investido)], ['Juros ganhos', moeda(r.juros)], ['Taxa anual equivalente', f(C.taxaEquivalente(n(v.i) || 0, 1, 12)) + '%']]); } },
    { id: 'simples', nome: 'Juros simples', ic: '➕', g: 'Finanças', campos: [{ n: 'c', r: 'Capital', v: '1.000' }, { n: 'i', r: 'Taxa (% por período)', v: '2' }, { n: 't', r: 'Períodos', v: '6' }],
      calc: function (v) { const r = C.jurosSimples(n(v.c), n(v.i), n(v.t)); return res([['Montante', moeda(r.montante), 1], ['Juros', moeda(r.juros)]]); } },
    { id: 'taxa', nome: 'Taxa equivalente', ic: '⇄', g: 'Finanças', campos: [{ n: 'i', r: 'Taxa (%)', v: '1' }, { n: 'de', r: 'Período da taxa', t: 'sel', o: [['1', 'ao mês'], ['12', 'ao ano'], ['0.0333333333', 'ao dia (30/mês)']], v: '1' }],
      calc: function (v) { const i = n(v.i), de = Number(v.de); return res([['Ao mês', f(C.taxaEquivalente(i, de, 1), 4) + '%'], ['Ao ano', f(C.taxaEquivalente(i, de, 12), 4) + '%', 1], ['Ao dia', f(C.taxaEquivalente(i, de, 1 / 30), 4) + '%']]); } },
    { id: 'financiamento', nome: 'Financiamento (Price e SAC)', ic: '🏦', g: 'Finanças', campos: [{ n: 'v', r: 'Valor financiado', v: '50.000' }, { n: 'i', r: 'Juros (% ao mês)', v: '1,2' }, { n: 'p', r: 'Parcelas', v: '48' }, { n: 's', r: 'Sistema', t: 'sel', o: [['price', 'Price (parcelas iguais)'], ['sac', 'SAC (amortização constante)']], v: 'price' }],
      calc: function (v) { const pv = n(v.v), i = n(v.i), k = Math.min(600, Math.floor(n(v.p))); if (!(pv > 0 && k > 0)) return ''; const r = v.s === 'sac' ? C.sac(pv, i, k) : C.price(pv, i, k); return res(v.s === 'sac' ? [['1ª parcela', moeda(r.primeira), 1], ['Última parcela', moeda(r.ultima)], ['Total pago', moeda(r.total)], ['Total de juros', moeda(r.juros)]] : [['Parcela', moeda(r.parcela), 1], ['Total pago', moeda(r.total)], ['Total de juros', moeda(r.juros)]]) + '<details><summary>Tabela de amortização</summary><div class="tabela-rolagem"><table class="tabela compacta"><thead><tr><th>#</th><th class="n">Parcela</th><th class="n">Juros</th><th class="n">Amortização</th><th class="n">Saldo</th></tr></thead><tbody>' + r.tabela.map(function (x) { return '<tr><td>' + x.n + '</td><td class="n">' + moeda(x.parcela) + '</td><td class="n">' + moeda(x.juros) + '</td><td class="n">' + moeda(x.amortizacao) + '</td><td class="n">' + moeda(x.saldo) + '</td></tr>'; }).join('') + '</tbody></table></div></details>'; } },
    { id: 'tres', nome: 'Regra de três', ic: '∝', g: 'Dia a dia', campos: [{ n: 'a', r: 'A', v: '2' }, { n: 'b', r: 'está para B', v: '10' }, { n: 'c', r: 'assim como C', v: '5' }, { n: 'tipo', r: 'Grandezas', t: 'sel', o: [['direta', 'Diretamente proporcionais'], ['inversa', 'Inversamente proporcionais']], v: 'direta' }],
      calc: function (v) { const a = n(v.a), b = n(v.b), c = n(v.c); const x = v.tipo === 'inversa' ? a * b / c : b * c / a; return res([['Está para X =', f(x, 6), 1]]); } },
    { id: 'datas', nome: 'Prazos e dias úteis', ic: '📅', g: 'Datas', campos: [{ n: 'modo', r: 'Cálculo', t: 'sel', o: [['somar', 'Somar dias a uma data'], ['dif', 'Diferença entre duas datas']], v: 'somar' }, { n: 'd1', r: 'Data inicial', t: 'data', v: hoje() }, { n: 'qt', r: 'Quantidade de dias', v: '3' }, { n: 'tipo', r: 'Contagem', t: 'sel', o: [['uteis', 'Dias úteis'], ['corridos', 'Dias corridos']], v: 'uteis' }, { n: 'd2', r: 'Data final (para diferença)', t: 'data', v: hoje() }, { n: 'fac', r: 'Pontos facultativos (Carnaval, Corpus Christi) contam como não úteis', t: 'check', v: false }, { n: 'ext', r: 'Feriados locais (dd/mm/aaaa, separados por vírgula)', v: '' }],
      calc: function (v) {
        const extras = String(v.ext || '').split(',').map(function (s) { const m = s.trim().match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }).filter(Boolean); const opc = { facultativos: !!v.fac, extras: extras };
        const d = function (s) { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }); };
        if (v.modo === 'somar') { const r = C.somar(v.d1, n(v.qt), v.tipo === 'uteis', opc); const fer = []; const a = v.d1 < r ? v.d1 : r, b = v.d1 < r ? r : v.d1; [Number(a.slice(0, 4)), Number(b.slice(0, 4))].filter(function (x, i, l) { return l.indexOf(x) === i; }).forEach(function (ano) { const F = C.feriados(ano, opc.facultativos); Object.keys(F).forEach(function (k) { if (k > a && k <= b) fer.push(k.split('-').reverse().join('/') + ' — ' + F[k]); }); }); return res([['Data resultante', d(r), 1]]) + (fer.length ? '<p class="mini">Feriados no intervalo: ' + esc(fer.join('; ')) + '</p>' : '') + '<p class="mini mudo">Em dias úteis, exclui-se o dia do início e inclui-se o do vencimento (art. 183 da Lei 14.133/2021). Confira expediente e feriados locais do órgão.</p>'; }
        const r = C.diferenca(v.d1, v.d2, opc); return res([['Dias corridos', f(r.dias, 0), 1], ['Dias úteis', f(r.uteis, 0)], ['Semanas', f(r.semanas, 0)], ['Em anos, meses e dias', r.anos + ' a, ' + r.meses + ' m, ' + r.diasResto + ' d']]);
      } },
    { id: 'idade', nome: 'Idade', ic: '🎂', g: 'Datas', campos: [{ n: 'd', r: 'Data de nascimento', t: 'data', v: '1990-01-01' }, { n: 'h', r: 'Na data', t: 'data', v: hoje() }],
      calc: function (v) { const r = C.idade(v.d, v.h); return res([['Idade', r.anos + ' anos, ' + r.meses + ' meses e ' + r.dias + ' dias', 1], ['Dias vividos', f(r.totalDias, 0)], ['Próximo aniversário', new Date(r.proximoAniversario + 'T12:00:00').toLocaleDateString('pt-BR') + ' (faltam ' + r.faltam + ' dias)']]); } },
    { id: 'horas', nome: 'Horas', ic: '⏱', g: 'Datas', campos: [{ n: 'lista', r: 'Horas (uma por linha, use - para subtrair)', t: 'area', v: '8:30\n7:45\n-1:00' }, { n: 'valor', r: 'Valor da hora (opcional)', v: '' }],
      calc: function (v) { const ms = String(v.lista).split(/\n|;/).map(function (s) { return C.horasParaMin(s); }).filter(function (x) { return x != null; }); const t = ms.reduce(function (a, b) { return a + b; }, 0); return res([['Total', C.minParaHoras(t), 1], ['Em horas decimais', f(t / 60, 2) + ' h']].concat(n(v.valor) ? [['Valor', moeda(t / 60 * n(v.valor))]] : [])); } },
    { id: 'imc', nome: 'IMC', ic: '⚖', g: 'Saúde', campos: [{ n: 'p', r: 'Peso (kg)', v: '75' }, { n: 'a', r: 'Altura (m)', v: '1,75' }],
      calc: function (v) { const i = n(v.p) / Math.pow(n(v.a), 2); const c = i < 18.5 ? 'Abaixo do peso' : i < 25 ? 'Peso normal' : i < 30 ? 'Sobrepeso' : i < 35 ? 'Obesidade grau I' : i < 40 ? 'Obesidade grau II' : 'Obesidade grau III'; return res([['IMC', f(i, 1), 1], ['Classificação (OMS)', c], ['Faixa de peso normal', f(18.5 * Math.pow(n(v.a), 2), 1) + ' a ' + f(24.9 * Math.pow(n(v.a), 2), 1) + ' kg']]); } },
    { id: 'media', nome: 'Média e estatística', ic: 'x̄', g: 'Matemática', campos: [{ n: 'l', r: 'Valores (separados por espaço, ; ou linha)', t: 'area', v: '7 8,5 9 6 10' }, { n: 'p', r: 'Pesos (opcional, mesma ordem)', v: '' }],
      calc: function (v) { const vs = String(v.l).split(/[\s;]+/).map(n).filter(isFinite); const e = C.estatistica(vs); if (!e) return ''; const ps = String(v.p || '').split(/[\s;]+/).map(n).filter(isFinite); const pond = ps.length === vs.length ? vs.reduce(function (s, x, i) { return s + x * ps[i]; }, 0) / ps.reduce(function (a, b) { return a + b; }, 0) : null; return res([['Média', f(e.media, 4), 1]].concat(pond != null ? [['Média ponderada', f(pond, 4), 1]] : []).concat([['Mediana', f(e.mediana, 4)], ['Moda', e.moda.length ? e.moda.map(function (x) { return f(x, 4); }).join(', ') : '—'], ['Soma', f(e.soma, 4)], ['Mínimo / máximo', f(e.min, 4) + ' / ' + f(e.max, 4)], ['Desvio padrão (amostral)', f(e.desvioAmostral, 4)], ['Desvio padrão (populacional)', f(e.desvioPop, 4)], ['Quantidade', e.n]])); } },
    { id: 'fracoes', nome: 'Frações', ic: '½', g: 'Matemática', campos: [{ n: 'a', r: 'Fração A (ex.: 3/4)', v: '1/2' }, { n: 'op', r: 'Operação', t: 'sel', o: [['+', '+'], ['-', '−'], ['*', '×'], ['/', '÷']], v: '+' }, { n: 'b', r: 'Fração B', v: '1/3' }, { n: 'dec', r: 'Decimal para fração', v: '0,75' }],
      calc: function (v) { const lf = function (s) { const m = String(s).replace(/\s/g, '').match(/^(-?\d+)(?:\/(-?\d+))?$/); return m ? C.fracao(Number(m[1]), Number(m[2] || 1)) : null; }; const a = lf(v.a), b = lf(v.b); const r = a && b && C.opFracao(a, v.op, b); const d = C.decimalParaFracao(n(v.dec)); return res([['Resultado', r ? r.n + (r.d !== 1 ? '/' + r.d : '') + ' = ' + f(r.n / r.d, 6) : '—', 1], ['Decimal como fração', d ? d.n + '/' + d.d : '—']]); } },
    { id: 'mdc', nome: 'MDC, MMC e primos', ic: '#', g: 'Matemática', campos: [{ n: 'l', r: 'Números', v: '12 18 30' }],
      calc: function (v) { const vs = String(v.l).split(/[\s,;]+/).map(Number).filter(function (x) { return x > 0 && x % 1 === 0; }); if (!vs.length) return ''; return res([['MDC', vs.reduce(C.mdc), 1], ['MMC', vs.reduce(C.mmc), 1]].concat(vs.slice(0, 6).map(function (x) { return [x + (C.ehPrimo(x) ? ' é primo' : ' ='), C.ehPrimo(x) ? '✓' : C.fatorar(x).join(' × ')]; }))); } },
    { id: 'bhaskara', nome: 'Equação do 2º grau', ic: 'x²', g: 'Matemática', campos: [{ n: 'a', r: 'a', v: '1' }, { n: 'b', r: 'b', v: '-5' }, { n: 'c', r: 'c', v: '6' }],
      calc: function (v) { const r = C.bhaskara(n(v.a), n(v.b), n(v.c)); if (!r) return '<p class="alerta">a não pode ser zero.</p>'; return res([['Δ (delta)', f(r.delta, 4)], ['Raízes', r.reais.length ? r.reais.map(function (x) { return f(x, 6); }).join(' e ') : f(r.complexas[0].re, 4) + ' ± ' + f(r.complexas[0].im, 4) + 'i', 1], ['Vértice', '(' + f(-n(v.b) / (2 * n(v.a)), 4) + '; ' + f(-r.delta / (4 * n(v.a)), 4) + ')']]); } },
    { id: 'bases', nome: 'Bases numéricas', ic: '01', g: 'Matemática', campos: [{ n: 'v', r: 'Número', v: '255' }, { n: 'de', r: 'Na base', t: 'sel', o: [['10', 'Decimal'], ['2', 'Binário'], ['8', 'Octal'], ['16', 'Hexadecimal']], v: '10' }],
      calc: function (v) { const de = Number(v.de); return res([['Decimal', C.base(v.v, de, 10) || '—'], ['Binário', C.base(v.v, de, 2) || '—'], ['Octal', C.base(v.v, de, 8) || '—'], ['Hexadecimal', C.base(v.v, de, 16) || '—']]); } },
    { id: 'romanos', nome: 'Algarismos romanos', ic: 'Ⅻ', g: 'Matemática', campos: [{ n: 'v', r: 'Número ou romano', t: 'texto', v: '2026' }],
      calc: function (v) { const s = String(v.v).trim(); if (/^\d+$/.test(s)) { const r = C.romano(Number(s)); return res([['Em romanos', r || 'De 1 a 3999', 1]]); } const d = C.deRomano(s); return res([['Em arábicos', d == null ? 'Romano inválido' : d, 1]]); } },
    { id: 'combustivel', nome: 'Combustível', ic: '⛽', g: 'Dia a dia', campos: [{ n: 'e', r: 'Preço do etanol', v: '4,19' }, { n: 'g', r: 'Preço da gasolina', v: '6,09' }, { n: 'km', r: 'Distância da viagem (km)', v: '300' }, { n: 'cons', r: 'Consumo com gasolina (km/L)', v: '12' }],
      calc: function (v) { const r = n(v.e) / n(v.g); const custo = n(v.km) / n(v.cons) * n(v.g); return res([['Relação etanol/gasolina', f(r * 100, 1) + '%'], ['Compensa abastecer com', r <= 0.7 ? 'Etanol' : 'Gasolina', 1], ['Custo da viagem (gasolina)', moeda(custo)], ['Litros necessários', f(n(v.km) / n(v.cons), 1) + ' L']]) + '<p class="mini mudo">Regra prática: etanol compensa até ~70% do preço da gasolina.</p>'; } },
    { id: 'viagem', nome: 'Custo de viagem', ic: '🛣', g: 'Dia a dia', campos: [{ n: 'km', r: 'Distância só de ida (km)', v: '260' }, { n: 'iv', r: 'Trajeto', t: 'sel', o: [['2', 'Ida e volta'], ['1', 'Só ida']], v: '2' }, { n: 'extra', r: 'Km extras no destino', v: '20' }, { n: 'cons', r: 'Consumo do carro (km/L)', v: '11' }, { n: 'preco', r: 'Preço do litro (R$)', v: '6,09' }, { n: 'ped', r: 'Pedágios só de ida (R$)', v: '0' }, { n: 'est', r: 'Estacionamento e outros (R$)', v: '0' }, { n: 'dia', r: 'Diárias (noites)', v: '0' }, { n: 'vdia', r: 'Valor da diária: hotel + refeições (R$)', v: '0' }, { n: 'pes', r: 'Pessoas para dividir', v: '1' }, { n: 'vel', r: 'Velocidade média (km/h)', v: '80' }, { n: 'tq', r: 'Tanque do carro (L)', v: '50' }],
      calc: function (v) { const r = C.viagem({ km: n(v.km), idaVolta: v.iv === '2', extraKm: n(v.extra), consumo: n(v.cons), preco: n(v.preco), pedagios: n(v.ped), estacionamento: n(v.est), diarias: n(v.dia), valorDiaria: n(v.vdia), pessoas: n(v.pes), velocidade: n(v.vel), tanque: n(v.tq) }); if (!r) return '<p class="alerta">Informe a distância e o consumo do carro.</p>'; return res([['Custo total da viagem', moeda(r.total), 1], ['Combustível', moeda(r.combustivel) + ' · ' + f(r.litros, 1) + ' L'], ['Por pessoa', moeda(r.porPessoa)], ['Distância total', f(r.km, 0) + ' km'], ['Custo por km', moeda(r.porKm)], ['Pedágios', moeda(r.pedagios)], ['Hospedagem e refeições', moeda(r.hospedagem)], ['Paradas para abastecer', r.paradas == null ? '—' : r.paradas + (r.autonomia ? ' (autonomia de ' + f(r.autonomia, 0) + ' km com 15% de reserva)' : '')], ['Tempo ao volante', r.horas == null ? '—' : C.minParaHoras(Math.round(r.horas * 60)) + ' h']]); } },
    { id: 'conta', nome: 'Dividir conta e gorjeta', ic: '🍽', g: 'Dia a dia', campos: [{ n: 't', r: 'Total da conta', v: '320' }, { n: 'g', r: 'Gorjeta / serviço (%)', v: '10' }, { n: 'p', r: 'Pessoas', v: '4' }],
      calc: function (v) { const t = n(v.t) * (1 + n(v.g) / 100); return res([['Total com serviço', moeda(t)], ['Por pessoa', moeda(t / Math.max(1, n(v.p))), 1]]); } },
    { id: 'unidade', nome: 'Preço por unidade', ic: '🛒', g: 'Dia a dia', campos: [{ n: 'p1', r: 'Produto A: preço', v: '12,90' }, { n: 'q1', r: 'Produto A: quantidade', v: '500' }, { n: 'p2', r: 'Produto B: preço', v: '22,90' }, { n: 'q2', r: 'Produto B: quantidade', v: '1000' }],
      calc: function (v) { const a = n(v.p1) / n(v.q1), b = n(v.p2) / n(v.q2); return res([['A por unidade', f(a, 4)], ['B por unidade', f(b, 4)], ['Mais barato', a < b ? 'A, ' + f((1 - a / b) * 100, 1) + '% mais barato' : b < a ? 'B, ' + f((1 - b / a) * 100, 1) + '% mais barato' : 'Empate', 1]]); } },
    { id: 'velocidade', nome: 'Velocidade, distância e tempo', ic: '🚗', g: 'Física', campos: [{ n: 'd', r: 'Distância (km)', v: '120' }, { n: 't', r: 'Tempo (h:mm)', t: 'texto', v: '1:30' }, { n: 'vel', r: 'ou velocidade (km/h)', v: '' }],
      calc: function (v) { const tm = C.horasParaMin(v.t); if (n(v.vel)) return res([['Tempo para ' + f(n(v.d), 1) + ' km', C.minParaHoras(n(v.d) / n(v.vel) * 60), 1]]); return res([['Velocidade média', tm ? f(n(v.d) / (tm / 60), 1) + ' km/h' : '—', 1]]); } },
    { id: 'area', nome: 'Área e volume', ic: '▭', g: 'Matemática', campos: [{ n: 'forma', r: 'Forma', t: 'sel', o: [['ret', 'Retângulo / caixa'], ['circ', 'Círculo / cilindro'], ['tri', 'Triângulo / prisma'], ['esf', 'Esfera']], v: 'ret' }, { n: 'a', r: 'Medida 1 (lado, raio ou base)', v: '4' }, { n: 'b', r: 'Medida 2 (lado ou altura do triângulo)', v: '3' }, { n: 'h', r: 'Altura / profundidade (volume)', v: '2' }],
      calc: function (v) { const a = n(v.a), b = n(v.b), h = n(v.h) || 0; let ar, vol; if (v.forma === 'ret') { ar = a * b; vol = ar * h; } else if (v.forma === 'circ') { ar = Math.PI * a * a; vol = ar * h; } else if (v.forma === 'tri') { ar = a * b / 2; vol = ar * h; } else { ar = 4 * Math.PI * a * a; vol = 4 / 3 * Math.PI * Math.pow(a, 3); } return res([['Área', f(ar, 4), 1], ['Volume', f(vol, 4)]]); } }
  ];

  // ---------- científica ----------
  function telaBasica(el) {
    const teclas = [['MC', 'mem'], ['MR', 'mem'], ['M+', 'mem'], ['M−', 'mem'], ['C', 'cmd'], ['sin', 'fn'], ['cos', 'fn'], ['tan', 'fn'], ['(', 'op'], [')', 'op'], ['ln', 'fn'], ['log', 'fn'], ['√', 'fn'], ['x²', 'op'], ['^', 'op'], ['π', 'op'], ['e', 'op'], ['!', 'op'], ['%', 'op'], ['÷', 'op'], ['7', 'nu'], ['8', 'nu'], ['9', 'nu'], ['⌫', 'cmd'], ['×', 'op'], ['4', 'nu'], ['5', 'nu'], ['6', 'nu'], ['ans', 'op'], ['−', 'op'], ['1', 'nu'], ['2', 'nu'], ['3', 'nu'], ['±', 'cmd'], ['+', 'op'], ['0', 'nu'], [',', 'nu'], ['1/x', 'op'], ['=', 'igual']];
    el.innerHTML = '<div class="cl-cient"><div class="cl-calc"><div class="cl-visor"><div class="cl-topo"><button class="btn mini ' + (est.angulo === 'grau' ? 'primario' : 'fantasma') + '" data-ang="grau">GRAU</button><button class="btn mini ' + (est.angulo === 'rad' ? 'primario' : 'fantasma') + '" data-ang="rad">RAD</button>' + (est.mem ? '<span class="tag claro">M = ' + esc(g(est.mem)) + '</span>' : '') + '</div><input id="cl-expr" class="cl-expr" value="' + esc(est.expr) + '" aria-label="Expressão" autocomplete="off" spellcheck="false"><div class="cl-prev" id="cl-prev"></div></div>' +
      '<div class="cl-teclas">' + teclas.map(function (t) { return '<button class="cl-t ' + t[1] + '" data-t="' + esc(t[0]) + '">' + esc(t[0]) + '</button>'; }).join('') + '</div></div>' +
      '<aside class="cartao cl-hist"><header><h3>Histórico</h3>' + (est.hist.length ? '<button class="btn mini fantasma" data-limpar>Limpar</button>' : '') + '</header>' + (est.hist.length ? '<ul>' + est.hist.map(function (h, i) { return '<li data-h="' + i + '"><small>' + esc(h.e) + ' =</small><b>' + esc(g(h.r)) + '</b></li>'; }).join('') + '</ul>' : '<p class="mudo mini">Os cálculos aparecem aqui. Clique para reutilizar. Dá para digitar direto no visor (Enter calcula).</p>') + '</aside></div>';
    const inp = el.querySelector('#cl-expr'); const prev = el.querySelector('#cl-prev');
    const previa = function () { est.expr = inp.value; try { prev.textContent = inp.value.trim() ? '= ' + g(C.avaliar(inp.value, { angulo: est.angulo, ans: est.ans })) : ''; prev.classList.remove('erro'); } catch (e) { prev.textContent = ''; } };
    const calcular = function () { try { const r = C.avaliar(inp.value, { angulo: est.angulo, ans: est.ans }); est.hist.unshift({ e: inp.value, r: r }); est.hist = est.hist.slice(0, 50); est.ans = r; est.expr = String(r).replace('.', ','); App.redesenhar(); } catch (e) { prev.textContent = e.message; prev.classList.add('erro'); } };
    const inserir = function (s) { const a = inp.selectionStart != null ? inp.selectionStart : inp.value.length; const b = inp.selectionEnd != null ? inp.selectionEnd : a; inp.value = inp.value.slice(0, a) + s + inp.value.slice(b); inp.focus(); inp.setSelectionRange(a + s.length, a + s.length); previa(); };
    inp.oninput = previa; inp.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === '=') { ev.preventDefault(); calcular(); } if (ev.key === 'Escape') { inp.value = ''; previa(); } };
    previa(); setTimeout(function () { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 0);
    el.onclick = function (ev) {
      const a = ev.target.closest('[data-ang]'); if (a) { est.angulo = a.dataset.ang; App.redesenhar(); return; }
      if (ev.target.closest('[data-limpar]')) { est.hist = []; App.redesenhar(); return; }
      const h = ev.target.closest('[data-h]'); if (h) { inserir(String(est.hist[h.dataset.h].r).replace('.', ',')); return; }
      const t = ev.target.closest('[data-t]'); if (!t) return; const k = t.dataset.t;
      const valor = function () { try { return C.avaliar(inp.value || '0', { angulo: est.angulo, ans: est.ans }); } catch (e) { return 0; } };
      if (k === '=') return calcular();
      if (k === 'C') { inp.value = ''; previa(); inp.focus(); return; }
      if (k === '⌫') { const p = inp.selectionStart || inp.value.length; inp.value = inp.value.slice(0, Math.max(0, p - 1)) + inp.value.slice(p); inp.focus(); inp.setSelectionRange(p - 1, p - 1); previa(); return; }
      if (k === '±') { inp.value = inp.value ? '-(' + inp.value + ')' : '-'; previa(); return; }
      if (k === 'MC') { est.mem = 0; App.redesenhar(); return; } if (k === 'MR') { inserir(String(est.mem).replace('.', ',')); return; }
      if (k === 'M+' || k === 'M−') { est.mem += (k === 'M+' ? 1 : -1) * valor(); aviso('Memória: ' + g(est.mem)); App.redesenhar(); return; }
      inserir({ 'x²': '^2', '1/x': '^-1', sin: 'sin(', cos: 'cos(', tan: 'tan(', ln: 'ln(', log: 'log(', '√': '√(' }[k] || k);
    };
  }

  // ---------- conversor e câmbio ----------
  function telaConversor(el) {
    const cs = Object.keys(C.UNIDADES); est.conv = est.conv || { cat: 'comprimento', v: '1', de: 'km', para: 'm' };
    const s = est.conv; const us = Object.keys(C.UNIDADES[s.cat]);
    if (us.indexOf(s.de) < 0) s.de = us[0]; if (us.indexOf(s.para) < 0) s.para = us[1];
    const nomes = { comprimento: 'Comprimento', massa: 'Massa', area: 'Área', volume: 'Volume', velocidade: 'Velocidade', tempo: 'Tempo', dados: 'Dados', energia: 'Energia', pressao: 'Pressão', potencia: 'Potência', temperatura: 'Temperatura' };
    const v = n(s.v);
    el.innerHTML = '<div class="pilulas">' + cs.map(function (c) { return '<button class="pilula ' + (c === s.cat ? 'ativa' : '') + '" data-cat="' + c + '">' + nomes[c] + '</button>'; }).join('') + '</div><form class="cartao cl-conv" id="cl-conv"><div class="linha">' + campo('Valor', '<input name="v" inputmode="decimal" value="' + esc(s.v) + '">') + campo('De', '<select name="de">' + opcoes(us, s.de) + '</select>') + '<button type="button" class="btn" data-troca aria-label="Inverter">⇄</button>' + campo('Para', '<select name="para">' + opcoes(us, s.para) + '</select>') + '</div><div class="cl-grande">' + esc(f(C.converter(s.cat, v, s.de, s.para), 8)) + ' ' + esc(s.para) + '</div></form>' +
      '<div class="cartao"><h4>' + esc(f(v, 6)) + ' ' + esc(s.de) + ' equivale a</h4><table class="tabela compacta"><tbody>' + us.filter(function (u) { return u !== s.de; }).map(function (u) { return '<tr><td>' + esc(u) + '</td><td class="n">' + esc(f(C.converter(s.cat, v, s.de, u), 8)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    const form = el.querySelector('#cl-conv');
    form.oninput = function () { const fd = new FormData(form); s.v = fd.get('v'); s.de = fd.get('de'); s.para = fd.get('para'); clearTimeout(form._t); form._t = setTimeout(function () { App.redesenhar(); const i = document.querySelector('#cl-conv [name=v]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); };
    form.onsubmit = function (e) { e.preventDefault(); };
    el.onclick = function (ev) { const c = ev.target.closest('[data-cat]'); if (c) { s.cat = c.dataset.cat; App.redesenhar(); } if (ev.target.closest('[data-troca]')) { const t = s.de; s.de = s.para; s.para = t; App.redesenhar(); } };
  }

  function telaCambio(el) {
    est.cambio = est.cambio || { v: '100', moeda: 'USD', taxas: { USD: '', EUR: '', GBP: '', ARS: '' }, quando: '' };
    const s = est.cambio;
    el.innerHTML = '<form class="cartao" id="cl-cambio"><div class="linha">' + campo('Valor', '<input name="v" inputmode="decimal" value="' + esc(s.v) + '">') + campo('Moeda', '<select name="moeda">' + opcoes(Object.keys(s.taxas), s.moeda) + '</select>') + campo('Cotação (R$ por 1 ' + s.moeda + ')', '<input name="taxa" inputmode="decimal" value="' + esc(s.taxas[s.moeda]) + '">', s.quando ? 'Atualizada ' + esc(s.quando) : 'Informe a cotação ou busque a atual.') + '<button type="button" class="btn" data-buscar>Buscar cotação atual</button></div>' +
      (n(s.taxas[s.moeda]) ? res([[s.v + ' ' + s.moeda + ' em reais', moeda(n(s.v) * n(s.taxas[s.moeda])), 1], [s.v + ' reais em ' + s.moeda, f(n(s.v) / n(s.taxas[s.moeda]), 2) + ' ' + s.moeda]]) : '') + '</form><p class="mini mudo">Cotações de referência (AwesomeAPI). Para contratos e propostas em moeda estrangeira, use a PTAX do Banco Central da data exigida no edital.</p>';
    const form = el.querySelector('#cl-cambio');
    form.onchange = function () { const fd = new FormData(form); s.v = fd.get('v'); s.taxas[s.moeda] = fd.get('taxa'); s.moeda = fd.get('moeda'); App.redesenhar(); };
    form.onsubmit = function (e) { e.preventDefault(); };
    el.onclick = async function (ev) {
      if (!ev.target.closest('[data-buscar]')) return;
      try {
        const r = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL,ARS-BRL'); if (!r.ok) throw new Error('serviço respondeu ' + r.status);
        const j = await r.json(); Object.keys(s.taxas).forEach(function (m) { const x = j[m + 'BRL']; if (x) s.taxas[m] = String(Number(x.bid).toFixed(4)).replace('.', ','); });
        s.quando = new Date().toLocaleString('pt-BR'); App.redesenhar();
      } catch (e) { aviso('Não consegui buscar a cotação agora (' + e.message + '). Informe manualmente.', 'erro'); }
    };
  }

  // ---------- ferramenta genérica ----------
  function telaFerramenta(el, t) {
    est.valores = est.valores || {}; const vals = est.valores[t.id] = est.valores[t.id] || {};
    t.campos.forEach(function (c) { if (vals[c.n] === undefined) vals[c.n] = c.v; });
    const input = function (c) {
      const v = vals[c.n];
      if (c.t === 'sel') return '<select name="' + c.n + '">' + opcoes(c.o.map(function (o) { return { v: o[0], t: o[1] }; }), v) + '</select>';
      if (c.t === 'data') return '<input type="date" name="' + c.n + '" value="' + esc(v) + '">';
      if (c.t === 'area') return '<textarea name="' + c.n + '" rows="4">' + esc(v) + '</textarea>';
      if (c.t === 'check') return '<input type="checkbox" name="' + c.n + '"' + (v ? ' checked' : '') + '>';
      return '<input name="' + c.n + '" ' + (c.t === 'texto' ? '' : 'inputmode="decimal"') + ' value="' + esc(v) + '">';
    };
    el.innerHTML = '<div class="cl-ferr"><form class="cartao" id="cl-form"><h3>' + esc(t.ic) + ' ' + esc(t.nome) + '</h3>' + t.campos.map(function (c) { return c.t === 'check' ? '<label class="check">' + input(c) + ' ' + esc(c.r) + '</label>' : campo(c.r, input(c)); }).join('') + '</form><section class="cartao cl-saida" id="cl-saida"></section></div>';
    const form = el.querySelector('#cl-form'); const saida = el.querySelector('#cl-saida');
    const calc = function () { t.campos.forEach(function (c) { const i = form.elements[c.n]; vals[c.n] = c.t === 'check' ? i.checked : i.value; }); try { saida.innerHTML = '<h4>Resultado</h4>' + (t.calc(vals) || '<p class="mudo">Preencha os campos.</p>'); } catch (e) { saida.innerHTML = '<p class="alerta">' + esc(e.message) + '</p>'; } };
    form.oninput = calc; form.onchange = calc; form.onsubmit = function (e) { e.preventDefault(); };
    calc();
  }

  Telas.calculadora = {
    titulo: 'Seven Calculadora',
    render: function (el, sub) {
      sub = sub || 'cientifica';
      const favs = Dados.e.config.calcFavoritas || [];
      const itens = [{ id: 'cientifica', nome: 'Científica', ic: '🧮', g: 'Básicas' }, { id: 'conversor', nome: 'Conversor de unidades', ic: '📏', g: 'Básicas' }, { id: 'cambio', nome: 'Câmbio', ic: '💱', g: 'Finanças' }].concat(FERRAMENTAS);
      const grupos = {}; itens.forEach(function (t) { (grupos[t.g] = grupos[t.g] || []).push(t); });
      const visiveis = function (t) { return !est.busca || Nucleo.normalizar(t.nome + ' ' + t.g).indexOf(Nucleo.normalizar(est.busca)) >= 0; };
      el.innerHTML = '<div class="cl"><aside class="cl-menu"><input type="search" id="cl-busca" placeholder="Buscar calculadora…" value="' + esc(est.busca) + '">' +
        (favs.length ? '<h4>★ Favoritas</h4>' + itens.filter(function (t) { return favs.indexOf(t.id) >= 0 && visiveis(t); }).map(function (t) { return '<a href="#/calculadora/' + t.id + '" class="' + (t.id === sub ? 'ativa' : '') + '">' + esc(t.ic) + ' ' + esc(t.nome) + '</a>'; }).join('') : '') +
        Object.keys(grupos).map(function (g) { const l = grupos[g].filter(visiveis); return l.length ? '<h4>' + esc(g) + '</h4>' + l.map(function (t) { return '<a href="#/calculadora/' + t.id + '" class="' + (t.id === sub ? 'ativa' : '') + '">' + esc(t.ic) + ' ' + esc(t.nome) + '</a>'; }).join('') : ''; }).join('') + '</aside>' +
        '<section class="cl-area"><div class="cl-cab"><h2>' + esc((itens.find(function (t) { return t.id === sub; }) || itens[0]).nome) + '</h2><button class="icone estrela ' + (favs.indexOf(sub) >= 0 ? 'on' : '') + '" data-fav aria-label="Favoritar">★</button><button type="button" class="btn mini cl-janela" data-janela title="Calculadora em janela que fica por cima de qualquer tela (Alt+C)">⧉ Abrir em janela flutuante</button></div><div id="cl-corpo"></div></section></div>';
      const corpo = el.querySelector('#cl-corpo');
      if (sub === 'cientifica') telaBasica(corpo); else if (sub === 'conversor') telaConversor(corpo); else if (sub === 'cambio') telaCambio(corpo);
      else { const t = FERRAMENTAS.find(function (x) { return x.id === sub; }); if (t) telaFerramenta(corpo, t); else telaBasica(corpo); }
      const b = el.querySelector('#cl-busca'); b.oninput = function () { est.busca = b.value; clearTimeout(b._t); b._t = setTimeout(function () { App.redesenhar(); const i = document.getElementById('cl-busca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
      el.querySelector('[data-janela]').onclick = function () { CalcFlutuante.abrir(); };
      el.querySelector('[data-fav]').onclick = function () { const l = Dados.e.config.calcFavoritas = Dados.e.config.calcFavoritas || []; const i = l.indexOf(sub); if (i >= 0) l.splice(i, 1); else l.push(sub); Dados.salvar(); App.redesenhar(); };
    }
  };
})();
