/* Autoconhecimento: Big Five (IPIP-50, domínio público, Goldberg), estilo DISC (itens próprios, uso reflexivo),
   temperamento derivado de Extroversão × Estabilidade (leitura de Eysenck) e prática de raciocínio (sem estimar QI). Puro. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Perfil = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Big Five: IPIP 50 marcadores (tradução livre); fator e sentido (+1 direto, -1 invertido) ----------
  const FATORES = {
    E: { t: 'Extroversão', alto: 'Energia vinda de pessoas, fala com facilidade, gosta de estar em evidência.', baixo: 'Mais reservado, prefere grupos pequenos e recarrega sozinho.' },
    A: { t: 'Amabilidade', alto: 'Cooperativo, empático e atento às necessidades dos outros.', baixo: 'Mais cético e direto; prioriza o objetivo sobre a harmonia.' },
    C: { t: 'Conscienciosidade', alto: 'Organizado, cumpre prazos, atento a detalhes e a regras.', baixo: 'Mais flexível e espontâneo; pode se perder em rotina e prazos.' },
    N: { t: 'Estabilidade emocional', alto: 'Calmo sob pressão, recupera-se rápido de contratempos.', baixo: 'Sente mais o estresse e as variações de humor; se beneficia de rotinas de recuperação.' },
    O: { t: 'Abertura a experiências', alto: 'Curioso, imaginativo, gosta de ideias abstratas e de novidades.', baixo: 'Prefere o concreto, o conhecido e o prático.' }
  };
  // N aqui é pontuado como Estabilidade (itens de neuroticismo entram invertidos).
  const IPIP = [
    ['Sou a alegria da festa.', 'E', 1], ['Pouco me preocupo com os outros.', 'A', -1], ['Estou sempre preparado.', 'C', 1], ['Fico estressado com facilidade.', 'N', -1], ['Tenho um vocabulário rico.', 'O', 1],
    ['Não falo muito.', 'E', -1], ['Tenho interesse pelas pessoas.', 'A', 1], ['Deixo minhas coisas espalhadas.', 'C', -1], ['Fico relaxado a maior parte do tempo.', 'N', 1], ['Tenho dificuldade para entender ideias abstratas.', 'O', -1],
    ['Sinto-me à vontade perto das pessoas.', 'E', 1], ['Ofendo as pessoas.', 'A', -1], ['Presto atenção aos detalhes.', 'C', 1], ['Preocupo-me com as coisas.', 'N', -1], ['Tenho uma imaginação viva.', 'O', 1],
    ['Fico em segundo plano.', 'E', -1], ['Compadeço-me dos sentimentos dos outros.', 'A', 1], ['Faço bagunça nas coisas.', 'C', -1], ['Raramente me sinto triste.', 'N', 1], ['Não me interesso por ideias abstratas.', 'O', -1],
    ['Começo conversas.', 'E', 1], ['Não me interesso pelos problemas dos outros.', 'A', -1], ['Faço as tarefas logo.', 'C', 1], ['Perturbo-me com facilidade.', 'N', -1], ['Tenho ideias excelentes.', 'O', 1],
    ['Tenho pouco a dizer.', 'E', -1], ['Tenho um coração mole.', 'A', 1], ['Muitas vezes esqueço de guardar as coisas no lugar.', 'C', -1], ['Fico chateado com facilidade.', 'N', -1], ['Não tenho uma boa imaginação.', 'O', -1],
    ['Converso com muitas pessoas diferentes nas festas.', 'E', 1], ['Não me interesso de verdade pelos outros.', 'A', -1], ['Gosto de ordem.', 'C', 1], ['Mudo muito de humor.', 'N', -1], ['Entendo as coisas rapidamente.', 'O', 1],
    ['Não gosto de chamar atenção para mim.', 'E', -1], ['Reservo tempo para os outros.', 'A', 1], ['Fujo das minhas obrigações.', 'C', -1], ['Tenho mudanças de humor frequentes.', 'N', -1], ['Uso palavras difíceis.', 'O', 1],
    ['Não me importo de ser o centro das atenções.', 'E', 1], ['Sinto as emoções dos outros.', 'A', 1], ['Sigo uma agenda.', 'C', 1], ['Irrito-me com facilidade.', 'N', -1], ['Passo tempo refletindo sobre as coisas.', 'O', 1],
    ['Fico quieto perto de estranhos.', 'E', -1], ['Deixo as pessoas à vontade.', 'A', 1], ['Sou exigente no meu trabalho.', 'C', 1], ['Muitas vezes me sinto triste.', 'N', -1], ['Estou cheio de ideias.', 'O', 1]
  ];
  // respostas: índice → 1..5 (discordo totalmente .. concordo totalmente)
  function bigFive(respostas) {
    const s = { E: 0, A: 0, C: 0, N: 0, O: 0 }, n = { E: 0, A: 0, C: 0, N: 0, O: 0 };
    IPIP.forEach(function (it, i) { const r = Number(respostas[i]); if (!(r >= 1 && r <= 5)) return; s[it[1]] += it[2] > 0 ? r : 6 - r; n[it[1]]++; });
    const out = {}; Object.keys(s).forEach(function (k) { out[k] = n[k] ? Math.round((s[k] / n[k] - 1) / 4 * 100) : null; });
    return out; // 0..100 dentro da escala (não é percentil populacional)
  }
  function faixa(v) { return v == null ? '' : v >= 67 ? 'alto' : v <= 33 ? 'baixo' : 'moderado'; }
  function completo(respostas, total) { let c = 0; for (let i = 0; i < total; i++) if (respostas[i] != null) c++; return c; }

  // Temperamento clássico pela leitura de Eysenck: Extroversão × Estabilidade emocional.
  const TEMPERAMENTOS = {
    sanguineo: { t: 'Sanguíneo', d: 'Sociável e estável: comunicativo, otimista, adapta-se rápido.', forca: 'Relacionamento com clientes, abertura de portas, apresentações.', cuidado: 'Prometer além do que a equipe entrega; deixar o detalhe para depois.' },
    colerico: { t: 'Colérico', d: 'Sociável e intenso: enérgico, rápido, competitivo, reage forte à pressão.', forca: 'Sessões de lance, negociação, decisões rápidas.', cuidado: 'Impaciência e atritos sob estresse.' },
    melancolico: { t: 'Melancólico', d: 'Reservado e intenso: profundo, criterioso, sensível a erros.', forca: 'Análise de edital, habilitação, conferência de documentos.', cuidado: 'Perfeccionismo e preocupação excessiva com prazos.' },
    fleumatico: { t: 'Fleumático', d: 'Reservado e estável: calmo, constante, confiável.', forca: 'Rotina de monitoramento, controle de certidões, pós-venda.', cuidado: 'Resistência a mudanças e dificuldade de se impor.' }
  };
  function temperamento(b5) {
    if (b5.E == null || b5.N == null) return null;
    const ext = b5.E >= 50, est = b5.N >= 50;
    const k = ext ? (est ? 'sanguineo' : 'colerico') : (est ? 'fleumatico' : 'melancolico');
    return Object.assign({ id: k, intensidade: Math.round(Math.hypot(b5.E - 50, b5.N - 50) / 70.7 * 100) }, TEMPERAMENTOS[k]);
  }

  // ---------- DISC (itens próprios, escolha forçada: mais e menos parecido com você) ----------
  const DISC = {
    D: { t: 'Dominância', d: 'Foco em resultado, desafio e decisão rápida.', comunicar: 'Seja direto, traga opções e o impacto no resultado.', licitacao: 'Conduz disputas e negociações; precisa de alguém no detalhe da habilitação.' },
    I: { t: 'Influência', d: 'Foco em pessoas, entusiasmo e persuasão.', comunicar: 'Seja caloroso, conte histórias e dê reconhecimento.', licitacao: 'Abre portas comerciais e mantém relacionamento com clientes e órgãos.' },
    S: { t: 'Estabilidade', d: 'Foco em cooperação, constância e segurança.', comunicar: 'Dê contexto, tempo para se adaptar e segurança no processo.', licitacao: 'Sustenta rotinas: monitoramento, certidões, entregas e pós-venda.' },
    C: { t: 'Conformidade', d: 'Foco em qualidade, precisão e regras.', comunicar: 'Traga dados, fontes e lógica; evite pressa sem motivo.', licitacao: 'Análise de edital, precificação e conferência de documentos.' }
  };
  const DISC_ITENS = [
    ['Decidido', 'Entusiasmado', 'Paciente', 'Cuidadoso'], ['Direto', 'Comunicativo', 'Calmo', 'Preciso'], ['Competitivo', 'Otimista', 'Leal', 'Organizado'],
    ['Ousado', 'Persuasivo', 'Prestativo', 'Analítico'], ['Firme', 'Sociável', 'Constante', 'Detalhista'], ['Exigente', 'Expressivo', 'Tranquilo', 'Criterioso'],
    ['Determinado', 'Animado', 'Cooperativo', 'Metódico'], ['Assertivo', 'Inspirador', 'Compreensivo', 'Disciplinado'], ['Independente', 'Espontâneo', 'Previsível', 'Cauteloso'],
    ['Enérgico', 'Carismático', 'Gentil', 'Lógico'], ['Decide rápido', 'Bom de conversa', 'Bom ouvinte', 'Segue as regras'], ['Desafiador', 'Divertido', 'Conciliador', 'Perfeccionista'],
    ['Prático', 'Popular', 'Estável', 'Reservado'], ['Corajoso', 'Envolvente', 'Sereno', 'Sistemático'], ['Quer resultado', 'Quer reconhecimento', 'Quer harmonia', 'Quer qualidade'],
    ['Impaciente', 'Impulsivo', 'Acomodado', 'Crítico'], ['Mandão', 'Desorganizado', 'Indeciso', 'Pessimista'], ['Ambicioso', 'Influente', 'Confiável', 'Exato'],
    ['Líder', 'Motivador', 'Apoiador', 'Especialista'], ['Arrojado', 'Alegre', 'Moderado', 'Rigoroso'], ['Objetivo', 'Expansivo', 'Acolhedor', 'Minucioso'],
    ['Autossuficiente', 'Extrovertido', 'Persistente', 'Ponderado'], ['Combativo', 'Falante', 'Calmo sob pressão', 'Questionador'], ['Vencedor', 'Animador', 'Pacificador', 'Planejador']
  ];
  const ORDEM = ['D', 'I', 'S', 'C'];
  // respostas[i] = { mais: 0..3, menos: 0..3 } (índices na ordem D, I, S, C do grupo)
  function disc(respostas) {
    const s = { D: 0, I: 0, S: 0, C: 0 }; let n = 0;
    DISC_ITENS.forEach(function (_, i) { const r = respostas[i]; if (!r || r.mais == null || r.menos == null || r.mais === r.menos) return; s[ORDEM[r.mais]]++; s[ORDEM[r.menos]]--; n++; });
    const pct = {}; ORDEM.forEach(function (k) { pct[k] = n ? Math.round((s[k] + n) / (2 * n) * 100) : null; });
    const ord = ORDEM.slice().sort(function (a, b) { return s[b] - s[a]; });
    return { bruto: s, pct: pct, primario: n ? ord[0] : null, secundario: n && s[ord[1]] > 0 ? ord[1] : null, respondidos: n };
  }

  // ---------- Prática de raciocínio (não é teste de QI) ----------
  function rng(semente) { let s = (semente >>> 0) || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function embaralhar(v, r) { const a = v.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function serieNumerica(r) {
    const tipo = Math.floor(r() * 5); let seq;
    const a = 2 + Math.floor(r() * 9), d = 2 + Math.floor(r() * 8);
    if (tipo === 0) seq = [0, 1, 2, 3, 4, 5].map(function (i) { return a + i * d; });
    else if (tipo === 1) { const q = 2 + Math.floor(r() * 2); seq = [0, 1, 2, 3, 4, 5].map(function (i) { return a * Math.pow(q, i); }); }
    else if (tipo === 2) { const d2 = 1 + Math.floor(r() * 5); seq = [a]; for (let i = 1; i < 6; i++) seq.push(seq[i - 1] + (i % 2 ? d : -d2)); }
    else if (tipo === 3) { seq = [a, a + 1 + Math.floor(r() * 3)]; for (let i = 2; i < 6; i++) seq.push(seq[i - 1] + seq[i - 2]); }
    else { const b = 1 + Math.floor(r() * 4); seq = [0, 1, 2, 3, 4, 5].map(function (i) { return (b + i) * (b + i); }); }
    const certo = seq[5]; const ops = new Set([certo]); const dist = [certo + 1, certo - 1, certo + d, certo - d, seq[4] + (seq[4] - seq[3]) + 2, certo * 2, certo + 3];
    for (const x of dist) { if (ops.size >= 5) break; if (x > 0 && x !== certo) ops.add(x); }
    const o = embaralhar(Array.from(ops), r);
    return { tipo: 'serie', p: 'Qual número continua a sequência? ' + seq.slice(0, 5).join(', ') + ', …', o: o.map(String), c: o.indexOf(certo) };
  }
  const ANALOGIAS = [
    ['Edital', 'Licitação', 'Receita', 'Bolo', ['Cozinha', 'Farinha', 'Forno', 'Chef']],
    ['Pregoeiro', 'Pregão', 'Juiz', 'Julgamento', ['Lei', 'Réu', 'Tribunal', 'Sentença']],
    ['Empenho', 'Pagamento', 'Semente', 'Colheita', ['Terra', 'Chuva', 'Árvore', 'Fruto']],
    ['Atestado', 'Experiência', 'Diploma', 'Formação', ['Escola', 'Professor', 'Prova', 'Nota']],
    ['Lance', 'Preço', 'Voto', 'Escolha', ['Urna', 'Eleitor', 'Candidato', 'Partido']],
    ['Certidão', 'Regularidade', 'Termômetro', 'Temperatura', ['Febre', 'Médico', 'Mercúrio', 'Calor']],
    ['Ata', 'Registro de preços', 'Mapa', 'Território', ['Bússola', 'Viagem', 'Estrada', 'País']],
    ['Impugnação', 'Edital', 'Recurso', 'Decisão', ['Advogado', 'Prazo', 'Pedido', 'Processo']],
    ['Prazo', 'Calendário', 'Peso', 'Balança', ['Quilo', 'Massa', 'Régua', 'Medida']],
    ['Habilitação', 'Documentos', 'Construção', 'Tijolos', ['Pedreiro', 'Casa', 'Cimento', 'Planta']]
  ];
  function analogia(r) {
    const x = ANALOGIAS[Math.floor(r() * ANALOGIAS.length)]; const ops = embaralhar([x[3]].concat(x[4].slice(0, 3)), r);
    return { tipo: 'analogia', p: x[0] + ' está para ' + x[1] + ' assim como ' + x[2] + ' está para…', o: ops, c: ops.indexOf(x[3]) };
  }
  function prova(semente, n) { const r = rng(semente || Date.now()); const out = []; for (let i = 0; i < (n || 12); i++) out.push(i % 3 === 2 ? analogia(r) : serieNumerica(r)); return out; }
  function corrigir(itens, respostas) { const ac = itens.filter(function (it, i) { return respostas[i] === it.c; }).length; return { acertos: ac, total: itens.length, pct: Math.round(ac / itens.length * 100) }; }

  // Comparação de equipe: médias e complementaridade de estilos.
  function equipe(perfis) {
    const b = perfis.filter(function (p) { return p.big5; }); const d = perfis.filter(function (p) { return p.disc && p.disc.primario; });
    const media = {}; Object.keys(FATORES).forEach(function (k) { const vs = b.map(function (p) { return p.big5[k]; }).filter(function (v) { return v != null; }); media[k] = vs.length ? Math.round(vs.reduce(function (a, x) { return a + x; }, 0) / vs.length) : null; });
    const estilos = { D: 0, I: 0, S: 0, C: 0 }; d.forEach(function (p) { estilos[p.disc.primario]++; });
    const faltam = ORDEM.filter(function (k) { return d.length >= 2 && !estilos[k]; });
    return { media: media, estilos: estilos, faltam: faltam };
  }

  return { FATORES: FATORES, IPIP: IPIP, bigFive: bigFive, faixa: faixa, completo: completo, TEMPERAMENTOS: TEMPERAMENTOS, temperamento: temperamento,
    DISC: DISC, DISC_ITENS: DISC_ITENS, ORDEM: ORDEM, disc: disc, rng: rng, serieNumerica: serieNumerica, analogia: analogia, prova: prova, corrigir: corrigir, equipe: equipe };
});
