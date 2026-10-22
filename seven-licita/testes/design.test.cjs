const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/design.js');

test('modelos: todos carregam, cabem na página e não inventam site', () => {
  D.MODELOS.forEach(m => {
    const d = D.modelo(m.id); assert.ok(d, m.id);
    assert.equal(d.formato, m.formato);
    const txt = JSON.stringify(d);
    assert.doesNotMatch(txt, /www\.|https?:\/\/|\.com\.br/, m.id + ' sem link');
    d.paginas.forEach(p => p.elementos.forEach(e => { assert.ok(e.x + e.w > 0 && e.x < d.w + 1 && e.y < d.h + 1, m.id + ' ' + e.id); }));
  });
  assert.match(JSON.stringify(D.modelo('cartao')), /\(61\) 98347-2232/);
  assert.equal(new Set(D.modelo('apresentacao').paginas[1].elementos.map(e => e.id)).size, 17, 'ids únicos');
});

test('redimensionar pelas alças, com proporção e mínimo', () => {
  const o = { x: 100, y: 100, w: 200, h: 100 };
  assert.deepEqual(D.redimensionar(o, 'se', 50, 20), { x: 100, y: 100, w: 250, h: 120 });
  assert.deepEqual(D.redimensionar(o, 'nw', 20, 10), { x: 120, y: 110, w: 180, h: 90 });
  assert.deepEqual(D.redimensionar(o, 'se', 100, 0, true), { x: 100, y: 100, w: 300, h: 150 });
  assert.deepEqual(D.redimensionar(o, 'nw', -100, 0, true), { x: 0, y: 50, w: 300, h: 150 });
  assert.equal(D.redimensionar(o, 'e', -500, 0).w, 10);
});

test('ângulo com passo e guias magnéticas', () => {
  assert.equal(D.angulo(0, 0, 10, 0), 90); assert.equal(D.angulo(0, 0, 0, -10), 0); assert.equal(D.angulo(0, 0, 10, -9, 45), 45);
  const g = D.guias({ x: 437, y: 10, w: 200, h: 100 }, [], 1080, 1080);
  assert.equal(g.x, 440); assert.deepEqual(g.linhas[0], { eixo: 'x', v: 540 });
  const g2 = D.guias({ x: 503, y: 0, w: 100, h: 100 }, [{ x: 100, y: 300, w: 400, h: 50 }], 1080, 1080);
  assert.equal(g2.x, 500);
});

test('alinhar, distribuir, ordem e seleção por área', () => {
  const a = { id: 'a', x: 10, y: 0, w: 100, h: 50 }, b = { id: 'b', x: 300, y: 80, w: 50, h: 50 }, c = { id: 'c', x: 120, y: 20, w: 50, h: 10 };
  D.alinhar([a], 'centro-h', 1000, 500); assert.equal(a.x, 450);
  a.x = 10; D.alinhar([a, b], 'topo'); assert.equal(b.y, 0);
  D.alinhar([a, b], 'direita'); assert.equal(a.x, 250);
  a.x = 0; b.x = 400; c.x = 300; D.distribuir([a, b, c], 'h'); assert.equal(c.x, 225); assert.equal(b.x, 400);
  const l = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(D.ordem(l, 'a', 'frente').map(e => e.id), ['b', 'c', 'a']);
  assert.deepEqual(D.ordem(l, 'a', 'descer').map(e => e.id), ['b', 'a', 'c']);
  assert.deepEqual(D.selecaoRetangulo([a, b], { x1: -5, y1: -5, x2: 60, y2: 60 }), ['a']);
});

test('quebra de texto por largura, com \\n e palavra longa', () => {
  const medir = t => t.length * 10;
  assert.deepEqual(D.quebrarTexto('Pregão eletrônico para material', 120, medir), ['Pregão', 'eletrônico', 'para', 'material']);
  assert.deepEqual(D.quebrarTexto('ab cd ef\ngh', 50, medir), ['ab cd', 'ef', 'gh']);
  assert.deepEqual(D.quebrarTexto('abcdefghij', 40, medir), ['abcd', 'efgh', 'ij']);
});

