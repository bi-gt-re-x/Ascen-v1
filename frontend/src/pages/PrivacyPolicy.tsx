/**
 * The privacy policy.
 *
 * Ported from the privacy-policy.html template, word for word — the wording
 * of a published policy is not something a port gets to improve, so the text
 * below is the text that page served.
 *
 * What is not carried over is the Home button that floated in the corner.
 * Those pages had no navigation of their own, so they grew one; this app has
 * the top bar on every route, and the wordmark in it goes to the same place.
 *
 * The card, the headings and the dark theme live in styles/content-page.css,
 * shared with About Us and the Terms of Service — all three were the same
 * page with different words in it.
 */
import { useDocumentTitle } from '@/hooks';
import '@/styles/content-page.css';

export default function PrivacyPolicy() {
  useDocumentTitle('Privacy Policy');

  return (
    <div className="content-container">
      <h1>Privacy Policy</h1>
      <p className="effective-date">Effective date: July 22, 2026</p>

      <p>
        Ascen (&quot;we&quot;, &quot;us&quot;, or &quot;the app&quot;) is a study and
        productivity tracker. This policy explains what information the app handles, how it
        is stored, and the choices you have. The short version: your data stays with you.
      </p>

      <h2>1. Information We Collect</h2>
      <p>Ascen stores only the information you create while using the app:</p>
      <ul>
        <li>
          <strong>Profile data</strong> — your display name, level, XP, and streak history.
        </li>
        <li>
          <strong>Tasks and goals</strong> — task titles, descriptions, priorities,
          sub-tasks, due dates, and goal targets you set.
        </li>
        <li>
          <strong>Calendar entries</strong> — events and scheduled tasks you place on the
          calendar.
        </li>
        <li>
          <strong>Activity metrics</strong> — focus session durations, tasks completed, and
          XP events used to build your growth charts.
        </li>
        <li>
          <strong>Preferences</strong> — settings such as your chosen theme (light or dark).
        </li>
      </ul>
      <p>
        We do not collect payment information, precise location, contacts, or advertising
        identifiers. Ascen has no ads and no analytics trackers.
      </p>

      <h2>2. How Your Data Is Stored</h2>
      <p>
        All of your data is stored locally — in your browser&apos;s local storage and in
        data files on the machine running the app. Your information is not uploaded to a
        cloud service, sold, or shared with third parties. It never leaves your device
        unless you copy it yourself.
      </p>

      <h2>3. How We Use Your Information</h2>
      <p>Your data is used solely to make the app work for you:</p>
      <ul>
        <li>Displaying your tasks, goals, and calendar.</li>
        <li>Calculating streaks, XP, levels, and growth ratings.</li>
        <li>Rendering your progress charts and statistics.</li>
        <li>Remembering your preferences between sessions.</li>
      </ul>

      <h2>4. Sharing and Third Parties</h2>
      <p>
        We do not share, sell, rent, or trade your information with anyone. Ascen does not
        integrate third-party advertising, analytics, or social networks.
      </p>

      <h2>5. Data Retention and Deletion</h2>
      <p>
        Your data remains stored until you delete it. You can remove individual tasks,
        goals, and calendar entries in the app at any time. Because data is stored locally,
        you can also delete the app&apos;s data files or clear your browser storage to
        remove everything permanently.
      </p>

      <h2>6. Security</h2>
      <p>
        Because your data is stored locally, its security depends primarily on the security
        of your own device. We recommend keeping your operating system up to date and
        protecting your device with a password.
      </p>

      <h2>7. Children&apos;s Privacy</h2>
      <p>
        Ascen is a study tool suitable for general audiences. It does not knowingly collect
        personal information beyond what you enter yourself, and no information is
        transmitted to us or anyone else.
      </p>

      <h2>8. Changes to This Policy</h2>
      <p>
        If this policy changes, the updated version will be posted on this page with a new
        effective date. Continued use of the app after changes take effect constitutes
        acceptance of the revised policy.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about this policy? Reach out through the project&apos;s repository or the
        contact information provided where you obtained the app.
      </p>
    </div>
  );
}
