/* Plataforma 7 — cliente da API pública do PNCP (dados abertos, sem login). */
(function () {
  'use strict';
  const CONSULTA = 'https://pncp.gov.br/api/consulta/v1';
  const PNCP = 'https://pncp.gov.br/api/pncp/v1';

  const MODALIDADES = {
    1: 'Leilão - Eletrônico', 2: 'Diálogo Competitivo', 3: 'Concurso', 4: 'Concorrência - Eletrônica',
    5: 'Concorrência - Presencial', 6: 'Pregão - Eletrônico', 7: 'Pregão - Presencial', 8: 'Dispensa',
    9: 'Inexigibilidade', 10: 'Manifestação de Interesse', 11: 'Pré-qualificação', 12: 'Credenciamento', 13: 'Leilão - Presencial'
  };
  const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

  async function obter(url, tentativas) {
    tentativas = tentativas == null ? 4 : tentativas;
    for (let i = 0; i < tentativas; i++) {
      try {
        const r = await fetch(url, { headers: { Accept: 'application/json' } });
        if (r.status === 204) return null;
        if (r.status === 429 || r.status >= 500) throw new Error('PNCP respondeu ' + r.status);
        if (!r.ok) { const e = new Error('PNCP respondeu ' + r.status); e.definitivo = true; throw e; }
        const txt = await r.text();
        return txt ? JSON.parse(txt) : null;
      } catch (e) {
        if (e.definitivo || i === tentativas - 1) throw e;
        await new Promise(function (ok) { setTimeout(ok, 800 * Math.pow(2, i)); });
      }
    }
  }

  function qs(o) {
    return Object.keys(o).filter(function (k) { return o[k] !== undefined && o[k] !== null && o[k] !== ''; })
      .map(function (k) { return k + '=' + encodeURIComponent(o[k]); }).join('&');
  }

  // Executa tarefas com no máximo `n` simultâneas.
  async function emLotes(itens, n, fn) {
    const saida = new Array(itens.length); let i = 0;
    async function trabalhador() { while (i < itens.length) { const k = i++; try { saida[k] = await fn(itens[k], k); } catch (e) { saida[k] = { erro: e }; } } }
    await Promise.all(Array.from({ length: Math.min(n, itens.length) }, trabalhador));
    return saida;
  }

  function idCompra(c) { return c.numeroControlePNCP || (c.orgaoEntidade.cnpj + '-' + c.anoCompra + '-' + c.sequencialCompra); }

  function linkEdital(c) {
    return 'https://pncp.gov.br/app/editais/' + c.orgaoEntidade.cnpj + '/' + c.anoCompra + '/' + c.sequencialCompra;
  }

  // Reduz o registro do PNCP ao que o app usa (guardar menos no navegador).
  function resumoCompra(c) {
    return {
      id: idCompra(c), cnpj: c.orgaoEntidade.cnpj, ano: c.anoCompra, seq: c.sequencialCompra,
      orgao: c.orgaoEntidade.razaoSocial, esfera: c.orgaoEntidade.esferaId, unidade: c.unidadeOrgao && c.unidadeOrgao.nomeUnidade, uasg: c.unidadeOrgao && c.unidadeOrgao.codigoUnidade,
      municipio: c.unidadeOrgao && c.unidadeOrgao.municipioNome, uf: c.unidadeOrgao && c.unidadeOrgao.ufSigla,
      ibge: c.unidadeOrgao && c.unidadeOrgao.codigoIbge,
      objeto: c.objetoCompra, info: c.informacaoComplementar, modalidadeId: c.modalidadeId, modalidade: c.modalidadeNome,
      modo: c.modoDisputaNome, numero: c.numeroCompra, processo: c.processo, srp: !!c.srp,
      situacao: c.situacaoCompraNome, valorEstimado: c.valorTotalEstimado, valorHomologado: c.valorTotalHomologado,
      abertura: c.dataAberturaProposta, encerramento: c.dataEncerramentoProposta, publicacao: c.dataPublicacaoPncp,
      atualizacao: c.dataAtualizacaoGlobal || c.dataAtualizacao, linkOrigem: c.linkSistemaOrigem || c.linkProcessoEletronico || '',
      sistema: c.usuarioNome, amparo: c.amparoLegal && c.amparoLegal.nome, edital: linkEdital(c)
    };
  }

  // Todas as páginas de uma consulta paginada (limite de páginas para não martelar a API).
  async function paginar(caminho, params, maxPaginas, aoProgresso) {
    const primeira = await obter(CONSULTA + caminho + '?' + qs(Object.assign({}, params, { pagina: 1, tamanhoPagina: 50 })));
    if (!primeira) return [];
    let dados = primeira.data || [];
    const total = Math.min(primeira.totalPaginas || 1, maxPaginas || 40);
    if (aoProgresso) aoProgresso(1, total);
    const resto = [];
    for (let p = 2; p <= total; p++) resto.push(p);
    let feitas = 1;
    const paginas = await emLotes(resto, 2, async function (p) {
      const r = await obter(CONSULTA + caminho + '?' + qs(Object.assign({}, params, { pagina: p, tamanhoPagina: 50 })));
      feitas++; if (aoProgresso) aoProgresso(feitas, total);
      return r;
    });
    paginas.forEach(function (r) { if (r && r.data) dados = dados.concat(r.data); });
    return { dados: dados, truncado: (primeira.totalPaginas || 1) > total, totalRegistros: primeira.totalRegistros };
  }

  // Licitações com recebimento de proposta em aberto, por UF e modalidade.
  async function propostasAbertas(opcoes, aoProgresso) {
    const ufs = opcoes.ufs && opcoes.ufs.length ? opcoes.ufs : [''];
    const mods = opcoes.modalidades && opcoes.modalidades.length ? opcoes.modalidades : [6, 8, 4];
    const combos = [];
    ufs.forEach(function (uf) { mods.forEach(function (m) { combos.push({ uf: uf, m: m }); }); });
    const dataFinal = Nucleo.yyyymmdd(new Date(Date.now() + 365 * 86400000));
    let feitos = 0; let truncado = false;
    const res = await emLotes(combos, 2, async function (c) {
      const r = await paginar('/contratacoes/proposta', { dataFinal: dataFinal, codigoModalidadeContratacao: c.m, uf: c.uf, codigoMunicipioIbge: opcoes.ibge }, opcoes.maxPaginas || 20);
      feitos++; if (aoProgresso) aoProgresso(feitos, combos.length);
      if (r && r.truncado) truncado = true;
      return r ? r.dados : [];
    });
    const mapa = {};
    res.forEach(function (lista) { (Array.isArray(lista) ? lista : []).forEach(function (c) { const x = resumoCompra(c); mapa[x.id] = x; }); });
    const erros = res.filter(function (r) { return r && r.erro; }).length;
    return { lista: Object.keys(mapa).map(function (k) { return mapa[k]; }), truncado: truncado, erros: erros };
  }

  // Contratações publicadas num período (para Análise de Mercado).
  async function publicadas(opcoes, aoProgresso) {
    const mods = opcoes.modalidades && opcoes.modalidades.length ? opcoes.modalidades : [6];
    const ufs = opcoes.ufs && opcoes.ufs.length ? opcoes.ufs : [''];
    const janelas = janelasMensais(opcoes.inicio, opcoes.fim);
    const combos = [];
    janelas.forEach(function (j) { ufs.forEach(function (uf) { mods.forEach(function (m) { combos.push({ j: j, uf: uf, m: m }); }); }); });
    let feitos = 0; let truncado = false;
    const res = await emLotes(combos, 2, async function (c) {
      const r = await paginar('/contratacoes/publicacao', { dataInicial: c.j[0], dataFinal: c.j[1], codigoModalidadeContratacao: c.m, uf: c.uf }, opcoes.maxPaginas || 30);
      feitos++; if (aoProgresso) aoProgresso(feitos, combos.length);
      if (r && r.truncado) truncado = true;
      return r ? r.dados : [];
    });
    const mapa = {};
    res.forEach(function (lista) { (Array.isArray(lista) ? lista : []).forEach(function (c) { const x = resumoCompra(c); mapa[x.id] = x; }); });
    return { lista: Object.keys(mapa).map(function (k) { return mapa[k]; }), truncado: truncado, erros: res.filter(function (r) { return r && r.erro; }).length };
  }

  function janelasMensais(inicio, fim) {
    const out = []; let a = new Date(inicio + 'T00:00:00'); const f = new Date(fim + 'T00:00:00');
    while (a <= f) {
      const b = new Date(a.getFullYear(), a.getMonth() + 1, 0);
      out.push([Nucleo.yyyymmdd(a), Nucleo.yyyymmdd(b < f ? b : f)]);
      a = new Date(a.getFullYear(), a.getMonth() + 1, 1);
    }
    return out;
  }

  async function compra(cnpj, ano, seq) {
    const c = await obter(CONSULTA + '/orgaos/' + cnpj + '/compras/' + ano + '/' + seq);
    return c ? resumoCompra(c) : null;
  }

  async function itens(cnpj, ano, seq) {
    let todos = []; let p = 1;
    for (;;) {
      const r = await obter(PNCP + '/orgaos/' + cnpj + '/compras/' + ano + '/' + seq + '/itens?pagina=' + p + '&tamanhoPagina=500');
      if (!r || !r.length) break;
      todos = todos.concat(r); if (r.length < 500) break; p++;
    }
    return todos.map(function (i) {
      return {
        numero: i.numeroItem, descricao: i.descricao, quantidade: i.quantidade, unidade: i.unidadeMedida,
        refUnitaria: i.orcamentoSigiloso ? null : i.valorUnitarioEstimado, total: i.orcamentoSigiloso ? null : i.valorTotal, sigiloso: !!i.orcamentoSigiloso,
        grupo: i.numeroGrupo != null ? i.numeroGrupo : i.grupo != null ? i.grupo : null,
        tipo: i.materialOuServicoNome, criterio: i.criterioJulgamentoNome, beneficio: i.tipoBeneficioNome,
        meEpp: i.tipoBeneficio === 1 ? 'Exclusivo ME/EPP' : i.tipoBeneficio === 2 || i.tipoBeneficio === 3 ? 'Parcial ME/EPP' : '',
        margem: !!(i.aplicabilidadeMargemPreferenciaNormal || i.aplicabilidadeMargemPreferenciaAdicional),
        situacao: i.situacaoCompraItemNome, temResultado: !!i.temResultado
      };
    });
  }

  async function resultados(cnpj, ano, seq, numeroItem) {
    const r = await obter(PNCP + '/orgaos/' + cnpj + '/compras/' + ano + '/' + seq + '/itens/' + numeroItem + '/resultados');
    return (r || []).map(function (x) {
      return { fornecedor: x.nomeRazaoSocialFornecedor, cnpj: x.niFornecedor, porte: x.porteFornecedorId, unitario: x.valorUnitarioHomologado, quantidade: x.quantidadeHomologada, total: x.valorTotalHomologado, data: x.dataResultado, desconto: x.percentualDesconto };
    });
  }

  async function arquivos(cnpj, ano, seq) {
    const r = await obter(PNCP + '/orgaos/' + cnpj + '/compras/' + ano + '/' + seq + '/arquivos');
    return (r || []).filter(function (a) { return a.statusAtivo !== false; }).map(function (a) { return { titulo: a.titulo, tipo: a.tipoDocumentoNome, url: a.url, data: a.dataPublicacaoPncp }; });
  }

  // Aceita link do PNCP (app/editais/CNPJ/ANO/SEQ), número de controle (CNPJ-1-SEQ/ANO) ou "CNPJ ANO SEQ".
  function lerReferencia(t) {
    const s = String(t || '').trim();
    let m = s.match(/(\d{14})\/(\d{4})\/(\d+)/);
    if (m) return { cnpj: m[1], ano: +m[2], seq: +m[3] };
    m = s.match(/(\d{14})-\d-0*(\d+)\/(\d{4})/);
    if (m) return { cnpj: m[1], ano: +m[3], seq: +m[2] };
    m = s.replace(/[.\-/]/g, '').match(/(\d{14})\D+(\d{4})\D+(\d+)/);
    if (m) return { cnpj: m[1], ano: +m[2], seq: +m[3] };
    return null;
  }

  self.PNCP = {
    MODALIDADES: MODALIDADES, UFS: UFS, propostasAbertas: propostasAbertas, publicadas: publicadas, compra: compra,
    itens: itens, resultados: resultados, arquivos: arquivos, lerReferencia: lerReferencia, emLotes: emLotes, linkEdital: linkEdital
  };
})();
