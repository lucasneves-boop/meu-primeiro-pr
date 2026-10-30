// Seven E-Reader: seleção e destaque limpos (palavras inteiras, sem "pular" para o fim do texto), sublinhado,
// cores com significado, caderno, Raio-X, revisão, envio à Seven Not, estatísticas e destaques no PDF (um bloco por linha).
// Uso: LIBS_PDF=<pasta com pdf.min.js e pdf.worker.min.js> node testes/ereader.e2e.cjs [pasta-de-capturas]
const path = require('path'); const fs = require('fs'); const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
(async () => {
  const t = await abrir(saida); const { pg, ok, url, foto } = t;
  if (process.env.LIBS_PDF) await pg.context().route(/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/.*\/(pdf\.min|pdf\.worker\.min)\.js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(process.env.LIBS_PDF, r.request().url().split('/').pop())) }));
  await pg.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  const paragrafo = (i) => 'Parágrafo ' + i + '. O licitante deverá apresentar a proposta comercial e os documentos de habilitação no prazo de 3 (três) dias úteis, contados da convocação do pregoeiro, sob pena de desclassificação. A garantia de proposta será de 1% do valor estimado de R$ 250.000,00, conforme a Lei nº 14.133/2021, art. 58.';
  const texto = Array.from({ length: 40 }, (_, i) => paragrafo(i + 1)).join('\n\n');
  try {
    await pg.goto(url + '#/painel'); await pg.waitForSelector('#conteudo');
    ok(/Seven E-Reader/.test(await pg.innerText('.menu a[data-rota=leitor]')), 'menu: Seven E-Reader');
    let pdf = null;
    if (process.env.LIBS_PDF) { const p2 = await pg.context().newPage(); await p2.setContent('<h1>Edital</h1>' + Array.from({ length: 10 }, (_, i) => '<p style="font:15px serif">' + paragrafo(i + 1) + '</p>').join('')); pdf = (await p2.pdf({ format: 'A4' })).toString('base64'); await p2.close(); await pg.bringToFront(); }
    await pg.evaluate(async ([tx, pdfB64]) => {
      await Dados.guardarArquivo('lv-txt', new Blob([tx], { type: 'text/plain' }));
      const d = Dados.e; d.leitor = { livros: [], colecoes: [], pref: { fonte: 'Literata', tamanho: 19, espaco: 1.6, margem: 'm', alinhar: 'justify', tema: 'branco', colunas: 'auto', brilho: 1 } };
      d.leitor.livros.push({ id: 't1', titulo: 'Edital TXT', formato: 'txt', tipo: 'documento', arquivo: 'lv-txt', destaques: [], marcadores: [], colecoes: [], adicionadoEm: new Date().toISOString() });
      if (pdfB64) { await Dados.guardarArquivo('lv-pdf', new Blob([Uint8Array.from(atob(pdfB64), (c) => c.charCodeAt(0))], { type: 'application/pdf' })); d.leitor.livros.push({ id: 'p1', titulo: 'Edital PDF', formato: 'pdf', tipo: 'documento', arquivo: 'lv-pdf', destaques: [], marcadores: [], colecoes: [], adicionadoEm: new Date().toISOString() }); }
      Dados.salvar();
    }, [texto, pdf]);

    // 1. TXT: arrastar entre linhas seleciona só o trecho, até palavras inteiras, e abre o menu sozinho
    await pg.goto(url + '#/leitor/ler/t1'); await pg.waitForSelector('#kd-txt p'); await pg.waitForTimeout(600);
    const ps = await pg.$$('#kd-txt p'); const b1 = await ps[2].boundingBox(); const b2 = await ps[3].boundingBox();
    await pg.mouse.move(b1.x + 34, b1.y + b1.height / 2); await pg.mouse.down(); await pg.mouse.move(b2.x + b2.width * 0.55, b2.y + 12, { steps: 14 }); await pg.mouse.up();
    await pg.waitForSelector('#kd-pop:not([hidden])');
    const sel = await pg.evaluate(() => getSelection().toString());
    ok(sel.length > 40 && sel.length < 600, 'seleção do tamanho do trecho arrastado (' + sel.length + ' caracteres), sem pular para o fim do documento');
    ok(/^[\p{L}\p{N}]/u.test(sel) && /[\p{L}\p{N}.,]$/u.test(sel.trim()), 'seleção começa e termina em palavras inteiras');
    ok(await pg.locator('#kd-pop .kd-cor').count() === 6 && /Seven IA/.test(await pg.innerText('#kd-pop')) && /Sublinhar/.test(await pg.innerText('#kd-pop')), 'menu com 6 cores, sublinhado e ferramentas');
    await foto('ereader-menu');
    await pg.keyboard.press('2'); await pg.waitForTimeout(200); // atalho: 2ª cor (verde, "Prazo")
    let d = await pg.evaluate(() => Dados.e.leitor.livros[0].destaques[0]);
    ok(d && d.cor === 'verde' && d.texto === sel.replace(/\s*\n\s*/g, ' ').trim(), 'atalho 2 destaca em verde (Prazo) com o texto exato');
    ok(await pg.locator('mark.kd-hl.verde').count() >= 1, 'destaque pintado no texto');

    // 2. clicar no destaque: mudar para sublinhado
    await pg.click('mark.kd-hl.verde >> nth=0'); await pg.waitForSelector('#kd-pop:not([hidden])');
    await pg.click('#kd-pop [data-k=estilo][data-v=sublinhado]'); await pg.waitForTimeout(150);
    ok(await pg.evaluate(() => Dados.e.leitor.livros[0].destaques[0].estilo) === 'sublinhado' && await pg.locator('mark.kd-hl.sub').count() >= 1, 'destaque vira sublinhado');
    await pg.keyboard.press('Escape');

    // 3. duplo clique seleciona a palavra
    const b5 = await (await pg.$$('#kd-txt p'))[5].boundingBox();
    await pg.mouse.dblclick(b5.x + 140, b5.y + 12); await pg.waitForTimeout(250);
    const palavra = await pg.evaluate(() => getSelection().toString());
    ok(/^[\p{L}\p{N}-]+$/u.test(palavra), 'duplo clique seleciona uma palavra inteira ("' + palavra + '")');
    await pg.keyboard.press('Escape');

    // 4. caderno com significado das cores, revisão e envio à Seven Not
    await pg.click('[data-k=caderno]'); await pg.waitForSelector('.kd-filtros');
    const cad = await pg.innerText('#kd-painel');
    ok(/Prazo\s*1/.test(cad) && /Exigência/.test(cad) && /Risco/.test(cad), 'caderno mostra as cores com significado e contagem');
    await pg.click('[data-k=revisar]'); await pg.waitForSelector('.kd-flash'); ok(true, 'revisão de destaques (cartões)'); await pg.click('.modal [type=submit]');
    await pg.click('[data-k=notas-not]'); await pg.waitForTimeout(200);
    ok(await pg.evaluate(() => (Dados.e.anotacoes && Dados.e.anotacoes.notas || []).some((n) => /Destaques: Edital TXT/.test(n.titulo))), 'destaques enviados para a Seven Not');
    await foto('ereader-caderno');

    // 5. Raio-X do documento
    await pg.click('[data-k=raiox]'); await pg.waitForSelector('.kd-rx button');
    const rx = await pg.innerText('#kd-painel');
    ok(/Prazos/i.test(rx) && /3 \(três\) dias úteis/.test(rx) && /R\$ 250\.000,00/.test(rx) && /Lei nº 14\.133\/2021/.test(rx) && /sob pena de/i.test(rx), 'Raio-X: prazos, valores, leis e palavras de atenção');
    await foto('ereader-raiox');
    await pg.click('.kd-rx button >> nth=0'); await pg.waitForSelector('#kd-res li'); ok(true, 'item do Raio-X abre a busca no documento');

    // 6. exibição: régua de leitura, luz quente e rótulos editáveis
    await pg.click('[data-k=aa]'); await pg.waitForSelector('[data-k=regua]');
    await pg.click('[data-k=regua]'); ok(await pg.evaluate(() => document.querySelector('.kd-leitor').classList.contains('regua')), 'régua de leitura ligada');
    await pg.fill('[data-rotulo=verde]', 'Prazo fatal'); await pg.dispatchEvent('[data-rotulo=verde]', 'input');
    ok(await pg.evaluate(() => Dados.e.leitor.pref.rotulos.verde) === 'Prazo fatal', 'significado da cor editável');
    await foto('ereader-aa');
    await pg.click('[data-k=fechar-painel]');

    // 7. estatísticas na biblioteca
    await pg.evaluate(() => { Dados.e.leitor.stats = EReader.registrarTempo({}, 25); Dados.salvar(); });
    await pg.click('[data-k=sair]'); await pg.waitForSelector('.kd-stats');
    const st = await pg.innerText('.kd-stats'); ok(/Hoje\s*2[56] min/.test(st), 'estatísticas de leitura na biblioteca (' + st.replace(/\s+/g, ' ') + ')');

    // 8. PDF: destaque com um bloco por linha, palavras inteiras
    if (pdf) {
      await pg.goto(url + '#/leitor/ler/p1'); await pg.waitForSelector('.textLayer span', { timeout: 15000 }); await pg.waitForTimeout(500);
      const sp = await pg.$$('.textLayer span'); const a = await sp[2].boundingBox(); const z = await sp[5].boundingBox();
      await pg.mouse.move(a.x + 20, a.y + a.height / 2); await pg.mouse.down(); await pg.mouse.move(z.x + z.width * 0.5, z.y + z.height / 2, { steps: 12 }); await pg.mouse.up();
      await pg.waitForSelector('#kd-pop:not([hidden])'); await pg.click('#kd-pop [data-v=amarelo]'); await pg.waitForTimeout(250);
      const dp = await pg.evaluate(() => Dados.e.leitor.livros.find((l) => l.id === 'p1').destaques[0]);
      const tops = dp.pos.rects.map((r) => r[1]); const unicos = new Set(tops.map((x) => x.toFixed(3)));
      ok(dp.pos.rects.length === unicos.size && dp.pos.rects.length >= 1 && dp.pos.rects.length <= 6, 'PDF: ' + dp.pos.rects.length + ' bloco(s), um por linha');
      ok(/^[\p{L}\p{N}]/u.test(dp.texto), 'PDF: destaque começa numa palavra inteira');
      await foto('ereader-pdf');
    }

    // 9. celular: sem rolagem lateral e menu cabe na tela
    await pg.setViewportSize({ width: 390, height: 844 }); await pg.goto(url + '#/leitor/ler/t1'); await pg.waitForSelector('#kd-txt p'); await pg.waitForTimeout(500);
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'celular: sem rolagem horizontal');
  } catch (e) { console.error(e.message || e); await foto('erro'); process.exit(1); }
  await t.fechar();
})();
