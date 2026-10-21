// Testes de navegador dos módulos de produtividade. Uso: node testes/modulos.e2e.cjs [pasta-de-capturas] [modulo]
const path = require('path');
const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas'); const so = process.argv[3];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAwMDAwMDAAAANAAH/7k3PZQAAAABJRU5ErkJggg==', 'base64');

const testes = {
  async nuvem(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]');
    await pg.goto(url + '#/nuvem'); await pg.waitForSelector('.nuvem');
    await pg.click('[data-a=estrutura]'); await pg.fill('.modal [name=o]', 'Papelaria Exemplo'); await pg.selectOption('.modal [name=c]', ''); await submit();
    await pg.waitForSelector('.n-pasta'); ok(await pg.locator('.n-pasta').count() >= 7, 'estrutura padrão de cliente com subpastas');
    ok(await pg.locator('.n-migalhas a').count() === 3, 'migalhas: Meu Drive › Clientes › cliente');
    await pg.dblclick('.n-pasta:has-text("02 Editais")');
    const fc = pg.waitForEvent('filechooser'); await pg.click('[data-a=upload]'); await (await fc).setFiles([t.arquivo('edital.txt', 'Edital de pregão 90021 — papel A4'), t.arquivo('foto.png', PNG)]);
    await pg.waitForSelector('.n-arq >> nth=1'); ok(await pg.locator('.n-arq').count() === 2, 'upload de arquivos para a pasta');
    await pg.dblclick('.n-arq:has-text("edital.txt")'); await pg.waitForSelector('.n-visor .n-texto'); ok(/90021/.test(await pg.locator('.n-texto').innerText()), 'visualizar arquivo de texto'); await pg.keyboard.press('Escape');
    await pg.click('[data-a=modo]'); ok(await pg.locator('.n-tabela').count() === 1, 'modo lista');
    await pg.click('tr.n-item:has-text("edital.txt") [data-menu]'); await pg.click('[data-op=renomear]'); await pg.fill('.modal [name=n]', 'Edital 90021.txt'); await submit();
    ok(await pg.locator('tr.n-item:has-text("Edital 90021.txt")').count() === 1, 'renomear');
    await pg.click('tr.n-item:has-text("Edital 90021.txt")'); await pg.click('[data-a=estrela]');
    await pg.click('[data-a=copiar]'); await submit(); await pg.waitForTimeout(300);
    ok(await pg.locator('tr.n-item:has-text("Cópia de Edital")').count() === 1, 'fazer cópia');
    await pg.click('tr.n-item:has-text("Cópia de Edital")'); await pg.click('[data-a=lixeira]');
    await pg.click('[data-secao=lixeira]'); ok(await pg.locator('.n-item').count() === 1, 'lixeira'); await pg.click('.n-item'); await pg.click('[data-a=restaurar]');
    await pg.click('[data-secao=estrela]'); ok(await pg.locator('.n-item').count() === 1, 'com estrela');
    await pg.fill('#n-busca input', 'edital'); await pg.keyboard.press('Enter'); ok(await pg.locator('.n-item').count() === 2, 'pesquisar no drive');
    await pg.click('[data-secao=drive]'); await pg.click('[data-a=modo]');
    await pg.dblclick('.n-pasta:has-text("Clientes")'); await pg.dblclick('.n-pasta:has-text("Papelaria")');
    await pg.dragAndDrop('.n-pasta:has-text("07 Recursos")', '.n-pasta:has-text("02 Editais")');
    ok(await pg.evaluate(() => { const i = Dados.e.nuvem.itens; const r = i.find(x => x.nome === '07 Recursos e peças'); return i.find(x => x.id === r.pai).nome === '02 Editais'; }), 'arrastar pasta para dentro de outra');
    await foto('nuvem');
  }
};

(async () => {
  const t = await abrir(saida);
  try { for (const k of Object.keys(testes)) { if (so && so !== k) continue; console.log('• ' + k); await testes[k](t); } }
  catch (e) { console.error(e.message || e); await t.foto('erro'); process.exit(1); }
  await t.fechar();
})();
