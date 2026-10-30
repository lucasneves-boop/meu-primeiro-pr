const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../js/notas.js');

test('chave de acesso: montar, validar DV e ler', () => {
  const ch = N.montarChave({ uf: 'GO', ano: 2026, mes: 10, cnpj: '11222333000181', modelo: 55, serie: 1, numero: 1234, tipoEmissao: 1, codigo: '12345678' });
  assert.equal(ch.length, 44); const l = N.lerChave(ch);
  assert.deepEqual([l.valida, l.uf, l.ano, l.mes, l.cnpj, l.modelo, l.serie, l.numero], [true, 'GO', 2026, 10, '11222333000181', '55', 1, 1234]);
  const errada = ch.slice(0, 43) + ((Number(ch[43]) + 1) % 10); assert.equal(N.lerChave(errada).valida, false);
  assert.equal(N.lerChave('123').valida, false);
  assert.equal(N.formatarChave(ch).split(' ').length, 11);
  // chave real publicada como exemplo no Manual de Orientação do Contribuinte (DV conhecido)
  assert.equal(N.dvChave('5206043300991100250655012000000780026730161'), 5);
});

test('CNPJ/CPF, ICMS interestadual e CFOP', () => {
  assert.equal(N.validarCNPJ('11.222.333/0001-81'), true); assert.equal(N.validarCNPJ('11.222.333/0001-82'), false); assert.equal(N.validarCPF('529.982.247-25'), true);
  assert.equal(N.aliqInterestadual('SP', 'GO'), 7); assert.equal(N.aliqInterestadual('GO', 'SP'), 12); assert.equal(N.aliqInterestadual('SP', 'ES'), 7); assert.equal(N.aliqInterestadual('ES', 'SP'), 12);
  assert.equal(N.aliqInterestadual('GO', 'GO'), null); assert.equal(N.aliqInterestadual('SP', 'RJ', true), 4);
  assert.equal(N.cfopSugerido({ ufOrigem: 'GO', ufDestino: 'GO', contribuinte: false }), '5102');
  assert.equal(N.cfopSugerido({ ufOrigem: 'GO', ufDestino: 'DF', contribuinte: false }), '6108', 'interestadual para não contribuinte (órgão público)');
  assert.equal(N.cfopSugerido({ ufOrigem: 'GO', ufDestino: 'DF', contribuinte: true }), '6102');
  assert.equal(N.cfopSugerido({ ufOrigem: 'GO', ufDestino: 'GO', producaoPropria: true }), '5101');
  assert.equal(N.cfopSugerido({ tipo: 'servico', ufOrigem: 'GO', ufDestino: 'GO' }), '5933');
});

const emitSimples = { cnpj: '11222333000181', uf: 'GO', regime: 'simples', ie: '101234567' };
const emitPresumido = { cnpj: '11222333000181', uf: 'SP', regime: 'presumido', ie: '123', aliqIcmsInterna: 18 };
const nfBase = () => ({ tipo: 'produto', destinatario: { nome: 'Prefeitura de Catalão', documento: '11222333000181', uf: 'GO', municipio: 'Catalão', contribuinte: false, orgaoPublico: true }, itens: [{ descricao: 'Papel A4', ncm: '48025610', cfop: '5102', unidade: 'CX', quantidade: 200, valorUnitario: 238.5 }, { descricao: 'Caneta', ncm: '96081000', cfop: '5102', unidade: 'UN', quantidade: 1000, valorUnitario: 1.05, desconto: 50 }], frete: 100 });

test('cálculo: Simples Nacional não destaca ICMS; total com frete e desconto', () => {
  const c = N.calcular(nfBase(), emitSimples);
  assert.deepEqual([c.totais.produtos, c.totais.desconto, c.totais.icms, c.totais.pis, c.totais.total], [48750, 50, 0, 0, 48800]);
});

