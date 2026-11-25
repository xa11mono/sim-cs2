"""JSONL control channel to the shared browser. Records go straight to their output files."""
import json
import subprocess
import threading
from pathlib import Path


class SharedJob:
    def __init__(self, process, ident):
        self.process = process
        self.ident = ident
        self.returncode = None

    def poll(self):
        if self.returncode is not None:
            return self.returncode
        if self.ident not in self.process.results:
            if self.process.child.poll() is None and not self.process.closed:
                return None
            self.process.reader.join()
        error = self.process.results.pop(self.ident, 'Общий браузер завершился до записи результата')
        self.returncode = int(error is not None)
        if error:
            print(error, flush=True)
        return self.returncode


class SharedProcess:
    def __init__(self, root):
        self.child = subprocess.Popen(
            ['node', str(Path(__file__).with_name('shared.cjs'))], cwd=root,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, encoding='utf-8', bufsize=1
        )
        self.results = {}
        self.closed = False
        self.next_id = 0
        self.reader = threading.Thread(target=self._read, daemon=True)
        self.reader.start()

    def _read(self):
        try:
            for line in self.child.stdout:
                reply = json.loads(line)
                self.results[reply['id']] = reply['error']
        finally:
            self.closed = True

    def submit(self, html, code, output, stream, timeout_ms):
        job = SharedJob(self, self.next_id)
        self.next_id += 1
        request = dict(id=job.ident, html=html, code=code, output=output, stream=stream, timeoutMs=timeout_ms)
        self.child.stdin.write(json.dumps(request) + '\n')
        self.child.stdin.flush()
        return job

    def close(self):
        try:
            self.child.stdin.close()
        except BrokenPipeError:
            pass
        try:
            self.child.wait(timeout=15)
        except subprocess.TimeoutExpired:
            self.child.kill()
            self.child.wait()
        self.reader.join()
        self.child.stdout.close()
