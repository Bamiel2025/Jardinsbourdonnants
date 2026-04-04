import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { useAuth } from '../contexts/AuthContext';

export default function GardenManagement() {
  const { userData } = useAuth();
  const [plots, setPlots] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlanFullscreen, setIsPlanFullscreen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState<any>(null);

  // Form state
  const [plotNumber, setPlotNumber] = useState('');
  const [status, setStatus] = useState('disponible'); // disponible, occupe, maintenance
  const [assignedMemberId, setAssignedMemberId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubPlots = onSnapshot(query(collection(db, 'plots'), orderBy('plotNumber')), (snap) => {
      setPlots(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching plots:", error);
    });

    const unsubMembers = onSnapshot(query(collection(db, 'members')), (snap) => {
      // Sort members locally to avoid needing a composite index immediately
      const fetchedMembers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedMembers.sort((a: any, b: any) => (a.fullName || '').localeCompare(b.fullName || ''));
      setMembers(fetchedMembers);
    }, (error) => {
      console.error("Error fetching members:", error);
    });

    return () => {
      unsubPlots();
      unsubMembers();
    };
  }, []);

  const openModal = (plot: any = null, defaultNumber: string = '') => {
    if (plot) {
      setEditingPlot(plot);
      setPlotNumber(plot.plotNumber || '');
      setStatus(plot.status || 'disponible');
      setAssignedMemberId(plot.assignedMemberId || '');
      setNotes(plot.notes || '');
    } else {
      setEditingPlot(null);
      setPlotNumber(defaultNumber);
      setStatus('disponible');
      setAssignedMemberId('');
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const renderPlot = (num: string, customTitle?: string, isLarge?: boolean) => {
    const plot = plots.find(p => p.plotNumber === num);
    const isOccupied = plot?.status === 'occupe';
    const isMaintenance = plot?.status === 'maintenance';
    
    let displayTitle = 'Libre';
    if (customTitle) {
      displayTitle = customTitle;
    } else if (isOccupied && plot?.assignedMemberId) {
      displayTitle = getAssignedMemberName(plot.assignedMemberId);
    } else if (isMaintenance) {
      displayTitle = 'Maintenance';
    }

    return (
      <div 
        onClick={() => userData?.role !== 'client' && openModal(plot, num)}
        className={`border-2 border-slate-800 bg-white p-2 flex flex-col items-center ${userData?.role !== 'client' ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'} transition-colors relative ${isLarge ? 'h-full min-h-[200px]' : 'h-28'}`}
      >
        <div className="text-[10px] font-bold mb-1 text-slate-800">PARCELLE {num}</div>
        {customTitle && <div className="text-[9px] font-bold mb-1 text-center text-slate-800">({customTitle})</div>}
        
        <div className={`w-10/12 flex-1 shadow-[2px_4px_6px_rgba(0,0,0,0.2)] flex flex-col items-center justify-center p-1 text-center transition-transform hover:scale-105 ${
          isMaintenance ? 'bg-amber-200' : 'bg-[#fde047]'
        }`}>
           <div className="w-6 h-6 rounded-full border border-slate-800 flex items-center justify-center font-bold mb-1 bg-transparent text-slate-800 text-xs">
             {num}
           </div>
           <div className="font-medium text-[10px] leading-tight text-slate-900">
             {displayTitle}
           </div>
        </div>
      </div>
    );
  };

  const renderPollinators = () => {
    const plot = plots.find(p => p.plotNumber === '3');
    return (
      <div 
        onClick={() => userData?.role !== 'client' && openModal(plot, '3')}
        className={`border-2 border-slate-800 bg-white p-1 flex flex-col items-center justify-center ${userData?.role !== 'client' ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'} transition-colors h-28 relative overflow-hidden`}
      >
        <div className="text-[10px] font-bold mb-1 text-slate-800">PARCELLE 3</div>
        <div className="w-6 h-6 rounded-full border border-slate-800 flex items-center justify-center font-bold mb-1 bg-white z-10 text-slate-800 text-xs">3</div>
        <div className="font-bold text-[9px] text-center px-1 z-10 bg-white/80 rounded text-slate-800">ZONE DES POLLINISATEURS</div>
        
        <div className="absolute bottom-0 left-0 w-full h-1/2 flex items-end justify-around opacity-60 pointer-events-none">
          <span className="material-symbols-outlined text-emerald-600 text-lg">local_florist</span>
          <span className="material-symbols-outlined text-amber-500 text-xl mb-1">emoji_nature</span>
          <span className="material-symbols-outlined text-pink-500 text-lg">local_florist</span>
          <span className="material-symbols-outlined text-emerald-700 text-xl">grass</span>
        </div>
      </div>
    );
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPlot(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const plotData = {
        plotNumber,
        status,
        assignedMemberId: status === 'occupe' ? assignedMemberId : '',
        notes,
        updatedAt: serverTimestamp()
      };

      if (editingPlot) {
        await updateDoc(doc(db, 'plots', editingPlot.id), plotData);
      } else {
        await addDoc(collection(db, 'plots'), {
          ...plotData,
          createdAt: serverTimestamp()
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingPlot ? OperationType.UPDATE : OperationType.CREATE, 'plots');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette parcelle ?')) {
      try {
        await deleteDoc(doc(db, 'plots', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `plots/${id}`);
      }
    }
  };

  const getStatusColor = (plotStatus: string) => {
    switch (plotStatus) {
      case 'disponible': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'occupe': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'maintenance': return 'bg-amber-100 text-amber-800 border-amber-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getStatusLabel = (plotStatus: string) => {
    switch (plotStatus) {
      case 'disponible': return 'Libre';
      case 'occupe': return 'Occupée';
      case 'maintenance': return 'En maintenance';
      default: return 'Inconnu';
    }
  };

  const getAssignedMemberName = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    return member ? member.fullName : 'Membre inconnu';
  };

  const exportToPDF = async () => {
    const element = document.getElementById('garden-plan-content');
    if (!element) return;
    
    try {
      const dataUrl = await toPng(element, { 
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: {
          transform: 'none',
          transformOrigin: 'center'
        }
      });
      
      const pdf = new jsPDF('l', 'mm', 'a4');
      
      // We need to get the image dimensions to calculate the PDF dimensions
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate scale to fit both width and height with a small margin
      const margin = 10;
      const maxWidth = pdfPageWidth - (margin * 2);
      const maxHeight = pdfPageHeight - (margin * 2);
      
      const widthRatio = maxWidth / img.width;
      const heightRatio = maxHeight / img.height;
      const ratio = Math.min(widthRatio, heightRatio);
      
      const pdfWidth = img.width * ratio;
      const pdfHeight = img.height * ratio;
      
      // Center on page
      const xOffset = (pdfPageWidth - pdfWidth) / 2;
      const yOffset = (pdfPageHeight - pdfHeight) / 2;
      
      pdf.addImage(dataUrl, 'PNG', xOffset, yOffset, pdfWidth, pdfHeight);
      pdf.save('plan-jardin.pdf');
    } catch (error) {
      console.error('Error generating PDF', error);
      alert('Une erreur est survenue lors de la génération du PDF.');
    }
  };

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[100] bg-surface-container-lowest p-8 flex flex-col h-screen overflow-hidden' : 'p-8 h-[calc(100vh-80px)] flex flex-col relative'}>
      <div className="flex justify-between items-end mb-6 shrink-0">
        <div>
          <h2 className="text-3xl font-bold font-headline text-primary">Gestion des Jardins</h2>
          <p className="text-on-surface-variant mt-1">Gérez les parcelles et leurs attributions.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-4 py-2 rounded-xl font-bold flex items-center gap-2 bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors"
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            <span className="material-symbols-outlined">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
          </button>
          {userData?.role !== 'client' && (
            <button 
              onClick={() => openModal()}
              className="px-6 py-2 rounded-xl font-bold flex items-center gap-2 bg-primary text-on-primary shadow-md hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined">add</span>
              Ajouter une parcelle
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col xl:flex-row gap-6 overflow-hidden">
        {/* Espace Plan Interactif */}
        <div className={isPlanFullscreen 
          ? "fixed inset-0 z-[120] bg-surface-container-lowest flex flex-col overflow-hidden" 
          : "w-full xl:w-2/3 bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/20 flex flex-col overflow-hidden"}>
          <div className="p-4 border-b border-outline-variant/20 bg-surface-container-low shrink-0 flex justify-between items-center">
            <h3 className="font-bold text-lg text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined">map</span>
              Plan du jardin partagé - Le verger des amis
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-lg">Interactif</span>
              <button 
                onClick={exportToPDF}
                className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1"
                title="Exporter en PDF"
              >
                <span className="material-symbols-outlined">picture_as_pdf</span>
              </button>
              <button 
                onClick={() => setIsPlanFullscreen(!isPlanFullscreen)}
                className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                title={isPlanFullscreen ? "Quitter la vue aérienne" : "Vue aérienne (Plein écran)"}
              >
                <span className="material-symbols-outlined">{isPlanFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
              </button>
            </div>
          </div>
          <div className="flex-1 p-2 bg-[#f8fafc] relative overflow-auto flex items-start justify-center pt-4 md:pt-8">
            <div className={`transition-all origin-top ${isPlanFullscreen ? 'scale-100' : 'scale-[0.50] sm:scale-[0.65] md:scale-[0.75] lg:scale-[0.85] xl:scale-[0.90]'}`}>
              <div id="garden-plan-content" className="mx-auto font-sans text-slate-900 w-[600px] shrink-0 bg-white p-4 rounded-xl">
                
                {/* Top Header Box */}
              <div className="border-2 border-slate-800 bg-white p-2 mb-3 flex justify-between items-center relative">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-[10px]">CABANE & RÉCUPÉRATEUR</span>
                    <span className="font-bold text-[10px]">D'EAU</span>
                  </div>
                  <span className="material-symbols-outlined text-2xl text-amber-800">house</span>
                  <span className="material-symbols-outlined text-2xl text-emerald-700">water_drop</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-bold text-[10px]">ZONE</span>
                  <span className="font-bold text-[10px]">D'OUTILS</span>
                  <span className="material-symbols-outlined text-xl text-slate-600">handyman</span>
                </div>
                <div className="absolute -right-8 top-0 flex flex-col items-center">
                  <span className="font-bold text-[10px]">Est</span>
                  <span className="material-symbols-outlined text-xl transform -rotate-45">navigation</span>
                </div>
              </div>

              {/* Main Grid */}
              <div className="flex gap-3 relative">
                {/* Left Water Column */}
                <div className="flex flex-col justify-around py-4 w-8 items-center text-blue-600 font-bold text-[9px]">
                  <div className="flex flex-col items-center"><span className="material-symbols-outlined text-sm">water_drop</span>EAU</div>
                  <span className="material-symbols-outlined text-slate-400 text-sm">height</span>
                  <div className="flex flex-col items-center"><span className="material-symbols-outlined text-sm">water_drop</span>EAU</div>
                  <span className="material-symbols-outlined text-slate-400 text-sm">height</span>
                  <div className="flex flex-col items-center"><span className="material-symbols-outlined text-sm">water_drop</span>EAU</div>
                </div>

                {/* Grid Content */}
                <div className="flex-1 grid grid-cols-3 gap-3">
                  {/* Row 1 */}
                  {renderPlot('5')}
                  <div></div>
                  {renderPlot('4')}

                  {/* Row 2 */}
                  {renderPlot('6')}
                  {renderPollinators()}
                  {renderPlot('2')}

                  {/* Row 3 & 4 */}
                  <div className="flex flex-col gap-3">
                    {renderPlot('7')}
                    {renderPlot('8')}
                  </div>
                  <div></div>
                  <div className="h-full">
                    {renderPlot('1', 'PARCELLE ÉCOLE', true)}
                  </div>
                </div>

                {/* Right Water Column */}
                <div className="flex flex-col justify-around py-4 w-8 items-center text-blue-600 font-bold text-[9px]">
                  <div className="flex flex-col items-center"><span className="material-symbols-outlined text-sm">water_drop</span>EAU</div>
                  <span className="material-symbols-outlined text-slate-400 text-sm">height</span>
                  <div className="flex flex-col items-center"><span className="material-symbols-outlined text-sm">water_drop</span>EAU</div>
                  <span className="material-symbols-outlined text-slate-400 text-sm">height</span>
                  <div className="flex flex-col items-center"><span className="material-symbols-outlined text-sm">water_drop</span>EAU</div>
                </div>
              </div>
              
              {/* Bottom Right */}
              <div className="flex justify-end mt-3 pr-8">
                <div className="flex flex-col items-center">
                  <span className="font-bold text-[10px]">HÔTEL À</span>
                  <span className="font-bold text-[10px]">INSECTES</span>
                  <span className="material-symbols-outlined text-2xl text-amber-900">bug_report</span>
                </div>
              </div>

            </div>
            </div>
          </div>
        </div>

        {/* Liste des parcelles */}
        <div className="w-full xl:w-1/3 bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/20 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-outline-variant/20 bg-surface-container-low flex justify-between items-center shrink-0">
            <h3 className="font-bold text-lg text-on-surface">Liste des parcelles ({plots.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4">
              {plots.map(plot => (
                <div key={plot.id} className="bg-surface-container p-4 rounded-2xl border border-outline-variant/20 flex flex-col gap-3 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">grass</span>
                      <span className="font-bold text-lg text-on-surface">Parcelle {plot.plotNumber}</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(plot.status)}`}>
                      {getStatusLabel(plot.status)}
                    </span>
                  </div>
                  
                  <div className="flex-1">
                    {plot.status === 'occupe' && plot.assignedMemberId ? (
                      <div className="flex items-center gap-2 text-sm text-on-surface">
                        <span className="material-symbols-outlined text-sm text-on-surface-variant">person</span>
                        <span className="font-medium">{getAssignedMemberName(plot.assignedMemberId)}</span>
                      </div>
                    ) : (
                      <div className="text-sm text-on-surface-variant italic">
                        Aucun membre assigné
                      </div>
                    )}
                    
                    {plot.notes && (
                      <div className="mt-2 text-xs text-on-surface-variant bg-surface-container-low p-2 rounded-lg line-clamp-2">
                        {plot.notes}
                      </div>
                    )}
                  </div>

                  {userData?.role !== 'client' && (
                    <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-outline-variant/10">
                      <button 
                        onClick={() => openModal(plot)}
                        className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(plot.id)}
                        className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              
              {plots.length === 0 && (
                <div className="col-span-full py-12 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl mb-2 opacity-50">yard</span>
                  <p>Aucune parcelle n'a été créée.</p>
                  <p className="text-sm">Cliquez sur "Ajouter une parcelle" pour commencer.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal d'édition/création */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low shrink-0">
              <h3 className="text-xl font-bold font-headline text-primary">
                {editingPlot ? 'Modifier la parcelle' : 'Nouvelle parcelle'}
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1">Numéro / Nom de la parcelle *</label>
                  <input 
                    type="text" 
                    required
                    value={plotNumber}
                    onChange={(e) => setPlotNumber(e.target.value)}
                    placeholder="Ex: A1, B4, Parcelle Nord..."
                    className="w-full p-3 bg-surface-container rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1">Statut</label>
                  <select 
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      if (e.target.value !== 'occupe') setAssignedMemberId('');
                    }}
                    className="w-full p-3 bg-surface-container rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="disponible">Libre</option>
                    <option value="occupe">Occupée</option>
                    <option value="maintenance">En maintenance</option>
                  </select>
                </div>

                {status === 'occupe' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-bold text-on-surface mb-1">Membre assigné *</label>
                    <select 
                      required
                      value={assignedMemberId}
                      onChange={(e) => setAssignedMemberId(e.target.value)}
                      className="w-full p-3 bg-surface-container rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="">Sélectionner un membre...</option>
                      {members.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.fullName} {member.email ? `(${member.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-on-surface mb-1">Notes / Description</label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Informations supplémentaires (taille, état, cultures en cours...)"
                    className="w-full h-24 p-3 bg-surface-container rounded-xl border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                  />
                </div>
              </div>
              
              <div className="p-6 border-t border-outline-variant/20 bg-surface-container-low flex justify-end gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={closeModal} 
                  className="px-6 py-2 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-xl font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                  ) : (
                    <span className="material-symbols-outlined text-sm">save</span>
                  )}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
