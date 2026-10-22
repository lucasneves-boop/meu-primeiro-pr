// Seven Financeiro no modelo Conta Azul: cliente/fornecedor e centro de custo no lançamento, fluxo de caixa, inadimplência e conciliação.
const path = require('path');
const { abrir } = require('./apoio.cjs');
(async () => {
  const t = await abrir(path.join(process.env.SAIDA || '/tmp', 'financas'));
  const { pg, url, ok, foto } = t;
  const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const d = n => { const x = new Date(hoje + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  await pg.goto(url + '#/financas/lancamentos'); await pg.waitForSelector('[data-novo=receita]');
  // receita com cliente, centro de custo e competência
  await pg.click('[data-novo=receita]'); await pg.fill('.modal [name=descricao]', 'Mensalidade BPO'); await pg.fill('.modal [name=valor]', '3.000,00'); await pg.fill('.modal [name=data]', d(10));
  await pg.fill('.modal [name=contato]', 'Papelaria Exemplo'); await pg.fill('.modal [name=centroCusto]', 'BPO'); await pg.fill('.modal [name=documento]', 'NF 55');
  await pg.uncheck('.modal [name=pago]'); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(200);
  const l = await pg.evaluate(() => Dados.e.financas.lancamentos.find(x => x.descricao === 'Mensalidade BPO'));
  ok(l.contato === 'Papelaria Exemplo' && l.centroCusto === 'BPO' && l.documento === 'NF 55' && l.competencia, 'lançamento com cliente, centro de custo, documento e competência');
  ok(await pg.evaluate(() => Dados.e.financas.contatos.some(c => c.nome === 'Papelaria Exemplo' && c.papel === 'cliente')), 'cliente entrou no cadastro');
  // massa: atrasado e despesa grande
  await pg.evaluate(a => { const f = Dados.e.financas; const p = f.perfilAtivo; const c = f.contas[0].id;
    f.lancamentos.push({ id: 'x1', perfil: p, tipo: 'receita', descricao: 'Parcela atrasada', valor: 800, data: a.atraso, conta: c, pago: false, contato: 'Prefeitura B' });
    f.lancamentos.push({ id: 'x2', perfil: p, tipo: 'despesa', descricao: 'Fornecedor de papel', valor: 5000, data: a.prox, conta: c, pago: false, contato: 'Distribuidora Y', centroCusto: 'BPO' });
    Dados.salvar(); }, { atraso: d(-100), prox: d(3) });
  await pg.goto(url + '#/financas/fluxo'); await pg.waitForSelector('.f-fluxo-svg');
  ok(await pg.locator('.f-fluxo-svg rect').count() === 30, 'fluxo de caixa diário de 30 dias');
  ok(/negativo em/.test(await pg.textContent('#conteudo')), 'alerta de caixa negativo');
  await pg.click('[data-dias="90"]'); await pg.waitForTimeout(150);
  ok(await pg.locator('.f-fluxo-svg rect').count() === 90, 'projeção de 90 dias');
  await foto('fluxo');
  await pg.goto(url + '#/financas/contatos'); await pg.waitForSelector('.f-kpis');
  const txt = await pg.textContent('#conteudo');
  ok(/Prefeitura B/.test(txt) && /Papelaria Exemplo/.test(txt), 'contas a receber por cliente');
  ok(await pg.locator('tr[data-ver="Prefeitura B"] td').nth(5).textContent() !== '—', 'atraso acima de 90 dias na faixa +90');
  await foto('clientes');
  // conciliação: extrato com o pagamento ao fornecedor e uma tarifa nova
  await pg.goto(url + '#/financas/conciliacao'); await pg.waitForSelector('[data-a=cz-arquivo]');
  const csv = t.arquivo('extrato.csv', 'Data;Descrição;Valor\n' + d(4).split('-').reverse().join('/') + ';PAG FORNEC DISTRIB Y;-5000,00\n' + d(1).split('-').reverse().join('/') + ';TARIFA PACOTE;-39,90\n');
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('[data-a=cz-arquivo]')]); await fc.setFiles(csv);
  await pg.waitForSelector('[data-a=cz-ok]');
  ok(/Baixar/.test(await pg.textContent('#cz-res')) && /Criar lançamento/.test(await pg.textContent('#cz-res')), 'sugere baixa e lançamento novo');
  await foto('conciliacao');
  await pg.click('[data-a=cz-ok]'); await pg.waitForTimeout(200);
  const r = await pg.evaluate(() => ({ x2: Dados.e.financas.lancamentos.find(l => l.id === 'x2'), tarifa: Dados.e.financas.lancamentos.find(l => /TARIFA/.test(l.descricao)) }));
  ok(r.x2.pago && r.x2.conciliado, 'conta a pagar baixada pela conciliação');
  ok(r.tarifa && r.tarifa.pago && r.tarifa.tipo === 'despesa', 'tarifa criada como despesa paga');
  await pg.goto(url + '#/financas/relatorios'); await pg.waitForTimeout(300);
  ok(/Resultado por centro de custo/.test(await pg.textContent('#conteudo')), 'relatório por centro de custo');
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.goto(url + '#/financas/fluxo'); await pg.waitForSelector('.f-fluxo-svg');
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'fluxo sem rolagem horizontal no celular');
  await t.fechar();
})().catch(e => { console.error(e); process.exit(1); });
