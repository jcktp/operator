import { redirect } from 'next/navigation'

// /projects is now unified with /stories — stories ARE projects.
// Redirect so there's one canonical URL for the story index.
export default function ProjectsPage() {
  redirect('/stories')
}
