import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useWeb3 } from '../contexts/Web3Contexts'
import TransactionStore from '../utils/transactionHistory'
import { Transaction } from '../../types/transaction'
import Web3 from 'web3'

interface LoanDetails {
  id: number;
  amount: string;
  repaidAmount: string;
  totalDue: string;
  interest: number;
  dueDate: string;
  progress: number;
  status: 'Active' | 'Overdue' | 'Completed';
}

interface ContractLoanDetails {
  0: string;  // amount
  1: string;  // repaidAmount
  2: string;  // interestRate
  3: string;  // dueDate
  4: string;  // creditScore
  5: boolean; // active
  6: boolean; // funded
}

interface TransactionError extends Error {
  transactionHash?: string;
}

const RepayTab = () => {
  const [repayAmount, setRepayAmount] = useState('')
  const [activeLoans, setActiveLoans] = useState<LoanDetails[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { DestinationContract, account, web3 } = useWeb3()

  const loadLoanDetails = async () => {
    try {
      if (!account || !DestinationContract || !web3) {
        console.log('Missing requirements:', { account, hasContract: !!DestinationContract });
        return;
      }
  
      const loanDetails = await DestinationContract.methods.getLoanDetails(account).call();
      console.log('Raw loan details:', loanDetails);
  
      // Validate loan details existence
      if (!loanDetails) {
        console.log('No loan details returned');
        setActiveLoans([]);
        return;
      }
  
      // Extract values using array indices
      const amount = loanDetails['0'] || '0';
      const repaidAmount = loanDetails['1'] || '0';
      const interestRate = loanDetails['2'] || '0';
      const dueDate = loanDetails['3'] || '0';
      const creditScore = loanDetails['4'] || '0';
      const active = loanDetails['5'] || false;
      const funded = loanDetails['6'] || false;
  
      console.log('Parsed values:', {
        amount,
        repaidAmount,
        interestRate,
        dueDate,
        creditScore,
        active,
        funded
      });
  
      if (active && funded) {
        // Get total due amount
        const totalDue = await DestinationContract.methods.calculateTotalDue(account).call();
        console.log('Total due:', totalDue);
  
        // Convert Wei to Ether for display
        const amountEther = web3.utils.fromWei(Number(amount).toString(), 'ether');
        const repaidAmountEther = web3.utils.fromWei(Number(repaidAmount).toString(), 'ether');
        const totalDueEther = web3.utils.fromWei(Number(totalDue).toString(), 'ether');
        
        // Calculate progress
        const progress = Number(amount) === 0 ? 0 : 
          (Number(repaidAmount) * 100 / Number(amount));
  
        // Convert timestamp to date
        const dueDateTimestamp = Number(dueDate) * 1000;
        const isOverdue = Date.now() > dueDateTimestamp;
  
        const loanData: LoanDetails = {
          id: 1,
          amount: (Number(amountEther)*10**18).toFixed(4),
          repaidAmount: Number(repaidAmountEther).toFixed(4),
          totalDue: Number(totalDueEther).toFixed(4),
          interest: Number(interestRate) / 100,
          dueDate: new Date(dueDateTimestamp).toLocaleDateString(),
          progress: Math.min(Math.round(progress), 100),
          status: isOverdue ? 'Overdue' : 'Active'
        };
  
        console.log('Processed loan data:', loanData);
        setActiveLoans([loanData]);
      } else {
        console.log('No active loans found');
        setActiveLoans([]);
      }
    } catch (error) {
      console.error('Error loading loan details:', error);
      toast({
        title: "Error",
        description: "Failed to load loan details. Please try again.",
        variant: "destructive"
      });
      setActiveLoans([]);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (account && DestinationContract && mounted) {
        await loadLoanDetails();
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [account, DestinationContract]);

  const handleRepay = async () => {
    if (!repayAmount || Number(repayAmount) <= 0 || !web3) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid repayment amount",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const amountInWei = web3.utils.toWei(repayAmount, 'ether');
      console.log('Repaying amount in wei:', amountInWei);

      if (!DestinationContract || !account) {
        throw new Error('Contract or account not initialized');
      }

      const tx = await DestinationContract.methods
        .repayLoan(Number(amountInWei)/10**18)
        .send({ from: account });
      
      console.log('Repayment transaction:', tx);

      
      // --- UPDATED CHAIN ---
      TransactionStore.saveTransaction({
        chain: 'base', // Changed from 'Kopli'
        type: 'Repay',
        amount: Number(repayAmount),
        token: 'MATIC',
        status: 'completed',
        txHash: tx.transactionHash
      });

      toast({
        title: "Success",
        description: `Successfully repaid ${repayAmount} MATIC`,
      });

      setRepayAmount('');
      await loadLoanDetails();
    } catch (error) {
      console.error('Error repaying loan:', error);

      // Handle transaction error
      const txError = error as TransactionError;
      if (txError.transactionHash) {
        
        // --- UPDATED CHAIN ---
        TransactionStore.saveTransaction({
          chain: 'base', // Changed from 'Kopli'
          type: 'Repay',
          amount: Number(repayAmount),
          token: 'MATIC',
          status: 'pending',
          txHash: txError.transactionHash
        });
      }

      toast({
        title: "Error",
        description: txError.message || "Failed to repay loan. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getLoanStatusColor = (status: LoanDetails['status']): string => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'text-green-500';
      case 'overdue':
        return 'text-red-500';
      case 'completed':
        return 'text-blue-500';
      default:
        return 'text-slate-500';
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
          Active Loans
        </h2>
        {activeLoans.length > 0 ? (
          <div className="space-y-4">
            {activeLoans.map((loan) => (
              <div 
                key={loan.id} 
                className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-lg space-y-4 card-hover"
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Loan Amount</span>
                    <p className="text-lg font-bold text-foreground">{loan.amount} MATIC</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Repaid Amount</span>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{loan.repaidAmount} MATIC</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Remaining Due</span>
                    <p className="text-lg font-bold text-primary">{loan.totalDue} MATIC</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Interest Rate</span>
                    <p className="text-lg font-semibold">{loan.interest}% APR</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Due Date</span>
                    <p className="text-lg font-semibold">{loan.dueDate}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <p className={`text-lg font-bold ${getLoanStatusColor(loan.status)}`}>
                      {loan.status}
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-border/50 space-y-2">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Repayment Progress</span>
                    <span className="font-semibold">{loan.progress}%</span>
                  </div>
                  <Progress value={loan.progress} className="h-3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card/50 border border-border/50 rounded-xl p-12 text-center">
            <p className="text-muted-foreground text-lg">No active loans found</p>
          </div>
        )}
      </div>
      
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-lg space-y-4">
        <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
          Repay Loan
        </h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repayAmount" className="text-sm font-medium text-muted-foreground">
              MATIC Amount
            </Label>
            <Input
              id="repayAmount"
              type="number"
              placeholder="0.00"
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
              disabled={loading || activeLoans.length === 0}
              className="h-12 text-lg border-2 focus:border-primary transition-colors"
            />
          </div>
          <Button 
            className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300" 
            onClick={handleRepay}
            disabled={loading || activeLoans.length === 0}
          >
            {loading ? "Processing..." : "Repay"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RepayTab;