// Seven Clientes: carteira com a própria empresa, resultado geral e de cada empresa, filtros e atalhos.
// Uso: node testes/clientes.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t; const erros = []; pg.on('pageerror', e => erros.push(e.message));
  try {
    await pg.goto(url + '#/quadros'); await pg.waitForSelector('#botao-tema'); await pg.waitForTimeout(300);
    await pg.evaluate(() => {
      const d = Dados.e; d.empresas.push({ id: 'cA', razao: 'Alfa Distribuidora LTDA', fantasia: 'Alfa', cnpj: '11222333000181', uf: 'GO', municipio: 'Catalão' }, { id: 'cB', razao: 'Beta Engenharia LTDA', fantasia: 'Beta', cnpj: '11444777000161', uf: 'DF' });
      d.empresaAtiva = 'cA';
      const q = d.quadros.find(x => x.listas.some(l => l.nome === 'Oportunidade')); const L = n => q.listas.find(l => l.nome === n).id; const et = n => q.etiquetas.find(x => x.nome === n).id;
      const c = (titulo, lista, emp, extra) => q.cartoes.push(Object.assign({ id: 'c' + Math.random().toString(36).slice(2, 8), titulo, lista: L(lista), etiquetas: [], membros: [], checklists: [], comentarios: [], anexos: [], votos: [], valores: {}, empresaId: emp, criadoEm: new Date().toISOString(), atividade: [] }, extra));
      c('PE 1', 'Pagamento', 'cA', { etiquetas: [et('Ganha')], atividade: [{ em: new Date().toISOString(), texto: 'marcar como ganha' }], execucao: { valor: 100000, notas: [{ id: 'n1', data: new Date().toISOString().slice(0, 10), valor: 40000, vencimento: '2000-01-01' }], pagamentos: [] } });
      c('PE 2', 'Disputa', 'cB'); Dados.salvar();
    });
    await pg.goto(url + '#/empresas'); await pg.waitForSelector('.cl-emps');
    ok(await pg.locator('.menu a[data-rota=empresas] .rot').innerText() === 'Seven Clientes', 'menu: Seven Clientes');
    ok(/Resultado geral/.test(await pg.innerText('.cl-geral')) && /Valor ganho no ano\s*R\$\s?100\.000,00/.test(await pg.innerText('.cl-geral')) && /Em atraso\s*R\$\s?40\.000,00/.test(await pg.innerText('.cl-geral')), 'resultado geral somando as empresas');
    ok(await pg.locator('.cl-emp').count() === 2 && /R\$\s?40\.000,00 em atraso/.test(await pg.innerText('.cl-emp:has-text("Alfa")')), 'cartão de cada empresa com alertas');
    // minha empresa
    await pg.click('.cl-emp:has-text("Beta") [data-a=editar]'); await pg.waitForSelector('.modal [name=propria]'); await pg.check('.modal [name=propria]'); await pg.click('.modal [type=submit]'); await pg.waitForTimeout(200);
    ok(await pg.locator('.cl-emp.propria').count() === 1 && /Minha empresa/.test(await pg.innerText('.cl-emp.propria')) && await pg.locator('.cl-emp').first().evaluate(e => e.classList.contains('propria')), 'minha empresa marcada e em primeiro');
    ok(await pg.locator('#empresa-ativa optgroup[label="Minha empresa"] option').count() === 1, 'seletor do topo separa minha empresa e clientes');
    await pg.click('.cm-pilula:has(input[value=clientes])'); await pg.waitForTimeout(150); ok(await pg.locator('.cl-emp').count() === 1 && /só clientes/.test(await pg.innerText('.cl-geral')), 'filtro só clientes');
    await pg.click('.cm-pilula:has(input[value=todos])'); await pg.waitForTimeout(150);
    await pg.fill('#cl-f [name=q]', 'beta'); await pg.waitForTimeout(150); ok(await pg.locator('.cl-emp').count() === 1, 'busca');
    await pg.fill('#cl-f [name=q]', ''); await pg.waitForTimeout(150);
    await pg.click('.cl-emp.propria [data-a=ativar]'); await pg.waitForTimeout(150); ok(await pg.inputValue('#empresa-ativa') === 'cB', 'trabalhar nesta empresa troca a empresa ativa');
    await foto('clientes');
    await pg.click('.cl-emp:has-text("Alfa") [data-a=resultados]'); await pg.waitForSelector('#rl-f'); ok(await pg.inputValue('#rl-f [name=cliente]') === 'cA', 'resultados abre o relatório da empresa');
    ok(!erros.length, 'sem erros na página' + (erros.length ? ': ' + erros.join(' | ') : ''));
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
