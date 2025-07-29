'use client';

import { useState, useEffect } from 'react';
import { X, Check, AlertTriangle, Chrome, Loader2 } from 'lucide-react';

interface GoogleAdAccount {
  id: string;
  name: string;
  currency_code: string;
  status: string;
  time_zone: string;
  descriptive_name?: string;
}

interface GoogleConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string;
  refreshToken: string;
  onSuccess: () => void;
}

export default function GoogleConnectionModal({
  isOpen,
  onClose,
  accessToken,
  refreshToken,
  onSuccess
}: GoogleConnectionModalProps) {
  const [step, setStep] = useState<'loading' | 'select' | 'connecting' | 'success' | 'error'>('loading');
  const [accounts, setAccounts] = useState<GoogleAdAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen && accessToken) {
      fetchGoogleAccounts();
    }
  }, [isOpen, accessToken]);

  const fetchGoogleAccounts = async () => {
    try {
      setStep('loading');
      setError('');

      const response = await fetch('/api/integrations/google/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken })
      });

      const data = await response.json();

      if (data.success) {
        setAccounts(data.data.accounts);
        setStep('select');
      } else {
        setError(data.error || 'Erro ao buscar contas do Google Ads');
        setStep('error');
      }
    } catch (error) {
      console.error('Error fetching Google accounts:', error);
      setError('Erro de conexão ao buscar contas');
      setStep('error');
    }
  };

  const handleConnect = async () => {
    // Se tem múltiplas contas, verificar se selecionou uma
    if (accounts.length > 1 && !selectedAccount) {
      setError('Selecione uma conta para conectar');
      return;
    }

    // Se só tem uma conta, selecionar automaticamente
    const accountToConnect = accounts.length === 1 ? accounts[0].id : selectedAccount;

    try {
      setStep('connecting');
      setError('');

      const response = await fetch('/api/integrations/google/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          refreshToken,
          customerId: accountToConnect
        })
      });

      const data = await response.json();

      if (data.success) {
        setStep('success');
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else {
        setError(data.error || 'Erro ao conectar conta do Google Ads');
        setStep('error');
      }
    } catch (error) {
      console.error('Error connecting Google account:', error);
      setError('Erro de conexão');
      setStep('error');
    }
  };

  const handleRetry = () => {
    setError('');
    setSelectedAccount('');
    fetchGoogleAccounts();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="bg-red-500 p-2 rounded-lg">
              <Chrome className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              Conectar Google Ads
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {step === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-red-500" />
              <p className="mt-2 text-sm text-gray-500">
                Buscando suas contas do Google Ads...
              </p>
            </div>
          )}

          {step === 'select' && (
            <>
              <p className="text-sm text-gray-600">
                Selecione a conta do Google Ads que deseja conectar:
              </p>
              
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {accounts.map((account) => (
                  <label
                    key={account.id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedAccount === account.id
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="googleAccount"
                      value={account.id}
                      checked={selectedAccount === account.id}
                      onChange={(e) => setSelectedAccount(e.target.value)}
                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                    />
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {account.name || account.descriptive_name || `Customer ${account.id}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        ID: {account.id} • {account.currency_code} • {account.status}
                      </p>
                      {account.time_zone && (
                        <p className="text-xs text-gray-400">
                          Fuso: {account.time_zone}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConnect}
                  disabled={accounts.length > 1 && !selectedAccount}
                  className={`flex-1 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white ${
                    (accounts.length === 1 || selectedAccount)
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  Conectar
                </button>
              </div>
            </>
          )}

          {step === 'connecting' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-red-500" />
              <p className="mt-2 text-sm text-gray-500">
                Conectando conta do Google Ads...
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <p className="mt-2 text-sm text-gray-900 font-medium">
                Conta conectada com sucesso!
              </p>
              <p className="text-xs text-gray-500">
                Redirecionando...
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <p className="mt-2 text-sm text-gray-900 font-medium">
                Erro na conexão
              </p>
              <p className="text-xs text-gray-500 mb-4">
                {error}
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Fechar
                </button>
                <button
                  onClick={handleRetry}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
                >
                  Tentar Novamente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
