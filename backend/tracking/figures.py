"""The check that a model did not make a number up.

Every AI panel in this app rests on one promise: the figures in it were
counted from the reader's own record, and the model was given them rather than
asked to work them out. Until now that promise was kept by asking nicely —
`SYSTEM` in backend/tracking/subject_ai says "every number you write about the
reader must appear in the brief", and nothing checked whether it had.

A prompt is a good way to get the behaviour and a bad way to guarantee it. It
mattered less while the only provider was a frontier model that follows the
instruction; it matters now, because the free providers are open models and
the whole point of the panel is that a reader cannot tell a counted figure
from an invented one by looking at it.

## What is checked, and what is deliberately not

**Claims about the reader are checked.** A diagnosis, the evidence under it,
the reason beside a priority, an insight — these say what the record shows,
and a figure in one of them is being presented as counted. Any number in them
that is not in the brief is an invention, and the entry carrying it is
dropped.

**Prescriptions are not.** "Twenty angle-chasing problems, then one timed set"
is a quantity the model is *supposed* to supply: it is an instruction about
next Tuesday, not a statistic about the reader, and there is no counted figure
it could have come from. Guarding those would delete the specificity that
makes a next step worth reading — `difficulty` and `duration_minutes` are
already labelled on the page as the model's own, and drills are the same kind
of thing.

That split is the whole design here. The question is never "did the model
write a number" but "is this number pretending to have been counted".

## Why matching on digits is enough

The brief is built by `brief_from`, which prints every figure the model is
allowed to use. So the set of legitimate numbers is finite, known, and sitting
in a string this module is handed. Matching is textual and deliberately
generous: percentages, thousands separators and a trailing `.0` are normalised
away, so a brief carrying `61` clears "61%" and "61.0" both.

Generous in that direction is the right way to be wrong. A false positive
deletes a true finding and the reader silently loses a panel; a false negative
lets through a number that was in the brief anyway, written in another form.
The failure this exists to prevent is a *fabricated* figure, and a fabricated
figure does not coincidentally appear in the brief.

Words are not checked. "Three tasks" written out is not caught, and that is
accepted: models write statistics as digits, and a regex for number words
would be a second vocabulary to maintain for a case that does not arise.
"""
import re
from typing import Iterable, List, Set

#: Any run of digits, with optional thousands separators and decimal part.
#: Deliberately not anchored to a word boundary on the left — "x61" should
#: still surrender its 61 rather than hiding it behind a letter.
_NUMBER = re.compile(r'\d[\d,]*(?:\.\d+)?')


def _normalise(token: str) -> str:
    """One number, in the single form both sides are compared in.

    Commas out, a trailing `.0` off, a leading zero off anything that is not
    itself zero. `1,240`, `1240` and `1240.0` are one figure written three
    ways, and a check that treats them as three is a check that fails on
    formatting rather than on truth.
    """
    text = token.replace(',', '')
    if '.' in text:
        text = text.rstrip('0').rstrip('.')
    return text or '0'


def numbers_in(text: str) -> List[str]:
    """Every number in a string, normalised, in the order they appear."""
    return [_normalise(match.group()) for match in _NUMBER.finditer(text or '')]


def allowed_from(brief: str) -> Set[str]:
    """The figures a model may use, taken from the brief it was given.

    Every number printed into the brief counts, including the ones inside
    labels and section headings. A stricter reading — only the values, not the
    scaffolding — would be more precise and would also start deleting findings
    for quoting a difficulty level, which is exactly the kind of correctness
    nobody thanks you for.
    """
    return set(numbers_in(brief))


def unsupported(text: str, allowed: Set[str]) -> List[str]:
    """The numbers in `text` that the brief does not account for.

    Empty means the string is safe to show. The caller decides what to do with
    a non-empty answer; this module has no opinion about whether one bad
    figure should cost a whole finding, because that depends on what the
    finding is attached to.
    """
    return [number for number in numbers_in(text) if number not in allowed]


def clean(text: str, allowed: Set[str]) -> bool:
    """Whether every number in `text` is one the model was given."""
    return not unsupported(text, allowed)


def all_clean(texts: Iterable[str], allowed: Set[str]) -> bool:
    """Whether every string in a group is clean.

    A finding and its evidence stand or fall together: evidence citing a
    figure nobody counted does not support the claim above it, and a claim
    shown without the evidence it was written against is worse than no claim.
    """
    return all(clean(text, allowed) for text in texts)
