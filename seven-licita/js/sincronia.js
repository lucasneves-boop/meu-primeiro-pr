/* Liga o motor de integração (js/integracao.js) à gravação dos dados e às telas.
   A cada gravação: NF autorizada vai para o Seven Pay, resultados chegam ao Seven Hub com a Execução pronta,
   e as regras puras sincronizam disputa, Execução, pagamentos e contatos. */
(function () {
  'use strict';
  const I = self.Integracao;
  const { esc, campo, modal, aviso } = UI;
  function hojeMais(dias) { const d = new Date(); d.setDate(d.getDate() + dias); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function aoSalvar(e) {
    // NF autorizada entra no Seven Pay sem precisar clicar em "Lançar".
    if (Telas.notas && Telas.notas.lancarFinanceiro) (e.notas || []).forEach(function (n) { if (n.situacao === 'autorizada' && !n.lancadoFinanceiro) Telas.notas.lancarFinanceiro(n, true); });
    I.sincronizar(e);
    // Resultado da licitação → cartão do Seven Hub (+ tarefa na Seven Task quando ganha).
    (e.propostas || []).forEach(function (p) {
      if (!p.pendenteHub) return; const r = p.pendenteHub; delete p.pendenteHub;
      try {
        if (Telas.quadros && Telas.quadros.aplicarResultado) Telas.quadros.aplicarResultado(p, r);
        if (r === 'ganha' && !p.tarefaContrato && Telas.agenda && Telas.agenda.criar) { const t = Telas.agenda.criar('Assinar contrato e conferir empenho: ' + [p.modalidade, p.numero].filter(Boolean).join(' ') + (p.orgao ? ' · ' + p.orgao : ''), { data: hojeMais(3), tags: ['contrato'] }); if (t) p.tarefaContrato = t.id; }
      } catch (err) { console.warn('Integração:', err); }
    });
    I.sincronizar(e);
  }
  Dados.antesDeSalvar(aoSalvar);

  // ---------- resultado da licitação (Seven Bid, Seven Sniper e Seven Watch usam o mesmo botão) ----------
  function proposta(id) { return (Dados.e.propostas || []).find(function (p) { return p.id === id; }); }
  function botoesResultado(propostaId) {
    const p = proposta(propostaId); if (!p) return '';
    const rot = { ganha: '🏆 Ganha', perdida: 'Não vencida', fracassada: 'Fracassada / deserta' };
    return '<div class="int-res">' + (p.resultado ? '<span class="tag ' + (p.resultado === 'ganha' ? 'verde' : 'vermelho') + '">' + rot[p.resultado] + '</span><button type="button" class="btn mini fantasma" data-resultado="corrigir" data-proposta="' + esc(p.id) + '">Corrigir resultado</button>'
      : '<span class="mini mudo">Resultado:</span><button type="button" class="btn mini primario" data-resultado="ganha" data-proposta="' + esc(p.id) + '">🏆 Ganhamos</button><button type="button" class="btn mini" data-resultado="perdida" data-proposta="' + esc(p.id) + '">Não vencemos</button>') +
      '</div><p class="mini mudo int-res-dica">O resultado vale para Seven Bid, Seven Sniper, Seven Watch e Seven Hub. Ganha: o cartão vai para Contrato com a Execução pronta e a tarefa de assinatura entra na Seven Task.</p>';
  }
  async function marcarResultado(propostaId, r) {
    const p = proposta(propostaId); if (!p) return;
    if (r === 'corrigir') { const f = await modal({ titulo: 'Corrigir resultado', botao: 'Continuar', corpo: '<label class="check"><input type="radio" name="r" value="ganha" checked> Ganhamos</label><label class="check"><input type="radio" name="r" value="perdida"> Não vencemos</label><label class="check"><input type="radio" name="r" value="fracassada"> Fracassada / deserta</label>' }); if (!f) return; r = f.get('r'); }
    let extra = {};
    if (r === 'ganha') {
      const its = (p.itens || []).filter(function (i) { return i.participar !== false; });
      const f = await modal({ titulo: 'Licitação ganha', largo: true, botao: 'Confirmar', corpo: campo('Valor final adjudicado (R$)', '<input name="v" inputmode="decimal" value="' + esc(String(p.lanceFinal || I.totalProposta(p)).replace('.', ',')) + '">', 'Usado no contrato do Seven Hub. Deixe como está se for o total da proposta.') +
        (its.length > 1 ? '<fieldset><legend>Itens vencidos</legend>' + its.map(function (i) { return '<label class="check"><input type="checkbox" name="it" value="' + esc(String(i.numero)) + '"' + (i.vencido !== false ? ' checked' : '') + '> Item ' + esc(String(i.numero)) + ' · ' + esc(String(i.descricao || '').slice(0, 70)) + '</label>'; }).join('') + '</fieldset>' : '') });
      if (!f) return;
      extra = { valorFinal: Nucleo.lerNumeroBR(f.get('v')), itens: its.length > 1 ? f.getAll('it') : null };
    } else if (r === 'perdida') {
      const f = await modal({ titulo: 'Licitação não vencida', botao: 'Confirmar', corpo: '<label class="check"><input type="radio" name="r" value="perdida" checked> Outra empresa venceu</label><label class="check"><input type="radio" name="r" value="fracassada"> Fracassada / deserta</label><p class="mini mudo">O cartão no Seven Hub é arquivado e o Seven Watch é encerrado.</p>' }); if (!f) return; r = f.get('r');
    }
    I.registrarResultado(Dados.e, p.id, r, extra); Dados.salvar();
    aviso(r === 'ganha' ? 'Parabéns! Cartão no Seven Hub (Contrato), Seven Sniper e Seven Watch atualizados e tarefa criada na Seven Task.' : 'Resultado registrado em todas as ferramentas.');
    App.redesenhar();
  }
  document.addEventListener('click', function (ev) { const b = ev.target.closest('[data-resultado]'); if (!b) return; ev.preventDefault(); marcarResultado(b.dataset.proposta, b.dataset.resultado); });

  self.Integra = { botoesResultado: botoesResultado, marcarResultado: marcarResultado };
})();
