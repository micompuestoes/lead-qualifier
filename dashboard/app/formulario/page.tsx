'use client';

import PageHeader from '@/components/PageHeader';
import FormBrandingCard from '@/components/FormBrandingCard';

export default function FormularioPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto r-pad">
      <PageHeader
        eyebrow="Herramientas"
        title="Mi formulario"
        description="Personaliza el formulario público de captación con la marca de tu agencia."
      />
      <FormBrandingCard />
    </div>
  );
}
