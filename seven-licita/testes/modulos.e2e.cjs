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
