# Controle Financeiro Doméstico - TODO

## Fase 1: Estrutura de Dados e Schema
- [x] Definir schema do banco de dados (usuários, competências, lançamentos, cartões, faturas)
- [x] Gerar migrations do Drizzle
- [x] Aplicar migrations ao banco de dados

## Fase 2: Integração Google Sheets
- [x] Criar helpers de Google Sheets API (placeholder)
- [x] Implementar estrutura para sincronização de dados
- [ ] Configurar credenciais da Google Sheets API (requer setup do usuário)
- [ ] Testar sincronização bidirecional

## Fase 3: Sistema de Competências e Cartão de Crédito
- [x] Implementar lógica de competências mensais
- [x] Criar sistema de configuração de cartões (data de corte, fechamento)
- [x] Implementar alocação de gastos por competência baseado em data de corte
- [x] Criar helpers para cálculo de faturas

## Fase 4: Interface Principal
- [x] Criar layout com DashboardLayout (sidebar + main content)
- [x] Implementar navegação principal
- [x] Criar dashboard com resumo financeiro
- [x] Adicionar seletor de competência
- [x] Criar página Home com landing page elegante

## Fase 5: Formulários e Gestão
- [x] Criar formulário de lançamento de receitas/despesas
- [x] Implementar formulário de configuração de cartões
- [x] Criar listagem de lançamentos
- [x] Implementar visualização de faturas de cartão

## Fase 6: Relatórios e Gráficos
- [x] Criar página de relatórios
- [x] Implementar gráficos de distribuição por tipo (Pizza)
- [x] Criar gráficos de distribuição por categoria (Barras)
- [x] Adicionar tabela de detalhamento por categoria

## Fase 7: Testes e Refinamento
- [x] Escrever testes unitários (vitest)
- [x] Testar fluxos principais (competencyLogic)
- [x] Refinar UI/UX
- [ ] Validar integração Google Sheets (requer setup do usuário)
- [x] Criar checkpoint final
