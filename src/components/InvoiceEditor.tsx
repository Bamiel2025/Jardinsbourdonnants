import React, { useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export interface InvoiceItem {
  id: string;
  designation: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  clientName: string;
  clientAddress: string;
  paymentMethod: string;
  paymentDeadline: string;
  items: InvoiceItem[];
  totalHT: number;
  totalTTC: number;
}

interface InvoiceEditorProps {
  onClose: () => void;
  type?: 'invoice' | 'quote';
  initialData?: Partial<InvoiceData>;
  onSave?: (data: InvoiceData) => void;
}

export default function InvoiceEditor({ onClose, type = 'invoice', initialData, onSave }: InvoiceEditorProps) {
  const [invoiceNumber, setInvoiceNumber] = useState(initialData?.invoiceNumber || '2024-001');
  const [date, setDate] = useState(initialData?.date || new Date().toLocaleDateString('fr-FR'));
  const [clientName, setClientName] = useState(initialData?.clientName || '');
  const [clientAddress, setClientAddress] = useState(initialData?.clientAddress || '');
  const [paymentMethod, setPaymentMethod] = useState(initialData?.paymentMethod || 'Chèque');
  const [paymentDeadline, setPaymentDeadline] = useState(initialData?.paymentDeadline || 'immédiat');
  
  const isQuote = type === 'quote';
  const documentTitle = isQuote ? 'Devis' : 'Facture';
  const documentTitleUpper = isQuote ? 'DEVIS' : 'FACTURE';
  
  const [items, setItems] = useState<InvoiceItem[]>(initialData?.items || [
    { id: '1', designation: 'Prestation apicole', quantity: 1, unitPrice: 150 },
    { id: '2', designation: 'Découverte du monde des abeilles et visite rucher', quantity: 0, unitPrice: 0 }
  ]);

  const invoiceRef = useRef<HTMLDivElement>(null);

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), designation: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const totalHT = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalTTC = totalHT; // TVA non applicable

  const exportPDF = async () => {
    if (!invoiceRef.current) return;
    
    try {
      // Hide edit controls before export
      const controls = invoiceRef.current.querySelectorAll('.hide-on-export');
      controls.forEach(el => (el as HTMLElement).style.display = 'none');
      
      // Remove borders from inputs for cleaner look
      const inputs = invoiceRef.current.querySelectorAll('input, textarea');
      inputs.forEach(el => {
        (el as HTMLElement).style.border = 'none';
        (el as HTMLElement).style.background = 'transparent';
      });

      const dataUrl = await toPng(invoiceRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      
      // Restore styles
      controls.forEach(el => (el as HTMLElement).style.display = '');
      inputs.forEach(el => {
        (el as HTMLElement).style.border = '';
        (el as HTMLElement).style.background = '';
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (img.height * pdfWidth) / img.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${documentTitle}_${invoiceNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF', error);
      alert('Erreur lors de la génération du PDF');
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave({
        invoiceNumber,
        date,
        clientName,
        clientAddress,
        paymentMethod,
        paymentDeadline,
        items,
        totalHT,
        totalTTC
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-surface-container-low shrink-0 rounded-t-2xl">
          <h2 className="text-xl font-bold">Éditeur de {documentTitle}</h2>
          <div className="flex gap-2">
            {onSave && (
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700"
              >
                <span className="material-symbols-outlined">save</span>
                Enregistrer
              </button>
            )}
            <button 
              onClick={exportPDF}
              className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90"
            >
              <span className="material-symbols-outlined">download</span>
              Télécharger PDF
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-surface-container-highest rounded-full transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 bg-gray-100">
          <div 
            ref={invoiceRef}
            className="bg-white mx-auto p-12 shadow-sm" 
            style={{ width: '210mm', minHeight: '297mm', fontFamily: 'Times New Roman, serif' }}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div className="w-48">
                <img 
                  src="/logo.jpg" 
                  alt="Les jardins bourdonnants" 
                  className="w-40 h-40 object-contain" 
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "https://placehold.co/400x400/ffffff/065f46?text=Logo+Manquant";
                  }}
                />
              </div>
              <div className="flex-1 text-center">
                <h1 className="text-3xl font-bold mb-2 pt-4">
                  {documentTitleUpper} « <input 
                    type="text" 
                    value={invoiceNumber} 
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="inline-block w-32 border-b border-dashed border-gray-300 focus:border-blue-500 outline-none text-center"
                  /> »
                </h1>
                <h2 className="text-xl font-bold text-amber-600 flex items-center justify-center gap-2">
                  Association Les Jardins Bourdonnants 🐝
                </h2>
              </div>
              <div className="w-48"></div>
            </div>

            {/* Association Info */}
            <div className="mb-8 font-bold">
              <p>Maison des sports et de la vie associative</p>
              <p>100 avenue Gaston Rebuffat</p>
              <p>13390 AURIOL</p>
              <p>SIRET : 809 621 519</p>
            </div>

            {/* Invoice Details */}
            <div className="mb-12">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span>{documentTitle} n° :</span>
                  <input 
                    type="text" 
                    value={invoiceNumber} 
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="border-b border-dashed border-gray-300 focus:border-blue-500 outline-none w-48"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span>Date :</span>
                  <input 
                    type="text" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)}
                    className="border-b border-dashed border-gray-300 focus:border-blue-500 outline-none w-48"
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-start gap-2 mb-1">
                  <span className="mt-1">Client :</span>
                  <textarea 
                    value={clientName} 
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Nom du client"
                    className="border border-dashed border-gray-300 focus:border-blue-500 outline-none w-96 p-1 resize-none"
                    rows={1}
                  />
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1">Adresse :</span>
                  <textarea 
                    value={clientAddress} 
                    onChange={(e) => setClientAddress(e.target.value)}
                    placeholder="Adresse du client"
                    className="border border-dashed border-gray-300 focus:border-blue-500 outline-none w-96 p-1 resize-none"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <table className="w-full mb-8 border-collapse border border-gray-400">
              <thead>
                <tr className="border-b border-gray-400">
                  <th className="border-r border-gray-400 p-2 text-left w-1/2">Designation</th>
                  <th className="border-r border-gray-400 p-2 text-left">Quantité</th>
                  <th className="border-r border-gray-400 p-2 text-left">Prix unitaire (€)</th>
                  <th className="p-2 text-left">Total (€)</th>
                  <th className="w-10 hide-on-export"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-400">
                    <td className="border-r border-gray-400 p-2">
                      <textarea 
                        value={item.designation}
                        onChange={(e) => handleItemChange(item.id, 'designation', e.target.value)}
                        className="w-full border-none outline-none resize-none bg-transparent"
                        rows={2}
                      />
                    </td>
                    <td className="border-r border-gray-400 p-2">
                      <input 
                        type="number" 
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full border-none outline-none bg-transparent"
                        min="0"
                      />
                    </td>
                    <td className="border-r border-gray-400 p-2">
                      <input 
                        type="number" 
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full border-none outline-none bg-transparent"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="p-2">
                      {(item.quantity * item.unitPrice).toFixed(2)}
                    </td>
                    <td className="p-2 text-center hide-on-export">
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="mb-8 hide-on-export">
              <button 
                onClick={addItem}
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-sans"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Ajouter une ligne
              </button>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-12">
              <div className="text-right">
                <p className="mb-1">Total HT : {totalHT.toFixed(2)} €</p>
                <p className="mb-1">TVA : 0.00 €</p>
                <p className="mb-1 text-sm">(TVA non applicable, art. 293B du CGI si exonération)</p>
                <p className="font-bold mt-2">Total TTC : {totalTTC.toFixed(2)} €</p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-12">
              <div className="flex items-center gap-2 mb-1">
                <span>Mode de paiement :</span>
                <input 
                  type="text" 
                  value={paymentMethod} 
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="border-b border-dashed border-gray-300 focus:border-blue-500 outline-none w-64 bg-transparent"
                />
              </div>
              <div className="flex items-center gap-2 mb-8">
                <span>Date limite de paiement :</span>
                <input 
                  type="text" 
                  value={paymentDeadline} 
                  onChange={(e) => setPaymentDeadline(e.target.value)}
                  className="border-b border-dashed border-gray-300 focus:border-blue-500 outline-none w-64 bg-transparent"
                />
              </div>
              <p className="text-center font-bold flex items-center justify-center gap-2">
                Merci pour votre soutien à l'apiculture 🐝
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