test('histórico desfaz e refaz; formas', () => {
  const h = D.historico(); h.registrar({ v: 1 }); h.registrar({ v: 2 }); h.registrar({ v: 2 }); h.registrar({ v: 3 });
  assert.deepEqual(h.desfazer(), { v: 2 }); assert.deepEqual(h.desfazer(), { v: 1 }); assert.equal(h.desfazer(), null);
  assert.deepEqual(h.refazer(), { v: 2 });
  assert.equal(D.pontosEstrela(100, 100, 5).length, 10); assert.deepEqual(D.pontosEstrela(100, 100)[0], [50, 0]);
  assert.equal(D.pontosSeta(200, 50).length, 7);
  assert.equal(D.nomeArquivo({ titulo: 'Post: edital?' }, 'png', 0), 'Post edital-1.png');
});

test('gradiente segue a geometria do CSS (0° = para cima, 90° = para a direita)', () => {
  assert.deepEqual(D.gradLinha(100, 50, 90), { x1: 0, y1: 25, x2: 100, y2: 25 });
  assert.deepEqual(D.gradLinha(100, 50, 0), { x1: 50, y1: 50, x2: 50, y2: 0 });
  const g = D.gradLinha(100, 100, 45); assert.ok(Math.abs(g.x2 - 100) < 0.2 && Math.abs(g.y2) < 0.2, 'diagonal até o canto');
  assert.equal(D.gradCss({ tipo: 'linear', c1: '#000', c2: '#fff', ang: 135 }), 'linear-gradient(135deg, #000, #fff)');
  assert.match(D.corCss({ cor: '#b68d40' }), /^#b68d40$/);
  assert.equal(D.gradRaio(30, 40), 25);
});

test('formas: polígonos regulares, traços de linha, molduras e ícones válidos', () => {
  const hx = D.pontosPoligono(100, 100, 6); assert.equal(hx.length, 6); assert.deepEqual(hx[0], [50, 0]);
  hx.forEach(p => assert.ok(p[0] >= 0 && p[0] <= 100 && p[1] >= 0 && p[1] <= 100));
  assert.equal(D.pontosPoligono(80, 80, 4).length, 4);
  assert.deepEqual(D.tracos(100, 4, 'solido'), [[0, 100]]);
  const tr = D.tracos(100, 4, 'tracejado'); assert.deepEqual(tr[0], [0, 12]); assert.ok(tr.every(s => s[1] <= 100));
  assert.equal(D.clipCss('circulo'), 'ellipse(50% 50% at 50% 50%)');
  assert.match(D.clipCss('hexagono'), /^polygon\(50% 0%/);
  assert.equal(D.clipCss('nada'), '');
  D.ICONES.concat(D.FORMAS).forEach(i => assert.match(i.d, /^M[\d. ,a-zA-Z-]+$/, i.id));
  assert.equal(new Set(D.ICONES.map(i => i.id)).size, D.ICONES.length);
  const ic = D.icone('martelo', { w: 50 }); assert.equal(ic.tipo, 'caminho'); assert.deepEqual(ic.vb, [24, 24]); assert.ok(ic.prop);
});

test('fotos: filtro CSS, recorte com zoom e ponto focal', () => {
  assert.equal(D.filtroCss({}), 'none');
  assert.equal(D.filtroCss({ brilho: 120, pb: 100, desfoque: 2 }, 2), 'brightness(120%) grayscale(100%) blur(4px)');
  const r = D.recorte(2000, 1000, 100, 100, 'cover', 1, 0.5, 0.5); assert.deepEqual(r, { sx: 500, sy: 0, sw: 1000, sh: 1000, dx: 0, dy: 0, dw: 100, dh: 100 });
  const z = D.recorte(2000, 1000, 100, 100, 'cover', 2, 0, 0); assert.deepEqual([z.sx, z.sy, z.sw, z.sh], [0, 0, 500, 500]);
  const c = D.recorte(2000, 1000, 100, 100, 'contain'); assert.deepEqual([c.dx, c.dy, c.dw, c.dh], [0, 25, 100, 50]);
  assert.ok(D.FILTROS.some(f => f.id === 'pb')); assert.equal(D.rgba('#ff0000', 0.5), 'rgba(255,0,0,0.5)');
});

test('efeitos de texto e texto curvo', () => {
  const x = { tam: 100, cor: '#b68d40' };
  const neon = D.efeitoTexto('neon', x); assert.equal(neon.sombra.cor, '#b68d40'); assert.equal(neon.sombra.dx, 0); assert.equal(neon.contorno, null);
  const vz = D.efeitoTexto('vazado', x); assert.equal(vz.vazado, true); assert.ok(vz.contorno.larg > 0);
  assert.deepEqual(D.efeitoTexto('nenhum', x), { sombra: null, contorno: null, vazado: false, destaque: null });
  const reto = D.curvaLayout([10, 10, 10], 20, 0); assert.equal(reto.w, 30); assert.deepEqual(reto.pos.map(p => p.x), [5, 15, 25]);
  const arco = D.curvaLayout(Array(10).fill(10), 20, 50); const meio = arco.pos[4].x + arco.pos[5].x;
  assert.ok(Math.abs(meio) < 1e-6, 'arco simétrico'); assert.ok(arco.pos[0].y > arco.pos[4].y, 'pontas abaixo do meio (arco para cima)');
  const baixo = D.curvaLayout(Array(10).fill(10), 20, -50); assert.ok(baixo.pos[0].y < baixo.pos[4].y, 'pontas acima do meio (arco para baixo)');
  assert.ok(Math.abs(arco.R - 100 / (0.5 * 1.9 * Math.PI)) < 1e-9);
});

test('pincel de estilo copia só o que cabe no destino', () => {
  const t1 = { tipo: 'texto', fonte: 'Lora', tam: 40, cor: '#800000', sombra: { dx: 1 }, contorno: { larg: 2, cor: '#000' } };
  const t2 = { tipo: 'texto', fonte: 'Inter', tam: 10, texto: 'oi' }; D.copiarEstilo(t1, t2);
  assert.equal(t2.fonte, 'Lora'); assert.equal(t2.texto, 'oi'); assert.deepEqual(t2.contorno, { larg: 2, cor: '#000' }); assert.notEqual(t2.sombra, t1.sombra);
  const f = { tipo: 'ret', cor: '#fff', grad: { tipo: 'linear' }, raio: 9 }; D.copiarEstilo(t1, f);
  assert.equal(f.cor, '#800000'); assert.equal(f.raio, 9); assert.ok(f.grad, 'gradiente do destino fica (texto não tem)'); assert.equal(f.fonte, undefined);
  const im = { tipo: 'imagem', arq: 'a', ajustes: { pb: 100 } }; D.copiarEstilo({ tipo: 'imagem', mascara: 'circulo' }, im);
  assert.equal(im.mascara, 'circulo'); assert.equal(im.ajustes, undefined); assert.equal(im.arq, 'a');
});

test('grupos, nomes de camadas e kit de marca', () => {
  const l = [{ id: 'a', tipo: 'ret' }, { id: 'b', tipo: 'texto', texto: 'Pregão 9/2026\nlinha 2' }, { id: 'c', tipo: 'elipse' }];
  assert.deepEqual(D.membrosGrupo(l, 'a'), ['a']);
  const g = D.agrupar([l[0], l[2]]); assert.ok(g); assert.deepEqual(D.membrosGrupo(l, 'c'), ['a', 'c']);
  assert.equal(D.agrupar([l[1]]), null); D.desagrupar([l[0], l[2]]); assert.deepEqual(D.membrosGrupo(l, 'a'), ['a']);
  assert.equal(D.nomeEl(l[1]), 'Pregão 9/2026'); assert.equal(D.nomeEl({ tipo: 'caminho', forma: 'martelo' }), 'Pregão'); assert.equal(D.nomeEl({ tipo: 'imagem', mascara: 'circulo' }), 'Moldura');
  const pg = [{ elementos: [{ tipo: 'texto', peso: 800, fonte: 'X' }, { tipo: 'texto', peso: 400, fonte: 'X' }, { tipo: 'ret' }] }];
  assert.equal(D.aplicarKit(pg, { fonteTitulo: 'Lora', fonteSub: 'Inter', fonteCorpo: 'Lato' }), 2);
  assert.equal(pg[0].elementos[0].fonte, 'Lora'); assert.equal(pg[0].elementos[1].fonte, 'Lato');
  assert.ok(D.kitPadrao().cores.includes('#800000'));
});

test('redimensionamento mágico escala, centraliza e troca os ids', () => {
  const d = D.novoDesign('post'); d.paginas[0].elementos = [D.el('texto', { x: 0, y: 0, w: 1080, h: 100, tam: 50, sombra: { dx: 10, dy: 10, blur: 20 } }), D.el('ret', { x: 540, y: 540, w: 100, h: 100, grupo: 'g1' }), D.el('elipse', { grupo: 'g1' })];
  const n = D.redimensionarDesign(d, D.FORMATOS.find(f => f.id === 'story'));
  assert.equal(n.w, 1080); assert.equal(n.h, 1920); assert.notEqual(n.id, d.id);
  const t = n.paginas[0].elementos[0]; assert.equal(t.y, 420); assert.equal(t.tam, 50); assert.notEqual(t.id, d.paginas[0].elementos[0].id);
  const l = D.redimensionarDesign(d, { id: 'x', w: 540, h: 540 }); assert.equal(l.paginas[0].elementos[0].tam, 25); assert.equal(l.paginas[0].elementos[0].sombra.blur, 10);
  const gs = l.paginas[0].elementos.map(e => e.grupo); assert.ok(gs[1] && gs[1] === gs[2] && gs[1] !== 'g1', 'grupo preservado com id novo');
  assert.equal(d.paginas[0].elementos[0].tam, 50, 'original intacto');
});

test('versões: só guarda quando muda e mantém no máximo 10', () => {
  const d = D.novoDesign('post');
  assert.ok(D.salvarVersao(d, 'v1')); assert.equal(D.salvarVersao(d, 'igual'), null);
  for (let i = 0; i < 15; i++) { d.paginas[0].fundo = '#' + String(i).padStart(6, '0'); D.salvarVersao(d, '', i % 2 === 0); }
  assert.equal(d.versoes.length, 10); assert.ok(d.versoes.some(v => v.nome === 'v1'), 'versões com nome sobrevivem às automáticas');
});

test('gráficos: leitura de dados em formato brasileiro e escala do eixo', () => {
  assert.deepEqual(D.lerDados('Janeiro; 1.234,56\nFevereiro: 10\nMarço\t2,5\nsem número\n; 4'), [{ r: 'Janeiro', v: 1234.56 }, { r: 'Fevereiro', v: 10 }, { r: 'Março', v: 2.5 }]);
  assert.deepEqual(D.lerDados('Desconto; 12%'), [{ r: 'Desconto', v: 12 }]);
  assert.deepEqual(D.lerDados('Valor; R$ 2.500'), [{ r: 'Valor', v: 2500 }]);
  assert.equal(D.dadosTexto([{ r: 'A', v: 1.5 }]), 'A; 1,5');
  assert.deepEqual(D.escalaEixo(24), { max: 30, passo: 10 }); assert.deepEqual(D.escalaEixo(9), { max: 10, passo: 2.5 }); assert.deepEqual(D.escalaEixo(0), { max: 1, passo: 0.25 });
});

test('remover fundo: apaga a cor uniforme das bordas e preserva o centro', () => {
  const w = 10, h = 10, data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const x = i % w, y = Math.floor(i / w); const centro = x >= 3 && x <= 6 && y >= 3 && y <= 6; data.set(centro ? [10, 20, 200, 255] : [250, 250, 248, 255], i * 4); }
  const n = D.removerFundo(data, w, h, 30);
  assert.equal(n, 84); assert.equal(data[3], 0); assert.equal(data[(5 * w + 5) * 4 + 3], 255);
});

test('fontes do Google: URL sem pesos inexistentes', () => {
  const u = D.fontesUrl(); assert.match(u, /family=Bebas\+Neue&/); assert.match(u, /family=Inter:wght@400;500;600;700;800/); assert.doesNotMatch(u, /Montserrat/);
  assert.ok(D.FONTES.length >= 20); assert.ok(D.MODELOS.length >= 10);
});
