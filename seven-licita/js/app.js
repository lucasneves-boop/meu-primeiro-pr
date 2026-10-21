/* Seven Licita — roteador e casca. */
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
    document.title = tela.titulo + ' · Seven Licita';
    preencherEmpresas();
    const el = $('#conteudo');
    el.onclick = el.onchange = el.oninput = el.onkeydown = el.ondblclick = el.onfocusout = el.onsubmit = null;
    if (r.tela === 'mercado' && (r.sub === 'capag')) $$('.menu a').forEach(function (a) { a.classList.toggle('ativo', a.dataset.rota === 'capag'); });
    try { tela.render(el, r.sub, r.param); }
    catch (e) { console.error(e); el.innerHTML = '<div class="vazio"><h3>Erro ao abrir a tela</h3><p>' + esc(e.message) + '</p></div>'; }
    document.body.classList.remove('menu-aberto');
    $('#abrir-menu').setAttribute('aria-expanded', 'false');
  }

  self.App = { redesenhar: desenhar, rota: rotaAtual };

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
