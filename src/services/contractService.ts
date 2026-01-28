import { ethers } from 'ethers';
import { AppError, ValidationError, NetworkError, toAppError } from '../utils/errors';

// Contract address (replace with your deployed contract address)
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';

if (!CONTRACT_ADDRESS) {
  throw new ValidationError('Contract address is not configured. Please set VITE_CONTRACT_ADDRESS in your .env file.');
}

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

// Initialize contract instance
let contract: ethers.Contract | null = null;
let provider: ethers.providers.Web3Provider | null = null;
let signer: ethers.Signer | null = null;

// Minimal ABI for the functions we need
const EDU_CRED_ABI = [
  'function mintCredential(address,string,string,string,string) external',
  'function getCredential(uint256) external view returns (string,string,string,uint256,string,bool)',
  'function revokeCredential(uint256,string) external',
  'function balanceOf(address) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address,uint256) external view returns (uint256)'
];

// Initialize the contract with provider and signer
export const initContract = async (): Promise<ethers.Contract> => {
  if (typeof window.ethereum === 'undefined') {
    throw new ValidationError('MetaMask is not installed. Please install MetaMask to continue.');
  }

  provider = new ethers.providers.Web3Provider(window.ethereum);
  signer = provider.getSigner();
  contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    EDU_CRED_ABI,
    signer
  );

  return contract;
};

// Get contract instance
export const getContract = (): ethers.Contract => {
  if (!contract) {
    throw new Error('Contract not initialized. Call initContract() first.');
  }
  return contract;
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
