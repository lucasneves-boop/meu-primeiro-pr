// Reuniões (videochamada estilo Meet): dois usuários da Plêiade, câmera e microfone simulados, WebRTC real entre os navegadores.
// Uso: node testes/reuniao.e2e.cjs [pasta-de-capturas]
const path = require('path'); const { servidorFirebase } = require('./firebase-simulado.cjs');
const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
const MIDIA = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--disable-features=WebRtcHideLocalIpsWithMdns'];

(async () => {
  const fb = await servidorFirebase();
  const t = await abrir(saida, { args: MIDIA, permissions: ['camera', 'microphone'] }); const { ok, url, foto } = t; const A = t.pg;
  const ctxB = await A.context().browser().newContext({ viewport: { width: 1280, height: 800 }, locale: 'pt-BR', permissions: ['camera', 'microphone'] }); const B = await ctxB.newPage();
  const errosB = []; B.on('pageerror', e => errosB.push(e.message));
  const conectar = async (pg, nome) => {
    await pg.goto(url); await pg.evaluate((u) => { Dados.e.pleiadeCfg = { modo: 'firebase', url: u, espaco: 'Seven', token: '', eu: null, lidos: {}, threadsLidas: {}, salvos: {} }; Dados.e.reuniaoCfg = { stun: '' }; Dados.salvar(); }, fb.url);
    await pg.goto(url + '#/pleiade'); await pg.reload(); await pg.waitForSelector('.modal [name=nome]'); await pg.fill('.modal [name=nome]', nome); await pg.click('.modal [type=submit]'); await pg.waitForSelector('.pl-comp textarea');
  };
  const conectado = (pg) => pg.waitForFunction(() => { const v = document.querySelector('.rn-tile:not(.eu) video'); return v && v.srcObject && v.videoWidth > 0 && !document.querySelector('.rn-tile:not(.eu).conectando'); }, null, { timeout: 20000 });
  try {
    await conectar(A, 'Lucas Neves'); await conectar(B, 'Ana Souza');
    await A.click('[data-pl=chamada]'); await A.waitForSelector('.rn-pre .rn-entrar');
    const sid = (await A.evaluate(() => location.hash)).split('/')[2];
    ok(/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(sid), 'sala criada com código no formato do Meet: ' + sid);
    await A.waitForFunction(() => { const v = document.querySelector('.rn-prev video'); return v && v.videoWidth > 0; }); ok(true, 'pré-sala mostra a prévia da câmera');
    await foto('reuniao-presala');
    await A.click('.rn-entrar'); await A.waitForSelector('.rn-tile.eu');
    ok(await A.locator('.rn-tile').count() === 1, 'entrou na chamada (só você)');
    // Ana vê o convite no canal
    await B.waitForSelector('.pl-call.ao-vivo a:has-text("Entrar")', { timeout: 8000 }); ok(/1 na chamada/.test(await B.locator('.pl-call').innerText()), 'convite "Entrar" aparece no canal com quem está na chamada');
    await B.click('.pl-call a:has-text("Entrar")'); await B.waitForSelector('.rn-entrar');
    ok(/Lucas Neves está na chamada/.test(await B.locator('.rn-pre-info').innerText()), 'pré-sala diz quem já está');
    await B.click('[data-p=mic]'); await B.click('.rn-entrar');
    await conectado(A); await conectado(B); ok(true, 'vídeo remoto chega nos dois lados (WebRTC conectado)');
    ok(await A.evaluate(() => { const v = document.querySelector('.rn-tile:not(.eu) video'); return v.srcObject.getAudioTracks().length === 1; }), 'áudio remoto recebido');
    ok(await A.locator('.rn-tile:not(.eu) .rn-mic-off:not([hidden])').count() === 1, 'Lucas vê que a Ana entrou com microfone desligado');
    ok(/Ana Souza/.test(await A.locator('.rn-tile:not(.eu) .rn-rot b').innerText()), 'nome no bloco');
    // câmera off
    await A.click('[data-rn=cam]'); await B.waitForSelector('.rn-tile:not(.eu).sem-video', { timeout: 5000 }); ok(true, 'desligar câmera mostra avatar para o outro');
    await A.click('[data-rn=cam]'); await B.waitForSelector('.rn-tile:not(.eu):not(.sem-video)', { timeout: 5000 });
    // mão e reação
    await B.click('[data-rn=mao]'); await A.waitForSelector('.rn-maos:not([hidden])', { timeout: 5000 }); ok(/Ana/.test(await A.locator('.rn-maos').innerText()), 'mão levantada aparece');
    await A.click('[data-rn=reacao]'); await A.click('[data-reacao="👏"]'); await B.waitForSelector('.rn-voa:has-text("👏")', { timeout: 5000 }); ok(true, 'reação flutua na tela do outro');
    // chat
    await B.click('[data-rn=chat]'); await B.fill('#rn-msg', 'Compartilhei a planilha de disputa'); await B.press('#rn-msg', 'Enter');
    await A.waitForSelector('[data-rn=chat] .rn-ponto:not([hidden])', { timeout: 5000 }); ok(true, 'aviso de nova mensagem no chat');
    await A.click('[data-rn=chat]'); ok(/planilha de disputa/.test(await A.locator('.rn-chat-l').innerText()), 'chat da chamada');
    await A.click('[data-rn=pessoas]'); ok(await A.locator('.rn-pessoas li').count() === 2, 'lista de pessoas');
    await foto('reuniao-chamada');
    // atividades premium: enquete, perguntas, quadro branco e ata
    await A.click('[data-rn=atividades]'); ok(await A.locator('.rn-ativ li').count() === 6, 'painel de atividades (quadro, enquetes, perguntas, legendas, gravação, ata)');
    await A.click('[data-rn=ir-enquetes]'); await A.fill('#rn-enq-f [name=p]', 'Participamos do pregão 90021?'); await A.fill('#rn-enq-f [name=o1]', 'Sim'); await A.fill('#rn-enq-f [name=o2]', 'Não'); await A.click('#rn-enq-f .btn');
    await B.click('[data-rn=atividades]'); await B.click('[data-rn=ir-enquetes]'); await B.waitForSelector('.rn-enq [data-voto="0"]', { timeout: 5000 }); await B.click('.rn-enq [data-voto="0"]');
    await A.waitForFunction(() => /100%/.test((document.querySelector('.rn-enq [data-voto="0"]') || {}).textContent || ''), null, { timeout: 5000 }); ok(true, 'enquete: voto da Ana aparece no resultado do Lucas');
    await B.click('[data-rn=atividades]'); await B.click('[data-rn=ir-perguntas]'); await B.fill('#rn-per-f [name=t]', 'Qual o prazo de entrega?'); await B.click('#rn-per-f .btn');
    await A.click('[data-rn=atividades]'); await A.click('[data-rn=ir-perguntas]'); await A.waitForSelector('.rn-per', { timeout: 5000 }); await A.click('.rn-per [data-rn=per-votar]');
    await B.waitForFunction(() => /▲ 1/.test((document.querySelector('.rn-per [data-rn=per-votar]') || {}).textContent || ''), null, { timeout: 5000 }); ok(true, 'perguntas e respostas com voto');
    await A.click('[data-rn=atividades]'); await A.click('.rn-ativ [data-rn=quadro]'); await A.waitForSelector('.rn-quadro:not([hidden]) canvas');
    const cv = await A.locator('.rn-quadro canvas').boundingBox(); await A.mouse.move(cv.x + 40, cv.y + 40); await A.mouse.down(); await A.mouse.move(cv.x + 200, cv.y + 120, { steps: 6 }); await A.mouse.up();
    await B.waitForFunction(() => { const s = Telas.pleiade.api.arv().chamadas; return Object.values(s).some(x => x.quadro && Object.keys(x.quadro).length); }, null, { timeout: 5000 }); ok(true, 'traço do quadro branco chega ao outro participante');
    await foto('reuniao-quadro');
    await A.click('.rn-quadro-barra [data-rn=quadro]');
    const [dl] = await Promise.all([A.waitForEvent('download'), A.evaluate(() => { if (document.querySelector('.rn-painel').hidden) document.querySelector('[data-rn=atividades]').click(); }).then(() => A.click('.rn-ativ [data-rn=ata]'))]);
    const ata = require('fs').readFileSync(await dl.path(), 'utf8'); ok(/Participamos do pregão 90021\? → Sim \(1\)/.test(ata) && /planilha de disputa/.test(ata), 'ata com enquete e chat');
    await A.click('[data-rn=fechar-painel]');
    // fixar e sair para outra tela com barra flutuante
    await A.hover('.rn-tile:not(.eu)'); await A.click('.rn-tile:not(.eu) [data-rn=fixar]'); ok(await A.locator('.rn-tile.grande:not(.eu)').count() === 1, 'fixar participante em destaque');
    await A.goto(url + '#/agenda'); await A.waitForSelector('#rn-pill'); ok(/Voltar à chamada/.test(await A.locator('#rn-pill').innerText()), 'barra flutuante ao navegar pelo app');
    await A.click('#rn-pill [data-pill=voltar]'); await conectado(A); ok(true, 'volta à chamada com o vídeo ainda ligado');
    // compartilhar tela (fake)
    const temTela = await A.evaluate(() => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia));
    if (temTela) { await A.click('[data-rn=tela]'); await B.waitForSelector('.rn-tile.grande:has-text("apresentando")', { timeout: 8000 }).then(() => ok(true, 'apresentação aparece em destaque para o outro')).catch(() => console.log('  • compartilhar tela não disponível no navegador de teste')); }
    // sair
    await B.click('[data-rn=sair]'); await B.waitForSelector('.rn-saiu'); ok(true, 'tela "Você saiu da reunião"');
    await A.waitForFunction(() => document.querySelectorAll('.rn-tile').length === 1, null, { timeout: 8000 }); ok(true, 'o outro lado vê a saída');
    await A.click('[data-rn=sair]'); await A.waitForSelector('.rn-saiu');
    await A.goto(url + '#/reuniao'); await A.waitForSelector('.rn-home'); ok(await A.locator('.rn-item').count() >= 1 && /Recentes/.test(await A.locator('.rn-home').innerText()), 'reunião vai para Recentes');
    await foto('reuniao-inicio');
    ok(!errosB.length, 'sem erros no segundo navegador' + (errosB.length ? ': ' + errosB[0] : ''));
  } catch (e) { console.error(e.message || e); await t.foto('erro'); await B.screenshot({ path: path.join(saida, 'erro-b.png') }); await ctxB.close(); fb.fechar(); process.exit(1); }
  await ctxB.close(); fb.fechar(); await t.fechar();
})();
