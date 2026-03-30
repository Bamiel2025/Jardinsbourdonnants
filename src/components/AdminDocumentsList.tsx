import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadTaskRef, setUploadTaskRef] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    file: null as File | null
  });

  useEffect(() => {
    const q = query(
      collection(db, 'adminDocuments'),
      where('type', '==', type),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdminDocument[];
      
      setDocuments(docsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'adminDocuments');
      setLoading(false);
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
      // 1. Upload file to Storage
      const fileExtension = formData.file.name.split('.').pop();
      const fileName = `${type}_${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, `admin_documents/${type}/${fileName}`);
      
      const uploadTask = uploadBytesResumable(storageRef, formData.file);
      setUploadTaskRef(uploadTask);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload error:", error);
          if (error.code !== 'storage/canceled') {
            setIsUploading(false);
            alert(`Erreur d'importation : ${error.message}`);
          }
        }
      );

      // Wait for upload to complete
      await uploadTask;

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
      setUploadTaskRef(null);
      closeModal();
    } catch (error: any) {
      console.error("Upload/Firestore error:", error);
      setIsUploading(false);
      setUploadTaskRef(null);
      
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

  const handleDelete = async (doc: AdminDocument) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      try {
        // 1. Delete from Storage
        // Extract file path from URL (this is a simplified approach, might need refinement depending on exact URL structure)
        try {
          const url = new URL(doc.fileUrl);
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
        await deleteDoc(doc(db, 'adminDocuments', doc.id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `adminDocuments/${doc.id}`);
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
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined">upload_file</span>
          Importer un PDF
        </button>
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
            {documents.map((doc) => (
              <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                <td className="p-4 font-medium text-slate-800 flex items-center gap-3">
                  <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>
                  {doc.title}
                </td>
                <td className="p-4 text-slate-500 text-sm truncate max-w-[200px]" title={doc.fileName}>
                  {doc.fileName}
                </td>
                <td className="p-4 text-slate-500 text-sm">
                  {doc.createdAt ? format(doc.createdAt.toDate(), 'dd MMMM yyyy', { locale: fr }) : '...'}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a 
                      href={doc.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-blue-600 bg-white rounded-full p-2 shadow-sm border border-slate-200 transition-colors"
                      title="Voir le document"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                    </a>
                    <button 
                      onClick={() => handleDelete(doc)} 
                      className="text-slate-400 hover:text-red-600 bg-white rounded-full p-2 shadow-sm border border-slate-200 transition-colors"
                      title="Supprimer"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
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

            <form onSubmit={handleSubmit} className="space-y-4">
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
