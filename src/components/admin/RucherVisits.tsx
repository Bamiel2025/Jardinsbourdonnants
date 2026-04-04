import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function RucherVisits() {
  const [visits, setVisits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'rucher_visits_2026'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
      setVisits(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'rucher_visits_2026', id), {
        status: newStatus
      });
    } catch (err) {
      console.error("Erreur lors de la mise à jour du statut", err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'validé':
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold uppercase">Validé</span>;
      case 'en cours de validation':
        return <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold uppercase">En cours</span>;
      case 'complet':
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold uppercase">Complet (autre session)</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto w-full space-y-8 animate-in fade-in">
      <div>
        <h2 className="text-4xl font-extrabold text-primary tracking-tight font-headline">Visites Rucher (7 Juin 2026)</h2>
        <p className="text-on-surface-variant mt-2 text-lg">Gestion des inscriptions pour la journée aux jardins Bourdonnants.</p>
      </div>

      <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/20 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-on-surface-variant flex justify-center items-center py-20">
            <span className="animate-spin material-symbols-outlined text-4xl text-primary">autorenew</span>
          </div>
        ) : visits.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant flex flex-col items-center justify-center py-20">
            <span className="material-symbols-outlined text-6xl mb-4 opacity-50">hive</span>
            <p>Aucune inscription pour le moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-sm border-b border-outline-variant/30">
                  <th className="p-4 font-bold">Date d'inscription</th>
                  <th className="p-4 font-bold">Nom</th>
                  <th className="p-4 font-bold">Contact</th>
                  <th className="p-4 font-bold">Session</th>
                  <th className="p-4 font-bold">Participants</th>
                  <th className="p-4 font-bold">Statut</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {visits.map(visit => (
                  <tr key={visit.id} className="hover:bg-surface-container/30 transition-colors">
                    <td className="p-4">
                      <div className="text-sm font-medium">{format(visit.createdAt, 'dd MMM yyyy', { locale: fr })}</div>
                      <div className="text-xs text-on-surface-variant">{format(visit.createdAt, 'HH:mm')}</div>
                    </td>
                    <td className="p-4 font-bold">{visit.nom}</td>
                    <td className="p-4 text-sm">
                      <div>{visit.email}</div>
                      <div className="text-on-surface-variant">{visit.telephone}</div>
                    </td>
                    <td className="p-4 font-bold text-primary">{visit.heure}</td>
                    <td className="p-4">
                      <div className="flex gap-2 text-sm">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg">{visit.adultes} Adultes</span>
                        <span className="px-2 py-1 bg-teal-100 text-teal-800 rounded-lg">{visit.enfants} Enfants</span>
                      </div>
                    </td>
                    <td className="p-4">{getStatusBadge(visit.status)}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {visit.status !== 'validé' && (
                          <button onClick={() => updateStatus(visit.id, 'validé')} className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors cursor-pointer" title="Valider">
                            <span className="material-symbols-outlined text-sm">check</span>
                          </button>
                        )}
                        {visit.status !== 'complet' && (
                          <button onClick={() => updateStatus(visit.id, 'complet')} className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors cursor-pointer" title="Marquer comme complet / Proposer autre session">
                            <span className="material-symbols-outlined text-sm">event_busy</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
