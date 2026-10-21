/* Configurações: responsável, backup e dados locais. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, campo, confirmar, aviso } = UI;

  Telas.config = {
    titulo: 'Configurações',
    render: function (el) {
      const d = Dados.e;
      let tamanho = 0; try { tamanho = (localStorage.getItem('seven-licita:v1') || '').length; } catch (e) { /* sem acesso */ }
      el.innerHTML = '<section class="cartao"><h3>Quem está operando</h3><form id="resp" class="linha">' + campo('Seu nome (aparece em anotações, comentários e atividade)', '<input name="responsavel" value="' + esc(d.config.responsavel || '') + '">') + '<button class="btn">Salvar</button></form></section>' +
        '<section class="cartao"><h3>Backup</h3><p>Os dados ficam <b>só neste navegador</b> (' + Math.round(tamanho / 1024) + ' KB, mais os arquivos anexados). Exporte um backup com frequência e importe em outro computador para continuar de lá. Anexos (PDFs) não vão no backup: guarde os originais.</p>' +
        '<div class="grupo-botoes"><button class="btn primario" data-a="exportar">Exportar backup (.json)</button><button class="btn" data-a="importar">Importar backup</button></div></section>' +
        '<section class="cartao"><h3>Fonte dos dados</h3><p class="mini">Licitações, itens, anexos e resultados vêm da API pública do PNCP (pncp.gov.br), sem login. O app não acessa portais de compra com as credenciais dos clientes e não envia propostas, lances ou mensagens: essas ações continuam sendo feitas no portal.</p></section>' +
        '<section class="cartao"><h3>Limpar</h3><div class="grupo-botoes"><button class="btn fantasma" data-a="lixeira">Esvaziar lixeira de avisos</button><button class="btn fantasma perigo" data-a="zerar">Apagar todos os dados deste navegador</button></div></section>' +
        '<p class="mini mudo">Seven · BPO de Licitações · (61) 98347-2232 · seg a sex 9h–18h, sáb até 12h</p>';
      el.querySelector('#resp').onsubmit = function (ev) { ev.preventDefault(); d.config.responsavel = new FormData(this).get('responsavel'); const m = d.membros = d.membros || []; if (d.config.responsavel && m.indexOf(d.config.responsavel) < 0) m.push(d.config.responsavel); Dados.salvar(); aviso('Salvo.'); };
      el.onclick = async function (ev) {
        const b = ev.target.closest('[data-a]'); if (!b) return;
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
