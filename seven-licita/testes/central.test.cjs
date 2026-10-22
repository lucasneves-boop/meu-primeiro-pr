const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/central.js');

test('consulta por palavras: ";" separa alternativas, só "-" exclui ("sem fio" é produto), palavras curtas inteiras', () => {
  assert.deepEqual(C.lerConsulta('papel a4; sulfite; -reciclado; - colorido'), { incluir: ['papel a4', 'sulfite'], excluir: ['reciclado', 'colorido'] });
  assert.deepEqual(C.lerConsulta('mouse; sem fio; não tecido'), { incluir: ['mouse', 'sem fio', 'nao tecido'], excluir: [] });
  assert.equal(C.casaConsulta('Aquisição de PAPEL A4 branco', 'papel a4; sulfite; -reciclado'), true);
  assert.equal(C.casaConsulta('Papel sulfite reciclado', 'papel a4; sulfite; -reciclado'), false);
  assert.equal(C.casaConsulta('Material de limpeza', 'papel a4; sulfite'), false);
  assert.equal(C.casaConsulta('Papel A40 especial', 'papel a4'), false, 'a4 não casa dentro de a40');
  assert.equal(C.casaConsulta('Qualquer coisa', '-uniforme'), true);
});

test('filtro avançado: faixa de valor, sigiloso, ME/EPP, SRP e órgão', () => {
  const A = [
    { id: 1, objeto: 'Uniformes escolares', orgao: 'Prefeitura de Catalão', cnpj: '01505643000150', uf: 'GO', valorEstimado: 80000, meEpp: 'Exclusivo ME/EPP', srp: true },
    { id: 2, objeto: 'Papel A4', orgao: 'Secretaria de Saúde', uf: 'DF', valorEstimado: 300000, meEpp: '', srp: false },
    { id: 3, objeto: 'Notebooks', orgao: 'Universidade Federal', uf: 'GO', valorEstimado: 0, meEpp: 'Parcial ME/EPP' }
  ];
  const ids = f => C.filtrarAvisos(A, f).map(a => a.id);
  assert.deepEqual(ids({ valorMin: '50.000,00', valorMax: '100 mil'.replace(' mil', '000') }), [1]);
  assert.deepEqual(ids({ sigiloso: true }), [3]);
  assert.deepEqual(ids({ meEpp: 'exclusivo' }), [1]); assert.deepEqual(ids({ meEpp: 'com' }), [1, 3]); assert.deepEqual(ids({ meEpp: 'sem' }), [2]);
  assert.deepEqual(ids({ srp: 'sem' }), [2, 3]); assert.deepEqual(ids({ srp: 'so' }), [1]);
  assert.deepEqual(ids({ orgao: 'catalao' }), [1]); assert.deepEqual(ids({ orgao: '01505643' }), [1]);
  assert.deepEqual(ids({ texto: 'papel; notebook', uf: 'GO' }), [3]);
});

test('notificações: prioridade, janela de tempo, ids estáveis e lidas', () => {
  const agora = new Date('2026-10-22T10:00:00').getTime();
  const n = C.notificacoes({
    avisosNovos: [{ id: 'a1', objeto: 'Papel', capturadoEm: '2026-10-22T07:00:00' }],
    sessoes: [{ id: 's1', quando: '2026-10-22T15:00:00', titulo: 'PE 12/2026' }, { id: 's2', quando: '2026-10-30T09:00:00', titulo: 'longe' }],
    prazos: [{ id: 'p1', quando: '2026-10-21T18:00:00', titulo: 'Recurso', tipo: 'Recurso' }],
    documentos: [{ id: 'd1', nome: 'CNDT', validade: '2026-10-25' }, { id: 'd2', nome: 'FGTS', validade: '2026-12-25' }],
    atividades: [{ id: 'at1', titulo: 'Ligar', atrasada: true, quando: '2026-10-20' }]
  }, agora);
  assert.deepEqual(n.map(x => x.tipo), ['prazo', 'sessao', 'documento', 'comercial', 'avisos']);
  assert.equal(n[0].titulo, 'Prazo do pregoeiro vencido'); assert.equal(n[1].titulo, 'Sessão em menos de 24 h'); assert.match(n[2].titulo, /vence em 3 dia/);
  const lidas = { [n[0].id]: 1, 'velho:1': 1 };
  assert.equal(C.naoLidas(n, lidas).length, 4); assert.deepEqual(Object.keys(C.podarLidas(lidas, n)), [n[0].id]);
});