test('cálculo: Lucro Presumido interestadual com DIFAL, IPI na base e PIS/COFINS', () => {
  const nf = nfBase(); nf.destinatario.uf = 'GO'; nf.destinatario.aliqInternaDestino = 19; nf.itens[0].aliqIpi = 10; nf.itens = [nf.itens[0]]; nf.frete = 0;
  const c = N.calcular(nf, emitPresumido); const i = c.itens[0];
  assert.equal(i.aliqIcms, 7, 'SP → GO = 7%'); assert.equal(i.ipi, 4770); assert.equal(i.baseIcms, 52470, 'IPI compõe a base para não contribuinte');
  assert.equal(i.icms, 3672.9); assert.equal(i.difal, 6296.4, '(19% − 7%) × base'); assert.equal(i.pis, 310.05); assert.equal(i.cofins, 1431);
  assert.equal(c.totais.total, 52470);
});

test('retenções de órgão federal (IN RFB 1.234/2012) e dispensa do Simples', () => {
  const nf = nfBase(); nf.retencaoFederal = true; nf.frete = 0;
  const p = N.calcular(nf, Object.assign({}, emitPresumido, { uf: 'GO' })).totais.retencoes;
  assert.deepEqual([p.ir, p.csll, p.cofins, p.pis, p.total], [584.4, 487, 1461, 316.55, 2848.95], '5,85% sobre bens');
  const s = N.calcular(nf, emitSimples).totais; assert.equal(s.retencoes.dispensa, true); assert.equal(s.retencoes.total, 0);
  const sv = { tipo: 'servico', aliqIss: 5, issRetido: true, inssRetido: true, retencaoFederal: true, itens: [{ descricao: 'Limpeza', quantidade: 1, valorUnitario: 10000 }], destinatario: {} };
  const t = N.calcular(sv, Object.assign({}, emitPresumido, { uf: 'GO' })).totais;
  assert.deepEqual([t.iss, t.retencoes.ir, t.retencoes.iss, t.retencoes.inss, t.retencoes.total, t.liquido], [500, 480, 500, 1100, 2545, 7455], 'serviço: 9,45% federal + ISS + INSS 11%');
});

test('duplicatas, informações complementares e validação', () => {
  assert.deepEqual(N.parcelas(100, 3, '2026-11-10', 30).map(p => [p.vencimento, p.valor]), [['2026-11-10', 33.33], ['2026-12-10', 33.33], ['2027-01-09', 33.34]]);
  const nf = nfBase(); nf.contrato = { empenho: '2026NE000123', processo: '45/2026', licitacao: 'Pregão eletrônico 90021/2026' };
  const inf = N.infoComplementar(nf, emitSimples, N.calcular(nf, emitSimples).totais);
  assert.match(inf, /optante pelo Simples Nacional/); assert.match(inf, /Nota de empenho nº 2026NE000123 · Processo nº 45\/2026 · Pregão eletrônico 90021\/2026/);
  assert.deepEqual(N.validar(nf, emitSimples).filter(e => e.nivel === 'erro'), []);
  const ruim = nfBase(); ruim.destinatario.uf = 'DF'; ruim.itens[0].ncm = '4802'; ruim.itens[1].quantidade = 0; ruim.duplicatas = [{ valor: 10 }];
  const msgs = N.validar(ruim, emitSimples).map(e => e.msg).join(' | ');
  assert.match(msgs, /NCM deve ter 8/); assert.match(msgs, /CFOP 5102 é de operação interna/); assert.match(msgs, /quantidade deve ser maior/); assert.match(msgs, /Soma das duplicatas/); assert.match(msgs, /nota de empenho/);
});

