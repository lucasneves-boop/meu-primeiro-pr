# Contrato — Quadros (clone funcional do Trello)

Referência: Trello (quadros, listas, cartões, Butler, power-ups nativos e visões). O que o clone precisa fazer,
com outra identidade (Seven) e outro código. MUST = obrigatório; SHOULD = desejável; WONT = fica de fora, com motivo.
Cada MUST tem verificação no teste de navegador `testes/quadros.e2e.cjs` ou no teste de unidade `testes/kanban.test.cjs`.

## Área de trabalho
- MUST Página inicial com todos os quadros, favoritos no topo, vistos recentemente, cor de fundo de cada quadro.
- MUST Criar quadro em branco ou a partir de modelo (Licitações, Execução de contratos, Simples) ou copiando outro quadro.
- MUST Fechar quadro, reabrir e excluir de vez (lista de quadros fechados).
- MUST Importar quadro exportado do Trello (JSON) e exportar quadro (JSON e CSV).
- MUST Busca global de cartões em todos os quadros.
- MUST Caixa de entrada para capturar cartões rápidos e depois arrastá-los para uma lista.
- MUST Notificações (menções, atribuições, prazos próximos de cartões seguidos ou atribuídos, automações).

## Quadro
- MUST Renomear no próprio título, favoritar, descrição ("Sobre este quadro"), fundo (cores e gradientes).
- MUST Listas: criar, renomear no título, arrastar para reordenar, cor da lista, recolher/expandir, limite de cartões,
  ordenar (prazo, nome, valor, criação), mover todos os cartões, arquivar todos, copiar lista, mover lista para outro
  quadro, seguir lista, arquivar e restaurar.
- MUST Cartões: adicionar no fim ou no topo da lista, arrastar entre listas e dentro da lista, edição rápida (lápis).
- MUST Filtros: palavra, etiquetas (qualquer/todas, sem etiqueta), membros (meus cartões, sem membro), prazo
  (atrasado, próximo dia, semana, mês, sem data), concluído/pendente, atividade (última semana, 2 e 4 semanas, sem atividade).
- MUST Visões: Quadro, Tabela (colunas ordenáveis), Calendário (mês e semana; arrastar cartão para outro dia),
  Cronograma (barras de início a prazo, agrupadas por lista), Painel (gráficos por lista, membro, etiqueta, prazo).
- MUST Menu: etiquetas, campos personalizados, membros, itens arquivados, atividade do quadro, configurações
  (números dos cartões, envelhecimento dos cartões, capas, votação).
- MUST Automação (estilo Butler): regras com gatilho (entrar na lista, cartão criado, etiqueta adicionada, membro
  adicionado, concluído, checklist completo, prazo se aproximando) e várias ações (mover, etiqueta +/−, membro +/−,
  prazo, concluir/reabrir, arquivar, checklist, comentar, ordenar lista, notificar). Botões do quadro (rodam ações
  em todos os cartões de uma lista) e botões do cartão.
- MUST Atalhos de teclado: ? ajuda, / busca, n novo cartão, q meus cartões, x limpar filtros, f filtros, e sobre o
  cartão: Enter abrir, espaço entrar/sair, c arquivar, 1–9 alternar etiqueta, d datas, m membros.

## Cartão
- MUST Título, número (#), mover pelo seletor de lista, descrição em Markdown (negrito, itálico, riscado, código,
  links, listas, caixas de seleção, citações, títulos) com editar/visualizar.
- MUST Etiquetas, membros (entrar/sair), datas de início e prazo com lembrete e concluído, seguir, votos.
- MUST Checklists: vários, itens com membro e prazo, ocultar marcados, excluir, transformar item em cartão.
- MUST Anexos: arquivos (arrastar e soltar), links, miniatura de imagem, usar imagem como capa.
- MUST Capa: cor ou imagem, tamanho meia ou cheia.
- MUST Campos personalizados (texto, número, moeda, data, caixa, lista).
- MUST Comentários em Markdown com menção, editar, excluir e reações; atividade do cartão.
- MUST Cartões vinculados (ligar a outro cartão, de qualquer quadro).
- MUST Mover, copiar (com opções), modelo de cartão, repetir (diário, semanal, mensal), compartilhar link,
  arquivar, restaurar, excluir.
- MUST Execução do contrato (empenhos, notas, pagamentos) e peça jurídica: recursos da Seven, mantidos.

## WONT
- Colaboração em tempo real entre pessoas e convites por e-mail: os dados ficam no navegador (sem servidor).
- Visão Mapa: precisaria de serviço de mapas com chave de API.
- Integrações de terceiros (Slack, Drive, Jira) e power-ups de mercado.
- Espelhamento de cartões entre quadros (recurso recente do Trello): coberto em parte por cartões vinculados.
