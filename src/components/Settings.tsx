import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { userData } = useAuth();
  const [adminCode, setAdminCode] = useState('');
  const [superadminCode, setSuperadminCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const fetchCodes = async () => {
      try {
        const docRef = doc(db, 'settings', 'accessCodes');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAdminCode(docSnap.data().adminCode || 'BUREAU2026');
          setSuperadminCode(docSnap.data().superadminCode || 'ELBRICOL2026');
        } else {
          setAdminCode('BUREAU2026');
          setSuperadminCode('ELBRICOL2026');
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des codes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCodes();
  }, []);

  const handleSave = async () => {
    if (!adminCode || !superadminCode) {
      setMessage({ type: 'error', text: 'Les codes ne peuvent pas être vides.' });
      return;
    }

    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await setDoc(doc(db, 'settings', 'accessCodes'), {
        adminCode,
        superadminCode
      }, { merge: true });
      setMessage({ type: 'success', text: 'Codes mis à jour avec succès.' });
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde. Êtes-vous superadministrateur ?' });
    } finally {
      setIsSaving(false);
    }
  };

  if (userData?.role !== 'superadmin') {
    return (
      <div className="p-8 h-[calc(100vh-80px)] flex flex-col items-center justify-center text-center">
        <span className="material-symbols-outlined text-6xl text-error mb-4">lock</span>
        <h2 className="text-2xl font-bold text-on-surface mb-2">Accès refusé</h2>
        <p className="text-on-surface-variant">Seul le superadministrateur peut accéder aux paramètres.</p>
      </div>
    );
  }

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[100] bg-surface-container-lowest p-8 flex flex-col h-screen overflow-auto' : 'p-8 h-[calc(100vh-80px)] flex flex-col overflow-y-auto relative'}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold font-headline text-primary">Paramètres</h2>
        <button 
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
          title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
        >
          <span className="material-symbols-outlined">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
        </button>
      </div>

      <div className="max-w-2xl bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/20 p-8">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">key</span>
          Codes d'accès
        </h3>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2 text-on-surface">
                Code d'accès Administrateur
              </label>
              <p className="text-xs text-on-surface-variant mb-2">
                Code requis pour se connecter avec le profil "Administrateur".
              </p>
              <input 
                type="text" 
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 text-on-surface">
                Code d'accès Superadministrateur
              </label>
              <p className="text-xs text-on-surface-variant mb-2">
                Code requis pour se connecter avec le profil "Superadministrateur".
              </p>
              <input 
                type="text" 
                value={superadminCode}
                onChange={(e) => setSuperadminCode(e.target.value)}
                className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            {message.text && (
              <div className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${
                message.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}>
                <span className="material-symbols-outlined">
                  {message.type === 'success' ? 'check_circle' : 'error'}
                </span>
                {message.text}
              </div>
            )}

            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <span className="animate-spin material-symbols-outlined">refresh</span>
              ) : (
                <span className="material-symbols-outlined">save</span>
              )}
              Enregistrer les modifications
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
