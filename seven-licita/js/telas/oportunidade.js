/* Anotações da oportunidade: uma só linha do tempo por licitação, que acompanha o edital
   do Seven Edital ao Seven Proposta, Seven Pregão, Seven Sessão e Seven Processo. A chave é o id do aviso (PNCP);
   sem aviso vinculado, a chave é o próprio registro (proposta, disputa, monitor). */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, dataHora, aviso, confirmar } = UI;
  const ETAPAS = { encontrar: 'Seven Edital', cadastrar: 'Seven Proposta', disputar: 'Seven Pregão', monitorar: 'Seven Sessão', quadros: 'Seven Processo', busca: 'Busca' };

  function e() { return Dados.e; }
  function loja() { e().notasOport = e().notasOport || {}; return e().notasOport; }

  // Traz as anotações antigas do aviso (aviso.anotacoes) para a linha do tempo, uma vez.
  function migrar(chave) {
    const av = e().avisos[chave];
    if (!av || !av.anotacoes || !av.anotacoes.length) return;
    const l = loja()[chave] = loja()[chave] || [];
    av.anotacoes.forEach(function (n) { l.push({ id: Dados.id('nt'), texto: n.texto, em: n.em, por: n.por, etapa: 'encontrar' }); });
    av.anotacoes = []; Dados.salvar();
  }
  function notas(chave) { if (!chave) return []; migrar(chave); return (loja()[chave] || []).slice().sort(function (a, b) { return String(b.em).localeCompare(String(a.em)); }); }
  function quantas(chave) { if (!chave) return 0; const av = e().avisos[chave]; return (loja()[chave] || []).length + (av && av.anotacoes ? av.anotacoes.length : 0); }
  function texto(chave) { return notas(chave).map(function (n) { return n.texto; }).join(' '); }

  function chaveProposta(p) { return p.avisoId || 'ppt:' + p.id; }
  function chaveDisputa(d) { const p = d.propostaId && e().propostas.find(function (x) { return x.id === d.propostaId; }); return p ? chaveProposta(p) : 'dsp:' + d.id; }
  function chaveMonitor(m) { return m.avisoId || 'mon:' + m.id; }

  function adicionar(chave, txt, etapa) {
    txt = String(txt || '').trim(); if (!chave || !txt) return null;
    const n = { id: Dados.id('nt'), texto: txt, em: new Date().toISOString(), por: e().config.responsavel || 'Equipe', etapa: etapa || '' };
    (loja()[chave] = loja()[chave] || []).push(n); Dados.salvar(); return n;
  }
  function remover(chave, id) { loja()[chave] = (loja()[chave] || []).filter(function (n) { return n.id !== id; }); Dados.salvar(); }

  function itens(chave) {
    const l = notas(chave);
    return l.length ? '<ul class="op-notas">' + l.map(function (n) {
      return '<li data-nt="' + esc(n.id) + '"><div class="op-meta"><b>' + esc(n.por || 'Equipe') + '</b><span>' + dataHora(n.em) + '</span>' + (n.etapa ? '<span class="tag claro">' + esc(ETAPAS[n.etapa] || n.etapa) + '</span>' : '') +
        '<button type="button" class="icone" data-op="apagar" aria-label="Apagar anotação" title="Apagar">×</button></div><p>' + esc(n.texto).replace(/\n/g, '<br>') + '</p></li>';
    }).join('') + '</ul>' : '<p class="mini mudo">Nenhuma anotação ainda. O que for anotado aqui aparece em todas as etapas desta licitação.</p>';
  }

  // Seção para as telas de detalhe (proposta, disputa, monitor, cartão).
  function secao(chave, etapa) {
    return '<section class="cartao op-secao" data-op-notas="' + esc(chave) + '" data-op-etapa="' + esc(etapa || '') + '"><header><h3>Anotações da oportunidade <span class="ma-n">' + quantas(chave) + '</span></h3></header>' +
      '<form class="op-form"><textarea name="texto" rows="2" placeholder="Anote decisões, conversas com o cliente, dúvidas do edital…" aria-label="Nova anotação"></textarea><button class="btn primario">Anotar</button></form>' +
      '<div class="op-lista">' + itens(chave) + '</div></section>';
  }

  // Janela (cartões de aviso e listas).
  function abrir(chave, titulo, etapa) {
    const fundo = document.createElement('div'); fundo.className = 'modal-fundo';
    fundo.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-label="Anotações"><header><h2>Anotações</h2><button type="button" class="icone" data-op="fechar" aria-label="Fechar">×</button></header>' +
      '<div class="modal-corpo">' + (titulo ? '<p class="mini mudo">' + esc(titulo) + '</p>' : '') + secao(chave, etapa).replace('class="cartao op-secao"', 'class="op-secao"') + '</div></div>';
    document.body.appendChild(fundo);
    const fechar = function () { fundo.remove(); document.removeEventListener('keydown', tecla); App.redesenhar(); };
    const tecla = function (ev) { if (ev.key === 'Escape') fechar(); };
    document.addEventListener('keydown', tecla);
    fundo.addEventListener('mousedown', function (ev) { if (ev.target === fundo) fechar(); });
    fundo.addEventListener('click', function (ev) { if (ev.target.closest('[data-op=fechar]')) fechar(); });
    const t = fundo.querySelector('textarea'); if (t) t.focus();
  }

  function atualizar(sec) {
    const chave = sec.dataset.opNotas;
    sec.querySelector('.op-lista').innerHTML = itens(chave);
    const n = sec.querySelector('h3 .ma-n'); if (n) n.textContent = quantas(chave);
  }
  document.addEventListener('submit', function (ev) {
    const f = ev.target.closest('.op-form'); if (!f) return;
    ev.preventDefault(); const sec = f.closest('[data-op-notas]');
    if (adicionar(sec.dataset.opNotas, f.texto.value, sec.dataset.opEtapa)) { f.texto.value = ''; atualizar(sec); aviso('Anotação salva.'); }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && ev.target.closest && ev.target.closest('.op-form')) { ev.preventDefault(); ev.target.closest('.op-form').requestSubmit(); }
  });
  document.addEventListener('click', function (ev) {
    const b = ev.target.closest('[data-op-abrir]'); if (!b) return;
    const av = e().avisos[b.dataset.opAbrir]; abrir(b.dataset.opAbrir, av ? av.objeto : '', 'quadros');
  });
  document.addEventListener('click', async function (ev) {
    const b = ev.target.closest('[data-op=apagar]'); if (!b) return;
    const sec = b.closest('[data-op-notas]'); const li = b.closest('[data-nt]');
    if (!(await confirmar('Apagar anotação', 'Apagar esta anotação? Ela some de todas as etapas da licitação.', 'Apagar'))) return;
    remover(sec.dataset.opNotas, li.dataset.nt); atualizar(sec);
  });

  Telas.oport = { notas: notas, quantas: quantas, texto: texto, adicionar: adicionar, remover: remover, secao: secao, abrir: abrir, chaveProposta: chaveProposta, chaveDisputa: chaveDisputa, chaveMonitor: chaveMonitor };
})();
