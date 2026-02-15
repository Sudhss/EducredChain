import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileUp, Search, Plus, Brain, Share2, ExternalLink } from 'lucide-react';
import { useCredentials, Credential } from '../contexts/CredentialsContext';
import CredentialCard from '../components/credentials/CredentialCard';
import AIInteraction from '../components/ai/AIInteraction';
import { CredentialsGridSkeleton } from '../components/ui/LoadingSkeleton';
import { copyToClipboard } from '../utils/clipboard';

const DashboardPage = () => {
  const { credentials, isLoading } = useCredentials();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);

  const handleCopyCredentialLink = useCallback((credentialId: string) => {
    const url = `${window.location.origin}/verify/${credentialId}`;
    copyToClipboard(url, 'Credential link copied to clipboard!');
  }, []);

  const handleViewOnExplorer = useCallback((txHash: string) => {
    const explorerUrl = `https://mumbai.polygonscan.com/tx/${txHash}`;
    window.open(explorerUrl, '_blank');
  }, []);

  const filteredCredentials = credentials.filter((cred) =>
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

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              Your Credentials
            </h1>
            <p className="text-gray-600">
              Manage and verify your blockchain-secured learning credentials
            </p>
          </div>
          <Link to="/upload" className="btn-primary flex items-center mt-4 md:mt-0">
            <Plus className="w-4 h-4 mr-2" />
            Add New Credential
          </Link>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
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
                    className="p-2 bg-white rounded-full shadow-md"
                  >
                    <Share2 className="w-4 h-4 text-gray-600" />
                  </button>

                  {credential.txHash && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewOnExplorer(credential.txHash);
                      }}
                      className="p-2 bg-white rounded-full shadow-md"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <FileUp className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No credentials found
            </h3>
            <p className="mt-2 text-gray-500">
              {searchTerm
                ? `No credentials matching "${searchTerm}".`
                : "You haven't uploaded any credentials yet."}
            </p>

            {!searchTerm && (
              <div className="mt-6">
                <Link
                  to="/upload"
                  className="inline-flex items-center px-4 py-2 text-white bg-primary-600 rounded-md"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Upload Credential
                </Link>
              </div>
            )}
          </div>
        )}

        {/* AI Promo */}
        <div className="mt-12 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-xl p-8">
          <div className="flex items-center">
            <div className="bg-white rounded-full p-4 shadow-md mr-6">
              <Brain className="h-8 w-8 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                AI-Powered Insights
              </h2>
              <p className="text-gray-600">
                Get personalized learning insights based on your credentials.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* AI Modal */}
      {showAIModal && selectedCredential && (
        <AIInteraction
          credential={selectedCredential}
          isOpen={showAIModal}
          onClose={() => setShowAIModal(false)}
        />
      )}
    </div>
  );
};

export default DashboardPage;