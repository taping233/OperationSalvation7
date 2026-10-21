export interface GameRuntime {
  openClassChoice(options?: { recoveringRun?: boolean }): unknown;
  openBaseHub(options?: { immediate?: boolean }): unknown;
  rebuildNotes(): void;
  resize(): void;
  showRunTransition(options?: object): Promise<unknown>;
  syncDevVisibility(): void;
  resumeExtraction(saved: unknown): { ok: boolean; code?: string; message?: string };
  resumeChestsOnCell(saved: unknown): boolean;
  resumeEventCardChoice(): boolean;
  resumeBattleRewards(saved: unknown): boolean;
  log(text: string, kind?: string): void;
}
