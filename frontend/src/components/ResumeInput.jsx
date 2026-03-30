import { useState } from 'react'

const API_BASE = 'http://localhost:5000/api'

export default function ResumeInput({ jobCategory, jobTitle, onResults, setLoading, onBack }) {
    const [resumeText, setResumeText] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [inputMode, setInputMode] = useState('text')  // 'text' or 'pdf'
    const [pdfFile, setPdfFile] = useState(null)

    const sampleResumes = {
        strong: `John Smith
john.smith@email.com | (416) 555-1234
linkedin.com/in/john-smith

SUMMARY
Senior Software Engineer with 6 years of experience building scalable applications.
Passionate about clean code and system design.

EDUCATION
Master of Science in Computer Science
University of Waterloo, 2016 - 2018

EXPERIENCE
Senior Software Engineer at Google
2018 - Present
- Designed and implemented microservices using Python and Java
- Built data pipelines processing 1M+ records daily using SQL and PostgreSQL
- Led a team of 5 engineers, mentoring junior developers
- Implemented CI/CD pipelines with Docker and Kubernetes on AWS
- Improved system reliability by 40% through automated testing

Junior Developer at Shopify
2016 - 2018
- Developed REST APIs using Python and Flask
- Worked with MongoDB and Redis for caching solutions
- Practiced agile development with scrum methodology

SKILLS
Technical Skills: python, java, sql, git, docker, kubernetes, aws, postgresql, mongodb, react, agile, ci/cd, data structures

CERTIFICATIONS
AWS Certified Solutions Architect`,

        average: `Sarah Lee
sarahlee@mail.com | (905) 555-5678

SUMMARY
Developer with 2 years of experience in web development.

EDUCATION
Bachelor of Science in Computer Science
University of Windsor, 2019 - 2023

EXPERIENCE
Junior Developer at TechStartup Inc.
2023 - Present
- Built features using Python and JavaScript
- Worked with SQL databases
- Participated in code reviews

SKILLS
Technical Skills: python, javascript, sql, html, css, git`,

        weak: `Jane Doe
janedoe@email.com | (905) 555-9876

SUMMARY
Recent graduate looking for entry-level opportunities.

EDUCATION
Bachelor of Arts in English Literature
Community College, 2020 - 2024

EXPERIENCE
Retail Associate at Local Store
2022 - 2024
- Assisted customers with purchases
- Managed inventory using basic spreadsheets

SKILLS
Technical Skills: html, css, microsoft office`,
    }

    const handleLoadSample = (type) => {
        setInputMode('text')
        setResumeText(sampleResumes[type])
        setPdfFile(null)
    }

    const handlePdfChange = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setPdfFile(file)

        // Extract text from PDF
        const formData = new FormData()
        formData.append('file', file)

        try {
            const res = await fetch(`${API_BASE}/upload-pdf`, {
                method: 'POST',
                body: formData,
            })
            const data = await res.json()
            if (res.ok && data.text) {
                setResumeText(data.text)
                setInputMode('text')  // Show extracted text
            } else {
                alert(data.error || 'Failed to extract text from PDF')
            }
        } catch (err) {
            console.error('PDF upload failed:', err)
            alert('Failed to upload PDF. Make sure the backend is running.')
        }
    }

    const handleSubmit = async () => {
        if (!resumeText.trim()) return

        setSubmitting(true)
        setLoading(true)

        try {
            const res = await fetch(`${API_BASE}/screen`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resume_text: resumeText,
                    job_category: jobCategory,
                }),
            })

            const data = await res.json()
            onResults(data)
        } catch (err) {
            console.error('Screening failed:', err)
            onResults({ error: 'Failed to connect to the screening API. Make sure the backend is running on port 5000.' })
        } finally {
            setSubmitting(false)
            setLoading(false)
        }
    }

    return (
        <div style={{ animation: 'fadeInUp 0.5s ease' }}>
            <div className="input-section">
                {/* Resume Input */}
                <div className="glass-card">
                    <h2><span className="icon">📄</span> Resume Input</h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        Screening against: <strong style={{ color: 'var(--accent-cyan)' }}>{jobTitle}</strong>
                    </p>

                    {/* Input Mode Toggle */}
                    <div className="btn-group" style={{ marginBottom: '1rem' }}>
                        <button className={`btn-secondary ${inputMode === 'text' ? 'active-btn' : ''}`} onClick={() => setInputMode('text')}>
                            ✏️ Paste Text
                        </button>
                        <button className={`btn-secondary ${inputMode === 'pdf' ? 'active-btn' : ''}`} onClick={() => setInputMode('pdf')}>
                            📄 Upload PDF
                        </button>
                    </div>

                    {/* Sample Resumes */}
                    <div className="btn-group" style={{ marginBottom: '1rem' }}>
                        <button className="btn-secondary" onClick={() => handleLoadSample('strong')}>
                            ✅ Strong
                        </button>
                        <button className="btn-secondary" onClick={() => handleLoadSample('average')}>
                            ⚠️ Average
                        </button>
                        <button className="btn-secondary" onClick={() => handleLoadSample('weak')}>
                            ❌ Weak
                        </button>
                        <button className="btn-secondary" onClick={() => { setResumeText(''); setPdfFile(null); }}>
                            Clear
                        </button>
                    </div>

                    {inputMode === 'pdf' && !resumeText && (
                        <div className="upload-zone" style={{ marginBottom: '1rem' }}>
                            <input type="file" accept=".pdf" onChange={handlePdfChange} id="resume-pdf" style={{ display: 'none' }} />
                            <label htmlFor="resume-pdf" className="upload-label">
                                <span style={{ fontSize: '2rem' }}>📄</span>
                                <span>Click to upload a resume PDF</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Text will be extracted automatically
                                </span>
                            </label>
                        </div>
                    )}

                    {pdfFile && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-green)', marginBottom: '0.75rem' }}>
                            ✅ Loaded from PDF: {pdfFile.name}
                        </div>
                    )}

                    <div className="form-group">
                        <label>{pdfFile ? 'Extracted Text (editable)' : 'Paste resume text below'}</label>
                        <textarea
                            value={resumeText}
                            onChange={(e) => setResumeText(e.target.value)}
                            placeholder="Paste the candidate's resume text here...&#10;&#10;Include sections like Summary, Education, Experience, and Skills for best results."
                            rows={12}
                        />
                    </div>
                </div>

                {/* Pipeline Info */}
                <div className="glass-card">
                    <h2><span className="icon">⚙️</span> Screening Pipeline</h2>
                    <div className="pipeline-steps">
                        <div className="pipeline-step">
                            <span className="pipeline-num">1</span>
                            <div>
                                <strong>PII Detection & Masking</strong>
                                <p>Detect and mask emails, phone numbers, names, addresses</p>
                            </div>
                        </div>
                        <div className="pipeline-step">
                            <span className="pipeline-num">2</span>
                            <div>
                                <strong>Feature Extraction</strong>
                                <p>Extract skills, experience, education from resume text</p>
                            </div>
                        </div>
                        <div className="pipeline-step">
                            <span className="pipeline-num">3</span>
                            <div>
                                <strong>Rule-Based Evaluation</strong>
                                <p>Apply built-in + custom rules against job requirements</p>
                            </div>
                        </div>
                        <div className="pipeline-step">
                            <span className="pipeline-num">4</span>
                            <div>
                                <strong>ML Hybrid Analysis</strong>
                                <p>score = 0.5 × LR + 0.5 × NB (linear combination)</p>
                            </div>
                        </div>
                        <div className="pipeline-step">
                            <span className="pipeline-num">5</span>
                            <div>
                                <strong>Explanation Generation</strong>
                                <p>Human-readable reasoning for accept/reject decision</p>
                            </div>
                        </div>
                    </div>

                    <button
                        className="btn-primary"
                        onClick={handleSubmit}
                        disabled={submitting || !resumeText.trim()}
                        style={{ marginTop: '1.5rem' }}
                    >
                        {submitting ? (
                            <><span className="loading-spinner" /> Screening...</>
                        ) : (
                            <>🔍 Screen Resume</>
                        )}
                    </button>

                    <button className="btn-secondary" onClick={onBack}
                        style={{ width: '100%', marginTop: '0.75rem' }}>
                        ← Back to Rules
                    </button>
                </div>
            </div>
        </div>
    )
}
