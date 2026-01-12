import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileUp, Search, Plus, Brain, Sparkles, Copy, Share2, ExternalLink } from 'lucide-react';
import { useCredentials, Credential } from '../contexts/CredentialsContext';
import CredentialCard from '../components/credentials/CredentialCard';
import AIInteraction from '../components/ai/AIInteraction';
import { CredentialsGridSkeleton } from '../components/ui/LoadingSkeleton';
import { copyToClipboard, formatAddress } from '../utils/clipboard';
import { toast } from 'react-hot-toast';

const DashboardPage = () => {
  const { credentials, isLoading } = useCredentials();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const navigate = useNavigate();

  const handleCopyCredentialLink = useCallback((credentialId: string) => {
    const url = `${window.location.origin}/verify/${credentialId}`;
    copyToClipboard(url, 'Credential link copied to clipboard!');
  }, []);

  const handleViewOnExplorer = useCallback((txHash: string) => {
    const explorerUrl = `https://mumbai.polygonscan.com/tx/${txHash}`;
    window.open(explorerUrl, '_blank');
  }, []);

  // Filter credentials based on search term
  const filteredCredentials = credentials.filter(cred => 
    cred.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    cred.issuer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCredentialSelect = (credential: Credential) => {
    setSelectedCredential(credential);
    setShowAIModal(true);
  };

  return (
    <div className="py-8 bg-gray-50 min-h-screen">
      <div className="container-custom">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Your Credentials</h1>
            <p className="text-gray-600">
              Manage and verify your blockchain-secured learning credentials
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link to="/upload" className="btn-primary flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              Add New Credential
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              placeholder="Search credentials by name or issuer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Credentials Grid */}
        {isLoading ? (
          <CredentialsGridSkeleton count={3} />
        ) : filteredCredentials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCredentials.map((credential) => (
              <div key={credential.id} className="relative group">
                <CredentialCard 
                  credential={credential}
                  onSelect={handleCredentialSelect}
                />
                <div className="absolute top-3 right-3 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyCredentialLink(credential.id);
                    }}
                    className="p-2 bg-white dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    title="Copy shareable link"
                  >
                    <Share2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                  {credential.txHash && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewOnExplorer(credential.txHash);
                      }}
                      className="p-2 bg-white dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      title="View on explorer"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <FileUp className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">No credentials found</h3>
            <p className="mt-1 text-gray-500 dark:text-gray-400">Get started by uploading your first credential.</p>
            <div className="mt-6">
              <Link
                to="/upload"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                Upload Credential
            <p className="text-gray-600 mb-6">
              {searchTerm ? 
                `No credentials matching "${searchTerm}". Try a different search term.` : 
                "You haven't uploaded any credentials yet. Get started by adding your first credential."}
            </p>
            {!searchTerm && (
              <Link to="/upload" className="btn-primary inline-flex items-center">
                <Plus className="w-4 h-4 mr-2" />
                Add New Credential
              </Link>
            )}
          </div>
        )}

        {/* AI Features Promo */}
        <div className="mt-12 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center">
            <div className="mb-6 md:mb-0 md:mr-8">
              <div className="bg-white rounded-full p-4 shadow-md inline-flex">
                <Brain className="h-8 w-8 text-primary-600" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">AI-Powered Insights</h2>
              <p className="text-gray-600 max-w-xl">
                Get personalized learning insights and recommendations based on your credentials.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  {/* AI Interaction Modal */}
  {showAIModal && selectedCredential && (
    <AIInteraction 
      credential={selectedCredential} 
      isOpen={showAIModal} 
      onClose={() => setShowAIModal(false)} 
    />
  )}
};

export default DashboardPage;