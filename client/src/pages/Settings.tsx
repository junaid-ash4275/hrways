import { Outlet } from 'react-router-dom'
import { useI18n } from '../i18n/i18n'

export default function Settings() {
  const { t } = useI18n()
  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">{t('Settings')}</h2>
      <p className="opacity-80 mb-4">Manage your profile, password, and preferences.</p>

      <div>
        <Outlet />
      </div>
    </section>
  )
}
