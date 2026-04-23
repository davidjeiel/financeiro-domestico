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

## Fase 8: Tema Escuro Vercel-like
- [x] Implementar tema escuro com paleta Vercel (cinzas, gradientes)
- [x] Atualizar CSS variables para tema escuro
- [x] Aplicar tema em todos os componentes
- [x] Tema escuro OKLCH aplicado globalmente

## Fase 9: Calendário de Datas
- [x] Integrar biblioteca de calendário (react-calendar)
- [x] Criar visualização de datas de vencimento
- [x] Criar visualização de datas de recebimento
- [x] Adicionar filtros por período no calendário

## Fase 10: Sistema de Tipologias Customizáveis
- [x] Criar schema para tipologias de movimentações
- [x] Implementar CRUD de tipologias
- [x] Criar helpers de banco de dados para tipologias
- [x] Implementar procedures tRPC para tipologias
- [ ] Sincronizar tipologias com Google Sheets
- [ ] Permitir uso de tipologias customizadas nos lançamentos

## Fase 11: Configuração Google Sheets e GitHub
- [x] Criar página de configurações com abas
- [x] Interface para Google Sheets (placeholder)
- [x] Interface para GitHub (placeholder)
- [ ] Implementar sincronização com Google Sheets
- [ ] Implementar sincronização com GitHub

## Fase 12: Testes e Refinamento Final
- [x] Testes unitários passando (15 testes)
- [x] TypeScript compilando sem erros
- [ ] Testar fluxos de integração
- [ ] Refinar UI/UX
- [x] Criar checkpoint final


## Fase 13: Integração Real com Google Sheets
- [x] Implementar OAuth com Google Sheets API (GoogleSheetsManager)
- [x] Criar sincronização de tipologias com Google Sheets
- [x] Criar sincronização de transações com Google Sheets
- [x] Adicionar campos de autenticação ao schema
- [x] Criar procedures tRPC para Google Sheets

## Fase 14: Exportação de Dados
- [x] Implementar exportação para XLSX
- [x] Implementar exportação para CSV
- [x] Criar página de exportação
- [x] Adicionar testes de exportação
- [x] Integrar com sidebar de navegação


## Fase 15: Filtros por Data com Salvamento
- [x] Criar schema para salvar filtros
- [x] Implementar UI de filtros por data
- [x] Adicionar funcionalidade de salvar/carregar filtros
- [x] Integrar filtros nas páginas de listagem

## Fase 16: Competência Padrão Customizável
- [x] Adicionar campos de configuração de período ao schema
- [x] Criar UI para configurar período padrão (21 a 20)
- [x] Implementar lógica de cálculo automático de competência
- [x] Testar com diferentes períodos

## Fase 17: Corrigir Integração Google Sheets
- [x] Criar classe GoogleSheetsManager com métodos de sincronização
- [x] Implementar procedures tRPC para Google Sheets
- [ ] Implementar OAuth flow correto (requer configuração de credenciais)
- [ ] Testar sincronização de dados
- [ ] Adicionar tratamento de erros


## Fase 18: Correções Críticas
- [x] Corrigir CSS dos modais para tema escuro
- [x] Corrigir seletores com fundo claro em modais
- [x] Adicionar estilos para inputs em modais
- [x] Criar sistema de débitos/créditos fixos (recurringTransactions)
- [x] Criar sistema de parcelamentos (installments)
- [x] Criar página de Fixos/Parcelados
- [x] Integrar com sidebar de navegação
- [ ] Implementar OAuth real com Google Sheets (requer setup de credenciais)
- [ ] Corrigir sincronização de dados com Google Sheets


## Fase 19: Modais de Erro e Loaders
- [x] Criar componente de modal de erro para Google Sheets (ErrorModal.tsx)
- [x] Implementar loaders/spinners para operações assíncronas (LoadingOverlay.tsx, LoadingCard.tsx)
- [x] Adicionar tratamento de erros detalhado com tipos de erro
- [x] Criar mensagens de erro específicas com soluções sugeridas
- [x] Implementar feedback visual de processamento em Settings e Transactions
- [x] Adicionar toasts de sucesso/erro
- [x] Integrar modais e loaders na página de Configurações


## Fase 20: Melhoria de Interface de Movimentações
- [x] Criar modal para adicionar categorias durante cadastro (AddCategoryModal.tsx)
- [x] Integrar débitos/créditos fixos na interface de movimentações (TransactionsEnhanced.tsx)
- [x] Integrar parcelamentos na interface de movimentações
- [x] Melhorar seleção de conta/cartão
- [x] Permitir seleção de tipo de transação (simples, fixa, parcelada)
- [x] Adicionar validações e feedback visual
- [x] Integrar com LoadingOverlay e toasts


## Fase 21: Correção de Bug de Lançamentos
- [x] Investigar bug no lançamento de transações
- [x] Identificar causa raiz (react-hook-form + validação creditCardId)
- [x] Implementar correção (handleTypeChange, validações, setValue)
- [x] Testar e validar


## Fase 22: Edição e Exclusão de Lançamentos
- [x] Adicionar procedures tRPC para editar transações (transaction.update)
- [x] Adicionar procedures tRPC para deletar transações (transaction.delete)
- [x] Implementar UI de edição de lançamentos (EditTransactionModal.tsx)
- [x] Implementar UI de exclusão com confirmação (DeleteTransactionDialog.tsx)
- [x] Adicionar ícones de ação (editar/deletar) na listagem
- [x] Testar fluxos de edição e exclusão


## Fase 23: Filtros por Período e Totalizador
- [ ] Adicionar filtros por data de início e fim na tela de lançamentos
- [ ] Implementar totalizador de receitas filtradas
- [ ] Implementar totalizador de despesas filtradas
- [ ] Implementar totalizador de cartão de crédito filtrado
- [ ] Exibir totalizadores na interface

## Fase 24: Correção de Bug de Edição
- [ ] Investigar bug de edição de lançamentos
- [ ] Corrigir carregamento de dados do lançamento
- [ ] Corrigir atualização de dados no formulário
- [ ] Testar fluxo de edição

## Fase 25: Permitir até 180 Parcelas
- [ ] Atualizar validação de parcelas (máximo 180)
- [ ] Atualizar UI para aceitar até 180 parcelas
- [ ] Testar criação de parcelamentos com 180 parcelas

## Fase 26: Correções Críticas de Bugs
- [x] Corrigir bug de timezone nas datas (20/04 salvando como 19/04) - Usando Date.UTC
- [x] Remover opção de GitHub das configurações - Removido da aba de configurações
- [x] Corrigir sincronização com Google Sheets para salvar dados realmente - Adicionado procedure syncTransactions
