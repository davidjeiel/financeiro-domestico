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
- [x] Corrigir bug de timezone nas datas (20/04 salvando como 19/04) - Usando toLocaleDateString
- [x] Remover opção de GitHub das configurações - Removido da aba de configurações
- [x] Corrigir sincronização com Google Sheets para salvar dados realmente - Adicionado procedure syncTransactions

## Fase 42: Filtros Salvos e Links em Transações
- [x] Implementar seletor de filtros salvos na tela de transações
- [x] Permitir salvar combinações de filtros com nome customizável
- [x] Adicionar funcionalidade de vincular URLs a transações
- [x] Permitir adicionar/editar/deletar links no cadastro e edição
- [x] Exibir links em modal de visualização
- [x] Todos os 67 testes passando

## Fase 43: Organização Avançada de Transações
- [x] Implementar seletor de colunas visíveis na tabela
- [x] Adicionar filtros avançados (categoria, tipo, cartão, descrição)
- [x] Implementar ordenação por coluna (A-Z, Z-A, 1-9, 9-1)
- [x] Adicionar filtro por status de pagamento (Pago/Não Pago)
- [x] Implementar gerenciador de prioridade de filtros
- [x] Persistir preferências no localStorage
- [x] Todos os 67 testes passando

## Fase 44: Interface de Transações Melhorada
- [x] Remover botão "Editar" com texto
- [x] Transformar botão "Deletar" em ícone de lixeira
- [x] Fazer linha clicável para abrir modal de edição
- [x] Adicionar stopPropagation em checkbox e botão deletar
- [x] Todos os 67 testes passando

## Fase 45: Correção de Timezone
- [x] Corrigir problema de datas sendo registradas com dia anterior
- [x] Usar toLocaleDateString em vez de toISOString
- [x] Atualizar TransactionsEnhanced com getLocalDateString
- [x] Atualizar EditTransactionModal com formatDateForInput
- [x] Todos os 67 testes passando

## Fase 46: Tela de Faturas Melhorada
- [x] Criar página InvoicesEnhanced com visualização de transações
- [x] Implementar filtros avançados na tela de faturas
- [x] Adicionar seletor de colunas na tela de faturas
- [x] Implementar ordenação de transações por coluna
- [x] Exibir transações de cada cartão dentro da fatura
- [x] Integrar com App.tsx para usar nova página
- [x] Todos os 67 testes passando


## Fase 27: Seletor de Categorias e Edição em Lote
- [x] Atualizar modal de edição com seletor de categorias (EditTransactionModal.tsx)
- [x] Adicionar opção de criar novas categorias no modal de edição
- [x] Implementar checkbox para seleção em lote de transações (TransactionsEnhanced.tsx)
- [x] Criar UI para edição em lote (categoria, datas, notas) (BulkTransactionActions.tsx)
- [x] Implementar exclusão em lote de transações
- [x] Adicionar confirmação de operações em lote
- [x] Integrar com sidebar de navegação

## Fase 28: Testes de Ações em Lote
- [x] Criar testes para seleção em lote (bulkActions.test.ts)
- [x] Implementar testes de filtros de transações
- [x] Implementar testes de agrupamento por categoria
- [x] Implementar testes de cálculo de totais
- [x] Todos os 25 testes passando (10 novos + 14 competência + 1 logout)

## Fase 29: Correção de Fluxo de Seleção em Lote
- [x] Remover abertura automática do modal ao clicar em transação
- [x] Implementar botões flutuantes (FAB) para ações em lote
- [x] Criar modal de edição em lote com campos vazios (BulkEditModal.tsx)
- [x] Criar modal de exclusão em lote com confirmação (BulkDeleteModal.tsx)
- [x] Corrigir seletor de categorias no modal de edição
- [x] Integrar BulkEditModal e BulkDeleteModal no TransactionsEnhanced
- [x] Remover componentes EditTransactionModal e DeleteTransactionDialog não utilizados
- [x] Todos os 25 testes passando

## Fase 30: Correção Final do Fluxo de Seleção em Lote
- [x] Remover BulkTransactionActions que abria automaticamente ao selecionar
- [x] Recriar BulkEditModal com todos os campos visíveis simultaneamente
- [x] Adicionar checkboxes para ativar/desativar cada campo de edição
- [x] Validação de campos selecionados antes de atualizar
- [x] FAB agora aparece apenas com checkboxes, sem abertura automática de modal
- [x] Modal de edição em lote com interface clara e intuitiva
- [x] Todos os 25 testes passando
- [x] TypeScript compilando sem erros

