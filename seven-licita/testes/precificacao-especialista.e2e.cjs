// Seven Precificação nível especialista: Simples por anexo, ICMS com crédito, órgão com atraso real, regimes, SRP,
// reforma tributária, preço de mercado do PNCP, exequibilidade em PDF, IN 05/2017 no serviço e comissão única na planilha.
// Uso: node testes/precificacao-especialista.e2e.cjs [pasta-de-capturas]   (LIBS_PDF=pasta com html2canvas e jspdf, sem internet)
const path = require('path'); const fs = require('fs'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto, arquivo } = t;
  if (process.env.LIBS_PDF) await pg.context().route(/cdnjs\.cloudflare\.com\/ajax\/libs\/(html2canvas|jspdf)\//, r => { const f = /html2canvas/.test(r.request().url()) ? 'html2canvas.min.js' : 'jspdf.umd.min.js'; r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(process.env.LIBS_PDF, f)) }); });
  const preenche = async (n, v) => { await pg.fill('[name=' + n + ']', v); await pg.press('[name=' + n + ']', 'Tab'); await pg.waitForTimeout(80); };
  const res = () => pg.innerText('#p-res');
  try {
    await pg.goto(url + '#/painel'); await pg.waitForSelector('#conteudo');
    await pg.evaluate(() => {
      const d = Dados.e; d.empresas.push({ id: 'emp1', razao: 'Cliente Teste LTDA', fantasia: 'Cliente Teste', cnpj: '12345678000190', uf: 'GO', representante: 'Fulano' }); d.empresaAtiva = 'emp1';
      d.analises = [{ q: { termo: 'papel a4' }, amostras: [10, 11, 12, 13, 20].map((u, k) => ({ descricao: 'Papel A4 75 g resma 500 folhas', unitario: u, referencia: 16, data: '2026-0' + (k + 1) + '-10', orgao: 'Órgão ' + k, uf: 'GO', unidade: 'RESMA' })) }];
      Dados.salvar();
    });

    // 1. Simples Nacional pelo anexo e pela receita dos últimos 12 meses
    await pg.goto(url + '#/precificacao'); await pg.waitForSelector('[name=custo]');
    await preenche('rbt12', '500000'); await pg.waitForTimeout(250);
    ok(/^6,73/.test(await pg.inputValue('[name=impostos]')) && (await pg.inputValue('[name=rbt12]')) === '500.000,00' && /efetiva 6,73%/.test(await pg.innerText('#p-form')), 'Anexo I com RBT12 de R$ 500 mil: alíquota efetiva 6,73% (faixa 3) preenche o DAS');
    ok(!(await pg.$('[name=icmsVenda]')), 'no Simples (abaixo do sublimite) o ICMS fica dentro do DAS');

    // 2. Lucro Presumido: ICMS na venda com crédito da compra e ICMS-ST
    await pg.selectOption('[name=regime]', 'presumido'); await pg.waitForSelector('[name=icmsVenda]');
    await preenche('nome', 'Papel A4 75 g resma'); await preenche('custo', '10'); await preenche('icmsVenda', '17'); await preenche('icmsCredito', '12'); await preenche('icmsST', '0,50');
    await preenche('despesasFixas', '0'); await preenche('taxaMes', '0'); await preenche('margem', '10');
    let r = await res();
    ok(/ICMS na venda\s*R\$/.test(r) && /Crédito de ICMS da compra\s*-?R\$\s?-?1,20|Crédito de ICMS da compra\s*−?R\$/.test(r) && /ICMS-ST pago na compra\s*R\$\s?0,50/.test(r), 'composição com ICMS na venda, crédito de 12% da compra e ST');
    ok(/Comparar regimes tributários/i.test(r) && /\(atual\)/.test(r) && /Simples Nacional/.test(r) && /Lucro Real/.test(r), 'compara Simples, Presumido e Real');

    // 3. Preço de mercado (PNCP) a partir das pesquisas salvas
    ok(/Preço de mercado \(PNCP\) · 5 homologaç/i.test(r) && /Mediana\s*R\$\s?12,00/.test(r), 'preço de mercado: 5 homologações, mediana R$ 12,00');
    ok(/p-mercado-pos/.test(await pg.innerHTML('#p-res')), 'posição do preço frente ao mercado');

    // 4. Órgão com histórico real de pagamento, SRP e reforma tributária
    await preenche('quantidade', '100'); await preenche('custosParticipacao', '200'); await preenche('inflacaoAno', '6'); await preenche('mesesCompra', '6');
    r = await res();
    ok(/Custos de participação \(rateados\)\s*R\$\s?2,00/.test(r) && /Reajuste esperado até a compra\s*R\$\s?0,30/.test(r), 'custos de participação rateados (R$ 200 ÷ 100) e reajuste de 6% a.a. em 6 meses');
    ok(/30% da ata\s*30/.test(r), 'cenários da ata (30%, 60%, 100% da quantidade)');
    ok(/Reforma tributária/.test(r) && /2033/.test(await pg.innerHTML('#p-res')), 'simulação da reforma tributária até 2033');
    const precoDe = t => Number((t.match(/R\$\s?([\d.]+,\d\d)/) || [])[1].replace(/\./g, '').replace(',', '.'));
    await preenche('taxaMes', '2'); const semAtraso = precoDe(await res());
    await preenche('atrasoOrgao', '60'); const comAtraso = precoDe(await res());
    ok(comAtraso > semAtraso, 'atraso real do órgão (60 dias) aumenta o custo financeiro e o preço (' + semAtraso + ' → ' + comAtraso + ')');

    // 5. Comissão da Seven: um campo só (a antiga taxa da Seven foi unificada)
    ok(!(await pg.$('[name=taxaBpo]')) && /Comissão da Seven/.test(await pg.innerText('#p-form')), 'sem campo separado de taxa da Seven');
    await foto('precificacao-especialista');

    // 6. Planilha de exequibilidade em PDF
    const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click('[data-a=exequibilidade]')]);
    const pdf = arquivo('exequibilidade.pdf', ''); await dl.saveAs(pdf);
    ok(/exequibilidade/.test(dl.suggestedFilename()) && fs.readFileSync(pdf).slice(0, 4).toString() === '%PDF', 'planilha de exequibilidade baixada em PDF');

    // 7. Serviço com os módulos da IN SEGES 05/2017
    await pg.goto(url + '#/precificacao/servico'); await pg.waitForSelector('[name=salario]');
    await preenche('salario', '2000'); await pg.check('[name=detalharEncargos]'); await pg.waitForSelector('[name=in_sub22]');
    const s = await pg.innerText('#s-res');
    ok(/Encargos pela IN SEGES 05\/2017/i.test(s) && /Encargos \(2 \+ 3 \+ 4\)\s*R\$\s?1\.37\d,\d\d\s*68,\d\d%/.test(s), 'encargos detalhados por módulo (≈ 68,9% sobre R$ 2.000)');
    await foto('precificacao-in05');

    // 8. Planilha de vários itens: comissão unificada, Simples por anexo e exequibilidade de todos os itens
    await pg.evaluate(() => { Dados.e.planilhasPreco = [{ id: 'pp1', nome: 'Antiga', empresaId: 'emp1', modalidade: 'Pregão', numero: '9/2026', orgao: 'Prefeitura', params: { regime: 'presumido', impostos: 5.93, comissao: 2, comissaoBase: 'preco', taxaBpo: 3, bpoBase: 'preco', margem: 10, despesasFixas: 0, taxaMes: 0 }, itens: [{ id: 'i1', numero: 1, descricao: 'Papel A4 75 g resma', unidade: 'RESMA', quantidade: 10, custo: 10, referencia: 16, modo: 'margem', params: {} }, { id: 'i2', numero: 2, descricao: 'Caneta azul', unidade: 'UN', quantidade: 50, custo: 1, modo: 'margem', params: {} }] }]; Dados.salvar(); });
    await pg.goto(url + '#/precificacao/lote'); await pg.waitForSelector('.pp-tab');
    ok((await pg.inputValue('#pp-glob [name=comissao]')) === '5' && !(await pg.$('#pp-glob [name=taxaBpo]')), 'planilha antiga: comissão 2% + taxa 3% viram Comissão da Seven de 5%');
    ok(/PNCP: mediana R\$\s?12,00/.test(await pg.innerText('.pp-tab')), 'preço de mercado ao lado do item');
    ok(!!(await pg.$('#pp-glob [name=icmsVenda]')) && !!(await pg.$('#pp-glob [name=custosParticipacao]')) && !!(await pg.$('#pp-glob [name=atrasoOrgao]')), 'parâmetros globais de ICMS, participação e atraso do órgão');
    await pg.selectOption('#pp-glob [name=regime]', 'simples'); await pg.waitForSelector('#pp-glob [name=rbt12]');
    await pg.fill('#pp-glob [name=rbt12]', '500000'); await pg.press('#pp-glob [name=rbt12]', 'Tab'); await pg.waitForTimeout(250);
    ok(/^6,73/.test(await pg.inputValue('#pp-glob [name=impostos]')), 'Simples na planilha: alíquota efetiva pelo anexo');
    const [dl2] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click('[data-a=exequibilidade]')]);
    ok(/exequibilidade/.test(dl2.suggestedFilename()), 'exequibilidade de todos os itens da planilha em PDF');
    await foto('planilha-especialista');
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'sem rolagem horizontal');
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
