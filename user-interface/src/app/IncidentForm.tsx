"use client";

import React, { useState } from 'react';
import styles from './IncidentForm.module.css';

const CHAINS = [
  { label: 'Ethereum', value: 'ethereum' },
  { label: 'Avalanche', value: 'avalanche' },
  { label: 'Bitcoin', value: 'bitcoin' },
];

interface FormState {
  wallet_address: string;
  chain: string;
  description: string;
  discovered_at: string;
  tx_hash: string;
}

const initialState: FormState = {
  wallet_address: '',
  chain: 'ethereum',
  description: '',
  discovered_at: '',
  tx_hash: '',
};

export default function IncidentForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [incidentId, setIncidentId] = useState<string | null>(null);

  function validateLocal(): boolean {
    const errs: string[] = [];
    if (!form.wallet_address) errs.push('Wallet address is required.');
    if (!/^0x[a-fA-F0-9]{40}$/.test(form.wallet_address) && form.chain !== 'bitcoin') errs.push('Invalid wallet address format.');
    if (!form.description) errs.push('Incident description is required.');
    if (!form.discovered_at) errs.push('Discovery date/time is required.');
    if (!form.tx_hash) errs.push('Transaction hash is required.');
    setErrors(errs);
    return errs.length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('');
    setIncidentId(null);
    if (!validateLocal()) return;
    setLoading(true);
    setErrors([]);
    // 1. Validate address with backend
    const validateRes = await fetch('/api/validate-address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: form.wallet_address, chain: form.chain }),
    });
    const validateData = await validateRes.json();
    if (!validateData.valid) {
      setErrors([validateData.error || 'Address validation failed.']);
      setLoading(false);
      return;
    }
    // 2. Submit incident
    const submitRes = await fetch('/api/submit-incident', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const submitData = await submitRes.json();
    if (!submitRes.ok) {
      setErrors([submitData.error || 'Incident submission failed.']);
      setLoading(false);
      return;
    }
    setIncidentId(submitData.incident_id);
    setStatus('Incident submitted successfully!');
    setLoading(false);
    setForm(initialState);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2>Report Web3 Hack Incident</h2>
      <label>
        Wallet Address
        <input
          type="text"
          value={form.wallet_address}
          onChange={e => setForm(f => ({ ...f, wallet_address: e.target.value }))}
          placeholder="0x..."
          required
        />
      </label>
      <label>
        Chain
        <select
          value={form.chain}
          onChange={e => setForm(f => ({ ...f, chain: e.target.value }))}
        >
          {CHAINS.map(chain => (
            <option key={chain.value} value={chain.value}>{chain.label}</option>
          ))}
        </select>
      </label>
      <label>
        Incident Description
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Describe what happened..."
          rows={4}
          required
        />
      </label>
      <label>
        Discovery Date/Time
        <input
          type="datetime-local"
          value={form.discovered_at}
          onChange={e => setForm(f => ({ ...f, discovered_at: e.target.value }))}
          required
        />
      </label>
      <label>
        Transaction Hash
        <input
          type="text"
          value={form.tx_hash}
          onChange={e => setForm(f => ({ ...f, tx_hash: e.target.value }))}
          placeholder="0x... or Bitcoin txid"
          required
        />
      </label>
      {errors.length > 0 && (
        <div className={styles.errors}>
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}
      {status && <div className={styles.status}>{status}</div>}
      {incidentId && (
        <div className={styles.status}>
          Incident ID: <span style={{fontFamily: 'monospace'}}>{incidentId}</span>
        </div>
      )}
      <button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Incident'}</button>
    </form>
  );
} 