test('carteira do BPO e escala de sessões com horário da Seven', () => {
  const agora = new Date('2026-10-22T10:00:00').getTime();
  const d = {
    empresas: [{ id: 'e1', razao: 'Alfa LTDA', fantasia: 'Alfa', responsavel: 'Ana' }, { id: 'e2', razao: 'Beta' }],
    perfis: [{ id: 'pf1', empresaId: 'e1' }],
    avisos: { x: { id: 'x', perfis: ['pf1'], lido: false }, y: { id: 'y', perfis: ['pf1'], lido: true } },
    propostas: [{ id: 'p1', empresaId: 'e1', status: 'pronta', encerramento: '2026-10-24T09:30:00', modalidade: 'Pregão', numero: '12/2026', orgao: 'Prefeitura' }, { id: 'p2', empresaId: 'e1', status: 'vencida' }, { id: 'p3', empresaId: 'e1', status: 'perdida' }, { id: 'p4', empresaId: 'e2', status: 'rascunho', encerramento: '2026-10-25T14:00:00', responsavel: 'Rui' }],
    monitor: [{ id: 'm1', empresaId: 'e2', prazos: [{ ate: '2026-10-21T10:00:00' }], sessao: '2026-10-23T20:00:00', titulo: 'PE 99/2026' }],
    documentos: [{ empresaId: 'e1', validade: '2026-10-25' }, { empresaId: 'e2', validade: '2026-10-01' }],
    disputas: [{ empresaId: 'e2', itens: [{ limite: null }] }]
  };
  const [a, b] = C.carteira(d, agora);
  assert.deepEqual([a.avisosNovos, a.emPreparo, a.sessoes7, a.docsVencendo, a.taxaVitoria, a.situacao, a.responsavel], [1, 1, 1, 1, 0.5, 'acompanhar', 'Ana']);
  assert.deepEqual([b.docsVencidos, b.disputasSemLimite, b.prazosAbertos, b.alertas, b.situacao], [1, 1, 1, 3, 'atencao']);
  const esc = C.escala(d, agora, 14);
  assert.deepEqual(esc.map(x => [x.id, x.responsavel, x.foraHorario]), [['mon:m1', '', true], ['prop:p1', 'Ana', false], ['prop:p4', 'Rui', true]]);
  assert.equal(C.horarioSeven('2026-10-24T11:00:00'), true); assert.equal(C.horarioSeven('2026-10-24T13:00:00'), false); assert.equal(C.horarioSeven('2026-10-25T10:00:00'), false);
});

test('órgãos: junta avisos, propostas, monitor, favoritos, CAPAG e atraso de pagamento', () => {
  const futuro = new Date(Date.now() + 5 * 864e5).toISOString();
  const d = {
    avisos: { a: { id: 'a', cnpj: '01.505.643/0001-50', orgao: 'Prefeitura de Catalão', uf: 'GO', municipio: 'Catalão', esfera: 'M', ibge: '5205109', valorEstimado: 1000, encerramento: futuro, publicacao: '2026-10-01' }, b: { id: 'b', cnpj: '01505643000150', orgao: 'Prefeitura de Catalão', valorEstimado: 500, publicacao: '2026-09-01' }, c: { id: 'c', cnpj: '00394460000141', orgao: 'Ministério X', uf: 'DF', esfera: 'F' } },
    propostas: [{ ref: { cnpj: '01505643000150' }, status: 'vencida' }], monitor: [{ avisoId: 'a' }], orgaosFavoritos: ['00394460000141'],
    config: { capag: { 5205109: { nota: 'B+' } } }
  };
  const l = C.orgaos(d, [{ orgao: 'Prefeitura de Catalão', media: 12.4, aberto: 3000 }]);
  assert.equal(l[0].nome, 'Ministério X'); assert.equal(l[0].favorito, true); assert.equal(l[0].capag, null);
  const cat = l[1]; assert.deepEqual([cat.avisos, cat.abertos, cat.valor, cat.propostas, cat.ganhas, cat.monitorados, cat.capag, cat.atrasoMedio, cat.ultima], [2, 1, 1500, 1, 1, 1, 'B+', 12, '2026-10-01']);
});