const chaveX = N.montarChave({ uf: 'SP', ano: 2026, mes: 10, cnpj: '11222333000181', modelo: 55, serie: 1, numero: 4521, codigo: '87654321' });
const XML = `<?xml version="1.0" encoding="UTF-8"?><nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chaveX}" versao="4.00">
<ide><cUF>35</cUF><natOp>Venda de mercadoria</natOp><mod>55</mod><serie>1</serie><nNF>4521</nNF><dhEmi>2026-10-20T10:15:00-03:00</dhEmi><tpNF>1</tpNF><tpAmb>1</tpAmb><finNFe>1</finNFe></ide>
<emit><CNPJ>11222333000181</CNPJ><xNome>Distribuidora Papel &amp; Cia LTDA</xNome><enderEmit><xLgr>Rua A</xLgr><nro>10</nro><xBairro>Centro</xBairro><xMun>São Paulo</xMun><UF>SP</UF></enderEmit><IE>123456</IE><CRT>3</CRT></emit>
<dest><CNPJ>98765432000198</CNPJ><xNome>Seven Cliente LTDA</xNome><enderDest><xMun>Catalão</xMun><UF>GO</UF></enderDest><indIEDest>1</indIEDest></dest>
<det nItem="1"><prod><cProd>P1</cProd><xProd>Papel A4 75g cx 10</xProd><NCM>48025610</NCM><CFOP>6102</CFOP><uCom>CX</uCom><qCom>200.0000</qCom><vUnCom>180.00</vUnCom><vProd>36000.00</vProd></prod><imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST><vBC>36000.00</vBC><pICMS>7.00</pICMS><vICMS>2520.00</vICMS></ICMS00></ICMS><IPI><IPITrib><CST>50</CST><pIPI>0</pIPI><vIPI>0</vIPI></IPITrib></IPI></imposto></det>
<det nItem="2"><prod><cProd>P2</cProd><xProd>Caneta azul</xProd><NCM>96081000</NCM><CFOP>6102</CFOP><uCom>UN</uCom><qCom>1000</qCom><vUnCom>0.80</vUnCom><vProd>800.00</vProd></prod><imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS></imposto></det>
<total><ICMSTot><vBC>36000.00</vBC><vICMS>2520.00</vICMS><vProd>36800.00</vProd><vFrete>200.00</vFrete><vDesc>0.00</vDesc><vIPI>0.00</vIPI><vNF>37000.00</vNF></ICMSTot></total>
<transp><modFrete>0</modFrete><transporta><xNome>Transportes Rápido</xNome></transporta></transp>
<cobr><dup><nDup>001</nDup><dVenc>2026-11-20</dVenc><vDup>18500.00</vDup></dup><dup><nDup>002</nDup><dVenc>2026-12-20</dVenc><vDup>18500.00</vDup></dup></cobr>
<infAdic><infCpl>Pedido 77</infCpl></infAdic></infNFe><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo>x</SignedInfo></Signature></NFe>
<protNFe versao="4.00"><infProt><tpAmb>1</tpAmb><chNFe>${chaveX}</chNFe><dhRecbto>2026-10-20T10:16:02-03:00</dhRecbto><nProt>135260000123456</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`;

test('ler XML de NF-e autorizada', () => {
  const n = N.lerXML(XML);
  assert.equal(n.chave, chaveX); assert.equal(N.lerChave(n.chave).valida, true);
  assert.deepEqual([n.numero, n.serie, n.natureza, n.tipoOperacao, n.autorizada, n.protocolo], [4521, 1, 'Venda de mercadoria', 'saida', true, '135260000123456']);
  assert.equal(n.emitente.nome, 'Distribuidora Papel & Cia LTDA'); assert.equal(n.destinatario.uf, 'GO');
  assert.equal(n.itens.length, 2); assert.deepEqual([n.itens[0].quantidade, n.itens[0].valorUnitario, n.itens[0].aliqIcms, n.itens[0].cst, n.itens[1].cst], [200, 180, 7, '00', '102']);
  assert.deepEqual([n.totais.total, n.totais.frete, n.totais.icms], [37000, 200, 2520]);
  assert.deepEqual(n.duplicatas.map(d => d.vencimento), ['2026-11-20', '2026-12-20']); assert.equal(n.transporte.transportadora, 'Transportes Rápido'); assert.equal(n.infCpl, 'Pedido 77');
  assert.throws(() => N.lerXML('<a/>'), /infNFe/);
});

