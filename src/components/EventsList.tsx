import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import RucherVisits from './admin/RucherVisits';
import { useAuth } from '../contexts/AuthContext';

export default function EventsList() {
  const { userData } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [view, setView] = useState<'general' | 'rucher'>('general');

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('startDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'events', id), { status });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
    }
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      try {
        await deleteDoc(doc(db, 'events', itemToDelete));
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
      }
      setItemToDelete(null);
    }
  };

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[100] bg-surface-container-lowest p-8 flex flex-col h-screen overflow-hidden' : 'p-8 h-[calc(100vh-80px)] flex flex-col relative'}>
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <h2 className="text-3xl font-bold font-headline text-primary">Événements & Inscriptions</h2>
          <div className="flex gap-2 mt-2">
            <button 
              onClick={() => setView('general')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${view === 'general' ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}
            >
              Général
            </button>
            <button 
              onClick={() => setView('rucher')}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${view === 'rucher' ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`}
            >
              Visites Rucher 7 Juin
            </button>
          </div>
        </div>
        <button 
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
          title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
        >
          <span className="material-symbols-outlined">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'general' ? (
          <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/20 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant text-sm uppercase tracking-wider">
                    <th className="p-4 font-bold">Titre</th>
                    <th className="p-4 font-bold">Date de début</th>
                    <th className="p-4 font-bold">Date de fin</th>
                    <th className="p-4 font-bold">Toute la journée</th>
                    <th className="p-4 font-bold">Statut</th>
                    {userData?.role !== 'client' && <th className="p-4 font-bold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                      <td className="p-4 font-bold">{item.title || 'N/A'}</td>
                      <td className="p-4 text-sm">{item.startDate?.toDate().toLocaleString() || 'N/A'}</td>
                      <td className="p-4 text-sm">{item.endDate?.toDate().toLocaleString() || 'N/A'}</td>
                      <td className="p-4 text-sm">{item.allDay ? 'Oui' : 'Non'}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          item.status === 'validé' ? 'bg-emerald-100 text-emerald-800' :
                          item.status === 'reporté' ? 'bg-blue-100 text-blue-800' :
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
                              onClick={() => updateStatus(item.id, 'reporté')}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Reporter"
                            >
                              <span className="material-symbols-outlined text-sm">event_repeat</span>
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
                      <td colSpan={6} className="p-8 text-center text-on-surface-variant">
                        Aucun événement trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto bg-surface-container-lowest rounded-3xl p-8 shadow-sm border border-outline-variant/20">
            <RucherVisits />
          </div>
        )}
      </div>

      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest rounded-3xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-on-surface mb-4">Confirmer la suppression</h3>
            <p className="text-on-surface-variant mb-6">Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible.</p>
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
    </div>
  );
}
