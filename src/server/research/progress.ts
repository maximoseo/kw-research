import { EventEmitter } from 'events';

export interface RunProgressEvent {
  runId: string;
  progress: number;
  step: string;
  status: string;
  resultCount?: number;
  errorMessage?: string;
}

const bus = new EventEmitter();
bus.setMaxListeners(200); // enough for concurrent SSE connections

export function broadcastRunProgress(event: RunProgressEvent) {
  bus.emit(`run:${event.runId}`, event);
}

export function subscribeRunProgress(
  runId: string,
  onEvent: (data: RunProgressEvent) => void,
): () => void {
  const channel = `run:${runId}`;
  bus.on(channel, onEvent);
  return () => bus.off(channel, onEvent);
}
