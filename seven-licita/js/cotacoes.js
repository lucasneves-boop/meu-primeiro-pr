/* Regras de cotação com fornecedores: leitura do edital, mensagens, mapa comparativo, follow-up e indicadores. Puro, testável no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Cotacoes = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normalizar(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim(); }
  function numeroBR(t) {
    if (typeof t === 'number') return isFinite(t) ? t : null;
    let s = String(t == null ? '' : t).replace(/R\$|\s/g, '').trim(); if (!s) return null;
    if (/,\d{1,4}$/.test(s) || /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
    const n = Number(s); return isFinite(n) ? n : null;
  }
  const UNIDADES = ['UNIDADE', 'UNID', 'UND', 'UN', 'UNI', 'CAIXA', 'CX', 'PACOTE', 'PCT', 'PC', 'PÇ', 'PECA', 'PEÇA', 'KG', 'QUILO', 'G', 'GR', 'LITRO', 'LT', 'L', 'ML', 'METRO', 'MT', 'M', 'M2', 'M²', 'M3', 'M³', 'RESMA', 'RS', 'FRASCO', 'FR', 'GALAO', 'GALÃO', 'GL', 'ROLO', 'RL', 'PAR', 'JOGO', 'JG', 'KIT', 'SACO', 'SC', 'TUBO', 'TB', 'DUZIA', 'DÚZIA', 'DZ', 'CENTO', 'CT', 'MILHEIRO', 'MIL', 'BLOCO', 'BL', 'CARTELA', 'FARDO', 'FD', 'LATA', 'BALDE', 'BD', 'BOMBONA', 'AMPOLA', 'AMP', 'COMPRIMIDO', 'CP', 'ENVELOPE', 'TONELADA', 'TON', 'HORA', 'HR', 'H', 'DIARIA', 'DIÁRIA', 'MES', 'MÊS', 'ANO', 'SERVIÇO', 'SERVICO', 'SV', 'SERV', 'EVENTO', 'VB', 'VERBA', 'CJ', 'CONJUNTO', 'UNIT', 'EMB', 'EMBALAGEM', 'POTE', 'BISNAGA', 'CAPSULA', 'FOLHA', 'FL', 'BOBINA', 'GARRAFA', 'GARRAFAO', 'GARRAFÃO', 'REFIL', 'CARGA', 'CARTUCHO', 'TONER', 'DISPLAY', 'SERINGA', 'VIDRO', 'BARRA', 'PLACA', 'BOLSA', 'LICENÇA', 'LICENCA', 'MODULO', 'MÓDULO', 'KM', 'M²/MÊS', 'POSTO', 'PESSOA'];
  const UN_RE = UNIDADES.slice().sort(function (a, b) { return b.length - a.length; }).map(function (u) { return u.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'); }).join('|');

  // ---------- edital ----------
  function extrairCabecalho(texto) {
    const t = String(texto || ''); const umaLinha = t.replace(/[ \t]+/g, ' ');
    const r = {};
    const mod = umaLinha.match(/(PREG[ÃA]O\s+ELETR[ÔO]NICO|PREG[ÃA]O\s+PRESENCIAL|DISPENSA\s+(?:ELETR[ÔO]NICA|DE\s+LICITA[ÇC][ÃA]O)|CONCORR[ÊE]NCIA(?:\s+ELETR[ÔO]NICA)?|PREG[ÃA]O|CHAMAMENTO\s+P[ÚU]BLICO|COTA[ÇC][ÃA]O\s+ELETR[ÔO]NICA)\s*(?:SRP\s*)?(?:N[º°o.]*\s*:?\s*)?(\d{1,6}\s*\/\s*\d{4})/i);
    if (mod) { r.modalidade = mod[1].replace(/\s+/g, ' ').trim(); r.numero = mod[2].replace(/\s/g, ''); }
    const proc = umaLinha.match(/PROCESSO(?:\s+ADMINISTRATIVO)?\s*(?:N[º°o.]*\s*)?:?\s*([\d.\-\/]{4,30}\d)/i); if (proc) r.processo = proc[1];
    const uasg = umaLinha.match(/UASG\s*:?\s*(?:N[º°o.]*\s*)?(\d{6})/i); if (uasg) r.uasg = uasg[1];
    const orgaoRe = /^(?:.*?)((?:PREFEITURA MUNICIPAL|MUNIC[ÍI]PIO|C[ÂA]MARA MUNICIPAL|GOVERNO DO ESTADO|ESTADO D[EOA]|SECRETARIA|MINIST[ÉE]RIO|TRIBUNAL|UNIVERSIDADE|INSTITUTO FEDERAL|FUNDA[ÇC][ÃA]O|FUNDO MUNICIPAL|CONS[ÓO]RCIO|SERVI[ÇC]O AUT[ÔO]NOMO|EMPRESA BRASILEIRA|COMANDO|HOSPITAL|DEPARTAMENTO)[^\n]{3,120})$/im;
    const org = t.match(orgaoRe); if (org) r.orgao = org[1].replace(/\s+/g, ' ').replace(/[\s,.;:-]+$/, '').trim();
    const data = umaLinha.match(/(?:abertura|sess[ãa]o\s+p[úu]blica|data\s+da\s+sess[ãa]o|in[íi]cio\s+da\s+(?:sess[ãa]o|disputa)|data\s+de\s+abertura|realiza[çc][ãa]o)[^\d]{0,90}(\d{2})\/(\d{2})\/(\d{4})(?:[^\d]{0,25}(\d{1,2})\s*[:hH]\s*(\d{2}))?/i);
    if (data) r.dataSessao = data[3] + '-' + data[2] + '-' + data[1] + (data[4] ? 'T' + ('0' + data[4]).slice(-2) + ':' + data[5] : '');
    const obj = t.match(/OBJETO\s*(?:DA\s+LICITA[ÇC][ÃA]O\s*)?[:\-–.]?\s*\n?\s*([\s\S]{20,700}?)(?:\n\s*\n|\n\s*\d+(?:\.\d+)*\s*[\.\-–)]?\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]|$)/i);
    if (obj) r.objeto = obj[1].replace(/\s+/g, ' ').replace(/^[\d.\s]+/, '').replace(/^(?:o\s+)?objeto\s+(?:d[aoe]s?\s+(?:presente\s+)?(?:licita[çc][ãa]o|edital|preg[ãa]o|certame|contrata[çc][ãa]o|aviso)\s+)?(?:[ée]|consiste\s+(?:em|na|no)|ser[áa])\s+(?:a\s+|o\s+)?/i, '').trim().slice(0, 600);
    const entrega = umaLinha.match(/local\s+de\s+entrega\s*[:\-–]?\s*([^\n]{10,220}?)(?:\.\s|;|\n|$)/i); if (entrega) r.localEntrega = entrega[1].trim();
    const prazoE = umaLinha.match(/prazo\s+(?:m[áa]ximo\s+)?(?:de|para)\s+(?:a\s+)?entrega[^.\d]{0,60}?(\d{1,3})\s*(?:\([^)]{0,30}\)\s*)?dias(\s+[úu]teis|\s+corridos)?/i); if (prazoE) r.prazoEntrega = prazoE[1] + ' dias' + (prazoE[2] ? prazoE[2].replace(/\s+/, ' ') : '');
    const portais = [['Compras.gov.br', /compras\.gov\.br|comprasnet|comprasgovernamentais|gov\.br\/compras/i], ['BLL', /bll\s*compras|bllcompras|\bBLL\b/i], ['Licitanet', /licitanet/i], ['Portal de Compras Públicas', /portal\s+de\s+compras\s+p[úu]blicas|portaldecompraspublicas/i], ['BNC', /\bBNC\b|bnccompras/i], ['Licitações-e', /licitacoes-e|licita[çc][õo]es-e/i], ['SISLOG-GO', /sislog|comprasnet\.go/i], ['Licitar Digital', /licitar\s*digital/i], ['Compras Públicas', /compras\s*p[úu]blicas/i]];
    for (const p of portais) if (p[1].test(umaLinha)) { r.portal = p[0]; break; }
    const cnpj = umaLinha.match(/CNPJ\s*(?:N[º°o.]*\s*)?:?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i); if (cnpj) r.cnpjOrgao = cnpj[1].replace(/\D/g, '');
    const cidade = umaLinha.match(/(?:munic[íi]pio\s+de|prefeitura\s+municipal\s+de)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú' ]{2,40}?)(?:\s*[-–\/]\s*([A-Z]{2})\b|[,.\n])/i); if (cidade) { r.cidade = cidade[1].trim(); if (cidade[2]) r.uf = cidade[2]; }
    return r;
  }

  // Encontra itens em textos de edital/termo de referência: "1  Descrição ...  UN  10  R$ 5,00".
  function extrairItens(texto) {
    const t = String(texto || '').replace(/\r/g, '').replace(/[ \t ]+/g, ' ');
    const loteDe = []; const reLote = /\b(LOTE|GRUPO)\s*(?:N[º°o.]*\s*)?(\d{1,3})\b/gi; let ml; while ((ml = reLote.exec(t))) loteDe.push({ i: ml.index, n: ml[2] });
    const achados = [];
    const qtd = '(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?)';
    const preco = '(?:\\s+(?:R\\$\\s*)?(\\d{1,3}(?:\\.\\d{3})*,\\d{2,4}))?(?:\\s+(?:R\\$\\s*)?(\\d{1,3}(?:\\.\\d{3})*,\\d{2}))?';
    const padroes = [
      // item, descrição, unidade, quantidade
      new RegExp('(?:^|\\n)\\s*(\\d{1,4})\\s*[.\\-–)|]?\\s+([^\\n]{3,400}?(?:\\n(?!\\s*\\d{1,4}\\s*[.\\-–)|]?\\s)(?!\\s*(?:LOTE|GRUPO)\\b)[^\\n]{1,300}?){0,2}?)\\s+(' + UN_RE + ')\\.?\\s+' + qtd + preco + '\\s*(?=\\n|$)', 'gi'),
      // item, descrição, quantidade, unidade
      new RegExp('(?:^|\\n)\\s*(\\d{1,4})\\s*[.\\-–)|]?\\s+([^\\n]{3,400}?(?:\\n(?!\\s*\\d{1,4}\\s*[.\\-–)|]?\\s)(?!\\s*(?:LOTE|GRUPO)\\b)[^\\n]{1,300}?){0,2}?)\\s+' + qtd + '\\s+(' + UN_RE + ')\\.?' + preco + '\\s*(?=\\n|$)', 'gi')
    ];
    padroes.forEach(function (re, k) {
      let m; re.lastIndex = 0;
      while ((m = re.exec(t))) {
        const un = k === 0 ? m[3] : m[4], q = k === 0 ? m[4] : m[3];
        const desc = m[2].replace(/\s*\n\s*/g, ' ').trim();
        if (/^(de|do|da|dias?|horas?)\b/i.test(desc) || desc.length < 3) continue;
        const ref = numeroBR(m[5]), tot = numeroBR(m[6]), qn = numeroBR(q);
        // pontua a leitura: quantidade × unitário = total confirma; quantidade com centavos é suspeita
        const nota = (tot != null && ref != null && Math.abs(qn * ref - tot) <= Math.max(0.05, tot * 0.01) ? 2 : 0) - (/,\d{2}$/.test(q) ? 1 : 0);
        achados.push({ pos: m.index, n: Number(m[1]), descricao: desc, unidade: un.toUpperCase(), quantidade: qn, valorRef: ref != null ? ref : null, totalRef: tot != null ? tot : null, nota: nota });
        re.lastIndex = m.index + 1;
      }
    });
    achados.sort(function (a, b) { return a.pos - b.pos || b.nota - a.nota; });
    // mantém sequências coerentes (1, 2, 3...) por lote e descarta números de cláusulas soltos
    const saida = []; const vistos = {};
    achados.forEach(function (a) {
      let lote = ''; loteDe.forEach(function (l) { if (l.i < a.pos) lote = l.n; });
      const chave = lote + '|' + a.n; if (vistos[chave]) return;
      const ant = saida.filter(function (x) { return x.lote === lote; }).pop();
      if (ant && a.n <= ant.n) return;
      if (!ant && a.n > 20 && !lote) return;
      vistos[chave] = true; a.lote = lote; saida.push(a);
    });
    return saida.map(function (a) { return { n: a.n, lote: a.lote, descricao: a.descricao, unidade: a.unidade, quantidade: a.quantidade, valorRef: a.valorRef != null ? a.valorRef : (a.totalRef && a.quantidade ? a.totalRef / a.quantidade : null) }; });
  }

  // Linhas de planilha (matriz) → itens, detectando o cabeçalho.
  function itensDePlanilha(linhas) {
    const L = (linhas || []).map(function (l) { return (l || []).map(function (c) { return c == null ? '' : c; }); });
    let h = -1, col = {};
    for (let i = 0; i < Math.min(L.length, 40); i++) {
      const n = L[i].map(normalizar); const c = {};
      n.forEach(function (x, j) {
        if (c.desc == null && /descri|especifica|produto|objeto|material/.test(x)) c.desc = j;
        else if (c.qtd == null && /^(qtd|qtde|quant|quantidade)/.test(x)) c.qtd = j;
        else if (c.un == null && /^(un|und|unid|unidade|medida|u m|um)\b/.test(x)) c.un = j;
        else if (c.item == null && /^(item|it|n|n o|no|nº|lote item|seq|cod item)$/.test(x)) c.item = j;
        else if (c.lote == null && /^(lote|grupo)$/.test(x)) c.lote = j;
        else if (c.ref == null && /(unit|valor estimado|preco estimado|valor medio|preco medio|referencia|vlr unit)/.test(x) && !/total/.test(x)) c.ref = j;
        else if (c.marca == null && /^marca/.test(x)) c.marca = j;
      });
      if (c.desc != null && c.qtd != null) { h = i; col = c; break; }
    }
    if (h < 0) return [];
    const out = []; let seq = 0;
    for (let i = h + 1; i < L.length; i++) {
      const r = L[i]; const d = String(r[col.desc] || '').trim(); const q = numeroBR(r[col.qtd]);
      if (!d || q == null) continue; seq++;
      out.push({ n: col.item != null && numeroBR(r[col.item]) != null ? numeroBR(r[col.item]) : seq, lote: col.lote != null ? String(r[col.lote] || '') : '', descricao: d.replace(/\s+/g, ' '), unidade: col.un != null ? String(r[col.un] || 'UN').toUpperCase().trim() : 'UN', quantidade: q, valorRef: col.ref != null ? numeroBR(r[col.ref]) : null });
    }
    return out;
  }

  // ---------- fornecedores ----------
  const VAZIAS = 'para com sem tipo cada conforme modelo marca minimo maximo aproximadamente medindo unidade caixa pacote cor cores tamanho material referencia similar equivalente produto produtos deve devera sendo contendo apresentar embalagem qualidade primeira linha'.split(' ');
  function palavras(t) { return normalizar(t).split(' ').filter(function (w) { return w.length >= 4 && !/^\d+$/.test(w) && VAZIAS.indexOf(w) < 0; }); }
  function radical(w) { return w.replace(/(oes|aes|ais|eis|res|es|s)$/, '').slice(0, 7); }
  function sugerirFornecedores(itens, fornecedores) {
    const itensP = itens.map(function (i) { return palavras(i.descricao).slice(0, 6).map(radical); });
    return fornecedores.filter(function (f) { return f.status !== 'bloqueado'; }).map(function (f) {
      const base = {}; palavras([(f.categorias || []).join(' '), (f.marcas || []).join(' '), (f.portfolio || []).map(function (p) { return p.descricao + ' ' + (p.marca || ''); }).join(' '), f.fantasia || '', f.observacoes || ''].join(' ')).forEach(function (w) { base[radical(w)] = true; });
      const casados = []; itensP.forEach(function (ws, k) { const hits = ws.filter(function (w) { return base[w]; }).length; if (hits && (hits >= 2 || ws.indexOf(ws.find(function (w) { return base[w]; })) === 0)) casados.push(k); });
      return { fornecedor: f, itens: casados, pontos: casados.length / Math.max(1, itens.length) };
    }).filter(function (s) { return s.itens.length; }).sort(function (a, b) { return b.itens.length - a.itens.length; });
  }

  function telefoneWhats(t) { let d = String(t || '').replace(/\D/g, ''); if (!d) return ''; d = d.replace(/^0+/, ''); if (d.length === 10 || d.length === 11) d = '55' + d; return d.length >= 12 ? d : ''; }

  // ---------- mensagens ----------
  function listaItens(itens, canal, limite) {
    const L = itens.slice(0, limite || itens.length).map(function (i) {
      const q = String(i.quantidade).replace('.', ',') + ' ' + (i.unidade || 'UN');
      return canal === 'whatsapp' ? '*' + (i.lote ? 'L' + i.lote + '.' : '') + i.n + '.* ' + i.descricao + ' — *' + q + '*' : (i.lote ? 'Lote ' + i.lote + ', ' : '') + 'Item ' + i.n + ': ' + i.descricao + ' — ' + q;
    });
    if (limite && itens.length > limite) L.push((canal === 'whatsapp' ? '_' : '') + '+ ' + (itens.length - limite) + ' item(ns) na planilha anexa' + (canal === 'whatsapp' ? '_' : ''));
    return L.join('\n');
  }
  function preencher(modelo, dados) { return String(modelo || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, function (x, k) { return dados[k] != null && dados[k] !== '' ? dados[k] : ''; }).replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim(); }
  function dataBR(iso) { if (!iso) return ''; const m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/); return m ? m[3] + '/' + m[2] + '/' + m[1] + (m[4] ? ' às ' + m[4] + 'h' + m[5] : '') : String(iso); }
  const MODELOS = {
    assunto: 'Cotação {{numero}} — {{titulo}}',
    email: 'Olá, {{contato}}!\n\nSolicitamos cotação de preços para os itens abaixo{{destino}}.\n\n{{itens}}\n\nPor favor, informe para cada item: preço unitário, marca/modelo e prazo de entrega. Na resposta, informe também a validade da proposta, as condições de pagamento e o frete (CIF ou FOB).\n{{prazo_entrega_txt}}\nPrazo para resposta: {{prazo}}.\nSegue a planilha em anexo para preenchimento. Basta devolvê-la preenchida neste e-mail.\n\nObrigado!\n\n{{assinatura}}',
    whatsapp: 'Olá, {{contato}}! Tudo bem?\n\nPoderia nos passar *cotação* dos itens abaixo{{destino}}?\n\n{{itens}}\n\nPreciso de: *preço unitário, marca e prazo de entrega* de cada item, além de validade, pagamento e frete.\n⏰ Resposta até *{{prazo}}*.\n\nSe preferir, envio a planilha para preencher.\n\n{{assinatura}}',
    followup_whatsapp: 'Olá, {{contato}}! Passando para lembrar da cotação *{{numero}}* ({{titulo}}), enviada em {{enviada}}. O prazo de resposta é *{{prazo}}*. Consegue nos retornar?\n\n{{assinatura}}',
    followup_email: 'Olá, {{contato}}!\n\nRetomo a cotação {{numero}} ({{titulo}}), enviada em {{enviada}}. O prazo para resposta é {{prazo}}.\n\nConsegue nos enviar os preços? Se algum item não for atendido, basta indicar na planilha.\n\nObrigado!\n\n{{assinatura}}'
  };
  function mensagem(tipo, cot, forn, opc) {
    opc = opc || {}; const modelos = Object.assign({}, MODELOS, opc.modelos || {});
    const canal = /whatsapp/.test(tipo) ? 'whatsapp' : 'email';
    const itens = (cot.itens || []).filter(function (i) { return !forn || !forn.itens || !forn.itens.length || forn.itens.indexOf(i.id) >= 0; });
    const destino = cot.identificarOrgao && cot.licitacao && cot.licitacao.orgao ? ' (' + cot.licitacao.orgao + (cot.licitacao.numero ? ', ' + (cot.licitacao.modalidade || 'licitação') + ' ' + cot.licitacao.numero : '') + ')' : (cot.licitacao && cot.licitacao.cidade ? ', com entrega em ' + cot.licitacao.cidade + (cot.licitacao.uf ? '-' + cot.licitacao.uf : '') : '');
    const f = forn && forn.cadastro || {};
    const dados = {
      numero: cot.numero, titulo: cot.titulo, contato: (f.contato || f.fantasia || f.razao || '').split(' ')[0] || 'tudo bem', fornecedor: f.fantasia || f.razao || '',
      itens: listaItens(itens, canal, canal === 'whatsapp' ? (opc.limiteItens || 25) : (opc.limiteItens || 60)), destino: destino, prazo: dataBR(cot.prazoResposta) || 'o quanto antes',
      prazo_entrega_txt: cot.licitacao && cot.licitacao.prazoEntrega ? 'Prazo de entrega exigido: ' + cot.licitacao.prazoEntrega + '.\n' : '',
      enviada: forn && forn.enviadaEm ? dataBR(forn.enviadaEm.slice(0, 10)) : '', assinatura: opc.assinatura || 'Lucas Neves | Seven', cliente: opc.cliente || ''
    };
    return preencher(modelos[tipo], dados);
  }
  function linkWhats(fone, texto) { const n = telefoneWhats(fone); return 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto); }
  function linkEmail(para, assunto, corpo) { return 'mailto:' + encodeURIComponent(para || '').replace(/%40/g, '@') + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo); }

  // ---------- respostas e mapa ----------
  function precoDe(forn, itemId) { const r = forn.resposta && forn.resposta.itens && forn.resposta.itens[itemId]; return r && r.preco != null && r.preco !== '' && !r.naoAtende ? Number(r.preco) : null; }
  function mapa(cot) {
    const fs = (cot.fornecedores || []).filter(function (f) { return f.resposta; });
    const linhas = (cot.itens || []).map(function (i) {
      const precos = fs.map(function (f) { return { fid: f.fid, preco: precoDe(f, i.id) }; }).filter(function (p) { return p.preco != null; }).sort(function (a, b) { return a.preco - b.preco; });
      const vals = precos.map(function (p) { return p.preco; }); const meio = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : null;
      const melhor = precos[0] || null;
      return { item: i, precos: precos, melhor: melhor, mediana: meio, media: vals.length ? vals.reduce(function (s, v) { return s + v; }, 0) / vals.length : null, economia: melhor && i.valorRef ? 1 - melhor.preco / i.valorRef : null };
    });
    const porForn = fs.map(function (f) {
      let total = 0, cobertos = 0, venceu = 0;
      linhas.forEach(function (l) { const p = precoDe(f, l.item.id); if (p != null) { total += p * (l.item.quantidade || 0); cobertos++; if (l.melhor && l.melhor.fid === f.fid) venceu++; } });
      return { fid: f.fid, total: total, cobertos: cobertos, completo: cobertos === linhas.length && linhas.length > 0, venceu: venceu };
    });
    const combinado = linhas.reduce(function (s, l) { return s + (l.melhor ? l.melhor.preco * (l.item.quantidade || 0) : 0); }, 0);
    const refTotal = linhas.reduce(function (s, l) { return s + (l.item.valorRef ? l.item.valorRef * (l.item.quantidade || 0) : 0); }, 0);
    const completos = porForn.filter(function (p) { return p.completo; }).sort(function (a, b) { return a.total - b.total; });
    return { linhas: linhas, fornecedores: porForn, melhorCombinado: combinado, melhorUnico: completos[0] || null, referencia: refTotal, semPreco: linhas.filter(function (l) { return !l.melhor; }).length };
  }

  // ---------- follow-up ----------
  const STATUS = { 'a-enviar': 'A enviar', enviada: 'Enviada', visualizada: 'Visualizada', respondida: 'Respondida', parcial: 'Resposta parcial', recusou: 'Recusou', 'sem-resposta': 'Sem resposta' };
  function aguardando(f) { return ['enviada', 'visualizada', 'parcial'].indexOf(f.status) >= 0; }
  function ultimoContato(f) { const fu = (f.followups || []).map(function (x) { return x.em; }); return [f.enviadaEm].concat(fu).filter(Boolean).sort().pop() || null; }
  function precisaFollowup(cot, f, agora, horas) {
    if (!aguardando(f) || cot.status === 'concluida' || cot.status === 'cancelada') return false;
    const ag = agora ? new Date(agora) : new Date(); const ult = ultimoContato(f); if (!ult) return false;
    const passou = (ag - new Date(ult)) / 36e5;
    const prazo = cot.prazoResposta ? (new Date(cot.prazoResposta.length <= 10 ? cot.prazoResposta + 'T18:00' : cot.prazoResposta) - ag) / 36e5 : null;
    if (prazo != null && prazo < 0) return passou >= 2;
    if (prazo != null && prazo <= 24) return passou >= 4;
    return passou >= (horas || 24);
  }
  function pendencias(cotacoes, agora, horas) {
    const out = [];
    (cotacoes || []).forEach(function (c) { (c.fornecedores || []).forEach(function (f) { if (precisaFollowup(c, f, agora, horas)) out.push({ cotacao: c, fornecedor: f, ultimo: ultimoContato(f), tentativas: (f.followups || []).length }); }); });
    return out.sort(function (a, b) { return String(a.cotacao.prazoResposta || '9').localeCompare(String(b.cotacao.prazoResposta || '9')); });
  }

  // ---------- indicadores do fornecedor ----------
  function indicadores(fid, cotacoes) {
    let enviadas = 0, respondidas = 0, recusas = 0, horas = 0, nResp = 0, itensVencidos = 0, itensCotados = 0, followups = 0; let ultima = null; const participacoes = [];
    (cotacoes || []).forEach(function (c) {
      const f = (c.fornecedores || []).find(function (x) { return x.fid === fid; }); if (!f) return;
      participacoes.push({ cotacao: c, f: f });
      if (f.enviadaEm) { enviadas++; if (!ultima || f.enviadaEm > ultima) ultima = f.enviadaEm; }
      followups += (f.followups || []).length;
      if (f.status === 'recusou') recusas++;
      if (f.resposta) { respondidas++; if (f.enviadaEm && f.resposta.recebidaEm) { horas += Math.max(0, (new Date(f.resposta.recebidaEm) - new Date(f.enviadaEm)) / 36e5); nResp++; }
        const m = mapa(c); m.linhas.forEach(function (l) { if (precoDe(f, l.item.id) != null) { itensCotados++; if (l.melhor && l.melhor.fid === fid) itensVencidos++; } }); }
    });
    const taxa = enviadas ? respondidas / enviadas : null; const tempo = nResp ? horas / nResp : null; const vitoria = itensCotados ? itensVencidos / itensCotados : null;
    // nota de 0 a 5: resposta (50%), rapidez (20%) e competitividade (30%)
    let nota = null; if (enviadas) { const rap = tempo == null ? 0.5 : Math.max(0, Math.min(1, 1 - (tempo - 4) / 68)); nota = Math.round((0.5 * (taxa || 0) + 0.2 * rap + 0.3 * (vitoria || 0)) * 50) / 10; }
    return { enviadas: enviadas, respondidas: respondidas, recusas: recusas, taxaResposta: taxa, tempoMedioHoras: tempo, itensCotados: itensCotados, itensVencidos: itensVencidos, taxaVitoria: vitoria, followups: followups, ultimaCotacao: ultima, nota: nota, participacoes: participacoes };
  }

  function proximoNumero(cotacoes, ano) { const a = String(ano || new Date().getFullYear()); let max = 0; (cotacoes || []).forEach(function (c) { const m = String(c.numero || '').match(/^COT-(\d{4})-(\d+)$/); if (m && m[1] === a) max = Math.max(max, Number(m[2])); }); return 'COT-' + a + '-' + ('00' + (max + 1)).slice(-3); }

  // ---------- planilha do fornecedor ----------
  const CAB = ['Cód.', 'Lote', 'Item', 'Descrição', 'Unid.', 'Qtd.', 'Marca', 'Modelo / referência', 'Preço unitário (R$)', 'Preço total (R$)', 'Prazo de entrega (dias)', 'Observação / não atende'];
  function planilhaFornecedor(cot, forn, empresa) {
    const f = forn && forn.cadastro || {};
    const topo = [['SOLICITAÇÃO DE COTAÇÃO ' + cot.numero], [cot.titulo || ''], ['Fornecedor:', f.razao || f.fantasia || ''], ['Responder até:', dataBR(cot.prazoResposta)], ['Solicitante:', empresa || 'Seven'], [], ['Validade da proposta (dias):', ''], ['Condição de pagamento:', ''], ['Frete (CIF/FOB):', ''], ['Faturamento mínimo (R$):', ''], [], CAB];
    const ini = topo.length;
    const itens = (cot.itens || []).filter(function (i) { return !forn || !forn.itens || !forn.itens.length || forn.itens.indexOf(i.id) >= 0; });
    const linhas = itens.map(function (i, k) { const r = ini + k + 1; return [i.id, i.lote || '', i.n, i.descricao, i.unidade, i.quantidade, '', '', '', { f: 'IF(I' + r + '="","",I' + r + '*F' + r + ')' }, '', '']; });
    const totalLinha = ini + linhas.length + 1;
    return { linhas: topo.concat(linhas).concat([[], ['', '', '', 'TOTAL', '', '', '', '', '', { f: 'SUM(J' + (ini + 1) + ':J' + (totalLinha - 1) + ')' }]]), inicioItens: ini, meta: [['cotacao', cot.id], ['fornecedor', forn ? forn.fid : ''], ['numero', cot.numero]] };
  }
  // Lê a planilha devolvida (matriz de linhas) e devolve as respostas por item.
  function lerPlanilhaFornecedor(linhas, cot) {
    const L = linhas || []; let h = -1;
    for (let i = 0; i < L.length; i++) { const n = (L[i] || []).map(normalizar); if (n.indexOf('cod') >= 0 && n.some(function (x) { return /preco unitario/.test(x); })) { h = i; break; } }
    const cond = {}; L.slice(0, h < 0 ? 15 : h).forEach(function (r) { const k = normalizar(r && r[0]); const v = r && r[1]; if (/validade/.test(k)) cond.validade = v; if (/pagamento/.test(k)) cond.pagamento = v; if (/frete/.test(k)) cond.frete = v; if (/faturamento/.test(k)) cond.faturamentoMinimo = numeroBR(v); });
    const itens = {}; let lidos = 0;
    if (h < 0) { const its = itensDePlanilha(L); its.forEach(function (x) { void x; }); return { itens: itens, condicoes: cond, lidos: 0 }; }
    const c = {}; L[h].forEach(function (x, j) { const n = normalizar(x); if (n === 'cod') c.id = j; else if (n === 'item') c.n = j; else if (/^marca/.test(n)) c.marca = j; else if (/^modelo/.test(n)) c.modelo = j; else if (/preco unitario/.test(n)) c.preco = j; else if (/prazo/.test(n)) c.prazo = j; else if (/observ/.test(n)) c.obs = j; });
    const porId = {}; (cot.itens || []).forEach(function (i) { porId[i.id] = i; });
    for (let i = h + 1; i < L.length; i++) {
      const r = L[i] || []; let it = porId[String(r[c.id] || '').trim()];
      if (!it && c.n != null) it = (cot.itens || []).find(function (x) { return String(x.n) === String(r[c.n]).trim(); });
      if (!it) continue;
      const obs = String(r[c.obs] || '').trim(); const preco = numeroBR(r[c.preco]);
      if (preco == null && !obs) continue;
      itens[it.id] = { preco: preco, marca: String(r[c.marca] || '').trim(), modelo: String(r[c.modelo] || '').trim(), prazo: String(r[c.prazo] || '').trim(), obs: obs, naoAtende: preco == null && /n[aã]o\s+atend|sem\s+estoque|n[aã]o\s+temos|n[aã]o\s+fornec|indispon/i.test(obs) };
      lidos++;
    }
    return { itens: itens, condicoes: cond, lidos: lidos };
  }

  return { normalizar: normalizar, numeroBR: numeroBR, extrairCabecalho: extrairCabecalho, extrairItens: extrairItens, itensDePlanilha: itensDePlanilha, sugerirFornecedores: sugerirFornecedores, telefoneWhats: telefoneWhats, mensagem: mensagem, MODELOS: MODELOS, listaItens: listaItens, linkWhats: linkWhats, linkEmail: linkEmail, dataBR: dataBR, mapa: mapa, precoDe: precoDe, STATUS: STATUS, aguardando: aguardando, precisaFollowup: precisaFollowup, pendencias: pendencias, ultimoContato: ultimoContato, indicadores: indicadores, proximoNumero: proximoNumero, planilhaFornecedor: planilhaFornecedor, lerPlanilhaFornecedor: lerPlanilhaFornecedor, CAB: CAB };
});
