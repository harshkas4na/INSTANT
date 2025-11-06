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
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">At-Risk Loans (Overdue)</h2>
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
              <span className="font-semibold">{Number(loan.amount).toFixed(4)} MATIC</span>
            </div>
            <div className="flex justify-between">
              <span>Repaid Amount</span>
              <span className="font-semibold">{Number(loan.repaidAmount).toFixed(4)} MATIC</span>
            </div>
            <div className="flex justify-between">
              <span>Total Due</span>
              <span className="font-semibold">{Number(loan.totalDue).toFixed(4)} MATIC</span>
            </div>
            <div className="flex justify-between">
              <span>Status</span>
              <span className="text-red-500 font-semibold">{loan.liquidationPrice}</span>
            </div>
            <Button 
              className="w-full" 
              onClick={() => handleLiquidate(loan.borrower)}
              disabled={loading || processingLoan === loan.borrower}
              variant="destructive"
            >
              {processingLoan === loan.borrower ? "Processing..." : "Liquidate"}
            </Button>
          </div>
        ))
      ) : (
        <div className="text-center text-muted-foreground py-4">
          {loading ? "Loading at-risk loans..." : "No at-risk loans found"}
        </div>
      )}
    </div>
  );
};

export default LiquidationsTab;