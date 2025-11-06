// types/transaction.ts
export interface Transaction {
    id: string;
    chain: 'sepolia' | 'Kopli';
    type: 'Deposit Collateral' | 'Borrow' | 'Repay' | 'Release Collateral';
    amount: number;
    token: 'ETH' | 'MATIC';
    date: string;
    status: 'completed' | 'pending';
    txHash: string;
  }