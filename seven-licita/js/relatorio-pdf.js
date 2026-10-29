/* Relatórios em PDF no papel timbrado da Plataforma 7: o conteúdo é diagramado numa folha A4 de verdade
   (largura da folha, não da tela), cortado entre blocos e linhas de tabela e impresso com cabeçalho (logo,
   título e período) e rodapé (contato e página X de Y) em todas as páginas.
   No claude.ai a janela de impressão é bloqueada: ali o PDF é baixado; fora dele, "Imprimir" abre o PDF pronto. */
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

  // html2canvas 1.4 não lê cores 'color(srgb …)' (resultado de color-mix): troca por rgba() na cópia
  const PROPS_COR = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'textDecorationColor', 'fill', 'stroke'];
  function rgbaDe(v) {
    const m = /^color\(srgb\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)(?:\s*\/\s*([\d.e+-]+%?))?\s*\)$/.exec(String(v).trim()); if (!m) return null;
    const c = function (x) { return Math.round(Math.min(1, Math.max(0, Number(x))) * 255); }; const a = m[4] == null ? 1 : /%$/.test(m[4]) ? parseFloat(m[4]) / 100 : Number(m[4]);
    return 'rgba(' + c(m[1]) + ', ' + c(m[2]) + ', ' + c(m[3]) + ', ' + Math.min(1, Math.max(0, a)) + ')';
  }
  function corrigirCores(doc) {
    const win = doc.defaultView; if (!win) return;
    doc.querySelectorAll('*').forEach(function (n) {
      const cs = win.getComputedStyle(n);
      PROPS_COR.forEach(function (k) { const v = cs[k]; if (v && /^color\(/.test(v)) { const r = rgbaDe(v); n.style[k] = r || 'transparent'; } });
      if (/color\(/.test(cs.boxShadow || '')) n.style.boxShadow = 'none';
    });
  }

  // ---------- papel timbrado ----------
  const A4 = { w: 210, h: 297 }; const M = { esq: 16, dir: 16, topo: 30, base: 22 }; // mm
  const LARG_MM = A4.w - M.esq - M.dir; const ALT_MM = A4.h - M.topo - M.base;
  const PX_POR_MM = 96 / 25.4; const LARG_PX = Math.round(LARG_MM * PX_POR_MM); // largura de diagramação (≈673 px)
  const OURO = [182, 141, 64], TINTA = [24, 24, 24], CINZA = [120, 120, 120];
  let logoP = null;
  function logo() {
    return logoP = logoP || new Promise(function (ok) { const i = new Image(); i.onload = function () { try { const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext('2d').drawImage(i, 0, 0); ok({ url: c.toDataURL('image/png'), r: i.naturalHeight / i.naturalWidth }); } catch (e) { ok(null); } }; i.onerror = function () { ok(null); }; i.src = 'img/plataforma-logo-preta.png'; });
  }
  function contato() {
    const p = self.Pref ? Pref.obter() : {}; return [self.Pref ? Pref.telefone() : '(61) 98347-2232', p.email, p.horario].filter(Boolean).join(' · ');
  }
  function timbrar(pdf, pag, total, cab, lg) {
    pdf.setFillColor(OURO[0], OURO[1], OURO[2]); pdf.rect(0, 0, A4.w, 2.2, 'F');
    if (lg) { const w = 46; pdf.addImage(lg.url, 'PNG', M.esq, 11, w, w * lg.r); } else { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(TINTA[0], TINTA[1], TINTA[2]); pdf.text('PLATAFORMA 7', M.esq, 15); }
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(CINZA[0], CINZA[1], CINZA[2]); pdf.text('SEVEN · BPO DE LICITAÇÕES', M.esq, 19.6, { charSpace: 0.4 });
    const tx = A4.w - M.dir; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); pdf.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
    pdf.text(pdf.splitTextToSize(cab.titulo || 'Relatório', 105)[0], tx, 13.5, { align: 'right' });
    if (cab.sub) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(CINZA[0], CINZA[1], CINZA[2]); pdf.text(pdf.splitTextToSize(cab.sub, 105)[0], tx, 18, { align: 'right' }); }
    pdf.setDrawColor(OURO[0], OURO[1], OURO[2]); pdf.setLineWidth(0.5); pdf.line(M.esq, 23, A4.w - M.dir, 23);
    // rodapé
    const yb = A4.h - 13; pdf.setDrawColor(220, 214, 200); pdf.setLineWidth(0.25); pdf.line(M.esq, yb - 4, A4.w - M.dir, yb - 4);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(TINTA[0], TINTA[1], TINTA[2]); pdf.text('Plataforma 7', M.esq, yb);
    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(CINZA[0], CINZA[1], CINZA[2]); pdf.text(pdf.splitTextToSize(contato(), 120)[0], M.esq + 17, yb);
    pdf.text('Gerado em ' + new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), M.esq, yb + 3.8);
    pdf.setFont('helvetica', 'bold'); pdf.setTextColor(OURO[0], OURO[1], OURO[2]); pdf.text('Página ' + pag + ' de ' + total, A4.w - M.dir, yb, { align: 'right' });
    pdf.setFillColor(OURO[0], OURO[1], OURO[2]); pdf.rect(0, A4.h - 2.2, A4.w, 2.2, 'F');
  }

  // cópia do relatório na largura da folha, com o visual de papel
  function montarFolha(el) {
    const caixa = document.createElement('div'); caixa.className = 'papel-a4-caixa'; caixa.setAttribute('aria-hidden', 'true');
    const folha = el.cloneNode(true); folha.classList.add('papel-a4'); folha.removeAttribute('id'); folha.style.width = LARG_PX + 'px';
    folha.querySelectorAll('.no-print, button, details > summary').forEach(function (n) { if (n.matches('details > summary')) return; n.remove(); });
    folha.querySelectorAll('details').forEach(function (d) { d.open = true; });
    // células curtas (datas, etapas, números) não quebram no meio da palavra
    folha.querySelectorAll('td, th').forEach(function (c) { const t = c.textContent.trim(); if (t.length <= 16 && !/\s.{8,}/.test(t)) c.classList.add('papel-curta'); });
    folha.querySelectorAll('input, select, textarea').forEach(function (n) { const s = document.createElement('span'); s.className = 'papel-campo'; s.textContent = n.tagName === 'SELECT' ? (n.options[n.selectedIndex] || {}).text || '' : n.value; n.replaceWith(s); });
    caixa.appendChild(folha); document.body.appendChild(caixa);
    return { caixa: caixa, folha: folha };
  }
  // pontos de corte possíveis (px, a partir do topo da folha): depois de blocos e linhas, antes de títulos
  function cortes(folha) {
    const topo = folha.getBoundingClientRect().top; const out = new Set();
    folha.querySelectorAll('section, header, .cm-kpis > div, .cm-numeros > div, tbody tr, li, p, dl > div, .cm-meta, .rl-veredito, .rl-motivo, .linha, figure, svg, .rl-graf, .cl-res > div, table').forEach(function (n) {
      if (n.closest('thead')) return; const r = n.getBoundingClientRect(); if (!r.height) return;
      // não corta logo depois do primeiro item de uma tabela ou lista: o título dela ficaria sozinho
      out.add(Math.round(r.bottom - topo) + 2);
    });
    // nunca deixa um título ou um cabeçalho de tabela sozinho no fim da página
    folha.querySelectorAll('h2, h3, h4, thead, .cm-cab-rel').forEach(function (n) { const r = n.getBoundingClientRect(); const fim = Math.round(r.bottom - topo) + 2; out.delete(fim); });
    folha.querySelectorAll('h2, h3, h4, section').forEach(function (n) { const r = n.getBoundingClientRect(); if (r.height) out.add(Math.max(0, Math.round(r.top - topo) - 6)); });
    // um corte só vale se não atravessar nenhum texto, cartão, linha de tabela ou imagem
    const win = folha.ownerDocument.defaultView; const limite = ALT_MM * PX_POR_MM * 0.5; const atomos = [];
    folha.querySelectorAll('*').forEach(function (n) {
      const r = n.getBoundingClientRect(); if (!r.height || r.height > limite) return;
      const temTexto = Array.prototype.some.call(n.childNodes, function (c) { return c.nodeType === 3 && c.nodeValue.trim(); });
      const cs = win.getComputedStyle(n); const caixa = cs.borderTopWidth !== '0px' || cs.borderBottomWidth !== '0px' || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent');
      if (temTexto || caixa || /^(TR|IMG|SVG|CANVAS|svg)$/.test(n.tagName)) atomos.push([r.top - topo, r.bottom - topo]);
    });
    return Array.from(out).filter(function (y) { return !atomos.some(function (a) { return a[0] + 1 < y && y < a[1] - 1; }); }).sort(function (a, b) { return a - b; });
  }

  // el: elemento a exportar; nome: arquivo .pdf; opc: { titulo, sub }
  async function montarPDF(el, opc) {
    opc = opc || {};
    const [h2c, jspdf, lg] = await Promise.all([carregar('h2c'), carregar('pdf'), logo()]);
    const cab = { titulo: opc.titulo, sub: opc.sub };
    const t = el.querySelector('.cm-cab-rel b, .cabecalho-seven b, h1, h2'); const s = el.querySelector('.cm-cab-rel small, .cabecalho-seven small');
    if (!cab.titulo && t) cab.titulo = t.textContent.trim(); if (!cab.sub && s) cab.sub = s.textContent.trim();
    const f = montarFolha(el); let tela, pontos;
    try {
      await new Promise(function (ok) { requestAnimationFrame(function () { requestAnimationFrame(ok); }); });
      pontos = cortes(f.folha);
      tela = await h2c(f.folha, { scale: 2.5, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: Math.max(1280, window.innerWidth), windowHeight: Math.max(900, window.innerHeight), onclone: function (doc) { corrigirCores(doc); } });
    } finally { f.caixa.remove(); }
    const escala = tela.width / LARG_PX; const altPagPx = ALT_MM * PX_POR_MM; const totalPx = tela.height / escala;
    // páginas: o maior ponto de corte que cabe; se nenhum servir, corta na altura da página
    const fatias = []; let y = 0;
    while (y < totalPx - 2) {
      let fim = y + altPagPx;
      if (fim < totalPx) { const ok = pontos.filter(function (p) { return p > y + altPagPx * 0.45 && p <= fim; }); if (ok.length) fim = ok[ok.length - 1]; } else fim = totalPx;
      fatias.push([y, fim]); y = fim;
    }
    const pdf = new jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    pdf.setProperties({ title: cab.titulo || 'Relatório', subject: cab.sub || '', creator: 'Plataforma 7', author: self.Pref ? Pref.assinatura() : 'Seven' });
    fatias.forEach(function (fx, i) {
      if (i) pdf.addPage();
      const ini = Math.round(fx[0] * escala), alt = Math.max(1, Math.round((fx[1] - fx[0]) * escala));
      const parte = document.createElement('canvas'); parte.width = tela.width; parte.height = alt;
      const g = parte.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, parte.width, alt); g.drawImage(tela, 0, ini, tela.width, alt, 0, 0, tela.width, alt);
      pdf.addImage(parte.toDataURL('image/jpeg', 0.92), 'JPEG', M.esq, M.topo, LARG_MM, (fx[1] - fx[0]) / PX_POR_MM);
      timbrar(pdf, i + 1, fatias.length, cab, lg);
    });
    return pdf.output('blob');
  }
  async function gerar(el, nome, opc) { return salvar(nome, await montarPDF(el, opc)); }

  // imprimir: fora do claude.ai abre o PDF timbrado numa aba para imprimir; dentro (impressão bloqueada), baixa o PDF
  async function imprimir(el, nome, opc) {
    if (emQuadro()) return gerar(el, nome, opc);
    const aba = window.open('', '_blank'); // aberta já no clique, para o navegador não bloquear
    try {
      const blob = await montarPDF(el, opc); const url = URL.createObjectURL(blob);
      if (aba && !aba.closed) { aba.location.href = url; setTimeout(function () { URL.revokeObjectURL(url); }, 120000); return 'aberto'; }
      URL.revokeObjectURL(url); return salvar(nome, blob);
    } catch (e) { if (aba && !aba.closed) aba.close(); throw e; }
  }

  self.RelatorioPDF = { _cortes: cortes, _montarFolha: montarFolha, rgbaDe: rgbaDe, gerar: gerar, montarPDF: montarPDF, imprimir: imprimir, emQuadro: emQuadro, salvar: salvar, LARGURA: LARG_PX };
})();
