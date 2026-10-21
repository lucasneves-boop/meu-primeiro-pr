/* Seven Licita — núcleo: regras puras, sem DOM, testáveis no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Nucleo = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- texto ----------
  function normalizar(t) {
    return String(t || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
  }

  // Lista separada por vírgula ou ponto e vírgula; cada termo pode ter várias palavras.
  function termos(t) {
    return String(t || '').split(/[,;\n]/).map(normalizar).filter(Boolean);
  }

  // Um termo casa quando todas as suas palavras aparecem no texto (em qualquer ordem).
  function contemTermo(textoNorm, termo) {
    const alvo = ' ' + textoNorm + ' ';
    return termo.split(' ').every(function (p) {
      return p.length <= 3 ? alvo.indexOf(' ' + p + ' ') >= 0 : alvo.indexOf(p) >= 0;
    });
  }

  // Produto do catálogo: O que vendo (algum termo), Qual tipo (algum termo, se preenchido),
  // O que não vendo (nenhum termo).
  function casaProduto(texto, produto) {
    if (!produto || produto.ativo === false) return false;
    const n = normalizar(texto);
    const vendo = termos(produto.oQueVendo);
    if (!vendo.length || !vendo.some(function (t) { return contemTermo(n, t); })) return false;
    const tipo = termos(produto.qualTipo);
    if (tipo.length && !tipo.some(function (t) { return contemTermo(n, t); })) return false;
    const nao = termos(produto.oQueNaoVendo);
    if (nao.some(function (t) { return contemTermo(n, t); })) return false;
    return true;
  }

  function produtosQueCasam(texto, produtos) {
    return (produtos || []).filter(function (p) { return casaProduto(texto, p); });
  }

  // ---------- datas ----------
  const DIA = 86400000;
  function inicioDoDia(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function diasEntre(a, b) { return Math.round((inicioDoDia(b) - inicioDoDia(a)) / DIA); }
  function yyyymmdd(d) {
    const x = new Date(d);
    return '' + x.getFullYear() + String(x.getMonth() + 1).padStart(2, '0') + String(x.getDate()).padStart(2, '0');
  }

  // Documento: válido até 23h59 do dia da validade; aviso 7 dias antes.
  function statusDocumento(validade, hoje) {
    if (!validade) return { codigo: 'sem-validade', rotulo: 'Sem validade', dias: null };
    const d = diasEntre(hoje || new Date(), validade + 'T12:00:00');
    if (d < 0) return { codigo: 'vencido', rotulo: 'Vencido', dias: d };
    if (d <= 7) return { codigo: 'vencendo', rotulo: d === 0 ? 'Vence hoje' : 'Vence em ' + d + ' dia(s)', dias: d };
    return { codigo: 'valido', rotulo: 'Válido', dias: d };
  }

  // ---------- situações (Monitorar) ----------
  const CATEGORIAS = ['Agendada', 'Em andamento', 'Em julgamento/adjudicação', 'Concluída/homologada', 'Cancelada/fracassada'];

  // ---------- CAPAG ----------
  function leituraCapag(nota) {
    const n = String(nota || '').toUpperCase().replace('+', '');
    if (n === 'A' || n === 'B') return 'boa';
    if (n === 'C') return 'intermediária';
    if (n === 'D' || n === 'E') return 'risco';
    return 'sem nota';
  }

  // Planilha da CAPAG (Tesouro Transparente): acha o cabeçalho e as colunas pelo nome, seja qual for a ordem.
  function normalizarNotaCapag(v) {
    const t = String(v || '').toUpperCase().replace(/\s/g, '');
    const m = t.match(/^([A-E])(\+)?$/) || t.match(/^([A-E])(\+)?[^A-Z]/);
    if (m) return m[1] + (m[2] || '');
    if (/N\.?D|NAO|SEM|^-$/.test(t)) return 'n.d.';
    return '';
  }
  function chaveCapag(municipio, uf) { return normalizar(municipio) + '-' + String(uf || '').toUpperCase(); }
  function lerPlanilhaCapag(linhas) {
    const achar = function (cab, res) { for (const re of res) { const i = cab.findIndex(function (c) { return re.test(c); }); if (i >= 0) return i; } return -1; };
    let h = -1, col = null;
    for (let i = 0; i < Math.min(linhas.length, 30) && h < 0; i++) {
      const cab = linhas[i].map(normalizar);
      const nota = achar(cab, [/^capag$/, /^classificacao capag/, /capag/, /classificacao/, /^nota$/]);
      const nome = achar(cab, [/^municipio$/, /^nome do municipio/, /municipio/, /^ente$/, /nome/]);
      if (nota >= 0 && nome >= 0) { h = i; col = { nota: nota, nome: nome, uf: achar(cab, [/^uf$/, /sigla uf/, /^estado$/, /\buf\b/]), ibge: achar(cab, [/ibge/, /^cod/, /codigo/]), ano: achar(cab, [/^ano/, /exercicio/, /referencia/]) }; }
    }
    if (h < 0) return [];
    const out = [];
    linhas.slice(h + 1).forEach(function (l) {
      const nota = normalizarNotaCapag(l[col.nota]); const nome = String(l[col.nome] || '').trim();
      if (!nome || !nota) return;
      const ibge = col.ibge >= 0 ? String(l[col.ibge] || '').replace(/\D/g, '') : '';
      out.push({ municipio: nome, uf: col.uf >= 0 ? String(l[col.uf] || '').trim().toUpperCase().slice(0, 2) : '', ibge: ibge.length >= 6 ? ibge : '', nota: nota, ano: col.ano >= 0 ? String(l[col.ano] || '').trim() : '' });
    });
    return out;
  }

  // ---------- números ----------
  function arredondarBaixo(v, casas) { const f = Math.pow(10, casas); return Math.floor(v * f + 1e-9) / f; }
  function arredondarCima(v, casas) { const f = Math.pow(10, casas); return Math.ceil(v * f - 1e-9) / f; }
  function arredondar(v, casas) { const f = Math.pow(10, casas); return Math.round(v * f) / f; }

  function lerNumeroBR(t) {
    if (typeof t === 'number') return t;
    let s = String(t || '').trim().replace(/[R$\s]/g, '');
    if (!s) return NaN;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    return Number(s);
  }

  function estatisticas(valores) {
    const v = valores.filter(function (x) { return isFinite(x); }).slice().sort(function (a, b) { return a - b; });
    if (!v.length) return { n: 0, min: null, max: null, media: null, mediana: null, soma: 0 };
    const soma = v.reduce(function (a, b) { return a + b; }, 0);
    const meio = Math.floor(v.length / 2);
    return {
      n: v.length, min: v[0], max: v[v.length - 1], soma: soma, media: soma / v.length,
      mediana: v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2
    };
  }

  // Agrupa e soma; devolve [{chave, total, qtd, participacao}] em ordem decrescente.
  function ranking(lista, chaveFn, valorFn) {
    const mapa = {};
    let total = 0;
    lista.forEach(function (x) {
      const k = chaveFn(x) || '—';
      const v = Number(valorFn(x)) || 0;
      mapa[k] = mapa[k] || { chave: k, total: 0, qtd: 0 };
      mapa[k].total += v; mapa[k].qtd += 1; total += v;
    });
    return Object.keys(mapa).map(function (k) {
      const r = mapa[k]; r.participacao = total ? r.total / total : 0; return r;
    }).sort(function (a, b) { return b.total - a.total || b.qtd - a.qtd; });
  }

  function concentracao(rank, n) {
    return rank.slice(0, n).reduce(function (a, r) { return a + r.participacao; }, 0);
  }

  // ---------- CSV (separador ;, padrão Excel pt-BR) ----------
  function paraCSV(linhas) {
    return linhas.map(function (l) {
      return l.map(function (c) {
        let s = c == null ? '' : typeof c === 'number' ? String(c).replace('.', ',') : String(c);
        if (/[;"\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(';');
    }).join('\r\n');
  }

  function lerCSV(texto) {
    const linhas = []; let campo = ''; let linha = []; let aspas = false;
    const t = String(texto || '').replace(/^﻿/, '');
    const sep = (t.split('\n')[0].match(/;/g) || []).length >= (t.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (aspas) {
        if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') aspas = false;
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === sep) { linha.push(campo); campo = ''; }
      else if (c === '\n') { linha.push(campo.replace(/\r$/, '')); linhas.push(linha); linha = []; campo = ''; }
      else campo += c;
    }
    if (campo || linha.length) { linha.push(campo.replace(/\r$/, '')); linhas.push(linha); }
    return linhas.filter(function (l) { return l.some(function (c) { return c.trim(); }); });
  }

  // ---------- formação de preço ----------
  // preço = custo / (1 - impostos% - margem%) + frete por unidade
  function precoSugerido(custo, impostosPct, margemPct, fretePorUnidade) {
    const den = 1 - (Number(impostosPct) || 0) / 100 - (Number(margemPct) || 0) / 100;
    if (den <= 0) return NaN;
    return (Number(custo) || 0) / den + (Number(fretePorUnidade) || 0);
  }

  // ---------- robô de lances: decisão ----------
  // estado: { limite, meuLance, lances: [valores dos concorrentes], casas, reducao: {tipo, min, max},
  //           intervaloMinimo: {tipo, valor}, estrategia: 'melhor'|'limite'|'primeiro', posicaoAlvo, sorteio }
  // Devolve { lance: número|null, motivo }
  function reducaoEfetiva(base, cfg, sorteio) {
    const r = cfg.reducao || { tipo: 'valor', min: 0.01, max: 0.01 };
    const s = typeof sorteio === 'number' ? sorteio : Math.random();
    const bruto = Number(r.min) + (Number(r.max) - Number(r.min)) * s;
    let red = r.tipo === 'percentual' ? base * bruto / 100 : bruto;
    const im = cfg.intervaloMinimo;
    if (im && im.valor) {
      const minPortal = im.tipo === 'percentual' ? base * im.valor / 100 : im.valor;
      if (red < minPortal) red = minPortal;
    }
    return red;
  }

  function decidirLance(e) {
    const casas = e.casas == null ? 2 : e.casas;
    const limite = arredondarCima(e.limite, casas);
    const meu = e.meuLance == null ? Infinity : e.meuLance;
    const outros = (e.lances || []).filter(function (v) { return isFinite(v); }).slice().sort(function (a, b) { return a - b; });
    const posicao = 1 + outros.filter(function (v) { return v < meu || (v === meu && e.empatePerde); }).length;
    const alvo = Math.max(1, e.posicaoAlvo || 1);
    if (posicao <= alvo) return { lance: null, motivo: 'Já na posição ' + posicao };
    if (meu <= limite) return { lance: null, motivo: 'Valor limite atingido' };

    // Para ocupar a posição alvo, é preciso ficar abaixo do concorrente que hoje ocupa essa posição.
    const referencia = outros[alvo - 1];
    const objetivo = arredondarBaixo(referencia - reducaoEfetiva(referencia, e, e.sorteio), casas);
    if (objetivo >= limite) return { lance: Math.min(objetivo, arredondarBaixo(meu - 0.000001, casas)), motivo: 'Disputa a ' + alvo + 'ª posição' };

    if (e.estrategia === 'limite') return { lance: limite, motivo: 'Sem margem para a ' + alvo + 'ª: envia o valor limite' };
    if (e.estrategia === 'melhor') {
      // melhor posição que o limite permite: fica logo abaixo do concorrente mais barato que ainda dá para passar
      for (let i = alvo; i < outros.length; i++) {
        const c = outros[i];
        if (c >= meu) break;
        const v = arredondarBaixo(c - reducaoEfetiva(c, e, e.sorteio), casas);
        if (v >= limite && v < meu) return { lance: v, motivo: 'Melhor posição possível: ' + (i + 1) + 'ª' };
      }
      return { lance: null, motivo: 'Sem margem para melhorar a posição' };
    }
    return { lance: null, motivo: 'Sem margem para a ' + alvo + 'ª posição; robô parado' };
  }

  // Aberto/fechado (art. 56 da Lei 14.133 e regulamentos): vão para a etapa fechada o melhor lance
  // e os até 10% acima dele; se forem menos de três, os três melhores.
  function convocadosEtapaFechada(lances) {
    const v = lances.slice().sort(function (a, b) { return a.valor - b.valor; });
    if (!v.length) return [];
    const teto = v[0].valor * 1.10;
    let conv = v.filter(function (x) { return x.valor <= teto + 1e-9; });
    if (conv.length < 3) conv = v.slice(0, 3);
    return conv;
  }

  // Simulação simplificada de um item, passo a passo (1 passo = 1 segundo).
  // Serve para ensaiar a configuração; não conversa com portal nenhum.
  function criarSimulacao(cfg) {
    const rnd = semente(cfg.semente || Date.now());
    const ref = cfg.referencia;
    const concorrentes = [];
    for (let i = 0; i < (cfg.concorrentes || 4); i++) {
      const piso = ref * (1 - (cfg.agressividadeMin || 0.05) - rnd() * ((cfg.agressividadeMax || 0.30) - (cfg.agressividadeMin || 0.05)));
      concorrentes.push({ nome: 'Fornecedor ' + String.fromCharCode(65 + i), piso: arredondar(piso, cfg.casas || 2), lance: arredondar(ref * (0.98 + rnd() * 0.04), cfg.casas || 2), ritmo: 0.03 + rnd() * 0.12 });
    }
    const s = {
      cfg: cfg, rnd: rnd, t: 0, fase: cfg.inicio === 'prorrogacao' ? 'aberta-espera' : 'aberta',
      duracaoAberta: cfg.modo === 'aberto-fechado' ? 900 : 600,
      fimFase: cfg.modo === 'aberto-fechado' ? 900 : 600,
      meuLance: cfg.propostaInicial || ref, concorrentes: concorrentes, log: [], historico: [], encerrada: false,
      ultimoLanceEm: -1, aleatorio: Math.floor(rnd() * 600)
    };
    s.log.push({ t: 0, quem: 'Sessão', texto: 'Aberta a fase de lances (' + (cfg.modo === 'aberto-fechado' ? 'aberto/fechado' : cfg.modo === 'dispensa' ? 'dispensa' : 'aberto') + ').' });
    return s;
  }

  function semente(seed) {
    let x = Math.abs(Math.floor(seed)) % 2147483647 || 1;
    return function () { x = x * 48271 % 2147483647; return (x - 1) / 2147483646; };
  }

  function posicaoAtual(s) {
    return 1 + s.concorrentes.filter(function (c) { return c.lance < s.meuLance; }).length;
  }

  function passoSimulacao(s) {
    if (s.encerrada) return s;
    const cfg = s.cfg; const casas = cfg.casas == null ? 2 : cfg.casas;
    s.t += 1;
    const restante = s.fimFase - s.t;
    const intervalo = cfg.intervaloMinimo || { tipo: 'valor', valor: 0.01 };

    // concorrentes
    s.concorrentes.forEach(function (c) {
      const melhor = Math.min(s.meuLance, Math.min.apply(null, s.concorrentes.map(function (o) { return o.lance; })));
      const urgencia = restante < 60 ? 3 : 1;
      if (c.lance > c.piso && s.rnd() < c.ritmo * urgencia) {
        const passo = intervalo.tipo === 'percentual' ? melhor * intervalo.valor / 100 : intervalo.valor;
        let novo = c.lance <= melhor ? c.lance - passo * (1 + Math.floor(s.rnd() * 3)) : melhor - passo * (1 + Math.floor(s.rnd() * 5));
        novo = Math.max(c.piso, arredondarBaixo(novo, casas));
        if (novo < c.lance) { c.lance = novo; s.ultimoLanceEm = s.t; s.log.push({ t: s.t, quem: c.nome, texto: 'Lance ' + fmt(novo, casas) }); }
      }
    });

    // robô
    let pode = s.fase === 'aberta' || s.fase === 'prorrogacao' || s.fase === 'aleatoria';
    if (s.fase === 'prorrogacao' && cfg.enviarRestando && restante > cfg.enviarRestando) pode = false;
    if (cfg.modo === 'aberto-fechado' && cfg.estrategiasAF && (cfg.estrategiasAF.top3 || cfg.estrategiasAF.distancia || cfg.estrategiasAF.excluir)) {
      const decisaoAF = decidirAbertoFechado(s);
      if (decisaoAF && pode) aplicarLance(s, decisaoAF.lance, decisaoAF.motivo);
    } else if (pode && s.rnd() < 0.5) {
      const d = decidirLance({
        limite: cfg.limite, meuLance: s.meuLance, casas: casas, reducao: cfg.reducao, intervaloMinimo: intervalo,
        estrategia: cfg.estrategia, posicaoAlvo: cfg.posicaoAlvo, sorteio: s.rnd(),
        lances: s.concorrentes.map(function (c) { return c.lance; })
      });
      if (d.lance != null) aplicarLance(s, d.lance, d.motivo);
    }

    // dispensa: cobrir o próprio lance nos segundos finais
    if (cfg.modo === 'dispensa' && cfg.cobrirProprio && restante === 5 && posicaoAtual(s) === 1) {
      const passo = intervalo.tipo === 'percentual' ? s.meuLance * intervalo.valor / 100 : intervalo.valor;
      const v = arredondarBaixo(s.meuLance - passo, casas);
      if (v >= cfg.limite) aplicarLance(s, v, 'Cobre o próprio lance nos segundos finais');
    }

    s.historico.push({ t: s.t, meu: s.meuLance, melhor: Math.min.apply(null, s.concorrentes.map(function (c) { return c.lance; })) });

    // transições de fase
    if (s.fase === 'aberta-espera' && s.t >= s.duracaoAberta - 120) { s.fase = 'aberta'; }
    if (cfg.modo === 'aberto-fechado') {
      if (s.fase === 'aberta' && s.t >= s.fimFase) { s.fase = 'aleatoria'; s.fimFase = s.t + s.aleatorio; s.log.push({ t: s.t, quem: 'Sessão', texto: 'Encerrada a fase aberta. Tempo aleatório iniciado.' }); }
      else if (s.fase === 'aleatoria' && s.t >= s.fimFase) etapaFechada(s);
    } else if (s.t >= s.fimFase) {
      if (s.ultimoLanceEm > s.fimFase - 120) { s.fase = 'prorrogacao'; s.fimFase = s.ultimoLanceEm + 120; if (s.fimFase <= s.t) encerrar(s); else s.log.push({ t: s.t, quem: 'Sessão', texto: 'Prorrogação automática (lance nos 2 minutos finais).' }); }
      else encerrar(s);
    }
    if (s.t > 7200) encerrar(s);
    return s;
  }

  function fmt(v, casas) { return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }); }

  function aplicarLance(s, v, motivo) {
    if (v == null || !(v < s.meuLance)) return;
    s.meuLance = v; s.ultimoLanceEm = s.t;
    s.log.push({ t: s.t, quem: 'Robô', texto: 'Lance ' + fmt(v, s.cfg.casas == null ? 2 : s.cfg.casas) + ' — ' + motivo, robo: true });
  }

  function decidirAbertoFechado(s) {
    const cfg = s.cfg; const af = cfg.estrategiasAF; const casas = cfg.casas == null ? 2 : cfg.casas;
    const outros = s.concorrentes.map(function (c) { return c.lance; }).sort(function (a, b) { return a - b; });
    const n = outros.length + 1;
    if (n <= 3) return null; // convocação já garantida
    const intervalo = cfg.intervaloMinimo || { tipo: 'valor', valor: 0.01 };
    const red = function (b) { return reducaoEfetiva(b, cfg, s.rnd()); };
    // 1) excluir o seguinte colocado
    if (af.excluir) {
      const alvoN = af.excluirPosicao || 4;
      const conc = outros[alvoN - 2];
      if (conc != null && posicaoAtual(s) <= alvoN) {
        const teto = arredondarBaixo(conc / 1.10 - 0.01, casas);
        if (s.meuLance > teto && teto >= cfg.limite) return { lance: teto, motivo: 'Deixa o ' + alvoN + 'º fora dos 10% da etapa fechada' };
      }
    }
    // 2) distância máxima do 1º
    if (af.distancia) {
      const pct = (af.distanciaPct || 10) / 100;
      const primeiro = Math.min(outros[0], s.meuLance);
      const teto = arredondarBaixo(primeiro * (1 + pct), casas);
      if (s.meuLance > teto) { const v = Math.max(teto, arredondarCima(cfg.limite, casas)); if (v < s.meuLance) return { lance: v, motivo: 'Fica a até ' + (pct * 100) + '% do 1º colocado' }; }
    }
    // 3) top 3
    if (af.top3 && posicaoAtual(s) > 3) {
      const terceiro = outros[2];
      const v = arredondarBaixo(terceiro - red(terceiro), casas);
      if (v >= cfg.limite) return { lance: v, motivo: 'Top 3: garante a convocação' };
    }
    void intervalo;
    return null;
  }

  function etapaFechada(s) {
    const cfg = s.cfg;
    const todos = s.concorrentes.map(function (c) { return { nome: c.nome, valor: c.lance, c: c }; }).concat([{ nome: 'Sua empresa', valor: s.meuLance, eu: true }]);
    const conv = convocadosEtapaFechada(todos);
    s.log.push({ t: s.t, quem: 'Sessão', texto: 'Convocados para a etapa fechada: ' + conv.map(function (x) { return x.nome; }).join(', ') });
    conv.forEach(function (x) {
      if (x.eu) {
        if (cfg.lanceFechado && cfg.lanceFechado < s.meuLance && cfg.lanceFechado >= cfg.limite) { s.meuLance = cfg.lanceFechado; s.log.push({ t: s.t, quem: 'Robô', texto: 'Lance fechado ' + fmt(cfg.lanceFechado, 2), robo: true }); }
      } else {
        const v = arredondarBaixo(Math.max(x.c.piso, x.c.lance * (1 - s.rnd() * 0.05)), cfg.casas == null ? 2 : cfg.casas);
        x.c.lance = v; s.log.push({ t: s.t, quem: x.nome, texto: 'Lance fechado ' + fmt(v, 2) });
      }
    });
    if (!conv.some(function (x) { return x.eu; })) s.log.push({ t: s.t, quem: 'Sessão', texto: 'Sua empresa NÃO foi convocada para a etapa fechada.' });
    encerrar(s);
  }

  function encerrar(s) {
    s.encerrada = true; s.fase = 'encerrada';
    const p = posicaoAtual(s);
    s.resultado = { posicao: p, meuLance: s.meuLance, melhorConcorrente: Math.min.apply(null, s.concorrentes.map(function (c) { return c.lance; })) };
    s.log.push({ t: s.t, quem: 'Sessão', texto: 'Disputa encerrada. Sua posição: ' + p + 'º, lance ' + fmt(s.meuLance, s.cfg.casas == null ? 2 : s.cfg.casas) + '.' });
  }

  // ---------- palavras-chave do chat ----------
  function destacar(texto, palavras) {
    const n = normalizar(texto);
    return (palavras || []).filter(function (p) { return p.termo && contemTermo(n, normalizar(p.termo)); });
  }

  return {
    normalizar: normalizar, termos: termos, contemTermo: contemTermo, casaProduto: casaProduto, produtosQueCasam: produtosQueCasam,
    diasEntre: diasEntre, yyyymmdd: yyyymmdd, statusDocumento: statusDocumento, CATEGORIAS: CATEGORIAS, leituraCapag: leituraCapag,
    arredondar: arredondar, arredondarBaixo: arredondarBaixo, arredondarCima: arredondarCima, lerNumeroBR: lerNumeroBR,
    estatisticas: estatisticas, ranking: ranking, concentracao: concentracao, paraCSV: paraCSV, lerCSV: lerCSV,
    precoSugerido: precoSugerido, reducaoEfetiva: reducaoEfetiva, decidirLance: decidirLance,
    convocadosEtapaFechada: convocadosEtapaFechada, criarSimulacao: criarSimulacao, passoSimulacao: passoSimulacao,
    posicaoAtual: posicaoAtual, destacar: destacar, lerPlanilhaCapag: lerPlanilhaCapag, normalizarNotaCapag: normalizarNotaCapag, chaveCapag: chaveCapag
  };
});
