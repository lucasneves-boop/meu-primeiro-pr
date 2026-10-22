/* Contratos com assinatura eletrônica (no estilo do Clicksign): signatários, ordem, situação,
   trilha de auditoria, evidências e o registro de assinaturas que vai no fim do PDF. Puro, testável no Node. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(); else raiz.Contratos = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PAPEIS = { contratante: 'Contratante', contratado: 'Contratado', testemunha: 'Testemunha', aprovador: 'Aprovador', parte: 'Parte', fiador: 'Fiador' };
  const SITUACOES = { rascunho: 'Rascunho', enviado: 'Aguardando assinaturas', assinado: 'Assinado', recusado: 'Recusado', cancelado: 'Cancelado', expirado: 'Prazo vencido' };

  function soDigitos(t) { return String(t || '').replace(/\D/g, ''); }
  function cpfValido(c) {
    const d = soDigitos(c); if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const dv = function (n) { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
  }
  function emailValido(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim()); }
  function token(bytes) { const a = new Uint8Array(bytes || 16); (globalThis.crypto || require('crypto').webcrypto).getRandomValues(a); return Array.from(a).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
  // Código curto para conferir o documento (como o código de verificação do Clicksign).
  function codigoVerificacao(hash) { const h = String(hash || '').toUpperCase(); return [h.slice(0, 4), h.slice(4, 8), h.slice(8, 12), h.slice(12, 16)].join('-'); }
  async function sha256(dados) {
    const sub = (globalThis.crypto && globalThis.crypto.subtle) || require('crypto').webcrypto.subtle;
    const buf = typeof dados === 'string' ? new TextEncoder().encode(dados) : dados instanceof ArrayBuffer ? new Uint8Array(dados) : dados;
    const h = await sub.digest('SHA-256', buf); return Array.from(new Uint8Array(h)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  // Quem pode assinar agora: na ordem sequencial, só o primeiro pendente (mesmo grupo de ordem assina junto).
  function podeAssinar(c, sid) {
    const s = (c.signatarios || []).find(function (x) { return x.id === sid; }); if (!s || s.assinadoEm || s.recusadoEm) return false;
    if (c.situacao !== 'enviado') return false;
    if (c.prazo && new Date(c.prazo + 'T23:59:59') < new Date()) return false;
    if (!c.sequencial) return true;
    const pend = c.signatarios.filter(function (x) { return !x.assinadoEm; }).map(function (x) { return Number(x.ordem) || 1; });
    return (Number(s.ordem) || 1) === Math.min.apply(null, pend);
  }
  // Situação a partir dos signatários (assinado quando todos assinaram; recusado se alguém recusou).
  function situacao(c, agora) {
    if (c.situacao === 'cancelado' || c.situacao === 'rascunho') return c.situacao;
    const ss = c.signatarios || [];
    if (ss.some(function (s) { return s.recusadoEm; })) return 'recusado';
    if (ss.length && ss.every(function (s) { return s.assinadoEm; })) return 'assinado';
    if (c.prazo && new Date(c.prazo + 'T23:59:59') < (agora || new Date())) return 'expirado';
    return 'enviado';
  }
  function progresso(c) { const ss = c.signatarios || []; const f = ss.filter(function (s) { return s.assinadoEm; }).length; return { feitas: f, total: ss.length, pct: ss.length ? f / ss.length : 0 }; }
  function validarEnvio(c) {
    const erros = [];
    if (!c.documento || !c.documento.hash) erros.push('Anexe o documento (PDF) ou gere pelo modelo.');
    if (!(c.signatarios || []).length) erros.push('Adicione ao menos um signatário.');
    (c.signatarios || []).forEach(function (s, i) {
      if (!String(s.nome || '').trim()) erros.push('Signatário ' + (i + 1) + ': informe o nome.');
      if (!emailValido(s.email) && !soDigitos(s.telefone)) erros.push('Signatário ' + (i + 1) + ': informe e-mail ou WhatsApp para enviar o link.');
      if (s.cpf && !cpfValido(s.cpf)) erros.push('Signatário ' + (i + 1) + ': CPF inválido.');
    });
    return erros;
  }
  function evento(c, tipo, texto, extra) { c.trilha = c.trilha || []; const e = Object.assign({ em: new Date().toISOString(), tipo: tipo, texto: texto }, extra || {}); c.trilha.push(e); return e; }

  // Preenche um modelo com {variáveis}; o que faltar fica entre colchetes para revisar.
  function preencher(texto, v) { return String(texto || '').replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null && v[k] !== '' ? v[k] : '[' + k.toUpperCase() + ']'; }); }
  function pendencias(texto) { return (String(texto || '').match(/\[[A-Z_]+\]/g) || []).filter(function (x, i, a) { return a.indexOf(x) === i; }); }

  // Linhas do registro de assinaturas (a página que vai no fim do PDF e o comprovante).
  function registro(c) {
    const fmt = function (iso) { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (horário de Brasília)'; };
    const l = ['REGISTRO DE ASSINATURAS ELETRÔNICAS', 'Documento: ' + (c.titulo || ''), 'Código de verificação: ' + codigoVerificacao(c.documento && c.documento.hash), 'SHA-256 do documento original: ' + ((c.documento && c.documento.hash) || ''), 'Criado em: ' + fmt(c.criadoEm) + ' por ' + (c.criadoPor || ''), ''];
    (c.signatarios || []).forEach(function (s) {
      l.push((PAPEIS[s.papel] || 'Parte') + ': ' + s.nome + (s.cpf ? ' · CPF ' + mascaraCpf(s.cpf) : '') + (s.email ? ' · ' + s.email : ''));
      if (s.assinadoEm) l.push('  Assinou em ' + fmt(s.assinadoEm) + ' · ' + (s.evidencias && s.evidencias.metodo === 'desenho' ? 'assinatura desenhada' : 'assinatura digitada') + (s.evidencias && s.evidencias.dispositivo ? ' · ' + s.evidencias.dispositivo : '') + (s.evidencias && s.evidencias.geo ? ' · local aprox. ' + s.evidencias.geo : '') + ' · conferiu o documento SHA-256 ' + ((s.evidencias && s.evidencias.hashVisto) || '').slice(0, 16) + '…');
      else if (s.recusadoEm) l.push('  Recusou em ' + fmt(s.recusadoEm) + ': ' + (s.motivo || ''));
      else l.push('  Pendente');
    });
    l.push('', 'Assinatura eletrônica nos termos da Lei 14.063/2020 e da MP 2.200-2/2001, art. 10, § 2º, com as evidências acima. Para conferir, use o validador do Seven Contrato com o código de verificação ou o arquivo.');
    return l;
  }
  function mascaraCpf(c) { const d = soDigitos(c); return d.length === 11 ? '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**' : c; }

  return { PAPEIS: PAPEIS, SITUACOES: SITUACOES, cpfValido: cpfValido, emailValido: emailValido, token: token, codigoVerificacao: codigoVerificacao, sha256: sha256, podeAssinar: podeAssinar, situacao: situacao, progresso: progresso, validarEnvio: validarEnvio, evento: evento, preencher: preencher, pendencias: pendencias, registro: registro, mascaraCpf: mascaraCpf, soDigitos: soDigitos };
});
