/* Seven Jogos: treino cognitivo com tema de licitações (quiz da Lei 14.133, n-back, memória, xadrez, matrizes, cálculo de lances e atenção). */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, aviso } = UI;
  const J = self.Jogos, X = self.Xadrez;
  let timers = [];
  function limparTimers() { timers.forEach(function (t) { clearTimeout(t); clearInterval(t); }); timers = []; }
  function depois(ms, f) { const t = setTimeout(f, ms); timers.push(t); return t; }
  function cada(ms, f) { const t = setInterval(f, ms); timers.push(t); return t; }
  window.addEventListener('hashchange', function () { if (!/^#\/jogos\//.test(location.hash)) limparTimers(); });

  function e() { const d = Dados.e; d.jogos = d.jogos || {}; const j = d.jogos; j.hist = j.hist || []; j.quiz = j.quiz || {}; j.nbackN = j.nbackN || 2; j.matrizNivel = j.matrizNivel || 1; j.xadrez = j.xadrez || null; j.voz = j.voz !== false; return j; }
  function hoje() { return new Date().toISOString().slice(0, 10); }
  function salvarResultado(jogo, pontos, extra) { J.registrar(e().hist, jogo, pontos, extra); Dados.salvar(); }

  const JOGOS = {
    quiz: { t: 'Quiz da Lei 14.133', ic: '§', hab: 'Conhecimento', d: 'Perguntas com repetição espaçada: o que você erra volta antes; o que acerta volta cada vez mais tarde.', ciencia: 'Prática de recuperação e espaçamento' },
    nback: { t: 'N-back do Pregoeiro', ic: '◫', hab: 'Memória de trabalho', d: 'Lembre posição e letra de N rodadas atrás. A dificuldade se ajusta sozinha.', ciencia: 'Treino de memória de trabalho' },
    memoria: { t: 'Memória das Siglas', ic: '🂠', hab: 'Memória', d: 'Encontre os pares: sigla e significado (ETP, SRP, PNCP, SICAF…).', ciencia: 'Memória visual e vocabulário técnico' },
    xadrez: { t: 'Xadrez do Pregão', ic: '♞', hab: 'Raciocínio e planejamento', d: 'Xadrez completo contra o computador, com peças batizadas de agentes da licitação.', ciencia: 'Planejamento e cálculo de variantes' },
    matrizes: { t: 'Matrizes do Edital', ic: '▦', hab: 'Raciocínio lógico', d: 'Descubra a regra de cada linha e complete a matriz, como nos testes de raciocínio.', ciencia: 'Raciocínio indutivo' },
    lances: { t: 'Sprint de Lances', ic: '%', hab: 'Cálculo mental', d: '60 segundos de reduções, deságio, margem e empate ficto da ME/EPP.', ciencia: 'Cálculo aplicado à disputa' },
    schulte: { t: 'Itens do Lote', ic: '⌗', hab: 'Atenção', d: 'Ache os itens de 1 a 25 em ordem, o mais rápido possível.', ciencia: 'Atenção e varredura visual' }
  };
  const PECAS = { k: ['♔', '♚', 'Autoridade competente (Rei)'], q: ['♕', '♛', 'Pregoeiro (Dama)'], r: ['♖', '♜', 'Órgão (Torre)'], b: ['♗', '♝', 'Assessoria jurídica (Bispo)'], n: ['♘', '♞', 'Licitante (Cavalo)'], p: ['♙', '♟', 'Item (Peão)'] };

  function cab(jogo, extra) { const g = JOGOS[jogo]; return '<header class="jg-cab"><a class="btn mini fantasma" href="#/jogos">← Seven Jogos</a><div><h2>' + esc(g.ic + ' ' + g.t) + '</h2><small>' + esc(g.hab) + ' · recorde: ' + J.recorde(e().hist, jogo) + '</small></div>' + (extra || '') + '</header>'; }

  // ---------- painel ----------
  function telaInicio(el) {
    const j = e(); const seq = J.sequencia(j.hist); const td = J.treinoDoDia(hoje());
    const feitosHoje = {}; j.hist.forEach(function (h) { if (h.dia === hoje()) feitosHoje[h.jogo] = 1; });
    const dom = J.dominio(j.quiz);
    const ult7 = []; for (let i = 6; i >= 0; i--) { const d = J.somarDias(hoje(), -i); ult7.push({ d: d, n: j.hist.filter(function (h) { return h.dia === d; }).length }); }
    el.innerHTML = '<div class="jg"><section class="jg-topo"><div><h2>Treino do dia</h2><p class="mudo">15 minutos por dia, todos os dias, valem mais que uma maratona no fim de semana.</p></div><div class="jg-seq" title="Dias seguidos treinando"><b>🔥 ' + seq + '</b><small>dia' + (seq === 1 ? '' : 's') + ' seguidos</small></div></section>' +
      '<div class="jg-dia">' + td.map(function (k) { const g = JOGOS[k]; return '<a class="jg-dia-c' + (feitosHoje[k] ? ' feito' : '') + '" href="#/jogos/' + k + '"><span class="jg-ic">' + esc(g.ic) + '</span><b>' + esc(g.t) + '</b><small>' + esc(g.hab) + '</small>' + (feitosHoje[k] ? '<i>✓ feito hoje</i>' : '<i>Jogar</i>') + '</a>'; }).join('') + '</div>' +
      '<div class="jg-semana" aria-label="Partidas nos últimos 7 dias">' + ult7.map(function (x) { return '<div><i style="height:' + Math.min(100, x.n * 20) + '%"></i><small>' + new Date(x.d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') + '</small></div>'; }).join('') + '</div>' +
      '<h3>Todos os jogos</h3><div class="jg-grade">' + Object.keys(JOGOS).map(function (k) { const g = JOGOS[k]; return '<a class="jg-card" href="#/jogos/' + k + '"><span class="jg-ic">' + esc(g.ic) + '</span><div><b>' + esc(g.t) + '</b><small class="jg-hab">' + esc(g.hab) + '</small><p>' + esc(g.d) + '</p><small class="mudo">Recorde: ' + J.recorde(j.hist, k) + (k === 'quiz' ? ' · domínio da lei: ' + dom.pct + '%' : k === 'nback' ? ' · nível atual: ' + j.nbackN + '-back' : '') + '</small></div></a>'; }).join('') + '</div>' +
      '<section class="cartao jg-ciencia"><h3>A ciência por trás (sem promessa milagrosa)</h3>' +
      '<p>Pesquisamos os estudos mais citados sobre jogos e inteligência. O resumo honesto:</p><ul>' +
      '<li><b>Treinar melhora o que se treina.</b> A maior revisão sobre “brain training” (Simons et al., 2016, mais de 130 estudos) encontrou ganhos fortes na própria tarefa, menores em tarefas parecidas e pouca evidência de ganho geral no dia a dia. <a href="https://www.psychologicalscience.org/publications/brain-training.html" target="_blank" rel="noopener">Fonte ↗</a></li>' +
      '<li><b>N-back e QI:</b> o estudo de Jaeggi et al. (2008) relatou ganho em inteligência fluida com o n-back duplo; uma meta-análise de 20 estudos (Au et al., 2015) achou efeito pequeno; outra, com 87 publicações (Melby-Lervåg, Redick e Hulme, 2016), não achou ganho em medidas de inteligência. Melhora a memória de trabalho; aumento de QI é debatido. <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC2383929" target="_blank" rel="noopener">Jaeggi ↗</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/25102926/" target="_blank" rel="noopener">Au ↗</a> · <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC4968033" target="_blank" rel="noopener">Melby-Lervåg ↗</a></li>' +
      '<li><b>Xadrez:</b> meta-análise de 24 estudos (Sala e Gobet, 2016) achou efeito positivo em crianças, mas a maioria dos estudos não tinha grupo de controle ativo; os próprios autores pedem cautela. <a href="https://researchonline.lse.ac.uk/id/eprint/102237" target="_blank" rel="noopener">Fonte ↗</a></li>' +
      '<li><b>Testar-se fixa o conteúdo:</b> responder perguntas retém mais do que reler (Roediger e Karpicke, 2006), e espaçar as revisões aumenta a retenção (Cepeda et al., 2006, 317 experimentos). Por isso o Quiz usa repetição espaçada: é o jogo com evidência mais forte para aprender a Lei 14.133. <a href="https://profiles.wustl.edu/en/publications/test-enhanced-learning-taking-memory-tests-improves-long-term-ret/" target="_blank" rel="noopener">Roediger ↗</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/16719566/" target="_blank" rel="noopener">Cepeda ↗</a></li>' +
      '<li><b>Atenção:</b> jogos de ação melhoram atenção e cognição espacial (Bediou et al., 2018, meta-análise). <a href="https://archive-ouverte.unige.ch/unige:101941" target="_blank" rel="noopener">Fonte ↗</a></li>' +
      '<li><b>Quebra-cabeças numéricos e de palavras</b> estão associados a melhor desempenho cognitivo em 19 mil adultos de 50 a 93 anos (Brooker et al., 2019), mas o estudo é observacional: não prova causa. <a href="https://ore.exeter.ac.uk/repository/handle/10871/39482" target="_blank" rel="noopener">Fonte ↗</a></li></ul>' +
      '<p class="mini mudo">Por isso a área mistura habilidades (memória, raciocínio, cálculo, atenção) com conteúdo do trabalho: o ganho mais garantido é ficar melhor no que a Seven faz todo dia.</p></section></div>';
  }

  // ---------- Quiz ----------
  function telaQuiz(el) {
    const j = e(); const r = Math.random; const fila = J.rodada(j.quiz, hoje(), 10, r);
    let i = 0, acertos = 0; const erros = [];
    const passo = function () {
      if (i >= fila.length) {
        const pts = acertos * 10; salvarResultado('quiz', pts, { acertos: acertos, total: fila.length });
        const dom = J.dominio(j.quiz);
        el.innerHTML = cab('quiz') + '<div class="jg-fim"><h3>' + acertos + ' de ' + fila.length + '</h3><p>Domínio da lei: <b>' + dom.dominadas + '/' + dom.total + '</b> questões dominadas (' + dom.pct + '%).</p>' + (erros.length ? '<h4>Para revisar</h4><ul class="jg-erros">' + erros.map(function (q) { return '<li><b>' + esc(q.p) + '</b><br>✓ ' + esc(q.o[q.c]) + ' <small class="mudo">(' + esc(q.ref) + ')</small></li>'; }).join('') + '</ul>' : '<p>Gabaritou! 🎉</p>') + '<div class="grupo-botoes"><button class="btn primario" data-j="denovo">Nova rodada</button><a class="btn" href="#/jogos">Voltar</a></div></div>';
        el.querySelector('[data-j=denovo]').onclick = function () { telaQuiz(el); };
        return;
      }
      const q = fila[i]; const alt = J.alternativas(q, r); const st = j.quiz[q.id];
      el.innerHTML = cab('quiz', '<span class="jg-prog">' + (i + 1) + '/' + fila.length + '</span>') + '<div class="jg-quiz"><div class="jg-barra"><i style="width:' + (i / fila.length * 100) + '%"></i></div><p class="jg-tema">' + esc(q.tema) + (st ? ' · revisão' : ' · nova') + '</p><h3>' + esc(q.p) + '</h3><div class="jg-ops">' + alt.o.map(function (o, k) { return '<button class="jg-op" data-k="' + k + '"><span>' + 'ABCD'[k] + '</span>' + esc(o) + '</button>'; }).join('') + '</div><div class="jg-feed" hidden></div></div>';
      el.querySelector('.jg-ops').onclick = function (ev) {
        const b = ev.target.closest('[data-k]'); if (!b || el.querySelector('.jg-op.certa')) return;
        const k = Number(b.dataset.k); const ok = k === alt.c; if (ok) acertos++; else erros.push(q);
        J.revisar(j.quiz, q.id, ok, hoje()); Dados.salvar();
        el.querySelectorAll('.jg-op').forEach(function (x, n) { x.disabled = true; if (n === alt.c) x.classList.add('certa'); else if (n === k) x.classList.add('errada'); });
        const f = el.querySelector('.jg-feed'); f.hidden = false; f.innerHTML = '<p>' + (ok ? '✓ Correto.' : '✗ Resposta: ' + esc(q.o[q.c])) + ' <small class="mudo">' + esc(q.ref) + '</small></p><button class="btn primario" data-j="prox">' + (i + 1 < fila.length ? 'Próxima' : 'Ver resultado') + ' →</button>';
        f.querySelector('[data-j=prox]').onclick = function () { i++; passo(); }; f.querySelector('[data-j=prox]').focus();
      };
    };
    passo();
  }

  // ---------- N-back ----------
  function falar(t) { try { if (!e().voz || !self.speechSynthesis) return; const u = new SpeechSynthesisUtterance(t); u.lang = 'pt-BR'; u.rate = 1.1; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (err) { /* sem voz */ } }
  function telaNBack(el) {
    const j = e(); const n = j.nbackN; const POS = [0, 1, 2, 3, 5, 6, 7, 8];
    el.innerHTML = cab('nback') + '<div class="jg-nb"><p>Nível atual: <b>' + n + '-back</b>. A cada 2,5 s aparece um quadrado com uma letra. Aperte <b>Posição (A)</b> se a posição for igual à de ' + n + ' rodada' + (n > 1 ? 's' : '') + ' atrás, e <b>Letra (L)</b> se a letra for igual. As duas podem coincidir.</p><label class="check"><input type="checkbox" id="jg-voz"' + (j.voz ? ' checked' : '') + '> Falar as letras em voz alta</label><button class="btn primario" data-j="comecar">Começar (' + (20 + n) + ' rodadas)</button></div>';
    el.querySelector('#jg-voz').onchange = function () { j.voz = this.checked; Dados.salvar(); };
    el.querySelector('[data-j=comecar]').onclick = function () {
      const seq = J.sequenciaNBack(n); const resp = []; let i = -1;
      el.innerHTML = cab('nback', '<span class="jg-prog" id="jg-nb-i"></span>') + '<div class="jg-nb"><div class="jg-nb-grade">' + Array.from({ length: 9 }, function (_, k) { return '<div class="jg-nb-c' + (k === 4 ? ' centro' : '') + '" data-c="' + k + '"></div>'; }).join('') + '</div><div class="jg-nb-bts"><button class="btn" data-r="pos">Posição <kbd>A</kbd></button><button class="btn" data-r="letra">Letra <kbd>L</kbd></button></div></div>';
      const marcar = function (k) { if (i < n) return; resp[i] = resp[i] || {}; resp[i][k] = true; const b = el.querySelector('[data-r=' + k + ']'); b.classList.add('marcado'); };
      el.querySelector('.jg-nb-bts').onclick = function (ev) { const b = ev.target.closest('[data-r]'); if (b) marcar(b.dataset.r); };
      el.onkeydown = function (ev) { if (ev.key === 'a' || ev.key === 'A') marcar('pos'); if (ev.key === 'l' || ev.key === 'L') marcar('letra'); };
      el.tabIndex = -1; el.focus();
      const tick = function () {
        el.querySelectorAll('.jg-nb-c').forEach(function (c) { c.classList.remove('on'); c.textContent = ''; });
        el.querySelectorAll('[data-r]').forEach(function (b) { b.classList.remove('marcado'); });
        i++;
        if (i >= seq.pos.length) {
          const p = J.pontuarNBack(seq, resp); const novo = J.proximoN(n, p.pct); j.nbackN = novo;
          salvarResultado('nback', n * 100 + p.pct, { n: n, pct: p.pct });
          el.innerHTML = cab('nback') + '<div class="jg-fim"><h3>' + p.pct + '% de acerto no ' + n + '-back</h3><p>Posição: ' + p.detalhe.pos.acertos + '/' + p.detalhe.pos.alvos + ' alvos · Letra: ' + p.detalhe.letra.acertos + '/' + p.detalhe.letra.alvos + ' alvos · ' + p.erros + ' erro(s) no total.</p><p>' + (novo > n ? 'Subiu para <b>' + novo + '-back</b>! 🚀' : novo < n ? 'Volta para <b>' + novo + '-back</b> para firmar.' : 'Continua no <b>' + n + '-back</b> (90% ou mais sobe).') + '</p><div class="grupo-botoes"><button class="btn primario" data-j="denovo">Jogar de novo</button><a class="btn" href="#/jogos">Voltar</a></div></div>';
          el.querySelector('[data-j=denovo]').onclick = function () { telaNBack(el); }; el.onkeydown = null;
          return;
        }
        const c = el.querySelector('[data-c="' + POS[seq.pos[i]] + '"]'); c.classList.add('on'); c.textContent = seq.letras[i]; falar(seq.letras[i]);
        el.querySelector('#jg-nb-i').textContent = (i + 1) + '/' + seq.pos.length;
        depois(2000, function () { c.classList.remove('on'); c.textContent = ''; });
        depois(2500, tick);
      };
      depois(600, tick);
    };
  }

  // ---------- Memória ----------
  function telaMemoria(el, pares) {
    pares = pares || 8; const cartas = J.baralho(pares); let abertas = [], achados = 0, jogadas = 0; const ini = Date.now(); let trava = false;
    el.innerHTML = cab('memoria', '<span class="jg-prog" id="jg-mm-s">0 jogadas</span>') + '<div class="jg-niveis">' + [6, 8, 12].map(function (p) { return '<button class="btn mini' + (p === pares ? ' primario' : '') + '" data-p="' + p + '">' + p + ' pares</button>'; }).join('') + '</div><div class="jg-mm" style="--cols:' + (pares === 12 ? 6 : 4) + '">' + cartas.map(function (c) { return '<button class="jg-carta" data-id="' + c.id + '" aria-label="Carta virada"><span class="jg-verso">S</span><span class="jg-frente' + (c.sigla ? ' sigla' : '') + '">' + esc(c.t) + '</span></button>'; }).join('') + '</div>';
    el.querySelector('.jg-niveis').onclick = function (ev) { const b = ev.target.closest('[data-p]'); if (b) telaMemoria(el, Number(b.dataset.p)); };
    el.querySelector('.jg-mm').onclick = function (ev) {
      const b = ev.target.closest('.jg-carta'); if (!b || trava || b.classList.contains('virada')) return;
      b.classList.add('virada'); b.setAttribute('aria-label', b.querySelector('.jg-frente').textContent); abertas.push(b);
      if (abertas.length < 2) return;
      jogadas++; el.querySelector('#jg-mm-s').textContent = jogadas + ' jogadas';
      const [a, c] = abertas.map(function (x) { return cartas[Number(x.dataset.id)]; });
      if (a.par === c.par) { abertas.forEach(function (x) { x.classList.add('par'); }); abertas = []; achados++;
        if (achados === pares) { const s = Math.round((Date.now() - ini) / 1000); const pts = J.pontosMemoria(pares, jogadas, s); salvarResultado('memoria', pts, { pares: pares, jogadas: jogadas, s: s }); depois(500, function () { const f = document.createElement('div'); f.className = 'jg-fim'; f.innerHTML = '<h3>Todos os pares em ' + jogadas + ' jogadas e ' + s + ' s</h3><p>' + pts + ' pontos</p><button class="btn primario">Jogar de novo</button>'; el.appendChild(f); f.querySelector('button').onclick = function () { telaMemoria(el, pares); }; f.scrollIntoView({ behavior: 'smooth' }); }); }
      } else { trava = true; depois(900, function () { abertas.forEach(function (x) { x.classList.remove('virada'); x.setAttribute('aria-label', 'Carta virada'); }); abertas = []; trava = false; }); }
    };
  }

  // ---------- Xadrez ----------
  function telaXadrez(el) {
    const j = e(); if (!j.xadrez) j.xadrez = { fen: X.INICIAL, hist: [], lances: [], nivel: 2, cor: 'w' };
    const g = j.xadrez; const pos = X.lerFEN(g.fen); pos.hist = g.hist.slice();
    let sel = -1; let pensando = false;
    const salvarX = function () { g.fen = X.fen(pos); g.hist = pos.hist.slice(); Dados.salvar(); };
    const desenhar = function () {
      const st = X.situacao(pos); const ls = sel >= 0 ? X.lances(pos).filter(function (m) { return m.de === sel; }) : [];
      const ult = g.ultimo || {};
      const casas = []; for (let k = 0; k < 64; k++) { const i = g.cor === 'w' ? k : 63 - k; const p = pos.b[i]; const clara = ((i >> 3) + (i & 7)) % 2 === 0; const t = p ? PECAS[p.toLowerCase()] : null; const alvo = ls.find(function (m) { return m.para === i; }); const reiX = st.xeque && p === (pos.vez === 'w' ? 'K' : 'k');
        casas.push('<button class="jg-cx ' + (clara ? 'jg-cl' : 'jg-es') + (i === sel ? ' sel' : '') + (i === ult.de || i === ult.para ? ' ult' : '') + (reiX ? ' xeque' : '') + (alvo ? (p ? ' cap' : ' alvo') : '') + '" data-i="' + i + '" aria-label="' + X.nomeCasa(i) + (t ? ' ' + t[2] : '') + '" title="' + (t ? esc(t[2]) : '') + '">' + (t ? '<span class="' + (p === p.toUpperCase() ? 'pb' : 'pp') + '">' + t[1] + '</span>' : '') + ((g.cor === 'w' ? (k & 7) === 0 : (k & 7) === 0) ? '<i class="jg-coord l">' + X.nomeCasa(i)[1] + '</i>' : '') + (k >= 56 ? '<i class="jg-coord c">' + X.nomeCasa(i)[0] + '</i>' : '') + '</button>'); }
      const pares = []; for (let k = 0; k < g.lances.length; k += 2) pares.push('<li><span>' + (k / 2 + 1) + '.</span> ' + esc(g.lances[k]) + ' ' + esc(g.lances[k + 1] || '') + '</li>');
      const msg = st.fim ? (st.tipo === 'mate' ? (st.vencedor === g.cor ? '🏆 Xeque-mate! Você venceu.' : 'Xeque-mate. O computador venceu.') : 'Empate por ' + st.tipo + '.') : pensando ? 'Computador pensando…' : pos.vez === g.cor ? 'Sua vez' + (st.xeque ? ' — você está em xeque!' : '') : 'Vez do computador';
      el.innerHTML = cab('xadrez') + '<div class="jg-xz"><div class="jg-tab" role="grid" aria-label="Tabuleiro">' + casas.join('') + '</div><aside class="jg-xz-lado"><p class="jg-xz-msg' + (st.fim ? ' fim' : '') + '">' + msg + '</p>' +
        '<div class="jg-xz-cfg"><label>Nível <select id="jg-niv">' + [1, 2, 3].map(function (n) { return '<option value="' + n + '"' + (g.nivel === n ? ' selected' : '') + '>' + ['', 'Iniciante', 'Intermediário', 'Avançado'][n] + '</option>'; }).join('') + '</select></label><button class="btn mini" data-x="nova-w">Nova (brancas)</button><button class="btn mini" data-x="nova-b">Nova (pretas)</button><button class="btn mini fantasma" data-x="voltar"' + (g.lances.length < 2 || pensando ? ' disabled' : '') + '>↶ Voltar lance</button></div>' +
        '<ol class="jg-xz-lances">' + pares.join('') + '</ol><details class="jg-xz-leg"><summary>Elenco do Xadrez do Pregão</summary><ul>' + Object.keys(PECAS).map(function (k) { return '<li>' + PECAS[k][1] + ' ' + esc(PECAS[k][2]) + '</li>'; }).join('') + '</ul></details></aside></div>';
      if (st.fim && !g.registrado) { g.registrado = true; salvarResultado('xadrez', st.tipo === 'mate' ? (st.vencedor === g.cor ? 100 * g.nivel : 0) : 30 * g.nivel, { resultado: st.tipo, nivel: g.nivel }); }
    };
    const computador = function () {
      if (pos.vez === g.cor || X.situacao(pos).fim) return;
      pensando = true; desenhar();
      depois(250, function () { const m = X.melhorLance(pos, g.nivel); if (m) { g.lances.push(X.jogar(pos, m)); g.ultimo = { de: m.de, para: m.para }; } pensando = false; salvarX(); desenhar(); });
    };
    el.onclick = function (ev) {
      const bx = ev.target.closest('[data-x]');
      if (bx) {
        const a = bx.dataset.x;
        if (a === 'nova-w' || a === 'nova-b') { j.xadrez = { fen: X.INICIAL, hist: [], lances: [], nivel: g.nivel, cor: a === 'nova-w' ? 'w' : 'b' }; Dados.salvar(); limparTimers(); telaXadrez(el); return; }
        if (a === 'voltar') { const hs = g.lances.slice(0, -2); const novo = X.lerFEN(X.INICIAL); novo.hist = []; const ls = []; for (const s of hs) { const m = X.lances(novo).find(function (x) { return X.san(novo, x) === s; }); ls.push(X.jogar(novo, m)); } j.xadrez = Object.assign(g, { fen: X.fen(novo), hist: novo.hist, lances: ls, ultimo: null, registrado: false }); Dados.salvar(); telaXadrez(el); return; }
      }
      const c = ev.target.closest('.jg-cx'); if (!c || pensando || pos.vez !== g.cor || X.situacao(pos).fim) return;
      const i = Number(c.dataset.i);
      if (sel >= 0) {
        const ms = X.lances(pos).filter(function (m) { return m.de === sel && m.para === i; });
        if (ms.length) { const m = ms.find(function (x) { return !x.promo || x.promo.toLowerCase() === 'q'; }) || ms[0]; g.lances.push(X.jogar(pos, m)); g.ultimo = { de: m.de, para: m.para }; sel = -1; salvarX(); desenhar(); computador(); return; }
      }
      sel = pos.b[i] && X.cor(pos.b[i]) === g.cor ? (sel === i ? -1 : i) : -1; desenhar();
    };
    el.onchange = function (ev) { if (ev.target.id === 'jg-niv') { g.nivel = Number(ev.target.value); Dados.salvar(); } };
    desenhar(); computador();
  }

  // ---------- Matrizes ----------
  function svgCelula(x, tam) {
    tam = tam || 70; const s = tam / 100; const itens = []; const n = x.n; const off = n === 1 ? [0] : n === 2 ? [-18, 18] : [-26, 0, 26];
    off.forEach(function (o) {
      const cx = 50 + o, cy = 50; let f;
      if (x.forma === 'circulo') f = '<circle cx="' + cx + '" cy="' + cy + '" r="11"/>';
      else if (x.forma === 'quadrado') f = '<rect x="' + (cx - 10) + '" y="' + (cy - 10) + '" width="20" height="20"/>';
      else if (x.forma === 'triangulo') f = '<polygon points="' + cx + ',' + (cy - 12) + ' ' + (cx + 11) + ',' + (cy + 9) + ' ' + (cx - 11) + ',' + (cy + 9) + '"/>';
      else f = '<polygon points="' + cx + ',' + (cy - 13) + ' ' + (cx + 10) + ',' + cy + ' ' + cx + ',' + (cy + 13) + ' ' + (cx - 10) + ',' + cy + '"/>';
      itens.push('<g transform="rotate(' + x.rot + ' ' + cx + ' ' + cy + ')">' + f + '</g>');
    });
    return '<svg viewBox="0 0 100 100" width="' + (100 * s) + '" height="' + (100 * s) + '" fill="' + x.cor + '" aria-hidden="true">' + itens.join('') + '</svg>';
  }
  function telaMatrizes(el) {
    const j = e(); let rodada = 0, acertos = 0, seguidos = 0; const total = 10; const ini = Date.now();
    const passo = function () {
      if (rodada >= total) { const s = Math.round((Date.now() - ini) / 1000); const pts = acertos * 10 * j.matrizNivel; salvarResultado('matrizes', pts, { acertos: acertos, nivel: j.matrizNivel, s: s }); el.innerHTML = cab('matrizes') + '<div class="jg-fim"><h3>' + acertos + ' de ' + total + '</h3><p>Nível ' + j.matrizNivel + ' · ' + s + ' s · ' + pts + ' pontos</p><div class="grupo-botoes"><button class="btn primario" data-j="denovo">Jogar de novo</button><a class="btn" href="#/jogos">Voltar</a></div></div>'; el.querySelector('[data-j=denovo]').onclick = function () { telaMatrizes(el); }; return; }
      const m = J.matriz(j.matrizNivel);
      el.innerHTML = cab('matrizes', '<span class="jg-prog">' + (rodada + 1) + '/' + total + ' · nível ' + j.matrizNivel + '</span>') + '<div class="jg-mt"><p class="mudo">Cada linha segue uma regra (quantidade, forma, cor ou giro). Qual peça completa a matriz?</p><div class="jg-mt-g">' + m.grade.map(function (c) { return '<div>' + svgCelula(c) + '</div>'; }).join('') + '<div class="jg-mt-q">?</div></div><div class="jg-mt-ops">' + m.opcoes.map(function (c, k) { return '<button data-k="' + k + '" aria-label="Opção ' + (k + 1) + '">' + svgCelula(c, 60) + '</button>'; }).join('') + '</div></div>';
      el.querySelector('.jg-mt-ops').onclick = function (ev) {
        const b = ev.target.closest('[data-k]'); if (!b || el.querySelector('.jg-mt-ops .certa')) return;
        const ok = Number(b.dataset.k) === m.certa; if (ok) { acertos++; seguidos++; } else seguidos = 0;
        if (seguidos >= 3 && j.matrizNivel < 4) { j.matrizNivel++; seguidos = 0; aviso('Subiu para o nível ' + j.matrizNivel + '!'); } else if (!ok && j.matrizNivel > 1 && rodada > 2 && acertos / (rodada + 1) < 0.4) j.matrizNivel--;
        Dados.salvar();
        el.querySelectorAll('.jg-mt-ops button')[m.certa].classList.add('certa'); if (!ok) b.classList.add('errada');
        rodada++; depois(ok ? 500 : 1300, passo);
      };
    };
    passo();
  }

  // ---------- Sprint de lances ----------
  function telaLances(el) {
    el.innerHTML = cab('lances') + '<div class="jg-ln"><p>Responda o máximo que conseguir em 60 segundos. Use vírgula para centavos. Erro não desconta, mas trava 2 segundos.</p><button class="btn primario" data-j="comecar">Começar</button></div>';
    el.querySelector('[data-j=comecar]').onclick = function () {
      let pts = 0, feitas = 0, q = J.questaoLance(2); const fim = Date.now() + 60000;
      el.innerHTML = cab('lances', '<span class="jg-prog" id="jg-ln-t">60 s</span>') + '<div class="jg-ln"><p class="jg-ln-q" id="jg-ln-q"></p><form id="jg-ln-f"><input id="jg-ln-r" inputmode="decimal" autocomplete="off" aria-label="Resposta"><button class="btn primario">OK</button></form><p class="jg-ln-pl" id="jg-ln-p">0 acertos</p><p class="mini mudo" id="jg-ln-fb"></p></div>';
      const inp = el.querySelector('#jg-ln-r'); const mostrar = function () { el.querySelector('#jg-ln-q').textContent = q.p; inp.value = ''; inp.focus(); };
      mostrar();
      const acabar = function () { limparTimers(); salvarResultado('lances', pts, { feitas: feitas }); el.innerHTML = cab('lances') + '<div class="jg-fim"><h3>' + pts + ' acerto' + (pts === 1 ? '' : 's') + ' em 60 s</h3><p>' + feitas + ' respondidas.</p><div class="grupo-botoes"><button class="btn primario" data-j="denovo">Jogar de novo</button><a class="btn" href="#/jogos">Voltar</a></div></div>'; el.querySelector('[data-j=denovo]').onclick = function () { telaLances(el); }; };
      cada(250, function () { const s = Math.max(0, Math.ceil((fim - Date.now()) / 1000)); const t = el.querySelector('#jg-ln-t'); if (t) t.textContent = s + ' s'; if (s <= 0) acabar(); });
      el.querySelector('#jg-ln-f').onsubmit = function (ev) {
        ev.preventDefault(); if (inp.disabled || !inp.value.trim()) return; feitas++;
        const ok = J.confere(q, inp.value); const fb = el.querySelector('#jg-ln-fb');
        if (ok) { pts++; fb.textContent = '✓ Certo'; q = J.questaoLance(2); mostrar(); }
        else { fb.textContent = '✗ Era ' + (q.unid === 'R$' ? 'R$ ' : '') + J.fmt(q.resp).replace(/,00$/, q.unid === 'R$' ? ',00' : '') + (q.unid === '%' ? '%' : ''); inp.disabled = true; depois(2000, function () { inp.disabled = false; q = J.questaoLance(2); mostrar(); }); }
        el.querySelector('#jg-ln-p').textContent = pts + ' acerto' + (pts === 1 ? '' : 's');
      };
    };
  }

  // ---------- Itens do lote (Schulte) ----------
  function telaSchulte(el) {
    const t = J.tabela(5); let prox = 1; let ini = 0;
    el.innerHTML = cab('schulte', '<span class="jg-prog" id="jg-sc-t">Ache o item 1</span>') + '<div class="jg-sc"><p class="mudo">Olhe para o centro e encontre os itens de 1 a 25 em ordem.</p><div class="jg-sc-g">' + t.map(function (v) { return '<button data-v="' + v + '">' + v + '</button>'; }).join('') + '</div></div>';
    el.querySelector('.jg-sc-g').onclick = function (ev) {
      const b = ev.target.closest('[data-v]'); if (!b) return; const v = Number(b.dataset.v);
      if (v !== prox) { b.classList.add('erro'); depois(300, function () { b.classList.remove('erro'); }); return; }
      if (prox === 1) ini = Date.now(); b.classList.add('ok'); prox++;
      el.querySelector('#jg-sc-t').textContent = prox <= 25 ? 'Ache o item ' + prox : '';
      if (prox > 25) { const s = (Date.now() - ini) / 1000; const pts = Math.max(0, Math.round(1000 - s * 15)); salvarResultado('schulte', pts, { s: s }); const f = document.createElement('div'); f.className = 'jg-fim'; f.innerHTML = '<h3>' + s.toFixed(1).replace('.', ',') + ' segundos</h3><p>' + pts + ' pontos</p><button class="btn primario">Jogar de novo</button>'; el.appendChild(f); f.querySelector('button').onclick = function () { telaSchulte(el); }; }
    };
  }

  Telas.jogos = {
    titulo: 'Seven Jogos',
    render: function (el, sub) {
      limparTimers(); el.onkeydown = null;
      const telas = { quiz: telaQuiz, nback: telaNBack, memoria: telaMemoria, xadrez: telaXadrez, matrizes: telaMatrizes, lances: telaLances, schulte: telaSchulte };
      if (telas[sub]) { const box = document.createElement('div'); box.className = 'jg-jogo'; el.innerHTML = ''; el.appendChild(box); return telas[sub](box); }
      telaInicio(el);
    }
  };
})();
