// Design no padrão Canva Pro: efeitos de texto, gradiente, ícones, gráficos, fotos (filtro, moldura, remover fundo),
// camadas, grupos, pincel de estilo, kit de marca, redimensionar, versões, apresentação e exportação.
const path = require('path'); const fs = require('fs');
const { abrir } = require('./apoio.cjs');
(async () => {
  const t = await abrir(path.join(process.env.SAIDA || '/tmp', 'design'));
  const { pg, url, ok, foto, arquivo } = t;
  const sub = () => pg.click('.modal [type=submit]');
  const d0 = () => pg.evaluate(() => { const d = Dados.e.design.designs.find(x => location.hash.indexOf(x.id) >= 0); return d; });
  const ultimo = () => pg.evaluate(() => { const d = Dados.e.design.designs.find(x => location.hash.indexOf(x.id) >= 0); const p = d.paginas[0].elementos; return p[p.length - 1]; });
  const ultId = async () => (await ultimo()).id;
  const clicarEl = async (id, shift) => { const b = await pg.locator(`.ds-paginas .ds-el[data-id="${id}"]`).boundingBox(); if (shift) await pg.keyboard.down('Shift'); await pg.mouse.click(b.x + Math.min(12, b.width / 2), b.y + Math.min(12, b.height / 2)); if (shift) await pg.keyboard.up('Shift'); };

  await pg.goto(url + '#/design'); await pg.waitForSelector('.ds-formato');
  ok(await pg.locator('.ds-formato').count() === 16, '15 formatos + personalizado');
  ok(await pg.locator('.ds-modelo').count() === 10, '10 modelos Seven');
  await pg.waitForTimeout(600); await foto('ds-inicio');

  // Modelo com gradiente, destaque, sombra e ícone
  await pg.click('.ds-modelo[data-m="post-dica"]'); await pg.waitForSelector('.ds-paginas .ds-pg');
  ok(/linear-gradient/.test(await pg.getAttribute('.ds-paginas .ds-pg', 'style')), 'fundo com gradiente');
  ok(await pg.locator('.ds-paginas .ds-dest').count() === 1 && await pg.locator('.ds-paginas .ds-caminho svg path').count() === 1, 'texto com destaque e ícone vetorial');
  await pg.waitForTimeout(800); await foto('ds-modelo-dica');
  // exporta e guarda para comparar com a tela
  const png = await pg.evaluate(async () => { const d = Dados.e.design.designs.find(x => location.hash.indexOf(x.id) >= 0); const cv = await Telas.design._renderizar(d, d.paginas[0], 0.5); return cv.toDataURL('image/png'); });
  arquivo('ds-export-dica.png', Buffer.from(png.split(',')[1], 'base64'));
  await pg.locator('.ds-paginas .ds-pg-caixa').screenshot({ path: path.join(t.saida, 'ds-tela-dica.png') });

  // Efeitos de texto
  await pg.click('[data-aba=texto]'); await pg.click('[data-add=titulo]'); const tid = await ultId();
  await pg.click('#ds-props [data-a=efeitos]'); await pg.waitForSelector('.ds-efeitos');
  await pg.click('[data-efeito=neon]'); let x = await ultimo(); ok(x.sombra && x.sombra.blur > 0 && x.sombra.dx === 0, 'efeito neon');
  await pg.click('[data-efeito=contorno]'); x = await ultimo(); ok(x.contorno && !x.sombra, 'efeito contorno troca o anterior');
  ok(/text-stroke/.test(await pg.getAttribute(`.ds-paginas .ds-el[data-id="${tid}"]`, 'style')), 'contorno aparece na tela');
  await pg.click('[data-eftog=sombra]'); x = await ultimo(); ok(x.sombra && x.contorno, 'sombra ligada junto com o contorno');
  await pg.locator('[data-ef="sombra.blur"]').fill('40'); x = await ultimo(); ok(x.sombra.blur === 40, 'faixa ajusta o desfoque da sombra');
  await pg.click('[data-eftog=curva]'); await pg.waitForSelector(`.ds-paginas .ds-el[data-id="${tid}"] canvas`); x = await ultimo(); ok(x.curva === 50 && x.w > 0, 'texto curvo');
  await foto('ds-efeitos');

  // Forma com gradiente
  await pg.click('[data-aba=elementos]'); await pg.click('[data-add=hexagono]'); const hid = await ultId();
  await pg.click('#ds-props [data-a=efeitos]'); await pg.click('[data-preench=linear]'); x = await ultimo();
  ok(x.tipo === 'poligono' && x.lados === 6 && x.grad && x.grad.tipo === 'linear', 'hexágono com gradiente');
  ok(await pg.locator(`.ds-paginas .ds-el[data-id="${hid}"] linearGradient`).count() === 1, 'gradiente no SVG');
  await pg.click('[data-elgrad="1"]');
  // Ícone e forma por caminho
  await pg.click('[data-aba=elementos]'); await pg.click('[data-icone=trofeu]'); x = await ultimo(); ok(x.tipo === 'caminho' && x.forma === 'trofeu', 'ícone adicionado');
  await pg.click('[data-forma=balao]'); x = await ultimo(); ok(x.tipo === 'caminho' && !x.prop, 'balão de fala');
  await pg.click('[data-linha=tracejado]'); x = await ultimo(); ok(x.estilo === 'tracejado' && await pg.locator(`.ds-paginas .ds-el[data-id="${x.id}"] rect`).count() > 3, 'linha tracejada');

  // Gráfico
  await pg.click('[data-aba=elementos]'); await pg.click('[data-grafico=colunas]'); await pg.waitForSelector('#ds-gdados');
  await pg.fill('#ds-gdados', 'Disputados; 12\nVencidos; 5\nEm recurso; 2'); await pg.waitForTimeout(500);
  x = await ultimo(); ok(x.tipo === 'grafico' && x.dados.length === 3 && x.dados[0].v === 12, 'dados do gráfico');
  await pg.fill('[data-ef=titulo]', 'Pregões no trimestre'); await pg.click('[data-gtipo=rosca]'); x = await ultimo(); ok(x.tipoG === 'rosca' && x.titulo === 'Pregões no trimestre', 'gráfico de rosca com título');
  ok(await pg.locator(`.ds-paginas .ds-el[data-id="${x.id}"] canvas`).count() === 1, 'gráfico desenhado');
  await foto('ds-grafico');

  // Foto: envio, filtro, moldura e remoção de fundo
  const fotoPng = await pg.evaluate(() => { const c = document.createElement('canvas'); c.width = 240; c.height = 180; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 240, 180); g.fillStyle = '#b68d40'; g.beginPath(); g.arc(120, 90, 60, 0, 7); g.fill(); g.fillStyle = '#0a1929'; g.fillRect(95, 65, 50, 50); return c.toDataURL('image/png'); });
  const arq = arquivo('produto.png', Buffer.from(fotoPng.split(',')[1], 'base64'));
  await pg.click('[data-aba=uploads]'); const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('[data-a=upload]')]); await fc.setFiles(arq);
  await pg.waitForSelector('.ds-ups [data-up] img[src^="blob:"]'); await pg.click('.ds-ups [data-up]'); const iid = await ultId();
  await pg.click('#ds-props [data-a=foto]'); await pg.waitForSelector('.ds-filtros');
  await pg.click('[data-filtro=pb]'); ok(/grayscale\(100%\)/.test(await pg.getAttribute(`.ds-paginas .ds-el[data-id="${iid}"] img`, 'style')), 'filtro P&B aplicado');
  await pg.locator('[data-ef="ajustes.brilho"]').fill('130'); x = await ultimo(); ok(x.ajustes.brilho === 130, 'ajuste de brilho');
  await pg.click('[data-mascara=circulo]'); ok(/ellipse/.test(await pg.getAttribute(`.ds-paginas .ds-el[data-id="${iid}"] .ds-msk`, 'style')), 'moldura circular');
  const antes = (await ultimo()).arq; await pg.click('[data-a=remover-fundo]'); await pg.waitForFunction((a) => { const d = Dados.e.design.designs.find(x => location.hash.indexOf(x.id) >= 0); const p = d.paginas[0].elementos; return p[p.length - 1].arq !== a; }, antes);
  ok(await pg.evaluate(() => Dados.e.design.uploads.length) === 2, 'fundo removido vira nova imagem (original preservada)');
  await foto('ds-foto');

  // Camadas, ocultar, grupos e pincel
  await pg.click('[data-aba=camadas]'); const nEl = (await d0()).paginas[0].elementos.length;
  ok(await pg.locator('.ds-camadas li').count() === nEl, 'painel de camadas lista todos os elementos');
  const primeira = pg.locator('.ds-camadas li').first(); const lid = await primeira.getAttribute('data-lid');
  await primeira.locator('[data-cam=oculto]').click(); ok(await pg.locator(`.ds-paginas .ds-el[data-id="${lid}"]`).isHidden(), 'ocultar camada');
  await pg.locator('.ds-camadas li').first().locator('[data-cam=oculto]').click();
  await foto('ds-camadas');
  await pg.keyboard.press('Escape');
  const mover = (id, px, py) => pg.evaluate(([i, a, b]) => { const d = Dados.e.design.designs.find(x => location.hash.indexOf(x.id) >= 0); const e = d.paginas[0].elementos.find(y => y.id === i); e.x = a; e.y = b; d.paginas[0].elementos.push(d.paginas[0].elementos.splice(d.paginas[0].elementos.indexOf(e), 1)[0]); App.redesenhar(); }, [id, px, py]);
  await mover(hid, 60, 60); await mover(tid, 600, 40);
  await clicarEl(hid); await clicarEl(tid, true);
  await pg.click('#ds-props [data-a=agrupar]');
  await pg.click('.ds-area', { position: { x: 5, y: 300 } }); await clicarEl(hid);
  ok(await pg.evaluate(() => document.querySelectorAll('.ds-paginas .ds-el.sel').length) === 2, 'clicar num item seleciona o grupo');
  await pg.keyboard.press('Control+Shift+G'); await pg.click('.ds-area', { position: { x: 5, y: 300 } });
  await pg.click('[data-aba=texto]'); await pg.click('[data-add=corpo]'); const cid = await ultId();
  await clicarEl(cid); await pg.selectOption('#ds-props [data-prop-sel=fonte]', 'Cinzel'); await pg.click('#ds-props [data-a=pincel]');
  await pg.click('[data-aba=texto]'); await pg.click('[data-add=subtitulo]'); const sid = await ultId(); await mover(cid, 80, 880); await mover(sid, 80, 980);
  await pg.click('.ds-area', { position: { x: 5, y: 300 } }); await clicarEl(cid); await pg.click('#ds-props [data-a=pincel]'); await clicarEl(sid);
  ok(await pg.evaluate((i) => { const d = Dados.e.design.designs.find(x => location.hash.indexOf(x.id) >= 0); return d.paginas[0].elementos.find(e => e.id === i).fonte; }, sid) === 'Cinzel', 'pincel copia o estilo');

  // Kit de marca
  await pg.click('[data-aba=marca]'); const nc = await pg.evaluate(() => Dados.e.design.kit.cores.length);
  await pg.locator('#ds-kit-cor').evaluate((i) => { i.value = '#1f7a4a'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  ok(await pg.evaluate(() => Dados.e.design.kit.cores.length) === nc + 1, 'cor adicionada ao kit de marca');
  await pg.selectOption('[data-kit=fonteTitulo]', 'Playfair Display'); await pg.click('[data-a=kit-aplicar]');
  ok(await pg.evaluate(() => { const d = Dados.e.design.designs.find(x => location.hash.indexOf(x.id) >= 0); return d.paginas[0].elementos.some(e => e.tipo === 'texto' && e.fonte === 'Playfair Display'); }), 'fontes da marca aplicadas');
  await foto('ds-kit');

  // Versões
  await pg.click('[data-aba=ferramentas]'); const nv = (await d0()).versoes.length;
  await pg.click('[data-a=versao]'); await pg.fill('.modal [name=n]', 'Aprovada'); await sub(); await pg.waitForTimeout(200);
  ok((await d0()).versoes.length === nv + 1 && (await d0()).versoes.some(v => v.nome === 'Aprovada'), 'versão salva com nome');
  await pg.selectOption('[data-pref=grade]', '40'); ok(await pg.locator('.ds-paginas .ds-grade').count() === 1, 'grade na página');
  await foto('ds-ferramentas'); await pg.selectOption('[data-pref=grade]', '0');

  // Apresentar
  await pg.click('[data-a=apresentar]'); await pg.waitForSelector('.ds-apresentar .ds-pg'); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(t.saida, 'ds-apresentar.png') });
  await pg.keyboard.press('Escape'); await pg.waitForSelector('.ds-apresentar', { state: 'detached' }); ok(true, 'modo apresentação abre e fecha');

  // Exportar PNG com fundo transparente
  const [dl] = await Promise.all([pg.waitForEvent('download'), (async () => { await pg.click('.ds-topo [data-a=baixar]'); await pg.check('.modal [name=transp]'); await sub(); })()]);
  const b = fs.readFileSync(await dl.path()); ok(b.slice(1, 4).toString() === 'PNG' && b[25] === 6 && b.readUInt32BE(16) === 1080 && b.readUInt32BE(20) === 1350, 'PNG 1080×1350 com transparência');
  const tudo = await pg.evaluate(async () => { const d = Dados.e.design.designs.find(x => location.hash.indexOf(x.id) >= 0); const cv = await Telas.design._renderizar(d, d.paginas[0], 0.6); return cv.toDataURL('image/png'); });
  arquivo('ds-export-final.png', Buffer.from(tudo.split(',')[1], 'base64'));
  await pg.click('.ds-area', { position: { x: 5, y: 300 } }); await pg.waitForTimeout(300);
  await pg.locator('.ds-paginas .ds-pg-caixa').first().screenshot({ path: path.join(t.saida, 'ds-tela-final.png') });

  // Redimensionar mágico
  const idAntigo = (await d0()).id;
  await pg.click('.ds-topo [data-a=redimensionar]'); await pg.selectOption('.modal [name=f]', 'story'); await sub();
  await pg.waitForFunction((i) => location.hash.indexOf(i) < 0, idAntigo); await pg.waitForSelector('.ds-paginas .ds-pg');
  const nd = await d0(); ok(nd.w === 1080 && nd.h === 1920 && nd.paginas[0].elementos.length === nEl + 2, 'cópia redimensionada para story');
  await pg.waitForTimeout(500); await foto('ds-story');
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(400); await foto('ds-celular');
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'sem rolagem lateral no celular');
  await t.fechar();
})().catch(e => { console.error(e); process.exit(1); });
