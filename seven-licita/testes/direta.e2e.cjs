// Seven Reunião · chamada direta (1 a 1) sem modo equipe: o PeerJS é trocado por uma ponte local (BroadcastChannel)
// e o vídeo passa por WebRTC real entre duas abas, com câmera e microfone simulados.
// Uso: node testes/direta.e2e.cjs [pasta-de-capturas]
const path = require('path');
const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas');
const MIDIA = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--disable-features=WebRtcHideLocalIpsWithMdns'];

const PEER_FALSO = `(function () {
  const bc = new BroadcastChannel('peer-falso');
  function Em() { this.h = {}; }
  Em.prototype.on = function (k, f) { (this.h[k] = this.h[k] || []).push(f); return this; };
  Em.prototype.emit = function (k) { const a = [].slice.call(arguments, 1); (this.h[k] || []).forEach(function (f) { f.apply(null, a); }); };
  function Conn(peer, outro, cid) { Em.call(this); this.peer = peer; this.outro = outro; this.cid = cid; this.open = false; }
  Conn.prototype = Object.create(Em.prototype);
  Conn.prototype.send = function (d) { bc.postMessage({ k: 'data', para: this.outro, de: this.peer.id, cid: this.cid, d: d }); };
  Conn.prototype.close = function () { if (!this.open) return; this.open = false; bc.postMessage({ k: 'close', para: this.outro, cid: this.cid }); this.emit('close'); };
  function Peer(id) {
    Em.call(this); const me = this; me.id = id || 'p' + Math.random().toString(36).slice(2); me.conns = {};
    bc.addEventListener('message', function (ev) {
      const m = ev.data; if (m.para !== me.id || me.destruido) return; const c = me.conns[m.cid];
      if (m.k === 'connect') { const n = me.conns[m.cid] = new Conn(me, m.de, m.cid); me.emit('connection', n); setTimeout(function () { n.open = true; n.emit('open'); bc.postMessage({ k: 'aceito', para: m.de, cid: m.cid }); }, 10); }
      if (m.k === 'aceito' && c) { c.open = true; clearTimeout(c.t); c.emit('open'); }
      if (m.k === 'data' && c) c.emit('data', m.d);
      if (m.k === 'close' && c && c.open) { c.open = false; c.emit('close'); }
    });
    setTimeout(function () { me.emit('open', me.id); }, 10);
  }
  Peer.prototype = Object.create(Em.prototype);
  Peer.prototype.connect = function (id) { const me = this; const cid = Math.random().toString(36).slice(2); const c = me.conns[cid] = new Conn(me, id, cid); bc.postMessage({ k: 'connect', para: id, de: me.id, cid: cid }); c.t = setTimeout(function () { delete me.conns[cid]; me.emit('error', { type: 'peer-unavailable' }); }, 600); return c; };
  Peer.prototype.destroy = function () { this.destruido = true; };
  window.Peer = Peer;
})();`;

