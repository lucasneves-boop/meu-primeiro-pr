/* Plataforma 7 — utilidades de interface. */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function moeda(v) { return v == null || v === '' || !isFinite(v) ? '—' : moedaFmt.format(v); }
  function num(v, casas) { return v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas || 0, maximumFractionDigits: casas == null ? 2 : casas }); }
  function pct(v) { return v == null || !isFinite(v) ? '—' : (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'; }
  function data(d) { if (!d) return '—'; const x = new Date(d.length === 10 ? d + 'T12:00:00' : d); return isNaN(x) ? '—' : x.toLocaleDateString('pt-BR'); }
  function dataHora(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
  function cnpj(c) { const s = String(c || '').replace(/\D/g, ''); return s.length === 14 ? s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : c || ''; }
  function emQuanto(d) {
    if (!d) return '';
    const ms = new Date(d) - Date.now(); const abs = Math.abs(ms);
    const h = Math.floor(abs / 3600000), dd = Math.floor(h / 24);
    const t = dd >= 1 ? dd + ' dia(s)' : h >= 1 ? h + ' h' : Math.max(1, Math.floor(abs / 60000)) + ' min';
    return ms >= 0 ? 'em ' + t : 'há ' + t;
  }

  // "3 aviso(s)" → "3 avisos", "1 cartão(ões)" → "1 cartão": o número mais próximo antes da palavra decide
  const RE_PL = /([A-Za-zÀ-ÿ]+)\((s|es|ões|ns|is)\)/g;
  function flexionar(palavra, suf, um) {
    if (um) return palavra;
    if (suf === 'ões') return /ão$/.test(palavra) ? palavra.replace(/ão$/, 'ões') : palavra + 'ões';
    if (suf === 'is') return /l$/.test(palavra) ? palavra.replace(/l$/, 'is') : palavra + 'is';
    if (suf === 'ns') return /m$/.test(palavra) ? palavra.replace(/m$/, 'ns') : palavra + 'ns';
    return palavra + suf;
  }
  function plurais(t) {
    t = String(t == null ? '' : t); if (t.indexOf('(') < 0) return t;
    return t.replace(RE_PL, function (m, palavra, suf, pos) {
      const antes = t.slice(Math.max(0, pos - 60), pos).replace(/<[^>]*>/g, ' ');
      const nums = antes.match(/(?:^|[^\w,.])(\d+(?:[.,]\d+)?)(?=[^\d]*$)/); const trecho = nums ? antes.slice(antes.lastIndexOf(nums[1])) : '';
      const perto = nums && !/[.;:!?\n]/.test(trecho.slice(nums[1].length)) && trecho.split(/\s+/).length <= 6;
      const um = perto && Number(nums[1].replace(',', '.')) === 1;
      return flexionar(palavra, suf, um);
    });
  }
  function pluraisEm(raiz) {
    if (!raiz) return; const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return n.nodeValue.indexOf('(') >= 0 && !n.parentElement.closest('textarea,script,style,[contenteditable],pre,code,input') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
    const ns = []; while (w.nextNode()) ns.push(w.currentNode);
    ns.forEach(function (n) { const v = plurais(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; });
  }

  // aplica as flexões em tudo que é desenhado na tela (telas, janelas, modais e avisos)
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    const fila = new Set(); let agendado = false;
    const processar = function () { agendado = false; fila.forEach(function (n) { if (n.isConnected) { if (n.nodeType === 3) { if (!n.parentElement || !n.parentElement.closest('textarea,script,style,[contenteditable],pre,code')) { const v = plurais(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } } else pluraisEm(n); } }); fila.clear(); };
    const obs = new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1 || (n.nodeType === 3 && n.nodeValue.indexOf('(') >= 0)) fila.add(n); }); }); if (fila.size && !agendado) { agendado = true; Promise.resolve().then(processar); } });
    const iniciar = function () { obs.observe(document.body, { childList: true, subtree: true }); pluraisEm(document.body); };
    if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
  }

  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }

  function aviso(texto, tipo) {
    const box = $('#avisos-flutuantes');
    const el = document.createElement('div');
    el.className = 'toast ' + (tipo || '');
    el.setAttribute('role', 'status');
    el.textContent = plurais(texto);
    box.appendChild(el);
    setTimeout(function () { el.classList.add('sai'); setTimeout(function () { el.remove(); }, 400); }, tipo === 'erro' ? 7000 : (self.Pref ? Math.max(2, Number(Pref.obter().avisosSegundos) || 4) * 1000 : 3500));
  }

  // Modal: devolve Promise com o FormData (ou null se cancelado).
  function modal(opcoes) {
    return new Promise(function (ok) {
      const fundo = document.createElement('div');
      fundo.className = 'modal-fundo';
      fundo.innerHTML = '<form class="modal ' + (opcoes.largo ? 'largo' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(opcoes.titulo) + '">' +
        '<header><h2>' + esc(opcoes.titulo) + '</h2><button type="button" class="icone fechar" aria-label="Fechar">×</button></header>' +
        '<div class="modal-corpo">' + opcoes.corpo + '</div>' +
        '<footer>' + (opcoes.semCancelar ? '' : '<button type="button" class="btn fantasma cancelar">Cancelar</button>') +
        (opcoes.botao === false ? '' : '<button type="submit" class="btn primario">' + esc(opcoes.botao || 'Salvar') + '</button>') + '</footer></form>';
      document.body.appendChild(fundo); pluraisEm(fundo.querySelector('.modal-corpo')); pluraisEm(fundo.querySelector('header'));
      const form = fundo.querySelector('form');
      function fim(v) { fundo.remove(); document.removeEventListener('keydown', esc_); window.removeEventListener('hashchange', saiu); ok(v); }
      function esc_(e) { if (e.key === 'Escape') fim(null); }
      // trocar de tela fecha a janela (ela pertence à tela em que foi aberta)
      function saiu() { if (document.body.contains(fundo)) fim(null); }
      document.addEventListener('keydown', esc_); window.addEventListener('hashchange', saiu);
      fundo.querySelector('.fechar').onclick = function () { fim(null); };
      const c = fundo.querySelector('.cancelar'); if (c) c.onclick = function () { fim(null); };
      fundo.addEventListener('mousedown', function (e) { if (e.target === fundo) fim(null); });
      form.onsubmit = function (e) {
        e.preventDefault();
        if (opcoes.validar) { const msg = opcoes.validar(new FormData(form), form); if (msg) { aviso(msg, 'erro'); return; } }
        fim(new FormData(form));
      };
      if (opcoes.aoAbrir) opcoes.aoAbrir(form);
      const primeiro = form.querySelector('input:not([type=hidden]),select,textarea'); if (primeiro) primeiro.focus();
    });
  }

  async function confirmar(titulo, texto, botao) {
    const r = await modal({ titulo: titulo, corpo: '<p>' + texto + '</p>', botao: botao || 'Confirmar' });
    return r !== null;
  }

  function opcoes(lista, selecionado) {
    return lista.map(function (o) {
      const v = typeof o === 'object' ? o.v : o; const t = typeof o === 'object' ? o.t : o;
      const sel = Array.isArray(selecionado) ? selecionado.map(String).indexOf(String(v)) >= 0 : String(v) === String(selecionado);
      return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(t) + '</option>';
    }).join('');
  }

  function campo(rotulo, html, dica) {
    return '<label class="campo"><span>' + esc(rotulo) + '</span>' + html + (dica ? '<small>' + dica + '</small>' : '') + '</label>';
  }

  function baixar(nome, conteudo, tipo) {
    const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo || 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // Link seguro: só http(s), e-mail, telefone e rotas internas. Qualquer outro esquema (javascript:, data:…) vira '#'.
  function url(u) { const t = String(u == null ? '' : u).replace(/[\u0000-\u0020]+/g, ''); return /^(https?:\/\/|mailto:|tel:|#\/)/i.test(t) ? String(u).trim() : '#'; }
  // Abre um arquivo guardado sem dar a ele acesso ao app: HTML/SVG e tipos desconhecidos são baixados, não abertos.
  const ABRIVEIS = /^(application\/pdf|image\/(png|jpe?g|gif|webp|bmp)|video\/|audio\/|text\/plain)/i;
  function abrirArquivo(blob, nome) {
    if (!blob) return false;
    if (!ABRIVEIS.test(blob.type || '')) { baixar(nome || 'arquivo', blob); return true; }
    const u = URL.createObjectURL(blob); const w = window.open(u, '_blank', 'noopener'); setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
    if (!w) baixar(nome || 'arquivo', blob); return true;
  }
  function lerArquivoTexto(arquivo) {
    return new Promise(function (ok, erro) { const r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = erro; r.readAsText(arquivo, 'utf-8'); });
  }

  function escolherArquivo(aceita, multiplo) {
    return new Promise(function (ok) {
      const i = document.createElement('input'); i.type = 'file'; if (aceita) i.accept = aceita; i.multiple = !!multiplo;
      i.onchange = function () { ok(multiplo ? Array.prototype.slice.call(i.files) : i.files[0]); };
      i.click();
    });
  }

  function vazio(titulo, texto, acao) {
    return '<div class="vazio"><h3>' + esc(titulo) + '</h3><p>' + texto + '</p>' + (acao || '') + '</div>';
  }

  function abas(lista, ativa, base) {
    return '<nav class="abas" role="tablist">' + lista.map(function (a) {
      return '<a role="tab" href="#/' + base + '/' + a.id + '" class="' + (a.id === ativa ? 'ativa' : '') + '" aria-selected="' + (a.id === ativa) + '">' + esc(a.t) + (a.n ? ' <span class="contador">' + a.n + '</span>' : '') + '</a>';
    }).join('') + '</nav>';
  }

  function progresso(el, texto, frac) {
    el.innerHTML = '<div class="progresso"><div class="barra"><i style="width:' + Math.round((frac || 0) * 100) + '%"></i></div><span>' + esc(texto) + '</span></div>';
  }

  // Gráfico de barras em SVG (sem biblioteca).
  function barras(dados, opc) {
    opc = opc || {};
    if (!dados.length) return '<p class="mudo">Sem dados.</p>';
    const max = Math.max.apply(null, dados.map(function (d) { return d.v; })) || 1;
    const larg = 100 / dados.length;
    return '<svg class="grafico" viewBox="0 0 100 60" preserveAspectRatio="none" role="img" aria-label="' + esc(opc.rotulo || 'gráfico') + '">' +
      dados.map(function (d, i) {
        const h = d.v / max * 50;
        return '<rect x="' + (i * larg + larg * 0.15) + '" y="' + (52 - h) + '" width="' + (larg * 0.7) + '" height="' + h + '" rx="0.6"><title>' + esc(d.t + ': ' + (opc.fmt ? opc.fmt(d.v) : d.v)) + '</title></rect>';
      }).join('') + '</svg><div class="grafico-eixo">' + dados.map(function (d) { return '<span>' + esc(d.t) + '</span>'; }).join('') + '</div>';
  }

  self.UI = {
    esc: esc, moeda: moeda, num: num, pct: pct, data: data, dataHora: dataHora, cnpj: cnpj, emQuanto: emQuanto, $: $, $$: $$,
    aviso: aviso, modal: modal, confirmar: confirmar, opcoes: opcoes, campo: campo, baixar: baixar, lerArquivoTexto: lerArquivoTexto,
    plurais: plurais, pluraisEm: pluraisEm, escolherArquivo: escolherArquivo, url: url, abrirArquivo: abrirArquivo, vazio: vazio, abas: abas, progresso: progresso, barras: barras
  };
})();