test('busca inteligente: qualquer ordem, plural e singular, começo de palavra', () => {
  assert.equal(C.casaConsultaInteligente('Aquisição de uniformes para uso escolar', 'uniforme escolar'), true);
  assert.equal(C.casaConsulta('Uniforme escolar', 'uniformes escolares'), false, 'a busca normal não troca plural por singular'); assert.equal(C.casaConsultaInteligente('Uniforme escolar', 'uniformes escolares'), true);
  assert.equal(C.casaConsultaInteligente('Notebooks e monitores', 'notebook; impressora'), true);
  assert.equal(C.casaConsultaInteligente('Papéis A4 reciclados', 'papel; -reciclado'), false);
  assert.equal(C.radical('licitacoes'), C.radical('licitacao')); assert.equal(C.radical('animais'), 'animal');
});

test('Busca de Licitações: portal, número, minhas, datas, esferas, modalidade, estados e cidades', () => {
  const L = [
    { id: 'a', objeto: 'Papel A4', orgao: 'Prefeitura de Catalão', municipio: 'Catalão', uf: 'GO', esfera: 'M', modalidadeId: 6, numero: '90012/2026', sistema: 'Compras.gov.br', abertura: '2026-10-20T08:00', encerramento: '2026-10-30T09:00', publicacao: '2026-10-18', valorEstimado: 50000 },
    { id: 'b', objeto: 'Papel A4', orgao: 'Secretaria de Educação', municipio: 'Goiânia', uf: 'GO', esfera: 'E', modalidadeId: 8, numero: '15/2026', sistema: 'BLL Compras', abertura: '2026-10-01', encerramento: '2026-10-25', publicacao: '2026-09-30', valorEstimado: 9000 },
    { id: 'c', objeto: 'Notebooks', orgao: 'UnB', municipio: 'Brasília', uf: 'DF', esfera: 'F', modalidadeId: 6, numero: '3/2026', sistema: 'Compras.gov.br', publicacao: '2026-10-19' }
  ];
  const ids = f => C.filtrarBusca(L, f).map(a => a.id);
  assert.deepEqual(ids({ portal: 'bll' }), ['b']); assert.deepEqual(ids({ numero: '90012' }), ['a']);
  assert.deepEqual(ids({ minhas: true, ids: { c: 1 } }), ['c']);
  assert.deepEqual(ids({ encerramentoDe: '2026-10-26', encerramentoAte: '2026-10-31' }), ['a']);
  assert.deepEqual(ids({ publicacaoDe: '2026-10-01' }), ['a', 'c']); assert.deepEqual(ids({ aberturaAte: '2026-10-10' }), ['b']);
  assert.deepEqual(ids({ esferas: ['M', 'F'] }), ['a', 'c']); assert.deepEqual(ids({ modalidades: [8] }), ['b']);
  assert.deepEqual(ids({ ufs: ['GO'], cidades: 'goiania; anapolis' }), ['b']);
  assert.deepEqual(ids({ texto: 'papel', orgao: 'catalao', valorMin: '10.000' }), ['a']);
  assert.deepEqual(ids({ texto: 'notebook', inteligente: true }), ['c']);
});

