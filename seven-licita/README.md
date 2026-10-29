# Plataforma 7

Software da Seven para operar o departamento de licitações dos clientes, do edital ao pagamento, e a rotina da própria Seven
(vendas, equipe, estudo e ferramentas).
Espelha a rotina da Effecti (Encontrar → Cadastrar → Disputar → Monitorar + Análise de Mercado),
completa com o que o Siga Pregão tem e a Effecti não (funil de negócios, peças jurídicas, CAPAG com histórico de pagamento,
painel do dia, concorrentes) e traz um módulo de quadros no estilo Trello. Nome, marca e código são próprios.

## Como abrir

Não precisa instalar nada. Abra `index.html` no Chrome (dois cliques) ou publique a pasta em qualquer
hospedagem estática. Os dados de licitação vêm da API pública do PNCP, direto do navegador.

Os dados da Seven (clientes, propostas, quadros, documentos) ficam **no navegador** em que foram criados.
Use **Configurações → Exportar backup** com frequência e importe em outro computador para continuar de lá.

## Módulos

| Módulo | O que faz | Referência |
|---|---|---|
| Seven Painel | Avisos novos, propostas em preparo, disputas sem limite aprovado, prazos do pregoeiro, documentos vencendo, pendências do quadro, licitações publicadas hoje por faixa de valor | Effecti + Siga |
| Seven Edital | Catálogo de produtos (O que vendo / Qual tipo / O que não vendo) com prévia; perfis de busca por cliente, estados, modalidades e esferas; captura no PNCP (manual, diária ou semanal às segundas 10h); Meus Avisos com abas (todos, não lidos, favoritos, órgãos favoritos, lixeira) e painel de filtros (portal, código, UASG, órgão, modalidade, esferas, estados, municípios, datas, perfil, palavras-chave, ME/EPP, enviado para cadastro, SRP, CAPAG, valor total e **valor por item, grupo ou lote**, filtros salvos); Busca de Licitações (busca inteligente, portal, número, minhas, datas, esferas, modalidade, órgão/UASG, estados, cidades); **anotações da oportunidade** que acompanham o edital até o Seven Proposta, Seven Pregão, Seven Sessão e Seven Processo | Effecti |
| Seven Proposta | Proposta a partir do aviso ou do link do PNCP; itens carregados do PNCP com referência unitária; marca, modelo, custo e preço sugerido (custo ÷ (1 − impostos − margem)); alerta de valor acima da referência; planilha CSV (exportar/importar); declarações; anexos; registro do envio; impressão; proposta atualizada pós-lances com redistribuição; Meus Documentos com validade e aviso de 7 dias; Meus Produtos | Effecti |
| Seven Pregão | Valor limite e lance fechado por item, aprovação do cliente, estratégias (melhor posição, lance do limite, só 1º, posição alvo, Top 3, excluir colocado, distância do 1º, cobrir próprio lance), redução e intervalo mínimo, checklist da sessão e **simulador** para ensaiar a estratégia | Effecti |
| Seven Sessão | Licitações acompanhadas por situação, mensagens do pregoeiro (colar do chat), palavras-chave em cores, prazos com detecção automática ("prazo de 2 horas", "até dd/mm/aaaa"), recursos e contrarrazões com prazo de 3 dias úteis | Effecti + Siga |
| Seven Processo | Quadros, listas e cartões com arrastar e soltar; etiquetas, membros, início, prazo e lembrete; checklists com itens atribuídos (@nome) e com prazo (!dd/mm); comentários com menção; anexos; capa; campos personalizados (texto, número, moeda, data, caixa, lista); modelos de cartão; mover e copiar entre quadros; arquivar e restaurar; limite de cartões por lista; filtros; visões quadro, tabela, calendário e painel; automações "quando entrar na lista X, então…"; exportação CSV; atividade. O quadro padrão "Licitações" vai de Oportunidade a Pagamento, com checklist de cada etapa e **Execução** do contrato com vários empenhos, notas fiscais e pagamentos ligados entre si (NF ↔ empenho, pagamento → NF), saldos e alertas; visão de cronograma | Trello + Siga (Meus Negócios) |
| Seven Recurso | Categorias Impugnação, Esclarecimento, Intenção de recurso, Recurso, Contrarrazões e Execução, com busca; modelos preenchidos com os dados do cliente e da licitação; editar, copiar, baixar .doc, imprimir | Siga |
| Seven Painel de Preços | Por termo, período, estados, modalidades e esferas: valor homologado e estimado, sazonalidade, estados, órgãos, fornecedores vencedores com concentração Top 3/Top 5, preço por item homologado (mín., médio, mediana, máx., amostras), desconto médio sobre a referência; CSV, PDF e análises salvas | Effecti |
| Concorrentes | Histórico dos fornecedores vencedores nas análises salvas | Siga |
| Seven CAPAG | Nota de capacidade de pagamento dos municípios (Tesouro Nacional), importada da planilha do Tesouro Transparente (Excel ou CSV) ou registrada à mão, com filtros por nota e UF; a nota aparece nos avisos. Inclui o atraso real de pagamento de cada órgão, calculado com as notas e pagamentos da Execução dos cartões | Effecti + Siga |
| Clientes (CNPJs) | Vários clientes na mesma conta; o cliente ativo filtra propostas, documentos, disputas e monitoramento | Effecti + Siga |
| Seven IA | Assistente de IA estilo claude.ai sobre a API da Anthropic, com a chave do próprio usuário (fica só no navegador, fora do backup). Respostas em streaming; Opus 5.5 por padrão (Sonnet 5.5, Haiku 5.5 e Fable 5.1 opcionais) com nova tentativa automática em outro modelo quando o pedido é recusado; esforço ajustável; raciocínio resumido; pesquisa na web com fontes (Opus e Sonnet); anexos (PDF, imagem, DOCX, texto); projetos com instruções e documentos, inclusive as fontes do Seven Cadernos; contexto opcional do app (clientes, agenda, licitações, documentos vencendo); atalhos de licitação; editar, refazer, parar, exportar em Markdown e salvar em Anotações; custo estimado por conversa | claude.ai |
| Seven Loja | Vitrine dos serviços da Seven (preço sob consulta), busca, carrinho, cupons, lista de desejos e pedidos; o pedido vira negócio no Comercial e lançamento em Finanças; a mensagem ao cliente abre no WhatsApp para revisão antes do envio | Amazon |
| Seven Comercial | Venda do BPO: prospecção com cadência, diagnóstico SPIN, estudo de mercado, proposta com 3 opções e ROI, tratamento de objeções e plano de ação no fechamento | CRM |
| Seven Precificação | Produto e serviço (BDI do TCU) item a item; **vários itens** da mesma proposta: parâmetros globais aplicados a todos ao mesmo tempo, ajuste individual por item, margem/preço-alvo/desconto, rateio de frete, arredondamento para cima, alertas de referência (art. 59, III) e de inexequibilidade, totais por lote, valor por extenso, proposta completa, planilha de formação de preços e valores limite no Disputar | — |
| Seven Cotação e Seven Fornecedor | Cadastro de fornecedores com documentos; cotação do edital à planilha, mensagens de e-mail/WhatsApp, respostas, mapa comparativo e follow-up | — |
| Seven Habilitação | Checklist de habilitação (Lei 14.133, arts. 62 a 70), níveis do SICAF e links oficiais de certidões da União, dos 27 estados (SEFAZ/PGE, Junta, TJ) e de capitais e Catalão; cada link indica se foi verificado; lembretes de vencimento na Agenda | — |
| Seven Agenda | Tarefas, listas, recorrência por texto ("toda terça 8h"), calendário, matriz de Eisenhower, hábitos e pomodoro | TickTick |
| Seven Notas | Notas com texto rico, caneta, checklists, áudio, imagens, pastas, lixeira e notas trancadas com senha (AES-GCM) | Samsung Notes |
| Seven Metas | Planejamento pelo método 1 Ano em 12 Semanas: assistente de 6 etapas, plano tático, pontuação semanal (linha dos 85%), indicadores, diagnóstico, revisão da 13ª semana e blocos na Agenda | The 12 Week Year |
| Seven Chat | Canais, mensagens diretas, threads, reações e arquivos para a equipe, em tempo real (Firebase); mensagens agendadas e lembretes de mensagem na Agenda | Slack |
| Seven Reunião | Chamada direta 1 a 1 com qualquer pessoa, sem modo equipe (convite por link ou código, toque para atender ou recusar, chat e tela compartilhada; ponte PeerJS ou sala ao vivo do claude.ai); videochamada da equipe com código de sala, câmera, microfone, compartilhamento de tela, mão levantada, reações e chat (WebRTC, até 8 pessoas); enquetes, perguntas e respostas, quadro branco compartilhado, legendas ao vivo com transcrição, gravação local e ata | Google Meet |
| Seven Comunidade | Rede social só de profissionais de licitação: feed, seguir, respostas, repostagens, citações, enquetes, tendências, denúncias e moderação | X |
| Seven Faturamento | NF-e e NFS-e de saída, notas de entrada por XML, DANFE, retenções de órgão público e integração com Finanças. **Emissor guiado** em 8 etapas, com "?" em cada campo (o que é, para que serve, exemplo, erro comum, onde achar), fontes oficiais, pesquisa nos sites do governo e a aba Aprender com glossário | Bling + Sebrae |
| Seven Contrato | Contratos e termos para assinatura eletrônica: PDF próprio ou modelo da Seven (BPO, NDA, aditivo), signatários com papel e ordem, mensagem e prazo, link por WhatsApp/e-mail (texto revisado antes), assinatura remota ou presencial (digitada ou desenhada, com CPF e aceite), conferência do PDF por SHA-256, comprovante protegido (HMAC), trilha de auditoria, PDF final com página de registro e validador por arquivo ou código | Clicksign |
| Aparência | Temas automático, claro, escuro e dourado com preto, pelo botão do topo ou em Configurações | — |
| Fundo animado | Fundo interativo no estilo do PlayStation 4 (ondas de luz, partículas, constelação ou aurora) que reage ao mouse e ao clique; troca ou desliga em Configurações | PlayStation 4 |
| Menu retrátil | Botão no topo do menu recolhe a barra lateral para só os ícones; a escolha fica salva | — |
| Seven Financeiro | Controle financeiro pessoal, da empresa e de clientes assessorados: contas, cartões, orçamento, metas e perfis com PIN; no modelo Conta Azul, fluxo de caixa projetado (30/60/90 dias, faturas incluídas), previsto × realizado, clientes e fornecedores com inadimplência por faixa, conciliação bancária, centro de custo e competência | minhasfinancas.app.br + Conta Azul |
| Seven Arquivos | Pastas e arquivos no navegador (IndexedDB) | Google Drive |
| Seven Academia | Área de membros com cursos, mentorias e dicas | Kiwify |
| Seven Leitor | Biblioteca e leitura paginada de EPUB, PDF, Word e texto, com destaques, notas, marcadores e leitura em voz alta | Kindle |
| Seven Cadernos | Fontes (PDF, DOCX, TXT) com perguntas respondidas por trechos citados, resumo, FAQ, linha do tempo, quiz e análise de edital, sem IA externa | NotebookLM |
| Seven Perfil | Big Five (IPIP-50, domínio público), estilo DISC (uso reflexivo), temperamento e prática de raciocínio, por pessoa e em equipe. Não estima QI: isso exige teste normatizado e aplicação supervisionada | — |
| Seven Jogos | Xadrez com IA, quiz da Lei 14.133 com repetição espaçada, n-back, memória, matrizes, lances e tabela de Schulte, com as evidências científicas de cada um | — |
| Seven Design | Editor no padrão Canva Pro: 15 formatos e 10 modelos Seven; kit de marca (cores, fontes e logos); 22 fontes; formas, polígonos, ícones, linhas tracejadas, molduras para fotos e gráficos (colunas, barras, linha, pizza, rosca); efeitos de texto (sombra, neon, eco, contorno, vazado, destaque, texto curvo); gradientes; sombra, transparência, modos de mistura e espelhar; edição de fotos (filtros, brilho, contraste, saturação, recorte com zoom, remover fundo de cor uniforme); camadas com ocultar, travar e arrastar; agrupar; pincel de estilo; grade e margem de segurança; redimensionamento mágico; histórico de versões; modo apresentação; exportação PNG (com fundo transparente), JPG e PDF (inclusive alta resolução) | Canva Pro |
| Seven Calculadora | Científica com histórico e dezenas de calculadoras do dia a dia, incluindo custo de viagem (combustível, pedágio, diárias, paradas); também em janela flutuante (botão 🧮 no topo ou Alt+C) que fica por cima de qualquer tela e insere o resultado no campo em uso | All-in-One Calculator |
| Seven Comissão | Comissão sobre o preço de venda ou sobre o lucro líquido: quanto recebe, quanto vender em licitação para chegar à meta, margem líquida e percentual necessários, retenções, várias licitações e tabelas com todos os cenários; funil das licitações editável (em % ou por quantidades do histórico), que define a taxa de sucesso; prazo para recebimento por etapa (da sessão ao repasse), quantas licitações disputar para ganhar e prazo de retorno mês a mês; performance do cliente e relatório do mês com os números do Seven Processo (funil real, taxa de sucesso, ganho, faturado, recebido, atrasos, comissão e meta) e relatório completo da simulação, todos para imprimir; também em janela flutuante (botão % no topo ou Alt+M) | — |
| Seven Música | Biblioteca, playlists, Spotify/Deezer/Apple Music, equalizador, velocidade, volume normalizado e timer de sono | Spotify |

