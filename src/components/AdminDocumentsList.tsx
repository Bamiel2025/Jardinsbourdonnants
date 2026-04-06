import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc as firestoreDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';

interface AdminDocument {
  id: string;
  title: string;
  type: 'ag_report' | 'statutes' | 'internal_rules';
  fileUrl: string;
  fileName: string;
  createdAt: any;
}

interface AdminDocumentsListProps {
  type: 'ag_report' | 'statutes' | 'internal_rules';
  title: string;
}

export default function AdminDocumentsList({ type, title }: AdminDocumentsListProps) {
  const { userData } = useAuth();
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadTaskRef, setUploadTaskRef] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    file: null as File | null
  });

  // STATIC DOCUMENTS CONFIGURATION
  // This allows the user to just drop files in public/documents/administration/
  const staticDocuments: Record<string, AdminDocument[]> = {
    'ag_report': [
      { id: 'static-ag', title: 'PV Assemblée Générale (Fichier Local)', type: 'ag_report', fileUrl: '/documents/administration/ag_report.pdf', fileName: 'ag_report.pdf', createdAt: null }
    ],
    'statutes': [
      { id: 'static-statutes', title: 'Statuts (Fichier Local)', type: 'statutes', fileUrl: '/documents/administration/statutes.pdf', fileName: 'statutes.pdf', createdAt: null }
    ],
    'internal_rules': [
      { id: 'static-rules', title: 'Règlement Intérieur (Fichier Local)', type: 'internal_rules', fileUrl: '/documents/administration/internal_rules.pdf', fileName: 'internal_rules.pdf', createdAt: null }
    ]
  };

  useEffect(() => {
    const q = query(
      collection(db, 'adminDocuments'),
      where('type', '==', type),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbDocs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdminDocument[];
      
      // Merge with static documents of this type
      const relevantStatic = staticDocuments[type] || [];
      setDocuments([...dbDocs, ...relevantStatic]);
      setLoading(false);
      setError(null);
    }, (err: any) => {
      console.warn("Firestore error in AdminDocumentsList:", err);
      if (err.code === 'failed-precondition') {
        const qSimple = query(
          collection(db, 'adminDocuments'),
          where('type', '==', type)
        );
        onSnapshot(qSimple, (snapshot) => {
          const dbDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AdminDocument[];
          setDocuments([...dbDocs, ...(staticDocuments[type] || [])]);
          setLoading(false);
          setError("Note: Tri désactivé (Index Firestore manquant).");
        });
      } else {
        // Fallback only to static if DB fails or is empty
        setDocuments(staticDocuments[type] || []);
        setError(err.message);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [type]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        alert('Veuillez sélectionner un fichier PDF.');
        e.target.value = '';
        return;
      }
      setFormData({ ...formData, file: selectedFile });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.file || !formData.title) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 1. Check storage config
      if (!storage.app.options.storageBucket) {
        console.error("Firebase Storage Bucket is not configured!");
        throw new Error("La configuration du stockage Firebase est manquante (Storage Bucket).");
      }

      // 2. Upload file to Storage
      const fileExtension = formData.file.name.split('.').pop();
      const fileName = `${type}_${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, `admin_documents/${type}/${fileName}`);
      
      console.log(`Starting upload to: admin_documents/${type}/${fileName}`);
      
      // Simple Promise-based upload
      await uploadBytes(storageRef, formData.file);
      
      console.log("Upload successful, getting download URL...");

      // 2. Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      // 3. Save to Firestore
      await addDoc(collection(db, 'adminDocuments'), {
        title: formData.title,
        type: type,
        fileUrl: downloadURL,
        fileName: formData.file!.name,
        createdAt: serverTimestamp()
      });
      
      setIsUploading(false);
      closeModal();
    } catch (error: any) {
      console.error("Upload/Firestore error:", error);
      setIsUploading(false);
      
      if (error?.code === 'storage/canceled') {
        // Upload was canceled by the user, do nothing
        return;
      }
      
      // Check if it's a storage unauthorized error
      if (error?.code === 'storage/unauthorized') {
        alert("Erreur : Vous n'avez pas l'autorisation d'importer des fichiers. Vérifiez que Firebase Storage est bien activé et configuré.");
      } else if (error?.code === 'storage/unknown') {
        alert("Erreur : Impossible de se connecter à Firebase Storage. Le service n'est peut-être pas activé dans votre projet Firebase.");
      } else {
        alert(`Erreur lors de l'importation : ${error.message || 'Une erreur est survenue.'}`);
        try {
          handleFirestoreError(error, OperationType.CREATE, 'adminDocuments');
        } catch (e) {
          // Ignore
        }
      }
    }
  };

  const handleDelete = async (document: AdminDocument) => {
    if (document.id.startsWith('static-')) {
      alert("Ce document est un fichier 'statique' déposé manuellement dans GitHub. Pour le supprimer, vous devez supprimer le fichier physique dans le dossier 'public/documents/administration/' et mettre à jour le code.");
      return;
    }

    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      try {
        // 1. Delete from Storage
        try {
          const url = new URL(document.fileUrl);
          const pathRegex = /o\/(.+?)\?/;
          const match = url.pathname.match(pathRegex);
          if (match && match[1]) {
            const decodedPath = decodeURIComponent(match[1]);
            const fileRef = ref(storage, decodedPath);
            await deleteObject(fileRef);
          }
        } catch (storageError) {
          console.error("Could not delete file from storage, it might have been already deleted or URL is malformed", storageError);
          // Continue to delete the Firestore document anyway
        }

        // 2. Delete from Firestore
        await deleteDoc(firestoreDoc(db, 'adminDocuments', document.id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `adminDocuments/${document.id}`);
        alert('Erreur lors de la suppression.');
      }
    }
  };

  const closeModal = () => {
    if (uploadTaskRef) {
      try {
        uploadTaskRef.cancel();
      } catch (e) {
        console.error("Error canceling upload", e);
      }
    }
    setIsModalOpen(false);
    setFormData({ title: '', file: null });
    setUploadProgress(0);
    setIsUploading(false);
    setUploadTaskRef(null);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div>
      {error && (
        <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-2xl flex items-center gap-3 text-error">
          <span className="material-symbols-outlined">error</span>
          <div className="flex-1 text-xs">
            <p className="font-bold">Erreur de récupération :</p>
            <p>{error}</p>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        {userData?.role !== 'client' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined">upload_file</span>
            Importer un PDF
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
              <th className="p-4 font-medium">Titre du document</th>
              <th className="p-4 font-medium">Nom du fichier</th>
              <th className="p-4 font-medium">Date d'ajout</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((adminDoc) => (
              <tr key={adminDoc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                <td className="p-4 font-medium text-slate-800 flex items-center gap-3">
                  <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>
                  {adminDoc.title}
                </td>
                <td className="p-4 text-slate-500 text-sm truncate max-w-[200px]" title={adminDoc.fileName}>
                  {adminDoc.fileName}
                </td>
                <td className="p-4 text-slate-500 text-sm">
                  {adminDoc.createdAt ? format(adminDoc.createdAt.toDate(), 'dd MMMM yyyy', { locale: fr }) : '...'}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a 
                      href={adminDoc.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-blue-600 bg-white rounded-full p-2 shadow-sm border border-slate-200 transition-colors"
                      title="Voir le document"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                    </a>
                    {userData?.role !== 'client' && (
                      <button 
                        onClick={() => handleDelete(adminDoc)} 
                        className="text-slate-400 hover:text-red-600 bg-white rounded-full p-2 shadow-sm border border-slate-200 transition-colors"
                        title="Supprimer"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">description</span>
                    <p>Aucun document n'a été importé dans cette section.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800">
                Importer un document
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 flex gap-3 text-amber-800 text-sm">
              <span className="material-symbols-outlined text-amber-500">info</span>
              <div>
                <p className="font-bold mb-1">Alternative "Glisser-Déposer" (Gratuit)</p>
                <p>Comme Firebase Storage n'est pas activé, vous pouvez aussi simplement déposer vos PDF dans le dossier du projet :</p>
                <code className="block mt-1 bg-white/50 p-1 rounded font-mono">public/documents/administration/</code>
                <p className="mt-1">Nommez-les précisément : <br/>
                  <span className="font-bold">ag_report.pdf</span> (Compte-rendu), <br/>
                  <span className="font-bold">statutes.pdf</span> (Statuts), <br/>
                  <span className="font-bold">internal_rules.pdf</span> (Règlement).
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 opacity-50 pointer-events-none">
              <div className="text-center p-4 bg-slate-100 rounded-lg border border-slate-200">
                <p className="text-slate-500 italic text-sm">L'importation directe via cette fenêtre nécessite l'activation de Firebase Storage (payant).</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Titre du document *</label>
                <input
                  type="text"
                  required
                  disabled={isUploading}
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="Ex: PV Assemblée Générale 2025"
                  className="w-full rounded-lg border-slate-300 border p-2 focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fichier PDF *</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg hover:border-primary transition-colors bg-slate-50">
                  <div className="space-y-1 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-400">upload_file</span>
                    <div className="flex text-sm text-slate-600 justify-center">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary-dark focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                        <span>Sélectionner un fichier</span>
                        <input 
                          id="file-upload" 
                          name="file-upload" 
                          type="file" 
                          accept="application/pdf" 
                          className="sr-only" 
                          onChange={handleFileChange}
                          disabled={isUploading}
                          required
                        />
                      </label>
                    </div>
                    <p className="text-xs text-slate-500">
                      PDF uniquement (max 10MB)
                    </p>
                  </div>
                </div>
                {formData.file && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    <span className="truncate">{formData.file.name}</span>
                  </div>
                )}
              </div>

              {isUploading && (
                <div className="w-full bg-slate-200 rounded-full h-2.5 mt-4 overflow-hidden">
                  <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              )}

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
                  disabled={isUploading || !formData.file || !formData.title}
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                      Importation...
                    </>
                  ) : (
                    'Importer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
