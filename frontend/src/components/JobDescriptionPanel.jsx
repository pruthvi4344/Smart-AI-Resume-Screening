import { useState } from 'react'

const API_BASE = 'http://localhost:5000/api'

export default function JobDescriptionPanel({ jobDescriptions, selectedJD, onSelectJD, onJobDescriptionsUpdated, onProceed }) {
    const [showAddForm, setShowAddForm] = useState(false)
    const [addMode, setAddMode] = useState('manual')  // 'manual', 'text', 'pdf'
    const [formData, setFormData] = useState({
        title: '',
        required_skills: '',
        preferred_skills: '',
        min_experience: 0,
        min_education: 'bachelor',
        description: '',
    })
    const [jdText, setJdText] = useState('')
    const [uploading, setUploading] = useState(false)

    const handleManualSubmit = async () => {
        if (!formData.title.trim()) return

        try {
            const res = await fetch(`${API_BASE}/job-descriptions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    required_skills: formData.required_skills.split(',').map(s => s.trim()).filter(Boolean),
                    preferred_skills: formData.preferred_skills.split(',').map(s => s.trim()).filter(Boolean),
                }),
            })
            const data = await res.json()
            if (res.ok) {
                onSelectJD(data.id)
                onJobDescriptionsUpdated()
                setShowAddForm(false)
                resetForm()
            }
        } catch (err) {
            console.error('Failed to create JD:', err)
        }
    }

    const handleTextSubmit = async () => {
        if (!jdText.trim()) return
        setUploading(true)

        try {
            const res = await fetch(`${API_BASE}/job-descriptions/from-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: jdText }),
            })
            const data = await res.json()
            if (res.ok) {
                onSelectJD(data.id)
                onJobDescriptionsUpdated()
                setShowAddForm(false)
                setJdText('')
            }
        } catch (err) {
            console.error('Failed to parse JD text:', err)
        } finally {
            setUploading(false)
        }
    }

    const handlePdfUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setUploading(true)

        try {
            const uploadData = new FormData()
            uploadData.append('file', file)
            const res = await fetch(`${API_BASE}/upload-pdf`, {
                method: 'POST',
                body: uploadData,
            })
            const result = await res.json()
            if (res.ok && result.text) {
                // Now auto-generate JD from the extracted text
                const jdRes = await fetch(`${API_BASE}/job-descriptions/from-text`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: result.text }),
                })
                const jdData = await jdRes.json()
                if (jdRes.ok) {
                    onSelectJD(jdData.id)
                    onJobDescriptionsUpdated()
                    setShowAddForm(false)
                }
            } else {
                alert(result.error || 'PDF upload failed')
            }
        } catch (err) {
            console.error('PDF upload failed:', err)
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (jdId) => {
        try {
            await fetch(`${API_BASE}/job-descriptions/${jdId}`, { method: 'DELETE' })
            onJobDescriptionsUpdated()
            if (selectedJD === jdId) {
                const remaining = Object.keys(jobDescriptions).filter(k => k !== jdId)
                onSelectJD(remaining[0] || null)
            }
        } catch (err) {
            console.error('Delete failed:', err)
        }
    }

    const resetForm = () => {
        setFormData({ title: '', required_skills: '', preferred_skills: '', min_experience: 0, min_education: 'bachelor', description: '' })
    }

    const jdList = Object.values(jobDescriptions)
    const selected = selectedJD ? jobDescriptions[selectedJD] : null

    return (
        <div style={{ animation: 'fadeInUp 0.5s ease' }}>
            <div className="input-section">
                {/* Job Descriptions List */}
                <div className="glass-card">
                    <h2><span className="icon">💼</span> Job Descriptions</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        Select a job description or add a new one. This defines what the system screens resumes against.
                    </p>

                    <div className="jd-list">
                        {jdList.map((jd) => (
                            <div
                                key={jd.id}
                                className={`jd-item ${selectedJD === jd.id ? 'selected' : ''}`}
                                onClick={() => onSelectJD(jd.id)}
                            >
                                <div className="jd-item-header">
                                    <span className="jd-title">{jd.title}</span>
                                    <div className="jd-item-actions">
                                        {jd.is_sample && <span className="badge-sm sample">Sample</span>}
                                        {!jd.is_sample && (
                                            <button
                                                className="btn-icon-sm"
                                                onClick={(e) => { e.stopPropagation(); handleDelete(jd.id); }}
                                                title="Delete"
                                            >🗑️</button>
                                        )}
                                    </div>
                                </div>
                                <div className="jd-meta">
                                    <span>⏱ {jd.min_experience}+ yrs</span>
                                    <span>🎓 {jd.min_education}</span>
                                    <span>🔧 {jd.required_skills?.length || 0} skills</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        className="btn-secondary"
                        style={{ width: '100%', marginTop: '1rem' }}
                        onClick={() => setShowAddForm(!showAddForm)}
                    >
                        {showAddForm ? '✕ Cancel' : '+ Add Job Description'}
                    </button>
                </div>

                {/* Selected JD Detail OR Add Form */}
                <div className="glass-card">
                    {showAddForm ? (
                        <>
                            <h2><span className="icon">➕</span> New Job Description</h2>
                            <div className="btn-group" style={{ marginBottom: '1rem' }}>
                                <button className={`btn-secondary ${addMode === 'manual' ? 'active-btn' : ''}`} onClick={() => setAddMode('manual')}>
                                    ✏️ Manual
                                </button>
                                <button className={`btn-secondary ${addMode === 'text' ? 'active-btn' : ''}`} onClick={() => setAddMode('text')}>
                                    📝 Paste Text
                                </button>
                                <button className={`btn-secondary ${addMode === 'pdf' ? 'active-btn' : ''}`} onClick={() => setAddMode('pdf')}>
                                    📄 Upload PDF
                                </button>
                            </div>

                            {addMode === 'manual' && (
                                <div>
                                    <div className="form-group">
                                        <label>Job Title *</label>
                                        <input type="text" className="form-input" value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            placeholder="e.g. Frontend Developer" />
                                    </div>
                                    <div className="form-group">
                                        <label>Required Skills (comma-separated)</label>
                                        <input type="text" className="form-input" value={formData.required_skills}
                                            onChange={(e) => setFormData({ ...formData, required_skills: e.target.value })}
                                            placeholder="e.g. react, javascript, css, html" />
                                    </div>
                                    <div className="form-group">
                                        <label>Preferred Skills (comma-separated)</label>
                                        <input type="text" className="form-input" value={formData.preferred_skills}
                                            onChange={(e) => setFormData({ ...formData, preferred_skills: e.target.value })}
                                            placeholder="e.g. typescript, next.js, graphql" />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        <div className="form-group">
                                            <label>Min Experience (years)</label>
                                            <input type="number" className="form-input" min="0" value={formData.min_experience}
                                                onChange={(e) => setFormData({ ...formData, min_experience: parseInt(e.target.value) || 0 })} />
                                        </div>
                                        <div className="form-group">
                                            <label>Min Education</label>
                                            <select className="form-input" value={formData.min_education}
                                                onChange={(e) => setFormData({ ...formData, min_education: e.target.value })}>
                                                <option value="high school">High School</option>
                                                <option value="associate">Associate</option>
                                                <option value="bachelor">Bachelor</option>
                                                <option value="master">Master</option>
                                                <option value="phd">PhD</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Description</label>
                                        <textarea className="form-textarea-sm" value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Job description details..." rows={3} />
                                    </div>
                                    <button className="btn-primary" onClick={handleManualSubmit} disabled={!formData.title.trim()}>
                                        ✅ Create Job Description
                                    </button>
                                </div>
                            )}

                            {addMode === 'text' && (
                                <div>
                                    <div className="form-group">
                                        <label>Paste job posting text (skills, requirements, etc. will be auto-extracted)</label>
                                        <textarea value={jdText} onChange={(e) => setJdText(e.target.value)}
                                            placeholder={"Paste the full job posting text here...\n\nThe system will automatically extract:\n- Job title\n- Required skills\n- Experience requirements\n- Education level"}
                                            rows={10} />
                                    </div>
                                    <button className="btn-primary" onClick={handleTextSubmit} disabled={uploading || !jdText.trim()}>
                                        {uploading ? <><span className="loading-spinner" /> Parsing...</> : '🔍 Auto-Extract & Create'}
                                    </button>
                                </div>
                            )}

                            {addMode === 'pdf' && (
                                <div>
                                    <div className="upload-zone">
                                        <input type="file" accept=".pdf" onChange={handlePdfUpload} id="jd-pdf-upload" style={{ display: 'none' }} />
                                        <label htmlFor="jd-pdf-upload" className="upload-label">
                                            {uploading ? (
                                                <><span className="loading-spinner" /> Processing PDF...</>
                                            ) : (
                                                <>
                                                    <span style={{ fontSize: '2rem' }}>📄</span>
                                                    <span>Click to upload a job posting PDF</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        Skills and requirements will be auto-extracted
                                                    </span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : selected ? (
                        <>
                            <h2><span className="icon">📋</span> {selected.title}</h2>
                            {selected.description && (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.7 }}>
                                    {selected.description}
                                </p>
                            )}
                            <div style={{ marginBottom: '0.75rem' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Required Skills</p>
                                <div className="skills-tags">
                                    {(selected.required_skills || []).map((s, i) => (
                                        <span key={i} className="skill-tag matched">{s}</span>
                                    ))}
                                </div>
                            </div>
                            {selected.preferred_skills?.length > 0 && (
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Preferred Skills</p>
                                    <div className="skills-tags">
                                        {selected.preferred_skills.map((s, i) => (
                                            <span key={i} className="skill-tag" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--accent-indigo)' }}>{s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="jd-stats">
                                <div className="stat-item">
                                    <span className="stat-label">Min Experience</span>
                                    <span className="stat-value">{selected.min_experience}+ years</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Min Education</span>
                                    <span className="stat-value" style={{ textTransform: 'capitalize' }}>{selected.min_education}</span>
                                </div>
                            </div>
                            <button className="btn-primary" onClick={onProceed} style={{ marginTop: '1rem' }}>
                                Next: Configure Rules →
                            </button>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💼</p>
                            <p style={{ color: 'var(--text-muted)' }}>Select a job description to view details</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
