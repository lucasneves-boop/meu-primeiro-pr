/* Plataforma 7 — roteador e casca. */
(function () {
  'use strict';
  const { $, $$, esc } = UI;

  function rotaAtual() {
    const partes = (location.hash.replace(/^#\/?/, '') || 'painel').split('/');
    return { tela: partes[0] || 'painel', sub: partes[1] || '', param: decodeURIComponent(partes.slice(2).join('/')) };
  }

  function preencherEmpresas() {
    const sel = $('#empresa-ativa'); const e = Dados.e;
    const ativa = Dados.empresaAtiva();
    sel.innerHTML = e.empresas.length
      ? e.empresas.map(function (x) { return '<option value="' + x.id + '"' + (ativa && ativa.id === x.id ? ' selected' : '') + '>' + esc(x.fantasia || x.razao) + '</option>'; }).join('')
      : '<option value="">Cadastre um cliente</option>';
  }

  function desenhar() {
    const r = rotaAtual();
    const tela = Telas[r.tela] || Telas.painel;
    $$('.menu a').forEach(function (a) { a.classList.toggle('ativo', a.dataset.rota === r.tela); a.setAttribute('aria-current', a.dataset.rota === r.tela ? 'page' : 'false'); });
    $('#titulo-tela').textContent = tela.titulo;
    document.title = tela.titulo + ' · Plataforma 7';
    preencherEmpresas();
    const el = $('#conteudo');
    el.onclick = el.onchange = el.oninput = el.onkeydown = el.ondblclick = el.onfocusout = el.onsubmit = null;
    if (r.tela === 'mercado' && (r.sub === 'capag')) $$('.menu a').forEach(function (a) { a.classList.toggle('ativo', a.dataset.rota === 'capag'); });
    try { tela.render(el, r.sub, r.param); }
    catch (e) { console.error(e); el.innerHTML = '<div class="vazio"><h3>Erro ao abrir a tela</h3><p>' + esc(e.message) + '</p></div>'; }
    document.body.classList.remove('menu-aberto');
    if (r.tela !== 'notas') { const aj = document.getElementById('nf-ajuda'); if (aj) aj.remove(); document.body.classList.remove('com-ajuda-nf'); }
    $('#abrir-menu').setAttribute('aria-expanded', 'false');
  }

  // ---------- tema: automático (segue o sistema), claro ou escuro ----------
  const TEMAS = { auto: { ic: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>', t: 'Tema automático (segue o sistema)' }, claro: { ic: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g></svg>', t: 'Tema claro' }, escuro: { ic: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor"/></svg>', t: 'Tema escuro' }, dourado: { ic: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2l2.6 6.2 6.7.6-5.1 4.4 1.6 6.6L12 16.3 6.2 19.8l1.6-6.6L2.7 8.8l6.7-.6z" fill="#c9a25a" stroke="#050505" stroke-width="1"/></svg>', t: 'Tema dourado e preto' } };
  function temaSalvo() { try { const t = localStorage.getItem('seven-tema'); return TEMAS[t] ? t : 'auto'; } catch (e) { return 'auto'; } }
  function aplicarTema(t) {
    t = TEMAS[t] ? t : 'auto';
    try { if (t === 'auto') localStorage.removeItem('seven-tema'); else localStorage.setItem('seven-tema', t); } catch (e) { /* navegador sem armazenamento: vale só nesta visita */ }
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', { claro: 'light', escuro: 'dark', dourado: 'gold' }[t]);
    const escuro = t === 'escuro' || t === 'dourado' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.setAttribute('content', escuro ? '#050505' : '#f6f5f2');
    const b = $('#botao-tema'); if (b) { b.innerHTML = TEMAS[t].ic; b.title = TEMAS[t].t + ' · clique para trocar'; b.setAttribute('aria-label', TEMAS[t].t + '. Trocar tema'); }
    temaAtual = t;
  }
  let temaAtual = temaSalvo();
  $('#botao-tema').addEventListener('click', function () { aplicarTema({ auto: 'claro', claro: 'escuro', escuro: 'dourado', dourado: 'auto' }[temaAtual]); UI.aviso(TEMAS[temaAtual].t + '.'); });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (temaAtual === 'auto') aplicarTema('auto'); });
  aplicarTema(temaAtual);

  self.App = { redesenhar: desenhar, rota: rotaAtual, tema: function (t) { if (t) aplicarTema(t); return temaAtual; }, iconeTema: function (t) { return TEMAS[t].ic; } };

  window.addEventListener('hashchange', function () { desenhar(); $('#conteudo').focus({ preventScroll: true }); window.scrollTo(0, 0); });
  $('#empresa-ativa').addEventListener('change', function () { Dados.e.empresaAtiva = this.value; Dados.salvar(); desenhar(); });
  $('#abrir-menu').addEventListener('click', function () {
    const aberto = document.body.classList.toggle('menu-aberto');
    this.setAttribute('aria-expanded', String(aberto));
  });

  Dados.limparAvisosAntigos();
  desenhar();
  setTimeout(function () { Telas.encontrar.capturaAutomatica(); }, 1500);
})();
