import React, { useState } from 'react';
import BoardMembersList from './BoardMembersList';
import AdminDocumentsList from './AdminDocumentsList';

export default function AdministrationPanel() {
  const [activeTab, setActiveTab] = useState<'bureau' | 'ag_report' | 'statutes' | 'internal_rules'>('bureau');

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h2 className="text-4xl font-extrabold text-primary tracking-tight font-headline">Administration</h2>
        <p className="text-slate-500 mt-2 text-lg">Gérez le bureau et les documents administratifs de l'association.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('bureau')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'bureau'
                ? 'border-b-2 border-primary text-primary'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            Bureau
          </button>
          <button
            onClick={() => setActiveTab('ag_report')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'ag_report'
                ? 'border-b-2 border-primary text-primary'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            Comptes rendus d'AG
          </button>
          <button
            onClick={() => setActiveTab('statutes')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'statutes'
                ? 'border-b-2 border-primary text-primary'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            Statuts
          </button>
          <button
            onClick={() => setActiveTab('internal_rules')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'internal_rules'
                ? 'border-b-2 border-primary text-primary'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            Règlement intérieur
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'bureau' && <BoardMembersList />}
          {activeTab === 'ag_report' && <AdminDocumentsList type="ag_report" title="Comptes rendus d'Assemblée Générale" />}
          {activeTab === 'statutes' && <AdminDocumentsList type="statutes" title="Statuts de l'association" />}
          {activeTab === 'internal_rules' && <AdminDocumentsList type="internal_rules" title="Règlement intérieur" />}
        </div>
      </div>
    </div>
  );
}
