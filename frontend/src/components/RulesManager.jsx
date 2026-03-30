import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:5000/api'

export default function RulesManager({ jobCategory, jobTitle, onProceed, onBack }) {
    const [rules, setRules] = useState([])
    const [showAddForm, setShowAddForm] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        field: 'skills_found',
        operator: 'contains',
        value: '',
        is_critical: false,
        description: '',
    })

    useEffect(() => {
        fetchRules()
    }, [jobCategory])

    const fetchRules = async () => {
        try {
            const res = await fetch(`${API_BASE}/rules/${jobCategory}`)
            const data = await res.json()
            setRules(data)
        } catch (err) {
            console.error('Failed to fetch rules:', err)
        }
    }

    const handleAddRule = async () => {
        if (!formData.name.trim()) return

        try {
            const res = await fetch(`${API_BASE}/rules/${jobCategory}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    description: formData.description || formData.name,
                }),
            })
            if (res.ok) {
                fetchRules()
                setShowAddForm(false)
                setFormData({ name: '', field: 'skills_found', operator: 'contains', value: '', is_critical: false, description: '' })
            }
        } catch (err) {
            console.error('Failed to add rule:', err)
        }
    }

    const handleDeleteRule = async (ruleId) => {
        try {
            await fetch(`${API_BASE}/rules/${jobCategory}/${ruleId}`, { method: 'DELETE' })
            fetchRules()
        } catch (err) {
            console.error('Failed to delete rule:', err)
        }
    }

    const fieldOptions = [
        { value: 'skills_found', label: 'Skills (contains/not contains)' },
        { value: 'skill_match_ratio', label: 'Skill Match Ratio (0-1)' },
        { value: 'experience_years', label: 'Experience Years' },
        { value: 'education_score', label: 'Education Score (0-4)' },
        { value: 'total_skills_count', label: 'Total Skills Count' },
    ]

    const operatorOptions = {
        skills_found: [
            { value: 'contains', label: 'Contains' },
            { value: 'not_contains', label: 'Does Not Contain' },
        ],
        skill_match_ratio: [
            { value: 'gte', label: '≥ (at least)' },
            { value: 'lte', label: '≤ (at most)' },
        ],
        experience_years: [
            { value: 'gte', label: '≥ (at least)' },
            { value: 'lte', label: '≤ (at most)' },
        ],
        education_score: [
            { value: 'gte', label: '≥ (at least)' },
            { value: 'lte', label: '≤ (at most)' },
        ],
        total_skills_count: [
            { value: 'gte', label: '≥ (at least)' },
            { value: 'lte', label: '≤ (at most)' },
        ],
    }

    const getOperators = () => operatorOptions[formData.field] || operatorOptions.skill_match_ratio

    return (
        <div style={{ animation: 'fadeInUp 0.5s ease' }}>
            <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
                <h2><span className="icon">📋</span> Custom Rules for: {jobTitle}</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                    Add custom screening rules beyond the default checks. These rules will be applied during resume evaluation.
                    The system already includes 4 built-in rules (experience, skills, education, technical breadth).
                </p>

                {/* Default Rules Info */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        🔒 Built-in Rules (always active)
                    </p>
                    <div className="animate-in">
                        <div className="rule-item">
                            <span className="rule-status">🔒</span>
                            <div className="rule-info">
                                <h4>Minimum Experience <span className="critical-badge">CRITICAL</span></h4>
                                <p>Checks minimum years of experience from the job description</p>
                            </div>
                        </div>
                        <div className="rule-item">
                            <span className="rule-status">🔒</span>
                            <div className="rule-info">
                                <h4>Skill Match Threshold <span className="critical-badge">CRITICAL</span></h4>
                                <p>At least 50% of required skills must match</p>
                            </div>
                        </div>
                        <div className="rule-item">
                            <span className="rule-status">🔒</span>
                            <div className="rule-info">
                                <h4>Education Requirement</h4>
                                <p>Checks minimum education level from the job description</p>
                            </div>
                        </div>
                        <div className="rule-item">
                            <span className="rule-status">🔒</span>
                            <div className="rule-info">
                                <h4>Technical Breadth</h4>
                                <p>Minimum 3 technical skills required</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Custom Rules */}
                {rules.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>
                            ✨ Custom Rules ({rules.length})
                        </p>
                        <div className="animate-in">
                            {rules.map((rule) => (
                                <div key={rule.id} className="rule-item" style={{ borderLeft: '2px solid var(--accent-cyan)' }}>
                                    <span className="rule-status">✨</span>
                                    <div className="rule-info" style={{ flex: 1 }}>
                                        <h4>
                                            {rule.name}
                                            {rule.is_critical && <span className="critical-badge">CRITICAL</span>}
                                        </h4>
                                        <p>
                                            {rule.field.replace(/_/g, ' ')} {rule.operator} "{rule.value}"
                                            {rule.description !== rule.name && ` — ${rule.description}`}
                                        </p>
                                    </div>
                                    <button
                                        className="btn-icon-sm"
                                        onClick={() => handleDeleteRule(rule.id)}
                                        title="Remove rule"
                                    >🗑️</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Add Rule Form */}
                {showAddForm ? (
                    <div className="add-rule-form">
                        <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>➕ Add Custom Rule</h3>
                        <div className="form-group">
                            <label>Rule Name *</label>
                            <input type="text" className="form-input" value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Must know Docker" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group">
                                <label>Field to Check</label>
                                <select className="form-input" value={formData.field}
                                    onChange={(e) => setFormData({ ...formData, field: e.target.value, operator: operatorOptions[e.target.value]?.[0]?.value || 'gte' })}>
                                    {fieldOptions.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Operator</label>
                                <select className="form-input" value={formData.operator}
                                    onChange={(e) => setFormData({ ...formData, operator: e.target.value })}>
                                    {getOperators().map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Value</label>
                            <input type="text" className="form-input" value={formData.value}
                                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                placeholder={formData.field === 'skills_found' ? 'e.g. docker' : 'e.g. 5'} />
                        </div>
                        <div className="form-group">
                            <label>Description (optional)</label>
                            <input type="text" className="form-input" value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Why is this rule important?" />
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input type="checkbox" id="is-critical" checked={formData.is_critical}
                                onChange={(e) => setFormData({ ...formData, is_critical: e.target.checked })} />
                            <label htmlFor="is-critical" style={{ margin: 0, cursor: 'pointer' }}>
                                Mark as Critical (failing rejects candidate regardless of ML score)
                            </label>
                        </div>
                        <div className="btn-group">
                            <button className="btn-primary" onClick={handleAddRule} disabled={!formData.name.trim() || !formData.value.trim()}
                                style={{ flex: 1 }}>
                                ✅ Add Rule
                            </button>
                            <button className="btn-secondary" onClick={() => setShowAddForm(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button className="btn-secondary" style={{ width: '100%' }}
                        onClick={() => setShowAddForm(true)}>
                        + Add Custom Rule
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-secondary" onClick={onBack} style={{ flex: '0 0 auto' }}>
                    ← Back to Job Descriptions
                </button>
                <button className="btn-primary" onClick={onProceed} style={{ flex: 1 }}>
                    Next: Upload Resume →
                </button>
            </div>
        </div>
    )
}
