// Apoio aos testes de navegador: servidor estático, Chromium e verificações.
const path = require('path'); const http = require('http'); const fs = require('fs');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
const raiz = path.join(__dirname, '..');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };

async function abrir(saida, opcoes) {
  fs.mkdirSync(saida, { recursive: true });
  const srv = http.createServer((q, r) => { const f = path.join(raiz, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!f.startsWith(raiz) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  await new Promise(o => srv.listen(0, o));
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const nav = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await nav.newContext(Object.assign({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', acceptDownloads: true }, opcoes || {}));
  const pg = await ctx.newPage();
  const erros = []; pg.on('pageerror', e => erros.push(e.message)); pg.on('dialog', d => d.accept());
  return {
    url, pg, erros, saida,
    foto: n => pg.screenshot({ path: path.join(saida, n + '.png') }),
    ok: (cond, msg) => { if (!cond) throw new Error('FALHOU: ' + msg); console.log('  ✓ ' + msg); },
    arquivo: (nome, conteudo) => { const p = path.join(saida, nome); fs.writeFileSync(p, conteudo); return p; },
    fechar: async () => { await nav.close(); srv.close(); if (erros.length) { console.error('ERROS NA PÁGINA:\n' + erros.join('\n')); process.exit(1); } console.log('OK'); }
  };
}
module.exports = { abrir, raiz };
