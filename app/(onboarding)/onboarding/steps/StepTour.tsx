import { Upload, MessageSquare, BookOpen, Rss, Network, Clock, BookMarked, FolderOpen, GitFork, CheckSquare, FileSearch, ShieldCheck, ShieldAlert, ListChecks, AudioLines, MapPin, ScanSearch, GitCompare } from 'lucide-react'
import type { ModeConfig } from '@/lib/mode'

interface Props {
 modeConfig: ModeConfig
 onNext: () => void
 onBack: () => void
}

interface Card { icon: React.ReactNode; title: string; desc: string }

export default function StepTour({ modeConfig, onNext, onBack }: Props) {
 const c = modeConfig
 const f = c.features

 const hasNav = (href: string) => f.extraNavItems.some(i => i.href === href)

 const universal: Card[] = [
 { icon: <FolderOpen size={17} className="text-[var(--blue)]" />, title: 'Stories', desc: 'Organise work into named stories. All documents, analysis, and dispatch are scoped to the active story.' },
 { icon: <Upload size={17} className="text-indigo-400" />, title: c.navLibrary, desc: `Upload ${c.documentLabelPlural.toLowerCase()} and get automatic AI summaries, flags, and insights.` },
 { icon: <MessageSquare size={17} className="text-violet-500" />, title: 'Dispatch', desc: `AI assistant. Ask anything about your ${c.documentLabelPlural.toLowerCase()}, get cross-references, draft outputs.` },
 { icon: <BookOpen size={17} className="text-amber-500" />, title: c.navJournal, desc: 'Private notes with AI rewrite and catch-me-up. Organised by folder.' },
 { icon: <FolderOpen size={17} className="text-sky-500" />, title: 'Files', desc: 'Browse and manage files saved by Operator. Analyse documents directly from the folder view.' },
 { icon: <Rss size={17} className="text-emerald-500" />, title: 'Pulse', desc: 'RSS feeds for sources you follow. Save items to your Library in one click.' },
 ]

 const modeSpecific: Card[] = []
 if (f.entities) modeSpecific.push({ icon: <Network size={17} className="text-rose-500" />, title: 'Entities', desc: `Named people, organisations, and places auto-extracted across your ${c.documentLabelPlural.toLowerCase()}.` })
 if (f.entities) modeSpecific.push({ icon: <GitFork size={17} className="text-[#0026c0]" />, title: 'Entity Network', desc: 'Force-directed graph of all extracted entities. Pan, zoom, drag nodes, and highlight clusters.' })
 if (f.timeline) modeSpecific.push({ icon: <Clock size={17} className="text-orange-500" />, title: 'Timeline', desc: `Events assembled into a chronological view from your ${c.documentLabelPlural.toLowerCase()}.` })
 if (f.keywordMonitoring) modeSpecific.push({ icon: <BookMarked size={17} className="text-fuchsia-500" />, title: 'Keyword monitoring', desc: 'Track keywords across Pulse — highlighted whenever they appear in new items.' })
 if (f.investigationTemplate) modeSpecific.push({ icon: <CheckSquare size={17} className="text-emerald-600" />, title: 'Claims Tracker', desc: 'Log factual claims from sources and track their verification status across your investigation.' })
 if (f.investigationTemplate) modeSpecific.push({ icon: <FileSearch size={17} className="text-sky-500" />, title: 'FOIA Tracker', desc: 'Track public records requests from filing to receipt — with overdue alerts and status history.' })
 if (f.investigationTemplate) modeSpecific.push({ icon: <ShieldCheck size={17} className="text-violet-500" />, title: 'File Cleaner', desc: 'Strip EXIF metadata and identifying information from files before sharing or publishing.' })
 if (hasNav('/speakers')) modeSpecific.push({ icon: <AudioLines size={17} className="text-pink-400" />, title: 'Speaker Diarization', desc: 'Upload audio and get speaker-segmented transcripts with per-speaker timelines and talk-time stats.' })
 if (hasNav('/map')) modeSpecific.push({ icon: <MapPin size={17} className="text-orange-500" />, title: 'Photo Map', desc: 'Plot geotagged photos on an interactive map — cluster view, satellite layers, and click-to-inspect EXIF details.' })
 if (hasNav('/analysis')) modeSpecific.push({ icon: <ScanSearch size={17} className="text-violet-500" />, title: 'Image Analysis', desc: 'Forensic image tools: face extraction and comparison, Error Level Analysis (ELA), and AI deepfake detection.' })
 if (hasNav('/research')) modeSpecific.push({ icon: <GitCompare size={17} className="text-emerald-500" />, title: 'Research Tools', desc: 'Wayback Machine lookups and document diff with side-by-side and inline change tracking.' })
 if (hasNav('/risks')) modeSpecific.push({ icon: <ShieldAlert size={17} className="text-[var(--red)]" />, title: 'Risk Register', desc: 'Log risks with probability and impact scores. Track status and assign owners so nothing falls through.' })
 if (hasNav('/actions')) modeSpecific.push({ icon: <ListChecks size={17} className="text-sky-500" />, title: 'Action Tracker', desc: 'Track follow-ups — assignee, due date, priority, and status in one place.' })

 const cards = [...universal, ...modeSpecific]

 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-xl font-semibold text-[var(--text-bright)] mb-1">What you have access to</h2>
 <p className="text-sm text-[var(--text-muted)]">Everything is in the top navigation. Here&apos;s a quick overview.</p>
 </div>

 <div className="grid grid-cols-2 gap-3">
 {cards.map(card => (
 <div key={card.title} className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4">
 <div className="flex items-center gap-2 mb-2">
 {card.icon}
 <span className="text-sm font-medium text-[var(--text-body)]">{card.title}</span>
 </div>
 <p className="text-xs text-[var(--text-muted)] leading-relaxed">{card.desc}</p>
 </div>
 ))}
 </div>

 <div className="flex gap-3">
 <button onClick={onBack} className="flex-1 py-3 bg-[var(--surface-2)] text-[var(--text-body)] text-sm font-medium rounded-[10px] hover:bg-[var(--surface-3)] transition-colors">
 ← Back
 </button>
 <button onClick={onNext} className="flex-[3] py-3 bg-[var(--ink)] text-[var(--ink-contrast)] text-sm font-medium rounded-[10px] hover:opacity-90 transition-colors">
 Continue →
 </button>
 </div>
 </div>
 )
}