test('Meus Avisos: filtros do painel e valores por item, grupo e lote', () => {
  const itensA = C.resumoItens([
    { numero: 1, descricao: 'LOTE 01 - Caneta azul', refUnitaria: 2, quantidade: 100 },
    { numero: 2, descricao: 'Lote 1: Caneta preta', refUnitaria: 3, quantidade: 100 },
    { numero: 3, descricao: 'Grupo nº 02 - Papel A4', refUnitaria: 25, quantidade: 40, total: 1000 },
    { numero: 4, descricao: 'Grampeador', refUnitaria: null, sigiloso: true, quantidade: 5 }
  ]);
  assert.deepEqual(itensA.map(r => r.g), ['1', '1', '2', null]);
  assert.deepEqual(C.valoresAlvo(itensA, 'item'), [2, 3, 25]);
  assert.deepEqual(C.valoresAlvo(itensA, 'itemTotal'), [200, 300, 1000]);
  assert.deepEqual(C.valoresAlvo(itensA, 'grupo').sort((a, b) => a - b), [500, 1000]);
  assert.equal(C.resumoItens([{ numero: 1, descricao: 'x', refUnitaria: 1, quantidade: 1, grupo: 7 }])[0].g, '7');

  const L = [
    { id: 'a', objeto: 'Material de expediente', orgao: 'Prefeitura de Catalão', municipio: 'Catalão', uf: 'GO', esfera: 'M', modalidadeId: 6, sistema: 'BLL', numero: '10/2026', uasg: '925001', valorEstimado: 1500, perfis: ['p1'], produtos: ['caneta'], capturadoEm: '2026-10-10T10:00:00Z', publicacao: '2026-10-05', itensValores: itensA },
    { id: 'b', objeto: 'Papel', orgao: 'Governo de Goiás', municipio: 'Goiânia', uf: 'GO', esfera: 'E', modalidadeId: 8, sistema: 'Compras.gov.br', numero: '55/2026', valorEstimado: 90000, perfis: ['p2'], produtos: ['papel'], capturadoEm: '2026-10-20T10:00:00Z', publicacao: '2026-10-18' },
    { id: 'c', objeto: 'Notebook', orgao: 'TRE-DF', municipio: 'Brasília', uf: 'DF', esfera: 'F', modalidadeId: 6, valorEstimado: 300000, perfis: ['p1'], produtos: ['notebook'], publicacao: '2026-09-01' }
  ];
  const ids = f => C.filtrarAvisos(L, f).map(a => a.id);
  assert.deepEqual(ids({ portais: ['BLL'] }), ['a']);
  assert.deepEqual(ids({ portais: ['Não informado'] }), ['c']);
  assert.deepEqual(ids({ codigo: '55/2026' }), ['b']);
  assert.deepEqual(ids({ uasg: '925001' }), ['a']);
  assert.deepEqual(ids({ modalidades: [6] }), ['a', 'c']);
  assert.deepEqual(ids({ esferas: ['E', 'F'] }), ['b', 'c']);
  assert.deepEqual(ids({ ufs: ['DF'] }), ['c']);
  assert.deepEqual(ids({ municipios: ['catalao'] }), ['a']);
  assert.deepEqual(ids({ perfis: ['p1'] }), ['a', 'c']);
  assert.deepEqual(ids({ palavras: ['papel', 'notebook'] }), ['b', 'c']);
  assert.deepEqual(ids({ enviadoDe: '2026-10-15' }), ['b']);
  assert.deepEqual(ids({ publicacaoAte: '2026-09-30' }), ['c']);
  assert.deepEqual(ids({ cadastro: 'sim', cadastrados: { b: 1 } }), ['b']);
  assert.deepEqual(ids({ cadastro: 'nao', cadastrados: { b: 1 } }), ['a', 'c']);
  assert.deepEqual(ids({ capag: ['A'], notaCapag: a => (a.esfera === 'M' ? 'A' : '') }), ['a']);
  assert.deepEqual(ids({ capag: ['sem'], notaCapag: a => (a.esfera === 'M' ? 'A' : '') }), ['b', 'c']);
  // valor por item: só o aviso com itens carregados e algum item na faixa
  assert.deepEqual(ids({ valorAlvo: 'item', itemMin: '20', itemMax: '30' }), ['a']);
  assert.deepEqual(ids({ valorAlvo: 'grupo', itemMin: '600' }), ['a']);
  assert.deepEqual(ids({ valorAlvo: 'grupo', itemMin: '1.500,00' }), []);
  assert.deepEqual(ids({ valorAlvo: 'itemTotal', itemMax: '250' }), ['a']);
  assert.deepEqual(ids({ valorAlvo: 'item' }), ['a', 'b', 'c']); // sem faixa, não filtra
});
