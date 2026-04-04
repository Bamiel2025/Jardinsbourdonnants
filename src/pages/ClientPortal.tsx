import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { addDoc, collection, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export default function ClientPortal() {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reservation' | 'monitoring'>('dashboard');
  const [reservationType, setReservationType] = useState<'adhesion' | 'animation'>('adhesion');
  const [parcelType, setParcelType] = useState<'garden' | 'apiary'>('garden');
  const [audienceType, setAudienceType] = useState<'scolaire' | 'public' | 'entreprises'>('scolaire');
  const [participantsCount, setParticipantsCount] = useState<number>(1);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Pricing logic
  let currentQuote = 0;
  if (reservationType === 'adhesion') {
    currentQuote = 35; // 35 euros annuel
  } else if (reservationType === 'animation') {
    if (audienceType === 'scolaire') {
      currentQuote = 150; // 150 euros la demi-journée forfaitaire
    } else if (audienceType === 'public') {
      currentQuote = 20 * participantsCount; // 20 euros par personne
    } else if (audienceType === 'entreprises') {
      currentQuote = 50 * participantsCount; // 50 euros par personne pour les entreprises
    }
  }

  const handleRequestReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;
    
    setIsSubmitting(true);
    try {
      // 1. Create a pending reservation/request
      const startDate = new Date();
      const endDate = new Date();
      if (reservationType === 'adhesion') {
        endDate.setFullYear(endDate.getFullYear() + 1); // 1 year duration
      } else {
        // Animation is half-day, just set end date to same day for now
        endDate.setHours(endDate.getHours() + 4); 
      }

      const reservationData = {
        userId: userData.uid,
        type: reservationType,
        details: reservationType === 'adhesion' 
          ? { parcelType } 
          : { audienceType, participantsCount },
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        status: 'pending',
        createdAt: serverTimestamp()
      };

      const reservationRef = await addDoc(collection(db, 'reservations'), reservationData);

      // 2. Create a pending quote
      await addDoc(collection(db, 'quotes'), {
        userId: userData.uid,
        reservationId: reservationRef.id,
        amount: currentQuote,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      setQuoteAmount(currentQuote);
      showToast('Demande envoyée avec succès ! Un administrateur vous contactera bientôt.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reservations/quotes');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-4xl font-black font-headline mb-2">Bonjour, {userData?.displayName} ! 🐝</h2>
          <p className="text-emerald-50 text-lg max-w-xl">Bienvenue sur votre espace adhérent Les Jardins Bourdonnants. Retrouvez ici vos services et les dernières actualités de notre association.</p>
        </div>
        <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-[180px] opacity-10 rotate-12 select-none">hive</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* News Section */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined">newspaper</span>
            Dernières Actualités
          </h3>
          <div className="space-y-4">
            {[
              { date: '15 Avril 2026', title: 'Préparation de la saison apicole', text: 'Les premières visites de printemps ont commencé. Les colonies se développent bien !' },
              { date: '02 Avril 2026', title: 'Nouvelle parcelle aux jardins', text: 'Trois nouvelles parcelles sont disponibles pour l\'adhésion "Potager". Premier arrivé, premier servi !' }
            ].map((news, i) => (
              <div key={i} className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 hover:shadow-md transition-shadow">
                <span className="text-xs font-bold text-primary-fixed bg-primary-container px-2 py-1 rounded-full">{news.date}</span>
                <h4 className="text-xl font-bold mt-2 text-on-surface">{news.title}</h4>
                <p className="text-on-surface-variant mt-1">{news.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Info / Weather */}
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined">cloud</span>
            Météo du Rucher
          </h3>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-200 dark:border-blue-800 flex flex-col items-center">
            <span className="material-symbols-outlined text-6xl text-blue-500 animate-pulse">sunny</span>
            <div className="text-center mt-4">
              <span className="text-4xl font-black text-on-surface">18°C</span>
              <p className="text-on-surface-variant font-medium">Grand Soleil - Idéal pour le butinage</p>
            </div>
            <div className="w-full mt-6 grid grid-cols-2 gap-2 text-xs text-center font-bold">
              <div className="bg-white/50 dark:bg-black/20 p-2 rounded-lg">Humidité: 45%</div>
              <div className="bg-white/50 dark:bg-black/20 p-2 rounded-lg">Vent: 10km/h</div>
            </div>
          </div>
          
          <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/30 space-y-4">
            <h4 className="font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
              Statistiques Globales
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant italic">Membres actifs :</span>
                <span className="font-bold">142</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant italic">Récolte 2025 :</span>
                <span className="font-bold">250kg</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col relative">
      {toastMessage && (
        <div className="fixed top-4 right-8 bg-surface-container-highest text-on-surface px-6 py-3 rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-top-4">
          {toastMessage}
        </div>
      )}
      <header className="bg-primary text-on-primary py-4 px-8 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
          </div>
          <h1 className="text-xl font-bold font-headline">Les jardins bourdonnants</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-medium hidden sm:block">{userData?.displayName}</span>
          <button
            onClick={() => navigate(userData?.role === 'client' ? '/portal' : '/admin')}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">dashboard</span>
            {userData?.role === 'client' ? 'Mon Espace' : 'Tableau de bord'}
          </button>
          <button onClick={logout} className="bg-primary-fixed text-on-primary-fixed px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary-fixed/90 transition-colors cursor-pointer">
            Déconnexion
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-8 flex flex-col">
        <div className="flex gap-4 mb-8 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-primary text-on-primary shadow-lg scale-105' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <span className="material-symbols-outlined">dashboard</span>
            Tableau de Bord
          </button>
          <button 
            onClick={() => setActiveTab('reservation')}
            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'reservation' ? 'bg-primary text-on-primary shadow-lg scale-105' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <span className="material-symbols-outlined">event_seat</span>
            Réservation & Devis
          </button>
          <button 
            onClick={() => setActiveTab('monitoring')}
            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'monitoring' ? 'bg-primary text-on-primary shadow-lg scale-105' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <span className="material-symbols-outlined">monitor_weight</span>
            Monitoring Ruches
          </button>
        </div>

        {activeTab === 'dashboard' ? renderDashboard() : 
         activeTab === 'reservation' ? (
          <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-sm border border-outline-variant/20 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-3xl font-extrabold text-primary font-headline mb-2">Demande de devis & réservation</h2>
            <p className="text-on-surface-variant mb-8">Obtenez un devis immédiat pour une adhésion ou une animation.</p>

            <form onSubmit={handleRequestReservation} className="space-y-8">
            
            {/* Type de prestation */}
            <div className="space-y-4">
              <label className="block text-lg font-bold text-on-surface">Type de prestation</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className={`cursor-pointer border-2 rounded-xl p-4 flex items-center gap-4 transition-all ${reservationType === 'adhesion' ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/30'}`}>
                  <input type="radio" name="reservationType" value="adhesion" checked={reservationType === 'adhesion'} onChange={() => setReservationType('adhesion')} className="hidden" />
                  <span className="material-symbols-outlined text-3xl">nature_people</span>
                  <div>
                    <span className="font-bold block">Adhésion Annuelle</span>
                    <span className="text-xs opacity-80">Accès au potager ou rucher</span>
                  </div>
                </label>
                <label className={`cursor-pointer border-2 rounded-xl p-4 flex items-center gap-4 transition-all ${reservationType === 'animation' ? 'border-secondary bg-secondary/5 text-secondary' : 'border-outline-variant/30 text-on-surface-variant hover:border-secondary/30'}`}>
                  <input type="radio" name="reservationType" value="animation" checked={reservationType === 'animation'} onChange={() => setReservationType('animation')} className="hidden" />
                  <span className="material-symbols-outlined text-3xl">school</span>
                  <div>
                    <span className="font-bold block">Animation Rucher</span>
                    <span className="text-xs opacity-80">Demi-journée découverte</span>
                  </div>
                </label>
              </div>
            </div>

            <hr className="border-outline-variant/20" />

            {/* Options conditionnelles */}
            {reservationType === 'adhesion' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <label className="block text-lg font-bold text-on-surface">Choix de l'espace</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${parcelType === 'garden' ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/30'}`}>
                    <input type="radio" name="parcelType" value="garden" checked={parcelType === 'garden'} onChange={() => setParcelType('garden')} className="hidden" />
                    <span className="material-symbols-outlined text-3xl">local_florist</span>
                    <span className="font-bold">Potager</span>
                  </label>
                  <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${parcelType === 'apiary' ? 'border-secondary bg-secondary/5 text-secondary' : 'border-outline-variant/30 text-on-surface-variant hover:border-secondary/30'}`}>
                    <input type="radio" name="parcelType" value="apiary" checked={parcelType === 'apiary'} onChange={() => setParcelType('apiary')} className="hidden" />
                    <span className="material-symbols-outlined text-3xl">hive</span>
                    <span className="font-bold">Rucher</span>
                  </label>
                </div>
                <p className="text-sm text-on-surface-variant mt-2 italic">L'adhésion est valable pour une durée de 1 an.</p>
              </div>
            )}

            {reservationType === 'animation' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-4">
                  <label className="block text-lg font-bold text-on-surface">Public cible</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${audienceType === 'scolaire' ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/30'}`}>
                      <input type="radio" name="audienceType" value="scolaire" checked={audienceType === 'scolaire'} onChange={() => setAudienceType('scolaire')} className="hidden" />
                      <span className="material-symbols-outlined text-3xl">child_care</span>
                      <span className="font-bold text-center">Scolaire<br/><span className="text-xs font-normal">Forfait demi-journée</span></span>
                    </label>
                    <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${audienceType === 'public' ? 'border-secondary bg-secondary/5 text-secondary' : 'border-outline-variant/30 text-on-surface-variant hover:border-secondary/30'}`}>
                      <input type="radio" name="audienceType" value="public" checked={audienceType === 'public'} onChange={() => setAudienceType('public')} className="hidden" />
                      <span className="material-symbols-outlined text-3xl">groups</span>
                      <span className="font-bold text-center">Public<br/><span className="text-xs font-normal">Tarif par personne</span></span>
                    </label>
                    <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${audienceType === 'entreprises' ? 'border-tertiary bg-tertiary/5 text-tertiary' : 'border-outline-variant/30 text-on-surface-variant hover:border-tertiary/30'}`}>
                      <input type="radio" name="audienceType" value="entreprises" checked={audienceType === 'entreprises'} onChange={() => setAudienceType('entreprises')} className="hidden" />
                      <span className="material-symbols-outlined text-3xl">business_center</span>
                      <span className="font-bold text-center">Entreprises<br/><span className="text-xs font-normal">Tarif par personne</span></span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-on-surface">Nombre de participants</label>
                  <div className="flex items-center gap-4">
                    <button type="button" onClick={() => setParticipantsCount(Math.max(1, participantsCount - 1))} className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer">
                      <span className="material-symbols-outlined">remove</span>
                    </button>
                    <span className="text-2xl font-bold w-12 text-center">{participantsCount}</span>
                    <button type="button" onClick={() => setParticipantsCount(participantsCount + 1)} className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer">
                      <span className="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-surface-container-low p-6 rounded-2xl mt-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-outline-variant/20">
              <div>
                <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">Devis estimé</p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-primary">{currentQuote}€</span>
                  <span className="text-sm font-medium text-on-surface-variant mb-1">/ total</span>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full md:w-auto bg-amber-400 text-primary px-8 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-amber-300 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Envoi en cours...' : 'Valider la demande'}
              </button>
            </div>
          </form>

          {quoteAmount !== null && (
            <div className="mt-8 p-4 bg-primary-container/10 text-primary-container rounded-xl flex items-start gap-3 animate-in fade-in">
              <span className="material-symbols-outlined">check_circle</span>
              <div>
                <p className="font-bold">Demande enregistrée !</p>
                <p className="text-sm mt-1">Votre devis de {quoteAmount}€ a été généré. Un administrateur va examiner votre demande prochainement.</p>
              </div>
            </div>
          )}
        </div>
        ) : (
          <div className="flex-1 bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/20 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-outline-variant/20 bg-surface-container-low">
              <h2 className="text-2xl font-bold text-primary font-headline">Monitoring des Ruches</h2>
              <p className="text-sm text-on-surface-variant mt-1">Suivi en temps réel du poids et de l'activité des ruches.</p>
            </div>
            <iframe 
              src="https://beezbee.ddns.net/beezbee-curve/beezbee-disp-0016003202473732/index.php" 
              className="w-full flex-1 border-none min-h-[600px]"
              title="Monitoring Poids des Ruches"
            />
          </div>
        )}
      </main>
    </div>
  );
}
