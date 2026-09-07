import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { auth, googleProvider, db } from '../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, setDoc, serverTimestamp } from 'firebase/firestore';

/* ------------------------------------------------------------------ */
/* Données de la page d'accueil                                        */
/* ------------------------------------------------------------------ */

const HONEYCOMB =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100' viewBox='0 0 56 100'%3E%3Cg fill='none' stroke='%23154212' stroke-opacity='0.09' stroke-width='2'%3E%3Cpath d='M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100'/%3E%3Cpath d='M28 0L28 34L0 50L0 84L28 100L56 84L56 50L28 34'/%3E%3C/g%3E%3C/svg%3E\")";

const PLACEHOLDER = 'https://placehold.co/400x400/f4f4ef/154212?text=Les+Jardins+Bourdonnants';

/** Les deux pôles de l'association — grandes images. */
const POLES = [
  {
    src: '/images/Aujardin.png',
    alt: 'Le jardin partagé des Jardins Bourdonnants',
    kicker: 'Le jardin',
    title: 'Cultiver ensemble',
    text: 'Parcelles, compost et semis : un potager mené collectivement, au rythme des saisons.',
    span: 'md:col-span-7',
    height: 'h-[320px] sm:h-[400px] md:h-[460px]',
    offset: '',
  },
  {
    src: '/images/rucher.jpg',
    alt: 'Le rucher pédagogique des Jardins Bourdonnants',
    kicker: 'Le rucher',
    title: 'Observer les abeilles',
    text: 'Des colonies suivies toute l’année, de la première fleur à la récolte du miel.',
    span: 'md:col-span-5',
    height: 'h-[280px] sm:h-[340px] md:h-[380px]',
    offset: 'md:mt-16',
  },
];

/** Images animées en défilement continu. */
const CAROUSEL = [
  { src: '/images/Aujardin2.png', title: 'Potager partagé', text: 'Chacun sa parcelle, tous au compost' },
  { src: '/images/enfantjardin.JPG', title: 'Ateliers jeunes', text: 'Scolaires et familles aux mains vertes' },
  { src: '/images/forum.jpg', title: 'Le forum', text: 'Nos rencontres et temps forts' },
  { src: '/images/Adopteuneabeille.jpg', title: 'Adopte une abeille', text: 'Parrainez une colonie du rucher' },
];

