/* Jogos cognitivos com tema de licitações: banco de questões com repetição espaçada, n-back, jogo da memória,
   matrizes de raciocínio, cálculo de lances e tabela de atenção. Puro, testável no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Jogos = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function rng(semente) { let s = (semente >>> 0) || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function embaralhar(v, r) { r = r || Math.random; const a = v.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function hoje(d) { return (d || new Date()).toISOString().slice(0, 10); }
  function somarDias(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

  // ---------- Quiz: Lei 14.133/2021, LC 123/2006 e Lei 4.320/1964 (cada questão com o dispositivo) ----------
  // c = índice da alternativa correta
  const QUESTOES = [
    { id: 'q1', tema: 'Prazos', p: 'Qual o prazo para impugnar o edital ou pedir esclarecimento?', o: ['Até 3 dias úteis antes da abertura do certame', 'Até 5 dias úteis antes da abertura', 'Até 2 dias corridos antes da abertura', 'Até a abertura da sessão'], c: 0, ref: 'Lei 14.133/2021, art. 164' },
    { id: 'q2', tema: 'Prazos', p: 'Qual o prazo para apresentar as razões do recurso administrativo, após manifestada a intenção?', o: ['5 dias úteis', '3 dias úteis', '10 dias corridos', '2 dias úteis'], c: 1, ref: 'Lei 14.133/2021, art. 165, I' },
    { id: 'q3', tema: 'Modalidades', p: 'Qual destas NÃO é modalidade de licitação na Lei 14.133/2021?', o: ['Diálogo competitivo', 'Concurso', 'Tomada de preços', 'Leilão'], c: 2, ref: 'Lei 14.133/2021, art. 28' },
    { id: 'q4', tema: 'Modalidades', p: 'O pregão é a modalidade obrigatória para contratar…', o: ['obras de grande vulto', 'bens e serviços comuns', 'serviços técnicos especializados de natureza intelectual', 'alienação de imóveis'], c: 1, ref: 'Lei 14.133/2021, art. 6º, XLI, e art. 29' },
    { id: 'q5', tema: 'Modalidades', p: 'Qual critério de julgamento é próprio do leilão?', o: ['Menor preço', 'Maior desconto', 'Maior lance', 'Técnica e preço'], c: 2, ref: 'Lei 14.133/2021, art. 6º, XL, e art. 33, V' },
    { id: 'q6', tema: 'Modalidades', p: 'O diálogo competitivo é indicado quando a Administração…', o: ['quer o menor preço de um bem comum', 'busca soluções inovadoras que ela não sabe especificar sozinha', 'vende bens inservíveis', 'escolhe trabalho artístico'], c: 1, ref: 'Lei 14.133/2021, art. 32' },
    { id: 'q7', tema: 'Julgamento', p: 'Qual NÃO é critério de julgamento previsto no art. 33 da Lei 14.133/2021?', o: ['Maior retorno econômico', 'Técnica e preço', 'Menor prazo de entrega', 'Melhor técnica ou conteúdo artístico'], c: 2, ref: 'Lei 14.133/2021, art. 33' },
    { id: 'q8', tema: 'Disputa', p: 'Quais são os modos de disputa previstos na Lei 14.133/2021?', o: ['Aberto e fechado, isolados ou combinados', 'Só aberto', 'Aleatório e fechado', 'Presencial e eletrônico'], c: 0, ref: 'Lei 14.133/2021, art. 56' },
    { id: 'q9', tema: 'Fases', p: 'Na regra geral da Lei 14.133/2021, a habilitação ocorre…', o: ['antes da apresentação das propostas', 'depois do julgamento das propostas', 'junto com a fase preparatória', 'só se houver recurso'], c: 1, ref: 'Lei 14.133/2021, art. 17, V, e § 1º' },
    { id: 'q10', tema: 'Prazos', p: 'No pregão de bens com menor preço, qual o prazo mínimo entre a divulgação do edital e a apresentação das propostas?', o: ['3 dias úteis', '8 dias úteis', '15 dias úteis', '30 dias corridos'], c: 1, ref: 'Lei 14.133/2021, art. 55, I, a' },
    { id: 'q11', tema: 'Prazos', p: 'Para serviços comuns com menor preço ou maior desconto, o prazo mínimo para propostas é de…', o: ['8 dias úteis', '10 dias úteis', '25 dias úteis', '5 dias úteis'], c: 1, ref: 'Lei 14.133/2021, art. 55, II, a' },
    { id: 'q12', tema: 'Portais', p: 'Qual o portal oficial de divulgação centralizada dos atos das licitações?', o: ['Diário Oficial da União apenas', 'PNCP — Portal Nacional de Contratações Públicas', 'Portal da Transparência', 'SICAF'], c: 1, ref: 'Lei 14.133/2021, art. 174' },
    { id: 'q13', tema: 'Agentes', p: 'No pregão, o agente responsável pela condução do certame é chamado de…', o: ['Comissão de licitação', 'Pregoeiro', 'Gestor do contrato', 'Fiscal do contrato'], c: 1, ref: 'Lei 14.133/2021, art. 8º, § 5º' },
    { id: 'q14', tema: 'Habilitação', p: 'O edital pode exigir atestados com quantitativos mínimos de até quanto das parcelas de maior relevância?', o: ['25%', '50%', '75%', '100%'], c: 1, ref: 'Lei 14.133/2021, art. 67, § 2º' },
    { id: 'q15', tema: 'Habilitação', p: 'Para a qualificação econômico-financeira pode-se exigir balanço patrimonial de quantos exercícios?', o: ['Do último exercício', 'Dos 2 últimos exercícios', 'Dos 3 últimos exercícios', 'Dos 5 últimos exercícios'], c: 1, ref: 'Lei 14.133/2021, art. 69, I' },
    { id: 'q16', tema: 'Habilitação', p: 'Qual certidão comprova a regularidade trabalhista?', o: ['CRF', 'CNDT', 'CND estadual', 'Certidão de falência'], c: 1, ref: 'Lei 14.133/2021, art. 68, V' },
    { id: 'q17', tema: 'ME/EPP', p: 'No pregão, há empate ficto quando a proposta da ME/EPP é até quanto superior à melhor proposta?', o: ['5%', '10%', '15%', '2%'], c: 0, ref: 'LC 123/2006, art. 44, § 2º' },
    { id: 'q18', tema: 'ME/EPP', p: 'Nas demais modalidades (fora do pregão), o empate ficto da ME/EPP é de até…', o: ['5%', '10%', '20%', '25%'], c: 1, ref: 'LC 123/2006, art. 44, § 1º' },
    { id: 'q19', tema: 'ME/EPP', p: 'A licitação exclusiva para ME/EPP é obrigatória em itens de valor até…', o: ['R$ 50.000', 'R$ 80.000', 'R$ 176.000', 'R$ 300.000'], c: 1, ref: 'LC 123/2006, art. 48, I' },
    { id: 'q20', tema: 'ME/EPP', p: 'Em bens de natureza divisível, a cota reservada para ME/EPP é de até…', o: ['10%', '25%', '50%', '30%'], c: 1, ref: 'LC 123/2006, art. 48, III' },
    { id: 'q21', tema: 'ME/EPP', p: 'A ME/EPP com restrição na regularidade fiscal tem quanto tempo para regularizar após ser declarada vencedora?', o: ['2 dias úteis', '5 dias úteis, prorrogáveis por igual período', '10 dias corridos', 'Não pode regularizar'], c: 1, ref: 'LC 123/2006, art. 43, § 1º' },
    { id: 'q22', tema: 'SRP', p: 'Qual o prazo de vigência da ata de registro de preços?', o: ['6 meses', '1 ano, prorrogável por igual período', '2 anos improrrogáveis', '5 anos'], c: 1, ref: 'Lei 14.133/2021, art. 84' },
    { id: 'q23', tema: 'SRP', p: 'Cada órgão não participante (carona) pode aderir a até quanto dos quantitativos registrados na ata?', o: ['25%', '50%', '100%', '200%'], c: 1, ref: 'Lei 14.133/2021, art. 86, § 4º' },
    { id: 'q24', tema: 'SRP', p: 'O total das adesões à ata não pode exceder…', o: ['o dobro do quantitativo de cada item registrado', 'o mesmo quantitativo registrado', 'o triplo', 'não há limite'], c: 0, ref: 'Lei 14.133/2021, art. 86, § 5º' },
    { id: 'q25', tema: 'Contratos', p: 'Qual o limite de acréscimos e supressões unilaterais em contratos (regra geral)?', o: ['10%', '25%', '50%', '30%'], c: 1, ref: 'Lei 14.133/2021, art. 125' },
    { id: 'q26', tema: 'Contratos', p: 'Na reforma de edifício ou equipamento, os acréscimos podem chegar a…', o: ['25%', '50%', '75%', '100%'], c: 1, ref: 'Lei 14.133/2021, art. 125' },
    { id: 'q27', tema: 'Contratos', p: 'Contratos de serviços contínuos podem ter vigência inicial de até…', o: ['1 ano', '5 anos', '10 anos', '2 anos'], c: 1, ref: 'Lei 14.133/2021, art. 106' },
    { id: 'q28', tema: 'Contratos', p: 'Os contratos de serviços contínuos podem ser prorrogados até o limite de…', o: ['5 anos', '10 anos', '15 anos', 'sem limite'], c: 1, ref: 'Lei 14.133/2021, art. 107' },
    { id: 'q29', tema: 'Contratos', p: 'A garantia contratual, em regra, é de até…', o: ['5% do valor inicial do contrato', '10%', '20%', '1%'], c: 0, ref: 'Lei 14.133/2021, art. 98' },
    { id: 'q30', tema: 'Contratos', p: 'Atraso de pagamento superior a quanto dá ao contratado direito à extinção do contrato?', o: ['30 dias', '2 meses', '90 dias', '6 meses'], c: 1, ref: 'Lei 14.133/2021, art. 137, § 2º, IV' },
    { id: 'q31', tema: 'Contratos', p: 'Os pagamentos devem observar…', o: ['a ordem cronológica, por fonte de recurso', 'a preferência do gestor', 'o valor da nota, do maior para o menor', 'a data da licitação'], c: 0, ref: 'Lei 14.133/2021, art. 141' },
    { id: 'q32', tema: 'Contratos', p: 'Qual instrumento recompõe o preço quando há fato imprevisível que onera o contrato?', o: ['Reajuste', 'Reequilíbrio econômico-financeiro', 'Repactuação', 'Apostilamento'], c: 1, ref: 'Lei 14.133/2021, art. 124, II, d' },
    { id: 'q33', tema: 'Contratos', p: 'A repactuação se aplica a…', o: ['qualquer compra', 'serviços contínuos com dedicação exclusiva ou predominância de mão de obra', 'obras', 'locação de imóveis'], c: 1, ref: 'Lei 14.133/2021, art. 135' },
    { id: 'q34', tema: 'Contratos', p: 'O termo de contrato pode ser substituído pela nota de empenho, entre outros casos, em…', o: ['obras de grande vulto', 'compras com entrega imediata e integral, sem obrigações futuras', 'serviços contínuos', 'concessões'], c: 1, ref: 'Lei 14.133/2021, art. 95, II' },
    { id: 'q35', tema: 'Sanções', p: 'Qual NÃO é sanção prevista no art. 156 da Lei 14.133/2021?', o: ['Advertência', 'Multa', 'Suspensão do CNPJ', 'Declaração de inidoneidade'], c: 2, ref: 'Lei 14.133/2021, art. 156' },
    { id: 'q36', tema: 'Sanções', p: 'O impedimento de licitar e contratar tem prazo máximo de…', o: ['1 ano', '2 anos', '3 anos', '6 anos'], c: 2, ref: 'Lei 14.133/2021, art. 156, § 4º' },
    { id: 'q37', tema: 'Sanções', p: 'A declaração de inidoneidade dura…', o: ['de 1 a 3 anos', 'de 3 a 6 anos', 'até 2 anos', 'de 5 a 10 anos'], c: 1, ref: 'Lei 14.133/2021, art. 156, § 5º' },
    { id: 'q38', tema: 'Sanções', p: 'A multa não pode ser inferior a ___ nem superior a ___ do valor do contrato.', o: ['0,5% e 30%', '1% e 10%', '0,1% e 20%', '5% e 50%'], c: 0, ref: 'Lei 14.133/2021, art. 156, § 3º' },
    { id: 'q39', tema: 'Recursos', p: 'O recurso e o pedido de reconsideração terão…', o: ['efeito suspensivo', 'só efeito devolutivo', 'efeito suspensivo apenas se houver garantia', 'nenhum efeito'], c: 0, ref: 'Lei 14.133/2021, art. 168' },
    { id: 'q40', tema: 'Recursos', p: 'Se não reconsiderar a decisão em 3 dias úteis, o agente deve…', o: ['arquivar o recurso', 'encaminhar à autoridade superior', 'anular a licitação', 'pedir parecer do TCU'], c: 1, ref: 'Lei 14.133/2021, art. 165, § 2º' },
    { id: 'q41', tema: 'Julgamento', p: 'Em obras e serviços de engenharia, são inexequíveis propostas inferiores a quanto do valor orçado?', o: ['50%', '70%', '75%', '85%'], c: 2, ref: 'Lei 14.133/2021, art. 59, § 4º' },
    { id: 'q42', tema: 'Preferência', p: 'A margem de preferência geral para bens manufaturados e serviços nacionais é de até…', o: ['5%', '10%', '20%', '25%'], c: 1, ref: 'Lei 14.133/2021, art. 26, § 1º' },
    { id: 'q43', tema: 'Planejamento', p: 'Qual documento da fase preparatória caracteriza o interesse público e a melhor solução?', o: ['Termo de referência', 'Estudo técnico preliminar (ETP)', 'Ata de registro de preços', 'Nota de empenho'], c: 1, ref: 'Lei 14.133/2021, art. 6º, XX, e art. 18' },
    { id: 'q44', tema: 'Contratação direta', p: 'A contratação quando a competição é inviável chama-se…', o: ['Dispensa', 'Inexigibilidade', 'Adesão', 'Credenciamento de preço'], c: 1, ref: 'Lei 14.133/2021, art. 74' },
    { id: 'q45', tema: 'Contratação direta', p: 'Na redação original da lei, a dispensa por valor para compras e serviços comuns era de até…', o: ['R$ 17.600', 'R$ 50.000', 'R$ 100.000', 'R$ 176.000'], c: 1, ref: 'Lei 14.133/2021, art. 75, II (valores atualizados anualmente por decreto)' },
    { id: 'q46', tema: 'Contratação direta', p: 'Na dispensa eletrônica, o aviso deve ficar divulgado por no mínimo…', o: ['1 dia útil', '3 dias úteis', '8 dias úteis', '24 horas'], c: 1, ref: 'Lei 14.133/2021, art. 75, § 3º' },
    { id: 'q47', tema: 'Execução', p: 'Quais são as três fases da despesa pública?', o: ['Empenho, liquidação e pagamento', 'Licitação, contrato e pagamento', 'Orçamento, empenho e nota fiscal', 'Homologação, empenho e pagamento'], c: 0, ref: 'Lei 4.320/1964, arts. 58 a 65' },
    { id: 'q48', tema: 'Execução', p: 'A liquidação da despesa consiste em…', o: ['emitir a nota de empenho', 'verificar o direito do credor com base nos documentos que comprovam a entrega', 'transferir o dinheiro', 'publicar o contrato'], c: 1, ref: 'Lei 4.320/1964, art. 63' },
    { id: 'q49', tema: 'Vigência', p: 'A Lei 8.666/1993 deixou de valer para novas contratações a partir de…', o: ['1º/4/2021', '1º/4/2023', '30/12/2023', '1º/1/2025'], c: 2, ref: 'Lei 14.133/2021, art. 193, II, com redação da LC 198/2023' },
    { id: 'q50', tema: 'Sanções', p: 'Antes de contratar, a Administração deve consultar quais cadastros de sanções?', o: ['CEIS e CNEP', 'SPC e Serasa', 'CADIN apenas', 'Nenhum'], c: 0, ref: 'Lei 14.133/2021, art. 91, § 4º' }
  ];

  // Repetição espaçada (caixas de Leitner): acertou sobe de caixa, errou volta à 1.
  const INTERVALOS = [0, 1, 2, 4, 8, 16];
  function revisar(estado, id, acertou, dia) {
    const s = Object.assign({ caixa: 0, prox: dia, acertos: 0, erros: 0 }, estado[id] || {});
    if (acertou) { s.caixa = Math.min(5, s.caixa + 1); s.acertos++; } else { s.caixa = 1; s.erros++; }
    s.prox = somarDias(dia, INTERVALOS[s.caixa]); s.visto = dia;
    estado[id] = s; return s;
  }
  // Rodada: primeiro as vencidas (revisão), depois as novas, até n.
  function rodada(estado, dia, n, r) {
    const venc = QUESTOES.filter(function (q) { const s = estado[q.id]; return s && s.prox <= dia; }).sort(function (a, b) { return estado[a.id].caixa - estado[b.id].caixa; });
    const novas = embaralhar(QUESTOES.filter(function (q) { return !estado[q.id]; }), r);
    const outras = embaralhar(QUESTOES.filter(function (q) { const s = estado[q.id]; return s && s.prox > dia; }), r);
    return venc.concat(novas, outras).slice(0, n || 10);
  }
  // Alternativas embaralhadas mantendo a resposta.
  function alternativas(q, r) { const idx = embaralhar(q.o.map(function (_, i) { return i; }), r); return { o: idx.map(function (i) { return q.o[i]; }), c: idx.indexOf(q.c) }; }
  function dominio(estado) { const n = QUESTOES.length; const dom = QUESTOES.filter(function (q) { return (estado[q.id] || {}).caixa >= 4; }).length; return { dominadas: dom, total: n, pct: Math.round(dom / n * 100) }; }

  // ---------- N-back duplo (posição + letra) ----------
  const LETRAS = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T'];
  // Gera 20+n estímulos com ~6 alvos de posição e ~6 de letra (como no protocolo de Jaeggi et al., 2008).
  function sequenciaNBack(n, r, total) {
    r = r || Math.random; total = total || 20 + n; const pos = [], let_ = [];
    const alvosP = new Set(embaralhar(Array.from({ length: total - n }, function (_, i) { return i + n; }), r).slice(0, 6));
    const alvosL = new Set(embaralhar(Array.from({ length: total - n }, function (_, i) { return i + n; }), r).slice(0, 6));
    for (let i = 0; i < total; i++) {
      if (alvosP.has(i)) pos.push(pos[i - n]); else { let p; do { p = Math.floor(r() * 8); } while (i >= n && p === pos[i - n]); pos.push(p); }
      if (alvosL.has(i)) let_.push(let_[i - n]); else { let l; do { l = LETRAS[Math.floor(r() * LETRAS.length)]; } while (i >= n && l === let_[i - n]); let_.push(l); }
    }
    return { n: n, pos: pos, letras: let_ };
  }
  // respostas: [{pos: bool, letra: bool}] por estímulo
  function pontuarNBack(seq, respostas) {
    const n = seq.n; const c = { pos: { acertos: 0, erros: 0, alvos: 0 }, letra: { acertos: 0, erros: 0, alvos: 0 } };
    for (let i = n; i < seq.pos.length; i++) {
      const r = respostas[i] || {};
      [['pos', seq.pos[i] === seq.pos[i - n]], ['letra', seq.letras[i] === seq.letras[i - n]]].forEach(function (x) {
        const k = x[0], alvo = x[1], marcou = !!r[k];
        if (alvo) c[k].alvos++;
        if (alvo && marcou) c[k].acertos++; else if (alvo !== marcou) c[k].erros++;
      });
    }
    const tot = (seq.pos.length - n) * 2; const erros = c.pos.erros + c.letra.erros;
    return { detalhe: c, erros: erros, pct: Math.round((tot - erros) / tot * 100) };
  }
  // Regra adaptativa: 90%+ sobe, abaixo de 75% desce (mínimo 1).
  function proximoN(n, pct) { return pct >= 90 ? n + 1 : pct < 75 ? Math.max(1, n - 1) : n; }

  // ---------- Jogo da memória ----------
  const PARES = [
    ['ETP', 'Estudo Técnico Preliminar'], ['TR', 'Termo de Referência'], ['SRP', 'Sistema de Registro de Preços'], ['ARP', 'Ata de Registro de Preços'],
    ['PNCP', 'Portal Nacional de Contratações Públicas'], ['SICAF', 'Cadastro Unificado de Fornecedores'], ['CNDT', 'Certidão de Débitos Trabalhistas'], ['CRF', 'Regularidade do FGTS'],
    ['ME/EPP', 'Microempresa e Empresa de Pequeno Porte'], ['UASG', 'Unidade de compras do governo federal'], ['BDI', 'Benefícios e Despesas Indiretas'], ['NE', 'Nota de Empenho'],
    ['CEIS', 'Cadastro de Empresas Inidôneas e Suspensas'], ['CATMAT', 'Catálogo de Materiais'], ['IRP', 'Intenção de Registro de Preços'], ['PCA', 'Plano de Contratações Anual']
  ];
  function baralho(pares, r) {
    const sel = embaralhar(PARES, r).slice(0, pares || 8);
    return embaralhar(sel.reduce(function (a, p, i) { a.push({ par: i, t: p[0], sigla: true }, { par: i, t: p[1] }); return a; }, []), r).map(function (c, i) { return Object.assign({ id: i }, c); });
  }
  function pontosMemoria(pares, jogadas, segundos) { return Math.max(0, Math.round(pares * 100 - Math.max(0, jogadas - pares) * 15 - segundos)); }

  // ---------- Matrizes (raciocínio indutivo, estilo Raven) ----------
  const FORMAS = ['circulo', 'quadrado', 'triangulo', 'losango'];
  const CORES = ['#1f5fbf', '#b68d40', '#1f7a4a', '#800000'];
  // Cada célula: {forma, cor, n (1-3), rot (0/45/90…)}. Regras por linha: progressão de quantidade, rotação e distribuição de 3 valores.
  function matriz(nivel, r) {
    r = r || Math.random; nivel = Math.max(1, Math.min(4, nivel || 1));
    const formas = embaralhar(FORMAS, r).slice(0, 3), cores = embaralhar(CORES, r).slice(0, 3);
    const regras = embaralhar(['n', 'forma', 'cor', 'rot'], r).slice(0, Math.min(4, nivel + 1));
    const passoRot = [45, 90][Math.floor(r() * 2)];
    const desloc = Math.floor(r() * 3);
    const cel = function (l, c) {
      return {
        forma: regras.indexOf('forma') >= 0 ? formas[(l + c) % 3] : formas[l],
        cor: regras.indexOf('cor') >= 0 ? cores[(c + 2 * l + desloc) % 3] : cores[0],
        n: regras.indexOf('n') >= 0 ? c + 1 : 1 + (l % 3 === 2 ? 1 : 0),
        rot: regras.indexOf('rot') >= 0 ? ((l + c) * passoRot) % 180 : 0
      };
    };
    const grade = []; for (let l = 0; l < 3; l++) for (let c = 0; c < 3; c++) grade.push(cel(l, c));
    const certa = grade[8];
    const chave = function (x) { return x.forma + x.cor + x.n + x.rot; };
    const ops = [certa]; const vistos = {}; vistos[chave(certa)] = 1; let tent = 0;
    while (ops.length < 6 && tent++ < 200) {
      const d = Object.assign({}, certa); const k = embaralhar(['forma', 'cor', 'n', 'rot'], r)[0];
      if (k === 'forma') d.forma = FORMAS[Math.floor(r() * 4)];
      if (k === 'cor') d.cor = CORES[Math.floor(r() * 4)];
      if (k === 'n') d.n = 1 + Math.floor(r() * 3);
      if (k === 'rot') d.rot = [0, 45, 90, 135][Math.floor(r() * 4)];
      if (!vistos[chave(d)]) { vistos[chave(d)] = 1; ops.push(d); }
    }
    const emb = embaralhar(ops, r);
    return { grade: grade.slice(0, 8), opcoes: emb, certa: emb.indexOf(certa), regras: regras };
  }

  // ---------- Cálculo de lances (cálculo mental aplicado) ----------
  function arred2(v) { return Math.round(v * 100) / 100; }
  function questaoLance(nivel, r) {
    r = r || Math.random; const tipo = Math.floor(r() * (nivel >= 2 ? 5 : 3));
    const valor = Math.round((500 + r() * 49500) / 10) * 10;
    const pct = [1, 2, 3, 5, 10, 15, 20, 25][Math.floor(r() * 8)];
    let p, resp, tol = 0.01, unid = 'R$';
    if (tipo === 0) { p = 'Lance atual R$ ' + fmt(valor) + '. Qual o valor com redução de ' + pct + '%?'; resp = arred2(valor * (1 - pct / 100)); }
    else if (tipo === 1) { const q = 2 + Math.floor(r() * 48); const u = Math.round(r() * 9000) / 100 + 1; p = q + ' unidades a R$ ' + fmt(u) + ' cada. Qual o total do item?'; resp = arred2(q * u); }
    else if (tipo === 2) { const ref = valor; const lance = arred2(ref * (1 - (5 + Math.floor(r() * 30)) / 100)); p = 'Referência R$ ' + fmt(ref) + ', lance vencedor R$ ' + fmt(lance) + '. Qual o deságio (%)?'; resp = arred2((1 - lance / ref) * 100); tol = 0.1; unid = '%'; }
    else if (tipo === 3) { const custo = valor; const m = [10, 15, 20, 25, 30][Math.floor(r() * 5)]; p = 'Custo R$ ' + fmt(custo) + '. Qual o preço mínimo para margem de ' + m + '% sobre o custo?'; resp = arred2(custo * (1 + m / 100)); }
    else { const melhor = valor; const me = arred2(melhor * (1 + (1 + Math.floor(r() * 9)) / 100)); p = 'Pregão: melhor lance R$ ' + fmt(melhor) + '. A ME/EPP ofertou R$ ' + fmt(me) + '. Está no empate ficto (até 5%)? Responda 1 para sim, 0 para não.'; resp = me <= melhor * 1.05 + 1e-9 ? 1 : 0; tol = 0; unid = ''; }
    return { p: p, resp: resp, tol: tol, unid: unid };
  }
  function fmt(v) { return Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function lerNumero(t) { const s = String(t || '').replace(/[^\d,.-]/g, ''); if (!s) return NaN; return Number(/,\d{1,2}$/.test(s) || s.indexOf(',') >= 0 ? s.replace(/\./g, '').replace(',', '.') : s); }
  function confere(q, txt) { const v = lerNumero(txt); return !isNaN(v) && Math.abs(v - q.resp) <= q.tol + 1e-9; }

  // ---------- Tabela de atenção (Schulte): itens 1..n² em ordem ----------
  function tabela(lado, r) { return embaralhar(Array.from({ length: lado * lado }, function (_, i) { return i + 1; }), r); }

  // ---------- histórico e sequência ----------
  function registrar(hist, jogo, pontos, extra, dia) {
    hist.push(Object.assign({ jogo: jogo, pontos: pontos, dia: dia || hoje(), em: Date.now() }, extra || {}));
    return hist;
  }
  function sequencia(hist, dia) {
    const dias = {}; (hist || []).forEach(function (h) { dias[h.dia] = 1; });
    let d = dia || hoje(); if (!dias[d]) d = somarDias(d, -1);
    let n = 0; while (dias[d]) { n++; d = somarDias(d, -1); }
    return n;
  }
  function recorde(hist, jogo) { return (hist || []).filter(function (h) { return h.jogo === jogo; }).reduce(function (m, h) { return Math.max(m, h.pontos); }, 0); }

  // Treino do dia: um jogo de cada habilidade, rodando pela data.
  const HABILIDADES = [
    { id: 'conhecimento', jogos: ['quiz'] }, { id: 'memoria', jogos: ['nback', 'memoria'] }, { id: 'raciocinio', jogos: ['matrizes', 'xadrez'] }, { id: 'calculo', jogos: ['lances'] }, { id: 'atencao', jogos: ['schulte'] }
  ];
  function treinoDoDia(dia) { const n = Number(String(dia || hoje()).replace(/-/g, '')); return HABILIDADES.map(function (h, i) { return h.jogos[(n + i) % h.jogos.length]; }).slice(0, 4); }

  return { rng: rng, embaralhar: embaralhar, somarDias: somarDias, QUESTOES: QUESTOES, INTERVALOS: INTERVALOS, revisar: revisar, rodada: rodada, alternativas: alternativas, dominio: dominio,
    LETRAS: LETRAS, sequenciaNBack: sequenciaNBack, pontuarNBack: pontuarNBack, proximoN: proximoN, PARES: PARES, baralho: baralho, pontosMemoria: pontosMemoria,
    matriz: matriz, questaoLance: questaoLance, lerNumero: lerNumero, confere: confere, fmt: fmt, tabela: tabela, registrar: registrar, sequencia: sequencia, recorde: recorde, treinoDoDia: treinoDoDia };
});
