/* Seven Loja: vitrine estilo marketplace dos produtos e serviços da Seven, carrinho, pedidos e gestão do catálogo. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, opcoes, modal, confirmar, aviso, cnpj } = UI;
  const L = self.Loja;
  const est = { f: { cat: '', tipo: '', min: '', max: '', nota: '', ordem: 'relevancia' }, cupom: '', slide: 0 };
  const urls = {};
  const PAGAMENTOS = ['PIX', 'Boleto bancário', 'Cartão de crédito', 'Transferência', 'A combinar'];
  const CORES = { bpo: ['#050505', '#b68d40'], avulsos: ['#0a1929', '#3d6aa8'], documentacao: ['#1f4d36', '#4bce97'], juridico: ['#4a0d0d', '#b0413e'], inteligencia: ['#2b2140', '#9f8fef'], treinamentos: ['#3d2a0b', '#e0a43a'] };

  function e() {
    const d = Dados.e; d.loja = d.loja || {}; const l = d.loja;
    if (!l.produtos) l.produtos = L.CATALOGO.map(function (p, i) { return Object.assign({ preco: null, precoDe: null, ativo: true, destaque: i < 4, prazo: '', criadoEm: '2026-10-21' }, JSON.parse(JSON.stringify(p))); });
    ['cupons', 'carrinho', 'desejos', 'pedidos', 'avaliacoes', 'perguntas', 'vistos'].forEach(function (k) { l[k] = l[k] || []; });
    l.cfg = Object.assign({ nome: 'Seven Loja', whatsapp: '(61) 98347-2232', parcelasMax: 12, parcelaMin: 100, assinatura: 'Lucas Neves | Seven', pix: '' }, l.cfg || {});
    if (l.cfg.nome === 'Loja Seven' || l.cfg.nome === 'Seven Shop') l.cfg.nome = 'Seven Loja'; // nomes antigos da loja
    return l;
  }
  function salvar() { Dados.salvar(); }
  function prod(id) { return e().produtos.find(function (p) { return p.id === id; }); }
  function ativos() { return e().produtos.filter(function (p) { return p.ativo !== false; }); }
  function cat(id) { return L.CATEGORIAS.find(function (c) { return c.id === id; }) || { t: 'Outros', ic: '•' }; }
  function hoje() { return new Date().toISOString().slice(0, 10); }
  function notas() { return L.avaliacoes(e().avaliacoes); }
  function nCarrinho() { return e().carrinho.filter(function (i) { return !i.depois; }).reduce(function (s, i) { return s + i.qtd; }, 0); }
  function cupomAtual() { return est.cupom ? e().cupons.find(function (c) { return c.codigo.toUpperCase() === est.cupom.toUpperCase(); }) || { invalido: true } : null; }

  // ---------- peças visuais ----------
  function arte(p) {
    const c = CORES[p.cat] || ['#333', '#999']; const k = cat(p.cat);
    const palavras = p.t.split(' — ')[0].split(' '); const l1 = palavras.slice(0, 3).join(' '), l2 = palavras.slice(3, 6).join(' ');
    return '<svg class="lj-arte" viewBox="0 0 300 300" role="img" aria-label="' + esc(p.t) + '"><defs><linearGradient id="g' + esc(p.id) + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[1] + '"/></linearGradient></defs><rect width="300" height="300" rx="18" fill="url(#g' + esc(p.id) + ')"/><text x="150" y="128" text-anchor="middle" font-size="76" fill="#fff" opacity=".92">' + esc(k.ic) + '</text><text x="150" y="196" text-anchor="middle" font-size="19" font-weight="700" fill="#fff" font-family="Montserrat,Arial">' + esc(l1) + '</text><text x="150" y="222" text-anchor="middle" font-size="19" font-weight="700" fill="#fff" font-family="Montserrat,Arial">' + esc(l2) + '</text><text x="150" y="272" text-anchor="middle" font-size="13" letter-spacing="3" fill="#fff" opacity=".75" font-family="Montserrat,Arial">SEVEN</text></svg>';
  }
  function imagem(p) { return p.img ? '<img class="lj-img" data-img="' + esc(p.img) + '" alt="' + esc(p.t) + '">' : arte(p); }
  async function hidratar(el) {
    for (const im of el.querySelectorAll('img[data-img]')) {
      const id = im.dataset.img;
      if (!urls[id]) { const b = await Dados.lerArquivo(id); if (b) urls[id] = URL.createObjectURL(b); }
      if (urls[id]) im.src = urls[id];
    }
  }
  function estrelas(media, n, mini) {
    if (!n) return '<span class="lj-sem-aval">' + (mini ? '' : 'Sem avaliações ainda') + '</span>';
    const cheias = Math.round(media);
    return '<span class="lj-estrelas" title="' + String(media).replace('.', ',') + ' de 5"><b>' + '★★★★★'.slice(0, cheias) + '</b><i>' + '★★★★★'.slice(cheias) + '</i></span> <span class="lj-n">' + n + '</span>';
  }
  function preco(p, grande) {
    if (p.preco == null) return '<div class="lj-preco consulta">Sob consulta</div>';
    const r = Math.floor(p.preco), c = Math.round((p.preco - r) * 100);
    const off = p.precoDe && p.precoDe > p.preco ? Math.round((1 - p.preco / p.precoDe) * 100) : 0;
    const n = L.parcelas(p.preco, e().cfg.parcelasMax, e().cfg.parcelaMin);
    return '<div class="lj-preco' + (grande ? ' grande' : '') + '">' + (off ? '<span class="lj-off">-' + off + '%</span> ' : '') + '<sup>R$</sup>' + r.toLocaleString('pt-BR') + '<sup>' + String(c).padStart(2, '0') + '</sup><span class="lj-un">/' + esc(p.unidade) + '</span></div>' +
      (off ? '<div class="lj-de">De: <s>' + L.moeda(p.precoDe) + '</s></div>' : '') + (n > 1 ? '<div class="lj-parc">em até ' + n + 'x de ' + L.moeda(p.preco / n) + ' sem juros</div>' : '');
  }
  function card(p, N) {
    const a = N[p.id] || {}; const desejo = e().desejos.indexOf(p.id) >= 0;
    return '<article class="lj-card" data-p="' + esc(p.id) + '"><a href="#/loja/p/' + encodeURIComponent(p.id) + '" class="lj-card-img">' + imagem(p) + '</a>' +
      '<button class="lj-coracao' + (desejo ? ' on' : '') + '" data-a="desejo" aria-label="' + (desejo ? 'Remover da' : 'Adicionar à') + ' lista de desejos" aria-pressed="' + desejo + '">♥</button>' +
      '<a href="#/loja/p/' + encodeURIComponent(p.id) + '" class="lj-card-t">' + esc(p.t) + '</a>' + estrelas(a.media, a.n, true) + preco(p) +
      (p.tipo === 'recorrente' ? '<div class="lj-selo">Assinatura mensal</div>' : '') +
      '<button class="btn mini primario lj-add" data-a="add">Adicionar ao carrinho</button></article>';
  }
  function trilho(titulo, lista, N, mais) {
    if (!lista.length) return '';
    return '<section class="lj-trilho"><header><h3>' + esc(titulo) + '</h3>' + (mais ? '<a href="' + mais + '">Ver mais</a>' : '') + '</header><div class="lj-trilho-l">' + lista.map(function (p) { return card(p, N); }).join('') + '</div></section>';
  }

  function topo(atual) {
    const emp = Dados.empresaAtiva(); const c = nCarrinho();
    return '<header class="lj-topo no-print"><a class="lj-logo" href="#/loja"><b>seven</b><span>loja</span></a>' +
      '<div class="lj-entrega"><small>Atender</small><b>' + esc(emp ? (emp.fantasia || emp.razao) : 'Catalão-GO') + '</b></div>' +
      '<form class="lj-busca" id="lj-busca" role="search"><select name="cat" aria-label="Categoria"><option value="">Todos</option>' + L.CATEGORIAS.map(function (k) { return '<option value="' + k.id + '"' + (est.f.cat === k.id ? ' selected' : '') + '>' + esc(k.t) + '</option>'; }).join('') + '</select><input name="q" list="lj-sug" autocomplete="off" placeholder="Pesquisar na Seven Loja" value="' + esc(atual || '') + '" aria-label="Pesquisar"><datalist id="lj-sug"></datalist><button aria-label="Buscar">⌕</button></form>' +
      '<nav class="lj-atalhos"><a href="#/loja/pedidos"><small>Devoluções</small><b>e Pedidos</b></a><a href="#/loja/desejos"><small>Sua</small><b>Lista</b></a><a href="#/loja/carrinho" class="lj-carrinho" aria-label="Carrinho com ' + c + ' itens"><span class="lj-cn">' + c + '</span>🛒<b>Carrinho</b></a></nav></header>' +
      '<nav class="lj-cats no-print"><a href="#/loja/busca/">☰ Todos</a>' + L.CATEGORIAS.map(function (k) { return '<a href="#/loja/busca/" data-cat="' + k.id + '">' + esc(k.t) + '</a>'; }).join('') + '<a href="#/loja/admin" class="lj-admin">⚙ Gerenciar loja</a></nav>';
  }

  function ligarTopo(el) {
    const f = el.querySelector('#lj-busca'); if (!f) return;
    const inp = f.querySelector('[name=q]');
    inp.oninput = function () { el.querySelector('#lj-sug').innerHTML = L.sugestoes(ativos(), inp.value).map(function (s) { return '<option value="' + esc(s) + '">'; }).join(''); };
    f.onsubmit = function (ev) { ev.preventDefault(); est.f.cat = f.querySelector('[name=cat]').value; location.hash = '#/loja/busca/' + encodeURIComponent(inp.value.trim()); };
    el.querySelectorAll('.lj-cats [data-cat]').forEach(function (a) { a.onclick = function () { est.f = { cat: a.dataset.cat, tipo: '', min: '', max: '', nota: '', ordem: 'relevancia' }; }; });
    const todos = el.querySelector('.lj-cats a:not([data-cat]):not(.lj-admin)'); if (todos) todos.onclick = function () { est.f.cat = ''; };
  }

  // ações comuns dos cards
  function acoesCards(el) {
    el.addEventListener('click', function (ev) {
      if (location.hash.indexOf('#/loja') !== 0) return;
      const b = ev.target.closest('[data-a=add],[data-a=desejo]'); if (!b) return;
      const c = b.closest('.lj-card[data-p]'); if (!c) return; ev.preventDefault();
      const id = c.dataset.p;
      if (b.dataset.a === 'add') { L.adicionar(e().carrinho, id, 1); salvar(); aviso('Adicionado ao carrinho.'); const n = el.querySelector('.lj-cn'); if (n) n.textContent = nCarrinho(); }
      if (b.dataset.a === 'desejo') { const d = e().desejos; const i = d.indexOf(id); if (i >= 0) d.splice(i, 1); else d.push(id); salvar(); b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', String(i < 0)); aviso(i < 0 ? 'Adicionado à sua lista.' : 'Removido da sua lista.'); }
    });
  }

  // ---------- início ----------
  const SLIDES = [
    { t: 'Seu departamento de licitações, do edital ao pagamento', s: 'BPO completo com atendimento presencial em Catalão-GO', l: '#/loja/p/bpo-completo', cat: 'bpo' },
    { t: 'Certidões e SICAF sempre em dia', s: 'Nenhuma licitação perdida por documento vencido', l: '#/loja/busca/certid', cat: 'documentacao' },
    { t: 'Descubra quem compra o que você vende', s: 'Estudo de mercado B2G com dados do PNCP', l: '#/loja/p/estudo-mercado', cat: 'inteligencia' }
  ];
  function telaInicio(el) {
    const N = notas(); const V = L.vendas(e().pedidos); const P = ativos();
    const sl = SLIDES[est.slide % SLIDES.length]; const cor = CORES[sl.cat];
    const maisPedidos = P.slice().sort(function (a, b) { return (V[b.id] || 0) - (V[a.id] || 0); }).filter(function (p) { return V[p.id]; }).slice(0, 8);
    const vistos = e().vistos.map(prod).filter(function (p) { return p && p.ativo !== false; }).slice(0, 8);
    const ofertas = P.filter(function (p) { return p.precoDe && p.preco != null && p.precoDe > p.preco; });
    el.innerHTML = topo() + '<div class="lj">' +
      '<section class="lj-hero" style="--c1:' + cor[0] + ';--c2:' + cor[1] + '"><button class="lj-seta" data-s="-1" aria-label="Anterior">‹</button><a href="' + sl.l + '"><h2>' + esc(sl.t) + '</h2><p>' + esc(sl.s) + '</p><span class="btn">Conhecer</span></a><button class="lj-seta d" data-s="1" aria-label="Próximo">›</button></section>' +
      '<div class="lj-grade-cat">' + L.CATEGORIAS.map(function (k) {
        const ps = P.filter(function (p) { return p.cat === k.id; }).slice(0, 4);
        return '<section class="lj-cat-card"><h3>' + esc(k.t) + '</h3><div class="lj-mini4">' + ps.map(function (p) { return '<a href="#/loja/p/' + encodeURIComponent(p.id) + '">' + imagem(p) + '<span>' + esc(p.t.split(' — ')[0]) + '</span></a>'; }).join('') + '</div><a class="lj-ver" href="#/loja/busca/" data-cat="' + k.id + '">Ver tudo em ' + esc(k.t) + '</a></section>';
      }).join('') + '</div>' +
      trilho('Destaques da Seven', P.filter(function (p) { return p.destaque; }), N) +
      trilho('Ofertas', ofertas, N) +
      trilho('Mais pedidos', maisPedidos, N) +
      trilho('Vistos recentemente', vistos, N) +
      '<p class="lj-rodape">Atendimento: seg a sex 09h às 18h e sábado até 12h · (61) 98347-2232 · Catalão-GO e Brasília-DF</p></div>';
    el.querySelectorAll('.lj-seta').forEach(function (b) { b.onclick = function () { est.slide = (est.slide + SLIDES.length + Number(b.dataset.s)) % SLIDES.length; App.redesenhar(); }; });
    el.querySelectorAll('.lj-ver[data-cat]').forEach(function (a) { a.onclick = function () { est.f = { cat: a.dataset.cat, tipo: '', min: '', max: '', nota: '', ordem: 'relevancia' }; }; });
  }

  // ---------- busca ----------
  function telaBusca(el, q) {
    const N = notas(); const f = est.f;
    const r = L.buscar(e().produtos, Object.assign({ q: q, notas: N, vendas: L.vendas(e().pedidos) }, f));
    el.innerHTML = topo(q) + '<div class="lj lj-busca-pg"><aside class="lj-filtros" id="lj-filtros"><h4>Categoria</h4>' +
      '<label class="check"><input type="radio" name="cat" value=""' + (!f.cat ? ' checked' : '') + '> Todas</label>' + L.CATEGORIAS.map(function (k) { return '<label class="check"><input type="radio" name="cat" value="' + k.id + '"' + (f.cat === k.id ? ' checked' : '') + '> ' + esc(k.t) + '</label>'; }).join('') +
      '<h4>Contratação</h4>' + [['', 'Todas'], ['recorrente', 'Assinatura mensal'], ['avulso', 'Serviço avulso']].map(function (x) { return '<label class="check"><input type="radio" name="tipo" value="' + x[0] + '"' + (f.tipo === x[0] ? ' checked' : '') + '> ' + x[1] + '</label>'; }).join('') +
      '<h4>Avaliação</h4>' + [['', 'Qualquer'], ['4', '★★★★ ou mais'], ['3', '★★★ ou mais']].map(function (x) { return '<label class="check"><input type="radio" name="nota" value="' + x[0] + '"' + (String(f.nota) === x[0] ? ' checked' : '') + '> ' + x[1] + '</label>'; }).join('') +
      '<h4>Preço</h4><div class="lj-faixa"><input name="min" type="number" min="0" placeholder="Mín" value="' + esc(f.min) + '" aria-label="Preço mínimo"><input name="max" type="number" min="0" placeholder="Máx" value="' + esc(f.max) + '" aria-label="Preço máximo"></div><p class="mini mudo">Itens sob consulta saem quando há faixa de preço.</p></aside>' +
      '<section class="lj-res"><div class="lj-res-cab"><p><b>' + r.length + '</b> resultado(s)' + (q ? ' para <b>"' + esc(q) + '"</b>' : '') + (f.cat ? ' em ' + esc(cat(f.cat).t) : '') + '</p><label>Classificar por: <select id="lj-ordem">' + opcoes([{ v: 'relevancia', t: 'Relevância' }, { v: 'menor', t: 'Preço: menor para maior' }, { v: 'maior', t: 'Preço: maior para menor' }, { v: 'avaliacao', t: 'Avaliação dos clientes' }, { v: 'vendidos', t: 'Mais pedidos' }, { v: 'novos', t: 'Novidades' }], f.ordem) + '</select></label></div>' +
      (r.length ? '<div class="lj-grade">' + r.map(function (p) { return card(p, N); }).join('') + '</div>' : UI.vazio('Nenhum resultado', 'Tente outras palavras ou limpe os filtros.', '<button class="btn" data-a="limpar">Limpar filtros</button>')) + '</section></div>';
    const fil = el.querySelector('#lj-filtros');
    fil.onchange = function (ev) { const t = ev.target; if (t.name) { f[t.name] = t.value; App.redesenhar(); } };
    el.querySelector('#lj-ordem').onchange = function () { f.ordem = this.value; App.redesenhar(); };
    const lp = el.querySelector('[data-a=limpar]'); if (lp) lp.onclick = function () { est.f = { cat: '', tipo: '', min: '', max: '', nota: '', ordem: 'relevancia' }; App.redesenhar(); };
  }

  // ---------- produto ----------
  function telaProduto(el, id) {
    const p = prod(id);
    if (!p) { el.innerHTML = topo() + UI.vazio('Produto não encontrado', 'Ele pode ter sido removido do catálogo.', '<a class="btn" href="#/loja">Voltar à loja</a>'); return; }
    const l = e(); l.vistos = [id].concat(l.vistos.filter(function (x) { return x !== id; })).slice(0, 12); salvar();
    const N = notas(); const a = N[id] || { n: 0, dist: [0, 0, 0, 0, 0] };
    const juntos = L.compradosJuntos(l.pedidos, id, 2).map(prod).filter(function (x) { return x && x.ativo !== false; });
    const avs = l.avaliacoes.filter(function (x) { return x.produto === id; }).sort(function (x, y) { return y.em.localeCompare(x.em); });
    const pqs = l.perguntas.filter(function (x) { return x.produto === id; });
    const desejo = l.desejos.indexOf(id) >= 0;
    el.innerHTML = topo() + '<div class="lj"><p class="migalhas"><a href="#/loja">Loja</a> › <a href="#/loja/busca/" data-cat="' + p.cat + '">' + esc(cat(p.cat).t) + '</a></p>' +
      '<div class="lj-prod" data-p="' + esc(p.id) + '"><div class="lj-prod-img">' + imagem(p) + '</div>' +
      '<div class="lj-prod-info"><h1>' + esc(p.t) + '</h1><p class="mini"><a href="#/loja">Seven — BPO de Licitações</a></p><a href="#lj-aval" class="lj-link-aval">' + estrelas(a.media, a.n) + '</a>' + (pqs.length ? ' · <a href="#lj-perg">' + pqs.length + ' pergunta(s)</a>' : '') + '<hr>' + preco(p, true) +
      '<h4>Sobre este item</h4><ul class="lj-bullets">' + (p.bullets || []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul><p>' + esc(p.desc || '') + '</p>' + (p.prazo ? '<p class="mini"><b>Prazo:</b> ' + esc(p.prazo) + '</p>' : '') + '</div>' +
      '<aside class="lj-compra">' + preco(p) + '<p class="lj-disp">' + (p.tipo === 'recorrente' ? 'Assinatura mensal · cancele quando quiser conforme contrato' : 'Serviço avulso') + '</p>' +
      '<label>Quantidade: <select id="lj-qtd">' + opcoes(Array.from({ length: 10 }, function (_, i) { return String(i + 1); }), '1') + '</select></label>' +
      '<button class="btn primario lj-btn-add" data-a="add-qtd">Adicionar ao carrinho</button><button class="btn lj-btn-comprar" data-a="comprar">Comprar agora</button>' +
      '<button class="btn fantasma" data-a="desejo" aria-pressed="' + desejo + '">' + (desejo ? '♥ Na sua lista' : '♡ Adicionar à lista') + '</button>' +
      '<p class="mini mudo">Vendido e executado por Seven. Atendimento seg a sex 09h–18h, sáb até 12h.</p></aside></div>' +
      (juntos.length ? '<section class="cartao lj-juntos"><h3>Comprados juntos com frequência</h3><div class="lj-juntos-l">' + [p].concat(juntos).map(function (x, i) { return (i ? '<span class="lj-mais">+</span>' : '') + '<a href="#/loja/p/' + encodeURIComponent(x.id) + '">' + imagem(x) + '<small>' + esc(x.t.split(' — ')[0]) + '</small></a>'; }).join('') +
        '<div><p>Total: <b>' + L.moeda([p].concat(juntos).reduce(function (s, x) { return x.preco == null ? s : s + x.preco; }, 0)) + '</b>' + ([p].concat(juntos).some(function (x) { return x.preco == null; }) ? ' + itens sob consulta' : '') + '</p><button class="btn primario" data-a="juntos">Adicionar os ' + (juntos.length + 1) + ' ao carrinho</button></div></div></section>' : '') +
      trilho('Clientes também viram', L.recomendados(l.produtos, l.pedidos, id, 6), N) +
      '<section class="cartao" id="lj-perg"><h3>Perguntas e respostas</h3>' + (pqs.length ? pqs.map(function (q) { return '<div class="lj-qa"><p><b>Pergunta:</b> ' + esc(q.pergunta) + '</p><p>' + (q.resposta ? '<b>Resposta:</b> ' + esc(q.resposta) : '<span class="mudo">Aguardando resposta da Seven</span>') + '</p></div>'; }).join('') : '<p class="mudo">Nenhuma pergunta ainda.</p>') +
      '<form class="lj-perguntar" id="lj-perguntar"><input name="q" required placeholder="Tem uma dúvida? Pergunte aqui" aria-label="Pergunta"><button class="btn">Perguntar</button></form></section>' +
      '<section class="cartao lj-aval" id="lj-aval"><div class="lj-aval-res"><h3>Avaliações de clientes</h3>' + estrelas(a.media, a.n) + (a.n ? '<p>' + String(a.media).replace('.', ',') + ' de 5</p>' + [5, 4, 3, 2, 1].map(function (k) { const pc = Math.round(a.dist[k - 1] / a.n * 100); return '<div class="lj-dist"><span>' + k + ' estrela' + (k > 1 ? 's' : '') + '</span><i><b style="width:' + pc + '%"></b></i><span>' + pc + '%</span></div>'; }).join('') : '') +
      '<button class="btn" data-a="avaliar">Registrar avaliação de cliente</button><p class="mini mudo">Só registre avaliações reais, com autorização do cliente.</p></div>' +
      '<div class="lj-aval-l">' + (avs.length ? avs.map(function (v) { return '<article><p><b>' + esc(v.autor) + '</b>' + (v.empresa ? ' · ' + esc(v.empresa) : '') + '</p>' + estrelas(v.nota, 1, true).replace(/<span class="lj-n">1<\/span>/, '') + ' <b>' + esc(v.titulo || '') + '</b><p class="mini mudo">Avaliado em ' + v.em.slice(0, 10).split('-').reverse().join('/') + (v.verificada ? ' · <span class="lj-verif">Contratação verificada</span>' : '') + '</p><p>' + esc(v.texto) + '</p></article>'; }).join('') : '<p class="mudo">Ainda não há avaliações deste item.</p>') + '</div></section></div>';
    hidratar(el);
    el.querySelectorAll('.migalhas [data-cat]').forEach(function (x) { x.onclick = function () { est.f.cat = x.dataset.cat; }; });
    el.querySelector('#lj-perguntar').onsubmit = function (ev) { ev.preventDefault(); const t = new FormData(ev.target).get('q').trim(); if (!t) return; l.perguntas.push({ id: Dados.id('ljq'), produto: id, pergunta: t, em: new Date().toISOString(), resposta: '' }); salvar(); aviso('Pergunta registrada. Responda em Gerenciar loja.'); App.redesenhar(); };
    el.querySelector('.lj-prod').addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'add-qtd' || b.dataset.a === 'comprar') { L.adicionar(l.carrinho, id, Number(el.querySelector('#lj-qtd').value)); salvar(); if (b.dataset.a === 'comprar') location.hash = '#/loja/checkout'; else { aviso('Adicionado ao carrinho.'); el.querySelector('.lj-cn').textContent = nCarrinho(); } }
      if (b.dataset.a === 'desejo' && !b.closest('.lj-card')) { ev.stopPropagation(); const i = l.desejos.indexOf(id); if (i >= 0) l.desejos.splice(i, 1); else l.desejos.push(id); salvar(); App.redesenhar(); }
    }, true);
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'juntos') { [p].concat(juntos).forEach(function (x) { L.adicionar(l.carrinho, x.id, 1); }); salvar(); location.hash = '#/loja/carrinho'; }
      if (b.dataset.a === 'avaliar') {
        const r = await modal({ titulo: 'Avaliação de cliente', corpo: '<div class="linha">' + campo('Nome de quem avaliou *', '<input name="autor" required>') + campo('Empresa', '<input name="empresa">') + '</div>' + campo('Nota *', '<select name="nota">' + opcoes([{ v: '5', t: '★★★★★ Excelente' }, { v: '4', t: '★★★★ Muito bom' }, { v: '3', t: '★★★ Bom' }, { v: '2', t: '★★ Regular' }, { v: '1', t: '★ Ruim' }], '5') + '</select>') + campo('Título', '<input name="titulo">') + campo('Comentário *', '<textarea name="texto" rows="4" required></textarea>') +
          '<label class="check"><input type="checkbox" name="verificada"> Cliente contratou este serviço</label><label class="check"><input type="checkbox" name="consentimento" required> O cliente autorizou publicar esta avaliação</label>', botao: 'Publicar' });
        if (!r) return;
        l.avaliacoes.push({ id: Dados.id('lja'), produto: id, autor: r.get('autor').trim(), empresa: r.get('empresa').trim(), nota: Number(r.get('nota')), titulo: r.get('titulo').trim(), texto: r.get('texto').trim(), verificada: !!r.get('verificada'), em: new Date().toISOString() }); salvar(); App.redesenhar();
      }
    };
  }

  // ---------- carrinho ----------
  function telaCarrinho(el) {
    const l = e(); const cup = cupomAtual();
    const T = L.totais(l.carrinho, l.produtos, cup && !cup.invalido ? cup : null, hoje());
    const depois = l.carrinho.filter(function (i) { return i.depois; }).map(function (i) { return prod(i.id); }).filter(Boolean);
    el.innerHTML = topo() + '<div class="lj lj-carr"><section class="cartao lj-carr-l"><h2>Carrinho de compras</h2>' +
      (T.linhas.length ? T.linhas.map(function (x) {
        return '<div class="lj-linha" data-id="' + esc(x.p.id) + '"><a href="#/loja/p/' + encodeURIComponent(x.p.id) + '">' + imagem(x.p) + '</a><div><a href="#/loja/p/' + encodeURIComponent(x.p.id) + '"><b>' + esc(x.p.t) + '</b></a><p class="mini ok">' + (x.p.tipo === 'recorrente' ? 'Assinatura mensal' : 'Serviço avulso') + ' · por ' + esc(x.p.unidade) + '</p>' +
          '<div class="lj-linha-ac"><label>Qtd: <select data-qtd>' + opcoes(Array.from({ length: Math.max(10, x.qtd) }, function (_, i) { return String(i + 1); }), String(x.qtd)) + '</select></label><button class="btn mini fantasma" data-a="remover">Excluir</button><button class="btn mini fantasma" data-a="depois">Salvar para mais tarde</button></div></div><b class="lj-linha-v">' + L.moeda(x.total) + '</b></div>';
      }).join('') + '<p class="lj-sub">Subtotal (' + T.itens + ' ' + (T.itens === 1 ? 'item' : 'itens') + '): <b>' + L.moeda(T.subtotal) + '</b></p>' : UI.vazio('Seu carrinho está vazio', 'Veja os serviços da Seven e adicione o que o cliente precisa.', '<a class="btn primario" href="#/loja">Ir para a loja</a>')) + '</section>' +
      (T.linhas.length ? '<aside class="cartao lj-resumo"><p>Subtotal: <b>' + L.moeda(T.subtotal) + '</b></p>' + (T.consulta ? '<p class="mini alerta">' + T.consulta + ' item(ns) sob consulta: o valor é combinado no pedido.</p>' : '') +
        '<form id="lj-cupom" class="lj-cupom"><input name="c" placeholder="Cupom de desconto" value="' + esc(est.cupom) + '" aria-label="Cupom"><button class="btn mini">Aplicar</button></form>' +
        (cup ? (cup.invalido ? '<p class="mini perigo">Cupom não encontrado.</p>' : T.erroCupom ? '<p class="mini perigo">' + esc(T.erroCupom) + '</p>' : '<p class="mini ok">Cupom ' + esc(cup.codigo) + ': -' + L.moeda(T.desconto) + '</p>') : '') +
        '<p class="lj-total">Total: <b>' + L.moeda(T.total) + '</b></p><a class="btn primario lj-fechar" href="#/loja/checkout">Fechar pedido</a></aside>' : '') + '</div>' +
      (depois.length ? '<section class="cartao lj"><h3>Salvos para mais tarde (' + depois.length + ')</h3>' + depois.map(function (p) { return '<div class="lj-linha" data-id="' + esc(p.id) + '" data-depois="1">' + imagem(p) + '<div><b>' + esc(p.t) + '</b><div class="lj-linha-ac"><button class="btn mini" data-a="voltar">Mover para o carrinho</button><button class="btn mini fantasma" data-a="remover">Excluir</button></div></div><b class="lj-linha-v">' + L.moeda(p.preco) + '</b></div>'; }).join('') + '</section>' : '');
    hidratar(el);
    el.onchange = function (ev) { const s = ev.target.closest('[data-qtd]'); if (!s) return; l.carrinho = L.definirQtd(l.carrinho, s.closest('[data-id]').dataset.id, s.value); salvar(); App.redesenhar(); };
    el.onclick = function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return; const ln = b.closest('[data-id]'); if (!ln) return; const id = ln.dataset.id; const dep = !!ln.dataset.depois;
      if (b.dataset.a === 'remover') l.carrinho = l.carrinho.filter(function (i) { return !(i.id === id && !!i.depois === dep); });
      if (b.dataset.a === 'depois') { const it = l.carrinho.find(function (i) { return i.id === id && !i.depois; }); l.carrinho = l.carrinho.filter(function (i) { return !(i.id === id && i.depois); }); it.depois = true; }
      if (b.dataset.a === 'voltar') { l.carrinho = l.carrinho.filter(function (i) { return !(i.id === id && i.depois); }); L.adicionar(l.carrinho, id, 1); }
      salvar(); App.redesenhar();
    };
    const fc = el.querySelector('#lj-cupom'); if (fc) fc.onsubmit = function (ev) { ev.preventDefault(); est.cupom = new FormData(fc).get('c').trim(); App.redesenhar(); };
  }

  // ---------- fechar pedido ----------
  function clientes() {
    const r = [];
    (Dados.e.empresas || []).forEach(function (x) { r.push({ k: 'emp:' + x.id, nome: x.fantasia || x.razao, razao: x.razao, cnpj: x.cnpj, contato: x.contato || x.representante || '', telefone: x.telefone || '', email: x.email || '', cidade: (x.municipio ? x.municipio + '-' : '') + (x.uf || '') }); });
    ((Dados.e.comercial || {}).contas || []).forEach(function (c) { if (r.some(function (y) { return y.cnpj && y.cnpj === c.cnpj; })) return; const d = (c.contatos || [])[0] || {}; r.push({ k: 'cta:' + c.id, nome: c.fantasia || c.razao, razao: c.razao, cnpj: c.cnpj, contato: d.nome || '', telefone: d.whatsapp || d.telefone || c.telefone || '', email: d.email || c.email || '', cidade: (c.municipio ? c.municipio + '-' : '') + (c.uf || '') }); });
    return r;
  }
  function telaCheckout(el) {
    const l = e(); const cup = cupomAtual();
    const T = L.totais(l.carrinho, l.produtos, cup && !cup.invalido ? cup : null, hoje());
    if (!T.linhas.length) { location.hash = '#/loja/carrinho'; return; }
    const cs = clientes(); const emp = Dados.empresaAtiva();
    const sel = emp ? 'emp:' + emp.id : '';
    const n = L.parcelas(T.total, l.cfg.parcelasMax, l.cfg.parcelaMin);
    el.innerHTML = topo() + '<div class="lj lj-carr"><form class="cartao lj-checkout" id="lj-co"><h2>Fechar pedido</h2>' +
      '<h3>1. Cliente</h3>' + campo('Cliente', '<select name="cli"><option value="">Novo cliente…</option>' + cs.map(function (c) { return '<option value="' + esc(c.k) + '"' + (c.k === sel ? ' selected' : '') + '>' + esc(c.nome) + (c.cnpj ? ' · ' + esc(cnpj(c.cnpj)) : '') + '</option>'; }).join('') + '</select>') +
      '<div class="linha">' + campo('Razão social / nome *', '<input name="razao" required>') + campo('CNPJ', '<input name="cnpj">') + '</div>' +
      '<div class="linha">' + campo('Contato', '<input name="contato">') + campo('WhatsApp / telefone', '<input name="telefone">') + campo('E-mail', '<input name="email" type="email">') + '</div>' + campo('Cidade-UF', '<input name="cidade">') +
      '<h3>2. Pagamento</h3><div class="lj-pag">' + PAGAMENTOS.map(function (p, i) { return '<label class="check"><input type="radio" name="pagamento" value="' + p + '"' + (i === 0 ? ' checked' : '') + '> ' + p + (p === 'Cartão de crédito' && n > 1 ? ' (até ' + n + 'x sem juros)' : '') + '</label>'; }).join('') + '</div><p class="mini mudo">A cobrança é feita pela Seven depois da confirmação; a loja não processa pagamento.</p>' +
      '<h3>3. Revisar itens</h3>' + T.linhas.map(function (x) { return '<p class="lj-rev">' + x.qtd + 'x ' + esc(x.p.t) + ' <b>' + L.moeda(x.total) + '</b></p>'; }).join('') + campo('Observações', '<textarea name="obs" rows="2"></textarea>') + '</form>' +
      '<aside class="cartao lj-resumo"><button class="btn primario lj-fechar" form="lj-co">Gerar pedido</button><p class="mini mudo">Gera o pedido no sistema. Nada é enviado ao cliente sem você revisar a mensagem.</p><hr><p>Itens: ' + L.moeda(T.subtotal) + '</p>' + (T.desconto ? '<p class="ok">Desconto: -' + L.moeda(T.desconto) + '</p>' : '') + (T.consulta ? '<p class="mini alerta">+ ' + T.consulta + ' sob consulta</p>' : '') + '<p class="lj-total">Total do pedido: <b>' + L.moeda(T.total) + '</b></p>' + (T.recorrente ? '<p class="mini">Sendo ' + L.moeda(T.recorrente) + ' recorrente por mês</p>' : '') + '</aside></div>';
    const f = el.querySelector('#lj-co');
    const preencher = function () { const c = cs.find(function (x) { return x.k === f.cli.value; }) || {}; ['razao', 'cnpj', 'contato', 'telefone', 'email', 'cidade'].forEach(function (k) { f[k].value = k === 'cnpj' && c.cnpj ? cnpj(c.cnpj) : (c[k] || ''); }); };
    f.cli.onchange = preencher; preencher();
    f.onsubmit = function (ev) {
      ev.preventDefault(); const d = new FormData(f);
      const o = { id: Dados.id('ljp'), numero: L.proximoNumero(l.pedidos, new Date().getFullYear()), criadoEm: new Date().toISOString(), status: 'novo', historico: [{ status: 'novo', em: new Date().toISOString() }],
        cliente: { ref: d.get('cli'), razao: d.get('razao').trim(), cnpj: String(d.get('cnpj')).replace(/\D/g, ''), contato: d.get('contato').trim(), telefone: d.get('telefone').trim(), email: d.get('email').trim(), cidade: d.get('cidade').trim() },
        itens: T.linhas.map(function (x) { return { id: x.p.id, t: x.p.t, unidade: x.p.unidade, tipo: x.p.tipo, qtd: x.qtd, preco: x.p.preco }; }),
        subtotal: T.subtotal, desconto: T.desconto, cupom: T.desconto && cup ? cup.codigo : '', total: T.total, consulta: T.consulta, recorrente: T.recorrente, pagamento: d.get('pagamento'), obs: d.get('obs').trim() };
      if (o.desconto && cup) cup.usos = (cup.usos || 0) + 1;
      l.pedidos.unshift(o); l.carrinho = l.carrinho.filter(function (i) { return i.depois; }); est.cupom = ''; salvar();
      location.hash = '#/loja/pedido/' + o.id;
    };
  }

  // ---------- pedidos ----------
  function linhaStatus(o) {
    if (o.status === 'cancelado') return '<p class="tag hb-st-vencido">Cancelado</p>';
    const i = L.STATUS.findIndex(function (s) { return s.id === o.status; });
    return '<ol class="lj-status">' + L.STATUS.map(function (s, k) { const h = (o.historico || []).find(function (x) { return x.status === s.id; }); return '<li class="' + (k <= i ? 'feito' : '') + (k === i ? ' atual' : '') + '"><b>' + esc(s.t) + '</b>' + (h ? '<small>' + new Date(h.em).toLocaleDateString('pt-BR') + '</small>' : '') + '</li>'; }).join('') + '</ol>';
  }
  function telaPedidos(el) {
    const l = e();
    el.innerHTML = topo() + '<div class="lj"><h2>Pedidos</h2>' + (l.pedidos.length ? l.pedidos.map(function (o) {
      return '<section class="cartao lj-ped"><header><div><small>PEDIDO</small><b>' + esc(o.numero) + '</b></div><div><small>FEITO EM</small><b>' + new Date(o.criadoEm).toLocaleDateString('pt-BR') + '</b></div><div><small>TOTAL</small><b>' + L.moeda(o.total) + (o.consulta ? ' +' : '') + '</b></div><div><small>CLIENTE</small><b>' + esc(o.cliente.razao) + '</b></div><a class="btn mini" href="#/loja/pedido/' + o.id + '">Detalhes do pedido</a></header>' + linhaStatus(o) + '<p class="mini">' + o.itens.map(function (i) { return i.qtd + 'x ' + esc(i.t.split(' — ')[0]); }).join(' · ') + '</p></section>';
    }).join('') : UI.vazio('Nenhum pedido ainda', 'Os pedidos fechados na loja aparecem aqui.', '<a class="btn primario" href="#/loja">Ir para a loja</a>')) + '</div>';
  }

  function telaPedido(el, id) {
    const l = e(); const o = l.pedidos.find(function (x) { return x.id === id; });
    if (!o) { el.innerHTML = topo() + UI.vazio('Pedido não encontrado', '', '<a class="btn" href="#/loja/pedidos">Ver pedidos</a>'); return; }
    const i = L.STATUS.findIndex(function (s) { return s.id === o.status; }); const prox = L.STATUS[i + 1];
    el.innerHTML = topo() + '<div class="lj"><p class="migalhas no-print"><a href="#/loja/pedidos">Pedidos</a> › ' + esc(o.numero) + '</p>' +
      '<section class="cartao lj-pedido"><header class="lj-ped-cab"><div><h2>Pedido nº ' + esc(o.numero) + '</h2><p class="mudo">' + new Date(o.criadoEm).toLocaleString('pt-BR') + ' · ' + esc(l.cfg.nome) + ' — Seven BPO de Licitações · (61) 98347-2232</p></div>' +
      '<div class="grupo-botoes no-print">' + (o.status !== 'cancelado' && prox ? '<button class="btn primario" data-a="avancar">Marcar: ' + esc(prox.t) + '</button>' : '') + '<button class="btn" data-a="whats">WhatsApp ao cliente</button><button class="btn" data-a="email">E-mail</button><button class="btn" data-a="imprimir">Imprimir</button></div></header>' +
      linhaStatus(o) +
      '<div class="lj-ped-grade"><div><h4>Cliente</h4><p><b>' + esc(o.cliente.razao) + '</b>' + (o.cliente.cnpj ? '<br>CNPJ ' + esc(cnpj(o.cliente.cnpj)) : '') + (o.cliente.contato ? '<br>' + esc(o.cliente.contato) : '') + (o.cliente.telefone ? '<br>' + esc(o.cliente.telefone) : '') + (o.cliente.email ? '<br>' + esc(o.cliente.email) : '') + (o.cliente.cidade ? '<br>' + esc(o.cliente.cidade) : '') + '</p></div><div><h4>Pagamento</h4><p>' + esc(o.pagamento) + '</p>' + (o.obs ? '<h4>Observações</h4><p>' + esc(o.obs) + '</p>' : '') + '</div></div>' +
      '<table class="tabela"><thead><tr><th>Item</th><th>Qtd</th><th>Unitário</th><th>Total</th></tr></thead><tbody>' + o.itens.map(function (x) { return '<tr><td>' + esc(x.t) + '<br><span class="mini mudo">por ' + esc(x.unidade) + (x.tipo === 'recorrente' ? ' · mensal' : '') + '</span></td><td>' + x.qtd + '</td><td>' + L.moeda(x.preco) + '</td><td>' + (x.preco == null ? 'sob consulta' : L.moeda(x.preco * x.qtd)) + '</td></tr>'; }).join('') + '</tbody><tfoot>' + (o.desconto ? '<tr><td colspan="3">Desconto ' + esc(o.cupom || '') + '</td><td>-' + L.moeda(o.desconto) + '</td></tr>' : '') + '<tr><td colspan="3"><b>Total</b>' + (o.consulta ? ' (+ ' + o.consulta + ' item(ns) sob consulta)' : '') + '</td><td><b>' + L.moeda(o.total) + '</b></td></tr></tfoot></table>' +
      '<div class="grupo-botoes no-print lj-integr">' + '<button class="btn fantasma" data-a="crm"' + (o.negocioId ? ' disabled' : '') + '>' + (o.negocioId ? '✓ Negócio no Seven Comercial' : 'Criar negócio no Seven Comercial') + '</button>' + '<button class="btn fantasma" data-a="financas"' + (o.lancado || !o.total ? ' disabled' : '') + '>' + (o.lancado ? '✓ Lançado em Finanças' : 'Lançar receita em Finanças') + '</button>' + (o.status !== 'cancelado' && o.status !== 'concluido' ? '<button class="btn fantasma perigo" data-a="cancelar">Cancelar pedido</button>' : '') + '</div></section></div>';
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'avancar' && prox) { o.status = prox.id; o.historico.push({ status: prox.id, em: new Date().toISOString() }); }
      if (a === 'cancelar' && await confirmar('Cancelar pedido', 'Cancelar o pedido <b>' + esc(o.numero) + '</b>?', 'Cancelar pedido')) { o.status = 'cancelado'; o.historico.push({ status: 'cancelado', em: new Date().toISOString() }); }
      if (a === 'imprimir') { window.print(); return; }
      if (a === 'whats' || a === 'email') {
        const r = await modal({ titulo: 'Revise antes de enviar', corpo: '<p class="mini mudo">O sistema só abre o ' + (a === 'whats' ? 'WhatsApp' : 'e-mail') + '; quem envia é você.</p>' + campo('Mensagem', '<textarea name="m" rows="14">' + esc(L.mensagemPedido(o, { assinatura: l.cfg.assinatura })) + '</textarea>'), botao: a === 'whats' ? 'Abrir WhatsApp' : 'Abrir e-mail', largo: true });
        if (!r) return;
        const m = r.get('m');
        if (a === 'whats') { const t = L.telefoneWhats(o.cliente.telefone); window.open('https://wa.me/' + t + '?text=' + encodeURIComponent(m), '_blank', 'noopener'); if (!t) aviso('Cliente sem WhatsApp: escolha o contato no WhatsApp.'); }
        else window.open('mailto:' + encodeURIComponent(o.cliente.email || '') + '?subject=' + encodeURIComponent('Pedido ' + o.numero + ' — Seven') + '&body=' + encodeURIComponent(m));
        return;
      }
      if (a === 'crm') {
        const d = Dados.e; d.comercial = d.comercial || {}; const c = d.comercial; c.contas = c.contas || []; c.negocios = c.negocios || [];
        let conta = c.contas.find(function (x) { return (o.cliente.cnpj && x.cnpj === o.cliente.cnpj) || ('cta:' + x.id) === o.cliente.ref; });
        if (!conta) { conta = { id: Dados.id('cta'), razao: o.cliente.razao, fantasia: '', cnpj: o.cliente.cnpj, municipio: (o.cliente.cidade.split('-')[0] || '').trim(), uf: (o.cliente.cidade.split('-')[1] || '').trim(), origem: 'Seven Loja', contatos: o.cliente.contato ? [{ id: Dados.id('ct'), nome: o.cliente.contato, papel: 'Decisor', whatsapp: o.cliente.telefone, telefone: '', email: o.cliente.email }] : [], timeline: [], criadoEm: new Date().toISOString() }; c.contas.unshift(conta); }
        const neg = { id: Dados.id('neg'), contaId: conta.id, titulo: 'Pedido ' + o.numero + ' · ' + o.itens.map(function (x) { return x.t.split(' — ')[0]; }).join(', '), etapa: o.status === 'novo' ? 'proposta' : 'ganho', mensalidade: o.recorrente || null, meses: 12, implantacao: o.total - (o.recorrente || 0) || null, criadoEm: hoje(), atualizadoEm: hoje(), historicoEtapas: [], origem: 'loja:' + o.id };
        c.negocios.push(neg); conta.timeline = conta.timeline || []; conta.timeline.unshift({ em: new Date().toISOString(), tipo: 'negocio', texto: 'Pedido ' + o.numero + ' feito na Seven Loja.' });
        o.negocioId = neg.id; aviso('Negócio criado no Seven Comercial.');
      }
      if (a === 'financas' && Telas.financas && Telas.financas.lancar) { const perfil = Telas.financas.lancar([{ tipo: 'receita', descricao: 'Pedido ' + o.numero + ' — ' + o.cliente.razao, valor: o.total, data: hoje(), categoria: 'Serviços', origem: 'loja:' + o.id }]); o.lancado = true; aviso('Receita lançada em Finanças (' + perfil + ').'); }
      salvar(); App.redesenhar();
    };
  }

  // ---------- lista de desejos ----------
  function telaDesejos(el) {
    const N = notas(); const ps = e().desejos.map(prod).filter(Boolean);
    el.innerHTML = topo() + '<div class="lj"><h2>Sua lista</h2>' + (ps.length ? '<div class="lj-grade">' + ps.map(function (p) { return card(p, N); }).join('') + '</div>' : UI.vazio('Sua lista está vazia', 'Toque no ♥ dos produtos para guardar aqui.', '<a class="btn primario" href="#/loja">Ver produtos</a>')) + '</div>';
  }

  // ---------- gerenciar loja ----------
  async function editarProduto(p) {
    const novo = !p; p = p || { cat: 'avulsos', tipo: 'avulso', unidade: 'serviço', bullets: [], tags: [], ativo: true };
    const r = await modal({
      titulo: novo ? 'Novo produto ou serviço' : 'Editar: ' + p.t, largo: true,
      corpo: campo('Título *', '<input name="t" required value="' + esc(p.t || '') + '">') +
        '<div class="linha">' + campo('Categoria', '<select name="cat">' + opcoes(L.CATEGORIAS.map(function (k) { return { v: k.id, t: k.t }; }), p.cat) + '</select>') + campo('Contratação', '<select name="tipo">' + opcoes([{ v: 'avulso', t: 'Avulso' }, { v: 'recorrente', t: 'Assinatura mensal' }], p.tipo) + '</select>') + campo('Unidade', '<input name="unidade" value="' + esc(p.unidade || '') + '" placeholder="mês, edital, hora…">') + '</div>' +
        '<div class="linha">' + campo('Preço (R$)', '<input name="preco" inputmode="decimal" value="' + (p.preco == null ? '' : String(p.preco).replace('.', ',')) + '" placeholder="vazio = sob consulta">') + campo('Preço "de" (R$)', '<input name="precoDe" inputmode="decimal" value="' + (p.precoDe == null ? '' : String(p.precoDe).replace('.', ',')) + '" placeholder="para mostrar oferta">') + campo('Prazo', '<input name="prazo" value="' + esc(p.prazo || '') + '">') + '</div>' +
        campo('Destaques (um por linha)', '<textarea name="bullets" rows="4">' + esc((p.bullets || []).join('\n')) + '</textarea>') + campo('Descrição', '<textarea name="desc" rows="3">' + esc(p.desc || '') + '</textarea>') + campo('Palavras de busca (separadas por vírgula)', '<input name="tags" value="' + esc((p.tags || []).join(', ')) + '">') +
        '<label class="check"><input type="checkbox" name="destaque"' + (p.destaque ? ' checked' : '') + '> Mostrar em Destaques</label><label class="check"><input type="checkbox" name="ativo"' + (p.ativo !== false ? ' checked' : '') + '> Visível na loja</label>',
      validar: function (fd) { const n = function (k) { const v = String(fd.get(k)).trim(); return v === '' ? null : Nucleo.lerNumeroBR(v); }; if (fd.get('preco').trim() && !(n('preco') >= 0)) return 'Preço inválido.'; if (fd.get('precoDe').trim() && !(n('precoDe') >= 0)) return 'Preço "de" inválido.'; return ''; }
    });
    if (!r) return;
    const num = function (k) { const v = String(r.get(k)).trim(); return v === '' ? null : Nucleo.lerNumeroBR(v); };
    Object.assign(p, { t: r.get('t').trim(), cat: r.get('cat'), tipo: r.get('tipo'), unidade: r.get('unidade').trim() || 'serviço', preco: num('preco'), precoDe: num('precoDe'), prazo: r.get('prazo').trim(), bullets: r.get('bullets').split('\n').map(function (x) { return x.trim(); }).filter(Boolean), desc: r.get('desc').trim(), tags: r.get('tags').split(',').map(function (x) { return x.trim(); }).filter(Boolean), destaque: !!r.get('destaque'), ativo: !!r.get('ativo') });
    if (novo) { p.id = Dados.id('ljx'); p.criadoEm = hoje(); e().produtos.push(p); }
    salvar(); App.redesenhar();
  }

  function telaAdmin(el, aba) {
    const l = e(); aba = aba || 'catalogo';
    const pend = l.perguntas.filter(function (q) { return !q.resposta; }).length;
    let corpo = '';
    if (aba === 'catalogo') corpo = '<div class="barra-acoes"><p class="mudo">Preço em branco aparece como "sob consulta". Defina os valores da Seven aqui.</p><button class="btn primario" data-a="novo">+ Novo produto</button></div><div class="tabela-rolagem"><table class="tabela"><thead><tr><th></th><th>Produto</th><th>Categoria</th><th>Preço</th><th>Pedidos</th><th>Visível</th><th></th></tr></thead><tbody>' + (function () { const V = L.vendas(l.pedidos); return l.produtos.map(function (p) { return '<tr data-id="' + esc(p.id) + '"><td class="lj-adm-img">' + imagem(p) + '</td><td><b>' + esc(p.t) + '</b><br><span class="mini mudo">por ' + esc(p.unidade) + (p.destaque ? ' · destaque' : '') + '</span></td><td>' + esc(cat(p.cat).t) + '</td><td>' + L.moeda(p.preco) + '</td><td>' + (V[p.id] || 0) + '</td><td>' + (p.ativo !== false ? 'Sim' : '<span class="mudo">Não</span>') + '</td><td class="acoes"><button class="btn mini fantasma" data-a="editar">Editar</button><button class="btn mini fantasma" data-a="foto">Imagem</button>' + (p.img ? '<button class="btn mini fantasma" data-a="semfoto">Usar arte</button>' : '') + '<button class="btn mini fantasma perigo" data-a="excluir" aria-label="Excluir">×</button></td></tr>'; }).join(''); })() + '</tbody></table></div>';
    if (aba === 'cupons') corpo = '<div class="barra-acoes"><p class="mudo">Cupons valem no carrinho. Percentual ou valor fixo, com pedido mínimo, validade e limite de usos.</p><button class="btn primario" data-a="cupom">+ Novo cupom</button></div>' + (l.cupons.length ? '<table class="tabela"><thead><tr><th>Código</th><th>Desconto</th><th>Mínimo</th><th>Validade</th><th>Usos</th><th></th></tr></thead><tbody>' + l.cupons.map(function (c) { return '<tr data-cupom="' + esc(c.codigo) + '"><td><b>' + esc(c.codigo) + '</b></td><td>' + (c.tipo === 'percentual' ? c.valor + '%' : L.moeda(c.valor)) + '</td><td>' + (c.minimo ? L.moeda(c.minimo) : '—') + '</td><td>' + (c.validade ? c.validade.split('-').reverse().join('/') : '—') + '</td><td>' + (c.usos || 0) + (c.limite != null ? ' / ' + c.limite : '') + '</td><td><button class="btn mini fantasma perigo" data-a="excluir-cupom" aria-label="Excluir">×</button></td></tr>'; }).join('') + '</tbody></table>' : UI.vazio('Nenhum cupom', '', ''));
    if (aba === 'perguntas') corpo = l.perguntas.length ? l.perguntas.slice().reverse().map(function (q) { const p = prod(q.produto); return '<section class="cartao" data-q="' + q.id + '"><p class="mini mudo">' + esc(p ? p.t : 'Produto removido') + ' · ' + new Date(q.em).toLocaleDateString('pt-BR') + '</p><p><b>' + esc(q.pergunta) + '</b></p>' + (q.resposta ? '<p>' + esc(q.resposta) + '</p>' : '') + '<button class="btn mini" data-a="responder">' + (q.resposta ? 'Editar resposta' : 'Responder') + '</button> <button class="btn mini fantasma perigo" data-a="apagar-q">Apagar</button></section>'; }).join('') : UI.vazio('Nenhuma pergunta', 'As perguntas feitas nas páginas dos produtos aparecem aqui.', '');
    if (aba === 'config') corpo = '<form class="cartao" id="lj-cfg">' + '<div class="linha">' + campo('Nome da loja', '<input name="nome" value="' + esc(l.cfg.nome) + '">') + campo('Assinatura das mensagens', '<input name="assinatura" value="' + esc(l.cfg.assinatura) + '">') + '</div><div class="linha">' + campo('Parcelas sem juros (máx.)', '<input name="parcelasMax" type="number" min="1" max="24" value="' + l.cfg.parcelasMax + '">') + campo('Parcela mínima (R$)', '<input name="parcelaMin" type="number" min="1" value="' + l.cfg.parcelaMin + '">') + '</div><button class="btn primario">Salvar</button></form>';
    el.innerHTML = topo() + '<div class="lj"><h2>Gerenciar loja</h2>' + UI.abas([{ id: 'catalogo', t: 'Catálogo', n: l.produtos.length }, { id: 'cupons', t: 'Cupons' }, { id: 'perguntas', t: 'Perguntas', n: pend }, { id: 'config', t: 'Configurações' }], aba, 'loja/admin') + corpo + '</div>';
    hidratar(el);
    const fc = el.querySelector('#lj-cfg'); if (fc) fc.onsubmit = function (ev) { ev.preventDefault(); const d = new FormData(fc); Object.assign(l.cfg, { nome: d.get('nome').trim() || 'Seven Loja', assinatura: d.get('assinatura').trim(), parcelasMax: Math.max(1, Number(d.get('parcelasMax')) || 1), parcelaMin: Math.max(1, Number(d.get('parcelaMin')) || 1) }); salvar(); aviso('Configurações salvas.'); };
    el.onclick = async function (ev) {
      const b = ev.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      const tr = b.closest('[data-id]'); const p = tr && prod(tr.dataset.id);
      if (a === 'novo') return editarProduto(null);
      if (a === 'editar') return editarProduto(p);
      if (a === 'foto') { const f = await UI.escolherArquivo('image/*'); if (!f) return; if (f.size > 5 * 1024 * 1024) { aviso('Imagem acima de 5 MB.', 'erro'); return; } const id = Dados.id('ljimg'); await Dados.guardarArquivo(id, f); if (p.img) await Dados.apagarArquivo(p.img); p.img = id; }
      if (a === 'semfoto') { await Dados.apagarArquivo(p.img); delete p.img; }
      if (a === 'excluir' && await confirmar('Excluir produto', 'Excluir <b>' + esc(p.t) + '</b> do catálogo? Pedidos antigos continuam com o nome do item.', 'Excluir')) { l.produtos = l.produtos.filter(function (x) { return x !== p; }); l.carrinho = l.carrinho.filter(function (i) { return i.id !== p.id; }); }
      if (a === 'cupom') {
        const r = await modal({ titulo: 'Novo cupom', corpo: '<div class="linha">' + campo('Código *', '<input name="codigo" required style="text-transform:uppercase">') + campo('Tipo', '<select name="tipo">' + opcoes([{ v: 'percentual', t: 'Percentual (%)' }, { v: 'valor', t: 'Valor fixo (R$)' }]) + '</select>') + campo('Desconto *', '<input name="valor" required inputmode="decimal">') + '</div><div class="linha">' + campo('Pedido mínimo (R$)', '<input name="minimo" inputmode="decimal">') + campo('Validade', '<input name="validade" type="date">') + campo('Limite de usos', '<input name="limite" type="number" min="1">') + '</div>',
          validar: function (fd) { const c = fd.get('codigo').trim().toUpperCase(); if (l.cupons.some(function (x) { return x.codigo === c; })) return 'Já existe um cupom com esse código.'; const v = Nucleo.lerNumeroBR(fd.get('valor')); if (!(v > 0)) return 'Desconto inválido.'; if (fd.get('tipo') === 'percentual' && v > 100) return 'Percentual acima de 100%.'; return ''; } });
        if (!r) return;
        l.cupons.push({ codigo: r.get('codigo').trim().toUpperCase(), tipo: r.get('tipo'), valor: Nucleo.lerNumeroBR(r.get('valor')), minimo: r.get('minimo') ? Nucleo.lerNumeroBR(r.get('minimo')) : null, validade: r.get('validade') || null, limite: r.get('limite') ? Number(r.get('limite')) : null, usos: 0, ativo: true });
      }
      if (a === 'excluir-cupom') { const c = b.closest('[data-cupom]').dataset.cupom; l.cupons = l.cupons.filter(function (x) { return x.codigo !== c; }); }
      if (a === 'responder' || a === 'apagar-q') {
        const q = l.perguntas.find(function (x) { return x.id === b.closest('[data-q]').dataset.q; });
        if (a === 'apagar-q') { if (!await confirmar('Apagar pergunta', 'Apagar esta pergunta?', 'Apagar')) return; l.perguntas = l.perguntas.filter(function (x) { return x !== q; }); }
        else { const r = await modal({ titulo: 'Responder pergunta', corpo: '<p><b>' + esc(q.pergunta) + '</b></p>' + campo('Resposta', '<textarea name="r" rows="4" required>' + esc(q.resposta || '') + '</textarea>') }); if (!r) return; q.resposta = r.get('r').trim(); q.respondidaEm = new Date().toISOString(); }
      }
      salvar(); App.redesenhar();
    };
  }

  Telas.loja = {
    titulo: 'Seven Loja',
    render: function (el, sub, param) {
      e();
      const telas = { busca: telaBusca, p: telaProduto, carrinho: telaCarrinho, checkout: telaCheckout, pedidos: telaPedidos, pedido: telaPedido, desejos: telaDesejos, admin: telaAdmin };
      (telas[sub] || telaInicio)(el, param);
      ligarTopo(el); hidratar(el);
      if (!el.__ljCards) { el.__ljCards = true; acoesCards(el); }
    }
  };
})();