(async () => {
  const t = await abrir(saida, { args: MIDIA, permissions: ['camera', 'microphone'] }); const { ok, url, foto } = t; const A = t.pg;
  await A.context().route(/cdnjs\.cloudflare\.com\/ajax\/libs\/peerjs\//, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: PEER_FALSO }));
  const B = await A.context().newPage(); const errosB = []; B.on('pageerror', e => errosB.push(e.message));
  const conectado = (pg) => pg.waitForFunction(() => { const v = document.querySelector('.dr-remoto.vivo video'); return v && v.srcObject && v.videoWidth > 0; }, null, { timeout: 20000 });
  try {
    await A.goto(url); await A.evaluate(() => { Dados.e.reuniaoCfg = { stun: '' }; Dados.salvar(); });
    await A.goto(url + '#/reuniao'); await A.waitForSelector('a[href="#/reuniao/direta"]');
    ok(/Chamada direta/.test(await A.locator('#conteudo').innerText()), 'sem modo equipe, o Seven Reunião oferece a chamada direta');
    await A.click('a[href="#/reuniao/direta"]'); await A.waitForSelector('#dr-nova');
    await A.fill('#dr-nova [name=eu]', 'Lucas Neves'); await A.fill('#dr-nova [name=c]', 'Ana Souza'); await A.click('#dr-nova .btn');
    await A.waitForSelector('.dr .dr-convite:not([hidden])');
    const cod = (await A.locator('.dr-cod').innerText()).trim();
    ok(/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(cod), 'chamada criada com código ' + cod);
    ok(/Aguardando Ana Souza/.test(await A.locator('.dr-status').innerText()), 'aguardando o convidado');
    await A.click('[data-dr=whatsapp]'); await A.waitForSelector('.modal textarea[name=t]');
    const txt = await A.inputValue('.modal textarea[name=t]');
    ok(txt.includes(cod) && txt.includes('#/reuniao/direta/' + cod) && /Lucas Neves \| Seven$/.test(txt.trim()), 'convite editável com link, código e assinatura antes de abrir o WhatsApp');
    await A.click('.modal .cancelar');
    await foto('direta-aguardando');
    // convidado
    await B.goto(url + '#/reuniao/direta/' + cod); await B.waitForSelector('#dr-entrar');
    await B.waitForFunction(() => { const v = document.querySelector('.rn-prev video'); return v && v.videoWidth > 0; }); ok(true, 'convidado vê a prévia da câmera');
    await B.fill('#dr-entrar [name=n]', 'Ana Souza'); await B.click('#dr-entrar .btn');
    await A.waitForSelector('.dr-toque:not([hidden])', { timeout: 8000 });
    ok(/Ana Souza.*quer entrar/.test(await A.locator('.dr-status').innerText()), 'anfitrião recebe o toque: "Ana Souza quer entrar"');
    await foto('direta-tocando');
    await A.click('[data-dr=atender]');
    await conectado(A); await conectado(B); ok(true, 'vídeo e áudio conectados nos dois lados (WebRTC direto)');
    ok(await A.evaluate(() => document.querySelector('.dr-remoto video').srcObject.getAudioTracks().length === 1), 'áudio remoto recebido');
    ok(/Lucas Neves/.test(await B.locator('.dr-nome').innerText()) && /Ana Souza/.test(await A.locator('.dr-nome').innerText()), 'nomes nos dois lados');
    // câmera e microfone
    await A.click('[data-dr=cam]'); await B.waitForSelector('.dr-remoto.sem-video.vivo', { timeout: 5000 }); ok(true, 'desligar câmera mostra as iniciais para o outro');
    await A.click('[data-dr=cam]'); await B.waitForSelector('.dr-remoto.vivo:not(.sem-video)', { timeout: 5000 });
    await B.click('[data-dr=mic]'); await A.waitForSelector('.dr-remoto .rn-mic-off:not([hidden])', { timeout: 5000 }); ok(true, 'microfone desligado aparece para o outro');
    // chat
    await B.locator('.rn-barra [data-dr=chat]').click(); await B.fill('#dr-msg', 'Te mandei a planilha do pregão'); await B.press('#dr-msg', 'Enter');
    await A.waitForSelector('.rn-barra [data-dr=chat] .rn-ponto:not([hidden])', { timeout: 5000 }); ok(true, 'aviso de nova mensagem');
    await A.locator('.rn-barra [data-dr=chat]').click(); ok(/planilha do pregão/.test(await A.locator('.rn-chat-l').innerText()), 'chat da chamada direta');
    await foto('direta-chamada');
    // navegar pelo app sem derrubar a chamada
    await A.evaluate(() => { location.hash = '#/agenda'; }); await A.waitForSelector('#dr-pill'); ok(/Voltar à chamada/.test(await A.locator('#dr-pill').innerText()), 'barra flutuante ao sair da tela');
    await A.click('#dr-pill [data-pill=voltar]'); await conectado(A); ok(true, 'volta à chamada com o vídeo ligado');
    // encerrar
    await B.locator('.rn-barra [data-dr=sair]').click(); await B.waitForSelector('.rn-saiu'); ok(/Chamada encerrada/.test(await B.locator('.rn-saiu').innerText()), 'convidado encerra');
    await A.waitForSelector('.rn-saiu', { timeout: 8000 }); ok(/Duração/.test(await A.locator('.rn-saiu').innerText()), 'anfitrião vê o fim com a duração');
    // recusar
    await A.click('a[href="#/reuniao/direta"]'); await A.waitForSelector('#dr-nova'); await A.click('#dr-nova .btn'); await A.waitForSelector('.dr .dr-convite:not([hidden])');
    const cod2 = (await A.locator('.dr-cod').innerText()).trim();
    await B.goto(url + '#/reuniao/direta/' + cod2); await B.waitForSelector('#dr-entrar'); await B.fill('#dr-entrar [name=n]', 'Ana Souza'); await B.click('#dr-entrar .btn');
    await A.waitForSelector('.dr-toque:not([hidden])', { timeout: 8000 }); await A.click('[data-dr=recusar]');
    await B.waitForSelector('.rn-saiu', { timeout: 8000 }); ok(/não foi atendida/.test(await B.locator('.rn-saiu').innerText()), 'recusar avisa o convidado');
    ok(/Aguardando/.test(await A.locator('.dr-status').innerText()), 'anfitrião continua aguardando');
    await A.locator('.rn-barra [data-dr=sair]').click(); await A.waitForSelector('.rn-saiu');
    // Seven Chat sem modo equipe: o botão Chamada leva à chamada direta
    await B.goto(url + '#/pleiade'); await B.waitForSelector('.modal [name=nome]'); await B.fill('.modal [name=nome]', 'Ana Souza'); await B.click('.modal [type=submit]'); await B.waitForSelector('[data-pl=chamada]');
    await B.click('[data-pl=chamada]'); await B.waitForSelector('#dr-nova'); ok(true, 'no Seven Chat, o botão 📹 Chamada abre a chamada direta (sem erro de modo equipe)');
    ok(!errosB.length, 'sem erros na aba do convidado' + (errosB.length ? ': ' + errosB[0] : ''));
  } catch (e) { console.error(e.message || e); await t.foto('erro'); await B.screenshot({ path: path.join(saida, 'erro-b.png') }); process.exit(1); }
  await t.fechar();
})();
