# Seven Licita

Software da Seven para operar o departamento de licitações dos clientes, do edital ao pagamento.
Espelha a rotina da Effecti (Encontrar → Cadastrar → Disputar → Monitorar + Análise de Mercado),
completa com o que o Siga Pregão tem e a Effecti não (funil de negócios, peças jurídicas, pagômetro,
painel do dia, concorrentes) e traz um módulo de quadros no estilo Trello. Nome, marca e código são próprios.

## Como abrir

Não precisa instalar nada. Abra `index.html` no Chrome (dois cliques) ou publique a pasta em qualquer
hospedagem estática. Os dados de licitação vêm da API pública do PNCP, direto do navegador.

Os dados da Seven (clientes, propostas, quadros, documentos) ficam **no navegador** em que foram criados.
Use **Configurações → Exportar backup** com frequência e importe em outro computador para continuar de lá.

## Módulos

| Módulo | O que faz | Referência |
|---|---|---|
| Painel | Avisos novos, propostas em preparo, disputas sem limite aprovado, prazos do pregoeiro, documentos vencendo, pendências do quadro, licitações publicadas hoje por faixa de valor | Effecti + Siga |
| Encontrar | Catálogo de produtos (O que vendo / Qual tipo / O que não vendo) com prévia; perfis de busca por cliente, estados, modalidades e esferas; captura no PNCP (manual, diária ou semanal às segundas 10h); Meus Avisos com favorito, órgão favorito, lido, lixeira, anotações da equipe, itens, anexos, ME/EPP, SRP, CAPAG; Banco de Licitações para pesquisa livre | Effecti |
| Cadastrar | Proposta a partir do aviso ou do link do PNCP; itens carregados do PNCP com referência unitária; marca, modelo, custo e preço sugerido (custo ÷ (1 − impostos − margem)); alerta de valor acima da referência; planilha CSV (exportar/importar); declarações; anexos; registro do envio; impressão; proposta atualizada pós-lances com redistribuição; Meus Documentos com validade e aviso de 7 dias; Meus Produtos | Effecti |
| Disputar | Valor limite e lance fechado por item, aprovação do cliente, estratégias (melhor posição, lance do limite, só 1º, posição alvo, Top 3, excluir colocado, distância do 1º, cobrir próprio lance), redução e intervalo mínimo, checklist da sessão e **simulador** para ensaiar a estratégia | Effecti |
| Monitorar | Licitações acompanhadas por situação, mensagens do pregoeiro (colar do chat), palavras-chave em cores, prazos com detecção automática ("prazo de 2 horas", "até dd/mm/aaaa"), recursos e contrarrazões com prazo de 3 dias úteis | Effecti + Siga |
| Quadros | Quadros, listas e cartões com arrastar e soltar; etiquetas, membros, início, prazo e lembrete; checklists com itens atribuídos (@nome) e com prazo (!dd/mm); comentários com menção; anexos; capa; campos personalizados (texto, número, moeda, data, caixa, lista); modelos de cartão; mover e copiar entre quadros; arquivar e restaurar; limite de cartões por lista; filtros; visões quadro, tabela, calendário e painel; automações "quando entrar na lista X, então…"; exportação CSV; atividade. O quadro padrão "Licitações" vai de Oportunidade a Pagamento, com checklist de cada etapa e **Execução** do contrato (empenhos, notas fiscais, pagamentos, saldo) | Trello + Siga (Meus Negócios) |
| Peças Jurídicas | Modelos de esclarecimento, impugnação, recurso, contrarrazões, reequilíbrio e cobrança de pagamento, preenchidos com os dados do cliente e da licitação; editar, copiar, baixar .doc, imprimir | Siga |
| Análise de Mercado | Por termo, período, estados, modalidades e esferas: valor homologado e estimado, sazonalidade, estados, órgãos, fornecedores vencedores com concentração Top 3/Top 5, preço por item homologado (mín., médio, mediana, máx., amostras), desconto médio sobre a referência; CSV, PDF e análises salvas | Effecti |
| Concorrentes | Histórico dos fornecedores vencedores nas análises salvas | Siga |
| Pagômetro | Atraso médio real de pagamento por órgão, calculado com as notas e pagamentos registrados na Execução dos cartões, mais a nota CAPAG do município | Siga |
| Clientes (CNPJs) | Vários clientes na mesma conta; o cliente ativo filtra propostas, documentos, disputas e monitoramento | Effecti + Siga |

## O que ficou de fora, e por quê

- **Enviar proposta, lance, documento ou mensagem ao portal.** Exigiria entrar nos portais com as credenciais
  dos clientes e automatizar sistemas de terceiros. O app prepara tudo e registra o que foi feito; o envio é no portal.
  Por isso o Disputar tem um simulador, e não um robô de lances.
- **Leitura do edital por IA (Aimê / "Ler edital").** Precisa de uma chave de API de IA e de um servidor. Pode ser
  o próximo passo.
- **CAPAG automática.** O Tesouro não oferece consulta aberta que o navegador consiga usar; a nota é registrada à mão.
- **Portais fora do PNCP** (SISLOG-GO, por exemplo) só aparecem se o órgão publicar no PNCP, como a lei exige.
- **Dados compartilhados entre a equipe em tempo real.** Hoje cada navegador tem os seus dados (backup/importação
  para levar de um a outro). Um servidor com login resolve isso numa próxima etapa.

## Testes

```sh
npm test        # regras do núcleo: catálogo, documentos, robô, etapa fechada, CSV, preço
npm run e2e     # Chromium de ponta a ponta contra o PNCP real (precisa do Playwright)
```
