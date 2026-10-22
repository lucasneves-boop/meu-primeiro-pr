/* Design (estilo Canva): formatos, modelos com a marca Seven, operações de elementos, alinhamento, guias, histórico e quebra de texto. Puro. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Design = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MARCA = { preto: '#050505', dourado: '#b68d40', ouroClaro: '#f5ecdb', navy: '#0a1929', vinho: '#800000', branco: '#ffffff', cinza: '#5f6670', fonte: 'Montserrat' };
  // Ordem fixa das cores das categorias (identidade, nunca reciclada): dourado, navy, vinho, verde, azul, cinza.
  const CORES_GRAFICO = ['#b68d40', '#0a1929', '#800000', '#1f7a4a', '#1f5fbf', '#5f6670'];
  const PALETA = [MARCA.preto, MARCA.dourado, MARCA.ouroClaro, MARCA.navy, MARCA.vinho, MARCA.branco, '#1f5fbf', '#1f7a4a', '#e67e22', '#8e44ad', '#f2f2f2', MARCA.cinza];
  // Fontes do Google Fonts com os pesos que cada família realmente tem (pedir peso inexistente derruba o CSS inteiro).
  const PESOS = { 'Montserrat': '400;500;600;700;800', 'Poppins': '400;500;600;700;800', 'Inter': '400;500;600;700;800', 'Raleway': '400;600;700;800', 'Open Sans': '400;600;700;800', 'Nunito': '400;600;700;800', 'Lato': '400;700', 'Oswald': '400;500;600;700', 'Space Grotesk': '400;500;700', 'Playfair Display': '400;700;800', 'Lora': '400;700', 'Merriweather': '400;700', 'Libre Baskerville': '400;700', 'DM Serif Display': '', 'Cinzel': '400;700', 'Bebas Neue': '', 'Anton': '', 'Archivo Black': '', 'Dancing Script': '400;700', 'Great Vibes': '', 'Pacifico': '', 'Roboto Mono': '400;700' };
  const FONTES = Object.keys(PESOS).concat(['Arial', 'Georgia']);
  const CATEGORIA_FONTE = { 'Playfair Display': 'serifa', 'Lora': 'serifa', 'Merriweather': 'serifa', 'Libre Baskerville': 'serifa', 'DM Serif Display': 'serifa', 'Cinzel': 'serifa', 'Georgia': 'serifa', 'Bebas Neue': 'impacto', 'Anton': 'impacto', 'Archivo Black': 'impacto', 'Oswald': 'impacto', 'Dancing Script': 'manuscrita', 'Great Vibes': 'manuscrita', 'Pacifico': 'manuscrita', 'Roboto Mono': 'mono' };
  function fontesUrl() { return 'https://fonts.googleapis.com/css2?' + Object.keys(PESOS).filter(function (f) { return f !== 'Montserrat'; }).map(function (f) { return 'family=' + f.replace(/ /g, '+') + (PESOS[f] ? ':wght@' + PESOS[f] : ''); }).join('&') + '&display=swap'; }
  const FORMATOS = [
    { id: 'post', t: 'Post Instagram', w: 1080, h: 1080 },
    { id: 'story', t: 'Story / Reels', w: 1080, h: 1920 },
    { id: 'apresentacao', t: 'Apresentação 16:9', w: 1920, h: 1080 },
    { id: 'a4', t: 'Documento A4', w: 794, h: 1123 },
    { id: 'linkedin', t: 'Post LinkedIn', w: 1200, h: 627 },
    { id: 'capa-linkedin', t: 'Capa LinkedIn', w: 1584, h: 396 },
    { id: 'cartao', t: 'Cartão de visita', w: 1050, h: 600 },
    { id: 'whatsapp', t: 'Status WhatsApp', w: 1080, h: 1920 },
    { id: 'retrato', t: 'Post retrato 4:5', w: 1080, h: 1350 },
    { id: 'facebook', t: 'Post Facebook', w: 1200, h: 630 },
    { id: 'youtube', t: 'Miniatura YouTube', w: 1280, h: 720 },
    { id: 'a4-paisagem', t: 'A4 paisagem', w: 1123, h: 794 },
    { id: 'flyer', t: 'Flyer A5', w: 559, h: 794 },
    { id: 'banner', t: 'Banner de site', w: 1920, h: 600 },
    { id: 'email', t: 'Cabeçalho de e-mail', w: 600, h: 200 }
  ];

  let seq = 0;
  function id() { return 'el' + Date.now().toString(36) + (seq++).toString(36); }

  function el(tipo, o) {
    const base = { id: id(), tipo: tipo, x: 100, y: 100, w: 300, h: 200, rot: 0, opac: 1, travado: false };
    const pad = {
      texto: { texto: 'Texto', fonte: MARCA.fonte, tam: 48, peso: 700, cor: MARCA.preto, alinh: 'left', italico: false, sublinhado: false, entrelinha: 1.2, espaco: 0, maiusc: false, h: 60 },
      ret: { cor: MARCA.dourado, raio: 0, borda: 0, corBorda: MARCA.preto },
      elipse: { cor: MARCA.dourado, borda: 0, corBorda: MARCA.preto },
      triangulo: { cor: MARCA.dourado },
      estrela: { cor: MARCA.dourado, pontas: 5 },
      seta: { cor: MARCA.preto, h: 60 },
      linha: { cor: MARCA.preto, h: 6 },
      imagem: { src: '', arq: '', ajuste: 'cover', raio: 0 },
      poligono: { cor: MARCA.dourado, lados: 6 },
      caminho: { cor: MARCA.dourado, d: '', vb: [100, 100], prop: false },
      grafico: { tipoG: 'colunas', dados: [{ r: 'Item 1', v: 10 }, { r: 'Item 2', v: 20 }, { r: 'Item 3', v: 15 }, { r: 'Item 4', v: 25 }], cores: CORES_GRAFICO.slice(), corTexto: MARCA.navy, fonte: MARCA.fonte, valores: true, w: 600, h: 400 }
    }[tipo] || {};
    return Object.assign(base, pad, o || {});
  }

  function icone(nome, o) { const i = ICONES.find(function (x) { return x.id === nome; }); return el('caminho', Object.assign({ d: i.d, vb: [24, 24], prop: true, forma: nome }, o || {})); }
  function forma(nome, o) { const f = FORMAS.find(function (x) { return x.id === nome; }); return el('caminho', Object.assign({ d: f.d, vb: [100, 100], prop: false, forma: nome }, o || {})); }
  function pagina(o) { return Object.assign({ id: id(), fundo: '#ffffff', elementos: [] }, o || {}); }
  function novoDesign(formato, o) {
    const f = typeof formato === 'string' ? FORMATOS.find(function (x) { return x.id === formato; }) : formato;
    return Object.assign({ id: 'ds' + Date.now().toString(36) + (seq++).toString(36), titulo: 'Design sem título', w: f.w, h: f.h, formato: f.id || 'custom', paginas: [pagina()], criadoEm: Date.now(), editadoEm: Date.now() }, o || {});
  }

  // ---------- modelos com a marca (só texto editável, nada de dado inventado) ----------
  const LOGO = 'img/seven-logo.png', MARCA_IMG = 'img/seven-marca.png';
  function modelo(nome) {
    const M = MARCA;
    const fab = {
      'post-licitacao': function () {
        const d = novoDesign('post', { titulo: 'Post — oportunidade aberta' }); const p = d.paginas[0]; p.fundo = M.preto;
        p.elementos = [
          el('ret', { x: 0, y: 0, w: 1080, h: 14, cor: M.dourado }),
          el('imagem', { x: 80, y: 80, w: 120, h: 120, src: MARCA_IMG, ajuste: 'contain' }),
          el('texto', { x: 80, y: 300, w: 920, h: 70, texto: 'OPORTUNIDADE ABERTA', tam: 40, peso: 600, cor: M.dourado, espaco: 6 }),
          el('texto', { x: 80, y: 380, w: 920, h: 260, texto: 'Pregão eletrônico para [objeto]', tam: 84, peso: 800, cor: M.branco, entrelinha: 1.1 }),
          el('texto', { x: 80, y: 700, w: 920, h: 120, texto: 'Órgão: [nome do órgão]\nSessão: [data e hora]', tam: 36, peso: 500, cor: M.ouroClaro, entrelinha: 1.4 }),
          el('ret', { x: 80, y: 900, w: 520, h: 90, cor: M.dourado, raio: 45 }),
          el('texto', { x: 80, y: 922, w: 520, h: 50, texto: 'Fale com a Seven', tam: 34, peso: 700, cor: M.preto, alinh: 'center' })
        ]; return d;
      },
      'story-resultado': function () {
        const d = novoDesign('story', { titulo: 'Story — resultado de pregão' }); const p = d.paginas[0]; p.fundo = M.navy;
        p.elementos = [
          el('elipse', { x: 640, y: -200, w: 700, h: 700, cor: M.dourado, opac: 0.25 }),
          el('imagem', { x: 90, y: 140, w: 360, h: 120, src: LOGO, ajuste: 'contain' }),
          el('texto', { x: 90, y: 620, w: 900, h: 80, texto: 'RESULTADO', tam: 56, peso: 600, cor: M.dourado, espaco: 10 }),
          el('texto', { x: 90, y: 720, w: 900, h: 420, texto: 'Mais um pregão vencido pelo nosso cliente', tam: 104, peso: 800, cor: M.branco, entrelinha: 1.05 }),
          el('linha', { x: 90, y: 1220, w: 200, h: 8, cor: M.dourado }),
          el('texto', { x: 90, y: 1280, w: 900, h: 200, texto: '[Objeto]\n[Órgão — UF]', tam: 44, peso: 500, cor: M.ouroClaro, entrelinha: 1.4 }),
          el('texto', { x: 90, y: 1700, w: 900, h: 60, texto: 'Seven · BPO de Licitações', tam: 36, peso: 600, cor: M.branco })
        ]; return d;
      },
      'capa-proposta': function () {
        const d = novoDesign('a4', { titulo: 'Capa de proposta comercial' }); const p = d.paginas[0]; p.fundo = M.branco;
        p.elementos = [
          el('ret', { x: 0, y: 0, w: 260, h: 1123, cor: M.preto }),
          el('ret', { x: 260, y: 0, w: 10, h: 1123, cor: M.dourado }),
          el('imagem', { x: 50, y: 60, w: 160, h: 160, src: MARCA_IMG, ajuste: 'contain' }),
          el('texto', { x: 330, y: 360, w: 420, h: 40, texto: 'PROPOSTA COMERCIAL', tam: 20, peso: 600, cor: M.dourado, espaco: 4 }),
          el('texto', { x: 330, y: 410, w: 420, h: 200, texto: 'BPO de Licitações para [Cliente]', tam: 44, peso: 800, cor: M.preto, entrelinha: 1.1 }),
          el('texto', { x: 330, y: 650, w: 420, h: 120, texto: 'Do edital ao pagamento: encontrar, cadastrar, disputar e acompanhar.', tam: 18, peso: 400, cor: M.cinza, entrelinha: 1.5 }),
          el('texto', { x: 330, y: 1000, w: 420, h: 70, texto: 'Lucas Neves | Seven\n(61) 98347-2232', tam: 16, peso: 600, cor: M.preto, entrelinha: 1.5 })
        ]; return d;
      },
      'cartao': function () {
        const d = novoDesign('cartao', { titulo: 'Cartão de visita' }); const p = d.paginas[0]; p.fundo = M.preto;
        p.elementos = [
          el('imagem', { x: 70, y: 70, w: 300, h: 100, src: LOGO, ajuste: 'contain' }),
          el('ret', { x: 70, y: 300, w: 120, h: 6, cor: M.dourado }),
          el('texto', { x: 70, y: 330, w: 900, h: 60, texto: 'Lucas Neves', tam: 48, peso: 700, cor: M.branco }),
          el('texto', { x: 70, y: 395, w: 900, h: 40, texto: 'Fundador · BPO de Licitações', tam: 26, peso: 500, cor: M.dourado }),
          el('texto', { x: 70, y: 480, w: 900, h: 40, texto: '(61) 98347-2232 · Catalão-GO · Brasília-DF', tam: 24, peso: 500, cor: M.ouroClaro })
        ]; return d;
      },
      'apresentacao': function () {
        const d = novoDesign('apresentacao', { titulo: 'Apresentação comercial' });
        const capa = d.paginas[0]; capa.fundo = M.preto;
        capa.elementos = [
          el('imagem', { x: 120, y: 120, w: 420, h: 140, src: LOGO, ajuste: 'contain' }),
          el('texto', { x: 120, y: 420, w: 1300, h: 260, texto: 'Seu departamento de licitações, do edital ao pagamento', tam: 88, peso: 800, cor: M.branco, entrelinha: 1.1 }),
          el('ret', { x: 120, y: 760, w: 220, h: 10, cor: M.dourado }),
          el('texto', { x: 120, y: 810, w: 1300, h: 60, texto: 'Apresentação para [Cliente]', tam: 40, peso: 500, cor: M.ouroClaro })
        ];
        const p2 = pagina({ fundo: M.branco });
        p2.elementos = [el('texto', { x: 120, y: 100, w: 1680, h: 90, texto: 'Como a Seven trabalha', tam: 64, peso: 800, cor: M.preto })].concat(['Encontrar', 'Cadastrar', 'Disputar', 'Acompanhar'].reduce(function (a, t, i) {
          const x = 120 + i * 430;
          return a.concat([el('ret', { x: x, y: 330, w: 390, h: 520, cor: i % 2 ? M.ouroClaro : M.preto, raio: 24 }), el('texto', { x: x + 40, y: 380, w: 310, h: 80, texto: String(i + 1).padStart(2, '0'), tam: 64, peso: 800, cor: M.dourado }), el('texto', { x: x + 40, y: 480, w: 310, h: 70, texto: t, tam: 44, peso: 700, cor: i % 2 ? M.preto : M.branco }), el('texto', { x: x + 40, y: 570, w: 310, h: 220, texto: '[Descreva a etapa]', tam: 26, peso: 400, cor: i % 2 ? M.cinza : M.ouroClaro, entrelinha: 1.4 })]);
        }, []));
        d.paginas.push(p2); return d;
      },
      'certificado': function () {
        const d = novoDesign('apresentacao', { titulo: 'Certificado de treinamento' }); const p = d.paginas[0]; p.fundo = M.ouroClaro;
        p.elementos = [
          el('ret', { x: 40, y: 40, w: 1840, h: 1000, cor: 'transparent', borda: 6, corBorda: M.dourado }),
          el('imagem', { x: 860, y: 100, w: 200, h: 200, src: MARCA_IMG, ajuste: 'contain' }),
          el('texto', { x: 160, y: 340, w: 1600, h: 90, texto: 'CERTIFICADO', tam: 80, peso: 800, cor: M.preto, alinh: 'center', espaco: 12 }),
          el('texto', { x: 160, y: 470, w: 1600, h: 60, texto: 'Certificamos que', tam: 36, peso: 400, cor: M.cinza, alinh: 'center' }),
          el('texto', { x: 160, y: 550, w: 1600, h: 100, texto: '[Nome do participante]', tam: 72, peso: 700, cor: M.dourado, alinh: 'center', fonte: 'Playfair Display' }),
          el('texto', { x: 260, y: 690, w: 1400, h: 120, texto: 'concluiu o treinamento [nome do curso], com carga horária de [x] horas.', tam: 34, peso: 400, cor: M.preto, alinh: 'center', entrelinha: 1.5 }),
          el('linha', { x: 760, y: 920, w: 400, h: 3, cor: M.preto }),
          el('texto', { x: 660, y: 940, w: 600, h: 50, texto: 'Lucas Neves | Seven', tam: 28, peso: 600, cor: M.preto, alinh: 'center' })
        ]; return d;
      },
      'post-dica': function () {
        const d = novoDesign('retrato', { titulo: 'Post — dica de licitação' }); const p = d.paginas[0]; p.fundo = M.preto; p.grad = { tipo: 'linear', c1: '#050505', c2: '#3a2c12', ang: 160 };
        p.elementos = [
          el('elipse', { x: 700, y: -160, w: 560, h: 560, cor: M.dourado, opac: 0.18 }),
          icone('ideia', { x: 80, y: 110, w: 120, h: 120, cor: M.dourado }),
          el('texto', { x: 92, y: 300, w: 480, h: 40, texto: 'DICA DE LICITAÇÃO', tam: 34, peso: 700, cor: M.preto, espaco: 4, destaque: { cor: M.dourado, pad: 12, raio: 8 } }),
          el('texto', { x: 80, y: 420, w: 920, h: 360, texto: '[Escreva a dica em uma frase forte]', tam: 80, peso: 800, cor: M.branco, entrelinha: 1.1, sombra: { dx: 0, dy: 8, blur: 24, cor: '#000000', opac: 0.5 } }),
          el('texto', { x: 80, y: 860, w: 920, h: 200, texto: '[Explique em duas linhas como aplicar no dia a dia]', tam: 38, peso: 500, cor: M.ouroClaro, entrelinha: 1.4 }),
          el('linha', { x: 80, y: 1180, w: 920, h: 3, cor: M.dourado, opac: 0.6 }),
          el('imagem', { x: 80, y: 1210, w: 90, h: 90, src: MARCA_IMG, ajuste: 'contain' }),
          el('texto', { x: 190, y: 1232, w: 700, h: 50, texto: 'Seven · BPO de Licitações', tam: 32, peso: 600, cor: M.branco })
        ]; return d;
      },
      'linkedin-resultados': function () {
        const d = novoDesign('linkedin', { titulo: 'LinkedIn — resultados' }); const p = d.paginas[0]; p.fundo = M.branco;
        p.elementos = [
          el('ret', { x: 0, y: 0, w: 14, h: 627, cor: M.dourado }),
          el('texto', { x: 70, y: 70, w: 480, h: 40, texto: 'RESULTADOS', tam: 24, peso: 700, cor: M.dourado, espaco: 6 }),
          el('texto', { x: 70, y: 120, w: 480, h: 200, texto: '[Título do resultado do período]', tam: 50, peso: 800, cor: M.navy, entrelinha: 1.1 }),
          el('texto', { x: 70, y: 400, w: 460, h: 100, texto: '[Contexto: período, clientes, objetos]', tam: 24, peso: 400, cor: M.cinza, entrelinha: 1.5 }),
          el('texto', { x: 70, y: 540, w: 460, h: 40, texto: 'Seven · BPO de Licitações', tam: 22, peso: 600, cor: M.navy }),
          el('grafico', { x: 600, y: 80, w: 540, h: 470, tipoG: 'colunas', dados: [{ r: '[Mês 1]', v: 1 }, { r: '[Mês 2]', v: 2 }, { r: '[Mês 3]', v: 3 }], titulo: '[Pregões vencidos]' })
        ]; return d;
      },
      'story-sessao': function () {
        const d = novoDesign('story', { titulo: 'Story — sessão pública' }); const p = d.paginas[0]; p.fundo = M.navy; p.grad = { tipo: 'radial', c1: '#16324f', c2: '#050505', ang: 0 };
        p.elementos = [
          el('texto', { x: 90, y: 380, w: 900, h: 300, texto: 'SESSÃO PÚBLICA', tam: 76, peso: 800, cor: M.dourado, alinh: 'center', curva: 40, w: 900, h: 300 }),
          icone('calendario', { x: 440, y: 720, w: 200, h: 200, cor: M.branco }),
          el('texto', { x: 90, y: 980, w: 900, h: 140, texto: '[Data · hora]', tam: 96, peso: 800, cor: M.branco, alinh: 'center' }),
          el('texto', { x: 90, y: 1140, w: 900, h: 160, texto: '[Órgão]\n[Pregão nº]', tam: 44, peso: 500, cor: M.ouroClaro, alinh: 'center', entrelinha: 1.4 }),
          el('ret', { x: 290, y: 1560, w: 500, h: 110, cor: M.dourado, raio: 55 }),
          el('texto', { x: 290, y: 1586, w: 500, h: 60, texto: 'Estamos na disputa', tam: 38, peso: 700, cor: M.preto, alinh: 'center' })
        ]; return d;
      },
      'flyer-servicos': function () {
        const d = novoDesign('flyer', { titulo: 'Flyer — serviços da Seven' }); const p = d.paginas[0]; p.fundo = M.branco;
        const itens = ['Busca e triagem de editais', 'Cadastro de propostas', 'Disputa e lances', 'Habilitação e recursos', 'Contratos, empenho e pagamento'];
        p.elementos = [
          el('ret', { x: 0, y: 0, w: 559, h: 230, cor: M.preto, grad: { tipo: 'linear', c1: '#050505', c2: '#3a2c12', ang: 135 } }),
          el('imagem', { x: 40, y: 40, w: 200, h: 66, src: LOGO, ajuste: 'contain' }),
          el('texto', { x: 40, y: 130, w: 480, h: 70, texto: 'Seu departamento de licitações completo', tam: 26, peso: 800, cor: M.branco, entrelinha: 1.15 })
        ].concat(itens.reduce(function (a, t, i) { return a.concat([icone('ok-circulo', { x: 40, y: 280 + i * 70, w: 34, h: 34, cor: M.dourado }), el('texto', { x: 90, y: 284 + i * 70, w: 430, h: 30, texto: t, tam: 20, peso: 600, cor: M.navy })]); }, [])).concat([
          el('ret', { x: 40, y: 670, w: 479, h: 80, cor: M.ouroClaro, raio: 14 }),
          el('texto', { x: 40, y: 682, w: 479, h: 60, texto: '(61) 98347-2232\nCatalão-GO · Brasília-DF', tam: 18, peso: 600, cor: M.preto, alinh: 'center', entrelinha: 1.4 })
        ]); return d;
      }
    }[nome];
    return fab ? fab() : null;
  }
  const MODELOS = [
    { id: 'post-licitacao', t: 'Post: oportunidade aberta', formato: 'post' }, { id: 'story-resultado', t: 'Story: resultado de pregão', formato: 'story' },
    { id: 'apresentacao', t: 'Apresentação comercial', formato: 'apresentacao' }, { id: 'capa-proposta', t: 'Capa de proposta', formato: 'a4' },
    { id: 'cartao', t: 'Cartão de visita', formato: 'cartao' }, { id: 'certificado', t: 'Certificado de treinamento', formato: 'apresentacao' },
    { id: 'post-dica', t: 'Post: dica de licitação', formato: 'retrato' }, { id: 'linkedin-resultados', t: 'LinkedIn: resultados', formato: 'linkedin' },
    { id: 'story-sessao', t: 'Story: sessão pública', formato: 'story' }, { id: 'flyer-servicos', t: 'Flyer: serviços', formato: 'flyer' }
  ];

  // ---------- geometria ----------
  function arred(v) { return Math.round(v * 10) / 10; }
  // Redimensiona pela alça (n, s, e, w, ne, nw, se, sw). prop = manter proporção.
  function redimensionar(o, alca, dx, dy, prop, min) {
    min = min || 10; let x = o.x, y = o.y, w = o.w, h = o.h;
    if (alca.indexOf('e') >= 0) w = o.w + dx; if (alca.indexOf('w') >= 0) { w = o.w - dx; x = o.x + dx; }
    if (alca.indexOf('s') >= 0) h = o.h + dy; if (alca.indexOf('n') >= 0) { h = o.h - dy; y = o.y + dy; }
    if (prop && alca.length === 2) { const k = Math.max(w / o.w, h / o.h); const nw = o.w * k, nh = o.h * k; if (alca.indexOf('w') >= 0) x = o.x + o.w - nw; if (alca.indexOf('n') >= 0) y = o.y + o.h - nh; w = nw; h = nh; }
    if (w < min) { if (alca.indexOf('w') >= 0) x -= min - w; w = min; } if (h < min) { if (alca.indexOf('n') >= 0) y -= min - h; h = min; }
    return { x: arred(x), y: arred(y), w: arred(w), h: arred(h) };
  }
  function angulo(cx, cy, px, py, passo) { let a = Math.atan2(py - cy, px - cx) * 180 / Math.PI + 90; a = ((a % 360) + 360) % 360; if (passo) a = Math.round(a / passo) * passo % 360; return Math.round(a); }

  // Atração para guias (centro e bordas da página e de outros elementos).
  function guias(o, outros, pw, ph, tol) {
    tol = tol || 6; const vx = [0, pw / 2, pw], vy = [0, ph / 2, ph];
    (outros || []).forEach(function (e) { vx.push(e.x, e.x + e.w / 2, e.x + e.w); vy.push(e.y, e.y + e.h / 2, e.y + e.h); });
    let x = o.x, y = o.y; const linhas = [];
    let melhor = tol + 1;
    [[o.x, 0], [o.x + o.w / 2, o.w / 2], [o.x + o.w, o.w]].forEach(function (p) { vx.forEach(function (g) { const d = Math.abs(p[0] - g); if (d <= tol && d < melhor) { melhor = d; x = g - p[1]; linhas[0] = { eixo: 'x', v: g }; } }); });
    melhor = tol + 1;
    [[o.y, 0], [o.y + o.h / 2, o.h / 2], [o.y + o.h, o.h]].forEach(function (p) { vy.forEach(function (g) { const d = Math.abs(p[0] - g); if (d <= tol && d < melhor) { melhor = d; y = g - p[1]; linhas[1] = { eixo: 'y', v: g }; } }); });
    return { x: arred(x), y: arred(y), linhas: linhas.filter(Boolean) };
  }

  function alinhar(els, modo, pw, ph) {
    if (!els.length) return els;
    const ref = els.length === 1 ? { x: 0, y: 0, w: pw, h: ph } : { x: Math.min.apply(null, els.map(function (e) { return e.x; })), y: Math.min.apply(null, els.map(function (e) { return e.y; })), x2: Math.max.apply(null, els.map(function (e) { return e.x + e.w; })), y2: Math.max.apply(null, els.map(function (e) { return e.y + e.h; })) };
    if (ref.x2 != null) { ref.w = ref.x2 - ref.x; ref.h = ref.y2 - ref.y; }
    els.forEach(function (e) {
      if (modo === 'esquerda') e.x = ref.x; if (modo === 'direita') e.x = ref.x + ref.w - e.w; if (modo === 'centro-h') e.x = arred(ref.x + (ref.w - e.w) / 2);
      if (modo === 'topo') e.y = ref.y; if (modo === 'base') e.y = ref.y + ref.h - e.h; if (modo === 'centro-v') e.y = arred(ref.y + (ref.h - e.h) / 2);
    });
    return els;
  }
  function distribuir(els, eixo) {
    if (els.length < 3) return els;
    const k = eixo === 'h' ? 'x' : 'y', t = eixo === 'h' ? 'w' : 'h';
    const ord = els.slice().sort(function (a, b) { return a[k] - b[k]; });
    const ini = ord[0][k], fim = ord[ord.length - 1][k] + ord[ord.length - 1][t];
    const ocup = ord.reduce(function (s, e) { return s + e[t]; }, 0); const gap = (fim - ini - ocup) / (ord.length - 1);
    let pos = ini; ord.forEach(function (e) { e[k] = arred(pos); pos += e[t] + gap; });
    return els;
  }
  function ordem(lista, idEl, acao) {
    const i = lista.findIndex(function (e) { return e.id === idEl; }); if (i < 0) return lista;
    const [x] = lista.splice(i, 1);
    const j = acao === 'frente' ? lista.length : acao === 'tras' ? 0 : acao === 'subir' ? Math.min(lista.length, i + 1) : Math.max(0, i - 1);
    lista.splice(j, 0, x); return lista;
  }
  function selecaoRetangulo(els, r) {
    const x1 = Math.min(r.x1, r.x2), x2 = Math.max(r.x1, r.x2), y1 = Math.min(r.y1, r.y2), y2 = Math.max(r.y1, r.y2);
    return els.filter(function (e) { return e.x < x2 && e.x + e.w > x1 && e.y < y2 && e.y + e.h > y1; }).map(function (e) { return e.id; });
  }

  // ---------- formas ----------
  function pontosEstrela(w, h, pontas) {
    const n = pontas || 5, pts = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? 0.45 : 1; const a = Math.PI * i / n - Math.PI / 2; pts.push([arred(w / 2 + Math.cos(a) * w / 2 * r), arred(h / 2 + Math.sin(a) * h / 2 * r)]); }
    return pts;
  }
  function pontosSeta(w, h) { const c = Math.min(h, w * 0.4); return [[0, h * 0.3], [w - c, h * 0.3], [w - c, 0], [w, h / 2], [w - c, h], [w - c, h * 0.7], [0, h * 0.7]].map(function (p) { return [arred(p[0]), arred(p[1])]; }); }

  // ---------- texto ----------
  // Quebra respeitando \n e largura; medir(t) devolve a largura em px.
  function quebrarTexto(texto, largura, medir) {
    const out = [];
    String(texto).split('\n').forEach(function (par) {
      const ps = par.split(' '); let linha = '';
      ps.forEach(function (p) {
        const tenta = linha ? linha + ' ' + p : p;
        if (medir(tenta) <= largura || !linha) {
          if (!linha && medir(p) > largura) { let pedaco = ''; for (const ch of p) { if (medir(pedaco + ch) > largura && pedaco) { out.push(pedaco); pedaco = ch; } else pedaco += ch; } linha = pedaco; }
          else linha = tenta;
        } else { out.push(linha); linha = p; }
      });
      out.push(linha);
    });
    return out;
  }

  // ---------- histórico ----------
  function historico(limite) {
    const h = { pilha: [], futuro: [], limite: limite || 60 };
    h.registrar = function (estado) { const s = JSON.stringify(estado); if (h.pilha[h.pilha.length - 1] === s) return; h.pilha.push(s); if (h.pilha.length > h.limite) h.pilha.shift(); h.futuro = []; };
    h.desfazer = function (atual) { if (h.pilha.length < 2) return null; h.futuro.push(h.pilha.pop()); return JSON.parse(h.pilha[h.pilha.length - 1]); };
    h.refazer = function () { if (!h.futuro.length) return null; const s = h.futuro.pop(); h.pilha.push(s); return JSON.parse(s); };
    return h;
  }

  // ---------- preenchimento: cor sólida ou gradiente ----------
  // g = { tipo: 'linear'|'radial', c1, c2, ang }. Mesma geometria do CSS: 0° = de baixo para cima, 90° = da esquerda para a direita.
  function gradLinha(w, h, ang) {
    const a = (Number(ang) || 0) * Math.PI / 180, sx = Math.sin(a), cy = Math.cos(a);
    const meio = (Math.abs(w * sx) + Math.abs(h * cy)) / 2;
    return { x1: arred(w / 2 - sx * meio), y1: arred(h / 2 + cy * meio), x2: arred(w / 2 + sx * meio), y2: arred(h / 2 - cy * meio) };
  }
  function gradRaio(w, h) { return arred(Math.hypot(w, h) / 2); }
  function gradCss(g) { return g.tipo === 'radial' ? 'radial-gradient(circle farthest-corner at 50% 50%, ' + g.c1 + ', ' + g.c2 + ')' : 'linear-gradient(' + (Number(g.ang) || 0) + 'deg, ' + g.c1 + ', ' + g.c2 + ')'; }
  function corCss(x) { return x.grad ? gradCss(x.grad) : x.cor; }
  const GRADIENTES = [
    { tipo: 'linear', c1: '#050505', c2: '#b68d40', ang: 135 }, { tipo: 'linear', c1: '#0a1929', c2: '#1f5fbf', ang: 135 }, { tipo: 'linear', c1: '#b68d40', c2: '#f5ecdb', ang: 180 },
    { tipo: 'linear', c1: '#800000', c2: '#050505', ang: 160 }, { tipo: 'radial', c1: '#3a2c12', c2: '#050505', ang: 0 }, { tipo: 'linear', c1: '#1f7a4a', c2: '#0a1929', ang: 135 },
    { tipo: 'linear', c1: '#ffffff', c2: '#f1eee8', ang: 180 }, { tipo: 'radial', c1: '#f5ecdb', c2: '#b68d40', ang: 0 }
  ];

  // ---------- formas ----------
  function pontosPoligono(w, h, lados) {
    const n = Math.max(3, Math.min(12, Math.round(lados) || 6)), pts = [];
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + 2 * Math.PI * i / n; pts.push([Math.cos(a), Math.sin(a)]); }
    const xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    return pts.map(function (p) { return [arred((p[0] - x0) / (x1 - x0) * w), arred((p[1] - y0) / (y1 - y0) * h)]; });
  }
  // Formas desenhadas por caminho SVG numa caixa 100 × 100 (esticam com o elemento).
  const FORMAS = [
    { id: 'coracao', t: 'Coração', d: 'M50 92 10 52C-6 34 6 8 28 8c10 0 18 6 22 14 4-8 12-14 22-14 22 0 34 26 18 44z' },
    { id: 'balao', t: 'Balão de fala', d: 'M8 4h84a6 6 0 0 1 6 6v56a6 6 0 0 1-6 6H42L20 96V72H8a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6z' },
    { id: 'cruz', t: 'Cruz', d: 'M35 0h30v35h35v30H65v35H35V65H0V35h35z' },
    { id: 'raio', t: 'Raio', d: 'M60 0 10 58h32L30 100l60-64H58z' },
    { id: 'etiqueta', t: 'Etiqueta', d: 'M0 50 24 8h76v84H24z' },
    { id: 'faixa', t: 'Faixa', d: 'M0 15h100L84 50l16 35H0l16-35z' },
    { id: 'gota', t: 'Gota', d: 'M50 0C50 0 14 44 14 64a36 36 0 0 0 72 0C86 44 50 0 50 0z' },
    { id: 'meia-lua', t: 'Semicírculo', d: 'M0 100A50 50 0 0 1 100 100z' }
  ];
  // Ícones próprios, desenhados numa caixa 24 × 24 (mantêm a proporção).
  const ICONES = [
    { id: 'check', t: 'Confirmado', d: 'M3.5 12.5 5 11l4 4L19 5l1.5 1.5L9 18z' },
    { id: 'ok-circulo', t: 'Aprovado', d: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.5 14.5-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4z' },
    { id: 'x', t: 'Recusado', d: 'M5 6.4 6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12z' },
    { id: 'mais', t: 'Mais', d: 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z' },
    { id: 'seta', t: 'Seta', d: 'M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4z' },
    { id: 'seta-cima', t: 'Crescimento', d: 'M11 20V7.8l-5.6 5.6L4 12l8-8 8 8-1.4 1.4L13 7.8V20z' },
    { id: 'local', t: 'Local', d: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z' },
    { id: 'email', t: 'E-mail', d: 'M3 5h18v14H3zM5 7h14l-7 4.6zM5 9.4l7 4.6 7-4.6V17H5z' },
    { id: 'telefone', t: 'Telefone', d: 'M6.6 2.5 9.5 5.4 7.8 8.2c1.3 2.9 3.4 5 6.1 6.3l2.7-1.7 2.9 2.9-1.6 3.6C11.2 19.6 4.4 12.8 3 6.1z' },
    { id: 'conversa', t: 'Conversa', d: 'M4 4h16v12H9l-5 4z' },
    { id: 'calendario', t: 'Data', d: 'M4 5h16v15H4zM6 9v9h12V9zM7 2.5h2V5H7zM15 2.5h2V5h-2zM8 11h3v3H8z' },
    { id: 'relogio', t: 'Prazo', d: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM11 6h2v5.6l4 2.3-1 1.7-5-2.9z' },
    { id: 'documento', t: 'Edital', d: 'M6 2h8l5 5v15H6zM13 3.5V8h4.5zM8 11h8v1.6H8zM8 14.5h8v1.6H8zM8 18h5v1.6H8z' },
    { id: 'martelo', t: 'Pregão', d: 'M14.2 2.2l5.6 5.6-2.1 2.1-5.6-5.6zM9.9 6.5l5.6 5.6-2.1 2.1-5.6-5.6zM11.4 10.4l2.2 2.2-8.1 8.1-2.2-2.2zM13 19h8v2.5h-8z' },
    { id: 'trofeu', t: 'Vitória', d: 'M7 3h10v2h3v3a4 4 0 0 1-4 4h-.4A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.4 12H8a4 4 0 0 1-4-4V5h3zM6 7v1a2 2 0 0 0 1.4 1.9L7 7zm12 0-.4 2.9A2 2 0 0 0 18 8V7z' },
    { id: 'grafico', t: 'Resultado', d: 'M4 20V4h1.6v14.4H20V20zM7 11h3v6H7zm4.5-4h3v10h-3zM16 13h3v4h-3z' },
    { id: 'porcento', t: 'Desconto', d: 'M7 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm10 10a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM17.6 4.6 19 6 6.4 19.4 5 18z' },
    { id: 'escudo', t: 'Segurança', d: 'M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5zm-1.2 13.6-3.6-3.6 1.4-1.4 2.2 2.2 4.8-4.8 1.4 1.4z' },
    { id: 'ideia', t: 'Ideia', d: 'M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2zM9 18.5h6V20H9zM10 21h4v1h-4z' },
    { id: 'megafone', t: 'Aviso', d: 'M3 10h4l9-5v14l-9-5H3zM18 9.5a3 3 0 0 1 0 5zM6 14.5h3l1 5H7.5z' },
    { id: 'usuario', t: 'Pessoa', d: 'M12 3a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM3.5 21c0-4.4 3.8-7.5 8.5-7.5s8.5 3.1 8.5 7.5z' },
    { id: 'casa', t: 'Sede', d: 'M12 3 2 11.5h3V21h5v-6h4v6h5v-9.5h3z' },
    { id: 'lupa', t: 'Busca', d: 'M10 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM15.6 14.2l5.4 5.4-1.4 1.4-5.4-5.4z' },
    { id: 'coracao', t: 'Coração', d: 'M12 21 3.6 12.8A5.2 5.2 0 0 1 12 6.3a5.2 5.2 0 0 1 8.4 6.5z' }
  ];
  // Linha sólida, tracejada ou pontilhada: segmentos [início, fim] ao longo da largura.
  function tracos(w, h, estilo) {
    if (!estilo || estilo === 'solido') return [[0, arred(w)]];
    const t = estilo === 'pontilhado' ? Math.max(1, h) : Math.max(4, h * 3), v = estilo === 'pontilhado' ? Math.max(1, h) : Math.max(3, h * 2);
    const out = []; for (let x = 0; x < w - 0.01; x += t + v) out.push([arred(x), arred(Math.min(w, x + t))]); return out;
  }

  // ---------- molduras (máscaras) em frações da caixa ----------
  const MOLDURAS = [{ id: 'circulo', t: 'Círculo' }, { id: 'arredondado', t: 'Arredondado' }, { id: 'hexagono', t: 'Hexágono' }, { id: 'losango', t: 'Losango' }, { id: 'triangulo', t: 'Triângulo' }, { id: 'estrela', t: 'Estrela' }, { id: 'arco', t: 'Arco' }];
  function mascaraPontos(tipo) {
    const u = function (pts, w, h) { return pts.map(function (p) { return [arred(p[0] / w), arred(p[1] / h)].map(function (v) { return Math.round(v * 1000) / 1000; }); }); };
    if (tipo === 'hexagono') return u(pontosPoligono(100, 100, 6), 100, 100);
    if (tipo === 'losango') return u(pontosPoligono(100, 100, 4), 100, 100);
    if (tipo === 'triangulo') return [[0.5, 0], [1, 1], [0, 1]];
    if (tipo === 'estrela') return u(pontosEstrela(100, 100, 5), 100, 100);
    return null;
  }
  function clipCss(tipo) {
    if (tipo === 'circulo') return 'ellipse(50% 50% at 50% 50%)';
    if (tipo === 'arredondado') return 'inset(0 round 12%)';
    if (tipo === 'arco') return 'inset(0 round 50% 50% 0 0)';
    const p = mascaraPontos(tipo); return p ? 'polygon(' + p.map(function (q) { return arred(q[0] * 100) + '% ' + arred(q[1] * 100) + '%'; }).join(', ') + ')' : '';
  }

  // ---------- fotos: filtros prontos e ajustes ----------
  const AJUSTES = { brilho: 100, contraste: 100, saturacao: 100, matiz: 0, desfoque: 0, sepia: 0, pb: 0 };
  const FILTROS = [
    { id: 'original', t: 'Original', a: {} },
    { id: 'vivido', t: 'Vívido', a: { saturacao: 140, contraste: 110 } },
    { id: 'pb', t: 'P&B', a: { pb: 100, contraste: 110 } },
    { id: 'vintage', t: 'Vintage', a: { sepia: 45, contraste: 90, brilho: 105, saturacao: 80 } },
    { id: 'quente', t: 'Quente', a: { sepia: 20, saturacao: 120, matiz: -8 } },
    { id: 'frio', t: 'Frio', a: { saturacao: 105, matiz: 12, brilho: 102 } },
    { id: 'dramatico', t: 'Dramático', a: { contraste: 145, brilho: 90, saturacao: 85 } },
    { id: 'suave', t: 'Suave', a: { contraste: 85, brilho: 110, saturacao: 90 } },
    { id: 'dourado', t: 'Dourado', a: { sepia: 60, saturacao: 140, brilho: 105 } }
  ];
  function ajustesDe(x) { return Object.assign({}, AJUSTES, x && x.ajustes); }
  // Mesma string serve ao CSS (filter) e ao canvas (ctx.filter); o desfoque é em px, por isso a escala.
  function filtroCss(aj, escala) {
    const a = Object.assign({}, AJUSTES, aj), k = escala || 1, f = [];
    if (a.brilho !== 100) f.push('brightness(' + a.brilho + '%)'); if (a.contraste !== 100) f.push('contrast(' + a.contraste + '%)');
    if (a.saturacao !== 100) f.push('saturate(' + a.saturacao + '%)'); if (a.matiz) f.push('hue-rotate(' + a.matiz + 'deg)');
    if (a.sepia) f.push('sepia(' + a.sepia + '%)'); if (a.pb) f.push('grayscale(' + a.pb + '%)'); if (a.desfoque) f.push('blur(' + arred(a.desfoque * k) + 'px)');
    return f.length ? f.join(' ') : 'none';
  }
  // Recorte da foto: zoom (≥ 1) em torno do ponto focal (fx, fy entre 0 e 1), como object-position + scale no CSS.
  function recorte(iw, ih, w, h, ajuste, zoom, fx, fy) {
    fx = fx == null ? 0.5 : fx; fy = fy == null ? 0.5 : fy; const z = Math.max(1, zoom || 1);
    const ri = iw / ih, re = w / h;
    if (ajuste === 'contain') { let dw = w, dh = h; if (ri > re) dh = w / ri; else dw = h * ri; return { sx: 0, sy: 0, sw: iw, sh: ih, dx: (w - dw) * fx, dy: (h - dh) * fy, dw: dw, dh: dh }; }
    let sw = iw, sh = ih; if (ri > re) sw = ih * re; else sh = iw / re;
    const sx0 = (iw - sw) * fx, sy0 = (ih - sh) * fy; const sw2 = sw / z, sh2 = sh / z;
    return { sx: sx0 + fx * (sw - sw2), sy: sy0 + fy * (sh - sh2), sw: sw2, sh: sh2, dx: 0, dy: 0, dw: w, dh: h };
  }

  // ---------- efeitos ----------
  const MISTURAS = [['normal', 'Normal'], ['multiply', 'Multiplicar'], ['screen', 'Tela'], ['overlay', 'Sobrepor'], ['darken', 'Escurecer'], ['lighten', 'Clarear'], ['color-dodge', 'Subexposição'], ['color-burn', 'Superexposição'], ['soft-light', 'Luz suave'], ['hard-light', 'Luz forte'], ['difference', 'Diferença'], ['luminosity', 'Luminosidade']];
  function rgba(hex, a) { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return hex || 'rgba(0,0,0,' + a + ')'; const n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + (a == null ? 1 : a) + ')'; }
  // Estilos de texto prontos (como os efeitos do Canva). Cada um devolve só o que muda.
  function efeitoTexto(nome, x) {
    const c = x.cor && x.cor !== 'transparent' ? x.cor : MARCA.preto, t = x.tam || 48;
    const zero = { sombra: null, contorno: null, vazado: false, destaque: null };
    return Object.assign(zero, {
      nenhum: {},
      sombra: { sombra: { dx: arred(t * 0.06), dy: arred(t * 0.06), blur: arred(t * 0.1), cor: '#000000', opac: 0.45 } },
      elevado: { sombra: { dx: 0, dy: arred(t * 0.12), blur: arred(t * 0.35), cor: '#000000', opac: 0.35 } },
      eco: { sombra: { dx: arred(t * 0.08), dy: arred(t * 0.08), blur: 0, cor: c, opac: 0.4 } },
      neon: { sombra: { dx: 0, dy: 0, blur: arred(t * 0.35), cor: c, opac: 1 } },
      contorno: { contorno: { larg: Math.max(1, arred(t * 0.04)), cor: MARCA.preto } },
      vazado: { vazado: true, contorno: { larg: Math.max(1, arred(t * 0.035)), cor: c } },
      destaque: { destaque: { cor: MARCA.dourado, pad: arred(t * 0.25), raio: arred(t * 0.15) } }
    }[nome] || {});
  }
  // Texto curvo: posição e giro de cada letra num arco. curva de -100 a 100 (positivo = arco para cima).
  function curvaLayout(larguras, tam, curva) {
    const L = larguras.reduce(function (s, w) { return s + w; }, 0) || 1, k = Math.max(-100, Math.min(100, Number(curva) || 0));
    const pos = [];
    if (!k) { let cx = 0; larguras.forEach(function (w) { pos.push({ x: cx + w / 2, y: 0, ang: 0 }); cx += w; }); return { R: Infinity, pos: pos, x0: 0, y0: -tam * 0.6, w: L, h: tam * 1.2 }; }
    const th = Math.abs(k) / 100 * 1.9 * Math.PI, R = L / th; let acc = 0;
    larguras.forEach(function (w) {
      const s = (acc + w / 2) / R; acc += w;
      const a = k > 0 ? -Math.PI / 2 - th / 2 + s : Math.PI / 2 + th / 2 - s;
      pos.push({ x: R * Math.cos(a), y: R * Math.sin(a), ang: k > 0 ? a + Math.PI / 2 : a - Math.PI / 2 });
    });
    const m = tam * 0.65; const xs = pos.map(function (p) { return p.x; }), ys = pos.map(function (p) { return p.y; });
    const x0 = Math.min.apply(null, xs) - m, x1 = Math.max.apply(null, xs) + m, y0 = Math.min.apply(null, ys) - m, y1 = Math.max.apply(null, ys) + m;
    return { R: R, pos: pos, x0: x0, y0: y0, w: x1 - x0, h: y1 - y0 };
  }
  // Pincel de estilo: copia a aparência de um elemento para outro (só o que faz sentido no destino).
  const ESTILO = {
    texto: ['fonte', 'tam', 'peso', 'cor', 'alinh', 'italico', 'sublinhado', 'entrelinha', 'espaco', 'maiusc', 'contorno', 'vazado', 'destaque'],
    forma: ['cor', 'grad', 'borda', 'corBorda', 'raio'],
    imagem: ['ajustes', 'filtro', 'raio', 'mascara'],
    comum: ['sombra', 'opac', 'mistura']
  };
  function familia(t) { return t === 'texto' ? 'texto' : t === 'imagem' ? 'imagem' : t === 'grafico' ? 'grafico' : 'forma'; }
  function copiarEstilo(orig, dest) {
    const fo = familia(orig.tipo), fd = familia(dest.tipo); let ch = ESTILO.comum.slice();
    if (fo === fd && ESTILO[fo]) ch = ch.concat(ESTILO[fo]); else if (fd !== 'imagem' && fo !== 'imagem' && orig.cor) ch.push('cor');
    if (dest.tipo === 'linha' || dest.tipo === 'texto') ch = ch.filter(function (k) { return k !== 'grad'; });
    ch.forEach(function (k) { if (orig[k] === undefined) delete dest[k]; else dest[k] = JSON.parse(JSON.stringify(orig[k])); });
    return dest;
  }

  // ---------- grupos e camadas ----------
  function membrosGrupo(lista, idEl) { const x = lista.find(function (e) { return e.id === idEl; }); if (!x || !x.grupo) return [idEl]; return lista.filter(function (e) { return e.grupo === x.grupo; }).map(function (e) { return e.id; }); }
  function agrupar(els) { if (els.length < 2) return null; const g = 'g' + id(); els.forEach(function (e) { e.grupo = g; }); return g; }
  function desagrupar(els) { els.forEach(function (e) { delete e.grupo; }); }
  const NOMES = { texto: 'Texto', ret: 'Retângulo', elipse: 'Elipse', triangulo: 'Triângulo', estrela: 'Estrela', seta: 'Seta', linha: 'Linha', imagem: 'Imagem', poligono: 'Polígono', caminho: 'Forma', grafico: 'Gráfico' };
  function nomeEl(x) { if (x.nome) return x.nome; if (x.tipo === 'texto') return String(x.texto || '').split('\n')[0].slice(0, 32) || 'Texto'; if (x.tipo === 'imagem' && x.mascara) return 'Moldura'; if (x.tipo === 'caminho' && x.forma) { const f = FORMAS.concat(ICONES).find(function (y) { return y.id === x.forma; }); if (f) return f.t; } return NOMES[x.tipo] || x.tipo; }

  // ---------- redimensionamento mágico ----------
  // Copia o design para outro formato: escala tudo pelo menor fator e centraliza; ids novos.
  function redimensionarDesign(d, fmt) {
    const k = Math.min(fmt.w / d.w, fmt.h / d.h), ox = (fmt.w - d.w * k) / 2, oy = (fmt.h - d.h * k) / 2;
    const n = JSON.parse(JSON.stringify(d)); n.id = 'ds' + Date.now().toString(36) + (seq++).toString(36); n.w = fmt.w; n.h = fmt.h; n.formato = fmt.id || 'custom';
    delete n.versoes; const grupos = {};
    n.paginas.forEach(function (p) {
      p.id = id();
      p.elementos.forEach(function (x) {
        x.id = id(); if (x.grupo) x.grupo = grupos[x.grupo] = grupos[x.grupo] || 'g' + id();
        x.x = arred(x.x * k + ox); x.y = arred(x.y * k + oy); x.w = arred(x.w * k); x.h = arred(x.h * k);
        ['tam', 'espaco', 'raio', 'borda'].forEach(function (c) { if (x[c]) x[c] = arred(x[c] * k); });
        if (x.sombra) ['dx', 'dy', 'blur'].forEach(function (c) { x.sombra[c] = arred((x.sombra[c] || 0) * k); });
        if (x.contorno) x.contorno.larg = arred(x.contorno.larg * k);
        if (x.destaque) { x.destaque.pad = arred(x.destaque.pad * k); x.destaque.raio = arred(x.destaque.raio * k); }
      });
    });
    n.criadoEm = n.editadoEm = Date.now(); return n;
  }

  // ---------- kit de marca ----------
  function kitPadrao() { return { cores: [MARCA.preto, MARCA.dourado, MARCA.ouroClaro, MARCA.navy, MARCA.vinho, MARCA.branco], fonteTitulo: 'Montserrat', fonteSub: 'Montserrat', fonteCorpo: 'Montserrat', logos: [] }; }
  // Aplica as fontes da marca em todo o design: negrito vira título, o resto corpo.
  function aplicarKit(paginas, kit) { let n = 0; paginas.forEach(function (p) { p.elementos.forEach(function (x) { if (x.tipo !== 'texto') return; const f = x.peso >= 700 ? kit.fonteTitulo : x.peso >= 600 ? kit.fonteSub : kit.fonteCorpo; if (f && x.fonte !== f) { x.fonte = f; n++; } }); }); return n; }

  // ---------- histórico de versões ----------
  function salvarVersao(d, nome, auto) {
    d.versoes = d.versoes || []; const json = JSON.stringify(d.paginas);
    const ult = d.versoes[d.versoes.length - 1]; if (ult && ult.paginas === json) return null;
    const v = { id: id(), em: Date.now(), nome: nome || '', auto: !!auto, paginas: json }; d.versoes.push(v);
    while (d.versoes.length > 10) { const i = d.versoes.findIndex(function (x) { return x.auto; }); d.versoes.splice(i >= 0 ? i : 0, 1); }
    return v;
  }

  // ---------- gráficos ----------
  function numeroBR(t) { let s = String(t).replace(/[R$\s%]/g, ''); if (/,\d{1,}$/.test(s) || /\.\d{3}(,|$)/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); const n = Number(s); return isFinite(n) ? n : NaN; }
  // "Rótulo; valor" por linha (também aceita ':' ou tab). Ignora linha sem número.
  function lerDados(texto) {
    return String(texto || '').split(/\r?\n/).map(function (l) { const m = /^(.*?)[;\t:]\s*([-R$\s\d.,%]+)\s*$/.exec(l.trim()); if (!m) return null; const v = numeroBR(m[2]); return m[1].trim() && !isNaN(v) ? { r: m[1].trim(), v: v } : null; }).filter(Boolean).slice(0, 24);
  }
  function dadosTexto(dados) { return (dados || []).map(function (d) { return d.r + '; ' + String(d.v).replace('.', ','); }).join('\n'); }
  // Escala "redonda" do eixo: máximo e passo (1, 2, 2,5 ou 5 × 10^n).
  function escalaEixo(max, divisoes) {
    divisoes = divisoes || 4; if (!(max > 0)) return { max: 1, passo: 0.25 };
    const bruto = max / divisoes, p10 = Math.pow(10, Math.floor(Math.log10(bruto)));
    const passo = [1, 2, 2.5, 5, 10].map(function (m) { return m * p10; }).find(function (v) { return v >= bruto; });
    return { max: Math.ceil(max / passo - 1e-9) * passo, passo: passo };
  }
  function formatarValor(v) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }); }

  // ---------- remover fundo de cor uniforme ----------
  // data: RGBA (Uint8ClampedArray). Parte das bordas e apaga a região contínua parecida com a cor dominante da borda.
  function removerFundo(data, w, h, tol) {
    tol = tol == null ? 40 : tol; const borda = [];
    for (let x = 0; x < w; x++) { borda.push(x, (h - 1) * w + x); } for (let y = 0; y < h; y++) { borda.push(y * w, y * w + w - 1); }
    const cont = {}; let ref = null, max = 0;
    borda.forEach(function (i) { const k = (data[i * 4] >> 4) + ',' + (data[i * 4 + 1] >> 4) + ',' + (data[i * 4 + 2] >> 4); cont[k] = (cont[k] || 0) + 1; if (cont[k] > max && data[i * 4 + 3] > 0) { max = cont[k]; ref = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]; } });
    if (!ref) return 0;
    const dist = function (i) { const dr = data[i * 4] - ref[0], dg = data[i * 4 + 1] - ref[1], db = data[i * 4 + 2] - ref[2]; return Math.sqrt(dr * dr + dg * dg + db * db); };
    const visto = new Uint8Array(w * h), fila = []; let n = 0;
    borda.forEach(function (i) { if (!visto[i] && dist(i) <= tol) { visto[i] = 1; fila.push(i); } });
    while (fila.length) {
      const i = fila.pop(); data[i * 4 + 3] = 0; n++;
      const x = i % w, y = (i - x) / w;
      [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1].forEach(function (j) {
        if (j < 0 || visto[j]) return; visto[j] = 1; const d = dist(j);
        if (d <= tol) fila.push(j); else if (d <= tol * 1.6) data[j * 4 + 3] = Math.min(data[j * 4 + 3], Math.round((d - tol) / (tol * 0.6) * 255)); // borda suave
      });
    }
    return n;
  }

  function nomeArquivo(d, ext, pg) { return (String(d.titulo || 'design').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'design') + (pg != null ? '-' + (pg + 1) : '') + '.' + ext; }

  return { MARCA: MARCA, PALETA: PALETA, FONTES: FONTES, FORMATOS: FORMATOS, MODELOS: MODELOS, el: el, pagina: pagina, novoDesign: novoDesign, modelo: modelo,
    redimensionar: redimensionar, angulo: angulo, guias: guias, alinhar: alinhar, distribuir: distribuir, ordem: ordem, selecaoRetangulo: selecaoRetangulo,
    pontosEstrela: pontosEstrela, pontosSeta: pontosSeta, quebrarTexto: quebrarTexto, historico: historico, nomeArquivo: nomeArquivo,
    PESOS: PESOS, CATEGORIA_FONTE: CATEGORIA_FONTE, fontesUrl: fontesUrl, CORES_GRAFICO: CORES_GRAFICO, GRADIENTES: GRADIENTES, FORMAS: FORMAS, ICONES: ICONES, MOLDURAS: MOLDURAS, FILTROS: FILTROS, AJUSTES: AJUSTES, MISTURAS: MISTURAS,
    gradLinha: gradLinha, gradRaio: gradRaio, gradCss: gradCss, corCss: corCss, pontosPoligono: pontosPoligono, tracos: tracos, mascaraPontos: mascaraPontos, clipCss: clipCss,
    ajustesDe: ajustesDe, filtroCss: filtroCss, recorte: recorte, rgba: rgba, efeitoTexto: efeitoTexto, curvaLayout: curvaLayout, copiarEstilo: copiarEstilo,
    membrosGrupo: membrosGrupo, agrupar: agrupar, desagrupar: desagrupar, nomeEl: nomeEl, redimensionarDesign: redimensionarDesign, kitPadrao: kitPadrao, aplicarKit: aplicarKit,
    salvarVersao: salvarVersao, icone: icone, forma: forma, lerDados: lerDados, dadosTexto: dadosTexto, escalaEixo: escalaEixo, formatarValor: formatarValor, removerFundo: removerFundo };
});
