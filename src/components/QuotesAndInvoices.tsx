import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { jsPDF } from 'jspdf';
import InvoiceEditor from './InvoiceEditor';
import { useAuth } from '../contexts/AuthContext';

export default function QuotesAndInvoices() {
  const { userData } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'quotes' | 'invoices'>('quotes');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorType, setEditorType] = useState<'invoice' | 'quote'>('invoice');
  const [editingItem, setEditingItem] = useState<any>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const q = query(collection(db, activeTab), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [activeTab]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, activeTab, id), { status });
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
    }
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      try {
        await deleteDoc(doc(db, activeTab, itemToDelete));
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
      }
      setItemToDelete(null);
    }
  };

  const generateInvoiceFromQuote = async (quote: any) => {
    try {
      const { id, ...quoteData } = quote;
      // Create invoice
      await addDoc(collection(db, 'invoices'), {
        ...quoteData,
        status: 'pending', // new invoice is pending payment
        createdAt: serverTimestamp(),
        quoteId: id
      });
      // Update quote status
      await updateDoc(doc(db, 'quotes', id), { status: 'facturé' });
      showToast("Facture générée avec succès !");
    } catch (error) {
      console.error("Erreur lors de la génération de la facture:", error);
    }
  };

  const generatePDF = (item: any) => {
    const doc = new jsPDF();
    const typeLabel = activeTab === 'quotes' ? 'Devis' : 'Facture';
    
    doc.setFontSize(24);
    doc.setTextColor(20, 83, 45); // emerald-900
    doc.text(`${typeLabel} - Les jardins bourdonnants`, 20, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    const dateStr = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 
                    item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A';
    doc.text(`Date : ${dateStr}`, 20, 40);
    doc.text(`Nom : ${item.fullName || 'N/A'}`, 20, 50);
    doc.text(`Email : ${item.email || 'N/A'}`, 20, 60);
    doc.text(`Lieu : ${item.locationChoice === 'rucher' ? 'Animation au rucher' : 'Animation au jardin'}`, 20, 70);
    
    if (item.details?.audienceType) {
      doc.text(`Public : ${item.details.audienceType.charAt(0).toUpperCase() + item.details.audienceType.slice(1)}`, 20, 80);
      doc.text(`Participants : ${item.details.participantsCount || 'N/A'}`, 100, 80);
    }
    
    doc.text(`Description :`, 20, 100);
    doc.setFontSize(11);
    const splitDesc = doc.splitTextToSize(item.description || 'N/A', 170);
    doc.text(splitDesc, 20, 110);
    
    doc.setFontSize(16);
    doc.setTextColor(20, 83, 45);
    doc.text(`Montant Total : ${item.amount || 0} €`, 20, 150);
    
    doc.save(`${typeLabel}_${item.fullName?.replace(/\s+/g, '_') || 'document'}.pdf`);
  };

  const handleSaveDocument = async (data: any) => {
    try {
      if (editingItem) {
        // Update existing document
        await updateDoc(doc(db, activeTab, editingItem.id), {
          fullName: data.clientName,
          description: data.items.map((i: any) => i.designation).join(', '),
          amount: data.totalTTC,
          documentData: data
        });
        showToast(`${editorType === 'quote' ? 'Devis' : 'Facture'} mis(e) à jour avec succès !`);
      } else {
        // Create new document
        await addDoc(collection(db, editorType === 'quote' ? 'quotes' : 'invoices'), {
          fullName: data.clientName,
          description: data.items.map((i: any) => i.designation).join(', '),
          amount: data.totalTTC,
          status: editorType === 'quote' ? 'en attente de validation' : 'pending',
          createdAt: serverTimestamp(),
          documentData: data
        });
        showToast(`${editorType === 'quote' ? 'Devis' : 'Facture'} enregistré(e) avec succès !`);
      }
      setIsEditorOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      showToast("Erreur lors de l'enregistrement.");
    }
  };

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[100] bg-surface-container-lowest p-8 flex flex-col h-screen overflow-hidden' : 'p-8 h-[calc(100vh-80px)] flex flex-col relative'}>
      {toastMessage && (
        <div className="absolute top-4 right-8 bg-surface-container-highest text-on-surface px-6 py-3 rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-top-4">
          {toastMessage}
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold font-headline text-primary">Devis & Factures</h2>
        <div className="flex items-center gap-4">
          <div className="flex gap-2 bg-surface-container-low p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('quotes')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'quotes' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              Devis
            </button>
            <button 
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'invoices' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              Factures
            </button>
          </div>
          {userData?.role !== 'client' && (
            <>
              <button 
                onClick={() => {
                  setEditorType('quote');
                  setEditingItem(null);
                  setIsEditorOpen(true);
                }}
                className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 bg-amber-600 text-white shadow-md hover:bg-amber-700 transition-colors"
              >
                <span className="material-symbols-outlined">add</span>
                Créer un devis libre
              </button>
              <button 
                onClick={() => {
                  setEditorType('invoice');
                  setEditingItem(null);
                  setIsEditorOpen(true);
                }}
                className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 bg-primary text-on-primary shadow-md hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined">add</span>
                Créer une facture libre
              </button>
            </>
          )}
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            <span className="material-symbols-outlined">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/20 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-sm uppercase tracking-wider">
                <th className="p-4 font-bold">Date</th>
                <th className="p-4 font-bold">Nom</th>
                <th className="p-4 font-bold">Description</th>
                <th className="p-4 font-bold">Montant</th>
                <th className="p-4 font-bold">Statut</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                  <td className="p-4 text-sm">{item.createdAt?.toDate().toLocaleDateString() || 'N/A'}</td>
                  <td className="p-4 font-bold">{item.fullName || 'N/A'}</td>
                  <td className="p-4 text-sm text-on-surface-variant max-w-xs truncate">{item.description || 'N/A'}</td>
                  <td className="p-4 font-black text-primary">{item.amount || 0} €</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.status === 'validé' || item.status === 'paid' || item.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                      item.status === 'en attente de validation' || item.status === 'pending' || item.status === 'unpaid' ? 'bg-amber-100 text-amber-800' :
                      item.status === 'facturé' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.status || 'en attente de validation'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      {userData?.role !== 'client' && activeTab === 'quotes' && item.status !== 'facturé' && (
                        <>
                          <button 
                            onClick={() => {
                              setEditorType('quote');
                              setEditingItem(item);
                              setIsEditorOpen(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button 
                            onClick={() => updateStatus(item.id, 'en attente de validation')}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Mettre en attente"
                          >
                            <span className="material-symbols-outlined text-sm">schedule</span>
                          </button>
                          <button 
                            onClick={() => updateStatus(item.id, 'validé')}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Valider"
                          >
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                          </button>
                        </>
                      )}
                      
                      {userData?.role !== 'client' && activeTab === 'quotes' && item.status === 'validé' && (
                        <button 
                          onClick={() => generateInvoiceFromQuote(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Générer Facture"
                        >
                          <span className="material-symbols-outlined text-sm">receipt_long</span>
                        </button>
                      )}

                      <button 
                        onClick={() => generatePDF(item)}
                        className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors"
                        title="Télécharger PDF"
                      >
                        <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                      </button>

                      {userData?.role !== 'client' && (
                        <button 
                          onClick={() => setItemToDelete(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                          title="Supprimer"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-on-surface-variant">
                    Aucun document trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {itemToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest rounded-3xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-on-surface mb-4">Confirmer la suppression</h3>
            <p className="text-on-surface-variant mb-6">Êtes-vous sûr de vouloir supprimer ce document ? Cette action est irréversible.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditorOpen && (
        <InvoiceEditor 
          onClose={() => {
            setIsEditorOpen(false);
            setEditingItem(null);
          }} 
          type={editorType} 
          initialData={editingItem?.documentData}
          onSave={handleSaveDocument} 
        />
      )}
    </div>
  );
}
