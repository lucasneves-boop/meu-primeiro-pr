// Ágora (rede social): dois profissionais conectados ao mesmo servidor simulado do Firebase.
// Uso: node testes/agora.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { servidorFirebase } = require('./firebase-simulado.cjs');
const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');

(async () => {
  const fb = await servidorFirebase(); const t = await abrir(saida); const { ok, url, foto } = t; const A = t.pg;
  const ctxB = await A.context().browser().newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' }); const B = await ctxB.newPage();
  const errosB = []; B.on('pageerror', e => errosB.push(e.message));
  const submit = (pg) => pg.click('.modal [type=submit]');
  const entrar = async (pg, nome, cargo, handle) => {
    await pg.goto(url); await pg.evaluate((u) => { Dados.e.agoraCfg = { modo: 'firebase', url: u, token: '', comunidade: 'licitantes', eu: null }; Dados.salvar(); }, fb.url);
    await pg.goto(url + '#/agora'); await pg.reload(); await pg.waitForSelector('.modal [name=nome]');
    await pg.fill('.modal [name=nome]', nome); if (handle) await pg.fill('.modal [name=handle]', handle); await pg.selectOption('.modal [name=cargo]', cargo);
    await submit(pg); ok(await pg.locator('.modal').count() === 1, nome + ': precisa aceitar as regras');
    await pg.check('.modal [name=regras]'); await submit(pg); await pg.waitForSelector('.go-comp textarea');
  };
  const postar = async (pg, texto, sel) => { const ta = pg.locator((sel || '.go-centro > .go-comp') + ' textarea'); await ta.click(); await ta.fill(''); await ta.type(texto); await pg.locator((sel || '.go-centro > .go-comp') + ' .go-postar').click(); };
  try {
    await entrar(A, 'Lucas Neves', 'Consultor(a)');
    ok(await A.locator('.go-eu small').innerText() === '@lucasneves', '@ gerado do nome');
    ok(await A.locator('.go-con.ok').count() === 1, 'conectado à comunidade');
    await postar(A, 'Edital exigindo atestado de 100% do quantitativo. Cabe #impugnacao? Veja https://pncp.gov.br/app/editais #Lei14133');
    await A.waitForSelector('.go-post .go-txt a.go-tag');
    ok(await A.locator('.go-post .go-txt a[href^="https://pncp.gov.br"]').count() === 1, 'post com link e hashtags');
    ok(await A.locator('.go-trend:has-text("#impugnacao")').count() === 1, 'hashtag em "O que está acontecendo"');

    await entrar(B, 'Ana Souza', 'Pregoeiro(a) / agente de contratação', 'ana_pregoeira');
    await B.waitForSelector('.go-post:has-text("atestado de 100%")'); ok(true, 'segundo profissional vê o post no feed Para você');
    await B.click('.go-sug:has-text("Lucas Neves") [data-ag=seguir]'); await B.waitForTimeout(200);
    await B.click('[data-ag=aba][data-v=seguindo]'); ok(await B.locator('.go-post:has-text("atestado de 100%")').count() === 1, 'seguir e ver no feed Seguindo');
    const pB = B.locator('.go-post:has-text("atestado de 100%")');
    await pB.locator('[data-ag=curtir]').click(); await B.waitForTimeout(200);
    ok((await pB.locator('[data-ag=curtir]').innerText()).includes('1'), 'curtir');
    await pB.locator('.go-txt').click(); await B.waitForSelector('.go-foco');
    ok(await B.locator('.go-foco .go-txt.grande').count() === 1, 'abrir o post em destaque');
    await postar(B, 'Sim: exigir 100% restringe a competição. TCU costuma aceitar até 50%. @lucasneves', '.go-centro > .go-comp');
    await B.waitForSelector('.go-post:not(.go-foco):has-text("até 50%")'); ok(await B.locator('.go-post:has-text("até 50%") a.go-men').count() === 1, 'resposta com menção linkada');
    await A.waitForSelector('.go-nav .go-badge', { timeout: 5000 }); ok(Number(await A.locator('.go-nav .go-badge').innerText()) >= 3, 'notificações chegam em tempo real (seguiu, curtiu, respondeu)');
    await A.click('.go-nav a[href="#/agora/notificacoes"]'); await A.waitForSelector('.go-notif');
    const txt = await A.locator('.go-centro').innerText();
    ok(/seguiu você/.test(txt) && /curtiu seu post/.test(txt) && /respondeu/.test(txt), 'lista de notificações');
    ok(await A.locator('.go-nav .go-badge').count() === 0, 'selo zera ao abrir');
    await foto('agora-notificacoes');

    // repost, citação e enquete
    await A.goto(url + '#/agora'); await A.waitForSelector('.go-comp');
    await A.click('.go-centro > .go-comp [data-ag=enq]'); await A.fill('[data-enq="0"]', 'Impugnar'); await A.fill('[data-enq="1"]', 'Pedir esclarecimento');
    await postar(A, 'Enquete rápida: o que vocês fariam?'); await A.waitForSelector('.go-enq');
    ok(await A.locator('.go-enq-r').count() === 2, 'autor vê o resultado da própria enquete');
    await B.goto(url + '#/agora'); await B.waitForSelector('.go-enq-b'); await B.click('.go-enq-b:has-text("Impugnar")');
    await B.waitForSelector('.go-enq-r.meu'); ok(/100%/.test(await B.locator('.go-enq-r.meu').innerText()), 'votar na enquete');
    const pB2 = B.locator('.go-post:has-text("atestado de 100%")').first();
    await pB2.locator('[data-ag=repost]').click(); await submit(B); await B.waitForTimeout(200);
    await pB2.locator('[data-ag=repost]').click(); await B.check('.modal [value=cit]'); await submit(B);
    await B.fill('.modal [name=t]', 'Thread importante para quem vende ao governo'); await submit(B);
    await B.waitForSelector('.go-post:has-text("Thread importante") .go-cit'); ok(true, 'citar post (embed do original)');
    await A.goto(url + '#/agora/u/lucasneves'); await A.waitForSelector('.go-perfil');
    ok(/2/.test(await A.locator('.go-post:has-text("atestado de 100%") [data-ag=repost]').innerText()), 'repost + citação contam no original');
    ok(/1\s*Seguidores/.test(await A.locator('.go-segs').innerText()), 'contagem de seguidores');
    await foto('agora-perfil');

    // busca, tag, editar, silenciar, denúncia
    await A.fill('#go-pesq [name=q]', 'pregoeira'); await A.press('#go-pesq [name=q]', 'Enter'); await A.waitForSelector('.go-sug-l');
    ok(await A.locator('.go-sug-l:has-text("Ana Souza")').count() === 1, 'buscar pessoas pela atuação');
    await A.goto(url + '#/agora/tag/impugnacao'); ok(await A.locator('.go-post').count() === 1, 'página da hashtag');
    await A.click('.go-post [data-ag=menu]'); await A.check('.modal [value=editar]'); await submit(A);
    await A.fill('.modal [name=t]', 'Edital exigindo atestado de 100%. Cabe #impugnacao? (editado)'); await submit(A);
    await B.goto(url + '#/agora/tag/impugnacao'); await B.waitForSelector('.go-post:has-text("(editado)")'); ok(await B.locator('.go-post:has-text("(editado)") .mini:has-text("editado")').count() === 1, 'edição sincronizada e sinalizada');
    await B.click('.go-post [data-ag=menu]'); await B.check('.modal [value=silenciar]'); await submit(B);
    await B.goto(url + '#/agora'); await B.waitForSelector('.go-comp'); ok(await B.locator('.go-post .go-nome:has-text("Lucas Neves")').count() === 0, 'silenciar tira do feed');
    await B.goto(url + '#/agora/config'); await B.click('.go-sug [data-ag=dessilenciar]'); ok(await B.evaluate(() => !Object.keys(Dados.e.agoraCfg.silenciados).length), 'desfazer silenciar');
    // XSS
    await A.goto(url + '#/agora'); await A.waitForSelector('.go-comp');
    await postar(A, '<img src=x onerror="window.__xss=1"> teste'); await A.waitForTimeout(300);
    ok(await A.evaluate(() => !window.__xss) && await B.evaluate(() => !window.__xss), 'texto do post não executa HTML');
    await A.goto(url + '#/agora'); await A.waitForSelector('.go-post'); await foto('agora-feed');
    await A.setViewportSize({ width: 390, height: 844 }); await A.reload(); await A.waitForSelector('.go-post');
    ok(await A.evaluate(() => document.documentElement.scrollWidth <= 392), 'celular sem rolagem horizontal'); await foto('agora-celular');
    ok(!errosB.length, 'sem erros de JavaScript no segundo navegador' + (errosB.length ? ': ' + errosB[0] : ''));
  } catch (e) { console.error(e.message || e); await t.foto('erro'); await ctxB.close(); fb.fechar(); process.exit(1); }
  await ctxB.close(); fb.fechar(); await t.fechar();
})();
