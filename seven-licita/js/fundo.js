/* Fundo animado e interativo (no estilo do menu do PlayStation 4): um canvas atrás do conteúdo.
   Animações: ondas de luz, partículas, constelação e aurora; reagem ao mouse e ao clique.
   A escolha fica neste navegador (Configurações → Fundo animado). Respeita "reduzir movimento" do sistema. */
(function () {
  'use strict';
  const OPCOES = [
    { id: 'ondas', nome: 'Ondas', desc: 'Faixas de luz ondulando, como no PS4' },
    { id: 'particulas', nome: 'Partículas', desc: 'Luzes desfocadas flutuando' },
    { id: 'constelacao', nome: 'Constelação', desc: 'Pontos que se ligam perto do mouse' },
    { id: 'aurora', nome: 'Aurora', desc: 'Manchas de cor em movimento lento' },
    { id: 'nenhum', nome: 'Desligado', desc: 'Fundo liso, sem animação' }
  ];
  const CHAVE = 'seven-fundo';
  const ESCALA = 0.6, INTERVALO = 1000 / 30; let ultimo = 0; // ~30 quadros por segundo
  let modo = salvo(), cv = null, g = null, W = 0, H = 0, dpr = 1, t0 = performance.now(), quadro = null;
  let cores = { ouro: [183, 141, 66], fundo: [246, 245, 242], escuro: false };
  const mouse = { x: -9999, y: -9999, vx: 0, vy: 0, ativo: false }; const ondasClique = []; let pontos = [];
  const reduzir = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function salvo() { try { const v = localStorage.getItem(CHAVE); return OPCOES.some(function (o) { return o.id === v; }) ? v : 'ondas'; } catch (e) { return 'ondas'; } }
  function rgb(txt, padrao) { const c = document.createElement('i'); c.style.color = txt; document.body.appendChild(c); const m = getComputedStyle(c).color.match(/\d+(\.\d+)?/g); c.remove(); return m ? m.slice(0, 3).map(Number) : padrao; }
  function lerCores() {
    const st = getComputedStyle(document.documentElement);
    const f = rgb(st.getPropertyValue('--fundo').trim() || '#f6f5f2', [246, 245, 242]);
    cores = { ouro: rgb(st.getPropertyValue('--ouro').trim() || '#b68d40', [183, 141, 66]), fundo: f, escuro: (0.299 * f[0] + 0.587 * f[1] + 0.114 * f[2]) < 128 };
  }
  function cor(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }
  function mistura(a, b, k) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * k); }); }

  function medir() {
    if (!cv) return; dpr = ESCALA; W = innerWidth; H = innerHeight; // resolução reduzida: o fundo é suave e pesa menos
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); semear();
  }
  function aleat(a, b) { return a + Math.random() * (b - a); }
  function semear() {
    const n = modo === 'constelacao' ? Math.round(Math.min(110, W * H / 14000)) : modo === 'particulas' ? 46 : modo === 'ondas' ? 38 : 5;
    pontos = []; for (let i = 0; i < n; i++) pontos.push({ x: aleat(0, W), y: aleat(0, H), vx: aleat(-0.25, 0.25), vy: aleat(-0.25, 0.25), r: aleat(1, 1), f: Math.random(), k: Math.random() });
    pontos.forEach(function (p) {
      if (modo === 'particulas') { p.r = aleat(14, 70); p.vy = aleat(-0.35, -0.08); }
      if (modo === 'ondas') { p.r = aleat(0.8, 2.4); p.vy = aleat(-0.4, -0.12); p.vx = aleat(-0.12, 0.12); }
      if (modo === 'constelacao') p.r = aleat(1.2, 2.6);
      if (modo === 'aurora') { p.r = aleat(0.35, 0.6) * Math.max(W, H); p.vx = aleat(-0.18, 0.18); p.vy = aleat(-0.12, 0.12); }
    });
  }

  // ---------- desenhos ----------
  function fundoBase() {
    const top = cores.escuro ? mistura(cores.fundo, cores.ouro, 0.07) : mistura(cores.fundo, [255, 255, 255], 0.5);
    const base = cores.escuro ? cores.fundo : mistura(cores.fundo, cores.ouro, 0.08);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, cor(top, 1)); gr.addColorStop(1, cor(base, 1));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  function brilhoMouse(forca) {
    if (!mouse.ativo) return; const r = 260; const gr = g.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, r);
    gr.addColorStop(0, cor(cores.ouro, (cores.escuro ? 0.16 : 0.12) * forca)); gr.addColorStop(1, cor(cores.ouro, 0)); g.fillStyle = gr; g.fillRect(mouse.x - r, mouse.y - r, r * 2, r * 2);
  }
  function desenharOndas(t) {
    const fx = cores.escuro ? 2.6 : 1.3; const passo = Math.max(6, Math.round(W / 140));
    const faixas = [{ y: 0.58, a: 0.07, f: 1.6, v: 0.22, n: 22, s: 1.5, al: 0.10 }, { y: 0.66, a: 0.09, f: 1.1, v: -0.16, n: 26, s: 1.8, al: 0.08 }, { y: 0.74, a: 0.05, f: 2.2, v: 0.3, n: 16, s: 2.2, al: 0.07 }];
    g.lineWidth = 1;
    faixas.forEach(function (fa, j) {
      for (let i = 0; i < fa.n; i++) {
        const k = i / fa.n; g.beginPath();
        for (let x = -passo; x <= W + passo; x += passo) {
          const u = x / W * Math.PI * 2;
          let y = H * fa.y + Math.sin(u * fa.f + t * fa.v + k * 1.3 + j) * H * fa.a * (1 + 0.35 * Math.sin(t * 0.21 + k * 3 + j)) + Math.sin(u * 0.6 - t * 0.12 + j) * H * 0.03 + (i - fa.n / 2) * fa.s;
          if (mouse.ativo) { const d = x - mouse.x; y += Math.exp(-d * d / (2 * 140 * 140)) * (mouse.y - y) * 0.18; }
          ondasClique.forEach(function (o) { const d = Math.hypot(x - o.x, y - o.y) - o.r; y += Math.exp(-d * d / 900) * 10 * o.vida; });
          if (x === -passo) g.moveTo(x, y); else g.lineTo(x, y);
        }
        const meio = i === Math.floor(fa.n / 2);
        if (meio) { g.save(); g.lineWidth = 26; g.strokeStyle = cor(cores.ouro, (cores.escuro ? 0.05 : 0.035)); g.stroke(); g.lineWidth = 9; g.strokeStyle = cor(cores.ouro, (cores.escuro ? 0.07 : 0.04)); g.stroke(); g.restore(); g.lineWidth = 1; }
        g.strokeStyle = cor(cores.ouro, Math.min(0.5, fa.al * fx * (0.35 + 0.65 * Math.sin(Math.PI * k)))); g.stroke();
      }
    });
    // faíscas subindo
    pontos.forEach(function (p) {
      mover(p, true); const pisca = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.6 + p.k) + p.f * 6));
      g.fillStyle = cor(cores.escuro ? [255, 236, 200] : cores.ouro, (cores.escuro ? 0.55 : 0.35) * pisca); g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    });
  }
  function desenharParticulas(t) {
    pontos.forEach(function (p) {
      mover(p, true); const a = (cores.escuro ? 0.10 : 0.08) * (0.5 + 0.5 * Math.sin(t * 0.4 + p.f * 6));
      const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); gr.addColorStop(0, cor(cores.ouro, a * 1.6)); gr.addColorStop(0.7, cor(cores.ouro, a * 0.6)); gr.addColorStop(1, cor(cores.ouro, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    });
  }
  function desenharConstelacao() {
    const lim = 130, al = cores.escuro ? 0.35 : 0.28;
    pontos.forEach(function (p) { mover(p, false); });
    for (let i = 0; i < pontos.length; i++) {
      const a = pontos[i];
      for (let j = i + 1; j < pontos.length; j++) { const b = pontos[j]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < lim) { g.strokeStyle = cor(cores.ouro, al * (1 - d / lim) * 0.6); g.lineWidth = 1; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); } }
      if (mouse.ativo) { const d = Math.hypot(a.x - mouse.x, a.y - mouse.y); if (d < 190) { g.strokeStyle = cor(cores.ouro, al * (1 - d / 190)); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(mouse.x, mouse.y); g.stroke(); } }
      g.fillStyle = cor(cores.ouro, al + 0.25); g.beginPath(); g.arc(a.x, a.y, a.r, 0, Math.PI * 2); g.fill();
    }
  }
  function desenharAurora(t) {
    g.globalCompositeOperation = cores.escuro ? 'lighter' : 'source-over';
    const tons = [cores.ouro, mistura(cores.ouro, [120, 70, 20], 0.5), mistura(cores.ouro, [255, 230, 170], 0.5), [70, 90, 120], mistura(cores.ouro, cores.fundo, 0.3)];
    pontos.forEach(function (p, i) {
      p.x += p.vx + Math.sin(t * 0.1 + i) * 0.2; p.y += p.vy + Math.cos(t * 0.08 + i) * 0.15;
      if (mouse.ativo && i === 0) { p.x += (mouse.x - p.x) * 0.02; p.y += (mouse.y - p.y) * 0.02; }
      if (p.x < -p.r * 0.5 || p.x > W + p.r * 0.5) p.vx *= -1; if (p.y < -p.r * 0.5 || p.y > H + p.r * 0.5) p.vy *= -1;
      const a = cores.escuro ? 0.09 : 0.10; const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      gr.addColorStop(0, cor(tons[i % tons.length], a)); gr.addColorStop(1, cor(tons[i % tons.length], 0)); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    });
    g.globalCompositeOperation = 'source-over';
  }
  // movimento comum: deriva, volta pelas bordas e foge do mouse
  function mover(p, sobe) {
    if (mouse.ativo) { const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy) || 1; if (d < 150) { const f = (150 - d) / 150 * 0.9; p.x += dx / d * f; p.y += dy / d * f; } }
    ondasClique.forEach(function (o) { const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 1; if (Math.abs(d - o.r) < 40) { p.x += dx / d * 2 * o.vida; p.y += dy / d * 2 * o.vida; } });
    p.x += p.vx; p.y += p.vy; const m = p.r + 4;
    if (sobe) { if (p.y < -m) { p.y = H + m; p.x = aleat(0, W); } if (p.y > H + m) p.y = -m; if (p.x < -m) p.x = W + m; if (p.x > W + m) p.x = -m; }
    else { if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; p.x = Math.max(0, Math.min(W, p.x)); p.y = Math.max(0, Math.min(H, p.y)); }
  }
  function aneis() {
    for (let i = ondasClique.length - 1; i >= 0; i--) {
      const o = ondasClique[i]; o.r += 6; o.vida -= 0.018; if (o.vida <= 0) { ondasClique.splice(i, 1); continue; }
      g.strokeStyle = cor(cores.ouro, 0.35 * o.vida); g.lineWidth = 2; g.beginPath(); g.arc(o.x, o.y, o.r, 0, Math.PI * 2); g.stroke();
    }
  }
  function desenhar(agora) {
    quadro = null; if (!cv || modo === 'nenhum') return;
    if (agora - ultimo < INTERVALO && !reduzir.matches) { quadro = requestAnimationFrame(desenhar); return; }
    ultimo = agora; const t = (agora - t0) / 1000;
    fundoBase();
    if (modo === 'ondas') { brilhoMouse(1); desenharOndas(t); }
    if (modo === 'particulas') { brilhoMouse(0.8); desenharParticulas(t); }
    if (modo === 'constelacao') { brilhoMouse(0.6); desenharConstelacao(); }
    if (modo === 'aurora') { desenharAurora(t); brilhoMouse(0.7); }
    aneis();
    if (!reduzir.matches && !document.hidden) quadro = requestAnimationFrame(desenhar);
  }
  function iniciar() { if (quadro) cancelAnimationFrame(quadro); quadro = null; if (modo !== 'nenhum') quadro = requestAnimationFrame(desenhar); }

  function aplicar() {
    const ligado = modo !== 'nenhum';
    document.documentElement.classList.toggle('com-fundo-animado', ligado);
    if (!ligado) { if (cv) { cv.remove(); cv = null; } if (quadro) cancelAnimationFrame(quadro); quadro = null; return; }
    if (!cv) { cv = document.createElement('canvas'); cv.id = 'fundo-animado'; cv.setAttribute('aria-hidden', 'true'); document.body.prepend(cv); g = cv.getContext('2d'); }
    lerCores(); medir(); iniciar();
  }

  window.addEventListener('resize', function () { if (cv) { medir(); if (reduzir.matches) iniciar(); } });
  window.addEventListener('pointermove', function (e) { mouse.vx = e.clientX - mouse.x; mouse.vy = e.clientY - mouse.y; mouse.x = e.clientX; mouse.y = e.clientY; mouse.ativo = true; }, { passive: true });
  document.addEventListener('pointerleave', function () { mouse.ativo = false; });
  window.addEventListener('blur', function () { mouse.ativo = false; });
  window.addEventListener('pointerdown', function (e) { if (cv && !reduzir.matches && ondasClique.length < 6) ondasClique.push({ x: e.clientX, y: e.clientY, r: 0, vida: 1 }); }, { passive: true });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && cv) iniciar(); });
  // tema trocado: novas cores
  new MutationObserver(function () { if (cv) { lerCores(); if (reduzir.matches) iniciar(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (cv) lerCores(); });

  self.Fundo = {
    opcoes: OPCOES,
    atual: function () { return modo; },
    definir: function (m) { if (!OPCOES.some(function (o) { return o.id === m; })) return; modo = m; try { localStorage.setItem(CHAVE, m); } catch (e) { /* sem armazenamento */ } aplicar(); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar); else aplicar();
})();
