import { ethers } from 'ethers';
import { AppError, ValidationError, toAppError } from '../utils/errors';

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (request: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

// Contract address from environment variables
const getContractAddress = (): string => {
  const address = import.meta.env.VITE_CONTRACT_ADDRESS?.trim();
  if (!address) {
    throw new ValidationError('Contract address is not configured. Please set VITE_CONTRACT_ADDRESS in your .env file.');
  }
  return address;
};

// Contract ABI for the functions we need
const EDU_CRED_ABI = [
  'function mintCredential(address,string,string,string,string) external',
  'function getCredential(uint256) external view returns (string,string,string,uint256,string,bool)',
  'function revokeCredential(uint256,string) external',
  'function balanceOf(address) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address,uint256) external view returns (uint256)'
];

// Contract instance and provider state
let contract: ethers.Contract | null = null;
let provider: ethers.providers.Web3Provider | null = null;
let signer: ethers.Signer | null = null;
let currentAccount: string | null = null;
let walletChangeListeners: Array<() => void> = [];

// Internal function to clear contract state
const clearContractState = () => {
  contract = null;
  signer = null;
  currentAccount = null;
};

// Notify all listeners about wallet/account changes
const notifyWalletChange = () => {
  walletChangeListeners.forEach(listener => listener());
};

// Custom error class for contract-related errors
export class ContractError extends AppError {
  constructor(message: string, public readonly method?: string, details?: unknown) {
    super(
      `Contract operation failed${method ? ` (${method})` : ''}: ${message}`,
      'CONTRACT_ERROR',
      500,
      details
    );
  }
}


/**
 * Initialize or reinitialize the contract with the current provider and signer
 * @param forceReconnect Force reconnection even if already connected
 * @returns The contract instance
 */
export const initContract = async (forceReconnect = false): Promise<ethers.Contract> => {
  // If already initialized and not forcing reconnect, return existing instance
  if (contract && signer && !forceReconnect) {
    return contract;
  }

  if (typeof window.ethereum === 'undefined') {
    clearContractState();
    throw new ValidationError('MetaMask is not installed. Please install MetaMask to continue.');
  }

  try {
    // Request account access if needed
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) {
      clearContractState();
      throw new ValidationError('No accounts found. Please connect your wallet.');
    }

    const newAccount = accounts[0].toLowerCase();
    
    // If account changed, update the signer and contract
    if (newAccount !== currentAccount || forceReconnect) {
      provider = new ethers.providers.Web3Provider(window.ethereum);
      signer = provider.getSigner();
      currentAccount = newAccount;
      
      contract = new ethers.Contract(
        getContractAddress(),
        EDU_CRED_ABI,
        signer
      );
      
      // Notify about the account change
      notifyWalletChange();
    }
    
    if (!contract) {
      throw new ContractError('Failed to initialize contract', 'initContract');
    }

    return contract;
  } catch (error) {
    clearContractState();
    const appError = toAppError(error, 'Failed to initialize contract');
    
    if ((error as any).code === 4001) {
      // User rejected the request
      throw new ContractError('User denied account access', 'initContract');
    } else if ((error as any).code === -32002) {
      // Request already pending
      throw new ContractError('Request already pending. Please check your wallet.', 'initContract');
    } else if ((error as any).code === -32603) {
      // Internal error
      throw new ContractError('Internal JSON-RPC error', 'initContract', error);
    }
    
    throw new ContractError(appError.message, 'initContract', error);
  }
};

/**
 * Get the current contract instance
 * @returns The contract instance
 * @throws {ContractError} If contract is not initialized
 */
export const getContract = (): ethers.Contract => {
  if (!contract) {
    throw new ContractError('Contract not initialized. Call initContract() first.', 'getContract');
  }
  return contract;
};

/**
 * Get the current signer's address
 * @returns The current account address or null if not connected
 */
export const getCurrentAccount = (): string | null => {
  return currentAccount;
};

/**
 * Check if wallet is connected
 * @returns boolean indicating if wallet is connected
 */
export const isWalletConnected = (): boolean => {
  return !!currentAccount;
};

/**
 * Add a listener for wallet/account changes
 * @param listener Callback function to be called on changes
 * @returns Function to remove the listener
 */
