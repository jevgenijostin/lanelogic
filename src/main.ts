const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const pending = new Map<number, (v: unknown) => void>();
let id = 0;
worker.onmessage = e => { pending.get(e.data.id)?.(e.data); pending.delete(e.data.id); };
function solve(lp: string) { return new Promise(resolve => { pending.set(++id, resolve); worker.postMessage({ id, lp }); }); }
Object.assign(window, { solveLP: solve });
document.querySelector('#run')!.addEventListener('click', async () => {
  document.querySelector('#output')!.textContent = JSON.stringify(await solve('Maximize\n obj: x\nSubject To\n c: x <= 1\nBinary\n x\nEnd'), null, 2);
});
