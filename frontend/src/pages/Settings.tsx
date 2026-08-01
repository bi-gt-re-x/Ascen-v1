/**
 * Settings — not built yet.
 *
 * Account preferences beyond the theme toggle and the avatar picker.
 */
import { NotBuilt } from '@/components';
import { useDocumentTitle } from '@/hooks';
import '@/styles/settings.css';

export default function Settings() {
  useDocumentTitle('Settings');

  return (
    <NotBuilt
      name="Settings"
      description="Account preferences beyond the theme toggle and the avatar picker."
      files={[
        'backend/api/settings.py — a stub',
        'data/sql/settings.sql — user_settings already holds the avatar',
      ]}
    />
  );
}
