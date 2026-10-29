/* Preferências da plataforma (Configurações): aparência, menu, tela inicial, janelas flutuantes, atalhos,
   assinatura das mensagens, formatos e lembrete de backup. Ficam em Dados.e.config.pref e vão no backup. */
(function () {
  'use strict';
  const PADRAO = {
    destaque: 'ouro', escala: 100, densidade: 'normal', animacoes: true, bordas: 'arredondadas',
    menuOculto: [], menuRecolhidoAoAbrir: false, telaInicial: 'painel', descricoes: true,
    botoesTopo: { calc: true, comissao: true, not: true, agenda: true, chat: true, ia: true }, atalhos: true,
    assinatura: 'Lucas Neves | Seven', telefone: '(61) 98347-2232', horario: 'seg a sex 9h–18h, sáb até 12h', email: '',
    lembreteBackup: 7, avisosSegundos: 4
  };
  const DESTAQUES = { ouro: ['Dourado Seven', '#b68d40', '#f8efdc', '#2a2112'], azul: ['Azul', '#2f6fd6', '#e3edfc', '#13233d'], verde: ['Verde', '#1f8a5b', '#dff3ea', '#10291e'], vinho: ['Vinho', '#9b2c4a', '#f7e1e7', '#2e121a'], roxo: ['Roxo', '#6e4bd8', '#ebe5fb', '#1f1638'], grafite: ['Grafite', '#5b6573', '#e9ecef', '#1d2127'] };
  const BOTOES = { calc: 'botao-calc', comissao: 'botao-comissao', not: 'botao-not', agenda: 'botao-agenda', chat: 'botao-chat', ia: 'botao-ia' };

  function obter() {
    const c = Dados.e.config = Dados.e.config || {}; const p = c.pref = c.pref || {};
    Object.keys(PADRAO).forEach(function (k) { if (p[k] === undefined) p[k] = JSON.parse(JSON.stringify(PADRAO[k])); });
    Object.keys(PADRAO.botoesTopo).forEach(function (k) { if (p.botoesTopo[k] === undefined) p.botoesTopo[k] = true; });
    if (!Array.isArray(p.menuOculto)) p.menuOculto = [];
    return p;
  }
  function definir(k, v) { obter()[k] = v; Dados.salvar(); aplicar(); }

  function aplicar() {
    const p = obter(); const html = document.documentElement; const st = html.style;
    const d = DESTAQUES[p.destaque] || DESTAQUES.ouro;
    if (p.destaque && p.destaque !== 'ouro') { st.setProperty('--ouro', d[1]); st.setProperty('--marca', d[1]); html.dataset.destaque = p.destaque; }
    else { st.removeProperty('--ouro'); st.removeProperty('--marca'); delete html.dataset.destaque; }
    const z = Math.max(80, Math.min(130, Number(p.escala) || 100)); if (z === 100) st.removeProperty('zoom'); else st.setProperty('zoom', String(z / 100));
    html.classList.toggle('densidade-compacta', p.densidade === 'compacta'); html.classList.toggle('densidade-ampla', p.densidade === 'ampla');
    html.classList.toggle('sem-animacao', p.animacoes === false); html.classList.toggle('bordas-retas', p.bordas === 'retas');
    html.classList.toggle('sem-descricoes', p.descricoes === false);
    document.querySelectorAll('.menu a[data-rota]').forEach(function (a) { a.hidden = p.menuOculto.indexOf(a.dataset.rota) >= 0 && a.dataset.rota !== 'config'; });
    // grupo do menu sem nenhum item visível some junto
    document.querySelectorAll('.menu p.grupo').forEach(function (g) { let n = g.nextElementSibling, vis = false; while (n && !n.matches('p.grupo')) { if (n.matches('a[data-rota]') && !n.hidden) vis = true; n = n.nextElementSibling; } g.hidden = !vis; });
    Object.keys(BOTOES).forEach(function (k) { const b = document.getElementById(BOTOES[k]); if (b) b.hidden = p.botoesTopo[k] === false; });
  }

  // usados pelas mensagens a clientes (WhatsApp, e-mail) e pelos relatórios
  function assinatura() { return obter().assinatura || PADRAO.assinatura; }
  function telefone() { return obter().telefone || PADRAO.telefone; }
  function rodape() { const p = obter(); return [assinatura(), telefone(), p.email].filter(Boolean).join('\n'); }
  function telaInicial() { const t = obter().telaInicial; return t && Telas[t] ? t : 'painel'; }

  // lembrete de backup ao abrir (a cada N dias sem exportar)
  function lembrarBackup() {
    const p = obter(); const n = Number(p.lembreteBackup) || 0; if (!n) return;
    const ult = Dados.e.config.ultimoBackup ? new Date(Dados.e.config.ultimoBackup).getTime() : 0; const temDados = (Dados.e.empresas || []).length || (Dados.e.quadros || []).some(function (q) { return (q.cartoes || []).length; });
    if (temDados && Date.now() - ult > n * 864e5) setTimeout(function () { UI.aviso(ult ? 'Seu último backup foi há ' + Math.floor((Date.now() - ult) / 864e5) + ' dias. Exporte em Configurações › Backup.' : 'Você ainda não exportou um backup. Faça em Configurações › Backup.'); }, 2500);
  }

  self.Pref = { obter: obter, definir: definir, aplicar: aplicar, assinatura: assinatura, telefone: telefone, rodape: rodape, telaInicial: telaInicial, PADRAO: PADRAO, DESTAQUES: DESTAQUES, atalhos: function () { return obter().atalhos !== false; } };
  const iniciar = function () { aplicar(); lembrarBackup(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
