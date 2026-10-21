// Testes de navegador dos módulos de produtividade. Uso: node testes/modulos.e2e.cjs [pasta-de-capturas] [modulo]
const path = require('path');
const { abrir } = require('./apoio.cjs');
const saida = process.argv[2] || path.join(__dirname, 'capturas'); const so = process.argv[3];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAwMDAwMDAAAANAAH/7k3PZQAAAABJRU5ErkJggg==', 'base64');

const testes = {
  async nuvem(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]');
    await pg.goto(url + '#/nuvem'); await pg.waitForSelector('.nuvem');
    await pg.click('[data-a=estrutura]'); await pg.fill('.modal [name=o]', 'Papelaria Exemplo'); await pg.selectOption('.modal [name=c]', ''); await submit();
    await pg.waitForSelector('.n-pasta'); ok(await pg.locator('.n-pasta').count() >= 7, 'estrutura padrão de cliente com subpastas');
    ok(await pg.locator('.n-migalhas a').count() === 3, 'migalhas: Meu Drive › Clientes › cliente');
    await pg.dblclick('.n-pasta:has-text("02 Editais")');
    const fc = pg.waitForEvent('filechooser'); await pg.click('[data-a=upload]'); await (await fc).setFiles([t.arquivo('edital.txt', 'Edital de pregão 90021 — papel A4'), t.arquivo('foto.png', PNG)]);
    await pg.waitForSelector('.n-arq >> nth=1'); ok(await pg.locator('.n-arq').count() === 2, 'upload de arquivos para a pasta');
    await pg.dblclick('.n-arq:has-text("edital.txt")'); await pg.waitForSelector('.n-visor .n-texto'); ok(/90021/.test(await pg.locator('.n-texto').innerText()), 'visualizar arquivo de texto'); await pg.keyboard.press('Escape');
    await pg.click('[data-a=modo]'); ok(await pg.locator('.n-tabela').count() === 1, 'modo lista');
    await pg.click('tr.n-item:has-text("edital.txt") [data-menu]'); await pg.click('[data-op=renomear]'); await pg.fill('.modal [name=n]', 'Edital 90021.txt'); await submit();
    ok(await pg.locator('tr.n-item:has-text("Edital 90021.txt")').count() === 1, 'renomear');
    await pg.click('tr.n-item:has-text("Edital 90021.txt")'); await pg.click('[data-a=estrela]');
    await pg.click('[data-a=copiar]'); await submit(); await pg.waitForTimeout(300);
    ok(await pg.locator('tr.n-item:has-text("Cópia de Edital")').count() === 1, 'fazer cópia');
    await pg.click('tr.n-item:has-text("Cópia de Edital")'); await pg.click('[data-a=lixeira]');
    await pg.click('[data-secao=lixeira]'); ok(await pg.locator('.n-item').count() === 1, 'lixeira'); await pg.click('.n-item'); await pg.click('[data-a=restaurar]');
    await pg.click('[data-secao=estrela]'); ok(await pg.locator('.n-item').count() === 1, 'com estrela');
    await pg.fill('#n-busca input', 'edital'); await pg.keyboard.press('Enter'); ok(await pg.locator('.n-item').count() === 2, 'pesquisar no drive');
    await pg.click('[data-secao=drive]'); await pg.click('[data-a=modo]');
    await pg.dblclick('.n-pasta:has-text("Clientes")'); await pg.dblclick('.n-pasta:has-text("Papelaria")');
    await pg.dragAndDrop('.n-pasta:has-text("07 Recursos")', '.n-pasta:has-text("02 Editais")');
    ok(await pg.evaluate(() => { const i = Dados.e.nuvem.itens; const r = i.find(x => x.nome === '07 Recursos e peças'); return i.find(x => x.id === r.pai).nome === '02 Editais'; }), 'arrastar pasta para dentro de outra');
    await foto('nuvem');
  },
  async precificacao(t) {
    const { pg, url, ok, foto } = t;
    await pg.goto(url + '#/precificacao'); await pg.waitForSelector('#p-form');
    await pg.fill('#p-form [name=nome]', 'Papel A4 75 g'); await pg.fill('#p-form [name=custo]', '20'); await pg.fill('#p-form [name=freteCompra]', '1');
    await pg.fill('#p-form [name=quantidade]', '100'); await pg.fill('#p-form [name=freteEntregaTotal]', '100'); await pg.fill('#p-form [name=referencia]', '35');
    const preco = await pg.locator('.p-preco').innerText();
    ok(/R\$\s?\d/.test(preco), 'preço sugerido calculado ao digitar (' + preco + ')');
    const r = await pg.evaluate(() => Precos.produto(Object.assign({}, { custo: 20, freteCompra: 1, quantidade: 100, freteEntregaTotal: 100, impostos: 6, prazoPagamento: 30, taxaMes: 1.5, despesasFixas: 5, margem: 10 })));
    ok(preco.replace(/\s/g, ' ').includes(r.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })), 'preço confere com a fórmula');
    ok(await pg.locator('text=Contra o valor de referência').count() === 1, 'comparação com a referência do edital');
    ok(await pg.locator('.p-res table').nth(1).locator('tbody tr').count() === 9, 'simulador de lances');
    await pg.selectOption('#p-form [name=regime]', 'presumido'); ok((await pg.inputValue('#p-form [name=impostos]')) === '5,93', 'regime preenche os impostos');
    await pg.click('[data-a=salvar]'); await foto('precificacao-produto');
    await pg.goto(url + '#/precificacao/servico'); await pg.fill('#s-form [name=salario]', '1800'); await pg.fill('#s-form [name=beneficios]', '550'); await pg.fill('#s-form [name=postos]', '3');
    ok(/BDI/.test(await pg.locator('#s-res').innerText()), 'serviço com BDI'); await pg.click('[data-a=salvar]'); await foto('precificacao-servico');
    await pg.goto(url + '#/precificacao/salvas'); ok(await pg.locator('tr[data-id]').count() === 2, 'precificações salvas');
    // lote em uma proposta
    await pg.evaluate(() => { Dados.e.propostas.push({ id: 'pp1', numero: '9', modalidade: 'Pregão', orgao: 'Prefeitura', itens: [{ numero: 1, descricao: 'Caneta', quantidade: 100, refUnitaria: 3, participar: true }, { numero: 2, descricao: 'Lápis', quantidade: 50, refUnitaria: 1, participar: true }], status: 'rascunho', declaracoes: {} }); Dados.salvar(); });
    await pg.goto(url + '#/precificacao/lote'); await pg.fill('.p-custo >> nth=0', '1,50'); await pg.locator('.p-custo >> nth=0').press('Tab'); await pg.waitForTimeout(200);
    await pg.fill('.p-custo >> nth=1', '0,95'); await pg.locator('.p-custo >> nth=1').press('Tab'); await pg.waitForTimeout(200);
    ok(await pg.locator('tr.p-linha-ruim').count() === 1, 'lote marca item que não fecha a conta');
    await pg.click('[data-a=aplicar-lote]');
    ok(await pg.evaluate(() => Dados.e.propostas.find(p => p.id === 'pp1').itens[0].unitario > 1.5), 'preços aplicados na proposta');
    await foto('precificacao-lote');
  },
  async academy(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]');
    await pg.goto(url + '#/academy'); await pg.waitForSelector('.academy');
    await pg.click('[data-a=novo]'); await pg.fill('.modal [name=titulo]', 'Licitação do zero'); await pg.fill('.modal [name=subtitulo]', 'Do edital ao pagamento'); await pg.fill('.modal [name=descricao]', 'Curso **prático** da Seven.'); await submit();
    await pg.waitForSelector('.ac-banner'); await pg.check('#ac-ger').catch(() => {});
    await pg.goto(url + '#/academy'); await pg.check('#ac-ger'); await pg.click('.ac-card:has-text("Licitação do zero")');
    await pg.click('[data-a=modulo]'); await pg.fill('.modal [name=t]', 'Módulo 1 — Fundamentos'); await submit();
    await pg.click('[data-a=aula]'); await pg.fill('.modal [name=titulo]', 'O que é licitação'); await pg.selectOption('#ac-tipo', 'texto'); await pg.fill('.modal [name=conteudo]', '# Licitação\nÉ o processo de **compra pública**.'); await submit();
    await pg.click('[data-a=aula]'); await pg.fill('.modal [name=titulo]', 'Aula em vídeo'); await pg.selectOption('#ac-tipo', 'link'); await pg.fill('.modal [name=url]', 'https://youtu.be/dQw4w9WgXcQ'); await pg.fill('.modal [name=duracao]', '12');
    const fc = pg.waitForEvent('filechooser'); await pg.click('#ac-mats'); await (await fc).setFiles(t.arquivo('checklist.txt', 'Checklist de habilitação')); await submit();
    await pg.waitForSelector('.ac-aulas li >> nth=1'); await pg.waitForTimeout(300); ok(await pg.locator('.ac-aulas li').count() === 2, 'curso com módulo e aulas');
    await pg.click('text=▶ Começar'); await pg.waitForSelector('.ac-texto'); ok(/compra pública/.test(await pg.locator('.ac-texto').innerText()), 'aula de texto em Markdown');
    await pg.fill('#ac-com textarea', 'Ótima aula!'); await pg.click('#ac-com button'); ok(await pg.locator('.kj-atividade li').count() === 1, 'comentário na aula');
    await pg.click('[data-aba=notas]'); await pg.fill('#ac-notas', 'Revisar Lei 14.133'); await pg.waitForTimeout(500);
    await pg.click('[data-a=feita]'); await pg.waitForSelector('.ac-player iframe');
    ok((await pg.getAttribute('.ac-player iframe', 'src')).startsWith('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'vídeo do YouTube incorporado e avançou para a próxima aula');
    ok(await pg.locator('a[data-material]').count() === 1, 'material complementar');
    await pg.click('[data-a=feita]');
    await pg.goto(url + '#/academy'); ok(/Continue de onde parou/.test(await pg.locator('.ac-hero').innerText()), 'continuar assistindo');
    await pg.click('.ac-card:has-text("Licitação do zero")'); ok(/100%/.test(await pg.locator('.ac-prog').innerText()), 'progresso 100%');
    ok(await pg.locator('[data-a=certificado]').count() === 1, 'certificado liberado ao concluir');
    ok(await pg.evaluate(() => Dados.e.academy.notas && Object.values(Dados.e.academy.notas)[0] === 'Revisar Lei 14.133'), 'anotações salvas');
    await foto('academy-curso'); await pg.goto(url + '#/academy'); await foto('academy-vitrine');
  },
  async financas(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]');
    await pg.goto(url + '#/financas/contas'); await pg.waitForSelector('.f-conta');
    await pg.click('[data-ajuste]'); await pg.fill('.modal [name=v]', '2000'); await submit();
    await pg.click('[data-a=cartao]'); await pg.fill('.modal [name=nome]', 'Visa Seven'); await pg.fill('.modal [name=limite]', '5000'); await pg.fill('.modal [name=fechamento]', '5'); await pg.fill('.modal [name=vencimento]', '12'); await submit();
    await pg.goto(url + '#/financas/lancamentos');
    await pg.click('[data-novo=receita]'); await pg.fill('.modal [name=descricao]', 'Honorários cliente X'); await pg.fill('.modal [name=valor]', '3.500,00'); await pg.selectOption('.modal [name=categoria]', { label: 'Honorários' }); await submit();
    await pg.click('[data-novo=despesa]'); await pg.fill('.modal [name=descricao]', 'Aluguel'); await pg.fill('.modal [name=valor]', '1500'); await pg.selectOption('.modal [name=categoria]', { label: 'Moradia' }); await pg.selectOption('.modal [name=modo]', 'fixa'); await pg.fill('.modal [name=vezes]', '3'); await submit();
    await pg.click('[data-novo=cartao]'); await pg.fill('.modal [name=descricao]', 'Notebook'); await pg.fill('.modal [name=valor]', '3000'); await pg.selectOption('.modal [name=categoria]', { label: 'Compras' }); await pg.selectOption('.modal [name=modo]', 'parcelada'); await pg.fill('.modal [name=vezes]', '10'); await submit();
    await pg.waitForTimeout(200);
    const n = await pg.evaluate(() => Dados.e.financas.lancamentos.length);
    ok(n === 1 + 1 + 3 + 10, 'lançamentos: receita, ajuste, fixa (3x) e parcelada (10x) — ' + n);
    ok(/Receitas R\$\s?3\.500,00/.test(await pg.locator('.f-totais').innerText()), 'totais do mês (ajuste de saldo fora das receitas)');
    await pg.goto(url + '#/financas/geral'); await pg.waitForSelector('.f-analise');
    ok(await pg.locator('.f-analise li').count() >= 2, 'análise do mês em texto');
    ok(/4\.000,00/.test(await pg.locator('.f-kpis').innerText()), 'saldo das contas (2.000 + 3.500 − 1.500 do aluguel pago)');
    await pg.goto(url + '#/financas/planejamento'); await pg.click('[data-a=orc]');
    await pg.locator('.modal tr:has-text("Moradia") input').fill('1600'); await submit();
    ok(await pg.locator('.f-orc.grande').count() === 1, 'orçamento por categoria');
    await pg.click('[data-a=meta]'); await pg.fill('.modal [name=n]', 'Reserva'); await pg.fill('.modal [name=a]', '10000'); await submit(); await pg.click('[data-aporte]'); await pg.fill('.modal [name=v]', '1000'); await submit();
    ok(/10%/.test(await pg.locator('.f-meta').innerText()), 'meta com aporte');
    const ofx = '<OFX><STMTTRN><DTPOSTED>' + (new Date().toISOString().slice(0, 10).replace(/-/g, '')) + '<TRNAMT>-89.90<FITID>x1<MEMO>SUPERMERCADO BOM PRECO</STMTTRN></OFX>';
    await pg.goto(url + '#/financas/importar'); const fc = pg.waitForEvent('filechooser'); await pg.click('[data-a=arquivo]'); await (await fc).setFiles(t.arquivo('extrato.ofx', ofx));
    await pg.waitForSelector('[data-a=confirmar]'); await pg.click('[data-a=confirmar]'); await pg.waitForSelector('.f-lancs');
    ok(await pg.evaluate(() => Dados.e.financas.lancamentos.some(l => l.idBanco === 'x1')), 'importação de extrato OFX');
    await pg.goto(url + '#/financas/contas'); ok(/Pagar fatura/.test(await pg.locator('.f-cartao').innerText()) || /Fatura/.test(await pg.locator('.f-cartao').innerText()), 'fatura do cartão');
    await pg.goto(url + '#/financas/relatorios'); ok(await pg.locator('text=DRE simplificada').count() === 1, 'relatórios e DRE');
    await foto('financas-relatorios'); await pg.goto(url + '#/financas/geral'); await foto('financas-geral');
  },
  async calculadora(t) {
    const { pg, url, ok, foto } = t;
    await pg.goto(url + '#/calculadora'); await pg.waitForSelector('.cl-calc');
    for (const k of ['7', '×', '8', '+', '2', '%']) await pg.click('.cl-t[data-t="' + k + '"]');
    ok((await pg.locator('#cl-prev').innerText()).includes('57,12'), 'prévia ao vivo (7×8+2% = 57,12)');
    await pg.click('.cl-t[data-t="="]'); ok(await pg.locator('.cl-hist li').count() === 1, 'histórico');
    await pg.fill('#cl-expr', 'sin(30)+√16'); await pg.press('#cl-expr', 'Enter'); ok((await pg.inputValue('#cl-expr')) === '4,5', 'digitação direta com funções em graus');
    await pg.goto(url + '#/calculadora/datas'); await pg.fill('#cl-form [name=d1]', '2026-10-30'); await pg.fill('#cl-form [name=qt]', '3');
    ok(/05\/11\/2026/.test(await pg.locator('#cl-saida').innerText()), 'prazo em dias úteis pulando Finados');
    await pg.goto(url + '#/calculadora/financiamento'); ok(/Parcela/.test(await pg.locator('#cl-saida').innerText()), 'financiamento Price');
    await pg.goto(url + '#/calculadora/conversor'); await pg.click('[data-cat=temperatura]'); await pg.selectOption('#cl-conv [name=de]', '°C'); await pg.selectOption('#cl-conv [name=para]', '°F'); await pg.fill('#cl-conv [name=v]', '100'); await pg.waitForTimeout(500);
    ok(/212/.test(await pg.locator('.cl-grande').innerText()), 'conversor de temperatura');
    await pg.fill('#cl-busca', 'roman'); await pg.waitForTimeout(400); ok(await pg.locator('.cl-menu a').count() === 1, 'busca de calculadoras');
    await pg.goto(url + '#/calculadora/romanos'); await pg.click('[data-fav]'); ok(await pg.locator('.cl-menu h4:has-text("Favoritas")').count() === 1, 'favoritar');
    await pg.goto(url + '#/calculadora'); await foto('calculadora');
  },
  async musicas(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]');
    const wav = (seg) => { const sr = 8000, n = sr * seg; const b = Buffer.alloc(44 + n); b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); b.fill(128, 44); return b; };
    await pg.goto(url + '#/musicas'); await pg.waitForSelector('.musicas');
    const fc = pg.waitForEvent('filechooser'); await pg.click('[data-enviar-lado]');
    await (await fc).setFiles([t.arquivo('Seven Band - Foco Total.wav', wav(2)), t.arquivo('Trilha - Proposta Enviada.wav', wav(3))]);
    await pg.waitForFunction(() => Dados.e.musicas.faixas.length === 2);
    await pg.goto(url + '#/musicas/biblioteca'); await pg.waitForSelector('.mu-tabela');
    ok(await pg.locator('.mu-tabela tbody tr').count() === 2, 'biblioteca com as músicas enviadas');
    ok(await pg.locator('.mu-tit:has-text("Foco Total") small:has-text("Seven Band")').count() === 1, 'artista e título lidos do nome do arquivo');
    await pg.click('[data-play-tudo]'); await pg.waitForSelector('#player .pl-play');
    ok(await pg.locator('#player b').first().innerText() !== '', 'player fixo aparece tocando');
    const antes = await pg.evaluate(() => Player.atual().id); await pg.click('#player [data-p=prox]'); await pg.waitForTimeout(300);
    ok(await pg.evaluate((a) => Player.atual().id !== a, antes), 'próxima faixa');
    await pg.click('#player [data-p=curtir]'); ok(await pg.evaluate(() => Dados.e.musicas.faixas.some(f => f.curtida)), 'curtir');
    await pg.click('#player [data-p=fila]'); ok(await pg.locator('.pl-fila').count() === 1, 'fila de reprodução'); await pg.click('#player [data-p=fila]');
    await pg.click('[data-nova-pl]'); await pg.fill('.modal [name=n]', 'Foco no edital'); await submit(); await pg.waitForSelector('.mu-cab');
    await pg.click('[data-add]'); await pg.check('.modal [name=f] >> nth=0'); await pg.check('.modal [name=f] >> nth=1'); await submit();
    ok(await pg.locator('.mu-tabela tbody tr').count() === 2, 'playlist criada com músicas');
    await pg.goto(url + '#/encontrar'); ok(await pg.locator('#player .pl-play').count() === 1, 'música continua no player em outra tela');
    await pg.goto(url + '#/musicas/externos'); await pg.fill('#mu-ext [name=u]', 'https://open.spotify.com/intl-pt/playlist/37i9dQZF1DX8NTLI2TtZa6'); await pg.click('#mu-ext button');
    ok((await pg.getAttribute('.mu-ext iframe', 'src')).startsWith('https://open.spotify.com/embed/playlist/'), 'playlist do Spotify incorporada');
    await pg.goto(url + '#/musicas'); await foto('musicas-inicio'); await pg.goto(url + '#/musicas/biblioteca'); await foto('musicas-biblioteca');
  }
};

(async () => {
  const t = await abrir(saida);
  try { for (const k of Object.keys(testes)) { if (so && so !== k) continue; console.log('• ' + k); await testes[k](t); } }
  catch (e) { console.error(e.message || e); await t.foto('erro'); process.exit(1); }
  await t.fechar();
})();
