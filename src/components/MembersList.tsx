import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, getDocs, where, writeBatch, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function MembersList() {
  const { userData } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<any | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberToEdit) return;
    try {
      await updateDoc(doc(db, 'members', memberToEdit.id), {
        fullName: memberToEdit.fullName,
        email: memberToEdit.email,
        phone: memberToEdit.phone,
        address: memberToEdit.address,
        isUpToDate: memberToEdit.isUpToDate,
        amount: memberToEdit.amount || 0,
        role: memberToEdit.role || null,
        title: memberToEdit.title || null,
        activity: memberToEdit.activity || null
      });

      // Handle role update in users collection if email exists and role changed
      const originalMember = members.find(m => m.id === memberToEdit.id);
      if (originalMember && memberToEdit.role !== originalMember.role && memberToEdit.email) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', memberToEdit.email));
        const snapshot = await getDocs(q);
        
        snapshot.forEach(async (userDoc) => {
          await updateDoc(doc(db, 'users', userDoc.id), {
            role: memberToEdit.role === 'admin' || memberToEdit.role === 'superadmin' ? memberToEdit.role : 'client'
          });
        });
      }

      showToast('Membre mis à jour avec succès');
      setMemberToEdit(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `members/${memberToEdit.id}`);
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'members', id));
      showToast('Membre supprimé');
      setMemberToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `members/${id}`);
    }
  };

  const handleDeleteAll = async () => {
    try {
      let batch = writeBatch(db);
      let count = 0;
      for (const member of members) {
        batch.delete(doc(db, 'members', member.id));
        count++;
        if (count >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
      showToast('Tous les membres ont été supprimés');
      setIsDeletingAll(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'members');
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'members'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const filteredMembers = members.filter(m => 
    (m.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (jsonData.length === 0) {
        showToast("Le fichier semble vide.");
        setIsImporting(false);
        return;
      }

      // Find the header row
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(50, jsonData.length); i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        const rowStrings = Array.from(row).map(c => String(c || '').toLowerCase().trim());
        if (rowStrings.some(s => s && (s.includes('nom') || s.includes('prénom') || s.includes('name') || s.includes('adhérent') || s.includes('email') || s.includes('mail')))) {
          headerRowIdx = i;
          break;
        }
      }

      // If no clear header, find the first non-empty row
      if (headerRowIdx === -1) {
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (row && row.length > 0 && row.some(cell => typeof cell === 'string' && cell.trim().length > 0)) {
            headerRowIdx = i;
            break;
          }
        }
      }

      if (headerRowIdx === -1) {
        showToast("Le fichier semble vide ou invalide.");
        setIsImporting(false);
        return;
      }

      const headers = Array.from(jsonData[headerRowIdx] || []).map((h: any) => String(h || '').toLowerCase().trim());
      
      // Find column indices
      let firstNameIdx = headers.findIndex(h => h && (h.includes('prénom') || h.includes('prenom') || h.includes('first')));
      let nameIdx = headers.findIndex((h, idx) => h && idx !== firstNameIdx && (h.includes('nom') || h.includes('name') || h.includes('adhérent')));
      let addressIdx = headers.findIndex(h => h && (h.includes('adresse') || h.includes('address') || h.includes('ville') || h.includes('cp')));
      let emailIdx = headers.findIndex(h => h && (h.includes('mail') || h.includes('email') || h.includes('courriel')));
      let phoneIdx = headers.findIndex(h => h && (h.includes('téléphone') || h.includes('tel') || h.includes('phone') || h.includes('mobile')));
      let upToDateIdx = headers.findIndex(h => h && (h.includes('cotisation') || h.includes('jour') || h.includes('status') || h.includes('paiement')));
      let amountIdx = headers.findIndex(h => h && (h.includes('montant') || h.includes('prix') || h.includes('€') || h.includes('euro')));
      
      let activityIdx = headers.findIndex(h => h && (h.includes('activit') || h.includes('section')));
      let jardinIdx = headers.findIndex(h => h && h.includes('jardin'));
      let apiIdx = headers.findIndex(h => h && (h.includes('api') || h.includes('ruche')));
      let sympaIdx = headers.findIndex(h => h && h.includes('sympa'));
      
      let roleIdx = headers.findIndex(h => h && (h.includes('role') || h.includes('rôle') || h.includes('statut') || h.includes('fonction') || h.includes('bureau')));

      let startRow = headerRowIdx + 1;

      // Fallback if no clear headers found
      if (nameIdx === -1 && firstNameIdx === -1) {
        // Assume column 0 is name, 1 is email, 2 is phone
        nameIdx = 0;
        emailIdx = headers.length > 1 ? 1 : -1;
        phoneIdx = headers.length > 2 ? 2 : -1;
        startRow = headerRowIdx; // The "header" row is actually data
      }

      let importedCount = 0;
      let batch = writeBatch(db);
      let batchCount = 0;

      // Process rows
      for (let i = startRow; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        let fullName = '';
        const nameVal = nameIdx !== -1 && row[nameIdx] ? String(row[nameIdx]).trim() : '';
        const firstNameVal = firstNameIdx !== -1 && row[firstNameIdx] ? String(row[firstNameIdx]).trim() : '';
        
        if (nameVal && firstNameVal) {
          // If both exist and are different, combine them. If they are the same (e.g. bad parsing), just use one.
          if (nameVal.toLowerCase() !== firstNameVal.toLowerCase()) {
            fullName = `${nameVal} ${firstNameVal}`;
          } else {
            fullName = nameVal;
          }
        } else if (nameVal) {
          fullName = nameVal;
        } else if (firstNameVal) {
          fullName = firstNameVal;
        }

        if (!fullName) {
          // If we still don't have a name, try the first available string column
          const firstStringCol = row.find(cell => typeof cell === 'string' && cell.trim().length > 0);
          if (firstStringCol) {
            fullName = String(firstStringCol).trim();
          } else {
            continue;
          }
        }

        const address = addressIdx !== -1 && row[addressIdx] ? String(row[addressIdx]).trim() : '';
        const email = emailIdx !== -1 && row[emailIdx] ? String(row[emailIdx]).trim() : '';
        const phone = phoneIdx !== -1 && row[phoneIdx] ? String(row[phoneIdx]).trim() : '';
        
        let isUpToDate = false;
        if (upToDateIdx !== -1 && row[upToDateIdx]) {
          const val = String(row[upToDateIdx]).toLowerCase().trim();
          isUpToDate = val === 'oui' || val === 'vrai' || val === 'true' || val === '1' || val.includes('jour') || val === 'ok' || val === 'payé';
        }

        let amount = 0;
        if (amountIdx !== -1 && row[amountIdx]) {
          const val = String(row[amountIdx]).replace(/[^0-9.,]/g, '').replace(',', '.');
          amount = parseFloat(val) || 0;
        }

        let activity = null;
        if (activityIdx !== -1 && row[activityIdx]) {
          const val = String(row[activityIdx]).toLowerCase().trim();
          if (val.includes('jardin')) activity = 'jardinier';
          else if (val.includes('api') || val.includes('ruche')) activity = 'apiculteur';
          else if (val.includes('sympa')) activity = 'sympathisant';
        }
        
        const isTruthy = (val: string) => {
          const lowerVal = val.toLowerCase().trim();
          return lowerVal === 'oui' || lowerVal === 'x' || lowerVal === 'vrai' || lowerVal === '1' || lowerVal === 'ok' || lowerVal === 'true' || lowerVal === 'jardinier' || lowerVal === 'apiculteur' || lowerVal === 'sympathisant';
        };
        
        if (!activity && jardinIdx !== -1 && row[jardinIdx]) {
          const val = String(row[jardinIdx]);
          if (isTruthy(val) || val.toLowerCase().includes('jardin')) activity = 'jardinier';
        }
        if (!activity && apiIdx !== -1 && row[apiIdx]) {
          const val = String(row[apiIdx]);
          if (isTruthy(val) || val.toLowerCase().includes('api') || val.toLowerCase().includes('ruche')) activity = 'apiculteur';
        }
        if (!activity && sympaIdx !== -1 && row[sympaIdx]) {
          const val = String(row[sympaIdx]);
          if (isTruthy(val) || val.toLowerCase().includes('sympa')) activity = 'sympathisant';
        }

        let role = null;
        let title = null;
        if (roleIdx !== -1 && row[roleIdx]) {
          const val = String(row[roleIdx]).toLowerCase().trim();
          if (val.includes('superadmin')) role = 'superadmin';
          else if (val.includes('admin')) role = 'admin';
          
          if (val.includes('président') || val.includes('president')) title = 'president';
          else if (val.includes('trésorier') || val.includes('tresorier')) title = 'tresorier';
          else if (val.includes('secrétaire') || val.includes('secretaire')) title = 'secretaire';
        }

        try {
          const newMemberRef = doc(collection(db, 'members'));
          batch.set(newMemberRef, {
            fullName: fullName.substring(0, 149),
            address: address.substring(0, 299),
            email: email.substring(0, 149),
            phone: phone.substring(0, 49),
            isUpToDate,
            amount,
            activity,
            role,
            title,
            createdAt: serverTimestamp()
          });
          
          importedCount++;
          batchCount++;

          if (batchCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        } catch (err) {
          console.error("Erreur lors de la préparation de la ligne", i, err);
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      if (importedCount > 0) {
        showToast(`${importedCount} membres ont été importés avec succès !`);
      } else {
        showToast("Aucun membre n'a pu être importé. Vérifiez le format du fichier.");
      }
    } catch (error) {
      console.error("Erreur lors de la lecture du fichier:", error);
      showToast("Une erreur est survenue lors de la lecture du fichier.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      
      doc.setFontSize(18);
      doc.setTextColor(20, 83, 45); // emerald-900
      doc.text('Liste des Membres - Les jardins bourdonnants', 14, 22);
      
      const tableData = filteredMembers.map(member => {
        const statuts = [];
        if (member.role === 'superadmin') statuts.push('Superadmin');
        if (member.role === 'admin') statuts.push('Admin');
        if (member.title === 'president') statuts.push('Président(e)');
        if (member.title === 'tresorier') statuts.push('Trésorier(e)');
        if (member.title === 'secretaire') statuts.push('Secrétaire');
        if (statuts.length === 0) statuts.push('Adhérent');

        let activity = '-';
        if (member.activity === 'jardinier') activity = 'Jardinier';
        if (member.activity === 'apiculteur') activity = 'Apiculteur';
        if (member.activity === 'sympathisant') activity = 'Sympathisant';

        return [
          member.fullName || '-',
          member.email || '-',
          member.phone || '-',
          member.address || '-',
          member.createdAt?.toDate ? member.createdAt.toDate().toLocaleDateString('fr-FR') : '-',
          member.isUpToDate ? 'À jour' : 'Non à jour',
          member.amount ? `${member.amount} €` : '-',
          statuts.join(', '),
          activity
        ];
      });

      autoTable(doc, {
        head: [['Nom & Prénom', 'Email', 'Téléphone', 'Adresse', 'Date d\'ajout', 'Cotisation', 'Montant', 'Statut', 'Rôle']],
        body: tableData,
        startY: 30,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [20, 83, 45] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      doc.save('liste-membres.pdf');
      showToast('PDF généré avec succès !');
    } catch (error) {
      console.error('Error generating PDF', error);
      showToast('Une erreur est survenue lors de la génération du PDF.');
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
        <h2 className="text-3xl font-bold font-headline text-primary">Membres</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input 
              type="text" 
              placeholder="Rechercher un membre..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none w-64 transition-all"
            />
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, application/vnd.oasis.opendocument.spreadsheet" 
            className="hidden" 
          />
          <button 
            onClick={exportToPDF}
            className="px-4 py-3 rounded-xl font-bold flex items-center gap-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
            title="Exporter en PDF"
          >
            <span className="material-symbols-outlined">picture_as_pdf</span>
            <span className="hidden md:inline">PDF</span>
          </button>
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-4 py-3 rounded-xl font-bold flex items-center gap-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            <span className="material-symbols-outlined">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
          </button>
          <button 
            onClick={() => setIsDeletingAll(true)}
            disabled={members.length === 0 || isImporting}
            className="px-4 py-3 rounded-xl font-bold flex items-center gap-2 bg-error/10 text-error hover:bg-error/20 transition-colors disabled:opacity-50"
            title="Vider la liste"
          >
            <span className="material-symbols-outlined">delete_sweep</span>
          </button>
          <button 
            onClick={triggerFileInput}
            disabled={isImporting}
            className="px-6 py-3 rounded-xl font-bold flex items-center gap-2 bg-primary text-on-primary shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined">upload_file</span>
            {isImporting ? 'Importation...' : 'Importer'}
          </button>
        </div>
      </div>

      <div id="members-table-container" className="flex-1 bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/20 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Nom & Prénom</th>
                <th className="py-3 px-4 font-bold">Email</th>
                <th className="py-3 px-4 font-bold">Téléphone</th>
                <th className="py-3 px-4 font-bold">Adresse</th>
                <th className="py-3 px-4 font-bold">Date d'ajout</th>
                <th className="py-3 px-4 font-bold">Cotisation</th>
                <th className="py-3 px-4 font-bold">Montant</th>
                <th className="py-3 px-4 font-bold">Statut</th>
                <th className="py-3 px-4 font-bold">Rôle</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 text-sm">
              {filteredMembers.map(member => (
                <tr key={member.id} className="hover:bg-surface-container-lowest/50 transition-colors">
                  <td className="py-2 px-4 font-bold whitespace-nowrap">{member.fullName}</td>
                  <td className="py-2 px-4 text-on-surface-variant">{member.email || '-'}</td>
                  <td className="py-2 px-4 text-on-surface-variant whitespace-nowrap">{member.phone || '-'}</td>
                  <td className="py-2 px-4 text-on-surface-variant max-w-[200px] truncate" title={member.address}>{member.address || '-'}</td>
                  <td className="py-2 px-4 text-on-surface-variant whitespace-nowrap">
                    {member.createdAt?.toDate ? member.createdAt.toDate().toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="py-2 px-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                      member.isUpToDate ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {member.isUpToDate ? 'À jour' : 'Non à jour'}
                    </span>
                  </td>
                  <td className="py-2 px-4 font-bold text-on-surface-variant whitespace-nowrap">
                    {member.amount ? `${member.amount} €` : '-'}
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {member.role === 'superadmin' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-100 text-purple-800 border-purple-300">Superadmin</span>}
                      {member.role === 'admin' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-100 text-red-800 border-red-300">Admin</span>}
                      {member.title === 'president' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-100 text-blue-800 border-blue-300">Président(e)</span>}
                      {member.title === 'tresorier' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-100 text-blue-800 border-blue-300">Trésorier(e)</span>}
                      {member.title === 'secretaire' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-100 text-blue-800 border-blue-300">Secrétaire</span>}
                      {!member.role && !member.title && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100 text-slate-800 border-slate-300">Adhérent</span>}
                    </div>
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {member.activity === 'jardinier' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-100 text-emerald-800 border-emerald-300">Jardinier</span>}
                      {member.activity === 'apiculteur' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-100 text-amber-800 border-amber-300">Apiculteur</span>}
                      {member.activity === 'sympathisant' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-teal-100 text-teal-800 border-teal-300">Sympathisant</span>}
                      {!member.activity && <span className="text-on-surface-variant text-[10px] italic">-</span>}
                    </div>
                  </td>
                  <td className="py-2 px-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => setMemberToEdit(member)}
                        className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Éditer"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button 
                        onClick={() => setMemberToDelete(member.id)}
                        className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-on-surface-variant">
                    {searchQuery ? "Aucun membre ne correspond à votre recherche." : "Aucun membre trouvé. Importez une liste pour commencer."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Member Modal */}
      {memberToEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="shrink-0 p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low">
              <h3 className="text-xl font-bold text-on-surface">Éditer le membre</h3>
              <button onClick={() => setMemberToEdit(null)} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="edit-member-form" onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Nom & Prénom</label>
                  <input required type="text" value={memberToEdit.fullName} onChange={e => setMemberToEdit({...memberToEdit, fullName: e.target.value})} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Email</label>
                  <input type="email" value={memberToEdit.email || ''} onChange={e => setMemberToEdit({...memberToEdit, email: e.target.value})} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Téléphone</label>
                  <input type="tel" value={memberToEdit.phone || ''} onChange={e => setMemberToEdit({...memberToEdit, phone: e.target.value})} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Adresse</label>
                  <textarea value={memberToEdit.address || ''} onChange={e => setMemberToEdit({...memberToEdit, address: e.target.value})} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none min-h-[80px]" />
                </div>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-3 cursor-pointer p-3 border border-outline-variant/30 rounded-xl hover:bg-surface-container-low transition-colors flex-1">
                    <input type="checkbox" checked={memberToEdit.isUpToDate} onChange={e => setMemberToEdit({...memberToEdit, isUpToDate: e.target.checked})} className="w-5 h-5 text-primary focus:ring-primary rounded" />
                    <span className="font-bold text-sm">Cotisation à jour</span>
                  </label>
                  <div className="flex-1">
                    <label className="block text-sm font-bold mb-2">Montant de la cotisation (€)</label>
                    <input type="number" step="0.01" value={memberToEdit.amount || ''} onChange={e => setMemberToEdit({...memberToEdit, amount: parseFloat(e.target.value) || 0})} className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-outline-variant/20">
                  <div>
                    <label className="block text-sm font-bold mb-2">Statut (Système)</label>
                    <select 
                      value={memberToEdit.role || ''} 
                      onChange={e => setMemberToEdit({...memberToEdit, role: e.target.value || null})}
                      disabled={userData?.role !== 'superadmin'}
                      className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
                    >
                      <option value="">Adhérent (Normal)</option>
                      <option value="admin">Administrateur</option>
                      {userData?.role === 'superadmin' && <option value="superadmin">Superadmin</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Statut (Bureau)</label>
                    <select 
                      value={memberToEdit.title || ''} 
                      onChange={e => setMemberToEdit({...memberToEdit, title: e.target.value || null})}
                      className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="">Aucun</option>
                      <option value="president">Président(e)</option>
                      <option value="tresorier">Trésorier(e)</option>
                      <option value="secretaire">Secrétaire</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">Rôle (Activité)</label>
                    <select 
                      value={memberToEdit.activity || ''} 
                      onChange={e => setMemberToEdit({...memberToEdit, activity: e.target.value || null})}
                      className="w-full p-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none"
                    >
                      <option value="">Aucun</option>
                      <option value="jardinier">Jardinier</option>
                      <option value="apiculteur">Apiculteur</option>
                      <option value="sympathisant">Sympathisant</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>
            <div className="shrink-0 p-6 border-t border-outline-variant/20 bg-surface-container-low flex justify-end gap-3">
              <button type="button" onClick={() => setMemberToEdit(null)} className="px-4 py-2 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors">
                Annuler
              </button>
              <button type="submit" form="edit-member-form" className="px-4 py-2 rounded-xl font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Member Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6">
            <h3 className="text-xl font-bold text-on-surface mb-2">Confirmer la suppression</h3>
            <p className="text-on-surface-variant mb-6">Êtes-vous sûr de vouloir supprimer ce membre ? Cette action est irréversible.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setMemberToDelete(null)} className="px-4 py-2 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container transition-colors">Annuler</button>
              <button onClick={() => handleDeleteMember(memberToDelete)} className="px-4 py-2 rounded-xl font-bold bg-error text-on-error hover:bg-error/90 transition-colors">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Modal */}
      {isDeletingAll && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6">
            <h3 className="text-xl font-bold text-error mb-2">Vider la liste</h3>
            <p className="text-on-surface-variant mb-6">Êtes-vous sûr de vouloir supprimer <strong>tous les membres</strong> ? Cette action est irréversible.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsDeletingAll(false)} className="px-4 py-2 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container transition-colors">Annuler</button>
              <button onClick={handleDeleteAll} className="px-4 py-2 rounded-xl font-bold bg-error text-on-error hover:bg-error/90 transition-colors">Tout supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
