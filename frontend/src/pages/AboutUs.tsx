/**
 * About Us.
 *
 * Ported from frontend/html/aboutus.html. The prose is that page's, unchanged
 * — including the "How It's Built" paragraph, which still says Flask and
 * hand-written JavaScript. That sentence describes the stack this port is in
 * the middle of replacing, so it is wrong and getting wronger; it is left
 * exactly as it was because rewriting the copy is a decision about what the
 * page says, not about how it is rendered, and the two should not travel
 * together in one commit.
 *
 * The values grid is the only thing here the other written pages do not have
 * (styles/aboutus.css); the card around it is shared (styles/content-page.css).
 */
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks';
import '@/styles/content-page.css';
import '@/styles/aboutus.css';

/** The four cards under "What We Believe", in the order the original had them. */
const VALUES = [
  {
    title: '⚖ Consistency over Intensity',
    body: 'Small daily wins beat rare all-nighters. Streaks reward showing up.',
  },
  {
    title: '📈 Measurable Progress',
    body: 'Every action turns into a number you can see and improve.',
  },
  {
    title: '🏆 Rewarding Productivity',
    body: 'XP, levels and grades make finishing work feel genuinely good.',
  },
  {
    title: '✨ Simplicity First',
    body: 'No clutter. Just the few tools that actually move the needle.',
  },
];

export default function AboutUs() {
  useDocumentTitle('About Us');

  return (
    <div className="content-container">
      <h1>About Us</h1>

      <p>
        Ascen is a study and productivity tracker built around a simple idea:{' '}
        <strong>progress you can see is progress you&apos;ll keep making.</strong>
      </p>

      <h2>Our Story</h2>
      <p>
        Ascen started as a personal project — a student&apos;s answer to the feeling of
        working hard all day and still wondering, &quot;did I actually get anything
        done?&quot; Spreadsheets were tedious, big productivity suites were bloated, and
        nothing made consistency feel rewarding. So we built the tool we wanted: tasks, a
        calendar, focus sessions, and goals, all feeding into streaks, XP, and growth
        ratings that turn effort into something you can watch climb.
      </p>

      <h2>What We Believe</h2>
      <div className="values-grid">
        {VALUES.map((value) => (
          <div className="value-card" key={value.title}>
            <h3>{value.title}</h3>
            <p>{value.body}</p>
          </div>
        ))}
      </div>

      <h2>How It&apos;s Built</h2>
      <p>
        Ascen runs on a clean, dependable stack — Python and Flask on the backend,
        hand-written HTML, CSS and JavaScript on the frontend, and charts drawn with Canvas
        and SVG. Your data stays local, in plain JSON, where you can always see it. No
        accounts on distant servers, no subscriptions, no ads.
      </p>

      <h2>Where We&apos;re Headed</h2>
      <p>
        Ascen is under active development, and every feature is tested the same way it was
        born: in real study sessions. If it doesn&apos;t help you focus, finish, and level
        up, it doesn&apos;t ship.
      </p>

      <p>
        Ready to start your ascent? <Link to="/dashboard">Head to the dashboard</Link> and
        turn today&apos;s effort into tomorrow&apos;s momentum.
      </p>
    </div>
  );
}
