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
    <div className="space-y-8">
      {/* User Info Card */}
      <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
            <Wallet className="w-6 h-6 text-primary" />
            Account Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 card-hover">
              <div className="text-sm text-muted-foreground mb-2 font-medium">Wallet Address</div>
              <div className="font-mono text-sm break-all text-foreground">{userInfo.walletAddress || '...'}</div>
            </div>
            <div className="p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 card-hover">
              <div className="text-sm text-muted-foreground mb-2 font-medium">Total Collateral (Sepolia)</div>
              <div className="font-bold text-lg text-blue-600 dark:text-blue-400">{formatAmount(userInfo.totalCollateral, 'ETH')}</div>
            </div>
            <div className="p-5 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 card-hover">
               {/* --- UPDATED TEXT --- */}
              <div className="text-sm text-muted-foreground mb-2 font-medium">Total Loans (Base Sepolia)</div>
              <div className="font-bold text-lg text-green-600 dark:text-green-400">{formatAmount(userInfo.totalLoans, 'MATIC')}</div>
            </div>
            <div className="p-5 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 card-hover">
              <div className="text-sm text-muted-foreground mb-2 font-medium">Health Factor</div>
              <div className={`font-bold text-lg ${getHealthFactorColor(userInfo.healthFactor)}`}>
                {userInfo.healthFactor.toFixed(2)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History Card */}
      <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
            <Activity className="w-6 h-6 text-primary" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-3 bg-muted/50 p-1 rounded-lg">
              <TabsTrigger 
                value="all" 
                onClick={() => setActiveChain('all')}
                className="data-[state=active]:bg-background data-[state=active]:shadow-md transition-all duration-200"
              >
                All Chains
              </TabsTrigger>
              <TabsTrigger 
                value="sepolia" 
                onClick={() => setActiveChain('sepolia')}
                className="data-[state=active]:bg-background data-[state=active]:shadow-md transition-all duration-200"
              >
                Sepolia (ETH)
              </TabsTrigger>
              {/* --- UPDATED TAB --- */}
              <TabsTrigger 
                value="base" 
                onClick={() => setActiveChain('base')}
                className="data-[state=active]:bg-background data-[state=active]:shadow-md transition-all duration-200"
              >
                Base (MATIC)
              </TabsTrigger>
            </TabsList>

            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Chain</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Amount</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Transaction Hash</TableHead>
                    <TableHead className="font-semibold">Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <TableRow key={tx.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">
                          {/* --- UPDATED TEXT --- */}
                          {tx.chain === 'sepolia' ? 'Sepolia' : 'Base'}
                        </TableCell>
                        <TableCell>
                          <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-sm font-medium">
                            {tx.type}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">{formatAmount(tx.amount, tx.token)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(tx.date)}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-md font-medium ${getStatusColor(tx.status)}`}>
                            {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{formatTxHash(tx.txHash)}</TableCell>
                        <TableCell>
                          <a
                            href={getTransactionLink(tx)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors font-medium"
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
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountTab;