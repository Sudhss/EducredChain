import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { initContract, getContract, mintCredential } from '../services/contractService';
import { uploadToIPFS } from '../services/ipfsService';
import { toast } from 'react-hot-toast';

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface Credential {
  id: string;
  title: string;
  description: string;
  issuer: string;
  issueDate: Date;
  ipfsHash: string;
  isRevoked: boolean;
}

interface WalletContextType {
  address: string | null;
  isConnecting: boolean;
  chainId: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToMumbai: () => Promise<void>;
  isMetaMaskInstalled: boolean;
  error: string | null;
  contract: any | null;
  isContractInitialized: boolean;
  contractError: string | null;
  credentials: Credential[];
  isUploading: boolean;
  uploadProgress: number;
  uploadAndMintCredential: (
    file: File, 
    title: string, 
    description: string
  ) => Promise<void>;
  loadCredentials: () => Promise<void>;
  isRefreshing: boolean;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnecting: false,
  chainId: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  switchToMumbai: async () => {},
  isMetaMaskInstalled: false,
  error: null,
  contract: null,
  isContractInitialized: false,
  contractError: null,
  credentials: [],
  isUploading: false,
  uploadProgress: 0,
  uploadAndMintCredential: async () => {},
  loadCredentials: async () => {},
  isRefreshing: false
});

export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: React.ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contract, setContract] = useState<any>(null);
  const [isContractInitialized, setIsContractInitialized] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const isMetaMaskInstalled = typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const initializeContract = async () => {
      if (!address || !isMetaMaskInstalled) return;
      
      try {
        const contractInstance = await initContract();
        setContract(contractInstance);
        setIsContractInitialized(true);
        setContractError(null);
      } catch (err: any) {
        console.error('Error initializing contract:', err);
        setContractError(err.message || 'Failed to initialize contract');
        setIsContractInitialized(false);
      }
    };

    initializeContract();
  }, [address, isMetaMaskInstalled]);

  useEffect(() => {
    const checkConnection = async () => {
      if (!isMetaMaskInstalled) return;
      
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          setChainId(chainId);
        }
      } catch (err) {
        console.error('Error checking connection:', err);
      }
    };

    checkConnection();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      setAddress(null);
    } else if (accounts[0] !== address) {
      setAddress(accounts[0]);
    }
  };

  const handleChainChanged = (newChainId: string) => {
    setChainId(newChainId);
    window.location.reload();
  };

  const connectWallet = async () => {
    if (!isMetaMaskInstalled) {
      setError('Please install MetaMask to connect your wallet');
      return;
    }

    try {
      setError(null);
      setIsConnecting(true);
      
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      setAddress(accounts[0]);
      setChainId(chainId);
      
      if (chainId !== '0x13881') {
        await switchToMumbai();
      }
      
    } catch (err: any) {
      console.error('Error connecting wallet:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const switchToMumbai = async () => {
    if (!isMetaMaskInstalled) return;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13881' }], // Mumbai testnet
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x13881',
                chainName: 'Polygon Mumbai Testnet',
                nativeCurrency: {
                  name: 'MATIC',
                  symbol: 'MATIC',
                  decimals: 18,
                },
                rpcUrls: ['https://rpc-mumbai.maticvigil.com/'],
                blockExplorerUrls: ['https://mumbai.polygonscan.com/'],
              },
            ],
          });
        } catch (addError) {
          console.error('Error adding Mumbai network:', addError);
          throw addError;
        }
      } else {
        console.error('Error switching to Mumbai:', switchError);
        throw switchError;
      }
    }
  };

  const loadCredentials = useCallback(async () => {
    if (!address || !contract) return;
    
    try {
      setIsRefreshing(true);
      const tokenIds = await contract.getTokensByOwner(address);
      const creds = await Promise.all(
        tokenIds.map(async (tokenId: any) => {
          const cred = await contract.getCredential(tokenId);
          return {
            id: tokenId.toString(),
            title: cred.title,
            description: cred.description,
            issuer: cred.issuer,
            issueDate: new Date(cred.issueDate * 1000),
            ipfsHash: cred.ipfsHash,
            isRevoked: cred.isRevoked
          };
        })
      );
      setCredentials(creds);
    } catch (err) {
      console.error('Error loading credentials:', err);
      toast.error('Failed to load credentials');
    } finally {
      setIsRefreshing(false);
    }
  }, [address, contract]);

  const uploadAndMintCredential = useCallback(async (
    file: File, 
    title: string, 
    description: string
  ) => {
    if (!address || !contract) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      const ipfsHash = await uploadToIPFS(file, (progress) => {
        setUploadProgress(Math.round((progress.loaded / progress.total) * 100));
      });
      
      const tx = await mintCredential(contract, address, title, description, 'EduCred Chain', ipfsHash);
      await tx.wait();
      
      await loadCredentials();
      
      toast.success('Credential minted successfully!');
      setUploadProgress(0);
    } catch (error) {
      console.error('Error in uploadAndMintCredential:', error);
      toast.error('Failed to mint credential');
      throw error;
    } finally {
      setIsUploading(false);
      toast.dismiss();
    }
  }, [address, contract, loadCredentials]);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setContract(null);
    setCredentials([]);
    setIsContractInitialized(false);
    setContractError(null);
  }, []);

  useEffect(() => {
    if (address && contract) {
      loadCredentials();
    }
  }, [address, contract, loadCredentials]);

  const contextValue = useMemo(() => ({
    address,
    isConnecting,
    chainId,
    connectWallet,
    disconnectWallet,
    switchToMumbai,
    isMetaMaskInstalled,
    error,
    contract,
    isContractInitialized,
    contractError,
    credentials,
    isUploading,
    uploadProgress,
    uploadAndMintCredential,
    loadCredentials,
    isRefreshing,
  }), [
    address,
    isConnecting,
    chainId,
    connectWallet,
    disconnectWallet,
    switchToMumbai,
    isMetaMaskInstalled,
    error,
    contract,
    isContractInitialized,
    contractError,
    credentials,
    isUploading,
    uploadProgress,
    uploadAndMintCredential,
    loadCredentials,
    isRefreshing,
  ]);

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};