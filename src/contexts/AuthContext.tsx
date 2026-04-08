import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, query, where, collection, getDocs } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';

interface UserData {
  uid: string;
  email: string;
  displayName: string;
  role: 'superadmin' | 'admin' | 'client';
  clientType?: string;
  phone?: string;
  createdAt: any;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  impersonate: (email: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedEmail, setImpersonatedEmail] = useState<string | null>(localStorage.getItem('impersonatedEmail'));

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        unsubscribeSnapshot = onSnapshot(doc(db, 'users', currentUser.uid), async (userDoc) => {
          let currentRole = 'client';
          let clientType = 'public';
          
          if (userDoc.exists()) {
            currentRole = userDoc.data().role || 'client';
            clientType = userDoc.data().clientType || 'public';
          }

          const email = currentUser.email?.toLowerCase() || '';
          const superAdmins = ['briceamiel20@gmail.com'];
          const explicitAdmins = ['lj.lioneljulien@gmail.com', 'laetitia.ondi@hotmail.fr', 'cyril.palpacuer@gmail.com'];

          if (superAdmins.includes(email)) {
            currentRole = 'superadmin';
          } else if (explicitAdmins.includes(email) && currentRole !== 'superadmin') {
            currentRole = 'admin';
          }

          // Simulation Mode / Impersonation
          if (impersonatedEmail && (currentRole === 'superadmin' || currentRole === 'admin')) {
            try {
              const q = query(collection(db, 'users'), where('email', '==', impersonatedEmail));
              const snap = await getDocs(q);
              if (!snap.empty) {
                const targetData = snap.docs[0].data();
                setUserData({
                  uid: snap.docs[0].id,
                  email: targetData.email || '',
                  displayName: `(TEST) ${targetData.displayName || targetData.email}`,
                  role: targetData.role || 'client',
                  clientType: targetData.clientType || 'public',
                  createdAt: targetData.createdAt || serverTimestamp(),
                } as UserData);
                setLoading(false);
                return;
              }
            } catch (err) {
              console.error("Error during impersonation:", err);
            }
          }

          const finalUserData = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || '',
            role: currentRole as 'superadmin' | 'admin' | 'client',
            clientType,
            createdAt: userDoc.exists() ? userDoc.data().createdAt : serverTimestamp(),
          };

          try {
            if (!userDoc.exists() || userDoc.data().role !== currentRole) {
              await setDoc(doc(db, 'users', currentUser.uid), finalUserData, { merge: true });
            }
          } catch (err) {
            console.warn("Could not sync user role to Firestore (normal if rules restrict it):", err);
          }
          
          setUserData(finalUserData as any);
          setLoading(false);
        }, (error) => {
          console.error(`Firestore Error (users/${currentUser.uid} snapshot):`, error);
          setLoading(false);
        });
      } else {
        setUserData(null);
        setLoading(false);
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = undefined;
        }
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, [impersonatedEmail]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('impersonatedEmail');
      setImpersonatedEmail(null);
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const impersonate = async (email: string | null) => {
    if (email) {
      localStorage.setItem('impersonatedEmail', email);
    } else {
      localStorage.removeItem('impersonatedEmail');
    }
    setImpersonatedEmail(email);
    // Force data refresh by triggering the listener if possible, but state update should trigger re-render
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, login, logout, impersonate }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
