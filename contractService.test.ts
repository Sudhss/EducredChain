// contractService.test.ts
import { ethers } from 'ethers';
import { ContractError, ValidationError } from './src/utils/errors';
import { 
  initContract, 
  getContract, 
  getCurrentAccount, 
  isWalletConnected, 
  onWalletChange,
  mintCredential,
  getCredential,
  revokeCredential,
  getTokensByOwner
} from './src/services/contractService';

// Mock the global window.ethereum object
const mockEthereum = {
  isMetaMask: true,
  request: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn()
};

// Mock the ethers provider and signer
const mockProvider = {
  getSigner: jest.fn()
};

const mockSigner = {
  getAddress: jest.fn()
};

// Mock the contract
const mockContract = {
  mintCredential: jest.fn(),
  getCredential: jest.fn(),
  revokeCredential: jest.fn(),
  balanceOf: jest.fn(),
  tokenOfOwnerByIndex: jest.fn()
};

// Mock the environment variable
const originalEnv = process.env;
process.env.VITE_CONTRACT_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

describe('Contract Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the global state
    global.window = {
      ethereum: mockEthereum
    } as any;
    
    // Mock the provider and signer
    mockProvider.getSigner.mockReturnValue(mockSigner);
    mockSigner.getAddress.mockResolvedValue('0x1234567890abcdef1234567890abcdef12345678');
    
    // Mock the contract methods
    mockContract.mintCredential.mockResolvedValue({ wait: () => Promise.resolve({}) });
    mockContract.getCredential.mockResolvedValue(['title', 'description', 'issuer', 1234567890, 'ipfsHash', false]);
    mockContract.revokeCredential.mockResolvedValue({ wait: () => Promise.resolve({}) });
    mockContract.balanceOf.mockResolvedValue(ethers.BigNumber.from(2));
    mockContract.tokenOfOwnerByIndex
      .mockResolvedValueOnce(ethers.BigNumber.from(1))
      .mockResolvedValue(ethers.BigNumber.from(2));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('initContract', () => {
    it('should initialize the contract with the first account', async () => {
      // Mock the ethereum request
      mockEthereum.request.mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678']);
      
      // Mock the contract constructor
      const originalContract = ethers.Contract;
      (ethers.Contract as any) = jest.fn().mockImplementation(() => mockContract);
      
      const contract = await initContract();
      
      expect(contract).toBeDefined();
      expect(mockEthereum.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
      expect(ethers.providers.Web3Provider).toHaveBeenCalledWith(mockEthereum);
      
      // Reset the mock
      (ethers.Contract as any) = originalContract;
    });

    it('should throw if MetaMask is not installed', async () => {
      delete (global.window as any).ethereum;
      
      await expect(initContract()).rejects.toThrow('MetaMask is not installed');
    });

    it('should throw if no accounts are found', async () => {
      mockEthereum.request.mockResolvedValue([]);
      
      await expect(initContract()).rejects.toThrow('No accounts found');
    });

    it('should handle user rejection', async () => {
      const error = new Error('User rejected request');
      (error as any).code = 4001;
      mockEthereum.request.mockRejectedValue(error);
      
      await expect(initContract()).rejects.toThrow('User denied account access');
    });
  });

  describe('getContract', () => {
    it('should return the contract if initialized', async () => {
      // First initialize the contract
      mockEthereum.request.mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678']);
      await initContract();
      
      const contract = getContract();
      expect(contract).toBeDefined();
    });

    it('should throw if contract is not initialized', () => {
      expect(() => getContract()).toThrow('Contract not initialized');
    });
  });

  describe('Wallet Management', () => {
    it('should get current account', async () => {
      mockEthereum.request.mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678']);
      await initContract();
      
      const account = getCurrentAccount();
      expect(account).toBe('0x1234567890abcdef1234567890abcdef12345678');
    });

    it('should check if wallet is connected', async () => {
      mockEthereum.request.mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678']);
      await initContract();
      
      expect(isWalletConnected()).toBe(true);
    });

    it('should notify listeners on wallet change', async () => {
      const listener = jest.fn();
      onWalletChange(listener);
      
      // Simulate accounts changed
      const accountsChangedCallback = mockEthereum.on.mock.calls.find(
        call => call[0] === 'accountsChanged'
      )?.[1];
      
      if (accountsChangedCallback) {
        await accountsChangedCallback(['0x9876543210fedcba9876543210fedcba98765432']);
        expect(listener).toHaveBeenCalled();
      } else {
        fail('accountsChanged listener not registered');
      }
    });
  });

  describe('Contract Interactions', () => {
    beforeEach(async () => {
      mockEthereum.request.mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678']);
      await initContract();
    });

    it('should mint a credential', async () => {
      const receipt = await mintCredential(
        '0x1234567890abcdef1234567890abcdef12345678',
        'Test Credential',
        'This is a test credential',
        'Test Issuer',
        'QmTestHash'
      );
      
      expect(receipt).toBeDefined();
      expect(mockContract.mintCredential).toHaveBeenCalledWith(
        '0x1234567890abcdef1234567890abcdef12345678',
        'Test Credential',
        'This is a test credential',
        'Test Issuer',
        'QmTestHash'
      );
    });

    it('should get credential details', async () => {
      const credential = await getCredential(1);
      
      expect(credential).toBeDefined();
      expect(mockContract.getCredential).toHaveBeenCalledWith(1);
    });

    it('should revoke a credential', async () => {
      const receipt = await revokeCredential(1, 'Test reason');
      
      expect(receipt).toBeDefined();
      expect(mockContract.revokeCredential).toHaveBeenCalledWith(1, 'Test reason');
    });

    it('should get tokens by owner', async () => {
      const tokens = await getTokensByOwner('0x1234567890abcdef1234567890abcdef12345678');
      
      expect(tokens).toEqual([1, 2]);
      expect(mockContract.balanceOf).toHaveBeenCalledWith('0x1234567890abcdef1234567890abcdef12345678');
    });
  });
});