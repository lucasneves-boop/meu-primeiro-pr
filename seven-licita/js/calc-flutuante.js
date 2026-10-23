/* Seven Calculadora em janela flutuante: abre de qualquer tela (botão no topo ou Alt+C), pode ser arrastada,
   continua aberta ao trocar de ferramenta e insere o resultado no campo em que você estava digitando. */
(function () {
  'use strict';
  const { esc, aviso } = UI;
  const CHAVE = 'seven-calc-janela';
  const TECLAS = [['C', 'cmd'], ['⌫', 'cmd'], ['%', 'op'], ['÷', 'op'], ['7', 'nu'], ['8', 'nu'], ['9', 'nu'], ['×', 'op'], ['4', 'nu'], ['5', 'nu'], ['6', 'nu'], ['−', 'op'], ['1', 'nu'], ['2', 'nu'], ['3', 'nu'], ['+', 'op'], ['±', 'cmd'], ['0', 'nu'], [',', 'nu'], ['=', 'igual']];
  const est = { expr: '', ans: 0, hist: [] };
  let jan = null, alvo = null;

  function fmt(v) { return v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 10 }); }
  function paraCampo(v) { return String(Math.round(v * 1e10) / 1e10).replace('.', ','); }
  function lerPos() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } }
  function salvarPos(p) { try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch (e) { /* sem armazenamento */ } }

  // lembra o último campo de texto da página (fora da calculadora) para inserir o resultado nele
  document.addEventListener('focusin', function (ev) {
    const t = ev.target; if (!t || (jan && jan.contains(t))) return;
    if ((t.tagName === 'INPUT' && /^(text|search|number|tel|)$/.test(t.type || '') && !t.readOnly && !t.disabled) || (t.tagName === 'TEXTAREA' && !t.readOnly)) { alvo = t; if (jan && !jan.hidden) atualizarInserir(); }
  });

  function avaliar(txt) { return Calc.avaliar(txt, { angulo: 'grau', ans: est.ans }); }
  function desenharHist() {
    const ul = jan.querySelector('.cf-hist');
    ul.innerHTML = est.hist.length ? est.hist.slice(0, 6).map(function (h, i) { return '<li><button type="button" data-h="' + i + '" title="Usar este resultado"><small>' + esc(h.e) + ' =</small><b>' + esc(fmt(h.r)) + '</b></button></li>'; }).join('') : '<li class="cf-vazio">O histórico aparece aqui.</li>';
  }
  function previa() {
    const inp = jan.querySelector('.cf-expr'), pv = jan.querySelector('.cf-prev'); est.expr = inp.value;
    try { pv.textContent = inp.value.trim() ? '= ' + fmt(avaliar(inp.value)) : ''; pv.classList.remove('erro'); } catch (e) { pv.textContent = ''; }
    atualizarInserir();
  }
  function valorAtual() { const inp = jan.querySelector('.cf-expr'); try { return inp.value.trim() ? avaliar(inp.value) : est.ans; } catch (e) { return null; } }
  function atualizarInserir() { const b = jan.querySelector('[data-cf=inserir]'); const ok = alvo && document.body.contains(alvo); b.disabled = !ok; b.title = ok ? 'Coloca o resultado no campo em que você estava' + (alvo.name || alvo.placeholder ? ' (' + (alvo.getAttribute('aria-label') || alvo.placeholder || alvo.name) + ')' : '') : 'Clique em um campo da tela antes'; }
  function calcular() {
    const inp = jan.querySelector('.cf-expr'), pv = jan.querySelector('.cf-prev'); if (!inp.value.trim()) return;
    try { const r = avaliar(inp.value); est.hist.unshift({ e: inp.value, r: r }); est.hist = est.hist.slice(0, 30); est.ans = r; inp.value = paraCampo(r); est.expr = inp.value; pv.textContent = ''; desenharHist(); atualizarInserir(); }
    catch (e) { pv.textContent = e.message; pv.classList.add('erro'); }
  }
  function inserir(s) {
    const inp = jan.querySelector('.cf-expr'); const a = inp.selectionStart != null ? inp.selectionStart : inp.value.length; const b = inp.selectionEnd != null ? inp.selectionEnd : a;
    inp.value = inp.value.slice(0, a) + s + inp.value.slice(b); inp.focus(); inp.setSelectionRange(a + s.length, a + s.length); previa();
  }
  function colocarNoCampo() {
    const v = valorAtual(); if (v == null || !isFinite(v)) { aviso('Nada para inserir: confira a conta.', 'erro'); return; }
    if (!alvo || !document.body.contains(alvo)) { aviso('Clique no campo da tela onde o valor deve entrar e tente de novo.', 'erro'); return; }
    const txt = alvo.type === 'number' ? String(Math.round(v * 1e10) / 1e10) : paraCampo(v);
    const set = Object.getOwnPropertyDescriptor(alvo.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set; set.call(alvo, txt);
    alvo.dispatchEvent(new Event('input', { bubbles: true })); alvo.dispatchEvent(new Event('change', { bubbles: true }));
    alvo.focus(); aviso('Valor ' + fmt(v) + ' inserido no campo.');
  }

  function posicionar(p) {
    const w = jan.offsetWidth, h = jan.offsetHeight; const x = Math.max(8, Math.min(innerWidth - w - 8, p.x == null ? innerWidth - w - 24 : p.x)); const y = Math.max(8, Math.min(innerHeight - 48, p.y == null ? 84 : p.y));
    jan.style.left = x + 'px'; jan.style.top = y + 'px'; return { x: x, y: y };
  }
  function criar() {
    jan = document.createElement('section'); jan.id = 'calc-flutuante'; jan.className = 'cf no-print'; jan.setAttribute('role', 'dialog'); jan.setAttribute('aria-label', 'Calculadora');
    jan.innerHTML = '<header class="cf-barra"><b>🧮 Calculadora</b><span class="cf-dica">arraste para mover</span><button type="button" class="cf-b" data-cf="min" title="Minimizar" aria-label="Minimizar">–</button><a class="cf-b" href="#/calculadora" data-cf="completa" title="Abrir a Seven Calculadora completa" aria-label="Abrir a calculadora completa">⤢</a><button type="button" class="cf-b" data-cf="fechar" title="Fechar (Esc)" aria-label="Fechar">×</button></header>' +
      '<div class="cf-corpo"><div class="cf-visor"><input class="cf-expr" aria-label="Conta" autocomplete="off" spellcheck="false" inputmode="decimal"><div class="cf-prev" aria-live="polite"></div></div>' +
      '<div class="cf-teclas">' + TECLAS.map(function (t) { return '<button type="button" class="cl-t ' + t[1] + '" data-t="' + esc(t[0]) + '">' + esc(t[0]) + '</button>'; }).join('') + '</div>' +
      '<div class="cf-acoes"><button type="button" class="btn mini primario" data-cf="inserir">↵ Inserir no campo</button><button type="button" class="btn mini" data-cf="copiar">Copiar</button></div>' +
      '<ul class="cf-hist"></ul></div>';
    document.body.appendChild(jan);
    const p = lerPos(); if (p.min) jan.classList.add('min'); posicionar(p);
    const inp = jan.querySelector('.cf-expr'); inp.value = est.expr;
    inp.oninput = previa;
    inp.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === '=') { ev.preventDefault(); calcular(); } if (ev.key === 'Escape') { ev.preventDefault(); if (inp.value) { inp.value = ''; previa(); } else fechar(); } };
    jan.addEventListener('click', function (ev) {
      const h = ev.target.closest('[data-h]'); if (h) { inserir(paraCampo(est.hist[h.dataset.h].r)); return; }
      const c = ev.target.closest('[data-cf]');
      if (c) {
        const k = c.dataset.cf;
        if (k === 'fechar') fechar();
        if (k === 'min') { jan.classList.toggle('min'); const q = lerPos(); q.min = jan.classList.contains('min'); salvarPos(q); c.title = q.min ? 'Expandir' : 'Minimizar'; if (!q.min) inp.focus(); }
        if (k === 'inserir') colocarNoCampo();
        if (k === 'copiar') { const v = valorAtual(); if (v == null) return; const s = paraCampo(v); (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(function () { aviso('Copiado: ' + s); }, function () { aviso(s); }); }
        return;
      }
      const t = ev.target.closest('[data-t]'); if (!t) return; const k = t.dataset.t;
      if (k === '=') return calcular();
      if (k === 'C') { inp.value = ''; previa(); inp.focus(); return; }
      if (k === '⌫') { const q = inp.selectionStart || inp.value.length; inp.value = inp.value.slice(0, Math.max(0, q - 1)) + inp.value.slice(q); inp.focus(); inp.setSelectionRange(q - 1, q - 1); previa(); return; }
      if (k === '±') { inp.value = inp.value ? '-(' + inp.value + ')' : '-'; previa(); inp.focus(); return; }
      inserir(k);
    });
    // não roubar o foco do campo da página ao clicar nas teclas (só o visor recebe foco)
    jan.addEventListener('mousedown', function (ev) { if (ev.target.closest('.cl-t, [data-cf=inserir]')) ev.preventDefault(); });
    // arrastar pela barra
    const barra = jan.querySelector('.cf-barra');
    barra.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.cf-b')) return; ev.preventDefault();
      const r = jan.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top; barra.setPointerCapture(ev.pointerId); jan.classList.add('arrastando');
      const mover = function (e) { posicionar({ x: e.clientX - dx, y: e.clientY - dy }); };
      const soltar = function () { barra.removeEventListener('pointermove', mover); barra.removeEventListener('pointerup', soltar); barra.removeEventListener('pointercancel', soltar); jan.classList.remove('arrastando'); const q = lerPos(); const r2 = jan.getBoundingClientRect(); q.x = Math.round(r2.left); q.y = Math.round(r2.top); salvarPos(q); };
      barra.addEventListener('pointermove', mover); barra.addEventListener('pointerup', soltar); barra.addEventListener('pointercancel', soltar);
    });
    desenharHist(); previa();
  }
  function abrir(restaurar) {
    if (!jan) criar(); jan.hidden = false; const q = lerPos(); q.aberta = true; if (!restaurar) { q.min = false; jan.classList.remove('min'); } salvarPos(q); posicionar(q);
    marcarBotao(); atualizarInserir(); if (restaurar) return;
    const inp = jan.querySelector('.cf-expr'); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
  }
  function fechar() { if (!jan) return; jan.hidden = true; const q = lerPos(); q.aberta = false; salvarPos(q); marcarBotao(); if (alvo && document.body.contains(alvo)) alvo.focus(); }
  function alternar() { if (jan && !jan.hidden) fechar(); else abrir(); }
  function marcarBotao() { const b = document.getElementById('botao-calc'); if (b) b.setAttribute('aria-pressed', String(!!(jan && !jan.hidden))); }

  document.addEventListener('keydown', function (ev) { if (ev.altKey && !ev.ctrlKey && !ev.metaKey && (ev.key === 'c' || ev.key === 'C' || ev.code === 'KeyC')) { ev.preventDefault(); alternar(); } });
  window.addEventListener('resize', function () { if (jan && !jan.hidden) posicionar(lerPos()); });
  function ligar() {
    const b = document.getElementById('botao-calc'); if (b) b.addEventListener('click', alternar);
    if (lerPos().aberta) abrir(true); // continua aberta (ou minimizada) depois de recarregar
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();

  self.CalcFlutuante = { abrir: function () { abrir(); }, fechar: fechar, alternar: alternar, aberta: function () { return !!(jan && !jan.hidden); } };
})();
