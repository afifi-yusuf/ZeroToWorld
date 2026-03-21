import path from "path";
import fs from "fs";
import { TranscriptSegment, FrameEntry, FrameMeta, WsTtsMessage } from "./types";
import { resetCaptureSessionState } from "./capture";

export class RingBuffer<T> {
  private buffer: T[] = [];
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  push(item: T): void {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push(item);
  }

  latest(): T | undefined {
    return this.buffer[this.buffer.length - 1];
  }

  lastN(n: number): T[] {
    return this.buffer.slice(-n);
  }

  all(): T[] {
    return [...this.buffer];
  }

  get length(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
  }
}

export class RelayState {
  readonly frames = new RingBuffer<FrameEntry>(30);
  readonly transcripts = new RingBuffer<TranscriptSegment>(500);
  readonly ttsMessages = new RingBuffer<WsTtsMessage>(50);

  private _framesIngested = 0;
  private _transcriptsIngested = 0;
  private _ttsIngested = 0;
  private readonly _startTime = Date.now();

  // ── Session tracking ──
  private _currentSessionId: string | null = null;
  private _sessionDir: string | null = null;
  private _sessionFrameCount = 0;
  private _sessionStartTime: number | null = null;

  get currentSessionId(): string | null {
    return this._currentSessionId;
  }

  get sessionDir(): string | null {
    return this._sessionDir;
  }

  get sessionFrameCount(): number {
    return this._sessionFrameCount;
  }

  get framesIngested(): number {
    return this._framesIngested;
  }

  get transcriptsIngested(): number {
    return this._transcriptsIngested;
  }

  get ttsIngested(): number {
    return this._ttsIngested;
  }

  get uptimeS(): number {
    return Math.floor((Date.now() - this._startTime) / 1000);
  }

  startSession(sessionId: string): string {
    const capturesRoot = path.join(__dirname, "..", "captures");
    const sessionDir = path.join(capturesRoot, sessionId, "images");
    fs.mkdirSync(sessionDir, { recursive: true });

    this._currentSessionId = sessionId;
    this._sessionDir = sessionDir;
    this._sessionFrameCount = 0;
    this._sessionStartTime = Date.now();

    console.log(`[session] Started: ${sessionId} → ${sessionDir}`);
    return sessionDir;
  }

  stopSession(): { sessionId: string; frameCount: number; durationS: number } | null {
    if (!this._currentSessionId || !this._sessionStartTime) return null;

    const result = {
      sessionId: this._currentSessionId,
      frameCount: this._sessionFrameCount,
      durationS: Math.floor((Date.now() - this._sessionStartTime) / 1000),
    };

    console.log(
      `[session] Stopped: ${result.sessionId} · ${result.frameCount} frames · ${result.durationS}s`
    );

    this._currentSessionId = null;
    this._sessionDir = null;
    this._sessionFrameCount = 0;
    this._sessionStartTime = null;

    return result;
  }

  /** Write a frame JPEG to disk if a session is active */
  persistFrame(data: Buffer, frameId: string): string | null {
    if (!this._sessionDir) return null;

    const filename = `${Date.now()}_${frameId}.jpg`;
    const filepath = path.join(this._sessionDir, filename);
    fs.writeFileSync(filepath, data);
    this._sessionFrameCount++;
    return filepath;
  }

  addFrame(entry: FrameEntry): void {
    this.frames.push(entry);
    this._framesIngested++;
  }

  addTranscript(segment: TranscriptSegment): void {
    this.transcripts.push(segment);
    this._transcriptsIngested++;
  }

  addTts(msg: WsTtsMessage): void {
    this.ttsMessages.push(msg);
    this._ttsIngested++;
  }

  latestTts(): WsTtsMessage | undefined {
    return this.ttsMessages.latest();
  }

  latestFrame(): FrameEntry | undefined {
    return this.frames.latest();
  }

  latestTranscript(): TranscriptSegment | undefined {
    return this.transcripts.latest();
  }

  recentTranscripts(limit: number): TranscriptSegment[] {
    return this.transcripts.lastN(limit);
  }

  allTranscripts(): TranscriptSegment[] {
    return this.transcripts.all();
  }

  reset(): void {
    this.frames.clear();
    this.transcripts.clear();
    this.ttsMessages.clear();
    this._framesIngested = 0;
    this._transcriptsIngested = 0;
    this._ttsIngested = 0;
    resetCaptureSessionState();
  }
}

export const state = new RelayState();