test('payload para a API do emissor e faturamento de 12 meses', () => {
  const nf = nfBase(); nf.natureza = 'Venda de mercadoria'; nf.emissao = '2026-10-21'; nf.duplicatas = N.parcelas(48800, 1, '2026-11-20');
  const p = N.payloadFocus(nf, emitSimples);
  assert.equal(p.cnpj_destinatario, '11222333000181'); assert.equal(p.indicador_inscricao_estadual_destinatario, 9); assert.equal(p.items[0].icms_situacao_tributaria, '102'); assert.equal(p.items[1].valor_desconto, 50); assert.equal(p.valor_total, 48800); assert.equal(p.duplicatas.length, 1);
  assert.equal(N.faturamento12m([{ emissao: '2026-10-01', situacao: 'autorizada', totalNota: 100 }, { emissao: '2025-11-05', situacao: 'autorizada', totalNota: 50 }, { emissao: '2025-10-30', situacao: 'autorizada', totalNota: 999 }, { emissao: '2026-09-01', situacao: 'cancelada', totalNota: 999 }, { emissao: '2026-09-01', situacao: 'autorizada', operacao: 'entrada', totalNota: 999 }], '2026-10-21'), 150);
});

test('reforma tributária: IBS/CBS por ano e por regime', () => {
  const N = require('../js/notas.js');
  const emp = { regime: 'presumido', uf: 'GO', cnpj: '11222333000181' };
  const nf = { emissao: '2026-09-10', destinatario: { uf: 'GO', orgaoPublico: true }, itens: [{ quantidade: 10, valorUnitario: 100 }] };
  let t = N.calcular(nf, emp).totais;
  // 2026, ano de teste: base sem PIS (6,50) e COFINS (30,00) = 963,50; CBS 0,9% e IBS 0,1%; total da nota não muda
  assert.equal(t.rtc.situacao, 'teste'); assert.equal(t.rtc.base, 963.5); assert.equal(t.rtc.cbs, 8.67); assert.equal(t.rtc.ibs, 0.96); assert.equal(t.total, 1000);
  assert.match(N.infoComplementar(nf, emp, t), /caráter de teste/);
  // Simples em 2026: sem destaque
  assert.equal(N.calcular(nf, { regime: 'simples', uf: 'GO' }).totais.rtc.destaca, false);
  // 2027: PIS/COFINS extintos, CBS cheia, IBS 0,1%, redutor de compra governamental, IPI zerado
  const nf27 = Object.assign({}, nf, { emissao: '2027-02-01', compraGov: { tpEnteGov: '4', pRedutor: 10 }, itens: [{ quantidade: 10, valorUnitario: 100, aliqIpi: 5 }] });
  t = N.calcular(nf27, emp).totais;
  assert.equal(t.pis, 0); assert.equal(t.cofins, 0); assert.equal(t.ipi, 0);
  assert.equal(t.rtc.cbs, 78.3); assert.equal(t.rtc.ibs, 0.9); assert.equal(t.rtc.totalComTributos, 1079.2);
  assert.ok(N.validar(nf27, emp).some((x) => /IPI fica zerado/.test(x.msg)));
  // Simples com opção pelo regime regular em 2027 destaca; sem opção, não
  assert.equal(N.calcular(nf27, { regime: 'simples', uf: 'GO', ibsCbsRegular: true }).totais.rtc.destaca, true);
  assert.equal(N.calcular(nf27, { regime: 'simples', uf: 'GO' }).totais.rtc.destaca, false);
  // retenção federal em 2027: só IR e CSLL
  const r = N.calcular(Object.assign({}, nf27, { retencaoFederal: true }), emp).totais.retencoes;
  assert.equal(r.pis, 0); assert.equal(r.cofins, 0); assert.ok(r.ir > 0 && r.csll > 0);
  // códigos inválidos
  assert.ok(N.validar(Object.assign({}, nf, { ibsCbs: { cst: '0', cClassTrib: '1' } }), emp).filter((x) => x.nivel === 'erro').some((x) => /cClassTrib/.test(x.msg)));
});
