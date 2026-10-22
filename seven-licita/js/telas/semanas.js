/* 1 Ano em 12 Semanas: assistente de 6 etapas, painel do ciclo, plano semanal com pontuação, indicadores,
   diagnóstico, semana modelo na Agenda e revisão da 13ª semana. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, confirmar, aviso } = UI;
  const Z = self.Doze;
  const DIAS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
  const ETAPAS = ['Ponto de partida', 'Visão', 'Metas', 'Táticas', 'Medição e tempo', 'Compromisso'];

  function e() { const d = Dados.e; d.semanas = d.semanas || {}; const s = d.semanas; s.ciclos = s.ciclos || []; return s; }
  function ciclo(id) { return e().ciclos.find(function (c) { return c.id === id; }); }
  function ativo() { const s = e(); return ciclo(s.ativo) || s.ciclos[s.ciclos.length - 1]; }
  function hoje() { return new Date().toISOString().slice(0, 10); }
  function br(iso) { return iso ? iso.split('-').reverse().join('/') : ''; }
  function salvar() { Dados.salvar(); }
  function proximaSegunda() { return Z.segunda(Z.somar(hoje(), 1)); }
  function novoCiclo(base) {
    const c = { id: Dados.id('cy'), titulo: 'Meu Ano em 12 Semanas', equipe: false, pessoas: '', areas: {}, foco: [], inicio: proximaSegunda(), tentativas: '', visao: { longo: '', porque: '', tres: '' }, metas: [], taticas: [], indicadores: [], valores: {}, horasDisponiveis: '', tempo: {}, compromisso: {}, execucao: {}, pontuadas: {}, notasSemana: {}, revisao: {}, etapa: 1, criadoEm: Date.now() };
    if (base) { c.visao = Object.assign({}, base.visao); c.areas = Object.assign({}, base.areas); c.tempo = Object.assign({}, base.tempo); c.compromisso = Object.assign({}, base.compromisso); c.equipe = base.equipe; c.pessoas = base.pessoas; c.horasDisponiveis = base.horasDisponiveis; c.inicio = Z.segunda(Z.somar(Z.calendario(base.inicio).fim13, 1)); c.anterior = base.id; }
    e().ciclos.push(c); e().ativo = c.id; salvar(); return c;
  }

  // ---------- painel ----------
  function barras(c, atual) {
    return '<div class="sm-barras" aria-label="Pontuação por semana">' + Z.serie(c).map(function (s) { const l = Z.leitura(s.pct); return '<div class="sm-bar' + (s.n === atual ? ' atual' : '') + '"><i class="' + l.nivel + '" style="height:' + (s.pct || 0) + '%" title="Semana ' + s.n + (s.pct != null ? ': ' + s.pct + '%' : '') + '"></i><small>' + s.n + '</small></div>'; }).join('') + '<span class="sm-linha85" title="85%"></span></div>';
  }
  function telaPainel(el) {
    const c = ativo();
    if (!c) {
      el.innerHTML = '<div class="sm-vazio"><span>🗓</span><h1>Um ano em 12 semanas</h1><p>Troque o ano de 12 meses por ciclos de 12 semanas. O prazo fica sempre perto, cada semana conta e o recomeço vem a cada ciclo. O salto vem de executar, com consistência, as poucas ações que mais importam.</p><ul><li><b>Visão</b>: o porquê que sustenta a execução</li><li><b>Plano</b>: de 1 a 3 metas e as táticas de cada semana</li><li><b>Controle</b>: plano semanal e reunião de apoio</li><li><b>Medição</b>: pontuação semanal e indicadores</li><li><b>Tempo</b>: blocos protegidos na agenda</li></ul><button class="btn primario" data-a="novo">Montar meu plano</button><p class="mini mudo">Método de Brian P. Moran e Michael Lennington (livro <i>1 Ano em 12 Semanas</i>), descrito com palavras próprias.</p></div>';
      el.onclick = function (ev) { if (ev.target.closest('[data-a=novo]')) { const n = novoCiclo(); location.hash = '#/semanas/assist/' + n.id + '/1'; } };
      return;
    }
    if (c.etapa && c.etapa <= 6) { el.innerHTML = '<div class="sm-vazio"><span>📝</span><h2>' + esc(c.titulo) + '</h2><p>Seu plano está na etapa ' + c.etapa + ' de 6 (' + ETAPAS[c.etapa - 1] + ').</p><a class="btn primario" href="#/semanas/assist/' + c.id + '/' + c.etapa + '">Continuar o plano</a> <a class="btn fantasma" href="#/semanas/ciclos">Ciclos</a></div>'; el.onclick = null; return; }
    const cal = Z.calendario(c.inicio); const n = Z.semanaAtual(c.inicio, hoje()); const nSem = Math.min(12, Math.max(1, n));
    const p = Z.pontuacao(c, nSem); const passada = n > 1 ? Z.pontuacao(c, Math.min(12, n - 1)) : null; const med = Z.media(c, Math.min(12, n - 1 || 0));
    const ts = Z.taticasDaSemana(c, nSem); const ex = c.execucao[nSem] || {};
    const recado = Z.RECADOS[n] || '';
    const ultimoValor = function (ind) { for (let k = 12; k >= 1; k--) { const v = (c.valores[k] || {})[ind.id]; if (v !== undefined && v !== '') return v; } return null; };
    el.innerHTML = '<div class="sm">' +
      '<header class="sm-topo"><div><small>' + br(cal.inicio) + ' a ' + br(cal.fim) + '</small><h1>' + esc(c.titulo) + '</h1></div><nav><a class="btn mini fantasma" href="#/semanas/plano/' + c.id + '">Ver plano</a><a class="btn mini fantasma" href="#/semanas/assist/' + c.id + '/1">Editar plano</a><a class="btn mini fantasma" href="#/semanas/ciclos">Ciclos</a></nav></header>' +
      '<section class="sm-hero"><div class="sm-sem"><b>' + (n === 0 ? 'Começa em ' + br(cal.inicio) : n > 13 ? 'Ciclo encerrado' : n === 13 ? '13ª semana' : 'Semana ' + n + ' de 12') + '</b><small>' + (n >= 1 && n <= 13 ? esc(Z.fase(n)) : '') + (n >= 1 && n <= 12 ? ' · faltam ' + Z.diasRestantes(c.inicio, hoje()) + ' dias' : '') + '</small></div>' +
      '<div class="sm-kpi"><b>' + (passada && c.pontuadas[n - 1] ? passada.pct + '%' : '—') + '</b><small>semana passada</small></div><div class="sm-kpi"><b>' + (med != null ? med + '%' : '—') + '</b><small>média do ciclo</small></div>' +
      (recado ? '<p class="sm-recado">💬 ' + esc(recado) + '</p>' : '') + '</section>' +
      (n >= 2 && n <= 13 && !c.pontuadas[n - 1] ? '<div class="sm-alerta">Você ainda não pontuou a semana ' + (n - 1) + '. <a class="btn mini primario" href="#/semanas/semana/' + c.id + '/' + (n - 1) + '">Pontuar agora</a></div>' : '') +
      (n === 13 || n > 13 ? '<div class="sm-alerta ok">Hora da revisão do ciclo e de preparar o próximo. <a class="btn mini primario" href="#/semanas/revisao/' + c.id + '">Revisar o ciclo</a></div>' : '') +
      '<div class="sm-grade">' +
      '<section class="cartao"><header class="sm-cab"><h3>Plano da semana ' + nSem + '</h3><a class="btn mini" href="#/semanas/semana/' + c.id + '/' + nSem + '">Abrir semana</a></header>' + (ts.length ? c.metas.map(function (m) { const tm = ts.filter(function (t) { return t.meta === m.id; }); return tm.length ? '<h4>' + esc(m.texto) + '</h4>' + tm.map(function (t) { return '<label class="check sm-t"><input type="checkbox" data-feito="' + t.id + '"' + (ex[t.id] ? ' checked' : '') + '> ' + esc(t.texto) + (t.fundamental ? ' <span title="Ação fundamental">⭐</span>' : '') + '</label>'; }).join('') : ''; }).join('') + '<p class="sm-pont">Até agora: <b>' + p.feitas + ' de ' + p.previstas + '</b></p>' : '<p class="mudo">Nenhuma tática prevista nesta semana.</p>') + '</section>' +
      '<section class="cartao"><h3>Pontuação por semana</h3>' + barras(c, n) + '<p class="mini mudo">85% ou mais é o nível de execução que costuma levar à meta. A tendência importa mais do que uma semana isolada.</p></section>' +
      '<section class="cartao"><h3>Metas</h3>' + c.metas.map(function (m) { const ind = c.indicadores.find(function (x) { return x.meta === m.id && x.tipo === 'resultado'; }); const v = ind ? ultimoValor(ind) : null; const pr = v != null ? Z.progressoMeta(m, v) : null; return '<div class="sm-meta"><b>' + esc(m.texto) + '</b><small>de ' + esc(m.de) + ' para ' + esc(m.para) + ' ' + esc(m.unidade || '') + (v != null ? ' · atual: ' + esc(v) : '') + '</small><div class="sm-prog"><i style="width:' + (pr || 0) + '%"></i></div></div>'; }).join('') + '</section>' +
      '<section class="cartao sm-visao"><h3>Sua visão</h3><p>' + esc(c.visao.longo) + '</p>' + (c.visao.porque ? '<p class="mini"><b>Por quê:</b> ' + esc(c.visao.porque) + '</p>' : '') + '<p class="mini mudo">Releia por um ou dois minutos por dia; ajuda a atravessar as semanas difíceis.</p></section></div></div>';
    el.onchange = function (ev) { const f = ev.target.closest('[data-feito]'); if (!f) return; c.execucao[nSem] = c.execucao[nSem] || {}; c.execucao[nSem][f.dataset.feito] = f.checked; salvar(); App.redesenhar(); };
    el.onclick = null;
  }

  // ---------- assistente ----------
  function cabAssist(c, k) {
    return '<header class="sm-as-cab"><a class="btn mini fantasma" href="#/semanas">← Painel</a><h2>Etapa ' + k + ' de 6: ' + ETAPAS[k - 1] + '</h2></header><ol class="sm-passos">' + ETAPAS.map(function (t, i) { return '<li class="' + (i + 1 === k ? 'atual' : i + 1 < (c.etapa || 7) ? 'feito' : '') + '"><a href="#/semanas/assist/' + c.id + '/' + (i + 1) + '">' + (i + 1) + '. ' + t + '</a></li>'; }).join('') + '</ol>';
  }
  function dica(t) { return '<p class="sm-dica">💡 ' + t + '</p>'; }
  function rodape(k) { return '<footer class="sm-as-rod">' + (k > 1 ? '<button type="button" class="btn fantasma" data-ir="' + (k - 1) + '">← Voltar</button>' : '<span></span>') + '<button class="btn primario">' + (k < 6 ? 'Salvar e continuar →' : 'Concluir plano ✓') + '</button></footer>'; }
  function telaAssistente(el, id, k) {
    const c = ciclo(id); if (!c) { location.hash = '#/semanas'; return; }
    k = Math.max(1, Math.min(6, Number(k) || 1)); let corpo = '';
    if (k === 1) {
      const cal = Z.calendario(c.inicio);
      corpo = '<div class="linha">' + campo('Nome do plano', '<input name="titulo" value="' + esc(c.titulo) + '">') + campo('Tipo', '<select name="equipe">' + opcoes([{ v: '', t: 'Individual' }, { v: '1', t: 'Equipe' }], c.equipe ? '1' : '') + '</select>') + campo('Pessoas da equipe', '<input name="pessoas" value="' + esc(c.pessoas) + '" placeholder="Nomes separados por vírgula">', 'Só se for de equipe.') + '</div>' +
        '<h4>Como está cada área da vida hoje? (1 a 10)</h4>' + dica('As notas mais baixas costumam indicar onde focar. Concentrar o ciclo em 1 ou 2 áreas é um desequilíbrio intencional; as outras podem ser o foco do próximo.') +
        '<div class="sm-areas">' + Z.AREAS.map(function (a) { const v = c.areas[a] || 5; return '<label><span>' + a + '</span><input type="range" min="1" max="10" name="area:' + a + '" value="' + v + '"><b>' + v + '</b><input type="checkbox" name="foco" value="' + a + '"' + (c.foco.indexOf(a) >= 0 ? ' checked' : '') + ' aria-label="Foco neste ciclo em ' + a + '"> foco</label>'; }).join('') + '</div>' +
        '<div class="linha">' + campo('Segunda-feira da semana 1', '<input type="date" name="inicio" value="' + esc(c.inicio) + '" required>', 'Termina em ' + br(cal.fim) + '; a 13ª semana vai até ' + br(cal.fim13) + '.') + campo('Já tentou planos parecidos? O que fez parar?', '<textarea name="tentativas" rows="2">' + esc(c.tentativas) + '</textarea>') + '</div>';
    }
    if (k === 2) corpo = dica('Aqui não se discute viabilidade: pergunte “e se fosse possível?”. O “como” vem nas próximas etapas. Uma boa visão incomoda um pouco; se parece fácil, está pequena.') +
      campo('Longo prazo (5 a 10 anos): o que quer conquistar e viver, no pessoal e no profissional', '<textarea name="longo" rows="4" placeholder="Ex.: a Seven atendendo 50 empresas em 3 estados, eu com tardes livres para a família…">' + esc(c.visao.longo) + '</textarea>', 'Travou? Liste tudo o que quer ter, fazer e ser, sem filtro.') +
      campo('O porquê: o que muda para você e para quem você ama', '<textarea name="porque" rows="3">' + esc(c.visao.porque) + '</textarea>', 'Resposta genérica? Pense: como seria uma terça-feira comum nessa vida?') +
      campo('Em 3 anos, estando no caminho: como estaria a vida, com detalhes e números', '<textarea name="tres" rows="3" placeholder="Ex.: 20 clientes, faturamento de R$ X por mês, equipe de 6 pessoas">' + esc(c.visao.tres) + '</textarea>');
    if (k === 3) corpo = dica('Poucas metas trazem foco. Escolha de 1 a 3, com ponto de partida, número de chegada e data (fim da semana 12). Escreva no positivo: “manter 95% dos clientes” em vez de “perder no máximo 5%”.') +
      '<div id="sm-metas">' + (c.metas.length ? c.metas : [{ id: '', texto: '', de: '', para: '', unidade: '', porque: '' }]).map(linhaMeta).join('') + '</div><button type="button" class="btn mini" data-a="add-meta">＋ Meta</button>' +
      '<div class="sm-calib"><h4>Calibragem</h4><p>Você chegaria lá sem mudar nada do que faz hoje? Então a meta está pequena. Parece impossível mesmo com tudo dando certo? Está grande demais para 12 semanas.</p><p>Em metas de negócio, garanta que pelo menos uma produza resultado dentro das 12 semanas.</p></div>';
    if (k === 4) {
      if (!c.metas.length) corpo = '<p class="alerta">Defina as metas na etapa 3 primeiro.</p>';
      else corpo = dica('Táticas são o que você controla; o resultado é consequência. Cada uma começa com verbo, tem quantidade ou frequência e semana definida. Corte até o mínimo que dá conta da meta, e marque com ⭐ a ação fundamental (se só pudesse fazer uma, qual seria?).') +
        c.metas.map(function (m) { return '<section class="sm-meta-t" data-meta="' + m.id + '"><header><h4>' + esc(m.texto) + '</h4><button type="button" class="btn mini fantasma" data-a="regressiva" data-meta="' + m.id + '">🧮 Conta de trás para frente</button></header><div class="sm-tats">' + c.taticas.filter(function (t) { return t.meta === m.id; }).map(function (t) { return linhaTatica(t, c); }).join('') + '</div><button type="button" class="btn mini" data-a="add-tatica" data-meta="' + m.id + '">＋ Tática</button>' +
          campo('Dificuldade prevista → como vou contornar', '<input name="dif:' + m.id + '" value="' + esc(m.dificuldade || '') + '" placeholder="Ex.: ligar para desconhecidos me trava → começar pelas indicações">') + '</section>'; }).join('');
    }
    if (k === 5) {
      const sugest = c.indicadores.length ? c.indicadores : c.metas.reduce(function (a, m) { const f = c.taticas.find(function (t) { return t.meta === m.id && t.fundamental; }); a.push({ id: '', meta: m.id, nome: m.texto + (m.unidade ? ' (' + m.unidade + ')' : ''), tipo: 'resultado' }); if (f) a.push({ id: '', meta: m.id, nome: f.texto, tipo: 'antecedencia' }); return a; }, []);
      const t = c.tempo; const sel = function (nome, v) { return '<select name="' + nome + '">' + opcoes(DIAS, v || 'segunda') + '</select>'; };
      corpo = dica('Indicador de resultado é o número final da meta; indicadores de antecedência são as atividades que puxam o resultado e aparecem antes dele.') +
        '<h4>Indicadores</h4><div id="sm-inds">' + sugest.map(function (x) { return linhaIndicador(x, c); }).join('') + '</div><button type="button" class="btn mini" data-a="add-ind">＋ Indicador</button>' +
        '<h4>Tempo</h4>' + dica('Se o plano não cabe na semana no papel, não vai caber na vida real. Melhor descobrir agora do que na semana 5.') +
        '<div class="linha">' + campo('Horas por semana disponíveis para as táticas', '<input type="number" name="horasDisponiveis" min="1" max="80" value="' + esc(c.horasDisponiveis) + '">', 'Maior carga prevista no plano: ' + Z.maiorCarga(c) + ' h numa semana.') + '</div>' +
        '<div class="sm-blocos">' +
        '<fieldset><legend>Rotina semanal (15 min para pontuar e planejar)</legend>' + sel('rotDia', t.rotDia) + '<input type="time" name="rotHora" value="' + esc(t.rotHora || '07:30') + '"></fieldset>' +
        '<fieldset><legend>Bloco estratégico (3 h seguidas, 1×/semana)</legend>' + sel('estDia', t.estDia || 'terça') + '<input type="time" name="estHora" value="' + esc(t.estHora || '08:00') + '"></fieldset>' +
        '<fieldset><legend>Blocos de reserva (30–60 min por dia)</legend><input type="time" name="resHora" value="' + esc(t.resHora || '11:30') + '"><input type="time" name="resHora2" value="' + esc(t.resHora2 || '17:00') + '"></fieldset>' +
        '<fieldset><legend>Bloco de fuga (3 h longe do trabalho)</legend><input name="fuga" value="' + esc(t.fuga || 'Um sábado à tarde por mês') + '"></fieldset></div>' +
        '<label class="check"><input type="checkbox" name="agenda"> Criar esses blocos na Seven Agenda como eventos recorrentes</label>';
    }
    if (k === 6) {
      const cp = c.compromisso; const chk = Z.checarPlano(c);
      corpo = dica('Nomear os custos antes transforma sacrifício em escolha consciente. E acompanhar a execução com outras pessoas aumenta muito a chance de cumprir.') +
        campo('Do que vou abrir mão para cumprir as ações fundamentais', '<textarea name="custos" rows="2" placeholder="Ex.: séries à noite, 1 hora de sono no sábado">' + esc(cp.custos || '') + '</textarea>') +
        campo('O que costuma me sabotar → resposta combinada de antemão', '<textarea name="sabotador" rows="2" placeholder="Ex.: chegar cansado às 19h → faço só 20 minutos, mas faço">' + esc(cp.sabotador || '') + '</textarea>') +
        '<div class="linha">' + campo('Parceiro(a) de acompanhamento', '<input name="parceiro" value="' + esc(cp.parceiro || '') + '" placeholder="Quem recebe sua pontuação toda semana">') + campo('Reunião semanal de responsabilidade (dia e hora)', '<input name="rsr" value="' + esc(cp.rsr || '') + '" placeholder="Ex.: segunda 8h, 15 min, com a equipe">') + '</div>' +
        campo('Com quem vou compartilhar a visão e as metas', '<input name="compartilhar" value="' + esc(cp.compartilhar || '') + '">') +
        '<section class="sm-check"><h4>Checagem do plano: ' + chk.ok + ' de ' + chk.total + '</h4><ul>' + chk.itens.map(function (i) { return '<li class="' + (i.ok ? 'ok' : 'nao') + '">' + (i.ok ? '✓' : '○') + ' ' + esc(i.t) + (!i.ok && i.dica ? '<small>' + esc(i.dica) + '</small>' : '') + '</li>'; }).join('') + '</ul></section>' +
        '<div class="sm-valida"><h4>Antes de concluir, responda com sinceridade</h4><p>Tem alguma tática que você já sabe que não vai cumprir? Isso cabe na sua semana real? O que você mudaria?</p></div>';
    }
    el.innerHTML = '<div class="sm-as">' + cabAssist(c, k) + '<form id="sm-form" class="cartao">' + corpo + rodape(k) + '</form></div>';
    ligarAssistente(el, c, k);
  }
  function linhaMeta(m) { return '<div class="sm-linha-m" data-id="' + esc(m.id) + '"><input name="mtexto" placeholder="Meta (ex.: Clientes ativos de BPO)" value="' + esc(m.texto) + '"><input name="mde" placeholder="De" value="' + esc(m.de) + '" inputmode="decimal"><input name="mpara" placeholder="Para" value="' + esc(m.para) + '" inputmode="decimal"><input name="munid" placeholder="Unidade" value="' + esc(m.unidade || '') + '"><input name="mporque" placeholder="Por que importa agora" value="' + esc(m.porque || '') + '"><button type="button" class="icone" data-a="rm-linha" aria-label="Remover meta">×</button></div>'; }
  function linhaTatica(t, c) {
    const q = t.quando || { tipo: 'recorrente', de: 1, ate: 12 };
    return '<div class="sm-linha-t" data-id="' + esc(t.id || '') + '"><input name="ttexto" placeholder="Verbo + quantidade (ex.: Enviar 7 propostas)" value="' + esc(t.texto || '') + '">' +
      '<select name="ttipo" aria-label="Quando">' + opcoes([{ v: 'recorrente', t: 'Recorrente' }, { v: 'unica', t: 'Uma vez' }], q.tipo) + '</select>' +
      '<input type="number" name="tde" min="1" max="12" value="' + (q.tipo === 'unica' ? q.semana : q.de || 1) + '" aria-label="Semana inicial" title="Semana"><span class="sm-ate"' + (q.tipo === 'unica' ? ' hidden' : '') + '>a <input type="number" name="tate" min="1" max="12" value="' + (q.ate || 12) + '" aria-label="Semana final"></span>' +
      '<input type="number" name="thoras" min="0" step="0.5" value="' + esc(t.horas || '') + '" placeholder="h/sem" aria-label="Horas por semana" title="Horas na semana">' +
      (c.equipe ? '<input name="tresp" placeholder="Responsável" value="' + esc(t.resp || '') + '">' : '') +
      '<label class="sm-fund" title="Ação fundamental"><input type="checkbox" name="tfund"' + (t.fundamental ? ' checked' : '') + '>⭐</label><button type="button" class="icone" data-a="rm-linha" aria-label="Remover tática">×</button></div>';
  }
  function linhaIndicador(x, c) { return '<div class="sm-linha-i" data-id="' + esc(x.id || '') + '"><select name="imeta" aria-label="Meta">' + opcoes(c.metas.map(function (m) { return { v: m.id, t: m.texto }; }), x.meta) + '</select><input name="inome" value="' + esc(x.nome) + '" placeholder="Indicador"><select name="itipo" aria-label="Tipo">' + opcoes([{ v: 'resultado', t: 'Resultado' }, { v: 'antecedencia', t: 'Antecedência' }], x.tipo) + '</select><button type="button" class="icone" data-a="rm-linha" aria-label="Remover indicador">×</button></div>'; }

  function lerEtapa(f, c, k) {
    const fd = new FormData(f);
    if (k === 1) {
      c.titulo = fd.get('titulo').trim() || c.titulo; c.equipe = !!fd.get('equipe'); c.pessoas = fd.get('pessoas'); c.tentativas = fd.get('tentativas');
      Z.AREAS.forEach(function (a) { c.areas[a] = Number(fd.get('area:' + a)); }); c.foco = fd.getAll('foco');
      const ini = fd.get('inicio'); if (ini) { const s = Z.segunda(ini); if (s !== ini) aviso('Ajustado para a segunda-feira ' + br(s) + '.'); c.inicio = s; }
    }
    if (k === 2) c.visao = { longo: fd.get('longo').trim(), porque: fd.get('porque').trim(), tres: fd.get('tres').trim() };
    if (k === 3) {
      const novas = []; f.querySelectorAll('.sm-linha-m').forEach(function (r) { const t = r.querySelector('[name=mtexto]').value.trim(); if (!t) return; novas.push({ id: r.dataset.id || Dados.id('mt'), texto: t, de: r.querySelector('[name=mde]').value.trim(), para: r.querySelector('[name=mpara]').value.trim(), unidade: r.querySelector('[name=munid]').value.trim(), porque: r.querySelector('[name=mporque]').value.trim(), dificuldade: (c.metas.find(function (m) { return m.id === r.dataset.id; }) || {}).dificuldade || '' }); });
      if (novas.length > 3 && !confirm('Mais de 3 metas costuma diluir o foco. Continuar assim mesmo?')) return false;
      c.metas = novas; c.taticas = c.taticas.filter(function (t) { return novas.some(function (m) { return m.id === t.meta; }); });
    }
    if (k === 4) {
      const novas = []; f.querySelectorAll('.sm-meta-t').forEach(function (sec) {
        const mid = sec.dataset.meta; const m = c.metas.find(function (x) { return x.id === mid; }); if (m) m.dificuldade = fd.get('dif:' + mid) || '';
        sec.querySelectorAll('.sm-linha-t').forEach(function (r) { const t = r.querySelector('[name=ttexto]').value.trim(); if (!t) return; const tipo = r.querySelector('[name=ttipo]').value; const de = Math.max(1, Math.min(12, Number(r.querySelector('[name=tde]').value) || 1)); const ate = Math.max(de, Math.min(12, Number((r.querySelector('[name=tate]') || {}).value) || 12));
          const resp = r.querySelector('[name=tresp]');
          novas.push({ id: r.dataset.id || Dados.id('tt'), meta: mid, texto: t, quando: tipo === 'unica' ? { tipo: 'unica', semana: de } : { tipo: 'recorrente', de: de, ate: ate }, horas: Number(r.querySelector('[name=thoras]').value) || 0, resp: resp ? resp.value.trim() : '', fundamental: r.querySelector('[name=tfund]').checked }); });
      });
      c.taticas = novas;
    }
    if (k === 5) {
      const inds = []; f.querySelectorAll('.sm-linha-i').forEach(function (r) { const n = r.querySelector('[name=inome]').value.trim(); if (!n) return; inds.push({ id: r.dataset.id || Dados.id('ind'), meta: r.querySelector('[name=imeta]').value, nome: n, tipo: r.querySelector('[name=itipo]').value }); });
      c.indicadores = inds; c.horasDisponiveis = Number(fd.get('horasDisponiveis')) || '';
      const t = { rotDia: fd.get('rotDia'), rotHora: fd.get('rotHora'), estDia: fd.get('estDia'), estHora: fd.get('estHora'), resHora: fd.get('resHora'), resHora2: fd.get('resHora2'), fuga: fd.get('fuga') };
      t.rotina = t.rotDia + ' ' + t.rotHora; t.estrategico = t.estDia + ', ' + t.estHora + ' (3 h)'; t.reserva = [t.resHora, t.resHora2].filter(Boolean).join(' e ') + ', todo dia'; c.tempo = t;
      if (fd.get('agenda') && Telas.agenda) {
        const h = function (x) { return x ? x.replace(':', 'h').replace(/h00$/, 'h') : ''; };
        Telas.agenda.criar('Pontuar e planejar a semana #12semanas toda ' + t.rotDia + ' ' + h(t.rotHora));
        Telas.agenda.criar('Bloco estratégico (3 h) #12semanas toda ' + t.estDia + ' ' + h(t.estHora));
        if (t.resHora) Telas.agenda.criar('Bloco de reserva #12semanas todo dia ' + h(t.resHora));
        if (t.resHora2) Telas.agenda.criar('Bloco de reserva #12semanas todo dia ' + h(t.resHora2));
        aviso('Blocos criados na Seven Agenda.');
      }
    }
    if (k === 6) { c.compromisso = { custos: fd.get('custos'), sabotador: fd.get('sabotador'), parceiro: fd.get('parceiro'), rsr: fd.get('rsr'), compartilhar: fd.get('compartilhar') }; }
    return true;
  }
  function ligarAssistente(el, c, k) {
    const f = el.querySelector('#sm-form');
    f.oninput = function (ev) { if (ev.target.type === 'range') ev.target.nextElementSibling.textContent = ev.target.value; };
    f.onchange = function (ev) {
      if (ev.target.name === 'ttipo') { const r = ev.target.closest('.sm-linha-t'); r.querySelector('.sm-ate').hidden = ev.target.value === 'unica'; }
      if (k === 6) { lerEtapa(f, c, 6); salvar(); const chk = Z.checarPlano(c); const box = f.querySelector('.sm-check'); if (box) box.innerHTML = '<h4>Checagem do plano: ' + chk.ok + ' de ' + chk.total + '</h4><ul>' + chk.itens.map(function (i) { return '<li class="' + (i.ok ? 'ok' : 'nao') + '">' + (i.ok ? '✓' : '○') + ' ' + esc(i.t) + (!i.ok && i.dica ? '<small>' + esc(i.dica) + '</small>' : '') + '</li>'; }).join('') + '</ul>'; }
    };
    f.onsubmit = function (ev) { ev.preventDefault(); if (!lerEtapa(f, c, k)) return; if (k < 6) { c.etapa = Math.max(c.etapa || 1, k + 1); salvar(); location.hash = '#/semanas/assist/' + c.id + '/' + (k + 1); } else { c.etapa = 7; salvar(); aviso('Plano concluído. Boa semana 1!'); location.hash = '#/semanas/plano/' + c.id; } };
    f.onclick = async function (ev) {
      const ir = ev.target.closest('[data-ir]'); if (ir) { lerEtapa(f, c, k); salvar(); location.hash = '#/semanas/assist/' + c.id + '/' + ir.dataset.ir; return; }
      const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'rm-linha') b.closest('[data-id]').remove();
      if (a === 'add-meta') f.querySelector('#sm-metas').insertAdjacentHTML('beforeend', linhaMeta({ id: '', texto: '', de: '', para: '' }));
      if (a === 'add-tatica') b.previousElementSibling.insertAdjacentHTML('beforeend', linhaTatica({ quando: { tipo: 'recorrente', de: 1, ate: 12 } }, c));
      if (a === 'add-ind') f.querySelector('#sm-inds').insertAdjacentHTML('beforeend', linhaIndicador({ meta: (c.metas[0] || {}).id, nome: '', tipo: 'antecedencia' }, c));
      if (a === 'regressiva') {
        const r = await modal({ titulo: 'Conta de trás para frente', corpo: '<p class="mini mudo">Use suas taxas reais. Se não souber, estime: o valor fica marcado como suposição e vale incluir uma tática para medir a taxa nas primeiras semanas.</p><div class="linha">' + campo('Meta (R$ ou unidades)', '<input name="meta" inputmode="decimal" required>') + campo('Tíquete médio (R$ por venda)', '<input name="ticket" inputmode="decimal" required>') + campo('Conversão (% de propostas que viram venda)', '<input name="conv" inputmode="decimal" value="25" required>') + '</div>' + campo('Ação', '<input name="acao" value="Enviar propostas">') + '<label class="check"><input type="checkbox" name="sup" checked> A conversão é uma estimativa (suposição)</label>',
          validar: function (fd) { return [fd.get('meta'), fd.get('ticket'), fd.get('conv')].some(function (v) { return !(Nucleo.lerNumeroBR(v) > 0); }) ? 'Preencha números maiores que zero.' : ''; } });
        if (!r) return;
        const x = Z.regressiva({ meta: Nucleo.lerNumeroBR(r.get('meta')), ticket: Nucleo.lerNumeroBR(r.get('ticket')), conversao: Nucleo.lerNumeroBR(r.get('conv')) });
        const sec = f.querySelector('.sm-meta-t[data-meta="' + b.dataset.meta + '"] .sm-tats');
        sec.insertAdjacentHTML('beforeend', linhaTatica({ texto: r.get('acao').trim().replace(/^(\S+)\s/, '$1 ' + x.porSemana + ' ') + ' por semana', quando: { tipo: 'recorrente', de: 1, ate: 12 }, fundamental: true }, c));
        if (r.get('sup')) sec.insertAdjacentHTML('beforeend', linhaTatica({ texto: 'Medir a taxa real de conversão das propostas', quando: { tipo: 'unica', semana: 4 } }, c));
        aviso(x.vendas + ' vendas → ' + x.propostas + ' propostas → ' + x.porSemana + ' por semana.');
      }
    };
  }

  // ---------- semana ----------
  function telaSemana(el, id, n) {
    const c = ciclo(id); n = Math.max(1, Math.min(12, Number(n) || 1)); if (!c) { location.hash = '#/semanas'; return; }
    const cal = Z.calendario(c.inicio); const s = cal.semanas[n - 1]; const ts = Z.taticasDaSemana(c, n); const ex = c.execucao[n] || {}; const p = Z.pontuacao(c, n); const l = Z.leitura(p.pct);
    const notas = c.notasSemana[n] || {}; const val = c.valores[n] || {};
    const recentes = []; for (let k = Math.max(1, n - 2); k <= n; k++) if (c.pontuadas[k]) recentes.push(Z.pontuacao(c, k).pct);
    const mediaRec = recentes.length ? Math.round(recentes.reduce(function (a, b) { return a + b; }, 0) / recentes.length) : null;
    let altas = 0; for (let k = 1; k <= n; k++) if (c.pontuadas[k] && Z.pontuacao(c, k).pct >= 85) altas++;
    el.innerHTML = '<div class="sm-semana"><header class="sm-as-cab"><a class="btn mini fantasma" href="#/semanas">← Painel</a><h2>Semana ' + n + ' <small>' + br(s.inicio) + ' a ' + br(s.fim) + ' · ' + esc(s.fase) + '</small></h2><span class="ds-espaco"></span><a class="btn mini" href="#/semanas/semana/' + c.id + '/' + Math.max(1, n - 1) + '"' + (n === 1 ? ' hidden' : '') + '>‹</a><a class="btn mini" href="#/semanas/semana/' + c.id + '/' + Math.min(12, n + 1) + '"' + (n === 12 ? ' hidden' : '') + '>›</a></header>' +
      '<div class="sm-grade"><section class="cartao"><h3>Plano da semana</h3>' + (ts.length ? c.metas.map(function (m) { const tm = ts.filter(function (t) { return t.meta === m.id; }); return tm.length ? '<h4>' + esc(m.texto) + '</h4>' + tm.map(function (t) { return '<label class="check sm-t"><input type="checkbox" data-feito="' + t.id + '"' + (ex[t.id] ? ' checked' : '') + '> ' + esc(t.texto) + (t.resp ? ' <small class="mudo">· ' + esc(t.resp) + '</small>' : '') + (t.fundamental ? ' ⭐' : '') + '</label>'; }).join('') : ''; }).join('') : '<p class="mudo">Nenhuma tática vence nesta semana.</p>') +
      '<p class="mini mudo">Cada tática conta como cumprida ou não. “Treinar 3 vezes” feito 2 vezes não foi cumprida: a pontuação só serve se for honesta.</p>' +
      '<div class="grupo-botoes"><button class="btn mini" data-a="agenda">🗓 Pôr as táticas na Seven Agenda</button></div></section>' +
      '<section class="cartao sm-placar"><h3>Pontuação</h3><b class="sm-pct ' + l.nivel + '">' + (p.pct != null ? p.pct + '%' : '—') + '</b><p>' + p.feitas + ' de ' + p.previstas + ' táticas</p><p class="mini">' + esc(l.t) + '</p>' +
      '<button class="btn ' + (c.pontuadas[n] ? 'fantasma' : 'primario') + '" data-a="pontuar">' + (c.pontuadas[n] ? '✓ Semana pontuada (desfazer)' : 'Registrar pontuação da semana') + '</button>' +
      '<button class="btn mini fantasma" data-a="compartilhar">Enviar pontuação ao parceiro</button></section>' +
      '<section class="cartao"><h3>Indicadores</h3>' + (c.indicadores.length ? c.indicadores.map(function (x) { return '<label class="sm-ind"><span>' + esc(x.nome) + ' <small class="mudo">' + (x.tipo === 'resultado' ? 'resultado' : 'antecedência') + '</small></span><input inputmode="decimal" data-ind="' + x.id + '" value="' + esc(val[x.id] != null ? val[x.id] : '') + '" aria-label="' + esc(x.nome) + '"></label>'; }).join('') : '<p class="mudo">Sem indicadores. Defina na etapa 5 do plano.</p>') +
      '<h4>Diagnóstico</h4>' + (function () { const resultadoBom = c.metas.every(function (m) { const ind = c.indicadores.find(function (x) { return x.meta === m.id && x.tipo === 'resultado'; }); if (!ind) return true; const v = val[ind.id]; const pr = v != null && v !== '' ? Z.progressoMeta(m, v) : null; return pr == null || pr >= Math.round(n / 12 * 100) - 10; }); const dg = Z.diagnostico(mediaRec, resultadoBom, altas); return '<p><b>' + esc(dg.t) + '</b></p><p class="mini">' + esc(dg.acao) + '</p>'; })() + '</section>' +
      '<section class="cartao"><h3>Revisão da semana</h3>' + campo('O que atrapalhou', '<textarea data-nota="atrapalhou" rows="2">' + esc(notas.atrapalhou || '') + '</textarea>') + campo('O que funcionou', '<textarea data-nota="funcionou" rows="2">' + esc(notas.funcionou || '') + '</textarea>') + campo('O que muda na próxima semana', '<textarea data-nota="muda" rows="2">' + esc(notas.muda || '') + '</textarea>') + '</section></div></div>';
    el.onchange = function (ev) {
      const t = ev.target;
      if (t.dataset.feito) { c.execucao[n] = c.execucao[n] || {}; c.execucao[n][t.dataset.feito] = t.checked; salvar(); App.redesenhar(); }
      if (t.dataset.ind) { c.valores[n] = c.valores[n] || {}; c.valores[n][t.dataset.ind] = t.value.trim() === '' ? '' : (Nucleo.lerNumeroBR(t.value) || t.value.trim()); salvar(); }
      if (t.dataset.nota) { c.notasSemana[n] = c.notasSemana[n] || {}; c.notasSemana[n][t.dataset.nota] = t.value; salvar(); }
    };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'pontuar') { if (c.pontuadas[n]) delete c.pontuadas[n]; else c.pontuadas[n] = Date.now(); salvar(); App.redesenhar(); }
      if (b.dataset.a === 'agenda' && Telas.agenda) { ts.filter(function (t) { return !ex[t.id]; }).forEach(function (t) { Telas.agenda.criar(t.texto + ' #12semanas', { data: s.inicio < hoje() && hoje() <= s.fim ? hoje() : s.inicio, tags: ['12semanas'] }); }); Dados.salvar(); aviso('Táticas pendentes enviadas para a Seven Agenda.'); }
      if (b.dataset.a === 'compartilhar') {
        const txt = 'Semana ' + n + ' do meu ciclo de 12 semanas: ' + (p.pct != null ? p.pct + '%' : '—') + ' (' + p.feitas + ' de ' + p.previstas + ' táticas).' + (notas.atrapalhou ? '\nO que atrapalhou: ' + notas.atrapalhou : '') + (notas.muda ? '\nO que muda: ' + notas.muda : '') + '\n\nLucas Neves | Seven';
        const r = await modal({ titulo: 'Enviar ao parceiro de acompanhamento', botao: 'Abrir WhatsApp', corpo: '<p class="mini mudo">O sistema só abre o WhatsApp; quem envia é você.</p>' + campo('Mensagem', '<textarea name="m" rows="7">' + esc(txt) + '</textarea>') });
        if (r) window.open('https://wa.me/?text=' + encodeURIComponent(r.get('m')), '_blank', 'noopener');
      }
    };
  }

  // ---------- plano, revisão, ciclos ----------
  function telaPlano(el, id) {
    const c = ciclo(id); if (!c) { location.hash = '#/semanas'; return; }
    const md = Z.markdown(c); const chk = Z.checarPlano(c); const cal = Z.calendario(c.inicio);
    el.innerHTML = '<div class="sm-plano"><header class="sm-as-cab no-print"><a class="btn mini fantasma" href="#/semanas">← Painel</a><h2>Plano</h2><span class="ds-espaco"></span><a class="btn mini" href="#/semanas/assist/' + c.id + '/1">Editar</a><button class="btn mini" data-a="md">Baixar .md</button><button class="btn mini" data-a="imprimir">Imprimir</button></header>' +
      (chk.ok < chk.total ? '<div class="sm-alerta no-print">Checagem: ' + chk.ok + ' de ' + chk.total + ' itens. <a href="#/semanas/assist/' + c.id + '/6">Ver o que falta</a></div>' : '') +
      '<article class="cartao sm-doc">' + md.split('\n').map(function (l) {
        if (/^# /.test(l)) return '<h1>' + esc(l.slice(2)) + '</h1>'; if (/^## /.test(l)) return '<h2>' + esc(l.slice(3)) + '</h2>'; if (/^### /.test(l)) return '<h3>' + esc(l.slice(4)) + '</h3>';
        if (/^\|---/.test(l)) return ''; if (/^\|/.test(l)) return '<div class="sm-tr">' + l.split('|').slice(1, -1).map(function (x) { return '<span>' + esc(x.trim()) + '</span>'; }).join('') + '</div>';
        if (/^- /.test(l)) return '<p class="sm-li">• ' + esc(l.slice(2)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</p>';
        return l.trim() ? '<p>' + esc(l).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</p>' : '';
      }).join('') + '<h2>Calendário</h2>' + cal.semanas.map(function (s) { return '<div class="sm-tr"><span>' + (s.n === 13 ? '13ª' : s.n) + '</span><span>' + br(s.inicio) + ' a ' + br(s.fim) + '</span><span>' + esc(s.fase) + '</span><span>' + Z.taticasDaSemana(c, s.n).length + ' tática(s)</span></div>'; }).join('') + '</article></div>';
    el.onclick = function (ev) { const b = ev.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'md') UI.baixar((c.titulo || 'plano') + '.md', md, 'text/markdown;charset=utf-8'); if (b.dataset.a === 'imprimir') window.print(); };
  }
  function telaRevisao(el, id) {
    const c = ciclo(id); if (!c) { location.hash = '#/semanas'; return; }
    const med = Z.media(c, 12);
    el.innerHTML = '<div class="sm-as"><header class="sm-as-cab"><a class="btn mini fantasma" href="#/semanas">← Painel</a><h2>13ª semana: revisão do ciclo</h2></header><form id="sm-rev" class="cartao"><p>Use esta semana para recuperar pendências, revisar o ciclo e comemorar. Alguns dias de descanso entre ciclos fazem bem.</p><div class="sm-kpis"><div class="sm-kpi"><b>' + (med != null ? med + '%' : '—') + '</b><small>pontuação média</small></div>' + c.metas.map(function (m) { return '<div class="sm-kpi"><b>' + esc(m.para) + ' ' + esc(m.unidade || '') + '</b><small>' + esc(m.texto) + '</small></div>'; }).join('') + '</div>' + barras(c, 13) +
      Z.REVISAO.map(function (q, i) { return campo((i + 1) + '. ' + q, '<textarea name="q' + i + '" rows="2">' + esc(c.revisao['q' + i] || '') + '</textarea>'); }).join('') +
      '<footer class="sm-as-rod"><button type="button" class="btn" data-a="proximo">Preparar o próximo ciclo →</button><button class="btn primario">Salvar revisão</button></footer></form></div>';
    const f = el.querySelector('#sm-rev');
    const ler = function () { const fd = new FormData(f); Z.REVISAO.forEach(function (_, i) { c.revisao['q' + i] = fd.get('q' + i); }); salvar(); };
    f.onsubmit = function (ev) { ev.preventDefault(); ler(); aviso('Revisão salva.'); };
    f.onclick = function (ev) { if (ev.target.closest('[data-a=proximo]')) { ler(); const n = novoCiclo(c); aviso('Novo ciclo criado a partir do anterior: revise a visão e escolha as novas metas.'); location.hash = '#/semanas/assist/' + n.id + '/2'; } };
  }
  function telaCiclos(el) {
    const s = e();
    el.innerHTML = '<div class="sm-as"><header class="sm-as-cab"><a class="btn mini fantasma" href="#/semanas">← Painel</a><h2>Ciclos</h2><span class="ds-espaco"></span><button class="btn mini primario" data-a="novo">＋ Novo ciclo</button></header>' +
      (s.ciclos.length ? s.ciclos.slice().reverse().map(function (c) { const cal = Z.calendario(c.inicio); const m = Z.media(c, 12); return '<div class="cartao sm-ciclo' + (c.id === (ativo() || {}).id ? ' ativo' : '') + '" data-c="' + c.id + '"><div><b>' + esc(c.titulo) + '</b><small>' + br(cal.inicio) + ' a ' + br(cal.fim) + ' · ' + c.metas.length + ' meta(s) · média ' + (m != null ? m + '%' : '—') + (c.etapa <= 6 ? ' · plano na etapa ' + c.etapa : '') + '</small></div><button class="btn mini" data-a="ativar">' + (c.id === (ativo() || {}).id ? 'Ativo' : 'Tornar ativo') + '</button><button class="icone" data-a="excluir" aria-label="Excluir ciclo">🗑</button></div>'; }).join('') : '<p class="mudo">Nenhum ciclo.</p>') + '</div>';
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return; const c = b.closest('[data-c]') && ciclo(b.closest('[data-c]').dataset.c);
      if (b.dataset.a === 'novo') { const n = novoCiclo(ativo() && ativo().etapa > 6 ? ativo() : null); location.hash = '#/semanas/assist/' + n.id + '/1'; }
      if (b.dataset.a === 'ativar') { s.ativo = c.id; salvar(); location.hash = '#/semanas'; }
      if (b.dataset.a === 'excluir' && await confirmar('Excluir ciclo', 'Excluir <b>' + esc(c.titulo) + '</b> e todo o histórico?', 'Excluir')) { s.ciclos = s.ciclos.filter(function (x) { return x !== c; }); if (s.ativo === c.id) s.ativo = null; salvar(); App.redesenhar(); }
    };
  }

  Telas.semanas = {
    titulo: 'Seven Metas',
    render: function (el, sub, param) {
      el.onchange = null;
      const p = String(param || '').split('/');
      if (sub === 'assist') return telaAssistente(el, p[0], p[1]);
      if (sub === 'semana') return telaSemana(el, p[0], p[1]);
      if (sub === 'plano') return telaPlano(el, p[0]);
      if (sub === 'revisao') return telaRevisao(el, p[0]);
      if (sub === 'ciclos') return telaCiclos(el);
      telaPainel(el);
    }
  };
})();
