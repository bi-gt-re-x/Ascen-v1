"""A rank is only allowed to be as precise as the cohort behind it.

"Where You Stand" placed the reader against every other account with a
comparable record, and it did so from three others up. Against five it printed
"Top 1.0%" — a figure whose finest honest step is twenty points, written to one
decimal place, in the same style as every other number on the page.

The panel did name the cohort size beside it, and that was the defence: a small
sample disclosed rather than hidden. It is not enough. A reader does not divide
100 by the number in the caption; they read a percentile, because that is what
it is shaped like. These tests hold both halves of the fix — the floor on
saying anything at all, and the precision of what is said above it.
"""
from backend.tracking import standing


def test_a_rank_is_rounded_to_what_the_cohort_can_resolve():
    """Five others cannot distinguish tenths, so the figure must not claim to."""
    five = [0, 1, 2, 3, 4]
    for mine in range(6):
        percent = standing._top_percent(mine, five)
        # 100/5 = 20-point steps, and the clamp at either end.
        assert percent in (1.0, 20.0, 40.0, 60.0, 80.0, 99.0), (mine, percent)


def test_a_large_cohort_is_allowed_tenths():
    """The rounding follows the sample rather than being blanket-coarse."""
    many = list(range(500))
    seen = {standing._top_percent(mine, many) for mine in range(0, 500, 7)}
    assert any(value != round(value) for value in seen), sorted(seen)[:8]


def test_nobody_is_placed_beyond_everybody():
    """"Top 0%" claims a rank outside the population; "top 100%" is a way of
    calling somebody last in the language of winning."""
    others = list(range(30))
    assert standing._top_percent(1000, others) == 1.0
    assert standing._top_percent(-1000, others) == 99.0


def test_ties_place_together():
    """Otherwise the comparison turns on the order rows came out of the table."""
    others = [5, 5, 5, 5]
    assert standing._top_percent(5, others) == standing._top_percent(5, others)
    assert standing._top_percent(6, others) < standing._top_percent(4, others)


def test_the_floor_is_high_enough_that_one_account_is_not_a_landslide():
    """Twenty is where a single person joining moves a rank by about five
    points rather than by twenty-five."""
    assert standing.COHORT_FLOOR >= 20
    step = 100.0 / standing.COHORT_FLOOR
    assert step <= 5.0, step


def test_a_small_instance_says_so_instead_of_ranking(client):
    """End to end: a fresh install has two accounts, and the honest answer to
    "where do I stand?" is that there is nobody to stand against yet."""
    payload = client.get('/api/standing').json()
    assert payload['success'] is True
    assert payload['enough'] is False
    assert payload['floor'] == standing.COHORT_FLOOR
    assert all(row['percentile'] is None for row in payload['rows']), payload
