// Raíz del sitio — redirige a /leads
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/leads');
}
