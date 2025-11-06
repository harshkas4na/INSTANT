import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, Wallet, ExternalLink } from 'lucide-react';
import TransactionStore from '../utils/transactionHistory';
import { Transaction } from '../../types/transaction';
import { useWeb3 } from '../contexts/Web3Contexts';

interface UserInfo {
  walletAddress: string;
  totalCollateral: number; // This is mock data
  totalLoans: number; // This is mock data
  healthFactor: number; // This is mock data
}

// --- UPDATED CHAIN TYPE ---
type ChainType = 'all' | 'sepolia' | 'base'; // Changed 'Kopli' to 'base'

const AccountTab = () => {
  const [activeChain, setActiveChain] = useState<ChainType>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const {account} = useWeb3();
  const [userInfo, setUserInfo] = useState<UserInfo>({
    walletAddress: account,
    totalCollateral: 2.5, // Mock data
    totalLoans: 1500, // Mock data
    healthFactor: 1.8 // Mock data
  });

  // Update userInfo when account changes
  useEffect(() => {
    if (account) {
      setUserInfo(prev => ({ ...prev, walletAddress: account }));
      // In a real app, you would re-fetch collateral, loans, etc., here
    }
  }, [account]);

  useEffect(() => {
    const loadedTransactions = TransactionStore.getTransactions();
    console.log(loadedTransactions);
    setTransactions(loadedTransactions);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cross_chain_transactions') {
        setTransactions(TransactionStore.getTransactions());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const getTransactionLink = (tx: Transaction): string => {
    if (tx.chain === 'sepolia') {
      return `https://sepolia.etherscan.io/tx/${tx.txHash}`;
    } else {
      // --- UPDATED LINK ---
      return `https://sepolia.basescan.org/tx/${tx.txHash}`; // Changed from kopli.reactscan.net
    }
  };

  const filteredTransactions = activeChain === 'all'
    ? transactions
    : transactions.filter(tx => tx.chain === activeChain);

  const getStatusColor = (status: Transaction['status']): string => {
    return status === 'completed' ? 'text-green-600' : 'text-yellow-600';
  };

  const getHealthFactorColor = (factor: number): string => {
    if (factor >= 1.5) return 'text-green-600';
    if (factor >= 1.2) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatAmount = (amount: number, token: Transaction['token']): string => {
    return `${amount.toLocaleString(undefined, { 
      minimumFractionDigits: token === 'ETH' ? 4 : 2,
      maximumFractionDigits: token === 'ETH' ? 4 : 2
    })} ${token}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTxHash = (hash: string): string => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Account Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800">
              <div className="text-sm text-slate-600 dark:text-slate-400">Wallet Address</div>
              <div className="font-mono mt-1 break-all">{userInfo.walletAddress || '...'}</div>
            </div>
            <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800">
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Collateral (Sepolia)</div>
              <div className="font-semibold mt-1">{formatAmount(userInfo.totalCollateral, 'ETH')}</div>
            </div>
            <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800">
               {/* --- UPDATED TEXT --- */}
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Loans (Base Sepolia)</div>
              <div className="font-semibold mt-1">{formatAmount(userInfo.totalLoans, 'MATIC')}</div>
            </div>
            <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800">
              <div className="text-sm text-slate-600 dark:text-slate-400">Health Factor</div>
              <div className={`font-semibold mt-1 ${getHealthFactorColor(userInfo.healthFactor)}`}>
                {userInfo.healthFactor.toFixed(2)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all" onClick={() => setActiveChain('all')}>
                All Chains
              </TabsTrigger>
              <TabsTrigger value="sepolia" onClick={() => setActiveChain('sepolia')}>
                Sepolia (ETH)
              </TabsTrigger>
              {/* --- UPDATED TAB --- */}
              <TabsTrigger value="base" onClick={() => setActiveChain('base')}>
                Base (MATIC)
              </TabsTrigger>
            </TabsList>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chain</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transaction Hash</TableHead>
                  <TableHead>Links</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">
                        {/* --- UPDATED TEXT --- */}
                        {tx.chain === 'sepolia' ? 'Sepolia' : 'Base'}
                      </TableCell>
                      <TableCell>{tx.type}</TableCell>
                      <TableCell>{formatAmount(tx.amount, tx.token)}</TableCell>
                      <TableCell>{formatDate(tx.date)}</TableCell>
                      <TableCell className={getStatusColor(tx.status)}>
                        {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatTxHash(tx.txHash)}
                      </TableCell>
                      <TableCell>
                        <a
                          href={getTransactionLink(tx)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {/* --- UPDATED TEXT --- */}
                          {tx.chain === 'base' ? 'View on BaseScan' : 'View on Etherscan'}
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountTab;