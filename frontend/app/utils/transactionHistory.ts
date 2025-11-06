import { Transaction } from '../../types/transaction';

class TransactionStore {
  private static STORAGE_KEY = 'cross_chain_transactions';

  static saveTransaction(transaction: Omit<Transaction, 'id' | 'date'>): Transaction {
    const transactions = this.getTransactions();
    const newTransaction: Transaction = {
      ...transaction,
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString()
    };
    
    transactions.unshift(newTransaction);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(transactions));
    return newTransaction;
  }

  static getTransactions(): Transaction[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static updateTransactionStatus(txHash: string, status: 'completed' | 'pending'): void {
    const transactions = this.getTransactions();
    const updatedTransactions = transactions.map(tx => 
      tx.txHash === txHash ? { ...tx, status } : tx
    );
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedTransactions));
  }
}

export default TransactionStore;