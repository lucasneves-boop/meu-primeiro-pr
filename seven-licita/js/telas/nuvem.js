/* Seven Arquivos: arquivos e pastas no estilo Google Drive (os arquivos ficam no navegador, em IndexedDB). */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, dataHora, campo, opcoes, modal, confirmar, aviso } = UI;
  const CORES_PASTA = { cinza: '#8c9bab', dourado: '#b68d40', vermelho: '#d94b3f', laranja: '#e8892e', amarelo: '#e6b800', verde: '#2e9e5b', azul: '#3d7be0', roxo: '#7a55c7', rosa: '#d9559a', preto: '#3b3b3b' };
  const ESTRUTURA_CLIENTE = ['01 Habilitação/Jurídica', '01 Habilitação/Fiscal e trabalhista', '01 Habilitação/Técnica (atestados)', '01 Habilitação/Econômico-financeira', '02 Editais', '03 Propostas', '04 Atas e contratos', '05 Empenhos e notas fiscais', '06 Pagamentos', '07 Recursos e peças'];
  const est = { pasta: null, secao: 'drive', modo: 'grade', ordem: 'nome', dir: 1, sel: [], busca: '', ultimoClique: null };
  const urls = {};

  function e() { const d = Dados.e; d.nuvem = d.nuvem || { itens: [] }; return d.nuvem; }
  function item(id) { return e().itens.find(function (x) { return x.id === id; }); }
  function filhos(pai, comLixeira) { return e().itens.filter(function (x) { return (x.pai || null) === (pai || null) && (comLixeira || !x.lixeira); }); }
  function caminho(id) { const out = []; let x = id && item(id); while (x) { out.unshift(x); x = x.pai && item(x.pai); } return out; }
  function descendentes(id) { let out = []; filhos(id, true).forEach(function (f) { out.push(f); if (f.tipo === 'pasta') out = out.concat(descendentes(f.id)); }); return out; }
  function tamanhoPasta(id) { return descendentes(id).reduce(function (s, x) { return s + (x.tamanho || 0); }, 0); }
  function fmtTam(b) { if (!b) return '—'; const u = ['B', 'KB', 'MB', 'GB']; let i = 0; while (b >= 1024 && i < 3) { b /= 1024; i++; } return b.toLocaleString('pt-BR', { maximumFractionDigits: i ? 1 : 0 }) + ' ' + u[i]; }
  function icone(x) {
    if (x.tipo === 'pasta') return '<svg viewBox="0 0 24 24" class="nicone" aria-hidden="true"><path fill="' + (CORES_PASTA[x.cor] || CORES_PASTA.cinza) + '" d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/></svg>';
    const m = x.mime || ''; const ext = (x.nome.split('.').pop() || '').toLowerCase();
    const cor = /pdf/.test(m) || ext === 'pdf' ? '#d94b3f' : /image/.test(m) ? '#d9559a' : /video/.test(m) ? '#7a55c7' : /audio/.test(m) ? '#e8892e' : /sheet|excel|csv/.test(m) || /xlsx?|csv|ods/.test(ext) ? '#2e9e5b' : /word|document/.test(m) || /docx?|odt|rtf/.test(ext) ? '#3d7be0' : /zip|rar|7z/.test(ext) ? '#5f6670' : '#8c9bab';
    return '<span class="nicone arq" style="background:' + cor + '">' + esc(ext.slice(0, 4).toUpperCase() || 'ARQ') + '</span>';
  }
  function tocar(x) { x.modificadoEm = new Date().toISOString(); }
  function salvar() { Dados.salvar(); }

  function novaPasta(nome, pai, cor) { const x = { id: Dados.id('nv'), tipo: 'pasta', nome: nome, pai: pai || null, cor: cor || 'cinza', criadoEm: new Date().toISOString(), modificadoEm: new Date().toISOString() }; e().itens.push(x); return x; }
  function garantirCaminho(partes, pai) {
    let atual = pai || null;
    partes.forEach(function (n) { let p = filhos(atual).find(function (x) { return x.tipo === 'pasta' && x.nome === n; }); if (!p) p = novaPasta(n, atual); atual = p.id; });
    return atual;
  }

  async function enviarArquivos(lista, pai) {
    let n = 0; let total = 0;
    for (const f of lista) {
      const rel = f.webkitRelativePath || f.caminhoRelativo || '';
      const partes = rel ? rel.split('/').slice(0, -1) : [];
      const destino = partes.length ? garantirCaminho(partes, pai) : pai;
      const id = Dados.id('nv');
      try { await Dados.guardarArquivo(id, f); } catch (err) { aviso('Não foi possível guardar ' + f.name + ': ' + err.message, 'erro'); continue; }
      let nome = f.name; const ja = filhos(destino).map(function (x) { return x.nome; });
      let k = 1; while (ja.indexOf(nome) >= 0) { nome = f.name.replace(/(\.[^.]+)?$/, ' (' + k++ + ')$1'); }
      e().itens.push({ id: id, tipo: 'arquivo', nome: nome, pai: destino || null, mime: f.type, tamanho: f.size, criadoEm: new Date().toISOString(), modificadoEm: new Date(f.lastModified || Date.now()).toISOString() });
      n++; total += f.size;
    }
    salvar(); if (n) aviso(n + ' arquivo(s) enviados (' + fmtTam(total) + ').');
    App.redesenhar();
  }

  // Arrastar uma pasta inteira do computador (lê a árvore com a API de entradas do navegador).
  async function lerEntradas(items) {
    const arquivos = [];
    async function ler(entry, base) {
      if (entry.isFile) { await new Promise(function (ok) { entry.file(function (f) { f.caminhoRelativo = base + f.name; arquivos.push(f); ok(); }, ok); }); return; }
      if (entry.isDirectory) {
        const leitor = entry.createReader(); let lote;
        do { lote = await new Promise(function (ok) { leitor.readEntries(ok, function () { ok([]); }); }); for (const x of lote) await ler(x, base + entry.name + '/'); } while (lote.length);
      }
    }
    for (const it of items) { const en = it.webkitGetAsEntry && it.webkitGetAsEntry(); if (en) await ler(en, ''); else if (it.getAsFile) { const f = it.getAsFile(); if (f) arquivos.push(f); } }
    return arquivos;
  }

  function listaAtual() {
    let l;
    if (est.busca) { const t = Nucleo.normalizar(est.busca); l = e().itens.filter(function (x) { return !x.lixeira && Nucleo.normalizar(x.nome + ' ' + (x.descricao || '')).indexOf(t) >= 0; }); }
    else if (est.secao === 'recentes') l = e().itens.filter(function (x) { return !x.lixeira && x.tipo === 'arquivo'; }).sort(function (a, b) { return new Date(b.acessadoEm || b.modificadoEm) - new Date(a.acessadoEm || a.modificadoEm); }).slice(0, 50);
    else if (est.secao === 'estrela') l = e().itens.filter(function (x) { return !x.lixeira && x.estrela; });
    else if (est.secao === 'lixeira') l = e().itens.filter(function (x) { return x.lixeira && !(x.pai && item(x.pai) && item(x.pai).lixeira); });
    else l = filhos(est.pasta);
    if (est.secao === 'recentes' && !est.busca) return l;
    const o = est.ordem, d = est.dir;
    return l.sort(function (a, b) {
      if (a.tipo !== b.tipo) return a.tipo === 'pasta' ? -1 : 1;
      const x = o === 'tamanho' ? (a.tipo === 'pasta' ? tamanhoPasta(a.id) : a.tamanho || 0) : o === 'modificado' ? new Date(a.modificadoEm) : a.nome.toLowerCase();
      const y = o === 'tamanho' ? (b.tipo === 'pasta' ? tamanhoPasta(b.id) : b.tamanho || 0) : o === 'modificado' ? new Date(b.modificadoEm) : b.nome.toLowerCase();
      return (x > y ? 1 : x < y ? -1 : 0) * d;
    });
  }

  async function render(el) {
    if (est.pasta && !item(est.pasta)) est.pasta = null;
    const l = listaAtual();
    const usado = e().itens.reduce(function (s, x) { return s + (x.lixeira ? 0 : x.tamanho || 0); }, 0);
    const migalhas = est.busca ? '<span>Resultados para "' + esc(est.busca) + '"</span>' : est.secao !== 'drive' ? '<span>' + { recentes: 'Recentes', estrela: 'Com estrela', lixeira: 'Lixeira' }[est.secao] + '</span>' :
      '<a href="#" data-ir="">Meu Drive</a>' + caminho(est.pasta).map(function (x) { return ' <span class="mudo">›</span> <a href="#" data-ir="' + x.id + '" data-soltar-pasta="' + x.id + '">' + esc(x.nome) + '</a>'; }).join('');
    el.innerHTML = '<div class="nuvem"><aside class="n-lado">' +
      '<button class="btn primario n-novo" data-a="menu-novo">＋ Novo</button>' +
      [['drive', '🗂 Meu Drive'], ['recentes', '🕘 Recentes'], ['estrela', '★ Com estrela'], ['lixeira', '🗑 Lixeira']].map(function (s) { return '<a href="#" class="n-sec ' + (est.secao === s[0] && !est.busca ? 'ativa' : '') + '" data-secao="' + s[0] + '"' + (s[0] === 'drive' ? ' data-soltar-pasta=""' : '') + '>' + s[1] + '</a>'; }).join('') +
      '<div class="n-arm"><div class="barra"><i style="width:' + Math.min(100, usado / (5 * 1024 * 1024 * 1024) * 100) + '%"></i></div><small>' + fmtTam(usado) + ' usados</small><small id="n-cota" class="mudo"></small></div>' +
      '<p class="mini mudo">Os arquivos ficam neste navegador. Para levar a outro computador, baixe as pastas.</p></aside>' +
      '<section class="n-principal" id="n-zona"><div class="n-topo"><form id="n-busca"><input type="search" name="q" placeholder="Pesquisar no Drive" value="' + esc(est.busca) + '"></form>' +
      '<div class="grupo-botoes"><select id="n-ordem" aria-label="Ordenar">' + opcoes([{ v: 'nome', t: 'Nome' }, { v: 'modificado', t: 'Modificação' }, { v: 'tamanho', t: 'Tamanho' }], est.ordem) + '</select><button class="btn" data-a="dir" aria-label="Inverter ordem">' + (est.dir > 0 ? '↑' : '↓') + '</button><button class="btn" data-a="modo">' + (est.modo === 'grade' ? '☰ Lista' : '▦ Grade') + '</button></div></div>' +
      '<nav class="n-migalhas">' + migalhas + '</nav>' +
      '<div id="n-selbar">' + selbar() + '</div>' +
      (est.secao === 'lixeira' && l.length ? '<p class="mini mudo">Itens na lixeira podem ser restaurados. <button class="btn mini fantasma perigo" data-a="esvaziar">Esvaziar lixeira</button></p>' : '') +
      (l.length ? (est.modo === 'grade' ? grade(l) : lista(l)) : vazio()) +
      '<input type="file" id="n-up" multiple hidden><input type="file" id="n-up-pasta" webkitdirectory multiple hidden></section></div>';
    ligar(el);
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (q) { const c = el.querySelector('#n-cota'); if (c && q.quota) c.textContent = 'Espaço do navegador: ' + fmtTam(q.usage) + ' de ' + fmtTam(q.quota); }).catch(function () {});
    carregarMiniaturas(el);
  }

  function selbar() {
    return est.sel.length ? '<div class="n-selbar"><b>' + est.sel.length + ' selecionado(s)</b>' + (est.secao === 'lixeira' ? '<button class="btn mini" data-a="restaurar">Restaurar</button><button class="btn mini perigo" data-a="excluir-de-vez">Excluir para sempre</button>' : '<button class="btn mini" data-a="baixar">Baixar</button><button class="btn mini" data-a="mover">Mover</button><button class="btn mini" data-a="copiar">Fazer cópia</button><button class="btn mini" data-a="estrela">★ Estrela</button><button class="btn mini perigo" data-a="lixeira">Excluir</button>') + '<button class="btn mini fantasma" data-a="limpar-sel">×</button></div>' : '';
  }
  // Seleção só marca os itens (sem redesenhar), para não atrapalhar o duplo clique.
  function marcarSelecao(el) {
    el.querySelectorAll('.n-item').forEach(function (n) { n.classList.toggle('sel', est.sel.indexOf(n.dataset.id) >= 0); });
    const b = el.querySelector('#n-selbar'); if (b) b.innerHTML = selbar();
  }

  function vazio() {
    if (est.busca) return UI.vazio('Nada encontrado', 'Tente outro nome.');
    if (est.secao === 'lixeira') return UI.vazio('Lixeira vazia', 'Itens excluídos aparecem aqui.');
    if (est.secao === 'estrela') return UI.vazio('Nenhum item com estrela', 'Marque arquivos e pastas importantes com a estrela.');
    return '<div class="vazio n-soltar-aqui"><h3>Solte arquivos ou pastas aqui</h3><p>Ou use <b>＋ Novo</b>. Dica: crie a estrutura padrão de um cliente (Habilitação, Editais, Propostas, Contratos…).</p><div class="grupo-botoes" style="justify-content:center"><button class="btn" data-a="estrutura">Criar estrutura de cliente</button><button class="btn primario" data-a="upload">Enviar arquivos</button></div></div>';
  }

  function grade(l) {
    const pastas = l.filter(function (x) { return x.tipo === 'pasta'; }); const arqs = l.filter(function (x) { return x.tipo !== 'pasta'; });
    const sel = function (x) { return est.sel.indexOf(x.id) >= 0 ? ' sel' : ''; };
    return (pastas.length ? '<h4 class="n-sub">Pastas</h4><div class="n-pastas">' + pastas.map(function (x) { return '<div class="n-item n-pasta' + sel(x) + '" data-id="' + x.id + '" draggable="true" data-soltar-pasta="' + x.id + '" tabindex="0">' + icone(x) + '<span class="n-nome">' + esc(x.nome) + '</span>' + (x.estrela ? '<span class="n-estrela">★</span>' : '') + '<button class="icone n-mais" data-menu="' + x.id + '" aria-label="Mais ações">⋮</button></div>'; }).join('') + '</div>' : '') +
      (arqs.length ? '<h4 class="n-sub">Arquivos</h4><div class="n-arquivos">' + arqs.map(function (x) { return '<div class="n-item n-arq' + sel(x) + '" data-id="' + x.id + '" draggable="true" tabindex="0"><div class="n-prev">' + (/^image\//.test(x.mime || '') ? '<img data-mini="' + x.id + '" alt="">' : icone(x)) + '</div><div class="n-rodape">' + icone(x) + '<span class="n-nome" title="' + esc(x.nome) + '">' + esc(x.nome) + '</span>' + (x.estrela ? '<span class="n-estrela">★</span>' : '') + '<button class="icone n-mais" data-menu="' + x.id + '" aria-label="Mais ações">⋮</button></div></div>'; }).join('') + '</div>' : '');
  }

  function lista(l) {
    return '<div class="tabela-rolagem"><table class="tabela n-tabela"><thead><tr><th>Nome</th>' + (est.busca || est.secao !== 'drive' ? '<th>Local</th>' : '') + '<th>Modificado</th><th class="n">Tamanho</th><th></th></tr></thead><tbody>' +
      l.map(function (x) { return '<tr class="n-item' + (est.sel.indexOf(x.id) >= 0 ? ' sel' : '') + '" data-id="' + x.id + '" draggable="true"' + (x.tipo === 'pasta' ? ' data-soltar-pasta="' + x.id + '"' : '') + '><td><span class="n-linha-nome">' + icone(x) + ' ' + esc(x.nome) + (x.estrela ? ' <span class="n-estrela">★</span>' : '') + '</span></td>' + (est.busca || est.secao !== 'drive' ? '<td class="mini mudo">' + esc(['Meu Drive'].concat(caminho(x.pai).map(function (p) { return p.nome; })).join(' › ')) + '</td>' : '') + '<td>' + dataHora(x.modificadoEm) + '</td><td class="n">' + (x.tipo === 'pasta' ? fmtTam(tamanhoPasta(x.id)) : fmtTam(x.tamanho)) + '</td><td><button class="icone" data-menu="' + x.id + '" aria-label="Mais ações">⋮</button></td></tr>'; }).join('') + '</tbody></table></div>';
  }

  function carregarMiniaturas(el) {
    el.querySelectorAll('img[data-mini]').forEach(async function (img) {
      const id = img.dataset.mini;
      if (!urls[id]) { try { const b = await Dados.lerArquivo(id); if (b) urls[id] = URL.createObjectURL(b); } catch (err) { /* sem arquivo */ } }
      if (urls[id]) img.src = urls[id];
    });
  }

  function ligar(el) {
    const zona = el.querySelector('#n-zona');
    el.querySelector('#n-busca').onsubmit = function (ev) { ev.preventDefault(); est.busca = new FormData(this).get('q').trim(); est.sel = []; App.redesenhar(); };
    el.querySelector('#n-ordem').onchange = function () { est.ordem = this.value; App.redesenhar(); };
    el.querySelector('#n-up').onchange = function () { enviarArquivos(Array.prototype.slice.call(this.files), est.pasta); };
    el.querySelector('#n-up-pasta').onchange = function () { enviarArquivos(Array.prototype.slice.call(this.files), est.pasta); };
    el.onclick = async function (ev) {
      const sec = ev.target.closest('[data-secao]'); if (sec) { ev.preventDefault(); est.secao = sec.dataset.secao; est.busca = ''; est.sel = []; if (est.secao === 'drive') est.pasta = null; App.redesenhar(); return; }
      const ir = ev.target.closest('[data-ir]'); if (ir) { ev.preventDefault(); abrirPasta(ir.dataset.ir || null); return; }
      const mn = ev.target.closest('[data-menu]'); if (mn) { ev.stopPropagation(); if (est.sel.indexOf(mn.dataset.menu) < 0) est.sel = [mn.dataset.menu]; await menuItem(item(mn.dataset.menu)); return; }
      const b = ev.target.closest('[data-a]');
      if (b) { await acao(b.dataset.a); return; }
      const it = ev.target.closest('.n-item');
      if (it) {
        const id = it.dataset.id;
        if (ev.ctrlKey || ev.metaKey) { const i = est.sel.indexOf(id); if (i >= 0) est.sel.splice(i, 1); else est.sel.push(id); }
        else if (ev.shiftKey && est.ultimoClique) { const ids = listaAtual().map(function (x) { return x.id; }); const a = ids.indexOf(est.ultimoClique), z = ids.indexOf(id); est.sel = ids.slice(Math.min(a, z), Math.max(a, z) + 1); }
        else est.sel = [id];
        est.ultimoClique = id; marcarSelecao(el); return;
      }
      if (est.sel.length && !ev.target.closest('.n-selbar')) { est.sel = []; marcarSelecao(el); }
    };
    el.ondblclick = function (ev) { const it = ev.target.closest('.n-item'); if (!it) return; const x = item(it.dataset.id); if (x.lixeira) return; if (x.tipo === 'pasta') abrirPasta(x.id); else visualizar(x); };
    el.onkeydown = function (ev) {
      const it = ev.target.closest && ev.target.closest('.n-item'); if (!it) return; const x = item(it.dataset.id);
      if (ev.key === 'Enter') { if (x.tipo === 'pasta') abrirPasta(x.id); else visualizar(x); }
      if (ev.key === 'Delete') { est.sel = [x.id]; acao('lixeira'); }
      if (ev.key === 'F2') { ev.preventDefault(); renomear(x); }
    };
    // arrastar itens para pastas
    let arr = null;
    el.querySelectorAll('.n-item[draggable]').forEach(function (n) { n.addEventListener('dragstart', function (ev) { arr = est.sel.indexOf(n.dataset.id) >= 0 ? est.sel.slice() : [n.dataset.id]; ev.dataTransfer.setData('text/plain', 'nuvem'); ev.dataTransfer.effectAllowed = 'move'; }); });
    el.querySelectorAll('[data-soltar-pasta]').forEach(function (p) {
      p.addEventListener('dragover', function (ev) { if (arr) { ev.preventDefault(); p.classList.add('alvo'); } });
      p.addEventListener('dragleave', function () { p.classList.remove('alvo'); });
      p.addEventListener('drop', function (ev) { if (!arr) return; ev.preventDefault(); ev.stopPropagation(); mover(arr, p.dataset.soltarPasta || null); arr = null; });
    });
    // soltar arquivos do computador
    zona.addEventListener('dragover', function (ev) { if (!arr && ev.dataTransfer && Array.prototype.indexOf.call(ev.dataTransfer.types, 'Files') >= 0) { ev.preventDefault(); zona.classList.add('soltando'); } });
    zona.addEventListener('dragleave', function (ev) { if (ev.target === zona) zona.classList.remove('soltando'); });
    zona.addEventListener('drop', async function (ev) {
      if (arr) return; ev.preventDefault(); zona.classList.remove('soltando');
      if (est.secao !== 'drive' || est.busca) { est.secao = 'drive'; est.busca = ''; }
      const arquivos = ev.dataTransfer.items && ev.dataTransfer.items.length && ev.dataTransfer.items[0].webkitGetAsEntry ? await lerEntradas(Array.prototype.slice.call(ev.dataTransfer.items)) : Array.prototype.slice.call(ev.dataTransfer.files);
      enviarArquivos(arquivos, est.pasta);
    });
  }

  function abrirPasta(id) { est.pasta = id; est.secao = 'drive'; est.busca = ''; est.sel = []; App.redesenhar(); }

  function mover(ids, destino) {
    let n = 0;
    ids.forEach(function (id) {
      const x = item(id); if (!x || x.id === destino) return;
      if (destino && caminho(destino).some(function (p) { return p.id === x.id; })) { aviso('Não dá para mover uma pasta para dentro dela mesma.', 'erro'); return; }
      x.pai = destino || null; tocar(x); n++;
    });
    salvar(); est.sel = []; if (n) aviso(n + ' item(ns) movido(s) para ' + (destino ? item(destino).nome : 'Meu Drive') + '.'); App.redesenhar();
  }

  async function escolherPasta(titulo) {
    const pastas = e().itens.filter(function (x) { return x.tipo === 'pasta' && !x.lixeira && est.sel.indexOf(x.id) < 0; });
    const nomeCompleto = function (p) { return ['Meu Drive'].concat(caminho(p.id).map(function (y) { return y.nome; })).join(' › '); };
    const f = await modal({ titulo: titulo, corpo: campo('Destino', '<select name="d"><option value="">Meu Drive</option>' + opcoes(pastas.map(function (p) { return { v: p.id, t: nomeCompleto(p) }; }).sort(function (a, b) { return a.t.localeCompare(b.t); }), est.pasta || '') + '</select>'), botao: 'Confirmar' });
    return f ? { destino: f.get('d') || null } : null;
  }

  async function copiar(ids, destino) {
    async function copiarItem(x, pai) {
      const n = Object.assign({}, x, { id: Dados.id('nv'), pai: pai, nome: pai === x.pai ? 'Cópia de ' + x.nome : x.nome, estrela: false, criadoEm: new Date().toISOString(), modificadoEm: new Date().toISOString() });
      if (x.tipo === 'arquivo') { const b = await Dados.lerArquivo(x.id); if (b) await Dados.guardarArquivo(n.id, b); }
      e().itens.push(n);
      if (x.tipo === 'pasta') for (const f of filhos(x.id)) await copiarItem(f, n.id);
    }
    for (const id of ids) await copiarItem(item(id), destino === undefined ? item(id).pai : destino);
    salvar(); aviso('Cópia criada.'); est.sel = []; App.redesenhar();
  }

  async function baixar(ids) {
    const arqs = []; ids.forEach(function (id) { const x = item(id); if (x.tipo === 'pasta') descendentes(x.id).filter(function (d) { return d.tipo === 'arquivo' && !d.lixeira; }).forEach(function (d) { arqs.push({ x: d, rel: caminho(d.id).slice(caminho(x.id).length - 1).map(function (p) { return p.nome; }).join('/') }); }); else arqs.push({ x: x, rel: x.nome }); });
    if (arqs.length === 1 && ids.length === 1 && item(ids[0]).tipo === 'arquivo') { const b = await Dados.lerArquivo(arqs[0].x.id); if (b) UI.baixar(arqs[0].x.nome, b); else aviso('Arquivo não está neste navegador.', 'erro'); return; }
    if (!arqs.length) { aviso('Nada para baixar.', 'erro'); return; }
    try {
      await carregarScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip');
      const zip = new JSZip();
      for (const a of arqs) { const b = await Dados.lerArquivo(a.x.id); if (b) zip.file(a.rel, b); }
      const blob = await zip.generateAsync({ type: 'blob' });
      UI.baixar((ids.length === 1 ? item(ids[0]).nome : 'drive-seven') + '.zip', blob);
    } catch (err) { aviso('Não consegui montar o .zip (' + err.message + '). Baixe os arquivos um a um.', 'erro'); }
  }

  function carregarScript(src, global) {
    if (self[global]) return Promise.resolve(self[global]);
    return new Promise(function (ok, erro) { const s = document.createElement('script'); s.src = src; s.onload = function () { ok(self[global]); }; s.onerror = function () { erro(new Error('falha ao carregar biblioteca')); }; document.head.appendChild(s); });
  }

  async function renomear(x) {
    const f = await modal({ titulo: 'Renomear', corpo: campo('Nome', '<input name="n" value="' + esc(x.nome) + '" required>'), botao: 'OK', aoAbrir: function (form) { const i = form.querySelector('input'); const p = x.nome.lastIndexOf('.'); i.focus(); i.setSelectionRange(0, x.tipo === 'arquivo' && p > 0 ? p : x.nome.length); } });
    if (f) { x.nome = f.get('n').trim() || x.nome; tocar(x); salvar(); App.redesenhar(); }
  }

  async function acao(a) {
    const sel = est.sel.slice();
    if (a === 'modo') { est.modo = est.modo === 'grade' ? 'lista' : 'grade'; App.redesenhar(); }
    if (a === 'dir') { est.dir = -est.dir; App.redesenhar(); }
    if (a === 'limpar-sel') { est.sel = []; marcarSelecao(document.getElementById('conteudo')); }
    if (a === 'upload') document.getElementById('n-up').click();
    if (a === 'menu-novo') {
      const f = await modal({ titulo: 'Novo', botao: false, corpo: '<div class="n-menu-novo"><button type="button" class="btn" data-n="pasta">📁 Nova pasta</button><button type="button" class="btn" data-n="upload">⬆ Upload de arquivo</button><button type="button" class="btn" data-n="upload-pasta">⬆ Upload de pasta</button><button type="button" class="btn" data-n="estrutura">🗂 Estrutura padrão de cliente</button><button type="button" class="btn" data-n="nota">📝 Arquivo de texto</button></div>', aoAbrir: function (form) { form.addEventListener('click', function (ev) { const b = ev.target.closest('[data-n]'); if (!b) return; form.closest('.modal-fundo').remove(); acao(b.dataset.n === 'pasta' ? 'nova-pasta' : b.dataset.n === 'upload-pasta' ? 'upload-pasta' : b.dataset.n === 'nota' ? 'nova-nota' : b.dataset.n); }); } });
      void f;
    }
    if (a === 'upload-pasta') document.getElementById('n-up-pasta').click();
    if (a === 'nova-pasta') {
      const f = await modal({ titulo: 'Nova pasta', corpo: campo('Nome', '<input name="n" value="Pasta sem título" required>') + '<div class="n-cores">' + Object.keys(CORES_PASTA).map(function (c, i) { return '<label><input type="radio" name="cor" value="' + c + '"' + (i === 0 ? ' checked' : '') + '><span style="background:' + CORES_PASTA[c] + '"></span></label>'; }).join('') + '</div>', botao: 'Criar', aoAbrir: function (form) { form.querySelector('input').select(); } });
      if (f) { novaPasta(f.get('n').trim(), est.secao === 'drive' ? est.pasta : null, f.get('cor')); salvar(); App.redesenhar(); }
    }
    if (a === 'nova-nota') {
      const f = await modal({ titulo: 'Novo arquivo de texto', largo: true, corpo: campo('Nome', '<input name="n" value="Anotação.txt">') + '<textarea name="t" rows="12"></textarea>', botao: 'Salvar' });
      if (f) { const file = new File([f.get('t')], /\.\w+$/.test(f.get('n')) ? f.get('n') : f.get('n') + '.txt', { type: 'text/plain' }); enviarArquivos([file], est.pasta); }
    }
    if (a === 'estrutura') {
      const emp = Dados.e.empresas;
      const f = await modal({ titulo: 'Estrutura padrão de cliente', corpo: campo('Cliente', '<select name="c">' + opcoes(emp.map(function (x) { return { v: x.id, t: x.fantasia || x.razao }; }).concat([{ v: '', t: 'Outro (digite abaixo)' }]), Dados.e.empresaAtiva) + '</select>') + campo('Nome (se outro)', '<input name="o">') + '<p class="mini">Cria em Meu Drive › Clientes › [cliente]:</p><ul class="mini">' + ESTRUTURA_CLIENTE.map(function (p) { return '<li>' + esc(p.replace('/', ' › ')) + '</li>'; }).join('') + '</ul>', botao: 'Criar pastas' });
      if (f) {
        const x = emp.find(function (y) { return y.id === f.get('c'); }); const nome = (x ? x.fantasia || x.razao : f.get('o').trim()) || 'Cliente';
        const base = garantirCaminho(['Clientes', nome], null); ESTRUTURA_CLIENTE.forEach(function (p) { garantirCaminho(p.split('/'), base); });
        item(base).cor = 'dourado'; salvar(); abrirPasta(base); aviso('Estrutura criada para ' + nome + '.');
      }
    }
    if (a === 'esvaziar') { const l = e().itens.filter(function (x) { return x.lixeira; }).map(function (x) { return x.id; }); if (l.length && await confirmar('Esvaziar lixeira', 'Excluir para sempre os ' + l.length + ' itens da lixeira?', 'Esvaziar')) apagar(l); return; }
    if (!sel.length) return;
    if (a === 'baixar') baixar(sel);
    if (a === 'mover') { const r = await escolherPasta('Mover ' + sel.length + ' item(ns) para'); if (r) mover(sel, r.destino); }
    if (a === 'copiar') { const r = await escolherPasta('Fazer cópia em'); if (r) copiar(sel, r.destino); }
    if (a === 'estrela') { const todos = sel.every(function (id) { return item(id).estrela; }); sel.forEach(function (id) { item(id).estrela = !todos; }); salvar(); App.redesenhar(); }
    if (a === 'lixeira') { sel.forEach(function (id) { const x = item(id); x.lixeira = true; x.excluidoEm = new Date().toISOString(); descendentes(id).forEach(function (d) { d.lixeira = true; }); }); est.sel = []; salvar(); aviso(sel.length + ' item(ns) movido(s) para a lixeira.'); App.redesenhar(); }
    if (a === 'restaurar') { sel.forEach(function (id) { const x = item(id); x.lixeira = false; descendentes(id).forEach(function (d) { d.lixeira = false; }); if (x.pai && (!item(x.pai) || item(x.pai).lixeira)) x.pai = null; }); est.sel = []; salvar(); App.redesenhar(); }
    if (a === 'excluir-de-vez') { if (await confirmar('Excluir para sempre', 'Excluir ' + sel.length + ' item(ns) para sempre? Não dá para desfazer.', 'Excluir')) apagar(sel); }
  }

  async function apagar(ids) {
    const todos = new Set(); ids.forEach(function (id) { todos.add(id); descendentes(id).forEach(function (d) { todos.add(d.id); }); });
    for (const id of todos) { const x = item(id); if (x && x.tipo === 'arquivo') await Dados.apagarArquivo(id); }
    e().itens = e().itens.filter(function (x) { return !todos.has(x.id); });
    est.sel = []; salvar(); App.redesenhar();
  }

  async function menuItem(x) {
    const lixo = x.lixeira;
    const opcoesMenu = lixo ? [['restaurar', 'Restaurar'], ['excluir-de-vez', 'Excluir para sempre']] :
      [['abrir', x.tipo === 'pasta' ? 'Abrir' : 'Visualizar'], ['baixar', 'Fazer download'], ['renomear', 'Renomear'], ['copiar', 'Fazer uma cópia'], ['mover', 'Mover para…'], ['estrela', x.estrela ? 'Remover estrela' : 'Adicionar estrela'], x.tipo === 'pasta' ? ['cor', 'Cor da pasta'] : null, ['detalhes', 'Detalhes'],
        x.tipo === 'arquivo' && Telas.leitor && /pdf|epub|text|html|markdown/.test((x.mime || '') + x.nome) ? ['leitor', 'Abrir no Seven Leitor'] : null,
        x.tipo === 'arquivo' && Telas.musicas && /^audio\//.test(x.mime || '') ? ['musica', 'Adicionar ao Seven Música'] : null,
        x.tipo === 'arquivo' && Telas.cadernos && /pdf|text|markdown|html/.test((x.mime || '') + x.nome) ? ['caderno', 'Adicionar ao Seven Cadernos'] : null,
        ['lixeira', 'Mover para a lixeira']].filter(Boolean);
    const f = await modal({ titulo: x.nome, botao: false, corpo: '<div class="n-menu">' + opcoesMenu.map(function (o) { return '<button type="button" class="btn ' + (o[0] === 'lixeira' || o[0] === 'excluir-de-vez' ? 'perigo' : '') + '" data-op="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>',
      aoAbrir: function (form) { form.addEventListener('click', async function (ev) { const b = ev.target.closest('[data-op]'); if (!b) return; form.closest('.modal-fundo').remove(); const op = b.dataset.op;
        if (op === 'abrir') { if (x.tipo === 'pasta') abrirPasta(x.id); else visualizar(x); }
        else if (op === 'renomear') renomear(x);
        else if (op === 'cor') { const r = await modal({ titulo: 'Cor da pasta', corpo: '<div class="n-cores">' + Object.keys(CORES_PASTA).map(function (c) { return '<label><input type="radio" name="cor" value="' + c + '"' + (x.cor === c ? ' checked' : '') + '><span style="background:' + CORES_PASTA[c] + '"></span></label>'; }).join('') + '</div>' }); if (r) { x.cor = r.get('cor'); salvar(); App.redesenhar(); } }
        else if (op === 'detalhes') detalhes(x);
        else if (op === 'leitor') Telas.leitor.adicionarDaNuvem(x);
        else if (op === 'musica') Telas.musicas.adicionarDaNuvem(x);
        else if (op === 'caderno') Telas.cadernos.adicionarDaNuvem(x);
        else { est.sel = [x.id]; acao(op); }
      }); } });
    void f;
  }

  async function detalhes(x) {
    const f = await modal({ titulo: 'Detalhes', corpo: '<dl class="n-detalhes"><dt>Tipo</dt><dd>' + (x.tipo === 'pasta' ? 'Pasta' : esc(x.mime || 'Arquivo')) + '</dd><dt>Tamanho</dt><dd>' + fmtTam(x.tipo === 'pasta' ? tamanhoPasta(x.id) : x.tamanho) + (x.tipo === 'pasta' ? ' · ' + descendentes(x.id).length + ' item(ns)' : '') + '</dd><dt>Local</dt><dd>' + esc(['Meu Drive'].concat(caminho(x.pai).map(function (p) { return p.nome; })).join(' › ')) + '</dd><dt>Criado</dt><dd>' + dataHora(x.criadoEm) + '</dd><dt>Modificado</dt><dd>' + dataHora(x.modificadoEm) + '</dd></dl>' + campo('Descrição', '<textarea name="d" rows="3">' + esc(x.descricao || '') + '</textarea>') });
    if (f) { x.descricao = f.get('d'); salvar(); }
  }

  async function visualizar(x) {
    const b = await Dados.lerArquivo(x.id);
    if (!b) { aviso('Arquivo não está neste navegador.', 'erro'); return; }
    x.acessadoEm = new Date().toISOString(); salvar();
    const u = URL.createObjectURL(b); const m = x.mime || b.type || '';
    const irmaos = filhos(x.pai).filter(function (y) { return y.tipo === 'arquivo'; }); const i = irmaos.indexOf(x);
    let corpo;
    if (/^image\//.test(m)) corpo = '<img src="' + u + '" alt="' + esc(x.nome) + '">';
    else if (/pdf/.test(m)) corpo = '<iframe src="' + u + '" title="' + esc(x.nome) + '"></iframe>';
    else if (/^video\//.test(m)) corpo = '<video src="' + u + '" controls autoplay></video>';
    else if (/^audio\//.test(m)) corpo = '<audio src="' + u + '" controls autoplay></audio>';
    else if (/^text\/|json|xml|csv|markdown/.test(m) || /\.(txt|md|csv|json|xml|html?)$/i.test(x.nome)) corpo = '<pre class="n-texto">' + esc((await b.text()).slice(0, 500000)) + '</pre>';
    else corpo = '<div class="vazio"><h3>Sem visualização para este tipo</h3><p>' + esc(x.nome) + ' · ' + fmtTam(x.tamanho) + '</p></div>';
    const fundo = document.createElement('div'); fundo.className = 'n-visor';
    fundo.innerHTML = '<header><span>' + icone(x) + ' <b>' + esc(x.nome) + '</b></span><span class="kespaco"></span><button class="btn mini" data-v="baixar">Baixar</button><button class="icone" data-v="fechar" aria-label="Fechar">×</button></header><div class="n-visor-corpo">' + (i > 0 ? '<button class="n-nav ant" data-v="ant" aria-label="Anterior">‹</button>' : '') + corpo + (i < irmaos.length - 1 ? '<button class="n-nav prox" data-v="prox" aria-label="Próximo">›</button>' : '') + '</div>';
    document.body.appendChild(fundo);
    const fechar = function () { fundo.remove(); URL.revokeObjectURL(u); document.removeEventListener('keydown', tecla); };
    const tecla = function (ev) { if (ev.key === 'Escape') fechar(); if (ev.key === 'ArrowRight' && i < irmaos.length - 1) { fechar(); visualizar(irmaos[i + 1]); } if (ev.key === 'ArrowLeft' && i > 0) { fechar(); visualizar(irmaos[i - 1]); } };
    document.addEventListener('keydown', tecla);
    fundo.addEventListener('click', function (ev) { const v = ev.target.closest('[data-v]'); if (!v) { if (ev.target === fundo || ev.target.classList.contains('n-visor-corpo')) fechar(); return; } if (v.dataset.v === 'fechar') fechar(); if (v.dataset.v === 'baixar') UI.baixar(x.nome, b); if (v.dataset.v === 'prox') { fechar(); visualizar(irmaos[i + 1]); } if (v.dataset.v === 'ant') { fechar(); visualizar(irmaos[i - 1]); } });
  }

  Telas.nuvem = {
    titulo: 'Seven Arquivos',
    render: function (el) { render(el); },
    // usado por outros módulos para guardar arquivos na nuvem
    salvarArquivo: async function (arquivo, caminhoPastas) { const pai = garantirCaminho(caminhoPastas || [], null); await enviarArquivos([arquivo], pai); },
    itens: function () { return e().itens; },
    abrirPasta: function (id) { abrirPasta(id); location.hash = '#/nuvem'; }
  };
})();
