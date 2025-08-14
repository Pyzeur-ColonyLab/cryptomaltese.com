"use client";

import Image from "next/image";
import styles from "./page.module.css";
import IncidentForm from './IncidentForm';
import Analyse from './analyse/page';
import React, { useState } from 'react';

export default function Home() {
  const [tab, setTab] = useState<'report-incident' | 'analyse'>('report-incident');
  return (
    <main style={{ width: '100%', maxWidth: '100vw' }}>
      <div style={{
        display: 'flex', 
        justifyContent: 'center', 
        marginTop: '2rem', 
        marginBottom: '1.5rem',
        width: '100%',
        maxWidth: '1200px',
        margin: '2rem auto 1.5rem auto'
      }}>
        <button
          onClick={() => setTab('report-incident')}
          style={{
            background: tab === 'report-incident' ? '#6366f1' : '#eaf4fb',
            color: tab === 'report-incident' ? '#fff' : '#6366f1',
            border: 'none',
            borderRadius: '8px 0 0 8px',
            padding: '0.8rem 1.5rem',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'background 0.2s',
            outline: 'none',
            flex: 1,
            maxWidth: '200px'
          }}
        >
          Report Incident
        </button>
        <button
          onClick={() => setTab('analyse')}
          style={{
            background: tab === 'analyse' ? '#6366f1' : '#eaf4fb',
            color: tab === 'analyse' ? '#fff' : '#6366f1',
            border: 'none',
            borderRadius: '0 8px 8px 0',
            padding: '0.8rem 1.5rem',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'background 0.2s',
            outline: 'none',
            flex: 1,
            maxWidth: '200px'
          }}
        >
          Analyse
        </button>
      </div>
      {tab === 'report-incident' && <IncidentForm />}
      {tab === 'analyse' && <Analyse />}
    </main>
  );
}
