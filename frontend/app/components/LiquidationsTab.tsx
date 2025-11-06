import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useWeb3 } from '../contexts/Web3Contexts'
import Web3, { ContractAbi } from 'web3'
import { Contract, EventLog } from 'web3-eth-contract'
import { DESTINATION_CONTRACT_ADDRESS } from '../config/addressess'

// Define the contract interface with the event
interface DestinationContractInterface {
  events: {
    LoanRequested: (options: {
      filter?: Record<string, any>;
      fromBlock?: number | string;
      toBlock?: number | string;
      topics?: string[];
    }) => void;
  };
  methods: {
    getLoanDetails(borrower: string): {
      call(): Promise<LoanDetails>;
    };
    calculateTotalDue(borrower: string): {
      call(): Promise<string>;
    };
    liquidateLoan(borrower: string): {
      send(options: { from: string }): Promise<void>;
    };
  };
}

// Define event type
interface LoanRequestedEvent extends EventLog {
  returnValues: {
    borrower: string;
  }
}

interface Loan {
  id: string;
  borrower: string;
  amount: string;
  repaidAmount: string;
  totalDue: string;
  liquidationPrice: string;
  active: boolean;
  funded: boolean;
}

interface LoanDetails {
  0: string;  // amount
  1: string;  // repaidAmount
  2: string;  // interestRate
  3: string;  // dueDate
  4: string;  // creditScore
  5: boolean; // active
  6: boolean; // funded
  amount: string;
  repaidAmount: string;
  interestRate: string;
  dueDate: string;
  creditScore: string;
  active: boolean;
  funded: boolean;
}

const LiquidationsTab = () => {
  const [atRiskLoans, setAtRiskLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [processingLoan, setProcessingLoan] = useState<string | null>(null)
  const { toast } = useToast()
  const { DestinationContract, account, web3 } = useWeb3()

  const loadAtRiskLoans = async () => {
    try {
      if (!account || !DestinationContract || !web3) return

      // Cast contract to proper interface
      const contract = DestinationContract as unknown as DestinationContractInterface;
      
      // Get past events with proper typing
      const events = await (web3 as any).eth.getPastLogs({
        fromBlock: 0,
        toBlock: 'latest',
        address: DESTINATION_CONTRACT_ADDRESS,
        topics: [web3.utils.sha3('LoanRequested(address)')],
      });

      // Decode the events
      const decodedEvents = events.map(event => {
        const decoded = web3.eth.abi.decodeLog(
          [{ type: 'address', name: 'borrower', indexed: true }],
          event.data,
          event.topics.slice(1)
        );
        return {
          ...event,
          returnValues: { borrower: decoded.borrower }
        } as LoanRequestedEvent;
      });

      const atRiskLoansData = await Promise.all(
        decodedEvents.map(async (event) => {
          const borrower = event.returnValues.borrower;
          const loanDetails: LoanDetails = await contract.methods.getLoanDetails(borrower).call();
          const totalDue = await contract.methods.calculateTotalDue(borrower).call();
          
          // Calculate liquidation threshold (75% from contract)
          const liquidationValue = (Number(totalDue) * 75) / 100;
          
          // Only return a loan object if it meets the at-risk criteria
          if (loanDetails.active && loanDetails.funded && Number(loanDetails.repaidAmount) < liquidationValue) {
            return {
              id: borrower,
              borrower,
              amount: web3.utils.fromWei(loanDetails.amount, 'ether'),
              repaidAmount: web3.utils.fromWei(loanDetails.repaidAmount, 'ether'),
              totalDue: web3.utils.fromWei(totalDue, 'ether'),
              liquidationPrice: web3.utils.fromWei(liquidationValue.toString(), 'ether'),
              active: loanDetails.active,
              funded: loanDetails.funded
            } as Loan;
          }
          return null;
        })
      );

      // Filter out null values
      const isLoan = (loan: Loan | null): loan is Loan => loan !== null;
      setAtRiskLoans(atRiskLoansData.filter(isLoan));
    } catch (error) {
      console.error('Error loading at-risk loans:', error);
      toast({
        title: "Error",
        description: "Failed to load at-risk loans. Please try again.",
        variant: "destructive"
      });
    }
  }

  useEffect(() => {
    if (account && DestinationContract) {
      loadAtRiskLoans();
    }
  }, [account, DestinationContract]);

  const handleLiquidate = async (borrower: string) => {
    if (!account || !DestinationContract) return;

    setProcessingLoan(borrower);
    setLoading(true);

    try {
      const contract = DestinationContract as unknown as DestinationContractInterface;
      await contract.methods
        .liquidateLoan(borrower)
        .send({ from: account });

      toast({
        title: "Success",
        description: "Loan has been successfully liquidated",
      });

      loadAtRiskLoans();
    } catch (error: any) {
      console.error('Error liquidating loan:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to liquidate loan. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessingLoan(null);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">At-Risk Loans</h2>
      {atRiskLoans.length > 0 ? (
        atRiskLoans.map((loan) => (
          <div key={loan.id} className="bg-card text-card-foreground p-4 rounded-lg shadow space-y-2">
            <div className="flex justify-between">
              <span>Borrower Address</span>
              <span className="font-mono text-sm">
                {loan.borrower.slice(0, 6)}...{loan.borrower.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Loan Amount</span>
              <span className="font-semibold">{loan.amount} MATIC</span>
            </div>
            <div className="flex justify-between">
              <span>Repaid Amount</span>
              <span className="font-semibold">{loan.repaidAmount} MATIC</span>
            </div>
            <div className="flex justify-between">
              <span>Total Due</span>
              <span className="font-semibold">{loan.totalDue} MATIC</span>
            </div>
            <div className="flex justify-between">
              <span>Liquidation Threshold</span>
              <span className="text-red-500 font-semibold">{loan.liquidationPrice} MATIC</span>
            </div>
            <Button 
              className="w-full" 
              onClick={() => handleLiquidate(loan.borrower)}
              disabled={loading || processingLoan === loan.borrower}
            >
              {processingLoan === loan.borrower ? "Processing..." : "Liquidate"}
            </Button>
          </div>
        ))
      ) : (
        <div className="text-center text-muted-foreground py-4">
          No at-risk loans found
        </div>
      )}
    </div>
  );
};

export default LiquidationsTab;