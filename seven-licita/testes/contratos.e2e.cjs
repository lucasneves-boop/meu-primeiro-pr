// Contratos no estilo Clicksign: modelo → signatários → envio → assinatura remota (link + PDF conferido) e presencial → PDF assinado → validar.
const path = require('path'); const fs = require('fs');
const { abrir } = require('./apoio.cjs');
const PDFLIB = process.env.PDFLIB || path.join(__dirname, '..', 'node_modules', 'pdf-lib', 'dist', 'pdf-lib.min.js');
(async () => {
  const t = await abrir(path.join(process.env.SAIDA || '/tmp', 'contratos'), { permissions: ['clipboard-read', 'clipboard-write'] });
  const { pg, url, ok, foto, arquivo } = t;
  // pdf-lib vem do cdnjs; no teste servimos uma cópia local para não depender da internet.
  await pg.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf-lib\//, r => fs.existsSync(PDFLIB) ? r.fulfill({ path: PDFLIB, contentType: 'text/javascript' }) : r.continue());
  const escolher = async (sel, arq) => { const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click(sel)]); await fc.setFiles(arq); };
  const baixar = async (sel, nome) => { const [d] = await Promise.all([pg.waitForEvent('download'), pg.click(sel)]); const p = arquivo(nome, ''); await d.saveAs(p); return p; };

  await pg.goto(url + '#/painel'); await pg.waitForSelector('#conteudo');
  await pg.evaluate(() => { Dados.e.empresas.push({ id: 'emp1', razao: 'Cliente Teste LTDA', cnpj: '12345678000190', uf: 'GO', municipio: 'Catalão', representante: 'Maria Cliente da Silva', email: 'maria@cliente.com.br', telefone: '64999990000' }); Dados.e.empresaAtiva = 'emp1'; Dados.e.config.responsavel = 'Lucas Neves'; Dados.salvar(); });
  await pg.goto(url + '#/contratos'); await pg.waitForSelector('.vazio');
  ok(/Seven Contrato/.test(await pg.textContent('.menu a[data-rota=contratos]')) && await pg.textContent('#titulo-tela') === 'Seven Contrato', 'Seven Contrato no menu');
  await pg.click('.vazio [data-a=novo]'); await pg.waitForSelector('.ct-passos');
  ok(await pg.locator('.ct-passo').count() === 4, '4 etapas: documento, signatários, mensagem, revisar');
  await foto('ct-novo');

  // 1. Documento a partir do modelo
  await pg.click('[data-a=modelo]'); await pg.waitForSelector('.modal #ct-vars input');
  ok(await pg.inputValue('.modal [name=v_cliente]') === 'Cliente Teste LTDA', 'modelo já vem com os dados do cliente');
  await pg.fill('.modal [name=v_plano]', 'Completo'); await pg.fill('.modal [name=v_valorMensal]', 'R$ 2.500,00');
  await foto('ct-modelo');
  await pg.click('.modal [type=submit]'); await pg.waitForSelector('.ct-doc', { timeout: 20000 });
  ok(/código [0-9A-F]{4}-/.test(await pg.textContent('.ct-doc')), 'PDF gerado com código de verificação');

  // 2. Signatários
  await pg.click('.ct-nav .btn.primario'); await pg.waitForSelector('[data-a=add-sig]');
  await pg.click('[data-a=cliente]'); await pg.click('[data-a=eu]');
  ok(await pg.locator('.ct-sig-ed').count() === 2, 'dois signatários');
  await pg.fill('.ct-sig-ed >> nth=1 >> [data-s=telefone]', '(61) 98347-2232');
  await pg.check('[data-c=sequencial]'); await pg.waitForSelector('.ct-ordem');
  await foto('ct-signatarios');
  // 3 e 4
  await pg.click('.ct-nav .btn.primario'); await pg.waitForSelector('[data-c=mensagem]');
  await pg.click('.ct-nav .btn.primario'); await pg.waitForSelector('.ct-rev');
  ok(/Tudo certo/.test(await pg.textContent('#conteudo')), 'revisão sem pendências');
  await foto('ct-revisar');
  await pg.click('[data-a=enviar]'); await pg.waitForSelector('.ct-sig-lista');
  ok(/Aguardando assinaturas/.test(await pg.textContent('.ct-topo')), 'situação: aguardando assinaturas');
  ok(await pg.locator('.ct-sig-l >> nth=1').locator('[data-a=whats]').isDisabled(), 'em ordem: o 2º só assina depois do 1º');

  // mensagem revisada antes de abrir o WhatsApp
  await pg.click('.ct-sig-l >> nth=0 >> [data-a=whats]'); await pg.waitForSelector('.modal textarea');
  const msg = await pg.inputValue('.modal textarea'); ok(/Lucas Neves \| Seven$/.test(msg) && /#\/assinar\//.test(msg), 'mensagem com link e assinatura Lucas Neves | Seven, para revisar');
  await pg.click('.modal [data-fechar], .modal .fechar, .modal button[type=button]').catch(() => pg.keyboard.press('Escape'));
  await pg.waitForSelector('.modal', { state: 'detached' }).catch(() => {});

  const pdf = await baixar('[data-a=baixar-doc]', 'enviado.pdf');
  ok(fs.readFileSync(pdf).slice(0, 4).toString() === '%PDF', 'PDF para enviar ao signatário');
  await pg.click('.ct-sig-l >> nth=0 >> [data-a=copiar]'); await pg.waitForTimeout(300);
  const link = await pg.evaluate(() => navigator.clipboard.readText()); ok(/#\/assinar\//.test(link), 'link de assinatura copiado');
  const idDoc = await pg.evaluate(() => location.hash.split('/').pop());

  // 3. Signatário remoto: arquivo errado é recusado; o certo libera a assinatura
  await pg.goto(link); await pg.waitForSelector('.as-cab');
  ok(await pg.locator('.lateral').isHidden() && await pg.locator('.seletor-empresa').isHidden(), 'página do signatário sem o menu da plataforma');
  ok(/Seven Contrato/.test(await pg.textContent('.as-cab')), 'página do signatário identificada como Seven Contrato');
  await escolher('[data-a=pdf]', arquivo('outro.pdf', '%PDF-1.4 arquivo diferente'));
  await pg.waitForSelector('#as-conf .ct-invalido', { timeout: 8000 }).catch(() => {});
  ok(await pg.locator('#as-conf .ct-invalido').count() === 1 && await pg.locator('#as-2').isHidden(), 'PDF diferente: não deixa assinar');
  await escolher('[data-a=pdf]', pdf); await pg.waitForSelector('#as-conf .ct-valido');
  ok(await pg.locator('#as-2').isVisible(), 'mesmo PDF: libera os dados e a assinatura');
  await pg.fill('#as-cpf', '111.111.111-11'); await pg.check('#as-aceite'); await pg.click('[data-a=assinar]');
  ok(await pg.locator('#as-fim .as-ok').count() === 0, 'CPF inválido barrado');
  await pg.fill('#as-cpf', '529.982.247-25'); await pg.fill('#as-email', 'maria@cliente.com.br');
  await foto('ct-assinar');
  await pg.click('[data-a=assinar]'); await pg.waitForSelector('#as-cod');
  const cod = await pg.inputValue('#as-cod'); ok(/^P7-ASS-/.test(cod), 'comprovante gerado para devolver');
  await foto('ct-comprovante');

  // 4. Quem enviou registra o comprovante (adulterado é rejeitado)
  await pg.goto(url + '#/contratos/ver/' + idDoc); await pg.waitForSelector('.ct-sig-lista');
  const meio = Math.floor(cod.length / 2); const adult = cod.slice(0, meio) + (cod[meio] === 'A' ? 'B' : 'A') + cod.slice(meio + 1);
  await pg.click('.ct-topo [data-a=receber]'); await pg.fill('.modal [name=codigo]', adult); await pg.click('.modal [type=submit]');
  await pg.waitForTimeout(400); ok(await pg.locator('.ct-sig-l.ok').count() === 0, 'comprovante adulterado não é registrado');
  await pg.click('.ct-topo [data-a=receber]'); await pg.fill('.modal [name=codigo]', cod); await pg.click('.modal [type=submit]');
  await pg.waitForSelector('.ct-sig-l.ok'); ok(await pg.locator('.ct-sig-l.ok').count() === 1, 'assinatura remota registrada');
  ok(!(await pg.locator('.ct-sig-l >> nth=1').locator('[data-a=presencial]').isDisabled()), 'agora é a vez do 2º');

  // 5. Presencial, assinatura desenhada
  await pg.click('.ct-sig-l >> nth=1 >> [data-a=presencial]'); await pg.waitForSelector('.as-cab');
  await escolher('[data-a=pdf]', pdf); await pg.waitForSelector('#as-conf .ct-valido');
  await pg.fill('#as-cpf', '111.444.777-35'); await pg.click('[data-m=desenho]');
  const bx = await pg.locator('#as-canvas').boundingBox();
  await pg.mouse.move(bx.x + 30, bx.y + 100); await pg.mouse.down();
  for (let i = 0; i <= 20; i++) await pg.mouse.move(bx.x + 30 + i * 18, bx.y + 100 - Math.sin(i / 2) * 40);
  await pg.mouse.up(); await pg.check('#as-aceite');
  await pg.click('[data-a=assinar]'); await pg.waitForSelector('.as-ok a.btn');
  await pg.click('.as-ok a.btn'); await pg.waitForSelector('.ct-topo');
  ok(await pg.locator('.lateral').isVisible(), 'menu volta ao sair da página de assinatura');
  ok(/Assinado/.test(await pg.textContent('.ct-topo')) && await pg.locator('.ct-sig-l.ok').count() === 2, 'todas as assinaturas: documento assinado');
  ok(/concluído/.test(await pg.textContent('.ct-trilha')), 'trilha de auditoria registra a conclusão');
  await foto('ct-assinado');

  // 6. PDF final e validação
  const fin = await baixar('[data-a=final]', 'assinado.pdf');
  const bf = fs.readFileSync(fin); ok(bf.slice(0, 4).toString() === '%PDF' && bf.length > fs.statSync(pdf).size, 'PDF assinado com página de registro');
  await pg.goto(url + '#/contratos/validar'); await pg.waitForSelector('[data-a=arquivo]');
  await escolher('[data-a=arquivo]', fin); await pg.waitForSelector('#ct-res .ct-valido');
  ok(/PDF assinado/.test(await pg.textContent('#ct-res')) && /CPF \*\*\*\.982\.247-\*\*/.test(await pg.textContent('#ct-res')), 'validador reconhece o PDF assinado (CPF mascarado)');
  await foto('ct-validar');
  await escolher('[data-a=arquivo]', arquivo('falso.pdf', '%PDF-1.4 falso')); await pg.waitForSelector('#ct-res .ct-invalido'); ok(true, 'arquivo alterado: não encontrado');
  await pg.goto(url + '#/contratos'); await pg.waitForSelector('.ct-item'); await foto('ct-lista');
  await pg.goto(url + '#/contratos/sobre'); ok(await pg.locator('.nf-fontes a').count() >= 5, 'validade jurídica com fontes oficiais');
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.goto(url + '#/contratos/ver/' + idDoc); await pg.waitForSelector('.ct-topo'); await pg.waitForTimeout(500); await foto('ct-celular');
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'sem rolagem lateral no celular');
  await t.fechar();
})().catch(e => { console.error(e); process.exit(1); });
