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
    }, (error) => {
      console.error("Erreur Firebase dans RucherVisits:", error);
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
        return <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold uppercase">En cours de validation</span>;
      case 'proposition session suivante':
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold uppercase">Proposition session suivante</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const slots = ['9h30', '10h30', '11h30', '14h30', '15h30', '16h30'];
  const occupancy = slots.reduce((acc: any, slot) => {
    const slotVisits = visits.filter(v => v.heure === slot && v.status === 'validé');
    acc[slot] = {
      adultes: slotVisits.reduce((sum, v) => sum + (v.adultes || 0), 0),
      enfants: slotVisits.reduce((sum, v) => sum + (v.enfants || 0), 0)
    };
    return acc;
  }, {});

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in">
      <div>
        <h2 className="text-3xl font-extrabold text-primary tracking-tight font-headline">Visites Rucher (7 Juin 2026)</h2>
        <p className="text-on-surface-variant mt-1 text-base">Gestion des inscriptions et suivi du remplissage par créneau.</p>
      </div>

      {/* Summary of occupancy */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {slots.map(slot => (
          <div key={slot} className={`p-4 rounded-2xl border ${occupancy[slot].adultes >= 10 && occupancy[slot].enfants >= 10 ? 'bg-red-50 border-red-200' : 'bg-surface-container-low border-outline-variant/30'}`}>
            <p className="text-sm font-bold text-primary mb-2">{slot}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                <span>Adultes</span>
                <span className={occupancy[slot].adultes >= 10 ? 'text-red-600' : 'text-on-surface-variant'}>{occupancy[slot].adultes}/10</span>
              </div>
              <div className="w-full h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
                <div className={`h-full transition-all ${occupancy[slot].adultes >= 10 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (occupancy[slot].adultes / 10) * 100)}%` }} />
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider pt-1">
                <span>Enfants</span>
                <span className={occupancy[slot].enfants >= 10 ? 'text-red-600' : 'text-on-surface-variant'}>{occupancy[slot].enfants}/10</span>
              </div>
              <div className="w-full h-1.5 bg-outline-variant/20 rounded-full overflow-hidden">
                <div className={`h-full transition-all ${occupancy[slot].enfants >= 10 ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${Math.min(100, (occupancy[slot].enfants / 10) * 100)}%` }} />
              </div>
            </div>
          </div>
        ))}
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
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                          </button>
                        )}
                        {visit.status !== 'en cours de validation' && (
                          <button onClick={() => updateStatus(visit.id, 'en cours de validation')} className="p-2 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer" title="Mettre en cours de validation">
                            <span className="material-symbols-outlined text-sm">pending</span>
                          </button>
                        )}
                        {visit.status !== 'proposition session suivante' && (
                          <button onClick={() => updateStatus(visit.id, 'proposition session suivante')} className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors cursor-pointer" title="Groupe complet - Proposer session suivante">
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
