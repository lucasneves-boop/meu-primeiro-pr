/* Regras do Seven NFe (notas fiscais no estilo Bling): cálculo de tributos, CFOP, chave de acesso, retenções de órgão público, XML da NF-e e validação.
   Puro, testável no Node. Os cálculos são estimativas de apoio: a contabilidade confirma alíquotas e enquadramento. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Notas = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const r2 = function (v) { return Math.round((Number(v) || 0) * 100 + 1e-9) / 100; };
  const dig = function (t) { return String(t || '').replace(/\D/g, ''); };

  // ---------- documentos ----------
  function validarCNPJ(c) { const s = dig(c); if (s.length !== 14 || /^(\d)\1+$/.test(s)) return false; const calc = function (n) { let soma = 0, pos = n - 7; for (let i = n; i >= 1; i--) { soma += s[n - i] * pos--; if (pos < 2) pos = 9; } const r = soma % 11; return r < 2 ? 0 : 11 - r; }; return calc(12) === +s[12] && calc(13) === +s[13]; }
  function validarCPF(c) { const s = dig(c); if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false; for (let t = 9; t < 11; t++) { let soma = 0; for (let i = 0; i < t; i++) soma += s[i] * (t + 1 - i); if (((soma * 10) % 11) % 10 !== +s[t]) return false; } return true; }
  const UF_COD = { RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29, MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53 };
  const COD_UF = {}; Object.keys(UF_COD).forEach(function (k) { COD_UF[UF_COD[k]] = k; });
  function dvChave(c43) { let soma = 0, peso = 2; for (let i = c43.length - 1; i >= 0; i--) { soma += Number(c43[i]) * peso; peso = peso === 9 ? 2 : peso + 1; } const r = soma % 11; return r < 2 ? 0 : 11 - r; }
  // Chave de acesso de 44 dígitos: cUF AAMM CNPJ mod série nNF tpEmis cNF DV
  function lerChave(ch) {
    const c = dig(ch); if (c.length !== 44) return { valida: false, erro: 'A chave tem 44 números.' };
    const valida = dvChave(c.slice(0, 43)) === Number(c[43]);
    return { valida: valida, erro: valida ? '' : 'Dígito verificador não confere.', uf: COD_UF[Number(c.slice(0, 2))] || '?', ano: 2000 + Number(c.slice(2, 4)), mes: Number(c.slice(4, 6)), cnpj: c.slice(6, 20), modelo: c.slice(20, 22), serie: Number(c.slice(22, 25)), numero: Number(c.slice(25, 34)), tipoEmissao: Number(c[34]), codigo: c.slice(35, 43), dv: Number(c[43]) };
  }
  function montarChave(o) { const c43 = String(UF_COD[o.uf]).padStart(2, '0') + String(o.ano % 100).padStart(2, '0') + String(o.mes).padStart(2, '0') + dig(o.cnpj).padStart(14, '0') + String(o.modelo || 55).padStart(2, '0') + String(o.serie || 1).padStart(3, '0') + String(o.numero).padStart(9, '0') + String(o.tipoEmissao || 1) + String(o.codigo).padStart(8, '0'); return c43 + dvChave(c43); }
  function formatarChave(c) { return dig(c).replace(/(\d{4})(?=\d)/g, '$1 '); }

  // ---------- operação ----------
  const SUL_SUDESTE = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS']; // ES fica fora, por lei (Res. Senado 22/1989)
  function aliqInterestadual(origem, destino, importado) {
    if (!origem || !destino || origem === destino) return null; if (importado) return 4;
    return SUL_SUDESTE.indexOf(origem) >= 0 && SUL_SUDESTE.indexOf(destino) < 0 ? 7 : 12;
  }
  // CFOP de saída mais comum para cada situação.
  function cfopSugerido(o) {
    const fora = o.ufOrigem && o.ufDestino && o.ufOrigem !== o.ufDestino; const p = fora ? '6' : '5';
    if (o.tipo === 'servico') return fora ? '6933' : '5933';
    if (o.finalidade === 'devolucao') return fora ? '6202' : '5202';
    if (o.producaoPropria) return p + (fora && !o.contribuinte ? '107' : '101');
    return p + (fora && !o.contribuinte ? '108' : '102');
  }
  const NATUREZAS = ['Venda de mercadoria', 'Venda de produção do estabelecimento', 'Prestação de serviço', 'Remessa para demonstração', 'Remessa em garantia', 'Devolução de compra', 'Outras saídas'];

  // ---------- cálculo ----------
  // emitente.regime: 'simples' | 'presumido' | 'real'. item: { quantidade, valorUnitario, desconto, aliqIcms, aliqIpi, aliqIss, origem }
  function calcularItem(it, emit, nf) {
    const bruto = r2((Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0)); const desc = r2(it.desconto || 0); const liquido = r2(bruto - desc);
    const out = { bruto: bruto, desconto: desc, liquido: liquido, icms: 0, baseIcms: 0, aliqIcms: 0, ipi: 0, pis: 0, cofins: 0, iss: 0, difal: 0 };
    const servico = (nf.tipo || 'produto') === 'servico';
    if (servico) { out.aliqIss = Number(it.aliqIss != null ? it.aliqIss : nf.aliqIss) || 0; out.iss = r2(liquido * out.aliqIss / 100); }
    else {
      out.ipi = r2(liquido * (Number(it.aliqIpi) || 0) / 100);
      if (emit.regime !== 'simples') {
        const inter = aliqInterestadual(emit.uf, (nf.destinatario || {}).uf, it.origem && it.origem !== '0');
        out.aliqIcms = it.aliqIcms != null && it.aliqIcms !== '' ? Number(it.aliqIcms) : (inter != null ? inter : Number(emit.aliqIcmsInterna) || 0);
        out.baseIcms = r2(liquido + (nf.destinatario && !nf.destinatario.contribuinte ? out.ipi : 0)); // IPI entra na base quando o destinatário não é contribuinte
        out.icms = r2(out.baseIcms * out.aliqIcms / 100);
        const interna = Number((nf.destinatario || {}).aliqInternaDestino) || 0;
        if (inter != null && nf.destinatario && !nf.destinatario.contribuinte && interna > inter) out.difal = r2(out.baseIcms * (interna - inter) / 100); // EC 87/2015
      }
    }
    if (emit.regime === 'presumido') { out.pis = r2(liquido * 0.0065); out.cofins = r2(liquido * 0.03); }
    if (emit.regime === 'real') { out.pis = r2(liquido * 0.0165); out.cofins = r2(liquido * 0.076); }
    return out;
  }
  // Retenções na fonte feitas por órgão público federal (IN RFB 1.234/2012). Optante do Simples fica dispensado com declaração.
  const RETENCOES = { bens: { ir: 1.2, csll: 1, cofins: 3, pis: 0.65 }, servicos: { ir: 4.8, csll: 1, cofins: 3, pis: 0.65 }, combustiveis: { ir: 0.24, csll: 1, cofins: 3, pis: 0.65 } };
  function retencoes(total, nf, emit) {
    const o = { ir: 0, csll: 0, cofins: 0, pis: 0, iss: 0, inss: 0, total: 0, dispensa: false };
    if (nf.retencaoFederal) { if (emit.regime === 'simples') o.dispensa = true; else { const t = RETENCOES[nf.naturezaRetencao || ((nf.tipo === 'servico') ? 'servicos' : 'bens')]; ['ir', 'csll', 'cofins', 'pis'].forEach(function (k) { o[k] = r2(total * t[k] / 100); }); } }
    if (nf.tipo === 'servico' && nf.issRetido) o.iss = -1; // marcado; valor somado abaixo
    if (nf.tipo === 'servico' && nf.inssRetido) o.inss = r2(total * 0.11); // cessão de mão de obra (Lei 8.212/91, art. 31)
    return o;
  }
  function calcular(nf, emit) {
    const itens = (nf.itens || []).map(function (it) { return calcularItem(it, emit, nf); });
    const soma = function (k) { return r2(itens.reduce(function (s, x) { return s + x[k]; }, 0)); };
    const t = { produtos: soma('bruto'), desconto: soma('desconto'), baseIcms: soma('baseIcms'), icms: soma('icms'), ipi: soma('ipi'), pis: soma('pis'), cofins: soma('cofins'), iss: soma('iss'), difal: soma('difal'), frete: r2(nf.frete), seguro: r2(nf.seguro), outras: r2(nf.outras) };
    t.total = r2(t.produtos - t.desconto + t.ipi + t.frete + t.seguro + t.outras);
    const ret = retencoes(r2(t.produtos - t.desconto), nf, emit); if (ret.iss === -1) ret.iss = t.iss;
    ret.total = r2(ret.ir + ret.csll + ret.cofins + ret.pis + ret.iss + ret.inss); t.retencoes = ret; t.liquido = r2(t.total - ret.total);
    t.tributosAprox = nf.percTributos ? r2(t.total * Number(nf.percTributos) / 100) : 0; // Lei 12.741/2012
    return { itens: itens, totais: t };
  }
  // Parcelas (duplicatas): a diferença de centavos vai para a última.
  function parcelas(total, n, primeiro, intervalo) {
    n = Math.max(1, Number(n) || 1); const base = Math.floor(total / n * 100) / 100; const out = [];
    for (let i = 0; i < n; i++) { const d = new Date(primeiro + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i * (Number(intervalo) || 30)); out.push({ numero: String(i + 1).padStart(3, '0'), vencimento: d.toISOString().slice(0, 10), valor: i === n - 1 ? r2(total - base * (n - 1)) : base }); }
    return out;
  }
  function infoComplementar(nf, emit, totais) {
    const L = [];
    if (emit.regime === 'simples') { L.push('Documento emitido por ME ou EPP optante pelo Simples Nacional.'); L.push('Não gera direito a crédito fiscal de IPI.'); }
    const c = nf.contrato || {};
    const ref = [c.empenho && 'Nota de empenho nº ' + c.empenho, c.processo && 'Processo nº ' + c.processo, c.licitacao && c.licitacao, c.contrato && 'Contrato/ATA nº ' + c.contrato].filter(Boolean); if (ref.length) L.push(ref.join(' · ') + '.');
    if (totais && totais.retencoes && totais.retencoes.dispensa) L.push('Optante pelo Simples Nacional: dispensa de retenção de tributos federais (IN RFB 1.234/2012, art. 4º, XI).');
    if (totais && totais.tributosAprox) L.push('Valor aproximado dos tributos: R$ ' + totais.tributosAprox.toFixed(2).replace('.', ',') + ' (Lei 12.741/2012).');
    if (nf.dadosBancarios) L.push('Dados para pagamento: ' + nf.dadosBancarios);
    return L.join(' ');
  }

  // ---------- validação (o que a SEFAZ costuma rejeitar e o que o órgão costuma glosar) ----------
  function validar(nf, emit) {
    const E = []; const err = function (m) { E.push({ nivel: 'erro', msg: m }); }; const al = function (m) { E.push({ nivel: 'alerta', msg: m }); };
    if (!emit || !validarCNPJ(emit.cnpj)) err('CNPJ do emitente inválido (cadastre o cliente em Clientes).');
    if (emit && emit.regime !== 'simples' && !emit.ie && (nf.tipo || 'produto') === 'produto') err('Informe a inscrição estadual do emitente nas configurações fiscais.');
    if (emit && !emit.uf) err('Informe a UF do emitente.');
    const d = nf.destinatario || {};
    if (!d.nome) err('Informe o destinatário.');
    if (d.documento && !(validarCNPJ(d.documento) || validarCPF(d.documento))) err('CNPJ/CPF do destinatário inválido.'); else if (!d.documento) err('Informe o CNPJ do destinatário.');
    if (!d.uf) err('Informe a UF do destinatário.'); if (!d.municipio) al('Informe o município do destinatário.');
    if (!(nf.itens || []).length) err('A nota não tem itens.');
    (nf.itens || []).forEach(function (it, i) {
      const n = 'Item ' + (i + 1) + ': ';
      if (!String(it.descricao || '').trim()) err(n + 'sem descrição.');
      if (!(Number(it.quantidade) > 0)) err(n + 'quantidade deve ser maior que zero.');
      if (!(Number(it.valorUnitario) > 0)) err(n + 'valor unitário deve ser maior que zero.');
      if ((nf.tipo || 'produto') === 'produto') {
        if (!/^\d{8}$/.test(dig(it.ncm))) err(n + 'NCM deve ter 8 números.');
        const cf = dig(it.cfop); if (!/^[1-7]\d{3}$/.test(cf)) err(n + 'CFOP inválido.');
        else if (emit && d.uf) { const fora = emit.uf !== d.uf; if (fora && cf[0] === '5') err(n + 'CFOP ' + cf + ' é de operação interna, mas o destinatário é de outra UF (use 6xxx).'); if (!fora && cf[0] === '6') err(n + 'CFOP ' + cf + ' é interestadual, mas o destinatário é da mesma UF (use 5xxx).'); }
      } else if (!it.codigoServico && !nf.codigoServico) al(n + 'informe o código do serviço (LC 116/2003).');
    });
    if (d.orgaoPublico && !(nf.contrato && nf.contrato.empenho)) al('Venda a órgão público: informe o número da nota de empenho (o órgão costuma exigir na NF).');
    if (d.orgaoPublico && d.contribuinte) al('Órgão público geralmente não é contribuinte de ICMS (indIEDest = 9). Confira.');
    const tot = calcular(nf, emit || {}).totais;
    const dup = (nf.duplicatas || []).reduce(function (s, x) { return s + Number(x.valor || 0); }, 0);
    if ((nf.duplicatas || []).length && Math.abs(r2(dup) - tot.total) > 0.01) err('Soma das duplicatas (' + r2(dup).toFixed(2) + ') diferente do total da nota (' + tot.total.toFixed(2) + ').');
    if (tot.difal > 0) al('Há DIFAL estimado de R$ ' + tot.difal.toFixed(2) + ' (venda interestadual a não contribuinte). Recolha por GNRE antes da saída ou conforme a UF de destino.');
    return E;
  }

  // ---------- XML da NF-e ----------
  // Leitor de XML mínimo (sem atributos além de Id), suficiente para o layout 4.00 da NF-e.
  function xmlParaObjeto(xml) {
    const raiz = { _: {} }; const pilha = [raiz]; const re = /<(\/?)([\w:.-]+)([^>]*?)(\/?)>|([^<]+)/g; let m;
    const limpo = String(xml).replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<Signature[\s\S]*?<\/Signature>/g, '');
    while ((m = re.exec(limpo))) {
      if (m[5] !== undefined) { if (m[5].trim()) pilha[pilha.length - 1]._texto = (pilha[pilha.length - 1]._texto || '') + m[5].trim(); continue; }
      const nome = m[2].replace(/^\w+:/, '');
      if (m[1]) { pilha.pop(); continue; }
      const no = { _: {} }; const id = m[3].match(/\bId="([^"]+)"/); if (id) no._.Id = id[1];
      const pai = pilha[pilha.length - 1]; (pai[nome] = pai[nome] || []).push(no);
      if (!m[4]) pilha.push(no);
    }
    return raiz;
  }
  function un(o, caminho) { let x = o; for (const p of caminho.split('.')) { if (!x || !x[p]) return undefined; x = x[p][0]; } return x; }
  function txt(o, caminho) { const x = un(o, caminho); if (x === undefined) return ''; return (x._texto || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
  function num(o, caminho) { const v = txt(o, caminho); return v === '' ? 0 : Number(v); }
  function lerXML(xml) {
    const o = xmlParaObjeto(xml); const nfe = un(o, 'nfeProc.NFe.infNFe') || un(o, 'NFe.infNFe'); if (!nfe) throw new Error('Não é um XML de NF-e (não achei infNFe).');
    const prot = un(o, 'nfeProc.protNFe.infProt'); const ide = un(nfe, 'ide'); const emit = un(nfe, 'emit'); const dest = un(nfe, 'dest') || { _: {} };
    const endE = un(emit, 'enderEmit') || { _: {} }, endD = un(dest, 'enderDest') || { _: {} }; const tot = un(nfe, 'total.ICMSTot') || { _: {} };
    const imposto = function (det, grupo) { const g = un(det, 'imposto.' + grupo); if (!g) return null; const k = Object.keys(g).filter(function (x) { return x !== '_'; })[0]; return k ? g[k][0] : null; };
    const itens = (nfe.det || []).map(function (det) {
      const p = un(det, 'prod'); const icms = imposto(det, 'ICMS'); const ipiT = un(det, 'imposto.IPI.IPITrib');
      return { codigo: txt(p, 'cProd'), descricao: txt(p, 'xProd'), ncm: txt(p, 'NCM'), cfop: txt(p, 'CFOP'), unidade: txt(p, 'uCom'), quantidade: num(p, 'qCom'), valorUnitario: num(p, 'vUnCom'), valorTotal: num(p, 'vProd'), desconto: num(p, 'vDesc'), cst: icms ? (txt(icms, 'CST') || txt(icms, 'CSOSN')) : '', origem: icms ? txt(icms, 'orig') : '', aliqIcms: icms ? num(icms, 'pICMS') : 0, valorIcms: icms ? num(icms, 'vICMS') : 0, aliqIpi: ipiT ? num(ipiT, 'pIPI') : 0, valorIpi: ipiT ? num(ipiT, 'vIPI') : 0 };
    });
    const chave = (nfe._.Id || '').replace(/^NFe/, '') || (prot ? txt(prot, 'chNFe') : '');
    const dups = (un(nfe, 'cobr') && un(nfe, 'cobr').dup || []).map(function (d) { return { numero: txt(d, 'nDup'), vencimento: txt(d, 'dVenc'), valor: num(d, 'vDup') }; });
    const pag = (un(nfe, 'pag') && un(nfe, 'pag').detPag || []).map(function (d) { return { forma: txt(d, 'tPag'), valor: num(d, 'vPag') }; });
    const cStat = prot ? txt(prot, 'cStat') : '';
    return {
      chave: chave, numero: Number(txt(ide, 'nNF')), serie: Number(txt(ide, 'serie')), modelo: txt(ide, 'mod'), natureza: txt(ide, 'natOp'), emissao: txt(ide, 'dhEmi') || txt(ide, 'dEmi'), saida: txt(ide, 'dhSaiEnt'), tipoOperacao: txt(ide, 'tpNF') === '0' ? 'entrada' : 'saida', ambiente: txt(ide, 'tpAmb') === '2' ? 'homologacao' : 'producao', finalidade: txt(ide, 'finNFe'),
      emitente: { cnpj: txt(emit, 'CNPJ') || txt(emit, 'CPF'), nome: txt(emit, 'xNome'), fantasia: txt(emit, 'xFant'), ie: txt(emit, 'IE'), crt: txt(emit, 'CRT'), logradouro: txt(endE, 'xLgr'), numero: txt(endE, 'nro'), bairro: txt(endE, 'xBairro'), municipio: txt(endE, 'xMun'), uf: txt(endE, 'UF'), cep: txt(endE, 'CEP'), fone: txt(endE, 'fone') },
      destinatario: { documento: txt(dest, 'CNPJ') || txt(dest, 'CPF'), nome: txt(dest, 'xNome'), ie: txt(dest, 'IE'), indIEDest: txt(dest, 'indIEDest'), email: txt(dest, 'email'), logradouro: txt(endD, 'xLgr'), numero: txt(endD, 'nro'), bairro: txt(endD, 'xBairro'), municipio: txt(endD, 'xMun'), uf: txt(endD, 'UF'), cep: txt(endD, 'CEP') },
      itens: itens,
      totais: { produtos: num(tot, 'vProd'), desconto: num(tot, 'vDesc'), frete: num(tot, 'vFrete'), seguro: num(tot, 'vSeg'), outras: num(tot, 'vOutro'), baseIcms: num(tot, 'vBC'), icms: num(tot, 'vICMS'), ipi: num(tot, 'vIPI'), pis: num(tot, 'vPIS'), cofins: num(tot, 'vCOFINS'), total: num(tot, 'vNF'), tributosAprox: num(tot, 'vTotTrib') },
      transporte: { modalidade: txt(nfe, 'transp.modFrete'), transportadora: txt(nfe, 'transp.transporta.xNome') },
      duplicatas: dups, pagamentos: pag, infCpl: txt(nfe, 'infAdic.infCpl'),
      protocolo: prot ? txt(prot, 'nProt') : '', autorizadaEm: prot ? txt(prot, 'dhRecbto') : '', cStat: cStat, motivo: prot ? txt(prot, 'xMotivo') : '', autorizada: cStat === '100' || cStat === '150'
    };
  }

  // ---------- integração: payload no formato da API do emissor Focus NFe (v2) ----------
  function payloadFocus(nf, emit) {
    const c = calcular(nf, emit); const d = nf.destinatario || {}; const doc = dig(d.documento);
    const p = {
      natureza_operacao: nf.natureza, data_emissao: nf.emissao, tipo_documento: nf.operacao === 'entrada' ? 0 : 1, finalidade_emissao: { normal: 1, complementar: 2, ajuste: 3, devolucao: 4 }[nf.finalidade || 'normal'], local_destino: emit.uf === d.uf ? 1 : 2, consumidor_final: d.consumidorFinal === false ? 0 : 1, presenca_comprador: 9,
      cnpj_emitente: dig(emit.cnpj), inscricao_estadual_emitente: emit.ie || undefined,
      nome_destinatario: d.nome, logradouro_destinatario: d.logradouro, numero_destinatario: d.numero || 'S/N', bairro_destinatario: d.bairro, municipio_destinatario: d.municipio, uf_destinatario: d.uf, cep_destinatario: dig(d.cep), email_destinatario: d.email || undefined,
      indicador_inscricao_estadual_destinatario: d.contribuinte ? 1 : (d.ie ? 2 : 9), inscricao_estadual_destinatario: d.contribuinte ? d.ie : undefined,
      valor_produtos: c.totais.produtos, valor_desconto: c.totais.desconto, valor_frete: c.totais.frete, valor_seguro: c.totais.seguro, valor_outras_despesas: c.totais.outras, valor_total: c.totais.total, modalidade_frete: Number(nf.modalidadeFrete != null ? nf.modalidadeFrete : 9),
      informacoes_adicionais_contribuinte: nf.infCpl || infoComplementar(nf, emit, c.totais),
      items: (nf.itens || []).map(function (it, i) { const x = c.itens[i]; const simples = emit.regime === 'simples'; return { numero_item: i + 1, codigo_produto: it.codigo || String(i + 1), descricao: it.descricao, cfop: dig(it.cfop), unidade_comercial: it.unidade || 'UN', quantidade_comercial: Number(it.quantidade), valor_unitario_comercial: Number(it.valorUnitario), unidade_tributavel: it.unidade || 'UN', quantidade_tributavel: Number(it.quantidade), valor_unitario_tributavel: Number(it.valorUnitario), codigo_ncm: dig(it.ncm), valor_bruto: x.bruto, valor_desconto: x.desconto || undefined, icms_origem: Number(it.origem || 0), icms_situacao_tributaria: it.cst || (simples ? '102' : '00'), icms_base_calculo: simples ? undefined : x.baseIcms, icms_aliquota: simples ? undefined : x.aliqIcms, icms_valor: simples ? undefined : x.icms, ipi_situacao_tributaria: x.ipi ? '50' : undefined, ipi_aliquota: x.ipi ? Number(it.aliqIpi) : undefined, pis_situacao_tributaria: simples ? '49' : '01', cofins_situacao_tributaria: simples ? '49' : '01' }; })
    };
    if (doc.length === 14) p.cnpj_destinatario = doc; else p.cpf_destinatario = doc;
    if ((nf.duplicatas || []).length) p.duplicatas = nf.duplicatas.map(function (x) { return { numero: x.numero, data_vencimento: x.vencimento, valor: x.valor }; });
    return JSON.parse(JSON.stringify(p));
  }

  // ---------- indicadores ----------
  // Faturamento dos últimos 12 meses (para o limite do Simples Nacional, R$ 4,8 milhões, e do MEI, R$ 81 mil).
  function faturamento12m(notas, hojeISO) {
    const fim = hojeISO.slice(0, 7); const d = new Date(hojeISO.slice(0, 7) + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 11); const ini = d.toISOString().slice(0, 7);
    return r2(notas.filter(function (n) { const m = String(n.emissao || '').slice(0, 7); return n.operacao !== 'entrada' && n.situacao === 'autorizada' && m >= ini && m <= fim; }).reduce(function (s, n) { return s + (n.totalNota || 0); }, 0));
  }
  const SITUACOES = { rascunho: 'Rascunho', pronta: 'Pronta para emitir', autorizada: 'Autorizada', cancelada: 'Cancelada', denegada: 'Denegada', rejeitada: 'Rejeitada' };

  return { r2: r2, validarCNPJ: validarCNPJ, validarCPF: validarCPF, UF_COD: UF_COD, dvChave: dvChave, lerChave: lerChave, montarChave: montarChave, formatarChave: formatarChave, aliqInterestadual: aliqInterestadual, cfopSugerido: cfopSugerido, NATUREZAS: NATUREZAS, calcularItem: calcularItem, RETENCOES: RETENCOES, retencoes: retencoes, calcular: calcular, parcelas: parcelas, infoComplementar: infoComplementar, validar: validar, xmlParaObjeto: xmlParaObjeto, lerXML: lerXML, payloadFocus: payloadFocus, faturamento12m: faturamento12m, SITUACOES: SITUACOES };
});
