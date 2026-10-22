/* Autoconhecimento: Big Five (IPIP-50), estilo DISC, temperamento e prática de raciocínio, por pessoa e por equipe. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, modal, confirmar, aviso } = UI;
  const P = self.Perfil;
  const ESCALA = ['Discordo totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo totalmente'];
  const est = { r: {}, pag: 0, disc: {}, prova: null, resp: [], ini: 0, timer: null };

  function e() { const d = Dados.e; d.perfil = d.perfil || {}; const p = d.perfil; p.pessoas = p.pessoas || []; p.resultados = p.resultados || []; if (!p.pessoas.length) { p.pessoas.push({ id: 'pf-eu', nome: (Dados.e.config && Dados.e.config.responsavel) || 'Eu' }); p.atual = 'pf-eu'; } return p; }
  function pessoa() { const p = e(); return p.pessoas.find(function (x) { return x.id === p.atual; }) || p.pessoas[0]; }
  function ultimo(pid, tipo) { return e().resultados.filter(function (r) { return r.pessoa === pid && r.tipo === tipo; }).sort(function (a, b) { return b.em - a.em; })[0] || null; }
  function salvarRes(tipo, dados) { e().resultados.push({ id: Dados.id('pfr'), pessoa: pessoa().id, tipo: tipo, em: Date.now(), dados: dados }); Dados.salvar(); }
  function data(ts) { return new Date(ts).toLocaleDateString('pt-BR'); }

  function radar(b5, tam) {
    tam = tam || 260; const c = tam / 2, R = tam / 2 - 46; const ks = ['E', 'A', 'C', 'N', 'O'];
    const pt = function (i, v) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v]; };
    const anel = function (v) { return ks.map(function (_, i) { return pt(i, v).join(','); }).join(' '); };
    return '<svg class="pf-radar" viewBox="0 0 ' + tam + ' ' + tam + '" role="img" aria-label="Gráfico do Big Five">' + [0.25, 0.5, 0.75, 1].map(function (v) { return '<polygon points="' + anel(v) + '" class="pf-anel"/>'; }).join('') +
      ks.map(function (k, i) { const p = pt(i, 1); const l = pt(i, 1.24); return '<line x1="' + c + '" y1="' + c + '" x2="' + p[0] + '" y2="' + p[1] + '" class="pf-eixo"/><text x="' + l[0] + '" y="' + l[1] + '" text-anchor="middle" dominant-baseline="middle" class="pf-rot">' + P.FATORES[k].t.split(' ')[0] + '</text>'; }).join('') +
      '<polygon points="' + ks.map(function (k, i) { return pt(i, (b5[k] || 0) / 100).join(','); }).join(' ') + '" class="pf-area"/>' + ks.map(function (k, i) { const p = pt(i, (b5[k] || 0) / 100); return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" class="pf-ponto"/>'; }).join('') + '</svg>';
  }
  function barrasDisc(r) { return '<div class="pf-disc-b">' + P.ORDEM.map(function (k) { return '<div class="pf-db' + (k === r.primario ? ' prim' : '') + '"><b>' + k + '</b><span><i style="width:' + r.pct[k] + '%"></i></span><small>' + P.DISC[k].t + ' · ' + r.pct[k] + '%</small></div>'; }).join('') + '</div>'; }

  // ---------- início ----------
  function telaInicio(el) {
    const p = e(); const eu = pessoa();
    const b5 = ultimo(eu.id, 'big5'), dc = ultimo(eu.id, 'disc'), rc = e().resultados.filter(function (r) { return r.pessoa === eu.id && r.tipo === 'raciocinio'; }).sort(function (a, b) { return a.em - b.em; });
    const tp = b5 ? P.temperamento(b5.dados) : null;
    const perfis = p.pessoas.map(function (x) { const b = ultimo(x.id, 'big5'), d = ultimo(x.id, 'disc'); return { nome: x.nome, big5: b && b.dados, disc: d && d.dados }; });
    const eq = P.equipe(perfis);
    el.innerHTML = '<div class="pf"><header class="pf-topo"><div><h1>Autoconhecimento</h1><p class="mudo">Entenda como você e a equipe trabalham melhor. Resultados para reflexão e desenvolvimento, não para rotular ou selecionar pessoas.</p></div>' +
      '<label class="pf-pessoa">Pessoa <select id="pf-pessoa">' + p.pessoas.map(function (x) { return '<option value="' + x.id + '"' + (x.id === eu.id ? ' selected' : '') + '>' + esc(x.nome) + '</option>'; }).join('') + '</select><button class="btn mini" data-a="add-pessoa">＋</button><button class="btn mini fantasma" data-a="renomear">Renomear</button></label></header>' +
      '<div class="pf-cards">' +
      cartao('big5', '🧭', 'Big Five', 'O modelo de personalidade com mais evidência científica. 50 afirmações (IPIP), cerca de 8 minutos.', b5 ? 'Feito em ' + data(b5.em) : '') +
      cartao('disc', '🎯', 'Estilo DISC', 'Como você tende a agir no trabalho: Dominância, Influência, Estabilidade, Conformidade. 24 grupos, cerca de 6 minutos.', dc ? 'Feito em ' + data(dc.em) : '') +
      cartao('raciocinio', '🧩', 'Prática de raciocínio', 'Sequências numéricas e analogias, 12 questões em até 12 minutos. Para treinar e acompanhar sua evolução.', rc.length ? rc.length + ' tentativa(s) · melhor: ' + Math.max.apply(null, rc.map(function (r) { return r.dados.pct; })) + '%' : '') + '</div>' +
      (b5 || dc ? '<section class="pf-perfil"><h2>Perfil de ' + esc(eu.nome) + '</h2><div class="pf-grade">' +
        (b5 ? '<div class="cartao"><h3>Big Five</h3>' + radar(b5.dados) + '<ul class="pf-fat">' + Object.keys(P.FATORES).map(function (k) { const v = b5.dados[k]; return '<li><b>' + P.FATORES[k].t + '</b> <span class="pf-fx ' + P.faixa(v) + '">' + P.faixa(v) + ' (' + v + ')</span><small>' + esc(v >= 50 ? P.FATORES[k].alto : P.FATORES[k].baixo) + '</small></li>'; }).join('') + '</ul><p class="mini mudo">Pontos de 0 a 100 dentro da própria escala, não percentis da população.</p></div>' : '') +
        (dc ? '<div class="cartao"><h3>Estilo DISC: ' + dc.dados.primario + (dc.dados.secundario ? '/' + dc.dados.secundario : '') + '</h3>' + barrasDisc(dc.dados) + '<p><b>' + P.DISC[dc.dados.primario].t + ':</b> ' + esc(P.DISC[dc.dados.primario].d) + '</p><p><b>Como se comunicar:</b> ' + esc(P.DISC[dc.dados.primario].comunicar) + '</p><p><b>Na licitação:</b> ' + esc(P.DISC[dc.dados.primario].licitacao) + '</p></div>' : '') +
        (tp ? '<div class="cartao pf-temp"><h3>Temperamento: ' + tp.t + '</h3><p>' + esc(tp.d) + '</p><p><b>Onde rende mais:</b> ' + esc(tp.forca) + '</p><p><b>Atenção a:</b> ' + esc(tp.cuidado) + '</p><p class="mini mudo">Derivado do Big Five (Extroversão × Estabilidade emocional), como na releitura de Eysenck dos quatro temperamentos clássicos. A teoria dos humores de Hipócrates e Galeno não tem base biológica; use como lente intuitiva.</p></div>' : '') +
        (rc.length ? '<div class="cartao"><h3>Raciocínio: evolução</h3><div class="pf-evol">' + rc.slice(-10).map(function (r) { return '<div><i style="height:' + r.dados.pct + '%" title="' + data(r.em) + ': ' + r.dados.pct + '%"></i><small>' + r.dados.pct + '</small></div>'; }).join('') + '</div><p class="mini mudo">Compare com você mesmo, não com outras pessoas.</p></div>' : '') +
        '</div></section>' : '') +
      (p.pessoas.length > 1 ? '<section class="cartao pf-eq"><h2>Equipe</h2><table class="tabela"><thead><tr><th>Pessoa</th>' + Object.keys(P.FATORES).map(function (k) { return '<th title="' + P.FATORES[k].t + '">' + P.FATORES[k].t.split(' ')[0] + '</th>'; }).join('') + '<th>DISC</th><th>Temperamento</th></tr></thead><tbody>' + perfis.map(function (x) { const t = x.big5 ? P.temperamento(x.big5) : null; return '<tr><td>' + esc(x.nome) + '</td>' + Object.keys(P.FATORES).map(function (k) { return '<td>' + (x.big5 ? x.big5[k] : '—') + '</td>'; }).join('') + '<td>' + (x.disc ? x.disc.primario + (x.disc.secundario ? '/' + x.disc.secundario : '') : '—') + '</td><td>' + (t ? t.t : '—') + '</td></tr>'; }).join('') + '</tbody></table>' + (eq.faltam.length ? '<p class="mini">Estilos DISC sem representante na equipe: <b>' + eq.faltam.map(function (k) { return P.DISC[k].t; }).join(', ') + '</b>. Vale combinar quem cobre essas frentes (' + eq.faltam.map(function (k) { return P.DISC[k].licitacao.split(';')[0].toLowerCase(); }).join(' / ') + ').</p>' : '') + '</section>' : '') +
      '<section class="cartao pf-ciencia"><h3>O que estes testes podem e não podem dizer</h3><ul>' +
      '<li><b>Big Five</b> é o modelo de personalidade mais testado. Os 50 itens usados aqui são os marcadores do IPIP, de domínio público (Goldberg). Conscienciosidade é o traço que mais aparece associado a desempenho no trabalho em meta-análises (Barrick e Mount, 1991). <a href="https://www.cmu.edu/common-cold-project/measures-by-study/psychological-and-social-constructs/personality-measures/big-five-personality-factors.html" target="_blank" rel="noopener">IPIP ↗</a> · <a href="https://iro.uiowa.edu/esploro/outputs/journalArticle/THE-BIG-FIVE-PERSONALITY-DIMENSIONS-AND/9984963115202771" target="_blank" rel="noopener">Barrick e Mount ↗</a></li>' +
      '<li><b>DISC</b> vem da teoria de Marston (1928); os questionários comerciais têm boa consistência, mas a validade para prever desempenho é debatida. Os itens daqui são próprios e servem para conversar sobre estilo, não para decidir contratação. <a href="https://wikipedia.com/wiki/DiSC" target="_blank" rel="noopener">Sobre o DISC ↗</a></li>' +
      '<li><b>Temperamentos</b> são uma tradição histórica; a base nos humores foi abandonada. A leitura moderna os aproxima de Extroversão e Estabilidade emocional. <a href="https://en.wikipedia.org/wiki/Four_temperaments" target="_blank" rel="noopener">Quatro temperamentos ↗</a></li>' +
      '<li><b>QI</b> só é medido com teste padronizado, com normas e aplicação supervisionada por psicólogo (por exemplo, a escala WAIS). Testes curtos online não estimam QI de forma confiável; por isso aqui não há número de QI, só a sua evolução no treino. Para pesquisa, existe o banco público ICAR. <a href="https://www.psychometrics.cam.ac.uk/research/the-international-cognitive-ability-resource-icar" target="_blank" rel="noopener">ICAR ↗</a></li></ul></section></div>';
    el.querySelector('#pf-pessoa').onchange = function () { e().atual = this.value; Dados.salvar(); App.redesenhar(); };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'add-pessoa' || b.dataset.a === 'renomear') { const ren = b.dataset.a === 'renomear'; const r = await modal({ titulo: ren ? 'Renomear' : 'Adicionar pessoa da equipe', corpo: campo('Nome', '<input name="n" required value="' + (ren ? esc(pessoa().nome) : '') + '">') + (ren ? '' : '<p class="mini mudo">Peça autorização antes de registrar resultados de outra pessoa; eles ficam só neste navegador.</p>') }); if (!r) return; if (ren) pessoa().nome = r.get('n').trim(); else { const id = Dados.id('pf'); e().pessoas.push({ id: id, nome: r.get('n').trim() }); e().atual = id; } Dados.salvar(); App.redesenhar(); }
      if (b.dataset.a === 'apagar') { const tipo = b.dataset.t; if (await confirmar('Apagar resultados', 'Apagar os resultados de ' + esc(tipo) + ' de ' + esc(pessoa().nome) + '?', 'Apagar')) { e().resultados = e().resultados.filter(function (r) { return !(r.pessoa === pessoa().id && r.tipo === tipo); }); Dados.salvar(); App.redesenhar(); } }
    };
  }
  function cartao(k, ic, t, d, st) { return '<div class="pf-card"><span>' + ic + '</span><b>' + t + '</b><p>' + d + '</p><small>' + (st || 'Ainda não feito') + '</small><div class="grupo-botoes"><a class="btn ' + (st ? 'fantasma' : 'primario') + ' mini" href="#/perfil/' + k + '">' + (st ? 'Refazer' : 'Começar') + '</a>' + (st ? '<button class="btn mini fantasma" data-a="apagar" data-t="' + k + '">Apagar</button>' : '') + '</div></div>'; }

  // ---------- Big Five ----------
  function telaBig5(el) {
    const POR = 10; const tot = P.IPIP.length; const ini = est.pag * POR;
    const feito = P.completo(est.r, tot);
    el.innerHTML = '<div class="pf-teste"><header><a class="btn mini fantasma" href="#/perfil">← Voltar</a><h2>Big Five · ' + esc(pessoa().nome) + '</h2><span class="mini mudo">' + feito + ' de ' + tot + '</span></header><div class="pf-prog"><i style="width:' + feito / tot * 100 + '%"></i></div>' +
      '<p class="mudo">Responda como você é hoje, não como gostaria de ser. Não há respostas certas.</p><form id="pf-f">' + P.IPIP.slice(ini, ini + POR).map(function (it, j) { const i = ini + j; return '<fieldset class="pf-item"><legend>' + (i + 1) + '. ' + esc(it[0]) + '</legend><div class="pf-esc">' + ESCALA.map(function (t, v) { return '<label title="' + t + '"><input type="radio" name="i' + i + '" value="' + (v + 1) + '"' + (est.r[i] === v + 1 ? ' checked' : '') + '><span>' + t + '</span></label>'; }).join('') + '</div></fieldset>'; }).join('') +
      '<footer class="pf-nav">' + (est.pag ? '<button type="button" class="btn fantasma" data-p="-1">← Anterior</button>' : '<span></span>') + '<span class="mini mudo">Página ' + (est.pag + 1) + ' de ' + Math.ceil(tot / POR) + '</span>' + (ini + POR < tot ? '<button class="btn primario">Próxima →</button>' : '<button class="btn primario">Ver resultado</button>') + '</footer></form></div>';
    const f = el.querySelector('#pf-f');
    f.onchange = function (ev) { const m = ev.target.name.match(/^i(\d+)$/); if (m) { est.r[Number(m[1])] = Number(ev.target.value); el.querySelector('.pf-prog i').style.width = P.completo(est.r, tot) / tot * 100 + '%'; } };
    f.onclick = function (ev) { const b = ev.target.closest('[data-p]'); if (b) { est.pag--; telaBig5(el); window.scrollTo(0, 0); } };
    f.onsubmit = function (ev) {
      ev.preventDefault(); const falta = P.IPIP.slice(ini, ini + POR).map(function (_, j) { return ini + j; }).filter(function (i) { return est.r[i] == null; });
      if (falta.length) { aviso('Responda o item ' + (falta[0] + 1) + '.', 'erro'); f.querySelector('[name=i' + falta[0] + ']').focus(); return; }
      if (ini + POR < tot) { est.pag++; telaBig5(el); window.scrollTo(0, 0); return; }
      salvarRes('big5', P.bigFive(est.r)); est.r = {}; est.pag = 0; aviso('Resultado salvo.'); location.hash = '#/perfil';
    };
  }

  // ---------- DISC ----------
  function telaDisc(el) {
    const tot = P.DISC_ITENS.length; const ok = Object.keys(est.disc).filter(function (k) { const r = est.disc[k]; return r.mais != null && r.menos != null; }).length;
    el.innerHTML = '<div class="pf-teste"><header><a class="btn mini fantasma" href="#/perfil">← Voltar</a><h2>Estilo DISC · ' + esc(pessoa().nome) + '</h2><span class="mini mudo" id="pf-cont">' + ok + ' de ' + tot + '</span></header><div class="pf-prog"><i style="width:' + ok / tot * 100 + '%"></i></div>' +
      '<p class="mudo">Em cada grupo, marque a palavra que <b>mais</b> parece com você no trabalho e a que <b>menos</b> parece.</p><form id="pf-d">' + P.DISC_ITENS.map(function (g, i) { const r = est.disc[i] || {}; const ord = [0, 1, 2, 3].sort(function (a, b) { return ((i * 7 + a * 3) % 4) - ((i * 7 + b * 3) % 4); }); return '<div class="pf-grupo" data-g="' + i + '"><b>' + (i + 1) + '</b><div class="pf-op">' + ord.map(function (j) { return '<div class="pf-pal"><span>' + esc(g[j]) + '</span><label title="Mais parecido"><input type="radio" name="m' + i + '" value="' + j + '"' + (r.mais === j ? ' checked' : '') + ' aria-label="Mais: ' + esc(g[j]) + '">+</label><label title="Menos parecido"><input type="radio" name="n' + i + '" value="' + j + '"' + (r.menos === j ? ' checked' : '') + ' aria-label="Menos: ' + esc(g[j]) + '">−</label></div>'; }).join('') + '</div></div>'; }).join('') +
      '<footer class="pf-nav"><span></span><button class="btn primario">Ver resultado</button></footer></form></div>';
    const f = el.querySelector('#pf-d');
    f.onchange = function (ev) {
      const m = ev.target.name.match(/^([mn])(\d+)$/); if (!m) return; const i = Number(m[2]); est.disc[i] = est.disc[i] || {};
      const k = m[1] === 'm' ? 'mais' : 'menos', o = k === 'mais' ? 'menos' : 'mais'; est.disc[i][k] = Number(ev.target.value);
      if (est.disc[i][o] === est.disc[i][k]) { delete est.disc[i][o]; const x = f.querySelector('[name=' + (o === 'mais' ? 'm' : 'n') + i + ']:checked'); if (x) x.checked = false; }
      const ok2 = Object.keys(est.disc).filter(function (q) { return est.disc[q].mais != null && est.disc[q].menos != null; }).length; el.querySelector('#pf-cont').textContent = ok2 + ' de ' + tot; el.querySelector('.pf-prog i').style.width = ok2 / tot * 100 + '%';
    };
    f.onsubmit = function (ev) { ev.preventDefault(); const falta = P.DISC_ITENS.map(function (_, i) { return i; }).filter(function (i) { const r = est.disc[i]; return !r || r.mais == null || r.menos == null; }); if (falta.length) { aviso('Complete o grupo ' + (falta[0] + 1) + ' (uma de “mais” e outra de “menos”).', 'erro'); f.querySelector('[data-g="' + falta[0] + '"]').scrollIntoView({ block: 'center' }); return; } salvarRes('disc', P.disc(est.disc)); est.disc = {}; aviso('Resultado salvo.'); location.hash = '#/perfil'; };
  }

  // ---------- raciocínio ----------
  function telaRaciocinio(el) {
    clearInterval(est.timer);
    if (!est.prova) { el.innerHTML = '<div class="pf-teste"><header><a class="btn mini fantasma" href="#/perfil">← Voltar</a><h2>Prática de raciocínio</h2></header><div class="cartao"><p>12 questões (sequências numéricas e analogias com tema de licitação), até 12 minutos. Faça num lugar tranquilo e sem calculadora.</p><p class="alerta">Isto não é um teste de QI e não produz número de QI. Serve para treinar e acompanhar a sua própria evolução.</p><button class="btn primario" data-a="comecar">Começar</button></div></div>'; el.onclick = function (ev) { if (ev.target.closest('[data-a=comecar]')) { est.prova = P.prova(Date.now(), 12); est.resp = []; est.ini = Date.now(); telaRaciocinio(el); } }; return; }
    const i = est.resp.length; const fim = est.ini + 12 * 60000;
    if (i >= est.prova.length || Date.now() >= fim) { const r = P.corrigir(est.prova, est.resp); const s = Math.round((Math.min(Date.now(), fim) - est.ini) / 1000); salvarRes('raciocinio', { pct: r.pct, acertos: r.acertos, total: r.total, s: s }); const prova = est.prova; const resp = est.resp; est.prova = null;
      el.innerHTML = '<div class="pf-teste"><header><a class="btn mini fantasma" href="#/perfil">← Voltar</a><h2>Resultado</h2></header><div class="cartao pf-res"><b>' + r.acertos + ' de ' + r.total + '</b><p>em ' + Math.floor(s / 60) + ' min ' + (s % 60) + ' s</p><details><summary>Revisar respostas</summary><ol>' + prova.map(function (it, k) { return '<li class="' + (resp[k] === it.c ? 'ok' : 'nao') + '">' + esc(it.p) + '<br>' + (resp[k] === it.c ? '✓ ' + esc(it.o[it.c]) : '✗ ' + (resp[k] >= 0 ? 'Você marcou ' + esc(it.o[resp[k]]) + '. ' : 'Em branco. ') + 'Certo: ' + esc(it.o[it.c])) + '</li>'; }).join('') + '</ol></details><a class="btn primario" href="#/perfil">Ver evolução</a></div></div>'; return; }
    const it = est.prova[i];
    el.innerHTML = '<div class="pf-teste"><header><a class="btn mini fantasma" href="#/perfil">← Sair</a><h2>Questão ' + (i + 1) + ' de ' + est.prova.length + '</h2><span class="pf-tempo" id="pf-t"></span></header><div class="pf-prog"><i style="width:' + i / est.prova.length * 100 + '%"></i></div><div class="cartao pf-q"><h3>' + esc(it.p) + '</h3><div class="pf-ops">' + it.o.map(function (o, k) { return '<button data-k="' + k + '">' + esc(o) + '</button>'; }).join('') + '</div><button class="btn mini fantasma" data-k="-1">Pular</button></div></div>';
    const t = el.querySelector('#pf-t'); const tick = function () { const rest = Math.max(0, Math.round((fim - Date.now()) / 1000)); if (t && document.body.contains(t)) t.textContent = Math.floor(rest / 60) + ':' + String(rest % 60).padStart(2, '0'); if (rest <= 0) { clearInterval(est.timer); while (est.resp.length < est.prova.length) est.resp.push(-1); telaRaciocinio(el); } }; tick(); est.timer = setInterval(tick, 1000);
    el.onclick = function (ev) { const b = ev.target.closest('[data-k]'); if (!b) return; est.resp.push(Number(b.dataset.k)); telaRaciocinio(el); };
  }
  window.addEventListener('hashchange', function () { if (!/^#\/perfil\/raciocinio/.test(location.hash)) { clearInterval(est.timer); est.prova = null; } });

  Telas.perfil = {
    titulo: 'Autoconhecimento',
    render: function (el, sub) { e(); el.onclick = null; if (sub === 'big5') return telaBig5(el); if (sub === 'disc') return telaDisc(el); if (sub === 'raciocinio') return telaRaciocinio(el); telaInicio(el); }
  };
})();