## Fase 31: Correcao de Erro no Seletor de Categorias
- [x] Corrigir erro "Select.Item must have a value prop that is not an empty string"
- [x] Usar placeholder especial (__placeholder__) em vez de string vazia
- [x] Adicionar validacao para nao enviar placeholder como valor
- [x] Resetar formulario apos sucesso na atualizacao
- [x] Todos os 25 testes passando
- [x] Sem erros de compilacao

## Fase 32: Adicionar Opcoes de Categoria no Modal de Edicao em Lote
- [x] Exibir categorias disponíveis no seletor do BulkEditModal
- [x] Adicionar botao "Criar Nova Categoria" dentro do modal
- [x] Implementar interface para criar categoria inline
- [x] Seletor de cores para nova categoria
- [x] Recarregar lista de categorias apos criacao
- [x] Validacao de nome de categoria
- [x] Todos os 25 testes passando
- [x] TypeScript compilando sem erros

## Fase 33: Correcao de Query de Categorias
- [x] Remover filtro isActive=1 de getTypologiesByUser
- [x] Remover filtro isActive=1 de getTypologiesByUserAndType
- [x] Retornar todas as categorias do usuario
- [x] Categorias agora aparecem no seletor do modal
- [x] Todos os 25 testes passando
- [x] TypeScript compilando sem erros

## Fase 34: Restauracao de Botoes Individuais de Edicao e Exclusao
- [x] Adicionar botao "Editar" em cada linha da tabela
- [x] Adicionar botao "Deletar" em cada linha da tabela
- [x] Botoes abrem modais de edicao/exclusao em lote com apenas 1 registro selecionado
- [x] Usuarios podem editar ou deletar registros individuais sem selecionar em lote
- [x] Botoes com cores apropriadas (azul para editar, vermelho para deletar)
- [x] Todos os 25 testes passando
- [x] TypeScript compilando sem erros

## Fase 35: Correcao Final do Seletor de Categorias
- [x] Adicionar debug logging para categorias
- [x] Melhorar tratamento de loading de categorias
- [x] Adicionar contador de categorias disponíveis
- [x] Adicionar cores das categorias no seletor
- [x] Invalidar cache após criar categoria
- [x] Melhorar validação de categoria selecionada
- [x] Todos os 25 testes passando
- [x] TypeScript compilando sem erros

## Fase 36: Filtro por Tipo e Busca Rapida de Categorias
- [x] Adicionar filtro por tipo de categoria (Receita/Despesa/Cartão/Todas)
- [x] Implementar busca rápida com ícone de lupa
- [x] Filtrar categorias em tempo real conforme digitação
- [x] Exibir tipo de categoria no seletor
- [x] Permitir criar categoria com tipo selecionado
- [x] Contador de categorias encontradas
- [x] Todos os 25 testes passando
- [x] TypeScript compilando sem erros

## Fase 37: Separacao de Modais de Edicao Individual e em Lote
- [x] Criar novo EditTransactionModal para edição de um único registro
- [x] Exibir todos os campos de edição simultaneamente (sem checkboxes)
- [x] Adicionar filtro por tipo de categoria no modal individual
- [x] Implementar busca rápida de categorias no modal individual
- [x] Permitir criar nova categoria dentro do modal individual
- [x] Manter BulkEditModal apenas para edição em lote (com checkboxes)
- [x] Adicionar botões "Editar" e "Deletar" individuais em cada linha
- [x] Integrar EditTransactionModal no TransactionsEnhanced
- [x] Todos os 25 testes passando
- [x] TypeScript compilando sem erros

## Fase 38: Simplificacao de Seletor de Categorias
- [x] Remover filtro por tipo de categoria (Receita/Despesa/Cartão)
- [x] Remover busca rápida complexa com ícone de lupa
- [x] Criar seletor simples que exibe todas as categorias
- [x] Adicionar opção "Criar nova categoria" no final da lista
- [x] Simplificar EditTransactionModal com seletor simples
- [x] Simplificar BulkEditModal com seletor simples
- [x] Testar fluxo completo - 25 testes passando
- [x] TypeScript compilando sem erros
- [x] Servidor rodando normalmente

