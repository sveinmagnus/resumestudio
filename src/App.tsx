import { useStore } from './store/useStore'
import { ImportScreen } from './components/ImportScreen'
import { Sidebar } from './components/layout/Sidebar'
import { LanguageSwitcher } from './components/layout/LanguageSwitcher'
import { SECTIONS } from './lib/sections'
import { Overview } from './components/editor/Overview'
import { HeaderEditor } from './components/editor/HeaderEditor'
import { ProjectsEditor } from './components/editor/ProjectsEditor'
import {
  WorkEditor, EducationEditor, CoursesEditor, CertificationsEditor,
  PositionsEditor, PresentationsEditor, PublicationsEditor, AwardsEditor,
  SpokenLanguagesEditor, ProfileEditor,
} from './components/editor/SimpleEditors'
import { SkillsEditor, RolesEditor, ReferencesEditor, TechCategoriesEditor } from './components/editor/RegistryEditors'
import { ResumeViewsEditor } from './components/editor/ResumeViewsEditor'
import { Download, FileJson } from 'lucide-react'

export default function App() {
  const { hasData, activeSection, data } = useStore()

  if (!hasData) return <ImportScreen />

  const section = SECTIONS.find((s) => s.key === activeSection)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.resume?.full_name?.replace(/\s+/g, '_') || 'resume'}_master.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <header className="app-header">
          <div className="ah-titles">
            <div className="ah-crumb">{section?.group}</div>
            <h1 className="ah-title">{section?.label}</h1>
          </div>
          <div className="ah-controls">
            <LanguageSwitcher />
            <button className="ah-export" onClick={exportJson} title="Export master data as JSON">
              <Download size={16} /> Export
            </button>
          </div>
        </header>

        <div className="app-content">
          {activeSection === 'overview' && <Overview />}
          {activeSection === 'header' && <HeaderEditor />}
          {activeSection === 'key_qualifications' && <ProfileEditor />}
          {activeSection === 'projects' && <ProjectsEditor />}
          {activeSection === 'work_experiences' && <WorkEditor />}
          {activeSection === 'positions' && <PositionsEditor />}
          {activeSection === 'educations' && <EducationEditor />}
          {activeSection === 'courses' && <CoursesEditor />}
          {activeSection === 'certifications' && <CertificationsEditor />}
          {activeSection === 'technology_categories' && <TechCategoriesEditor />}
          {activeSection === 'spoken_languages' && <SpokenLanguagesEditor />}
          {activeSection === 'presentations' && <PresentationsEditor />}
          {activeSection === 'publications' && <PublicationsEditor />}
          {activeSection === 'honor_awards' && <AwardsEditor />}
          {activeSection === 'references' && <ReferencesEditor />}
          {activeSection === 'skills' && <SkillsEditor />}
          {activeSection === 'roles' && <RolesEditor />}
          {activeSection === 'views' && <ResumeViewsEditor />}
        </div>
      </main>

      <style>{`
        .app-shell { display: flex; min-height: 100vh; position: relative; z-index: 1; }
        .app-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .app-header {
          display: flex; align-items: flex-end; justify-content: space-between; gap: 20px;
          padding: 22px 36px 18px; border-bottom: 1px solid var(--line);
          position: sticky; top: 0; background: var(--paper); z-index: 10; flex-wrap: wrap;
        }
        .ah-crumb { font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--accent); }
        .ah-title { font-size: 30px; margin-top: 2px; }
        .ah-controls { display: flex; align-items: center; gap: 12px; }
        .ah-export {
          display: inline-flex; align-items: center; gap: 7px; padding: 11px 18px;
          background: var(--ink); color: var(--paper); border-radius: var(--r-md);
          font-weight: 600; font-size: 14px; transition: all .15s; align-self: stretch;
        }
        .ah-export:hover { background: var(--accent); }
        .app-content { padding: 28px 36px 80px; max-width: 1000px; width: 100%; }
      `}</style>
    </div>
  )
}
