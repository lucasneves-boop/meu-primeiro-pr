// Seven NFe na reforma tributária: IBS/CBS de teste em 2026, Simples sem destaque, 2027 com compra governamental,
// configurações fiscais e calendário na aba Aprender.
// Uso: node testes/nf-reforma.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t;
  try {
    await pg.goto(url + '#/painel'); await pg.waitForSelector('#conteudo');
    await pg.evaluate(() => {
      Dados.e.empresas.push({ id: 'emp1', razao: 'Cliente Teste LTDA', cnpj: '11222333000181', uf: 'GO', municipio: 'Catalão', porte: 'Demais', fiscal: { regime: 'presumido', ie: '123', serie: 1, proximoNumero: 1 } }); Dados.e.empresaAtiva = 'emp1';
      Dados.e.nfCfgGuia = { guiado: false };
      Dados.e.notas = [{ id: 'nf1', tipo: 'produto', operacao: 'saida', situacao: 'rascunho', empresaId: 'emp1', natureza: 'Venda de mercadoria', emissao: '2026-09-10', destinatario: { nome: 'Município de Catalão', documento: '11222333000181', uf: 'GO', municipio: 'Catalão', orgaoPublico: true, contribuinte: false }, itens: [{ descricao: 'Papel A4', ncm: '48025610', cfop: '5102', unidade: 'UN', quantidade: 10, valorUnitario: 100 }], duplicatas: [], contrato: {}, historico: [] }];
      Dados.salvar();
    });
    await pg.goto(url + '#/notas/editar/nf1'); await pg.waitForSelector('#nf-totais');
    let tot = await pg.innerText('#nf-totais');
    ok(/IBS E CBS \(TESTE 2026\)/i.test(tot) && /CBS \(0,9%\)\s*R\$\s?8,67/.test(tot) && /IBS \(0,1%\)\s*R\$\s?0,96/.test(tot), '2026, Lucro Presumido: CBS 0,9% e IBS 0,1% sobre a base sem PIS/COFINS');
    ok(/Total da nota\s*R\$\s?1\.000,00/.test(tot), 'valores de teste não entram no total da nota');
    ok(!!(await pg.$('[data-k="ibsCbs.cClassTrib"]')) && /caráter de teste/.test(await pg.innerText('#nf-inf')), 'campos CST/cClassTrib e frase de teste nas informações complementares');
    await pg.fill('[data-k="ibsCbs.cClassTrib"]', '12'); await pg.press('[data-k="ibsCbs.cClassTrib"]', 'Tab'); await pg.waitForTimeout(200);
    ok(/cClassTrib deve ter 6 números/.test(await pg.innerText('#nf-valid')), 'valida o cClassTrib');
    await pg.fill('[data-k="ibsCbs.cClassTrib"]', '000001'); await pg.press('[data-k="ibsCbs.cClassTrib"]', 'Tab');
    await foto('nf-reforma-2026');

    // 2027: PIS/COFINS extintos, CBS cheia e compra governamental
    await pg.fill('[data-k=emissao]', '2027-02-01'); await pg.press('[data-k=emissao]', 'Tab'); await pg.waitForTimeout(300);
    await pg.goto(url + '#/notas/editar/nf1'); await pg.waitForSelector('#nf-totais');
    tot = await pg.innerText('#nf-totais');
    ok(!/\bPIS\b/.test(tot.split('IBS')[0]) && /CBS \(8,7%\)\s*R\$\s?87,00/.test(tot) && /Total com IBS\/CBS\s*R\$\s?1\.088,00/.test(tot), '2027: sem PIS/COFINS, CBS 8,7% somada ao valor cobrado');
    ok(!!(await pg.$('[data-k="compraGov.tpEnteGov"]')) && /ente comprador/.test(await pg.innerText('#nf-valid')), 'venda a órgão em 2027 pede o ente comprador');
    await pg.selectOption('[data-k="compraGov.tpEnteGov"]', '4'); await pg.fill('[data-k="compraGov.pRedutor"]', '10'); await pg.press('[data-k="compraGov.pRedutor"]', 'Tab'); await pg.waitForTimeout(250);
    ok(/CBS \(7,83%\)\s*R\$\s?78,30/.test(await pg.innerText('#nf-totais')), 'redutor de 10% das compras governamentais aplicado');

    // Simples sem opção: sem destaque; configurações mostram a opção pelo regime regular
    await pg.evaluate(() => { Dados.e.empresas[0].fiscal.regime = 'simples'; Dados.salvar(); App.redesenhar(); }); await pg.waitForTimeout(200);
    ok(/sem destaque de IBS\/CBS/.test(await pg.innerText('#nf-totais')), 'Simples Nacional: IBS/CBS no DAS, sem destaque');
    await pg.goto(url + '#/notas/config'); await pg.waitForSelector('#nf-cfg');
    await pg.check('[name=ibsCbsRegular]'); await pg.click('#nf-cfg .btn.primario'); await pg.waitForTimeout(200);
    await pg.goto(url + '#/notas/editar/nf1'); await pg.waitForSelector('#nf-totais');
    ok(/CBS \(7,83%\)/.test(await pg.innerText('#nf-totais')), 'Simples com opção pelo regime regular passa a destacar em 2027');

    await pg.goto(url + '#/notas/aprender'); await pg.waitForSelector('.nf-cal');
    ok(await pg.locator('.nf-cal li').count() === 5 && /03\/08\/2026/.test(await pg.innerText('.nf-cal')), 'calendário da reforma na aba Aprender');
    await foto('nf-reforma-aprender');
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
