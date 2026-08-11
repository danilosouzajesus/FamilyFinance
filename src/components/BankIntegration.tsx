import React, { useState } from 'react';
import { 
  Building2, 
  Upload, 
  RefreshCw, 
  Sparkles, 
  Check, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sliders, 
  FileText, 
  CheckCircle2,
  Plug,
  HelpCircle,
  X
} from 'lucide-react';
import { Category, Account, Transaction } from '../types';

interface BankIntegrationProps {
  categories: Category[];
  accounts: Account[];
  onImportTransactions: (importedTxs: any[]) => void;
}

// Simulated imported OFX transactions representing Pix, Credit, Debit, and Transfer
const MOCK_OFX_TXS = [
  { id: 'ofx_1', description: 'PIX RECEBIDO - JOAO SILVA', type: 'income', amount: 350.00, suggestedCategory: 'Outras Receitas', subcategory: 'Presentes', paymentMethod: 'PIX' },
  { id: 'ofx_2', description: 'IFOOD *RESTAURANTE', type: 'expense', amount: 84.50, suggestedCategory: 'Alimentação', subcategory: 'Delivery', paymentMethod: 'Cartão de Crédito' },
  { id: 'ofx_3', description: 'POSTO IPIRANGA COMBUSTIVEL', type: 'expense', amount: 150.00, suggestedCategory: 'Transporte', subcategory: 'Combustível', paymentMethod: 'Débito' },
  { id: 'ofx_4', description: 'TRANSFERENCIA RECEBIDA ITAU', type: 'income', amount: 1200.00, suggestedCategory: 'Salário', subcategory: 'Bônus', paymentMethod: 'Transferência' }
];

const BANKS = [
  { id: 'itau', name: 'Banco Itaú', logo: '🍊', color: 'border-orange-500' },
  { id: 'nubank', name: 'Nubank', logo: '💜', color: 'border-purple-600' },
  { id: 'bradesco', name: 'Bradesco', logo: '❤️', color: 'border-red-600' },
  { id: 'santander', name: 'Santander', logo: '🔴', color: 'border-red-500' },
  { id: 'bb', name: 'Banco do Brasil', logo: '💛', color: 'border-yellow-400' }
];

