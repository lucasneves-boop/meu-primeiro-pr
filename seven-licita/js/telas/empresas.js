/* Seven Clientes: a carteira de empresas atendidas (cada uma com seu CNPJ) e a sua própria empresa,
   com o resultado geral e o de cada uma. Os números vêm do Seven Processo, das propostas e dos documentos. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, cnpj, campo, opcoes, modal, confirmar, aviso } = UI;

  function formEmpresa(x) {
    x = x || {};
    return '<label class="check cfg-check"><input type="checkbox" name="propria"' + (x.propria ? ' checked' : '') + '> <b>Esta é a minha empresa</b> <small class="mudo">resultados próprios, sem comissão; aparece à parte na carteira</small></label>' + campo('Razão social *', '<input name="razao" required value="' + esc(x.razao) + '">') +
      campo('Nome fantasia', '<input name="fantasia" value="' + esc(x.fantasia) + '">') +
      '<div class="linha">' + campo('CNPJ *', '<input name="cnpj" required inputmode="numeric" value="' + esc(cnpj(x.cnpj)) + '" placeholder="00.000.000/0000-00">') +
      campo('Porte', '<select name="porte">' + opcoes(['ME', 'EPP', 'Demais'], x.porte || 'ME') + '</select>') + '</div>' +
      '<div class="linha">' + campo('UF', '<select name="uf">' + opcoes(PNCP.UFS, x.uf || 'GO') + '</select>') +
      campo('Município', '<input name="municipio" value="' + esc(x.municipio || '') + '">') + '</div>' +
      '<div class="linha">' + campo('Representante legal', '<input name="representante" value="' + esc(x.representante) + '">') +
      campo('Contato do cliente', '<input name="contato" value="' + esc(x.contato) + '" placeholder="nome de quem fala com a Seven">') + '</div>' +
      '<div class="linha">' + campo('E-mail', '<input name="email" type="email" value="' + esc(x.email || '') + '">', 'Usado no Seven Contrato e nas mensagens.') + campo('WhatsApp / telefone', '<input name="telefone" inputmode="tel" value="' + esc(x.telefone || '') + '">') + '</div>' +
      campo('Ramo / o que vende ao governo', '<textarea name="ramo" rows="2">' + esc(x.ramo) + '</textarea>') +
      campo('Observações (logins, combinados, 2FA gov.br)', '<textarea name="obs" rows="2">' + esc(x.obs) + '</textarea>', 'Não guarde senhas aqui. Registre só quem usa cada login e o que foi combinado com o cliente.');
  }

  function validarCNPJ(c) {
    const s = String(c).replace(/\D/g, '');
    if (s.length !== 14 || /^(\d)\1+$/.test(s)) return false;
    const calc = function (n) { let soma = 0, pos = n - 7; for (let i = n; i >= 1; i--) { soma += s[n - i] * pos--; if (pos < 2) pos = 9; } const r = soma % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === +s[12] && calc(13) === +s[13];
  }

  async function editar(x) {
    const f = await modal({
      titulo: x ? 'Editar empresa' : 'Nova empresa', corpo: formEmpresa(x),
      validar: function (fd) { return validarCNPJ(fd.get('cnpj')) ? '' : 'CNPJ inválido.'; }
    });
    if (!f) return;
    const d = Object.fromEntries(f.entries()); d.cnpj = d.cnpj.replace(/\D/g, ''); d.propria = !!f.get('propria');
    if (x) Object.assign(x, d);
    else { d.id = Dados.id('emp'); Dados.e.empresas.push(d); if (!Dados.e.empresaAtiva) Dados.e.empresaAtiva = d.id; }
    Dados.salvar(); App.redesenhar(); aviso('Empresa salva.');
  }

  const est = { filtro: 'todos', q: '', ordem: 'valorGanho' };
  const pc = function (v) { return v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + '%'; };
  const dataBR = function (iso) { return iso ? iso.split('-').reverse().join('/') : ''; };
  function cfgDe(id) { return Telas.comissao && Telas.comissao.rel ? Telas.comissao.rel.cfgDe(id) : {}; }

  function cartaoEmpresa(x, l, ativo) {
    const k = function (rot, v, cls) { return '<div class="' + (cls || '') + '"><small>' + rot + '</small><b>' + v + '</b></div>'; };
    const alertas = [];
    if (l.docsVencidos) alertas.push('<span class="tag vermelho">' + l.docsVencidos + ' documento(s) vencido(s)</span>');
    if (l.docsVencendo) alertas.push('<span class="tag laranja">' + l.docsVencendo + ' vence(m) em 30 dias</span>');
    if (l.atrasado) alertas.push('<span class="tag vermelho">' + UI.moeda(l.atrasado) + ' em atraso</span>');
    if (l.proximaSessao) alertas.push('<span class="tag claro">Sessão em ' + dataBR(l.proximaSessao) + '</span>');
    return '<article class="cartao cl-emp' + (x.propria ? ' propria' : '') + (ativo ? ' ativo' : '') + '"><header><div><h3>' + esc(x.fantasia || x.razao) + '</h3><p class="mini mudo">' + esc(x.razao) + ' · CNPJ ' + esc(cnpj(x.cnpj)) + ' · ' + esc((x.municipio ? x.municipio + '-' : '') + (x.uf || '')) + '</p></div>' +
      '<div class="cl-emp-tags">' + (x.propria ? '<span class="tag ouro">Minha empresa</span>' : '') + (x.porte ? '<span class="tag">' + esc(x.porte) + '</span>' : '') + (ativo ? '<span class="tag verde">Ativa</span>' : '') + '</div></header>' +
      '<div class="cl-emp-kpis">' + k('Em andamento', l.oportunidades) + k('Propostas em preparo', l.propostasPreparo) + k('Sessões em 7 dias', l.sessoes7) + k('Ganhas no ano', l.ganhas + (l.decididas ? ' <small>de ' + l.decididas + ' · ' + pc(l.taxa) + '</small>' : ''), 'ok') +
        k('Valor ganho no ano', UI.moeda(l.valorGanho)) + k('Recebido no ano', UI.moeda(l.recebido)) + k('A receber', UI.moeda(l.aReceber)) + (x.propria ? k('Documentos', l.docs) : k('Comissão no ano', UI.moeda(l.comissao))) + '</div>' +
      (alertas.length ? '<div class="cl-emp-alertas">' + alertas.join('') + '</div>' : '') +
      '<footer class="grupo-botoes">' + (ativo ? '' : '<button type="button" class="btn primario mini" data-a="ativar" data-id="' + x.id + '">Trabalhar nesta empresa</button>') +
        '<button type="button" class="btn mini" data-a="resultados" data-id="' + x.id + '">📊 Resultados</button>' + (x.propria ? '' : '<button type="button" class="btn mini" data-a="comissao" data-id="' + x.id + '">% Condições</button>') +
        '<button type="button" class="btn mini fantasma" data-a="editar" data-id="' + x.id + '">Editar</button><button type="button" class="btn mini fantasma perigo" data-a="excluir" data-id="' + x.id + '">Excluir</button></footer></article>';
  }

  Telas.empresas = {
    titulo: 'Seven Clientes',
    novo: editar,
    render: function (el) {
      const e = Dados.e; const ano = new Date().getFullYear();
      if (!e.empresas.length) { el.innerHTML = UI.vazio('Nenhuma empresa ainda', 'Cadastre os clientes que você assessora (cada um com seu CNPJ) e, se quiser, a sua própria empresa, para ver o resultado de cada uma e o geral.', '<button class="btn primario" data-a="novo">+ Nova empresa</button>'); el.onclick = function (ev) { if (ev.target.closest('[data-a=novo]')) editar(); }; return; }
      const c = Performance.carteira(e, { cfgDe: cfgDe, filtro: est.filtro }); const t = c.total;
      const porId = {}; c.linhas.forEach(function (l) { porId[l.id] = l; });
      const q = Nucleo.normalizar(est.q);
      const emps = e.empresas.filter(function (x) { return porId[x.id] && (!q || Nucleo.normalizar([x.razao, x.fantasia, x.cnpj, x.municipio, x.ramo].join(' ')).indexOf(q) >= 0); })
        .sort(function (a, b) { if (!!b.propria !== !!a.propria) return b.propria ? 1 : -1; if (est.ordem === 'nome') return String(a.fantasia || a.razao).localeCompare(String(b.fantasia || b.razao), 'pt-BR'); return (porId[b.id][est.ordem] || 0) - (porId[a.id][est.ordem] || 0); });
      const temPropria = e.empresas.some(function (x) { return x.propria; });
      const filtros = [['todos', 'Todas'], ['clientes', 'Só clientes'], ['propria', 'Minha empresa']].filter(function (f) { return f[0] !== 'propria' || temPropria; });
      el.innerHTML = '<section class="cartao cl-geral"><header class="cl-geral-cab"><div><h3>Resultado geral · ' + ano + '</h3><p class="mini mudo">' + t.empresas + ' empresa(s)' + (temPropria ? ', ' + t.clientes + ' cliente(s) e a sua empresa' : '') + (est.filtro !== 'todos' ? ' (filtro: ' + filtros.find(function (f) { return f[0] === est.filtro; })[1].toLowerCase() + ')' : '') + '</p></div>' +
        '<div class="grupo-botoes"><a class="btn mini" href="#/relatorios/base">Base de performance</a><button type="button" class="btn primario" data-a="novo">+ Nova empresa</button></div></header>' +
        '<div class="cm-numeros cm-kpis">' + [['Em andamento', t.oportunidades], ['Sessões em 7 dias', t.sessoes7], ['Ganhas no ano', t.ganhas + (t.decididas ? ' <small>· ' + pc(t.taxa) + '</small>' : ''), 'ok'], ['Valor ganho no ano', UI.moeda(t.valorGanho)], ['Recebido no ano', UI.moeda(t.recebido), 'ok'], ['A receber', UI.moeda(t.aReceber)], ['Em atraso', UI.moeda(t.atrasado), t.atrasado ? 'ruim' : ''], ['Comissão no ano', UI.moeda(t.comissao)], ['Documentos vencidos', t.docsVencidos, t.docsVencidos ? 'ruim' : '']].map(function (x) { return '<div class="' + (x[2] || '') + '"><small>' + x[0] + '</small><b>' + x[1] + '</b></div>'; }).join('') + '</div></section>' +
        '<form class="cl-filtros" id="cl-f" autocomplete="off"><div class="cfg-radios" role="radiogroup" aria-label="Mostrar">' + filtros.map(function (f) { return '<label class="cm-pilula"><input type="radio" name="filtro" value="' + f[0] + '"' + (est.filtro === f[0] ? ' checked' : '') + '><span>' + f[1] + '</span></label>'; }).join('') + '</div>' +
        '<input type="search" name="q" placeholder="Buscar por nome, CNPJ, cidade ou ramo" value="' + esc(est.q) + '" aria-label="Buscar empresa">' +
        '<select name="ordem" aria-label="Ordenar">' + opcoes([{ v: 'valorGanho', t: 'Maior valor ganho' }, { v: 'aReceber', t: 'Mais a receber' }, { v: 'sessoes7', t: 'Mais sessões na semana' }, { v: 'oportunidades', t: 'Mais em andamento' }, { v: 'nome', t: 'Nome' }], est.ordem) + '</select></form>' +
        (emps.length ? '<div class="cl-emps">' + emps.map(function (x) { return cartaoEmpresa(x, porId[x.id], e.empresaAtiva === x.id || (!e.empresaAtiva && x === e.empresas[0])); }).join('') + '</div>' : '<p class="mudo">Nenhuma empresa encontrada.</p>') +
        '<p class="mini mudo">A empresa ativa (no topo da tela) é a que você está operando: ela filtra propostas, documentos, disputas e acompanhamentos. Os resultados acima somam todas.</p>';
      const f = el.querySelector('#cl-f');
      f.onchange = function () { const d = new FormData(f); est.filtro = d.get('filtro') || 'todos'; est.ordem = d.get('ordem'); App.redesenhar(); };
      f.oninput = function (ev) { if (ev.target.name !== 'q') return; est.q = ev.target.value; const p = ev.target.selectionStart; App.redesenhar(); const n = document.querySelector('#cl-f [name=q]'); if (n) { n.focus(); n.setSelectionRange(p, p); } };
      f.onsubmit = function (ev) { ev.preventDefault(); };
      el.onclick = async function (ev) {
        const b = ev.target.closest('[data-a]'); if (!b) return;
        const x = e.empresas.find(function (y) { return y.id === b.dataset.id; });
        if (b.dataset.a === 'novo') editar();
        if (b.dataset.a === 'editar') editar(x);
        if (b.dataset.a === 'ativar') { e.empresaAtiva = x.id; Dados.salvar(); App.redesenhar(); aviso('Trabalhando em ' + (x.fantasia || x.razao) + '.'); }
        if (b.dataset.a === 'resultados') { e.relatorios = e.relatorios || {}; e.relatorios.cliente = x.id; Dados.salvar(); location.hash = '#/relatorios'; }
        if (b.dataset.a === 'comissao') { e.empresaAtiva = x.id; Dados.salvar(); location.hash = '#/comissao/condicoes'; }
        if (b.dataset.a === 'excluir' && await confirmar('Excluir empresa', 'Excluir <b>' + esc(x.razao) + '</b>? Propostas, documentos e disputas dela continuam guardados, mas sem empresa.', 'Excluir')) {
          e.empresas = e.empresas.filter(function (y) { return y !== x; }); if (e.empresaAtiva === x.id) e.empresaAtiva = e.empresas[0] && e.empresas[0].id; Dados.salvar(); App.redesenhar();
        }
      };
    }
  };
  Telas.empresas.validarCNPJ = validarCNPJ;
})();
