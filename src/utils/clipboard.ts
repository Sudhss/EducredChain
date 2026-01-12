import { toast } from 'react-hot-toast';

export const copyToClipboard = async (text: string, successMessage = 'Copied to clipboard!') => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    toast.error('Failed to copy to clipboard');
    return false;
  }
};

export const formatAddress = (address: string, start = 6, end = 4) => {
  if (!address) return '';
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};
