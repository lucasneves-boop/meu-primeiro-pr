/* Seven Comissão em janela flutuante: abre de qualquer tela (botão % no topo ou Alt+M), pode ser arrastada e
   usa os mesmos valores da tela Seven Comissão. */
(function () {
  'use strict';
  const CHAVE = 'seven-comissao-janela';
  let jan = null;
  const T = function () { return Telas.comissao; };

  function atualizarResumo() { if (!jan) return; jan.querySelector('.cmf-res').innerHTML = T().resumo(Comissao.calcular(T().entrada()), true) + T().resumoExtra(T().extras(), true); }
  function desenharCampos() {
    const s = T().estado(); const f = jan.querySelector('.cmf-form');
    f.innerHTML = T().camposBase(s, true) + (s.usarCustos ? '<p class="mini mudo">Margem calculada pelos custos na tela completa.</p>' : '');
    if (s.usarCustos) f.elements.margem.disabled = true;
    atualizarResumo();
  }
  const J = Janela.criar({ id: 'comissao-flutuante', classe: 'cmf', titulo: '% Seven Comissão', rotulo: 'Seven Comissão', rota: '#/comissao', rotaTitulo: 'Abrir a Seven Comissão completa', chave: CHAVE, botao: 'botao-comissao', tecla: 'KeyM', deslocamento: 316,
    montar: function (corpo, api) {
      jan = api.el;
      corpo.innerHTML = '<form class="cmf-form" autocomplete="off"></form><div class="cmf-res" aria-live="polite"></div><a class="btn mini cmf-todos" href="#/comissao">Ver todos os cenários</a>';
      const f = corpo.querySelector('.cmf-form');
      f.oninput = f.onchange = function () { T().lerForm(f); atualizarResumo(); T().salvarDepois(); T().avisarMudanca('janela'); };
      f.onsubmit = function (ev) { ev.preventDefault(); };
    },
    aoAbrir: function (api, restaurar) { desenharCampos(); if (!restaurar) { const i = jan.querySelector('[name=pct]'); if (i) i.focus(); } } });

  // a tela completa mudou algo: atualiza a janela (sem atrapalhar quem está digitando nela)
  document.addEventListener('comissao:mudou', function (ev) { if (J.aberta() && ev.detail && ev.detail.origem !== 'janela' && !jan.contains(document.activeElement)) desenharCampos(); });

  self.ComissaoFlutuante = { abrir: function () { J.abrir(); }, fechar: J.fechar, alternar: J.alternar, aberta: J.aberta };
})();