export const onWalletChange = (listener: () => void): (() => void) => {
  walletChangeListeners.push(listener);
  
  // Set up ethereum event listeners if not already done
  if (walletChangeListeners.length === 1) {
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // Wallet disconnected
        clearContractState();
      } else if (accounts[0].toLowerCase() !== currentAccount?.toLowerCase()) {
        // Account changed
        initContract(true).catch(console.error);
      }
      notifyWalletChange();
    };

    const handleChainChanged = () => {
      // Reload the page when network changes
      window.location.reload();
    };

    window.ethereum?.on('accountsChanged', handleAccountsChanged);
    window.ethereum?.on('chainChanged', handleChainChanged);
    
    // Return cleanup function
    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
      walletChangeListeners = walletChangeListeners.filter(l => l !== listener);
    };
  }
  
  // Return cleanup function
  return () => {
    walletChangeListeners = walletChangeListeners.filter(l => l !== listener);
  };
};

// Mint a new credential
export const mintCredential = async (
  to: string,
  title: string,
  description: string,
  issuer: string,
  ipfsHash: string
): Promise<ethers.ContractReceipt> => {
  const contract = getContract();
  try {
    if (!ethers.utils.isAddress(to)) {
      throw new ValidationError('Invalid recipient address');
    }
    
    const tx = await contract.mintCredential(to, title, description, issuer, ipfsHash);
    const receipt = await tx.wait();
    return receipt;
  } catch (error) {
    const appError = toAppError(error, 'Failed to mint credential');
    if (appError.message.includes('user rejected transaction')) {
      throw new ContractError('Transaction was rejected by user', 'mintCredential');
    }
    throw new ContractError(appError.message, 'mintCredential', error);
  }
};

// Get credential details
export const getCredential = async (tokenId: number) => {
  const contract = getContract();
  try {
    const [title, description, issuer, issueDate, ipfsHash, isRevoked] = await contract.getCredential(tokenId);
    
    if (!title || !issuer) {
      throw new ContractError('Credential not found', 'getCredential', { tokenId });
    }
    
    return {
      title,
      description,
      issuer,
      issueDate: new Date(issueDate.toNumber() * 1000),
      ipfsHash,
      isRevoked
    };
  } catch (error) {
    const appError = toAppError(error, 'Failed to get credential');
    if (appError.message.includes('invalid token ID') || appError.message.includes('nonexistent token')) {
      throw new ContractError('Credential not found', 'getCredential', { tokenId });
    }
    throw new ContractError(appError.message, 'getCredential', error);
  }
};

// Revoke a credential
export const revokeCredential = async (tokenId: number, reason: string): Promise<ethers.ContractReceipt> => {
  const contract = getContract();
  try {
    const tx = await contract.revokeCredential(tokenId, reason);
    const receipt = await tx.wait();
    return receipt;
  } catch (error) {
    const appError = toAppError(error, 'Failed to revoke credential');
    if (appError.message.includes('not owner')) {
      throw new ContractError('Only the credential owner can revoke it', 'revokeCredential', { tokenId });
    }
    throw new ContractError(appError.message, 'revokeCredential', error);
  }
};

// Get all tokens owned by an address
export const getTokensByOwner = async (owner: string): Promise<number[]> => {
  const contract = getContract();
  try {
    if (!ethers.utils.isAddress(owner)) {
      throw new ValidationError('Invalid owner address');
    }
    
    const balance = await contract.balanceOf(owner);
    const tokens: number[] = [];
    
    // Process tokens in batches to avoid gas issues with large collections
    const batchSize = 20; // Adjust based on your needs
    const balanceNum = balance.toNumber();
    
    for (let i = 0; i < balanceNum; i += batchSize) {
      const batchEnd = Math.min(i + batchSize, balanceNum);
      const batchPromises = [];
      
      for (let j = i; j < batchEnd; j++) {
        batchPromises.push(contract.tokenOfOwnerByIndex(owner, j));
      }
      
      const batchResults = await Promise.all(batchPromises);
      tokens.push(...batchResults.map(id => id.toNumber()));
    }
    
    return tokens;
  } catch (error) {
    const appError = toAppError(error, 'Failed to get tokens by owner');
    throw new ContractError(appError.message, 'getTokensByOwner', { owner, error });
  }
};