/** Abeille décorative qui traverse le bandeau. */
function Bee() {
  return (
    <svg viewBox="0 0 56 40" className="h-6 w-auto" aria-hidden="true">
      <defs>
        <clipPath id="jb-bee-body">
          <ellipse cx="24" cy="22" rx="15" ry="10" />
        </clipPath>
      </defs>
      <g clipPath="url(#jb-bee-body)">
        <ellipse cx="24" cy="22" rx="15" ry="10" fill="#feb700" />
        <rect x="20" y="10" width="4.5" height="24" fill="#1a1c19" />
        <rect x="29" y="10" width="4.5" height="24" fill="#1a1c19" />
      </g>
      <ellipse cx="24" cy="22" rx="15" ry="10" fill="none" stroke="#7c5800" strokeWidth="1.5" />
      <ellipse cx="22" cy="8" rx="8" ry="5" fill="#ffffff" fillOpacity="0.7" stroke="#c2c9bb" strokeWidth="1" />
      <ellipse cx="32" cy="9" rx="6" ry="4" fill="#ffffff" fillOpacity="0.55" stroke="#c2c9bb" strokeWidth="1" />
      <ellipse cx="43" cy="20" rx="8" ry="7.5" fill="#2f312e" />
      <circle cx="46" cy="18" r="1.6" fill="#fafaf5" />
      <path d="M45 13.5c1.5-2 3.5-3 5-3M40 12c1-2 2.5-3.2 4-3.6" stroke="#2f312e" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Reveal progressif au défilement. */
function useReveal() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.jb-reveal'));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).style.animationDelay = `${Math.min(i * 90, 360)}ms`;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);
}

/* ------------------------------------------------------------------ */

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

  useReveal();

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

  useEffect(() => {
    // Only auto-redirect if we are not actively in the login loading process
    if (user && !isLoading) {
      navigate('/', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const profiles = [
    { id: 'superadmin', label: 'Superadministrateur', icon: 'shield_person', desc: 'Configuration complète de l’association.' },
    { id: 'admin', label: 'Administrateur', icon: 'admin_panel_settings', desc: 'Membres, réservations et animations.' },
    { id: 'adherent', label: 'Adhérent', icon: 'spa', desc: 'Vos parcelles, réservations et documents.' },
    { id: 'nouvel_adherent', label: 'Nouvel adhérent', icon: 'person_add', desc: 'Créez votre espace et rejoignez-nous.' },
    { id: 'scolaire', label: 'Scolaire', icon: 'school', desc: 'Réservez une animation pour votre classe.' },
    { id: 'public', label: 'Public', icon: 'groups', desc: 'Découvrez nos activités et événements.' },
    { id: 'entreprise', label: 'Entreprise', icon: 'business_center', desc: 'Une action nature pour vos équipes.' },
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
        console.warn("Permission denied to read members collection. Fallback to existing user document role or hardcoded emails.", e);
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

  const activeProfile = profiles.find((p) => p.id === selectedProfile);
  const needsCode = selectedProfile === 'admin' || selectedProfile === 'superadmin';

  /** Navigation clavier dans la barre d'onglets (modèle ARIA tabs). */
  const onTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const idx = profiles.findIndex((p) => p.id === selectedProfile);
    const current = idx === -1 ? 0 : idx;
    let next = current;
    if (e.key === 'ArrowRight') next = (current + 1) % profiles.length;
    if (e.key === 'ArrowLeft') next = (current - 1 + profiles.length) % profiles.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = profiles.length - 1;
    setSelectedProfile(profiles[next].id);
    setError('');
    document.getElementById(`jb-tab-${profiles[next].id}`)?.focus();
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-on-surface">
      {/* Trame alvéolaire de fond */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ backgroundImage: HONEYCOMB, backgroundColor: '#fafaf5' }}
        aria-hidden="true"
      />

      {/* Abeille qui traverse le bandeau */}
      <div className="jb-bee pointer-events-none absolute left-0 top-28 -z-10 hidden sm:block" aria-hidden="true">
        <div className="jb-drift">
          <div className="jb-bob opacity-70">
            <Bee />
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-5 sm:px-8">

        {/* ---------------- 1. Nom de l'association + logo ---------------- */}
        <header className="jb-reveal pt-14 pb-12 text-center sm:pt-20 sm:pb-16">
          <img
            src="/logo.jpg"
            alt="Logo des Jardins Bourdonnants"
            className="mx-auto mb-7 h-28 w-28 rounded-full object-cover shadow-lg ring-4 ring-secondary-container/40 sm:h-36 sm:w-36"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = PLACEHOLDER;
            }}
          />

          <p className="mb-4 flex items-center justify-center gap-3 text-[0.7rem] font-bold uppercase tracking-[0.32em] text-primary/70">
            <span className="h-px w-8 bg-secondary-container" aria-hidden="true" />
            Apiculture · Jardin partagé · Nature
            <span className="h-px w-8 bg-secondary-container" aria-hidden="true" />
          </p>

          <h1
            className="font-display font-black leading-[0.92] tracking-tight text-primary"
            style={{ fontSize: 'clamp(2.6rem, 9vw, 6rem)' }}
          >
            Les Jardins
            <span className="block font-display italic text-secondary">Bourdonnants</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-on-surface-variant sm:text-lg">
            Une association qui fait vivre un jardin partagé et un rucher pédagogique,
            et transmet le goût de la nature à tous les âges.
          </p>

          <button
            type="button"
            onClick={() => document.getElementById('connexion')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-on-primary transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Accéder à mon espace
            <span className="material-symbols-outlined text-lg">arrow_downward</span>
          </button>
        </header>

        {/* ---------------- 2a. Les deux grandes images ---------------- */}
        <section className="grid grid-cols-1 gap-5 md:grid-cols-12 md:gap-6" aria-label="Nos deux pôles">
          {POLES.map((pole) => (
            <figure
              key={pole.src}
              className={`jb-reveal group relative overflow-hidden rounded-3xl bg-surface-container ${pole.span} ${pole.offset}`}
            >
              <img
                src={pole.src}
                alt={pole.alt}
                className={`w-full ${pole.height} object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105`}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = PLACEHOLDER;
                }}
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-[#0d2b0b]/85 via-[#0d2b0b]/25 to-transparent"
                aria-hidden="true"
              />
              <figcaption className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                <span className="inline-block rounded-full bg-secondary-container px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-[#3d2b00]">
                  {pole.kicker}
                </span>
                <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-[#fafaf5] sm:text-4xl">
                  {pole.title}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-[#e8e8e3]/90">{pole.text}</p>
              </figcaption>
            </figure>
          ))}
        </section>

        {/* ---------------- 2b. Défilement des images animées ---------------- */}
        <section className="mt-16 sm:mt-20" aria-label="Nos actions en images">
          <div className="jb-reveal mb-6 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl font-bold text-primary sm:text-3xl">Nos actions, toute l’année</h2>
            <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant/70 sm:block">
              Survolez pour mettre en pause
            </span>
          </div>

          <div className="jb-marquee jb-reveal overflow-hidden motion-reduce:overflow-x-auto">
            <div className="jb-marquee-track flex w-max gap-5">
              {[...CAROUSEL, ...CAROUSEL].map((item, i) => (
                <figure
                  key={`${item.src}-${i}`}
                  className="w-[240px] shrink-0 sm:w-[280px]"
                  aria-hidden={i >= CAROUSEL.length}
                >
                  <div className="overflow-hidden rounded-2xl bg-surface-container shadow-sm">
                    <img
                      src={item.src}
                      alt={i < CAROUSEL.length ? item.title : ''}
                      className="h-[150px] w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 sm:h-[170px]"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = PLACEHOLDER;
                      }}
                    />
                  </div>
                  <figcaption className="pt-3">
                    <p className="font-headline text-sm font-bold text-on-surface">{item.title}</p>
                    <p className="text-xs text-on-surface-variant">{item.text}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- 3. Onglets de connexion (en bas) ---------------- */}
        <section id="connexion" className="scroll-mt-8 pb-20 pt-16 sm:pt-20">
          <div className="jb-reveal mx-auto max-w-2xl rounded-3xl border border-outline-variant/30 bg-surface-container-lowest/95 p-6 shadow-xl backdrop-blur-sm sm:p-9">
            <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.24em] text-primary/70">Connexion</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-primary sm:text-3xl">
              Choisissez votre profil
            </h2>

            {/* Barre d'onglets */}
            <div
              role="tablist"
              aria-label="Profil de connexion"
              onKeyDown={onTabKeyDown}
              className="mt-6 flex gap-1 overflow-x-auto border-b border-outline-variant/40 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {profiles.map((p, i) => {
                const active = selectedProfile === p.id;
                return (
                  <button
                    key={p.id}
                    role="tab"
                    id={`jb-tab-${p.id}`}
                    aria-selected={active}
                    aria-controls="jb-profil-panel"
                    tabIndex={active || (selectedProfile === null && i === 0) ? 0 : -1}
                    onClick={() => { setSelectedProfile(p.id); setError(''); }}
                    className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      active ? 'text-primary' : 'text-on-surface-variant/70 hover:text-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">{p.icon}</span>
                    {p.label}
                    <span
                      className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        active ? 'scale-x-100' : 'scale-x-0'
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>

            {/* Panneau de l'onglet actif */}
            <div
              role="tabpanel"
              id="jb-profil-panel"
              aria-live="polite"
              className="mt-6 min-h-[4.5rem]"
            >
              {activeProfile ? (
                <p className="animate-in fade-in text-sm text-on-surface-variant">
                  <span className="font-bold text-on-surface">{activeProfile.label}</span> — {activeProfile.desc}
                </p>
              ) : (
                <p className="text-sm text-on-surface-variant">
                  Sélectionnez un onglet ci-dessus, puis connectez-vous avec votre compte Google.
                </p>
              )}
            </div>

            {needsCode && (
              <div className="mb-6 max-w-xs animate-in fade-in slide-in-from-bottom-2">
                <label className="mb-2 block text-left text-sm font-bold" htmlFor="jb-access-code">
                  Code d’accès {selectedProfile === 'admin' ? 'administrateur' : 'superadministrateur'}
                </label>
                <div className="relative">
                  <input
                    id="jb-access-code"
                    type={showPassword ? 'text' : 'password'}
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Entrez le code"
                    className="w-full rounded-xl border border-outline-variant/40 bg-surface-container p-3 pr-12 outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-on-surface-variant transition-colors hover:text-primary"
                    title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 rounded-xl bg-error-container p-4 text-sm font-bold text-on-error-container animate-in fade-in">
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={!selectedProfile || isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary py-4 font-bold text-on-primary transition-all duration-200 hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading && !showTestMode ? (
                <span className="material-symbols-outlined animate-spin">refresh</span>
              ) : (
                <>
                  <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="Google"
                    className="h-5 w-5 rounded-full bg-white p-0.5"
                  />
                  Continuer avec Google
                </>
              )}
            </button>

            {/* Mode Simulation */}
            <div className="mt-6 border-t border-outline-variant/20 pt-4">
              <button
                onClick={() => setShowTestMode(!showTestMode)}
                className="mx-auto flex items-center gap-1 text-xs font-medium text-on-surface-variant/60 transition-colors hover:text-primary"
              >
                <span className="material-symbols-outlined text-sm">{showTestMode ? 'expand_less' : 'construction'}</span>
                {showTestMode ? 'Masquer le mode simu' : 'Mode simulation (Admin uniquement)'}
              </button>

              {showTestMode && (
                <div className="mx-auto mt-4 max-w-xs rounded-2xl border border-primary/20 bg-surface-container p-4 animate-in fade-in slide-in-from-top-2">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Test rendu membre</p>
                  <div className="space-y-3">
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="Email du membre à tester"
                      className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                    <input
                      type="password"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Votre code superadmin"
                      className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={handleTestLogin}
                      disabled={isLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary py-2 text-sm font-bold text-on-secondary transition-all hover:brightness-110"
                    >
                      {isLoading ? (
                        <span className="material-symbols-outlined animate-spin text-sm">refresh</span>
                      ) : (
                        'Simuler la connexion'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
