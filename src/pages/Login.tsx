import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { auth, googleProvider, db } from '../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, setDoc, serverTimestamp } from 'firebase/firestore';

export default function Login() {
  const { user } = useAuth();
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [codes, setCodes] = useState({ admin: 'BUREAU2026', superadmin: 'ELBRICOL2026' });

  useEffect(() => {
    const fetchCodes = async () => {
      try {
        const docRef = doc(db, 'settings', 'accessCodes');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCodes({
            admin: docSnap.data().adminCode || 'BUREAU2026',
            superadmin: docSnap.data().superadminCode || 'ELBRICOL2026'
          });
        }
      } catch (e) {
        console.error("Erreur lors de la récupération des codes d'accès:", e);
      }
    };
    fetchCodes();
  }, []);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const profiles = [
    { id: 'superadmin', label: 'Superadministrateur', icon: 'shield_person', color: 'bg-purple-100 text-purple-800 border-purple-300' },
    { id: 'admin', label: 'Administrateur', icon: 'admin_panel_settings', color: 'bg-red-100 text-red-800 border-red-300' },
    { id: 'adherent', label: 'Adhérent', icon: 'spa', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    { id: 'nouvel_adherent', label: 'Nouvel adhérent', icon: 'person_add', color: 'bg-teal-100 text-teal-800 border-teal-300' },
    { id: 'scolaire', label: 'Scolaire', icon: 'school', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    { id: 'public', label: 'Public', icon: 'groups', color: 'bg-amber-100 text-amber-800 border-amber-300' },
    { id: 'entreprise', label: 'Entreprise', icon: 'business_center', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  ];

  const handleLogin = async () => {
    if (!selectedProfile) {
      setError("Veuillez sélectionner un profil.");
      return;
    }

    if (selectedProfile === 'admin' && accessCode !== codes.admin) {
      setError("Code d'accès administrateur incorrect.");
      return;
    }

    if (selectedProfile === 'superadmin' && accessCode !== codes.superadmin) {
      setError("Code d'accès superadministrateur incorrect.");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const currentUser = result.user;

      if (selectedProfile === 'superadmin' && currentUser.email !== 'briceamiel20@gmail.com') {
        await auth.signOut();
        setError("Ce compte Google n'a pas les droits de superadministrateur.");
        setIsLoading(false);
        return;
      }

      // Check members collection for inherited roles
      const membersRef = collection(db, 'members');
      const q = query(membersRef, where('email', '==', currentUser.email));
      const memberSnap = await getDocs(q);

      let inheritedRole = 'client';
      if (!memberSnap.empty) {
        const memberData = memberSnap.docs[0].data();
        if (memberData.role === 'admin' || memberData.role === 'superadmin') {
          inheritedRole = memberData.role;
        }
      }

      let finalRole = inheritedRole;
      if (currentUser.email === 'briceamiel20@gmail.com') {
        finalRole = 'superadmin';
      } else if (selectedProfile === 'admin' && accessCode === codes.admin) {
        finalRole = 'admin';
      }

      await setDoc(doc(db, 'users', currentUser.uid), {
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        role: finalRole,
        clientType: (selectedProfile !== 'admin' && selectedProfile !== 'superadmin') ? selectedProfile : 'public',
        lastLogin: serverTimestamp()
      }, { merge: true });

    } catch (err: any) {
      console.error(err);
      setError("Erreur lors de la connexion.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-xl max-w-2xl w-full text-center">
        <div className="w-16 h-16 bg-secondary-container rounded-2xl flex items-center justify-center text-on-secondary-container mx-auto mb-6">
          <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
        </div>
        <h1 className="text-3xl font-bold text-primary font-headline mb-2">Les jardins bourdonnants</h1>
        <p className="text-on-surface-variant mb-8">Sélectionnez votre profil pour vous connecter :</p>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => { setSelectedProfile(p.id); setError(''); }}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                selectedProfile === p.id ? p.color : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-3xl">{p.icon}</span>
              <span className="font-bold text-sm">{p.label}</span>
            </button>
          ))}
        </div>

        {(selectedProfile === 'admin' || selectedProfile === 'superadmin') && (
          <div className="mb-6 max-w-xs mx-auto animate-in fade-in slide-in-from-bottom-2">
            <label className="block text-sm font-bold mb-2 text-left">
              Code d'accès {selectedProfile === 'admin' ? 'administrateur' : 'superadministrateur'}
            </label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={accessCode}
                onChange={e => setAccessCode(e.target.value)}
                placeholder="Entrez le code"
                className="w-full p-3 pr-12 rounded-xl border border-outline-variant/30 bg-surface-container focus:ring-2 focus:ring-primary outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors p-1 rounded-full"
                title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                <span className="material-symbols-outlined text-xl">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-xl text-sm font-bold animate-in fade-in">
            {error}
          </div>
        )}

        <button 
          onClick={handleLogin}
          disabled={!selectedProfile || isLoading}
          className="w-full max-w-xs mx-auto bg-primary text-on-primary py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <span className="animate-spin material-symbols-outlined">refresh</span>
          ) : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 bg-white rounded-full p-0.5" />
              Continuer avec Google
            </>
          )}
        </button>

        <div className="mt-8 pt-8 border-t border-outline-variant/20 text-center">
          <p className="text-on-surface-variant text-sm mb-3">
            Vous souhaitez soutenir notre association ou participer à nos activités ?
          </p>
          <a 
            href="https://www.helloasso.com/associations/les-jardins-bourdonnants" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#00A388] text-white rounded-xl font-bold hover:bg-[#008f77] transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined">favorite</span>
            S'inscrire via HelloAsso
          </a>
        </div>
      </div>
    </div>
  );
}
