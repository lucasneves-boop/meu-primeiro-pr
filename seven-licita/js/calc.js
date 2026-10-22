/* Plataforma 7 — motor da Calculadora: expressões, datas e dias úteis, finanças, conversões. Sem DOM. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Calc = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- expressões (analisador próprio, sem eval) ----------
  function fatorial(n) { if (n < 0 || n % 1) { return gama(n + 1); } let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
  function gama(z) { // aproximação de Lanczos para fatorial de não inteiros
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gama(1 - z));
    z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i); const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  function tokens(s) {
    const t = []; let i = 0;
    s = String(s).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, ' pi ').replace(/√/g, ' sqrt ').replace(/∛/g, ' cbrt ').replace(/\s+/g, ' ');
    while (i < s.length) {
      const c = s[i];
      if (c === ' ') { i++; continue; }
      if (/[0-9.,]/.test(c)) { let j = i; while (j < s.length && /[0-9.,]/.test(s[j])) j++; let n = s.slice(i, j); n = n.indexOf(',') >= 0 ? n.replace(/\./g, '').replace(',', '.') : n; if (j < s.length && /[eE]/.test(s[j]) && /[-+0-9]/.test(s[j + 1] || '')) { let k = j + 1; if (/[-+]/.test(s[k])) k++; while (k < s.length && /[0-9]/.test(s[k])) k++; n += s.slice(j, k); j = k; } t.push({ t: 'n', v: Number(n) }); i = j; continue; }
      if (/[a-z]/i.test(c)) { let j = i; while (j < s.length && /[a-z0-9]/i.test(s[j])) j++; t.push({ t: 'f', v: s.slice(i, j).toLowerCase() }); i = j; continue; }
      if ('+-*/^()%!'.indexOf(c) >= 0) { t.push({ t: c }); i++; continue; }
      throw new Error('Caractere inválido: ' + c);
    }
    return t;
  }

  // Gramática: soma := termo (('+'|'-') termo)* ; termo := fator (('*'|'/'|implícito) fator)* ; fator := unario ('^' fator)? ; unario := '-' unario | posfixo ; posfixo := primario ('!'|'%')*
  function avaliar(expr, opcoes) {
    opcoes = opcoes || {}; const graus = opcoes.angulo === 'grau';
    const tk = tokens(expr); let p = 0;
    const ve = function (t) { return tk[p] && tk[p].t === t; };
    const toRad = function (x) { return graus ? x * Math.PI / 180 : x; }; const deRad = function (x) { return graus ? x * 180 / Math.PI : x; };
    const FUN = { sin: function (x) { return limpar(Math.sin(toRad(x))); }, cos: function (x) { return limpar(Math.cos(toRad(x))); }, tan: function (x) { return limpar(Math.tan(toRad(x))); }, asin: function (x) { return deRad(Math.asin(x)); }, acos: function (x) { return deRad(Math.acos(x)); }, atan: function (x) { return deRad(Math.atan(x)); }, sqrt: Math.sqrt, cbrt: Math.cbrt, log: Math.log10, ln: Math.log, abs: Math.abs, exp: Math.exp };
    const CONST = { pi: Math.PI, e: Math.E, ans: opcoes.ans || 0 };
    function soma() {
      let v = termo();
      while (ve('+') || ve('-')) {
        const op = tk[p++].t; const ini = p; let d = termo();
        if (tk[p - 1] && tk[p - 1].t === '%' && p - 1 > ini - 1 && ultimoPct) { d = v * d; } // 200 + 10% = 220
        v = op === '+' ? v + d : v - d;
      }
      return v;
    }
    let ultimoPct = false;
    function termo() {
      let v = unario();
      for (;;) {
        if (ve('*')) { p++; v *= unario(); }
        else if (ve('/')) { p++; const d = unario(); if (d === 0) throw new Error('Divisão por zero'); v /= d; }
        else if (ve('n') || ve('f') || ve('(')) v *= unario(); // multiplicação implícita: 2π, 3(4)
        else return v;
      }
    }
    // O sinal de menos vale menos que a potência: -2^2 = -4; o expoente aceita sinal: 2^-1 = 0,5.
    function unario() { if (ve('-')) { p++; return -unario(); } if (ve('+')) { p++; return unario(); } return potencia(); }
    function potencia() { const b = posfixo(); if (ve('^')) { p++; return Math.pow(b, unario()); } return b; }
    function posfixo() {
      let v = primario(); ultimoPct = false;
      while (ve('!') || ve('%')) { if (tk[p++].t === '!') v = fatorial(v); else { v = v / 100; ultimoPct = true; } }
      return v;
    }
    function primario() {
      const x = tk[p];
      if (!x) throw new Error('Expressão incompleta');
      if (x.t === 'n') { p++; return x.v; }
      if (x.t === '(') { p++; const v = soma(); if (!ve(')')) { if (p >= tk.length) return v; throw new Error('Falta fechar parênteses'); } p++; return v; }
      if (x.t === 'f') {
        p++;
        if (CONST[x.v] != null) return CONST[x.v];
        if (FUN[x.v]) { const arg = ve('(') ? (p++, (function () { const v = soma(); if (ve(')')) p++; return v; })()) : posfixo(); return FUN[x.v](arg); }
        throw new Error('Função desconhecida: ' + x.v);
      }
      throw new Error('Expressão inválida');
    }
    const r = soma();
    if (p < tk.length) throw new Error('Expressão inválida');
    if (!isFinite(r)) throw new Error('Resultado indefinido');
    return limpar(r);
  }
  function limpar(x) { return Math.abs(x) < 1e-12 ? 0 : Number(x.toPrecision(15)); }

  // ---------- datas e dias úteis ----------
  function pascoa(ano) { const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1; return new Date(ano, mes - 1, dia); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function somaDias(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function deISO(s) { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }

  // Feriados nacionais (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023) e, opcionalmente, pontos facultativos federais.
  function feriados(ano, facultativos) {
    const f = {};
    [['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'], ['09-07', 'Independência'], ['10-12', 'Nossa Senhora Aparecida'], ['11-02', 'Finados'], ['11-15', 'Proclamação da República'], ['12-25', 'Natal']].forEach(function (x) { f[ano + '-' + x[0]] = x[1]; });
    if (ano >= 2024) f[ano + '-11-20'] = 'Dia Nacional de Zumbi e da Consciência Negra';
    const p = pascoa(ano); f[iso(somaDias(p, -2))] = 'Sexta-feira Santa';
    if (facultativos) { f[iso(somaDias(p, -48))] = 'Carnaval (ponto facultativo)'; f[iso(somaDias(p, -47))] = 'Carnaval (ponto facultativo)'; f[iso(somaDias(p, -46))] = 'Quarta-feira de Cinzas (até 14h)'; f[iso(somaDias(p, 60))] = 'Corpus Christi (ponto facultativo)'; }
    return f;
  }
  function ehUtil(d, opc) { const dw = d.getDay(); if (dw === 0 || dw === 6) return false; const s = iso(d); if (feriados(d.getFullYear(), opc && opc.facultativos)[s]) return false; if (opc && opc.extras && opc.extras.indexOf(s) >= 0) return false; return true; }

  function diferenca(a, b, opc) {
    let d1 = deISO(a), d2 = deISO(b); const sinal = d2 >= d1 ? 1 : -1; if (sinal < 0) { const t = d1; d1 = d2; d2 = t; }
    const dias = Math.round((d2 - d1) / 86400000);
    let uteis = 0; for (let x = somaDias(d1, 1); x <= d2; x = somaDias(x, 1)) if (ehUtil(x, opc)) uteis++;
    let anos = d2.getFullYear() - d1.getFullYear(), meses = d2.getMonth() - d1.getMonth(), ds = d2.getDate() - d1.getDate();
    if (ds < 0) { meses--; ds += new Date(d2.getFullYear(), d2.getMonth(), 0).getDate(); }
    if (meses < 0) { anos--; meses += 12; }
    return { dias: dias * sinal, semanas: Math.floor(dias / 7) * sinal, uteis: uteis * sinal, anos: anos, meses: meses, diasResto: ds, totalMeses: anos * 12 + meses };
  }

  // Soma n dias (corridos ou úteis). Em dias úteis, conta a partir do dia seguinte (exclui o dia do início, inclui o do fim).
  function somar(dataISO, n, uteis, opc) {
    let d = deISO(dataISO); n = Math.trunc(Number(n) || 0);
    if (!uteis) return iso(somaDias(d, n));
    const passo = n >= 0 ? 1 : -1; let k = Math.abs(n);
    while (k > 0) { d = somaDias(d, passo); if (ehUtil(d, opc)) k--; }
    return iso(d);
  }

  function idade(nasc, hoje) {
    const d = diferenca(nasc, hoje); const n = deISO(nasc), h = deISO(hoje);
    let prox = new Date(h.getFullYear(), n.getMonth(), n.getDate()); if (prox < h) prox = new Date(h.getFullYear() + 1, n.getMonth(), n.getDate());
    return { anos: d.anos, meses: d.meses, dias: d.diasResto, totalDias: d.dias, proximoAniversario: iso(prox), faltam: Math.round((prox - h) / 86400000) };
  }

  // ---------- finanças ----------
  function jurosCompostos(capital, taxaPct, periodos, aporte) {
    const i = taxaPct / 100; let saldo = Number(capital) || 0; const tabela = []; let investido = saldo;
    for (let k = 1; k <= periodos; k++) { const j = saldo * i; saldo += j + (Number(aporte) || 0); investido += Number(aporte) || 0; tabela.push({ periodo: k, juros: j, saldo: saldo }); }
    return { montante: saldo, investido: investido, juros: saldo - investido, tabela: tabela };
  }
  function jurosSimples(capital, taxaPct, periodos) { const j = capital * taxaPct / 100 * periodos; return { juros: j, montante: capital + j }; }
  function taxaEquivalente(taxaPct, de, para) { // de/para em meses: 1 = mensal, 12 = anual
    return (Math.pow(1 + taxaPct / 100, para / de) - 1) * 100;
  }
  function price(valor, taxaPct, n) {
    const i = taxaPct / 100; const parcela = i ? valor * i / (1 - Math.pow(1 + i, -n)) : valor / n; let saldo = valor; const t = [];
    for (let k = 1; k <= n; k++) { const j = saldo * i; const amort = parcela - j; saldo -= amort; t.push({ n: k, parcela: parcela, juros: j, amortizacao: amort, saldo: Math.max(0, saldo) }); }
    return { parcela: parcela, total: parcela * n, juros: parcela * n - valor, tabela: t };
  }
  function sac(valor, taxaPct, n) {
    const i = taxaPct / 100; const amort = valor / n; let saldo = valor; const t = []; let total = 0;
    for (let k = 1; k <= n; k++) { const j = saldo * i; const p = amort + j; saldo -= amort; total += p; t.push({ n: k, parcela: p, juros: j, amortizacao: amort, saldo: Math.max(0, saldo) }); }
    return { primeira: t[0].parcela, ultima: t[n - 1].parcela, total: total, juros: total - valor, tabela: t };
  }

  // ---------- matemática ----------
  function mdc(a, b) { a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b)); while (b) { const t = b; b = a % b; a = t; } return a; }
  function mmc(a, b) { return a && b ? Math.abs(a * b) / mdc(a, b) : 0; }
  function fatorar(n) { n = Math.floor(Math.abs(n)); const f = []; for (let d = 2; d * d <= n; d++) while (n % d === 0) { f.push(d); n /= d; } if (n > 1) f.push(n); return f; }
  function ehPrimo(n) { return n > 1 && fatorar(n).length === 1; }
  function fracao(a, b) { if (!b) return null; const g = mdc(a, b) || 1; let n = a / g, d = b / g; if (d < 0) { n = -n; d = -d; } return { n: n, d: d }; }
  function opFracao(a, op, b) {
    let n, d;
    if (op === '+') { n = a.n * b.d + b.n * a.d; d = a.d * b.d; } else if (op === '-') { n = a.n * b.d - b.n * a.d; d = a.d * b.d; } else if (op === '*') { n = a.n * b.n; d = a.d * b.d; } else { n = a.n * b.d; d = a.d * b.n; }
    return fracao(n, d);
  }
  function decimalParaFracao(x, maxDen) { maxDen = maxDen || 10000; let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x; for (let i = 0; i < 64; i++) { const a = Math.floor(b); const h2 = a * h1 + h0, k2 = a * k1 + k0; if (k2 > maxDen) break; h0 = h1; h1 = h2; k0 = k1; k1 = k2; if (Math.abs(x - h1 / k1) < 1e-12) break; b = 1 / (b - a); } return fracao(h1, k1); }
  function romano(n) { n = Math.floor(n); if (n < 1 || n > 3999) return null; const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; t.forEach(function (x) { while (n >= x[0]) { s += x[1]; n -= x[0]; } }); return s; }
  function deRomano(s) { const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; s = String(s).toUpperCase().trim(); if (!/^[IVXLCDM]+$/.test(s)) return null; let t = 0; for (let i = 0; i < s.length; i++) { const a = v[s[i]], b = v[s[i + 1]] || 0; t += a < b ? -a : a; } return romano(t) === s ? t : null; }
  function bhaskara(a, b, c) { if (!a) return null; const d = b * b - 4 * a * c; if (d < 0) return { delta: d, reais: [], complexas: [{ re: -b / (2 * a), im: Math.sqrt(-d) / (2 * a) }] }; return { delta: d, reais: d === 0 ? [-b / (2 * a)] : [(-b + Math.sqrt(d)) / (2 * a), (-b - Math.sqrt(d)) / (2 * a)] }; }
  function estatistica(lista) {
    const v = lista.filter(function (x) { return isFinite(x); }); if (!v.length) return null; const n = v.length; const s = v.slice().sort(function (a, b) { return a - b; });
    const media = v.reduce(function (a, b) { return a + b; }, 0) / n; const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    const freq = {}; v.forEach(function (x) { freq[x] = (freq[x] || 0) + 1; }); const maxF = Math.max.apply(null, Object.values(freq)); const moda = maxF > 1 ? Object.keys(freq).filter(function (k) { return freq[k] === maxF; }).map(Number) : [];
    const varP = v.reduce(function (a, x) { return a + (x - media) * (x - media); }, 0) / n; const varA = n > 1 ? varP * n / (n - 1) : 0;
    return { n: n, soma: media * n, media: media, mediana: med, moda: moda, min: s[0], max: s[n - 1], amplitude: s[n - 1] - s[0], desvioPop: Math.sqrt(varP), desvioAmostral: Math.sqrt(varA) };
  }
  function horasParaMin(h) { const m = String(h).trim().match(/^(-)?(\d+):(\d{1,2})$/); if (!m) return null; return (m[1] ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])); }
  function minParaHoras(m) { const s = m < 0 ? '-' : ''; m = Math.abs(Math.round(m)); return s + Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }

  // ---------- conversões ----------
  const UNIDADES = {
    comprimento: { m: 1, km: 1000, cm: 0.01, mm: 0.001, 'µm': 1e-6, mi: 1609.344, jd: 0.9144, pé: 0.3048, pol: 0.0254, 'milha náutica': 1852 },
    massa: { kg: 1, g: 0.001, mg: 1e-6, t: 1000, lb: 0.45359237, oz: 0.028349523125, arroba: 15 },
    area: { 'm²': 1, 'km²': 1e6, 'cm²': 1e-4, ha: 1e4, alqueire: 24200, 'pé²': 0.09290304, acre: 4046.8564224 },
    volume: { L: 1, mL: 0.001, 'm³': 1000, 'cm³': 0.001, galão: 3.785411784, 'pé³': 28.316846592, xícara: 0.24 },
    velocidade: { 'km/h': 1, 'm/s': 3.6, mph: 1.609344, nó: 1.852 },
    tempo: { s: 1, min: 60, h: 3600, dia: 86400, semana: 604800, mês: 2629800, ano: 31557600 },
    dados: { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776, bit: 0.125 },
    energia: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3.6e6 },
    pressao: { Pa: 1, kPa: 1000, bar: 1e5, atm: 101325, psi: 6894.757293168, mmHg: 133.322387415 },
    potencia: { W: 1, kW: 1000, cv: 735.49875, hp: 745.69987158 },
    temperatura: { '°C': 'c', '°F': 'f', K: 'k' }
  };
  function converter(cat, valor, de, para) {
    valor = Number(valor);
    if (cat === 'temperatura') { let c = de === '°C' ? valor : de === '°F' ? (valor - 32) * 5 / 9 : valor - 273.15; return para === '°C' ? c : para === '°F' ? c * 9 / 5 + 32 : c + 273.15; }
    const t = UNIDADES[cat]; return valor * t[de] / t[para];
  }
  function base(valor, de, para) { const n = parseInt(String(valor).trim(), de); if (isNaN(n)) return null; return n.toString(para).toUpperCase(); }

  // Custo de viagem de carro. o = { km (só ida), idaVolta, extraKm, consumo (km/L), preco (R$/L), pedagios (só ida),
  //   estacionamento, diarias, valorDiaria, pessoas, velocidade (km/h), tanque (L), reserva (fração do tanque guardada) }
  function viagem(o) {
    const voltas = o.idaVolta ? 2 : 1;
    const km = (Number(o.km) || 0) * voltas + (Number(o.extraKm) || 0);
    const consumo = Number(o.consumo) || 0;
    if (!km || !consumo) return null;
    const litros = km / consumo;
    const combustivel = litros * (Number(o.preco) || 0);
    const pedagios = (Number(o.pedagios) || 0) * voltas;
    const hospedagem = (Number(o.diarias) || 0) * (Number(o.valorDiaria) || 0);
    const total = combustivel + pedagios + (Number(o.estacionamento) || 0) + hospedagem;
    const pessoas = Math.max(1, Math.floor(Number(o.pessoas) || 1));
    const autonomia = (Number(o.tanque) || 0) * consumo * (1 - (o.reserva == null ? 0.15 : Number(o.reserva)));
    const paradas = autonomia > 0 ? Math.max(0, Math.ceil(km / autonomia) - 1) : null;
    const horas = Number(o.velocidade) > 0 ? km / Number(o.velocidade) : null;
    return { km: km, litros: litros, combustivel: combustivel, pedagios: pedagios, hospedagem: hospedagem, total: total, porPessoa: total / pessoas, porKm: total / km, autonomia: autonomia || null, paradas: paradas, horas: horas };
  }

  return { viagem: viagem, avaliar: avaliar, fatorial: fatorial, pascoa: pascoa, feriados: feriados, ehUtil: ehUtil, diferenca: diferenca, somar: somar, idade: idade, jurosCompostos: jurosCompostos, jurosSimples: jurosSimples, taxaEquivalente: taxaEquivalente, price: price, sac: sac, mdc: mdc, mmc: mmc, fatorar: fatorar, ehPrimo: ehPrimo, fracao: fracao, opFracao: opFracao, decimalParaFracao: decimalParaFracao, romano: romano, deRomano: deRomano, bhaskara: bhaskara, estatistica: estatistica, horasParaMin: horasParaMin, minParaHoras: minParaHoras, UNIDADES: UNIDADES, converter: converter, base: base, iso: iso };
});
