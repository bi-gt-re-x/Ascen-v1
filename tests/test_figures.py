"""backend/tracking/figures.py — the check that a number was counted.

The promise every AI panel in this app rests on is that its figures came from
the reader's own record. Until this module existed that promise was a sentence
in a prompt, and these tests are the difference between asking a model not to
invent a statistic and knowing it did not.

The cases worth holding are the two failure directions, and they are not
symmetric. Letting a fabricated figure through is the failure the module
exists to prevent. Deleting a true finding over a formatting difference — a
comma, a percent sign, a trailing zero — is the failure that would make
somebody switch the check off, which is the same thing more slowly.
"""
from backend.tracking import figures


BRIEF = """\
<subject>Computer Science</subject>
<measures>
Quality: 48
Consistency: 57
Finished: 214 against 180 the window before
Rated: 143 tasks over 96 days
</measures>
<difficulty_curve>
Trivial: 30 done, execution 90, typical 12 min
Easy: 40 done, execution 61, typical 22 min
Hard: 18 done, execution 39, typical 55 min
</difficulty_curve>
<mistakes>Ran out of time: 18 tasks, 31%</mistakes>
<totals>Time on it: 1,240 minutes</totals>
"""


class TestReadingNumbersOut:
    def test_finds_plain_integers(self):
        assert figures.numbers_in('execution 61 at Easy') == ['61']

    def test_finds_several_in_order(self):
        assert figures.numbers_in('90 then 61 then 39') == ['90', '61', '39']

    def test_a_string_with_no_numbers_has_none(self):
        assert figures.numbers_in('the harder work is where it goes wrong') == []

    def test_none_is_not_a_crash(self):
        assert figures.numbers_in('') == []


class TestTheSameFigureWrittenDifferently:
    """One number, several spellings. All of them have to match.

    This is the half that keeps the check usable. A model that writes the
    brief's `61` as `61%` is quoting it, not inventing it, and a check that
    cannot see that deletes a true finding for punctuation.
    """

    def test_a_percent_sign_is_not_part_of_the_number(self):
        allowed = figures.allowed_from(BRIEF)
        assert figures.clean('execution is 61% at Easy', allowed)

    def test_a_thousands_separator_is_ignored(self):
        allowed = figures.allowed_from(BRIEF)
        assert figures.clean('1,240 minutes logged', allowed)
        assert figures.clean('1240 minutes logged', allowed)

    def test_a_trailing_zero_is_the_same_number(self):
        allowed = figures.allowed_from(BRIEF)
        assert figures.clean('quality sits at 48.0', allowed)

    def test_normalising_is_symmetric(self):
        assert figures.numbers_in('1,240') == figures.numbers_in('1240.0')


class TestCatchingAnInvention:
    """The failure this module was written for."""

    def test_a_figure_that_is_not_in_the_brief_is_unsupported(self):
        allowed = figures.allowed_from(BRIEF)
        assert figures.unsupported('circle geometry is at 68%', allowed) == ['68']

    def test_a_claim_mixing_real_and_invented_figures_is_still_caught(self):
        # The dangerous shape: two figures the reader can check sitting beside
        # one nobody counted, which is what makes the third one believable.
        allowed = figures.allowed_from(BRIEF)
        assert figures.unsupported(
            'execution runs 90 at Trivial and 61 at Easy, so recursion is near 44',
            allowed) == ['44']

    def test_a_clean_claim_reports_nothing(self):
        allowed = figures.allowed_from(BRIEF)
        assert figures.unsupported('execution falls from 90 to 61', allowed) == []

    def test_prose_with_no_figures_is_always_clean(self):
        allowed = figures.allowed_from(BRIEF)
        assert figures.clean('the harder work is where this goes wrong', allowed)


class TestAGroupStandsOrFallsTogether:
    def test_all_clean_needs_every_string(self):
        allowed = figures.allowed_from(BRIEF)
        assert figures.all_clean(['execution 61', 'quality 48'], allowed)

    def test_one_bad_string_condemns_the_group(self):
        # A finding whose evidence cites an invented figure is not a finding
        # with a bad footnote; it is a finding resting on nothing.
        allowed = figures.allowed_from(BRIEF)
        assert not figures.all_clean(['execution 61', 'and 68 on recursion'], allowed)

    def test_an_empty_group_is_clean(self):
        assert figures.all_clean([], figures.allowed_from(BRIEF))


class TestWhatTheBriefLicenses:
    def test_every_number_printed_into_the_brief_counts(self):
        allowed = figures.allowed_from(BRIEF)
        for number in ('48', '57', '214', '180', '143', '96', '90', '61', '39', '31'):
            assert number in allowed, number

    def test_difficulty_levels_come_free_with_the_curve(self):
        # The model is allowed to say "level 2 work" and does. Those numbers
        # are in the brief already, so no special case is needed for them —
        # this test exists to notice if that stops being true.
        allowed = figures.allowed_from(BRIEF)
        assert figures.clean('the drop happens after 12 minutes of Trivial work', allowed)

    def test_an_empty_brief_licenses_nothing(self):
        assert figures.allowed_from('') == set()
        assert figures.unsupported('61%', set()) == ['61']
