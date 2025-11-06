import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { InfoIcon } from 'lucide-react';
import LoanRequestModal from './LoanRequestModal';
import { useWeb3 } from '../contexts/Web3Contexts';
import Web3 from 'web3';
import TransactionStore from '../utils/transactionHistory';
import { Contract, ContractAbi } from 'web3';

// Define a base contract interface
type BaseContract = Contract<ContractAbi>;

interface CollateralStatus {
  isFullyCollateralized: boolean;
  requiredCollateral: string;
}

export default function BorrowTab() {
  const { account, OriginContract, web3, loanDetails, setLoanDetails } = useWeb3();

  // State management
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [loanDuration, setLoanDuration] = useState<string>("30");
  const [estimatedCollateral, setEstimatedCollateral] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [maticPrice, setMaticPrice] = useState<number>(0);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [collateralStatus, setCollateralStatus] = useState<CollateralStatus>({
    isFullyCollateralized: false,
    requiredCollateral: '0'
  });

  // Constants
  const COLLATERALIZATION_RATIO = 150;
  const LIQUIDATION_THRESHOLD = 75;
  const LTV_RATIO = 50;

  // --- UPDATED FUNCTION ---
  // Fetch loan details and check collateral status
  const fetchLoanDetails = async () => {
    if (!OriginContract || !account || !web3) return;

    try {
      const details = await (OriginContract as BaseContract).methods.getLoanDetails(account).call();
      
      // Correctly parse the details based on the contract's return order
      const parsedDetails = {
        collateralAmount: details[0], // uint256
        loanAmount: details[1],       // uint256
        destinationChain: Number(details[2]), // uint256
        interestRate: Number(details[3]), // uint256
        creditScore: Number(details[4]),      // uint256
        duration: Number(details[5]),         // uint256
        active: details[6]                    // bool
      };

      setLoanDetails(parsedDetails);

      // Check if a loan is active and needs collateral
      if (parsedDetails.active && parsedDetails.collateralAmount === '0') {
        const required = await (OriginContract as BaseContract).methods.calculateRequiredCollateral(parsedDetails.loanAmount).call();
        setCollateralStatus({
          isFullyCollateralized: false,
          requiredCollateral: String(required)
        });
        setLoanAmount(Number(web3.utils.fromWei(parsedDetails.loanAmount, 'ether')));
      } else if (parsedDetails.active && parsedDetails.collateralAmount !== '0') {
        setCollateralStatus({
          isFullyCollateralized: true,
          requiredCollateral: '0'
        });
        setLoanAmount(Number(web3.utils.fromWei(parsedDetails.loanAmount, 'ether')));
      } else {
        // No active loan
        setCollateralStatus({
          isFullyCollateralized: false,
          requiredCollateral: '0'
        });
        setLoanAmount(0);
      }
    } catch (error) {
      console.error('Error fetching loan details:', error);
    }
  };

  // Fetch prices
  useEffect(() => {
    const fetchPrices = async () => {
      if (!OriginContract) return;
      
      try {
        const [maticPriceData, ethPriceData] = await Promise.all([
          (OriginContract as BaseContract).methods.getMaticPrice().call(),
          (OriginContract as BaseContract).methods.getEthPrice().call()
        ]);
        setPriceError(null);
        setMaticPrice(Number(maticPriceData) / 10**8); // Assuming 8 decimals for price feed
        setEthPrice(Number(ethPriceData) / 10**8); // Assuming 8 decimals for price feed
      } catch (error) {
        console.log("Error fetching prices",error)
        setPriceError("Error fetching prices");
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [OriginContract]);

  // Fetch loan details on account or contract change
  useEffect(() => {
    fetchLoanDetails();
  }, [account, OriginContract, web3]); // Added web3 dependency

  // Update estimated collateral when loan amount changes
  useEffect(() => {
    const updateEstimatedCollateral = async () => {
      if (!OriginContract || !loanAmount || loanAmount === 0 || !web3) {
        setEstimatedCollateral(0);
        return;
      }
      
      try {
        const loanAmountWei = web3.utils.toWei(loanAmount.toString(), 'ether');
        const required = await (OriginContract as BaseContract).methods.calculateRequiredCollateral(loanAmountWei).call();
        setEstimatedCollateral(Number(required));
      } catch (error) {
        console.error('Error calculating estimated collateral:', error);
      }
    };

    updateEstimatedCollateral();
  }, [loanAmount, OriginContract, web3]); // Added web3 dependency

  const handleDepositCollateral = async () => {
    if (!OriginContract || !account || !web3 || collateralStatus.isFullyCollateralized) return;
  
    setIsProcessing(true);
    try {
      const requiredCollateral = collateralStatus.requiredCollateral;
      const tx = await (OriginContract as BaseContract).methods.depositCollateral().send({
        from: account,
        value: requiredCollateral // Send the exact required amount
      });
  
      TransactionStore.saveTransaction({
        chain: 'sepolia',
        type: 'Deposit Collateral',
        amount: Number(web3.utils.fromWei(requiredCollateral, 'ether')),
        token: 'ETH',
        status: 'completed',
        txHash: tx.transactionHash
      });
  
      setCollateralStatus({ isFullyCollateralized: true, requiredCollateral: '0' });
      await fetchLoanDetails(); // Refresh all details
    } catch (error) {
      console.error('Error depositing collateral:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoanRequest = () => {
    setIsModalOpen(true);
  };

  const canRequestLoan = !isProcessing && loanAmount > 0 && !loanDetails?.active;
  const canDepositCollateral = !isProcessing && loanDetails?.active && !collateralStatus.isFullyCollateralized;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Loan Request</h2>
          <div className="space-y-2">
            <Label htmlFor="loanAmount">MATIC Amount</Label>
            <Input
              id="loanAmount"
              type="number"
              placeholder="0.00"
              value={loanAmount || ''}
              onChange={(e) => setLoanAmount(Number(e.target.value))}
              disabled={loanDetails?.active} // Disable if a loan is active
            />
          </div>
          <div className="text-sm">
            <p>
              Current MATIC/USD: {
                priceError ? 
                <span className="text-red-500">{priceError}</span> : 
                maticPrice ? 
                `$${Number(maticPrice).toFixed(2)}` : 
                "Loading..."
              }
            </p>
            <p>Loan Value: ${(Number(loanAmount) * (Number(maticPrice) || 0)).toFixed(2)}</p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Loan Details</h2>
          <div className="space-y-2">
            <Label>Interest Rate</Label>
            <p className="text-xl">
              {loanDetails?.interestRate 
                ? `${(loanDetails.interestRate / 100).toFixed(2)}%` 
                : "Pending credit assessment"}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Loan Duration</Label>
            <Select 
              value={loanDuration} 
              onValueChange={setLoanDuration}
              disabled={loanDetails?.active} // Disable if a loan is active
            >
              <SelectTrigger id="duration">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Show required collateral if loan is requested but not deposited */}
          {canDepositCollateral && web3 && (
            <div className="space-y-2 text-yellow-500">
              <Label>Required Collateral (ETH)</Label>
              <p className="text-xl font-bold">
                {web3.utils.fromWei(collateralStatus.requiredCollateral, 'ether')} ETH
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Risk Parameters</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Collateralization Ratio</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Required collateral-to-loan ratio ({COLLATERALIZATION_RATIO}%)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Slider defaultValue={[COLLATERALIZATION_RATIO]} max={200} step={1} disabled />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Liquidation Threshold</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Position will be liquidated if collateral value falls below {LIQUIDATION_THRESHOLD}%</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xl">{LIQUIDATION_THRESHOLD}%</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Loan-to-Value (LTV) Ratio</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum borrowing power against collateral ({LTV_RATIO}%)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xl">{LTV_RATIO}%</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Show Request Loan button only if no loan is active */}
        {!loanDetails?.active && (
          <Button 
            className="w-full" 
            size="lg" 
            onClick={handleLoanRequest}
            disabled={!canRequestLoan}
          >
            {isProcessing ? 'Processing...' : 'Request Loan'}
          </Button>
        )}
        
        {/* Show Deposit Collateral button only if loan is active but collateral is not paid */}
        {canDepositCollateral && (
          <Button 
            className="w-full" 
            size="lg" 
            onClick={handleDepositCollateral}
            disabled={isProcessing}
            variant="outline" // Make it visually distinct
          >
            {isProcessing ? 'Processing...' : 'Deposit Collateral'}
          </Button>
        )}
      </div>

      <LoanRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        loanAmount={loanAmount}
        loanDuration={Number(loanDuration)}
        estimatedCollateral={estimatedCollateral}
        isProcessing={isProcessing}
      />
    </div>
  );
}