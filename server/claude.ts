// Calls the learner's own Claude Code CLI headlessly (`claude -p`) with a JSON schema,
// so no API key lives in the app. Each call is stateless: context goes in the prompt.

import { execFile, execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export class TutorError extends Error {}

let resolved: string | null = null;

/** Finds a directly spawnable Claude Code binary (avoids the Windows .cmd shim). */
export function resolveClaude(): string {
  if (resolved) return resolved;
  const fromEnv = process.env.CLAUDE_BIN;
  if (fromEnv && fs.existsSync(fromEnv)) return (resolved = fromEnv);

  let candidates: string[] = [];
  try {
    const out = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    candidates = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } catch {
    // not on PATH
  }
  const home = os.homedir();
  candidates.push(
    path.join(home, '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude'),
    path.join(home, '.claude', 'local', 'claude'),
  );
  for (const candidate of candidates) {
    if (process.platform === 'win32') {
      if (/\.exe$/i.test(candidate) && fs.existsSync(candidate)) return (resolved = candidate);
      // npm global install: claude.cmd → node_modules/@anthropic-ai/claude-code/bin/claude.exe
      const exe = path.join(path.dirname(candidate), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
      if (fs.existsSync(exe)) return (resolved = exe);
    } else if (fs.existsSync(candidate)) {
      return (resolved = candidate);
    }
  }
  throw new TutorError(
    'Không tìm thấy Claude Code. Hãy cài Claude Code và đăng nhập (chạy "claude" một lần), hoặc đặt biến CLAUDE_BIN.',
  );
}

export async function claudeHealth(): Promise<{ ok: boolean; detail: string }> {
  try {
    const bin = resolveClaude();
    const version = await new Promise<string>((resolve, reject) => {
      execFile(bin, ['--version'], { timeout: 15_000, windowsHide: true }, (err, stdout) =>
        err ? reject(err) : resolve(stdout.trim()),
      );
    });
    return { ok: true, detail: `Claude Code ${version}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

type RunOptions = {
  system: string;
  prompt: string;
  schema: object;
  model: string;
  timeoutMs?: number;
};

export function runClaude<T>(options: RunOptions): Promise<T> {
  const bin = resolveClaude();
  const args = [
    '-p',
    '--output-format', 'json',
    '--model', options.model,
    '--safe-mode',
    '--tools', '',
    '--no-session-persistence',
    '--system-prompt', options.system,
    '--json-schema', JSON.stringify(options.schema),
  ];
  // A neutral working directory keeps the project's CLAUDE.md and skills out of tutor calls.
  const cwd = path.join(os.tmpdir(), 'speakeasy-tutor');
  fs.mkdirSync(cwd, { recursive: true });
  const env = { ...process.env };
  delete env.CLAUDECODE; // allow running the app from inside a Claude Code session

  return new Promise<T>((resolve, reject) => {
    const child = spawn(bin, args, { cwd, env, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new TutorError('Claude phản hồi quá lâu (quá thời gian chờ). Hãy thử lại.'));
    }, options.timeoutMs ?? 150_000);
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new TutorError(`Không chạy được Claude Code: ${err.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      let parsed: { is_error?: boolean; result?: string; structured_output?: unknown };
      try {
        parsed = JSON.parse(stdout);
      } catch {
        const why = (stderr || stdout).trim().slice(0, 400);
        reject(new TutorError(`Claude Code lỗi (mã ${code}). ${why || 'Bạn đã đăng nhập Claude Code chưa?'}`));
        return;
      }
      if (parsed.is_error) {
        reject(new TutorError(`Claude báo lỗi: ${String(parsed.result ?? '').slice(0, 400)}`));
        return;
      }
      try {
        resolve((parsed.structured_output ?? JSON.parse(parsed.result ?? '')) as T);
      } catch {
        reject(new TutorError('Claude trả về dữ liệu không đúng định dạng. Hãy thử lại.'));
      }
    });
    child.stdin.end(options.prompt, 'utf8');
  });
}
