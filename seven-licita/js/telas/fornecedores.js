/* Fornecedores: cadastro, portfólio, documentos, histórico de contatos e indicadores de cotação. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, confirmar, aviso, dataHora, moeda, cnpj, data } = UI;
  const XLSX_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
  const TIPOS_HIST = { ligacao: '📞 Ligação', whatsapp: '💬 WhatsApp', email: '✉️ E-mail', reuniao: '👥 Reunião', visita: '🚗 Visita', nota: '📝 Anotação' };
  const est = { busca: '', categoria: '', uf: '', status: '', aba: 'resumo', ordem: 'nome' };

  function lista() { Dados.e.fornecedores = Dados.e.fornecedores || []; return Dados.e.fornecedores; }
  function cotacoes() { return Dados.e.cotacoes || []; }
  function achar(id) { return lista().find(function (f) { return f.id === id; }); }
  function nome(f) { return f ? (f.fantasia || f.razao || 'Sem nome') : '—'; }
  function pct(v) { return v == null ? '—' : Math.round(v * 100) + '%'; }
  function estrelas(n) { if (n == null) return '<span class="mudo">sem histórico</span>'; const c = Math.round(n); return '<span class="fo-estrelas" title="' + String(n).replace('.', ',') + ' de 5">' + '★★★★★'.slice(0, c) + '<i>' + '★★★★★'.slice(c) + '</i></span>'; }
  function horas(h) { if (h == null) return '—'; if (h < 1) return Math.round(h * 60) + ' min'; if (h < 48) return Math.round(h) + ' h'; return Math.round(h / 24) + ' dias'; }

  // ---------- planilhas (compartilhado com Cotações) ----------
  function carregarXLSX() {
    if (self.XLSX) return Promise.resolve(self.XLSX);
    return new Promise(function (ok, erro) { const s = document.createElement('script'); s.src = XLSX_CDN; s.onload = function () { ok(self.XLSX); }; s.onerror = function () { erro(new Error('Não consegui carregar o leitor de Excel (sem internet?). Use CSV.')); }; document.head.appendChild(s); });
  }
  function csvParaLinhas(t) {
    const sep = (t.split('\n')[0].match(/;/g) || []).length >= (t.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    const out = []; let linha = [], c = '', aspas = false;
    for (let i = 0; i < t.length; i++) { const ch = t[i];
      if (aspas) { if (ch === '"' && t[i + 1] === '"') { c += '"'; i++; } else if (ch === '"') aspas = false; else c += ch; }
      else if (ch === '"') aspas = true; else if (ch === sep) { linha.push(c); c = ''; } else if (ch === '\n') { linha.push(c.replace(/\r$/, '')); out.push(linha); linha = []; c = ''; } else c += ch; }
    if (c || linha.length) { linha.push(c); out.push(linha); }
    return out;
  }
  async function lerTabela(arq) {
    if (/\.(csv|txt)$/i.test(arq.name)) return { abas: { Planilha: csvParaLinhas(await arq.text()) } };
    const X = await carregarXLSX(); const wb = X.read(await arq.arrayBuffer(), { type: 'array' }); const abas = {};
    wb.SheetNames.forEach(function (n) { abas[n] = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); });
    return { abas: abas, nomes: wb.SheetNames };
  }
  function csvDe(linhas) { return '﻿' + linhas.map(function (r) { return r.map(function (v) { v = v && typeof v === 'object' ? '' : (v == null ? '' : String(v)); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); }).join('\r\n'); }
  async function baixarPlanilha(nomeArq, abas, larguras) {
    try {
      const X = await carregarXLSX(); const wb = X.utils.book_new();
      abas.forEach(function (a) { const ws = X.utils.aoa_to_sheet(a.linhas); if (a.larguras || larguras) ws['!cols'] = (a.larguras || larguras).map(function (w) { return { wch: w }; }); if (a.mesclar) ws['!merges'] = a.mesclar; X.utils.book_append_sheet(wb, ws, a.nome); });
      wb.Workbook = { Sheets: abas.map(function (a) { return { Hidden: a.oculta ? 1 : 0 }; }) };
      X.writeFile(wb, nomeArq + '.xlsx');
    } catch (err) { UI.baixar(nomeArq + '.csv', csvDe(abas[0].linhas), 'text/csv;charset=utf-8'); aviso('Excel indisponível: baixei em CSV.', 'erro'); }
  }

  // ---------- cadastro ----------
  async function consultarCNPJ(num) {
    const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + num); if (!r.ok) throw new Error(r.status === 404 ? 'CNPJ não encontrado na Receita.' : 'Consulta indisponível agora (' + r.status + ').');
    return r.json();
  }
  async function editar(f) {
    const novo = !f; f = f || {};
    const r = await modal({ titulo: novo ? 'Novo fornecedor' : 'Editar fornecedor', largo: true, corpo:
      '<div class="linha">' + campo('CNPJ', '<input name="cnpj" inputmode="numeric" value="' + esc(f.cnpj ? cnpj(f.cnpj) : '') + '" placeholder="00.000.000/0000-00">') + '<button type="button" class="btn" data-cnpj style="align-self:end;margin-bottom:12px">Buscar na Receita</button>' + campo('Status', '<select name="status">' + opcoes([{ v: 'ativo', t: 'Ativo' }, { v: 'homologado', t: 'Homologado / parceiro' }, { v: 'bloqueado', t: 'Bloqueado' }], f.status || 'ativo') + '</select>') + '</div>' +
      '<div class="linha">' + campo('Razão social *', '<input name="razao" required value="' + esc(f.razao || '') + '">') + campo('Nome fantasia', '<input name="fantasia" value="' + esc(f.fantasia || '') + '">') + '</div>' +
      '<fieldset><legend>Contato</legend><div class="linha">' + campo('Contato (vendedor)', '<input name="contato" value="' + esc(f.contato || '') + '">') + campo('Cargo', '<input name="cargo" value="' + esc(f.cargo || '') + '">') + campo('E-mail', '<input name="email" type="email" value="' + esc(f.email || '') + '">') + '</div>' +
      '<div class="linha">' + campo('WhatsApp', '<input name="whatsapp" inputmode="tel" value="' + esc(f.whatsapp || '') + '" placeholder="(61) 90000-0000">') + campo('Telefone', '<input name="telefone" inputmode="tel" value="' + esc(f.telefone || '') + '">') + campo('Site', '<input name="site" value="' + esc(f.site || '') + '">') + '</div>' +
      '<div class="linha">' + campo('Cidade', '<input name="cidade" value="' + esc(f.cidade || '') + '">') + campo('UF', '<select name="uf"><option value=""></option>' + opcoes(UFS, f.uf) + '</select>') + campo('Endereço', '<input name="endereco" value="' + esc(f.endereco || '') + '">') + '</div></fieldset>' +
      '<fieldset><legend>O que fornece</legend>' + campo('Categorias', '<input name="categorias" value="' + esc((f.categorias || []).join(', ')) + '" placeholder="papelaria, informática, limpeza, EPI">', 'Separe por vírgula. Usadas para sugerir o fornecedor nas cotações.') + campo('Marcas que representa', '<input name="marcas" value="' + esc((f.marcas || []).join(', ')) + '">') + campo('Regiões atendidas', '<input name="regioes" value="' + esc((f.regioes || []).join(', ')) + '" placeholder="GO, DF, MG ou Brasil">') + '</fieldset>' +
      '<fieldset><legend>Condições comerciais</legend><div class="linha">' + campo('Prazo de entrega (dias)', '<input name="prazoEntrega" inputmode="numeric" value="' + esc(f.prazoEntrega || '') + '">') + campo('Pagamento', '<input name="pagamento" value="' + esc(f.pagamento || '') + '" placeholder="28 dias, boleto">') + campo('Frete', '<select name="frete">' + opcoes([{ v: '', t: '—' }, { v: 'CIF', t: 'CIF (por conta do fornecedor)' }, { v: 'FOB', t: 'FOB (por nossa conta)' }, { v: 'CIF acima do mínimo', t: 'CIF acima do mínimo' }], f.frete || '') + '</select>') + campo('Faturamento mínimo (R$)', '<input name="minimo" inputmode="decimal" value="' + esc(f.minimo || '') + '">') + '</div>' +
      '<label class="check"><input type="checkbox" name="aceitaEmpenho"' + (f.aceitaEmpenho ? ' checked' : '') + '> Aceita venda para órgão público (nota de empenho, pagamento em até 30 dias)</label></fieldset>' +
      campo('Observações', '<textarea name="observacoes" rows="3">' + esc(f.observacoes || '') + '</textarea>'),
      aoAbrir: function (form) {
        form.querySelector('[data-cnpj]').onclick = async function () {
          const n = form.cnpj.value.replace(/\D/g, ''); if (n.length !== 14) return aviso('Digite os 14 números do CNPJ.', 'erro');
          this.disabled = true; this.textContent = 'Buscando…';
          try { const d = await consultarCNPJ(n); form.razao.value = d.razao_social || ''; form.fantasia.value = d.nome_fantasia || form.fantasia.value; form.cidade.value = d.municipio || ''; form.uf.value = d.uf || ''; form.endereco.value = [d.descricao_tipo_de_logradouro, d.logradouro, d.numero, d.bairro, d.cep].filter(Boolean).join(', '); if (d.ddd_telefone_1 && !form.telefone.value) form.telefone.value = d.ddd_telefone_1; if (d.email && !form.email.value) form.email.value = String(d.email).toLowerCase(); if (d.cnae_fiscal_descricao && !form.categorias.value) form.categorias.value = d.cnae_fiscal_descricao.split(/[;,]/)[0].toLowerCase(); aviso('Dados da Receita preenchidos' + (d.descricao_situacao_cadastral && d.descricao_situacao_cadastral !== 'ATIVA' ? ' — ATENÇÃO: situação ' + d.descricao_situacao_cadastral : '') + '.', d.descricao_situacao_cadastral && d.descricao_situacao_cadastral !== 'ATIVA' ? 'erro' : ''); }
          catch (err) { aviso(err.message, 'erro'); }
          this.disabled = false; this.textContent = 'Buscar na Receita';
        };
      },
      validar: function (fd) { const c = fd.get('cnpj').replace(/\D/g, ''); if (c && c.length !== 14) return 'CNPJ incompleto.'; if (c && lista().some(function (x) { return x.cnpj === c && x.id !== f.id; })) return 'Já existe um fornecedor com esse CNPJ.'; return ''; } });
    if (!r) return null;
    const sep = function (v) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); };
    Object.assign(f, { cnpj: r.get('cnpj').replace(/\D/g, ''), status: r.get('status'), razao: r.get('razao').trim(), fantasia: r.get('fantasia').trim(), contato: r.get('contato').trim(), cargo: r.get('cargo'), email: r.get('email').trim(), whatsapp: r.get('whatsapp'), telefone: r.get('telefone'), site: r.get('site'), cidade: r.get('cidade'), uf: r.get('uf'), endereco: r.get('endereco'), categorias: sep(r.get('categorias')), marcas: sep(r.get('marcas')), regioes: sep(r.get('regioes')), prazoEntrega: r.get('prazoEntrega'), pagamento: r.get('pagamento'), frete: r.get('frete'), minimo: r.get('minimo'), aceitaEmpenho: !!r.get('aceitaEmpenho'), observacoes: r.get('observacoes'), atualizadoEm: new Date().toISOString() });
    if (novo) { f.id = Dados.id('forn'); f.criadoEm = f.atualizadoEm; f.portfolio = []; f.historico = []; f.documentos = []; lista().unshift(f); }
    Dados.salvar(); aviso(novo ? 'Fornecedor cadastrado.' : 'Fornecedor atualizado.'); return f;
  }

  async function importar() {
    const arq = await UI.escolherArquivo('.xlsx,.xls,.csv', false); if (!arq) return;
    try {
      const t = await lerTabela(arq); const L = t.abas[Object.keys(t.abas)[0]];
      let h = L.findIndex(function (r) { const n = r.map(Cotacoes.normalizar).join('|'); return /razao|fornecedor|empresa|nome/.test(n) && /cnpj|email|telefone|whats|contato/.test(n); });
      if (h < 0) return aviso('Não encontrei o cabeçalho (Razão social, CNPJ, E-mail, WhatsApp…).', 'erro');
      const cab = L[h].map(Cotacoes.normalizar); const col = function (re) { return cab.findIndex(function (c) { return re.test(c); }); };
      const c = { razao: col(/razao|fornecedor|empresa|^nome$/), fantasia: col(/fantasia/), cnpj: col(/cnpj/), contato: col(/contato|vendedor|representante/), email: col(/mail/), whatsapp: col(/whats|celular/), telefone: col(/telefone|fone/), cidade: col(/cidade|municipio/), uf: col(/^uf$|estado/), categorias: col(/categoria|segmento|ramo/), marcas: col(/marca/) };
      let novos = 0, atual = 0;
      L.slice(h + 1).forEach(function (r) {
        const v = function (k) { return c[k] >= 0 ? String(r[c[k]] == null ? '' : r[c[k]]).trim() : ''; };
        if (!v('razao') && !v('fantasia')) return;
        const num = v('cnpj').replace(/\D/g, ''); let f = num ? lista().find(function (x) { return x.cnpj === num; }) : null;
        const d = { razao: v('razao') || v('fantasia'), fantasia: v('fantasia'), cnpj: num, contato: v('contato'), email: v('email'), whatsapp: v('whatsapp'), telefone: v('telefone'), cidade: v('cidade'), uf: v('uf').toUpperCase().slice(0, 2), categorias: v('categorias').split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean), marcas: v('marcas').split(/[,;]/).map(function (x) { return x.trim(); }).filter(Boolean) };
        if (f) { Object.keys(d).forEach(function (k) { if (d[k] && (!Array.isArray(d[k]) || d[k].length)) f[k] = d[k]; }); atual++; }
        else { lista().push(Object.assign({ id: Dados.id('forn'), status: 'ativo', portfolio: [], historico: [], documentos: [], criadoEm: new Date().toISOString() }, d)); novos++; }
      });
      Dados.salvar(); aviso(novos + ' fornecedor(es) novos, ' + atual + ' atualizados.'); App.redesenhar();
    } catch (err) { aviso(err.message, 'erro'); }
  }
  function exportar() {
    const L = [['Razão social', 'Fantasia', 'CNPJ', 'Status', 'Contato', 'E-mail', 'WhatsApp', 'Telefone', 'Cidade', 'UF', 'Categorias', 'Marcas', 'Prazo entrega', 'Pagamento', 'Frete', 'Cotações enviadas', 'Taxa de resposta', 'Nota']];
    lista().forEach(function (f) { const i = Cotacoes.indicadores(f.id, cotacoes()); L.push([f.razao, f.fantasia, f.cnpj ? cnpj(f.cnpj) : '', f.status, f.contato, f.email, f.whatsapp, f.telefone, f.cidade, f.uf, (f.categorias || []).join(', '), (f.marcas || []).join(', '), f.prazoEntrega, f.pagamento, f.frete, i.enviadas, pct(i.taxaResposta), i.nota == null ? '' : i.nota]); });
    baixarPlanilha('fornecedores-seven', [{ nome: 'Fornecedores', linhas: L }], [34, 22, 20, 10, 18, 26, 16, 16, 16, 5, 30, 20, 10, 14, 8, 10, 10, 6]);
  }

  // ---------- lista ----------
  function telaLista(el) {
    est.fichaDe = null; // ao voltar da lista, a ficha abre no Resumo
    const todos = lista(); const cats = {}; todos.forEach(function (f) { (f.categorias || []).forEach(function (c) { cats[c] = (cats[c] || 0) + 1; }); });
    const q = Cotacoes.normalizar(est.busca);
    let fs = todos.filter(function (f) {
      if (est.categoria && (f.categorias || []).indexOf(est.categoria) < 0) return false; if (est.uf && f.uf !== est.uf) return false; if (est.status && (f.status || 'ativo') !== est.status) return false;
      if (q && Cotacoes.normalizar([f.razao, f.fantasia, f.cnpj, f.contato, f.email, f.cidade, (f.categorias || []).join(' '), (f.marcas || []).join(' '), (f.portfolio || []).map(function (p) { return p.descricao + ' ' + (p.marca || ''); }).join(' ')].join(' ')).indexOf(q) < 0) return false;
      return true;
    }).map(function (f) { return { f: f, i: Cotacoes.indicadores(f.id, cotacoes()) }; });
    fs.sort(function (a, b) { if (est.ordem === 'nota') return (b.i.nota || -1) - (a.i.nota || -1); if (est.ordem === 'recentes') return String(b.i.ultimaCotacao || b.f.criadoEm).localeCompare(String(a.i.ultimaCotacao || a.f.criadoEm)); return nome(a.f).localeCompare(nome(b.f), 'pt-BR'); });
    const pend = Cotacoes.pendencias(cotacoes()).length;
    el.innerHTML = '<div class="kpis pequenos"><div><span>Fornecedores</span><b>' + todos.length + '</b></div><div><span>Homologados / parceiros</span><b>' + todos.filter(function (f) { return f.status === 'homologado'; }).length + '</b></div><div><span>Produtos no portfólio</span><b>' + todos.reduce(function (s, f) { return s + (f.portfolio || []).length; }, 0) + '</b></div><a href="#/cotacoes"><span>Follow-ups pendentes</span><b class="' + (pend ? 'alerta' : '') + '">' + pend + '</b></a></div>' +
      '<div class="barra-acoes"><div class="filtros" style="margin:0;flex:1"><input type="search" id="fo-busca" placeholder="Buscar por nome, CNPJ, produto, marca, cidade…" value="' + esc(est.busca) + '">' +
      '<select id="fo-cat"><option value="">Todas as categorias</option>' + opcoes(Object.keys(cats).sort().map(function (c) { return { v: c, t: c + ' (' + cats[c] + ')' }; }), est.categoria) + '</select><select id="fo-uf"><option value="">UF</option>' + opcoes(UFS, est.uf) + '</select>' +
      '<select id="fo-st">' + opcoes([{ v: '', t: 'Todos os status' }, { v: 'ativo', t: 'Ativos' }, { v: 'homologado', t: 'Homologados' }, { v: 'bloqueado', t: 'Bloqueados' }], est.status) + '</select><select id="fo-ord">' + opcoes([{ v: 'nome', t: 'Nome' }, { v: 'nota', t: 'Melhor nota' }, { v: 'recentes', t: 'Mais recentes' }], est.ordem) + '</select></div>' +
      '<div class="grupo-botoes"><button class="btn" data-a="importar">Importar planilha</button><button class="btn" data-a="exportar">Exportar</button><button class="btn primario" data-a="novo">+ Novo fornecedor</button></div></div>' +
      (fs.length ? '<div class="tabela-rolagem"><table class="tabela fo-tabela"><thead><tr><th>Fornecedor</th><th>Contato</th><th>Categorias</th><th>Local</th><th class="n">Cotações</th><th class="n">Resposta</th><th class="n">Tempo</th><th>Nota</th><th></th></tr></thead><tbody>' + fs.map(function (x) {
        const f = x.f, i = x.i; const w = Cotacoes.telefoneWhats(f.whatsapp);
        return '<tr class="clicavel" data-ver="' + f.id + '"><td><b>' + esc(nome(f)) + '</b>' + (f.status === 'homologado' ? ' <span class="tag ouro mini">parceiro</span>' : f.status === 'bloqueado' ? ' <span class="tag vermelho mini">bloqueado</span>' : '') + '<br><small class="mudo">' + esc(f.cnpj ? cnpj(f.cnpj) : f.razao !== f.fantasia ? f.razao || '' : '') + '</small></td>' +
          '<td>' + esc(f.contato || '') + '<br><small class="mudo">' + esc(f.email || f.telefone || '') + '</small></td><td><div class="tags">' + (f.categorias || []).slice(0, 3).map(function (c) { return '<span class="tag claro">' + esc(c) + '</span>'; }).join('') + '</div></td><td>' + esc([f.cidade, f.uf].filter(Boolean).join('-')) + '</td>' +
          '<td class="n">' + i.enviadas + '</td><td class="n">' + pct(i.taxaResposta) + '</td><td class="n">' + horas(i.tempoMedioHoras) + '</td><td>' + estrelas(i.nota) + '</td>' +
          '<td class="fo-acoes">' + (w ? '<a class="icone" href="https://wa.me/' + w + '" target="_blank" rel="noopener" title="Abrir WhatsApp" data-externo>💬</a>' : '') + (f.email ? '<a class="icone" href="mailto:' + esc(f.email) + '" title="E-mail" data-externo>✉️</a>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : UI.vazio(todos.length ? 'Nenhum fornecedor encontrado' : 'Cadastre seus fornecedores', todos.length ? 'Ajuste os filtros.' : 'Monte sua rede de fornecedores com contatos, categorias e portfólio. Eles serão sugeridos automaticamente nas cotações. Também dá para importar de uma planilha.', '<button class="btn primario" data-a="novo">+ Novo fornecedor</button>'));
    const b = el.querySelector('#fo-busca'); b.oninput = function () { est.busca = b.value; clearTimeout(b._t); b._t = setTimeout(function () { App.redesenhar(); const i = document.getElementById('fo-busca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    el.onchange = function (ev) { const m = { 'fo-cat': 'categoria', 'fo-uf': 'uf', 'fo-st': 'status', 'fo-ord': 'ordem' }[ev.target.id]; if (m) { est[m] = ev.target.value; App.redesenhar(); } };
    el.onclick = async function (ev) {
      if (ev.target.closest('[data-externo]')) return;
      const a = ev.target.closest('[data-a]'); if (a) { if (a.dataset.a === 'novo') { const f = await editar(); if (f) location.hash = '#/fornecedores/ver/' + f.id; } if (a.dataset.a === 'importar') importar(); if (a.dataset.a === 'exportar') exportar(); return; }
      const v = ev.target.closest('[data-ver]'); if (v) location.hash = '#/fornecedores/ver/' + v.dataset.ver;
    };
  }

  // ---------- ficha ----------
  function historicoCompleto(f) {
    const ev = (f.historico || []).map(function (h) { return { em: h.em, tipo: h.tipo, texto: h.texto, id: h.id, manual: true }; });
    cotacoes().forEach(function (c) {
      const x = (c.fornecedores || []).find(function (y) { return y.fid === f.id; }); if (!x) return;
      const link = '<a href="#/cotacoes/ver/' + c.id + '">' + esc(c.numero) + '</a> ' + esc(c.titulo || '');
      ev.push({ em: x.incluidoEm || c.criadoEm, tipo: 'cotacao', texto: 'Incluído na cotação ' + link, html: true });
      if (x.enviadaEm) ev.push({ em: x.enviadaEm, tipo: x.canal || 'email', texto: 'Cotação ' + link + ' enviada por ' + (x.canal === 'whatsapp' ? 'WhatsApp' : x.canal === 'planilha' ? 'planilha' : 'e-mail'), html: true });
      (x.followups || []).forEach(function (fu, k) { ev.push({ em: fu.em, tipo: fu.canal || 'nota', texto: 'Follow-up ' + (k + 1) + ' da cotação ' + link + (fu.nota ? ': ' + esc(fu.nota) : ''), html: true }); });
      if (x.resposta) ev.push({ em: x.resposta.recebidaEm, tipo: 'resposta', texto: 'Respondeu a cotação ' + link + ' (' + Object.keys(x.resposta.itens || {}).length + ' item(ns))', html: true });
      if (x.status === 'recusou') ev.push({ em: x.recusouEm || x.enviadaEm, tipo: 'recusa', texto: 'Declinou a cotação ' + link, html: true });
    });
    return ev.filter(function (e) { return e.em; }).sort(function (a, b) { return String(b.em).localeCompare(String(a.em)); });
  }

  function telaFicha(el, id) {
    const f = achar(id); if (!f) { el.innerHTML = UI.vazio('Fornecedor não encontrado', '<a href="#/fornecedores">Voltar</a>'); return; }
    const i = Cotacoes.indicadores(f.id, cotacoes()); const w = Cotacoes.telefoneWhats(f.whatsapp);
    const abas = [['resumo', 'Resumo'], ['portfolio', 'Portfólio (' + (f.portfolio || []).length + ')'], ['cotacoes', 'Cotações (' + i.participacoes.length + ')'], ['historico', 'Histórico'], ['documentos', 'Documentos (' + (f.documentos || []).length + ')']];
    let corpo = '';
    if (est.aba === 'resumo') corpo = '<div class="kpis pequenos"><div><span>Nota do fornecedor</span><b>' + (i.nota == null ? '—' : String(i.nota).replace('.', ',')) + '</b>' + estrelas(i.nota) + '</div><div><span>Cotações enviadas</span><b>' + i.enviadas + '</b></div><div><span>Taxa de resposta</span><b>' + pct(i.taxaResposta) + '</b></div><div><span>Tempo médio de resposta</span><b>' + horas(i.tempoMedioHoras) + '</b></div><div><span>Itens com melhor preço</span><b>' + i.itensVencidos + ' de ' + i.itensCotados + '</b></div><div><span>Follow-ups feitos</span><b>' + i.followups + '</b></div></div>' +
      '<div class="cartao"><dl class="numeros"><div><dt>Razão social</dt><dd>' + esc(f.razao || '—') + '</dd></div><div><dt>CNPJ</dt><dd>' + esc(f.cnpj ? cnpj(f.cnpj) : '—') + '</dd></div><div><dt>Contato</dt><dd>' + esc((f.contato || '—') + (f.cargo ? ' (' + f.cargo + ')' : '')) + '</dd></div><div><dt>E-mail</dt><dd>' + esc(f.email || '—') + '</dd></div><div><dt>WhatsApp</dt><dd>' + esc(f.whatsapp || '—') + '</dd></div><div><dt>Telefone</dt><dd>' + esc(f.telefone || '—') + '</dd></div><div><dt>Local</dt><dd>' + esc([f.endereco, f.cidade, f.uf].filter(Boolean).join(', ') || '—') + '</dd></div><div><dt>Regiões atendidas</dt><dd>' + esc((f.regioes || []).join(', ') || '—') + '</dd></div></dl></div>' +
      '<div class="cartao"><h3>Condições comerciais</h3><dl class="numeros"><div><dt>Prazo de entrega</dt><dd>' + esc(f.prazoEntrega ? f.prazoEntrega + ' dias' : '—') + '</dd></div><div><dt>Pagamento</dt><dd>' + esc(f.pagamento || '—') + '</dd></div><div><dt>Frete</dt><dd>' + esc(f.frete || '—') + '</dd></div><div><dt>Faturamento mínimo</dt><dd>' + (f.minimo ? moeda(Cotacoes.numeroBR(f.minimo)) : '—') + '</dd></div><div><dt>Vende para órgão público</dt><dd>' + (f.aceitaEmpenho ? 'Sim' : 'Não informado') + '</dd></div></dl>' +
      '<h3>Categorias e marcas</h3><div class="tags">' + (f.categorias || []).map(function (c) { return '<span class="tag">' + esc(c) + '</span>'; }).join('') + (f.marcas || []).map(function (c) { return '<span class="tag ouro">' + esc(c) + '</span>'; }).join('') + '</div>' + (f.observacoes ? '<h3>Observações</h3><p>' + esc(f.observacoes).replace(/\n/g, '<br>') + '</p>' : '') + '</div>';
    if (est.aba === 'portfolio') { const P = f.portfolio || []; corpo = '<div class="barra-acoes"><p class="mudo">Produtos e serviços que o fornecedor oferece, com o último preço conhecido. Preços de cotações respondidas entram aqui automaticamente.</p><div class="grupo-botoes"><button class="btn" data-a="imp-port">Importar planilha / catálogo</button><button class="btn" data-a="exp-port">Exportar</button><button class="btn primario" data-a="add-port">+ Produto</button></div></div>' +
      (P.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Produto / serviço</th><th>Marca</th><th>Modelo</th><th>Unid.</th><th class="n">Último preço</th><th>Data</th><th>Origem</th><th></th></tr></thead><tbody>' + P.map(function (p) { return '<tr><td>' + esc(p.descricao) + (p.codigo ? '<br><small class="mudo">' + esc(p.codigo) + '</small>' : '') + '</td><td>' + esc(p.marca || '') + '</td><td>' + esc(p.modelo || '') + '</td><td>' + esc(p.unidade || '') + '</td><td class="n">' + (p.preco != null ? moeda(p.preco) : '—') + '</td><td>' + (p.data ? data(p.data) : '—') + '</td><td><small>' + esc(p.origem || 'cadastro') + '</small></td><td><button class="icone" data-port="' + p.id + '" aria-label="Editar">✎</button><button class="icone" data-del-port="' + p.id + '" aria-label="Excluir">×</button></td></tr>'; }).join('') + '</tbody></table></div>' : UI.vazio('Portfólio vazio', 'Cadastre os produtos que esse fornecedor vende ou importe a tabela de preços dele (Excel ou CSV).')); }
    if (est.aba === 'cotacoes') corpo = i.participacoes.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Cotação</th><th>Status</th><th>Enviada</th><th>Resposta</th><th class="n">Itens cotados</th><th class="n">Melhor preço</th><th class="n">Total cotado</th></tr></thead><tbody>' + i.participacoes.map(function (p) { const m = Cotacoes.mapa(p.cotacao); const pf = m.fornecedores.find(function (x) { return x.fid === f.id; }); return '<tr class="clicavel" data-cot="' + p.cotacao.id + '"><td><b>' + esc(p.cotacao.numero) + '</b> ' + esc(p.cotacao.titulo || '') + '</td><td><span class="tag fo-st-' + p.f.status + '">' + esc(Cotacoes.STATUS[p.f.status] || p.f.status) + '</span></td><td>' + (p.f.enviadaEm ? dataHora(p.f.enviadaEm) : '—') + '</td><td>' + (p.f.resposta ? dataHora(p.f.resposta.recebidaEm) : '—') + '</td><td class="n">' + (pf ? pf.cobertos : 0) + '</td><td class="n">' + (pf ? pf.venceu : 0) + '</td><td class="n">' + (pf ? moeda(pf.total) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>' : UI.vazio('Ainda sem cotações', 'Inclua este fornecedor numa cotação para começar o histórico.', '<a class="btn primario" href="#/cotacoes">Ir para o Seven Quote</a>');
    if (est.aba === 'historico') { const H = historicoCompleto(f); corpo = '<form class="cartao fo-reg" id="fo-reg"><div class="linha">' + campo('Tipo', '<select name="tipo">' + opcoes(Object.keys(TIPOS_HIST).map(function (k) { return { v: k, t: TIPOS_HIST[k] }; }), 'ligacao') + '</select>') + campo('Quando', '<input type="datetime-local" name="em" value="' + new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) + '">') + '</div>' + campo('O que foi tratado', '<textarea name="texto" rows="2" required placeholder="Ex.: negociou frete CIF acima de R$ 1.500; pediu catálogo novo"></textarea>') + '<button class="btn primario">Registrar</button></form>' +
      (H.length ? '<ol class="fo-linha">' + H.map(function (h) { const t = TIPOS_HIST[h.tipo] || { cotacao: '📋 Cotação', resposta: '✅ Resposta', recusa: '⛔ Recusa' }[h.tipo] || h.tipo; return '<li class="fo-ev-' + esc(h.tipo) + '"><small>' + dataHora(h.em) + ' · ' + t + '</small><p>' + (h.html ? h.texto : esc(h.texto)) + '</p>' + (h.manual ? '<button class="icone" data-del-hist="' + h.id + '" aria-label="Excluir">×</button>' : '') + '</li>'; }).join('') + '</ol>' : '<p class="mudo">Sem registros ainda.</p>'); }
    if (est.aba === 'documentos') corpo = '<div class="barra-acoes"><p class="mudo">Catálogos, tabelas de preço, certidões e contratos do fornecedor. Os arquivos ficam guardados neste navegador.</p><button class="btn primario" data-a="add-doc">+ Anexar</button></div>' + ((f.documentos || []).length ? '<ul class="lista-notas">' + f.documentos.map(function (d) { return '<li><b>' + esc(d.nome) + '</b> <small class="mudo">' + esc(d.tipo || '') + ' · ' + dataHora(d.em) + (d.validade ? ' · validade ' + data(d.validade) : '') + '</small> <span class="grupo-botoes"><button class="btn mini" data-baixar-doc="' + d.id + '">Baixar</button><button class="btn mini perigo" data-del-doc="' + d.id + '">Excluir</button></span></li>'; }).join('') + '</ul>' : UI.vazio('Sem documentos', 'Anexe catálogos e tabelas de preço.'));
    el.innerHTML = '<p class="migalhas"><a href="#/fornecedores">Seven Vendor</a> › ' + esc(nome(f)) + '</p><div class="fo-cab"><div><h2>' + esc(nome(f)) + ' ' + (f.status === 'homologado' ? '<span class="tag ouro">parceiro</span>' : f.status === 'bloqueado' ? '<span class="tag vermelho">bloqueado</span>' : '') + '</h2><p class="mudo">' + esc([f.contato, f.cidade && f.cidade + (f.uf ? '-' + f.uf : '')].filter(Boolean).join(' · ')) + '</p></div><div class="grupo-botoes">' + (w ? '<a class="btn" href="https://wa.me/' + w + '" target="_blank" rel="noopener">💬 WhatsApp</a>' : '') + (f.email ? '<a class="btn" href="mailto:' + esc(f.email) + '">✉️ E-mail</a>' : '') + '<button class="btn" data-a="editar">Editar</button><button class="btn perigo" data-a="excluir">Excluir</button></div></div>' +
      '<nav class="abas">' + abas.map(function (a) { return '<a href="#" data-aba="' + a[0] + '" class="' + (est.aba === a[0] ? 'ativa' : '') + '">' + esc(a[1]) + '</a>'; }).join('') + '</nav><div>' + corpo + '</div>';
    const reg = el.querySelector('#fo-reg'); if (reg) reg.onsubmit = function (ev) { ev.preventDefault(); const d = new FormData(reg); f.historico = f.historico || []; f.historico.push({ id: Dados.id('h'), tipo: d.get('tipo'), texto: d.get('texto').trim(), em: new Date(d.get('em') || Date.now()).toISOString() }); Dados.salvar(); aviso('Contato registrado.'); App.redesenhar(); };
    el.onclick = async function (ev) {
      const ab = ev.target.closest('[data-aba]'); if (ab) { ev.preventDefault(); est.aba = ab.dataset.aba; App.redesenhar(); return; }
      const ct = ev.target.closest('[data-cot]'); if (ct) { location.hash = '#/cotacoes/ver/' + ct.dataset.cot; return; }
      const a = ev.target.closest('[data-a]'); const act = a && a.dataset.a;
      if (act === 'editar') { if (await editar(f)) App.redesenhar(); }
      if (act === 'excluir') { if (await confirmar('Excluir fornecedor', 'Excluir "' + esc(nome(f)) + '"? O histórico nas cotações continua, mas sem o cadastro.', 'Excluir')) { (f.documentos || []).forEach(function (d) { Dados.apagarArquivo(d.id); }); Dados.e.fornecedores = lista().filter(function (x) { return x !== f; }); Dados.salvar(); location.hash = '#/fornecedores'; } }
      if (act === 'add-port') { if (await editarProduto(f)) App.redesenhar(); }
      if (act === 'imp-port') importarPortfolio(f);
      if (act === 'exp-port') baixarPlanilha('portfolio-' + Cotacoes.normalizar(nome(f)).replace(/ /g, '-'), [{ nome: 'Portfólio', linhas: [['Código', 'Descrição', 'Marca', 'Modelo', 'Unidade', 'Preço', 'Data', 'Origem']].concat((f.portfolio || []).map(function (p) { return [p.codigo || '', p.descricao, p.marca || '', p.modelo || '', p.unidade || '', p.preco == null ? '' : p.preco, p.data || '', p.origem || '']; })) }], [12, 50, 16, 16, 8, 12, 12, 20]);
      if (act === 'add-doc') { const fs = await UI.escolherArquivo('', true); if (!fs || !fs.length) return; f.documentos = f.documentos || []; for (const x of fs) { const did = Dados.id('fdoc'); await Dados.guardarArquivo(did, x); f.documentos.push({ id: did, nome: x.name, tipo: x.type, tamanho: x.size, em: new Date().toISOString() }); } Dados.salvar(); App.redesenhar(); }
      const pe = ev.target.closest('[data-port]'); if (pe) { if (await editarProduto(f, f.portfolio.find(function (p) { return p.id === pe.dataset.port; }))) App.redesenhar(); }
      const pd = ev.target.closest('[data-del-port]'); if (pd) { f.portfolio = f.portfolio.filter(function (p) { return p.id !== pd.dataset.delPort; }); Dados.salvar(); App.redesenhar(); }
      const hd = ev.target.closest('[data-del-hist]'); if (hd) { f.historico = f.historico.filter(function (h) { return h.id !== hd.dataset.delHist; }); Dados.salvar(); App.redesenhar(); }
      const bd = ev.target.closest('[data-baixar-doc]'); if (bd) { const d = f.documentos.find(function (x) { return x.id === bd.dataset.baixarDoc; }); const b = await Dados.lerArquivo(d.id); if (b) UI.baixar(d.nome, b); else aviso('Arquivo não está neste navegador.', 'erro'); }
      const dd = ev.target.closest('[data-del-doc]'); if (dd && await confirmar('Excluir documento', 'Excluir este arquivo?', 'Excluir')) { Dados.apagarArquivo(dd.dataset.delDoc); f.documentos = f.documentos.filter(function (x) { return x.id !== dd.dataset.delDoc; }); Dados.salvar(); App.redesenhar(); }
    };
  }

  async function editarProduto(f, p) {
    const novo = !p; p = p || {};
    const r = await modal({ titulo: novo ? 'Novo produto no portfólio' : 'Editar produto', corpo: campo('Descrição *', '<textarea name="descricao" rows="2" required>' + esc(p.descricao || '') + '</textarea>') + '<div class="linha">' + campo('Marca', '<input name="marca" value="' + esc(p.marca || '') + '">') + campo('Modelo', '<input name="modelo" value="' + esc(p.modelo || '') + '">') + campo('Código', '<input name="codigo" value="' + esc(p.codigo || '') + '">') + '</div><div class="linha">' + campo('Unidade', '<input name="unidade" value="' + esc(p.unidade || 'UN') + '">') + campo('Preço (R$)', '<input name="preco" inputmode="decimal" value="' + esc(p.preco != null ? String(p.preco).replace('.', ',') : '') + '">') + campo('Data do preço', '<input type="date" name="data" value="' + esc(p.data || new Date().toISOString().slice(0, 10)) + '">') + '</div>' });
    if (!r) return null;
    Object.assign(p, { descricao: r.get('descricao').trim(), marca: r.get('marca').trim(), modelo: r.get('modelo').trim(), codigo: r.get('codigo').trim(), unidade: r.get('unidade').trim().toUpperCase(), preco: Cotacoes.numeroBR(r.get('preco')), data: r.get('data') });
    if (novo) { p.id = Dados.id('prod'); p.origem = 'cadastro'; f.portfolio = f.portfolio || []; f.portfolio.push(p); }
    Dados.salvar(); return p;
  }
  async function importarPortfolio(f) {
    const arq = await UI.escolherArquivo('.xlsx,.xls,.csv', false); if (!arq) return;
    try {
      const t = await lerTabela(arq); const L = t.abas[Object.keys(t.abas)[0]];
      const h = L.findIndex(function (r) { return r.map(Cotacoes.normalizar).some(function (c) { return /descri|produto|item/.test(c); }); }); if (h < 0) return aviso('Não encontrei a coluna de descrição/produto.', 'erro');
      const cab = L[h].map(Cotacoes.normalizar); const col = function (re) { return cab.findIndex(function (c) { return re.test(c); }); };
      const c = { d: col(/descri|produto/), m: col(/marca|fabricante/), mo: col(/modelo|referencia/), u: col(/^(un|und|unid|unidade)/), p: col(/preco|valor/), cod: col(/codigo|cod|sku|ref/) };
      if (c.d < 0) c.d = col(/item/);
      let n = 0; f.portfolio = f.portfolio || []; const hoje = new Date().toISOString().slice(0, 10);
      L.slice(h + 1).forEach(function (r) { const d = String(r[c.d] || '').trim(); if (!d) return; f.portfolio.push({ id: Dados.id('prod'), descricao: d, marca: c.m >= 0 ? String(r[c.m] || '') : '', modelo: c.mo >= 0 ? String(r[c.mo] || '') : '', unidade: c.u >= 0 ? String(r[c.u] || '').toUpperCase() : '', preco: c.p >= 0 ? Cotacoes.numeroBR(r[c.p]) : null, codigo: c.cod >= 0 && c.cod !== c.mo ? String(r[c.cod] || '') : '', data: hoje, origem: 'planilha ' + arq.name }); n++; });
      Dados.salvar(); aviso(n + ' produto(s) importados.'); App.redesenhar();
    } catch (err) { aviso(err.message, 'erro'); }
  }

  // Grava preços respondidos numa cotação no portfólio do fornecedor.
  function registrarPrecos(fid, cot, resposta) {
    const f = achar(fid); if (!f) return; f.portfolio = f.portfolio || []; const hoje = new Date().toISOString().slice(0, 10);
    Object.keys(resposta.itens || {}).forEach(function (iid) {
      const r = resposta.itens[iid]; const it = (cot.itens || []).find(function (x) { return x.id === iid; }); if (!it || r.preco == null) return;
      const chave = Cotacoes.normalizar(it.descricao + ' ' + (r.marca || ''));
      let p = f.portfolio.find(function (x) { return Cotacoes.normalizar(x.descricao + ' ' + (x.marca || '')) === chave; });
      if (!p) { p = { id: Dados.id('prod'), descricao: it.descricao, unidade: it.unidade }; f.portfolio.push(p); }
      Object.assign(p, { marca: r.marca || p.marca || '', modelo: r.modelo || p.modelo || '', preco: r.preco, data: hoje, origem: 'cotação ' + cot.numero });
    });
  }

  Telas.fornecedores = {
    titulo: 'Seven Vendor',
    render: function (el, sub, param) { if (sub === 'ver') { if (est.fichaDe !== param) { est.aba = 'resumo'; est.fichaDe = param; } telaFicha(el, param); } else telaLista(el); },
    achar: achar, nome: nome, lista: lista, editar: editar, lerTabela: lerTabela, baixarPlanilha: baixarPlanilha, carregarXLSX: carregarXLSX, registrarPrecos: registrarPrecos, estrelas: estrelas
  };
})();
