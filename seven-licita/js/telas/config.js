/* Configurações: responsável, aparência, menu e navegação, janelas flutuantes e atalhos, mensagens a clientes,
   avisos, backup e dados locais. As preferências ficam em Dados.e.config.pref (ver js/preferencias.js). */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, confirmar, aviso } = UI;
  const JANELAS = [['calc', '🧮 Calculadora', 'Alt+C'], ['comissao', '% Seven Comissão', 'Alt+M'], ['not', '🗒 Seven Not', 'Alt+N'], ['agenda', '☑ Seven Agenda', 'Alt+A'], ['chat', '💬 Seven Chat', 'Alt+B'], ['ia', '✦ Seven IA', 'Alt+I']];
  let busca = '';
  function itensMenu() {
    const out = []; let grupo = 'Geral';
    document.querySelectorAll('.menu > *').forEach(function (n) { if (n.matches('p.grupo')) grupo = n.textContent; else if (n.matches('a[data-rota]')) out.push({ rota: n.dataset.rota, nome: (n.querySelector('.rot') || n).textContent, grupo: grupo }); });
    return out;
  }
  function secao(id, titulo, corpo, palavras) { return '<section class="cartao cfg-secao" id="cfg-' + id + '" data-busca="' + esc((titulo + ' ' + (palavras || '')).toLowerCase()) + '"><h3>' + titulo + '</h3>' + corpo + '</section>'; }
  function radios(nome, atual, ops) { return '<div class="cfg-radios" role="radiogroup">' + ops.map(function (o) { return '<label class="cfg-radio"><input type="radio" name="' + nome + '" value="' + esc(o[0]) + '"' + (String(atual) === String(o[0]) ? ' checked' : '') + '><span>' + o[1] + '</span></label>'; }).join('') + '</div>'; }
  function check(nome, marcado, rotulo, dica) { return '<label class="check cfg-check"><input type="checkbox" name="' + nome + '"' + (marcado ? ' checked' : '') + '> ' + rotulo + (dica ? ' <small class="mudo">' + dica + '</small>' : '') + '</label>'; }
  function secoesPref() {
    const p = Pref.obter(); const menu = itensMenu(); const grupos = []; menu.forEach(function (m) { if (grupos.indexOf(m.grupo) < 0) grupos.push(m.grupo); });
    return secao('destaque', 'Cor de destaque e leitura',
        '<p class="mini mudo">A cor de destaque muda botões, links, marcadores e gráficos em todos os temas.</p>' +
        '<div class="cfg-cores" role="radiogroup" aria-label="Cor de destaque">' + Object.keys(Pref.DESTAQUES).map(function (k) { const d = Pref.DESTAQUES[k]; return '<label class="cfg-cor"><input type="radio" name="p_destaque" value="' + k + '"' + (p.destaque === k ? ' checked' : '') + '><span style="background:' + d[1] + '"></span><small>' + esc(d[0]) + '</small></label>'; }).join('') + '</div>' +
        '<div class="linha">' + campo('Tamanho da interface', '<input type="range" name="p_escala" min="80" max="130" step="5" value="' + p.escala + '" aria-describedby="cfg-escala-v"> <b id="cfg-escala-v">' + p.escala + '%</b>') + '</div>' +
        '<h4>Espaçamento</h4>' + radios('p_densidade', p.densidade, [['compacta', 'Compacto (mais informação na tela)'], ['normal', 'Normal'], ['ampla', 'Amplo (mais respiro)']]) +
        '<h4>Cantos</h4>' + radios('p_bordas', p.bordas, [['arredondadas', 'Arredondados'], ['retas', 'Retos']]) +
        check('p_animacoes', p.animacoes, 'Animações e transições', 'desligue para uma tela mais estável') + check('p_descricoes', p.descricoes, 'Mostrar a descrição de cada ferramenta no topo da tela'),
        'tamanho fonte zoom cor destaque densidade espaçamento animação bordas cantos') +
      secao('navegacao', 'Menu e navegação',
        '<div class="linha">' + campo('Tela ao abrir a plataforma', '<select name="p_telaInicial">' + menu.filter(function (m) { return m.rota !== 'config'; }).map(function (m) { return '<option value="' + esc(m.rota) + '"' + (p.telaInicial === m.rota ? ' selected' : '') + '>' + esc(m.nome) + '</option>'; }).join('') + '</select>') + '</div>' +
        check('p_menuRecolhidoAoAbrir', p.menuRecolhidoAoAbrir, 'Abrir com o menu lateral recolhido (só ícones)') +
        '<h4>Ferramentas no menu</h4><p class="mini mudo">Desmarque o que você não usa para deixar o menu mais curto. A ferramenta continua funcionando e os dados dela continuam integrados às outras.</p>' +
        '<div class="cfg-menu">' + grupos.map(function (g) { return '<fieldset><legend>' + esc(g) + '</legend>' + menu.filter(function (m) { return m.grupo === g; }).map(function (m) { return m.rota === 'config' ? '' : '<label class="check"><input type="checkbox" name="menu_' + esc(m.rota) + '"' + (p.menuOculto.indexOf(m.rota) < 0 ? ' checked' : '') + '> ' + esc(m.nome) + '</label>'; }).join('') + '</fieldset>'; }).join('') + '</div>' +
        '<div class="grupo-botoes"><button type="button" class="btn mini" data-a="menu-todos">Mostrar todas</button></div>',
        'menu lateral tela inicial ocultar esconder ferramentas recolhido ' + menu.map(function (m) { return m.nome; }).join(' ')) +
      secao('janelas', 'Janelas flutuantes e atalhos',
        '<p class="mini mudo">Botões do topo que abrem as ferramentas em janela flutuante, sobre qualquer tela. A janela usa os mesmos dados da tela completa.</p>' +
        '<div class="cfg-menu"><fieldset><legend>Botões no topo</legend>' + JANELAS.map(function (j) { return '<label class="check"><input type="checkbox" name="jan_' + j[0] + '"' + (p.botoesTopo[j[0]] !== false ? ' checked' : '') + '> ' + j[1] + ' <small class="mudo">' + j[2] + '</small></label>'; }).join('') + '</fieldset></div>' +
        check('p_atalhos', p.atalhos, 'Atalhos de teclado (Alt + letra) para abrir e fechar as janelas'),
        'janela flutuante pop-up popup atalho teclado botões topo calculadora comissão not agenda chat ia') +
      secao('mensagens', 'Mensagens a clientes',
        '<p class="mini mudo">Usados no texto pronto de WhatsApp e e-mail (relatórios, chamada direta, cotações, loja). O sistema só abre a mensagem para você revisar e enviar.</p>' +
        '<form id="cfg-msg" class="linha" autocomplete="off">' + campo('Assinatura', '<input name="assinatura" value="' + esc(p.assinatura) + '">') + campo('Telefone', '<input name="telefone" value="' + esc(p.telefone) + '">') + campo('E-mail (opcional)', '<input name="email" type="email" value="' + esc(p.email) + '">') + campo('Horário de atendimento', '<input name="horario" value="' + esc(p.horario) + '">') + '</form>' +
        '<p class="mini">Prévia da assinatura:</p><pre class="cfg-previa" id="cfg-previa">' + esc(Pref.rodape()) + '</pre>',
        'assinatura telefone email e-mail whatsapp horário atendimento mensagem') +
      secao('avisos', 'Avisos e lembretes',
        '<div class="linha">' + campo('Tempo dos avisos na tela', '<select name="p_avisosSegundos">' + [2, 3, 4, 6, 8, 10].map(function (n) { return '<option value="' + n + '"' + (Number(p.avisosSegundos) === n ? ' selected' : '') + '>' + n + ' segundos</option>'; }).join('') + '</select>') +
        campo('Lembrar de exportar o backup', '<select name="p_lembreteBackup">' + [[0, 'Nunca'], [3, 'A cada 3 dias'], [7, 'A cada 7 dias'], [15, 'A cada 15 dias'], [30, 'A cada 30 dias']].map(function (o) { return '<option value="' + o[0] + '"' + (Number(p.lembreteBackup) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>') + '</div>',
        'avisos notificações lembrete backup tempo');
  }

  Telas.config = {
    titulo: 'Configurações',
    render: function (el) {
      const d = Dados.e;
      let tamanho = 0; try { tamanho = (localStorage.getItem('seven-licita:v1') || '').length; } catch (e) { /* sem acesso */ }
      const p = Pref.obter();
      el.innerHTML = '<div class="cfg-busca no-print"><input type="search" id="cfg-q" placeholder="Procurar uma configuração (ex.: menu, assinatura, atalho)" value="' + esc(busca) + '" aria-label="Procurar configuração"><p class="mini mudo">As mudanças valem na hora e ficam salvas (vão junto no backup).</p></div>' +
        '<section class="cartao cfg-secao" data-busca="quem está operando nome responsável"><h3>Quem está operando</h3><form id="resp" class="linha">' + campo('Seu nome (aparece em anotações, comentários e atividade)', '<input name="responsavel" value="' + esc(d.config.responsavel || '') + '">') + '<button class="btn">Salvar</button></form></section>' +
        '<section class="cartao cfg-secao" data-busca="aparência tema claro escuro dourado"><h3>Aparência</h3><div class="tema-opcoes" role="radiogroup" aria-label="Tema">' + [['auto', App.iconeTema('auto'), 'Automático', 'Segue o sistema'], ['claro', App.iconeTema('claro'), 'Claro', 'Fundo claro'], ['escuro', App.iconeTema('escuro'), 'Escuro', 'Fundo preto'], ['dourado', App.iconeTema('dourado'), 'Dourado e preto', 'Identidade Seven']].map(function (x) { return '<label class="tema-op tema-' + x[0] + '"><input type="radio" name="tema" value="' + x[0] + '"' + (App.tema() === x[0] ? ' checked' : '') + '><span class="tema-amostra" aria-hidden="true"><i></i><i></i></span><b>' + x[1] + ' ' + x[2] + '</b><small>' + x[3] + '</small></label>'; }).join('') + '</div><p class="mini mudo">Também dá para trocar pelo botão ' + '◐' + ' no topo da tela. A escolha fica neste navegador.</p></section>' +
        (self.Fundo ? '<section class="cartao cfg-secao" data-busca="fundo animado animação playstation"><h3>Fundo animado</h3><p class="mini mudo">Animação atrás das telas, no estilo do PlayStation 4. Ela reage ao mouse e ao clique. Fica salva neste navegador.</p><div class="fundo-opcoes" role="radiogroup" aria-label="Fundo animado">' + Fundo.opcoes.map(function (o) { return '<label class="fundo-op"><input type="radio" name="fundo" value="' + o.id + '"' + (Fundo.atual() === o.id ? ' checked' : '') + '><span class="fundo-amostra ' + o.id + '" aria-hidden="true"></span><b>' + esc(o.nome) + '</b><small>' + esc(o.desc) + '</small></label>'; }).join('') + '</div><p class="mini mudo">Se o sistema estiver com "reduzir movimento" ativado, o fundo aparece parado.</p></section>' : '') + secoesPref() +
        '<section class="cartao cfg-secao" data-busca="backup exportar importar"><h3>Backup</h3><p>Os dados ficam <b>só neste navegador</b> (' + Math.round(tamanho / 1024) + ' KB, mais os arquivos anexados). Exporte um backup com frequência e importe em outro computador para continuar de lá. Anexos (PDFs) não vão no backup: guarde os originais.</p>' +
        '<div class="grupo-botoes"><button class="btn primario" data-a="exportar">Exportar backup (.json)</button><button class="btn" data-a="importar">Importar backup</button></div></section>' +
        '<section class="cartao cfg-secao" data-busca="fonte dos dados pncp"><h3>Fonte dos dados</h3><p class="mini">Licitações, itens, anexos e resultados vêm da API pública do PNCP (pncp.gov.br), sem login. O app não acessa portais de compra com as credenciais dos clientes e não envia propostas, lances ou mensagens: essas ações continuam sendo feitas no portal.</p></section>' +
        '<section class="cartao cfg-secao" data-busca="limpar apagar lixeira"><h3>Limpar</h3><div class="grupo-botoes"><button class="btn fantasma" data-a="lixeira">Esvaziar lixeira de avisos</button><button class="btn fantasma perigo" data-a="zerar">Apagar todos os dados deste navegador</button></div></section>' +
        '<p class="mini mudo">Seven · BPO de Licitações · ' + esc(p.telefone) + ' · ' + esc(p.horario) + '</p><p class="mini mudo cfg-nada" hidden>Nenhuma configuração encontrada.</p>';
      const filtrar = function () { const q = busca.trim().toLowerCase(); let n = 0; el.querySelectorAll('.cfg-secao').forEach(function (x) { const v = !q || x.dataset.busca.indexOf(q) >= 0 || x.textContent.toLowerCase().indexOf(q) >= 0; x.hidden = !v; if (v) n++; }); el.querySelector('.cfg-nada').hidden = n > 0; };
      const q = el.querySelector('#cfg-q'); q.oninput = function () { busca = q.value; filtrar(); }; filtrar();
      const msg = el.querySelector('#cfg-msg'); msg.oninput = function () { const f = new FormData(msg); ['assinatura', 'telefone', 'email', 'horario'].forEach(function (k) { p[k] = String(f.get(k) || '').trim(); }); if (!p.assinatura) p.assinatura = Pref.PADRAO.assinatura; Dados.salvar(); el.querySelector('#cfg-previa').textContent = Pref.rodape(); };
      msg.onsubmit = function (ev) { ev.preventDefault(); };
      el.oninput = function (ev) { if (ev.target.name === 'p_escala') { el.querySelector('#cfg-escala-v').textContent = ev.target.value + '%'; } };
      el.querySelector('#resp').onsubmit = function (ev) { ev.preventDefault(); d.config.responsavel = new FormData(this).get('responsavel'); const m = d.membros = d.membros || []; if (d.config.responsavel && m.indexOf(d.config.responsavel) < 0) m.push(d.config.responsavel); Dados.salvar(); aviso('Salvo.'); };
      const mudou = function (ev) {
        const t = ev.target; const n = t.name || '';
        if (/^p_/.test(n)) { const k = n.slice(2); let v = t.type === 'checkbox' ? t.checked : t.value; if (k === 'escala' || k === 'avisosSegundos' || k === 'lembreteBackup') v = Number(v); Pref.definir(k, v); }
        if (/^menu_/.test(n)) { const r = n.slice(5); p.menuOculto = p.menuOculto.filter(function (x) { return x !== r; }); if (!t.checked) p.menuOculto.push(r); Dados.salvar(); Pref.aplicar(); }
        if (/^jan_/.test(n)) { p.botoesTopo[n.slice(4)] = t.checked; Dados.salvar(); Pref.aplicar(); }
      };
      el.onchange = function (ev) { mudou(ev); if (ev.target.name === 'tema') App.tema(ev.target.value); if (ev.target.name === 'fundo') { Fundo.definir(ev.target.value); aviso('Fundo: ' + Fundo.opcoes.find(function (o) { return o.id === ev.target.value; }).nome + '.'); } };
      el.onclick = async function (ev) {
        const b = ev.target.closest('[data-a]'); if (!b) return;
        if (b.dataset.a === 'menu-todos') { p.menuOculto = []; Dados.salvar(); Pref.aplicar(); App.redesenhar(); return; }
        if (b.dataset.a === 'exportar') { d.config.ultimoBackup = new Date().toISOString(); Dados.salvar(); }
        if (b.dataset.a === 'exportar') UI.baixar('seven-licita-backup-' + new Date().toISOString().slice(0, 10) + '.json', Dados.exportar(), 'application/json');
        if (b.dataset.a === 'importar') {
          const f = await UI.escolherArquivo('.json,application/json'); if (!f) return;
          if (!await confirmar('Importar backup', 'Os dados atuais deste navegador serão <b>substituídos</b> pelo backup. Continuar?', 'Importar')) return;
          try { Dados.importar(await UI.lerArquivoTexto(f)); aviso('Backup importado.'); App.redesenhar(); } catch (err) { aviso(err.message, 'erro'); }
        }
        if (b.dataset.a === 'lixeira') { let n = 0; Object.keys(d.avisos).forEach(function (k) { if (d.avisos[k].lixeira) { delete d.avisos[k]; n++; } }); Dados.salvar(); aviso(n + ' aviso(s) apagados.'); }
        if (b.dataset.a === 'zerar' && await confirmar('Apagar tudo', 'Apagar <b>todos</b> os clientes, propostas, quadros e avisos deste navegador? Exporte um backup antes.', 'Apagar tudo')) { Dados.zerar(); App.redesenhar(); }
      };
    }
  };
})();
