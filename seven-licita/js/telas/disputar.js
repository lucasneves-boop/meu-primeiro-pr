/* Disputar: preparação da sessão (valor limite, lance fechado, estratégia) e ensaio no simulador. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, dataHora, campo, opcoes, modal, confirmar, aviso, abas } = UI;
  const MODOS = [{ v: 'aberto', t: 'Aberto' }, { v: 'aberto-fechado', t: 'Aberto/fechado' }, { v: 'fechado-aberto', t: 'Fechado/aberto' }, { v: 'dispensa', t: 'Dispensa eletrônica' }, { v: 'aleatorio', t: 'Aleatório' }];
  const CHECKLIST = [
    'Portal, modalidade, modo e critério conferidos',
    'Proposta enviada com status de sucesso no portal',
    'Valor limite (e lance fechado) de cada item aprovado pelo cliente por escrito',
    'Estratégia e fase de início configuradas; itens que não serão disputados pausados',
    'Computador ligado, internet estável, uma aba só; ninguém logado no portal com o mesmo acesso',
    'Responsável pela sessão definido (inclusive fora do horário)',
    'Monitoramento do chat ativo até o fim da habilitação'
  ];
  let sim = null; let timer = null;

  function e() { return Dados.e; }
  function daEmpresa(l) { const a = Dados.empresaAtiva(); return a ? l.filter(function (x) { return !x.empresaId || x.empresaId === a.id; }) : l; }

  function modoDe(p) {
    const m = Nucleo.normalizar((p.modo || '') + ' ' + (p.modalidade || ''));
    if (/dispensa/.test(m)) return 'dispensa';
    if (/aberto fechado/.test(m)) return 'aberto-fechado';
    if (/fechado aberto/.test(m)) return 'fechado-aberto';
    return 'aberto';
  }

  function cfgPadrao(modo) {
    return { modo: modo, estrategia: 'melhor', posicaoAlvo: 1, inicio: 'aberta', casas: 2, reducao: { tipo: 'percentual', min: 0.1, max: 0.3 }, intervaloMinimo: { tipo: 'valor', valor: 0.01 }, enviarRestando: modo === 'aberto-fechado' ? 240 : 105, cobrirProprio: false, estrategiasAF: { top3: false, distancia: false, distanciaPct: 10, excluir: false, excluirPosicao: 4 } };
  }

  function deProposta(p) {
    if (e().disputas.some(function (d) { return d.propostaId === p.id; })) return;
    const av = e().avisos[p.avisoId] || {};
    const modo = modoDe(Object.assign({}, av, p));
    e().disputas.unshift({
      id: Dados.id('dsp'), propostaId: p.id, empresaId: p.empresaId, titulo: (p.modalidade || '') + ' ' + (p.numero || '') + ' · ' + (p.orgao || ''), portal: p.portal, sessao: p.encerramento, situacao: 'Agendada',
      config: cfgPadrao(modo), ativa: false,
      itens: p.itens.filter(function (i) { return i.participar !== false; }).map(function (i) { return { numero: i.numero, descricao: i.descricao, quantidade: i.quantidade, proposta: i.unitario, referencia: i.refUnitaria, custo: i.custo, limite: null, lanceFechado: null, pausado: false, aprovado: false }; }),
      checklist: {}, criadaEm: new Date().toISOString()
    });
    Dados.salvar(); aviso('Licitação enviada ao Disputar. Defina o valor limite de cada item.');
  }

  function telaLista(el) {
    const l = daEmpresa(e().disputas);
    el.innerHTML = '<div class="nota-importante"><b>Como funciona aqui:</b> esta tela prepara a sessão (valor limite, lance fechado, estratégia, checklist) e ensaia a estratégia num <b>simulador</b>. Ela não envia lances a portal nenhum: na sessão real, use o robô do portal/fornecedor contratado ou lance manual, com os valores aprovados aqui.</div>' +
      '<div class="barra-acoes"><div></div><button class="btn primario" data-a="nova">+ Nova disputa</button></div>' +
      (l.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Licitação</th><th>Portal</th><th>Sessão</th><th>Modo</th><th class="n">Itens com limite</th><th>Checklist</th></tr></thead><tbody>' +
        l.map(function (d) {
          const ok = d.itens.filter(function (i) { return i.limite; }).length; const ck = CHECKLIST.filter(function (_, k) { return d.checklist[k]; }).length;
          return '<tr class="clicavel" data-id="' + d.id + '"><td><b>' + esc(d.titulo) + '</b></td><td>' + esc(d.portal || '') + '</td><td>' + dataHora(d.sessao) + '</td><td>' + esc((MODOS.find(function (m) { return m.v === d.config.modo; }) || {}).t) + '</td><td class="n ' + (ok < d.itens.length ? 'alerta' : '') + '">' + ok + '/' + d.itens.length + '</td><td class="' + (ck < CHECKLIST.length ? 'alerta' : '') + '">' + ck + '/' + CHECKLIST.length + '</td></tr>';
        }).join('') + '</tbody></table></div>' : UI.vazio('Nenhuma disputa', 'Na proposta, ligue "Enviar ao Disputar". Ou crie uma disputa avulsa para ensaiar no simulador.', '<button class="btn primario" data-a="nova">+ Nova disputa</button>'));
    el.onclick = async function (ev) {
      if (ev.target.closest('[data-a=nova]')) {
        const ps = daEmpresa(e().propostas).filter(function (p) { return !e().disputas.some(function (d) { return d.propostaId === p.id; }); });
        const f = await modal({ titulo: 'Nova disputa', corpo: campo('A partir da proposta', '<select name="p"><option value="">Disputa avulsa (só para ensaio)</option>' + opcoes(ps.map(function (p) { return { v: p.id, t: (p.modalidade || '') + ' ' + (p.numero || '') + ' · ' + (p.orgao || '') }; })) + '</select>') });
        if (!f) return;
        if (f.get('p')) deProposta(ps.find(function (p) { return p.id === f.get('p'); }));
        else { e().disputas.unshift({ id: Dados.id('dsp'), empresaId: Dados.e.empresaAtiva, titulo: 'Ensaio avulso', config: cfgPadrao('aberto'), itens: [{ numero: 1, descricao: 'Item de ensaio', quantidade: 1, proposta: 1000, referencia: 1000, limite: 850 }], checklist: {}, criadaEm: new Date().toISOString() }); Dados.salvar(); }
        App.redesenhar(); return;
      }
      const tr = ev.target.closest('tr[data-id]'); if (tr) location.hash = '#/disputar/disputa/' + tr.dataset.id;
    };
  }

  function formConfig(c, prefixo) {
    prefixo = prefixo || '';
    const af = c.estrategiasAF || {};
    return '<div class="linha">' + campo('Modo de disputa', '<select name="modo">' + opcoes(MODOS, c.modo) + '</select>') +
      campo('Estratégia', '<select name="estrategia">' + opcoes([{ v: 'melhor', t: 'Disputar a melhor posição possível' }, { v: 'limite', t: 'Lance do valor limite quando não der o 1º lugar' }, { v: 'primeiro', t: 'Só o 1º lugar (para ao não conseguir)' }], c.estrategia) + '</select>') +
      campo('Posição de disputa', '<select name="posicaoAlvo">' + opcoes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return { v: n, t: n + 'ª' }; }), c.posicaoAlvo) + '</select>') +
      campo('Início', '<select name="inicio">' + opcoes([{ v: 'aberta', t: 'Fase aberta' }, { v: 'prorrogacao', t: 'Prorrogação / fase final' }], c.inicio) + '</select>') + '</div>' +
      '<div class="linha">' + campo('Variação de redução', '<select name="redTipo">' + opcoes([{ v: 'percentual', t: '%' }, { v: 'valor', t: 'R$' }], c.reducao.tipo) + '</select>') +
      campo('Mínima', '<input name="redMin" inputmode="decimal" value="' + esc(String(c.reducao.min).replace('.', ',')) + '">') + campo('Máxima', '<input name="redMax" inputmode="decimal" value="' + esc(String(c.reducao.max).replace('.', ',')) + '">') +
      campo('Intervalo mínimo do edital', '<div class="junto"><select name="imTipo">' + opcoes([{ v: 'valor', t: 'R$' }, { v: 'percentual', t: '%' }], c.intervaloMinimo.tipo) + '</select><input name="imValor" inputmode="decimal" value="' + esc(String(c.intervaloMinimo.valor).replace('.', ',')) + '"></div>', 'Se a redução for menor, vale o intervalo do edital.') +
      campo('Casas decimais', '<select name="casas">' + opcoes([0, 1, 2, 3, 4], c.casas) + '</select>') +
      campo('Enviar lance restando (s)', '<input name="enviarRestando" inputmode="numeric" value="' + esc(c.enviarRestando) + '">') + '</div>' +
      '<fieldset><legend>Só aberto/fechado (rodam nesta ordem)</legend><div class="grade-checks">' +
      '<label><input type="checkbox" name="afExcluir"' + (af.excluir ? ' checked' : '') + '> Excluir o seguinte colocado: <select name="afExcluirPos">' + opcoes([4, 5, 6, 7, 8, 9, 10].map(function (n) { return { v: n, t: n + 'º' }; }), af.excluirPosicao || 4) + '</select></label>' +
      '<label><input type="checkbox" name="afDist"' + (af.distancia ? ' checked' : '') + '> Distância máxima do 1º: <input name="afDistPct" class="curto" inputmode="numeric" value="' + esc(af.distanciaPct || 10) + '">%</label>' +
      '<label><input type="checkbox" name="afTop3"' + (af.top3 ? ' checked' : '') + '> Top 3 (garantir convocação sem gastar margem)</label></div></fieldset>' +
      '<label class="check"><input type="checkbox" name="cobrir"' + (c.cobrirProprio ? ' checked' : '') + '> Dispensa: cobrir o próprio lance nos segundos finais</label>';
  }

  function lerConfig(fd, base) {
    const n = function (k) { return Nucleo.lerNumeroBR(fd.get(k)); };
    return Object.assign({}, base, {
      modo: fd.get('modo'), estrategia: fd.get('estrategia'), posicaoAlvo: Number(fd.get('posicaoAlvo')), inicio: fd.get('inicio'), casas: Number(fd.get('casas')),
      reducao: { tipo: fd.get('redTipo'), min: n('redMin') || 0, max: Math.max(n('redMax') || 0, n('redMin') || 0) },
      intervaloMinimo: { tipo: fd.get('imTipo'), valor: n('imValor') || 0 }, enviarRestando: Number(fd.get('enviarRestando')) || 0, cobrirProprio: !!fd.get('cobrir'),
      estrategiasAF: { excluir: !!fd.get('afExcluir'), excluirPosicao: Number(fd.get('afExcluirPos')), distancia: !!fd.get('afDist'), distanciaPct: n('afDistPct') || 10, top3: !!fd.get('afTop3') }
    });
  }

  function telaDisputa(el, id) {
    const d = e().disputas.find(function (x) { return x.id === id; });
    if (!d) { el.innerHTML = UI.vazio('Disputa não encontrada', '', '<a class="btn" href="#/disputar">Voltar</a>'); return; }
    const c = d.config;
    el.innerHTML = '<p><a href="#/disputar">← Minhas disputas</a></p>' +
      '<section class="cartao"><header><h2>' + esc(d.titulo) + '</h2><span class="mudo">' + esc(d.portal || '') + ' · sessão ' + dataHora(d.sessao) + '</span></header>' +
      '<form id="cfg">' + formConfig(c) + '</form></section>' +
      '<section class="cartao"><header><h3>Itens · valor limite e lance fechado</h3><div class="grupo-botoes"><button class="btn fantasma" data-a="limite-lote">Alterar valor limite em lote</button><button class="btn fantasma" data-a="exportar">Exportar valores</button><button class="btn fantasma" data-a="importar">Importar valores</button></div></header>' +
      '<p class="mini mudo">Valor limite é o piso: o lance nunca vai abaixo dele. Inclua custo, impostos, frete e margem mínima, e tenha a aprovação do cliente por escrito.</p>' +
      '<div class="tabela-rolagem"><table class="tabela" id="itens-disp"><thead><tr><th>Pausar</th><th>Item</th><th>Descrição</th><th class="n">Proposta</th><th class="n">Referência</th><th class="n">Custo</th><th class="n">Valor limite</th><th class="n">Lance fechado</th><th class="n">Desconto máx.</th><th>Aprovado</th><th></th></tr></thead><tbody>' +
      d.itens.map(function (i, k) {
        const desc = i.limite && i.proposta ? 1 - i.limite / i.proposta : null;
        const abaixo = i.limite && i.custo && i.limite < i.custo;
        return '<tr data-k="' + k + '" class="' + (i.pausado ? 'inativo' : '') + '"><td><input type="checkbox" data-c="pausado"' + (i.pausado ? ' checked' : '') + ' aria-label="Pausar item"></td><td>' + esc(i.numero) + '</td><td class="desc">' + esc(String(i.descricao || '').slice(0, 140)) + '</td><td class="n">' + moeda(i.proposta) + '</td><td class="n">' + moeda(i.referencia) + '</td><td class="n">' + moeda(i.custo) + '</td>' +
          '<td class="n"><input data-c="limite" inputmode="decimal" class="' + (abaixo ? 'erro' : '') + '" value="' + (i.limite != null ? esc(String(i.limite).replace('.', ',')) : '') + '"></td><td class="n"><input data-c="lanceFechado" inputmode="decimal" value="' + (i.lanceFechado != null ? esc(String(i.lanceFechado).replace('.', ',')) : '') + '"' + (c.modo !== 'aberto-fechado' ? ' disabled' : '') + '></td>' +
          '<td class="n">' + UI.pct(desc) + (abaixo ? '<br><small class="alerta">abaixo do custo</small>' : '') + '</td><td><input type="checkbox" data-c="aprovado"' + (i.aprovado ? ' checked' : '') + ' aria-label="Aprovado pelo cliente"></td><td><button class="btn mini" data-a="ensaiar">Ensaiar</button></td></tr>';
      }).join('') + '</tbody></table></div></section>' +
      '<section class="cartao"><h3>Checklist antes da sessão</h3><form id="ck">' + CHECKLIST.map(function (t, k) { return '<label class="check"><input type="checkbox" name="c' + k + '"' + (d.checklist[k] ? ' checked' : '') + '> ' + esc(t) + '</label>'; }).join('') + '</form></section>' +
      '<section class="cartao" id="simulador"><h3>Simulador</h3><p class="mudo">Escolha um item e clique em <b>Ensaiar</b>. Concorrentes fictícios disputam contra a sua configuração, em tempo acelerado.</p></section>' +
      '<p><button class="btn fantasma perigo" data-a="excluir">Excluir disputa</button></p>';
    el.insertAdjacentHTML('beforeend', Telas.oport.secao(Telas.oport.chaveDisputa(d), 'disputar'));
    el.querySelector('#cfg').onchange = function () { d.config = lerConfig(new FormData(this), d.config); Dados.salvar(); App.redesenhar(); };
    el.querySelector('#ck').onchange = function () { const fd = new FormData(this); CHECKLIST.forEach(function (_, k) { d.checklist[k] = !!fd.get('c' + k); }); Dados.salvar(); };
    el.querySelector('#itens-disp').onchange = function (ev) {
      const k = ev.target.closest('tr').dataset.k; const i = d.itens[k]; const c2 = ev.target.dataset.c;
      if (c2 === 'pausado' || c2 === 'aprovado') i[c2] = ev.target.checked;
      else { const v = Nucleo.lerNumeroBR(ev.target.value); i[c2] = isFinite(v) ? Nucleo.arredondar(v, d.config.casas) : null; if (c2 === 'limite') i.aprovado = false; }
      Dados.salvar(); App.redesenhar();
    };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'ensaiar') { iniciarSim(el.querySelector('#simulador'), d, d.itens[b.closest('tr').dataset.k]); return; }
      if (b.dataset.a === 'limite-lote') {
        const f = await modal({ titulo: 'Valor limite em lote', corpo: campo('Definir como', '<select name="tipo">' + opcoes([{ v: 'desc', t: '% abaixo da proposta' }, { v: 'custo', t: '% acima do custo' }]) + '</select>') + campo('Percentual', '<input name="pct" inputmode="decimal" required>') });
        if (!f) return; const pct = Nucleo.lerNumeroBR(f.get('pct')) / 100;
        d.itens.forEach(function (i) { const v = f.get('tipo') === 'desc' ? (i.proposta ? i.proposta * (1 - pct) : null) : (i.custo ? i.custo * (1 + pct) : null); if (v) { i.limite = Nucleo.arredondarCima(v, d.config.casas); i.aprovado = false; } });
      }
      if (b.dataset.a === 'exportar') UI.baixar('valores-limite.csv', '﻿' + Nucleo.paraCSV([['Item', 'Descrição', 'Proposta', 'Valor limite', 'Lance fechado']].concat(d.itens.map(function (i) { return [i.numero, i.descricao, i.proposta, i.limite, i.lanceFechado]; }))), 'text/csv;charset=utf-8');
      if (b.dataset.a === 'importar') {
        const f = await UI.escolherArquivo('.csv'); if (!f) return;
        const l = Nucleo.lerCSV(await UI.lerArquivoTexto(f)); const cab = l[0].map(Nucleo.normalizar);
        const ci = cab.indexOf('item'), cl = cab.findIndex(function (x) { return x.indexOf('valor limite') === 0; }), cf = cab.findIndex(function (x) { return x.indexOf('lance fechado') === 0; });
        l.slice(1).forEach(function (r) { const i = d.itens.find(function (x) { return String(x.numero) === String(r[ci]).trim(); }); if (!i) return; if (cl >= 0 && r[cl]) { i.limite = Nucleo.arredondar(Nucleo.lerNumeroBR(r[cl]), d.config.casas); i.aprovado = false; } if (cf >= 0 && r[cf]) i.lanceFechado = Nucleo.arredondar(Nucleo.lerNumeroBR(r[cf]), d.config.casas); });
        aviso('Valores importados. Marque "Aprovado" de novo após a conferência.');
      }
      if (b.dataset.a === 'excluir' && await confirmar('Excluir disputa', 'Excluir esta disputa?', 'Excluir')) { e().disputas = e().disputas.filter(function (x) { return x !== d; }); Dados.salvar(); location.hash = '#/disputar'; return; }
      Dados.salvar(); App.redesenhar();
    };
  }

  function iniciarSim(box, d, item) {
    if (!item.limite) { aviso('Defina o valor limite do item antes de ensaiar.', 'erro'); return; }
    clearInterval(timer);
    const ref = item.referencia || item.proposta || item.limite * 1.2;
    box.innerHTML = '<h3>Simulador · item ' + esc(item.numero) + '</h3><form class="linha" id="simcfg">' + campo('Concorrentes', '<input name="n" inputmode="numeric" value="5">') + campo('Agressividade (% abaixo da referência, mín–máx)', '<div class="junto"><input name="amin" class="curto" value="5"><input name="amax" class="curto" value="25"></div>') + campo('Velocidade', '<select name="vel">' + opcoes([{ v: 20, t: '50x' }, { v: 5, t: '200x' }, { v: 1, t: 'Instantâneo' }]) + '</select>') + '<button class="btn primario">▶ Iniciar ensaio</button></form><div id="simvivo"></div>';
    box.querySelector('#simcfg').onsubmit = function (ev) {
      ev.preventDefault(); const fd = new FormData(this);
      const cfg = Object.assign({}, d.config, { referencia: ref, limite: item.limite, lanceFechado: item.lanceFechado, propostaInicial: item.proposta || ref, concorrentes: Math.max(1, Math.min(15, Number(fd.get('n')) || 5)), agressividadeMin: (Nucleo.lerNumeroBR(fd.get('amin')) || 5) / 100, agressividadeMax: (Nucleo.lerNumeroBR(fd.get('amax')) || 25) / 100, semente: Date.now() });
      if (cfg.modo === 'fechado-aberto' || cfg.modo === 'aleatorio') cfg.modo = 'aberto';
      sim = Nucleo.criarSimulacao(cfg);
      const vivo = box.querySelector('#simvivo'); const vel = Number(fd.get('vel'));
      clearInterval(timer);
      if (vel === 1) { while (!sim.encerrada) Nucleo.passoSimulacao(sim); desenharSim(vivo, sim); return; }
      timer = setInterval(function () { for (let i = 0; i < 10 && !sim.encerrada; i++) Nucleo.passoSimulacao(sim); desenharSim(vivo, sim); if (sim.encerrada || !document.body.contains(vivo)) clearInterval(timer); }, vel * 10);
    };
  }

  function desenharSim(el, s) {
    const casas = s.cfg.casas;
    const ranking = s.concorrentes.map(function (c) { return { nome: c.nome, v: c.lance }; }).concat([{ nome: 'Sua empresa', v: s.meuLance, eu: true }]).sort(function (a, b) { return a.v - b.v; });
    const min = s.cfg.limite * 0.9, max = s.cfg.referencia * 1.02;
    const pts = function (k) { return s.historico.filter(function (_, i) { return i % Math.max(1, Math.floor(s.historico.length / 300)) === 0; }).map(function (h) { return (h.t / Math.max(1, s.t) * 100).toFixed(2) + ',' + (60 - (h[k] - min) / (max - min) * 60).toFixed(2); }).join(' '); };
    const yLim = (60 - (s.cfg.limite - min) / (max - min) * 60).toFixed(2);
    const mm = Math.floor(Math.max(0, s.fimFase - s.t) / 60), ss = Math.max(0, s.fimFase - s.t) % 60;
    el.innerHTML = '<div class="sim-topo"><span class="tag">' + esc({ aberta: 'Fase aberta', 'aberta-espera': 'Fase aberta (robô aguardando)', prorrogacao: 'Prorrogação', aleatoria: 'Tempo aleatório', encerrada: 'Encerrada' }[s.fase] || s.fase) + '</span><b>' + (s.encerrada ? 'Fim' : String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0')) + '</b><span>Seu lance: <b>' + UI.num(s.meuLance, casas) + '</b> · posição <b>' + Nucleo.posicaoAtual(s) + 'º</b></span></div>' +
      '<svg class="sim-grafico" viewBox="0 0 100 60" preserveAspectRatio="none" role="img" aria-label="Evolução dos lances"><line x1="0" x2="100" y1="' + yLim + '" y2="' + yLim + '" class="lim"/><polyline points="' + pts('melhor') + '" class="conc"/><polyline points="' + pts('meu') + '" class="meu"/></svg>' +
      '<p class="mini"><span class="leg meu"></span> seu lance · <span class="leg conc"></span> melhor concorrente · <span class="leg lim"></span> valor limite</p>' +
      '<div class="cartoes"><section><h4>Classificação</h4><ol class="ranking">' + ranking.map(function (r) { return '<li class="' + (r.eu ? 'eu' : '') + '">' + esc(r.nome) + ' <b>' + UI.num(r.v, casas) + '</b></li>'; }).join('') + '</ol></section>' +
      '<section><h4>Registro</h4><ul class="log">' + s.log.slice(-40).reverse().map(function (l) { return '<li class="' + (l.robo ? 'robo' : '') + '"><span>' + String(Math.floor(l.t / 60)).padStart(2, '0') + ':' + String(l.t % 60).padStart(2, '0') + '</span> <b>' + esc(l.quem) + '</b> ' + esc(l.texto) + '</li>'; }).join('') + '</ul></section></div>' +
      (s.encerrada ? '<p class="nota-importante">Resultado: <b>' + s.resultado.posicao + 'º lugar</b> com ' + UI.num(s.resultado.meuLance, casas) + '. Melhor concorrente: ' + UI.num(s.resultado.melhorConcorrente, casas) + '. Concorrentes são fictícios; use o ensaio para testar estratégia e limite, não para prever resultado.</p>' : '');
  }

  Telas.disputar = {
    titulo: 'Disputar',
    render: function (el, sub, param) {
      clearInterval(timer);
      el.innerHTML = abas([{ id: '', t: 'Minhas disputas' }], '', 'disputar').replace('href="#/disputar/"', 'href="#/disputar"') + '<div id="aba"></div>';
      const aba = el.querySelector('#aba');
      if (sub === 'disputa') telaDisputa(aba, param); else telaLista(aba);
      el.onclick = null;
    },
    deProposta: deProposta
  };
})();
