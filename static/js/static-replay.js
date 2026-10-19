/* Read-only transport for the exported site. All clocks are original source time.
 * Only GETs for packaged JSON reach the network; there is no server or inference.
 */
(() => {
  'use strict';
  // Historical links and saved local workspace choices open the only public
  // workspace. This runs before the shared demo controller reads the URL.
  const publicUrl = new URL(location.href);
  publicUrl.searchParams.set('mode', 'presentation');
  publicUrl.searchParams.delete('session');
  if (publicUrl.href !== location.href) history.replaceState(null, '', publicUrl);
  const copy = value => structuredClone(value);
  const sessions = new Map();
  let cataloguePromise, serial = 0;
  const json = async path => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        let target = path;
        if (attempt) {
          const fresh = new URL(path, location.href);
          fresh.searchParams.set('_retry', `${Date.now()}-${attempt}`);
          target = fresh.href;
        }
        const response = await fetch(target, attempt ? {cache: 'no-store'} : {});
        if (!response.ok) throw new Error(`Saved demo file unavailable: ${path} (HTTP ${response.status})`);
        return await response.json();
      } catch (error) {
        if (attempt === 2) throw error;
        // A temporary Pages/CDN response must not strand an otherwise valid replay.
        await new Promise(resolve => setTimeout(resolve, attempt ? 600 : 200));
      }
    }
  };
  const catalogue = () => cataloguePromise ||= json('data/catalogue.json?v=4991e3e87dd9').catch(error => {
    cataloguePromise = null;
    throw error;
  });
  const lowerBound = (rows, time, field = null) => {
    let lo = 0, hi = rows.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((field ? rows[mid][field] : rows[mid]) < time) lo = mid + 1; else hi = mid;
    }
    return lo;
  };
  class Replay {
    constructor(data, request, presentation) {
      this.data = data;
      this.id = `replay-${++serial}`;
      this.rate = Number(request.playback_rate || 1);
      if (![.5, .75, 1, 1.25, 1.5, 2].includes(this.rate)) throw new Error('Unsupported playback speed');
      this.presentation = presentation;
      this.start = presentation ? data.fixation_seconds : 0;
      this.elapsed = this.start;
      this.state = 'BRIEFING';
      this.revision = 0;
      this.events = new EventTarget();
      this.resetCursors(this.start, false);
    }
    resetCursors(time, after) {
      const offset = after ? 1e-9 : 0;
      this.sample = lowerBound(this.data.timestamps, time + offset);
      this.prediction = lowerBound(this.data.predictions, time + offset, 'sample_elapsed');
      this.action = lowerBound(this.data.schedule, time + offset, 'at');
    }
    wallAt(time) {
      if (this.presentation) return (time - this.start) / this.rate;
      const fix = this.data.fixation_seconds;
      return Math.min(time, fix) + Math.max(0, time - fix) / this.rate;
    }
    sourceAt(wall) {
      if (this.presentation) return this.start + wall * this.rate;
      const fix = this.data.fixation_seconds;
      return Math.min(wall, fix) + Math.max(0, wall - fix) * this.rate;
    }
    emit(type, payload) {
      this.events.dispatchEvent(new MessageEvent(type, {data: JSON.stringify({
        ...payload, session_id: this.id, revision: this.revision,
      })}));
    }
    evidence() {
      const entry = this.presentation;
      if (!entry) return null;
      const result = {
        condition: entry.condition, expectation: entry.expectation, happened: entry.happened,
        explanation: entry.explanation, prediction_text: entry.prediction_text,
        critical_onset: entry.checkpoints.critical_onset,
        action_stop: entry.checkpoints.action_stop, checkpoint: this.checkpoint || null,
        evidence: null, evidence_error: null,
      };
      const row = entry.highlight;
      if (!row) { result.evidence_error = 'No saved highlight selected for this trial.'; return result; }
      if (row.sample_elapsed > this.elapsed) return result;
      // The source is the saved analysis, not a claim of recomputation in-browser.
      const observed = this.data.predictions.filter(r => r.sample_elapsed <= this.elapsed);
      const index = observed.findIndex(r => r.sample_index === row.sample_index);
      if (index < 0) return result;
      let left = index, right = index;
      while (left > 0 && observed[left - 1].eligible
        && observed[left].sample_elapsed - observed[left - 1].sample_elapsed <= .094) left--;
      while (right + 1 < observed.length && observed[right + 1].eligible
        && observed[right + 1].sample_elapsed - observed[right].sample_elapsed <= .094) right++;
      const label = entry.condition === 'SPE' ? 1 : 2, probabilities = row.probabilities;
      result.evidence = {
        at: row.sample_elapsed, available_elapsed: row.sample_elapsed, sample_index: row.sample_index,
        label, probability: probabilities[label], probabilities, margin: row.margin,
        interval: {start: observed[left].sample_elapsed, end: observed[right].sample_elapsed,
          duration: observed[right].sample_elapsed - observed[left].sample_elapsed}, comparison: null,
      };
      const baseline = entry.baseline;
      if (baseline && baseline.sample_elapsed <= this.elapsed
          && baseline.probabilities[0] > probabilities[0] && baseline.probabilities[label] < probabilities[label]) {
        result.evidence.comparison = {at: baseline.sample_elapsed, before: baseline.probabilities,
          after: probabilities, nonpe_change_pp: 100 * (probabilities[0] - baseline.probabilities[0]),
          pe_change_pp: 100 * (probabilities[label] - baseline.probabilities[label])};
      }
      return result;
    }
    public() {
      return {
        session_id: this.id, experiment_mode: this.presentation ? 'presentation' : 'play',
        playing_session_type: 'pre_recorded', participant_id: this.data.participant_id,
        lifecycle_state: this.state, trial_phase: this.state, revision: this.revision,
        elapsed: this.elapsed, error: null, preparation_progress: 1, playback: this.data.playback,
        duration: this.data.duration, playback_rate: this.rate, playback_start: this.start,
        presentation_duration: this.wallAt(this.data.duration), fixation_seconds: this.data.fixation_seconds,
        decoder_id: this.data.model_id, presentation: this.evidence(), replay_only: true,
      };
    }
    stops() {
      if (!this.presentation) return [];
      const {action_stop: first, prediction_stop: second} = this.presentation.checkpoints;
      return [['action', first],
        ...(second != null ? [['prediction', Math.max(first, second)]] : [])];
    }
    run(time = this.elapsed, restoring = false) {
      cancelAnimationFrame(this.timer);
      const continuingCheckpoint = restoring && this.state === 'PAUSED' && this.checkpoint
        && Math.abs(time - this.elapsed) <= 1e-9;
      this.elapsed = Math.max(this.start, Math.min(this.data.duration, time));
      this.checkpoint = null;
      if (restoring) {
        this.revision++;
        this.state = 'RESTORING';
        this.emit('playing_state', this.public());
      }
      this.resetCursors(this.elapsed, restoring);
      if (!continuingCheckpoint) this.pendingStops = this.stops().filter(([, at]) => at > this.elapsed + 1e-8);
      this.origin = performance.now() - this.wallAt(this.elapsed) * 1000;
      this.state = this.elapsed < this.data.fixation_seconds ? 'FIXATION' : 'RUNNING';
      this.emit('playing_state', this.public());
      this.timer = requestAnimationFrame(() => this.tick());
    }
    tick() {
      if (!['FIXATION', 'RUNNING'].includes(this.state)) return;
      const stop = this.pendingStops[0];
      const end = Math.min(this.data.duration, stop?.[1] ?? Infinity,
        this.sourceAt((performance.now() - this.origin) / 1000));
      const timestamps = [], samples = [], predictions = [], actions = [];
      while (this.sample < this.data.timestamps.length && this.data.timestamps[this.sample] <= end) {
        timestamps.push(this.data.timestamps[this.sample]); samples.push(this.data.samples[this.sample++]);
      }
      while (this.prediction < this.data.predictions.length && this.data.predictions[this.prediction].sample_elapsed <= end)
        predictions.push(this.data.predictions[this.prediction++]);
      while (this.action < this.data.schedule.length && this.data.schedule[this.action].at <= end) {
        actions.push({...this.data.schedule[this.action], index: this.action}); this.action++;
      }
      this.elapsed = end;
      this.state = end < this.data.fixation_seconds ? 'FIXATION' : 'RUNNING';
      this.emit('playing_frame', {elapsed: end, playback_rate: this.rate, state: this.state,
        timestamps, samples, predictions, actions, presentation: this.evidence()});
      if (stop && end >= stop[1]) {
        this.checkpoint = stop[0]; this.pendingStops.shift(); this.pause();
      } else if (end >= this.data.duration) {
        this.state = 'COMPLETE'; this.emit('playing_state', this.public());
      } else this.timer = requestAnimationFrame(() => this.tick());
    }
    pause() {
      cancelAnimationFrame(this.timer);
      this.state = 'PAUSED'; this.revision++;
      this.emit('playing_state', this.public());
    }
    close() { cancelAnimationFrame(this.timer); this.state = 'CANCELLED'; }
  }
  window.StaticReplay = {
    async api(path, options = {}) {
      const url = new URL(path, location.href), method = options.method || 'GET';
      const payload = options.body ? JSON.parse(options.body) : {};
      const index = await catalogue();
      if (method === 'GET' && url.pathname === '/api/playing/catalogue') return copy(index.playing);
      if (method === 'GET' && url.pathname === '/api/presentation/catalogue') return copy(index.presentation);
      if (method === 'GET' && url.pathname === '/api/presentation/sets') return copy({sets: index.sets});
      if (method === 'GET' && url.pathname === '/api/scenarios') return copy(index.scenarios);
      if (method === 'GET' && url.pathname === '/api/decoders') return {decoders: []};
      if (method === 'GET' && url.pathname === '/api/health') return {status: 'ok', eeg: {
        mode: 'saved', status: 'disconnected', stream_name: 'Saved EEG', channels_valid: false,
        sample_rate: 128, channel_count: 14, buffer_ready: false,
      }};
      if (method === 'POST' && url.pathname === '/api/session') {
        if (payload.playing_session_type !== 'pre_recorded' || payload.experiment_mode !== 'presentation')
          throw new Error('Only saved Presentation trials are available on the published website.');
        const path = index.files[payload.recorded_source_id];
        if (!path) throw new Error('Choose a published recording.');
        const data = await json(path);
        let presentation = null;
        if (payload.experiment_mode === 'presentation') {
          const candidates = [...index.sets, index.presentation.suggested_set].flatMap(s => s.entries);
          presentation = candidates.find(e => JSON.stringify(e) === JSON.stringify(payload.presentation_entry));
          if (!presentation || presentation.recording_id !== payload.recorded_source_id)
            throw new Error('Choose an entry in a published presentation set.');
        }
        const session = new Replay(data, payload, presentation);
        sessions.set(session.id, session);
        return session.public();
      }
      const match = url.pathname.match(/^\/api\/session\/([^/]+)(?:\/(hint-confirmed|pause|resume|stop))?$/);
      if (match) {
        const session = sessions.get(match[1]);
        if (!session) throw new Error('Replay is no longer active.');
        const action = match[2];
        if (method === 'GET' && !action) return session.public();
        if (method === 'POST') {
          if (action === 'hint-confirmed' && session.state === 'BRIEFING') session.run();
          else if (action === 'pause' && ['FIXATION', 'RUNNING'].includes(session.state)) session.pause();
          else if (action === 'resume' && ['PAUSED', 'COMPLETE'].includes(session.state)) {
            const time = Number(payload.source_time);
            if (!Number.isFinite(time) || time < session.start || time > session.elapsed)
              throw new Error('Choose an already played point in the trial.');
            session.run(time, true);
          } else if (action === 'stop') { session.close(); sessions.delete(session.id); }
          else throw new Error('Replay command is unavailable in this state.');
          return session.public();
        }
      }
      throw new Error('The published demo is read-only. Use the local application for editing or recording.');
    },
    stream(id) {
      const session = sessions.get(id);
      if (!session) throw new Error('Replay is no longer active.');
      const bindings = [];
      return {
        addEventListener(type, listener) { session.events.addEventListener(type, listener); bindings.push([type, listener]); },
        close() { bindings.forEach(([type, listener]) => session.events.removeEventListener(type, listener)); },
      };
    },
  };
})();
