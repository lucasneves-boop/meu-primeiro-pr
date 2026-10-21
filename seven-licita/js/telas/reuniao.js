/* Reuniões: videochamadas da equipe estilo Google Meet, dentro da Plêiade.
   WebRTC em malha (cada participante conecta com os demais); a sinalização passa pelo mesmo Firebase da Plêiade em /chamadas/<código>. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, modal, aviso } = UI;
  const C = self.Chamada, P = self.Pleiade;
  const REACOES = ['👍', '❤️', '😂', '😮', '👏', '🎉'];
  let call = null;   // chamada em andamento (sobrevive à troca de tela)
  let previa = null; // stream da pré-sala

  function api() { return Telas.pleiade.api; }
  function T() { return Telas.pleiade._t; }
  function eu() { return api().eu(); }
  function salas() { return (api().arv().chamadas) || {}; }
  function sala(sid) { return salas()[sid]; }
  function cfgRede() { const d = Dados.e; d.reuniaoCfg = Object.assign({ stun: 'stun:stun.l.google.com:19302', turn: '', turnUsuario: '', turnSenha: '' }, d.reuniaoCfg || {}); return d.reuniaoCfg; }
  function iceServers() { const c = cfgRede(); const s = []; if (c.stun) s.push({ urls: c.stun.split(/[\s,]+/).filter(Boolean) }); if (c.turn) s.push({ urls: c.turn.split(/[\s,]+/).filter(Boolean), username: c.turnUsuario, credential: c.turnSenha }); return s; }
  function caminho(sid, resto) { return 'chamadas/' + sid + (resto ? '/' + resto : ''); }
  function nomeDe(uid) { return api().membro(uid).nome || 'Participante'; }
  function iniciais(uid) { return nomeDe(uid).split(' ').map(function (p) { return p[0]; }).slice(0, 2).join('').toUpperCase(); }
  function corDe(uid) { return api().membro(uid).cor || '#8c9bab'; }
  function hhmm() { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function linkSala(sid) { return location.href.split('#')[0] + '#/reuniao/' + sid; }

  // ---------- criar ----------
  function criar(o) {
    o = o || {}; let sid; do { sid = C.codigo(); } while (sala(sid));
    T().set(caminho(sid), { nome: o.nome || 'Reunião da equipe', criador: eu(), criadaEm: Date.now(), canal: o.canal || null });
    if (o.canal) T().set('mensagens/' + o.canal + '/' + P.id(), { u: eu(), t: '<@' + eu() + '> iniciou uma chamada. 📹', em: Date.now(), sistema: true, chamada: sid });
    return sid;
  }

  // ---------- mídia ----------
  async function pegarMidia(querCam, querMic) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return new MediaStream();
    const tentar = async function (v, a) { try { return await navigator.mediaDevices.getUserMedia({ video: v ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false, audio: a ? { echoCancellation: true, noiseSuppression: true } : false }); } catch (e) { return null; } };
    // câmera/mic desligados na pré-sala só desativam a faixa; ela continua pronta para ligar sem nova permissão
    return (await tentar(true, true)) || (await tentar(false, true)) || (await tentar(true, false)) || new MediaStream();
  }
  function pararStream(s) { if (s) s.getTracks().forEach(function (t) { t.stop(); }); }
  function faixa(s, tipo) { return s ? s.getTracks().find(function (t) { return t.kind === tipo; }) : null; }

  // ---------- sinalização / WebRTC ----------
  function sinal(para, tipo, dados) { return T().set(caminho(call.sid, 'sinais/' + para + '/' + eu() + '/' + P.id()), { tipo: tipo, dados: dados, em: Date.now() }); }

  function criarPC(uid, ofertar) {
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    const par = call.pares[uid] = { pc: pc, stream: new MediaStream(), fila: [], ofertante: ofertar };
    const a = faixa(call.local, 'audio'), v = faixa(call.local, 'video');
    if (a) pc.addTrack(a, call.local); else pc.addTransceiver('audio', { direction: 'recvonly' });
    if (call.tela) pc.addTrack(faixa(call.tela, 'video'), call.local);
    else if (v) pc.addTrack(v, call.local); else pc.addTransceiver('video', { direction: 'sendrecv' });
    pc.onicecandidate = function (e) { if (e.candidate && call) sinal(uid, 'ice', e.candidate.toJSON()); };
    pc.ontrack = function (e) { par.stream.getTracks().filter(function (t) { return t.kind === e.track.kind; }).forEach(function (t) { par.stream.removeTrack(t); }); par.stream.addTrack(e.track); e.track.onunmute = desenharTiles; desenharTiles(); medirVoz(uid, par.stream); };
    pc.onconnectionstatechange = function () { if (pc.connectionState === 'failed' && call && call.pares[uid] === par) { fecharPar(uid); agendarSync(); } desenharTiles(); };
    if (ofertar) pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () { sinal(uid, 'offer', { type: pc.localDescription.type, sdp: pc.localDescription.sdp }); }).catch(function (e) { console.error(e); });
    return par;
  }
  function fecharPar(uid) { const p = call.pares[uid]; if (!p) return; try { p.pc.close(); } catch (e) { /* já fechado */ } delete call.pares[uid]; if (call.vozes[uid]) { call.vozes[uid].src.disconnect(); delete call.vozes[uid]; } }
  async function aplicarFila(par) { while (par.fila.length) { try { await par.pc.addIceCandidate(par.fila.shift()); } catch (e) { /* candidato velho */ } } }

  async function tratarSinal(s) {
    const de = s.de; let par = call.pares[de];
    if (s.tipo === 'offer') {
      if (par && par.ofertante) fecharPar(de);
      par = call.pares[de] || criarPC(de, false);
      await par.pc.setRemoteDescription(s.dados); await aplicarFila(par);
      const r = await par.pc.createAnswer(); await par.pc.setLocalDescription(r);
      sinal(de, 'answer', { type: par.pc.localDescription.type, sdp: par.pc.localDescription.sdp });
    } else if (s.tipo === 'answer') {
      if (par && par.pc.signalingState === 'have-local-offer') { await par.pc.setRemoteDescription(s.dados); await aplicarFila(par); }
    } else if (s.tipo === 'ice') {
      if (!par) return;
      if (par.pc.remoteDescription) { try { await par.pc.addIceCandidate(s.dados); } catch (e) { /* ignorado */ } } else par.fila.push(s.dados);
    }
  }

  let syncT = null, sincronizando = false, deNovo = false;
  function agendarSync() { clearTimeout(syncT); syncT = setTimeout(sincronizar, 0); }
  async function sincronizar() {
    if (!call) return;
    if (sincronizando) { deNovo = true; return; }
    sincronizando = true;
    try {
      const s = sala(call.sid) || {};
      const at = C.ativos(s).filter(function (u) { return u !== eu(); });
      for (const sg of C.sinaisPara(s, eu(), call.processados)) {
        call.processados[sg.de + '/' + sg.id] = 1;
        try { await tratarSinal(sg); } catch (e) { console.error('sinal', e); }
        T().set(caminho(call.sid, 'sinais/' + eu() + '/' + sg.de + '/' + sg.id), null);
      }
      at.forEach(function (u) { if (!call.pares[u] && C.devoOfertar(eu(), u, s)) criarPC(u, true); });
      Object.keys(call.pares).forEach(function (u) { if (at.indexOf(u) < 0) fecharPar(u); });
      // reações e chat
      const ps = s.participantes || {};
      Object.keys(ps).forEach(function (u) { const r = ps[u].reacao; if (r && r.em > (call.reacoesVistas[u] || 0) && Date.now() - r.em < 8000) { call.reacoesVistas[u] = r.em; flutuar(u, r.e); } });
      const nChat = Object.keys(s.chat || {}).length; if (nChat > call.chatVisto && call.painel !== 'chat') { const b = document.querySelector('[data-rn=chat] .rn-ponto'); if (b) b.hidden = false; }
      desenharTiles(); desenharPainel();
    } finally { sincronizando = false; if (deNovo) { deNovo = false; agendarSync(); } }
  }

  // ---------- voz ----------
  function medirVoz(uid, stream) {
    if (!faixa(stream, 'audio') || !(self.AudioContext || self.webkitAudioContext)) return;
    try {
      call.ctxAudio = call.ctxAudio || new (self.AudioContext || self.webkitAudioContext)();
      if (call.vozes[uid]) call.vozes[uid].src.disconnect();
      const src = call.ctxAudio.createMediaStreamSource(stream); const an = call.ctxAudio.createAnalyser(); an.fftSize = 256; src.connect(an);
      call.vozes[uid] = { src: src, an: an, buf: new Uint8Array(an.fftSize) };
    } catch (e) { /* sem áudio */ }
  }
  function pulsoVoz() {
    if (!call) return;
    Object.keys(call.vozes).forEach(function (u) {
      const v = call.vozes[u]; v.an.getByteTimeDomainData(v.buf);
      const fala = C.nivel(v.buf) > 0.08 && (u !== eu() || call.mic);
      const t = document.querySelector('.rn-tile[data-uid="' + u + '"]'); if (t) t.classList.toggle('falando', fala);
    });
  }

  // ---------- entrar / sair ----------
  async function entrar(sid, opc) {
    if (call && call.sid === sid) return;
    if (call) await sair();
    const s = sala(sid) || {};
    if (C.cheia(s, eu())) { aviso('A sala está cheia (máx. ' + C.MAX_PARTICIPANTES + ' pessoas).', 'erro'); return; }
    const local = previa || await pegarMidia(true, true); previa = null;
    call = { sid: sid, local: local, tela: null, pares: {}, processados: {}, vozes: {}, reacoesVistas: {}, mic: opc.mic && !!faixa(local, 'audio'), cam: opc.cam && !!faixa(local, 'video'), mao: false, inicio: Date.now(), painel: null, chatVisto: Object.keys(s.chat || {}).length, fixado: null };
    const a = faixa(local, 'audio'), v = faixa(local, 'video'); if (a) a.enabled = call.mic; if (v) v.enabled = call.cam;
    // limpa caixa antiga e entra
    await T().set(caminho(sid, 'sinais/' + eu()), null);
    await T().set(caminho(sid, 'participantes/' + eu()), { entrou: Date.now(), visto: Date.now(), mic: call.mic, cam: call.cam, tela: false, mao: false });
    call.batida = setInterval(function () { if (call) T().patch(caminho(call.sid, 'participantes/' + eu()), { visto: Date.now() }); }, C.BATIMENTO_MS);
    call.relogio = setInterval(function () { const r = document.querySelector('.rn-relogio'); if (r) r.textContent = hhmm() + ' | ' + call.sid; const p = document.querySelector('#rn-pill .rn-dur'); if (p) p.textContent = C.duracao(Date.now() - call.inicio); pulsoVoz(); }, 250);
    call.ouvinte = agendarSync; T().ouvintes.push(call.ouvinte);
    medirVoz(eu(), local);
    agendarSync();
  }
  async function sair() {
    if (!call) return;
    const c = call; call = null;
    clearInterval(c.batida); clearInterval(c.relogio);
    const i = T().ouvintes.indexOf(c.ouvinte); if (i >= 0) T().ouvintes.splice(i, 1);
    Object.keys(c.pares).forEach(function (u) { try { c.pares[u].pc.close(); } catch (e) { /* ok */ } });
    pararStream(c.local); pararStream(c.tela);
    if (c.ctxAudio) c.ctxAudio.close();
    const s = sala(c.sid) || {}; const restam = C.ativos(s).filter(function (u) { return u !== eu(); });
    await T().set(caminho(c.sid, 'participantes/' + eu()), null);
    await T().set(caminho(c.sid, 'sinais/' + eu()), null);
    if (!restam.length) await T().patch(caminho(c.sid), { encerrada: Date.now(), sinais: null });
    pilula();
  }
  window.addEventListener('beforeunload', function () { if (call) sair(); });

  // ---------- controles ----------
  async function alternarMic() {
    const a = faixa(call.local, 'audio'); if (!a) { aviso('Nenhum microfone disponível.', 'erro'); return; }
    call.mic = !call.mic; a.enabled = call.mic; T().patch(caminho(call.sid, 'participantes/' + eu()), { mic: call.mic }); desenharControles(); desenharTiles();
  }
  async function alternarCam() {
    const v = faixa(call.local, 'video'); if (!v) { aviso('Nenhuma câmera disponível.', 'erro'); return; }
    call.cam = !call.cam; v.enabled = call.cam; T().patch(caminho(call.sid, 'participantes/' + eu()), { cam: call.cam }); desenharControles(); desenharTiles();
  }
  function trocarVideo(track) {
    Object.keys(call.pares).forEach(function (u) { const tr = call.pares[u].pc.getTransceivers().find(function (t) { return t.receiver.track && t.receiver.track.kind === 'video'; }); if (tr) { tr.direction = 'sendrecv'; tr.sender.replaceTrack(track); } });
  }
  async function alternarTela() {
    if (call.tela) { pararStream(call.tela); call.tela = null; trocarVideo(faixa(call.local, 'video') || null); T().patch(caminho(call.sid, 'participantes/' + eu()), { tela: false }); desenharControles(); desenharTiles(); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { aviso('Este navegador não compartilha tela.', 'erro'); return; }
    let s; try { s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); } catch (e) { return; }
    call.tela = s; const t = faixa(s, 'video'); t.onended = function () { if (call && call.tela === s) alternarTela(); };
    trocarVideo(t); T().patch(caminho(call.sid, 'participantes/' + eu()), { tela: true }); desenharControles(); desenharTiles();
  }
  function alternarMao() { call.mao = !call.mao; T().patch(caminho(call.sid, 'participantes/' + eu()), { mao: call.mao ? Date.now() : false }); desenharControles(); }
  function reagir(e) { const r = { e: e, em: Date.now() }; call.reacoesVistas[eu()] = r.em; flutuar(eu(), e); T().set(caminho(call.sid, 'participantes/' + eu() + '/reacao'), r); }
  function flutuar(uid, e) {
    const palco = document.querySelector('.rn-palco'); if (!palco) return;
    const d = document.createElement('div'); d.className = 'rn-voa'; d.style.left = (10 + Math.random() * 60) + '%';
    d.innerHTML = '<span>' + esc(e) + '</span><small>' + esc(nomeDe(uid).split(' ')[0]) + '</small>'; palco.appendChild(d); setTimeout(function () { d.remove(); }, 3500);
  }

  // ---------- desenho ----------
  function bloco(uid) {
    const s = sala(call.sid) || {}; const p = (s.participantes || {})[uid] || {}; const meu = uid === eu();
    const stream = meu ? (call.tela ? new MediaStream([faixa(call.tela, 'video')]) : call.local) : (call.pares[uid] || {}).stream;
    const temVideo = meu ? (call.tela || call.cam) : (p.cam || p.tela) && stream && faixa(stream, 'video');
    return { uid: uid, p: p, meu: meu, stream: stream, video: !!temVideo };
  }
  function desenharTiles() {
    if (!call) return; const palco = document.querySelector('.rn-grade'); if (!palco) return;
    const s = sala(call.sid) || {}; const at = C.ativos(s); if (at.indexOf(eu()) < 0) at.unshift(eu());
    const tela = at.find(function (u) { return u !== eu() && ((s.participantes || {})[u] || {}).tela; }) || (call.tela ? eu() : null);
    const destaque = call.fixado && at.indexOf(call.fixado) >= 0 ? call.fixado : tela;
    palco.classList.toggle('destaque', !!destaque);
    // remove quem saiu
    palco.querySelectorAll('.rn-tile').forEach(function (t) { if (at.indexOf(t.dataset.uid) < 0) t.remove(); });
    at.forEach(function (u, i) {
      const b = bloco(u); let t = palco.querySelector('.rn-tile[data-uid="' + u + '"]');
      if (!t) {
        t = document.createElement('div'); t.className = 'rn-tile'; t.dataset.uid = u;
        t.innerHTML = '<video autoplay playsinline' + (b.meu ? ' muted' : '') + '></video><div class="rn-av" style="background:' + esc(corDe(u)) + '">' + esc(iniciais(u)) + '</div><div class="rn-rot"><span class="rn-mic-off" title="Microfone desligado">🔇</span><b></b></div><span class="rn-mao" title="Mão levantada">✋</span><button class="rn-fixar" data-rn="fixar" title="Fixar" aria-label="Fixar">📌</button>';
        palco.appendChild(t);
      }
      t.style.order = u === destaque ? -1 : i;
      t.classList.toggle('grande', u === destaque);
      t.classList.toggle('sem-video', !b.video);
      t.classList.toggle('eu', b.meu);
      t.classList.toggle('espelho', b.meu && !call.tela);
      const vid = t.querySelector('video'); if (b.stream && vid.srcObject !== b.stream && !(b.meu && call.tela && vid.srcObject && faixa(vid.srcObject, 'video') === faixa(call.tela, 'video'))) { vid.srcObject = b.stream; vid.play().catch(function () { /* autoplay */ }); }
      t.querySelector('b').textContent = b.meu ? 'Você' + (call.tela ? ' (apresentando)' : '') : nomeDe(u) + (b.p.tela ? ' (apresentando)' : '');
      t.querySelector('.rn-mic-off').hidden = b.meu ? call.mic : b.p.mic !== false;
      t.querySelector('.rn-mao').hidden = b.meu ? !call.mao : !b.p.mao;
      const pc = call.pares[u]; t.classList.toggle('conectando', !b.meu && (!pc || ['connected', 'completed'].indexOf(pc.pc.connectionState) < 0 && pc.pc.iceConnectionState !== 'connected' && pc.pc.iceConnectionState !== 'completed'));
    });
    const n = destaque ? 1 : at.length; const r = palco.getBoundingClientRect(); const g = C.grade(n, r.width || 1200, r.height || 650);
    palco.style.setProperty('--cols', destaque ? 1 : g.colunas); palco.style.setProperty('--lins', destaque ? 1 : g.linhas);
    const cont = document.querySelector('[data-rn=pessoas] .rn-n'); if (cont) cont.textContent = at.length;
    const maos = at.filter(function (u) { return ((s.participantes || {})[u] || {}).mao; }); const fm = document.querySelector('.rn-maos'); if (fm) { fm.hidden = !maos.length; fm.textContent = '✋ ' + maos.map(function (u) { return u === eu() ? 'Você' : nomeDe(u).split(' ')[0]; }).join(', '); }
  }
  function desenharControles() {
    const bar = document.querySelector('.rn-ctrl'); if (!bar || !call) return;
    const set = function (k, on, ic, tit) { const b = bar.querySelector('[data-rn=' + k + ']'); if (!b) return; b.classList.toggle('off', !on); b.querySelector('.rn-ic').textContent = ic; b.title = tit; b.setAttribute('aria-pressed', String(on)); };
    set('mic', call.mic, call.mic ? '🎤' : '🔇', call.mic ? 'Desativar microfone' : 'Ativar microfone');
    set('cam', call.cam, call.cam ? '📷' : '🚫', call.cam ? 'Desativar câmera' : 'Ativar câmera');
    const t = bar.querySelector('[data-rn=tela]'); t.classList.toggle('ativo', !!call.tela); t.title = call.tela ? 'Parar apresentação' : 'Apresentar agora';
    bar.querySelector('[data-rn=mao]').classList.toggle('ativo', !!call.mao);
  }
  function desenharPainel() {
    const box = document.querySelector('.rn-painel'); if (!box || !call) return;
    box.hidden = !call.painel; document.querySelector('.rn').classList.toggle('com-painel', !!call.painel);
    if (!call.painel) return;
    const s = sala(call.sid) || {};
    if (call.painel === 'chat') {
      const msgs = Object.keys(s.chat || {}).map(function (k) { return s.chat[k]; }).sort(function (a, b) { return a.em - b.em; });
      call.chatVisto = msgs.length; const b = document.querySelector('[data-rn=chat] .rn-ponto'); if (b) b.hidden = true;
      const lista = box.querySelector('.rn-chat-l'); const fundo = !lista || lista.scrollHeight - lista.scrollTop - lista.clientHeight < 40;
      const html = '<header><h3>Mensagens na chamada</h3><button class="icone" data-rn="fechar-painel" aria-label="Fechar">×</button></header><p class="mini mudo">As mensagens ficam visíveis só durante a chamada para quem está nela.</p><div class="rn-chat-l">' + (msgs.length ? msgs.map(function (m) { return '<div class="rn-chat-m"><b>' + esc(m.u === eu() ? 'Você' : nomeDe(m.u)) + '</b> <small>' + new Date(m.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</small><p>' + P.formatar(m.t, { membros: api().membros(), eu: eu() }) + '</p></div>'; }).join('') : '<p class="mudo">Nenhuma mensagem.</p>') + '</div>';
      const rasc = box.querySelector('#rn-msg'); const valor = rasc ? rasc.value : ''; const foco = rasc && document.activeElement === rasc;
      box.innerHTML = html + '<form id="rn-chat-f"><input id="rn-msg" placeholder="Enviar mensagem" autocomplete="off" aria-label="Mensagem"><button class="icone" aria-label="Enviar">➤</button></form>';
      const nr = box.querySelector('#rn-msg'); nr.value = valor; if (foco) nr.focus();
      const nl = box.querySelector('.rn-chat-l'); if (fundo) nl.scrollTop = nl.scrollHeight;
      box.querySelector('#rn-chat-f').onsubmit = function (ev) { ev.preventDefault(); const t = nr.value.trim(); if (!t) return; nr.value = ''; T().set(caminho(call.sid, 'chat/' + P.id()), { u: eu(), t: t, em: Date.now() }); };
    }
    if (call.painel === 'pessoas') {
      const at = C.ativos(s);
      box.innerHTML = '<header><h3>Pessoas (' + at.length + ')</h3><button class="icone" data-rn="fechar-painel" aria-label="Fechar">×</button></header><button class="btn mini" data-rn="copiar">🔗 Copiar link da reunião</button><ul class="rn-pessoas">' + at.map(function (u) { const p = (s.participantes || {})[u] || {}; return '<li><span class="rn-av-p" style="background:' + esc(corDe(u)) + '">' + esc(iniciais(u)) + '</span><div><b>' + esc(nomeDe(u)) + (u === eu() ? ' (você)' : '') + '</b>' + (s.criador === u ? '<small>Organizador da reunião</small>' : '') + '</div><span>' + (p.mao ? '✋ ' : '') + (p.tela ? '🖥 ' : '') + (p.mic === false ? '🔇' : '🎤') + '</span></li>'; }).join('') + '</ul>';
    }
    if (call.painel === 'info') {
      box.innerHTML = '<header><h3>Detalhes da reunião</h3><button class="icone" data-rn="fechar-painel" aria-label="Fechar">×</button></header><p><b>' + esc(s.nome || 'Reunião') + '</b></p><p class="mini">Informações para participar</p><p class="rn-link">' + esc(linkSala(call.sid)) + '</p><button class="btn mini" data-rn="copiar">📋 Copiar informações</button><p class="mini mudo">Código: <b>' + esc(call.sid) + '</b>. Quem entra precisa estar na Plêiade da equipe (mesmo servidor).</p>';
    }
  }

  function telaChamada(el) {
    const s = sala(call.sid) || {};
    el.innerHTML = '<div class="rn"><div class="rn-palco"><div class="rn-grade"></div><div class="rn-maos" hidden></div></div><aside class="rn-painel" hidden></aside>' +
      '<footer class="rn-barra"><div class="rn-esq"><span class="rn-relogio">' + hhmm() + ' | ' + esc(call.sid) + '</span><span class="rn-nome-sala">' + esc(s.nome || '') + '</span></div>' +
      '<div class="rn-ctrl">' +
      '<button class="rn-b" data-rn="mic"><span class="rn-ic"></span></button><button class="rn-b" data-rn="cam"><span class="rn-ic"></span></button>' +
      '<button class="rn-b" data-rn="reacao" title="Enviar uma reação"><span class="rn-ic">😀</span></button><button class="rn-b" data-rn="tela"><span class="rn-ic">🖥</span></button><button class="rn-b" data-rn="mao" title="Levantar a mão"><span class="rn-ic">✋</span></button>' +
      '<button class="rn-b rn-sair" data-rn="sair" title="Sair da chamada"><span class="rn-ic">📞</span></button></div>' +
      '<div class="rn-dir"><button class="rn-b2" data-rn="info" title="Detalhes da reunião">ⓘ</button><button class="rn-b2" data-rn="pessoas" title="Pessoas">👥<span class="rn-n"></span></button><button class="rn-b2" data-rn="chat" title="Chat">💬<span class="rn-ponto" hidden></span></button></div></footer>' +
      '<div class="rn-reacoes" hidden>' + REACOES.map(function (e) { return '<button data-reacao="' + e + '">' + e + '</button>'; }).join('') + '</div></div>';
    desenharControles(); desenharTiles(); desenharPainel();
    el.onclick = async function (ev) {
      const r = ev.target.closest('[data-reacao]'); if (r) { reagir(r.dataset.reacao); el.querySelector('.rn-reacoes').hidden = true; return; }
      const b = ev.target.closest('[data-rn]'); if (!b || !call) return; const k = b.dataset.rn;
      if (k === 'mic') alternarMic();
      if (k === 'cam') alternarCam();
      if (k === 'tela') alternarTela();
      if (k === 'mao') alternarMao();
      if (k === 'reacao') { const box = el.querySelector('.rn-reacoes'); box.hidden = !box.hidden; }
      if (k === 'sair') { const sid = call.sid; await sair(); location.hash = '#/reuniao/' + sid + '/saiu'; }
      if (k === 'chat' || k === 'pessoas' || k === 'info') { call.painel = call.painel === k ? null : k; desenharPainel(); desenharTiles(); }
      if (k === 'fechar-painel') { call.painel = null; desenharPainel(); desenharTiles(); }
      if (k === 'fixar') { const u = b.closest('.rn-tile').dataset.uid; call.fixado = call.fixado === u ? null : u; desenharTiles(); }
      if (k === 'copiar') { const txt = (sala(call.sid) || {}).nome + '\n' + linkSala(call.sid); try { await navigator.clipboard.writeText(txt); aviso('Link copiado.'); } catch (e) { aviso(linkSala(call.sid)); } }
    };
    el.onkeydown = function (ev) { if (ev.target.closest('input,textarea')) return; if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd') { ev.preventDefault(); alternarMic(); } if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'e') { ev.preventDefault(); alternarCam(); } };
  }

  // ---------- pré-sala ----------
  async function telaPreSala(el, sid) {
    const s = sala(sid);
    if (!s) { el.innerHTML = '<div class="rn-home"><h2>Reunião não encontrada</h2><p class="mudo">Confira o código <b>' + esc(sid) + '</b>. As reuniões existem enquanto houver alguém nelas ou até serem encerradas.</p><a class="btn" href="#/reuniao">Voltar</a></div>'; return; }
    const at = C.ativos(s);
    const opc = { mic: true, cam: true };
    el.innerHTML = '<div class="rn-pre"><div class="rn-prev"><video autoplay playsinline muted class="espelho"></video><div class="rn-prev-av" hidden>' + esc(iniciais(eu())) + '</div><div class="rn-prev-ctrl"><button class="rn-b" data-p="mic" title="Microfone"><span class="rn-ic">🎤</span></button><button class="rn-b" data-p="cam" title="Câmera"><span class="rn-ic">📷</span></button></div><p class="rn-prev-msg" hidden></p></div>' +
      '<div class="rn-pre-info"><h2>' + esc(s.nome || 'Reunião') + '</h2><p class="mudo">' + (at.length ? at.map(function (u) { return esc(nomeDe(u)); }).join(', ') + (at.length === 1 ? ' está' : ' estão') + ' na chamada' : 'Ninguém mais está aqui') + '</p>' +
      (C.cheia(s, eu()) ? '<p class="alerta">A sala está cheia.</p>' : '<button class="btn primario rn-entrar" data-p="entrar">Participar agora</button>') + '<p class="mini mudo">Código: ' + esc(sid) + '</p><a href="#/reuniao" class="mini">Voltar</a></div></div>';
    const vid = el.querySelector('video'); const msg = el.querySelector('.rn-prev-msg');
    if (!previa) previa = await pegarMidia(true, true);
    if (!document.body.contains(vid)) return;
    vid.srcObject = previa;
    const atualizar = function () {
      const a = faixa(previa, 'audio'), v = faixa(previa, 'video');
      if (a) a.enabled = opc.mic; if (v) v.enabled = opc.cam;
      el.querySelector('[data-p=mic]').classList.toggle('off', !opc.mic || !a); el.querySelector('[data-p=mic] .rn-ic').textContent = opc.mic && a ? '🎤' : '🔇';
      el.querySelector('[data-p=cam]').classList.toggle('off', !opc.cam || !v); el.querySelector('[data-p=cam] .rn-ic').textContent = opc.cam && v ? '📷' : '🚫';
      el.querySelector('.rn-prev-av').hidden = !!(opc.cam && v); vid.hidden = !(opc.cam && v);
      msg.hidden = !!(a && v); msg.textContent = !a && !v ? 'Sem acesso a câmera e microfone: você entra só para ver e ouvir.' : !v ? 'Câmera não encontrada.' : 'Microfone não encontrado.';
    };
    atualizar();
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-p]'); if (!b) return;
      if (b.dataset.p === 'mic') opc.mic = !opc.mic;
      if (b.dataset.p === 'cam') opc.cam = !opc.cam;
      if (b.dataset.p === 'entrar') { b.disabled = true; await entrar(sid, opc); App.redesenhar(); return; }
      atualizar();
    };
  }

  // ---------- início (estilo Meet) ----------
  function telaInicio(el) {
    const lista = Object.keys(salas()).map(function (k) { return Object.assign({ id: k }, salas()[k]); });
    const vivas = lista.filter(function (s) { return C.ativos(s).length; }).sort(function (a, b) { return b.criadaEm - a.criadaEm; });
    const recentes = lista.filter(function (s) { return !C.ativos(s).length && Date.now() - s.criadaEm < 7 * 864e5; }).sort(function (a, b) { return b.criadaEm - a.criadaEm; }).slice(0, 8);
    const c = cfgRede();
    el.innerHTML = '<div class="rn-home"><div class="rn-home-l"><h1>Videochamadas para a equipe Seven</h1><p class="mudo">Reúna a equipe em segundos, direto na Plêiade: vídeo, áudio, apresentação de tela e chat.</p>' +
      '<div class="rn-home-ac"><button class="btn primario" data-h="nova">📹 Nova reunião</button><form id="rn-cod" class="rn-cod"><input name="c" placeholder="Digite um código ou link" aria-label="Código da reunião"><button class="btn fantasma">Participar</button></form></div>' +
      (call ? '<p class="rn-ao-vivo">Você está numa chamada. <a href="#/reuniao/' + esc(call.sid) + '">Voltar para a chamada</a></p>' : '') +
      '<h3>Acontecendo agora</h3>' + (vivas.length ? vivas.map(function (s) { const at = C.ativos(s); return '<a class="rn-item" href="#/reuniao/' + esc(s.id) + '"><span class="rn-item-ic ao-vivo">●</span><div><b>' + esc(s.nome || 'Reunião') + '</b><small>' + at.length + ' na chamada · ' + at.map(function (u) { return esc(nomeDe(u).split(' ')[0]); }).join(', ') + (s.canal ? ' · #' + esc(api().nomeCanal(s.canal)) : '') + '</small></div><span class="btn mini primario">Participar</span></a>'; }).join('') : '<p class="mudo mini">Nenhuma chamada ativa.</p>') +
      (recentes.length ? '<h3>Recentes</h3>' + recentes.map(function (s) { return '<a class="rn-item" href="#/reuniao/' + esc(s.id) + '"><span class="rn-item-ic">📹</span><div><b>' + esc(s.nome || 'Reunião') + '</b><small>' + new Date(s.criadaEm).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · ' + esc(s.id) + '</small></div></a>'; }).join('') : '') +
      '<details class="rn-rede"><summary>Configurações de rede (avançado)</summary><form id="rn-rede">' + campo('Servidor STUN', '<input name="stun" value="' + esc(c.stun) + '">', 'Descobre o endereço público de cada computador.') + campo('Servidor TURN (opcional)', '<input name="turn" value="' + esc(c.turn) + '" placeholder="turn:seu-servidor:3478">', 'Necessário quando a rede da empresa bloqueia conexão direta.') + '<div class="linha">' + campo('Usuário TURN', '<input name="turnUsuario" value="' + esc(c.turnUsuario) + '">') + campo('Senha TURN', '<input name="turnSenha" type="password" value="' + esc(c.turnSenha) + '">') + '</div><button class="btn mini">Salvar</button></form></details></div>' +
      '<div class="rn-home-r" aria-hidden="true"><div class="rn-ilus"><span>📹</span></div><p>Até ' + C.MAX_PARTICIPANTES + ' pessoas por sala. Clique em <b>Nova reunião</b> para criar um link e compartilhar com a equipe.</p></div></div>';
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-h=nova]'); if (!b) return;
      const r = await modal({ titulo: 'Nova reunião', botao: 'Iniciar agora', corpo: campo('Nome da reunião', '<input name="n" value="Reunião da equipe" maxlength="60">') });
      if (!r) return; const sid = criar({ nome: r.get('n').trim() || 'Reunião da equipe' }); location.hash = '#/reuniao/' + sid;
    };
    el.querySelector('#rn-cod').onsubmit = function (ev) { ev.preventDefault(); const c2 = C.lerCodigo(new FormData(ev.target).get('c')); if (!c2) { aviso('Código inválido. Formato: abc-defg-hij.', 'erro'); return; } location.hash = '#/reuniao/' + c2; };
    el.querySelector('#rn-rede').onsubmit = function (ev) { ev.preventDefault(); const d = new FormData(ev.target); Object.assign(cfgRede(), { stun: d.get('stun').trim(), turn: d.get('turn').trim(), turnUsuario: d.get('turnUsuario').trim(), turnSenha: d.get('turnSenha') }); Dados.salvar(); aviso('Configurações de rede salvas.'); };
  }

  // ---------- barra flutuante quando sai da tela da chamada ----------
  function pilula() {
    let p = document.getElementById('rn-pill');
    const naTela = call && location.hash === '#/reuniao/' + call.sid;
    if (!call || naTela) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('div'); p.id = 'rn-pill'; p.className = 'no-print'; document.body.appendChild(p); p.onclick = function (ev) { const b = ev.target.closest('[data-pill]'); if (!b || !call) return; if (b.dataset.pill === 'voltar') location.hash = '#/reuniao/' + call.sid; if (b.dataset.pill === 'mic') { alternarMic(); pilula(); } if (b.dataset.pill === 'sair') sair(); }; }
    p.innerHTML = '<span class="rn-pill-pt">●</span><b>' + esc((sala(call.sid) || {}).nome || 'Chamada') + '</b><span class="rn-dur">' + C.duracao(Date.now() - call.inicio) + '</span><button data-pill="mic" title="Microfone">' + (call.mic ? '🎤' : '🔇') + '</button><button data-pill="voltar">Voltar à chamada</button><button data-pill="sair" class="sair" title="Sair">📞</button>';
  }
  window.addEventListener('resize', function () { if (call) desenharTiles(); });
  window.addEventListener('hashchange', function () { pilula(); if (previa && !/^#\/reuniao\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(location.hash)) { pararStream(previa); previa = null; } });

  Telas.reuniao = {
    titulo: 'Reuniões',
    criar: criar,
    atual: function () { return call && call.sid; },
    sair: sair,
    render: function (el, sub, param) {
      const pl = Telas.pleiade;
      if (!pl._t.iniciado) pl._t.iniciar();
      const cfgP = pl.api.cfg();
      if (!(cfgP.modo === 'firebase' && cfgP.url)) { el.innerHTML = '<div class="rn-home"><div class="rn-home-l"><h1>Videochamadas da equipe</h1><p>As chamadas usam o servidor da equipe configurado na Plêiade (modo equipe), que faz a ponte entre os computadores.</p><a class="btn primario" href="#/pleiade">Configurar a Plêiade</a></div></div>'; return; }
      if (!eu()) { el.innerHTML = '<div class="rn-home"><div class="rn-home-l"><h1>Videochamadas da equipe</h1><p>Entre na Plêiade primeiro para ter seu perfil na equipe.</p><a class="btn primario" href="#/pleiade">Abrir a Plêiade</a></div></div>'; return; }
      if (!pl._t.conectado && !Object.keys(pl.api.arv()).length) { el.innerHTML = '<div class="rn-home"><p class="mudo">Conectando ao servidor da equipe…</p></div>'; const tentar = function () { if (/^#\/reuniao/.test(location.hash)) App.redesenhar(); }; pl._t.ouvintes.push(function f() { pl._t.ouvintes.splice(pl._t.ouvintes.indexOf(f), 1); setTimeout(tentar, 50); }); return; }
      if (sub && C.codigoValido(sub)) {
        if (param === 'saiu') { el.innerHTML = '<div class="rn-home rn-saiu"><h2>Você saiu da reunião</h2><div class="grupo-botoes"><a class="btn" href="#/reuniao/' + esc(sub) + '">Participar novamente</a><a class="btn primario" href="#/reuniao">Voltar à tela inicial</a></div></div>'; return; }
        if (call && call.sid === sub) { telaChamada(el); pilula(); return; }
        telaPreSala(el, sub); return;
      }
      telaInicio(el); pilula();
    }
  };
})();
