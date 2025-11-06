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
          amount: Number(amountEther).toFixed(4),
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
        .repayLoan(amountInWei)
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
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Active Loans</h2>
      {activeLoans.length > 0 ? (
        activeLoans.map((loan) => (
          <div key={loan.id} className="bg-card text-card-foreground p-4 rounded-lg shadow space-y-2">
            <div className="flex justify-between">
              <span>Loan Amount</span>
              <span className="font-semibold">{loan.amount} MATIC</span>
            </div>
            <div className="flex justify-between">
              <span>Repaid Amount</span>
              <span className="font-semibold">{loan.repaidAmount} MATIC</span>
            </div>
            <div className="flex justify-between">
              <span>Remaining Due</span>
              <span className="font-semibold">{loan.totalDue} MATIC</span>
            </div>
            <div className="flex justify-between">
              <span>Interest Rate</span>
              <span>{loan.interest}% APR</span>
            </div>
            <div className="flex justify-between">
              <span>Due Date</span>
              <span>{loan.dueDate}</span>
            </div>
            <div className="flex justify-between">
              <span>Status</span>
              <span className={`font-semibold ${getLoanStatusColor(loan.status)}`}>
                {loan.status}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Repayment Progress</span>
                <span>{loan.progress}%</span>
              </div>
              <Progress value={loan.progress} />
            </div>
          </div>
        ))
      ) : (
        <div className="text-center text-muted-foreground py-4">
          No active loans found
        </div>
      )}
      
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Repay Loan</h2>
        <div className="space-y-2">
          <Label htmlFor="repayAmount">MATIC Amount</Label>
          <Input
            id="repayAmount"
            type="number"
            placeholder="0.00"
            value={repayAmount}
            onChange={(e) => setRepayAmount(e.target.value)}
            disabled={loading || activeLoans.length === 0}
          />
        </div>
        <Button 
          className="w-full" 
          onClick={handleRepay}
          disabled={loading || activeLoans.length === 0}
        >
          {loading ? "Processing..." : "Repay"}
        </Button>
      </div>
    </div>
  );
};

export default RepayTab;