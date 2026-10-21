// Servidor simulado com o protocolo REST + streaming (EventSource) do Firebase Realtime Database, para testes de navegador.
const http = require('http'); const P = require('../js/pleiade.js');

function servidorFirebase() {
  let arv = {}; const ouvintes = []; const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  const enviarEv = (o, tipo, dados) => o.r.write('event: ' + tipo + '\ndata: ' + JSON.stringify(dados) + '\n\n');
  const srv = http.createServer((q, r) => {
    if (q.method === 'OPTIONS') { r.writeHead(204, cors); return r.end(); }
    const u = new URL(q.url, 'http://x'); const caminho = decodeURIComponent(u.pathname.replace(/\.json$/, '')).replace(/\/+$/, '') || '/';
    if (q.method === 'GET' && /event-stream/.test(q.headers.accept || '')) {
      r.writeHead(200, Object.assign({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }, cors)); const o = { caminho, r }; ouvintes.push(o);
      enviarEv(o, 'put', { path: '/', data: P.obter(arv, caminho) ?? null }); q.on('close', () => ouvintes.splice(ouvintes.indexOf(o), 1)); return;
    }
    if (q.method === 'GET') { r.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); return r.end(JSON.stringify(P.obter(arv, caminho) ?? null)); }
    let corpo = ''; q.on('data', c => corpo += c); q.on('end', () => {
      const dados = q.method === 'DELETE' ? null : JSON.parse(corpo || 'null'); const tipo = q.method === 'PATCH' ? 'patch' : 'put';
      arv = tipo === 'patch' ? P.mesclar(arv, caminho, dados) : P.definir(arv, caminho, dados);
      ouvintes.forEach(o => { if (caminho === o.caminho || caminho.startsWith(o.caminho + '/')) enviarEv(o, tipo, { path: caminho.slice(o.caminho.length) || '/', data: dados }); });
      r.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); r.end(JSON.stringify(dados));
    });
  });
  return new Promise(ok => srv.listen(0, () => ok({ url: 'http://127.0.0.1:' + srv.address().port, arv: () => arv, fechar: () => { ouvintes.forEach(o => o.r.end()); srv.close(); } })));
}

module.exports = { servidorFirebase };