export default function BankIntegration({
  categories,
  accounts,
  onImportTransactions
}: BankIntegrationProps) {
  const [activeSubTab, setActiveSubTab] = useState<'pluggy' | 'ofx' | 'concil'>('pluggy');
  
  // Pluggy Link bank state
  const [connectedBanks, setConnectedBanks] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  // OFX uploading states
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Conciliation panel state (stores the OFX/Pluggy simulated pending transactions)
  const [pendingTxs, setPendingTxs] = useState<any[]>([]);
  const [reconciledCount, setReconciledCount] = useState(0);

  // Target account for imports
  const [targetAccountId, setTargetAccountId] = useState(accounts[0]?.id || 'acc_itau');

  // Launch bank connector modal / simulation
  const handleConnectBank = (bankId: string) => {
    setIsSyncing(bankId);
    setTimeout(() => {
      setConnectedBanks([...connectedBanks, bankId]);
      setIsSyncing(null);
      // Automatically load pending transactions on connection to populate the conciliation tab!
      setPendingTxs(MOCK_OFX_TXS.map(tx => ({ ...tx, id: `pend_${Date.now()}_${tx.id}` })));
      setActiveSubTab('concil');
    }, 2000);
  };

  const handleDisconnectBank = (bankId: string) => {
    if (window.confirm(`Deseja revogar a autorização de leitura da Pluggy para este banco?`)) {
      setConnectedBanks(connectedBanks.filter(id => id !== bankId));
    }
  };

  // Simulated OFX file drop / select
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file.name);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file.name);
    }
  };

  const processFile = (fileName: string) => {
    setUploadedFileName(fileName);
    setTimeout(() => {
      // Seed pending transactions
      setPendingTxs(MOCK_OFX_TXS.map(tx => ({ ...tx, id: `pend_${Date.now()}_${tx.id}` })));
      setActiveSubTab('concil');
    }, 1200);
  };

  // Conciliation action handlers
  const handleAcceptAI = (txId: string) => {
    setPendingTxs(prev => prev.map(t => {
      if (t.id === txId) {
        return { ...t, accepted: true };
      }
      return t;
    }));
  };

  const handleEditCategoryChange = (txId: string, newCatName: string) => {
    setPendingTxs(prev => prev.map(t => {
      if (t.id === txId) {
        return { ...t, suggestedCategory: newCatName };
      }
      return t;
    }));
  };

  const handleConciliateSingle = (txId: string) => {
    const tx = pendingTxs.find(t => t.id === txId);
    if (!tx) return;

    // Convert to a real system transaction
    const newSysTx = {
      type: tx.type,
      category: tx.suggestedCategory,
      subcategory: tx.subcategory,
      tags: ['Conciliado', tx.paymentMethod],
      amount: tx.amount,
      date: new Date().toISOString().split('T')[0],
      recurring: 'none' as const,
      notes: tx.description,
      memberId: 'mem_geral',
      accountId: targetAccountId
    };

    // Trigger state import up to App.tsx
    onImportTransactions([newSysTx]);

    // Remove from pending
    setPendingTxs(prev => prev.filter(t => t.id !== txId));
    setReconciledCount(prev => prev + 1);
  };

  const handleConciliateAll = () => {
    if (pendingTxs.length === 0) return;

    const newSysTxs = pendingTxs.map(tx => ({
      type: tx.type,
      category: tx.suggestedCategory,
      subcategory: tx.subcategory,
      tags: ['Conciliado', tx.paymentMethod],
      amount: tx.amount,
      date: new Date().toISOString().split('T')[0],
      recurring: 'none' as const,
      notes: tx.description,
      memberId: 'mem_geral',
      accountId: targetAccountId
    }));

    onImportTransactions(newSysTxs);
    setReconciledCount(prev => prev + pendingTxs.length);
    setPendingTxs([]);
  };

  return (
    <div className="space-y-6" id="bank-integration-container">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Banco & Conciliação Automática</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium">Sincronize extratos em tempo real via Pluggy ou importe arquivos OFX com sugestões de IA</p>
        </div>
        
        {/* Destination Account Filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-400">Conta de Destino:</span>
          <select
            value={targetAccountId}
            onChange={(e) => setTargetAccountId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name} (R$ {acc.balance.toFixed(0)})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Integration Options menu tabs */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/60 shadow-sm">
        <button
          onClick={() => setActiveSubTab('pluggy')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'pluggy' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100/50' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Plug size={14} /> Sincronizar Pluggy (API)
        </button>
        <button
          onClick={() => setActiveSubTab('ofx')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === 'ofx' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100/50' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Upload size={14} /> Importar OFX Manual
        </button>
        <button
          onClick={() => setActiveSubTab('concil')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all relative cursor-pointer ${
            activeSubTab === 'concil' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100/50' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sparkles size={14} /> Painel de Conciliação
          {pendingTxs.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center animate-pulse">
              {pendingTxs.length}
            </span>
          )}
        </button>
      </div>

      {/* RENDER DYNAMIC CANVAS */}
      {activeSubTab === 'pluggy' && (
        <div className="space-y-6">
          {/* Pluggy Sync section */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
              <Building2 size={16} className="text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conectar Conta Bancária via Pluggy API</h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Pluggy é uma infraestrutura de Open Finance que permite a leitura segura e automatizada de extratos bancários e faturas de cartão. Conecte sua instituição para automatizar toda a sua conciliação financeira familiar.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2">
              {BANKS.map((b) => {
                const isConnected = connectedBanks.includes(b.id);
                const sync = isSyncing === b.id;

                return (
                  <div 
                    key={b.id} 
                    className={`bg-slate-50 p-4 rounded-2xl border-2 transition-all flex flex-col justify-between items-center text-center space-y-3 ${
                      isConnected ? 'border-indigo-600 bg-indigo-50/10' : 'border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-2xl">{b.logo}</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{b.name}</h4>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        {isConnected ? 'Sincronizado' : 'Não vinculado'}
                      </span>
                    </div>

                    <button
                      onClick={() => isConnected ? handleDisconnectBank(b.id) : handleConnectBank(b.id)}
                      disabled={sync}
                      className={`w-full py-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        sync
                          ? 'bg-indigo-100 text-indigo-400'
                          : isConnected
                            ? 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                      }`}
                    >
                      {sync ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" /> Conectando...
                        </>
                      ) : isConnected ? (
                        'Desconectar'
                      ) : (
                        'Conectar Conta'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">🔒 Protocolo de Segurança Criptografado (LGPD/Open Finance)</p>
              <p className="text-[11px] text-emerald-700/95 font-medium mt-0.5">
                Suas senhas nunca são armazenadas. A Pluggy realiza conexões em modo de leitura criptografada fim-a-fim de transações de conta corrente de forma segura e transparente.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'ofx' && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col items-center justify-center space-y-6">
          <div className="text-center space-y-2 max-w-md">
            <Building2 size={36} className="text-indigo-600 mx-auto" />
            <h3 className="text-sm font-display font-bold text-slate-900">Importação Manual de Extratos (OFX)</h3>
            <p className="text-xs text-slate-400 font-medium">Arraste ou selecione o arquivo .OFX gerado pelo aplicativo do seu banco ou internet banking.</p>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center space-y-3 cursor-pointer transition-all ${
              isDragging 
                ? 'border-indigo-600 bg-indigo-50/20' 
                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <Upload size={32} className="text-slate-400" />
            
            <div className="text-xs font-semibold text-slate-500 text-center">
              {uploadedFileName ? (
                <span className="text-indigo-600 font-bold block flex items-center justify-center gap-1.5">
                  <FileText size={16} /> {uploadedFileName} (Carregando...)
                </span>
              ) : (
                <span>Arraste seu arquivo .ofx aqui ou <label className="text-indigo-600 underline cursor-pointer">procure no computador<input type="file" accept=".ofx" onChange={handleFileSelect} className="hidden" /></label></span>
              )}
            </div>
            
            <span className="text-[10px] text-slate-400">Tamanho máximo recomendado: 15MB</span>
          </div>
        </div>
      )}

      {activeSubTab === 'concil' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                {pendingTxs.length} pendências
              </span>
              <span className="text-slate-400 font-semibold">| Conciliados nesta sessão: {reconciledCount}</span>
            </div>

            {pendingTxs.length > 0 && (
              <button
                onClick={handleConciliateAll}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all cursor-pointer"
              >
                Aprovar & Conciliar Todas ({pendingTxs.length})
              </button>
            )}
          </div>

          <div className="space-y-3" id="conciliation-list">
            {pendingTxs.map((tx) => (
              <div 
                key={tx.id} 
                className={`bg-white p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  tx.accepted ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200/60'
                }`}
              >
                {/* Transaction metadata */}
                <div className="flex items-start gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {tx.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{tx.description}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200/60 text-[9px] font-bold text-slate-500 uppercase">
                        {tx.paymentMethod}
                      </span>
                      <span className="text-slate-400 text-[10px] font-semibold">Valor:</span>
                      <span className={`text-xs font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {tx.type === 'income' ? '+' : '-'} R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Classification logic */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100 max-w-md w-full justify-between">
                  <div className="space-y-1">
                    <span className="text-[9px] text-indigo-600 font-extrabold uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={10} /> IA Sugere Categoria
                    </span>
                    
                    <div className="flex items-center gap-1.5">
                      <select
                        value={tx.suggestedCategory}
                        onChange={(e) => handleEditCategoryChange(tx.id, e.target.value)}
                        className="px-2 py-1 bg-white border border-slate-200 text-xs font-bold rounded-lg focus:outline-none"
                      >
                        {categories.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-emerald-600 font-bold">92% conf.</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {!tx.accepted ? (
                      <button
                        onClick={() => handleAcceptAI(tx.id)}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-200 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Check size={11} /> Confirmar IA
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <Check size={14} /> Confirmado
                      </span>
                    )}

                    <button
                      onClick={() => handleConciliateSingle(tx.id)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                    >
                      Conciliar
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {pendingTxs.length === 0 && (
              <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-200/60 flex flex-col items-center justify-center space-y-2">
                <CheckCircle2 size={36} className="text-emerald-500" />
                <p className="text-xs font-semibold text-slate-500">Tudo limpo! Sua conciliação está 100% em dia.</p>
                <p className="text-[11px] text-slate-400">Importe arquivos OFX ou acesse a aba Pluggy para baixar novas transações bancárias pendentes de aprovação.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
