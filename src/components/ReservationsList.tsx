import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import InvoiceEditor, { InvoiceData } from './InvoiceEditor';
import { useAuth } from '../contexts/AuthContext';

export default function ReservationsList() {
  const { userData } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [quoteData, setQuoteData] = useState<Partial<InvoiceData> | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'reservations', id), { status });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
    }
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      try {
        await deleteDoc(doc(db, 'reservations', itemToDelete));
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
      }
      setItemToDelete(null);
    }
  };

  const handleGenerateQuote = (item: any) => {
    const designation = item.locationChoice === 'rucher' ? 'Animation au rucher' : 
                        item.locationChoice === 'jardin' ? 'Animation au jardin' : 'Prestation apicole';
    const description = item.description ? `\n${item.description}` : '';
    
    setQuoteData({
      clientName: item.fullName || '',
      clientAddress: '',
      items: [
        { 
          id: '1', 
          designation: `${designation}${description}`, 
          quantity: 1, 
          unitPrice: 150 
        }
      ]
    });
    setIsEditorOpen(true);
  };

  const handleSaveQuote = async (data: InvoiceData) => {
    try {
      await addDoc(collection(db, 'quotes'), {
        fullName: data.clientName,
        description: data.items.map((i: any) => i.designation).join(', '),
        amount: data.totalTTC,
        status: 'en attente de validation',
        createdAt: serverTimestamp(),
        documentData: data
      });
      showToast("Devis généré et enregistré avec succès !");
      setIsEditorOpen(false);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement du devis:", error);
      showToast("Erreur lors de l'enregistrement.");
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
        <h2 className="text-3xl font-bold font-headline text-primary">Réservations</h2>
        <button 
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
          title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
        >
          <span className="material-symbols-outlined">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
        </button>
      </div>

      <div className="flex-1 bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/20 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-sm uppercase tracking-wider">
                <th className="p-4 font-bold">Date de réservation</th>
                <th className="p-4 font-bold">Nom</th>
                <th className="p-4 font-bold">Lieu</th>
                <th className="p-4 font-bold">Public</th>
                <th className="p-4 font-bold">Participants</th>
                <th className="p-4 font-bold">Description</th>
                <th className="p-4 font-bold">Statut</th>
                {userData?.role !== 'client' && <th className="p-4 font-bold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                  <td className="p-4 text-sm">{item.startDate?.toDate().toLocaleString() || item.createdAt?.toDate().toLocaleDateString() || 'N/A'}</td>
                  <td className="p-4 font-bold">{item.fullName || 'N/A'}</td>
                  <td className="p-4 text-sm text-on-surface-variant">
                    {item.locationChoice === 'rucher' ? 'Animation au rucher' : 
                     item.locationChoice === 'jardin' ? 'Animation au jardin' : 'N/A'}
                  </td>
                  <td className="p-4 text-sm text-on-surface-variant capitalize">
                    {item.details?.audienceType || 'N/A'}
                  </td>
                  <td className="p-4 text-sm text-on-surface-variant">
                    {item.details?.participantsCount || 'N/A'}
                  </td>
                  <td className="p-4 text-sm text-on-surface-variant max-w-xs truncate">{item.description || 'N/A'}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.status === 'validé' || item.status === 'confirmed' || item.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                      item.status === 'en attente de validation' || item.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.status || 'en attente de validation'}
                    </span>
                  </td>
                  {userData?.role !== 'client' && (
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleGenerateQuote(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Générer un devis"
                        >
                          <span className="material-symbols-outlined text-sm">request_quote</span>
                        </button>
                        <button 
                          onClick={() => updateStatus(item.id, 'en attente de validation')}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Mettre en attente"
                        >
                          <span className="material-symbols-outlined text-sm">schedule</span>
                        </button>
                        <button 
                          onClick={() => updateStatus(item.id, 'validé')}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Valider"
                        >
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                        </button>
                        <button 
                          onClick={() => setItemToDelete(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-on-surface-variant">
                    Aucune réservation trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest rounded-3xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-on-surface mb-4">Confirmer la suppression</h3>
            <p className="text-on-surface-variant mb-6">Êtes-vous sûr de vouloir supprimer cette réservation ? Cette action est irréversible.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditorOpen && (
        <InvoiceEditor 
          onClose={() => setIsEditorOpen(false)} 
          type="quote" 
          initialData={quoteData || undefined}
          onSave={handleSaveQuote} 
        />
      )}
    </div>
  );
}
