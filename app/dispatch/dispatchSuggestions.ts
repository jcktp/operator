import type { PersonaId } from '@/lib/personas'

export function getSuggestions(persona: PersonaId, role: string, modeId: string): string[] {
  const r = role.toLowerCase()

  if (modeId === 'journalism') {
    if (persona === 'dispatch') // Analyst
      return ['What are the key entities and connections in these documents?', 'Are there any contradictions or gaps across the documents?', 'Summarise the main claims and what supports them']
    if (persona === 'debrief') // Editor
      return ['Is the evidence strong enough to publish this claim?', "What's missing before this story is ready?", "Play devil's advocate on my main angle"]
    // recon → Scout
    return ['What other documents or records should I be looking for?', 'What FOI requests would strengthen this story?', 'What angles on this story am I not considering?']
  }

  if (modeId === 'team_lead') {
    if (persona === 'dispatch') // Tracker
      return ['What blockers are coming up most frequently?', 'Which team members are behind on commitments?', 'Summarise delivery progress this sprint']
    if (persona === 'debrief') // Retro
      return ["Help me prepare for a difficult conversation with a team member", 'What might be causing this recurring blocker?', "Am I addressing the root cause or just the symptom?"]
    // recon → Spark
    return ['What process changes could improve our sprint velocity?', 'Generate 5 ideas for improving team communication', 'What would a high-performing team do differently here?']
  }

  if (modeId === 'market_research') {
    if (persona === 'dispatch') // Signal
      return ['What are the strongest recurring themes across these interviews?', 'Which respondents are outliers and why?', 'Summarise the key findings so far']
    if (persona === 'debrief') // Probe
      return ['Are my conclusions actually supported by the data?', 'What alternative explanations am I not considering?', 'Where could sample bias be affecting my findings?']
    // recon → Horizon
    return ['What hypotheses should I test in the next round of research?', 'What respondent types am I missing?', 'What questions would most change my current conclusions?']
  }

  if (modeId === 'legal') {
    if (persona === 'dispatch') // Clerk
      return ['What are the key facts and dates across these documents?', 'Are there any contradictions in the evidence?', 'What gaps or missing documents should I flag?']
    if (persona === 'debrief') // Counsel
      return ["What's the strongest counterargument to my position?", 'Where is my evidence weakest?', 'How would opposing counsel attack this argument?']
    // recon → Brief
    return ['What evidence-gathering strategies should I pursue?', 'What legal angles am I not considering?', 'What precedents might apply to this case?']
  }

  if (modeId === 'consulting') {
    if (persona === 'dispatch') // Mapper
      return ['What deliverables are at risk of slipping?', 'What commitments have been made but not tracked?', 'Summarise engagement progress and outstanding work']
    if (persona === 'debrief') // Partner
      return ["What objections will the client raise to this recommendation?", 'Where is my evidence base weakest?', 'What would a competing firm recommend instead?']
    // recon → Ideate
    return ['What frameworks could apply to this client problem?', 'What have analogous companies done in this situation?', 'Generate 5 unconventional approaches to this challenge']
  }

  // executive (default) — role-aware
  if (persona === 'dispatch') {
    if (r.includes('cto') || r.includes('tech') || r.includes('engineer'))
      return ['What are the biggest technical risks right now?', 'Which system or team needs attention?', 'Summarise engineering progress this week']
    if (r.includes('cfo') || r.includes('finance') || r.includes('financial'))
      return ['What are the key financial risks?', 'Which area has the most budget pressure?', 'Summarise financial performance this week']
    if (r.includes('coo') || r.includes('operations'))
      return ['Where are the operational bottlenecks?', 'Which team is under the most strain?', 'What changed in operations this week?']
    return ['What are the biggest risks right now?', 'Which area needs the most attention?', 'Summarise what changed this week']
  }
  if (persona === 'debrief') {
    if (r.includes('cto') || r.includes('tech'))
      return ["Help me think through a technical decision I'm facing", 'What trade-offs am I not seeing?', 'Challenge my assumptions on this architecture']
    if (r.includes('cfo') || r.includes('finance'))
      return ['Help me think through a budget decision', 'What financial risks am I underestimating?', "Play devil's advocate on this investment"]
    return ["Help me think through a decision I'm facing", 'What am I not considering here?', "Play devil's advocate on this plan"]
  }
  // recon
  if (r.includes('cto') || r.includes('tech'))
    return ['What are unconventional approaches to scaling our tech?', 'What would a tech-first competitor do differently?', 'Generate 5 ideas for improving developer productivity']
  if (r.includes('cfo') || r.includes('finance'))
    return ['What are unconventional ways to improve margins?', 'What would a capital-efficient competitor do?', 'Generate 5 ideas for revenue diversification']
  return ['Generate 5 ideas for growing revenue', 'What would a competitor do differently?', "What's an unconventional approach to this problem?"]
}
