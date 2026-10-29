/* Seven Relatórios: relatório de performance para o cliente (imprimir, PDF, WhatsApp ou e-mail) e a base de
   performance de todos os clientes. Números do Seven Processo; cada período é comparado com o anterior para
   mostrar se estamos avançando. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, moeda, campo } = UI;
  const P = Performance, G = Graficos;
  const R = function () { return Telas.comissao.rel; };
  const pc = function (v, c) { return v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: c == null ? 1 : c }) + '%'; };
  const dataBR = function (iso) { return iso ? iso.split('-').reverse().join('/') : '—'; };
  let secoesAbertas = false;
  const ROTULO_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const SECOES = [['metas', 'Metas'], ['parecer', 'Parecer e próximos passos'], ['trabalho', 'Trabalho da Seven'], ['perdas', 'Motivos de perda'], ['concorrencia', 'Deságio e concorrência'], ['distribuicao', 'Por órgão, portal e UF'], ['agenda', 'Agenda à frente'], ['habilitacao', 'Habilitação']];
  const SECOES_PADRAO = {}; SECOES.forEach(function (x) { SECOES_PADRAO[x[0]] = true; });
  function prefs() {
    const d = Dados.e; const hoje = new Date(); const mm = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
    const pad = { cliente: d.empresaAtiva || null, tipo: 'mes', mes: mm, trimestre: hoje.getFullYear() + '-T' + (Math.floor(hoje.getMonth() / 3) + 1), ano: String(hoje.getFullYear()), de: '', ate: '', comissao: false, listas: true };
    // completa no próprio objeto: quem guardou a referência (botões da tela) continua gravando no lugar certo
    const r = d.relatorios = d.relatorios || {}; Object.keys(pad).forEach(function (k) { if (r[k] === undefined) r[k] = pad[k]; }); r.secoes = r.secoes || {}; Object.keys(SECOES_PADRAO).forEach(function (k) { if (r.secoes[k] === undefined) r.secoes[k] = true; }); r.metas = r.metas || {}; r.pareceres = r.pareceres || {}; r.historico = r.historico || [];
    return r;
  }
  // período escolhido → { de, ate, rotulo }
  function periodo(pr) {
    if (pr.tipo === 'trimestre') { const m = String(pr.trimestre).match(/^(\d{4})-T([1-4])$/); if (m) { const a = Number(m[1]), t = Number(m[2]); const ini = P.mes(a + '-' + String((t - 1) * 3 + 1).padStart(2, '0')), fim = P.mes(a + '-' + String(t * 3).padStart(2, '0')); return { de: ini.de, ate: fim.ate, rotulo: t + 'º trimestre de ' + a }; } }
    if (pr.tipo === 'ano' && /^\d{4}$/.test(pr.ano)) return { de: pr.ano + '-01-01', ate: pr.ano + '-12-31', rotulo: 'ano de ' + pr.ano };
    if (pr.tipo === 'personalizado' && pr.de && pr.ate && pr.de <= pr.ate) return { de: pr.de, ate: pr.ate, rotulo: dataBR(pr.de) + ' a ' + dataBR(pr.ate) };
    const m = P.mes(/^\d{4}-\d{2}$/.test(pr.mes) ? pr.mes : new Date().toISOString().slice(0, 7)); return { de: m.de, ate: m.ate, rotulo: R().nomeMes(m.de.slice(0, 7)) };
  }
  function rotuloAnterior(a) { const ini = a.de, fim = a.ate; if (ini.slice(8) === '01' && P.mes(fim.slice(0, 7)).ate === fim) { if (ini.slice(0, 7) === fim.slice(0, 7)) return R().nomeMes(ini.slice(0, 7)); return R().nomeMes(ini.slice(0, 7)) + ' a ' + R().nomeMes(fim.slice(0, 7)); } return dataBR(ini) + ' a ' + dataBR(fim); }
  function controles(pr, comBase) {
    const es = Dados.e.empresas || []; const hoje = new Date(); const anos = []; for (let a = hoje.getFullYear(); a >= hoje.getFullYear() - 4; a--) anos.push(String(a));
    const tris = []; anos.forEach(function (a) { for (let t = 4; t >= 1; t--) tris.push(a + '-T' + t); });
    return '<form class="cartao no-print rl-ctrl" id="rl-f" autocomplete="off"><div class="linha">' +
      (comBase ? '' : campo('Cliente', '<select name="cliente"><option value="">Todos os clientes</option>' + es.map(function (x) { return '<option value="' + esc(x.id) + '"' + (pr.cliente === x.id ? ' selected' : '') + '>' + esc(x.fantasia || x.razao) + '</option>'; }).join('') + '</select>')) +
      campo('Período', '<select name="tipo">' + [['mes', 'Mês'], ['trimestre', 'Trimestre'], ['ano', 'Ano'], ['personalizado', 'Personalizado']].map(function (t) { return '<option value="' + t[0] + '"' + (pr.tipo === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>') +
      (pr.tipo === 'mes' ? campo('Mês', '<input type="month" name="mes" value="' + esc(pr.mes) + '">') : '') +
      (pr.tipo === 'trimestre' ? campo('Trimestre', '<select name="trimestre">' + tris.map(function (t) { return '<option value="' + t + '"' + (pr.trimestre === t ? ' selected' : '') + '>' + t.replace('-T', ' · ') + 'º tri</option>'; }).join('') + '</select>') : '') +
      (pr.tipo === 'ano' ? campo('Ano', '<select name="ano">' + anos.map(function (a) { return '<option' + (pr.ano === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select>') : '') +
      (pr.tipo === 'personalizado' ? campo('De', '<input type="date" name="de" value="' + esc(pr.de) + '">') + campo('Até', '<input type="date" name="ate" value="' + esc(pr.ate) + '">') : '') + '</div>' +
      (comBase ? '' : '<label class="check"><input type="checkbox" name="listas"' + (pr.listas ? ' checked' : '') + '> Incluir as licitações (ganhas, em andamento e próximos recebimentos)</label><label class="check"><input type="checkbox" name="comissao"' + (pr.comissao ? ' checked' : '') + '> Incluir a comissão da Seven no relatório</label><details class="rl-secoes"><summary>Seções do relatório</summary><div class="rl-secoes-l">' + SECOES.map(function (x) { return '<label class="check"><input type="checkbox" name="sec_' + x[0] + '"' + (pr.secoes[x[0]] ? ' checked' : '') + '> ' + esc(x[1]) + '</label>'; }).join('') + '</div></details>') +
      '<div class="grupo-botoes"><button type="button" class="btn primario" data-a="imprimir">🖨 Imprimir</button><button type="button" class="btn" data-a="pdf">⬇ Baixar PDF</button>' + (comBase ? '' : '<button type="button" class="btn" data-a="whatsapp"' + (pr.cliente ? '' : ' disabled title="Escolha um cliente"') + '>WhatsApp</button><button type="button" class="btn" data-a="email"' + (pr.cliente ? '' : ' disabled title="Escolha um cliente"') + '>E-mail</button>') + '</div></form>';
  }
  function abas(sub) { return '<nav class="abas no-print" aria-label="Seven Relatórios">' + [['', '📊 Relatório do cliente'], ['base', '🗂 Base de performance'], ['historico', '🕘 Histórico']].map(function (x) { return '<a href="#/relatorios' + (x[0] ? '/' + x[0] : '') + '" class="' + ((sub || '') === x[0] ? 'ativa' : '') + '">' + x[1] + '</a>'; }).join('') + '</nav>'; }

  function variacao(c, moedaFmt) {
    if (c.anterior == null || c.atual == null) return '';
    const seta = c.sentido === 'subiu' ? '▲' : c.sentido === 'caiu' ? '▼' : '='; const cls = c.sentido === 'subiu' ? 'rl-sobe' : c.sentido === 'caiu' ? 'rl-cai' : 'rl-igual';
    const txt = c.chave === 'taxa' ? (c.delta == null ? '' : (c.delta > 0 ? '+' : '') + Number(c.delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' p.p.') : (c.pct != null ? (c.pct > 0 ? '+' : '') + Number(c.pct).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + '%' : (c.sentido === 'igual' ? 'igual' : 'antes: ' + (moedaFmt ? moeda(c.anterior) : c.anterior)));
    return '<span class="rl-var ' + cls + '">' + seta + ' ' + esc(txt) + '</span>';
  }
  function valorMetrica(chave, v) { return chave === 'taxa' ? pc(v) : /valor|faturado|recebido/.test(chave) ? moeda(v) : (v == null ? '—' : v); }
  function leitura(c, atual, d, pr, id) {
    const l = []; const by = {}; c.forEach(function (x) { by[x.chave] = x; });
    const frase = function (x, nome, fmt) { if (x.anterior == null) return; if (x.sentido === 'igual') { if (x.atual) l.push(nome + ' estável em ' + fmt(x.atual) + '.'); return; } l.push(nome + (x.sentido === 'subiu' ? ' cresceu' : ' caiu') + (x.pct != null && x.chave !== 'taxa' ? ' ' + Math.abs(Math.round(x.pct)) + '%' : '') + ': de ' + fmt(x.anterior) + ' para ' + fmt(x.atual) + '.'); };
    frase(by.valorGanho, 'O valor ganho', moeda); frase(by.ganhas, 'O número de licitações ganhas', String);
    if (by.taxa.atual != null && by.taxa.anterior != null) frase(by.taxa, 'A taxa de sucesso', function (v) { return pc(v); }); else if (by.taxa.atual != null) l.push('Taxa de sucesso no período: ' + pc(by.taxa.atual) + ' (' + atual.ganhas + ' de ' + atual.disputadas + ' decididas).');
    frase(by.recebido, 'O valor recebido dos órgãos', moeda); frase(by.novas, 'O número de novas oportunidades', String);
    const pe = P.perdas(d.cartoes, atual.de, atual.ate); if (pe.principal && pe.lista.length > 1) l.push('Principal motivo das perdas: ' + pe.principal.nome.toLowerCase() + ' (' + pe.principal.n + ' de ' + pe.lista.length + ').');
    if (pr && id) P.metas(pr.metas[id], atual).forEach(function (m) { l.push('Meta de ' + m.nome.toLowerCase() + ': ' + pc(m.pct, 0) + ' atingida' + (m.atingida ? ' ✓' : '') + '.'); });
    if (d.totais.atrasado) l.push('Há ' + moeda(d.totais.atrasado) + ' em notas fiscais vencidas: vale cobrar o órgão.');
    const f = R().funilReal(d.funil).calc; if (f.gargalo && f.gargalo.conversao != null) l.push('No funil acumulado, a maior perda está em "' + f.gargalo.nome + '" (' + pc(f.gargalo.conversao) + ' passam da etapa anterior).');
    if (!l.length) l.push('Sem movimento suficiente para comparar os períodos.');
    return l;
  }
  const VEREDITO = { avancando: ['📈 Estamos avançando', 'Mais indicadores principais melhoraram do que pioraram em relação ao período anterior.', 'ok'], estavel: ['➡️ Estável', 'Os indicadores principais ficaram equilibrados em relação ao período anterior.', ''], atencao: ['⚠️ Ponto de atenção', 'Mais indicadores principais pioraram do que melhoraram em relação ao período anterior.', 'ruim'] };

  // ---------- seções complementares do relatório ----------
  function chavePer(id, per) { return (id || 'todos') + '|' + per.de + '|' + per.ate; }
  function parecerDe(pr, id, per) { return pr.pareceres[chavePer(id, per)] || {}; }
  const btnEd = function (a, t, extra) { return '<button type="button" class="btn mini fantasma no-print" data-a="' + a + '"' + (extra || '') + '>' + t + '</button>'; };
  const hoje = function () { return new Date().toISOString().slice(0, 10); };
  function secMetas(pr, id, atual) {
    if (!id) return '';
    const m = P.metas(pr.metas[id], atual);
    if (!m.length) return '<section class="cartao no-print rl-vazia"><h3>Metas</h3><p class="mini mudo">Defina as metas mensais deste cliente (valor ganho, recebido, licitações ganhas) para o relatório mostrar o progresso.</p>' + btnEd('metas', '🎯 Definir metas') + '</section>';
    return '<section class="cartao rl-metas"><h3>Metas do período ' + btnEd('metas', '✎ Editar metas') + '</h3>' + m.map(function (x) {
      if (x.chave !== 'ganhas') return R().barraMeta(x.atual, x.alvo, x.nome + (x.atingida ? ' ✓' : ''));
      const p = Math.max(0, x.pct || 0); return '<div class="cm-meta"><div class="cm-meta-txt"><span>' + esc(x.nome) + (x.atingida ? ' ✓' : '') + '</span><b>' + x.atual + ' de ' + String(x.alvo).replace('.', ',') + ' (' + pc(p, 0) + ')</b></div><div class="cm-meta-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(Math.min(100, p)) + '"><i style="width:' + Math.min(100, p) + '%"' + (p >= 100 ? ' class="ok"' : '') + '></i></div></div>';
    }).join('') + '<p class="mini mudo">Metas mensais × meses do período.</p></section>';
  }
  function paragrafos(t) { return String(t || '').split(/\n+/).filter(function (x) { return x.trim(); }).map(function (x) { return /^\s*[-•*]\s*/.test(x) ? '<li>' + esc(x.replace(/^\s*[-•*]\s*/, '')) + '</li>' : '<p>' + esc(x) + '</p>'; }).join('').replace(/(<li>.*?<\/li>)+/g, function (m) { return '<ul>' + m + '</ul>'; }); }
  function secParecer(pr, id, per) {
    const x = parecerDe(pr, id, per);
    if (!x.parecer && !x.proximos) return '<section class="cartao no-print rl-vazia"><h3>Parecer e próximos passos</h3><p class="mini mudo">Escreva a sua análise do período e o que vem a seguir. O texto sai impresso no relatório.</p>' + btnEd('parecer', '✍ Escrever parecer') + '</section>';
    return '<section class="cartao rl-parecer"><h3>Parecer da Seven ' + btnEd('parecer', '✎ Editar') + '</h3>' + (x.parecer ? '<div class="rl-texto">' + paragrafos(x.parecer) + '</div>' : '') + (x.proximos ? '<h4>Próximos passos</h4><div class="rl-texto">' + paragrafos(x.proximos) + '</div>' : '') + '<p class="mini mudo">' + esc((Dados.e.config && Dados.e.config.responsavel) || 'Lucas Neves') + ' | Seven</p></section>';
  }
  function secTrabalho(pr, id, per) {
    const t = P.trabalho(Dados.e, { empresaId: id, de: per.de, ate: per.ate, hoje: hoje(), analisados: parecerDe(pr, id, per).analisados });
    const itens = t.itens.filter(function (x) { return x.n > 0; });
    return '<section class="cartao rl-trabalho"><h3>Trabalho da Seven no período ' + btnEd('parecer', '✎ Editais analisados') + '</h3>' + (itens.length ? '<div class="cm-numeros cm-kpis">' + itens.map(function (x) { return '<div><small>' + esc(x.nome) + '</small><b>' + x.n + '</b></div>'; }).join('') + '</div>' : '<p class="mini mudo">Nenhuma atividade registrada no período.</p>') + '<p class="mini mudo">Contado no Seven Processo, nas propostas, nas sessões, nas peças jurídicas e nos documentos do cliente. Editais analisados: informado por você.</p></section>';
  }
  function secPerdas(d, per) {
    const x = P.perdas(d.cartoes, per.de, per.ate); if (!x.lista.length) return '';
    const nomeM = {}; P.MOTIVOS_PERDA.forEach(function (m) { nomeM[m[0]] = m[1]; });
    return '<section class="cartao rl-perdas"><h3>Por que perdemos</h3>' +
      (x.porMotivo.length ? '<div class="rl-motivos">' + x.porMotivo.map(function (m) { return '<div class="rl-motivo"><span>' + esc(m.nome) + '</span><div class="rl-barra"><i style="width:' + m.pct + '%"></i></div><b>' + m.n + ' · ' + pc(m.pct, 0) + '</b></div>'; }).join('') + '</div>' : '') +
      (x.semMotivo ? '<p class="mini alerta no-print">' + x.semMotivo + ' perda(s) sem motivo registrado. Use "Registrar" em cada linha.</p>' : '') +
      R().tabela([['Data'], ['Licitação'], ['Órgão'], ['Motivo'], ['Vencedor'], ['Valor vencedor', 1], ['Nossa proposta', 1], ['']], x.lista.map(function (c) {
        const pe = c.perda || {}; const nv = Number(pe.nossoValor) || c.lanceFinal || c.valor || 0; const vv = Number(pe.valorVencedor) || 0;
        return '<tr><td>' + dataBR(c.dataPerda) + '</td><td>' + R().linkCartao(c) + '</td><td>' + esc(c.orgao) + '</td><td>' + (pe.motivo ? esc(nomeM[pe.motivo] || pe.motivo) : '<span class="mudo">—</span>') + (pe.obs ? '<br><small class="mudo">' + esc(pe.obs) + '</small>' : '') + '</td><td>' + esc(pe.vencedor || '—') + '</td><td class="n">' + (vv ? moeda(vv) : '—') + '</td><td class="n">' + (nv ? moeda(nv) : '—') + (vv && nv ? '<br><small class="mudo">' + (nv >= vv ? '+' : '') + pc((nv - vv) / vv * 100) + '</small>' : '') + '</td><td class="no-print"><button type="button" class="btn mini" data-perda="' + esc(c.quadroId + ':' + c.id) + '">' + (pe.motivo ? 'Editar' : 'Registrar') + '</button></td></tr>';
      }), '') + '</section>';
  }
  function secConcorrencia(d, per) {
    const x = P.concorrencia(d.cartoes, per.de, per.ate); if (x.desagioMedio == null && x.distanciaMedia == null && !x.concorrentes.length) return '';
    return '<section class="cartao"><h3>Deságio e concorrência</h3>' + R().kpis([['Deságio médio nas ganhas', x.desagioMedio == null ? '—' : pc(x.desagioMedio), ''], ['Distância média para o vencedor', x.distanciaMedia == null ? '—' : pc(x.distanciaMedia), x.distanciaMedia > 10 ? 'ruim' : '']]) +
      '<p class="mini mudo">Deságio: quanto abaixo do valor estimado ganhamos (' + x.nDesagio + ' licitação(ões) com estimado informado). Distância: quanto a nossa proposta ficou acima da vencedora (' + x.nDistancia + ' perda(s) com valor do vencedor).</p>' +
      (x.concorrentes.length ? '<h4>Concorrentes que mais venceram (histórico)</h4>' + R().tabela([['Concorrente'], ['Vezes', 1], ['No período', 1], ['Valor somado', 1]], x.concorrentes.map(function (k) { return '<tr><td>' + esc(k.nome) + '</td><td class="n">' + k.vezes + '</td><td class="n">' + k.noPeriodo + '</td><td class="n">' + moeda(k.valor) + '</td></tr>'; }), '') : '') + '</section>';
  }
  function secDistribuicao(d, per) {
    const x = P.distribuicao(d.cartoes, per.de, per.ate); if (!x.decididas) return '';
    const t = function (titulo, l) { return '<div><h4>' + titulo + '</h4>' + R().tabela([[titulo], ['Decididas', 1], ['Ganhas', 1], ['Taxa', 1], ['Valor ganho', 1]], l.map(function (k) { return '<tr><td>' + esc(k.nome) + '</td><td class="n">' + k.decididas + '</td><td class="n">' + k.ganhas + '</td><td class="n">' + pc(k.taxa, 0) + '</td><td class="n">' + moeda(k.valorGanho) + '</td></tr>'; }), '') + '</div>'; };
    return '<section class="cartao"><h3>Onde ganhamos</h3><p class="mini mudo">Licitações decididas no período (' + x.decididas + ').</p><div class="rl-dist">' + t('Órgão', x.orgao) + t('Portal', x.portal) + t('UF', x.uf) + '</div></section>';
  }
  function secAgenda(id) {
    const l = P.agenda(Dados.e, { empresaId: id, hoje: hoje(), dias: 30 });
    return '<section class="cartao"><h3>Agenda dos próximos 30 dias</h3>' + R().tabela([['Data'], ['Tipo'], ['Licitação'], ['Órgão'], ['Portal'], ['Valor estimado', 1]], l.slice(0, 25).map(function (a) { return '<tr><td>' + dataBR(a.data) + (a.hora ? ' ' + esc(a.hora) : '') + '</td><td>' + esc(a.tipo) + '</td><td>' + esc(a.titulo) + '</td><td>' + esc(a.orgao) + '</td><td>' + esc(a.portal) + '</td><td class="n">' + (a.valor ? moeda(a.valor) : '—') + '</td></tr>'; }), 'Nenhuma sessão ou prazo marcado nos próximos 30 dias.') + '</section>';
  }
  function secHabilitacao(id) {
    if (!id) return ''; const h = P.habilitacao(Dados.e, { empresaId: id, hoje: hoje(), dias: 30 });
    if (!h.total) return '<section class="cartao no-print rl-vazia"><h3>Habilitação</h3><p class="mini mudo">Nenhum documento de habilitação cadastrado para este cliente. <a href="#/cadastrar/documentos">Cadastrar documentos</a></p></section>';
    const l = h.vencidos.map(function (x) { return '<tr class="cm-atrasada"><td>' + esc(x.nome) + '</td><td>' + dataBR(x.validade) + '</td><td><span class="tag vermelho">vencido há ' + Math.abs(x.dias) + ' dia(s)</span></td></tr>'; }).concat(h.vencendo.map(function (x) { return '<tr><td>' + esc(x.nome) + '</td><td>' + dataBR(x.validade) + '</td><td><span class="tag laranja">' + (x.dias ? 'vence em ' + x.dias + ' dia(s)' : 'vence hoje') + '</span></td></tr>'; }));
    return '<section class="cartao"><h3>Situação da habilitação</h3>' + R().kpis([['Válidos', h.validos, 'ok'], ['Vencem em 30 dias', h.vencendo.length, h.vencendo.length ? 'alerta' : ''], ['Vencidos', h.vencidos.length, h.vencidos.length ? 'ruim' : ''], ['Sem validade', h.semValidade]]) + R().tabela([['Documento'], ['Validade'], ['Situação']], l, 'Todos os documentos com validade estão em dia nos próximos 30 dias.') + '</section>';
  }

  // ---------- relatório do cliente ----------
  function telaCliente(el) {
    const pr = prefs(); const id = pr.cliente || null; const per = periodo(pr); const ant = P.periodoAnterior(per.de, per.ate);
    const cfgDe = R().cfgDe; const atual = P.resumoPeriodo(Dados.e, { empresaId: id, cfgDe: cfgDe, de: per.de, ate: per.ate }); const antes = P.resumoPeriodo(Dados.e, { empresaId: id, cfgDe: cfgDe, de: ant.de, ate: ant.ate });
    const c = P.comparar(atual, antes); const ver = VEREDITO[P.veredito(c)]; const d = atual.desempenho; const tem = d.cartoes.length > 0; const S = pr.secoes;
    // evolução: 12 meses até o fim do período (ou o próprio período, se for maior)
    const fimMes = per.ate.slice(0, 7); const iniD = new Date(Number(fimMes.slice(0, 4)), Number(fimMes.slice(5)) - 12, 1); const ini12 = iniD.getFullYear() + '-' + String(iniD.getMonth() + 1).padStart(2, '0') + '-01';
    const ev = P.evolucao(Dados.e, { empresaId: id, cfgDe: cfgDe, de: per.de < ini12 ? per.de : ini12, ate: per.ate });
    const rot = ev.map(function (x) { return ROTULO_MES[Number(x.mes.slice(5)) - 1] + '/' + x.mes.slice(2, 4); });
    const nome = id ? R().nomeEmpresa(id) : 'todos os clientes';
    el.innerHTML = abas('') + controles(pr, false) +
      '<div class="cm-relatorio rl">' + R().cabecalho('Relatório de performance · ' + nome, 'Período: ' + per.rotulo + ' · comparado com ' + rotuloAnterior(ant)) +
      (tem ? '<div class="rl-veredito ' + ver[2] + '"><b>' + ver[0] + '</b><span>' + esc(ver[1]) + '</span></div>' +
        '<div class="cm-numeros cm-kpis rl-kpis">' + c.map(function (x) { return '<div><small>' + esc(x.nome) + '</small><b>' + valorMetrica(x.chave, x.atual) + '</b>' + variacao(x, /valor|faturado|recebido/.test(x.chave)) + '</div>'; }).join('') +
        '<div><small>A receber (total)</small><b>' + moeda(d.totais.aReceber) + '</b>' + (d.totais.atrasado ? '<span class="rl-var rl-cai">' + moeda(d.totais.atrasado) + ' em atraso</span>' : '') + '</div></div>' +
        (S.metas ? secMetas(pr, id, atual) : '') +
        '<section class="cartao"><h3>Leitura do período</h3><ul class="rl-leitura">' + leitura(c, atual, d, pr, id).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></section>' +
        (S.parecer ? secParecer(pr, id, per) : '') + (S.trabalho ? secTrabalho(pr, id, per) : '') +
        '<section class="cartao"><h3>Evolução mês a mês</h3><div class="rl-graf">' + G.agrupadas(rot, [{ nome: 'Valor ganho', valores: ev.map(function (x) { return x.valorGanho; }) }, { nome: 'Recebido', valores: ev.map(function (x) { return x.recebido; }) }], { largura: 760, altura: 220, fmt: function (v) { return moeda(v); }, titulo: 'Valor ganho e recebido por mês' }) + G.legenda([{ r: 'Valor ganho' }, { r: 'Recebido' }]) + '</div>' +
        R().tabela([['Mês'], ['Novas', 1], ['Decididas', 1], ['Ganhas', 1], ['Taxa', 1], ['Valor ganho', 1], ['Faturado', 1], ['Recebido', 1]], ev.map(function (x, i) { return '<tr' + (x.mes >= per.de.slice(0, 7) && x.mes <= per.ate.slice(0, 7) ? ' class="rl-no-periodo"' : '') + '><th>' + rot[i] + '</th><td class="n">' + x.novas + '</td><td class="n">' + x.disputadas + '</td><td class="n">' + x.ganhas + '</td><td class="n">' + pc(x.taxa, 0) + '</td><td class="n">' + moeda(x.valorGanho) + '</td><td class="n">' + moeda(x.faturado) + '</td><td class="n">' + moeda(x.recebido) + '</td></tr>'; }), '') + '<p class="mini mudo">Linhas destacadas: meses do período do relatório.</p></section>' +
        '<section class="cartao"><h3>Funil acumulado</h3>' + R().funilReal(d.funil).html + '<p class="mini mudo">Todas as licitações acompanhadas no Seven Processo; cada uma conta em todas as etapas que já passou.</p></section>' +
        (S.perdas ? secPerdas(d, per) : '') + (S.concorrencia ? secConcorrencia(d, per) : '') + (S.distribuicao ? secDistribuicao(d, per) : '') +
        (pr.listas ? '<section class="cartao"><h3>Licitações ganhas no período</h3>' + R().tabela([['Resultado'], ['Licitação'], ['Órgão'], ['Valor', 1], ['Etapa']], d.periodo.ganhas.map(function (k) { return '<tr><td>' + dataBR(k.dataGanho) + '</td><td>' + R().linkCartao(k) + '</td><td>' + esc(k.orgao) + (k.uasg ? ' <small class="mudo">UASG ' + esc(k.uasg) + '</small>' : '') + '</td><td class="n">' + moeda(k.valor) + '</td><td>' + esc(k.lista) + '</td></tr>'; }), 'Nenhuma licitação ganha no período.') + '</section>' +
          '<section class="cartao"><h3>Em andamento</h3>' + R().tabela([['Licitação'], ['Órgão'], ['Etapa'], ['Valor estimado', 1]], d.emDisputa.map(function (k) { return '<tr><td>' + R().linkCartao(k) + '</td><td>' + esc(k.orgao) + '</td><td>' + esc(k.lista) + '</td><td class="n">' + moeda(k.valor) + '</td></tr>'; }), 'Nada em andamento.') + '</section>' +
          '<section class="cartao"><h3>Próximos recebimentos</h3>' + R().tabela([['Vencimento'], ['NF'], ['Licitação'], ['Em aberto', 1]], d.proximos.slice(0, 20).map(function (n) { return '<tr' + (n.atrasada ? ' class="cm-atrasada"' : '') + '><td>' + dataBR(n.vencimento) + (n.atrasada ? ' <span class="tag vermelho">atrasada</span>' : '') + '</td><td>' + esc(n.numero || '') + '</td><td>' + esc(n.cartao) + '</td><td class="n">' + moeda(n.aberto) + '</td></tr>'; }), 'Nenhuma nota fiscal em aberto.') + '</section>' : '') +
        (S.agenda ? secAgenda(id) : '') + (S.habilitacao ? secHabilitacao(id) : '') +
        (pr.comissao ? '<section class="cartao"><h3>Comissão da Seven</h3>' + R().kpis([['Comissão do período (sobre o recebido)', moeda(atual.comissao)], ['Mensalidade', moeda(atual.fixo)], ['Total do período', moeda(atual.comissao + atual.fixo), 'ok']]) + (id ? '<p class="mini mudo">Condições: ' + esc(R().textoCfg(R().cfgCliente(id))) + '.</p>' : '') + '</section>' : '')
        : '<div class="cartao"><p class="mudo">Ainda não há licitações ' + (id ? 'deste cliente ' : '') + 'no Seven Processo. Lance as licitações ganhas na Seven Comissão ou acompanhe as oportunidades no Seven Processo para os números aparecerem aqui.</p><div class="grupo-botoes"><a class="btn" href="#/comissao/ganhas">Lançar licitação ganha</a><a class="btn fantasma" href="#/quadros">Abrir o Seven Processo</a></div></div>') + '</div>';
    const reg = function (via) { registrarHistorico(pr, id, per, via, atual, c); };
    ligar(el, pr, async function (via) { if (await enviar(via, id, per, ant, atual, c, d)) reg(via === 'email' ? 'e-mail' : 'WhatsApp'); }, 'performance-' + per.de.slice(0, 7), id, { metas: function () { editarMetas(pr, id); }, parecer: function () { editarParecer(pr, id, per); }, registrar: reg });
  }

  // ---------- base de performance de todos os clientes ----------
  function telaBase(el) {
    const pr = prefs(); const per = periodo(pr); const ant = P.periodoAnterior(per.de, per.ate); const cfgDe = R().cfgDe;
    const ids = (Dados.e.empresas || []).map(function (x) { return x.id; });
    const linhas = ids.map(function (id) {
      const a = P.resumoPeriodo(Dados.e, { empresaId: id, cfgDe: cfgDe, de: per.de, ate: per.ate }); const b = P.resumoPeriodo(Dados.e, { empresaId: id, cfgDe: cfgDe, de: ant.de, ate: ant.ate });
      const c = P.comparar(a, b); return { id: id, a: a, c: c, ver: P.veredito(c), total: a.desempenho.totais, acompanhadas: a.desempenho.cartoes.length };
    }).filter(function (x) { return x.acompanhadas; }).sort(function (x, y) { return y.a.valorGanho - x.a.valorGanho || y.total.valorGanho - x.total.valorGanho; });
    const soma = function (f) { return linhas.reduce(function (s, x) { return s + (Number(f(x)) || 0); }, 0); };
    const tag = { avancando: '<span class="tag verde">avançando</span>', estavel: '<span class="tag">estável</span>', atencao: '<span class="tag vermelho">atenção</span>' };
    el.innerHTML = abas('base') + controles(pr, true) +
      '<div class="cm-relatorio rl">' + R().cabecalho('Base de performance dos clientes', 'Período: ' + per.rotulo + ' · comparado com ' + rotuloAnterior(ant)) +
      R().kpis([['Clientes com licitações', linhas.length], ['Ganhas no período', soma(function (x) { return x.a.ganhas; }), 'ok'], ['Valor ganho no período', moeda(soma(function (x) { return x.a.valorGanho; }))], ['Recebido no período', moeda(soma(function (x) { return x.a.recebido; })), 'ok'], ['A receber (total)', moeda(soma(function (x) { return x.total.aReceber; }))], ['Em atraso (total)', moeda(soma(function (x) { return x.total.atrasado; })), soma(function (x) { return x.total.atrasado; }) ? 'ruim' : '']]) +
      '<section class="cartao"><h3>Clientes</h3>' + R().tabela([['Cliente'], ['Situação'], ['Novas', 1], ['Decididas', 1], ['Ganhas', 1], ['Taxa', 1], ['Valor ganho', 1], ['vs anterior', 1], ['Recebido', 1], ['A receber', 1], ['Em atraso', 1], ['Meta', 1]], linhas.map(function (x) {
        const mt = P.metas(pr.metas[x.id], x.a); const mg = mt.find(function (k) { return k.chave === 'valorGanho'; }) || mt[0];
        const vg = x.c.find(function (k) { return k.chave === 'valorGanho'; });
        return '<tr><td><a href="#/relatorios" data-cliente="' + esc(x.id) + '">' + esc(R().nomeEmpresa(x.id)) + '</a></td><td>' + tag[x.ver] + '</td><td class="n">' + x.a.novas + '</td><td class="n">' + x.a.disputadas + '</td><td class="n">' + x.a.ganhas + '</td><td class="n">' + pc(x.a.taxa, 0) + '</td><td class="n">' + moeda(x.a.valorGanho) + '</td><td class="n">' + variacao(vg, true) + '</td><td class="n">' + moeda(x.a.recebido) + '</td><td class="n">' + moeda(x.total.aReceber) + '</td><td class="n">' + moeda(x.total.atrasado) + '</td><td class="n">' + (mg ? '<span title="' + esc(mg.nome) + '" class="' + (mg.atingida ? 'rl-sobe' : '') + '">' + pc(mg.pct, 0) + '</span>' : '—') + '</td></tr>';
      }), 'Nenhum cliente com licitações no Seven Processo ainda.') + '<p class="mini mudo">Clique no cliente para abrir o relatório dele. Situação: compara ganhas, taxa de sucesso, valor ganho e recebido com o período anterior.</p></section></div>';
    ligar(el, pr, null, 'base-' + per.de.slice(0, 7), null);
  }

  function ligar(el, pr, enviarFn, tipo, cliente, acoes) {
    acoes = acoes || {};
    const sd = el.querySelector('.rl-secoes'); if (sd) { sd.open = secoesAbertas; sd.ontoggle = function () { secoesAbertas = sd.open; }; }
    const f = el.querySelector('#rl-f');
    f.onchange = function (ev) { const t = ev.target; if (t.type === 'checkbox' && /^sec_/.test(t.name)) pr.secoes[t.name.slice(4)] = t.checked; else if (t.type === 'checkbox') pr[t.name] = t.checked; else pr[t.name] = t.name === 'cliente' ? (t.value || null) : t.value; Dados.salvar(); App.redesenhar(); };
    f.onsubmit = function (ev) { ev.preventDefault(); };
    el.onclick = function (ev) {
      const cl = ev.target.closest('[data-cliente]'); if (cl) { ev.preventDefault(); pr.cliente = cl.dataset.cliente; Dados.salvar(); location.hash = '#/relatorios'; App.redesenhar(); return; }
      const pb = ev.target.closest('[data-perda]'); if (pb) { registrarPerda(pb.dataset.perda); return; }
      const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'imprimir' || a === 'pdf') { if (acoes.registrar) acoes.registrar(a === 'pdf' ? 'pdf' : 'impressão'); R().imprimir(a === 'pdf', tipo, cliente); }
      if (acoes[a] && a !== 'registrar') acoes[a]();
      if ((a === 'whatsapp' || a === 'email') && enviarFn) enviarFn(a);
    };
  }

  // ---------- edição: metas, parecer, perdas ----------
  const num = function (v) { return Nucleo.lerNumeroBR(v) || 0; };
  const fmtN = function (v) { return v ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; };
  async function editarMetas(pr, id) {
    const m = pr.metas[id] || {};
    const f = await UI.modal({ titulo: 'Metas mensais · ' + R().nomeEmpresa(id), botao: 'Salvar metas',
      corpo: '<p class="mini mudo">Valores por mês. No relatório de um trimestre ou ano a meta é multiplicada pelos meses. Em branco: sem meta.</p>' +
        campo('Valor ganho por mês (R$)', '<input name="valorGanho" inputmode="decimal" value="' + esc(fmtN(m.valorGanho)) + '">') + campo('Recebido dos órgãos por mês (R$)', '<input name="recebido" inputmode="decimal" value="' + esc(fmtN(m.recebido)) + '">') + campo('Licitações ganhas por mês', '<input name="ganhas" inputmode="decimal" value="' + esc(m.ganhas || '') + '">') });
    if (!f) return; pr.metas[id] = { valorGanho: num(f.get('valorGanho')), recebido: num(f.get('recebido')), ganhas: num(f.get('ganhas')) }; Dados.salvar(); App.redesenhar();
  }
  async function editarParecer(pr, id, per) {
    const k = chavePer(id, per); const x = pr.pareceres[k] || {};
    const f = await UI.modal({ titulo: 'Parecer e trabalho · ' + per.rotulo, largo: true, botao: 'Salvar',
      corpo: campo('Editais analisados no período', '<input name="analisados" inputmode="numeric" value="' + esc(x.analisados || '') + '">', 'Inclui os editais lidos e descartados, que não viram cartão no Seven Processo.') +
        campo('Parecer da Seven', '<textarea name="parecer" rows="7" placeholder="Como foi o período, o que funcionou, o que preocupa.">' + esc(x.parecer || '') + '</textarea>') +
        campo('Próximos passos', '<textarea name="proximos" rows="5" placeholder="Um por linha, ex.: - Renovar a CND estadual até dia 10">' + esc(x.proximos || '') + '</textarea>', 'Linhas começando com "-" viram lista.') });
    if (!f) return; pr.pareceres[k] = { analisados: Math.max(0, Math.round(num(f.get('analisados')))), parecer: String(f.get('parecer') || '').trim(), proximos: String(f.get('proximos') || '').trim(), em: new Date().toISOString() }; Dados.salvar(); App.redesenhar();
  }
  function cartaoBruto(ref) { const [qid, cid] = String(ref).split(':'); const q = (Dados.e.quadros || []).find(function (x) { return x.id === qid; }); return q && (q.cartoes || []).find(function (c) { return c.id === cid; }); }
  async function registrarPerda(ref) {
    const c = cartaoBruto(ref); if (!c) return; const pe = c.perda || {};
    const f = await UI.modal({ titulo: 'Motivo da perda · ' + (c.titulo || ''), botao: 'Salvar',
      corpo: campo('Motivo', '<select name="motivo"><option value="">—</option>' + P.MOTIVOS_PERDA.map(function (m) { return '<option value="' + m[0] + '"' + (pe.motivo === m[0] ? ' selected' : '') + '>' + esc(m[1]) + '</option>'; }).join('') + '</select>') +
        '<div class="linha">' + campo('Vencedor', '<input name="vencedor" value="' + esc(pe.vencedor || '') + '" placeholder="Razão social do concorrente">') + campo('Valor do vencedor (R$)', '<input name="valorVencedor" inputmode="decimal" value="' + esc(fmtN(pe.valorVencedor)) + '">') + campo('Nossa proposta (R$)', '<input name="nossoValor" inputmode="decimal" value="' + esc(fmtN(pe.nossoValor)) + '">') + '</div>' +
        campo('Observação', '<input name="obs" value="' + esc(pe.obs || '') + '" placeholder="ex.: atestado sem o quantitativo mínimo">') });
    if (!f) return;
    c.perda = { motivo: f.get('motivo') || '', vencedor: String(f.get('vencedor') || '').trim(), valorVencedor: num(f.get('valorVencedor')) || null, nossoValor: num(f.get('nossoValor')) || null, obs: String(f.get('obs') || '').trim() };
    c.atividade = c.atividade || []; c.atividade.push({ em: new Date().toISOString(), por: (Dados.e.config && Dados.e.config.responsavel) || '', texto: 'registrou o motivo da perda' + (c.perda.motivo ? ': ' + (P.MOTIVOS_PERDA.find(function (m) { return m[0] === c.perda.motivo; }) || [, ''])[1] : '') });
    Dados.salvar(); App.redesenhar();
  }

  // ---------- histórico de relatórios gerados e enviados ----------
  function registrarHistorico(pr, id, per, via, atual, c) {
    pr.historico.unshift({ id: Dados.id('rel'), em: new Date().toISOString(), cliente: id, via: via, rotulo: per.rotulo, de: per.de, ate: per.ate, periodo: { tipo: pr.tipo, mes: pr.mes, trimestre: pr.trimestre, ano: pr.ano, de: pr.de, ate: pr.ate },
      resumo: { ganhas: atual.ganhas, decididas: atual.disputadas, valorGanho: atual.valorGanho, recebido: atual.recebido, taxa: atual.taxa, veredito: P.veredito(c) } });
    if (pr.historico.length > 500) pr.historico.length = 500; Dados.salvar();
  }
  function telaHistorico(el) {
    const pr = prefs(); const es = Dados.e.empresas || []; const filtro = pr.histCliente || '';
    const l = pr.historico.filter(function (h) { return !filtro || h.cliente === filtro; });
    const tag = { avancando: '<span class="tag verde">avançando</span>', estavel: '<span class="tag">estável</span>', atencao: '<span class="tag vermelho">atenção</span>' };
    el.innerHTML = abas('historico') + '<form class="cartao no-print rl-ctrl" id="rl-hf" autocomplete="off"><div class="linha">' + campo('Cliente', '<select name="cliente"><option value="">Todos os clientes</option>' + es.map(function (x) { return '<option value="' + esc(x.id) + '"' + (filtro === x.id ? ' selected' : '') + '>' + esc(x.fantasia || x.razao) + '</option>'; }).join('') + '</select>') + '</div></form>' +
      '<div class="cartao"><h3>Relatórios gerados e enviados</h3>' + R().tabela([['Quando'], ['Cliente'], ['Período'], ['Como'], ['Situação'], ['Ganhas', 1], ['Valor ganho', 1], ['Recebido', 1], ['']], l.map(function (h) {
        return '<tr><td>' + new Date(h.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + '</td><td>' + esc(h.cliente ? R().nomeEmpresa(h.cliente) : 'Todos os clientes') + '</td><td>' + esc(h.rotulo) + '</td><td>' + esc(h.via) + '</td><td>' + (tag[h.resumo && h.resumo.veredito] || '') + '</td><td class="n">' + ((h.resumo && h.resumo.ganhas) || 0) + '</td><td class="n">' + moeda((h.resumo && h.resumo.valorGanho) || 0) + '</td><td class="n">' + moeda((h.resumo && h.resumo.recebido) || 0) + '</td><td><div class="grupo-botoes"><button type="button" class="btn mini" data-reabrir="' + esc(h.id) + '">Reabrir</button><button type="button" class="btn mini fantasma" data-excluir="' + esc(h.id) + '" aria-label="Excluir do histórico">✕</button></div></td></tr>';
      }), 'Nenhum relatório gerado ainda. Cada impressão, PDF, WhatsApp ou e-mail do relatório do cliente fica registrado aqui.') + '<p class="mini mudo">Os números da linha são os do momento do envio. "Reabrir" mostra o relatório do mesmo cliente e período com os dados de hoje.</p></div>';
    el.querySelector('#rl-hf').onchange = function (ev) { pr.histCliente = ev.target.value || ''; Dados.salvar(); App.redesenhar(); };
    el.onclick = async function (ev) {
      const r = ev.target.closest('[data-reabrir]'); if (r) { const h = pr.historico.find(function (x) { return x.id === r.dataset.reabrir; }); if (!h) return; Object.assign(pr, h.periodo || {}); pr.cliente = h.cliente || null; Dados.salvar(); location.hash = '#/relatorios'; App.redesenhar(); return; }
      const x = ev.target.closest('[data-excluir]'); if (x && await UI.confirmar('Excluir do histórico', 'Excluir este registro? O relatório em si não é afetado.', 'Excluir')) { pr.historico = pr.historico.filter(function (h) { return h.id !== x.dataset.excluir; }); Dados.salvar(); App.redesenhar(); }
    };
  }

  // ---------- envio ao cliente (o texto abre para revisão; quem envia é você) ----------
  function texto(id, per, ant, atual, c, d) {
    const emp = Dados.empresa(id) || {}; const quem = (emp.representante || emp.fantasia || emp.razao || '').split(' ')[0]; const ver = VEREDITO[P.veredito(c)];
    const l = ['Olá' + (quem ? ', ' + quem : '') + '! Segue o relatório de performance das suas licitações — ' + per.rotulo + ' (comparado com ' + rotuloAnterior(ant) + '):', '', ver[0].replace(/^\S+\s/, '') + '.', ''];
    c.forEach(function (x) { const v = x.anterior == null ? '' : x.sentido === 'igual' ? ' (igual)' : ' (' + (x.sentido === 'subiu' ? '▲ ' : '▼ ') + (x.chave === 'taxa' ? Math.abs(Math.round(x.delta * 10) / 10).toString().replace('.', ',') + ' p.p.' : x.pct != null ? Math.abs(Math.round(x.pct)) + '%' : 'antes ' + valorMetrica(x.chave, x.anterior)) + ')'; l.push('• ' + x.nome + ': ' + valorMetrica(x.chave, x.atual) + v); });
    l.push('• A receber: ' + moeda(d.totais.aReceber) + (d.totais.atrasado ? ' (em atraso: ' + moeda(d.totais.atrasado) + ')' : ''));
    d.periodo.ganhas.slice(0, 5).forEach(function (k) { l.push('   ✓ ' + k.titulo + (k.orgao ? ' · ' + k.orgao : '') + ' · ' + moeda(k.valor)); });
    const pa = parecerDe(prefs(), id, per); if (pa.proximos) { l.push('', 'Próximos passos:'); pa.proximos.split(/\n+/).filter(function (x) { return x.trim(); }).forEach(function (x) { l.push('• ' + x.replace(/^\s*[-•*]\s*/, '')); }); }
    l.push('', 'O relatório completo vai em PDF. Qualquer dúvida, estou à disposição.', '', 'Lucas Neves | Seven', '(61) 98347-2232');
    return l.join('\n');
  }
  async function enviar(via, id, per, ant, atual, c, d) {
    const emp = Dados.empresa(id) || {};
    const f = await UI.modal({ titulo: via === 'whatsapp' ? 'Enviar relatório por WhatsApp' : 'Enviar relatório por e-mail', largo: true, botao: via === 'whatsapp' ? 'Abrir WhatsApp' : 'Abrir e-mail',
      corpo: '<p class="mini mudo">Revise o texto antes de enviar. O sistema só abre o ' + (via === 'whatsapp' ? 'WhatsApp' : 'e-mail') + ' com a mensagem pronta; o envio é feito por você. Para anexar o relatório, use ⬇ Baixar PDF.</p>' +
        (via === 'whatsapp' ? campo('WhatsApp (com DDD)', '<input name="dest" inputmode="tel" value="' + esc(emp.telefone || '') + '">', 'Em branco: o WhatsApp abre para você escolher o contato.') : campo('E-mail do cliente', '<input name="dest" type="email" value="' + esc(emp.email || '') + '">')) +
        campo('Mensagem', '<textarea name="t" rows="18">' + esc(texto(id, per, ant, atual, c, d)) + '</textarea>') });
    if (!f) return false; const txt = f.get('t'), dest = String(f.get('dest') || '').trim();
    if (via === 'whatsapp') { let n = dest.replace(/\D/g, ''); if (n && n.length <= 11) n = '55' + n; window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(txt), '_blank', 'noopener'); }
    else location.href = 'mailto:' + encodeURIComponent(dest) + '?subject=' + encodeURIComponent('Relatório de performance · ' + per.rotulo + ' · Seven') + '&body=' + encodeURIComponent(txt);
    return true;
  }

  Telas.relatorios = { titulo: 'Seven Relatórios', render: function (el, sub) { if (sub === 'base') telaBase(el); else if (sub === 'historico') telaHistorico(el); else telaCliente(el); } };
})();