## Fase 39: Marcar Transacoes como Pagas
- [x] Adicionar campo `isPaid` ao schema de transactions
- [x] Adicionar campo `paidDate` para rastrear quando foi pago
- [x] Criar migration SQL para adicionar colunas
- [x] Criar procedure tRPC `markAsPaid` para marcar como pago
- [x] Atualizar UI com coluna "Pago" na tabela
- [x] Implementar checkbox para marcar/desmarcar como pago
- [x] Integrar mutation com invalidação de cache
- [x] Testar fluxo completo - 25 testes passando
- [x] TypeScript compilando sem erros
- [x] Servidor rodando normalmente

## Fase 40: Totalizadores com Total e Total Pago
- [x] Atualizar cálculo de totais para incluir total pago
- [x] Adicionar totalizadores no dashboard com "Pago" exibido
- [x] Adicionar totalizadores na tela de movimentações com "Pago" exibido
- [x] Exibir breakdown de pago vs não pago em cada card
- [x] Testar fluxo completo - 25 testes passando
- [x] TypeScript compilando sem erros
- [x] Servidor rodando normalmente

## Fase 41: Remocao de Icones do Dashboard
- [x] Remover ícones dos quadros de totalizadores
- [x] Simplificar layout dos cards
- [x] Manter informações de total e total pago
- [x] Testar fluxo completo - 25 testes passando
- [x] TypeScript compilando sem erros

## Fase 47: Próximas Melhorias (Backlog)
- [ ] Adicionar filtro por intervalo de valores
- [ ] Implementar busca global por descrição/categoria
- [ ] Adicionar indicadores visuais de links nas transações
- [ ] Implementar exportação de dados filtrados (CSV/PDF)
- [ ] Adicionar atalhos de teclado para filtros rápidos
- [ ] Migrar preferências para servidor (sincronizar entre dispositivos)
- [ ] Implementar sincronização real com Google Sheets
- [ ] Adicionar notificações de vencimento de faturas

## Fase 48: Correção de Exibição de Faturas e Agrupamento por Vencimento
- [x] Debugar lógica de getInvoiceTransactions na página InvoicesEnhanced
- [x] Corrigir vinculação de transações a faturas por data (closingDate <= txDate <= dueDate)
- [x] Implementar agrupamento de débitos por data de vencimento na tela de Lançamentos
- [x] Adicionar helper getInvoiceDueDate para obter data de vencimento de transação
- [x] Adicionar busca de faturas em TransactionsEnhanced
- [x] Implementar ordenação padrão: cartões agrupados por vencimento, depois outros por data
- [x] Criar 4 novos testes para validar vinculação e agrupamento (invoiceTransactions.test.ts)
- [x] Total de 71 testes passando com sucesso
- [x] TypeScript compilando sem erros
- [x] Servidor rodando normalmente


## Fase 49: Limpeza de Filtros, Execução Automática e Menu de Contas
- [ ] Limpar todos os filtros de teste salvos do banco de dados
- [ ] Implementar execução automática de filtros ao salvar novo filtro
- [ ] Implementar execução automática de filtros ao selecionar filtro salvo
- [ ] Implementar diálogo de seleção múltipla de cartões quando tipo for "Cartão"
- [ ] Criar página/menu de gerenciamento de contas
- [ ] Adicionar campo de saldo em contas
- [ ] Implementar funcionalidade de ajuste de saldo de contas
- [ ] Criar testes para novas funcionalidades
- [ ] Validar todas as mudanças


## Fase 49: Limpeza de Filtros e Novas Funcionalidades

- [x] Adicionar procedure `deleteAll` para limpar todos os filtros salvos
- [x] Modificar SavedFiltersSelector para executar filtros automaticamente ao selecionar
- [x] Modificar SavedFiltersSelector para executar filtros automaticamente ao salvar
- [x] Adicionar botão "Limpar Tudo" para deletar todos os filtros de teste
- [x] Criar componente CreditCardMultiSelect para seleção múltipla de cartões
- [x] Integrar seleção múltipla de cartões no AdvancedFilters quando tipo for "Cartão"
- [x] Criar tabela `accounts` no banco de dados
- [x] Adicionar funções de gerenciamento de contas em server/db.ts
- [x] Criar procedures de contas em server/routers.ts
- [x] Criar página AccountsManagement.tsx com interface completa
- [x] Implementar criar, editar, deletar e ajustar saldo de contas
- [x] Validar todos os testes (71 testes passando)


