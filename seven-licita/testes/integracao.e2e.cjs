// Integração entre ferramentas: o que é lançado numa aparece nas outras, sem digitar de novo.
const path = require('path');
const { abrir } = require('./apoio.cjs');
(async () => {
  const t = await abrir(path.join(process.env.SAIDA || '/tmp', 'integracao'));
  const { pg, url, ok, foto } = t;
  const E = (f, a) => pg.evaluate(f, a);
  await pg.goto(url + '#/painel'); await pg.waitForSelector('#conteudo');
  const hoje = await E(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  await E((hoje) => {
    Dados.e.empresas.push({ id: 'emp1', razao: 'Cliente Teste LTDA', cnpj: '11222333000181', uf: 'GO', municipio: 'Catalão' }); Dados.e.empresaAtiva = 'emp1';
    Dados.e.avisos.av1 = { id: 'av1', orgao: 'Prefeitura de Catalão', modalidade: 'Pregão Eletrônico', numero: '90021/2026', objeto: 'Material de expediente', municipio: 'Catalão', uf: 'GO', encerramento: '2030-11-15T09:00', edital: '' };
    Dados.e.propostas.push({ id: 'p1', empresaId: 'emp1', avisoId: 'av1', ref: { cnpj: '01005727000124' }, orgao: 'Prefeitura de Catalão', modalidade: 'Pregão Eletrônico', numero: '90021/2026', objeto: 'Material de expediente', encerramento: '2030-11-15T09:00', status: 'enviada', declaracoes: {}, documentos: [], itens: [{ numero: 1, descricao: 'Caneta azul', quantidade: 100, unidade: 'UN', unitario: 2, custo: 1.2 }, { numero: 2, descricao: 'Lápis', quantidade: 50, unidade: 'UN', unitario: 1 }] });
    Dados.e.documentos.push({ id: 'doc1', empresaId: 'emp1', nome: 'CND Federal', validade: hoje });
    Dados.salvar();
  }, hoje);

  // Seven Proposta: cartão no Seven Processo e envio ao Seven Pregão a partir da proposta
  await pg.goto(url + '#/cadastrar/proposta/p1'); await pg.waitForSelector('[data-a=quadro]');
  await pg.click('[data-a=quadro]'); await pg.check('[data-a=disputar]'); await pg.click('[data-a=monitorar]');
  ok(await E(() => Dados.e.disputas.length === 1 && Dados.e.monitor.length === 1 && Telas.quadros.todosCartoes().some(x => x.cartao.propostaId === 'p1')), 'proposta vira cartão, disputa e acompanhamento');
  // preço muda no Seven Proposta → Seven Pregão acompanha, sem perder o valor limite
  await E(() => { Dados.e.disputas[0].itens[0].limite = 1.5; Dados.salvar(); });
  await pg.fill('tr[data-k="0"] [data-c=unitario]', '1,95'); await pg.locator('tr[data-k="0"] [data-c=unitario]').dispatchEvent('change');
  ok(await E(() => Dados.e.disputas[0].itens[0].proposta === 1.95 && Dados.e.disputas[0].itens[0].limite === 1.5), 'preço da proposta atualizado na disputa');

  // Resultado: um clique vale para todas as ferramentas
  await pg.click('[data-resultado=ganha]'); await pg.waitForSelector('.modal [name=v]'); await pg.fill('.modal [name=v]', '240,00'); await pg.click('.modal [type=submit]');
  await pg.waitForFunction(() => Dados.e.propostas[0].resultado === 'ganha');
  const r = await E(() => { const x = Telas.quadros.todosCartoes().find(y => y.cartao.propostaId === 'p1'); const l = x.quadro.listas.find(y => y.id === x.cartao.lista); return { lista: l.nome, ganha: x.cartao.etiquetas.some(id => x.quadro.etiquetas.find(et => et.id === id).nome === 'Ganha'), valor: x.cartao.execucao && x.cartao.execucao.valor, disputa: Dados.e.disputas[0].resultado, mon: Dados.e.monitor[0].situacao, tarefa: (Dados.e.agenda.tarefas || []).some(t => /Assinar contrato/.test(t.titulo)) }; });
  ok(r.lista === 'Contrato' && r.ganha && r.valor === 240, 'cartão do Seven Processo em Contrato, com etiqueta Ganha e valor do contrato');
  ok(r.disputa === 'ganha' && r.mon === 'Concluída/homologada' && r.tarefa, 'Seven Pregão, Seven Sessão e Seven Agenda atualizados');
  await foto('int-proposta-ganha');

  // Seven Faturamento: NF da proposta já vem com empenho da Execução; autorizada entra na Execução e no Seven Financeiro
  await E(() => { const x = Telas.quadros.todosCartoes().find(y => y.cartao.propostaId === 'p1').cartao.execucao; x.empenhos.push({ id: 'em1', numero: '2030NE0007', data: '2030-12-01', valor: 240 }); Dados.salvar(); });
  await pg.goto(url + '#/notas/saida'); await pg.waitForSelector('#conteudo');
  await E(() => { const n = { id: 'nf1', operacao: 'saida', tipo: 'produto', modelo: '55', situacao: 'autorizada', empresaId: 'emp1', propostaId: 'p1', numero: 15, serie: 1, emissao: '2030-12-01', totalNota: 240, duplicatas: [{ numero: '001', vencimento: '2030-12-31', valor: 240 }], destinatario: { nome: 'Prefeitura de Catalão' }, contrato: { empenho: '2030NE0007' }, itens: [], historico: [] }; Dados.e.notas = [n]; Dados.salvar(); });
  const nf = await E(() => { const x = Telas.quadros.todosCartoes().find(y => y.cartao.propostaId === 'p1').cartao.execucao; const l = Dados.e.financas.lancamentos.filter(y => y.origem === 'nota:nf1'); return { notas: x.notas.length, emp: x.notas[0] && x.notas[0].empenhoId, lanc: l.length, contato: l[0] && l[0].contato, lancado: Dados.e.notas[0].lancadoFinanceiro }; });
  ok(nf.notas === 1 && nf.emp === 'em1', 'NF autorizada aparece na Execução ligada ao empenho');
  ok(nf.lanc === 1 && nf.lancado && nf.contato === 'Prefeitura de Catalão', 'conta a receber criada sozinha no Seven Financeiro, com o órgão como contato');

  // Baixa no Seven Financeiro → pagamento na Execução
  await pg.goto(url + '#/financas'); await pg.waitForSelector('#conteudo');
  await E(() => { Dados.e.financas.lancamentos.find(y => y.origem === 'nota:nf1').pago = true; Dados.salvar(); });
  ok(await E(() => { const x = Telas.quadros.todosCartoes().find(y => y.cartao.propostaId === 'p1').cartao.execucao; return x.pagamentos.length === 1 && x.pagamentos[0].valor === 240 && Execucao.resumo(x).notas[0].status === 'paga'; }), 'baixa no Seven Financeiro registra o pagamento na Execução');

  // Nova NF da mesma proposta: destinatário e empenho já vêm preenchidos
  await E(() => { Dados.e.notas[0].destinatario = { nome: 'Prefeitura de Catalão', documento: '01005727000124', logradouro: 'Rua 1', municipio: 'Catalão', uf: 'GO' }; Dados.salvar(); });
  await pg.goto(url + '#/notas/saida'); await pg.waitForSelector('#conteudo');
  const btn = pg.locator('[data-a=proposta], [data-nf=proposta]').first();
  if (await btn.count()) { await btn.click(); await pg.waitForSelector('.modal [name=p]'); await pg.click('.modal [type=submit]'); await pg.waitForFunction(() => location.hash.indexOf('#/notas/editar/') === 0);
    ok(await E(() => { const n = Dados.e.notas[0]; return n.contrato.empenho === '2030NE0007' && n.destinatario.logradouro === 'Rua 1'; }), 'nova NF da proposta já vem com empenho e endereço do órgão'); }

  // Seven Agenda: prazos das outras ferramentas aparecem sozinhos
  await pg.goto(url + '#/agenda/calendario'); await pg.waitForSelector('.ag-ev, .ag-cab');
  ok(await pg.locator('.ag-ext-documento:has-text("CND Federal")').count() >= 1, 'vencimento da certidão aparece na Seven Agenda');
  await foto('int-agenda');

  // Peça de cobrança: cliente e contrato vêm da licitação
  ok(await E(() => { const x = Telas.quadros.todosCartoes().find(y => y.cartao.propostaId === 'p1'); return !!x; }), 'cartão disponível para as peças');
  await t.fechar();
})().catch(e => { console.error(e); process.exit(1); });
