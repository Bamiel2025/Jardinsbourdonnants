import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Agenda from '../components/Agenda';
import CreateModal from '../components/CreateModal';
import QuotesAndInvoices from '../components/QuotesAndInvoices';
import PurchaseRequests from '../components/PurchaseRequests';
import ReservationsList from '../components/ReservationsList';
import MembersList from '../components/MembersList';
import GardenManagement from '../components/GardenManagement';
import Settings from '../components/Settings';
import EventsList from '../components/EventsList';
import AdministrationPanel from '../components/AdministrationPanel';
import { format, addDays, startOfWeek, isSameDay, subWeeks, addWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function AdminDashboard() {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  useEffect(() => {
    if (!userData?.previousLogin) return;

    const prevLogin = userData.previousLogin.toDate();
    const notificationItems: any[] = [];

    const updateNotifications = (newItems: any[], category: string) => {
      setNotifications(prev => {
        const filtered = prev.filter(item => item.category !== category);
        const combined = [...filtered, ...newItems].sort((a, b) => b.timestamp - a.timestamp);
        return combined;
      });
    };

    // 1. New Reservations
    const unsubRes = onSnapshot(query(collection(db, 'reservations'), where('createdAt', '>', prevLogin)), (snap) => {
      const items = snap.docs.map(doc => ({
        id: doc.id,
        category: 'reservations',
        title: `Nouvelle réservation : ${doc.data().fullName}`,
        timestamp: doc.data().createdAt?.toDate() || new Date(),
        icon: 'event_seat',
        color: 'text-blue-600'
      }));
      updateNotifications(items, 'reservations');
    });

    // 2. New Members
    const unsubMem = onSnapshot(query(collection(db, 'members'), where('createdAt', '>', prevLogin)), (snap) => {
      const items = snap.docs.map(doc => ({
        id: doc.id,
        category: 'members',
        title: `Nouveau membre : ${doc.data().fullName}`,
        timestamp: doc.data().createdAt?.toDate() || new Date(),
        icon: 'person_add',
        color: 'text-emerald-600'
      }));
      updateNotifications(items, 'members');
    });

    // 3. New Purchase Requests
    const unsubPur = onSnapshot(query(collection(db, 'purchaseRequests'), where('createdAt', '>', prevLogin)), (snap) => {
      const items = snap.docs.map(doc => ({
        id: doc.id,
        category: 'purchases',
        title: `Demande d'achat : ${doc.data().title}`,
        timestamp: doc.data().createdAt?.toDate() || new Date(),
        icon: 'shopping_basket',
        color: 'text-amber-600'
      }));
      updateNotifications(items, 'purchases');
    });

    // 4. New Quotes
    const unsubQuo = onSnapshot(query(collection(db, 'quotes'), where('createdAt', '>', prevLogin)), (snap) => {
      const items = snap.docs.map(doc => ({
        id: doc.id,
        category: 'quotes',
        title: `Nouveau devis : ${doc.data().clientName || 'Client'}`,
        timestamp: doc.data().createdAt?.toDate() || new Date(),
        icon: 'receipt_long',
        color: 'text-purple-600'
      }));
      updateNotifications(items, 'quotes');
    });

    return () => {
      unsubRes();
      unsubMem();
      unsubPur();
      unsubQuo();
    };
  }, [userData?.previousLogin]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardContent />;
      case 'agenda':
        return <Agenda />;
      case 'reservations':
        return <ReservationsList />;
      case 'events':
        return <EventsList />;
      case 'quotes':
        return <QuotesAndInvoices />;
      case 'purchases':
        return <PurchaseRequests />;
      case 'members':
        return <MembersList />;
      case 'gardens':
        return <GardenManagement />;
      case 'monitoring':
        return <MonitoringContent />;
      case 'administration':
        return <AdministrationPanel />;
      case 'settings':
        return <Settings />;
      default:
        return <DashboardContent />;
    }
  };

  return (
    <div className={`bg-background text-on-background min-h-screen flex ${isMobileView ? 'flex-col' : ''}`}>
      {/* SideNavBar Component */}
      <aside className={`${isMobileView ? 'hidden' : 'flex'} flex-col h-full sticky top-0 left-0 bg-emerald-900 dark:bg-slate-950 text-amber-400 dark:text-amber-500 font-headline antialiased tracking-tight h-screen w-72 rounded-r-3xl border-none shadow-2xl shadow-emerald-950/20 z-50 overflow-y-auto`}>
        <div className="p-8">
          <div className="flex flex-col items-center gap-4 mb-10">
            <div className="w-56 h-56 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-xl border-4 border-emerald-800/30 transition-transform hover:scale-105">
              <img 
                src="/logo.jpg" 
                alt="Les jardins bourdonnants" 
                className="w-full h-full object-contain p-2" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "https://placehold.co/400x400/ffffff/065f46?text=Logo+Manquant%5Cn(public/logo.jpg)";
                }}
              />
            </div>
            <div className="text-center">
              <p className="text-xs text-emerald-100/50 uppercase tracking-widest font-bold">
                {userData?.role === 'client' ? 'Espace Adhérent' : 'Admin Console'}
              </p>
            </div>
          </div>
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-amber-400/10 text-amber-400 border-r-4 border-amber-400 font-semibold scale-95' : 'text-emerald-100/70 hover:text-white hover:bg-white/5'}`}>
              <span className="material-symbols-outlined">dashboard</span>
              <span>Tableau de bord</span>
            </button>
            <button onClick={() => setActiveTab('agenda')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'agenda' ? 'bg-amber-400/10 text-amber-400 border-r-4 border-amber-400 font-semibold scale-95' : 'text-emerald-100/70 hover:text-white hover:bg-white/5'}`}>
              <span className="material-symbols-outlined">calendar_today</span>
              <span>Agenda</span>
            </button>
            <button onClick={() => setActiveTab('reservations')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'reservations' ? 'bg-amber-400/10 text-amber-400 border-r-4 border-amber-400 font-semibold scale-95' : 'text-emerald-100/70 hover:text-white hover:bg-white/5'}`}>
              <span className="material-symbols-outlined">event_seat</span>
              <span>Réservations</span>
            </button>
            <button onClick={() => setActiveTab('events')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'events' ? 'bg-amber-400/10 text-amber-400 border-r-4 border-amber-400 font-semibold scale-95' : 'text-emerald-100/70 hover:text-white hover:bg-white/5'}`}>
              <span className="material-symbols-outlined">celebration</span>
              <span>Événements</span>
            </button>
            <button onClick={() => setActiveTab('quotes')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'quotes' ? 'bg-amber-400/10 text-amber-400 border-r-4 border-amber-400 font-semibold scale-95' : 'text-emerald-100/70 hover:text-white hover:bg-white/5'}`}>
              <span className="material-symbols-outlined">receipt_long</span>
              <span>Devis & Factures</span>
            </button>
            <button onClick={() => setActiveTab('purchases')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'purchases' ? 'bg-amber-400/10 text-amber-400 border-r-4 border-amber-400 font-semibold scale-95' : 'text-emerald-100/70 hover:text-white hover:bg-white/5'}`}>
              <span className="material-symbols-outlined">shopping_cart</span>
              <span>Demande d'achats</span>
            </button>
            <button onClick={() => setActiveTab('members')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'members' ? 'bg-amber-400/10 text-amber-400 border-r-4 border-amber-400 font-semibold scale-95' : 'text-emerald-100/70 hover:text-white hover:bg-white/5'}`}>
              <span className="material-symbols-outlined">group</span>
              <span>Membres</span>
            </button>
            <button onClick={() => setActiveTab('gardens')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'gardens' ? 'bg-amber-400/10 text-amber-400 border-r-4 border-amber-400 font-semibold scale-95' : 'text-emerald-100/70 hover:text-white hover:bg-white/5'}`}>
              <span className="material-symbols-outlined">yard</span>
              <span>Gestion des jardins</span>
            </button>
            <button onClick={() => setActiveTab('monitoring')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'monitoring' ? 'bg-amber-400/10 text-amber-400 border-r-4 border-amber-400 font-semibold scale-95' : 'text-emerald-100/70 hover:text-white hover:bg-white/5'}`}>
              <span className="material-symbols-outlined">monitor_weight</span>
              <span>Monitoring Ruches</span>
            </button>
            {(userData?.role === 'admin' || userData?.role === 'superadmin') && (
              <button onClick={() => setActiveTab('administration')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'administration' ? 'bg-amber-400/10 text-amber-400 border-r-4 border-amber-400 font-semibold scale-95' : 'text-emerald-100/70 hover:text-white hover:bg-white/5'}`}>
                <span className="material-symbols-outlined">admin_panel_settings</span>
                <span>Administration</span>
              </button>
            )}
            {userData?.role === 'superadmin' && (
              <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-amber-400/10 text-amber-400 border-r-4 border-amber-400 font-semibold scale-95' : 'text-emerald-100/70 hover:text-white hover:bg-white/5'}`}>
                <span className="material-symbols-outlined">settings</span>
                <span>Paramètres</span>
              </button>
            )}
          </nav>
          <div className="mt-12">
            {userData?.role !== 'client' && (
              <button 
                onClick={() => setIsCreateModalOpen(true)} 
                className="w-full bg-amber-400 text-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-amber-950/20 cursor-pointer"
              >
                <span className="material-symbols-outlined">add</span>
                Nouveau
              </button>
            )}
          </div>
        </div>
        <div className="mt-auto p-8 pt-0 border-t border-emerald-800/30">
          <nav className="space-y-1 mt-6">
            <button className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-emerald-100/70 hover:text-white hover:bg-white/5 transition-all duration-300">
              <span className="material-symbols-outlined">help</span>
              <span>Aide</span>
            </button>
            <button onClick={logout} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-emerald-100/70 hover:text-white hover:bg-white/5 transition-all duration-300 cursor-pointer">
              <span className="material-symbols-outlined">logout</span>
              <span>Déconnexion</span>
            </button>
          </nav>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        {/* TopAppBar Component */}
        <header className="flex items-center justify-between px-8 sticky top-0 z-40 w-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl h-20 surface-container-low">
          <div className="flex items-center bg-surface-container-low px-4 py-2 rounded-full w-96 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
            <span className="material-symbols-outlined text-outline">search</span>
            <input className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-outline outline-none ml-2" placeholder="Rechercher un membre, une parcelle..." type="text" />
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileView(!isMobileView)}
              className={`p-2 rounded-full transition-all cursor-pointer ${isMobileView ? 'bg-primary text-on-primary' : 'text-emerald-900 dark:text-emerald-50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`}
              title={isMobileView ? "Agrandir le menu" : "Vue Mobile Optimisée"}
            >
              <span className="material-symbols-outlined">smartphone</span>
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-emerald-900 dark:text-emerald-50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-full transition-all relative cursor-pointer"
              >
                <span className="material-symbols-outlined">notifications</span>
                {notifications.length > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-error text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 animate-in zoom-in">
                    {notifications.length}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute top-12 right-0 w-80 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/20 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="p-4 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low">
                    <h3 className="font-bold text-on-surface">Notifications</h3>
                    <button onClick={() => setShowNotifications(false)} className="text-on-surface-variant hover:text-on-surface cursor-pointer">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto p-2">
                    {notifications.length > 0 ? (
                      <div className="space-y-1">
                        {notifications.map((notif, idx) => (
                          <div 
                            key={`${notif.category}-${notif.id}`} 
                            onClick={() => {
                              setActiveTab(notif.category === 'purchases' ? 'purchases' : notif.category === 'reservations' ? 'reservations' : notif.category === 'members' ? 'members' : 'quotes');
                              setShowNotifications(false);
                            }}
                            className="p-3 bg-surface-container rounded-xl flex items-start gap-3 hover:bg-surface-container-high transition-colors cursor-pointer"
                          >
                            <span className={`material-symbols-outlined ${notif.color} mt-0.5`}>{notif.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-on-surface leading-tight mb-0.5">{notif.title}</p>
                              <p className="text-[10px] text-on-surface-variant">
                                {format(notif.timestamp, 'dd MMM HH:mm', { locale: fr })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-on-surface-variant flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-4xl opacity-20">notifications_off</span>
                        <p className="text-sm italic">Aucune nouvelle notification depuis votre dernière connexion.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={() => {
                if (userData?.role === 'superadmin') {
                  setActiveTab('settings');
                } else {
                  showToast("L'accès aux paramètres est réservé au superadministrateur.");
                }
              }}
              className="p-2 text-emerald-900 dark:text-emerald-50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-full transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined">settings</span>
            </button>
            <div className="h-8 w-px bg-outline-variant/30 mx-2"></div>
            <div className="h-8 w-px bg-outline-variant/30 mx-2"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-on-surface">{userData?.displayName || 'Utilisateur'}</p>
                <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-tight">
                  {userData?.role === 'superadmin' ? 'Super Admin' : userData?.role === 'admin' ? 'Administrateur' : 'Adhérent'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-bold border-2 border-primary-fixed">
                {userData?.displayName?.charAt(0) || 'A'}
              </div>
              <button 
                onClick={logout}
                title="Se déconnecter"
                className="ml-2 p-2 text-error hover:bg-error/10 rounded-full transition-all cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined">logout</span>
              </button>
            </div>
          </div>
        </header>

        {isMobileView && (
          <div className="bg-emerald-900 text-emerald-100 shadow-md flex overflow-x-auto no-scrollbar py-2 px-4 sticky top-20 z-30">
            {[
              { id: 'dashboard', icon: 'dashboard', label: 'Accueil' },
              { id: 'agenda', icon: 'calendar_today', label: 'Agenda' },
              { id: 'reservations', icon: 'event_seat', label: 'Résa' },
              { id: 'events', icon: 'celebration', label: 'Événements' },
              { id: 'quotes', icon: 'receipt_long', label: 'Devis' },
              { id: 'purchases', icon: 'shopping_cart', label: 'Achats' },
              { id: 'members', icon: 'group', label: 'Membres' },
              { id: 'gardens', icon: 'yard', label: 'Jardins' },
              { id: 'monitoring', icon: 'monitor_weight', label: 'Monitoring' },
              ...((userData?.role === 'admin' || userData?.role === 'superadmin') ? [
                { id: 'administration', icon: 'admin_panel_settings', label: 'Admin' }
              ] : []),
              ...(userData?.role === 'superadmin' ? [
                { id: 'settings', icon: 'settings', label: 'Params' }
              ] : [])
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center min-w-[72px] p-2 rounded-xl transition-all ${activeTab === tab.id ? 'bg-amber-400 text-emerald-900 font-bold' : 'hover:bg-emerald-800'}`}
              >
                <span className="material-symbols-outlined text-xl mb-1">{tab.icon}</span>
                <span className="text-[10px] uppercase tracking-wide">{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className={`flex-1 overflow-auto ${isMobileView ? 'p-2' : ''}`}>
          {renderContent()}
        </div>
      </main>

      {/* Floating Action Button - Contextual */}
      {userData?.role !== 'client' && (
        <button onClick={() => setIsCreateModalOpen(true)} className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-full shadow-2xl flex items-center justify-center group active:scale-90 transition-all z-50 cursor-pointer">
          <span className="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform duration-300">add</span>
        </button>
      )}

      {/* Create Modal */}
      <CreateModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        defaultTab={
          activeTab === 'events' ? 'event' :
          activeTab === 'reservations' ? 'reservation' :
          activeTab === 'quotes' ? 'quote' : 
          activeTab === 'purchases' ? 'purchase' : 'event'
        }
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-inverse-surface text-inverse-on-surface px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="material-symbols-outlined text-emerald-400">info</span>
          <p className="font-medium">{toastMessage}</p>
        </div>
      )}
    </div>
  );
}

function MonitoringContent() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[100] bg-surface-container-lowest p-8 flex flex-col h-screen overflow-hidden' : 'p-8 h-[calc(100vh-80px)] flex flex-col relative'}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold font-headline text-primary">Monitoring des Ruches</h2>
        <button 
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
          title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
        >
          <span className="material-symbols-outlined">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
        </button>
      </div>
      <div className="flex-1 bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/20 overflow-hidden">
        <iframe 
          src="https://beezbee.ddns.net/beezbee-curve/beezbee-disp-0016003202473732/index.php" 
          className="w-full h-full border-none"
          title="Monitoring Poids des Ruches"
        />
      </div>
    </div>
  );
}

function DashboardContent() {
  const [stats, setStats] = useState({
    members: 0,
    events: 0,
    reservations: 0,
    quotes: 0
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const unsubMembers = onSnapshot(collection(db, 'members'), (snap) => {
      setStats(prev => ({ ...prev, members: snap.size }));
    });
    
    const unsubEvents = onSnapshot(query(collection(db, 'events'), where('status', '==', 'validé')), (snap) => {
      setStats(prev => ({ ...prev, events: snap.size }));
      const fetchedEvents = snap.docs.map(doc => {
        const data = doc.data();
        let start = new Date();
        if (data.startDate?.toDate) start = data.startDate.toDate();
        else if (data.startDate) start = new Date(data.startDate);
        
        if (isNaN(start.getTime())) start = new Date();
        
        return { id: doc.id, date: start, type: 'event' };
      });
      setEvents(prev => [...prev.filter(e => e.type !== 'event'), ...fetchedEvents]);
    });
    
    const unsubReservations = onSnapshot(query(collection(db, 'reservations'), where('status', '==', 'validé')), (snap) => {
      setStats(prev => ({ ...prev, reservations: snap.size }));
      const fetchedReservations = snap.docs.map(doc => {
        const data = doc.data();
        let start = new Date();
        if (data.startDate?.toDate) start = data.startDate.toDate();
        else if (data.startDate) start = new Date(data.startDate);
        else if (data.createdAt?.toDate) start = data.createdAt.toDate();
        
        if (isNaN(start.getTime())) start = new Date();
        
        const location = data.locationChoice || 'rucher';
        return { id: doc.id, date: start, type: `reservation_${location}` };
      });
      setEvents(prev => [...prev.filter(e => !e.type?.startsWith('reservation')), ...fetchedReservations]);
    });
    
    const unsubQuotes = onSnapshot(query(collection(db, 'quotes'), where('status', '==', 'pending')), (snap) => {
      setStats(prev => ({ ...prev, quotes: snap.size }));
    });

    return () => {
      unsubMembers();
      unsubEvents();
      unsubReservations();
      unsubQuotes();
    };
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = addDays(startOfWeek(monthEnd, { weekStartsOn: 1 }), 6);
  const dateFormat = "d";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentMonth(addWeeks(currentMonth, 4));
  const prevMonth = () => setCurrentMonth(subWeeks(currentMonth, 4));

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[100] bg-surface-container-lowest p-8 flex flex-col h-screen overflow-auto' : 'p-8 max-w-[1600px] mx-auto w-full space-y-8 relative'}>
      {/* Hero Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-extrabold text-primary tracking-tight font-headline">Tableau de bord</h2>
          <p className="text-on-surface-variant mt-2 text-lg">Bienvenue sur votre espace d'administration.</p>
        </div>
        <button 
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
          title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
        >
          <span className="material-symbols-outlined">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat Card: Adhérents */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/20 flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
              <span className="material-symbols-outlined">group</span>
            </div>
          </div>
          <div>
            <p className="text-4xl font-extrabold text-emerald-900">{stats.members}</p>
            <p className="text-sm font-medium text-on-surface-variant mt-1">Adhérents actifs</p>
          </div>
        </div>

        {/* Stat Card: Animations */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/20 flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
              <span className="material-symbols-outlined">celebration</span>
            </div>
          </div>
          <div>
            <p className="text-4xl font-extrabold text-amber-900">{stats.events}</p>
            <p className="text-sm font-medium text-on-surface-variant mt-1">Animations rucher / jardin</p>
          </div>
        </div>

        {/* Stat Card: Réservations */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/20 flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-blue-100 text-blue-800 rounded-xl">
              <span className="material-symbols-outlined">event_seat</span>
            </div>
          </div>
          <div>
            <p className="text-4xl font-extrabold text-blue-900">{stats.reservations}</p>
            <p className="text-sm font-medium text-on-surface-variant mt-1">Réservations à venir</p>
          </div>
        </div>

        {/* Stat Card: Devis */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/20 flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-purple-100 text-purple-800 rounded-xl">
              <span className="material-symbols-outlined">receipt_long</span>
            </div>
          </div>
          <div>
            <p className="text-4xl font-extrabold text-purple-900">{stats.quotes}</p>
            <p className="text-sm font-medium text-on-surface-variant mt-1">Devis en attente</p>
          </div>
        </div>
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
              État du Système
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant italic">Base de données :</span>
                <span className="font-bold text-green-600">Connecté</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant italic">Stockage :</span>
                <span className="font-bold">2.4 GB / 5 GB</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mini Agenda */}
      <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/20">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold font-headline text-primary flex items-center gap-2">
            <span className="material-symbols-outlined">calendar_month</span>
            Agenda du tableau de bord
          </h3>
          <div className="flex items-center gap-4">
            <button onClick={prevMonth} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <span className="font-bold text-on-surface capitalize">{format(currentMonth, 'MMMM yyyy', { locale: fr })}</span>
            <button onClick={nextMonth} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
            <div key={day} className="text-center text-xs font-bold text-on-surface-variant uppercase tracking-wider py-2">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, i) => {
            const dayEvents = events.filter(e => isSameDay(e.date, day));
            const isCurrentMonth = isSameMonth(day, monthStart);
            
            return (
              <div 
                key={i} 
                className={`min-h-[80px] p-2 rounded-xl border ${isToday(day) ? 'border-primary bg-primary/5' : 'border-outline-variant/20 bg-surface-container-low'} ${!isCurrentMonth ? 'opacity-40' : ''}`}
              >
                <div className={`text-sm font-bold mb-1 ${isToday(day) ? 'text-primary' : 'text-on-surface'}`}>
                  {format(day, dateFormat)}
                </div>
                <div className="flex flex-wrap gap-1">
                  {dayEvents.map((e, idx) => (
                    <div 
                      key={idx} 
                      className={`w-3 h-3 rounded-full ${
                        e.type === 'event' ? 'bg-blue-500' : 
                        e.type === 'reservation_rucher' ? 'bg-amber-500' : 
                        'bg-lime-500'
                      }`}
                      title={e.type === 'event' ? 'Événement' : e.type === 'reservation_rucher' ? 'Animation Rucher' : 'Animation Jardin'}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="flex gap-4 mt-6 pt-4 border-t border-outline-variant/20">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs font-medium text-on-surface-variant">Événement</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-xs font-medium text-on-surface-variant">Animation Rucher</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-lime-500"></div>
            <span className="text-xs font-medium text-on-surface-variant">Animation Jardin</span>
          </div>
        </div>
      </div>
    </div>
  );
}
