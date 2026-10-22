/* Seven Reunião · Chamada direta (1 a 1): videochamada com uma pessoa sem precisar do servidor da equipe.
   A ponte entre os dois navegadores usa o PeerJS (servidor público gratuito) ou, dentro do claude.ai, a sala ao vivo do artefato.
   Vídeo e áudio vão direto de um computador ao outro (WebRTC), com o STUN/TURN das configurações de rede do Seven Reunião. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, modal, aviso } = UI;
  const C = self.Chamada;
  const PEERJS = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.browser.min.js';
  const PREFIXO = 'seven7-';
  const ASSINATURA = 'Lucas Neves | Seven';
  let ch = null;        // chamada direta em andamento
  let preparado = null; // convidado vindo do Seven Chat

  function cfg() { const d = Dados.e; d.diretaCfg = Object.assign({ nome: '' }, d.diretaCfg || {}); return d.diretaCfg; }
  function rede() { const c = Object.assign({ stun: 'stun:stun.l.google.com:19302', turn: '', turnUsuario: '', turnSenha: '' }, Dados.e.reuniaoCfg || {}); const s = []; if (c.stun) s.push({ urls: c.stun.split(/[\s,]+/).filter(Boolean) }); if (c.turn) s.push({ urls: c.turn.split(/[\s,]+/).filter(Boolean), username: c.turnUsuario, credential: c.turnSenha }); return s; }
  function meuNome() { const pl = Telas.pleiade && Telas.pleiade.api; const uid = pl && pl.eu && pl.eu(); return cfg().nome || (uid ? pl.membro(uid).nome : '') || ''; }
  function link(cod) { return location.href.split('#')[0] + '#/reuniao/direta/' + cod; }
  function idAleatorio() { return Math.random().toString(36).slice(2, 10); }
  function faixa(s, tipo) { return s ? s.getTracks().find(function (t) { return t.kind === tipo; }) : null; }
  function parar(s) { if (s) s.getTracks().forEach(function (t) { t.stop(); }); }
  function iniciais(n) { return String(n || '?').split(' ').map(function (p) { return p[0]; }).slice(0, 2).join('').toUpperCase(); }

  async function midia() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return new MediaStream();
    const t = async function (v, a) { try { return await navigator.mediaDevices.getUserMedia({ video: v ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false, audio: a ? { echoCancellation: true, noiseSuppression: true } : false }); } catch (e) { return null; } };
    return (await t(true, true)) || (await t(false, true)) || (await t(true, false)) || new MediaStream();
  }

  // ---------- ponte de sinalização: PeerJS ou sala ao vivo do artefato ----------
  function carregarPeer() {
    if (self.Peer) return Promise.resolve(self.Peer);
    return new Promise(function (ok, erro) { const s = document.createElement('script'); s.src = PEERJS; s.onload = function () { self.Peer ? ok(self.Peer) : erro(new Error('PeerJS')); }; s.onerror = function () { erro(new Error('Sem acesso ao PeerJS.')); }; document.head.appendChild(s); });
  }
  // Cada ponte entrega { enviar(msg), fechar() } e chama aoReceber(msg) com objetos { t, ... }.
  async function pontePeer(cod, anfitriao, aoReceber, aoEstado) {
    const Peer = await carregarPeer();
    const peer = new Peer(anfitriao ? PREFIXO + cod : undefined, { debug: 0, config: { iceServers: rede() } });
    await new Promise(function (ok, erro) { const t = setTimeout(function () { erro(new Error('O servidor de ponte não respondeu.')); }, 8000); peer.on('open', function () { clearTimeout(t); ok(); }); peer.on('error', function (e) { clearTimeout(t); erro(e); }); });
    let conn = null, fechado = false, tentativa = null;
    const ligar = function (c) {
      if (conn && conn !== c) { try { c.send({ t: 'ocupado' }); } catch (e) { /* ok */ } setTimeout(function () { c.close(); }, 300); return; }
      conn = c; c.on('data', function (m) { if (m && typeof m === 'object') aoReceber(m); }); c.on('close', function () { if (conn === c) { conn = null; if (!fechado) aoReceber({ t: 'caiu' }); } });
    };
    peer.on('connection', function (c) { c.on('open', function () { ligar(c); }); });
    peer.on('error', function (e) { if (e && e.type === 'peer-unavailable') aoEstado('ausente'); });
    if (!anfitriao) {
      const conectar = function () { if (fechado || conn) return; const c = peer.connect(PREFIXO + cod, { reliable: true }); c.on('open', function () { ligar(c); aoEstado('ligado'); }); tentativa = setTimeout(conectar, 4000); };
      conectar();
    }
    return {
      tipo: 'peerjs',
      pronto: function () { return !!conn; },
      enviar: function (m) { if (conn && conn.open) conn.send(m); },
      fechar: function () { fechado = true; clearTimeout(tentativa); try { if (conn) conn.close(); } catch (e) { /* ok */ } setTimeout(function () { try { peer.destroy(); } catch (e) { /* ok */ } }, 200); }
    };
  }
  // Sala ao vivo do claude.ai: mensagens até 4 KiB, por isso o texto vai em pedaços.
  async function ponteSala(cod, anfitriao, aoReceber, aoEstado) {
    const room = self.claude && self.claude.use ? await self.claude.use('room') : null;
    if (!room) throw new Error('Sala ao vivo indisponível.');
    const sala = await room.join('seven-direta-' + cod);
    const eu = idAleatorio(); let par = null; const partes = {}; let fechado = false, chamar = null;
    const bruto = function (m) { const txt = JSON.stringify(m); const id = idAleatorio(); const n = Math.ceil(txt.length / 3000) || 1; for (let i = 0; i < n; i++) sala.emit('sinal', { de: eu, para: par, id: id, i: i, n: n, p: txt.slice(i * 3000, (i + 1) * 3000) }); };
    const off = sala.on('sinal', function (msg) {
      const d = msg.data || {}; if (msg.isMe || d.de === eu || (d.para && d.para !== eu)) return;
      const b = partes[d.id] = partes[d.id] || []; b[d.i] = d.p; if (b.filter(function (x) { return x != null; }).length < d.n) return; delete partes[d.id];
      let m; try { m = JSON.parse(b.join('')); } catch (e) { return; }
      if (!par) { if (anfitriao && m.t !== 'ola') return; par = d.de; if (!anfitriao) aoEstado('ligado'); }
      else if (d.de !== par) { if (m.t === 'ola') { const p0 = par; par = d.de; bruto({ t: 'ocupado' }); par = p0; } return; }
      aoReceber(m);
    });
    if (!anfitriao) { aoEstado('ausente'); const insistir = function () { if (fechado || par) return; bruto({ t: 'ola', nome: ch && ch.meuNome }); chamar = setTimeout(insistir, 3000); }; chamar = setTimeout(insistir, 50); }
    return {
      tipo: 'sala',
      pronto: function () { return !!par; },
      enviar: function (m) { if (!(!anfitriao && m.t === 'ola')) bruto(m); },
      fechar: function () { fechado = true; clearTimeout(chamar); try { off(); sala.leave(); } catch (e) { /* ok */ } }
    };
  }
  async function abrirPonte(cod, anfitriao, aoReceber, aoEstado) {
    try { return await pontePeer(cod, anfitriao, aoReceber, aoEstado); } catch (e) {
      if (anfitriao && e && e.type === 'unavailable-id') throw e;
      if (self.claude && self.claude.use) { try { return await ponteSala(cod, anfitriao, aoReceber, aoEstado); } catch (e2) { /* sem sala */ } }
      throw e;
    }
  }

  // ---------- WebRTC (oferta com todos os candidatos, sem troca de ICE picada) ----------
  function esperarIce(pc) { if (pc.iceGatheringState === 'complete') return Promise.resolve(); return new Promise(function (ok) { const t = setTimeout(ok, 2500); pc.addEventListener('icegatheringstatechange', function () { if (pc.iceGatheringState === 'complete') { clearTimeout(t); ok(); } }); }); }
  function criarPC() {
    const pc = new RTCPeerConnection({ iceServers: rede() });
    const a = faixa(ch.local, 'audio'), v = faixa(ch.local, 'video');
    if (a) pc.addTrack(a, ch.local); else pc.addTransceiver('audio', { direction: 'recvonly' });
    if (v) pc.addTrack(v, ch.local); else pc.addTransceiver('video', { direction: 'sendrecv' });
    pc.ontrack = function (e) { ch.remoto.getTracks().filter(function (t) { return t.kind === e.track.kind; }).forEach(function (t) { ch.remoto.removeTrack(t); }); ch.remoto.addTrack(e.track); e.track.onunmute = desenhar; desenhar(); };
    pc.onconnectionstatechange = function () { if (!ch) return; if (pc.connectionState === 'connected' && !ch.conectadoEm) ch.conectadoEm = Date.now(); if (pc.connectionState === 'failed') aviso('A conexão de vídeo falhou. Se as redes bloqueiam conexão direta, configure um servidor TURN em Seven Reunião → Configurações de rede.', 'erro'); desenhar(); };
    ch.pc = pc; return pc;
  }
  async function ofertar() { const pc = criarPC(); await pc.setLocalDescription(await pc.createOffer()); await esperarIce(pc); ch.ponte.enviar({ t: 'offer', sdp: pc.localDescription.toJSON() }); }
  async function responder(sdp) { const pc = criarPC(); await pc.setRemoteDescription(sdp); await pc.setLocalDescription(await pc.createAnswer()); await esperarIce(pc); ch.ponte.enviar({ t: 'answer', sdp: pc.localDescription.toJSON() }); }
  function estado() { ch.ponte.enviar({ t: 'estado', mic: ch.mic, cam: ch.cam, tela: !!ch.tela }); }

  async function receber(m) {
    if (!ch) return;
    if (m.t === 'ola' && ch.anfitriao) {
      if (ch.fase !== 'esperando') return;
      ch.outroNome = String(m.nome || 'Convidado').slice(0, 60); ch.fase = 'tocando'; desenhar(); tocar(true);
      try { if ('Notification' in window && Notification.permission === 'granted') new Notification('📞 ' + ch.outroNome + ' quer entrar na chamada', { icon: 'img/seven-marca.png' }); } catch (e) { /* sem notificação */ }
    }
    if (m.t === 'aceito' && !ch.anfitriao) { ch.outroNome = String(m.nome || 'Anfitrião').slice(0, 60); ch.fase = 'conectando'; desenhar(); }
    if (m.t === 'recusado' && !ch.anfitriao) { encerrar('recusada'); }
    if (m.t === 'ocupado' && !ch.anfitriao) { encerrar('ocupada'); }
    if (m.t === 'offer' && !ch.anfitriao) { await responder(m.sdp); ch.fase = 'chamada'; estado(); desenhar(); }
    if (m.t === 'answer' && ch.anfitriao && ch.pc) { await ch.pc.setRemoteDescription(m.sdp); estado(); }
    if (m.t === 'estado') { ch.outro = { mic: m.mic !== false, cam: m.cam !== false, tela: !!m.tela }; desenhar(); }
    if (m.t === 'chat') { ch.chat.push({ de: 'outro', t: String(m.txt || '').slice(0, 2000), em: Date.now() }); if (!ch.painelChat) ch.chatNovo = true; desenhar(); }
    if (m.t === 'tchau' || m.t === 'caiu') { if (ch.fase === 'esperando' || ch.fase === 'tocando') { if (ch.anfitriao) { ch.fase = 'esperando'; tocar(false); desenhar(); } return; } encerrar('fim', true); }
  }

  // toque de chamada (sem arquivo de áudio)
  function tocar(on) {
    if (ch && ch.toque) { clearInterval(ch.toque.t); try { ch.toque.ctx.close(); } catch (e) { /* ok */ } ch.toque = null; }
    if (!on || !ch || !(self.AudioContext || self.webkitAudioContext)) return;
    try { const ctx = new (self.AudioContext || self.webkitAudioContext)(); const bip = function () { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 660; g.gain.value = 0.06; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.35); }; bip(); ch.toque = { ctx: ctx, t: setInterval(bip, 1500) }; } catch (e) { /* sem som */ }
  }

  // ---------- iniciar / entrar / encerrar ----------
  async function iniciar(cod, anfitriao, opc) {
    if (ch) await encerrar(null, true, true);
    ch = { cod: cod, anfitriao: anfitriao, fase: anfitriao ? 'abrindo' : 'chamando', meuNome: opc.meuNome, outroNome: opc.convidado || '', convidado: opc.convidado || '', contato: opc.contato || null, local: opc.local || await midia(), remoto: new MediaStream(), mic: opc.mic !== false, cam: opc.cam !== false, outro: { mic: true, cam: true, tela: false }, chat: [], inicio: Date.now() };
    const a = faixa(ch.local, 'audio'), v = faixa(ch.local, 'video'); ch.mic = ch.mic && !!a; ch.cam = ch.cam && !!v; if (a) a.enabled = ch.mic; if (v) v.enabled = ch.cam;
    const meu = ch;
    try { ch.ponte = await abrirPonte(cod, anfitriao, function (m) { if (ch === meu) receber(m).catch(function (e) { console.error('chamada direta', e); }); }, function (s) { if (ch !== meu) return; if (s === 'ligado' && !anfitriao && !meu.olaEnviado) { meu.olaEnviado = true; meu.ponte && meu.ponte.enviar({ t: 'ola', nome: meu.meuNome }); } if (s === 'ausente' && !anfitriao && meu.fase === 'chamando') { meu.ausente = true; desenhar(); } }); } catch (e) {
      if (ch !== meu) return;
      if (anfitriao && e && e.type === 'unavailable-id') { parar(meu.local); ch = null; return iniciar(C.codigo(), true, opc); }
      parar(meu.local); ch = null; aviso('Não foi possível abrir a chamada direta: ' + (e && e.message || 'sem conexão') + '. Verifique a internet.', 'erro'); App.redesenhar(); return;
    }
    if (ch !== meu) { meu.ponte.fechar(); return; }
    if (anfitriao) ch.fase = 'esperando';
    else if (ch.ponte.pronto() && !ch.olaEnviado) { ch.olaEnviado = true; ch.ponte.enviar({ t: 'ola', nome: ch.meuNome }); }
    ch.relogio = setInterval(function () { const d = document.querySelector('.dr-dur'); if (d && ch && ch.conectadoEm) d.textContent = C.duracao(Date.now() - ch.conectadoEm); }, 500);
    pilula(); desenhar();
  }
  async function atender(sim) {
    if (!ch || ch.fase !== 'tocando') return; tocar(false);
    if (!sim) { ch.ponte.enviar({ t: 'recusado' }); ch.fase = 'esperando'; desenhar(); return; }
    ch.ponte.enviar({ t: 'aceito', nome: ch.meuNome }); ch.fase = 'chamada'; desenhar(); await ofertar();
  }
  async function encerrar(motivo, semAviso, silencioso) {
    if (!ch) return; const c = ch; ch = null;
    tocar(false); clearInterval(c.relogio);
    try { if (c.ponte) { c.ponte.enviar({ t: 'tchau' }); setTimeout(function () { c.ponte.fechar(); }, 150); } } catch (e) { /* ok */ }
    try { if (c.pc) c.pc.close(); } catch (e) { /* ok */ }
    parar(c.local); parar(c.tela);
    pilula();
    if (silencioso) return;
    const dur = c.conectadoEm ? C.duracao(Date.now() - c.conectadoEm) : '';
    fim = { motivo: motivo || 'fim', outro: c.outroNome, dur: dur, cod: c.cod, anfitriao: c.anfitriao, saiu: !semAviso };
    if (/^#\/reuniao\/direta/.test(location.hash)) App.redesenhar(); else if (!semAviso) aviso('Chamada encerrada.');
  }
  let fim = null;
  window.addEventListener('beforeunload', function () { if (ch && ch.ponte) ch.ponte.enviar({ t: 'tchau' }); });

  // ---------- controles ----------
  function alternarMic() { const a = faixa(ch.local, 'audio'); if (!a) { aviso('Nenhum microfone disponível.', 'erro'); return; } ch.mic = !ch.mic; a.enabled = ch.mic; estado(); desenhar(); }
  function alternarCam() { const v = faixa(ch.local, 'video'); if (!v) { aviso('Nenhuma câmera disponível.', 'erro'); return; } ch.cam = !ch.cam; v.enabled = ch.cam; estado(); desenhar(); }
  function trocarVideo(track) { if (!ch.pc) return; const tr = ch.pc.getTransceivers().find(function (t) { return t.receiver.track && t.receiver.track.kind === 'video'; }); if (tr) { tr.direction = 'sendrecv'; tr.sender.replaceTrack(track); } }
  async function alternarTela() {
    if (ch.tela) { parar(ch.tela); ch.tela = null; trocarVideo(faixa(ch.local, 'video') || null); estado(); desenhar(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { aviso('Este navegador não compartilha tela.', 'erro'); return; }
    let s; try { s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); } catch (e) { return; }
    ch.tela = s; const t = faixa(s, 'video'); t.onended = function () { if (ch && ch.tela === s) alternarTela(); };
    trocarVideo(t); estado(); desenhar();
  }

  // ---------- convite (sempre com o texto aberto para revisão; quem envia é você) ----------
  function textoConvite(c) {
    return 'Olá' + (c.convidado ? ', ' + c.convidado.split(' ')[0] : '') + '! Vamos conversar por vídeo agora na Plataforma 7.\n\nEntre pelo link: ' + link(c.cod) + '\nOu abra Seven Reunião → Chamada direta e digite o código: ' + c.cod + '\n\nFunciona no navegador do computador ou do celular; é só permitir a câmera e o microfone.\n\n' + ASSINATURA;
  }
  async function convidar(via) {
    const c = ch; if (!c) return;
    const ct = c.contato || {};
    const f = await modal({ titulo: via === 'whatsapp' ? 'Convite por WhatsApp' : 'Convite por e-mail', largo: true, botao: via === 'whatsapp' ? 'Abrir WhatsApp' : 'Abrir e-mail',
      corpo: '<p class="mini mudo">Revise o texto antes de enviar. O sistema só abre o ' + (via === 'whatsapp' ? 'WhatsApp' : 'e-mail') + ' com a mensagem pronta; o envio é feito por você.</p>' +
        (via === 'whatsapp' ? campo('WhatsApp (com DDD)', '<input name="dest" inputmode="tel" value="' + esc(ct.telefone || '') + '" placeholder="(61) 98347-2232">', 'Em branco: o WhatsApp abre para você escolher o contato.') : campo('E-mail do convidado', '<input name="dest" type="email" value="' + esc(ct.email || '') + '">')) +
        campo('Mensagem', '<textarea name="t" rows="9">' + esc(textoConvite(c)) + '</textarea>') });
    if (!f) return;
    const txt = f.get('t'), dest = String(f.get('dest') || '').trim();
    if (via === 'whatsapp') { let n = dest.replace(/\D/g, ''); if (n && n.length <= 11) n = '55' + n; window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(txt), '_blank', 'noopener'); }
    else location.href = 'mailto:' + encodeURIComponent(dest) + '?subject=' + encodeURIComponent('Chamada de vídeo agora · Seven') + '&body=' + encodeURIComponent(txt);
  }

  // ---------- desenho ----------
  function desenhar() {
    const el = document.querySelector('.dr'); if (!el || !ch) { pilula(); return; }
    el.dataset.fase = ch.fase;
    const st = el.querySelector('.dr-status'); const remotoVivo = ch.pc && ['connected', 'completed'].indexOf(ch.pc.connectionState) >= 0;
    const msgs = { abrindo: 'Abrindo a chamada…', esperando: 'Aguardando ' + (ch.convidado ? esc(ch.convidado) : 'o convidado') + ' entrar…', tocando: '<b>' + esc(ch.outroNome) + '</b> quer entrar na chamada', chamando: ch.ausente ? 'O anfitrião ainda não abriu esta chamada. Tentando de novo…' : 'Chamando… aguardando o anfitrião atender', conectando: 'Conectando com ' + esc(ch.outroNome) + '…', chamada: remotoVivo ? '' : 'Conectando o vídeo…' };
    if (st) { st.innerHTML = msgs[ch.fase] || ''; st.hidden = !st.innerHTML; }
    const conv = el.querySelector('.dr-convite'); if (conv) conv.hidden = !(ch.anfitriao && (ch.fase === 'esperando' || ch.fase === 'abrindo'));
    const toque = el.querySelector('.dr-toque'); if (toque) toque.hidden = ch.fase !== 'tocando';
    const rv = el.querySelector('.dr-remoto video'); if (rv && rv.srcObject !== ch.remoto) { rv.srcObject = ch.remoto; rv.play().catch(function () { /* autoplay */ }); }
    const temVideoRemoto = remotoVivo && (ch.outro.cam || ch.outro.tela) && faixa(ch.remoto, 'video');
    el.querySelector('.dr-remoto').classList.toggle('sem-video', !temVideoRemoto);
    el.querySelector('.dr-remoto').classList.toggle('vivo', !!remotoVivo);
    el.querySelector('.dr-remoto .rn-av').textContent = iniciais(ch.outroNome || ch.convidado || '?');
    el.querySelector('.dr-remoto .dr-nome').textContent = (ch.outroNome || ch.convidado || '') + (ch.outro.tela ? ' (apresentando)' : '');
    el.querySelector('.dr-remoto .rn-mic-off').hidden = !remotoVivo || ch.outro.mic;
    const lv = el.querySelector('.dr-local video'); const fonte = ch.tela || ch.local; if (lv.srcObject !== fonte) { lv.srcObject = fonte; lv.play().catch(function () { /* autoplay */ }); }
    el.querySelector('.dr-local').classList.toggle('sem-video', !(ch.tela || ch.cam)); el.querySelector('.dr-local').classList.toggle('espelho', !ch.tela);
    el.querySelector('.dr-local .rn-av').textContent = iniciais(ch.meuNome);
    const set = function (k, on, ic, tit) { const b = el.querySelector('[data-dr=' + k + ']'); if (!b) return; b.classList.toggle('off', !on); b.querySelector('.rn-ic').textContent = ic; b.title = tit; b.setAttribute('aria-pressed', String(on)); };
    set('mic', ch.mic, ch.mic ? '🎤' : '🔇', ch.mic ? 'Desativar microfone' : 'Ativar microfone');
    set('cam', ch.cam, ch.cam ? '📷' : '🚫', ch.cam ? 'Desativar câmera' : 'Ativar câmera');
    el.querySelector('[data-dr=tela]').classList.toggle('ativo', !!ch.tela); el.querySelector('[data-dr=tela]').disabled = ch.fase !== 'chamada';
    el.querySelector('[data-dr=chat]').disabled = ch.fase !== 'chamada';
    el.querySelector('[data-dr=chat] .rn-ponto').hidden = !ch.chatNovo;
    const pn = el.querySelector('.rn-painel'); pn.hidden = !ch.painelChat; el.classList.toggle('com-painel', !!ch.painelChat);
    if (ch.painelChat) {
      ch.chatNovo = false;
      const l = pn.querySelector('.rn-chat-l'); const fundo = l.scrollHeight - l.scrollTop - l.clientHeight < 40;
      l.innerHTML = ch.chat.length ? ch.chat.map(function (m) { return '<div class="rn-chat-m"><b>' + esc(m.de === 'eu' ? 'Você' : ch.outroNome) + '</b> <small>' + new Date(m.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</small><p>' + esc(m.t) + '</p></div>'; }).join('') : '<p class="mudo">Nenhuma mensagem.</p>';
      if (fundo) l.scrollTop = l.scrollHeight;
    }
  }

  function telaChamada(el) {
    el.innerHTML = '<div class="rn dr"><div class="rn-palco dr-palco">' +
      '<div class="dr-remoto sem-video"><video autoplay playsinline></video><div class="rn-av">?</div><div class="rn-rot"><span class="rn-mic-off" title="Microfone desligado" hidden>🔇</span><b class="dr-nome"></b></div></div>' +
      '<div class="dr-local espelho"><video autoplay playsinline muted></video><div class="rn-av"></div><span class="dr-voce">Você</span></div>' +
      '<div class="dr-centro"><p class="dr-status"></p>' +
      '<div class="dr-convite" hidden><p class="mini">Envie o convite para ' + esc(ch.convidado || 'a pessoa') + ' entrar:</p><p class="rn-link">' + esc(link(ch.cod)) + '</p><p class="mini">Código: <b class="dr-cod">' + esc(ch.cod) + '</b></p><div class="grupo-botoes"><button class="btn mini primario" data-dr="whatsapp">WhatsApp</button><button class="btn mini" data-dr="email">E-mail</button><button class="btn mini" data-dr="copiar">Copiar link</button></div></div>' +
      '<div class="dr-toque" hidden><div class="grupo-botoes"><button class="btn primario" data-dr="atender">📞 Atender</button><button class="btn perigo" data-dr="recusar">Recusar</button></div></div></div>' +
      '</div><aside class="rn-painel" hidden><header><h3>Mensagens na chamada</h3><button class="icone" data-dr="chat" aria-label="Fechar">×</button></header><p class="mini mudo">Vão direto para a outra pessoa e somem quando a chamada termina.</p><div class="rn-chat-l"></div><form id="dr-chat-f"><input id="dr-msg" placeholder="Enviar mensagem" autocomplete="off" aria-label="Mensagem"><button class="icone" aria-label="Enviar">➤</button></form></aside>' +
      '<footer class="rn-barra"><div class="rn-esq"><span class="rn-relogio">Chamada direta · <span class="dr-dur">' + (ch.conectadoEm ? C.duracao(Date.now() - ch.conectadoEm) : '') + '</span></span></div><div class="rn-ctrl">' +
      '<button class="rn-b" data-dr="mic"><span class="rn-ic"></span></button><button class="rn-b" data-dr="cam"><span class="rn-ic"></span></button><button class="rn-b" data-dr="tela" title="Apresentar a tela"><span class="rn-ic">🖥</span></button>' +
      '<button class="rn-b rn-sair" data-dr="sair" title="Encerrar a chamada"><span class="rn-ic">📞</span></button></div>' +
      '<div class="rn-dir"><button class="rn-b2" data-dr="chat" title="Chat">💬<span class="rn-ponto" hidden></span></button></div></footer></div>';
    desenhar();
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-dr]'); if (!b || !ch) return; const k = b.dataset.dr;
      if (k === 'mic') alternarMic();
      if (k === 'cam') alternarCam();
      if (k === 'tela') alternarTela();
      if (k === 'chat') { ch.painelChat = !ch.painelChat; desenhar(); if (ch.painelChat) el.querySelector('#dr-msg').focus(); }
      if (k === 'sair') encerrar('fim');
      if (k === 'atender') atender(true);
      if (k === 'recusar') atender(false);
      if (k === 'whatsapp' || k === 'email') convidar(k);
      if (k === 'copiar') { try { await navigator.clipboard.writeText(link(ch.cod)); aviso('Link copiado. Código: ' + ch.cod); } catch (e) { aviso('Código da chamada: ' + ch.cod); } }
    };
    el.querySelector('#dr-chat-f').onsubmit = function (ev) { ev.preventDefault(); const i = el.querySelector('#dr-msg'); const t = i.value.trim(); if (!t || !ch) return; i.value = ''; ch.ponte.enviar({ t: 'chat', txt: t }); ch.chat.push({ de: 'eu', t: t, em: Date.now() }); desenhar(); };
    el.onkeydown = function (ev) { if (ev.target.closest('input,textarea') || !ch) return; if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd') { ev.preventDefault(); alternarMic(); } if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'e') { ev.preventDefault(); alternarCam(); } };
  }

  // ---------- telas de entrada ----------
  function contatos() {
    const l = []; const e = Dados.e;
    (e.empresas || []).forEach(function (x) { if (x.representante || x.email || x.telefone) l.push({ nome: x.representante || x.nome || x.razao, org: x.nome || x.razao || '', email: x.email || '', telefone: x.telefone || '' }); });
    ((e.comercial || {}).contas || []).forEach(function (c) { (c.contatos || []).forEach(function (x) { l.push({ nome: x.nome, org: c.nome || c.razao || x.cargo || '', email: x.email || '', telefone: x.whatsapp || x.telefone || '' }); }); });
    return l.filter(function (x) { return x.nome; }).slice(0, 200);
  }
  function telaNova(el) {
    const p = preparado || {}; const ct = contatos();
    el.innerHTML = '<div class="rn-home"><div class="rn-home-l"><h1>Chamada direta (1 a 1)</h1><p class="mudo">Videochamada com uma pessoa, sem precisar configurar o servidor da equipe. Crie a chamada, envie o convite e atenda quando ela entrar.</p>' +
      '<form id="dr-nova" class="dr-form">' + campo('Seu nome', '<input name="eu" required maxlength="60" value="' + esc(meuNome()) + '">') +
      campo('Com quem é a chamada', '<input name="c" list="dr-contatos" maxlength="60" value="' + esc(p.nome || '') + '" placeholder="Nome do convidado">' + '<datalist id="dr-contatos">' + ct.map(function (x) { return '<option value="' + esc(x.nome) + '">' + esc(x.org) + '</option>'; }).join('') + '</datalist>', ct.length ? 'Comece a digitar para escolher um cliente ou contato do Seven Comercial.' : '') +
      '<button class="btn primario">📞 Criar chamada</button></form>' +
      '<h3>Recebeu um convite?</h3><form id="dr-cod" class="rn-cod"><input name="c" placeholder="Código ou link da chamada" aria-label="Código da chamada"><button class="btn fantasma">Entrar</button></form>' +
      '<p class="mini mudo">Vídeo e áudio vão direto de um computador ao outro. Se a rede de uma das pontas bloquear, configure um servidor TURN em <a href="#/reuniao">Seven Reunião</a> → Configurações de rede.</p>' +
      '<p><a class="mini" href="#/reuniao">← Seven Reunião</a></p></div><div class="rn-home-r" aria-hidden="true"><div class="rn-ilus"><span>📞</span></div><p>Ideal para falar com um cliente, fornecedor ou alguém da equipe que ainda não está no Seven Chat.</p></div></div>';
    el.onclick = null;
    el.querySelector('#dr-nova').onsubmit = async function (ev) {
      ev.preventDefault(); const d = new FormData(ev.target); const nome = String(d.get('eu')).trim(); const conv = String(d.get('c') || '').trim();
      cfg().nome = nome; Dados.salvar();
      const contato = ct.find(function (x) { return x.nome === conv; }) || (p.nome === conv ? p : null); preparado = null;
      ev.target.querySelector('button').disabled = true;
      location.hash = '#/reuniao/direta/agora';
      await iniciar(C.codigo(), true, { meuNome: nome, convidado: conv, contato: contato });
      if (ch) App.redesenhar();
    };
    el.querySelector('#dr-cod').onsubmit = function (ev) { ev.preventDefault(); const c = C.lerCodigo(new FormData(ev.target).get('c')); if (!c) { aviso('Código inválido. Formato: abc-defg-hij.', 'erro'); return; } location.hash = '#/reuniao/direta/' + c; };
  }
  async function telaConvidado(el, cod) {
    const opc = { mic: true, cam: true };
    el.innerHTML = '<div class="rn-pre"><div class="rn-prev"><video autoplay playsinline muted class="espelho"></video><div class="rn-prev-av" hidden>🙂</div><div class="rn-prev-ctrl"><button class="rn-b" data-p="mic" title="Microfone"><span class="rn-ic">🎤</span></button><button class="rn-b" data-p="cam" title="Câmera"><span class="rn-ic">📷</span></button></div><p class="rn-prev-msg" hidden></p></div>' +
      '<div class="rn-pre-info"><h2>Chamada direta</h2><p class="mudo">Você foi convidado para uma videochamada.</p><form id="dr-entrar">' + campo('Seu nome', '<input name="n" required maxlength="60" value="' + esc(meuNome()) + '">') + '<button class="btn primario rn-entrar">Pedir para entrar</button></form><p class="mini mudo">Código: ' + esc(cod) + '</p><a href="#/reuniao/direta" class="mini">Voltar</a></div></div>';
    const vid = el.querySelector('video'); const msg = el.querySelector('.rn-prev-msg');
    const previa = await midia(); if (!document.body.contains(vid)) { parar(previa); return; }
    vid.srcObject = previa;
    const atualizar = function () {
      const a = faixa(previa, 'audio'), v = faixa(previa, 'video'); if (a) a.enabled = opc.mic; if (v) v.enabled = opc.cam;
      el.querySelector('[data-p=mic]').classList.toggle('off', !opc.mic || !a); el.querySelector('[data-p=mic] .rn-ic').textContent = opc.mic && a ? '🎤' : '🔇';
      el.querySelector('[data-p=cam]').classList.toggle('off', !opc.cam || !v); el.querySelector('[data-p=cam] .rn-ic').textContent = opc.cam && v ? '📷' : '🚫';
      el.querySelector('.rn-prev-av').hidden = !!(opc.cam && v); vid.hidden = !(opc.cam && v);
      msg.hidden = !!(a && v); msg.textContent = !a && !v ? 'Sem acesso a câmera e microfone: você entra só para ver e ouvir.' : !v ? 'Câmera não encontrada.' : 'Microfone não encontrado.';
    };
    atualizar();
    const sair = function () { if (!document.body.contains(vid)) { window.removeEventListener('hashchange', sair); if (!ch || ch.local !== previa) parar(previa); } };
    window.addEventListener('hashchange', sair);
    el.onclick = function (ev) { const b = ev.target.closest('[data-p]'); if (!b) return; if (b.dataset.p === 'mic') opc.mic = !opc.mic; if (b.dataset.p === 'cam') opc.cam = !opc.cam; atualizar(); };
    el.querySelector('#dr-entrar').onsubmit = async function (ev) {
      ev.preventDefault(); const nome = String(new FormData(ev.target).get('n')).trim(); cfg().nome = nome; Dados.salvar();
      ev.target.querySelector('button').disabled = true;
      await iniciar(cod, false, { meuNome: nome, local: previa, mic: opc.mic, cam: opc.cam });
      if (ch) App.redesenhar();
    };
  }
  function telaFim(el) {
    const f = fim; fim = null;
    const tit = { recusada: 'A chamada não foi atendida', ocupada: 'O anfitrião está em outra chamada', fim: 'Chamada encerrada' }[f.motivo] || 'Chamada encerrada';
    el.innerHTML = '<div class="rn-home rn-saiu"><h2>' + esc(tit) + '</h2>' + (f.dur ? '<p class="mudo">Duração: ' + esc(f.dur) + (f.outro ? ' com ' + esc(f.outro) : '') + '</p>' : '') + '<div class="grupo-botoes">' + (f.anfitriao ? '<a class="btn primario" href="#/reuniao/direta">Nova chamada direta</a>' : '<button type="button" class="btn" data-de-novo>Tentar de novo</button>') + '<a class="btn" href="#/reuniao">Seven Reunião</a></div></div>';
    el.onclick = function (ev) { if (ev.target.closest('[data-de-novo]')) App.redesenhar(); };
  }

  // ---------- barra flutuante fora da tela da chamada ----------
  function pilula() {
    let p = document.getElementById('dr-pill');
    const naTela = /^#\/reuniao\/direta\/./.test(location.hash) && document.querySelector('.dr');
    if (!ch || naTela) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('div'); p.id = 'dr-pill'; p.className = 'no-print rn-pill-dr'; document.body.appendChild(p); p.onclick = function (ev) { const b = ev.target.closest('[data-pill]'); if (!b || !ch) return; if (b.dataset.pill === 'voltar') location.hash = '#/reuniao/direta/' + (ch.anfitriao ? 'agora' : ch.cod); if (b.dataset.pill === 'sair') encerrar('fim', true); }; }
    p.innerHTML = '<span class="rn-pill-pt">●</span><b>' + esc(ch.fase === 'tocando' ? ch.outroNome + ' quer entrar' : 'Chamada direta' + (ch.outroNome ? ' · ' + ch.outroNome : '')) + '</b><button data-pill="voltar">Voltar à chamada</button><button data-pill="sair" class="sair" title="Encerrar">📞</button>';
  }
  window.addEventListener('hashchange', function () { setTimeout(pilula, 0); });

  Telas.direta = {
    titulo: 'Seven Reunião · Chamada direta',
    atual: function () { return ch && { cod: ch.cod, fase: ch.fase, anfitriao: ch.anfitriao, ponte: ch.ponte && ch.ponte.tipo }; },
    encerrar: encerrar,
    preparar: function (o) { preparado = o || null; },
    render: function (el, param) {
      if (fim && (!param || param === 'agora' || param === fim.cod)) { telaFim(el); return; }
      if (ch && (param === 'agora' || param === ch.cod)) { telaChamada(el); pilula(); return; }
      if (param && param !== 'agora' && C.codigoValido(param)) { telaConvidado(el, param); return; }
      telaNova(el);
    }
  };
})();
