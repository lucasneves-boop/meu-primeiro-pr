// Seven Comissão → Licitações ganhas: lançar a licitação ganha, carteira por cliente, empenho/NF/pagamento e integração.
// Uso: node testes/comissao-ganhas.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t;
  if (process.env.LIBS_PDF) await pg.context().route(/cdnjs\.cloudflare\.com\/ajax\/libs\/(html2canvas|jspdf)\//, r => { const f = /html2canvas/.test(r.request().url()) ? 'html2canvas.min.js' : 'jspdf.umd.min.js'; r.fulfill({ status: 200, contentType: 'text/javascript', body: require('fs').readFileSync(path.join(process.env.LIBS_PDF, f)) }); });
  const hoje = new Date(); const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  try {
    await pg.goto(url); await pg.evaluate(() => { const d = Dados.e; d.empresas.push({ id: 'cA', razao: 'Alfa Distribuidora LTDA', fantasia: 'Alfa' }, { id: 'cB', razao: 'Beta Serviços LTDA', fantasia: 'Beta' }); d.empresaAtiva = 'cA'; d.comissao = { base: 'venda', pct: '5' }; Dados.salvar(); });
    await pg.goto(url + '#/comissao/ganhas'); await pg.waitForSelector('#cm-ganha-f');
    ok(await pg.locator('.cm-ganha[open]').count() === 1, 'formulário aberto quando ainda não há licitações ganhas');
    await pg.fill('#cm-ganha-f [name=orgao]', 'Prefeitura de Catalão'); await pg.fill('#cm-ganha-f [name=numero]', 'PE 90012/2026'); await pg.fill('#cm-ganha-f [name=objeto]', 'Gêneros alimentícios');
    await pg.fill('#cm-ganha-f [name=valor]', '120.000,00'); await pg.fill('#cm-ganha-f [name=contrato]', 'CT 45/2026');
    ok(await pg.locator('#cm-portais option').count() >= 25 && await pg.locator('#cm-portais option[value="BEC/SP"]').count() === 1, 'campo Portal com todos os portais (e aceita digitar outro)');
    await pg.fill('#cm-ganha-f [name=uasg]', '926789'); await pg.selectOption('#cm-ganha-f [name=uf]', 'GO'); await pg.fill('#cm-ganha-f [name=municipio]', 'Catalão'); await pg.fill('#cm-ganha-f [name=portal]', 'Compras.gov.br');
    await pg.fill('#cm-ganha-f [name=valorEstimado]', '150.000'); await pg.fill('#cm-ganha-f [name=itens]', 'Lote 2: arroz, feijão e óleo'); await pg.check('#cm-ganha-f [name=srp]');
    await pg.fill('#cm-ganha-f [name=gestor]', 'Maria Souza'); await pg.fill('#cm-ganha-f [name=prazoPagamento]', '30'); await pg.fill('#cm-ganha-f [name=garantia]', '5');
    await pg.click('.cm-exec-ini summary'); await pg.fill('#cm-ganha-f [name=emp_num]', '2026NE0001'); await pg.fill('#cm-ganha-f [name=emp_valor]', '120.000');
    await pg.fill('#cm-ganha-f [name=nf_num]', '501'); await pg.fill('#cm-ganha-f [name=nf_valor]', '60.000'); await pg.fill('#cm-ganha-f [name=nf_data]', iso(hoje)); await pg.fill('#cm-ganha-f [name=nf_venc]', iso(hoje));
    await pg.fill('#cm-ganha-f [name=pg_valor]', '40.000'); await pg.fill('#cm-ganha-f [name=pg_data]', iso(hoje));
    await pg.click('#cm-ganha-f .btn.primario'); await pg.waitForSelector('.cm-relatorio table');
    let txt = await pg.innerText('.cm-relatorio');
    ok(/Licitações ganhas\s*1/.test(txt) && /Valor ganho\s*R\$\s?120\.000,00/.test(txt) && /Empenhado\s*R\$\s?120\.000,00/.test(txt) && /Faturado\s*R\$\s?60\.000,00/.test(txt) && /Recebido\s*R\$\s?40\.000,00/.test(txt), 'lança a licitação ganha com a execução já feita');
    ok(/Comissão gerada \(contratos\)\s*R\$\s?6\.000,00/.test(txt) && /Comissão a cobrar\s*R\$\s?2\.000,00/.test(txt), 'comissão gerada e a cobrar');
    const card = await pg.evaluate(() => { const q = Dados.e.quadros.find(x => x.listas.some(l => l.nome === 'Oportunidade')); const c = q.cartoes.find(k => k.lancadaManual); return c && { desc: c.descricao, uasg: c.licitacao.uasg, srp: c.licitacao.srp, venc: c.execucao.notas[0].vencimento, lista: q.listas.find(l => l.id === c.lista).nome, ganha: c.etiquetas.some(id => q.etiquetas.find(e => e.id === id).nome === 'Ganha'), empresa: c.empresaId, orgao: c.valores.orgao, contrato: c.execucao.numero }; });
    ok(card && card.lista === 'Contrato' && card.ganha && card.empresa === 'cA' && card.orgao === 'Prefeitura de Catalão' && card.contrato === 'CT 45/2026', 'cartão criado no Seven Processo (Contrato, Ganha, cliente e órgão)');
    ok(card.uasg === '926789' && card.srp && /UASG 926789 · Catalão\/GO/.test(card.desc) && /deságio 20,0%/.test(card.desc) && /Gestor: Maria Souza/.test(card.desc), 'UASG, local, deságio e gestor no cartão');
    ok(/UASG 926789 · GO · Compras.gov.br/.test(txt) && /deságio 20%/.test(txt), 'carteira mostra UASG, UF, portal e deságio');
    // segunda licitação, outro cliente
    await pg.click('.cm-ganha > summary'); await pg.selectOption('#cm-ganha-f [name=cliente]', 'cB'); await pg.fill('#cm-ganha-f [name=orgao]', 'Governo de Goiás'); await pg.fill('#cm-ganha-f [name=objeto]', 'Limpeza predial'); await pg.fill('#cm-ganha-f [name=valor]', '80.000'); await pg.selectOption('#cm-ganha-f [name=modalidade]', 'Dispensa eletrônica');
    await pg.click('#cm-ganha-f .btn.primario'); await pg.waitForTimeout(200);
    ok(await pg.inputValue('#cm-gf [name=cliente]') === 'cB', 'mostra a carteira do cliente lançado');
    await pg.selectOption('#cm-gf [name=cliente]', ''); await pg.waitForTimeout(150);
    ok(await pg.locator('.cm-relatorio section.cartao').count() === 2 && /Valor ganho\s*R\$\s?200\.000,00/.test(await pg.innerText('.cm-relatorio')), 'todos os clientes: um bloco por cliente e total geral');
    // registrar NF e pagamento pela carteira
    await pg.selectOption('#cm-gf [name=cliente]', 'cB'); await pg.waitForTimeout(150);
    ok(await pg.locator('[data-a=add-pg][disabled]').count() === 1, 'pagamento só depois da NF');
    await pg.click('[data-a=add-nf]'); await pg.fill('.modal [name=n]', '77'); await pg.fill('.modal [name=v]', '80.000'); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(200);
    await pg.click('[data-a=add-pg]'); ok(await pg.inputValue('.modal [name=v]') === '80000', 'pagamento sugere o valor em aberto da NF'); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(200);
    txt = await pg.innerText('.cm-relatorio'); ok(/Recebido\s*R\$\s?80\.000,00/.test(txt) && /A receber\s*R\$\s?0,00/.test(txt), 'NF e pagamento registrados na execução');
    // editar
    await pg.selectOption('#cm-gf [name=cliente]', 'cA'); await pg.waitForTimeout(150);
    await pg.click('[data-a=editar]'); await pg.waitForSelector('.modal [name=uasg]');
    ok(await pg.inputValue('.modal [name=uasg]') === '926789' && await pg.inputValue('.modal [name=gestor]') === 'Maria Souza', 'editar abre com os dados lançados');
    await pg.fill('.modal [name=valor]', '125.000'); await pg.selectOption('.modal [name=etapa]', 'Entrega'); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(200);
    ok(/Valor ganho\s*R\$\s?125\.000,00/.test(await pg.innerText('.cm-relatorio')) && /Entrega/.test(await pg.innerText('.cm-relatorio tbody')), 'edição atualiza valor e etapa');
    await pg.click('[data-a=add-nf]'); await pg.waitForSelector('.modal [name=venc]'); ok(/^\d{4}-\d{2}-\d{2}$/.test(await pg.inputValue('.modal [name=venc]')), 'NF sugere vencimento pelo prazo de pagamento'); await pg.click('.modal .cancelar');
    await foto('comissao-ganhas');
    // integração com as outras abas
    await pg.goto(url + '#/relatorios/base'); await pg.waitForSelector('#rl-f'); await pg.waitForTimeout(150);
    ok(/Ganhas no período\s*2/.test(await pg.innerText('.cm-relatorio')) && /Recebido no período\s*R\$\s?120\.000,00/.test(await pg.innerText('.cm-relatorio')), 'Seven Relatórios conta as licitações lançadas');
    await pg.goto(url + '#/comissao/extrato'); await pg.waitForSelector('#cm-ext-f'); await pg.selectOption('#cm-ext-f [name=cliente]', ''); await pg.waitForTimeout(150); ok(await pg.locator('.cm-relatorio tbody tr').count() === 2, 'extrato com a comissão de cada pagamento');
    // busca e PDF
    await pg.goto(url + '#/comissao/ganhas'); await pg.waitForSelector('#cm-gf'); await pg.fill('#cm-gf [name=busca]', 'catalão'); await pg.waitForTimeout(500);
    ok(await pg.locator('.cm-relatorio tbody tr:not(.cm-total)').count() === 1, 'busca por órgão');
    if (process.env.LIBS_PDF) { const [arq] = await Promise.all([pg.waitForEvent('download', { timeout: 60000 }), pg.click('[data-a=pdf]')]); ok(/^seven-comissao-carteira-/.test(arq.suggestedFilename()), 'carteira em PDF'); }
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
