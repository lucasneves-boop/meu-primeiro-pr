/* Relatórios em PDF: transforma um trecho da tela (ex.: .cm-relatorio) num PDF A4 com quebra de páginas.
   No claude.ai a plataforma roda num quadro protegido onde a janela de impressão não abre; ali o PDF é entregue
   pelo download do próprio claude.ai, e fora dele por um download comum. Imprimir = abrir o PDF e imprimir. */
(function () {
  'use strict';
  const LIBS = { h2c: ['https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas'], pdf: ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf'] };
  const carregando = {};
  function carregar(k) {
    const x = LIBS[k]; if (self[x[1]]) return Promise.resolve(self[x[1]]);
    return carregando[k] = carregando[k] || new Promise(function (ok, erro) { const s = document.createElement('script'); s.src = x[0]; s.onload = function () { ok(self[x[1]]); }; s.onerror = function () { carregando[k] = null; erro(new Error('Sem acesso à biblioteca de PDF. Verifique a internet.')); }; document.head.appendChild(s); });
  }
  function emQuadro() { try { return window.self !== window.top; } catch (e) { return true; } }

  async function salvar(nome, blob) {
    if (self.claude && self.claude.use) {
      const dl = await self.claude.use('downloads').catch(function () { return null; });
      if (dl) {
        try { await dl.save({ filename: nome, data: blob }); return 'salvo'; }
        catch (e) { if (e && e.code === 'declined') return 'recusado'; if (!/unavailable|not_granted|capability/.test(e && e.code || '')) throw e; }
      }
    }
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    return 'baixado';
  }

  // el: elemento a exportar; nome: arquivo .pdf
  async function gerar(el, nome) {
    const [h2c, jspdf] = await Promise.all([carregar('h2c'), carregar('pdf')]);
    document.documentElement.classList.add('gerando-pdf');
    let tela;
    try {
      tela = await h2c(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: 1100,
        onclone: function (doc) { doc.documentElement.classList.add('gerando-pdf'); doc.querySelectorAll('.no-print').forEach(function (n) { n.style.display = 'none'; }); } });
    } finally { document.documentElement.classList.remove('gerando-pdf'); }
    const pdf = new jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const M = 10, W = 210 - 2 * M, H = 297 - 2 * M; const pxPorMm = tela.width / W; const altPag = Math.floor(H * pxPorMm);
    // corta em páginas, evitando cortar no meio de uma linha de texto: procura uma faixa branca perto do fim da página
    const ctx = tela.getContext('2d'); let y = 0, pag = 0;
    const linhaBranca = function (yy) { const d = ctx.getImageData(0, yy, tela.width, 1).data; for (let i = 0; i < d.length; i += 16) if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) return false; return true; };
    while (y < tela.height) {
      let fim = Math.min(tela.height, y + altPag);
      if (fim < tela.height) { for (let k = fim; k > y + altPag * 0.7; k -= 2) { if (linhaBranca(k)) { fim = k; break; } } }
      const parte = document.createElement('canvas'); parte.width = tela.width; parte.height = fim - y;
      parte.getContext('2d').drawImage(tela, 0, y, tela.width, fim - y, 0, 0, tela.width, fim - y);
      if (pag) pdf.addPage();
      pdf.addImage(parte.toDataURL('image/jpeg', 0.92), 'JPEG', M, M, W, (fim - y) / pxPorMm);
      pdf.setFontSize(8); pdf.setTextColor(140); pdf.text('Plataforma 7 · página ' + (pag + 1), 210 - M, 297 - 4, { align: 'right' });
      y = fim; pag++;
    }
    return salvar(nome, pdf.output('blob'));
  }

  // imprimir: fora do claude.ai abre a impressão do navegador; dentro, gera o PDF
  async function imprimir(el, nome) {
    if (!emQuadro()) { window.print(); return 'impressao'; }
    return gerar(el, nome);
  }

  self.RelatorioPDF = { gerar: gerar, imprimir: imprimir, emQuadro: emQuadro, salvar: salvar };
})();
