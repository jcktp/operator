import type { PersonaId } from '@/lib/personas'

export function getSuggestions(persona: PersonaId, _role: string, _modeId: string): string[] {
  if (persona === 'dispatch') // Analyst
    return ['What are the key entities and connections in these documents?', 'Are there any contradictions or gaps across the documents?', 'Summarise the main claims and what supports them']
  if (persona === 'debrief') // Editor
    return ['Is the evidence strong enough to publish this claim?', "What's missing before this story is ready?", "Play devil's advocate on my main angle"]
  // recon → Scout
  return ['What other documents or records should I be looking for?', 'What FOI requests would strengthen this story?', 'What angles on this story am I not considering?']
}
