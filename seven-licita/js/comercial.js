/* Regras da área Comercial: funil, métricas de conversão, ICP, cadências, scripts, ROI e análise do estudo de mercado B2G.
   O estudo segue a regra de evidência: todo número sai etiquetado como Verificado (fonte consultada), Estimado (premissas Pn) ou Hipótese. Puro, testável no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Comercial = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const r2 = function (v) { return Math.round((Number(v) || 0) * 100) / 100; };
  function normalizar(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim(); }
  function dias(a, b) { return Math.round((new Date(String(b).slice(0, 10) + 'T12:00:00Z') - new Date(String(a).slice(0, 10) + 'T12:00:00Z')) / 864e5); }
  function somarUteis(iso, n) { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); let k = 0; while (k < n) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) k++; } return d.toISOString().slice(0, 10); }

  // ---------- funil ----------
  const ETAPAS = [
    { id: 'lead', nome: 'Lead', prob: 5, meta: 'Identificar o decisor e o motivo do contato' },
    { id: 'contato', nome: 'Contato feito', prob: 10, meta: 'Agendar a reunião de diagnóstico' },
    { id: 'diagnostico', nome: 'Diagnóstico (SPIN)', prob: 25, meta: 'Dor, impacto e urgência confirmados; dados para o estudo' },
    { id: 'estudo', nome: 'Estudo apresentado', prob: 45, meta: 'Cliente enxerga o tamanho da oportunidade no mercado dele' },
    { id: 'proposta', nome: 'Proposta enviada', prob: 60, meta: 'Proposta com 3 opções e ROI, apresentada em reunião' },
    { id: 'negociacao', nome: 'Negociação', prob: 80, meta: 'Objeções resolvidas, plano de ação mútuo com data de início' },
    { id: 'ganho', nome: 'Ganho', prob: 100, meta: 'Contrato assinado e onboarding agendado' },
    { id: 'perdido', nome: 'Perdido', prob: 0, meta: 'Motivo registrado e reativação agendada' }
  ];
  const MOTIVOS_PERDA = ['Preço', 'Sem prioridade / timing', 'Já tem equipe interna', 'Fechou com concorrente', 'Não vende para governo', 'Sem retorno (ghosting)', 'Desconfia de licitação (pagamento, burocracia)', 'Outro'];
  function valorNegocio(n) { return r2((Number(n.mensalidade) || 0) * (Number(n.meses) || 12) + (Number(n.implantacao) || 0)); }
  function etapa(id, etapas) { return (etapas || ETAPAS).find(function (e) { return e.id === id; }) || ETAPAS[0]; }
  function probabilidade(n, etapas) { return n.prob != null && n.prob !== '' ? Number(n.prob) : etapa(n.etapa, etapas).prob; }
  // Etapas pelas quais o negócio passou (o histórico guarda cada mudança).
  function alcancou(n, idx, etapas) { const E = (etapas || ETAPAS).filter(function (e) { return e.id !== 'perdido'; }); const ids = (n.historicoEtapas || []).map(function (h) { return h.etapa; }).concat([n.etapa]); const max = Math.max.apply(null, ids.map(function (i) { return E.findIndex(function (e) { return e.id === i; }); })); return max >= idx; }
  function metricas(negocios, hojeISO, etapas) {
    const E = (etapas || ETAPAS); const abertos = negocios.filter(function (n) { return n.etapa !== 'ganho' && n.etapa !== 'perdido'; });
    const ganhos = negocios.filter(function (n) { return n.etapa === 'ganho'; }), perdidos = negocios.filter(function (n) { return n.etapa === 'perdido'; });
    const fechados = ganhos.length + perdidos.length; const win = fechados ? ganhos.length / fechados : null;
    const ciclos = ganhos.filter(function (n) { return n.criadoEm && n.fechadoEm; }).map(function (n) { return dias(n.criadoEm, n.fechadoEm); });
    const ciclo = ciclos.length ? ciclos.reduce(function (s, x) { return s + x; }, 0) / ciclos.length : null;
    const ticket = ganhos.length ? ganhos.reduce(function (s, n) { return s + valorNegocio(n); }, 0) / ganhos.length : null;
    const porEtapa = E.map(function (e) { const ns = negocios.filter(function (n) { return n.etapa === e.id; }); return { id: e.id, nome: e.nome, qtd: ns.length, valor: r2(ns.reduce(function (s, n) { return s + valorNegocio(n); }, 0)) }; });
    const funil = E.filter(function (e) { return e.id !== 'perdido'; }); const alc = funil.map(function (e, i) { return negocios.filter(function (n) { return alcancou(n, i, E); }).length; });
    const conversao = funil.slice(0, -1).map(function (e, i) { return { de: e.nome, para: funil[i + 1].nome, taxa: alc[i] ? alc[i + 1] / alc[i] : null, entraram: alc[i] }; });
    const motivos = {}; perdidos.forEach(function (n) { const k = n.motivoPerda || 'Não informado'; motivos[k] = (motivos[k] || 0) + 1; });
    const pipeline = r2(abertos.reduce(function (s, n) { return s + valorNegocio(n); }, 0)); const ponderado = r2(abertos.reduce(function (s, n) { return s + valorNegocio(n) * probabilidade(n, E) / 100; }, 0));
    // Velocidade de vendas = oportunidades × taxa de ganho × ticket ÷ ciclo (R$ por dia)
    const velocidade = win != null && ticket && ciclo ? r2(abertos.length * win * ticket / Math.max(1, ciclo)) : null;
    const parados = abertos.filter(function (n) { return n.atualizadoEm && dias(n.atualizadoEm, hojeISO) > 14; });
    const mes = hojeISO.slice(0, 7); const ganhosMes = ganhos.filter(function (n) { return String(n.fechadoEm || '').slice(0, 7) === mes; });
    return { abertos: abertos.length, pipeline: pipeline, ponderado: ponderado, ganhos: ganhos.length, perdidos: perdidos.length, win: win, ciclo: ciclo, ticket: ticket, porEtapa: porEtapa, conversao: conversao, motivos: motivos, velocidade: velocidade, parados: parados, ganhosMes: ganhosMes.length, receitaMes: r2(ganhosMes.reduce(function (s, n) { return s + (Number(n.mensalidade) || 0); }, 0)) };
  }

  // ---------- ICP (perfil de cliente ideal para o BPO de licitações) ----------
  const ICP = [
    { k: 'vendeGoverno', t: 'Já vende ou quer vender ao governo', p: 25 },
    { k: 'semEquipe', t: 'Não tem equipe dedicada a licitações (ou ela está sobrecarregada)', p: 20 },
    { k: 'dorDeclarada', t: 'Dor declarada (perdeu prazo, foi inabilitado, perdeu por preço, não sabe por onde começar)', p: 15 },
    { k: 'decisor', t: 'Falamos com o decisor (sócio/diretor)', p: 10 },
    { k: 'mercadoAtrativo', t: 'Estudo mostra mercado público relevante para o que ele vende', p: 15 },
    { k: 'mepp', t: 'ME/EPP (tem benefícios e cotas exclusivas na Lei 123)', p: 5 },
    { k: 'documentacao', t: 'Documentação e certidões em dia (ou fáceis de regularizar)', p: 5 },
    { k: 'capacidade', t: 'Tem capacidade de entrega e capital de giro para prazo de pagamento público', p: 5 }
  ];
  function icp(conta) { const c = conta.icp || {}; const s = ICP.reduce(function (t, x) { return t + (c[x.k] ? x.p : 0); }, 0); return { pontos: s, faixa: s >= 70 ? 'A' : s >= 45 ? 'B' : 'C' }; }

  // ---------- cadências (prospecção ativa) ----------
  const CADENCIAS = {
    outbound: { nome: 'Prospecção ativa · 15 dias úteis', passos: [[0, 'ligacao', 'Ligação de abertura (script de abertura)'], [0, 'email', 'E-mail 1: insight do mercado público do segmento'], [2, 'whatsapp', 'WhatsApp: pedido de 15 min para mostrar as oportunidades'], [4, 'linkedin', 'LinkedIn: conexão com nota personalizada'], [6, 'ligacao', 'Ligação 2: oportunidades abertas agora'], [9, 'email', 'E-mail 2: caso/estimativa do mercado (prova)'], [12, 'whatsapp', 'WhatsApp: lembrete curto + pergunta fechada'], [15, 'email', 'E-mail de encerramento ("posso fechar seu arquivo?")']] },
    inbound: { nome: 'Lead que chegou · 5 dias úteis', passos: [[0, 'ligacao', 'Ligar em até 5 min (velocidade de resposta)'], [0, 'whatsapp', 'WhatsApp de confirmação com agenda'], [1, 'ligacao', 'Ligação 2 se não atendeu'], [3, 'email', 'E-mail com 2 horários de reunião'], [5, 'whatsapp', 'WhatsApp final']] },
    pos_proposta: { nome: 'Follow-up de proposta · 10 dias úteis', passos: [[1, 'whatsapp', 'Confirmar recebimento e tirar dúvidas'], [3, 'ligacao', 'Revisar a proposta juntos (não por e-mail)'], [5, 'email', 'Reforço do ROI e da oportunidade aberta mais próxima'], [8, 'ligacao', 'Pergunta direta de decisão'], [10, 'whatsapp', 'Último contato antes de arquivar']] },
    reativacao: { nome: 'Reativação de perdidos · 90 dias', passos: [[0, 'email', 'Novidade do mercado dele (novas licitações)'], [30, 'whatsapp', 'Oportunidade específica aberta'], [60, 'ligacao', 'Ligação de reativação'], [90, 'email', 'Convite para novo estudo de mercado']] }
  };
  function gerarCadencia(chave, inicioISO) { const c = CADENCIAS[chave]; if (!c) return []; return c.passos.map(function (p) { return { tipo: p[1], titulo: p[2], data: p[0] ? somarUteis(inicioISO, p[0]) : inicioISO.slice(0, 10), feita: false, cadencia: chave }; }); }

  // ---------- scripts ----------
  function preencher(modelo, v) { return String(modelo || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, function (m, k) { return v[k] != null && v[k] !== '' ? v[k] : '[' + k + ']'; }); }

  // ---------- ROI da proposta ----------
  // custo interno: analista (salário × fator de encargos) × 12 + ferramentas; ganho: mercado × participação × margem.
  function roi(p) {
    const custoBPO = r2((Number(p.mensalidade) || 0) * 12 + (Number(p.implantacao) || 0));
    const custoInterno = r2((Number(p.salarioAnalista) || 0) * (Number(p.encargos) || 1.8) * 12 + (Number(p.ferramentas) || 0) * 12);
    const receita = r2((Number(p.mercadoAnual) || 0) * (Number(p.participacao) || 0) / 100);
    const lucro = r2(receita * (Number(p.margem) || 0) / 100);
    const exito = r2(receita * (Number(p.percExito) || 0) / 100);
    const custoTotal = r2(custoBPO + exito);
    return { custoBPO: custoBPO, custoExito: exito, custoTotal: custoTotal, custoInterno: custoInterno, economia: r2(custoInterno - custoBPO), receita: receita, lucro: lucro, retorno: custoTotal ? r2(lucro / custoTotal) : null, paybackMeses: lucro > 0 ? r2(custoBPO / (lucro / 12)) : null };
  }

  // ---------- estudo de mercado ----------
  const VAZIAS = 'de da do das dos e em para com sem por a o as os um uma na no nas nos ao aos comercio atacadista varejista varejo atacado fabricacao fabricante servicos servico outros outras outro nao especificados anteriormente exceto produtos produto artigos artigo em geral especializado especializada equipamentos ltda me epp eireli sa s a cia empresa comercio de atividades atividade'.split(' ');
  // Palavras-chave de busca: textos[0] = CNAE principal (peso 3), textos[1] = o que o cliente vende (peso 2), demais (peso 1).
  function palavrasChave(textos, n) {
    const cont = {}; (textos || []).forEach(function (t, peso) { normalizar(t).split(' ').forEach(function (w) { if (w.length < 4 || VAZIAS.indexOf(w) >= 0 || /^\d+$/.test(w)) return; cont[w] = (cont[w] || 0) + (peso === 0 ? 3 : peso === 1 ? 2 : 1); }); });
    return Object.keys(cont).sort(function (a, b) { return cont[b] - cont[a] || a.localeCompare(b); }).slice(0, n || 10);
  }
  // Lê o texto de um Cartão CNPJ (comprovante de inscrição da Receita) exportado em PDF.
  function lerCartaoCNPJ(texto) {
    const t = String(texto || '').replace(/\r/g, ''); const r = {};
    const cnpj = t.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/); if (cnpj) r.cnpj = cnpj[1].replace(/\D/g, '');
    const depois = function (rot, inicioDeLinha) { const m = t.match(new RegExp((inicioDeLinha ? '(?:^|\\n)\\s*' : '') + rot + '[^\\n]*\\n\\s*([^\\n]+)', 'i')); return m ? m[1].trim() : ''; };
    r.razao = depois('NOME EMPRESARIAL'); r.fantasia = depois('NOME DE FANTASIA\\)?').replace(/^\*+$/, '');
    const princ = t.match(/ATIVIDADE ECON[ÔO]MICA PRINCIPAL[^\n]*\n\s*(\d{2}\.\d{2}-\d-\d{2})\s*-\s*([^\n]+)/i); if (princ) r.cnaePrincipal = { codigo: princ[1], descricao: princ[2].trim() };
    const sec = t.match(/ATIVIDADES ECON[ÔO]MICAS SECUND[ÁA]RIAS[^\n]*\n([\s\S]*?)(?:C[ÓO]DIGO E DESCRI[ÇC][ÃA]O DA NATUREZA|NATUREZA JUR[ÍI]DICA|$)/i);
    r.cnaesSecundarios = sec ? (sec[1].match(/\d{2}\.\d{2}-\d-\d{2}\s*-\s*[^\n]+/g) || []).map(function (x) { const m = x.match(/(\d{2}\.\d{2}-\d-\d{2})\s*-\s*(.+)/); return { codigo: m[1], descricao: m[2].trim() }; }) : [];
    r.municipio = depois('MUNIC[ÍI]PIO'); const uf = t.match(/\bUF\b[^\n]*\n\s*([A-Z]{2})\b/); if (uf) r.uf = uf[1];
    const ab = t.match(/DATA DE ABERTURA[^\n]*\n\s*(\d{2}\/\d{2}\/\d{4})/i); if (ab) r.abertura = ab[1].split('/').reverse().join('-');
    r.situacao = depois('SITUA[ÇC][ÃA]O CADASTRAL', true); r.porte = depois('PORTE', true); // âncora no início da linha: o título do comprovante também cita "situação cadastral"
    return r;
  }
  function ranking(lista, chave, valor) { const m = {}; let total = 0; lista.forEach(function (x) { const k = chave(x); if (!k) return; const v = Number(valor(x)) || 0; m[k] = m[k] || { chave: k, qtd: 0, total: 0 }; m[k].qtd++; m[k].total += v; total += v; }); return Object.keys(m).map(function (k) { m[k].total = r2(m[k].total); m[k].participacao = total ? m[k].total / total : 0; return m[k]; }).sort(function (a, b) { return b.total - a.total || b.qtd - a.qtd; }); }
  // Curva ABC: A até 80% do valor acumulado, B até 95%, C o resto.
  function curvaABC(rank) { let ac = 0; return rank.map(function (r) { ac += r.participacao; return Object.assign({}, r, { acumulado: ac, classe: ac - r.participacao < 0.8 ? 'A' : ac - r.participacao < 0.95 ? 'B' : 'C' }); }); }
  function mediana(v) { const s = v.filter(isFinite).slice().sort(function (a, b) { return a - b; }); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  // d: { compras (encerradas/publicadas no período), amostras (itens homologados com vencedor), abertas, cliente: {cnpj, porte, uf}, meses, premissas: {participacao:[min,max], vitoria:[min,max]} }
  function analisarEstudo(d) {
    const meses = Math.max(1, Number(d.meses) || 12); const anual = 12 / meses; const P = Object.assign({ participacao: [2, 6], vitoria: [10, 20] }, d.premissas || {});
    const compras = d.compras || [], am = d.amostras || [], ab = d.abertas || [];
    const homolog = compras.filter(function (c) { return c.valorHomologado > 0; });
    const totHom = r2(homolog.reduce(function (s, c) { return s + c.valorHomologado; }, 0)); const totEst = r2(compras.reduce(function (s, c) { return s + (c.valorEstimado || 0); }, 0));
    const ticket = homolog.length ? r2(totHom / homolog.length) : null;
    const orgaos = curvaABC(ranking(compras, function (c) { return c.orgao; }, function (c) { return c.valorHomologado || c.valorEstimado; }));
    const ufs = ranking(compras, function (c) { return c.uf; }, function (c) { return c.valorHomologado || c.valorEstimado; });
    const modalidades = ranking(compras, function (c) { return c.modalidade; }, function (c) { return c.valorHomologado || c.valorEstimado; });
    const esferas = ranking(compras, function (c) { return { M: 'Municipal', E: 'Estadual', F: 'Federal', D: 'Distrital' }[c.esfera] || c.esfera; }, function (c) { return c.valorHomologado || c.valorEstimado; });
    const mesesMap = {}; compras.forEach(function (c) { const k = String(c.publicacao || '').slice(0, 7); if (k) mesesMap[k] = r2((mesesMap[k] || 0) + (c.valorHomologado || c.valorEstimado || 0)); });
    const conc = ranking(am, function (x) { return x.cnpjFornecedor ? x.cnpjFornecedor + '|' + x.fornecedor : null; }, function (x) { return x.total; }).map(function (r) { const p = r.chave.split('|'); const portes = am.filter(function (x) { return x.cnpjFornecedor === p[0]; }).map(function (x) { return x.porte; }); return Object.assign({}, r, { cnpj: p[0], nome: p.slice(1).join('|'), mepp: portes.some(function (x) { return x === 1 || x === 2 || x === '1' || x === '2'; }) }); });
    const top3 = conc.slice(0, 3).reduce(function (s, r) { return s + r.participacao; }, 0);
    const desagios = am.filter(function (x) { return x.referencia > 0 && x.unitario > 0; }).map(function (x) { return 1 - x.unitario / x.referencia; });
    const desagio = desagios.length ? mediana(desagios) : null;
    const meppShare = am.length ? am.filter(function (x) { return x.porte === 1 || x.porte === 2 || x.porte === '1' || x.porte === '2'; }).reduce(function (s, x) { return s + (x.total || 0); }, 0) / Math.max(1, am.reduce(function (s, x) { return s + (x.total || 0); }, 0)) : null;
    const cli = d.cliente && d.cliente.cnpj ? conc.find(function (r) { return r.cnpj === d.cliente.cnpj; }) : null;
    const abertasValor = r2(ab.reduce(function (s, c) { return s + (c.valorEstimado || 0); }, 0));
    // dimensionamento em duas vias, cada uma com premissas declaradas
    const mercadoAnual = r2(totHom * anual); const certamesAno = r2(homolog.length * anual);
    const td = [r2(mercadoAnual * P.participacao[0] / 100), r2(mercadoAnual * P.participacao[1] / 100)];
    const bu = ticket ? [r2(certamesAno * P.vitoria[0] / 100 * ticket * 0.5), r2(certamesAno * P.vitoria[1] / 100 * ticket * 0.5)] : [0, 0];
    const meio = function (f) { return (f[0] + f[1]) / 2; }; const div = meio(td) && meio(bu) ? Math.abs(meio(td) - meio(bu)) / Math.max(meio(td), meio(bu)) : null;
    const faixa = [Math.min(td[0], bu[0] || td[0]), Math.max(td[1], bu[1])];
    const premissas = [
      { id: 'P1', t: 'Anualização: valores do período (' + meses + ' meses) × ' + r2(anual) + '', base: 'Hipótese de demanda estável ao longo do ano; a sazonalidade está na seção 4', tipo: 'Hipótese' },
      { id: 'P2', t: 'Participação alcançável no mercado homologado: ' + P.participacao[0] + '–' + P.participacao[1] + '%', base: 'Hipótese para entrante com BPO; ajuste conforme histórico do cliente', tipo: 'Hipótese' },
      { id: 'P3', t: 'Taxa de vitória nos certames disputados: ' + P.vitoria[0] + '–' + P.vitoria[1] + '%', base: 'Hipótese; a concentração dos vencedores (seção 6) indica se é realista', tipo: 'Hipótese' },
      { id: 'P4', t: 'Fração do certame que o cliente atende: 50% do valor homologado médio', base: 'Hipótese: certames costumam ter itens fora do portfólio', tipo: 'Hipótese' }
    ];
    const sens = { td: [r2(td[0] * 0.7), r2(td[1] * 1.3)], bu: [r2(bu[0] * 0.7), r2(bu[1] * 1.3)] };
    const confianca = homolog.length >= 30 && am.length >= 30 && meses >= 6 ? 'Alta' : homolog.length >= 10 && am.length >= 10 ? 'Média' : 'Baixa';
    // decisão: volume, concorrência e oportunidades abertas
    let decisao, condicoes = [];
    if (mercadoAnual >= 1e6 && homolog.length * anual >= 20) decisao = top3 >= 0.6 ? 'Entrar com foco: mercado relevante, mas concentrado' : 'Entrar com prioridade: mercado relevante e pulverizado';
    else if (mercadoAnual >= 2e5 || ab.length >= 5) decisao = 'Entrar com foco em órgãos e itens específicos';
    else decisao = 'Não priorizar agora: ampliar estados, termos ou período antes de decidir';
    if (top3 >= 0.6) condicoes.push('três fornecedores concentram ' + Math.round(top3 * 100) + '% do valor: entrar por itens/órgãos onde eles não dominam');
    if (desagio != null) condicoes.push('preço precisa suportar deságio típico de ' + Math.round(desagio * 100) + '% sobre a referência');
    if (meppShare != null && d.cliente && /ME|EPP|MICRO|PEQUENO/i.test(d.cliente.porte || '')) condicoes.push('usar benefícios ME/EPP (cotas e itens exclusivos até R$ 80 mil)');
    if (ab.length) condicoes.push(ab.length + ' licitação(ões) com proposta aberta agora: primeira disputa já pode ser montada');
    if (confianca === 'Baixa') condicoes.push('amostra pequena: rodar de novo com mais estados ou 12+ meses antes de investir');
    return { meses: meses, numeros: { certames: compras.length, homologados: homolog.length, totalHomologado: totHom, totalEstimado: totEst, ticket: ticket, mercadoAnual: mercadoAnual, certamesAno: certamesAno, abertas: ab.length, abertasValor: abertasValor, amostras: am.length, orgaos: orgaos.length, fornecedores: conc.length }, orgaos: orgaos, ufs: ufs, modalidades: modalidades, esferas: esferas, meses_: mesesMap, concorrentes: conc, top3: top3, desagio: desagio, meppShare: meppShare, cliente: cli, estimativa: { topDown: td, bottomUp: bu, faixa: faixa, divergencia: div, sensibilidade: sens, premissas: premissas }, confianca: confianca, decisao: decisao, condicoes: condicoes };
  }

  // ---------- importar e exportar contas (leads e clientes) ----------
  // Cabeçalhos reconhecidos (já normalizados: sem acento, minúsculos). A ordem decide o empate.
  const CAMPOS_IMPORT = [
    { k: 'razao', t: 'Razão social', re: [/^razao/, /^empresa$/, /nome da empresa/, /^cliente$/, /^conta$/, /^lead$/, /organiza/, /^company/, /^empresa\b/] },
    { k: 'fantasia', t: 'Nome fantasia', re: [/fantasia/] },
    { k: 'cnpj', t: 'CNPJ', re: [/cnpj/, /^documento$/] },
    { k: 'municipio', t: 'Cidade', re: [/^cidade/, /municipio/] },
    { k: 'uf', t: 'UF', re: [/^uf$/, /^estado$/, /^estado uf/] },
    { k: 'porte', t: 'Porte', re: [/^porte/] },
    { k: 'segmento', t: 'Segmento', re: [/segmento/, /^ramo/, /^setor/, /^atividade/, /cnae/] },
    { k: 'site', t: 'Site', re: [/^site/, /website/, /^url$/] },
    { k: 'origem', t: 'Origem', re: [/^origem/, /^fonte/, /^canal/] },
    { k: 'tipo', t: 'Tipo (Lead/Cliente)', re: [/^tipo$/, /^categoria$/, /^classificacao$/] },
    { k: 'etapa', t: 'Etapa do funil', re: [/^etapa/, /^fase/, /^status/, /^estagio/] },
    { k: 'mensalidade', t: 'Mensalidade', re: [/mensalidade/, /valor mensal/, /^mrr$/, /^valor$/] },
    { k: 'meses', t: 'Meses de contrato', re: [/^meses/, /^prazo/] },
    { k: 'implantacao', t: 'Implantação', re: [/implantacao/, /^setup/] },
    { k: 'contato', t: 'Contato', re: [/^contato$/, /nome do contato/, /^responsavel/, /^decisor/, /^nome$/] },
    { k: 'cargo', t: 'Cargo', re: [/^cargo/, /^funcao/] },
    { k: 'papel', t: 'Papel na decisão', re: [/^papel/] },
    { k: 'email', t: 'E-mail', re: [/e ?mail/] },
    { k: 'telefone', t: 'Telefone', re: [/^telefone/, /^fone/, /^tel$/] },
    { k: 'whatsapp', t: 'WhatsApp', re: [/whats/, /^celular/, /^zap/] },
    { k: 'observacoes', t: 'Observações', re: [/observ/, /^notas?$/, /coment/] }
  ];
  function mapearColunas(cabecalho) {
    const cab = (cabecalho || []).map(normalizar); const usados = {}; const mapa = {};
    CAMPOS_IMPORT.forEach(function (c) {
      for (const re of c.re) { const i = cab.findIndex(function (h, k) { return h && !usados[k] && re.test(h); }); if (i >= 0) { mapa[c.k] = i; usados[i] = 1; break; } }
    });
    // "Nome" sozinho é a empresa quando não há outra coluna de empresa
    if (mapa.razao == null && mapa.contato != null && cab[mapa.contato] === 'nome') { mapa.razao = mapa.contato; delete mapa.contato; }
    return mapa;
  }
  function numeroBR(v) { if (typeof v === 'number') return v; let t = String(v == null ? '' : v).replace(/[R$\s]/g, ''); if (!t) return null; if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.'); const n = Number(t); return isFinite(n) ? n : null; }
  function cnpjValido(c) {
    const d = String(c || '').replace(/\D/g, ''); if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    const dv = function (n) { const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const s = pesos.reduce(function (t, p, i) { return t + p * Number(d[i]); }, 0) % 11; return s < 2 ? 0 : 11 - s; };
    return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
  }
  // Texto livre da etapa → id. "Cliente" no tipo vira "ganho".
  function etapaDeTexto(etapaTxt, tipoTxt) {
    const t = normalizar(etapaTxt); const tipo = normalizar(tipoTxt);
    if (t) {
      const direto = ETAPAS.find(function (e) { return normalizar(e.nome) === t || e.id === t; }); if (direto) return direto.id;
      if (/ganh|fechad|cliente|ativo|assinad/.test(t)) return 'ganho';
      if (/perd|descart|cancel|inativ/.test(t)) return 'perdido';
      if (/negoci/.test(t)) return 'negociacao';
      if (/propost/.test(t)) return 'proposta';
      if (/estudo|apresenta/.test(t)) return 'estudo';
      if (/diagn|reuniao|qualific/.test(t)) return 'diagnostico';
      if (/contat|conversa|abordad/.test(t)) return 'contato';
      if (/lead|novo|prospect/.test(t)) return 'lead';
    }
    if (/cliente/.test(tipo)) return 'ganho';
    return 'lead';
  }
  function chaveConta(c) { const d = String(c.cnpj || '').replace(/\D/g, ''); return d.length === 14 ? 'cnpj:' + d : 'nome:' + normalizar(c.razao || c.fantasia) + '|' + String(c.uf || '').toUpperCase(); }
  // linhas = matriz (1ª linha = cabeçalho). Devolve o que será criado, atualizado e o que tem problema, sem gravar nada.
  function prepararImportacao(linhas, contasExistentes, mapa) {
    linhas = (linhas || []).filter(function (l) { return l && l.some(function (c) { return String(c == null ? '' : c).trim(); }); });
    if (!linhas.length) return { mapa: {}, itens: [], novos: 0, atualizar: 0, erros: 0 };
    mapa = mapa || mapearColunas(linhas[0]);
    const idx = {}; (contasExistentes || []).forEach(function (c) { idx[chaveConta(c)] = c; });
    const vistos = {}; const itens = [];
    linhas.slice(1).forEach(function (l, i) {
      const v = function (k) { return mapa[k] == null ? '' : String(l[mapa[k]] == null ? '' : l[mapa[k]]).trim(); };
      const conta = { razao: v('razao') || v('fantasia'), fantasia: v('fantasia'), cnpj: v('cnpj').replace(/\D/g, ''), municipio: v('municipio'), uf: v('uf').toUpperCase().slice(0, 2), porte: v('porte'), segmento: v('segmento'), site: v('site'), origem: v('origem') };
      const contato = { nome: v('contato'), cargo: v('cargo'), papel: v('papel') || 'Decisor', email: v('email'), telefone: v('telefone'), whatsapp: v('whatsapp') };
      const negocio = { etapa: etapaDeTexto(v('etapa'), v('tipo')), mensalidade: numeroBR(v('mensalidade')), meses: numeroBR(v('meses')) || null, implantacao: numeroBR(v('implantacao')) };
      const item = { linha: i + 2, conta: conta, contato: contato.nome || contato.email || contato.telefone || contato.whatsapp ? contato : null, negocio: negocio, observacoes: v('observacoes'), problemas: [] };
      if (!conta.razao) item.erro = 'sem nome da empresa';
      else {
        if (conta.cnpj && !cnpjValido(conta.cnpj)) { item.problemas.push('CNPJ inválido (importado sem CNPJ)'); conta.cnpj = ''; }
        if (contato.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contato.email)) { item.problemas.push('e-mail inválido'); contato.email = ''; }
        const k = chaveConta(conta);
        if (vistos[k]) item.erro = 'repetida na planilha (linha ' + vistos[k] + ')';
        else { vistos[k] = item.linha; item.existente = idx[k] ? idx[k].id : null; }
      }
      itens.push(item);
    });
    return { mapa: mapa, itens: itens, novos: itens.filter(function (x) { return !x.erro && !x.existente; }).length, atualizar: itens.filter(function (x) { return !x.erro && x.existente; }).length, erros: itens.filter(function (x) { return x.erro; }).length };
  }
  const COLUNAS_EXPORT = ['Tipo', 'Razão social', 'Nome fantasia', 'CNPJ', 'Cidade', 'UF', 'Porte', 'Segmento', 'Site', 'Origem', 'Etapa', 'Mensalidade', 'Meses', 'Implantação', 'Valor do contrato', 'Contato', 'Cargo', 'Papel', 'E-mail', 'Telefone', 'WhatsApp', 'ICP', 'Criada em'];
  function tipoConta(etapaId) { return etapaId === 'ganho' ? 'Cliente' : etapaId === 'perdido' ? 'Perdido' : 'Lead'; }
  function cnpjFormatado(d) { d = String(d || '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d; }
  // Uma linha por conta, com o negócio mais avançado e o contato decisor; quem reimporta o arquivo recupera tudo isso.
  function linhasExportacao(contas, negocios, filtro) {
    const ordem = ETAPAS.map(function (e) { return e.id; });
    const out = [COLUNAS_EXPORT.slice()];
    (contas || []).forEach(function (c) {
      const ns = (negocios || []).filter(function (n) { return n.contaId === c.id; }).sort(function (a, b) { return (a.etapa === 'perdido') - (b.etapa === 'perdido') || ordem.indexOf(b.etapa) - ordem.indexOf(a.etapa); });
      const n = ns[0] || {}; const tipo = tipoConta(n.etapa || 'lead');
      if (filtro && filtro !== 'todos' && normalizar(filtro) !== normalizar(tipo)) return;
      const ct = (c.contatos || []).find(function (x) { return x.papel === 'Decisor'; }) || (c.contatos || [])[0] || {};
      out.push([tipo, c.razao || '', c.fantasia || '', cnpjFormatado(c.cnpj), c.municipio || '', c.uf || '', c.porte || '', c.segmento || '', c.site || '', c.origem || '', n.etapa ? etapa(n.etapa).nome : '', n.mensalidade != null ? Number(n.mensalidade) : '', n.meses || '', n.implantacao != null ? Number(n.implantacao) : '', n.id ? valorNegocio(n) : '', ct.nome || '', ct.cargo || '', ct.papel || '', ct.email || '', ct.telefone || '', ct.whatsapp || '', icp(c).faixa, String(c.criadoEm || '').slice(0, 10)]);
    });
    return out;
  }

  return { CAMPOS_IMPORT: CAMPOS_IMPORT, mapearColunas: mapearColunas, numeroBR: numeroBR, cnpjValido: cnpjValido, etapaDeTexto: etapaDeTexto, chaveConta: chaveConta, prepararImportacao: prepararImportacao, COLUNAS_EXPORT: COLUNAS_EXPORT, tipoConta: tipoConta, linhasExportacao: linhasExportacao,
    ETAPAS: ETAPAS, MOTIVOS_PERDA: MOTIVOS_PERDA, valorNegocio: valorNegocio, etapa: etapa, probabilidade: probabilidade, metricas: metricas, ICP: ICP, icp: icp, CADENCIAS: CADENCIAS, gerarCadencia: gerarCadencia, somarUteis: somarUteis, preencher: preencher, roi: roi, palavrasChave: palavrasChave, lerCartaoCNPJ: lerCartaoCNPJ, ranking: ranking, curvaABC: curvaABC, mediana: mediana, analisarEstudo: analisarEstudo, normalizar: normalizar, dias: dias };
});
