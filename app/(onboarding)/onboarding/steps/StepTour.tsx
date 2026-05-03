import { Upload, MessageSquare, BookOpen, Rss, Network, Clock, BookMarked, FolderOpen, GitFork, CheckSquare, FileSearch, ShieldCheck, AudioLines, MapPin, ScanSearch, History, Library, Radar } from 'lucide-react'
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

 // Universal — what every user sees in the top nav, in nav order
 const universal: Card[] = [
   { icon: <FolderOpen size={17} className="text-[var(--blue)]" />, title: 'Overview',          desc: 'Stories sidebar with detail and timeline. Recent activity and Situation Report shortcut when no story is open.' },
   { icon: <FileSearch  size={17} className="text-emerald-500" />, title: 'Situation Report',  desc: `Doc-summary view across all your ${c.documentLabelPlural.toLowerCase()} — area health, flags, questions, and recent events.` },
   { icon: <Library     size={17} className="text-indigo-400" />, title: 'Sources',            desc: `Library + Filesystem + Add. Upload ${c.documentLabelPlural.toLowerCase()}, browse them, see the underlying files. Auto-extracts summaries, flags, entities.` },
   { icon: <History     size={17} className="text-amber-500" />, title: 'Research',           desc: 'Wayback lookups, doc diff, username search, and the OSINT directory of investigative resources.' },
   { icon: <BookOpen    size={17} className="text-[var(--blue)]" />, title: 'Stories',         desc: 'Your story workspace — Tiptap editor in the centre, sources/claims/evidence/timeline panel on the right.' },
   { icon: <BookMarked  size={17} className="text-amber-500" />, title: c.navJournal,         desc: 'Clean note-taking. Folders, autosave, AI rewrite/grammar. Notes stay private (story-grade collab is opt-in per entry).' },
   { icon: <MessageSquare size={17} className="text-violet-500" />, title: 'Dispatch',         desc: `AI assistant with persona switcher (Analyst, Editor, etc.). Ask anything about your ${c.documentLabelPlural.toLowerCase()}, draft outputs.` },
 ]

 // Mode-specific (journalism extras and investigation tools)
 const modeSpecific: Card[] = []
 if (f.entities)              modeSpecific.push({ icon: <Network    size={17} className="text-rose-500" />,    title: 'Entities',           desc: `People, organisations and places auto-extracted across your ${c.documentLabelPlural.toLowerCase()}, with timeline and story-map sub-tabs.` })
 if (hasNav('/network'))      modeSpecific.push({ icon: <GitFork    size={17} className="text-[#0026c0]" />,   title: 'Entity Network',     desc: 'Force-directed graph of all entities. Pan, zoom, drag nodes, and highlight clusters.' })
 if (f.timeline)              modeSpecific.push({ icon: <Clock      size={17} className="text-orange-500" />,  title: 'Timeline',           desc: `All extracted events as a chronological view across your ${c.documentLabelPlural.toLowerCase()}.` })
 if (f.investigationTemplate) modeSpecific.push({ icon: <CheckSquare size={17} className="text-emerald-600" />, title: 'Tracker',            desc: 'Claims, risks, and actions in one tabbed surface — verifiable assertions, mitigations, and follow-ups.' })
 if (hasNav('/foia'))         modeSpecific.push({ icon: <FileSearch  size={17} className="text-sky-500" />,    title: 'FOIA Tracker',       desc: 'Track public records requests from filing to receipt — overdue alerts and status history.' })
 if (hasNav('/monitors'))     modeSpecific.push({ icon: <Radar       size={17} className="text-fuchsia-500" />, title: 'Web Monitor',        desc: 'Watch web pages for changes. Alerts when monitored content is updated.' })
 if (hasNav('/speakers'))     modeSpecific.push({ icon: <AudioLines  size={17} className="text-pink-400" />,    title: 'Speakers',           desc: 'Speaker-segmented transcripts of audio sources with per-speaker timelines and talk-time stats.' })
 if (hasNav('/map'))          modeSpecific.push({ icon: <MapPin      size={17} className="text-orange-500" />,  title: 'Photo Map',          desc: 'Plot geotagged photos on an interactive map — cluster view, satellite layers, EXIF inspection.' })
 if (hasNav('/analysis'))     modeSpecific.push({ icon: <ScanSearch  size={17} className="text-violet-500" />,  title: 'Image Analysis',     desc: 'Forensic image tools: face extraction, ELA, AI deepfake detection.' })
 if (hasNav('/file-cleaner')) modeSpecific.push({ icon: <ShieldCheck size={17} className="text-violet-500" />,  title: 'File Cleaner',       desc: 'Strip EXIF metadata and identifying information from files before sharing or publishing.' })
 if (hasNav('/pulse') || f.pulseInNotebook) modeSpecific.push({ icon: <Rss size={17} className="text-emerald-500" />, title: 'Pulse', desc: 'Live RSS / Reddit / Bluesky / Mastodon feeds. Save items to Sources in one click.' })

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
 <button onClick={onBack} className="flex-1 py-3 bg-[var(--surface-2)] text-[var(--text-body)] text-sm font-medium rounded-full hover:bg-[var(--surface-3)] transition-colors">
 ← Back
 </button>
 <button onClick={onNext} className="flex-[3] py-3 bg-[var(--ink)] text-[var(--ink-contrast)] text-sm font-medium rounded-full hover:opacity-90 transition-colors">
 Continue →
 </button>
 </div>
 </div>
 )
}
