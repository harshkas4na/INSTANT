"use client";
import { useState, useEffect } from 'react';
import Web3 from 'web3';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Moon, Sun } from "lucide-react";
import BorrowTab from './components/BorrowTab';
import RepayTab from './components/RepayTab';
import LiquidationsTab from './components/LiquidationsTab';
import AccountTab from './components/AccountTab';
import { useWeb3 } from './contexts/Web3Contexts';

import { 
  DESTINATION_CONTRACT_ADDRESS, 
  MATIC_CONTRACT_ADDRESS,
  ORIGIN_CONTRACT_ADDRESS 
} from './config/addressess';
import MATIC_ABI from './config/abi/Matic_Contract_ABI.json';
import DESTINATION_ABI from './config/abi/DestinationContract_ABI.json';
import ORIGIN_ABI from './config/abi/OriginContract_ABI.json';
import Logo from './logo';

interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
}

interface Balances {
  eth: string;
  matic: string;
}

interface SupportedNetworks {
  [key: string]: NetworkConfig;
}

// Updated SUPPORTED_NETWORKS
const SUPPORTED_NETWORKS: SupportedNetworks = {
  SEPOLIA: {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/cJIehF2H1TGkdVlz9iaSf'
  },
  BASE_SEPOLIA: { // Changed from KOPLI
    chainId: 84532, // Updated Chain ID
    name: 'Base Sepolia', // Updated Name
    rpcUrl: 'https://sepolia.base.org' // Updated RPC URL
  }
};

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });
  
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [chainId, setChainId] = useState<number>(11155111);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [maticBalance, setMaticBalance] = useState<string>('0.00');
  const [balances, setBalances] = useState<Balances>({
    eth: '0.00',
    matic: '0.00'
  });

  const {
    account, 
    setAccount,
    web3, 
    setWeb3,
    MaticContract,
    setMaticContract,
    setDestinationContract,
    setOriginContract
  } = useWeb3();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const getCurrentNetworkKey = (currentChainId: number): string => {
    return Object.keys(SUPPORTED_NETWORKS).find(
      key => SUPPORTED_NETWORKS[key].chainId === currentChainId
    ) || '';
  };

  const initializeContracts = async (web3Instance: Web3, currentChainId: number): Promise<void> => {
    setMaticContract(null);
    setDestinationContract(null);
    setOriginContract(null);

    // Updated to BASE_SEPOLIA
    if (currentChainId === SUPPORTED_NETWORKS.BASE_SEPOLIA.chainId) {
      try {
        const maticContract = new web3Instance.eth.Contract(MATIC_ABI, MATIC_CONTRACT_ADDRESS);
        const destinationContract = new web3Instance.eth.Contract(DESTINATION_ABI, DESTINATION_CONTRACT_ADDRESS);
        
        setMaticContract(maticContract);
        setDestinationContract(destinationContract);
        console.log("Initialized Base Sepolia contracts:", { maticContract, destinationContract });
      } catch (error) {
        console.error("Error initializing Base Sepolia contracts:", error);
      }
    } else if (currentChainId === SUPPORTED_NETWORKS.SEPOLIA.chainId) {
      try {
        const originContract = new web3Instance.eth.Contract(ORIGIN_ABI, ORIGIN_CONTRACT_ADDRESS);
        setOriginContract(originContract);
        console.log("Initialized Sepolia contract:", originContract);
      } catch (error) {
        console.error("Error initializing Sepolia contract:", error);
      }
    }
  };

  const updateBalances = async (address: string, web3Instance: Web3, currentChainId: number): Promise<void> => {
    if (!address || !web3Instance) return;

    try {
      const balance = await web3Instance.eth.getBalance(address);
      const formattedBalance = web3Instance.utils.fromWei(balance, 'ether');
      
      setBalances(prev => ({
        ...prev,
        eth: Number(formattedBalance).toFixed(4)
      }));

      // Updated to BASE_SEPOLIA
      if (currentChainId === SUPPORTED_NETWORKS.BASE_SEPOLIA.chainId && MaticContract) {
        try {
          const maticBalance:Number = await MaticContract.methods.balanceOf(address).call();
          const formattedMaticBalance = web3Instance.utils.fromWei(maticBalance.toString(), 'ether');
          setMaticBalance(Number(formattedMaticBalance).toFixed(4));
          console.log('Updated MATIC balance:', formattedMaticBalance);
        } catch (error) {
          console.error('Error fetching MATIC balance:', error);
          setMaticBalance('0.00');
        }
      } else {
        setMaticBalance('0.00');
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  useEffect(() => {
    if (account && web3 && chainId) {
      updateBalances(account, web3, chainId);
    }
  }, [account, chainId, MaticContract, web3]);

  const connectWallet = async (): Promise<void> => {
    if (!window.ethereum) {
      setError('Please install MetaMask!');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const web3Instance = new Web3(window.ethereum);
        const chainId = Number(await web3Instance.eth.getChainId());
        setChainId(chainId);
        setSelectedNetwork(getCurrentNetworkKey(chainId));
        
        await initializeContracts(web3Instance, chainId);
        await updateBalances(accounts[0], web3Instance, chainId);
      }
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const switchNetwork = async (networkName: string): Promise<void> => {
    try {
      setIsLoading(true);
      const network = SUPPORTED_NETWORKS[networkName.toUpperCase()];
      if (!network) throw new Error('Unsupported network');

      const chainIdHex = `0x${network.chainId.toString(16)}`;
      
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chainIdHex,
              chainName: network.name,
              rpcUrls: [network.rpcUrl],
            }],
          });
        } else {
          throw switchError;
        }
      }

      setSelectedNetwork(networkName);
      const web3Instance = new Web3(window.ethereum);
      setWeb3(web3Instance);
      
      const currentChainId = await web3Instance.eth.getChainId();
      setChainId(Number(currentChainId));
      
      await initializeContracts(web3Instance, Number(currentChainId));
      
      if (account) {
        await updateBalances(account, web3Instance, Number(currentChainId));
      }
    } catch (error) {
      console.error('Error switching network:', error);
      setError('Failed to switch network');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      connectWallet();
      const web3Instance = new Web3(window.ethereum);
      setWeb3(web3Instance);

      web3Instance.eth.getChainId().then(async (currentChainId) => {
        setChainId(Number(currentChainId));
        const networkKey = getCurrentNetworkKey(Number(currentChainId));
        setSelectedNetwork(networkKey);
        await initializeContracts(web3Instance, Number(currentChainId));
      });

      web3Instance.eth.getAccounts().then(async (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          const currentChainId = await web3Instance.eth.getChainId();
          await updateBalances(accounts[0], web3Instance, Number(currentChainId));
        }
      });

      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          const currentChainId = await web3Instance.eth.getChainId();
          await updateBalances(accounts[0], web3Instance, Number(currentChainId));
        } else {
          setAccount('');
          setBalances({ eth: '0.00', matic: '0.00' });
          setMaticBalance('0.00');
        }
      };

      const handleChainChanged = async (newChainId: string) => {
        const chainIdDecimal = parseInt(newChainId, 16);
        setChainId(chainIdDecimal);
        const networkKey = getCurrentNetworkKey(chainIdDecimal);
        setSelectedNetwork(networkKey);
        await initializeContracts(web3Instance, chainIdDecimal);
        if (account) {
          await updateBalances(account, web3Instance, chainIdDecimal);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  const formatAddress = (address: string): string => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const getNetworkName = (): string => {
    const currentNetwork = getCurrentNetworkKey(chainId);
    return currentNetwork ? SUPPORTED_NETWORKS[currentNetwork].name : "Unknown Network";
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-background text-foreground relative overflow-hidden">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/50 dark:from-indigo-950/20 dark:via-slate-950 dark:to-purple-950/20 pointer-events-none" />
        
        <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50 relative">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4 group">
              <div className="transition-transform duration-300 group-hover:scale-110">
                <Logo className="h-16 w-16" />
              </div>
              <h1 className="text-3xl font-bold gradient-text">INSTANT</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Select 
                value={selectedNetwork} 
                onValueChange={(value) => switchNetwork(value)}
              >
                <SelectTrigger className="w-[180px] border-2 transition-all hover:border-primary/50">
                  <SelectValue placeholder={getNetworkName()} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEPOLIA">Ethereum Sepolia</SelectItem>
                  {/* Updated to Base Sepolia */}
                  <SelectItem value="BASE_SEPOLIA">Base Sepolia</SelectItem> 
                </SelectContent>
              </Select>
              <Button 
                onClick={connectWallet}
                disabled={isLoading}
                variant={error ? "destructive" : "default"}
                className="transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  "Connecting..."
                ) : error ? (
                  "Error Connecting"
                ) : account ? (
                  formatAddress(account)
                ) : (
                  "Connect Wallet"
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleDarkMode}
                className="transition-all duration-300 hover:scale-110 hover:bg-accent rounded-full"
              >
                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 relative z-10">
          {/* Balance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-card text-card-foreground p-6 rounded-xl shadow-lg border border-border/50 card-hover relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <h2 className="font-semibold mb-2 text-muted-foreground text-sm uppercase tracking-wide">
                  {/* Updated Text */}
                  {chainId === 11155111 ? 'ETH (Sepolia)' : 'ETH (Base Sepolia)'} Balance
                </h2>
                <p className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                  {balances.eth} ETH
                </p>
              </div>
            </div>
            {/* Updated to BASE_SEPOLIA */}
            {chainId === SUPPORTED_NETWORKS.BASE_SEPOLIA.chainId && (
              <div className="bg-card text-card-foreground p-6 rounded-xl shadow-lg border border-border/50 card-hover relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10">
                  <h2 className="font-semibold mb-2 text-muted-foreground text-sm uppercase tracking-wide">MATIC Balance</h2>
                  <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
                    {Number(maticBalance)+13} MATIC
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tabs Section */}
          <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 shadow-xl p-6">
            <Tabs defaultValue="borrow" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-lg">
                <TabsTrigger 
                  value="borrow" 
                  className="data-[state=active]:bg-background data-[state=active]:shadow-md transition-all duration-200"
                >
                  Borrow
                </TabsTrigger>
                <TabsTrigger 
                  value="repay"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-md transition-all duration-200"
                >
                  Repay
                </TabsTrigger>
                <TabsTrigger 
                  value="liquidations"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-md transition-all duration-200"
                >
                  Liquidations
                </TabsTrigger>
                <TabsTrigger 
                  value="account"
                  className="data-[state=active]:bg-background data-[state=active]:shadow-md transition-all duration-200"
                >
                  Account
                </TabsTrigger>
              </TabsList>
              <TabsContent value="borrow" className="mt-6">
                <BorrowTab />
              </TabsContent>
              <TabsContent value="repay" className="mt-6">
                <RepayTab />
              </TabsContent>
              <TabsContent value="liquidations" className="mt-6">
                <LiquidationsTab />
              </TabsContent>
              <TabsContent value="account" className="mt-6">
                <AccountTab />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}