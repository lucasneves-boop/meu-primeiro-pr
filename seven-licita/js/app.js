/* Plataforma 7 — roteador e casca. */
(function () {
  'use strict';
  const { $, $$, esc } = UI;

  function rotaAtual() {
    const inicial = self.Pref ? Pref.telaInicial() : 'painel'; const partes = (location.hash.replace(/^#\/?/, '') || inicial).split('/');
    return { tela: partes[0] || inicial, sub: partes[1] || '', param: decodeURIComponent(partes.slice(2).join('/')) };
  }

  function preencherEmpresas() {
    const sel = $('#empresa-ativa'); const e = Dados.e;
    const ativa = Dados.empresaAtiva();
    sel.innerHTML = e.empresas.length
      ? e.empresas.map(function (x) { return '<option value="' + x.id + '"' + (ativa && ativa.id === x.id ? ' selected' : '') + '>' + esc(x.fantasia || x.razao) + '</option>'; }).join('')
      : '<option value="">Cadastre um cliente</option>';
  }

  // Descrição curta de cada ferramenta, mostrada acima do conteúdo (telas com cabeçalho próprio mantêm o delas).
  const DESC = {
    painel: 'Visão geral do dia: avisos novos, propostas, disputas, prazos, documentos vencendo e indicadores, em blocos que você escolhe e organiza.',
    ia: 'Assistente de IA para ler editais, tirar dúvidas da Lei 14.133, redigir peças e resumir documentos, com a sua chave da Anthropic.',
    loja: 'Vitrine dos serviços da Seven com carrinho, cupons e pedidos. O pedido vira negócio no Seven Comercial e você revisa a mensagem antes de enviar.',
    relatorios: 'Relatório de performance para enviar ao cliente: o que avançou em relação ao período anterior, evolução mês a mês, funil e licitações, com a base de todos os clientes.',
    comissao: 'Calcule a comissão sobre o preço de venda ou sobre o lucro líquido, quanto vender em licitação para chegar à sua meta, a margem necessária e todos os cenários.',
    comercial: 'CRM da Seven: contas, funil de vendas, cadência de contatos, propostas com ROI e metas para vender o BPO de licitações.',
    encontrar: 'Encontre editais no PNCP com perfis de busca, catálogo de produtos e filtros por valor, região e órgão. Envie os bons para o Seven Proposta.',
    cadastrar: 'Monte as propostas: itens do PNCP, marca, modelo, custo e preço, declarações, anexos, registro do envio e proposta atualizada pós-lances.',
    disputar: 'Prepare a sessão de lances: valor limite aprovado pelo cliente, estratégia por item, checklist e simulador para ensaiar a disputa.',
    monitorar: 'Acompanhe as licitações depois da disputa: mensagens do pregoeiro, prazos detectados automaticamente, recursos e contrarrazões.',
    precificacao: 'Forme o preço com segurança: custo, impostos, frete, BDI e margem, item a item ou vários ao mesmo tempo, com alertas de inexequibilidade.',
    cotacoes: 'Peça preços aos fornecedores, registre as respostas e compare no mapa de cotação, com cobrança de quem ainda não respondeu.',
    fornecedores: 'Cadastro de fornecedores com contatos, categorias, marcas, prazos, documentos e histórico de respostas às cotações.',
    habilitacao: 'Central de habilitação: checklist da Lei 14.133, níveis do SICAF, links oficiais das certidões e lembretes de vencimento.',
    pecas: 'Modelos de impugnação, esclarecimento, intenção de recurso, recurso e contrarrazões, preenchidos com os dados do cliente e da licitação.',
    agenda: 'Tarefas, calendário, hábitos e pomodoro, com as sessões e prazos das licitações. Escreva "toda terça 8h" e a recorrência é criada.',
    anotacoes: 'Notas com texto, caneta, checklists, áudio e imagens, organizadas em pastas e com opção de trancar com senha.',
    semanas: 'Planeje e execute metas pelo método 1 Ano em 12 Semanas: visão, táticas por semana, pontuação semanal e blocos na agenda.',
    pleiade: 'Comunicação interna da equipe em tempo real: canais, mensagens diretas, conversas em thread, arquivos e lembretes.',
    reuniao: 'Chamada direta 1 a 1 com qualquer pessoa e videochamadas da equipe com tela compartilhada, chat, enquetes, quadro branco, legendas e ata da reunião.',
    agora: 'Rede social dos profissionais de licitação: publique, siga colegas, comente e acompanhe as discussões do setor.',
    notas: 'Emita NF-e e NFS-e com orientação passo a passo, registre notas de entrada pelo XML e lance as parcelas no Seven Financeiro.',
    contratos: 'Envie contratos e termos para assinatura eletrônica, acompanhe quem já assinou e baixe o PDF com o registro das assinaturas.',
    quadros: 'Quadros no estilo Trello para gerir cada licitação, da oportunidade ao pagamento, com checklists, prazos e a execução do contrato.',
    financas: 'Controle financeiro pessoal, da empresa e de clientes: contas, cartões, fluxo de caixa, contas a pagar e a receber e conciliação.',
    nuvem: 'Guarde arquivos e pastas da Seven e dos clientes, e abra direto no Seven Leitura, no Seven Cadernos ou no Seven Music.',
    mercado: 'Pesquise o mercado no PNCP: valores homologados, órgãos compradores, vencedores, preço por item e desconto sobre a referência.',
    capag: 'Nota de capacidade de pagamento dos municípios (CAPAG do Tesouro Nacional) para saber quem costuma pagar em dia antes de disputar.',
    academy: 'Cursos, mentorias e dicas da Seven para a equipe e os clientes aprenderem licitação na prática.',
    jogos: 'Treine raciocínio, memória e atenção com xadrez, quiz da Lei 14.133 e jogos de cognição com tema de licitação.',
    design: 'Crie posts, stories, apresentações, propostas e gráficos com a identidade da Seven, com ferramentas no padrão do Canva.',
    calculadora: 'Calculadora científica e dezenas de cálculos do dia a dia, incluindo o custo de viagem com combustível, pedágio e diárias.',
    musicas: 'Ouça suas músicas e playlists enquanto trabalha, com equalizador, velocidade e timer de sono.',
    empresas: 'Cadastre os clientes atendidos (CNPJs). O cliente ativo filtra propostas, documentos, disputas e monitoramento.',
    config: 'Ajuste a aparência (tema, cor, tamanho, espaçamento), o menu e a tela inicial, as janelas flutuantes e os atalhos, a assinatura das mensagens, os avisos e o backup.'
  };
  function descricao(r, tela) {
    const box = $('#desc-tela'); if (!box) return;
    const chave = r.tela === 'mercado' && r.sub === 'capag' ? 'capag' : r.tela;
    const sem = r.tela === 'assinar' || (r.tela === 'design' && r.sub === 'editar') || (r.tela === 'cadernos' && r.sub === 'c');
    const d = DESC[chave];
    box.hidden = sem || !d;
    if (!box.hidden) box.innerHTML = '<h1>' + esc(chave === 'capag' ? 'Seven CAPAG' : tela.titulo) + '</h1><p class="mudo">' + esc(d) + '</p>';
  }

  function desenhar() {
    const r = rotaAtual();
    const tela = Telas[r.tela] || Telas.painel;
    $$('.menu a').forEach(function (a) { a.classList.toggle('ativo', a.dataset.rota === r.tela); a.setAttribute('aria-current', a.dataset.rota === r.tela ? 'page' : 'false'); });
    $('#titulo-tela').textContent = tela.titulo;
    document.title = tela.titulo + ' · Plataforma 7';
    preencherEmpresas();
    const el = $('#conteudo');
    el.onclick = el.onchange = el.oninput = el.onkeydown = el.ondblclick = el.onfocusout = el.onsubmit = null;
    if (r.tela === 'mercado' && (r.sub === 'capag')) $$('.menu a').forEach(function (a) { a.classList.toggle('ativo', a.dataset.rota === 'capag'); });
    descricao(r, tela);
    try { tela.render(el, r.sub, r.param); }
    catch (e) { console.error(e); el.innerHTML = '<div class="vazio"><h3>Erro ao abrir a tela</h3><p>' + esc(e.message) + '</p></div>'; }
    document.body.classList.remove('menu-aberto');
    document.body.classList.toggle('modo-publico', r.tela === 'assinar');
    if (r.tela !== 'notas') { const aj = document.getElementById('nf-ajuda'); if (aj) aj.remove(); document.body.classList.remove('com-ajuda-nf'); }
    $('#abrir-menu').setAttribute('aria-expanded', 'false');
  }

  // ---------- tema: automático (segue o sistema), claro ou escuro ----------
  const TEMAS = { auto: { ic: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>', t: 'Tema automático (segue o sistema)' }, claro: { ic: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g></svg>', t: 'Tema claro' }, escuro: { ic: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor"/></svg>', t: 'Tema escuro' }, dourado: { ic: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2l2.6 6.2 6.7.6-5.1 4.4 1.6 6.6L12 16.3 6.2 19.8l1.6-6.6L2.7 8.8l6.7-.6z" fill="#c9a25a" stroke="#050505" stroke-width="1"/></svg>', t: 'Tema dourado e preto' } };
  function temaSalvo() { try { const t = localStorage.getItem('seven-tema'); return TEMAS[t] ? t : 'auto'; } catch (e) { return 'auto'; } }
  function aplicarTema(t) {
    t = TEMAS[t] ? t : 'auto';
    try { if (t === 'auto') localStorage.removeItem('seven-tema'); else localStorage.setItem('seven-tema', t); } catch (e) { /* navegador sem armazenamento: vale só nesta visita */ }
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', { claro: 'light', escuro: 'dark', dourado: 'gold' }[t]);
    const escuro = t === 'escuro' || t === 'dourado' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.setAttribute('content', escuro ? '#050505' : '#f6f5f2');
    const b = $('#botao-tema'); if (b) { b.innerHTML = TEMAS[t].ic; b.title = TEMAS[t].t + ' · clique para trocar'; b.setAttribute('aria-label', TEMAS[t].t + '. Trocar tema'); }
    temaAtual = t;
  }
  let temaAtual = temaSalvo();
  $('#botao-tema').addEventListener('click', function () { aplicarTema({ auto: 'claro', claro: 'escuro', escuro: 'dourado', dourado: 'auto' }[temaAtual]); UI.aviso(TEMAS[temaAtual].t + '.'); });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (temaAtual === 'auto') aplicarTema('auto'); });
  aplicarTema(temaAtual);

  self.App = { menuRecolhido: function (sim) { return menuRecolhido(sim); }, redesenhar: desenhar, rota: rotaAtual, tema: function (t) { if (t) aplicarTema(t); return temaAtual; }, iconeTema: function (t) { return TEMAS[t].ic; } };

  window.addEventListener('hashchange', function () { desenhar(); $('#conteudo').focus({ preventScroll: true }); window.scrollTo(0, 0); });
  $('#empresa-ativa').addEventListener('change', function () { Dados.e.empresaAtiva = this.value; Dados.salvar(); desenhar(); });
  // ---------- menu lateral retrátil (computador): recolhido mostra só os ícones, com o nome ao passar o mouse ----------
  function menuRecolhido(sim) {
    const html = document.documentElement;
    if (typeof sim === 'boolean') { html.classList.toggle('lateral-recolhida', sim); try { if (sim) localStorage.setItem('seven-menu', 'recolhido'); else localStorage.removeItem('seven-menu'); } catch (e) { /* sem armazenamento */ } }
    const r = html.classList.contains('lateral-recolhida'); const b = $('#recolher-menu');
    if (b) { b.setAttribute('aria-expanded', String(!r)); b.title = r ? 'Expandir menu' : 'Recolher menu'; b.querySelector('.rot').textContent = r ? 'Expandir menu' : 'Recolher menu'; }
    $$('.menu a').forEach(function (a) { const t = a.querySelector('.rot'); if (r && t) a.title = t.textContent; else a.removeAttribute('title'); });
    window.dispatchEvent(new Event('resize'));
    return r;
  }
  $('#recolher-menu').addEventListener('click', function () { menuRecolhido(!document.documentElement.classList.contains('lateral-recolhida')); });
  menuRecolhido(self.Pref && Pref.obter().menuRecolhidoAoAbrir ? true : undefined);

  $('#abrir-menu').addEventListener('click', function () {
    const aberto = document.body.classList.toggle('menu-aberto');
    this.setAttribute('aria-expanded', String(aberto));
  });

  Dados.limparAvisosAntigos();
  desenhar();
  setTimeout(function () { Telas.encontrar.capturaAutomatica(); }, 1500);
})();
