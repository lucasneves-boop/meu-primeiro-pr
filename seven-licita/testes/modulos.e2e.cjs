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
    await pg.goto(url + '#/precificacao/lote'); await pg.waitForSelector('.pp-inicio');
    await pg.click('[data-a=da-proposta]'); await pg.selectOption('.modal [name=p]', 'pp1'); await pg.click('.modal [type=submit]'); await pg.waitForSelector('.pp-tab tbody tr');
    await pg.locator('.pp-tab tbody tr').nth(0).locator('[data-k=custo]').fill('1,50');
    await pg.locator('.pp-tab tbody tr').nth(1).locator('[data-k=custo]').fill('0,95'); await pg.waitForTimeout(350);
    ok(await pg.locator('.pp-tab tr.pp-erro').count() === 1, 'planilha marca o item que não fecha a conta');
    await pg.click('[data-a=aplicar]'); await pg.waitForTimeout(150); if (await pg.locator('.modal [type=submit]').count()) await pg.click('.modal [type=submit]');
    await pg.waitForFunction(() => /cadastrar\/proposta\/pp1/.test(location.hash));
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
  async leitor(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]');
    const paragrafos = Array.from({ length: 60 }, (_, i) => 'Parágrafo ' + (i + 1) + '. O licitante deverá apresentar a proposta de preços ajustada ao lance vencedor no prazo fixado pelo pregoeiro, sob pena de desclassificação, conforme a Lei 14.133.').join('\n\n');
    const md = '# Guia do Pregão\n\n## Habilitação\n\n' + paragrafos + '\n\n## Recursos\n\nA intenção de recurso deve ser registrada em até dez minutos. Palavra-chave: impugnação.';
    await pg.goto(url + '#/leitor'); await pg.waitForSelector('.kd-bib');
    const fc = pg.waitForEvent('filechooser'); await pg.click('.vazio [data-a=adicionar]'); await (await fc).setFiles([t.arquivo('Guia_do_Pregao.md', md)]);
    await pg.waitForSelector('.kd-item'); ok(await pg.locator('.kd-item:has-text("Guia do Pregao")').count() === 1, 'documento na biblioteca com capa gerada');
    await pg.click('.kd-item'); await pg.waitForSelector('#kd-txt h1');
    await pg.waitForFunction(() => /Página 1 de \d+/.test(document.querySelector('#kd-local').textContent));
    const total = await pg.evaluate(() => Number(document.querySelector('#kd-local').textContent.match(/de (\d+)/)[1])); ok(total > 2, 'paginado em ' + total + ' páginas');
    await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(250);
    ok(/Página 2 de/.test(await pg.locator('#kd-local').textContent()), 'virar página com a seta');
    await pg.mouse.click(1440 - 20, 450); await pg.waitForTimeout(250); ok(/Página 3 de/.test(await pg.locator('#kd-local').textContent()), 'virar página tocando na borda direita');
    await pg.click('.kd-zona.ant'); await pg.waitForTimeout(250);
    await pg.mouse.move(700, 450); await pg.evaluate(() => document.querySelector('.kd-leitor').classList.add('chrome'));
    await pg.click('[data-k=aa]'); await pg.click('[data-k=tema][data-v=sepia]');
    ok(await pg.evaluate(() => getComputedStyle(document.querySelector('.kd-leitor')).backgroundColor) === 'rgb(244, 236, 216)', 'tema sépia');
    await pg.click('[data-k=fonte][data-v=Atkinson]'); ok(await pg.evaluate(() => /Atkinson/.test(document.querySelector('#kd-txt').style.fontFamily)), 'trocar fonte');
    await pg.click('[data-k=fechar-painel]');
    // selecionar um trecho visível e destacar
    await pg.evaluate(() => { const txt = document.querySelector('#kd-txt'); const box = txt.parentNode.getBoundingClientRect(); const w = document.createTreeWalker(txt, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect(); if (b.left >= box.left && b.right <= box.right && n.length > 40) { r.setStart(n, 0); r.setEnd(n, 25); const s = getSelection(); s.removeAllRanges(); s.addRange(r); break; } } document.querySelector('#kd-pagina').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await pg.waitForSelector('#kd-pop:not([hidden])'); await pg.click('#kd-pop [data-k=cor][data-v=azul]');
    ok(await pg.locator('mark.kd-hl.azul').count() >= 1, 'destaque azul pintado no texto');
    await pg.click('mark.kd-hl.azul >> nth=0'); await pg.click('#kd-pop [data-k=nota]'); await pg.fill('.modal [name=n]', 'Conferir prazo no edital'); await submit();
    await pg.evaluate(() => document.querySelector('.kd-leitor').classList.add('chrome')); await pg.click('[data-k=marcar]');
    await pg.click('[data-k=caderno]'); ok(await pg.locator('.kd-notas li.azul:has-text("Conferir prazo")').count() === 1, 'caderno com destaque e nota');
    ok(await pg.locator('.kd-notas li:has-text("🔖")').count() === 1, 'marcador na página');
    await pg.click('[data-k=sumario]'); await pg.waitForSelector('.kd-sum'); ok(await pg.locator('.kd-sum li').count() === 3, 'sumário a partir dos títulos');
    await pg.click('.kd-sum a:has-text("Recursos")'); await pg.waitForTimeout(300);
    const ultimo = /Página (\d+) de (\d+)/.exec(await pg.locator('#kd-local').textContent()); ok(ultimo[1] === ultimo[2], 'ir para capítulo pelo sumário (' + ultimo[0] + ')');
    await pg.keyboard.press('Control+f'); await pg.fill('#kd-q', 'impugnacao'); await pg.keyboard.press('Enter');
    await pg.waitForSelector('#kd-res li'); ok(await pg.locator('#kd-res li').count() === 1, 'buscar ignorando acentos');
    await pg.click('[data-k=fechar-painel]'); await pg.click('[data-k=prox]').catch(() => {});
    await foto('leitor-pagina');
    await pg.keyboard.press('Escape'); await pg.waitForSelector('.kd-bib'); ok(await pg.locator('#kd-leitor').count() === 0, 'Esc volta à biblioteca');
    ok(await pg.evaluate(() => Dados.e.leitor.livros[0].progresso > 0.9 && Dados.e.leitor.livros[0].destaques.length === 1), 'progresso e destaques guardados');
    await pg.click('.kd-continuar'); await pg.waitForSelector('#kd-local'); await pg.waitForTimeout(300);
    ok((await pg.locator('#kd-local').textContent()).indexOf(ultimo[0]) === 0, 'continuar de onde parou'); await pg.keyboard.press('Escape');
    await foto('leitor-biblioteca');
  },
  async cotacoes(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]'); const fs = require('fs');
    await pg.goto(url + '#/fornecedores'); await pg.waitForSelector('.vazio');
    const novoForn = async (d) => { await pg.click('[data-a=novo]'); for (const k of Object.keys(d)) await pg.fill('.modal [name=' + k + ']', d[k]); await submit(); await pg.waitForSelector('.fo-cab'); await pg.goto(url + '#/fornecedores'); };
    await novoForn({ razao: 'Papelaria Central Ltda', fantasia: 'Papelaria Central', contato: 'Ana Souza', whatsapp: '(64) 99999-1111', email: 'ana@papelaria.exemplo', categorias: 'papelaria, material de expediente, papel', cidade: 'Catalão' });
    await novoForn({ razao: 'InfoTech Suprimentos', contato: 'Bruno', email: 'bruno@infotech.exemplo', categorias: 'informática, toner, cartucho' });
    await novoForn({ razao: 'Distribuidora Goiás', contato: 'Carla', whatsapp: '62988887777', categorias: 'papelaria, escritório, caneta' });
    ok(await pg.locator('.fo-tabela tbody tr').count() === 3, 'três fornecedores cadastrados');
    await pg.click('tr:has-text("Papelaria Central")'); await pg.click('[data-aba=portfolio]'); await pg.click('[data-a=add-port]');
    await pg.fill('.modal [name=descricao]', 'Caneta esferográfica azul'); await pg.fill('.modal [name=marca]', 'BIC'); await pg.fill('.modal [name=preco]', '1,29'); await submit();
    ok(await pg.locator('td:has-text("Caneta esferográfica azul")').count() === 1, 'produto no portfólio');
    await pg.click('[data-aba=historico]'); await pg.fill('#fo-reg [name=texto]', 'Negociou frete CIF acima de R$ 1.500'); await pg.click('#fo-reg button');
    ok(await pg.locator('.fo-linha li:has-text("frete CIF")').count() === 1, 'contato registrado no histórico');
    // cotação a partir do edital
    const EDITAL = ['PREFEITURA MUNICIPAL DE CATALÃO - GO', 'PREGÃO ELETRÔNICO Nº 90021/2026', 'A sessão pública será realizada no dia 05/11/2026, às 09:00 horas, no portal Compras.gov.br.', '', '1. DO OBJETO', '1.1. O objeto da presente licitação é a aquisição de material de expediente para as secretarias.', '', 'Local de entrega: Almoxarifado Central, Rua 10, Centro, Catalão-GO.', 'O prazo de entrega será de 15 (quinze) dias úteis.', '', 'ANEXO I - TERMO DE REFERÊNCIA', 'ITEM DESCRIÇÃO UNID QTD VALOR UNIT VALOR TOTAL', '1 Papel A4 75 g/m², branco, caixa com 10 resmas CX 200 245,90 49.180,00', '2 Caneta esferográfica azul, ponta média UN 1.500 1,35 2.025,00', '3 Toner compatível HP CF258A CARTUCHO 30 189,00 5.670,00'].join('\n');
    await pg.goto(url + '#/cotacoes'); await pg.click('.vazio [data-a=nova]');
    await pg.setInputFiles('.modal [name=arquivos]', t.arquivo('edital-90021.txt', EDITAL)); await submit();
    await pg.waitForSelector('.co-itens'); ok(await pg.locator('.co-itens tbody tr').count() === 3, 'três itens lidos do edital');
    ok(/Material de expediente/i.test(await pg.locator('.co-cab h2').innerText()) && /Sessão 05\/11\/2026/.test(await pg.locator('.co-cab p').innerText()), 'título e sessão a partir do edital');
    await pg.fill('.co-itens tbody tr:nth-child(2) [data-c=quantidade]', '1.000'); await pg.locator('.co-itens tbody tr:nth-child(2) [data-c=quantidade]').blur(); await pg.waitForTimeout(150);
    ok(await pg.evaluate(() => Dados.e.cotacoes[0].itens[1].quantidade) === 1000, 'editar quantidade na tabela');
    await pg.click('[data-aba=fornecedores]'); await pg.waitForSelector('.co-sug-i');
    ok(await pg.locator('.co-sug-i').count() === 3, 'três fornecedores sugeridos pelo portfólio/categorias');
    await pg.click('[data-f=todos-sug]'); ok(await pg.locator('.co-forn tbody tr').count() === 3, 'incluir todos os sugeridos');
    // enviar por WhatsApp (sem abrir de verdade)
    await pg.evaluate(() => { window.open = (u) => { window.__aberto = u; return null; }; });
    await pg.click('tr:has-text("Papelaria Central") [data-x=enviar]'); await pg.waitForSelector('.modal [name=tw]');
    const msg = await pg.inputValue('.modal [name=tw]'); ok(/^Olá, Ana!/.test(msg) && /\*2\.\* Caneta esferográfica azul, ponta média — \*1000 UN\*/.test(msg) && /entrega em CATALÃO-GO/i.test(msg) && !/PREFEITURA/.test(msg), 'mensagem de WhatsApp sem expor o órgão');
    ok(/Lucas Neves \| Seven$/.test(msg), 'assinatura padrão');
    await pg.click('.modal [data-ir]'); ok((await pg.evaluate(() => window.__aberto)).startsWith('https://wa.me/5564999991111?text=Ol%C3%A1%2C%20Ana'), 'abre o WhatsApp com o texto');
    ok(await pg.locator('tr:has-text("Papelaria Central") .tag:has-text("Enviada")').count() === 1, 'status Enviada');
    await pg.click('tr:has-text("Distribuidora") [data-x=enviar]'); await pg.click('.modal [data-ir]');
    // planilha baixada, preenchida pelo fornecedor e importada
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('tr:has-text("Papelaria Central") [data-x=planilha]')]);
    ok(/COT-\d{4}-001-papelaria-central\.xlsx$/.test(dl.suggestedFilename()), 'planilha do fornecedor em Excel (' + dl.suggestedFilename() + ')');
    const b64 = fs.readFileSync(await dl.path()).toString('base64');
    const preenchida = await pg.evaluate((b) => { const wb = XLSX.read(b, { type: 'base64' }); const ws = wb.Sheets['Cotação']; const L = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }); const h = L.findIndex(r => r[0] === 'Cód.'); const set = (r, c, v) => { ws[XLSX.utils.encode_cell({ r, c })] = { t: typeof v === 'number' ? 'n' : 's', v }; }; set(h + 1, 8, 238.5); set(h + 1, 6, 'Chamex'); set(h + 2, 8, '1,19'); set(h + 2, 6, 'BIC'); set(h + 3, 11, 'Não atendemos toner'); set(6, 1, '30 dias'); return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }); }, b64);
    const fc = pg.waitForEvent('filechooser'); await pg.click('.co-cab [data-a=importar]'); await (await fc).setFiles(t.arquivo('resposta-papelaria.xlsx', Buffer.from(preenchida, 'base64')));
    await pg.waitForSelector('.co-mapa'); ok(await pg.evaluate(() => { const x = Dados.e.cotacoes[0].fornecedores.find(f => f.nome === 'Papelaria Central'); return x.status === 'respondida' && x.resposta.validade === '30 dias' && x.resposta.itens[Dados.e.cotacoes[0].itens[2].id].naoAtende; }), 'planilha importada, fornecedor reconhecido e "não atende" lido');
    // resposta digitada para a Distribuidora
    await pg.click('[data-aba=respostas]'); await pg.click('[data-rf]:has-text("Distribuidora")');
    const linhas = pg.locator('.co-resp-t tbody tr'); await linhas.nth(0).locator('input').first().fill('240'); await linhas.nth(1).locator('input').first().fill('1,05'); await linhas.nth(1).locator('input').nth(1).fill('Faber'); await pg.click('#co-resp .btn.primario');
    await pg.click('[data-aba=mapa]'); await pg.waitForSelector('.co-mapa');
    ok(await pg.locator('.co-mapa td.co-melhor').count() === 2, 'menor preço destacado por item');
    ok(/R\$\s?47\.700,00/.test(await pg.locator('.co-mapa tbody tr:nth-child(1) td.co-melhor').innerText()) === false && /238,50/.test(await pg.locator('.co-mapa tbody tr:nth-child(1) td.co-melhor').innerText()), 'papel: melhor preço da Papelaria');
    ok(/1,05/.test(await pg.locator('.co-mapa tbody tr:nth-child(2) td.co-melhor').innerText()), 'caneta: melhor preço da Distribuidora');
    ok(/R\$\s?48\.750,00/.test(await pg.locator('.kpis div:first-child b').innerText()), 'melhor combinação = 200×238,50 + 1000×1,05');
    await foto('cotacoes-mapa');
    const [dlm] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-m=xlsx]')]); ok(/^mapa-COT/.test(dlm.suggestedFilename()), 'exportar mapa');
    // follow-up
    await pg.evaluate(() => { const c = Dados.e.cotacoes[0]; c.fornecedores.find(f => f.nome === 'InfoTech Suprimentos').status = 'enviada'; c.fornecedores.find(f => f.nome === 'InfoTech Suprimentos').enviadaEm = new Date(Date.now() - 30 * 36e5).toISOString(); c.prazoResposta = '2099-12-31'; Dados.salvar(); });
    await pg.goto(url + '#/cotacoes'); await pg.waitForSelector('.co-pend'); ok(await pg.locator('.co-pend li:has-text("InfoTech")').count() === 1, 'follow-up pendente na lista');
    await pg.click('.co-pend [data-fu]'); await pg.waitForSelector('.modal [name=te]'); ok(/Retomo a cotação COT-/.test(await pg.inputValue('.modal [name=te]')), 'mensagem de follow-up por e-mail (sem WhatsApp cadastrado)');
    await pg.fill('.modal [name=nota]', 'Prometeu responder amanhã'); await pg.click('.modal [data-so-registrar]');
    ok(await pg.locator('.co-pend').count() === 0, 'follow-up registrado sai da fila');
    await foto('cotacoes-lista');
    // ficha do fornecedor com indicadores e histórico automático
    await pg.goto(url + '#/fornecedores'); await pg.click('tr:has-text("Papelaria Central")'); await pg.waitForSelector('.fo-cab');
    const kp = await pg.locator('.kpis').innerText(); ok(/enviadas\s*1\b/i.test(kp) && /resposta\s*100%/i.test(kp), 'indicadores: 1 cotação, 100% de resposta (' + kp.replace(/\s+/g, ' ') + ')');
    await pg.click('[data-aba=portfolio]'); ok(await pg.locator('td:has-text("Papel A4")').count() === 1, 'preço respondido entra no portfólio');
    await pg.click('[data-aba=historico]'); ok(await pg.locator('.fo-linha li:has-text("enviada por whatsapp")').count() === 1 && await pg.locator('.fo-linha li:has-text("Respondeu a cotação")').count() === 1, 'histórico automático do fornecedor');
    await foto('fornecedor-ficha');
    // edital em PDF com tabela (gerado pelo próprio Chromium)
    const pp = await pg.context().newPage();
    await pp.setContent('<h3>MUNICÍPIO DE GOIANDIRA</h3><p>DISPENSA ELETRÔNICA Nº 15/2026</p><p>Data da sessão: 10/11/2026 às 14:00</p><p>OBJETO: Aquisição de gêneros de limpeza.</p><table border=1 cellpadding=4><tr><th>Item</th><th>Descrição</th><th>Unid.</th><th>Qtd.</th><th>Valor unit.</th></tr><tr><td>1</td><td>Detergente líquido neutro 500 ml</td><td>FR</td><td>240</td><td>2,35</td></tr><tr><td>2</td><td>Água sanitária 2 litros</td><td>UN</td><td>180</td><td>5,90</td></tr><tr><td>3</td><td>Saco de lixo 100 litros, pacote com 10</td><td>PCT</td><td>90</td><td>12,40</td></tr></table>');
    const pdf = await pp.pdf({ format: 'A4' }); await pp.close();
    await pg.goto(url + '#/cotacoes'); await pg.click('.barra-acoes [data-a=nova]'); await pg.setInputFiles('.modal [name=arquivos]', t.arquivo('dispensa-15.pdf', pdf)); await submit();
    await pg.waitForSelector('.co-itens', { timeout: 60000 });
    const its = await pg.evaluate(() => Dados.e.cotacoes[0].itens.map(i => [i.n, i.descricao, i.unidade, i.quantidade, i.valorRef]));
    ok(its.length === 3 && its[2][2] === 'PCT' && its[2][3] === 90 && its[0][4] === 2.35, 'itens lidos de edital em PDF (' + JSON.stringify(its) + ')');
    ok(await pg.evaluate(() => Dados.e.cotacoes[0].licitacao.numero === '15/2026' && Dados.e.cotacoes[0].licitacao.dataSessao === '2026-11-10T14:00'), 'número e sessão lidos do PDF');
  },
  async agenda(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]');
    const H = await pg.evaluate(() => 0); void H;
    await pg.goto(url + '#/agenda'); await pg.waitForSelector('.ag-vazio');
    const amanha = await pg.evaluate(() => Agenda.somar(Agenda.hojeLocal(), 1));
    await pg.fill('#ag-novo', 'Enviar proposta amanhã 14h !alta #cliente ^Papelaria');
    ok(/Amanhã 14:00/.test(await pg.locator('#ag-prev').innerText()) && /Alta/.test(await pg.locator('#ag-prev').innerText()), 'prévia da adição rápida');
    await pg.keyboard.press('Enter'); await pg.waitForSelector('.ag-smart a:has-text("Papelaria")');
    ok(await pg.evaluate((a) => { const x = Dados.e.agenda.tarefas[0]; return x.titulo === 'Enviar proposta' && x.data === a && x.hora === '14:00' && x.prioridade === 3 && x.tags[0] === 'cliente' && Dados.e.agenda.listas[0].nome === 'Papelaria'; }, amanha), 'tarefa criada com data, hora, prioridade, tag e lista nova');
    await pg.fill('#ag-novo', 'Conferir PNCP todo dia 8h'); await pg.keyboard.press('Enter');
    await pg.fill('#ag-novo', 'Atualizar certidões'); await pg.keyboard.press('Enter');
    ok(await pg.locator('.ag-lista .ag-t').count() === 2, 'Hoje: tarefa recorrente e tarefa sem data criada em Hoje');
    await pg.click('.ag-t:has-text("Atualizar certidões") .ag-t-tit'); await pg.waitForSelector('#ag-det');
    await pg.fill('#ag-sub-add', 'CND federal'); await pg.keyboard.press('Enter'); await pg.fill('#ag-sub-add', 'FGTS'); await pg.keyboard.press('Enter');
    await pg.click('#ag-det [data-pr="2"]'); await pg.selectOption('#ag-det [data-f=lembrete]', '15');
    await pg.fill('#ag-det [data-f=notas]', 'Ver validade de todas'); await pg.locator('#ag-det [data-f=notas]').blur();
    ok(await pg.evaluate(() => { const x = Dados.e.agenda.tarefas.find(t => t.titulo === 'Atualizar certidões'); return x.subtarefas.length === 2 && x.prioridade === 2 && x.lembrete === 15 && x.notas === 'Ver validade de todas'; }), 'detalhe: subtarefas, prioridade, lembrete e descrição');
    ok(/☑ 0\/2/.test(await pg.locator('.ag-t:has-text("Atualizar certidões")').innerText()), 'contador de subtarefas na linha');
    await pg.click('.ag-t:has-text("Conferir PNCP") .ag-chk');
    ok(await pg.evaluate((a) => { const x = Dados.e.agenda.tarefas.find(t => t.titulo === 'Conferir PNCP'); return x.data === a && !x.feita && x.historico.length === 1; }, amanha), 'concluir recorrente avança para amanhã');
    await pg.click('.ag-t:has-text("Atualizar certidões") .ag-chk'); ok(await pg.locator('.ag-feitas-t').count() === 1, 'concluídas de hoje aparecem recolhidas');
    await pg.click('.ag-smart a:has-text("Amanhã")'); await pg.waitForSelector('.ag-cab h2:has-text("Amanhã")'); ok(await pg.locator('.ag-lista .ag-t').count() === 2, 'lista Amanhã');
    // arrastar para a lista Papelaria
    await pg.dragAndDrop('.ag-t:has-text("Conferir PNCP")', '.ag-smart a:has-text("Papelaria")');
    ok(await pg.evaluate(() => Dados.e.agenda.tarefas.find(t => t.titulo === 'Conferir PNCP').lista === Dados.e.agenda.listas[0].id), 'arrastar tarefa para outra lista');
    await foto('agenda-tarefas');
    // calendário
    await pg.evaluate(() => { Dados.e.cotacoes = [{ id: 'c1', numero: 'COT-2026-009', titulo: 'x', status: 'em-andamento', prazoResposta: Agenda.hojeLocal(), licitacao: {}, itens: [], fornecedores: [] }]; Dados.salvar(); });
    await pg.goto(url + '#/agenda/calendario/mes'); await pg.waitForSelector('.ag-mes');
    ok(await pg.locator('.ag-dia[data-dia="' + amanha + '"] .ag-ev').count() >= 2, 'tarefas no dia certo do mês (incluindo recorrência)');
    ok(await pg.locator('.ag-ext:has-text("Prazo cotação COT-2026-009")').count() === 1, 'prazo da cotação aparece no calendário');
    const dest = await pg.evaluate(() => Agenda.somar(Agenda.hojeLocal(), 3));
    if (await pg.locator('.ag-dia[data-dia="' + dest + '"]').count()) {
      await pg.dragAndDrop('.ag-dia[data-dia="' + amanha + '"] .ag-ev:has-text("Enviar proposta")', '.ag-dia[data-dia="' + dest + '"]');
      ok(await pg.evaluate((d) => Dados.e.agenda.tarefas.find(t => t.titulo === 'Enviar proposta').data === d, dest), 'arrastar no calendário remarca');
    }
    await pg.dblclick('.ag-dia[data-dia="' + dest + '"] .ag-dia-n'); await pg.fill('.modal [name=t]', 'Sessão pública BLL 9h'); await submit();
    ok(await pg.evaluate((d) => { const x = Dados.e.agenda.tarefas.find(t => t.titulo === 'Sessão pública BLL'); return x && x.data === d && x.hora === '09:00'; }, dest), 'duplo clique cria tarefa no dia');
    await pg.goto(url + '#/agenda/calendario/semana'); await pg.evaluate((d) => {}, dest);
    await pg.click('[data-nav="0"]'); if (await pg.locator('.ag-col[data-col="' + dest + '"]').count() === 0) await pg.click('[data-nav="1"]');
    ok(await pg.locator('.ag-col[data-col="' + dest + '"] .ag-bloco:has-text("Sessão pública BLL")').count() === 1, 'visão semanal com bloco no horário');
    await foto('agenda-semana');
    // matriz
    await pg.goto(url + '#/agenda/matriz'); await pg.waitForSelector('.ag-matriz');
    ok(await pg.locator('.ag-q0 .ag-t:has-text("Enviar proposta")').count() === 1, 'alta prioridade no quadrante I');
    await pg.dragAndDrop('.ag-q0 .ag-t:has-text("Enviar proposta")', '.ag-q1');
    ok(await pg.evaluate(() => Dados.e.agenda.tarefas.find(t => t.titulo === 'Enviar proposta').prioridade === 2), 'arrastar entre quadrantes muda a prioridade');
    await pg.fill('.ag-q3 [data-qadd] input', 'Organizar arquivo morto'); await pg.keyboard.press('Enter');
    ok(await pg.locator('.ag-q3 .ag-t:has-text("Organizar arquivo morto")').count() === 1, 'adicionar direto no quadrante');
    await foto('agenda-matriz');
    // foco
    await pg.goto(url + '#/agenda/foco'); await pg.selectOption('#ag-pomo-t', { label: await pg.locator('#ag-pomo-t option:has-text("Enviar proposta")').innerText() });
    await pg.click('[data-pa=iniciar]'); await pg.waitForTimeout(1300);
    ok(/24:5\d/.test(await pg.locator('#ag-relogio').innerText()), 'pomodoro contando (' + await pg.locator('#ag-relogio').innerText() + ')');
    await pg.goto(url + '#/agenda/tarefas/hoje'); ok(await pg.locator('.ag-pomo-mini').count() === 1, 'relógio continua visível fora da tela de foco');
    await pg.goto(url + '#/agenda/foco'); await pg.evaluate(() => { Telas.agenda._pomo.fimEm = Date.now() + 200; }); await pg.waitForTimeout(800);
    ok(/Pausa/.test(await pg.locator('.ag-relogio small').innerText()) && /1/.test(await pg.locator('.kpis div:first-child b').innerText()), 'pomodoro concluído vira pausa e conta 1 pomo');
    await foto('agenda-foco');
    // hábitos
    await pg.goto(url + '#/agenda/habitos'); await pg.click('[data-hb=novo]'); await pg.fill('.modal [name=nome]', 'Conferir novas licitações'); await submit();
    const hj = await pg.evaluate(() => Agenda.hojeLocal()); await pg.click('.ag-hab [data-hd="' + hj + '"]');
    ok(await pg.locator('.ag-hab-seq').innerText() === '1', 'check-in do hábito e sequência');
    await pg.click('.ag-hab-nome'); ok(await pg.locator('.ag-hab-det').count() === 1, 'detalhe do hábito com mês');
    await foto('agenda-habitos');
    // lembrete
    await pg.evaluate(() => { const n = new Date(); const x = Telas.agenda.criar('Ligar para o pregoeiro'); x.data = Agenda.hojeLocal(); x.hora = ('0' + n.getHours()).slice(-2) + ':' + ('0' + n.getMinutes()).slice(-2); x.lembrete = 0; Dados.salvar(); Telas.agenda._lembretes(); });
    ok(await pg.locator('.toast:has-text("⏰ Ligar para o pregoeiro")').count() === 1, 'lembrete dispara aviso');
    // exportar .ics
    await pg.click('[data-ag=config]'); const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('.modal [data-ics]')]);
    const ics = require('fs').readFileSync(await dl.path(), 'utf8'); ok(/BEGIN:VCALENDAR/.test(ics) && /SUMMARY:Sessão pública BLL/.test(ics) && /RRULE:FREQ=DAILY/.test(ics), 'exportar .ics');
    await pg.keyboard.press('Escape');
  },
  async notas(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]'); const fs = require('fs');
    await pg.goto(url); await pg.evaluate(() => { Dados.e.empresas.push({ id: 'empnf', razao: 'Papelaria Exemplo LTDA', fantasia: 'Papelaria Exemplo', cnpj: '11222333000181', porte: 'ME', uf: 'GO', municipio: 'Catalão' }); Dados.e.empresaAtiva = 'empnf'; Dados.salvar(); });
    await pg.goto(url + '#/notas/config'); await pg.fill('#nf-cfg [name=ie]', '101234567'); await pg.fill('#nf-cfg [name=logradouro]', 'Rua 10'); await pg.fill('#nf-cfg [name=proximoNumero]', '57'); await pg.click('#nf-cfg .btn.primario');
    ok(await pg.evaluate(() => Dados.e.empresas.find(e => e.id === 'empnf').fiscal.proximoNumero === 57), 'configurações fiscais do emitente');
    await pg.evaluate(() => { Dados.e.nfCfgGuia = { guiado: false }; Dados.salvar(); }); await pg.goto(url + '#/notas/saida'); await pg.click('.vazio [data-a=nfe]'); await pg.waitForSelector('.nf-ed');
    await pg.fill('[data-k="destinatario.documento"]', '11.444.777/0001-61'); await pg.fill('[data-k="destinatario.nome"]', 'Prefeitura Municipal de Catalão'); await pg.fill('[data-k="destinatario.municipio"]', 'Catalão');
    await pg.click('[data-nf=item]'); await pg.fill('[data-k="itens.0.descricao"]', 'Papel A4 75 g/m², caixa com 10 resmas'); await pg.fill('[data-k="itens.0.ncm"]', '48025610'); await pg.fill('[data-k="itens.0.quantidade"]', '200'); await pg.fill('[data-k="itens.0.valorUnitario"]', '238,50');
    ok(await pg.inputValue('[data-k="itens.0.cfop"]') === '5102', 'CFOP sugerido para venda dentro do estado');
    ok(/R\$\s?47\.700,00/.test(await pg.locator('#nf-totais').innerText()), 'total calculado ao digitar');
    ok(/nota de empenho/.test(await pg.locator('#nf-valid').innerText()), 'alerta: venda a órgão público sem empenho');
    await pg.fill('[data-k="contrato.empenho"]', '2026NE000123'); await pg.fill('[data-k="contrato.licitacao"]', 'Pregão eletrônico 90021/2026');
    ok(/Nota de empenho nº 2026NE000123 · Pregão eletrônico 90021\/2026/.test(await pg.locator('#nf-inf').innerText()) && /Simples Nacional/.test(await pg.locator('#nf-inf').innerText()), 'informações complementares automáticas');
    await pg.check('[data-k=retencaoFederal]'); await pg.waitForSelector('#nf-totais:has-text("dispensa de retenção")'); ok(true, 'Simples: dispensa de retenção federal');
    await pg.selectOption('[data-k="destinatario.uf"]', 'DF'); await pg.waitForSelector('#nf-valid:has-text("CFOP 5102 é de operação interna")'); ok(true, 'validação pega CFOP interno em venda interestadual');
    await pg.click('[data-nf=cfop]'); ok(await pg.inputValue('[data-k="itens.0.cfop"]') === '6108', 'CFOP 6108: interestadual para não contribuinte');
    await pg.fill('#nf-np', '2'); await pg.click('[data-nf=parcelas]'); ok(await pg.locator('[data-k^="duplicatas."][type=date]').count() === 2, 'duas duplicatas geradas');
    await pg.click('[data-nf=pronta]'); ok(await pg.evaluate(() => Dados.e.notas[0].situacao === 'pronta'), 'marcada como pronta');
    await foto('notas-editor');
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-nf=emissor]')]); const js = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    ok(js.cnpj_destinatario === '11444777000161' && js.items[0].cfop === '6108' && js.items[0].codigo_ncm === '48025610' && js.duplicatas.length === 2, 'JSON para o emissor (formato Focus NFe)');
    const chave = await pg.evaluate(() => Notas.montarChave({ uf: 'GO', ano: 2026, mes: 10, cnpj: '11222333000181', serie: 1, numero: 57, codigo: '10203040' }));
    await pg.click('[data-nf=autorizar]'); await pg.fill('.modal [name=chave]', chave.slice(0, 43) + ((+chave[43] + 1) % 10)); await pg.fill('.modal [name=protocolo]', '152260000099999'); await submit();
    ok(await pg.locator('.modal').count() === 1, 'chave com dígito errado é recusada');
    await pg.fill('.modal [name=chave]', chave); await submit(); await pg.waitForSelector('.danfe');
    ok(await pg.evaluate(() => { const n = Dados.e.notas[0]; return n.situacao === 'autorizada' && n.numero === 57 && Dados.e.empresas.find(e => e.id === 'empnf').fiscal.proximoNumero === 58; }), 'autorização registrada e numeração avança');
    await pg.waitForFunction(() => document.querySelectorAll('#dn-barras rect').length > 20, null, { timeout: 15000 }); ok(true, 'DANFE com código de barras da chave');
    ok(/2026NE000123/.test(await pg.locator('.danfe').innerText()) && await pg.locator('.dn-marca').count() === 0, 'DANFE autorizado sem marca d’água, com empenho');
    await foto('notas-danfe');
    await pg.click('[data-v=financeiro]'); ok(await pg.evaluate(() => Dados.e.financas.lancamentos.filter(l => l.tipo === 'receita' && !l.pago && /NF-e 000057/.test(l.descricao)).length === 2), 'duplicatas lançadas a receber em Minhas Finanças');
    await pg.click('[data-v=cce]'); await pg.fill('.modal [name=t]', 'Onde se lê caixa com 10 resmas, leia-se caixa com 10 resmas de 500 folhas'); await submit();
    ok(await pg.locator('.dn-cce').count() === 1, 'carta de correção registrada');
    // nota de entrada por XML
    const xml = await pg.evaluate(() => { const ch = Notas.montarChave({ uf: 'SP', ano: 2026, mes: 10, cnpj: '11444777000161', serie: 3, numero: 880, codigo: '55555555' }); return `<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe${ch}"><ide><natOp>Venda</natOp><mod>55</mod><serie>3</serie><nNF>880</nNF><dhEmi>2026-10-15T09:00:00-03:00</dhEmi><tpNF>1</tpNF></ide><emit><CNPJ>11444777000161</CNPJ><xNome>Distribuidora Paulista de Papel</xNome><enderEmit><xMun>São Paulo</xMun><UF>SP</UF></enderEmit></emit><dest><CNPJ>11222333000181</CNPJ><xNome>Papelaria Exemplo LTDA</xNome><enderDest><UF>GO</UF></enderDest></dest><det><prod><cProd>A4</cProd><xProd>Papel A4 75g cx 10</xProd><NCM>48025610</NCM><CFOP>6102</CFOP><uCom>CX</uCom><qCom>200</qCom><vUnCom>180.00</vUnCom><vProd>36000.00</vProd></prod><imposto><ICMS><ICMS00><orig>0</orig><CST>00</CST><pICMS>7</pICMS><vICMS>2520</vICMS></ICMS00></ICMS></imposto></det><total><ICMSTot><vProd>36000</vProd><vICMS>2520</vICMS><vNF>36000</vNF></ICMSTot></total><cobr><dup><nDup>001</nDup><dVenc>2026-11-15</dVenc><vDup>36000</vDup></dup></cobr></infNFe></NFe><protNFe><infProt><chNFe>${ch}</chNFe><nProt>135260000777</nProt><cStat>100</cStat><dhRecbto>2026-10-15T09:01:00-03:00</dhRecbto></infProt></protNFe></nfeProc>`; });
    await pg.goto(url + '#/notas/entrada'); const fc = pg.waitForEvent('filechooser'); await pg.click('.barra-acoes [data-a=xml]'); await (await fc).setFiles(t.arquivo('nfe-880.xml', xml));
    await pg.waitForSelector('tr:has-text("Distribuidora Paulista")'); ok(true, 'XML de compra importado como nota de entrada');
    ok(await pg.evaluate(() => { const f = (Dados.e.fornecedores || []).find(x => x.cnpj === '11444777000161'); return f && f.portfolio.some(p => p.preco === 180); }), 'fornecedor criado com o preço no portfólio');
    await pg.click('tr:has-text("Distribuidora Paulista")'); await pg.waitForSelector('.danfe'); await pg.click('[data-v=financeiro]');
    ok(await pg.evaluate(() => Dados.e.financas.lancamentos.some(l => l.tipo === 'despesa' && l.valor === 36000 && l.data === '2026-11-15')), 'duplicata da compra lançada a pagar');
    const fc2 = pg.waitForEvent('filechooser'); await pg.goto(url + '#/notas/entrada'); await pg.click('.barra-acoes [data-a=xml]'); await (await fc2).setFiles(t.arquivo('nfe-880b.xml', xml));
    await pg.waitForSelector('.toast:has-text("1 já existiam")'); ok(await pg.locator('tbody tr').count() === 1, 'XML repetido não duplica a nota');
    await pg.goto(url + '#/notas/relatorios'); ok(/R\$\s?47\.700,00/.test(await pg.locator('.kpis').innerText()), 'relatório: faturamento de 12 meses');
    await pg.goto(url + '#/notas/saida'); await pg.click('tr:has-text("Prefeitura") [data-danfe]'); await pg.waitForSelector('[data-v=cancelar]'); await pg.click('[data-v=cancelar]'); await pg.fill('.modal [name=j]', 'curta'); await submit();
    ok(await pg.locator('.modal').count() === 1, 'cancelamento exige justificativa de 15 caracteres');
    await pg.fill('.modal [name=j]', 'Erro na quantidade faturada ao órgão'); await pg.fill('.modal [name=p]', '152260000100000'); await submit();
    await pg.waitForSelector('.dn-marca:has-text("CANCELADA")'); ok(true, 'nota cancelada com marca d’água');
    await pg.evaluate(() => { Dados.e.empresaAtiva = Dados.e.empresas[0] && Dados.e.empresas[0].id !== 'empnf' ? Dados.e.empresas[0].id : 'empnf'; Dados.salvar(); });
  },
  async comercial(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]'); const fs = require('fs');
    // PNCP e Receita simulados com o formato real das APIs
    const dia = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 19);
    const orgs = ['Prefeitura de Catalão', 'Prefeitura de Goiânia', 'Secretaria de Educação de Goiás', 'Prefeitura de Anápolis', 'Câmara de Catalão'];
    const compra = (i, aberta) => ({ numeroControlePNCP: (aberta ? 'AB' : 'CP') + i, orgaoEntidade: { cnpj: String(10000000000000 + i), razaoSocial: orgs[i % 5], esferaId: i % 3 ? 'M' : 'E' }, anoCompra: 2026, sequencialCompra: i, unidadeOrgao: { nomeUnidade: 'Compras', municipioNome: 'Catalão', ufSigla: 'GO', codigoIbge: '5205109' }, objetoCompra: (i % 2 ? 'Aquisição de papel A4 e material de expediente' : 'Registro de preços de toner e cartuchos') + ' lote ' + i, modalidadeId: 6, modalidadeNome: 'Pregão - Eletrônico', numeroCompra: String(90000 + i), processo: 'P' + i, srp: true, situacaoCompraNome: aberta ? 'Divulgada no PNCP' : 'Homologada', valorTotalEstimado: 150000 + i * 1000, valorTotalHomologado: aberta ? null : 120000 + i * 1000, dataAberturaProposta: dia(-2), dataEncerramentoProposta: aberta ? new Date(Date.now() + (5 + i) * 864e5).toISOString().slice(0, 19) : dia(30 + i), dataPublicacaoPncp: dia(10 + i * 3), dataAtualizacao: dia(5) });
    const compras = Array.from({ length: 14 }, (_, i) => compra(i + 1)); const abertas = Array.from({ length: 3 }, (_, i) => compra(i + 50, true));
    await pg.route('**/pncp.gov.br/api/consulta/v1/contratacoes/publicacao**', r => r.fulfill({ json: { data: compras, totalPaginas: 1, totalRegistros: compras.length } }));
    await pg.route('**/pncp.gov.br/api/consulta/v1/contratacoes/proposta**', r => r.fulfill({ json: { data: abertas, totalPaginas: 1, totalRegistros: 3 } }));
    await pg.route(/pncp\.gov\.br\/api\/pncp\/v1\/orgaos\/\d+\/compras\/\d+\/\d+\/itens(\?.*)?$/, r => { if (/pagina=2/.test(r.request().url())) return r.fulfill({ json: [] }); r.fulfill({ json: [{ numeroItem: 1, descricao: 'Papel A4 75 g/m² resma 500 folhas', quantidade: 1000, unidadeMedida: 'Resma', valorUnitarioEstimado: 30, temResultado: true }, { numeroItem: 2, descricao: 'Toner compatível HP 85A', quantidade: 50, unidadeMedida: 'Unidade', valorUnitarioEstimado: 120, temResultado: true }] }); });
    await pg.route(/\/itens\/\d+\/resultados/, r => { const seq = Number(r.request().url().match(/compras\/2026\/(\d+)\//)[1]); const lider = seq % 3 !== 0; r.fulfill({ json: [{ nomeRazaoSocialFornecedor: lider ? 'Alfa Distribuidora LTDA' : (seq % 2 ? 'Beta Papéis ME' : 'Papelaria Exemplo LTDA'), niFornecedor: lider ? '22333444000155' : (seq % 2 ? '33444555000166' : '11222333000181'), porteFornecedorId: lider ? 3 : 1, valorUnitarioHomologado: /itens\/1\//.test(r.request().url()) ? 24 : 96, quantidadeHomologada: 100, valorTotalHomologado: /itens\/1\//.test(r.request().url()) ? 2400 : 9600, dataResultado: dia(20) }] }); });
    await pg.route('**/brasilapi.com.br/api/cnpj/v1/**', r => r.fulfill({ json: { cnpj: '11222333000181', razao_social: 'PAPELARIA EXEMPLO LTDA', nome_fantasia: 'PAPELARIA EXEMPLO', uf: 'GO', municipio: 'CATALAO', porte: 'MICRO EMPRESA', data_inicio_atividade: '2015-03-15', descricao_situacao_cadastral: 'ATIVA', cnae_fiscal: 4761003, cnae_fiscal_descricao: 'Comércio varejista de artigos de papelaria', cnaes_secundarios: [{ codigo: 4751201, descricao: 'Comércio varejista especializado de equipamentos e suprimentos de informática' }], qsa: [{ nome_socio: 'MARIA DA SILVA', qualificacao_socio: 'Sócio-Administrador' }], ddd_telefone_1: '6434410000', email: 'CONTATO@EXEMPLO.COM' } }));
    await pg.goto(url + '#/comercial'); await pg.waitForSelector('.kpis');
    await pg.goto(url + '#/comercial/contas'); await pg.click('.vazio [data-a=nova]'); await pg.fill('.modal [name=cnpj]', '11.222.333/0001-81'); await pg.click('.modal [data-receita]');
    await pg.waitForFunction(() => document.querySelector('.modal [name=razao]').value === 'PAPELARIA EXEMPLO LTDA'); ok(true, 'cadastro pelo CNPJ (Receita)');
    await pg.fill('.modal [name=oQueVende]', 'Papel A4, toner, cartuchos, canetas e material de escritório'); await submit(); await pg.waitForSelector('.fo-cab');
    ok(await pg.evaluate(() => { const c = Dados.e.comercial.contas[0]; return c.contatos[0].nome === 'MARIA DA SILVA' && c.contatos[0].papel === 'Decisor' && c.cnae.descricao.includes('papelaria'); }), 'sócio-administrador sugerido como decisor e CNAE gravado');
    ok(await pg.evaluate(() => Dados.e.comercial.negocios.length === 1 && Dados.e.comercial.negocios[0].etapa === 'lead'), 'negócio aberto no funil');
    await pg.click('[data-ed-ct]'); await pg.fill('.modal [name=whatsapp]', '(64) 99999-1234'); await submit();
    await pg.click('[data-aba=diagnostico]'); for (const k of ['vendeGoverno', 'semEquipe', 'dorDeclarada', 'decisor']) await pg.check('#cm-diag [value=' + k + ']');
    await pg.fill('#cm-diag [name=problema]', 'Perderam 3 pregões por certidão vencida no último semestre'); await pg.fill('#cm-diag [name=necessidade]', 'Disputar todas as licitações de papel e toner em GO e DF'); await pg.click('#cm-diag .btn.primario');
    ok(/ICP B|ICP A/.test(await pg.locator('.fo-cab').innerText()), 'ICP calculado pelo diagnóstico');
    // estudo de mercado
    await pg.click('[data-aba=estudo]'); const termos = await pg.inputValue('#es-form [name=termos]'); ok(/papelaria/.test(termos) && /toner/.test(termos), 'termos sugeridos do CNAE e do catálogo (' + termos + ')');
    await pg.fill('#es-form [name=termos]', 'papel, toner'); await pg.evaluate(() => document.querySelectorAll('#es-form [name=uf]').forEach(x => { x.checked = false; })); await pg.check('#es-form [name=uf][value=GO]'); await pg.selectOption('#es-form [name=meses]', '3');
    await pg.click('#es-form .btn.primario'); await pg.waitForSelector('.es-rel', { timeout: 60000 });
    const rel = await pg.locator('.es-rel').innerText();
    ok(await pg.evaluate(() => [...Array(14).keys()].every(n => document.querySelectorAll('.es-rel #es-' + n).length === 1)), 'relatório com seções 0 a 13');
    ok(await pg.locator('#es-13').count() === 1 && /Decisão recomendada:/.test(rel) && /Confiança:/.test(rel), 'abre com decisão e confiança');
    ok(/14 licitações/.test(rel) && /Alfa Distribuidora/.test(rel), 'licitações e concorrente líder vindos do PNCP');
    ok(/A PAPELARIA EXEMPLO já aparece entre os vencedores/i.test(rel), 'identifica o cliente entre os vencedores');
    ok(await pg.locator('.es-tag.es-v').count() > 5 && await pg.locator('.es-tag.es-e').count() > 0 && await pg.locator('.es-tag.es-h').count() === 4, 'números etiquetados (Verificado / Estimado / Hipótese)');
    ok(await pg.locator('#es-8 tbody tr').first().count() === 1 && /lote 5[0-2]/.test(await pg.locator('#es-8').innerText()), 'oportunidades abertas listadas');
    ok(/Verificado/.test(await pg.locator('#es-0').innerText()) && /0 Memória/.test(await pg.locator('#es-0').innerText()), 'ficha com mix de evidência');
    await foto('comercial-estudo');
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-exp]')]); ok(/estudo-papelaria-exemplo\.xlsx$/.test(dl.suggestedFilename()), 'exportar dados do estudo');
    // proposta
    await pg.goto(url + '#/comercial/config'); await pg.fill('#cm-cfg [name=mens0]', '1500'); await pg.fill('#cm-cfg [name=mens1]', '2500'); await pg.fill('#cm-cfg [name=mens2]', '4000'); await pg.fill('#cm-cfg [name=exi1]', '2'); await pg.click('#cm-cfg .btn.primario');
    await pg.goto(url + '#/comercial/contas'); await pg.click('tr[data-ver]'); await pg.waitForSelector('.fo-cab'); await pg.click('[data-aba=proposta]'); await pg.click('[data-prop=criar]');
    ok(await pg.inputValue('.modal [name=m1]') === '2500,00' || await pg.inputValue('.modal [name=m1]') === '2500', 'proposta herda os planos'); await pg.fill('.modal [name=sal]', '4500'); await submit();
    ok(/Retorno/.test(await pg.locator('.kpis').innerText()) && /R\$\s?30\.000|R\$\s?3\d\.\d{3}/.test(await pg.locator('.kpis').innerText()), 'proposta com investimento e retorno');
    await pg.click('a:has-text("Ver / imprimir")'); await pg.waitForSelector('.cm-prop'); ok(await pg.locator('.cm-opcao').count() === 3 && await pg.locator('.cm-opcao.rec').count() === 1, 'proposta impressa com 3 opções e recomendada');
    ok(/Perderam 3 pregões/.test(await pg.locator('.cm-prop').innerText()) && /Lucas Neves \| Seven/.test(await pg.locator('.cm-prop').innerText()), 'proposta usa o diagnóstico e a assinatura');
    await foto('comercial-proposta');
    await pg.click('a:has-text("Voltar")'); await pg.waitForSelector('.fo-cab'); await pg.click('[data-prop=enviada]');
    ok(await pg.evaluate(() => Dados.e.comercial.negocios[0].etapa === 'proposta' && Dados.e.comercial.atividades.filter(a => a.cadencia === 'pos_proposta').length === 5), 'enviada: etapa avança e cadência de follow-up criada');
    // mensagem a partir do script
    await pg.evaluate(() => { window.open = (u) => { window.__aberto = u; return null; }; });
    await pg.click('[data-aba=atividades]'); await pg.click('[data-script]:has-text("primeiro contato")');
    const msg = await pg.inputValue('.modal [name=t]'); ok(/Oi, MARIA!/.test(msg) && /\*14 licitações\*/.test(msg) && /Lucas Neves \| Seven/.test(msg), 'script preenchido com dados do estudo');
    await pg.click('.modal [data-ir]'); ok((await pg.evaluate(() => window.__aberto)).startsWith('https://wa.me/5564999991234'), 'abre o WhatsApp do decisor');
    // funil
    await pg.goto(url + '#/comercial/funil'); await pg.waitForSelector('.cm-card'); const soltar = (etapa) => pg.evaluate((et) => { const dt = new DataTransfer(); const card = document.querySelector('.cm-card'); card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); const col = document.querySelector('.cm-col[data-etapa=' + et + ']'); col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); col.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); }, etapa); await soltar('negociacao'); await pg.waitForTimeout(200);
    ok(await pg.evaluate(() => Dados.e.comercial.negocios[0].etapa === 'negociacao'), 'arrastar no funil muda a etapa');
    await soltar('ganho'); await pg.waitForSelector('.modal'); await submit(); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => Dados.e.empresas.some(e => e.cnpj === '11222333000181') && (Dados.e.agenda.tarefas || []).filter(x => x.tags.includes('onboarding')).length === 3), 'ganho: vira cliente e cria onboarding na Agenda');
    await foto('comercial-funil');
    await pg.goto(url + '#/comercial'); const kp = await pg.locator('.kpis').innerText(); ok(/Taxa de ganho\s*100%/.test(kp) && /Novos clientes no mês\s*1/.test(kp), 'painel: taxa de ganho e meta do mês');
    await foto('comercial-painel');
    await pg.unrouteAll({ behavior: 'ignoreErrors' });
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
  },
  async habilitacao(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]');
    await pg.goto(url); await pg.evaluate(() => {
      Dados.e.empresas.push({ id: 'emphb', razao: 'Papelaria Exemplo LTDA', fantasia: 'Papelaria Exemplo', cnpj: '11222333000181', uf: 'GO', municipio: 'Catalão' }); Dados.e.empresaAtiva = 'emphb';
      const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
      Dados.e.documentos.push({ id: 'dh1', empresaId: 'emphb', nome: 'CND Federal', tipo: 'Habilitação', validade: d(90) }, { id: 'dh2', empresaId: 'emphb', nome: 'CRF FGTS', tipo: 'Habilitação', validade: d(3) }, { id: 'dh3', empresaId: 'emphb', nome: 'Certidão Municipal', tipo: 'Habilitação', validade: d(-2) }, { id: 'dh4', empresaId: 'emphb', nome: 'Contrato Social', tipo: 'Habilitação' });
      Dados.salvar(); });
    await pg.goto(url + '#/habilitacao'); await pg.waitForSelector('.hb-resumo');
    ok(await pg.locator('.menu a[data-rota=habilitacao].ativo').count() === 1, 'menu SICAF e Certidões ativo');
    ok(await pg.locator('tr[data-item=cnd-federal] .hb-st-ok').count() === 1, 'CND Federal válida reconhecida pelo nome');
    ok(await pg.locator('tr[data-item=crf-fgts] .hb-st-vencendo').count() === 1, 'FGTS vencendo');
    ok(await pg.locator('tr[data-item=cnd-municipal] .hb-st-vencido').count() === 1, 'certidão municipal vencida');
    ok(await pg.getAttribute('tr[data-item=cnd-municipal] a.btn', 'href') === 'https://www.catalao.go.gov.br/certidoes-negativas', 'emitir certidão municipal leva à prefeitura de Catalão');
    ok((await pg.getAttribute('tr[data-item=cnd-estadual] a.btn', 'href')).includes('go.gov.br/servicos-digitais/economia'), 'emitir certidão estadual leva à Economia-GO');
    ok(await pg.locator('.abas a.ativa .contador').innerText() === '2', 'contador de vencidos/vencendo na aba');
    await pg.click('[data-a=lembretes]'); ok(await pg.evaluate(() => Dados.e.agenda.tarefas.filter(x => /^Renovar /.test(x.titulo)).length === 3), 'lembretes de renovação criados na Agenda');
    await pg.click('[data-a=lembretes]'); ok(await pg.evaluate(() => Dados.e.agenda.tarefas.filter(x => /^Renovar /.test(x.titulo)).length === 3), 'lembretes não duplicam');
    await foto('habilitacao-cliente');
    await pg.goto(url + '#/habilitacao/estados'); await pg.waitForSelector('tr[data-txt]');
    ok(await pg.locator('tr[data-txt]').count() === 27, '27 UFs na visão geral');
    await pg.fill('.hb-filtro', 'tocantins'); ok(await pg.locator('tr[data-txt]:visible').count() === 1, 'filtro por estado');
    await pg.goto(url + '#/habilitacao/estados/RN'); ok(await pg.locator('.hb-card .hb-n').count() >= 1 && await pg.locator('.hb-card a:has-text("Buscar")').count() >= 1, 'link não confirmado mostra busca');
    await foto('habilitacao-estado');
    await pg.goto(url + '#/habilitacao/municipios/GO'); await pg.waitForSelector('#hb-busca');
    ok(await pg.locator('.hb-tab tr').count() === 2, 'Goiânia e Catalão listadas');
    await pg.fill('#hb-busca input', 'Anápolis'); await pg.click('[data-a=novo]');
    await pg.fill('.modal [name=u]', 'javascript:alert(1)'); await submit(); ok(await pg.locator('.modal').count() === 1, 'URL inválida recusada');
    await pg.fill('.modal [name=u]', 'https://www.anapolis.go.gov.br/'); await submit(); await pg.waitForSelector('.hb-u');
    ok(await pg.locator('.hb-tab tr').count() === 3 && await pg.evaluate(() => Dados.e.linksHab[0].m === 'Anápolis'), 'link municipal cadastrado pela equipe');
    await pg.goto(url + '#/habilitacao/sicaf'); await pg.waitForSelector('.hb-nivel');
    ok(await pg.locator('.hb-nivel').count() === 6, '6 níveis do SICAF');
    await pg.click('[data-a=revisei]'); ok(await pg.evaluate(() => !!Dados.e.sicafRev.emphb), 'revisão do SICAF registrada');
    await foto('habilitacao-sicaf');
    await pg.goto(url + '#/cadastrar/documentos'); ok(await pg.locator('#conteudo a[href="#/habilitacao"]').count() === 1, 'atalho em Meus Documentos');
  },
  async loja(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]');
    await pg.goto(url); await pg.evaluate(() => { Dados.e.empresas.push({ id: 'emplj', razao: 'Papelaria Exemplo LTDA', fantasia: 'Papelaria Exemplo', cnpj: '11222333000181', uf: 'GO', municipio: 'Catalão' }); Dados.e.empresaAtiva = 'emplj'; Dados.salvar(); });
    await pg.goto(url + '#/loja'); await pg.waitForSelector('.lj-hero');
    ok(await pg.locator('.lj-cat-card').count() === 6, '6 categorias na vitrine');
    ok(await pg.locator('.lj-preco.consulta').count() > 0 && await pg.evaluate(() => Dados.e.loja.produtos.every(p => p.preco === null)), 'catálogo inicial sem preço inventado (sob consulta)');
    await pg.goto(url + '#/loja/admin'); await pg.click('tr[data-id=analise-edital] [data-a=editar]');
    await pg.fill('.modal [name=preco]', '450,00'); await pg.fill('.modal [name=precoDe]', '600'); await submit();
    await pg.click('tr[data-id=sicaf] [data-a=editar]'); await pg.fill('.modal [name=preco]', '890'); await submit();
    ok(await pg.evaluate(() => Dados.e.loja.produtos.find(p => p.id === 'analise-edital').preco === 450), 'preço definido em Gerenciar loja');
    await pg.goto(url + '#/loja/admin/cupons'); await pg.click('[data-a=cupom]'); await pg.fill('.modal [name=codigo]', 'bemvindo'); await pg.fill('.modal [name=valor]', '10'); await submit();
    ok(await pg.evaluate(() => Dados.e.loja.cupons[0].codigo === 'BEMVINDO'), 'cupom criado');
    await pg.goto(url + '#/loja'); await pg.fill('#lj-busca [name=q]', 'edital'); await pg.press('#lj-busca [name=q]', 'Enter'); await pg.waitForSelector('.lj-res-cab');
    ok(await pg.locator('.lj-grade .lj-card').first().getAttribute('data-p') === 'analise-edital', 'busca acha análise de edital primeiro');
    ok(await pg.locator('.lj-off').count() >= 1, 'oferta mostra % de desconto');
    await pg.selectOption('#lj-ordem', 'maior'); ok(await pg.locator('.lj-grade .lj-card').first().getAttribute('data-p') === 'analise-edital', 'ordenar por maior preço');
    await pg.goto(url + '#/loja/busca/'); await pg.check('#lj-filtros [name=cat][value=juridico]'); await pg.waitForTimeout(100);
    ok(await pg.evaluate(() => [...document.querySelectorAll('.lj-grade .lj-card')].every(c => Dados.e.loja.produtos.find(p => p.id === c.dataset.p).cat === 'juridico')), 'filtro de categoria');
    await pg.goto(url + '#/loja/p/analise-edital'); await pg.waitForSelector('.lj-prod');
    ok(/até 4x/.test(await pg.locator('.lj-compra .lj-parc').innerText()), 'parcelamento respeita parcela mínima');
    await pg.selectOption('#lj-qtd', '2'); await pg.click('[data-a=add-qtd]'); ok(await pg.locator('.lj-cn').innerText() === '2', 'contador do carrinho');
    await pg.click('.lj-prod [data-a=desejo]'); ok(await pg.evaluate(() => Dados.e.loja.desejos.includes('analise-edital')), 'lista de desejos');
    await pg.fill('#lj-perguntar [name=q]', 'Atende pregão de outro estado?'); await pg.click('#lj-perguntar button'); ok(await pg.locator('.lj-qa').count() === 1, 'pergunta registrada');
    await pg.click('[data-a=avaliar]'); await pg.fill('.modal [name=autor]', 'Ana'); await pg.fill('.modal [name=texto]', 'Parecer claro.'); await submit();
    ok(await pg.locator('.modal').count() === 1, 'avaliação exige autorização do cliente');
    await pg.check('.modal [name=consentimento]'); await submit(); await pg.waitForSelector('.lj-aval-l article'); ok(true, 'avaliação publicada');
    await foto('loja-produto');
    await pg.goto(url + '#/loja/p/sicaf'); await pg.click('[data-a=add-qtd]');
    await pg.goto(url + '#/loja/p/bpo-completo'); await pg.click('[data-a=add-qtd]');
    await pg.goto(url + '#/loja/carrinho'); await pg.waitForSelector('.lj-linha');
    ok(/Subtotal \(4 itens\): R\$ 1\.790,00/.test(await pg.locator('.lj-sub').innerText()), 'subtotal com item sob consulta fora da soma');
    await pg.fill('#lj-cupom [name=c]', 'bemvindo'); await pg.click('#lj-cupom button');
    ok(/R\$ 1\.611,00/.test(await pg.locator('.lj-total').innerText()), 'cupom de 10% aplicado');
    await pg.click('.lj-linha[data-id=sicaf] [data-a=depois]'); ok(await pg.locator('[data-depois]').count() === 1, 'salvar para mais tarde');
    await pg.click('[data-depois] [data-a=voltar]');
    await foto('loja-carrinho');
    await pg.click('.lj-fechar'); await pg.waitForSelector('#lj-co');
    ok(await pg.inputValue('#lj-co [name=razao]') === 'Papelaria Exemplo LTDA', 'cliente ativo preenchido');
    await pg.fill('#lj-co [name=telefone]', '(64) 99999-0000'); await pg.fill('#lj-co [name=contato]', 'Ana'); await pg.click('.lj-resumo .lj-fechar');
    await pg.waitForSelector('.lj-pedido');
    ok(await pg.evaluate(() => { const o = Dados.e.loja.pedidos[0]; return o.numero === new Date().getFullYear() + '-0001' && o.total === 1611 && o.consulta === 1 && Dados.e.loja.carrinho.length === 0 && Dados.e.loja.cupons[0].usos === 1; }), 'pedido gerado, carrinho limpo, uso do cupom contado');
    await pg.evaluate(() => { window.open = (u) => { window.__aberto = u; return null; }; });
    await pg.click('[data-a=whats]'); ok(/Lucas Neves \| Seven$/.test(await pg.inputValue('.modal [name=m]')), 'mensagem com assinatura para revisar');
    await submit(); ok((await pg.evaluate(() => window.__aberto)).startsWith('https://wa.me/5564999990000?text='), 'abre WhatsApp do cliente (usuário envia)');
    await pg.click('[data-a=avancar]'); ok(await pg.evaluate(() => Dados.e.loja.pedidos[0].status === 'confirmado'), 'status avança');
    await pg.click('[data-a=crm]'); ok(await pg.evaluate(() => Dados.e.comercial.negocios.some(n => n.origem && n.origem.startsWith('loja:'))), 'negócio criado no Comercial');
    await foto('loja-pedido');
    await pg.goto(url + '#/loja/p/analise-edital'); ok(await pg.locator('.lj-juntos').count() === 1, 'comprados juntos com frequência');
    await pg.goto(url + '#/loja'); ok(await pg.locator('.lj-trilho:has-text("Mais pedidos") .lj-card').count() === 3, 'trilho Mais pedidos');
    await foto('loja-inicio');
    await pg.setViewportSize({ width: 390, height: 844 }); await pg.goto(url + '#/loja'); await pg.waitForSelector('.lj-hero');
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= 392), 'sem rolagem horizontal no celular'); await foto('loja-celular');
    await pg.setViewportSize({ width: 1440, height: 900 });
  },
  async jogos(t) {
    const { pg, url, ok, foto } = t;
    await pg.goto(url + '#/jogos'); await pg.waitForSelector('.jg-dia');
    ok(await pg.locator('.jg-card').count() === 7 && await pg.locator('.jg-dia-c').count() === 4, '7 jogos e treino do dia com 4');
    ok(await pg.locator('.jg-ciencia a[href^="https://"]').count() >= 8, 'seção da ciência com fontes');
    await foto('jogos-inicio');
    // quiz: responde certo usando o gabarito
    await pg.goto(url + '#/jogos/quiz'); await pg.waitForSelector('.jg-op');
    for (let i = 0; i < 10; i++) {
      const certa = await pg.evaluate(() => { const p = document.querySelector('.jg-quiz h3').textContent; const q = Jogos.QUESTOES.find(x => x.p === p); return q.o[q.c]; });
      await pg.evaluate((c) => [...document.querySelectorAll('.jg-op')].find(b => b.lastChild.textContent === c).click(), certa); await pg.waitForSelector('.jg-op.certa');
      if (i === 0) await foto('jogos-quiz');
      await pg.click('[data-j=prox]');
    }
    await pg.waitForSelector('.jg-fim'); ok(/10 de 10/.test(await pg.locator('.jg-fim h3').innerText()), 'quiz completo com 10 acertos');
    ok(await pg.evaluate(() => Object.keys(Dados.e.jogos.quiz).length === 10 && Object.values(Dados.e.jogos.quiz).every(s => s.caixa === 1)), 'repetição espaçada registrada');
    // memória: resolve com o baralho
    await pg.goto(url + '#/jogos/memoria'); await pg.click('[data-p="6"]'); await pg.waitForSelector('.jg-carta');
    const pares = await pg.evaluate(() => { const fr = [...document.querySelectorAll('.jg-carta')].map(b => b.querySelector('.jg-frente').textContent); const p = {}; Jogos.PARES.forEach(([a, b]) => { p[a] = b; }); const out = []; fr.forEach((t, i) => { if (p[t] !== undefined) out.push([i, fr.indexOf(p[t])]); }); return out; });
    ok(pares.length === 6, 'baralho com 6 pares');
    for (const [a, b] of pares) { await pg.click(`.jg-carta[data-id="${a}"]`); await pg.click(`.jg-carta[data-id="${b}"]`); }
    await pg.waitForSelector('.jg-fim'); ok(/6 jogadas/.test(await pg.locator('.jg-fim h3').innerText()), 'memória resolvida em 6 jogadas');
    // xadrez: jogada humana e resposta do computador
    await pg.goto(url + '#/jogos/xadrez'); await pg.waitForSelector('.jg-tab');
    ok(await pg.locator('.jg-cx').count() === 64, 'tabuleiro 8x8');
    await pg.click('.jg-cx[aria-label^="e2"]'); ok(await pg.locator('.jg-cx.alvo').count() === 2, 'mostra destinos do peão');
    await pg.click('.jg-cx[aria-label="e4"]'); await pg.waitForFunction(() => Dados.e.jogos.xadrez.lances.length === 2, null, { timeout: 15000 });
    ok(await pg.evaluate(() => Dados.e.jogos.xadrez.lances[0] === 'e4'), 'lance e4 e resposta do computador');
    await foto('jogos-xadrez');
    await pg.click('[data-x=voltar]'); ok(await pg.evaluate(() => Dados.e.jogos.xadrez.lances.length === 0), 'voltar lance');
    // matrizes
    await pg.goto(url + '#/jogos/matrizes'); await pg.waitForSelector('.jg-mt-ops button');
    ok(await pg.locator('.jg-mt-g > div').count() === 9 && await pg.locator('.jg-mt-ops button').count() === 6, 'matriz 3x3 com 6 opções');
    await foto('jogos-matrizes');
    // lances
    await pg.goto(url + '#/jogos/lances'); await pg.click('[data-j=comecar]'); await pg.waitForSelector('#jg-ln-q');
    for (let i = 0; i < 3; i++) { const r = await pg.evaluate(() => { const p = document.querySelector('#jg-ln-q').textContent; for (let s = 0; s < 1; s++); return p; }); await pg.fill('#jg-ln-r', '0'); await pg.press('#jg-ln-r', 'Enter'); await pg.waitForTimeout(2100); }
    ok(/acerto/.test(await pg.locator('#jg-ln-p').innerText()), 'sprint de lances responde');
    // schulte
    await pg.goto(url + '#/jogos/schulte'); await pg.waitForSelector('.jg-sc-g button');
    for (let v = 1; v <= 25; v++) await pg.click(`.jg-sc-g [data-v="${v}"]`);
    await pg.waitForSelector('.jg-fim'); ok(true, 'tabela de 1 a 25 completa');
    // n-back curto: começa e mostra estímulo
    await pg.goto(url + '#/jogos/nback'); await pg.click('[data-j=comecar]'); await pg.waitForSelector('.jg-nb-c.on', { timeout: 3000 });
    ok(/^[A-Z]$/.test(await pg.locator('.jg-nb-c.on').innerText()), 'n-back mostra posição e letra'); await pg.keyboard.press('a');
    await foto('jogos-nback');
    await pg.goto(url + '#/jogos'); await pg.waitForSelector('.jg-seq');
    ok(/1/.test(await pg.locator('.jg-seq b').innerText()) && await pg.locator('.jg-dia-c.feito').count() >= 1, 'sequência de dias e treino marcado');
    await pg.setViewportSize({ width: 390, height: 844 }); await pg.goto(url + '#/jogos/xadrez'); await pg.waitForSelector('.jg-tab');
    ok(await pg.evaluate(() => document.documentElement.scrollWidth <= 392), 'xadrez cabe no celular'); await foto('jogos-xadrez-celular');
    await pg.setViewportSize({ width: 1440, height: 900 });
  },
  async anotacoes(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]');
    await pg.goto(url + '#/anotacoes'); await pg.waitForSelector('.an');
    await pg.click('.an-lado [data-a=nova-pasta]'); await pg.fill('.modal [name=nome]', 'Clientes'); await submit();
    ok(await pg.evaluate(() => Dados.e.anotacoes.pastas[0].nome === 'Clientes'), 'pasta criada');
    await pg.click('.an-lado [data-pasta]'); await pg.click('.an-nova'); await pg.waitForSelector('#an-texto');
    await pg.fill('#an-tit', 'Reunião Papelaria Exemplo');
    await pg.click('#an-texto'); await pg.keyboard.type('Pontos da conversa #catalao');
    await pg.keyboard.press('Enter'); await pg.click('[data-cmd=check]'); await pg.keyboard.type('Enviar proposta');
    await pg.click('[data-cmd=bold]'); await pg.keyboard.type(' urgente');
    await pg.waitForTimeout(600);
    ok(await pg.evaluate(() => { const n = Dados.e.anotacoes.notas[0]; return n.titulo === 'Reunião Papelaria Exemplo' && /Pontos da conversa/.test(n.html) && /data-check="0"/.test(n.html) && /<b>|<strong>/.test(n.html) && n.pasta === Dados.e.anotacoes.pastas[0].id; }), 'texto rico, checklist e pasta salvos automaticamente');
    await pg.click('#an-texto li[data-check]', { position: { x: 8, y: 14 } }); await pg.waitForTimeout(600);
    ok(await pg.evaluate(() => /data-check="1"/.test(Dados.e.anotacoes.notas[0].html)), 'marcar item do checklist');
    // escrita à mão
    await pg.click('[data-e=modo-caneta]'); const box = await pg.locator('#an-tela').boundingBox();
    await pg.mouse.move(box.x + 100, box.y + 300); await pg.mouse.down(); for (let i = 0; i < 20; i++) await pg.mouse.move(box.x + 100 + i * 10, box.y + 300 + Math.sin(i / 3) * 30); await pg.mouse.up();
    await pg.click('[data-ferr=marca]'); await pg.mouse.move(box.x + 100, box.y + 400); await pg.mouse.down(); await pg.mouse.move(box.x + 300, box.y + 400, { steps: 8 }); await pg.mouse.up();
    await pg.waitForTimeout(600);
    ok(await pg.evaluate(() => { const tr = Dados.e.anotacoes.notas[0].tracos; return tr.length === 2 && tr[0].ferr === 'caneta' && tr[1].ferr === 'marca' && tr[0].pts.length < 21; }), 'traços de caneta e marca-texto salvos (simplificados)');
    await pg.click('[data-e=t-desfazer]'); await pg.waitForTimeout(500); ok(await pg.evaluate(() => Dados.e.anotacoes.notas[0].tracos.length === 1), 'desfazer traço');
    await pg.click('[data-e=t-refazer]'); await pg.click('[data-ferr=borracha]');
    await pg.mouse.move(box.x + 200, box.y + 400); await pg.mouse.down(); await pg.mouse.move(box.x + 205, box.y + 402); await pg.mouse.up(); await pg.waitForTimeout(500);
    ok(await pg.evaluate(() => Dados.e.anotacoes.notas[0].tracos.length === 1), 'borracha apaga o traço');
    await foto('anotacoes-editor');
    // lista
    await pg.goto(url + '#/anotacoes'); await pg.waitForSelector('.an-card');
    ok(/Reunião Papelaria/.test(await pg.locator('.an-card footer b').innerText()) && /☑ 1\/1/.test(await pg.locator('.an-card footer small').innerText()), 'cartão com título e progresso do checklist');
    ok(await pg.locator('.an-tags a:has-text("#catalao")').count() === 1, 'tag na lateral');
    await pg.fill('#an-q', 'papelaria'); ok(await pg.locator('.an-card').count() === 1, 'busca'); await pg.fill('#an-q', 'xyz'); ok(await pg.locator('.an-card').count() === 0, 'busca sem resultado'); await pg.fill('#an-q', '');
    // bloquear
    await pg.click('.an-card'); await pg.waitForSelector('#an-texto'); await pg.click('[data-e=bloquear]');
    await pg.fill('.modal [name=s1]', 'seven2026'); await pg.fill('.modal [name=s2]', 'outra'); await submit(); ok(await pg.locator('.modal').count() === 1, 'senhas diferentes recusadas');
    await pg.fill('.modal [name=s2]', 'seven2026'); await submit(); await pg.waitForTimeout(300);
    ok(await pg.evaluate(() => { const n = Dados.e.anotacoes.notas[0]; return n.cifrado && !n.html && !n.tracos.length && !JSON.stringify(Dados.e.anotacoes).includes('Pontos da conversa'); }), 'conteúdo cifrado, sem texto aberto no armazenamento');
    await pg.goto(url + '#/anotacoes'); await pg.click('.an-card'); await pg.waitForSelector('#an-desb');
    await pg.fill('#an-desb [name=s]', 'errada'); await pg.click('#an-desb button'); await pg.waitForSelector('#an-erro:not([hidden])'); ok(/Senha incorreta/.test(await pg.locator('#an-erro').innerText()), 'senha errada');
    await pg.fill('#an-desb [name=s]', 'seven2026'); await pg.click('#an-desb button'); await pg.waitForSelector('#an-texto');
    ok(/Pontos da conversa/.test(await pg.locator('#an-texto').innerText()), 'desbloqueia com a senha');
    await pg.click('#an-texto'); await pg.keyboard.press('End'); await pg.keyboard.type(' (editado)'); await pg.waitForTimeout(800);
    await pg.goto(url + '#/anotacoes'); await pg.click('.an-card'); await pg.fill('#an-desb [name=s]', 'seven2026'); await pg.click('#an-desb button'); await pg.waitForSelector('#an-texto');
    ok(/\(editado\)/.test(await pg.locator('#an-texto').innerText()), 'edição em nota bloqueada é salva cifrada');
    // lixeira
    await pg.goto(url + '#/anotacoes'); await pg.click('.an-fab'); await pg.waitForSelector('#an-texto'); await pg.click('#an-texto'); await pg.keyboard.type('Rascunho descartável'); await pg.waitForTimeout(600);
    await pg.goto(url + '#/anotacoes'); const c2 = pg.locator('.an-card:has-text("Rascunho")'); await c2.hover(); await c2.locator('[data-a=menu]').click(); await pg.check('.modal [value=apagar]'); await submit();
    await pg.goto(url + '#/anotacoes/lixeira'); ok(await pg.locator('.an-card').count() === 1 && /Exclui em 30/.test(await pg.locator('.an-card small').innerText()), 'lixeira com prazo de 30 dias');
    await pg.click('.an-card'); await pg.check('.modal [value=restaurar]'); await submit(); ok(await pg.locator('.an-card').count() === 0, 'restaurar da lixeira');
    await pg.goto(url + '#/anotacoes'); await pg.waitForSelector('.an-card'); await foto('anotacoes-lista');
  },
  async design(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]'); const fs = require('fs');
    await pg.goto(url + '#/design'); await pg.waitForSelector('.ds-formato');
    ok(await pg.locator('.ds-modelo').count() === 6, '6 modelos Seven na vitrine');
    await foto('design-inicio');
    await pg.click('.ds-modelo[data-m="post-licitacao"]'); await pg.waitForSelector('.ds-pg');
    await pg.waitForFunction(() => document.querySelectorAll('.ds-paginas .ds-pg .ds-el').length >= 7, null, { timeout: 5000 }).catch(() => {});
    ok(await pg.locator('.ds-paginas .ds-pg .ds-el').count() === 7, 'modelo aberto no editor com 7 elementos');
    // adicionar retângulo e mover
    await pg.click('[data-aba=elementos]'); await pg.click('[data-add=ret]');
    const id = await pg.evaluate(() => Dados.e.design.designs[0].paginas[0].elementos.slice(-1)[0].id);
    const antes = await pg.evaluate((i) => { const x = Dados.e.design.designs[0].paginas[0].elementos.find(e => e.id === i); return { x: x.x, y: x.y, w: x.w }; }, id);
    const b = await pg.locator(`.ds-paginas .ds-el[data-id="${id}"]`).boundingBox();
    await pg.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await pg.mouse.down(); await pg.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2 + 30, { steps: 6 }); await pg.mouse.up();
    const depois = await pg.evaluate((i) => { const x = Dados.e.design.designs[0].paginas[0].elementos.find(e => e.id === i); return { x: x.x, y: x.y }; }, id);
    ok(depois.x > antes.x && depois.y > antes.y, 'arrastar move o elemento');
    // redimensionar pela alça sudeste
    const al = await pg.locator('.ds-alca.a-se').boundingBox(); await pg.mouse.move(al.x + al.width / 2, al.y + al.height / 2); await pg.mouse.down(); await pg.mouse.move(al.x + 80, al.y + 5, { steps: 5 }); await pg.mouse.up();
    ok(await pg.evaluate((i) => Dados.e.design.designs[0].paginas[0].elementos.find(e => e.id === i).w, id) > antes.w, 'redimensionar pela alça');
    // cor pela barra
    await pg.click('#ds-props [data-prop=cor][data-v="#800000"]'); ok(await pg.evaluate((i) => Dados.e.design.designs[0].paginas[0].elementos.find(e => e.id === i).cor === '#800000', id), 'trocar cor pela barra de propriedades');
    // desfazer
    await pg.click('[data-a=desfazer]'); ok(await pg.evaluate((i) => Dados.e.design.designs[0].paginas[0].elementos.find(e => e.id === i).cor !== '#800000', id), 'desfazer');
    await pg.click('[data-a=refazer]');
    // texto: editar com duplo clique
    await pg.click('[data-aba=texto]'); await pg.click('[data-add=titulo]');
    const tid = await pg.evaluate(() => Dados.e.design.designs[0].paginas[0].elementos.slice(-1)[0].id);
    await pg.dblclick(`.ds-paginas .ds-el[data-id="${tid}"]`); await pg.keyboard.type('Pregão 90021/2026'); await pg.click('.ds-area', { position: { x: 5, y: 200 } });
    ok(await pg.evaluate((i) => Dados.e.design.designs[0].paginas[0].elementos.find(e => e.id === i).texto === 'Pregão 90021/2026', tid), 'editar texto com duplo clique');
    // fonte e alinhamento
    await pg.click(`.ds-paginas .ds-el[data-id="${tid}"]`); await pg.selectOption('#ds-props [data-prop-sel=fonte]', 'Playfair Display'); await pg.click('#ds-props [data-prop=alinh][data-v=center]');
    ok(await pg.evaluate((i) => { const x = Dados.e.design.designs[0].paginas[0].elementos.find(e => e.id === i); return x.fonte === 'Playfair Display' && x.alinh === 'center'; }, tid), 'fonte e alinhamento');
    // logo da marca e página nova
    await pg.click('[data-aba=marca]'); await pg.click('[data-logo="img/seven-logo.png"]');
    await pg.click('[data-a=add-pagina]'); ok(await pg.evaluate(() => Dados.e.design.designs[0].paginas.length === 2), 'adicionar página');
    await pg.click('[data-aba=elementos]'); await pg.click('[data-add=estrela]'); await pg.keyboard.press('Delete');
    ok(await pg.evaluate(() => Dados.e.design.designs[0].paginas[1].elementos.length === 0), 'Delete apaga o selecionado');
    await pg.locator('[data-pgw]').first().scrollIntoViewIfNeeded(); await pg.click('[data-pgw] .ds-pg', { position: { x: 3, y: 3 } });
    await foto('design-editor');
    // exportar PNG
    const [dl] = await Promise.all([pg.waitForEvent('download'), (async () => { await pg.click('[data-a=baixar]'); await pg.selectOption('.modal [name=pags]', 'atual'); await submit(); })()]);
    const buf = fs.readFileSync(await dl.path());
    ok(buf.slice(1, 4).toString() === 'PNG' && buf.readUInt32BE(16) === 1080 && buf.readUInt32BE(20) === 1080, 'PNG exportado em 1080×1080');
    ok(/\.png$/.test(dl.suggestedFilename()), 'nome do arquivo: ' + dl.suggestedFilename());
    await pg.goto(url + '#/design'); ok(await pg.locator('.ds-meu').count() === 1, 'design aparece em Seus designs');
  },
  async cadernos(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]');
    const EDITAL = 'EDITAL DE PREGÃO ELETRÔNICO Nº 90021/2026\n\n1. DO OBJETO\n1.1. O objeto da presente licitação é a aquisição de material de expediente para as escolas municipais.\n\n2. DA SESSÃO\n2.1. A sessão pública será realizada no dia 15/11/2030, às 9h.\n2.2. O critério de julgamento será o de menor preço por item.\n2.3. O valor total estimado é de R$ 245.300,00.\n\n3. DA HABILITAÇÃO\n3.1. Será exigido balanço patrimonial dos dois últimos exercícios.\n3.2. Atestado de capacidade técnica compatível com o objeto.\n3.3. Prova de regularidade com o FGTS.\n\n4. DA ENTREGA\n4.1. O prazo de entrega será de 10 (dez) dias úteis contados do recebimento da nota de empenho.';
    await pg.goto(url + '#/cadernos'); await pg.click('.cd-card.novo'); await pg.waitForSelector('.cd-sem');
    await pg.click('.cd-sem [data-a=add-fonte]'); await pg.fill('.modal [name=nome]', 'Edital 90021'); await pg.fill('.modal [name=texto]', EDITAL);
    await pg.setInputFiles('.modal [name=arqs]', { name: 'TR.txt', mimeType: 'text/plain', buffer: Buffer.from('TERMO DE REFERÊNCIA\nAs canetas devem ter tinta azul e ponta média de 1,0 mm. A garantia dos produtos será de 90 dias.') });
    await submit(); await pg.waitForSelector('.cd-fontes li');
    ok(await pg.locator('.cd-fontes li').count() === 2 && await pg.inputValue('#cd-tit') === 'Edital 90021', 'duas fontes adicionadas (texto colado e arquivo) e nome do caderno');
    ok(await pg.locator('.cd-sug button:has-text("Qual é o objeto?")').count() === 1, 'perguntas sugeridas para edital');
    await pg.fill('#cd-perg input', 'Qual o prazo de entrega?'); await pg.press('#cd-perg input', 'Enter'); await pg.waitForSelector('.cd-msg.ia');
    ok(/10 \(dez\) dias úteis/.test(await pg.locator('.cd-msg.ia').last().innerText()) && await pg.locator('.cd-msg.ia .cd-cit').count() >= 1, 'resposta com citação');
    await pg.fill('#cd-perg input', 'qual a cor da tinta das canetas?'); await pg.press('#cd-perg input', 'Enter'); await pg.waitForTimeout(200);
    ok(/tinta azul/.test(await pg.locator('.cd-msg.ia').last().innerText()) && /TR\.txt/.test(await pg.locator('.cd-msg.ia').last().innerText()), 'resposta vinda da segunda fonte, citando-a');
    await pg.fill('#cd-perg input', 'quem venceu a copa do mundo de futebol?'); await pg.press('#cd-perg input', 'Enter'); await pg.waitForTimeout(200);
    ok(/Não encontrei/.test(await pg.locator('.cd-msg.ia').last().innerText()), 'recusa responder o que não está nas fontes');
    await pg.locator('.cd-msg.ia .cd-cit').first().click(); await pg.waitForSelector('.cd-trecho-on');
    ok(/prazo de entrega/.test(await pg.locator('.cd-trecho-on').innerText()), 'citação abre o trecho destacado na fonte');
    await pg.click('[data-a=fechar-fonte]');
    await pg.click('[data-gerar=edital]'); await pg.waitForSelector('.cd-ed');
    const ed = await pg.locator('.cd-ed').innerText();
    ok(/R\$ 245\.300,00/.test(ed) && /15\/11\/2030/.test(ed) && /menor preço por item/.test(ed), 'análise de edital: valor, data da sessão e critério');
    await pg.click('[data-a=edital-agenda]'); ok(await pg.evaluate(() => (Dados.e.agenda.tarefas || []).some(t => t.data === '2030-11-15')), 'datas do edital viram lembretes na Agenda');
    await foto('cadernos-edital');
    await pg.click('[data-a=saida-nota]'); await pg.click('[data-aba=notas]'); ok(await pg.locator('.cd-nota').count() === 1, 'resultado salvo em nota');
    await pg.click('[data-aba=estudio]'); await pg.click('[data-gerar=quiz]'); await pg.waitForSelector('#cd-saida');
    if (await pg.locator('.cd-q').count()) { await pg.locator('.cd-q').first().locator('[data-resp]').first().click(); ok(await pg.locator('.cd-q').first().locator('.certa').count() === 1, 'quiz mostra a resposta certa'); }
    await pg.click('[data-gerar=tempo]'); ok(/15\/11\/2030/.test(await pg.locator('.cd-tempo').innerText()), 'linha do tempo');
    // desativar fonte do edital
    await pg.locator('.cd-fontes li', { hasText: 'Edital 90021' }).locator('[data-ativa]').uncheck(); await pg.waitForTimeout(150);
    await pg.fill('#cd-perg input', 'Qual o prazo de entrega?'); await pg.press('#cd-perg input', 'Enter'); await pg.waitForTimeout(200);
    ok(/Não encontrei/.test(await pg.locator('.cd-msg.ia').last().innerText()), 'fonte desativada fica fora das respostas');
    await foto('cadernos-chat');
    await pg.goto(url + '#/cadernos'); ok(/2 fontes/.test(await pg.locator('.cd-card:not(.novo)').innerText()), 'caderno listado com 2 fontes');
    await pg.click('.cd-card:not(.novo)'); await pg.waitForSelector('.cd-msg'); ok(await pg.locator('.cd-msg').count() === 8, 'conversa e fontes voltam ao reabrir');
  },
  async semanas(t) {
    const { pg, url, ok, foto } = t; const submit = () => pg.click('.modal [type=submit]');
    await pg.goto(url + '#/semanas'); await pg.click('[data-a=novo]'); await pg.waitForSelector('#sm-form');
    // etapa 1: início numa quarta → ajusta para segunda
    const quarta = await pg.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 30); while (d.getDay() !== 3) d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); });
    await pg.fill('#sm-form [name=titulo]', 'Ciclo Seven Q4'); await pg.fill('#sm-form [name=inicio]', quarta); await pg.check('#sm-form [name=foco][value="Trabalho e dinheiro"]');
    await pg.click('#sm-form .btn.primario'); await pg.waitForSelector('[name=longo]');
    ok(await pg.evaluate(() => { const c = Dados.e.semanas.ciclos[0]; return new Date(c.inicio + 'T12:00:00Z').getUTCDay() === 1 && c.foco[0] === 'Trabalho e dinheiro'; }), 'etapa 1: início ajustado para segunda e área de foco');
    await pg.fill('[name=longo]', 'A Seven atendendo 50 empresas em 3 estados'); await pg.fill('[name=porque]', 'Liberdade e impacto nas empresas da região'); await pg.fill('[name=tres]', '20 clientes e equipe de 6');
    await pg.click('#sm-form .btn.primario'); await pg.waitForSelector('[name=mtexto]');
    await pg.fill('[name=mtexto]', 'Clientes ativos de BPO'); await pg.fill('[name=mde]', '2'); await pg.fill('[name=mpara]', '6'); await pg.fill('[name=munid]', 'clientes');
    await pg.click('#sm-form .btn.primario'); await pg.waitForSelector('.sm-meta-t');
    // conta de trás para frente
    await pg.click('[data-a=regressiva]'); await pg.fill('.modal [name=meta]', '30000'); await pg.fill('.modal [name=ticket]', '1500'); await pg.fill('.modal [name=conv]', '25'); await submit();
    ok(await pg.inputValue('.sm-linha-t >> nth=0 >> [name=ttexto]') === 'Enviar 7 propostas por semana', 'conta de trás para frente: 20 vendas → 80 propostas → 7 por semana');
    await pg.click('[data-a=add-tatica]'); const ult = pg.locator('.sm-linha-t').last(); await ult.locator('[name=ttexto]').fill('Montar lista com 40 empresas que vendem ao governo'); await ult.locator('[name=ttipo]').selectOption('unica'); await ult.locator('[name=tde]').fill('1'); await ult.locator('[name=thoras]').fill('3');
    await pg.locator('.sm-linha-t >> nth=0 >> [name=thoras]').fill('4');
    await pg.click('#sm-form .btn.primario'); await pg.waitForSelector('#sm-inds');
    ok(await pg.evaluate(() => Dados.e.semanas.ciclos[0].taticas.length === 3), 'táticas salvas (inclui medir a taxa real)');
    ok(await pg.locator('.sm-linha-i').count() === 2, 'indicadores propostos: resultado e antecedência');
    await pg.fill('[name=horasDisponiveis]', '10'); await pg.check('[name=agenda]');
    await pg.click('#sm-form .btn.primario'); await pg.waitForSelector('.sm-check');
    ok(await pg.evaluate(() => Dados.e.agenda.tarefas.some(t => /Bloco estratégico/.test(t.titulo) && t.recorrencia)), 'blocos criados na Agenda como recorrentes');
    await pg.fill('[name=custos]', 'Séries à noite'); await pg.fill('[name=parceiro]', 'Sócio'); await pg.fill('[name=rsr]', 'Segunda 8h');
    await foto('semanas-checagem');
    await pg.click('#sm-form .btn.primario'); await pg.waitForSelector('.sm-doc');
    ok(/Meu Ano em 12 Semanas/.test(await pg.locator('.sm-doc h1').innerText()) && /Enviar 7 propostas por semana ⭐/.test(await pg.locator('.sm-doc').innerText()), 'plano no formato do método');
    await pg.goto(url + '#/semanas'); await pg.waitForSelector('.sm-hero');
    ok(/Semana \d+ de 12/.test(await pg.locator('.sm-sem b').innerText()), 'painel mostra a semana atual');
    // semana 1: pontuar
    const id = await pg.evaluate(() => Dados.e.semanas.ciclos[0].id);
    await pg.goto(url + '#/semanas/semana/' + id + '/1'); await pg.waitForSelector('.sm-placar');
    const n = await pg.locator('[data-feito]').count(); await pg.locator('[data-feito]').first().check(); await pg.waitForTimeout(100);
    ok(new RegExp('1 de ' + n).test(await pg.locator('.sm-placar').innerText()), 'pontuação honesta da semana');
    await pg.click('[data-a=pontuar]'); await pg.fill('[data-ind] >> nth=0', '3'); await pg.locator('[data-ind] >> nth=0').dispatchEvent('change');
    ok(await pg.evaluate(() => { const c = Dados.e.semanas.ciclos[0]; return c.pontuadas[1] && Object.values(c.valores[1] || {}).includes(3); }), 'semana pontuada e indicador registrado');
    ok(/Problema de execução|No caminho|sorte|Aguarde/.test(await pg.locator('.sm-semana').innerText()), 'diagnóstico exibido');
    await foto('semanas-semana');
    await pg.goto(url + '#/semanas/revisao/' + id); await pg.fill('[name=q0]', 'Comecei em 50% e subi'); await pg.click('#sm-rev .btn.primario');
    await pg.click('[data-a=proximo]'); await pg.waitForSelector('[name=longo]');
    ok(await pg.evaluate(() => Dados.e.semanas.ciclos.length === 2 && Dados.e.semanas.ciclos[1].visao.longo === Dados.e.semanas.ciclos[0].visao.longo), 'próximo ciclo parte da visão anterior');
    await pg.goto(url + '#/semanas/ciclos'); ok(await pg.locator('.sm-ciclo').count() === 2, 'lista de ciclos');
    await pg.click('.sm-ciclo:not(.ativo) [data-a=ativar]'); await pg.waitForSelector('.sm-hero'); await foto('semanas-painel');
  },
  async perfil(t) {
    const { pg, url, ok, foto } = t;
    await pg.goto(url + '#/perfil'); await pg.waitForSelector('.pf-cards');
    ok(await pg.locator('.pf-card').count() === 3 && /não há número de QI/.test(await pg.locator('.pf-ciencia').innerText()), 'três testes e aviso honesto sobre QI');
    // Big Five: extrovertido e estável
    await pg.click('.pf-card:has-text("Big Five") a'); await pg.waitForSelector('.pf-item');
    for (let pag = 0; pag < 5; pag++) {
      await pg.evaluate(() => { document.querySelectorAll('.pf-item').forEach(fs => { const i = Number(fs.querySelector('input').name.slice(1)); const [, f, k] = Perfil.IPIP[i]; const v = (f === 'E' || f === 'N') ? (k > 0 ? 5 : 1) : 3; const r = fs.querySelector('input[value="' + v + '"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }); });
      if (pag === 0) await foto('perfil-big5');
      await pg.click('#pf-f .btn.primario');
    }
    await pg.waitForSelector('.pf-perfil');
    ok(await pg.evaluate(() => { const r = Dados.e.perfil.resultados.find(x => x.tipo === 'big5').dados; return r.E === 100 && r.N === 100 && r.C === 50; }), 'Big Five pontuado com itens invertidos');
    ok(/Temperamento: Sanguíneo/.test(await pg.locator('.pf-temp').innerText()), 'temperamento derivado: sanguíneo');
    // DISC: sempre "mais" no D e "menos" no S
    await pg.goto(url + '#/perfil/disc'); await pg.waitForSelector('.pf-grupo');
    await pg.click('#pf-d .btn.primario'); ok(await pg.evaluate(() => !Dados.e.perfil.resultados.some(r => r.tipo === 'disc')) && await pg.locator('.pf-grupo').count() === 24, 'exige grupos completos (nada salvo em branco)');
    await pg.evaluate(() => { for (let i = 0; i < 24; i++) { const m = document.querySelector('[name=m' + i + '][value="0"]'); m.checked = true; m.dispatchEvent(new Event('change', { bubbles: true })); const n = document.querySelector('[name=n' + i + '][value="2"]'); n.checked = true; n.dispatchEvent(new Event('change', { bubbles: true })); } });
    await foto('perfil-disc');
    await pg.click('#pf-d .btn.primario'); await pg.waitForSelector('.pf-perfil');
    ok(/Estilo DISC: D/.test(await pg.locator('.pf-perfil').innerText()), 'DISC primário: Dominância');
    // raciocínio
    await pg.goto(url + '#/perfil/raciocinio'); await pg.click('[data-a=comecar]');
    for (let i = 0; i < 12; i++) { await pg.waitForSelector('.pf-ops'); await pg.locator('.pf-ops button').first().click(); }
    await pg.waitForSelector('.pf-res'); ok(/de 12/.test(await pg.locator('.pf-res b').innerText()), 'prova de raciocínio concluída');
    await pg.goto(url + '#/perfil'); ok(await pg.locator('.pf-evol div').count() === 1, 'evolução do raciocínio');
    // equipe
    await pg.click('[data-a=add-pessoa]'); await pg.fill('.modal [name=n]', 'Ana'); await pg.click('.modal [type=submit]');
    await pg.waitForSelector('.pf-eq'); ok(await pg.locator('.pf-eq tbody tr').count() === 2, 'tabela da equipe');
    await pg.selectOption('#pf-pessoa', 'pf-eu'); await pg.waitForSelector('.pf-radar'); await foto('perfil-resultado');
  }
};

(async () => {
  const t = await abrir(saida);
  try { for (const k of Object.keys(testes)) { if (so && so !== k) continue; console.log('• ' + k); await testes[k](t); } }
  catch (e) { console.error(e.message || e); await t.foto('erro'); process.exit(1); }
  await t.fechar();
})();
