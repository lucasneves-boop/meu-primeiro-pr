/* Plataforma 7 — armazenamento local (localStorage para dados, IndexedDB para arquivos). */
(function () {
  'use strict';
  const CHAVE = 'seven-licita:v1';
  const SEIS_MESES = 183 * 86400000;

  function vazio() {
    return {
      empresas: [], empresaAtiva: null, catalogos: [], perfis: [], avisos: {}, orgaosFavoritos: [],
      propostas: [], documentos: [], produtos: [], disputas: [], monitor: [], analises: [],
      palavrasChave: [
        // Cores do método Smart Colors: vermelho risco, amarelo documentação, verde financeiro, azul operação, rosa vantagem.
        { termo: 'recurso', cor: 'vermelho' }, { termo: 'desclassific', cor: 'vermelho' }, { termo: 'inabilit', cor: 'vermelho' },
        { termo: 'documento', cor: 'amarelo' }, { termo: 'diligência', cor: 'amarelo' }, { termo: 'habilitação', cor: 'amarelo' },
        { termo: 'proposta atualizada', cor: 'verde' }, { termo: 'valor', cor: 'verde' }, { termo: 'entrega', cor: 'azul' },
        { termo: 'amostra', cor: 'azul' }, { termo: 'empate', cor: 'rosa' }, { termo: 'convoca', cor: 'vermelho' }
      ],
      config: { responsavel: 'Lucas Neves', capag: {} }
    };
  }

  let estado = carregar();
  const ouvintes = [];

  function carregar() {
    try {
      const t = localStorage.getItem(CHAVE);
      if (t) return Object.assign(vazio(), JSON.parse(t));
    } catch (e) { console.warn('Falha ao ler dados locais', e); }
    return vazio();
  }

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); }
    catch (e) { UI && UI.aviso('Não foi possível salvar: armazenamento do navegador cheio. Exporte um backup e limpe a lixeira de avisos.', 'erro'); }
    ouvintes.forEach(function (f) { f(); });
  }

  function id(prefixo) { return (prefixo || 'x') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // Avisos ficam 6 meses, como na referência.
  function limparAvisosAntigos() {
    const agora = Date.now(); let n = 0;
    Object.keys(estado.avisos).forEach(function (k) {
      const a = estado.avisos[k];
      if (!a.favorito && agora - new Date(a.capturadoEm || 0).getTime() > SEIS_MESES) { delete estado.avisos[k]; n++; }
    });
    return n;
  }

  // ---------- arquivos (IndexedDB) ----------
  let bancoP = null;
  function banco() {
    if (bancoP) return bancoP;
    bancoP = new Promise(function (ok, erro) {
      const r = indexedDB.open('seven-licita-arquivos', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('arquivos'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { erro(r.error); };
    });
    return bancoP;
  }
  async function guardarArquivo(chave, blob) {
    const db = await banco();
    return new Promise(function (ok, erro) { const tx = db.transaction('arquivos', 'readwrite'); tx.objectStore('arquivos').put(blob, chave); tx.oncomplete = ok; tx.onerror = function () { erro(tx.error); }; });
  }
  async function lerArquivo(chave) {
    const db = await banco();
    return new Promise(function (ok, erro) { const r = db.transaction('arquivos').objectStore('arquivos').get(chave); r.onsuccess = function () { ok(r.result); }; r.onerror = function () { erro(r.error); }; });
  }
  async function apagarArquivo(chave) {
    const db = await banco();
    return new Promise(function (ok) { const tx = db.transaction('arquivos', 'readwrite'); tx.objectStore('arquivos').delete(chave); tx.oncomplete = ok; tx.onerror = ok; });
  }

  // ---------- backup ----------
  // Tokens de servidores (Plêiade, Ágora) não saem no backup: quem recebe o arquivo não ganha acesso à equipe.
  function exportar() {
    const copia = JSON.parse(JSON.stringify(estado));
    ['pleiadeCfg', 'agoraCfg'].forEach(function (k) { if (copia[k] && copia[k].token) copia[k].token = ''; });
    return JSON.stringify({ app: 'seven-licita', versao: 1, exportadoEm: new Date().toISOString(), dados: copia }, null, 1);
  }
  function importar(texto) {
    const j = JSON.parse(texto);
    if (!j || j.app !== 'seven-licita' || !j.dados) throw new Error('Arquivo não é um backup da Plataforma 7.');
    const dados = JSON.parse(JSON.stringify(j.dados), function (k, v) { return k === '__proto__' || k === 'constructor' || k === 'prototype' ? undefined : v; });
    // anotações guardam HTML: no backup de terceiros, só texto passa
    if (dados.anotacoes && Array.isArray(dados.anotacoes.notas)) dados.anotacoes.notas.forEach(function (n) { if (n && typeof n.html === 'string' && /<\s*(script|iframe|object|embed|svg|math)|\son\w+\s*=|javascript:/i.test(n.html)) n.html = n.html.replace(/<[^>]*>/g, ' '); });
    estado = Object.assign(vazio(), dados); salvar();
  }

  function empresa(idEmp) { return estado.empresas.find(function (e) { return e.id === idEmp; }); }
  function empresaAtiva() { return empresa(estado.empresaAtiva) || estado.empresas[0] || null; }

  self.Dados = {
    get e() { return estado; }, salvar: salvar, id: id, aoMudar: function (f) { ouvintes.push(f); },
    limparAvisosAntigos: limparAvisosAntigos, guardarArquivo: guardarArquivo, lerArquivo: lerArquivo, apagarArquivo: apagarArquivo,
    exportar: exportar, importar: importar, empresa: empresa, empresaAtiva: empresaAtiva,
    zerar: function () { estado = vazio(); salvar(); }
  };
})();