## Integração entre as ferramentas

O que é lançado numa ferramenta aparece nas outras, sem digitar de novo (`js/integracao.js`, regras puras e testadas, ligadas à gravação por `js/sincronia.js`):

- **Seven Edital → Seven Proposta → Seven Pregão / Seven Sessão / Seven Processo**: a proposta nasce do aviso; disputa, acompanhamento e cartão ficam ligados a ela. Preço, custo e quantidade alterados na proposta seguem para a disputa (o valor limite é preservado).
- **Resultado único**: "Ganhamos" ou "Não vencemos" (no Seven Proposta, Sniper ou Watch, ou a etiqueta no cartão) vale para todas. Ganha: o cartão vai para *Contrato* com a Execução preparada (valor adjudicado) e a tarefa de assinatura entra na Seven Agenda. Perdida: cartão arquivado e Watch encerrado.
- **Seven Faturamento → Execução → Seven Financeiro**: a NF da proposta já vem com empenho e endereço do órgão; autorizada, entra na Execução do cartão (ligada ao empenho) e vira conta a receber no Seven Financeiro, com o órgão como contato.
- **Pagamentos nos dois sentidos**: baixa no Seven Financeiro registra o pagamento na Execução, e pagamento lançado na Execução dá baixa no Seven Financeiro.
- **Seven Agenda**: mostra sozinha sessões, prazos do Seven Sessão, cotações, cartões, vencimento de certidões, assinaturas pendentes do Seven Contrato, pagamentos de NF, fim de vigência, contas do Seven Financeiro e atividades do Seven Comercial.
- **Cadastros**: o cliente herda e-mail, telefone e representante do Seven Comercial (usados no Seven Contrato); peças do Seven Recurso usam o cliente da própria licitação e listam as notas em aberto para a cobrança.

