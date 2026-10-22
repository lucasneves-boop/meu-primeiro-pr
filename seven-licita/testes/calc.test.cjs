const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/calc.js');
const perto = (a, b, t) => assert.ok(Math.abs(a - b) < (t || 1e-9), a + ' ≈ ' + b);

test('expressões: precedência, potência à direita, parênteses, implícita', () => {
  assert.equal(C.avaliar('2+3*4'), 14);
  assert.equal(C.avaliar('(2+3)*4'), 20);
  assert.equal(C.avaliar('2^3^2'), 512);
  assert.equal(C.avaliar('-2^2'), -4);
  assert.equal(C.avaliar('2π'), C.avaliar('2*pi'));
  assert.equal(C.avaliar('10÷4'), 2.5);
  assert.equal(C.avaliar('1,5 + 1.000,5'), 1002);
  assert.equal(C.avaliar('5!'), 120);
  assert.equal(C.avaliar('√16 + 3(2)'), 10);
  assert.equal(C.avaliar('(1+2'), 3);
});

test('expressões: porcentagem estilo calculadora e funções', () => {
  assert.equal(C.avaliar('200+10%'), 220);
  assert.equal(C.avaliar('200-10%'), 180);
  assert.equal(C.avaliar('50%'), 0.5);
  assert.equal(C.avaliar('200*10%'), 20);
  assert.equal(C.avaliar('sin(30)', { angulo: 'grau' }), 0.5);
  assert.equal(C.avaliar('cos(pi)'), -1);
  assert.equal(C.avaliar('log(1000)'), 3);
  assert.equal(C.avaliar('ln(e)'), 1);
  assert.equal(C.avaliar('ans*2', { ans: 21 }), 42);
  assert.equal(C.avaliar('0,1+0,2'), 0.3);
  assert.throws(() => C.avaliar('1/0'), /zero/);
  assert.throws(() => C.avaliar('2+*3'), /inválida/);
  assert.throws(() => C.avaliar('alert(1)'), /desconhecida/);
});

test('Páscoa e feriados nacionais', () => {
  assert.equal(C.iso(C.pascoa(2026)), '2026-04-05');
  assert.equal(C.iso(C.pascoa(2027)), '2027-03-28');
  const f = C.feriados(2026, true);
  assert.equal(f['2026-04-03'], 'Sexta-feira Santa');
  assert.ok(f['2026-11-20']);
  assert.match(f['2026-02-16'], /Carnaval/);
  assert.match(f['2026-06-04'], /Corpus/);
});

test('dias úteis: soma e diferença (prazo de licitação)', () => {
  // sexta 30/10/2026 + 3 úteis: seg 02/11 é Finados → ter 03, qua 04, qui 05
  assert.equal(C.somar('2026-10-30', 3, true), '2026-11-05');
  assert.equal(C.somar('2026-10-21', 10, false), '2026-10-31');
  assert.equal(C.somar('2026-11-05', -3, true), '2026-10-30');
  const d = C.diferenca('2026-01-01', '2026-12-31');
  assert.equal(d.dias, 364); assert.equal(d.anos, 0); assert.equal(d.meses, 11); assert.equal(d.diasResto, 30);
  assert.equal(C.diferenca('2026-10-19', '2026-10-23').uteis, 4);
  assert.equal(C.somar('2026-10-30', 1, true, { extras: ['2026-11-03'] }), '2026-11-04');
});

test('idade e próximo aniversário', () => {
  const i = C.idade('1990-12-25', '2026-10-21');
  assert.equal(i.anos, 35); assert.equal(i.proximoAniversario, '2026-12-25'); assert.equal(i.faltam, 65);
});

test('juros, taxa equivalente, Price e SAC', () => {
  perto(C.jurosCompostos(1000, 1, 12).montante, 1126.825030131, 1e-6);
  perto(C.jurosSimples(1000, 1, 12).montante, 1120);
  perto(C.taxaEquivalente(1, 1, 12), 12.682503013, 1e-6);
  const p = C.price(10000, 1, 12); perto(p.parcela, 888.4878867, 1e-6); perto(p.tabela[11].saldo, 0, 1e-6);
  const s = C.sac(12000, 1, 12); perto(s.primeira, 1120); perto(s.ultima, 1010); perto(s.juros, 780, 1e-6);
});

