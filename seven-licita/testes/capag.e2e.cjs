// CAPAG: nome do município pelo código IBGE (notas antigas, planilha "Instituição" do Tesouro e planilha só com código).
// Uso: node testes/capag.e2e.cjs [pasta-de-capturas]
const { abrir } = require('./apoio.cjs');
(async () => {
  const t = await abrir(process.argv[2] || require('path').join(__dirname, 'capturas')); const { pg, ok, url } = t;
  await pg.route(/pncp\.gov\.br|dadosabertos/, r => r.abort());
  await pg.goto(url);
  // situação de quem já importou: o número no lugar do nome
  await pg.evaluate(() => { const v1 = { municipio: '5205109', uf: '', ibge: '', nota: 'A', ano: '2026', fonte: 'capag.xlsx' }; const v2 = { municipio: '5300108', uf: 'DF', ibge: '5300108', nota: 'B+', ano: '2026', fonte: 'capag.xlsx' }; Dados.e.config.capag = { '5205109-': v1, '5300108': v2 }; Dados.salvar(); });
  await pg.goto(url + '#/mercado/capag');
  await pg.waitForFunction(() => /Catalão/.test(document.querySelector('#conteudo table')?.innerText || ''), null, { timeout: 8000 });
  const txt = await pg.locator('#conteudo table').innerText();
  ok(/Catalão\tGO\t5205109/.test(txt) && /Brasília\tDF\t5300108/.test(txt), 'notas antigas: nome e UF recuperados pelo código IBGE');
  ok(await pg.evaluate(() => Dados.e.config.capag['catalao-GO'] && Dados.e.config.capag['5205109'].municipio === 'Catalão'), 'nota casa com avisos pelo nome e pelo código');
  await pg.fill('#fcapag [name=texto]', 'catal'); await pg.waitForFunction(() => document.querySelectorAll('#conteudo table tbody tr').length === 1); ok(true, 'busca pelo nome do município'); await pg.fill('#fcapag [name=texto]', ''); await pg.waitForTimeout(400);
  // importação no formato "Instituição"
  const csv = t.arquivo('capag-tesouro.csv', 'Instituição;Cod.IBGE;UF;População;Indicador 1;Nota 1;CAPAG\nPrefeitura Municipal de Catalão - GO;5205109;GO;114427;0,5;A;A\nPrefeitura Municipal de Goiânia - GO;5208707;GO;1437237;0,9;C;C\n');
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('[data-a=importar]')]); await fc.setFiles(csv);
  await pg.waitForFunction(() => /Goiânia/.test(document.querySelector('#conteudo table')?.innerText || ''));
  const t2 = await pg.locator('#conteudo table').innerText(); ok(/Catalão\tGO/.test(t2) && /Goiânia\tGO\t5208707\tC/.test(t2) && !/Prefeitura/.test(t2), 'importa "Prefeitura Municipal de X - UF" com o nome limpo');
  // só código
  const csv2 = t.arquivo('capag-codigo.csv', 'Código do Município;Classificação CAPAG\n5205109;A\n5201108;B\n');
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('[data-a=importar]')]); await fc2.setFiles(csv2);
  await pg.waitForFunction(() => /Anápolis/.test(document.querySelector('#conteudo table')?.innerText || ''));
  ok(/Anápolis\tGO\t5201108\tB/.test(await pg.locator('#conteudo table').innerText()), 'planilha só com código: nome e UF pelo IBGE');
  await t.foto('capag-nomes'); await t.fechar();
})().catch(e => { console.error(e); process.exit(1); });
