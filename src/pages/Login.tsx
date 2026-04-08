import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { auth, googleProvider, db } from '../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';

export default function Login() {
  const { user, impersonate } = useAuth();
  const navigate = useNavigate();
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [codes, setCodes] = useState({ admin: 'BUREAU2026', superadmin: 'ELBRICOL2026' });
  
  // Simulation Mode State
  const [showTestMode, setShowTestMode] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // Rucher Registration State
  const [showRucherRegistration, setShowRucherRegistration] = useState(false);
  const [rucherForm, setRucherForm] = useState({ nom: '', telephone: '', email: '', adultes: 1, enfants: 0, heure: '9h30' });
  const [rucherSubmitting, setRucherSubmitting] = useState(false);
  const [rucherSuccess, setRucherSuccess] = useState(false);

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
        console.error("Firestore Error (settings/accessCodes):", e);
      }
    };
    fetchCodes();
  }, []);

  useEffect(() => {
    // Only auto-redirect if we are not actively in the login loading process
    if (user && !isLoading) {
      navigate('/', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleRucherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rucherForm.adultes + rucherForm.enfants > 20) {
      setError("Le nombre maximum est de 20 participants par visite (10 adultes + 10 enfants).");
      return;
    }
    if (rucherForm.adultes > 10 || rucherForm.enfants > 10) {
      setError("Maximum 10 adultes et 10 enfants par groupe.");
      return;
    }
    setRucherSubmitting(true);
    setError('');
    try {
      await addDoc(collection(db, 'rucher_visits_2026'), {
        ...rucherForm,
        status: 'en cours de validation',
        createdAt: serverTimestamp()
      });
      setRucherSuccess(true);
      setShowRucherRegistration(false);
    } catch (err: any) {
      console.error("Firestore Error (rucher_visits_2026 create):", err);
      setError("Erreur lors de l'inscription. Détail: " + (err.message || "Permission refusée"));
    } finally {
      setRucherSubmitting(false);
    }
  };

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
      let dbRole = 'client';
      try {
        const membersRef = collection(db, 'members');
        const q = query(membersRef, where('email', '==', currentUser.email));
        const memberSnap = await getDocs(q);

        if (!memberSnap.empty) {
          const memberData = memberSnap.docs[0].data();
          if (memberData.role === 'admin' || memberData.role === 'superadmin') {
            dbRole = memberData.role;
          }
        }
      } catch (e) {
        console.warn("Firestore Warning (members query): Permission denied. This might be normal for new users.", e);
      }

      // Check existing user doc to not downgrade existing admins/superadmins who choose another profile
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
         const existingRole = userDocSnap.data().role;
         if (existingRole === 'superadmin') dbRole = 'superadmin';
         else if (existingRole === 'admin' && dbRole !== 'superadmin') dbRole = 'admin';
      }

      let finalRole = dbRole;
      
      const email = currentUser.email?.toLowerCase() || '';
      const superAdmins = ['briceamiel20@gmail.com'];
      const explicitAdmins = ['lj.lioneljulien@gmail.com', 'laetitia.ondi@hotmail.fr', 'cyril.palpacuer@gmail.com'];

      // Override or confirm with specific log-in
      if (superAdmins.includes(email)) {
        finalRole = 'superadmin';
      } else if (explicitAdmins.includes(email) && finalRole !== 'superadmin') {
        finalRole = 'admin';
      } else if (selectedProfile === 'admin' && accessCode === codes.admin) {
        // Upgrade to admin if code provided
        if (finalRole !== 'superadmin') finalRole = 'admin';
      }

      // Before updating, get existing previous login
      const previousLogin = userDocSnap.exists() ? userDocSnap.data().lastLogin : serverTimestamp();

      await setDoc(userDocRef, {
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        role: finalRole,
        clientType: (selectedProfile !== 'admin' && selectedProfile !== 'superadmin') ? selectedProfile : 'public',
        lastLogin: serverTimestamp(),
        previousLogin: previousLogin
      }, { merge: true });

      // After updating the document, force navigation
      navigate('/dashboard', { replace: true });

    } catch (err: any) {
      console.error(err);
      setError("Erreur lors de la connexion.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestLogin = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      setError("Veuillez entrer l'email d'un membre à tester.");
      return;
    }

    if (accessCode !== codes.superadmin) {
      setError("Le code superadministrateur est requis pour le mode simulation.");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 1. Authenticate as superadmin first (required for security and DB access)
      const result = await signInWithPopup(auth, googleProvider);
      const currentUser = result.user;

      if (currentUser.email !== 'briceamiel20@gmail.com') {
        await auth.signOut();
        setError("Seul le compte briceamiel20@gmail.com peut utiliser le mode simulation.");
        setIsLoading(false);
        return;
      }

      // 2. Set impersonation in AuthContext
      await impersonate(testEmail);
      
      // 3. Navigate
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors de la simulation.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-xl max-w-2xl w-full text-center">
        <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-lg border border-outline-variant/20 mx-auto mb-6 transition-transform hover:scale-105">
          <img 
            src="/logo.jpg" 
            alt="Les jardins bourdonnants" 
            className="w-full h-full object-contain p-2"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "https://placehold.co/200x200/ffffff/065f46?text=Logo";
            }}
          />
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
          {isLoading && !showTestMode ? (
            <span className="animate-spin material-symbols-outlined">refresh</span>
          ) : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 bg-white rounded-full p-0.5" />
              Continuer avec Google
            </>
          )}
        </button>

        {/* Mode Simulation Section */}
        <div className="mt-6 border-t border-outline-variant/10 pt-4">
          <button 
            onClick={() => setShowTestMode(!showTestMode)}
            className="text-xs font-medium text-on-surface-variant/60 hover:text-primary transition-colors flex items-center gap-1 mx-auto"
          >
            <span className="material-symbols-outlined text-sm">{showTestMode ? 'expand_less' : 'construction'}</span>
            {showTestMode ? 'Masquer le mode simu' : 'Mode simulation (Admin uniquement)'}
          </button>

          {showTestMode && (
            <div className="mt-4 p-4 bg-surface-container rounded-2xl animate-in fade-in slide-in-from-top-2 border border-primary/20 max-w-xs mx-auto">
              <p className="text-xs text-primary font-bold mb-3 uppercase tracking-wider">Test rendu membre</p>
              <div className="space-y-3">
                <input 
                  type="email" 
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="Email du membre à tester"
                  className="w-full p-2 text-sm rounded-lg border border-outline-variant/30 bg-surface-container-lowest outline-none focus:ring-1 focus:ring-primary"
                />
                <input 
                  type="password" 
                  value={accessCode}
                  onChange={e => setAccessCode(e.target.value)}
                  placeholder="Votre code superadmin"
                  className="w-full p-2 text-sm rounded-lg border border-outline-variant/30 bg-surface-container-lowest outline-none focus:ring-1 focus:ring-primary"
                />
                <button 
                  onClick={handleTestLogin}
                  disabled={isLoading}
                  className="w-full bg-secondary text-on-secondary py-2 rounded-lg font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <span className="animate-spin material-symbols-outlined text-sm">refresh</span>
                  ) : (
                    'Simuler la connexion'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pt-8 border-t border-outline-variant/20 flex flex-col gap-4">
          <button
            onClick={() => setShowRucherRegistration(true)}
            className="w-full bg-amber-400 text-amber-900 py-4 rounded-xl font-bold hover:bg-amber-500 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">hive</span>
            Inscription Journée aux Jardins Bourdonnants (7 Juin 2026)
          </button>

          <a 
            href="https://www.helloasso.com/associations/les-jardins-bourdonnants" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full bg-[#00A388] text-white py-4 rounded-xl font-bold hover:bg-[#008f77] transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">favorite</span>
            S'inscrire à l'association via HelloAsso
          </a>
        </div>
      </div>

      {showRucherRegistration && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-amber-100">
              <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2">
                <span className="material-symbols-outlined">event</span>
                Visite du 7 Juin 2026
              </h2>
              <button onClick={() => setShowRucherRegistration(false)} className="text-amber-900 hover:bg-amber-200 p-2 rounded-full transition-colors cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <p className="text-sm text-on-surface-variant mb-6 bg-surface-container p-4 rounded-xl">
                Inscrivez-vous pour la visite de la ruche pédagogique (5€ par personne, sur place). <br/>
                <b>Attention :</b> Groupes limités à 10 adultes et 10 enfants par tranche horaire.
              </p>

              <form onSubmit={handleRucherSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-1 text-on-surface">Nom / Prénom</label>
                  <input required type="text" value={rucherForm.nom} onChange={e => setRucherForm({...rucherForm, nom: e.target.value})} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1 text-on-surface">Téléphone</label>
                    <input required type="tel" value={rucherForm.telephone} onChange={e => setRucherForm({...rucherForm, telephone: e.target.value})} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container focus:ring-2 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 text-on-surface">Email (optionnel)</label>
                    <input type="email" value={rucherForm.email} onChange={e => setRucherForm({...rucherForm, email: e.target.value})} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container focus:ring-2 focus:ring-primary outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1 text-on-surface">Adultes (Max 10)</label>
                    <input required type="number" min="0" max="10" value={rucherForm.adultes} onChange={e => setRucherForm({...rucherForm, adultes: parseInt(e.target.value) || 0})} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container focus:ring-2 focus:ring-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 text-on-surface">Enfants (Max 10)</label>
                    <input required type="number" min="0" max="10" value={rucherForm.enfants} onChange={e => setRucherForm({...rucherForm, enfants: parseInt(e.target.value) || 0})} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container focus:ring-2 focus:ring-primary outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1 text-on-surface">Plage horaire</label>
                  <select value={rucherForm.heure} onChange={e => setRucherForm({...rucherForm, heure: e.target.value})} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container focus:ring-2 focus:ring-primary outline-none cursor-pointer">
                    <option value="9h30">9h30</option>
                    <option value="10h30">10h30</option>
                    <option value="11h30">11h30</option>
                    <option value="14h30">14h30</option>
                    <option value="15h30">15h30</option>
                    <option value="16h30">16h30</option>
                  </select>
                </div>

                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex justify-between items-center">
                  <span className="text-amber-900 font-bold">Total à régler sur place :</span>
                  <span className="text-xl font-black text-amber-900">{(rucherForm.adultes + rucherForm.enfants) * 5} €</span>
                </div>
                
                {error && (
                  <div className="p-3 bg-red-100 text-red-800 rounded-xl text-sm font-bold animate-in fade-in">
                    {error}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={rucherSubmitting}
                  className="w-full bg-amber-400 text-amber-900 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-amber-500 transition-colors disabled:opacity-50 mt-6"
                >
                  {rucherSubmitting ? 'Envoi en cours...' : 'Valider mon inscription'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {rucherSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-inverse-surface text-inverse-on-surface px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="material-symbols-outlined text-amber-400">check_circle</span>
          <p className="font-medium">Inscription envoyée ! Paimement de 5€/personne sur place.</p>
          <button onClick={() => setRucherSuccess(false)} className="ml-4 text-inverse-on-surface/70 hover:text-white">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

    </div>
  );
}
