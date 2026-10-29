/* Janelas flutuantes da plataforma (Calculadora, Comissão, Not, IA, Chat, Agenda): mesma moldura para todas.
   Abrem de qualquer tela pelo botão do topo ou pelo atalho Alt+tecla, podem ser arrastadas e minimizadas,
   lembram posição e estado ao recarregar e usam os mesmos dados da tela completa de cada ferramenta. */
(function () {
  'use strict';
  const todas = [];
  let topo = 950;

  // o: { id, classe, titulo, rotulo, rota, rotaTitulo, chave, botao, tecla ('KeyN'), dica, montar(corpo, api), aoAbrir(api, restaurar), aoFechar(api), aoMinimizar(api, min), escFecha }
  function criar(o) {
    const api = { el: null, corpo: null, o: o };
    const lerPos = function () { try { return JSON.parse(localStorage.getItem(o.chave)) || {}; } catch (e) { return {}; } };
    const salvarPos = function (p) { try { localStorage.setItem(o.chave, JSON.stringify(p)); } catch (e) { /* sem armazenamento */ } };
    function posicionar(p) {
      const jan = api.el; const w = jan.offsetWidth; const k = todas.indexOf(api);
      const x = Math.max(8, Math.min(innerWidth - w - 8, p.x == null ? innerWidth - w - 24 - (o.deslocamento || 0) - k * 18 : p.x));
      const y = Math.max(8, Math.min(innerHeight - 48, p.y == null ? 84 + k * 18 : p.y));
      jan.style.left = x + 'px'; jan.style.top = y + 'px'; return { x: x, y: y };
    }
    function frente() { if (api.el) api.el.style.zIndex = String(++topo); }
    function montar() {
      const jan = api.el = document.createElement('section'); jan.id = o.id; jan.className = 'cf no-print ' + (o.classe || ''); jan.setAttribute('role', 'dialog'); jan.setAttribute('aria-label', o.rotulo || o.titulo);
      jan.innerHTML = '<header class="cf-barra"><b>' + o.titulo + '</b><span class="cf-dica">' + (o.dica || 'arraste para mover') + '</span>' +
        '<button type="button" class="cf-b" data-cf="min" title="Minimizar" aria-label="Minimizar">–</button>' +
        (o.rota ? '<a class="cf-b" href="' + o.rota + '" data-cf="completa" title="' + UI.esc(o.rotaTitulo || 'Abrir a tela completa') + '" aria-label="' + UI.esc(o.rotaTitulo || 'Abrir a tela completa') + '">⤢</a>' : '') +
        '<button type="button" class="cf-b" data-cf="fechar" title="Fechar (Esc)" aria-label="Fechar">×</button></header><div class="cf-corpo"></div>';
      document.body.appendChild(jan); api.corpo = jan.querySelector('.cf-corpo');
      const p = lerPos(); if (p.min) jan.classList.add('min'); posicionar(p); frente();
      jan.addEventListener('pointerdown', frente, true);
      jan.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !ev.defaultPrevented && o.escFecha !== false) { ev.preventDefault(); fechar(); } });
      jan.querySelector('.cf-barra').addEventListener('click', function (ev) {
        const c = ev.target.closest('[data-cf]'); if (!c) return;
        if (c.dataset.cf === 'fechar') fechar();
        if (c.dataset.cf === 'min') { jan.classList.toggle('min'); const q = lerPos(); q.min = jan.classList.contains('min'); salvarPos(q); c.title = q.min ? 'Expandir' : 'Minimizar'; if (o.aoMinimizar) o.aoMinimizar(api, q.min); }
      });
      const barra = jan.querySelector('.cf-barra');
      barra.addEventListener('pointerdown', function (ev) {
        if (ev.target.closest('.cf-b')) return; ev.preventDefault();
        const r = jan.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top; barra.setPointerCapture(ev.pointerId); jan.classList.add('arrastando');
        const mover = function (e) { posicionar({ x: e.clientX - dx, y: e.clientY - dy }); };
        const soltar = function () { barra.removeEventListener('pointermove', mover); barra.removeEventListener('pointerup', soltar); barra.removeEventListener('pointercancel', soltar); jan.classList.remove('arrastando'); const q = lerPos(); const r2 = jan.getBoundingClientRect(); q.x = Math.round(r2.left); q.y = Math.round(r2.top); salvarPos(q); };
        barra.addEventListener('pointermove', mover); barra.addEventListener('pointerup', soltar); barra.addEventListener('pointercancel', soltar);
      });
      if (o.montar) o.montar(api.corpo, api);
    }
    function marcar() { const b = o.botao && document.getElementById(o.botao); if (b) b.setAttribute('aria-pressed', String(aberta())); }
    function aberta() { return !!(api.el && !api.el.hidden); }
    function abrir(restaurar) {
      const nova = !api.el; if (nova) montar();
      api.el.hidden = false; const q = lerPos(); q.aberta = true; if (!restaurar) { q.min = false; api.el.classList.remove('min'); } salvarPos(q); posicionar(q); frente(); marcar();
      if (o.aoAbrir) o.aoAbrir(api, !!restaurar, nova);
    }
    function fechar() { if (!api.el) return; api.el.hidden = true; const q = lerPos(); q.aberta = false; salvarPos(q); marcar(); if (o.aoFechar) o.aoFechar(api); }
    function alternar() { if (aberta()) fechar(); else abrir(); }
    Object.assign(api, { abrir: function (r) { abrir(r); }, fechar: fechar, alternar: alternar, aberta: aberta, posicionar: function () { if (api.el) posicionar(lerPos()); } });
    todas.push(api);
    if (o.tecla) document.addEventListener('keydown', function (ev) { if (ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && ev.code === o.tecla && !(self.Pref && !Pref.atalhos())) { ev.preventDefault(); alternar(); } });
    const ligar = function () { const b = o.botao && document.getElementById(o.botao); if (b) b.addEventListener('click', alternar); if (lerPos().aberta) abrir(true); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else setTimeout(ligar, 0);
    return api;
  }

  window.addEventListener('resize', function () { todas.forEach(function (j) { if (j.aberta()) j.posicionar(); }); });
  // atualiza as janelas abertas quando os dados mudam em outra tela (sem atrapalhar quem está digitando nelas)
  let agendado = null;
  function aoMudarDados() { clearTimeout(agendado); agendado = setTimeout(function () { todas.forEach(function (j) { if (j.aberta() && j.o.atualizar && !j.el.contains(document.activeElement)) j.o.atualizar(j); }); }, 60); }
  function ligarDados() { if (self.Dados && Dados.aoMudar) Dados.aoMudar(aoMudarDados); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligarDados); else ligarDados();

  self.Janela = { criar: criar, todas: todas };
})();
