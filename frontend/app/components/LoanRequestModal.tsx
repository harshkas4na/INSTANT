import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useWeb3 } from "../contexts/Web3Contexts"
import { useToast } from "@/hooks/use-toast"
import Web3 from 'web3';
import TransactionStore from '../utils/transactionHistory';

interface LoanRequestModalProps {
  isOpen: boolean
  onClose: () => void
  loanAmount: number
  loanDuration: number
  estimatedCollateral: string
  isProcessing: boolean
}

export default function LoanRequestModal({
  isOpen,
  onClose,
  loanAmount,
  loanDuration,
  estimatedCollateral,
  isProcessing
}: LoanRequestModalProps) {
  const { account, OriginContract } = useWeb3();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formattedCollateral = useMemo(() => {
    if (!estimatedCollateral) {
      return '0.0000';
    }

    try {
      const collateralEth = Web3.utils.fromWei(estimatedCollateral.toString(), 'ether');
      const parsedCollateral = parseFloat(collateralEth);
      if (Number.isNaN(parsedCollateral)) {
        return '0.0000';
      }
      return parsedCollateral.toFixed(4);
    } catch (error) {
      console.error('Error formatting collateral:', error);
      return '0.0000';
    }
  }, [estimatedCollateral]);


  const handleConfirm = async () => {
    if (!OriginContract || !account) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }
  
    setIsSubmitting(true);
    try {
      const web3 = new Web3(window.ethereum);
      const loanAmountWei = web3.utils.toWei(loanAmount.toString(), 'ether');
    
      // --- CHANGED HERE ---
      // Updated hardcoded KOPLI chain ID (5318008) to Base Sepolia (84532)
      const tx = await OriginContract.methods
        .requestLoan(loanAmountWei, 84532, Number(loanDuration))
        .send({ from: account });
    
      // Use the centralized transaction store
      TransactionStore.saveTransaction({
        chain: 'sepolia',
        type: 'Borrow',
        amount: loanAmount,
        token: 'MATIC', // This is still correct, as you're requesting MATIC
        status: 'completed',
        txHash: tx.transactionHash
      });
    
      toast({
        title: "Success",
        description: "Loan request submitted successfully!",
      });
      onClose();
    } catch (error) {
      console.error('Error in loan confirmation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit loan request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Loan Request</DialogTitle>
          <DialogDescription>
            Please review the details of your loan request before confirming.
            This will require a wallet transaction to process.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span>Requested Loan Amount:</span>
            <span className="font-semibold">{loanAmount} MATIC</span>
          </div>
          <div className="flex justify-between">
            <span>Required Collateral:</span>
            <span className="font-semibold">{formattedCollateral} ETH</span>
          </div>
          <div className="flex justify-between">
            <span>Loan Duration:</span>
            <span className="font-semibold">{loanDuration} days</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Note: You will need to approve the transaction in your wallet to proceed.
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isSubmitting || isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isSubmitting || isProcessing}
          >
            {isSubmitting || isProcessing ? "Processing..." : "Confirm Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}