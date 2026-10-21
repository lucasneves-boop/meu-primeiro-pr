/* Central de habilitação: links oficiais para emitir certidões (federal, estados, capitais) e regras do checklist.
   Só entram links conferidos em 21/10/2026: "v" página do serviço confirmada no domínio oficial;
   "d" domínio oficial confirmado (página inicial, procurar "Certidões"); "n" não confirmado (usar a busca). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Habilitacao = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERIFICADO_EM = '2026-10-21';

  // ---------- federal ----------
  const FEDERAL = [
    { id: 'cnd-federal', t: 'CND Federal (Receita + PGFN)', u: 'https://www.gov.br/pt-br/servicos/emitir-certidao-de-regularidade-fiscal', s: 'v', validade: 180, base: 'Art. 68, III — Fazenda federal e dívida ativa da União (Portaria Conjunta RFB/PGFN 1.751/2014)', obs: 'Inclui contribuições previdenciárias. Se der "positiva", consulte pendências no e-CAC.' },
    { id: 'crf-fgts', t: 'CRF — Regularidade do FGTS (Caixa)', u: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf', s: 'v', validade: 30, base: 'Art. 68, IV', obs: 'Validade curta: emita perto da sessão.' },
    { id: 'cndt', t: 'CNDT — Débitos Trabalhistas (TST)', u: 'https://cndt-certidao.tst.jus.br/inicio.faces', s: 'v', validade: 180, base: 'Art. 68, V' },
    { id: 'cartao-cnpj', t: 'Cartão CNPJ (Receita Federal)', u: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp', s: 'v', validade: 0, base: 'Art. 68, I', obs: 'Confira CNAE e endereço: devem bater com o objeto e a proposta.' },
    { id: 'simples', t: 'Consulta Optante Simples Nacional', u: 'https://consopt.www8.receita.fazenda.gov.br/consultaoptantes', s: 'v', validade: 0, base: 'Comprovação de ME/EPP (LC 123/2006)', obs: 'Útil para provar enquadramento e retenções na nota.' },
    { id: 'tcu', t: 'TCU — Consulta Consolidada de Pessoa Jurídica', u: 'https://certidoes.apps.tcu.gov.br/', s: 'v', validade: 0, base: 'Consulta feita pelo agente de contratação (CEIS, CNEP, CNJ, inidôneos TCU)', obs: 'Página de orientação: https://portal.tcu.gov.br/carta-de-servicos/certidoes/consulta-consolidada-de-pessoa-juridica' },
    { id: 'ceis', t: 'CEIS / CNEP — Sanções (Portal da Transparência)', u: 'https://portaldatransparencia.gov.br/sancoes', s: 'v', validade: 0, base: 'Art. 91, § 4º — verificação de impedimentos' },
    { id: 'cnj', t: 'CNJ — Improbidade Administrativa', u: 'https://www.cnj.jus.br/improbidade_adm/consultar_requerido.php', s: 'v', validade: 0, base: 'Impedimento por condenação (Lei 8.429/1992)' },
    { id: 'sicaf', t: 'SICAF — Sistema de Cadastramento Unificado de Fornecedores', u: 'https://www3.comprasnet.gov.br/sicaf-web/index.jsf', s: 'v', validade: 0, base: 'Arts. 87 e 70, III — substitui documentos já registrados', obs: 'Acesso com conta gov.br nível prata ou ouro.' },
    { id: 'compras', t: 'Compras.gov.br', u: 'https://www.gov.br/compras/pt-br', s: 'v', validade: 0, base: 'Portal de compras federal' },
    { id: 'govbr', t: 'Conta gov.br (subir para prata/ouro)', u: 'https://contas.acesso.gov.br/', s: 'v', validade: 0, base: 'Pré-requisito do SICAF' },
    { id: 'receita-orienta', t: 'Receita — orientação sobre certidões e situação fiscal', u: 'https://receita.economia.gov.br/orientacao/tributaria/certidoes-e-situacao-fiscal', s: 'v', validade: 0, base: 'Ajuda para certidão positiva / pendências' }
  ];

  // ---------- estados: SEFAZ (e PGE quando separada), Junta Comercial e TJ (falência) ----------
  // validade = dias informados pela fonte oficial; null = conferir na própria certidão.
  const UF = {
    AC: { nome: 'Acre', sefaz: [{ t: 'SEFAZ-AC — Certidão Negativa', u: 'https://www.ac.gov.br/servico/certidao-negativa-de-debito-sefaz', s: 'v' }, { t: 'PGE-AC — Certidão de Dívida Ativa', u: 'https://www.ac.gov.br/servico/certidao-negativa-de-debitos-pge', s: 'v' }], validade: 60,
      junta: { t: 'JUCEAC', u: 'https://juceac.ac.gov.br/', s: 'd' }, tj: { t: 'TJAC', u: 'https://www.tjac.jus.br/', s: 'd' } },
    AL: { nome: 'Alagoas', sefaz: [{ t: 'SEFAZ-AL — Certidão (Alagoas Digital)', u: 'https://alagoasdigital.al.gov.br/servico/79', s: 'v' }, { t: 'PGE-AL — Dívida Ativa', u: 'https://alagoasdigital.al.gov.br/servico/2139', s: 'v' }], validade: 60,
      junta: { t: 'JUCEAL — Certidões', u: 'https://alagoasdigital.al.gov.br/servico/2101', s: 'v', extra: { t: 'Facilita AL', u: 'https://www.facilita.al.gov.br/home/certidao/' } }, tj: { t: 'TJAL', u: 'https://www.tjal.jus.br/', s: 'd' } },
    AM: { nome: 'Amazonas', sefaz: [{ t: 'SEFAZ-AM (portal, menu Certidões)', u: 'https://www.sefaz.am.gov.br', s: 'd' }], validade: 30,
      junta: { t: 'JUCEA — Certidão digital', u: 'https://www.jucea.am.gov.br/certidao-digital/', s: 'v' }, tj: { t: 'TJAM — Pedido de Certidão (negativa unificada)', u: 'https://www.tjam.jus.br', s: 'd', validade: 30 } },
    AP: { nome: 'Amapá', sefaz: [{ t: 'SEFAZ-AP (portal)', u: 'https://sefaz.portal.ap.gov.br/', s: 'd' }, { t: 'SEFAZ-AP — Validar CND', u: 'https://virtual.sefaz.ap.gov.br/sefazvirtual/2018-01-15-12-35-03/cnd-validar-2', s: 'v' }], validade: 60,
      junta: { t: 'JUCAP — Certidões (AP Digital)', u: 'https://apdigital.portal.ap.gov.br/carta-de-servico/certidoes122', s: 'v' }, tj: { t: 'TJAP', u: 'https://www.tjap.jus.br/', s: 'd' } },
    BA: { nome: 'Bahia', sefaz: [{ t: 'SEFAZ-BA — Certidão (ba.gov.br)', u: 'https://servicos.ba.gov.br/detalhe/servico/1617', s: 'v' }, { t: 'SEFAZ-BA — Informações sobre certidões', u: 'https://www.sefaz.ba.gov.br/inspetoria-eletronica/icms/certidoes/informacoes/', s: 'v' }, { t: 'PGE-BA — Certidão de regularidade (dívida ativa)', u: 'https://dividaativa.pge.ba.gov.br/portal-divida-ativa/portal/certidao-regularidade', s: 'v' }], validade: 60,
      junta: { t: 'JUCEB', u: 'https://www.ba.gov.br/juceb/', s: 'd' }, tj: { t: 'TJBA', u: 'https://www.tjba.jus.br/portal/', s: 'd' } },
    CE: { nome: 'Ceará', sefaz: [{ t: 'SEFAZ-CE — Emitir Certidão Negativa Estadual', u: 'https://portalservicos.sefaz.ce.gov.br/tema-geral+canais-de-atendimento+certidoes-e-certificados-emissao-e-validacao+emitir-certidao-negativa-estadual+64da4ef9170f5a26dc566594', s: 'v' }], validade: 60,
      junta: { t: 'JUCEC — Certidões Web', u: 'https://www.jucec.ce.gov.br/projeto/certidoes-web/', s: 'v' }, tj: { t: 'TJCE', u: 'https://www.tjce.jus.br/', s: 'd' } },
    DF: { nome: 'Distrito Federal', sefaz: [{ t: 'Receita DF — Certidão Negativa (vale também como municipal: ISS/IPTU são distritais)', u: 'https://www.receita.fazenda.df.gov.br/aplicacoes/CartaServicos/servico.cfm?codTipoPessoa=7&codServico=601&codSubCategoria=134', s: 'v' }], validade: 90,
      junta: { t: 'JUCIS-DF — Certidões', u: 'https://www.jucis.df.gov.br/certidoes/', s: 'v' }, tj: { t: 'TJDFT', u: 'https://www.tjdft.jus.br/', s: 'd' } },
    ES: { nome: 'Espírito Santo', sefaz: [{ t: 'SEFAZ-ES — Emissão de certidões', u: 'https://sefaz.es.gov.br/emissao-de-certidoes', s: 'v' }, { t: 'SEFAZ-ES — Agência Virtual (CND)', u: 'https://internet.sefaz.es.gov.br/agenciavirtual/area_publica/cnd/emissao.php', s: 'v' }, { t: 'PGE-ES — Dívida ativa', u: 'https://dividaativa.pge.es.gov.br/portal', s: 'v' }], validade: 90,
      junta: { t: 'JUCEES', u: 'https://jucees.es.gov.br/', s: 'd' }, tj: { t: 'TJES', u: 'https://www.tjes.jus.br/', s: 'd' } },
    GO: { nome: 'Goiás', sefaz: [{ t: 'Economia-GO — Emitir Certidão Negativa de Débitos', u: 'https://www.go.gov.br/servicos-digitais/economia/emitir-certidao-negativa-de-debitos', s: 'v' }, { t: 'PGE-GO — Consulta CDA', u: 'https://www.epge.go.gov.br/cda/', s: 'v' }], validade: 60,
      junta: { t: 'JUCEG', u: 'https://goias.gov.br/juceg/', s: 'd' }, tj: { t: 'TJGO', u: 'https://www.tjgo.jus.br/', s: 'd' } },
    MA: { nome: 'Maranhão', sefaz: [{ t: 'SEFAZ-MA — Emissão de Certidão Negativa', u: 'http://sistemas.sefaz.ma.gov.br/certidoes/jsp/emissaoCertidaoNegativa/emissaoCertidaoNegativa.jsf', s: 'v' }], validade: 90,
      junta: { t: 'JUCEMA — Certidão (Empresa Fácil)', u: 'https://www.empresafacil.ma.gov.br/home/certidao/', s: 'v' }, tj: { t: 'TJMA', u: 'https://www.tjma.jus.br/', s: 'd' } },
    MG: { nome: 'Minas Gerais', sefaz: [{ t: 'SEF-MG — Certidão de Débitos Tributários', u: 'https://www.fazenda.mg.gov.br/empresas/certidao_debitos/', s: 'v' }], validade: 90, obs: 'Exige gov.br prata/ouro.',
      junta: { t: 'JUCEMG', u: 'https://www.jucemg.mg.gov.br/', s: 'd' }, tj: { t: 'TJMG', u: 'http://www.tjmg.jus.br/portal-tjmg/', s: 'd' } },
    MS: { nome: 'Mato Grosso do Sul', sefaz: [{ t: 'SEFAZ-MS — Certidão Tributária Estadual', u: 'https://www.sefaz.ms.gov.br/servicos-em-destaque/certidao-tributaria-estadual-emissao-certidao-negativa-de-debitos-estaduais-2/', s: 'v' }, { t: 'MS — Dívida ativa (certidão)', u: 'https://www.ms.gov.br/administracao-publica/inscricao-em-divida-ativa-certidao131', s: 'v' }], validade: 60,
      junta: { t: 'JUCEMS', u: 'https://www.jucems.ms.gov.br/', s: 'd' }, tj: { t: 'TJMS — Certidões', u: 'https://www5.tjms.jus.br/servicos/certidoes/', s: 'v' } },
    MT: { nome: 'Mato Grosso', sefaz: [{ t: 'SEFAZ-MT — Emissão (certidão conjunta SEFAZ + PGE)', u: 'https://www5.sefaz.mt.gov.br/en/-/6347016-emissao', s: 'v' }, { t: 'PGE-MT — Certidão negativa', u: 'https://www.pge.mt.gov.br/en/emitir-certid%C3%A3o-negativa-de-d%C3%A9bitos', s: 'v' }], validade: 60,
      junta: { t: 'JUCEMAT', u: 'https://www.jucemat.mt.gov.br/', s: 'd' }, tj: { t: 'TJMT', u: 'https://www.tjmt.jus.br/', s: 'd' } },
    PA: { nome: 'Pará', sefaz: [{ t: 'SEFA-PA — Pedido de certidões', u: 'http://www.sefa.pa.gov.br/index.php/orientacoes/manual-de-atendimento/961-pedido-certidoes', s: 'v' }], validade: null,
      junta: { t: 'JUCEPA — Certidões', u: 'https://www.jucepa.pa.gov.br/node/134', s: 'v' }, tj: { t: 'TJPA — Emissão de certidão', u: 'https://portal-certidao.tjpa.jus.br/emissao-certidao', s: 'v', validade: 90 } },
    PB: { nome: 'Paraíba', sefaz: [{ t: 'SEFAZ-PB — Certidão (Carta de Serviços)', u: 'https://cartaservico.sefaz.pb.gov.br/saibamais.php?id=91', s: 'v' }], validade: 60,
      junta: { t: 'JUCEP-PB', u: 'https://jucep.pb.gov.br/tabela-de-prazos', s: 'd' }, tj: { t: 'TJPB', u: 'https://www.tjpb.jus.br/', s: 'd' } },
    PE: { nome: 'Pernambuco', sefaz: [{ t: 'SEFAZ-PE — Atendimento (Certidão de Regularidade Fiscal)', u: 'https://atendimento.sefaz.pe.gov.br/', s: 'd' }, { t: 'PGE-PE — Certidões da Fazenda', u: 'http://www.pge.pe.gov.br/fazendacertidoes.aspx', s: 'v' }], validade: null, obs: 'Para licitação use a Certidão de Regularidade Fiscal (não a de situação).',
      junta: { t: 'JUCEPE', u: 'https://portal.jucepe.pe.gov.br/', s: 'd' }, tj: { t: 'TJPE', u: 'https://www.tjpe.jus.br/', s: 'd' } },
    PI: { nome: 'Piauí', sefaz: [{ t: 'SEFAZ-PI — Certidão de situação', u: 'https://webas.sefaz.pi.gov.br/certidaoSituacao/', s: 'v' }, { t: 'PI Digital — CND estadual', u: 'https://pidigital.pi.gov.br/app/catalog/financas-e-pagamentos/obter-certidao-negativa-de-debitos-do-estado-piaui', s: 'v' }, { t: 'PI Digital — CND Dívida Ativa', u: 'https://pidigital.pi.gov.br/app/catalog/financas-e-pagamentos/emitir-certidao-negativa-divida-ativa', s: 'v' }], validade: 60,
      junta: { t: 'JUCEPI', u: 'https://www.jucepi.pi.gov.br/', s: 'd' }, tj: { t: 'TJPI', u: 'https://www.tjpi.jus.br/', s: 'd' } },
    PR: { nome: 'Paraná', sefaz: [{ t: 'SEFA-PR — Certidão Negativa Receita Estadual', u: 'https://www.fazenda.pr.gov.br/servicos/Mais-buscados/Certidoes/Emitir-Certidao-Negativa-Receita-Estadual-kZrX5gol', s: 'v' }], validade: 90,
      junta: { t: 'JUCEPAR', u: 'https://www.juntacomercial.pr.gov.br/', s: 'd' }, tj: { t: 'TJPR', u: 'https://www.tjpr.jus.br/', s: 'd' } },
    RJ: { nome: 'Rio de Janeiro', sefaz: [{ t: 'SEFAZ-RJ (Serviços > Certidões)', u: 'https://portal.fazenda.rj.gov.br', s: 'd' }, { t: 'PGE-RJ — Certidão de regularidade (dívida ativa)', u: 'https://pge.rj.gov.br/divida-ativa-certidao-de-regularidade-fiscal', s: 'v' }], validade: null, obs: 'No RJ são duas certidões: SEFAZ (débitos não inscritos) e PGE (dívida ativa, 180 dias).',
      junta: { t: 'JUCERJA', u: 'https://www.jucerja.rj.gov.br/', s: 'd' }, tj: { t: 'TJRJ — Certidão judicial', u: 'http://www4.tjrj.jus.br/Portal-Extrajudicial/certidao/judicial/', s: 'v', obs: 'Capital, Niterói e Campos: distribuidor da comarca.' } },
    RN: { nome: 'Rio Grande do Norte', sefaz: [{ t: 'SET-RN (portal, menu Certidões)', u: 'https://www.set.rn.gov.br/', s: 'd' }], validade: null,
      junta: { t: 'JUCERN (não confirmado — use a busca)', u: '', s: 'n' }, tj: { t: 'TJRN', u: 'https://www.tjrn.jus.br/', s: 'd' } },
    RO: { nome: 'Rondônia', sefaz: [{ t: 'SEFIN-RO — Certidão Negativa', u: 'https://portalcontribuinte.sefin.ro.gov.br/Publico/certidaoNegativa.jsp', s: 'v' }], validade: null,
      junta: { t: 'JUCER — Certidão simplificada', u: 'https://rondonia.ro.gov.br/jucer/certidao-simplificada/', s: 'v' }, tj: { t: 'TJRO', u: 'https://www.tjro.jus.br/', s: 'd' } },
    RR: { nome: 'Roraima', sefaz: [{ t: 'SEFAZ-RR — Emitir CND', u: 'https://portalweb.sefaz.rr.gov.br/cnd/servlet/wp_siate_emitircndcentralservicopublica', s: 'v' }], validade: null,
      junta: { t: 'JUCERR', u: 'https://www.jucerr.rr.gov.br/', s: 'd' }, tj: { t: 'TJRR', u: 'https://www.tjrr.jus.br/', s: 'd' } },
    RS: { nome: 'Rio Grande do Sul', sefaz: [{ t: 'Receita Estadual RS — Certidão', u: 'https://receita.fazenda.rs.gov.br/servicos-ao-cidadao/servicos?servico=390', s: 'v' }], validade: null,
      junta: { t: 'JUCISRS', u: 'https://jucisrs.rs.gov.br/', s: 'd' }, tj: { t: 'TJRS — Certidão Cível 1º Grau (Falência)', u: 'http://tjrs.jus.br/site/servicos/alvara_de_folha_corrida_cert2g', s: 'v' } },
    SC: { nome: 'Santa Catarina', sefaz: [{ t: 'SEF-SC — Emitir CND', u: 'https://www.sef.sc.gov.br/servicos/emitir-certidao-negativa-de-debitos-fiscais-cnd', s: 'v' }], validade: null,
      junta: { t: 'JUCESC', u: 'https://www.jucesc.sc.gov.br/', s: 'd' }, tj: { t: 'TJSC', u: 'https://www.tjsc.jus.br/', s: 'd' } },
    SE: { nome: 'Sergipe', sefaz: [{ t: 'SEFAZ-SE — Certidões', u: 'https://www.sefaz.se.gov.br/SitePages/certidoes.aspx', s: 'v' }], validade: null,
      junta: { t: 'JUCESE — Certidão simplificada', u: 'https://jucese.se.gov.br/certidao-simplificada-e-especifica/', s: 'v' }, tj: { t: 'TJSE — Certidão judicial', u: 'https://www.tjse.jus.br/portal/servicos/judiciais/certidao-judicial', s: 'v' } },
    SP: { nome: 'São Paulo', sefaz: [{ t: 'SEFAZ-SP — Certidões (débitos não inscritos)', u: 'https://portal.fazenda.sp.gov.br/servicos/certidoes/Paginas/Guia-N%C3%A3o-Inscritos.aspx', s: 'v' }, { t: 'PGE-SP — Certidão de regularidade (dívida ativa)', u: 'https://www.portalcms.pge.sp.gov.br/pge/servicos-ao-cidadao/servicos-fiscais/certidoes-regularidade', s: 'v' }], validade: null, obs: 'Desde 14/10/2026 a emissão estadual migrou para o SIDEB; siga o aviso na página.',
      junta: { t: 'JUCESP — Certidão simplificada (gratuita online)', u: 'https://www.jucesponline.sp.gov.br/Pesquisa.aspx?IDProduto=4', s: 'v' }, tj: { t: 'TJSP', u: 'https://www.tjsp.jus.br/', s: 'd' } },
    TO: { nome: 'Tocantins', sefaz: [{ t: 'SEFAZ-TO — Débitos fiscais / certidão', u: 'https://portal.sefaz.to.gov.br/debitos-fiscais', s: 'v' }], validade: null, obs: 'Taxa de R$ 15 informada pela SEFAZ-TO.',
      junta: { t: 'JUCETINS — Certidões', u: 'https://www.to.gov.br/jucetins/certidoes/38eqv2b8ygiv', s: 'v' }, tj: { t: 'TJTO', u: 'https://www.tjto.jus.br/', s: 'd' } }
  };

  // ---------- municípios: capitais + Catalão ----------
  const MUNICIPIOS = [
    { uf: 'AC', m: 'Rio Branco', u: 'https://www.riobranco.ac.gov.br/', s: 'n', obs: 'Página de emissão não localizada; contate a SEMFAZ.' },
    { uf: 'AL', m: 'Maceió', u: 'https://www.online.maceio.al.gov.br/n/guias/certidao.html', s: 'v', validade: 90 },
    { uf: 'AM', m: 'Manaus', u: 'https://semefatende.manaus.am.gov.br/empresa/certidoes/', s: 'v' },
    { uf: 'AP', m: 'Macapá', u: 'https://macapa.ap.gov.br/todos-os-servicos/', s: 'd', obs: 'Procure "Certidões" na lista de serviços.' },
    { uf: 'BA', m: 'Salvador', u: 'https://www2.sefaz.salvador.ba.gov.br/servico/certidoes', s: 'v', validade: 90 },
    { uf: 'CE', m: 'Fortaleza', u: 'https://cartadeservicos.sefin.fortaleza.ce.gov.br/', s: 'v', validade: 90, obs: 'Para licitação: Certidão Negativa de Tributos Municipais (não a de IPTU ou ISS).' },
    { uf: 'DF', m: 'Brasília', u: 'https://www.receita.fazenda.df.gov.br/aplicacoes/CartaServicos/servico.cfm?codTipoPessoa=7&codServico=601&codSubCategoria=134', s: 'v', validade: 90, obs: 'Certidão distrital única.' },
    { uf: 'ES', m: 'Vitória', u: 'https://tributario.vitoria.es.gov.br/servicos/CertidaoNegativa/CertidaoNegativa.aspx', s: 'v', validade: 60 },
    { uf: 'GO', m: 'Goiânia', u: 'https://www.goiania.go.gov.br/asp/certidao/cer03f.asp', s: 'v', obs: 'ISSQN / taxas e multas.' },
    { uf: 'GO', m: 'Catalão', u: 'https://www.catalao.go.gov.br/certidoes-negativas', s: 'v', validade: 30 },
    { uf: 'MA', m: 'São Luís', u: 'https://stm.semfaz.saoluis.ma.gov.br/credenciamento/jsp/emissaoCertidao/emissaoPublicaCertidao.jsf', s: 'v' },
    { uf: 'MG', m: 'Belo Horizonte', u: 'https://cnd.pbh.gov.br/CNDOnline/', s: 'v', validade: 30 },
    { uf: 'MS', m: 'Campo Grande', u: 'https://campogrande.ms.gov.br/sefin/certidoes', s: 'v', validade: 30, obs: 'Sistema de certidões mudou de endereço em 08/06/2026; siga o link da página.' },
    { uf: 'MT', m: 'Cuiabá', u: 'https://www.cuiaba.mt.gov.br/servicos/certidoes', s: 'v' },
    { uf: 'PA', m: 'Belém', u: 'https://sefin.belem.pa.gov.br/servicos-online/certidao-negativa-de-debito-eletronica/', s: 'v', obs: 'Exige cadastro no Acesso Belém.' },
    { uf: 'PB', m: 'João Pessoa', u: 'https://www.joaopessoa.pb.gov.br/pc/certidaoNegativa.xhtml', s: 'v', validade: 60 },
    { uf: 'PE', m: 'Recife', u: 'https://conecta.recife.pe.gov.br/servico/114', s: 'v' },
    { uf: 'PI', m: 'Teresina', u: 'https://pmt.pi.gov.br/teresinensedigital/financas/emissao-de-documentos/', s: 'v' },
    { uf: 'PR', m: 'Curitiba', u: 'https://www.curitiba.pr.gov.br/servicos/certidao-de-debitos-tributarios-e-divida-ativa/753', s: 'v' },
    { uf: 'RJ', m: 'Rio de Janeiro', u: 'https://carioca.rio/servicos/iss-pedido-de-certidao-de-situacao-fiscal/', s: 'v', validade: 90, obs: 'Exige também a certidão de Dívida Ativa da PGM: https://carioca.rio/servicos/emissao-de-certidao-de-divida-ativa/' },
    { uf: 'RN', m: 'Natal', u: 'https://www.natal.rn.gov.br/semut/noticia.php?id=9126', s: 'd', obs: 'Emissão no portal Directa (Serviços Públicos > Certidões).' },
    { uf: 'RO', m: 'Porto Velho', u: 'https://servicos.portovelho.ro.gov.br/', s: 'v', obs: 'Também pelo app PVH+.' },
    { uf: 'RR', m: 'Boa Vista', u: 'https://boavista.rr.gov.br/', s: 'n', obs: 'Página de emissão não localizada; emissão pelo portal do contribuinte (inscrição municipal).' },
    { uf: 'RS', m: 'Porto Alegre', u: 'https://prefeitura.poa.br/carta-de-servicos/certidao-geral-de-debito-tributario-pessoa-fisica-e-juridica', s: 'v' },
    { uf: 'SC', m: 'Florianópolis', u: 'https://www.pmf.sc.gov.br/servicos/index.php?pagina=servpagina&id=3687', s: 'v', validade: 20 },
    { uf: 'SE', m: 'Aracaju', u: 'https://fazenda.aracaju.se.gov.br/app-semfaz/', s: 'v' },
    { uf: 'SP', m: 'São Paulo', u: 'https://prefeitura.sp.gov.br/web/fazenda/w/servicos/certidoes/2394', s: 'v', validade: 180, obs: 'Certidão Conjunta de Tributos Mobiliários (via DUC, com Senha Web).' },
    { uf: 'TO', m: 'Palmas', u: 'https://www.palmas.to.gov.br/core/servicos/certidao-negativa-pessoa/', s: 'v' }
  ];

  // ---------- checklist da Lei 14.133/2021 ----------
  const GRUPOS = [
    { id: 'juridica', t: 'Habilitação jurídica', base: 'Art. 66' },
    { id: 'fiscal', t: 'Regularidade fiscal, social e trabalhista', base: 'Art. 68' },
    { id: 'economica', t: 'Qualificação econômico-financeira', base: 'Art. 69' },
    { id: 'tecnica', t: 'Qualificação técnica', base: 'Art. 67' },
    { id: 'declaracoes', t: 'Declarações', base: 'Art. 63 e edital' }
  ];
  // chaves = palavras para reconhecer o documento em Meus Documentos; fonte = onde emitir
  const CHECKLIST = [
    { id: 'contrato', g: 'juridica', t: 'Ato constitutivo / contrato social consolidado (ou CCMEI)', chaves: ['contrato social', 'estatuto', 'ccmei', 'ato constitutivo', 'requerimento de empresario'], fonte: 'junta', validade: 0 },
    { id: 'cert-junta', g: 'juridica', t: 'Certidão simplificada da Junta Comercial', chaves: ['simplificada', 'junta'], fonte: 'junta', validade: 90, obs: 'Muitos editais aceitam até 90 dias.' },
    { id: 'docs-socios', g: 'juridica', t: 'Documento do representante e procuração (se houver)', chaves: ['procuracao', 'rg', 'cnh', 'identidade'], validade: 0 },
    { id: 'cartao-cnpj', g: 'fiscal', t: 'Cartão CNPJ', chaves: ['cnpj', 'cartao cnpj', 'comprovante de inscricao'], fonte: 'federal:cartao-cnpj', validade: 0 },
    { id: 'insc-estadual', g: 'fiscal', t: 'Inscrição estadual (Sintegra) e/ou municipal', chaves: ['inscricao estadual', 'inscricao municipal', 'sintegra', 'fic'], fonte: 'sefaz', validade: 0 },
    { id: 'cnd-federal', g: 'fiscal', t: 'CND Federal (tributos federais e dívida ativa da União)', chaves: ['cnd federal', 'federal', 'receita federal', 'pgfn', 'uniao'], fonte: 'federal:cnd-federal', validade: 180 },
    { id: 'cnd-estadual', g: 'fiscal', t: 'Certidão estadual (SEFAZ e, quando separada, PGE)', chaves: ['certidao estadual', 'cnd estadual', 'debitos estaduais', 'sefaz', 'icms', 'pge'], fonte: 'sefaz', validade: 60 },
    { id: 'cnd-municipal', g: 'fiscal', t: 'Certidão municipal (tributos mobiliários / ISS)', chaves: ['certidao municipal', 'cnd municipal', 'tributos municipais', 'debitos municipais', 'prefeitura', 'iss'], fonte: 'municipio', validade: 30 },
    { id: 'crf-fgts', g: 'fiscal', t: 'CRF do FGTS', chaves: ['fgts', 'crf'], fonte: 'federal:crf-fgts', validade: 30 },
    { id: 'cndt', g: 'fiscal', t: 'CNDT — trabalhista', chaves: ['cndt', 'trabalhista', 'tst'], fonte: 'federal:cndt', validade: 180 },
    { id: 'balanco', g: 'economica', t: 'Balanço patrimonial e DRE dos 2 últimos exercícios', chaves: ['balanco', 'dre', 'demonstracao'], validade: 0, obs: 'Com termos de abertura/encerramento ou recibo do SPED. Índices LG, SG e LC > 1 costumam ser exigidos.' },
    { id: 'falencia', g: 'economica', t: 'Certidão negativa de falência e recuperação judicial', chaves: ['falencia', 'recuperacao judicial', 'concordata'], fonte: 'tj', validade: 90, obs: 'Emitida pelo TJ (ou distribuidor) da sede da empresa.' },
    { id: 'atestados', g: 'tecnica', t: 'Atestados de capacidade técnica', chaves: ['atestado'], validade: 0, obs: 'Compatíveis em características, quantidades e prazos (art. 67, II).' },
    { id: 'conselho', g: 'tecnica', t: 'Registro no conselho profissional (CREA, CRA, CRF, CRM…) e CAT', chaves: ['crea', 'cra', 'cau', 'cat', 'conselho', 'conselho regional', 'registro profissional'], fonte: 'busca:certidão de registro de pessoa jurídica conselho', validade: null },
    { id: 'licencas', g: 'tecnica', t: 'Alvará, licença sanitária / ambiental, AFE ANVISA (se o objeto exigir)', chaves: ['alvara', 'licenca', 'anvisa', 'afe', 'vigilancia sanitaria'], fonte: 'busca:alvará de funcionamento', validade: null },
    { id: 'sicaf', g: 'declaracoes', t: 'SICAF atualizado (níveis I a VI)', chaves: ['sicaf'], fonte: 'federal:sicaf', validade: 0 },
    { id: 'declaracoes', g: 'declaracoes', t: 'Declarações: menor (art. 7º, XXXIII, CF), ME/EPP, reserva de cargos PcD, cumprimento dos requisitos, proposta compatível com custos', chaves: ['declaracao', 'declaracoes'], validade: 0, obs: 'Nos portais eletrônicos muitas são marcadas na própria plataforma.' }
  ];

  // ---------- SICAF: os 6 níveis (IN SEGES/MP 3/2018) ----------
  const SICAF_NIVEIS = [
    { n: 'I', t: 'Credenciamento', d: 'Dados da empresa, sócios, representante e conta bancária. Obrigatório para operar no Compras.gov.br.', docs: ['Cartão CNPJ', 'Documento do representante', 'Procuração (se não for sócio)'] },
    { n: 'II', t: 'Habilitação jurídica', d: 'Ato constitutivo e alterações.', docs: ['Contrato social consolidado / CCMEI', 'Certidão simplificada da Junta'] },
    { n: 'III', t: 'Regularidade fiscal e trabalhista federal', d: 'Receita/PGFN, FGTS e CNDT. O SICAF consulta as bases e atualiza sozinho; confira as datas.', docs: ['CND Federal', 'CRF FGTS', 'CNDT'] },
    { n: 'IV', t: 'Regularidade fiscal estadual/distrital e municipal', d: 'Certidões emitidas fora do SICAF: anexe o PDF e a validade.', docs: ['Certidão estadual (SEFAZ/PGE)', 'Certidão municipal'] },
    { n: 'V', t: 'Qualificação técnica', d: 'Registro em conselho e atestados (quando aplicável).', docs: ['Registro no conselho', 'Atestados'] },
    { n: 'VI', t: 'Qualificação econômico-financeira', d: 'Balanço do último exercício e certidão de falência. O sistema calcula os índices.', docs: ['Balanço patrimonial e DRE', 'Certidão de falência'] }
  ];

  function normalizar(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }

  function palavras(s) { return normalizar(s).replace(/[^a-z0-9]+/g, ' ').trim(); }

  function buscaGoogle(q) { return 'https://www.google.com/search?q=' + encodeURIComponent(q); }

  function municipiosDe(uf, extras) {
    const base = MUNICIPIOS.filter(function (x) { return x.uf === uf; });
    const meus = (extras || []).filter(function (x) { return x.uf === uf; }).map(function (x) { return Object.assign({ s: 'u' }, x); });
    return base.concat(meus).sort(function (a, b) { return a.m.localeCompare(b.m, 'pt-BR'); });
  }

  function acharMunicipio(uf, nome, extras) {
    const n = normalizar(nome); if (!n) return null;
    return municipiosDe(uf, extras).find(function (x) { return normalizar(x.m) === n; }) || null;
  }

  // Liga cada item do checklist ao documento mais recente do cliente (por nome).
  function documentoDoItem(item, docs) {
    const cands = (docs || []).filter(function (d) {
      const n = ' ' + palavras(d.nome) + ' ';
      return item.chaves.some(function (k) { return n.indexOf(' ' + palavras(k) + ' ') >= 0; });
    });
    cands.sort(function (a, b) { return (b.validade || b.emissao || '') < (a.validade || a.emissao || '') ? -1 : 1; });
    return cands[0] || null;
  }

  function diasAte(data, hoje) {
    if (!data) return null;
    const h = hoje ? new Date(hoje + 'T12:00:00') : new Date(); h.setHours(12, 0, 0, 0);
    return Math.round((new Date(data + 'T12:00:00') - h) / 86400000);
  }

  // situação: falta | vencido | vencendo (≤ 7 dias) | ok | sem-validade
  function situacao(item, doc, hoje) {
    if (!doc) return { codigo: 'falta', rotulo: 'Falta' };
    if (!doc.validade) return { codigo: 'sem-validade', rotulo: 'Cadastrado' };
    const d = diasAte(doc.validade, hoje);
    if (d < 0) return { codigo: 'vencido', rotulo: 'Vencido há ' + (-d) + ' dia(s)', dias: d };
    if (d <= 7) return { codigo: 'vencendo', rotulo: d === 0 ? 'Vence hoje' : 'Vence em ' + d + ' dia(s)', dias: d };
    return { codigo: 'ok', rotulo: 'Válido por ' + d + ' dia(s)', dias: d };
  }

  function painel(docs, hoje) {
    const linhas = CHECKLIST.map(function (it) { const doc = documentoDoItem(it, docs); return { item: it, doc: doc, sit: situacao(it, doc, hoje) }; });
    const c = { ok: 0, 'sem-validade': 0, vencendo: 0, vencido: 0, falta: 0 };
    linhas.forEach(function (l) { c[l.sit.codigo]++; });
    const prontos = c.ok + c['sem-validade'];
    return { linhas: linhas, contagem: c, pct: Math.round(prontos / CHECKLIST.length * 100) };
  }

  // Data do lembrete: N dias antes do vencimento (nunca no passado).
  function dataLembrete(validade, antecedencia, hoje) {
    if (!validade) return null;
    const d = new Date(validade + 'T12:00:00'); d.setDate(d.getDate() - (antecedencia == null ? 7 : antecedencia));
    const h = hoje || new Date().toISOString().slice(0, 10);
    const r = d.toISOString().slice(0, 10);
    return r < h ? h : r;
  }

  function validarUrl(u) { return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(String(u || '')); }

  return {
    VERIFICADO_EM: VERIFICADO_EM, FEDERAL: FEDERAL, UF: UF, MUNICIPIOS: MUNICIPIOS, GRUPOS: GRUPOS, CHECKLIST: CHECKLIST, SICAF_NIVEIS: SICAF_NIVEIS,
    normalizar: normalizar, buscaGoogle: buscaGoogle, municipiosDe: municipiosDe, acharMunicipio: acharMunicipio,
    documentoDoItem: documentoDoItem, situacao: situacao, painel: painel, dataLembrete: dataLembrete, diasAte: diasAte, validarUrl: validarUrl
  };
});
