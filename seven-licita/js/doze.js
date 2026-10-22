/* 1 Ano em 12 Semanas: calendário do ciclo, táticas por semana, pontuação, diagnóstico, checagem de qualidade do plano
   e conta de trás para frente. Baseado no método de Moran e Lennington, descrito com palavras próprias. Puro. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Doze = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const AREAS = ['Trabalho e dinheiro', 'Saúde e corpo', 'Relacionamento amoroso', 'Família', 'Espiritualidade', 'Comunidade', 'Desenvolvimento pessoal'];
  const FASES = [{ ate: 4, t: 'Instalar o hábito' }, { ate: 8, t: 'Zona de risco: manter o ritmo' }, { ate: 12, t: 'Terminar forte' }, { ate: 13, t: 'Recuperar, revisar e comemorar' }];
  const RECADOS = {
    1: 'Semana 1: o que conta é planejar e começar. A primeira pontuação sai no início da semana 2.',
    2: 'A primeira pontuação não precisa ser boa; o que conta é ter pontuado e planejado.',
    3: 'Se ainda não começou direito, o momento é agora: escreva hoje o que falta.',
    5: 'Restam 7 semanas. Imagine o resultado se cada uma chegasse a 85%.',
    8: 'O incômodo de ver a própria execução é esperado. Use como combustível em vez de parar de medir.',
    11: 'Menos de duas semanas. O que dá para fazer hoje?',
    12: 'Última semana: termine forte o dia, a semana e o ciclo.',
    13: 'Semana 13: recupere pendências, revise o ciclo e comemore.'
  };
  const REVISAO = ['Qual foi a pontuação média e como ela evoluiu?', 'As metas foram atingidas? Em que medida?', 'Que táticas geraram mais resultado e quais quase não pesaram?', 'Onde a execução falhou com mais frequência, e por quê?', 'O que manter, o que parar e o que começar no próximo ciclo?', 'O que merece ser comemorado, e como?'];

  function d(iso) { return new Date(iso + 'T12:00:00Z'); }
  function iso(dt) { return dt.toISOString().slice(0, 10); }
  function somar(isoData, dias) { const x = d(isoData); x.setUTCDate(x.getUTCDate() + dias); return iso(x); }
  function segunda(isoData) { const x = d(isoData); const dow = x.getUTCDay(); const add = dow === 1 ? 0 : (8 - dow) % 7; return somar(isoData, add); }
  function fase(n) { return (FASES.find(function (f) { return n <= f.ate; }) || FASES[3]).t; }
  function calendario(inicio) {
    const s = segunda(inicio); const out = [];
    for (let n = 1; n <= 13; n++) { const ini = somar(s, (n - 1) * 7); out.push({ n: n, inicio: ini, fim: somar(ini, 6), fase: fase(n) }); }
    return { inicio: s, fim: somar(s, 83), fim13: somar(s, 90), semanas: out, ajustado: s !== inicio };
  }
  // 0 = antes do início, 1..13, 14 = depois da 13ª
  function semanaAtual(inicio, hoje) { const s = segunda(inicio); const dias = Math.floor((d(hoje) - d(s)) / 864e5); if (dias < 0) return 0; return Math.min(14, Math.floor(dias / 7) + 1); }
  function diasRestantes(inicio, hoje) { return Math.max(0, Math.round((d(somar(segunda(inicio), 83)) - d(hoje)) / 864e5)); }

  // quando: { tipo: 'unica', semana } | { tipo: 'recorrente', de, ate }
  function vence(t, n) { const q = t.quando || {}; return q.tipo === 'unica' ? q.semana === n : n >= (q.de || 1) && n <= (q.ate || 12); }
  function taticasDaSemana(plano, n) { return (plano.taticas || []).filter(function (t) { return n >= 1 && n <= 12 && vence(t, n); }); }
  function pontuacao(plano, n) {
    const ts = taticasDaSemana(plano, n); const ex = (plano.execucao || {})[n] || {};
    const feitas = ts.filter(function (t) { return ex[t.id]; }).length;
    return { previstas: ts.length, feitas: feitas, pct: ts.length ? Math.round(feitas / ts.length * 100) : null };
  }
  function leitura(pct) { if (pct == null) return { nivel: 'sem', t: 'Sem táticas previstas' }; if (pct >= 85) return { nivel: 'otimo', t: 'Execução no nível que costuma levar à meta. Mantenha.' }; if (pct >= 60) return { nivel: 'medio', t: 'Há progresso, mas abaixo do potencial. Esse nível basta para chegar à meta?' }; return { nivel: 'baixo', t: 'Sinal de alerta: investigue o que bloqueou a execução.' }; }
  // Média das semanas já pontuadas (até a semana anterior à atual)
  function media(plano, ateSemana) {
    const ps = []; for (let n = 1; n <= Math.min(12, ateSemana); n++) { const p = pontuacao(plano, n); if (p.pct != null && (plano.pontuadas || {})[n]) ps.push(p.pct); }
    return ps.length ? Math.round(ps.reduce(function (a, b) { return a + b; }, 0) / ps.length) : null;
  }
  function serie(plano) { const out = []; for (let n = 1; n <= 12; n++) { const p = pontuacao(plano, n); out.push({ n: n, pct: (plano.pontuadas || {})[n] ? p.pct : null }); } return out; }
  function diagnostico(pctRecente, resultadoBom, semanasAltas) {
    if (pctRecente == null) return { t: 'Pontue as semanas para ter um diagnóstico.', acao: '' };
    if (pctRecente < 85 && !resultadoBom) return { t: 'Problema de execução', acao: 'Não mexa no plano. Descubra o que impediu (agenda, clareza, medo, energia) e resolva isso nesta semana.' };
    if (pctRecente >= 85 && !resultadoBom) return (semanasAltas || 0) >= 3 ? { t: 'Problema de plano', acao: 'Você executou bem por algumas semanas e o resultado não veio: ajuste as táticas com base no que a execução ensinou.' } : { t: 'Aguarde mais semanas', acao: 'Execução boa há pouco tempo; o resultado costuma reagir com atraso. Mantenha o ritmo.' };
    if (pctRecente >= 85 && resultadoBom) return { t: 'No caminho', acao: 'Continue; considere antecipar ações.' };
    return { t: 'Resultado de semanas anteriores ou sorte', acao: 'O resultado tende a cair depois. Volte a executar.' };
  }

  // ---------- qualidade do plano ----------
  const VERBO = /^(\p{L}+(ar|er|ir|or|ôr|pôr))\b/iu;
  const VERBOS_EXTRA = /^(fazer|ler|ver|ter|dar|ir|pôr|manter|enviar|ligar|visitar|publicar|treinar|estudar|montar|criar|revisar|cadastrar|participar|disputar|apresentar|agendar|contratar|abrir|fechar|vender|prospectar|analisar)\b/i;
  function comecaComVerbo(t) { const p = String(t || '').trim(); return VERBO.test(p) || VERBOS_EXTRA.test(p); }
  function temQuantidade(t) { return /\d|\b(uma?|duas|dois|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|toda|todos|todas|diari|semanal|cada)\b/i.test(String(t || '')); }
  function checarPlano(p) {
    const its = []; const add = function (ok, t, dica) { its.push({ ok: !!ok, t: t, dica: dica || '' }); };
    const metas = p.metas || [], tat = p.taticas || [];
    add(p.inicio, 'Data de início (segunda-feira da semana 1)');
    add(p.visao && p.visao.longo && p.visao.porque, 'Visão de longo prazo com um porquê pessoal', 'Sem um porquê forte, o conforto de hoje vence o futuro.');
    add(p.visao && p.visao.tres, 'Visão de 3 anos com detalhes');
    add(metas.length >= 1 && metas.length <= 3, 'De 1 a 3 metas', metas.length > 3 ? 'Muitas metas levam a fazer tudo pela metade. Guarde as outras para o próximo ciclo.' : '');
    add(metas.length && metas.every(function (m) { return m.de !== '' && m.de != null && m.para !== '' && m.para != null; }), 'Cada meta com ponto de partida e alvo numérico');
    add(metas.length && metas.every(function (m) { return tat.some(function (t) { return t.meta === m.id; }); }), 'Cada meta tem táticas');
    add(metas.length && metas.every(function (m) { return tat.some(function (t) { return t.meta === m.id && t.fundamental; }); }), 'Ação fundamental marcada em cada meta', 'Se só pudesse fazer uma, qual seria? Essa não pode ficar fora.');
    const semVerbo = tat.filter(function (t) { return !comecaComVerbo(t.texto); });
    add(tat.length && !semVerbo.length, 'Táticas começam com verbo', semVerbo.length ? 'Reescreva: ' + semVerbo.slice(0, 3).map(function (t) { return '“' + t.texto + '”'; }).join(', ') : '');
    const semQtd = tat.filter(function (t) { return t.quando && t.quando.tipo === 'recorrente' && !temQuantidade(t.texto); });
    add(tat.length && !semQtd.length, 'Táticas recorrentes com quantidade', semQtd.length ? 'Diga quanto por semana: ' + semQtd.slice(0, 3).map(function (t) { return '“' + t.texto + '”'; }).join(', ') : '');
    const unicas = tat.filter(function (t) { return t.quando && t.quando.tipo === 'unica'; }); const naS1 = unicas.filter(function (t) { return t.quando.semana === 1; }).length;
    add(unicas.length < 3 || naS1 / unicas.length <= 0.4, 'Ações únicas distribuídas pelo ciclo', 'A semana 1 está carregada demais.');
    if (p.equipe) add(tat.length && tat.every(function (t) { return t.resp; }), 'Cada tática com um único responsável', 'Quando todos são responsáveis, ninguém é.');
    const h = horasSemana(p, 1); add(!p.horasDisponiveis || h <= p.horasDisponiveis, 'Táticas cabem na semana', p.horasDisponiveis ? h + ' h previstas para ' + p.horasDisponiveis + ' h disponíveis' : '');
    add(p.tempo && p.tempo.estrategico, 'Bloco estratégico definido');
    add(p.tempo && p.tempo.rotina, 'Horário da rotina semanal (pontuar e planejar)');
    add(p.compromisso && (p.compromisso.parceiro || p.compromisso.rsr), 'Apoio definido (reunião semanal ou parceiro)');
    const ok = its.filter(function (x) { return x.ok; }).length;
    return { itens: its, ok: ok, total: its.length, pct: Math.round(ok / its.length * 100) };
  }
  function horasSemana(p, n) { return Math.round(taticasDaSemana(p, n).reduce(function (s, t) { return s + (Number(t.horas) || 0); }, 0) * 10) / 10; }
  function maiorCarga(p) { let m = 0; for (let n = 1; n <= 12; n++) m = Math.max(m, horasSemana(p, n)); return m; }

  // Conta de trás para frente: meta ÷ tíquete = vendas; ÷ conversão = propostas; ÷ semanas.
  function regressiva(o) {
    const vendas = Math.ceil(o.meta / o.ticket); const propostas = Math.ceil(vendas / (o.conversao / 100)); const semanas = o.semanas || 12;
    return { vendas: vendas, propostas: propostas, porSemana: Math.ceil(propostas / semanas) };
  }

  function progressoMeta(m, valor) { const de = Number(m.de), para = Number(m.para), v = Number(valor); if ([de, para, v].some(isNaN) || para === de) return null; return Math.max(0, Math.min(100, Math.round((v - de) / (para - de) * 100))); }

  function markdown(p) {
    const cal = calendario(p.inicio); const br = function (x) { return x.split('-').reverse().join('/'); };
    const L = ['# Meu Ano em 12 Semanas: ' + br(cal.inicio) + ' a ' + br(cal.fim), '', '## Visão', '**Longo prazo:** ' + ((p.visao || {}).longo || ''), '**Em 3 anos:** ' + ((p.visao || {}).tres || ''), '**Por que isso importa:** ' + ((p.visao || {}).porque || ''), '', '## Metas das 12 semanas'];
    (p.metas || []).forEach(function (m, i) { L.push((i + 1) + '. ' + m.texto + ': de ' + m.de + ' para ' + m.para + (m.unidade ? ' ' + m.unidade : '') + ' até ' + br(cal.fim)); });
    L.push('', '## Plano tático');
    (p.metas || []).forEach(function (m, i) {
      L.push('', '### Meta ' + (i + 1) + ': ' + m.texto, '| Tática | Quando | Responsável |', '|---|---|---|');
      (p.taticas || []).filter(function (t) { return t.meta === m.id; }).forEach(function (t) { L.push('| ' + t.texto + (t.fundamental ? ' ⭐' : '') + ' | ' + quandoTexto(t.quando) + ' | ' + (t.resp || '') + ' |'); });
      const f = (p.taticas || []).find(function (t) { return t.meta === m.id && t.fundamental; }); L.push('', '**Ação fundamental:** ' + (f ? f.texto : ''));
      if (m.dificuldade) L.push('**Dificuldade prevista → como vou contornar:** ' + m.dificuldade);
    });
    L.push('', '## Indicadores', '| Meta | Indicador | Tipo |', '|---|---|---|');
    (p.indicadores || []).forEach(function (x) { const m = (p.metas || []).find(function (y) { return y.id === x.meta; }); L.push('| ' + (m ? m.texto : '') + ' | ' + x.nome + ' | ' + (x.tipo === 'resultado' ? 'Resultado' : 'Antecedência') + ' |'); });
    const t = p.tempo || {}; L.push('', '## Semana modelo', '- Pontuação e planejamento semanal: ' + (t.rotina || ''), '- Bloco estratégico: ' + (t.estrategico || ''), '- Blocos de reserva: ' + (t.reserva || ''), '- Bloco de fuga: ' + (t.fuga || ''), '- Reunião semanal de responsabilidade: ' + ((p.compromisso || {}).rsr || ''));
    const c = p.compromisso || {}; L.push('', '## Compromissos', '- Custos que aceito pagar: ' + (c.custos || ''), '- O que me sabota → resposta combinada: ' + (c.sabotador || ''), '- Com quem compartilho: ' + (c.compartilhar || ''));
    return L.join('\n');
  }
  function quandoTexto(q) { q = q || {}; if (q.tipo === 'unica') return 'Semana ' + q.semana; if ((q.de || 1) === 1 && (q.ate || 12) === 12) return 'Toda semana'; return 'Semanas ' + (q.de || 1) + ' a ' + (q.ate || 12); }

  return { AREAS: AREAS, RECADOS: RECADOS, REVISAO: REVISAO, segunda: segunda, somar: somar, fase: fase, calendario: calendario, semanaAtual: semanaAtual, diasRestantes: diasRestantes,
    vence: vence, taticasDaSemana: taticasDaSemana, pontuacao: pontuacao, leitura: leitura, media: media, serie: serie, diagnostico: diagnostico,
    comecaComVerbo: comecaComVerbo, temQuantidade: temQuantidade, checarPlano: checarPlano, horasSemana: horasSemana, maiorCarga: maiorCarga, regressiva: regressiva, progressoMeta: progressoMeta, markdown: markdown, quandoTexto: quandoTexto };
});
