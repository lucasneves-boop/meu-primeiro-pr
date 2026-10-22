/* Seven Loja: catálogo de produtos e serviços, busca, carrinho, cupons, recomendações e pedidos. Sem dependências. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Loja = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CATEGORIAS = [
    { id: 'bpo', t: 'BPO de Licitações', ic: '◆' },
    { id: 'avulsos', t: 'Serviços avulsos', ic: '⚡' },
    { id: 'documentacao', t: 'Documentação e cadastro', ic: '✓' },
    { id: 'juridico', t: 'Peças e recursos', ic: '§' },
    { id: 'inteligencia', t: 'Inteligência de mercado', ic: '▤' },
    { id: 'treinamentos', t: 'Treinamentos', ic: '◎' }
  ];

  // Catálogo inicial: só o que a Seven faz (BPO do edital ao pagamento). Preço em branco = "sob consulta":
  // a Seven define os valores em Gerenciar loja.
  const CATALOGO = [
    { id: 'bpo-completo', cat: 'bpo', t: 'BPO de Licitações completo — do edital ao pagamento', unidade: 'mês', tipo: 'recorrente',
      bullets: ['Busca e triagem diária de editais nos portais (PNCP, Compras.gov.br, BLL, SISLOG-GO e outros)', 'Análise de edital, habilitação e proposta', 'Disputa da sessão de lances com valor limite aprovado pelo cliente', 'Acompanhamento do chat, recursos, contrato, empenho e pagamento', 'Gestão de certidões e do SICAF'],
      desc: 'A Seven assume o departamento de licitações da empresa: encontra as oportunidades, prepara os documentos, disputa e acompanha até o dinheiro entrar. O cliente aprova preço mínimo e participação; a Seven executa.', tags: ['terceirização', 'departamento de licitações', 'mensal', 'pregão'] },
    { id: 'analise-edital', cat: 'avulsos', t: 'Análise de edital com parecer de participação', unidade: 'edital', tipo: 'avulso',
      bullets: ['Resumo do objeto, datas, critério e modo de disputa', 'Exigências de habilitação e pontos de risco', 'Recomendação: participar, impugnar ou não participar'], desc: 'Leitura completa do edital e anexos, com checklist de documentos e parecer objetivo.', tags: ['edital', 'parecer', 'termo de referência'] },
    { id: 'sessao-lances', cat: 'avulsos', t: 'Participação em sessão de pregão (lances)', unidade: 'sessão', tipo: 'avulso',
      bullets: ['Cadastro da proposta no portal', 'Disputa com estratégia e valor limite definidos com o cliente', 'Envio de proposta ajustada e documentos ao pregoeiro'], desc: 'Para quem já tem a licitação escolhida e precisa de quem opere a sessão.', tags: ['pregão eletrônico', 'disputa', 'lances'] },
    { id: 'cotacao', cat: 'avulsos', t: 'Cotação com fornecedores para um edital', unidade: 'edital', tipo: 'avulso',
      bullets: ['Extração dos itens do termo de referência', 'Disparo e follow-up com fornecedores', 'Mapa comparativo de preços'], desc: 'Levantamento de custos de compra para formar o preço da proposta.', tags: ['orçamento', 'fornecedores', 'mapa de preços'] },
    { id: 'precificacao', cat: 'avulsos', t: 'Precificação e planilha de custos', unidade: 'edital', tipo: 'avulso',
      bullets: ['Custo, tributos, frete e margem por item', 'Preço mínimo para o robô / sessão', 'Planilha de custos para serviços quando o edital exigir'], desc: 'Formação de preço com margem mínima clara antes da disputa.', tags: ['preço', 'margem', 'planilha', 'BDI'] },
    { id: 'sicaf', cat: 'documentacao', t: 'Cadastro e atualização do SICAF', unidade: 'cadastro', tipo: 'avulso',
      bullets: ['Credenciamento e níveis II a VI', 'Conferência das certidões federais', 'Anexo das certidões estadual, municipal e de falência'], desc: 'Deixa o SICAF pronto para participar das compras federais.', tags: ['sicaf', 'compras.gov.br', 'habilitação'] },
    { id: 'certidoes', cat: 'documentacao', t: 'Gestão de certidões e documentos de habilitação', unidade: 'mês', tipo: 'recorrente',
      bullets: ['Emissão e renovação antes do vencimento', 'Pasta de habilitação sempre atualizada', 'Aviso de pendência fiscal assim que aparecer'], desc: 'Nenhuma licitação perdida por certidão vencida.', tags: ['certidões', 'cnd', 'fgts', 'cndt'] },
    { id: 'portais', cat: 'documentacao', t: 'Cadastro em portais de compras', unidade: 'portal', tipo: 'avulso',
      bullets: ['Compras.gov.br, BLL, Licitanet, Compras Públicas, SISLOG-GO e outros', 'Configuração de usuários e permissões', 'Teste de acesso antes da primeira sessão'], desc: 'Habilita a empresa a disputar nos portais onde os órgãos-alvo compram.', tags: ['portal', 'bll', 'sislog', 'credenciamento'] },
    { id: 'impugnacao', cat: 'juridico', t: 'Pedido de esclarecimento ou impugnação ao edital', unidade: 'peça', tipo: 'avulso',
      bullets: ['Identificação da cláusula restritiva', 'Peça fundamentada na Lei 14.133/2021', 'Protocolo dentro do prazo de 3 dias úteis'], desc: 'Para corrigir exigências que restringem a competição antes da sessão.', tags: ['impugnação', 'esclarecimento', 'art. 164'] },
    { id: 'recurso', cat: 'juridico', t: 'Recurso administrativo ou contrarrazões', unidade: 'peça', tipo: 'avulso',
      bullets: ['Registro da intenção de recurso na sessão', 'Razões ou contrarrazões em 3 dias úteis', 'Acompanhamento da decisão'], desc: 'Defesa da empresa contra inabilitação, desclassificação ou decisão favorável a concorrente.', tags: ['recurso', 'contrarrazões', 'art. 165'] },
    { id: 'reequilibrio', cat: 'juridico', t: 'Pedido de reequilíbrio econômico-financeiro', unidade: 'pedido', tipo: 'avulso',
      bullets: ['Levantamento de notas e índices antes/depois', 'Peça com base no art. 124, II, d', 'Acompanhamento junto ao órgão'], desc: 'Recompõe o preço de contrato ou ata quando o custo sobe por fato imprevisível.', tags: ['reequilíbrio', 'revisão', 'ata', 'contrato'] },
    { id: 'pagamento', cat: 'juridico', t: 'Acompanhamento de empenho e cobrança de pagamento', unidade: 'contrato', tipo: 'avulso',
      bullets: ['Controle de empenhos, entregas e notas', 'Cobrança formal de atraso', 'Ordem cronológica de pagamentos (art. 141)'], desc: 'Do empenho ao dinheiro na conta.', tags: ['empenho', 'pagamento', 'atraso', 'nota fiscal'] },
    { id: 'estudo-mercado', cat: 'inteligencia', t: 'Estudo de mercado B2G personalizado', unidade: 'estudo', tipo: 'avulso',
      bullets: ['Quem compra o que a empresa vende, quanto e onde', 'Oportunidades abertas e histórico de preços homologados', 'Concorrentes que vencem e deságio típico'], desc: 'Relatório com dados do PNCP para decidir onde e como vender ao governo.', tags: ['estudo de mercado', 'pncp', 'concorrentes', 'oportunidades'] },
    { id: 'monitoramento', cat: 'inteligencia', t: 'Monitoramento de oportunidades', unidade: 'mês', tipo: 'recorrente',
      bullets: ['Perfil de busca com as palavras do cliente', 'Envio das oportunidades triadas', 'Alerta de prazos de impugnação e sessão'], desc: 'Para quem opera as próprias licitações mas quer não perder editais.', tags: ['avisos', 'editais', 'alerta', 'busca'] },
    { id: 'treinamento', cat: 'treinamentos', t: 'Treinamento: primeiros passos para vender ao governo', unidade: 'turma', tipo: 'avulso',
      bullets: ['Como funcionam pregão, dispensa e concorrência', 'Documentos de habilitação e certidões', 'Portais, cadastro e primeira proposta'], desc: 'Capacitação prática para a equipe do cliente.', tags: ['curso', 'capacitação', 'equipe'] },
    { id: 'consultoria', cat: 'treinamentos', t: 'Consultoria presencial em Catalão-GO', unidade: 'hora', tipo: 'avulso',
      bullets: ['Atendimento na sede do cliente ou no escritório', 'Diagnóstico do processo de licitações da empresa', 'Plano de ação com prioridades'], desc: 'Atendimento presencial em Catalão-GO (sede em Brasília-DF).', tags: ['consultoria', 'presencial', 'diagnóstico'] }
  ];

  function normalizar(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function arred(v) { return Math.round(v * 100) / 100; }

  // ---------- busca ----------
  function pontuar(p, termos) {
    if (!termos.length) return 1;
    const t = normalizar(p.t), tags = normalizar((p.tags || []).join(' ')), resto = normalizar((p.bullets || []).join(' ') + ' ' + (p.desc || ''));
    let s = 0;
    for (const q of termos) {
      let m = 0;
      if ((' ' + t + ' ').indexOf(' ' + q) >= 0) m = 5; else if (t.indexOf(q) >= 0) m = 3;
      if (tags.indexOf(q) >= 0) m += 2;
      if (!m && resto.indexOf(q) >= 0) m = 1;
      if (!m) return 0;
      s += m;
    }
    return s;
  }

  function buscar(produtos, f) {
    f = f || {};
    const termos = normalizar(f.q).split(' ').filter(function (x) { return x.length > 1; });
    let r = produtos.filter(function (p) { return p.ativo !== false; }).map(function (p) { return { p: p, s: pontuar(p, termos) }; }).filter(function (x) { return x.s > 0; });
    if (f.cat) r = r.filter(function (x) { return x.p.cat === f.cat; });
    if (f.tipo) r = r.filter(function (x) { return x.p.tipo === f.tipo; });
    if (f.min != null && f.min !== '') r = r.filter(function (x) { return x.p.preco != null && x.p.preco >= Number(f.min); });
    if (f.max != null && f.max !== '') r = r.filter(function (x) { return x.p.preco != null && x.p.preco <= Number(f.max); });
    if (f.nota) r = r.filter(function (x) { return (f.notas && f.notas[x.p.id] ? f.notas[x.p.id].media : 0) >= Number(f.nota); });
    const vendas = f.vendas || {}; const notas = f.notas || {};
    const preco = function (x, sem) { return x.p.preco == null ? sem : x.p.preco; };
    const ord = {
      relevancia: function (a, b) { return b.s - a.s || (vendas[b.p.id] || 0) - (vendas[a.p.id] || 0); },
      menor: function (a, b) { return preco(a, Infinity) - preco(b, Infinity); },
      maior: function (a, b) { return preco(b, -1) - preco(a, -1); },
      avaliacao: function (a, b) { return ((notas[b.p.id] || {}).media || 0) - ((notas[a.p.id] || {}).media || 0) || ((notas[b.p.id] || {}).n || 0) - ((notas[a.p.id] || {}).n || 0); },
      vendidos: function (a, b) { return (vendas[b.p.id] || 0) - (vendas[a.p.id] || 0); },
      novos: function (a, b) { return String(b.p.criadoEm || '').localeCompare(String(a.p.criadoEm || '')); }
    };
    r.sort(ord[f.ordem] || ord.relevancia);
    return r.map(function (x) { return x.p; });
  }

  function sugestoes(produtos, q, n) {
    const qq = normalizar(q); if (qq.length < 2) return [];
    return buscar(produtos, { q: q }).slice(0, n || 6).map(function (p) { return p.t; });
  }

  // ---------- avaliações ----------
  function avaliacoes(lista) {
    const por = {};
    (lista || []).forEach(function (a) { const x = por[a.produto] = por[a.produto] || { n: 0, soma: 0, dist: [0, 0, 0, 0, 0] }; x.n++; x.soma += a.nota; x.dist[a.nota - 1]++; });
    Object.keys(por).forEach(function (k) { por[k].media = Math.round(por[k].soma / por[k].n * 10) / 10; });
    return por;
  }

  // ---------- carrinho ----------
  function adicionar(carrinho, id, qtd) {
    qtd = Math.max(1, Math.floor(qtd || 1));
    const x = carrinho.find(function (i) { return i.id === id && !i.depois; });
    if (x) x.qtd = Math.min(99, x.qtd + qtd); else carrinho.push({ id: id, qtd: Math.min(99, qtd) });
    return carrinho;
  }
  function definirQtd(carrinho, id, qtd) {
    qtd = Math.floor(Number(qtd) || 0);
    if (qtd <= 0) return carrinho.filter(function (i) { return i.id !== id || i.depois; });
    carrinho.forEach(function (i) { if (i.id === id && !i.depois) i.qtd = Math.min(99, qtd); });
    return carrinho;
  }

  function validarCupom(cupom, subtotal, hoje) {
    if (!cupom) return 'Cupom não encontrado.';
    if (cupom.ativo === false) return 'Cupom inativo.';
    if (cupom.validade && hoje && hoje > cupom.validade) return 'Cupom vencido.';
    if (cupom.minimo && subtotal < cupom.minimo) return 'Pedido mínimo para este cupom: R$ ' + cupom.minimo.toFixed(2).replace('.', ',') + '.';
    if (cupom.usos != null && cupom.limite != null && cupom.usos >= cupom.limite) return 'Cupom esgotado.';
    return '';
  }

  function totais(carrinho, produtos, cupom, hoje) {
    const linhas = carrinho.filter(function (i) { return !i.depois; }).map(function (i) {
      const p = produtos.find(function (x) { return x.id === i.id; });
      return p ? { p: p, qtd: i.qtd, total: p.preco == null ? null : arred(p.preco * i.qtd) } : null;
    }).filter(Boolean);
    const subtotal = arred(linhas.reduce(function (s, l) { return s + (l.total || 0); }, 0));
    const consulta = linhas.filter(function (l) { return l.total == null; }).length;
    let desconto = 0; let erroCupom = '';
    if (cupom) {
      erroCupom = validarCupom(cupom, subtotal, hoje);
      if (!erroCupom) desconto = cupom.tipo === 'percentual' ? arred(subtotal * Math.min(100, cupom.valor) / 100) : Math.min(subtotal, cupom.valor);
    }
    const recorrente = arred(linhas.filter(function (l) { return l.p.tipo === 'recorrente' && l.total != null; }).reduce(function (s, l) { return s + l.total; }, 0));
    return { linhas: linhas, itens: linhas.reduce(function (s, l) { return s + l.qtd; }, 0), subtotal: subtotal, desconto: arred(desconto), total: arred(subtotal - desconto), consulta: consulta, recorrente: recorrente, erroCupom: erroCupom };
  }

  function parcelas(total, max, minParcela) {
    if (!total || total <= 0) return 1;
    let n = Math.max(1, Math.floor(max || 1));
    while (n > 1 && total / n < (minParcela || 100)) n--;
    return n;
  }

  // ---------- recomendações ----------
  function compradosJuntos(pedidos, id, n) {
    const c = {};
    (pedidos || []).forEach(function (o) {
      const ids = o.itens.map(function (i) { return i.id; });
      if (ids.indexOf(id) < 0) return;
      ids.forEach(function (x) { if (x !== id) c[x] = (c[x] || 0) + 1; });
    });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b); }).slice(0, n || 3);
  }

  function recomendados(produtos, pedidos, id, n) {
    n = n || 4;
    const p = produtos.find(function (x) { return x.id === id; });
    const ids = compradosJuntos(pedidos, id, n);
    produtos.forEach(function (x) { if (ids.length < n && x.id !== id && x.ativo !== false && p && x.cat === p.cat && ids.indexOf(x.id) < 0) ids.push(x.id); });
    produtos.forEach(function (x) { if (ids.length < n && x.id !== id && x.ativo !== false && ids.indexOf(x.id) < 0) ids.push(x.id); });
    return ids.map(function (k) { return produtos.find(function (x) { return x.id === k; }); }).filter(function (x) { return x && x.ativo !== false; });
  }

  function vendas(pedidos) {
    const v = {};
    (pedidos || []).forEach(function (o) { if (o.status === 'cancelado') return; o.itens.forEach(function (i) { v[i.id] = (v[i.id] || 0) + i.qtd; }); });
    return v;
  }

  // ---------- pedidos ----------
  const STATUS = [
    { id: 'novo', t: 'Pedido recebido' },
    { id: 'confirmado', t: 'Confirmado com o cliente' },
    { id: 'pago', t: 'Pagamento recebido' },
    { id: 'execucao', t: 'Em execução' },
    { id: 'concluido', t: 'Concluído' }
  ];

  function proximoNumero(pedidos, ano) {
    const pre = String(ano) + '-';
    const ns = (pedidos || []).map(function (o) { return String(o.numero || ''); }).filter(function (n) { return n.indexOf(pre) === 0; }).map(function (n) { return Number(n.slice(pre.length)) || 0; });
    return pre + String((ns.length ? Math.max.apply(null, ns) : 0) + 1).padStart(4, '0');
  }

  function moeda(v) { return v == null ? 'sob consulta' : 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  function mensagemPedido(o, cfg) {
    cfg = cfg || {};
    const l = ['Olá' + (o.cliente && o.cliente.contato ? ', ' + o.cliente.contato : '') + '!', '', 'Segue o pedido nº ' + o.numero + ' com a ' + (cfg.empresa || 'Seven') + ':', ''];
    o.itens.forEach(function (i) { l.push('• ' + i.qtd + 'x ' + i.t + ' (' + i.unidade + ') — ' + (i.preco == null ? 'sob consulta' : moeda(i.preco * i.qtd))); });
    l.push('');
    if (o.desconto) l.push('Desconto' + (o.cupom ? ' (' + o.cupom + ')' : '') + ': -' + moeda(o.desconto));
    l.push('Total: ' + moeda(o.total) + (o.consulta ? ' + ' + o.consulta + ' item(ns) sob consulta' : ''));
    if (o.pagamento) l.push('Pagamento: ' + o.pagamento);
    if (o.obs) l.push('Observações: ' + o.obs);
    l.push('', 'Qualquer ajuste, é só responder esta mensagem.', '', cfg.assinatura || 'Lucas Neves | Seven');
    return l.join('\n');
  }

  function telefoneWhats(t) {
    let d = String(t || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 10 || d.length === 11) d = '55' + d;
    return d.length >= 12 ? d : '';
  }

  return {
    CATEGORIAS: CATEGORIAS, CATALOGO: CATALOGO, STATUS: STATUS,
    normalizar: normalizar, buscar: buscar, sugestoes: sugestoes, avaliacoes: avaliacoes,
    adicionar: adicionar, definirQtd: definirQtd, validarCupom: validarCupom, totais: totais, parcelas: parcelas,
    compradosJuntos: compradosJuntos, recomendados: recomendados, vendas: vendas,
    proximoNumero: proximoNumero, mensagemPedido: mensagemPedido, telefoneWhats: telefoneWhats, moeda: moeda
  };
});
