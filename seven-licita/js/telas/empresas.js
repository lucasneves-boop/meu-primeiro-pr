/* Clientes da Seven: cada um com seu CNPJ. */
(function () {
  'use strict';
  self.Telas = self.Telas || {};
  const { esc, cnpj, campo, opcoes, modal, confirmar, aviso } = UI;

  function formEmpresa(x) {
    x = x || {};
    return campo('Razão social *', '<input name="razao" required value="' + esc(x.razao) + '">') +
      campo('Nome fantasia', '<input name="fantasia" value="' + esc(x.fantasia) + '">') +
      '<div class="linha">' + campo('CNPJ *', '<input name="cnpj" required inputmode="numeric" value="' + esc(cnpj(x.cnpj)) + '" placeholder="00.000.000/0000-00">') +
      campo('Porte', '<select name="porte">' + opcoes(['ME', 'EPP', 'Demais'], x.porte || 'ME') + '</select>') + '</div>' +
      '<div class="linha">' + campo('UF', '<select name="uf">' + opcoes(PNCP.UFS, x.uf || 'GO') + '</select>') +
      campo('Município', '<input name="municipio" value="' + esc(x.municipio || '') + '">') + '</div>' +
      '<div class="linha">' + campo('Representante legal', '<input name="representante" value="' + esc(x.representante) + '">') +
      campo('Contato do cliente', '<input name="contato" value="' + esc(x.contato) + '" placeholder="nome de quem fala com a Seven">') + '</div>' +
      '<div class="linha">' + campo('E-mail', '<input name="email" type="email" value="' + esc(x.email || '') + '">', 'Usado no Seven Sign e nas mensagens.') + campo('WhatsApp / telefone', '<input name="telefone" inputmode="tel" value="' + esc(x.telefone || '') + '">') + '</div>' +
      campo('Ramo / o que vende ao governo', '<textarea name="ramo" rows="2">' + esc(x.ramo) + '</textarea>') +
      campo('Observações (logins, combinados, 2FA gov.br)', '<textarea name="obs" rows="2">' + esc(x.obs) + '</textarea>', 'Não guarde senhas aqui. Registre só quem usa cada login e o que foi combinado com o cliente.');
  }

  function validarCNPJ(c) {
    const s = String(c).replace(/\D/g, '');
    if (s.length !== 14 || /^(\d)\1+$/.test(s)) return false;
    const calc = function (n) { let soma = 0, pos = n - 7; for (let i = n; i >= 1; i--) { soma += s[n - i] * pos--; if (pos < 2) pos = 9; } const r = soma % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === +s[12] && calc(13) === +s[13];
  }

  async function editar(x) {
    const f = await modal({
      titulo: x ? 'Editar cliente' : 'Novo cliente', corpo: formEmpresa(x),
      validar: function (fd) { return validarCNPJ(fd.get('cnpj')) ? '' : 'CNPJ inválido.'; }
    });
    if (!f) return;
    const d = Object.fromEntries(f.entries()); d.cnpj = d.cnpj.replace(/\D/g, '');
    if (x) Object.assign(x, d);
    else { d.id = Dados.id('emp'); Dados.e.empresas.push(d); if (!Dados.e.empresaAtiva) Dados.e.empresaAtiva = d.id; }
    Dados.salvar(); App.redesenhar(); aviso('Cliente salvo.');
  }

  Telas.empresas = {
    titulo: 'Clientes (CNPJs)',
    novo: editar,
    render: function (el) {
      const e = Dados.e;
      el.innerHTML = '<div class="barra-acoes"><p class="mudo">Cada cliente da Seven com seu CNPJ. O cliente ativo (no topo) filtra propostas, documentos, disputas e monitoramento.</p><button class="btn primario" data-a="novo">+ Novo cliente</button></div>' +
        (e.empresas.length ? '<div class="cartoes">' + e.empresas.map(function (x) {
          const docs = e.documentos.filter(function (d) { return d.empresaId === x.id; });
          const venc = docs.filter(function (d) { return Nucleo.statusDocumento(d.validade).codigo !== 'valido' && d.validade; }).length;
          return '<article class="cartao"><header><h3>' + esc(x.fantasia || x.razao) + '</h3><span class="tag">' + esc(x.porte) + '</span></header>' +
            '<p class="mudo">' + esc(x.razao) + '<br>CNPJ ' + esc(cnpj(x.cnpj)) + ' · ' + esc((x.municipio ? x.municipio + '-' : '') + x.uf) + '</p>' +
            (x.ramo ? '<p>' + esc(x.ramo) + '</p>' : '') +
            '<p class="mini">' + docs.length + ' documento(s)' + (venc ? ' · <b class="alerta">' + venc + ' vencido(s)/vencendo</b>' : '') + ' · ' + e.propostas.filter(function (p) { return p.empresaId === x.id; }).length + ' proposta(s)</p>' +
            '<footer><button class="btn" data-a="ativar" data-id="' + x.id + '">' + (e.empresaAtiva === x.id ? '✓ Ativo' : 'Tornar ativo') + '</button><button class="btn fantasma" data-a="editar" data-id="' + x.id + '">Editar</button><button class="btn fantasma perigo" data-a="excluir" data-id="' + x.id + '">Excluir</button></footer></article>';
        }).join('') + '</div>' : UI.vazio('Nenhum cliente ainda', 'Cadastre o primeiro cliente (CNPJ) para começar a montar perfis de busca, propostas e documentos.', '<button class="btn primario" data-a="novo">+ Novo cliente</button>'));
      el.onclick = async function (ev) {
        const b = ev.target.closest('[data-a]'); if (!b) return;
        const x = e.empresas.find(function (y) { return y.id === b.dataset.id; });
        if (b.dataset.a === 'novo') editar();
        if (b.dataset.a === 'editar') editar(x);
        if (b.dataset.a === 'ativar') { e.empresaAtiva = x.id; Dados.salvar(); App.redesenhar(); }
        if (b.dataset.a === 'excluir' && await confirmar('Excluir cliente', 'Excluir <b>' + esc(x.razao) + '</b>? Propostas, documentos e disputas dele continuam guardados, mas sem cliente.', 'Excluir')) {
          e.empresas = e.empresas.filter(function (y) { return y !== x; }); if (e.empresaAtiva === x.id) e.empresaAtiva = e.empresas[0] && e.empresas[0].id; Dados.salvar(); App.redesenhar();
        }
      };
    }
  };
  Telas.empresas.validarCNPJ = validarCNPJ;
})();
