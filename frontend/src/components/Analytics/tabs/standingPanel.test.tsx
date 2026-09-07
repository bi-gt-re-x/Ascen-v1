/**
 * "How far into each tree" on the Subjects tab.
 *
 * The panel that answers the question the rest of the tab does not: the
 * chapters above say how much work went where, and the lattice list says what
 * each subject contains. Neither says how much of a lattice the reader's own
 * record covers, which is the one skill-tree figure on the page that is about
 * them rather than about the curriculum.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SubjectsTab } from './SubjectsTab';
import { draw, fakeModel, subjects } from './fixtures';
import type { Task } from '@/types';

const done = (subject: string, xp: number, n = 1): Task[] =>
  Array.from({ length: n }, (_, at) => ({
    id: `${subject}-${at}`, title: subject, status: 'done', subject, xp_value: xp,
  }) as unknown as Task);

describe('the tree standing panel', () => {
  it('is absent on an account with nothing finished', () => {
    draw(<SubjectsTab model={fakeModel()} subjects={subjects} />);
    expect(screen.queryByText('How far into each tree')).not.toBeInTheDocument();
  });

  it('shows a tree the account has worked in', () => {
    draw(<SubjectsTab
      model={fakeModel({ tasks: done('machine_learning', 500, 20) })}
      subjects={subjects}
    />);
    expect(screen.getByText('How far into each tree')).toBeInTheDocument();
    expect(screen.getByText('Machine Learning')).toBeInTheDocument();
  });

  it('counts unfinished work as nothing', () => {
    const pending = done('machine_learning', 500, 20)
      .map((task) => ({ ...task, status: 'todo' })) as Task[];
    draw(<SubjectsTab model={fakeModel({ tasks: pending })} subjects={subjects} />);
    expect(screen.queryByText('How far into each tree')).not.toBeInTheDocument();
  });

  it('counts the whole record, not the window the page is scoped to', () => {
    /* Everything else on this tab is a statement about the window. A lattice
       is a curriculum rather than a month, and the server counts the Mastery
       badges over the same lifetime — a panel that quietly disagreed with the
       badge beside it would be worse than no panel. The model's `breakdown` is
       the windowed figure, and is deliberately left empty here. */
    draw(<SubjectsTab
      model={fakeModel({
        tasks: done('mathematics', 400, 30),
        breakdown: { rows: [], total: 0 },
      })}
      subjects={subjects}
    />);
    expect(screen.getByText('Mathematics')).toBeInTheDocument();
  });

  it('counts subjects that share a lattice as one climb', () => {
    draw(<SubjectsTab
      model={fakeModel({
        tasks: [...done('spanish', 300, 10), ...done('japanese', 300, 10)],
      })}
      subjects={subjects}
    />);
    expect(screen.getByText('Foreign Languages')).toBeInTheDocument();
    expect(screen.queryByText('Spanish')).not.toBeInTheDocument();
  });
});
