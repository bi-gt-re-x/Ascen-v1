"""backend/tracking/planner.py — the environment it reads, and when.

Every test here is about timing rather than about planning. `load_dotenv()`
runs in the entry point, which is *after* this module is imported, so anything
the planner reads at import time reads as unset however carefully it was
written into .env. `provider()` has always been careful about that; the model
and the workspace id were not, for one commit, and the workspace id is the one
that cost something — the header was never sent, the API kept asking for the
workspace, and the error told the reader to do the thing they had done.

No network in any of these: `anthropic.Anthropic` is stubbed where a client
would be built, so what is asserted is the request the planner *would* make.
"""
import sys
import types

import pytest

from backend.tracking import planner


@pytest.fixture
def captured(monkeypatch):
    """Stand in for the SDK and record how the client was constructed."""
    seen = {}

    class FakeMessages:
        def create(self, **kwargs):
            seen['request'] = kwargs
            raise RuntimeError('stop here — the request is what is under test')

    class FakeAnthropic:
        def __init__(self, **kwargs):
            seen['client'] = kwargs
            self.messages = FakeMessages()

    monkeypatch.setitem(sys.modules, 'anthropic',
                        types.SimpleNamespace(Anthropic=FakeAnthropic))
    return seen


# --------------------------------------------------------------------------
# Read late, not at import
# --------------------------------------------------------------------------
def test_the_workspace_id_is_read_after_import(monkeypatch):
    """The regression. This module is imported before .env is loaded.

    Setting the variable now stands in for `load_dotenv()` setting it later:
    if this were still a module constant, the value below would be invisible.
    """
    monkeypatch.setenv('ANTHROPIC_WORKSPACE_ID', 'wrkspc_set_after_import')
    assert planner.workspace_id() == 'wrkspc_set_after_import'


def test_the_model_is_read_after_import_too(monkeypatch):
    """Same defect, same fix — an ANTHROPIC_MODEL in .env was also ignored."""
    monkeypatch.setenv('ANTHROPIC_MODEL', 'claude-opus-5')
    assert planner.model() == 'claude-opus-5'


def test_the_model_falls_back_to_the_default(monkeypatch):
    monkeypatch.delenv('ANTHROPIC_MODEL', raising=False)
    assert planner.model() == planner.ANTHROPIC_MODEL_DEFAULT == 'claude-sonnet-5'


def test_no_workspace_configured_is_the_empty_string(monkeypatch):
    monkeypatch.delenv('ANTHROPIC_WORKSPACE_ID', raising=False)
    assert planner.workspace_id() == ''


# --------------------------------------------------------------------------
# What reaches the request
# --------------------------------------------------------------------------
def test_the_workspace_header_is_sent_when_one_is_configured(monkeypatch, captured):
    monkeypatch.setenv('ANTHROPIC_WORKSPACE_ID', 'wrkspc_real')
    with pytest.raises(planner.PlannerUnavailable):
        planner._from_anthropic('Goal: something')

    assert captured['client']['default_headers'] == {
        'anthropic-workspace-id': 'wrkspc_real'}


def test_the_header_is_omitted_rather_than_sent_blank(monkeypatch, captured):
    """A blank workspace id is refused the same way a missing one is."""
    monkeypatch.delenv('ANTHROPIC_WORKSPACE_ID', raising=False)
    with pytest.raises(planner.PlannerUnavailable):
        planner._from_anthropic('Goal: something')

    assert captured['client']['default_headers'] is None


def test_the_model_in_the_environment_reaches_the_request(monkeypatch, captured):
    monkeypatch.setenv('ANTHROPIC_MODEL', 'claude-opus-5')
    with pytest.raises(planner.PlannerUnavailable):
        planner._from_anthropic('Goal: something')

    assert captured['request']['model'] == 'claude-opus-5'


def test_the_request_carries_effort_and_a_schema(monkeypatch, captured):
    """Both live in output_config; `effort` top-level would be ignored."""
    with pytest.raises(planner.PlannerUnavailable):
        planner._from_anthropic('Goal: something')

    config = captured['request']['output_config']
    assert config['effort'] == 'high'
    assert config['format']['type'] == 'json_schema'


def test_the_request_sends_nothing_this_model_rejects(monkeypatch, captured):
    """`budget_tokens`, `temperature`, `top_p` and `top_k` are 400s on Sonnet 5,
    and an assistant prefill is another. None of them is sent."""
    with pytest.raises(planner.PlannerUnavailable):
        planner._from_anthropic('Goal: something')

    request = captured['request']
    for banned in ('thinking', 'budget_tokens', 'temperature', 'top_p', 'top_k'):
        assert banned not in request
    assert [m['role'] for m in request['messages']] == ['user']


# --------------------------------------------------------------------------
# What the reader is told
# --------------------------------------------------------------------------
def test_a_rejected_workspace_id_is_not_told_to_go_and_set_one(monkeypatch, captured):
    """The circle this message used to send people round.

    Somebody who has set the value and had it refused needs to hear that it
    was refused — not to be sent back to .env to set it again.
    """
    monkeypatch.setenv('ANTHROPIC_WORKSPACE_ID', 'wrkspc_wrong')

    class Boom:
        def create(self, **kwargs):
            raise RuntimeError('anthropic-workspace-id header must be valid')

    monkeypatch.setitem(sys.modules, 'anthropic', types.SimpleNamespace(
        Anthropic=lambda **kw: types.SimpleNamespace(messages=Boom())))

    with pytest.raises(planner.PlannerUnavailable) as caught:
        planner._from_anthropic('Goal: something')

    message = str(caught.value)
    assert 'would not accept' in message
    assert 'wrkspc_wrong' in message


def test_no_workspace_at_all_names_both_ways_out(monkeypatch):
    """Setting the id is one fix; a workspace-scoped key removes the need."""
    monkeypatch.delenv('ANTHROPIC_WORKSPACE_ID', raising=False)

    class Boom:
        def create(self, **kwargs):
            raise RuntimeError(
                'anthropic-workspace-id is required when authenticating with '
                'an identity-linked API key')

    monkeypatch.setitem(sys.modules, 'anthropic', types.SimpleNamespace(
        Anthropic=lambda **kw: types.SimpleNamespace(messages=Boom())))

    with pytest.raises(planner.PlannerUnavailable) as caught:
        planner._from_anthropic('Goal: something')

    message = str(caught.value)
    assert 'ANTHROPIC_WORKSPACE_ID' in message
    assert 'workspace API key' in message
