import { NextResponse } from 'next/server'
import { triggerUninstall } from '@/lib/uninstall'

export async function POST() {
  triggerUninstall()
  return NextResponse.json({ ok: true })
}
