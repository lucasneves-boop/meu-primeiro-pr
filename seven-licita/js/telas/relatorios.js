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
  const ROTULO_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  function prefs() {
    const d = Dados.e; const hoje = new Date(); const mm = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
    d.relatorios = Object.assign({ cliente: d.empresaAtiva || null, tipo: 'mes', mes: mm, trimestre: hoje.getFullYear() + '-T' + (Math.floor(hoje.getMonth() / 3) + 1), ano: String(hoje.getFullYear()), de: '', ate: '', comissao: false, listas: true }, d.relatorios || {});
    return d.relatorios;
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
      (comBase ? '' : '<label class="check"><input type="checkbox" name="listas"' + (pr.listas ? ' checked' : '') + '> Incluir as licitações (ganhas, em andamento e próximos recebimentos)</label><label class="check"><input type="checkbox" name="comissao"' + (pr.comissao ? ' checked' : '') + '> Incluir a comissão da Seven no relatório</label>') +
      '<div class="grupo-botoes"><button type="button" class="btn primario" data-a="imprimir">🖨 Imprimir</button><button type="button" class="btn" data-a="pdf">⬇ Baixar PDF</button>' + (comBase ? '' : '<button type="button" class="btn" data-a="whatsapp"' + (pr.cliente ? '' : ' disabled title="Escolha um cliente"') + '>WhatsApp</button><button type="button" class="btn" data-a="email"' + (pr.cliente ? '' : ' disabled title="Escolha um cliente"') + '>E-mail</button>') + '</div></form>';
  }
  function abas(sub) { return '<nav class="abas no-print" aria-label="Seven Relatórios">' + [['', '📊 Relatório do cliente'], ['base', '🗂 Base de performance']].map(function (x) { return '<a href="#/relatorios' + (x[0] ? '/' + x[0] : '') + '" class="' + ((sub || '') === x[0] ? 'ativa' : '') + '">' + x[1] + '</a>'; }).join('') + '</nav>'; }

  function variacao(c, moedaFmt) {
    if (c.anterior == null || c.atual == null) return '';
    const seta = c.sentido === 'subiu' ? '▲' : c.sentido === 'caiu' ? '▼' : '='; const cls = c.sentido === 'subiu' ? 'rl-sobe' : c.sentido === 'caiu' ? 'rl-cai' : 'rl-igual';
    const txt = c.chave === 'taxa' ? (c.delta == null ? '' : (c.delta > 0 ? '+' : '') + Number(c.delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' p.p.') : (c.pct != null ? (c.pct > 0 ? '+' : '') + Number(c.pct).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + '%' : (c.sentido === 'igual' ? 'igual' : 'antes: ' + (moedaFmt ? moeda(c.anterior) : c.anterior)));
    return '<span class="rl-var ' + cls + '">' + seta + ' ' + esc(txt) + '</span>';
  }
  function valorMetrica(chave, v) { return chave === 'taxa' ? pc(v) : /valor|faturado|recebido/.test(chave) ? moeda(v) : (v == null ? '—' : v); }
  function leitura(c, atual, d) {
    const l = []; const by = {}; c.forEach(function (x) { by[x.chave] = x; });
    const frase = function (x, nome, fmt) { if (x.anterior == null) return; if (x.sentido === 'igual') { if (x.atual) l.push(nome + ' estável em ' + fmt(x.atual) + '.'); return; } l.push(nome + (x.sentido === 'subiu' ? ' cresceu' : ' caiu') + (x.pct != null && x.chave !== 'taxa' ? ' ' + Math.abs(Math.round(x.pct)) + '%' : '') + ': de ' + fmt(x.anterior) + ' para ' + fmt(x.atual) + '.'); };
    frase(by.valorGanho, 'O valor ganho', moeda); frase(by.ganhas, 'O número de licitações ganhas', String);
    if (by.taxa.atual != null && by.taxa.anterior != null) frase(by.taxa, 'A taxa de sucesso', function (v) { return pc(v); }); else if (by.taxa.atual != null) l.push('Taxa de sucesso no período: ' + pc(by.taxa.atual) + ' (' + atual.ganhas + ' de ' + atual.disputadas + ' decididas).');
    frase(by.recebido, 'O valor recebido dos órgãos', moeda); frase(by.novas, 'As novas oportunidades', String);
    if (d.totais.atrasado) l.push('Há ' + moeda(d.totais.atrasado) + ' em notas fiscais vencidas: vale cobrar o órgão.');
    const f = R().funilReal(d.funil).calc; if (f.gargalo && f.gargalo.conversao != null) l.push('No funil acumulado, a maior perda está em "' + f.gargalo.nome + '" (' + pc(f.gargalo.conversao) + ' passam da etapa anterior).');
    if (!l.length) l.push('Sem movimento suficiente para comparar os períodos.');
    return l;
  }
  const VEREDITO = { avancando: ['📈 Estamos avançando', 'Mais indicadores principais melhoraram do que pioraram em relação ao período anterior.', 'ok'], estavel: ['➡️ Estável', 'Os indicadores principais ficaram equilibrados em relação ao período anterior.', ''], atencao: ['⚠️ Ponto de atenção', 'Mais indicadores principais pioraram do que melhoraram em relação ao período anterior.', 'ruim'] };

  // ---------- relatório do cliente ----------
  function telaCliente(el) {
    const pr = prefs(); const id = pr.cliente || null; const per = periodo(pr); const ant = P.periodoAnterior(per.de, per.ate);
    const cfgDe = R().cfgDe; const atual = P.resumoPeriodo(Dados.e, { empresaId: id, cfgDe: cfgDe, de: per.de, ate: per.ate }); const antes = P.resumoPeriodo(Dados.e, { empresaId: id, cfgDe: cfgDe, de: ant.de, ate: ant.ate });
    const c = P.comparar(atual, antes); const ver = VEREDITO[P.veredito(c)]; const d = atual.desempenho; const tem = d.cartoes.length > 0;
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
        '<section class="cartao"><h3>Leitura do período</h3><ul class="rl-leitura">' + leitura(c, atual, d).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></section>' +
        '<section class="cartao"><h3>Evolução mês a mês</h3><div class="rl-graf">' + G.agrupadas(rot, [{ nome: 'Valor ganho', valores: ev.map(function (x) { return x.valorGanho; }) }, { nome: 'Recebido', valores: ev.map(function (x) { return x.recebido; }) }], { largura: 760, altura: 220, fmt: function (v) { return moeda(v); }, titulo: 'Valor ganho e recebido por mês' }) + G.legenda([{ r: 'Valor ganho' }, { r: 'Recebido' }]) + '</div>' +
        R().tabela([['Mês'], ['Novas', 1], ['Decididas', 1], ['Ganhas', 1], ['Taxa', 1], ['Valor ganho', 1], ['Faturado', 1], ['Recebido', 1]], ev.map(function (x, i) { return '<tr' + (x.mes >= per.de.slice(0, 7) && x.mes <= per.ate.slice(0, 7) ? ' class="rl-no-periodo"' : '') + '><th>' + rot[i] + '</th><td class="n">' + x.novas + '</td><td class="n">' + x.disputadas + '</td><td class="n">' + x.ganhas + '</td><td class="n">' + pc(x.taxa, 0) + '</td><td class="n">' + moeda(x.valorGanho) + '</td><td class="n">' + moeda(x.faturado) + '</td><td class="n">' + moeda(x.recebido) + '</td></tr>'; }), '') + '<p class="mini mudo">Linhas destacadas: meses do período do relatório.</p></section>' +
        '<section class="cartao"><h3>Funil acumulado</h3>' + R().funilReal(d.funil).html + '<p class="mini mudo">Todas as licitações acompanhadas no Seven Processo; cada uma conta em todas as etapas que já passou.</p></section>' +
        (pr.listas ? '<section class="cartao"><h3>Licitações ganhas no período</h3>' + R().tabela([['Resultado'], ['Licitação'], ['Órgão'], ['Valor', 1], ['Etapa']], d.periodo.ganhas.map(function (k) { return '<tr><td>' + dataBR(k.dataGanho) + '</td><td>' + R().linkCartao(k) + '</td><td>' + esc(k.orgao) + (k.uasg ? ' <small class="mudo">UASG ' + esc(k.uasg) + '</small>' : '') + '</td><td class="n">' + moeda(k.valor) + '</td><td>' + esc(k.lista) + '</td></tr>'; }), 'Nenhuma licitação ganha no período.') + '</section>' +
          '<section class="cartao"><h3>Em andamento</h3>' + R().tabela([['Licitação'], ['Órgão'], ['Etapa'], ['Valor estimado', 1]], d.emDisputa.map(function (k) { return '<tr><td>' + R().linkCartao(k) + '</td><td>' + esc(k.orgao) + '</td><td>' + esc(k.lista) + '</td><td class="n">' + moeda(k.valor) + '</td></tr>'; }), 'Nada em andamento.') + '</section>' +
          '<section class="cartao"><h3>Próximos recebimentos</h3>' + R().tabela([['Vencimento'], ['NF'], ['Licitação'], ['Em aberto', 1]], d.proximos.slice(0, 20).map(function (n) { return '<tr' + (n.atrasada ? ' class="cm-atrasada"' : '') + '><td>' + dataBR(n.vencimento) + (n.atrasada ? ' <span class="tag vermelho">atrasada</span>' : '') + '</td><td>' + esc(n.numero || '') + '</td><td>' + esc(n.cartao) + '</td><td class="n">' + moeda(n.aberto) + '</td></tr>'; }), 'Nenhuma nota fiscal em aberto.') + '</section>' : '') +
        (pr.comissao ? '<section class="cartao"><h3>Comissão da Seven</h3>' + R().kpis([['Comissão do período (sobre o recebido)', moeda(atual.comissao)], ['Mensalidade', moeda(atual.fixo)], ['Total do período', moeda(atual.comissao + atual.fixo), 'ok']]) + (id ? '<p class="mini mudo">Condições: ' + esc(R().textoCfg(R().cfgCliente(id))) + '.</p>' : '') + '</section>' : '')
        : '<div class="cartao"><p class="mudo">Ainda não há licitações ' + (id ? 'deste cliente ' : '') + 'no Seven Processo. Lance as licitações ganhas na Seven Comissão ou acompanhe as oportunidades no Seven Processo para os números aparecerem aqui.</p><div class="grupo-botoes"><a class="btn" href="#/comissao/ganhas">Lançar licitação ganha</a><a class="btn fantasma" href="#/quadros">Abrir o Seven Processo</a></div></div>') + '</div>';
    ligar(el, pr, function (via) { enviar(via, id, per, ant, atual, c, d); }, 'performance-' + per.de.slice(0, 7), id);
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
      '<section class="cartao"><h3>Clientes</h3>' + R().tabela([['Cliente'], ['Situação'], ['Novas', 1], ['Decididas', 1], ['Ganhas', 1], ['Taxa', 1], ['Valor ganho', 1], ['vs anterior', 1], ['Recebido', 1], ['A receber', 1], ['Em atraso', 1]], linhas.map(function (x) {
        const vg = x.c.find(function (k) { return k.chave === 'valorGanho'; });
        return '<tr><td><a href="#/relatorios" data-cliente="' + esc(x.id) + '">' + esc(R().nomeEmpresa(x.id)) + '</a></td><td>' + tag[x.ver] + '</td><td class="n">' + x.a.novas + '</td><td class="n">' + x.a.disputadas + '</td><td class="n">' + x.a.ganhas + '</td><td class="n">' + pc(x.a.taxa, 0) + '</td><td class="n">' + moeda(x.a.valorGanho) + '</td><td class="n">' + variacao(vg, true) + '</td><td class="n">' + moeda(x.a.recebido) + '</td><td class="n">' + moeda(x.total.aReceber) + '</td><td class="n">' + moeda(x.total.atrasado) + '</td></tr>';
      }), 'Nenhum cliente com licitações no Seven Processo ainda.') + '<p class="mini mudo">Clique no cliente para abrir o relatório dele. Situação: compara ganhas, taxa de sucesso, valor ganho e recebido com o período anterior.</p></section></div>';
    ligar(el, pr, null, 'base-' + per.de.slice(0, 7), null);
  }

  function ligar(el, pr, enviarFn, tipo, cliente) {
    const f = el.querySelector('#rl-f');
    f.onchange = function (ev) { const t = ev.target; if (t.type === 'checkbox') pr[t.name] = t.checked; else pr[t.name] = t.name === 'cliente' ? (t.value || null) : t.value; Dados.salvar(); App.redesenhar(); };
    f.onsubmit = function (ev) { ev.preventDefault(); };
    el.onclick = function (ev) {
      const cl = ev.target.closest('[data-cliente]'); if (cl) { ev.preventDefault(); pr.cliente = cl.dataset.cliente; Dados.salvar(); location.hash = '#/relatorios'; App.redesenhar(); return; }
      const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'imprimir') R().imprimir(false, tipo, cliente); if (a === 'pdf') R().imprimir(true, tipo, cliente);
      if ((a === 'whatsapp' || a === 'email') && enviarFn) enviarFn(a);
    };
  }

  // ---------- envio ao cliente (o texto abre para revisão; quem envia é você) ----------
  function texto(id, per, ant, atual, c, d) {
    const emp = Dados.empresa(id) || {}; const quem = (emp.representante || emp.fantasia || emp.razao || '').split(' ')[0]; const ver = VEREDITO[P.veredito(c)];
    const l = ['Olá' + (quem ? ', ' + quem : '') + '! Segue o relatório de performance das suas licitações — ' + per.rotulo + ' (comparado com ' + rotuloAnterior(ant) + '):', '', ver[0].replace(/^\S+\s/, '') + '.', ''];
    c.forEach(function (x) { const v = x.anterior == null ? '' : x.sentido === 'igual' ? ' (igual)' : ' (' + (x.sentido === 'subiu' ? '▲ ' : '▼ ') + (x.chave === 'taxa' ? Math.abs(Math.round(x.delta * 10) / 10).toString().replace('.', ',') + ' p.p.' : x.pct != null ? Math.abs(Math.round(x.pct)) + '%' : 'antes ' + valorMetrica(x.chave, x.anterior)) + ')'; l.push('• ' + x.nome + ': ' + valorMetrica(x.chave, x.atual) + v); });
    l.push('• A receber: ' + moeda(d.totais.aReceber) + (d.totais.atrasado ? ' (em atraso: ' + moeda(d.totais.atrasado) + ')' : ''));
    d.periodo.ganhas.slice(0, 5).forEach(function (k) { l.push('   ✓ ' + k.titulo + (k.orgao ? ' · ' + k.orgao : '') + ' · ' + moeda(k.valor)); });
    l.push('', 'O relatório completo vai em PDF. Qualquer dúvida, estou à disposição.', '', 'Lucas Neves | Seven', '(61) 98347-2232');
    return l.join('\n');
  }
  async function enviar(via, id, per, ant, atual, c, d) {
    const emp = Dados.empresa(id) || {};
    const f = await UI.modal({ titulo: via === 'whatsapp' ? 'Enviar relatório por WhatsApp' : 'Enviar relatório por e-mail', largo: true, botao: via === 'whatsapp' ? 'Abrir WhatsApp' : 'Abrir e-mail',
      corpo: '<p class="mini mudo">Revise o texto antes de enviar. O sistema só abre o ' + (via === 'whatsapp' ? 'WhatsApp' : 'e-mail') + ' com a mensagem pronta; o envio é feito por você. Para anexar o relatório, use ⬇ Baixar PDF.</p>' +
        (via === 'whatsapp' ? campo('WhatsApp (com DDD)', '<input name="dest" inputmode="tel" value="' + esc(emp.telefone || '') + '">', 'Em branco: o WhatsApp abre para você escolher o contato.') : campo('E-mail do cliente', '<input name="dest" type="email" value="' + esc(emp.email || '') + '">')) +
        campo('Mensagem', '<textarea name="t" rows="18">' + esc(texto(id, per, ant, atual, c, d)) + '</textarea>') });
    if (!f) return; const txt = f.get('t'), dest = String(f.get('dest') || '').trim();
    if (via === 'whatsapp') { let n = dest.replace(/\D/g, ''); if (n && n.length <= 11) n = '55' + n; window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(txt), '_blank', 'noopener'); }
    else location.href = 'mailto:' + encodeURIComponent(dest) + '?subject=' + encodeURIComponent('Relatório de performance · ' + per.rotulo + ' · Seven') + '&body=' + encodeURIComponent(txt);
  }

  Telas.relatorios = { titulo: 'Seven Relatórios', render: function (el, sub) { if (sub === 'base') telaBase(el); else telaCliente(el); } };
})();