test('matemática: mdc, mmc, primos, frações, romanos, Bhaskara, estatística, horas, bases', () => {
  assert.equal(C.mdc(84, 36), 12); assert.equal(C.mmc(4, 6), 12);
  assert.deepEqual(C.fatorar(360), [2, 2, 2, 3, 3, 5]); assert.equal(C.ehPrimo(97), true);
  assert.deepEqual(C.opFracao({ n: 1, d: 2 }, '+', { n: 1, d: 3 }), { n: 5, d: 6 });
  assert.deepEqual(C.decimalParaFracao(0.75), { n: 3, d: 4 });
  assert.equal(C.romano(2026), 'MMXXVI'); assert.equal(C.deRomano('MCMXC'), 1990); assert.equal(C.deRomano('IIII'), null);
  assert.deepEqual(C.bhaskara(1, -5, 6).reais, [3, 2]);
  const e = C.estatistica([2, 4, 4, 4, 5, 5, 7, 9]); assert.equal(e.media, 5); assert.equal(e.mediana, 4.5); assert.deepEqual(e.moda, [4]); assert.equal(e.desvioPop, 2);
  assert.equal(C.minParaHoras(C.horasParaMin('7:45') + C.horasParaMin('1:30')), '9:15');
  assert.equal(C.base('255', 10, 16), 'FF'); assert.equal(C.base('1010', 2, 10), '10');
});

test('conversões de unidade e temperatura', () => {
  perto(C.converter('comprimento', 1, 'mi', 'km'), 1.609344);
  perto(C.converter('temperatura', 100, '°C', '°F'), 212);
  perto(C.converter('temperatura', 0, 'K', '°C'), -273.15);
  perto(C.converter('area', 1, 'alqueire', 'ha'), 2.42);
  perto(C.converter('dados', 1, 'GB', 'MB'), 1024);
});

test('tags ID3v2.3 do MP3 e nome de arquivo', () => {
  const P = require('../js/player.js');
  const frame = (id, txt) => { const body = Buffer.concat([Buffer.from([3]), Buffer.from(txt, 'utf8')]); const h = Buffer.alloc(10); h.write(id, 0); h.writeUInt32BE(body.length, 4); return Buffer.concat([h, body]); };
  const frames = Buffer.concat([frame('TIT2', 'Concentração'), frame('TPE1', 'Seven Band'), frame('TALB', 'Licitações')]);
  const s = frames.length; const head = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, (s >> 21) & 0x7f, (s >> 14) & 0x7f, (s >> 7) & 0x7f, s & 0x7f]);
  const buf = Buffer.concat([head, frames]); const r = P.lerID3(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
  assert.deepEqual([r.titulo, r.artista, r.album], ['Concentração', 'Seven Band', 'Licitações']);
  assert.deepEqual(P.doNome('Artista Bom - Música Boa.mp3'), { artista: 'Artista Bom', titulo: 'Música Boa' });
});

test('custo de viagem: ida e volta, pedágio nos dois sentidos, paradas e tempo', () => {
  const r = C.viagem({ km: 250, idaVolta: true, extraKm: 20, consumo: 10, preco: 6, pedagios: 20, estacionamento: 30, diarias: 1, valorDiaria: 180, pessoas: 2, velocidade: 80, tanque: 40 });
  assert.equal(r.km, 520); perto(r.litros, 52); perto(r.combustivel, 312); assert.equal(r.pedagios, 40); assert.equal(r.hospedagem, 180);
  perto(r.total, 562); perto(r.porPessoa, 281); perto(r.horas, 6.5);
  assert.equal(r.autonomia, 340); assert.equal(r.paradas, 1);
  assert.equal(C.viagem({ km: 0, consumo: 10 }), null);
  assert.equal(C.viagem({ km: 100, consumo: 10, preco: 5 }).paradas, null);
});
