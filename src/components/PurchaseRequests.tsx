import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';

export default function PurchaseRequests() {
  const { userData } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [requestToDelete, setRequestToDelete] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const q = query(collection(db, 'purchaseRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'purchaseRequests', id), { status: newStatus });
      showToast('Statut mis à jour');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `purchaseRequests/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'purchaseRequests', id));
      showToast('Demande supprimée');
      setRequestToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `purchaseRequests/${id}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Validé</span>;
      case 'rejected':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">Refusé</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">En attente de validation</span>;
    }
  };

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[100] bg-surface-container-lowest p-8 flex flex-col h-screen overflow-hidden' : 'p-8 h-[calc(100vh-80px)] flex flex-col relative'}>
      {toastMessage && (
        <div className="absolute top-4 right-8 bg-surface-container-highest text-on-surface px-6 py-3 rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-top-4">
          {toastMessage}
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold font-headline text-primary">Demandes d'achats</h2>
        <button 
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
          title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
        >
          <span className="material-symbols-outlined">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requests.map(request => (
            <div key={request.id} className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/20 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-on-surface">{request.title}</h3>
                {getStatusBadge(request.status)}
              </div>
              <p className="text-on-surface-variant text-sm mb-4 flex-1">{request.description}</p>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-outline text-sm">shopping_basket</span>
                  <span className="font-bold">{request.quantity || 1} x {request.price || request.estimatedAmount} €</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="material-symbols-outlined text-outline text-sm">payments</span>
                  <span className="font-bold text-primary">Total: {request.estimatedAmount} €</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm">calendar_today</span>
                  <span>{request.createdAt ? format(request.createdAt.toDate(), 'dd MMM yyyy', { locale: fr }) : '...'}</span>
                </div>
              </div>

              {userData?.role !== 'client' && (
                <div className="flex justify-between items-center pt-4 border-t border-outline-variant/20">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleStatusChange(request.id, 'approved')}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Valider"
                    >
                      <span className="material-symbols-outlined">check_circle</span>
                    </button>
                    <button 
                      onClick={() => handleStatusChange(request.id, 'rejected')}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Refuser"
                    >
                      <span className="material-symbols-outlined">cancel</span>
                    </button>
                  </div>
                  <button 
                    onClick={() => setRequestToDelete(request.id)}
                    className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              )}
            </div>
          ))}
          {requests.length === 0 && (
            <div className="col-span-full text-center py-12 text-on-surface-variant bg-surface-container-lowest rounded-2xl border border-outline-variant/20">
              <span className="material-symbols-outlined text-4xl mb-2">shopping_basket</span>
              <p>Aucune demande d'achat pour le moment.</p>
            </div>
          )}
        </div>
      </div>

      {requestToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6">
            <h3 className="text-xl font-bold text-on-surface mb-2">Confirmer la suppression</h3>
            <p className="text-on-surface-variant mb-6">Êtes-vous sûr de vouloir supprimer cette demande d'achat ? Cette action est irréversible.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setRequestToDelete(null)}
                className="px-4 py-2 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={() => handleDelete(requestToDelete)}
                className="px-4 py-2 rounded-xl font-bold bg-error text-on-error hover:bg-error/90 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
