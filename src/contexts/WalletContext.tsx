import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    ethereum?: any;
  }
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
  const isMetaMaskInstalled = typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;

  // Check if user is already connected
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

    // Set up event listeners
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
      // MetaMask is locked or the user has not connected any accounts
      setAddress(null);
    } else if (accounts[0] !== address) {
      setAddress(accounts[0]);
    }
  };

  const handleChainChanged = (newChainId: string) => {
    setChainId(newChainId);
    // Reload the page to ensure everything is up-to-date
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
      
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      // Get the current chain ID
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      setAddress(accounts[0]);
      setChainId(chainId);
      
      // If not on Mumbai testnet, prompt to switch
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
      // This error code indicates that the chain has not been added to MetaMask
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

  const disconnectWallet = () => {
    setAddress(null);
    setChainId(null);
  };

  return (
    <WalletContext.Provider 
      value={{ 
        address, 
        isConnecting, 
        chainId,
        connectWallet, 
        disconnectWallet,
        switchToMumbai,
        isMetaMaskInstalled,
        error,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};