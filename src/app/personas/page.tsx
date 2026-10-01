import { t } from "@/i18n";

export default function Page() {
  return (
    <div className="page">
      <h1 className="page-title">{t.nav.people}</h1>
      <p className="muted">{t.common.soon}</p>
    </div>
  );
}
