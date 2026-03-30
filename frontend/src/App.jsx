import { useState, useEffect } from 'react'
import ResumeInput from './components/ResumeInput'
import ResultsPanel from './components/ResultsPanel'
import JobDescriptionPanel from './components/JobDescriptionPanel'
import RulesManager from './components/RulesManager'

const API_BASE = 'http://localhost:5000/api'

function App() {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [jobDescriptions, setJobDescriptions] = useState({})
  const [selectedJD, setSelectedJD] = useState(null)
  const [step, setStep] = useState('job')  // 'job' -> 'rules' -> 'resume' -> 'results'

  // Load job descriptions on mount
  useEffect(() => {
    fetchJobDescriptions()
  }, [])

  const fetchJobDescriptions = async () => {
    try {
      const res = await fetch(`${API_BASE}/job-descriptions`)
      const data = await res.json()
      setJobDescriptions(data)
      // Auto-select first if none selected
      if (!selectedJD && Object.keys(data).length > 0) {
        setSelectedJD(Object.keys(data)[0])
      }
    } catch (err) {
      console.error('Failed to load job descriptions:', err)
    }
  }

  const handleSelectJD = (jdId) => {
    setSelectedJD(jdId)
  }

  const handleProceedToRules = () => {
    if (selectedJD) setStep('rules')
  }

  const handleProceedToResume = () => {
    setStep('resume')
  }

  const handleResults = (data) => {
    setResults(data)
    setStep('results')
  }

  const handleReset = () => {
    setResults(null)
    setStep('job')
  }

  const handleBackToJob = () => {
    setStep('job')
  }

  const handleBackToRules = () => {
    setStep('rules')
  }

  const stepLabels = [
    { key: 'job', label: '1. Job Description', icon: '💼' },
    { key: 'rules', label: '2. Rules', icon: '📋' },
    { key: 'resume', label: '3. Resume', icon: '📄' },
    { key: 'results', label: '4. Results', icon: '📊' },
  ]

  const currentStepIndex = stepLabels.findIndex(s => s.key === step)

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>AI Resume Screener</h1>
        <p className="subtitle">
          Explainable Hybrid AI — Rule-Based Reasoning + Interpretable Machine Learning
        </p>
        <div className="header-badges">
          <span className="badge"><span className="dot"></span> Logistic Regression</span>
          <span className="badge"><span className="dot"></span> Naive Bayes</span>
          <span className="badge"><span className="dot"></span> Rule Engine</span>
          <span className="badge"><span className="dot"></span> PII Masking</span>
          <span className="badge"><span className="dot"></span> PDF Upload</span>
        </div>
      </header>

      {/* Step Indicator */}
      <div className="step-indicator">
        {stepLabels.map((s, i) => (
          <div key={s.key} className={`step-item ${i <= currentStepIndex ? 'active' : ''} ${step === s.key ? 'current' : ''}`}>
            <div className="step-dot">{i < currentStepIndex ? '✓' : s.icon}</div>
            <span className="step-label">{s.label}</span>
            {i < stepLabels.length - 1 && <div className="step-line" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === 'job' && (
        <JobDescriptionPanel
          jobDescriptions={jobDescriptions}
          selectedJD={selectedJD}
          onSelectJD={handleSelectJD}
          onJobDescriptionsUpdated={fetchJobDescriptions}
          onProceed={handleProceedToRules}
        />
      )}

      {step === 'rules' && selectedJD && (
        <RulesManager
          jobCategory={selectedJD}
          jobTitle={jobDescriptions[selectedJD]?.title || selectedJD}
          onProceed={handleProceedToResume}
          onBack={handleBackToJob}
        />
      )}

      {step === 'resume' && selectedJD && (
        <ResumeInput
          jobCategory={selectedJD}
          jobTitle={jobDescriptions[selectedJD]?.title || selectedJD}
          onResults={handleResults}
          setLoading={setLoading}
          onBack={handleBackToRules}
        />
      )}

      {step === 'results' && results && (
        <ResultsPanel results={results} onReset={handleReset} />
      )}

      <footer style={{
        textAlign: 'center',
        marginTop: '3rem',
        padding: '1.5rem',
        color: 'var(--text-muted)',
        fontSize: '0.75rem',
        borderTop: '1px solid var(--border-glass)',
      }}>
        <p>Explainable Hybrid AI System for Resume Screening</p>
        <p style={{ marginTop: '0.25rem' }}>
          Introduction to Artificial Intelligence — University of Windsor
        </p>
      </footer>
    </div>
  )
}

export default App
