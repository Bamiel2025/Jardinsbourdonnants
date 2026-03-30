import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

interface BoardMember {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  role: 'Secrétaire' | 'Trésorier(e)' | 'Président(e)' | 'Membre du bureau';
  createdAt: any;
}

export default function BoardMembersList() {
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<BoardMember | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    role: 'Membre du bureau' as BoardMember['role']
  });

  useEffect(() => {
    const q = query(collection(db, 'boardMembers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BoardMember[];
      
      // Sort to put President first, then Treasurer, then Secretary, then others
      const roleOrder = {
        'Président(e)': 1,
        'Trésorier(e)': 2,
        'Secrétaire': 3,
        'Membre du bureau': 4
      };
      
      membersData.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);
      
      setMembers(membersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'boardMembers');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMember) {
        await updateDoc(doc(db, 'boardMembers', editingMember.id), {
          ...formData,
          phone: formData.phone || null
        });
      } else {
        await addDoc(collection(db, 'boardMembers'), {
          ...formData,
          phone: formData.phone || null,
          createdAt: serverTimestamp()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingMember ? OperationType.UPDATE : OperationType.CREATE, 'boardMembers');
      alert('Une erreur est survenue.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce membre du bureau ?')) {
      try {
        await deleteDoc(doc(db, 'boardMembers', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `boardMembers/${id}`);
        alert('Erreur lors de la suppression.');
      }
    }
  };

  const openModal = (member?: BoardMember) => {
    if (member) {
      setEditingMember(member);
      setFormData({
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        phone: member.phone || '',
        email: member.email || '',
        role: member.role
      });
    } else {
      setEditingMember(null);
      setFormData({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        role: 'Membre du bureau'
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMember(null);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-slate-800">Membres du bureau</h3>
        <button
          onClick={() => openModal()}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined">add</span>
          Ajouter un membre
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {members.map(member => (
          <div key={member.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative group">
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
              <button onClick={() => openModal(member)} className="text-slate-400 hover:text-blue-600 bg-white rounded-full p-1 shadow-sm border border-slate-100">
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
              <button onClick={() => handleDelete(member.id)} className="text-slate-400 hover:text-red-600 bg-white rounded-full p-1 shadow-sm border border-slate-100">
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-emerald-100 text-primary rounded-full flex items-center justify-center font-bold text-xl">
                {(member.firstName?.charAt(0) || '')}{(member.lastName?.charAt(0) || '')}
                {(!member.firstName && !member.lastName) && '?'}
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-lg">
                  {member.firstName || member.lastName ? `${member.firstName || ''} ${member.lastName || ''}`.trim() : 'Nom non renseigné'}
                </h4>
                <span className="inline-block px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                  {member.role}
                </span>
              </div>
            </div>
            
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 text-sm">mail</span>
                {member.email ? (
                  <a href={`mailto:${member.email}`} className="hover:text-primary transition-colors truncate">{member.email}</a>
                ) : (
                  <span className="text-slate-400 italic">Non renseigné</span>
                )}
              </div>
              {member.phone && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-sm">phone</span>
                  <a href={`tel:${member.phone}`} className="hover:text-primary transition-colors">{member.phone}</a>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {members.length === 0 && (
          <div className="col-span-full text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">groups</span>
            <p className="text-slate-500">Aucun membre du bureau n'a été ajouté.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">
                {editingMember ? 'Modifier le membre' : 'Ajouter un membre'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prénom</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={e => setFormData({...formData, firstName: e.target.value})}
                    className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={e => setFormData({...formData, lastName: e.target.value})}
                    className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rôle *</label>
                <select
                  required
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as BoardMember['role']})}
                  className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="Président(e)">Président(e)</option>
                  <option value="Trésorier(e)">Trésorier(e)</option>
                  <option value="Secrétaire">Secrétaire</option>
                  <option value="Membre du bureau">Membre du bureau</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
                >
                  {editingMember ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
