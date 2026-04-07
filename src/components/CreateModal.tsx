import React, { useState, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'event' | 'reservation' | 'quote' | 'invoice' | 'purchase';
}

export default function CreateModal({ isOpen, onClose, defaultTab = 'event' }: CreateModalProps) {
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Event State
  const [eventTitle, setEventTitle] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  
  // Quick Reservation State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [locationChoice, setLocationChoice] = useState<'rucher' | 'jardin'>('rucher');
  const [audienceType, setAudienceType] = useState<'scolaire' | 'public' | 'entreprises'>('scolaire');
  const [participantsCount, setParticipantsCount] = useState<number>(1);
  const [reservationDate, setReservationDate] = useState('');

  // Quick Quote/Invoice State
  const [amount, setAmount] = useState('');

  // Purchase Request State
  const [purchaseDescription, setPurchaseDescription] = useState('');
  const [purchaseQuantity, setPurchaseQuantity] = useState<number>(1);
  const [purchasePrice, setPurchasePrice] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (activeTab === 'event') {
        await addDoc(collection(db, 'events'), {
          title: eventTitle,
          startDate: Timestamp.fromDate(new Date(eventStart)),
          endDate: Timestamp.fromDate(new Date(eventEnd)),
          status: 'en attente de validation',
          createdBy: userData?.uid,
          createdAt: serverTimestamp()
        });
      } else if (activeTab === 'reservation') {
        const resDate = reservationDate ? new Date(reservationDate) : new Date();
        const resEndDate = new Date(resDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
        await addDoc(collection(db, 'reservations'), {
          fullName,
          email,
          description,
          locationChoice,
          details: { audienceType, participantsCount },
          status: 'en attente de validation',
          startDate: Timestamp.fromDate(resDate),
          endDate: Timestamp.fromDate(resEndDate),
          userId: userData?.uid || null,
          createdAt: serverTimestamp()
        });
      } else if (activeTab === 'quote' || activeTab === 'invoice') {
        await addDoc(collection(db, activeTab === 'quote' ? 'quotes' : 'invoices'), {
          fullName,
          email,
          description,
          locationChoice,
          details: { audienceType, participantsCount },
          amount: Number(amount),
          status: activeTab === 'quote' ? 'pending' : 'unpaid',
          createdAt: serverTimestamp()
        });
      } else if (activeTab === 'purchase') {
        await addDoc(collection(db, 'purchaseRequests'), {
          title: purchaseDescription.substring(0, 50) || 'Demande d\'achat',
          description: purchaseDescription,
          quantity: purchaseQuantity,
          price: Number(purchasePrice),
          estimatedAmount: purchaseQuantity * Number(purchasePrice),
          status: 'pending',
          createdAt: serverTimestamp()
        });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, activeTab);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="shrink-0 p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low">
          <h2 className="text-2xl font-bold font-headline text-primary">Créer un élément</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="shrink-0 flex border-b border-outline-variant/20 overflow-x-auto">
          {[
            { id: 'event', label: 'Événement', icon: 'event' },
            { id: 'reservation', label: 'Réservation', icon: 'event_seat' },
            { id: 'quote', label: 'Devis', icon: 'request_quote' },
            { id: 'invoice', label: 'Facture', icon: 'receipt_long' },
            { id: 'purchase', label: 'Demande d\'achat', icon: 'shopping_cart' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 font-bold text-sm whitespace-nowrap transition-colors ${activeTab === tab.id ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form id="create-form" onSubmit={handleSubmit} className="space-y-6">
            {activeTab === 'event' && (
              <>
                <div>
                  <label className="block text-sm font-bold mb-2">Titre de l'événement</label>
                  <input required type="text" value={eventTitle} onChange={e => setEventTitle(e.target.value)} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" placeholder="Ex: Atelier d'apiculture" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-2">Début</label>
                    <input required type="datetime-local" value={eventStart} onChange={e => setEventStart(e.target.value)} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Fin</label>
                    <input required type="datetime-local" value={eventEnd} onChange={e => setEventEnd(e.target.value)} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" />
                  </div>
                </div>
              </>
            )}

            {(activeTab === 'reservation' || activeTab === 'quote' || activeTab === 'invoice') && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-2">Nom et prénom</label>
                    <input required type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" placeholder="Jean Dupont" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Adresse mail</label>
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" placeholder="jean@exemple.com" />
                  </div>
                </div>
                {activeTab === 'reservation' && (
                  <div>
                    <label className="block text-sm font-bold mb-2">Date et heure souhaitées</label>
                    <input required type="datetime-local" value={reservationDate} onChange={e => setReservationDate(e.target.value)} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold mb-2">Description</label>
                  <textarea required value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none min-h-[100px]" placeholder="Détails de la demande..." />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Choix du lieu</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="locationChoice" value="rucher" checked={locationChoice === 'rucher'} onChange={() => setLocationChoice('rucher')} className="text-primary focus:ring-primary" />
                      <span>Animation au rucher</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="locationChoice" value="jardin" checked={locationChoice === 'jardin'} onChange={() => setLocationChoice('jardin')} className="text-primary focus:ring-primary" />
                      <span>Animation au jardin</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-2">Public cible</label>
                    <select 
                      value={audienceType} 
                      onChange={e => setAudienceType(e.target.value as 'scolaire' | 'public' | 'entreprises')}
                      className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="scolaire">Scolaire</option>
                      <option value="public">Public</option>
                      <option value="entreprises">Entreprises</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Nb. participants</label>
                    <input 
                      required 
                      type="number" 
                      min="1" 
                      value={participantsCount} 
                      onChange={e => setParticipantsCount(parseInt(e.target.value) || 1)} 
                      className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" 
                    />
                  </div>
                </div>
              </>
            )}

            {(activeTab === 'quote' || activeTab === 'invoice') && (
              <>
                <div>
                  <label className="block text-sm font-bold mb-2">Montant (€)</label>
                  <input required type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" placeholder="0.00" />
                </div>
              </>
            )}

            {activeTab === 'purchase' && (
              <>
                <div>
                  <label className="block text-sm font-bold mb-2">Description</label>
                  <textarea required value={purchaseDescription} onChange={e => setPurchaseDescription(e.target.value)} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none min-h-[100px]" placeholder="Détails de l'achat..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-2">Nombre</label>
                    <input required type="number" min="1" value={purchaseQuantity} onChange={e => setPurchaseQuantity(parseInt(e.target.value) || 1)} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Prix unitaire (€)</label>
                    <input required type="number" min="0" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" placeholder="0.00" />
                  </div>
                </div>
              </>
            )}
          </form>
        </div>

        <div className="shrink-0 p-6 border-t border-outline-variant/20 bg-surface-container-low flex justify-end gap-4">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors">
            Annuler
          </button>
          <button type="submit" form="create-form" disabled={isSubmitting} className="px-6 py-3 rounded-xl font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50">
            {isSubmitting ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
