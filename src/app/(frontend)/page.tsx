import { redirect } from 'next/navigation'

/** The canonical entry point is the `default` mode; every other mode is /<slug>. */
export default function HomePage() {
  redirect('/default')
}
