import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

const locales = {
  'fr': fr,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

/** Type d'événement -> libellé + couleur affiché dans l'agenda. */
const EVENT_TYPE_META: Record<string, { label: string; emoji: string; color: string; border: string }> = {
  event_reunion:    { label: 'Réunion',    emoji: '🤝', color: '#a855f7', border: '#7e22ce' },
  event_jardin:     { label: 'Jardin',     emoji: '🌻', color: '#16a34a', border: '#166534' },
  event_apiculture: { label: 'Apiculture', emoji: '🐝', color: '#ea580c', border: '#9a3412' },
  event_autre:      { label: 'Autre',      emoji: '📅', color: '#3b82f6', border: '#1d4ed8' },
  event:            { label: 'Événement',  emoji: '📅', color: '#3b82f6', border: '#1d4ed8' },
};

const KNOWN_EVENT_TYPES = ['reunion', 'jardin', 'apiculture', 'autre'];

export default function Agenda() {
  const { userData } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const eventsQuery = query(collection(db, 'events'));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const fetchedEvents = snapshot.docs
        .filter(doc => doc.data().status === 'validé')
        .map(doc => {
          const data = doc.data();
          let start = data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : new Date());
          let end = data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : new Date());

          if (isNaN(start.getTime())) start = new Date();
          if (isNaN(end.getTime())) end = new Date(start.getTime() + 60 * 60 * 1000);

          const rawType = typeof data.type === 'string' ? data.type : '';
          const calType = KNOWN_EVENT_TYPES.includes(rawType) ? `event_${rawType}` : 'event';
          const meta = EVENT_TYPE_META[calType];

          return {
            id: doc.id,
            title: `${meta.emoji} ${data.title || 'Événement'}`,
            start: start,
            end: end,
            allDay: data.allDay || false,
            type: calType,
            typeLabel: meta.label,
            lieu: data.location || data.lieu || '',
            description: data.description || '',
            collection: 'events',
            notes: data.notes || ''
          };
        });

      setEvents(prev => {
        const otherEvents = prev.filter(e => !String(e.type).startsWith('event'));
        return [...otherEvents, ...fetchedEvents];
      });
    });

    const reservationsQuery = query(collection(db, 'reservations'));
    const unsubscribeReservations = onSnapshot(reservationsQuery, (snapshot) => {
      const fetchedReservations = snapshot.docs
        .filter(doc => doc.data().status === 'validé')
        .map(doc => {
          const data = doc.data();
          let start = new Date();
          if (data.startDate?.toDate) start = data.startDate.toDate();
          else if (data.startDate) start = new Date(data.startDate);
          else if (data.createdAt?.toDate) start = data.createdAt.toDate();
          
          if (isNaN(start.getTime())) start = new Date();
          
          let end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
          if (data.endDate?.toDate) end = data.endDate.toDate();
          else if (data.endDate) end = new Date(data.endDate);

          if (isNaN(end.getTime())) end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

          const location = data.locationChoice || 'rucher';
          return {
            id: doc.id,
            title: `${location === 'rucher' ? '🐝 Animation Rucher' : '🌻 Animation Jardin'} : ${data.fullName || 'N/A'}`,
            start: start,
            end: end,
            allDay: false,
            type: `reservation_${location}`,
            typeLabel: location === 'rucher' ? 'Animation Rucher' : 'Animation Jardin',
            lieu: location === 'rucher' ? 'Rucher' : 'Jardin',
            description: data.description || '',
            collection: 'reservations',
            notes: data.notes || ''
          };
        });

      setEvents(prev => {
        const otherEvents = prev.filter(e => !e.type?.startsWith('reservation'));
        return [...otherEvents, ...fetchedReservations];
      });
    });

    return () => {
      unsubscribeEvents();
      unsubscribeReservations();
    };
  }, []);

  const eventStyleGetter = (event: any) => {
    let backgroundColor = '#10b981'; // default emerald
    let borderColor = '#047857';

    if (event.type === 'reservation_rucher') {
      backgroundColor = '#f59e0b'; // amber-500
      borderColor = '#b45309'; // amber-700
    } else if (event.type === 'reservation_jardin') {
      backgroundColor = '#84cc16'; // lime-500
      borderColor = '#4d7c0f'; // lime-700
    } else if (typeof event.type === 'string' && event.type.startsWith('event')) {
      const meta = EVENT_TYPE_META[event.type] || EVENT_TYPE_META.event;
      backgroundColor = meta.color;
      borderColor = meta.border;
    }

    return {
      style: {
        backgroundColor,
        borderColor,
        color: 'white',
        borderRadius: '6px',
        border: `1px solid ${borderColor}`,
        display: 'block',
        fontWeight: '600',
        padding: '2px 6px',
        fontSize: '0.85rem'
      }
    };
  };

  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<any>('month');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesContent, setNotesContent] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const handleSelectEvent = (event: any) => {
    setSelectedEvent(event);
    setNotesContent(event.notes || '');
    setIsEditingNotes(false);
  };

  const closeEventModal = () => {
    setSelectedEvent(null);
    setIsEditingNotes(false);
  };

  const handleSaveNotes = async () => {
    if (!selectedEvent) return;
    setIsSavingNotes(true);
    try {
      const collectionName = selectedEvent.collection === 'reservations' ? 'reservations' : 'events';
      const docRef = doc(db, collectionName, selectedEvent.id);
      await updateDoc(docRef, { notes: notesContent });

      // Update local state to reflect changes immediately
      setSelectedEvent({ ...selectedEvent, notes: notesContent });
      setEvents(prev => prev.map(e => e.id === selectedEvent.id ? { ...e, notes: notesContent } : e));

      setIsEditingNotes(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${selectedEvent.collection === 'reservations' ? 'reservations' : 'events'}/${selectedEvent.id}`);
    } finally {
      setIsSavingNotes(false);
    }
  };

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[100] bg-surface-container-lowest p-8 flex flex-col h-screen overflow-hidden' : 'p-8 h-[calc(100vh-80px)] flex flex-col relative'}>
      <div className="flex justify-between items-end mb-6">
        <div className="flex items-center gap-6">
          <h2 className="text-3xl font-bold font-headline text-primary">Agenda</h2>
          <div className="flex items-center gap-2 bg-surface-container-lowest p-2 rounded-xl shadow-sm border border-outline-variant/20">
            <span className="material-symbols-outlined text-on-surface-variant">calendar_month</span>
            <input 
              type="month" 
              value={format(currentDate, 'yyyy-MM')} 
              onChange={(e) => {
                if (e.target.value) {
                  const [year, month] = e.target.value.split('-');
                  const newDate = new Date(currentDate);
                  newDate.setFullYear(parseInt(year), parseInt(month) - 1);
                  setCurrentDate(newDate);
                }
              }}
              className="bg-transparent border-none focus:ring-0 text-on-surface font-bold cursor-pointer outline-none"
            />
          </div>
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            <span className="material-symbols-outlined">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-4 bg-surface-container-lowest p-3 rounded-xl shadow-sm border border-outline-variant/20">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500 border border-amber-700"></div>
            <span className="text-sm font-medium text-on-surface-variant">Animation Rucher</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-lime-500 border border-lime-700"></div>
            <span className="text-sm font-medium text-on-surface-variant">Animation Jardin</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#a855f7', borderColor: '#7e22ce' }}></div>
            <span className="text-sm font-medium text-on-surface-variant">Réunion</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#16a34a', borderColor: '#166534' }}></div>
            <span className="text-sm font-medium text-on-surface-variant">Jardin</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#ea580c', borderColor: '#9a3412' }}></div>
            <span className="text-sm font-medium text-on-surface-variant">Apiculture</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500 border border-blue-700"></div>
            <span className="text-sm font-medium text-on-surface-variant">Autre</span>
          </div>
        </div>
      </div>
      <div className="flex-1 bg-surface-container-lowest p-6 rounded-3xl shadow-sm border border-outline-variant/20">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          culture="fr"
          views={['month', 'week', 'day', 'agenda']}
          date={currentDate}
          onNavigate={(newDate) => setCurrentDate(newDate)}
          view={currentView}
          onView={(newView) => setCurrentView(newView)}
          onSelectEvent={handleSelectEvent}
          messages={{
            next: "Suivant",
            previous: "Précédent",
            today: "Aujourd'hui",
            month: "Mois",
            week: "Semaine",
            day: "Jour",
            agenda: "Planning",
            noEventsInRange: "Aucun événement dans cette période."
          }}
          eventPropGetter={eventStyleGetter}
          style={{ height: '100%' }}
          className="font-sans"
        />
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low">
              <h3 className="text-xl font-bold font-headline text-primary">Détails de l'événement</h3>
              <button onClick={closeEventModal} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1">Titre</p>
                <p className="text-lg font-medium text-on-surface">{selectedEvent.title}</p>
              </div>
              {selectedEvent.typeLabel && (
                <div>
                  <p className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1">Type</p>
                  <p className="text-on-surface font-medium">{selectedEvent.typeLabel}</p>
                </div>
              )}
              {selectedEvent.lieu && (
                <div>
                  <p className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1">Lieu</p>
                  <p className="text-on-surface">{selectedEvent.lieu}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1">Début</p>
                <p className="text-on-surface">{selectedEvent.start.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1">Fin</p>
                <p className="text-on-surface">{selectedEvent.end.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}</p>
              </div>
              
              <div className="mt-6 pt-6 border-t border-outline-variant/20">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">edit_note</span>
                    Pense-bête (Matériel, Contacts...)
                  </p>
                  {userData?.role !== 'client' && !isEditingNotes && (
                    <button 
                      onClick={() => setIsEditingNotes(true)}
                      className="text-primary hover:text-primary/80 text-sm font-bold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                      Modifier
                    </button>
                  )}
                </div>
                
                {isEditingNotes ? (
                  <div className="space-y-3 animate-in fade-in">
                    <textarea
                      value={notesContent}
                      onChange={(e) => setNotesContent(e.target.value)}
                      placeholder="Ex: Prévoir 3 combinaisons, contacter Jean au 06..."
                      className="w-full h-32 p-3 bg-surface-container rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => {
                          setIsEditingNotes(false);
                          setNotesContent(selectedEvent.notes || '');
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                      >
                        Annuler
                      </button>
                      <button 
                        onClick={handleSaveNotes}
                        disabled={isSavingNotes}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSavingNotes ? (
                          <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                        ) : (
                          <span className="material-symbols-outlined text-sm">save</span>
                        )}
                        Enregistrer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-surface-container p-4 rounded-xl min-h-[80px] whitespace-pre-wrap">
                    {selectedEvent.notes ? (
                      <span className="text-on-surface">{selectedEvent.notes}</span>
                    ) : (
                      <span className="text-on-surface-variant italic">Aucun pense-bête pour cet événement.</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-outline-variant/20 bg-surface-container-low flex justify-end">
              <button onClick={closeEventModal} className="px-6 py-2 rounded-xl font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
