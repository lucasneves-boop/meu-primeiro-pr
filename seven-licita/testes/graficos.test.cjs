const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/graficos.js');

test('escala redonda e rótulos compactos', () => {
  assert.deepEqual(G.escala(87), { max: 100, marcas: [0, 25, 50, 75, 100] });
  assert.deepEqual(G.escala(7).marcas, [0, 2, 4, 6, 8]);
  assert.equal(G.escala(0).max, 1);
  assert.equal(G.compacto(1250), '1,3 mil'); assert.equal(G.compacto(48000), '48 mil'); assert.equal(G.compacto(3400000), '3,4 mi'); assert.equal(G.compacto(2.5), '2,5');
});

test('colunas: uma barra por item, base reta, dica e só o maior com valor escrito', () => {
  const s = G.colunas([{ r: 'jan', v: 10 }, { r: 'fev', v: 40 }, { r: 'mar', v: 0 }], { largura: 300, altura: 160, fmt: v => v + ' un' });
  assert.equal((s.match(/class="gf-m gf-c1"/g) || []).length, 2, 'barra de valor zero não é desenhada');
  assert.equal((s.match(/class="gf-valor"/g) || []).length, 1); assert.match(s, />40 un</);
  assert.match(s, /data-dica="fev: 40 un"/); assert.match(s, /role="img"/);
  assert.match(G.colunas([], {}), /Sem dados no período/);
});

test('barras horizontais, agrupadas e linha com referência e lacunas', () => {
  const b = G.barras([{ r: 'Lead', v: 4 }, { r: 'Ganho', v: 1, rotuloValor: '1 · R$ 3 mil' }]);
  assert.match(b, /Lead/); assert.match(b, /1 · R\$ 3 mil/);
  const a = G.agrupadas(['jan', 'fev'], [{ nome: 'Receitas', valores: [100, 200] }, { nome: 'Despesas', valores: [50, 0] }]);
  assert.equal((a.match(/gf-m gf-c1/g) || []).length, 2); assert.equal((a.match(/gf-m gf-c2/g) || []).length, 1);
  assert.match(a, /fev · Receitas: 200 · Despesas: 0/);
  const l = G.linha(['S1', 'S2', 'S3', 'S4'], [{ nome: 'Execução', valores: [80, null, 90, 70] }], { ref: 85, refRotulo: '85%' });
  assert.match(l, /class="gf-ref"/); assert.match(l, />85%</);
  const d = l.match(/class="gf-linha gf-c1" d="([^"]+)"/)[1]; assert.equal((d.match(/M/g) || []).length, 2, 'lacuna quebra a linha');
});

test('rosca: até 6 fatias (resto em Outros), total no centro, legenda com valor e percentual', () => {
  const f = [1, 2, 3, 4, 5, 6, 7, 8].map((v, i) => ({ r: 'C' + i, v }));
  const g = G.agruparOutros(f); assert.equal(g.length, 6); assert.equal(g[5].r, 'Outros'); assert.equal(g[5].v, 1 + 2 + 3);
  const s = G.rosca([{ r: 'A', v: 3 }, { r: 'B', v: 1 }, { r: 'Z', v: 0 }]);
  assert.equal((s.match(/gf-fatia/g) || []).length, 2); assert.match(s, /data-dica="A: 3 \(75%\)"/); assert.match(s, /class="gf-total"[^>]*>4</);
  assert.match(G.rosca([{ r: 'Só', v: 5 }]), /<circle class="gf-m gf-c1"/);
  const leg = G.legenda([{ r: 'A', v: 3 }, { r: 'B', v: 1 }]); assert.match(leg, /<span>A<\/span><b>3 <small>75%<\/small><\/b>/);
  assert.match(G.sparkline([1, 3, 2]), /gf-spark/); assert.equal(G.sparkline([1]), '');
  assert.match(G.tabela(['Mês', 'Valor'], [['jan', '10']]), /<td class="n">10<\/td>/);
});
