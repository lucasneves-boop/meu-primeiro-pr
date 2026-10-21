/* Painel: o dia da Seven em uma tela. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, dataHora, emQuanto, progresso } = UI;
  let doDia = null;

  async function carregarDoDia(alvo) {
    const ufs = []; Dados.e.perfis.forEach(function (p) { (p.ufs || []).forEach(function (u) { if (ufs.indexOf(u) < 0) ufs.push(u); }); });
    if (!ufs.length) ufs.push((Dados.empresaAtiva() || {}).uf || 'GO');
    const hoje = new Date().toISOString().slice(0, 10);
    const r = await PNCP.publicadas({ ufs: ufs, modalidades: [6, 8, 4], inicio: hoje, fim: hoje, maxPaginas: 20 }, function (f, t) { progresso(alvo, 'Licitações publicadas hoje: ' + f + '/' + t, f / t); });
    const faixa = { ate50: 0, ate250: 0, acima: 0, sem: 0 }; let total = 0;
    r.lista.forEach(function (c) { const v = c.valorEstimado; if (!v) faixa.sem++; else if (v <= 50000) faixa.ate50++; else if (v <= 250000) faixa.ate250++; else faixa.acima++; total += v || 0; });
    doDia = { ufs: ufs, n: r.lista.length, faixa: faixa, total: total, em: new Date().toISOString() };
  }

  Telas.painel = {
    titulo: 'Painel',
    render: function (el) {
      const d = Dados.e; const emp = Dados.empresaAtiva();
      const avisosNovos = Object.keys(d.avisos).map(function (k) { return d.avisos[k]; }).filter(function (a) { return !a.lido && !a.lixeira; });
      const proxSessoes = Object.keys(d.avisos).map(function (k) { return d.avisos[k]; }).filter(function (a) { return a.favorito && a.encerramento && new Date(a.encerramento) > Date.now(); })
        .concat(d.propostas.filter(function (p) { return p.encerramento && new Date(p.encerramento) > Date.now() && p.status !== 'perdida'; }).map(function (p) { return { encerramento: p.encerramento, objeto: p.objeto, orgao: p.orgao, link: '#/cadastrar/proposta/' + p.id, tipo: 'Proposta ' + (p.status === 'enviada' ? 'enviada' : 'em preparo') }; }))
        .sort(function (a, b) { return new Date(a.encerramento) - new Date(b.encerramento); }).slice(0, 8);
      const docs = d.documentos.filter(function (x) { const s = Nucleo.statusDocumento(x.validade); return x.validade && s.codigo !== 'valido'; });
      const prazos = Telas.monitorar.prazosAbertos().slice(0, 8);
      const pend = Telas.quadros.pendencias().slice(0, 10);
      const disputasSemLimite = d.disputas.filter(function (x) { return x.itens.some(function (i) { return !i.limite || !i.aprovado; }); });
      el.innerHTML = (!d.empresas.length ? '<div class="boas-vindas cartao"><h2>Bem-vindo ao Seven Licita</h2><ol><li><a href="#/empresas">Cadastre o primeiro cliente (CNPJ)</a></li><li><a href="#/encontrar/catalogos">Monte o catálogo de produtos</a> e <a href="#/encontrar/perfis">o perfil de busca</a></li><li>Capture os avisos do PNCP e envie os bons para o Quadro e o Cadastrar</li></ol><p class="mini">Os dados ficam neste navegador. Faça backup em <a href="#/config">Configurações</a>.</p></div>' : '') +
        '<div class="kpis">' +
        '<a href="#/encontrar"><b>' + avisosNovos.length + '</b><span>avisos novos</span></a>' +
        '<a href="#/cadastrar"><b>' + d.propostas.filter(function (p) { return p.status === 'rascunho' || p.status === 'pronta'; }).length + '</b><span>propostas em preparo</span></a>' +
        '<a href="#/disputar"><b class="' + (disputasSemLimite.length ? 'alerta' : '') + '">' + disputasSemLimite.length + '</b><span>disputas sem limite aprovado</span></a>' +
        '<a href="#/monitorar"><b>' + Telas.monitorar.prazosAbertos().length + '</b><span>prazos abertos</span></a>' +
        '<a href="#/cadastrar/documentos"><b class="' + (docs.length ? 'alerta' : '') + '">' + docs.length + '</b><span>documentos vencendo/vencidos</span></a>' +
        '<a href="#/quadros"><b class="' + (pend.some(function (p) { return p.tipo === 'atrasado'; }) ? 'alerta' : '') + '">' + Telas.quadros.pendencias().length + '</b><span>pendências no Quadro</span></a></div>' +
        '<div class="cartoes">' +
        '<section class="cartao"><h3>Próximas sessões e prazos de proposta</h3>' + (proxSessoes.length ? '<ul class="lista-prazos">' + proxSessoes.map(function (a) { return '<li class="' + (new Date(a.encerramento) - Date.now() < 86400000 ? 'logo' : '') + '"><b>' + dataHora(a.encerramento) + '</b> (' + emQuanto(a.encerramento) + ')<br><a href="' + esc(a.link || '#/encontrar') + '">' + esc(String(a.objeto || '').slice(0, 110)) + '</a><br><span class="mini mudo">' + esc(a.tipo || 'Aviso favorito') + ' · ' + esc(a.orgao || '') + '</span></li>'; }).join('') + '</ul>' : '<p class="mudo">Favorite avisos ou crie propostas para ver aqui.</p>') + '</section>' +
        '<section class="cartao"><h3>Pendências do Quadro</h3>' + (pend.length ? '<ul class="lista-prazos">' + pend.map(function (p) { return '<li class="' + (p.tipo === 'atrasado' ? 'atrasado' : 'logo') + '"><b>' + UI.dataHora(p.quando) + '</b> · <a href="#/quadros/' + p.quadro.id + '">' + esc(p.texto) + '</a></li>'; }).join('') + '</ul>' : '<p class="mudo">Nada atrasado ou vencendo.</p>') + '</section>' +
        '<section class="cartao"><h3>Prazos do pregoeiro</h3>' + (prazos.length ? '<ul class="lista-prazos">' + prazos.map(function (x) { const ms = new Date(x.p.ate) - Date.now(); return '<li class="' + (ms < 0 ? 'atrasado' : ms < 86400000 ? 'logo' : '') + '"><b>' + dataHora(x.p.ate) + '</b> · ' + esc(x.p.tipo) + '<br><a href="#/monitorar/licitacao/' + x.m.id + '">' + esc(x.m.titulo) + '</a></li>'; }).join('') + '</ul>' : '<p class="mudo">Sem prazos abertos.</p>') + '</section>' +
        '<section class="cartao"><h3>Documentos</h3>' + (docs.length ? '<ul class="lista-prazos">' + docs.map(function (x) { const s = Nucleo.statusDocumento(x.validade); const em = Dados.empresa(x.empresaId); return '<li class="' + (s.codigo === 'vencido' ? 'atrasado' : 'logo') + '"><b>' + esc(x.nome) + '</b> · ' + esc(s.rotulo) + '<br><span class="mini">' + esc(em ? em.fantasia || em.razao : '') + '</span></li>'; }).join('') + '</ul>' : '<p class="mudo">Todos os documentos válidos.</p>') + '</section>' +
        '<section class="cartao"><header><h3>Publicadas hoje no PNCP</h3><button class="btn mini" data-a="dia">' + (doDia ? 'Atualizar' : 'Carregar') + '</button></header><div id="dia">' + (doDia ? '<p class="mini">' + esc(doDia.ufs.join(', ')) + ' · pregão, dispensa e concorrência</p><div class="kpis pequenos"><div><b>' + doDia.n + '</b><span>licitações</span></div><div><b>' + moeda(doDia.total) + '</b><span>total estimado</span></div></div><table class="tabela compacta"><tbody><tr><td>Até R$ 50 mil</td><td class="n">' + doDia.faixa.ate50 + '</td></tr><tr><td>Até R$ 250 mil</td><td class="n">' + doDia.faixa.ate250 + '</td></tr><tr><td>Acima de R$ 250 mil</td><td class="n">' + doDia.faixa.acima + '</td></tr><tr><td>Sem valor / sigiloso</td><td class="n">' + doDia.faixa.sem + '</td></tr></tbody></table>' : '<p class="mudo">Volume do dia nos estados dos seus perfis.</p>') + '</div></section>' +
        '</div>' + (emp ? '<p class="mini mudo">Cliente ativo: ' + esc(emp.razao) + '</p>' : '');
      el.onclick = async function (ev) {
        const b = ev.target.closest('[data-a=dia]'); if (!b) return; b.disabled = true;
        try { await carregarDoDia(el.querySelector('#dia')); } catch (err) { UI.aviso('Falha ao consultar o PNCP: ' + err.message, 'erro'); }
        App.redesenhar();
      };
    }
  };
})();
