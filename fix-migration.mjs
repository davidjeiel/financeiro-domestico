import mysql from 'mysql2/promise';

async function runMigration() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    console.log('Executando migration para adicionar colunas isPaid e paidDate...');
    
    // Verificar se a coluna já existe
    const [columns] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'transactions' AND COLUMN_NAME = 'isPaid'"
    );
    
    if (columns.length === 0) {
      console.log('Adicionando coluna isPaid...');
      await connection.query('ALTER TABLE `transactions` ADD `isPaid` int DEFAULT 0 NOT NULL');
      console.log('✓ Coluna isPaid adicionada');
    } else {
      console.log('✓ Coluna isPaid já existe');
    }
    
    // Verificar se a coluna paidDate já existe
    const [columns2] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'transactions' AND COLUMN_NAME = 'paidDate'"
    );
    
    if (columns2.length === 0) {
      console.log('Adicionando coluna paidDate...');
      await connection.query('ALTER TABLE `transactions` ADD `paidDate` timestamp');
      console.log('✓ Coluna paidDate adicionada');
    } else {
      console.log('✓ Coluna paidDate já existe');
    }
    
    console.log('\n✓ Migration concluída com sucesso!');
  } catch (error) {
    console.error('Erro ao executar migration:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
