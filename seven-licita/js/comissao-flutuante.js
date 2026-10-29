/* Seven Comissão em janela flutuante: abre de qualquer tela (botão % no topo ou Alt+M), pode ser arrastada e
   usa os mesmos valores da tela Seven Comissão. */
(function () {
  'use strict';
  const CHAVE = 'seven-comissao-janela';
  let jan = null;
  const T = function () { return Telas.comissao; };

  function lerPos() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } }
  function salvarPos(p) { try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch (e) { /* sem armazenamento */ } }
  function posicionar(p) {
    const w = jan.offsetWidth; const x = Math.max(8, Math.min(innerWidth - w - 8, p.x == null ? innerWidth - w - 340 : p.x)); const y = Math.max(8, Math.min(innerHeight - 48, p.y == null ? 84 : p.y));
    jan.style.left = x + 'px'; jan.style.top = y + 'px';
  }
  function atualizarResumo() { if (!jan) return; jan.querySelector('.cmf-res').innerHTML = T().resumo(Comissao.calcular(T().entrada()), true); }
  function desenharCampos() {
    const s = T().estado(); const f = jan.querySelector('.cmf-form');
    f.innerHTML = T().camposBase(s, true) + (s.usarCustos ? '<p class="mini mudo">Margem calculada pelos custos na tela completa.</p>' : '');
    if (s.usarCustos) f.elements.margem.disabled = true;
    atualizarResumo();
  }
  function criar() {
    jan = document.createElement('section'); jan.id = 'comissao-flutuante'; jan.className = 'cf cmf no-print'; jan.setAttribute('role', 'dialog'); jan.setAttribute('aria-label', 'Seven Comissão');
    jan.innerHTML = '<header class="cf-barra"><b>% Seven Comissão</b><span class="cf-dica">arraste para mover</span><button type="button" class="cf-b" data-cf="min" title="Minimizar" aria-label="Minimizar">–</button><a class="cf-b" href="#/comissao" title="Ver todos os cenários na Seven Comissão" aria-label="Abrir a Seven Comissão completa">⤢</a><button type="button" class="cf-b" data-cf="fechar" title="Fechar (Esc)" aria-label="Fechar">×</button></header>' +
      '<div class="cf-corpo"><form class="cmf-form" autocomplete="off"></form><div class="cmf-res" aria-live="polite"></div><a class="btn mini cmf-todos" href="#/comissao">Ver todos os cenários</a></div>';
    document.body.appendChild(jan);
    const p = lerPos(); if (p.min) jan.classList.add('min'); posicionar(p);
    const f = jan.querySelector('.cmf-form');
    f.oninput = f.onchange = function () { T().lerForm(f); atualizarResumo(); T().salvarDepois(); T().avisarMudanca('janela'); };
    f.onsubmit = function (ev) { ev.preventDefault(); };
    jan.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); fechar(); } });
    jan.addEventListener('click', function (ev) {
      const c = ev.target.closest('[data-cf]'); if (!c) return;
      if (c.dataset.cf === 'fechar') fechar();
      if (c.dataset.cf === 'min') { jan.classList.toggle('min'); const q = lerPos(); q.min = jan.classList.contains('min'); salvarPos(q); }
    });
    const barra = jan.querySelector('.cf-barra');
    barra.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.cf-b')) return; ev.preventDefault();
      const r = jan.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top; barra.setPointerCapture(ev.pointerId); jan.classList.add('arrastando');
      const mover = function (e) { posicionar({ x: e.clientX - dx, y: e.clientY - dy }); };
      const soltar = function () { barra.removeEventListener('pointermove', mover); barra.removeEventListener('pointerup', soltar); barra.removeEventListener('pointercancel', soltar); jan.classList.remove('arrastando'); const q = lerPos(); const r2 = jan.getBoundingClientRect(); q.x = Math.round(r2.left); q.y = Math.round(r2.top); salvarPos(q); };
      barra.addEventListener('pointermove', mover); barra.addEventListener('pointerup', soltar); barra.addEventListener('pointercancel', soltar);
    });
    desenharCampos();
  }
  function abrir(restaurar) {
    if (!jan) criar(); else desenharCampos();
    jan.hidden = false; const q = lerPos(); q.aberta = true; if (!restaurar) { q.min = false; jan.classList.remove('min'); } salvarPos(q); posicionar(q); marcar();
    if (!restaurar) { const i = jan.querySelector('[name=pct]'); if (i) i.focus(); }
  }
  function fechar() { if (!jan) return; jan.hidden = true; const q = lerPos(); q.aberta = false; salvarPos(q); marcar(); }
  function alternar() { if (jan && !jan.hidden) fechar(); else abrir(); }
  function marcar() { const b = document.getElementById('botao-comissao'); if (b) b.setAttribute('aria-pressed', String(!!(jan && !jan.hidden))); }

  // a tela completa mudou algo: atualiza a janela (sem atrapalhar quem está digitando nela)
  document.addEventListener('comissao:mudou', function (ev) { if (jan && !jan.hidden && ev.detail && ev.detail.origem !== 'janela' && !jan.contains(document.activeElement)) desenharCampos(); });
  document.addEventListener('keydown', function (ev) { if (ev.altKey && !ev.ctrlKey && !ev.metaKey && (ev.code === 'KeyM' || ev.key === 'm' || ev.key === 'M')) { ev.preventDefault(); alternar(); } });
  window.addEventListener('resize', function () { if (jan && !jan.hidden) posicionar(lerPos()); });
  function ligar() { const b = document.getElementById('botao-comissao'); if (b) b.addEventListener('click', alternar); if (lerPos().aberta) abrir(true); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();

  self.ComissaoFlutuante = { abrir: function () { abrir(); }, fechar: fechar, alternar: alternar, aberta: function () { return !!(jan && !jan.hidden); } };
})();