## Fase 50: Funcionalidades Colaborativas

- [ ] Criar tabelas de workspaces, membros e permissões no banco
- [ ] Implementar procedures de gerenciamento de workspaces
- [ ] Criar interface de convites e gerenciamento de membros
- [ ] Implementar separação de contas (individual/conjunta/compartilhada)
- [ ] Adicionar indicadores visuais de responsável
- [ ] Escrever testes para colaboração
- [ ] Publicar site permanentemente


## Fase 51: Implementação de Workspaces e Compartilhamento

- [ ] Procedures tRPC para workspaces (criar, listar, atualizar, deletar)
- [ ] Procedures tRPC para membros (adicionar, remover, atualizar role)
- [ ] Procedures tRPC para convites (criar, aceitar, rejeitar)
- [ ] Procedures tRPC para contas compartilhadas
- [ ] Interface de gerenciamento de workspaces
- [ ] Diálogo de criação de novo workspace
- [ ] Interface de gerenciamento de membros
- [ ] Sistema de convites por email
- [ ] Interface de compartilhamento de contas
- [ ] Indicadores visuais de responsável
- [ ] Testes para workspaces
- [ ] Publicar site permanentemente


## Fase 52: Procedures tRPC para Workspaces

- [x] Adicionar imports de funções de workspaces em routers.ts
- [x] Criar procedures para workspace.list (listar workspaces do usuário)
- [x] Criar procedures para workspace.getById (obter workspace por ID)
- [x] Criar procedures para workspace.create (criar novo workspace)
- [x] Criar procedures para workspace.update (atualizar workspace)
- [x] Criar procedures para workspace.members.list (listar membros)
- [x] Criar procedures para workspace.members.add (adicionar membro com convite)
- [x] Criar procedures para workspace.members.updateRole (atualizar role)
- [x] Criar procedures para workspace.members.remove (remover membro)
- [x] Criar procedures para workspace.invites.getPending (obter convites pendentes)
- [x] Criar procedures para workspace.invites.accept (aceitar convite)
- [x] Criar procedures para sharedAccount (criar e listar contas compartilhadas)
- [x] Criar procedures para transactionResponsibility (adicionar, listar, remover)
- [x] Criar procedures para auditLog (listar log de auditoria)
- [x] Corrigir funções de banco de dados para retornar objetos criados/atualizados
- [x] Criar testes para procedures de workspaces (16 testes)
- [x] Todos os 93 testes passando
- [x] TypeScript compilando sem erros
- [x] Servidor rodando normalmente

## Fase 53: Interface Frontend para Workspaces

- [x] Criar página WorkspacesPage.tsx com listagem de workspaces
- [x] Implementar modal de criação de novo workspace
- [x] Implementar modal de edição de workspace
- [x] Criar página de gerenciamento de membros (WorkspaceMembersPage.tsx)
- [x] Implementar interface de convite de membros por email
- [ ] Implementar interface de aceitação de convites
- [x] Criar página de compartilhamento de contas (SharedAccountsPage.tsx)
- [x] Implementar indicadores visuais de responsável em transações
- [x] Integrar workspaces na navegação principal
- [x] Testar fluxos de colaboração
- [ ] Publicar site permanentemente
- [x] Todos os 92 testes passando
- [x] TypeScript compilando sem erros
- [x] Servidor rodando normalmente

## Fase 54: Interface de Aceitação de Convites

- [x] Criar página de aceitação de convites (InviteAcceptancePage.tsx)
- [x] Implementar validação de token de convite
- [x] Exibir informações do workspace e convite
- [x] Implementar botão de aceitar/rejeitar convite
- [x] Redirecionar para workspace após aceitar
- [x] Adicionar notificação de sucesso
- [x] Testar fluxo completo de convite
- [x] Todos os testes passando
- [x] TypeScript compilando sem erros
- [x] Servidor rodando normalmente

## Fase 55: Publicação e Deploy

- [x] Criar checkpoint final
- [x] Publicar site permanentemente
- [x] Configurar domínio customizado (opcional)
- [x] Validar todos os fluxos em produção
- [x] Documentar features de colaboração
- [x] Criar guia de uso para usuários
