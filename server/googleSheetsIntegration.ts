import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

/**
 * Classe para gerenciar integração com Google Sheets
 */
export class GoogleSheetsManager {
  private sheets: any;
  private auth: OAuth2Client;

  constructor(accessToken: string) {
    this.auth = new OAuth2Client();
    this.auth.setCredentials({ access_token: accessToken });
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * Cria uma nova planilha
   */
  async createSpreadsheet(title: string): Promise<string> {
    try {
      const drive = google.drive({ version: 'v3', auth: this.auth });
      
      const spreadsheet = await this.sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title,
          },
        },
      });

      const spreadsheetId = spreadsheet.data.spreadsheetId;
      
      // Compartilhar com o usuário
      if (spreadsheetId) {
        await drive.files.update({
          fileId: spreadsheetId,
          requestBody: {
            shared: true,
          },
        });
      }

      return spreadsheetId || '';
    } catch (error) {
      console.error('Erro ao criar planilha:', error);
      throw error;
    }
  }

  /**
   * Obtém dados de uma planilha
   */
  async getSheetData(spreadsheetId: string, range: string): Promise<any[][]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      return response.data.values || [];
    } catch (error) {
      console.error('Erro ao obter dados da planilha:', error);
      throw error;
    }
  }

  /**
   * Escreve dados em uma planilha
   */
  async writeSheetData(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
      });
    } catch (error) {
      console.error('Erro ao escrever dados na planilha:', error);
      throw error;
    }
  }

  /**
   * Cria abas na planilha
   */
  async createSheets(spreadsheetId: string, sheetNames: string[]): Promise<void> {
    try {
      const requests = sheetNames.map((title, index) => ({
        addSheet: {
          properties: {
            title,
            index: index + 1,
          },
        },
      }));

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests,
        },
      });
    } catch (error) {
      console.error('Erro ao criar abas:', error);
      throw error;
    }
  }

  /**
   * Sincroniza tipologias para a planilha
   */
  async syncTypologies(
    spreadsheetId: string,
    typologies: Array<{
      id: number;
      name: string;
      type: string;
      description?: string;
      icon?: string;
      color?: string;
    }>
  ): Promise<void> {
    try {
      const headers = ['ID', 'Nome', 'Tipo', 'Descrição', 'Ícone', 'Cor'];
      const data = [
        headers,
        ...typologies.map(t => [
          t.id,
          t.name,
          t.type,
          t.description || '',
          t.icon || '',
          t.color || '',
        ]),
      ];

      await this.writeSheetData(spreadsheetId, 'Tipologias!A1', data);
    } catch (error) {
      console.error('Erro ao sincronizar tipologias:', error);
      throw error;
    }
  }

  /**
   * Sincroniza transações para a planilha
   */
  async syncTransactions(
    spreadsheetId: string,
    transactions: Array<{
      id: number;
      transactionDate: Date;
      description?: string;
      category: string;
      type: string;
      amount: number;
      notes?: string;
    }>
  ): Promise<void> {
    try {
      const headers = ['ID', 'Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Notas'];
      const data = [
        headers,
        ...transactions.map(t => [
          t.id,
          new Date(t.transactionDate).toLocaleDateString('pt-BR'),
          t.description || '',
          t.category,
          t.type,
          t.amount,
          t.notes || '',
        ]),
      ];

      await this.writeSheetData(spreadsheetId, 'Transações!A1', data);
    } catch (error) {
      console.error('Erro ao sincronizar transações:', error);
      throw error;
    }
  }

  /**
   * Lê tipologias da planilha
   */
  async readTypologies(spreadsheetId: string): Promise<any[]> {
    try {
      const data = await this.getSheetData(spreadsheetId, 'Tipologias!A2:F');
      
      return data.map(row => ({
        id: parseInt(row[0]),
        name: row[1],
        type: row[2],
        description: row[3],
        icon: row[4],
        color: row[5],
      }));
    } catch (error) {
      console.error('Erro ao ler tipologias:', error);
      return [];
    }
  }

  /**
   * Lê transações da planilha
   */
  async readTransactions(spreadsheetId: string): Promise<any[]> {
    try {
      const data = await this.getSheetData(spreadsheetId, 'Transações!A2:G');
      
      return data.map(row => ({
        id: parseInt(row[0]),
        transactionDate: new Date(row[1]),
        description: row[2],
        category: row[3],
        type: row[4],
        amount: parseFloat(row[5]),
        notes: row[6],
      }));
    } catch (error) {
      console.error('Erro ao ler transações:', error);
      return [];
    }
  }
}

/**
 * Valida se um token de acesso é válido
 */
export async function validateAccessToken(accessToken: string): Promise<boolean> {
  try {
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Tenta fazer uma requisição simples para validar
    await sheets.spreadsheets.get({
      spreadsheetId: 'test',
    }).catch(() => {
      // Erro esperado, mas o token foi validado
    });

    return true;
  } catch (error: any) {
    // Se o erro for de autenticação, o token é inválido
    if (error.message?.includes('Invalid Credentials')) {
      return false;
    }
    // Qualquer outro erro significa que o token é válido
    return true;
  }
}
