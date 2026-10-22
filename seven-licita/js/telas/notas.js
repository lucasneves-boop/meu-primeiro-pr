/* Seven Nota (notas fiscais no estilo Bling): NF-e e NFS-e de saída, notas de entrada por XML, DANFE, retenções de órgão público e integração com Finanças. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, confirmar, aviso, moeda, cnpj, data } = UI;
  const N = Notas;
  const JSBARCODE = 'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js';
  const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
  const FRETE = [{ v: 9, t: 'Sem frete' }, { v: 0, t: 'Por conta do emitente (CIF)' }, { v: 1, t: 'Por conta do destinatário (FOB)' }, { v: 2, t: 'Por conta de terceiros' }];
  const PAGTO = ['Boleto bancário', 'Transferência / depósito', 'PIX', 'Ordem bancária (órgão público)', 'Dinheiro', 'Outros'];
  const est = { filtro: '', busca: '', mes: '' };

  function lista() { Dados.e.notas = Dados.e.notas || []; return Dados.e.notas; }
  function nota(id) { return lista().find(function (n) { return n.id === id; }); }
  function hoje() { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function num(v) { return v === '' || v == null ? null : Nucleo.lerNumeroBR(String(v)); }
  function fiscal(emp) { emp.fiscal = emp.fiscal || { regime: emp.porte === 'Demais' ? 'presumido' : 'simples', ie: '', im: '', serie: 1, proximoNumero: 1, aliqIcmsInterna: '', percTributos: '', dadosBancarios: '', logradouro: '', numero: '', bairro: '', cep: '', aliqIss: 5, codigoServico: '' }; return emp.fiscal; }
  function emitente(n) { const emp = Dados.empresa(n && n.empresaId) || Dados.empresaAtiva(); if (!emp) return null; const f = fiscal(emp); return Object.assign({ cnpj: emp.cnpj, nome: emp.razao, fantasia: emp.fantasia, uf: emp.uf, municipio: emp.municipio }, f); }
  function log(n, t) { n.historico = n.historico || []; n.historico.unshift({ em: new Date().toISOString(), t: t }); }
  function setCaminho(o, c, v) { const p = c.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) { if (x[p[i]] == null) x[p[i]] = /^\d+$/.test(p[i + 1]) ? [] : {}; x = x[p[i]]; } x[p[p.length - 1]] = v; }
  function getCaminho(o, c) { return c.split('.').reduce(function (x, k) { return x == null ? undefined : x[k]; }, o); }
  function rotSit(n) { return '<span class="tag nf-st-' + n.situacao + '">' + esc(N.SITUACOES[n.situacao] || n.situacao) + '</span>'; }
  function numero(n) { return n.numero ? String(n.numero).padStart(6, '0') + (n.serie ? '-' + n.serie : '') : '—'; }

  // ---------- criação ----------
  function nova(tipo, extra) {
    const emp = Dados.empresaAtiva(); if (!emp) { aviso('Cadastre o cliente emitente em Clientes (CNPJs) antes.', 'erro'); location.hash = '#/empresas'; return null; }
    const f = fiscal(emp);
    const n = Object.assign({ id: Dados.id('nf'), operacao: 'saida', tipo: tipo || 'produto', modelo: tipo === 'servico' ? 'NFS-e' : '55', situacao: 'rascunho', natureza: tipo === 'servico' ? 'Prestação de serviço' : 'Venda de mercadoria', finalidade: 'normal', emissao: hoje(), saida: hoje(), empresaId: emp.id,
      destinatario: { orgaoPublico: true, contribuinte: false, consumidorFinal: true, uf: emp.uf }, itens: [], frete: 0, seguro: 0, outras: 0, modalidadeFrete: 9, duplicatas: [], formaPagamento: 'Ordem bancária (órgão público)', contrato: {}, retencaoFederal: false, naturezaRetencao: tipo === 'servico' ? 'servicos' : 'bens', aliqIss: f.aliqIss, codigoServico: f.codigoServico, percTributos: f.percTributos, dadosBancarios: f.dadosBancarios, criadoEm: new Date().toISOString(), historico: [] }, extra || {});
    log(n, 'Nota criada.'); lista().unshift(n); Dados.salvar(); return n;
  }
  async function daProposta() {
    const ps = (Dados.e.propostas || []).filter(function (p) { return p.itens && p.itens.some(function (i) { return i.unitario; }); });
    if (!ps.length) return aviso('Nenhuma proposta com preços. Preencha os valores em Cadastrar.', 'erro');
    const r = await modal({ titulo: 'Nota a partir de proposta', botao: 'Criar nota', corpo: campo('Proposta', '<select name="p">' + opcoes(ps.map(function (p) { return { v: p.id, t: [p.numero, p.orgao, String(p.objeto || '').slice(0, 50)].filter(Boolean).join(' · ') }; })) + '</select>') + '<label class="check"><input type="checkbox" name="vencidos" checked> Só os itens marcados como vencidos (se houver)</label>' });
    if (!r) return; const p = ps.find(function (x) { return x.id === r.get('p'); }); const emp = Dados.empresa(p.empresaId) || Dados.empresaAtiva(); if (emp) Dados.e.empresaAtiva = emp.id;
    let its = p.itens.filter(function (i) { return i.participar !== false && i.unitario; }); if (r.get('vencidos') && its.some(function (i) { return i.vencido; })) its = its.filter(function (i) { return i.vencido; });
    const n = nova('produto', { propostaId: p.id, destinatario: { nome: p.orgao || '', documento: p.ref ? p.ref.cnpj : '', orgaoPublico: true, contribuinte: false, consumidorFinal: true, uf: '' }, contrato: { licitacao: [p.portal, p.numero].filter(Boolean).join(' ') } });
    if (!n) return; const e = emitente(n);
    n.itens = its.map(function (i) { return { codigo: String(i.numero), descricao: [i.descricao, i.marca && 'Marca: ' + i.marca, i.modelo && 'Modelo: ' + i.modelo].filter(Boolean).join(' · ').slice(0, 120), ncm: '', cfop: N.cfopSugerido({ ufOrigem: e.uf, ufDestino: e.uf }), unidade: i.unidade || 'UN', quantidade: i.quantidade, valorUnitario: i.unitario, desconto: 0, origem: '0' }; });
    log(n, 'Criada a partir da proposta ' + (p.numero || '') + '.'); Dados.salvar();
    if (n.destinatario.documento) buscarCNPJ(n, true);
    location.hash = '#/notas/editar/' + n.id;
  }
  async function buscarCNPJ(n, silencioso) {
    const c = String(n.destinatario.documento || '').replace(/\D/g, ''); if (c.length !== 14) { if (!silencioso) aviso('Digite os 14 números do CNPJ.', 'erro'); return; }
    try { const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + c); if (!r.ok) throw new Error(r.status === 404 ? 'CNPJ não encontrado.' : 'consulta indisponível (' + r.status + ')'); const d = await r.json();
      Object.assign(n.destinatario, { nome: d.razao_social, logradouro: [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' '), numero: d.numero, bairro: d.bairro, municipio: d.municipio, uf: d.uf, cep: d.cep, email: n.destinatario.email || (d.email || '').toLowerCase(), orgaoPublico: /^1/.test(String(d.codigo_natureza_juridica || '')) || n.destinatario.orgaoPublico });
      Dados.salvar(); if (!silencioso) aviso('Dados da Receita preenchidos.'); App.redesenhar();
    } catch (err) { if (!silencioso) aviso(err.message, 'erro'); }
  }

  // ---------- XML (entrada e saídas emitidas fora) ----------
  async function importarXML() {
    const fs = await UI.escolherArquivo('.xml', true); if (!fs || !fs.length) return; let ok = 0, rep = 0, erro = 0; const empresas = Dados.e.empresas || [];
    for (const f of fs) {
      try {
        const txt = await f.text(); const x = N.lerXML(txt);
        if (x.chave && lista().some(function (n) { return n.chave === x.chave; })) { const ex = lista().find(function (n) { return n.chave === x.chave; }); if (ex.situacao !== 'autorizada' && x.autorizada) { aplicarAutorizacao(ex, x); ok++; } else rep++; continue; }
        const minhaEmit = empresas.find(function (e) { return e.cnpj === x.emitente.cnpj; }); const minhaDest = empresas.find(function (e) { return e.cnpj === x.destinatario.documento; });
        const xid = 'nfx-' + Dados.id(); await Dados.guardarArquivo(xid, new Blob([txt], { type: 'application/xml' }));
        const n = { id: Dados.id('nf'), operacao: minhaEmit ? 'saida' : 'entrada', tipo: 'produto', modelo: x.modelo, situacao: x.autorizada ? 'autorizada' : 'rascunho', natureza: x.natureza, finalidade: 'normal', emissao: x.emissao.slice(0, 10), numero: x.numero, serie: x.serie, chave: x.chave, protocolo: x.protocolo, autorizadaEm: x.autorizadaEm, xmlId: xid,
          empresaId: (minhaEmit || minhaDest || Dados.empresaAtiva() || {}).id, emitenteExterno: minhaEmit ? null : x.emitente,
          destinatario: { nome: x.destinatario.nome, documento: x.destinatario.documento, ie: x.destinatario.ie, contribuinte: x.destinatario.indIEDest === '1', logradouro: x.destinatario.logradouro, numero: x.destinatario.numero, bairro: x.destinatario.bairro, municipio: x.destinatario.municipio, uf: x.destinatario.uf, cep: x.destinatario.cep, email: x.destinatario.email },
          itens: x.itens.map(function (i) { return { codigo: i.codigo, descricao: i.descricao, ncm: i.ncm, cfop: i.cfop, cst: i.cst, origem: i.origem, unidade: i.unidade, quantidade: i.quantidade, valorUnitario: i.valorUnitario, desconto: i.desconto, aliqIcms: i.aliqIcms, aliqIpi: i.aliqIpi }; }),
          frete: x.totais.frete, seguro: x.totais.seguro, outras: x.totais.outras, modalidadeFrete: Number(x.transporte.modalidade || 9), transportadora: x.transporte.transportadora, duplicatas: x.duplicatas, infCpl: x.infCpl, totaisXML: x.totais, totalNota: x.totais.total, contrato: {}, criadoEm: new Date().toISOString(), historico: [] };
        log(n, 'Importada do XML ' + f.name + (x.autorizada ? ' (autorizada, protocolo ' + x.protocolo + ')' : ' (sem protocolo de autorização)') + '.');
        if (n.operacao === 'entrada') vincularFornecedor(n, x);
        lista().unshift(n); ok++;
      } catch (err) { erro++; aviso(f.name + ': ' + err.message, 'erro'); }
    }
    Dados.salvar(); aviso(ok + ' nota(s) importada(s)' + (rep ? ', ' + rep + ' já existiam' : '') + (erro ? ', ' + erro + ' com erro' : '') + '.'); App.redesenhar();
  }
  function vincularFornecedor(n, x) {
    Dados.e.fornecedores = Dados.e.fornecedores || []; let f = Dados.e.fornecedores.find(function (y) { return y.cnpj === x.emitente.cnpj; });
    if (!f) { f = { id: Dados.id('forn'), razao: x.emitente.nome, fantasia: x.emitente.fantasia, cnpj: x.emitente.cnpj, cidade: x.emitente.municipio, uf: x.emitente.uf, telefone: x.emitente.fone, status: 'ativo', categorias: [], marcas: [], portfolio: [], historico: [], documentos: [], criadoEm: new Date().toISOString() }; Dados.e.fornecedores.push(f); }
    n.fornecedorId = f.id; f.historico = f.historico || []; f.historico.push({ id: Dados.id('h'), tipo: 'nota', texto: 'NF-e ' + x.numero + ' recebida · ' + moeda(x.totais.total), em: new Date().toISOString() });
    x.itens.forEach(function (i) { const k = Cotacoes.normalizar(i.descricao); let p = f.portfolio.find(function (y) { return Cotacoes.normalizar(y.descricao) === k; }); if (!p) { p = { id: Dados.id('prod'), descricao: i.descricao, unidade: i.unidade }; f.portfolio.push(p); } Object.assign(p, { codigo: i.codigo, preco: i.valorUnitario, data: x.emissao.slice(0, 10), origem: 'NF-e ' + x.numero }); });
  }
  function aplicarAutorizacao(n, x) { Object.assign(n, { situacao: 'autorizada', chave: x.chave, protocolo: x.protocolo, autorizadaEm: x.autorizadaEm, numero: x.numero, serie: x.serie }); log(n, 'Autorização registrada pelo XML (protocolo ' + x.protocolo + ').'); }

  // ---------- lista ----------
  function telaLista(el, operacao) {
    const emp = Dados.empresaAtiva(); const L = lista().filter(function (n) { return n.operacao === operacao && (!emp || !n.empresaId || n.empresaId === emp.id); });
    const mes = est.mes || hoje().slice(0, 7); const q = Cotacoes.normalizar(est.busca);
    const vis = L.filter(function (n) { if (est.filtro && n.situacao !== est.filtro) return false; if (est.mes && String(n.emissao).slice(0, 7) !== est.mes) return false; if (q && Cotacoes.normalizar([n.numero, n.chave, n.destinatario.nome, n.emitenteExterno && n.emitenteExterno.nome, n.natureza, (n.contrato || {}).empenho].join(' ')).indexOf(q) < 0) return false; return true; });
    const doMes = L.filter(function (n) { return n.situacao === 'autorizada' && String(n.emissao).slice(0, 7) === mes; });
    const fat12 = N.faturamento12m(L, hoje()); const regime = emp ? fiscal(emp).regime : 'simples';
    const kpis = operacao === 'saida' ? '<div class="kpis pequenos"><div><span>Faturado em ' + mes.slice(5) + '/' + mes.slice(0, 4) + '</span><b>' + moeda(doMes.reduce(function (s, n) { return s + (n.totalNota || 0); }, 0)) + '</b><small class="mudo">' + doMes.length + ' nota(s) autorizada(s)</small></div><div><span>A emitir</span><b>' + L.filter(function (n) { return n.situacao === 'rascunho' || n.situacao === 'pronta'; }).length + '</b></div><div><span>A receber (lançado)</span><b>' + moeda(L.filter(function (n) { return n.situacao === 'autorizada' && n.lancadoFinanceiro; }).reduce(function (s, n) { return s + (n.liquido || n.totalNota || 0); }, 0)) + '</b></div><div><span>Faturamento 12 meses</span><b>' + moeda(fat12) + '</b>' + (regime === 'simples' ? '<div class="barra"><i style="width:' + Math.min(100, fat12 / 4.8e6 * 100) + '%"></i></div><small class="mudo">' + (Math.round(fat12 / 4.8e6 * 1000) / 10).toString().replace('.', ',') + '% do teto do Simples (R$ 4,8 mi)</small>' : '') + '</div></div>'
      : '<div class="kpis pequenos"><div><span>Compras em ' + mes.slice(5) + '/' + mes.slice(0, 4) + '</span><b>' + moeda(L.filter(function (n) { return String(n.emissao).slice(0, 7) === mes; }).reduce(function (s, n) { return s + (n.totalNota || 0); }, 0)) + '</b></div><div><span>Notas recebidas</span><b>' + L.length + '</b></div><div><span>A pagar (lançado)</span><b>' + moeda(L.filter(function (n) { return n.lancadoFinanceiro; }).reduce(function (s, n) { return s + (n.totalNota || 0); }, 0)) + '</b></div></div>';
    const meses = []; for (let i = 0; i < 12; i++) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); meses.push(d.toISOString().slice(0, 7)); }
    el.innerHTML = abas(operacao) + kpis +
      '<div class="barra-acoes"><div class="filtros" style="margin:0;flex:1"><input type="search" id="nf-busca" placeholder="Buscar nº, chave, ' + (operacao === 'saida' ? 'destinatário' : 'fornecedor') + ', empenho" value="' + esc(est.busca) + '"><select id="nf-mes"><option value="">Todos os meses</option>' + opcoes(meses.map(function (m) { return { v: m, t: m.slice(5) + '/' + m.slice(0, 4) }; }), est.mes) + '</select>' + (operacao === 'saida' ? '<div class="pilulas" style="margin:0">' + [['', 'Todas'], ['rascunho', 'Rascunho'], ['pronta', 'Prontas'], ['autorizada', 'Autorizadas'], ['cancelada', 'Canceladas']].map(function (x) { return '<button class="pilula ' + (est.filtro === x[0] ? 'ativa' : '') + '" data-filtro="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' : '') + '</div>' +
      '<div class="grupo-botoes"><button class="btn" data-a="xml">Importar XML</button>' + (operacao === 'saida' ? '<button class="btn" data-a="proposta">Da proposta</button><button class="btn" data-a="nfse">+ NFS-e (serviço)</button><button class="btn primario" data-a="nfe">+ NF-e</button>' : '') + '</div></div>' +
      (vis.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Número</th><th>Emissão</th><th>' + (operacao === 'saida' ? 'Destinatário' : 'Fornecedor') + '</th><th>Natureza</th><th class="n">Valor</th><th>Situação</th><th></th></tr></thead><tbody>' + vis.map(function (n) { const c = n.situacao === 'rascunho' || n.situacao === 'pronta' ? calcularNota(n) : null; return '<tr class="clicavel" data-abrir="' + n.id + '"><td><b>' + numero(n) + '</b><br><small class="mudo">' + esc(n.modelo === 'NFS-e' ? 'NFS-e' : 'NF-e') + '</small></td><td>' + data(n.emissao) + '</td><td>' + esc(operacao === 'saida' ? n.destinatario.nome || '—' : (n.emitenteExterno || {}).nome || '—') + (n.contrato && n.contrato.empenho ? '<br><small class="mudo">Empenho ' + esc(n.contrato.empenho) + '</small>' : '') + '</td><td>' + esc(n.natureza || '') + '</td><td class="n">' + moeda(c ? c.totais.total : n.totalNota || 0) + '</td><td>' + rotSit(n) + (n.lancadoFinanceiro ? ' <span class="tag claro mini">no financeiro</span>' : '') + '</td><td class="acoes"><button class="btn mini" data-danfe="' + n.id + '">' + (n.situacao === 'autorizada' ? 'DANFE' : 'Espelho') + '</button></td></tr>'; }).join('') + '</tbody></table></div>'
        : UI.vazio(L.length ? 'Nada com esses filtros' : (operacao === 'saida' ? 'Nenhuma nota de saída' : 'Nenhuma nota de entrada'), operacao === 'saida' ? 'Crie a NF-e de uma venda (pode vir direto de uma proposta vencida) ou importe os XML das notas já emitidas no seu emissor.' : 'Importe os XML das notas de compra recebidas dos fornecedores: o fornecedor e os preços entram no cadastro e as duplicatas podem ir para o contas a pagar.', operacao === 'saida' ? '<button class="btn primario" data-a="nfe">+ NF-e</button>' : '<button class="btn primario" data-a="xml">Importar XML</button>'));
    const b = el.querySelector('#nf-busca'); b.oninput = function () { est.busca = b.value; clearTimeout(b._t); b._t = setTimeout(function () { App.redesenhar(); const i = document.getElementById('nf-busca'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
    el.querySelector('#nf-mes').onchange = function () { est.mes = this.value; App.redesenhar(); };
    el.onclick = function (ev) {
      const fl = ev.target.closest('[data-filtro]'); if (fl) { est.filtro = fl.dataset.filtro; App.redesenhar(); return; }
      const dn = ev.target.closest('[data-danfe]'); if (dn) { location.hash = '#/notas/ver/' + dn.dataset.danfe; return; }
      const a = ev.target.closest('[data-a]'); if (a) { const k = a.dataset.a; if (k === 'nfe' || k === 'nfse') { const n = nova(k === 'nfse' ? 'servico' : 'produto'); if (n) location.hash = '#/notas/editar/' + n.id; } if (k === 'proposta') daProposta(); if (k === 'xml') importarXML(); return; }
      const r = ev.target.closest('[data-abrir]'); if (r) { const n = nota(r.dataset.abrir); location.hash = '#/notas/' + (n.situacao === 'rascunho' || n.situacao === 'pronta' ? 'editar/' : 'ver/') + n.id; }
    };
  }
  function abas(ativa) { return UI.abas([{ id: 'saida', t: 'Notas de saída' }, { id: 'entrada', t: 'Notas de entrada' }, { id: 'relatorios', t: 'Relatórios' }, { id: 'config', t: 'Configurações fiscais' }, { id: 'aprender', t: '📘 Aprender' }], ativa, 'notas'); }

  function calcularNota(n) { return N.calcular(n, emitente(n) || {}); }

  // ---------- editor ----------
  function inp(caminho, n, attrs) { const v = getCaminho(n, caminho); return '<input data-k="' + caminho + '" value="' + esc(v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : v) + '"' + (attrs || '') + '>'; }
  function chk(caminho, n, rot) { return '<label class="check"><input type="checkbox" data-k="' + caminho + '"' + (getCaminho(n, caminho) ? ' checked' : '') + '> ' + rot + '</label>'; }
  function sel(caminho, n, ops) { return '<select data-k="' + caminho + '">' + opcoes(ops, getCaminho(n, caminho)) + '</select>'; }
  const NUMERICOS = /(quantidade|valorUnitario|desconto|aliqIcms|aliqIpi|aliqIss|frete|seguro|outras|percTributos|aliqInternaDestino|valor|volumes|peso)$/;

  function telaEditor(el, id) {
    const n = nota(id); if (!n) { el.innerHTML = UI.vazio('Nota não encontrada', '<a href="#/notas/saida">Voltar</a>'); return; }
    const e = emitente(n); const serv = n.tipo === 'servico'; const simples = e && e.regime === 'simples';
    const d = n.destinatario;
    el.innerHTML = '<p class="migalhas"><a href="#/notas/saida">Seven Nota</a> › ' + (serv ? 'NFS-e' : 'NF-e') + ' ' + rotSit(n) + '</p>' +
      '<div class="nf-ed"><div class="nf-col">' +
      '<section class="cartao"><h3>' + (serv ? 'Nota de serviço (NFS-e)' : 'Nota fiscal eletrônica (NF-e)') + '</h3><div class="linha">' + campo('Natureza da operação', '<input data-k="natureza" list="nf-naturezas" value="' + esc(n.natureza) + '"><datalist id="nf-naturezas">' + N.NATUREZAS.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>') + (serv ? '' : campo('Finalidade', sel('finalidade', n, [{ v: 'normal', t: 'Normal' }, { v: 'complementar', t: 'Complementar' }, { v: 'ajuste', t: 'Ajuste' }, { v: 'devolucao', t: 'Devolução' }]))) + campo('Emissão', '<input type="date" data-k="emissao" value="' + esc(n.emissao) + '">') + (serv ? '' : campo('Saída', '<input type="date" data-k="saida" value="' + esc(n.saida || '') + '">')) + '</div>' +
      '<p class="mini mudo">Emitente: <b>' + esc(e ? e.nome : 'cadastre em Clientes') + '</b>' + (e ? ' · CNPJ ' + esc(cnpj(e.cnpj)) + ' · ' + esc((e.municipio || '') + '-' + (e.uf || '')) + ' · ' + { simples: 'Simples Nacional', presumido: 'Lucro Presumido', real: 'Lucro Real' }[e.regime] : '') + ' · <a href="#/notas/config">ajustar</a></p></section>' +
      '<section class="cartao"><h3>Destinatário</h3><div class="linha">' + campo('CNPJ / CPF', inp('destinatario.documento', n, ' inputmode="numeric"')) + '<button type="button" class="btn" data-nf="cnpj" style="align-self:end;margin-bottom:12px">Buscar na Receita</button>' + campo('Nome / razão social', inp('destinatario.nome', n)) + '</div>' +
      '<div class="linha">' + campo('Logradouro', inp('destinatario.logradouro', n)) + campo('Número', inp('destinatario.numero', n, ' size="6"')) + campo('Bairro', inp('destinatario.bairro', n)) + '</div><div class="linha">' + campo('Município', inp('destinatario.municipio', n)) + campo('UF', sel('destinatario.uf', n, [''].concat(UFS))) + campo('CEP', inp('destinatario.cep', n)) + campo('E-mail (envio da nota)', inp('destinatario.email', n)) + '</div>' +
      '<div class="nf-checks">' + chk('destinatario.orgaoPublico', n, 'Órgão público') + chk('destinatario.contribuinte', n, 'Contribuinte de ICMS') + (d.contribuinte ? campo('IE', inp('destinatario.ie', n)) : '') + (!simples && !serv && d.uf && e && d.uf !== e.uf && !d.contribuinte ? campo('Alíq. interna ICMS da UF destino (%) p/ DIFAL', inp('destinatario.aliqInternaDestino', n, ' size="5"')) : '') + '</div></section>' +
      '<section class="cartao"><header><h3>' + (serv ? 'Serviços' : 'Produtos') + '</h3><div class="grupo-botoes">' + (serv ? '' : '<button type="button" class="btn mini" data-nf="cfop">Aplicar CFOP sugerido</button>') + '<button type="button" class="btn mini" data-nf="item">+ Item</button></div></header>' +
      (n.itens.length ? '<div class="tabela-rolagem"><table class="tabela nf-itens"><thead><tr><th>Descrição</th>' + (serv ? '' : '<th>NCM</th><th>CFOP</th><th>' + (simples ? 'CSOSN' : 'CST') + '</th>') + '<th>Un.</th><th class="n">Qtd.</th><th class="n">Valor unit.</th><th class="n">Desc. R$</th>' + (serv ? '' : (simples ? '' : '<th class="n">ICMS %</th>') + '<th class="n">IPI %</th>') + '<th class="n">Total</th><th></th></tr></thead><tbody>' + n.itens.map(function (it, i) { const p = 'itens.' + i + '.'; return '<tr><td><textarea data-k="' + p + 'descricao" rows="2">' + esc(it.descricao || '') + '</textarea></td>' + (serv ? '' : '<td>' + inp(p + 'ncm', n, ' size="9" inputmode="numeric" placeholder="8 dígitos"') + '</td><td>' + inp(p + 'cfop', n, ' size="5" inputmode="numeric"') + '</td><td>' + inp(p + 'cst', n, ' size="4" placeholder="' + (simples ? '102' : '00') + '"') + '</td>') + '<td>' + inp(p + 'unidade', n, ' size="4"') + '</td><td class="n">' + inp(p + 'quantidade', n, ' size="7" inputmode="decimal"') + '</td><td class="n">' + inp(p + 'valorUnitario', n, ' size="9" inputmode="decimal"') + '</td><td class="n">' + inp(p + 'desconto', n, ' size="7" inputmode="decimal"') + '</td>' + (serv ? '' : (simples ? '' : '<td class="n">' + inp(p + 'aliqIcms', n, ' size="4" inputmode="decimal" placeholder="auto"') + '</td>') + '<td class="n">' + inp(p + 'aliqIpi', n, ' size="4" inputmode="decimal"') + '</td>') + '<td class="n" data-tot-item="' + i + '"></td><td><button type="button" class="icone" data-del-item="' + i + '" aria-label="Remover item">×</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="mudo">Nenhum item. Use "+ Item" ou crie a nota a partir de uma proposta.</p>') +
      (serv ? '<div class="linha">' + campo('Código do serviço (LC 116/2003)', inp('codigoServico', n, ' placeholder="ex.: 7.10"')) + campo('Alíquota ISS (%)', inp('aliqIss', n, ' size="5"')) + '</div><div class="nf-checks">' + chk('issRetido', n, 'ISS retido pelo tomador') + chk('inssRetido', n, 'INSS retido (cessão de mão de obra, 11%)') + '</div>' : '') + '</section>' +
      '<section class="cartao"><h3>Valores adicionais e transporte</h3><div class="linha">' + (serv ? '' : campo('Frete (R$)', inp('frete', n)) + campo('Seguro (R$)', inp('seguro', n))) + campo('Outras despesas (R$)', inp('outras', n)) + campo('Tributos aproximados % (Lei 12.741)', inp('percTributos', n, ' size="5"')) + '</div>' + (serv ? '' : '<div class="linha">' + campo('Modalidade do frete', sel('modalidadeFrete', n, FRETE)) + campo('Transportadora', inp('transportadora', n)) + campo('Volumes', inp('volumes', n, ' size="5"')) + campo('Peso bruto (kg)', inp('peso', n, ' size="7"')) + '</div>') + '</section>' +
      '<section class="cartao"><h3>Contrato / empenho</h3><div class="linha">' + campo('Nota de empenho', inp('contrato.empenho', n, ' placeholder="ex.: 2026NE000123"')) + campo('Processo', inp('contrato.processo', n)) + campo('Licitação', inp('contrato.licitacao', n, ' placeholder="ex.: Pregão eletrônico 90021/2026"')) + campo('Contrato / ATA', inp('contrato.contrato', n)) + '</div>' +
      '<div class="nf-checks">' + chk('retencaoFederal', n, 'Destinatário retém tributos federais (IN RFB 1.234/2012)') + (n.retencaoFederal ? sel('naturezaRetencao', n, [{ v: 'bens', t: 'Fornecimento de bens (5,85%)' }, { v: 'servicos', t: 'Serviços em geral (9,45%)' }, { v: 'combustiveis', t: 'Combustíveis (4,89%)' }]) : '') + '</div></section>' +
      '<section class="cartao"><header><h3>Pagamento</h3></header><div class="linha">' + campo('Forma', sel('formaPagamento', n, PAGTO)) + campo('Parcelas', '<input id="nf-np" type="number" min="1" max="48" value="' + Math.max(1, (n.duplicatas || []).length) + '" size="3">') + campo('1º vencimento', '<input id="nf-pv" type="date" value="' + esc((n.duplicatas[0] || {}).vencimento || somarDias(n.emissao, 30)) + '">') + campo('Intervalo (dias)', '<input id="nf-pi" type="number" value="30" size="3">') + '<button type="button" class="btn" data-nf="parcelas" style="align-self:end;margin-bottom:12px">Gerar duplicatas</button></div>' +
      ((n.duplicatas || []).length ? '<table class="tabela"><thead><tr><th>Nº</th><th>Vencimento</th><th class="n">Valor</th></tr></thead><tbody>' + n.duplicatas.map(function (x, i) { return '<tr><td>' + esc(x.numero) + '</td><td><input type="date" data-k="duplicatas.' + i + '.vencimento" value="' + esc(x.vencimento) + '"></td><td class="n">' + inp('duplicatas.' + i + '.valor', n, ' size="10"') + '</td></tr>'; }).join('') + '</tbody></table>' : '') + campo('Dados bancários para pagamento', inp('dadosBancarios', n, ' placeholder="Banco, agência, conta, PIX"')) + '</section>' +
      '<section class="cartao"><h3>Informações complementares</h3><p class="mini mudo">Geradas automaticamente:</p><p class="nf-inf" id="nf-inf"></p>' + campo('Texto adicional', '<textarea data-k="obsAdicional" rows="2">' + esc(n.obsAdicional || '') + '</textarea>') + '</section>' +
      '</div><aside class="nf-lado"><section class="cartao nf-totais" id="nf-totais"></section><section class="cartao" id="nf-valid"></section>' +
      '<section class="cartao nf-acoes"><button class="btn primario" data-nf="pronta">Marcar como pronta</button><button class="btn" data-nf="espelho">Espelho (conferência)</button><button class="btn" data-nf="emissor">Enviar ao emissor (JSON)</button><button class="btn" data-nf="autorizar">Registrar autorização</button><button class="btn" data-nf="duplicar">Duplicar</button><button class="btn perigo" data-nf="excluir">Excluir rascunho</button><p class="mini mudo">Nota com valor fiscal precisa ser transmitida à SEFAZ (ou à prefeitura, na NFS-e) com certificado digital A1, por um emissor (Focus NFe, NFE.io, Bling, emissor da SEFAZ). Depois, importe o XML autorizado ou registre chave e protocolo aqui.</p></section></aside></div>';
    atualizarResumo(el, n);
    el.oninput = el.onchange = function (ev) {
      const t = ev.target; const k = t.dataset.k; if (!k) return;
      let v = t.type === 'checkbox' ? t.checked : t.value; if (NUMERICOS.test(k) && t.type !== 'date' && t.type !== 'checkbox') v = num(v);
      if (k === 'destinatario.documento') v = String(v).replace(/\D/g, '');
      setCaminho(n, k, v); if (n.situacao === 'pronta') { n.situacao = 'rascunho'; } Dados.salvar();
      if (ev.type === 'change' && (t.type === 'checkbox' || t.tagName === 'SELECT' && /uf|naturezaRetencao|modalidadeFrete/.test(k))) { App.redesenhar(); return; }
      atualizarResumo(el, n);
    };
    el.onclick = async function (ev) {
      const di = ev.target.closest('[data-del-item]'); if (di) { n.itens.splice(Number(di.dataset.delItem), 1); Dados.salvar(); App.redesenhar(); return; }
      const b = ev.target.closest('[data-nf]'); if (!b) return; const a = b.dataset.nf;
      if (a === 'cnpj') buscarCNPJ(n);
      if (a === 'item') { n.itens.push({ descricao: '', ncm: '', cfop: serv ? '' : N.cfopSugerido({ ufOrigem: e && e.uf, ufDestino: d.uf || (e && e.uf), contribuinte: d.contribuinte }), unidade: serv ? 'SV' : 'UN', quantidade: 1, valorUnitario: null, desconto: 0, origem: '0' }); Dados.salvar(); App.redesenhar(); }
      if (a === 'cfop') { const c = N.cfopSugerido({ ufOrigem: e.uf, ufDestino: d.uf || e.uf, contribuinte: d.contribuinte, finalidade: n.finalidade, producaoPropria: /produ[çc][ãa]o/i.test(n.natureza) }); n.itens.forEach(function (it) { it.cfop = c; }); Dados.salvar(); aviso('CFOP ' + c + ' aplicado a todos os itens.'); App.redesenhar(); }
      if (a === 'parcelas') { const tot = calcularNota(n).totais; n.duplicatas = N.parcelas(tot.liquido, el.querySelector('#nf-np').value, el.querySelector('#nf-pv').value, el.querySelector('#nf-pi').value); Dados.salvar(); App.redesenhar(); }
      if (a === 'pronta') { const er = N.validar(n, e).filter(function (x) { return x.nivel === 'erro'; }); if (er.length) return aviso('Corrija ' + er.length + ' erro(s) antes.', 'erro'); n.situacao = 'pronta'; log(n, 'Marcada como pronta para emitir.'); Dados.salvar(); App.redesenhar(); }
      if (a === 'espelho') location.hash = '#/notas/ver/' + n.id;
      if (a === 'emissor') exportarEmissor(n, e);
      if (a === 'autorizar') registrarAutorizacao(n, e);
      if (a === 'duplicar') { const c = JSON.parse(JSON.stringify(n)); Object.assign(c, { id: Dados.id('nf'), situacao: 'rascunho', numero: null, chave: null, protocolo: null, autorizadaEm: null, lancadoFinanceiro: false, emissao: hoje(), saida: hoje(), historico: [], cce: [], cancelamento: null, xmlId: null }); log(c, 'Duplicada da nota ' + numero(n) + '.'); lista().unshift(c); Dados.salvar(); location.hash = '#/notas/editar/' + c.id; }
      if (a === 'excluir' && await confirmar('Excluir rascunho', 'Excluir esta nota em rascunho?', 'Excluir')) { Dados.e.notas = lista().filter(function (x) { return x !== n; }); Dados.salvar(); location.hash = '#/notas/saida'; }
    };
    guiar(el, n);
  }
  // ---------- emissor guiado (etapas no estilo do emissor do Sebrae) e explicações de cada campo ----------
  const G = self.NFGuia;
  const SECOES = ['dados', 'destinatario', 'itens', 'transporte', 'contrato', 'pagamento', 'complementar'];
  const COLUNAS = { 'Descrição': 'itens.descricao', NCM: 'itens.ncm', CFOP: 'itens.cfop', CST: 'itens.cst', CSOSN: 'itens.cst', 'Un.': 'itens.unidade', 'Qtd.': 'itens.quantidade', 'Valor unit.': 'itens.valorUnitario', 'Desc. R$': 'itens.desconto', 'ICMS %': 'itens.aliqIcms', 'IPI %': 'itens.aliqIpi' };
  const guia = { etapa: {}, ajuda: null };
  function guiado() { const c = Dados.e.nfCfgGuia = Dados.e.nfCfgGuia || { guiado: true }; return c.guiado !== false; }
  function botaoAjuda(k, rot) { return '<button type="button" class="nf-q" data-ajuda="' + esc(k) + '" aria-label="O que é ' + esc(rot || k) + '?" title="O que é isto?">?</button>'; }
  function guiar(el, n) {
    if (!G) return;
    const serv = n.tipo === 'servico';
    const etapas = G.ETAPAS;
    // "?" em cada campo
    el.querySelectorAll('.nf-col [data-k]').forEach(function (inp) {
      const k = G.chave(inp.dataset.k); if (!G.verbete(k)) return;
      const lab = inp.closest('label.campo'); const chk = inp.closest('label.check');
      if (lab && !lab.querySelector('.nf-q')) { const sp = lab.querySelector(':scope > span'); if (sp) sp.insertAdjacentHTML('beforeend', botaoAjuda(k, sp.textContent)); }
      else if (chk && !chk.querySelector('.nf-q')) chk.insertAdjacentHTML('beforeend', botaoAjuda(k, chk.textContent));
      else if (!lab && !chk && inp.closest('td') === null && !inp.parentNode.querySelector('.nf-q')) inp.insertAdjacentHTML('afterend', botaoAjuda(k));
    });
    el.querySelectorAll('.nf-itens thead th').forEach(function (th) { const k = COLUNAS[th.textContent.trim()]; if (k && !th.querySelector('.nf-q')) th.insertAdjacentHTML('beforeend', ' ' + botaoAjuda(k, th.textContent)); });
    // etapas
    const secs = el.querySelectorAll('.nf-col > section.cartao'); secs.forEach(function (sc, i) { sc.dataset.etapa = SECOES[i] || 'complementar'; });
    const atual = guia.etapa[n.id] || 'dados'; const i = etapas.findIndex(function (x) { return x.id === atual; }); const et = etapas[i] || etapas[0];
    const v = N.validar(n, emitente(n) || {}); const pend = function (id) { return v.filter(function (x) { return x.nivel === 'erro' && etapaDoErro(x.msg) === id; }).length; };
    const barra = '<nav class="nf-passos" aria-label="Etapas da nota">' + etapas.map(function (x, k) { return '<button type="button" class="nf-passo' + (x.id === et.id ? ' on' : '') + (k < i ? ' feito' : '') + '" data-etapa="' + x.id + '"><span class="nf-passo-n">' + (k + 1) + '</span><span class="nf-passo-t">' + esc(x.t) + (pend(x.id) ? ' <b class="nf-pend" title="Pendências nesta etapa">' + pend(x.id) + '</b>' : '') + '</span></button>'; }).join('') + '</nav>' +
      '<div class="nf-modo"><label class="check-inline"><input type="checkbox" id="nf-guiado"' + (guiado() ? ' checked' : '') + '> Emissor guiado (uma etapa por vez, com explicações)</label><a href="#/notas/aprender" class="mini">📘 Aprender: glossário e fontes oficiais</a></div>';
    const intro = '<section class="cartao nf-intro" data-etapa-intro><div class="nf-intro-n">Etapa ' + (i + 1) + ' de ' + etapas.length + '</div><h3>' + esc(et.t) + '</h3><p class="nf-intro-r">' + esc(et.resumo) + '</p><p class="nf-feynman"><b>Explicando simples:</b> ' + esc(et.feynman) + '</p>' +
      (et.id === 'emitir' ? fluxoEmissao() : '<details><summary>O que cada campo desta etapa significa</summary><ul class="nf-glos">' + et.campos.map(function (c) { const x = G.verbete(c); return x ? '<li><button type="button" class="link-btn" data-ajuda="' + esc(x.id) + '">' + esc(x.t) + '</button>: ' + esc(x.o) + '</li>' : ''; }).join('') + '</ul></details>') +
      '<div class="nf-nav">' + (i > 0 ? '<button type="button" class="btn" data-etapa="' + etapas[i - 1].id + '">← ' + esc(etapas[i - 1].t) + '</button>' : '<span></span>') + (i < etapas.length - 1 ? '<button type="button" class="btn primario" data-etapa="' + etapas[i + 1].id + '">' + esc(etapas[i + 1].t) + ' →</button>' : '') + '</div></section>';
    const col = el.querySelector('.nf-col'); col.insertAdjacentHTML('afterbegin', intro); el.querySelector('.nf-ed').insertAdjacentHTML('beforebegin', barra);
    if (guiado()) { el.querySelector('.nf-ed').classList.add('guiado'); secs.forEach(function (sc) { sc.hidden = sc.dataset.etapa !== et.id; }); if (et.id === 'emitir') el.querySelector('.nf-lado').classList.add('destaque'); }
    else el.querySelector('[data-etapa-intro]').hidden = true;
    if (guia.ajuda) abrirAjuda(guia.ajuda);
    const original = el.onclick;
    el.onclick = function (ev) {
      const q = ev.target.closest('[data-ajuda]'); if (q) { ev.preventDefault(); abrirAjuda(q.dataset.ajuda, n); return; }
      const pa = ev.target.closest('[data-etapa]'); if (pa && pa.tagName === 'BUTTON') { guia.etapa[n.id] = pa.dataset.etapa; if (!guiado()) { Dados.e.nfCfgGuia.guiado = true; } App.redesenhar(); window.scrollTo(0, 0); return; }
      if (ev.target.closest('[data-fechar-ajuda]')) { guia.ajuda = null; const a = document.getElementById('nf-ajuda'); if (a) a.remove(); document.body.classList.remove('com-ajuda-nf'); return; }
      return original && original.call(this, ev);
    };
    el.querySelector('#nf-guiado').onchange = function () { Dados.e.nfCfgGuia.guiado = this.checked; Dados.salvar(); App.redesenhar(); };
  }
  // Em que etapa cada mensagem da validação aparece (para o número de pendências na barra).
  function etapaDoErro(msg) { const m = String(msg).toLowerCase(); if (/destinat|cnpj|cpf|uf|inscri|ie\b/.test(m)) return 'destinatario'; if (/item|ncm|cfop|cst|csosn|quantidade|valor unit|servi[çc]o/.test(m)) return 'itens'; if (/emitente|certificado/.test(m)) return 'emitir'; if (/natureza|emiss/.test(m)) return 'dados'; if (/parcela|duplicata|pagamento/.test(m)) return 'pagamento'; if (/empenho|contrato/.test(m)) return 'contrato'; return 'emitir'; }
  function fluxoEmissao() {
    const passos = [['1', 'Conferir', 'Veja os erros e avisos ao lado e o espelho da nota.'], ['2', 'Assinar', 'O emissor assina o arquivo XML com o certificado digital (A1 ou A3) da empresa.'], ['3', 'Transmitir', 'O XML vai para a SEFAZ do seu estado (NF-e) ou para a prefeitura/Emissor Nacional (NFS-e).'], ['4', 'Autorização', 'A SEFAZ devolve o protocolo. Só agora a nota vale.'], ['5', 'DANFE e XML', 'Imprima o DANFE para acompanhar a carga e envie o XML ao comprador.'], ['6', 'Depois', 'Errou algo simples? Carta de correção. Mercadoria não saiu? Cancelamento no prazo.']];
    return '<ol class="nf-fluxo">' + passos.map(function (p) { return '<li><span>' + p[0] + '</span><b>' + p[1] + '</b><small>' + p[2] + '</small></li>'; }).join('') + '</ol><p class="mini mudo">Este sistema prepara e confere a nota. A assinatura e a transmissão são feitas por um emissor autorizado (por exemplo, o emissor gratuito do Sebrae, para NF-e, ou o Emissor Nacional, para NFS-e) com o certificado da empresa: use "Enviar ao emissor (JSON)" e depois "Registrar autorização". ' + botaoAjuda('certificado', 'certificado digital') + '</p>';
  }
  function abrirAjuda(k, n) {
    const x = G.verbete(k); if (!x) return; guia.ajuda = k;
    let a = document.getElementById('nf-ajuda'); if (!a) { a = document.createElement('aside'); a.id = 'nf-ajuda'; a.className = 'nf-ajuda'; a.setAttribute('role', 'dialog'); a.setAttribute('aria-label', 'Explicação do campo'); document.body.appendChild(a); a.addEventListener('click', function (ev) { if (ev.target.closest('[data-fechar-ajuda]')) { guia.ajuda = null; a.remove(); document.body.classList.remove('com-ajuda-nf'); } const q = ev.target.closest('[data-ajuda]'); if (q) abrirAjuda(q.dataset.ajuda); }); }
    const termo = x.busca ? x.busca + (k === 'itens.ncm' && n && n.itens[0] ? (n.itens[0].descricao || '').split(/\s+/).slice(0, 3).join(' ') : '') : x.t;
    const bloco = function (r, t) { return t ? '<h4>' + r + '</h4><p>' + esc(t) + '</p>' : ''; };
    a.innerHTML = '<header><span class="nf-ajuda-tag">Entenda o campo</span><button type="button" class="icone" data-fechar-ajuda aria-label="Fechar explicação">×</button></header><h3>' + esc(x.t) + '</h3><p class="nf-ajuda-o">' + esc(x.o) + '</p>' +
      bloco('Explicando simples', x.f) + bloco('Para que serve', x.p) + bloco('Exemplo', x.ex) + bloco('Erro comum', x.erro) + bloco('Onde achar a informação', x.onde) +
      '<h4>Fontes oficiais</h4><ul class="nf-fontes">' + x.fontes.map(function (f) { return '<li><a href="' + esc(UI.url(f.url)) + '" target="_blank" rel="noopener">' + esc(f.nome) + ' ↗</a></li>'; }).join('') + '</ul>' +
      '<a class="btn mini" href="' + esc(G.busca(termo)) + '" target="_blank" rel="noopener">🔎 Pesquisar "' + esc(termo.trim()) + '" em sites do governo</a>' +
      '<p class="mini mudo">Regras de ICMS e ISS mudam por estado e município: na dúvida, confirme com o contador.</p>';
    document.body.classList.add('com-ajuda-nf');
  }
  function telaAprender(el) {
    const q = guia.q || '';
    const l = G.pesquisar(q);
    el.innerHTML = abas('aprender') + '<section class="cartao nf-intro"><h3>Como uma nota fiscal funciona</h3><p class="nf-feynman">Pense na nota fiscal como um envelope registrado: dentro vai a descrição do que você vendeu, por quanto e para quem; o carimbo é a autorização da SEFAZ (ou da prefeitura, no caso de serviço). O papel que viaja com a mercadoria (DANFE) é só um retrato do envelope. O envelope de verdade é o arquivo XML, que você guarda e envia ao comprador.</p>' + fluxoEmissao() + '</section>' +
      '<section class="cartao"><h3>Passo a passo do emissor</h3><ol class="nf-etapas-lista">' + G.ETAPAS.map(function (e) { return '<li><b>' + esc(e.t) + '</b>: ' + esc(e.feynman) + '</li>'; }).join('') + '</ol></section>' +
      '<section class="cartao"><header class="nf-apr-cab"><h3>Glossário (' + l.length + ')</h3><input type="search" id="nf-q" placeholder="Buscar: NCM, CFOP, DIFAL, empenho…" value="' + esc(q) + '" aria-label="Buscar no glossário"></header><div class="nf-glossario">' +
      l.map(function (x) { return '<article><h4>' + esc(x.t) + '</h4><p><b>' + esc(x.o) + '</b> ' + esc(x.f) + '</p>' + (x.ex ? '<p class="mini"><b>Exemplo:</b> ' + esc(x.ex) + '</p>' : '') + (x.erro ? '<p class="mini"><b>Erro comum:</b> ' + esc(x.erro) + '</p>' : '') + '<p class="mini">' + x.fontes.map(function (f) { return '<a href="' + esc(UI.url(f.url)) + '" target="_blank" rel="noopener">' + esc(f.nome) + ' ↗</a>'; }).join(' · ') + '</p></article>'; }).join('') + '</div></section>' +
      '<section class="cartao"><h3>Fontes oficiais</h3><ul class="nf-fontes">' + Object.keys(G.FONTES).map(function (k) { return '<li><a href="' + esc(UI.url(G.FONTES[k][1])) + '" target="_blank" rel="noopener">' + esc(G.FONTES[k][0]) + ' ↗</a></li>'; }).join('') + '</ul></section>';
    const b = el.querySelector('#nf-q'); b.oninput = function () { guia.q = b.value; clearTimeout(b._t); b._t = setTimeout(function () { telaAprender(el); const nb = el.querySelector('#nf-q'); nb.focus(); nb.setSelectionRange(nb.value.length, nb.value.length); }, 250); };
  }

  function somarDias(iso, n) { const d = new Date((iso || hoje()) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function atualizarResumo(el, n) {
    const e = emitente(n) || {}; const c = calcularNota(n); const t = c.totais; const serv = n.tipo === 'servico';
    c.itens.forEach(function (x, i) { const td = el.querySelector('[data-tot-item="' + i + '"]'); if (td) td.textContent = moeda(x.liquido); });
    const linha = function (r, v, cls, sempre) { return v || sempre ? '<div class="nf-l ' + (cls || '') + '"><span>' + r + '</span><b>' + moeda(v || 0) + '</b></div>' : ''; };
    el.querySelector('#nf-totais').innerHTML = '<h3>Totais</h3>' + linha(serv ? 'Serviços' : 'Produtos', t.produtos, '', true) + linha('(−) Descontos', t.desconto) + linha('(+) Frete', t.frete) + linha('(+) Seguro', t.seguro) + linha('(+) Outras', t.outras) + linha('(+) IPI', t.ipi) + '<div class="nf-l nf-total"><span>Total da nota</span><b>' + moeda(t.total) + '</b></div>' +
      '<h4>Tributos (estimativa)</h4>' + (e.regime === 'simples' && !serv ? '<p class="mini mudo">Simples Nacional: ICMS, PIS e COFINS recolhidos no DAS (sem destaque na nota).</p>' : '') + linha('ICMS (base ' + moeda(t.baseIcms) + ')', t.icms) + linha('DIFAL (EC 87/2015)', t.difal, 'alerta') + linha('PIS', t.pis) + linha('COFINS', t.cofins) + linha('ISS', t.iss) + linha('Tributos aproximados', t.tributosAprox) +
      (t.retencoes.total || t.retencoes.dispensa ? '<h4>Retenções na fonte</h4>' + (t.retencoes.dispensa ? '<p class="mini">Simples Nacional: dispensa de retenção federal (envie a declaração do Anexo IV ao órgão).</p>' : '') + linha('IR', t.retencoes.ir) + linha('CSLL', t.retencoes.csll) + linha('COFINS', t.retencoes.cofins) + linha('PIS', t.retencoes.pis) + linha('ISS retido', t.retencoes.iss) + linha('INSS retido', t.retencoes.inss) + '<div class="nf-l nf-total"><span>Líquido a receber</span><b>' + moeda(t.liquido) + '</b></div>' : '');
    const v = N.validar(n, e); const er = v.filter(function (x) { return x.nivel === 'erro'; });
    el.querySelector('#nf-valid').innerHTML = '<h3>' + (er.length ? '⛔ ' + er.length + ' erro(s)' : '✅ Pronta para emitir') + '</h3>' + (v.length ? '<ul class="nf-val">' + v.map(function (x) { return '<li class="' + x.nivel + '">' + esc(x.msg) + '</li>'; }).join('') + '</ul>' : '<p class="mini mudo">Sem pendências encontradas. A validação final é da SEFAZ.</p>');
    const inf = el.querySelector('#nf-inf'); if (inf) inf.textContent = [N.infoComplementar(n, e, t), n.obsAdicional].filter(Boolean).join(' ');
    n.totalNota = t.total; n.liquido = t.liquido;
  }

  function exportarEmissor(n, e) {
    if (n.tipo === 'servico') return aviso('NFS-e varia por prefeitura: use o espelho para digitar no emissor municipal ou no seu emissor de notas.', 'erro');
    const er = N.validar(n, e).filter(function (x) { return x.nivel === 'erro'; }); if (er.length) return aviso('Corrija os erros antes de exportar.', 'erro');
    const p = N.payloadFocus(Object.assign({}, n, { infCpl: [N.infoComplementar(n, e, calcularNota(n).totais), n.obsAdicional].filter(Boolean).join(' ') }), e);
    UI.baixar('nfe-' + (n.destinatario.nome || 'nota').slice(0, 20).replace(/\W+/g, '-') + '-' + n.id.slice(-5) + '.json', JSON.stringify(p, null, 2), 'application/json');
    log(n, 'JSON exportado para o emissor.'); Dados.salvar();
    aviso('JSON no formato da API Focus NFe (v2) baixado. Envie pelo seu emissor; depois importe o XML autorizado.');
  }
  async function registrarAutorizacao(n, e) {
    const r = await modal({ titulo: 'Registrar autorização', corpo: '<p class="mini">Importe o XML autorizado (recomendado) ou digite os dados do protocolo.</p><button type="button" class="btn" data-xml>Importar XML autorizado</button><hr>' + '<div class="linha">' + campo('Número', '<input name="numero" inputmode="numeric" value="' + esc(n.numero || (e ? e.proximoNumero : '')) + '">') + campo('Série', '<input name="serie" value="' + esc(n.serie || (e ? e.serie : 1)) + '" size="3">') + '</div>' + (n.tipo === 'servico' ? campo('Código de verificação / nº NFS-e', '<input name="chave">') : campo('Chave de acesso (44 números)', '<input name="chave" inputmode="numeric">')) + campo('Protocolo de autorização', '<input name="protocolo">') + campo('Data/hora da autorização', '<input type="datetime-local" name="em" value="' + new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) + '">'),
      aoAbrir: function (f) { f.querySelector('[data-xml]').onclick = async function () { const arq = await UI.escolherArquivo('.xml', false); if (!arq) return; try { const txt = await arq.text(); const x = N.lerXML(txt); if (!x.autorizada) return aviso('Este XML não tem protocolo de autorização.', 'erro'); if (e && x.emitente.cnpj !== e.cnpj) return aviso('O XML é de outro emitente.', 'erro'); const xid = 'nfx-' + Dados.id(); await Dados.guardarArquivo(xid, new Blob([txt])); n.xmlId = xid; aplicarAutorizacao(n, x); n.totalNota = x.totais.total; finalizarAutorizacao(n); f.closest('.modal-fundo').remove(); aviso('Autorização registrada pelo XML.'); location.hash = '#/notas/ver/' + n.id; } catch (err) { aviso(err.message, 'erro'); } }; },
      validar: function (fd) { if (n.tipo !== 'servico') { const c = N.lerChave(fd.get('chave')); if (!c.valida) return 'Chave inválida: ' + c.erro; if (e && c.cnpj !== e.cnpj) return 'A chave não é do CNPJ do emitente.'; } if (!fd.get('protocolo').trim()) return 'Informe o protocolo.'; return ''; } });
    if (!r) return;
    Object.assign(n, { situacao: 'autorizada', numero: Number(r.get('numero')), serie: Number(r.get('serie')), chave: r.get('chave').replace(/\s/g, ''), protocolo: r.get('protocolo').trim(), autorizadaEm: new Date(r.get('em')).toISOString() });
    log(n, 'Autorização registrada (protocolo ' + n.protocolo + ').'); finalizarAutorizacao(n); location.hash = '#/notas/ver/' + n.id;
  }
  function finalizarAutorizacao(n) { const emp = Dados.empresa(n.empresaId); if (emp && n.operacao === 'saida') { const f = fiscal(emp); if (Number(n.numero) >= Number(f.proximoNumero || 1)) f.proximoNumero = Number(n.numero) + 1; } if (!n.totalNota) { const c = calcularNota(n); n.totalNota = c.totais.total; n.liquido = c.totais.liquido; } Dados.salvar(); }

  // ---------- DANFE / espelho ----------
  function carregarBarras() { if (self.JsBarcode) return Promise.resolve(self.JsBarcode); return new Promise(function (ok, erro) { const s = document.createElement('script'); s.src = JSBARCODE; s.onload = function () { ok(self.JsBarcode); }; s.onerror = erro; document.head.appendChild(s); }); }
  function telaDanfe(el, id) {
    const n = nota(id); if (!n) { el.innerHTML = UI.vazio('Nota não encontrada', ''); return; }
    const e = n.emitenteExterno || emitente(n) || {}; const c = calcularNota(n); const t = n.totaisXML ? Object.assign({}, c.totais, n.totaisXML) : c.totais; const d = n.destinatario || {};
    const valida = n.situacao === 'autorizada'; const serv = n.tipo === 'servico';
    const infCpl = n.infCpl || [N.infoComplementar(n, emitente(n) || {}, c.totais), n.obsAdicional].filter(Boolean).join(' ');
    const cx = function (r, v, cls) { return '<div class="dn-cx ' + (cls || '') + '"><small>' + r + '</small><b>' + (v == null || v === '' ? '&nbsp;' : v) + '</b></div>'; };
    el.innerHTML = '<div class="nf-barra no-print"><a href="#/notas/' + (n.operacao === 'entrada' ? 'entrada' : 'saida') + '">‹ Voltar</a>' + rotSit(n) + '<span style="flex:1"></span>' + acoesView(n) + '<button class="btn primario" data-v="imprimir">Imprimir / PDF</button></div>' +
      '<article class="danfe' + (valida ? '' : ' espelho') + '">' + (valida ? '' : '<div class="dn-marca">SEM VALOR FISCAL<br><small>' + (n.situacao === 'cancelada' ? 'NOTA CANCELADA' : 'ESPELHO PARA CONFERÊNCIA') + '</small></div>') + (n.situacao === 'cancelada' ? '<div class="dn-marca">CANCELADA</div>' : '') +
      (serv ? '' : '<div class="dn-canhoto"><div>RECEBEMOS DE ' + esc(e.nome || '') + ' OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO</div><div class="dn-row">' + cx('DATA DE RECEBIMENTO', '') + cx('IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', '', 'g') + cx('NF-e', 'Nº ' + numero(n)) + '</div></div>') +
      '<div class="dn-row dn-topo"><div class="dn-cx g dn-emit"><b class="dn-nome">' + esc(e.nome || '') + '</b><span>' + esc([e.logradouro, e.numero, e.bairro].filter(Boolean).join(', ')) + '</span><span>' + esc([e.municipio, e.uf, e.cep].filter(Boolean).join(' - ')) + '</span></div>' +
      '<div class="dn-cx dn-tit"><b>' + (serv ? 'NFS-e' : 'DANFE') + '</b><small>' + (serv ? 'Nota fiscal de serviço' : 'Documento auxiliar da nota fiscal eletrônica') + '</small>' + (serv ? '' : '<span>' + (n.operacao === 'entrada' ? '0 - Entrada' : '1 - Saída') + '</span>') + '<b>Nº ' + numero(n) + '</b></div>' +
      '<div class="dn-cx g dn-chave">' + (n.chave && !serv ? '<svg id="dn-barras"></svg><small>CHAVE DE ACESSO</small><b class="dn-mono">' + esc(N.formatarChave(n.chave)) + '</b><small>Consulta de autenticidade no portal nacional da NF-e ou no site da SEFAZ autorizadora.</small>' : '<small>CHAVE / CÓDIGO DE VERIFICAÇÃO</small><b>' + esc(n.chave || 'gerada na emissão') + '</b>') + '</div></div>' +
      '<div class="dn-row">' + cx('NATUREZA DA OPERAÇÃO', esc(n.natureza), 'g') + cx('PROTOCOLO DE AUTORIZAÇÃO DE USO', esc(n.protocolo ? n.protocolo + ' - ' + new Date(n.autorizadaEm).toLocaleString('pt-BR') : '—'), 'g') + '</div>' +
      '<div class="dn-row">' + cx('INSCRIÇÃO ESTADUAL', esc(e.ie || '')) + cx('CNPJ', esc(cnpj(e.cnpj || ''))) + '</div>' +
      '<h5>DESTINATÁRIO / REMETENTE</h5><div class="dn-row">' + cx('NOME / RAZÃO SOCIAL', esc(d.nome || ''), 'g') + cx('CNPJ / CPF', esc(String(d.documento || '').length === 14 ? cnpj(d.documento) : d.documento || '')) + cx('DATA DA EMISSÃO', data(n.emissao)) + '</div><div class="dn-row">' + cx('ENDEREÇO', esc([d.logradouro, d.numero].filter(Boolean).join(', ')), 'g') + cx('BAIRRO', esc(d.bairro || '')) + cx('CEP', esc(d.cep || '')) + cx('DATA DA SAÍDA', n.saida ? data(n.saida) : '') + '</div><div class="dn-row">' + cx('MUNICÍPIO', esc(d.municipio || ''), 'g') + cx('UF', esc(d.uf || '')) + cx('INSCRIÇÃO ESTADUAL', esc(d.contribuinte ? d.ie || '' : 'ISENTO / NÃO CONTRIBUINTE')) + '</div>' +
      ((n.duplicatas || []).length ? '<h5>FATURA / DUPLICATAS</h5><div class="dn-row dn-dups">' + n.duplicatas.map(function (x) { return cx('Nº ' + esc(x.numero), data(x.vencimento) + ' · ' + moeda(x.valor)); }).join('') + '</div>' : '') +
      '<h5>CÁLCULO DO IMPOSTO</h5><div class="dn-row">' + cx('BASE DE CÁLC. DO ICMS', moeda(t.baseIcms || 0)) + cx('VALOR DO ICMS', moeda(t.icms || 0)) + cx('VALOR TOTAL DOS PRODUTOS', moeda(t.produtos || 0)) + cx('VALOR DO FRETE', moeda(t.frete || 0)) + cx('VALOR DO SEGURO', moeda(t.seguro || 0)) + '</div><div class="dn-row">' + cx('DESCONTO', moeda(t.desconto || 0)) + cx('OUTRAS DESPESAS', moeda(t.outras || 0)) + cx('VALOR DO IPI', moeda(t.ipi || 0)) + cx('VALOR APROX. TRIBUTOS', moeda(t.tributosAprox || 0)) + cx('VALOR TOTAL DA NOTA', '<span class="dn-total">' + moeda(t.total || 0) + '</span>') + '</div>' +
      (serv ? '' : '<h5>TRANSPORTADOR / VOLUMES TRANSPORTADOS</h5><div class="dn-row">' + cx('RAZÃO SOCIAL', esc(n.transportadora || ''), 'g') + cx('FRETE', esc((FRETE.find(function (f) { return Number(f.v) === Number(n.modalidadeFrete); }) || {}).t || '')) + cx('QUANTIDADE', esc(n.volumes || '')) + cx('PESO BRUTO', esc(n.peso || '')) + '</div>') +
      '<h5>DADOS DOS ' + (serv ? 'SERVIÇOS' : 'PRODUTOS / SERVIÇOS') + '</h5><table class="dn-itens"><thead><tr><th>CÓDIGO</th><th>DESCRIÇÃO</th>' + (serv ? '' : '<th>NCM</th><th>CST</th><th>CFOP</th>') + '<th>UN</th><th>QTD</th><th>V. UNIT</th><th>V. TOTAL</th>' + (serv ? '' : '<th>BC ICMS</th><th>V. ICMS</th><th>V. IPI</th><th>% ICMS</th>') + '</tr></thead><tbody>' + (n.itens || []).map(function (it, i) { const x = c.itens[i]; return '<tr><td>' + esc(it.codigo || i + 1) + '</td><td>' + esc(it.descricao) + '</td>' + (serv ? '' : '<td>' + esc(it.ncm || '') + '</td><td>' + esc((it.origem || '0') + (it.cst || (emitente(n) && emitente(n).regime === 'simples' ? '102' : '00'))) + '</td><td>' + esc(it.cfop || '') + '</td>') + '<td>' + esc(it.unidade || '') + '</td><td class="n">' + String(it.quantidade).replace('.', ',') + '</td><td class="n">' + moeda(it.valorUnitario || 0) + '</td><td class="n">' + moeda(x.liquido) + '</td>' + (serv ? '' : '<td class="n">' + moeda(x.baseIcms) + '</td><td class="n">' + moeda(x.icms) + '</td><td class="n">' + moeda(x.ipi) + '</td><td class="n">' + (x.aliqIcms || 0) + '</td>') + '</tr>'; }).join('') + '</tbody></table>' +
      (serv ? '<div class="dn-row">' + cx('CÓDIGO DO SERVIÇO', esc(n.codigoServico || '')) + cx('ALÍQUOTA ISS', (n.aliqIss || 0) + '%') + cx('VALOR DO ISS', moeda(t.iss || 0)) + cx('ISS RETIDO', n.issRetido ? 'Sim' : 'Não') + cx('VALOR LÍQUIDO', moeda(t.liquido)) + '</div>' : '') +
      '<h5>DADOS ADICIONAIS</h5><div class="dn-row">' + cx('INFORMAÇÕES COMPLEMENTARES', esc(infCpl), 'g dn-inf') + cx('RESERVADO AO FISCO', '') + '</div>' +
      ((n.cce || []).length ? '<h5>CARTAS DE CORREÇÃO</h5>' + n.cce.map(function (x, i) { return '<p class="dn-cce">' + (i + 1) + 'ª CC-e (' + new Date(x.em).toLocaleString('pt-BR') + '): ' + esc(x.texto) + '</p>'; }).join('') : '') +
      '</article><section class="cartao no-print"><h3>Histórico</h3><ol class="fo-linha">' + (n.historico || []).map(function (h) { return '<li><small>' + new Date(h.em).toLocaleString('pt-BR') + '</small><p>' + esc(h.t) + '</p></li>'; }).join('') + '</ol></section>';
    if (n.chave && !serv) carregarBarras().then(function (JB) { const s = document.getElementById('dn-barras'); if (s) JB(s, String(n.chave).replace(/\D/g, ''), { format: 'CODE128C', displayValue: false, height: 42, width: 1.1, margin: 0 }); }).catch(function () { /* sem código de barras offline */ });
    el.onclick = async function (ev) { const b = ev.target.closest('[data-v]'); if (!b) return; const a = b.dataset.v;
      if (a === 'imprimir') window.print();
      if (a === 'editar') location.hash = '#/notas/editar/' + n.id;
      if (a === 'xml') { const bl = await Dados.lerArquivo(n.xmlId); if (bl) UI.baixar((n.chave || n.id) + '.xml', bl, 'application/xml'); }
      if (a === 'financeiro') lancarFinanceiro(n);
      if (a === 'cancelar') cancelar(n);
      if (a === 'cce') cartaCorrecao(n);
      if (a === 'chave') navigator.clipboard.writeText(n.chave).then(function () { aviso('Chave copiada. Consulte no portal nacional da NF-e.'); });
    };
  }
  function acoesView(n) {
    const b = function (k, t, cls) { return '<button class="btn ' + (cls || '') + '" data-v="' + k + '">' + t + '</button>'; };
    return (n.situacao !== 'autorizada' && n.situacao !== 'cancelada' && n.operacao === 'saida' ? b('editar', 'Editar') : '') + (n.xmlId ? b('xml', 'Baixar XML') : '') + (n.chave && n.tipo !== 'servico' ? b('chave', 'Copiar chave') : '') +
      (n.situacao === 'autorizada' && !n.lancadoFinanceiro ? b('financeiro', n.operacao === 'entrada' ? 'Lançar a pagar' : 'Lançar a receber') : '') + (n.situacao === 'autorizada' && n.operacao === 'saida' ? b('cce', 'Carta de correção') + b('cancelar', 'Cancelar', 'perigo') : '');
  }
  function lancarFinanceiro(n) {
    if (!Telas.financas || !Telas.financas.lancar) return aviso('Seven Pay indisponível.', 'erro');
    const entrada = n.operacao === 'entrada'; const nome = entrada ? (n.emitenteExterno || {}).nome : n.destinatario.nome;
    const dups = (n.duplicatas || []).length ? n.duplicatas : [{ numero: '001', vencimento: somarDias(n.emissao, 30), valor: n.liquido || n.totalNota }];
    const perfil = Telas.financas.lancar(dups.map(function (x, i) { return { tipo: entrada ? 'despesa' : 'receita', descricao: (entrada ? 'NF ' : 'NF-e ') + numero(n) + ' · ' + (nome || '') + (dups.length > 1 ? ' (' + (i + 1) + '/' + dups.length + ')' : ''), valor: Number(x.valor), data: x.vencimento, categoria: entrada ? 'Fornecedores' : 'Vendas', origem: 'nota:' + n.id }; }));
    n.lancadoFinanceiro = true; log(n, dups.length + ' parcela(s) lançada(s) no Seven Pay (' + perfil + ').'); Dados.salvar(); aviso(dups.length + ' lançamento(s) pendente(s) criados no Seven Pay, perfil ' + perfil + '.'); App.redesenhar();
  }
  async function cancelar(n) {
    const horas = (Date.now() - new Date(n.autorizadaEm || n.emissao)) / 36e5;
    const r = await modal({ titulo: 'Cancelar NF-e ' + numero(n), botao: 'Registrar cancelamento', corpo: (horas > 24 ? '<p class="nota-importante">Já se passaram mais de 24 horas da autorização. Na maioria das UFs o cancelamento comum não é mais aceito (cabe cancelamento extemporâneo ou NF-e de devolução/estorno, conforme a SEFAZ).</p>' : '<p class="mini">O cancelamento é feito no seu emissor (evento 110111). Aqui você registra o resultado.</p>') + campo('Justificativa (mínimo 15 caracteres)', '<textarea name="j" rows="3" minlength="15" required></textarea>') + campo('Protocolo do cancelamento', '<input name="p" required>'),
      validar: function (fd) { return fd.get('j').trim().length < 15 ? 'A justificativa precisa ter pelo menos 15 caracteres.' : ''; } });
    if (!r) return; n.situacao = 'cancelada'; n.cancelamento = { justificativa: r.get('j').trim(), protocolo: r.get('p').trim(), em: new Date().toISOString() }; log(n, 'Cancelada (protocolo ' + n.cancelamento.protocolo + '): ' + n.cancelamento.justificativa); Dados.salvar(); App.redesenhar();
  }
  async function cartaCorrecao(n) {
    const r = await modal({ titulo: 'Carta de correção (CC-e)', botao: 'Registrar CC-e', corpo: '<p class="mini">A CC-e não pode alterar valores, impostos, dados cadastrais que mudem o remetente/destinatário, nem a data de emissão ou saída (Ajuste SINIEF 01/07). Cada nova CC-e substitui a anterior, então repita as correções anteriores.</p>' + campo('Correção (mínimo 15 caracteres)', '<textarea name="t" rows="4" required>' + esc(n.cce && n.cce.length ? n.cce[n.cce.length - 1].texto : '') + '</textarea>'), validar: function (fd) { return fd.get('t').trim().length < 15 ? 'Mínimo de 15 caracteres.' : ''; } });
    if (!r) return; n.cce = n.cce || []; n.cce.push({ texto: r.get('t').trim(), em: new Date().toISOString() }); log(n, 'Carta de correção registrada.'); Dados.salvar(); App.redesenhar();
  }

  // ---------- relatórios e configurações ----------
  function telaRelatorios(el) {
    const emp = Dados.empresaAtiva(); const L = lista().filter(function (n) { return n.operacao === 'saida' && n.situacao === 'autorizada' && (!emp || n.empresaId === emp.id); });
    const meses = []; for (let i = 11; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); meses.push(d.toISOString().slice(0, 7)); }
    const porMes = meses.map(function (m) { return { t: m.slice(5) + '/' + m.slice(2, 4), v: L.filter(function (n) { return String(n.emissao).slice(0, 7) === m; }).reduce(function (s, n) { return s + (n.totalNota || 0); }, 0) }; });
    const porDest = {}; L.forEach(function (n) { const k = n.destinatario.nome || '—'; porDest[k] = (porDest[k] || 0) + (n.totalNota || 0); });
    const imp = { icms: 0, ipi: 0, pis: 0, cofins: 0, iss: 0, difal: 0, ret: 0 }; L.forEach(function (n) { const t = calcularNota(n).totais; imp.icms += t.icms; imp.ipi += t.ipi; imp.pis += t.pis; imp.cofins += t.cofins; imp.iss += t.iss; imp.difal += t.difal; imp.ret += t.retencoes.total; });
    const fat = N.faturamento12m(lista().filter(function (n) { return !emp || n.empresaId === emp.id; }), hoje());
    el.innerHTML = abas('relatorios') + '<div class="kpis pequenos"><div><span>Faturamento 12 meses</span><b>' + moeda(fat) + '</b></div><div><span>Teto do Simples (R$ 4,8 mi)</span><b>' + (Math.round(fat / 4.8e6 * 1000) / 10).toString().replace('.', ',') + '%</b></div><div><span>Teto do MEI (R$ 81 mil)</span><b>' + Math.round(fat / 81000 * 100) + '%</b></div><div><span>Retenções sofridas</span><b>' + moeda(imp.ret) + '</b></div></div>' +
      '<section class="cartao"><h3>Faturamento por mês</h3>' + UI.barras(porMes, { fmt: moeda, rotulo: 'Faturamento por mês' }) + '</section>' +
      '<div class="cartoes"><section class="cartao"><h3>Maiores clientes / órgãos</h3><table class="tabela">' + Object.keys(porDest).sort(function (a, b) { return porDest[b] - porDest[a]; }).slice(0, 10).map(function (k) { return '<tr><td>' + esc(k) + '</td><td class="n">' + moeda(porDest[k]) + '</td></tr>'; }).join('') + '</table></section>' +
      '<section class="cartao"><h3>Tributos destacados (estimativa)</h3><table class="tabela">' + [['ICMS', imp.icms], ['DIFAL', imp.difal], ['IPI', imp.ipi], ['PIS', imp.pis], ['COFINS', imp.cofins], ['ISS', imp.iss]].map(function (x) { return '<tr><td>' + x[0] + '</td><td class="n">' + moeda(x[1]) + '</td></tr>'; }).join('') + '</table><p class="mini mudo">No Simples Nacional o imposto é apurado no DAS sobre a receita bruta; confirme com a contabilidade.</p></section></div>' +
      '<p><button class="btn" data-exp>Exportar notas (Excel)</button></p>';
    el.onclick = function (ev) { if (!ev.target.closest('[data-exp]')) return; const linhas = [['Operação', 'Modelo', 'Número', 'Série', 'Emissão', 'Situação', 'Destinatário/Fornecedor', 'CNPJ', 'Natureza', 'Total', 'Líquido', 'Empenho', 'Chave', 'Protocolo']]; lista().forEach(function (n) { linhas.push([n.operacao, n.modelo, n.numero || '', n.serie || '', n.emissao, N.SITUACOES[n.situacao], n.operacao === 'entrada' ? (n.emitenteExterno || {}).nome : n.destinatario.nome, n.operacao === 'entrada' ? (n.emitenteExterno || {}).cnpj : n.destinatario.documento, n.natureza, n.totalNota || 0, n.liquido || n.totalNota || 0, (n.contrato || {}).empenho || '', n.chave || '', n.protocolo || '']); }); Telas.fornecedores.baixarPlanilha('notas-fiscais', [{ nome: 'Notas', linhas: linhas }], [8, 7, 9, 5, 11, 12, 36, 18, 22, 12, 12, 16, 48, 18]); };
  }
  function telaConfig(el) {
    const emp = Dados.empresaAtiva(); if (!emp) { el.innerHTML = abas('config') + UI.vazio('Cadastre o cliente emitente', 'As configurações fiscais ficam no cadastro de cada cliente (CNPJ).', '<a class="btn primario" href="#/empresas">Ir para Clientes</a>'); return; }
    const f = fiscal(emp);
    el.innerHTML = abas('config') + '<form class="cartao" id="nf-cfg"><h3>' + esc(emp.razao) + ' · CNPJ ' + esc(cnpj(emp.cnpj)) + '</h3><div class="linha">' + campo('Regime tributário', '<select name="regime">' + opcoes([{ v: 'simples', t: 'Simples Nacional' }, { v: 'presumido', t: 'Lucro Presumido' }, { v: 'real', t: 'Lucro Real' }], f.regime) + '</select>') + campo('Inscrição estadual', '<input name="ie" value="' + esc(f.ie) + '">') + campo('Inscrição municipal', '<input name="im" value="' + esc(f.im) + '">') + '</div>' +
      '<div class="linha">' + campo('Logradouro', '<input name="logradouro" value="' + esc(f.logradouro) + '">') + campo('Número', '<input name="numero" value="' + esc(f.numero) + '" size="6">') + campo('Bairro', '<input name="bairro" value="' + esc(f.bairro) + '">') + campo('CEP', '<input name="cep" value="' + esc(f.cep) + '">') + '</div>' +
      '<div class="linha">' + campo('Série da NF-e', '<input name="serie" type="number" value="' + esc(f.serie) + '">') + campo('Próximo número', '<input name="proximoNumero" type="number" value="' + esc(f.proximoNumero) + '">') + campo('ICMS interno (%) — regime normal', '<input name="aliqIcmsInterna" value="' + esc(f.aliqIcmsInterna) + '">') + campo('Tributos aproximados (%)', '<input name="percTributos" value="' + esc(f.percTributos) + '">', 'Lei 12.741/2012 (tabela IBPT).') + '</div>' +
      '<div class="linha">' + campo('Código de serviço padrão (NFS-e)', '<input name="codigoServico" value="' + esc(f.codigoServico) + '">') + campo('Alíquota ISS padrão (%)', '<input name="aliqIss" value="' + esc(f.aliqIss) + '">') + '</div>' + campo('Dados bancários padrão', '<input name="dadosBancarios" value="' + esc(f.dadosBancarios) + '" placeholder="Banco, agência, conta, PIX">') + '<button class="btn primario">Salvar</button></form>' +
      '<section class="cartao"><h3>Como emitir com valor fiscal</h3><ol><li>Tenha o <b>certificado digital A1</b> da empresa e a inscrição estadual (NF-e) ou municipal (NFS-e) habilitadas.</li><li>Use um emissor: Focus NFe, NFE.io, Bling, o emissor da SEFAZ ou o da prefeitura. O sistema exporta a nota no formato JSON da API Focus NFe (botão "Enviar ao emissor").</li><li>Após a autorização, <b>importe o XML</b> aqui (botão "Importar XML"): chave, protocolo, DANFE e número ficam registrados, e dá para lançar o contas a receber.</li></ol><p class="mini mudo">Transmitir direto do navegador para a SEFAZ não é possível: a comunicação exige o certificado no canal TLS, o que só servidores e emissores fazem.</p></section>';
    el.querySelector('#nf-cfg').onsubmit = function (ev) { ev.preventDefault(); const d = new FormData(ev.target); ['regime', 'ie', 'im', 'logradouro', 'numero', 'bairro', 'cep', 'codigoServico', 'dadosBancarios'].forEach(function (k) { f[k] = String(d.get(k)).trim(); }); f.serie = Number(d.get('serie')) || 1; f.proximoNumero = Number(d.get('proximoNumero')) || 1; f.aliqIcmsInterna = num(d.get('aliqIcmsInterna')); f.percTributos = num(d.get('percTributos')); f.aliqIss = num(d.get('aliqIss')); Dados.salvar(); aviso('Configurações fiscais salvas.'); };
  }

  Telas.notas = {
    titulo: 'Seven Nota',
    render: function (el, sub, param) {
      el.onclick = el.oninput = el.onchange = null; const aj = document.getElementById('nf-ajuda'); if (aj && sub !== 'editar') { aj.remove(); guia.ajuda = null; document.body.classList.remove('com-ajuda-nf'); }
      if (sub === 'editar') return telaEditor(el, param);
      if (sub === 'ver') return telaDanfe(el, param);
      if (sub === 'entrada') return telaLista(el, 'entrada');
      if (sub === 'relatorios') return telaRelatorios(el);
      if (sub === 'config') return telaConfig(el);
      if (sub === 'aprender') return telaAprender(el);
      return telaLista(el, 'saida');
    }
  };
})();
