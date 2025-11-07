import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useWeb3 } from '../contexts/Web3Contexts'
import Web3, { ContractAbi, EventLog } from 'web3' // Import EventLog
import { Contract } from 'web3-eth-contract'
import { DESTINATION_CONTRACT_ADDRESS } from '../config/addressess'

// Define the contract interface with the event
type BaseContract = Contract<ContractAbi>;

// Define event type
interface LoanRequestedEvent extends EventLog {
  returnValues: {
    borrower: string;
    amount: string;
    interestRate: string;
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

// This interface matches the return type of getLoanDetails
interface ContractLoanDetails {
  '0': string;  // amount
  '1': string;  // repaidAmount
  '2': string;  // interestRate
  '3': string;  // dueDate
  '4': string;  // creditScore
  '5': boolean; // active
  '6': boolean; // funded
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

      setLoading(true);
      const contract = DestinationContract as BaseContract;
      
      // --- CORRECTED EVENT HASH AND DECODING ---
      const eventSignature = web3.utils.sha3('LoanRequested(address,uint256,uint256)');

      // 1. Get all past logs for the LoanRequested event
      const events = await (web3 as any).eth.getPastLogs({
        fromBlock: 0,
        toBlock: 'latest',
        address: DESTINATION_CONTRACT_ADDRESS,
        topics: [eventSignature], // The event signature
      });

      // 2. Decode the events
      const decodedEvents = events.map(event => {
        // Indexed params are in topics, non-indexed are in data
        const borrower = web3.eth.abi.decodeParameter('address', event.topics[1]);
        
        const data = web3.eth.abi.decodeLog(
          [
            { type: 'uint256', name: 'amount' },
            { type: 'uint256', name: 'interestRate' }
          ],
          event.data,
          event.topics.slice(1) // Pass topics for indexed params (though we already got borrower)
        );

        return {
          ...event,
          returnValues: {
            borrower: borrower,
            amount: data.amount,
            interestRate: data.interestRate
          }
        } as LoanRequestedEvent;
      });

      // 3. Check status for each loan
      const atRiskLoansData = await Promise.all(
        decodedEvents.map(async (event) => {
          const borrower = event.returnValues.borrower;
          const loanDetails: ContractLoanDetails = await contract.methods.getLoanDetails(borrower).call();
          
          const active = loanDetails['5'];
          const funded = loanDetails['6'];

          // Only check loans that are currently active and funded
          if (active && funded) {
            const totalDue = await contract.methods.calculateTotalDue(borrower).call();
            const repaidAmount = loanDetails['1'];

            // Check if the loan is overdue
            const dueDate = Number(loanDetails['3']);
            const isOverdue = Date.now() > (dueDate * 1000);

            // Liquidation logic: loan is overdue
            if (isOverdue) {
              return {
                id: borrower,
                borrower,
                amount: loanDetails && loanDetails['0'] ? web3.utils.fromWei(loanDetails['0'].toString(), 'ether') : "0",
                repaidAmount: repaidAmount ? web3.utils.fromWei(repaidAmount.toString(), 'ether') : "0",
                totalDue: totalDue ? web3.utils.fromWei(totalDue.toString(), 'ether') : "0",
                liquidationPrice: "Overdue", // Custom logic for "at-risk"
                active: !!active,
                funded: !!funded
              } as Loan;
            }
          }
          return null;
        })
      );

      // 4. Filter out null values
      const isLoan = (loan: Loan | null): loan is Loan => loan !== null;
      setAtRiskLoans(atRiskLoansData.filter(isLoan));
    } catch (error) {
      console.error('Error loading at-risk loans:', error);
      toast({
        title: "Error",
        description: "Failed to load at-risk loans. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
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
      const contract = DestinationContract as BaseContract;
      await contract.methods
        .liquidateLoan(borrower)
        .send({ from: account });

      toast({
        title: "Success",
        description: "Loan has been successfully liquidated",
      });

      loadAtRiskLoans(); // Refresh the list
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
    <div className="space-y-8">
      <h2 className="text-xl font-bold bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent">
        At-Risk Loans (Overdue)
      </h2>
      {atRiskLoans.length > 0 ? (
        <div className="space-y-4">
          {atRiskLoans.map((loan) => (
            <div 
              key={loan.id} 
              className="bg-card/80 backdrop-blur-sm border-2 border-destructive/30 rounded-xl p-6 shadow-lg space-y-4 card-hover relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/10 rounded-full blur-3xl -z-0" />
              <div className="relative z-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Borrower Address</span>
                    <p className="font-mono text-sm font-semibold break-all">
                      {loan.borrower.slice(0, 6)}...{loan.borrower.slice(-4)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Loan Amount</span>
                    <p className="text-lg font-bold">{Number(loan.amount).toFixed(4)} MATIC</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Repaid Amount</span>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {Number(loan.repaidAmount).toFixed(4)} MATIC
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm text-muted-foreground">Total Due</span>
                    <p className="text-lg font-bold text-primary">
                      {Number(loan.totalDue).toFixed(4)} MATIC
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg mb-4">
                  <span className="text-sm font-medium text-muted-foreground">Status</span>
                  <span className="text-lg font-bold text-destructive">{loan.liquidationPrice}</span>
                </div>
                <Button 
                  className="w-full h-12 text-base font-semibold bg-destructive hover:bg-destructive/90 shadow-lg hover:shadow-xl transition-all duration-300" 
                  onClick={() => handleLiquidate(loan.borrower)}
                  disabled={loading || processingLoan === loan.borrower}
                  variant="destructive"
                >
                  {processingLoan === loan.borrower ? "Processing..." : "Liquidate Loan"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card/50 border border-border/50 rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-lg">
            {loading ? "Loading at-risk loans..." : "No at-risk loans found"}
          </p>
        </div>
      )}
    </div>
  );
};

export default LiquidationsTab;