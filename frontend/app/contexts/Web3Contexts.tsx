"use client";

import { createContext, useContext, useState, ReactNode } from 'react';
import Web3 from 'web3';
import { Contract, ContractAbi } from 'web3';

interface LoanDetails {
  active: boolean;
  loanAmount: string;
  collateralAmount: string;
  interestRate: number;
  destinationChain: number;
  duration: number;
  paidCollateral: string;
}

// Define a base contract interface that extends the Contract type
type BaseContract = Contract<ContractAbi>;

interface Web3ContextType {
  account: string;
  web3: Web3 | null;
  OriginContract: BaseContract | null;
  DestinationContract: BaseContract | null;
  loanDetails: LoanDetails | null;
  setLoanDetails: (loanDetails: LoanDetails | null) => void;
  setDestinationContract: (contract: BaseContract | null) => void;
  MaticContract: BaseContract | null;
  setMaticContract: (contract: BaseContract | null) => void;
  setWeb3: (web3: Web3 | null) => void;
  setOriginContract: (contract: BaseContract | null) => void;
  setAccount: (account: string) => void;
}

// Create the context with a default value matching the type
const Web3Context = createContext<Web3ContextType | undefined>(undefined);

interface Web3ProviderProps {
  children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  const [account, setAccount] = useState<string>('');
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [OriginContract, setOriginContract] = useState<BaseContract | null>(null);
  const [DestinationContract, setDestinationContract] = useState<BaseContract | null>(null);
  const [MaticContract, setMaticContract] = useState<BaseContract | null>(null);
  const [loanDetails, setLoanDetails] = useState<LoanDetails | null>(null);

  const value: Web3ContextType = {
    account,
    web3,
    OriginContract,
    DestinationContract,
    MaticContract,
    loanDetails,
    setLoanDetails,
    setDestinationContract,
    setMaticContract,
    setOriginContract,
    setWeb3,
    setAccount,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

// Custom hook to use the Web3 context
export function useWeb3() {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}