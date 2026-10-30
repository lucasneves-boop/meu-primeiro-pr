// Recursos premium: equalizador/velocidade/timer de sono no player e leitura em voz alta no Seven E-Reader.
const path = require('path');
const { abrir } = require('./apoio.cjs');
(async () => {
  const t = await abrir(path.join(process.env.SAIDA || '/tmp', 'premium'), { args: ['--autoplay-policy=no-user-gesture-required'] });
  const { pg, url, ok, foto } = t;
  await pg.goto(url + '#/musicas'); await pg.waitForTimeout(400);
  await pg.evaluate(async () => {
    // 2 s de tom em WAV
    const sr = 8000, n = sr * 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf); const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / sr * 2 * Math.PI * 440) * 8000, true);
    await Dados.guardarArquivo('mu-teste', new Blob([buf], { type: 'audio/wav' }));
    const m = Dados.e.musicas = Dados.e.musicas || { faixas: [], playlists: [], externos: [], recentes: [], volume: 0.8 };
    m.faixas.push({ id: 'f1', titulo: 'Tom de teste', artista: 'Seven', arquivo: 'mu-teste', duracao: 2 }); Dados.salvar();
    await Player.tocarFila(['f1'], 0);
  });
  await pg.waitForSelector('#player [data-p=ajustes]');
  await pg.click('#player [data-p=ajustes]'); await pg.waitForSelector('.pl-aj');
  ok(await pg.locator('.pl-aj [data-banda]').count() === 5, 'equalizador de 5 bandas');
  await pg.click('.pl-aj [data-eq=graves]'); await pg.click('.pl-aj [data-vel="1.25"]');
  const a = await pg.evaluate(() => Dados.e.musicas.ajustes);
  ok(a.eq === 'graves' && a.ganhos[0] === 6 && a.vel === 1.25, 'predefinição Graves e velocidade 1,25× salvas');
  await pg.click('.pl-aj [data-sono="15"]'); ok(/15 min/.test(await pg.textContent('.pl-aj')), 'timer de sono ligado');
  await foto('player-ajustes');
  // Seven E-Reader: ouvir
  await pg.goto(url + '#/leitor'); await pg.waitForTimeout(300);
  const temVoz = await pg.evaluate(() => !!window.speechSynthesis);
  await pg.evaluate(async () => {
    const txt = 'Capítulo 1\n\nA licitação é o procedimento. ' + 'Texto de exemplo. '.repeat(200);
    await Dados.guardarArquivo('lv-teste', new Blob([txt], { type: 'text/plain' }));
    const d = Dados.e; d.leitor = d.leitor || { livros: [], colecoes: [], pref: {} };
    d.leitor.livros.push({ id: 'l1', titulo: 'Manual', autor: 'Seven', formato: 'txt', arquivo: 'lv-teste', destaques: [], marcadores: [], adicionadoEm: new Date().toISOString() }); Dados.salvar();
  });
  await pg.goto(url + '#/leitor/ler/l1'); await pg.waitForSelector('.kd-leitor [data-k=ouvir]', { timeout: 8000 });
  await pg.click('[data-k=ouvir]'); await pg.waitForSelector('#kd-painel:not([hidden]) h3');
  ok(/Ouvir o livro/.test(await pg.textContent('#kd-painel')), 'painel Ouvir no Seven E-Reader');
  if (temVoz) { await pg.click('[data-k=tts-play]'); await pg.waitForTimeout(300); ok(/Lendo agora|Pausar/.test(await pg.textContent('#kd-painel')), 'leitura em voz alta começou'); await pg.click('[data-k=tts-parar]'); }
  await foto('leitor-ouvir');
  await t.fechar();
})().catch(e => { console.error(e); process.exit(1); });