## O que ficou de fora, e por quê

- **Enviar proposta, lance, documento ou mensagem ao portal.** Exigiria entrar nos portais com as credenciais
  dos clientes e automatizar sistemas de terceiros. O app prepara tudo e registra o que foi feito; o envio é no portal.
  Por isso o Disputar tem um simulador, e não um robô de lances.
- **IA sem chave.** A Seven IA lê editais e responde perguntas, mas usa a chave da API da Anthropic de quem usa e é
  cobrado na conta dela. A chave fica no navegador; para uso em equipe, o ideal é um servidor que guarde a chave.
- **CAPAG sem importação.** O site do Tesouro não permite consulta direta pelo app; baixe a planilha em
  https://www.tesourotransparente.gov.br/temas/estados-e-municipios/capacidade-de-pagamento-capag e importe em CAPAG.
- **Portais fora do PNCP** (SISLOG-GO, por exemplo) só aparecem se o órgão publicar no PNCP, como a lei exige.
- **Seven Contrato sem servidor.** O signatário abre o link, confere o PDF e devolve um comprovante, que você registra.
  Para que o link funcione no celular de terceiros, a plataforma precisa estar publicada num endereço público.
  Não substitui certificado ICP-Brasil ou gov.br quando o órgão exigir.
- **Dados compartilhados entre a equipe em tempo real.** Plêiade, Reuniões e Ágora já são em tempo real (Firebase).
  Os demais módulos ficam em cada navegador (backup/importação para levar de um a outro); um servidor com login
  resolve isso numa próxima etapa.

## Testes

```sh
npm test        # regras do núcleo: catálogo, documentos, robô, etapa fechada, CSV, preço
npm run e2e     # Chromium de ponta a ponta contra o PNCP real (precisa do Playwright)
node testes/modulos.e2e.cjs   # demais módulos no navegador
node testes/sevenai.e2e.cjs   # Seven IA com o SDK da Anthropic simulado (não gasta créditos)
node testes/pleiade.e2e.cjs; node testes/agora.e2e.cjs; node testes/reuniao.e2e.cjs   # tempo real com Firebase simulado
node testes/avisos.e2e.cjs; node testes/planilha.e2e.cjs; node testes/financas.e2e.cjs; node testes/execucao.e2e.cjs; node testes/premium.e2e.cjs
node testes/tema.e2e.cjs; node testes/nf.e2e.cjs; node testes/contratos.e2e.cjs; node testes/design.e2e.cjs
```
